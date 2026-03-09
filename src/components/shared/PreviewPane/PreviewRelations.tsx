import type { LucideIcon } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { PREVIEW_RELATION_CHIP } from './previewStyles';

export interface RelationItem {
  label: string;
  icon?: LucideIcon;
  tone?: string;
  onClick?: () => void;
}

export interface PreviewRelationsProps {
  items: RelationItem[];
  emptyLabel?: string;
}

export const PreviewRelations: React.FC<PreviewRelationsProps> = ({ items, emptyLabel }) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  return (
    <div className="min-h-[4.5rem] flex flex-wrap items-start content-start gap-2 py-1">
      {items.length > 0 ? (
        items.map((item, idx) => {
          const Icon = item.icon;
          const tone = item.tone ?? 'text-slate-600 dark:text-slate-300';
          const Tag = item.onClick ? 'button' : 'span';
          return (
            <Tag
              key={`${item.label}-${idx}`}
              className={`${PREVIEW_RELATION_CHIP} ${tone}${item.onClick ? ' cursor-pointer hover:bg-slate-100/50 dark:hover:bg-white/[0.04]' : ''}`}
              onClick={item.onClick}
              title={item.label}
            >
              {Icon ? <Icon size={13} /> : null}
              {item.label}
            </Tag>
          );
        })
      ) : (
        <span className="text-xs text-slate-400 dark:text-slate-500 italic py-1.5">
          {emptyLabel ?? (isPolish ? 'Brak powiązań' : 'No linked documents')}
        </span>
      )}
    </div>
  );
};

export default PreviewRelations;
