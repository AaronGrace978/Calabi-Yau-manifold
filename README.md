# Calabi-Yau Lab (v0.8.0)

**See and hear what higher dimensions look like.** A desktop lab (Rust + Tauri, Three.js, Web Audio) for turning, slicing and projecting real objects from 2 to 11 dimensions, then playing those invariants as a polyphonic synthesizer. Field notes explain what you are looking at, and an optional AI guide can switch the view or play a resonance preset.

Every object is generated from its definition and every number on screen is computed or checked by the test suite. Nothing is decorative.

## The spaces

| Group | Object | What it shows |
| --- | --- | --- |
| Calabi-Yau | Fermat curve z₁ⁿ + z₂ⁿ = 1 | The classic picture of a Calabi-Yau slice (Hanson). Degree 2–7, n² patches, genus (n−1)(n−2)/2. |
| Dimension ladder | Hypercube, simplex, cross-polytope | Each family from 2D to 11D. Counted vertices, edges and 2-faces against the f-vector, plus the Euler-Poincaré sum. |
| 4D polytopes | 24-cell, 600-cell | Exact vertices, edges and triangles (24/96/96 and 120/720/1200), V − E + F − C = 0. |
| Surfaces in 4D | Clifford torus, Hopf fibration, Klein bottle | A flat torus on S³, linked Hopf circles (linking number checked numerically), a Klein bottle with no self-intersection. |
| Beyond 4D | E₈ root system | All 240 roots. The Coxeter plane is computed from the Coxeter element, giving the Petrie projection of 8 rings of 30. |
| Beyond 4D | Compact extra dimension | Kaluza-Klein "garden hose": shrink the circle and watch it disappear while the first masses grow as 1/R. |

## How to look at them

- **4D rotation**: x↔w, y↔w and z↔w turn the object through the hidden axis, so it morphs rather than just spinning.
- **Spin through hidden axes**: continuous rotation through every extra axis, up to 11D.
- **Projection**: perspective (a camera in each extra axis), orthographic (drop the extra axes) or stereographic (4D sphere to 3D, keeps circles round).
- **Cross-section**: an exact slice where the hidden coordinate equals your slider, like Flatland watching a sphere pass through. "Show only the slice" draws it on its own.
- **Colour** encodes the hidden coordinate, so you can read depth in the extra dimension.
- **Snapshot** saves a PNG (desktop: `~/Pictures/CalabiYauLab`).
- **Synesthesia synth**: vertex count sets the fundamental pitch, hidden-axis depth sets eight overtones, and moving the slice slider sweeps a low-pass filter. Presets follow the manifold (E₈ symphony, Calabi-Yau sweep, Clifford torus loop, and others).
- Each space has a link: `#hypercube-n`, `#600-cell`, `#e8`, …

## Ask about this

The right panel can stream an answer from any provider in the catalog (Ollama Cloud, Ollama Local, Anthropic, OpenAI, Google, xAI, DeepSeek, OpenRouter, Groq and others). The model is told which object is on screen, its computed facts, and the live synthesizer state. It can reply with `SHOW: <id>` to switch the view, or `PLAY_RESONANCE: { preset: 'string_harmonics', dimension: N }` to play a harmonic preset. Keys are entered in the panel or read from the provider's usual environment variable (`OLLAMA_API_KEY`, `ANTHROPIC_API_KEY`, …).

## Develop

```bash
npm install
npm run dev          # browser at http://localhost:1420
npm run tauri dev    # desktop app
npm test             # geometry and ask tests
cargo test --manifest-path src-tauri/Cargo.toml
```

Code layout:

- `src/lab/geometry.js`: N-D polytopes, surfaces, Hopf fibers, E₈ Coxeter plane, rotations, projections, slicing, and the sonification feature matrix
- `src/lab/catalog.js`: the spaces, their controls, notes and facts
- `src/lab/viewer.js`: WebGL renderer
- `src/lab/audio.js`: polyphonic Web Audio synthesizer
- `src/lab/ask.js`: the Ask panel
- `src-tauri/src`: model streaming, model listing, snapshot saving, and the 11D matrix/slice engine

## Releases

Pushing a `v*` tag builds installers for Windows (`.msi`, `.exe`), macOS (Apple Silicon and Intel `.dmg`) and Linux (`.AppImage`, `.deb`).

## History

Up to v0.6.2 this project also contained an app builder, a guarded command runner and a token "spectral instrument". Those were removed in v0.7.0 to refocus on geometry and discovery. v0.8.0 adds the Synesthesia Engine: geometric features drive audio, and Rust can take over N-dimensional frame math when the viewer drops below 60 fps.
