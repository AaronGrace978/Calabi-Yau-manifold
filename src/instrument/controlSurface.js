import { FP_BANDS, jensenShannonDistance } from './fingerprint.js';

const STORAGE_KEY = 'calabi_yau_control_surface_v1';
const BIAS_LIMIT = 0.8;
const LOOP_GAIN = 0.8;

/**
 * Inverse map from geometric targets to generation parameters.
 *
 * - Content axis (sheet column k2): desired information-density centroid c* = k2/(n−1).
 *   Actuated through sampling: temperature = 0.2 + c* + bias, top_p = 0.75 + 0.25·c*.
 *   In closed-loop mode the bias integrates (c* − measured c_C) after every run, so the
 *   mapping calibrates itself per provider/model instead of trusting the open-loop guess.
 * - Timing axis (sheet row k1) and target amplitude: properties of the serving stack, not of
 *   sampling, so they are actuated by routing — choose the provider/model whose stored
 *   fingerprints sit closest to the target sheet distribution and throughput.
 * - Regime reactions: repetition / mode collapse raise the repetition penalty for the next
 *   request; each clean run halves it again.
 */
export class ControlSurface {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.mode = 'off';
    this.target = { k1: 2, k2: 2, n: 5, amplitude: 0.35 };
    this.bias = 0;
    this.penalty = 0;
    this.autoRoute = false;
    this.history = [];
    this.load();
  }

  load() {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (['off', 'open', 'closed'].includes(s.mode)) this.mode = s.mode;
      if (s.target) this.target = { ...this.target, ...s.target };
      if (Number.isFinite(s.bias)) this.bias = s.bias;
      if (Number.isFinite(s.penalty)) this.penalty = s.penalty;
      this.autoRoute = Boolean(s.autoRoute);
    } catch {
      // Corrupt state is ignored; defaults apply.
    }
  }

  persist() {
    try {
      this.storage?.setItem(
        STORAGE_KEY,
        JSON.stringify({
          mode: this.mode,
          target: this.target,
          bias: this.bias,
          penalty: this.penalty,
          autoRoute: this.autoRoute,
        })
      );
    } catch {
      // Ignore quota errors.
    }
  }

  setMode(mode) {
    this.mode = mode;
    this.persist();
  }

  setTarget(patch) {
    this.target = { ...this.target, ...patch };
    const n = this.target.n;
    this.target.k1 = Math.max(0, Math.min(n - 1, this.target.k1));
    this.target.k2 = Math.max(0, Math.min(n - 1, this.target.k2));
    this.persist();
  }

  setAutoRoute(v) {
    this.autoRoute = Boolean(v);
    this.persist();
  }

  get contentTarget() {
    const { k2, n } = this.target;
    return n > 1 ? k2 / (n - 1) : 0.5;
  }

  get timingTarget() {
    const { k1, n } = this.target;
    return n > 1 ? k1 / (n - 1) : 0.5;
  }

  /** @returns {null | {temperature:number, topP:number, repetitionPenalty:number}} */
  samplingParams() {
    if (this.mode === 'off') return null;
    const c = this.contentTarget;
    const bias = this.mode === 'closed' ? this.bias : 0;
    return {
      temperature: round(clamp(0.2 + c + bias, 0, 2), 3),
      topP: round(clamp(0.75 + 0.25 * c, 0.05, 1), 3),
      repetitionPenalty: round(clamp(this.penalty, 0, 1.5), 3),
    };
  }

  /** Target sheet distribution at fingerprint resolution: a Gaussian blob around (k1, k2). */
  targetDistribution(bands = FP_BANDS) {
    const scale = bands > 1 ? (bands - 1) : 1;
    const c1 = this.timingTarget * scale;
    const c2 = this.contentTarget * scale;
    const sigma = 0.8;
    const out = new Float64Array(bands * bands);
    let sum = 0;
    for (let i = 0; i < bands; i++) {
      for (let j = 0; j < bands; j++) {
        const v = Math.exp(-((i - c1) ** 2 + (j - c2) ** 2) / (2 * sigma * sigma));
        out[i * bands + j] = v;
        sum += v;
      }
    }
    for (let i = 0; i < out.length; i++) out[i] /= sum;
    return out;
  }

  /**
   * Ranks provider/model pairs by how close their stored fingerprints sit to the target.
   * @returns {Array<{provider:string, model:string, score:number, samples:number}>}
   */
  route(fingerprints) {
    const target = this.targetDistribution();
    const groups = new Map();
    for (const fp of fingerprints) {
      if (!fp?.sheet || fp.sheet.length !== target.length) continue;
      const spectral = jensenShannonDistance(target, fp.sheet);
      const amp = estimatedAmplitude(fp);
      const score = 0.7 * spectral + 0.3 * Math.min(1, Math.abs(amp - this.target.amplitude) / 0.6);
      const key = `${fp.provider}\u0001${fp.model}`;
      const g = groups.get(key) || { provider: fp.provider, model: fp.model, total: 0, samples: 0 };
      g.total += score;
      g.samples += 1;
      groups.set(key, g);
    }
    return [...groups.values()]
      .map((g) => ({ provider: g.provider, model: g.model, score: g.total / g.samples, samples: g.samples }))
      .sort((a, b) => a.score - b.score);
  }

  /**
   * Closed-loop update after a run completes. `actuated` is false when the run could not have
   * responded to the sampling parameters (e.g. the offline simulator), so the integrator holds.
   */
  observe(fingerprint, { actuated = true } = {}) {
    const measured = fingerprint.stats.contentCentroid;
    const error = this.contentTarget - measured;
    if (this.mode === 'closed' && actuated && fingerprint.tokens >= 16) {
      this.bias = clamp(this.bias + LOOP_GAIN * error, -BIAS_LIMIT, BIAS_LIMIT);
    }
    const unhealthy = (fingerprint.regimes?.repetition || 0) + (fingerprint.regimes?.['mode-collapse'] || 0);
    if (this.mode !== 'off') {
      this.penalty = unhealthy > 0 ? clamp(this.penalty + 0.3, 0, 1.5) : this.penalty * 0.5;
    }
    const entry = { error, measured, target: this.contentTarget, bias: this.bias, penalty: this.penalty };
    this.history.push(entry);
    if (this.history.length > 32) this.history.shift();
    this.persist();
    return entry;
  }
}

/** Rough amplitude a fingerprint would drive: 0.05 + 0.6·tanh(infoRate/80). */
export function estimatedAmplitude(fp) {
  const s = fp.stats || {};
  const infoRate = (s.tokensPerSec || 0) * (s.meanChars || 0) * 0.6;
  return 0.05 + 0.6 * Math.tanh(infoRate / 80);
}

function clamp(x, lo, hi) {
  return x < lo ? lo : x > hi ? hi : x;
}

function round(v, d) {
  const m = 10 ** d;
  return Math.round(v * m) / m;
}
