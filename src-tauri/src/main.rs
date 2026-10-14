#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Instant;
use tauri::Window;

#[derive(Serialize)]
struct OllamaGenerateRequest<'a> {
    model: &'a str,
    prompt: &'a str,
    stream: bool,
    options: OllamaModelOptions,
}

#[derive(Serialize)]
struct OllamaModelOptions {
    temperature: f32,
    top_p: f32,
}

#[derive(Deserialize, Debug)]
struct OllamaStreamChunk {
    #[serde(default)]
    response: String,
    #[serde(default)]
    done: bool,
    #[serde(default)]
    eval_count: Option<u64>,
    #[serde(default)]
    eval_duration: Option<u64>,
}

/// Calculates a normalized quantum string vibration frequency metric in the range [0.05, 5.0]
/// derived from instantaneous token generation velocity (tokens/sec), token byte entropy,
/// and harmonic phase oscillation.
fn compute_quantum_metric(token: &str, elapsed_secs: f64, sequence_idx: u64) -> f64 {
    let safe_dt = elapsed_secs.max(0.0015);
    let instant_tps = (1.0 / safe_dt).clamp(1.0, 140.0);

    let char_count = token.chars().count() as f64;
    let byte_entropy: f64 = token
        .bytes()
        .fold(0u64, |acc, b| acc.wrapping_add(b as u64)) as f64;
    let spectral_mod = ((byte_entropy * 0.073 + sequence_idx as f64 * 0.41).sin() + 1.0) * 0.5;

    let velocity_component = (instant_tps / 45.0).powf(0.85);
    let length_component = (char_count / 6.0).clamp(0.15, 2.0);
    let harmonic_component = 0.75 + 0.5 * spectral_mod;

    (velocity_component * length_component * harmonic_component).clamp(0.08, 5.0)
}

#[tauri::command]
async fn generate_calabi_yau_response(
    window: Window,
    prompt: String,
    model: Option<String>,
    endpoint: Option<String>,
) -> Result<String, String> {
    let selected_model = model
        .as_deref()
        .filter(|m| !m.trim().is_empty())
        .unwrap_or("llama3");
    let api_url = endpoint
        .as_deref()
        .filter(|u| !u.trim().is_empty())
        .unwrap_or("http://localhost:11434/api/generate");

    let client = Client::builder()
        .no_proxy()
        .build()
        .map_err(|e| format!("Failed to initialize HTTP client: {e}"))?;

    let payload = OllamaGenerateRequest {
        model: selected_model,
        prompt: &prompt,
        stream: true,
        options: OllamaModelOptions {
            temperature: 0.7,
            top_p: 0.9,
        },
    };

    let response = client
        .post(api_url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| {
            format!(
                "Failed to connect to Ollama at {api_url}: {e}. Verify `ollama serve` is running."
            )
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Ollama API returned HTTP {status}: {error_text}"));
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
            if trimmed.is_empty() {
                continue;
            }

            let parsed: OllamaStreamChunk = serde_json::from_str(trimmed)
                .map_err(|e| format!("Failed to parse Ollama NDJSON frame: {e}"))?;

            if !parsed.response.is_empty() {
                let now = Instant::now();
                let dt = now.duration_since(last_token_instant).as_secs_f64();
                last_token_instant = now;
                token_index += 1;

                let quantum_metric = compute_quantum_metric(&parsed.response, dt, token_index);

                full_output.push_str(&parsed.response);

                window
                    .emit("token-received", &parsed.response)
                    .map_err(|e| format!("Failed to emit token-received event: {e}"))?;

                window
                    .emit("quantum-metric", quantum_metric)
                    .map_err(|e| format!("Failed to emit quantum-metric event: {e}"))?;
            }

            if parsed.done {
                let final_metric = match (parsed.eval_count, parsed.eval_duration) {
                    (Some(count), Some(duration_ns)) if duration_ns > 0 => {
                        let avg_tps = (count as f64) / (duration_ns as f64 / 1_000_000_000.0);
                        (avg_tps / 60.0).clamp(0.1, 2.5)
                    }
                    _ => 0.0,
                };
                let _ = window.emit("quantum-metric", final_metric);
                return Ok(full_output);
            }
        }
    }

    let remaining = line_buffer.trim();
    if !remaining.is_empty() {
        if let Ok(parsed) = serde_json::from_str::<OllamaStreamChunk>(remaining) {
            if !parsed.response.is_empty() {
                let dt = last_token_instant.elapsed().as_secs_f64();
                token_index += 1;
                let quantum_metric = compute_quantum_metric(&parsed.response, dt, token_index);
                full_output.push_str(&parsed.response);
                let _ = window.emit("token-received", &parsed.response);
                let _ = window.emit("quantum-metric", quantum_metric);
            }
        }
    }

    Ok(full_output)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![generate_calabi_yau_response])
        .run(tauri::generate_context!())
        .expect("error while running Calabi-Yau AI Platform Tauri application");
}
