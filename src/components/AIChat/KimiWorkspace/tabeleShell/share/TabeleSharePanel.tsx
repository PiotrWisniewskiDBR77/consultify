/**
 * TabeleSharePanel — orchestrator panel rendered in the right rail when
 * the user clicks the Share icon in `<TabeleRightRail>`.
 *
 * Block D · EPIC-T13 · Sprint D-S3.
 *
 * Per CTO Q15, this panel hosts the Tabele lane "Convert to Document /
 * Convert to Presentation" controls in addition to whatever future share
 * actions ship later. The decision to reuse the existing `share` tool —
 * rather than introduce a new `conversions` tool in the right-rail
 * taxonomy — is locked in `00_CTO_DECISIONS.md` Q15.
 *
 * Behaviour:
 *   - Optional source pack picker — when the user has saved packs for
 *     this table, the panel offers them as a "use this snapshot" option
 *     before triggering a conversion. When no pack is selected, the
 *     conversion captures a fresh snapshot from the live records.
 *   - Title + outline are optional. The conversion service applies sane
 *     defaults if either is omitted.
 *   - Recent conversions list shows the most recent 5 runs with status,
 *     target, and (when succeeded) a deep link to the produced artifact.
 *
 * The panel is intentionally side-effect free until the user clicks
 * "Convert"; opening it does NOT trigger any backend call. (The recent
 * conversions list is loaded lazily.)
 */

import { ExternalLink, FileText, Loader2, Presentation, RefreshCw, Send } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  convertTable,
  listSourcePacksForTable,
  listTableConversions,
  type SourcePack,
  type TableConversionRecord,
  type TableConversionTarget,
} from '@/services/api/tablePlatform.api';

const MAX_TITLE_CHARS = 200;
const RECENT_CONVERSIONS_LIMIT = 5;

export interface TabeleSharePanelProps {
  tableId: string;
  workspaceId: string;
  /** Test seam: when set, skip network calls for source packs. */
  testInitialPacks?: SourcePack[] | null;
  /** Test seam: when set, skip network calls for conversions. */
  testInitialConversions?: TableConversionRecord[] | null;
  /** Test seam: forces the panel into a particular mode without network. */
  forceEnableForTesting?: boolean;
}

function useTargetOptions(t: (key: string, def: string) => string): Array<{
  value: TableConversionTarget;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  description: string;
}> {
  return useMemo(
    () => [
      {
        value: 'document',
        label: t('kimi.tabeleShell.share.targetDocument', 'Document'),
        Icon: FileText,
        description: t(
          'kimi.tabeleShell.share.targetDocumentDescription',
          'Open in Wordy with section outline'
        ),
      },
      {
        value: 'presentation',
        label: t('kimi.tabeleShell.share.targetPresentation', 'Presentation'),
        Icon: Presentation,
        description: t(
          'kimi.tabeleShell.share.targetPresentationDescription',
          'Open in Prezentacje with slide outline'
        ),
      },
    ],
    [t]
  );
}

function useStatusTone(
  t: (key: string, def: string) => string
): (status: TableConversionRecord['status']) => { className: string; label: string } {
  return useCallback(
    (status: TableConversionRecord['status']) => {
      switch (status) {
        case 'succeeded':
          return {
            className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200',
            label: t('kimi.tabeleShell.share.statusDone', 'Done'),
          };
        case 'failed':
          return {
            className: 'bg-danger-50 text-danger-700 dark:bg-danger-900 dark:text-danger-200',
            label: t('kimi.tabeleShell.share.statusFailed', 'Failed'),
          };
        case 'running':
          return {
            className: 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-200',
            label: t('kimi.tabeleShell.share.statusRunning', 'Running'),
          };
        case 'queued':
          return {
            className: 'bg-c-surface-raised text-c-text',
            label: t('kimi.tabeleShell.share.statusQueued', 'Queued'),
          };
        case 'cancelled':
          return {
            className: 'bg-c-surface-raised text-c-text-secondary',
            label: t('kimi.tabeleShell.share.statusCancelled', 'Cancelled'),
          };
        default:
          return {
            className: 'bg-c-surface-raised text-c-text-secondary',
            label: String(status),
          };
      }
    },
    [t]
  );
}

export const TabeleSharePanel: React.FC<TabeleSharePanelProps> = ({
  tableId,
  workspaceId,
  testInitialPacks,
  testInitialConversions,
}) => {
  const { t } = useTranslation();
  const targetOptions = useTargetOptions(t);
  const statusTone = useStatusTone(t);
  const [target, setTarget] = useState<TableConversionTarget>('document');
  const [sourcePackId, setSourcePackId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [packs, setPacks] = useState<SourcePack[]>(testInitialPacks ?? []);
  const [packsLoading, setPacksLoading] = useState(testInitialPacks === undefined);
  const [conversions, setConversions] = useState<TableConversionRecord[]>(
    testInitialConversions ?? []
  );
  const [conversionsLoading, setConversionsLoading] = useState(
    testInitialConversions === undefined
  );

  const useNetworkPacks = testInitialPacks === undefined;
  const useNetworkConversions = testInitialConversions === undefined;

  const refreshPacks = useCallback(async () => {
    if (!tableId || !useNetworkPacks) return;
    setPacksLoading(true);
    try {
      const list = await listSourcePacksForTable(tableId, { limit: 25 });
      setPacks(list);
    } catch (e) {
      toast.error(
        t('kimi.tabeleShell.share.listPacksFailed', {
          defaultValue: 'Failed to list packs: {{reason}}',
          reason: (e as Error)?.message ?? t('kimi.tabeleShell.share.unknownError', 'unknown'),
        })
      );
    } finally {
      setPacksLoading(false);
    }
  }, [tableId, useNetworkPacks, t]);

  const refreshConversions = useCallback(async () => {
    if (!tableId || !useNetworkConversions) return;
    setConversionsLoading(true);
    try {
      const list = await listTableConversions(tableId, { limit: RECENT_CONVERSIONS_LIMIT });
      setConversions(list);
    } catch (e) {
      toast.error(
        t('kimi.tabeleShell.share.listConversionsFailed', {
          defaultValue: 'Failed to list conversions: {{reason}}',
          reason: (e as Error)?.message ?? t('kimi.tabeleShell.share.unknownError', 'unknown'),
        })
      );
    } finally {
      setConversionsLoading(false);
    }
  }, [tableId, useNetworkConversions, t]);

  useEffect(() => {
    void refreshPacks();
  }, [refreshPacks]);

  useEffect(() => {
    void refreshConversions();
  }, [refreshConversions]);

  const handleConvert = useCallback(async () => {
    if (!tableId) return;
    if (title.length > MAX_TITLE_CHARS) {
      toast.error(
        t('kimi.tabeleShell.share.titleTooLong', {
          defaultValue: 'Title must be {{max}} characters or fewer',
          max: MAX_TITLE_CHARS,
        })
      );
      return;
    }
    setSubmitting(true);
    try {
      const result = await convertTable(tableId, {
        workspaceId,
        target,
        sourcePackId: sourcePackId ?? undefined,
        title: title.trim() || undefined,
      });
      if (result.status === 'failed') {
        toast.error(
          t(
            'kimi.tabeleShell.share.conversionFailed',
            'Conversion failed. See recent conversions for details.'
          )
        );
      } else if (result.status === 'succeeded') {
        toast.success(
          t('kimi.tabeleShell.share.convertedTo', {
            defaultValue: 'Converted to {{target}}',
            target,
          })
        );
      } else {
        toast(
          t('kimi.tabeleShell.share.conversionStatus', {
            defaultValue: 'Conversion {{status}}',
            status: result.status,
          })
        );
      }
      // Optimistically refresh the recent conversions list.
      void refreshConversions();
    } catch (e) {
      toast.error(
        t('kimi.tabeleShell.share.convertFailed', {
          defaultValue: 'Failed to convert: {{reason}}',
          reason: (e as Error)?.message ?? t('kimi.tabeleShell.share.unknownError', 'unknown'),
        })
      );
    } finally {
      setSubmitting(false);
    }
  }, [tableId, workspaceId, target, sourcePackId, title, refreshConversions, t]);

  const sortedPacks = useMemo(
    () => [...packs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [packs]
  );

  return (
    <section
      className="flex h-full flex-col gap-3 p-3"
      data-testid="tabele-share-panel"
      aria-label={t('kimi.tabeleShell.share.ariaLabel', 'Tabele share and conversions')}
    >
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-c-text">
          {t('kimi.tabeleShell.share.title', 'Share')}
        </h3>
        <button
          type="button"
          onClick={() => {
            void refreshConversions();
            void refreshPacks();
          }}
          disabled={submitting || conversionsLoading || !tableId}
          className="inline-flex items-center gap-1 rounded-md border border-c-border-subtle bg-c-surface-raised px-2 py-1 text-xs text-c-text hover:bg-c-surface-raised disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          data-testid="share-panel-refresh"
          aria-label={t('kimi.tabeleShell.share.refreshAriaLabel', 'Refresh share panel')}
        >
          {conversionsLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          {t('kimi.tabeleShell.share.refresh', 'Refresh')}
        </button>
      </header>

      <fieldset className="rounded-md border border-c-border-subtle bg-c-surface p-2">
        <legend className="px-1 text-[11px] uppercase tracking-wide text-c-text-secondary">
          {t('kimi.tabeleShell.share.convertTo', 'Convert to')}
        </legend>
        <div
          className="mt-1 grid grid-cols-2 gap-2"
          role="radiogroup"
          aria-label={t('kimi.tabeleShell.share.conversionTargetAriaLabel', 'Conversion target')}
        >
          {targetOptions.map((opt) => {
            const checked = target === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => setTarget(opt.value)}
                data-testid={`share-target-${opt.value}`}
                className={`flex items-start gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
                  checked
                    ? 'border-sky-500 bg-sky-50 text-sky-900 dark:border-sky-400 dark:bg-sky-950 dark:text-sky-100'
                    : 'border-c-border-subtle bg-c-surface text-c-text hover:bg-c-surface-raised'
                }`}
              >
                <opt.Icon className="mt-0.5 h-3.5 w-3.5 flex-none" />
                <span className="flex flex-col">
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-[10px] text-c-text-secondary">{opt.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-[11px] uppercase tracking-wide text-c-text-secondary">
          {t('kimi.tabeleShell.share.titleLabel', 'Title (optional)')}
        </span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={MAX_TITLE_CHARS}
          placeholder={t('kimi.tabeleShell.share.titlePlaceholder', {
            defaultValue: 'e.g. {{example}}',
            example:
              target === 'document'
                ? t('kimi.tabeleShell.share.titlePlaceholderDoc', 'Initiative briefing')
                : t('kimi.tabeleShell.share.titlePlaceholderDeck', 'Initiative deck'),
          })}
          className="mt-1 w-full rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 text-xs text-c-text placeholder:text-c-text-muted focus:outline-none focus:ring-1 focus:ring-c-border"
          data-testid="share-title-input"
          aria-label={t('kimi.tabeleShell.share.titleAriaLabel', 'Conversion title')}
        />
      </label>

      <fieldset className="rounded-md border border-c-border-subtle bg-c-surface-raised p-2">
        <legend className="px-1 text-[11px] uppercase tracking-wide text-c-text-secondary">
          {t('kimi.tabeleShell.share.sourceSnapshot', 'Source snapshot')}
        </legend>
        <div className="mt-1 space-y-1.5">
          <label className="flex items-center gap-2 text-xs text-c-text">
            <input
              type="radio"
              name="source-snapshot"
              value=""
              checked={sourcePackId === null}
              onChange={() => setSourcePackId(null)}
              data-testid="share-snapshot-live"
            />
            <span>
              <span className="font-medium">
                {t('kimi.tabeleShell.share.liveRecords', 'Live records')}
              </span>{' '}
              <span className="text-[10px] text-c-text-secondary">
                {t(
                  'kimi.tabeleShell.share.liveRecordsHint',
                  'Capture a fresh snapshot at conversion time'
                )}
              </span>
            </span>
          </label>
          {packsLoading ? (
            <div className="flex items-center gap-1 text-[11px] text-c-text-secondary">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('kimi.tabeleShell.share.loadingPacks', 'Loading saved packs…')}
            </div>
          ) : sortedPacks.length === 0 ? (
            <div className="text-[11px] text-c-text-secondary">
              {t('kimi.tabeleShell.share.noPacksYet', 'No saved source packs for this table yet.')}
            </div>
          ) : (
            sortedPacks.map((pack) => (
              <label key={pack.id} className="flex items-start gap-2 text-xs text-c-text">
                <input
                  type="radio"
                  name="source-snapshot"
                  value={pack.id}
                  checked={sourcePackId === pack.id}
                  onChange={() => setSourcePackId(pack.id)}
                  data-testid={`share-snapshot-pack-${pack.id}`}
                />
                <span className="flex flex-col">
                  <span className="font-medium">{pack.name}</span>
                  <span className="text-[10px] text-c-text-secondary">
                    {t('kimi.tabeleShell.share.packMeta', {
                      defaultValue: '{{count}} records · used {{used}}x',
                      count: pack.candidateRecordIds.length,
                      used: pack.usedCount,
                    })}
                  </span>
                </span>
              </label>
            ))
          )}
        </div>
      </fieldset>

      <button
        type="button"
        onClick={() => void handleConvert()}
        disabled={submitting || !tableId}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-c-text shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-c-border dark:disabled:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        data-testid="share-convert-submit"
        aria-label={t('kimi.tabeleShell.share.convertAriaLabel', 'Convert table')}
      >
        {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
        {submitting
          ? t('kimi.tabeleShell.share.converting', 'Converting…')
          : t('kimi.tabeleShell.share.convertSubmit', {
              defaultValue: 'Convert to {{target}}',
              target:
                target === 'document'
                  ? t('kimi.tabeleShell.share.targetDocument', 'Document')
                  : t('kimi.tabeleShell.share.targetPresentation', 'Presentation'),
            })}
      </button>

      <div className="rounded-md border border-c-border-subtle bg-c-surface-raised p-2">
        <h4 className="mb-1 text-[11px] uppercase tracking-wide text-c-text-secondary">
          {t('kimi.tabeleShell.share.recentConversions', 'Recent conversions')}
        </h4>
        {conversionsLoading ? (
          <div className="flex items-center gap-1 text-[11px] text-c-text-secondary">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t('kimi.tabeleShell.share.loading', 'Loading…')}
          </div>
        ) : conversions.length === 0 ? (
          <div className="text-[11px] text-c-text-secondary" data-testid="share-conversions-empty">
            {t('kimi.tabeleShell.share.noConversionsYet', 'No conversions yet.')}
          </div>
        ) : (
          <ul className="space-y-1.5" data-testid="share-conversions-list">
            {conversions.map((conv) => {
              const tone = statusTone(conv.status);
              return (
                <li key={conv.id} className="flex items-center gap-2 text-xs text-c-text">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tone.className}`}
                    aria-label={t('kimi.tabeleShell.share.statusAriaLabel', {
                      defaultValue: 'Status: {{status}}',
                      status: tone.label,
                    })}
                  >
                    {tone.label}
                  </span>
                  <span className="flex-1 truncate">
                    {conv.title ??
                      t('kimi.tabeleShell.share.conversionFallbackTitle', {
                        defaultValue: '{{target}} — {{id}}',
                        target:
                          conv.target === 'document'
                            ? t('kimi.tabeleShell.share.targetDocument', 'Document')
                            : t('kimi.tabeleShell.share.targetPresentation', 'Presentation'),
                        id: conv.id.slice(0, 8),
                      })}
                  </span>
                  {conv.artifactDeepLink ? (
                    <a
                      href={conv.artifactDeepLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-sky-600 dark:text-sky-400 hover:underline"
                      data-testid={`share-conversion-link-${conv.id}`}
                      aria-label={t(
                        'kimi.tabeleShell.share.openConversionResult',
                        'Open conversion result'
                      )}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};

export default TabeleSharePanel;
