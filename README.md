# Estimatron

> AI-powered manday estimation tool for development teams.

Paste your feature requirements (or upload wireframe screenshots), pick a platform, and get a structured task breakdown with complexity ratings and manday estimates — ready to edit and export in seconds.

---

## Features

- **AI task breakdown** — Gemini analyses your requirements and splits work into Frontend, Backend, iOS, Android groups depending on your platform
- **Edge cases & testing included** — every group comes with edge case handling and testing tasks, not just core implementation
- **Complexity badges** — each task is rated Low, Medium, or Complex with an explanation for non-trivial work
- **Inline editing** — adjust any manday value; the grand total and group subtotals update live
- **Image upload** — attach wireframes or UI screenshots for more accurate estimates
- **Export** — download as CSV or copy tab-separated text straight into Excel / Google Sheets

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
git clone https://github.com/YOUR_USERNAME/estimatron.git
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
2. Paste your **feature requirements** in the text area
3. Optionally **upload wireframes** or UI screenshots (PNG, JPG, WEBP — max 10 MB each)
4. Click **Generate Estimation**
5. Review the breakdown, adjust manday values as needed
6. **Export CSV** or **Copy** to paste into your project tracker

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
    │   └── style.css      # Dark theme design system
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
