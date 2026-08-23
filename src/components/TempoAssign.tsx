import { useState } from 'react';
import { detectBpm } from '../audio/bpmDetect';
import type { LoadedSample } from '../audio/types';
import { useAppStore } from '../state/store';

interface TempoAssignProps {
  partId: number;
  sample: LoadedSample | undefined;
}

/** Folds a semitone offset into the Pitch knob's -24..24 range by whole octaves. */
function foldToPitchRange(semitones: number): number {
  let result = semitones;
  while (result > 24) result -= 12;
  while (result < -24) result += 12;
  return Math.round(result * 10) / 10;
}

export function TempoAssign({ partId, sample }: TempoAssignProps) {
  const projectBpm = useAppStore((s) => s.bpm);
  const detectedBpm = useAppStore((s) => (sample ? s.detectedBpmBySampleId[sample.id] : undefined));
  const setDetectedBpm = useAppStore((s) => s.setDetectedBpm);
  const setPartPitch = useAppStore((s) => s.setPartPitch);
  const [analyzing, setAnalyzing] = useState(false);
  const [noResult, setNoResult] = useState(false);

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
    </div>
  );
}
