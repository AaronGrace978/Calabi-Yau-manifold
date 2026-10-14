# Calabi-Yau AI Platform (v0.4.0)

<img width="1376" height="768" alt="image" src="https://github.com/user-attachments/assets/6f60a260-703c-48b7-ad7d-91bcc959fbdf" />

A borderless, cyberpunk desktop overlay built with **Rust + Tauri**, **Three.js / WebGL**, a **Live WebGL Build Launcher & Native Machine Filesystem Harness (`~/CalabiYauProjects/`)**, and a **Universal Multi-Provider Quantum LLM Bridge** supporting **Ollama Cloud (`https://ollama.com/api/chat`)**, **17 additional Frontier Cloud AI Providers**, and **Ollama Local (`http://localhost:11434`)**.

It streams tokens in real time, separates model reasoning traces (`message.thinking`) into a collapsible drawer, extracts executable HTML/Three.js/GLSL code blocks so you can launch them in a live WebGL sandbox or save them directly to your machine, and runs every stream through a **spectral inference instrument**: a defined, invertible mapping from the live token stream onto the $n^2$ sheets of the Fermat surface $z_1^n + z_2^n = 1$.

## Spectral Inference Instrument (v0.4.0)

The surface is driven by measured stream analysis (`src/instrument/`, pure JS, unit-tested), not by a heuristic pulse.

### 1. Spectral signature of the stream
Each token yields features: inter-token interval $\Delta t$, novelty (the fraction of its character trigrams not seen in the last 600 characters), information density $I = \text{chars}\cdot(0.2 + 0.8\cdot\text{novelty})$, rolling character entropy $H$, word-3-gram repetition, structural-character density, and thinking-vs-content flag.

Two token-indexed channels, $\log\Delta t$ (timing) and $I$ (content), each pass through a 32-token Hann-windowed DFT and are split into $n$ bands $T_k, C_k$. The sheet energies are their joint mode distribution:

$$E_{k_1,k_2} = \hat T_{k_1}\,\hat C_{k_2},\qquad \textstyle\sum E = 1$$

so the $n^2$ sheets of a degree-$n$ Fermat surface hold exactly the outer product of two $n$-band spectra. Row $k_1$ is the timing rhythm mode; column $k_2$ is the information-density mode. Per-sheet energy scales displacement and glow on both the GPU shader and the CPU simplex deformation.

### 2. Generation fingerprints and regime detection
A completed run is stored as a fingerprint: a 7×7 reference sheet spectrum, summary statistics (TTFT, median $\Delta t$, tokens/s, entropy, repetition, thinking ratio, spectral centroids and flatness), regime counts, and a 64-point reference trajectory. The distance between two runs is

$$d = 0.5\,d_{JS}(E_a, E_b) + 0.25\,d_{\text{stats}} + 0.25\,\min(1, d_{\text{Fréchet}}/2)$$

Regime detection flags repetition loops, mode collapse, tool/JSON storms, throughput bursts, stalls, reasoning→answer phase changes, and spectral regime shifts (L1 drift of the sheet distribution from its long-run average), with hysteresis.

### 3. Trajectory geometry
Each token is lifted onto the same complex-power construction the renderer uses. The parameter $a$ comes from entropy plus a hashed trigram projection, $b$ comes from the timing z-score, and the sheet $(k_1,k_2)$ is the dominant timing × content mode. The path is drawn on the surface and measured in $\mathbb{R}^4$: arc length, mean turning angle, winding number of $\arg z_1$, and sheet transitions.

### 4. Control surface (the inverse map)
Click a sheet in the heatmap to set a target.
- **Content axis** maps to sampling: $T = 0.2 + c^{\ast} + \text{bias}$ and $\text{top\_p} = 0.75 + 0.25\,c^{\ast}$, where $c^{\ast} = k_2/(n-1)$. In **closed-loop** mode the bias integrates $c^{\ast} - c_C^{\text{measured}}$ after each real run (simulated runs hold the integrator).
- **Repetition / mode collapse** raises the repetition penalty for the next request; each clean run halves it.
- **Timing axis and target amplitude** are properties of the serving stack, so they are actuated by **routing**: auto-route selects the provider/model whose stored fingerprints sit closest to the target.

Sampling parameters are applied per request; HTTP streaming APIs do not accept parameter changes mid-stream.

### 5. Multi-model interference
**SWARM LANES** streams one prompt to up to six provider/model lanes in parallel. The Rust bridge emits run-scoped `inference-frame` events with Rust-side arrival timestamps. Lanes are superposed on the shared sheets, weighted by live information rate and colored per lane. The panel reports power shares, pairwise Bhattacharyya overlap, coherence, and takeover events.

### 6. The 11-D instrument state
| # | Dim | Definition |
|---|-----|------------|
| 1–3 | $x, y, z$ | trajectory head on the projected surface |
| 4 | $\xi$ | $\mathbb{C}^2 \to \mathbb{R}^3$ projection phase |
| 5 | $\sigma$ | active sheet $k_1 n + k_2$ |
| 6 | $A$ | $0.05 + 0.6\tanh(I_{\text{rate}}/80)$ |
| 7 | $f$ | $0.9 + 3\,c_T$ (timing spectral centroid) |
| 8 | $S$ | rolling entropy / 5 bits |
| 9 | $c_T$ | timing spectral centroid |
| 10 | $c_C$ | content spectral centroid |
| 11 | $\varphi_C$ | content spectral flatness (Wiener entropy) |

Use **COPY STATE JSON** to export the live vector with its run fingerprint.

### Tests
```bash
npm test                                         # spectral, trajectory, regime, fingerprint, interference, control
cargo test --manifest-path src-tauri/Cargo.toml  # stream parsing + per-provider sampling payloads
```

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
