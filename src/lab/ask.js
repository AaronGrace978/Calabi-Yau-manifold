import { AI_PROVIDERS } from '../providers.js';

const CONFIG_PREFIX = 'calabi_lab_provider_';
const ACTIVE_KEY = 'calabi_lab_active_provider';
const HISTORY_TURNS = 4;

function loadConfig(id) {
  try {
    return JSON.parse(localStorage.getItem(CONFIG_PREFIX + id) || '{}');
  } catch {
    return {};
  }
}

function saveConfig(id, patch) {
  try {
    localStorage.setItem(CONFIG_PREFIX + id, JSON.stringify({ ...loadConfig(id), ...patch }));
  } catch {
    // Storage can be unavailable (private mode); settings then last for the session only.
  }
}

/** Extracts `{ token, thinking }` from one streamed JSON chunk of any supported provider. */
export function extractToken(parsed) {
  if (typeof parsed.response === 'string' && parsed.response) return { token: parsed.response, thinking: false };
  if (parsed.message?.content) return { token: parsed.message.content, thinking: false };
  if (parsed.message?.thinking) return { token: parsed.message.thinking, thinking: true };
  const delta = parsed.choices?.[0]?.delta;
  if (delta?.content) return { token: delta.content, thinking: false };
  if (delta?.reasoning_content) return { token: delta.reasoning_content, thinking: true };
  if (parsed.delta?.text) return { token: parsed.delta.text, thinking: false };
  if (parsed.delta?.thinking) return { token: parsed.delta.thinking, thinking: true };
  const part = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
  if (part) return { token: part, thinking: false };
  return { token: '', thinking: false };
}

/** Request body for browser mode; mirrors `stream::build_payload_with_system` in Rust. */
export function buildPayload(providerId, model, prompt, system) {
  if (providerId === 'google') {
    return { contents: [{ role: 'user', parts: [{ text: prompt }] }], systemInstruction: { parts: [{ text: system }] }, generationConfig: { temperature: 0.4 } };
  }
  if (providerId === 'anthropic') {
    return { model, max_tokens: 1200, stream: true, system, temperature: 0.4, messages: [{ role: 'user', content: prompt }] };
  }
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: prompt },
  ];
  if (providerId === 'ollama-cloud' || providerId === 'ollama-local') {
    return { model, messages, stream: true, think: false, options: { temperature: 0.4 } };
  }
  return { model, messages, stream: true, temperature: 0.4 };
}

const VALID_RESONANCE_PRESETS = new Set([
  'default',
  'string_harmonics',
  'e8_symphony',
  'minor_chord',
  'major_chord',
  'clifford_torus',
  'kaluza_klein',
  'calabi_yau',
]);

/** Finds a trailing `SHOW: <id>` line and returns the id if it names a known space. */
export function parseShowDirective(text, knownIds) {
  const match = text.match(/^\s*SHOW:\s*([a-z0-9-]+)\s*$/im);
  if (!match) return null;
  const id = match[1].toLowerCase();
  return knownIds.includes(id) ? id : null;
}

/**
 * Parses a `PLAY_RESONANCE: { preset: 'string_harmonics', dimension: N }` directive from model text.
 * Supports both strict JSON and unquoted-key / single-quoted JS object literal syntax.
 */
export function parseResonanceDirective(text) {
  if (typeof text !== 'string') return null;
  const match = text.match(/^\s*PLAY_RESONANCE:\s*(\{[^\r\n]+\})\s*$/im);
  if (!match) return null;
  const raw = match[1].trim();

  // Normalize relaxed JS literal `{ preset: 'string_harmonics', dimension: 6 }` into valid JSON
  const normalizedJson = raw
    .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"')
    .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

  let parsed;
  try {
    parsed = JSON.parse(normalizedJson);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

  const presetRaw = typeof parsed.preset === 'string' ? parsed.preset.trim().toLowerCase().replace(/-/g, '_') : '';
  if (!VALID_RESONANCE_PRESETS.has(presetRaw)) return null;

  const out = { preset: presetRaw };
  if (parsed.dimension !== undefined) {
    const dim = Number(parsed.dimension);
    if (!Number.isFinite(dim)) return null;
    out.dimension = Math.max(2, Math.min(11, Math.round(dim)));
  }
  if (typeof parsed.sliceLevel === 'number' && Number.isFinite(parsed.sliceLevel)) {
    out.sliceLevel = Math.max(-1.5, Math.min(1.5, parsed.sliceLevel));
  }
  if (parsed.angles && typeof parsed.angles === 'object' && !Array.isArray(parsed.angles)) {
    const angles = {};
    for (const k of ['xw', 'yw', 'zw']) {
      if (Number.isFinite(Number(parsed.angles[k]))) angles[k] = Number(parsed.angles[k]);
    }
    if (Object.keys(angles).length) out.angles = angles;
  }
  return out;
}

function formatAudioState(audio) {
  if (!audio) return '';
  if (typeof audio === 'string') return `Audio synthesizer state: ${audio}`;
  const status = audio.enabled ? 'ACTIVE' : 'MUTED';
  const parts = [
    `status=${status}`,
    `preset=${audio.preset || 'default'}`,
    `dimension=${audio.dimension ?? 4}D`,
    `baseFrequency=${audio.baseFrequency ?? 110}Hz`,
    `lowpassCutoff=${audio.cutoffFrequency ?? 2400}Hz (Q=${audio.filterQ ?? 2.2})`,
  ];
  if (typeof audio.sliceVelocity === 'number') parts.push(`sliceVelocity=${audio.sliceVelocity}`);
  if (Array.isArray(audio.voiceFrequencies) && audio.voiceFrequencies.length) {
    parts.push(`overtones=[${audio.voiceFrequencies.join(', ')}]Hz`);
  }
  return `Audio synthesizer state: ${parts.join(', ')}.`;
}

export function systemPrompt(context, knownIds) {
  const blocks = [
    'You are the guide inside Calabi-Yau Lab, a desktop tool and Synesthesia Engine for seeing and hearing higher-dimensional geometry.',
    `The user is looking at: ${context.title}. Settings: ${context.settings}.`,
    `Facts shown on screen:\n${context.facts}`,
  ];
  if (context.audio) {
    blocks.push(formatAudioState(context.audio));
  }
  blocks.push(
    'Answer accurately and plainly, in under 180 words unless asked for more. Use the on-screen object as your example.',
    'Separate established mathematics from speculative physics, and say when something is speculative.',
    `If a different object in the lab would answer the question better, end with one line "SHOW: <id>" using one of: ${knownIds.join(', ')}.`,
    "If the user asks to hear, sonify, or play an acoustic harmonic configuration, end with one line \"PLAY_RESONANCE: { preset: 'string_harmonics', dimension: N }\" (valid presets: string_harmonics, e8_symphony, minor_chord, major_chord, clifford_torus, kaluza_klein, calabi_yau)."
  );
  return blocks.join('\n\n');
}

/**
 * Wires the Ask panel. `tauri` is null in the browser build.
 * @param {{dom: object, tauri: null | {invoke: Function, listen: Function}, getContext: () => object,
 *          knownIds: string[], onToken: (t: string) => void, onShow: (id: string) => void,
 *          onResonance?: (directive: object) => void}} opts
 */
export function createAsk({ dom, tauri, getContext, knownIds, onToken, onShow, onResonance }) {
  const history = [];
  let busy = false;
  let runCounter = 0;
  const listeners = new Map();

  if (tauri) {
    tauri.listen('inference-frame', (event) => {
      const p = event.payload || {};
      listeners.get(p.runId)?.(p.token || '', Boolean(p.thinking));
    });
  }

  for (const p of AI_PROVIDERS) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    dom.provider.appendChild(opt);
  }

  const provider = () => AI_PROVIDERS.find((p) => p.id === dom.provider.value) || AI_PROVIDERS[0];
  const model = () => dom.customModel.value.trim() || dom.model.value;

  function fillModels(extra = []) {
    const p = provider();
    const cfg = loadConfig(p.id);
    dom.model.innerHTML = '';
    const seen = new Set();
    for (const m of [...extra, ...p.models]) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.label || m.id;
      dom.model.appendChild(opt);
    }
    if (cfg.model && seen.has(cfg.model)) dom.model.value = cfg.model;
    dom.key.value = cfg.apiKey || '';
    dom.endpoint.value = cfg.endpoint || '';
    dom.endpoint.placeholder = p.defaultEndpoint;
    dom.customModel.value = cfg.customModel || '';
  }

  dom.provider.value = localStorage.getItem(ACTIVE_KEY) || AI_PROVIDERS[0].id;
  fillModels();

  dom.provider.addEventListener('change', () => {
    localStorage.setItem(ACTIVE_KEY, dom.provider.value);
    fillModels();
  });
  dom.model.addEventListener('change', () => saveConfig(provider().id, { model: dom.model.value }));
  dom.customModel.addEventListener('input', () => saveConfig(provider().id, { customModel: dom.customModel.value.trim() }));
  dom.key.addEventListener('input', () => saveConfig(provider().id, { apiKey: dom.key.value.trim() }));
  dom.endpoint.addEventListener('input', () => saveConfig(provider().id, { endpoint: dom.endpoint.value.trim() }));
  dom.settingsToggle.addEventListener('click', () => dom.settings.classList.toggle('hidden'));

  dom.sync.addEventListener('click', async () => {
    const p = provider();
    const label = dom.sync.textContent;
    dom.sync.textContent = 'FETCHING…';
    try {
      let found = [];
      if (tauri) {
        found = await tauri.invoke('fetch_provider_models', { provider: p.id, apiKey: dom.key.value.trim() || null, endpoint: null });
      } else if (p.tagsEndpoint) {
        const headers = dom.key.value.trim() ? { Authorization: `Bearer ${dom.key.value.trim()}` } : {};
        const res = await fetch(p.tagsEndpoint, { headers });
        if (res.ok) found = ((await res.json()).models || []).map((m) => ({ id: m.name || m.model, label: m.name || m.model }));
      }
      if (found.length) fillModels(found);
      dom.sync.textContent = found.length ? `${found.length} MODELS` : 'NO LIVE LIST';
    } catch (err) {
      dom.sync.textContent = 'FETCH FAILED';
      console.warn(err);
    } finally {
      setTimeout(() => (dom.sync.textContent = label), 1800);
    }
  });

  function bubble(role, text = '') {
    const el = document.createElement('div');
    el.className = `ask-msg ${role}`;
    el.textContent = text;
    dom.log.appendChild(el);
    dom.log.scrollTop = dom.log.scrollHeight;
    return el;
  }

  async function streamBrowser(p, prompt, system, onPiece) {
    const cfg = { key: dom.key.value.trim(), endpoint: dom.endpoint.value.trim() };
    const url = cfg.endpoint || (p.id === 'google' ? p.defaultEndpoint.replace(/models\/[^:]+:/, `models/${model()}:`) : p.defaultEndpoint);
    const headers = { 'Content-Type': 'application/json' };
    if (cfg.key) {
      if (p.id === 'anthropic') Object.assign(headers, { 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' });
      else if (p.id === 'google') headers['x-goog-api-key'] = cfg.key;
      else headers.Authorization = `Bearer ${cfg.key}`;
    }
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(buildPayload(p.id, model(), prompt, system)) });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} from ${p.badge}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line || line.startsWith(':') || line.startsWith('event:')) continue;
        const json = line.startsWith('data:') ? line.slice(5).trim() : line;
        if (!json || json === '[DONE]') continue;
        try {
          const { token, thinking } = extractToken(JSON.parse(json));
          if (token) onPiece(token, thinking);
        } catch {
          // Partial or non-JSON keep-alive line.
        }
      }
    }
  }

  async function ask(question) {
    if (busy || !question.trim()) return;
    busy = true;
    dom.send.disabled = true;
    const p = provider();
    const ctx = getContext();
    const system = systemPrompt(ctx, knownIds);
    const earlier = history.slice(-HISTORY_TURNS * 2).map((h) => `${h.role === 'user' ? 'User' : 'Guide'}: ${h.text}`).join('\n');
    const prompt = earlier ? `Earlier in this conversation:\n${earlier}\n\nUser: ${question}` : question;

    bubble('user', question);
    const out = bubble('guide');
    out.classList.add('streaming');
    let text = '';
    const onPiece = (token, thinking) => {
      if (thinking) return;
      text += token;
      out.textContent = text
        .replace(/^\s*SHOW:.*$/gim, '')
        .replace(/^\s*PLAY_RESONANCE:.*$/gim, '')
        .trim();
      dom.log.scrollTop = dom.log.scrollHeight;
      onToken(token);
    };

    try {
      if (tauri) {
        const runId = `ask-${Date.now()}-${runCounter++}`;
        listeners.set(runId, onPiece);
        try {
          await tauri.invoke('ask_model', {
            prompt,
            systemPrompt: system,
            provider: p.id,
            model: model(),
            apiKey: dom.key.value.trim() || null,
            endpoint: dom.endpoint.value.trim() || null,
            runId,
          });
        } finally {
          listeners.delete(runId);
        }
      } else {
        await streamBrowser(p, prompt, system, onPiece);
      }
      if (!text.trim()) out.textContent = '(The model returned no text.)';
      history.push({ role: 'user', text: question }, { role: 'guide', text });
      const show = parseShowDirective(text, knownIds);
      if (show) onShow(show);
      const resonance = parseResonanceDirective(text);
      if (resonance && onResonance) onResonance(resonance);
    } catch (err) {
      out.classList.add('error');
      out.textContent = `${p.badge} (${model()}): ${err?.message || err}. Open MODEL to set a key or pick another provider.`;
    } finally {
      out.classList.remove('streaming');
      busy = false;
      dom.send.disabled = false;
    }
  }

  dom.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = dom.input.value;
    dom.input.value = '';
    ask(q);
  });
  dom.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      dom.form.requestSubmit();
    }
  });

  return { ask };
}
