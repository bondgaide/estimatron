jest.mock('@google/generative-ai');

const { GoogleGenerativeAI } = require('@google/generative-ai');
const request                = require('supertest');
const app                    = require('../server');

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

function makeClient(mockFn) {
  GoogleGenerativeAI.mockImplementation(() => ({
    getGenerativeModel: () => ({ generateContent: mockFn }),
  }));
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
    makeClient(jest.fn().mockResolvedValue({ response: { text: () => JSON.stringify(validPayload) } }));
    const res = await request(app)
      .post('/api/estimate')
      .send({ requirements: 'build a login screen', platform: 'web' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Login Screen');
    expect(res.body.groups).toHaveLength(2);
  });

  test('retries once on malformed JSON, succeeds on second attempt', async () => {
    const fn = jest.fn()
      .mockResolvedValueOnce({ response: { text: () => 'not json' } })
      .mockResolvedValueOnce({ response: { text: () => JSON.stringify(validPayload) } });
    makeClient(fn);
    const res = await request(app)
      .post('/api/estimate')
      .send({ requirements: 'build a login screen', platform: 'web' });
    expect(res.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('returns 502 when both attempts return malformed JSON', async () => {
    makeClient(jest.fn().mockResolvedValue({ response: { text: () => 'not json' } }));
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

  test('accepts images as {data, mediaType} objects and returns estimate', async () => {
    makeClient(jest.fn().mockResolvedValue({ response: { text: () => JSON.stringify(validPayload) } }));
    const res = await request(app)
      .post('/api/estimate')
      .send({
        requirements: 'build a login screen',
        platform:     'web',
        images:       [{ data: 'aGVsbG8=', mediaType: 'image/jpeg' }],
      });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Login Screen');
    expect(res.body.groups).toHaveLength(2);
  });
});

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
