import { handle, identity, database, bucket, getCase, ApiError } from '@/lib/server';
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const m = await identity();
    const { id } = await ctx.params;
    const f = await database()
      .prepare('SELECT * FROM files WHERE id = ?')
      .bind(id)
      .first<{ caseId: string; objectKey: string; mime: string; name: string }>();
    if (!f) throw new ApiError(404, 'Attachment not found.');
    await getCase(f.caseId, m);
    const object = await bucket().get(f.objectKey);
    if (!object) throw new ApiError(404, 'Attachment bytes are unavailable.');
    return new Response(object.body, {
      headers: {
        'Content-Type': f.mime,
        'Content-Disposition': 'attachment; filename="' + f.name.replace(/["\r\n\\]/g, '_') + '"',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  });
}
