/**
 * ManagerScopeBar — states, on the surface itself, WHAT the numbers below
 * cover and WHEN they were read (finding M02-008).
 *
 * The Manager dashboard used to show a bare "Updated: 10:54 PM" in one corner
 * and "Last updated: 22:54" in another (two clocks, two formats, two sources),
 * with no indication that "Overdue" meant the all-time owner backlog while the
 * completion ratio meant the last seven days. A reader had no way to tell that
 * "0% · 0/1" and "Overdue 71" described different populations.
 *
 * This bar is the contract: one timestamp, one window, one snapshot id, and an
 * explicit statement that figures are labelled `Mine` or `Organization`.
 */

import { AlertTriangle, CalendarRange, RefreshCw, Users } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { ManagerSnapshot } from './managerSnapshot';

export interface ManagerScopeBarProps {
  snapshot: ManagerSnapshot | null;
  /** Invariants that failed — rendered as an honest warning, never hidden. */
  coherenceFailures?: string[];
  refreshing?: boolean;
  onRefresh?: () => void;
}

const Chip: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({
  icon,
  children,
}) => (
  <span className="inline-flex items-center gap-1.5 rounded-token-md border border-[var(--c-border)] bg-[var(--c-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--c-text-secondary)]">
    {icon}
    {children}
  </span>
);

export const ManagerScopeBar: React.FC<ManagerScopeBarProps> = ({
  snapshot,
  coherenceFailures = [],
  refreshing = false,
  onRefresh,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language || 'en';

  const generatedAt = snapshot ? new Date(snapshot.generatedAt) : null;
  const generatedLabel =
    generatedAt && !Number.isNaN(generatedAt.getTime())
      ? generatedAt.toLocaleString(locale, {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';

  const windowLabel = snapshot
    ? t('executive.scope.windowDays', {
        defaultValue: 'Last {{count}} days',
        count: snapshot.window.days,
      })
    : '—';

  return (
    <div
      data-testid="manager-scope-bar"
      className="flex flex-wrap items-center justify-between gap-3 rounded-token-md border border-[var(--c-border)] bg-[var(--c-surface-raised)] px-4 py-2.5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--c-text-muted)]">
          {t('executive.scope.label', { defaultValue: 'Snapshot' })}
        </span>

        <Chip icon={<CalendarRange size={12} aria-hidden />}>{windowLabel}</Chip>

        <Chip icon={<Users size={12} aria-hidden />}>
          {t('executive.scope.basisNote', {
            defaultValue: 'Each figure is labelled Mine or Organization',
          })}
        </Chip>

        <span className="text-[11px] text-[var(--c-text-muted)]">
          {t('executive.scope.generatedAt', {
            defaultValue: 'Read at {{time}}',
            time: generatedLabel,
          })}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {coherenceFailures.length > 0 && (
          <span
            role="alert"
            data-testid="manager-coherence-warning"
            title={coherenceFailures.join('; ')}
            className="inline-flex items-center gap-1.5 rounded-token-md border border-[var(--c-warning)]/30 bg-[var(--c-warning)]/10 px-2.5 py-1 text-[11px] font-medium text-[var(--c-warning)]"
          >
            <AlertTriangle size={12} aria-hidden />
            {t('executive.scope.incoherent', {
              defaultValue: '{{count}} figures failed their consistency check',
              count: coherenceFailures.length,
            })}
          </span>
        )}

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            data-testid="manager-refresh"
            className="inline-flex h-8 items-center gap-1.5 rounded-token-md border border-[var(--c-border)] px-2.5 text-[11px] font-medium text-[var(--c-text-secondary)] transition-colors hover:bg-[var(--c-surface)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)] disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} aria-hidden />
            {t('executive.refresh', { defaultValue: 'Refresh' })}
          </button>
        )}
      </div>
    </div>
  );
};

ManagerScopeBar.displayName = 'ManagerScopeBar';

export default ManagerScopeBar;
