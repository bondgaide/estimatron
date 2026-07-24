# Estimatron v1.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance Estimatron with more accurate estimation inputs (existing components, AI assist mode), a richer Backend breakdown (BFF / Orchestrator / Adaptor), better error visibility, and improved estimate sheet UX (collapsible groups).

**Architecture:** All changes are additive to the existing single-page app. New form fields follow the established chip-input pattern. New checkboxes extend the existing Includes row. The Backend group split is a prompt-only change — the schema and renderer are unchanged since BFF/Orchestrator/Adaptor are just regular named groups. Collapsible groups are a pure `estimateSheet.js` change.

**Tech Stack:** Node.js + Express, Vanilla HTML/CSS/JS, Google Gemini API (`gemini-3.5-flash`), Jest + Supertest

## Global Constraints

- `GEMINI_API_KEY` must stay in `.env` — never committed, never sent to the client
- No build step — vanilla HTML/CSS/JS, no bundler
- All new UI components must work in both dark and light mode (use CSS custom properties, not hardcoded hex)
- Mobile responsive — all new form elements must work at 375px viewport
- Existing 26 tests must continue to pass; add new tests where server logic changes
- `includeBackend = false` must exclude BFF, Orchestrator, and Adaptor groups (all three)
- Current version string in `public/index.html` footer: bump to `v1.1.0` on completion

---

## Feature 1: Error highlighting on empty requirements

**Files:**
- Modify: `public/css/style.css`
- Modify: `public/js/app.js`

**Behaviour:**
- When Generate is clicked with an empty requirements field AND no images uploaded, the textarea gets `border-color: #ef4444` and plays a short horizontal shake animation (`@keyframes shake`)
- The red border is removed the moment the user starts typing (`input` event)
- The existing toast error message is unchanged

**CSS to add:**
```css
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%       { transform: translateX(-6px); }
  40%       { transform: translateX(6px); }
  60%       { transform: translateX(-4px); }
  80%       { transform: translateX(4px); }
}
.textarea.error {
  border-color: #ef4444;
  animation: shake 0.35s ease;
}
```

**JS logic in `generateBtn` click handler** — before the existing `startLoading()` call:
```js
if (!requirements && uploadedImages.length === 0) {
  requirementsEl.classList.add('error');
  showToast('Please describe the feature you want to estimate');
  return;
}
```

**JS — clear error on input:**
```js
requirementsEl.addEventListener('input', () => {
  requirementsEl.classList.remove('error');
  updateButtonState();
});
```

Note: the existing `updateButtonState` listener on `input` must be merged with the error-clear listener, or both can be attached separately (both fire on `input`).

---

## Feature 2: GA and AI Assist checkboxes

**Files:**
- Modify: `public/index.html`
- Modify: `public/js/app.js`
- Modify: `server.js`
- Modify: `tests/api.test.js`

**HTML — extend the includes row:**
```html
<label class="check-label" id="includeGaLabel" for="includeGaCheck">
  <input type="checkbox" id="includeGaCheck" />
  GA
</label>
<label class="check-label" for="includeAiAssistCheck">
  <input type="checkbox" id="includeAiAssistCheck" checked />
  AI Assist
</label>
```

**GA checkbox rules:**
- Unchecked by default
- Disabled + `disabled` class when platform is `api`
- When platform changes to `api`: `includeGaCheck.disabled = true; includeGaCheck.checked = false`
- When platform changes away from `api`: `includeGaCheck.disabled = false`

**AI Assist checkbox rules:**
- Checked by default (`checked` attribute in HTML)
- Always enabled regardless of platform

**JS — read values in generate handler:**
```js
const includeGa       = includeGaCheck.checked && !includeGaCheck.disabled;
const includeAiAssist = includeAiAssistCheck.checked;
```

**JS — include in fetch body:**
```js
body: JSON.stringify({ ..., includeGa, includeAiAssist })
```

**Server — destructure new params with defaults:**
```js
const { ..., includeGa = false, includeAiAssist = true } = req.body;
```

**Server — pass to `callGemini`:**
```js
async function callGemini(requirements, platform, images, includeTesting, includeBackend, techStack, includeGa, includeAiAssist)
```

**Server — append to instructions string:**
```js
if (includeGa) instructions += '\nIMPORTANT: Include Google Analytics implementation tasks in every Frontend group. These tasks should cover: GA4 setup and configuration, page view tracking, custom event definitions, and cookie/consent integration.\n';
if (includeAiAssist) instructions += '\nIMPORTANT: This project uses AI coding assistance tools (e.g. GitHub Copilot, Cursor). Calibrate all manday estimates to reflect AI-assisted development — well-understood patterns and boilerplate tasks should be estimated lower than they would be without AI tooling.\n';
```

---

## Feature 3: Existing Components tag chip field

**Files:**
- Modify: `public/index.html`
- Modify: `public/css/style.css`
- Modify: `public/js/app.js`
- Modify: `server.js`

**Position:** Below the requirements textarea, above the Existing Components label (i.e. it becomes the last field before the bottom of `.input-left`).

**HTML — add after `<textarea>`:**
```html
<div class="existing-comp-row">
  <div class="existing-comp-header">
    <span class="tech-stack-label">Existing Components</span>
    <span class="upload-optional">Optional</span>
  </div>
  <div class="tech-chip-area">
    <div class="tech-chip-wrap" id="existingCompWrap">
      <span id="existingCompChips"></span>
      <input class="tech-chip-input" id="existingCompInput" type="text"
             placeholder="e.g. Custom TextField, Auth Service, BFF Layer…" autocomplete="off" />
    </div>
  </div>
</div>
```

Note: No dropdown for this field — it is free-entry only (type + Enter or comma). All chips use the neutral `Custom` style from `TECH_CAT_STYLES` / `TECH_CAT_STYLES_LIGHT`.

**CSS — reuse existing tech stack classes; add only:**
```css
.existing-comp-row { display: flex; flex-direction: column; gap: 6px; }
.existing-comp-header { display: flex; align-items: center; gap: 8px; }
.existing-comp-header .upload-optional { margin-top: 0; }
```

**JS state + DOM refs:**
```js
let existingChips = [];
const existingCompWrap  = document.getElementById('existingCompWrap');
const existingCompInput = document.getElementById('existingCompInput');
const existingCompChips = document.getElementById('existingCompChips');
```

**JS chip logic** — same pattern as Tech Stack chips but no category, no dropdown:
- Enter or comma key → add chip (trim, deduplicate, ignore empty)
- Backspace on empty input → remove last chip
- × button on chip → remove that chip
- All chips rendered with `TECH_CAT_STYLES.Custom` / `TECH_CAT_STYLES_LIGHT.Custom` inline styles, calling `getCatStyle('Custom')`

**JS — include in fetch body:**
```js
body: JSON.stringify({ ..., existingComponents: existingChips.map(c => c.label) })
```

**Server — destructure and pass:**
```js
const { ..., existingComponents = [] } = req.body;
```

Append to user message (before `instructions`):
```js
if (existingComponents.length > 0) {
  userText += `\n\nExisting components / foundation already in place: ${existingComponents.join(', ')}`;
  userText += `\nDo not generate tasks for these. If an existing component reduces the scope of a task, reflect that with a lower manday estimate and note it.`;
}
```

---

## Feature 4: Backend → BFF / Orchestrator / Adaptor split

**Files:**
- Modify: `server.js`

**System prompt — update group name rules:**

Replace current:
```
Platform group names to use:
- "web":     groups "Frontend" and "Backend"
- "ios":     groups "iOS" and "Backend"
- "android": groups "Android" and "Backend"
- "cross":   groups "iOS", "Android", and "Backend"
- "api":     group "Backend" only
```

With:
```
Platform group names to use:
- "web":     groups "Frontend", "BFF", "Orchestrator", and "Adaptor"
- "ios":     groups "iOS", "BFF", "Orchestrator", and "Adaptor"
- "android": groups "Android", "BFF", "Orchestrator", and "Adaptor"
- "cross":   groups "iOS", "Android", "BFF", "Orchestrator", and "Adaptor"
- "api":     groups "BFF", "Orchestrator", and "Adaptor"

Layer definitions:
- BFF (Backend-for-Frontend): API gateway, request aggregation, response shaping, authentication token handling, rate limiting
- Orchestrator: business logic, use-case coordination, service composition, workflow management
- Adaptor: external service integrations, third-party APIs, database repositories, message queues, storage adapters
```

**System prompt — update `includeBackend` instruction:**

Replace current:
```
'\nIMPORTANT: Do NOT include a group named "Backend" in your response.\n'
```

With:
```
'\nIMPORTANT: Do NOT include any of the following groups in your response: "BFF", "Orchestrator", "Adaptor".\n'
```

**System prompt — add to `COMPREHENSIVE CORE TASK COVERAGE` block:**
```
- For BFF tasks: include endpoint definitions, request validation, response mapping, and auth middleware
- For Orchestrator tasks: include use-case classes, service calls, error propagation, and transaction handling
- For Adaptor tasks: include repository implementations, DTO mapping, retry logic, and external API error handling
```

**System prompt — add to `COMPREHENSIVE CORE TASK COVERAGE` block (Taxonomy/CMS):**
```
- If the requirements involve content types, taxonomies, or CMS integrations, include tasks for content modelling, taxonomy setup, CMS configuration, content migration, and taxonomy API endpoints
```

---

## Feature 5: Collapsible estimate groups

**Files:**
- Modify: `public/js/estimateSheet.js`
- Modify: `public/css/style.css`

**Behaviour:**
- `renderEstimate(data)` receives the full data object; if `data.groups.length > 1`, all groups start collapsed
- If `data.groups.length === 1`, the single group starts expanded with no toggle UI
- Clicking a group header toggles expanded/collapsed state
- Grand total and per-group subtotals always reflect all tasks regardless of collapse state

**CSS to add:**
```css
.group-header { cursor: default; }
.group-header.collapsible { cursor: pointer; user-select: none; }
.group-header.collapsible:hover .group-name { color: var(--text); }
.group-chevron {
  font-size: 12px; color: var(--text4); flex-shrink: 0;
  transform: rotate(90deg); transition: transform 0.2s; display: none;
}
.group-header.collapsible .group-chevron { display: inline; }
.group-body { display: flex; flex-direction: column; }
.group.collapsed .group-body { display: none; }
.group.collapsed .group-chevron { transform: rotate(0deg); }
```

**`buildGroup` changes in `estimateSheet.js`:**

```js
function buildGroup(group, collapsible, startCollapsed) {
  const el = document.createElement('div');
  el.className = 'group' + (startCollapsed ? ' collapsed' : '');

  const header = document.createElement('div');
  header.className = 'group-header' + (collapsible ? ' collapsible' : '');
  header.innerHTML = `
    <span class="group-name"></span>
    <span class="group-chevron">▶</span>
    <div class="group-line"></div>
    <span class="group-subtotal"></span>
  `;
  header.querySelector('.group-name').textContent = group.name;
  header.querySelector('.group-subtotal').textContent = groupSubtotal(group).toFixed(1) + ' md';

  if (collapsible) {
    header.addEventListener('click', () => el.classList.toggle('collapsed'));
  }
  el.appendChild(header);

  const body = document.createElement('div');
  body.className = 'group-body';
  group.tasks.forEach(t => body.appendChild(buildTaskRow(t, group.tasks)));
  appendAddControls(body, group.tasks);
  body.appendChild(buildSubgroup('Edge Cases', group.edgeCases));
  body.appendChild(buildSubgroup('Testing',    group.testing));
  el.appendChild(body);

  return el;
}
```

**`renderEstimate` changes:**
```js
function renderEstimate(data) {
  const body   = document.getElementById('estimateBody');
  const multi  = data.groups.length > 1;
  body.innerHTML = '';
  data.groups.forEach(g => body.appendChild(buildGroup(g, multi, multi)));
  recalcTotal();
}
```

Note: `buildGroup` currently appends tasks and subgroups directly to `el`. The change wraps them in a `body` div so `display:none` can hide the content while the header (with subtotal) stays visible.

---

## Version bump

After all tasks are complete, update the footer in `public/index.html`:
```html
<footer class="app-footer">v1.1.0</footer>
```

---

## Test updates (`tests/api.test.js`)

The existing `callGemini` mock must be updated to accept the new signature:
```js
callGemini(requirements, platform, images, includeTesting, includeBackend, techStack, includeGa, includeAiAssist)
```

Add a test verifying `includeGa: true` appends GA instructions to the prompt, and `includeAiAssist: false` omits the AI assist instruction.
