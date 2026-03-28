import { motion } from 'framer-motion';
import { Pencil, Sparkles } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';

import { PreviewCompletenessRing } from './PreviewCompletenessRing';
import { PREVIEW_META_PILL } from './previewStyles';

export interface MetaPill {
  label: string;
  className?: string;
  icon?: React.ElementType;
  dot?: string;
  /** Makes the pill clickable — fires onClick and shows hover indicator when editable */
  onClick?: () => void;
  /** When true, shows a subtle pencil indicator on hover */
  editable?: boolean;
  /** Renders an inline editor popover anchored to the pill when clicked. Return null to close. */
  renderEditor?: (onClose: () => void) => React.ReactNode;
}

export interface AISuggestion {
  label: string;
  action: () => void;
  confidence: number;
}

export interface CompletenessInfo {
  percent: number;
  missingFields?: string[];
  onClick?: () => void;
}

export interface PreviewMetaCardProps {
  pills: MetaPill[];
  /** Optional right-aligned content (e.g. date, SLA) */
  trailing?: React.ReactNode;
  /** AI-generated action suggestion displayed as a banner below pills */
  suggestion?: AISuggestion;
  /** Completeness ring shown in the trailing area */
  completeness?: CompletenessInfo;
  /** Extra content rendered below the pills row */
  children?: React.ReactNode;
}

export const PreviewMetaCard: React.FC<PreviewMetaCardProps> = ({
  pills,
  trailing,
  suggestion,
  completeness,
  children,
}) => {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const pillRefs = useRef<(HTMLElement | null)[]>([]);

  const closeEditor = useCallback(() => setEditingIdx(null), []);

  return (
    <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          {pills.map((pill, idx) => {
            const Icon = pill.icon;
            const isClickable = !!(pill.onClick || pill.renderEditor);
            const Tag = isClickable ? 'button' : 'span';

            return (
              <motion.span
                key={`${pill.label}-${idx}`}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.12, delay: idx * 0.03, ease: 'easeOut' }}
                className="relative"
              >
                <Tag
                  ref={(el: HTMLElement | null) => {
                    pillRefs.current[idx] = el;
                  }}
                  onClick={
                    isClickable
                      ? () => {
                          pill.onClick?.();
                          if (pill.renderEditor) setEditingIdx(idx);
                        }
                      : undefined
                  }
                  className={[
                    PREVIEW_META_PILL,
                    pill.className ?? 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
                    isClickable
                      ? 'cursor-pointer hover:ring-1 hover:ring-primary-400/30 transition-shadow'
                      : '',
                    pill.editable ? 'group/pill' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {pill.dot ? <span className={`w-1.5 h-1.5 rounded-full ${pill.dot}`} /> : null}
                  {Icon ? <Icon size={11} /> : null}
                  {pill.label}
                  {pill.editable ? (
                    <Pencil
                      size={9}
                      className="opacity-0 group-hover/pill:opacity-50 transition-opacity ml-0.5"
                    />
                  ) : null}
                </Tag>

                {editingIdx === idx && pill.renderEditor ? (
                  <>
                    <div className="fixed inset-0 z-40" onClick={closeEditor} />
                    <div className="absolute left-0 top-full mt-1 z-50">
                      {pill.renderEditor(closeEditor)}
                    </div>
                  </>
                ) : null}
              </motion.span>
            );
          })}
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {completeness ? (
            <PreviewCompletenessRing
              percent={completeness.percent}
              missingFields={completeness.missingFields}
              onClick={completeness.onClick}
            />
          ) : null}
          {trailing}
        </div>
      </div>
      {suggestion ? (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15, delay: 0.1 }}
          className="mt-2 flex items-center gap-2 rounded-lg bg-purple-50/60 dark:bg-purple-500/[0.08] border border-purple-200/40 dark:border-purple-500/20 px-2.5 py-1.5"
        >
          <Sparkles size={12} className="text-purple-500 dark:text-purple-400 shrink-0" />
          <span className="flex-1 text-[11px] text-purple-700 dark:text-purple-300 truncate">
            {suggestion.label}
          </span>
          <span className="text-[10px] text-purple-400 dark:text-purple-500 tabular-nums shrink-0">
            {Math.round(suggestion.confidence * 100)}%
          </span>
          <button
            onClick={suggestion.action}
            className="shrink-0 text-[10px] font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 transition-colors"
          >
            Apply
          </button>
        </motion.div>
      ) : null}
      {children}
    </div>
  );
};

export default PreviewMetaCard;
