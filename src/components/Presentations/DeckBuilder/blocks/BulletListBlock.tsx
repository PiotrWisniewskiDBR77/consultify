import React from 'react';

import type { CardBlock, CuratedColorSet } from '../../wizard/types';
import { blockContentStyle } from '../manualEditing';

interface Props {
  block: CardBlock;
  theme: CuratedColorSet;
}

export const BulletListBlock: React.FC<Props> = ({ block, theme }) => {
  const items = (block.content.items as string[]) || ['Item 1', 'Item 2', 'Item 3'];
  const isNumbered = block.type === 'numbered_list';

  const ListTag = isNumbered ? 'ol' : 'ul';

  return (
    <ListTag
      className={`text-sm space-y-1.5 ${isNumbered ? 'list-decimal' : 'list-disc'} pl-5`}
      style={{ color: theme.colors.textPrimary, ...blockContentStyle(block.content) }}
    >
      {items.map((item, i) => (
        <li key={i} className="leading-relaxed">
          {item}
        </li>
      ))}
    </ListTag>
  );
};
