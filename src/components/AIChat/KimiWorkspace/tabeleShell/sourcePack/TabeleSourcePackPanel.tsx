/**
 * TabeleSourcePackPanel — orchestrator panel rendered in the right rail
 * when the user clicks the Source Pack icon in `<TabeleRightRail>`.
 *
 * Responsibilities (Block C · EPIC-T12 · Sprint C-S6):
 *   1. Search & filter records the actor can read (verified-only,
 *      recency).
 *   2. Curator picks candidates → selection list shows running tally.
 *   3. "Save pack" persists the bundle (V8 snapshot captured server-side).
 *   4. Side list of existing packs for reuse — each pack can be re-opened
 *      in the AI Editor as `payload.sourcePackId` via the optional
 *      `onUseInAiEditor` callback.
 *
 * Cross-tenant safety + ranking are enforced server-side; this component
 * never trusts that the candidate list is filtered.
 */

import { Loader2, RefreshCw, Save, Search, ShieldCheck, Sparkles } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  createSourcePack,
  findSourcePackCandidates,
  listSourcePacksForTable,
  type SourcePack,
  type SourcePackCandidate,
} from '@/services/api/tablePlatform.api';

import { SourceCandidateCard } from './SourceCandidateCard';

const MAX_PACK_RECORDS = 200;
const SEARCH_DEBOUNCE_MS = 300;

function useRecencyOptions(
  t: (key: string, def: string) => string
): Array<{ value: number | null; label: string }> {
  return useMemo(
    () => [
      { value: null, label: t('kimi.tabeleShell.sourcePack.recencyAny', 'Any time') },
      { value: 7, label: t('kimi.tabeleShell.sourcePack.recency7', 'Last 7 days') },
      { value: 30, label: t('kimi.tabeleShell.sourcePack.recency30', 'Last 30 days') },
      { value: 90, label: t('kimi.tabeleShell.sourcePack.recency90', 'Last 90 days') },
    ],
    [t]
  );
}

export interface TabeleSourcePackPanelProps {
  tableId: string;
  workspaceId: string;
  /** Callback invoked when the user picks a saved pack to feed into the AI
   *  Editor. The right-rail orchestrator wires this to switch panels and
   *  prefill `payload.sourcePackId`. */
  onUseInAiEditor?: (pack: SourcePack) => void;
  /** Test seam: when set, skip network calls for candidates. */
  testInitialCandidates?: SourcePackCandidate[] | null;
  /** Test seam: when set, skip network calls for saved packs. */
  testInitialPacks?: SourcePack[] | null;
}

export const TabeleSourcePackPanel: React.FC<TabeleSourcePackPanelProps> = ({
  tableId,
  workspaceId,
  onUseInAiEditor,
  testInitialCandidates,
  testInitialPacks,
}) => {
  const { t } = useTranslation();
  const recencyOptions = useRecencyOptions(t);
  const [query, setQuery] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [recencyDays, setRecencyDays] = useState<number | null>(null);
  const [candidates, setCandidates] = useState<SourcePackCandidate[]>(testInitialCandidates ?? []);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [packName, setPackName] = useState('');
  const [packDescription, setPackDescription] = useState('');
  const [savingPack, setSavingPack] = useState(false);
  const [savedPacks, setSavedPacks] = useState<SourcePack[]>(testInitialPacks ?? []);
  const [packsLoading, setPacksLoading] = useState(testInitialPacks === undefined);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const useNetwork = testInitialCandidates === undefined;
  const useNetworkPacks = testInitialPacks === undefined;

  const refreshCandidates = useCallback(async () => {
    if (!tableId || !useNetwork) return;
    setSearching(true);
    try {
      const list = await findSourcePackCandidates(tableId, {
        query: query.trim() || undefined,
        verifiedOnly,
        recencyDays,
        limit: 25,
      });
      setCandidates(list);
    } catch (e) {
      toast.error(
        t('kimi.tabeleShell.sourcePack.searchFailed', {
          defaultValue: 'Failed to search records: {{reason}}',
          reason: (e as Error)?.message ?? t('kimi.tabeleShell.sourcePack.unknownError', 'unknown'),
        })
      );
    } finally {
      setSearching(false);
    }
  }, [tableId, query, verifiedOnly, recencyDays, useNetwork, t]);

  const refreshPacks = useCallback(async () => {
    if (!tableId || !useNetworkPacks) return;
    setPacksLoading(true);
    try {
      const list = await listSourcePacksForTable(tableId, { limit: 25 });
      setSavedPacks(list);
    } catch (e) {
      toast.error(
        t('kimi.tabeleShell.sourcePack.listPacksFailed', {
          defaultValue: 'Failed to list packs: {{reason}}',
          reason: (e as Error)?.message ?? t('kimi.tabeleShell.sourcePack.unknownError', 'unknown'),
        })
      );
    } finally {
      setPacksLoading(false);
    }
  }, [tableId, useNetworkPacks, t]);

  // Debounced search.
  useEffect(() => {
    if (!useNetwork) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void refreshCandidates();
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [refreshCandidates, useNetwork]);

  // Initial pack list load.
  useEffect(() => {
    if (!useNetworkPacks) return;
    void refreshPacks();
  }, [refreshPacks, useNetworkPacks]);

  const handleToggle = useCallback(
    (recordId: string) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(recordId)) next.delete(recordId);
        else if (next.size < MAX_PACK_RECORDS) next.add(recordId);
        else
          toast.error(
            t('kimi.tabeleShell.sourcePack.packLimit', {
              defaultValue: 'A pack can hold at most {{max}} records',
              max: MAX_PACK_RECORDS,
            })
          );
        return next;
      });
    },
    [t]
  );

  const handleSavePack = useCallback(async () => {
    if (!tableId) return;
    if (!packName.trim()) {
      toast.error(t('kimi.tabeleShell.sourcePack.nameRequired', 'Pack name is required'));
      return;
    }
    if (selected.size === 0) {
      toast.error(
        t('kimi.tabeleShell.sourcePack.atLeastOneRecord', 'Add at least one record to the pack')
      );
      return;
    }
    setSavingPack(true);
    try {
      const pack = await createSourcePack({
        tableId,
        workspaceId,
        name: packName.trim(),
        description: packDescription.trim() || undefined,
        candidateRecordIds: Array.from(selected),
      });
      toast.success(
        t('kimi.tabeleShell.sourcePack.saved', {
          defaultValue: 'Pack "{{name}}" saved ({{count}} records)',
          name: pack.name,
          count: pack.candidateRecordIds.length,
        })
      );
      setPackName('');
      setPackDescription('');
      setSelected(new Set());
      setSavedPacks((prev) => [pack, ...prev]);
    } catch (e) {
      toast.error(
        t('kimi.tabeleShell.sourcePack.saveFailed', {
          defaultValue: 'Failed to save pack: {{reason}}',
          reason: (e as Error)?.message ?? t('kimi.tabeleShell.sourcePack.unknownError', 'unknown'),
        })
      );
    } finally {
      setSavingPack(false);
    }
  }, [tableId, workspaceId, packName, packDescription, selected, t]);

  const selectedCount = selected.size;
  const candidateLimitReached = selectedCount >= MAX_PACK_RECORDS;

  const sortedCandidates = useMemo(
    () =>
      [...candidates].sort((a, b) => {
        const aSelected = selected.has(a.recordId) ? 1 : 0;
        const bSelected = selected.has(b.recordId) ? 1 : 0;
        if (aSelected !== bSelected) return bSelected - aSelected;
        return b.rankScore - a.rankScore;
      }),
    [candidates, selected]
  );

  return (
    <section
      className="flex h-full flex-col gap-3 p-3"
      data-testid="tabele-source-pack-panel"
      aria-label={t('kimi.tabeleShell.sourcePack.ariaLabel', 'Tabele source pack builder')}
    >
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-c-text">
          {t('kimi.tabeleShell.sourcePack.title', 'Source Pack')}
        </h3>
        <button
          type="button"
          onClick={() => void refreshCandidates()}
          disabled={searching || !tableId}
          className="inline-flex items-center gap-1 rounded-md border border-c-border-subtle bg-c-surface-raised px-2 py-1 text-xs text-c-text hover:bg-c-surface-raised disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          data-testid="source-pack-refresh"
          aria-label={t('kimi.tabeleShell.sourcePack.refreshAriaLabel', 'Refresh candidate search')}
        >
          {searching ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          {t('kimi.tabeleShell.sourcePack.refresh', 'Refresh')}
        </button>
      </header>

      <div className="space-y-2">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-c-text-secondary" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(
              'kimi.tabeleShell.sourcePack.searchPlaceholder',
              'Search records by content'
            )}
            className="w-full rounded-md border border-c-border-subtle bg-c-surface py-1.5 pl-7 pr-2 text-xs text-c-text placeholder:text-c-text-muted focus:outline-none focus:ring-1 focus:ring-c-border"
            data-testid="source-pack-search-input"
            aria-label={t('kimi.tabeleShell.sourcePack.searchAriaLabel', 'Search records')}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1 text-[11px] text-c-text-secondary">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(e) => setVerifiedOnly(e.target.checked)}
              className="h-3 w-3"
              data-testid="source-pack-verified-only"
            />
            <ShieldCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            {t('kimi.tabeleShell.sourcePack.verifiedOnly', 'verified only')}
          </label>
          <select
            value={recencyDays === null ? '' : String(recencyDays)}
            onChange={(e) => setRecencyDays(e.target.value === '' ? null : Number(e.target.value))}
            className="rounded-md border border-c-border-subtle bg-c-surface px-1.5 py-0.5 text-[11px] text-c-text"
            data-testid="source-pack-recency-select"
            aria-label={t('kimi.tabeleShell.sourcePack.recencyAriaLabel', 'Recency filter')}
          >
            {recencyOptions.map((opt) => (
              <option key={String(opt.value)} value={opt.value === null ? '' : opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="ml-auto text-[11px] text-c-text-secondary">
            {t('kimi.tabeleShell.sourcePack.selectedCount', {
              defaultValue: '{{count}} / {{max}} selected',
              count: selectedCount,
              max: MAX_PACK_RECORDS,
            })}
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {searching && candidates.length === 0 ? (
          <div className="flex items-center justify-center p-4 text-xs text-c-text-secondary">
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />{' '}
            {t('kimi.tabeleShell.sourcePack.searching', 'Searching…')}
          </div>
        ) : sortedCandidates.length === 0 ? (
          <div
            className="rounded-md border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-xs text-c-text-secondary"
            data-testid="source-pack-candidates-empty"
          >
            {t(
              'kimi.tabeleShell.sourcePack.noCandidates',
              'No candidate records match your filters.'
            )}
          </div>
        ) : (
          <ul className="space-y-2" data-testid="source-pack-candidate-list">
            {sortedCandidates.map((c) => (
              <SourceCandidateCard
                key={c.recordId}
                candidate={c}
                selected={selected.has(c.recordId)}
                onToggle={handleToggle}
                disableAdd={candidateLimitReached}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-md border border-c-border-subtle bg-c-surface-raised p-2">
        <h4 className="mb-1 text-[11px] uppercase tracking-wide text-c-text-secondary">
          {t('kimi.tabeleShell.sourcePack.savePack', 'Save pack')}
        </h4>
        <div className="space-y-1.5">
          <input
            type="text"
            value={packName}
            onChange={(e) => setPackName(e.target.value)}
            placeholder={t('kimi.tabeleShell.sourcePack.packNamePlaceholder', 'Pack name')}
            maxLength={200}
            className="w-full rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 text-xs text-c-text"
            data-testid="source-pack-name-input"
            aria-label={t('kimi.tabeleShell.sourcePack.packNameAriaLabel', 'Pack name')}
          />
          <textarea
            value={packDescription}
            onChange={(e) => setPackDescription(e.target.value)}
            placeholder={t(
              'kimi.tabeleShell.sourcePack.descriptionPlaceholder',
              'Optional description'
            )}
            rows={2}
            maxLength={2000}
            className="w-full resize-none rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 text-xs text-c-text"
            data-testid="source-pack-description-input"
            aria-label={t('kimi.tabeleShell.sourcePack.descriptionAriaLabel', 'Pack description')}
          />
          <button
            type="button"
            onClick={() => void handleSavePack()}
            disabled={savingPack || selectedCount === 0 || !packName.trim()}
            className="inline-flex items-center justify-center gap-1 w-full rounded-md border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 text-xs text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            data-testid="source-pack-save-button"
          >
            {savingPack ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3" />
            )}
            {t('kimi.tabeleShell.sourcePack.savePack', 'Save pack')}
          </button>
        </div>
      </div>

      <div>
        <h4 className="mb-1 text-[11px] uppercase tracking-wide text-c-text-secondary">
          {t('kimi.tabeleShell.sourcePack.savedPacks', 'Saved packs')}
        </h4>
        {packsLoading ? (
          <div className="flex items-center gap-1 px-2 py-1 text-xs text-c-text-secondary">
            <Loader2 className="h-3 w-3 animate-spin" />{' '}
            {t('kimi.tabeleShell.sourcePack.loading', 'Loading…')}
          </div>
        ) : savedPacks.length === 0 ? (
          <div
            className="rounded-md border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-xs text-c-text-secondary"
            data-testid="source-pack-saved-empty"
          >
            {t('kimi.tabeleShell.sourcePack.noSavedPacks', 'No saved packs yet.')}
          </div>
        ) : (
          <ul className="space-y-1.5" data-testid="source-pack-saved-list">
            {savedPacks.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-md border border-c-border-subtle bg-c-surface px-2.5 py-1.5"
                data-testid="source-pack-saved-card"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-c-text" title={p.name}>
                    {p.name}
                  </p>
                  <p className="text-[11px] text-c-text-secondary">
                    {t('kimi.tabeleShell.sourcePack.packMeta', {
                      defaultValue: '{{count}} records · used {{used}}×',
                      count: p.candidateRecordIds.length,
                      used: p.usedCount,
                    })}
                  </p>
                </div>
                {onUseInAiEditor && (
                  <button
                    type="button"
                    onClick={() => onUseInAiEditor(p)}
                    className="inline-flex items-center gap-1 rounded-md border border-c-border-subtle bg-c-surface-raised px-2 py-1 text-[11px] text-c-text hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                    data-testid="source-pack-use-in-ai"
                    aria-label={t(
                      'kimi.tabeleShell.sourcePack.useInAiEditorAriaLabel',
                      'Use pack in AI Editor'
                    )}
                  >
                    <Sparkles className="h-3 w-3" /> {t('kimi.tabeleShell.sourcePack.use', 'Use')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default TabeleSourcePackPanel;
