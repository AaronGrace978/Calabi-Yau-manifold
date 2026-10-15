import * as THREE from 'three';
import { rotationMatrix, rotateInto, projectTo3, sliceByLastAxis } from './geometry.js';

const STEREO_LIMIT = 7;
const PALETTE = [new THREE.Color('#22e4ff'), new THREE.Color('#8a5cff'), new THREE.Color('#ff3fb4'), new THREE.Color('#ffc845')];

function paletteColor(t, out) {
  const x = Math.min(0.9999, Math.max(0, t)) * (PALETTE.length - 1);
  const i = Math.floor(x);
  return out.copy(PALETTE[i]).lerp(PALETTE[i + 1], x - i);
}

/**
 * Renders one N-dimensional object at a time. Each frame the object's points are rotated in N-D,
 * projected to R³ and coloured by their hidden (last) coordinate, so depth in the extra
 * dimension reads as colour.
 */
export class LabViewer {
  constructor(container, { onFrame } = {}) {
    this.container = container;
    this.onFrame = onFrame;
    this.projection = 'perspective';
    this.angles = { xw: 0, yw: 0, zw: 0 };
    this.autoSpin = false;
    this.spinSpeed = 0.35;
    this.spinPhase = 0;
    this.slice = { enabled: false, level: 0, only: false };
    this.glow = 0;
    this.drag = null;
    this.view = { x: 0.35, y: -0.5 };
    this.distance = 4.4;
    this.clock = new THREE.Clock();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.05, 200);
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.buildHalo();
    this.bindInput();
    this.resize();
    this.loop();
  }

  buildHalo() {
    const count = 420;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 7 + Math.random() * 9;
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      pos.set([r * Math.sin(p) * Math.cos(t), r * Math.sin(p) * Math.sin(t), r * Math.cos(p)], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.halo = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x6fdcff, size: 0.035, transparent: true, opacity: 0.35, depthWrite: false }));
    this.scene.add(this.halo);
  }

  clearObject() {
    for (const obj of [this.lines, this.mesh, this.dots, this.sliceLines]) {
      if (!obj) continue;
      this.group.remove(obj);
      obj.geometry.dispose();
      obj.material.dispose();
    }
    this.lines = this.mesh = this.dots = this.sliceLines = null;
  }

  /**
   * @param {object} geo object from geometry.js
   * @param {{projection?: string, faceOn?: boolean}} opts
   */
  setObject(geo, { projection, faceOn = false } = {}) {
    this.clearObject();
    this.geo = geo;
    if (projection) this.projection = projection;
    const n = geo.points.length;
    this.rotated = geo.points.map((p) => new Array(p.length).fill(0));
    this.positions = new Float32Array(n * 3);
    this.colors = new Float32Array(n * 3);
    this.polygons = geo.kind === 'surface' ? geo.triangles : geo.faces || null;

    const posAttr = new THREE.BufferAttribute(this.positions, 3);
    const colAttr = new THREE.BufferAttribute(this.colors, 3);
    const sharedGeometry = (index) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', posAttr);
      g.setAttribute('color', colAttr);
      if (index) g.setIndex(index);
      return g;
    };

    const lineGeo = sharedGeometry(geo.edges.flat());
    const surface = geo.kind === 'surface';
    // Additive lines saturate to white when thousands overlap, so dense objects get fainter lines.
    this.baseLineOpacity = surface ? 0.45 : Math.min(0.8, 0.8 * Math.pow(900 / geo.edges.length, 0.6));
    this.lines = new THREE.LineSegments(
      lineGeo,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: this.baseLineOpacity, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.group.add(this.lines);

    if (surface) {
      this.mesh = new THREE.Mesh(
        sharedGeometry(geo.triangles.flat()),
        new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.13, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      this.group.add(this.mesh);
    } else if (!geo.hue && n <= 2400) {
      this.dots = new THREE.Points(sharedGeometry(null), new THREE.PointsMaterial({ vertexColors: true, size: n > 400 ? 0.03 : 0.06, transparent: true, opacity: 0.95, depthWrite: false }));
      this.group.add(this.dots);
    }

    const sliceGeo = new THREE.BufferGeometry();
    sliceGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    this.sliceLines = new THREE.LineSegments(sliceGeo, new THREE.LineBasicMaterial({ color: 0xffe066, transparent: true, opacity: 1, depthTest: false }));
    this.sliceLines.renderOrder = 5;
    this.group.add(this.sliceLines);

    this.view = faceOn ? { x: 0, y: 0 } : { x: 0.35, y: -0.5 };
    this.group.rotation.set(this.view.x, this.view.y, 0);
    this.updateGeometry();
    this.fitCamera();
  }

  fitCamera() {
    const radii = [];
    for (let i = 0; i < this.positions.length; i += 3) {
      radii.push(Math.hypot(this.positions[i], this.positions[i + 1], this.positions[i + 2]));
    }
    radii.sort((a, b) => a - b);
    // A high percentile rather than the max, so a few stereographic outliers do not shrink the view.
    const r = Math.max(0.5, radii[Math.floor(radii.length * 0.94)] || 1);
    this.distance = Math.min(22, Math.max(2.6, r * 2.8));
  }

  setProjection(mode) {
    this.projection = mode;
    this.updateGeometry();
    this.fitCamera();
  }

  setAngles(angles) {
    this.angles = { ...this.angles, ...angles };
  }

  setAutoSpin(enabled, speed = this.spinSpeed) {
    this.autoSpin = enabled;
    this.spinSpeed = speed;
  }

  setSlice(patch) {
    this.slice = { ...this.slice, ...patch };
  }

  pulse(strength = 0.6) {
    this.glow = Math.min(1.5, this.glow + strength);
  }

  snapshot() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  planes(dim) {
    const planes = [];
    if (dim >= 4) {
      planes.push({ i: 0, j: 3, angle: this.angles.xw }, { i: 1, j: 3, angle: this.angles.yw }, { i: 2, j: 3, angle: this.angles.zw });
    }
    if (this.autoSpin && dim >= 4) {
      const t = this.spinPhase;
      planes.push({ i: 0, j: 3, angle: t }, { i: 2, j: 3, angle: t * 0.618 });
      for (let k = 4; k < dim; k++) {
        planes.push({ i: k % 3, j: k, angle: t * (0.5 + 0.13 * k) }, { i: 3, j: k, angle: t * 0.37 });
      }
    }
    return planes;
  }

  updateGeometry() {
    const geo = this.geo;
    if (!geo) return;
    const dim = geo.dim;
    const m = rotationMatrix(dim, this.planes(dim));
    const color = new THREE.Color();
    const hidden = Math.max(0, dim - 1);
    const stereo = this.projection === 'stereographic' && dim === 4;
    const mode = this.projection === 'stereographic' && dim !== 4 ? 'perspective' : this.projection;
    const hideBody = this.slice.enabled && this.slice.only && this.polygons;

    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < geo.points.length; i++) {
      const v = rotateInto(m, geo.points[i], this.rotated[i])[hidden];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    const span = Math.max(1e-6, hi - lo);

    for (let i = 0; i < geo.points.length; i++) {
      const r = this.rotated[i];
      let [x, y, z] = projectTo3(r, mode);
      let fade = 1;
      if (stereo) {
        // Points near the projection pole fly off to infinity; fade them out instead of drawing spikes.
        const len = Math.hypot(x, y, z);
        fade = Math.min(1, Math.max(0, (STEREO_LIMIT - len) / 3));
        if (len > STEREO_LIMIT) {
          const k = STEREO_LIMIT / len;
          x *= k;
          y *= k;
          z *= k;
        }
      }
      this.positions[i * 3] = x;
      this.positions[i * 3 + 1] = y;
      this.positions[i * 3 + 2] = z;
      const t = geo.hue && geo.hue[i] >= 0 ? geo.hue[i] : dim >= 3 ? (r[hidden] - lo) / span : 0.25;
      paletteColor(t, color);
      const dim01 = (hideBody ? 0.08 : 1) * fade;
      this.colors[i * 3] = color.r * dim01;
      this.colors[i * 3 + 1] = color.g * dim01;
      this.colors[i * 3 + 2] = color.b * dim01;
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
    this.lines.geometry.attributes.color.needsUpdate = true;
    this.lines.geometry.computeBoundingSphere();

    this.updateSlice(mode);
  }

  updateSlice(mode) {
    const attr = this.sliceLines.geometry.attributes.position;
    if (!this.slice.enabled || !this.polygons || this.geo.dim < 2) {
      this.sliceLines.visible = false;
      this.sliceCount = 0;
      return;
    }
    const segs = sliceByLastAxis(this.rotated, this.polygons, this.slice.level);
    this.sliceCount = segs.length;
    let arr = attr.array;
    if (arr.length < segs.length * 6) {
      arr = new Float32Array(Math.max(segs.length * 6, arr.length * 2));
      this.sliceLines.geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    }
    let o = 0;
    for (const [a, b] of segs) {
      for (const p of [a, b]) {
        const q = projectTo3(this.slice.only ? p.slice(0, -1) : p, mode);
        arr[o++] = q[0];
        arr[o++] = q[1];
        arr[o++] = q[2];
      }
    }
    const pos = this.sliceLines.geometry.attributes.position;
    pos.needsUpdate = true;
    this.sliceLines.geometry.setDrawRange(0, segs.length * 2);
    this.sliceLines.geometry.computeBoundingSphere();
    this.sliceLines.visible = segs.length > 0;
  }

  bindInput() {
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', (e) => {
      this.drag = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      this.view.y += (e.clientX - this.drag.x) * 0.006;
      this.view.x = Math.max(-1.5, Math.min(1.5, this.view.x + (e.clientY - this.drag.y) * 0.006));
      this.drag = { x: e.clientX, y: e.clientY };
    });
    el.addEventListener('pointerup', () => (this.drag = null));
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.distance = Math.max(1.2, Math.min(30, this.distance * (1 + e.deltaY * 0.001)));
      },
      { passive: false }
    );
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
  }

  /** Keeps the object centred in the area above an overlay of `px` pixels at the bottom. */
  setBottomInset(px) {
    this.bottomInset = px;
    this.resize();
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    const shift = Math.min(h * 0.3, (this.bottomInset || 0) / 2);
    if (shift > 0) this.camera.setViewOffset(w, h, 0, shift, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  loop() {
    this.frame = requestAnimationFrame(() => this.loop());
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.autoSpin) this.spinPhase += dt * this.spinSpeed;
    this.glow *= 0.94;

    if (this.geo) {
      this.updateGeometry();
      const lift = 1 + this.glow * 0.35;
      this.lines.material.opacity = Math.min(1, this.baseLineOpacity * lift);
      if (this.mesh) this.mesh.material.opacity = 0.12 * lift;
    }
    if (this.autoSpin && this.geo && this.geo.dim <= 3 && !this.drag) this.view.y += dt * this.spinSpeed * 0.6;

    this.group.rotation.x += (this.view.x - this.group.rotation.x) * 0.15;
    this.group.rotation.y += (this.view.y - this.group.rotation.y) * 0.15;
    this.camera.position.set(0, 0, this.distance);
    this.camera.lookAt(0, 0, 0);
    this.halo.rotation.y += dt * 0.02;
    this.halo.material.opacity = 0.3 + this.glow * 0.3;
    this.renderer.render(this.scene, this.camera);
    if (this.onFrame) this.onFrame(this);
  }
}
