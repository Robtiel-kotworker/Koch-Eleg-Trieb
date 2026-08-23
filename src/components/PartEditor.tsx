import { useAppStore } from '../state/store';
import { Knob } from './Knob';

interface PartEditorProps {
  onOpenSampleBrowser: () => void;
}

export function PartEditor({ onOpenSampleBrowser }: PartEditorProps) {
  const pattern = useAppStore((s) => s.patterns.find((p) => p.id === s.currentPatternId));
  const selectedPartId = useAppStore((s) => s.selectedPartId);
  const samples = useAppStore((s) => s.samples);
  const setPartName = useAppStore((s) => s.setPartName);
  const setPartLevel = useAppStore((s) => s.setPartLevel);
  const setPartPan = useAppStore((s) => s.setPartPan);
  const setPartPitch = useAppStore((s) => s.setPartPitch);
  const setPartFilterCutoff = useAppStore((s) => s.setPartFilterCutoff);
  const setPartFilterResonance = useAppStore((s) => s.setPartFilterResonance);
  const setPartAttack = useAppStore((s) => s.setPartAttack);
  const setPartRelease = useAppStore((s) => s.setPartRelease);

  const part = pattern?.parts.find((p) => p.id === selectedPartId);
  if (!part) return null;

  const sample = samples.find((s) => s.id === part.sampleId);

  return (
    <div className="part-editor">
      <div className="part-editor-heading">
        <input
          className="part-name-input"
          value={part.name}
          onChange={(e) => setPartName(part.id, e.target.value)}
          maxLength={24}
          aria-label="Part name"
        />
        <button type="button" className="sample-picker-button" onClick={onOpenSampleBrowser}>
          <span className="sample-picker-label">Sample</span>
          <span className="sample-picker-value">{sample ? sample.name : '— none —'}</span>
        </button>
      </div>

      <div className="knob-row">
        <Knob label="Level" value={part.level} min={0} max={1} defaultValue={0.85} onChange={(v) => setPartLevel(part.id, v)} formatValue={(v) => Math.round(v * 100).toString()} />
        <Knob label="Pan" value={part.pan} min={-1} max={1} defaultValue={0} onChange={(v) => setPartPan(part.id, v)} formatValue={(v) => (v === 0 ? 'C' : v > 0 ? `R${Math.round(v * 100)}` : `L${Math.round(-v * 100)}`)} />
        <Knob label="Pitch" value={part.pitch} min={-24} max={24} step={1} defaultValue={0} onChange={(v) => setPartPitch(part.id, v)} formatValue={(v) => (v > 0 ? `+${v}` : v.toString())} />
        <Knob
          label="Cutoff"
          value={part.filterCutoff}
          min={200}
          max={20000}
          step={50}
          defaultValue={20000}
          onChange={(v) => setPartFilterCutoff(part.id, v)}
          formatValue={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v).toString())}
        />
        <Knob label="Reso" value={part.filterResonance} min={0.1} max={20} defaultValue={0.7} onChange={(v) => setPartFilterResonance(part.id, v)} formatValue={(v) => v.toFixed(1)} />
        <Knob label="Attack" value={part.attack} min={0.002} max={1} defaultValue={0.002} onChange={(v) => setPartAttack(part.id, v)} formatValue={(v) => `${Math.round(v * 1000)}ms`} />
        <Knob label="Release" value={part.release} min={0.01} max={2} defaultValue={0.3} onChange={(v) => setPartRelease(part.id, v)} formatValue={(v) => `${Math.round(v * 1000)}ms`} />
      </div>
    </div>
  );
}
