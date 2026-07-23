jest.mock('@anthropic-ai/sdk');

const Anthropic = require('@anthropic-ai/sdk');
const request   = require('supertest');
const app       = require('../server');

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
      tasks:     [{ name: 'Auth endpoint',   complexity: 'Medium', mandays: 1.5, notes: 'JWT handling' }],
      edgeCases: [],
      testing:   [],
    },
  ],
};

function makeClient(mockFn) {
  Anthropic.mockImplementation(() => ({ messages: { create: mockFn } }));
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
    makeClient(jest.fn().mockResolvedValue({ content: [{ text: JSON.stringify(validPayload) }] }));
    const res = await request(app)
      .post('/api/estimate')
      .send({ requirements: 'build a login screen', platform: 'web' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Login Screen');
    expect(res.body.groups).toHaveLength(2);
  });

  test('retries once on malformed JSON, succeeds on second attempt', async () => {
    const fn = jest.fn()
      .mockResolvedValueOnce({ content: [{ text: 'not json' }] })
      .mockResolvedValueOnce({ content: [{ text: JSON.stringify(validPayload) }] });
    makeClient(fn);
    const res = await request(app)
      .post('/api/estimate')
      .send({ requirements: 'build a login screen', platform: 'web' });
    expect(res.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('returns 502 when both attempts return malformed JSON', async () => {
    makeClient(jest.fn().mockResolvedValue({ content: [{ text: 'not json' }] }));
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
    makeClient(jest.fn().mockResolvedValue({ content: [{ text: JSON.stringify(validPayload) }] }));
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
