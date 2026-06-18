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

const STYLES: Record<
  TemplateStatus,
  { bg: string; fg: string; border: string; icon: React.ReactNode; en: string; pl: string }
> = {
  draft: {
    bg: '#f1f5f9',
    fg: '#475569',
    border: '#cbd5e1',
    icon: <Circle size={11} />,
    en: 'Draft',
    pl: 'Szkic',
  },
  approved: {
    bg: '#dcfce7',
    fg: '#166534',
    border: '#86efac',
    icon: <CheckCircle2 size={11} />,
    en: 'Approved',
    pl: 'Zatwierdzony',
  },
  deprecated: {
    bg: '#fef3c7',
    fg: '#92400e',
    border: '#fcd34d',
    icon: <MinusCircle size={11} />,
    en: 'Deprecated',
    pl: 'Wycofany',
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
        className="inline-block w-2 h-2 rounded-full"
        style={{ backgroundColor: style.fg }}
        title={label}
        aria-label={`${statusPrefix}: ${label}`}
      />
    );
  }

  return (
    <span
      data-testid={testId}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border"
      style={{ backgroundColor: style.bg, color: style.fg, borderColor: style.border }}
      aria-label={`${statusPrefix}: ${label}`}
    >
      <span aria-hidden style={{ color: style.fg }}>
        {style.icon}
      </span>
      <span>{label}</span>
    </span>
  );
};

export default TemplateLifecycleBadge;
