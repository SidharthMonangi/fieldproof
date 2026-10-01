import { identity, handle, database, reply, guardOrigin, ApiError } from '@/lib/server';
import { sampleArticles } from '@/lib/knowledge';
export async function POST(req: Request) {
  return handle(async () => {
    guardOrigin(req);
    const m = await identity();
    if (m.role !== 'admin') throw new ApiError(403, 'Only administrators can load sample data.');
    const db = database();
    const existing = await db
      .prepare('SELECT id FROM cases WHERE workspaceId = ? LIMIT 1')
      .bind(m.workspaceId)
      .first();
    if (existing) throw new ApiError(409, 'Sample cases can only be added to an empty workspace.');
    const now = new Date().toISOString();
    const names = [
      ['Asha Patil', 'Nashik, Maharashtra', 'Home construction', 850000, 27000],
      ['Ravi Deshmukh', 'Panvel, Maharashtra', 'Home improvement', 420000, 35000],
      ['Meera Kulkarni', 'Kolhapur, Maharashtra', 'Home purchase', 1200000, 41000],
    ];
    const stmts: D1PreparedStatement[] = [];
    for (const [name, location, purpose, amount, income] of names) {
      const id = crypto.randomUUID();
      const data = {
        name,
        location,
        purpose,
        amount,
        income,
        phone: '+91 00000 00000',
        notes: 'Fictional applicant for portfolio testing. Replace with your own sample records.',
        consent: true,
        consentAt: now,
      };
      stmts.push(
        db
          .prepare(
            'INSERT INTO cases (id,workspaceId,ref,data,status,version,assignedTo,createdBy,createdAt,updatedAt,reviewNote,lastOperation) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
          )
          .bind(
            id,
            m.workspaceId,
            'FP-' + id.slice(0, 8).toUpperCase(),
            JSON.stringify(data),
            'draft',
            1,
            m.userId,
            m.userId,
            now,
            now,
            '',
            null,
          ),
      );
      stmts.push(
        db
          .prepare(
            'INSERT INTO audit (id,caseId,actor,action,detail,createdAt) VALUES (?,?,?,?,?,?)',
          )
          .bind(crypto.randomUUID(), id, m.userId, 'create', 'Fictional sample case created', now),
      );
    }
    const count = await db
      .prepare('SELECT COUNT(*) AS n FROM knowledge WHERE workspaceId = ?')
      .bind(m.workspaceId)
      .first<{ n: number }>();
    if (!count?.n)
      for (const a of sampleArticles)
        stmts.push(
          db
            .prepare(
              'INSERT INTO knowledge (id,workspaceId,title,body,category,version,updatedAt,sample) VALUES (?,?,?,?,?,?,?,?)',
            )
            .bind(crypto.randomUUID(), m.workspaceId, a.title, a.body, a.category, 1, now, 1),
        );
    await db.batch(stmts);
    return reply({ ok: true });
  });
}
