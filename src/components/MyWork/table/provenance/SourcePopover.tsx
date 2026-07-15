/**
 * SourcePopover — Read view of a record's provenance ledger (Block B / T8).
 *
 * Renders a panel with the active sources for a record, plus actions to
 * verify, archive, or open `AddSourceDialog`. Cap (50/record) is read from
 * the API client constant.
 *
 * The component is presentational; the parent fetches `sources` and wires
 * `onVerify`, `onArchive`, `onAddClick`, and `onClose`.
 */

import { BadgeCheck, Database, ExternalLink, FileText, Plus, Trash2, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { RecordSource, SourceType } from '@/services/api/recordProvenance.api';

const MAX_SOURCES_PER_RECORD = 50;

export interface SourcePopoverProps {
  sources: RecordSource[];
  loading?: boolean;
  error?: string | null;
  onVerify?: (source: RecordSource) => Promise<void> | void;
  onArchive?: (source: RecordSource) => Promise<void> | void;
  onAddClick?: () => void;
  onClose?: () => void;
  /** Disable mutating affordances (e.g. the user lacks edit access). */
  readOnly?: boolean;
  testId?: string;
}

const SOURCE_TYPE_LABELS: Record<SourceType, { en: string; pl: string }> = {
  manual: { en: 'Manual', pl: 'Ręcznie' },
  ai_extraction: { en: 'AI extraction', pl: 'Ekstrakcja AI' },
  import: { en: 'Import', pl: 'Import' },
  integration: { en: 'Integration', pl: 'Integracja' },
  system: { en: 'System', pl: 'System' },
};

function sourceIcon(type: SourceType): React.ReactNode {
  switch (type) {
    case 'manual':
      return <FileText size={12} />;
    case 'ai_extraction':
      return <BadgeCheck size={12} />;
    case 'import':
      return <Database size={12} />;
    case 'integration':
      return <ExternalLink size={12} />;
    case 'system':
      return <Database size={12} />;
  }
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString();
  } catch {
    return '';
  }
}

export const SourcePopover: React.FC<SourcePopoverProps> = ({
  sources,
  loading = false,
  error = null,
  onVerify,
  onArchive,
  onAddClick,
  onClose,
  readOnly = false,
  testId = 'provenance-source-popover',
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const active = sources.filter((s) => s.archived_at === null);
  const atCap = active.length >= MAX_SOURCES_PER_RECORD;

  return (
    <div
      data-testid={testId}
      className="w-[360px] max-w-[90vw] rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-xl"
      role="dialog"
      aria-label={t('myWorkTable.sourcePopover.recordSources')}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-c-border-subtle">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-c-text-muted">
            {t('myWorkTable.sourcePopover.provenance')}
          </p>
          <p className="text-[11px] text-c-text-muted">
            {active.length}/{MAX_SOURCES_PER_RECORD}
            {' · '}
            {t('myWorkTable.sourcePopover.activeSourcesInfluencingAiConfidence')}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-c-text-secondary hover:text-c-text-secondary focus:outline-none focus:ring-2 focus:ring-c-focus rounded p-0.5"
            aria-label={t('myWorkTable.sourcePopover.close')}
            data-testid={`${testId}-close`}
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="max-h-[320px] overflow-y-auto px-2 py-2">
        {loading && (
          <p className="text-[12px] text-c-text-muted px-2 py-1">
            {t('myWorkTable.sourcePopover.loading')}
          </p>
        )}
        {!loading && error && (
          <p
            className="text-[12px] text-c-danger px-2 py-1"
            role="alert"
            data-testid={`${testId}-error`}
          >
            {error}
          </p>
        )}
        {!loading && !error && active.length === 0 && (
          <p
            className="text-[12px] text-c-text-muted px-2 py-3 text-center"
            data-testid={`${testId}-empty`}
          >
            {t('myWorkTable.sourcePopover.noActiveSourcesYetAdd')}
          </p>
        )}
        {!loading &&
          !error &&
          active.map((source) => {
            const labelMap = SOURCE_TYPE_LABELS[source.source_type];
            const label = isPl ? labelMap.pl : labelMap.en;
            const verifiedRecently =
              source.last_verified_at != null &&
              Date.now() - new Date(source.last_verified_at).getTime() < 30 * 24 * 60 * 60 * 1000;
            return (
              <div
                key={source.id}
                data-testid={`${testId}-item`}
                className="group flex items-start gap-2 px-2 py-2 rounded-md hover:bg-c-surface-raised"
              >
                <span className="mt-0.5 text-c-text-muted" aria-hidden>
                  {sourceIcon(source.source_type)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold text-c-text">{label}</span>
                    {source.confidence_contribution != null && (
                      <span
                        className="text-[10px] tabular-nums text-c-text-muted"
                        aria-label={t('myWorkTable.sourcePopover.confidenceContribution')}
                      >
                        · {Math.round(Number(source.confidence_contribution) * 100)}%
                      </span>
                    )}
                    {verifiedRecently && (
                      <span
                        className="text-[10px] font-semibold text-c-success"
                        aria-label={t('myWorkTable.sourcePopover.recentlyVerified')}
                      >
                        {t('myWorkTable.sourcePopover.fresh')}
                      </span>
                    )}
                  </div>
                  {source.source_uri && (
                    <a
                      className="block text-[11px] text-c-accent truncate hover:underline"
                      href={source.source_uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={source.source_uri}
                    >
                      {source.source_uri}
                    </a>
                  )}
                  <p className="text-[10px] text-c-text-secondary mt-0.5">
                    {t('myWorkTable.sourcePopover.addedBy')} {source.created_by} ·{' '}
                    {fmtDate(source.created_at)}
                    {source.last_verified_at && (
                      <>
                        {' · '}
                        {t('myWorkTable.sourcePopover.verified')} {fmtDate(source.last_verified_at)}
                      </>
                    )}
                  </p>
                </div>
                {!readOnly && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onVerify && (
                      <button
                        type="button"
                        onClick={() => {
                          void onVerify(source);
                        }}
                        className="p-1 rounded hover:bg-c-success text-c-success"
                        title={t('myWorkTable.sourcePopover.verifyNow')}
                        aria-label={t('myWorkTable.sourcePopover.verify')}
                        data-testid={`${testId}-verify-${source.id}`}
                      >
                        <BadgeCheck size={12} />
                      </button>
                    )}
                    {onArchive && (
                      <button
                        type="button"
                        onClick={() => {
                          void onArchive(source);
                        }}
                        className="p-1 rounded hover:bg-[color-mix(in_srgb,var(--c-danger)_14%,transparent)] text-c-danger"
                        title={t('myWorkTable.sourcePopover.archive')}
                        aria-label={t('myWorkTable.sourcePopover.archive')}
                        data-testid={`${testId}-archive-${source.id}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {!readOnly && onAddClick && (
        <div className="px-3 py-2 border-t border-c-border-subtle flex items-center justify-between">
          <p className="text-[10px] text-c-text-muted">
            {atCap
              ? t('myWorkTable.sourcePopover.reachedCap', { value: MAX_SOURCES_PER_RECORD })
              : t('myWorkTable.sourcePopover.everySourceRaisesAiConfidence')}
          </p>
          <button
            type="button"
            disabled={atCap}
            onClick={onAddClick}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-c-surface hover:bg-c-surface-raised text-c-text bg-c-surface-raised text-c-text-secondary hover:bg-c-border-subtle disabled:bg-c-surface-raised disabled:cursor-not-allowed"
            data-testid={`${testId}-add`}
          >
            <Plus size={12} aria-hidden />
            {t('myWorkTable.sourcePopover.add')}
          </button>
        </div>
      )}
    </div>
  );
};

export default SourcePopover;
