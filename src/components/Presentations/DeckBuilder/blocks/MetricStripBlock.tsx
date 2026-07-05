import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import React from 'react';

import type { CardBlock, CuratedColorSet } from '../../wizard/types';
import type { BlockDensity } from './blockDensity';

interface MetricItem {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'flat' | 'stable';
  change?: string;
}

interface Props {
  block: CardBlock;
  theme: CuratedColorSet;
  /** GROW-CONTENT: 'hero' when the strip is the dominant content of its region. */
  density?: BlockDensity;
}

export const MetricStripBlock: React.FC<Props> = ({ block, theme, density = 'default' }) => {
  const metrics = (block.content.metrics as MetricItem[]) || [
    { label: 'Revenue', value: '$2.4M' },
    { label: 'Growth', value: '+12%' },
    { label: 'Clients', value: '148' },
  ];
  const isHero = density === 'hero';

  const trendMeta = (t?: MetricItem['trend']) => {
    if (t === 'up') return { Icon: TrendingUp, color: theme.chartPalette[2] || '#16A34A' };
    if (t === 'down') return { Icon: TrendingDown, color: '#DC2626' };
    return { Icon: Minus, color: theme.colors.textSecondary };
  };

  return (
    // GROW-CONTENT: was flat centered chips. Now each tile carries a coloured
    // left accent bar, a trend arrow and a value with real visual weight — so the
    // strip reads as a dashboard, not a caption row, and fills a KPI region.
    <div className={`grid gap-3 ${gridCols(metrics.length)} w-full`}>
      {metrics.map((m, i) => {
        const { Icon, color } = trendMeta(m.trend);
        const hasTrend = m.trend != null || m.change;
        return (
          <div
            key={i}
            className={`relative rounded-xl overflow-hidden ${isHero ? 'p-5' : 'p-4'}`}
            style={{
              backgroundColor: theme.colors.primary + '08',
              border: `1px solid ${theme.colors.primary}12`,
            }}
          >
            <span
              className="absolute left-0 top-0 bottom-0 w-1"
              style={{ backgroundColor: hasTrend ? color : theme.colors.accent }}
            />
            <p
              className={`font-semibold uppercase tracking-wide ${isHero ? 'text-xs' : 'text-[10px]'} mb-1`}
              style={{ color: theme.colors.textSecondary }}
            >
              {m.label}
            </p>
            <div className="flex items-baseline gap-1">
              <span
                className={`font-extrabold leading-none tracking-tight ${isHero ? 'text-5xl' : 'text-3xl'}`}
                style={{ color: theme.colors.heading }}
              >
                {m.value}
              </span>
              {m.unit && (
                <span
                  className={isHero ? 'text-xl font-bold' : 'text-sm font-bold'}
                  style={{ color: theme.colors.heading }}
                >
                  {m.unit}
                </span>
              )}
            </div>
            {hasTrend && (
              <div className="flex items-center gap-1 mt-1.5">
                <Icon size={isHero ? 16 : 13} style={{ color }} />
                {m.change && (
                  <span
                    className={`font-semibold ${isHero ? 'text-sm' : 'text-xs'}`}
                    style={{ color }}
                  >
                    {m.change}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

function gridCols(n: number): string {
  if (n <= 1) return 'grid-cols-1';
  if (n === 2) return 'grid-cols-2';
  if (n === 3) return 'grid-cols-3';
  return 'grid-cols-4';
}
