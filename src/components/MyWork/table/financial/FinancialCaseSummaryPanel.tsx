/**
 * FinancialCaseSummaryPanel — doc 09 §7.3 "the information panel shows a
 * compact case summary and evidence health". Also the single place that
 * surfaces the stale/recompute state machine (§7.3 "changes to drivers
 * immediately mark calculations stale until recomputed"; doc 11 E09 DoD:
 * "invalid/stale state blocks misleading approval").
 *
 * Pure presentation over `useFinancialCase()`'s return value — no math here.
 */
import { AlertTriangle, CheckCircle2, Clock, RotateCw, ShieldAlert } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { formatPct } from './financialFormat';
import type { FinancialCaseInput, FinancialCaseStatus, FinancialDriver } from './financialTypes';
import { MIN_DRIVERS_PER_KIND } from './financialTypes';

export interface FinancialCaseSummaryPanelProps {
  caseMeta: Omit<FinancialCaseInput, 'drivers'>;
  drivers: FinancialDriver[];
  status: FinancialCaseStatus;
  errorMessage: string | null;
  lastComputedAt: string | null;
  engineWired: boolean;
  onRecompute: () => void;
}

const STATUS_META: Record<
  FinancialCaseStatus,
  { labelKey: string; label: string; tone: 'neutral' | 'warning' | 'success' | 'danger' }
> = {
  empty: { labelKey: 'ideas.financial.status.empty', label: 'No drivers yet', tone: 'neutral' },
  stale: {
    labelKey: 'ideas.financial.status.stale',
    label: 'Stale — recompute needed',
    tone: 'warning',
  },
  computing: { labelKey: 'ideas.financial.status.computing', label: 'Computing…', tone: 'neutral' },
  fresh: { labelKey: 'ideas.financial.status.fresh', label: 'Up to date', tone: 'success' },
  blocked: {
    labelKey: 'ideas.financial.status.blocked',
    label: 'Blocked — calculation engine not connected',
    tone: 'danger',
  },
  error: { labelKey: 'ideas.financial.status.error', label: 'Calculation error', tone: 'danger' },
};

const TONE_CLASSES: Record<'neutral' | 'warning' | 'success' | 'danger', string> = {
  neutral: 'bg-c-surface-raised text-c-text-secondary border-c-border',
  warning: 'bg-c-warning/10 text-c-warning border-c-warning/30',
  success: 'bg-c-success/10 text-c-success border-c-success/30',
  danger: 'bg-c-danger/10 text-c-danger border-c-danger/30',
};

export const FinancialCaseSummaryPanel: React.FC<FinancialCaseSummaryPanelProps> = ({
  caseMeta,
  drivers,
  status,
  errorMessage,
  lastComputedAt,
  engineWired,
  onRecompute,
}) => {
  const { t } = useTranslation();

  const counts = useMemo(() => {
    let cost = 0;
    let benefit = 0;
    let withEvidence = 0;
    let low = 0;
    let medium = 0;
    let high = 0;
    const missingEvidence: string[] = [];
    for (const d of drivers) {
      if (d.kind === 'cost') cost += 1;
      else benefit += 1;
      if (d.evidence.length > 0) withEvidence += 1;
      else
        missingEvidence.push(d.label || t('ideas.financial.labelPlaceholder', 'Untitled driver'));
      if (d.confidence === 'low') low += 1;
      else if (d.confidence === 'medium') medium += 1;
      else high += 1;
    }
    return { cost, benefit, withEvidence, low, medium, high, missingEvidence };
  }, [drivers, t]);

  const meta = STATUS_META[status];
  const evidencePct = drivers.length > 0 ? (counts.withEvidence / drivers.length) * 100 : null;
  const meetsMinimums =
    counts.cost >= MIN_DRIVERS_PER_KIND && counts.benefit >= MIN_DRIVERS_PER_KIND;

  return (
    <div className="flex flex-col gap-3 p-3 border border-c-border rounded-lg bg-c-surface">
      {/* Status banner — the one place the whole tool must agree "can this number be trusted right now". */}
      <div
        className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 ${TONE_CLASSES[meta.tone]}`}
      >
        <div className="flex items-center gap-1.5 text-xs font-medium">
          {status === 'fresh' && <CheckCircle2 size={14} />}
          {status === 'stale' && <AlertTriangle size={14} />}
          {status === 'computing' && <Clock size={14} className="animate-spin" />}
          {(status === 'blocked' || status === 'error') && <ShieldAlert size={14} />}
          <span>{t(meta.labelKey, meta.label)}</span>
        </div>
        {(status === 'stale' || status === 'error') && engineWired && (
          <button
            type="button"
            onClick={onRecompute}
            className="inline-flex items-center gap-1 text-xs font-medium text-c-text bg-c-surface border border-c-border-strong rounded-md px-2 py-1 hover:bg-state-hover focus:outline-none focus:ring-2 focus:ring-c-focus"
          >
            <RotateCw size={12} />
            {t('ideas.financial.recompute', 'Recompute')}
          </button>
        )}
      </div>

      {errorMessage && (
        <div className="text-xs text-c-danger bg-c-danger/5 border border-c-danger/20 rounded-md px-2 py-1.5">
          {errorMessage}
        </div>
      )}

      {!engineWired && (
        <div className="text-[11px] text-c-text-muted italic">
          {t(
            'ideas.financial.engineNotWired',
            'Calculation engine not connected in this build — no numbers are being fabricated.'
          )}
        </div>
      )}

      {/* Compact case summary */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        <div className="text-c-text-muted">{t('ideas.financial.currency', 'Currency')}</div>
        <div className="text-c-text text-right font-medium">{caseMeta.currency}</div>
        <div className="text-c-text-muted">
          {t('ideas.financial.discountRate', 'Discount rate')}
        </div>
        <div className="text-c-text text-right font-medium">
          {formatPct(caseMeta.discountRatePct)}
        </div>
        <div className="text-c-text-muted">{t('ideas.financial.horizon', 'Horizon')}</div>
        <div className="text-c-text text-right font-medium">
          {caseMeta.horizonMonths} {t('ideas.financial.months', 'mo')}
        </div>
        <div className="text-c-text-muted">{t('ideas.financial.driverCounts', 'Drivers')}</div>
        <div
          className={`text-right font-medium ${meetsMinimums ? 'text-c-text' : 'text-c-warning'}`}
        >
          {counts.cost} {t('ideas.financial.costShort', 'cost')} / {counts.benefit}{' '}
          {t('ideas.financial.benefitShort', 'benefit')}
          {!meetsMinimums && (
            <span className="block text-[10px] font-normal">
              {t(
                'ideas.financial.minimumsNotMet',
                'Needs ≥{{min}} of each for the acceptance case',
                { min: MIN_DRIVERS_PER_KIND }
              )}
            </span>
          )}
        </div>
        {lastComputedAt && (
          <>
            <div className="text-c-text-muted">
              {t('ideas.financial.lastComputed', 'Last computed')}
            </div>
            <div className="text-c-text text-right font-medium">
              {new Date(lastComputedAt).toLocaleString('pl-PL')}
            </div>
          </>
        )}
      </div>

      {/* Evidence health */}
      <div className="border-t border-c-border-subtle pt-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-c-text-secondary">
            {t('ideas.financial.evidenceHealth', 'Evidence health')}
          </span>
          <span className="text-xs text-c-text-muted">
            {evidencePct === null ? '—' : formatPct(evidencePct, 0)}
          </span>
        </div>
        <svg
          className="w-full h-1.5 mb-1.5"
          viewBox="0 0 100 6"
          preserveAspectRatio="none"
          role="progressbar"
          aria-valuenow={Math.round(evidencePct ?? 0)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <rect x={0} y={0} width={100} height={6} rx={3} className="fill-c-border-subtle" />
          <rect
            x={0}
            y={0}
            width={Math.max(0, Math.min(100, evidencePct ?? 0))}
            height={6}
            rx={3}
            className="fill-c-success"
          />
        </svg>
        <div className="flex gap-2 text-[10px] text-c-text-muted mb-1.5">
          <span>
            {t('ideas.financial.confidenceHigh', 'High')}: {counts.high}
          </span>
          <span>
            {t('ideas.financial.confidenceMedium', 'Medium')}: {counts.medium}
          </span>
          <span>
            {t('ideas.financial.confidenceLow', 'Low')}: {counts.low}
          </span>
        </div>
        {counts.missingEvidence.length > 0 && (
          <div className="text-[11px] text-c-warning">
            {t('ideas.financial.evidenceMissingFor', 'Evidence needed: {{list}}', {
              list: counts.missingEvidence.join(', '),
            })}
          </div>
        )}
      </div>
    </div>
  );
};
