import React from 'react';

import type { CardBlock, CuratedColorSet } from '../../wizard/types';

interface Props {
  block: CardBlock;
  theme: CuratedColorSet;
}

export const ParagraphBlock: React.FC<Props> = ({ block, theme }) => {
  const text = (block.content.text as string) || '';

  return (
    <p className="text-sm leading-relaxed" style={{ color: theme.colors.textPrimary }}>
      {text}
    </p>
  );
};
