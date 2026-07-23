# Estimatron — Design Spec
**Date:** 2026-07-23
**Status:** Approved

---

## 1. Overview

Estimatron is an internal web tool that helps development teams produce manday estimates for software features. A user pastes requirements text and/or uploads wireframe/UI screenshots; the tool calls the Claude API to break the work down into structured tasks grouped by layer, assigns complexity ratings, and returns an editable estimate sheet the team can tune and export.

---

## 2. Goals

- Any team member can open the URL and generate an estimate with zero setup.
- Estimates are broken down into realistic tasks (including edge cases and testing) grouped by Frontend and Backend.
- The AI-suggested manday values are editable inline; a live grand total always reflects the current numbers.
- Results can be exported as CSV or copied to clipboard for use in project trackers.

---

## 3. Architecture

**Pattern:** Multi-file frontend (vanilla HTML/CSS/JS) served as static files by an Express backend. One API endpoint proxies to Claude.

```
estimatron/
├── server.js              # Express server — serves static files + /api/estimate
├── package.json
├── .env                   # ANTHROPIC_API_KEY (never committed)
└── public/
    ├── index.html         # Single-page UI
    ├── css/
    │   └── style.css      # All styles
    └── js/
        ├── app.js         # Input form logic, image upload, fetch call
        └── estimateSheet.js  # Table rendering, inline editing, grand total, export
```

**Data flow:**
1. User submits requirements text + optional images via the UI.
2. `app.js` encodes images to base64 and POSTs `{ requirements, images[] }` to `/api/estimate`.
3. `server.js` builds a Claude API request (text + vision), streams or awaits the response, and validates the returned JSON.
4. The structured JSON is returned to the browser; `estimateSheet.js` renders the editable table.

---

## 4. Backend

### `POST /api/estimate`

**Request body:**
```json
{
  "requirements": "string (required)",
  "platform": "web | ios | android | cross | api  (required)",
  "images": ["base64 string", "..."]  // optional
}
```

**Processing:**
- Holds `ANTHROPIC_API_KEY` in an environment variable; never exposed to the client.
- Builds a system prompt instructing Claude to return a specific JSON schema (see §6).
- Calls the Claude API using the `claude-sonnet-5` model (supports vision for image inputs). Awaits the full response before returning (no streaming in v1).
- Validates the response is parseable JSON matching the expected schema before forwarding to the client.
- Returns a structured JSON body on success; returns `{ error: string }` with an appropriate HTTP status on failure.

**Other routes:**
- `GET /*` — serves static files from `/public`.

---

## 5. Frontend

### Idle state (before generation)
- The input card is **vertically centered** in the viewport.
- Two-column layout:
  - **Left column:** Platform dropdown stacked above the requirements textarea.
    - Platform options: Web Application · iOS (Native) · Android (Native) · Cross-platform Mobile (React Native / Flutter) · API / Backend only
  - **Right column** (top-aligned with the left): drag-and-drop / click-to-browse image upload zone (PNG, JPG, multiple files), removable thumbnails, and the "Generate Estimation" button at the bottom.
- "Generate Estimation" button is disabled while a request is in flight and shows a loading state.

### Post-generation state
- The input card moves to the top of the page.
- The **Estimate Sheet** appears below with:
  - A toolbar: feature name label, a **platform chip** showing the selected platform (e.g. "Web Application"), "Re-generate" button, "Copy" and "Export CSV" buttons.
  - Top-level groups are determined by the selected platform (see §6). Examples: Web → Frontend + Backend; iOS → iOS + Backend; Cross-platform → iOS + Android + Backend.
  - Each group contains:
    - Core tasks
    - An **Edge Cases** subgroup
    - A **Testing** subgroup
  - Each task row shows: task name | complexity badge (Low / Medium / Complex) | editable manday input.
  - Tasks that are Medium or Complex may include an always-visible **Notes** panel below the row with the AI's explanation of why the task is non-trivial.
  - A sticky **Grand Total** footer that recalculates live as any manday field is edited.

### Export
- **Copy to clipboard** — tab-separated text suitable for pasting into Excel/Sheets.
- **Export CSV** — downloads a `.csv` file with columns: Group, Subgroup, Task, Complexity, Mandays.

---

## 6. Claude Prompt & Response Schema

### Platform → group name mapping

| Platform value | Top-level groups |
|---|---|
| `web` | Frontend, Backend |
| `ios` | iOS, Backend |
| `android` | Android, Backend |
| `cross` | iOS, Android, Backend |
| `api` | Backend |

### System prompt (summary)
> You are a software estimation expert. Given a feature description (and optional UI screenshots) and a target platform, break the work into tasks using the group names appropriate for that platform (e.g. "iOS" and "Backend" for a native iOS project). Within each group, identify core implementation tasks, edge cases, and testing tasks as subgroups. For each task, provide a name, complexity (Low / Medium / Complex), manday estimate (0.5 increments), and — for Medium or Complex tasks — a brief notes field explaining why it is non-trivial. Return only valid JSON matching the schema below.

### Expected JSON schema
```json
{
  "title": "string",
  "groups": [
    {
      "name": "Frontend | Backend",
      "tasks": [
        {
          "name": "string",
          "complexity": "Low | Medium | Complex",
          "mandays": 1.5,
          "notes": "string | null"
        }
      ],
      "edgeCases": [
        { "name": "string", "complexity": "...", "mandays": 0.5, "notes": "string | null" }
      ],
      "testing": [
        { "name": "string", "complexity": "...", "mandays": 0.5, "notes": "string | null" }
      ]
    }
  ]
}
```

The backend validates this schema before returning it to the client. If validation fails, it retries once; if it fails again, it returns a user-facing error.

---

## 7. Visual Design

- **Theme:** Dark professional.
- **Primary accent:** Accenture purple `#A100FF` — used for group headers, manday values, button, grand total, and the glowing logo dot.
- **Background:** `#0b0c10`; surface cards `#0f1117`; row backgrounds `#141720`.
- **Typography:** System UI / Inter. Task names 14px `#f1f5f9`, description text 13px `#94a3b8`, labels 11px uppercase.
- **Complexity badges:**
  - Low — green tint (`#86efac` on `#0f2210`)
  - Medium — indigo tint (`#a5b4fc` on `#1c1a30`)
  - Complex — purple tint (`#d8b4fe` on `#2d0a3e`)
- **Layout:** Full-width, sticky header, single scrollable column.

---

## 8. Error Handling

| Scenario | Behaviour |
|---|---|
| Empty textarea + no images | "Generate Estimation" button disabled |
| Image file too large (>10 MB) | Rejected client-side with inline error |
| Unsupported image format | Rejected client-side with inline error |
| Claude API timeout / 5xx | Toast error: "Generation failed — please try again" |
| Claude returns malformed JSON | One automatic retry; if it fails again, toast error |
| Network offline | Toast error with a "Check your connection" message |

---

## 9. Out of Scope (v1)

- User authentication / per-user API keys
- Server-side persistence or estimate history
- Project management integration (Jira, Linear, etc.)
- Streaming response (full response before rendering)
- Mobile layout optimisation
