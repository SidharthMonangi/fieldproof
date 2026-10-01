'use client';
import { useEffect, useState, useRef } from 'react';
import { BookOpen, ArrowUpRight, Search, Plus, Sparkles, Send, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Empty, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { toast } from 'sonner';
import { Picker, Field } from './forms';
import { useModalFocus } from '@/lib/use-modal-focus';
import { sourceMetadata } from '@/lib/source-metadata';
import type { Article } from '@/lib/knowledge';
import type { Bootstrap, ChecklistItem } from '@/lib/domain';
type Answer = {
  mode: string;
  answer: string;
  sources: (Article & { quote?: string })[];
  items?: ChecklistItem[];
  escalate: boolean;
};
export function KnowledgePane({
  b,
  caseId,
  online,
}: {
  b: Bootstrap;
  caseId?: string;
  online: boolean;
}) {
  const { rememberFocus, restoreFocus } = useModalFocus();
  const openSource = (article: Article) => {
    rememberFocus();
    setSource(article);
  };
  const openEdit = (article: Partial<Article>) => {
    rememberFocus();
    setEdit(article);
  };
  const assistantRef = useRef<HTMLElement>(null);
  const [articles, setArticles] = useState<Article[]>([]),
    [search, setSearch] = useState(''),
    [question, setQuestion] = useState(''),
    [answer, setAnswer] = useState<Answer>(),
    [busy, setBusy] = useState(false),
    [edit, setEdit] = useState<Partial<Article>>(),
    [source, setSource] = useState<Article>(),
    [saving, setSaving] = useState(false),
    [loadError, setLoadError] = useState('');
  const load = async () => {
    try {
      const r = await fetch('/api/knowledge');
      const d = (await r.json()) as Answer & Article[] & { error?: string };
      if (!r.ok) throw new Error(d.error);
      setArticles(d);
      setLoadError('');
    } catch {
      setLoadError('Connect to load the workspace handbook.');
    }
  };
  useEffect(() => {
    void load();
  }, [b.user.workspaceId, online]);
  const ask = async (q: string) => {
    setQuestion(q);
    assistantRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setBusy(true);
    try {
      const r = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, caseId }),
        signal: AbortSignal.timeout(35000),
      });
      const d = (await r.json()) as Answer & Article[] & { error?: string };
      if (!r.ok) throw new Error(d.error);
      setAnswer(d);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const selected = caseId ? b.cases.find((c) => c.id === caseId) : undefined;
  return (
    <>
      <div className="eyebrow">KNOWLEDGE WITH A SOURCE</div>
      <div className="page-heading">
        <div>
          <h1>A clearer next step.</h1>
          <p>Find guidance, read its source and know when to ask for help.</p>
        </div>
        {b.user.role === 'admin' && (
          <button
            className="primary"
            onClick={() => openEdit({ title: '', body: '', category: 'Fieldwork' })}
            disabled={!online}
          >
            <Plus size={16} />
            Add guidance
          </button>
        )}
      </div>
      {b.user.role === 'admin' && (
        <div className="notice">
          <p>
            Import dated excerpts from PIB housing updates and BEE building guidance. Public
            references are separate from company procedures.
          </p>
          <button
            className="secondary"
            disabled={!online || saving}
            onClick={async () => {
              setSaving(true);
              try {
                const r = await fetch('/api/sources', { method: 'POST' });
                const d = (await r.json()) as { error?: string; results: { imported: boolean }[] };
                if (!r.ok) throw new Error(d.error);
                const imported = d.results.filter((x: { imported: boolean }) => x.imported).length;
                toast.success(
                  `${imported} of ${d.results.length} sources refreshed. Unavailable sources retain prior entries or use clearly dated reviewed summaries.`,
                );
                await load();
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? 'Refreshing...' : 'Refresh public sources'}
          </button>
        </div>
      )}
      <section className="updates-panel panel" aria-label="Public housing updates">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">PUBLIC HOUSING UPDATES</div>
            <h2>What changed, and why it matters.</h2>
          </div>
          <span className="subtle">Curated official sources</span>
        </div>
        <p className="subtle">
          Publication dates describe the report. Refresh dates describe our last download. These
          updates do not replace company policy.
        </p>
        <div className="updates-grid">
          {articles
            .filter((a) => sourceMetadata(a))
            .sort((a, c) =>
              (sourceMetadata(c)?.published?.match(/^\d{4}-\d{2}-\d{2}$/)?.[0] || '').localeCompare(
                sourceMetadata(a)?.published?.match(/^\d{4}-\d{2}-\d{2}$/)?.[0] || '',
              ),
            )
            .map((a) => {
              const meta = sourceMetadata(a)!;
              return (
                <article className="update-card" key={a.id}>
                  <div className="row-between">
                    <span className="eyebrow">{meta.publisher}</span>
                    <span className="badge">
                      {meta.snapshot
                        ? 'Reviewed snapshot'
                        : meta.stale
                          ? 'Refresh recommended'
                          : 'Fetched source'}
                    </span>
                  </div>
                  <h3>{a.title}</h3>
                  <p>
                    {meta.content.slice(0, 240)}
                    {meta.content.length > 240 ? '...' : ''}
                  </p>
                  <small className="subtle">
                    Published: {meta.published || 'Unknown'} · Version {a.version}
                  </small>
                  <small className="subtle">
                    {meta.fetched
                      ? `Last fetched: ${new Date(meta.fetched).toLocaleString('en-IN')}`
                      : 'Live download unavailable; verify the original.'}
                  </small>
                  <div className="update-actions">
                    <button className="text-button" onClick={() => openSource(a)}>
                      Read evidence
                    </button>
                    <a href={meta.url} target="_blank" rel="noopener noreferrer">
                      Original source
                    </a>
                    <button
                      className="text-button"
                      disabled={!online || busy}
                      onClick={() =>
                        void ask(
                          `What does the source titled "${a.title}" report, and what should a field officer verify before acting?`,
                        )
                      }
                    >
                      Ask about this update
                    </button>
                  </div>
                </article>
              );
            })}
          {!articles.some((a) => sourceMetadata(a)) && (
            <p>No public updates yet. An administrator can refresh the curated sources above.</p>
          )}
        </div>
      </section>
      <div className="knowledge-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>
              <BookOpen size={18} />
              Workspace handbook
            </h2>
            <span className="subtle">{articles.length} entries</span>
          </div>
          <div className="search full">
            <Search size={16} />
            <input
              aria-label="Search handbook"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search guidance"
            />
          </div>
          {loadError && <div className="notice amber">{loadError}</div>}
          {articles
            .filter((a) => (a.title + ' ' + a.body).toLowerCase().includes(search.toLowerCase()))
            .map((a) => (
              <article key={a.id} className="article-card">
                <div className="row-between">
                  <span className="eyebrow">{a.category}</span>
                  {!!a.sample && <span className="badge">Sample guidance</span>}
                </div>
                <button className="article-title" onClick={() => openSource(a)}>
                  {a.title}
                  <ArrowUpRight size={16} />
                </button>
                <p>{a.body.slice(0, 155)}…</p>
                <div className="row-between">
                  <small className="subtle">Version {a.version}</small>
                  {b.user.role === 'admin' && (
                    <button className="text-button" onClick={() => openEdit(a)} disabled={!online}>
                      Edit entry
                    </button>
                  )}
                </div>
              </article>
            ))}
          {!articles.length && !loadError && (
            <Empty>
              <EmptyTitle>Your handbook starts here</EmptyTitle>
              <EmptyDescription>
                Add approved procedures, or load the fictional starter cases to include sample
                guidance.
              </EmptyDescription>
            </Empty>
          )}
        </section>
        <section className="panel assistant-panel" ref={assistantRef}>
          <div className="assistant-top">
            <span className="spark-icon">
              <Sparkles size={22} />
            </span>
            <div>
              <h2>Handbook assistant</h2>
              <small>
                {b.aiEnabled
                  ? 'Generated answers with source checks'
                  : 'Sourced search and case checklists'}
              </small>
            </div>
          </div>
          {selected && (
            <div className="case-context">
              <FileText size={14} />
              Asking about {selected.ref} · server-confirmed evidence
            </div>
          )}
          <p className="subtle">
            Questions use the workspace handbook. The assistant does not approve loans or certify
            documents.
          </p>
          <div className="suggestions">
            {(caseId
              ? ['What is missing from this case?', 'What should a reviewer check?']
              : [
                  'How do I prepare a complete field case?',
                  'How should I record consent?',
                  'How do I work with unreliable connectivity?',
                ]
            ).map((q) => (
              <button key={q} onClick={() => void ask(q)} disabled={!online || busy}>
                {q}
                <ArrowUpRight size={14} />
              </button>
            ))}
          </div>
          {answer && (
            <div className="answer" aria-live="polite">
              <div className="row-between">
                <span className="eyebrow">
                  {answer.mode === 'generated'
                    ? 'AI ANSWER'
                    : answer.mode === 'checklist'
                      ? 'CASE CHECKLIST'
                      : 'HANDBOOK RESULT'}
                </span>
                {answer.escalate && <span className="badge amber">Ask a reviewer</span>}
              </div>
              <p>{answer.answer}</p>
              {answer.items && (
                <ul className="answer-checklist">
                  {answer.items.map((i) => (
                    <li key={i.label}>
                      {i.complete ? '✓' : '○'} {i.label}
                    </li>
                  ))}
                </ul>
              )}
              {answer.sources.map((s, i) => (
                <button className="source-card" key={s.id + ':' + i} onClick={() => openSource(s)}>
                  <span>{i + 1}</span>
                  <div>
                    <strong>{s.title}</strong>
                    <small>{s.quote || s.body.slice(0, 200)}</small>
                  </div>
                  <ArrowUpRight size={14} />
                </button>
              ))}
              <small className="subtle">Check the original guidance before acting.</small>
            </div>
          )}
          <form
            className="ask-form"
            onSubmit={(e) => {
              e.preventDefault();
              void ask(question);
            }}
          >
            <label className="sr-only" htmlFor="question">
              Ask the handbook assistant
            </label>
            <textarea
              id="question"
              required
              minLength={3}
              maxLength={700}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a procedural question…"
              rows={3}
            />
            <div className="row-between">
              <small>
                {online
                  ? 'Handbook context only · no applicant details sent'
                  : 'Connect to ask the assistant'}
              </small>
              <button className="primary" disabled={!online || busy || question.trim().length < 3}>
                {busy ? (
                  'Checking sources…'
                ) : (
                  <>
                    <Send size={14} />
                    Ask
                  </>
                )}
              </button>
            </div>
          </form>
        </section>
      </div>
      <Dialog
        open={!!source}
        onOpenChange={(o) => {
          if (!o) setSource(undefined);
        }}
      >
        <DialogContent className="fp-dialog" onCloseAutoFocus={restoreFocus}>
          <DialogTitle>{source?.title}</DialogTitle>
          <DialogDescription>
            {source?.category} · version {source?.version}
            {source?.sample ? ' · Sample guidance' : ''}
          </DialogDescription>
          {source && sourceMetadata(source) && (
            <a
              className="source-link"
              href={sourceMetadata(source)!.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open original publisher
            </a>
          )}
          <p className="source-body">{source?.body}</p>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!edit}
        onOpenChange={(o) => {
          if (!o && !saving) setEdit(undefined);
        }}
      >
        <DialogContent className="fp-dialog" onCloseAutoFocus={restoreFocus}>
          <DialogTitle>{edit?.id ? 'Edit handbook entry' : 'Add handbook entry'}</DialogTitle>
          <DialogDescription>
            Use approved guidance and identify its provenance in the text. Changes are versioned.
          </DialogDescription>
          {edit && (
            <form
              className="form-grid"
              onSubmit={async (e) => {
                e.preventDefault();
                setSaving(true);
                try {
                  const r = await fetch('/api/knowledge', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(edit),
                  });
                  const d = (await r.json()) as Answer & Article[] & { error?: string };
                  if (!r.ok) throw new Error(d.error);
                  setEdit(undefined);
                  await load();
                  toast.success('Handbook entry saved.');
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setSaving(false);
                }
              }}
            >
              <Field label="Title">
                <input
                  required
                  minLength={3}
                  maxLength={160}
                  value={edit.title ?? ''}
                  onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                />
              </Field>
              <Field label="Category">
                <Picker
                  label="Category"
                  value={edit.category ?? 'Fieldwork'}
                  onChange={(v) => setEdit({ ...edit, category: v })}
                  options={['Fieldwork', 'Evidence', 'Review', 'Housing'].map((s) => ({
                    value: s,
                    label: s,
                  }))}
                />
              </Field>
              <Field label="Guidance and source">
                <textarea
                  required
                  minLength={30}
                  maxLength={16000}
                  rows={8}
                  value={edit.body ?? ''}
                  onChange={(e) => setEdit({ ...edit, body: e.target.value })}
                />
              </Field>
              <button className="primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save guidance'}
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
