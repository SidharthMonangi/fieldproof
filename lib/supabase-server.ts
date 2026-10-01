import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { env } from 'cloudflare:workers';

export function adminAuthClient() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) return null;
  return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function authClient() {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return null;
  const jar = await cookies();
  return createServerClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) => { for (const { name, value, options } of values) jar.set(name, value, options); },
    },
  });
}
