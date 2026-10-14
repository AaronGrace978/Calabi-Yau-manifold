//! Provider-agnostic streaming protocol: request payload construction and frame parsing.
//! Kept free of Tauri types so it can be unit-tested without a WebView toolchain.

use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};

/// Sampling parameters chosen by the frontend control surface. `None` keeps provider defaults.
#[derive(Debug, Clone, Copy, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SamplingParams {
    pub temperature: Option<f64>,
    pub top_p: Option<f64>,
    pub repetition_penalty: Option<f64>,
}

/// One streamed token, timestamped on arrival in Rust (before IPC latency is added).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InferenceFrame {
    pub run_id: String,
    pub index: u64,
    pub token: String,
    pub thinking: bool,
    /// Milliseconds since the request was sent.
    pub t_ms: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InferenceDone {
    pub run_id: String,
    pub tokens: u64,
    pub t_ms: f64,
    pub error: Option<String>,
}

/// Extracts `(token, is_thinking, is_done)` from any supported streaming JSON frame.
pub fn extract_token_from_json(val: &Value) -> (String, bool, bool) {
    let mut is_done = val.get("done").and_then(|d| d.as_bool()).unwrap_or(false);

    if let Some(event_type) = val.get("type").and_then(|t| t.as_str()) {
        if event_type == "message_stop" {
            is_done = true;
        }
    }

    // Ollama `/api/generate`
    if let Some(resp) = val.get("response").and_then(|r| r.as_str()) {
        if !resp.is_empty() {
            return (resp.to_string(), false, is_done);
        }
    }

    // Ollama `/api/chat` (`message.content` / `message.thinking`)
    if let Some(msg) = val.get("message") {
        if let Some(content) = msg.get("content").and_then(|c| c.as_str()) {
            if !content.is_empty() {
                return (content.to_string(), false, is_done);
            }
        }
        if let Some(thinking) = msg.get("thinking").and_then(|t| t.as_str()) {
            if !thinking.is_empty() {
                return (thinking.to_string(), true, is_done);
            }
        }
    }

    // OpenAI-compatible SSE (`choices[0].delta.content` / `reasoning_content`)
    if let Some(choices) = val.get("choices").and_then(|c| c.as_array()) {
        if let Some(first) = choices.first() {
            if first
                .get("finish_reason")
                .and_then(|f| f.as_str())
                .is_some()
            {
                is_done = true;
            }
            if let Some(delta) = first.get("delta") {
                if let Some(content) = delta.get("content").and_then(|c| c.as_str()) {
                    if !content.is_empty() {
                        return (content.to_string(), false, is_done);
                    }
                }
                if let Some(reasoning) = delta
                    .get("reasoning_content")
                    .or_else(|| delta.get("reasoning"))
                    .and_then(|r| r.as_str())
                {
                    if !reasoning.is_empty() {
                        return (reasoning.to_string(), true, is_done);
                    }
                }
            }
        }
    }

    // Anthropic Messages SSE (`delta.text` / `delta.thinking`)
    if let Some(delta) = val.get("delta") {
        if let Some(text) = delta.get("text").and_then(|t| t.as_str()) {
            if !text.is_empty() {
                return (text.to_string(), false, is_done);
            }
        }
        if let Some(thinking) = delta.get("thinking").and_then(|t| t.as_str()) {
            if !thinking.is_empty() {
                return (thinking.to_string(), true, is_done);
            }
        }
    }

    // Google Gemini SSE (`candidates[0].content.parts[*].text`)
    if let Some(candidates) = val.get("candidates").and_then(|c| c.as_array()) {
        if let Some(first) = candidates.first() {
            if let Some(parts) = first
                .get("content")
                .and_then(|c| c.get("parts"))
                .and_then(|p| p.as_array())
            {
                let mut combined = String::new();
                for part in parts {
                    if let Some(t) = part.get("text").and_then(|t| t.as_str()) {
                        combined.push_str(t);
                    }
                }
                if !combined.is_empty() {
                    return (combined, false, is_done);
                }
            }
        }
    }

    (String::new(), false, is_done)
}

/// Parses one raw stream line (NDJSON or SSE `data:`). Returns `None` for keep-alives/comments,
/// `Some(Err(()))` for an explicit `[DONE]` sentinel, and `Some(Ok(value))` for a JSON frame.
pub fn parse_stream_line(raw: &str) -> Option<Result<Value, ()>> {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed.starts_with(':') || trimmed.starts_with("event:") {
        return None;
    }
    let payload = trimmed
        .strip_prefix("data:")
        .map(|s| s.trim())
        .unwrap_or(trimmed);
    if payload.is_empty() {
        return None;
    }
    if payload == "[DONE]" {
        return Some(Err(()));
    }
    serde_json::from_str::<Value>(payload).ok().map(Ok)
}

fn finite(v: Option<f64>) -> Option<f64> {
    v.filter(|x| x.is_finite())
}

/// Builds the provider-specific JSON body, applying control-surface sampling parameters.
pub fn build_payload(
    provider_id: &str,
    model: &str,
    prompt: &str,
    api_url: &str,
    sampling: SamplingParams,
) -> Value {
    build_payload_with_system(provider_id, model, prompt, None, api_url, sampling)
}

/// Builds the provider-specific JSON body with an optional system prompt.
pub fn build_payload_with_system(
    provider_id: &str,
    model: &str,
    prompt: &str,
    system_prompt: Option<&str>,
    api_url: &str,
    sampling: SamplingParams,
) -> Value {
    let temperature = finite(sampling.temperature).map(|t| t.clamp(0.0, 2.0));
    let top_p = finite(sampling.top_p).map(|p| p.clamp(0.0, 1.0));
    let penalty = finite(sampling.repetition_penalty)
        .map(|p| p.clamp(0.0, 2.0))
        .filter(|p| *p > 0.0);
    let sys_trimmed = system_prompt.map(|s| s.trim()).filter(|s| !s.is_empty());

    match provider_id {
        "ollama-cloud" | "ollama-local" => {
            let mut options = Map::new();
            options.insert("temperature".into(), json!(temperature.unwrap_or(0.7)));
            options.insert("top_p".into(), json!(top_p.unwrap_or(0.9)));
            if let Some(p) = penalty {
                options.insert("repeat_penalty".into(), json!(1.0 + p * 0.5));
            }
            if api_url.ends_with("/api/generate") {
                let mut body = json!({ "model": model, "prompt": prompt, "stream": true, "options": options });
                if let Some(sys) = sys_trimmed {
                    body["system"] = json!(sys);
                }
                body
            } else {
                let mut messages = Vec::new();
                if let Some(sys) = sys_trimmed {
                    messages.push(json!({ "role": "system", "content": sys }));
                }
                messages.push(json!({ "role": "user", "content": prompt }));
                json!({
                    "model": model,
                    "messages": messages,
                    "stream": true,
                    "options": options
                })
            }
        }
        "anthropic" => {
            let mut body = json!({
                "model": model,
                "max_tokens": if sys_trimmed.is_some() { 8192 } else { 4096 },
                "stream": true,
                "messages": [{ "role": "user", "content": prompt }]
            });
            if let Some(sys) = sys_trimmed {
                body["system"] = json!(sys);
            }
            if let Some(t) = temperature {
                body["temperature"] = json!(t.min(1.0));
            }
            body
        }
        "google" | "gemini" => {
            let mut config = Map::new();
            config.insert("temperature".into(), json!(temperature.unwrap_or(0.7)));
            if let Some(p) = top_p {
                config.insert("topP".into(), json!(p));
            }
            let mut body = json!({
                "contents": [{ "role": "user", "parts": [{ "text": prompt }] }],
                "generationConfig": config
            });
            if let Some(sys) = sys_trimmed {
                body["systemInstruction"] = json!({ "parts": [{ "text": sys }] });
            }
            body
        }
        _ => {
            let mut messages = Vec::new();
            if let Some(sys) = sys_trimmed {
                messages.push(json!({ "role": "system", "content": sys }));
            }
            messages.push(json!({ "role": "user", "content": prompt }));
            let mut body = json!({
                "model": model,
                "messages": messages,
                "stream": true,
                "temperature": temperature.unwrap_or(0.7)
            });
            if let Some(p) = top_p {
                body["top_p"] = json!(p);
            }
            if let Some(p) = penalty {
                body["frequency_penalty"] = json!(p);
            }
            body
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_content_and_thinking_across_formats() {
        let ollama = json!({ "message": { "content": "", "thinking": "hmm" }, "done": false });
        assert_eq!(extract_token_from_json(&ollama), ("hmm".into(), true, false));

        let openai = json!({ "choices": [{ "delta": { "content": "hi" }, "finish_reason": null }] });
        assert_eq!(extract_token_from_json(&openai), ("hi".into(), false, false));

        let reasoning = json!({ "choices": [{ "delta": { "reasoning_content": "r" } }] });
        assert_eq!(extract_token_from_json(&reasoning), ("r".into(), true, false));

        let anthropic_stop = json!({ "type": "message_stop" });
        assert_eq!(extract_token_from_json(&anthropic_stop), (String::new(), false, true));

        let gemini = json!({ "candidates": [{ "content": { "parts": [{ "text": "a" }, { "text": "b" }] } }] });
        assert_eq!(extract_token_from_json(&gemini), ("ab".into(), false, false));
    }

    #[test]
    fn parses_sse_and_ndjson_lines() {
        assert!(parse_stream_line(": keep-alive").is_none());
        assert!(parse_stream_line("event: ping").is_none());
        assert_eq!(parse_stream_line("data: [DONE]"), Some(Err(())));
        let v = parse_stream_line("data: {\"response\":\"x\"}").unwrap().unwrap();
        assert_eq!(v["response"], "x");
        let v = parse_stream_line("{\"done\":true}").unwrap().unwrap();
        assert_eq!(v["done"], true);
    }

    #[test]
    fn applies_sampling_params_per_provider() {
        let s = SamplingParams {
            temperature: Some(1.3),
            top_p: Some(0.85),
            repetition_penalty: Some(0.6),
        };
        let o = build_payload("ollama-cloud", "m", "p", "https://ollama.com/api/chat", s);
        assert_eq!(o["options"]["temperature"], 1.3);
        assert_eq!(o["options"]["top_p"], 0.85);
        assert_eq!(o["options"]["repeat_penalty"], 1.3);

        let oa = build_payload("openai", "m", "p", "", s);
        assert_eq!(oa["temperature"], 1.3);
        assert_eq!(oa["frequency_penalty"], 0.6);

        let an = build_payload("anthropic", "m", "p", "", s);
        assert_eq!(an["temperature"], 1.0);
        assert!(an.get("top_p").is_none());

        let g = build_payload("google", "m", "p", "", s);
        assert_eq!(g["generationConfig"]["topP"], 0.85);

        let d = build_payload("openai", "m", "p", "", SamplingParams::default());
        assert_eq!(d["temperature"], 0.7);
        assert!(d.get("top_p").is_none());
        assert!(d.get("frequency_penalty").is_none());
    }

    #[test]
    fn frame_serializes_camel_case() {
        let f = InferenceFrame {
            run_id: "r".into(),
            index: 3,
            token: "t".into(),
            thinking: false,
            t_ms: 12.5,
        };
        let v = serde_json::to_value(&f).unwrap();
        assert_eq!(v["runId"], "r");
        assert_eq!(v["tMs"], 12.5);
    }
}
