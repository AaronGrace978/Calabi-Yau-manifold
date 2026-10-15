import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeBuildIntent,
  compileApplicationProject,
  parseHarnessFiles,
  runLlmBuildHarness,
  selectTemplateForPrompt,
  staticCheckProject,
} from '../src/builder/index.js';

const goodWeb = `// === FILE: index.html ===
<!DOCTYPE html>
<html><head><link rel="stylesheet" href="styles.css"></head>
<body><h1>Four Seasons</h1><script type="module" src="app.js"></script></body></html>
// === FILE: styles.css ===
body { margin: 0; }
// === FILE: app.js ===
import { seasons } from './seasons.js';
document.querySelector('h1').textContent = seasons.join(' / ');
// === FILE: seasons.js ===
export const seasons = ['Spring', 'Summer', 'Autumn', 'Winter'];
`;

describe('LLM build harness', () => {
  it('parses marker files and strips stray fences', () => {
    const files = parseHarnessFiles('// === FILE: a.js ===\n```js\nconst a = 1;\n```\n');
    assert.deepEqual(files, [{ path: 'a.js', content: 'const a = 1;' }]);
  });

  it('accepts a clean project', () => {
    assert.deepEqual(staticCheckProject(parseHarnessFiles(goodWeb)), []);
  });

  it('flags missing references, syntax errors, truncation, and placeholders', () => {
    const files = [
      { path: 'index.html', content: '<html><body><script src="missing.js"></script><script>let x = ;</script>' },
      { path: 'app.js', content: 'function a() {\n  // ... rest of code\n}' },
    ];
    const problems = staticCheckProject(files).join('\n');
    assert.match(problems, /truncated/);
    assert.match(problems, /missing\.js/);
    assert.match(problems, /syntax error/);
    assert.match(problems, /placeholder/);
  });

  it('enforces Electron project structure', () => {
    const files = [
      { path: 'index.html', content: '<!DOCTYPE html><html><body>hi</body></html>' },
      { path: 'package.json', content: '{"name":"x","main":"main.cjs"}' },
    ];
    const problems = staticCheckProject(files, { templateId: 'electron-desktop' }).join('\n');
    assert.match(problems, /start/);
    assert.match(problems, /electron/);
    assert.match(problems, /main\.cjs/);
  });

  it('feeds problems back to the model until the project is clean', async () => {
    const prompts = [];
    const responses = [
      '// === FILE: index.html ===\n<!DOCTYPE html><html><body><script src="app.js"></script></body></html>',
      '// === FILE: app.js ===\ndocument.body.append("Seasons");',
    ];
    const result = await runLlmBuildHarness({
      prompt: 'seasons ui',
      intent: analyzeBuildIntent('seasons ui'),
      complete: async (_system, user) => {
        prompts.push(user);
        return responses.shift();
      },
    });
    assert.equal(result.passed, true);
    assert.equal(prompts.length, 2);
    assert.match(prompts[1], /app\.js/);
    assert.deepEqual(result.files.map((f) => f.path).sort(), ['app.js', 'index.html']);
  });

  it('includes runtime check failures in the repair loop', async () => {
    let runs = 0;
    const result = await runLlmBuildHarness({
      prompt: 'x',
      intent: analyzeBuildIntent('x'),
      complete: async () => goodWeb,
      runtimeCheck: async () => (runs++ === 0 ? ['Runtime: boom'] : []),
    });
    assert.equal(result.passed, true);
    assert.equal(result.attempts.length, 2);
  });

  it('uses only model-authored files, with no template filler', () => {
    const project = compileApplicationProject('generative seasons landing page', {
      llmFiles: parseHarnessFiles(goodWeb),
    });
    assert.equal(project.authoredByLlm, true);
    assert.deepEqual(project.files.map((f) => f.path).sort(), ['app.js', 'index.html', 'seasons.js', 'styles.css']);
    assert.match(project.previewHtml, /Spring/);
  });

  it('rejects the React/Vite single-file output seen in the wild and repairs it', async () => {
    const broken = `The user wants a beautiful landing page. Let me think...\n\`\`\`html\n<!doctype html>\n<html lang="en"><head></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>\n\`\`\`\nHere's a complete, runnable React landing page.`;
    const problems = staticCheckProject(parseHarnessFiles(broken)).join('\n');
    assert.match(problems, /src\/main\.jsx/);

    const jsx = staticCheckProject([
      { path: 'index.html', content: '<!DOCTYPE html><html><body><script type="module" src="app.jsx"></script></body></html>' },
      { path: 'app.jsx', content: 'export default () => <App />;' },
    ]).join('\n');
    assert.match(jsx, /no build step/);

    const replies = [broken, goodWeb];
    const result = await runLlmBuildHarness({
      prompt: 'Build me a beautiful Calabi generative UI landing page',
      intent: analyzeBuildIntent('Build me a beautiful Calabi generative UI landing page'),
      complete: async () => replies.shift(),
    });
    assert.equal(result.passed, true);
    assert.ok(result.files.some((f) => f.path === 'seasons.js'));
  });

  it('falls back to plan-then-write when a model rambles past its output limit', async () => {
    const calls = [];
    const result = await runLlmBuildHarness({
      prompt: 'seasons',
      intent: analyzeBuildIntent('seasons'),
      complete: async (_s, user) => {
        calls.push(user);
        if (calls.length === 1) return 'Let me think about the design. First I will... '.repeat(50);
        if (/PLANNING STEP/.test(user)) return '<manifest>["index.html","app.js"]</manifest><spec>h1#t shows seasons</spec>';
        if (/write ONLY index\.html/.test(user)) return 'ok here:\n<file path="index.html">\n<!DOCTYPE html><html><body><h1 id="t">x</h1><script src="app.js"></script></body></html>\n</file>';
        if (/write ONLY app\.js/.test(user)) return '<file path="app.js">\ndocument.getElementById("t").textContent = "Spring";\n</file>';
        return '';
      },
    });
    assert.equal(result.passed, true);
    assert.deepEqual(result.files.map((f) => f.path), ['index.html', 'app.js']);
    assert.match(calls[2], /write ONLY index\.html/);
    assert.match(calls[3], /h1 id="t"/);
  });

  it('stops rambling streams early and learns the per-model strategy', async () => {
    let firstGuard = null;
    const learned = [];
    await runLlmBuildHarness({
      prompt: 'seasons',
      intent: analyzeBuildIntent('seasons'),
      maxRepairs: 0,
      onStrategyLearned: (m) => learned.push(m),
      complete: async (_s, user, hooks) => {
        if (!firstGuard) firstGuard = hooks.shouldStop;
        if (/PLANNING STEP/.test(user)) return '<manifest>["index.html"]</manifest><spec>x</spec>';
        if (/write ONLY index\.html/.test(user)) return '<file path="index.html">\n<!DOCTYPE html><html><body>Seasons of the year</body></html>\n</file>';
        return 'thinking '.repeat(1000);
      },
    });
    assert.equal(firstGuard('x'.repeat(9000)), true);
    assert.equal(firstGuard('<file path="a.js">' + 'x'.repeat(9000)), false);
    assert.deepEqual(learned, ['per-file']);
  });

  it('routes misspelled Electron requests to the Electron template', () => {
    assert.equal(selectTemplateForPrompt('build an ollama cloud electrojn app with glm 5.3').id, 'electron-desktop');
  });
});
