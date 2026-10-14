# Calabi-Yau AI Platform

<img width="1376" height="768" alt="image" src="https://github.com/user-attachments/assets/6f60a260-703c-48b7-ad7d-91bcc959fbdf" />


A borderless, cyberpunk desktop overlay built with **Rust + Tauri**, **Three.js / WebGL**, and **Ollama**. It streams local LLM inference from `http://localhost:11434/api/generate` and translates real-time token generation velocity and byte entropy into higher-dimensional **Calabi-Yau quintic threefold** ($z_1^n + z_2^n = 1 \subset \mathbb{CP}^4$) string vibrations.

## Architecture Overview

1. **Tauri Rust Backend (`src-tauri/src/main.rs` & `src-tauri/Cargo.toml`)**
   - Exposes the asynchronous `generate_calabi_yau_response` Tauri command.
   - Streams NDJSON responses from local Ollama (`http://localhost:11434/api/generate`) using `reqwest` with the `stream` feature and `tokio`.
   - Computes an instantaneous quantum vibration frequency metric ($\omega \in [0.08, 5.0]\text{ THz}$) from inter-token latency ($\Delta t$), token character length, and byte-level spectral entropy.
   - Emits `token-received` and `quantum-metric` Tauri window events to the frontend in real time.

2. **Heterogeneous WebGL Interactive Canvas (`src/CalabiYauCanvas.js`)**
   - Constructs a 3D projection of the Fermat Calabi-Yau manifold cross-section $z_1^n + z_2^n = 1$ across $n^2$ Riemann sheets in $\mathbb{C}^2 \cong \mathbb{R}^4$ projected into $\mathbb{R}^3$ via Kähler phase angle $\xi$.
   - Renders a glowing, translucent holographic wireframe mesh using a custom `THREE.ShaderMaterial` with `THREE.AdditiveBlending`, Fresnel edge luminescence, and 4D phase-shifted spectral coloring.
   - Deforms vertex positions continuously using a 3D Simplex Noise engine (`SimplexNoise3D` on CPU buffer attributes + GLSL 3D Simplex Noise in the vertex shader).
   - Subscribes to `token-received` and `quantum-metric` events to spike vertex deformation amplitude and spectral saturation in sync with LLM inference.

3. **Borderless Cyberpunk Frontend (`index.html`, `src/style.css`, `src/main.js`)**
   - Custom borderless Tauri titlebar (`data-tauri-drag-region`) with window controls and layout toggles.
   - Live Quantum Telemetry HUD with harmonic sparkline, parametric sliders ($n$, $\xi$, mesh resolution), and streaming neural console.

## Quick Start

```bash
# 1. Start local Ollama server and pull llama3
ollama serve &
ollama pull llama3

# 2. Install frontend dependencies
npm install

# 3. Launch the Tauri desktop application in development mode
npm run tauri dev
```
