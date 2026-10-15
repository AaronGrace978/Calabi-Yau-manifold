import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import { appWindow } from '@tauri-apps/api/window';
import { LabViewer } from './lab/viewer.js';
import { SPACES, getSpace, defaultParams } from './lab/catalog.js';
import { createAsk } from './lab/ask.js';

const isTauri = typeof window !== 'undefined' && Boolean(window.__TAURI_IPC__ || window.__TAURI_METADATA__);
const $ = (id) => document.getElementById(id);
const STATE_KEY = 'calabi_lab_state_v1';

const dom = {
  spaceList: $('space-list'),
  viewport: $('viewport'),
  badge: $('space-badge'),
  sliceReadout: $('slice-readout'),
  toast: $('toast'),
  params: $('param-controls'),
  rotation: $('rotation-controls'),
  rot: { xw: $('rot-xw'), yw: $('rot-yw'), zw: $('rot-zw') },
  rotVal: { xw: $('val-xw'), yw: $('val-yw'), zw: $('val-zw') },
  autoSpin: $('auto-spin'),
  spinSpeed: $('spin-speed'),
  valSpeed: $('val-speed'),
  projection: $('projection'),
  sliceControls: $('slice-controls'),
  sliceOn: $('slice-on'),
  sliceLevel: $('slice-level'),
  valSlice: $('val-slice'),
  sliceOnly: $('slice-only'),
  notes: $('notes'),
  notesTitle: $('notes-title'),
  notesDim: $('notes-dim'),
  notesWhat: $('notes-what'),
  notesHow: $('notes-how'),
  notesTry: $('notes-try'),
  notesFacts: $('notes-facts'),
};

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
  } catch {
    return {};
  }
}

const saved = loadState();
const paramMemory = saved.params || {};
let current = null;
let params = {};
let geometry = null;
let rebuildTimer = null;

function persist() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify({ space: current?.id, params: paramMemory }));
  } catch {
    // Non-fatal: the lab still works without remembered settings.
  }
}

function toast(text, ms = 2600) {
  dom.toast.textContent = text;
  dom.toast.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => dom.toast.classList.add('hidden'), ms);
}

const viewer = new LabViewer(dom.viewport, {
  onFrame: (v) => {
    if (!v.slice.enabled || !current?.sliceable) return;
    if ((v.frameTick = (v.frameTick || 0) + 1) % 10) return;
    dom.sliceReadout.textContent = v.sliceCount
      ? `slice: ${v.sliceCount} segments where the hidden axis = ${v.slice.level.toFixed(2)}`
      : 'slice: empty here, move the level toward 0';
  },
});

const dock = document.querySelector('.dock');
new ResizeObserver(() => viewer.setBottomInset(dock.offsetHeight + 12)).observe(dock);

// ---------------------------------------------------------------------------
// Space list
// ---------------------------------------------------------------------------

function renderSpaceList() {
  dom.spaceList.innerHTML = '';
  const groups = [...new Set(SPACES.map((s) => s.group))];
  for (const g of groups) {
    const head = document.createElement('div');
    head.className = 'group-title';
    head.textContent = g;
    dom.spaceList.appendChild(head);
    for (const s of SPACES.filter((x) => x.group === g)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'space-btn';
      btn.dataset.id = s.id;
      btn.textContent = s.title;
      btn.addEventListener('click', () => selectSpace(s.id));
      dom.spaceList.appendChild(btn);
    }
  }
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

function renderParamControls() {
  dom.params.innerHTML = '';
  if (!current.params.length) {
    dom.params.classList.add('hidden');
    return;
  }
  dom.params.classList.remove('hidden');
  const title = document.createElement('div');
  title.className = 'dock-title';
  title.textContent = 'OBJECT';
  dom.params.appendChild(title);
  for (const p of current.params) {
    const label = document.createElement('label');
    label.className = 'ctl';
    const caption = document.createElement('span');
    const val = document.createElement('em');
    val.textContent = formatParam(p, params[p.key]);
    caption.append(`${p.label} `, val);
    const input = document.createElement('input');
    Object.assign(input, { type: 'range', min: p.min, max: p.max, step: p.step, value: params[p.key] });
    input.addEventListener('input', () => {
      params[p.key] = Number(input.value);
      paramMemory[current.id] = { ...params };
      val.textContent = formatParam(p, params[p.key]);
      scheduleRebuild();
    });
    label.append(caption, input);
    dom.params.appendChild(label);
  }
}

function formatParam(p, v) {
  return p.step < 1 ? Number(v).toFixed(2) : String(v);
}

function scheduleRebuild() {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => {
    rebuild({ keepView: true });
    persist();
  }, 60);
}

function setRotation(angles) {
  for (const k of ['xw', 'yw', 'zw']) {
    const v = angles[k] ?? 0;
    dom.rot[k].value = v;
    dom.rotVal[k].textContent = v.toFixed(2);
  }
  viewer.setAngles({ xw: angles.xw ?? 0, yw: angles.yw ?? 0, zw: angles.zw ?? 0 });
}

for (const k of ['xw', 'yw', 'zw']) {
  dom.rot[k].addEventListener('input', () => {
    const v = Number(dom.rot[k].value);
    dom.rotVal[k].textContent = v.toFixed(2);
    viewer.setAngles({ [k]: v });
  });
}

dom.autoSpin.addEventListener('change', () => viewer.setAutoSpin(dom.autoSpin.checked));
dom.spinSpeed.addEventListener('input', () => {
  dom.valSpeed.textContent = Number(dom.spinSpeed.value).toFixed(2);
  viewer.setAutoSpin(dom.autoSpin.checked, Number(dom.spinSpeed.value));
});
dom.projection.addEventListener('change', () => viewer.setProjection(dom.projection.value));

dom.sliceOn.addEventListener('change', () => {
  viewer.setSlice({ enabled: dom.sliceOn.checked });
  if (!dom.sliceOn.checked) dom.sliceReadout.textContent = '';
});
dom.sliceLevel.addEventListener('input', () => {
  dom.valSlice.textContent = Number(dom.sliceLevel.value).toFixed(2);
  viewer.setSlice({ level: Number(dom.sliceLevel.value) });
});
dom.sliceOnly.addEventListener('change', () => viewer.setSlice({ only: dom.sliceOnly.checked }));

// ---------------------------------------------------------------------------
// Selecting and rebuilding
// ---------------------------------------------------------------------------

function objectRadius(geo) {
  let r = 0;
  for (const p of geo.points) r = Math.max(r, Math.hypot(...p));
  return r || 1;
}

function rebuild({ keepView = false } = {}) {
  geometry = current.build(params);
  const dim = geometry.dim;
  const radius = objectRadius(geometry);

  dom.rotation.classList.toggle('hidden', dim < 4);
  dom.sliceControls.classList.toggle('hidden', !current.sliceable);
  const stereo = dom.projection.querySelector('option[value="stereographic"]');
  stereo.disabled = dim !== 4;
  if (dim !== 4 && dom.projection.value === 'stereographic') dom.projection.value = 'perspective';
  if (dim < 4) dom.projection.value = 'perspective';
  dom.projection.disabled = dim < 4;

  const limit = Math.ceil(radius * 105) / 100;
  dom.sliceLevel.min = -limit;
  dom.sliceLevel.max = limit;
  if (Math.abs(Number(dom.sliceLevel.value)) > limit) {
    dom.sliceLevel.value = 0;
    viewer.setSlice({ level: 0 });
    dom.valSlice.textContent = '0.00';
  }

  const view = keepView ? { x: viewer.view.x, y: viewer.view.y } : null;
  viewer.setObject(geometry, { projection: dom.projection.value, faceOn: current.id === 'e8' });
  if (view) {
    viewer.view.x = view.x;
    viewer.view.y = view.y;
  }
  renderNotes();
}

function selectSpace(id) {
  current = getSpace(id);
  params = { ...defaultParams(current), ...(paramMemory[current.id] || {}) };
  for (const btn of dom.spaceList.querySelectorAll('.space-btn')) btn.classList.toggle('active', btn.dataset.id === current.id);

  dom.projection.value = current.projection;
  dom.autoSpin.checked = current.autoSpin;
  viewer.setAutoSpin(current.autoSpin, Number(dom.spinSpeed.value));
  setRotation(current.initialAngles || {});
  dom.sliceOn.checked = false;
  dom.sliceOnly.checked = false;
  viewer.setSlice({ enabled: false, only: false, level: 0 });
  dom.sliceLevel.value = 0;
  dom.valSlice.textContent = '0.00';
  dom.sliceReadout.textContent = '';

  renderParamControls();
  rebuild();
  persist();
  if (location.hash.slice(1) !== current.id) history.replaceState(null, '', `#${current.id}`);
}

function renderNotes() {
  const n = current.notes;
  dom.badge.textContent = current.badge(params);
  dom.notesTitle.textContent = current.title;
  dom.notesDim.textContent = `${current.group} · drawn from ${geometry.dim} dimensions · ${geometry.points.length.toLocaleString()} points, ${geometry.edges.length.toLocaleString()} edges`;
  dom.notesWhat.textContent = n.what;
  dom.notesHow.textContent = n.how;
  dom.notesTry.innerHTML = '';
  for (const t of n.tryThis) {
    const li = document.createElement('li');
    li.textContent = t;
    dom.notesTry.appendChild(li);
  }
  dom.notesFacts.innerHTML = '';
  for (const [k, v] of current.facts(params, geometry)) {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    dom.notesFacts.append(dt, dd);
  }
}

// ---------------------------------------------------------------------------
// Snapshot, notes toggle, window chrome
// ---------------------------------------------------------------------------

$('btn-snapshot').addEventListener('click', async () => {
  const dataUrl = viewer.snapshot();
  const name = `${current.id}-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
  if (isTauri) {
    try {
      const path = await invoke('save_snapshot', { name, dataUrl });
      toast(`Saved ${path}`);
    } catch (err) {
      toast(`Snapshot failed: ${err}`);
    }
    return;
  }
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = name;
  a.click();
  toast(`Downloaded ${name}`);
});

$('btn-toggle-notes').addEventListener('click', () => {
  document.body.classList.toggle('notes-hidden');
});

if (isTauri) {
  $('window-controls').classList.remove('hidden');
  $('win-min').addEventListener('click', () => appWindow.minimize());
  $('win-max').addEventListener('click', () => appWindow.toggleMaximize());
  $('win-close').addEventListener('click', () => appWindow.close());
} else {
  document.body.classList.add('browser');
}

// ---------------------------------------------------------------------------
// Ask
// ---------------------------------------------------------------------------

createAsk({
  dom: {
    provider: $('ask-provider'),
    model: $('ask-model'),
    customModel: $('ask-custom-model'),
    key: $('ask-key'),
    endpoint: $('ask-endpoint'),
    sync: $('btn-sync-models'),
    settings: $('ask-settings'),
    settingsToggle: $('btn-ask-settings'),
    log: $('ask-log'),
    form: $('ask-form'),
    input: $('ask-input'),
    send: $('ask-send'),
  },
  tauri: isTauri ? { invoke, listen } : null,
  knownIds: SPACES.map((s) => s.id),
  getContext: () => ({
    title: current.title,
    settings: [
      ...current.params.map((p) => `${p.label} = ${params[p.key]}`),
      `rotation x↔w ${dom.rot.xw.value}, y↔w ${dom.rot.yw.value}, z↔w ${dom.rot.zw.value}`,
      `projection ${dom.projection.value}`,
      dom.sliceOn.checked ? `slice at ${dom.sliceLevel.value}` : 'no slice',
    ].join('; '),
    facts: current
      .facts(params, geometry)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join('\n'),
  }),
  onToken: () => viewer.pulse(0.06),
  onShow: (id) => {
    if (id !== current.id) {
      selectSpace(id);
      toast(`Showing ${getSpace(id).title}`);
    }
  },
});

const spaceFromHash = () => {
  const id = decodeURIComponent(location.hash.slice(1));
  return SPACES.some((s) => s.id === id) ? id : null;
};
window.addEventListener('hashchange', () => {
  const id = spaceFromHash();
  if (id && id !== current?.id) selectSpace(id);
});

renderSpaceList();
selectSpace(spaceFromHash() || saved.space || 'calabi-yau');
