import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Value restored on right-click ("reset to default"). Omit to disable resetting. */
  defaultValue?: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
}

/** Combined (horizontal + vertical) drag distance, in px, for a full min..max sweep. */
const DRAG_RANGE_PX = 140;
const SWEEP_DEGREES = 270;
/** Pointer movement below this, in px, is treated as a click rather than a drag. */
const CLICK_MOVE_THRESHOLD_PX = 4;

export function Knob({ label, value, min, max, step, defaultValue, onChange, formatValue }: KnobProps) {
  const effectiveStep = step ?? (max - min) / 100;
  const dragState = useRef<{ startX: number; startY: number; startValue: number; moved: boolean } | null>(null);
  const dialRef = useRef<HTMLDivElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const roundToStep = (v: number) => Math.round(v / effectiveStep) * effectiveStep;

  // React's synthetic onWheel is attached passively, so preventDefault() there
  // is silently ignored (and warns). A native, non-passive listener is the
  // only reliable way to stop the page from scrolling while adjusting a knob.
  const wheelHandlerRef = useRef<(e: WheelEvent) => void>(() => {});
  useEffect(() => {
    wheelHandlerRef.current = (e: WheelEvent) => {
      e.preventDefault();
      const magnitude = e.shiftKey ? effectiveStep * 10 : effectiveStep;
      const direction = e.deltaY < 0 ? 1 : -1;
      onChange(clamp(roundToStep(value + direction * magnitude)));
    };
  });
  useEffect(() => {
    const el = dialRef.current;
    if (!el) return;
    const listener = (e: WheelEvent) => wheelHandlerRef.current(e);
    el.addEventListener('wheel', listener, { passive: false });
    return () => el.removeEventListener('wheel', listener);
  }, []);

  const startEditing = () => {
    setEditValue(String(Math.round(value / effectiveStep) * effectiveStep));
    setEditing(true);
  };

  const commitEdit = () => {
    const parsed = Number(editValue.replace(',', '.'));
    if (!Number.isNaN(parsed)) onChange(clamp(parsed));
    setEditing(false);
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (editing || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = { startX: e.clientX, startY: e.clientY, startValue: value, moved: false };
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = drag.startY - e.clientY;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) > CLICK_MOVE_THRESHOLD_PX) drag.moved = true;
    if (!drag.moved) return;
    // Any natural drag direction works: up or right increases, down or left decreases.
    const combined = dx + dy;
    const range = max - min;
    onChange(clamp(roundToStep(drag.startValue + (combined / DRAG_RANGE_PX) * range)));
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragState.current = null;
    if (drag && !drag.moved) startEditing();
  };

  const handleContextMenu = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (defaultValue !== undefined) onChange(clamp(defaultValue));
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      onChange(clamp(value + effectiveStep));
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      onChange(clamp(value - effectiveStep));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      startEditing();
    }
  };

  const pct = (value - min) / (max - min || 1);
  const angle = -SWEEP_DEGREES / 2 + pct * SWEEP_DEGREES;
  const fillDeg = pct * SWEEP_DEGREES;

  return (
    <div className="knob">
      <div
        ref={dialRef}
        className="knob-dial"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        tabIndex={0}
        title="Ziehen oder Mausrad: Wert ändern · Klick: Zahl eingeben · Rechtsklick: zurücksetzen"
        style={{ ['--fill-deg' as string]: `${fillDeg}deg` }}
      >
        <div className="knob-face">
          <div className="knob-indicator" style={{ transform: `rotate(${angle}deg)` }} />
        </div>
      </div>
      <span className="knob-label">{label}</span>
      {editing ? (
        <input
          type="text"
          inputMode="decimal"
          autoFocus
          className="knob-edit-input"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitEdit();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      ) : (
        <span className="knob-value">{formatValue ? formatValue(value) : value.toFixed(2)}</span>
      )}
    </div>
  );
}
