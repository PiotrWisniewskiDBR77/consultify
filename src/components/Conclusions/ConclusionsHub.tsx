/**
 * ConclusionsHub — org-wide surface for the Conclusions layer.
 *
 * The Conclusions infra (ConclusionService, tool/assessment bridges, routes) has
 * been live since OXFORD #41, but users had nowhere to see it. This hub is that
 * surface: a governed list of conclusions (verdict / rationale / evidence / source)
 * with source + confidence filters, and a per-conclusion readout detail reached
 * via `?id=`.
 *
 * 1.1-Z3 #1 (DECYZJA CTO: odczyt nie może pisać): `GET /api/conclusions` no
 * longer lazily syncs interview/assessment/tool sources on every read (that
 * side effect moved to `POST /api/conclusions/sync`, guarded by the same
 * permission check as the existing write route). This hub is the one caller
 * that needs a fresh sync, so it calls `ConclusionsApi.sync()` explicitly once
 * on entry, then `ConclusionsApi.list()` — and again on demand via the
 * "Refresh" button. A sync failure (e.g. 403 — no write permission) is
 * swallowed: the list still loads from whatever is already in the database.
 *
 * States use the shared canon (EmptyState variants new/filter/error + LoadingState).
 * Tokens: var(--c-*) only.
 */

import { RefreshCw, Sparkles } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Menu3Chip } from '@/components/shared/ModuleMenu3';
import { EmptyState, LoadingState } from '@/components/shared/states';
import { ROUTES } from '@/routes/routeConfig';
import {
  type Conclusion,
  type ConclusionDetail,
  ConclusionsApi,
} from '@/services/api/conclusions.api';

import { ConclusionCard } from './ConclusionCard';
import { sourceLabel } from './conclusionMeta';
import { ConclusionReadout } from './ConclusionReadout';

type LoadState = 'loading' | 'ready' | 'error';

// 1.1-Z4 #2: aktywny chip filtra źródła miał wypełnienie mapujące się na
// crimson marki #85182F (pułapka #1 kanonu — czerwień tylko dla semantyki
// krytycznej). Stan aktywny chipa filtra to zwykły stan wyboru, nie
// ostrzeżenie — używamy tego samego `Menu3Chip` co reszta Menu 3
// (`docs/ui-standards/TRIADA_KANON.md`), którego aktywne wypełnienie jest
// neutralne (`bg-state-selected`).
const FilterButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <Menu3Chip active={active} onClick={onClick}>
    {children}
  </Menu3Chip>
);

const ConclusionsHub: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeId = searchParams.get('id');

  const [listState, setListState] = useState<LoadState>('loading');
  const [conclusions, setConclusions] = useState<Conclusion[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [isSyncing, setIsSyncing] = useState(false);

  const [detailState, setDetailState] = useState<LoadState>('loading');
  const [detail, setDetail] = useState<ConclusionDetail | null>(null);

  const loadList = useCallback(async () => {
    setListState('loading');
    try {
      const res = await ConclusionsApi.list();
      setConclusions(res.conclusions || []);
      setListState('ready');
    } catch {
      setListState('error');
    }
  }, []);

  /**
   * Sync (interview/assessment/tool sources → conclusions) then reload the
   * list. A sync failure — most commonly a 403 when the actor lacks the
   * write permission `POST /api/conclusions/sync` shares with the rest of
   * the write surface — must NOT block the list: the read path stays
   * available even without the write permission, it just shows whatever is
   * already governed in the database.
   */
  const syncThenLoadList = useCallback(async () => {
    setIsSyncing(true);
    try {
      await ConclusionsApi.sync();
    } catch {
      // No write permission or transient failure — fall through to the list.
    } finally {
      setIsSyncing(false);
    }
    await loadList();
  }, [loadList]);

  useEffect(() => {
    void syncThenLoadList();
    // Once per mount ("raz na wejście") — syncThenLoadList is stable (only
    // depends on the stable loadList callback).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setDetailState('loading');
    setDetail(null);
    try {
      const res = await ConclusionsApi.get(id);
      setDetail(res);
      setDetailState('ready');
    } catch {
      setDetailState('error');
    }
  }, []);

  useEffect(() => {
    if (activeId) void loadDetail(activeId);
  }, [activeId, loadDetail]);

  const openDetail = useCallback(
    (id: string) => {
      setSearchParams({ id }, { replace: false });
    },
    [setSearchParams]
  );

  const backToList = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('id');
    setSearchParams(next, { replace: false });
  }, [searchParams, setSearchParams]);

  // Distinct source modules present in the data, for the filter row.
  const sources = useMemo(() => {
    const set = new Set(conclusions.map((c) => c.sourceModule).filter(Boolean));
    return Array.from(set);
  }, [conclusions]);

  const filtered = useMemo(
    () =>
      sourceFilter === 'all'
        ? conclusions
        : conclusions.filter((c) => c.sourceModule === sourceFilter),
    [conclusions, sourceFilter]
  );

  // --- Detail view -----------------------------------------------------------
  if (activeId) {
    if (detailState === 'loading') {
      return (
        <div className="p-6">
          <LoadingState template="panel" />
        </div>
      );
    }
    if (detailState === 'error' || !detail) {
      return (
        <div className="p-6">
          <EmptyState
            variant="error"
            title={t('conclusions.detailError.title', 'Could not load this conclusion')}
            description={t(
              'conclusions.detailError.description',
              'Something went wrong loading the readout. Try again.'
            )}
            onRetry={() => void loadDetail(activeId)}
            secondaryAction={{
              label: t('conclusions.backToList', 'All conclusions'),
              onClick: backToList,
            }}
          />
        </div>
      );
    }
    return (
      <div className="p-6">
        <ConclusionReadout detail={detail} onBack={backToList} />
      </div>
    );
  }

  // --- List view -------------------------------------------------------------
  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--c-text)]">
            {t('conclusions.title', 'Conclusions')}
          </h1>
          <p className="mt-1 text-sm text-[var(--c-text-secondary)]">
            {t(
              'conclusions.subtitle',
              'Governed conclusions from your tools and assessments — verdict, rationale and evidence in one place.'
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void syncThenLoadList()}
          disabled={isSyncing || listState === 'loading'}
          data-testid="conclusions-refresh"
          aria-label={t('conclusions.refresh', 'Refresh')}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--c-border-subtle)] bg-[var(--c-surface)] px-3 py-1.5 text-xs font-medium text-[var(--c-text-secondary)] transition-colors hover:bg-[var(--c-surface-raised)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={14} className={isSyncing ? 'animate-spin' : undefined} />
          {isSyncing
            ? t('conclusions.refreshing', 'Refreshing…')
            : t('conclusions.refresh', 'Refresh')}
        </button>
      </header>

      {listState === 'loading' && <LoadingState template="card" count={4} />}

      {listState === 'error' && (
        <EmptyState
          variant="error"
          title={t('conclusions.listError.title', 'Could not load conclusions')}
          description={t(
            'conclusions.listError.description',
            'Something went wrong. Check your connection and try again.'
          )}
          onRetry={() => void loadList()}
        />
      )}

      {listState === 'ready' && conclusions.length === 0 && (
        <EmptyState
          variant="new"
          icon={Sparkles}
          title={t('conclusions.empty.title', 'No conclusions yet')}
          description={t(
            'conclusions.empty.description',
            'Run a discovery tool or an assessment — its verdict lands here as a governed conclusion.'
          )}
          primaryAction={{
            label: t('conclusions.empty.cta', 'Open Tools'),
            onClick: () => navigate(ROUTES.DISCOVERY_TOOLS.ROOT),
          }}
          secondaryAction={{
            label: t('conclusions.empty.ctaAssessment', 'Open Assessment'),
            onClick: () => navigate(ROUTES.ASSESSMENT.ROOT),
          }}
        />
      )}

      {listState === 'ready' && conclusions.length > 0 && (
        <>
          {sources.length > 1 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <FilterButton active={sourceFilter === 'all'} onClick={() => setSourceFilter('all')}>
                {t('conclusions.filter.all', 'All')}
              </FilterButton>
              {sources.map((src) => (
                <FilterButton
                  key={src}
                  active={sourceFilter === src}
                  onClick={() => setSourceFilter(src)}
                >
                  {sourceLabel(t, src)}
                </FilterButton>
              ))}
            </div>
          )}

          {filtered.length === 0 ? (
            <EmptyState
              variant="filter"
              title={t('conclusions.filterEmpty.title', 'No conclusions match this filter')}
              description={t(
                'conclusions.filterEmpty.description',
                'Clear the filter to see all conclusions.'
              )}
              primaryAction={{
                label: t('conclusions.filter.clear', 'Show all'),
                onClick: () => setSourceFilter('all'),
              }}
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filtered.map((c) => (
                <ConclusionCard key={c.id} conclusion={c} onOpen={openDetail} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ConclusionsHub;
