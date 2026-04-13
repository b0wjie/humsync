import type { LoopProject } from "@/types";

const DB_NAME = "humsync-v1";
const DB_VERSION = 1;
const STORE_NAME = "projects";
const CURRENT_PROJECT_KEY = "humsync-current-project";

export async function saveProject(project: LoopProject) {
  const db = await openDb();
  await tx(db, "readwrite", (store) => store.put(project));
  localStorage.setItem(CURRENT_PROJECT_KEY, project.id);
}

export async function loadCurrentProject(): Promise<LoopProject | null> {
  const id = localStorage.getItem(CURRENT_PROJECT_KEY);
  if (!id) return null;

  const db = await openDb();
  return tx<LoopProject | null>(db, "readonly", (store) => store.get(id));
}

export async function clearCurrentProject() {
  const id = localStorage.getItem(CURRENT_PROJECT_KEY);
  if (!id) return;

  const db = await openDb();
  await tx(db, "readwrite", (store) => store.delete(id));
  localStorage.removeItem(CURRENT_PROJECT_KEY);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx<T = void>(db: IDBDatabase, mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => reject(transaction.error);
  });
}
