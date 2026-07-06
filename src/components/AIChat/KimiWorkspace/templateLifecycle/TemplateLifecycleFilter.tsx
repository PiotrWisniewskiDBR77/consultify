/**
 * TemplateLifecycleFilter — filter chips for the template catalog
 * (Block A · EPIC-T6 · A-P1 mitigation).
 *
 * Three single-select chips: `Approved` (default), `Draft`, `Deprecated`.
 * The "All" option is intentionally absent — A-P1 ("catalog overwhelm")
 * recommends defaulting to Approved and forcing the user to opt into
 * draft/deprecated views explicitly. The host can still pass `null`
 * through `value` to render the chips without a default selection.
 */

import { CheckCircle2, Circle, MinusCircle } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { TemplateStatus } from '@/services/api/templateLifecycle.api';

export interface TemplateLifecycleFilterProps {
  value: TemplateStatus;
  onChange: (next: TemplateStatus) => void;
  /** Hide statuses the current user shouldn't see. Defaults to all 3. */
  visibleStatuses?: TemplateStatus[];
  testId?: string;
}

const ORDER: TemplateStatus[] = ['approved', 'draft', 'deprecated'];

// Token-based filter-pill palette. `activeClass` = active (selected) pill;
// inactive pills share a neutral token style. Dark: variants per
// 00-foundation dark-mode.
const META: Record<
  TemplateStatus,
  { en: string; icon: React.ReactNode; activeClass: string }
> = {
  approved: {
    en: 'Approved',
    icon: <CheckCircle2 size={12} />,
    activeClass:
      'bg-emerald-100 text-emerald-800 border-emerald-400 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-600',
  },
  draft: {
    en: 'Draft',
    icon: <Circle size={12} />,
    activeClass:
      'bg-c-border-subtle text-c-text border-c-border-strong',
  },
  deprecated: {
    en: 'Deprecated',
    icon: <MinusCircle size={12} />,
    activeClass:
      'bg-amber-100 text-amber-800 border-amber-400 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-600',
  },
};

const INACTIVE_CLASS =
  'bg-transparent text-c-text-secondary border-c-border-subtle';

export const TemplateLifecycleFilter: React.FC<TemplateLifecycleFilterProps> = ({
  value,
  onChange,
  visibleStatuses,
  testId = 'template-lifecycle-filter',
}) => {
  const { t } = useTranslation();
  const visible = visibleStatuses ?? ORDER;
  const ordered = ORDER.filter((s) => visible.includes(s));

  return (
    <div
      role="radiogroup"
      aria-label={t('kimi.template.filter.ariaLabel', 'Template status filter')}
      data-testid={testId}
      className="inline-flex items-center gap-1.5"
    >
      {ordered.map((status) => {
        const meta = META[status];
        const active = status === value;
        const label = t(`kimi.template.status.${status}`, meta.en);
        return (
          <button
            key={status}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(status)}
            data-testid={`${testId}-${status}`}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
              active ? meta.activeClass : INACTIVE_CLASS
            }`}
          >
            <span aria-hidden>{meta.icon}</span>
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default TemplateLifecycleFilter;
