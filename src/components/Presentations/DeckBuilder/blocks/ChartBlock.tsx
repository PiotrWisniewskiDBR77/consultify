import { BarChart3 } from 'lucide-react';
import React from 'react';

import type { CardBlock, CuratedColorSet } from '../../wizard/types';

interface Props {
  block: CardBlock;
  theme: CuratedColorSet;
}

export const ChartBlock: React.FC<Props> = ({ block, theme }) => {
  const chartType = (block.content.chartType as string) || 'bar';
  const title = (block.content.title as string) || 'Chart';
  const data = (block.content.data as { label: string; value: number }[]) || [
    { label: 'Q1', value: 42 },
    { label: 'Q2', value: 58 },
    { label: 'Q3', value: 35 },
    { label: 'Q4', value: 71 },
  ];

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold" style={{ color: theme.colors.heading }}>
        {title}
      </p>
      {chartType === 'bar' ? (
        <div className="flex items-end gap-2 h-24">
          {data.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t transition-all"
                style={{
                  height: `${(d.value / maxValue) * 100}%`,
                  backgroundColor: theme.chartPalette[i % theme.chartPalette.length],
                  minHeight: '4px',
                }}
              />
              <span className="text-[9px]" style={{ color: theme.colors.textSecondary }}>
                {d.label}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="h-24 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: theme.colors.primary + '08' }}
        >
          <BarChart3 size={32} style={{ color: theme.colors.primary }} className="opacity-40" />
          <span className="ml-2 text-xs" style={{ color: theme.colors.textSecondary }}>
            {chartType} chart
          </span>
        </div>
      )}
    </div>
  );
};
