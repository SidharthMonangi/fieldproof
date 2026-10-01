import { z } from 'zod';
import { handle, identity, database, jsonBody, reply, guardOrigin, ApiError } from '@/lib/server';
export async function GET() {
  return handle(async () => {
    const m = await identity();
    return reply(
      (
        await database()
          .prepare('SELECT * FROM knowledge WHERE workspaceId = ? ORDER BY title')
          .bind(m.workspaceId)
          .all()
      ).results,
    );
  });
}
export async function POST(req: Request) {
  return handle(async () => {
    guardOrigin(req);
    const m = await identity();
    if (m.role !== 'admin') throw new ApiError(403, 'Only administrators can change the handbook.');
    const p = z
      .object({
        id: z.string().uuid().optional(),
        version: z.number().int().optional(),
        title: z.string().trim().min(3).max(160),
        body: z.string().trim().min(30).max(16000),
        category: z.enum(['Fieldwork', 'Evidence', 'Review', 'Housing']),
      })
      .parse(await jsonBody(req));
    const now = new Date().toISOString();
    const db = database();
    const id = p.id ?? crypto.randomUUID();
    if (p.id) {
      const r = await db
        .prepare(
          'UPDATE knowledge SET title = ?, body = ?, category = ?, version = version + 1, updatedAt = ?, sample = 0 WHERE id = ? AND workspaceId = ? AND version = ?',
        )
        .bind(p.title, p.body, p.category, now, id, m.workspaceId, p.version ?? 0)
        .run();
      if (!r.meta.changes)
        throw new ApiError(409, 'This handbook entry changed. Reload it before editing.');
    } else
      await db
        .prepare(
          'INSERT INTO knowledge (id,workspaceId,title,body,category,version,updatedAt,sample) VALUES (?,?,?,?,?,?,?,?)',
        )
        .bind(id, m.workspaceId, p.title, p.body, p.category, 1, now, 0)
        .run();
    return reply({ id });
  });
}
