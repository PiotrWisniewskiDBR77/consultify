import type { LucideIcon } from 'lucide-react';
import React from 'react';

import { PREVIEW_META_PILL } from './previewStyles';

export interface MetaPill {
  label: string;
  className?: string;
  icon?: LucideIcon;
  dot?: string;
}

export interface PreviewMetaCardProps {
  pills: MetaPill[];
  /** Optional right-aligned content (e.g. date, SLA) */
  trailing?: React.ReactNode;
  /** Extra content rendered below the pills row */
  children?: React.ReactNode;
}

export const PreviewMetaCard: React.FC<PreviewMetaCardProps> = ({
  pills,
  trailing,
  children,
}) => (
  <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] p-3">
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
        {pills.map((pill, idx) => {
          const Icon = pill.icon;
          return (
            <span
              key={`${pill.label}-${idx}`}
              className={`${PREVIEW_META_PILL} ${pill.className ?? 'bg-slate-500/10 text-slate-600 dark:text-slate-300'}`}
            >
              {pill.dot ? (
                <span className={`w-1.5 h-1.5 rounded-full ${pill.dot}`} />
              ) : null}
              {Icon ? <Icon size={11} /> : null}
              {pill.label}
            </span>
          );
        })}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
    {children}
  </div>
);

export default PreviewMetaCard;
