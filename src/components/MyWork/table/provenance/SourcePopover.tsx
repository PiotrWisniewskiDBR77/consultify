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
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const active = sources.filter((s) => s.archived_at === null);
  const atCap = active.length >= MAX_SOURCES_PER_RECORD;

  return (
    <div
      data-testid={testId}
      className="w-[360px] max-w-[90vw] rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-xl"
      role="dialog"
      aria-label={isPl ? 'Źródła rekordu' : 'Record sources'}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-navy-700">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {isPl ? 'Pochodzenie' : 'Provenance'}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {active.length}/{MAX_SOURCES_PER_RECORD}
            {' · '}
            {isPl
              ? 'Aktywne źródła wpływające na pewność AI.'
              : 'Active sources influencing AI confidence.'}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-slate-600 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-400 rounded p-0.5"
            aria-label={isPl ? 'Zamknij' : 'Close'}
            data-testid={`${testId}-close`}
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="max-h-[320px] overflow-y-auto px-2 py-2">
        {loading && (
          <p className="text-[12px] text-slate-500 px-2 py-1">
            {isPl ? 'Wczytywanie…' : 'Loading…'}
          </p>
        )}
        {!loading && error && (
          <p
            className="text-[12px] text-danger-600 dark:text-danger-300 px-2 py-1"
            role="alert"
            data-testid={`${testId}-error`}
          >
            {error}
          </p>
        )}
        {!loading && !error && active.length === 0 && (
          <p
            className="text-[12px] text-slate-500 px-2 py-3 text-center"
            data-testid={`${testId}-empty`}
          >
            {isPl
              ? 'Brak aktywnych źródeł — dodaj pierwsze, aby zwiększyć pewność AI.'
              : 'No active sources yet — add one to raise AI confidence.'}
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
                className="group flex items-start gap-2 px-2 py-2 rounded-md hover:bg-slate-50 dark:hover:bg-navy-800/50"
              >
                <span className="mt-0.5 text-slate-500 dark:text-slate-300" aria-hidden>
                  {sourceIcon(source.source_type)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-100">
                      {label}
                    </span>
                    {source.confidence_contribution != null && (
                      <span
                        className="text-[10px] tabular-nums text-slate-500 dark:text-slate-400"
                        aria-label={isPl ? 'Wkład w pewność' : 'Confidence contribution'}
                      >
                        · {Math.round(Number(source.confidence_contribution) * 100)}%
                      </span>
                    )}
                    {verifiedRecently && (
                      <span
                        className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300"
                        aria-label={isPl ? 'Niedawno zweryfikowano' : 'Recently verified'}
                      >
                        {isPl ? '✓ świeże' : '✓ fresh'}
                      </span>
                    )}
                  </div>
                  {source.source_uri && (
                    <a
                      className="block text-[11px] text-primary-600 dark:text-primary-300 truncate hover:underline"
                      href={source.source_uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={source.source_uri}
                    >
                      {source.source_uri}
                    </a>
                  )}
                  <p className="text-[10px] text-slate-600 mt-0.5">
                    {isPl ? 'Dodał' : 'Added by'} {source.created_by} · {fmtDate(source.created_at)}
                    {source.last_verified_at && (
                      <>
                        {' · '}
                        {isPl ? 'zweryfikowano' : 'verified'} {fmtDate(source.last_verified_at)}
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
                        className="p-1 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                        title={isPl ? 'Zweryfikuj teraz' : 'Verify now'}
                        aria-label={isPl ? 'Zweryfikuj' : 'Verify'}
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
                        className="p-1 rounded hover:bg-danger-50 dark:hover:bg-danger-900/30 text-danger-700 dark:text-danger-300"
                        title={isPl ? 'Archiwizuj' : 'Archive'}
                        aria-label={isPl ? 'Archiwizuj' : 'Archive'}
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
        <div className="px-3 py-2 border-t border-slate-200 dark:border-navy-700 flex items-center justify-between">
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            {atCap
              ? isPl
                ? `Limit ${MAX_SOURCES_PER_RECORD} aktywnych źródeł osiągnięty.`
                : `Reached cap of ${MAX_SOURCES_PER_RECORD} active sources.`
              : isPl
                ? 'Każde nowe źródło zwiększa pewność AI.'
                : 'Every source raises AI confidence.'}
          </p>
          <button
            type="button"
            disabled={atCap}
            onClick={onAddClick}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-navy-900 hover:bg-navy-800 text-white dark:bg-slate-50 dark:text-navy-950 dark:hover:bg-slate-200 disabled:bg-slate-300 disabled:cursor-not-allowed"
            data-testid={`${testId}-add`}
          >
            <Plus size={12} aria-hidden />
            {isPl ? 'Dodaj' : 'Add'}
          </button>
        </div>
      )}
    </div>
  );
};

export default SourcePopover;
