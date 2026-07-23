const request = require('supertest');
const app     = require('../server');

describe('Server bootstrap', () => {
  test('GET / serves HTML', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });

  test('POST /api/estimate with empty body returns 400', async () => {
    const res = await request(app).post('/api/estimate').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});
