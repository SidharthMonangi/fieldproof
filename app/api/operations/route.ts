import { handle, identity, reply, jsonBody, guardOrigin } from '@/lib/server';
import { applyOperation } from '@/lib/operations';
export async function POST(req: Request) {
  return handle(async () => {
    guardOrigin(req);
    const m = await identity();
    return reply(await applyOperation(await jsonBody(req), m));
  });
}
