import { useAppStore } from '../state/store';

export function PatternManager() {
  const patterns = useAppStore((s) => s.patterns);
  const currentPatternId = useAppStore((s) => s.currentPatternId);
  const selectPattern = useAppStore((s) => s.selectPattern);
  const newPattern = useAppStore((s) => s.newPattern);
  const duplicateCurrentPattern = useAppStore((s) => s.duplicateCurrentPattern);
  const deletePattern = useAppStore((s) => s.deletePattern);
  const renamePattern = useAppStore((s) => s.renamePattern);

  const current = patterns.find((p) => p.id === currentPatternId);

  return (
    <div className="pattern-manager">
      <select
        aria-label="Pattern auswählen"
        value={currentPatternId}
        onChange={(e) => selectPattern(e.target.value)}
      >
        {patterns.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <input
        className="pattern-name-input"
        value={current?.name ?? ''}
        onChange={(e) => current && renamePattern(current.id, e.target.value)}
        maxLength={24}
        aria-label="Pattern-Name"
      />
      <button type="button" className="ghost-button" onClick={newPattern}>
        Neu
      </button>
      <button type="button" className="ghost-button" onClick={duplicateCurrentPattern}>
        Duplizieren
      </button>
      <button
        type="button"
        className="ghost-button danger"
        onClick={() => current && deletePattern(current.id)}
        disabled={patterns.length <= 1}
      >
        Löschen
      </button>
    </div>
  );
}
