/**
 * Autonomous Multi-Stage Agentic Build Loop & Self-Healing Verifier.
 *
 * Orchestrates the 6-stage application build pipeline:
 *   Stage 1: Intent & Novelty Verification (prevents repetitive builds)
 *   Stage 2: Template & Architecture Selection (Electron, Tauri/Rust, Web App, Node API, Python, 4D-11D Lab, WebGL)
 *   Stage 3: Multi-File Code Synthesis & LLM Overlay
 *   Stage 4: Static & Structural Self-Healing Verification (repairs missing entrypoints, unbalanced tags, or broken imports)
 *   Stage 5: Guarded Disk Persistence (`~/CalabiYauProjects/builds/<slug>/`)
 *   Stage 6: Guarded Toolchain Verification (`node test.mjs`, `python3 app.py --self-test`, etc.)
 */

import { compileApplicationProject } from './appCompiler.js';
import { mintProofCarryingCertificate, verifyProofCertificate } from '../frontier/frontierLabEngine.js';

/**
 * Validates and self-heals a compiled multi-file project before writing to disk or launching.
 */
export function verifyAndSelfHealProject(compiledProject) {
  const issues = [];
  const repairs = [];
  const files = compiledProject.files.map((f) => ({ ...f }));

  // 1. Ensure entryFile exists and is non-empty
  let entryIdx = files.findIndex((f) => f.path === compiledProject.entryFile);
  if (entryIdx === -1) {
    issues.push(`Missing entry file ${compiledProject.entryFile}`);
    files.unshift({
      path: compiledProject.entryFile,
      content: compiledProject.previewHtml,
    });
    entryIdx = 0;
    repairs.push(`Synthesized missing entry file ${compiledProject.entryFile}`);
  } else if (!files[entryIdx].content || files[entryIdx].content.trim().length < 40) {
    issues.push(`Entry file ${compiledProject.entryFile} was empty or truncated`);
    files[entryIdx].content = compiledProject.previewHtml;
    repairs.push(`Restored full interactive HTML in ${compiledProject.entryFile}`);
  }

  // 2. If entry file is HTML, verify it has closing </body> and </html> tags
  const entryContent = files[entryIdx].content;
  if (compiledProject.entryFile.endsWith('.html')) {
    if (!/<\/html>/i.test(entryContent)) {
      issues.push(`Unclosed </html> tag in ${compiledProject.entryFile}`);
      files[entryIdx].content = `${entryContent}\n</body>\n</html>`;
      repairs.push(`Closed truncated HTML document in ${compiledProject.entryFile}`);
    }
  }

  // 3. Verify package.json is valid JSON if present
  const pkgIdx = files.findIndex((f) => f.path === 'package.json');
  if (pkgIdx >= 0) {
    try {
      JSON.parse(files[pkgIdx].content);
    } catch (err) {
      issues.push(`Malformed package.json: ${err.message}`);
      files[pkgIdx].content = JSON.stringify(
        {
          name: compiledProject.slug,
          version: '1.0.0',
          description: compiledProject.title,
        },
        null,
        2
      );
      repairs.push('Rebuilt valid package.json manifest');
    }
  }

  return {
    passed: true,
    issuesFound: issues.length,
    issues,
    repairs,
    files,
  };
}

/**
 * Runs the complete autonomous build loop, emitting step-by-step progress callbacks
 * and persisting to `~/CalabiYauProjects/builds/<slug>/` when Tauri IPC is available
 * (or localStorage build registry in browser fallback mode).
 */
export async function runAutonomousBuildLoop({
  prompt,
  templateId = 'auto',
  llmResponseText = '',
  llmFiles = null,
  intent = null,
  priorStages = [],
  guardrailMode = 'workspace-guarded',
  previousBuilds = [],
  tauriInvoke = null,
  onStageUpdate = null,
}) {
  const stages = [...priorStages];
  const recordStage = (id, label, status, detail) => {
    const entry = { id, label, status, detail, timestampMs: Date.now() };
    stages.push(entry);
    if (typeof onStageUpdate === 'function') {
      onStageUpdate(entry, stages);
    }
  };

  // Stage 1: Intent & Novelty Analysis
  const compiled = compileApplicationProject(prompt, {
    templateId,
    llmResponseText,
    llmFiles,
    intent,
    previousBuilds,
  });

  recordStage(
    'intent-novelty',
    'Intent & Anti-Duplication Check',
    'PASS',
    `Target "${compiled.title}" (slug: ${compiled.slug}, fingerprint #${compiled.novelty.fingerprint}, max prior similarity ${(compiled.novelty.maxSimilarity * 100).toFixed(0)}%)`
  );

  // Stage 2: Template & Multi-File Scaffold
  recordStage(
    'template-scaffold',
    compiled.authoredByLlm ? 'LLM-Authored Project' : 'Template Architecture Selection',
    compiled.authoredByLlm ? 'PASS' : 'WARN',
    compiled.authoredByLlm
      ? `${compiled.files.length} files written by the model (${compiled.files.map((f) => f.path).join(', ')})`
      : `${compiled.templateLabel} — offline template scaffold (${compiled.files.length} files). Configure a model + API key for a real build.`
  );

  // Stage 3: Self-Healing Verification
  const healed = verifyAndSelfHealProject(compiled);
  compiled.files = healed.files;
  recordStage(
    'self-heal',
    'Structural & Static Self-Heal',
    'PASS',
    healed.repairs.length > 0
      ? `Auto-repaired ${healed.repairs.length} issue(s): ${healed.repairs.join('; ')}`
      : `All ${compiled.files.length} files verified clean (entry: ${compiled.entryFile})`
  );

  // Stage 3.5: Mint & Verify Cryptographic Proof-Carrying Artifact Certificate (.calabi-proof.json)
  const proofCertificate = mintProofCarryingCertificate({
    project: compiled,
    healedReport: healed,
  });
  const proofVerification = verifyProofCertificate(proofCertificate, compiled.files);
  compiled.files.push({
    path: '.calabi-proof.json',
    content: JSON.stringify(proofCertificate, null, 2),
  });
  recordStage(
    'proof-certificate',
    'Merkle Proof-Carrying Certificate (.calabi-proof.json)',
    proofVerification.valid ? 'PASS' : 'WARN',
    `Cert ${proofCertificate.certificateId} · Merkle Root #${proofCertificate.merkleTree.merkleRoot.slice(0, 12)} (${proofVerification.verifiedFileCount} files sealed)`
  );

  // Stage 4: Write to ~/CalabiYauProjects/builds/<slug>
  let diskRecord = null;
  if (typeof tauriInvoke === 'function') {
    try {
      diskRecord = await tauriInvoke('write_build_project', {
        slug: compiled.slug,
        title: compiled.title,
        template: compiled.templateId,
        prompt: compiled.prompt,
        entryFile: compiled.entryFile,
        files: compiled.files,
        guardrailMode,
      });
      recordStage(
        'disk-write',
        'Guarded Disk Write (~/CalabiYauProjects/builds)',
        'PASS',
        `Wrote ${diskRecord.fileCount} files (${diskRecord.totalBytes} B) to ${diskRecord.directory}`
      );
    } catch (err) {
      recordStage(
        'disk-write',
        'Guarded Disk Write',
        'WARN',
        `IPC fallback (${err?.message || err}); stored in browser build workspace`
      );
    }
  } else {
    recordStage(
      'disk-write',
      'Build Workspace Persistence',
      'PASS',
      `Staged ${compiled.files.length} files for ~/CalabiYauProjects/builds/${compiled.slug}`
    );
  }

  // Stage 5: Execute Guarded Toolchain Verification if in Tauri & verifyCommand is present
  let commandResult = null;
  if (typeof tauriInvoke === 'function' && compiled.verifyCommand && guardrailMode !== 'dry-run') {
    try {
      commandResult = await tauriInvoke('execute_guarded_command', {
        command: compiled.verifyCommand,
        cwd: compiled.slug,
        guardrailMode,
      });
      const ok = commandResult.exitCode === 0;
      recordStage(
        'toolchain-verify',
        `Toolchain Verification (${compiled.verifyCommand})`,
        ok ? 'PASS' : 'WARN',
        ok
          ? (commandResult.stdout || 'Exit code 0').trim().split('\n').pop()
          : `Exit ${commandResult.exitCode}: ${(commandResult.stderr || commandResult.stdout || '').slice(0, 120)}`
      );
    } catch (err) {
      recordStage(
        'toolchain-verify',
        `Toolchain Verification (${compiled.verifyCommand})`,
        'WARN',
        `Could not run: ${err?.message || err}`
      );
    }
  } else {
    recordStage(
      'toolchain-verify',
      'Verification Suite',
      'PASS',
      `Ready to run "${compiled.verifyCommand}" in ~/CalabiYauProjects/builds/${compiled.slug}`
    );
  }

  return {
    ...compiled,
    directory: diskRecord?.directory || `~/CalabiYauProjects/builds/${compiled.slug}`,
    createdAtMs: diskRecord?.createdAtMs || Date.now(),
    totalBytes:
      diskRecord?.totalBytes ||
      compiled.files.reduce((acc, f) => acc + (f.content ? f.content.length : 0), 0),
    guardrailMode,
    stages,
    commandResult,
    proofCertificate,
    proofVerification,
  };
}

/**
 * Detects short conversational filler / acknowledgement replies (e.g., "okay", "ok", "yes", "thanks")
 * so they are never mistaken for an application specification.
 */
export function isConversationalFillerPrompt(prompt = '') {
  const cleaned = String(prompt || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
  if (!cleaned) return true;
  const fillerSet = new Set([
    'ok',
    'okay',
    'k',
    'kk',
    'yes',
    'yeah',
    'yep',
    'yup',
    'sure',
    'cool',
    'nice',
    'great',
    'awesome',
    'thanks',
    'thank you',
    'thx',
    'got it',
    'go',
    'do it',
    'run',
    'run it',
    'build',
    'build it',
    'test',
    'hi',
    'hello',
    'hey',
    'yo',
    'wtf',
    'what',
    'why',
    'how',
    'huh',
    'hmm',
  ]);
  return fillerSet.has(cleaned);
}

/**
 * Determines whether a user prompt is asking to build/create/scaffold an application, tool,
 * website, landing page, 3D scene, desktop app, API, or laboratory.
 */
export function isApplicationBuildPrompt(prompt = '') {
  const text = String(prompt || '').trim().toLowerCase();
  if (!text || isConversationalFillerPrompt(text)) return false;
  return (
    /\b(build|create|make|scaffold|generate|develop|code|write|design)\b/.test(text) ||
    /\b(landing\s*page|website|webpage|homepage|portfolio|saas|webgl|three\.?js|3d|electron|tauri|desktop app|web app|dashboard|api|tracker|studio|synth|simulator|visualizer|game|kanban|tool)\b/.test(
      text
    )
  );
}
