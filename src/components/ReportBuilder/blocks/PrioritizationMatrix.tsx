/**
 * PrioritizationMatrix
 *
 * Impact vs Effort matrix visualization.
 * Shows items plotted in quadrants with:
 * - Color-coded quadrant labels
 * - Item bubbles with names
 * - Legend and axis labels
 */

import React, { useMemo } from 'react';

// ==========================================
// TYPES
// ==========================================

interface MatrixItem {
  name: string;
  impact: number; // 1-10
  effort: number; // 1-10
  category?: string;
  priority?: 'high' | 'medium' | 'low';
  description?: string;
}

interface PrioritizationData {
  type?: 'prioritization' | 'impact_effort';
  items: MatrixItem[];
  title?: string;
  xLabel?: string;
  yLabel?: string;
  gridSize?: 2 | 3;
}

interface PrioritizationMatrixProps {
  content: string;
  primaryColor?: string;
}

// ==========================================
// HELPERS
// ==========================================

function parsePrioritizationData(content: string): PrioritizationData | null {
  try {
    const trimmed = content.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;

    const parsed = JSON.parse(trimmed);

    if (parsed.items && Array.isArray(parsed.items)) {
      return parsed as PrioritizationData;
    }

    if (Array.isArray(parsed)) {
      return {
        items: parsed.map((item: any) => ({
          name: String(item.name || item.title || item.label || ''),
          impact: Number(item.impact || item.value || item.y || 5),
          effort: Number(item.effort || item.cost || item.x || 5),
          category: item.category || undefined,
          priority: item.priority || undefined,
        })),
      };
    }

    // Quadrant format
    if (parsed.quadrants) {
      const items: MatrixItem[] = [];
      for (const [quadrant, quadrantItems] of Object.entries(parsed.quadrants)) {
        if (Array.isArray(quadrantItems)) {
          for (const item of quadrantItems as any[]) {
            items.push({
              name: String(item.name || item.title || ''),
              impact: quadrant.includes('high_impact') || quadrant.includes('quick') ? 8 : 3,
              effort: quadrant.includes('low_effort') || quadrant.includes('quick') ? 3 : 8,
              category: quadrant,
            });
          }
        }
      }
      return { items, title: parsed.title };
    }

    return null;
  } catch {
    return null;
  }
}

const QUADRANT_COLORS = [
  {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-800',
    label: 'Quick Wins',
    labelPl: 'Szybkie wygrane',
    emoji: '🚀',
  },
  {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    label: 'Strategic',
    labelPl: 'Strategiczne',
    emoji: '🎯',
  },
  {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    label: 'Fill-ins',
    labelPl: 'Uzupełnienia',
    emoji: '📋',
  },
  {
    bg: 'bg-rose-50 dark:bg-rose-900/20',
    border: 'border-rose-200 dark:border-rose-800',
    label: 'Avoid',
    labelPl: 'Unikaj',
    emoji: '⚠️',
  },
];

const ITEM_COLORS = [
  'bg-blue-500',
  'bg-primary-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-blue-500',
  'bg-indigo-500',
  'bg-pink-500',
];

// ==========================================
// COMPONENT
// ==========================================

export const PrioritizationMatrix: React.FC<PrioritizationMatrixProps> = ({ content }) => {
  const data = useMemo(() => parsePrioritizationData(content), [content]);

  if (!data || !data.items || data.items.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-slate-600">
        <p className="text-sm">No prioritization data available</p>
      </div>
    );
  }

  const xLabel = data.xLabel || 'Effort';
  const yLabel = data.yLabel || 'Impact';

  return (
    <div className="space-y-3">
      {data.title && (
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{data.title}</h4>
      )}

      <div className="relative">
        {/* Y-axis label */}
        <div className="absolute -left-1 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] font-medium text-slate-600 uppercase tracking-wider whitespace-nowrap">
          {yLabel} →
        </div>

        {/* Matrix Grid */}
        <div className="ml-6">
          <div className="grid grid-cols-2 gap-1 aspect-square max-w-md mx-auto">
            {/* Q1: High Impact, Low Effort (Quick Wins) - top-left */}
            <div
              className={`relative p-3 rounded-tl-xl ${QUADRANT_COLORS[0].bg} ${QUADRANT_COLORS[0].border} border`}
            >
              <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mb-2">
                {QUADRANT_COLORS[0].emoji} {QUADRANT_COLORS[0].label}
              </div>
              <div className="flex flex-wrap gap-1">
                {data.items
                  .filter((item) => item.impact >= 5 && item.effort < 5)
                  .map((item, i) => (
                    <span
                      key={i}
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-white text-[9px] font-medium ${ITEM_COLORS[i % ITEM_COLORS.length]}`}
                      title={item.description || item.name}
                    >
                      {item.name.length > 20 ? `${item.name.slice(0, 18)}…` : item.name}
                    </span>
                  ))}
              </div>
            </div>

            {/* Q2: High Impact, High Effort (Strategic) - top-right */}
            <div
              className={`relative p-3 rounded-tr-xl ${QUADRANT_COLORS[1].bg} ${QUADRANT_COLORS[1].border} border`}
            >
              <div className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 mb-2">
                {QUADRANT_COLORS[1].emoji} {QUADRANT_COLORS[1].label}
              </div>
              <div className="flex flex-wrap gap-1">
                {data.items
                  .filter((item) => item.impact >= 5 && item.effort >= 5)
                  .map((item, i) => (
                    <span
                      key={i}
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-white text-[9px] font-medium ${ITEM_COLORS[(i + 2) % ITEM_COLORS.length]}`}
                      title={item.description || item.name}
                    >
                      {item.name.length > 20 ? `${item.name.slice(0, 18)}…` : item.name}
                    </span>
                  ))}
              </div>
            </div>

            {/* Q3: Low Impact, Low Effort (Fill-ins) - bottom-left */}
            <div
              className={`relative p-3 rounded-bl-xl ${QUADRANT_COLORS[2].bg} ${QUADRANT_COLORS[2].border} border`}
            >
              <div className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 mb-2">
                {QUADRANT_COLORS[2].emoji} {QUADRANT_COLORS[2].label}
              </div>
              <div className="flex flex-wrap gap-1">
                {data.items
                  .filter((item) => item.impact < 5 && item.effort < 5)
                  .map((item, i) => (
                    <span
                      key={i}
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-white text-[9px] font-medium ${ITEM_COLORS[(i + 4) % ITEM_COLORS.length]}`}
                      title={item.description || item.name}
                    >
                      {item.name.length > 20 ? `${item.name.slice(0, 18)}…` : item.name}
                    </span>
                  ))}
              </div>
            </div>

            {/* Q4: Low Impact, High Effort (Avoid) - bottom-right */}
            <div
              className={`relative p-3 rounded-br-xl ${QUADRANT_COLORS[3].bg} ${QUADRANT_COLORS[3].border} border`}
            >
              <div className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 mb-2">
                {QUADRANT_COLORS[3].emoji} {QUADRANT_COLORS[3].label}
              </div>
              <div className="flex flex-wrap gap-1">
                {data.items
                  .filter((item) => item.impact < 5 && item.effort >= 5)
                  .map((item, i) => (
                    <span
                      key={i}
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-white text-[9px] font-medium ${ITEM_COLORS[(i + 6) % ITEM_COLORS.length]}`}
                      title={item.description || item.name}
                    >
                      {item.name.length > 20 ? `${item.name.slice(0, 18)}…` : item.name}
                    </span>
                  ))}
              </div>
            </div>
          </div>

          {/* X-axis label */}
          <div className="text-center mt-2 text-[10px] font-medium text-slate-600 uppercase tracking-wider">
            {xLabel} →
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mt-2">
        {data.items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${ITEM_COLORS[i % ITEM_COLORS.length]}`} />
            <span className="text-[10px] text-slate-500">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PrioritizationMatrix;
