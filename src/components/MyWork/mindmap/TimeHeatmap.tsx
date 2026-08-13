/**
 * TimeHeatmap — Calendar-style heatmap of map activity over the last 30 days.
 * Reads from ActivityFeed's localStorage data.
 */
import { Calendar, ChevronLeft, X } from 'lucide-react';
import React, { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

interface TimeHeatmapProps {
  open: boolean;
  onClose: () => void;
  ideaId: string;
}

const STORAGE_KEY_PREFIX = 'mm-activity-';
const DAYS = 30;

function loadActivity(ideaId: string): Array<{ timestamp: number; type: string }> {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${ideaId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function getDayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getIntensity(count: number, max: number): number {
  if (count === 0 || max === 0) return 0;
  return Math.ceil((count / max) * 4);
}

const INTENSITY_COLORS = [
  'bg-c-surface-raised dark:bg-c-surface',
  'bg-c-success dark:bg-c-success',
  'bg-c-success dark:bg-c-success',
  'bg-c-success dark:bg-c-success',
  'bg-c-success dark:bg-c-success',
];

export const TimeHeatmap: React.FC<TimeHeatmapProps> = ({ open, onClose, ideaId }) => {
  const { t } = useTranslation();

  const { days, maxCount, totalActivity, typeCounts } = useMemo(() => {
    const entries = loadActivity(ideaId);
    const now = Date.now();
    const dayMap: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};

    for (let i = 0; i < DAYS; i++) {
      const d = new Date(now - i * 86400000);
      dayMap[getDayKey(d.getTime())] = 0;
    }

    for (const entry of entries) {
      const key = getDayKey(entry.timestamp);
      if (key in dayMap) dayMap[key]++;
      typeCounts[entry.type] = (typeCounts[entry.type] || 0) + 1;
    }

    const counts = Object.values(dayMap);
    const maxCount = Math.max(...counts, 1);

    const days = Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({
        date,
        count,
        intensity: getIntensity(count, maxCount),
        dayOfWeek: new Date(date).getDay(),
        dayLabel: new Date(date).getDate(),
      }));

    return { days, maxCount, totalActivity: entries.length, typeCounts };
  }, [ideaId]);

  const containerRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open, onClose, containerRef });

  if (!open) return null;

  const weekDays = [
    t('myWorkMindmap.heatmap.mon', 'Mo'),
    t('myWorkMindmap.heatmap.tue', 'Tu'),
    t('myWorkMindmap.heatmap.wed', 'We'),
    t('myWorkMindmap.heatmap.thu', 'Th'),
    t('myWorkMindmap.heatmap.fri', 'Fr'),
    t('myWorkMindmap.heatmap.sat', 'Sa'),
    t('myWorkMindmap.heatmap.sun', 'Su'),
  ];

  return (
    <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="time-heatmap-view-heading"
        tabIndex={-1}
        className="fixed inset-0 z-modal bg-c-surface-raised dark:bg-c-surface backdrop-blur-xl flex flex-col outline-none"
      >
      <div className="flex items-center gap-3 px-6 py-4 border-b border-c-border-subtle dark:border-c-border-subtle">
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-c-text-secondary hover:text-c-text-secondary dark:text-c-text-muted dark:hover:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <Calendar size={16} className="text-c-success" />
        <h2 className="text-sm font-bold text-c-text dark:text-c-text" id="time-heatmap-view-heading">
          {t('ideas.mindmap.activityHeatmap', 'Activity Heatmap')}
        </h2>
        <span className="text-[10px] text-c-text-secondary ml-auto">
          {totalActivity} {t('ideas.mindmap.actions30Days', 'actions in 30 days')}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Heatmap grid */}
          <div className="mb-6">
            <div className="flex gap-1 mb-2">
              {weekDays.map((d) => (
                <div key={d} className="w-8 text-center text-[8px] text-c-text-secondary font-bold">
                  {d}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {days.map((day) => (
                <div
                  key={day.date}
                  className={`w-8 h-8 rounded-md ${INTENSITY_COLORS[day.intensity]} flex items-center justify-center text-[8px] font-medium transition-colors cursor-default ${day.count > 0 ? 'text-c-text-secondary dark:text-c-text' : 'text-c-text-secondary dark:text-c-text-muted'}`}
                  title={`${day.date}: ${day.count} ${t('ideas.mindmap.actions', 'actions')}`}
                >
                  {day.dayLabel}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-2 mb-6">
            <span className="text-[9px] text-c-text-secondary">
              {t('ideas.mindmap.less', 'Less')}
            </span>
            {INTENSITY_COLORS.map((c, i) => (
              <div key={i} className={`w-4 h-4 rounded-sm ${c}`} />
            ))}
            <span className="text-[9px] text-c-text-secondary">
              {t('ideas.mindmap.more', 'More')}
            </span>
          </div>

          {/* Activity type breakdown */}
          {Object.keys(typeCounts).length > 0 && (
            <div className="pt-4 border-t border-c-border-subtle dark:border-c-border-subtle">
              <h3 className="text-[11px] font-bold text-c-text-secondary dark:text-c-text-muted mb-3">
                {t('ideas.mindmap.breakdownByType', 'Breakdown by type')}
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(typeCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => (
                    <div
                      key={type}
                      className="p-2 rounded-lg bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle"
                    >
                      <div className="text-[10px] font-medium text-c-text-secondary dark:text-c-text-muted capitalize">
                        {type.replace(/_/g, ' ')}
                      </div>
                      <div className="text-[14px] font-bold text-c-text-secondary dark:text-c-text">
                        {count}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TimeHeatmap;
