import { bucket, database } from './server';
export async function cleanupFiles(workspaceId: string) {
  const db = database();
  const jobs = await db
    .prepare(
      'SELECT id,objectKeys FROM file_cleanup WHERE workspaceId = ? AND createdAt <= ? LIMIT 20',
    )
    .bind(workspaceId, new Date().toISOString())
    .all<{ id: string; objectKeys: string }>();
  let completed = 0;
  for (const job of jobs.results) {
    try {
      const keys = JSON.parse(job.objectKeys) as string[];
      if (keys.some((key) => !key.startsWith(workspaceId + '/')))
        throw new Error('Invalid cleanup scope');
      for (let offset = 0; offset < keys.length; offset += 100)
        await bucket().delete(keys.slice(offset, offset + 100));
      await db
        .prepare('DELETE FROM file_cleanup WHERE id = ? AND workspaceId = ?')
        .bind(job.id, workspaceId)
        .run();
      completed++;
    } catch {
      /* The durable job remains for the administrator to retry. */
    }
  }
  const remaining = await db
    .prepare('SELECT COUNT(*) AS count FROM file_cleanup WHERE workspaceId = ?')
    .bind(workspaceId)
    .first<{ count: number }>();
  return { completed, pending: remaining?.count ?? 0 };
}
