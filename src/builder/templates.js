/**
 * Multi-File Application Templates for the Calabi-Yau Autonomous Application Builder.
 *
 * Every template produces a complete, runnable multi-file project inside
 * `~/CalabiYauProjects/builds/<project-slug>/` that is dynamically customized
 * to the user's exact prompt, domain, entities, and actions.
 */

export const PROJECT_TEMPLATES = [
  {
    id: 'electron-desktop',
    label: 'Electron Desktop App (IPC + Native Window + Preload)',
    shortLabel: 'ELECTRON DESKTOP',
    entryFile: 'index.html',
    defaultVerifyCommand: 'node test.mjs',
    defaultRunCommand: 'npx electron .',
    keywords: ['electron', 'desktop', 'native window', 'ipc', 'tray', 'menubar', 'desktop app'],
    description:
      'Complete Electron desktop application with main.cjs, contextBridge preload.cjs, renderer.js, styles.css, index.html, package.json, and automated verification suite.',
  },
  {
    id: 'tauri-rust-app',
    label: 'Tauri + Rust Native Desktop App',
    shortLabel: 'TAURI + RUST',
    entryFile: 'src/index.html',
    defaultVerifyCommand: 'node verify-tauri.mjs',
    defaultRunCommand: 'cargo tauri dev',
    keywords: ['tauri', 'rust', 'cargo', 'native rust', 'rust desktop'],
    description:
      'Tauri + Rust desktop application with Cargo.toml, src-tauri/src/main.rs #[tauri::command] handlers, tauri.conf.json, and interactive frontend.',
  },
  {
    id: 'react-vite-app',
    label: 'Modern Web Application (Modular ES Modules + State)',
    shortLabel: 'WEB APP SUITE',
    entryFile: 'index.html',
    defaultVerifyCommand: 'node test.mjs',
    defaultRunCommand: 'npx vite',
    keywords: [
      'react',
      'vite',
      'dashboard',
      'tracker',
      'kanban',
      'crm',
      'studio',
      'planner',
      'editor',
      'calculator',
      'manager',
      'synth',
      'game',
      'web app',
    ],
    description:
      'Multi-file modular web application with reactive store, domain engine, interactive UI components, CSS design system, and automated Node test suite.',
  },
  {
    id: 'fullstack-node-api',
    label: 'Full-Stack Node.js HTTP API + Interactive Client',
    shortLabel: 'NODE FULL-STACK API',
    entryFile: 'public/index.html',
    defaultVerifyCommand: 'node test-api.mjs',
    defaultRunCommand: 'node server.mjs',
    keywords: ['api', 'rest', 'backend', 'server', 'express', 'node', 'database', 'microservice', 'webhook', 'endpoint'],
    description:
      'Zero-dependency Node.js HTTP/REST API server (server.mjs), domain service layer, interactive REST Explorer frontend (public/index.html), and self-testing suite.',
  },
  {
    id: 'python-science-cli',
    label: 'Python Scientific Computing & Interactive Workbench',
    shortLabel: 'PYTHON SCIENCE LAB',
    entryFile: 'index.html',
    defaultVerifyCommand: 'python3 app.py --self-test',
    defaultRunCommand: 'python3 app.py',
    keywords: ['python', 'scipy', 'numpy', 'simulation', 'cli', 'data science', 'ml', 'neural', 'physics'],
    description:
      'Python scientific computing script (app.py) with `--self-test` verification, paired with an interactive HTML/Canvas telemetry workbench.',
  },
  {
    id: 'dimensional-lab',
    label: 'Higher-Dimensional Science & Topology Lab (4D–11D)',
    shortLabel: '4D–11D SCIENCE LAB',
    entryFile: 'index.html',
    defaultVerifyCommand: 'node verify-geometry.mjs',
    defaultRunCommand: 'node verify-geometry.mjs',
    keywords: [
      'dimension',
      '4d',
      '5d',
      '6d',
      '7d',
      '8d',
      '10d',
      '11d',
      'tesseract',
      'hypercube',
      'hopf',
      'klein',
      'kaluza',
      'e8',
      'g2',
      'manifold',
      'topology',
      'polytope',
      'slicer',
    ],
    description:
      'Interactive 4D–11D scientific geometry & hyperplane cross-section laboratory with exact topological invariants, SO(N) rotation rotors, and metric tensor inspector.',
  },
  {
    id: 'webgl-shader-app',
    label: 'WebGL / Three.js GPU Shader & Raymarching Studio',
    shortLabel: 'WEBGL GPU SHADER',
    entryFile: 'index.html',
    defaultVerifyCommand: 'node verify-shader.mjs',
    defaultRunCommand: 'node verify-shader.mjs',
    keywords: ['shader', 'glsl', 'webgl', 'three.js', 'raymarch', 'fractal', 'particle', 'visualizer', '3d'],
    description:
      'Hardware-accelerated WebGL / Three.js application with custom GLSL vertex/fragment shaders, real-time uniform controls, and live telemetry.',
  },
  {
    id: 'frontier-verify-lab',
    label: 'Frontier AI Topological Verification & Interpretability Station',
    shortLabel: 'FRONTIER AI WITNESS LAB',
    entryFile: 'index.html',
    defaultVerifyCommand: 'node verify-witness.mjs',
    defaultRunCommand: 'node verify-witness.mjs',
    keywords: [
      'frontier',
      'witness',
      'homology',
      'berry',
      'fisher-rao',
      'interpretability',
      'hallucination',
      'merkle',
      'proof',
      'verification',
      'consensus',
    ],
    description:
      'Frontier AI mathematical verification station computing Vietoris-Rips persistent homology (H₀/H₁), Fisher-Rao information geometry, Pancharatnam-Berry phase holonomy, and Merkle proof-carrying certificates.',
  },
];

/**
 * Selects the best project template for a user prompt, or respects an explicit override.
 */
export function selectTemplateForPrompt(prompt = '', explicitTemplateId = 'auto') {
  if (explicitTemplateId && explicitTemplateId !== 'auto') {
    const found = PROJECT_TEMPLATES.find((t) => t.id === explicitTemplateId);
    if (found) return found;
  }

  const lower = String(prompt || '').toLowerCase();

  // Check explicit high-priority matches first
  if (/\belectron\b|\bdesktop app\b|\bpreload\b|\bcontextbridge\b|\bipcmain\b/.test(lower)) {
    return PROJECT_TEMPLATES.find((t) => t.id === 'electron-desktop');
  }
  if (/\btauri\b|\bcargo\b|\brust desktop\b/.test(lower)) {
    return PROJECT_TEMPLATES.find((t) => t.id === 'tauri-rust-app');
  }
  if (/\bpython\b|\bpytest\b|\bcli tool\b/.test(lower)) {
    return PROJECT_TEMPLATES.find((t) => t.id === 'python-science-cli');
  }
  if (
    /\b4d\b|\b5d\b|\b7d\b|\b8d\b|\b11d\b|\btesseract\b|\b24-cell\b|\bhopff?\b|\bklein bottle\b|\bkaluza\b|\be8 lattice\b|\bg2 holonomy\b|\bhyperplane\b|\bpolychor/.test(
      lower
    )
  ) {
    return PROJECT_TEMPLATES.find((t) => t.id === 'dimensional-lab');
  }
  if (/\brest api\b|\bbackend\b|\bhttp server\b|\bexpress\b|\bfull-?stack\b|\bmicroservice\b/.test(lower)) {
    return PROJECT_TEMPLATES.find((t) => t.id === 'fullstack-node-api');
  }
  if (/\bshader\b|\bglsl\b|\braymarch\b|\bthree\.?js\b|\bwebgl\b/.test(lower)) {
    return PROJECT_TEMPLATES.find((t) => t.id === 'webgl-shader-app');
  }
  if (
    /\bfrontier\b|\bwitness\b|\bpersistent homology\b|\bberry phase\b|\bfisher-rao\b|\binterpretability\b|\bhallucination\b|\bmerkle proof\b/.test(
      lower
    )
  ) {
    return PROJECT_TEMPLATES.find((t) => t.id === 'frontier-verify-lab');
  }

  // Score by keyword hits
  let best = PROJECT_TEMPLATES.find((t) => t.id === 'react-vite-app');
  let bestScore = 0;
  for (const tpl of PROJECT_TEMPLATES) {
    let score = 0;
    for (const kw of tpl.keywords) {
      if (lower.includes(kw)) score += kw.length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = tpl;
    }
  }
  return best;
}
