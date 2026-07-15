import { AnimatePresence, motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PREVIEW_META_PILL, PREVIEW_RELATION_CHIP } from './previewStyles';

export interface RelationPreview {
  pills: { label: string; className?: string }[];
  description: string;
}

export interface RelationItem {
  id?: string;
  label: string;
  value?: React.ReactNode;
  icon?: LucideIcon | React.ReactNode;
  tone?: string;
  onClick?: () => void;
  /** Mini-preview shown on hover (300ms delay) */
  preview?: RelationPreview;
  /** Type category for smart grouping (e.g. "task", "decision", "kpi") */
  type?: string;
}

export interface PreviewRelationsProps {
  items: RelationItem[];
  title?: string;
  emptyLabel?: string;
  /** When true and items > 5, groups by RelationItem.type */
  groupByType?: boolean;
}

const HOVER_DELAY = 300;

const RelationChip: React.FC<{ item: RelationItem; idx: number }> = ({ item, idx }) => {
  // Lucide ≥0.400 uses React.forwardRef → typeof === 'object', not 'function'.
  // Accept both plain function components and forwardRef/memo objects ($$typeof).
  const Icon =
    item.icon != null &&
    !React.isValidElement(item.icon) &&
    (typeof item.icon === 'function' ||
      (typeof item.icon === 'object' && '$$typeof' in (item.icon as object)))
      ? (item.icon as React.ComponentType<{ size?: number }>)
      : null;
  const tone = item.tone ?? 'text-slate-600 dark:text-slate-300';
  const Tag = item.onClick ? 'button' : 'span';

  const [showPreview, setShowPreview] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = useCallback(() => {
    if (!item.preview) return;
    timerRef.current = setTimeout(() => setShowPreview(true), HOVER_DELAY);
  }, [item.preview]);

  const handleLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setShowPreview(false);
  }, []);

  return (
    <span className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <Tag
        key={`${item.label}-${idx}`}
        className={`${PREVIEW_RELATION_CHIP} ${tone}${item.onClick ? ' cursor-pointer hover:bg-slate-100/50 dark:hover:bg-white/[0.04]' : ''}`}
        onClick={item.onClick}
        title={item.label}
      >
        {Icon ? <Icon size={13} /> : (item.icon as React.ReactNode)}
        {item.value !== undefined ? (
          <>
            <span className="font-medium">{item.label}</span>
            <span className="opacity-70">{String(item.value)}</span>
          </>
        ) : (
          item.label
        )}
      </Tag>

      <AnimatePresence>
        {showPreview && item.preview ? (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 top-full mt-1 z-50 w-[220px] rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white dark:bg-navy-900 shadow-lg p-2.5 pointer-events-none"
          >
            <div className="flex flex-wrap gap-1 mb-1.5">
              {item.preview.pills.map((p, i) => (
                <span
                  key={i}
                  className={`${PREVIEW_META_PILL} ${p.className ?? 'bg-slate-500/10 text-slate-600 dark:text-slate-300'}`}
                >
                  {p.label}
                </span>
              ))}
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug line-clamp-2">
              {item.preview.description}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </span>
  );
};

export const PreviewRelations: React.FC<PreviewRelationsProps> = ({
  items,
  emptyLabel,
  groupByType,
}) => {
  const { t } = useTranslation();

  if (!items.length) {
    return (
      <div className="min-h-[4.5rem] flex flex-wrap items-start content-start gap-2 py-1">
        <span className="text-xs text-slate-600 dark:text-slate-500 italic py-1.5">
          {emptyLabel ?? t('sharedComponents.previewRelations.noLinkedDocuments')}
        </span>
      </div>
    );
  }

  if (groupByType && items.length > 5) {
    const groups = new Map<string, RelationItem[]>();
    for (const item of items) {
      const type = item.type ?? 'other';
      const list = groups.get(type) ?? [];
      list.push(item);
      groups.set(type, list);
    }

    return (
      <div className="min-h-[4.5rem] py-1 space-y-2">
        {Array.from(groups.entries()).map(([type, groupItems]) => (
          <RelationGroup key={type} type={type} items={groupItems} />
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-[4.5rem] flex flex-wrap items-start content-start gap-2 py-1">
      {items.map((item, idx) => (
        <RelationChip key={`${item.label}-${idx}`} item={item} idx={idx} />
      ))}
    </div>
  );
};

const RelationGroup: React.FC<{ type: string; items: RelationItem[] }> = ({ type, items }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors mb-1"
      >
        {items.length} {type}
        {items.length > 1 ? 's' : ''}
        <span className="ml-1 text-[10px]">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded ? (
        <div className="flex flex-wrap gap-2 pl-2">
          {items.map((item, idx) => (
            <RelationChip key={`${item.label}-${idx}`} item={item} idx={idx} />
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default PreviewRelations;
