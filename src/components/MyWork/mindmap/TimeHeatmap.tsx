/**
 * TimeHeatmap — Calendar-style heatmap of map activity over the last 30 days.
 * Reads from ActivityFeed's localStorage data.
 */
import { Calendar, ChevronLeft, X } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

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
  'bg-slate-100 dark:bg-navy-800',
  'bg-emerald-200 dark:bg-emerald-900/40',
  'bg-emerald-300 dark:bg-emerald-800/50',
  'bg-emerald-400 dark:bg-emerald-700/60',
  'bg-emerald-500 dark:bg-emerald-600/70',
];

export const TimeHeatmap: React.FC<TimeHeatmapProps> = ({ open, onClose, ideaId }) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

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

  if (!open) return null;

  const weekDays = isPl ? ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'] : ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  return (
    <div className="fixed inset-0 z-[92] bg-white/95 dark:bg-navy-950/95 backdrop-blur-xl flex flex-col">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200/60 dark:border-navy-700/60">
        <button onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
          <ChevronLeft size={16} />
        </button>
        <Calendar size={16} className="text-emerald-500" />
        <h2 className="text-sm font-bold text-slate-800 dark:text-white">{isPl ? 'Mapa ciepła aktywności' : 'Activity Heatmap'}</h2>
        <span className="text-[10px] text-slate-400 ml-auto">{totalActivity} {isPl ? 'akcji w 30 dni' : 'actions in 30 days'}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Heatmap grid */}
          <div className="mb-6">
            <div className="flex gap-1 mb-2">
              {weekDays.map((d) => (
                <div key={d} className="w-8 text-center text-[8px] text-slate-400 font-bold">{d}</div>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {days.map((day) => (
                <div
                  key={day.date}
                  className={`w-8 h-8 rounded-md ${INTENSITY_COLORS[day.intensity]} flex items-center justify-center text-[8px] font-medium transition-colors cursor-default ${day.count > 0 ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-600'}`}
                  title={`${day.date}: ${day.count} ${isPl ? 'akcji' : 'actions'}`}
                >
                  {day.dayLabel}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-2 mb-6">
            <span className="text-[9px] text-slate-400">{isPl ? 'Mniej' : 'Less'}</span>
            {INTENSITY_COLORS.map((c, i) => (
              <div key={i} className={`w-4 h-4 rounded-sm ${c}`} />
            ))}
            <span className="text-[9px] text-slate-400">{isPl ? 'Więcej' : 'More'}</span>
          </div>

          {/* Activity type breakdown */}
          {Object.keys(typeCounts).length > 0 && (
            <div className="pt-4 border-t border-slate-200/40 dark:border-navy-700/40">
              <h3 className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-3">
                {isPl ? 'Podział wg typu' : 'Breakdown by type'}
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                  <div key={type} className="p-2 rounded-lg bg-slate-50/50 dark:bg-navy-950/20 border border-slate-200/30 dark:border-navy-700/30">
                    <div className="text-[10px] font-medium text-slate-600 dark:text-slate-300 capitalize">{type.replace(/_/g, ' ')}</div>
                    <div className="text-[14px] font-bold text-slate-700 dark:text-slate-200">{count}</div>
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
