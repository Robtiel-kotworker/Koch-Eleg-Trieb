import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { audioEngine } from '../audio/AudioEngine';
import { addFilesToPack, createPack, deletePack, deleteSample } from '../audio/sampleStore';
import type { LoadedSample } from '../audio/types';
import { useAppStore } from '../state/store';
import { CloudLibraryPanel } from './CloudLibraryPanel';

interface SampleBrowserProps {
  onClose: () => void;
}

type BrowserTab = 'packs' | 'cloud';

export function SampleBrowser({ onClose }: SampleBrowserProps) {
  const [tab, setTab] = useState<BrowserTab>('packs');
  const samples = useAppStore((s) => s.samples);
  const packs = useAppStore((s) => s.packs);
  const selectedPartId = useAppStore((s) => s.selectedPartId);
  const pattern = useAppStore((s) => s.patterns.find((p) => p.id === s.currentPatternId));
  const setPartSample = useAppStore((s) => s.setPartSample);
  const addLoadedSamples = useAppStore((s) => s.addLoadedSamples);
  const addPack = useAppStore((s) => s.addPack);
  const removePackFromState = useAppStore((s) => s.removePackFromState);
  const removeSampleFromState = useAppStore((s) => s.removeSampleFromState);

  const [newPackName, setNewPackName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const newPackFileInput = useRef<HTMLInputElement>(null);
  const pendingPackId = useRef<string | null>(null);
  const pendingPackName = useRef<string>('');

  const part = pattern?.parts.find((p) => p.id === selectedPartId);

  const previewSample = (sample: LoadedSample) => {
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

  const assignSample = (sample: LoadedSample) => {
    if (!part) return;
    previewSample(sample);
    setPartSample(part.id, sample.id);
  };

  const importFiles = async (packId: string, packName: string, candidates: File[]) => {
    setBusy(true);
    setError(null);
    try {
      const files = candidates.filter((f) => f.type.startsWith('audio/') || /\.(wav|mp3|ogg|flac|m4a|aiff?)$/i.test(f.name));
      if (files.length === 0) {
        setError('Keine unterstützten Audiodateien gefunden.');
        return;
      }
      const loaded = await addFilesToPack(packId, packName, files);
      if (loaded.length === 0) {
        setError('Dateien konnten nicht dekodiert werden.');
        return;
      }
      addLoadedSamples(loaded);
    } catch {
      setError('Import fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  const handleNewPackFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (files.length === 0 || !pendingPackId.current) return;
    await importFiles(pendingPackId.current, pendingPackName.current, files);
    pendingPackId.current = null;
  };

  const handleCreatePack = async () => {
    const name = newPackName.trim() || `Sample Pack ${packs.length + 1}`;
    setBusy(true);
    setError(null);
    try {
      const pack = await createPack(name);
      addPack(pack);
      pendingPackId.current = pack.id;
      pendingPackName.current = pack.name;
      setNewPackName('');
      newPackFileInput.current?.click();
    } catch {
      setError('Pack konnte nicht erstellt werden.');
      setBusy(false);
    }
  };

  const handleAddToPack = (packId: string, packName: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'audio/*';
    input.onchange = () => {
      const files = input.files ? Array.from(input.files) : [];
      if (files.length > 0) void importFiles(packId, packName, files);
    };
    input.click();
  };

  const handleDeletePack = async (packId: string) => {
    setBusy(true);
    try {
      await deletePack(packId);
      removePackFromState(packId);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSample = async (sampleId: string) => {
    setBusy(true);
    try {
      await deleteSample(sampleId);
      removeSampleFromState(sampleId);
    } finally {
      setBusy(false);
    }
  };

  const packGroups = [
    { id: 'init-kit', name: 'Init Kit (built-in)', builtIn: true },
    ...packs.map((p) => ({ id: p.id, name: p.name, builtIn: false })),
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal sample-browser" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Sample Browser</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Schließen">
            ×
          </button>
        </div>

        <p className="sample-browser-target">
          {part ? (
            <>
              Zuweisen an: <strong>Part {part.id + 1} · {part.name}</strong>
            </>
          ) : (
            'Kein Part ausgewählt'
          )}
        </p>

        <div className="browser-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'packs'} className={tab === 'packs' ? 'active' : ''} onClick={() => setTab('packs')}>
            Packs
          </button>
          <button type="button" role="tab" aria-selected={tab === 'cloud'} className={tab === 'cloud' ? 'active' : ''} onClick={() => setTab('cloud')}>
            Cloud-Bibliothek
          </button>
        </div>

        {tab === 'packs' ? (
          <>
            {error && <p className="sample-browser-error">{error}</p>}

            <div className="new-pack-row">
              <input
                type="text"
                placeholder="Neues Pack benennen…"
                value={newPackName}
                onChange={(e) => setNewPackName(e.target.value)}
                maxLength={40}
              />
              <button type="button" onClick={() => void handleCreatePack()} disabled={busy}>
                + Lokales Sample Pack hinzufügen
              </button>
              <input
                ref={newPackFileInput}
                type="file"
                multiple
                accept="audio/*"
                className="visually-hidden"
                onChange={(e) => void handleNewPackFiles(e)}
              />
            </div>

            <div className="pack-list">
              {packGroups.map((group) => {
                const groupSamples = samples.filter((s) => s.packId === group.id);
                return (
                  <div key={group.id} className="pack-group">
                    <div className="pack-group-header">
                      <span className="pack-group-name">{group.name}</span>
                      {!group.builtIn && (
                        <span className="pack-group-actions">
                          <button type="button" className="ghost-button" onClick={() => handleAddToPack(group.id, group.name)}>
                            + Dateien
                          </button>
                          <button type="button" className="ghost-button danger" onClick={() => void handleDeletePack(group.id)}>
                            Pack löschen
                          </button>
                        </span>
                      )}
                    </div>
                    {groupSamples.length === 0 ? (
                      <p className="pack-empty-hint">Keine Samples.</p>
                    ) : (
                      <ul className="sample-list">
                        {groupSamples.map((sample) => (
                          <li key={sample.id} className={part?.sampleId === sample.id ? 'assigned' : ''}>
                            <button type="button" className="sample-row" onClick={() => assignSample(sample)}>
                              <span>{sample.name}</span>
                              <span className="sample-duration">{sample.buffer.duration.toFixed(2)}s</span>
                            </button>
                            {!sample.builtIn && (
                              <button
                                type="button"
                                className="icon-button small"
                                onClick={() => void handleDeleteSample(sample.id)}
                                aria-label={`${sample.name} löschen`}
                              >
                                ×
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <CloudLibraryPanel />
        )}
      </div>
    </div>
  );
}
