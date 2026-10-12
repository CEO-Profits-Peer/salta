const DB = 'aes', STORE = 'experiments';
function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore(STORE, { keyPath: 'id' }); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((res, rej) => { const q = fn(db.transaction(STORE, mode).objectStore(STORE)); q.onsuccess = () => { res(q.result); db.close(); }; q.onerror = () => { rej(q.error); db.close(); }; });
}
export const idbPut = (v: { id: string }) => tx('readwrite', (s) => s.put(v)).catch(() => undefined);
export const idbDelete = (id: string) => tx('readwrite', (s) => s.delete(id)).catch(() => undefined);
export const idbAll = <T,>() => tx<T[]>('readonly', (s) => s.getAll() as IDBRequest<T[]>).catch(() => [] as T[]);
export const idbClear = () => tx('readwrite', (s) => s.clear()).catch(() => undefined);
