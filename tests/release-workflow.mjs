import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
const base = process.env.FIELDPROOF_TEST_URL || 'http://127.0.0.1:8788';
const suffix = randomUUID();
let checks = 0;
const users = {
  admin: 'release-admin-' + suffix,
  officer: 'release-officer-' + suffix,
  reviewer: 'release-reviewer-' + suffix,
  other: 'release-other-' + suffix,
};
const headers = (id) => ({
  'oai-authenticated-user-id': id,
  'oai-authenticated-user-email': id + '@example.test',
  'oai-authenticated-user-full-name': id,
  'oai-authenticated-user-full-name-encoding': 'percent-encoded-utf-8',
});
async function req(user, path, body, method) {
  const r = await fetch(base + path, {
    method: method || (body ? 'POST' : 'GET'),
    headers: { ...headers(users[user]), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw Error(`${path} returned non-JSON (${r.status})`);
  }
  return { r, data };
}
function check(value, label) {
  assert.ok(value, label);
  checks++;
  console.log('PASS', label);
}
const b = await req('admin', '/api/bootstrap');
check(b.r.ok, 'administrator workspace exists');
for (const role of ['officer', 'reviewer']) {
  check(
    (
      await req('admin', '/api/workspace', {
        action: 'invite',
        email: users[role] + '@example.test',
        role,
      })
    ).r.ok,
    role + ' invited',
  );
  const x = await req(role, '/api/bootstrap');
  check(
    x.data.user.role === role && x.data.user.workspaceId === b.data.user.workspaceId,
    role + ' joins the intended workspace',
  );
}
await req('other', '/api/bootstrap');
const caseId = randomUUID();
let version = 0;
const applicant = {
  name: 'Fictional Release Test Applicant',
  phone: '+91 00000 00000',
  location: 'Fictional property, Nashik',
  purpose: 'Home construction',
  amount: 600000,
  income: 25000,
  notes: 'Fictional release verification only.',
  consent: true,
  consentAt: null,
};
const op = (type, payload = {}) => ({
  id: randomUUID(),
  caseId,
  baseVersion: version,
  type,
  payload,
});
async function mutate(user, type, payload) {
  const x = await req(user, '/api/operations', op(type, payload));
  check(x.r.ok, user + ' ' + type + ' accepted');
  version = x.data.version;
  return x;
}
await mutate('officer', 'create', applicant);
check(
  (await req('reviewer', '/api/operations', op('update', applicant))).r.status === 403,
  'reviewer cannot edit applicant fields',
);
check(
  (await req('other', '/api/operations', op('update', applicant))).r.status === 404,
  'another workspace cannot access the case',
);
check(
  (await req('officer', '/api/operations', op('submit'))).r.status === 422,
  'incomplete submission blocked',
);
await mutate('officer', 'visit', {
  date: new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()),
  occupancy: 'Owner occupied',
  condition: 'Good',
  addressConfirmed: true,
  applicantMet: true,
  notes: 'Fictional applicant met; fictional address confirmed.',
  latitude: null,
  longitude: null,
});
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aTgAAAABJRU5ErkJggg==',
  'base64',
);
let fileId;
for (const kind of ['identity', 'income', 'property', 'photo']) {
  const operation = op('upload');
  const form = new FormData();
  form.set('operation', JSON.stringify(operation));
  form.set('kind', kind);
  form.set('file', new Blob([png], { type: 'image/png' }), kind + '-fictional.png');
  const r = await fetch(base + '/api/files', {
    method: 'POST',
    headers: headers(users.officer),
    body: form,
  });
  const d = await r.json();
  check(r.ok, 'officer uploads ' + kind);
  version = d.version;
  fileId = operation.id;
}
await mutate('officer', 'submit');
check(
  (
    await req(
      'officer',
      '/api/operations',
      op('review', { decision: 'verified', note: 'Unauthorized verification attempt.' }),
    )
  ).r.status === 403,
  'officer cannot verify own case',
);
check(
  (await req('officer', '/api/operations', op('update', applicant))).r.status === 403,
  'submitted case locked against officer edits',
);
const reviewRead = await req('reviewer', '/api/bootstrap');
check(
  reviewRead.data.cases.some((c) => c.id === caseId && c.status === 'submitted'),
  'reviewer sees submitted case',
);
await mutate('reviewer', 'review', {
  decision: 'changes_requested',
  note: 'Clarify the fictional household priorities in the case notes.',
});
await mutate('officer', 'update', {
  ...applicant,
  notes: 'Fictional household priorities clarified after reviewer feedback.',
});
await mutate('officer', 'submit');
check(
  [400, 403].includes(
    (await req('reviewer', '/api/operations', op('review', { decision: 'verified', note: '' }))).r
      .status,
  ),
  'empty reviewer explanation rejected',
);
await mutate('reviewer', 'review', {
  decision: 'verified',
  note: 'Fictional evidence checklist and visit completeness reviewed.',
});
const final = await req('admin', '/api/bootstrap');
const saved = final.data.cases.find((c) => c.id === caseId);
check(saved.status === 'verified', 'fresh server read preserves final reviewed state');
check(
  final.data.audit.some(
    (a) => a.caseId === caseId && a.actor === users.reviewer && a.action === 'review',
  ),
  'review timeline identifies the separate reviewer',
);
check(
  final.data.audit.filter((a) => a.caseId === caseId).length === version,
  'one audit event per accepted mutation',
);
const otherFile = await fetch(base + '/api/files/' + fileId, { headers: headers(users.other) });
check(otherFile.status === 404, 'another workspace cannot download evidence');
check((await fetch(base + '/api/bootstrap')).status === 401, 'anonymous access rejected');
fs.mkdirSync('docs', { recursive: true });
fs.writeFileSync(
  'docs/WORKFLOW-RESULT.json',
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      checks,
      result: 'passed',
      caseId,
      finalStatus: saved.status,
      distinctOfficerAndReviewer: true,
    },
    null,
    2,
  ),
);
console.log('Release workflow checks passed:', checks);
