# Calabi-Yau AI Platform (v0.6.0)

<img width="1376" height="768" alt="image" src="https://github.com/user-attachments/assets/6f60a260-703c-48b7-ad7d-91bcc959fbdf" />

A borderless, cyberpunk desktop & scientific AI platform built with **Rust + Tauri**, **Three.js / WebGL**, an **Autonomous Multi-File Application Builder & Guarded PC Harness (`~/CalabiYauProjects/builds/`)**, a **2D–11D Higher-Dimensional Differential Geometry & Topology Engine**, a **Frontier AI Mathematical Witness Engine** (Persistent Homology, Fisher-Rao Information Geometry, Pancharatnam-Berry Holonomy, Symbolic Law Discovery, and Merkle Proof-Carrying Certificates), and a **Universal Multi-Provider Quantum LLM Bridge** supporting **Ollama Cloud (`https://ollama.com/api/chat`)**, **17 Frontier Cloud AI Providers**, and **Ollama Local (`http://localhost:11434`)**.

---

## v0.6.0: The Builder Actually Builds What You Ask For

**AUTONOMOUS BUILD & VERIFY** now sends your request to the selected provider/model (e.g. Ollama Cloud `glm-5.3`), which writes the entire project. The harness then checks it and loops back to the model with every failure (up to 3 repair passes):

1. **Static checks**: entry file present and complete, every `<script src>`/`<link href>`/relative `import` resolves to a real file, JS syntax, valid JSON, no elided `// ...` placeholders, and for Electron a valid `package.json` (`main`, `start`, `electron` devDependency).
2. **Browser runtime check**: the bundled app loads in a hidden sandboxed iframe; uncaught errors, rejected promises, `console.error`, and blank pages are reported back to the model.
3. **Toolchain check** (desktop app): files are written to `~/CalabiYauProjects/builds/<slug>/` and `npm test` runs; failing output goes back to the model.

**LAUNCH APP ▶** installs dependencies (`npm install`) and starts the project detached (`npm start` → Electron, `python app.py`, `node server.mjs`, or a static server), logging to `.calabi-run.log`. Commands now work on Windows (`npm`/`npx` `.cmd` shims) and `&&` chains run step by step without a shell.

Without a model/API key the builder falls back to the offline template scaffold and says so in the pipeline log.

## What Makes v0.5.0 Unique (Beyond Frontier Black-Box Interfaces)

### 1. Frontier Lab Witness Engine (`src/frontier/frontierLabEngine.js`)
While standard AI interfaces treat token generation as an opaque text stream, the Calabi-Yau AI Platform instruments every token trajectory as a dynamical system on a higher-dimensional Kähler/Riemannian manifold and computes publication-grade mathematical witnesses in real time:
- **Vietoris-Rips Persistent Homology ($H_0 \oplus H_1$)**: Computes exact simplicial filtration over the 4D trajectory point cloud, rendering a live **Persistence Barcode** ($H_0$ connected components in cyan, $H_1$ topological 1-cycles in magenta), **Persistence Entropy** ($H_{\text{pers}}$), and **Topological Integrity Score** to detect cyclic semantic loops and hallucination traps before repetition heuristics fire.
- **Information Geometry & Pancharatnam-Berry Holonomy**: Measures the exact **Fisher-Rao Riemannian Geodesic Distance** $d_{\text{FR}}(P, Q) = 2\arccos(\sum_i \sqrt{P_i Q_i})$ on the sheet probability simplex $\Delta^{n^2-1}$ and the complex **Pancharatnam-Berry Geometric Phase** $\gamma_{\text{Berry}} = -\operatorname{Im}\sum_t \ln \langle \psi_t \mid \psi_{t+1} \rangle$ accumulated across complex $\mathbb{C}^2$ spinor lifts.
- **Autonomous Symbolic Law & Noether Invariant Discovery**: Continuously evaluates candidate differential invariants coupling Shannon entropy $H$, Riemannian area element $\sqrt{\det g}$, Fubini-Study Kähler potential $K$, correlation dimension $D_2$, and Lyapunov divergence $\lambda_{\max}$ to surface the highest-invariance conservation law ($\mathcal{I}^\ast \approx \text{const}$).
- **Cross-Lab Wave-Function Consensus & Orthogonal Insight Tensor**: Synthesizes multi-provider runs (e.g., Anthropic + OpenAI + DeepSeek + Google + xAI) to quantify epistemic consensus and isolate the **Orthogonal Frontier Leader** (the model contributing the highest Fisher-Rao divergence from the ensemble centroid).
- **Cryptographic Proof-Carrying Artifact Certificates (`.calabi-proof.json`) & Witness Dossier**: Every built application is sealed with a deterministic **Merkle Tree Root**, per-file digests, anti-duplication novelty proof, self-healing verification report, and 11D topological witness snapshot. Click **WITNESS DOSSIER** in the titlebar or instrument HUD to launch or export a standalone interactive HTML verification dossier.

---

### 2. Autonomous Multi-File Application Builder & Guarded PC Harness (`src/builder/` + `src-tauri/src/guardrails.rs`)
The platform is a complete multi-file application builder that writes real, runnable projects directly into `~/CalabiYauProjects/builds/<project-slug>/`:
- **8 Full-Stack & Native Project Templates**:
  1. `electron-desktop` — **Electron Desktop App** (`package.json`, `main.cjs` with `BrowserWindow` + `ipcMain`, `preload.cjs` with `contextBridge`, `renderer.js`, `styles.css`, `index.html`, and `test.mjs`)
  2. `tauri-rust-app` — **Tauri + Rust Native Desktop App** (`src-tauri/Cargo.toml`, `src-tauri/src/main.rs`, `src-tauri/tauri.conf.json`, `src/index.html`, `verify-tauri.mjs`)
  3. `react-vite-app` — **Modern Web Application Suite** (modular ES modules, reactive store, domain engine, interactive UI, `test.mjs`)
  4. `fullstack-node-api` — **Full-Stack Node.js HTTP REST API + Interactive Client** (`server.mjs`, `public/index.html`, `test-api.mjs`)
  5. `python-science-cli` — **Python Scientific Computing & CLI Workbench** (`app.py` with `--self-test`, interactive HTML telemetry workbench)
  6. `dimensional-lab` — **4D–11D Higher-Dimensional Science & Hyperplane Slicer Lab** (`src/dimensionalMath.mjs`, `verify-geometry.mjs`, interactive 4D slicer UI)
  7. `webgl-shader-app` — **WebGL / Three.js GPU Shader & Raymarching Studio** (custom GLSL shaders + real-time uniform controls)
  8. `frontier-verify-lab` — **Frontier AI Topological Verification & Interpretability Station** (`src/frontierWitness.mjs`, `verify-witness.mjs`, interactive homology & Fisher-Rao station)
- **Anti-Duplication & Prompt-Specific Synthesis**: Fixes repetitive build behavior by hashing prompt intent, extracting domain-specific entities/metrics/actions, verifying Jaccard & FNV-1a novelty against prior builds, and ensuring every request for `X` produces a fresh, tailored application.
- **6-Stage Autonomous Build & Self-Healing Loop**:
  `Intent & Novelty Check` $\rightarrow$ `Template Architecture Selection` $\rightarrow$ `Structural & Static Self-Heal` $\rightarrow$ `Merkle Proof-Carrying Certificate (.calabi-proof.json)` $\rightarrow$ `Guarded Disk Write (~/CalabiYauProjects/builds/<slug>)` $\rightarrow$ `Guarded Toolchain Verification`.
- **Rust Security Guardrails (`src-tauri/src/guardrails.rs`)**: Enforces `WorkspaceGuarded`, `StrictSandbox`, and `DryRun` policies, blocking path traversal (`..`), system directories (`/etc`, `/usr`, `/bin`, `~/.ssh`), and destructive shell commands while permitting developer toolchain verification (`node`, `npm`, `npx`, `cargo`, `rustc`, `python3`, `pytest`, `git status`).

---

### 3. Higher-Dimensional Science & Topology Engine (2D $\rightarrow$ 11D, `src/dimensions/dimensionalEngine.js`)
Explore 11 mathematical spaces with real-time $SO(4)$ rotations, stereographic projections, **4D hyperplane cross-section slicing ($w_4 = c$)**, induced **Riemannian metric tensor $g_{ij}$**, **Fubini-Study Kähler potential $K$**, **Grassberger-Procaccia Correlation Dimension ($D_2$)**, and **Lyapunov exponent ($\lambda_{\max}$)**:
- **4D Regular Polychora**: Tesseract $\{4,3,3\}$ ($16V, 32E, 24F, 8C$) and self-dual 24-Cell $\{3,4,3\}$ ($24V, 96E, 96F, 24C$).
- **4D Fiber Bundles & Non-Orientable Immersions**: Hopf Fibration $S^1 \hookrightarrow S^3 \to S^2$ (linked Villarceau circles), Flat Clifford Torus $S^1 \times S^1 \subset S^3$ ($K \equiv 0$), and non-self-intersecting 4D Klein Bottle ($\mathbb{RP}^2 \# \mathbb{RP}^2 \subset \mathbb{R}^4$).
- **5D–11D Compactifications & Exceptional Lattices**: 5D Kaluza-Klein cylinder ($M^4 \times S^1_R$), 6D Fermat Calabi-Yau quintic ($\chi = -200, h^{1,1}=1, h^{2,1}=101$), 7D Joyce $G_2$-holonomy manifold ($b_2=12, b_3=43$), 8D Exceptional $E_8$ Root Lattice (**all 240 minimal roots** in $\mathbb{R}^8$ projected via orthogonal Coxeter eigenplanes), 10D Mirror Superstring target space ($\chi = +200$), and 11D Hořava-Witten M-Theory orbifold ($M^{1,3} \times \text{CY}_3 \times S^1/\mathbb{Z}_2$).

---

### 4. Hardware-Adaptive Graphics Profiler & Dynamic Auto-LOD (`src/graphics/hardwareProfile.js`)
Automatically inspects the WebGL `UNMASKED_RENDERER_WEBGL` string, screen dimensions, CPU concurrency, and rolling frame times (`AdaptiveFpsGovernor`) to scale rendering across desktop rigs, laptops, handhelds, and low-end systems:
- **ULTRA (`RTX 5060 Ti Desktop Rig`)**: `2.0x` supersampled DPR cap, MSAA antialiasing, `20×20` mesh resolution, dual wireframe + core Kähler surface shader passes, `950` quantum halo particles, and every-frame CPU+GPU simplex deformation (`120 FPS` target).
- **HIGH (`RTX 4060 Dell G15 Laptop`)**: Balanced `1.5x` DPR cap for laptop thermals, MSAA antialiasing, `16×16` mesh resolution, `520` halo particles, and `60 FPS` target.
- **HANDHELD (`Valve Steam Deck 1280×800 RDNA2 VanGogh APU`)**: Native `1.0x` DPR, `12×12` mesh resolution, `200` halo particles, half-rate CPU simplex updates (`cpuDeformStride = 2` with full-rate GPU shader interpolation), responsive `1280×800` HUD scaling, and disabled CSS `backdrop-filter: blur(...)` for smooth 60 FPS battery efficiency on SteamOS / Gamescope.
- **LOW-END (`Integrated APU / Eco Mode`)**: `0.85x` internal render scale, single-pass wireframe shader (`coreSurfaceEnabled = false`, cutting fragment overdraw in half), `10×10` mesh resolution, `80` halo particles, quarter-rate CPU deformation (`cpuDeformStride = 4`), and lightweight opaque HUD panels.
- **Dynamic Frame-Time Governor**: In `AUTO` mode, if sustained frame rate drops below 36 FPS over a 45-frame window, the engine automatically steps down one tier (`ultra` $\rightarrow$ `high` $\rightarrow$ `steam-deck` $\rightarrow$ `low`). You can also manually override the tier at any time via the **HARDWARE GRAPHICS (LOD)** selector in the bottom-left HUD.

---

## Spectral Inference Instrument

### 1. Spectral signature of the stream
Each token yields features: inter-token interval $\Delta t$, novelty, information density $I = \text{chars}\cdot(0.2 + 0.8\cdot\text{novelty})$, rolling character entropy $H$, word-3-gram repetition, structural-character density, and thinking-vs-content flag.

Two token-indexed channels, $\log\Delta t$ (timing) and $I$ (content), each pass through a 32-token Hann-windowed DFT and are split into $n$ bands $T_k, C_k$. The sheet energies are their joint mode distribution:

$$E_{k_1,k_2} = \hat T_{k_1}\,\hat C_{k_2},\qquad \textstyle\sum E = 1$$

### 2. Generation fingerprints and regime detection
A completed run is stored as a fingerprint: a 7×7 reference sheet spectrum, summary statistics, regime counts, Frontier Witness snapshot, and a 64-point reference trajectory. The distance between two runs is

$$d = 0.5\,d_{JS}(E_a, E_b) + 0.25\,d_{\text{stats}} + 0.25\,\min(1, d_{\text{Fréchet}}/2)$$

### 3. The 11-D instrument state
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

### Tests
```bash
npm test                                         # 26 tests: 2D-11D geometry, autonomous builder, Frontier Witness, spectral instrument
cargo test --manifest-path src-tauri/Cargo.toml  # 8 tests: Rust guardrails, path/command policies, stream parsing & sampling payloads
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
