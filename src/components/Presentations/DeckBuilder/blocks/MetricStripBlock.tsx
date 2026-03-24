import React from 'react';

import type { CardBlock, CuratedColorSet } from '../../wizard/types';

interface MetricItem {
  label: string;
  value: string | number;
  unit?: string;
}

interface Props {
  block: CardBlock;
  theme: CuratedColorSet;
}

export const MetricStripBlock: React.FC<Props> = ({ block, theme }) => {
  const metrics = (block.content.metrics as MetricItem[]) || [
    { label: 'Revenue', value: '$2.4M' },
    { label: 'Growth', value: '+12%' },
    { label: 'Clients', value: '148' },
  ];

  return (
    <div className="flex gap-4">
      {metrics.map((m, i) => (
        <div
          key={i}
          className="flex-1 text-center p-3 rounded-lg"
          style={{ backgroundColor: theme.colors.primary + '06' }}
        >
          <p
            className="text-[10px] font-medium mb-0.5"
            style={{ color: theme.colors.textSecondary }}
          >
            {m.label}
          </p>
          <p className="text-xl font-bold" style={{ color: theme.colors.heading }}>
            {m.value}
            {m.unit && <span className="text-sm ml-0.5">{m.unit}</span>}
          </p>
        </div>
      ))}
    </div>
  );
};
