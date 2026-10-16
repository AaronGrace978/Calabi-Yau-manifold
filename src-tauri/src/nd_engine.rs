//! High-performance N-dimensional (up to 11D) matrix mutation, hyperplane cross-section
//! slicing, hyperspace particle physics, and binary Float32Array buffer streaming engine.

use base64::Engine;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, AtomicU64};
use std::sync::{Arc, RwLock};
use std::time::Instant;

pub const MAX_DIM: usize = 11;
const STEREO_LIMIT: f64 = 7.0;
const DEPTH_BAND_COUNT: usize = 8;

/// Palette stops matching `src/lab/viewer.js` (`#22e4ff`, `#8a5cff`, `#ff3fb4`, `#ffc845`).
const PALETTE: [[f32; 3]; 4] = [
    [0.133333, 0.894118, 1.0],
    [0.541176, 0.360784, 1.0],
    [1.0, 0.247059, 0.705882],
    [1.0, 0.784314, 0.270588],
];

fn palette_color(t: f64) -> [f32; 3] {
    let x = t.clamp(0.0, 0.9999) * ((PALETTE.len() - 1) as f64);
    let i = (x.floor() as usize).min(PALETTE.len() - 2);
    let frac = (x - (i as f64)) as f32;
    let a = PALETTE[i];
    let b = PALETTE[i + 1];
    [
        a[0] + (b[0] - a[0]) * frac,
        a[1] + (b[1] - a[1]) * frac,
        a[2] + (b[2] - a[2]) * frac,
    ]
}

/// One Givens rotation plane `(i, j, angle)` in R^N.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct GivensPlane {
    pub i: usize,
    pub j: usize,
    pub angle: f64,
}

/// Simulated particle in N-dimensional hyperspace (4D..11D).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HyperspaceParticle {
    pub pos: [f64; MAX_DIM],
    pub vel: [f64; MAX_DIM],
}

/// Cached N-dimensional manifold geometry and simulation state.
#[derive(Debug, Clone)]
pub struct CachedManifold {
    pub dim: usize,
    pub points: Vec<[f64; MAX_DIM]>,
    pub polygons: Vec<Vec<usize>>,
    pub hue: Option<Vec<f64>>,
    pub edge_count: usize,
    pub prev_slice_level: f64,
    pub particles: Vec<HyperspaceParticle>,
    pub wave_phase: f64,
}

impl Default for CachedManifold {
    fn default() -> Self {
        Self {
            dim: 4,
            points: Vec::new(),
            polygons: Vec::new(),
            hue: None,
            edge_count: 0,
            prev_slice_level: 0.0,
            particles: Vec::new(),
            wave_phase: 0.0,
        }
    }
}

/// Thread-safe handle shared across Tauri IPC commands and background streaming tasks.
#[derive(Clone)]
pub struct NdEngineHandle {
    pub state: Arc<RwLock<CachedManifold>>,
    pub streaming: Arc<AtomicBool>,
    pub stream_generation: Arc<AtomicU64>,
}

impl Default for NdEngineHandle {
    fn default() -> Self {
        Self {
            state: Arc::new(RwLock::new(CachedManifold::default())),
            streaming: Arc::new(AtomicBool::new(false)),
            stream_generation: Arc::new(AtomicU64::new(0)),
        }
    }
}

/// Compact frame payload streamed from Rust to the WebGL UI.
/// Binary `f32` buffers are base64-encoded for fast decoding into `Float32Array` typed arrays.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NdFrameBuffer {
    pub dim: usize,
    pub vertex_count: usize,
    pub slice_segment_count: usize,
    pub active_vertices: usize,
    pub active_edges: usize,
    pub positions_b64: String,
    pub colors_b64: String,
    pub slice_b64: String,
    pub features: [f32; 16],
    pub compute_ms: f64,
}

/// Encodes a slice of `f32` into standard base64 of its little-endian IEEE-754 bytes.
pub fn encode_f32_buffer(values: &[f32]) -> String {
    let mut bytes = Vec::with_capacity(values.len() * 4);
    for &v in values {
        bytes.extend_from_slice(&v.to_le_bytes());
    }
    base64::engine::general_purpose::STANDARD.encode(&bytes)
}

/// Decodes a base64-encoded little-endian IEEE-754 `f32` buffer.
#[cfg(test)]
pub fn decode_f32_buffer(b64: &str) -> Result<Vec<f32>, String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(b64)
        .map_err(|e| e.to_string())?;
    if bytes.len() % 4 != 0 {
        return Err("Byte length is not a multiple of 4".into());
    }
    Ok(bytes
        .chunks_exact(4)
        .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
        .collect())
}

/// Builds an N×N rotation matrix on the stack (`N <= 11`) from a sequence of Givens rotations.
pub fn rotation_matrix_nd(dim: usize, planes: &[GivensPlane]) -> [[f64; MAX_DIM]; MAX_DIM] {
    let n = dim.clamp(1, MAX_DIM);
    let mut m = [[0.0; MAX_DIM]; MAX_DIM];
    for i in 0..n {
        m[i][i] = 1.0;
    }
    for p in planes {
        if p.angle == 0.0 || p.i >= n || p.j >= n || p.i == p.j {
            continue;
        }
        let (s, c) = p.angle.sin_cos();
        for row in m.iter_mut().take(n) {
            let a = row[p.i];
            let b = row[p.j];
            row[p.i] = c * a - s * b;
            row[p.j] = s * a + c * b;
        }
    }
    m
}

/// Rotates an N-D point `p` by matrix `m` (`dim <= 11`).
#[inline]
pub fn rotate_point_nd(
    m: &[[f64; MAX_DIM]; MAX_DIM],
    p: &[f64; MAX_DIM],
    dim: usize,
) -> [f64; MAX_DIM] {
    let n = dim.clamp(1, MAX_DIM);
    let mut out = [0.0; MAX_DIM];
    for r in 0..n {
        let mut s = 0.0;
        let row = &m[r];
        for c in 0..n {
            s += row[c] * p[c];
        }
        out[r] = s;
    }
    out
}

/// Projects an N-D point to R³ using `perspective`, `orthographic`, or `stereographic`.
#[inline]
pub fn project_to_3_nd(p: &[f64; MAX_DIM], dim: usize, mode: &str, distance: f64) -> [f64; 3] {
    if dim <= 3 {
        return [p[0], p[1], if dim == 3 { p[2] } else { 0.0 }];
    }
    if mode == "orthographic" {
        return [p[0], p[1], p[2]];
    }
    if mode == "stereographic" {
        let d = (1.0 - p[dim - 1]).max(0.04);
        return [p[0] / d, p[1] / d, p[2] / d];
    }
    let mut q = *p;
    for k in (3..dim).rev() {
        let f = distance / (distance - q[k]).max(0.2);
        for item in q.iter_mut().take(k) {
            *item *= f;
        }
    }
    [q[0], q[1], q[2]]
}

/// Computes exact hyperplane cross-section segments where `x_{dim-1} = level`.
pub fn slice_by_last_axis_nd(
    rotated: &[[f64; MAX_DIM]],
    polygons: &[Vec<usize>],
    dim: usize,
    level: f64,
) -> Vec<([f64; MAX_DIM], [f64; MAX_DIM])> {
    let mut segments = Vec::new();
    if polygons.is_empty() || rotated.is_empty() || dim < 2 {
        return segments;
    }
    let last = dim - 1;
    for poly in polygons {
        if poly.len() < 3 {
            continue;
        }
        let mut hits: Vec<[f64; MAX_DIM]> = Vec::with_capacity(2);
        for e in 0..poly.len() {
            let idx_a = poly[e];
            let idx_b = poly[(e + 1) % poly.len()];
            if idx_a >= rotated.len() || idx_b >= rotated.len() {
                continue;
            }
            let a = &rotated[idx_a];
            let b = &rotated[idx_b];
            let da = a[last] - level;
            let db = b[last] - level;
            if (da > 0.0 && db > 0.0) || (da < 0.0 && db < 0.0) {
                continue;
            }
            if (da - db).abs() < 1e-12 {
                continue;
            }
            let t = da / (da - db);
            if !(0.0..=1.0).contains(&t) {
                continue;
            }
            let mut p = [0.0; MAX_DIM];
            for k in 0..dim {
                p[k] = a[k] + t * (b[k] - a[k]);
            }
            p[last] = level;
            let duplicate = hits
                .iter()
                .any(|h| (0..dim).all(|k| (h[k] - p[k]).abs() < 1e-9));
            if !duplicate {
                hits.push(p);
            }
        }
        if hits.len() == 2 {
            segments.push((hits[0], hits[1]));
        }
    }
    segments
}

/// Executes a full N-dimensional mutation, projection, slicing, and feature-extraction pass.
pub fn compute_nd_frame(
    manifold: &mut CachedManifold,
    planes: &[GivensPlane],
    projection: &str,
    slice_enabled: bool,
    slice_level: f64,
    slice_only: bool,
    dt: f64,
) -> NdFrameBuffer {
    let started = Instant::now();
    let dim = manifold.dim.clamp(2, MAX_DIM);
    let n = manifold.points.len();
    let hidden = dim - 1;
    let stereo = projection == "stereographic" && dim == 4;
    let mode = if projection == "stereographic" && dim != 4 {
        "perspective"
    } else {
        projection
    };
    let hide_body = slice_enabled && slice_only && !manifold.polygons.is_empty();

    let rot = rotation_matrix_nd(dim, planes);
    let mut rotated = Vec::with_capacity(n);
    let mut lo = f64::INFINITY;
    let mut hi = f64::NEG_INFINITY;

    for p in &manifold.points {
        let r = rotate_point_nd(&rot, p, dim);
        let v = r[hidden];
        if v < lo {
            lo = v;
        }
        if v > hi {
            hi = v;
        }
        rotated.push(r);
    }
    let span = (hi - lo).max(1e-6);

    // Projection origin for N-D vertex distance tracking
    let mut origin = [0.0; MAX_DIM];
    if dim > 3 && mode != "orthographic" {
        if mode == "stereographic" {
            origin[hidden] = 1.0;
        } else {
            for item in origin.iter_mut().take(dim).skip(3) {
                *item = 2.4;
            }
        }
    }

    let mut raw_distances = Vec::with_capacity(n);
    let mut min_dist = f64::INFINITY;
    let mut max_dist = f64::NEG_INFINITY;

    let mut positions = Vec::with_capacity(n * 3);
    let mut colors = Vec::with_capacity(n * 3);

    for (i, r) in rotated.iter().enumerate() {
        let mut d2 = 0.0;
        for k in 0..dim {
            let diff = r[k] - origin[k];
            d2 += diff * diff;
        }
        let d = d2.sqrt();
        if d < min_dist {
            min_dist = d;
        }
        if d > max_dist {
            max_dist = d;
        }
        raw_distances.push(d);

        let mut p3 = project_to_3_nd(r, dim, mode, 2.4);
        let mut fade = 1.0_f32;
        if stereo {
            let len = (p3[0] * p3[0] + p3[1] * p3[1] + p3[2] * p3[2]).sqrt();
            fade = (((STEREO_LIMIT - len) / 3.0).clamp(0.0, 1.0)) as f32;
            if len > STEREO_LIMIT {
                let k = STEREO_LIMIT / len;
                p3[0] *= k;
                p3[1] *= k;
                p3[2] *= k;
            }
        }
        positions.push(p3[0] as f32);
        positions.push(p3[1] as f32);
        positions.push(p3[2] as f32);

        let t = if let Some(ref hues) = manifold.hue {
            let h = hues.get(i).copied().unwrap_or(-1.0);
            if h >= 0.0 {
                h
            } else {
                (r[hidden] - lo) / span
            }
        } else if dim >= 3 {
            (r[hidden] - lo) / span
        } else {
            0.25
        };
        let col = palette_color(t);
        let dim01 = (if hide_body { 0.08 } else { 1.0 }) * fade;
        colors.push(col[0] * dim01);
        colors.push(col[1] * dim01);
        colors.push(col[2] * dim01);
    }

    // Hyperplane cross-section slicing
    let mut slice_positions = Vec::new();
    let mut slice_segment_count = 0;
    if slice_enabled && !manifold.polygons.is_empty() && dim >= 2 {
        let segs = slice_by_last_axis_nd(&rotated, &manifold.polygons, dim, slice_level);
        slice_segment_count = segs.len();
        slice_positions.reserve(slice_segment_count * 6);
        let proj_dim = if slice_only { (dim - 1).max(2) } else { dim };
        for (a, b) in segs {
            for pt in [a, b] {
                let q = project_to_3_nd(&pt, proj_dim, mode, 2.4);
                slice_positions.push(q[0] as f32);
                slice_positions.push(q[1] as f32);
                slice_positions.push(q[2] as f32);
            }
        }
    }

    // Feature-extraction matrix (16 normalized channels)
    let dist_span = max_dist - min_dist;
    let mut depth_bands = [0.0_f64; DEPTH_BAND_COUNT];
    let mut sum_dist = 0.0;
    let mut sum_sq_dist = 0.0;

    for (i, r) in rotated.iter().enumerate() {
        let norm_d = if dist_span > 1e-6 {
            ((raw_distances[i] - min_dist) / dist_span).clamp(0.0, 1.0)
        } else {
            0.5
        };
        sum_dist += norm_d;
        sum_sq_dist += norm_d * norm_d;

        let t = if let Some(ref hues) = manifold.hue {
            let h = hues.get(i).copied().unwrap_or(-1.0);
            if h >= 0.0 {
                h.clamp(0.0, 1.0)
            } else {
                ((r[hidden] - lo) / span).clamp(0.0, 1.0)
            }
        } else {
            ((r[hidden] - lo) / span).clamp(0.0, 1.0)
        };
        let bf = t * ((DEPTH_BAND_COUNT - 1) as f64);
        let b0 = (bf.floor() as usize).min(DEPTH_BAND_COUNT - 1);
        let b1 = (b0 + 1).min(DEPTH_BAND_COUNT - 1);
        let frac = bf - (b0 as f64);
        let weight = 0.5 + 0.5 * (1.0 - norm_d);
        depth_bands[b0] += (1.0 - frac) * weight;
        depth_bands[b1] += frac * weight;
    }

    let max_band = depth_bands.iter().copied().fold(0.0_f64, f64::max);
    let mut features = [0.0_f32; 16];
    for b in 0..DEPTH_BAND_COUNT {
        features[b] = if max_band > 1e-6 {
            (depth_bands[b] / max_band).clamp(0.0, 1.0) as f32
        } else {
            0.0
        };
    }

    let mean_dist = if n > 0 {
        (sum_dist / (n as f64)).clamp(0.0, 1.0)
    } else {
        0.0
    };
    let variance = if n > 0 {
        (sum_sq_dist / (n as f64) - mean_dist * mean_dist).max(0.0)
    } else {
        0.0
    };
    let spread = (variance.sqrt() * 2.0).clamp(0.0, 1.0);

    let safe_dt = dt.max(1e-4);
    let raw_vel = if slice_enabled {
        (slice_level - manifold.prev_slice_level) / safe_dt
    } else {
        0.0
    };
    manifold.prev_slice_level = slice_level;

    let signed_vel = (raw_vel * 0.35).tanh();
    let slice_vel_norm = (0.5 + 0.5 * signed_vel).clamp(0.0, 1.0);
    let slice_speed = (raw_vel.abs() / 4.0).clamp(0.0, 1.0);
    let slice_level_norm = ((slice_level + 1.2) / 2.4).clamp(0.0, 1.0);

    let active_edges = if slice_enabled {
        slice_segment_count
    } else {
        manifold.edge_count
    };
    let active_vertices = if slice_enabled {
        slice_segment_count * 2
    } else {
        n
    };

    let vertex_density =
        ((1.0 + (n as f64)).log2() / (1.0 + 2048.0_f64).log2()).clamp(0.0, 1.0);
    let edge_density =
        ((1.0 + (manifold.edge_count as f64)).log2() / (1.0 + 11264.0_f64).log2()).clamp(0.0, 1.0);
    let active_slice_ratio = if slice_enabled {
        ((active_vertices as f64) / (n.max(1) as f64)).clamp(0.0, 1.0)
    } else {
        1.0
    };

    features[8] = mean_dist as f32;
    features[9] = spread as f32;
    features[10] = slice_vel_norm as f32;
    features[11] = slice_speed as f32;
    features[12] = slice_level_norm as f32;
    features[13] = vertex_density as f32;
    features[14] = edge_density as f32;
    features[15] = active_slice_ratio as f32;

    NdFrameBuffer {
        dim,
        vertex_count: n,
        slice_segment_count,
        active_vertices,
        active_edges,
        positions_b64: encode_f32_buffer(&positions),
        colors_b64: encode_f32_buffer(&colors),
        slice_b64: encode_f32_buffer(&slice_positions),
        features,
        compute_ms: started.elapsed().as_secs_f64() * 1000.0,
    }
}

/// Steps N-dimensional hyperspace particles (orbiting a central gravity well and reflecting
/// off the unit N-sphere / polytope boundary) and returns their projected 3D buffer.
pub fn step_particles_nd(manifold: &mut CachedManifold, count: usize, dt: f64) -> Vec<f32> {
    let dim = manifold.dim.clamp(3, MAX_DIM);
    let target = count.clamp(1, 4096);
    if manifold.particles.len() != target {
        manifold.particles.clear();
        manifold.particles.reserve(target);
        for i in 0..target {
            let mut pos = [0.0; MAX_DIM];
            let mut vel = [0.0; MAX_DIM];
            let seed = (i as f64) * 1.61803398875;
            for k in 0..dim {
                pos[k] = 0.65 * (seed * ((k + 1) as f64) * 0.73).sin();
                vel[k] = 0.35 * (seed * ((k + 2) as f64) * 1.17).cos();
            }
            manifold.particles.push(HyperspaceParticle { pos, vel });
        }
    }

    let safe_dt = dt.clamp(0.001, 0.05);
    manifold.wave_phase += safe_dt * 2.4;
    let mut projected = Vec::with_capacity(target * 3);

    for p in &mut manifold.particles {
        let mut r2 = 0.0;
        for k in 0..dim {
            r2 += p.pos[k] * p.pos[k];
        }
        let r = r2.sqrt().max(0.08);
        // Central harmonic-gravitational attraction in R^N
        let accel = -0.85 / (r * r + 0.12);
        for k in 0..dim {
            p.vel[k] += (p.pos[k] / r) * accel * safe_dt;
            p.pos[k] += p.vel[k] * safe_dt;
        }
        // Elastic reflection off the unit N-sphere boundary
        let mut new_r2 = 0.0;
        for k in 0..dim {
            new_r2 += p.pos[k] * p.pos[k];
        }
        if new_r2 > 1.0 {
            let new_r = new_r2.sqrt();
            let mut dot_rv = 0.0;
            for k in 0..dim {
                p.pos[k] /= new_r;
                dot_rv += p.pos[k] * p.vel[k];
            }
            if dot_rv > 0.0 {
                for k in 0..dim {
                    p.vel[k] -= 1.9 * dot_rv * p.pos[k];
                }
            }
        }
        let q = project_to_3_nd(&p.pos, dim, "perspective", 2.4);
        projected.push(q[0] as f32);
        projected.push(q[1] as f32);
        projected.push(q[2] as f32);
    }
    projected
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preserves_norm_up_to_11d() {
        for dim in [4, 7, 11] {
            let planes = vec![
                GivensPlane {
                    i: 0,
                    j: dim - 1,
                    angle: 0.7,
                },
                GivensPlane {
                    i: 1,
                    j: 3,
                    angle: -1.3,
                },
                GivensPlane {
                    i: 2,
                    j: dim - 2,
                    angle: 2.1,
                },
            ];
            let m = rotation_matrix_nd(dim, &planes);
            let mut p = [0.0; MAX_DIM];
            for k in 0..dim {
                p[k] = ((k + 1) as f64).sin();
            }
            let r = rotate_point_nd(&m, &p, dim);
            let norm_p: f64 = p[..dim].iter().map(|x| x * x).sum::<f64>().sqrt();
            let norm_r: f64 = r[..dim].iter().map(|x| x * x).sum::<f64>().sqrt();
            assert!((norm_p - norm_r).abs() < 1e-12);
        }
    }

    #[test]
    fn slices_4d_tesseract_into_12_cube_edges_and_packs_f32_buffers() {
        let mut points = Vec::new();
        for m in 0..16 {
            let mut p = [0.0; MAX_DIM];
            for b in 0..4 {
                p[b] = if (m & (1 << b)) != 0 { 0.5 } else { -0.5 };
            }
            points.push(p);
        }
        let mut faces = Vec::new();
        for a in 0..4 {
            for b in (a + 1)..4 {
                let ba = 1 << a;
                let bb = 1 << b;
                for m in 0..16 {
                    if (m & ba) != 0 || (m & bb) != 0 {
                        continue;
                    }
                    faces.push(vec![m, m | ba, m | ba | bb, m | bb]);
                }
            }
        }

        let mut manifold = CachedManifold {
            dim: 4,
            points,
            polygons: faces,
            hue: None,
            edge_count: 32,
            prev_slice_level: -0.2,
            particles: Vec::new(),
            wave_phase: 0.0,
        };

        let frame = compute_nd_frame(&mut manifold, &[], "perspective", true, 0.0, false, 1.0 / 60.0);
        assert_eq!(frame.vertex_count, 16);
        assert_eq!(frame.slice_segment_count, 12);
        assert_eq!(frame.active_edges, 12);

        let decoded_pos = decode_f32_buffer(&frame.positions_b64).unwrap();
        assert_eq!(decoded_pos.len(), 16 * 3);
        let decoded_slice = decode_f32_buffer(&frame.slice_b64).unwrap();
        assert_eq!(decoded_slice.len(), 12 * 6);

        for &f in &frame.features {
            assert!((0.0..=1.0).contains(&f));
        }
        assert!(frame.features[11] > 0.0, "slice speed reflects level change");
    }

    #[test]
    fn steps_hyperspace_particles_within_unit_sphere() {
        let mut manifold = CachedManifold {
            dim: 5,
            ..Default::default()
        };
        let buf = step_particles_nd(&mut manifold, 64, 0.016);
        assert_eq!(buf.len(), 64 * 3);
        for p in &manifold.particles {
            let r2: f64 = p.pos[..5].iter().map(|x| x * x).sum();
            assert!(r2 <= 1.0 + 1e-6);
        }
    }
}
