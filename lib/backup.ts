import { z } from 'zod';
import { caseDataSchema, visitSchema, evidenceKinds, statuses, roles } from './domain.ts';
const id = z.string().uuid(),
  actor = z.string().min(1).max(128),
  date = z.string().datetime({ offset: true });
const workspace = z.object({ id, name: z.string().min(2).max(80), createdAt: date }).strict();
const member = z
  .object({
    userId: actor,
    workspaceId: id,
    email: z.string().email(),
    name: z.string().max(200),
    role: z.enum(roles),
  })
  .strict();
const record = z
  .object({
    id,
    workspaceId: id,
    ref: z.string().min(1).max(80),
    data: z.string().max(16000),
    status: z.enum(statuses),
    version: z.number().int().positive(),
    assignedTo: actor,
    createdBy: actor,
    createdAt: date,
    updatedAt: date,
    reviewNote: z.string().max(5000),
    lastOperation: z.string().nullable(),
  })
  .strict();
const file = z
  .object({
    id,
    caseId: id,
    actor,
    name: z.string().min(1).max(255),
    kind: z.enum(evidenceKinds),
    mime: z.enum(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
    size: z
      .number()
      .int()
      .positive()
      .max(8 * 1024 * 1024),
    objectKey: z.string().max(400),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    createdAt: date,
  })
  .strict();
const schema = z
  .object({
    format: z.literal('fieldproof-workspace-export-v1'),
    exportedAt: date,
    records: z
      .object({
        workspaces: z.array(workspace).length(1),
        members: z.array(member).max(100),
        invitations: z
          .array(
            z
              .object({
                id,
                workspaceId: id,
                email: z.string().email(),
                role: z.enum(roles),
                createdAt: date,
              })
              .strict(),
          )
          .max(100),
        cases: z.array(record).max(20),
        visits: z
          .array(
            z
              .object({ id, caseId: id, actor, data: z.string().max(16000), createdAt: date })
              .strict(),
          )
          .max(50),
        files: z.array(file).max(40),
        audit: z
          .array(
            z
              .object({
                id,
                caseId: id,
                actor,
                action: z.string().max(100),
                detail: z.string().max(5000),
                createdAt: date,
              })
              .strict(),
          )
          .max(100),
        knowledge: z
          .array(
            z
              .object({
                id,
                workspaceId: id,
                title: z.string().min(2).max(200),
                body: z.string().max(30000),
                category: z.string().max(80),
                version: z.number().int().positive(),
                updatedAt: date,
                sample: z.number().int().min(0).max(1),
              })
              .strict(),
          )
          .max(40),
      })
      .strict(),
    attachments: z
      .array(
        z
          .object({
            id,
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
            base64: z.string().max(12 * 1024 * 1024),
          })
          .strict(),
      )
      .max(40),
  })
  .strict();
function unique(values: string[], name: string) {
  if (new Set(values).size !== values.length) throw new Error('Duplicated ' + name + '.');
}
function json(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error('Invalid record JSON.');
  }
}
export async function validateBackup(raw: unknown) {
  const backup = schema.parse(raw),
    r = backup.records,
    workspaceId = r.workspaces[0].id;
  for (const table of ['members', 'invitations', 'cases', 'knowledge'] as const) {
    if (r[table].some((row) => row.workspaceId !== workspaceId))
      throw new Error('Backup mixes workspaces.');
  }
  for (const table of ['cases', 'files', 'visits', 'audit', 'knowledge'] as const)
    unique(
      r[table].map((row) => row.id),
      table,
    );
  unique(
    r.members.map((row) => row.userId),
    'members',
  );
  unique(
    backup.attachments.map((row) => row.id),
    'attachments',
  );
  const cases = new Set(r.cases.map((row) => row.id)),
    members = new Set(r.members.map((row) => row.userId));
  if (r.cases.some((row) => !members.has(row.assignedTo)))
    throw new Error('Case assignment is missing from backup.');
  for (const table of ['visits', 'files', 'audit'] as const)
    if (r[table].some((row) => !cases.has(row.caseId))) throw new Error('Orphaned case detail.');
  for (const row of r.cases) caseDataSchema.parse(json(row.data));
  for (const row of r.visits) visitSchema.parse(json(row.data));
  const attachments = new Map(backup.attachments.map((row) => [row.id, row]));
  if (attachments.size !== r.files.length) throw new Error('Attachment set is incomplete.');
  const objects = new Map<string, Uint8Array>();
  let total = 0;
  for (const row of r.files) {
    if (!new RegExp('^' + workspaceId + '/' + row.caseId + '/[a-zA-Z0-9-]+$').test(row.objectKey))
      throw new Error('Unsafe object key.');
    const attachment = attachments.get(row.id);
    if (!attachment) throw new Error('Missing attachment.');
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(attachment.base64))
      throw new Error('Invalid attachment encoding.');
    const bytes = Uint8Array.from(atob(attachment.base64), (char) => char.charCodeAt(0));
    total += bytes.byteLength;
    if (total > 10 * 1024 * 1024 || bytes.byteLength !== row.size)
      throw new Error('Attachment size check failed (10 MB total limit).');
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('');
    if (digest !== row.sha256 || digest !== attachment.sha256)
      throw new Error('Attachment checksum failed.');
    const header = String.fromCharCode(...bytes.subarray(0, 12));
    const valid =
      row.mime === 'application/pdf'
        ? header.startsWith('%PDF-')
        : row.mime === 'image/png'
          ? bytes[0] === 137 && header.slice(1, 4) === 'PNG'
          : row.mime === 'image/jpeg'
            ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
            : header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP';
    if (!valid || (row.kind === 'photo' && !row.mime.startsWith('image/')))
      throw new Error('Unsupported attachment content.');
    objects.set(row.id, bytes);
  }
  return { backup, objects };
}
export function recoveryRows(backup: z.infer<typeof schema>, workspaceId: string, userId: string) {
  const now = new Date().toISOString(),
    r = backup.records,
    ids = new Map(r.cases.map((row) => [row.id, crypto.randomUUID()]));
  const cases = r.cases.map((row) => {
    const newId = ids.get(row.id)!;
    const data = caseDataSchema.parse(json(row.data));
    return {
      ...row,
      id: newId,
      workspaceId,
      ref: 'FP-' + newId.slice(0, 8).toUpperCase(),
      data: JSON.stringify({ ...data, consent: false, consentAt: null }),
      status: 'draft',
      version: 1,
      assignedTo: userId,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      reviewNote: '',
      lastOperation: null,
    };
  });
  const visits = r.visits.map((row) => ({
    ...row,
    id: crypto.randomUUID(),
    caseId: ids.get(row.caseId)!,
    actor: userId,
    data: JSON.stringify({
      ...visitSchema.parse(json(row.data)),
      addressConfirmed: false,
      applicantMet: false,
    }),
  }));
  const files = r.files.map((row) => {
    const newId = crypto.randomUUID(),
      caseId = ids.get(row.caseId)!;
    return {
      ...row,
      id: newId,
      caseId,
      actor: userId,
      objectKey: workspaceId + '/' + caseId + '/' + newId,
    };
  });
  const audit = [
    ...r.audit.map((row) => ({
      ...row,
      id: crypto.randomUUID(),
      caseId: ids.get(row.caseId)!,
      actor: userId,
      action: 'restored_history',
      detail: JSON.stringify({
        originalActor: row.actor,
        originalAction: row.action,
        detail: row.detail,
      }),
    })),
    ...r.cases.map((row) => ({
      id: crypto.randomUUID(),
      caseId: ids.get(row.id)!,
      actor: userId,
      action: 'restored_backup',
      detail: JSON.stringify({
        originalRef: row.ref,
        originalStatus: row.status,
        originalConsent: JSON.parse(row.data).consent,
        exportedAt: backup.exportedAt,
        requiresConsentAndVisitRecheck: true,
      }),
      createdAt: now,
    })),
  ];
  const knowledge = r.knowledge.map((row) => ({
    ...row,
    id: crypto.randomUUID(),
    workspaceId,
    version: 1,
    updatedAt: now,
    sample: 1,
  }));
  return { cases, visits, files, audit, knowledge };
}
