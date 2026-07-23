# Estimatron Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack web tool (Express + vanilla JS) that takes feature requirements text and optional wireframe images, calls the Claude API, and returns an editable manday estimate sheet grouped by platform layer.

**Architecture:** Express serves static files from `/public` and exposes one endpoint: `POST /api/estimate`. The endpoint calls Claude with a structured JSON prompt, validates the response schema (with one retry on failure), and returns the data to the browser. `app.js` handles all input/upload logic and API calls; `estimateSheet.js` renders and manages the interactive estimate table and exports.

**Tech Stack:** Node.js 18+, Express 4, @anthropic-ai/sdk, dotenv, Jest 29, supertest

## Global Constraints

- Node.js 18+ required (`node --watch` used for dev)
- No frontend build step — plain HTML/CSS/JS, no bundler
- `ANTHROPIC_API_KEY` must be in `.env`, never committed; `.gitignore` must exclude `.env`
- Model: `claude-sonnet-5`
- Accent colour: `#A100FF` — never substituted
- Complexity badge values: exactly `"Low"`, `"Medium"`, `"Complex"` (case-sensitive throughout)
- Manday values: 0.5 increments, minimum 0.5
- Export CSV column order: `Group,Subgroup,Task,Complexity,Mandays`
- Server JSON body limit: `50mb` (to accommodate base64-encoded images)
- Client-side image limits: max 10 MB per file, accepted types `image/png`, `image/jpeg`, `image/webp`

---

### Task 1: Project scaffold + Express server with static serving

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `server.js`
- Create: `public/index.html` (stub only)
- Create: `tests/api.test.js`

**Interfaces:**
- Produces: `app` (Express instance) exported from `server.js` for supertest
- Produces: `GET /` → serves `public/index.html`
- Produces: `POST /api/estimate` stub → `400` on bad input, `501` otherwise

- [ ] **Step 1: Create package.json**

```json
{
  "name": "estimatron",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js",
    "test": "jest --testEnvironment node"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.56.0",
    "dotenv": "^16.4.5",
    "express": "^4.19.2"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^7.0.0"
  }
}
```

- [ ] **Step 2: Create .gitignore**

```
node_modules/
.env
```

- [ ] **Step 3: Create .env.example**

```
ANTHROPIC_API_KEY=your_key_here
PORT=3000
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, no errors.

- [ ] **Step 5: Create stub public/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Estimatron</title>
</head>
<body>
  <h1>Estimatron</h1>
</body>
</html>
```

- [ ] **Step 6: Write the failing tests**

Create `tests/api.test.js`:
```js
const request = require('supertest');
const app     = require('../server');

describe('Server bootstrap', () => {
  test('GET / serves HTML', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });

  test('POST /api/estimate with empty body returns 400', async () => {
    const res = await request(app).post('/api/estimate').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});
```

- [ ] **Step 7: Run tests to verify they fail**

Run: `npm test -- --testPathPattern=api`
Expected: FAIL — `Cannot find module '../server'`

- [ ] **Step 8: Create server.js (stub)**

```js
require('dotenv').config();
const express = require('express');
const path    = require('path');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/estimate', (req, res) => {
  const { requirements, platform } = req.body;
  if (!requirements || !requirements.trim()) {
    return res.status(400).json({ error: 'requirements is required' });
  }
  if (!['web', 'ios', 'android', 'cross', 'api'].includes(platform)) {
    return res.status(400).json({ error: 'invalid platform value' });
  }
  res.status(501).json({ error: 'Not implemented' });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Estimatron running on http://localhost:${PORT}`));
}

module.exports = app;
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `npm test -- --testPathPattern=api`
Expected: PASS — 2 tests green.

- [ ] **Step 10: Commit**

```bash
git init
git add package.json package-lock.json .gitignore .env.example server.js public/index.html tests/api.test.js
git commit -m "feat: project scaffold and Express server with static serving"
```

---

### Task 2: HTML shell + CSS design system

**Files:**
- Modify: `public/index.html` (replace stub with full structure)
- Create: `public/css/style.css`

**Interfaces:**
- Produces: all DOM IDs consumed by `app.js` and `estimateSheet.js` in later tasks:
  `#platformSelect`, `#requirements`, `#uploadZone`, `#fileInput`, `#thumbRow`, `#generateBtn`,
  `#main`, `#estimateSection`, `#estimateBody`, `#estimateTitle`, `#platformChip`,
  `#regenBtn`, `#exportCsvBtn`, `#copyBtn`, `#grandTotal`, `#toastContainer`

- [ ] **Step 1: Create public/css/style.css**

```css
* { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --accent:     #A100FF;
  --accent-dim: rgba(161,0,255,0.15);
  --accent-glow:rgba(161,0,255,0.3);
  --bg:      #0b0c10;
  --surface: #0f1117;
  --surface2:#141720;
  --border:  #1e2130;
  --border2: #252b3b;
  --text:    #f1f5f9;
  --text2:   #cbd5e1;
  --text3:   #94a3b8;
  --text4:   #475569;
}

html, body { height: 100%; font-family: 'Inter', system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); }
.app { display: flex; flex-direction: column; min-height: 100vh; }

/* ── Header ── */
.app-header {
  background: var(--surface); border-bottom: 1px solid var(--border);
  padding: 0 40px; height: 62px; display: flex; align-items: center; gap: 14px;
  flex-shrink: 0; position: sticky; top: 0; z-index: 10;
}
.logo-dot { width: 10px; height: 10px; background: var(--accent); border-radius: 50%; box-shadow: 0 0 14px var(--accent); flex-shrink: 0; }
.logo { font-size: 22px; font-weight: 900; color: #fff; letter-spacing: -0.8px; }
.logo span { color: var(--accent); }
.tagline { font-size: 13px; color: var(--text4); margin-left: 4px; }

/* ── Main ── */
.main { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 44px; gap: 36px; }
.main.has-estimate { justify-content: flex-start; }
.section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--text4); margin-bottom: 12px; }

/* ── Input card ── */
.input-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 28px 32px; width: 100%; }
.input-cols { display: grid; grid-template-columns: 1fr 340px; gap: 24px; align-items: start; }
.input-left { display: flex; flex-direction: column; gap: 12px; }

.platform-row { display: flex; align-items: center; gap: 12px; }
.platform-label { font-size: 13px; font-weight: 600; color: var(--text3); white-space: nowrap; }
.platform-select {
  background: var(--surface2); border: 1.5px solid var(--border2); border-radius: 8px;
  padding: 9px 36px 9px 14px; font-size: 14px; font-weight: 600; color: var(--text);
  outline: none; cursor: pointer; appearance: none; -webkit-appearance: none; flex: 1;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2394a3b8' stroke-width='1.8' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 12px center; transition: border-color 0.15s;
}
.platform-select:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-dim); }
.platform-select option { background: #1a1f2e; color: var(--text); }

.textarea {
  background: var(--surface2); border: 1.5px solid var(--border2); border-radius: 10px;
  padding: 16px 18px; font-size: 15px; color: var(--text2); min-height: 140px;
  resize: vertical; outline: none; line-height: 1.7; width: 100%; font-family: inherit;
  transition: border-color 0.15s;
}
.textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-dim); }
.textarea::placeholder { color: var(--text4); font-size: 14px; }

/* ── Upload column ── */
.upload-col { display: flex; flex-direction: column; gap: 12px; }
.upload-zone {
  border: 1.5px dashed #3b1f5e; border-radius: 10px; padding: 22px 16px;
  text-align: center; background: #110d1a; cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.upload-zone:hover, .upload-zone.drag-over { border-color: var(--accent); background: #150f22; }
.upload-icon { font-size: 24px; margin-bottom: 6px; }
.upload-text { font-size: 13px; color: #9333ea; font-weight: 600; }
.upload-sub { font-size: 11px; color: var(--text4); margin-top: 4px; }

.thumb-row { display: flex; gap: 8px; flex-wrap: wrap; min-height: 0; }
.thumb { width: 50px; height: 50px; background: #1a1030; border-radius: 8px; border: 1px solid #3b1f5e; display: flex; align-items: center; justify-content: center; font-size: 22px; position: relative; }
.thumb .x { position: absolute; top: -5px; right: -5px; width: 16px; height: 16px; background: #374151; border-radius: 50%; font-size: 9px; display: flex; align-items: center; justify-content: center; color: #94a3b8; cursor: pointer; line-height: 1; }

.btn-generate {
  background: var(--accent); color: white; border: none; border-radius: 10px;
  padding: 14px 22px; font-size: 15px; font-weight: 700; cursor: pointer; width: 100%;
  box-shadow: 0 4px 24px var(--accent-glow); letter-spacing: 0.3px;
  transition: box-shadow 0.15s, opacity 0.15s;
}
.btn-generate:hover:not(:disabled) { box-shadow: 0 6px 32px rgba(161,0,255,0.55); }
.btn-generate:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }

/* ── Estimate section ── */
.estimate-section { width: 100%; display: none; }
.estimate-section.visible { display: block; }
.estimate-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; }

.estimate-toolbar { padding: 18px 28px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.estimate-title { font-size: 16px; font-weight: 700; color: var(--text); }
.platform-chip { font-size: 11px; font-weight: 700; padding: 3px 10px; background: var(--accent-dim); color: #c084fc; border: 1px solid rgba(161,0,255,0.3); border-radius: 20px; }
.regen-btn { background: none; border: 1px solid var(--border2); color: var(--text3); border-radius: 7px; padding: 6px 14px; font-size: 13px; font-weight: 600; cursor: pointer; }
.regen-btn:hover { border-color: var(--accent); color: #c084fc; }
.export-btns { display: flex; gap: 10px; margin-left: auto; }
.btn-sm { background: var(--surface2); border: 1px solid var(--border2); color: var(--text2); border-radius: 7px; padding: 7px 16px; font-size: 13px; font-weight: 600; cursor: pointer; }
.btn-sm:hover { border-color: var(--accent); color: #c084fc; }

.estimate-body { padding: 24px 28px; display: flex; flex-direction: column; gap: 32px; }

/* ── Groups ── */
.group-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.group-name { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.9px; color: var(--accent); }
.group-line { flex: 1; height: 1px; background: #1e1030; }
.group-subtotal { font-size: 13px; color: var(--text3); font-weight: 600; }

.subgroup { margin-top: 14px; }
.subgroup-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.7px; color: var(--text4); margin-bottom: 8px; padding-left: 8px; border-left: 2px solid var(--border2); }

/* ── Task rows ── */
.task-row { background: var(--surface2); border: 1px solid var(--border); border-radius: 9px; margin-bottom: 7px; overflow: hidden; }
.task-main { display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; }
.task-name { flex: 1; font-size: 14px; color: var(--text); font-weight: 500; padding-top: 1px; line-height: 1.5; }

.complexity-badge { font-size: 10px; font-weight: 700; padding: 3px 9px; border-radius: 20px; flex-shrink: 0; margin-top: 2px; white-space: nowrap; }
.badge-low  { background: #0f2210; color: #86efac; border: 1px solid #166534; }
.badge-med  { background: #1c1a30; color: #a5b4fc; border: 1px solid #4338ca; }
.badge-high { background: #2d0a3e; color: #d8b4fe; border: 1px solid #7e22ce; }

.md-input { width: 52px; background: #0f1117; border: 1px solid var(--border2); border-radius: 6px; text-align: center; font-size: 14px; font-weight: 700; color: var(--accent); padding: 5px 6px; outline: none; transition: border-color 0.15s; flex-shrink: 0; }
.md-input:focus { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-dim); }
.md-unit { font-size: 12px; color: var(--text3); flex-shrink: 0; padding-top: 6px; }

.task-desc { padding: 10px 16px 14px; border-top: 1px solid #1a1020; background: #0f0d16; }
.desc-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #7c3aed; margin-bottom: 6px; }
.desc-text { font-size: 13px; color: var(--text3); line-height: 1.75; }

/* ── Grand total ── */
.total-bar { padding: 20px 28px; border-top: 1px solid var(--border); display: flex; align-items: center; justify-content: flex-end; gap: 14px; background: #0d0f15; }
.total-label { font-size: 13px; font-weight: 700; color: var(--text3); text-transform: uppercase; letter-spacing: 0.7px; }
.total-value { font-size: 30px; font-weight: 900; color: var(--accent); letter-spacing: -1px; }
.total-unit { font-size: 14px; color: var(--text3); }

/* ── Toast ── */
#toastContainer { position: fixed; bottom: 24px; right: 24px; display: flex; flex-direction: column; gap: 10px; z-index: 100; }
.toast {
  background: #1e2130; border: 1px solid var(--border2); border-radius: 10px;
  padding: 13px 18px; font-size: 13px; font-weight: 600; color: var(--text2);
  max-width: 340px; opacity: 0; transform: translateY(8px);
  transition: opacity 0.2s, transform 0.2s; pointer-events: none;
}
.toast.toast-error   { border-color: #7f1d1d; color: #fca5a5; }
.toast.toast-success { border-color: #166534; color: #86efac; }
.toast.visible { opacity: 1; transform: translateY(0); pointer-events: auto; }
```

- [ ] **Step 2: Replace public/index.html with full structure**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Estimatron</title>
  <link rel="stylesheet" href="/css/style.css" />
</head>
<body>
<div class="app">

  <header class="app-header">
    <div class="logo-dot"></div>
    <span class="logo">Estimatron<span>.</span></span>
    <span class="tagline">AI-powered manday estimation</span>
  </header>

  <main class="main" id="main">

    <div class="input-card">
      <div class="section-label">Requirements</div>
      <div class="input-cols">

        <div class="input-left">
          <div class="platform-row">
            <span class="platform-label">Platform</span>
            <select class="platform-select" id="platformSelect">
              <option value="web">Web Application</option>
              <option value="ios">iOS (Native)</option>
              <option value="android">Android (Native)</option>
              <option value="cross">Cross-platform Mobile (React Native / Flutter)</option>
              <option value="api">API / Backend only</option>
            </select>
          </div>
          <textarea
            class="textarea"
            id="requirements"
            placeholder="Paste feature description, user stories, or acceptance criteria here…&#10;&#10;E.g. &quot;Build a login screen with email/password, social login (Google), and a remember-me option…&quot;"
          ></textarea>
        </div>

        <div class="upload-col">
          <div class="upload-zone" id="uploadZone">
            <div class="upload-icon">🖼️</div>
            <div class="upload-text">Drop wireframes or screens</div>
            <div class="upload-sub">PNG · JPG · WEBP · Multiple files OK</div>
          </div>
          <input type="file" id="fileInput" accept="image/png,image/jpeg,image/webp" multiple hidden />
          <div class="thumb-row" id="thumbRow"></div>
          <button class="btn-generate" id="generateBtn" disabled>Generate Estimation</button>
        </div>

      </div>
    </div>

    <div class="estimate-section" id="estimateSection">
      <div class="section-label">Estimate Sheet</div>
      <div class="estimate-card">
        <div class="estimate-toolbar">
          <span class="estimate-title" id="estimateTitle">—</span>
          <span class="platform-chip" id="platformChip"></span>
          <button class="regen-btn" id="regenBtn">↺ Re-generate</button>
          <div class="export-btns">
            <button class="btn-sm" id="copyBtn">Copy</button>
            <button class="btn-sm" id="exportCsvBtn">Export CSV</button>
          </div>
        </div>
        <div class="estimate-body" id="estimateBody"></div>
        <div class="total-bar">
          <span class="total-label">Grand Total</span>
          <span class="total-value" id="grandTotal">0</span>
          <span class="total-unit">mandays</span>
        </div>
      </div>
    </div>

  </main>
</div>

<div id="toastContainer"></div>

<script src="/js/estimateSheet.js"></script>
<script src="/js/app.js"></script>
</body>
</html>
```

- [ ] **Step 3: Manual verification**

Run: `npm start`
Open: `http://localhost:3000`
Expected: dark page with Estimatron header, platform dropdown, textarea, upload zone, disabled "Generate Estimation" button. No console errors. Input card is vertically centred in viewport.

- [ ] **Step 4: Commit**

```bash
git add public/index.html public/css/style.css
git commit -m "feat: HTML shell and CSS design system"
```

---

### Task 3: app.js — input form, image upload, API call

**Files:**
- Create: `public/js/app.js`
- Create: `public/js/estimateSheet.js` (stub — replaced in Task 5)

**Interfaces:**
- Consumes: DOM IDs from Task 2
- Consumes: `renderEstimate(data)`, `generateCSV(groups)`, `generateClipboardText(groups)` globals from `estimateSheet.js` (loaded first in HTML)
- Produces: `showToast(message, type)` as a global function

- [ ] **Step 1: Create stub public/js/estimateSheet.js so app.js can load without errors**

```js
function renderEstimate(data) {}
function generateCSV(groups) { return ''; }
function generateClipboardText(groups) { return ''; }
```

- [ ] **Step 2: Create public/js/app.js**

```js
const MAX_FILE_SIZE  = 10 * 1024 * 1024;
const ALLOWED_TYPES  = ['image/png', 'image/jpeg', 'image/webp'];
const PLATFORM_LABELS = {
  web:     'Web Application',
  ios:     'iOS (Native)',
  android: 'Android (Native)',
  cross:   'Cross-platform Mobile',
  api:     'API / Backend only',
};

let uploadedImages = [];

const platformSelect  = document.getElementById('platformSelect');
const requirementsEl  = document.getElementById('requirements');
const uploadZone      = document.getElementById('uploadZone');
const fileInput       = document.getElementById('fileInput');
const thumbRow        = document.getElementById('thumbRow');
const generateBtn     = document.getElementById('generateBtn');
const estimateSection = document.getElementById('estimateSection');
const mainEl          = document.getElementById('main');
const estimateTitleEl = document.getElementById('estimateTitle');
const platformChipEl  = document.getElementById('platformChip');
const regenBtn        = document.getElementById('regenBtn');
const exportCsvBtn    = document.getElementById('exportCsvBtn');
const copyBtn         = document.getElementById('copyBtn');

// ── Toast ────────────────────────────────────────────────────────────
function showToast(message, type = 'error') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ── Button state ─────────────────────────────────────────────────────
function updateButtonState() {
  generateBtn.disabled = !(requirementsEl.value.trim().length > 0 || uploadedImages.length > 0);
}
requirementsEl.addEventListener('input', updateButtonState);

// ── File handling ─────────────────────────────────────────────────────
function validateFile(file) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return `${file.name}: unsupported format. Use PNG, JPG, or WEBP.`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `${file.name}: file exceeds 10 MB limit.`;
  }
  return null;
}

function encodeImageToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve({ data: reader.result.split(',')[1], mediaType: file.type });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderThumbs() {
  thumbRow.innerHTML = '';
  uploadedImages.forEach((_, i) => {
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    thumb.textContent = '🖼';
    const x = document.createElement('span');
    x.className = 'x';
    x.textContent = '✕';
    x.dataset.index = i;
    x.addEventListener('click', (e) => {
      e.stopPropagation();
      uploadedImages.splice(parseInt(e.currentTarget.dataset.index), 1);
      renderThumbs();
      updateButtonState();
    });
    thumb.appendChild(x);
    thumbRow.appendChild(thumb);
  });
}

async function handleFiles(files) {
  for (const file of Array.from(files)) {
    const err = validateFile(file);
    if (err) { showToast(err); continue; }
    try {
      uploadedImages.push(await encodeImageToBase64(file));
    } catch {
      showToast(`Failed to read ${file.name}`);
    }
  }
  renderThumbs();
  updateButtonState();
}

// ── Upload zone events ────────────────────────────────────────────────
uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover',  (e) => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', ()  => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  handleFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', () => { handleFiles(fileInput.files); fileInput.value = ''; });

// ── Generate ──────────────────────────────────────────────────────────
generateBtn.addEventListener('click', async () => {
  const requirements = requirementsEl.value.trim();
  const platform     = platformSelect.value;

  generateBtn.disabled    = true;
  generateBtn.textContent = 'Generating…';

  try {
    const res  = await fetch('/api/estimate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ requirements, platform, images: uploadedImages }),
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Generation failed — please try again');
      return;
    }

    window._currentEstimate     = data;
    estimateTitleEl.textContent = data.title;
    platformChipEl.textContent  = PLATFORM_LABELS[platform];
    renderEstimate(data);
    estimateSection.classList.add('visible');
    mainEl.classList.add('has-estimate');
    estimateSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch {
    showToast(
      navigator.onLine
        ? 'Generation failed — please try again'
        : 'No connection — check your network and try again'
    );
  } finally {
    generateBtn.textContent = 'Generate Estimation';
    updateButtonState();
  }
});

// ── Re-generate ───────────────────────────────────────────────────────
regenBtn.addEventListener('click', () => {
  estimateSection.classList.remove('visible');
  mainEl.classList.remove('has-estimate');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ── Export CSV ────────────────────────────────────────────────────────
exportCsvBtn.addEventListener('click', () => {
  if (!window._currentEstimate) return;
  const csv  = generateCSV(window._currentEstimate.groups);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: `${window._currentEstimate.title.replace(/\s+/g, '-')}.csv` });
  a.click();
  URL.revokeObjectURL(url);
});

// ── Copy to clipboard ─────────────────────────────────────────────────
copyBtn.addEventListener('click', async () => {
  if (!window._currentEstimate) return;
  try {
    await navigator.clipboard.writeText(generateClipboardText(window._currentEstimate.groups));
    showToast('Copied to clipboard', 'success');
  } catch {
    showToast('Copy failed — use Export CSV instead');
  }
});
```

- [ ] **Step 3: Manual verification**

Run: `npm start`, open `http://localhost:3000`

Check these behaviours:
1. Button is **disabled** on fresh load.
2. Type in textarea → button **enables**.
3. Clear textarea → button **disables**.
4. Drop/pick a valid PNG → thumbnail appears with ✕.
5. Click ✕ → thumbnail removed; button disables if no text either.
6. Drop a file > 10 MB → toast error "file exceeds 10 MB limit."
7. Drop a `.gif` file → toast error "unsupported format."
8. Click "Generate Estimation" with text → button shows "Generating…", then returns to normal (will show 501 error toast until Task 4 is done).

- [ ] **Step 4: Commit**

```bash
git add public/js/app.js public/js/estimateSheet.js
git commit -m "feat: input form, image upload, drag-and-drop, toast notifications"
```

---

### Task 4: Claude API integration — /api/estimate

**Files:**
- Modify: `server.js`
- Modify: `tests/api.test.js`

**Interfaces:**
- Consumes: `ANTHROPIC_API_KEY` from `.env`
- Produces: `POST /api/estimate` → `200 { title, groups[] }` on success
- Produces: `POST /api/estimate` → `400 { error }` for missing/invalid input
- Produces: `POST /api/estimate` → `502 { error }` for AI failures

- [ ] **Step 1: Write failing tests**

Replace `tests/api.test.js`:
```js
jest.mock('@anthropic-ai/sdk');

const Anthropic = require('@anthropic-ai/sdk');
const request   = require('supertest');
const app       = require('../server');

const validPayload = {
  title: 'Login Screen',
  groups: [
    {
      name: 'Frontend',
      tasks:     [{ name: 'Login form',      complexity: 'Low',    mandays: 1.0, notes: null }],
      edgeCases: [{ name: 'Invalid creds',   complexity: 'Low',    mandays: 0.5, notes: null }],
      testing:   [{ name: 'Form unit tests', complexity: 'Low',    mandays: 0.5, notes: null }],
    },
    {
      name: 'Backend',
      tasks:     [{ name: 'Auth endpoint',   complexity: 'Medium', mandays: 1.5, notes: 'JWT handling' }],
      edgeCases: [],
      testing:   [],
    },
  ],
};

function makeClient(mockFn) {
  Anthropic.mockImplementation(() => ({ messages: { create: mockFn } }));
}

describe('POST /api/estimate — input validation', () => {
  test('returns 400 when requirements is missing', async () => {
    const res = await request(app).post('/api/estimate').send({ platform: 'web' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('requirements is required');
  });

  test('returns 400 when requirements is blank whitespace', async () => {
    const res = await request(app).post('/api/estimate').send({ requirements: '   ', platform: 'web' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('requirements is required');
  });

  test('returns 400 when platform is invalid', async () => {
    const res = await request(app).post('/api/estimate').send({ requirements: 'build login', platform: 'invalid' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid platform value');
  });
});

describe('POST /api/estimate — Claude integration', () => {
  test('returns structured estimate on valid Claude response', async () => {
    makeClient(jest.fn().mockResolvedValue({ content: [{ text: JSON.stringify(validPayload) }] }));
    const res = await request(app)
      .post('/api/estimate')
      .send({ requirements: 'build a login screen', platform: 'web' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Login Screen');
    expect(res.body.groups).toHaveLength(2);
  });

  test('retries once on malformed JSON, succeeds on second attempt', async () => {
    const fn = jest.fn()
      .mockResolvedValueOnce({ content: [{ text: 'not json' }] })
      .mockResolvedValueOnce({ content: [{ text: JSON.stringify(validPayload) }] });
    makeClient(fn);
    const res = await request(app)
      .post('/api/estimate')
      .send({ requirements: 'build a login screen', platform: 'web' });
    expect(res.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('returns 502 when both attempts return malformed JSON', async () => {
    makeClient(jest.fn().mockResolvedValue({ content: [{ text: 'not json' }] }));
    const res = await request(app)
      .post('/api/estimate')
      .send({ requirements: 'build a login screen', platform: 'web' });
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/Generation failed/);
  });

  test('returns 502 immediately when Claude API throws', async () => {
    makeClient(jest.fn().mockRejectedValue(new Error('network error')));
    const res = await request(app)
      .post('/api/estimate')
      .send({ requirements: 'build a login screen', platform: 'web' });
    expect(res.status).toBe(502);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --testPathPattern=api`
Expected: FAIL — Claude mock not wired up; `/api/estimate` still returns 501.

- [ ] **Step 3: Replace server.js with full implementation**

```js
require('dotenv').config();
const express   = require('express');
const path      = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const VALID_PLATFORMS = ['web', 'ios', 'android', 'cross', 'api'];

const SYSTEM_PROMPT = `You are a senior software architect and estimation expert specialising in breaking down software feature requirements into realistic manday estimates for development teams.

Given a feature description (and optionally UI screenshots/wireframes) and a target platform, produce a structured task breakdown.

Platform group names to use:
- "web":     groups "Frontend" and "Backend"
- "ios":     groups "iOS" and "Backend"
- "android": groups "Android" and "Backend"
- "cross":   groups "iOS", "Android", and "Backend"
- "api":     group "Backend" only

For each group, break the work into three subgroups:
1. tasks — core implementation work
2. edgeCases — error handling, boundary conditions, validation, unusual states
3. testing — unit tests, integration tests, manual test plans

For each task item:
- name: specific and actionable (e.g. "POST /auth/login endpoint" not "implement auth")
- complexity: exactly one of "Low", "Medium", or "Complex"
  - Low: straightforward, well-understood pattern, under 1 day
  - Medium: non-obvious decisions, cross-system coordination, 1–2 days
  - Complex: significant unknowns, tricky integrations, or many interacting edge cases, 2+ days
- mandays: estimate in 0.5 increments, minimum 0.5
- notes: for Medium or Complex tasks, 1–3 sentences on WHY it is non-trivial; null for Low tasks

Return ONLY valid JSON — no markdown fences, no preamble. Your entire response must be parseable by JSON.parse().

Schema:
{
  "title": "short feature name (3–6 words)",
  "groups": [
    {
      "name": "string",
      "tasks":     [{ "name": "string", "complexity": "Low|Medium|Complex", "mandays": 0.5, "notes": "string|null" }],
      "edgeCases": [{ "name": "string", "complexity": "Low|Medium|Complex", "mandays": 0.5, "notes": "string|null" }],
      "testing":   [{ "name": "string", "complexity": "Low|Medium|Complex", "mandays": 0.5, "notes": "string|null" }]
    }
  ]
}`;

function validateSchema(data) {
  if (!data || typeof data !== 'object')                          return false;
  if (typeof data.title !== 'string' || !data.title.trim())      return false;
  if (!Array.isArray(data.groups) || data.groups.length === 0)   return false;
  for (const group of data.groups) {
    if (typeof group.name !== 'string')       return false;
    if (!Array.isArray(group.tasks))          return false;
    if (!Array.isArray(group.edgeCases))      return false;
    if (!Array.isArray(group.testing))        return false;
    for (const task of [...group.tasks, ...group.edgeCases, ...group.testing]) {
      if (typeof task.name !== 'string')                          return false;
      if (!['Low', 'Medium', 'Complex'].includes(task.complexity)) return false;
      if (typeof task.mandays !== 'number' || task.mandays < 0.5) return false;
    }
  }
  return true;
}

async function callClaude(requirements, platform, images) {
  const client  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const content = [];
  for (const img of images) {
    content.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } });
  }
  content.push({ type: 'text', text: `Platform: ${platform}\n\nFeature requirements:\n${requirements}` });

  const response = await client.messages.create({
    model:      'claude-sonnet-5',
    max_tokens: 4096,
    system:     SYSTEM_PROMPT,
    messages:   [{ role: 'user', content }],
  });
  return response.content[0].text;
}

app.post('/api/estimate', async (req, res) => {
  const { requirements, platform, images = [] } = req.body;

  if (!requirements || !requirements.trim()) {
    return res.status(400).json({ error: 'requirements is required' });
  }
  if (!VALID_PLATFORMS.includes(platform)) {
    return res.status(400).json({ error: 'invalid platform value' });
  }

  for (let attempt = 0; attempt <= 1; attempt++) {
    let text;
    try {
      text = await callClaude(requirements, platform, images);
    } catch (err) {
      console.error('Claude API error:', err.message);
      return res.status(502).json({ error: 'Generation failed — please try again' });
    }

    try {
      const data = JSON.parse(text);
      if (validateSchema(data)) return res.json(data);
    } catch {
      // invalid JSON or schema — retry on first attempt
    }
  }

  return res.status(502).json({ error: 'Generation failed — please try again' });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Estimatron running on http://localhost:${PORT}`));
}

module.exports = app;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --testPathPattern=api`
Expected: PASS — 7 tests green.

- [ ] **Step 5: Smoke-test against the real Claude API**

Copy `.env.example` to `.env` and add your real key:
```
ANTHROPIC_API_KEY=sk-ant-api03-...
```

Run: `npm start`

In a second terminal:
```bash
curl -s -X POST http://localhost:3000/api/estimate \
  -H "Content-Type: application/json" \
  -d "{\"requirements\":\"Build a login page with email, password, and Google sign-in\",\"platform\":\"web\"}"
```

Expected: JSON with `title` and `groups` containing `Frontend` and `Backend`.

- [ ] **Step 6: Commit**

```bash
git add server.js tests/api.test.js
git commit -m "feat: Claude API integration with schema validation and one-retry fallback"
```

---

### Task 5: estimateSheet.js — render, edit, grand total, export

**Files:**
- Modify: `public/js/estimateSheet.js` (replace stub)
- Create: `tests/estimateSheet.test.js`

**Interfaces:**
- Consumes: API response `{ title, groups[] }` passed to `renderEstimate(data)`
- Produces: `renderEstimate(data)` — populates `#estimateBody` with live DOM
- Produces: `calculateTotal(groups)` — pure, returns `number` (sum of all mandays)
- Produces: `generateCSV(groups)` — pure, returns CSV string with header row
- Produces: `generateClipboardText(groups)` — pure, returns tab-separated string with header row
- Produces: `recalcTotal()` — reads all `.md-input` in `#estimateBody`, updates `#grandTotal`

- [ ] **Step 1: Write failing tests**

Create `tests/estimateSheet.test.js`:
```js
const { calculateTotal, generateCSV, generateClipboardText } = require('../public/js/estimateSheet');

const sampleGroups = [
  {
    name: 'Frontend',
    tasks:     [{ name: 'Login form',      complexity: 'Low',    mandays: 1.0, notes: null }],
    edgeCases: [{ name: 'Invalid creds',   complexity: 'Low',    mandays: 0.5, notes: null }],
    testing:   [{ name: 'Form unit tests', complexity: 'Low',    mandays: 0.5, notes: null }],
  },
  {
    name: 'Backend',
    tasks:     [{ name: 'Auth endpoint',   complexity: 'Medium', mandays: 1.5, notes: 'JWT handling' }],
    edgeCases: [],
    testing:   [],
  },
];

describe('calculateTotal', () => {
  test('sums all manday values across groups and subgroups', () => {
    expect(calculateTotal(sampleGroups)).toBeCloseTo(3.5);
  });
  test('returns 0 for empty groups array', () => {
    expect(calculateTotal([])).toBe(0);
  });
  test('handles groups with empty subgroup arrays', () => {
    const g = [{ name: 'Backend', tasks: [{ name: 'API', complexity: 'Low', mandays: 2.0, notes: null }], edgeCases: [], testing: [] }];
    expect(calculateTotal(g)).toBe(2.0);
  });
});

describe('generateCSV', () => {
  test('first row is the header', () => {
    expect(generateCSV(sampleGroups).split('\n')[0]).toBe('Group,Subgroup,Task,Complexity,Mandays');
  });
  test('core tasks use "Tasks" as subgroup label', () => {
    expect(generateCSV(sampleGroups)).toContain('Frontend,Tasks,Login form,Low,1');
  });
  test('edge cases use "Edge Cases" as subgroup label', () => {
    expect(generateCSV(sampleGroups)).toContain('Frontend,Edge Cases,Invalid creds,Low,0.5');
  });
  test('testing tasks use "Testing" as subgroup label', () => {
    expect(generateCSV(sampleGroups)).toContain('Frontend,Testing,Form unit tests,Low,0.5');
  });
  test('task names containing commas are quoted', () => {
    const g = [{ name: 'FE', tasks: [{ name: 'Build nav, footer', complexity: 'Low', mandays: 1.0, notes: null }], edgeCases: [], testing: [] }];
    expect(generateCSV(g)).toContain('"Build nav, footer"');
  });
});

describe('generateClipboardText', () => {
  test('first row is tab-separated header', () => {
    expect(generateClipboardText(sampleGroups).split('\n')[0]).toBe('Group\tSubgroup\tTask\tComplexity\tMandays');
  });
  test('data rows are tab-separated', () => {
    expect(generateClipboardText(sampleGroups)).toContain('Frontend\tTasks\tLogin form\tLow\t1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --testPathPattern=estimateSheet`
Expected: FAIL — `calculateTotal` is not a function (stub exports nothing).

- [ ] **Step 3: Replace public/js/estimateSheet.js with full implementation**

```js
// ── Pure utility functions (also exported for Node.js tests) ─────────

function calculateTotal(groups) {
  let total = 0;
  for (const g of groups) {
    for (const t of [...g.tasks, ...g.edgeCases, ...g.testing]) total += t.mandays;
  }
  return Math.round(total * 10) / 10;
}

function csvEscape(value) {
  const s = String(value);
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
    ? `"${s.replace(/"/g, '""')}"` : s;
}

function generateCSV(groups) {
  const rows = ['Group,Subgroup,Task,Complexity,Mandays'];
  for (const g of groups) {
    const push = (label, tasks) =>
      tasks.forEach(t => rows.push([g.name, label, t.name, t.complexity, t.mandays].map(csvEscape).join(',')));
    push('Tasks',      g.tasks);
    push('Edge Cases', g.edgeCases);
    push('Testing',    g.testing);
  }
  return rows.join('\n');
}

function generateClipboardText(groups) {
  const rows = ['Group\tSubgroup\tTask\tComplexity\tMandays'];
  for (const g of groups) {
    const push = (label, tasks) =>
      tasks.forEach(t => rows.push([g.name, label, t.name, t.complexity, t.mandays].join('\t')));
    push('Tasks',      g.tasks);
    push('Edge Cases', g.edgeCases);
    push('Testing',    g.testing);
  }
  return rows.join('\n');
}

// ── DOM rendering ────────────────────────────────────────────────────

function badgeClass(complexity) {
  return complexity === 'Complex' ? 'badge-high'
       : complexity === 'Medium'  ? 'badge-med'
       : 'badge-low';
}

function recalcTotal() {
  let total = 0;
  document.querySelectorAll('#estimateBody .md-input').forEach(inp => {
    total += parseFloat(inp.value) || 0;
  });
  const el = document.getElementById('grandTotal');
  if (el) el.textContent = (Math.round(total * 10) / 10).toFixed(1);
}

function buildTaskRow(task) {
  const row  = document.createElement('div');
  row.className = 'task-row';

  const main = document.createElement('div');
  main.className = 'task-main';

  const nameEl  = document.createElement('span');
  nameEl.className   = 'task-name';
  nameEl.textContent = task.name;

  const badge  = document.createElement('span');
  badge.className   = `complexity-badge ${badgeClass(task.complexity)}`;
  badge.textContent = task.complexity;

  const input  = document.createElement('input');
  input.className = 'md-input';
  input.type      = 'number';
  input.min       = '0.5';
  input.step      = '0.5';
  input.value     = task.mandays;
  input.addEventListener('input', recalcTotal);

  const unit  = document.createElement('span');
  unit.className   = 'md-unit';
  unit.textContent = 'md';

  main.append(nameEl, badge, input, unit);
  row.appendChild(main);

  if (task.notes) {
    const desc  = document.createElement('div');
    desc.className = 'task-desc';

    const label = document.createElement('div');
    label.className   = 'desc-label';
    label.textContent = 'Notes';

    const text  = document.createElement('div');
    text.className   = 'desc-text';
    text.textContent = task.notes;

    desc.append(label, text);
    row.appendChild(desc);
  }

  return row;
}

function groupSubtotal(group) {
  return calculateTotal([group]);
}

function buildGroup(group) {
  const el = document.createElement('div');
  el.className = 'group';

  const header = document.createElement('div');
  header.className = 'group-header';
  header.innerHTML = `
    <span class="group-name">${group.name}</span>
    <div class="group-line"></div>
    <span class="group-subtotal">${groupSubtotal(group).toFixed(1)} md</span>
  `;
  el.appendChild(header);

  group.tasks.forEach(t => el.appendChild(buildTaskRow(t)));

  const addSubgroup = (label, tasks) => {
    if (!tasks.length) return;
    const sub = document.createElement('div');
    sub.className = 'subgroup';
    const lbl = document.createElement('div');
    lbl.className   = 'subgroup-label';
    lbl.textContent = label;
    sub.appendChild(lbl);
    tasks.forEach(t => sub.appendChild(buildTaskRow(t)));
    el.appendChild(sub);
  };

  addSubgroup('Edge Cases', group.edgeCases);
  addSubgroup('Testing',    group.testing);

  return el;
}

function renderEstimate(data) {
  const body = document.getElementById('estimateBody');
  body.innerHTML = '';
  data.groups.forEach(g => body.appendChild(buildGroup(g)));
  recalcTotal();
}

// ── Node.js export for testing ────────────────────────────────────────
if (typeof module !== 'undefined') {
  module.exports = { calculateTotal, generateCSV, generateClipboardText };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --testPathPattern=estimateSheet`
Expected: PASS — 10 tests green.

- [ ] **Step 5: Full end-to-end verification**

Run: `npm start`, open `http://localhost:3000`

1. Select "Web Application", type a feature description, click "Generate Estimation".
2. Verify groups "Frontend" and "Backend" appear, each with Edge Cases and Testing subgroups.
3. Verify Medium/Complex tasks show a Notes panel.
4. Edit a manday input — Grand Total updates immediately.
5. Click "Export CSV" — a `.csv` file downloads with the correct columns.
6. Click "Copy" — success toast appears; paste into a spreadsheet to verify tab-separated columns.
7. Click "↺ Re-generate" — estimate hides, input card re-centres vertically.
8. Select "iOS (Native)", generate → groups are "iOS" and "Backend".
9. Select "Cross-platform Mobile", generate → groups are "iOS", "Android", "Backend".
10. Select "API / Backend only", generate → single "Backend" group.

- [ ] **Step 6: Commit**

```bash
git add public/js/estimateSheet.js tests/estimateSheet.test.js
git commit -m "feat: estimate sheet rendering, live grand total, CSV and clipboard export"
```

---

### Task 6: Full test suite verification

**Files:** none

- [ ] **Step 1: Run entire test suite**

Run: `npm test`
Expected output:
```
PASS tests/api.test.js
PASS tests/estimateSheet.test.js

Test Suites: 2 passed, 2 total
Tests:       17 passed, 17 total
```

- [ ] **Step 2: Run through all error scenarios from spec**

| Scenario | How to trigger | Expected behaviour |
|---|---|---|
| Empty input on load | Fresh page | Button disabled |
| Clear textarea | Type then delete all | Button disables |
| Image > 10 MB | Drop an oversized file | Toast: "file exceeds 10 MB limit" |
| Wrong image format | Drop a `.gif` | Toast: "unsupported format" |
| API key missing | Remove key from `.env`, restart | Toast: "Generation failed" |
| Re-generate | Click ↺ after generation | Sheet hides, input vertically centred |

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: all tests passing, end-to-end verified"
```
