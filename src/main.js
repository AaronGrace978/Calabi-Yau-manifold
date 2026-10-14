import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import { appWindow } from '@tauri-apps/api/window';
import { CalabiYauCanvas } from './CalabiYauCanvas.js';

const isTauriDesktop =
  typeof window !== 'undefined' &&
  Boolean(window.__TAURI_IPC__ || window.__TAURI_METADATA__ || window.__TAURI__);

const dom = {
  viewport: document.getElementById('calabi-yau-viewport'),
  workspaceGrid: document.getElementById('workspace-grid'),
  statusBeacon: document.getElementById('status-beacon'),
  runtimeBadge: document.getElementById('hud-runtime-mode'),
  metricOmega: document.getElementById('metric-omega'),
  metricAmplitude: document.getElementById('metric-amplitude'),
  metricSaturation: document.getElementById('metric-saturation'),
  metricTps: document.getElementById('metric-tps'),
  barOmega: document.getElementById('bar-omega'),
  barAmplitude: document.getElementById('bar-amplitude'),
  manifoldEquation: document.getElementById('manifold-equation'),
  sparklineCanvas: document.getElementById('harmonic-sparkline'),
  sliderExponent: document.getElementById('slider-exponent'),
  sliderPhase: document.getElementById('slider-phase'),
  sliderResolution: document.getElementById('slider-resolution'),
  valExponent: document.getElementById('val-exponent'),
  valPhase: document.getElementById('val-phase'),
  valResolution: document.getElementById('val-resolution'),
  btnToggleLayout: document.getElementById('btn-toggle-layout'),
  btnPulseTest: document.getElementById('btn-pulse-test'),
  winMinimize: document.getElementById('win-minimize'),
  winMaximize: document.getElementById('win-maximize'),
  winClose: document.getElementById('win-close'),
  chatMessages: document.getElementById('chat-messages'),
  chatForm: document.getElementById('chat-form'),
  promptInput: document.getElementById('prompt-input'),
  modelSelect: document.getElementById('model-select'),
  btnSend: document.getElementById('btn-send'),
  btnSimulate: document.getElementById('btn-simulate'),
};

dom.runtimeBadge.textContent = isTauriDesktop ? 'TAURI // IPC READY' : 'WEBGL // STANDALONE';

const sparkCtx = dom.sparklineCanvas.getContext('2d');
const metricHistory = new Array(56).fill(0.06);

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
  for (let i = 0; i < metricHistory.length; i++) {
    const normalized = Math.min(metricHistory[i] / 3.2, 1.0);
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

let tokenTimestamps = [];

function recordTokenTimestamp() {
  const now = performance.now();
  tokenTimestamps.push(now);
  tokenTimestamps = tokenTimestamps.filter((t) => now - t <= 2000);
  const tps = tokenTimestamps.length / 2.0;
  dom.metricTps.textContent = tps.toFixed(1);
}

const calabiYau = new CalabiYauCanvas(dom.viewport, {
  onQuantumTelemetry({ metric, amplitude, saturation }) {
    dom.metricOmega.textContent = metric.toFixed(3);
    dom.metricAmplitude.textContent = amplitude.toFixed(3);
    dom.metricSaturation.textContent = (saturation * 100).toFixed(1);

    const omegaPct = Math.min(100, Math.max(4, (metric / 3.5) * 100));
    const ampPct = Math.min(100, Math.max(6, (amplitude / 0.85) * 100));
    dom.barOmega.style.width = `${omegaPct}%`;
    dom.barAmplitude.style.width = `${ampPct}%`;

    metricHistory.push(metric);
    if (metricHistory.length > 56) {
      metricHistory.shift();
    }
    renderHarmonicSparkline();

    dom.statusBeacon.classList.add('active');
    clearTimeout(dom.statusBeacon._decayTimer);
    dom.statusBeacon._decayTimer = setTimeout(() => {
      dom.statusBeacon.classList.remove('active');
    }, 180);
  },
});

const superscriptDigits = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];

dom.sliderExponent.addEventListener('input', (e) => {
  const n = parseInt(e.target.value, 10);
  dom.valExponent.textContent = `${n} (${n * n} sheets)`;
  const sup = superscriptDigits[n] || `^${n}`;
  dom.manifoldEquation.textContent = `z₁${sup} + z₂${sup} = 1`;
  calabiYau.setManifoldParameters({ exponentN: n });
});

dom.sliderPhase.addEventListener('input', (e) => {
  const xi = parseFloat(e.target.value);
  dom.valPhase.textContent = `${xi.toFixed(2)} rad`;
  calabiYau.setManifoldParameters({ projectionAngle: xi });
});

dom.sliderResolution.addEventListener('input', (e) => {
  const res = parseInt(e.target.value, 10);
  dom.valResolution.textContent = `${res}×${res}`;
  calabiYau.setManifoldParameters({ resolution: res });
});

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

let activeAssistantBubble = null;
let activeMetricBadge = null;
let isGenerating = false;

function createChatBubble(role, initialText = '', badgeText = '') {
  const article = document.createElement('article');
  article.className = `msg-bubble ${role}`;

  const meta = document.createElement('div');
  meta.className = 'msg-meta';

  const roleSpan = document.createElement('span');
  roleSpan.className = 'msg-role';
  roleSpan.textContent =
    role === 'user'
      ? 'OPERATOR // PROMPT'
      : role === 'assistant'
      ? `OLLAMA // ${dom.modelSelect.value.toUpperCase()}`
      : 'SYSTEM // ALERT';

  const metricSpan = document.createElement('span');
  metricSpan.className = 'msg-metric';
  metricSpan.textContent = badgeText;

  meta.appendChild(roleSpan);
  meta.appendChild(metricSpan);

  const content = document.createElement('div');
  content.className = 'msg-content';
  content.textContent = initialText;

  article.appendChild(meta);
  article.appendChild(content);
  dom.chatMessages.appendChild(article);
  dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;

  return { article, content, metricSpan };
}

if (isTauriDesktop) {
  listen('token-received', (event) => {
    const token =
      typeof event.payload === 'string' ? event.payload : event.payload?.response || '';
    if (activeAssistantBubble && token) {
      activeAssistantBubble.textContent += token;
      recordTokenTimestamp();
      dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
    }
  });

  listen('quantum-metric', (event) => {
    const metric = Number(event.payload);
    if (activeMetricBadge && Number.isFinite(metric)) {
      activeMetricBadge.textContent = `ω = ${metric.toFixed(3)} THz`;
    }
  });
}

/**
 * Streams a simulated Calabi-Yau theoretical physics response when Ollama is offline
 * or when the user clicks the SIMULATE button, driving real-time WebGL string vibrations.
 */
async function runSimulatedQuantumStream(promptText, targetContentEl, targetMetricEl) {
  const responseParagraph =
    `In compactified Type IIB superstring theory, the Fermat quintic Calabi-Yau threefold ` +
    `M₅ ⊂ ℂℙ⁴ defined by ∑ zᵢ⁵ = 0 exhibits vanishing first Chern class c₁(TM) = 0 and ` +
    `Euler characteristic χ = −200 (h¹¹ = 1, h²¹ = 101). Regarding "${promptText.slice(0, 64)}": ` +
    `each token emitted by the local neural transformer perturbs the Kähler moduli space ` +
    `and excites quantized closed-string vibrational harmonics across the 25 Riemann sheets.`;

  const tokens = responseParagraph.match(/\S+\s*/g) || [responseParagraph];
  let lastTick = performance.now();

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const delayMs = 22 + Math.random() * 38;
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    const now = performance.now();
    const dtSecs = Math.max(0.002, (now - lastTick) / 1000);
    lastTick = now;

    const instantTps = Math.min(120, 1.0 / dtSecs);
    const metric = Math.min(
      3.5,
      Math.max(0.15, (instantTps / 38) * (token.length / 5.2) * (0.85 + 0.35 * Math.sin(i * 0.45)))
    );

    targetContentEl.textContent += token;
    targetMetricEl.textContent = `ω = ${metric.toFixed(3)} THz [SIM]`;
    recordTokenTimestamp();
    calabiYau.triggerQuantumPulse(metric, token);
    dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
  }
}

async function handlePromptSubmission(forceSimulation = false) {
  const prompt = dom.promptInput.value.trim();
  if (!prompt && !forceSimulation) return;
  if (isGenerating) return;

  const effectivePrompt =
    prompt || 'Analyze the Ricci-flat metric spectrum of the quintic Calabi-Yau manifold.';
  dom.promptInput.value = '';

  isGenerating = true;
  dom.btnSend.disabled = true;
  dom.btnSimulate.disabled = true;

  createChatBubble('user', effectivePrompt, 'TX // UTF-8');
  const { content, metricSpan } = createChatBubble('assistant', '', 'STREAMING...');
  content.classList.add('streaming-cursor');
  activeAssistantBubble = content;
  activeMetricBadge = metricSpan;

  try {
    if (forceSimulation) {
      await runSimulatedQuantumStream(effectivePrompt, content, metricSpan);
    } else if (isTauriDesktop) {
      await invoke('generate_calabi_yau_response', {
        prompt: effectivePrompt,
        model: dom.modelSelect.value,
      });
    } else {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: dom.modelSelect.value,
          prompt: effectivePrompt,
          stream: true,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let lastTime = performance.now();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIdx).trim();
          buffer = buffer.slice(newlineIdx + 1);
          if (!line) continue;

          const parsed = JSON.parse(line);
          if (parsed.response) {
            const now = performance.now();
            const dt = Math.max(0.002, (now - lastTime) / 1000);
            lastTime = now;

            const metric = Math.min(3.5, (1.0 / dt / 42.0) * (parsed.response.length / 5.0));
            content.textContent += parsed.response;
            metricSpan.textContent = `ω = ${metric.toFixed(3)} THz`;
            recordTokenTimestamp();
            calabiYau.triggerQuantumPulse(metric, parsed.response);
            dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
          }
        }
      }
    }
  } catch (err) {
    const errMsg = String(err);
    const notice = document.createElement('div');
    notice.style.color = '#ff85a2';
    notice.style.fontSize = '11px';
    notice.style.marginBottom = '6px';
    notice.textContent = `[Ollama endpoint unreachable (${errMsg}) — engaging local Calabi-Yau quantum simulator]`;
    content.appendChild(notice);
    await runSimulatedQuantumStream(effectivePrompt, content, metricSpan);
  } finally {
    content.classList.remove('streaming-cursor');
    activeAssistantBubble = null;
    activeMetricBadge = null;
    isGenerating = false;
    dom.btnSend.disabled = false;
    dom.btnSimulate.disabled = false;
    dom.metricTps.textContent = '0.0';
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
