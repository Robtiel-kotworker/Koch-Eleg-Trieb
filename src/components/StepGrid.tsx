import { useState } from 'react';
import { useAppStore } from '../state/store';
import { Knob } from './Knob';

interface StepGridProps {
  currentStep: number | null;
  isPlaying: boolean;
}

export function StepGrid({ currentStep, isPlaying }: StepGridProps) {
  const pattern = useAppStore((s) => s.patterns.find((p) => p.id === s.currentPatternId));
  const selectedPartId = useAppStore((s) => s.selectedPartId);
  const toggleStep = useAppStore((s) => s.toggleStep);
  const setStepVelocity = useAppStore((s) => s.setStepVelocity);
  const setStepPitch = useAppStore((s) => s.setStepPitch);
  const clearPart = useAppStore((s) => s.clearPart);
  const setStepCount = useAppStore((s) => s.setStepCount);
  const [editStep, setEditStep] = useState<number | null>(null);

  if (!pattern) return null;
  const part = pattern.parts.find((p) => p.id === selectedPartId);
  if (!part) return null;

  const step = editStep !== null ? part.steps[editStep] : null;

  return (
    <div className="step-grid-panel">
      <div className="step-grid-header">
        <h2>
          Part {part.id + 1} · {part.name}
        </h2>
        <div className="step-grid-header-actions">
          <label className="step-count-select">
            Steps
            <select value={pattern.stepCount} onChange={(e) => setStepCount(Number(e.target.value))}>
              {[4, 8, 12, 16].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="ghost-button" onClick={() => clearPart(part.id)}>
            Clear
          </button>
        </div>
      </div>

      <div className="step-grid">
        {part.steps.map((s, i) => {
          const inRange = i < pattern.stepCount;
          if (!inRange) return null;
          const isCurrent = isPlaying && currentStep === i;
          const isBeatStart = i % 4 === 0;
          return (
            <button
              key={i}
              type="button"
              className={[
                'step-button',
                s.on ? 'on' : '',
                isCurrent ? 'current' : '',
                isBeatStart ? 'beat-start' : '',
                editStep === i ? 'editing' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => {
                toggleStep(part.id, i);
                setEditStep(i);
              }}
              style={s.on ? { ['--velocity' as string]: s.velocity.toString() } : undefined}
              title={`Step ${i + 1}`}
            >
              <span className="step-number">{i + 1}</span>
            </button>
          );
        })}
      </div>

      <div className="step-edit-panel">
        {step ? (
          <>
            <span className="step-edit-title">Step {(editStep as number) + 1}</span>
            <Knob
              label="Velocity"
              value={step.velocity}
              min={0}
              max={1}
              defaultValue={0.85}
              onChange={(v) => setStepVelocity(part.id, editStep as number, v)}
              formatValue={(v) => Math.round(v * 100).toString()}
            />
            <Knob
              label="Pitch Lock"
              value={step.pitch}
              min={-12}
              max={12}
              step={1}
              defaultValue={0}
              onChange={(v) => setStepPitch(part.id, editStep as number, v)}
              formatValue={(v) => (v > 0 ? `+${v}` : v.toString())}
            />
          </>
        ) : (
          <span className="step-edit-hint">Tap a step to edit its velocity &amp; pitch lock.</span>
        )}
      </div>
    </div>
  );
}
