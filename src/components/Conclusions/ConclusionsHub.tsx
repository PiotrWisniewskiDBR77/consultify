/**
 * ConclusionsHub — org-wide surface for the Conclusions layer.
 *
 * The Conclusions infra (ConclusionService, tool/assessment bridges, routes) has
 * been live since OXFORD #41, but users had nowhere to see it. This hub is that
 * surface: a governed list of conclusions (verdict / rationale / evidence / source)
 * with source + confidence filters, and a per-conclusion readout detail reached
 * via `?id=`. It reads exclusively from GET /api/conclusions (org-scoped).
 *
 * States use the shared canon (EmptyState variants new/filter/error + LoadingState).
 * Tokens: var(--c-*) only.
 */

import { Sparkles } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

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

const FilterButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
      active
        ? 'bg-[var(--c-accent)] text-white'
        : 'border border-[var(--c-border-subtle)] bg-[var(--c-surface)] text-[var(--c-text-secondary)] hover:bg-[var(--c-surface-raised)]'
    }`}
  >
    {children}
  </button>
);

const ConclusionsHub: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeId = searchParams.get('id');

  const [listState, setListState] = useState<LoadState>('loading');
  const [conclusions, setConclusions] = useState<Conclusion[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string>('all');

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

  useEffect(() => {
    void loadList();
  }, [loadList]);

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
      <header className="mb-5">
        <h1 className="text-xl font-bold text-[var(--c-text)]">
          {t('conclusions.title', 'Conclusions')}
        </h1>
        <p className="mt-1 text-sm text-[var(--c-text-secondary)]">
          {t(
            'conclusions.subtitle',
            'Governed conclusions from your tools and assessments — verdict, rationale and evidence in one place.'
          )}
        </p>
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
