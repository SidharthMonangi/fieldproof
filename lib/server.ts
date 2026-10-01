import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import type { CaseRecord, Member } from './domain';
import { invitationCutoff } from './invitation';
import { authClient } from './supabase-server';
import { allowedWriteOrigin } from './write-origin';
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}
export function database() {
  if (!env.DB)
    throw new ApiError(503, 'The workspace database is unavailable. Your device drafts are safe.');
  return env.DB;
}
export function bucket() {
  if (!env.BUCKET)
    throw new ApiError(
      503,
      'Document storage is unavailable. Your attachment is still on this device.',
    );
  return env.BUCKET;
}
export async function identity(): Promise<Member> {
  const auth = await authClient();
  // Configured public authentication never falls back to hosting identity headers.
  const verified = auth ? await auth.auth.getUser() : null;
  const user = verified?.error ? null : verified?.data.user;
  const u = auth
    ? (user?.email && user.email_confirmed_at ? {
        userId: user.id, email: user.email, displayName: user.email,
      } : null)
    : await getChatGPTUser();
  if (!u) throw new ApiError(401, 'Please sign in to your workspace.');
  const db = database();
  const closure = await db.prepare('SELECT userId FROM account_closures WHERE userId = ?').bind(u.userId).first();
  if (closure) throw new ApiError(423, 'Account deletion is in progress. Return to account deletion to retry.');
  let m = await db.prepare('SELECT * FROM members WHERE userId = ?').bind(u.userId).first<Member>();
  if (m) return m;
  const email = u.email.toLowerCase();
  const invite = await db
    .prepare('SELECT * FROM invitations WHERE email = ? AND createdAt > ?')
    .bind(email, invitationCutoff())
    .first<{ workspaceId: string; role: string }>();
  const now = new Date().toISOString();
  const workspaceId = invite?.workspaceId ?? crypto.randomUUID();
  const stmts = [];
  if (!invite)
    stmts.push(
      db
        .prepare('INSERT INTO workspaces (id,name,createdAt) VALUES (?,?,?)')
        .bind(workspaceId, 'FieldProof workspace', now),
    );
  stmts.push(
    db
      .prepare(
        'INSERT INTO members (userId,workspaceId,email,name,role) VALUES (?,?,?,?,?) ON CONFLICT(userId) DO NOTHING',
      )
      .bind(u.userId, workspaceId, email, u.displayName, invite?.role ?? 'admin'),
  );
  if (invite) stmts.push(db.prepare('DELETE FROM invitations WHERE email = ?').bind(email));
  try {
    await db.batch(stmts);
  } catch {
    m = await db.prepare('SELECT * FROM members WHERE userId = ?').bind(u.userId).first<Member>();
    if (m) return m;
    throw new ApiError(503, 'Workspace setup could not finish. Please retry.');
  }
  m = await db.prepare('SELECT * FROM members WHERE userId = ?').bind(u.userId).first<Member>();
  if (!m) throw new ApiError(503, 'Workspace setup did not finish.');
  return m;
}
export function parseCase(row: Record<string, unknown>): CaseRecord {
  return { ...row, data: JSON.parse(row.data as string) } as CaseRecord;
}
export async function getCase(id: string, m: Member) {
  const row = await database()
    .prepare('SELECT * FROM cases WHERE id = ? AND workspaceId = ?')
    .bind(id, m.workspaceId)
    .first<Record<string, unknown>>();
  if (!row || (m.role === 'officer' && row.assignedTo !== m.userId))
    throw new ApiError(404, 'Case not found.');
  return parseCase(row);
}
export async function jsonBody(req: Request, max = 30000) {
  if (Number(req.headers.get('content-length') ?? 0) > max)
    throw new ApiError(413, 'Request is too large.');
  const raw = await req.text();
  if (raw.length > max) throw new ApiError(413, 'Request is too large.');
  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError(400, 'Request must contain valid JSON.');
  }
}
export function guardOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (!allowedWriteOrigin(req.url, origin, (env as typeof env & { PUBLIC_APP_ORIGIN?: string }).PUBLIC_APP_ORIGIN))
    throw new ApiError(403, 'Cross-site writes are not allowed.');
  if (req.headers.get('sec-fetch-site') === 'cross-site')
    throw new ApiError(403, 'Cross-site writes are not allowed.');
}
export function reply(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
export async function handle(fn: () => Promise<Response>) {
  const requestId = crypto.randomUUID();
  try {
    const response = await fn();
    response.headers.set('X-Request-ID', requestId);
    return response;
  } catch (e) {
    if (e instanceof ApiError) return reply({ error: e.message, ...e.extra }, e.status);
    if (e && typeof e === 'object' && 'issues' in e)
      return reply(
        {
          error: 'Please check the information entered.',
          issues: (e as { issues: unknown }).issues,
        },
        400,
      );
    console.error('FieldProof request failed', requestId, e instanceof Error ? e.name : 'Unknown');
    return reply(
      { error: 'This request could not finish. Your unsent work is preserved. Please retry.', requestId },
      503,
    );
  }
}
export async function hash(value: string | ArrayBuffer) {
  const b = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
}
