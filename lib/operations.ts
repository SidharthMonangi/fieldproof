import { z } from 'zod';
import {
  caseDataSchema,
  visitSchema,
  opSchema,
  transition,
  checklist,
  evidenceKinds,
  type Member,
  type CaseRecord,
  type Operation,
  type VisitRecord,
  type FileRecord,
} from './domain';
import { database, bucket, getCase, hash, ApiError } from './server';
export async function applyOperation(
  raw: unknown,
  member: Member,
  attachment?: { bytes: ArrayBuffer; name: string; kind: string; mime: string },
) {
  const op = opSchema.parse(raw);
  const db = database();
  const now = new Date().toISOString();
  const digest = await hash(JSON.stringify(op) + (attachment ? await hash(attachment.bytes) : ''));
  const prior = await db
    .prepare('SELECT * FROM mutations WHERE id = ?')
    .bind(op.id)
    .first<{ workspaceId: string; requestHash: string; response: string }>();
  if (prior) {
    if (prior.workspaceId !== member.workspaceId || prior.requestHash !== digest)
      throw new ApiError(
        409,
        'This operation identifier has already been used for different information.',
      );
    return JSON.parse(prior.response);
  }
  let current: CaseRecord | undefined;
  if (op.type !== 'create') current = await getCase(op.caseId, member);
  if (current && current.version !== op.baseVersion)
    throw new ApiError(
      409,
      'Someone changed this case after your last sync. Compare both versions before retrying.',
      { server: current },
    );
  let data = current?.data;
  let status = current?.status ?? 'draft';
  let assignedTo = current?.assignedTo ?? member.userId;
  let reviewNote = current?.reviewNote ?? '';
  let detail = '';
  let visit: ReturnType<typeof visitSchema.parse> | undefined;
  if (op.type === 'create') {
    if (member.role === 'reviewer') throw new ApiError(403, 'Reviewers cannot create field cases.');
    if (op.baseVersion !== 0) throw new ApiError(400, 'New cases start at version zero.');
    const existing = await db.prepare('SELECT id FROM cases WHERE id = ?').bind(op.caseId).first();
    if (existing) throw new ApiError(409, 'This case already exists.');
    data = caseDataSchema.parse(op.payload);
    detail = 'Case created';
  } else {
    try {
      status = transition(
        status,
        op.type,
        member.role,
        op.type === 'review' ? ((op.payload as { note?: string })?.note ?? '') : '',
      );
    } catch (e) {
      throw new ApiError(403, (e as Error).message);
    }
  }
  if (op.type === 'update') {
    data = caseDataSchema.parse(op.payload);
    detail = 'Applicant information updated';
  }
  if (op.type === 'visit') {
    visit = visitSchema.parse(op.payload);
    const todayInIndia = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(now));
    if (visit.date > todayInIndia)
      throw new ApiError(400, 'A visit cannot be dated in the future.');
    detail = 'Field visit recorded';
  }
  if (op.type === 'assign') {
    const p = z.object({ assignedTo: z.string().min(1) }).parse(op.payload);
    const assignee = await db
      .prepare('SELECT * FROM members WHERE userId = ? AND workspaceId = ?')
      .bind(p.assignedTo, member.workspaceId)
      .first<Member>();
    if (!assignee || assignee.role === 'reviewer')
      throw new ApiError(400, 'Choose an officer or administrator in this workspace.');
    assignedTo = p.assignedTo;
    detail = 'Assigned to ' + assignee.name;
  }
  if (op.type === 'review') {
    const p = z
      .object({
        decision: z.enum(['verified', 'changes_requested']),
        note: z.string().trim().min(5).max(3000),
      })
      .parse(op.payload);
    status = p.decision;
    reviewNote = p.note;
    detail = p.note;
  }
  if (op.type === 'submit' || (op.type === 'review' && status === 'verified')) {
    const vs = await db.prepare('SELECT * FROM visits WHERE caseId = ?').bind(op.caseId).all();
    const fs = await db.prepare('SELECT * FROM files WHERE caseId = ?').bind(op.caseId).all();
    const missing = checklist(
      current!,
      vs.results.map((v) => ({
        ...JSON.parse(v.data as string),
        caseId: v.caseId,
      })) as VisitRecord[],
      fs.results as FileRecord[],
    ).filter((i) => !i.complete);
    if (missing.length)
      throw new ApiError(422, 'Complete the required evidence before submitting or verifying.', {
        missing: missing.map((i) => i.label),
      });
    if (op.type === 'submit') detail = 'Submitted for evidence review';
  }
  if (op.type === 'archive') detail = 'Case archived';
  if (data) {
    data = { ...data, consentAt: data.consent ? (current?.data.consentAt ?? now) : null };
  }
  if (op.type === 'upload') {
    if (!attachment) throw new ApiError(400, 'Choose an attachment.');
    if (attachment.bytes.byteLength > 8 * 1024 * 1024 || attachment.bytes.byteLength === 0)
      throw new ApiError(413, 'Attachments must be between 1 byte and 8 MB.');
    z.enum(evidenceKinds).parse(attachment.kind);
    const b = new Uint8Array(attachment.bytes);
    const valid =
      (attachment.mime === 'application/pdf' &&
        String.fromCharCode(...b.slice(0, 5)) === '%PDF-') ||
      (attachment.mime === 'image/jpeg' && b[0] === 255 && b[1] === 216 && b[2] === 255) ||
      (attachment.mime === 'image/png' &&
        b[0] === 137 &&
        String.fromCharCode(...b.slice(1, 4)) === 'PNG') ||
      (attachment.mime === 'image/webp' &&
        String.fromCharCode(...b.slice(0, 4)) === 'RIFF' &&
        String.fromCharCode(...b.slice(8, 12)) === 'WEBP');
    if (!valid) throw new ApiError(415, 'Use a valid PDF, JPEG, PNG or WebP file.');
    if (attachment.kind === 'photo' && !attachment.mime.startsWith('image/'))
      throw new ApiError(400, 'Property photographs must be image files.');
    const objectKey = member.workspaceId + '/' + op.caseId + '/' + op.id;
    await bucket().put(objectKey, attachment.bytes, {
      httpMetadata: { contentType: attachment.mime },
    });
    detail = 'Attached ' + attachment.name;
  }
  const version = op.baseVersion + 1;
  const response = { caseId: op.caseId, version, operationId: op.id };
  const statements: D1PreparedStatement[] = [];
  if (op.type === 'create')
    statements.push(
      db
        .prepare(
          'INSERT INTO cases (id,workspaceId,ref,data,status,version,assignedTo,createdBy,createdAt,updatedAt,reviewNote,lastOperation) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        )
        .bind(
          op.caseId,
          member.workspaceId,
          'FP-' + op.caseId.slice(0, 8).toUpperCase(),
          JSON.stringify(data),
          status,
          version,
          assignedTo,
          member.userId,
          now,
          now,
          reviewNote,
          op.id,
        ),
    );
  else
    statements.push(
      db
        .prepare(
          'UPDATE cases SET data = ?, status = ?, version = ?, assignedTo = ?, updatedAt = ?, reviewNote = ?, lastOperation = ? WHERE id = ? AND workspaceId = ? AND version = ?',
        )
        .bind(
          JSON.stringify(data),
          status,
          version,
          assignedTo,
          now,
          reviewNote,
          op.id,
          op.caseId,
          member.workspaceId,
          op.baseVersion,
        ),
    );
  if (visit)
    statements.push(
      db
        .prepare(
          'INSERT INTO visits (id,caseId,actor,data,createdAt) SELECT ?,?,?,?,? FROM cases WHERE id = ? AND lastOperation = ?',
        )
        .bind(op.id, op.caseId, member.userId, JSON.stringify(visit), now, op.caseId, op.id),
    );
  if (attachment && op.type === 'upload')
    statements.push(
      db
        .prepare(
          'INSERT INTO files (id,caseId,actor,name,kind,mime,size,objectKey,sha256,createdAt) SELECT ?,?,?,?,?,?,?,?,?,? FROM cases WHERE id = ? AND lastOperation = ?',
        )
        .bind(
          op.id,
          op.caseId,
          member.userId,
          attachment.name.slice(0, 180),
          attachment.kind,
          attachment.mime,
          attachment.bytes.byteLength,
          member.workspaceId + '/' + op.caseId + '/' + op.id,
          await hash(attachment.bytes),
          now,
          op.caseId,
          op.id,
        ),
    );
  statements.push(
    db
      .prepare(
        'INSERT INTO audit (id,caseId,actor,action,detail,createdAt) SELECT ?,?,?,?,?,? FROM cases WHERE id = ? AND lastOperation = ?',
      )
      .bind(op.id, op.caseId, member.userId, op.type, detail, now, op.caseId, op.id),
  );
  statements.push(
    db
      .prepare(
        'INSERT INTO mutations (id,workspaceId,caseId,requestHash,response,createdAt) SELECT ?,?,?,?,?,? FROM cases WHERE id = ? AND lastOperation = ?',
      )
      .bind(
        op.id,
        member.workspaceId,
        op.caseId,
        digest,
        JSON.stringify(response),
        now,
        op.caseId,
        op.id,
      ),
  );
  try {
    await db.batch(statements);
  } catch (e) {
    const retry = await db
      .prepare('SELECT requestHash,response,workspaceId FROM mutations WHERE id = ?')
      .bind(op.id)
      .first<{ requestHash: string; response: string; workspaceId: string }>();
    if (retry && retry.requestHash === digest && retry.workspaceId === member.workspaceId)
      return JSON.parse(retry.response);
    throw e;
  }
  const saved = await db
    .prepare('SELECT response FROM mutations WHERE id = ?')
    .bind(op.id)
    .first<{ response: string }>();
  if (!saved)
    throw new ApiError(
      409,
      'The server changed while saving. Your local work has been preserved.',
      { server: await getCase(op.caseId, member) },
    );
  return JSON.parse(saved.response);
}
