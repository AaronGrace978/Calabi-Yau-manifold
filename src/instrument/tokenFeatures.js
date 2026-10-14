/**
 * Incremental per-token feature extraction over a live inference stream.
 *
 * All windowed quantities are maintained incrementally so a push is O(token length + alphabet).
 */

const STRUCTURAL_CHARS = new Set(['{', '}', '[', ']', '"', ':', ',', '<', '>', '(', ')', ';', '=']);
const RATE_WINDOW = 16;

export class TokenFeatureExtractor {
  constructor({ tailChars = 600, windowTokens = 64 } = {}) {
    this.tailChars = tailChars;
    this.windowTokens = windowTokens;
    this.reset();
  }

  reset(startMs = null) {
    this.index = 0;
    this.startMs = startMs;
    this.prevMs = startMs;
    this.tail = '';
    this.charCounts = new Map();
    this.trigramCounts = new Map();
    this.structuralCount = 0;
    this.recentThinking = [];
    this.recentTimes = [];
    this.recentInfo = [];
  }

  /**
   * @param {{token: string, thinking?: boolean, tMs: number}} sample
   * @returns {TokenFeatures}
   */
  push({ token, thinking = false, tMs }) {
    const text = token || '';
    if (this.startMs === null) {
      this.startMs = tMs;
      this.prevMs = tMs;
    }
    const isFirst = this.index === 0;
    const dtMs = Math.max(0.5, tMs - this.prevMs);
    this.prevMs = tMs;

    const novelty = this.measureNovelty(text);
    for (const ch of text) this.appendChar(ch);

    const chars = [...text].length;
    const info = chars * (0.2 + 0.8 * novelty);

    this.recentThinking.push(thinking ? 1 : 0);
    if (this.recentThinking.length > this.windowTokens) this.recentThinking.shift();
    this.recentTimes.push(tMs);
    if (this.recentTimes.length > RATE_WINDOW) this.recentTimes.shift();
    this.recentInfo.push(info);
    if (this.recentInfo.length > RATE_WINDOW) this.recentInfo.shift();

    const span = (this.recentTimes[this.recentTimes.length - 1] - this.recentTimes[0]) / 1000;
    const tokensPerSec = span > 1e-3 ? (this.recentTimes.length - 1) / span : 0;
    const infoInSpan = this.recentInfo.slice(1).reduce((s, v) => s + v, 0);
    const infoRate = span > 1e-3 ? infoInSpan / span : 0;

    const features = {
      index: this.index,
      tMs,
      isFirst,
      thinking,
      token: text,
      dtMs,
      logDt: Math.log(dtMs),
      chars,
      novelty,
      info,
      entropy: this.rollingEntropy(),
      repetition: this.repetitionRate(),
      structure: this.tail.length > 0 ? this.structuralCount / this.tail.length : 0,
      thinkingRatio:
        this.recentThinking.reduce((s, v) => s + v, 0) / Math.max(1, this.recentThinking.length),
      tokensPerSec,
      infoRate,
    };
    this.index += 1;
    return features;
  }

  measureNovelty(text) {
    if (!text) return 0;
    let context = this.tail.slice(-2);
    let total = 0;
    let unseen = 0;
    for (const ch of text) {
      context += ch;
      if (context.length >= 3) {
        const tri = context.slice(-3);
        total += 1;
        if (!this.trigramCounts.has(tri)) unseen += 1;
      }
      if (context.length > 2) context = context.slice(-2);
    }
    return total === 0 ? 1 : unseen / total;
  }

  appendChar(ch) {
    this.tail += ch;
    this.charCounts.set(ch, (this.charCounts.get(ch) || 0) + 1);
    if (STRUCTURAL_CHARS.has(ch)) this.structuralCount += 1;
    if (this.tail.length >= 3) increment(this.trigramCounts, this.tail.slice(-3));

    while (this.tail.length > this.tailChars) {
      const front = this.tail[0];
      if (this.tail.length >= 3) decrement(this.trigramCounts, this.tail.slice(0, 3));
      decrement(this.charCounts, front);
      if (STRUCTURAL_CHARS.has(front)) this.structuralCount -= 1;
      this.tail = this.tail.slice(1);
    }
  }

  /** Shannon entropy (bits/char) of the character distribution in the rolling tail. */
  rollingEntropy() {
    const total = this.tail.length;
    if (total === 0) return 0;
    let h = 0;
    for (const count of this.charCounts.values()) {
      const p = count / total;
      h -= p * Math.log2(p);
    }
    return h;
  }

  /** Fraction of duplicated word 3-grams in the rolling tail (0 = no repeats). */
  repetitionRate() {
    const words = this.tail.split(/\s+/).filter(Boolean);
    if (words.length < 6) return 0;
    const seen = new Set();
    let dup = 0;
    let total = 0;
    for (let i = 0; i + 2 < words.length; i++) {
      const key = `${words[i]}\u0001${words[i + 1]}\u0001${words[i + 2]}`;
      total += 1;
      if (seen.has(key)) dup += 1;
      else seen.add(key);
    }
    return total === 0 ? 0 : dup / total;
  }
}

function increment(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function decrement(map, key) {
  const v = (map.get(key) || 0) - 1;
  if (v <= 0) map.delete(key);
  else map.set(key, v);
}

/**
 * @typedef {Object} TokenFeatures
 * @property {number} index
 * @property {number} tMs
 * @property {boolean} isFirst
 * @property {boolean} thinking
 * @property {string} token
 * @property {number} dtMs inter-token interval (time-to-first-token for index 0)
 * @property {number} logDt
 * @property {number} chars
 * @property {number} novelty fraction of the token's char trigrams unseen in the rolling tail
 * @property {number} info novelty-weighted character count (information-density proxy)
 * @property {number} entropy rolling char entropy, bits/char
 * @property {number} repetition rolling duplicated word-3-gram rate
 * @property {number} structure rolling fraction of structural (JSON/tool/code) characters
 * @property {number} thinkingRatio rolling fraction of reasoning-trace tokens
 * @property {number} tokensPerSec
 * @property {number} infoRate info units per second over the recent window
 */
