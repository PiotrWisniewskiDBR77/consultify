import React from 'react';
import { useTranslation } from 'react-i18next';

import type { CardBlock, CuratedColorSet } from '../../wizard/types';
import { blockContentStyle } from '../manualEditing';

interface Props {
  block: CardBlock;
  theme: CuratedColorSet;
}

export const BulletListBlock: React.FC<Props> = ({ block, theme }) => {
  const { t } = useTranslation();
  const isNumbered = block.type === 'numbered_list';
  const defaultItems = isNumbered
    ? [
        t('presentations.builder.defaultContent.step1', 'Krok 1'),
        t('presentations.builder.defaultContent.step2', 'Krok 2'),
        t('presentations.builder.defaultContent.step3', 'Krok 3'),
      ]
    : [
        t('presentations.builder.defaultContent.item1', 'Punkt 1'),
        t('presentations.builder.defaultContent.item2', 'Punkt 2'),
        t('presentations.builder.defaultContent.item3', 'Punkt 3'),
      ];
  const items = (block.content.items as string[]) || defaultItems;

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
