'use client';
import { useState } from 'react';
import { useModalFocus } from '@/lib/use-modal-focus';
import {
  ArrowLeft,
  Plus,
  MapPin,
  Phone,
  FileText,
  Check,
  Clock,
  Download,
  Archive,
  Send,
  ShieldCheck,
  UserRound,
  ArrowUpRight,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { Empty, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { toast } from 'sonner';
import { CaseForm, VisitForm, Picker, Field, preparePhoto } from './forms';
import {
  checklist,
  statusLabels,
  formatMoney,
  dateLabel,
  evidenceKinds,
  type CaseRecord,
  type Bootstrap,
  type QueuedOperation,
  type Operation,
  type VisitRecord,
  type FileRecord,
} from '@/lib/domain';
import { scopeOf } from '@/lib/device';
type Props = {
  c: CaseRecord;
  b: Bootstrap;
  queue: QueuedOperation[];
  enqueue: (
    type: Operation['type'],
    id: string,
    payload: unknown,
    file?: { blob: Blob; name: string; mime: string; kind: (typeof evidenceKinds)[number] },
  ) => Promise<QueuedOperation>;
  onBack: () => void;
  onAsk: () => void;
};
export function CaseDetail({ c, b, queue, enqueue, onBack, onAsk }: Props) {
  const { rememberFocus, restoreFocus } = useModalFocus();
  const openModal = (name: string) => {
    rememberFocus();
    setModal(name);
  };
  const [modal, setModal] = useState(''),
    [archiving, setArchiving] = useState(false),
    [reviewNote, setReviewNote] = useState(''),
    [decision, setDecision] = useState('changes_requested'),
    [kind, setKind] = useState('photo'),
    [file, setFile] = useState<File>(),
    [busy, setBusy] = useState(false),
    [assigned, setAssigned] = useState(c.assignedTo);
  const local = queue.filter((o) => o.caseId === c.id);
  const visits: VisitRecord[] = [
    ...local
      .filter((o) => o.type === 'visit')
      .map((o) => ({
        ...(o.payload as VisitRecord),
        id: o.id,
        caseId: c.id,
        actor: b.user.userId,
        createdAt: o.createdAt,
      })),
    ...b.visits.filter((v) => v.caseId === c.id),
  ];
  const files: FileRecord[] = [
    ...local
      .filter((o) => o.type === 'upload')
      .map((o) => ({
        ...o.file!,
        id: o.id,
        caseId: c.id,
        actor: b.user.userId,
        createdAt: o.createdAt,
      })),
    ...b.files.filter((f) => f.caseId === c.id),
  ];
  const items = checklist(c, visits, files),
    complete = items.filter((i) => i.complete).length,
    editable = ['draft', 'changes_requested'].includes(c.status) && b.user.role !== 'reviewer';
  const name = (id: string) => b.members.find((m) => m.userId === id)?.name ?? 'Workspace member';
  const act = async (type: Operation['type'], payload: unknown = {}) => {
    setBusy(true);
    try {
      await enqueue(type, c.id, payload);
      toast.success('Saved on this device. Sync will confirm server receipt.');
      setModal('');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const download = () => {
    const data = {
      case: c,
      visits,
      files,
      activity: b.audit.filter((a) => a.caseId === c.id),
      exportedAt: new Date().toISOString(),
      pendingOperations: local.map((o) => ({ id: o.id, type: o.type, state: o.state })),
      note: 'Evidence review export. Not a loan approval.',
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = c.ref + '.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <button className="text-button back" onClick={onBack}>
        <ArrowLeft size={16} />
        All cases
      </button>
      <div className="detail-heading">
        <div>
          <div className="eyebrow">
            {c.ref} <span className={'badge ' + c.status}>{statusLabels[c.status]}</span>
          </div>
          <h1>{c.data.name}</h1>
          <p>
            <MapPin size={15} />
            {c.data.location}
          </p>
        </div>
        <div className="actions">
          <button className="secondary" onClick={download}>
            <Download size={16} />
            Export
          </button>
          {editable && (
            <button className="primary" onClick={() => openModal('edit')}>
              Edit case
            </button>
          )}
        </div>
      </div>
      {local.length > 0 && (
        <div className="notice amber">
          <Clock size={17} />
          {local.length} change{local.length === 1 ? '' : 's'} saved on this device. Waiting for
          server confirmation.
        </div>
      )}
      {c.reviewNote && (
        <div className="notice">
          <ShieldCheck size={18} />
          <div>
            <strong>Reviewer’s note</strong>
            <p>{c.reviewNote}</p>
          </div>
        </div>
      )}
      <div className="detail-grid">
        <div className="detail-main">
          <Tabs defaultValue="overview">
            <TabsList className="fp-tabs" variant="line">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="visits">Visits ({visits.length})</TabsTrigger>
              <TabsTrigger value="evidence">Evidence ({files.length})</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <section className="panel">
                <div className="panel-heading">
                  <h2>Applicant & property</h2>
                  <span className="subtle">Version {c.version}</span>
                </div>
                <dl className="info-grid">
                  <div>
                    <dt>Contact number</dt>
                    <dd>
                      <Phone size={14} />
                      {c.data.phone}
                    </dd>
                  </div>
                  <div>
                    <dt>Purpose</dt>
                    <dd>{c.data.purpose}</dd>
                  </div>
                  <div>
                    <dt>Requested amount</dt>
                    <dd>{formatMoney(c.data.amount)}</dd>
                  </div>
                  <div>
                    <dt>Monthly income</dt>
                    <dd>{formatMoney(c.data.income)}</dd>
                  </div>
                  <div>
                    <dt>Assigned to</dt>
                    <dd>
                      <UserRound size={14} />
                      {name(c.assignedTo)}
                    </dd>
                  </div>
                  <div>
                    <dt>Consent</dt>
                    <dd>{c.data.consent ? 'Recorded' : 'Not recorded'}</dd>
                  </div>
                </dl>
                <div className="notes">
                  <small>CASE NOTES</small>
                  <p>{c.data.notes || 'No notes yet.'}</p>
                </div>
                <div className="panel-foot">
                  <span>Created {dateLabel(c.createdAt)}</span>
                  {b.user.role === 'admin' && c.status !== 'archived' && (
                    <button
                      className="text-button"
                      onClick={() => {
                        setAssigned(c.assignedTo);
                        openModal('assign');
                      }}
                    >
                      Change assignment <ArrowUpRight size={14} />
                    </button>
                  )}
                </div>
              </section>
              <section className="field-callout">
                <span className="welcome-icon">
                  <MapPin size={25} />
                </span>
                <div>
                  <h2>Bring the field into focus.</h2>
                  <p>Record observations, confirm the address and attach the evidence.</p>
                </div>
                {editable && (
                  <button className="secondary" onClick={() => openModal('visit')}>
                    <Plus size={15} />
                    Record visit
                  </button>
                )}
              </section>
            </TabsContent>
            <TabsContent value="visits">
              <section className="panel">
                <div className="panel-heading">
                  <h2>Field visits</h2>
                  {editable && (
                    <button className="secondary" onClick={() => openModal('visit')}>
                      <Plus size={15} />
                      Record visit
                    </button>
                  )}
                </div>
                {!visits.length ? (
                  <Empty>
                    <EmptyTitle>No visits recorded</EmptyTitle>
                    <EmptyDescription>
                      Capture your observations from the property.
                    </EmptyDescription>
                  </Empty>
                ) : (
                  visits.map((v) => (
                    <article className="visit-card" key={v.id}>
                      <div className="row-between">
                        <strong>{dateLabel(v.date + 'T12:00:00Z')}</strong>
                        <span className="badge">
                          {local.some((o) => o.id === v.id) ? 'On device' : 'Synced'}
                        </span>
                      </div>
                      <p className="subtle">
                        {v.occupancy} · {v.condition}
                      </p>
                      <p>{v.notes}</p>
                      <div className="visit-checks">
                        <span>
                          {v.applicantMet ? <Check size={14} /> : <Clock size={14} />}Applicant met
                        </span>
                        <span>
                          {v.addressConfirmed ? <Check size={14} /> : <Clock size={14} />}Address
                          confirmed
                        </span>
                      </div>
                      {v.latitude !== null && (
                        <small className="subtle">
                          Location: {v.latitude.toFixed(5)}, {v.longitude?.toFixed(5)}
                        </small>
                      )}
                      <small className="subtle">Recorded by {name(v.actor)}</small>
                    </article>
                  ))
                )}
              </section>
            </TabsContent>
            <TabsContent value="evidence">
              <section className="panel">
                <div className="panel-heading">
                  <h2>Evidence library</h2>
                  {editable && (
                    <button
                      className="secondary"
                      onClick={() => {
                        setFile(undefined);
                        openModal('upload');
                      }}
                    >
                      <Plus size={15} />
                      Attach evidence
                    </button>
                  )}
                </div>
                <p className="subtle">
                  PDF and images · up to 8 MB each. Uploads do not establish authenticity.
                </p>
                {!files.length ? (
                  <Empty>
                    <EmptyTitle>No attachments yet</EmptyTitle>
                    <EmptyDescription>
                      Keep identity, income and property evidence with the case.
                    </EmptyDescription>
                  </Empty>
                ) : (
                  files.map((f) => (
                    <div className="file-row" key={f.id}>
                      <div className="file-icon">
                        <FileText size={20} />
                      </div>
                      <div className="file-name">
                        <strong>{f.name}</strong>
                        <small>
                          {f.kind} · {(f.size / 1024).toFixed(0)} KB · {dateLabel(f.createdAt)}
                        </small>
                      </div>
                      {local.some((o) => o.id === f.id) ? (
                        <span className="badge">On device</span>
                      ) : (
                        <a
                          className="icon-button"
                          aria-label={'Download ' + f.name}
                          href={'/api/files/' + f.id}
                        >
                          <Download size={17} />
                        </a>
                      )}
                    </div>
                  ))
                )}
              </section>
            </TabsContent>
            <TabsContent value="activity">
              <section className="panel">
                <h2>Activity history</h2>
                <div className="timeline">
                  {local.map((o) => (
                    <div className="timeline-item" key={o.id}>
                      <span className="timeline-dot pending" />
                      <div>
                        <strong>{o.type} · waiting to sync</strong>
                        <p>
                          {dateLabel(o.createdAt)} · {b.user.name}
                        </p>
                      </div>
                    </div>
                  ))}
                  {b.audit
                    .filter((a) => a.caseId === c.id)
                    .map((a) => (
                      <div className="timeline-item" key={a.id}>
                        <span className="timeline-dot" />
                        <div>
                          <strong>{a.detail}</strong>
                          <p>
                            {name(a.actor)} ·{' '}
                            {new Date(a.createdAt).toLocaleString('en-IN', {
                              timeZone: 'Asia/Kolkata',
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            </TabsContent>
          </Tabs>
        </div>
        <aside className="detail-aside">
          <section className="panel checklist">
            <div className="row-between">
              <h2>Ready for review?</h2>
              <span className="completion">
                {complete}/{items.length}
              </span>
            </div>
            <Progress className="fp-progress" value={(complete / items.length) * 100} />
            <div className="checklist-items">
              {items.map((i) => (
                <div key={i.label} className={i.complete ? 'done' : ''}>
                  <span>{i.complete ? <Check size={12} /> : <span />}</span>
                  {i.label}
                </div>
              ))}
            </div>
            {editable && (
              <button
                className="primary full"
                disabled={complete !== items.length || busy}
                onClick={() => void act('submit')}
              >
                <Send size={15} />
                Submit for review
              </button>
            )}
            {c.status === 'submitted' && b.user.role !== 'officer' && (
              <button
                className="primary full"
                onClick={() => {
                  setReviewNote('');
                  setDecision('changes_requested');
                  openModal('review');
                }}
              >
                <ShieldCheck size={16} />
                Review evidence
              </button>
            )}
            <small>Evidence verification is separate from a lending decision.</small>
          </section>
          <section className="assistant-callout">
            <span className="eyebrow">HANDBOOK ASSISTANT</span>
            <h2>
              A little clarity
              <br />
              goes a long way.
            </h2>
            <p>Find the next step or check the source behind a procedure.</p>
            <button className="text-button" onClick={onAsk}>
              Ask about this case <ArrowUpRight size={16} />
            </button>
          </section>
          {b.user.role === 'admin' && c.status !== 'archived' && c.status !== 'submitted' && (
            <button
              className="text-button archive-link"
              onClick={() => {
                rememberFocus();
                setArchiving(true);
              }}
            >
              <Archive size={15} />
              Archive case
            </button>
          )}
        </aside>
      </div>
      <Dialog
        open={!!modal}
        onOpenChange={(open) => {
          if (!open && !busy) setModal('');
        }}
      >
        <DialogContent className="fp-dialog" onCloseAutoFocus={restoreFocus}>
          <DialogTitle>
            {
              (
                {
                  edit: 'Edit applicant information',
                  visit: 'Record a field visit',
                  upload: 'Attach evidence',
                  review: 'Review case evidence',
                  assign: 'Assign this case',
                } as Record<string, string>
              )[modal]
            }
          </DialogTitle>
          <DialogDescription>
            {modal === 'review'
              ? 'Record a specific explanation. This action reviews evidence and does not approve a loan.'
              : 'Your information is preserved on this device before syncing.'}
          </DialogDescription>
          {modal === 'edit' && (
            <CaseForm
              initial={c.data}
              scope={scopeOf(b)}
              draftKey={'case:' + c.id}
              onSave={async (d) => {
                await enqueue('update', c.id, d);
                setModal('');
                toast.success('Case saved on this device.');
              }}
            />
          )}
          {modal === 'visit' && (
            <VisitForm
              scope={scopeOf(b)}
              caseId={c.id}
              onSave={async (v) => {
                await enqueue('visit', c.id, v);
                setModal('');
                toast.success('Visit saved on this device.');
              }}
            />
          )}
          {modal === 'upload' && (
            <form
              className="form-grid"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!file) return;
                setBusy(true);
                try {
                  const prepared = kind === 'photo' ? await preparePhoto(file) : file;
                  if (prepared.size > 8 * 1024 * 1024)
                    throw new Error('This file is larger than 8 MB.');
                  await enqueue(
                    'upload',
                    c.id,
                    {},
                    {
                      blob: prepared,
                      name: prepared.name,
                      mime: prepared.type,
                      kind: kind as (typeof evidenceKinds)[number],
                    },
                  );
                  setModal('');
                  toast.success('Attachment saved on this device.');
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Field label="Evidence type">
                <Picker
                  label="Evidence type"
                  value={kind}
                  onChange={setKind}
                  options={evidenceKinds.map((s) => ({
                    value: s,
                    label:
                      s === 'photo'
                        ? 'Property photograph'
                        : s[0].toUpperCase() + s.slice(1) + ' evidence',
                  }))}
                />
              </Field>
              <Field label="Choose file">
                <input
                  type="file"
                  required
                  accept={
                    kind === 'photo'
                      ? 'image/jpeg,image/png,image/webp'
                      : 'application/pdf,image/jpeg,image/png,image/webp'
                  }
                  onChange={(e) => setFile(e.target.files?.[0])}
                />
              </Field>
              <p className="subtle">
                Photographs are resized and re-encoded to reduce upload size and remove embedded
                metadata. Use fictional evidence in this portfolio workspace.
              </p>
              <button className="primary" disabled={!file || busy}>
                {busy ? 'Preparing attachment…' : 'Save attachment'}
              </button>
            </form>
          )}
          {modal === 'review' && (
            <form
              className="form-grid"
              onSubmit={(e) => {
                e.preventDefault();
                void act('review', { decision, note: reviewNote });
              }}
            >
              <Field label="Review outcome">
                <Picker
                  label="Review outcome"
                  value={decision}
                  onChange={setDecision}
                  options={[
                    { value: 'changes_requested', label: 'Request changes' },
                    { value: 'verified', label: 'Mark evidence verified' },
                  ]}
                />
              </Field>
              <Field label="Explanation">
                <textarea
                  required
                  minLength={5}
                  maxLength={3000}
                  rows={4}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                />
              </Field>
              <button className="primary" disabled={busy}>
                Save review
              </button>
            </form>
          )}
          {modal === 'assign' && (
            <form
              className="form-grid"
              onSubmit={(e) => {
                e.preventDefault();
                void act('assign', { assignedTo: assigned });
              }}
            >
              <Picker
                label="Assigned officer"
                value={assigned}
                onChange={setAssigned}
                options={b.members
                  .filter((m) => m.role !== 'reviewer')
                  .map((m) => ({ value: m.userId, label: m.name }))}
              />
              <button className="primary" disabled={busy}>
                Save assignment
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog open={archiving} onOpenChange={setArchiving}>
        <AlertDialogContent className="fp-dialog" onCloseAutoFocus={restoreFocus}>
          <AlertDialogTitle>Archive this case?</AlertDialogTitle>
          <AlertDialogDescription>
            The case and its evidence remain in the workspace, but further changes will be disabled.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep active</AlertDialogCancel>
            <AlertDialogAction onClick={() => void act('archive')}>Archive case</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
