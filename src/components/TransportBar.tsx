import { useAppStore } from '../state/store';
import { Knob } from './Knob';

interface TransportBarProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onOpenSampleBrowser: () => void;
}

export function TransportBar({ isPlaying, onTogglePlay, onOpenSampleBrowser }: TransportBarProps) {
  const bpm = useAppStore((s) => s.bpm);
  const swing = useAppStore((s) => s.swing);
  const masterVolume = useAppStore((s) => s.masterVolume);
  const setBpm = useAppStore((s) => s.setBpm);
  const setSwing = useAppStore((s) => s.setSwing);
  const setMasterVolume = useAppStore((s) => s.setMasterVolume);

  return (
    <div className="transport-bar">
      <div className="brand">
        <span className="brand-mark">ELECTRIBE</span>
        <span className="brand-sub">// CLONE</span>
      </div>

      <button type="button" className={`play-button ${isPlaying ? 'playing' : ''}`} onClick={onTogglePlay}>
        {isPlaying ? '■ STOP' : '▶ PLAY'}
      </button>

      <Knob label="Tempo" value={bpm} min={40} max={300} step={1} onChange={setBpm} formatValue={(v) => `${Math.round(v)}`} />
      <Knob label="Swing" value={swing} min={0} max={0.75} onChange={setSwing} formatValue={(v) => `${Math.round(v * 100)}%`} />
      <Knob label="Volume" value={masterVolume} min={0} max={1} onChange={setMasterVolume} formatValue={(v) => `${Math.round(v * 100)}`} />

      <button type="button" className="sample-browser-open" onClick={onOpenSampleBrowser}>
        Samples
      </button>
    </div>
  );
}
