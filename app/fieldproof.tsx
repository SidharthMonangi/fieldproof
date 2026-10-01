'use client';
import { useEffect, useState, useRef } from 'react';
import {
  ArrowUpRight,
  ClipboardCheck,
  FolderOpen,
  Leaf,
  Plus,
  Search,
  ShieldCheck,
  Wifi,
  WifiOff,
  BookOpen,
  RefreshCw,
  Settings,
  MapPin,
  ArrowRight,
  Clock,
  Menu,
} from 'lucide-react';
import { Sidebar, SidebarProvider } from '@/components/ui/sidebar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Empty, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Toaster, toast } from 'sonner';
import { useFieldProof } from '@/lib/use-fieldproof';
import { scopeOf } from '@/lib/device';
import {
  checklist,
  statusLabels,
  formatMoney,
  dateLabel,
  type Status,
  type VisitRecord,
  type FileRecord,
} from '@/lib/domain';
import { CaseForm } from './forms';
import { CaseDetail } from './case-detail';
import { KnowledgePane } from './knowledge-pane';
import { SyncPane } from './sync-pane';
import { WorkspacePane } from './workspace-pane';
const nav = [
  { id: 'cases', label: 'Cases', icon: FolderOpen },
  { id: 'review', label: 'Review queue', icon: ClipboardCheck },
  { id: 'knowledge', label: 'Knowledge', icon: BookOpen },
  { id: 'sync', label: 'Sync centre', icon: RefreshCw },
  { id: 'workspace', label: 'Workspace', icon: Settings },
];
export default function FieldProof() {
  const createTrigger = useRef<HTMLButtonElement>(null);
  const app = useFieldProof(),
    b = app.snapshot;
  const [view, setView] = useState('cases'),
    [selected, setSelected] = useState<string>(),
    [context, setContext] = useState<string>(),
    [filter, setFilter] = useState('all'),
    [search, setSearch] = useState(''),
    [creating, setCreating] = useState(false),
    [newId, setNewId] = useState(''),
    [sampleBusy, setSampleBusy] = useState(false),
    [mobileMenu, setMobileMenu] = useState(false);
  const go = (v: string, id?: string) => {
    setView(v);
    setSelected(id);
    setMobileMenu(false);
    location.hash = id ? 'case/' + id : v;
  };
  useEffect(() => {
    const read = () => {
      const h = location.hash.slice(1);
      if (h.startsWith('case/')) {
        setView('cases');
        setSelected(h.slice(5));
      } else if (nav.some((n) => n.id === h)) {
        setView(h);
        setSelected(undefined);
      }
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  useEffect(() => {
    const ctx = (
      document as unknown as {
        modelContext?: { registerTool: (t: unknown, o: unknown) => Promise<void> };
      }
    ).modelContext;
    if (!ctx || !b) return;
    const lifecycle = new AbortController();
    void Promise.resolve(
      ctx.registerTool(
        {
          name: 'open_fieldproof_case',
          title: 'Open a FieldProof case',
          description:
            'Navigate to an accessible case already listed in this workspace. Does not change case data.',
          inputSchema: {
            type: 'object',
            properties: { caseId: { type: 'string' } },
            required: ['caseId'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          execute: async (input: { caseId: string }) => {
            if (
              !input ||
              typeof input.caseId !== 'string' ||
              !app.cases.some((c) => c.id === input.caseId)
            )
              throw new Error('Accessible case ID required.');
            go('cases', input.caseId);
            return { caseId: input.caseId, view: 'case' };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
    return () => lifecycle.abort();
  }, [b, app.cases]);
  const c = app.cases.find((c) => c.id === selected);
  const reviewCount = app.cases.filter((c) => c.status === 'submitted').length;
  const visits = b
    ? [
        ...b.visits,
        ...app.queue
          .filter((o) => o.type === 'visit')
          .map((o) => ({ ...(o.payload as VisitRecord), caseId: o.caseId })),
      ]
    : [];
  const files = b
    ? ([
        ...b.files,
        ...app.queue
          .filter((o) => o.type === 'upload')
          .map((o) => ({ ...o.file!, caseId: o.caseId })),
      ] as FileRecord[])
    : [];
  const visible = app.cases.filter(
    (c) =>
      (view !== 'review' || c.status === 'submitted') &&
      (filter === 'all' ? c.status !== 'archived' : c.status === filter) &&
      (c.data.name + ' ' + c.ref + ' ' + c.data.location)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const newCase = () => {
    setNewId(crypto.randomUUID());
    setCreating(true);
  };
  const samples = async () => {
    setSampleBusy(true);
    try {
      const r = await fetch('/api/seed', { method: 'POST' });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error);
      await app.refresh();
      toast.success('Fictional starter cases and sample handbook added.');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSampleBusy(false);
    }
  };
  return (
    <SidebarProvider className="app-shell">
      <Sidebar collapsible="none" className={'sidebar ' + (mobileMenu ? 'mobile-open' : '')}>
        <a className="brand" href="/#cases">
          <span className="brandmark">
            <Leaf size={23} />
          </span>
          fieldproof<span className="brand-dot">.</span>
        </a>
        <div className="workspace-label">FIELD OPERATIONS</div>
        <nav aria-label="Main navigation">
          {nav.map((n) => (
            <button
              key={n.id}
              className={'nav-item ' + (view === n.id ? 'active' : '')}
              onClick={() => go(n.id)}
              aria-current={view === n.id ? 'page' : undefined}
            >
              <n.icon size={19} />
              {n.label}
              {n.id === 'review' && reviewCount > 0 && <span>{reviewCount}</span>}
              {n.id === 'sync' && app.queue.length > 0 && <span>{app.queue.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-card">
          <span className="eyebrow">MADE FOR THE FIELD</span>
          <p>
            Clear evidence.
            <br />
            Confident next steps.
          </p>
          <Leaf size={32} />
        </div>
        <div className="sidebar-foot">
          <div className="avatar">{b ? b.user.name.slice(0, 2).toUpperCase() : 'FP'}</div>
          <div>
            <strong>{b ? b.user.name : 'Your workspace'}</strong>
            <small>{b ? b.user.role : 'Housing fieldwork'}</small>
          </div>
        </div>
      </Sidebar>
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="Toggle navigation"
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              <Menu size={18} />
            </button>
            <span>
              {b?.workspace.name ?? 'Workspace'} <span className="slash">/</span>
              {c ? c.ref : nav.find((n) => n.id === view)?.label}
            </span>
          </div>
          <button
            className={'connection ' + (!app.online || app.paused ? 'offline' : '')}
            onClick={() => go('sync')}
          >
            <i />
            {app.online && !app.paused ? <Wifi size={15} /> : <WifiOff size={15} />}
            <span>
              {!app.online
                ? 'Offline'
                : app.paused
                  ? 'Sync paused'
                  : app.syncing
                    ? 'Syncing…'
                    : 'Connected'}
            </span>
          </button>
        </header>
        <div className="page-content">
          {app.error && (
            <div className="notice amber" role="alert">
              <Clock size={17} />
              <div>
                {app.error}
                <button className="text-button" onClick={() => void app.sync()}>
                  Retry connection
                </button>
              </div>
            </div>
          )}
          {app.loading && !b ? (
            <>
              <Skeleton className="loading-title" />
              <Skeleton className="loading-block" />
            </>
          ) : !b ? (
            <>
              <div className="eyebrow">EVERY VISIT, ACCOUNTED FOR</div>
              <div className="page-heading">
                <div>
                  <h1>
                    Good work starts
                    <br />
                    with clear evidence.
                  </h1>
                  <p>Collect in the field. Review with confidence.</p>
                </div>
              </div>
              <section className="welcome-card">
                <span className="welcome-icon">
                  <ShieldCheck size={32} />
                </span>
                <h2>A clear path from visit to review.</h2>
                <p>
                  Sign in to create your workspace, record property visits and keep the evidence
                  together—even when connectivity drops.
                </p>
                <a className="primary" href="/signin" target="_top">
                  Open your workspace <ArrowUpRight size={18} />
                </a>
                <small>Private records · Recoverable fieldwork · Sourced guidance</small>
              </section>
              <div className="bottom-note">
                <MapPin size={16} />
                Built for the places where the work happens.
              </div>
            </>
          ) : selected && c ? (
            <CaseDetail
              c={c}
              b={b}
              queue={app.queue}
              enqueue={app.enqueue}
              onBack={() => go('cases')}
              onAsk={() => {
                setContext(c.id);
                go('knowledge');
              }}
            />
          ) : selected && !c ? (
            <Empty>
              <EmptyTitle>This case is unavailable</EmptyTitle>
              <EmptyDescription>
                It may have been reassigned or is outside your workspace.
              </EmptyDescription>
              <button className="secondary" onClick={() => go('cases')}>
                Back to cases
              </button>
            </Empty>
          ) : view === 'knowledge' ? (
            <KnowledgePane b={b} caseId={context} online={app.online && !app.paused} />
          ) : view === 'sync' ? (
            <SyncPane
              queue={app.queue}
              cases={app.cases}
              online={app.online}
              paused={app.paused}
              syncing={app.syncing}
              lastSync={app.lastSync}
              sync={app.sync}
              togglePause={app.togglePause}
              retry={app.retry}
              discard={app.discard}
            />
          ) : view === 'workspace' ? (
            <WorkspacePane
              b={b}
              online={app.online && !app.paused}
              hasPending={app.queue.length > 0}
              onRefresh={app.refresh}
            />
          ) : (
            <>
              <div className="eyebrow">
                {view === 'review' ? 'A SECOND LOOK, WITH PURPOSE' : 'EVERY VISIT, ACCOUNTED FOR'}
              </div>
              <div className="page-heading">
                <div>
                  <h1>
                    {view === 'review' ? (
                      'Evidence worth a closer look.'
                    ) : (
                      <>
                        Good work starts
                        <br />
                        with clear evidence.
                      </>
                    )}
                  </h1>
                  <p>
                    {view === 'review'
                      ? 'Review complete submissions and leave a clear next step.'
                      : 'Collect in the field. Review with confidence.'}
                  </p>
                </div>
                {b.user.role !== 'reviewer' && (
                  <button ref={createTrigger} className="primary" onClick={newCase}>
                    <Plus size={18} />
                    New case
                  </button>
                )}
              </div>
              <div className="stats">
                <div>
                  <small>ACTIVE CASES</small>
                  <strong>
                    {app.cases
                      .filter((c) => c.status !== 'archived')
                      .length.toString()
                      .padStart(2, '0')}
                  </strong>
                  <span>Your work, in one place</span>
                </div>
                <div>
                  <small>AWAITING REVIEW</small>
                  <strong>{reviewCount.toString().padStart(2, '0')}</strong>
                  <span>Ready for a second look</span>
                </div>
                <div>
                  <small>VISITS RECORDED</small>
                  <strong>{visits.length.toString().padStart(2, '0')}</strong>
                  <span>Evidence from the field</span>
                </div>
                <div>
                  <small>DEVICE QUEUE</small>
                  <strong>{app.queue.length.toString().padStart(2, '0')}</strong>
                  <button className="text-button" onClick={() => go('sync')}>
                    {app.queue.length ? 'Check pending changes' : 'Everything accounted for'}
                    <ArrowUpRight size={12} />
                  </button>
                </div>
              </div>
              <div className="section-heading">
                <h2>
                  {view === 'review' ? 'Submitted cases' : 'Your cases'}{' '}
                  <span className="subtle">{visible.length}</span>
                </h2>
                <div className="search">
                  <Search size={17} />
                  <input
                    aria-label="Search cases"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name, reference or location"
                  />
                </div>
              </div>
              {view !== 'review' && (
                <Tabs value={filter} onValueChange={setFilter}>
                  <TabsList variant="line" className="fp-tabs filter-tabs">
                    {[
                      { id: 'all', label: 'Active' },
                      { id: 'draft', label: 'In progress' },
                      { id: 'changes_requested', label: 'Needs changes' },
                      { id: 'verified', label: 'Verified' },
                      { id: 'archived', label: 'Archived' },
                    ].map((t) => (
                      <TabsTrigger key={t.id} value={t.id}>
                        {t.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              )}
              {visible.length ? (
                <div className="case-table">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>APPLICANT</TableHead>
                        <TableHead>REQUEST</TableHead>
                        <TableHead>EVIDENCE</TableHead>
                        <TableHead>STATUS</TableHead>
                        <TableHead>UPDATED</TableHead>
                        <TableHead>
                          <span className="sr-only">Open case</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visible.map((c) => {
                        const items = checklist(c, visits as VisitRecord[], files),
                          count = items.filter((i) => i.complete).length;
                        return (
                          <TableRow key={c.id}>
                            <TableCell>
                              <button
                                className="applicant-button"
                                onClick={() => go('cases', c.id)}
                              >
                                <span className="avatar">
                                  {c.data.name
                                    .split(' ')
                                    .map((s) => s[0])
                                    .slice(0, 2)
                                    .join('')}
                                </span>
                                <span>
                                  <strong>{c.data.name}</strong>
                                  <small>{c.data.location}</small>
                                  <small className="case-ref">{c.ref}</small>
                                </span>
                              </button>
                            </TableCell>
                            <TableCell>
                              <strong>{formatMoney(c.data.amount)}</strong>
                              <small>{c.data.purpose}</small>
                            </TableCell>
                            <TableCell>
                              <div className="evidence-progress">
                                <span>
                                  {count} of {items.length}
                                </span>
                                <Progress
                                  className="fp-progress"
                                  value={(count / items.length) * 100}
                                />
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className={'badge ' + c.status}>{statusLabels[c.status]}</span>
                              {app.queue.some((o) => o.caseId === c.id) && (
                                <small className="pending-label">On device</small>
                              )}
                            </TableCell>
                            <TableCell className="subtle">{dateLabel(c.updatedAt)}</TableCell>
                            <TableCell>
                              <button
                                className="icon-button"
                                aria-label={'Open ' + c.data.name}
                                onClick={() => go('cases', c.id)}
                              >
                                <ArrowRight size={18} />
                              </button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <section className="welcome-card">
                  <span className="welcome-icon">
                    <FolderOpen size={30} />
                  </span>
                  <h2>
                    {search
                      ? 'No cases match your search'
                      : view === 'review'
                        ? 'No cases awaiting review'
                        : app.cases.length
                          ? 'No cases in this view'
                          : 'Your first case starts here.'}
                  </h2>
                  <p>
                    {view === 'review'
                      ? 'Complete submissions will appear here when field officers send them for review.'
                      : 'Create a case and start collecting its evidence, or explore the workflow with clearly labelled fictional applicants.'}
                  </p>
                  <div className="actions">
                    {b.user.role !== 'reviewer' && view !== 'review' && (
                      <button ref={createTrigger} className="primary" onClick={newCase}>
                        <Plus size={16} />
                        Create a case
                      </button>
                    )}
                    {b.user.role === 'admin' && !app.cases.length && (
                      <button
                        className="secondary"
                        disabled={sampleBusy || !app.online || app.paused}
                        onClick={() => void samples()}
                      >
                        {sampleBusy ? 'Adding samples…' : 'Load fictional starter cases'}
                      </button>
                    )}
                  </div>
                </section>
              )}
              <div className="bottom-note">
                <MapPin size={16} />
                Built for the places where the work happens.
              </div>
            </>
          )}
        </div>
      </main>
      {b && (
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogContent
            className="fp-dialog"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              createTrigger.current?.focus();
            }}
          >
            <DialogTitle>Create a case</DialogTitle>
            <DialogDescription>
              Start with the applicant and property. Collect supporting evidence as the case
              progresses.
            </DialogDescription>
            <CaseForm
              scope={scopeOf(b)}
              draftKey="new-case"
              onSave={async (d) => {
                await app.enqueue('create', newId, d);
                setCreating(false);
                go('cases', newId);
                toast.success('Case saved on this device.');
              }}
            />
          </DialogContent>
        </Dialog>
      )}
      <Toaster position="bottom-right" richColors />
    </SidebarProvider>
  );
}
