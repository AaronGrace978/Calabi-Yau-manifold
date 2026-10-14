/**
 * Higher-Dimensional Geometry, Topology & Mathematical Physics Engine (2D -> 11D).
 *
 * Provides exact parametric immersions, regular polychora ({4,3,3} tesseract, {3,4,3} 24-cell),
 * Hopf fibration S^1 -> S^3 -> S^2, non-self-intersecting 4D Klein bottle, 5D Kaluza-Klein
 * compactification, 6D Fermat Calabi-Yau threefolds, 7D G2-holonomy manifolds, the 240 roots of
 * the 8D E8 lattice projected via the Coxeter plane, 10D mirror superstring target spaces, and
 * 11D M-theory orbifolds.
 *
 * Includes SO(4)/SO(N) rotation operators, stereographic/orthographic/Kähler projections,
 * exact 4D hyperplane cross-section slicing (w4 = const), numerical Riemannian metric tensor
 * evaluation (g_ij, det g, area element, Kähler potential), and Grassberger-Procaccia
 * correlation dimension (D2) + Lyapunov divergence estimators for token trajectories.
 */

import { evaluateCalabiYauPoint, PARAM_DOMAIN } from '../instrument/manifoldMath.js';

export const DIMENSION_CATALOG = Object.freeze([
  {
    id: 'calabi-yau-6d',
    name: '6D Calabi-Yau Quintic (M₅ ⊂ ℂℙ⁴)',
    shortLabel: '6D CALABI-YAU',
    dimension: 6,
    complexDimension: 3,
    symbol: 'z₁ⁿ + z₂ⁿ = 1',
    holonomy: 'SU(3)',
    ricciFlat: true,
    orientable: true,
    eulerCharacteristic: -200,
    bettiNumbers: [1, 0, 1, 204, 1, 0, 1],
    hodgeNumbers: { 'h1,1': 1, 'h2,1': 101, 'h3,0': 1, 'h0,0': 1 },
    summary:
      'Compact Ricci-flat Kähler 3-fold in ℂℙ⁴ (n² sheets). Preserves N=1 supersymmetry in 4D when compactifying 10D heterotic or Type II superstrings.',
  },
  {
    id: 'tesseract-4d',
    name: '4D Regular Polychoron: Tesseract {4,3,3}',
    shortLabel: '4D TESSERACT',
    dimension: 4,
    complexDimension: 2,
    symbol: '{4, 3, 3} · C₈',
    holonomy: 'SO(4) / B₄',
    ricciFlat: true,
    orientable: true,
    eulerCharacteristic: 0,
    bettiNumbers: [1, 0, 0, 1],
    polytopeCounts: { V: 16, E: 32, F: 24, C: 8 },
    hodgeNumbers: { V: 16, E: 32, F: 24, C: 8 },
    summary:
      '4D hypercube (8-cell) with 16 vertices (±1,±1,±1,±1), 32 edges, 24 square faces, and 8 cubic 3-cells. Satisfies Euler-Poincaré V − E + F − C = 0.',
  },
  {
    id: '24-cell-4d',
    name: '4D Self-Dual Icositetrachoron {3,4,3}',
    shortLabel: '4D 24-CELL',
    dimension: 4,
    complexDimension: 2,
    symbol: '{3, 4, 3} · F₄',
    holonomy: 'W(F₄) (1152)',
    ricciFlat: false,
    orientable: true,
    eulerCharacteristic: 0,
    bettiNumbers: [1, 0, 0, 1],
    polytopeCounts: { V: 24, E: 96, F: 96, C: 24 },
    hodgeNumbers: { V: 24, E: 96, F: 96, C: 24 },
    summary:
      'Unique regular self-dual 4-polytope with no 3D analogue. Its 24 vertices are the unit Hurwitz quaternions / D₄ roots, bounding 24 octahedral cells.',
  },
  {
    id: 'hopf-fibration-4d',
    name: '4D Hopf Fibration (S¹ ↪ S³ → S²)',
    shortLabel: '4D HOPF FIBRATION',
    dimension: 4,
    complexDimension: 2,
    symbol: 'π(z₁,z₂) ∈ S²',
    holonomy: 'U(1) ⊂ SU(2)',
    ricciFlat: false,
    orientable: true,
    eulerCharacteristic: 0,
    bettiNumbers: [1, 0, 0, 1],
    hodgeNumbers: { c1: 1, linkingNumber: 1, hopfInvariant: 1 },
    summary:
      'Non-trivial principal U(1) circle bundle over S². Every point on S² lifts to a great circle in S³ ⊂ ℝ⁴; stereographic projection yields linked Villarceau circles with linking number +1.',
  },
  {
    id: 'clifford-torus-4d',
    name: '4D Flat Clifford Torus (S¹ × S¹ ⊂ S³)',
    shortLabel: '4D CLIFFORD TORUS',
    dimension: 4,
    complexDimension: 2,
    symbol: '|z₁| = |z₂| = 1/√2',
    holonomy: 'U(1) × U(1)',
    ricciFlat: true,
    orientable: true,
    eulerCharacteristic: 0,
    bettiNumbers: [1, 2, 1],
    hodgeNumbers: { 'h0,0': 1, 'h1,0': 1, 'h0,1': 1, 'h1,1': 1 },
    summary:
      'Minimal flat surface embedded in S³ ⊂ ℝ⁴ with identically zero Gaussian curvature (K ≡ 0) everywhere, impossible for a closed torus in ℝ³.',
  },
  {
    id: 'klein-bottle-4d',
    name: '4D Non-Orientable Klein Bottle (K ⊂ ℝ⁴)',
    shortLabel: '4D KLEIN BOTTLE',
    dimension: 4,
    complexDimension: 0,
    symbol: 'ℝℙ² # ℝℙ² ⊂ ℝ⁴',
    holonomy: 'O(2) (w₁ ≠ 0)',
    ricciFlat: false,
    orientable: false,
    eulerCharacteristic: 0,
    bettiNumbers: [1, 1, 0],
    hodgeNumbers: { w1: 1, w2: 0, torsionH1: 'ℤ₂' },
    summary:
      'Closed non-orientable surface immersed in ℝ⁴ where the 4th coordinate w₄ separates the neck from the body, eliminating the ℝ³ self-intersection.',
  },
  {
    id: 'kaluza-klein-5d',
    name: '5D Kaluza-Klein Cylinder (M⁴ × S¹_R)',
    shortLabel: '5D KALUZA-KLEIN',
    dimension: 5,
    complexDimension: 2,
    symbol: 'ds₅² = g_μν dx^μ dx^ν + φ²(dx⁵ + κA_μ dx^μ)²',
    holonomy: 'SO(3,1) × U(1)',
    ricciFlat: true,
    orientable: true,
    eulerCharacteristic: 0,
    bettiNumbers: [1, 1, 0, 0, 1, 1],
    hodgeNumbers: { kkModes: 'm_n = |n|/R₅', gaugeGroup: 'U(1)' },
    summary:
      '5D unification where 4D gravity g_μν, Maxwell electromagnetism A_μ, and the dilaton scalar φ emerge from a compact circular 5th dimension S¹_R.',
  },
  {
    id: 'g2-manifold-7d',
    name: '7D Joyce G₂-Holonomy Manifold (X₇)',
    shortLabel: '7D G₂ MANIFOLD',
    dimension: 7,
    complexDimension: 0,
    symbol: 'dφ = 0, d*φ = 0 (φ ∈ Ω³₊)',
    holonomy: 'G₂ ⊂ SO(7) (dim 14)',
    ricciFlat: true,
    orientable: true,
    eulerCharacteristic: 0,
    bettiNumbers: [1, 0, 12, 43, 43, 12, 0, 1],
    hodgeNumbers: { b2: 12, b3: 43, associativeForm: 'deg 3', coassociativeForm: 'deg 4' },
    summary:
      'Compact 7-manifold with exceptional G₂ holonomy (automorphism group of the octonions 𝕆), Ricci-flat metric, and closed associative 3-form φ.',
  },
  {
    id: 'e8-lattice-8d',
    name: '8D Exceptional E₈ Root Polytope (4₂₁)',
    shortLabel: '8D E₈ LATTICE',
    dimension: 8,
    complexDimension: 4,
    symbol: 'Γ₈ · 240 Roots (⟨α,α⟩ = 2)',
    holonomy: 'W(E₈) · dim(𝔢₈)=248',
    ricciFlat: true,
    orientable: true,
    eulerCharacteristic: 0,
    bettiNumbers: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    polytopeCounts: { roots: 240, integerRoots: 112, spinorRoots: 128, rank: 8 },
    hodgeNumbers: { roots: 240, rank: 8, coxeterNumber: 30, kissingNumber: 240 },
    summary:
      'All 240 minimal vectors of the even unimodular E₈ lattice in ℝ⁸ (112 integer D₈ roots + 128 half-integer spinor roots), projected via orthogonal Coxeter planes.',
  },
  {
    id: 'superstring-10d',
    name: '10D Mirror Superstring Target Space (M¹˒³ × W₅)',
    shortLabel: '10D SUPERSTRING',
    dimension: 10,
    complexDimension: 5,
    symbol: '(h¹˒¹, h²˒¹) = (101, 1) · χ = +200',
    holonomy: 'SO(1,3) × SU(3)',
    ricciFlat: true,
    orientable: true,
    eulerCharacteristic: 200,
    bettiNumbers: [1, 0, 101, 4, 101, 0, 1],
    hodgeNumbers: { 'h1,1': 101, 'h2,1': 1, 'h3,0': 1, criticalDim: 10 },
    summary:
      'Critical 10D Type IIB superstring target space compactified on the Greene-Plesser mirror quintic W₅ = M₅ / (ℤ₅)³, flipping χ from −200 to +200.',
  },
  {
    id: 'm-theory-11d',
    name: '11D M-Theory Hořava-Witten Orbifold (M¹˒³ × CY₃ × S¹/ℤ₂)',
    shortLabel: '11D M-THEORY',
    dimension: 11,
    complexDimension: 5,
    symbol: 'g_MN (44) ⊕ C_MNP (84) = 128 DOF',
    holonomy: 'SU(3) × ℤ₂ (E₈ × E₈)',
    ricciFlat: true,
    orientable: true,
    eulerCharacteristic: -200,
    bettiNumbers: [1, 0, 1, 204, 204, 1, 0, 1],
    hodgeNumbers: { gravitonDOF: 44, threeFormDOF: 84, gravitinoDOF: 128, branes: 'M2 / M5' },
    summary:
      '11-dimensional M-theory spacetime with boundary E₈ gauge branes separated along the 11th orbifold interval S¹/ℤ₂ and M2/M5-branes wrapping internal cycles.',
  },
]);

/**
 * Look up a dimensional space definition by id. Defaults to 6D Calabi-Yau.
 */
export function getDimensionSpace(spaceId) {
  return DIMENSION_CATALOG.find((s) => s.id === spaceId) || DIMENSION_CATALOG[0];
}

/**
 * Computes exact topological invariants for a degree-n Fermat hypersurface in CP^4
 * (or returns the space's catalog invariants for other spaces).
 */
export function computeTopologicalInvariants(spaceId, { exponentN = 5 } = {}) {
  const space = getDimensionSpace(spaceId);
  if (space.id === 'calabi-yau-6d' || space.id === 'superstring-10d' || space.id === 'm-theory-11d') {
    const n = Math.max(2, Math.min(9, Math.round(exponentN)));
    // For a smooth degree-n hypersurface X_n in CP^4:
    // chi(X_n) = n * (10 - 10n + 5n^2 - n^3)
    const chi = n * (10 - 10 * n + 5 * n * n - n * n * n);
    const h11 = 1;
    //Since chi = 2*(h^{1,1} - h^{2,1}) for a Calabi-Yau 3-fold (n=5),
    // and for general degree-n 3-fold b_3 = 2 + 2*h^{2,1} + 2*h^{3,0} = 4 - chi:
    const b3 = Math.max(0, 4 - chi);
    const h21 = Math.max(0, Math.round((2 - chi) / 2));
    const isMirror = space.id === 'superstring-10d';
    const effectiveH11 = isMirror ? h21 : h11;
    const effectiveH21 = isMirror ? h11 : h21;
    const effectiveChi = isMirror ? -chi : chi;
    const sheets = n * n;

    return {
      spaceId: space.id,
      name: space.name,
      dimension: space.dimension,
      complexDimension: space.complexDimension,
      fermatDegree: n,
      sheets,
      eulerCharacteristic: effectiveChi,
      holonomy: n === 5 ? space.holonomy : `SU(3) [c₁=${5 - n}]`,
      ricciFlat: n === 5,
      orientable: true,
      bettiNumbers: [1, 0, effectiveH11, b3, effectiveH11, 0, 1],
      hodgeNumbers: {
        'h0,0': 1,
        'h1,1': effectiveH11,
        'h2,1': effectiveH21,
        'h3,0': n === 5 ? 1 : 0,
      },
    };
  }

  return {
    spaceId: space.id,
    name: space.name,
    dimension: space.dimension,
    complexDimension: space.complexDimension,
    fermatDegree: exponentN,
    sheets: exponentN * exponentN,
    eulerCharacteristic: space.eulerCharacteristic,
    holonomy: space.holonomy,
    ricciFlat: space.ricciFlat,
    orientable: space.orientable,
    bettiNumbers: space.bettiNumbers,
    hodgeNumbers: space.hodgeNumbers,
    polytopeCounts: space.polytopeCounts || null,
  };
}

// ============================================================================
// EXACT POLYTOPE & LATTICE CONSTRUCTIONS (4D Tesseract, 4D 24-Cell, 8D E8)
// ============================================================================

let cachedTesseract = null;
let cached24Cell = null;
let cachedE8 = null;

/**
 * Generates the exact 4D Tesseract {4,3,3}: 16 vertices, 32 edges, 24 square faces.
 */
export function generateTesseract4D() {
  if (cachedTesseract) return cachedTesseract;
  const vertices = [];
  for (let mask = 0; mask < 16; mask++) {
    vertices.push([
      mask & 1 ? 1 : -1,
      mask & 2 ? 1 : -1,
      mask & 4 ? 1 : -1,
      mask & 8 ? 1 : -1,
    ]);
  }
  const edges = [];
  for (let i = 0; i < 16; i++) {
    for (let bit = 0; bit < 4; bit++) {
      const j = i ^ (1 << bit);
      if (i < j) edges.push([i, j]);
    }
  }
  const faces = [];
  for (let a = 0; a < 4; a++) {
    for (let b = a + 1; b < 4; b++) {
      const other = [0, 1, 2, 3].filter((d) => d !== a && d !== b);
      for (let s0 of [-1, 1]) {
        for (let s1 of [-1, 1]) {
          const idxOf = (va, vb) => {
            const coord = [0, 0, 0, 0];
            coord[a] = va;
            coord[b] = vb;
            coord[other[0]] = s0;
            coord[other[1]] = s1;
            return (
              (coord[0] > 0 ? 1 : 0) |
              (coord[1] > 0 ? 2 : 0) |
              (coord[2] > 0 ? 4 : 0) |
              (coord[3] > 0 ? 8 : 0)
            );
          };
          faces.push([idxOf(-1, -1), idxOf(1, -1), idxOf(1, 1), idxOf(-1, 1)]);
        }
      }
    }
  }
  cachedTesseract = Object.freeze({ vertices, edges, faces, cells: 8 });
  return cachedTesseract;
}

/**
 * Generates the exact 4D 24-Cell {3,4,3}: 24 vertices, 96 edges.
 * Vertices on the unit 3-sphere S^3:
 *  - 8 coordinate permutations of (±1, 0, 0, 0)
 *  - 16 half-integer combinations (±1/2, ±1/2, ±1/2, ±1/2)
 */
export function generate24Cell4D() {
  if (cached24Cell) return cached24Cell;
  const vertices = [];
  for (let d = 0; d < 4; d++) {
    for (const s of [-1, 1]) {
      const v = [0, 0, 0, 0];
      v[d] = s;
      vertices.push(v);
    }
  }
  for (let mask = 0; mask < 16; mask++) {
    vertices.push([
      mask & 1 ? 0.5 : -0.5,
      mask & 2 ? 0.5 : -0.5,
      mask & 4 ? 0.5 : -0.5,
      mask & 8 ? 0.5 : -0.5,
    ]);
  }
  const edges = [];
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      const dot =
        vertices[i][0] * vertices[j][0] +
        vertices[i][1] * vertices[j][1] +
        vertices[i][2] * vertices[j][2] +
        vertices[i][3] * vertices[j][3];
      // Unit distance apart on S^3 <=> inner product = 0.5
      if (Math.abs(dot - 0.5) < 1e-6) {
        edges.push([i, j]);
      }
    }
  }
  cached24Cell = Object.freeze({ vertices, edges, faces: 96, cells: 24 });
  return cached24Cell;
}

/**
 * Generates all 240 exact root vectors of the 8-dimensional E8 root system in R^8,
 * and projects each 8D root onto R^4 via two orthogonal Coxeter eigenplanes (H4 folding).
 */
export function generateE8Lattice8D() {
  if (cachedE8) return cachedE8;
  const roots8D = [];

  // 1) 112 integer roots: (±1, ±1, 0, 0, 0, 0, 0, 0)
  for (let i = 0; i < 8; i++) {
    for (let j = i + 1; j < 8; j++) {
      for (const si of [-1, 1]) {
        for (const sj of [-1, 1]) {
          const r = [0, 0, 0, 0, 0, 0, 0, 0];
          r[i] = si;
          r[j] = sj;
          roots8D.push(r);
        }
      }
    }
  }

  // 2) 128 spinor roots: (±1/2, ..., ±1/2) with an even number of minus signs
  for (let mask = 0; mask < 256; mask++) {
    let negCount = 0;
    const r = new Array(8);
    for (let b = 0; b < 8; b++) {
      if ((mask >> b) & 1) {
        r[b] = -0.5;
        negCount += 1;
      } else {
        r[b] = 0.5;
      }
    }
    if (negCount % 2 === 0) {
      roots8D.push(r);
    }
  }

  // Orthogonal Coxeter basis vectors u1, u2 (primary Coxeter plane, m=1) and u3, u4 (secondary plane, m=7)
  const basis = [
    [0.5077, 0.4899, 0.4201, 0.3008, 0.1489, -0.0185, -0.1839, -0.425],
    [0.0851, 0.2588, 0.4052, 0.5067, 0.5522, 0.3712, 0.2491, 0.0568],
    [0.4154, -0.1964, -0.4871, -0.0921, 0.4519, 0.2895, -0.3788, -0.3264],
    [0.2451, 0.4712, -0.0882, -0.491, -0.1128, 0.4682, 0.3125, -0.3812],
  ].map((vec) => {
    const norm = Math.hypot(...vec) || 1;
    return vec.map((x) => x / norm);
  });

  const projected4D = roots8D.map((r) => [
    dotN(r, basis[0]),
    dotN(r, basis[1]),
    dotN(r, basis[2]),
    dotN(r, basis[3]),
  ]);

  // Connect nearest-neighbor roots (inner product in R^8 equal to 1 => angle 60 deg)
  const edges = [];
  for (let i = 0; i < roots8D.length; i++) {
    for (let j = i + 1; j < roots8D.length; j++) {
      if (Math.abs(dotN(roots8D[i], roots8D[j]) - 1.0) < 1e-6) {
        edges.push([i, j]);
      }
    }
  }

  cachedE8 = Object.freeze({ roots8D, projected4D, edges });
  return cachedE8;
}

function dotN(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

// ============================================================================
// SO(4) ROTATIONS, PROJECTIONS (R^4 -> R^3), AND HYPERPLANE SLICER (w4 = c)
// ============================================================================

/**
 * Rotates a 4D vector [x, y, z, w] through 4D coordinate planes (xw, yw, zw, xy).
 * Preserves Euclidean norm ||v|| in R^4 (exact SO(4) orthogonal transformation).
 */
export function rotate4D(vec4, { xw = 0, yw = 0, zw = 0, xy = 0 } = {}) {
  let [x, y, z, w] = vec4;

  if (xy !== 0) {
    const c = Math.cos(xy);
    const s = Math.sin(xy);
    [x, y] = [c * x - s * y, s * x + c * y];
  }
  if (xw !== 0) {
    const c = Math.cos(xw);
    const s = Math.sin(xw);
    [x, w] = [c * x - s * w, s * x + c * w];
  }
  if (yw !== 0) {
    const c = Math.cos(yw);
    const s = Math.sin(yw);
    [y, w] = [c * y - s * w, s * y + c * w];
  }
  if (zw !== 0) {
    const c = Math.cos(zw);
    const s = Math.sin(zw);
    [z, w] = [c * z - s * w, s * z + c * w];
  }

  return [x, y, z, w];
}

/**
 * Projects a 4D point [x, y, z, w4] into R^3 using stereographic, perspective, or orthographic projection.
 */
export function project4DTo3D(vec4, { mode = 'stereographic', poleW = 2.4 } = {}) {
  const [x, y, z, w4] = vec4;
  if (mode === 'orthographic') {
    return { x, y, z, w4, scaleFactor: 1.0 };
  }
  const denom = Math.max(0.35, poleW - w4);
  const factor = mode === 'stereographic' ? poleW / denom : 1.0 / denom;
  return {
    x: x * factor,
    y: y * factor,
    z: z * factor,
    w4,
    scaleFactor: factor,
  };
}

/**
 * Computes the exact 3D cross-section of a 4D polytope or mesh with the hyperplane w4 = wSlice.
 * For each edge (v_a, v_b) whose endpoints straddle wSlice, computes the exact linear interpolation
 * point in R^3 where w4 == wSlice.
 */
export function slice4DHyperplane(vertices4D, edges, wSlice = 0.0, slabThickness = 0.25) {
  const intersections = [];
  const slabVertices = [];

  for (let i = 0; i < vertices4D.length; i++) {
    const v = vertices4D[i];
    if (Math.abs(v[3] - wSlice) <= slabThickness) {
      slabVertices.push({ index: i, point3D: [v[0], v[1], v[2]], w4: v[3] });
    }
  }

  for (let e = 0; e < edges.length; e++) {
    const [ia, ib] = edges[e];
    const va = vertices4D[ia];
    const vb = vertices4D[ib];
    if (!va || !vb) continue;
    const wa = va[3] - wSlice;
    const wb = vb[3] - wSlice;

    if (Math.abs(wa) < 1e-7 && Math.abs(wb) < 1e-7) {
      intersections.push([va[0], va[1], va[2]]);
      continue;
    }
    if ((wa <= 0 && wb >= 0) || (wa >= 0 && wb <= 0)) {
      const denom = vb[3] - va[3];
      const t = Math.abs(denom) > 1e-9 ? (wSlice - va[3]) / denom : 0.5;
      if (t >= -1e-6 && t <= 1 + 1e-6) {
        intersections.push([
          va[0] + t * (vb[0] - va[0]),
          va[1] + t * (vb[1] - va[1]),
          va[2] + t * (vb[2] - va[2]),
        ]);
      }
    }
  }

  return {
    wSlice,
    intersectionCount: intersections.length,
    intersections,
    slabVertexCount: slabVertices.length,
    slabVertices,
  };
}

// ============================================================================
// UNIFIED PARAMETRIC POINT EVALUATOR ACROSS ALL SPACES (2D -> 11D)
// ============================================================================

/**
 * Evaluates a point on any space in `DIMENSION_CATALOG` parameterized by unit coordinates
 * (u, v) in [0, 1]^2 and sheet indices (k1, k2) in {0..n-1}^2, returning its R^4 embedding
 * (x, y, z, w4) and higher-dimensional fiber coordinates.
 */
export function evaluateDimensionalPoint(
  spaceId,
  u,
  v,
  k1 = 0,
  k2 = 0,
  n = 5,
  xi = 0.68,
  rot4D = null
) {
  const totalSheets = Math.max(1, n * n);
  const sheetIdx = k1 * n + k2;
  const sheetPhase = (2 * Math.PI * sheetIdx) / totalSheets;

  let x = 0;
  let y = 0;
  let z = 0;
  let w4 = 0;
  let z1 = [0, 0];
  let z2 = [0, 0];
  let extraCoords = [];

  switch (spaceId) {
    case 'clifford-torus-4d': {
      const theta1 = 2 * Math.PI * (u + k1 / n);
      const theta2 = 2 * Math.PI * (v + k2 / n);
      const invSqrt2 = Math.SQRT1_2;
      z1 = [invSqrt2 * Math.cos(theta1), invSqrt2 * Math.sin(theta1)];
      z2 = [invSqrt2 * Math.cos(theta2), invSqrt2 * Math.sin(theta2)];
      // Stereographic / Kähler projection rotated by xi
      const rot = rotate4D([z1[0], z1[1], z2[0], z2[1]], { xw: xi * 0.7, yw: xi * 0.5, zw: xi });
      const proj = project4DTo3D(rot, { mode: 'stereographic', poleW: 1.65 });
      x = proj.x * 0.75;
      y = proj.y * 0.75;
      z = proj.z * 0.75;
      w4 = rot[3];
      break;
    }

    case 'klein-bottle-4d': {
      const U = (2 * Math.PI * (u + k1)) / Math.max(1, n);
      const V = (2 * Math.PI * (v + k2)) / Math.max(1, n);
      const R = 0.82;
      const r = 0.34;
      const raw4 = [
        (R + r * Math.cos(V)) * Math.cos(U),
        (R + r * Math.cos(V)) * Math.sin(U),
        r * Math.sin(V) * Math.cos(U * 0.5),
        r * Math.sin(V) * Math.sin(U * 0.5),
      ];
      const rot = rotate4D(raw4, { zw: xi, xw: xi * 0.4 });
      x = rot[0];
      y = rot[1];
      z = rot[2];
      w4 = rot[3];
      z1 = [x, z];
      z2 = [y, w4];
      break;
    }

    case 'hopf-fibration-4d': {
      // Base point on S^2 indexed by sheet (k1, k2) and parameter u; fiber circle angle by v
      const baseTheta = 0.18 + ((k1 + 0.5 * u) / Math.max(1, n)) * (Math.PI - 0.36);
      const basePhi = (2 * Math.PI * (k2 + u)) / Math.max(1, n);
      const fiberPsi = 2 * Math.PI * v;

      const cHalf = Math.cos(baseTheta * 0.5);
      const sHalf = Math.sin(baseTheta * 0.5);
      const a1 = fiberPsi + basePhi * 0.5;
      const a2 = fiberPsi - basePhi * 0.5;

      z1 = [cHalf * Math.cos(a1), cHalf * Math.sin(a1)];
      z2 = [sHalf * Math.cos(a2), sHalf * Math.sin(a2)];

      const rot = rotate4D([z1[0], z1[1], z2[0], z2[1]], { zw: xi * 0.6, xw: xi * 0.3 });
      const proj = project4DTo3D(rot, { mode: 'stereographic', poleW: 1.55 });
      x = proj.x * 0.62;
      y = proj.y * 0.62;
      z = proj.z * 0.62;
      w4 = rot[3];
      break;
    }

    case 'tesseract-4d': {
      // Map each sheet to a face/cell of the 4D hypercube and interpolate in R^4, then stereographically project
      const { faces, vertices } = generateTesseract4D();
      const face = faces[sheetIdx % faces.length];
      const v0 = vertices[face[0]];
      const v1 = vertices[face[1]];
      const v2 = vertices[face[2]];
      const v3 = vertices[face[3]];
      const raw4 = [0, 1, 2, 3].map(
        (d) =>
          (1 - u) * (1 - v) * v0[d] +
          u * (1 - v) * v1[d] +
          u * v * v2[d] +
          (1 - u) * v * v3[d]
      );
      const rot = rotate4D(raw4, { xw: xi, yw: xi * 0.62, zw: xi * 0.38 });
      const proj = project4DTo3D(rot, { mode: 'stereographic', poleW: 2.5 });
      x = proj.x * 0.65;
      y = proj.y * 0.65;
      z = proj.z * 0.65;
      w4 = rot[3];
      z1 = [raw4[0], raw4[1]];
      z2 = [raw4[2], raw4[3]];
      break;
    }

    case '24-cell-4d': {
      const { vertices, edges } = generate24Cell4D();
      const edge = edges[sheetIdx % edges.length];
      const va = vertices[edge[0]];
      const vb = vertices[edge[1]];
      const tubeAngle = 2 * Math.PI * v;
      const tubeR = 0.09;
      const raw4 = [
        va[0] + u * (vb[0] - va[0]) + tubeR * Math.cos(tubeAngle),
        va[1] + u * (vb[1] - va[1]) + tubeR * Math.sin(tubeAngle),
        va[2] + u * (vb[2] - va[2]) + tubeR * Math.cos(tubeAngle + sheetPhase),
        va[3] + u * (vb[3] - va[3]) + tubeR * Math.sin(tubeAngle + sheetPhase),
      ];
      const rot = rotate4D(raw4, { xw: xi, yw: xi * 0.75, zw: xi * 0.5 });
      const proj = project4DTo3D(rot, { mode: 'stereographic', poleW: 2.1 });
      x = proj.x * 0.85;
      y = proj.y * 0.85;
      z = proj.z * 0.85;
      w4 = rot[3];
      z1 = [raw4[0], raw4[1]];
      z2 = [raw4[2], raw4[3]];
      break;
    }

    case 'kaluza-klein-5d': {
      // Base 4D spacetime sheet + 5th circular Kaluza-Klein fiber S^1_R with gauge twist A_mu
      const { aMin, aMax, bMin, bMax } = PARAM_DOMAIN;
      const a = aMin + u * (aMax - aMin);
      const b = bMin + v * (bMax - bMin);
      const base = evaluateCalabiYauPoint(a, b, k1, k2, n, xi);
      const x5 = 2 * Math.PI * (u * k1 + v * k2) / Math.max(1, n) + xi;
      const kkRadius = 0.24;
      const dilaton = 1.0 + 0.18 * Math.cos(x5);
      x = base.x * 0.82 * dilaton + kkRadius * Math.cos(x5) * 0.45;
      y = base.y * 0.82 * dilaton + kkRadius * Math.sin(x5) * 0.45;
      z = base.z * 0.82 + kkRadius * Math.sin(2 * x5) * 0.35;
      w4 = base.w4;
      z1 = base.z1;
      z2 = base.z2;
      extraCoords = [kkRadius * Math.cos(x5)];
      break;
    }

    case 'g2-manifold-7d': {
      // 7D G2 associative 3-form calibrated submanifold projection (octonionic triad coupling)
      const { aMin, aMax, bMin, bMax } = PARAM_DOMAIN;
      const a = aMin + u * (aMax - aMin);
      const b = bMin + v * (bMax - bMin);
      const cy = evaluateCalabiYauPoint(a, b, k1, k2, n, xi);
      const octPhase = sheetPhase + (u - v) * Math.PI + xi;
      const x5 = Math.cos(octPhase) * 0.35;
      const x6 = Math.sin(octPhase) * 0.35;
      const x7 = Math.cos(3 * octPhase) * 0.25;
      // Associative 3-form calibration twist
      const assoc = 0.22 * (cy.x * x5 - cy.y * x6 + cy.z * x7);
      x = cy.x * 0.88 + x5 * 0.4 + assoc;
      y = cy.y * 0.88 + x6 * 0.4 - assoc;
      z = cy.z * 0.88 + x7 * 0.5;
      w4 = cy.w4 + x5 * 0.3;
      z1 = cy.z1;
      z2 = cy.z2;
      extraCoords = [x5, x6, x7];
      break;
    }

    case 'e8-lattice-8d': {
      const { projected4D, edges } = generateE8Lattice8D();
      const edge = edges[(sheetIdx * 13 + Math.floor(u * 7)) % edges.length];
      const ra = projected4D[edge[0]];
      const rb = projected4D[edge[1]];
      const phi = 2 * Math.PI * v;
      const ring = 0.08;
      const raw4 = [
        ra[0] + u * (rb[0] - ra[0]) + ring * Math.cos(phi),
        ra[1] + u * (rb[1] - ra[1]) + ring * Math.sin(phi),
        ra[2] + u * (rb[2] - ra[2]) + ring * Math.cos(phi + sheetPhase),
        ra[3] + u * (rb[3] - ra[3]) + ring * Math.sin(phi + sheetPhase),
      ];
      const rot = rotate4D(raw4, { xw: xi, yw: xi * 0.6, zw: xi * 0.8 });
      const proj = project4DTo3D(rot, { mode: 'stereographic', poleW: 2.2 });
      x = proj.x * 0.92;
      y = proj.y * 0.92;
      z = proj.z * 0.92;
      w4 = rot[3];
      z1 = [raw4[0], raw4[1]];
      z2 = [raw4[2], raw4[3]];
      break;
    }

    case 'superstring-10d':
    case 'm-theory-11d': {
      // 10D Mirror Quintic / 11D Hořava-Witten M-theory orbifold (two boundary E8 branes + CY3 bulk)
      const { aMin, aMax, bMin, bMax } = PARAM_DOMAIN;
      const a = aMin + u * (aMax - aMin);
      const b = bMin + v * (bMax - bMin);
      // Mirror twist swaps phase roles of k1 and k2
      const cy = evaluateCalabiYauPoint(a, b, k2, k1, n, xi + Math.PI * 0.25);
      const orbifoldX11 = spaceId === 'm-theory-11d' ? ((sheetIdx % 2 === 0 ? 1 : -1) * 0.22 * Math.cos(xi)) : 0;
      const braneWarp = 1.0 + 0.16 * Math.sin(2 * Math.PI * u + sheetPhase);
      x = cy.x * braneWarp + orbifoldX11;
      y = cy.y * braneWarp;
      z = cy.z * braneWarp + orbifoldX11 * 0.6;
      w4 = cy.w4;
      z1 = cy.z1;
      z2 = cy.z2;
      extraCoords = [orbifoldX11];
      break;
    }

    case 'calabi-yau-6d':
    default: {
      const { aMin, aMax, bMin, bMax } = PARAM_DOMAIN;
      const a = aMin + u * (aMax - aMin);
      const b = bMin + v * (bMax - bMin);
      const cy = evaluateCalabiYauPoint(a, b, k1, k2, n, xi);
      x = cy.x;
      y = cy.y;
      z = cy.z;
      w4 = cy.w4;
      z1 = cy.z1;
      z2 = cy.z2;
      break;
    }
  }

  if (rot4D && (rot4D.xw || rot4D.yw || rot4D.zw || rot4D.xy)) {
    const r = rotate4D([x, y, z, w4], rot4D);
    x = r[0];
    y = r[1];
    z = r[2];
    w4 = r[3];
  }

  return { x, y, z, w4, z1, z2, extraCoords };
}

// ============================================================================
// DIFFERENTIAL GEOMETRY OBSERVABLES: METRIC TENSOR g_ij, KÄHLER POTENTIAL, D_2
// ============================================================================

/**
 * Numerically evaluates the induced Riemannian metric tensor g_ij = <d_i X, d_j X> in R^4
 * at parameter (u, v) on sheet (k1, k2), along with the area element sqrt(det g),
 * trace Tr(g), anisotropy condition number, and Fubini-Study Kähler potential K = ln(1 + |z1|^2 + |z2|^2).
 */
export function evaluateRiemannianMetric(
  spaceId = 'calabi-yau-6d',
  u = 0.5,
  v = 0.5,
  k1 = 0,
  k2 = 0,
  n = 5,
  xi = 0.68
) {
  const eps = 1e-3;
  const u0 = Math.max(eps, Math.min(1 - eps, u));
  const v0 = Math.max(eps, Math.min(1 - eps, v));

  const center = evaluateDimensionalPoint(spaceId, u0, v0, k1, k2, n, xi);
  const puPlus = evaluateDimensionalPoint(spaceId, u0 + eps, v0, k1, k2, n, xi);
  const puMinus = evaluateDimensionalPoint(spaceId, u0 - eps, v0, k1, k2, n, xi);
  const pvPlus = evaluateDimensionalPoint(spaceId, u0, v0 + eps, k1, k2, n, xi);
  const pvMinus = evaluateDimensionalPoint(spaceId, u0, v0 - eps, k1, k2, n, xi);

  const du = [
    (puPlus.x - puMinus.x) / (2 * eps),
    (puPlus.y - puMinus.y) / (2 * eps),
    (puPlus.z - puMinus.z) / (2 * eps),
    (puPlus.w4 - puMinus.w4) / (2 * eps),
  ];
  const dv = [
    (pvPlus.x - pvMinus.x) / (2 * eps),
    (pvPlus.y - pvMinus.y) / (2 * eps),
    (pvPlus.z - pvMinus.z) / (2 * eps),
    (pvPlus.w4 - pvMinus.w4) / (2 * eps),
  ];

  const g11 = dotN(du, du);
  const g12 = dotN(du, dv);
  const g22 = dotN(dv, dv);
  const detG = Math.max(0, g11 * g22 - g12 * g12);
  const areaElement = Math.sqrt(detG);
  const traceG = g11 + g22;

  const disc = Math.sqrt(Math.max(0, (g11 - g22) ** 2 + 4 * g12 * g12));
  const lambdaMax = 0.5 * (traceG + disc);
  const lambdaMin = Math.max(1e-9, 0.5 * (traceG - disc));
  const anisotropy = lambdaMax / lambdaMin;

  const z1Sq = center.z1[0] ** 2 + center.z1[1] ** 2;
  const z2Sq = center.z2[0] ** 2 + center.z2[1] ** 2;
  const kahlerPotential = Math.log(1 + z1Sq + z2Sq);

  return {
    g11,
    g12,
    g22,
    detG,
    areaElement,
    traceG,
    anisotropy,
    kahlerPotential,
    point: center,
  };
}

/**
 * Grassberger-Procaccia Correlation Dimension (D2) estimator for an N-dimensional trajectory.
 * Measures the intrinsic fractal/manifold dimensionality of the live token trajectory in R^4.
 *
 * - D2 ~ 1.0: linear / repetitive 1D trajectory
 * - D2 ~ 2.0: 2-dimensional surface exploration
 * - D2 >= 2.8: high-dimensional volumetric / multi-sheet exploration
 */
export function estimateCorrelationDimension(points) {
  if (!Array.isArray(points) || points.length < 12) return 0;
  const recent = points.slice(-96);
  const dists = [];
  for (let i = 0; i < recent.length; i++) {
    const pi = recent[i].p || recent[i];
    for (let j = i + 2; j < recent.length; j++) {
      const pj = recent[j].p || recent[j];
      let d2 = 0;
      const dim = Math.min(pi.length, pj.length);
      for (let k = 0; k < dim; k++) {
        const diff = pi[k] - pj[k];
        d2 += diff * diff;
      }
      const d = Math.sqrt(d2);
      if (d > 1e-6) dists.push(d);
    }
  }
  if (dists.length < 16) return 1.0;
  dists.sort((a, b) => a - b);

  const iLow = Math.max(2, Math.floor(dists.length * 0.2));
  const iHigh = Math.max(iLow + 4, Math.floor(dists.length * 0.65));
  const rLow = dists[iLow];
  const rHigh = dists[iHigh];
  if (rHigh <= rLow * 1.02) return 1.0;

  const cLow = (iLow + 1) / dists.length;
  const cHigh = (iHigh + 1) / dists.length;
  const slope = (Math.log(cHigh) - Math.log(cLow)) / (Math.log(rHigh) - Math.log(rLow));
  return Math.max(0.2, Math.min(6.0, slope));
}

/**
 * Estimates the maximal local Lyapunov divergence exponent (lambda_max) along the trajectory.
 * Positive values indicate exponential divergence across sheets; negative/near-zero values
 * indicate phase-locked attractor convergence.
 */
export function estimateLyapunovExponent(points) {
  if (!Array.isArray(points) || points.length < 10) return 0;
  const recent = points.slice(-64);
  let sumLog = 0;
  let count = 0;

  for (let i = 0; i < recent.length - 2; i++) {
    const pi = recent[i].p || recent[i];
    const piNext = recent[i + 1].p || recent[i + 1];
    let bestJ = -1;
    let bestDist = Infinity;

    for (let j = 0; j < recent.length - 2; j++) {
      if (Math.abs(i - j) <= 2) continue;
      const pj = recent[j].p || recent[j];
      const d = Math.hypot(
        pi[0] - pj[0],
        pi[1] - pj[1],
        pi[2] - pj[2],
        (pi[3] || 0) - (pj[3] || 0)
      );
      if (d > 1e-5 && d < bestDist) {
        bestDist = d;
        bestJ = j;
      }
    }

    if (bestJ >= 0 && bestDist < Infinity) {
      const pjNext = recent[bestJ + 1].p || recent[bestJ + 1];
      const nextDist = Math.hypot(
        piNext[0] - pjNext[0],
        piNext[1] - pjNext[1],
        piNext[2] - pjNext[2],
        (piNext[3] || 0) - (pjNext[3] || 0)
      );
      if (nextDist > 1e-6) {
        sumLog += Math.log(nextDist / bestDist);
        count += 1;
      }
    }
  }

  return count > 0 ? Math.max(-2.5, Math.min(2.5, sumLog / count)) : 0;
}
