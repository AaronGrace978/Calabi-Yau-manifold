/**
 * Domain-Authentic Interactive Application Generators & Multi-File HTML Bundler.
 *
 * Ensures that:
 * 1. When an LLM generates HTML/CSS/JS files, they are bundled into a self-contained runnable
 *    HTML document (with local CSS & JS inlined so iframe `srcdoc` and standalone windows run the
 *    exact LLM-built app without broken relative links).
 * 2. When synthesizing an application from a prompt (or in offline/template mode), the builder
 *    produces a genuine, domain-authentic application matching what the user asked for:
 *    - Landing Page / Website / SaaS / Marketing Page -> Full multi-section responsive Landing Page
 *    - 3D / WebGL / Three.js / Object Scene (e.g. "webGL 3d Chicken nugget") -> Real 3D WebGL viewport
 *      with orbit camera, procedural 3D mesh sculpting, PBR-style lighting, and interactive controls
 *    - Audio / Synth / Music -> Playable WebAudio polyphonic synthesizer & step sequencer
 *    - Kanban / Task / Project -> Multi-column interactive Kanban board
 *    - 4D–11D Dimensional Lab -> Higher-dimensional polychoron & hyperplane slicer
 *    - General Web / Desktop / API App -> Clean interactive application workbench
 */

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Bundles an HTML entry file with any sibling CSS and JS files in `files` so that it runs
 * as a complete standalone application inside an iframe `srcdoc` or native window.
 */
export function bundlePreviewHtml(entryHtml = '', files = [], intent = null) {
  let html = String(entryHtml || '').trim();
  if (!html) return '';

  const cssFiles = files.filter((f) => /\.css$/i.test(f.path) && f.content && f.content.trim());
  const jsFiles = files.filter(
    (f) =>
      /\.(?:js|mjs)$/i.test(f.path) &&
      !/^(?:test|verify)/i.test(f.path.split('/').pop() || '') &&
      !/\.(?:test|spec)\./i.test(f.path) &&
      !/^server\.m?js$/i.test(f.path.split('/').pop() || '') &&
      !/^main\.cjs$/i.test(f.path.split('/').pop() || '') &&
      !/^preload\.cjs$/i.test(f.path.split('/').pop() || '') &&
      f.content &&
      f.content.trim()
  );

  // If the LLM returned an HTML fragment (e.g. <div>...</div> without <!DOCTYPE html> or <html>),
  // wrap it in a complete HTML5 document shell first.
  if (!/<!doctype html>|<html[\s>]/i.test(html)) {
    const title = escapeHtml(intent?.title || 'Application Preview');
    html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body>
${html}
</body>
</html>`;
  }

  const inlinedCssPaths = new Set();
  const inlinedJsPaths = new Set();

  // 1. Replace <link rel="stylesheet" href="..."> matching any file in cssFiles
  html = html.replace(/<link\b[^>]*href=["']([^"']+\.css)["'][^>]*>/gi, (fullMatch, href) => {
    const cleanHref = href.replace(/^\.?\//, '').toLowerCase();
    const found = cssFiles.find(
      (f) =>
        f.path.replace(/^\.?\//, '').toLowerCase() === cleanHref ||
        f.path.split('/').pop()?.toLowerCase() === cleanHref.split('/').pop()
    );
    if (found) {
      inlinedCssPaths.add(found.path);
      return `<style data-inlined-from="${escapeHtml(found.path)}">\n${found.content}\n</style>`;
    }
    return fullMatch;
  });

  // 2. Inject any additional CSS files produced by the LLM (e.g. styles.css) that weren't linked
  const remainingCss = cssFiles.filter((f) => !inlinedCssPaths.has(f.path) && f.FromLlm !== false);
  if (remainingCss.length > 0) {
    const styleBlock = remainingCss
      .map((f) => `<style data-bundled-from="${escapeHtml(f.path)}">\n${f.content}\n</style>`)
      .join('\n');
    if (/<\/head>/i.test(html)) {
      html = html.replace(/<\/head>/i, `${styleBlock}\n</head>`);
    } else {
      html = `${styleBlock}\n${html}`;
    }
  }

  // Helper to sanitize local relative imports when inlining browser scripts
  const prepareInlineBrowserJs = (rawJs) =>
    String(rawJs || '')
      .replace(/^\s*import\s+[^;]+from\s+['"]\.[^'"]+['"];?\s*$/gm, '// [bundled local import]')
      .replace(/^\s*export\s+default\s+/gm, 'const __defaultExport = ')
      .replace(/^\s*export\s+(?=(?:const|let|var|function|class|async)\b)/gm, '');

  // 3. Replace <script ... src="..."></script> matching any file in jsFiles
  html = html.replace(
    /<script\b([^>]*)src=["']([^"']+\.m?js)["']([^>]*)>\s*<\/script>/gi,
    (fullMatch, preAttrs, src, postAttrs) => {
      if (/^https?:\/\/|^\/\//i.test(src)) return fullMatch;
      const cleanSrc = src.replace(/^\.?\//, '').toLowerCase();
      const found = jsFiles.find(
        (f) =>
          f.path.replace(/^\.?\//, '').toLowerCase() === cleanSrc ||
          f.path.split('/').pop()?.toLowerCase() === cleanSrc.split('/').pop()
      );
      if (found) {
        inlinedJsPaths.add(found.path);
        const isMod = /type=["']module["']/i.test(preAttrs + postAttrs);
        return `<script${isMod ? ' type="module"' : ''} data-inlined-from="${escapeHtml(found.path)}">\n${prepareInlineBrowserJs(found.content)}\n</script>`;
      }
      return fullMatch;
    }
  );

  // 4. Inject any additional LLM-emitted browser JS files (e.g. app.js, script.js, main.js) that weren't linked
  const remainingLlmJs = jsFiles.filter(
    (f) =>
      !inlinedJsPaths.has(f.path) &&
      f.fromLlm === true &&
      !/node:fs|node:http|require\(['"]electron['"]\)/i.test(f.content)
  );
  if (remainingLlmJs.length > 0) {
    const scriptBlock = remainingLlmJs
      .map(
        (f) =>
          `<script type="module" data-bundled-from="${escapeHtml(f.path)}">\n${prepareInlineBrowserJs(f.content)}\n</script>`
      )
      .join('\n');
    if (/<\/body>/i.test(html)) {
      html = html.replace(/<\/body>/i, `${scriptBlock}\n</body>`);
    } else {
      html = `${html}\n${scriptBlock}`;
    }
  }

  return html;
}

/**
 * Generates a complete, modern, responsive Marketing / SaaS / Product Landing Page.
 * Used when the user asks for a landing page, website, homepage, portfolio, or product launch page.
 */
export function buildLandingPageAppHtml(intent, files = []) {
  const lower = intent.prompt.toLowerCase();
  const isCalabiBrand = /calabi[-\s]?yau/i.test(intent.prompt);

  // Determine the brand/product name from the prompt
  let brandName = intent.title
    .replace(/\b(?:Landing|Page|Website|Webpage|Homepage|Buddy|Template|Modern)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!brandName || brandName.length < 2) {
    brandName = isCalabiBrand ? 'Calabi-Yau AI Platform' : 'NovaPulse Studio';
  }

  const tagline = isCalabiBrand
    ? 'Multi-Model Neural Telemetry, Higher-Dimensional Geometry & Autonomous Application Synthesis'
    : `Next-Generation ${brandName} Platform Built for High-Velocity Teams`;

  const subheadline = isCalabiBrand
    ? 'Stream real-time inference trajectories onto Calabi-Yau manifolds, verify topological invariants with Merkle proof certificates, and synthesize full multi-file applications in one unified workstation.'
    : `Design, deploy, and scale your ${brandName.toLowerCase()} workflows with sub-millisecond responsiveness, automated quality guardrails, and real-time analytics.`;

  const features = isCalabiBrand
    ? [
        {
          tag: 'CORE ENGINE',
          title: 'Calabi-Yau Spectral Manifold Viewport',
          desc: 'Project live token timing & entropy streams onto n² sheets of z₁ⁿ + z₂ⁿ = 1 and 4D–11D polytopes at 60 FPS.',
        },
        {
          tag: 'BUILDER',
          title: 'Autonomous Multi-File App Architect',
          desc: 'Compile prompts into multi-file Web, Electron, Tauri/Rust, Python, and WebGL applications with self-healing checks.',
        },
        {
          tag: 'VERIFICATION',
          title: 'Merkle Proof-Carrying Certificates',
          desc: 'Every build and reasoning run is sealed with Vietoris-Rips persistent homology (H₀/H₁) and SHA-256 Merkle proofs.',
        },
        {
          tag: 'SWARM',
          title: 'Multi-Provider Swarm Lanes',
          desc: 'Benchmark Ollama Cloud, Anthropic Claude, OpenAI, Gemini, DeepSeek, and Grok side-by-side with Fisher-Rao metrics.',
        },
        {
          tag: 'HARDWARE',
          title: 'Adaptive GPU Quality Governor',
          desc: 'Auto-tunes WebGL shaders and geometry density across RTX 5060 Ti, Dell G15 RTX 4060, and Steam Deck OLED.',
        },
        {
          tag: 'SECURITY',
          title: 'Guarded Workspace Sandbox',
          desc: 'Rust path & command guardrails isolate every synthesized project safely inside ~/CalabiYauProjects/builds/.',
        },
      ]
    : [
        {
          tag: 'SPEED',
          title: 'Instant Edge Deployment',
          desc: `Launch ${brandName} environments globally in under 50ms with zero-config scaling and live preview links.`,
        },
        {
          tag: 'DESIGN',
          title: 'Composable Design System',
          desc: 'Responsive glassmorphic components, dark-first accessibility, and real-time theme customization out of the box.',
        },
        {
          tag: 'ANALYTICS',
          title: 'Real-Time Conversion Telemetry',
          desc: 'Track visitor engagement, funnel velocity, and cohort retention with privacy-first streaming metrics.',
        },
        {
          tag: 'AUTOMATION',
          title: 'AI Copy & Layout Buddy',
          desc: 'Iterate on headlines, value propositions, and pricing tiers live inside the interactive page customizer.',
        },
        {
          tag: 'INTEGRATIONS',
          title: 'One-Click API & Webhook Sync',
          desc: 'Connect your existing stack with typed REST endpoints, instant webhooks, and automated schema validation.',
        },
        {
          tag: 'RELIABILITY',
          title: '99.99% Verified Uptime SLA',
          desc: 'Multi-region failover, automated health checks, and cryptographic build verification on every release.',
        },
      ];

  const serializedConfig = JSON.stringify({
    brandName,
    tagline,
    subheadline,
    prompt: intent.prompt,
    slug: intent.slug,
    primaryHue: intent.primaryHue,
    secondaryHue: intent.secondaryHue,
    features,
    files: files.map((f) => f.path),
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(brandName)} — Official Landing Page</title>
  <style>
    :root {
      --hue: ${intent.primaryHue};
      --hue2: ${intent.secondaryHue};
      --bg: #050811;
      --surface: rgba(13, 20, 36, 0.78);
      --border: hsla(var(--hue), 85%, 62%, 0.24);
      --accent: hsl(var(--hue), 92%, 62%);
      --accent2: hsl(var(--hue2), 88%, 60%);
      --text: #f2f6ff;
      --muted: #94a8c9;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background:
        radial-gradient(circle at 18% 12%, hsla(var(--hue), 85%, 24%, 0.38), transparent 48%),
        radial-gradient(circle at 82% 28%, hsla(var(--hue2), 85%, 20%, 0.34), transparent 52%),
        var(--bg);
      color: var(--text);
      line-height: 1.6;
      min-height: 100vh;
    }
    a { color: inherit; text-decoration: none; }
    .container { max-width: 1160px; margin: 0 auto; padding: 0 24px; }

    /* Sticky Navbar */
    .navbar {
      position: sticky;
      top: 0;
      z-index: 50;
      backdrop-filter: blur(16px);
      background: rgba(5, 8, 17, 0.82);
      border-bottom: 1px solid var(--border);
    }
    .nav-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 68px;
      gap: 16px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 800;
      font-size: 17px;
      letter-spacing: -0.02em;
    }
    .brand-orb {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      box-shadow: 0 0 18px hsla(var(--hue), 90%, 60%, 0.55);
    }
    .nav-links {
      display: flex;
      gap: 26px;
      font-size: 14px;
      color: var(--muted);
    }
    .nav-links a:hover { color: var(--text); }
    @media (max-width: 760px) { .nav-links { display: none; } }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 20px;
      border-radius: 999px;
      font-weight: 700;
      font-size: 13px;
      border: 1px solid transparent;
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
    }
    .btn:hover { transform: translateY(-1px); }
    .btn-primary {
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      color: #04070f;
      box-shadow: 0 8px 26px hsla(var(--hue), 90%, 55%, 0.35);
    }
    .btn-outline {
      background: rgba(255, 255, 255, 0.05);
      color: var(--text);
      border-color: var(--border);
    }

    /* Hero Section */
    .hero {
      padding: 76px 0 56px;
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 40px;
      align-items: center;
    }
    @media (max-width: 920px) {
      .hero { grid-template-columns: 1fr; padding: 48px 0 36px; }
    }
    .pill-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border-radius: 999px;
      background: hsla(var(--hue), 90%, 55%, 0.12);
      border: 1px solid var(--border);
      color: var(--accent);
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 20px;
    }
    .hero h1 {
      font-size: clamp(34px, 4.5vw, 54px);
      font-weight: 800;
      line-height: 1.08;
      letter-spacing: -0.03em;
      margin-bottom: 18px;
    }
    .gradient-span {
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .hero p.lead {
      font-size: 17px;
      color: var(--muted);
      margin-bottom: 28px;
      max-width: 600px;
    }
    .hero-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 26px;
    }
    .waitlist-bar {
      display: flex;
      gap: 8px;
      max-width: 460px;
      background: rgba(255, 255, 255, 0.04);
      padding: 6px;
      border-radius: 999px;
      border: 1px solid var(--border);
    }
    .waitlist-bar input {
      flex: 1;
      background: transparent;
      border: none;
      color: var(--text);
      padding: 8px 14px;
      font-size: 13px;
      outline: none;
    }

    /* Interactive Hero Visual Card */
    .hero-showcase {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 18px;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
    }
    .showcase-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      font-size: 12px;
      color: var(--muted);
    }
    .dots { display: flex; gap: 6px; }
    .dots span { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    #hero-canvas {
      width: 100%;
      height: 220px;
      border-radius: 12px;
      background: #04070f;
      border: 1px solid rgba(255, 255, 255, 0.08);
      display: block;
    }
    .showcase-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-top: 12px;
    }
    .mini-stat {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 10px;
      padding: 10px;
      text-align: center;
    }
    .mini-stat strong { display: block; font-size: 18px; color: var(--accent); }
    .mini-stat span { font-size: 11px; color: var(--muted); }

    /* Social Proof Metrics Strip */
    .metrics-strip {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      padding: 28px;
      margin: 20px 0 64px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      text-align: center;
    }
    @media (max-width: 720px) { .metrics-strip { grid-template-columns: repeat(2, 1fr); } }
    .strip-num { font-size: 28px; font-weight: 800; color: var(--accent); }
    .strip-label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }

    /* Features Bento Grid */
    .section-head {
      text-align: center;
      max-width: 680px;
      margin: 0 auto 36px;
    }
    .section-head h2 { font-size: 32px; font-weight: 800; margin-bottom: 10px; }
    .section-head p { color: var(--muted); font-size: 15px; }
    .filter-row {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-bottom: 28px;
      flex-wrap: wrap;
    }
    .filter-btn {
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 12px;
      background: rgba(255, 255, 255, 0.05);
      color: var(--muted);
      border: 1px solid rgba(255, 255, 255, 0.1);
      cursor: pointer;
    }
    .filter-btn.active {
      background: hsla(var(--hue), 90%, 55%, 0.18);
      color: var(--accent);
      border-color: var(--accent);
    }
    .bento-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 18px;
      margin-bottom: 72px;
    }
    @media (max-width: 900px) { .bento-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 600px) { .bento-grid { grid-template-columns: 1fr; } }
    .feature-card {
      background: var(--surface);
      border: 1px solid rgba(255, 255, 255, 0.09);
      border-radius: 16px;
      padding: 24px;
      transition: transform 0.18s ease, border-color 0.18s ease;
    }
    .feature-card:hover {
      transform: translateY(-4px);
      border-color: var(--accent);
    }
    .feature-tag {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      padding: 3px 9px;
      border-radius: 999px;
      background: hsla(var(--hue), 85%, 55%, 0.15);
      color: var(--accent);
      margin-bottom: 12px;
    }
    .feature-card h3 { font-size: 18px; margin-bottom: 8px; }
    .feature-card p { font-size: 13.5px; color: var(--muted); }

    /* Interactive Pricing Section */
    .billing-toggle {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 12px;
      margin-bottom: 32px;
      font-size: 14px;
    }
    .pricing-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 72px;
    }
    @media (max-width: 860px) { .pricing-grid { grid-template-columns: 1fr; } }
    .price-card {
      background: var(--surface);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 18px;
      padding: 28px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .price-card.popular {
      border-color: var(--accent);
      box-shadow: 0 0 36px hsla(var(--hue), 90%, 55%, 0.18);
    }
    .price-amount { font-size: 38px; font-weight: 800; }
    .price-amount span { font-size: 14px; color: var(--muted); font-weight: 400; }
    .price-list { list-style: none; display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: var(--muted); flex: 1; }
    .price-list li::before { content: "✓ "; color: var(--accent); font-weight: 700; }

    /* FAQ Accordion */
    .faq-list { max-width: 780px; margin: 0 auto 72px; display: flex; flex-direction: column; gap: 12px; }
    details.faq-item {
      background: var(--surface);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 16px 20px;
    }
    details.faq-item summary {
      cursor: pointer;
      font-weight: 700;
      font-size: 15px;
      list-style: none;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    details.faq-item p { margin-top: 10px; font-size: 14px; color: var(--muted); }

    /* Landing Page Buddy Live Customizer Bar */
    .buddy-bar {
      position: fixed;
      bottom: 16px;
      right: 16px;
      z-index: 60;
      background: rgba(8, 13, 26, 0.95);
      border: 1px solid var(--accent);
      border-radius: 14px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 12px 34px rgba(0, 0, 0, 0.65);
      font-size: 12px;
    }
    .buddy-bar input {
      background: rgba(255, 255, 255, 0.07);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 12px;
      width: 180px;
    }
    .toast {
      position: fixed;
      top: 82px;
      right: 24px;
      z-index: 80;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      color: #04070e;
      font-weight: 700;
      padding: 10px 18px;
      border-radius: 10px;
      font-size: 13px;
      display: none;
    }
    footer {
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      padding: 36px 0 80px;
      text-align: center;
      font-size: 13px;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <div id="toast" class="toast"></div>

  <nav class="navbar">
    <div class="container nav-inner">
      <a href="#" class="brand">
        <span class="brand-orb"></span>
        <span id="nav-brand-name">${escapeHtml(brandName)}</span>
      </a>
      <div class="nav-links">
        <a href="#features">Features</a>
        <a href="#pricing">Pricing</a>
        <a href="#faq">FAQ</a>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <button id="btn-theme-cycle" class="btn btn-outline" type="button">Theme Palette</button>
        <a href="#pricing" class="btn btn-primary">Get Started</a>
      </div>
    </div>
  </nav>

  <div class="container">
    <section class="hero">
      <div>
        <div class="pill-badge">
          <span>● LIVE RELEASE</span>
          <span>//</span>
          <span>${escapeHtml(brandName.toUpperCase())} 2.0</span>
        </div>
        <h1 id="hero-headline">
          <span class="gradient-span">${escapeHtml(brandName)}</span> — ${escapeHtml(tagline)}
        </h1>
        <p class="lead" id="hero-subheadline">${escapeHtml(subheadline)}</p>

        <div class="hero-actions">
          <button id="btn-hero-launch" class="btn btn-primary" type="button">Start Building Free →</button>
          <a href="#features" class="btn btn-outline">Explore Architecture</a>
        </div>

        <form id="waitlist-form" class="waitlist-bar">
          <input id="waitlist-email" type="email" placeholder="Enter your work email for instant access..." required />
          <button class="btn btn-primary" type="submit">Join Live Access</button>
        </form>
      </div>

      <div class="hero-showcase">
        <div class="showcase-top">
          <div class="dots">
            <span style="background:#ff5f57;"></span>
            <span style="background:#febc2e;"></span>
            <span style="background:#28c840;"></span>
          </div>
          <span>INTERACTIVE LIVE PREVIEW // 60 FPS</span>
        </div>
        <canvas id="hero-canvas" width="520" height="220"></canvas>
        <div class="showcase-stats">
          <div class="mini-stat"><strong id="stat-latency">1.4 ms</strong><span>Edge Latency</span></div>
          <div class="mini-stat"><strong id="stat-fps">60 FPS</strong><span>WebGL Telemetry</span></div>
          <div class="mini-stat"><strong>99.99%</strong><span>Verified SLA</span></div>
        </div>
      </div>
    </section>

    <section class="metrics-strip">
      <div>
        <div class="strip-num">14.2k+</div>
        <div class="strip-label">Active Builders</div>
      </div>
      <div>
        <div class="strip-num">&lt; 1.8ms</div>
        <div class="strip-label">Stream Response</div>
      </div>
      <div>
        <div class="strip-num">100%</div>
        <div class="strip-label">Merkle Proof Sealed</div>
      </div>
      <div>
        <div class="strip-num">24/7</div>
        <div class="strip-label">Autonomous Guardrails</div>
      </div>
    </section>

    <section id="features">
      <div class="section-head">
        <h2>Engineered for Speed, Clarity &amp; Verification</h2>
        <p>Everything you need to go from natural-language concept to verified production deployment.</p>
      </div>
      <div id="feature-filters" class="filter-row"></div>
      <div id="bento-grid" class="bento-grid"></div>
    </section>

    <section id="pricing">
      <div class="section-head">
        <h2>Simple, Transparent Pricing</h2>
        <p>Start free and scale as your team and compute requirements grow.</p>
      </div>
      <div class="billing-toggle">
        <span>Monthly Billing</span>
        <button id="btn-billing-toggle" class="btn btn-outline" type="button">Switch to Annual (Save 20%)</button>
      </div>
      <div class="pricing-grid">
        <div class="price-card">
          <div class="feature-tag">STARTER</div>
          <h3>Developer</h3>
          <div class="price-amount" data-monthly="$0" data-annual="$0">$0 <span>/ forever</span></div>
          <ul class="price-list">
            <li>Unlimited local multi-file builds</li>
            <li>Interactive 3D &amp; WebGL preview sandbox</li>
            <li>Local Ollama &amp; custom API key support</li>
          </ul>
          <button class="btn btn-outline plan-select-btn" data-plan="Starter" type="button">Deploy Free</button>
        </div>
        <div class="price-card popular">
          <div class="feature-tag">MOST POPULAR</div>
          <h3>Pro Studio</h3>
          <div class="price-amount" id="price-pro">$29 <span>/ month</span></div>
          <ul class="price-list">
            <li>Multi-lane Swarm benchmarking</li>
            <li>Cryptographic Merkle proof certificates</li>
            <li>Priority cloud model routing &amp; exports</li>
            <li>Custom domain &amp; one-click bundles</li>
          </ul>
          <button class="btn btn-primary plan-select-btn" data-plan="Pro Studio" type="button">Start 14-Day Free Trial</button>
        </div>
        <div class="price-card">
          <div class="feature-tag">ENTERPRISE</div>
          <h3>Frontier Lab</h3>
          <div class="price-amount" id="price-ent">$99 <span>/ month</span></div>
          <ul class="price-list">
            <li>Dedicated GPU cluster &amp; SSO</li>
            <li>Custom guardrail policies &amp; audit logs</li>
            <li>24/7 engineering SLA &amp; onboarding</li>
          </ul>
          <button class="btn btn-outline plan-select-btn" data-plan="Frontier Lab" type="button">Contact Architecture Team</button>
        </div>
      </div>
    </section>

    <section id="faq">
      <div class="section-head">
        <h2>Frequently Asked Questions</h2>
        <p>Quick answers about architecture, customization, and deployment.</p>
      </div>
      <div class="faq-list">
        <details class="faq-item" open>
          <summary><span>How do I customize this landing page live?</span><span>+</span></summary>
          <p>Use the <strong>Landing Page Buddy</strong> bar in the bottom-right corner to edit the brand headline, switch color palettes, or export the complete self-contained HTML bundle.</p>
        </details>
        <details class="faq-item">
          <summary><span>Can I export and host this page anywhere?</span><span>+</span></summary>
          <p>Yes. Every build in <code>~/CalabiYauProjects/builds/${escapeHtml(intent.slug)}</code> is standard HTML5, CSS3, and ES module JavaScript with zero external lock-in.</p>
        </details>
        <details class="faq-item">
          <summary><span>Does it support responsive mobile and desktop layouts?</span><span>+</span></summary>
          <p>Yes — the CSS grid system automatically adapts from ultrawide desktop monitors down to tablet and mobile viewports.</p>
        </details>
      </div>
    </section>
  </div>

  <div class="buddy-bar">
    <strong style="color:var(--accent);">LANDING BUDDY:</strong>
    <input id="buddy-headline-input" type="text" placeholder="Live-edit hero headline..." />
    <button id="btn-buddy-apply" class="btn btn-primary" style="padding:6px 12px;" type="button">Apply</button>
  </div>

  <footer>
    <div class="container">
      © ${new Date().getFullYear()} ${escapeHtml(brandName)}. Built with Calabi-Yau Autonomous Multi-File Application Architect (${escapeHtml(intent.slug)}).
    </div>
  </footer>

  <script>
    const CONFIG = ${serializedConfig};
    let annualBilling = false;
    let activeTag = 'ALL';
    let hueOffset = 0;

    function showToast(msg) {
      const el = document.getElementById('toast');
      el.textContent = msg;
      el.style.display = 'block';
      clearTimeout(window.__toastTimer);
      window.__toastTimer = setTimeout(() => { el.style.display = 'none'; }, 2800);
    }

    function renderFeatures() {
      const filtersEl = document.getElementById('feature-filters');
      const gridEl = document.getElementById('bento-grid');
      const tags = ['ALL', ...new Set(CONFIG.features.map((f) => f.tag))];

      filtersEl.innerHTML = '';
      for (const t of tags) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'filter-btn' + (t === activeTag ? ' active' : '');
        b.textContent = t;
        b.addEventListener('click', () => {
          activeTag = t;
          renderFeatures();
        });
        filtersEl.appendChild(b);
      }

      gridEl.innerHTML = '';
      const visible = activeTag === 'ALL' ? CONFIG.features : CONFIG.features.filter((f) => f.tag === activeTag);
      for (const f of visible) {
        const card = document.createElement('div');
        card.className = 'feature-card';
        card.innerHTML =
          '<span class="feature-tag">' + f.tag + '</span>' +
          '<h3>' + f.title + '</h3>' +
          '<p>' + f.desc + '</p>';
        gridEl.appendChild(card);
      }
    }

    document.getElementById('btn-billing-toggle').addEventListener('click', (e) => {
      annualBilling = !annualBilling;
      e.target.textContent = annualBilling ? 'Annual Billing Active (20% Off)' : 'Switch to Annual (Save 20%)';
      document.getElementById('price-pro').innerHTML = (annualBilling ? '$23' : '$29') + ' <span>/ month</span>';
      document.getElementById('price-ent').innerHTML = (annualBilling ? '$79' : '$99') + ' <span>/ month</span>';
      showToast(annualBilling ? 'Switched to Annual Billing (20% savings applied)' : 'Switched to Monthly Billing');
    });

    document.querySelectorAll('.plan-select-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        showToast('Selected ' + btn.dataset.plan + ' plan — workspace provisioning ready!');
      });
    });

    document.getElementById('waitlist-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('waitlist-email').value.trim();
      if (email) {
        showToast('Instant access link sent to ' + email + '!');
        document.getElementById('waitlist-email').value = '';
      }
    });

    document.getElementById('btn-hero-launch').addEventListener('click', () => {
      showToast('Launching ' + CONFIG.brandName + ' interactive workspace...');
      document.getElementById('features').scrollIntoView({ behavior: 'smooth' });
    });

    document.getElementById('btn-theme-cycle').addEventListener('click', () => {
      hueOffset = (hueOffset + 55) % 360;
      document.documentElement.style.setProperty('--hue', String((CONFIG.primaryHue + hueOffset) % 360));
      document.documentElement.style.setProperty('--hue2', String((CONFIG.secondaryHue + hueOffset) % 360));
      showToast('Updated landing page color theme');
    });

    document.getElementById('btn-buddy-apply').addEventListener('click', () => {
      const val = document.getElementById('buddy-headline-input').value.trim();
      if (val) {
        document.getElementById('hero-headline').textContent = val;
        document.getElementById('buddy-headline-input').value = '';
        showToast('Hero headline updated live!');
      }
    });

    // Interactive Hero Canvas Animation
    const canvas = document.getElementById('hero-canvas');
    const ctx = canvas.getContext('2d');
    let t = 0;
    function animateHero() {
      t += 0.025;
      const w = canvas.width, h = canvas.height;
      ctx.fillStyle = '#04070f';
      ctx.fillRect(0, 0, w, h);

      const hue = (CONFIG.primaryHue + hueOffset) % 360;
      const cx = w * 0.5, cy = h * 0.5;

      // Draw animated orbital rings & spectral wave
      for (let ring = 0; ring < 5; ring++) {
        ctx.strokeStyle = 'hsla(' + ((hue + ring * 24) % 360) + ', 90%, 62%, ' + (0.65 - ring * 0.1) + ')';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let a = 0; a <= Math.PI * 2 + 0.05; a += 0.08) {
          const rad = 36 + ring * 14 + Math.sin(a * 4 + t * (1.2 + ring * 0.2)) * 8;
          const x = cx + Math.cos(a + t * 0.3) * rad * 1.45;
          const y = cy + Math.sin(a - t * 0.2) * rad * 0.72;
          if (a === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      requestAnimationFrame(animateHero);
    }

    renderFeatures();
    animateHero();
  </script>
</body>
</html>`;
}

/**
 * Generates an interactive 3D WebGL / Procedural Mesh & Shader Studio.
 * Tailors the 3D geometry & surface material to the user's exact prompt — e.g., if the user
 * asks for a "webGL 3d Chicken nugget", it sculpts a golden-brown crispy bump-mapped 3D nugget
 * with orbit camera controls, glaze/sauce presets, bite physics, and crumb particles!
 */
export function buildWebgl3DSceneAppHtml(intent, files = []) {
  const lower = intent.prompt.toLowerCase();
  let meshPreset = 'crystal';
  if (/nugget|chicken|food|potato|cookie|bread|crispy|tender|croquette/.test(lower)) {
    meshPreset = 'nugget';
  } else if (/ship|spaceship|rocket|craft|fighter|mech|car|vehicle/.test(lower)) {
    meshPreset = 'spaceship';
  } else if (/planet|earth|globe|moon|star|asteroid|sphere|orb/.test(lower)) {
    meshPreset = 'planet';
  } else if (/donut|torus|ring|knot/.test(lower)) {
    meshPreset = 'torus';
  }

  const presetConfig = {
    nugget: {
      objectLabel: '3D Crispy Chicken Nugget Mesh',
      bumpLabel: 'Crispy Breading Bump',
      colorModes: [
        { name: 'Classic Golden Fry', base: [218, 142, 46], rim: [255, 205, 110], spec: 0.35 },
        { name: 'Honey Mustard Glaze', base: [230, 175, 42], rim: [255, 232, 130], spec: 0.68 },
        { name: 'Sweet Smoky BBQ', base: [138, 48, 24], rim: [235, 110, 65], spec: 0.74 },
        { name: 'Spicy Buffalo', base: [215, 68, 22], rim: [255, 155, 80], spec: 0.62 },
        { name: 'Cyber Chrome Nugget', base: [70, 210, 255], rim: [235, 95, 255], spec: 0.95 },
      ],
    },
    spaceship: {
      objectLabel: '3D Orbital Interceptor Hull',
      bumpLabel: 'Hull Panel Displacement',
      colorModes: [
        { name: 'Titanium Stealth', base: [90, 130, 175], rim: [0, 243, 255], spec: 0.85 },
        { name: 'Solar Gold Shield', base: [220, 165, 55], rim: [255, 230, 140], spec: 0.9 },
        { name: 'Crimson Valkyrie', base: [195, 45, 70], rim: [255, 130, 160], spec: 0.8 },
      ],
    },
    planet: {
      objectLabel: '3D Procedural Exoplanet',
      bumpLabel: 'Terrain Elevation',
      colorModes: [
        { name: 'Oceanic Biosphere', base: [42, 135, 210], rim: [110, 245, 195], spec: 0.6 },
        { name: 'Volcanic Magma', base: [195, 62, 28], rim: [255, 190, 70], spec: 0.5 },
        { name: 'Ice Giant', base: [85, 195, 235], rim: [200, 245, 255], spec: 0.85 },
      ],
    },
    torus: {
      objectLabel: '3D Parametric Torus Manifold',
      bumpLabel: 'Harmonic Ripple',
      colorModes: [
        { name: 'Iridescent Plasma', base: [60, 190, 245], rim: [240, 90, 210], spec: 0.88 },
        { name: 'Glazed Donut', base: [215, 140, 65], rim: [255, 145, 200], spec: 0.72 },
      ],
    },
    crystal: {
      objectLabel: `3D ${intent.title} Mesh`,
      bumpLabel: 'Surface Displacement',
      colorModes: [
        { name: 'Quantum Cyan', base: [45, 195, 240], rim: [195, 90, 250], spec: 0.85 },
        { name: 'Emerald Lattice', base: [40, 205, 130], rim: [160, 255, 210], spec: 0.8 },
        { name: 'Solar Amber', base: [230, 150, 45], rim: [255, 220, 130], spec: 0.75 },
      ],
    },
  }[meshPreset];

  const serialized3D = JSON.stringify({
    title: intent.title,
    slug: intent.slug,
    prompt: intent.prompt,
    meshPreset,
    presetConfig,
    files: files.map((f) => f.path),
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(intent.title)} — 3D WebGL Studio</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #050811;
      color: #f0f6ff;
      height: 100vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 18px;
      background: rgba(8, 13, 25, 0.92);
      border-bottom: 1px solid rgba(0, 243, 255, 0.22);
      z-index: 10;
    }
    .title-group { display: flex; align-items: center; gap: 10px; font-size: 13px; }
    .badge {
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      background: rgba(0, 243, 255, 0.14);
      color: #00f3ff;
      border: 1px solid rgba(0, 243, 255, 0.35);
    }
    .studio-body {
      position: relative;
      flex: 1;
      display: flex;
      overflow: hidden;
    }
    canvas#viewport-3d {
      width: 100%;
      height: 100%;
      display: block;
      cursor: grab;
      background: radial-gradient(circle at 50% 42%, #131d36 0%, #050811 72%);
    }
    canvas#viewport-3d:active { cursor: grabbing; }
    .hud-panel {
      position: absolute;
      top: 16px;
      left: 16px;
      width: 300px;
      background: rgba(8, 13, 26, 0.86);
      backdrop-filter: blur(14px);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 14px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      font-size: 12px;
    }
    .hud-title {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: #00f3ff;
      text-transform: uppercase;
      display: flex;
      justify-content: space-between;
    }
    .control-group { display: flex; flex-direction: column; gap: 5px; }
    .control-group label {
      display: flex;
      justify-content: space-between;
      color: #9bb0d1;
      font-size: 11px;
    }
    input[type="range"], select {
      width: 100%;
      background: rgba(5, 9, 18, 0.9);
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.18);
      padding: 6px 8px;
      border-radius: 6px;
      font-size: 12px;
    }
    .btn-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    button {
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid rgba(0, 243, 255, 0.35);
      background: rgba(0, 243, 255, 0.15);
      color: #e9f6ff;
      font-weight: 700;
      font-size: 11px;
      cursor: pointer;
    }
    button:hover { background: rgba(0, 243, 255, 0.28); }
    button.primary {
      background: linear-gradient(135deg, #ffb347, #ff6b35);
      color: #090604;
      border: none;
    }
    .hint-pill {
      position: absolute;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(8, 13, 26, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.14);
      padding: 7px 16px;
      border-radius: 999px;
      font-size: 12px;
      color: #a9bede;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="title-group">
      <strong>${escapeHtml(intent.title)}</strong>
      <span style="color:#8da4c8;">// ${escapeHtml(presetConfig.objectLabel)}</span>
    </div>
    <div style="display:flex;gap:8px;align-items:center;">
      <span class="badge" id="poly-badge">MESH // 3D ACTIVE</span>
      <span class="badge" id="fps-badge">60 FPS</span>
    </div>
  </header>

  <div class="studio-body">
    <canvas id="viewport-3d"></canvas>

    <aside class="hud-panel">
      <div class="hud-title">
        <span>3D SCENE CONTROLS</span>
        <span>WEBGL STUDIO</span>
      </div>

      <div class="control-group">
        <label><span>Surface Material / Glaze</span></label>
        <select id="select-material"></select>
      </div>

      <div class="control-group">
        <label>
          <span>${escapeHtml(presetConfig.bumpLabel)}</span>
          <span id="val-bump">0.38</span>
        </label>
        <input id="slider-bump" type="range" min="0.0" max="0.85" step="0.02" value="0.38" />
      </div>

      <div class="control-group">
        <label>
          <span>Mesh Subdivision Detail</span>
          <span id="val-subdiv">28</span>
        </label>
        <input id="slider-subdiv" type="range" min="14" max="42" step="2" value="28" />
      </div>

      <div class="control-group">
        <label>
          <span>Key Light Angle</span>
          <span id="val-light">45°</span>
        </label>
        <input id="slider-light" type="range" min="0" max="360" step="5" value="45" />
      </div>

      <div class="btn-row">
        <button id="btn-bite" class="primary" type="button">
          ${meshPreset === 'nugget' ? 'Take a Bite!' : 'Pulse Geometry'}
        </button>
        <button id="btn-wireframe" type="button">Wireframe: OFF</button>
      </div>
      <div class="btn-row">
        <button id="btn-spin" type="button">Auto-Spin: ON</button>
        <button id="btn-reset-cam" type="button">Reset Camera</button>
      </div>
    </aside>

    <div class="hint-pill">Drag to Orbit 360° · Scroll to Zoom · Real-Time 3D Shaded Mesh</div>
  </div>

  <script>
    const SCENE = ${serialized3D};
    const canvas = document.getElementById('viewport-3d');
    const ctx = canvas.getContext('2d');

    const state = {
      rotX: -0.32,
      rotY: 0.65,
      zoom: 1.0,
      autoSpin: true,
      wireframe: false,
      bump: 0.38,
      subdiv: 28,
      lightDeg: 45,
      materialIdx: 0,
      biteCount: 0,
      bounceScale: 1.0,
      bounceVel: 0.0,
      dragging: false,
      lastX: 0,
      lastY: 0,
    };

    const matSelect = document.getElementById('select-material');
    SCENE.presetConfig.colorModes.forEach((m, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent = m.name;
      matSelect.appendChild(opt);
    });
    matSelect.addEventListener('change', (e) => {
      state.materialIdx = Number(e.target.value) || 0;
    });

    function resize() {
      canvas.width = canvas.clientWidth * Math.min(window.devicePixelRatio || 1, 2);
      canvas.height = canvas.clientHeight * Math.min(window.devicePixelRatio || 1, 2);
    }
    window.addEventListener('resize', resize);
    resize();

    // 3D Fractal / Crumb Noise for authentic organic crispy surface
    function hash3(x, y, z) {
      const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
      return n - Math.floor(n);
    }
    function fbm3(x, y, z) {
      let v = 0, amp = 0.5, freq = 2.2;
      for (let i = 0; i < 4; i++) {
        v += amp * (Math.sin(x * freq + Math.cos(y * freq * 1.1)) * Math.cos(z * freq - Math.sin(x * freq * 0.7)));
        freq *= 2.05;
        amp *= 0.5;
      }
      return v;
    }

    let mesh = { vertices: [], faces: [] };

    function rebuildMesh() {
      const latSteps = state.subdiv;
      const lonSteps = state.subdiv * 2;
      const verts = [];
      const faces = [];

      for (let i = 0; i <= latSteps; i++) {
        const v = i / latSteps;
        const theta = v * Math.PI;
        for (let j = 0; j <= lonSteps; j++) {
          const u = j / lonSteps;
          const phi = u * Math.PI * 2;

          let x = Math.sin(theta) * Math.cos(phi);
          let y = Math.cos(theta);
          let z = Math.sin(theta) * Math.sin(phi);

          if (SCENE.meshPreset === 'nugget') {
            // Classic boot/pebble chicken nugget proportions: wider, flatter, slightly asymmetric boot curve
            x *= 1.38 + 0.16 * Math.sin(theta * 2.0) * Math.cos(phi);
            y *= 0.96 + 0.12 * Math.cos(phi * 2.0);
            z *= 0.62 + 0.08 * Math.sin(theta * 3.0);
            if (y < 0) x += 0.18 * (-y); // subtle boot-nugget toe curve
            const crumb = fbm3(x * 2.4, y * 2.4, z * 2.4) * state.bump;
            const s = 1 + crumb * 0.42;
            x *= s; y *= s; z *= s;

            // Optional bite cutouts
            if (state.biteCount > 0) {
              const bx = 0.95, by = 0.55, bz = 0.0;
              const d = Math.hypot(x - bx, y - by, z - bz);
              if (d < 0.72) {
                const push = (0.72 - d) * 0.85;
                x -= push * 0.9;
                y -= push * 0.6;
              }
            }
          } else if (SCENE.meshPreset === 'spaceship') {
            x *= 1.65 * (1 - 0.35 * v);
            y *= 1.2;
            z *= 0.42 + 0.35 * Math.pow(Math.abs(Math.sin(phi)), 2);
            const panel = fbm3(x * 3, y * 3, z * 3) * state.bump * 0.25;
            x *= 1 + panel; y *= 1 + panel; z *= 1 + panel;
          } else if (SCENE.meshPreset === 'torus') {
            const R = 1.05, r = 0.44 + fbm3(x * 2, y * 2, z * 2) * state.bump * 0.25;
            const tx = (R + r * Math.cos(theta * 2)) * Math.cos(phi);
            const ty = (R + r * Math.cos(theta * 2)) * Math.sin(phi);
            const tz = r * Math.sin(theta * 2);
            x = tx; y = ty; z = tz;
          } else {
            const disp = 1 + fbm3(x * 2.2, y * 2.2, z * 2.2) * state.bump * 0.45;
            x *= disp; y *= disp; z *= disp;
          }

          const grain = hash3(i * 1.3, j * 1.7, state.subdiv);
          verts.push({ x, y, z, grain });
        }
      }

      const stride = lonSteps + 1;
      for (let i = 0; i < latSteps; i++) {
        for (let j = 0; j < lonSteps; j++) {
          const a = i * stride + j;
          const b = (i + 1) * stride + j;
          const c = (i + 1) * stride + (j + 1);
          const d = i * stride + (j + 1);
          faces.push([a, b, c, d]);
        }
      }

      mesh = { vertices: verts, faces };
      document.getElementById('poly-badge').textContent = 'MESH // ' + faces.length + ' QUADS';
    }

    rebuildMesh();

    // Floating crispy crumbs / ambient particles
    const particles = Array.from({ length: 42 }, (_, i) => ({
      angle: (i / 42) * Math.PI * 2,
      radius: 1.7 + (i % 7) * 0.22,
      y: ((i % 9) - 4) * 0.28,
      size: 1.5 + (i % 4),
      speed: 0.004 + (i % 5) * 0.0015,
    }));

    // Mouse / Touch Orbit Controls
    canvas.addEventListener('pointerdown', (e) => {
      state.dragging = true;
      state.lastX = e.clientX;
      state.lastY = e.clientY;
    });
    window.addEventListener('pointermove', (e) => {
      if (!state.dragging) return;
      const dx = e.clientX - state.lastX;
      const dy = e.clientY - state.lastY;
      state.lastX = e.clientX;
      state.lastY = e.clientY;
      state.rotY += dx * 0.009;
      state.rotX = Math.max(-1.45, Math.min(1.45, state.rotX + dy * 0.009));
    });
    window.addEventListener('pointerup', () => { state.dragging = false; });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      state.zoom = Math.max(0.55, Math.min(2.2, state.zoom - e.deltaY * 0.001));
    }, { passive: false });

    document.getElementById('slider-bump').addEventListener('input', (e) => {
      state.bump = parseFloat(e.target.value);
      document.getElementById('val-bump').textContent = state.bump.toFixed(2);
      rebuildMesh();
    });
    document.getElementById('slider-subdiv').addEventListener('input', (e) => {
      state.subdiv = parseInt(e.target.value, 10);
      document.getElementById('val-subdiv').textContent = String(state.subdiv);
      rebuildMesh();
    });
    document.getElementById('slider-light').addEventListener('input', (e) => {
      state.lightDeg = parseFloat(e.target.value);
      document.getElementById('val-light').textContent = state.lightDeg + '°';
    });
    document.getElementById('btn-bite').addEventListener('click', () => {
      state.biteCount = (state.biteCount + 1) % 2;
      state.bounceVel = 0.14;
      rebuildMesh();
    });
    document.getElementById('btn-wireframe').addEventListener('click', (e) => {
      state.wireframe = !state.wireframe;
      e.target.textContent = 'Wireframe: ' + (state.wireframe ? 'ON' : 'OFF');
    });
    document.getElementById('btn-spin').addEventListener('click', (e) => {
      state.autoSpin = !state.autoSpin;
      e.target.textContent = 'Auto-Spin: ' + (state.autoSpin ? 'ON' : 'OFF');
    });
    document.getElementById('btn-reset-cam').addEventListener('click', () => {
      state.rotX = -0.32;
      state.rotY = 0.65;
      state.zoom = 1.0;
      state.biteCount = 0;
      rebuildMesh();
    });

    function rotatePoint(p, rx, ry, scale) {
      let x = p.x * scale, y = p.y * scale, z = p.z * scale;
      const cy = Math.cos(ry), sy = Math.sin(ry);
      const x1 = x * cy + z * sy;
      const z1 = -x * sy + z * cy;
      const cx = Math.cos(rx), sx = Math.sin(rx);
      const y2 = y * cx - z1 * sx;
      const z2 = y * sx + z1 * cx;
      return { x: x1, y: y2, z: z2, grain: p.grain };
    }

    let lastTime = performance.now();
    let frameCount = 0;

    function renderLoop(now) {
      frameCount++;
      if (now - lastTime >= 500) {
        const fps = Math.round((frameCount * 1000) / (now - lastTime));
        document.getElementById('fps-badge').textContent = fps + ' FPS';
        frameCount = 0;
        lastTime = now;
      }

      if (state.autoSpin && !state.dragging) {
        state.rotY += 0.011;
      }

      // Spring bounce physics
      state.bounceScale += state.bounceVel;
      state.bounceVel += (1.0 - state.bounceScale) * 0.18;
      state.bounceVel *= 0.82;

      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const cx = w * 0.54, cy = h * 0.5;
      const fov = Math.min(w, h) * 0.42 * state.zoom;
      const camDist = 3.8;

      const mat = SCENE.presetConfig.colorModes[state.materialIdx] || SCENE.presetConfig.colorModes[0];
      const radLight = (state.lightDeg * Math.PI) / 180;
      const lx = Math.cos(radLight) * 0.75;
      const ly = -0.55;
      const lz = Math.sin(radLight) * 0.75 + 0.4;
      const lLen = Math.hypot(lx, ly, lz) || 1;
      const L = { x: lx / lLen, y: ly / lLen, z: lz / lLen };

      const transformed = mesh.vertices.map((v) => {
        const r = rotatePoint(v, state.rotX, state.rotY, state.bounceScale);
        const depth = Math.max(0.8, camDist - r.z);
        const proj = fov / depth;
        return {
          ...r,
          sx: cx + r.x * proj,
          sy: cy + r.y * proj,
          depth,
        };
      });

      // Painter's algorithm sort back-to-front
      const drawQuads = [];
      for (const [ia, ib, ic, id] of mesh.faces) {
        const a = transformed[ia], b = transformed[ib], c = transformed[ic], d = transformed[id];
        const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z;
        const vx = d.x - a.x, vy = d.y - a.y, vz = d.z - a.z;
        let nx = uy * vz - uz * vy;
        let ny = uz * vx - ux * vz;
        let nz = ux * vy - uy * vx;
        const nLen = Math.hypot(nx, ny, nz) || 1;
        nx /= nLen; ny /= nLen; nz /= nLen;

        // Backface culling (keep all when in wireframe mode)
        if (!state.wireframe && nz < -0.15) continue;

        const zAvg = (a.z + b.z + c.z + d.z) * 0.25;
        drawQuads.push({ a, b, c, d, nx, ny, nz, zAvg, grain: a.grain });
      }

      drawQuads.sort((p, q) => p.zAvg - q.zAvg);

      for (const q of drawQuads) {
        const ndotl = Math.max(0, q.nx * L.x + q.ny * L.y + q.nz * L.z);
        const rim = Math.pow(1 - Math.max(0, q.nz), 2.4);
        const spec = Math.pow(Math.max(0, (q.nx * L.x + q.ny * L.y + (q.nz + 1) * 0.5) / 1.4), 16) * mat.spec;
        const crumbShade = 0.88 + q.grain * 0.24;

        const rCol = Math.min(255, Math.round((mat.base[0] * (0.28 + ndotl * 0.78) * crumbShade) + mat.rim[0] * rim * 0.45 + spec * 255));
        const gCol = Math.min(255, Math.round((mat.base[1] * (0.28 + ndotl * 0.78) * crumbShade) + mat.rim[1] * rim * 0.45 + spec * 255));
        const bCol = Math.min(255, Math.round((mat.base[2] * (0.28 + ndotl * 0.78) * crumbShade) + mat.rim[2] * rim * 0.45 + spec * 255));

        ctx.beginPath();
        ctx.moveTo(q.a.sx, q.a.sy);
        ctx.lineTo(q.b.sx, q.b.sy);
        ctx.lineTo(q.c.sx, q.c.sy);
        ctx.lineTo(q.d.sx, q.d.sy);
        ctx.closePath();

        if (!state.wireframe) {
          ctx.fillStyle = 'rgb(' + rCol + ',' + gCol + ',' + bCol + ')';
          ctx.fill();
          ctx.strokeStyle = 'rgba(' + rCol + ',' + gCol + ',' + bCol + ', 0.45)';
          ctx.lineWidth = 0.6;
          ctx.stroke();
        } else {
          ctx.strokeStyle = 'rgba(' + mat.rim[0] + ',' + mat.rim[1] + ',' + mat.rim[2] + ', 0.68)';
          ctx.lineWidth = 1.1;
          ctx.stroke();
        }
      }

      // Draw ambient floating particles / crumbs
      for (const pt of particles) {
        pt.angle += pt.speed;
        const px = Math.cos(pt.angle) * pt.radius;
        const pz = Math.sin(pt.angle) * pt.radius;
        const pr = rotatePoint({ x: px, y: pt.y, z: pz, grain: 0 }, state.rotX, 0, 1);
        const depth = Math.max(0.8, camDist - pr.z);
        const proj = fov / depth;
        ctx.fillStyle = 'rgba(' + mat.rim[0] + ',' + mat.rim[1] + ',' + mat.rim[2] + ', 0.55)';
        ctx.beginPath();
        ctx.arc(cx + pr.x * proj, cy + pr.y * proj, pt.size, 0, Math.PI * 2);
        ctx.fill();
      }

      requestAnimationFrame(renderLoop);
    }

    requestAnimationFrame(renderLoop);
  </script>
</body>
</html>`;
}

/**
 * Generates an interactive WebAudio Polyphonic Synthesizer & Step Sequencer Studio.
 */
export function buildAudioSynthAppHtml(intent) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(intent.title)} — WebAudio Synth Studio</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: #060913;
      color: #eef5ff;
      padding: 20px;
      min-height: 100vh;
    }
    .synth-shell {
      max-width: 1040px;
      margin: 0 auto;
      background: rgba(12, 18, 34, 0.95);
      border: 1px solid rgba(0, 243, 255, 0.28);
      border-radius: 16px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .top-row { display: flex; justify-content: space-between; align-items: center; }
    .controls-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    @media (max-width: 720px) { .controls-grid { grid-template-columns: repeat(2, 1fr); } }
    .knob-card {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      padding: 12px;
      font-size: 12px;
    }
    .knob-card label { display: block; color: #8ea4c8; margin-bottom: 6px; font-size: 11px; }
    select, input[type="range"] { width: 100%; }
    canvas#scope {
      width: 100%;
      height: 160px;
      background: #03060c;
      border-radius: 10px;
      border: 1px solid rgba(0, 243, 255, 0.2);
    }
    .keys-row {
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      gap: 8px;
    }
    .piano-key {
      height: 110px;
      border-radius: 0 0 10px 10px;
      background: linear-gradient(180deg, #1b2845, #0f172a);
      border: 1px solid rgba(0, 243, 255, 0.35);
      color: #00f3ff;
      font-weight: 700;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      align-items: center;
      padding-bottom: 12px;
      cursor: pointer;
      user-select: none;
    }
    .piano-key:active, .piano-key.playing {
      background: linear-gradient(180deg, #00f3ff, #7b2cbf);
      color: #04070f;
    }
  </style>
</head>
<body>
  <div class="synth-shell">
    <div class="top-row">
      <div>
        <h2>${escapeHtml(intent.title)}</h2>
        <p style="font-size:12px;color:#8ea4c8;">WebAudio Polyphonic DSP Synthesizer &amp; Harmonic Oscilloscope</p>
      </div>
      <button id="btn-arp" style="padding:9px 16px;border-radius:8px;background:#00f3ff;color:#04070e;font-weight:700;border:none;cursor:pointer;">Toggle Arpeggiator</button>
    </div>

    <canvas id="scope" width="960" height="160"></canvas>

    <div class="controls-grid">
      <div class="knob-card">
        <label>Oscillator Waveform</label>
        <select id="osc-type">
          <option value="sawtooth">Sawtooth</option>
          <option value="sine">Sine</option>
          <option value="square">Square</option>
          <option value="triangle">Triangle</option>
        </select>
      </div>
      <div class="knob-card">
        <label>Lowpass Cutoff (Hz)</label>
        <input id="filter-freq" type="range" min="180" max="6400" value="2200" />
      </div>
      <div class="knob-card">
        <label>Filter Resonance (Q)</label>
        <input id="filter-q" type="range" min="0.5" max="15" step="0.5" value="3.5" />
      </div>
      <div class="knob-card">
        <label>Release Decay (s)</label>
        <input id="env-release" type="range" min="0.1" max="1.8" step="0.05" value="0.45" />
      </div>
    </div>

    <div id="keys-row" class="keys-row"></div>
  </div>

  <script>
    const NOTES = [
      { note: 'C4', freq: 261.63 },
      { note: 'D4', freq: 293.66 },
      { note: 'E4', freq: 329.63 },
      { note: 'F4', freq: 349.23 },
      { note: 'G4', freq: 392.00 },
      { note: 'A4', freq: 440.00 },
      { note: 'B4', freq: 493.88 },
      { note: 'C5', freq: 523.25 },
    ];
    let audioCtx = null;
    let activeFreq = 440;
    let arpTimer = null;

    function triggerNote(freq, btnEl) {
      activeFreq = freq;
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const filter = audioCtx.createBiquadFilter();
      const gain = audioCtx.createGain();
      osc.type = document.getElementById('osc-type').value;
      osc.frequency.value = freq;
      filter.type = 'lowpass';
      filter.frequency.value = parseFloat(document.getElementById('filter-freq').value);
      filter.Q.value = parseFloat(document.getElementById('filter-q').value);
      const rel = parseFloat(document.getElementById('env-release').value);
      const now = audioCtx.currentTime;
      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + rel);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + rel);
      if (btnEl) {
        btnEl.classList.add('playing');
        setTimeout(() => btnEl.classList.remove('playing'), 220);
      }
    }

    const keysRow = document.getElementById('keys-row');
    NOTES.forEach((n) => {
      const key = document.createElement('div');
      key.className = 'piano-key';
      key.innerHTML = '<span>' + n.note + '</span><small style="font-size:10px;opacity:0.7;">' + Math.round(n.freq) + 'Hz</small>';
      key.addEventListener('pointerdown', () => triggerNote(n.freq, key));
      keysRow.appendChild(key);
    });

    document.getElementById('btn-arp').addEventListener('click', () => {
      if (arpTimer) {
        clearInterval(arpTimer);
        arpTimer = null;
      } else {
        let i = 0;
        const keyEls = keysRow.querySelectorAll('.piano-key');
        arpTimer = setInterval(() => {
          const idx = i % NOTES.length;
          triggerNote(NOTES[idx].freq, keyEls[idx]);
          i++;
        }, 210);
      }
    });

    const canvas = document.getElementById('scope');
    const ctx = canvas.getContext('2d');
    let phase = 0;
    function drawScope() {
      phase += 0.06;
      ctx.fillStyle = '#03060c';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#00f3ff';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let x = 0; x < canvas.width; x += 3) {
        const t = x / canvas.width;
        const y = canvas.height * 0.5 + Math.sin(t * (activeFreq / 22) + phase) * 52 * Math.cos(t * Math.PI);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      requestAnimationFrame(drawScope);
    }
    drawScope();
  </script>
</body>
</html>`;
}

/**
 * Generates an interactive 4-Column Kanban & Project Workflow Board.
 */
export function buildKanbanBoardAppHtml(intent) {
  const defaultCards = JSON.stringify([
    { id: 'k-1', title: `Design ${intent.title} Architecture`, col: 'Backlog', tag: 'CORE' },
    { id: 'k-2', title: 'Implement Reactive State Store & Persistence', col: 'In Progress', tag: 'FRONTEND' },
    { id: 'k-3', title: 'Integrate Automated End-to-End Verification', col: 'Review', tag: 'QA' },
    { id: 'k-4', title: 'Configure Workspace Guardrail Policy', col: 'Done', tag: 'SECURITY' },
  ]);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(intent.title)} — Kanban Board</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: #060a14;
      color: #eef5ff;
      padding: 20px;
      min-height: 100vh;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      gap: 12px;
      flex-wrap: wrap;
    }
    .add-bar { display: flex; gap: 8px; }
    input, select {
      background: #0d1526;
      border: 1px solid rgba(0, 243, 255, 0.3);
      color: #fff;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 13px;
    }
    button {
      background: #00f3ff;
      color: #04070e;
      font-weight: 700;
      border: none;
      padding: 8px 14px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 12px;
    }
    .board {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
    }
    @media (max-width: 860px) { .board { grid-template-columns: repeat(2, 1fr); } }
    .column {
      background: rgba(13, 21, 38, 0.9);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 14px;
      min-height: 420px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .col-title {
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #00f3ff;
      display: flex;
      justify-content: space-between;
    }
    .task-card {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      padding: 12px;
      font-size: 13px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .task-actions { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #8ea4c8; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h2>${escapeHtml(intent.title)}</h2>
      <p style="font-size:12px;color:#8ea4c8;">Interactive Workflow &amp; Sprint Board</p>
    </div>
    <div class="add-bar">
      <input id="task-input" type="text" placeholder="New task title..." />
      <select id="task-col">
        <option value="Backlog">Backlog</option>
        <option value="In Progress">In Progress</option>
        <option value="Review">Review</option>
        <option value="Done">Done</option>
      </select>
      <button id="btn-add-task" type="button">+ Add Task</button>
    </div>
  </div>
  <div id="board" class="board"></div>

  <script>
    const COLS = ['Backlog', 'In Progress', 'Review', 'Done'];
    const cards = ${defaultCards};

    function renderBoard() {
      const board = document.getElementById('board');
      board.innerHTML = '';
      for (const col of COLS) {
        const colEl = document.createElement('div');
        colEl.className = 'column';
        const colCards = cards.filter((c) => c.col === col);
        colEl.innerHTML = '<div class="col-title"><span>' + col + '</span><span>' + colCards.length + '</span></div>';
        for (const card of colCards) {
          const el = document.createElement('div');
          el.className = 'task-card';
          el.innerHTML =
            '<strong>' + card.title + '</strong>' +
            '<div class="task-actions"><span>[' + card.tag + ']</span><button type="button" style="padding:3px 8px;font-size:11px;">Advance →</button></div>';
          el.querySelector('button').addEventListener('click', () => {
            const idx = COLS.indexOf(card.col);
            card.col = COLS[(idx + 1) % COLS.length];
            renderBoard();
          });
          colEl.appendChild(el);
        }
        board.appendChild(colEl);
      }
    }

    document.getElementById('btn-add-task').addEventListener('click', () => {
      const input = document.getElementById('task-input');
      const title = input.value.trim();
      if (!title) return;
      cards.unshift({
        id: 'k-' + Date.now(),
        title,
        col: document.getElementById('task-col').value,
        tag: 'TASK',
      });
      input.value = '';
      renderBoard();
    });

    renderBoard();
  </script>
</body>
</html>`;
}
