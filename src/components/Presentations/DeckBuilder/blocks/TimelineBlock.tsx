import React from 'react';

import type { CardBlock, CuratedColorSet } from '../../wizard/types';

interface TimelineItem {
  date: string;
  title: string;
  description?: string;
}

interface Props {
  block: CardBlock;
  theme: CuratedColorSet;
}

export const TimelineBlock: React.FC<Props> = ({ block, theme }) => {
  const items = (block.content.items as TimelineItem[]) || [
    { date: 'Q1', title: 'Discovery' },
    { date: 'Q2', title: 'Analysis' },
    { date: 'Q3', title: 'Implementation' },
    { date: 'Q4', title: 'Results' },
  ];

  return (
    <div className="relative">
      <div
        className="absolute top-3 left-0 right-0 h-0.5"
        style={{ backgroundColor: theme.colors.primary + '20' }}
      />
      <div className="flex justify-between relative">
        {items.map((item, i) => (
          <div key={i} className="flex flex-col items-center text-center" style={{ flex: 1 }}>
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white z-10"
              style={{ backgroundColor: theme.chartPalette[i % theme.chartPalette.length] }}
            >
              {i + 1}
            </div>
            <p className="text-[9px] font-medium mt-1" style={{ color: theme.colors.textSecondary }}>
              {item.date}
            </p>
            <p className="text-[10px] font-semibold" style={{ color: theme.colors.heading }}>
              {item.title}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
