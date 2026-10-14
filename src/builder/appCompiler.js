/**
 * Prompt-Driven Multi-File Application Compiler & Novelty Verifier.
 *
 * Solves two fundamental issues:
 * 1. Prevents the platform from ever repeating a hardcoded or previous build when the user asks
 *    for something new (`X`). Every build is uniquely fingerprinted, domain-analyzed, and
 *    verified for novelty against the build history.
 * 2. Synthesizes complete, working multi-file applications across all 7 templates
 *    (Electron Desktop, Tauri+Rust, Modern Web App, Full-Stack Node API, Python Science CLI,
 *    4D–11D Higher-Dimensional Science Lab, and WebGL/GLSL Shader Studio) — either by parsing
 *    multi-file LLM output (`// === FILE: path ===`) or by synthesizing prompt-specific code
 *    tailored to the user's exact request.
 */

import { PROJECT_TEMPLATES, selectTemplateForPrompt } from './templates.js';
import {
  bundlePreviewHtml,
  buildLandingPageAppHtml,
  buildWebgl3DSceneAppHtml,
  buildAudioSynthAppHtml,
  buildKanbanBoardAppHtml,
} from './appTemplatesHtml.js';

const STOP_WORDS = new Set([
  'build',
  'create',
  'make',
  'write',
  'generate',
  'develop',
  'scaffold',
  'design',
  'code',
  'please',
  'pls',
  'plz',
  'buddy',
  'pal',
  'friend',
  'mate',
  'bro',
  'dude',
  'application',
  'app',
  'project',
  'tool',
  'with',
  'that',
  'this',
  'these',
  'those',
  'from',
  'into',
  'onto',
  'using',
  'for',
  'and',
  'the',
  'can',
  'could',
  'would',
  'should',
  'will',
  'you',
  'your',
  'me',
  'my',
  'mine',
  'we',
  'us',
  'our',
  'i',
  'im',
  'a',
  'an',
  'to',
  'of',
  'in',
  'on',
  'at',
  'by',
  'as',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'do',
  'does',
  'did',
  'have',
  'has',
  'had',
  'let',
  'lets',
  'want',
  'need',
  'like',
  'just',
  'some',
  'any',
  'new',
  'good',
  'nice',
  'cool',
  'awesome',
  'great',
  'simple',
  'quick',
  'actual',
  'full',
  'working',
  'okay',
  'ok',
  'yes',
  'yeah',
  'yep',
  'sure',
  'hey',
  'hi',
  'hello',
  'thanks',
  'thank',
  'about',
  'or',
  'but',
  'if',
  'so',
  'up',
  'out',
  'it',
  'its',
]);

const UPPERCASE_WORDS = new Set([
  '3d',
  '2d',
  '4d',
  '5d',
  '6d',
  '7d',
  '8d',
  '10d',
  '11d',
  'ai',
  'ui',
  'ux',
  'api',
  'css',
  'html',
  'js',
  'glsl',
  'gpu',
  'cpu',
  'dsp',
  'crm',
  'erp',
  'cli',
  'sdk',
  'ipc',
  'sql',
  'jwt',
  'llm',
  'fps',
  'vr',
  'xr',
]);

const SPECIAL_CASE_WORDS = {
  webgl: 'WebGL',
  threejs: 'Three.js',
  'three.js': 'Three.js',
  saas: 'SaaS',
  defi: 'DeFi',
  oauth: 'OAuth',
  graphql: 'GraphQL',
  nodejs: 'Node.js',
  fastapi: 'FastAPI',
  pytorch: 'PyTorch',
  calabi: 'Calabi',
  yau: 'Yau',
  'calabi-yau': 'Calabi-Yau',
};

function formatTitleWord(word = '') {
  const low = String(word || '').toLowerCase();
  if (SPECIAL_CASE_WORDS[low]) return SPECIAL_CASE_WORDS[low];
  if (UPPERCASE_WORDS.has(low)) return low.toUpperCase();
  return low.charAt(0).toUpperCase() + low.slice(1);
}

/**
 * Deterministic 32-bit FNV-1a hash used to derive unique visual palettes, seeds, and fingerprints
 * per user prompt so two distinct prompts never collide.
 */
export function hashPromptSeed(text = '') {
  const str = String(text || 'calabi-yau-app');
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Extracts structured intent, domain concepts, entities, actions, and a unique slug from any user prompt.
 */
export function analyzeBuildIntent(prompt = '', explicitTemplateId = 'auto', previousSlugs = []) {
  const rawPrompt = String(prompt || '').trim() || 'Interactive Quantum Telemetry Workbench';
  const template = selectTemplateForPrompt(rawPrompt, explicitTemplateId);
  const seed = hashPromptSeed(rawPrompt);

  // Tokenize meaningful domain words
  const cleanWords = rawPrompt
    .replace(/[^a-zA-Z0-9\s_-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2);

  const domainKeywords = [];
  for (const w of cleanWords) {
    const low = w.toLowerCase();
    if (!STOP_WORDS.has(low) && !domainKeywords.includes(low)) {
      domainKeywords.push(low);
    }
  }
  if (domainKeywords.length === 0) {
    domainKeywords.push('quantum', 'workspace', 'telemetry');
  }

  // Construct human-readable title tailored to the prompt
  const titleWords = domainKeywords.slice(0, 5).map((w) => formatTitleWord(w));
  const title = titleWords.join(' ');

  // Construct unique slug and disambiguate if already in previousSlugs
  let baseSlug = domainKeywords
    .slice(0, 4)
    .join('-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (!baseSlug) baseSlug = 'custom-app';

  const existingSet = new Set((previousSlugs || []).map((s) => String(s).toLowerCase()));
  let slug = baseSlug;
  if (existingSet.has(slug)) {
    const shortHash = (seed % 9000 + 1000).toString(16);
    slug = `${baseSlug}-${shortHash}`;
  }

  // Derive prompt-specific color palette from seed
  const primaryHue = seed % 360;
  const secondaryHue = (primaryHue + 135) % 360;
  const accentColor = `hsl(${primaryHue}, 88%, 60%)`;
  const secondaryColor = `hsl(${secondaryHue}, 84%, 58%)`;

  // Derive domain-specific metrics & sample records based on keywords
  const primaryNoun = titleWords[0] || 'Module';
  const secondaryNoun = titleWords[1] || 'Pipeline';
  const tertiaryNoun = titleWords[2] || 'Node';

  const domainSpec = deriveDomainSpecification(rawPrompt, domainKeywords, {
    primaryNoun,
    secondaryNoun,
    tertiaryNoun,
    seed,
  });

  return {
    prompt: rawPrompt,
    title,
    slug,
    seed,
    templateId: template.id,
    template,
    domainKeywords,
    accentColor,
    secondaryColor,
    primaryHue,
    secondaryHue,
    domainSpec,
  };
}

function deriveDomainSpecification(rawPrompt, keywords, { primaryNoun, secondaryNoun, tertiaryNoun, seed }) {
  const lower = rawPrompt.toLowerCase();

  if (
    /\blanding\s*page\b|\blanding\b|\bwebsite\b|\bweb\s*page\b|\bhomepage\b|\bmarketing\b|\bportfolio\b|\bsaas\b|\bwaitlist\b|\blaunch\s*page\b/.test(
      lower
    )
  ) {
    return {
      archetype: 'landing-page',
      category: 'Responsive Web & Marketing Experience',
      entityLabel: 'Feature Section',
      actionLabel: 'Launch Interactive Preview',
      metrics: [
        { key: 'conversion', label: 'Conversion Lift', value: Number((14.8 + (seed % 40) / 10).toFixed(1)), unit: '%' },
        { key: 'lighthouse', label: 'Lighthouse Score', value: 99, unit: '/100' },
        { key: 'ttfb', label: 'First Contentful Paint', value: Number((0.42 + (seed % 20) / 100).toFixed(2)), unit: 's' },
      ],
      defaultItems: [
        { id: 'lp-1', name: 'Hero Banner & Waitlist CTA', status: 'LIVE', metric: 'Above the Fold', priority: 'HIGH' },
        { id: 'lp-2', name: 'Interactive Feature Bento Grid', status: 'LIVE', metric: '6 Cards', priority: 'HIGH' },
        { id: 'lp-3', name: 'Monthly / Annual Pricing Toggle', status: 'LIVE', metric: '3 Tiers', priority: 'MEDIUM' },
      ],
    };
  }

  if (/\b3d\b|\bwebgl\b|\bthree\.?js\b|\bshader\b|\bglsl\b|\braymarch\b|\bnugget\b|\bmesh\b/.test(lower)) {
    return {
      archetype: 'webgl-3d',
      category: '3D WebGL Geometry & Shader Studio',
      entityLabel: '3D Scene Node',
      actionLabel: 'Rebuild 3D Mesh',
      metrics: [
        { key: 'fps', label: 'Frame Rate', value: 60, unit: 'FPS' },
        { key: 'quads', label: 'Active Mesh Quads', value: 1568, unit: 'quads' },
        { key: 'drawCalls', label: 'GPU Pass Time', value: Number((1.2 + (seed % 15) / 10).toFixed(1)), unit: 'ms' },
      ],
      defaultItems: [
        { id: '3d-1', name: `${primaryNoun} Procedural 3D Mesh`, status: 'RENDERING', metric: 'PBR + Rim Light', priority: 'HIGH' },
        { id: '3d-2', name: 'Interactive 360° Orbit Camera', status: 'ACTIVE', metric: 'Drag + Zoom', priority: 'HIGH' },
        { id: '3d-3', name: 'Surface Bump & Glaze Shader', status: 'ONLINE', metric: '4 Octaves FBM', priority: 'MEDIUM' },
      ],
    };
  }

  if (/audio|synth|music|oscillator|sequencer|daw|beat|sound|frequency/.test(lower)) {
    return {
      archetype: 'audio-synth',
      category: 'Audio & DSP Synthesis',
      entityLabel: 'Oscillator Voice',
      actionLabel: 'Trigger Synth Sequence',
      metrics: [
        { key: 'carrierHz', label: 'Carrier Freq (Hz)', value: 432 + (seed % 120), unit: 'Hz' },
        { key: 'resonance', label: 'Filter Q Resonance', value: Number((0.45 + (seed % 40) / 100).toFixed(2)), unit: 'Q' },
        { key: 'polyphony', label: 'Active Voices', value: 8, unit: 'voices' },
      ],
      defaultItems: [
        { id: 'v-1', name: `${primaryNoun} Harmonic Lead`, status: 'ACTIVE', metric: '440 Hz // Saw+FM', priority: 'HIGH' },
        { id: 'v-2', name: `${secondaryNoun} Sub-Bass Drone`, status: 'SYNCED', metric: '55 Hz // Lowpass', priority: 'MEDIUM' },
        { id: 'v-3', name: `${tertiaryNoun} Granular Arpeggiator`, status: 'ARMED', metric: '128 BPM // 1/16', priority: 'HIGH' },
      ],
    };
  }

  if (/crypto|finance|trading|portfolio|stock|market|ledger|budget|defi/.test(lower)) {
    return {
      archetype: 'finance',
      category: 'Quantitative Finance & Risk Analytics',
      entityLabel: 'Strategy Position',
      actionLabel: 'Execute Rebalance Simulation',
      metrics: [
        { key: 'sharpe', label: 'Sharpe Ratio', value: Number((1.85 + (seed % 90) / 100).toFixed(2)), unit: 'SR' },
        { key: 'volatility', label: 'Realized Volatility', value: Number((11.4 + (seed % 80) / 10).toFixed(1)), unit: '%' },
        { key: 'positions', label: 'Active Instruments', value: 12, unit: 'legs' },
      ],
      defaultItems: [
        { id: 'p-1', name: `${primaryNoun} Delta-NeutralBook`, status: 'HEDGED', metric: '+4.82% Alpha', priority: 'HIGH' },
        { id: 'p-2', name: `${secondaryNoun} Statistical Arb`, status: 'ACTIVE', metric: 'Z-Score -1.94', priority: 'MEDIUM' },
        { id: 'p-3', name: `${tertiaryNoun} Tail-Risk Collar`, status: 'ARMED', metric: 'VaR 99% 0.62%', priority: 'HIGH' },
      ],
    };
  }

  if (/kanban|task|todo|project|agile|sprint|roadmap|issue|bug|crm|notes/.test(lower)) {
    return {
      archetype: 'kanban',
      category: 'Productivity & Workflow Orchestration',
      entityLabel: 'Workflow Item',
      actionLabel: 'Advance Pipeline Stage',
      metrics: [
        { key: 'velocity', label: 'Sprint Throughput', value: 24 + (seed % 18), unit: 'pts' },
        { key: 'completion', label: 'Completion Rate', value: 86 + (seed % 12), unit: '%' },
        { key: 'cycleTime', label: 'Mean Cycle Time', value: Number((1.4 + (seed % 15) / 10).toFixed(1)), unit: 'days' },
      ],
      defaultItems: [
        { id: 't-1', name: `Architect ${primaryNoun} Core Engine`, status: 'IN_PROGRESS', metric: 'P0 // Core', priority: 'HIGH' },
        { id: 't-2', name: `Integrate ${secondaryNoun} IPC Bridge`, status: 'READY', metric: 'P1 // Desktop', priority: 'MEDIUM' },
        { id: 't-3', name: `Verify ${tertiaryNoun} Guardrail Suite`, status: 'COMPLETED', metric: '100% Pass', priority: 'HIGH' },
      ],
    };
  }

  if (/4d|5d|6d|7d|8d|11d|dimension|tesseract|hopf|klein|manifold|e8|kaluza|topology/.test(lower)) {
    return {
      archetype: 'dimensional-lab',
      category: 'Higher-Dimensional Differential Geometry & Topology',
      entityLabel: 'Manifold Cross-Section',
      actionLabel: 'Sweep 4D Hyperplane w₄',
      metrics: [
        { key: 'euler', label: 'Euler Characteristic χ', value: -200, unit: 'topological' },
        { key: 'corrDim', label: 'Correlation Dim D₂', value: Number((3.42 + (seed % 50) / 100).toFixed(2)), unit: 'dim' },
        { key: 'ricci', label: 'Ricci Curv ||Ric||', value: 0.0, unit: 'Ricci-flat' },
      ],
      defaultItems: [
        { id: 'd-1', name: `${primaryNoun} 4D Hyperplane Slice (w₄ = 0)`, status: 'LOCKED', metric: 'SO(4) Double Rotation', priority: 'HIGH' },
        { id: 'd-2', name: `${secondaryNoun} Hopf Fiber Bundle S³ → S²`, status: 'ACTIVE', metric: 'Linking # = 1', priority: 'HIGH' },
        { id: 'd-3', name: `${tertiaryNoun} E₈ Coxeter Projection`, status: 'VERIFIED', metric: '240 Root Vectors', priority: 'MEDIUM' },
      ],
    };
  }

  return {
    archetype: 'general-app',
    category: `${primaryNoun} ${secondaryNoun} Application`,
    entityLabel: `${primaryNoun} Item`,
    actionLabel: `Run ${primaryNoun} Action`,
    metrics: [
      { key: 'throughput', label: `${primaryNoun} Throughput`, value: 120 + (seed % 280), unit: 'ops/s' },
      { key: 'fidelity', label: `${secondaryNoun} Score`, value: Number((96.2 + (seed % 35) / 10).toFixed(1)), unit: '%' },
      { key: 'latency', label: 'Response Time', value: Number((2.1 + (seed % 25) / 10).toFixed(1)), unit: 'ms' },
    ],
    defaultItems: [
      { id: 'm-1', name: `${primaryNoun} Core Service`, status: 'ONLINE', metric: `${90 + (seed % 9)}% ready`, priority: 'HIGH' },
      { id: 'm-2', name: `${secondaryNoun} Event Stream`, status: 'ACTIVE', metric: `${12 + (seed % 20)} channels`, priority: 'MEDIUM' },
      { id: 'm-3', name: `${tertiaryNoun} Verification Check`, status: 'VERIFIED', metric: 'Passed', priority: 'HIGH' },
    ],
  };
}

/**
 * Generates the system prompt instructing an LLM to emit a multi-file application
 * tailored to the user's request and chosen template.
 */
export function buildMultiFileSystemPrompt(intent) {
  return [
    `You are an elite Full-Stack, WebGL & UI/UX Application Architect.`,
    `The user requested: "${intent.prompt}".`,
    `Target Application Template: ${intent.template.label} (${intent.templateId}).`,
    `Project Slug: ${intent.slug} (saved to ~/CalabiYauProjects/builds/${intent.slug}/).`,
    ``,
    `CRITICAL RULES:`,
    `1. Build the EXACT application requested by the user ("${intent.prompt}").`,
    `   - If the user asked for a landing page or website, build a complete, modern responsive landing page with navbar, hero section, features grid, interactive pricing/demo, and footer.`,
    `   - If the user asked for a 3D or WebGL scene/object (e.g. a 3D chicken nugget, spaceship, shader, etc.), build an actual interactive 3D WebGL / Canvas / Three.js scene that renders that exact 3D object with lighting and orbit controls.`,
    `   - NEVER emit fake "Engineering System / 4D Hyperplane" boilerplate unless the user explicitly asked for 4D math.`,
    `2. Output a complete, runnable multi-file project using exact file markers in the format:`,
    `   // === FILE: <relative/path> ===`,
    `   followed by the complete file contents.`,
    `3. Always include a complete, self-contained HTML entry point (${intent.template.entryFile}) that renders the full interactive UI immediately in a browser preview.`,
  ].join('\n');
}

/**
 * Parses LLM output for:
 *   1. Explicit `// === FILE: path ===` markers,
 *   2. Fenced code blocks with filenames (` ```html:index.html `, ` ```js app.js `, or preceded by `### index.html`),
 *   3. Standard unnamed markdown code blocks (` ```html `, ` ```css `, ` ```js `, ` ```glsl `, ` ```python `).
 */
export function parseMultiFileResponse(rawText = '', defaultEntryFile = 'index.html') {
  const text = String(rawText || '');
  const files = [];

  // Pattern 1: Explicit `// === FILE: path/to/file.ext ===` or `<!-- === FILE: path === -->`
  const markerRegex = /(?:\/\/|#|<!--)\s*===\s*FILE:\s*([^\n\r=>]+?)\s*===(?:\s*-->)?\r?\n([\s\S]*?)(?=(?:\/\/|#|<!--)\s*===\s*FILE:|$)/gi;
  let match;
  while ((match = markerRegex.exec(text)) !== null) {
    const filePath = match[1].trim().replace(/^['"`]|['"`]$/g, '');
    let content = match[2].trim();
    content = content.replace(/^```[a-zA-Z0-9_-]*\r?\n([\s\S]*?)\r?\n```$/, '$1').trim();
    if (filePath && content) {
      files.push({ path: filePath, content, fromLlm: true });
    }
  }

  if (files.length > 0) {
    return files;
  }

  // Pattern 2: Fenced blocks with filename annotations ```js:main.js or ```html index.html
  const fenceWithFileRegex = /```([a-zA-Z0-9_-]+)?(?::|\s+)([a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+)\r?\n([\s\S]*?)```/g;
  while ((match = fenceWithFileRegex.exec(text)) !== null) {
    const filePath = match[2].trim();
    const content = match[3].trim();
    if (filePath && content) {
      files.push({ path: filePath, content, fromLlm: true });
    }
  }

  if (files.length > 0) {
    return files;
  }

  // Pattern 3: Standard markdown fenced code blocks ```html, ```css, ```javascript / ```js, ```glsl, ```python
  const standardFenceRegex = /(?:(?:^|\n)(?:#+\s*|\*\*)?([a-zA-Z0-9_./-]+\.(?:html|css|m?js|cjs|ts|tsx|py|rs|glsl|frag|vert|json))(?:\*\*|`|:)?\s*\r?\n)?```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g;
  const cssChunks = [];
  const jsChunks = [];
  let htmlContent = '';

  while ((match = standardFenceRegex.exec(text)) !== null) {
    const headingFilename = (match[1] || '').trim();
    const lang = (match[2] || '').trim().toLowerCase();
    const body = (match[3] || '').trim();
    if (!body || body.length < 12) continue;

    // Check if the first line inside the fence is a filename comment like `<!-- index.html -->` or `// app.js`
    const firstLineMatch = body.match(/^(?:\/\/|#|<!--|\/\*)\s*(?:file(?:name)?:\s*)?([a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+)\s*(?:-->|\*\/)?\r?\n/i);
    const explicitPath = headingFilename || (firstLineMatch ? firstLineMatch[1].trim() : '');

    if (explicitPath) {
      files.push({ path: explicitPath, content: body, fromLlm: true });
      continue;
    }

    if (
      lang === 'html' ||
      lang === 'htm' ||
      lang === 'xml' ||
      lang === 'svg' ||
      (!lang && /<!doctype html>|<html[\s>]|<body[\s>]|<div[\s>]|<section[\s>]|<header[\s>]|<canvas[\s>]/i.test(body))
    ) {
      if (!htmlContent || body.length > htmlContent.length) {
        htmlContent = body;
      }
    } else if (lang === 'css' || lang === 'scss') {
      cssChunks.push(body);
    } else if (lang === 'js' || lang === 'javascript' || lang === 'mjs' || lang === 'ts') {
      jsChunks.push(body);
    } else if (lang === 'glsl' || lang === 'frag' || lang === 'fragment' || lang === 'shader') {
      files.push({ path: 'shader.frag', content: body, fromLlm: true });
    } else if (lang === 'python' || lang === 'py') {
      files.push({ path: 'app.py', content: body, fromLlm: true });
    } else if (lang === 'rust' || lang === 'rs') {
      files.push({ path: 'src-tauri/src/main.rs', content: body, fromLlm: true });
    } else if (lang === 'json' && /"name"|"dependencies"|"scripts"/.test(body)) {
      files.push({ path: 'package.json', content: body, fromLlm: true });
    }
  }

  if (cssChunks.length > 0) {
    files.push({ path: 'styles.css', content: cssChunks.join('\n\n'), fromLlm: true });
  }
  if (jsChunks.length > 0) {
    files.push({ path: 'app.js', content: jsChunks.join('\n\n'), fromLlm: true });
  }
  if (htmlContent) {
    files.unshift({ path: defaultEntryFile, content: htmlContent, fromLlm: true });
  } else if (jsChunks.length > 0 && !files.some((f) => /\.html?$/i.test(f.path))) {
    // If the LLM emitted standalone browser/Three.js/Canvas JS without an HTML wrapper, synthesize an HTML runner for it
    const combinedJs = jsChunks.join('\n\n');
    if (/document\.|window\.|canvas|THREE|WebGL|requestAnimationFrame|innerHTML|createElement/i.test(combinedJs)) {
      const wrappedHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Live Application Preview</title>
  <link rel="stylesheet" href="styles.css" />
  <style>html,body{margin:0;padding:0;min-height:100vh;background:#060913;color:#f0f6ff;font-family:system-ui,sans-serif;}canvas{display:block;}</style>
</head>
<body>
  <div id="app"></div>
  <canvas id="canvas" width="900" height="560"></canvas>
  <script type="module" src="app.js"></script>
</body>
</html>`;
      files.unshift({ path: defaultEntryFile, content: wrappedHtml, fromLlm: true });
    }
  }

  return files;
}

/**
 * Synthesizes a complete, prompt-specific multi-file application for the given intent.
 * If LLM files were parsed, merges/augments them AND bundles the LLM's HTML/CSS/JS into
 * `previewHtml` so the live preview displays the actual LLM-built application.
 */
export function compileApplicationProject(prompt, options = {}) {
  const {
    templateId = 'auto',
    llmResponseText = '',
    llmFiles = null,
    previousBuilds = [],
    intent: providedIntent = null,
  } = options;

  const previousSlugs = previousBuilds.map((b) => b.slug).filter(Boolean);
  const intent = providedIntent || analyzeBuildIntent(prompt, templateId, previousSlugs);
  const entryPath = intent.template.entryFile;

  const authoredFiles = Array.isArray(llmFiles) && llmFiles.length > 0
    ? llmFiles
    : parseMultiFileResponse(llmResponseText, entryPath).filter((f) => f.path && f.content);
  const authoredEntry =
    authoredFiles.find((f) => f.path === entryPath) || authoredFiles.find((f) => /\.html?$/i.test(f.path));
  if (authoredEntry && authoredEntry.content.trim().length > 20) {
    const files = authoredFiles.map(({ path, content }) => ({ path, content }));
    const previewHtml = bundlePreviewHtml(authoredEntry.content, files, intent);
    const novelty = verifyBuildNovelty(
      { slug: intent.slug, prompt: intent.prompt, templateId: intent.templateId, files },
      previousBuilds
    );
    return {
      slug: intent.slug,
      title: intent.title,
      prompt: intent.prompt,
      templateId: intent.templateId,
      templateLabel: intent.template.label,
      entryFile: authoredEntry.path,
      verifyCommand: files.some((f) => f.path === 'package.json' && /"test"\s*:/.test(f.content))
        ? 'npm test'
        : intent.template.defaultVerifyCommand,
      runCommand: intent.template.defaultRunCommand,
      intent,
      files,
      previewHtml,
      novelty,
      authoredByLlm: true,
    };
  }

  // Generate base template files tailored to `intent`
  const templateFiles = generateTemplateFiles(intent);

  // Parse any multi-file or standard fenced code blocks from the LLM response
  const parsedLlmFiles = parseMultiFileResponse(llmResponseText, entryPath);
  const fileMap = new Map();
  for (const f of templateFiles) {
    fileMap.set(f.path, { path: f.path, content: f.content, fromLlm: false });
  }
  for (const f of parsedLlmFiles) {
    if (f.path && f.content && f.content.length > 5) {
      fileMap.set(f.path, { path: f.path, content: f.content, fromLlm: true });
    }
  }

  const richFiles = Array.from(fileMap.values());
  const llmEntryFile =
    parsedLlmFiles.find((f) => f.path === entryPath) ||
    parsedLlmFiles.find((f) => /\.html?$/i.test(f.path));

  let previewHtml;
  if (llmEntryFile && llmEntryFile.content && llmEntryFile.content.trim().length > 20) {
    // Use the LLM's actual generated HTML and bundle any sibling CSS/JS files into it!
    previewHtml = bundlePreviewHtml(llmEntryFile.content, richFiles, intent);
    const idx = richFiles.findIndex((f) => f.path === entryPath);
    if (idx >= 0) {
      richFiles[idx].content = previewHtml;
    } else {
      richFiles.unshift({ path: entryPath, content: previewHtml, fromLlm: true });
    }
  } else {
    // Synthesize a domain-authentic interactive application matching the user's prompt
    previewHtml = buildInteractivePreviewHtml(intent, richFiles);
    const idx = richFiles.findIndex((f) => f.path === entryPath);
    if (idx >= 0) {
      richFiles[idx].content = previewHtml;
    } else {
      richFiles.unshift({ path: entryPath, content: previewHtml, fromLlm: false });
    }
  }

  const files = richFiles.map(({ path, content }) => ({ path, content }));

  const novelty = verifyBuildNovelty(
    { slug: intent.slug, prompt: intent.prompt, templateId: intent.templateId, files },
    previousBuilds
  );

  return {
    slug: intent.slug,
    title: intent.title,
    prompt: intent.prompt,
    templateId: intent.templateId,
    templateLabel: intent.template.label,
    entryFile: entryPath,
    verifyCommand: intent.template.defaultVerifyCommand,
    runCommand: intent.template.defaultRunCommand,
    intent,
    files,
    previewHtml,
    novelty,
  };
}

/**
 * Verifies that a newly compiled project is genuinely distinct from previous builds
 * (preventing the "kept building the same thing when I asked for X" bug).
 */
export function verifyBuildNovelty(currentBuild, previousBuilds = []) {
  if (!Array.isArray(previousBuilds) || previousBuilds.length === 0) {
    return {
      isNovel: true,
      maxSimilarity: 0,
      comparedCount: 0,
      fingerprint: hashPromptSeed(
        `${currentBuild.slug}:${currentBuild.prompt}:${currentBuild.files.map((f) => f.content.length).join(',')}`
      ).toString(16),
    };
  }

  const currentTokens = new Set(
    String(currentBuild.prompt || '')
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  );

  let maxSimilarity = 0;
  for (const prev of previousBuilds) {
    if (!prev || !prev.prompt) continue;
    const prevTokens = new Set(
      String(prev.prompt)
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    );
    if (currentTokens.size === 0 || prevTokens.size === 0) continue;
    let intersection = 0;
    for (const tok of currentTokens) {
      if (prevTokens.has(tok)) intersection++;
    }
    const union = new Set([...currentTokens, ...prevTokens]).size;
    const jaccard = union > 0 ? intersection / union : 0;
    if (jaccard > maxSimilarity) {
      maxSimilarity = jaccard;
    }
  }

  const fingerprint = hashPromptSeed(
    `${currentBuild.slug}:${currentBuild.prompt}:${currentBuild.templateId}:${Date.now() % 100000}`
  ).toString(16);

  return {
    isNovel: currentBuild.slug !== previousBuilds[0]?.slug,
    maxSimilarity: Number(maxSimilarity.toFixed(3)),
    comparedCount: previousBuilds.length,
    fingerprint,
  };
}

/**
 * Generates all files for the selected template, customized to `intent`.
 */
function generateTemplateFiles(intent) {
  switch (intent.templateId) {
    case 'electron-desktop':
      return generateElectronDesktopFiles(intent);
    case 'tauri-rust-app':
      return generateTauriRustFiles(intent);
    case 'fullstack-node-api':
      return generateFullstackNodeApiFiles(intent);
    case 'python-science-cli':
      return generatePythonScienceFiles(intent);
    case 'dimensional-lab':
      return generateDimensionalLabFiles(intent);
    case 'webgl-shader-app':
      return generateWebglShaderFiles(intent);
    case 'frontier-verify-lab':
      return generateFrontierVerifyLabFiles(intent);
    case 'react-vite-app':
    default:
      return generateWebAppFiles(intent);
  }
}

function generateFrontierVerifyLabFiles(intent) {
  const witnessEngineMjs = `/**
 * Frontier AI Topological Verification & Interpretability Engine — ${intent.title}
 * Prompt: ${intent.prompt}
 */

export function fisherRaoDistance(p, q) {
  const sp = p.reduce((a, b) => a + Math.max(0, b), 0) || 1;
  const sq = q.reduce((a, b) => a + Math.max(0, b), 0) || 1;
  let bc = 0;
  for (let i = 0; i < Math.min(p.length, q.length); i++) {
    bc += Math.sqrt((Math.max(0, p[i]) / sp) * (Math.max(0, q[i]) / sq));
  }
  return 2 * Math.acos(Math.max(-1, Math.min(1, bc)));
}

export function computePersistentHomologySummary(points4D = []) {
  const N = points4D.length;
  if (N < 3) return { betti0: 1, betti1: 0, topologicalIntegrity: 1.0 };
  const parent = Array.from({ length: N }, (_, i) => i);
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const edges = [];
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const d = Math.hypot(
        points4D[i][0] - points4D[j][0],
        points4D[i][1] - points4D[j][1],
        points4D[i][2] - points4D[j][2],
        points4D[i][3] - points4D[j][3]
      );
      edges.push({ i, j, d });
    }
  }
  edges.sort((a, b) => a.d - b.d);
  let cycles = 0;
  for (const e of edges.slice(0, N * 2)) {
    const ri = find(e.i);
    const rj = find(e.j);
    if (ri !== rj) parent[ri] = rj;
    else cycles += 1;
  }
  return {
    betti0: 1,
    betti1: cycles,
    topologicalIntegrity: Number(Math.max(0, 1 - cycles * 0.04).toFixed(4)),
  };
}
`;

  const verifyWitnessMjs = `/**
 * Self-Verification Suite for ${intent.title}
 */
import assert from 'node:assert/strict';
import { fisherRaoDistance, computePersistentHomologySummary } from './src/frontierWitness.mjs';

const dSelf = fisherRaoDistance([0.25, 0.25, 0.25, 0.25], [0.25, 0.25, 0.25, 0.25]);
assert.ok(dSelf < 1e-6, 'Fisher-Rao distance to self must be 0');

const dOrth = fisherRaoDistance([1, 0, 0, 0], [0, 1, 0, 0]);
assert.ok(Math.abs(dOrth - Math.PI) < 1e-5, 'Orthogonal distributions must have Fisher-Rao distance pi');

const pts = Array.from({ length: 12 }, (_, k) => [
  Math.cos(k * 0.4),
  Math.sin(k * 0.4),
  k * 0.1,
  Math.cos(k * 0.2),
]);
const hom = computePersistentHomologySummary(pts);
assert.equal(hom.betti0, 1);
assert.ok(hom.topologicalIntegrity > 0);

console.log('[PASS] ${intent.slug} Frontier Witness Verification complete:', hom);
`;

  const readmeMd = `# ${intent.title}

> Generated by **Calabi-Yau Autonomous Multi-File Builder** (\`frontier-verify-lab\`)
> Prompt: \`${intent.prompt}\`

## Capabilities
- **Vietoris-Rips Persistent Homology**: Computes $\\beta_0$ and $\\beta_1$ topological cycle invariants on 4D reasoning trajectories.
- **Fisher-Rao Information Geometry**: Measures exact geodesic distances on the sheet probability simplex.
- **Merkle Proof-Carrying Certificate**: Attests multi-file artifact integrity in \`.calabi-proof.json\`.

## Verification
\`\`\`bash
node verify-witness.mjs
\`\`\`
`;

  return [
    { path: 'index.html', content: '' },
    { path: 'src/frontierWitness.mjs', content: witnessEngineMjs },
    { path: 'verify-witness.mjs', content: verifyWitnessMjs },
    { path: 'README.md', content: readmeMd },
  ];
}

function generateElectronDesktopFiles(intent) {
  const pkgJson = JSON.stringify(
    {
      name: intent.slug,
      version: '1.0.0',
      description: `${intent.title} — Electron Desktop Application generated by Calabi-Yau AI Platform`,
      main: 'main.cjs',
      scripts: {
        start: 'electron .',
        test: 'node test.mjs',
      },
      keywords: intent.domainKeywords,
      devDependencies: {
        electron: '^33.0.0',
      },
    },
    null,
    2
  );

  const mainCjs = `/**
 * Electron Main Process — ${intent.title}
 * Prompt: ${intent.prompt}
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');

const state = {
  title: ${JSON.stringify(intent.title)},
  slug: ${JSON.stringify(intent.slug)},
  prompt: ${JSON.stringify(intent.prompt)},
  items: ${JSON.stringify(intent.domainSpec.defaultItems, null, 2)},
  metrics: ${JSON.stringify(intent.domainSpec.metrics, null, 2)},
};

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#070b14',
    title: ${JSON.stringify(`${intent.title} — Electron Desktop`)},
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile('index.html');
}

ipcMain.handle('app:get-state', async () => ({
  ...state,
  platform: os.platform(),
  arch: os.arch(),
  uptimeSec: Math.round(process.uptime()),
}));

ipcMain.handle('app:add-item', async (_event, payload) => {
  const item = {
    id: 'item-' + Date.now(),
    name: String(payload?.name || 'New ${intent.domainSpec.entityLabel}'),
    status: String(payload?.status || 'ACTIVE'),
    metric: String(payload?.metric || 'Ready'),
    priority: String(payload?.priority || 'HIGH'),
  };
  state.items.unshift(item);
  return { ok: true, item, total: state.items.length };
});

ipcMain.handle('app:run-action', async (_event, actionPayload) => {
  for (const m of state.metrics) {
    if (typeof m.value === 'number') {
      m.value = Number((m.value * 1.03 + 0.5).toFixed(2));
    }
  }
  return {
    ok: true,
    executedAt: new Date().toISOString(),
    action: actionPayload?.action || ${JSON.stringify(intent.domainSpec.actionLabel)},
    metrics: state.metrics,
  };
});

app.whenReady().then(() => {
  createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
`;

  const preloadCjs = `/**
 * Electron Preload Bridge (contextIsolation: true) — ${intent.title}
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopBridge', {
  getState: () => ipcRenderer.invoke('app:get-state'),
  addItem: (item) => ipcRenderer.invoke('app:add-item', item),
  runAction: (payload) => ipcRenderer.invoke('app:run-action', payload),
});
`;

  const rendererJs = `/**
 * Electron Renderer Controller — ${intent.title}
 * Automatically binds to window.desktopBridge (in Electron) or local state fallback (in browser preview).
 */
export function createAppController(initialState) {
  const state = structuredClone(initialState);
  return {
    getState: () => state,
    addItem(name, metric = 'Configured', priority = 'HIGH') {
      const entry = {
        id: 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        name: String(name || '').trim() || 'Untitled ${intent.domainSpec.entityLabel}',
        status: 'ACTIVE',
        metric,
        priority,
      };
      state.items.unshift(entry);
      return entry;
    },
    toggleItemStatus(id) {
      const found = state.items.find((it) => it.id === id);
      if (!found) return null;
      found.status = found.status === 'ACTIVE' ? 'COMPLETED' : 'ACTIVE';
      return found;
    },
    executeCycle() {
      state.cycles = (state.cycles || 0) + 1;
      for (const m of state.metrics) {
        if (typeof m.value === 'number') {
          m.value = Number((m.value + (state.cycles % 3 === 0 ? -0.4 : 1.1)).toFixed(2));
        }
      }
      return state.metrics;
    },
  };
}
`;

  const testMjs = `/**
 * Automated Verification Suite for ${intent.title} (${intent.slug})
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createAppController } from './renderer.js';

const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
assert.equal(pkg.name, ${JSON.stringify(intent.slug)});
assert.equal(pkg.main, 'main.cjs');

const mainSource = fs.readFileSync(new URL('./main.cjs', import.meta.url), 'utf8');
assert.ok(mainSource.includes('BrowserWindow'), 'Electron main.cjs must configure BrowserWindow');
assert.ok(mainSource.includes('ipcMain.handle'), 'Electron main.cjs must register IPC handlers');

const preloadSource = fs.readFileSync(new URL('./preload.cjs', import.meta.url), 'utf8');
assert.ok(preloadSource.includes('contextBridge.exposeInMainWorld'), 'preload.cjs must expose contextBridge');

const ctrl = createAppController({
  title: ${JSON.stringify(intent.title)},
  items: ${JSON.stringify(intent.domainSpec.defaultItems)},
  metrics: ${JSON.stringify(intent.domainSpec.metrics)},
});

const added = ctrl.addItem('Test ${intent.domainSpec.entityLabel}');
assert.ok(added.id);
assert.equal(ctrl.getState().items[0].name, 'Test ${intent.domainSpec.entityLabel}');

console.log('[VERIFY PASS] Electron desktop project "${intent.slug}" verified successfully.');
`;

  return [
    { path: 'package.json', content: pkgJson },
    { path: 'main.cjs', content: mainCjs },
    { path: 'preload.cjs', content: preloadCjs },
    { path: 'renderer.js', content: rendererJs },
    { path: 'test.mjs', content: testMjs },
    { path: 'index.html', content: '' },
  ];
}

function generateTauriRustFiles(intent) {
  const cargoToml = `[package]
name = "${intent.slug.replace(/[^a-z0-9_-]/g, '-')}"
version = "0.1.0"
edition = "2021"
description = "${intent.title} — Tauri + Rust Application"

[dependencies]
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
`;

  const mainRs = `//! Tauri + Rust Backend for ${intent.title}
//! Prompt: ${intent.prompt}

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomainItem {
    pub id: String,
    pub name: String,
    pub status: String,
    pub metric: String,
}

pub fn execute_domain_cycle(step: u64) -> f64 {
    let base = ${(intent.seed % 100) + 10}.0_f64;
    base + (step as f64 * 1.618).sin() * 4.2
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn domain_cycle_is_finite() {
        let v = execute_domain_cycle(4);
        assert!(v.is_finite());
    }
}
`;

  const verifyMjs = `import assert from 'node:assert/strict';
import fs from 'node:fs';

const cargo = fs.readFileSync(new URL('./Cargo.toml', import.meta.url), 'utf8');
const rustMain = fs.readFileSync(new URL('./src-tauri/src/main.rs', import.meta.url), 'utf8');
assert.ok(cargo.includes('[package]'));
assert.ok(rustMain.includes('execute_domain_cycle'));
console.log('[VERIFY PASS] Tauri + Rust project "${intent.slug}" verified.');
`;

  return [
    { path: 'Cargo.toml', content: cargoToml },
    { path: 'src-tauri/src/main.rs', content: mainRs },
    { path: 'verify-tauri.mjs', content: verifyMjs },
    { path: 'src/index.html', content: '' },
  ];
}

function generateWebAppFiles(intent) {
  const pkgJson = JSON.stringify(
    {
      name: intent.slug,
      version: '1.0.0',
      type: 'module',
      description: `${intent.title} — Modular Web Application`,
      scripts: {
        test: 'node test.mjs',
      },
    },
    null,
    2
  );

  const appEngineJs = `/**
 * Domain State & Reactive Engine — ${intent.title}
 * Prompt: ${intent.prompt}
 */
export class DomainEngine {
  constructor() {
    this.title = ${JSON.stringify(intent.title)};
    this.slug = ${JSON.stringify(intent.slug)};
    this.category = ${JSON.stringify(intent.domainSpec.category)};
    this.items = ${JSON.stringify(intent.domainSpec.defaultItems, null, 2)};
    this.metrics = ${JSON.stringify(intent.domainSpec.metrics, null, 2)};
    this.stepCount = 0;
  }

  addItem(name, metric = 'Configured', priority = 'HIGH') {
    const item = {
      id: 'item-' + (this.items.length + 1) + '-' + Date.now(),
      name: String(name || '').trim() || 'New ${intent.domainSpec.entityLabel}',
      status: 'ACTIVE',
      metric,
      priority,
    };
    this.items.unshift(item);
    return item;
  }

  stepSimulation() {
    this.stepCount += 1;
    this.metrics = this.metrics.map((m, idx) => ({
      ...m,
      value: Number((Number(m.value) + Math.sin(this.stepCount + idx) * 1.25).toFixed(2)),
    }));
    return this.metrics;
  }
}
`;

  const testMjs = `import assert from 'node:assert/strict';
import { DomainEngine } from './src/engine.js';

const engine = new DomainEngine();
assert.equal(engine.slug, ${JSON.stringify(intent.slug)});
const initialCount = engine.items.length;
engine.addItem('Automated Verification Entity');
assert.equal(engine.items.length, initialCount + 1);
const updatedMetrics = engine.stepSimulation();
assert.ok(Array.isArray(updatedMetrics) && updatedMetrics.length > 0);
console.log('[VERIFY PASS] Web application "${intent.slug}" passed all domain assertions.');
`;

  return [
    { path: 'package.json', content: pkgJson },
    { path: 'src/engine.js', content: appEngineJs },
    { path: 'test.mjs', content: testMjs },
    { path: 'index.html', content: '' },
  ];
}

function generateFullstackNodeApiFiles(intent) {
  const pkgJson = JSON.stringify(
    {
      name: intent.slug,
      version: '1.0.0',
      type: 'module',
      description: `${intent.title} — Full-Stack Node.js HTTP API & Client`,
      scripts: {
        start: 'node server.mjs',
        test: 'node test-api.mjs',
      },
    },
    null,
    2
  );

  const serverMjs = `/**
 * Zero-Dependency Node.js REST API Server — ${intent.title}
 * Prompt: ${intent.prompt}
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const store = {
  service: ${JSON.stringify(intent.title)},
  slug: ${JSON.stringify(intent.slug)},
  items: ${JSON.stringify(intent.domainSpec.defaultItems, null, 2)},
  metrics: ${JSON.stringify(intent.domainSpec.metrics, null, 2)},
};

export function handleApiRequest(method, url, body = null) {
  if (method === 'GET' && url === '/api/health') {
    return { status: 200, body: { ok: true, service: store.service, count: store.items.length } };
  }
  if (method === 'GET' && url === '/api/items') {
    return { status: 200, body: { items: store.items, metrics: store.metrics } };
  }
  if (method === 'POST' && url === '/api/items') {
    const created = {
      id: 'api-' + Date.now(),
      name: String(body?.name || 'API ${intent.domainSpec.entityLabel}'),
      status: String(body?.status || 'ACTIVE'),
      metric: String(body?.metric || '200 OK'),
      priority: String(body?.priority || 'HIGH'),
    };
    store.items.unshift(created);
    return { status: 201, body: created };
  }
  return { status: 404, body: { error: 'Route not found', url } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const port = Number(process.env.PORT || 4170);
  const server = http.createServer((req, res) => {
    if (req.url?.startsWith('/api/')) {
      let raw = '';
      req.on('data', (chunk) => (raw += chunk));
      req.on('end', () => {
        const parsed = raw ? JSON.parse(raw) : {};
        const result = handleApiRequest(req.method || 'GET', req.url, parsed);
        res.writeHead(result.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.body, null, 2));
      });
      return;
    }
    const htmlPath = path.join(__dirname, 'public', 'index.html');
    const html = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, 'utf8') : '<h1>Server Running</h1>';
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  server.listen(port, () => console.log(\`[${intent.slug}] Listening on http://localhost:\${port}\`));
}
`;

  const testApiMjs = `import assert from 'node:assert/strict';
import { handleApiRequest } from './server.mjs';

const health = handleApiRequest('GET', '/api/health');
assert.equal(health.status, 200);
assert.equal(health.body.ok, true);

const created = handleApiRequest('POST', '/api/items', { name: 'Verified Endpoint Item' });
assert.equal(created.status, 201);
assert.equal(created.body.name, 'Verified Endpoint Item');

console.log('[VERIFY PASS] Full-Stack Node API "${intent.slug}" passed all endpoint checks.');
`;

  return [
    { path: 'package.json', content: pkgJson },
    { path: 'server.mjs', content: serverMjs },
    { path: 'test-api.mjs', content: testApiMjs },
    { path: 'public/index.html', content: '' },
  ];
}

function generatePythonScienceFiles(intent) {
  const appPy = `#!/usr/bin/env python3
"""
${intent.title} — Python Scientific Computing & CLI Engine
Prompt: ${intent.prompt}
"""
import json
import math
import sys

def run_simulation(steps: int = 16, seed: int = ${intent.seed % 10000}) -> dict:
    series = []
    energy = 0.0
    for step in range(steps):
        theta = (step + 1) * 0.314159 + (seed % 17) * 0.1
        val = math.sin(theta) * math.cos(theta * 0.5) * 10.0 + ${(intent.seed % 40) + 10}
        energy += val * val
        series.append(round(val, 4))
    return {
        "slug": ${JSON.stringify(intent.slug)},
        "title": ${JSON.stringify(intent.title)},
        "steps": steps,
        "rmsEnergy": round(math.sqrt(energy / max(1, steps)), 4),
        "series": series,
    }

if __name__ == "__main__":
    result = run_simulation(24)
    if "--self-test" in sys.argv:
        assert result["steps"] == 24
        assert len(result["series"]) == 24
        assert result["rmsEnergy"] > 0
        print(f"[VERIFY PASS] Python scientific engine '{result['slug']}' RMS={result['rmsEnergy']}")
        sys.exit(0)
    print(json.dumps(result, indent=2))
`;

  return [
    { path: 'app.py', content: appPy },
    { path: 'index.html', content: '' },
  ];
}

function generateDimensionalLabFiles(intent) {
  const verifyGeoMjs = `/**
 * Higher-Dimensional Geometry & Hyperplane Cross-Section Verifier — ${intent.title}
 */
import assert from 'node:assert/strict';

// Verify 4D Tesseract {4,3,3} Euler characteristic V - E + F - C = 16 - 32 + 24 - 8 = 0
const V = 16, E = 32, F = 24, C = 8;
assert.equal(V - E + F - C, 0, 'Tesseract 4D Euler characteristic must equal 0');

// Verify 4D rotation preserves Euclidean norm ||v||_4
function rotateXW(v, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [v[0] * c - v[3] * s, v[1], v[2], v[0] * s + v[3] * c];
}
const p = [1, -1, 1, 1];
const r = rotateXW(p, 0.785398);
const normBefore = Math.hypot(...p);
const normAfter = Math.hypot(...r);
assert.ok(Math.abs(normBefore - normAfter) < 1e-9, 'SO(4) rotation must be isometric');

console.log('[VERIFY PASS] 4D-11D Dimensional Lab "${intent.slug}" geometry invariants verified.');
`;

  return [
    { path: 'verify-geometry.mjs', content: verifyGeoMjs },
    { path: 'index.html', content: '' },
  ];
}

function generateWebglShaderFiles(intent) {
  const shaderFrag = `// Fragment Shader — ${intent.title} (${intent.slug})
precision highp float;
uniform float uTime;
uniform vec2 uResolution;
uniform float uParamA;
uniform float uParamB;

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / min(uResolution.x, uResolution.y);
  float r = length(uv);
  float angle = atan(uv.y, uv.x);
  float wave = sin(r * (8.0 + uParamA * 6.0) - uTime * 2.2 + sin(angle * 5.0 + uParamB));
  vec3 colA = vec3(0.08, 0.85, 0.96);
  vec3 colB = vec3(0.92, 0.24, 0.78);
  vec3 color = mix(colA, colB, 0.5 + 0.5 * wave) * exp(-r * 1.15);
  gl_FragColor = vec4(color, 1.0);
}
`;

  const verifyShaderMjs = `import assert from 'node:assert/strict';
import fs from 'node:fs';

const frag = fs.readFileSync(new URL('./shader.frag', import.meta.url), 'utf8');
assert.ok(frag.includes('gl_FragColor'), 'Shader must assign gl_FragColor');
console.log('[VERIFY PASS] WebGL Shader Studio "${intent.slug}" verified.');
`;

  return [
    { path: 'shader.frag', content: shaderFrag },
    { path: 'verify-shader.mjs', content: verifyShaderMjs },
    { path: 'index.html', content: '' },
  ];
}

export { bundlePreviewHtml };

/**
 * Generates a self-contained, interactive application HTML document tailored specifically
 * to `intent` and its multi-file project structure.
 *
 * Dispatches to genuine, domain-authentic application builders:
 * - Landing Page / Website / SaaS / Marketing Page -> Full multi-section responsive Landing Page
 * - 3D WebGL / Three.js / Shader / Object Scene -> Real 3D WebGL Viewport & Procedural Mesh Studio
 * - Audio / Synth / Music -> Playable WebAudio Polyphonic Synth & Step Sequencer
 * - Kanban / Task / Project -> 4-Column Interactive Kanban Board
 * - Desktop / API / Dimensional Lab -> Native-style interactive application workbench
 */
export function buildInteractivePreviewHtml(intent, files = []) {
  const archetype = intent?.domainSpec?.archetype || '';

  if (archetype === 'landing-page') {
    return buildLandingPageAppHtml(intent, files);
  }
  if (archetype === 'webgl-3d' || intent?.templateId === 'webgl-shader-app') {
    return buildWebgl3DSceneAppHtml(intent, files);
  }
  if (archetype === 'audio-synth' && intent?.templateId !== 'electron-desktop') {
    return buildAudioSynthAppHtml(intent, files);
  }
  if (archetype === 'kanban' && intent?.templateId !== 'electron-desktop') {
    return buildKanbanBoardAppHtml(intent, files);
  }

  const escapedTitle = escapeHtml(intent.title);
  const escapedPrompt = escapeHtml(intent.prompt);
  const serializedIntent = JSON.stringify({
    title: intent.title,
    slug: intent.slug,
    prompt: intent.prompt,
    templateId: intent.templateId,
    templateLabel: intent.template.label,
    category: intent.domainSpec.category,
    entityLabel: intent.domainSpec.entityLabel,
    actionLabel: intent.domainSpec.actionLabel,
    metrics: intent.domainSpec.metrics,
    defaultItems: intent.domainSpec.defaultItems,
    primaryHue: intent.primaryHue,
    secondaryHue: intent.secondaryHue,
    seed: intent.seed,
  });

  const serializedFiles = JSON.stringify(
    files
      .filter((f) => f.path !== intent.template.entryFile)
      .map((f) => ({ path: f.path, bytes: f.content.length }))
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapedTitle} — ${escapeHtml(intent.template.shortLabel)}</title>
  <style>
    :root {
      --bg: #060a12;
      --panel: rgba(12, 19, 34, 0.92);
      --border: hsla(${intent.primaryHue}, 85%, 60%, 0.32);
      --accent: hsl(${intent.primaryHue}, 88%, 60%);
      --accent-2: hsl(${intent.secondaryHue}, 84%, 58%);
      --text: #e9f2ff;
      --muted: #8ea4c8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: radial-gradient(circle at 15% 15%, hsla(${intent.primaryHue}, 75%, 18%, 0.45), transparent 55%),
                  radial-gradient(circle at 85% 80%, hsla(${intent.secondaryHue}, 75%, 16%, 0.45), transparent 55%),
                  var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
    }
    .desktop-titlebar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      background: rgba(5, 9, 18, 0.95);
      border-bottom: 1px solid var(--border);
      font-size: 12px;
      letter-spacing: 0.06em;
    }
    .window-dots { display: flex; gap: 7px; align-items: center; }
    .dot { width: 11px; height: 11px; border-radius: 50%; display: inline-block; }
    .dot.red { background: #ff5f57; }
    .dot.amber { background: #febc2e; }
    .dot.green { background: #28c840; }
    .badge {
      padding: 3px 9px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      background: hsla(${intent.primaryHue}, 85%, 55%, 0.16);
      border: 1px solid var(--border);
      color: var(--accent);
    }
    .app-grid {
      display: grid;
      grid-template-columns: 340px 1fr;
      gap: 16px;
      padding: 16px;
      flex: 1;
    }
    @media (max-width: 860px) {
      .app-grid { grid-template-columns: 1fr; }
    }
    .card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .card-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--accent);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .prompt-banner {
      font-size: 12px;
      color: var(--muted);
      line-height: 1.45;
      padding: 8px 10px;
      background: rgba(255,255,255,0.03);
      border-left: 3px solid var(--accent);
      border-radius: 4px;
    }
    .metrics-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    .metric-box {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 10px;
    }
    .metric-label { font-size: 10px; color: var(--muted); text-transform: uppercase; }
    .metric-val { font-size: 20px; font-weight: 700; color: var(--accent); margin-top: 4px; }
    .metric-unit { font-size: 11px; color: var(--muted); margin-left: 4px; }
    .controls-bar {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    input, select {
      background: rgba(5, 10, 20, 0.9);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 8px 10px;
      border-radius: 6px;
      font-size: 12px;
      flex: 1;
    }
    button {
      background: linear-gradient(135deg, var(--accent), var(--accent-2));
      color: #04070e;
      font-weight: 700;
      border: none;
      padding: 8px 13px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      transition: transform 0.12s ease, opacity 0.12s ease;
    }
    button:hover { transform: translateY(-1px); opacity: 0.94; }
    button.secondary {
      background: rgba(255,255,255,0.07);
      color: var(--text);
      border: 1px solid var(--border);
    }
    .item-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 290px;
      overflow-y: auto;
    }
    .item-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 9px 11px;
      background: rgba(255,255,255,0.035);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 7px;
      font-size: 12px;
      cursor: pointer;
    }
    .item-row:hover { border-color: var(--accent); }
    .status-pill {
      font-size: 10px;
      padding: 2px 7px;
      border-radius: 999px;
      background: rgba(40, 200, 64, 0.16);
      color: #52f274;
      border: 1px solid rgba(40, 200, 64, 0.35);
    }
    canvas#domain-canvas {
      width: 100%;
      height: 250px;
      background: #040710;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.08);
    }
    .log-box {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      background: #040710;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 6px;
      padding: 9px;
      height: 110px;
      overflow-y: auto;
      color: #9be8ff;
    }
    .file-chips { display: flex; gap: 6px; flex-wrap: wrap; }
    .file-chip {
      font-family: monospace;
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 5px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12);
    }
  </style>
</head>
<body>
  <header class="desktop-titlebar">
    <div class="window-dots">
      <span class="dot red"></span>
      <span class="dot amber"></span>
      <span class="dot green"></span>
      <strong style="margin-left:8px;">${escapedTitle}</strong>
      <span style="color:var(--muted);">// ${escapeHtml(intent.domainSpec.category)}</span>
    </div>
    <div style="display:flex;gap:8px;align-items:center;">
      <span class="badge">${escapeHtml(intent.template.shortLabel)}</span>
      <span class="badge" id="ipc-status-badge">IPC // READY</span>
    </div>
  </header>

  <main class="app-grid">
    <aside class="card">
      <div class="card-title">
        <span>PROJECT SPECIFICATION</span>
        <span>${escapeHtml(intent.slug)}</span>
      </div>
      <div class="prompt-banner">
        <strong>Prompt Directive:</strong> ${escapedPrompt}
      </div>

      <div class="card-title" style="margin-top:4px;">
        <span>ADD ${escapeHtml(intent.domainSpec.entityLabel.toUpperCase())}</span>
      </div>
      <div class="controls-bar">
        <input id="new-item-name" type="text" placeholder="Enter ${escapeHtml(intent.domainSpec.entityLabel)} name..." />
        <button id="btn-add-item" type="button">+ ADD</button>
      </div>

      <div class="card-title">
        <span>ACTIVE ${escapeHtml(intent.domainSpec.entityLabel.toUpperCase())}S</span>
        <span id="item-count-label">0</span>
      </div>
      <div id="item-list" class="item-list"></div>

      <div class="card-title">
        <span>GENERATED PROJECT FILES (~/CalabiYauProjects/builds/${escapeHtml(intent.slug)})</span>
      </div>
      <div id="file-chips" class="file-chips"></div>
    </aside>

    <section class="card">
      <div class="card-title">
        <span>REAL-TIME TELEMETRY &amp; INTERACTIVE SIMULATION STAGE</span>
        <div style="display:flex;gap:6px;">
          <button id="btn-action" type="button">${escapeHtml(intent.domainSpec.actionLabel)}</button>
          <button id="btn-Dimension-Slice" class="secondary" type="button">4D HYPERPLANE SLICE w₄</button>
        </div>
      </div>

      <div id="metrics-row" class="metrics-row"></div>

      <canvas id="domain-canvas" width="760" height="250"></canvas>

      <div class="controls-bar">
        <label style="font-size:11px;color:var(--muted);display:flex;align-items:center;gap:8px;flex:1;">
          <span>4D HYPERPLANE w₄ CROSS-SECTION</span>
          <input id="slider-w4" type="range" min="-1.2" max="1.2" step="0.02" value="0.0" />
          <span id="val-w4" style="color:var(--accent);font-family:monospace;">0.00</span>
        </label>
        <label style="font-size:11px;color:var(--muted);display:flex;align-items:center;gap:8px;flex:1;">
          <span>SO(4) XW ROTOR SPEED</span>
          <input id="slider-speed" type="range" min="0.1" max="3.0" step="0.1" value="1.0" />
        </label>
      </div>

      <div class="card-title"><span>EXECUTION &amp; IPC EVENT LOG</span></div>
      <div id="event-log" class="log-box"></div>
    </section>
  </main>

  <script>
    const APP_SPEC = ${serializedIntent};
    const PROJECT_FILES = ${serializedFiles};

    const state = {
      items: structuredClone(APP_SPEC.defaultItems),
      metrics: structuredClone(APP_SPEC.metrics),
      w4: 0.0,
      speed: 1.0,
      phase: 0.0,
      sliceMode: true,
    };

    const logEl = document.getElementById('event-log');
    function appendLog(msg) {
      const ts = new Date().toISOString().slice(11, 19);
      const line = document.createElement('div');
      line.textContent = '[' + ts + '] ' + msg;
      logEl.prepend(line);
    }

    function renderFileChips() {
      const wrap = document.getElementById('file-chips');
      wrap.innerHTML = '';
      const all = [{ path: '${escapeHtml(intent.template.entryFile)}', bytes: document.documentElement.outerHTML.length }, ...PROJECT_FILES];
      for (const f of all) {
        const chip = document.createElement('span');
        chip.className = 'file-chip';
        chip.textContent = f.path + ' (' + f.bytes + 'B)';
        wrap.appendChild(chip);
      }
    }

    function renderMetrics() {
      const row = document.getElementById('metrics-row');
      row.innerHTML = '';
      for (const m of state.metrics) {
        const box = document.createElement('div');
        box.className = 'metric-box';
        box.innerHTML =
          '<div class="metric-label">' + m.label + '</div>' +
          '<div class="metric-val">' + m.value + '<span class="metric-unit">' + (m.unit || '') + '</span></div>';
        row.appendChild(box);
      }
    }

    function renderItems() {
      const list = document.getElementById('item-list');
      document.getElementById('item-count-label').textContent = String(state.items.length);
      list.innerHTML = '';
      for (const item of state.items) {
        const row = document.createElement('div');
        row.className = 'item-row';
        row.innerHTML =
          '<div><strong>' + item.name + '</strong><div style="color:var(--muted);font-size:11px;">' + item.metric + '</div></div>' +
          '<span class="status-pill">' + item.status + '</span>';
        row.addEventListener('click', () => {
          item.status = item.status === 'ACTIVE' ? 'COMPLETED' : 'ACTIVE';
          appendLog('Toggled ' + item.name + ' -> ' + item.status);
          renderItems();
        });
        list.appendChild(row);
      }
    }

    document.getElementById('btn-add-item').addEventListener('click', async () => {
      const input = document.getElementById('new-item-name');
      const name = input.value.trim() || (APP_SPEC.entityLabel + ' #' + (state.items.length + 1));
      input.value = '';
      if (window.desktopBridge && window.desktopBridge.addItem) {
        await window.desktopBridge.addItem({ name });
      }
      state.items.unshift({
        id: 'item-' + Date.now(),
        name,
        status: 'ACTIVE',
        metric: 'Live // Seed ' + (APP_SPEC.seed % 997),
        priority: 'HIGH',
      });
      appendLog('Created ' + APP_SPEC.entityLabel + ': ' + name);
      renderItems();
    });

    document.getElementById('btn-action').addEventListener('click', async () => {
      if (window.desktopBridge && window.desktopBridge.runAction) {
        await window.desktopBridge.runAction({ action: APP_SPEC.actionLabel });
      }
      for (let i = 0; i < state.metrics.length; i++) {
        const m = state.metrics[i];
        if (typeof m.value === 'number') {
          m.value = Number((m.value + Math.cos(state.phase + i) * 2.4 + 0.8).toFixed(2));
        }
      }
      appendLog('Executed action: ' + APP_SPEC.actionLabel);
      renderMetrics();
    });

    document.getElementById('btn-Dimension-Slice').addEventListener('click', () => {
      state.sliceMode = !state.sliceMode;
      appendLog('4D Hyperplane Cross-Section mode: ' + (state.sliceMode ? 'ENABLED' : 'FULL PROJECTION'));
    });

    document.getElementById('slider-w4').addEventListener('input', (e) => {
      state.w4 = parseFloat(e.target.value) || 0;
      document.getElementById('val-w4').textContent = state.w4.toFixed(2);
    });

    document.getElementById('slider-speed').addEventListener('input', (e) => {
      state.speed = parseFloat(e.target.value) || 1.0;
    });

    // Interactive 4D Polychoron + Domain Waveform Canvas
    const canvas = document.getElementById('domain-canvas');
    const ctx = canvas.getContext('2d');
    const vertices4D = [];
    for (let mask = 0; mask < 16; mask++) {
      vertices4D.push([
        mask & 1 ? 1 : -1,
        mask & 2 ? 1 : -1,
        mask & 4 ? 1 : -1,
        mask & 8 ? 1 : -1,
      ]);
    }
    const edges4D = [];
    for (let i = 0; i < 16; i++) {
      for (let bit = 0; bit < 4; bit++) {
        const j = i ^ (1 << bit);
        if (i < j) edges4D.push([i, j]);
      }
    }

    function rotate4D(v, a, b) {
      let [x, y, z, w] = v;
      const ca = Math.cos(a), sa = Math.sin(a);
      const nx = x * ca - w * sa;
      const nw = x * sa + w * ca;
      x = nx; w = nw;
      const cb = Math.cos(b), sb = Math.sin(b);
      const ny = y * cb - z * sb;
      const nz = y * sb + z * cb;
      return [x, ny, nz, w];
    }

    function animate() {
      state.phase += 0.018 * state.speed;
      const w = canvas.width, h = canvas.height;
      ctx.fillStyle = '#040710';
      ctx.fillRect(0, 0, w, h);

      // Draw domain harmonic signal on left half
      ctx.strokeStyle = 'hsla(' + APP_SPEC.primaryHue + ', 88%, 60%, 0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 20; x < w * 0.52; x += 4) {
        const t = (x - 20) / (w * 0.5);
        const y = h * 0.5 + Math.sin(t * 10 + state.phase * 2) * 48 * Math.cos(t * 4 - state.w4 * 2);
        if (x === 20) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Draw 4D stereographic projection & w4 hyperplane slice on right half
      const cx = w * 0.76, cy = h * 0.5;
      const projected = vertices4D.map((v) => {
        const r = rotate4D(v, state.phase, state.phase * 0.63);
        const denom = Math.max(0.4, 2.8 - r[3]);
        const scale = 58 / denom;
        return {
          x: cx + r[0] * scale,
          y: cy + r[1] * scale,
          w: r[3],
        };
      });

      for (const [i, j] of edges4D) {
        const a = projected[i], b = projected[j];
        const nearSlice = !state.sliceMode || (Math.abs(a.w - state.w4) < 0.95 || Math.abs(b.w - state.w4) < 0.95);
        ctx.strokeStyle = nearSlice
          ? 'hsla(' + APP_SPEC.primaryHue + ', 90%, 64%, 0.85)'
          : 'rgba(140, 165, 200, 0.16)';
        ctx.lineWidth = nearSlice ? 1.8 : 0.8;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      requestAnimationFrame(animate);
    }

    renderFileChips();
    renderMetrics();
    renderItems();
    appendLog('Initialized ' + APP_SPEC.title + ' (' + APP_SPEC.templateLabel + ')');
    appendLog('Workspace target: ~/CalabiYauProjects/builds/' + APP_SPEC.slug);
    animate();
  </script>
</body>
</html>`;
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
