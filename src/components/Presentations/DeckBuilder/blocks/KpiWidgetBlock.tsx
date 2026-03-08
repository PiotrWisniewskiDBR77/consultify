import { TrendingDown, TrendingUp } from 'lucide-react';
import React from 'react';

import type { CardBlock, CuratedColorSet } from '../../wizard/types';

interface Props {
  block: CardBlock;
  theme: CuratedColorSet;
}

export const KpiWidgetBlock: React.FC<Props> = ({ block, theme }) => {
  const label = (block.content.label as string) || 'KPI';
  const value = (block.content.value as string | number) || '—';
  const unit = (block.content.unit as string) || '';
  const trend = block.content.trend as 'up' | 'down' | 'stable' | undefined;
  const change = (block.content.change as string) || '';

  return (
    <div
      className="rounded-xl p-4 text-center"
      style={{ backgroundColor: theme.colors.primary + '08' }}
    >
      <p className="text-xs font-medium mb-1" style={{ color: theme.colors.textSecondary }}>
        {label}
      </p>
      <p className="text-3xl font-bold" style={{ color: theme.colors.heading }}>
        {value}
        {unit && <span className="text-lg ml-1">{unit}</span>}
      </p>
      {(trend || change) && (
        <div className="flex items-center justify-center gap-1 mt-1">
          {trend === 'up' && <TrendingUp size={12} className="text-green-500" />}
          {trend === 'down' && <TrendingDown size={12} className="text-red-500" />}
          {change && (
            <span
              className={`text-xs font-medium ${
                trend === 'up'
                  ? 'text-green-500'
                  : trend === 'down'
                    ? 'text-red-500'
                    : 'text-slate-400'
              }`}
            >
              {change}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
