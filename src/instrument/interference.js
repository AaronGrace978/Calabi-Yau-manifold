import { bhattacharyya } from './fingerprint.js';

const STALE_DECAY_MS = 1500;
const TAKEOVER_HOLD_MS = 800;

/**
 * Superposes several concurrent runs ("lanes") on the same n² sheets.
 *
 * Each lane contributes its sheet distribution weighted by its live power (information rate,
 * decayed once the lane stops emitting). Pairwise Bhattacharyya overlap measures constructive
 * interference: two models occupying the same timing × content modes score near 1.
 */
export class InterferenceField {
  constructor() {
    this.reset();
  }

  reset() {
    this.dominant = null;
    this.candidate = null;
    this.candidateSinceMs = 0;
    this.events = [];
  }

  /**
   * @param {Array<{runId:string,label:string,color:string,lastMs:number|null,lastFrame:object|null}>} lanes
   */
  update(lanes, nowMs) {
    const live = lanes.filter((l) => l.lastFrame && l.lastFrame.sheet);
    if (!live.length) return null;

    const size = live[0].lastFrame.sheet.length;
    const lanesAligned = live.filter((l) => l.lastFrame.sheet.length === size);

    const powers = lanesAligned.map((l) => {
      const age = Math.max(0, nowMs - (l.lastMs ?? nowMs));
      return Math.max(1e-6, l.lastFrame.features.infoRate) * Math.exp(-age / STALE_DECAY_MS);
    });
    const totalPower = powers.reduce((s, p) => s + p, 0) || 1;
    const shares = powers.map((p) => p / totalPower);

    const sheet = new Float64Array(size);
    const rgb = new Float64Array(size * 3);
    lanesAligned.forEach((lane, li) => {
      const c = hexToRgb(lane.color);
      const s = lane.lastFrame.sheet;
      for (let i = 0; i < size; i++) {
        const e = shares[li] * s[i];
        sheet[i] += e;
        rgb[i * 3] += e * c[0];
        rgb[i * 3 + 1] += e * c[1];
        rgb[i * 3 + 2] += e * c[2];
      }
    });
    for (let i = 0; i < size; i++) {
      if (sheet[i] > 1e-12) {
        rgb[i * 3] /= sheet[i];
        rgb[i * 3 + 1] /= sheet[i];
        rgb[i * 3 + 2] /= sheet[i];
      }
    }

    const overlaps = [];
    let coherenceNum = 0;
    let coherenceDen = 0;
    for (let i = 0; i < lanesAligned.length; i++) {
      for (let j = i + 1; j < lanesAligned.length; j++) {
        const bc = bhattacharyya(lanesAligned[i].lastFrame.sheet, lanesAligned[j].lastFrame.sheet);
        overlaps.push({ a: lanesAligned[i].runId, b: lanesAligned[j].runId, overlap: bc });
        const w = shares[i] * shares[j];
        coherenceNum += w * bc;
        coherenceDen += w;
      }
    }

    const newEvents = this.trackDominance(lanesAligned, shares, nowMs);

    return {
      sheet,
      sheetColor: rgb,
      lanes: lanesAligned.map((l, i) => ({ runId: l.runId, label: l.label, color: l.color, share: shares[i] })),
      overlaps,
      coherence: coherenceDen > 0 ? coherenceNum / coherenceDen : 1,
      dominant: this.dominant,
      events: newEvents,
    };
  }

  trackDominance(lanes, shares, nowMs) {
    const out = [];
    if (lanes.length < 2) return out;
    let best = 0;
    for (let i = 1; i < shares.length; i++) if (shares[i] > shares[best]) best = i;
    const leader = lanes[best].runId;

    if (this.dominant === null) {
      this.dominant = leader;
      return out;
    }
    if (leader === this.dominant || shares[best] < 0.5) {
      this.candidate = null;
      return out;
    }
    if (this.candidate !== leader) {
      this.candidate = leader;
      this.candidateSinceMs = nowMs;
      return out;
    }
    if (nowMs - this.candidateSinceMs >= TAKEOVER_HOLD_MS) {
      const from = lanes.find((l) => l.runId === this.dominant);
      const ev = {
        type: 'takeover',
        from: this.dominant,
        fromLabel: from?.label ?? this.dominant,
        to: leader,
        toLabel: lanes[best].label,
        share: shares[best],
        tMs: nowMs,
      };
      this.dominant = leader;
      this.candidate = null;
      this.events.push(ev);
      out.push(ev);
    }
    return out;
  }
}

export function hexToRgb(hex) {
  const h = String(hex || '#00f3ff').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0');
  const v = parseInt(full.slice(0, 6), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

export const LANE_COLORS = Object.freeze(['#00f3ff', '#ff1e9b', '#ffd400', '#00ffa3', '#8c52ff', '#ff7a1a']);
