import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedWriteOrigin } from '../lib/write-origin.ts';
const backend = 'https://backend.example/api/operations';
test('same origin writes remain allowed', () => assert.equal(allowedWriteOrigin(backend, 'https://backend.example'), true));
test('only the exact configured public origin is accepted', () => {
  assert.equal(allowedWriteOrigin(backend, 'https://fieldproof.vercel.app', 'https://fieldproof.vercel.app'), true);
  for (const origin of ['https://fieldproof.vercel.app.evil.example', 'https://preview.vercel.app', 'null'])
    assert.equal(allowedWriteOrigin(backend, origin, 'https://fieldproof.vercel.app'), false);
});
test('invalid or insecure origin configuration never grants access', () => {
  for (const configuration of ['*', 'http://external.example', 'https://external.example/path', 'https://user:password@external.example'])
    assert.equal(allowedWriteOrigin(backend, 'https://external.example', configuration), false);
});
