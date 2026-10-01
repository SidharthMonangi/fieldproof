'use client';
import { useEffect, useState } from 'react';
import { UserPlus, Settings, ShieldCheck, Trash2, LogOut } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Field, Picker } from './forms';
import { clearDevice, forgetActive } from '@/lib/device';
import type { Bootstrap } from '@/lib/domain';
export function WorkspacePane({
  b,
  online,
  hasPending,
  onRefresh,
}: {
  b: Bootstrap;
  online: boolean;
  hasPending: boolean;
  onRefresh: () => Promise<void>;
}) {
  const [name, setName] = useState(b.workspace.name),
    [email, setEmail] = useState(''),
    [role, setRole] = useState('officer'),
    [invites, setInvites] = useState<{ id: string; email: string; role: string }[]>([]),
    [busy, setBusy] = useState(false),
    [clearing, setClearing] = useState(false);
  const [purgeId, setPurgeId] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [purging, setPurging] = useState(false);
  const [backupFile, setBackupFile] = useState<File>();
  const [restoreConfirmation, setRestoreConfirmation] = useState('');
  const [restoreId, setRestoreId] = useState(() => crypto.randomUUID());
  const [health, setHealth] = useState<{
    database: string;
    storage: string;
    assistant: string;
    pendingFileCleanup: number;
  }>();
  const archived = b.cases.filter((record) => record.status === 'archived');
  const selectedPurge = archived.find((record) => record.id === purgeId);
  const maintenance = async (payload: unknown) => {
    setBusy(true);
    try {
      const response = await fetch('/api/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string; pending: number };
      if (!response.ok) throw new Error(result.error);
      toast.success(
        result.pending
          ? 'Case records removed; file cleanup needs a retry.'
          : 'Deletion and file cleanup completed.',
      );
      setPurging(false);
      setPurgeId('');
      setConfirmation('');
      await onRefresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const load = async () => {
    if (b.user.role !== 'admin') return;
    const r = await fetch('/api/workspace');
    if (r.ok) setInvites(await r.json());
  };
  useEffect(() => {
    void load();
  }, [b.user.role, online]);
  const action = async (payload: unknown) => {
    setBusy(true);
    try {
      const r = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error);
      await onRefresh();
      await load();
      toast.success('Workspace updated.');
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const exportWorkspace = async () => {
    setBusy(true);
    try {
      const response = await fetch('/api/export', { cache: 'no-store' });
      if (!response.ok) {
        const problem = (await response.json()) as { error?: string };
        throw new Error(problem.error || 'Backup could not finish. Please retry.');
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'fieldproof-workspace-backup.json';
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      toast.success('Workspace backup downloaded. Keep it private.');
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const restoreWorkspace = async () => {
    if (!backupFile) return;
    setBusy(true);
    try {
      if (backupFile.size > 16 * 1024 * 1024)
        throw new Error(
          'In-app backups must be no larger than 16 MB. Use isolated recovery for larger exports.',
        );
      let backup;
      try {
        backup = JSON.parse(await backupFile.text());
      } catch {
        throw new Error('Choose a valid FieldProof JSON backup.');
      }
      const response = await fetch('/api/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: restoreId, confirmation: restoreConfirmation, backup }),
      });
      const result = (await response.json()) as {
        error?: string;
        cases: number;
        attachments: number;
      };
      if (!response.ok) throw new Error(result.error || 'Restoration could not finish.');
      toast.success(
        `${result.cases} draft copies and ${result.attachments} attachments restored. Recheck consent and visits.`,
      );
      setBackupFile(undefined);
      setRestoreConfirmation('');
      setRestoreId(crypto.randomUUID());
      await onRefresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="eyebrow">YOUR TEAM, YOUR WORKSPACE</div>
      <div className="page-heading">
        <div>
          <h1>A place for good work.</h1>
          <p>Manage the people and settings behind your field operations.</p>
        </div>
      </div>
      <div className="knowledge-grid">
        <div>
          <section className="panel">
            <div className="panel-heading">
              <h2>
                <Settings size={18} />
                Workspace details
              </h2>
              <span className="badge">{b.user.role}</span>
            </div>
            <form
              className="form-grid"
              onSubmit={(e) => {
                e.preventDefault();
                void action({ action: 'rename', name });
              }}
            >
              <Field label="Workspace name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  minLength={2}
                  maxLength={80}
                  required
                  disabled={b.user.role !== 'admin'}
                />
              </Field>
              <Field label="Signed-in account">
                <input value={b.user.email} readOnly />
              </Field>
              {b.user.role === 'admin' && (
                <button className="primary" disabled={!online || busy}>
                  Save name
                </button>
              )}
            </form>
          </section>
          <section className="panel">
            <h2>Team members</h2>
            {b.members.map((m) => (
              <div className="member-row" key={m.userId}>
                <div className="avatar">{m.name.slice(0, 2).toUpperCase()}</div>
                <div className="member-info">
                  <strong>{m.name}</strong>
                  <small>{m.email}</small>
                </div>
                {b.user.role === 'admin' && m.role !== 'admin' ? (
                  <Picker
                    value={m.role}
                    label={'Role for ' + m.name}
                    onChange={(r) => void action({ action: 'role', userId: m.userId, role: r })}
                    disabled={!online || busy}
                    options={[
                      { value: 'officer', label: 'Field officer' },
                      { value: 'reviewer', label: 'Reviewer' },
                    ]}
                  />
                ) : (
                  <span className="badge">{m.role}</span>
                )}
              </div>
            ))}
          </section>
        </div>
        <div>
          {b.user.role === 'admin' && (
            <section className="panel">
              <div className="panel-heading">
                <h2>
                  <UserPlus size={18} />
                  Invite a teammate
                </h2>
              </div>
              <p className="subtle">
                Register their sign-in email and role. Give them the site link through your
                preferred channel once site sharing is enabled. Invitations expire after seven days;
                registering again renews them. No invitation email is sent.
              </p>
              <form
                className="form-grid"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await action({ action: 'invite', email, role })) setEmail('');
                }}
              >
                <Field label="Sign-in email">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
                <Field label="Role">
                  <Picker
                    label="Invite role"
                    value={role}
                    onChange={setRole}
                    options={[
                      { value: 'officer', label: 'Field officer' },
                      { value: 'reviewer', label: 'Reviewer' },
                    ]}
                  />
                </Field>
                <button className="primary" disabled={!online || busy}>
                  Register invitation
                </button>
              </form>
              {invites.map((i) => (
                <div className="invite-row" key={i.id}>
                  <div>
                    <strong>{i.email}</strong>
                    <small>{i.role} · pending sign-in</small>
                  </div>
                  <button
                    className="icon-button"
                    aria-label={'Revoke invitation for ' + i.email}
                    onClick={() => void action({ action: 'revoke', id: i.id })}
                    disabled={!online || busy}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </section>
          )}
          <section className="panel">
            <h2>
              <ShieldCheck size={18} />
              Device & privacy
            </h2>
            <p className="subtle">
              Fieldwork is cached in this browser so it can survive interrupted connectivity. Use a
              protected personal device for offline work.
            </p>
            <div className="actions">
              {b.user.role === 'admin' && (
                <button
                  className="secondary"
                  disabled={!online || hasPending || busy}
                  onClick={() => void exportWorkspace()}
                >
                  Export workspace backup
                </button>
              )}
              <button className="secondary" disabled={hasPending} onClick={() => setClearing(true)}>
                Clear device cache
              </button>
              <button
                className="secondary"
                disabled={hasPending}
                onClick={() => {
                  void (async () => {
                    const response = await fetch('/api/signout', { method: 'POST' });
                    if (!response.ok) {
                      toast.error('Sign-out could not finish. Please retry.');
                      return;
                    }
                    const result = (await response.json()) as { next: string };
                    await forgetActive();
                    location.assign(result.next);
                  })().catch(() => toast.error('Connect to the internet to sign out.'));
                }}
              >
                <LogOut size={15} />
                Sign out
              </button>
            </div>
            {hasPending && (
              <p className="subtle">
                Sync or back up and resolve pending changes before clearing this device or signing
                out.
              </p>
            )}
            {b.user.role === 'admin' && (
              <p className="subtle">
                Backups contain server records and attachment bytes (up to 25 MB). Keep them
                private. Sync pending work first; unsaved form drafts are not included. Restore
                backups below as new draft copies, or use the supplied isolated recovery tool for
                larger exports.
              </p>
            )}
            <p className="subtle">
              This portfolio workspace uses fictional data and sample guidance. Real customer use
              requires organisational policies, approved procedures and operational review.
            </p>
            <a href="/delete-account">Review account deletion</a>
          </section>
          {b.user.role === 'admin' && (
            <section className="panel">
              <h2>Workspace maintenance</h2>
              <h3>Restore a workspace backup</h3>
              <p className="subtle">
                Existing cases remain. Backups restore as new drafts assigned to you; consent and
                visit confirmation must be checked again. Team permissions and invitations are not
                imported. In-app limits: 20 cases, 50 visits, 100 activity entries, 40 attachments,
                40 guidance entries and 10 MB of attachment bytes. Guidance is marked as sample
                material.
              </p>
              <form
                className="form-grid"
                onSubmit={(event) => {
                  event.preventDefault();
                  void restoreWorkspace();
                }}
              >
                <Field label="FieldProof JSON backup">
                  <input
                    type="file"
                    accept="application/json,.json"
                    disabled={busy}
                    onChange={(event) => {
                      setBackupFile(event.target.files?.[0]);
                      setRestoreId(crypto.randomUUID());
                      setRestoreConfirmation('');
                    }}
                  />
                </Field>
                {backupFile && <p className="subtle">Selected: {backupFile.name}</p>}
                <Field label="Type RESTORE AS DRAFTS">
                  <input
                    value={restoreConfirmation}
                    onChange={(event) => setRestoreConfirmation(event.target.value)}
                    autoComplete="off"
                    disabled={busy}
                  />
                </Field>
                <button
                  className="secondary"
                  disabled={
                    !backupFile ||
                    !online ||
                    busy ||
                    hasPending ||
                    restoreConfirmation !== 'RESTORE AS DRAFTS'
                  }
                >
                  Restore draft copies
                </button>
              </form>
              <p className="subtle">
                Check service configuration and retry file cleanup. These checks do not certify
                provider uptime.
              </p>
              <div className="actions">
                <button
                  className="secondary"
                  disabled={!online || busy}
                  onClick={() => {
                    void fetch('/api/health', { cache: 'no-store' })
                      .then(async (response) => {
                        const result = (await response.json()) as {
                          error?: string;
                          database: string;
                          storage: string;
                          assistant: string;
                          pendingFileCleanup: number;
                        };
                        if (!response.ok) throw new Error(result.error);
                        setHealth(result);
                      })
                      .catch((error) => toast.error(error.message));
                  }}
                >
                  Check services
                </button>
                <button
                  className="secondary"
                  disabled={!online || busy || hasPending}
                  onClick={() => void maintenance({ action: 'cleanup' })}
                >
                  Retry file cleanup
                </button>
              </div>
              {health && (
                <p role="status">
                  Database: {health.database} · Storage: {health.storage} · Assistant:{' '}
                  {health.assistant} · Pending cleanup: {health.pendingFileCleanup}
                </p>
              )}
              <h3>Delete an archived case</h3>
              <p className="subtle">
                Download a backup first. Deletion permanently removes the case, visits, evidence and
                activity. It does not delete your sign-in account or your whole workspace.
              </p>
              <Field label="Archived case">
                <select
                  value={purgeId}
                  onChange={(event) => {
                    setPurgeId(event.target.value);
                    setConfirmation('');
                  }}
                >
                  <option value="">Choose a case</option>
                  {archived.map((record) => (
                    <option key={record.id} value={record.id}>
                      {record.ref} — {record.data.name}
                    </option>
                  ))}
                </select>
              </Field>
              <button
                className="secondary"
                disabled={!selectedPurge || !online || busy || hasPending}
                onClick={() => setPurging(true)}
              >
                Review deletion
              </button>
            </section>
          )}
        </div>
      </div>
      <AlertDialog open={clearing} onOpenChange={setClearing}>
        <AlertDialogContent className="fp-dialog">
          <AlertDialogTitle>Clear this device’s cache?</AlertDialogTitle>
          <AlertDialogDescription>
            Server records remain. Local drafts and cached cases will be removed, and the workspace
            will reload.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void clearDevice().then(() => location.reload())}>
              Clear device
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={purging} onOpenChange={setPurging}>
        <AlertDialogContent className="fp-dialog">
          <AlertDialogTitle>Permanently delete {selectedPurge?.ref}?</AlertDialogTitle>
          <AlertDialogDescription>
            This cannot be undone in the app. Download and verify a backup first. Other devices may
            retain offline copies until they reconnect or their caches are cleared.
          </AlertDialogDescription>
          <Field label={'Type DELETE ' + (selectedPurge?.ref || '')}>
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
            />
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <button
              className="primary"
              disabled={
                busy || !online || hasPending || confirmation !== 'DELETE ' + selectedPurge?.ref
              }
              onClick={() =>
                selectedPurge &&
                void maintenance({
                  action: 'purge',
                  caseId: selectedPurge.id,
                  version: selectedPurge.version,
                  confirmation,
                })
              }
            >
              Delete permanently
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
