import { discreteFrechet } from './trajectory.js';

/**
 * Fingerprints are always computed at a fixed reference resolution so runs captured while the
 * viewport was showing a different Fermat degree remain comparable.
 */
export const FP_BANDS = 7;
export const FP_REFERENCE = Object.freeze({ n: 5, xi: 0.68 });
const STORAGE_KEY = 'calabi_yau_fingerprints_v1';
const MAX_STORED = 40;

/** Jensen–Shannon distance (sqrt of base-2 JS divergence), bounded to [0, 1]. */
export function jensenShannonDistance(p, q) {
  const n = Math.min(p.length, q.length);
  let js = 0;
  for (let i = 0; i < n; i++) {
    const m = 0.5 * (p[i] + q[i]);
    if (p[i] > 0 && m > 0) js += 0.5 * p[i] * Math.log2(p[i] / m);
    if (q[i] > 0 && m > 0) js += 0.5 * q[i] * Math.log2(q[i] / m);
  }
  return Math.sqrt(Math.max(0, Math.min(1, js)));
}

/** Bhattacharyya coefficient Σ√(p·q) ∈ [0, 1]: 1 = identical distributions. */
export function bhattacharyya(p, q) {
  const n = Math.min(p.length, q.length);
  let s = 0;
  for (let i = 0; i < n; i++) s += Math.sqrt(Math.max(0, p[i]) * Math.max(0, q[i]));
  return Math.min(1, s);
}

export function statsVector(stats) {
  return [
    Math.min(1, Math.max(0, Math.log10(Math.max(1, stats.medianDtMs)) / 3)),
    Math.min(1, stats.meanChars / 8),
    Math.min(1, stats.meanEntropy / 6),
    stats.repetition,
    stats.thinkingRatio,
    stats.timingCentroid,
    stats.contentCentroid,
    stats.contentFlatness,
  ];
}

/**
 * @returns {{total:number, spectral:number, stats:number, trajectory:number}} each in [0, 1]
 */
export function fingerprintDistance(a, b) {
  const spectral = jensenShannonDistance(a.sheet, b.sheet);
  const va = statsVector(a.stats);
  const vb = statsVector(b.stats);
  let s = 0;
  for (let i = 0; i < va.length; i++) s += (va[i] - vb[i]) ** 2;
  const stats = Math.sqrt(s / va.length);
  const trajectory =
    a.trajectory?.length && b.trajectory?.length
      ? Math.min(1, discreteFrechet(a.trajectory, b.trajectory) / 2)
      : stats;
  return {
    total: 0.5 * spectral + 0.25 * stats + 0.25 * trajectory,
    spectral,
    stats,
    trajectory,
  };
}

export class FingerprintStore {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
  }

  list() {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  save(fp) {
    const items = this.list().filter((x) => x.id !== fp.id);
    items.unshift(fp);
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_STORED)));
    } catch {
      // Storage quota exceeded; the fingerprint stays usable in memory.
    }
    return fp;
  }

  remove(id) {
    const items = this.list().filter((x) => x.id !== id);
    this.storage?.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  clear() {
    this.storage?.removeItem(STORAGE_KEY);
  }

  /** Stored fingerprints ranked by distance to `fp` (excluding itself). */
  rank(fp) {
    return this.list()
      .filter((x) => x.id !== fp.id)
      .map((x) => ({ fingerprint: x, distance: fingerprintDistance(fp, x) }))
      .sort((p, q) => p.distance.total - q.distance.total);
  }
}
