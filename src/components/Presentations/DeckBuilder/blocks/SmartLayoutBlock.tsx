import React from 'react';

import type { CardBlock, CuratedColorSet } from '../../wizard/types';

interface LayoutItem {
  title: string;
  description?: string;
  icon?: string;
}

interface Props {
  block: CardBlock;
  theme: CuratedColorSet;
}

export const SmartLayoutBlock: React.FC<Props> = ({ block, theme }) => {
  const layoutType = (block.content.layoutType as string) || 'columns';
  const items = (block.content.items as LayoutItem[]) || [
    { title: 'Strategy', description: 'Define long-term goals' },
    { title: 'Execution', description: 'Deliver on commitments' },
    { title: 'Results', description: 'Measure outcomes' },
  ];

  const columns = layoutType === '4col' ? 4 : layoutType === '2col' ? 2 : 3;

  return (
    <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {items.map((item, i) => (
        <div
          key={i}
          className="rounded-lg p-3 border-l-3"
          style={{
            backgroundColor: theme.colors.primary + '06',
            borderLeftColor: theme.chartPalette[i % theme.chartPalette.length],
            borderLeftWidth: '3px',
          }}
        >
          <p className="text-xs font-semibold mb-0.5" style={{ color: theme.colors.heading }}>
            {item.title}
          </p>
          {item.description && (
            <p className="text-[10px]" style={{ color: theme.colors.textSecondary }}>
              {item.description}
            </p>
          )}
        </div>
      ))}
    </div>
  );
};
