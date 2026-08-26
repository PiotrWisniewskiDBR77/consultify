import type { TFunction } from 'i18next';
import { Clock } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface ActivityEvent {
  id: string;
  description: string;
  timestamp: string;
  userName?: string;
}

export interface PreviewActivityStripProps {
  events: ActivityEvent[];
  /** Max events to show before collapsing (default: 3) */
  initialCount?: number;
  /**
   * Optional override for the per-event timestamp text (default: relative
   * "5m"/"2h"/"3d", see `formatRelative` below). Additive — existing callers
   * that don't pass it keep the relative format unchanged. Added 2026-08-26
   * for `CriterionWorkspaceV2` (Historia panel), which needs a full localized
   * date/time to match its "zero raw enums/timestamps on the screen's face"
   * canon rather than a relative offset.
   */
  formatTimestamp?: (timestamp: string, t: TFunction) => string;
}

function formatRelative(ts: string, t: TFunction): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('sharedComponents.previewActivityStrip.justNow');
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export const PreviewActivityStrip: React.FC<PreviewActivityStripProps> = ({
  events,
  initialCount = 3,
  formatTimestamp,
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  if (!events.length) return null;

  const visible = expanded ? events : events.slice(0, initialCount);
  const hasMore = events.length > initialCount;

  return (
    <div className="py-1">
      <div className="flex items-center gap-1.5 mb-2 text-slate-600 dark:text-slate-500">
        <Clock size={12} />
        <span className="text-[10px] font-medium uppercase tracking-wider">
          {t('sharedComponents.previewActivityStrip.activity')}
        </span>
      </div>

      <div className="relative pl-4">
        <div className="absolute left-[5px] top-1 bottom-1 w-px bg-slate-200/70 dark:bg-white/[0.08]" />

        {visible.map((event) => (
          <div key={event.id} className="relative flex items-start gap-2 pb-2.5 last:pb-0">
            <div className="absolute left-[-13px] top-1.5 w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 border-2 border-white dark:border-navy-900" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-700 dark:text-slate-200 leading-snug truncate">
                {event.userName ? <span className="font-medium">{event.userName} </span> : null}
                {event.description}
              </div>
              <div className="text-[10px] text-slate-600 dark:text-slate-500 mt-0.5">
                {(formatTimestamp ?? formatRelative)(event.timestamp, t)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {hasMore ? (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
        >
          {expanded
            ? t('sharedComponents.previewActivityStrip.showLess')
            : t('sharedComponents.previewActivityStrip.showMore', {
                count: events.length - initialCount,
              })}
        </button>
      ) : null}
    </div>
  );
};

export default PreviewActivityStrip;
