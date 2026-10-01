import test from 'node:test';
import assert from 'node:assert/strict';
import { invitationCutoff } from '../lib/invitation.ts';

test('invitation expiry uses seven elapsed days across month and year boundaries', () => {
  assert.equal(invitationCutoff(Date.parse('2026-01-03T12:00:00Z')), '2025-12-27T12:00:00.000Z');
  assert.equal(invitationCutoff(Date.parse('2026-10-01T00:00:00Z')), '2026-09-24T00:00:00.000Z');
});
