/**
 * Pure Fermat-surface math shared by the WebGL renderer and the trajectory analyzer.
 *
 * The surface is the real 2-dimensional cross-section of z1^n + z2^n = 1 parametrized by
 * w = a + i b:  z1 = cos(w)^(2/n) * e^(2πi k1/n),  z2 = sin(w)^(2/n) * e^(2πi k2/n).
 * Each (k1, k2) pair selects one of n² sheets. The point lives in C² ≅ R⁴ and is projected
 * to R³ by rotating the two imaginary parts by the phase angle ξ.
 */

export const PARAM_DOMAIN = Object.freeze({
  aMin: 0.02,
  aMax: Math.PI * 0.5 - 0.02,
  bMin: -1.15,
  bMax: 1.15,
});

export const MANIFOLD_SCALE = 1.55;
export const MAX_FERMAT_DEGREE = 7;

export function complexPowerWithSheet(re, im, exponent, sheetAngle) {
  const r = Math.hypot(re, im);
  if (r < 1e-9) return [0.0, 0.0];
  const theta = Math.atan2(im, re);
  const mag = Math.pow(r, exponent);
  const ang = theta * exponent + sheetAngle;
  return [mag * Math.cos(ang), mag * Math.sin(ang)];
}

/**
 * @returns {{x:number,y:number,z:number,w4:number,z1:[number,number],z2:[number,number]}}
 */
export function evaluateCalabiYauPoint(a, b, k1, k2, n, xi) {
  const cosRe = Math.cos(a) * Math.cosh(b);
  const cosIm = -Math.sin(a) * Math.sinh(b);
  const sinRe = Math.sin(a) * Math.cosh(b);
  const sinIm = Math.cos(a) * Math.sinh(b);

  const exp = 2.0 / n;
  const z1 = complexPowerWithSheet(cosRe, cosIm, exp, (2.0 * Math.PI * k1) / n);
  const z2 = complexPowerWithSheet(sinRe, sinIm, exp, (2.0 * Math.PI * k2) / n);

  return {
    x: z1[0],
    y: z2[0],
    z: Math.cos(xi) * z1[1] + Math.sin(xi) * z2[1],
    w4: -Math.sin(xi) * z1[1] + Math.cos(xi) * z2[1],
    z1,
    z2,
  };
}

/** Maps unit coordinates (u, v) ∈ [0,1]² to the (a, b) parameter domain. */
export function unitToParam(u, v) {
  const { aMin, aMax, bMin, bMax } = PARAM_DOMAIN;
  return [aMin + clamp01(u) * (aMax - aMin), bMin + clamp01(v) * (bMax - bMin)];
}

export function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function sheetIndex(k1, k2, n) {
  return k1 * n + k2;
}
