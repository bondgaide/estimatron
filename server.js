require('dotenv').config();
const express   = require('express');
const path      = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

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
      if (task.notes !== null) {
        if (!Array.isArray(task.notes) || task.notes.length === 0) return false;
        if (!task.notes.every(n => typeof n === 'string' && n.trim().length > 0)) return false;
      }
    }
  }
  return true;
}

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

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Estimatron running on http://localhost:${PORT}`));
}

module.exports = app;
module.exports.validateSchema = validateSchema;
