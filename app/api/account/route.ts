import { z } from 'zod';
import { adminAuthClient, authClient } from '@/lib/supabase-server';
import { ApiError, database, guardOrigin, handle, jsonBody, reply } from '@/lib/server';

// Empty, single-member workspaces only: no team ownership or evidence is orphaned.
export async function POST(req: Request) {
  return handle(async () => {
    guardOrigin(req);
    const body = await jsonBody(req);
    z.object({ confirmation: z.literal('DELETE MY ACCOUNT') }).parse(body);
    const auth = await authClient();
    if (!auth) throw new ApiError(503, 'Public account authentication is not configured.');
    const verified = await auth.auth.getUser();
    const user = verified.data.user;
    if (verified.error || !user?.email_confirmed_at) throw new ApiError(401, 'Sign in before deleting your account.');
    const admin = adminAuthClient();
    if (!admin) throw new ApiError(503, 'Account deletion is not configured. Contact the site administrator.');
    const db = database();
    let closure = await db.prepare('SELECT workspaceId,status FROM account_closures WHERE userId = ?').bind(user.id).first<{workspaceId:string;status:string}>();
    if (!closure) {
      const member = await db.prepare('SELECT workspaceId,role FROM members WHERE userId = ?').bind(user.id).first<{workspaceId:string;role:string}>();
      if (!member || member.role !== 'admin') throw new ApiError(409, 'Only the administrator of an empty personal workspace can delete their account. Ask your team administrator to resolve membership first.');
      const eligible = `SELECT id FROM workspaces WHERE id = ? AND NOT EXISTS (SELECT 1 FROM cases WHERE workspaceId = workspaces.id) AND NOT EXISTS (SELECT 1 FROM file_cleanup WHERE workspaceId = workspaces.id) AND (SELECT COUNT(*) FROM members WHERE workspaceId = workspaces.id) = 1 AND EXISTS (SELECT 1 FROM members WHERE workspaceId = workspaces.id AND userId = ? AND role = 'admin')`;
      const args = [member.workspaceId, user.id];
      const statements = [db.prepare(`INSERT INTO account_closures (userId,workspaceId,status,createdAt) SELECT ?,?,'pending',? WHERE EXISTS (${eligible})`).bind(user.id, member.workspaceId, new Date().toISOString(), ...args)];
      const closed = 'SELECT workspaceId FROM account_closures WHERE userId = ?';
      for (const table of ['invitations','knowledge','mutations','assistant_runs','members']) statements.push(db.prepare(`DELETE FROM ${table} WHERE workspaceId IN (${closed})`).bind(user.id));
      statements.push(db.prepare(`DELETE FROM workspaces WHERE id IN (${closed})`).bind(user.id));
      const result = await db.batch(statements);
      if (!result[0].meta.changes) throw new ApiError(409, 'Export a backup, delete all archived cases, finish file cleanup and resolve other team members before deleting your account. Nothing was deleted.');
      closure = {workspaceId: member.workspaceId, status:'pending'};
    }
    // The verified user matches this session; do not accept a client-supplied ID or JWT.
    const session = await auth.auth.getSession();
    if (!session.data.session) throw new ApiError(401, 'Sign in again to finish account deletion.');
    const revoked = await admin.auth.admin.signOut(session.data.session.access_token, 'global');
    if (revoked.error) throw new ApiError(503, 'Workspace removed; session revocation needs a retry. Retry account deletion.');
    const deleted = await admin.auth.admin.deleteUser(user.id);
    if (deleted.error) throw new ApiError(503, 'Workspace removed; sign-in account deletion needs a retry. Retry account deletion.');
    await db.prepare("UPDATE account_closures SET status = 'complete' WHERE userId = ?").bind(user.id).run();
    await auth.auth.signOut({scope:'local'});
    return reply({deleted:true,next:'/signin'});
  });
}
