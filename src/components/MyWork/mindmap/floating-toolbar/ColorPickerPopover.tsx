import { Shuffle } from 'lucide-react';
import React, { useCallback, useState } from 'react';

interface ColorPickerPopoverProps {
  isPl: boolean;
  currentColor?: string;
  currentFillOpacity?: number;
  currentLineStyle?: 'solid' | 'dashed' | 'dotted';
  onUpdate: (patch: {
    color?: string;
    fillOpacity?: number;
    lineStyle?: 'solid' | 'dashed' | 'dotted';
  }) => void;
  onClose: () => void;
}

// Node colors = DATA (categorical). Sourced from the canonical 12-tag identity
// palette (--c-tag-1..12, defined in src/index.css light+dark) so node fills stay
// on-brand and theme-aware. CSS-var strings resolve in inline `backgroundColor`.
const TAG_VARS = Array.from({ length: 12 }, (_, i) => `var(--c-tag-${i + 1})`);

// A compact "recommended" subset (blue-first ordering per §15.1).
export const RECOMMENDED_COLORS = [
  'var(--c-tag-1)',
  'var(--c-tag-12)',
  'var(--c-tag-9)',
  'var(--c-tag-4)',
  'var(--c-tag-2)',
  'var(--c-tag-11)',
];

// Full palette = status accents + the 12 identity tags (theme tokens, no raw hex).
export const PALETTE = [
  'var(--c-info)',
  'var(--c-success)',
  'var(--c-warning)',
  'var(--c-danger)',
  'var(--c-accent)',
  ...TAG_VARS,
];

const LINE_STYLES: Array<{ id: 'solid' | 'dashed' | 'dotted'; label: string; dash: string }> = [
  { id: 'solid', label: '━━━', dash: '' },
  { id: 'dashed', label: '╌╌╌', dash: '6 3' },
  { id: 'dotted', label: '···', dash: '2 2' },
];

export const ColorPickerPopover: React.FC<ColorPickerPopoverProps> = ({
  isPl,
  currentColor,
  currentFillOpacity = 100,
  currentLineStyle = 'solid',
  onUpdate,
  onClose,
}) => {
  const [opacity, setOpacity] = useState(currentFillOpacity);

  const handleColorClick = useCallback(
    (c: string) => {
      onUpdate({ color: c });
    },
    [onUpdate]
  );

  const handleRandomize = useCallback(() => {
    const c = RECOMMENDED_COLORS[Math.floor(Math.random() * RECOMMENDED_COLORS.length)];
    onUpdate({ color: c });
  }, [onUpdate]);

  const handleOpacityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      setOpacity(v);
      onUpdate({ fillOpacity: v });
    },
    [onUpdate]
  );

  return (
    <div className="w-60 rounded-xl bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle shadow-xl p-2">
      {/* Line style */}
      <div className="mb-2">
        <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary mb-1">
          {isPl ? 'Styl linii' : 'Line style'}
        </div>
        <div className="flex gap-1">
          {LINE_STYLES.map((ls) => (
            <button
              key={ls.id}
              onClick={() => onUpdate({ lineStyle: ls.id })}
              className={`flex-1 py-1 text-center rounded-lg text-[11px] transition-colors ${
                currentLineStyle === ls.id
                  ? 'bg-c-surface-raised dark:bg-c-surface text-c-text dark:text-c-text font-semibold'
                  : 'text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface-raised'
              }`}
            >
              {ls.label}
            </button>
          ))}
        </div>
      </div>

      {/* Opacity */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary mb-1">
          <span>{isPl ? 'Krycie' : 'Opacity'}</span>
          <span className="text-c-text-secondary">{opacity}%</span>
        </div>
        <input
          type="range"
          min={10}
          max={100}
          step={5}
          value={opacity}
          onChange={handleOpacityChange}
          className="w-full h-1 rounded-full accent-c-accent"
        />
      </div>

      {/* Recommended */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary">
            {isPl ? 'Zalecane' : 'Recommended'}
          </span>
          <button
            onClick={handleRandomize}
            className="flex items-center gap-1 text-[9px] text-c-text-secondary hover:text-c-text dark:hover:text-c-text transition-colors"
          >
            <Shuffle size={10} /> {isPl ? 'Losuj' : 'Random'}
          </button>
        </div>
        <div className="flex gap-1">
          {RECOMMENDED_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => handleColorClick(c)}
              className={`w-6 h-6 rounded-lg border-2 transition-all ${
                currentColor === c
                  ? 'border-c-accent scale-110'
                  : 'border-transparent hover:border-c-border-subtle dark:hover:border-c-border-subtle'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {/* Full palette */}
      <div>
        <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary mb-1">
          {isPl ? 'Paleta' : 'Palette'}
        </div>
        <div className="grid grid-cols-10 gap-0.5">
          {PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => handleColorClick(c)}
              className={`w-[18px] h-[18px] rounded border transition-all ${
                currentColor === c
                  ? 'border-c-accent ring-1 ring-c-accent'
                  : 'border-transparent hover:border-c-border-subtle dark:hover:border-c-border-subtle'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
