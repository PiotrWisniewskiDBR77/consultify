import React from 'react';

import type { CardBlock, CuratedColorSet } from '../../wizard/types';

interface Props {
  block: CardBlock;
  theme: CuratedColorSet;
}

export const DividerBlock: React.FC<Props> = ({ block, theme }) => {
  const style = (block.content.style as string) || 'line';

  if (style === 'dots') {
    return (
      <div className="flex items-center justify-center gap-2 py-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: theme.colors.primary + '30' }}
          />
        ))}
      </div>
    );
  }

  return (
    <hr
      className="my-2"
      style={{ borderColor: theme.colors.primary + '15' }}
    />
  );
};
