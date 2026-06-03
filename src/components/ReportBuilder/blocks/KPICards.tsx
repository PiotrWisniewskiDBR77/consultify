/**
 * KPICards
 *
 * Rich visual renderer for KPI/metric blocks.
 * Shows cards with:
 * - Large metric value
 * - Trend indicator (up/down/stable)
 * - Description/label
 * - Color-coded status
 */

import { ArrowDown, ArrowRight, ArrowUp, Minus } from 'lucide-react';
import React, { useMemo } from 'react';

// ==========================================
// TYPES
// ==========================================

interface KPIItem {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'stable' | 'neutral';
  trendValue?: string;
  status?: 'good' | 'warning' | 'critical' | 'neutral';
  description?: string;
  target?: string | number;
}

interface KPIData {
  type?: 'kpi' | 'dashboard' | 'scorecard';
  items: KPIItem[];
  title?: string;
  columns?: number;
}

interface KPICardsProps {
  content: string;
  columns?: number;
  primaryColor?: string;
}

// ==========================================
// HELPERS
// ==========================================

function parseKPIData(content: string): KPIData | null {
  try {
    const trimmed = content.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;

    const parsed = JSON.parse(trimmed);

    // Direct KPI format
    if (parsed.items && Array.isArray(parsed.items)) {
      return parsed as KPIData;
    }

    // Array format
    if (Array.isArray(parsed)) {
      return {
        items: parsed.map((item: any) => ({
          label: String(item.label || item.name || item.metric || ''),
          value: item.value ?? item.score ?? '–',
          unit: item.unit || undefined,
          trend: item.trend || undefined,
          trendValue: item.trendValue || item.change || undefined,
          status: item.status || undefined,
          description: item.description || undefined,
          target: item.target || undefined,
        })),
      };
    }

    // Scores/metrics object
    if (parsed.scores || parsed.metrics || parsed.kpis) {
      const items = parsed.scores || parsed.metrics || parsed.kpis;
      if (Array.isArray(items)) {
        return {
          items: items.map((item: any) => ({
            label: String(item.label || item.name || ''),
            value: item.value ?? item.score ?? '–',
            unit: item.unit || undefined,
            trend: item.trend || undefined,
            status: item.status || undefined,
          })),
          title: parsed.title,
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

function getStatusColor(status?: string): string {
  switch (status) {
    case 'good':
      return 'border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-slate-800/50';
    case 'warning':
      return 'border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-white dark:from-amber-900/20 dark:to-slate-800/50';
    case 'critical':
      return 'border-rose-200 dark:border-rose-800 bg-gradient-to-br from-rose-50 to-white dark:from-rose-900/20 dark:to-slate-800/50';
    default:
      return 'border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900/50';
  }
}

function getTrendIcon(trend?: string) {
  switch (trend) {
    case 'up':
      return <ArrowUp className="w-3.5 h-3.5 text-emerald-500" />;
    case 'down':
      return <ArrowDown className="w-3.5 h-3.5 text-rose-500" />;
    case 'stable':
      return <ArrowRight className="w-3.5 h-3.5 text-slate-600" />;
    default:
      return <Minus className="w-3.5 h-3.5 text-slate-600" />;
  }
}

function getTrendColor(trend?: string): string {
  switch (trend) {
    case 'up':
      return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30';
    case 'down':
      return 'text-rose-600 bg-rose-50 dark:bg-rose-900/30';
    default:
      return 'text-slate-500 bg-slate-50 dark:bg-slate-800';
  }
}

// ==========================================
// COMPONENT
// ==========================================

export const KPICards: React.FC<KPICardsProps> = ({ content, columns = 3 }) => {
  const data = useMemo(() => parseKPIData(content), [content]);

  if (!data || !data.items || data.items.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-slate-600">
        <p className="text-sm">No KPI data available</p>
      </div>
    );
  }

  const gridCols = data.columns || columns;

  return (
    <div className="space-y-3">
      {data.title && (
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{data.title}</h4>
      )}

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${Math.min(gridCols, 4)}, 1fr)` }}
      >
        {data.items.map((item, i) => (
          <div
            key={i}
            className={`p-4 rounded-xl border ${getStatusColor(item.status)} transition-all hover:shadow-md`}
          >
            {/* Label */}
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 truncate">
              {item.label}
            </div>

            {/* Value */}
            <div className="flex items-end gap-1.5 mb-1.5">
              <span className="text-2xl font-bold text-slate-900 dark:text-white leading-none">
                {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
              </span>
              {item.unit && (
                <span className="text-xs font-medium text-slate-600 mb-0.5">{item.unit}</span>
              )}
            </div>

            {/* Trend */}
            {(item.trend || item.trendValue) && (
              <div className="flex items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${getTrendColor(item.trend)}`}
                >
                  {getTrendIcon(item.trend)}
                  {item.trendValue || ''}
                </span>
              </div>
            )}

            {/* Target */}
            {item.target && (
              <div className="mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                <div className="text-[10px] text-slate-600">
                  Target: <span className="font-medium">{item.target}</span>
                </div>
              </div>
            )}

            {/* Description */}
            {item.description && (
              <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2">
                {item.description}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default KPICards;
