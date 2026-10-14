import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  DIMENSION_CATALOG,
  computeTopologicalInvariants,
  generateTesseract4D,
  generate24Cell4D,
  generateE8Lattice8D,
  rotate4D,
  project4DTo3D,
  slice4DHyperplane,
  evaluateDimensionalPoint,
  evaluateRiemannianMetric,
  estimateCorrelationDimension,
  estimateLyapunovExponent,
} from '../src/dimensions/dimensionalEngine.js';

import {
  selectTemplateForPrompt,
  parseMultiFileResponse,
  compileApplicationProject,
  bundlePreviewHtml,
  verifyAndSelfHealProject,
  runAutonomousBuildLoop,
  isApplicationBuildPrompt,
  isConversationalFillerPrompt,
  computeVietorisRipsPersistence,
  fisherRaoDistance,
  computeBerryGeometricPhase,
  discoverSymbolicInvariants,
  synthesizeCrossLabConsensus,
  mintProofCarryingCertificate,
  verifyProofCertificate,
  generateFrontierWitnessDossierHtml,
} from '../src/builder/index.js';

import {
  GRAPHICS_PROFILES,
  classifyHardwareEnvironment,
  AdaptiveFpsGovernor,
} from '../src/graphics/hardwareProfile.js';

describe('Higher-Dimensional Science & Topology Engine (2D–11D)', () => {
  it('catalogs all scientific spaces from 4D polychora to 11D M-Theory', () => {
    assert.ok(DIMENSION_CATALOG.length >= 10);
    const ids = DIMENSION_CATALOG.map((d) => d.id);
    assert.ok(ids.includes('tesseract-4d'));
    assert.ok(ids.includes('24-cell-4d'));
    assert.ok(ids.includes('hopf-fibration-4d'));
    assert.ok(ids.includes('klein-bottle-4d'));
    assert.ok(ids.includes('kaluza-klein-5d'));
    assert.ok(ids.includes('calabi-yau-6d'));
    assert.ok(ids.includes('g2-manifold-7d'));
    assert.ok(ids.includes('e8-lattice-8d'));
    assert.ok(ids.includes('m-theory-11d'));
  });

  it('computes exact topological invariants (Euler characteristic, Hodge numbers, Betti numbers)', () => {
    const cy5 = computeTopologicalInvariants('calabi-yau-6d', { exponentN: 5 });
    assert.equal(cy5.eulerCharacteristic, -200);
    assert.equal(cy5.hodgeNumbers['h1,1'], 1);
    assert.equal(cy5.hodgeNumbers['h2,1'], 101);
    assert.equal(cy5.holonomy, 'SU(3)');

    const tesseract = computeTopologicalInvariants('tesseract-4d');
    assert.equal(tesseract.eulerCharacteristic, 0);
    assert.deepEqual(tesseract.polytopeCounts, { V: 16, E: 32, F: 24, C: 8 });

    const cell24 = computeTopologicalInvariants('24-cell-4d');
    assert.equal(cell24.eulerCharacteristic, 0);
    assert.deepEqual(cell24.polytopeCounts, { V: 24, E: 96, F: 96, C: 24 });
  });

  it('generates exact 4D Tesseract, 24-Cell, and all 240 roots of the 8D E8 lattice', () => {
    const tess = generateTesseract4D();
    assert.equal(tess.vertices.length, 16);
    assert.equal(tess.edges.length, 32);

    const c24 = generate24Cell4D();
    assert.equal(c24.vertices.length, 24);
    assert.equal(c24.edges.length, 96);

    const e8 = generateE8Lattice8D();
    assert.equal(e8.roots8D.length, 240);
    assert.equal(e8.projected4D.length, 240);
    for (const r of e8.roots8D.slice(0, 25)) {
      const sqNorm = r.reduce((acc, x) => acc + x * x, 0);
      assert.ok(Math.abs(sqNorm - 2.0) < 1e-6);
    }
  });

  it('performs isometric SO(4) rotations, stereographic 4D->3D projections, and w4 hyperplane slicing', () => {
    const v = [1, -1, 1, 1];
    const r = rotate4D(v, { xy: 0.4, xw: 0.8, yw: -0.3, zw: 1.1 });
    const normBefore = Math.hypot(...v);
    const normAfter = Math.hypot(...r);
    assert.ok(Math.abs(normAfter - normBefore) < 1e-9);

    const proj = project4DTo3D(r, { poleW: 2.8, mode: 'stereographic' });
    assert.ok(Number.isFinite(proj.x));
    assert.ok(Number.isFinite(proj.y));
    assert.ok(Number.isFinite(proj.z));

    const tess = generateTesseract4D();
    const sliceAtZero = slice4DHyperplane(tess.vertices, tess.edges, 0.0);
    assert.equal(sliceAtZero.intersectionCount, 8);
    assert.equal(sliceAtZero.intersections.length, 8);
  });

  it('evaluates points and Riemannian metrics across all dimensions and estimates D2 & Lyapunov', () => {
    for (const space of DIMENSION_CATALOG) {
      const pt = evaluateDimensionalPoint(space.id, 0.35, 0.65, 1, 2, 5, 0.7);
      assert.ok(Number.isFinite(pt.x));
      assert.ok(Number.isFinite(pt.y));
      assert.ok(Number.isFinite(pt.z));
      assert.ok(Number.isFinite(pt.w4));
    }

    const metric = evaluateRiemannianMetric('calabi-yau-6d', 0.3, 0.4, 0, 0, 5, 0.68);
    assert.ok(metric.detG > 0);
    assert.ok(metric.areaElement > 0);
    assert.ok(Number.isFinite(metric.kahlerPotential));

    const spiralPoints = Array.from({ length: 28 }, (_, i) => [
      Math.cos(i * 0.35) * (1 + i * 0.03),
      Math.sin(i * 0.35) * (1 + i * 0.03),
      Math.sin(i * 0.2),
      Math.cos(i * 0.15),
    ]);
    const d2 = estimateCorrelationDimension(spiralPoints);
    const lyap = estimateLyapunovExponent(spiralPoints);
    assert.ok(d2 > 0);
    assert.ok(Number.isFinite(lyap));
  });
});

describe('Autonomous Multi-File Application Builder & Anti-Duplication Engine', () => {
  it('selects the right template for Electron, Tauri/Rust, Node API, Python, and 4D-11D Science Lab prompts', () => {
    assert.equal(
      selectTemplateForPrompt('Build an Electron desktop markdown studio with IPC').id,
      'electron-desktop'
    );
    assert.equal(
      selectTemplateForPrompt('Create a Tauri and Rust desktop system monitor').id,
      'tauri-rust-app'
    );
    assert.equal(
      selectTemplateForPrompt('Build a full-stack REST API backend server in Node').id,
      'fullstack-node-api'
    );
    assert.equal(
      selectTemplateForPrompt('Create a Python scientific simulation CLI tool').id,
      'python-science-cli'
    );
    assert.equal(
      selectTemplateForPrompt('Build a 4D Hopf fibration and Tesseract slicer lab').id,
      'dimensional-lab'
    );
    assert.equal(
      selectTemplateForPrompt('Build a Frontier persistent homology and Berry phase interpretability witness lab').id,
      'frontier-verify-lab'
    );
  });

  it('never repeats the same build when asked for different applications X vs Y', () => {
    const buildX = compileApplicationProject(
      'Build an Electron desktop modular audio synthesizer and sequencer'
    );
    const buildY = compileApplicationProject(
      'Build a quantitative crypto portfolio risk and Sharpe ratio analyzer',
      { previousBuilds: [buildX] }
    );
    const buildZ = compileApplicationProject(
      'Build a 4D Klein bottle and 8D E8 root lattice scientific explorer',
      { previousBuilds: [buildX, buildY] }
    );

    assert.notEqual(buildX.slug, buildY.slug);
    assert.notEqual(buildY.slug, buildZ.slug);
    assert.notEqual(buildX.title, buildY.title);
    assert.notEqual(buildX.previewHtml, buildY.previewHtml);
    assert.equal(buildY.novelty.isNovel, true);
    assert.equal(buildZ.novelty.isNovel, true);

    const buildXRepeat = compileApplicationProject(
      'Build an Electron desktop modular audio synthesizer and sequencer',
      { previousBuilds: [buildX] }
    );
    assert.notEqual(buildXRepeat.slug, buildX.slug);
  });

  it('generates complete multi-file Electron desktop projects with main.cjs, preload.cjs, renderer.js, package.json, and index.html', () => {
    const electronApp = compileApplicationProject(
      'Build an Electron desktop Kanban workflow & sprint velocity manager'
    );
    assert.equal(electronApp.templateId, 'electron-desktop');
    const paths = electronApp.files.map((f) => f.path);
    assert.ok(paths.includes('package.json'));
    assert.ok(paths.includes('main.cjs'));
    assert.ok(paths.includes('preload.cjs'));
    assert.ok(paths.includes('renderer.js'));
    assert.ok(paths.includes('test.mjs'));
    assert.ok(paths.includes('index.html'));

    const mainCjs = electronApp.files.find((f) => f.path === 'main.cjs').content;
    assert.ok(mainCjs.includes('BrowserWindow'));
    assert.ok(mainCjs.includes('ipcMain.handle'));
  });

  it('parses multi-file LLM output markers and self-heals truncated HTML or broken manifests', () => {
    const rawLlm = [
      '// === FILE: src/customModule.js ===',
      'export const CUSTOM_FLAG = 42;',
      '// === FILE: package.json ===',
      '{ broken json',
    ].join('\n');

    const parsed = parseMultiFileResponse(rawLlm);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].path, 'src/customModule.js');

    const compiled = compileApplicationProject('Build a React Vite telemetry dashboard', {
      llmResponseText: rawLlm,
    });
    const healed = verifyAndSelfHealProject(compiled);
    assert.equal(healed.passed, true);
    assert.ok(healed.repairs.length > 0);
    const fixedPkg = JSON.parse(healed.files.find((f) => f.path === 'package.json').content);
    assert.equal(fixedPkg.name, compiled.slug);
  });

  it('executes the autonomous build loop, mints a Merkle Proof-Carrying Certificate (.calabi-proof.json), and records stage telemetry', async () => {
    const stagesSeen = [];
    const result = await runAutonomousBuildLoop({
      prompt: 'Build an Electron desktop neural spike train visualizer',
      onStageUpdate(stage) {
        stagesSeen.push(stage.id);
      },
    });
    assert.deepEqual(stagesSeen, [
      'intent-novelty',
      'template-scaffold',
      'self-heal',
      'proof-certificate',
      'disk-write',
      'toolchain-verify',
    ]);
    assert.ok(result.directory.includes(`~/CalabiYauProjects/builds/${result.slug}`));
    assert.ok(result.files.length >= 6);
    assert.ok(result.files.some((f) => f.path === '.calabi-proof.json'));
    assert.equal(result.proofVerification.valid, true);
    assert.equal(isApplicationBuildPrompt('Build an Electron desktop app'), true);
  });
});

describe('Frontier Lab Witness Engine (Persistent Homology, Berry Phase, Fisher-Rao & Merkle Proofs)', () => {
  it('computes Vietoris-Rips persistent homology (H0 & H1) and detects 1-cycle loops', () => {
    // Circular loop of 16 points in R^4 should exhibit non-trivial H1 cycle persistence
    const circlePts = Array.from({ length: 16 }, (_, k) => {
      const theta = (2 * Math.PI * k) / 16;
      return [Math.cos(theta), Math.sin(theta), 0, 0];
    });
    const vr = computeVietorisRipsPersistence(circlePts);
    assert.equal(vr.pointCount, 16);
    assert.ok(vr.betti0 >= 1);
    assert.ok(vr.maxCyclePersistence > 0.1);
    assert.ok(vr.barcode.some((b) => b.dim === 1));
    assert.ok(vr.persistenceEntropy > 0 && vr.persistenceEntropy <= 1);
  });

  it('computes exact Fisher-Rao geodesic distance and Pancharatnam-Berry geometric phase', () => {
    const p = [0.25, 0.25, 0.25, 0.25];
    const q = [0.25, 0.25, 0.25, 0.25];
    assert.ok(fisherRaoDistance(p, q) < 1e-7);

    const orth1 = [1, 0, 0, 0];
    const orth2 = [0, 1, 0, 0];
    assert.ok(Math.abs(fisherRaoDistance(orth1, orth2) - Math.PI) < 1e-6);

    const loop4D = Array.from({ length: 20 }, (_, i) => {
      const ang = (2 * Math.PI * i) / 20;
      return [Math.cos(ang), Math.sin(ang), 0.5 * Math.cos(ang), 0.5 * Math.sin(ang)];
    });
    const berry = computeBerryGeometricPhase(loop4D);
    assert.ok(Number.isFinite(berry.berryPhaseRad));
    assert.ok(berry.berryPhaseRad >= -Math.PI && berry.berryPhaseRad <= Math.PI);
    assert.ok(berry.berryCurvatureFlux > 0);
  });

  it('discovers ranked Noether symbolic invariants and computes cross-lab consensus', () => {
    const frames = Array.from({ length: 12 }, (_, i) => ({
      saturation: 0.62,
      amplitude: 0.35,
      frequency: 1.4,
      timingCentroid: 0.28,
      contentCentroid: 0.34,
      contentFlatness: 0.48,
      state: { xi: 0.68 },
      riemannian: { areaElement: 0.44, kahlerPotential: 0.72, traceG: 1.2 },
      geometry: { correlationDimension: 2.1, lyapunovExponent: 0.04, winding: i * 0.02 },
    }));
    const symbolic = discoverSymbolicInvariants(frames);
    assert.ok(symbolic.primaryLaw);
    assert.ok(symbolic.primaryLaw.invarianceScore > 0.5);
    assert.equal(symbolic.laws.length, 4);

    const consensus = synthesizeCrossLabConsensus([
      { provider: 'anthropic', model: 'claude-opus-5-5', sheet: [0.5, 0.3, 0.1, 0.1] },
      { provider: 'openai', model: 'gpt-6-astra', sheet: [0.45, 0.35, 0.1, 0.1] },
      { provider: 'deepseek', model: 'deepseek-v4.1-flash', sheet: [0.1, 0.1, 0.7, 0.1] },
    ]);
    assert.equal(consensus.participantCount, 3);
    assert.ok(consensus.epistemicConsensus > 0 && consensus.epistemicConsensus <= 1);
    assert.equal(consensus.orthogonalLeader, 'deepseek/deepseek-v4.1-flash');
  });

  it('mints and verifies cryptographic Merkle Proof-Carrying Certificates and detects tampering', () => {
    const project = compileApplicationProject(
      'Build a Frontier persistent homology and Berry phase interpretability witness lab'
    );
    const cert = mintProofCarryingCertificate({ project });
    const verified = verifyProofCertificate(cert, project.files);
    assert.equal(verified.valid, true);
    assert.equal(verified.merkleRoot, cert.merkleTree.merkleRoot);

    // Tampering with any project file must invalidate the Merkle proof
    const tamperedFiles = project.files.map((f, idx) =>
      idx === 0 ? { ...f, content: f.content + '\n// tampered' } : f
    );
    const tamperedVerify = verifyProofCertificate(cert, tamperedFiles);
    assert.equal(tamperedVerify.valid, false);

    const dossier = generateFrontierWitnessDossierHtml({ certificate: cert });
    assert.ok(dossier.includes('FRONTIER MATHEMATICAL WITNESS DOSSIER'));
    assert.ok(dossier.includes(cert.certificateId));
  });
});

describe('Hardware-Adaptive Graphics Profiler & Auto-LOD Governor (RTX 5060 Ti, RTX 4060 Dell G15, Steam Deck, Low-End)', () => {
  it('classifies RTX 5060 Ti Desktop Rig as ULTRA tier', () => {
    const rtx5060Ti = classifyHardwareEnvironment({
      renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Ti Direct3D11 vs_5_0 ps_5_0)',
      screenWidth: 2560,
      screenHeight: 1440,
      hardwareConcurrency: 16,
      deviceMemory: 16,
    });
    assert.equal(rtx5060Ti.tierId, 'ultra');
    assert.equal(rtx5060Ti.profile.pixelRatioCap, 2.0);
    assert.equal(rtx5060Ti.profile.defaultResolution, 20);
    assert.equal(rtx5060Ti.profile.reducedCssBlur, false);
  });

  it('classifies RTX 4060 Dell G15 Laptop GPU as HIGH balanced tier', () => {
    const g15 = classifyHardwareEnvironment({
      renderer: 'NVIDIA GeForce RTX 4060 Laptop GPU/PCIe/SSE2',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Dell G15',
      screenWidth: 1920,
      screenHeight: 1080,
      hardwareConcurrency: 12,
      deviceMemory: 8,
    });
    assert.equal(g15.tierId, 'high');
    assert.equal(g15.profile.pixelRatioCap, 1.5);
    assert.equal(g15.profile.defaultResolution, 16);
  });

  it('classifies Valve Steam Deck (RADV VANGOGH / 1280x800 APU) as STEAM-DECK handheld tier with lowered graphics overhead', () => {
    const deck = classifyHardwareEnvironment({
      renderer: 'AMD Custom GPU 0405 (radeonsi, vangogh, LLVM 17.0.6, DRM 3.54, 6.5.0-valve)',
      screenWidth: 1280,
      screenHeight: 800,
      hardwareConcurrency: 8,
      deviceMemory: 8,
    });
    assert.equal(deck.tierId, 'steam-deck');
    assert.equal(deck.profile.pixelRatioCap, 1.0);
    assert.equal(deck.profile.antialias, false);
    assert.equal(deck.profile.defaultResolution, 12);
    assert.equal(deck.profile.cpuDeformStride, 2);
    assert.equal(deck.profile.reducedCssBlur, true);
  });

  it('classifies integrated / low-end GPUs as LOW tier and dynamically steps down when FPS drops', () => {
    const lowEnd = classifyHardwareEnvironment({
      renderer: 'Mesa Intel(R) UHD Graphics 620 (KBL GT2)',
      screenWidth: 1366,
      screenHeight: 768,
      hardwareConcurrency: 4,
      deviceMemory: 4,
    });
    assert.equal(lowEnd.tierId, 'low');
    assert.equal(lowEnd.profile.pixelRatioCap, 0.85);
    assert.equal(lowEnd.profile.coreSurfaceEnabled, false);
    assert.equal(lowEnd.profile.cpuDeformStride, 4);
    assert.equal(lowEnd.profile.reducedCssBlur, true);
    assert.ok(GRAPHICS_PROFILES.low.haloParticles < GRAPHICS_PROFILES.ultra.haloParticles);

    const gov = new AdaptiveFpsGovernor({ currentTierId: 'ultra', autoDowngradeEnabled: true });
    let stepDown = null;
    for (let i = 0; i < 50; i++) {
      const res = gov.recordFrame(38); // ~26.3 FPS -> below 36 FPS threshold
      if (res.downgradedTo) stepDown = res.downgradedTo;
    }
    assert.equal(stepDown, 'high');
  });
});

describe('Domain-Authentic App Synthesis, LLM Code Bundling & Pronoun/Filler Guardrails', () => {
  it('builds a real multi-section responsive Landing Page for "build a landing page" and "build a landing page buddy, for the Calabi-Yau AI platform please"', () => {
    const lp1 = compileApplicationProject('build a landing page');
    assert.equal(lp1.templateId, 'react-vite-app');
    assert.equal(lp1.title, 'Landing Page');
    assert.ok(lp1.previewHtml.includes('Simple, Transparent Pricing'));
    assert.ok(lp1.previewHtml.includes('Switch to Annual (Save 20%)'));
    assert.ok(lp1.previewHtml.includes('Frequently Asked Questions'));
    assert.ok(!lp1.previewHtml.includes('Landing Primary Controller'));
    assert.ok(!lp1.previewHtml.includes('ADD LANDING MODULE'));
    assert.ok(!lp1.previewHtml.includes('4D HYPERPLANE'));

    const lp2 = compileApplicationProject('build a landing page buddy, for the Calabi-Yau AI platform please');
    assert.equal(lp2.templateId, 'react-vite-app');
    assert.ok(lp2.previewHtml.includes('Calabi-Yau'));
    assert.ok(lp2.previewHtml.includes('Start Building Free'));
    assert.ok(!lp2.previewHtml.includes('Landing Primary Controller'));
  });

  it('strips pronouns ("me") and builds a real 3D WebGL Chicken Nugget viewport for "Build me a webGL 3d Chicken nugget please"', () => {
    const nugget = compileApplicationProject('Build me a webGL 3d Chicken nugget please');
    assert.equal(nugget.templateId, 'webgl-shader-app');
    assert.equal(nugget.title, 'WebGL 3D Chicken Nugget');
    assert.equal(nugget.slug, 'webgl-3d-chicken-nugget');
    assert.ok(nugget.previewHtml.includes('3D Crispy Chicken Nugget Mesh'));
    assert.ok(nugget.previewHtml.includes('Classic Golden Fry'));
    assert.ok(nugget.previewHtml.includes('Honey Mustard Glaze'));
    assert.ok(nugget.previewHtml.includes('Take a Bite!'));
    assert.ok(!nugget.previewHtml.includes('ADD ME MODULE'));
    assert.ok(!nugget.previewHtml.includes('Me Primary Controller'));
  });

  it('extracts standard unnamed LLM markdown code fences (```html, ```css, ```js) and bundles them into previewHtml without overwriting', () => {
    const llmReply = [
      'Here is your custom landing page:',
      '```html',
      '<!DOCTYPE html><html><head><link rel="stylesheet" href="styles.css"></head><body><h1 id="hero">Custom LLM Landing Page</h1><script src="app.js"></script></body></html>',
      '```',
      '```css',
      '#hero { color: #00f3ff; font-size: 48px; }',
      '```',
      '```javascript',
      'document.getElementById("hero").dataset.ready = "true";',
      '```',
    ].join('\n');

    const parsed = parseMultiFileResponse(llmReply);
    assert.equal(parsed.length, 3);
    assert.ok(parsed.some((f) => f.path === 'index.html'));
    assert.ok(parsed.some((f) => f.path === 'styles.css'));
    assert.ok(parsed.some((f) => f.path === 'app.js'));

    const project = compileApplicationProject('build a landing page', {
      llmResponseText: llmReply,
    });
    assert.ok(project.previewHtml.includes('Custom LLM Landing Page'));
    assert.ok(project.previewHtml.includes('#hero { color: #00f3ff; font-size: 48px; }'));
    assert.ok(project.previewHtml.includes('document.getElementById("hero").dataset.ready = "true"'));
  });

  it('blocks conversational filler words like "okay", "ok", "yes" from triggering fake builds', () => {
    assert.equal(isConversationalFillerPrompt('okay'), true);
    assert.equal(isConversationalFillerPrompt('OK!'), true);
    assert.equal(isConversationalFillerPrompt('yes'), true);
    assert.equal(isApplicationBuildPrompt('okay'), false);
    assert.equal(isApplicationBuildPrompt('build a landing page'), true);
    assert.equal(isApplicationBuildPrompt('Build me a webGL 3d Chicken nugget please'), true);
  });
});

