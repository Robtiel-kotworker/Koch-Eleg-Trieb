export interface CloudFileEntry {
  key: string;
  size: number;
}

interface RawManifest {
  baseUrl: string;
  generatedAt: string;
  files: [string, number][];
}

const FALLBACK_BASE_URL = 'https://pub-0d94543090fa4adca1cd861ae2e74df1.r2.dev';

let baseUrl = FALLBACK_BASE_URL;
let manifestPromise: Promise<CloudFileEntry[]> | null = null;

/**
 * Fetches the bundled catalog of the full remote sample library once and
 * caches the promise. The catalog itself (names/sizes) ships with the app
 * and is therefore always browsable offline; only the audio bytes for an
 * individual sample require a network round-trip, the first time it's used.
 */
export function loadCloudManifest(): Promise<CloudFileEntry[]> {
  if (!manifestPromise) {
    manifestPromise = fetch('/cloud-samples/manifest.json')
      .then((res) => {
        if (!res.ok) throw new Error(`Manifest HTTP ${res.status}`);
        return res.json() as Promise<RawManifest>;
      })
      .then((raw) => {
        baseUrl = raw.baseUrl || FALLBACK_BASE_URL;
        return raw.files.map(([key, size]) => ({ key, size }));
      })
      .catch((err: unknown) => {
        manifestPromise = null;
        throw err;
      });
  }
  return manifestPromise;
}

export function cloudFileUrl(key: string): string {
  const encodedPath = key.split('/').map(encodeURIComponent).join('/');
  return `${baseUrl}/${encodedPath}`;
}

export function cloudFolderOf(key: string): string {
  const slash = key.indexOf('/');
  return slash === -1 ? '(root)' : key.slice(0, slash);
}

export function cloudFileName(key: string): string {
  const slash = key.lastIndexOf('/');
  const base = slash === -1 ? key : key.slice(slash + 1);
  return base.replace(/\.[^/.]+$/, '');
}

export function cloudPackId(folder: string): string {
  return `cloud:${folder}`;
}

export function cloudSampleId(key: string): string {
  return `cloud:${key}`;
}
