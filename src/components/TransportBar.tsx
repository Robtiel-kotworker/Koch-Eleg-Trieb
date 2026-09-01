import type { RecorderStatus } from '../audio/useRecorder';
import { useAppStore } from '../state/store';
import { Knob } from './Knob';

interface TransportBarProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onOpenSampleBrowser: () => void;
  recorderStatus: RecorderStatus;
  recorderMessage: string | null;
  onToggleRecording: () => void;
}

export function TransportBar({
  isPlaying,
  onTogglePlay,
  onOpenSampleBrowser,
  recorderStatus,
  recorderMessage,
  onToggleRecording,
}: TransportBarProps) {
  const bpm = useAppStore((s) => s.bpm);
  const swing = useAppStore((s) => s.swing);
  const masterVolume = useAppStore((s) => s.masterVolume);
  const setBpm = useAppStore((s) => s.setBpm);
  const setSwing = useAppStore((s) => s.setSwing);
  const setMasterVolume = useAppStore((s) => s.setMasterVolume);

  return (
    <div className="transport-bar">
      <div className="brand">
        <span className="brand-mark">ELEG-TRIEB</span>
        <span className="brand-sub">// CLONE</span>
      </div>

      <div className="transport-controls">
        <button type="button" className={`play-button ${isPlaying ? 'playing' : ''}`} onClick={onTogglePlay}>
          {isPlaying ? '■ STOP' : '▶ PLAY'}
        </button>
        <button
          type="button"
          className={`rec-button ${recorderStatus === 'recording' ? 'active' : ''}`}
          onClick={onToggleRecording}
          disabled={recorderStatus === 'processing'}
          title="Nimmt alles auf, was über den Master-Bus zu hören ist"
        >
          {recorderStatus === 'processing' ? '…' : '● REC'}
        </button>
        {(recorderStatus !== 'idle' || recorderMessage) && (
          <span className="rec-status">
            {recorderStatus === 'recording' ? 'Nimmt auf…' : recorderStatus === 'processing' ? 'Verarbeite…' : recorderMessage}
          </span>
        )}
      </div>

      <Knob label="Tempo" value={bpm} min={40} max={300} step={1} defaultValue={120} onChange={setBpm} formatValue={(v) => `${Math.round(v)}`} />
      <Knob label="Swing" value={swing} min={0} max={0.75} defaultValue={0} onChange={setSwing} formatValue={(v) => `${Math.round(v * 100)}%`} />
      <Knob label="Volume" value={masterVolume} min={0} max={1} defaultValue={0.85} onChange={setMasterVolume} formatValue={(v) => `${Math.round(v * 100)}`} />

      <button type="button" className="sample-browser-open" onClick={onOpenSampleBrowser}>
        Samples
      </button>
    </div>
  );
}
