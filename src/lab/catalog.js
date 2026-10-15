import {
  hypercube,
  simplex,
  orthoplex,
  cell24,
  cell600,
  cliffordTorus,
  kleinBottle,
  fermatSurface,
  hopfFibration,
  e8Polytope,
  compactCylinder,
  fVector,
  eulerSum,
} from './geometry.js';

const FAMILY_NAMES = { cube: 'hypercube', simplex: 'simplex', orthoplex: 'cross-polytope' };

function familyFacts(family, dim, geo) {
  const f = fVector(family, dim);
  const labels = ['vertices', 'edges', '2-faces', '3-cells', '4-faces', '5-faces', '6-faces', '7-faces', '8-faces', '9-faces', '10-faces'];
  const rows = [
    ['Dimension', `${dim}`],
    ['Vertices (counted)', `${geo.points.length}`],
    ['Edges (counted)', `${geo.edges.length}`],
    ['2-faces (counted)', `${geo.faces.length}`],
  ];
  rows.push(['f-vector', f.map((x, k) => `${x} ${labels[k]}`).join(' · ')]);
  rows.push(['Euler sum Σ(−1)ᵏfₖ', `${eulerSum(f)} (= 1 − (−1)^${dim}, as for every convex ${dim}-polytope)`]);
  return rows;
}

function ladder(family, title, blurb) {
  return {
    id: `${family}-n`,
    group: 'Dimension ladder · 2D–11D',
    title,
    params: [{ key: 'dim', label: 'Dimensions', min: 2, max: 11, step: 1, value: 4 }],
    projection: 'perspective',
    autoSpin: true,
    sliceable: true,
    build: ({ dim }) => {
      const g = family === 'cube' ? hypercube(dim) : family === 'simplex' ? simplex(dim) : orthoplex(dim);
      return g;
    },
    badge: ({ dim }) => `${dim}D ${FAMILY_NAMES[family].toUpperCase()}`,
    facts: ({ dim }, geo) => familyFacts(family, dim, geo),
    notes: blurb,
  };
}

export const SPACES = [
  {
    id: 'calabi-yau',
    group: 'Calabi-Yau',
    title: 'Calabi-Yau cross-section (Fermat curve)',
    params: [
      { key: 'n', label: 'Degree n', min: 2, max: 7, step: 1, value: 5 },
      { key: 'steps', label: 'Mesh density', min: 8, max: 22, step: 2, value: 14 },
    ],
    projection: 'orthographic',
    initialAngles: { zw: 0.68 },
    autoSpin: false,
    sliceable: true,
    build: ({ n, steps }) => fermatSurface(n, steps),
    badge: ({ n }) => `z₁${sup(n)} + z₂${sup(n)} = 1`,
    facts: ({ n }) => [
      ['Equation', `z₁${sup(n)} + z₂${sup(n)} = 1 in ℂ²`],
      ['Real dimension', '2 (a complex curve), drawn in ℝ⁴'],
      ['Patches', `${n * n} (one per pair of ${n}th roots of unity)`],
      ['Genus of the closed curve', `${((n - 1) * (n - 2)) / 2} = (n−1)(n−2)/2`],
      ['The 6D space it slices', n === 5 ? 'Quintic threefold in ℂℙ⁴: χ = −200, h¹¹ = 1, h²¹ = 101' : `Degree-${n} hypersurface in ℂℙ⁴ (Calabi-Yau only when n = 5)`],
    ],
    notes: {
      what: 'The famous "Calabi-Yau" picture. The real object string theory uses is the quintic threefold, a 6-dimensional space. This is the standard way to draw it: take the complex curve z₁ⁿ + z₂ⁿ = 1, a 2D surface living in 4 real dimensions, and look at it from a 3D angle.',
      how: 'Coordinates are (Re z₁, Re z₂, Im z₁, Im z₂). The view drops the 4th coordinate after a rotation in the z–w plane, which is the angle ξ from Hanson\'s original images. Each colour is one of the n² patches.',
      tryThis: [
        'Move "z ↔ w" slowly. You are turning a 4D object; the surface seems to pass through itself because you only see its 3D shadow.',
        'Set degree to 2: the curve is a smooth cylinder-like sheet with genus 0. Raise it and watch the holes (genus) grow.',
        'Turn on the slice. The bright curve is the exact set where the hidden 4th coordinate equals your slider.',
      ],
    },
  },
  ladder('cube', 'Hypercube (N-cube)', {
    what: 'A square is a 2-cube, a cube is a 3-cube, a tesseract is a 4-cube. The same rule (every coordinate is ±1) gives a cube in any number of dimensions. You see a shadow of it.',
    how: 'Vertices (±1)ᴺ. Edges join vertices that differ in one coordinate. Each extra axis is drawn with its own perspective camera, so far-away parts in the 4th, 5th, … axis look smaller.',
    tryThis: [
      'Step the dimension from 2 to 5. Each new cube is two copies of the old one with matching corners joined.',
      'At 4D, enable the slice and sweep it. A cube appears, morphs and vanishes, like a square passing through Flatland.',
      'Count: an N-cube has 2ᴺ corners. At 11D that is 2048 corners and 11264 edges, all drawn.',
    ],
  }),
  ladder('simplex', 'Simplex (N-simplex)', {
    what: 'The simplest shape in each dimension: a segment, a triangle, a tetrahedron, then the 5-cell in 4D. N+1 points, every pair joined.',
    how: 'Built from the N+1 unit vectors of ℝᴺ⁺¹, centred, and rewritten in an orthonormal basis of the hyperplane they span.',
    tryThis: [
      'Every vertex touches every other one, in any dimension. Count the edges: C(N+1, 2).',
      'At 4D, slice it. The cross-sections are tetrahedra and triangular prisms.',
    ],
  }),
  ladder('orthoplex', 'Cross-polytope (N-orthoplex)', {
    what: 'The diamond family: a square tilted 45°, an octahedron, then the 16-cell in 4D. Points one unit along each axis, both directions.',
    how: 'Vertices ±eᵢ. Every pair is joined except opposite points. It is the dual of the hypercube: corners of one sit at the face centres of the other.',
    tryThis: [
      'Compare its f-vector with the hypercube of the same dimension: the lists are the same numbers in reverse order.',
      'At 4D the slice through the middle is an octahedron.',
    ],
  }),
  {
    id: '24-cell',
    group: '4D regular polytopes',
    title: '24-cell {3,4,3}',
    params: [],
    projection: 'perspective',
    autoSpin: true,
    sliceable: true,
    build: () => cell24(),
    badge: () => '4D 24-CELL',
    facts: (_, geo) => [
      ['Vertices / edges / triangles', `${geo.points.length} / ${geo.edges.length} / ${geo.faces.length}`],
      ['Cells', '24 octahedra'],
      ['Euler check V − E + F − C', `${geo.points.length} − ${geo.edges.length} + ${geo.faces.length} − 24 = ${geo.points.length - geo.edges.length + geo.faces.length - 24}`],
      ['Symmetry group', 'F₄, order 1152'],
    ],
    notes: {
      what: 'A regular 4D solid made of 24 octahedra. It has no analogue in any other dimension, and it is its own dual.',
      how: 'Vertices are the 24 permutations of (±1, ±1, 0, 0). Edges join nearest neighbours.',
      tryThis: ['Slice through the centre with no rotation: the cross-section is a cuboctahedron.', 'Spin with only "x ↔ w" and look for the octahedral cells turning inside out.'],
    },
  },
  {
    id: '600-cell',
    group: '4D regular polytopes',
    title: '600-cell {3,3,5}',
    params: [],
    projection: 'perspective',
    autoSpin: true,
    sliceable: true,
    build: () => cell600(),
    badge: () => '4D 600-CELL',
    facts: (_, geo) => [
      ['Vertices / edges / triangles', `${geo.points.length} / ${geo.edges.length} / ${geo.faces.length}`],
      ['Cells', '600 tetrahedra'],
      ['Euler check V − E + F − C', `${geo.points.length} − ${geo.edges.length} + ${geo.faces.length} − 600 = ${geo.points.length - geo.edges.length + geo.faces.length - 600}`],
      ['Symmetry group', 'H₄, order 14400'],
      ['Edge length', '1/φ ≈ 0.618 (circumradius 1)'],
    ],
    notes: {
      what: 'The 4D cousin of the icosahedron: 600 tetrahedra, five around every edge. Its 120 vertices form a group (the binary icosahedral group) under quaternion multiplication.',
      how: '8 vertices (±1,0,0,0), 16 vertices (±½,±½,±½,±½), and 96 even permutations of ½(±φ, ±1, ±1/φ, 0). Edges are pairs at distance 1/φ.',
      tryThis: ['Switch projection to stereographic for the classic "soap-bubble" view.', 'Sweep the slice: the cross-sections pass through an icosahedron.'],
    },
  },
  {
    id: 'clifford-torus',
    group: 'Surfaces in 4D',
    title: 'Clifford torus',
    params: [{ key: 'steps', label: 'Mesh density', min: 12, max: 48, step: 4, value: 32 }],
    projection: 'stereographic',
    autoSpin: true,
    sliceable: true,
    build: ({ steps }) => cliffordTorus(steps),
    badge: () => 'S¹ × S¹ ⊂ S³',
    facts: () => [
      ['Definition', '|z₁| = |z₂| = 1/√2 in ℂ²'],
      ['Gaussian curvature', 'K = 0 everywhere (flat)'],
      ['Euler characteristic', 'χ = 0'],
      ['Lives on', 'the unit 3-sphere S³ ⊂ ℝ⁴'],
    ],
    notes: {
      what: 'A torus that is completely flat, like a sheet of paper rolled both ways. That is impossible in 3D, where every closed torus must curve, but easy in 4D.',
      how: 'Points (cos a, sin a, cos b, sin b)/√2, then stereographic projection from the north pole of S³, which keeps circles as circles.',
      tryThis: ['Spin it: the torus turns inside out, the hole and the tube swapping places. That is a rotation of S³.', 'Its slice at w = 0 is two circles.'],
    },
  },
  {
    id: 'hopf',
    group: 'Surfaces in 4D',
    title: 'Hopf fibration',
    params: [
      { key: 'latitudes', label: 'Latitude rings', min: 1, max: 6, step: 1, value: 3 },
      { key: 'fibers', label: 'Fibers per ring', min: 6, max: 36, step: 2, value: 18 },
    ],
    projection: 'stereographic',
    autoSpin: true,
    sliceable: false,
    build: ({ latitudes, fibers }) => hopfFibration(latitudes, fibers),
    badge: () => 'S¹ → S³ → S²',
    facts: () => [
      ['Map', 'S³ → S², every fiber a great circle'],
      ['Linking number of any two fibers', '1 (checked numerically in the test suite)'],
      ['Fibers over one latitude', 'fill a torus'],
      ['Discovered', 'Heinz Hopf, 1931'],
    ],
    notes: {
      what: 'The 3-sphere is a family of circles, one for every point on an ordinary sphere. No two circles touch, yet every pair is linked like two rings of a chain.',
      how: 'A point (θ, φ) on S² lifts to the circle (cos(θ/2) e^{i(ψ+φ/2)}, sin(θ/2) e^{i(ψ−φ/2)}). Stereographic projection turns these great circles into round circles in ℝ³ (one through the pole becomes a straight line).',
      tryThis: ['Use 1 latitude ring: you get circles on a single torus, each linked with all the others.', 'Add rings: nested tori, the classic picture of the fibration.'],
    },
  },
  {
    id: 'klein-bottle',
    group: 'Surfaces in 4D',
    title: 'Klein bottle',
    params: [{ key: 'steps', label: 'Mesh density', min: 16, max: 56, step: 4, value: 36 }],
    projection: 'perspective',
    initialAngles: { yw: 0.9 },
    autoSpin: false,
    sliceable: true,
    build: ({ steps }) => kleinBottle(steps),
    badge: () => 'NON-ORIENTABLE',
    facts: () => [
      ['Euler characteristic', 'χ = 0'],
      ['Orientable', 'No (one-sided)'],
      ['Embeds without self-intersection in', 'ℝ⁴ (not ℝ³)'],
    ],
    notes: {
      what: 'A bottle with no inside. In 3D it has to pass through itself; in 4D it does not. The surface you see seems to cross itself only because you are looking at a 3D shadow.',
      how: 'A tube whose cross-section circle turns half a revolution through the 4th dimension as it goes around: z = r sin v cos(u/2), w = r sin v sin(u/2).',
      tryThis: ['Turn on the slice and sweep it. Near the apparent crossing, the two sheets light up at different w: they never actually meet.'],
    },
  },
  {
    id: 'e8',
    group: 'Beyond 4D',
    title: 'E₈ root system (8D)',
    params: [],
    projection: 'orthographic',
    autoSpin: false,
    sliceable: false,
    build: () => e8Polytope(),
    badge: () => '8D E₈ · 240 ROOTS',
    facts: (_, geo) => [
      ['Roots (counted)', `${geo.points.length}`],
      ['Edges (roots at 60°)', `${geo.edges.length} (56 per root)`],
      ['Petrie projection rings', `${geo.rings} rings of 30`],
      ['Coxeter number', '30'],
      ['Lie algebra dimension', '248 = 240 roots + rank 8'],
    ],
    notes: {
      what: 'The 240 shortest vectors of the E₈ lattice, the densest way to pack spheres in 8 dimensions. E₈ shows up in string theory (the E₈ × E₈ heterotic string) and in the Gosset polytope 4₂₁.',
      how: 'The view axis is computed, not hard-coded: the Coxeter element c = s₁…s₈ is built from the simple reflections, and the plane it rotates by 2π/30 is extracted with a projector. Looking down that plane gives the famous 8 rings of 30.',
      tryThis: ['Leave rotations at zero for the Petrie picture.', 'Nudge "x ↔ w": the rings break apart as the 8D object turns out of the Coxeter plane.'],
    },
  },
  {
    id: 'kaluza-klein',
    group: 'Beyond 4D',
    title: 'Compact extra dimension',
    params: [{ key: 'radius', label: 'Circle radius R', min: 0.01, max: 0.6, step: 0.01, value: 0.3 }],
    projection: 'perspective',
    autoSpin: false,
    sliceable: false,
    build: ({ radius }) => compactCylinder(radius),
    badge: ({ radius }) => `ℝ × S¹ (R = ${radius.toFixed(2)})`,
    facts: ({ radius }) => [
      ['Shape', 'a line × a circle of radius R'],
      ['Momentum around the circle', 'quantised: pₙ = n·ħ/R'],
      ['First masses mₙ = n·ħ/(Rc)', [1, 2, 3].map((k) => (k / radius).toFixed(1)).join(', ') + ' (units of ħ/c per unit length)'],
      ['Idea', 'Kaluza 1921, Klein 1926'],
    ],
    notes: {
      what: 'How a dimension can hide. Every point of the line carries a small circle. Seen from far away, or with a small enough circle, the object looks one-dimensional.',
      how: 'Points (x, R cos t, R sin t). This is the "garden hose" picture used to explain the curled-up dimensions of string theory, where the circle becomes a 6D Calabi-Yau space.',
      tryThis: ['Drag R down to 0.01. The hose collapses to a line, and the energy needed to move around the circle (the first mass) shoots up as 1/R.'],
    },
  },
];

function sup(n) {
  return String(n)
    .split('')
    .map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)])
    .join('');
}

export function getSpace(id) {
  return SPACES.find((s) => s.id === id) || SPACES[0];
}

export function defaultParams(space) {
  return Object.fromEntries(space.params.map((p) => [p.key, p.value]));
}