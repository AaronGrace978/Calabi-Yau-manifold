/**
 * Regime detection over token features. Stateful regimes use enter/exit hysteresis so a
 * borderline signal does not flap; instantaneous events (stall, phase change, spectral shift)
 * fire once with a cooldown.
 */

export const REGIME_LABELS = Object.freeze({
  repetition: 'REPETITION LOOP',
  'mode-collapse': 'MODE COLLAPSE',
  'tool-storm': 'TOOL / JSON STORM',
  burst: 'THROUGHPUT BURST',
  stall: 'STALL',
  'phase-change': 'REASONING → ANSWER',
  'spectral-shift': 'SPECTRAL REGIME SHIFT',
});

const WARMUP_TOKENS = 24;
const SHIFT_COOLDOWN = 24;
const HISTORY = 128;

export class RegimeDetector {
  constructor() {
    this.reset();
  }

  reset() {
    this.active = new Set();
    this.dtHistory = [];
    this.tpsHistory = [];
    this.noveltyEma = 0.5;
    this.sawThinking = false;
    this.prevThinking = null;
    this.lastShiftIndex = -Infinity;
    this.events = [];
  }

  /**
   * @param {import('./tokenFeatures.js').TokenFeatures} f
   * @param {{sheetShift?: number}} spectral L1 distance (0..2) between the short-window sheet
   *   distribution and the run's long-term average
   * @returns {Array<{type:string,label:string,index:number,tMs:number,value:number,state:'enter'|'exit'|'event'}>}
   */
  update(f, spectral = {}) {
    const out = [];
    const emit = (type, value, state = 'event') => {
      const ev = { type, label: REGIME_LABELS[type], index: f.index, tMs: f.tMs, value, state };
      out.push(ev);
      this.events.push(ev);
    };
    const toggle = (type, enter, exit, value) => {
      if (!this.active.has(type) && enter) {
        this.active.add(type);
        emit(type, value, 'enter');
      } else if (this.active.has(type) && exit) {
        this.active.delete(type);
        emit(type, value, 'exit');
      }
    };

    this.noveltyEma += (f.novelty - this.noveltyEma) * 0.12;

    if (!f.isFirst) {
      const medDt = median(this.dtHistory);
      if (this.dtHistory.length >= 8 && f.dtMs > Math.max(800, medDt * 6)) {
        emit('stall', f.dtMs);
      }
      pushBounded(this.dtHistory, f.dtMs);
    }

    if (f.tokensPerSec > 0) pushBounded(this.tpsHistory, f.tokensPerSec);

    if (f.index >= WARMUP_TOKENS) {
      toggle('repetition', f.repetition >= 0.3, f.repetition < 0.18, f.repetition);
      toggle(
        'mode-collapse',
        f.repetition >= 0.45 && this.noveltyEma < 0.15,
        f.repetition < 0.3 || this.noveltyEma > 0.3,
        this.noveltyEma
      );
      toggle('tool-storm', f.structure >= 0.28, f.structure < 0.2, f.structure);

      const medTps = median(this.tpsHistory);
      if (medTps > 0) {
        const ratio = f.tokensPerSec / medTps;
        toggle('burst', ratio > 2.2, ratio < 1.4, ratio);
      }

      const shift = spectral.sheetShift ?? 0;
      if (shift > 0.6 && f.index - this.lastShiftIndex >= SHIFT_COOLDOWN) {
        this.lastShiftIndex = f.index;
        emit('spectral-shift', shift);
      }
    }

    if (f.thinking) this.sawThinking = true;
    if (this.prevThinking === true && !f.thinking && this.sawThinking) {
      emit('phase-change', f.index);
    }
    this.prevThinking = f.thinking;

    return out;
  }
}

function pushBounded(arr, v) {
  arr.push(v);
  if (arr.length > HISTORY) arr.shift();
}

export function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((x, y) => x - y);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) * 0.5;
}
