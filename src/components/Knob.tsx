import { useCallback, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
}

const DRAG_RANGE_PX = 150;
const SWEEP_DEGREES = 270;

export function Knob({ label, value, min, max, step, onChange, formatValue }: KnobProps) {
  const dragState = useRef<{ startY: number; startValue: number } | null>(null);
  const effectiveStep = step ?? (max - min) / 100;

  const clamp = useCallback((v: number) => Math.max(min, Math.min(max, v)), [min, max]);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = { startY: e.clientY, startValue: value };
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    const deltaY = dragState.current.startY - e.clientY;
    const range = max - min;
    const rawNext = dragState.current.startValue + (deltaY / DRAG_RANGE_PX) * range;
    const stepped = Math.round(rawNext / effectiveStep) * effectiveStep;
    onChange(clamp(stepped));
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragState.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      onChange(clamp(value + effectiveStep));
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      onChange(clamp(value - effectiveStep));
    }
  };

  const pct = (value - min) / (max - min || 1);
  const angle = -SWEEP_DEGREES / 2 + pct * SWEEP_DEGREES;

  return (
    <div className="knob">
      <div
        className="knob-dial"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        tabIndex={0}
      >
        <div className="knob-indicator" style={{ transform: `rotate(${angle}deg)` }} />
      </div>
      <span className="knob-label">{label}</span>
      <span className="knob-value">{formatValue ? formatValue(value) : value.toFixed(2)}</span>
    </div>
  );
}
