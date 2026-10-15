import test from 'node:test';
import assert from 'node:assert/strict';
import { unsupportedReferences } from '../lib/answer-guard.ts';

const sources = [
  'Source: https://www.pib.gov.in/PressReleasePage.aspx?PRID=2239027\nContact the district office on +91 20 2612 0000.',
];

test('answers without links or contact details pass', () => {
  assert.deepEqual(unsupportedReferences('Attach identity and income evidence before submitting.', sources), []);
});

test('links and phone numbers copied from a source pass', () => {
  assert.deepEqual(
    unsupportedReferences(
      'See https://www.pib.gov.in/PressReleasePage.aspx?PRID=2239027. Call +91 20 2612 0000.',
      sources,
    ),
    [],
  );
});

test('links, emails and phone numbers absent from sources are reported', () => {
  assert.deepEqual(
    unsupportedReferences(
      'Upload documents at https://example.test/upload or email help@example.test, or call +1 555 010 9999.',
      sources,
    ),
    ['https://example.test/upload', 'help@example.test', '+1 555 010 9999'],
  );
});

test('bare www links are checked too', () => {
  assert.deepEqual(unsupportedReferences('Visit www.example.test for forms.', sources), ['www.example.test']);
});
