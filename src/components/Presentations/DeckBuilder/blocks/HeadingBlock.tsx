import React from 'react';

import type { CardBlock, CuratedColorSet } from '../../wizard/types';
import { blockContentStyle } from '../manualEditing';

interface Props {
  block: CardBlock;
  theme: CuratedColorSet;
}

export const HeadingBlock: React.FC<Props> = ({ block, theme }) => {
  const level = (block.content.level as number) || 1;
  const text = (block.content.text as string) || 'Heading';

  const sizeClasses: Record<number, string> = {
    1: 'text-3xl font-bold',
    2: 'text-2xl font-bold',
    3: 'text-xl font-semibold',
    4: 'text-lg font-semibold',
  };

  return (
    <div
      className={sizeClasses[level] || sizeClasses[1]}
      style={{ color: theme.colors.heading, ...blockContentStyle(block.content) }}
    >
      {text}
    </div>
  );
};
