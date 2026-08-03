/**
 * EdgeStylePopover — #6p (2026-07-12): minimal edge-properties popover for
 * Process Flow. Opens on a click on any edge (see IdeaProcessFlowTool's
 * `onEdgeClick`), anchored at the click point — same visual pattern as the
 * existing canvas popovers (AddNodePopover / ColorPickerPopover): a small
 * `c-surface-raised` card, section headers in the same caps/tracking style,
 * swatches from the canonical `--c-tag-*` identity palette (no new colors).
 *
 * Fields: color (c-tag-* swatches, "auto" clears the override), line style
 * (solid/dashed), arrow direction (none/start/end/both), and the text label
 * (duplicates the existing double-click-to-edit affordance on the edge label
 * itself, so both entry points stay in sync — same onLabelChange handler).
 */
import type { TFunction } from 'i18next';
import { ArrowLeft, ArrowLeftRight, ArrowRight, Ban } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Edge } from 'reactflow';

export type EdgeArrowDirection = 'none' | 'start' | 'end' | 'both';
export type EdgeStrokeStyle = 'solid' | 'dashed';

// Canonical --c-tag-* identity palette (src/index.css, theme-aware). Same
// source used by ColorPickerPopover (mindmap) — no bespoke colors introduced.
const TAG_SWATCHES = Array.from({ length: 8 }, (_, i) => `var(--c-tag-${i + 1})`);

const ARROW_OPTIONS: Array<{
  id: EdgeArrowDirection;
  icon: React.ComponentType<{ size?: number }>;
}> = [
  { id: 'none', icon: Ban },
  { id: 'end', icon: ArrowRight },
  { id: 'start', icon: ArrowLeft },
  { id: 'both', icon: ArrowLeftRight },
];

const arrowLabel = (id: EdgeArrowDirection, t: TFunction): string => {
  if (id === 'none') return t('processFlow.edgeStylePopover.arrowNone', 'None');
  if (id === 'end') return t('processFlow.edgeStylePopover.arrowEnd', 'End');
  if (id === 'start') return t('processFlow.edgeStylePopover.arrowStart', 'Start');
  return t('processFlow.edgeStylePopover.arrowBoth', 'Both');
};

interface EdgeStylePopoverProps {
  isPl: boolean;
  edge: Edge;
  locked: boolean;
  x: number;
  y: number;
  onLabelChange: (edgeId: string, label: string) => void;
  onColorChange: (edgeId: string, color: string | null) => void;
  onStyleChange: (edgeId: string, style: EdgeStrokeStyle) => void;
  onArrowChange: (edgeId: string, direction: EdgeArrowDirection) => void;
  onClose: () => void;
}

export const EdgeStylePopover: React.FC<EdgeStylePopoverProps> = ({
  edge,
  locked,
  x,
  y,
  onLabelChange,
  onColorChange,
  onStyleChange,
  onArrowChange,
  onClose,
}) => {
  const { t } = useTranslation();
  const popoverRef = useRef<HTMLDivElement>(null);
  const [labelDraft, setLabelDraft] = useState(String(edge.label ?? edge.data?.label ?? ''));

  useEffect(() => {
    setLabelDraft(String(edge.label ?? edge.data?.label ?? ''));
  }, [edge.id, edge.label, edge.data?.label]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const commitLabel = () => {
    const prev = String(edge.label ?? edge.data?.label ?? '');
    if (labelDraft !== prev) onLabelChange(edge.id, labelDraft);
  };

  const currentColor = (edge.data?.edgeColor as string | undefined) ?? null;
  const currentStyle: EdgeStrokeStyle =
    edge.data?.strokeStyleOverride === 'dashed' ? 'dashed' : 'solid';
  // F8: keep the popover's "current" selection in sync with the component's
  // actual default (see FlowEdgeComponent) — unset edges now render an end
  // arrow, so the popover must show "End" as selected, not "None".
  const currentArrow: EdgeArrowDirection =
    (edge.data?.arrowDirection as EdgeArrowDirection | undefined) ?? 'end';

  // Clamp so the popover doesn't render off the right/bottom edge of the viewport.
  const left = typeof window !== 'undefined' ? Math.min(x, window.innerWidth - 240) : x;
  const top = typeof window !== 'undefined' ? Math.min(y, window.innerHeight - 260) : y;

  return (
    <div
      ref={popoverRef}
      className="fixed z-overlay w-56 rounded-xl bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle shadow-xl p-2"
      style={{ left, top }}
      data-testid="process-flow-edge-style-popover"
    >
      {/* Label */}
      <div className="mb-2">
        <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary mb-1">
          {t('processFlow.edgeStylePopover.label', 'Label')}
        </div>
        <input
          value={labelDraft}
          disabled={locked}
          onChange={(e) => setLabelDraft(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitLabel();
          }}
          className="w-full rounded-lg border border-c-border-subtle dark:border-c-border-subtle bg-c-surface px-2 py-1.5 text-xs text-c-text focus:ring-2 focus:ring-c-focus outline-none disabled:opacity-40"
        />
      </div>

      {/* Color */}
      <div className="mb-2">
        <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary mb-1">
          {t('processFlow.edgeStylePopover.color', 'Color')}
        </div>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            title={t('processFlow.edgeStylePopover.autoColor', 'Auto')}
            disabled={locked}
            onClick={() => onColorChange(edge.id, null)}
            className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all disabled:opacity-40 ${
              currentColor === null
                ? 'border-c-focus ring-1 ring-c-focus'
                : 'border-c-border-subtle dark:border-c-border-subtle hover:border-c-text-secondary'
            }`}
          >
            <Ban size={10} className="text-c-text-secondary" />
          </button>
          {TAG_SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              disabled={locked}
              onClick={() => onColorChange(edge.id, c)}
              className={`w-5 h-5 rounded-full border-2 transition-all disabled:opacity-40 ${
                currentColor === c
                  ? 'border-c-focus scale-110'
                  : 'border-transparent hover:border-c-border-subtle dark:hover:border-c-border-subtle'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {/* Line style */}
      <div className="mb-2">
        <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary mb-1">
          {t('processFlow.edgeStylePopover.style', 'Style')}
        </div>
        <div className="flex gap-1">
          {(['solid', 'dashed'] as EdgeStrokeStyle[]).map((s) => (
            <button
              key={s}
              type="button"
              disabled={locked}
              onClick={() => onStyleChange(edge.id, s)}
              className={`flex-1 py-1 text-center rounded-lg text-[11px] transition-colors disabled:opacity-40 ${
                currentStyle === s
                  ? 'bg-c-surface-raised dark:bg-c-surface text-c-text dark:text-c-text font-semibold ring-1 ring-c-focus'
                  : 'text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface-raised'
              }`}
            >
              {s === 'solid'
                ? t('processFlow.edgeStylePopover.styleSolid', 'Solid')
                : t('processFlow.edgeStylePopover.styleDashed', 'Dashed')}
            </button>
          ))}
        </div>
      </div>

      {/* Arrow direction */}
      <div>
        <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary mb-1">
          {t('processFlow.edgeStylePopover.arrow', 'Arrow')}
        </div>
        <div className="flex gap-1">
          {ARROW_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isActive = currentArrow === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                title={arrowLabel(opt.id, t)}
                aria-label={arrowLabel(opt.id, t)}
                disabled={locked}
                onClick={() => onArrowChange(edge.id, opt.id)}
                className={`flex-1 h-7 flex items-center justify-center rounded-lg transition-colors disabled:opacity-40 ${
                  isActive
                    ? 'bg-c-surface-raised dark:bg-c-surface text-c-text dark:text-c-text ring-1 ring-c-focus'
                    : 'text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface-raised'
                }`}
              >
                <Icon size={13} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default EdgeStylePopover;
