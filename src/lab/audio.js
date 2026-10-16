/**
 * Synesthesia Engine — Real-time Web Audio API Polyphonic Synthesizer
 *
 * Maps N-dimensional geometric invariants and real-time feature extraction matrices
 * directly into acoustic wave harmonics:
 *  - Total vertex count -> Base Frequency (Fundamental Pitch)
 *  - N-dimensional depth (color coordinate distribution) -> 8 parallel OscillatorNode overtones
 *  - Hyperplane slicing & slider velocity -> BiquadFilterNode low-pass cutoff & resonance sweep
 */

const VOICE_COUNT = 8;
const MIN_BASE_FREQ = 55.0;  // A1
const MAX_BASE_FREQ = 440.0; // A4
const MIN_CUTOFF_HZ = 120.0;
const MAX_CUTOFF_HZ = 9600.0;

/**
 * Harmonic ratio tables and oscillator wave shapes for topological sonification presets.
 */
export const RESONANCE_PRESETS = Object.freeze({
  default: {
    id: 'default',
    label: 'Topological Harmonics',
    ratios: [1, 1.5, 2, 2.5, 3, 4, 5, 6],
    waveforms: ['sine', 'triangle', 'sine', 'triangle', 'sine', 'sine', 'triangle', 'sine'],
    baseQ: 2.2,
  },
  string_harmonics: {
    id: 'string_harmonics',
    label: 'String Harmonics (KK / Calabi-Yau)',
    ratios: [1, 2, 3, 4, 5, 6, 7, 8],
    waveforms: ['sine', 'triangle', 'sawtooth', 'triangle', 'sine', 'triangle', 'sine', 'sine'],
    baseQ: 3.6,
  },
  e8_symphony: {
    id: 'e8_symphony',
    label: 'E₈ Coxeter Symphony (8-Layer Drone)',
    // Derived from E8 Coxeter exponents (1, 7, 11, 13, 17, 19, 23, 29) normalized over h = 30
    ratios: [1, 37 / 30, 41 / 30, 43 / 30, 47 / 30, 49 / 30, 53 / 30, 59 / 30],
    waveforms: ['sine', 'sine', 'triangle', 'sine', 'triangle', 'sine', 'triangle', 'sine'],
    baseQ: 2.8,
  },
  minor_chord: {
    id: 'minor_chord',
    label: '24-Cell Just Minor Ninth',
    ratios: [1, 6 / 5, 3 / 2, 9 / 5, 2, 12 / 5, 3, 18 / 5],
    waveforms: ['sine', 'triangle', 'sine', 'triangle', 'sine', 'sine', 'triangle', 'sine'],
    baseQ: 2.4,
  },
  major_chord: {
    id: 'major_chord',
    label: 'Polytope Just Major',
    ratios: [1, 5 / 4, 3 / 2, 15 / 8, 2, 5 / 2, 3, 4],
    waveforms: ['sine', 'triangle', 'sine', 'triangle', 'sine', 'sine', 'triangle', 'sine'],
    baseQ: 2.0,
  },
  clifford_torus: {
    id: 'clifford_torus',
    label: 'Clifford Torus Cyclical Loop',
    ratios: [1, 4 / 3, 3 / 2, 2, 8 / 3, 3, 4, 6],
    waveforms: ['sine', 'sine', 'sine', 'sine', 'sine', 'sine', 'sine', 'sine'],
    baseQ: 1.6,
  },
  kaluza_klein: {
    id: 'kaluza_klein',
    label: 'Kaluza-Klein Momentum Tower',
    ratios: [1, 2, 3, 4, 6, 8, 12, 16],
    waveforms: ['sine', 'triangle', 'sawtooth', 'triangle', 'sine', 'triangle', 'sine', 'sine'],
    baseQ: 4.2,
  },
  calabi_yau: {
    id: 'calabi_yau',
    label: 'Calabi-Yau Quintic Filter Sweep',
    ratios: [1, 1.25, 1.5, 1.875, 2.25, 2.5, 3.0, 3.75],
    waveforms: ['triangle', 'sine', 'sawtooth', 'triangle', 'sine', 'triangle', 'sine', 'sine'],
    baseQ: 4.5,
  },
});

function clamp(x, lo, hi) {
  if (!Number.isFinite(x)) return lo;
  return x < lo ? lo : x > hi ? hi : x;
}

/**
 * Resolves a preset descriptor by name or space id.
 */
export function resolvePreset(presetOrSpaceId) {
  const key = String(presetOrSpaceId || 'default')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  if (RESONANCE_PRESETS[key]) return RESONANCE_PRESETS[key];
  if (key === 'e8') return RESONANCE_PRESETS.e8_symphony;
  if (key === '24_cell') return RESONANCE_PRESETS.minor_chord;
  return RESONANCE_PRESETS.default;
}

/**
 * Maps total vertex counts (and active dimension) directly to the Base Frequency
 * (Fundamental Pitch) in Hz.
 *
 * Uses a logarithmic mapping across the manifold vertex spectrum (3..2048+ vertices)
 * combined with a subtle dimensional harmonic offset so each polytope and surface
 * has a distinct musical root pitch.
 */
export function vertexCountToBaseFrequency(vertexCount, dimension = 4) {
  const safeVertices = Math.max(2, Number(vertexCount) || 4);
  const safeDim = clamp(Number(dimension) || 4, 2, 11);
  // Normalize log2(vertexCount) across [log2(3), log2(2048)] -> [0, 1]
  const logNorm = clamp((Math.log2(safeVertices) - 1.58496) / (11.0 - 1.58496), 0, 1);
  // Dimensional harmonic transposition (higher dimensions shift the root slightly upward)
  const dimFactor = 1 + (safeDim - 4) * 0.045;
  // Span 2.5 octaves above 65.41 Hz (C2)
  const pitch = 65.406 * Math.pow(2, logNorm * 2.25) * dimFactor;
  return clamp(pitch, MIN_BASE_FREQ, MAX_BASE_FREQ);
}

/**
 * Maps the N-dimensional depth distribution (matching viewer.js color coordinate logic)
 * to 8 parallel OscillatorNode target frequencies, gains, and detune offsets.
 */
export function depthToVoiceHarmonics(features, baseFrequency, presetId = 'default') {
  const preset = resolvePreset(presetId);
  const depthBands = features?.depthDistribution || features?.vector?.subarray?.(0, VOICE_COUNT) || [];
  const meanDist = features?.meanDistance ?? 0.5;
  const spread = features?.distanceSpread ?? 0.25;
  const dim = features?.dim ?? 4;

  const voices = [];
  for (let i = 0; i < VOICE_COUNT; i++) {
    const bandEnergy = clamp(depthBands[i] ?? 0.35, 0, 1);
    const ratio = preset.ratios[i] || i + 1;
    // Depth band energy & N-D projection spread induce subtle harmonic frequency modulation
    const depthShift = 1 + (bandEnergy - 0.5) * 0.03 * (1 + spread * 0.5);
    const dimHarmonic = 1 + ((dim - 4) * 0.008 * i) / VOICE_COUNT;
    const frequency = clamp(baseFrequency * ratio * depthShift * dimHarmonic, 24, 14000);
    // Voice amplitude scales with vertices occupying this N-D depth band, keeping a floor for the fundamental
    const floor = i === 0 ? 0.22 : i < 3 ? 0.06 : 0.025;
    const rawGain = floor + bandEnergy * (0.28 / Math.pow(i + 1, 0.35));
    const gain = clamp(rawGain * (1.05 - meanDist * 0.2), 0.001, 0.45);
    const detuneCents = (bandEnergy - 0.5) * 18 * ((i % 2 === 0 ? 1 : -1) * (1 + spread));
    voices.push({
      index: i,
      frequency,
      gain,
      detune: detuneCents,
      waveform: preset.waveforms[i] || 'sine',
      bandEnergy,
    });
  }
  return voices;
}

/**
 * Maps hyperplane slicing state and slider velocity directly to BiquadFilterNode
 * low-pass cutoff frequency and Q resonance.
 */
export function sliceToFilterParams(features, presetId = 'default', sliceEnabled = false) {
  const preset = resolvePreset(presetId);
  const speed = clamp(features?.sliceSpeed ?? 0, 0, 1);
  const velocity = clamp(features?.sliceVelocity ?? 0, -1, 1);
  const levelNorm = clamp(features?.vector ? features.vector[12] : (features?.sliceLevel ?? 0) * 0.4 + 0.5, 0, 1);
  const activeRatio = clamp(features?.vector ? features.vector[15] : 1, 0, 1);
  const edgeDensity = clamp(features?.vector ? features.vector[14] : 0.5, 0, 1);

  if (!sliceEnabled) {
    // When unsliced, filter stays open in proportion to edge density and N-D depth spread
    const openCutoff = 1600 + edgeDensity * 4200 + (features?.distanceSpread ?? 0.25) * 1800;
    return {
      cutoffHz: clamp(openCutoff, MIN_CUTOFF_HZ, MAX_CUTOFF_HZ),
      q: clamp(preset.baseQ, 0.7, 14),
    };
  }

  // Slicing active: slider position sweeps the low-pass filter across the spectrum;
  // proximity to the origin (center of the manifold) and active slice segments open the filter,
  // while slider velocity creates a dynamic resonant filter sweep.
  const centerProximity = 1 - Math.abs(levelNorm - 0.5) * 1.85;
  const sweepNorm = clamp(0.15 + 0.55 * Math.max(0, centerProximity) * (0.3 + 0.7 * activeRatio) + 0.45 * speed + 0.1 * velocity, 0, 1);
  const cutoffHz = MIN_CUTOFF_HZ * Math.pow(MAX_CUTOFF_HZ / MIN_CUTOFF_HZ, sweepNorm);
  const q = clamp(preset.baseQ + speed * 7.5 + activeRatio * 2.2, 0.8, 15.0);

  return {
    cutoffHz: clamp(cutoffHz, MIN_CUTOFF_HZ, MAX_CUTOFF_HZ),
    q,
  };
}

/**
 * Polyphonic Web Audio API Synthesizer bound to the N-dimensional feature matrix.
 */
export class SynesthesiaAudioEngine {
  constructor({ AudioContextClass = null } = {}) {
    this.AudioContextClass =
      AudioContextClass ||
      (typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null);
    this.ctx = null;
    this.enabled = false;
    this.masterVolume = 0.35;
    this.preset = 'default';
    this.spaceId = 'calabi-yau';
    this.dimension = 4;
    this.baseFrequency = 110;
    this.cutoffFrequency = 2400;
    this.filterQ = 2.2;
    this.sliceVelocity = 0;
    this.voiceStates = [];
    this.voices = [];
    this.filterNode = null;
    this.compressorNode = null;
    this.analyserNode = null;
    this.masterGain = null;
  }

  /**
   * Lazily initializes the Web Audio API AudioContext and 8-voice polyphonic graph.
   */
  initContext() {
    if (this.ctx || !this.AudioContextClass) return this.ctx;
    const ctx = new this.AudioContextClass();
    this.ctx = ctx;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = this.cutoffFrequency;
    filter.Q.value = this.filterQ;
    this.filterNode = filter;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 16;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.01;
    compressor.release.value = 0.18;
    this.compressorNode = compressor;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;
    this.analyserNode = analyser;

    const master = ctx.createGain();
    master.gain.value = 0.0001;
    this.masterGain = master;

    filter.connect(compressor);
    compressor.connect(analyser);
    analyser.connect(master);
    master.connect(ctx.destination);

    const presetCfg = resolvePreset(this.preset);
    this.voices = [];
    for (let i = 0; i < VOICE_COUNT; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = presetCfg.waveforms[i] || 'sine';
      osc.frequency.value = this.baseFrequency * (presetCfg.ratios[i] || i + 1);
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(filter);
      osc.start();
      this.voices.push({ osc, gain, waveform: osc.type });
    }

    return ctx;
  }

  async setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (this.enabled) {
      const ctx = this.initContext();
      if (ctx && ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        await ctx.resume();
      }
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.06);
      }
    } else if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.05);
    }
    return this.enabled;
  }

  async toggle() {
    return this.setEnabled(!this.enabled);
  }

  setVolume(vol) {
    this.masterVolume = clamp(Number(vol), 0, 1);
    if (this.enabled && this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.04);
    }
  }

  setSpace(spaceId, dim = 4) {
    this.spaceId = spaceId || this.spaceId;
    this.dimension = dim || this.dimension;
    if (this.preset === 'default' || this.autoPreset) {
      this.autoPreset = true;
      if (spaceId === 'e8') this.setPreset('e8_symphony', { auto: true });
      else if (spaceId === 'clifford-torus') this.setPreset('clifford_torus', { auto: true });
      else if (spaceId === 'calabi-yau') this.setPreset('calabi_yau', { auto: true });
      else if (spaceId === 'kaluza-klein') this.setPreset('kaluza_klein', { auto: true });
      else if (spaceId === '24-cell') this.setPreset('minor_chord', { auto: true });
      else this.setPreset('default', { auto: true });
    }
  }

  setPreset(presetId, { auto = false } = {}) {
    const resolved = resolvePreset(presetId);
    this.preset = resolved.id;
    this.autoPreset = auto;
    if (this.voices.length) {
      for (let i = 0; i < this.voices.length; i++) {
        const nextWave = resolved.waveforms[i] || 'sine';
        if (this.voices[i].waveform !== nextWave) {
          this.voices[i].osc.type = nextWave;
          this.voices[i].waveform = nextWave;
        }
      }
    }
    return resolved;
  }

  /**
   * Executes an AI-driven or user-driven resonance directive:
   * e.g., `PLAY_RESONANCE: { preset: 'string_harmonics', dimension: 6 }`
   */
  async playResonance(directive = {}) {
    if (directive.preset) {
      this.setPreset(directive.preset, { auto: false });
    }
    if (Number.isFinite(Number(directive.dimension))) {
      this.dimension = clamp(Math.round(Number(directive.dimension)), 2, 11);
    }
    await this.setEnabled(true);
    return this.getState();
  }

  /**
   * Updates all polyphonic oscillator frequencies, overtone amplitudes, and the
   * BiquadFilterNode cutoff/Q from the real-time feature extraction matrix.
   */
  updateFromFeatures(features, { sliceEnabled = false } = {}) {
    if (!features) return this.getState();

    this.dimension = features.dim || this.dimension;
    this.baseFrequency = vertexCountToBaseFrequency(features.vertexCount, this.dimension);
    this.sliceVelocity = features.sliceVelocity ?? 0;

    const activePreset = this.preset === 'default' ? this.spaceId : this.preset;
    const voiceTargets = depthToVoiceHarmonics(features, this.baseFrequency, activePreset);
    const filterTarget = sliceToFilterParams(features, activePreset, sliceEnabled);

    this.cutoffFrequency = filterTarget.cutoffHz;
    this.filterQ = filterTarget.q;
    this.voiceStates = voiceTargets;

    if (this.enabled && this.ctx && this.voices.length === VOICE_COUNT) {
      const now = this.ctx.currentTime;
      const tau = 0.035;
      this.filterNode.frequency.setTargetAtTime(this.cutoffFrequency, now, tau);
      this.filterNode.Q.setTargetAtTime(this.filterQ, now, tau);

      for (let i = 0; i < VOICE_COUNT; i++) {
        const v = this.voices[i];
        const target = voiceTargets[i];
        v.osc.frequency.setTargetAtTime(target.frequency, now, tau);
        if (v.osc.detune) v.osc.detune.setTargetAtTime(target.detune, now, tau);
        v.gain.gain.setTargetAtTime(target.gain, now, tau);
      }
    }

    return this.getState();
  }

  /**
   * Serializable snapshot of current synthesizer parameters for UI and AI model context.
   */
  getState() {
    return {
      enabled: this.enabled,
      preset: this.preset,
      presetLabel: resolvePreset(this.preset).label,
      dimension: this.dimension,
      baseFrequency: Number(this.baseFrequency.toFixed(2)),
      cutoffFrequency: Math.round(this.cutoffFrequency),
      filterQ: Number(this.filterQ.toFixed(2)),
      sliceVelocity: Number((this.sliceVelocity || 0).toFixed(3)),
      volume: Number(this.masterVolume.toFixed(2)),
      voiceCount: VOICE_COUNT,
      voiceFrequencies: this.voiceStates.map((v) => Math.round(v.frequency)),
    };
  }
}
