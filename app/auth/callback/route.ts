import { authClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const auth = await authClient();
  if (code && auth) {
    const { error } = await auth.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL('/', url.origin), { headers: { 'Cache-Control': 'no-store' } });
  }
  return new Response('The sign-in link could not be verified. Return to /signin and request a new link.', { status: 400, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain' } });
}
