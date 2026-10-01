import { database } from '@/lib/server';
// Minimal external health check. No identities, keys, counts or provider details.
export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    await database().prepare('SELECT 1 AS ready').first();
    return Response.json(
      { status: 'ok' },
      { headers: { 'Cache-Control': 'no-store', 'X-Request-ID': requestId } },
    );
  } catch {
    console.error('FieldProof health check failed', requestId);
    return Response.json(
      { status: 'unavailable', requestId },
      { status: 503, headers: { 'Cache-Control': 'no-store', 'X-Request-ID': requestId } },
    );
  }
}
