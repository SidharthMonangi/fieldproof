import { createServerClient } from '@supabase/ssr';
export default async function callback(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') { res.statusCode = 405; res.setHeader('Allow', 'GET'); return res.end(); }
  const publicOrigin = process.env.PUBLIC_APP_ORIGIN;
  if (!publicOrigin || !process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) {
    res.statusCode = 503; return res.end('Sign-in is being configured.');
  }
  const origin = new URL(publicOrigin);
  if (origin.protocol !== 'https:' || origin.origin !== publicOrigin || req.headers.host !== origin.host) {
    res.statusCode = 400; return res.end('Use the configured public sign-in address.');
  }
  const code = new URL(req.url, publicOrigin).searchParams.get('code');
  if (!code) { res.statusCode = 400; return res.end('Return to /signin and start sign-in again.'); }
  const cookies = (req.headers.cookie || '').split(';').flatMap(part => {
    const index = part.indexOf('=');
    if (index < 0) return [];
    try { return [{ name: part.slice(0, index).trim(), value: decodeURIComponent(part.slice(index + 1)) }]; }
    catch { return []; }
  });
  const outgoing = [];
  const client = createServerClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => cookies,
      setAll: values => {
        for (const { name, value, options } of values) {
          let cookie = `${name}=${encodeURIComponent(value)}; Path=/; Secure; SameSite=Lax`;
          if (options.maxAge !== undefined) cookie += `; Max-Age=${Math.floor(options.maxAge)}`;
          if (options.expires) cookie += `; Expires=${new Date(options.expires).toUTCString()}`;
          if (options.httpOnly) cookie += '; HttpOnly';
          outgoing.push(cookie);
        }
      },
    },
  });
  try {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) { res.statusCode = 400; return res.end('Sign-in could not be verified. Return to /signin and retry.'); }
    if (outgoing.length) res.setHeader('Set-Cookie', outgoing);
    res.statusCode = 307; res.setHeader('Location', publicOrigin + '/'); return res.end();
  } catch {
    res.statusCode = 503; return res.end('Sign-in is temporarily unavailable. Please retry.');
  }
}
