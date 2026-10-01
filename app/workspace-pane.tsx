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
                preferred channel once site sharing is enabled. No invitation email is sent.
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
              <button className="secondary" disabled={hasPending} onClick={() => setClearing(true)}>
                Clear device cache
              </button>
              <button
                className="secondary"
                disabled={hasPending}
                onClick={() => {
                  void forgetActive().then(() =>
                    location.assign('/signout-with-chatgpt?return_to=/'),
                  );
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
            <p className="subtle">
              This portfolio workspace uses fictional data and sample guidance. Real customer use
              requires organisational policies, approved procedures and operational review.
            </p>
          </section>
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
    </>
  );
}
