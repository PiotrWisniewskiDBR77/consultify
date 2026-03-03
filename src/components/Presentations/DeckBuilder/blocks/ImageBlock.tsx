import { ImageIcon } from 'lucide-react';
import React from 'react';

import type { CardBlock, CuratedColorSet } from '../../wizard/types';

interface Props {
  block: CardBlock;
  theme: CuratedColorSet;
}

export const ImageBlock: React.FC<Props> = ({ block, theme }) => {
  const url = block.content.url as string | undefined;
  const alt = (block.content.alt as string) || 'Image';

  if (url) {
    return (
      <div className="rounded-lg overflow-hidden">
        <img src={url} alt={alt} className="w-full h-auto object-cover max-h-48" />
      </div>
    );
  }

  return (
    <div
      className="h-32 rounded-lg flex items-center justify-center"
      style={{ backgroundColor: theme.colors.primary + '08' }}
    >
      <ImageIcon size={32} style={{ color: theme.colors.primary }} className="opacity-30" />
    </div>
  );
};
