/**
 * Short-time spectral analysis over token-indexed signals.
 *
 * The token stream is sampled once per token (not per wall-clock tick), so frequencies are in
 * cycles/token: bin k of an N-sample window corresponds to a period of N/k tokens. Low bins capture
 * slow drift (e.g. a long reasoning phase slowing down), high bins capture token-to-token jitter.
 */

const windowCache = new Map();

export function hannWindow(N) {
  let w = windowCache.get(N);
  if (!w) {
    w = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
    }
    windowCache.set(N, w);
  }
  return w;
}

/**
 * Mean-removed, Hann-windowed real DFT power spectrum.
 * @param {ArrayLike<number>} samples length N (N ≥ 4)
 * @returns {Float64Array} N/2 + 1 power bins; bin 0 (DC) is ~0 after mean removal
 */
export function powerSpectrum(samples) {
  const N = samples.length;
  const half = Math.floor(N / 2);
  const out = new Float64Array(half + 1);
  if (N < 4) return out;

  let mean = 0;
  for (let i = 0; i < N; i++) mean += samples[i];
  mean /= N;

  const w = hannWindow(N);
  const x = new Float64Array(N);
  for (let i = 0; i < N; i++) x[i] = (samples[i] - mean) * w[i];

  for (let k = 0; k <= half; k++) {
    let re = 0;
    let im = 0;
    const step = (-2 * Math.PI * k) / N;
    for (let i = 0; i < N; i++) {
      const ang = step * i;
      re += x[i] * Math.cos(ang);
      im += x[i] * Math.sin(ang);
    }
    out[k] = (re * re + im * im) / N;
  }
  return out;
}

/**
 * Splits non-DC bins 1..N/2 into `nBands` contiguous bands and sums the power in each.
 * Band edges are chosen so every band receives at least one bin whenever nBands ≤ N/2.
 */
export function bandEnergies(power, nBands) {
  const bins = power.length - 1;
  const bands = new Float64Array(nBands);
  if (bins <= 0) return bands;
  for (let b = 0; b < nBands; b++) {
    const start = 1 + Math.floor((b * bins) / nBands);
    const end = Math.max(start + 1, 1 + Math.floor(((b + 1) * bins) / nBands));
    for (let k = start; k < end && k <= bins; k++) bands[b] += power[k];
  }
  return bands;
}

/** Power-weighted mean bin index normalized to [0, 1] over non-DC bins. */
export function spectralCentroid(power) {
  const bins = power.length - 1;
  if (bins <= 0) return 0;
  let num = 0;
  let den = 0;
  for (let k = 1; k <= bins; k++) {
    num += k * power[k];
    den += power[k];
  }
  if (den <= 1e-12) return 0;
  return bins === 1 ? 0 : (num / den - 1) / (bins - 1);
}

/**
 * Wiener entropy: geometric mean / arithmetic mean of non-DC power, in [0, 1].
 * ~1 for white noise (no structure), → 0 for a single dominant periodicity.
 */
export function spectralFlatness(power) {
  const bins = power.length - 1;
  if (bins <= 0) return 0;
  const eps = 1e-12;
  let logSum = 0;
  let sum = 0;
  for (let k = 1; k <= bins; k++) {
    logSum += Math.log(power[k] + eps);
    sum += power[k];
  }
  const arith = sum / bins;
  if (arith <= eps) return 0;
  return Math.min(1, Math.exp(logSum / bins) / (arith + eps));
}

export function normalize(vec) {
  let s = 0;
  for (let i = 0; i < vec.length; i++) s += vec[i];
  const out = new Float64Array(vec.length);
  if (s <= 1e-12) {
    out.fill(1 / vec.length);
    return out;
  }
  for (let i = 0; i < vec.length; i++) out[i] = vec[i] / s;
  return out;
}

/**
 * Sheet energy matrix E[k1][k2] = T̂[k1] · Ĉ[k2], where T̂ and Ĉ are the normalized timing and
 * content band energies — the joint mode distribution if the two channels were independent. Row k1
 * is the timing rhythm mode, column k2 the information-density mode, so an n-degree Fermat surface
 * with n² sheets holds exactly the outer product of two n-band spectra.
 */
export function sheetEnergyMatrix(timingBands, contentBands) {
  const n = timingBands.length;
  const t = normalize(timingBands);
  const c = normalize(contentBands);
  const m = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) m[i * n + j] = t[i] * c[j];
  }
  return normalize(m);
}

export function argmax(vec) {
  let best = 0;
  for (let i = 1; i < vec.length; i++) if (vec[i] > vec[best]) best = i;
  return best;
}
