import { useRef, useState } from 'react';
import { useAppStore } from '../state/store';
import { PartPadEditor } from './PartPadEditor';

const LONG_PRESS_MS = 3000;

export function PartStrip() {
  const pattern = useAppStore((s) => s.patterns.find((p) => p.id === s.currentPatternId));
  const selectedPartId = useAppStore((s) => s.selectedPartId);
  const selectPart = useAppStore((s) => s.selectPart);
  const toggleMute = useAppStore((s) => s.toggleMute);
  const toggleSolo = useAppStore((s) => s.toggleSolo);
  const toggleChoke = useAppStore((s) => s.toggleChoke);
  const setPartMeta = useAppStore((s) => s.setPartMeta);

  const [editingPartId, setEditingPartId] = useState<number | null>(null);
  const pressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);

  const clearPressTimer = () => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const handlePointerDown = (partId: number) => {
    if (editingPartId !== null) return;
    longPressFired.current = false;
    clearPressTimer();
    pressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      setEditingPartId(partId);
    }, LONG_PRESS_MS);
  };

  const handleClick = (partId: number) => {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    selectPart(partId);
  };

  if (!pattern) return null;

  return (
    <div className="part-strip" role="group" aria-label="Parts">
      {pattern.parts.map((part) => {
        const activeSteps = part.steps.slice(0, pattern.stepCount).filter((s) => s.on).length;
        const isEditing = editingPartId === part.id;
        return (
          <div key={part.id} className={`part-pad ${part.id === selectedPartId ? 'selected' : ''} ${isEditing ? 'editing' : ''}`}>
            {isEditing ? (
              <PartPadEditor
                part={part}
                onCancel={() => setEditingPartId(null)}
                onApply={(meta) => {
                  setPartMeta(part.id, meta);
                  setEditingPartId(null);
                }}
              />
            ) : (
              <>
                <button
                  type="button"
                  className="part-pad-main"
                  style={part.color ? { background: `color-mix(in srgb, ${part.color} 25%, var(--panel-raised))` } : undefined}
                  onPointerDown={() => handlePointerDown(part.id)}
                  onPointerUp={clearPressTimer}
                  onPointerLeave={clearPressTimer}
                  onPointerCancel={clearPressTimer}
                  onClick={() => handleClick(part.id)}
                  title={part.name}
                >
                  <span className="part-pad-index">{part.id + 1}</span>
                  <span className="part-pad-name" style={part.color ? { color: part.color } : undefined}>
                    {part.name}
                  </span>
                  {activeSteps > 0 && <span className="part-pad-dot" aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  className={`mini-toggle choke-toggle ${part.choke ? 'active choke' : ''}`}
                  onClick={() => toggleChoke(part.id)}
                  title="Cut Itself: verhindert, dass sich mehrere Anschläge dieses Parts überlagern"
                >
                  C
                </button>
                <div className="part-pad-toggles">
                  <button
                    type="button"
                    className={`mini-toggle ${part.mute ? 'active mute' : ''}`}
                    onClick={() => toggleMute(part.id)}
                    title="Mute"
                  >
                    M
                  </button>
                  <button
                    type="button"
                    className={`mini-toggle ${part.solo ? 'active solo' : ''}`}
                    onClick={() => toggleSolo(part.id)}
                    title="Solo"
                  >
                    S
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
