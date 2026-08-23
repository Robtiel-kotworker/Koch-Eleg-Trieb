import { audioEngine } from './AudioEngine';
import type { LoadedSample, SamplePack } from './types';

const DB_NAME = 'electribe-clone-db';
const DB_VERSION = 1;
const PACKS_STORE = 'packs';
const SAMPLES_STORE = 'samples';

interface StoredSample {
  id: string;
  packId: string;
  packName: string;
  name: string;
  data: ArrayBuffer;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PACKS_STORE)) {
        db.createObjectStore(PACKS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(SAMPLES_STORE)) {
        const store = db.createObjectStore(SAMPLES_STORE, { keyPath: 'id' });
        store.createIndex('packId', 'packId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open sample database'));
  });
}

function tx<T>(db: IDBDatabase, store: string, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, mode);
    const request = run(transaction.objectStore(store));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error(`IndexedDB ${store} operation failed`));
  });
}

function getAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, 'readonly');
    const request = transaction.objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error ?? new Error(`Failed to read ${store}`));
  });
}

function randomId(): string {
  return crypto.randomUUID();
}

export async function listPacks(): Promise<SamplePack[]> {
  const db = await openDb();
  const packs = await getAll<SamplePack>(db, PACKS_STORE);
  return packs.sort((a, b) => a.createdAt - b.createdAt);
}

export async function createPack(name: string): Promise<SamplePack> {
  const db = await openDb();
  const pack: SamplePack = { id: randomId(), name, createdAt: Date.now() };
  await tx(db, PACKS_STORE, 'readwrite', (store) => store.put(pack));
  return pack;
}

export async function deletePack(packId: string): Promise<void> {
  const db = await openDb();
  const samples = await getAll<StoredSample>(db, SAMPLES_STORE);
  const toDelete = samples.filter((s) => s.packId === packId);
  await Promise.all(toDelete.map((s) => tx(db, SAMPLES_STORE, 'readwrite', (store) => store.delete(s.id))));
  await tx(db, PACKS_STORE, 'readwrite', (store) => store.delete(packId));
}

export async function deleteSample(sampleId: string): Promise<void> {
  const db = await openDb();
  await tx(db, SAMPLES_STORE, 'readwrite', (store) => store.delete(sampleId));
}

/** Decode + persist a set of user-picked audio files into the given pack. */
export async function addFilesToPack(packId: string, packName: string, files: File[]): Promise<LoadedSample[]> {
  const db = await openDb();
  const loaded: LoadedSample[] = [];
  for (const file of files) {
    const data = await file.arrayBuffer();
    let buffer: AudioBuffer;
    try {
      buffer = await audioEngine.decode(data.slice(0));
    } catch {
      continue;
    }
    const id = randomId();
    const name = file.name.replace(/\.[^/.]+$/, '');
    const stored: StoredSample = { id, packId, packName, name, data };
    await tx(db, SAMPLES_STORE, 'readwrite', (store) => store.put(stored));
    loaded.push({ id, name, packId, packName, builtIn: false, buffer });
  }
  return loaded;
}

/** Load and decode every previously imported sample. Runs once at startup. */
export async function loadAllUserSamples(): Promise<LoadedSample[]> {
  const db = await openDb();
  const stored = await getAll<StoredSample>(db, SAMPLES_STORE);
  const decoded = await Promise.all(
    stored.map(async (s): Promise<LoadedSample | null> => {
      try {
        const buffer = await audioEngine.decode(s.data.slice(0));
        return { id: s.id, name: s.name, packId: s.packId, packName: s.packName, builtIn: false, buffer };
      } catch {
        return null;
      }
    }),
  );
  return decoded.filter((s): s is LoadedSample => s !== null);
}
