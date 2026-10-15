#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod guardrails;
mod stream;

use futures_util::StreamExt;
use guardrails::{
    evaluate_command_policy, sanitize_project_slug, sanitize_relative_project_path, split_command_chain,
    validate_pc_path, GuardrailMode, PolicyVerdict,
};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use stream::{
    build_payload_with_system, extract_token_from_json, parse_stream_line, InferenceDone,
    InferenceFrame, SamplingParams,
};
use std::env;
use std::fs;
use std::path::PathBuf;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Window, WindowBuilder, WindowUrl};
use tokio::process::Command;

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

/// Resolves the local machine directory where generated Calabi-Yau projects/artifacts are saved.
/// Uses `~/CalabiYauProjects` (or `./CalabiYauProjects` fallback) and creates it if needed.
fn resolve_projects_directory() -> Result<PathBuf, String> {
    let base = env::var("HOME")
        .or_else(|_| env::var("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_else(|_| env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));

    let projects_dir = base.join("CalabiYauProjects");
    fs::create_dir_all(&projects_dir)
        .map_err(|e| format!("Failed to create projects directory {:?}: {e}", projects_dir))?;
    Ok(projects_dir)
}

/// Resolves the dedicated multi-file builds directory `~/CalabiYauProjects/builds`.
fn resolve_builds_directory() -> Result<PathBuf, String> {
    let projects_dir = resolve_projects_directory()?;
    let builds_dir = projects_dir.join("builds");
    fs::create_dir_all(&builds_dir)
        .map_err(|e| format!("Failed to create builds directory {:?}: {e}", builds_dir))?;
    Ok(builds_dir)
}

fn sanitize_filename(name: &str, default_ext: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.' {
                c
            } else {
                '-'
            }
        })
        .collect();
    let trimmed = cleaned.trim_matches('-');
    let base = if trimmed.is_empty() {
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        format!("calabi-yau-artifact-{ts}")
    } else {
        trimmed.to_string()
    };

    if base.contains('.') {
        base
    } else {
        format!("{base}.{default_ext}")
    }
}

#[derive(Serialize, Deserialize, Debug)]
struct SavedArtifactInfo {
    filename: String,
    path: String,
    bytes: usize,
    directory: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct BuildProjectFile {
    path: String,
    content: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct BuildProjectRecord {
    slug: String,
    title: String,
    template: String,
    prompt: String,
    created_at_ms: u128,
    directory: String,
    entry_file: String,
    file_count: usize,
    total_bytes: usize,
    files: Vec<BuildProjectFile>,
    guardrail: PolicyVerdict,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct MachineWorkspaceInfo {
    os: String,
    arch: String,
    projects_dir: String,
    builds_dir: String,
    home_dir: String,
    available_toolchains: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct PcDirectoryEntry {
    name: String,
    path: String,
    is_dir: bool,
    size_bytes: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct PcDirectoryListing {
    directory: String,
    entries: Vec<PcDirectoryEntry>,
    guardrail: PolicyVerdict,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct GuardedCommandResult {
    command: String,
    cwd: String,
    exit_code: i32,
    stdout: String,
    stderr: String,
    duration_ms: u128,
    guardrail: PolicyVerdict,
}

/// Returns information about the local machine workspace (`~/CalabiYauProjects/builds`) and available toolchains.
#[tauri::command]
async fn get_machine_workspace_info() -> Result<MachineWorkspaceInfo, String> {
    let projects_dir = resolve_projects_directory()?;
    let builds_dir = resolve_builds_directory()?;
    let home_dir = env::var("HOME")
        .or_else(|_| env::var("USERPROFILE"))
        .unwrap_or_else(|_| projects_dir.to_string_lossy().to_string());

    let mut toolchains = Vec::new();
    for bin in ["node", "npm", "npx", "cargo", "rustc", "python3", "git"] {
        if let Ok(output) = Command::new(bin).arg("--version").output().await {
            if output.status.success() {
                let ver = String::from_utf8_lossy(&output.stdout)
                    .lines()
                    .next()
                    .unwrap_or("")
                    .trim()
                    .to_string();
                toolchains.push(format!("{bin} ({ver})"));
            }
        }
    }

    Ok(MachineWorkspaceInfo {
        os: env::consts::OS.to_string(),
        arch: env::consts::ARCH.to_string(),
        projects_dir: projects_dir.to_string_lossy().to_string(),
        builds_dir: builds_dir.to_string_lossy().to_string(),
        home_dir,
        available_toolchains: toolchains,
    })
}

/// Writes a full multi-file application build into `~/CalabiYauProjects/builds/<slug>/`
/// with strict path guardrails and a `calabi-build-manifest.json` descriptor.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
async fn write_build_project(
    slug: String,
    title: String,
    template: String,
    prompt: String,
    entry_file: Option<String>,
    files: Vec<BuildProjectFile>,
    guardrail_mode: Option<String>,
) -> Result<BuildProjectRecord, String> {
    let mode = GuardrailMode::from_str_opt(guardrail_mode.as_deref());
    let builds_dir = resolve_builds_directory()?;
    let safe_slug = sanitize_project_slug(&slug);
    let project_dir = builds_dir.join(&safe_slug);

    let verdict = validate_pc_path(&project_dir, &builds_dir, mode, true);
    if !verdict.allowed {
        return Err(verdict.reason);
    }

    if mode != GuardrailMode::DryRun {
        fs::create_dir_all(&project_dir)
            .map_err(|e| format!("Failed to create project build folder {:?}: {e}", project_dir))?;
    }

    let mut sanitized_files = Vec::new();
    let mut total_bytes = 0usize;

    for file in files {
        let rel = sanitize_relative_project_path(&file.path)?;
        let full_path = project_dir.join(&rel);
        if mode != GuardrailMode::DryRun {
            if let Some(parent) = full_path.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create subdirectory {:?}: {e}", parent))?;
            }
            fs::write(&full_path, file.content.as_bytes())
                .map_err(|e| format!("Failed to write file {:?}: {e}", full_path))?;
        }
        total_bytes += file.content.len();
        sanitized_files.push(BuildProjectFile {
            path: rel.to_string_lossy().replace('\\', "/"),
            content: file.content,
        });
    }

    let created_at_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);

    let resolved_entry = entry_file
        .filter(|e| !e.trim().is_empty())
        .unwrap_or_else(|| {
            sanitized_files
                .first()
                .map(|f| f.path.clone())
                .unwrap_or_else(|| "index.html".to_string())
        });

    let manifest = json!({
        "slug": safe_slug,
        "title": title,
        "template": template,
        "prompt": prompt,
        "createdAtMs": created_at_ms,
        "entryFile": resolved_entry,
        "fileCount": sanitized_files.len(),
        "totalBytes": total_bytes,
        "files": sanitized_files.iter().map(|f| &f.path).collect::<Vec<_>>(),
    });

    if mode != GuardrailMode::DryRun {
        let manifest_path = project_dir.join("calabi-build-manifest.json");
        let _ = fs::write(
            &manifest_path,
            serde_json::to_string_pretty(&manifest).unwrap_or_default(),
        );
    }

    Ok(BuildProjectRecord {
        slug: safe_slug,
        title,
        template,
        prompt,
        created_at_ms,
        directory: project_dir.to_string_lossy().to_string(),
        entry_file: resolved_entry,
        file_count: sanitized_files.len(),
        total_bytes,
        files: sanitized_files,
        guardrail: verdict,
    })
}

/// Lists all multi-file projects inside `~/CalabiYauProjects/builds/`.
#[tauri::command]
async fn list_build_projects() -> Result<Vec<BuildProjectRecord>, String> {
    let builds_dir = resolve_builds_directory()?;
    let mut records = Vec::new();

    if let Ok(entries) = fs::read_dir(&builds_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let slug = path
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("build")
                .to_string();
            let manifest_path = path.join("calabi-build-manifest.json");
            let mut title = slug.clone();
            let mut template = "multi-file-app".to_string();
            let mut prompt = String::new();
            let mut created_at_ms = 0u128;
            let mut entry_file = "index.html".to_string();

            if let Ok(raw) = fs::read_to_string(&manifest_path) {
                if let Ok(val) = serde_json::from_str::<Value>(&raw) {
                    if let Some(t) = val.get("title").and_then(|v| v.as_str()) {
                        title = t.to_string();
                    }
                    if let Some(tp) = val.get("template").and_then(|v| v.as_str()) {
                        template = tp.to_string();
                    }
                    if let Some(p) = val.get("prompt").and_then(|v| v.as_str()) {
                        prompt = p.to_string();
                    }
                    if let Some(c) = val.get("createdAtMs").and_then(|v| v.as_u64()) {
                        created_at_ms = c as u128;
                    }
                    if let Some(ef) = val.get("entryFile").and_then(|v| v.as_str()) {
                        entry_file = ef.to_string();
                    }
                }
            }

            let mut files = Vec::new();
            let mut total_bytes = 0usize;
            collect_project_files(&path, &path, &mut files, &mut total_bytes);

            records.push(BuildProjectRecord {
                slug,
                title,
                template,
                prompt,
                created_at_ms,
                directory: path.to_string_lossy().to_string(),
                entry_file,
                file_count: files.len(),
                total_bytes,
                files,
                guardrail: PolicyVerdict {
                    allowed: true,
                    mode: GuardrailMode::WorkspaceGuarded,
                    reason: "Verified build workspace".to_string(),
                    sanitized_target: path.to_string_lossy().to_string(),
                },
            });
        }
    }

    records.sort_by(|a, b| b.created_at_ms.cmp(&a.created_at_ms));
    Ok(records)
}

fn collect_project_files(
    root: &PathBuf,
    current: &PathBuf,
    out: &mut Vec<BuildProjectFile>,
    total_bytes: &mut usize,
) {
    if let Ok(entries) = fs::read_dir(current) {
        for entry in entries.flatten() {
            let p = entry.path();
            let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if name == "node_modules" || name == "target" || name == ".git" || name == "dist" {
                continue;
            }
            if p.is_dir() {
                collect_project_files(root, &p, out, total_bytes);
            } else if p.is_file() {
                if let Ok(rel) = p.strip_prefix(root) {
                    if let Ok(content) = fs::read_to_string(&p) {
                        *total_bytes += content.len();
                        out.push(BuildProjectFile {
                            path: rel.to_string_lossy().replace('\\', "/"),
                            content,
                        });
                    }
                }
            }
        }
    }
}

/// Inspects a directory on the user's PC under the active guardrail policy.
#[tauri::command]
async fn inspect_pc_directory(
    directory_path: Option<String>,
    guardrail_mode: Option<String>,
) -> Result<PcDirectoryListing, String> {
    let mode = GuardrailMode::from_str_opt(guardrail_mode.as_deref());
    let builds_dir = resolve_builds_directory()?;
    let target = match directory_path.filter(|s| !s.trim().is_empty()) {
        Some(raw) => PathBuf::from(raw),
        None => builds_dir.clone(),
    };

    let verdict = validate_pc_path(&target, &builds_dir, mode, false);
    if !verdict.allowed {
        return Err(verdict.reason);
    }

    let mut entries = Vec::new();
    let read_dir = fs::read_dir(&target)
        .map_err(|e| format!("Failed to read directory {:?}: {e}", target))?;

    for entry in read_dir.flatten() {
        let p = entry.path();
        let meta = entry.metadata().ok();
        let is_dir = meta.as_ref().map(|m| m.is_dir()).unwrap_or(false);
        let size_bytes = meta.as_ref().map(|m| m.len()).unwrap_or(0);
        let name = p
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        entries.push(PcDirectoryEntry {
            name,
            path: p.to_string_lossy().to_string(),
            is_dir,
            size_bytes,
        });
    }

    entries.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then_with(|| a.name.cmp(&b.name)));

    Ok(PcDirectoryListing {
        directory: target.to_string_lossy().to_string(),
        entries,
        guardrail: verdict,
    })
}

/// Reads a UTF-8 text file from the user's PC under the active guardrail policy.
#[tauri::command]
async fn read_pc_file(
    file_path: String,
    guardrail_mode: Option<String>,
) -> Result<BuildProjectFile, String> {
    let mode = GuardrailMode::from_str_opt(guardrail_mode.as_deref());
    let builds_dir = resolve_builds_directory()?;
    let target = PathBuf::from(&file_path);

    let verdict = validate_pc_path(&target, &builds_dir, mode, false);
    if !verdict.allowed {
        return Err(verdict.reason);
    }

    let content = fs::read_to_string(&target)
        .map_err(|e| format!("Failed to read file {:?}: {e}", target))?;

    Ok(BuildProjectFile {
        path: verdict.sanitized_target,
        content,
    })
}

/// Writes a UTF-8 text file to the user's PC under the active guardrail policy.
#[tauri::command]
async fn write_pc_file(
    file_path: String,
    content: String,
    guardrail_mode: Option<String>,
) -> Result<PolicyVerdict, String> {
    let mode = GuardrailMode::from_str_opt(guardrail_mode.as_deref());
    let builds_dir = resolve_builds_directory()?;
    let target = PathBuf::from(&file_path);

    let verdict = validate_pc_path(&target, &builds_dir, mode, true);
    if !verdict.allowed {
        return Err(verdict.reason);
    }

    if mode != GuardrailMode::DryRun {
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directory {:?}: {e}", parent))?;
        }
        fs::write(&target, content.as_bytes())
            .map_err(|e| format!("Failed to write file {:?}: {e}", target))?;
    }

    Ok(verdict)
}

fn is_install_command(argv: &[String]) -> bool {
    let bin = argv[0].to_lowercase();
    let sub = argv.get(1).map(|s| s.to_lowercase()).unwrap_or_default();
    matches!(bin.as_str(), "npm" | "pnpm" | "yarn" | "bun" | "pip" | "pip3" | "uv" | "cargo")
        && matches!(sub.as_str(), "install" | "i" | "ci" | "add" | "build" | "sync")
}

/// Builds a process for a toolchain argv. On Windows, `npm`/`npx`/etc. are `.cmd` shims that
/// `CreateProcess` cannot start directly, so they are routed through `cmd /C` (the policy has
/// already rejected every cmd metacharacter).
fn toolchain_command(argv: &[String]) -> Command {
    #[cfg(target_os = "windows")]
    {
        let mut cmd = Command::new("cmd");
        cmd.arg("/C").args(argv);
        cmd
    }
    #[cfg(not(target_os = "windows"))]
    {
        let mut cmd = Command::new(&argv[0]);
        cmd.args(&argv[1..]);
        cmd
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LaunchResult {
    command: String,
    cwd: String,
    pid: Option<u32>,
    log_file: String,
    installed_dependencies: bool,
}

/// Installs dependencies if needed, then starts a long-running app (Electron, dev server, etc.)
/// detached from the harness, logging its output to `<project>/.calabi-run.log`.
#[tauri::command]
async fn launch_build_project(
    slug: String,
    command: Option<String>,
    guardrail_mode: Option<String>,
) -> Result<LaunchResult, String> {
    let mode = GuardrailMode::from_str_opt(guardrail_mode.as_deref());
    let builds_dir = resolve_builds_directory()?;
    let project_dir = builds_dir.join(sanitize_project_slug(&slug));
    if !project_dir.is_dir() {
        return Err(format!("Project directory {:?} does not exist; save the build first", project_dir));
    }

    let pkg_path = project_dir.join("package.json");
    let pkg: Option<Value> = fs::read_to_string(&pkg_path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok());
    let run_command = command.filter(|c| !c.trim().is_empty()).unwrap_or_else(|| {
        if pkg.as_ref().and_then(|p| p["scripts"]["start"].as_str()).is_some() {
            "npm start".to_string()
        } else if project_dir.join("app.py").exists() {
            "python app.py".to_string()
        } else if project_dir.join("server.mjs").exists() {
            "node server.mjs".to_string()
        } else {
            "npx --yes serve .".to_string()
        }
    });

    let verdict = evaluate_command_policy(&run_command, mode);
    if !verdict.allowed {
        return Err(verdict.reason);
    }
    if mode == GuardrailMode::DryRun {
        return Err("Dry-run guardrail mode does not launch processes".to_string());
    }

    let has_deps = pkg.as_ref().is_some_and(|p| {
        p["dependencies"].as_object().is_some_and(|o| !o.is_empty())
            || p["devDependencies"].as_object().is_some_and(|o| !o.is_empty())
    });
    let mut installed_dependencies = false;
    if has_deps && !project_dir.join("node_modules").exists() {
        let argv = vec!["npm".to_string(), "install".to_string(), "--no-audit".to_string(), "--no-fund".to_string()];
        let output = tokio::time::timeout(
            Duration::from_secs(900),
            toolchain_command(&argv).current_dir(&project_dir).output(),
        )
        .await
        .map_err(|_| "npm install timed out after 900s".to_string())?
        .map_err(|e| format!("Failed to run npm install (is Node.js installed and on PATH?): {e}"))?;
        if !output.status.success() {
            return Err(format!(
                "npm install failed:\n{}{}",
                String::from_utf8_lossy(&output.stdout),
                String::from_utf8_lossy(&output.stderr)
            ));
        }
        installed_dependencies = true;
    }

    let log_path = project_dir.join(".calabi-run.log");
    let log = fs::File::create(&log_path).map_err(|e| format!("Cannot create run log: {e}"))?;
    let log_err = log.try_clone().map_err(|e| format!("Cannot create run log: {e}"))?;

    let chain = split_command_chain(&run_command);
    let (last, setup) = chain.split_last().ok_or_else(|| "Command is empty".to_string())?;
    for argv in setup {
        let status = toolchain_command(argv)
            .current_dir(&project_dir)
            .status()
            .await
            .map_err(|e| format!("Failed to spawn '{}': {e}", argv[0]))?;
        if !status.success() {
            return Err(format!("'{}' exited with {status}", argv.join(" ")));
        }
    }

    let mut std_cmd = std::process::Command::new(if cfg!(target_os = "windows") { "cmd" } else { &last[0] });
    if cfg!(target_os = "windows") {
        std_cmd.arg("/C").args(last);
    } else {
        std_cmd.args(&last[1..]);
    }
    let child = std_cmd
        .current_dir(&project_dir)
        .stdin(std::process::Stdio::null())
        .stdout(log)
        .stderr(log_err)
        .spawn()
        .map_err(|e| format!("Failed to launch '{run_command}': {e}"))?;

    Ok(LaunchResult {
        command: run_command,
        cwd: project_dir.to_string_lossy().to_string(),
        pid: Some(child.id()),
        log_file: log_path.to_string_lossy().to_string(),
        installed_dependencies,
    })
}

/// Returns the tail of a launched project's run log.
#[tauri::command]
async fn read_launch_log(slug: String) -> Result<String, String> {
    let builds_dir = resolve_builds_directory()?;
    let path = builds_dir.join(sanitize_project_slug(&slug)).join(".calabi-run.log");
    let text = fs::read_to_string(&path).unwrap_or_default();
    let start = text.len().saturating_sub(8000);
    let start = (start..text.len()).find(|i| text.is_char_boundary(*i)).unwrap_or(text.len());
    Ok(text[start..].to_string())
}

/// Executes a developer toolchain command inside a build directory after passing guardrail verification.
#[tauri::command]
async fn execute_guarded_command(
    command: String,
    cwd: Option<String>,
    guardrail_mode: Option<String>,
) -> Result<GuardedCommandResult, String> {
    let mode = GuardrailMode::from_str_opt(guardrail_mode.as_deref());
    let builds_dir = resolve_builds_directory()?;
    let working_dir = match cwd.filter(|s| !s.trim().is_empty()) {
        Some(raw) => {
            let candidate = PathBuf::from(&raw);
            if candidate.is_absolute() {
                candidate
            } else {
                builds_dir.join(sanitize_project_slug(&raw))
            }
        }
        None => builds_dir.clone(),
    };

    let dir_verdict = validate_pc_path(&working_dir, &builds_dir, mode, false);
    if !dir_verdict.allowed {
        return Err(dir_verdict.reason);
    }

    let cmd_verdict = evaluate_command_policy(&command, mode);
    if !cmd_verdict.allowed {
        return Err(cmd_verdict.reason);
    }

    if mode == GuardrailMode::DryRun {
        return Ok(GuardedCommandResult {
            command,
            cwd: working_dir.to_string_lossy().to_string(),
            exit_code: 0,
            stdout: "[DRY-RUN] Command passed guardrail policy; execution skipped in dry-run mode."
                .to_string(),
            stderr: String::new(),
            duration_ms: 0,
            guardrail: cmd_verdict,
        });
    }

    fs::create_dir_all(&working_dir)
        .map_err(|e| format!("Failed to ensure working directory {:?}: {e}", working_dir))?;

    let started = Instant::now();
    let chain = split_command_chain(&command);
    if chain.is_empty() {
        return Err("Command is empty".to_string());
    }

    let mut exit_code = 0;
    let mut stdout = String::new();
    let mut stderr = String::new();
    for argv in &chain {
        let timeout_secs = if is_install_command(argv) { 600 } else { 180 };
        let child_future = toolchain_command(argv).current_dir(&working_dir).output();
        let output = tokio::time::timeout(Duration::from_secs(timeout_secs), child_future)
            .await
            .map_err(|_| format!("Command timed out after {timeout_secs}s: {}", argv.join(" ")))?
            .map_err(|e| format!("Failed to spawn '{}': {e}", argv[0]))?;
        exit_code = output.status.code().unwrap_or(-1);
        stdout.push_str(&String::from_utf8_lossy(&output.stdout));
        stderr.push_str(&String::from_utf8_lossy(&output.stderr));
        if exit_code != 0 {
            break;
        }
    }

    Ok(GuardedCommandResult {
        command,
        cwd: working_dir.to_string_lossy().to_string(),
        exit_code,
        stdout,
        stderr,
        duration_ms: started.elapsed().as_millis(),
        guardrail: cmd_verdict,
    })
}

/// Native machine harness: saves any LLM-generated HTML/GLSL/JS/Rust code block or full project
/// directly to `~/CalabiYauProjects/<filename>` on the user's machine.
#[tauri::command]
async fn save_artifact_to_disk(
    filename: String,
    content: String,
    extension: Option<String>,
) -> Result<SavedArtifactInfo, String> {
    let projects_dir = resolve_projects_directory()?;
    let ext = extension.as_deref().unwrap_or("html");
    let safe_name = sanitize_filename(&filename, ext);
    let full_path = projects_dir.join(&safe_name);

    fs::write(&full_path, content.as_bytes())
        .map_err(|e| format!("Failed to write artifact to {:?}: {e}", full_path))?;

    Ok(SavedArtifactInfo {
        filename: safe_name,
        path: full_path.to_string_lossy().to_string(),
        bytes: content.len(),
        directory: projects_dir.to_string_lossy().to_string(),
    })
}

/// Lists all saved projects/artifacts inside `~/CalabiYauProjects`.
#[tauri::command]
async fn list_saved_artifacts() -> Result<Vec<SavedArtifactInfo>, String> {
    let projects_dir = resolve_projects_directory()?;
    let dir_str = projects_dir.to_string_lossy().to_string();
    let mut items = Vec::new();

    if let Ok(entries) = fs::read_dir(&projects_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                let bytes = entry.metadata().map(|m| m.len() as usize).unwrap_or(0);
                let filename = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("artifact.html")
                    .to_string();
                items.push(SavedArtifactInfo {
                    filename,
                    path: path.to_string_lossy().to_string(),
                    bytes,
                    directory: dir_str.clone(),
                });
            }
        }
    }

    items.sort_by(|a, b| b.filename.cmp(&a.filename));
    Ok(items)
}

/// Native Build Launcher: saves the generated WebGL/Three.js artifact to disk AND spawns
/// a dedicated hardware-accelerated Tauri window executing the live shader/project.
#[tauri::command]
async fn launch_artifact_window(
    app: AppHandle,
    title: String,
    html_content: String,
    filename: Option<String>,
) -> Result<SavedArtifactInfo, String> {
    let desired_name = filename.unwrap_or_else(|| "calabi-yau-live-build.html".to_string());
    let saved = save_artifact_to_disk(desired_name, html_content.clone(), Some("html".to_string())).await?;

    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(1);
    let label = format!("cy-launcher-{ts}");

    let data_url = format!(
        "data:text/html;charset=utf-8,{}",
        urlencoding_encode(&html_content)
    );

    if let Ok(parsed_url) = data_url.parse() {
        let _ = WindowBuilder::new(&app, label, WindowUrl::External(parsed_url))
            .title(format!("Calabi-Yau Build Launcher // {title} ({})", saved.filename))
            .inner_size(1180.0, 820.0)
            .resizable(true)
            .build();
    }

    Ok(saved)
}

fn urlencoding_encode(input: &str) -> String {
    let mut out = String::with_capacity(input.len() * 2);
    for b in input.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            _ => {
                out.push_str(&format!("%{:02X}", b));
            }
        }
    }
    out
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
async fn generate_calabi_yau_response(
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

static CANCELLED_RUNS: std::sync::Mutex<Vec<String>> = std::sync::Mutex::new(Vec::new());

fn take_cancellation(run_id: &str) -> bool {
    let mut runs = CANCELLED_RUNS.lock().unwrap_or_else(|e| e.into_inner());
    match runs.iter().position(|r| r == run_id) {
        Some(i) => {
            runs.swap_remove(i);
            true
        }
        None => false,
    }
}

/// Stops an in-flight `generate_calabi_yau_response`; it resolves with the text streamed so far.
#[tauri::command]
fn cancel_generation(run_id: String) {
    let mut runs = CANCELLED_RUNS.lock().unwrap_or_else(|e| e.into_inner());
    if !runs.contains(&run_id) {
        runs.push(run_id);
    }
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
                    .header("X-Title", "Calabi-Yau AI Platform");
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
        if take_cancellation(run_id) {
            return Ok((full_output, index));
        }
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

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            generate_calabi_yau_response,
            fetch_provider_models,
            save_artifact_to_disk,
            list_saved_artifacts,
            launch_artifact_window,
            get_machine_workspace_info,
            write_build_project,
            list_build_projects,
            inspect_pc_directory,
            read_pc_file,
            write_pc_file,
            execute_guarded_command,
            launch_build_project,
            read_launch_log,
            cancel_generation
        ])
        .run(tauri::generate_context!())
        .expect("error while running Calabi-Yau AI Platform Tauri application");
}
