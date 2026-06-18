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

const META: Record<
  TemplateStatus,
  { en: string; pl: string; icon: React.ReactNode; activeBg: string; activeFg: string }
> = {
  approved: {
    en: 'Approved',
    pl: 'Zatwierdzone',
    icon: <CheckCircle2 size={12} />,
    activeBg: '#dcfce7',
    activeFg: '#166534',
  },
  draft: {
    en: 'Draft',
    pl: 'Szkice',
    icon: <Circle size={12} />,
    activeBg: '#e2e8f0',
    activeFg: '#334155',
  },
  deprecated: {
    en: 'Deprecated',
    pl: 'Wycofane',
    icon: <MinusCircle size={12} />,
    activeBg: '#fef3c7',
    activeFg: '#92400e',
  },
};

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
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400"
            style={{
              backgroundColor: active ? meta.activeBg : 'transparent',
              color: active ? meta.activeFg : '#64748b',
              border: active ? `1px solid ${meta.activeFg}` : '1px solid #cbd5e1',
            }}
          >
            <span aria-hidden style={{ color: active ? meta.activeFg : '#94a3b8' }}>
              {meta.icon}
            </span>
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default TemplateLifecycleFilter;
