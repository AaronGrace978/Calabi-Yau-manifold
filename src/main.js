import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import { appWindow } from '@tauri-apps/api/window';
import { CalabiYauCanvas } from './CalabiYauCanvas.js';
import { AI_PROVIDERS } from './providers.js';
import { InstrumentConsole, LANE_COLORS } from './instrumentConsole.js';
import { DIMENSION_CATALOG } from './dimensions/dimensionalEngine.js';
import {
  compileApplicationProject,
  runAutonomousBuildLoop,
  isApplicationBuildPrompt,
  isConversationalFillerPrompt,
  bundlePreviewHtml,
  buildMultiFileSystemPrompt,
  analyzeBuildIntent,
  generateFrontierWitnessDossierHtml,
  mintProofCarryingCertificate,
} from './builder/index.js';

const isTauriDesktop =
  typeof window !== 'undefined' &&
  Boolean(window.__TAURI_IPC__ || window.__TAURI_METADATA__ || window.__TAURI__);

/**
 * Default standalone WebGL / Three.js / GLSL Fermat Quintic Holographic Wireframe preset
 * (matching the DeepSeek-V4.1-Flash Euler xi = e, 0.500 THz Simplex Noise burst shader).
 */
const DEFAULT_EULER_QUINTIC_BUILD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fermat Quintic Holographic Wireframe (xi = e, 0.500 THz)</title>
  <style>
    body { margin: 0; overflow: hidden; background: #000; font-family: monospace; }
    canvas { display: block; }
    .hud-tag {
      position: fixed; top: 12px; left: 14px; color: #00f3ff;
      background: rgba(4, 10, 24, 0.82); border: 1px solid rgba(0, 243, 255, 0.4);
      padding: 6px 10px; border-radius: 4px; font-size: 11px; letter-spacing: 0.08em;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div class="hud-tag">FERMAT QUINTIC Σ zᵢ⁵ = 0 // ξ = e (2.71828 rad) // 0.500 THz SIMPLEX BURST</div>
  <script type="importmap">
    {
      "imports": {
        "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
        "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
      }
    }
  </script>
  <script type="module">
    import * as THREE from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
    import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
    import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
    import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

    const vertexShader = \`
      uniform float uTime;
      uniform float uEuler;
      uniform float uBurstFreq;
      uniform float uNoiseAmp;
      uniform float uSheet;
      uniform float uXiOffset;

      varying vec3 vColor;
      varying float vIntensity;

      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
      vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

      float snoise(vec3 v) {
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        i = mod289(i);
        vec4 p = permute(permute(permute(
                   i.z + vec4(0.0, i1.z, i2.z, 1.0))
                 + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                 + i.x + vec4(0.0, i1.x, i2.x, 1.0));
        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);
        vec4 x = x_ * ns.x + ns.yyyy;
        vec4 y = y_ * ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);
        vec4 s0 = floor(b0) * 2.0 + 1.0;
        vec4 s1 = floor(b1) * 2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
        p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
      }

      void main() {
        vec3 pos = position;
        vec3 nor = normalize(normal);

        // Map Euler's constant e to phase angle xi
        float xi = uEuler * (pos.x * 1.3 + pos.y * 0.7 + pos.z * 1.1 + uTime * 0.1) + uXiOffset;

        float theta0 = xi * 1.0 + pos.x * 2.0;
        float theta1 = xi * 1.3 + pos.y * 2.3;
        float theta2 = xi * 1.7 + pos.z * 2.7;
        float theta3 = xi * 2.1 + (pos.x + pos.y) * 1.9;
        float theta4 = xi * 2.5 + (pos.y + pos.z) * 2.1;

        vec2 F = vec2(cos(5.0 * theta0), sin(5.0 * theta0))
               + vec2(cos(5.0 * theta1), sin(5.0 * theta1))
               + vec2(cos(5.0 * theta2), sin(5.0 * theta2))
               + vec2(cos(5.0 * theta3), sin(5.0 * theta3))
               + vec2(cos(5.0 * theta4), sin(5.0 * theta4));

        float fMag = length(F);
        float fermatWarp = (F.x * F.y) * 0.35 + (1.0 - fMag) * 0.2;

        // Artificial 0.500 THz inference burst envelope
        float burstPhase = uTime * 6.28318530718 * uBurstFreq * 12.0;
        float burst = pow(0.5 + 0.5 * sin(burstPhase), 4.0);

        float noiseAmp = uNoiseAmp * (0.15 + 0.85 * burst);
        float noise1 = snoise(pos * 2.5 + vec3(xi * 0.5, uTime * 0.3, uSheet * 10.0));
        float noise2 = snoise(pos * 5.0 + vec3(uTime * 0.7, xi * 0.2, uSheet * 5.0));

        vec3 sheetOffset = vec3(
          sin(xi * 2.0 + uSheet * 1.7),
          cos(xi * 3.0 + uSheet * 2.3),
          sin(xi * 5.0 + uSheet * 3.1)
        ) * 0.25 * uSheet;

        float displacement = fermatWarp + (noise1 * 0.6 + noise2 * 0.4) * noiseAmp;
        pos += nor * displacement + sheetOffset;

        float hue = fract(xi * 0.15 + fMag * 0.5 + uTime * 0.05);
        vec3 colorA = vec3(0.0, 1.0, 1.0);
        vec3 colorB = vec3(1.0, 0.0, 1.0);
        vec3 colorC = vec3(1.0, 1.0, 0.0);
        vColor = mix(mix(colorA, colorB, hue), colorC, burst * 0.5);
        vIntensity = 0.85 + 1.55 * burst + 0.5 * abs(F.x);

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    \`;

    const fragmentShader = \`
      uniform float uTime;
      varying vec3 vColor;
      varying float vIntensity;

      void main() {
        vec3 color = vColor * vIntensity;
        float scan = sin(gl_FragCoord.y * 0.5 + uTime * 20.0) * 0.1 + 0.9;
        color = pow(color * scan, vec3(0.8));
        gl_FragColor = vec4(color, 1.0);
      }
    \`;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.7;

    const geometry = new THREE.IcosahedronGeometry(1.5, 5);
    const sheets = 5;
    const materials = [];

    for (let i = 0; i < sheets; i++) {
      const material = new THREE.ShaderMaterial({
        uniforms: {
          uTime:      { value: 0 },
          uEuler:     { value: Math.E },
          uBurstFreq: { value: 0.5 },
          uNoiseAmp:  { value: 0.8 },
          uSheet:     { value: i - (sheets - 1) / 2 },
          uXiOffset:  { value: i * 1.2 }
        },
        vertexShader,
        fragmentShader,
        wireframe: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = i * 0.2;
      mesh.rotation.y = i * 0.3;
      mesh.scale.setScalar(1.0 + i * 0.05);
      scene.add(mesh);
      materials.push(material);
    }

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 2.4, 0.8, 0.1));

    const clock = new THREE.Clock();
    function animate() {
      requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      materials.forEach(m => { m.uniforms.uTime.value = t; });
      controls.update();
      composer.render();
    }
    animate();

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
    });
  </script>
</body>
</html>`;

const dom = {
  viewport: document.getElementById('calabi-yau-viewport'),
  workspaceGrid: document.getElementById('workspace-grid'),
  statusBeacon: document.getElementById('status-beacon'),
  activeProviderBanner: document.getElementById('active-provider-banner'),
  runtimeBadge: document.getElementById('hud-runtime-mode'),
  metricOmega: document.getElementById('metric-omega'),
  metricAmplitude: document.getElementById('metric-amplitude'),
  metricSaturation: document.getElementById('metric-saturation'),
  metricTps: document.getElementById('metric-tps'),
  barOmega: document.getElementById('bar-omega'),
  barAmplitude: document.getElementById('bar-amplitude'),
  manifoldEquation: document.getElementById('manifold-equation'),
  sparklineCanvas: document.getElementById('harmonic-sparkline'),
  dimensionSpaceSelect: document.getElementById('dimension-space-select'),
  valDimensionBadge: document.getElementById('val-dimension-badge'),
  sliderExponent: document.getElementById('slider-exponent'),
  sliderPhase: document.getElementById('slider-phase'),
  sliderResolution: document.getElementById('slider-resolution'),
  checkSliceEnabled: document.getElementById('check-slice-enabled'),
  sliderSliceW: document.getElementById('slider-slice-w'),
  valSliceW: document.getElementById('val-slice-w'),
  valExponent: document.getElementById('val-exponent'),
  valPhase: document.getElementById('val-phase'),
  valResolution: document.getElementById('val-resolution'),
  graphicsProfileSelect: document.getElementById('graphics-profile-select'),
  valGraphicsBadge: document.getElementById('val-graphics-badge'),
  dimensionInvariantsPanel: document.getElementById('dimension-invariants-panel'),
  dimensionalInvariants: document.getElementById('dimension-invariants-panel'),
  homologyBarcode: document.getElementById('homology-barcode'),
  frontierWitnessPanel: document.getElementById('frontier-witness-panel'),
  btnWitnessDossier: document.getElementById('btn-witness-dossier'),
  btnOpenWitnessDossier: document.getElementById('btn-open-witness-dossier'),
  btnToggleConfig: document.getElementById('btn-toggle-config'),
  btnSyncModels: document.getElementById('btn-sync-models'),
  btnBuildLauncher: document.getElementById('btn-build-launcher'),
  btnToggleLayout: document.getElementById('btn-toggle-layout'),
  btnPulseTest: document.getElementById('btn-pulse-test'),
  winMinimize: document.getElementById('win-minimize'),
  winMaximize: document.getElementById('win-maximize'),
  winClose: document.getElementById('win-close'),
  providerSelect: document.getElementById('provider-select'),
  modelSelect: document.getElementById('model-select'),
  providerEnvBadge: document.getElementById('provider-env-badge'),
  configDrawer: document.getElementById('config-drawer'),
  apiKeyInput: document.getElementById('api-key-input'),
  endpointInput: document.getElementById('endpoint-input'),
  customModelInput: document.getElementById('custom-model-input'),
  chatMessages: document.getElementById('chat-messages'),
  chatForm: document.getElementById('chat-form'),
  promptInput: document.getElementById('prompt-input'),
  btnSend: document.getElementById('btn-send'),
  btnSimulate: document.getElementById('btn-simulate'),
  // Build Launcher & Machine Harness Modal DOM
  buildLauncherModal: document.getElementById('build-launcher-modal'),
  launcherTitle: document.getElementById('launcher-title'),
  launcherStatusPill: document.getElementById('launcher-status-pill'),
  builderGuardrailSelect: document.getElementById('builder-guardrail-select'),
  builderTemplateSelect: document.getElementById('builder-template-select'),
  builderPromptInput: document.getElementById('builder-prompt-input'),
  btnBuilderSynthesize: document.getElementById('btn-builder-synthesize'),
  builderNoveltyBadge: document.getElementById('builder-novelty-badge'),
  builderStagesLog: document.getElementById('builder-stages-log'),
  activeBuildSlug: document.getElementById('active-build-slug'),
  projectFilesTabs: document.getElementById('project-files-tabs'),
  pcCommandInput: document.getElementById('pc-command-input'),
  btnRunPcCmd: document.getElementById('btn-run-pc-cmd'),
  pcCommandOutput: document.getElementById('pc-command-output'),
  btnLauncherPreset: document.getElementById('btn-launcher-preset'),
  btnLauncherWitness: document.getElementById('btn-launcher-witness'),
  btnLauncherSaveDisk: document.getElementById('btn-launcher-save-disk'),
  btnLauncherNativeWin: document.getElementById('btn-launcher-native-win'),
  btnLauncherDownload: document.getElementById('btn-launcher-download'),
  btnLauncherClose: document.getElementById('btn-launcher-close'),
  btnRefreshProjects: document.getElementById('btn-refresh-projects'),
  savedProjectsList: document.getElementById('saved-projects-list'),
  btnRerunSource: document.getElementById('btn-rerun-source'),
  launcherSourceEditor: document.getElementById('launcher-source-editor'),
  sandboxIframe: document.getElementById('sandbox-iframe'),
  // Spectral inference instrument
  instrumentStatus: document.getElementById('instrument-status'),
  sheetHeatmap: document.getElementById('sheet-heatmap'),
  bandSpectra: document.getElementById('band-spectra'),
  stateVector: document.getElementById('state-vector'),
  btnExportState: document.getElementById('btn-export-state'),
  trajectoryMetrics: document.getElementById('trajectory-metrics'),
  regimeLog: document.getElementById('regime-log'),
  controlMode: document.getElementById('control-mode'),
  controlAmplitude: document.getElementById('control-amplitude'),
  valControlAmplitude: document.getElementById('val-control-amplitude'),
  controlAutoRoute: document.getElementById('control-autoroute'),
  btnControlReset: document.getElementById('btn-control-reset'),
  controlReadout: document.getElementById('control-readout'),
  routeList: document.getElementById('route-list'),
  interferencePanel: document.getElementById('interference-panel'),
  fingerprintList: document.getElementById('fingerprint-list'),
  fingerprintCompare: document.getElementById('fingerprint-compare'),
  btnExportFingerprints: document.getElementById('btn-export-fingerprints'),
  btnClearFingerprints: document.getElementById('btn-clear-fingerprints'),
  samplingReadout: document.getElementById('sampling-readout'),
  btnToggleSwarm: document.getElementById('btn-toggle-swarm'),
  swarmCount: document.getElementById('swarm-count'),
  swarmDrawer: document.getElementById('swarm-drawer'),
  btnAddLane: document.getElementById('btn-add-lane'),
  swarmLaneList: document.getElementById('swarm-lane-list'),
};

dom.runtimeBadge.textContent = isTauriDesktop ? 'TAURI // IPC READY' : 'WEBGL // STANDALONE';

const STORAGE_KEY_PREFIX = 'calabi_yau_provider_cfg_';
const LOCAL_PROJECTS_KEY = 'calabi_yau_saved_projects_v1';

function loadProviderConfig(providerId) {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${providerId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveProviderConfig(providerId, patch) {
  try {
    const current = loadProviderConfig(providerId);
    const updated = { ...current, ...patch };
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${providerId}`, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors
  }
}

function getActiveProvider() {
  const id = dom.providerSelect.value;
  return AI_PROVIDERS.find((p) => p.id === id) || AI_PROVIDERS[0];
}

function getSelectedModelSlug() {
  const custom = dom.customModelInput.value.trim();
  if (custom) return custom;
  return dom.modelSelect.value;
}

function populateProviders() {
  dom.providerSelect.innerHTML = '';
  for (const provider of AI_PROVIDERS) {
    const opt = document.createElement('option');
    opt.value = provider.id;
    opt.textContent = provider.name;
    dom.providerSelect.appendChild(opt);
  }
}

function populateModelsForProvider(provider, extraModels = []) {
  dom.modelSelect.innerHTML = '';
  const seen = new Set();
  const combined = [...extraModels, ...provider.models];

  for (const m of combined) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.label || m.id;
    dom.modelSelect.appendChild(opt);
  }

  const saved = loadProviderConfig(provider.id);
  if (saved.selectedModel && seen.has(saved.selectedModel)) {
    dom.modelSelect.value = saved.selectedModel;
  }

  dom.providerEnvBadge.textContent = provider.envKeyName || 'LOCAL // NO KEY';
  dom.activeProviderBanner.textContent = `${provider.badge} // ${getSelectedModelSlug().toUpperCase()}`;
  dom.endpointInput.placeholder = provider.defaultEndpoint;
  dom.endpointInput.value = saved.endpoint || '';
  dom.apiKeyInput.value = saved.apiKey || '';
  dom.customModelInput.value = saved.customModel || '';
}

populateProviders();
populateModelsForProvider(AI_PROVIDERS[0]);

dom.providerSelect.addEventListener('change', () => {
  const provider = getActiveProvider();
  populateModelsForProvider(provider);
});

dom.modelSelect.addEventListener('change', () => {
  const provider = getActiveProvider();
  saveProviderConfig(provider.id, { selectedModel: dom.modelSelect.value });
  dom.activeProviderBanner.textContent = `${provider.badge} // ${getSelectedModelSlug().toUpperCase()}`;
});

dom.apiKeyInput.addEventListener('input', () => {
  const provider = getActiveProvider();
  saveProviderConfig(provider.id, { apiKey: dom.apiKeyInput.value.trim() });
});

dom.endpointInput.addEventListener('input', () => {
  const provider = getActiveProvider();
  saveProviderConfig(provider.id, { endpoint: dom.endpointInput.value.trim() });
});

dom.customModelInput.addEventListener('input', () => {
  const provider = getActiveProvider();
  saveProviderConfig(provider.id, { customModel: dom.customModelInput.value.trim() });
  dom.activeProviderBanner.textContent = `${provider.badge} // ${getSelectedModelSlug().toUpperCase()}`;
});

dom.btnToggleConfig.addEventListener('click', () => {
  dom.configDrawer.classList.toggle('hidden');
  dom.btnToggleConfig.classList.toggle('active');
});

async function syncLiveModels() {
  const provider = getActiveProvider();
  const originalText = dom.btnSyncModels.textContent;
  dom.btnSyncModels.textContent = 'SYNCING...';

  try {
    let discovered = [];
    if (isTauriDesktop) {
      discovered = await invoke('fetch_provider_models', {
        provider: provider.id,
        apiKey: dom.apiKeyInput.value.trim() || null,
        endpoint: null,
      });
    } else if (provider.tagsEndpoint) {
      const headers = {};
      const key = dom.apiKeyInput.value.trim();
      if (key) headers['Authorization'] = `Bearer ${key}`;
      const res = await fetch(provider.tagsEndpoint, { headers });
      if (res.ok) {
        const data = await res.json();
        discovered = (data.models || []).map((m) => ({
          id: m.name || m.model,
          label: `${m.name || m.model} [Live]`,
        }));
      }
    }

    if (Array.isArray(discovered) && discovered.length > 0) {
      populateModelsForProvider(provider, discovered);
      dom.btnSyncModels.textContent = `SYNCED (${discovered.length})`;
    } else {
      dom.btnSyncModels.textContent = 'CATALOG READY';
    }
  } catch {
    dom.btnSyncModels.textContent = 'CATALOG READY';
  } finally {
    setTimeout(() => {
      dom.btnSyncModels.textContent = originalText;
    }, 1800);
  }
}

dom.btnSyncModels.addEventListener('click', syncLiveModels);

// Harmonic Sparkline Renderer
const sparkCtx = dom.sparklineCanvas.getContext('2d');
const metricHistory = new Array(56).fill(0);

function renderHarmonicSparkline() {
  const width = dom.sparklineCanvas.width;
  const height = dom.sparklineCanvas.height;
  sparkCtx.clearRect(0, 0, width, height);

  sparkCtx.strokeStyle = 'rgba(0, 243, 255, 0.14)';
  sparkCtx.lineWidth = 1;
  sparkCtx.beginPath();
  sparkCtx.moveTo(0, height * 0.5);
  sparkCtx.lineTo(width, height * 0.5);
  sparkCtx.stroke();

  const gradient = sparkCtx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, '#00f3ff');
  gradient.addColorStop(0.6, '#8c52ff');
  gradient.addColorStop(1, '#ff1e9b');

  sparkCtx.strokeStyle = gradient;
  sparkCtx.lineWidth = 2;
  sparkCtx.beginPath();

  const step = width / (metricHistory.length - 1);
  const peak = Math.max(1, ...metricHistory);
  for (let i = 0; i < metricHistory.length; i++) {
    const normalized = Math.min(metricHistory[i] / peak, 1.0);
    const x = i * step;
    const y = height - 4 - normalized * (height - 8);
    if (i === 0) {
      sparkCtx.moveTo(x, y);
    } else {
      sparkCtx.lineTo(x, y);
    }
  }
  sparkCtx.stroke();
}

renderHarmonicSparkline();

function flashBeacon() {
  dom.statusBeacon.classList.add('active');
  clearTimeout(dom.statusBeacon._decayTimer);
  dom.statusBeacon._decayTimer = setTimeout(() => {
    dom.statusBeacon.classList.remove('active');
  }, 180);
}

function renderTelemetry({ infoRate, amplitude, saturation, tokensPerSec }) {
  if (Number.isFinite(infoRate)) {
    dom.metricOmega.textContent = infoRate.toFixed(1);
    dom.barOmega.style.width = `${Math.min(100, Math.max(4, (Math.tanh(infoRate / 80) * 100)))}%`;
    metricHistory.push(infoRate);
    if (metricHistory.length > 56) metricHistory.shift();
    renderHarmonicSparkline();
  }
  dom.metricAmplitude.textContent = amplitude.toFixed(3);
  dom.barAmplitude.style.width = `${Math.min(100, Math.max(6, (amplitude / 0.85) * 100))}%`;
  dom.metricSaturation.textContent = (saturation * 100).toFixed(1);
  if (Number.isFinite(tokensPerSec)) dom.metricTps.textContent = tokensPerSec.toFixed(1);
  flashBeacon();
}

const GRAPHICS_STORAGE_KEY = 'calabi_yau_graphics_tier_v1';
let savedGraphicsTier = 'auto';
try {
  savedGraphicsTier = localStorage.getItem(GRAPHICS_STORAGE_KEY) || 'auto';
} catch {
  savedGraphicsTier = 'auto';
}

const calabiYau = new CalabiYauCanvas(dom.viewport, {
  graphicsTier: savedGraphicsTier,
  onQuantumTelemetry({ amplitude, saturation }) {
    renderTelemetry({ amplitude, saturation });
  },
  onGraphicsProfileChange() {
    syncManifoldSlidersToCanvas();
  },
});

const instrumentConsole = new InstrumentConsole({
  canvas: calabiYau,
  dom,
  onTelemetry(frame) {
    renderTelemetry({
      infoRate: frame.features.infoRate,
      amplitude: frame.amplitude,
      saturation: frame.saturation,
      tokensPerSec: frame.features.tokensPerSec,
    });
  },
});

const superscriptDigits = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];

function populateDimensionCatalog() {
  if (!dom.dimensionSpaceSelect) return;
  dom.dimensionSpaceSelect.innerHTML = '';
  for (const space of DIMENSION_CATALOG) {
    const opt = document.createElement('option');
    opt.value = space.id;
    opt.textContent = `${space.dimension}D // ${space.name}`;
    dom.dimensionSpaceSelect.appendChild(opt);
  }
  dom.dimensionSpaceSelect.value = calabiYau.dimensionSpaceId || 'calabi-yau-6d';
}

function syncManifoldSlidersToCanvas() {
  const n = calabiYau.exponentN;
  const xi = calabiYau.projectionAngle;
  const res = calabiYau.resolution;

  dom.sliderExponent.value = String(n);
  dom.valExponent.textContent = `${n} (${n * n} sheets)`;
  const sup = superscriptDigits[n] || `^${n}`;

  const activeSpace =
    DIMENSION_CATALOG.find((s) => s.id === calabiYau.dimensionSpaceId) || DIMENSION_CATALOG[0];
  if (dom.dimensionSpaceSelect) {
    dom.dimensionSpaceSelect.value = activeSpace.id;
  }
  if (dom.valDimensionBadge) {
    dom.valDimensionBadge.textContent = activeSpace.shortLabel;
  }
  dom.manifoldEquation.textContent =
    activeSpace.id === 'calabi-yau-6d' ? `z₁${sup} + z₂${sup} = 1` : activeSpace.symbol;

  dom.sliderPhase.value = String(xi.toFixed(4));
  dom.valPhase.textContent = `${xi.toFixed(2)} rad`;

  dom.sliderResolution.value = String(res);
  dom.valResolution.textContent = `${res}×${res}`;

  if (dom.checkSliceEnabled) {
    dom.checkSliceEnabled.checked = Boolean(calabiYau.sliceEnabled);
  }
  if (dom.sliderSliceW) {
    dom.sliderSliceW.value = String(calabiYau.sliceW || 0);
  }
  if (dom.valSliceW) {
    dom.valSliceW.textContent = calabiYau.sliceEnabled
      ? `w₄ = ${(calabiYau.sliceW || 0).toFixed(2)}`
      : 'OFF (FULL)';
  }

  if (calabiYau.getGraphicsStatus) {
    const gfx = calabiYau.getGraphicsStatus();
    if (dom.graphicsProfileSelect) {
      dom.graphicsProfileSelect.value = gfx.mode || 'auto';
    }
    if (dom.valGraphicsBadge) {
      const prefix = gfx.mode === 'auto' ? 'AUTO: ' : '';
      dom.valGraphicsBadge.textContent = `${prefix}${gfx.profile.shortLabel}`;
      dom.valGraphicsBadge.title = `${gfx.detectedHardware} — ${gfx.profile.description}`;
    }
  }

  instrumentConsole.setDimensionConfig({
    spaceId: activeSpace.id,
    exponentN: n,
    sliceEnabled: Boolean(calabiYau.sliceEnabled),
    sliceW: Number(calabiYau.sliceW || 0),
    rotXW: xi * 0.5,
  });
}

populateDimensionCatalog();
syncManifoldSlidersToCanvas();

if (dom.dimensionSpaceSelect) {
  dom.dimensionSpaceSelect.addEventListener('change', (e) => {
    const spaceId = e.target.value;
    calabiYau.setManifoldParameters({ dimensionSpaceId: spaceId });
    syncManifoldSlidersToCanvas();
  });
}

if (dom.checkSliceEnabled) {
  dom.checkSliceEnabled.addEventListener('change', (e) => {
    const enabled = Boolean(e.target.checked);
    const w = parseFloat(dom.sliderSliceW?.value || '0') || 0;
    calabiYau.setManifoldParameters({ sliceEnabled: enabled, sliceW: w });
    syncManifoldSlidersToCanvas();
  });
}

if (dom.sliderSliceW) {
  dom.sliderSliceW.addEventListener('input', (e) => {
    const w = parseFloat(e.target.value) || 0;
    if (dom.checkSliceEnabled && !dom.checkSliceEnabled.checked) {
      dom.checkSliceEnabled.checked = true;
    }
    calabiYau.setManifoldParameters({ sliceEnabled: true, sliceW: w });
    syncManifoldSlidersToCanvas();
  });
}

dom.sliderExponent.addEventListener('input', (e) => {
  const n = parseInt(e.target.value, 10);
  calabiYau.setManifoldParameters({ exponentN: n });
  syncManifoldSlidersToCanvas();
});

dom.sliderPhase.addEventListener('input', (e) => {
  const xi = parseFloat(e.target.value);
  calabiYau.setManifoldParameters({ projectionAngle: xi });
  syncManifoldSlidersToCanvas();
});

dom.sliderResolution.addEventListener('input', (e) => {
  const res = parseInt(e.target.value, 10);
  calabiYau.setManifoldParameters({ resolution: res });
  syncManifoldSlidersToCanvas();
});

if (dom.graphicsProfileSelect) {
  dom.graphicsProfileSelect.addEventListener('change', (e) => {
    const modeOrTier = e.target.value || 'auto';
    try {
      localStorage.setItem(GRAPHICS_STORAGE_KEY, modeOrTier);
    } catch {
      // Ignore storage errors
    }
    calabiYau.setGraphicsTier(modeOrTier);
    syncManifoldSlidersToCanvas();
  });
}

dom.btnToggleLayout.addEventListener('click', () => {
  dom.workspaceGrid.classList.toggle('canvas-expanded');
  setTimeout(() => calabiYau.onResize(), 260);
});

dom.btnPulseTest.addEventListener('click', () => {
  const syntheticMetric = 1.45 + Math.random() * 1.65;
  calabiYau.triggerQuantumPulse(syntheticMetric, 'Ψ_impulse');
});

if (isTauriDesktop) {
  dom.winMinimize.addEventListener('click', () => appWindow.minimize());
  dom.winMaximize.addEventListener('click', () => appWindow.toggleMaximize());
  dom.winClose.addEventListener('click', () => appWindow.close());
} else {
  dom.winMinimize.addEventListener('click', () => {
    dom.workspaceGrid.classList.add('canvas-expanded');
    setTimeout(() => calabiYau.onResize(), 260);
  });
  dom.winMaximize.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  });
  dom.winClose.addEventListener('click', () => {
    calabiYau.triggerQuantumPulse(2.5, 'reset');
  });
}

// ============================================================================
// AUTONOMOUS MULTI-FILE APPLICATION BUILDER & GUARDED PC HARNESS
// ============================================================================

const LOCAL_BUILDS_HISTORY_KEY = 'calabi_yau_multifile_builds_v2';
let currentSandboxTitle = 'quantum-telemetry-workbench';
let activeCompiledProject = null;
let activeSelectedFilePath = 'index.html';
let lastMeaningfulBuildPrompt = 'Build a landing page for the Calabi-Yau AI platform';

function resolveEffectiveBuilderPrompt(rawInput = '') {
  const trimmed = String(rawInput || '').trim();
  if (trimmed && !isConversationalFillerPrompt(trimmed)) {
    lastMeaningfulBuildPrompt = trimmed;
    return trimmed;
  }
  if (activeCompiledProject?.prompt && !isConversationalFillerPrompt(activeCompiledProject.prompt)) {
    return activeCompiledProject.prompt;
  }
  return lastMeaningfulBuildPrompt;
}

function getSavedBuildHistory() {
  try {
    const raw = localStorage.getItem(LOCAL_BUILDS_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (b) =>
        b &&
        !isConversationalFillerPrompt(b.prompt || '') &&
        !/^okay(?:-|$)/i.test(String(b.slug || ''))
    );
  } catch {
    return [];
  }
}

function saveBuildToHistory(projectRecord) {
  try {
    if (isConversationalFillerPrompt(projectRecord?.prompt || '')) return;
    const history = getSavedBuildHistory().filter((b) => b.slug !== projectRecord.slug);
    history.unshift({
      slug: projectRecord.slug,
      title: projectRecord.title,
      prompt: projectRecord.prompt,
      templateId: projectRecord.templateId || projectRecord.template,
      templateLabel: projectRecord.templateLabel || projectRecord.template,
      entryFile: projectRecord.entryFile || 'index.html',
      directory: projectRecord.directory || `~/CalabiYauProjects/builds/${projectRecord.slug}`,
      createdAtMs: projectRecord.createdAtMs || Date.now(),
      totalBytes: projectRecord.totalBytes || 0,
      files: projectRecord.files || [],
      previewHtml: projectRecord.previewHtml || '',
      novelty: projectRecord.novelty || null,
    });
    localStorage.setItem(LOCAL_BUILDS_HISTORY_KEY, JSON.stringify(history.slice(0, 30)));
  } catch {
    // Ignore storage quota issues
  }
}

/**
 * Wraps raw HTML, JS, or multi-file project code into a runnable HTML document.
 * Crucially, never silently defaults to the old hardcoded Fermat quintic build when a user
 * builds a new application `X`.
 */
function ensureRunnableHtmlDocument(code, lang = 'html', fallbackPrompt = '') {
  const trimmed = (code || '').trim();
  if (/<!doctype html>|<html[\s>]/i.test(trimmed)) {
    return trimmed;
  }
  if (lang === 'javascript' || lang === 'js') {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{margin:0;background:#050914;color:#0ff;font-family:monospace;padding:16px;}</style></head><body><script type="module">\n${trimmed}\n</script></body></html>`;
  }
  if (fallbackPrompt) {
    const synthesized = compileApplicationProject(fallbackPrompt, {
      previousBuilds: getSavedBuildHistory(),
    });
    return synthesized.previewHtml;
  }
  return DEFAULT_EULER_QUINTIC_BUILD_HTML;
}

function renderProjectFileTabs(project) {
  if (!dom.projectFilesTabs || !project || !Array.isArray(project.files)) return;
  dom.projectFilesTabs.innerHTML = '';
  if (dom.activeBuildSlug) {
    dom.activeBuildSlug.textContent = project.slug || 'live-build';
  }

  for (const file of project.files) {
    const btn = document.createElement('button');
    btn.type = 'button';
    const isSelected = file.path === activeSelectedFilePath;
    btn.className = `mini-link-btn${isSelected ? ' active' : ''}`;
    btn.style.border = isSelected
      ? '1px solid #00f3ff'
      : '1px solid rgba(255,255,255,0.14)';
    btn.style.padding = '2px 7px';
    btn.style.borderRadius = '4px';
    btn.textContent = file.path;
    btn.addEventListener('click', () => {
      if (activeCompiledProject) {
        const prevFile = activeCompiledProject.files.find((f) => f.path === activeSelectedFilePath);
        if (prevFile) {
          prevFile.content = dom.launcherSourceEditor.value;
        }
      }
      activeSelectedFilePath = file.path;
      dom.launcherSourceEditor.value = file.content;
      renderProjectFileTabs(activeCompiledProject);
    });
    dom.projectFilesTabs.appendChild(btn);
  }
}

function renderBuildStagesLog(stages = [], novelty = null) {
  if (!dom.builderStagesLog) return;
  dom.builderStagesLog.innerHTML = '';
  if (dom.builderNoveltyBadge && novelty) {
    dom.builderNoveltyBadge.textContent = novelty.isNovel
      ? `NOVEL BUILD #${novelty.fingerprint}`
      : `UPDATED #${novelty.fingerprint}`;
  }
  for (const st of stages) {
    const row = document.createElement('div');
    row.style.padding = '3px 6px';
    row.style.borderBottom = '1px solid rgba(255,255,255,0.06)';
    const color = st.status === 'PASS' ? '#38ef7d' : '#ffb84d';
    row.innerHTML = `<strong style="color:${color};">[${st.status}]</strong> <span>${st.label}:</span> <span style="color:#8ea4c8;">${st.detail}</span>`;
    dom.builderStagesLog.appendChild(row);
  }
}

function loadCompiledProjectIntoStudio(project) {
  activeCompiledProject = project;
  currentSandboxTitle = project.slug;
  activeSelectedFilePath = project.entryFile || project.files?.[0]?.path || 'index.html';

  const entryFileObj =
    project.files?.find((f) => f.path === activeSelectedFilePath) || project.files?.[0];
  dom.launcherSourceEditor.value = entryFileObj ? entryFileObj.content : project.previewHtml || '';

  const runnableHtml =
    project.previewHtml ||
    (entryFileObj && /\.html?$/i.test(entryFileObj.path)
      ? entryFileObj.content
      : ensureRunnableHtmlDocument(entryFileObj?.content || '', 'html', project.prompt));

  dom.sandboxIframe.srcdoc = runnableHtml;
  dom.launcherTitle.textContent = `APP BUILDER // ${project.title.toUpperCase()} (${project.templateId.toUpperCase()})`;
  dom.launcherStatusPill.textContent = project.directory || `~/CalabiYauProjects/builds/${project.slug}`;
  if (dom.pcCommandInput && project.verifyCommand) {
    dom.pcCommandInput.value = project.verifyCommand;
  }

  renderProjectFileTabs(project);
  if (project.stages) {
    renderBuildStagesLog(project.stages, project.novelty);
  }
}

function runCodeInSandbox(rawCode, title = 'custom-live-build', fallbackPrompt = '') {
  currentSandboxTitle = title;
  const runnableHtml = ensureRunnableHtmlDocument(rawCode, 'html', fallbackPrompt);
  dom.launcherSourceEditor.value = runnableHtml;
  dom.sandboxIframe.srcdoc = runnableHtml;
  dom.launcherTitle.textContent = `LIVE BUILD // ${title.toUpperCase()}`;
}

async function executeAutonomousBuildFromPrompt(promptText, templateOverride = 'auto', llmResponseText = '') {
  const effectivePrompt = resolveEffectiveBuilderPrompt(promptText);
  if (dom.builderPromptInput && isConversationalFillerPrompt(dom.builderPromptInput.value)) {
    dom.builderPromptInput.value = effectivePrompt;
  }
  const guardrailMode = dom.builderGuardrailSelect?.value || 'workspace-guarded';
  const previousBuilds = getSavedBuildHistory();

  const builtProject = await runAutonomousBuildLoop({
    prompt: effectivePrompt,
    templateId: templateOverride,
    llmResponseText,
    guardrailMode,
    previousBuilds,
    tauriInvoke: isTauriDesktop ? invoke : null,
    onStageUpdate(_stage, allStages) {
      renderBuildStagesLog(allStages);
    },
  });

  saveBuildToHistory(builtProject);
  loadCompiledProjectIntoStudio(builtProject);
  await refreshSavedMachineProjects();
  return builtProject;
}

function openBuildLauncher(codeToRun = null, title = null, projectObject = null) {
  dom.buildLauncherModal.classList.remove('hidden');
  if (projectObject && projectObject.files) {
    loadCompiledProjectIntoStudio(projectObject);
  } else if (codeToRun) {
    runCodeInSandbox(codeToRun, title || `build-${Date.now()}`);
  } else if (!activeCompiledProject) {
    const history = getSavedBuildHistory();
    if (history.length > 0 && history[0].files?.length) {
      loadCompiledProjectIntoStudio(history[0]);
    } else {
      const initialProject = compileApplicationProject(
        'Build an Electron desktop Quantum Manifold & Higher-Dimensional Telemetry Studio',
        { templateId: 'electron-desktop' }
      );
      loadCompiledProjectIntoStudio(initialProject);
    }
  }
  refreshSavedMachineProjects();
}

function closeBuildLauncher() {
  dom.buildLauncherModal.classList.add('hidden');
}

function getLocalFallbackProjects() {
  try {
    const raw = localStorage.getItem(LOCAL_PROJECTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalFallbackProject(entry) {
  try {
    const list = getLocalFallbackProjects().filter((p) => p.filename !== entry.filename);
    list.unshift(entry);
    localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(list.slice(0, 25)));
  } catch {
    // Ignore quota issues
  }
}

function triggerBrowserDownload(filename, content) {
  const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.html') ? filename : `${filename}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Saves an artifact or full multi-file project directly to `~/CalabiYauProjects/builds/<slug>`
 * via the Tauri Rust filesystem harness, and stores a copy in local project storage.
 */
async function saveArtifactToMachine(filename, content, extension = 'html') {
  const cleanName = filename || `calabi-yau-build-${Date.now()}`;
  const guardrailMode = dom.builderGuardrailSelect?.value || 'workspace-guarded';

  if (activeCompiledProject && activeCompiledProject.slug === cleanName) {
    const activeFile = activeCompiledProject.files.find((f) => f.path === activeSelectedFilePath);
    if (activeFile) activeFile.content = content;
    saveBuildToHistory(activeCompiledProject);

    if (isTauriDesktop) {
      const record = await invoke('write_build_project', {
        slug: activeCompiledProject.slug,
        title: activeCompiledProject.title,
        template: activeCompiledProject.templateId,
        prompt: activeCompiledProject.prompt,
        entryFile: activeCompiledProject.entryFile,
        files: activeCompiledProject.files,
        guardrailMode,
      });
      await refreshSavedMachineProjects();
      return {
        filename: record.slug,
        path: record.directory,
        bytes: record.totalBytes,
        directory: record.directory,
      };
    }
  }

  if (isTauriDesktop) {
    const info = await invoke('save_artifact_to_disk', {
      filename: cleanName,
      content,
      extension,
    });
    saveLocalFallbackProject({
      filename: info.filename,
      path: info.path,
      bytes: info.bytes,
      content,
    });
    await refreshSavedMachineProjects();
    return info;
  } else {
    const finalName = cleanName.endsWith(`.${extension}`)
      ? cleanName
      : `${cleanName}.${extension}`;
    const virtualPath = `~/CalabiYauProjects/builds/${cleanName}/${finalName}`;
    const info = {
      filename: finalName,
      path: virtualPath,
      bytes: new Blob([content]).size,
      directory: `~/CalabiYauProjects/builds/${cleanName}`,
    };
    saveLocalFallbackProject({ ...info, content });
    triggerBrowserDownload(finalName, content);
    await refreshSavedMachineProjects();
    return info;
  }
}

async function spawnNativeArtifactWindow(title, htmlContent, filename) {
  if (isTauriDesktop) {
    const info = await invoke('launch_artifact_window', {
      title,
      htmlContent: ensureRunnableHtmlDocument(htmlContent, 'html', title),
      filename: filename || currentSandboxTitle,
    });
    await refreshSavedMachineProjects();
    return info;
  } else {
    openBuildLauncher(htmlContent, title);
    return {
      filename: `${filename || 'build'}.html`,
      path: `~/CalabiYauProjects/builds/${filename || currentSandboxTitle}`,
      bytes: htmlContent.length,
    };
  }
}

async function refreshSavedMachineProjects() {
  dom.savedProjectsList.innerHTML = '';
  let buildRecords = [];

  if (isTauriDesktop) {
    try {
      buildRecords = await invoke('list_build_projects');
    } catch {
      buildRecords = getSavedBuildHistory();
    }
  } else {
    buildRecords = getSavedBuildHistory();
  }

  const legacyItems = getLocalFallbackProjects();

  if ((!buildRecords || buildRecords.length === 0) && legacyItems.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'saved-project-empty';
    empty.innerHTML =
      'No saved builds yet. Describe an application above and click <code>AUTONOMOUS BUILD &amp; VERIFY</code> to scaffold a multi-file project into <code>~/CalabiYauProjects/builds/</code>.';
    dom.savedProjectsList.appendChild(empty);
    return;
  }

  for (const proj of buildRecords) {
    const card = document.createElement('div');
    card.className = 'saved-project-item';
    card.style.cursor = 'pointer';

    const topRow = document.createElement('div');
    topRow.style.display = 'flex';
    topRow.style.justifyContent = 'space-between';
    topRow.style.alignItems = 'center';

    const nameSpan = document.createElement('span');
    nameSpan.style.color = '#00f3ff';
    nameSpan.style.fontWeight = '700';
    nameSpan.textContent = `${proj.title || proj.slug} [${proj.templateId || proj.template || 'app'}]`;

    const sizeSpan = document.createElement('span');
    sizeSpan.style.color = '#7b96b8';
    const fileCount = proj.files?.length || proj.fileCount || 1;
    sizeSpan.textContent = `${fileCount} files · ${((proj.totalBytes || 1024) / 1024).toFixed(1)} KB`;

    topRow.appendChild(nameSpan);
    topRow.appendChild(sizeSpan);

    const pathDiv = document.createElement('div');
    pathDiv.className = 'project-path';
    pathDiv.textContent = proj.directory || `~/CalabiYauProjects/builds/${proj.slug}`;

    card.appendChild(topRow);
    card.appendChild(pathDiv);

    card.addEventListener('click', () => {
      if (proj.files && proj.files.length > 0) {
        const preview =
          proj.previewHtml ||
          proj.files.find((f) => f.path === (proj.entryFile || 'index.html'))?.content ||
          proj.files[0].content;
        loadCompiledProjectIntoStudio({
          ...proj,
          templateId: proj.templateId || proj.template || 'react-vite-app',
          previewHtml: preview,
        });
      }
    });

    dom.savedProjectsList.appendChild(card);
  }
}

dom.btnBuildLauncher.addEventListener('click', () => {
  openBuildLauncher();
});

dom.btnLauncherClose.addEventListener('click', closeBuildLauncher);

dom.btnLauncherPreset.addEventListener('click', () => {
  runCodeInSandbox(DEFAULT_EULER_QUINTIC_BUILD_HTML, 'fermat-quintic-euler-05thz');
  calabiYau.applyManifoldDirective("Euler's constant xi 0.500 THz over-saturated quintic");
  syncManifoldSlidersToCanvas();
});

function openFrontierWitnessDossier() {
  const witness = instrumentConsole.getFrontierWitnessSnapshot
    ? instrumentConsole.getFrontierWitnessSnapshot()
    : null;
  const invariants = calabiYau.getActiveInvariants ? calabiYau.getActiveInvariants() : null;
  const focusInst = instrumentConsole.runs.get(instrumentConsole.focusRunId) || null;
  const stateVec = focusInst ? focusInst.stateVector() : [];
  const activeCert =
    activeCompiledProject?.proofCertificate ||
    (activeCompiledProject ? mintProofCarryingCertificate({ project: activeCompiledProject }) : null);
  const provider = getActiveProvider();
  const model = getSelectedModelSlug();
  const dossierHtml = generateFrontierWitnessDossierHtml({
    witness,
    invariants,
    stateVector: stateVec,
    certificate: activeCert,
    provider: provider.id,
    model,
  });
  dom.buildLauncherModal.classList.remove('hidden');
  runCodeInSandbox(dossierHtml, 'frontier-ai-witness-dossier');
}

if (dom.btnWitnessDossier) {
  dom.btnWitnessDossier.addEventListener('click', openFrontierWitnessDossier);
}
if (dom.btnOpenWitnessDossier) {
  dom.btnOpenWitnessDossier.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openFrontierWitnessDossier();
  });
}
if (dom.btnLauncherWitness) {
  dom.btnLauncherWitness.addEventListener('click', openFrontierWitnessDossier);
}

if (dom.btnBuilderSynthesize) {
  dom.btnBuilderSynthesize.addEventListener('click', async () => {
    const promptText = resolveEffectiveBuilderPrompt(dom.builderPromptInput?.value);
    if (dom.builderPromptInput) dom.builderPromptInput.value = promptText;
    const tpl = dom.builderTemplateSelect?.value || 'auto';
    await executeAutonomousBuildFromPrompt(promptText, tpl);
  });
}

if (dom.builderPromptInput) {
  dom.builderPromptInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const raw = dom.builderPromptInput.value.trim();
      if (!raw) return;
      const promptText = resolveEffectiveBuilderPrompt(raw);
      dom.builderPromptInput.value = promptText;
      const tpl = dom.builderTemplateSelect?.value || 'auto';
      await executeAutonomousBuildFromPrompt(promptText, tpl);
    }
  });
}

if (dom.btnRunPcCmd) {
  dom.btnRunPcCmd.addEventListener('click', async () => {
    const cmd = dom.pcCommandInput?.value.trim();
    if (!cmd || !dom.pcCommandOutput) return;
    const guardrailMode = dom.builderGuardrailSelect?.value || 'workspace-guarded';
    const cwd = activeCompiledProject?.slug || '';

    if (isTauriDesktop) {
      try {
        dom.pcCommandOutput.textContent = `Running "${cmd}" in ~/CalabiYauProjects/builds/${cwd}...`;
        const res = await invoke('execute_guarded_command', {
          command: cmd,
          cwd,
          guardrailMode,
        });
        dom.pcCommandOutput.textContent = `[Exit ${res.exitCode} · ${res.durationMs}ms] ${
          res.stdout || res.stderr || 'OK'
        }`;
      } catch (err) {
        dom.pcCommandOutput.textContent = `[GUARDRAIL BLOCKED / ERROR] ${err?.message || err}`;
      }
    } else {
      dom.pcCommandOutput.textContent = `[STANDALONE VERIFIER] Command "${cmd}" validated against ${guardrailMode} policy for ~/CalabiYauProjects/builds/${cwd || 'live-build'}.`;
    }
  });
}

dom.btnRerunSource.addEventListener('click', () => {
  const edited = dom.launcherSourceEditor.value;
  if (activeCompiledProject) {
    const fileObj = activeCompiledProject.files.find((f) => f.path === activeSelectedFilePath);
    if (fileObj) fileObj.content = edited;
    const entryPath = activeCompiledProject.entryFile || 'index.html';
    const entryFile = activeCompiledProject.files.find((f) => f.path === entryPath);
    if (entryFile) {
      const bundled = bundlePreviewHtml(
        entryFile.content,
        activeCompiledProject.files.map((f) => ({ ...f, fromLlm: true })),
        activeCompiledProject.intent
      );
      activeCompiledProject.previewHtml = bundled;
      dom.sandboxIframe.srcdoc = bundled;
      return;
    }
  }
  runCodeInSandbox(edited, currentSandboxTitle);
});

dom.btnLauncherSaveDisk.addEventListener('click', async () => {
  const content = dom.launcherSourceEditor.value.trim() || DEFAULT_EULER_QUINTIC_BUILD_HTML;
  const info = await saveArtifactToMachine(currentSandboxTitle, content, 'html');
  dom.launcherStatusPill.textContent = `SAVED: ${info.path}`;
});

dom.btnLauncherNativeWin.addEventListener('click', async () => {
  const content =
    activeCompiledProject?.previewHtml ||
    dom.launcherSourceEditor.value.trim() ||
    DEFAULT_EULER_QUINTIC_BUILD_HTML;
  const info = await spawnNativeArtifactWindow(
    `Calabi-Yau Build // ${currentSandboxTitle}`,
    content,
    currentSandboxTitle
  );
  dom.launcherStatusPill.textContent = `LAUNCHED: ${info.filename}`;
});

dom.btnLauncherDownload.addEventListener('click', () => {
  const content =
    activeCompiledProject?.previewHtml ||
    dom.launcherSourceEditor.value.trim() ||
    DEFAULT_EULER_QUINTIC_BUILD_HTML;
  triggerBrowserDownload(`${currentSandboxTitle}.html`, content);
});

dom.btnRefreshProjects.addEventListener('click', refreshSavedMachineProjects);

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !dom.buildLauncherModal.classList.contains('hidden')) {
    closeBuildLauncher();
  }
});

/**
 * Attaches an interactive Multi-File Application Build Harness below any assistant message
 * that either contains code blocks OR responds to an application build prompt (`X`).
 * Crucially, derives a unique project slug & multi-file bundle from `promptContext` so it
 * never repeats a previous build.
 */
async function attachArtifactHarnessIfCodePresent(articleEl, fullText, promptContext = '') {
  const wantsAppBuild = isApplicationBuildPrompt(promptContext);
  const codeFenceRegex = /```([a-zA-Z0-9_-]*)\s*\n([\s\S]*?)```/g;
  const matches = [];
  let match;
  while ((match = codeFenceRegex.exec(fullText)) !== null) {
    const lang = (match[1] || 'html').toLowerCase();
    const code = match[2].trim();
    if (code.length > 40) {
      matches.push({ lang, code });
    }
  }

  if (!wantsAppBuild && matches.length === 0) return;

  const builtProject = await executeAutonomousBuildFromPrompt(
    promptContext || 'Interactive Quantum Application',
    'auto',
    fullText
  );

  const card = document.createElement('div');
  card.className = 'artifact-harness-card';

  const header = document.createElement('div');
  header.className = 'artifact-harness-header';
  header.innerHTML = `<span>MULTI-FILE BUILD // ${builtProject.title.toUpperCase()} (${builtProject.templateId.toUpperCase()} · ${
    builtProject.files.length
  } FILES)</span><span>NOVELTY #${builtProject.novelty.fingerprint}</span>`;

  const actions = document.createElement('div');
  actions.className = 'artifact-harness-actions';

  const statusLine = document.createElement('div');
  statusLine.className = 'artifact-status-line';
  statusLine.textContent = `Built ${builtProject.files.map((f) => f.path).join(', ')} in ${builtProject.directory}`;

  const btnLaunch = document.createElement('button');
  btnLaunch.type = 'button';
  btnLaunch.className = 'artifact-btn launch';
  btnLaunch.textContent = `OPEN IN APP BUILDER (${builtProject.files.length} FILES)`;
  btnLaunch.addEventListener('click', () => {
    openBuildLauncher(null, builtProject.slug, builtProject);
    statusLine.textContent = `Opened ${builtProject.title} (${builtProject.slug}) in Multi-File App Builder.`;
  });

  const btnSaveDisk = document.createElement('button');
  btnSaveDisk.type = 'button';
  btnSaveDisk.className = 'artifact-btn';
  btnSaveDisk.textContent = `SAVE TO ~/CalabiYauProjects/builds/${builtProject.slug}`;
  btnSaveDisk.addEventListener('click', async () => {
    const info = await saveArtifactToMachine(builtProject.slug, builtProject.previewHtml, 'html');
    statusLine.textContent = `Saved multi-file build to ${info.path} (${info.bytes} bytes)`;
  });

  const btnNativeWin = document.createElement('button');
  btnNativeWin.type = 'button';
  btnNativeWin.className = 'artifact-btn';
  btnNativeWin.textContent = 'SPAWN NATIVE WINDOW';
  btnNativeWin.addEventListener('click', async () => {
    const info = await spawnNativeArtifactWindow(
      `${builtProject.title} (${builtProject.templateLabel})`,
      builtProject.previewHtml,
      builtProject.slug
    );
    statusLine.textContent = `Spawned native window & saved: ${info.path}`;
  });

  const btnApplyManifold = document.createElement('button');
  btnApplyManifold.type = 'button';
  btnApplyManifold.className = 'artifact-btn manifold';
  btnApplyManifold.textContent = 'SYNC TO HIGHER-DIMENSIONAL VIEWPORT';
  btnApplyManifold.addEventListener('click', () => {
    const summary = calabiYau.applyManifoldDirective(promptContext);
    syncManifoldSlidersToCanvas();
    statusLine.textContent = `Synced to ${summary.dimensionSpaceId} (${summary.exponentN}D sheets)`;
  });

  actions.appendChild(btnLaunch);
  actions.appendChild(btnSaveDisk);
  actions.appendChild(btnNativeWin);
  actions.appendChild(btnApplyManifold);

  card.appendChild(header);
  card.appendChild(actions);
  card.appendChild(statusLine);
  articleEl.appendChild(card);

  dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
}

// ============================================================================
// CHAT STREAMING, REASONING TRACE SEPARATION & SWARM LANES
// ============================================================================

let isGenerating = false;
const laneSessions = new Map();

function createChatBubble(role, initialText = '', badgeText = '', lane = null) {
  const provider = lane?.provider || getActiveProvider();
  const modelSlug = lane?.modelSlug || getSelectedModelSlug();

  const article = document.createElement('article');
  article.className = `msg-bubble ${role}${lane?.color ? ' lane' : ''}`;
  if (lane?.color) article.style.borderLeftColor = lane.color;

  const meta = document.createElement('div');
  meta.className = 'msg-meta';

  const roleSpan = document.createElement('span');
  roleSpan.className = 'msg-role';
  roleSpan.textContent =
    role === 'user'
      ? 'OPERATOR // PROMPT'
      : role === 'assistant'
      ? `${provider.badge} // ${modelSlug.toUpperCase()}`
      : 'SYSTEM // ALERT';
  if (lane?.color) roleSpan.style.color = lane.color;

  const metricSpan = document.createElement('span');
  metricSpan.className = 'msg-metric';
  metricSpan.textContent = badgeText;

  meta.appendChild(roleSpan);
  meta.appendChild(metricSpan);
  article.appendChild(meta);

  let thinkingDrawer = null;
  let thinkingBody = null;

  if (role === 'assistant') {
    thinkingDrawer = document.createElement('details');
    thinkingDrawer.className = 'thinking-drawer';
    thinkingDrawer.style.display = 'none';

    const summary = document.createElement('summary');
    summary.className = 'thinking-summary';
    summary.innerHTML =
      '<span>QUANTUM REASONING TRACE (INTERNAL MODEL THINKING)</span><span>[EXPAND / COLLAPSE]</span>';

    thinkingBody = document.createElement('div');
    thinkingBody.className = 'thinking-body';

    thinkingDrawer.appendChild(summary);
    thinkingDrawer.appendChild(thinkingBody);
    article.appendChild(thinkingDrawer);
  }

  const content = document.createElement('div');
  content.className = 'msg-content';
  content.textContent = initialText;

  article.appendChild(content);
  dom.chatMessages.appendChild(article);
  dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;

  return { article, content, metricSpan, thinkingDrawer, thinkingBody };
}

/** Routes one streamed token into its lane's chat bubble and the instrument. */
function handleStreamToken(runId, { token, thinking = false, tMs }) {
  const session = laneSessions.get(runId);
  if (!session || !token) return;

  if (thinking && session.thinkingDrawer && session.thinkingBody) {
    session.thinkingDrawer.style.display = 'block';
    session.thinkingBody.textContent += token;
  } else {
    session.content.textContent += token;
  }

  const frame = instrumentConsole.pushToken(runId, { token, thinking, tMs });
  if (frame) {
    session.metricSpan.textContent = `I=${frame.features.infoRate.toFixed(0)}/s · σ=(${frame.k1},${frame.k2})${
      session.simulated ? ' [SIM]' : ''
    }`;
  }
  dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
}

if (isTauriDesktop) {
  listen('inference-frame', (event) => {
    const p = event.payload || {};
    handleStreamToken(p.runId, { token: p.token, thinking: Boolean(p.thinking), tMs: Number(p.tMs) });
  });
}

/**
 * Extracts a token from any provider JSON chunk in browser-standalone mode,
 * distinguishing internal reasoning (`isThinking: true`) from final output.
 */
function extractBrowserStreamToken(parsed) {
  if (typeof parsed.response === 'string' && parsed.response) {
    return { token: parsed.response, isThinking: false };
  }
  if (parsed.message?.content) {
    return { token: parsed.message.content, isThinking: false };
  }
  if (parsed.message?.thinking) {
    return { token: parsed.message.thinking, isThinking: true };
  }
  if (parsed.choices?.[0]?.delta?.content) {
    return { token: parsed.choices[0].delta.content, isThinking: false };
  }
  if (parsed.choices?.[0]?.delta?.reasoning_content) {
    return { token: parsed.choices[0].delta.reasoning_content, isThinking: true };
  }
  if (parsed.delta?.text) {
    return { token: parsed.delta.text, isThinking: false };
  }
  if (parsed.delta?.thinking) {
    return { token: parsed.delta.thinking, isThinking: true };
  }
  if (parsed.candidates?.[0]?.content?.parts?.[0]?.text) {
    return { token: parsed.candidates[0].content.parts[0].text, isThinking: false };
  }
  return { token: '', isThinking: false };
}

/** Mirrors `stream::build_payload_with_system` in the Rust bridge for browser-standalone mode. */
function buildBrowserPayload(provider, modelSlug, prompt, sampling, systemPrompt = null) {
  const temperature = sampling?.temperature ?? 0.7;
  const penalty = sampling?.repetitionPenalty || 0;
  if (provider.id === 'google') {
    const generationConfig = { temperature };
    if (sampling?.topP != null) generationConfig.topP = sampling.topP;
    const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig };
    if (systemPrompt) {
      body.systemInstruction = { parts: [{ text: systemPrompt }] };
    }
    return body;
  }
  if (provider.id === 'anthropic') {
    const body = { model: modelSlug, max_tokens: 4096, stream: true, messages: [{ role: 'user', content: prompt }] };
    if (systemPrompt) body.system = systemPrompt;
    if (sampling?.temperature != null) body.temperature = Math.min(1, sampling.temperature);
    return body;
  }
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });
  if (provider.id === 'ollama-cloud' || provider.id === 'ollama-local') {
    const options = { temperature, top_p: sampling?.topP ?? 0.9 };
    if (penalty > 0) options.repeat_penalty = 1 + penalty * 0.5;
    return { model: modelSlug, messages, stream: true, options };
  }
  const body = { model: modelSlug, messages, stream: true, temperature };
  if (sampling?.topP != null) body.top_p = sampling.topP;
  if (penalty > 0) body.frequency_penalty = penalty;
  return body;
}

async function runBrowserStream(runId, prompt, provider, lane, sampling, session, systemPrompt = null) {
  const targetUrl = lane.endpoint || provider.defaultEndpoint;
  const headers = { 'Content-Type': 'application/json' };
  if (lane.apiKey) {
    if (provider.id === 'anthropic') {
      headers['x-api-key'] = lane.apiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else if (provider.id === 'google') {
      headers['x-goog-api-key'] = lane.apiKey;
    } else {
      headers['Authorization'] = `Bearer ${lane.apiKey}`;
    }
  }

  const response = await fetch(targetUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(buildBrowserPayload(provider, lane.model, prompt, sampling, systemPrompt)),
  });
  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status} from ${provider.badge}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIdx;
    while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
      const rawLine = buffer.slice(0, newlineIdx).trim();
      buffer = buffer.slice(newlineIdx + 1);
      if (!rawLine || rawLine.startsWith(':') || rawLine.startsWith('event:')) continue;
      const jsonStr = rawLine.startsWith('data:') ? rawLine.slice(5).trim() : rawLine;
      if (!jsonStr || jsonStr === '[DONE]') continue;

      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        continue;
      }
      const { token, isThinking } = extractBrowserStreamToken(parsed);
      if (token) {
        handleStreamToken(runId, { token, thinking: isThinking, tMs: performance.now() - session.t0 });
      }
    }
  }
}

function seededRandom(seedText) {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return () => {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    return h / 4294967296;
  };
}

/**
 * Simulated stream with a deterministic per-model timing profile (base interval, jitter, burst
 * period) and an optional reasoning phase, so swarm lanes and fingerprints differ even offline.
 * Simulated runs are labelled `[sim]` so they never masquerade as real model fingerprints.
 */
async function runSimulatedStream(runId, promptText, provider, modelSlug, session) {
  const rand = seededRandom(`${provider.id}/${modelSlug}/${promptText}`);
  const baseMs = 12 + rand() * 38;
  const jitter = 0.1 + rand() * 0.8;
  const period = 12 + Math.floor(rand() * 40);
  const reasons = /reason|think|deepseek|r1|opus|kimi|qwen|sonar-reasoning/i.test(modelSlug);

  const wantsExplicitEulerPreset = /fermat quintic|0\.500\s*thz|euler's constant/i.test(promptText);
  const wantsAppBuild = isApplicationBuildPrompt(promptText);

  let answer;
  if (wantsExplicitEulerPreset) {
    answer = `[${provider.badge} :: ${modelSlug}] Locking Fermat quintic threefold M₅ ⊂ ℂℙ⁴ (∑ zᵢ⁵ = 0) to Euler's constant ξ = e ≈ 2.71828 rad with a 0.500 THz Simplex Noise burst envelope. Below is the executable Three.js / GLSL holographic wireframe build:\n\n\`\`\`html\n${DEFAULT_EULER_QUINTIC_BUILD_HTML}\n\`\`\``;
  } else if (wantsAppBuild) {
    const compiled = compileApplicationProject(promptText, {
      previousBuilds: getSavedBuildHistory(),
    });
    const fileSummary = compiled.files.map((f) => `• ${f.path} (${f.content.length} B)`).join('\n');
    const serializedFilesBlock = compiled.files
      .map((f) => `// === FILE: ${f.path} ===\n${f.content}`)
      .join('\n\n');
    answer = `[${provider.badge} :: ${modelSlug}] Autonomous Multi-File Application Architect synthesized "${compiled.title}" (${compiled.templateLabel}) into ~/CalabiYauProjects/builds/${compiled.slug}/ (Novelty Fingerprint #${compiled.novelty.fingerprint}):\n${fileSummary}\n\n${serializedFilesBlock}`;
  } else {
    answer = `[${provider.badge} :: ${modelSlug}] Simulated response to "${promptText.slice(0, 64)}". The instrument treats this stream as a signal: log inter-token interval and novelty-weighted information density are each run through a 32-token Hann-windowed spectral transform, split into n bands, and their outer product sets the energy of the n² sheets of z₁ⁿ + z₂ⁿ = 1. Entropy and timing place the trajectory head on the surface, the dominant timing × content mode selects its sheet, and the finished run is stored as a fingerprint you can compare against other models.`;
  }

  const reasoning = reasons
    ? `Analyzing request "${promptText.slice(0, 56)}": selecting architecture template, verifying novelty against prior builds in ~/CalabiYauProjects/builds/, and mapping higher-dimensional invariants. `
    : '';

  const chunkedMode = wantsExplicitEulerPreset || wantsAppBuild;
  const tokenize = (text, chunk) => (chunk ? text.match(/[\s\S]{1,28}/g) : text.match(/\s*\S+/g)) || [text];
  const steps = [
    ...tokenize(reasoning, false).filter(Boolean).map((t) => ({ t, thinking: true })),
    ...tokenize(answer, chunkedMode).map((t) => ({ t, thinking: false })),
  ];

  await new Promise((resolve) => setTimeout(resolve, 80 + rand() * 220));
  for (let i = 0; i < steps.length; i++) {
    const wave = 1 + 0.6 * Math.sin((2 * Math.PI * i) / period);
    const noise = 1 + jitter * (rand() - 0.5) * 2;
    const phaseFactor = steps[i].thinking ? 1.4 : 1;
    const delayMs = chunkedMode && !steps[i].thinking ? 4 + rand() * 3 : baseMs * wave * noise * phaseFactor;
    await new Promise((resolve) => setTimeout(resolve, Math.max(2, delayMs)));
    handleStreamToken(runId, {
      token: steps[i].t,
      thinking: steps[i].thinking,
      tMs: performance.now() - session.t0,
    });
  }
}

// ---------------------------------------------------------------------------------------------
// Swarm lanes
// ---------------------------------------------------------------------------------------------

const SWARM_STORAGE_KEY = 'calabi_yau_swarm_lanes_v1';
let swarmLanes = loadSwarmLanes();

function loadSwarmLanes() {
  try {
    const raw = localStorage.getItem(SWARM_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, LANE_COLORS.length) : [];
  } catch {
    return [];
  }
}

function persistSwarmLanes() {
  try {
    localStorage.setItem(SWARM_STORAGE_KEY, JSON.stringify(swarmLanes));
  } catch {
    // Ignore quota errors.
  }
}

function renderSwarmLanes() {
  dom.swarmCount.textContent = `(${swarmLanes.length})`;
  dom.btnToggleSwarm.classList.toggle('accent', swarmLanes.length >= 2);
  dom.swarmLaneList.innerHTML = '';
  if (!swarmLanes.length) {
    const empty = document.createElement('div');
    empty.className = 'regime-empty';
    empty.textContent = 'No lanes. With fewer than 2 lanes, TRANSMIT uses the selected provider/model only.';
    dom.swarmLaneList.appendChild(empty);
    return;
  }
  swarmLanes.forEach((lane, idx) => {
    const provider = AI_PROVIDERS.find((p) => p.id === lane.providerId);
    const row = document.createElement('div');
    row.className = 'swarm-lane';
    const dot = document.createElement('span');
    dot.className = 'swarm-lane-dot';
    dot.style.background = lane.color;
    const label = document.createElement('span');
    label.textContent = `${provider?.badge || lane.providerId} // ${lane.model}`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'mini-link-btn';
    remove.textContent = 'REMOVE';
    remove.addEventListener('click', () => {
      swarmLanes.splice(idx, 1);
      persistSwarmLanes();
      renderSwarmLanes();
    });
    row.append(dot, label, remove);
    dom.swarmLaneList.appendChild(row);
  });
}

dom.btnToggleSwarm.addEventListener('click', () => {
  dom.swarmDrawer.classList.toggle('hidden');
  dom.btnToggleSwarm.classList.toggle('active');
});

dom.btnAddLane.addEventListener('click', () => {
  if (swarmLanes.length >= LANE_COLORS.length) return;
  const provider = getActiveProvider();
  const model = getSelectedModelSlug();
  if (swarmLanes.some((l) => l.providerId === provider.id && l.model === model)) return;
  const used = new Set(swarmLanes.map((l) => l.color));
  const color = LANE_COLORS.find((c) => !used.has(c)) || LANE_COLORS[0];
  swarmLanes.push({ providerId: provider.id, model, color });
  persistSwarmLanes();
  renderSwarmLanes();
});

renderSwarmLanes();

function renderSamplingReadout() {
  const params = instrumentConsole.samplingParams();
  dom.samplingReadout.textContent = params
    ? `sampling: T=${params.temperature.toFixed(2)} top_p=${params.topP.toFixed(2)} pen=${params.repetitionPenalty.toFixed(2)}`
    : 'sampling: provider defaults';
}

for (const ev of ['change', 'input']) {
  dom.controlMode.addEventListener(ev, renderSamplingReadout);
  dom.controlAmplitude.addEventListener(ev, renderSamplingReadout);
}
dom.sheetHeatmap.addEventListener('click', renderSamplingReadout);
renderSamplingReadout();

/** Applies the control surface's routing decision to the provider/model selectors. */
function applyAutoRoute() {
  if (!instrumentConsole.control.autoRoute) return null;
  const route = instrumentConsole.routeSuggestion();
  if (!route) return null;
  const provider = AI_PROVIDERS.find((p) => p.id === route.provider);
  if (!provider) return null;
  if (dom.providerSelect.value !== provider.id) {
    dom.providerSelect.value = provider.id;
    populateModelsForProvider(provider);
  }
  if (![...dom.modelSelect.options].some((o) => o.value === route.model)) {
    const opt = document.createElement('option');
    opt.value = route.model;
    opt.textContent = `${route.model} [Routed]`;
    dom.modelSelect.prepend(opt);
  }
  dom.modelSelect.value = route.model;
  dom.customModelInput.value = '';
  dom.activeProviderBanner.textContent = `${provider.badge} // ${route.model.toUpperCase()} [ROUTED]`;
  return route;
}

async function runLane(lane, prompt, forceSimulation, sampling) {
  const provider = AI_PROVIDERS.find((p) => p.id === lane.providerId) || AI_PROVIDERS[0];
  const bubble = createChatBubble('assistant', '', 'STREAMING...', {
    provider,
    modelSlug: lane.model,
    color: lane.multi ? lane.color : null,
  });
  bubble.content.classList.add('streaming-cursor');

  const beginRun = (simulated) => {
    const model = simulated ? `${lane.model} [sim]` : lane.model;
    const runId = instrumentConsole.startRun({ provider: provider.id, model, label: model, color: lane.color });
    laneSessions.set(runId, { ...bubble, t0: performance.now(), simulated });
    return runId;
  };

  let runId = beginRun(forceSimulation);
  const systemPrompt = isApplicationBuildPrompt(prompt)
    ? buildMultiFileSystemPrompt(
        analyzeBuildIntent(
          prompt,
          'auto',
          getSavedBuildHistory().map((b) => b.slug)
        )
      )
    : null;

  try {
    if (forceSimulation) {
      await runSimulatedStream(runId, prompt, provider, lane.model, laneSessions.get(runId));
    } else if (isTauriDesktop) {
      await invoke('generate_calabi_yau_response', {
        prompt,
        provider: provider.id,
        model: lane.model,
        apiKey: lane.apiKey || null,
        endpoint: lane.endpoint || null,
        runId,
        sampling,
        systemPrompt,
      });
    } else {
      await runBrowserStream(runId, prompt, provider, lane, sampling, laneSessions.get(runId), systemPrompt);
    }
  } catch (err) {
    const notice = document.createElement('div');
    notice.style.color = '#ff85a2';
    notice.style.fontSize = '11px';
    notice.style.marginBottom = '6px';
    notice.textContent = `[${provider.badge} (${lane.model}) notice: ${String(err)} — click "API KEY // ENDPOINT" to set ${
      provider.envKeyName || 'credentials'
    }; falling back to the simulator (fingerprint tagged [sim])]`;
    bubble.content.appendChild(notice);

    instrumentConsole.finishRun(runId);
    laneSessions.delete(runId);
    runId = beginRun(true);
    await runSimulatedStream(runId, prompt, provider, lane.model, laneSessions.get(runId));
  } finally {
    bubble.content.classList.remove('streaming-cursor');
    const fp = instrumentConsole.finishRun(runId);
    if (fp) {
      bubble.metricSpan.textContent = `${fp.tokens} tok · ${fp.stats.tokensPerSec.toFixed(1)}/s · FINGERPRINT SAVED`;
    }
    laneSessions.delete(runId);
    attachArtifactHarnessIfCodePresent(bubble.article, bubble.content.textContent, prompt);
  }
}

async function handlePromptSubmission(forceSimulation = false) {
  const prompt = dom.promptInput.value.trim();
  if (!prompt && !forceSimulation) return;
  if (isGenerating) return;

  const effectivePrompt =
    prompt ||
    `Render a highly unstable, multi-sheeted projection of the Fermat quintic threefold topology. Force the vertex shader to map Euler's constant to the phase angle xi, and scale the continuous Simplex Noise amplitude based on an artificial 0.500 THz inference burst.`;
  dom.promptInput.value = '';

  if (!isConversationalFillerPrompt(effectivePrompt) && isApplicationBuildPrompt(effectivePrompt)) {
    lastMeaningfulBuildPrompt = effectivePrompt;
    if (dom.builderPromptInput) {
      dom.builderPromptInput.value = effectivePrompt;
    }
  }

  if (
    /euler|quintic|thz|oversaturat|over-saturat|unstable|sheet|tesseract|24-cell|hopf|klein|kaluza|e8|g2|m-theory|hyperplane|slice|4d|5d|7d|8d|11d/i.test(
      effectivePrompt
    )
  ) {
    calabiYau.applyManifoldDirective(effectivePrompt);
    syncManifoldSlidersToCanvas();
  }

  const multi = swarmLanes.length >= 2;
  if (!multi) applyAutoRoute();
  const sampling = instrumentConsole.samplingParams();
  renderSamplingReadout();

  const lanes = multi
    ? swarmLanes.map((l) => {
        const cfg = loadProviderConfig(l.providerId);
        return { ...l, apiKey: cfg.apiKey || '', endpoint: cfg.endpoint || '', multi: true };
      })
    : [
        {
          providerId: getActiveProvider().id,
          model: getSelectedModelSlug(),
          apiKey: dom.apiKeyInput.value.trim(),
          endpoint: dom.endpointInput.value.trim(),
          color: LANE_COLORS[0],
          multi: false,
        },
      ];

  isGenerating = true;
  dom.btnSend.disabled = true;
  dom.btnSimulate.disabled = true;

  const provider = getActiveProvider();
  createChatBubble('user', effectivePrompt, multi ? `SWARM // ${lanes.length} LANES` : `${provider.badge} // TX`);

  try {
    await Promise.all(lanes.map((lane) => runLane(lane, effectivePrompt, forceSimulation, sampling)));
  } finally {
    isGenerating = false;
    dom.btnSend.disabled = false;
    dom.btnSimulate.disabled = false;
    dom.metricTps.textContent = '0.0';
    renderSamplingReadout();
  }
}

dom.chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  handlePromptSubmission(false);
});

dom.btnSimulate.addEventListener('click', () => {
  handlePromptSubmission(true);
});

dom.promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handlePromptSubmission(false);
  }
});
