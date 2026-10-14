# Calabi-Yau AI Platform (v0.3.0)

<img width="1376" height="768" alt="image" src="https://github.com/user-attachments/assets/6f60a260-703c-48b7-ad7d-91bcc959fbdf" />

A borderless, cyberpunk desktop overlay built with **Rust + Tauri**, **Three.js / WebGL**, a **Live WebGL Build Launcher & Native Machine Filesystem Harness (`~/CalabiYauProjects/`)**, and a **Universal Multi-Provider Quantum LLM Bridge** supporting **Ollama Cloud (`https://ollama.com/api/chat`)**, **17 additional Frontier Cloud AI Providers**, and **Ollama Local (`http://localhost:11434`)**.

It streams tokens in real time, separates model reasoning traces (`message.thinking`) into a collapsible drawer, extracts executable HTML/Three.js/GLSL code blocks so you can launch them in a live WebGL sandbox or save them directly to your machine, and translates instantaneous generation velocity ($\text{tokens/s}$) into higher-dimensional **Calabi-Yau quintic threefold** ($z_1^n + z_2^n = 1 \subset \mathbb{CP}^4$) string vibrations.

## Supported Providers & Newest 2026 Models

| Provider | Default Endpoint | Flagship 2026 Models Included |
| :--- | :--- | :--- |
| **Ollama Cloud** | `https://ollama.com/api/chat` | `deepseek-v4.1-flash`, `deepseek-v4-pro:0813`, `mistral-large-4`, `kimi-k3`, `kimi-k2.7-code`, `glm-5.3`, `glm-5.3-flash`, `qwen3.5:397b`, `gemma4:31b`, `minimax-m3`, `nemotron-3-ultra`, `gpt-oss:120b` (+ Live `/api/tags` Sync) |
| **Anthropic** | `https://api.anthropic.com/v1/messages` | `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`, `claude-fable-5-1`, `claude-opus-5`, `claude-sonnet-5` |
| **OpenAI** | `https://api.openai.com/v1/chat/completions` | `gpt-6-astra`, `gpt-6.1-sol`, `gpt-6-sol`, `gpt-6-luna`, `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.5-pro`, `gpt-5.3-codex` |
| **Google DeepMind** | `https://generativelanguage.googleapis.com/v1beta/...` | `gemini-4-argon`, `gemini-3.8-flash`, `gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-3.1-pro` |
| **xAI (Grok)** | `https://api.x.ai/v1/chat/completions` | `grok-4.7`, `grok-4.6`, `grok-4.5`, `grok-4.3-beta`, `grok-4.20` |
| **DeepSeek** | `https://api.deepseek.com/chat/completions` | `deepseek-v4.1-flash`, `deepseek-v4-pro-0813`, `deepseek-v4-pro`, `deepseek-reasoner` |
| **Meta AI** | `https://api.llama.com/compat/v1/chat/completions` | `muse-wonder-full`, `muse-wonder-1.0`, `muse-spark-1.3`, `llama-4-maverick-17b-128e`, `llama-4-scout-17b-16e` |
| **Mistral AI** | `https://api.mistral.ai/v1/chat/completions` | `mistral-large-4`, `mistral-large-3-675b`, `devstral-2-123b`, `codestral-latest` |
| **Alibaba Qwen** | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1/...` | `qwen-3.8-max`, `qwen-3.8-27b`, `qwen-3.7-max`, `qwen3.5-397b-a17b` |
| **Moonshot Kimi** | `https://api.moonshot.ai/v1/chat/completions` | `kimi-k3`, `kimi-k2.7-code`, `kimi-k2.6`, `kimi-k2.5` |
| **Z.ai / Zhipu** | `https://open.bigmodel.cn/api/paas/v4/chat/completions` | `glm-5.3`, `glm-5.3-flash`, `glm-5.2`, `glm-5.1` |
| **OpenRouter** | `https://openrouter.ai/api/v1/chat/completions` | Universal access to 300+ models (`anthropic/claude-opus-5.5`, `openai/gpt-6-astra`, `google/gemini-4-argon`, etc.) |
| **Groq LPU** | `https://api.groq.com/openai/v1/chat/completions` | `deepseek-v4.1-flash`, `llama-4-maverick-17b-128e-instruct`, `qwen-3.8-27b`, `gpt-oss-120b` |
| **Together AI** | `https://api.together.xyz/v1/chat/completions` | `deepseek-ai/DeepSeek-V4.1-Flash`, `moonshotai/Kimi-K3`, `Qwen/Qwen3.8-Max` |
| **Fireworks AI** | `https://api.fireworks.ai/inference/v1/chat/completions` | `accounts/fireworks/models/deepseek-v4p1-flash`, `kimi-k3`, `qwen3p8-max` |
| **Perplexity** | `https://api.perplexity.ai/chat/completions` | `sonar-deep-research`, `sonar-reasoning-pro`, `sonar-pro`, `sonar` |
| **Cerebras** | `https://api.cerebras.ai/v1/chat/completions` | `llama-4-maverick-17b-128e`, `deepseek-v4.1-flash`, `qwen-3.8-27b` |
| **NVIDIA NIM** | `https://integrate.api.nvidia.com/v1/chat/completions` | `nvidia/nemotron-3-ultra`, `nvidia/nemotron-3-super`, `nvidia/nemotron-3-nano-30b` |
| **Ollama Local** | `http://localhost:11434/api/chat` | `gemma4:31b`, `deepseek-v4.1-flash`, `qwen3.8:27b`, `glm-5.3-flash`, `llama4:scout`, `llama3` |

## Quick Start

```bash
# 1. (Optional) Export your Ollama Cloud or provider API key, or enter it directly in the UI's "API KEY // ENDPOINT" drawer:
export OLLAMA_API_KEY="your_ollama_cloud_api_key"

# 2. Install frontend dependencies
npm install

# 3. Launch the Tauri desktop application in development mode
npm run tauri dev
```
