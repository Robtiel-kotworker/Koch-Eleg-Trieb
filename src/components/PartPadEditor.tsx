import { useState } from 'react';
import type { Part } from '../state/types';

interface PartPadEditorProps {
  part: Part;
  onCancel: () => void;
  onApply: (meta: { name: string; color: string | null }) => void;
}

const PAD_COLOR_PALETTE = [
  '#ff4d4d',
  '#ff9a3c',
  '#ffd23f',
  '#4fd67a',
  '#2dd4d4',
  '#4a9eff',
  '#8c6fff',
  '#ff6fd8',
  '#e8e6e1',
  '#6b6b76',
];

export function PartPadEditor({ part, onCancel, onApply }: PartPadEditorProps) {
  const [draftName, setDraftName] = useState(part.name);
  const [draftColor, setDraftColor] = useState<string | null>(part.color);
  const [paletteOpen, setPaletteOpen] = useState(false);

  return (
    <div className="pad-editor">
      <button type="button" className="pad-editor-close" onClick={onCancel} aria-label="Bearbeitung abbrechen">
        ×
      </button>
      <input
        className="pad-editor-name"
        value={draftName}
        onChange={(e) => setDraftName(e.target.value)}
        maxLength={24}
        autoFocus
        aria-label="Pad-Name"
      />
      <div className="pad-editor-row">
        <button
          type="button"
          className="pad-editor-color-icon"
          style={{ background: draftColor ?? 'var(--accent)' }}
          onClick={() => setPaletteOpen((v) => !v)}
          aria-label="Farbe wählen"
          title="Farbe wählen"
        />
        <button
          type="button"
          className="pad-editor-apply"
          onClick={() => onApply({ name: draftName.trim() || part.name, color: draftColor })}
        >
          Apply
        </button>
      </div>
      {paletteOpen && (
        <div className="pad-color-palette">
          <button
            type="button"
            className="palette-swatch palette-reset"
            onClick={() => {
              setDraftColor(null);
              setPaletteOpen(false);
            }}
            title="Standardfarbe"
            aria-label="Standardfarbe"
          >
            ×
          </button>
          {PAD_COLOR_PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              className={`palette-swatch ${draftColor === c ? 'selected' : ''}`}
              style={{ background: c }}
              onClick={() => {
                setDraftColor(c);
                setPaletteOpen(false);
              }}
              aria-label={`Farbe ${c}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
