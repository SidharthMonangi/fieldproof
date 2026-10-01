import { env } from 'cloudflare:workers';
import SignIn from './signin';
export default function Page() {
  return <SignIn url={env.SUPABASE_URL || ''} publishableKey={env.SUPABASE_PUBLISHABLE_KEY || ''} emailEnabled={env.EMAIL_SIGNIN_ENABLED === 'true'} />;
}
