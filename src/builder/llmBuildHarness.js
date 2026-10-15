/**
 * LLM-driven build harness: the model writes the whole project, the harness checks it
 * (static structure, JS syntax, browser runtime, toolchain) and feeds every failure back
 * to the model until the project is clean or the repair budget is spent.
 */

import { parseMultiFileResponse } from './appCompiler.js';

const TEMPLATE_REQUIREMENTS = {
  'electron-desktop': [
    'This is an Electron desktop app. Required files:',
    '- package.json with "main": "main.cjs", "scripts": {"start": "electron .", "test": "node test.mjs"}, and "devDependencies": {"electron": "^33.0.0"}.',
    '- main.cjs (CommonJS): creates the BrowserWindow, loads index.html, registers every ipcMain handler the UI needs. Network calls to remote APIs (e.g. https://ollama.com/api/chat) belong here, using global fetch, so the renderer never hits CORS.',
    '- preload.cjs: exposes a minimal API with contextBridge.exposeInMainWorld (contextIsolation: true, nodeIntegration: false).',
    '- index.html + renderer.js + styles.css: the full UI. renderer.js must work both inside Electron (window.api present) and in a plain browser preview (window.api missing -> show a clear "running in preview" state instead of crashing).',
    '- test.mjs: a Node script (no Electron needed) that imports nothing outside node: builtins and asserts the project files exist and package.json is valid; exits non-zero on failure.',
  ],
  'tauri-rust-app': [
    'This is a Tauri v1 desktop app. Required files: src-tauri/Cargo.toml, src-tauri/build.rs, src-tauri/src/main.rs, src-tauri/tauri.conf.json (distDir "../src"), src/index.html (+ any JS/CSS), package.json with "@tauri-apps/cli" devDependency and a "tauri" script.',
  ],
  'fullstack-node-api': [
    'This is a Node.js app with zero npm dependencies. Required files: server.mjs (node:http server serving public/ and a JSON API, port from process.env.PORT || 3000), public/index.html (+ JS/CSS), package.json with "start": "node server.mjs" and "test": "node test-api.mjs", test-api.mjs that starts the server on a random port, hits the API, and exits non-zero on failure.',
  ],
  'python-science-cli': [
    'This is a Python 3 app using only the standard library. Required files: app.py (supports --self-test, exits non-zero on failure), README.md, and index.html presenting the tool in a browser.',
  ],
};

const DEFAULT_REQUIREMENTS = [
  'This is a browser application. Required files: index.html, plus styles.css and app.js (or more modules) referenced from index.html with relative paths. package.json with "scripts": {"start": "npx serve .", "test": "node test.mjs"}, and test.mjs (Node, builtins only) that asserts the files exist and exits non-zero on failure.',
  'It must run by simply opening index.html: no build step, no bundler, no Vite, no TypeScript, no JSX, no .jsx/.tsx files. Even if the user says "React", write plain ES modules (vanilla DOM, or Preact + htm from https://esm.sh). Libraries may be loaded from https://esm.sh or https://unpkg.com via <script type="importmap"> or full URLs.',
  'Keep the whole project under ~1200 lines in total so it fits in one response. Prefer a few substantial files over many tiny ones; no giant inline data, SVG paths or base64.',
];

export function buildHarnessSystemPrompt(intent) {
  const reqs = TEMPLATE_REQUIREMENTS[intent?.templateId] || DEFAULT_REQUIREMENTS;
  return [
    'You are a senior software engineer. You write complete, working, production-quality projects in one shot.',
    '',
    'Build EXACTLY what the user asked for. Read the request literally: every named product, model, API, feature, style or theme must show up in the result. Do not substitute a generic dashboard, placeholder widgets, fake metrics, or "lorem ipsum". Every button must do something real.',
    'Design: modern, polished, responsive, accessible. Real copy written for this product. Smooth CSS transitions where they help.',
    '',
    ...reqs,
    '',
    'OUTPUT FORMAT (strict). Write each file exactly once, wrapped like this, with no markdown fences inside:',
    '<file path="relative/path.ext">',
    '<entire file contents>',
    '</file>',
    'Anything outside <file> blocks is discarded, so do not plan, draft, or explain. Start with <file path="..."> immediately and write each file once, finished.',
    'Never truncate, never write "..." or "rest of code here". Every file must be complete.',
  ].join('\n');
}

export function buildHarnessUserPrompt(prompt, intent) {
  return [
    `Build this: ${prompt}`,
    intent?.templateLabel || intent?.template?.label ? `Project type: ${intent.templateLabel || intent.template.label}.` : '',
    intent?.slug ? `Project folder name: ${intent.slug}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildRepairPrompt(prompt, files, problems) {
  const serialized = files.map((f) => `<file path="${f.path}">\n${f.content}\n</file>`).join('\n\n');
  return [
    `The project below was built for the request: ${prompt}`,
    '',
    'It has these problems, found by automated checks:',
    ...problems.map((p) => `- ${p}`),
    '',
    'Fix every problem. Output the COMPLETE corrected contents of every file that needs to change (and any new files), each wrapped in <file path="...">...</file>. Files you do not output are kept as they are. No commentary.',
    '',
    serialized,
  ].join('\n');
}

/** Removes stray markdown fences or chatter around marker-delimited files. */
function cleanFileContent(content) {
  return String(content || '')
    .replace(/^\s*```[a-zA-Z0-9_-]*\s*\r?\n/, '')
    .replace(/\r?\n\s*```\s*$/, '')
    .trim();
}

const FILE_BLOCK_RE = /<file\s+path\s*=\s*["']([^"'\n]+)["']\s*>\r?\n?([\s\S]*?)<\/file>/g;

/** Parses `<file path>` blocks (last complete copy of each path wins), falling back to markers/fences. */
export function parseHarnessFiles(text, entryFile = 'index.html') {
  const raw = String(text || '');
  const blocks = new Map();
  for (const m of raw.matchAll(FILE_BLOCK_RE)) {
    const path = m[1].trim().replace(/^\.?\//, '');
    const content = cleanFileContent(m[2]);
    if (path && content && !path.includes('..')) {
      blocks.delete(path);
      blocks.set(path, { path, content });
    }
  }
  if (blocks.size > 0 || /<file\s+path\s*=/.test(raw)) return [...blocks.values()];
  return parseMultiFileResponse(raw, entryFile)
    .map((f) => ({ path: f.path.replace(/^\.?\//, ''), content: cleanFileContent(f.content) }))
    .filter((f) => f.path && f.content && !f.path.includes('..'));
}

export function mergeFiles(baseFiles, patchFiles) {
  const map = new Map(baseFiles.map((f) => [f.path, f]));
  for (const f of patchFiles) map.set(f.path, f);
  return [...map.values()];
}

function stripModuleSyntax(code) {
  return code
    .replace(/^\s*import\s+[^;'"]*?from\s*['"][^'"]+['"];?/gm, '')
    .replace(/^\s*import\s*['"][^'"]+['"];?/gm, '')
    .replace(/^\s*import\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"];?/gm, '')
    .replace(/^\s*export\s+default\s+/gm, 'const __default__ = ')
    .replace(/^\s*export\s*\{[\s\S]*?\}\s*(?:from\s*['"][^'"]+['"])?;?/gm, '')
    .replace(/^\s*export\s+(?=(?:async\s+)?function|class|const|let|var)/gm, '')
    .replace(/\bimport\.meta\b/g, '({})')
    .replace(/\bawait\s+import\(/g, 'import(');
}

/** Returns a syntax error message for a JS file, or null if it parses (or can't be judged). */
export function checkJsSyntax(code, path = 'file.js') {
  const isModule = /\.mjs$/.test(path) || /^\s*(import|export)\s/m.test(code);
  const source = isModule ? stripModuleSyntax(code) : code;
  try {
    // Wrapped in an async function so top-level await doesn't count as an error.
    new Function(`return async function __check__(){\n${source}\n}`);
    return null;
  } catch (err) {
    if (!(err instanceof SyntaxError)) return null;
    return `${path}: JavaScript syntax error: ${err.message}`;
  }
}

function inlineScripts(html) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] || '';
    if (/\bsrc\s*=/.test(attrs)) continue;
    if (/type\s*=\s*["']?(?:importmap|application\/json|application\/ld\+json|text\/(?:template|plain|x-[\w-]+))/i.test(attrs)) continue;
    if (m[2].trim()) out.push(m[2]);
  }
  return out;
}

function localRefs(html) {
  const refs = [];
  const re = /<(?:script|link|img|source)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"'#?]+)[^"']*["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const ref = m[1].trim();
    if (!ref || /^(?:[a-z]+:|\/\/|data:|#)/i.test(ref)) continue;
    refs.push(ref.replace(/^\.\//, '').replace(/^\//, ''));
  }
  return refs;
}

function dirOf(path) {
  const i = path.lastIndexOf('/');
  return i === -1 ? '' : path.slice(0, i + 1);
}

function normalize(path) {
  const parts = [];
  for (const seg of path.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.join('/');
}

const PLACEHOLDER_RE =
  /^\s*(?:\/\/|\/\*|<!--|#)\s*(?:\.\.\.\s*(?:\*\/|-->)?\s*$|\.{3}\s*(?:rest|remaining|more)\b|rest of (?:the )?(?:code|file|implementation)|implementation goes here)/im;

/** Static checks that need no runtime: structure, references, syntax, truncation. */
export function staticCheckProject(files, { entryFile = 'index.html', templateId = '' } = {}) {
  const problems = [];
  const paths = new Set(files.map((f) => f.path));
  const byPath = new Map(files.map((f) => [f.path, f]));

  if (files.length === 0) {
    return ['No files were produced. Output every file as <file path="...">...</file>, with nothing outside the blocks.'];
  }

  const entry = byPath.get(entryFile) || files.find((f) => /(^|\/)index\.html$/i.test(f.path));
  if (!entry) {
    problems.push(`Missing entry file ${entryFile}.`);
  } else {
    if (!/<\/html>\s*$/i.test(entry.content.trim())) problems.push(`${entry.path} is truncated (no closing </html>).`);
    for (const ref of localRefs(entry.content)) {
      const resolved = normalize(dirOf(entry.path) + ref);
      if (!paths.has(resolved)) problems.push(`${entry.path} references "${ref}" but that file was not provided.`);
    }
    inlineScripts(entry.content).forEach((code, i) => {
      const err = checkJsSyntax(code, `${entry.path} <script> #${i + 1}`);
      if (err) problems.push(err);
    });
  }

  for (const f of files) {
    if (/\.(?:m?js|cjs)$/.test(f.path)) {
      const err = checkJsSyntax(f.content, f.path);
      if (err) problems.push(err);
      const importRe = /(?:^|\n)\s*import\s[^'"]*?['"](\.{1,2}\/[^'"]+)['"]/g;
      let m;
      while ((m = importRe.exec(f.content)) !== null) {
        const resolved = normalize(dirOf(f.path) + m[1]);
        if (!paths.has(resolved)) problems.push(`${f.path} imports "${m[1]}" but that file was not provided.`);
      }
    }
    if (/\.json$/.test(f.path)) {
      try {
        JSON.parse(f.content);
      } catch (err) {
        problems.push(`${f.path} is not valid JSON: ${err.message}`);
      }
    }
    if (PLACEHOLDER_RE.test(f.content)) {
      problems.push(`${f.path} contains placeholder / elided code. Write the full implementation.`);
    }
  }

  if (templateId !== 'tauri-rust-app') {
    const needsCompiler = files.filter((f) => /\.(?:jsx|tsx|ts|vue|svelte|scss|less)$/i.test(f.path) && !/\.d\.ts$/.test(f.path));
    if (needsCompiler.length > 0) {
      problems.push(
        `${needsCompiler.map((f) => f.path).join(', ')} need a compiler/bundler, but the project must run with no build step. Rewrite them as plain .js ES modules and .css (for React-style components use https://esm.sh/preact + https://esm.sh/htm, or vanilla DOM). Do not use JSX.`
      );
    }
    for (const f of files) {
      if (/\.(?:m?js)$/.test(f.path) && /(?:^|[\s(,=])<[A-Z][A-Za-z0-9]*[\s/>]/m.test(f.content.replace(/`[\s\S]*?`|'[^'\n]*'|"[^"\n]*"/g, ''))) {
        problems.push(`${f.path} contains JSX, which browsers cannot run. Use htm tagged templates or DOM APIs.`);
      }
    }
  }

  if (templateId === 'electron-desktop') {
    const pkg = byPath.get('package.json');
    let main = 'main.cjs';
    if (!pkg) problems.push('Missing package.json.');
    else {
      try {
        const parsed = JSON.parse(pkg.content);
        main = parsed.main || 'index.js';
        if (!parsed.scripts?.start) problems.push('package.json needs a "start" script ("electron .").');
        if (!parsed.devDependencies?.electron && !parsed.dependencies?.electron) {
          problems.push('package.json must list "electron" in devDependencies.');
        }
      } catch {
        /* reported above */
      }
    }
    if (!paths.has(normalize(main))) problems.push(`package.json "main" points to ${main}, which was not provided.`);
  }

  return [...new Set(problems)];
}

/** True when raw model output looks cut off mid-project (length limit, dropped stream). */
export function looksTruncated(rawText, entryFile = 'index.html') {
  if (/<file\s+path\s*=/.test(rawText)) {
    return !/<\/file>/.test(rawText.slice(rawText.lastIndexOf('<file')));
  }
  const files = parseHarnessFiles(rawText, entryFile);
  if (files.length === 0) return /\/\/\s*===\s*FILE:/.test(rawText);
  const last = files[files.length - 1];
  if (/\.html?$/i.test(last.path)) return !/<\/html>\s*$/i.test(last.content);
  if (/\.(?:m?js|cjs)$/.test(last.path)) {
    const err = checkJsSyntax(last.content, last.path);
    return Boolean(err && /end of input|Unterminated|missing \}|expected/i.test(err));
  }
  if (/\.json$/.test(last.path)) {
    try {
      JSON.parse(last.content);
      return false;
    } catch {
      return true;
    }
  }
  if (/\.css$/.test(last.path)) return (last.content.match(/\{/g) || []).length > (last.content.match(/\}/g) || []).length;
  return false;
}

export function buildContinuationPrompt(prompt, rawText) {
  return [
    `You were writing a project for: ${prompt}`,
    'Your output was cut off by the length limit. Here are the LAST characters you wrote:',
    '<<<TAIL',
    rawText.slice(-3000),
    'TAIL>>>',
    'Continue EXACTLY from the next character after the tail: output only the raw continuation text (no preamble, no reasoning, no repetition of the tail). Close the current file with </file>, then write any remaining files as <file path="...">...</file> and stop.',
  ].join('\n');
}

/** Calls the model, then keeps asking it to continue while the output looks truncated. */
/**
 * Stream guard handed to `complete(system, user, { shouldStop })`. Transports that can cancel
 * a stream stop it once the model has rambled `limit` characters without opening a <file>.
 */
export function proseGuard(limit) {
  return (textSoFar) => textSoFar.length > limit && !/<file\s+path\s*=/.test(textSoFar);
}

export const ONE_SHOT_PROSE_LIMIT = 8000;
export const PER_FILE_PROSE_LIMIT = 24000;

async function completeWithContinuation(complete, system, user, prompt, entryFile, onProgress, maxContinuations = 3, proseLimit = PER_FILE_PROSE_LIMIT) {
  let text = await complete(system, user, { shouldStop: proseGuard(proseLimit) });
  for (let i = 1; i <= maxContinuations && /<file\s+path\s*=/.test(text) && looksTruncated(text, entryFile); i++) {
    onProgress({ phase: 'continue', attempt: i });
    const more = await complete(system, buildContinuationPrompt(prompt, text));
    if (!more || !more.trim()) break;
    text += more.replace(/^\s*```[a-zA-Z0-9_-]*\s*\r?\n/, '');
  }
  return text;
}

/**
 * Generates a project with `complete(system, user) -> Promise<string>`, then loops:
 * static checks -> optional `runtimeCheck(files)` -> repair, up to `maxRepairs` times.
 */
export async function runLlmBuildHarness({
  prompt,
  intent,
  complete,
  runtimeCheck = null,
  maxRepairs = 3,
  strategy = 'auto',
  onStrategyLearned = null,
  onProgress = () => {},
}) {
  const system = buildHarnessSystemPrompt(intent);
  const entryFile = intent?.template?.entryFile || 'index.html';
  const checkOpts = { entryFile, templateId: intent?.templateId };
  const attempts = [];

  let files = [];
  let mode = strategy;
  if (mode !== 'per-file') {
    onProgress({ phase: 'generate', attempt: 0 });
    const firstText = await completeWithContinuation(complete, system, buildHarnessUserPrompt(prompt, intent), prompt, entryFile, onProgress, 3, ONE_SHOT_PROSE_LIMIT);
    files = parseHarnessFiles(firstText, entryFile);
    const first = staticCheckProject(files, checkOpts);
    const unusable = files.length === 0 || first.some((p) => /truncated|No files were produced/.test(p)) || looksTruncated(firstText, entryFile);
    if (mode === 'auto' && unusable) {
      onProgress({ phase: 'fallback', attempt: 0, problems: first });
      mode = 'per-file';
      if (typeof onStrategyLearned === 'function') onStrategyLearned('per-file');
    } else if (mode === 'auto' && typeof onStrategyLearned === 'function') {
      onStrategyLearned('one-shot');
    }
  }
  if (mode === 'per-file') {
    files = await generatePerFile({ complete, system, prompt, intent, entryFile, onProgress, seed: files });
  }

  for (let attempt = 0; ; attempt++) {
    let problems = staticCheckProject(files, checkOpts);
    if (problems.length === 0 && typeof runtimeCheck === 'function') {
      onProgress({ phase: 'runtime', attempt });
      problems = (await runtimeCheck(files)) || [];
    }
    attempts.push({ attempt, problems, fileCount: files.length });
    onProgress({ phase: 'checked', attempt, problems });

    if (problems.length === 0 || attempt >= maxRepairs) {
      return { files, problems, attempts, passed: problems.length === 0, strategy: mode };
    }

    onProgress({ phase: 'repair', attempt: attempt + 1, problems });
    const targets = filesImplicatedBy(problems, files);
    if (targets.length > 0 && targets.length <= 4) {
      for (const target of targets) {
        onProgress({ phase: 'file', attempt: attempt + 1, path: target });
        const text = await completeWithContinuation(complete, system, buildFileRepairPrompt(prompt, files, problems, target), prompt, entryFile, onProgress);
        const fixed = parseHarnessFiles(text, entryFile);
        const own = pickTargetFile(fixed, target, files);
        if (own) files = mergeFiles(files, [own, ...fixed.filter((f) => f.path !== target && !files.some((g) => g.path === f.path))]);
      }
    } else {
      const repairText = await completeWithContinuation(complete, system, buildRepairPrompt(prompt, files, problems), prompt, entryFile, onProgress);
      const patch = parseHarnessFiles(repairText, entryFile);
      if (patch.length > 0) files = mergeFiles(files, patch);
    }
  }
}

const PATH_TOKEN_RE = /(?:^|[\s"'`(])\.?\/?((?:[\w.-]+\/)*[\w.-]+\.(?:html?|css|m?js|cjs|json|py|rs|toml|md))\b/g;

/** Project paths (existing or missing-but-referenced) named in check output. */
export function filesImplicatedBy(problems, files) {
  const existing = new Set(files.map((f) => f.path));
  const out = new Set();
  for (const p of problems) {
    for (const m of String(p).matchAll(PATH_TOKEN_RE)) {
      const path = m[1].replace(/^\.?\//, '');
      const aboutMissing = /not provided|Missing entry/.test(p);
      if (aboutMissing ? !existing.has(path) : existing.has(path)) out.add(path);
    }
  }
  return [...out].filter((p) => !p.startsWith('http'));
}

/** The block written for `target`, or a lone block under an unrelated name (models sometimes rename). */
function pickTargetFile(blocks, target, known) {
  const exact = blocks.find((f) => f.path === target);
  if (exact) return exact;
  if (blocks.length === 1 && !known.some((f) => f.path === blocks[0].path)) {
    const ext = (p) => p.split('.').pop();
    if (ext(blocks[0].path) === ext(target)) return { ...blocks[0], path: target };
  }
  return null;
}

function serializeFiles(files) {
  return files.map((f) => `<file path="${f.path}">\n${f.content}\n</file>`).join('\n\n');
}

export function buildFileRepairPrompt(prompt, files, problems, target) {
  return [
    `Project request: ${prompt}`,
    '',
    'Automated checks found these problems:',
    ...problems.map((p) => `- ${p}`),
    '',
    'Current project files:',
    serializeFiles(files),
    '',
    files.some((f) => f.path === target)
      ? `Rewrite ONLY ${target}, complete and fixed, consistent with the other files.`
      : `Write ONLY the missing file ${target}, complete, consistent with the other files.`,
    `Output exactly one block: <file path="${target}">...</file>. Nothing else.`,
  ].join('\n');
}

export function buildManifestPrompt(prompt, intent) {
  return [
    buildHarnessUserPrompt(prompt, intent),
    '',
    'PLANNING STEP. Do not write any code yet. Output exactly two blocks and nothing else:',
    '<manifest>["index.html","styles.css","app.js", ...]</manifest>  (JSON array of every file path, entry file first, at most 8 files)',
    '<spec>',
    'A compact contract (max 400 words) that lets each file be written separately and still fit: page sections and their DOM ids, CSS class names and design tokens (colors, fonts), every module with its exported functions and signatures, data shapes, and what each file is responsible for.',
    '</spec>',
  ].join('\n');
}

export function parseManifest(text) {
  const raw = String(text || '');
  let paths = [];
  const m = raw.match(/<manifest>([\s\S]*?)<\/manifest>/i);
  if (m) {
    try {
      paths = JSON.parse(m[1].trim());
    } catch {
      paths = m[1].split(/[\s,\n]+/).map((s) => s.replace(/["'[\]]/g, ''));
    }
  }
  paths = (Array.isArray(paths) ? paths : [])
    .map((p) => String(p).trim().replace(/^\.?\//, ''))
    .filter((p) => /^[\w./-]+\.[A-Za-z0-9]+$/.test(p) && !p.includes('..'));
  const spec = (raw.match(/<spec>([\s\S]*?)(?:<\/spec>|$)/i)?.[1] || '').trim().slice(0, 6000);
  return { paths: [...new Set(paths)].slice(0, 12), spec };
}

export function buildSingleFilePrompt(prompt, intent, manifest, written, target) {
  return [
    buildHarnessUserPrompt(prompt, intent),
    '',
    `All project files: ${manifest.paths.join(', ')}`,
    'Shared contract every file follows:',
    manifest.spec || '(none)',
    '',
    written.length ? `Files already written (match their ids, classes and exports exactly):\n${serializeFiles(written)}` : '',
    '',
    `Now write ONLY ${target}, complete and final. Output exactly one block: <file path="${target}">...</file>. No planning, no commentary.`,
  ]
    .filter((l) => l !== '')
    .join('\n');
}

const DEFAULT_MANIFEST = {
  'electron-desktop': ['package.json', 'main.cjs', 'preload.cjs', 'index.html', 'styles.css', 'renderer.js', 'test.mjs'],
  'fullstack-node-api': ['package.json', 'server.mjs', 'public/index.html', 'public/styles.css', 'public/app.js', 'test-api.mjs'],
  'python-science-cli': ['app.py', 'index.html', 'README.md'],
};

/** Plan-then-write: one manifest call, then one focused call per file. */
async function generatePerFile({ complete, system, prompt, intent, entryFile, onProgress, seed = [] }) {
  onProgress({ phase: 'plan', attempt: 0 });
  const manifest = parseManifest(await complete(system, buildManifestPrompt(prompt, intent), { shouldStop: (t) => /<\/spec>/i.test(t) || t.length > PER_FILE_PROSE_LIMIT }));
  if (manifest.paths.length === 0) {
    manifest.paths = DEFAULT_MANIFEST[intent?.templateId] || [entryFile, 'styles.css', 'app.js', 'package.json', 'test.mjs'];
  }
  if (!manifest.paths.includes(entryFile) && !manifest.paths.some((p) => /\.html?$/.test(p))) manifest.paths.unshift(entryFile);

  const usableSeed = seed.filter((f) => manifest.paths.includes(f.path) && staticCheckProject([f], { entryFile: f.path }).every((p) => !/truncated|syntax error|not valid JSON/.test(p)));
  let written = [...usableSeed];
  for (const target of manifest.paths) {
    if (written.some((f) => f.path === target)) continue;
    onProgress({ phase: 'file', attempt: 0, path: target });
    const text = await completeWithContinuation(complete, system, buildSingleFilePrompt(prompt, intent, manifest, written, target), prompt, entryFile, onProgress);
    const got = parseHarnessFiles(text, entryFile);
    const own = pickTargetFile(got, target, written);
    if (own) written = mergeFiles(written, [own]);
  }
  return written;
}
