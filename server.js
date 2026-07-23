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
module.exports.validateSchema = validateSchema;
