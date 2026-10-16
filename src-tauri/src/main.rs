#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod nd_engine;
mod stream;

use base64::Engine;
use futures_util::StreamExt;
use nd_engine::{
    compute_nd_frame, encode_f32_buffer, step_particles_nd, GivensPlane, NdEngineHandle,
    NdFrameBuffer, MAX_DIM,
};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use stream::{
    build_payload_with_system, extract_token_from_json, parse_stream_line, InferenceDone,
    InferenceFrame, SamplingParams,
};
use std::env;
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::time::{Duration, Instant};
use tauri::Window;

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

fn emit_frame(
    window: &Window,
    run_id: &str,
    index: &mut u64,
    started: Instant,
    token: String,
    thinking: bool,
) -> Result<(), String> {
    let frame = InferenceFrame {
        run_id: run_id.to_string(),
        index: *index,
        token,
        thinking,
        t_ms: started.elapsed().as_secs_f64() * 1000.0,
    };
    *index += 1;
    window
        .emit("inference-frame", frame)
        .map_err(|e| format!("Failed to emit inference-frame event: {e}"))
}

/// Streams a completion from the selected provider, emitting one `inference-frame` per token
/// (scoped by `run_id` so several runs can stream concurrently) and a final `inference-done`.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
async fn ask_model(
    window: Window,
    prompt: String,
    provider: Option<String>,
    model: Option<String>,
    api_key: Option<String>,
    endpoint: Option<String>,
    run_id: Option<String>,
    sampling: Option<SamplingParams>,
    system_prompt: Option<String>,
) -> Result<String, String> {
    let run_id = run_id
        .filter(|r| !r.trim().is_empty())
        .unwrap_or_else(|| "default".to_string());
    let started = Instant::now();
    let result = stream_completion(
        &window,
        &run_id,
        started,
        prompt,
        provider,
        model,
        api_key,
        endpoint,
        sampling.unwrap_or_default(),
        system_prompt,
    )
    .await;

    let (tokens, error) = match &result {
        Ok((_, n)) => (*n, None),
        Err(e) => (0, Some(e.clone())),
    };
    let _ = window.emit(
        "inference-done",
        InferenceDone {
            run_id: run_id.clone(),
            tokens,
            t_ms: started.elapsed().as_secs_f64() * 1000.0,
            error,
        },
    );
    result.map(|(text, _)| text)
}

#[allow(clippy::too_many_arguments)]
async fn stream_completion(
    window: &Window,
    run_id: &str,
    started: Instant,
    prompt: String,
    provider: Option<String>,
    model: Option<String>,
    api_key: Option<String>,
    endpoint: Option<String>,
    sampling: SamplingParams,
    system_prompt: Option<String>,
) -> Result<(String, u64), String> {
    let provider_id = provider
        .as_deref()
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "ollama-cloud".to_string());

    let selected_model = model
        .as_deref()
        .map(|m| m.trim())
        .filter(|m| !m.is_empty())
        .unwrap_or("deepseek-v4.1-flash")
        .to_string();

    let resolved_key = resolve_api_key(&provider_id, api_key);

    let api_url = endpoint
        .as_deref()
        .map(|u| u.trim())
        .filter(|u| !u.is_empty())
        .map(|u| u.to_string())
        .unwrap_or_else(|| default_endpoint_for_provider(&provider_id, &selected_model));

    let client = Client::builder()
        .no_proxy()
        .build()
        .map_err(|e| format!("Failed to initialize HTTP client: {e}"))?;

    let mut req = client.post(&api_url);
    match provider_id.as_str() {
        "anthropic" => {
            let key = resolved_key.ok_or_else(|| {
                "Anthropic API key required (set in UI or ANTHROPIC_API_KEY)".to_string()
            })?;
            req = req
                .header("x-api-key", key)
                .header("anthropic-version", "2023-06-01");
        }
        "google" | "gemini" => {
            let key = resolved_key.ok_or_else(|| {
                "Google Gemini API key required (set in UI or GEMINI_API_KEY)".to_string()
            })?;
            req = req.header("x-goog-api-key", key);
        }
        _ => {
            if let Some(ref key) = resolved_key {
                req = req.bearer_auth(key);
            }
            if provider_id == "openrouter" {
                req = req
                    .header("HTTP-Referer", "https://github.com/AaronGrace978/Calabi-Yau-manifold")
                    .header("X-Title", "Calabi-Yau Lab");
            }
        }
    }

    let payload = build_payload_with_system(
        &provider_id,
        &selected_model,
        &prompt,
        system_prompt.as_deref(),
        &api_url,
        sampling,
    );

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
    let mut index: u64 = 0;

    loop {
        let chunk = byte_stream.next().await;
        let at_end = chunk.is_none();
        if let Some(chunk_result) = chunk {
            let bytes = chunk_result.map_err(|e| format!("Stream read error: {e}"))?;
            line_buffer.push_str(&String::from_utf8_lossy(&bytes));
        } else if !line_buffer.ends_with('\n') {
            line_buffer.push('\n');
        }

        while let Some(newline_pos) = line_buffer.find('\n') {
            let raw_line: String = line_buffer.drain(..=newline_pos).collect();
            let parsed = match parse_stream_line(&raw_line) {
                None => continue,
                Some(Err(())) => return Ok((full_output, index)),
                Some(Ok(v)) => v,
            };

            let (token_piece, is_thinking, is_done) = extract_token_from_json(&parsed);
            if !token_piece.is_empty() {
                if !is_thinking {
                    full_output.push_str(&token_piece);
                }
                emit_frame(window, run_id, &mut index, started, token_piece, is_thinking)?;
            }
            if is_done {
                return Ok((full_output, index));
            }
        }

        if at_end {
            return Ok((full_output, index));
        }
    }
}
/// Writes a PNG data URL from the viewer to `~/Pictures/CalabiYauLab` (or `~/CalabiYauLab`).
#[tauri::command]
async fn save_snapshot(name: String, data_url: String) -> Result<String, String> {
    let encoded = data_url
        .strip_prefix("data:image/png;base64,")
        .ok_or_else(|| "Snapshot is not a PNG data URL".to_string())?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .map_err(|e| format!("Invalid snapshot data: {e}"))?;

    let home = env::var("HOME")
        .or_else(|_| env::var("USERPROFILE"))
        .map(PathBuf::from)
        .map_err(|_| "Could not find your home directory".to_string())?;
    let pictures = home.join("Pictures");
    let dir = if pictures.is_dir() {
        pictures.join("CalabiYauLab")
    } else {
        home.join("CalabiYauLab")
    };
    fs::create_dir_all(&dir).map_err(|e| format!("Could not create {}: {e}", dir.display()))?;

    let safe: String = name
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.' { c } else { '-' })
        .collect();
    let file = if safe.ends_with(".png") { safe } else { format!("{safe}.png") };
    let path = dir.join(file);
    fs::write(&path, bytes).map_err(|e| format!("Could not write {}: {e}", path.display()))?;
    Ok(path.display().to_string())
}

// ---------------------------------------------------------------------------
// High-Performance N-Dimensional Matrix & Slicing Command Channel
// ---------------------------------------------------------------------------

#[tauri::command]
fn sync_nd_geometry(
    engine: tauri::State<'_, NdEngineHandle>,
    dim: usize,
    points: Vec<Vec<f64>>,
    polygons: Vec<Vec<usize>>,
    hue: Option<Vec<f64>>,
    edge_count: Option<usize>,
) -> Result<usize, String> {
    let clamped_dim = dim.clamp(2, MAX_DIM);
    let mut fixed_points = Vec::with_capacity(points.len());
    for pt in points {
        let mut arr = [0.0; MAX_DIM];
        for (k, &v) in pt.iter().take(clamped_dim).enumerate() {
            arr[k] = v;
        }
        fixed_points.push(arr);
    }
    let count = fixed_points.len();
    let mut guard = engine
        .state
        .write()
        .map_err(|_| "Failed to acquire write lock on N-D engine".to_string())?;
    guard.dim = clamped_dim;
    guard.points = fixed_points;
    guard.polygons = polygons;
    guard.hue = hue;
    guard.edge_count = edge_count.unwrap_or(count);
    Ok(count)
}

#[tauri::command]
fn mutate_nd_frame(
    engine: tauri::State<'_, NdEngineHandle>,
    planes: Vec<GivensPlane>,
    projection: String,
    slice_enabled: bool,
    slice_level: f64,
    slice_only: bool,
    dt: f64,
) -> Result<NdFrameBuffer, String> {
    let mut guard = engine
        .state
        .write()
        .map_err(|_| "Failed to acquire write lock on N-D engine".to_string())?;
    Ok(compute_nd_frame(
        &mut guard,
        &planes,
        &projection,
        slice_enabled,
        slice_level,
        slice_only,
        dt,
    ))
}

#[tauri::command]
fn step_hyperspace_particles(
    engine: tauri::State<'_, NdEngineHandle>,
    count: usize,
    dt: f64,
) -> Result<String, String> {
    let mut guard = engine
        .state
        .write()
        .map_err(|_| "Failed to acquire write lock on N-D engine".to_string())?;
    let buf = step_particles_nd(&mut guard, count, dt);
    Ok(encode_f32_buffer(&buf))
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
async fn start_nd_stream(
    window: Window,
    engine: tauri::State<'_, NdEngineHandle>,
    planes: Vec<GivensPlane>,
    spin_speed: f64,
    projection: String,
    slice_enabled: bool,
    slice_level: f64,
    slice_only: bool,
    fps: Option<u32>,
) -> Result<u64, String> {
    let gen = engine.stream_generation.fetch_add(1, Ordering::SeqCst) + 1;
    engine.streaming.store(true, Ordering::SeqCst);

    let state = engine.state.clone();
    let streaming = engine.streaming.clone();
    let gen_ref = engine.stream_generation.clone();
    let target_fps = fps.unwrap_or(60).clamp(15, 120);
    let frame_dur = Duration::from_secs_f64(1.0 / (target_fps as f64));
    let dt = frame_dur.as_secs_f64();

    tokio::spawn(async move {
        let mut phase = 0.0_f64;
        while streaming.load(Ordering::SeqCst) && gen_ref.load(Ordering::SeqCst) == gen {
            phase += dt * spin_speed;
            let frame_opt = {
                if let Ok(mut guard) = state.write() {
                    let dim = guard.dim;
                    let mut active_planes = planes.clone();
                    if spin_speed.abs() > 1e-5 && dim >= 4 {
                        active_planes.push(GivensPlane {
                            i: 0,
                            j: 3,
                            angle: phase,
                        });
                        active_planes.push(GivensPlane {
                            i: 2,
                            j: 3,
                            angle: phase * 0.618,
                        });
                        for k in 4..dim {
                            active_planes.push(GivensPlane {
                                i: k % 3,
                                j: k,
                                angle: phase * (0.5 + 0.13 * (k as f64)),
                            });
                        }
                    }
                    Some(compute_nd_frame(
                        &mut guard,
                        &active_planes,
                        &projection,
                        slice_enabled,
                        slice_level,
                        slice_only,
                        dt,
                    ))
                } else {
                    None
                }
            };

            if let Some(frame) = frame_opt {
                if window.emit("nd-frame-buffer", frame).is_err() {
                    break;
                }
            }
            tokio::time::sleep(frame_dur).await;
        }
    });

    Ok(gen)
}

#[tauri::command]
fn stop_nd_stream(engine: tauri::State<'_, NdEngineHandle>) -> Result<(), String> {
    engine.streaming.store(false, Ordering::SeqCst);
    engine.stream_generation.fetch_add(1, Ordering::SeqCst);
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .manage(NdEngineHandle::default())
        .invoke_handler(tauri::generate_handler![
            ask_model,
            fetch_provider_models,
            save_snapshot,
            sync_nd_geometry,
            mutate_nd_frame,
            step_hyperspace_particles,
            start_nd_stream,
            stop_nd_stream
        ])
        .run(tauri::generate_context!())
        .expect("error while running Calabi-Yau Lab");
}
