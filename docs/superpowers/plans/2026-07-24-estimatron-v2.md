# Estimatron v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add mobile responsiveness, inline task editing, manual add/remove tasks, image thumbnails, a pulsing loading state, INCLUDES checkboxes, and a richer Gemini prompt to Estimatron.

**Architecture:** All frontend changes are in vanilla HTML/CSS/JS with no build step — edit the source files directly and the browser reloads them. Backend changes are confined to `server.js`. The live-sync edit pattern (`row._taskRef = task`) replaces the old position-based `syncEditsToEstimate` so that add/remove and inline edits all stay in sync with `window._currentEstimate` automatically.

**Tech Stack:** Node.js 18+ / Express 4, Gemini API (`@google/generative-ai ^0.21.0`), vanilla HTML/CSS/JS, Jest 29 + supertest 7.

## Global Constraints

- Model must remain `gemini-3.5-flash` — no model changes.
- API key `GEMINI_API_KEY` stays in `.env` (git-ignored). Never hard-code it.
- `notes` field changes from `string | null` to `string[] | null` — **breaking schema change**. Both `validateSchema` and the Gemini prompt must enforce arrays.
- All 26 existing tests must stay green after every task (or be updated in the same commit that introduces the breaking change).
- No new npm dependencies — vanilla only.
- No TypeScript, no build step, no framework additions.
- `window._currentEstimate` remains the shared state object between `app.js` and `estimateSheet.js`.
- `window.renderEstimate` and `window.showToast` remain the cross-script interface.
- CSS variable palette is fixed: `--accent: #A100FF`, `--bg: #0b0c10`, `--surface: #0f1117`, etc. Use existing variables.

---

## File Map

| File | What changes |
|---|---|
| `server.js` | Accept `includeTesting`/`includeBackend`; new SYSTEM_PROMPT; `validateSchema` notes as `string[]` |
| `tests/api.test.js` | Update `validPayload` notes to array; add INCLUDES param tests |
| `public/index.html` | INCLUDES checkboxes; upload zone text + SVG icon |
| `public/css/style.css` | Loading state animations; task-row new styles; upload flex; notes styles; INCLUDES styles; mobile media query |
| `public/js/app.js` | Image thumbnails; INCLUDES wiring; loading state management; send new params |
| `public/js/estimateSheet.js` | Full row rebuild with inline editing, badge selector, add/remove, notes bullets; `_taskRef` live-sync; export Notes column |
| `tests/estimateSheet.test.js` | Update `sampleGroups` notes to array; update CSV/clipboard assertions |

---

### Task 1: Server — INCLUDES params + prompt overhaul + notes as `string[]`

**Files:**
- Modify: `server.js`
- Modify: `tests/api.test.js`

**Interfaces:**
- Produces: `POST /api/estimate` now accepts optional `includeTesting: boolean` (default `true`) and `includeBackend: boolean` (default `true`) in request body.
- Produces: `validateSchema` now requires `notes` to be `null` or a non-empty `string[]`. String `notes` values now **fail** validation.
- Produces: `module.exports.validateSchema` (unchanged export name).

- [ ] **Step 1: Update `validPayload` in `tests/api.test.js` to use notes as an array**

Replace `notes: 'JWT handling'` with an array so that after `validateSchema` is updated the existing tests still pass:

```js
// tests/api.test.js  — change only the Backend task's notes field
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
      tasks:     [{ name: 'Auth endpoint',   complexity: 'Medium', mandays: 1.5, notes: ['JWT requires token rotation on each refresh', 'Must handle concurrent refresh races'] }],
      edgeCases: [],
      testing:   [],
    },
  ],
};
```

- [ ] **Step 2: Add INCLUDES param tests and validateSchema tests to `tests/api.test.js`**

Append a new `describe` block at the bottom of the file:

```js
describe('POST /api/estimate — INCLUDES params', () => {
  test('accepts includeTesting: false and returns 200', async () => {
    const noTestingPayload = {
      ...validPayload,
      groups: validPayload.groups.map(g => ({ ...g, testing: [] })),
    };
    makeClient(jest.fn().mockResolvedValue({ response: { text: () => JSON.stringify(noTestingPayload) } }));
    const res = await request(app)
      .post('/api/estimate')
      .send({ requirements: 'login screen', platform: 'web', includeTesting: false });
    expect(res.status).toBe(200);
  });

  test('accepts includeBackend: false and returns 200', async () => {
    const noBackendPayload = {
      title: 'Login Screen',
      groups: [validPayload.groups[0]],
    };
    makeClient(jest.fn().mockResolvedValue({ response: { text: () => JSON.stringify(noBackendPayload) } }));
    const res = await request(app)
      .post('/api/estimate')
      .send({ requirements: 'login screen', platform: 'web', includeBackend: false });
    expect(res.status).toBe(200);
  });
});

describe('validateSchema', () => {
  const { validateSchema } = require('../server');

  test('accepts notes as null', () => {
    expect(validateSchema(validPayload)).toBe(true);
  });

  test('rejects notes as a plain string (breaking change from v1)', () => {
    const bad = JSON.parse(JSON.stringify(validPayload));
    bad.groups[1].tasks[0].notes = 'plain string';
    expect(validateSchema(bad)).toBe(false);
  });

  test('accepts notes as a non-empty string array', () => {
    const good = JSON.parse(JSON.stringify(validPayload));
    good.groups[1].tasks[0].notes = ['first bullet', 'second bullet'];
    expect(validateSchema(good)).toBe(true);
  });

  test('rejects notes as an empty array', () => {
    const bad = JSON.parse(JSON.stringify(validPayload));
    bad.groups[1].tasks[0].notes = [];
    expect(validateSchema(bad)).toBe(false);
  });
});
```

- [ ] **Step 3: Run existing tests to confirm they pass before touching `server.js`**

```bash
npm test
```

Expected: 26 tests passing (the new describe blocks with `validateSchema` will fail because server.js still has the old logic — that is expected).

Actually at this point some of the new `validateSchema` tests will fail (e.g. "rejects notes as a plain string") because the old `validateSchema` still accepts strings. The two INCLUDES tests will pass because the server ignores unknown params. That's fine — the new describe blocks are the test spec for what we're about to implement.

- [ ] **Step 4: Update `validateSchema` in `server.js`**

Replace the `notes` check inside the task loop:

```js
// OLD:
if (task.notes !== null && typeof task.notes !== 'string') return false;

// NEW:
if (task.notes !== null) {
  if (!Array.isArray(task.notes) || task.notes.length === 0) return false;
  if (!task.notes.every(n => typeof n === 'string' && n.trim().length > 0)) return false;
}
```

Full updated `validateSchema` function:

```js
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
      if (typeof task.name !== 'string')                           return false;
      if (!['Low', 'Medium', 'Complex'].includes(task.complexity)) return false;
      if (typeof task.mandays !== 'number' || task.mandays < 0.5) return false;
      if (task.notes !== null) {
        if (!Array.isArray(task.notes) || task.notes.length === 0) return false;
        if (!task.notes.every(n => typeof n === 'string' && n.trim().length > 0)) return false;
      }
    }
  }
  return true;
}
```

- [ ] **Step 5: Replace `SYSTEM_PROMPT` in `server.js`**

Replace the entire `const SYSTEM_PROMPT = \`...\`` block with:

```js
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

EXHAUSTIVE EDGE CASE COVERAGE — you MUST include separate tasks for ALL of the following categories within edgeCases:
- Error / failure states: wrong credentials, expired tokens, network timeout, server 5xx responses
- Validation: client-side field validation (format, required, length) AND server-side validation errors
- Empty states: what the UI shows when there is no data to display
- Loading / skeleton states: any async operation that needs a loading indicator
- Security edge cases: rate limiting, brute-force protection, input sanitisation
- Accessibility: keyboard navigation, screen reader labels (flag as Low complexity when straightforward)
Ask yourself: what happens when it fails, when input is invalid, when the server is slow, and when the user has no data? Each of these must appear as a task.

For each task item:
- name: specific and actionable (e.g. "POST /auth/login endpoint" not "implement auth")
- complexity: exactly one of "Low", "Medium", or "Complex"
  - Low: straightforward, well-understood pattern, under 1 day
  - Medium: non-obvious decisions, cross-system coordination, 1–2 days
  - Complex: significant unknowns, tricky integrations, or many interacting edge cases, 2+ days
- mandays: estimate in 0.5 increments, minimum 0.5
- notes: for Medium or Complex tasks, return a JSON array of 2–4 strings — each string is one specific bullet point explaining WHY this task is non-trivial or what exactly must be handled. For Low tasks, return null.

Return ONLY valid JSON — no markdown fences, no preamble. Your entire response must be parseable by JSON.parse().

Schema:
{
  "title": "short feature name (3–6 words)",
  "groups": [
    {
      "name": "string",
      "tasks":     [{ "name": "string", "complexity": "Low|Medium|Complex", "mandays": 0.5, "notes": ["string", ...] | null }],
      "edgeCases": [{ "name": "string", "complexity": "Low|Medium|Complex", "mandays": 0.5, "notes": ["string", ...] | null }],
      "testing":   [{ "name": "string", "complexity": "Low|Medium|Complex", "mandays": 0.5, "notes": ["string", ...] | null }]
    }
  ]
}`;
```

- [ ] **Step 6: Update `callGemini` and the route handler in `server.js` to handle INCLUDES params**

Update the function signature and add conditional instructions:

```js
async function callGemini(requirements, platform, images, includeTesting, includeBackend) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.5-flash',
    systemInstruction: SYSTEM_PROMPT,
  });

  const parts = [];
  for (const img of images) {
    parts.push({ inlineData: { mimeType: img.mediaType, data: img.data } });
  }

  let instructions = '';
  if (!includeTesting) instructions += '\nIMPORTANT: Return an empty array `[]` for the "testing" field on every group.\n';
  if (!includeBackend) instructions += '\nIMPORTANT: Do NOT include a group named "Backend" in your response.\n';

  parts.push({ text: `Platform: ${platform}\n\nFeature requirements:\n${requirements}${instructions}` });

  const result = await model.generateContent(parts);
  return result.response.text();
}
```

Update the route handler to read and pass the new params:

```js
app.post('/api/estimate', async (req, res) => {
  const { requirements, platform, images = [], includeTesting = true, includeBackend = true } = req.body;

  if (!requirements || !requirements.trim()) {
    return res.status(400).json({ error: 'requirements is required' });
  }
  if (!VALID_PLATFORMS.includes(platform)) {
    return res.status(400).json({ error: 'invalid platform value' });
  }

  for (let attempt = 0; attempt <= 1; attempt++) {
    let text;
    try {
      text = await callGemini(requirements, platform, images, includeTesting, includeBackend);
    } catch (err) {
      console.error('Gemini API error:', err.message);
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
```

- [ ] **Step 7: Run all tests and confirm they pass**

```bash
npm test
```

Expected: all tests pass. The `validateSchema` describe block's 4 tests should now all be green. Total: 30 tests passing.

- [ ] **Step 8: Commit**

```bash
git add server.js tests/api.test.js
git commit -m "feat: INCLUDES params, notes as string[] schema, exhaustive prompt"
```

---

### Task 2: HTML — INCLUDES checkboxes + upload zone update

**Files:**
- Modify: `public/index.html`

**Interfaces:**
- Consumes: nothing from Task 1 (pure HTML structure changes)
- Produces: DOM IDs `includeTestingCheck` and `includeBackendCheck` for Task 4 to wire up.
- Produces: updated upload zone with class `.upload-icon-svg` (SVG element) replacing the `.upload-icon` emoji div.

- [ ] **Step 1: Add INCLUDES row to `public/index.html`**

In the `.input-left` div, insert the INCLUDES row **between** the `.platform-row` div and the `<textarea>`:

```html
<!-- BEFORE (existing): -->
<div class="input-left">
  <div class="platform-row">
    ...
  </div>
  <textarea ...></textarea>
</div>

<!-- AFTER: -->
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
  <div class="includes-row">
    <span class="includes-label">Includes</span>
    <label class="check-label" for="includeTestingCheck">
      <input type="checkbox" id="includeTestingCheck" checked />
      Testing
    </label>
    <label class="check-label" id="includeBackendLabel" for="includeBackendCheck">
      <input type="checkbox" id="includeBackendCheck" checked />
      Backend
    </label>
  </div>
  <textarea
    class="textarea"
    id="requirements"
    placeholder="Paste feature description, user stories, or acceptance criteria here…&#10;&#10;E.g. &quot;Build a login screen with email/password, social login (Google), and a remember-me option…&quot;"
  ></textarea>
</div>
```

- [ ] **Step 2: Update the upload zone in `public/index.html`**

Replace the emoji upload zone content with an SVG icon and updated text:

```html
<!-- BEFORE: -->
<div class="upload-zone" id="uploadZone">
  <div class="upload-icon">🖼️</div>
  <div class="upload-text">Drop wireframes or screens</div>
  <div class="upload-sub">PNG · JPG · WEBP · Multiple files OK</div>
</div>

<!-- AFTER: -->
<div class="upload-zone" id="uploadZone">
  <svg class="upload-icon-svg" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
    <path d="M16 21V9M16 9l-6 6M16 9l6 6" stroke="#A100FF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M5 25h22" stroke="#A100FF" stroke-width="2.2" stroke-linecap="round"/>
  </svg>
  <div class="upload-text">Drop wireframes, screen designs here</div>
  <div class="upload-sub">PNG · JPG · WEBP · Multiple files OK</div>
</div>
```

- [ ] **Step 3: Verify the full `public/index.html` is correct**

Open the file and confirm:
1. `.input-left` contains: `.platform-row` → `.includes-row` → `textarea` (in that order)
2. `.includes-row` contains two `<label>` elements with IDs `includeTestingCheck` and `includeBackendCheck`
3. `.upload-zone` contains the SVG element (no emoji)
4. All original IDs are still present: `#platformSelect`, `#requirements`, `#uploadZone`, `#fileInput`, `#thumbRow`, `#generateBtn`, `#estimateSection`, `#estimateBody`, `#estimateTitle`, `#platformChip`, `#regenBtn`, `#exportCsvBtn`, `#copyBtn`, `#grandTotal`, `#toastContainer`

- [ ] **Step 4: Commit**

```bash
git add public/index.html
git commit -m "feat: INCLUDES checkboxes and updated upload zone text/icon"
```

---

### Task 3: CSS — Mobile responsive + loading state + all new component styles

**Files:**
- Modify: `public/css/style.css`

**Interfaces:**
- Consumes: new DOM structure from Task 2 (`.includes-row`, `.upload-icon-svg`, etc.)
- Produces: all CSS classes that Tasks 4 and 5 will add/remove dynamically:
  - `.input-card.is-loading` — pulsing border animation
  - `.btn-generate.is-loading` — spinner row layout
  - `.btn-spinner` — CSS spinner element
  - `.status-msg` — cycling message text
  - `.task-name-edit` — inline name input
  - `.badge-group` — flex container for 3 complexity badges
  - `.complexity-badge.dim` — inactive badge (opacity 0.25)
  - `.task-remove-btn` — remove task button
  - `.add-task-btn` — dashed "+ Add task" button
  - `.add-form` — inline add-task form container
  - `.add-form-name`, `.add-form-md` — form inputs
  - `.add-form-actions`, `.add-form-confirm`, `.add-form-cancel` — form buttons
  - `.notes-editable` — contenteditable notes area
  - `.notes-placeholder` — "+ Add notes…" placeholder
  - `.task-desc.has-notes .desc-label` — NOTES label visible only when notes present
  - `.includes-row`, `.includes-label`, `.check-label`, `.check-label.disabled`
  - `@media (max-width: 768px)` — all mobile overrides

- [ ] **Step 1: Add the upload zone flex-grow and fix `align-items` on `.input-cols`**

In the existing `.input-cols` rule, change `align-items: start` to `align-items: stretch`:

```css
/* BEFORE: */
.input-cols { display: grid; grid-template-columns: 1fr 340px; gap: 24px; align-items: start; }

/* AFTER: */
.input-cols { display: grid; grid-template-columns: 1fr 340px; gap: 24px; align-items: stretch; }
```

Add `flex: 1` to `.upload-zone` so it fills the right-column height:

```css
/* BEFORE: */
.upload-zone {
  border: 1.5px dashed #3b1f5e; border-radius: 10px; padding: 22px 16px;
  text-align: center; background: #110d1a; cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

/* AFTER: */
.upload-zone {
  flex: 1;
  border: 1.5px dashed #3b1f5e; border-radius: 10px; padding: 22px 16px;
  text-align: center; background: #110d1a; cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
}
```

Replace the emoji `.upload-icon` rule with SVG styles:

```css
/* REMOVE: */
.upload-icon { font-size: 24px; margin-bottom: 6px; }

/* ADD: */
.upload-icon-svg { display: block; margin-bottom: 8px; flex-shrink: 0; }
```

Add `flex-shrink: 0` to `.btn-generate` so it stays pinned at the bottom:

```css
/* BEFORE: */
.btn-generate {
  background: var(--accent); color: white; ...
}

/* AFTER: */
.btn-generate {
  background: var(--accent); color: white; border: none; border-radius: 10px;
  padding: 14px 22px; font-size: 15px; font-weight: 700; cursor: pointer; width: 100%;
  box-shadow: 0 4px 24px var(--accent-glow); letter-spacing: 0.3px;
  transition: box-shadow 0.15s, opacity 0.15s;
  flex-shrink: 0;
}
```

- [ ] **Step 2: Add loading state styles**

Append after the existing `.btn-generate` rules:

```css
/* ── Loading state ── */
@keyframes pulse-border {
  0%, 100% { border-color: var(--border); box-shadow: none; }
  50%       { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-dim); }
}
@keyframes spin { to { transform: rotate(360deg); } }

.input-card.is-loading { animation: pulse-border 2s ease-in-out infinite; }

.btn-generate.is-loading {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  opacity: 1; cursor: not-allowed;
}
.btn-spinner {
  width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0;
}
.status-msg {
  font-size: 12px; color: var(--text3); text-align: center; margin-top: 6px; min-height: 18px;
  transition: opacity 0.3s;
}
```

- [ ] **Step 3: Update task-row styles for inline editing and remove button**

Replace the existing `.task-name` rule and add new rules:

```css
/* REMOVE: */
.task-name { flex: 1; font-size: 14px; color: var(--text); font-weight: 500; padding-top: 1px; line-height: 1.5; }

/* ADD: */
.task-name-edit {
  flex: 1; background: transparent; border: none;
  border-bottom: 1.5px dashed transparent; color: var(--text);
  font-size: 14px; font-weight: 500; padding: 1px 0; outline: none;
  font-family: inherit; line-height: 1.5; min-width: 0;
}
.task-name-edit:focus { border-bottom-color: var(--border2); }
```

Update `.complexity-badge` to add `cursor: pointer` and a transition, and add `.badge-group` and `.dim`:

```css
/* BEFORE: */
.complexity-badge { font-size: 10px; font-weight: 700; padding: 3px 9px; border-radius: 20px; flex-shrink: 0; margin-top: 2px; white-space: nowrap; }

/* AFTER: */
.complexity-badge { font-size: 10px; font-weight: 700; padding: 3px 9px; border-radius: 20px; flex-shrink: 0; margin-top: 2px; white-space: nowrap; cursor: pointer; transition: opacity 0.15s; user-select: none; }
.complexity-badge.dim { opacity: 0.25; }
.badge-group { display: flex; gap: 5px; flex-shrink: 0; flex-wrap: wrap; }
```

Add remove button styles:

```css
/* ── Remove task button ── */
.task-remove-btn {
  background: none; border: none; color: var(--text4); font-size: 13px;
  cursor: pointer; flex-shrink: 0; padding: 2px 6px; line-height: 1;
  border-radius: 4px; opacity: 0; transition: opacity 0.15s, color 0.15s;
}
.task-row:hover .task-remove-btn { opacity: 1; }
.task-remove-btn:hover { color: #fca5a5; }
```

- [ ] **Step 4: Add add-task button and inline form styles**

```css
/* ── Add task ── */
.add-task-btn {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 7px 12px; margin-top: 6px; background: none;
  border: 1.5px dashed var(--border2); border-radius: 9px; width: 100%;
  color: var(--text4); font-size: 13px; font-family: inherit; cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.add-task-btn:hover { border-color: var(--accent); color: var(--accent); }

.add-form {
  margin-top: 6px; background: var(--surface);
  border: 1px solid var(--border2); border-radius: 9px; padding: 12px 14px;
  display: flex; flex-direction: column; gap: 10px;
}
.add-form-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.add-form-name {
  flex: 1; min-width: 120px; background: var(--surface2); border: 1.5px solid var(--border2);
  border-radius: 7px; padding: 7px 10px; font-size: 14px; color: var(--text);
  outline: none; font-family: inherit; transition: border-color 0.15s;
}
.add-form-name:focus { border-color: var(--accent); }
.add-form-md {
  width: 60px; background: var(--surface2); border: 1.5px solid var(--border2);
  border-radius: 7px; padding: 7px; font-size: 14px; color: var(--accent);
  text-align: center; outline: none; font-family: inherit; transition: border-color 0.15s;
}
.add-form-md:focus { border-color: var(--accent); }
.add-form-actions { display: flex; gap: 8px; justify-content: flex-end; }
.add-form-confirm {
  background: var(--accent); color: white; border: none; border-radius: 7px;
  padding: 7px 16px; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit;
}
.add-form-confirm:disabled { opacity: 0.4; cursor: not-allowed; }
.add-form-cancel {
  background: none; border: 1px solid var(--border2); color: var(--text3);
  border-radius: 7px; padding: 7px 14px; font-size: 13px; cursor: pointer; font-family: inherit;
}
.add-form-cancel:hover { border-color: var(--accent); color: #c084fc; }
```

- [ ] **Step 5: Update notes styles**

Replace the existing `.task-desc`, `.desc-label`, `.desc-text` rules:

```css
/* REMOVE: */
.task-desc { padding: 10px 16px 14px; border-top: 1px solid #1a1020; background: #0f0d16; }
.desc-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--accent); margin-bottom: 6px; }
.desc-text { font-size: 13px; color: var(--text3); line-height: 1.75; }

/* ADD: */
.task-desc { padding: 10px 16px 14px; border-top: 1px solid #1a1020; background: #0f0d16; }
.desc-label { display: none; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--accent); margin-bottom: 6px; }
.task-desc.has-notes .desc-label { display: block; }
.notes-editable { font-size: 13px; color: var(--text3); line-height: 1.75; outline: none; min-height: 24px; }
.notes-editable ul { padding-left: 18px; }
.notes-editable li { margin-bottom: 2px; }
.notes-placeholder { font-size: 12px; color: var(--text4); cursor: pointer; padding: 2px 0; }
.notes-placeholder:hover { color: var(--accent); }
```

- [ ] **Step 6: Add INCLUDES checkbox styles**

Append after the `.platform-select` rules:

```css
/* ── INCLUDES checkboxes ── */
.includes-row { display: flex; align-items: center; gap: 14px; }
.includes-label { font-size: 13px; font-weight: 600; color: var(--text3); white-space: nowrap; }
.check-label {
  display: flex; align-items: center; gap: 7px; font-size: 14px; font-weight: 600;
  color: var(--text2); cursor: pointer; user-select: none;
}
.check-label input[type="checkbox"] { accent-color: var(--accent); width: 16px; height: 16px; cursor: pointer; }
.check-label.disabled { opacity: 0.4; cursor: not-allowed; }
.check-label.disabled input[type="checkbox"] { cursor: not-allowed; }
```

- [ ] **Step 7: Add mobile media query**

Append at the very end of the file:

```css
/* ── Mobile ── */
@media (max-width: 768px) {
  .main { padding: 16px; gap: 20px; }
  .app-header { padding: 0 16px; }
  .input-card { padding: 20px 16px; }
  .input-cols { grid-template-columns: 1fr; align-items: start; }
  .upload-zone { flex: none; }
  .estimate-toolbar { padding: 14px 16px; gap: 10px; }
  .estimate-body { padding: 16px; gap: 24px; }
  .total-bar { padding: 14px 16px; }
  .badge-group { flex-wrap: wrap; }
  .export-btns { width: 100%; }
  .btn-sm { flex: 1; text-align: center; }
  .task-remove-btn { opacity: 1; }
  .task-main { flex-wrap: wrap; }
}
@media (hover: none) {
  .task-remove-btn { opacity: 1; }
}
```

- [ ] **Step 8: Verify no tests broke (CSS doesn't affect Jest tests)**

```bash
npm test
```

Expected: 30 tests passing (same as after Task 1).

- [ ] **Step 9: Commit**

```bash
git add public/css/style.css
git commit -m "feat: mobile responsive, loading state, inline edit, add/remove task CSS"
```

---

### Task 4: app.js — Image thumbnails + INCLUDES wiring + loading state

**Files:**
- Modify: `public/js/app.js`

**Interfaces:**
- Consumes: DOM IDs `includeTestingCheck`, `includeBackendCheck`, `includeBackendLabel` from Task 2.
- Consumes: CSS classes `.is-loading`, `.btn-spinner`, `.status-msg` from Task 3.
- Consumes: `uploadedImages` array members are `{ data: string, mediaType: string }` objects (unchanged from v1).
- Produces: `window._currentEstimate` populated with the new `notes: string[] | null` shape (now that the server returns it).
- Produces: `generateBtn` gains/removes `.is-loading` class during fetch.
- Produces: `.input-card` gains/removes `.is-loading` class during fetch.
- Produces: fetch body now includes `includeTesting: boolean, includeBackend: boolean`.

- [ ] **Step 1: Update `renderThumbs` in `app.js` to show real image previews**

Replace the entire `renderThumbs` function:

```js
function renderThumbs() {
  thumbRow.innerHTML = '';
  uploadedImages.forEach((img, i) => {
    const thumb = document.createElement('div');
    thumb.className = 'thumb';

    const preview = document.createElement('img');
    preview.src = `data:${img.mediaType};base64,${img.data}`;
    preview.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:7px;';
    thumb.appendChild(preview);

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
```

- [ ] **Step 2: Add INCLUDES checkbox DOM references and platform-change handler**

After the existing DOM element references block (after `const copyBtn = ...`), add:

```js
const includeTestingCheck  = document.getElementById('includeTestingCheck');
const includeBackendCheck  = document.getElementById('includeBackendCheck');
const includeBackendLabel  = document.getElementById('includeBackendLabel');
const inputCard            = document.querySelector('.input-card');
```

Add a platform change handler (after the `requirementsEl.addEventListener('input', updateButtonState)` line):

```js
platformSelect.addEventListener('change', () => {
  const isApiOnly = platformSelect.value === 'api';
  includeBackendCheck.disabled = isApiOnly;
  includeBackendLabel.classList.toggle('disabled', isApiOnly);
  if (isApiOnly) includeBackendCheck.checked = false;
  else           includeBackendCheck.checked = true;
});
```

- [ ] **Step 3: Add loading state helpers**

After the `updateButtonState` function, add:

```js
const STATUS_MESSAGES = [
  'Analysing requirements…',
  'Identifying task groups…',
  'Breaking down edge cases…',
  'Estimating complexity…',
  'Calculating mandays…',
  'Almost there…',
];

let _loadingInterval = null;
let _statusMsgEl     = null;

function startLoading() {
  inputCard.classList.add('is-loading');
  generateBtn.classList.add('is-loading');
  generateBtn.innerHTML = '<span class="btn-spinner"></span>Generating…';
  generateBtn.disabled = true;

  _statusMsgEl = document.createElement('p');
  _statusMsgEl.className = 'status-msg';
  _statusMsgEl.textContent = STATUS_MESSAGES[0];
  generateBtn.insertAdjacentElement('afterend', _statusMsgEl);

  let idx = 0;
  _loadingInterval = setInterval(() => {
    idx = (idx + 1) % STATUS_MESSAGES.length;
    _statusMsgEl.textContent = STATUS_MESSAGES[idx];
  }, 3000);
}

function stopLoading() {
  inputCard.classList.remove('is-loading');
  generateBtn.classList.remove('is-loading');
  generateBtn.innerHTML = 'Generate Estimation';
  if (_loadingInterval) { clearInterval(_loadingInterval); _loadingInterval = null; }
  if (_statusMsgEl)     { _statusMsgEl.remove(); _statusMsgEl = null; }
}
```

- [ ] **Step 4: Update the generate click handler to use loading state and send INCLUDES params**

Replace the entire `generateBtn.addEventListener('click', ...)` block:

```js
generateBtn.addEventListener('click', async () => {
  const requirements  = requirementsEl.value.trim();
  const platform      = platformSelect.value;
  const includeTesting = includeTestingCheck.checked;
  const includeBackend = includeBackendCheck.checked && !includeBackendCheck.disabled;

  startLoading();

  try {
    const res  = await fetch('/api/estimate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ requirements, platform, images: uploadedImages, includeTesting, includeBackend }),
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Generation failed — please try again');
      return;
    }

    window._currentEstimate    = data;
    estimateTitleEl.textContent = data.title || 'Untitled Estimate';
    platformChipEl.textContent  = PLATFORM_LABELS[platform];
    if (window.renderEstimate) window.renderEstimate(data);
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
    stopLoading();
    updateButtonState();
  }
});
```

- [ ] **Step 5: Remove the old `generateBtn.disabled = true; generateBtn.textContent = 'Generating…';` lines**

The old button-dim code in the handler from v1 is now replaced by `startLoading()` / `stopLoading()`. Also remove the old `generateBtn.textContent = 'Generate Estimation';` line from the `finally` block (it's now inside `stopLoading`).

Double-check the handler has no remnant from the old pattern:
- No `generateBtn.disabled = true;` at the top
- No `generateBtn.textContent = 'Generating…';` at the top
- No `generateBtn.textContent = 'Generate Estimation';` in `finally`
- Only `startLoading()` at top, `stopLoading()` in `finally`, `updateButtonState()` in `finally`

- [ ] **Step 6: Run all tests**

```bash
npm test
```

Expected: 30 tests passing. (`app.test.js` tests only `validateFile` and `encodeImageToBase64` which are unchanged.)

- [ ] **Step 7: Commit**

```bash
git add public/js/app.js
git commit -m "feat: image thumbnails, INCLUDES wiring, pulsing loading state"
```

---

### Task 5: estimateSheet.js — Inline editing, add/remove, notes bullets, _taskRef, export Notes column

**Files:**
- Modify: `public/js/estimateSheet.js`
- Modify: `tests/estimateSheet.test.js`

**Interfaces:**
- Consumes: CSS classes from Task 3: `.task-name-edit`, `.badge-group`, `.complexity-badge.dim`, `.task-remove-btn`, `.add-task-btn`, `.add-form`, `.add-form-row`, `.add-form-name`, `.add-form-md`, `.add-form-actions`, `.add-form-confirm`, `.add-form-cancel`, `.notes-editable`, `.notes-placeholder`, `.task-desc.has-notes`.
- Consumes: `task.notes` is now `string[] | null` (from server Task 1).
- Produces: `window.renderEstimate(data)` — unchanged signature, updated internals.
- Produces: `syncEditsToEstimate()` — now a no-op (live-sync via `_taskRef`); kept so `app.js` calls don't break.
- Produces: `generateCSV(groups)` — now includes a `Notes` column; notes array joined with ` | `.
- Produces: `generateClipboardText(groups)` — now includes a `Notes` column; notes array joined with ` | `.
- Produces: module exports unchanged: `{ calculateTotal, generateCSV, generateClipboardText }`.

- [ ] **Step 1: Update `sampleGroups` in `tests/estimateSheet.test.js` to use notes as arrays**

```js
const sampleGroups = [
  {
    name: 'Frontend',
    tasks:     [{ name: 'Login form',      complexity: 'Low',    mandays: 1.0, notes: null }],
    edgeCases: [{ name: 'Invalid creds',   complexity: 'Low',    mandays: 0.5, notes: null }],
    testing:   [{ name: 'Form unit tests', complexity: 'Low',    mandays: 0.5, notes: null }],
  },
  {
    name: 'Backend',
    tasks:     [{ name: 'Auth endpoint',   complexity: 'Medium', mandays: 1.5, notes: ['JWT requires token rotation on each refresh', 'Must handle concurrent refresh races'] }],
    edgeCases: [],
    testing:   [],
  },
];
```

- [ ] **Step 2: Update CSV/clipboard tests in `tests/estimateSheet.test.js` for the new Notes column**

Replace the entire `describe('generateCSV', ...)` and `describe('generateClipboardText', ...)` blocks:

```js
describe('generateCSV', () => {
  test('first row is the header with Notes column', () => {
    expect(generateCSV(sampleGroups).split('\n')[0]).toBe('Group,Subgroup,Task,Complexity,Mandays,Notes');
  });
  test('core tasks use "Tasks" as subgroup label', () => {
    expect(generateCSV(sampleGroups)).toContain('Frontend,Tasks,Login form,Low,1,');
  });
  test('edge cases use "Edge Cases" as subgroup label', () => {
    expect(generateCSV(sampleGroups)).toContain('Frontend,Edge Cases,Invalid creds,Low,0.5,');
  });
  test('testing tasks use "Testing" as subgroup label', () => {
    expect(generateCSV(sampleGroups)).toContain('Frontend,Testing,Form unit tests,Low,0.5,');
  });
  test('task names containing commas are quoted', () => {
    const g = [{ name: 'FE', tasks: [{ name: 'Build nav, footer', complexity: 'Low', mandays: 1.0, notes: null }], edgeCases: [], testing: [] }];
    expect(generateCSV(g)).toContain('"Build nav, footer"');
  });
  test('notes array is joined with " | " in the Notes column', () => {
    expect(generateCSV(sampleGroups)).toContain('JWT requires token rotation on each refresh | Must handle concurrent refresh races');
  });
  test('null notes renders as empty Notes column', () => {
    const csv = generateCSV(sampleGroups);
    const loginRow = csv.split('\n').find(r => r.includes('Login form'));
    expect(loginRow).toBeDefined();
    expect(loginRow.endsWith(',')).toBe(true);
  });
});

describe('generateClipboardText', () => {
  test('first row is tab-separated header with Notes column', () => {
    expect(generateClipboardText(sampleGroups).split('\n')[0]).toBe('Group\tSubgroup\tTask\tComplexity\tMandays\tNotes');
  });
  test('data rows are tab-separated', () => {
    expect(generateClipboardText(sampleGroups)).toContain('Frontend\tTasks\tLogin form\tLow\t1\t');
  });
  test('notes array is joined with " | " in clipboard Notes column', () => {
    expect(generateClipboardText(sampleGroups)).toContain('JWT requires token rotation on each refresh | Must handle concurrent refresh races');
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail (driving the implementation)**

```bash
npm test -- --testPathPattern=estimateSheet
```

Expected: several failures in `generateCSV` and `generateClipboardText` tests because the functions don't yet emit a Notes column.

- [ ] **Step 4: Update `generateCSV` and `generateClipboardText` in `estimateSheet.js`**

```js
function generateCSV(groups) {
  const rows = ['Group,Subgroup,Task,Complexity,Mandays,Notes'];
  for (const g of groups) {
    const push = (label, tasks) =>
      tasks.forEach(t => {
        const notes = Array.isArray(t.notes) ? t.notes.join(' | ') : '';
        rows.push([g.name, label, t.name, t.complexity, t.mandays, notes].map(csvEscape).join(','));
      });
    push('Tasks',      g.tasks);
    push('Edge Cases', g.edgeCases);
    push('Testing',    g.testing);
  }
  return rows.join('\n');
}

function generateClipboardText(groups) {
  const rows = ['Group\tSubgroup\tTask\tComplexity\tMandays\tNotes'];
  for (const g of groups) {
    const push = (label, tasks) =>
      tasks.forEach(t => {
        const notes = Array.isArray(t.notes) ? t.notes.join(' | ') : '';
        rows.push([g.name, label, t.name, t.complexity, t.mandays, notes].map(tsvEscape).join('\t'));
      });
    push('Tasks',      g.tasks);
    push('Edge Cases', g.edgeCases);
    push('Testing',    g.testing);
  }
  return rows.join('\n');
}
```

- [ ] **Step 5: Run tests to confirm export tests pass**

```bash
npm test -- --testPathPattern=estimateSheet
```

Expected: all estimateSheet tests passing.

- [ ] **Step 6: Replace `syncEditsToEstimate` with a no-op**

```js
function syncEditsToEstimate() {
  // no-op: edits are synced live to window._currentEstimate via _taskRef on each event
}
```

- [ ] **Step 7: Add the new helper functions above `buildTaskRow` in `estimateSheet.js`**

Add these functions between `recalcTotal` and `buildTaskRow`:

```js
// Tracks which add-form is currently open so only one is open at a time
let _openAddForm = null;

function collapseOpenAddForm() {
  if (_openAddForm) {
    _openAddForm.style.display = 'none';
    if (_openAddForm._addBtn) _openAddForm._addBtn.style.display = '';
    _openAddForm = null;
  }
}

function buildNotesEditable(task, desc, row) {
  const editable = document.createElement('div');
  editable.className = 'notes-editable';
  editable.contentEditable = 'true';
  const ul = document.createElement('ul');
  (task.notes || []).forEach(note => {
    const li = document.createElement('li');
    li.textContent = note;
    ul.appendChild(li);
  });
  editable.appendChild(ul);
  editable.addEventListener('blur', () => {
    const items = Array.from(editable.querySelectorAll('li'))
      .map(li => li.textContent.trim())
      .filter(Boolean);
    if (items.length === 0) {
      row._taskRef.notes = null;
      desc.classList.remove('has-notes');
      editable.replaceWith(buildNotesPlaceholder(task, desc, row));
    } else {
      row._taskRef.notes = items;
    }
  });
  return editable;
}

function buildNotesPlaceholder(task, desc, row) {
  const placeholder = document.createElement('div');
  placeholder.className = 'notes-placeholder';
  placeholder.textContent = '+ Add notes…';
  placeholder.addEventListener('click', () => {
    task.notes = [];
    desc.classList.add('has-notes');
    const editable = buildNotesEditable(task, desc, row);
    const li = document.createElement('li');
    editable.querySelector('ul').appendChild(li);
    placeholder.replaceWith(editable);
    editable.focus();
    const range = document.createRange();
    const sel = window.getSelection();
    range.setStart(li, 0);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  });
  return placeholder;
}

function buildAddForm(taskArr, containerEl, addBtn) {
  let selectedComplexity = 'Low';

  const form = document.createElement('div');
  form.className = 'add-form';
  form._addBtn = addBtn;

  const row1 = document.createElement('div');
  row1.className = 'add-form-row';

  const nameInput = document.createElement('input');
  nameInput.className = 'add-form-name';
  nameInput.placeholder = 'Task name…';
  nameInput.type = 'text';

  const badgeGroup = document.createElement('div');
  badgeGroup.className = 'badge-group';
  ['Low', 'Medium', 'Complex'].forEach((level, i) => {
    const b = document.createElement('span');
    b.className = `complexity-badge ${badgeClass(level)}${i !== 0 ? ' dim' : ''}`;
    b.textContent = level;
    b.addEventListener('click', () => {
      selectedComplexity = level;
      badgeGroup.querySelectorAll('.complexity-badge').forEach(el => el.classList.add('dim'));
      b.classList.remove('dim');
    });
    badgeGroup.appendChild(b);
  });

  const mdInput = document.createElement('input');
  mdInput.className = 'add-form-md';
  mdInput.type = 'number';
  mdInput.min = '0.5';
  mdInput.step = '0.5';
  mdInput.value = '0.5';

  row1.append(nameInput, badgeGroup, mdInput);

  const actions = document.createElement('div');
  actions.className = 'add-form-actions';

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'add-form-confirm';
  confirmBtn.textContent = 'Add';
  confirmBtn.type = 'button';
  confirmBtn.disabled = true;

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'add-form-cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.type = 'button';

  nameInput.addEventListener('input', () => {
    confirmBtn.disabled = !nameInput.value.trim();
  });

  function resetForm() {
    nameInput.value = '';
    confirmBtn.disabled = true;
    selectedComplexity = 'Low';
    badgeGroup.querySelectorAll('.complexity-badge').forEach((b, i) => b.classList.toggle('dim', i !== 0));
    mdInput.value = '0.5';
    form.style.display = 'none';
    addBtn.style.display = '';
    if (_openAddForm === form) _openAddForm = null;
  }

  cancelBtn.addEventListener('click', resetForm);

  confirmBtn.addEventListener('click', () => {
    const newTask = {
      name: nameInput.value.trim(),
      complexity: selectedComplexity,
      mandays: parseFloat(mdInput.value) || 0.5,
      notes: null,
    };
    taskArr.push(newTask);
    const newRow = buildTaskRow(newTask, taskArr);
    containerEl.insertBefore(newRow, addBtn);
    resetForm();
    recalcTotal();
  });

  actions.append(cancelBtn, confirmBtn);
  form.append(row1, actions);
  return form;
}

function appendAddControls(containerEl, taskArr) {
  const addBtn = document.createElement('button');
  addBtn.className = 'add-task-btn';
  addBtn.textContent = '+ Add task';

  const form = buildAddForm(taskArr, containerEl, addBtn);
  form.style.display = 'none';

  addBtn.addEventListener('click', () => {
    collapseOpenAddForm();
    _openAddForm = form;
    addBtn.style.display = 'none';
    form.style.display = '';
    form.querySelector('.add-form-name').focus();
  });

  containerEl.appendChild(addBtn);
  containerEl.appendChild(form);
}
```

- [ ] **Step 8: Replace `buildTaskRow` with the new inline-editing version**

```js
function buildTaskRow(task, taskArr) {
  const row = document.createElement('div');
  row.className = 'task-row';
  row._taskRef = task;
  row._taskArr = taskArr;

  const main = document.createElement('div');
  main.className = 'task-main';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'task-name-edit';
  nameInput.value = task.name;
  nameInput.addEventListener('input', () => { row._taskRef.name = nameInput.value; });

  const badgeGroup = document.createElement('div');
  badgeGroup.className = 'badge-group';
  ['Low', 'Medium', 'Complex'].forEach(level => {
    const b = document.createElement('span');
    b.className = `complexity-badge ${badgeClass(level)}${level !== task.complexity ? ' dim' : ''}`;
    b.textContent = level;
    b.addEventListener('click', () => {
      badgeGroup.querySelectorAll('.complexity-badge').forEach(el => el.classList.add('dim'));
      b.classList.remove('dim');
      row._taskRef.complexity = level;
    });
    badgeGroup.appendChild(b);
  });

  const mdInput = document.createElement('input');
  mdInput.className = 'md-input';
  mdInput.type = 'number';
  mdInput.min = '0.5';
  mdInput.step = '0.5';
  mdInput.value = task.mandays;
  mdInput.addEventListener('input', () => {
    const val = parseFloat(mdInput.value);
    if (!isNaN(val) && val >= 0.5) row._taskRef.mandays = val;
    recalcTotal();
  });

  const unit = document.createElement('span');
  unit.className = 'md-unit';
  unit.textContent = 'md';

  const removeBtn = document.createElement('button');
  removeBtn.className = 'task-remove-btn';
  removeBtn.title = 'Remove task';
  removeBtn.textContent = '✕';
  removeBtn.type = 'button';
  removeBtn.addEventListener('click', () => {
    const idx = row._taskArr.indexOf(row._taskRef);
    if (idx !== -1) row._taskArr.splice(idx, 1);
    row.remove();
    recalcTotal();
  });

  main.append(nameInput, badgeGroup, mdInput, unit, removeBtn);
  row.appendChild(main);

  const desc = document.createElement('div');
  desc.className = 'task-desc' + (Array.isArray(task.notes) && task.notes.length > 0 ? ' has-notes' : '');

  const label = document.createElement('div');
  label.className = 'desc-label';
  label.textContent = 'Notes';
  desc.appendChild(label);

  if (Array.isArray(task.notes) && task.notes.length > 0) {
    desc.appendChild(buildNotesEditable(task, desc, row));
  } else {
    desc.appendChild(buildNotesPlaceholder(task, desc, row));
  }

  row.appendChild(desc);
  return row;
}
```

- [ ] **Step 9: Replace `buildGroup` with the new version (subgroups always rendered, add controls in all)**

```js
function buildSubgroup(label, taskArr) {
  const sub = document.createElement('div');
  sub.className = 'subgroup';

  const lbl = document.createElement('div');
  lbl.className = 'subgroup-label';
  lbl.textContent = label;
  sub.appendChild(lbl);

  taskArr.forEach(t => sub.appendChild(buildTaskRow(t, taskArr)));
  appendAddControls(sub, taskArr);
  return sub;
}

function buildGroup(group) {
  const el = document.createElement('div');
  el.className = 'group';

  const header = document.createElement('div');
  header.className = 'group-header';
  header.innerHTML = `
    <span class="group-name"></span>
    <div class="group-line"></div>
    <span class="group-subtotal"></span>
  `;
  header.querySelector('.group-name').textContent = group.name;
  header.querySelector('.group-subtotal').textContent = groupSubtotal(group).toFixed(1) + ' md';
  el.appendChild(header);

  group.tasks.forEach(t => el.appendChild(buildTaskRow(t, group.tasks)));
  appendAddControls(el, group.tasks);

  el.appendChild(buildSubgroup('Edge Cases', group.edgeCases));
  el.appendChild(buildSubgroup('Testing',    group.testing));

  return el;
}
```

- [ ] **Step 10: Run all tests**

```bash
npm test
```

Expected: all 30 tests passing.

- [ ] **Step 11: Commit**

```bash
git add public/js/estimateSheet.js tests/estimateSheet.test.js
git commit -m "feat: inline editing, add/remove tasks, notes bullets, _taskRef live sync, Notes column in exports"
```

---

## Self-Review Checklist

**Spec coverage:**

| Spec section | Covered by |
|---|---|
| 3.1 Mobile responsive (768px, stacked columns, padding reductions) | Task 3 (CSS) |
| 3.2 Manual task add/remove (per-subgroup inline form, `_taskRef`) | Task 5 |
| 3.3 Inline name editing (`task-name-edit` input, blur sync) | Task 5 |
| 3.3 3-badge complexity selector, dim inactive | Task 5 |
| 3.3 Editable notes with placeholder restore | Task 5 |
| 3.3 NOTES label hidden until `has-notes` | Task 3 (CSS) + Task 5 |
| 3.4 Image thumbnails (base64 `<img>` src) | Task 4 |
| 3.5 Loading state Option A (pulse card, spinner btn, cycling messages) | Task 3 (CSS) + Task 4 |
| 3.5 Upload zone SVG icon + text update | Task 2 + Task 3 |
| 3.6 INCLUDES checkboxes (Testing + Backend) | Task 2 + Task 4 + Task 1 |
| 3.6 Backend greyed (not hidden) when platform=api | Task 4 |
| 4.1 Notes as `string[]` schema | Task 1 |
| 4.1 Notes rendered as `<ul><li>` bullets | Task 5 |
| 4.1 CSV/clipboard notes column joined with ` \| ` | Task 5 |
| 4.2 Exhaustive edge case categories in prompt | Task 1 |
| 4.3 Prompt instructs notes as JSON array | Task 1 |

All spec sections covered. No gaps found.

**Placeholder scan:** No TBDs, no "handle appropriately" or "similar to Task N" patterns. All code blocks are complete.

**Type consistency:**
- `buildTaskRow(task, taskArr)` — defined in Task 5 Step 8, called with same signature in Steps 7, 9.
- `buildNotesEditable(task, desc, row)` and `buildNotesPlaceholder(task, desc, row)` — defined and called with matching signatures.
- `appendAddControls(containerEl, taskArr)` — defined in Step 7, called in Steps 9.
- `collapseOpenAddForm()` — defined once in Step 7, called once in `appendAddControls`.
- `syncEditsToEstimate()` — no-op in Step 6; `app.js` calls it before exports which is harmless.
- `generateCSV` / `generateClipboardText` — both export a Notes column, tests updated to match.
- `validPayload` in `tests/api.test.js` uses notes as array; `sampleGroups` in `tests/estimateSheet.test.js` uses notes as array — consistent.
