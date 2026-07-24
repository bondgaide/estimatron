# Estimatron v2 — Design Spec
**Date:** 2026-07-24
**Status:** Approved

---

## 1. Overview

This spec covers five incremental improvements to Estimatron:

1. Mobile responsive layout
2. Manual task add / remove on the estimate sheet
3. Full inline editing of task rows (name, complexity, notes)
4. Gemini prompt overhaul for richer, more exhaustive output
5. INCLUDES checkboxes to optionally exclude Testing or Backend groups before generation

---

## 2. Files Affected

| File | Changes |
|---|---|
| `public/css/style.css` | Mobile media query; upload zone flex-grow; loading state styles; notes/placeholder styles; greyed checkbox |
| `public/index.html` | INCLUDES checkboxes; updated upload text; no structural DOM changes |
| `public/js/app.js` | Send `includeTesting` / `includeBackend` in request body; loading state (pulsing card, cycling messages, spinner button); platform-change handler to disable Backend checkbox |
| `public/js/estimateSheet.js` | Inline name editing; 3-badge complexity selector; editable notes with placeholder restore; add-task inline form per subgroup; remove-task button; `syncEditsToEstimate` update for dynamic rows |
| `server.js` | Accept `includeTesting` / `includeBackend` params; updated system prompt (exhaustive coverage, bullet notes, conditional groups) |

---

## 3. Feature Designs

### 3.1 Mobile Responsive Layout

A single CSS media query at `max-width: 768px`:

- `.input-cols` grid collapses from `1fr 340px` to a single column (`1fr`)
- Upload zone and Generate button move below the requirements textarea
- `.main` padding reduces from `44px` to `16px`
- `.app-header` padding reduces to `0 16px`
- `.estimate-toolbar` wraps and export buttons stack
- `.task-main` allows badge group to wrap on very narrow screens
- No HTML or JS changes required

### 3.2 Manual Task Add / Remove

**Remove:**
- Every task row gains a `✕` remove button (`.task-remove-btn`) on the far right
- Hidden by default on desktop (`opacity: 0`), revealed on `.task-row:hover`
- Always visible on mobile (no hover state)
- Clicking removes the row from the DOM and calls `recalcTotal()`
- The corresponding task object is removed from `window._currentEstimate` via a `data-group` / `data-sub` / `data-index` reference stored on the row element

**Add:**
- Each subgroup (Core Tasks, Edge Cases, Testing) renders a `+ Add task` dashed button below its last row
- Clicking expands an inline form (`.add-form`) within that subgroup:
  - Text input: task name (required to confirm)
  - 3-badge complexity selector (default: Low)
  - Number input: mandays (default: 0.5, min: 0.5, step: 0.5)
  - `Add` button (disabled until name is non-empty) and `Cancel` button
- Confirming adds the task to the DOM and pushes a task object to the correct array in `window._currentEstimate`, then calls `recalcTotal()`
- Cancel collapses the form back to the `+ Add task` button
- Only one add-form open at a time (opening a second collapses any open form)

### 3.3 Inline Task Editing

**Task name:**
- Rendered as `<input type="text" class="task-name-edit">` (not a `<span>`)
- Styled to look like plain text until focused (transparent background, dashed bottom border on focus)
- `blur` event syncs the value back to the task object in `window._currentEstimate`

**Complexity:**
- All three badges rendered side by side on every row: Low · Medium · Complex
- Active badge: full colour; inactive badges: `opacity: 0.25`
- Clicking an inactive badge switches it to active (removes `dim` from clicked, adds `dim` to others)
- Updates the task object's `complexity` field in `window._currentEstimate`

**Notes:**
- Tasks with notes: `<div class="notes-editable" contenteditable="true">` containing a `<ul>` of bullet `<li>` elements
- The `NOTES` label (`desc-label`) is hidden by default; it only shows when the `.task-desc` has class `has-notes`
- Tasks without notes: show `<div class="notes-placeholder">＋ Add notes…</div>`; no label shown
- Clicking the placeholder: replaces it with a `contenteditable` area, shows the label, focuses the cursor inside a new `<li>`
- On `blur` of the contenteditable: if `innerText.trim()` is empty, remove `has-notes`, replace with the placeholder, hide the label
- Notes changes sync to `window._currentEstimate` on blur

**`syncEditsToEstimate` replacement:**
- Current position-based index approach breaks when rows are added/removed
- New approach: each task row stores references directly — `row._taskRef = taskObject` (a direct object reference into `window._currentEstimate`)
- Export functions read from `window._currentEstimate` which is kept in sync at every edit event

### 3.4 Loading State (Option A)

When the Generate button is clicked and a request is in flight:

**Card:** `.input-card` gains class `is-loading`, which applies:
```css
animation: pulse-border 2s ease-in-out infinite;
/* pulses the border between default and accent purple */
```

**Button:** replaced with a flex row containing a CSS spinner + "Generating…" text; button is disabled

**Cycling message:** a `<p class="status-msg">` renders below the button, cycling through these messages every 3 seconds via `setInterval`:
1. "Analysing requirements…"
2. "Identifying task groups…"
3. "Breaking down edge cases…"
4. "Estimating complexity…"
5. "Calculating mandays…"
6. "Almost there…"

On success or error: remove `is-loading` class, clear the interval, restore button text, remove the message element.

**Upload zone text** (not loading-specific — applies always):
- Change from "Drop wireframes here" to "Drop wireframes, screen designs here"
- Replace emoji icon with minimal 2D SVG arrow-up icon (32×32, stroke style, accent colour)
- Upload zone uses `flex: 1` to fill full right-column height; Generate button `flex-shrink: 0` stays pinned at bottom

### 3.5 INCLUDES Checkboxes

**UI — Input form:**

A new `INCLUDES` section label added to the left column of the input card, between Platform and Requirements:

```
PLATFORM   [Web Application ▾]
INCLUDES   [ ✓ Testing ]  [ ✓ Backend ]
REQUIREMENTS  [textarea…]
```

- Two checkboxes side by side: `Testing` (id: `includeTestingCheck`) and `Backend` (id: `includeBackendCheck`)
- Both default to checked
- When platform is `api`: Backend checkbox is `disabled` and visually greyed (`opacity: 0.4`, `cursor: not-allowed`) — not hidden
- Platform `<select>` change event updates the Backend checkbox disabled state

**API request:**

`app.js` includes two new fields in the POST body:
```json
{ "requirements": "...", "platform": "web", "images": [...], "includeTesting": true, "includeBackend": true }
```

**Server:**

`server.js` reads `includeTesting` (default `true`) and `includeBackend` (default `true`) from request body.

The system prompt conditionally includes or omits:
- If `includeTesting: false` → instruct Gemini to omit the `testing` array from all groups (return empty array `[]`)
- If `includeBackend: false` → instruct Gemini to omit the Backend group entirely

`validateSchema` remains unchanged (empty arrays are valid).

**Rendering:**

`estimateSheet.js` `addSubgroup()` already skips subgroups with empty arrays — no change needed there. Groups with no name (omitted Backend) simply won't appear.

---

## 4. Gemini Prompt Overhaul

### 4.1 Notes format change

**Old schema:** `"notes": "string | null"`

**New schema:** `"notes": ["string", "string", ...] | null`

Each string is one bullet point — a specific, actionable detail. Gemini must return an array for Medium/Complex tasks, `null` for Low tasks.

`validateSchema` updated: `notes` must be `null` or an array of strings (each non-empty).

Rendering: `buildTaskRow` renders `notes` as `<ul><li>` elements instead of a plain text block.

Export (CSV/clipboard): bullet points joined with ` | ` in the notes column.

### 4.2 Exhaustive coverage instruction

The system prompt is updated to explicitly require coverage of these categories within Edge Cases:

- **Error / failure states:** wrong credentials, expired tokens, network timeout, server 5xx
- **Validation:** client-side field validation (format, required, length) AND server-side validation
- **Empty states:** what the UI shows when there is no data
- **Loading / skeleton states:** any async operation that needs a loading indicator
- **Security edge cases:** rate limiting, brute-force protection, input sanitisation
- **Accessibility:** keyboard navigation, screen reader labels (flag as Low complexity if straightforward)

The prompt instructs Gemini: *"For every user-facing feature, ask yourself: what happens when it fails, when input is invalid, when the server is slow, and when the user has no data? Each of these must appear as a task."*

### 4.3 Prompt structure

The prompt instructs Gemini to return `notes` as a JSON array, not a string:

```
- notes: for Medium or Complex tasks, return a JSON array of 2–4 strings, each a specific bullet point explaining WHY this task is non-trivial or what must be handled. For Low tasks, return null.
```

---

## 5. Error Handling (unchanged)

All existing error handling (toast on API failure, 502 on Gemini error, retry on schema failure) remains. `validateSchema` is updated to accept `notes: string[] | null`.

---

## 6. Out of Scope (v2)

- Drag-to-reorder tasks
- Save / load estimate history
- Undo/redo for edits
- Streaming Gemini response
