require('dotenv').config();
const express   = require('express');
const path      = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const VALID_PLATFORMS = ['web', 'ios', 'android', 'cross', 'api'];
const MODELS = ['gemini-3.5-flash', 'gemini-2.5-flash'];

const SYSTEM_PROMPT = `You are a senior software architect and estimation expert specialising in breaking down software feature requirements into realistic manday estimates for development teams.

Given a feature description (and optionally UI screenshots/wireframes) and a target platform, produce a structured task breakdown.

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

For each group, break the work into three subgroups:
1. tasks — core implementation work
2. edgeCases — error handling, boundary conditions, validation, unusual states
3. testing — unit tests, integration tests, manual test plans

COMPREHENSIVE CORE TASK COVERAGE — For the "tasks" subgroup, you MUST include every discrete component, screen, interaction, and API endpoint the feature requires. Ask: what are all the UI components, data flows, API endpoints, and integrations needed? Do NOT skip non-obvious implementation details. Examples of tasks that are commonly missed:
- Any custom UI component (e.g. a PIN screen MUST include "Custom 0–9 digit keyboard UI component"; a date picker MUST include the calendar grid)
- Every distinct API endpoint or backend service call
- Data persistence, local storage, or state management
- Navigation / routing changes
- Device hardware or OS API integrations (camera, biometrics, notifications, etc.)
- Animation or transition implementation if specified in the design
- For BFF tasks: include endpoint definitions, request validation, response mapping, and auth middleware
- For Orchestrator tasks: include use-case classes, service calls, error propagation, and transaction handling
- For Adaptor tasks: include repository implementations, DTO mapping, retry logic, and external API error handling
- If the requirements involve content types, taxonomies, or CMS integrations, include tasks for content modelling, taxonomy setup, CMS configuration, content migration, and taxonomy API endpoints

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

INPUT VALIDATION — Before generating anything, decide whether the "Feature requirements:" text is a coherent software feature description. Reject it if it is: random characters, keyboard mashing, a single word with no context, a generic test string (e.g. "test", "asdf", "hello"), or otherwise not describing real software functionality. If rejected, return ONLY this JSON and nothing else: {"valid": false}

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
      if (task.notes != null) {
        if (!Array.isArray(task.notes) || task.notes.length === 0) return false;
        if (!task.notes.every(n => typeof n === 'string' && n.trim().length > 0)) return false;
      }
    }
  }
  return true;
}

async function callGemini(requirements, platform, images, includeTesting, includeBackend, techStack, includeGa, includeAiAssist, existingComponents, model) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const geminiModel = genAI.getGenerativeModel({
    model,
    systemInstruction: SYSTEM_PROMPT,
  });

  const parts = [];
  for (const img of images) {
    parts.push({ inlineData: { mimeType: img.mediaType, data: img.data } });
  }

  let instructions = '';
  if (!includeTesting) instructions += '\nIMPORTANT: Return an empty array `[]` for the "testing" field on every group.\n';
  if (!includeBackend) instructions += '\nIMPORTANT: Do NOT include any of the following groups in your response: "BFF", "Orchestrator", "Adaptor".\n';
  if (includeGa) instructions += '\nIMPORTANT: Include Google Analytics implementation tasks in every Frontend group. These tasks should cover: GA4 setup and configuration, page view tracking, custom event definitions, and cookie/consent integration.\n';
  if (includeAiAssist) instructions += '\nIMPORTANT: This project uses AI coding assistance tools (e.g. GitHub Copilot, Cursor). Calibrate all manday estimates to reflect AI-assisted development — well-understood patterns and boilerplate tasks should be estimated lower than they would be without AI tooling.\n';

  let userText = `Platform: ${platform}\n\nFeature requirements:\n${requirements}`;
  if (techStack && techStack.length > 0) userText += `\n\nTech stack: ${techStack.join(', ')}`;
  if (existingComponents && existingComponents.length > 0) {
    userText += `\n\nExisting components / foundation already in place: ${existingComponents.join(', ')}`;
    userText += `\nDo not generate tasks for these. If an existing component reduces the scope of a task, reflect that with a lower manday estimate and note it.`;
  }
  userText += instructions;
  parts.push({ text: userText });

  const result = await geminiModel.generateContent(parts);
  return result.response.text();
}

app.post('/api/estimate', async (req, res) => {
  const { requirements, platform, images = [], includeTesting = true, includeBackend = true, techStack = [], includeGa = false, includeAiAssist = true, existingComponents = [] } = req.body;

  if (!requirements || !requirements.trim()) {
    return res.status(400).json({ error: 'requirements is required' });
  }
  if (!VALID_PLATFORMS.includes(platform)) {
    return res.status(400).json({ error: 'invalid platform value' });
  }

  for (const model of MODELS) {
    let overloaded = false;

    for (let attempt = 0; attempt <= 1; attempt++) {
      let text;
      try {
        text = await callGemini(requirements, platform, images, includeTesting, includeBackend, techStack, includeGa, includeAiAssist, existingComponents, model);
      } catch (err) {
        console.error(`Gemini API error (${model}):`, err.message);
        if (err.message.includes('503')) {
          overloaded = true;
          break;
        }
        return res.status(502).json({ error: 'Generation failed — please try again' });
      }

      try {
        const data = JSON.parse(text);
        if (data.valid === false) {
          return res.status(400).json({ error: 'Requirements don\'t look like a software feature description — please provide more detail.' });
        }
        if (validateSchema(data)) return res.json(data);
      } catch {
        // invalid JSON or schema — retry on first attempt
      }
    }

    if (!overloaded) return res.status(502).json({ error: 'Generation failed — please try again' });
    // model was overloaded — fall through to next model
  }

  return res.status(502).json({ error: 'Gemini is currently overloaded — please try again in a moment' });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Estimatron running on http://localhost:${PORT}`));
}

module.exports = app;
module.exports.validateSchema = validateSchema;
