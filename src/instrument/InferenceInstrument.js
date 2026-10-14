import { TokenFeatureExtractor } from './tokenFeatures.js';
import {
  argmax,
  bandEnergies,
  normalize,
  powerSpectrum,
  sheetEnergyMatrix,
  spectralCentroid,
  spectralFlatness,
} from './spectral.js';
import { TrajectoryTracker } from './trajectory.js';
import { RegimeDetector, median } from './regimes.js';
import { FP_BANDS, FP_REFERENCE } from './fingerprint.js';
import { clamp01, MANIFOLD_SCALE } from './manifoldMath.js';

/**
 * The instrument's state space. Every dimension is a defined, measured function of the stream
 * (or of the display geometry), so the vector can be logged, exported and compared.
 */
export const STATE_DIMENSIONS = Object.freeze([
  { key: 'x', label: 'x', desc: 'trajectory head, projected surface x' },
  { key: 'y', label: 'y', desc: 'trajectory head, projected surface y' },
  { key: 'z', label: 'z', desc: 'trajectory head, projected surface z' },
  { key: 'xi', label: 'ξ', desc: 'C² → R³ projection phase (rad)' },
  { key: 'sheet', label: 'σ', desc: 'active sheet k1·n + k2 (dominant timing × content mode)' },
  { key: 'amplitude', label: 'A', desc: 'information throughput: 0.05 + 0.6·tanh(infoRate/80)' },
  { key: 'frequency', label: 'f', desc: 'timing spectral centroid → ripple: 0.9 + 3·c_T' },
  { key: 'saturation', label: 'S', desc: 'rolling char entropy / 5 bits' },
  { key: 'timingCentroid', label: 'c_T', desc: 'spectral centroid of log inter-token interval' },
  { key: 'contentCentroid', label: 'c_C', desc: 'spectral centroid of information density' },
  { key: 'contentFlatness', label: 'φ_C', desc: 'Wiener entropy of information density (1 = noise)' },
]);

const DEFAULT_WINDOW = 32;
const MIN_SPECTRUM_SAMPLES = 8;
const COORD_SMOOTHING = 0.25;
const SHEET_EMA = 0.05;

export class InferenceInstrument {
  constructor({
    runId = `run-${Date.now().toString(36)}`,
    provider = 'unknown',
    model = 'unknown',
    label = '',
    color = '#00f3ff',
    windowSize = DEFAULT_WINDOW,
    n = 5,
    xi = 0.68,
  } = {}) {
    this.runId = runId;
    this.provider = provider;
    this.model = model;
    this.label = label || `${provider}/${model}`;
    this.color = color;
    this.windowSize = windowSize;
    this.n = n;
    this.xi = xi;

    this.features = new TokenFeatureExtractor();
    this.regimes = new RegimeDetector();
    this.trajectory = new TrajectoryTracker();
    this.referenceTrajectory = new TrajectoryTracker();

    this.timingRing = [];
    this.contentRing = [];
    this.coord = null;
    this.logDtMean = null;
    this.logDtVar = 1;
    this.emaSheet = null;

    this.acc = {
      tokens: 0,
      thinkingTokens: 0,
      chars: 0,
      entropy: 0,
      repetition: 0,
      timingCentroid: 0,
      contentCentroid: 0,
      contentFlatness: 0,
      spectralFrames: 0,
      sheet: new Float64Array(FP_BANDS * FP_BANDS),
      timing: new Float64Array(FP_BANDS),
      content: new Float64Array(FP_BANDS),
      dts: [],
      ttftMs: null,
    };

    this.startMs = null;
    this.lastMs = null;
    this.lastFrame = null;
    this.finished = false;
  }

  start(tMs) {
    this.startMs = tMs;
    this.features.reset(tMs);
  }

  setGeometry({ n = this.n, xi = this.xi } = {}) {
    if (n === this.n && Math.abs(xi - this.xi) < 1e-6) return;
    this.n = n;
    this.xi = xi;
    this.emaSheet = null;
    this.trajectory.reset();
  }

  push({ token, thinking = false, tMs }) {
    if (this.startMs === null) this.start(tMs);
    const f = this.features.push({ token, thinking, tMs });
    this.lastMs = tMs;

    if (f.isFirst) {
      this.acc.ttftMs = f.dtMs;
    } else {
      pushRing(this.timingRing, f.logDt, this.windowSize);
      this.acc.dts.push(f.dtMs);
      if (this.logDtMean === null) this.logDtMean = f.logDt;
      const d = f.logDt - this.logDtMean;
      this.logDtMean += d * 0.08;
      this.logDtVar += (d * d - this.logDtVar) * 0.08;
    }
    pushRing(this.contentRing, f.info, this.windowSize);

    const n = this.n;
    const haveSpectrum =
      this.timingRing.length >= MIN_SPECTRUM_SAMPLES && this.contentRing.length >= MIN_SPECTRUM_SAMPLES;

    let timingBands = new Float64Array(n).fill(1 / n);
    let contentBands = new Float64Array(n).fill(1 / n);
    let timingCentroid = 0;
    let contentCentroid = 0;
    let timingFlatness = 1;
    let contentFlatness = 1;
    let sheetShift = 0;
    let sheet;

    if (haveSpectrum) {
      const tSpec = powerSpectrum(this.timingRing);
      const cSpec = powerSpectrum(this.contentRing);
      timingBands = bandEnergies(tSpec, n);
      contentBands = bandEnergies(cSpec, n);
      timingCentroid = spectralCentroid(tSpec);
      contentCentroid = spectralCentroid(cSpec);
      timingFlatness = spectralFlatness(tSpec);
      contentFlatness = spectralFlatness(cSpec);
      sheet = sheetEnergyMatrix(timingBands, contentBands);

      const refSheet = sheetEnergyMatrix(bandEnergies(tSpec, FP_BANDS), bandEnergies(cSpec, FP_BANDS));
      addInto(this.acc.sheet, refSheet);
      addInto(this.acc.timing, normalize(bandEnergies(tSpec, FP_BANDS)));
      addInto(this.acc.content, normalize(bandEnergies(cSpec, FP_BANDS)));
      this.acc.timingCentroid += timingCentroid;
      this.acc.contentCentroid += contentCentroid;
      this.acc.contentFlatness += contentFlatness;
      this.acc.spectralFrames += 1;

      if (!this.emaSheet || this.emaSheet.length !== sheet.length) {
        this.emaSheet = Float64Array.from(sheet);
      } else {
        for (let i = 0; i < sheet.length; i++) {
          sheetShift += Math.abs(sheet[i] - this.emaSheet[i]);
          this.emaSheet[i] += (sheet[i] - this.emaSheet[i]) * SHEET_EMA;
        }
      }
    } else {
      sheet = new Float64Array(n * n).fill(1 / (n * n));
    }

    const k1 = argmax(timingBands);
    const k2 = argmax(contentBands);
    const [p1, p2] = trigramProjection(token);
    const entropyNorm = clamp01((f.entropy - 2.0) / 3.0);
    const timingZ = this.logDtMean === null ? 0 : (f.logDt - this.logDtMean) / Math.sqrt(this.logDtVar + 1e-6);
    const uRaw = clamp01(0.7 * entropyNorm + 0.3 * (0.5 + 0.5 * p1));
    const vRaw = clamp01(0.7 * sigmoid(f.isFirst ? 0 : timingZ) + 0.3 * (0.5 + 0.5 * p2));
    if (!this.coord) this.coord = { u: uRaw, v: vRaw };
    this.coord.u += (uRaw - this.coord.u) * COORD_SMOOTHING;
    this.coord.v += (vRaw - this.coord.v) * COORD_SMOOTHING;

    const point = this.trajectory.push({ u: this.coord.u, v: this.coord.v, k1, k2, n, xi: this.xi });
    const refK1 = Math.min(FP_REFERENCE.n - 1, Math.floor((k1 * FP_REFERENCE.n) / n));
    const refK2 = Math.min(FP_REFERENCE.n - 1, Math.floor((k2 * FP_REFERENCE.n) / n));
    this.referenceTrajectory.push({
      u: this.coord.u,
      v: this.coord.v,
      k1: refK1,
      k2: refK2,
      n: FP_REFERENCE.n,
      xi: FP_REFERENCE.xi,
    });

    const events = this.regimes.update(f, { sheetShift });

    const amplitude = 0.05 + 0.6 * Math.tanh(f.infoRate / 80);
    const frequency = 0.9 + 3.0 * timingCentroid;
    const saturation = clamp01(f.entropy / 5.0);

    this.acc.tokens += 1;
    if (thinking) this.acc.thinkingTokens += 1;
    this.acc.chars += f.chars;
    this.acc.entropy += f.entropy;
    this.acc.repetition += f.repetition;

    const state = {
      x: point.p[0] * MANIFOLD_SCALE,
      y: point.p[1] * MANIFOLD_SCALE,
      z: point.p[2] * MANIFOLD_SCALE,
      xi: this.xi,
      sheet: k1 * n + k2,
      amplitude,
      frequency,
      saturation,
      timingCentroid,
      contentCentroid,
      contentFlatness,
    };

    this.lastFrame = {
      runId: this.runId,
      features: f,
      n,
      sheet,
      timingBands: normalize(timingBands),
      contentBands: normalize(contentBands),
      k1,
      k2,
      amplitude,
      frequency,
      saturation,
      timingCentroid,
      contentCentroid,
      timingFlatness,
      contentFlatness,
      sheetShift,
      point,
      events,
      state,
      geometry: this.trajectory.metrics(),
      activeRegimes: [...this.regimes.active],
    };
    return this.lastFrame;
  }

  stateVector() {
    const s = this.lastFrame?.state;
    return STATE_DIMENSIONS.map((d) => (s ? s[d.key] : 0));
  }

  /** Builds the persistent generation fingerprint for this run. */
  finish({ id, createdAt = Date.now() } = {}) {
    this.finished = true;
    const a = this.acc;
    const frames = Math.max(1, a.spectralFrames);
    const tokens = Math.max(1, a.tokens);
    const durationMs = this.startMs !== null && this.lastMs !== null ? this.lastMs - this.startMs : 0;
    const regimeCounts = {};
    for (const ev of this.regimes.events) {
      if (ev.state !== 'exit') regimeCounts[ev.type] = (regimeCounts[ev.type] || 0) + 1;
    }

    return {
      id: id || `${this.runId}-${createdAt.toString(36)}`,
      runId: this.runId,
      label: this.label,
      provider: this.provider,
      model: this.model,
      color: this.color,
      createdAt,
      tokens: a.tokens,
      durationMs,
      bands: FP_BANDS,
      sheet: Array.from(normalize(a.spectralFrames ? a.sheet : new Float64Array(FP_BANDS * FP_BANDS).fill(1))),
      timingSpectrum: Array.from(normalize(a.spectralFrames ? a.timing : new Float64Array(FP_BANDS).fill(1))),
      contentSpectrum: Array.from(normalize(a.spectralFrames ? a.content : new Float64Array(FP_BANDS).fill(1))),
      stats: {
        ttftMs: a.ttftMs ?? 0,
        medianDtMs: median(a.dts),
        tokensPerSec: durationMs > 0 ? (a.tokens - 1) / (durationMs / 1000) : 0,
        meanChars: a.chars / tokens,
        meanEntropy: a.entropy / tokens,
        repetition: a.repetition / tokens,
        thinkingRatio: a.thinkingTokens / tokens,
        timingCentroid: a.timingCentroid / frames,
        contentCentroid: a.contentCentroid / frames,
        contentFlatness: a.spectralFrames ? a.contentFlatness / frames : 1,
      },
      geometry: this.referenceTrajectory.metrics(),
      trajectory: this.referenceTrajectory.resample(64).map((p) => p.map((v) => round(v, 5))),
      regimes: regimeCounts,
    };
  }
}

/**
 * Deterministic 2D projection of a token's character trigrams: each trigram hashes (FNV-1a) to a
 * unit vector; the token maps to their mean, which lies in the unit disk.
 */
export function trigramProjection(token) {
  const text = token || '';
  if (text.length < 3) return [0, 0];
  let sx = 0;
  let sy = 0;
  let count = 0;
  for (let i = 0; i + 3 <= text.length; i++) {
    let h = 0x811c9dc5;
    for (let j = i; j < i + 3; j++) {
      h ^= text.charCodeAt(j);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    const ang = (h / 4294967296) * 2 * Math.PI;
    sx += Math.cos(ang);
    sy += Math.sin(ang);
    count += 1;
  }
  return [sx / count, sy / count];
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

function pushRing(ring, v, size) {
  ring.push(v);
  if (ring.length > size) ring.shift();
}

function addInto(target, src) {
  for (let i = 0; i < target.length; i++) target[i] += src[i];
}

function round(v, digits) {
  const m = 10 ** digits;
  return Math.round(v * m) / m;
}
