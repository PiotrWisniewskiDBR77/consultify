import React from 'react';
import { useTranslation } from 'react-i18next';

export function FinanceSampleDataBanner({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation();
  if (!enabled) return null;

  return (
    <div
      className="mx-4 mt-3 rounded-token-md border border-[color:var(--c-border-subtle)] bg-[color:var(--c-surface-raised)] px-3 py-2 text-sm text-[color:var(--c-info)]"
      data-testid="finance-sample-data-banner"
      role="status"
    >
      {t('finance.sampleData.banner', 'Sample data — not from the database')}
    </div>
  );
}
