/**
 * GridView — Gallery/card view showing rows as visual cards.
 * Supports cover images, property pills, and click-to-detail.
 */
import { Image, Star } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { ColumnDef, TableNode } from './tableTypes';
import { SELECT_COLORS } from './tableTypes';

interface GridViewProps {
  rows: TableNode[];
  columns: ColumnDef[];
  onNodeClick?: (nodeId: string) => void;
}

export const GridView: React.FC<GridViewProps> = ({ rows, columns, onNodeClick }) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const displayCols = columns
    .filter((c) => c.visible && c.key !== 'label' && c.key !== 'type')
    .slice(0, 4);

  if (rows.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 gap-2 p-8">
        <Image size={32} />
        <span className="text-sm font-medium">{isPl ? 'Brak elementów' : 'No items'}</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {rows.map((row) => {
          const coverUrl = row.data?.coverImage || row.data?.thumbnail;
          const emoji = row.data?.icon || row.data?.emoji;
          const color = row.data?.color;

          return (
            <div
              key={row.id}
              className="rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-white dark:bg-navy-800 overflow-hidden cursor-pointer hover:shadow-lg hover:border-violet-300/60 dark:hover:border-violet-500/30 transition-all group"
              onClick={() => onNodeClick?.(row.id)}
            >
              {/* Cover area */}
              {coverUrl ? (
                <div
                  className="h-24 bg-cover bg-center"
                  style={{ backgroundImage: `url(${coverUrl})` }}
                />
              ) : (
                <div
                  className="h-16 flex items-center justify-center"
                  style={{
                    background: color
                      ? `linear-gradient(135deg, ${color}30, ${color}10)`
                      : 'linear-gradient(135deg, #e0e7ff, #ede9fe)',
                  }}
                >
                  {emoji ? (
                    <span className="text-2xl">{emoji}</span>
                  ) : (
                    <span
                      className="text-lg font-bold opacity-30"
                      style={{ color: color || '#6366f1' }}
                    >
                      {(row.data?.label || '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
              )}

              {/* Content */}
              <div className="p-3">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate mb-1.5 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                  {row.data?.label || row.id}
                </div>

                {/* Property pills */}
                <div className="flex flex-wrap gap-1">
                  {displayCols.map((col) => {
                    const val = row.data?.[col.key];
                    if (val == null || val === '') return null;

                    if (col.type === 'select') {
                      const bgColor =
                        col.optionColors?.[String(val)] ||
                        SELECT_COLORS[
                          (col.options || []).indexOf(String(val)) % SELECT_COLORS.length
                        ] ||
                        '#e0e7ff';
                      return (
                        <span
                          key={col.key}
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold"
                          style={{ backgroundColor: bgColor, color: '#334155' }}
                        >
                          {String(val)}
                        </span>
                      );
                    }

                    if (col.type === 'rating') {
                      return (
                        <span
                          key={col.key}
                          className="inline-flex items-center gap-0.5 text-amber-500"
                        >
                          <Star size={8} className="fill-amber-400" />
                          <span className="text-[8px] font-bold">{val}</span>
                        </span>
                      );
                    }

                    if (col.type === 'progress') {
                      const pct = Number(val) || 0;
                      return (
                        <div key={col.key} className="flex items-center gap-1">
                          <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-400'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[8px] text-slate-400">{pct}%</span>
                        </div>
                      );
                    }

                    if (col.type === 'checkbox') {
                      return val ? (
                        <span key={col.key} className="text-[8px] text-emerald-500 font-bold">
                          ✓
                        </span>
                      ) : null;
                    }

                    return (
                      <span
                        key={col.key}
                        className="text-[8px] text-slate-500 dark:text-slate-400 truncate max-w-[80px]"
                      >
                        {String(val)}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GridView;
