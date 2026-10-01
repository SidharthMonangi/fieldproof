import { z } from 'zod';
import { invitationCutoff } from '@/lib/invitation';
import { handle, identity, database, jsonBody, reply, guardOrigin, ApiError } from '@/lib/server';
export async function GET() {
  return handle(async () => {
    const m = await identity();
    if (m.role !== 'admin') throw new ApiError(403, 'Administrator access required.');
    return reply(
      (
        await database()
          .prepare('SELECT id,email,role,createdAt FROM invitations WHERE workspaceId = ? AND createdAt > ?')
          .bind(m.workspaceId, invitationCutoff())
          .all()
      ).results,
    );
  });
}
export async function POST(req: Request) {
  return handle(async () => {
    guardOrigin(req);
    const m = await identity();
    if (m.role !== 'admin') throw new ApiError(403, 'Administrator access required.');
    const p = z
      .discriminatedUnion('action', [
        z.object({ action: z.literal('rename'), name: z.string().trim().min(2).max(80) }),
        z.object({
          action: z.literal('invite'),
          email: z.string().email(),
          role: z.enum(['officer', 'reviewer']),
        }),
        z.object({ action: z.literal('revoke'), id: z.string().uuid() }),
        z.object({
          action: z.literal('role'),
          userId: z.string(),
          role: z.enum(['officer', 'reviewer']),
        }),
      ])
      .parse(await jsonBody(req));
    const db = database();
    if (p.action === 'rename')
      await db
        .prepare('UPDATE workspaces SET name = ? WHERE id = ?')
        .bind(p.name, m.workspaceId)
        .run();
    if (p.action === 'invite') {
      const email = p.email.toLowerCase();
      await db.prepare('DELETE FROM invitations WHERE email = ? AND createdAt <= ?')
        .bind(email, invitationCutoff()).run();
      const exists = await db
        .prepare('SELECT userId FROM members WHERE email = ?')
        .bind(email)
        .first();
      if (exists) throw new ApiError(409, 'This account already belongs to a workspace.');
      const prior = await db
        .prepare('SELECT workspaceId FROM invitations WHERE email = ?')
        .bind(email)
        .first<{ workspaceId: string }>();
      if (prior && prior.workspaceId !== m.workspaceId)
        throw new ApiError(409, 'This account already has a pending invitation.');
      await db
        .prepare(
          'INSERT INTO invitations (id,workspaceId,email,role,createdAt) VALUES (?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET role = excluded.role, createdAt = excluded.createdAt',
        )
        .bind(crypto.randomUUID(), m.workspaceId, email, p.role, new Date().toISOString())
        .run();
    }
    if (p.action === 'revoke')
      await db
        .prepare('DELETE FROM invitations WHERE id = ? AND workspaceId = ?')
        .bind(p.id, m.workspaceId)
        .run();
    if (p.action === 'role') {
      if (p.userId === m.userId)
        throw new ApiError(400, 'The workspace administrator cannot change their own role.');
      const r = await db
        .prepare('UPDATE members SET role = ? WHERE userId = ? AND workspaceId = ? AND role != ?')
        .bind(p.role, p.userId, m.workspaceId, 'admin')
        .run();
      if (!r.meta.changes) throw new ApiError(404, 'Member not found.');
    }
    return reply({ ok: true });
  });
}
