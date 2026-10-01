import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBackup, recoveryRows } from '../lib/backup.ts';
function fixture() {
  const workspaceId = crypto.randomUUID(),
    userId = crypto.randomUUID(),
    caseId = crypto.randomUUID(),
    fileId = crypto.randomUUID(),
    now = new Date().toISOString();
  const bytes = Buffer.from('%PDF-1.4 fictional recovery fixture');
  return crypto.subtle.digest('SHA-256', bytes).then((digest) => {
    const sha256 = Buffer.from(digest).toString('hex');
    return {
      format: 'fieldproof-workspace-export-v1',
      exportedAt: now,
      records: {
        workspaces: [{ id: workspaceId, name: 'Fictional workspace', createdAt: now }],
        members: [
          { userId, workspaceId, email: 'fixture@example.test', name: 'Fixture', role: 'admin' },
        ],
        invitations: [],
        cases: [
          {
            id: caseId,
            workspaceId,
            ref: 'FP-ORIGINAL',
            data: JSON.stringify({
              name: 'Fictional applicant',
              phone: '+91 00000 00000',
              location: 'Fictional property',
              purpose: 'Home construction',
              amount: 600000,
              income: 25000,
              notes: 'Fictional recovery test.',
              consent: true,
              consentAt: now,
            }),
            status: 'verified',
            version: 3,
            assignedTo: userId,
            createdBy: userId,
            createdAt: now,
            updatedAt: now,
            reviewNote: 'Fictional review',
            lastOperation: null,
          },
        ],
        visits: [
          {
            id: crypto.randomUUID(),
            caseId,
            actor: userId,
            data: JSON.stringify({
              date: '2026-09-30',
              occupancy: 'Owner occupied',
              condition: 'Good',
              addressConfirmed: true,
              applicantMet: true,
              notes: 'Fictional completed visit.',
              latitude: null,
              longitude: null,
            }),
            createdAt: now,
          },
        ],
        files: [
          {
            id: fileId,
            caseId,
            actor: userId,
            name: 'fictional.pdf',
            kind: 'income',
            mime: 'application/pdf',
            size: bytes.length,
            objectKey: workspaceId + '/' + caseId + '/' + fileId,
            sha256,
            createdAt: now,
          },
        ],
        audit: [],
        knowledge: [],
      },
      attachments: [{ id: fileId, sha256, base64: bytes.toString('base64') }],
    };
  });
}
test('backup validates bytes and recovery creates drafts without permissions or consent claims', async () => {
  const raw = await fixture(),
    validated = await validateBackup(raw),
    target = crypto.randomUUID(),
    actor = crypto.randomUUID();
  const rows = recoveryRows(validated.backup, target, actor),
    record = rows.cases[0];
  assert.notEqual(record.id, raw.records.cases[0].id);
  assert.equal(record.workspaceId, target);
  assert.equal(record.assignedTo, actor);
  assert.equal(record.status, 'draft');
  assert.equal(record.version, 1);
  assert.equal(JSON.parse(record.data).consent, false);
  assert.equal(JSON.parse(rows.visits[0].data).addressConfirmed, false);
  assert.equal(JSON.parse(rows.visits[0].data).applicantMet, false);
  assert.ok(rows.files[0].objectKey.startsWith(target + '/' + record.id + '/'));
  assert.ok(!('members' in rows));
  assert.equal(rows.audit[0].action, 'restored_backup');
});
test('tampered attachment checksum is rejected', async () => {
  const raw = await fixture();
  raw.attachments[0].base64 = Buffer.from('%PDF-1.4 corrupt').toString('base64');
  await assert.rejects(validateBackup(raw));
});
test('mixed workspace rows are rejected', async () => {
  const raw = await fixture();
  raw.records.cases[0].workspaceId = crypto.randomUUID();
  await assert.rejects(validateBackup(raw), /mixes/);
});
test('missing attachment and orphan details are rejected', async () => {
  const raw = await fixture();
  raw.attachments = [];
  await assert.rejects(validateBackup(raw), /incomplete/);
  const orphan = await fixture();
  orphan.records.files[0].caseId = crypto.randomUUID();
  await assert.rejects(validateBackup(orphan), /Orphaned/);
});
test('duplicate IDs and unsafe object keys are rejected', async () => {
  const raw = await fixture();
  raw.records.cases.push({ ...raw.records.cases[0] });
  await assert.rejects(validateBackup(raw), /Duplicated/);
  const unsafe = await fixture();
  unsafe.records.files[0].objectKey = '../outside';
  await assert.rejects(validateBackup(unsafe), /Unsafe/);
});
test('invalid case and visit information is rejected before import', async () => {
  const raw = await fixture();
  raw.records.cases[0].data = '{}';
  await assert.rejects(validateBackup(raw));
  const visit = await fixture();
  visit.records.visits[0].data = visit.records.visits[0].data.replace('2026-09-30', '2026-02-30');
  await assert.rejects(validateBackup(visit));
});
test('backup cannot import an unknown role or extra SQL fields', async () => {
  const raw = await fixture();
  (raw.records.members[0] as { role: string }).role = 'owner';
  await assert.rejects(validateBackup(raw));
  const extra = await fixture();
  Object.assign(extra.records.cases[0], { sql: 'DROP TABLE cases' });
  await assert.rejects(validateBackup(extra));
});
test('attachment type mismatches are rejected even when checksums match', async () => {
  const raw = await fixture();
  raw.records.files[0].mime = 'image/png';
  await assert.rejects(validateBackup(raw), /Unsupported/);
});
