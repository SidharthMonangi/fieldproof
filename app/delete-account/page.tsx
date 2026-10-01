'use client';
import { useState } from 'react';
export default function DeleteAccount() {
  const [confirmation,setConfirmation] = useState('');
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  return <main className="panel" style={{maxWidth:600,margin:'48px auto',padding:24}}>
    <h1>Delete your account</h1>
    <p>This permanently removes your sign-in account and empty personal workspace, including guidance and invitations. Download a backup first. All cases must be deleted, file cleanup completed and other team memberships resolved first.</p>
    <p>Other devices and downloaded backups may retain copies. Clear them separately. If a provider fails after workspace removal, sign in again and return here to finish deletion.</p>
    <form onSubmit={event => {
      event.preventDefault();setBusy(true);setMessage('');
      void fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmation})}).then(async response => {
        const result = await response.json() as {error?:string;deleted?:boolean};
        if (!response.ok) throw new Error(result.error || 'Deletion could not finish.');
        // Only erase local drafts after the explicit account deletion succeeds.
        const {clearDevice} = await import('@/lib/device');
        await clearDevice();setMessage('Your sign-in account and workspace were deleted.');
      }).catch(error => setMessage((error as Error).message)).finally(()=>setBusy(false));
    }}>
      <label htmlFor="delete-account-confirmation">Type DELETE MY ACCOUNT</label>
      <input id="delete-account-confirmation" autoComplete="off" value={confirmation} onChange={event=>setConfirmation(event.target.value)} disabled={busy} />
      <button className="primary" disabled={busy || confirmation !== 'DELETE MY ACCOUNT'}>{busy?'Deleting…':'Delete permanently'}</button>
    </form>
    <p role="status">{message}</p>
    <a href="/">Return to FieldProof</a> · <a href="/signin">Sign in to retry</a>
  </main>;
}
