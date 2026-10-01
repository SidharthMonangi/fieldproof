import { env } from 'cloudflare:workers';
import { database, identity, handle, reply, parseCase } from '@/lib/server';
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
    const [workspace, members, vs, fs, audit] = await Promise.all([
      db.prepare('SELECT * FROM workspaces WHERE id = ?').bind(user.workspaceId).first(),
      db.prepare('SELECT * FROM members WHERE workspaceId = ?').bind(user.workspaceId).all(),
      detail('visits'),
      detail('files'),
      detail('audit'),
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
      aiEnabled:
        !!env.GEMINI_API_KEY ||
        (!!env.OPENAI_API_KEY && env.OPENAI_API_KEY !== 'PASTE_YOUR_KEY_HERE'),
    });
  });
}
