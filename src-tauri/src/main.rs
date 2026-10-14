#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::env;
use std::time::Instant;
use tauri::Window;

/// Calculates a normalized quantum string vibration frequency metric in the range [0.08, 5.0]
/// derived from instantaneous token generation velocity (tokens/sec), token byte entropy,
/// and harmonic phase oscillation.
fn compute_quantum_metric(token: &str, elapsed_secs: f64, sequence_idx: u64) -> f64 {
    let safe_dt = elapsed_secs.max(0.0015);
    let instant_tps = (1.0 / safe_dt).clamp(1.0, 160.0);

    let char_count = token.chars().count() as f64;
    let byte_entropy: f64 = token
        .bytes()
        .fold(0u64, |acc, b| acc.wrapping_add(b as u64)) as f64;
    let spectral_mod = ((byte_entropy * 0.073 + sequence_idx as f64 * 0.41).sin() + 1.0) * 0.5;

    let velocity_component = (instant_tps / 45.0).powf(0.85);
    let length_component = (char_count / 6.0).clamp(0.15, 2.2);
    let harmonic_component = 0.75 + 0.5 * spectral_mod;

    (velocity_component * length_component * harmonic_component).clamp(0.08, 5.0)
}

/// Resolves an API key from explicit user input or standard provider environment variables.
fn resolve_api_key(provider_id: &str, provided_key: Option<String>) -> Option<String> {
    if let Some(k) = provided_key {
        let trimmed = k.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }

    let env_vars: &[&str] = match provider_id {
        "ollama-cloud" => &["OLLAMA_API_KEY", "OLLAMA_CLOUD_API_KEY"],
        "openai" => &["OPENAI_API_KEY"],
        "anthropic" => &["ANTHROPIC_API_KEY"],
        "google" | "gemini" => &["GEMINI_API_KEY", "GOOGLE_API_KEY"],
        "xai" => &["XAI_API_KEY"],
        "deepseek" => &["DEEPSEEK_API_KEY"],
        "groq" => &["GROQ_API_KEY"],
        "openrouter" => &["OPENROUTER_API_KEY"],
        "mistral" => &["MISTRAL_API_KEY"],
        "together" => &["TOGETHER_API_KEY"],
        "fireworks" => &["FIREWORKS_API_KEY"],
        "perplexity" => &["PERPLEXITY_API_KEY", "PPLX_API_KEY"],
        "cohere" => &["COHERE_API_KEY", "CO_API_KEY"],
        "cerebras" => &["CEREBRAS_API_KEY"],
        "sambanova" => &["SAMBANOVA_API_KEY"],
        "alibaba" | "qwen" => &["DASHSCOPE_API_KEY", "QWEN_API_KEY"],
        "zhipu" | "glm" => &["ZHIPU_API_KEY", "GLM_API_KEY"],
        "moonshot" | "kimi" => &["MOONSHOT_API_KEY", "KIMI_API_KEY"],
        "minimax" => &["MINIMAX_API_KEY"],
        "nvidia" => &["NVIDIA_API_KEY", "NGC_API_KEY"],
        "meta" => &["META_API_KEY", "LLAMA_API_KEY"],
        _ => &["OLLAMA_API_KEY", "OPENAI_API_KEY"],
    };

    for var_name in env_vars {
        if let Ok(val) = env::var(var_name) {
            let trimmed = val.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    None
}

fn default_endpoint_for_provider(provider_id: &str, model: &str) -> String {
    match provider_id {
        "ollama-cloud" => "https://ollama.com/api/chat".to_string(),
        "ollama-local" => "http://localhost:11434/api/chat".to_string(),
        "openai" => "https://api.openai.com/v1/chat/completions".to_string(),
        "anthropic" => "https://api.anthropic.com/v1/messages".to_string(),
        "google" | "gemini" => format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse"
        ),
        "xai" => "https://api.x.ai/v1/chat/completions".to_string(),
        "deepseek" => "https://api.deepseek.com/chat/completions".to_string(),
        "groq" => "https://api.groq.com/openai/v1/chat/completions".to_string(),
        "openrouter" => "https://openrouter.ai/api/v1/chat/completions".to_string(),
        "mistral" => "https://api.mistral.ai/v1/chat/completions".to_string(),
        "together" => "https://api.together.xyz/v1/chat/completions".to_string(),
        "fireworks" => "https://api.fireworks.ai/inference/v1/chat/completions".to_string(),
        "perplexity" => "https://api.perplexity.ai/chat/completions".to_string(),
        "cohere" => "https://api.cohere.com/compatibility/v1/chat/completions".to_string(),
        "cerebras" => "https://api.cerebras.ai/v1/chat/completions".to_string(),
        "sambanova" => "https://api.sambanova.ai/v1/chat/completions".to_string(),
        "alibaba" | "qwen" => {
            "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions".to_string()
        }
        "zhipu" | "glm" => "https://open.bigmodel.cn/api/paas/v4/chat/completions".to_string(),
        "moonshot" | "kimi" => "https://api.moonshot.ai/v1/chat/completions".to_string(),
        "minimax" => "https://api.minimax.io/v1/text/chatcompletion_v2".to_string(),
        "nvidia" => "https://integrate.api.nvidia.com/v1/chat/completions".to_string(),
        "meta" => "https://api.llama.com/compat/v1/chat/completions".to_string(),
        _ => "https://ollama.com/api/chat".to_string(),
    }
}

/// Extracts a token snippet from any supported streaming JSON frame:
/// - Ollama NDJSON (`/api/chat` -> `message.content`/`message.thinking` or `/api/generate` -> `response`)
/// - OpenAI / xAI / DeepSeek / Groq / OpenRouter / Mistral / Together / Fireworks SSE (`choices[0].delta.content` or `reasoning_content`)
/// - Anthropic Messages SSE (`delta.text` or `delta.thinking`)
/// - Google Gemini SSE (`candidates[0].content.parts[0].text`)
fn extract_token_from_json(val: &Value) -> (String, bool) {
    let mut is_done = val.get("done").and_then(|d| d.as_bool()).unwrap_or(false);

    if let Some(event_type) = val.get("type").and_then(|t| t.as_str()) {
        if event_type == "message_stop" || event_type == "content_block_stop" {
            if event_type == "message_stop" {
                is_done = true;
            }
        }
    }

    // 1. Ollama `/api/generate` format
    if let Some(resp) = val.get("response").and_then(|r| r.as_str()) {
        if !resp.is_empty() {
            return (resp.to_string(), is_done);
        }
    }

    // 2. Ollama `/api/chat` format (`message.content` or `message.thinking`)
    if let Some(msg) = val.get("message") {
        if let Some(content) = msg.get("content").and_then(|c| c.as_str()) {
            if !content.is_empty() {
                return (content.to_string(), is_done);
            }
        }
        if let Some(thinking) = msg.get("thinking").and_then(|t| t.as_str()) {
            if !thinking.is_empty() {
                return (thinking.to_string(), is_done);
            }
        }
    }

    // 3. OpenAI-compatible SSE format (`choices[0].delta.content` / `reasoning_content`)
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
                        return (content.to_string(), is_done);
                    }
                }
                if let Some(reasoning) = delta
                    .get("reasoning_content")
                    .or_else(|| delta.get("reasoning"))
                    .and_then(|r| r.as_str())
                {
                    if !reasoning.is_empty() {
                        return (reasoning.to_string(), is_done);
                    }
                }
            }
        }
    }

    // 4. Anthropic Messages SSE format (`delta.text` / `delta.thinking`)
    if let Some(delta) = val.get("delta") {
        if let Some(text) = delta.get("text").and_then(|t| t.as_str()) {
            if !text.is_empty() {
                return (text.to_string(), is_done);
            }
        }
        if let Some(thinking) = delta.get("thinking").and_then(|t| t.as_str()) {
            if !thinking.is_empty() {
                return (thinking.to_string(), is_done);
            }
        }
    }

    // 5. Google Gemini SSE format (`candidates[0].content.parts[0].text`)
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
                    return (combined, is_done);
                }
            }
        }
    }

    (String::new(), is_done)
}

#[derive(Serialize, Deserialize, Debug)]
struct DiscoveredModel {
    id: String,
    label: String,
}

#[tauri::command]
async fn fetch_provider_models(
    provider: String,
    api_key: Option<String>,
    endpoint: Option<String>,
) -> Result<Vec<DiscoveredModel>, String> {
    let provider_id = provider.trim().to_lowercase();
    let resolved_key = resolve_api_key(&provider_id, api_key);

    let client = Client::builder()
        .no_proxy()
        .build()
        .map_err(|e| format!("Failed to initialize HTTP client: {e}"))?;

    let tags_url = match provider_id.as_str() {
        "ollama-cloud" => endpoint
            .filter(|u| !u.trim().is_empty())
            .unwrap_or_else(|| "https://ollama.com/api/tags".to_string()),
        "ollama-local" => endpoint
            .filter(|u| !u.trim().is_empty())
            .unwrap_or_else(|| "http://localhost:11434/api/tags".to_string()),
        "openai" => "https://api.openai.com/v1/models".to_string(),
        "openrouter" => "https://openrouter.ai/api/v1/models".to_string(),
        "groq" => "https://api.groq.com/openai/v1/models".to_string(),
        "xai" => "https://api.x.ai/v1/models".to_string(),
        "deepseek" => "https://api.deepseek.com/models".to_string(),
        "mistral" => "https://api.mistral.ai/v1/models".to_string(),
        _ => return Ok(Vec::new()),
    };

    let mut req = client.get(&tags_url);
    if let Some(ref key) = resolved_key {
        req = req.bearer_auth(key);
    }

    let resp = req
        .send()
        .await
        .map_err(|e| format!("Failed to query models from {tags_url}: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {} from {tags_url}", resp.status()));
    }

    let body: Value = resp
        .json()
        .await
        .map_err(|e| format!("Invalid JSON from {tags_url}: {e}"))?;

    let mut result = Vec::new();
    if let Some(models) = body.get("models").and_then(|m| m.as_array()) {
        for item in models {
            if let Some(name) = item
                .get("name")
                .or_else(|| item.get("model"))
                .and_then(|n| n.as_str())
            {
                result.push(DiscoveredModel {
                    id: name.to_string(),
                    label: name.to_string(),
                });
            }
        }
    } else if let Some(data) = body.get("data").and_then(|d| d.as_array()) {
        for item in data {
            if let Some(id) = item.get("id").and_then(|i| i.as_str()) {
                let label = item
                    .get("name")
                    .and_then(|n| n.as_str())
                    .unwrap_or(id)
                    .to_string();
                result.push(DiscoveredModel {
                    id: id.to_string(),
                    label,
                });
            }
        }
    }

    Ok(result)
}

#[tauri::command]
async fn generate_calabi_yau_response(
    window: Window,
    prompt: String,
    provider: Option<String>,
    model: Option<String>,
    api_key: Option<String>,
    endpoint: Option<String>,
) -> Result<String, String> {
    let provider_id = provider
        .as_deref()
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "ollama-cloud".to_string());

    let selected_model = model
        .as_deref()
        .map(|m| m.trim())
        .filter(|m| !m.is_empty())
        .unwrap_or("deepseek-v4.1-flash");

    let resolved_key = resolve_api_key(&provider_id, api_key);

    let api_url = endpoint
        .as_deref()
        .map(|u| u.trim())
        .filter(|u| !u.is_empty())
        .map(|u| u.to_string())
        .unwrap_or_else(|| default_endpoint_for_provider(&provider_id, selected_model));

    let client = Client::builder()
        .no_proxy()
        .build()
        .map_err(|e| format!("Failed to initialize HTTP client: {e}"))?;

    let mut req = client.post(&api_url);

    let payload: Value = match provider_id.as_str() {
        "ollama-cloud" | "ollama-local" => {
            if let Some(ref key) = resolved_key {
                req = req.bearer_auth(key);
            }
            if api_url.ends_with("/api/generate") {
                json!({
                    "model": selected_model,
                    "prompt": prompt,
                    "stream": true,
                    "options": { "temperature": 0.7, "top_p": 0.9 }
                })
            } else {
                json!({
                    "model": selected_model,
                    "messages": [{ "role": "user", "content": prompt }],
                    "stream": true,
                    "options": { "temperature": 0.7, "top_p": 0.9 }
                })
            }
        }
        "anthropic" => {
            let key = resolved_key.ok_or_else(|| {
                "Anthropic API key required (set in UI or ANTHROPIC_API_KEY)".to_string()
            })?;
            req = req
                .header("x-api-key", key)
                .header("anthropic-version", "2023-06-01");
            json!({
                "model": selected_model,
                "max_tokens": 4096,
                "stream": true,
                "messages": [{ "role": "user", "content": prompt }]
            })
        }
        "google" | "gemini" => {
            let key = resolved_key.ok_or_else(|| {
                "Google Gemini API key required (set in UI or GEMINI_API_KEY)".to_string()
            })?;
            req = req.header("x-goog-api-key", key);
            json!({
                "contents": [{
                    "role": "user",
                    "parts": [{ "text": prompt }]
                }],
                "generationConfig": {
                    "temperature": 0.7
                }
            })
        }
        _ => {
            // OpenAI-compatible chat completions (OpenAI, xAI, DeepSeek, Groq, OpenRouter,
            // Mistral, Together, Fireworks, Perplexity, Cerebras, SambaNova, Cohere, Qwen, GLM, Kimi, MiniMax, NVIDIA, Meta)
            if let Some(ref key) = resolved_key {
                req = req.bearer_auth(key);
            }
            if provider_id == "openrouter" {
                req = req
                    .header("HTTP-Referer", "https://github.com/AaronGrace978/Calabi-Yau-manifold")
                    .header("X-Title", "Calabi-Yau AI Platform");
            }
            json!({
                "model": selected_model,
                "messages": [{ "role": "user", "content": prompt }],
                "stream": true,
                "temperature": 0.7
            })
        }
    };

    let response = req.json(&payload).send().await.map_err(|e| {
        format!("Failed to connect to {provider_id} endpoint ({api_url}): {e}")
    })?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!(
            "{provider_id} API ({selected_model}) returned HTTP {status}: {error_text}"
        ));
    }

    let mut byte_stream = response.bytes_stream();
    let mut line_buffer = String::new();
    let mut full_output = String::new();
    let mut last_token_instant = Instant::now();
    let mut token_index: u64 = 0;

    while let Some(chunk_result) = byte_stream.next().await {
        let bytes = chunk_result.map_err(|e| format!("Stream read error: {e}"))?;
        let chunk_str = String::from_utf8_lossy(&bytes);
        line_buffer.push_str(&chunk_str);

        while let Some(newline_pos) = line_buffer.find('\n') {
            let raw_line: String = line_buffer.drain(..=newline_pos).collect();
            let trimmed = raw_line.trim();
            if trimmed.is_empty() || trimmed.starts_with(':') || trimmed.starts_with("event:") {
                continue;
            }

            let json_payload = if let Some(stripped) = trimmed.strip_prefix("data:") {
                stripped.trim()
            } else {
                trimmed
            };

            if json_payload == "[DONE]" || json_payload.is_empty() {
                let _ = window.emit("quantum-metric", 0.15_f64);
                return Ok(full_output);
            }

            let Ok(parsed_val) = serde_json::from_str::<Value>(json_payload) else {
                continue;
            };

            let (token_piece, is_done) = extract_token_from_json(&parsed_val);

            if !token_piece.is_empty() {
                let now = Instant::now();
                let dt = now.duration_since(last_token_instant).as_secs_f64();
                last_token_instant = now;
                token_index += 1;

                let quantum_metric = compute_quantum_metric(&token_piece, dt, token_index);
                full_output.push_str(&token_piece);

                window
                    .emit("token-received", &token_piece)
                    .map_err(|e| format!("Failed to emit token-received event: {e}"))?;

                window
                    .emit("quantum-metric", quantum_metric)
                    .map_err(|e| format!("Failed to emit quantum-metric event: {e}"))?;
            }

            if is_done {
                let _ = window.emit("quantum-metric", 0.12_f64);
                return Ok(full_output);
            }
        }
    }

    let remaining = line_buffer.trim();
    if !remaining.is_empty() {
        let json_payload = remaining.strip_prefix("data:").map(|s| s.trim()).unwrap_or(remaining);
        if json_payload != "[DONE]" {
            if let Ok(parsed_val) = serde_json::from_str::<Value>(json_payload) {
                let (token_piece, _) = extract_token_from_json(&parsed_val);
                if !token_piece.is_empty() {
                    let dt = last_token_instant.elapsed().as_secs_f64();
                    token_index += 1;
                    let quantum_metric = compute_quantum_metric(&token_piece, dt, token_index);
                    full_output.push_str(&token_piece);
                    let _ = window.emit("token-received", &token_piece);
                    let _ = window.emit("quantum-metric", quantum_metric);
                }
            }
        }
    }

    Ok(full_output)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            generate_calabi_yau_response,
            fetch_provider_models
        ])
        .run(tauri::generate_context!())
        .expect("error while running Calabi-Yau AI Platform Tauri application");
}
