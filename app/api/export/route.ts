import { ApiError, bucket, database, handle, hash, identity, reply } from '@/lib/server';

export async function GET() {
  return handle(async () => {
    const user = await identity();
    if (user.role !== 'admin') throw new ApiError(403, 'Only administrators can export a workspace.');
    const db = database();
    // D1 batch gives the relational records one consistent transaction snapshot.
    const tables = ['workspaces', 'members', 'invitations', 'cases', 'visits', 'files', 'audit', 'knowledge'];
    const results = await db.batch(tables.map(table => {
      const predicate = table === 'workspaces' ? 'id = ?'
        : ['visits', 'files', 'audit'].includes(table)
          ? 'caseId IN (SELECT id FROM cases WHERE workspaceId = ?)'
          : 'workspaceId = ?';
      return db.prepare(`SELECT * FROM ${table} WHERE ${predicate}`).bind(user.workspaceId);
    }));
    const records = Object.fromEntries(tables.map((table, index) => [table, results[index].results]));
    const files = records.files as unknown as { id: string; objectKey: string; size: number; sha256: string }[];
    if (files.reduce((total, file) => total + file.size, 0) > 25 * 1024 * 1024)
      throw new ApiError(413, 'This workspace exceeds the 25 MB attachment export limit. Export individual cases and download their attachments separately.');
    const attachments = [];
    for (const file of files) {
      const object = await bucket().get(file.objectKey);
      if (!object) throw new ApiError(503, 'An attachment is unavailable. Export stopped to avoid an incomplete backup.');
      const bytes = await object.arrayBuffer();
      if (bytes.byteLength !== file.size || await hash(bytes) !== file.sha256)
        throw new ApiError(503, 'An attachment failed its integrity check. Export stopped.');
      let binary = '';
      const array = new Uint8Array(bytes);
      for (let offset = 0; offset < array.length; offset += 8192)
        binary += String.fromCharCode(...array.subarray(offset, offset + 8192));
      attachments.push({ id: file.id, sha256: file.sha256, base64: btoa(binary) });
    }
    const response = reply({ format: 'fieldproof-workspace-export-v1', exportedAt: new Date().toISOString(), records, attachments });
    response.headers.set('Content-Disposition', 'attachment; filename="fieldproof-workspace-backup.json"');
    return response;
  });
}
