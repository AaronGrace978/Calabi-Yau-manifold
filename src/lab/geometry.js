/**
 * Pure N-dimensional geometry for the lab: polytopes, surfaces in R⁴, Hopf fibers,
 * rotations, projections to R³ and exact hyperplane cross-sections.
 *
 * Every object is one of two shapes:
 *   wire    { kind: 'wire', dim, points: number[][], edges: [i, j][], faces?: number[][], hue? }
 *   surface { kind: 'surface', dim: 4, points: number[][], triangles: [i, j, k][], edges: [i, j][], hue? }
 * Points are plain arrays of length `dim`. Polytopes are scaled to circumradius 1.
 */

export const PHI = (1 + Math.sqrt(5)) / 2;
const EPS = 1e-9;

// ---------------------------------------------------------------------------
// Small linear algebra helpers
// ---------------------------------------------------------------------------

export function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function norm(a) {
  return Math.sqrt(dot(a, a));
}

function scaleTo(points, radius = 1) {
  let r = 0;
  for (const p of points) r = Math.max(r, norm(p));
  const k = r > EPS ? radius / r : 1;
  return points.map((p) => p.map((x) => x * k));
}

function matMul(a, b) {
  const n = a.length;
  const out = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < n; k++) {
      const aik = a[i][k];
      if (aik === 0) continue;
      for (let j = 0; j < n; j++) out[i][j] += aik * b[k][j];
    }
  }
  return out;
}

function matVec(m, v) {
  return m.map((row) => dot(row, v));
}

function identity(n) {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
}

export function binomial(n, k) {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}

// ---------------------------------------------------------------------------
// Rotations and projections
// ---------------------------------------------------------------------------

/**
 * Builds an N×N rotation from Givens rotations applied in order.
 * @param {number} dim
 * @param {{i:number, j:number, angle:number}[]} planes
 */
export function rotationMatrix(dim, planes) {
  const m = identity(dim);
  for (const { i, j, angle } of planes) {
    if (!angle || i >= dim || j >= dim || i === j) continue;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    for (let r = 0; r < dim; r++) {
      const a = m[r][i];
      const b = m[r][j];
      m[r][i] = c * a - s * b;
      m[r][j] = s * a + c * b;
    }
  }
  return m;
}

/** Applies `m` to `p`, writing into `out` (length dim). */
export function rotateInto(m, p, out) {
  const n = p.length;
  for (let r = 0; r < n; r++) {
    let s = 0;
    const row = m[r];
    for (let c = 0; c < n; c++) s += row[c] * p[c];
    out[r] = s;
  }
  return out;
}

/**
 * Projects an N-D point to R³.
 *   orthographic: drop coordinates 3..N-1
 *   perspective:  divide by (d - x_k) for k = N-1 down to 3, like a camera in each extra axis
 *   stereographic (4D, unit sphere): (x, y, z) / (1 - w)
 * Returns [x, y, z].
 */
export function projectTo3(p, mode = 'perspective', distance = 2.4) {
  const n = p.length;
  if (n <= 3) return [p[0] || 0, p[1] || 0, n === 3 ? p[2] : 0];
  if (mode === 'orthographic') return [p[0], p[1], p[2]];
  if (mode === 'stereographic') {
    const d = Math.max(0.04, 1 - p[n - 1]);
    return [p[0] / d, p[1] / d, p[2] / d];
  }
  const q = p.slice();
  for (let k = n - 1; k >= 3; k--) {
    const f = distance / Math.max(0.2, distance - q[k]);
    for (let i = 0; i < k; i++) q[i] *= f;
  }
  return [q[0], q[1], q[2]];
}

// ---------------------------------------------------------------------------
// Graph helpers
// ---------------------------------------------------------------------------

function edgesAtDistance(points, target, tol = 1e-6) {
  const edges = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      let d2 = 0;
      for (let k = 0; k < points[i].length; k++) {
        const t = points[i][k] - points[j][k];
        d2 += t * t;
      }
      if (Math.abs(Math.sqrt(d2) - target) < tol) edges.push([i, j]);
    }
  }
  return edges;
}

function minPairDistance(points) {
  let best = Infinity;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      let d2 = 0;
      for (let k = 0; k < points[i].length; k++) {
        const t = points[i][k] - points[j][k];
        d2 += t * t;
      }
      if (d2 > EPS && d2 < best) best = d2;
    }
  }
  return Math.sqrt(best);
}

/** All triangles of the edge graph (3-cliques). These are the 2-faces of simplicial polytopes. */
export function trianglesOf(vertexCount, edges) {
  const adj = Array.from({ length: vertexCount }, () => new Set());
  for (const [a, b] of edges) {
    adj[a].add(b);
    adj[b].add(a);
  }
  const tris = [];
  for (const [a, b] of edges) {
    const i = Math.min(a, b);
    const j = Math.max(a, b);
    for (const k of adj[i]) {
      if (k > j && adj[j].has(k)) tris.push([i, j, k]);
    }
  }
  return tris;
}

// ---------------------------------------------------------------------------
// Regular polytopes
// ---------------------------------------------------------------------------

/** N-cube: 2^N vertices (±1)^N, edges flip one sign, 2-faces are squares. */
export function hypercube(dim) {
  const count = 1 << dim;
  const points = [];
  for (let m = 0; m < count; m++) {
    const p = [];
    for (let b = 0; b < dim; b++) p.push(m & (1 << b) ? 1 : -1);
    points.push(p);
  }
  const edges = [];
  for (let m = 0; m < count; m++) {
    for (let b = 0; b < dim; b++) {
      const o = m ^ (1 << b);
      if (m < o) edges.push([m, o]);
    }
  }
  const faces = [];
  for (let a = 0; a < dim; a++) {
    for (let b = a + 1; b < dim; b++) {
      const ba = 1 << a;
      const bb = 1 << b;
      for (let m = 0; m < count; m++) {
        if (m & ba || m & bb) continue;
        faces.push([m, m | ba, m | ba | bb, m | bb]);
      }
    }
  }
  return { kind: 'wire', dim, points: scaleTo(points), edges, faces, family: 'cube' };
}

/** N-simplex: N+1 mutually equidistant vertices. */
export function simplex(dim) {
  // Start from the standard basis of R^{N+1}, centre it, then express it in an orthonormal
  // basis of the hyperplane Σx = 0 via Gram-Schmidt.
  const m = dim + 1;
  const centred = [];
  for (let i = 0; i < m; i++) {
    const v = new Array(m).fill(-1 / m);
    v[i] += 1;
    centred.push(v);
  }
  const basis = [];
  for (let i = 0; i < m && basis.length < dim; i++) {
    let v = centred[i].slice();
    for (const b of basis) {
      const d = dot(v, b);
      v = v.map((x, k) => x - d * b[k]);
    }
    const n = norm(v);
    if (n > 1e-8) basis.push(v.map((x) => x / n));
  }
  const points = centred.map((v) => basis.map((b) => dot(v, b)));
  const edges = [];
  for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) edges.push([i, j]);
  const faces = trianglesOf(m, edges);
  return { kind: 'wire', dim, points: scaleTo(points), edges, faces, family: 'simplex' };
}

/** N-orthoplex (cross-polytope): ±e_i, every pair joined except antipodes. */
export function orthoplex(dim) {
  const points = [];
  for (let i = 0; i < dim; i++) {
    for (const s of [1, -1]) {
      const p = new Array(dim).fill(0);
      p[i] = s;
      points.push(p);
    }
  }
  const edges = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (Math.floor(i / 2) !== Math.floor(j / 2)) edges.push([i, j]);
    }
  }
  const faces = trianglesOf(points.length, edges);
  return { kind: 'wire', dim, points, edges, faces, family: 'orthoplex' };
}

/** 24-cell {3,4,3}: permutations of (±1, ±1, 0, 0). Self-dual, no 3D analogue. */
export function cell24() {
  const points = [];
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      for (const si of [1, -1]) {
        for (const sj of [1, -1]) {
          const p = [0, 0, 0, 0];
          p[i] = si;
          p[j] = sj;
          points.push(p);
        }
      }
    }
  }
  const scaled = scaleTo(points);
  const edges = edgesAtDistance(scaled, minPairDistance(scaled));
  return { kind: 'wire', dim: 4, points: scaled, edges, faces: trianglesOf(scaled.length, edges), cells: 24 };
}

function evenPermutations4() {
  const out = [];
  const perm = (arr, l) => {
    if (l === arr.length) {
      let inv = 0;
      for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) if (arr[i] > arr[j]) inv++;
      if (inv % 2 === 0) out.push(arr.slice());
      return;
    }
    for (let i = l; i < arr.length; i++) {
      [arr[l], arr[i]] = [arr[i], arr[l]];
      perm(arr, l + 1);
      [arr[l], arr[i]] = [arr[i], arr[l]];
    }
  };
  perm([0, 1, 2, 3], 0);
  return out;
}

/** 600-cell {3,3,5}: 120 vertices (the binary icosahedral group), 720 edges, 1200 triangles. */
export function cell600() {
  const points = [];
  for (let i = 0; i < 4; i++) {
    for (const s of [1, -1]) {
      const p = [0, 0, 0, 0];
      p[i] = s;
      points.push(p);
    }
  }
  for (let m = 0; m < 16; m++) {
    points.push([0, 1, 2, 3].map((b) => (m & (1 << b) ? 0.5 : -0.5)));
  }
  const base = [PHI / 2, 0.5, 1 / (2 * PHI), 0];
  const seen = new Set();
  for (const perm of evenPermutations4()) {
    for (let m = 0; m < 8; m++) {
      const signs = [m & 1 ? -1 : 1, m & 2 ? -1 : 1, m & 4 ? -1 : 1, 1];
      const v = [0, 0, 0, 0];
      for (let k = 0; k < 4; k++) v[perm[k]] = base[k] * signs[k];
      const key = v.map((x) => x.toFixed(6)).join(',');
      if (!seen.has(key)) {
        seen.add(key);
        points.push(v);
      }
    }
  }
  const edges = edgesAtDistance(points, 1 / PHI);
  return { kind: 'wire', dim: 4, points, edges, faces: trianglesOf(points.length, edges), cells: 600 };
}

/** Number of k-faces of the regular N-polytope families, for k = 0..N-1. */
export function fVector(family, dim) {
  const f = [];
  for (let k = 0; k < dim; k++) {
    if (family === 'cube') f.push(2 ** (dim - k) * binomial(dim, k));
    else if (family === 'simplex') f.push(binomial(dim + 1, k + 1));
    else if (family === 'orthoplex') f.push(2 ** (k + 1) * binomial(dim, k + 1));
  }
  return f;
}

/** Σ (-1)^k f_k over the boundary. Equals 1 - (-1)^N for every convex N-polytope. */
export function eulerSum(f) {
  return f.reduce((s, x, k) => s + (k % 2 === 0 ? x : -x), 0);
}

// ---------------------------------------------------------------------------
// E8 root system and its Coxeter (Petrie) plane
// ---------------------------------------------------------------------------

/** All 240 roots of E8: 112 of type (±1, ±1, 0⁶) and 128 of type (±½)⁸ with an even number of minus signs. */
export function e8Roots() {
  const roots = [];
  for (let i = 0; i < 8; i++) {
    for (let j = i + 1; j < 8; j++) {
      for (const si of [1, -1]) {
        for (const sj of [1, -1]) {
          const r = new Array(8).fill(0);
          r[i] = si;
          r[j] = sj;
          roots.push(r);
        }
      }
    }
  }
  for (let m = 0; m < 256; m++) {
    let neg = 0;
    const r = [];
    for (let b = 0; b < 8; b++) {
      const minus = (m >> b) & 1;
      neg += minus;
      r.push(minus ? -0.5 : 0.5);
    }
    if (neg % 2 === 0) roots.push(r);
  }
  return roots;
}

export const E8_SIMPLE_ROOTS = Object.freeze([
  [0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, 0.5],
  [1, 1, 0, 0, 0, 0, 0, 0],
  [-1, 1, 0, 0, 0, 0, 0, 0],
  [0, -1, 1, 0, 0, 0, 0, 0],
  [0, 0, -1, 1, 0, 0, 0, 0],
  [0, 0, 0, -1, 1, 0, 0, 0],
  [0, 0, 0, 0, -1, 1, 0, 0],
  [0, 0, 0, 0, 0, -1, 1, 0],
]);

/** Coxeter element c = s₁s₂…s₈ (product of the simple reflections). Order 30 for E8. */
export function e8CoxeterElement() {
  let c = identity(8);
  for (const a of E8_SIMPLE_ROOTS) {
    const aa = dot(a, a);
    const s = identity(8).map((row, i) => row.map((x, j) => x - (2 * a[i] * a[j]) / aa));
    c = matMul(c, s);
  }
  return c;
}

/**
 * Orthonormal basis of the invariant plane of c for eigenvalues e^{±2πi m/30}.
 * Uses the projector P = (2/30) Σ_k cos(2πmk/30) cᵏ, valid because c is orthogonal.
 */
export function e8CoxeterPlane(m = 1) {
  const c = e8CoxeterElement();
  const h = 30;
  const P = Array.from({ length: 8 }, () => new Array(8).fill(0));
  let ck = identity(8);
  for (let k = 0; k < h; k++) {
    const w = (2 / h) * Math.cos((2 * Math.PI * m * k) / h);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) P[i][j] += w * ck[i][j];
    ck = matMul(ck, c);
  }
  let best = null;
  for (let j = 0; j < 8; j++) {
    const col = P.map((row) => row[j]);
    if (!best || norm(col) > norm(best)) best = col;
  }
  const u1 = best.map((x) => x / norm(best));
  const cu = matVec(c, u1);
  const d = dot(cu, u1);
  const perp = cu.map((x, i) => x - d * u1[i]);
  const u2 = perp.map((x) => x / norm(perp));
  return [u1, u2];
}

/**
 * E8 roots expressed in a basis whose first two axes are the Coxeter plane, so the
 * orthographic view straight down the z-axis is the Petrie projection.
 */
export function e8Polytope() {
  const roots = e8Roots();
  const basis = [...e8CoxeterPlane(1), ...e8CoxeterPlane(7), ...e8CoxeterPlane(11), ...e8CoxeterPlane(13)];
  const points = scaleTo(roots.map((r) => basis.map((b) => dot(r, b))));
  const edges = [];
  for (let i = 0; i < roots.length; i++) {
    for (let j = i + 1; j < roots.length; j++) {
      if (Math.abs(dot(roots[i], roots[j]) - 1) < 1e-9) edges.push([i, j]);
    }
  }
  const radii = points.map((p) => Math.hypot(p[0], p[1]));
  const ringKeys = [...new Set(radii.map((r) => r.toFixed(4)))].sort();
  const hue = radii.map((r) => ringKeys.indexOf(r.toFixed(4)) / Math.max(1, ringKeys.length - 1));
  return { kind: 'wire', dim: 8, points, edges, roots, hue, rings: ringKeys.length };
}

// ---------------------------------------------------------------------------
// Surfaces in R⁴
// ---------------------------------------------------------------------------

/**
 * Samples patches of a parametric surface into a triangle mesh plus a wireframe.
 * @param {{f:(u:number,v:number)=>number[], hue?:number}[]} patches u, v ∈ [0, 1]
 */
export function sampleSurface(patches, steps = 24) {
  const points = [];
  const triangles = [];
  const edges = [];
  const hue = [];
  for (const patch of patches) {
    const base = points.length;
    for (let i = 0; i <= steps; i++) {
      for (let j = 0; j <= steps; j++) {
        points.push(patch.f(i / steps, j / steps));
        hue.push(patch.hue ?? -1);
      }
    }
    const at = (i, j) => base + i * (steps + 1) + j;
    for (let i = 0; i < steps; i++) {
      for (let j = 0; j < steps; j++) {
        triangles.push([at(i, j), at(i + 1, j), at(i + 1, j + 1)]);
        triangles.push([at(i, j), at(i + 1, j + 1), at(i, j + 1)]);
        edges.push([at(i, j), at(i + 1, j)]);
        edges.push([at(i, j), at(i, j + 1)]);
      }
      edges.push([at(i, steps), at(i + 1, steps)]);
      edges.push([at(steps, i), at(steps, i + 1)]);
    }
  }
  const usesHue = hue.some((h) => h >= 0);
  return { kind: 'surface', dim: 4, points, triangles, edges, hue: usesHue ? hue : null };
}

/** Flat Clifford torus on the unit 3-sphere: (cos a, sin a, cos b, sin b)/√2. */
export function cliffordTorus(steps = 32) {
  const s = Math.SQRT1_2;
  return sampleSurface(
    [
      {
        f: (u, v) => {
          const a = 2 * Math.PI * u;
          const b = 2 * Math.PI * v;
          return [s * Math.cos(a), s * Math.sin(a), s * Math.cos(b), s * Math.sin(b)];
        },
      },
    ],
    steps
  );
}

/** Klein bottle embedded in R⁴ without self-intersection. */
export function kleinBottle(steps = 36, R = 0.72, r = 0.3) {
  return sampleSurface(
    [
      {
        f: (u, v) => {
          const U = 2 * Math.PI * u;
          const V = 2 * Math.PI * v;
          return [
            (R + r * Math.cos(V)) * Math.cos(U),
            (R + r * Math.cos(V)) * Math.sin(U),
            r * Math.sin(V) * Math.cos(U / 2),
            r * Math.sin(V) * Math.sin(U / 2),
          ];
        },
      },
    ],
    steps
  );
}

function complexPow(re, im, e, extraAngle) {
  const r = Math.hypot(re, im);
  if (r < 1e-12) return [0, 0];
  const t = Math.atan2(im, re) * e + extraAngle;
  const m = Math.pow(r, e);
  return [m * Math.cos(t), m * Math.sin(t)];
}

/**
 * The complex Fermat curve z₁ⁿ + z₂ⁿ = 1 in C² ≅ R⁴ (Hanson's picture of a Calabi-Yau slice).
 * Parametrised by w = a + ib: z₁ = cos(w)^{2/n} ζ^{k₁}, z₂ = sin(w)^{2/n} ζ^{k₂}, ζ = e^{2πi/n}.
 * Each of the n² (k₁, k₂) choices is one patch. Coordinates: (Re z₁, Re z₂, Im z₁, Im z₂).
 */
export function fermatPoint(a, b, k1, k2, n) {
  const cRe = Math.cos(a) * Math.cosh(b);
  const cIm = -Math.sin(a) * Math.sinh(b);
  const sRe = Math.sin(a) * Math.cosh(b);
  const sIm = Math.cos(a) * Math.sinh(b);
  const z1 = complexPow(cRe, cIm, 2 / n, (2 * Math.PI * k1) / n);
  const z2 = complexPow(sRe, sIm, 2 / n, (2 * Math.PI * k2) / n);
  return [z1[0], z2[0], z1[1], z2[1]];
}

export function fermatSurface(n = 5, steps = 14) {
  const patches = [];
  const aMin = 0;
  const aMax = Math.PI / 2;
  const bMax = 1.2;
  for (let k1 = 0; k1 < n; k1++) {
    for (let k2 = 0; k2 < n; k2++) {
      patches.push({
        hue: (k1 * n + k2) / (n * n),
        f: (u, v) => fermatPoint(aMin + u * (aMax - aMin), -bMax + v * 2 * bMax, k1, k2, n),
      });
    }
  }
  const surface = sampleSurface(patches, steps);
  surface.points = surface.points.map((p) => p.map((x) => x * 0.95));
  return surface;
}

/** Kaluza-Klein "garden hose": a line × a circle of radius R. Shrink R and the circle disappears from view. */
export function compactCylinder(R = 0.25, steps = 40) {
  const surface = sampleSurface(
    [
      {
        f: (u, v) => {
          const t = 2 * Math.PI * v;
          return [-1.6 + 3.2 * u, R * Math.cos(t), R * Math.sin(t)];
        },
      },
    ],
    steps
  );
  surface.dim = 3;
  return surface;
}

// ---------------------------------------------------------------------------
// Hopf fibration
// ---------------------------------------------------------------------------

/**
 * Hopf fibers over points of S². A base point with polar angle θ and azimuth φ lifts to the great
 * circle (cos(θ/2) e^{i(ψ+φ/2)}, sin(θ/2) e^{i(ψ-φ/2)}), ψ ∈ [0, 2π). Fibers over one latitude
 * sweep out a torus; any two fibers are linked once.
 */
export function hopfFiber(theta, phi, psi) {
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);
  return [c * Math.cos(psi + phi / 2), c * Math.sin(psi + phi / 2), s * Math.cos(psi - phi / 2), s * Math.sin(psi - phi / 2)];
}

export function hopfFibration(latitudes = 4, perLatitude = 18, segments = 96) {
  const points = [];
  const edges = [];
  const hue = [];
  for (let l = 0; l < latitudes; l++) {
    // Latitudes near θ = π lift to fibers through the projection pole, which become huge; stop short of it.
    const theta = latitudes === 1 ? Math.PI / 2 : 0.35 + (l / (latitudes - 1)) * 1.75;
    for (let f = 0; f < perLatitude; f++) {
      const phi = (2 * Math.PI * f) / perLatitude;
      const base = points.length;
      for (let s = 0; s < segments; s++) {
        points.push(hopfFiber(theta, phi, (2 * Math.PI * s) / segments));
        hue.push((l + f / perLatitude) / latitudes);
        edges.push([base + s, base + ((s + 1) % segments)]);
      }
    }
  }
  return { kind: 'wire', dim: 4, points, edges, hue };
}

/** Linking number of two closed polygons in R³ via the discrete Gauss integral. */
export function linkingNumber(curveA, curveB) {
  let total = 0;
  const n = curveA.length;
  const m = curveB.length;
  for (let i = 0; i < n; i++) {
    const a0 = curveA[i];
    const a1 = curveA[(i + 1) % n];
    const da = [a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]];
    const am = [(a0[0] + a1[0]) / 2, (a0[1] + a1[1]) / 2, (a0[2] + a1[2]) / 2];
    for (let j = 0; j < m; j++) {
      const b0 = curveB[j];
      const b1 = curveB[(j + 1) % m];
      const db = [b1[0] - b0[0], b1[1] - b0[1], b1[2] - b0[2]];
      const r = [am[0] - (b0[0] + b1[0]) / 2, am[1] - (b0[1] + b1[1]) / 2, am[2] - (b0[2] + b1[2]) / 2];
      const rl = Math.hypot(r[0], r[1], r[2]);
      if (rl < 1e-9) continue;
      const cross = [da[1] * db[2] - da[2] * db[1], da[2] * db[0] - da[0] * db[2], da[0] * db[1] - da[1] * db[0]];
      total += (r[0] * cross[0] + r[1] * cross[1] + r[2] * cross[2]) / (rl * rl * rl);
    }
  }
  return total / (4 * Math.PI);
}

// ---------------------------------------------------------------------------
// Cross-sections
// ---------------------------------------------------------------------------

/**
 * Exact cross-section of a polygonal object with the hyperplane x_{N-1} = level.
 * `rotated` are the already-rotated N-D points; `polygons` are faces or triangles.
 * Each polygon that crosses the hyperplane contributes one segment between its two crossing points.
 * Returns segments as pairs of N-D points (the last coordinate equals `level`).
 */
export function sliceByLastAxis(rotated, polygons, level) {
  const segments = [];
  if (!polygons || !rotated.length) return segments;
  const n = rotated[0].length;
  const last = n - 1;
  for (const poly of polygons) {
    const hits = [];
    for (let e = 0; e < poly.length; e++) {
      const a = rotated[poly[e]];
      const b = rotated[poly[(e + 1) % poly.length]];
      const da = a[last] - level;
      const db = b[last] - level;
      if ((da > 0 && db > 0) || (da < 0 && db < 0)) continue;
      if (Math.abs(da - db) < 1e-12) continue;
      const t = da / (da - db);
      if (t < 0 || t > 1) continue;
      const p = new Array(n);
      for (let k = 0; k < n; k++) p[k] = a[k] + t * (b[k] - a[k]);
      p[last] = level;
      if (!hits.some((h) => h.every((x, k) => Math.abs(x - p[k]) < 1e-9))) hits.push(p);
    }
    if (hits.length === 2) segments.push(hits);
  }
  return segments;
}

// ---------------------------------------------------------------------------
// Synesthesia Feature-Extraction Matrix
// ---------------------------------------------------------------------------

/**
 * Channel layout for the normalized [0, 1] 16-element feature vector (`features.vector`).
 * Indices 0..7 carry the 8-band N-dimensional depth harmonic distribution;
 * indices 8..15 carry normalized geometric, projection-distance, and slicing telemetry.
 */
export const FEATURE_CHANNELS = Object.freeze({
  DEPTH_BAND_0: 0,
  DEPTH_BAND_1: 1,
  DEPTH_BAND_2: 2,
  DEPTH_BAND_3: 3,
  DEPTH_BAND_4: 4,
  DEPTH_BAND_5: 5,
  DEPTH_BAND_6: 6,
  DEPTH_BAND_7: 7,
  MEAN_PROJ_DISTANCE: 8,
  SPREAD_PROJ_DISTANCE: 9,
  SLICE_VELOCITY: 10,
  SLICE_SPEED: 11,
  SLICE_LEVEL_NORM: 12,
  VERTEX_DENSITY: 13,
  EDGE_DENSITY: 14,
  ACTIVE_SLICE_RATIO: 15,
});

const DEPTH_BAND_COUNT = 8;
const MAX_REF_VERTICES = 2048; // 11-cube vertex ceiling
const MAX_REF_EDGES = 11264;   // 11-cube edge ceiling

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/**
 * Computes the projection origin in R^N for the active projection mode.
 * - perspective: camera sits at `cameraDistance` along every extra axis k >= 3
 * - stereographic: north pole (0, ..., 0, 1)
 * - orthographic (or dim <= 3): origin (0, ..., 0)
 */
export function projectionOrigin(dim, mode = 'perspective', cameraDistance = 2.4) {
  const origin = new Array(dim).fill(0);
  if (dim <= 3 || mode === 'orthographic') return origin;
  if (mode === 'stereographic') {
    origin[dim - 1] = 1;
    return origin;
  }
  for (let k = 3; k < dim; k++) origin[k] = cameraDistance;
  return origin;
}

/**
 * Extracts a normalized real-time feature matrix for any active manifold
 * (e.g., Calabi-Yau, E8, Clifford Torus, or N-polytope).
 *
 * Tracks:
 *  1. N-Dimensional vertex distances from the projection origin (per-vertex normalized
 *     array `vertexDistances` + summary moments + 8-band depth harmonic distribution).
 *  2. Rate of change of the current slice coordinate (`sliceVelocity` and `sliceSpeed`).
 *  3. Active vertex/edge counts matching the f-vector state (`fVector`, `activeVertices`,
 *     `activeEdges`, and normalized densities).
 *
 * @param {object} geo Manifold object produced by geometry builders
 * @param {number[][]} [rotated] Rotated N-D vertex coordinates (defaults to `geo.points`)
 * @param {{
 *   projection?: string,
 *   cameraDistance?: number,
 *   sliceEnabled?: boolean,
 *   sliceLevel?: number,
 *   prevSliceLevel?: number,
 *   dt?: number,
 *   sliceSegments?: number,
 *   outVector?: Float32Array,
 *   outDistances?: Float32Array,
 *   outDepthBands?: Float32Array
 * }} [state]
 */
export function extractFeatureMatrix(geo, rotated = null, state = {}) {
  const pts = rotated && rotated.length ? rotated : geo?.points || [];
  const vertexCount = pts.length;
  const dim = geo?.dim || (vertexCount ? pts[0].length : 3);
  const edgeCount = geo?.edges?.length || 0;
  const faceCount = geo?.faces?.length || geo?.triangles?.length || 0;

  const {
    projection = 'perspective',
    cameraDistance = 2.4,
    sliceEnabled = false,
    sliceLevel = 0,
    prevSliceLevel = sliceLevel,
    dt = 1 / 60,
    sliceSegments = 0,
  } = state;

  const vector = state.outVector instanceof Float32Array && state.outVector.length >= 16
    ? state.outVector
    : new Float32Array(16);
  const vertexDistances =
    state.outDistances instanceof Float32Array && state.outDistances.length === vertexCount
      ? state.outDistances
      : new Float32Array(vertexCount);
  const depthDistribution =
    state.outDepthBands instanceof Float32Array && state.outDepthBands.length === DEPTH_BAND_COUNT
      ? state.outDepthBands
      : new Float32Array(DEPTH_BAND_COUNT);

  depthDistribution.fill(0);

  // 1. N-D vertex distances from projection origin & hidden-axis depth distribution
  const origin = projectionOrigin(dim, projection, cameraDistance);
  const hidden = Math.max(0, dim - 1);
  let minDist = Infinity;
  let maxDist = -Infinity;
  let loHidden = Infinity;
  let hiHidden = -Infinity;

  for (let i = 0; i < vertexCount; i++) {
    const p = pts[i];
    let d2 = 0;
    for (let k = 0; k < dim; k++) {
      const diff = (p[k] || 0) - origin[k];
      d2 += diff * diff;
    }
    const d = Math.sqrt(d2);
    vertexDistances[i] = d;
    if (d < minDist) minDist = d;
    if (d > maxDist) maxDist = d;

    const w = p[hidden] || 0;
    if (w < loHidden) loHidden = w;
    if (w > hiHidden) hiHidden = w;
  }

  const distSpan = maxDist - minDist;
  const hiddenSpan = Math.max(1e-6, hiHidden - loHidden);
  const maxTheoreticalDist = Math.max(1, Math.hypot(1, ...origin) + 1);

  let sumNormDist = 0;
  let sumSqNormDist = 0;

  for (let i = 0; i < vertexCount; i++) {
    const rawD = vertexDistances[i];
    const normD = distSpan > 1e-6 ? (rawD - minDist) / distSpan : clamp01(rawD / maxTheoreticalDist);
    vertexDistances[i] = clamp01(normD);
    sumNormDist += vertexDistances[i];
    sumSqNormDist += vertexDistances[i] * vertexDistances[i];

    // Mirror viewer.js color coordinate logic to populate 8 harmonic depth bands
    const p = pts[i];
    const t =
      geo?.hue && geo.hue[i] >= 0
        ? clamp01(geo.hue[i])
        : dim >= 3
        ? clamp01(((p[hidden] || 0) - loHidden) / hiddenSpan)
        : 0.25;
    const bandFloat = t * (DEPTH_BAND_COUNT - 1);
    const b0 = Math.min(DEPTH_BAND_COUNT - 1, Math.max(0, Math.floor(bandFloat)));
    const b1 = Math.min(DEPTH_BAND_COUNT - 1, b0 + 1);
    const frac = bandFloat - b0;
    // Weight each vertex contribution by its proximity in N-D space
    const weight = 0.5 + 0.5 * (1 - vertexDistances[i]);
    depthDistribution[b0] += (1 - frac) * weight;
    depthDistribution[b1] += frac * weight;
  }

  let maxBand = 0;
  for (let b = 0; b < DEPTH_BAND_COUNT; b++) {
    if (depthDistribution[b] > maxBand) maxBand = depthDistribution[b];
  }
  for (let b = 0; b < DEPTH_BAND_COUNT; b++) {
    depthDistribution[b] = maxBand > 1e-6 ? clamp01(depthDistribution[b] / maxBand) : 0;
    vector[b] = depthDistribution[b];
  }

  const meanDistance = vertexCount > 0 ? clamp01(sumNormDist / vertexCount) : 0;
  const variance = vertexCount > 0 ? Math.max(0, sumSqNormDist / vertexCount - meanDistance * meanDistance) : 0;
  const distanceSpread = clamp01(Math.sqrt(variance) * 2);

  // 2. Rate of change of the current slice coordinate (slider velocity)
  const safeDt = Math.max(1e-4, dt);
  const rawVelocity = sliceEnabled ? (sliceLevel - prevSliceLevel) / safeDt : 0;
  // Signed velocity mapped to [0, 1] with 0.5 = stationary, and unsigned speed in [0, 1]
  const signedVelocity = Math.tanh(rawVelocity * 0.35);
  const sliceVelocity = clamp01(0.5 + 0.5 * signedVelocity);
  const sliceSpeed = clamp01(Math.abs(rawVelocity) / 4.0);
  const sliceLevelNorm = clamp01((sliceLevel + 1.2) / 2.4);

  // 3. Active vertex/edge counts matching the f-vector state
  const f =
    geo?.family && ['cube', 'simplex', 'orthoplex'].includes(geo.family)
      ? fVector(geo.family, dim)
      : [vertexCount, edgeCount, ...(faceCount ? [faceCount] : []), ...(geo?.cells ? [geo.cells] : [])];

  const fVertices = f[0] ?? vertexCount;
  const fEdges = f[1] ?? edgeCount;

  // When slicing is enabled, track active cross-section vertices/edges alongside full manifold f-vector
  let activeVertices = fVertices;
  let activeEdges = fEdges;
  if (sliceEnabled) {
    if (sliceSegments > 0) {
      activeEdges = sliceSegments;
      activeVertices = sliceSegments * 2;
    } else {
      // Count vertices within a thin slab around the slice hyperplane
      const slab = Math.max(0.08, hiddenSpan * 0.1);
      let nearCount = 0;
      for (let i = 0; i < vertexCount; i++) {
        if (Math.abs((pts[i][hidden] || 0) - sliceLevel) <= slab) nearCount++;
      }
      activeVertices = nearCount;
      activeEdges = Math.round((nearCount / Math.max(1, vertexCount)) * fEdges);
    }
  }

  const vertexDensity = clamp01(Math.log2(1 + fVertices) / Math.log2(1 + MAX_REF_VERTICES));
  const edgeDensity = clamp01(Math.log2(1 + fEdges) / Math.log2(1 + MAX_REF_EDGES));
  const activeSliceRatio = sliceEnabled
    ? clamp01(activeVertices / Math.max(1, fVertices))
    : 1;

  vector[FEATURE_CHANNELS.MEAN_PROJ_DISTANCE] = meanDistance;
  vector[FEATURE_CHANNELS.SPREAD_PROJ_DISTANCE] = distanceSpread;
  vector[FEATURE_CHANNELS.SLICE_VELOCITY] = sliceVelocity;
  vector[FEATURE_CHANNELS.SLICE_SPEED] = sliceSpeed;
  vector[FEATURE_CHANNELS.SLICE_LEVEL_NORM] = sliceLevelNorm;
  vector[FEATURE_CHANNELS.VERTEX_DENSITY] = vertexDensity;
  vector[FEATURE_CHANNELS.EDGE_DENSITY] = edgeDensity;
  vector[FEATURE_CHANNELS.ACTIVE_SLICE_RATIO] = activeSliceRatio;

  return {
    vector,
    vertexDistances,
    depthDistribution,
    fVector: f,
    dim,
    vertexCount: fVertices,
    edgeCount: fEdges,
    faceCount,
    activeVertices,
    activeEdges,
    sliceLevel,
    rawSliceVelocity: rawVelocity,
    sliceVelocity: signedVelocity,
    sliceSpeed,
    meanDistance,
    distanceSpread,
    hiddenSpan,
  };
}

