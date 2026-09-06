import { AlertTriangle, Info, Lightbulb, Quote } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { CardBlock, CuratedColorSet } from '../../wizard/types';

interface Props {
  block: CardBlock;
  theme: CuratedColorSet;
}

const CALLOUT_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
  info: Info,
  warning: AlertTriangle,
  note: Lightbulb,
  quote: Quote,
};

export const CalloutBlock: React.FC<Props> = ({ block, theme }) => {
  const { t } = useTranslation();
  const variant =
    (block.content.variant as string) || (block.type === 'quote_block' ? 'quote' : 'info');
  const text =
    (block.content.text as string) ||
    t('presentations.builder.defaultContent.calloutInfo', 'Ważna informacja');
  const author = block.content.author as string | undefined;
  const Icon = CALLOUT_ICONS[variant] || Info;

  if (variant === 'quote' || block.type === 'quote_block') {
    return (
      <div className="border-l-4 pl-4 py-2" style={{ borderColor: theme.colors.accent }}>
        <p className="text-sm italic" style={{ color: theme.colors.textPrimary }}>
          &ldquo;{text}&rdquo;
        </p>
        {author && (
          <p className="text-[10px] mt-1 font-medium" style={{ color: theme.colors.textSecondary }}>
            &mdash; {author}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className="rounded-lg p-3 flex gap-2.5"
      style={{ backgroundColor: theme.colors.accent + '10' }}
    >
      <span className="flex-shrink-0 mt-0.5" style={{ color: theme.colors.accent }}>
        <Icon size={16} />
      </span>
      <p className="text-xs" style={{ color: theme.colors.textPrimary }}>
        {text}
      </p>
    </div>
  );
};
