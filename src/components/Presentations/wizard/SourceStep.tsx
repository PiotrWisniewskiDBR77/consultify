import {
  ArrowRight,
  Check,
  ClipboardList,
  FileText,
  Layout,
  Loader2,
  Shield,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

import type { SourceArtifact } from './types';

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Target,
  ClipboardList,
  FileText,
  TrendingUp,
  Zap,
  Layout,
  Shield,
};

const SOURCE_TYPES = [
  { type: 'initiative_portfolio', icon: 'Target', color: 'text-blue-500' },
  { type: 'kpi_roi', icon: 'TrendingUp', color: 'text-amber-500' },
  { type: 'assessment', icon: 'FileText', color: 'text-primary-500' },
  { type: 'raid', icon: 'Shield', color: 'text-danger-500' },
  { type: 'execution_status', icon: 'ClipboardList', color: 'text-emerald-500' },
  { type: 'tool_session', icon: 'Zap', color: 'text-blue-500' },
];

function unwrap<T = any>(res: any): T {
  const d = res?.data;
  if (d && typeof d === 'object' && 'data' in d) return d.data;
  return d;
}

function mapArtifactToSource(row: any): SourceArtifact {
  const origin = Array.isArray(row?.originLinks) ? row.originLinks[0] : row?.originSummary || {};
  const runtime = String(
    origin?.originRuntime || row?.originRuntime || row?.outputType || 'artifact'
  );
  const recordId = String(
    origin?.originRecordId || row?.originRecordId || row?.id || row?.artifactId || ''
  );
  const type = runtime.includes('initiative')
    ? 'initiative_portfolio'
    : runtime.includes('assessment') || runtime.includes('drd')
      ? 'assessment'
      : runtime.includes('interview') || runtime.includes('survey')
        ? 'tool_session'
        : String(row?.outputType || row?.artifactFamily || 'report');

  const dupCount = Number(row?.duplicateCount || 1);
  const baseLabel = String(
    row?.resolvedTitle || row?.titleSnapshot || row?.title || row?.name || type.replace(/_/g, ' ')
  );

  return {
    type,
    id: recordId || String(row?.artifactId || row?.id || ''),
    artifactId: String(row?.artifactId || row?.id || recordId),
    // Presentational dedup: show a "· N wersji" hint so the user knows older
    // versions were collapsed (server keeps them; only one row is shown).
    label: dupCount > 1 ? `${baseLabel} · ${dupCount} wersje` : baseLabel,
    isDraft: Boolean(row?.isDraft),
    confidence:
      typeof row?.trustScore === 'number'
        ? row.trustScore
        : typeof row?.confidence === 'number'
          ? row.confidence
          : 0.75,
    readiness: row?.deliveryState === 'blocked' ? 'policy_blocked' : 'ready',
    lineage: {
      runtime,
      recordId,
      family: String(row?.artifactFamily || row?.outputType || 'artifact'),
    },
    data: {
      artifactId: row?.artifactId || row?.id,
      deliveryState: row?.deliveryState,
      visibilityScope: row?.visibilityScope,
    },
  };
}

interface SourceStepProps {
  selectedSources: SourceArtifact[];
  onToggleSource: (source: SourceArtifact) => void;
  onNext: () => void;
}

export const SourceStep: React.FC<SourceStepProps> = ({
  selectedSources,
  onToggleSource,
  onNext,
}) => {
  const { t } = useTranslation();
  const [availableArtifacts, setAvailableArtifacts] = useState<SourceArtifact[]>([]);
  const [loadingArtifacts, setLoadingArtifacts] = useState(false);
  const [artifactError, setArtifactError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [visibleCount, setVisibleCount] = useState(12);
  // M17 junk filter (S6.3): default picker shows only real/final artifacts.
  // The "Pokaż robocze" toggle asks the server to include drafts.
  const [showDrafts, setShowDrafts] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingArtifacts(true);
    setArtifactError(null);
    // Server excludes drafts + dedupes by default; opt into drafts explicitly.
    Api.get(`/artifacts?limit=80${showDrafts ? '&include=drafts' : ''}`)
      .then((res) => {
        const data = unwrap<any>(res);
        const rows = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.rows)
            ? data.rows
            : Array.isArray(data)
              ? data
              : [];
        const mapped = rows.map(mapArtifactToSource);
        if (!cancelled) setAvailableArtifacts(mapped);
      })
      .catch(() => {
        if (!cancelled) setAvailableArtifacts([]);
        if (!cancelled)
          setArtifactError(
            t('presentations.sources.artifactLoadFailed', 'Could not load registered artifacts.')
          );
      })
      .finally(() => {
        if (!cancelled) setLoadingArtifacts(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t, showDrafts]);

  const artifactTypes = useMemo(
    () => [
      'all',
      ...Array.from(new Set(availableArtifacts.map((artifact) => artifact.type))).sort(),
    ],
    [availableArtifacts]
  );

  const filteredArtifacts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return availableArtifacts.filter((artifact) => {
      const matchesType = typeFilter === 'all' || artifact.type === typeFilter;
      const matchesQuery =
        !q ||
        artifact.label.toLowerCase().includes(q) ||
        artifact.type.toLowerCase().includes(q) ||
        String(artifact.readiness || '')
          .toLowerCase()
          .includes(q);
      return matchesType && matchesQuery;
    });
  }, [availableArtifacts, query, typeFilter]);

  const visibleArtifacts = filteredArtifacts.slice(0, visibleCount);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('presentations.sources.title', 'Select Data Sources')}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          {t(
            'presentations.sources.subtitle',
            'Choose which platform artifacts to include in your deck.'
          )}
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-800">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">
              {t('presentations.sources.artifactsTitle', 'Concrete source artifacts')}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t(
                'presentations.sources.artifactsSubtitle',
                'Select the exact project evidence that should ground the generated deck.'
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {loadingArtifacts && <Loader2 className="h-5 w-5 animate-spin text-primary-500" />}
            <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={showDrafts}
                onChange={(event) => {
                  setShowDrafts(event.target.checked);
                  setVisibleCount(12);
                }}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-c-focus dark:border-navy-600"
              />
              {t('presentations.sources.showDrafts', 'Pokaż robocze')}
            </label>
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_180px]">
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setVisibleCount(12);
            }}
            placeholder={t(
              'presentations.sources.searchArtifacts',
              'Search project, study, report, initiative...'
            )}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-c-focus-solid focus:ring-2 focus:ring-c-focus dark:border-navy-700 dark:bg-navy-900 dark:text-slate-200"
          />
          <select
            value={typeFilter}
            onChange={(event) => {
              setTypeFilter(event.target.value);
              setVisibleCount(12);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-c-focus-solid focus:ring-2 focus:ring-c-focus dark:border-navy-700 dark:bg-navy-900 dark:text-slate-200"
          >
            {artifactTypes.map((type) => (
              <option key={type} value={type}>
                {type === 'all' ? t('common.all', 'All') : type.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        {artifactError && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            {artifactError}
          </div>
        )}

        {filteredArtifacts.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {visibleArtifacts.map((artifact) => {
              const selected = selectedSources.some(
                (source) =>
                  (artifact.artifactId && source.artifactId === artifact.artifactId) ||
                  (artifact.id && source.id === artifact.id && source.type === artifact.type)
              );
              return (
                <button
                  key={`${artifact.type}:${artifact.artifactId || artifact.id}`}
                  onClick={() => onToggleSource(artifact)}
                  className={`rounded-lg border p-4 text-left transition-all ${
                    selected
                      ? 'border-slate-500 dark:border-c-border bg-slate-100/60 dark:bg-white/[0.07]'
                      : 'border-slate-200 hover:border-slate-300 dark:border-navy-700 dark:hover:border-navy-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">{artifact.label}</p>
                      <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                        {artifact.type.replace(/_/g, ' ')} · {artifact.readiness || 'ready'}
                      </p>
                    </div>
                    {selected && <Check className="h-4 w-4 text-slate-700 dark:text-slate-200" />}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-500 dark:bg-navy-900 dark:text-slate-400">
            {loadingArtifacts
              ? t('presentations.sources.loadingArtifacts', 'Loading artifacts...')
              : t(
                  'presentations.sources.noArtifacts',
                  'No registered artifacts found yet. You can still choose a source type below for a draft deck.'
                )}
          </div>
        )}
        {filteredArtifacts.length > visibleArtifacts.length && (
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + 12)}
            className="mt-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-navy-700 dark:text-slate-300 dark:hover:bg-navy-800"
          >
            {t('presentations.sources.loadMore', 'Load more')} ({visibleArtifacts.length}/
            {filteredArtifacts.length})
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {SOURCE_TYPES.map(({ type, icon, color }) => {
          const Icon = ICON_MAP[icon] || Target;
          const selected = selectedSources.some((s) => s.type === type && !s.artifactId);
          return (
            <button
              key={type}
              onClick={() =>
                onToggleSource({
                  type,
                  id: `manual-${type}`,
                  label: type.replace(/_/g, ' '),
                  readiness: 'partial_ready',
                  confidence: 0.4,
                  lineage: { runtime: 'manual_source_type', recordId: type, family: 'draft' },
                })
              }
              className={`p-5 rounded-xl border-2 text-left transition-all ${
                selected
                  ? 'border-slate-500 dark:border-c-border bg-slate-100/60 dark:bg-white/[0.06] shadow-sm'
                  : 'border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600'
              }`}
            >
              <Icon className={`w-8 h-8 ${color} mb-3`} />
              <p className="font-semibold text-slate-900 dark:text-white">
                {t(`presentations.sources.${type}`, type.replace(/_/g, ' '))}
              </p>
              {selected && (
                <div className="mt-2 flex items-center gap-1 text-xs text-slate-700 dark:text-slate-200 font-medium">
                  <Check size={12} /> {t('common.selected', 'Selected')}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedSources.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-navy-700 dark:bg-navy-900">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {t('presentations.sources.selectedEvidence', 'Selected evidence')}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedSources.map((source) => (
              <span
                key={`${source.type}:${source.artifactId || source.id}`}
                className="rounded-full bg-white px-3 py-1 text-xs text-slate-600 ring-1 ring-slate-200 dark:bg-navy-800 dark:text-slate-300 dark:ring-navy-700"
              >
                {source.label} · {source.readiness || 'ready'}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={selectedSources.length === 0}
          className="flex items-center gap-2 px-6 py-3 bg-navy-900 text-white dark:bg-slate-50 dark:text-navy-950 dark:hover:bg-slate-200 font-medium rounded-xl hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('common.next', 'Next')} <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};
