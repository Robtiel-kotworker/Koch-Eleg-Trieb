import { useState } from 'react';
import { audioEngine } from './AudioEngine';
import { encodeMp3 } from './mp3Encode';
import { MasterRecorder } from './recorder';
import { trimSilence } from './silence';

export type RecorderStatus = 'idle' | 'recording' | 'processing';

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function timestampForFilename(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/** Records the master bus, trims silence, encodes to MP3 and downloads it on stop. */
export function useRecorder() {
  const [recorder] = useState(() => new MasterRecorder());
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const startRecording = async () => {
    await audioEngine.resume();
    await recorder.start();
    setMessage(null);
    setStatus('recording');
  };

  const stopRecording = async () => {
    const raw = recorder.stop();
    setStatus('processing');
    if (!raw) {
      setStatus('idle');
      setMessage('Keine Aufnahme');
      return;
    }
    // Yield a frame so the "processing" state paints before the (synchronous,
    // but potentially CPU-heavy for longer takes) trim + encode work runs.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const trimmed = trimSilence(raw);
    const blob = encodeMp3(trimmed);
    downloadBlob(blob, `eleg-trieb-recording-${timestampForFilename()}.mp3`);
    setStatus('idle');
    setMessage('Aufnahme gespeichert');
  };

  const toggleRecording = () => {
    if (status === 'recording') {
      void stopRecording();
    } else if (status === 'idle') {
      void startRecording();
    }
  };

  return { status, message, toggleRecording };
}
