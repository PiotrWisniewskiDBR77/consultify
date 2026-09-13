import React from 'react';
import { useTranslation } from 'react-i18next';

export const INITIATIVES_HORIZONS = [1, 3, 6, 12] as const;
export type InitiativesHorizon = (typeof INITIATIVES_HORIZONS)[number];
export type InitiativesHorizonGranularity = 'week' | 'month';

export const getInitiativesHorizonGranularity = (
  horizon: InitiativesHorizon
): InitiativesHorizonGranularity => (horizon <= 3 ? 'week' : 'month');

export function InitiativesHorizonControl({
  value,
  onChange,
}: {
  value: InitiativesHorizon;
  onChange: (value: InitiativesHorizon) => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="radiogroup"
      aria-label={t('initiatives.horizon.label', 'Planning horizon')}
      className="inline-flex h-8 items-center rounded-lg border border-c-border-subtle bg-c-surface p-0.5"
      data-testid="initiatives-horizon-control"
    >
      {INITIATIVES_HORIZONS.map((months) => (
        <button
          key={months}
          type="button"
          role="radio"
          aria-checked={value === months}
          onClick={() => onChange(months)}
          className={
            value === months
              ? 'h-7 rounded-md bg-c-surface-raised px-2.5 text-xs font-semibold text-c-text'
              : 'h-7 rounded-md px-2.5 text-xs text-c-text-secondary hover:bg-c-surface-hover'
          }
        >
          {t('initiatives.horizon.months', '{{count}} mo', { count: months })}
        </button>
      ))}
    </div>
  );
}
