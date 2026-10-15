import { env } from 'cloudflare:workers';
import { database, identity, handle, reply, parseCase } from '@/lib/server';
import { invitationCutoff } from '@/lib/invitation';
export async function GET() {
  return handle(async () => {
    const user = await identity();
    const db = database();
    const access = user.role === 'officer' ? ' AND assignedTo = ?' : '';
    const binds = user.role === 'officer' ? [user.workspaceId, user.userId] : [user.workspaceId];
    const cs = await db
      .prepare(
        'SELECT * FROM cases WHERE workspaceId = ?' +
          access +
          ' ORDER BY updatedAt DESC LIMIT 1000',
      )
      .bind(...binds)
      .all();
    const detail = async (table: string) => {
      return (
        await db
          .prepare(
            'SELECT * FROM ' +
              table +
              ' WHERE caseId IN (SELECT id FROM cases WHERE workspaceId = ?' +
              access +
              ' ORDER BY updatedAt DESC LIMIT 1000) ORDER BY createdAt DESC',
          )
          .bind(...binds)
          .all()
      ).results;
    };
    const [workspace, members, vs, fs, audit, invitation] = await Promise.all([
      db.prepare('SELECT * FROM workspaces WHERE id = ?').bind(user.workspaceId).first(),
      db.prepare('SELECT * FROM members WHERE workspaceId = ?').bind(user.workspaceId).all(),
      detail('visits'),
      detail('files'),
      detail('audit'),
      db
        .prepare(
          'SELECT i.id, i.role, w.name AS workspaceName, i.createdAt FROM invitations i JOIN workspaces w ON w.id = i.workspaceId WHERE i.email = ? AND i.createdAt > ? AND i.workspaceId != ?',
        )
        .bind(user.email.toLowerCase(), invitationCutoff(), user.workspaceId)
        .first(),
    ]);
    return reply({
      user,
      workspace,
      members: members.results,
      cases: cs.results.map(parseCase),
      visits: vs.map((v) => ({
        ...JSON.parse(v.data as string),
        id: v.id,
        caseId: v.caseId,
        actor: v.actor,
        createdAt: v.createdAt,
      })),
      files: fs.map(({ objectKey, sha256, ...rest }) => rest),
      audit,
      invitation: invitation ?? null,
      aiEnabled:
        !!env.GEMINI_API_KEY ||
        (!!env.OPENAI_API_KEY && env.OPENAI_API_KEY !== 'PASTE_YOUR_KEY_HERE'),
    });
  });
}
