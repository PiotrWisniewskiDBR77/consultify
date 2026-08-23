import React from 'react';

export type CanvasViewMode = 'rich' | 'document' | 'md';

const CANVAS_VIEW_MODES: readonly [CanvasViewMode, string][] = [
  ['rich', 'Rich'],
  ['document', 'DOC'],
  ['md', 'MD'],
];

export function CanvasViewModeControl({
  mode,
  onModeChange,
}: {
  mode: CanvasViewMode;
  onModeChange: (mode: CanvasViewMode) => void;
}) {
  return (
    <div
      className="inline-flex shrink-0 rounded-full border border-slate-200 bg-slate-100/80 p-0.5 dark:border-white/10 dark:bg-white/10"
      data-testid="canvas-direct-view-switcher"
      aria-label="Canvas view"
      role="radiogroup"
    >
      {CANVAS_VIEW_MODES.map(([viewMode, label]) => (
        <button
          key={viewMode}
          type="button"
          role="radio"
          onClick={() => onModeChange(viewMode)}
          aria-checked={mode === viewMode}
          tabIndex={mode === viewMode ? 0 : -1}
          onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const currentIndex = CANVAS_VIEW_MODES.findIndex(([candidate]) => candidate === viewMode);
            const nextIndex =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? CANVAS_VIEW_MODES.length - 1
                  : (currentIndex +
                      (event.key === 'ArrowRight' ? 1 : -1) +
                      CANVAS_VIEW_MODES.length) %
                    CANVAS_VIEW_MODES.length;
            onModeChange(CANVAS_VIEW_MODES[nextIndex][0]);
            const controls =
              event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="radio"]');
            controls?.[nextIndex]?.focus();
          }}
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
            mode === viewMode
              ? 'bg-white text-slate-950 shadow-sm dark:bg-white dark:text-slate-950'
              : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}


