import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hypercube,
  simplex,
  orthoplex,
  cell24,
  cell600,
  e8Polytope,
  e8CoxeterElement,
  fVector,
  eulerSum,
  rotationMatrix,
  rotateInto,
  projectTo3,
  sliceByLastAxis,
  hopfFiber,
  linkingNumber,
  fermatPoint,
  fermatSurface,
  cliffordTorus,
  kleinBottle,
  dot,
  FEATURE_CHANNELS,
  projectionOrigin,
  extractFeatureMatrix,
} from '../src/lab/geometry.js';
import {
  vertexCountToBaseFrequency,
  depthToVoiceHarmonics,
  sliceToFilterParams,
  SynesthesiaAudioEngine,
} from '../src/lab/audio.js';
import { SPACES, defaultParams } from '../src/lab/catalog.js';

test('N-cube, simplex and cross-polytope counts match their f-vectors for 2..11 dimensions', () => {
  for (let n = 2; n <= 11; n++) {
    for (const [family, build] of [
      ['cube', hypercube],
      ['simplex', simplex],
      ['orthoplex', orthoplex],
    ]) {
      const g = build(n);
      const f = fVector(family, n);
      assert.equal(g.points.length, f[0], `${family} ${n} vertices`);
      assert.equal(g.edges.length, f[1], `${family} ${n} edges`);
      if (n >= 3) assert.equal(g.faces.length, f[2], `${family} ${n} 2-faces`);
      assert.equal(eulerSum(f), 1 - (-1) ** n, `${family} ${n} Euler-Poincaré`);
    }
  }
});

test('polytopes are scaled to circumradius 1 and simplex edges are all equal', () => {
  for (const g of [hypercube(5), simplex(6), orthoplex(4), cell24(), cell600()]) {
    for (const p of g.points) assert.ok(Math.abs(Math.hypot(...p) - 1) < 1e-9);
  }
  const s = simplex(7);
  const lengths = s.edges.map(([a, b]) => Math.hypot(...s.points[a].map((x, k) => x - s.points[b][k])));
  for (const l of lengths) assert.ok(Math.abs(l - lengths[0]) < 1e-9);
});

test('24-cell and 600-cell have the right vertices, edges, triangles and Euler characteristic', () => {
  const a = cell24();
  assert.deepEqual([a.points.length, a.edges.length, a.faces.length], [24, 96, 96]);
  assert.equal(a.points.length - a.edges.length + a.faces.length - 24, 0);
  const b = cell600();
  assert.deepEqual([b.points.length, b.edges.length, b.faces.length], [120, 720, 1200]);
  assert.equal(b.points.length - b.edges.length + b.faces.length - 600, 0);
  for (let i = 0; i < b.points.length; i++) {
    assert.equal(b.edges.filter((e) => e.includes(i)).length, 12, 'every 600-cell vertex has 12 neighbours');
  }
});

test('E8: 240 roots, 6720 edges, Coxeter element of order 30, Petrie projection is 8 rings of 30', () => {
  const e8 = e8Polytope();
  assert.equal(e8.roots.length, 240);
  for (const r of e8.roots) assert.ok(Math.abs(dot(r, r) - 2) < 1e-12);
  assert.equal(e8.edges.length, 6720);

  const c = e8CoxeterElement();
  let power = c;
  const isIdentity = (m) => m.every((row, i) => row.every((x, j) => Math.abs(x - (i === j ? 1 : 0)) < 1e-9));
  let order = 1;
  while (!isIdentity(power) && order < 100) {
    power = power.map((row) => c[0].map((_, j) => row.reduce((s, x, k) => s + x * c[k][j], 0)));
    order++;
  }
  assert.equal(order, 30);

  const rings = new Map();
  for (const p of e8.points) {
    const key = Math.hypot(p[0], p[1]).toFixed(5);
    rings.set(key, (rings.get(key) || 0) + 1);
  }
  assert.equal(rings.size, 8);
  for (const count of rings.values()) assert.equal(count, 30);
});

test('rotations preserve length in every dimension', () => {
  for (const n of [4, 7, 11]) {
    const m = rotationMatrix(n, [
      { i: 0, j: n - 1, angle: 0.7 },
      { i: 1, j: 3, angle: -1.3 },
      { i: 2, j: n - 2, angle: 2.1 },
    ]);
    const p = Array.from({ length: n }, (_, k) => Math.sin(k + 1));
    const out = rotateInto(m, p, new Array(n));
    assert.ok(Math.abs(Math.hypot(...out) - Math.hypot(...p)) < 1e-12);
  }
});

test('projections: orthographic drops axes, stereographic maps the equator of S³ to the unit sphere', () => {
  assert.deepEqual(projectTo3([1, 2, 3, 4, 5], 'orthographic'), [1, 2, 3]);
  const q = projectTo3([0.6, 0, 0.8, 0], 'stereographic');
  assert.ok(Math.abs(Math.hypot(...q) - 1) < 1e-12);
  assert.deepEqual(projectTo3([1, 2], 'perspective'), [1, 2, 0]);
});

test('slicing the tesseract through its centre gives a cube (12 edges); slicing outside gives nothing', () => {
  const t = hypercube(4);
  assert.equal(sliceByLastAxis(t.points, t.faces, 0).length, 12);
  assert.equal(sliceByLastAxis(t.points, t.faces, 0.9).length, 0);
  const o = orthoplex(4);
  assert.equal(sliceByLastAxis(o.points, o.faces, 0.2).length, 12, 'mid-slice of the 16-cell is an octahedron');
  const c = cell24();
  const segs = sliceByLastAxis(c.points, c.faces, 0);
  assert.ok(segs.length > 0);
  for (const [a, b] of segs) {
    assert.equal(a[3], 0);
    assert.equal(b[3], 0);
  }
});

test('Hopf fibers lie on S³ and any two are linked exactly once', () => {
  const sample = (theta, phi) => Array.from({ length: 240 }, (_, s) => hopfFiber(theta, phi, (2 * Math.PI * s) / 240));
  for (const p of sample(1.1, 0.4)) assert.ok(Math.abs(Math.hypot(...p) - 1) < 1e-12);
  const a = sample(0.9, 0).map((p) => projectTo3(p, 'stereographic'));
  const b = sample(2.2, 2.5).map((p) => projectTo3(p, 'stereographic'));
  assert.ok(Math.abs(Math.abs(linkingNumber(a, b)) - 1) < 0.02);
});

test('Fermat surface points satisfy z₁ⁿ + z₂ⁿ = 1', () => {
  const cpow = ([re, im], n) => {
    const r = Math.hypot(re, im) ** n;
    const t = Math.atan2(im, re) * n;
    return [r * Math.cos(t), r * Math.sin(t)];
  };
  for (const n of [2, 3, 5, 7]) {
    for (const [a, b, k1, k2] of [
      [0.3, 0.4, 0, 1],
      [1.1, -0.8, n - 1, 0],
      [0.7, 0.1, 1, n - 1],
    ]) {
      const [x, y, u, v] = fermatPoint(a, b, k1, k2, n);
      const p = cpow([x, u], n);
      const q = cpow([y, v], n);
      assert.ok(Math.abs(p[0] + q[0] - 1) < 1e-9 && Math.abs(p[1] + q[1]) < 1e-9);
    }
  }
  assert.equal(fermatSurface(5, 8).points.length, 25 * 81);
});

test('Clifford torus lies on the unit 3-sphere; Klein bottle is 4D', () => {
  for (const p of cliffordTorus(8).points) assert.ok(Math.abs(Math.hypot(...p) - 1) < 1e-12);
  const k = kleinBottle(8);
  assert.equal(k.dim, 4);
  assert.ok(k.triangles.length > 0);
});

test('every catalog space builds with its default parameters and has notes and facts', () => {
  for (const space of SPACES) {
    const params = defaultParams(space);
    const geo = space.build(params);
    assert.ok(geo.points.length > 0, space.id);
    assert.ok(geo.edges.every(([a, b]) => a < geo.points.length && b < geo.points.length), `${space.id} edges in range`);
    assert.ok(space.notes.what && space.notes.how && space.notes.tryThis.length, space.id);
    assert.ok(space.facts(params, geo).length > 0, space.id);
    assert.ok(space.badge(params));
  }
});

test('extractFeatureMatrix exposes normalized distances, slice velocity, and f-vector counts across manifolds', () => {
  for (const geo of [fermatSurface(5, 8), e8Polytope(), cliffordTorus(16), hypercube(6)]) {
    const feat = extractFeatureMatrix(geo, geo.points, {
      projection: 'perspective',
      cameraDistance: 2.4,
      sliceEnabled: true,
      sliceLevel: 0.25,
      prevSliceLevel: -0.05,
      dt: 1 / 60,
      sliceSegments: 12,
    });
    assert.equal(feat.vector.length, 16);
    assert.equal(feat.vertexDistances.length, geo.points.length);
    assert.equal(feat.depthDistribution.length, 8);
    for (const v of feat.vector) assert.ok(v >= 0 && v <= 1, `feature vector entry ${v} in [0, 1]`);
    for (const d of feat.vertexDistances) assert.ok(d >= 0 && d <= 1, `vertex distance ${d} in [0, 1]`);
    assert.ok(feat.sliceVelocity > 0, 'positive slider delta yields positive sliceVelocity');
    assert.ok(feat.sliceSpeed > 0 && feat.sliceSpeed <= 1);
    assert.equal(feat.vertexCount, geo.points.length);
    assert.equal(feat.edgeCount, geo.edges.length);
    assert.equal(feat.activeEdges, 12);
    assert.equal(feat.activeVertices, 24);
  }

  const originPersp = projectionOrigin(5, 'perspective', 2.4);
  assert.deepEqual(originPersp, [0, 0, 0, 2.4, 2.4]);
  const originStereo = projectionOrigin(4, 'stereographic', 2.4);
  assert.deepEqual(originStereo, [0, 0, 0, 1]);
});

test('SynesthesiaAudioEngine maps feature matrix to base pitch, 8 overtones, and low-pass filter sweep', async () => {
  const e8 = e8Polytope();
  const cube4 = hypercube(4);
  const fCube = extractFeatureMatrix(cube4, cube4.points, { sliceEnabled: false });
  const fE8 = extractFeatureMatrix(e8, e8.points, {
    sliceEnabled: true,
    sliceLevel: 0.1,
    prevSliceLevel: -0.4,
    dt: 1 / 60,
    sliceSegments: 24,
  });

  const pitchCube = vertexCountToBaseFrequency(fCube.vertexCount, fCube.dim);
  const pitchE8 = vertexCountToBaseFrequency(fE8.vertexCount, fE8.dim);
  assert.ok(pitchE8 > pitchCube, 'higher vertex count and dimension map to higher fundamental pitch');

  const voices = depthToVoiceHarmonics(fE8, pitchE8, 'e8_symphony');
  assert.equal(voices.length, 8);
  for (const v of voices) {
    assert.ok(v.frequency >= 24 && v.frequency <= 14000);
    assert.ok(v.gain > 0 && v.gain <= 0.45);
  }

  const filterIdle = sliceToFilterParams(fCube, 'default', false);
  const filterSweep = sliceToFilterParams(fE8, 'calabi_yau', true);
  assert.ok(filterSweep.q > filterIdle.q, 'active slicing velocity boosts filter resonance Q');

  // Verify polyphonic Web Audio node graph with a lightweight mock AudioContext
  const makeParam = (initial = 0) => ({
    value: initial,
    targets: [],
    setTargetAtTime(val, t, tau) {
      this.value = val;
      this.targets.push({ val, t, tau });
    },
  });
  class MockAudioContext {
    constructor() {
      this.currentTime = 1.0;
      this.state = 'suspended';
      this.destination = {};
    }
    async resume() {
      this.state = 'running';
    }
    createBiquadFilter() {
      return { type: 'lowpass', frequency: makeParam(1000), Q: makeParam(1), connect() {} };
    }
    createDynamicsCompressor() {
      return {
        threshold: makeParam(),
        knee: makeParam(),
        ratio: makeParam(),
        attack: makeParam(),
        release: makeParam(),
        connect() {},
      };
    }
    createAnalyser() {
      return { fftSize: 256, smoothingTimeConstant: 0.8, connect() {} };
    }
    createGain() {
      return { gain: makeParam(0), connect() {} };
    }
    createOscillator() {
      return {
        type: 'sine',
        frequency: makeParam(110),
        detune: makeParam(0),
        connect() {},
        start() {},
      };
    }
  }

  const engine = new SynesthesiaAudioEngine({ AudioContextClass: MockAudioContext });
  await engine.playResonance({ preset: 'string_harmonics', dimension: 6 });
  assert.equal(engine.enabled, true);
  assert.equal(engine.preset, 'string_harmonics');
  assert.equal(engine.dimension, 6);
  assert.equal(engine.voices.length, 8);

  const state = engine.updateFromFeatures(fE8, { sliceEnabled: true });
  assert.equal(state.voiceFrequencies.length, 8);
  assert.ok(engine.filterNode.frequency.targets.length > 0);
});
