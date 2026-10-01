import { publicSources, sourceParagraphs } from '@/lib/public-sources';
import { stableSourceBody } from '@/lib/source-metadata';
import { handle, identity, database, reply, guardOrigin, ApiError } from '@/lib/server';
export async function POST(req: Request) {
  return handle(async () => {
    guardOrigin(req);
    const member = await identity();
    if (member.role !== 'admin')
      throw new ApiError(403, 'Only administrators can refresh sources.');
    const db = database();
    const results = [];
    for (const source of publicSources) {
      try {
        // Fixed public allowlist; arbitrary URLs and redirects are not accepted.
        const response = await fetch(source.url, {
          redirect: 'manual',
          signal: AbortSignal.timeout(10000),
          headers: { Accept: 'text/html' },
        });
        if (!response.ok) throw new Error('Publisher unavailable');
        if (!response.headers.get('content-type')?.includes('text/html'))
          throw new Error('Unsupported source format');
        const reader = response.body!.getReader();
        const chunks: Uint8Array[] = [];
        let bytes = 0;
        try {
          while (true) {
            const part = await reader.read();
            if (part.done) break;
            bytes += part.value.length;
            if (bytes > 1500000) throw new Error('Source exceeds size limit');
            chunks.push(part.value);
          }
        } finally {
          await reader.cancel();
        }
        const joined = new Uint8Array(bytes);
        let offset = 0;
        for (const chunk of chunks) {
          joined.set(chunk, offset);
          offset += chunk.length;
        }
        const excerpt = sourceParagraphs(new TextDecoder().decode(joined), source.keyword);
        if (excerpt.length < 80)
          throw new Error('No relevant paragraphs found; source needs review');
        const now = new Date().toISOString();
        const body = `Public reference, not company policy. Publisher: ${source.publisher}\nPublished: ${source.published}\nSource: ${source.url}\nFetched: ${now}\nExtracted paragraphs (may be truncated; read the original):\n\n${excerpt}\n\nConfirm current requirements with the original publisher. This reference does not determine loan eligibility.`;
        const prior = await db
          .prepare('SELECT id, body FROM knowledge WHERE workspaceId = ? AND title = ?')
          .bind(member.workspaceId, source.title)
          .first<{ id: string; body: string }>();
        if (prior)
          await db
            .prepare(
              'UPDATE knowledge SET body = ?, version = version + ?, updatedAt = ? WHERE id = ? AND workspaceId = ?',
            )
            .bind(
              body,
              stableSourceBody(body) === stableSourceBody(prior.body) ? 0 : 1,
              now,
              prior.id,
              member.workspaceId,
            )
            .run();
        else
          await db
            .prepare(
              'INSERT INTO knowledge (id,workspaceId,title,body,category,version,updatedAt,sample) VALUES (?,?,?,?,?,1,?,0)',
            )
            .bind(crypto.randomUUID(), member.workspaceId, source.title, body, source.category, now)
            .run();
        results.push({ title: source.title, imported: true });
      } catch {
        const previous = await db
          .prepare('SELECT id FROM knowledge WHERE workspaceId = ? AND title = ?')
          .bind(member.workspaceId, source.title)
          .first();
        if (!previous) {
          await db
            .prepare(
              'INSERT INTO knowledge (id,workspaceId,title,body,category,version,updatedAt,sample) VALUES (?,?,?,?,?,1,?,0)',
            )
            .bind(
              crypto.randomUUID(),
              member.workspaceId,
              source.title,
              `Public reference snapshot. Live fetch unavailable; this is a manually reviewed summary as of 2026-10-01, not a fresh download. Publisher: ${source.publisher}\nPublished: ${source.published}\nSource: ${source.url}\n\n${source.summary}\n\nRead the original source before acting. Not company policy.`,
              source.category,
              '2026-10-01T00:00:00.000Z',
            )
            .run();
        }
        results.push({
          title: source.title,
          imported: false,
          error: 'Source unavailable or extraction failed; previous entry retained.',
        });
      }
    }
    return reply({ results });
  });
}
