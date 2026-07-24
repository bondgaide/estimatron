# Estimatron

> AI-powered manday estimation tool for development teams.

Paste your feature requirements (or upload wireframe screenshots), pick a platform, and get a structured task breakdown with complexity ratings and manday estimates — ready to edit and export in seconds.

---

## Features

- **AI task breakdown** — Gemini analyses your requirements and splits work into Frontend, Backend, iOS, Android groups depending on your platform
- **Edge cases & testing included** — every group comes with edge case handling and testing tasks, not just core implementation
- **Complexity badges** — each task is rated Low, Medium, or Complex with an explanation for non-trivial work
- **Includes toggles** — opt out of Testing and/or Backend groups before generating; Backend is auto-enabled and locked for API-only platforms
- **Tech Stack field** — optional tag input to specify your technologies (React, Node.js, PostgreSQL, etc.); categories are filtered by platform and Backend toggle, and passed to the AI for more targeted estimates
- **Inline editing** — rename tasks, change complexity, adjust manday values; grand total and group subtotals update live
- **Add / remove tasks** — manually insert new tasks or delete generated ones directly in the estimate sheet
- **Image upload** — attach wireframes or UI screenshots for more accurate estimates (PNG, JPG, WEBP — max 10 MB each)
- **Export** — download as CSV or copy tab-separated text straight into Excel / Google Sheets
- **Light / dark mode** — click the purple dot in the header to toggle; preference is saved across sessions

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML, CSS, JavaScript |
| Backend | Node.js + Express |
| AI | Google Gemini 3.5 Flash |
| Deployment | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Google AI Studio](https://aistudio.google.com) API key

### Local setup

```bash
# 1. Clone the repo
git clone https://github.com/bondgaide/estimatron.git
cd estimatron

# 2. Install dependencies
npm install

# 3. Add your API key
cp .env.example .env
# Open .env and replace your_key_here with your Gemini API key

# 4. Start the server
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Usage

1. Select your **platform** (Web, iOS, Android, Cross-platform, or API/Backend only)
2. Use the **Includes** checkboxes to opt in/out of Testing and Backend groups
3. Optionally pick your **Tech Stack** — type or search to add technology tags
4. Paste your **feature requirements** in the text area
5. Optionally **upload wireframes** or UI screenshots (PNG, JPG, WEBP — max 10 MB each)
6. Click **Generate Estimation**
7. Review the breakdown — rename tasks, adjust complexity badges, edit manday values, add or remove tasks
8. **Export CSV** or **Copy** to paste into your project tracker

---

## Project Structure

```
estimatron/
├── server.js              # Express server + Gemini API integration
├── package.json
├── .env.example           # Environment variable template
└── public/
    ├── index.html         # Single-page UI
    ├── css/
    │   └── style.css      # Dark/light theme design system
    └── js/
        ├── app.js         # Form logic, image upload, API call
        └── estimateSheet.js  # Table rendering, editing, export
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Your Google AI Studio API key |
| `PORT` | Server port (default: `3000`) |

---

## Deployment

This project is configured for one-click deployment on **Vercel**.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

After deploying, add `GEMINI_API_KEY` in your Vercel project's **Settings → Environment Variables**.

---

## Running Tests

```bash
npm test
```

26 tests across 3 test suites covering API validation, image handling, schema validation, and export functions.

---

## License

Internal tool — Accenture use only.
