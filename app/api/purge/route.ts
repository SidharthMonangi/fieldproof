import { z } from 'zod';
import { ApiError, database, getCase, guardOrigin, handle, identity, jsonBody, reply } from '@/lib/server';
import { cleanupFiles } from '@/lib/file-cleanup';
export async function POST(req: Request) {
  return handle(async () => {
    guardOrigin(req);
    const body = await jsonBody(req);
    const user = await identity();
    if (user.role !== 'admin') throw new ApiError(403, 'Administrator access required.');
    const payload = z.discriminatedUnion('action', [
      z.object({action: z.literal('cleanup')}),
      z.object({action: z.literal('purge'),caseId:z.string().uuid(),version:z.number().int().positive(),confirmation:z.string()}),
    ]).parse(body);
    if (payload.action === 'cleanup') return reply(await cleanupFiles(user.workspaceId));
    const record = await getCase(payload.caseId,user);
    if (record.status !== 'archived') throw new ApiError(409,'Archive the case before deleting it.');
    if (payload.confirmation !== 'DELETE ' + record.ref) throw new ApiError(400,'Type DELETE followed by the exact case reference.');
    if (record.version !== payload.version) throw new ApiError(409,'The case changed. Refresh before deleting.');
    const db=database();
    const files=await db.prepare('SELECT objectKey FROM files WHERE caseId = ?').bind(record.id).all<{objectKey:string}>();
    const eligible='SELECT id FROM cases WHERE id = ? AND workspaceId = ? AND version = ? AND status = ?';
    const args=[record.id,user.workspaceId,record.version,'archived'];
    const job=crypto.randomUUID();
    const statements=[db.prepare(`INSERT INTO file_cleanup (id,workspaceId,objectKeys,createdAt) SELECT ?,?,?,? WHERE EXISTS (${eligible})`).bind(job,user.workspaceId,JSON.stringify(files.results.map(file=>file.objectKey)),new Date().toISOString(),...args)];
    for (const table of ['visits','files','audit','mutations','assistant_runs'])
      statements.push(db.prepare(`DELETE FROM ${table} WHERE caseId IN (${eligible})`).bind(...args));
    statements.push(db.prepare(`DELETE FROM cases WHERE id IN (${eligible})`).bind(...args));
    const result=await db.batch(statements);
    if (!result[0].meta.changes) throw new ApiError(409,'The case changed. Nothing was deleted.');
    return reply({deleted:true,...await cleanupFiles(user.workspaceId)});
  });
}
