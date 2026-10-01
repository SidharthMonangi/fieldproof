import assert from 'node:assert/strict';
const base = process.env.FIELDPROOF_TEST_URL || 'http://127.0.0.1:5173';
let cookie = '';
let checks = 0;
async function request(path, body, options = {}) {
  const r = await fetch(base + path, {
    ...options,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
  });
  let data;
  try {
    data = await r.json();
  } catch {
    data = null;
  }
  return { r, data };
}
function check(value, message) {
  assert.ok(value, message);
  checks++;
  console.log('PASS', message);
}
let x = await request('/api/bootstrap');
check(x.r.status === 401, 'anonymous workspace access is rejected');
const sign = await fetch(base + '/signin-with-chatgpt?return_to=/', { redirect: 'manual' });
cookie = sign.headers.get('set-cookie')?.split(';')[0] || '';
check(!!cookie, 'local sign-in creates a session');
x = await request('/api/bootstrap');
check(x.r.ok && x.data.user.role === 'admin', 'authenticated administrator can open the workspace');
if (!x.data.cases.length) {
  x = await request('/api/seed', {});
  check(x.r.ok, 'fictional starter cases load');
}
const caseId = crypto.randomUUID();
let version = 0;
const data = {
  name: 'Integration Test Applicant',
  phone: '+91 00000 00000',
  location: 'Nashik, Maharashtra',
  purpose: 'Home construction',
  amount: 600000,
  income: 25000,
  notes: 'Automated verification fixture; fictional data.',
  consent: true,
  consentAt: null,
};
const operation = (type, payload = {}, baseVersion = version) => ({
  id: crypto.randomUUID(),
  caseId,
  baseVersion,
  type,
  payload,
});
let op = operation('create', data);
x = await request('/api/operations', op);
check(x.r.ok, 'create a persisted case');
version = x.data.version;
let replay = await request('/api/operations', op);
check(
  replay.r.ok && replay.data.version === version,
  'replaying a creation does not duplicate the case',
);
let invalid = await request('/api/operations', { ...op, payload: { ...data, name: 'Different' } });
check(
  invalid.r.status === 409,
  'operation identifier reuse with different information is rejected',
);
x = await request('/api/operations', operation('submit'));
check(x.r.status === 422, 'incomplete evidence cannot be submitted');
const visit = {
  date: new Date().toISOString().slice(0, 10),
  occupancy: 'Owner occupied',
  condition: 'Good',
  addressConfirmed: true,
  applicantMet: true,
  notes: 'Met fictional applicant and confirmed sample property address.',
  latitude: null,
  longitude: null,
};
op = operation('visit', visit);
x = await request('/api/operations', op);
check(x.r.ok, 'record a persisted field visit');
version = x.data.version;
replay = await request('/api/operations', op);
check(
  replay.r.ok && replay.data.version === version,
  'lost-response visit retry returns the original receipt',
);
const concurrent = await Promise.all([
  request('/api/operations', operation('update', { ...data, notes: 'Concurrent proposal A' })),
  request('/api/operations', operation('update', { ...data, notes: 'Concurrent proposal B' })),
]);
check(
  concurrent.filter((v) => v.r.ok).length === 1 &&
    concurrent.filter((v) => v.r.status === 409).length === 1,
  'concurrent edits produce one save and one conflict',
);
version = concurrent.find((v) => v.r.ok).data.version;
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aTgAAAABJRU5ErkJggg==',
  'base64',
);
let fileId;
for (const kind of ['identity', 'income', 'property', 'photo']) {
  op = operation('upload');
  const f = new FormData();
  f.set('operation', JSON.stringify(op));
  f.set('kind', kind);
  f.set('file', new Blob([png], { type: 'image/png' }), kind + '-fictional.png');
  const r = await fetch(base + '/api/files', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: f,
  });
  const receipt = await r.json();
  check(r.ok, 'persist ' + kind + ' evidence in object storage');
  version = receipt.version;
  fileId = op.id;
  const r2 = await fetch(base + '/api/files', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: f,
  });
  check(r2.ok, 'attachment retry is idempotent for ' + kind);
}
const download = await fetch(base + '/api/files/' + fileId, { headers: { Cookie: cookie } });
check(
  download.ok && Buffer.from(await download.arrayBuffer()).equals(png),
  'attachment download returns the original bytes',
);
x = await request('/api/bootstrap');
check(
  x.data.visits.filter((v) => v.caseId === caseId).length === 1,
  'the server contains exactly one visit after retries',
);
check(
  x.data.files.filter((v) => v.caseId === caseId).length === 4,
  'the server contains exactly four attachments after retries',
);
x = await request('/api/assistant', { question: 'What is missing from this case?', caseId });
check(
  x.r.ok && x.data.mode === 'checklist' && x.data.items.every((i) => i.complete),
  'case checklist tool reads actual saved evidence',
);
x = await request('/api/assistant', {
  question: 'Predict tomorrow cryptocurrency exchange prices',
});
check(x.r.ok && x.data.mode === 'abstained', 'unsupported assistant questions abstain');
x = await request('/api/operations', operation('submit'));
check(x.r.ok, 'complete evidence can be submitted');
version = x.data.version;
x = await request('/api/operations', operation('update', data));
check(x.r.status === 403, 'submitted evidence cannot be silently edited');
x = await request(
  '/api/operations',
  operation('review', {
    decision: 'changes_requested',
    note: 'Please add clarification to the visit observations.',
  }),
);
check(x.r.ok, 'reviewer can request changes with an explanation');
version = x.data.version;
x = await request(
  '/api/operations',
  operation('update', { ...data, notes: 'Clarification added for reviewer.' }),
);
check(x.r.ok, 'returned case accepts a corrected proposal');
version = x.data.version;
x = await request('/api/operations', operation('submit'));
check(x.r.ok, 'corrected evidence can be resubmitted');
version = x.data.version;
x = await request(
  '/api/operations',
  operation('review', {
    decision: 'verified',
    note: 'Sample evidence and visit completeness verified.',
  }),
);
check(x.r.ok, 'reviewer can verify complete evidence');
version = x.data.version;
x = await request('/api/operations', operation('archive'));
check(x.r.ok, 'administrator can archive a verified case');
x = await request('/api/operations', { ...operation('visit', visit), caseId: crypto.randomUUID() });
check(x.r.status === 404, 'inaccessible case IDs do not disclose information');
x = await request('/api/operations', operation('update', data), {
  headers: { Origin: 'https://untrusted.example' },
});
check(x.r.status === 403, 'cross-site writes are rejected');
x = await request('/api/bootstrap');
const saved = x.data.cases.find((c) => c.id === caseId);
check(saved.status === 'archived', 'final case state survives a fresh server read');
check(
  x.data.audit.filter((a) => a.caseId === caseId).length === saved.version,
  'one audit event exists per accepted mutation',
);
if (process.env.FIELDPROOF_TEST_AI === '1') {
  x = await request('/api/assistant', { question: 'How should I record consent?' });
  check(x.r.ok, 'assistant request completes');
  console.log('AI_MODE', x.data.mode);
  if (x.data.mode === 'generated')
    check(
      x.data.sources.length > 0 && x.data.sources.every((s) => s.body.includes(s.quote)),
      'generated citations contain exact source passages',
    );
}
console.log('Integration checks passed:', checks);
