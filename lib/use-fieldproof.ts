'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type Bootstrap, type QueuedOperation, type Operation, optimisticCases } from './domain';
import {
  cachedSnapshot,
  saveSnapshot,
  scopeOf,
  queueFor,
  saveOperation,
  flushQueue,
  forgetActive,
  removeOperation,
} from './device';
export function useFieldProof() {
  const [snapshot, setSnapshot] = useState<Bootstrap>();
  const [queue, setQueue] = useState<QueuedOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [online, setOnline] = useState(true);
  const [paused, setPaused] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [lastSync, setLastSync] = useState('');
  const current = useRef<Bootstrap | undefined>(undefined),
    connected = useRef(true),
    verified = useRef(false),
    busy = useRef(false),
    pauseRef = useRef(false);
  const refresh = useCallback(async () => {
    if (!connected.current || pauseRef.current) return;
    try {
      const r = await fetch('/api/bootstrap', {
        cache: 'no-store',
        signal: AbortSignal.timeout(12000),
      });
      const data = (await r.json()) as Bootstrap & { error?: string };
      if (r.status === 401) {
        verified.current = false;
        current.current = undefined;
        setSnapshot(undefined);
        setQueue([]);
        setSignedOut(true);
        await forgetActive();
        return;
      }
      if (!r.ok) throw new Error(data.error);
      verified.current = true;
      current.current = data;
      setSnapshot(data);
      setSignedOut(false);
      setQueue(await queueFor(scopeOf(data)));
      await saveSnapshot(data);
      setError('');
      setLastSync(new Date().toISOString());
    } catch (e) {
      verified.current = false;
      setError(
        (e as Error).message || 'Unable to connect. Your saved device work remains available.',
      );
    }
  }, []);
  const sync = useCallback(async () => {
    if (busy.current || !connected.current || pauseRef.current) return;
    busy.current = true;
    setSyncing(true);
    try {
      await refresh();
      const b = current.current;
      if (!b || !verified.current) return;
      await flushQueue(
        scopeOf(b),
        async () => {
          setQueue(await queueFor(scopeOf(b)));
        },
        () => connected.current && !pauseRef.current && verified.current,
      );
      await refresh();
    } finally {
      busy.current = false;
      setSyncing(false);
    }
  }, [refresh]);
  useEffect(() => {
    let live = true;
    const init = async () => {
      try {
        const b = await cachedSnapshot();
        if (live && b) {
          current.current = b;
          setSnapshot(b);
          setQueue(await queueFor(scopeOf(b)));
        }
        connected.current = navigator.onLine;
        setOnline(navigator.onLine);
        pauseRef.current = localStorage.getItem('fieldproof-sync-paused') === 'true';
        setPaused(pauseRef.current);
        await sync();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        if (live) setLoading(false);
      }
    };
    void init();
    const on = () => {
        connected.current = true;
        setOnline(true);
        void sync();
      },
      off = () => {
        connected.current = false;
        verified.current = false;
        setOnline(false);
      };
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    const timer = setInterval(() => void sync(), 20000);
    if ('serviceWorker' in navigator)
      void navigator.serviceWorker.register('/sw.js').catch(() => {});
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [sync]);
  const enqueue = async (
    type: Operation['type'],
    caseId: string,
    payload: unknown,
    file?: {
      blob: Blob;
      name: string;
      mime: string;
      kind: NonNullable<QueuedOperation['file']>['kind'];
    },
  ) => {
    const b = current.current;
    if (!b) throw new Error('Sign in before recording fieldwork.');
    const pending = await queueFor(scopeOf(b));
    const base = b.cases.find((c) => c.id === caseId)?.version ?? 0;
    const op: QueuedOperation = {
      id: crypto.randomUUID(),
      caseId,
      type,
      payload,
      baseVersion: base + pending.filter((o) => o.caseId === caseId).length,
      scope: scopeOf(b),
      state: 'pending',
      attempts: 0,
      createdAt: new Date().toISOString(),
    };
    if (file) {
      op.blob = file.blob;
      op.file = { name: file.name, mime: file.mime, size: file.blob.size, kind: file.kind };
    }
    await saveOperation(op);
    setQueue(await queueFor(scopeOf(b)));
    void sync();
    return op;
  };
  const togglePause = () => {
    pauseRef.current = !pauseRef.current;
    setPaused(pauseRef.current);
    localStorage.setItem('fieldproof-sync-paused', String(pauseRef.current));
    if (!pauseRef.current) void sync();
  };
  const retry = async (op: QueuedOperation) => {
    const b = current.current;
    if (!b) return;
    await refresh();
    const latest = current.current!;
    const server = latest.cases.find((c) => c.id === op.caseId);
    const ops = (await queueFor(op.scope)).filter((o) => o.caseId === op.caseId);
    let version = server?.version ?? 0;
    for (const item of ops) {
      await saveOperation({
        ...item,
        baseVersion: version++,
        state: 'pending',
        error: undefined,
        server: undefined,
      });
    }
    setQueue(await queueFor(op.scope));
    void sync();
  };
  const discard = async (op: QueuedOperation) => {
    const b = current.current;
    if (!b) return;
    const ops = await queueFor(op.scope);
    const ordered = ops.filter((o) => o.caseId === op.caseId);
    const index = ordered.findIndex((o) => o.id === op.id);
    for (const item of ordered.slice(index)) await removeOperation(item.id);
    setQueue(await queueFor(op.scope));
  };
  return {
    snapshot,
    queue,
    loading,
    signedOut,
    online,
    paused,
    syncing,
    error,
    lastSync,
    refresh,
    sync,
    enqueue,
    togglePause,
    retry,
    discard,
    cases: snapshot ? optimisticCases(snapshot.cases, queue, snapshot.user) : [],
  };
}
