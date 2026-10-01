import { handle, identity, reply, guardOrigin, ApiError } from '@/lib/server';
import { applyOperation } from '@/lib/operations';
export async function POST(req: Request) {
  return handle(async () => {
    guardOrigin(req);
    if (Number(req.headers.get('content-length') ?? 0) > 9 * 1024 * 1024)
      throw new ApiError(413, 'Attachment is too large.');
    const m = await identity();
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new ApiError(400, 'Choose an attachment.');
    let op;
    try {
      op = JSON.parse(String(form.get('operation')));
    } catch {
      throw new ApiError(400, 'Invalid attachment operation.');
    }
    if (op.type !== 'upload') throw new ApiError(400, 'Invalid attachment operation.');
    return reply(
      await applyOperation(op, m, {
        bytes: await file.arrayBuffer(),
        name: file.name,
        kind: String(form.get('kind')),
        mime: file.type,
      }),
    );
  });
}
