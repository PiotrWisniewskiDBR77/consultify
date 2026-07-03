/**
 * QaHealthBar — overall-health pill rendered at the top of `<TabeleQaPanel>`.
 *
 * Shows a 5-axis stacked bar (proportional to weights) plus the overall
 * score and band. DBR77 monochrome: uses Tailwind tokens only. The band
 * provides the only color accent; severity dot follows the same band.
 *
 * Block C · EPIC-T11 · Sprint C-S5.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import type { QaAxisName, QaBand, QaReport } from '@/services/api/tablePlatform.api';

const BAND_COLORS: Record<QaBand, string> = {
  green: 'bg-emerald-500/80',
  amber: 'bg-amber-500/80',
  red: 'bg-danger-500/80',
};

const BAND_TEXT: Record<QaBand, string> = {
  green: 'text-emerald-700 dark:text-emerald-300',
  amber: 'text-amber-700 dark:text-amber-300',
  red: 'text-danger-700 dark:text-danger-300',
};

const AXIS_ORDER: QaAxisName[] = [
  'completeness',
  'sourceCoverage',
  'methodology',
  'freshness',
  'formulaConsistency',
];

const AXIS_WEIGHTS_DISPLAY: Record<QaAxisName, number> = {
  completeness: 0.25,
  sourceCoverage: 0.25,
  methodology: 0.2,
  freshness: 0.15,
  formulaConsistency: 0.15,
};

const AXIS_LABEL_KEY: Record<QaAxisName, string> = {
  completeness: 'kimi.tabeleShell.qa.axis.completeness',
  freshness: 'kimi.tabeleShell.qa.axis.freshness',
  sourceCoverage: 'kimi.tabeleShell.qa.axis.sourceCoverage',
  methodology: 'kimi.tabeleShell.qa.axis.methodology',
  formulaConsistency: 'kimi.tabeleShell.qa.axis.formulaConsistency',
};

const AXIS_LABEL_EN: Record<QaAxisName, string> = {
  completeness: 'Completeness',
  freshness: 'Freshness',
  sourceCoverage: 'Source coverage',
  methodology: 'Methodology',
  formulaConsistency: 'Formula consistency',
};

const BAND_LABEL_KEY: Record<QaBand, string> = {
  green: 'kimi.tabeleShell.qa.band.green',
  amber: 'kimi.tabeleShell.qa.band.amber',
  red: 'kimi.tabeleShell.qa.band.red',
};

const BAND_LABEL_EN: Record<QaBand, string> = {
  green: 'green',
  amber: 'amber',
  red: 'red',
};

export interface QaHealthBarProps {
  report: QaReport | null;
  computing?: boolean;
}

function bandFromScore(score: number): QaBand {
  if (score >= 0.85) return 'green';
  if (score >= 0.6) return 'amber';
  return 'red';
}

export const QaHealthBar: React.FC<QaHealthBarProps> = ({ report, computing }) => {
  const { t } = useTranslation();
  if (computing && !report) {
    return (
      <div
        className="h-12 rounded-md bg-c-surface-raised animate-pulse"
        data-testid="qa-health-bar-loading"
      />
    );
  }
  if (!report) {
    return (
      <div className="text-xs text-c-text-secondary">
        {t('kimi.tabeleShell.qa.noReportYet', 'No QA report yet — run a recompute.')}
      </div>
    );
  }
  const overallBand = bandFromScore(report.overallScore);
  return (
    <div
      className="rounded-md border border-c-border-subtle bg-c-surface p-3"
      data-testid="qa-health-bar"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${BAND_COLORS[overallBand]}`}
            aria-hidden
          />
          <span className="text-xs uppercase tracking-wide text-c-text-secondary">
            {t('kimi.tabeleShell.qa.health', 'Health')}
          </span>
          <span className={`text-sm font-semibold ${BAND_TEXT[overallBand]}`}>
            {Math.round(report.overallScore * 100)}%
          </span>
          <span className="text-xs text-c-text-secondary">
            {t(BAND_LABEL_KEY[overallBand], BAND_LABEL_EN[overallBand])}
          </span>
        </div>
        <span className="text-[10px] text-c-text-secondary">
          {new Date(report.computedAt).toLocaleString()}
        </span>
      </div>
      <div
        className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-c-border-subtle"
        role="img"
        aria-label={t('kimi.tabeleShell.qa.overallScoreAriaLabel', {
          defaultValue: 'Overall QA score {{pct}} percent',
          pct: Math.round(report.overallScore * 100),
        })}
      >
        {AXIS_ORDER.map((axis) => {
          const detail = report.axes[axis];
          const widthPct = AXIS_WEIGHTS_DISPLAY[axis] * 100;
          const band = detail ? detail.band : 'red';
          return (
            <div
              key={axis}
              style={{ width: `${widthPct}%` }}
              className={`${BAND_COLORS[band]} h-full`}
              title={`${t(AXIS_LABEL_KEY[axis], AXIS_LABEL_EN[axis])}: ${detail ? Math.round(detail.score * 100) : 0}%`}
            />
          );
        })}
      </div>
    </div>
  );
};

export default QaHealthBar;
