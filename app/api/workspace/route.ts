import { z } from 'zod';
import { invitationCutoff } from '@/lib/invitation';
import { handle, identity, database, jsonBody, reply, guardOrigin, ApiError } from '@/lib/server';
import type { Member } from '@/lib/domain';
// Moves the invitee into the inviting workspace. Allowed only while their own
// workspace is empty and they are its only member, so nothing is orphaned or
// pulled into another team; the emptied personal workspace is then removed.
async function acceptInvitation(id: string, m: Member) {
  const db = database();
  const email = m.email.toLowerCase();
  const cutoff = invitationCutoff();
  const invite = await db
    .prepare('SELECT workspaceId, role FROM invitations WHERE id = ? AND email = ? AND createdAt > ?')
    .bind(id, email, cutoff)
    .first<{ workspaceId: string; role: string }>();
  if (!invite || invite.workspaceId === m.workspaceId)
    throw new ApiError(404, 'This invitation was not found or has expired.');
  const old = m.workspaceId;
  const empty = `SELECT 1 FROM workspaces WHERE id = ? AND NOT EXISTS (SELECT 1 FROM cases WHERE workspaceId = workspaces.id) AND NOT EXISTS (SELECT 1 FROM file_cleanup WHERE workspaceId = workspaces.id) AND (SELECT COUNT(*) FROM members WHERE workspaceId = workspaces.id) = 1`;
  const moved = 'NOT EXISTS (SELECT 1 FROM members WHERE workspaceId = ?)';
  const statements = [
    db
      .prepare(
        `UPDATE members SET workspaceId = ?, role = ? WHERE userId = ? AND workspaceId = ? AND role = 'admin' AND EXISTS (${empty}) AND EXISTS (SELECT 1 FROM invitations WHERE id = ? AND email = ? AND workspaceId = ? AND createdAt > ?)`,
      )
      .bind(invite.workspaceId, invite.role, m.userId, old, old, id, email, invite.workspaceId, cutoff),
  ];
  for (const table of ['invitations', 'knowledge', 'mutations', 'assistant_runs'])
    statements.push(db.prepare(`DELETE FROM ${table} WHERE workspaceId = ? AND ${moved}`).bind(old, old));
  statements.push(db.prepare(`DELETE FROM workspaces WHERE id = ? AND ${moved}`).bind(old, old));
  statements.push(
    db
      .prepare('DELETE FROM invitations WHERE id = ? AND EXISTS (SELECT 1 FROM members WHERE userId = ? AND workspaceId = ?)')
      .bind(id, m.userId, invite.workspaceId),
  );
  const result = await db.batch(statements);
  if (!result[0].meta.changes)
    throw new ApiError(
      409,
      'You can join only from an empty personal workspace. Export a backup and delete your cases, or ask the inviter to use another email.',
    );
  return { ok: true, workspaceId: invite.workspaceId, role: invite.role };
}
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
    const p = z
      .discriminatedUnion('action', [
        z.object({ action: z.literal('accept'), id: z.string().uuid() }),
        z.object({ action: z.literal('decline'), id: z.string().uuid() }),
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
    // Invitees answer their own invitation; every other action is administrative.
    if (p.action === 'accept') return reply(await acceptInvitation(p.id, m));
    if (p.action === 'decline') {
      await db
        .prepare('DELETE FROM invitations WHERE id = ? AND email = ?')
        .bind(p.id, m.email.toLowerCase())
        .run();
      return reply({ ok: true });
    }
    if (m.role !== 'admin') throw new ApiError(403, 'Administrator access required.');
    if (p.action === 'rename')
      await db
        .prepare('UPDATE workspaces SET name = ? WHERE id = ?')
        .bind(p.name, m.workspaceId)
        .run();
    if (p.action === 'invite') {
      const email = p.email.toLowerCase();
      await db.prepare('DELETE FROM invitations WHERE email = ? AND createdAt <= ?')
        .bind(email, invitationCutoff()).run();
      // Invitations now need the invitee's acceptance, so registered accounts can be
      // invited too and the response no longer reveals whether an email is registered.
      const member = await db
        .prepare('SELECT userId FROM members WHERE email = ? AND workspaceId = ?')
        .bind(email, m.workspaceId)
        .first();
      if (member) throw new ApiError(409, 'This person is already in your workspace.');
      const unavailable = 'This email cannot be invited. Ask the person to contact you.';
      const prior = await db
        .prepare('SELECT workspaceId FROM invitations WHERE email = ?')
        .bind(email)
        .first<{ workspaceId: string }>();
      if (prior && prior.workspaceId !== m.workspaceId) throw new ApiError(409, unavailable);
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
