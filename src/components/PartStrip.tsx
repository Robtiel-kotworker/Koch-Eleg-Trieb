import { useAppStore } from '../state/store';

export function PartStrip() {
  const pattern = useAppStore((s) => s.patterns.find((p) => p.id === s.currentPatternId));
  const selectedPartId = useAppStore((s) => s.selectedPartId);
  const selectPart = useAppStore((s) => s.selectPart);
  const toggleMute = useAppStore((s) => s.toggleMute);
  const toggleSolo = useAppStore((s) => s.toggleSolo);

  if (!pattern) return null;

  return (
    <div className="part-strip" role="group" aria-label="Parts">
      {pattern.parts.map((part) => {
        const activeSteps = part.steps.slice(0, pattern.stepCount).filter((s) => s.on).length;
        return (
          <div key={part.id} className={`part-pad ${part.id === selectedPartId ? 'selected' : ''}`}>
            <button
              type="button"
              className="part-pad-main"
              onClick={() => selectPart(part.id)}
              title={part.name}
            >
              <span className="part-pad-index">{part.id + 1}</span>
              <span className="part-pad-name">{part.name}</span>
              {activeSteps > 0 && <span className="part-pad-dot" aria-hidden="true" />}
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
          </div>
        );
      })}
    </div>
  );
}
