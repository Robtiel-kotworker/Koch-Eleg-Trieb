import { useState } from 'react';
import { detectAutoSyncTarget } from '../audio/autoSync';
import { detectBpm } from '../audio/bpmDetect';
import { foldToPitchRange } from '../audio/pitchMath';
import type { LoadedSample } from '../audio/types';
import { useAppStore } from '../state/store';

interface TempoAssignProps {
  partId: number;
  sample: LoadedSample | undefined;
}

export function TempoAssign({ partId, sample }: TempoAssignProps) {
  const projectBpm = useAppStore((s) => s.bpm);
  const detectedBpm = useAppStore((s) => (sample ? s.detectedBpmBySampleId[sample.id] : undefined));
  const setDetectedBpm = useAppStore((s) => s.setDetectedBpm);
  const setPartPitch = useAppStore((s) => s.setPartPitch);
  const [analyzing, setAnalyzing] = useState(false);
  const [noResult, setNoResult] = useState(false);
  const [autoSyncLabel, setAutoSyncLabel] = useState<string | null>(null);

  // Reset transient result state when the assigned sample changes, following
  // React's documented "adjust state during render" pattern instead of an
  // effect (avoids an extra cascading render just to clear stale labels).
  const [lastSeenSampleId, setLastSeenSampleId] = useState(sample?.id);
  if (sample?.id !== lastSeenSampleId) {
    setLastSeenSampleId(sample?.id);
    setNoResult(false);
    setAutoSyncLabel(null);
  }

  const runDetect = async () => {
    if (!sample) return;
    setAnalyzing(true);
    setNoResult(false);
    try {
      const result = await detectBpm(sample.buffer);
      if (result) {
        setDetectedBpm(sample.id, result.bpm);
      } else {
        setNoResult(true);
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const assignToProjectBpm = () => {
    if (detectedBpm === undefined) return;
    const semitones = 12 * Math.log2(projectBpm / detectedBpm);
    setPartPitch(partId, foldToPitchRange(semitones));
  };

  const runAutoSync = () => {
    if (!sample) return;
    const result = detectAutoSyncTarget(sample.buffer, projectBpm);
    if (!result) {
      setAutoSyncLabel('kein Sync möglich');
      return;
    }
    setPartPitch(partId, foldToPitchRange(result.semitones));
    setAutoSyncLabel(`→ ${result.targetLabel}`);
  };

  let readout = '—';
  if (analyzing) readout = 'Analysiere…';
  else if (detectedBpm !== undefined) readout = `${detectedBpm} BPM`;
  else if (noResult) readout = 'kein Tempo erkannt';

  return (
    <div className="tempo-assign">
      <button type="button" className="ghost-button" onClick={() => void runDetect()} disabled={!sample || analyzing}>
        Tempo Autodetect
      </button>
      <span className="tempo-assign-readout">{readout}</span>
      <button
        type="button"
        className="ghost-button"
        onClick={assignToProjectBpm}
        disabled={detectedBpm === undefined}
        title={`Sample-Geschwindigkeit an Projekt-BPM (${projectBpm}) anpassen`}
      >
        Assign to Project BPM
      </button>
      <span className="tempo-assign-divider" aria-hidden="true" />
      <button
        type="button"
        className="ghost-button"
        onClick={runAutoSync}
        disabled={!sample}
        title="Passt die Sample-Länge selbst an eine Beat-Unterteilung an – funktioniert auch bei sehr kurzen Samples, bei denen Tempo Autodetect nicht zuverlässig greift."
      >
        Auto Sync
      </button>
      {autoSyncLabel && <span className="tempo-assign-readout">{autoSyncLabel}</span>}
    </div>
  );
}
