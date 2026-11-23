const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestApp, withServer } = require('../test-utils/helpers');

// RNF05 y PR-037: un JSON roto se responde con 400 y sin trazas, también cuando lo detecta la plataforma (Vercel).
test('RNF05: un JSON roto responde 400 INVALID_JSON', async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/routes/plan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{malo' });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).code, 'INVALID_JSON');
  });
});
