import test from 'node:test';
import assert from 'node:assert/strict';
import callback from '../api/auth-callback.mjs';

function response() {
  return { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(body) { this.body = body; } };
}
test('callback rejects writes before attempting authentication', async () => {
  const res = response();
  await callback({ method: 'POST', headers: {} }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'GET');
});
test('callback fails closed without deployment configuration', async () => {
  delete process.env.PUBLIC_APP_ORIGIN;
  const res = response();
  await callback({ method: 'GET', headers: {} }, res);
  assert.equal(res.statusCode, 503);
});
test('callback refuses another host and refuses a missing authorization code', async () => {
  process.env.PUBLIC_APP_ORIGIN = 'https://fieldproof.example';
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';
  const foreign = response();
  await callback({ method: 'GET', url: '/auth/callback?code=fictional', headers: { host: 'attacker.example' } }, foreign);
  assert.equal(foreign.statusCode, 400);
  assert.equal(foreign.headers.Location, undefined);
  const absent = response();
  await callback({ method: 'GET', url: '/auth/callback', headers: { host: 'fieldproof.example' } }, absent);
  assert.equal(absent.statusCode, 400);
  assert.equal(absent.headers['Cache-Control'], 'private, no-store');
});
