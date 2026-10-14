/**
 * Hardware-Adaptive Graphics Profiler & Dynamic Auto-LOD Governor (`src/graphics/hardwareProfile.js`)
 *
 * Tailored presets and automatic WebGL GPU / platform detection for:
 *   1. `ultra`      — Desktop Rig: NVIDIA GeForce RTX 5060 Ti (and desktop RTX 4080+/50-series)
 *   2. `high`       — Gaming Laptop: Dell G15 NVIDIA GeForce RTX 4060 Laptop GPU
 *   3. `steam-deck` — Handheld APU: Valve Steam Deck (AMD VanGogh RDNA2 APU, 1280×800)
 *   4. `low`        — Low-End / Integrated Graphics / APU / Software Renderer (Intel UHD, llvmpipe, 4GB RAM)
 */

export const GRAPHICS_PROFILES = Object.freeze({
  ultra: Object.freeze({
    id: 'ultra',
    label: 'ULTRA // RTX 5060 Ti DESKTOP RIG',
    shortLabel: 'ULTRA (RTX 5060 Ti)',
    pixelRatioCap: 2.0,
    antialias: true,
    powerPreference: 'high-performance',
    defaultResolution: 20,
    recommendedExponentN: 5,
    maxExponentN: 7,
    haloParticles: 950,
    coreSurfaceEnabled: true,
    cpuDeformStride: 1,
    targetFps: 120,
    reducedCssBlur: false,
    trajectoryCapacity: 768,
    description:
      'Full 2.0x supersampled DPR, 20×20 mesh density, dual wireframe + core Kähler shader passes, 950 halo particles, and every-frame CPU+GPU simplex deformation.',
  }),

  high: Object.freeze({
    id: 'high',
    label: 'HIGH // RTX 4060 DELL G15 LAPTOP',
    shortLabel: 'HIGH (RTX 4060 G15)',
    pixelRatioCap: 1.5,
    antialias: true,
    powerPreference: 'high-performance',
    defaultResolution: 16,
    recommendedExponentN: 5,
    maxExponentN: 6,
    haloParticles: 520,
    coreSurfaceEnabled: true,
    cpuDeformStride: 1,
    targetFps: 60,
    reducedCssBlur: false,
    trajectoryCapacity: 512,
    description:
      'Balanced 1.5x DPR for laptop thermals, 16×16 mesh density, 520 halo particles, and full 60 FPS GPU+CPU deformation.',
  }),

  'steam-deck': Object.freeze({
    id: 'steam-deck',
    label: 'HANDHELD // STEAM DECK (1280×800 APU)',
    shortLabel: 'STEAM DECK (800p)',
    pixelRatioCap: 1.0,
    antialias: false,
    powerPreference: 'default',
    defaultResolution: 12,
    recommendedExponentN: 4,
    maxExponentN: 5,
    haloParticles: 200,
    coreSurfaceEnabled: true,
    cpuDeformStride: 2,
    targetFps: 60,
    reducedCssBlur: true,
    trajectoryCapacity: 320,
    description:
      'Tuned for Valve Steam Deck (1280×800 RDNA2 VanGogh APU): native 1.0x DPR, 12×12 mesh, half-rate CPU simplex updates with GPU vertex interpolation, and low-overhead HUD glass.',
  }),

  low: Object.freeze({
    id: 'low',
    label: 'LOW-END // INTEGRATED APU & ECO',
    shortLabel: 'LOW-END / ECO',
    pixelRatioCap: 0.85,
    antialias: false,
    powerPreference: 'low-power',
    defaultResolution: 10,
    recommendedExponentN: 3,
    maxExponentN: 4,
    haloParticles: 80,
    coreSurfaceEnabled: false,
    cpuDeformStride: 4,
    targetFps: 45,
    reducedCssBlur: true,
    trajectoryCapacity: 160,
    description:
      'Maximum FPS & low-end compatibility: 0.85x internal render scale, 10×10 mesh, single-pass wireframe shader (core fill disabled), 80 particles, and GPU-offloaded deformation.',
  }),
});

export const GRAPHICS_TIER_ORDER = Object.freeze(['ultra', 'high', 'steam-deck', 'low']);

/**
 * Retrieves a graphics profile by id (`ultra`, `high`, `steam-deck`, `low`).
 */
export function getGraphicsProfile(tierId) {
  return GRAPHICS_PROFILES[tierId] || GRAPHICS_PROFILES.high;
}

/**
 * Classifies a hardware environment (WebGL renderer string, userAgent, screen resolution,
 * CPU cores, and device memory) into the optimal graphics preset.
 *
 * @param {{
 *   renderer?: string,
 *   vendor?: string,
 *   userAgent?: string,
 *   screenWidth?: number,
 *   screenHeight?: number,
 *   hardwareConcurrency?: number,
 *   deviceMemory?: number
 * }} env
 */
export function classifyHardwareEnvironment(env = {}) {
  const renderer = String(env.renderer || '').toLowerCase();
  const vendor = String(env.vendor || '').toLowerCase();
  const ua = String(env.userAgent || '').toLowerCase();
  const width = Number(env.screenWidth) || 1920;
  const height = Number(env.screenHeight) || 1080;
  const cores = Number(env.hardwareConcurrency) || 8;
  const memoryGb = Number(env.deviceMemory) || 8;

  // 1. Explicit Steam Deck / SteamOS / AMD VanGogh custom APU detection
  if (
    /steam deck|steamos|vangogh|radv vangogh|amd custom gpu 0405|amd custom apu|gamescope/.test(
      `${renderer} ${ua}`
    )
  ) {
    return {
      tierId: 'steam-deck',
      profile: GRAPHICS_PROFILES['steam-deck'],
      detectedHardware: 'Valve Steam Deck (RDNA2 VanGogh APU)',
      rendererString: env.renderer || 'AMD Custom GPU 0405 (RADV VANGOGH)',
    };
  }

  // 2. Explicit Low-End / Software / Integrated GPU detection
  if (
    /llvmpipe|swiftshader|software|basic render|intel.*(uhd|hd graphics)|mali-|adreno|powervr|virgl|Apple software/i.test(
      renderer
    ) ||
    cores <= 4 ||
    memoryGb <= 4
  ) {
    return {
      tierId: 'low',
      profile: GRAPHICS_PROFILES.low,
      detectedHardware: renderer ? `Low-End / Integrated (${env.renderer})` : 'Low-End / Eco Platform',
      rendererString: env.renderer || 'Integrated / Software Renderer',
    };
  }

  // 3. Explicit RTX 4060 / Laptop GPU / Dell G15 detection
  if (
    /rtx\s*4060|rtx\s*4050|rtx\s*3060|rtx\s*3050|laptop gpu|max-q|dell g15|mobile|radeon rx 7600m|apple m1|apple m2\b/.test(
      `${renderer} ${ua}`
    )
  ) {
    return {
      tierId: 'high',
      profile: GRAPHICS_PROFILES.high,
      detectedHardware: 'NVIDIA RTX 4060 Laptop / Dell G15 Class',
      rendererString: env.renderer || 'NVIDIA GeForce RTX 4060 Laptop GPU',
    };
  }

  // 4. Explicit Desktop RTX 5060 Ti / 50-series / 4070+ / Enthusiast Rig detection
  if (
    /rtx\s*5060|rtx\s*5070|rtx\s*5080|rtx\s*5090|rtx\s*4070|rtx\s*4080|rtx\s*4090|rx\s*7800|rx\s*7900|rx\s*9070|apple m3 max|apple m4/.test(
      renderer
    )
  ) {
    return {
      tierId: 'ultra',
      profile: GRAPHICS_PROFILES.ultra,
      detectedHardware: /5060/.test(renderer)
        ? 'NVIDIA GeForce RTX 5060 Ti Desktop Rig'
        : `Enthusiast Desktop GPU (${env.renderer})`,
      rendererString: env.renderer || 'NVIDIA GeForce RTX 5060 Ti',
    };
  }

  // 5. Handheld / 1280x800 compact screen heuristic (e.g. Steam Deck when WebGL debug info is masked)
  const minDim = Math.min(width, height);
  const maxDim = Math.max(width, height);
  if (maxDim <= 1280 && minDim <= 800) {
    return {
      tierId: 'steam-deck',
      profile: GRAPHICS_PROFILES['steam-deck'],
      detectedHardware: `Handheld 800p Display (${width}×${height})`,
      rendererString: env.renderer || vendor || 'Handheld APU',
    };
  }

  // 6. Default to High (RTX 4060 Laptop class) for standard desktops/laptops
  return {
    tierId: 'high',
    profile: GRAPHICS_PROFILES.high,
    detectedHardware: env.renderer ? `GPU (${env.renderer})` : 'Balanced Desktop / Laptop GPU',
    rendererString: env.renderer || 'WebGL Hardware Renderer',
  };
}

/**
 * Probes the live browser/Tauri environment (including WebGL `WEBGL_debug_renderer_info` when available)
 * and returns the classified hardware profile.
 */
export function detectLiveHardwareProfile(glContext = null) {
  let renderer = '';
  let vendor = '';

  try {
    const gl =
      glContext ||
      (typeof document !== 'undefined'
        ? document.createElement('canvas').getContext('webgl') ||
          document.createElement('canvas').getContext('experimental-webgl')
        : null);
    if (gl) {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      if (dbg) {
        renderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '';
        vendor = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || '';
      } else {
        renderer = gl.getParameter(gl.RENDERER) || '';
        vendor = gl.getParameter(gl.VENDOR) || '';
      }
    }
  } catch {
    // Ignore headless or restricted WebGL context errors
  }

  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const win = typeof window !== 'undefined' ? window : {};
  const scr = win.screen || {};

  return classifyHardwareEnvironment({
    renderer,
    vendor,
    userAgent: nav.userAgent || '',
    screenWidth: scr.width || win.innerWidth || 1920,
    screenHeight: scr.height || win.innerHeight || 1080,
    hardwareConcurrency: nav.hardwareConcurrency || 8,
    deviceMemory: nav.deviceMemory || 8,
  });
}

/**
 * Rolling Frame-Time Governor (Auto-LOD).
 * Tracks frame durations and recommends stepping down a graphics tier if sustained FPS drops
 * below the minimum smooth threshold (e.g., on thermally throttled laptops or integrated GPUs).
 */
export class AdaptiveFpsGovernor {
  constructor({ currentTierId = 'high', autoDowngradeEnabled = true } = {}) {
    this.currentTierId = currentTierId;
    this.autoDowngradeEnabled = autoDowngradeEnabled;
    this.frameDtsMs = [];
    this.windowSize = 45;
    this.cooldownFrames = 0;
  }

  setTier(tierId, { autoDowngradeEnabled = this.autoDowngradeEnabled } = {}) {
    if (GRAPHICS_PROFILES[tierId]) {
      this.currentTierId = tierId;
      this.frameDtsMs = [];
      this.cooldownFrames = 60;
    }
    this.autoDowngradeEnabled = autoDowngradeEnabled;
  }

  /**
   * Records a frame delta (in milliseconds) and returns `{ fps, downgradedTo }` if a tier
   * step-down is triggered.
   */
  recordFrame(dtMs) {
    if (!Number.isFinite(dtMs) || dtMs <= 0 || dtMs > 1000) {
      return { fps: 60, downgradedTo: null };
    }
    this.frameDtsMs.push(dtMs);
    if (this.frameDtsMs.length > this.windowSize) {
      this.frameDtsMs.shift();
    }
    if (this.cooldownFrames > 0) {
      this.cooldownFrames -= 1;
    }

    const meanDt =
      this.frameDtsMs.reduce((a, b) => a + b, 0) / Math.max(1, this.frameDtsMs.length);
    const fps = 1000 / Math.max(1, meanDt);

    if (
      this.autoDowngradeEnabled &&
      this.cooldownFrames === 0 &&
      this.frameDtsMs.length >= this.windowSize &&
      fps < 36
    ) {
      const idx = GRAPHICS_TIER_ORDER.indexOf(this.currentTierId);
      if (idx >= 0 && idx < GRAPHICS_TIER_ORDER.length - 1) {
        const nextTier = GRAPHICS_TIER_ORDER[idx + 1];
        this.currentTierId = nextTier;
        this.frameDtsMs = [];
        this.cooldownFrames = 120;
        return { fps: Math.round(fps), downgradedTo: nextTier };
      }
    }

    return { fps: Math.round(fps), downgradedTo: null };
  }
}
