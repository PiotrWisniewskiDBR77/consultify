/**
 * QaAxisCard — collapsible card for one of the 5 QA axes ("Why this score?").
 *
 * Block C · EPIC-T11 · Sprint C-S5.
 */

import { ChevronDown, ChevronRight } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { QaAxisDetail, QaAxisName, QaBand } from '@/services/api/tablePlatform.api';

const BAND_DOT: Record<QaBand, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-danger-500',
};

const AXIS_LABEL: Record<QaAxisName, string> = {
  completeness: 'Completeness',
  freshness: 'Freshness',
  sourceCoverage: 'Source coverage',
  methodology: 'Methodology',
  formulaConsistency: 'Formula consistency',
};

const AXIS_LABEL_KEY: Record<QaAxisName, string> = {
  completeness: 'kimi.tabeleShell.qa.axis.completeness',
  freshness: 'kimi.tabeleShell.qa.axis.freshness',
  sourceCoverage: 'kimi.tabeleShell.qa.axis.sourceCoverage',
  methodology: 'kimi.tabeleShell.qa.axis.methodology',
  formulaConsistency: 'kimi.tabeleShell.qa.axis.formulaConsistency',
};

export interface QaAxisCardProps {
  axisName: QaAxisName;
  detail: QaAxisDetail;
  defaultExpanded?: boolean;
  labelOverride?: string;
}

export const QaAxisCard: React.FC<QaAxisCardProps> = ({
  axisName,
  detail,
  defaultExpanded = false,
  labelOverride,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultExpanded);
  const label = labelOverride ?? t(AXIS_LABEL_KEY[axisName], AXIS_LABEL[axisName]);
  const pct = Math.round(detail.score * 100);
  return (
    <div className="rounded-md border border-c-border-subtle" data-testid={`qa-axis-${axisName}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2 w-2 rounded-full ${BAND_DOT[detail.band]}`}
            aria-hidden
          />
          <span className="text-sm text-c-text">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-c-text">{pct}%</span>
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-c-text-secondary" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-c-text-secondary" />
          )}
        </div>
      </button>
      {open && (
        <dl className="border-t border-c-border-subtle px-3 py-2 text-xs">
          {detail.details.map((d, idx) => (
            <div key={`${d.metric}-${idx}`} className="flex justify-between gap-2 py-0.5">
              <dt className="text-c-text-secondary">{d.metric}</dt>
              <dd className="text-c-text">{formatValue(d.value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
};

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (Array.isArray(v)) return v.length === 0 ? '—' : v.join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export default QaAxisCard;
