import * as THREE from 'three';
import {
  evaluateCalabiYauPoint,
  MANIFOLD_SCALE,
  MAX_FERMAT_DEGREE,
  PARAM_DOMAIN,
} from './instrument/manifoldMath.js';
import {
  evaluateDimensionalPoint,
  getDimensionSpace,
  computeTopologicalInvariants,
} from './dimensions/dimensionalEngine.js';
import {
  GRAPHICS_PROFILES,
  getGraphicsProfile,
  detectLiveHardwareProfile,
  AdaptiveFpsGovernor,
} from './graphics/hardwareProfile.js';

const MAX_SHEETS = MAX_FERMAT_DEGREE * MAX_FERMAT_DEGREE;
const TRAJECTORY_CAPACITY = 768;

/**
 * Self-contained 3D Simplex Noise implementation (Gustavson / Perlin simplex algorithm)
 * used for real-time CPU-side vertex position deformation of the Calabi-Yau manifold.
 */
class SimplexNoise3D {
  constructor(seed = 1337) {
    this.grad3 = [
      [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
      [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
      [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
    ];
    this.p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      this.p[i] = i;
    }
    let n = seed;
    for (let i = 255; i > 0; i--) {
      n = (n * 16807) % 2147483647;
      const j = n % (i + 1);
      const tmp = this.p[i];
      this.p[i] = this.p[j];
      this.p[j] = tmp;
    }
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = this.p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
  }

  dot(g, x, y, z) {
    return g[0] * x + g[1] * y + g[2] * z;
  }

  noise3D(xin, yin, zin) {
    const F3 = 1.0 / 3.0;
    const G3 = 1.0 / 6.0;

    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const k = Math.floor(zin + s);

    const t = (i + j + k) * G3;
    const X0 = i - t;
    const Y0 = j - t;
    const Z0 = k - t;

    const x0 = xin - X0;
    const y0 = yin - Y0;
    const z0 = zin - Z0;

    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) {
        i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
      } else if (x0 >= z0) {
        i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1;
      } else {
        i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1;
      }
    } else {
      if (y0 < z0) {
        i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1;
      } else if (x0 < z0) {
        i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1;
      } else {
        i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
      }
    }

    const x1 = x0 - i1 + G3;
    const y1 = y0 - j1 + G3;
    const z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2.0 * G3;
    const y2 = y0 - j2 + 2.0 * G3;
    const z2 = z0 - k2 + 2.0 * G3;
    const x3 = x0 - 1.0 + 3.0 * G3;
    const y3 = y0 - 1.0 + 3.0 * G3;
    const z3 = z0 - 1.0 + 3.0 * G3;

    const ii = i & 255;
    const jj = j & 255;
    const kk = k & 255;

    const gi0 = this.permMod12[ii + this.perm[jj + this.perm[kk]]];
    const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1 + this.perm[kk + k1]]];
    const gi2 = this.permMod12[ii + i2 + this.perm[jj + j2 + this.perm[kk + k2]]];
    const gi3 = this.permMod12[ii + 1 + this.perm[jj + 1 + this.perm[kk + 1]]];

    let n0 = 0.0;
    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 > 0) {
      t0 *= t0;
      n0 = t0 * t0 * this.dot(this.grad3[gi0], x0, y0, z0);
    }

    let n1 = 0.0;
    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 > 0) {
      t1 *= t1;
      n1 = t1 * t1 * this.dot(this.grad3[gi1], x1, y1, z1);
    }

    let n2 = 0.0;
    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 > 0) {
      t2 *= t2;
      n2 = t2 * t2 * this.dot(this.grad3[gi2], x2, y2, z2);
    }

    let n3 = 0.0;
    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 > 0) {
      t3 *= t3;
      n3 = t3 * t3 * this.dot(this.grad3[gi3], x3, y3, z3);
    }

    return 32.0 * (n0 + n1 + n2 + n3);
  }
}

const CALABI_YAU_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uAmplitude;
  uniform float uQuantumFrequency;
  uniform float uSaturation;
  uniform float uSheetEnergy[${MAX_SHEETS}];
  uniform vec3 uSheetColor[${MAX_SHEETS}];
  uniform float uSheetCount;
  uniform float uInstrumentMix;

  attribute float aFourthCoord;
  attribute float aSheetPhase;
  attribute float aSheetIndex;

  varying vec3 vPosition;
  varying vec3 vNormal;
  varying float vDisplacement;
  varying float vFourthCoord;
  varying float vSheetPhase;
  varying float vSheetGain;
  varying vec3 vSheetColor;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  void main() {
    float harmonicWave = snoise(position * uQuantumFrequency + vec3(uTime * 0.9, aFourthCoord, aSheetPhase));
    float stringRipple = sin(length(position) * 6.0 - uTime * 5.0 + aSheetPhase * 6.28318) * 0.35;
    int sheetIdx = int(aSheetIndex + 0.5);
    float relativeEnergy = clamp(uSheetEnergy[sheetIdx] * uSheetCount, 0.0, 4.0);
    float sheetGain = mix(1.0, relativeEnergy, uInstrumentMix);
    float totalDisplacement = (harmonicWave + stringRipple) * uAmplitude * 0.45 * (0.4 + 0.6 * sheetGain);
    vSheetGain = sheetGain;
    vSheetColor = uSheetColor[sheetIdx];

    vec3 displacedPosition = position + normalize(normal + vec3(0.0001)) * totalDisplacement;

    vPosition = displacedPosition;
    vNormal = normalize(normalMatrix * normal);
    vDisplacement = harmonicWave;
    vFourthCoord = aFourthCoord;
    vSheetPhase = aSheetPhase;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
  }
`;

const CALABI_YAU_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uSaturation;
  uniform float uAmplitude;
  uniform float uOpacity;
  uniform float uInstrumentMix;
  uniform float uSliceEnabled;
  uniform float uSliceW;
  uniform float uSliceBandwidth;

  varying vec3 vPosition;
  varying vec3 vNormal;
  varying float vDisplacement;
  varying float vFourthCoord;
  varying float vSheetPhase;
  varying float vSheetGain;
  varying vec3 vSheetColor;

  vec3 hsl2rgb(vec3 c) {
    vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
  }

  void main() {
    float baseHue = fract(
      0.52
      + vSheetPhase * 0.28
      + vFourthCoord * 0.14
      + vDisplacement * 0.18
      + sin(uTime * 0.35) * 0.06
    );

    float sat = clamp(0.65 + uSaturation * 0.35, 0.0, 1.0);
    float light = clamp(0.48 + vDisplacement * 0.22 + uAmplitude * 0.28, 0.25, 0.92);

    vec3 spectralColor = hsl2rgb(vec3(baseHue, sat, light));

    vec3 viewDir = normalize(-vPosition);
    float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), 1.6);
    vec3 hotCore = vec3(0.45, 0.98, 1.0) * (uAmplitude * 0.75);

    float laneMix = uInstrumentMix * clamp(vSheetGain * 0.5, 0.0, 0.85);
    vec3 finalColor = mix(spectralColor, vSheetColor * (0.6 + 0.4 * light), laneMix) + hotCore * fresnel;
    float energyGlow = mix(1.0, 0.35 + 0.65 * min(vSheetGain, 2.5), uInstrumentMix);
    float alpha = clamp(uOpacity * (0.45 + fresnel * 0.55 + uAmplitude * 0.35) * energyGlow, 0.04, 0.95);

    if (uSliceEnabled > 0.5) {
      float wDist = abs(vFourthCoord - uSliceW);
      float contour = exp(-pow(wDist / max(0.02, uSliceBandwidth * 0.35), 2.0));
      float slab = smoothstep(uSliceBandwidth * 1.4, uSliceBandwidth * 0.15, wDist);
      finalColor = mix(finalColor * 0.32, vec3(0.0, 1.0, 0.72), contour * 0.92) + vec3(1.0, 0.88, 0.2) * pow(contour, 3.0);
      alpha = clamp(alpha * (0.12 + 0.88 * slab) + contour * 0.65, 0.02, 0.98);
    }

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export class CalabiYauCanvas {
  /**
   * @param {HTMLElement} container DOM element hosting the Three.js WebGL canvas
   * @param {Object} callbacks Optional telemetry callbacks for HUD synchronization
   */
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;

    this.simplex = new SimplexNoise3D(42091);
    this.clock = new THREE.Clock();

    this.spaceId = 'calabi-yau-6d';
    this.exponentN = 5;
    this.projectionAngle = 0.68;
    this.gridResolutionU = 18;
    this.gridResolutionV = 18;
    this.sliceEnabled = false;
    this.sliceW = 0.0;
    this.sliceBandwidth = 0.22;
    this.rot4D = { xw: 0, yw: 0, zw: 0 };

    // Hardware-Adaptive Graphics & Auto-LOD state (RTX 5060 Ti / RTX 4060 G15 / Steam Deck / Low-End)
    this.graphicsMode = callbacks.graphicsTier || 'auto';
    this.hardwareDetection = detectLiveHardwareProfile();
    this.activeGraphicsTierId =
      this.graphicsMode === 'auto' ? this.hardwareDetection.tierId : this.graphicsMode;
    this.graphicsProfile = getGraphicsProfile(this.activeGraphicsTierId);
    this.gridResolutionU = this.graphicsProfile.defaultResolution;
    this.gridResolutionV = this.graphicsProfile.defaultResolution;
    this.fpsGovernor = new AdaptiveFpsGovernor({
      currentTierId: this.activeGraphicsTierId,
      autoDowngradeEnabled: this.graphicsMode === 'auto',
    });
    this.frameCount = 0;
    this.lastFrameTimeMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.measuredFps = this.graphicsProfile.targetFps;

    this.baseAmplitude = 0.045;
    this.vibrationAmplitude = this.baseAmplitude;
    this.targetAmplitude = this.baseAmplitude;

    this.baseSaturation = 0.55;
    this.colorSaturation = this.baseSaturation;
    this.targetSaturation = this.baseSaturation;

    this.baseFrequency = 1.25;
    this.quantumFrequency = this.baseFrequency;
    this.targetFrequency = this.baseFrequency;

    this.lastMetricValue = 0.0;
    this.totalTokensVisualized = 0;

    this.isDragging = false;
    this.previousPointer = { x: 0, y: 0 };
    this.manualRotation = { x: 0.35, y: -0.45 };
    this.cameraDistance = 5.4;

    this.animationFrameId = null;

    this.displaySheetEnergy = new Float32Array(MAX_SHEETS);
    this.targetSheetEnergy = new Float32Array(MAX_SHEETS);
    this.displaySheetColor = new Float32Array(MAX_SHEETS * 3).fill(0.6);
    this.targetSheetColor = new Float32Array(MAX_SHEETS * 3).fill(0.6);
    this.instrumentMix = 0;
    this.instrumentTargetMix = 0;
    this.lastInstrumentFrameAt = -Infinity;
    this.trajectories = new Map();
    this.resetSheetField();

    this.initScene();
    // Refine hardware GPU detection using the live WebGL context (unmasked renderer string)
    this.hardwareDetection = detectLiveHardwareProfile(this.renderer.getContext());
    if (this.graphicsMode === 'auto') {
      this.activeGraphicsTierId = this.hardwareDetection.tierId;
      this.graphicsProfile = getGraphicsProfile(this.activeGraphicsTierId);
      this.gridResolutionU = this.graphicsProfile.defaultResolution;
      this.gridResolutionV = this.graphicsProfile.defaultResolution;
      this.fpsGovernor.setTier(this.activeGraphicsTierId, { autoDowngradeEnabled: true });
    }
    this.syncRendererAndBodyToProfile();
    this.buildCalabiYauManifold();
    this.buildQuantumParticleHalo();
    this.bindInteractionEvents();
    this.bindDomPulseEvents();
    this.animate();
  }

  initScene() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 100);
    this.camera.position.set(0, 0.2, this.cameraDistance);

    this.renderer = new THREE.WebGLRenderer({
      antialias: this.graphicsProfile.antialias,
      alpha: true,
      powerPreference: this.graphicsProfile.powerPreference,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, this.graphicsProfile.pixelRatioCap)
    );
    this.renderer.setClearColor(0x000000, 0);

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    this.manifoldGroup = new THREE.Group();
    this.manifoldGroup.rotation.x = this.manualRotation.x;
    this.manifoldGroup.rotation.y = this.manualRotation.y;
    this.scene.add(this.manifoldGroup);
  }

  syncRendererAndBodyToProfile() {
    if (this.renderer) {
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      this.renderer.setPixelRatio(Math.min(dpr, this.graphicsProfile.pixelRatioCap));
      const width = this.container?.clientWidth || window.innerWidth;
      const height = this.container?.clientHeight || window.innerHeight;
      this.renderer.setSize(width, height);
    }
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.toggle('gfx-reduced-blur', Boolean(this.graphicsProfile.reducedCssBlur));
      document.body.classList.toggle('gfx-steamdeck', this.activeGraphicsTierId === 'steam-deck');
      document.body.classList.toggle('gfx-low', this.activeGraphicsTierId === 'low');
    }
  }

  setGraphicsTier(modeOrTierId = 'auto', { forcedAutoTier = null } = {}) {
    this.graphicsMode = modeOrTierId;
    if (modeOrTierId === 'auto') {
      this.activeGraphicsTierId = forcedAutoTier || this.hardwareDetection.tierId || 'high';
      this.fpsGovernor.setTier(this.activeGraphicsTierId, { autoDowngradeEnabled: true });
    } else {
      this.activeGraphicsTierId = GRAPHICS_PROFILES[modeOrTierId] ? modeOrTierId : 'high';
      this.fpsGovernor.setTier(this.activeGraphicsTierId, { autoDowngradeEnabled: false });
    }

    this.graphicsProfile = getGraphicsProfile(this.activeGraphicsTierId);
    this.gridResolutionU = this.graphicsProfile.defaultResolution;
    this.gridResolutionV = this.graphicsProfile.defaultResolution;
    if (this.exponentN > this.graphicsProfile.maxExponentN) {
      this.exponentN = this.graphicsProfile.maxExponentN;
    }

    this.syncRendererAndBodyToProfile();
    this.resetSheetField();
    this.buildCalabiYauManifold();
    this.buildQuantumParticleHalo();

    const status = this.getGraphicsStatus();
    if (typeof this.callbacks.onGraphicsProfileChange === 'function') {
      this.callbacks.onGraphicsProfileChange(status);
    }
    return status;
  }

  getGraphicsStatus() {
    return {
      mode: this.graphicsMode,
      tierId: this.activeGraphicsTierId,
      profile: this.graphicsProfile,
      detectedHardware: this.hardwareDetection.detectedHardware,
      rendererString: this.hardwareDetection.rendererString,
      measuredFps: this.measuredFps,
      resolution: this.gridResolutionU,
      exponentN: this.exponentN,
    };
  }

  /**
   * Builds the multi-sheet Calabi-Yau quintic threefold cross-section geometry
   * with welded patch buffers, storing rest positions for real-time simplex noise deformation.
   */
  buildCalabiYauManifold() {
    if (this.wireframeMesh) {
      this.manifoldGroup.remove(this.wireframeMesh);
      this.wireframeMesh.geometry.dispose();
      this.wireframeMesh.material.dispose();
    }
    if (this.coreSurfaceMesh) {
      this.manifoldGroup.remove(this.coreSurfaceMesh);
      this.coreSurfaceMesh.geometry.dispose();
      this.coreSurfaceMesh.material.dispose();
    }

    const n = this.exponentN;
    const xi = this.projectionAngle;
    const uSteps = this.gridResolutionU;
    const vSteps = this.gridResolutionV;

    const { aMin, aMax, bMin, bMax } = PARAM_DOMAIN;
    const scale = MANIFOLD_SCALE;

    const positions = [];
    const fourthCoords = [];
    const sheetPhases = [];
    const sheetIndices = [];
    const indices = [];

    let vertexOffset = 0;
    const totalSheets = n * n;

    for (let k1 = 0; k1 < n; k1++) {
      for (let k2 = 0; k2 < n; k2++) {
        const sheetIndex = k1 * n + k2;
        const normalizedPhase = sheetIndex / totalSheets;

        for (let iu = 0; iu <= uSteps; iu++) {
          const u = iu / uSteps;
          const a = aMin + u * (aMax - aMin);

          for (let iv = 0; iv <= vSteps; iv++) {
            const v = iv / vSteps;
            const b = bMin + v * (bMax - bMin);

            const pt =
              this.spaceId === 'calabi-yau-6d' &&
              !this.rot4D.xw &&
              !this.rot4D.yw &&
              !this.rot4D.zw
                ? evaluateCalabiYauPoint(a, b, k1, k2, n, xi)
                : evaluateDimensionalPoint(this.spaceId, u, v, k1, k2, n, xi, this.rot4D);

            positions.push(pt.x * scale, pt.y * scale, pt.z * scale);
            fourthCoords.push(pt.w4);
            sheetPhases.push(normalizedPhase);
            sheetIndices.push(sheetIndex);
          }
        }

        const stride = vSteps + 1;
        for (let iu = 0; iu < uSteps; iu++) {
          for (let iv = 0; iv < vSteps; iv++) {
            const p00 = vertexOffset + iu * stride + iv;
            const p10 = vertexOffset + (iu + 1) * stride + iv;
            const p11 = vertexOffset + (iu + 1) * stride + (iv + 1);
            const p01 = vertexOffset + iu * stride + (iv + 1);

            indices.push(p00, p10, p11);
            indices.push(p00, p11, p01);
          }
        }

        vertexOffset += (uSteps + 1) * (vSteps + 1);
      }
    }

    const geometry = new THREE.BufferGeometry();
    const posArray = new Float32Array(positions);
    this.restPositions = new Float32Array(positions);
    this.fourthCoordArray = new Float32Array(fourthCoords);
    this.sheetPhaseArray = new Float32Array(sheetPhases);
    this.sheetIndexArray = new Uint8Array(sheetIndices);

    geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    geometry.setAttribute('aFourthCoord', new THREE.BufferAttribute(this.fourthCoordArray, 1));
    geometry.setAttribute('aSheetPhase', new THREE.BufferAttribute(this.sheetPhaseArray, 1));
    geometry.setAttribute('aSheetIndex', new THREE.BufferAttribute(new Float32Array(sheetIndices), 1));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    this.restNormals = new Float32Array(geometry.attributes.normal.array);

    this.shaderUniforms = {
      uTime: { value: 0.0 },
      uAmplitude: { value: this.vibrationAmplitude },
      uQuantumFrequency: { value: this.quantumFrequency },
      uSaturation: { value: this.colorSaturation },
      uOpacity: { value: 0.68 },
      uSheetEnergy: { value: this.displaySheetEnergy },
      uSheetColor: { value: this.displaySheetColor },
      uSheetCount: { value: n * n },
      uInstrumentMix: { value: this.instrumentMix },
      uSliceEnabled: { value: this.sliceEnabled ? 1.0 : 0.0 },
      uSliceW: { value: this.sliceW },
      uSliceBandwidth: { value: this.sliceBandwidth },
    };

    const wireframeMaterial = new THREE.ShaderMaterial({
      vertexShader: CALABI_YAU_VERTEX_SHADER,
      fragmentShader: CALABI_YAU_FRAGMENT_SHADER,
      uniforms: this.shaderUniforms,
      wireframe: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.wireframeMesh = new THREE.Mesh(geometry, wireframeMaterial);
    this.manifoldGroup.add(this.wireframeMesh);

    const coreUniforms = {
      uTime: this.shaderUniforms.uTime,
      uAmplitude: this.shaderUniforms.uAmplitude,
      uQuantumFrequency: this.shaderUniforms.uQuantumFrequency,
      uSaturation: this.shaderUniforms.uSaturation,
      uOpacity: { value: 0.14 },
      uSheetEnergy: this.shaderUniforms.uSheetEnergy,
      uSheetColor: this.shaderUniforms.uSheetColor,
      uSheetCount: this.shaderUniforms.uSheetCount,
      uInstrumentMix: this.shaderUniforms.uInstrumentMix,
      uSliceEnabled: this.shaderUniforms.uSliceEnabled,
      uSliceW: this.shaderUniforms.uSliceW,
      uSliceBandwidth: this.shaderUniforms.uSliceBandwidth,
    };

    if (this.graphicsProfile?.coreSurfaceEnabled !== false) {
      const coreMaterial = new THREE.ShaderMaterial({
        vertexShader: CALABI_YAU_VERTEX_SHADER,
        fragmentShader: CALABI_YAU_FRAGMENT_SHADER,
        uniforms: coreUniforms,
        wireframe: false,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      this.coreSurfaceMesh = new THREE.Mesh(geometry, coreMaterial);
      this.manifoldGroup.add(this.coreSurfaceMesh);
    } else {
      this.coreSurfaceMesh = null;
    }
  }

  /**
   * Creates a subtle ambient field of higher-dimensional phase particles around the manifold.
   * Scales particle count automatically by hardware tier (950 on RTX 5060 Ti -> 520 on RTX 4060 G15 -> 200 on Steam Deck -> 80 on Low-End).
   */
  buildQuantumParticleHalo() {
    if (this.particleHalo) {
      this.scene.remove(this.particleHalo);
      this.particleHalo.geometry.dispose();
      this.particleHalo.material.dispose();
      this.particleHalo = null;
    }
    const particleCount = this.graphicsProfile?.haloParticles ?? 520;
    if (particleCount <= 0) return;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const radius = 2.0 + Math.random() * 2.4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      const isCyan = i % 2 === 0;
      colors[i * 3] = isCyan ? 0.0 : 0.92;
      colors[i * 3 + 1] = isCyan ? 0.95 : 0.15;
      colors[i * 3 + 2] = 1.0;
    }

    const haloGeometry = new THREE.BufferGeometry();
    haloGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    haloGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const haloMaterial = new THREE.PointsMaterial({
      size: 0.028,
      vertexColors: true,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.particleHalo = new THREE.Points(haloGeometry, haloMaterial);
    this.scene.add(this.particleHalo);
  }

  /**
   * Deforms vertex positions directly in the BufferGeometry using 3D Simplex Noise
   * modulated by the live quantum vibration amplitude and 4th-dimensional phase.
   */
  updateVertexDeformation(elapsedTime) {
    if (!this.wireframeMesh || !this.restPositions) return;

    const posAttr = this.wireframeMesh.geometry.attributes.position;
    const posArray = posAttr.array;
    const rest = this.restPositions;
    const normals = this.restNormals;
    const w4 = this.fourthCoordArray;
    const sheetIdx = this.sheetIndexArray;
    const energy = this.displaySheetEnergy;
    const sheetCount = this.exponentN * this.exponentN;
    const mix = this.instrumentMix;

    const freq = this.quantumFrequency * 0.55;
    const amp = this.vibrationAmplitude;
    const timeOffset = elapsedTime * (0.65 + amp * 1.8);

    const vertexCount = posAttr.count;
    for (let i = 0; i < vertexCount; i++) {
      const idx = i * 3;
      const rx = rest[idx];
      const ry = rest[idx + 1];
      const rz = rest[idx + 2];

      const nVal = this.simplex.noise3D(
        rx * freq + timeOffset,
        ry * freq - timeOffset * 0.7,
        rz * freq + w4[i] * 0.8
      );

      const relative = Math.min(4, energy[sheetIdx[i]] * sheetCount);
      const gain = 1 + (relative - 1) * mix;
      const displacement = nVal * amp * 0.55 * (0.4 + 0.6 * gain);
      posArray[idx] = rx + normals[idx] * displacement;
      posArray[idx + 1] = ry + normals[idx + 1] * displacement;
      posArray[idx + 2] = rz + normals[idx + 2] * displacement;
    }

    posAttr.needsUpdate = true;
  }

  /**
   * Spikes the manifold's string vibration amplitude, frequency, and color saturation
   * in response to an incoming LLM token or quantum-metric payload.
   */
  triggerQuantumPulse(metricValue = 0.85, tokenSnippet = '') {
    const numericMetric = Number.isFinite(metricValue) ? metricValue : 0.65;
    const tokenLenFactor = Math.min((tokenSnippet || '').length * 0.035, 0.45);

    const spikeAmplitude = Math.min(0.08 + numericMetric * 0.24 + tokenLenFactor, 0.78);
    this.targetAmplitude = Math.max(this.targetAmplitude, spikeAmplitude);
    this.vibrationAmplitude = Math.min(this.vibrationAmplitude + spikeAmplitude * 0.55, 0.85);

    this.targetSaturation = Math.min(0.85 + numericMetric * 0.25, 1.0);
    this.colorSaturation = Math.min(this.colorSaturation + 0.22, 1.0);

    this.targetFrequency = Math.min(1.35 + numericMetric * 1.15, 4.2);

    this.lastMetricValue = numericMetric;
    if (tokenSnippet) {
      this.totalTokensVisualized += 1;
    }

    if (typeof this.callbacks.onQuantumTelemetry === 'function') {
      this.callbacks.onQuantumTelemetry({
        metric: numericMetric,
        amplitude: this.vibrationAmplitude,
        frequency: this.quantumFrequency,
        saturation: this.colorSaturation,
        tokensVisualized: this.totalTokensVisualized,
        token: tokenSnippet,
      });
    }
  }

  /** DOM event bus for manual pulses (`calabi-quantum-metric`); inference is driven via applyInstrumentFrame. */
  bindDomPulseEvents() {
    this.domMetricHandler = (e) => {
      const { metric, token } = e.detail || {};
      this.triggerQuantumPulse(metric ?? 0.9, token ?? '');
    };
    window.addEventListener('calabi-quantum-metric', this.domMetricHandler);
  }

  /**
   * Drives the manifold from measured stream analysis instead of a heuristic pulse.
   * @param {{amplitude:number, frequency:number, saturation:number, sheet:ArrayLike<number>,
   *          sheetColor?:ArrayLike<number>}} frame sheet energies sum to 1 over n² sheets;
   *          sheetColor is a flat RGB array (0..1) per sheet.
   */
  applyInstrumentFrame({ amplitude, frequency, saturation, sheet, sheetColor }) {
    if (Number.isFinite(amplitude)) {
      this.targetAmplitude = Math.max(this.baseAmplitude, Math.min(0.85, amplitude));
    }
    if (Number.isFinite(frequency)) this.targetFrequency = Math.min(4.2, Math.max(0.5, frequency));
    if (Number.isFinite(saturation)) this.targetSaturation = Math.min(1, Math.max(0, saturation));

    const count = this.exponentN * this.exponentN;
    if (sheet && sheet.length === count) {
      for (let i = 0; i < count; i++) this.targetSheetEnergy[i] = sheet[i];
      if (sheetColor && sheetColor.length >= count * 3) {
        for (let i = 0; i < count * 3; i++) this.targetSheetColor[i] = sheetColor[i];
      }
      this.instrumentTargetMix = 1;
      this.lastInstrumentFrameAt = this.clock.getElapsedTime();
    }
    this.totalTokensVisualized += 1;
  }

  resetSheetField() {
    const count = this.exponentN * this.exponentN;
    this.targetSheetEnergy.fill(0);
    this.displaySheetEnergy.fill(0);
    for (let i = 0; i < count; i++) {
      this.targetSheetEnergy[i] = 1 / count;
      this.displaySheetEnergy[i] = 1 / count;
    }
  }

  /**
   * Draws (or updates) the polyline a run traces across the surface.
   * @param {string} runId
   * @param {Array<[number, number, number]>} points projected, scaled R³ points
   */
  setTrajectory(runId, points, color = '#00f3ff') {
    let entry = this.trajectories.get(runId);
    if (!entry) {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(TRAJECTORY_CAPACITY * 3);
      const colors = new Float32Array(TRAJECTORY_CAPACITY * 3);
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const line = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          depthTest: false,
        })
      );
      line.renderOrder = 10;
      const beads = new THREE.Points(
        geometry,
        new THREE.PointsMaterial({
          size: 0.045,
          vertexColors: true,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          depthTest: false,
        })
      );
      beads.renderOrder = 10;
      const headGeometry = new THREE.BufferGeometry();
      headGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
      const head = new THREE.Points(
        headGeometry,
        new THREE.PointsMaterial({
          size: 0.13,
          color: new THREE.Color(color),
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          depthTest: false,
        })
      );
      head.renderOrder = 11;
      this.manifoldGroup.add(line);
      this.manifoldGroup.add(beads);
      this.manifoldGroup.add(head);
      entry = { line, beads, head };
      this.trajectories.set(runId, entry);
    }

    const cap = this.graphicsProfile?.trajectoryCapacity || TRAJECTORY_CAPACITY;
    const pts = points.slice(-cap);
    const pos = entry.line.geometry.attributes.position;
    const col = entry.line.geometry.attributes.color;
    const c = new THREE.Color(color);
    for (let i = 0; i < pts.length; i++) {
      const fade = 0.15 + 0.85 * ((i + 1) / pts.length);
      pos.array[i * 3] = pts[i][0];
      pos.array[i * 3 + 1] = pts[i][1];
      pos.array[i * 3 + 2] = pts[i][2];
      col.array[i * 3] = c.r * fade;
      col.array[i * 3 + 1] = c.g * fade;
      col.array[i * 3 + 2] = c.b * fade;
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    entry.line.geometry.setDrawRange(0, pts.length);
    entry.line.geometry.computeBoundingSphere();

    if (pts.length) {
      const headPos = entry.head.geometry.attributes.position;
      headPos.array.set(pts[pts.length - 1]);
      headPos.needsUpdate = true;
      entry.head.geometry.computeBoundingSphere();
    }
  }

  clearTrajectories(keepIds = []) {
    const keep = new Set(keepIds);
    for (const [id, entry] of this.trajectories) {
      if (keep.has(id)) continue;
      for (const obj of [entry.line, entry.beads, entry.head]) {
        this.manifoldGroup.remove(obj);
        obj.material.dispose();
      }
      entry.line.geometry.dispose();
      entry.head.geometry.dispose();
      this.trajectories.delete(id);
    }
  }

  get resolution() {
    return this.gridResolutionU;
  }

  get dimensionSpaceId() {
    return this.spaceId;
  }

  /**
   * Updates N-dimensional space, Fermat degree n, 4D phase angle xi, 4D hyperplane slice,
   * or 4D rotation angles and rebuilds the manifold geometry dynamically.
   */
  setManifoldParameters({
    spaceId,
    dimensionSpaceId,
    exponentN,
    projectionAngle,
    resolution,
    sliceEnabled,
    sliceW,
    sliceBandwidth,
    rot4D,
  }) {
    let needsRebuild = false;
    const nextSpaceId = spaceId || dimensionSpaceId;

    if (typeof nextSpaceId === 'string' && nextSpaceId !== this.spaceId) {
      this.spaceId = getDimensionSpace(nextSpaceId).id;
      needsRebuild = true;
    }

    if (Number.isInteger(exponentN) && exponentN >= 2 && exponentN <= 7 && exponentN !== this.exponentN) {
      this.exponentN = exponentN;
      needsRebuild = true;
    }

    if (typeof projectionAngle === 'number' && Math.abs(projectionAngle - this.projectionAngle) > 0.005) {
      this.projectionAngle = projectionAngle;
      needsRebuild = true;
    }

    if (Number.isInteger(resolution) && resolution >= 8 && resolution <= 28 && resolution !== this.gridResolutionU) {
      this.gridResolutionU = resolution;
      this.gridResolutionV = resolution;
      needsRebuild = true;
    }

    if (rot4D && typeof rot4D === 'object') {
      const next = { ...this.rot4D, ...rot4D };
      if (next.xw !== this.rot4D.xw || next.yw !== this.rot4D.yw || next.zw !== this.rot4D.zw) {
        this.rot4D = next;
        needsRebuild = true;
      }
    }

    if (typeof sliceEnabled === 'boolean') {
      this.sliceEnabled = sliceEnabled;
      if (this.shaderUniforms) this.shaderUniforms.uSliceEnabled.value = sliceEnabled ? 1.0 : 0.0;
    }

    if (typeof sliceW === 'number' && Number.isFinite(sliceW)) {
      this.sliceW = sliceW;
      if (this.shaderUniforms) this.shaderUniforms.uSliceW.value = sliceW;
    }

    if (typeof sliceBandwidth === 'number' && Number.isFinite(sliceBandwidth)) {
      this.sliceBandwidth = sliceBandwidth;
      if (this.shaderUniforms) this.shaderUniforms.uSliceBandwidth.value = sliceBandwidth;
    }

    if (needsRebuild) {
      this.resetSheetField();
      this.clearTrajectories();
      this.buildCalabiYauManifold();
    }
  }

  getActiveInvariants() {
    return computeTopologicalInvariants(this.spaceId, { exponentN: this.exponentN });
  }

  /**
   * Parses natural-language or code directives (e.g. "map Euler's constant to the phase angle xi",
   * "0.500 THz inference burst", "over-saturated glowing holographic wireframe") and applies them
   * directly to the live 3D Calabi-Yau manifold.
   */
  applyManifoldDirective(directiveText = '') {
    const text = directiveText.toLowerCase();
    const applied = {};

    if (text.includes('tesseract') || text.includes('hypercube') || text.includes('8-cell')) {
      this.spaceId = 'tesseract-4d';
      applied.spaceId = this.spaceId;
    } else if (text.includes('24-cell') || text.includes('icositetrachoron')) {
      this.spaceId = '24-cell-4d';
      applied.spaceId = this.spaceId;
    } else if (text.includes('hopf')) {
      this.spaceId = 'hopf-fibration-4d';
      applied.spaceId = this.spaceId;
    } else if (text.includes('clifford')) {
      this.spaceId = 'clifford-torus-4d';
      applied.spaceId = this.spaceId;
    } else if (text.includes('klein')) {
      this.spaceId = 'klein-bottle-4d';
      applied.spaceId = this.spaceId;
    } else if (text.includes('kaluza')) {
      this.spaceId = 'kaluza-klein-5d';
      applied.spaceId = this.spaceId;
    } else if (text.includes('g2') || text.includes('joyce') || text.includes('octonion')) {
      this.spaceId = 'g2-manifold-7d';
      applied.spaceId = this.spaceId;
    } else if (text.includes('e8') || text.includes('240 root')) {
      this.spaceId = 'e8-lattice-8d';
      applied.spaceId = this.spaceId;
    } else if (text.includes('11d') || text.includes('m-theory') || text.includes('horava')) {
      this.spaceId = 'm-theory-11d';
      applied.spaceId = this.spaceId;
    } else if (text.includes('10d') || text.includes('mirror quintic')) {
      this.spaceId = 'superstring-10d';
      applied.spaceId = this.spaceId;
    }

    if (text.includes('euler') || text.includes('math.e') || text.includes('2.718')) {
      this.projectionAngle = Math.E;
      applied.projectionAngle = Math.E;
    }

    const degreeMatch = text.match(/\b(quintic|sextic|septimic|quartic|cubic)\b/);
    if (degreeMatch) {
      const map = { cubic: 3, quartic: 4, quintic: 5, sextic: 6, septimic: 7 };
      this.exponentN = map[degreeMatch[1]] || 5;
      applied.exponentN = this.exponentN;
    }

    const thzMatch = text.match(/(\d+(?:\.\d+)?)\s*thz/i);
    const burstThz = thzMatch ? parseFloat(thzMatch[1]) : 0.5;

    if (text.includes('unstable') || text.includes('burst') || thzMatch) {
      this.baseAmplitude = Math.min(0.32, Math.max(0.08, burstThz * 0.42));
      this.vibrationAmplitude = Math.min(0.82, burstThz * 1.15);
      this.targetAmplitude = this.vibrationAmplitude;
      this.baseFrequency = Math.min(3.8, 1.4 + burstThz * 2.4);
      this.quantumFrequency = this.baseFrequency;
      this.targetFrequency = this.baseFrequency;
      applied.burstThz = burstThz;
    }

    if (text.includes('over-saturated') || text.includes('oversaturated') || text.includes('holographic')) {
      this.baseSaturation = 0.98;
      this.colorSaturation = 1.0;
      this.targetSaturation = 1.0;
      applied.saturation = 1.0;
    }

    this.resetSheetField();
    this.clearTrajectories();
    this.buildCalabiYauManifold();
    this.triggerQuantumPulse(Math.max(1.6, burstThz * 3.0), 'DIRECTIVE_LOCK');
    return applied;
  }

  bindInteractionEvents() {
    const dom = this.renderer.domElement;

    this.onPointerDown = (e) => {
      this.isDragging = true;
      this.previousPointer = { x: e.clientX, y: e.clientY };
    };

    this.onPointerMove = (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.previousPointer.x;
      const dy = e.clientY - this.previousPointer.y;
      this.previousPointer = { x: e.clientX, y: e.clientY };

      this.manualRotation.y += dx * 0.0065;
      this.manualRotation.x = Math.max(
        -Math.PI * 0.48,
        Math.min(Math.PI * 0.48, this.manualRotation.x + dy * 0.0065)
      );
    };

    this.onPointerUp = () => {
      this.isDragging = false;
    };

    this.onWheel = (e) => {
      e.preventDefault();
      this.cameraDistance = Math.max(2.6, Math.min(9.5, this.cameraDistance + e.deltaY * 0.003));
      this.camera.position.z = this.cameraDistance;
    };

    this.onResize = () => {
      if (!this.container) return;
      const width = this.container.clientWidth || window.innerWidth;
      const height = this.container.clientHeight || window.innerHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    };

    dom.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('resize', this.onResize);
  }

  animate() {
    this.animationFrameId = requestAnimationFrame(() => this.animate());

    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const dtMs = nowMs - this.lastFrameTimeMs;
    this.lastFrameTimeMs = nowMs;
    this.frameCount += 1;

    const gov = this.fpsGovernor.recordFrame(dtMs);
    this.measuredFps = gov.fps;
    if (gov.downgradedTo && this.graphicsMode === 'auto') {
      this.setGraphicsTier('auto', { forcedAutoTier: gov.downgradedTo });
    }

    const elapsedTime = this.clock.getElapsedTime();

    this.targetAmplitude += (this.baseAmplitude - this.targetAmplitude) * 0.055;
    this.vibrationAmplitude += (this.targetAmplitude - this.vibrationAmplitude) * 0.14;

    this.targetSaturation += (this.baseSaturation - this.targetSaturation) * 0.04;
    this.colorSaturation += (this.targetSaturation - this.colorSaturation) * 0.12;

    this.targetFrequency += (this.baseFrequency - this.targetFrequency) * 0.045;
    this.quantumFrequency += (this.targetFrequency - this.quantumFrequency) * 0.1;

    if (elapsedTime - this.lastInstrumentFrameAt > 6) this.instrumentTargetMix = 0;
    this.instrumentMix += (this.instrumentTargetMix - this.instrumentMix) * 0.03;
    const sheetCount = this.exponentN * this.exponentN;
    for (let i = 0; i < sheetCount; i++) {
      this.displaySheetEnergy[i] += (this.targetSheetEnergy[i] - this.displaySheetEnergy[i]) * 0.15;
    }
    for (let i = 0; i < sheetCount * 3; i++) {
      this.displaySheetColor[i] += (this.targetSheetColor[i] - this.displaySheetColor[i]) * 0.15;
    }

    const deformStride = this.graphicsProfile?.cpuDeformStride || 1;
    if (this.frameCount % deformStride === 0) {
      this.updateVertexDeformation(elapsedTime);
    }

    if (this.shaderUniforms) {
      this.shaderUniforms.uTime.value = elapsedTime;
      this.shaderUniforms.uAmplitude.value = this.vibrationAmplitude;
      this.shaderUniforms.uQuantumFrequency.value = this.quantumFrequency;
      this.shaderUniforms.uSaturation.value = this.colorSaturation;
      this.shaderUniforms.uSheetCount.value = sheetCount;
      this.shaderUniforms.uInstrumentMix.value = this.instrumentMix;
    }

    if (!this.isDragging) {
      const angularVelocity = 0.0032 + this.vibrationAmplitude * 0.028;
      this.manualRotation.y += angularVelocity;
      this.manualRotation.x += Math.sin(elapsedTime * 0.45) * 0.0009;
    }

    this.manifoldGroup.rotation.x += (this.manualRotation.x - this.manifoldGroup.rotation.x) * 0.12;
    this.manifoldGroup.rotation.y += (this.manualRotation.y - this.manifoldGroup.rotation.y) * 0.12;
    this.manifoldGroup.rotation.z = Math.sin(elapsedTime * 0.25) * 0.18;

    if (this.particleHalo) {
      this.particleHalo.rotation.y = -elapsedTime * 0.08;
      this.particleHalo.rotation.x = Math.cos(elapsedTime * 0.12) * 0.15;
      const haloScale = 1.0 + this.vibrationAmplitude * 0.32;
      this.particleHalo.scale.set(haloScale, haloScale, haloScale);
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('calabi-quantum-metric', this.domMetricHandler);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('resize', this.onResize);
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
