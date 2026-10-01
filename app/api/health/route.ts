import { env } from 'cloudflare:workers';
import { ApiError, database, handle, identity, reply } from '@/lib/server';
export async function GET() {
  return handle(async () => {
    const user = await identity();
    if (user.role !== 'admin') throw new ApiError(403, 'Administrator access required.');
    const started = Date.now();
    await database().prepare('SELECT 1 AS ready').first();
    const cleanup = await database().prepare('SELECT COUNT(*) AS count FROM file_cleanup WHERE workspaceId = ?').bind(user.workspaceId).first<{ count: number }>();
    return reply({
      checkedAt: new Date().toISOString(), database: 'reachable',
      storage: env.BUCKET ? 'configured' : 'missing',
      authentication: env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY ? 'supabase' : 'hosting',
      assistant: env.GEMINI_API_KEY || env.OPENAI_API_KEY ? 'configured' : 'retrieval-only',
      databaseLatencyMs: Date.now() - started,
      pendingFileCleanup: cleanup?.count ?? 0,
      note: 'Configuration presence does not verify storage or AI provider availability.',
    });
  });
}
