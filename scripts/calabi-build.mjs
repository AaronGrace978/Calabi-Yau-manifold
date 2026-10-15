#!/usr/bin/env node
/**
 * Headless build harness: same generate -> check -> run -> repair loop as the desktop App
 * Builder, driven from the terminal.
 *
 *   node scripts/calabi-build.mjs "build an ollama cloud electron app" --model glm-5.3
 *
 * Providers: ollama-cloud (OLLAMA_API_KEY), ollama-local, openai-compatible (--endpoint,
 * OPENAI_API_KEY), anthropic (ANTHROPIC_API_KEY).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';

import { analyzeBuildIntent, bundlePreviewHtml, runLlmBuildHarness } from '../src/builder/index.js';

const run = promisify(execFile);

function parseArgs(argv) {
  const opts = { provider: 'ollama-cloud', model: 'glm-5.3', template: 'auto', repairs: 3, out: null, endpoint: null };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      opts[key] = argv[++i];
    } else rest.push(a);
  }
  opts.prompt = rest.join(' ').trim();
  opts.repairs = Number(opts.repairs);
  return opts;
}

async function* readLines(response) {
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (line) yield line;
    }
  }
  if (buffer.trim()) yield buffer.trim();
}

function makeCompleter(opts) {
  return async (system, user, { shouldStop } = {}) => {
    const p = opts.provider;
    let url;
    let headers = { 'Content-Type': 'application/json' };
    let body;
    if (p === 'ollama-cloud' || p === 'ollama-local') {
      url = opts.endpoint || (p === 'ollama-cloud' ? 'https://ollama.com/api/chat' : 'http://localhost:11434/api/chat');
      if (process.env.OLLAMA_API_KEY) headers.Authorization = `Bearer ${process.env.OLLAMA_API_KEY}`;
      body = {
        model: opts.model,
        stream: true,
        think: false,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        options: { temperature: 0.4, num_ctx: 32768, num_predict: 32000 },
      };
    } else if (p === 'anthropic') {
      url = opts.endpoint || 'https://api.anthropic.com/v1/messages';
      headers = { ...headers, 'x-api-key': process.env.ANTHROPIC_API_KEY || '', 'anthropic-version': '2023-06-01' };
      body = { model: opts.model, max_tokens: 32000, stream: true, system, messages: [{ role: 'user', content: user }] };
    } else {
      url = opts.endpoint || 'https://api.openai.com/v1/chat/completions';
      headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY || ''}`;
      body = {
        model: opts.model,
        stream: true,
        temperature: 0.4,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      };
    }

    const controller = new AbortController();
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}: ${(await res.text()).slice(0, 400)}`);
    let text = '';
    let lastReport = 0;
    try {
    for await (const raw of readLines(res)) {
      const line = raw.startsWith('data:') ? raw.slice(5).trim() : raw;
      if (!line || line === '[DONE]' || raw.startsWith('event:')) continue;
      let j;
      try {
        j = JSON.parse(line);
      } catch {
        continue;
      }
      const tok = j.message?.content ?? j.choices?.[0]?.delta?.content ?? (j.type === 'content_block_delta' ? j.delta?.text : '') ?? '';
      if (tok) text += tok;
      if (text.length - lastReport > 4000) {
        lastReport = text.length;
        process.stdout.write(`\r    streaming… ${text.length.toLocaleString()} chars`);
      }
      if (shouldStop && shouldStop(text)) {
        process.stdout.write(`\r    stopped early at ${text.length.toLocaleString()} chars (model was planning instead of writing files)\n`);
        controller.abort();
        return text;
      }
    }
    } catch (err) {
      if (err.name !== 'AbortError') throw err;
    }
    process.stdout.write(`\r    received ${text.length.toLocaleString()} chars\n`);
    return text;
  };
}

function findChrome() {
  for (const bin of ['google-chrome', 'chromium', 'chromium-browser', 'chrome']) {
    try {
      execFileSync('which', [bin], { stdio: 'ignore' });
      return bin;
    } catch {
      // try next
    }
  }
  return process.env.CHROME_PATH || null;
}

const PROBE = `<script>(function(){var errs=[];function s(m){errs.push(String(m).slice(0,300));}
window.addEventListener('error',function(e){if(e.message)s('Uncaught '+e.message+(e.lineno?' (line '+e.lineno+')':''));else if(e.target&&(e.target.src||e.target.href))s('Failed to load resource '+(e.target.src||e.target.href))},true);
window.addEventListener('unhandledrejection',function(e){s('Unhandled promise rejection: '+(e.reason&&e.reason.message||e.reason))});
var ce=console.error;console.error=function(){s('console.error: '+Array.prototype.join.call(arguments,' '));return ce.apply(console,arguments)};
window.addEventListener('load',function(){setTimeout(function(){var b=document.body;var t=b?(b.innerText||'').trim().length:0;var v=b?b.querySelectorAll('canvas,svg,img,video,button,input').length:0;if(t<20&&v===0)s('Page renders blank (no visible text or elements after load)');var pre=document.createElement('pre');pre.id='__calabi_probe__';pre.textContent=JSON.stringify(errs);document.documentElement.appendChild(pre)},1500)})})();<\/script>`;

async function browserProbe(chrome, html, dir) {
  const file = path.join(dir, '.calabi-probe.html');
  const instrumented = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => `${m}${PROBE}`) : `${PROBE}${html}`;
  fs.writeFileSync(file, instrumented);
  try {
    const { stdout } = await run(
      chrome,
      ['--headless=new', '--no-sandbox', '--disable-gpu', '--virtual-time-budget=6000', '--dump-dom', `file://${file}`],
      { timeout: 60000, maxBuffer: 64 * 1024 * 1024 }
    );
    const m = stdout.match(/<pre id="__calabi_probe__">([\s\S]*?)<\/pre>/);
    if (!m) return ['Runtime (browser preview): page never finished loading (probe did not report)'];
    const decoded = m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    return [...new Set(JSON.parse(decoded))].slice(0, 12).map((e) => `Runtime (browser preview): ${e}`);
  } finally {
    fs.rmSync(file, { force: true });
  }
}

function writeProject(dir, files) {
  fs.mkdirSync(dir, { recursive: true });
  for (const f of files) {
    const target = path.join(dir, f.path);
    if (!target.startsWith(dir + path.sep)) throw new Error(`Refusing to write outside project: ${f.path}`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, f.content);
  }
}

const STRATEGY_FILE = path.join(os.homedir(), '.calabi', 'model-strategies.json');

function loadStrategies() {
  try {
    return JSON.parse(fs.readFileSync(STRATEGY_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveStrategy(key, mode) {
  const all = loadStrategies();
  if (all[key] === mode) return;
  all[key] = mode;
  fs.mkdirSync(path.dirname(STRATEGY_FILE), { recursive: true });
  fs.writeFileSync(STRATEGY_FILE, JSON.stringify(all, null, 2));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.prompt) {
    console.error('Usage: node scripts/calabi-build.mjs "<what to build>" [--model glm-5.3] [--provider ollama-cloud] [--template auto] [--out dir]');
    process.exit(2);
  }
  const intent = analyzeBuildIntent(opts.prompt, opts.template);
  const outRoot = opts.out || path.join(os.homedir(), 'CalabiYauProjects', 'builds');
  const dir = path.resolve(outRoot, intent.slug);
  const chrome = findChrome();
  console.log(`▶ ${opts.prompt}\n  ${opts.provider} // ${opts.model} · ${intent.template.label} · ${dir}`);
  if (!chrome) console.log('  (no Chrome found: browser runtime checks skipped; set CHROME_PATH to enable)');

  const runtimeCheck = async (files) => {
    writeProject(dir, files);
    const entry = files.find((f) => f.path === intent.template.entryFile) || files.find((f) => /\.html?$/i.test(f.path));
    const problems = chrome && entry ? await browserProbe(chrome, bundlePreviewHtml(entry.content, files, intent), dir) : [];
    const pkg = files.find((f) => f.path === 'package.json');
    if (!problems.length && pkg && /"test"\s*:/.test(pkg.content)) {
      try {
        await run('npm', ['test', '--silent'], { cwd: dir, timeout: 180000, shell: process.platform === 'win32' });
      } catch (err) {
        problems.push(`"npm test" failed (exit ${err.code}):\n${`${err.stdout || ''}\n${err.stderr || ''}`.trim().slice(-2500)}`);
      }
    }
    return problems;
  };

  const modelKey = `${opts.provider}/${opts.model}`;
  const started = Date.now();
  const result = await runLlmBuildHarness({
    prompt: opts.prompt,
    intent,
    complete: makeCompleter(opts),
    runtimeCheck,
    maxRepairs: opts.repairs,
    strategy: opts.strategy || (loadStrategies()[modelKey] === 'per-file' ? 'per-file' : 'auto'),
    onStrategyLearned: (mode) => saveStrategy(modelKey, mode),
    onProgress({ phase, attempt, problems, path: filePath }) {
      if (phase === 'generate') console.log('• generating project');
      if (phase === 'runtime') console.log('• running browser + test checks');
      if (phase === 'checked') {
        console.log(problems.length ? `  ✗ ${problems.length} problem(s):\n${problems.map((p) => `    - ${p.split('\n')[0]}`).join('\n')}` : '  ✓ all checks passed');
      }
      if (phase === 'repair') console.log(`• repair pass ${attempt}`);
      if (phase === 'fallback') console.log('• one-shot output unusable, switching to plan-then-write (one call per file)');
      if (phase === 'plan') console.log('• planning file manifest + shared contract');
      if (phase === 'file') console.log(`  writing ${filePath}`);
      if (phase === 'continue') console.log(`• output was cut off, asking model to continue (${attempt})`);
    },
  });

  writeProject(dir, result.files);
  const entry = result.files.find((f) => /\.html?$/i.test(f.path));
  if (entry) fs.writeFileSync(path.join(dir, '.calabi-preview.html'), bundlePreviewHtml(entry.content, result.files, intent));
  console.log(`\n${result.passed ? 'BUILD PASSED' : 'BUILD HAS UNRESOLVED PROBLEMS'} in ${((Date.now() - started) / 1000).toFixed(0)}s · ${result.files.length} files · ${result.attempts.length - 1} repair pass(es)`);
  for (const f of result.files) console.log(`  ${f.path} (${f.content.length.toLocaleString()} B)`);
  console.log(`  open: ${path.join(dir, '.calabi-preview.html')}`);
  process.exit(result.passed ? 0 : 1);
}

main().catch((err) => {
  console.error(`\n✗ ${err.message || err}`);
  process.exit(1);
});
