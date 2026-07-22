import { Bold, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Node } from 'reactflow';

import { ENTER_ANIMATION } from '../canvas/motionTokens';
import { ROW_ACCENT_COLORS } from '../table/tableTypes';
import { STYLE_FONT_SIZES } from './nodes/whiteboardNodeHelpers';

/**
 * Z15 — floating per-element style bar (Miro/Whimsical parity).
 *
 * Appears above a single selected sticky / text / shape node and lets the user
 * restyle it AFTER creation: background accent (c-tag token palette), font-size
 * step (S/M/L) and weight (normal/bold). It only DECLARES the change; the parent
 * writes the patch onto node.data through the existing setNodes → onGraphChange
 * autosave + collab-broadcast path (no new persistence route, no schema change).
 */

export interface WhiteboardStyleBarProps {
  node: Node;
  /** Screen-space anchor (top-center of the node), already viewport-transformed. */
  position: { x: number; y: number };
  locked: boolean;
  onChange: (nodeId: string, patch: Record<string, unknown>) => void;
}

// c-tag token palette — reuse of the categorical row-accent set (distinct hues,
// theme-aware, never crimson/hex). First 12 = c-tag-1..12 (drop the dup tail).
const ACCENT_SWATCHES = ROW_ACCENT_COLORS.slice(0, 12);

const FONT_STEPS: Array<{ key: 's' | 'm' | 'l'; label: string }> = [
  { key: 's', label: 'S' },
  { key: 'm', label: 'M' },
  { key: 'l', label: 'L' },
];

export const WhiteboardStyleBar: React.FC<WhiteboardStyleBarProps> = ({
  node,
  position,
  locked,
  onChange,
}) => {
  const { t } = useTranslation();
  if (locked) return null;

  const data = (node.data || {}) as Record<string, unknown>;
  const activeAccent = typeof data.accentColor === 'string' ? data.accentColor : null;
  const activeFontSize = typeof data.fontSize === 'number' ? data.fontSize : null;
  const isBold = data.fontWeight === 'bold' || data.bold === true;

  const swatchBtn =
    'w-4 h-4 rounded-full border border-c-border-subtle transition-transform hover:scale-110 ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus';
  const chip =
    'min-w-[26px] h-6 px-1.5 rounded-lg text-[11px] font-semibold text-c-text-secondary ' +
    'hover:bg-c-surface-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ' +
    'transition-colors flex items-center justify-center';
  const chipActive = 'bg-c-surface-raised text-c-text ring-1 ring-c-border-strong';

  return (
    <div
      className={`absolute z-30 flex items-center gap-1 bg-c-surface backdrop-blur-sm rounded-2xl border border-slate-200/60 dark:border-white/[0.03] shadow-lg dark:shadow-[0_0_20px_rgba(0,0,0,0.4)] px-2 py-1.5 pointer-events-auto ${ENTER_ANIMATION.slideUp}`}
      style={{ left: position.x, top: position.y - 46, transform: 'translateX(-50%)' }}
      role="toolbar"
      aria-label={t('myWork.whiteboard.styleBar.ariaLabel', 'Element style')}
      // Keep clicks on the bar from deselecting the node behind it.
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Color accent swatches (c-tag tokens) */}
      <div className="flex items-center gap-1">
        {ACCENT_SWATCHES.map((cvar, i) => {
          const isActive = activeAccent === cvar;
          return (
            <button
              key={`sw-${i}`}
              type="button"
              className={`${swatchBtn} ${isActive ? 'ring-2 ring-c-focus scale-110' : ''}`}
              style={{ backgroundColor: cvar }}
              aria-label={t('myWork.whiteboard.styleBar.color', 'Set color')}
              aria-pressed={isActive}
              onClick={() => onChange(node.id, { accentColor: cvar })}
            />
          );
        })}
        <button
          type="button"
          className={`${chip} !min-w-0 w-6`}
          aria-label={t('myWork.whiteboard.styleBar.clearColor', 'Reset color')}
          onClick={() => onChange(node.id, { accentColor: null })}
        >
          <X className="w-3 h-3" aria-hidden="true" />
        </button>
      </div>

      <div className="w-px h-5 bg-c-surface-raised mx-0.5 shrink-0" />

      {/* Font size S / M / L */}
      <div className="flex items-center gap-0.5">
        {FONT_STEPS.map((step) => {
          const isActive = activeFontSize === STYLE_FONT_SIZES[step.key];
          return (
            <button
              key={step.key}
              type="button"
              className={`${chip} ${isActive ? chipActive : ''}`}
              aria-label={t('myWork.whiteboard.styleBar.fontSize', 'Font size {{step}}', {
                step: step.label,
              })}
              aria-pressed={isActive}
              onClick={() => onChange(node.id, { fontSize: STYLE_FONT_SIZES[step.key] })}
            >
              {step.label}
            </button>
          );
        })}
      </div>

      <div className="w-px h-5 bg-c-surface-raised mx-0.5 shrink-0" />

      {/* Weight toggle */}
      <button
        type="button"
        className={`${chip} !min-w-0 w-7 ${isBold ? chipActive : ''}`}
        aria-label={t('myWork.whiteboard.styleBar.bold', 'Bold')}
        aria-pressed={isBold}
        onClick={() => onChange(node.id, { fontWeight: isBold ? 'normal' : 'bold' })}
      >
        <Bold className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>
  );
};
