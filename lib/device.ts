import type { Bootstrap, QueuedOperation } from './domain';
const DB = 'fieldproof-device-v1';
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('state');
      r.result.createObjectStore('queue', { keyPath: 'id' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () =>
      reject(
        new Error(
          'Device storage is unavailable. Enable browser storage before recording offline work.',
        ),
      );
  });
}
async function transaction<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode),
      r = fn(tx.objectStore(store));
    let result: T;
    r.onsuccess = () => {
      result = r.result;
    };
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Device storage is full. Work has not been saved.'));
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error ?? new Error('Device save was interrupted.'));
    };
  });
}
export const scopeOf = (b: Bootstrap) => b.user.workspaceId + ':' + b.user.userId;
export async function saveSnapshot(b: Bootstrap) {
  await transaction('state', 'readwrite', (s) => s.put(b, 'snapshot:' + scopeOf(b)));
  await transaction('state', 'readwrite', (s) => s.put(scopeOf(b), 'active'));
}
export async function cachedSnapshot() {
  const scope = await transaction<string | undefined>('state', 'readonly', (s) => s.get('active'));
  return scope
    ? await transaction<Bootstrap | undefined>('state', 'readonly', (s) =>
        s.get('snapshot:' + scope),
      )
    : undefined;
}
export async function forgetActive() {
  await transaction('state', 'readwrite', (s) => s.delete('active'));
}
export async function queueFor(scope: string) {
  const all = await transaction<QueuedOperation[]>('queue', 'readonly', (s) => s.getAll());
  return all
    .filter((o) => o.scope === scope)
    .sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) ||
        a.baseVersion - b.baseVersion ||
        a.id.localeCompare(b.id),
    );
}
export async function saveOperation(op: QueuedOperation) {
  await transaction('queue', 'readwrite', (s) => s.put(op));
}
export async function removeOperation(id: string) {
  await transaction('queue', 'readwrite', (s) => s.delete(id));
}
export async function getDraft<T>(scope: string, key: string) {
  return transaction<T | undefined>('state', 'readonly', (s) =>
    s.get('draft:' + scope + ':' + key),
  );
}
export async function saveDraft(scope: string, key: string, value: unknown) {
  await transaction('state', 'readwrite', (s) => s.put(value, 'draft:' + scope + ':' + key));
}
export async function deleteDraft(scope: string, key: string) {
  await transaction('state', 'readwrite', (s) => s.delete('draft:' + scope + ':' + key));
}
export async function clearDevice() {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(['state', 'queue'], 'readwrite');
    t.objectStore('state').clear();
    t.objectStore('queue').clear();
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
  db.close();
}
export async function flushQueue(
  scope: string,
  onChange: () => Promise<void>,
  isConnected: () => boolean,
) {
  const run = async () => {
    const queue = await queueFor(scope);
    const blocked = new Set<string>();
    for (const op of queue) {
      if (!isConnected()) break;
      if (op.state !== 'pending' || blocked.has(op.caseId)) {
        blocked.add(op.caseId);
        continue;
      }
      try {
        let body: BodyInit,
          headers: Record<string, string> = {};
        let url = '/api/operations';
        const envelope = {
          id: op.id,
          caseId: op.caseId,
          baseVersion: op.baseVersion,
          type: op.type,
          payload: op.payload,
        };
        if (op.type === 'upload') {
          const f = new FormData();
          f.set('operation', JSON.stringify(envelope));
          f.set('file', op.blob!, op.file!.name);
          f.set('kind', op.file!.kind);
          body = f;
          url = '/api/files';
        } else {
          body = JSON.stringify(envelope);
          headers = { 'Content-Type': 'application/json' };
        }
        const r = await fetch(url, {
          method: 'POST',
          headers,
          body,
          signal: AbortSignal.timeout(30000),
        });
        const data = (await r.json()) as { error?: string; server?: QueuedOperation['server'] };
        if (r.ok) {
          await removeOperation(op.id);
          await onChange();
          continue;
        }
        if (r.status === 401) break;
        if (r.status >= 500 || r.status === 429) {
          await saveOperation({ ...op, attempts: op.attempts + 1, error: data.error });
          break;
        }
        await saveOperation({
          ...op,
          state: r.status === 409 ? 'conflict' : 'failed',
          attempts: op.attempts + 1,
          error: data.error,
          server: data.server,
        });
        blocked.add(op.caseId);
        await onChange();
      } catch {
        await saveOperation({
          ...op,
          attempts: op.attempts + 1,
          error: 'Connection interrupted. This operation will retry with the same identifier.',
        });
        break;
      }
    }
    await onChange();
  };
  if (navigator.locks)
    await navigator.locks.request(
      'fieldproof-sync:' + scope,
      { ifAvailable: true },
      async (lock) => {
        if (lock) await run();
      },
    );
  else await run();
}
