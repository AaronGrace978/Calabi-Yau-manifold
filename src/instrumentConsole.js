import {
  InferenceInstrument,
  STATE_DIMENSIONS,
  FingerprintStore,
  fingerprintDistance,
  InterferenceField,
  ControlSurface,
  LANE_COLORS,
  hexToRgb,
  MANIFOLD_SCALE,
} from './instrument/index.js';

const HEAT_STOPS = [
  [0.02, 0.05, 0.12],
  [0.0, 0.55, 0.85],
  [0.55, 0.32, 1.0],
  [1.0, 0.12, 0.6],
  [1.0, 0.85, 0.2],
];

function heatColor(t) {
  const x = Math.max(0, Math.min(0.9999, t)) * (HEAT_STOPS.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = HEAT_STOPS[i];
  const b = HEAT_STOPS[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

function rgbCss([r, g, b], alpha = 1) {
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`;
}

function fmt(v, d = 3) {
  return Number.isFinite(v) ? v.toFixed(d) : '—';
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Owns live runs, routes stream frames into the analysis core, drives the manifold and renders
 * the instrument HUD.
 */
export class InstrumentConsole {
  constructor({ canvas, dom, onTelemetry }) {
    this.canvas = canvas;
    this.dom = dom;
    this.onTelemetry = onTelemetry;
    this.store = new FingerprintStore();
    this.control = new ControlSurface();
    this.field = new InterferenceField();
    this.runs = new Map();
    this.focusRunId = null;
    this.latestFingerprint = this.store.list()[0] || null;
    this.referenceId = null;
    this.lastInterference = null;
    this.takeovers = [];
    this.regimeLog = [];
    this.renderQueued = false;

    this.bindControls();
    this.syncControlInputs();
    this.renderAll();
  }

  get n() {
    return this.canvas.exponentN;
  }

  get xi() {
    return this.canvas.projectionAngle;
  }

  /** Begins a run; returns its id. */
  startRun({ provider, model, label, color, tMs = 0 }) {
    const runId = `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const instrument = new InferenceInstrument({
      runId,
      provider,
      model,
      label,
      color: color || LANE_COLORS[this.runs.size % LANE_COLORS.length],
      n: this.n,
      xi: this.xi,
    });
    instrument.start(tMs);
    if (this.activeRuns().length === 0) {
      for (const [id, r] of this.runs) if (r.finished) this.runs.delete(id);
      this.field.reset();
      this.lastInterference = null;
      this.takeovers = [];
      this.canvas.clearTrajectories();
    }
    this.runs.set(runId, instrument);
    this.focusRunId = runId;
    this.scheduleRender();
    return runId;
  }

  activeRuns() {
    return [...this.runs.values()].filter((r) => !r.finished);
  }

  pushToken(runId, { token, thinking = false, tMs }) {
    const inst = this.runs.get(runId);
    if (!inst || inst.finished || !token) return null;
    inst.setGeometry({ n: this.n, xi: this.xi });
    const frame = inst.push({ token, thinking, tMs });

    for (const ev of frame.events) {
      this.regimeLog.push({ ...ev, label: ev.label, run: inst.label, color: inst.color });
    }
    if (this.regimeLog.length > 60) this.regimeLog.splice(0, this.regimeLog.length - 60);

    this.canvas.setTrajectory(
      runId,
      inst.trajectory.points.map((p) => [p.p[0] * MANIFOLD_SCALE, p.p[1] * MANIFOLD_SCALE, p.p[2] * MANIFOLD_SCALE]),
      inst.color
    );

    const live = this.activeRuns();
    if (live.length > 1) {
      const nowMs = Math.max(...live.map((r) => r.lastMs ?? 0));
      const res = this.field.update(live, nowMs);
      if (res) {
        this.lastInterference = res;
        for (const ev of res.events) this.takeovers.push(ev);
        if (this.takeovers.length > 12) this.takeovers.shift();
        let amplitude = 0;
        let frequency = 0;
        let saturation = 0;
        res.lanes.forEach((lane) => {
          const f = this.runs.get(lane.runId).lastFrame;
          amplitude += lane.share * f.amplitude;
          frequency += lane.share * f.frequency;
          saturation += lane.share * f.saturation;
        });
        this.canvas.applyInstrumentFrame({
          amplitude,
          frequency,
          saturation,
          sheet: res.sheet,
          sheetColor: res.sheetColor,
        });
      }
    } else {
      this.canvas.applyInstrumentFrame({
        amplitude: frame.amplitude,
        frequency: frame.frequency,
        saturation: frame.saturation,
        sheet: frame.sheet,
        sheetColor: this.heatSheetColors(frame.sheet),
      });
    }

    this.focusRunId = runId;
    this.onTelemetry?.(frame, inst);
    this.scheduleRender();
    return frame;
  }

  finishRun(runId) {
    const inst = this.runs.get(runId);
    if (!inst || inst.finished) return null;
    if (inst.acc.tokens < 4) {
      inst.finished = true;
      this.runs.delete(runId);
      this.scheduleRender();
      return null;
    }
    const fp = inst.finish();
    this.store.save(fp);
    const loop = this.control.observe(fp, { actuated: !String(fp.model).endsWith('[sim]') });
    this.latestFingerprint = fp;
    this.lastLoop = loop;
    this.scheduleRender();
    return fp;
  }

  heatSheetColors(sheet) {
    const count = sheet.length;
    const out = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const c = heatColor(Math.min(1, (sheet[i] * count) / 3));
      out[i * 3] = c[0];
      out[i * 3 + 1] = c[1];
      out[i * 3 + 2] = c[2];
    }
    return out;
  }

  /** Sampling parameters for the next request, or null when the control surface is off. */
  samplingParams() {
    return this.control.samplingParams();
  }

  /** Best provider/model for the current target, if auto-route is enabled and history exists. */
  routeSuggestion() {
    if (this.control.mode === 'off') return null;
    const real = this.store.list().filter((fp) => !String(fp.model).endsWith('[sim]'));
    return this.control.route(real)[0] || null;
  }

  // ---------------------------------------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------------------------------------

  bindControls() {
    const d = this.dom;
    d.sheetHeatmap.addEventListener('click', (e) => {
      const rect = d.sheetHeatmap.getBoundingClientRect();
      const n = this.n;
      const col = Math.floor(((e.clientX - rect.left) / rect.width) * n);
      const row = Math.floor(((e.clientY - rect.top) / rect.height) * n);
      if (this.control.mode === 'off') this.control.setMode('open');
      this.control.setTarget({ n, k1: row, k2: col });
      this.syncControlInputs();
      this.scheduleRender();
    });

    d.controlMode.addEventListener('change', () => {
      this.control.setMode(d.controlMode.value);
      this.scheduleRender();
    });
    d.controlAmplitude.addEventListener('input', () => {
      this.control.setTarget({ amplitude: parseFloat(d.controlAmplitude.value) });
      d.valControlAmplitude.textContent = fmt(this.control.target.amplitude, 2);
      this.scheduleRender();
    });
    d.controlAutoRoute.addEventListener('change', () => {
      this.control.setAutoRoute(d.controlAutoRoute.checked);
      this.scheduleRender();
    });
    d.btnControlReset.addEventListener('click', () => {
      this.control.bias = 0;
      this.control.penalty = 0;
      this.control.persist();
      this.scheduleRender();
    });

    d.btnExportFingerprints.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(this.store.list(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `calabi-yau-fingerprints-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    });
    d.btnClearFingerprints.addEventListener('click', () => {
      this.store.clear();
      this.latestFingerprint = null;
      this.referenceId = null;
      this.scheduleRender();
    });
    d.btnExportState.addEventListener('click', () => {
      const inst = this.runs.get(this.focusRunId);
      const payload = {
        dimensions: STATE_DIMENSIONS,
        state: inst ? inst.stateVector() : null,
        run: inst ? { runId: inst.runId, provider: inst.provider, model: inst.model } : null,
        fingerprint: this.latestFingerprint,
      };
      navigator.clipboard?.writeText(JSON.stringify(payload, null, 2));
      d.btnExportState.textContent = 'COPIED';
      setTimeout(() => {
        d.btnExportState.textContent = 'COPY STATE JSON';
      }, 1200);
    });
  }

  syncControlInputs() {
    const d = this.dom;
    d.controlMode.value = this.control.mode;
    d.controlAmplitude.value = String(this.control.target.amplitude);
    d.valControlAmplitude.textContent = fmt(this.control.target.amplitude, 2);
    d.controlAutoRoute.checked = this.control.autoRoute;
  }

  // ---------------------------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------------------------

  scheduleRender() {
    if (this.renderQueued) return;
    this.renderQueued = true;
    requestAnimationFrame(() => {
      this.renderQueued = false;
      this.renderAll();
    });
  }

  renderAll() {
    const inst = this.runs.get(this.focusRunId) || null;
    const frame = inst?.lastFrame || null;
    this.renderStatus(inst);
    this.renderHeatmap(frame);
    this.renderBands(frame);
    this.renderState(inst);
    this.renderGeometry(frame);
    this.renderRegimes();
    this.renderInterference();
    this.renderControl();
    this.renderFingerprints();
  }

  renderStatus(inst) {
    const live = this.activeRuns();
    const d = this.dom;
    if (live.length > 1) d.instrumentStatus.textContent = `SWARM // ${live.length} LANES`;
    else if (live.length === 1) d.instrumentStatus.textContent = `LIVE // ${live[0].acc.tokens} TOK`;
    else if (inst) d.instrumentStatus.textContent = `HOLD // ${inst.acc.tokens} TOK`;
    else d.instrumentStatus.textContent = 'IDLE';
    d.instrumentStatus.classList.toggle('live', live.length > 0);
  }

  renderHeatmap(frame) {
    const cvs = this.dom.sheetHeatmap;
    const ctx = cvs.getContext('2d');
    const n = this.n;
    const W = cvs.width;
    const H = cvs.height;
    ctx.clearRect(0, 0, W, H);
    const cw = W / n;
    const ch = H / n;

    const multi = this.activeRuns().length > 1 && this.lastInterference?.sheet.length === n * n;
    const sheet = multi ? this.lastInterference.sheet : frame?.n === n ? frame.sheet : null;
    const colors = multi ? this.lastInterference.sheetColor : null;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const idx = i * n + j;
        const r = sheet ? sheet[idx] * n * n : 0;
        const t = Math.min(1, r / 3);
        let c = heatColor(t);
        if (colors && sheet) {
          const lane = [colors[idx * 3], colors[idx * 3 + 1], colors[idx * 3 + 2]];
          const lit = Math.min(1, r / 2);
          c = lane.map((v) => v * (0.2 + 0.8 * lit));
        }
        ctx.fillStyle = rgbCss(sheet ? c : [0.03, 0.06, 0.12]);
        ctx.fillRect(j * cw + 1, i * ch + 1, cw - 2, ch - 2);
      }
    }

    if (frame && !multi && frame.n === n) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      ctx.strokeRect(frame.k2 * cw + 2, frame.k1 * ch + 2, cw - 4, ch - 4);
    }

    if (this.control.mode !== 'off') {
      const t = this.control.target;
      const row = Math.round((t.n > 1 ? t.k1 / (t.n - 1) : 0.5) * (n - 1));
      const col = Math.round((t.n > 1 ? t.k2 / (t.n - 1) : 0.5) * (n - 1));
      ctx.strokeStyle = '#ff1e9b';
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 2;
      ctx.strokeRect(col * cw + 4, row * ch + 4, cw - 8, ch - 8);
      ctx.setLineDash([]);
    }
  }

  renderBands(frame) {
    const cvs = this.dom.bandSpectra;
    const ctx = cvs.getContext('2d');
    const W = cvs.width;
    const H = cvs.height;
    ctx.clearRect(0, 0, W, H);
    if (!frame) return;
    const rows = [
      { bands: frame.timingBands, color: '#00f3ff', label: 'T' },
      { bands: frame.contentBands, color: '#ff1e9b', label: 'C' },
    ];
    const rowH = H / 2;
    rows.forEach((row, r) => {
      const n = row.bands.length;
      const bw = (W - 14) / n;
      ctx.fillStyle = '#7b96b8';
      ctx.font = '9px monospace';
      ctx.fillText(row.label, 0, r * rowH + rowH * 0.65);
      for (let k = 0; k < n; k++) {
        const h = Math.min(1, row.bands[k] * 2) * (rowH - 4);
        ctx.fillStyle = row.color;
        ctx.globalAlpha = 0.35 + 0.65 * Math.min(1, row.bands[k] * 2);
        ctx.fillRect(14 + k * bw + 1, r * rowH + rowH - 2 - h, bw - 2, h);
      }
      ctx.globalAlpha = 1;
    });
  }

  renderState(inst) {
    const body = this.dom.stateVector;
    const vec = inst ? inst.stateVector() : STATE_DIMENSIONS.map(() => 0);
    if (body.childElementCount !== STATE_DIMENSIONS.length) {
      body.innerHTML = '';
      STATE_DIMENSIONS.forEach((dim, i) => {
        const row = el('div', 'state-row');
        row.title = dim.desc;
        row.append(el('span', 'state-idx', String(i + 1).padStart(2, '0')));
        row.append(el('span', 'state-key', dim.label));
        row.append(el('span', 'state-val', '0.000'));
        body.append(row);
      });
    }
    STATE_DIMENSIONS.forEach((dim, i) => {
      const v = vec[i];
      body.children[i].children[2].textContent = dim.key === 'sheet' ? `${v} / ${this.n * this.n}` : fmt(v);
    });
  }

  renderGeometry(frame) {
    const g = frame?.geometry;
    this.dom.trajectoryMetrics.innerHTML = '';
    const items = [
      ['ARC LENGTH (R⁴)', g ? fmt(g.arcLength, 2) : '—'],
      ['MEAN TURN / STEP', g ? `${fmt(g.meanTurningAngle, 3)} rad` : '—'],
      ['WINDING (arg z₁)', g ? fmt(g.winding, 2) : '—'],
      ['SHEET TRANSITIONS', g ? String(g.sheetTransitions) : '—'],
      ['FLATNESS φ_T / φ_C', frame ? `${fmt(frame.timingFlatness, 2)} / ${fmt(frame.contentFlatness, 2)}` : '—'],
      ['ACTIVE REGIMES', frame?.activeRegimes.length ? frame.activeRegimes.join(', ') : 'nominal'],
    ];
    for (const [k, v] of items) {
      const row = el('div', 'kv-row');
      row.append(el('span', 'kv-key', k), el('span', 'kv-val', v));
      this.dom.trajectoryMetrics.append(row);
    }
  }

  renderRegimes() {
    const box = this.dom.regimeLog;
    box.innerHTML = '';
    const items = [...this.regimeLog].slice(-8).reverse();
    if (!items.length) {
      box.append(el('div', 'regime-empty', 'No regime events yet. Stream a response to begin.'));
      return;
    }
    for (const ev of items) {
      const row = el('div', `regime-row ${ev.state}`);
      const dot = el('span', 'regime-dot');
      dot.style.background = ev.color;
      row.append(
        dot,
        el('span', 'regime-label', `${ev.label}${ev.state === 'exit' ? ' (cleared)' : ''}`),
        el('span', 'regime-meta', `#${ev.index}`)
      );
      row.title = `${ev.run} — value ${fmt(ev.value, 3)}`;
      box.append(row);
    }
  }

  renderInterference() {
    const box = this.dom.interferencePanel;
    box.innerHTML = '';
    const res = this.lastInterference;
    if (!res || res.lanes.length < 2) {
      box.append(
        el('div', 'regime-empty', 'Add 2+ lanes in SWARM LANES to superpose models on shared sheets.')
      );
      return;
    }
    for (const lane of res.lanes) {
      const row = el('div', 'lane-share-row');
      const label = el('span', 'lane-share-label', lane.label);
      label.style.color = lane.color;
      const track = el('div', 'lane-share-track');
      const fill = el('div', 'lane-share-fill');
      fill.style.width = `${(lane.share * 100).toFixed(1)}%`;
      fill.style.background = lane.color;
      track.append(fill);
      row.append(label, track, el('span', 'lane-share-val', `${(lane.share * 100).toFixed(0)}%`));
      box.append(row);
    }
    const coh = el('div', 'kv-row');
    coh.append(el('span', 'kv-key', 'COHERENCE (Bhattacharyya)'), el('span', 'kv-val', fmt(res.coherence, 3)));
    box.append(coh);
    for (const ov of res.overlaps) {
      const a = this.runs.get(ov.a)?.label ?? ov.a;
      const b = this.runs.get(ov.b)?.label ?? ov.b;
      const row = el('div', 'kv-row');
      row.append(el('span', 'kv-key', `${a} ∩ ${b}`), el('span', 'kv-val', fmt(ov.overlap, 3)));
      box.append(row);
    }
    for (const ev of this.takeovers.slice(-3).reverse()) {
      box.append(el('div', 'takeover-row', `TAKEOVER → ${ev.toLabel} (${(ev.share * 100).toFixed(0)}%)`));
    }
  }

  renderControl() {
    const d = this.dom;
    const params = this.control.samplingParams();
    const t = this.control.target;
    if (!params) {
      d.controlReadout.textContent = 'Control surface OFF — click a sheet to set a target.';
    } else {
      const loop = this.control.mode === 'closed' ? ` · bias ${this.control.bias >= 0 ? '+' : ''}${fmt(this.control.bias, 2)}` : '';
      d.controlReadout.textContent =
        `target σ=(${t.k1},${t.k2})/${t.n} → T=${fmt(params.temperature, 2)} top_p=${fmt(params.topP, 2)} ` +
        `penalty=${fmt(params.repetitionPenalty, 2)}${loop}`;
    }

    d.routeList.innerHTML = '';
    if (this.control.mode === 'off') return;
    const ranking = this.control.route(this.store.list()).slice(0, 3);
    const pick = this.control.autoRoute ? this.routeSuggestion() : null;
    if (!ranking.length) {
      d.routeList.append(el('div', 'regime-empty', 'Routing needs stored fingerprints. Run a few models first.'));
      return;
    }
    ranking.forEach((r) => {
      const row = el('div', 'kv-row');
      row.append(
        el('span', 'kv-key', `${pick && pick.provider === r.provider && pick.model === r.model ? '▶ ' : ''}${r.provider} / ${r.model}`),
        el('span', 'kv-val', `${fmt(r.score, 3)} (${r.samples})`)
      );
      d.routeList.append(row);
    });
  }

  renderFingerprints() {
    const box = this.dom.fingerprintList;
    box.innerHTML = '';
    const items = this.store.list();
    const latest = this.latestFingerprint;
    if (!items.length) {
      box.append(el('div', 'regime-empty', 'Fingerprints are stored when a run completes.'));
      this.dom.fingerprintCompare.textContent = '';
      return;
    }
    for (const fp of items.slice(0, 10)) {
      const row = el('div', `fp-row${fp.id === this.referenceId ? ' selected' : ''}${fp.id === latest?.id ? ' latest' : ''}`);
      const swatch = el('span', 'fp-swatch');
      swatch.style.background = this.fingerprintSwatch(fp);
      const dist = latest && fp.id !== latest.id ? fingerprintDistance(latest, fp).total : null;
      row.append(
        swatch,
        el('span', 'fp-label', `${fp.model}`),
        el('span', 'fp-meta', `${fp.tokens}t · ${fmt(fp.stats.tokensPerSec, 0)}/s`),
        el('span', 'fp-dist', dist === null ? (fp.id === latest?.id ? 'LATEST' : '—') : `d=${fmt(dist, 3)}`)
      );
      row.title = `${fp.provider} / ${fp.model}\nTTFT ${fmt(fp.stats.ttftMs, 0)} ms · median Δt ${fmt(
        fp.stats.medianDtMs,
        1
      )} ms\nentropy ${fmt(fp.stats.meanEntropy, 2)} b/char · repetition ${fmt(fp.stats.repetition, 2)}\nwinding ${fmt(
        fp.geometry?.winding,
        2
      )} · arc ${fmt(fp.geometry?.arcLength, 2)}`;
      row.addEventListener('click', () => {
        this.referenceId = this.referenceId === fp.id ? null : fp.id;
        this.scheduleRender();
      });
      box.append(row);
    }

    const ref = items.find((x) => x.id === this.referenceId);
    if (ref && latest && ref.id !== latest.id) {
      const d = fingerprintDistance(latest, ref);
      this.dom.fingerprintCompare.textContent =
        `latest vs ${ref.model}: total ${fmt(d.total)} · spectral(JS) ${fmt(d.spectral)} · ` +
        `stats ${fmt(d.stats)} · trajectory(Fréchet) ${fmt(d.trajectory)}`;
    } else {
      this.dom.fingerprintCompare.textContent = latest
        ? 'Click a fingerprint to compare it with the latest run.'
        : '';
    }
  }

  /** A gradient swatch summarizing the fingerprint's dominant timing/content modes. */
  fingerprintSwatch(fp) {
    const b = fp.bands;
    const stops = [];
    for (let i = 0; i < b; i++) {
      let rowEnergy = 0;
      for (let j = 0; j < b; j++) rowEnergy += fp.sheet[i * b + j];
      stops.push(rgbCss(heatColor(Math.min(1, rowEnergy * b * 0.6))));
    }
    return `linear-gradient(90deg, ${stops.join(', ')})`;
  }
}

export { LANE_COLORS, hexToRgb };
