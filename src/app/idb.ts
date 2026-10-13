const DB = 'aes', STORES = ['experiments', 'world'] as const;
type Store = (typeof STORES)[number];
function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 2);
    r.onupgradeneeded = () => { for (const s of STORES) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s, { keyPath: 'id' }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function tx<T>(store: Store, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((res, rej) => { const q = fn(db.transaction(store, mode).objectStore(store)); q.onsuccess = () => { res(q.result); db.close(); }; q.onerror = () => { rej(q.error); db.close(); }; });
}
export const idbPut = (v: { id: string }, store: Store = 'experiments') => tx(store, 'readwrite', (s) => s.put(v)).catch(() => undefined);
export const idbDelete = (id: string, store: Store = 'experiments') => tx(store, 'readwrite', (s) => s.delete(id)).catch(() => undefined);
export const idbAll = <T,>(store: Store = 'experiments') => tx<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>).catch(() => [] as T[]);
export const idbClear = (store: Store = 'experiments') => tx(store, 'readwrite', (s) => s.clear()).catch(() => undefined);
