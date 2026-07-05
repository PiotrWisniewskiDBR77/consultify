/**
 * TemplateLifecycleBadge — status chip for `tp_base_templates` rows
 * (Block A · EPIC-T6).
 *
 * Renders one of three states: `draft` (slate), `approved` (emerald),
 * `deprecated` (amber). Includes an optional `subtle` variant which
 * collapses the chip to a single coloured dot — used in dense template
 * grids per A-P3 ("badge clutter") risk note.
 */

import { CheckCircle2, Circle, MinusCircle } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { TemplateStatus } from '@/services/api/templateLifecycle.api';

export interface TemplateLifecycleBadgeProps {
  status: TemplateStatus;
  variant?: 'chip' | 'dot';
  testId?: string;
}

// Token-based status palette (Tailwind scales w/ dark: variants per
// 00-foundation dark-mode + VISUAL_STANDARD §5.3). `dotClass` drives the
// `dot` variant + the chip icon colour.
const STYLES: Record<
  TemplateStatus,
  { chipClass: string; dotClass: string; icon: React.ReactNode; en: string }
> = {
  draft: {
    chipClass:
      'bg-c-surface-raised text-c-text-secondary border-c-border',
    dotClass: 'text-c-text-secondary',
    icon: <Circle size={11} />,
    en: 'Draft',
  },
  approved: {
    chipClass:
      'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700',
    dotClass: 'text-emerald-600 dark:text-emerald-400',
    icon: <CheckCircle2 size={11} />,
    en: 'Approved',
  },
  deprecated: {
    chipClass:
      'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700',
    dotClass: 'text-amber-600 dark:text-amber-400',
    icon: <MinusCircle size={11} />,
    en: 'Deprecated',
  },
};

export const TemplateLifecycleBadge: React.FC<TemplateLifecycleBadgeProps> = ({
  status,
  variant = 'chip',
  testId = 'template-lifecycle-badge',
}) => {
  const { t } = useTranslation();
  const style = STYLES[status];
  const label = t(`kimi.template.badge.${status}`, style.en);
  const statusPrefix = t('kimi.template.badge.statusPrefix', 'Template status');

  if (variant === 'dot') {
    return (
      <span
        data-testid={testId}
        className={`inline-block w-2 h-2 rounded-full bg-current ${style.dotClass}`}
        title={label}
        aria-label={`${statusPrefix}: ${label}`}
      />
    );
  }

  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${style.chipClass}`}
      aria-label={`${statusPrefix}: ${label}`}
    >
      <span aria-hidden>{style.icon}</span>
      <span>{label}</span>
    </span>
  );
};

export default TemplateLifecycleBadge;
