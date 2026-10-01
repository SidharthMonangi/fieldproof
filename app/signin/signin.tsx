'use client';
import { createBrowserClient } from '@supabase/ssr';
import { useMemo, useState } from 'react';
export default function SignIn({ url, publishableKey, emailEnabled }: { url: string; publishableKey: string; emailEnabled: boolean }) {
  const client = useMemo(() => url && publishableKey ? createBrowserClient(url, publishableKey) : null, [url, publishableKey]);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function login(github: boolean) {
    if (!client) return;
    setBusy(true); setMessage('');
    try {
      const redirectTo = new URL('/auth/callback', location.origin).href;
      const result = github
        ? await client.auth.signInWithOAuth({ provider: 'github', options: { redirectTo } })
        : await client.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectTo } });
      if (result.error) throw result.error;
      if (!github) setMessage('Check your email for a secure sign-in link. Open it in this browser.');
    } catch { setMessage('Sign-in could not start. Please try again or contact the workspace administrator.'); }
    finally { setBusy(false); }
  }
  return <main className="main-content"><section className="welcome-card">
    <div className="eyebrow">FIELDPROOF</div><h1>Your fieldwork, together.</h1>
    <p>Sign in to your private workspace. New accounts start with an empty workspace, unless your team has invited you.</p>
    {!client ? <p role="status">Public sign-in is being configured. Please check back when setup is complete.</p> : <>
      <button className="primary" disabled={busy} onClick={() => void login(true)}>Continue with GitHub</button>
      {emailEnabled && <form className="form-grid" onSubmit={(event) => { event.preventDefault(); void login(false); }}>
        <label htmlFor="signin-email">Email address</label>
        <input id="signin-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} />
        <button className="secondary" disabled={busy}>Email me a sign-in link</button>
      </form>}<p role="status" aria-live="polite">{message}</p>
    </>}
    <a href="/">Back to FieldProof</a>
  </section></main>;
}
