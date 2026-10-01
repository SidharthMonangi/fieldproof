import { citationQuotes } from '../lib/citation-quotes.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceMetadata, stableSourceBody } from '../lib/source-metadata.ts';
import { sourceParagraphs } from '../lib/public-sources.ts';
const article = (body: string) => ({
  id: 'test',
  title: 'Housing',
  body,
  category: 'Housing',
  version: 1,
  updatedAt: '',
  sample: 0,
});
test('public references reject deceptive and non-allowlisted links', () => {
  for (const url of [
    'javascript:alert(1)',
    'https://www.pib.gov.in.attacker.test/',
    'https://secret@www.pib.gov.in/',
    'https://www.pib.gov.in:8443/',
  ])
    assert.equal(sourceMetadata(article('Source: ' + url)), undefined);
});
test('fetch time alone does not create a new content version', () => {
  assert.equal(
    stableSourceBody('Source: https://www.pib.gov.in/\nFetched: yesterday\nEvidence'),
    stableSourceBody('Source: https://www.pib.gov.in/\nFetched: today\nEvidence'),
  );
  assert.notEqual(stableSourceBody('Evidence A'), stableSourceBody('Evidence B'));
});
test('snapshots and fetched references have distinct provenance', () => {
  const body = 'Publisher: PIB\nPublished: 2026-09-11\nSource: https://www.pib.gov.in/\n';
  assert.equal(sourceMetadata(article(body))?.snapshot, true);
  assert.equal(
    sourceMetadata(article(body + 'Fetched: ' + new Date().toISOString()))?.snapshot,
    false,
  );
});
test('HTML extraction excludes scripts, styles and unrelated paragraphs', () => {
  const relevant =
    'Housing guidance explains why a dated public report must be checked against the original scheme.';
  const html = `<script><p>${relevant} evil</p></script><style><p>${relevant}</p></style><p>${relevant}</p><p>${relevant}</p><p>This unrelated paragraph has enough characters to be retained accidentally.</p>`;
  assert.equal(sourceParagraphs(html, 'housing'), relevant);
});

test('citation choices preserve exact source text and bounded lengths', () => {
  const body =
    "Published: 2026-09-11\nThe PMAY-U 2.0 report is dated. It cannot establish today's totals. " +
    'Evidence '.repeat(100);
  for (const quote of citationQuotes(body)) {
    assert.ok(body.includes(quote));
    assert.ok(quote.length <= 400);
  }
  assert.ok(citationQuotes(body).some((q) => q.includes('2.0')));
});
