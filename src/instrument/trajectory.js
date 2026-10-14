import { evaluateCalabiYauPoint, unitToParam } from './manifoldMath.js';
import {
  evaluateDimensionalPoint,
  estimateCorrelationDimension,
  estimateLyapunovExponent,
} from '../dimensions/dimensionalEngine.js';

/**
 * Tracks the path a generation traces on the Fermat surface (or any selected N-dimensional space)
 * and measures its geometry in R⁴ (x, y, z, w4) — the full point before the 3D projection drops w4.
 */
export class TrajectoryTracker {
  constructor({ maxPoints = 768 } = {}) {
    this.maxPoints = maxPoints;
    this.reset();
  }

  reset() {
    this.points = [];
    this.arcLength = 0;
    this.turningSum = 0;
    this.angleSum = 0;
    this.turningCount = 0;
    this.windingAngle = 0;
    this.sheetTransitions = 0;
    this.prevArg = null;
    this.prevSheet = null;
    this._cachedDim = 0;
    this._cachedLyap = 0;
    this._cachedDimAt = 0;
  }

  /**
   * @param {{u:number, v:number, k1:number, k2:number, n:number, xi:number, spaceId?:string}} coords
   *   u, v ∈ [0,1] are unit surface coordinates; (k1, k2) selects the sheet.
   */
  push({ u, v, k1, k2, n, xi, spaceId = 'calabi-yau-6d' }) {
    const [a, b] = unitToParam(u, v);
    const pt =
      !spaceId || spaceId === 'calabi-yau-6d'
        ? evaluateCalabiYauPoint(a, b, k1, k2, n, xi)
        : evaluateDimensionalPoint(spaceId, u, v, k1, k2, n, xi);
    const p = [pt.x, pt.y, pt.z, pt.w4];
    const sheet = k1 * n + k2;

    const len = this.points.length;
    if (len >= 1) {
      const prev = this.points[len - 1].p;
      const seg = sub(p, prev);
      const segLen = norm(seg);
      this.arcLength += segLen;

      if (len >= 2) {
        const prevSeg = sub(prev, this.points[len - 2].p);
        const prevLen = norm(prevSeg);
        if (segLen > 1e-6 && prevLen > 1e-6) {
          const cos = Math.max(-1, Math.min(1, dot(seg, prevSeg) / (segLen * prevLen)));
          const angle = Math.acos(cos);
          this.turningSum += angle / ((segLen + prevLen) * 0.5);
          this.angleSum += angle;
          this.turningCount += 1;
        }
      }
    }

    const arg = Math.atan2(pt.z1[1], pt.z1[0]);
    if (this.prevArg !== null) this.windingAngle += wrapAngle(arg - this.prevArg);
    this.prevArg = arg;

    if (this.prevSheet !== null && sheet !== this.prevSheet) this.sheetTransitions += 1;
    this.prevSheet = sheet;

    const point = { a, b, u, v, k1, k2, sheet, p };
    this.points.push(point);
    if (this.points.length > this.maxPoints) this.points.shift();
    return point;
  }

  metrics() {
    if (!this._cachedDim || this.points.length - (this._cachedDimAt || 0) >= 8) {
      this._cachedDim = estimateCorrelationDimension(this.points);
      this._cachedLyap = estimateLyapunovExponent(this.points);
      this._cachedDimAt = this.points.length;
    }
    return {
      points: this.points.length,
      arcLength: this.arcLength,
      meanCurvature: this.turningCount > 0 ? this.turningSum / this.turningCount : 0,
      meanTurningAngle: this.turningCount > 0 ? this.angleSum / this.turningCount : 0,
      winding: this.windingAngle / (2 * Math.PI),
      sheetTransitions: this.sheetTransitions,
      correlationDimension: this._cachedDim,
      lyapunovExponent: this._cachedLyap,
    };
  }

  /** Uniformly resamples the stored path (by index) to at most `m` R⁴ points. */
  resample(m = 64) {
    const pts = this.points;
    if (pts.length <= m) return pts.map((q) => q.p.slice());
    const out = [];
    for (let i = 0; i < m; i++) {
      const idx = Math.round((i * (pts.length - 1)) / (m - 1));
      out.push(pts[idx].p.slice());
    }
    return out;
  }
}

/**
 * Discrete Fréchet distance between two polylines (Eiter & Mannila). Both paths should be
 * resampled to bounded length first; cost is O(|P|·|Q|).
 */
export function discreteFrechet(P, Q) {
  if (!P.length || !Q.length) return Infinity;
  const m = Q.length;
  let prev = new Float64Array(m);
  let cur = new Float64Array(m);
  for (let i = 0; i < P.length; i++) {
    for (let j = 0; j < m; j++) {
      const d = norm(sub(P[i], Q[j]));
      if (i === 0 && j === 0) cur[j] = d;
      else if (i === 0) cur[j] = Math.max(cur[j - 1], d);
      else if (j === 0) cur[j] = Math.max(prev[0], d);
      else cur[j] = Math.max(Math.min(prev[j], prev[j - 1], cur[j - 1]), d);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[m - 1];
}

export function wrapAngle(x) {
  let y = x;
  while (y > Math.PI) y -= 2 * Math.PI;
  while (y <= -Math.PI) y += 2 * Math.PI;
  return y;
}

function sub(p, q) {
  return [p[0] - q[0], p[1] - q[1], p[2] - q[2], p[3] - q[3]];
}

function dot(p, q) {
  return p[0] * q[0] + p[1] * q[1] + p[2] * q[2] + p[3] * q[3];
}

function norm(p) {
  return Math.sqrt(dot(p, p));
}
