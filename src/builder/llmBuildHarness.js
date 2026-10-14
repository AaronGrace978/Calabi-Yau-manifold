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
  'It must run by simply opening index.html: no build step, no bundler, no TypeScript, no JSX. Libraries may be loaded from https://esm.sh or https://unpkg.com via <script type="importmap"> or full URLs.',
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
    'OUTPUT FORMAT (strict): output ONLY files, each introduced by a marker line, with no markdown fences and no prose:',
    '// === FILE: relative/path.ext ===',
    '<entire file contents>',
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
  const serialized = files.map((f) => `// === FILE: ${f.path} ===\n${f.content}`).join('\n\n');
  return [
    `The project below was built for the request: ${prompt}`,
    '',
    'It has these problems, found by automated checks:',
    ...problems.map((p) => `- ${p}`),
    '',
    'Fix every problem. Output the COMPLETE corrected contents of every file that needs to change (and any new files), using the same // === FILE: path === markers. Files you do not output are kept as they are.',
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

export function parseHarnessFiles(text, entryFile = 'index.html') {
  return parseMultiFileResponse(text, entryFile)
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
    return ['No files were produced. Output files using // === FILE: path === markers.'];
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
  onProgress = () => {},
}) {
  const system = buildHarnessSystemPrompt(intent);
  const entryFile = intent?.template?.entryFile || 'index.html';
  const checkOpts = { entryFile, templateId: intent?.templateId };
  const attempts = [];

  onProgress({ phase: 'generate', attempt: 0 });
  const firstText = await complete(system, buildHarnessUserPrompt(prompt, intent));
  let files = parseHarnessFiles(firstText, entryFile);

  for (let attempt = 0; ; attempt++) {
    let problems = staticCheckProject(files, checkOpts);
    if (problems.length === 0 && typeof runtimeCheck === 'function') {
      onProgress({ phase: 'runtime', attempt });
      problems = (await runtimeCheck(files)) || [];
    }
    attempts.push({ attempt, problems, fileCount: files.length });
    onProgress({ phase: 'checked', attempt, problems });

    if (problems.length === 0 || attempt >= maxRepairs) {
      return { files, problems, attempts, passed: problems.length === 0 };
    }

    onProgress({ phase: 'repair', attempt: attempt + 1, problems });
    const repairText = await complete(system, buildRepairPrompt(prompt, files, problems));
    const patch = parseHarnessFiles(repairText, entryFile);
    if (patch.length > 0) files = mergeFiles(files, patch);
  }
}
