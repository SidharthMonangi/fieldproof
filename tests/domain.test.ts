import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  caseDataSchema,
  visitSchema,
  checklist,
  transition,
  canAccess,
  optimisticCases,
  type CaseRecord,
  type Member,
  type VisitRecord,
  type FileRecord,
  type QueuedOperation,
} from '../lib/domain.ts';
import { retrieve, sampleArticles, type Article } from '../lib/knowledge.ts';
const member: Member = {
  userId: 'officer-a',
  workspaceId: 'workspace-a',
  email: 'a@example.test',
  name: 'Officer A',
  role: 'officer',
};
const c: CaseRecord = {
  id: crypto.randomUUID(),
  workspaceId: member.workspaceId,
  assignedTo: member.userId,
  createdBy: member.userId,
  ref: 'FP-TEST',
  version: 1,
  status: 'draft',
  data: {
    name: 'Test Applicant',
    phone: '+91 00000 00000',
    location: 'Nashik',
    purpose: 'Home construction',
    amount: 500000,
    income: 25000,
    notes: 'Fictional case',
    consent: true,
    consentAt: new Date().toISOString(),
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  reviewNote: '',
  lastOperation: null,
};
test('officers can only access their own assigned cases in their workspace', () => {
  assert.equal(canAccess(member, c), true);
  assert.equal(canAccess({ ...member, userId: 'other' }, c), false);
  assert.equal(canAccess({ ...member, role: 'admin', workspaceId: 'other' }, c), false);
  assert.equal(canAccess({ ...member, role: 'reviewer' }, c), true);
});
test('review, editing and archive transitions enforce roles and states', () => {
  assert.equal(transition('draft', 'submit', 'officer'), 'submitted');
  assert.throws(() => transition('draft', 'review', 'reviewer', 'Reviewed'));
  assert.throws(() => transition('submitted', 'review', 'officer', 'Reviewed'));
  assert.throws(() => transition('submitted', 'update', 'admin'));
  assert.throws(() => transition('draft', 'visit', 'reviewer'));
  assert.throws(() => transition('draft', 'archive', 'officer'));
  assert.throws(() => transition('submitted', 'archive', 'admin'));
  assert.equal(transition('submitted', 'review', 'reviewer', 'Checked evidence'), 'verified');
});
test('submission checklist requires consent, income, four evidence kinds and a confirmed visit', () => {
  assert.equal(checklist(c, [], []).filter((i) => i.complete).length, 2);
  const visit = { caseId: c.id, applicantMet: true, addressConfirmed: true } as VisitRecord;
  const files = ['identity', 'income', 'property', 'photo'].map((kind) => ({
    kind,
    caseId: c.id,
  })) as FileRecord[];
  assert.equal(
    checklist(c, [visit], files).every((i) => i.complete),
    true,
  );
  assert.equal(
    checklist({ ...c, data: { ...c.data, consent: false } }, [visit], files).every(
      (i) => i.complete,
    ),
    false,
  );
  assert.equal(
    checklist(c, [{ ...visit, addressConfirmed: false }], files).every((i) => i.complete),
    false,
  );
});
test('malformed applicant information is rejected', () => {
  assert.equal(caseDataSchema.safeParse({ ...c.data, amount: -1 }).success, false);
  assert.equal(caseDataSchema.safeParse({ ...c.data, phone: 'abc' }).success, false);
  assert.equal(caseDataSchema.safeParse(c.data).success, true);
});
test('optimistic device overlays never mutate the authoritative snapshot', () => {
  const op = {
    id: crypto.randomUUID(),
    caseId: c.id,
    type: 'update',
    payload: { ...c.data, name: 'Changed Applicant' },
    baseVersion: 1,
    createdAt: new Date().toISOString(),
    scope: 'test',
    state: 'pending',
    attempts: 0,
  } as QueuedOperation;
  const derived = optimisticCases([c], [op], member);
  assert.equal(derived[0].data.name, 'Changed Applicant');
  assert.equal(derived[0].version, 2);
  assert.equal(c.data.name, 'Test Applicant');
  assert.equal(c.version, 1);
});
const articles = sampleArticles.map((a, i) => ({
  ...a,
  id: String(i),
  version: 1,
  updatedAt: '2026-10-01',
  sample: 1,
})) as Article[];
test('retrieval finds consent guidance and abstains on unrelated questions', () => {
  const matched = retrieve('How should I record consent?', articles);
  assert.ok(matched.some((a) => a.title === 'Consent and evidence handling'));
  assert.equal(retrieve('Predict tomorrow cryptocurrency exchange prices', articles).length, 0);
});

test('visit dates reject impossible calendar dates and accept leap days', () => {
  const visit = {
    date: '2024-02-29',
    occupancy: 'Owner occupied',
    condition: 'Good',
    addressConfirmed: true,
    applicantMet: true,
    notes: 'Fictional visit observations.',
    latitude: null,
    longitude: null,
  };
  assert.ok(visitSchema.safeParse(visit).success);
  for (const date of ['2025-02-29', '2026-04-31', '2025-99-01'])
    assert.equal(visitSchema.safeParse({ ...visit, date }).success, false);
});
