import test from 'node:test';
import assert from 'node:assert/strict';

import {
  InferenceInstrument,
  STATE_DIMENSIONS,
  TokenFeatureExtractor,
  powerSpectrum,
  bandEnergies,
  spectralCentroid,
  spectralFlatness,
  sheetEnergyMatrix,
  TrajectoryTracker,
  discreteFrechet,
  RegimeDetector,
  FingerprintStore,
  fingerprintDistance,
  jensenShannonDistance,
  bhattacharyya,
  InterferenceField,
  ControlSurface,
  evaluateCalabiYauPoint,
  FP_BANDS,
} from '../src/instrument/index.js';

class MemoryStorage {
  constructor() {
    this.map = new Map();
  }
  getItem(k) {
    return this.map.has(k) ? this.map.get(k) : null;
  }
  setItem(k, v) {
    this.map.set(k, String(v));
  }
  removeItem(k) {
    this.map.delete(k);
  }
}

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const WORDS =
  'the manifold encodes timing and content modes while the model streams tokens across distinct sheets of a fermat surface with curvature winding and spectral energy'.split(
    ' '
  );

function runStream(instrument, { tokens = 200, dt = () => 30, text = (i) => ` ${WORDS[i % WORDS.length]}`, thinking = () => false } = {}) {
  let t = 1000;
  instrument.start(t);
  let frame = null;
  for (let i = 0; i < tokens; i++) {
    t += dt(i);
    frame = instrument.push({ token: text(i), thinking: thinking(i), tMs: t });
  }
  return frame;
}

test('Fermat point satisfies z1^n + z2^n = 1 on every sheet', () => {
  for (const n of [3, 5, 7]) {
    for (let k1 = 0; k1 < n; k1++) {
      for (let k2 = 0; k2 < n; k2++) {
        const pt = evaluateCalabiYauPoint(0.6, 0.3, k1, k2, n, 0.68);
        const pow = ([re, im]) => {
          const r = Math.hypot(re, im) ** n;
          const a = Math.atan2(im, re) * n;
          return [r * Math.cos(a), r * Math.sin(a)];
        };
        const a = pow(pt.z1);
        const b = pow(pt.z2);
        assert.ok(Math.abs(a[0] + b[0] - 1) < 1e-9, `re n=${n}`);
        assert.ok(Math.abs(a[1] + b[1]) < 1e-9, `im n=${n}`);
      }
    }
  }
});

test('power spectrum localizes a pure tone to the right band', () => {
  const N = 32;
  const lowTone = Array.from({ length: N }, (_, i) => Math.sin((2 * Math.PI * 2 * i) / N));
  const highTone = Array.from({ length: N }, (_, i) => Math.sin((2 * Math.PI * 14 * i) / N));
  const low = bandEnergies(powerSpectrum(lowTone), 4);
  const high = bandEnergies(powerSpectrum(highTone), 4);
  assert.equal(low.indexOf(Math.max(...low)), 0);
  assert.equal(high.indexOf(Math.max(...high)), 3);
  assert.ok(spectralCentroid(powerSpectrum(highTone)) > spectralCentroid(powerSpectrum(lowTone)));
});

test('spectral flatness separates noise from a tone', () => {
  const rand = seededRandom(7);
  const noise = Array.from({ length: 64 }, () => rand() - 0.5);
  const tone = Array.from({ length: 64 }, (_, i) => Math.sin((2 * Math.PI * 5 * i) / 64));
  assert.ok(spectralFlatness(powerSpectrum(noise)) > 0.3);
  assert.ok(spectralFlatness(powerSpectrum(tone)) < 0.05);
});

test('sheet energy matrix is a normalized outer product', () => {
  const m = sheetEnergyMatrix(Float64Array.from([1, 0, 0]), Float64Array.from([0, 0, 1]));
  assert.equal(m.length, 9);
  assert.ok(Math.abs(m.reduce((s, v) => s + v, 0) - 1) < 1e-12);
  assert.equal(m.indexOf(Math.max(...m)), 0 * 3 + 2);
});

test('token features track repetition and entropy', () => {
  const fx = new TokenFeatureExtractor();
  let t = 0;
  let f;
  for (let i = 0; i < 120; i++) {
    t += 20;
    f = fx.push({ token: ' the same phrase again', tMs: t });
  }
  assert.ok(f.repetition > 0.8, `repetition ${f.repetition}`);
  assert.ok(f.novelty < 0.05);

  const fx2 = new TokenFeatureExtractor();
  const rand = seededRandom(3);
  t = 0;
  for (let i = 0; i < 120; i++) {
    t += 20;
    const word = Array.from({ length: 5 }, () => String.fromCharCode(97 + Math.floor(rand() * 26))).join('');
    f = fx2.push({ token: ` ${word}`, tMs: t });
  }
  assert.ok(f.repetition < 0.05);
  assert.ok(f.entropy > 4.0, `entropy ${f.entropy}`);
  assert.ok(f.tokensPerSec > 40 && f.tokensPerSec < 60);
});

test('trajectory metrics: arc length, winding, Fréchet', () => {
  const tr = new TrajectoryTracker();
  for (let i = 0; i < 50; i++) tr.push({ u: i / 49, v: 0.5, k1: 0, k2: 0, n: 5, xi: 0.68 });
  const m = tr.metrics();
  assert.ok(m.arcLength > 0);
  assert.equal(m.sheetTransitions, 0);

  const cycle = new TrajectoryTracker();
  for (let rep = 0; rep < 2; rep++) {
    for (let k = 0; k < 5; k++) cycle.push({ u: 0.5, v: 0.5, k1: k, k2: 0, n: 5, xi: 0.68 });
  }
  cycle.push({ u: 0.5, v: 0.5, k1: 0, k2: 0, n: 5, xi: 0.68 });
  assert.ok(Math.abs(Math.abs(cycle.metrics().winding) - 2) < 1e-9, `winding ${cycle.metrics().winding}`);
  assert.equal(cycle.metrics().sheetTransitions, 10);

  const P = tr.resample(32);
  assert.equal(discreteFrechet(P, P), 0);
  const shifted = P.map((p) => [p[0] + 0.5, p[1], p[2], p[3]]);
  assert.ok(Math.abs(discreteFrechet(P, shifted) - 0.5) < 1e-9);
});

test('regime detector flags repetition, stalls and reasoning→answer transitions', () => {
  const det = new RegimeDetector();
  const fx = new TokenFeatureExtractor();
  let t = 0;
  const types = new Set();
  for (let i = 0; i < 80; i++) {
    t += i === 50 ? 5000 : 25;
    const f = fx.push({ token: ' loop loop loop', thinking: i < 30, tMs: t });
    for (const ev of det.update(f)) types.add(ev.type);
  }
  assert.ok(types.has('repetition'));
  assert.ok(types.has('stall'));
  assert.ok(types.has('phase-change'));
});

test('instrument exposes an 11-dimensional state and a comparable fingerprint', () => {
  const inst = new InferenceInstrument({ provider: 'p', model: 'm', n: 5 });
  const frame = runStream(inst);
  assert.equal(STATE_DIMENSIONS.length, 11);
  const vec = inst.stateVector();
  assert.equal(vec.length, 11);
  assert.ok(vec.every(Number.isFinite));
  assert.equal(frame.sheet.length, 25);

  const fp = inst.finish();
  assert.equal(fp.sheet.length, FP_BANDS * FP_BANDS);
  assert.ok(Math.abs(fp.sheet.reduce((s, v) => s + v, 0) - 1) < 1e-9);
  assert.equal(fp.trajectory.length, 64);
  assert.ok(fp.stats.tokensPerSec > 30);
  assert.equal(fingerprintDistance(fp, fp).total, 0);
});

test('fingerprints separate steady from jittery generators', () => {
  const make = (seed, jitter) => {
    const rand = seededRandom(seed);
    const inst = new InferenceInstrument({ provider: jitter ? 'jitter' : 'steady', model: 'x' });
    runStream(inst, {
      tokens: 240,
      dt: (i) => (jitter ? (i % 2 ? 8 : 90) + rand() * 5 : 30 + Math.sin(i / 20) * 10 + rand()),
    });
    return inst.finish();
  };
  const steadyA = make(1, false);
  const steadyB = make(2, false);
  const jitterA = make(3, true);
  const dSame = fingerprintDistance(steadyA, steadyB).total;
  const dDiff = fingerprintDistance(steadyA, jitterA).total;
  assert.ok(dDiff > dSame * 2, `same=${dSame} diff=${dDiff}`);
  assert.ok(jitterA.stats.timingCentroid > steadyA.stats.timingCentroid);

  const store = new FingerprintStore(new MemoryStorage());
  store.save(steadyB);
  store.save(jitterA);
  const ranked = store.rank(steadyA);
  assert.equal(ranked[0].fingerprint.provider, 'steady');
});

test('distribution distances are bounded', () => {
  const p = [1, 0, 0];
  const q = [0, 0, 1];
  assert.ok(Math.abs(jensenShannonDistance(p, q) - 1) < 1e-9);
  assert.equal(jensenShannonDistance(p, p), 0);
  assert.equal(bhattacharyya(p, q), 0);
  assert.ok(Math.abs(bhattacharyya(p, p) - 1) < 1e-12);
});

test('interference field mixes lanes and reports takeover', () => {
  const field = new InterferenceField();
  const a = new InferenceInstrument({ runId: 'a', color: '#ff0000' });
  const b = new InferenceInstrument({ runId: 'b', color: '#0000ff' });
  runStream(a, { tokens: 60 });
  runStream(b, { tokens: 60, dt: () => 90 });
  let res = field.update([a, b], a.lastMs);
  assert.equal(res.lanes.length, 2);
  assert.ok(res.coherence >= 0 && res.coherence <= 1);
  assert.equal(res.dominant, 'a');

  const later = a.lastMs + 6000;
  b.lastMs = later;
  field.update([a, b], later);
  res = field.update([a, b], later + 900);
  assert.ok(res.events.some((e) => e.type === 'takeover' && e.to === 'b'));
});

test('control surface inverts targets into sampling params, routing and a closed loop', () => {
  const cs = new ControlSurface(new MemoryStorage());
  assert.equal(cs.samplingParams(), null);
  cs.setMode('open');
  cs.setTarget({ n: 5, k1: 0, k2: 4 });
  const hot = cs.samplingParams();
  cs.setTarget({ k2: 0 });
  const cold = cs.samplingParams();
  assert.ok(hot.temperature > cold.temperature);
  assert.ok(hot.topP > cold.topP);

  cs.setMode('closed');
  cs.setTarget({ k2: 4 });
  const before = cs.samplingParams().temperature;
  cs.observe({ tokens: 100, stats: { contentCentroid: 0.2 }, regimes: { repetition: 1 } });
  const after = cs.samplingParams();
  assert.ok(after.temperature > before);
  assert.ok(after.repetitionPenalty > 0);

  const held = cs.bias;
  cs.observe({ tokens: 100, stats: { contentCentroid: 0.0 }, regimes: {} }, { actuated: false });
  assert.equal(cs.bias, held);

  const steady = new InferenceInstrument({ provider: 'steady', model: 's' });
  runStream(steady, { dt: () => 30 });
  const jitter = new InferenceInstrument({ provider: 'jitter', model: 'j' });
  runStream(jitter, { dt: (i) => (i % 2 ? 8 : 90) });
  const fps = [steady.finish(), jitter.finish()];
  const target = jitter.finish();
  const k1 = target.timingSpectrum.indexOf(Math.max(...target.timingSpectrum));
  cs.setTarget({ n: FP_BANDS, k1, k2: target.contentSpectrum.indexOf(Math.max(...target.contentSpectrum)) });
  const ranking = cs.route(fps);
  assert.equal(ranking.length, 2);
  assert.equal(ranking[0].provider, 'jitter');
});
