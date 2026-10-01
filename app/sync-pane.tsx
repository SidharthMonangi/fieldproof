'use client';
import { useState } from 'react';
import { useModalFocus } from '@/lib/use-modal-focus';
import { RefreshCw, CheckCircle2, Clock, Download, WifiOff, AlertTriangle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
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
import type { QueuedOperation, CaseRecord } from '@/lib/domain';
type Props = {
  queue: QueuedOperation[];
  cases: CaseRecord[];
  online: boolean;
  paused: boolean;
  syncing: boolean;
  lastSync: string;
  sync: () => Promise<void>;
  togglePause: () => void;
  retry: (o: QueuedOperation) => Promise<void>;
  discard: (o: QueuedOperation) => Promise<void>;
};
export function SyncPane(p: Props) {
  const { rememberFocus, restoreFocus } = useModalFocus();
  const [confirm, setConfirm] = useState<{ op: QueuedOperation; action: 'retry' | 'discard' }>();
  const exportQueue = async () => {
    const backup = await Promise.all(
      p.queue.map(async (o) => {
        const { blob, ...rest } = o;
        let bytes: string | undefined;
        if (blob) {
          bytes = await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.onerror = () => reject(r.error);
            r.readAsDataURL(blob);
          });
        }
        return { ...rest, attachmentDataUrl: bytes };
      }),
    );
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              format: 'fieldproof-queue-backup-v1',
              exportedAt: new Date().toISOString(),
              operations: backup,
            },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      ),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fieldproof-device-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <div className="eyebrow">KEEP THE WORK MOVING</div>
      <div className="page-heading">
        <div>
          <h1>Every change has a place.</h1>
          <p>See what reached the server and what still needs attention.</p>
        </div>
        <button
          className="primary"
          onClick={() => void p.sync()}
          disabled={!p.online || p.paused || p.syncing}
        >
          <RefreshCw size={16} className={p.syncing ? 'spin' : ''} />
          {p.syncing ? 'Syncing…' : 'Sync now'}
        </button>
      </div>
      <div className={'sync-banner ' + (!p.online || p.paused ? 'amber' : '')}>
        <span>{p.online && !p.paused ? <CheckCircle2 size={27} /> : <WifiOff size={27} />}</span>
        <div>
          <h2>
            {!p.online
              ? 'Working offline'
              : p.paused
                ? 'Sync is paused'
                : 'Connected to your workspace'}
          </h2>
          <p>
            {p.queue.length
              ? `${p.queue.length} operation(s) preserved on this device.`
              : 'There is no unsent work on this device.'}
          </p>
          <small>
            {p.lastSync
              ? 'Last server refresh: ' +
                new Date(p.lastSync).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
              : 'No server refresh this session.'}
          </small>
        </div>
      </div>
      <section className="panel">
        <div className="row-between">
          <div>
            <h2>Pause syncing</h2>
            <p className="subtle">
              Record fieldwork locally while paused. Re-enable to send it to the server.
            </p>
          </div>
          <Switch checked={p.paused} onCheckedChange={p.togglePause} aria-label="Pause syncing" />
        </div>
      </section>
      <div className="section-heading">
        <h2>
          Device queue <span className="subtle">({p.queue.length})</span>
        </h2>
        <button className="secondary" onClick={() => void exportQueue()} disabled={!p.queue.length}>
          <Download size={15} />
          Back up unsent work
        </button>
      </div>
      {!p.queue.length ? (
        <section className="empty-sync">
          <CheckCircle2 size={40} />
          <h2>All clear.</h2>
          <p>New changes will appear here until the server confirms receipt.</p>
        </section>
      ) : (
        p.queue.map((o) => (
          <section key={o.id} className="panel queue-card">
            <div className="row-between">
              <div className="queue-title">
                {o.state === 'pending' ? <Clock size={18} /> : <AlertTriangle size={18} />}
                <strong>
                  {o.type === 'upload'
                    ? 'Attach ' + o.file?.name
                    : o.type[0].toUpperCase() + o.type.slice(1)}
                </strong>
                <span className={'badge ' + (o.state === 'pending' ? '' : 'amber')}>
                  {o.state === 'pending'
                    ? 'Waiting to sync'
                    : o.state === 'conflict'
                      ? 'Conflict'
                      : 'Needs attention'}
                </span>
              </div>
              <small className="subtle">
                {p.cases.find((c) => c.id === o.caseId)?.ref ?? o.caseId.slice(0, 8)}
              </small>
            </div>
            <p>
              {o.error || 'Saved on this device. Safe retries use the same operation identifier.'}
            </p>
            <small className="subtle">
              Saved {new Date(o.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} ·{' '}
              {o.attempts} attempts · base version {o.baseVersion}
            </small>
            {o.state !== 'pending' && (
              <>
                <div className="compare-grid">
                  <div>
                    <h3>Your proposed change</h3>
                    <pre>{JSON.stringify(o.payload, null, 2)}</pre>
                  </div>
                  <div>
                    <h3>Server version {o.server?.version ?? '—'}</h3>
                    <pre>
                      {o.server
                        ? JSON.stringify(o.server.data, null, 2)
                        : 'Refresh the workspace to inspect the current version.'}
                    </pre>
                  </div>
                </div>
                <div className="actions">
                  <button
                    className="secondary"
                    disabled={!p.online || p.paused}
                    onClick={() => {
                      rememberFocus();
                      setConfirm({ op: o, action: 'retry' });
                    }}
                  >
                    Retry against current version
                  </button>
                  <button
                    className="danger-button"
                    onClick={() => {
                      rememberFocus();
                      setConfirm({ op: o, action: 'discard' });
                    }}
                  >
                    Discard this and later case changes
                  </button>
                </div>
              </>
            )}
          </section>
        ))
      )}
      <div className="notice">
        <Download size={17} />
        <p>
          Device backups include attachments and should be kept private. Browser storage can be
          cleared or evicted; sync before clearing it.
        </p>
      </div>
      <AlertDialog
        open={!!confirm}
        onOpenChange={(o) => {
          if (!o) setConfirm(undefined);
        }}
      >
        <AlertDialogContent className="fp-dialog" onCloseAutoFocus={restoreFocus}>
          <AlertDialogTitle>
            {confirm?.action === 'retry'
              ? 'Apply your proposal to the latest case?'
              : 'Discard unsent case changes?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {confirm?.action === 'retry'
              ? 'The case will be refreshed and this operation, plus later queued operations for this case, will be retried in order. For applicant edits, your proposal replaces the server’s applicant fields. Compare the versions first.'
              : 'This operation and all later unsent operations for the same case will be removed from this device. Back them up first if you need to retain them.'}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirm) return;
                const fn = confirm.action === 'retry' ? p.retry : p.discard;
                void fn(confirm.op).catch((e) => toast.error(e.message));
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
