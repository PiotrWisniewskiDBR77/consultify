/**
 * TrustStatePreviewSection — Shared trust-state display for artifact preview panels.
 *
 * P18 contract §2.3: trust-state must be surfaced consistently across all
 * artifact preview surfaces (Outputs Library, Reports, Presentations).
 *
 * Renders the 5 P18 trust grammar pillars:
 *   source, run_id (execution), stage (validation + publish/review + execution),
 *   visibility, export_ledger
 *
 * Badge anatomy follows module-hub-standard.md: pill-shaped chips with
 * semantic color dots and standardized sizing.
 */

import { Copy } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { ArtifactGovernanceSummary } from './types';

const TRUST_AUTHORITY_LABELS: Record<string, string> = {
  execution_spine: 'Execution spine',
  artifact_review: 'Artifact review',
};

function authorityLabel(raw: string | null | undefined): string {
  if (!raw) return '—';
  return TRUST_AUTHORITY_LABELS[raw] ?? raw;
}

const TRUST_BADGE_BASE =
  'inline-flex items-center gap-1 h-6 rounded-full px-2 text-[10px] font-semibold border transition-colors';

const TRUST_BADGE_VARIANTS: Record<string, string> = {
  validated: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  pending: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
  attention_required: 'bg-danger-500/10 text-danger-700 dark:text-danger-300 border-danger-500/30',
  passed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  failed: 'bg-danger-500/10 text-danger-700 dark:text-danger-300 border-danger-500/30',
  private_draft: 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/30',
  in_review: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
  published: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
  completed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  running: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
  default:
    'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60',
};

const DOT_COLORS: Record<string, string> = {
  validated: 'bg-emerald-500',
  pending: 'bg-amber-500',
  attention_required: 'bg-danger-500',
  passed: 'bg-emerald-500',
  failed: 'bg-danger-500',
  private_draft: 'bg-slate-400',
  in_review: 'bg-amber-500',
  published: 'bg-blue-500',
  completed: 'bg-emerald-500',
  running: 'bg-blue-500',
  default: 'bg-slate-400',
};

function badgeVariant(state: string | null | undefined): string {
  const key = String(state || '')
    .toLowerCase()
    .trim();
  return TRUST_BADGE_VARIANTS[key] || TRUST_BADGE_VARIANTS.default;
}

function dotColor(state: string | null | undefined): string {
  const key = String(state || '')
    .toLowerCase()
    .trim();
  return DOT_COLORS[key] || DOT_COLORS.default;
}

/**
 * Zamienia surowy enum backendu (`attention_required`, `source_grounded`) na
 * czytelną etykietę („Attention Required", „Source Grounded").
 *
 * FALA 1 / „surowe identyfikatory w UI" (2026-07-27): wyeksportowane, bo
 * zakładka Presentations renderowała TEN SAM stan drugą drogą — jako pigułkę
 * z gołą wartością `previewItem.governance.validationState` — i przez to
 * pokazywała `attention_required` tam, gdzie All/Documents/Sheets pokazywały
 * „Attention Required". Jedno źródło etykiety = jeden wygląd.
 */
export function displayLabel(value: string | null | undefined): string {
  const normalized = String(value || '').trim();
  if (!normalized) return '—';
  return normalized
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

interface TrustBadgeProps {
  state: string | null | undefined;
  label?: string;
}

const TrustBadge: React.FC<TrustBadgeProps> = ({ state, label }) => {
  const text = label || displayLabel(state);
  if (text === '—') {
    return <span className="text-[10px] text-c-text-muted">—</span>;
  }
  return (
    <span className={`${TRUST_BADGE_BASE} ${badgeVariant(state)}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor(state)}`} />
      {text}
    </span>
  );
};

export interface TrustStatePreviewSectionProps {
  governance: ArtifactGovernanceSummary | null | undefined;
  artifactId?: string | null;
  exportFormats?: string[];
  onTrace?: (params: {
    executionRunId: string;
    lineagePaths: ArtifactGovernanceSummary['lineagePaths'];
  }) => void;
}

export const TrustStatePreviewSection: React.FC<TrustStatePreviewSectionProps> = ({
  governance,
  artifactId,
  exportFormats,
  onTrace,
}) => {
  const { t } = useTranslation();

  if (!governance) return null;

  const originCount = governance.originLinks?.length ?? 0;
  const sourceCount = governance.sourceRefs?.length ?? 0;
  // FALA 1 (2026-07-27): było `1 origins` — liczba sklejana z zawsze mnogim
  // rzeczownikiem. Teraz forma zależy od liczby (i18next `_one/_few/_many`,
  // polski ma trzy formy).
  const lineageSummary =
    [
      originCount > 0
        ? t('rap.outputs.preview.originsCount', {
            count: originCount,
            defaultValue_one: '{{count}} origin',
            defaultValue: '{{count}} origins',
          })
        : null,
      sourceCount > 0
        ? t('rap.outputs.preview.sourcesCount', {
            count: sourceCount,
            defaultValue_one: '{{count}} source',
            defaultValue: '{{count}} sources',
          })
        : null,
    ]
      .filter(Boolean)
      .join(' · ') || '—';

  const exportTraceText = governance.exportHistory?.length
    ? `${governance.exportHistory.length} · ${displayLabel(governance.exportHistory[0]?.status)}`
    : '—';

  // FALA 1 (2026-07-27): było `source_grounded:failed` — surowy kod kontroli
  // i surowy status sklejone dwukropkiem. Teraz zdanie po ludzku:
  // „Source Grounded — nie przeszło".
  const checkStatusLabel = (status: string | null | undefined): string => {
    const key = String(status || '')
      .toLowerCase()
      .trim();
    if (key === 'failed') return t('rap.outputs.preview.checkFailed', 'not passed');
    if (key === 'pending') return t('rap.outputs.preview.checkPending', 'awaiting check');
    if (key === 'skipped') return t('rap.outputs.preview.checkSkipped', 'skipped');
    return displayLabel(status);
  };
  const validationChecksText =
    Array.isArray(governance.validationChecks) && governance.validationChecks.length > 0
      ? governance.validationChecks
          .filter((check) => check.status !== 'passed')
          .map((check) => `${displayLabel(check.id)} — ${checkStatusLabel(check.status)}`)
          .join(' · ') || t('rap.outputs.preview.validationChecksAllGood', 'all passed')
      : '—';

  return (
    <div className="space-y-2 pt-2 border-t border-c-border-subtle">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-c-text-muted">
        {t('rap.outputs.preview.trustState', 'Trust state')}
      </div>

      <div className="space-y-1.5">
        <Row label={t('rap.outputs.preview.visibility', 'Visibility')}>
          <TrustBadge state={governance.visibilityScope} />
        </Row>

        <Row label={t('rap.outputs.preview.validation', 'Validation')}>
          <TrustBadge state={governance.validationState} />
        </Row>

        <Row label={t('rap.outputs.preview.execution', 'Execution')}>
          <TrustBadge state={governance.executionState} />
        </Row>

        <Row label={t('rap.outputs.preview.review', 'Review')}>
          <TrustBadge state={governance.publishState} />
          {typeof governance.reviewGateCount === 'number' && governance.reviewGateCount > 0 ? (
            <span className="text-[10px] text-c-text-muted ml-0.5">
              ({governance.reviewGateCount} {t('rap.outputs.preview.reviewersShort', 'gates')})
            </span>
          ) : null}
        </Row>

        <Row label={t('rap.outputs.preview.source', 'Source')}>
          <span className="text-[10px] font-medium text-c-text-secondary">
            {displayLabel(governance.originSummary?.type as string) || '—'}
          </span>
        </Row>

        <Row label={t('rap.outputs.preview.lineage', 'Lineage')}>
          <span className="text-[10px] font-medium text-c-text-secondary">{lineageSummary}</span>
        </Row>

        {/* FALA 1 / „surowe identyfikatory w UI" (2026-07-27): oba wiersze
            wypisywały goły UUID (`Artifact ID: c6c12106-…`). Użytkownik
            biznesowy nie ma z niego nic — identyfikator zostaje dostępny, ale
            pod przyciskiem „Kopiuj ID" (pełna wartość w tooltipie). */}
        <Row label={t('rap.outputs.preview.artifactId', 'Artifact ID')}>
          <CopyIdButton id={artifactId} label={t('rap.outputs.preview.copyId', 'Copy ID')} />
        </Row>

        <Row label={t('rap.outputs.preview.executionRunId', 'Execution run')}>
          <CopyIdButton
            id={governance.executionRunId}
            label={t('rap.outputs.preview.copyId', 'Copy ID')}
          />
          {governance.executionRunId && onTrace ? (
            <button
              type="button"
              onClick={() =>
                onTrace({
                  executionRunId: governance.executionRunId!,
                  lineagePaths: governance.lineagePaths || null,
                })
              }
              className="ml-1.5 inline-flex items-center rounded-full border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-2 py-0.5 text-[9px] font-medium text-c-text-secondary hover:bg-c-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              {t('rap.outputs.preview.trace', 'Trace')}
            </button>
          ) : null}
        </Row>

        {exportFormats && exportFormats.length > 0 ? (
          <Row label={t('rap.outputs.preview.exports', 'Exports')}>
            <span className="text-[10px] font-medium text-c-text-secondary">
              {exportFormats.join(', ').toUpperCase()}
            </span>
          </Row>
        ) : null}

        <Row label={t('rap.outputs.preview.exportTrace', 'Export trace')}>
          <span className="text-[10px] font-medium text-c-text-secondary">{exportTraceText}</span>
        </Row>

        <Row label={t('rap.outputs.preview.accessControl', 'Access control')}>
          <span className="text-[10px] font-medium text-c-text-secondary">
            {typeof governance.canManageAccess === 'boolean'
              ? governance.canManageAccess
                ? t('rap.outputs.preview.canManageAccess', 'Can manage')
                : t('rap.outputs.preview.readOnly', 'Read only')
              : '—'}
          </span>
        </Row>

        <Row label={t('rap.outputs.preview.trustBoundary', 'Trust boundary')}>
          <span className="text-[10px] font-medium text-c-text-secondary">
            {t('rap.outputs.preview.executionAuthority', 'Execution')}:{' '}
            {authorityLabel(governance.executionAuthority)}
            {' · '}
            {t('rap.outputs.preview.reviewAuthority', 'Review')}:{' '}
            {authorityLabel(governance.reviewAuthority)}
          </span>
        </Row>

        <Row label={t('rap.outputs.preview.validationChecks', 'Validation checks')}>
          <span className="text-[10px] font-medium text-c-text-secondary">
            {validationChecksText}
          </span>
        </Row>
      </div>
    </div>
  );
};

/**
 * Identyfikator techniczny NIGDY nie jest treścią — jest akcją.
 * Brak identyfikatora → zwykły myślnik (bez martwego przycisku).
 */
const CopyIdButton: React.FC<{ id?: string | null; label: string }> = ({ id, label }) => {
  if (!id) return <span className="text-[10px] text-c-text-muted">—</span>;
  return (
    <button
      type="button"
      title={id}
      onClick={() => {
        void navigator.clipboard?.writeText(id);
      }}
      className="inline-flex items-center gap-1 rounded-full border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-2 py-0.5 text-[9px] font-medium text-c-text-secondary hover:bg-c-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
    >
      <Copy size={9} />
      {label}
    </button>
  );
};

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center gap-2">
    <span className="text-[10px] text-c-text-muted w-24 shrink-0">{label}</span>
    <div className="flex items-center gap-1 flex-wrap min-w-0">{children}</div>
  </div>
);
