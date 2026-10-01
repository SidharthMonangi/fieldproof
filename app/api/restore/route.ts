import {
  ApiError,
  bucket,
  database,
  guardOrigin,
  handle,
  hash,
  identity,
  jsonBody,
  reply,
} from '@/lib/server';
import { z } from 'zod';
import { validateBackup, recoveryRows } from '@/lib/backup';
import { cleanupFiles } from '@/lib/file-cleanup';
export async function POST(req: Request) {
  return handle(async () => {
    guardOrigin(req);
    const body = z
      .object({ id: z.string().uuid(), confirmation: z.string(), backup: z.unknown() })
      .strict()
      .parse(await jsonBody(req, 16 * 1024 * 1024));
    const user = await identity();
    if (user.role !== 'admin') throw new ApiError(403, 'Administrator access required.');
    if (body.confirmation !== 'RESTORE AS DRAFTS')
      throw new ApiError(400, 'Type RESTORE AS DRAFTS to confirm.');
    const db = database(),
      requestHash = await hash(JSON.stringify(body.backup));
    const receipt = await db
      .prepare('SELECT workspaceId,requestHash,response FROM mutations WHERE id = ?')
      .bind(body.id)
      .first<{ workspaceId: string; requestHash: string; response: string }>();
    if (receipt) {
      if (receipt.workspaceId !== user.workspaceId || receipt.requestHash !== requestHash)
        throw new ApiError(409, 'Recovery request ID was already used for different data.');
      return reply(JSON.parse(receipt.response));
    }
    let validated;
    try {
      validated = await validateBackup(body.backup);
    } catch (error) {
      throw new ApiError(
        400,
        error instanceof Error && !('issues' in error)
          ? error.message
          : 'The backup is invalid or exceeds the in-app recovery limits.',
      );
    }
    const rows = recoveryRows(validated.backup, user.workspaceId, user.userId),
      job = body.id;
    const existing = await db
      .prepare('SELECT COUNT(*) AS count FROM cases WHERE workspaceId = ?')
      .bind(user.workspaceId)
      .first<{ count: number }>();
    if ((existing?.count ?? 0) + rows.cases.length > 1000)
      throw new ApiError(409, 'Workspace case limit reached.');
    // A crash leaves a durable cleanup job. Future timestamp prevents an active
    // restore's objects from being removed by the manual cleanup button.
    await db
      .prepare('INSERT INTO file_cleanup (id,workspaceId,objectKeys,createdAt) VALUES (?,?,?,?)')
      .bind(
        job,
        user.workspaceId,
        JSON.stringify(rows.files.map((row) => row.objectKey)),
        new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      )
      .run();
    const started = Date.now();
    try {
      for (let index = 0; index < rows.files.length; index++) {
        if (Date.now() - started > 5 * 60 * 1000) throw new Error('Recovery took too long.');
        const row = rows.files[index],
          original = validated.backup.records.files[index];
        await bucket().put(row.objectKey, validated.objects.get(original.id)!, {
          httpMetadata: { contentType: row.mime },
        });
      }
      const statements = [];
      for (const [table, records] of Object.entries(rows)) {
        if (!records.length) continue;
        const columns = Object.keys(records[0]),
          size = Math.max(1, Math.floor(90 / columns.length));
        for (let offset = 0; offset < records.length; offset += size) {
          const group = records.slice(offset, offset + size) as unknown as Record<
            string,
            unknown
          >[];
          statements.push(
            db
              .prepare(
                `INSERT INTO ${table} (${columns.join(',')}) VALUES ${group.map(() => `(${columns.map(() => '?').join(',')})`).join(',')}`,
              )
              .bind(...group.flatMap((row) => columns.map((column) => row[column]))),
          );
        }
      }
      const result = {
        restored: true,
        cases: rows.cases.length,
        attachments: rows.files.length,
        guidance: rows.knowledge.length,
        note: 'Restored as new drafts. Consent and visit confirmation must be checked again. Team roles and invitations were not imported.',
      };
      statements.push(
        db
          .prepare(
            'INSERT INTO mutations (id,workspaceId,caseId,requestHash,response,createdAt) VALUES (?,?,?,?,?,?)',
          )
          .bind(
            body.id,
            user.workspaceId,
            body.id,
            requestHash,
            JSON.stringify(result),
            new Date().toISOString(),
          ),
      );
      statements.push(
        db
          .prepare('DELETE FROM file_cleanup WHERE id = ? AND workspaceId = ?')
          .bind(job, user.workspaceId),
      );
      await db.batch(statements);
      return reply(result);
    } catch {
      await db
        .prepare('UPDATE file_cleanup SET createdAt = ? WHERE id = ?')
        .bind(new Date().toISOString(), job)
        .run();
      await cleanupFiles(user.workspaceId);
      throw new ApiError(
        503,
        'Restoration stopped. Existing records were not overwritten. Check file cleanup before retrying.',
      );
    }
  });
}
