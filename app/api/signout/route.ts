import { authClient } from '@/lib/supabase-server';
import { guardOrigin, handle, reply } from '@/lib/server';
export async function POST(req: Request) {
  return handle(async () => {
    guardOrigin(req);
    const auth = await authClient();
    if (!auth) return reply({ next: '/signout-with-chatgpt?return_to=/' });
    const { error } = await auth.auth.signOut({ scope: 'local' });
    if (error) return reply({ error: 'Sign-out could not finish. Please retry.' }, 503);
    return reply({ next: '/' });
  });
}
