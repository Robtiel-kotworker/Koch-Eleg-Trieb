import { useEffect, useMemo, useState } from 'react';
import { audioEngine } from '../audio/AudioEngine';
import {
  cloudFileName,
  cloudFileUrl,
  cloudFolderOf,
  cloudPackId,
  cloudSampleId,
  loadCloudManifest,
} from '../audio/cloudLibrary';
import type { CloudFileEntry } from '../audio/cloudLibrary';
import { cacheRemoteSample } from '../audio/sampleStore';
import type { LoadedSample } from '../audio/types';
import { useAppStore } from '../state/store';

const FOLDER_FILE_LIMIT = 300;
const SEARCH_RESULT_LIMIT = 200;
const MIN_SEARCH_LENGTH = 2;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FolderStat {
  folder: string;
  count: number;
  totalSize: number;
}

export function CloudLibraryPanel() {
  const samples = useAppStore((s) => s.samples);
  const selectedPartId = useAppStore((s) => s.selectedPartId);
  const pattern = useAppStore((s) => s.patterns.find((p) => p.id === s.currentPatternId));
  const setPartSample = useAppStore((s) => s.setPartSample);
  const addLoadedSamples = useAppStore((s) => s.addLoadedSamples);
  const addPack = useAppStore((s) => s.addPack);
  const part = pattern?.parts.find((p) => p.id === selectedPartId);

  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [files, setFiles] = useState<CloudFileEntry[]>([]);
  const [folder, setFolder] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCloudManifest()
      .then((entries) => {
        if (cancelled) return;
        setFiles(entries);
        setStatus('loaded');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cachedIds = useMemo(() => new Set(samples.filter((s) => s.id.startsWith('cloud:')).map((s) => s.id)), [samples]);

  const folderStats = useMemo<FolderStat[]>(() => {
    const map = new Map<string, FolderStat>();
    for (const f of files) {
      const key = cloudFolderOf(f.key);
      const stat = map.get(key) ?? { folder: key, count: 0, totalSize: 0 };
      stat.count += 1;
      stat.totalSize += f.size;
      map.set(key, stat);
    }
    return Array.from(map.values()).sort((a, b) => a.folder.localeCompare(b.folder));
  }, [files]);

  const searchActive = search.trim().length >= MIN_SEARCH_LENGTH;
  const searchResults = useMemo<CloudFileEntry[]>(() => {
    if (!searchActive) return [];
    const needle = search.trim().toLowerCase();
    const results: CloudFileEntry[] = [];
    for (const f of files) {
      if (f.key.toLowerCase().includes(needle)) {
        results.push(f);
        if (results.length >= SEARCH_RESULT_LIMIT) break;
      }
    }
    return results;
  }, [files, search, searchActive]);

  const folderFiles = useMemo<CloudFileEntry[]>(() => {
    if (!folder) return [];
    return files.filter((f) => cloudFolderOf(f.key) === folder);
  }, [files, folder]);

  const previewLoaded = (sample: LoadedSample) => {
    void audioEngine.resume();
    audioEngine.playVoice(sample.buffer, {
      time: audioEngine.context.currentTime,
      velocity: 1,
      level: 1,
      pan: 0,
      pitchSemitones: 0,
      filterCutoff: 20000,
      filterResonance: 0.7,
      attack: 0.002,
      release: 0.4,
    });
  };

  const selectEntry = async (entry: CloudFileEntry) => {
    const sampleId = cloudSampleId(entry.key);
    const existing = samples.find((s) => s.id === sampleId);
    if (existing) {
      previewLoaded(existing);
      if (part) setPartSample(part.id, existing.id);
      return;
    }

    setDownloadError(null);
    setDownloadingKey(entry.key);
    try {
      const res = await fetch(cloudFileUrl(entry.key));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.arrayBuffer();
      const folderName = cloudFolderOf(entry.key);
      const packId = cloudPackId(folderName);
      const { pack, sample: loaded } = await cacheRemoteSample(sampleId, packId, `Cloud: ${folderName}`, cloudFileName(entry.key), data);
      addPack(pack);
      addLoadedSamples([loaded]);
      previewLoaded(loaded);
      if (part) setPartSample(part.id, loaded.id);
    } catch {
      setDownloadError(`Download fehlgeschlagen: ${cloudFileName(entry.key)}`);
    } finally {
      setDownloadingKey(null);
    }
  };

  const renderFileRow = (entry: CloudFileEntry, showFolder: boolean) => {
    const sampleId = cloudSampleId(entry.key);
    const cached = cachedIds.has(sampleId);
    const isDownloading = downloadingKey === entry.key;
    const isAssigned = part?.sampleId === sampleId;
    return (
      <li key={entry.key} className={isAssigned ? 'assigned' : ''}>
        <button type="button" className="sample-row" onClick={() => void selectEntry(entry)} disabled={isDownloading}>
          <span>
            {cloudFileName(entry.key)}
            {showFolder && <span className="cloud-file-folder"> · {cloudFolderOf(entry.key)}</span>}
          </span>
          <span className="sample-duration">
            {isDownloading ? 'Lädt…' : cached ? '✓ ' + formatBytes(entry.size) : formatBytes(entry.size)}
          </span>
        </button>
      </li>
    );
  };

  if (status === 'loading') {
    return <p className="pack-empty-hint">Lade Cloud-Bibliothek…</p>;
  }
  if (status === 'error') {
    return <p className="sample-browser-error">Cloud-Bibliothek konnte nicht geladen werden.</p>;
  }

  const totalSize = folderStats.reduce((sum, s) => sum + s.totalSize, 0);

  return (
    <div className="cloud-library">
      <p className="cloud-library-info">
        {files.length.toLocaleString('de-DE')} Samples in {folderStats.length} Ordnern ({formatBytes(totalSize)}) · wird bei
        Bedarf geladen und danach offline gecacht.
      </p>

      <input
        type="text"
        className="cloud-search-input"
        placeholder="Samples durchsuchen…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {downloadError && <p className="sample-browser-error">{downloadError}</p>}

      {searchActive ? (
        <>
          <p className="pack-empty-hint">{searchResults.length} Treffer{searchResults.length >= SEARCH_RESULT_LIMIT ? ' (gekürzt)' : ''}</p>
          <ul className="sample-list">{searchResults.map((f) => renderFileRow(f, true))}</ul>
        </>
      ) : folder ? (
        <>
          <div className="cloud-folder-breadcrumb">
            <button type="button" className="ghost-button" onClick={() => setFolder(null)}>
              ← Ordner
            </button>
            <span className="pack-group-name">{folder}</span>
          </div>
          <ul className="sample-list">{folderFiles.slice(0, FOLDER_FILE_LIMIT).map((f) => renderFileRow(f, false))}</ul>
          {folderFiles.length > FOLDER_FILE_LIMIT && (
            <p className="pack-empty-hint">
              + {folderFiles.length - FOLDER_FILE_LIMIT} weitere – benutze die Suche, um gezielt zu finden.
            </p>
          )}
        </>
      ) : (
        <div className="cloud-folder-grid">
          {folderStats.map((stat) => (
            <button key={stat.folder} type="button" className="cloud-folder-button" onClick={() => setFolder(stat.folder)}>
              <span className="cloud-folder-name">{stat.folder}</span>
              <span className="cloud-folder-meta">
                {stat.count} · {formatBytes(stat.totalSize)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
