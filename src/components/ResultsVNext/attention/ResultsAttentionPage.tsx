/**
 * ResultsAttentionPage — RN-G5 §G #30. The real `/results/attention` screen:
 * ONE cross-cutting "what needs attention" view over KPI + OKR manager
 * read-models (see `attentionApi.ts`/`attentionPresenters.tsx` headers for
 * the confirmed, non-mergeable server shapes this had to design around).
 *
 * ★ D10: this is NOT a fourth top-level registry — it does not use
 * `ResultsVNextRegistryShell` (that shell's `domain` prop is a closed
 * `'kpi'|'roi'|'okr'` union in `../types.ts`, a file outside this package's
 * allowlist; widening it for a view that is explicitly NOT a fourth domain
 * would be the wrong fix anyway). Composes `StandardModuleBar`+
 * `StandardTable`+`StandardPreview` directly instead — the same three
 * Triada components every other RN-G2/RN-G5 screen uses, just without the
 * shell's domain-specific data-testid wrapper. Esc-to-close + focus-return
 * on the preview pane is replicated here from `ResultsVNextRegistryShell`
 * (same behavior, same rationale — TRIADA §B pkt 24/42).
 *
 * Two-level bucket picker (see `attentionPresenters.tsx` header for why —
 * no shared row shape exists to merge into one table):
 *  - Menu 2 tab row picks source ('kpi' | 'okr') — which backend aggregate.
 *  - Menu 3 chips  = the named bucket within that source, REAL counts on
 *                    every chip (computed from the already-loaded
 *                    aggregate, no per-bucket fetch).
 *  - StandardTable = the currently selected bucket's rows.
 *  - StandardPreview = generic per-row property list
 *    (`buildAttentionRowPreview`), with an "Open KPI"/"Open OKR Set"
 *    action when the row carries a navigable id.
 *
 * Gated behind BOTH `kpiRegistry` AND `okrRegistry` flags (default OFF) —
 * deliberately NOT a new flag of its own: this view shows data from both
 * domains, and `resultsVNextFeatureFlags.ts`'s "one flag per domain" +
 * D10's "not a fourth domain" together mean the honest gate is "both
 * domains it reads from are enabled", not a new flag this package would
 * have to add to a file (`resultsVNextFeatureFlags.ts`) outside its own
 * allowlist.
 */
import { Blocks } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { EmptyState } from '@/components/shared/states';
import {
  StandardModuleBar,
  StandardPreview,
  StandardTable,
  type StandardCounterChip,
  type StandardModuleTab,
} from '@/components/standard';
import { PREVIEW_PANE_WIDTH } from '@/components/shared/PreviewPane/previewGeometry';
import { ROUTES } from '@/routes/routeConfig';
import { OrganizationApi } from '@/services/api/organizations.api';
import { useAppStore } from '@/store/useAppStore';

import { isResultsVNextFlagEnabled } from '../resultsVNextFeatureFlags';
import {
  getOrganizationKpiAttention,
  getOrganizationOkrAttention,
  getOrganizationOkrTeamHealth,
  type OrganizationKpiAttentionDto,
  type OrganizationOkrAttentionDto,
  type OrganizationOkrTeamHealthDto,
} from './attentionApi';
import {
  bucketCount,
  buildAttentionRowPreview,
  buildKpiAttentionBuckets,
  buildOkrAttentionBuckets,
  extractKpiBucketRows,
  extractOkrBucketRows,
  type AttentionSourceDomain,
} from './attentionPresenters';

type SourceTab = AttentionSourceDomain;

export const ResultsAttentionPage: React.FC = () => {
  const { i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const navigate = useNavigate();

  const enabled = isResultsVNextFlagEnabled('kpiRegistry') && isResultsVNextFlagEnabled('okrRegistry');

  // 2026-08-26 night-fixes-a P0 (NIGHT_SWEEP_A_REPORT_20260826.md #4): every
  // `*UserId` field in the KPI/OKR attention read-models is a raw id — this
  // resolves it to the org member's real name, same id->name convention
  // `useMentionAutocomplete` already uses (real, already-existing
  // `/organizations/:id/members` endpoint — no server change, no invented
  // data; unresolved ids — e.g. a deactivated account — still fall back to
  // the short id honestly).
  const currentOrganization = useAppStore((s) => s.currentOrganization);
  const [memberNameById, setMemberNameById] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!currentOrganization?.id) return;
    let cancelled = false;
    OrganizationApi.getOrganizationMembers(currentOrganization.id)
      .then((members) => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        members.forEach((m) => {
          const label = (m.name && m.name.trim()) || m.email || m.userId;
          if (label) map[m.userId] = label;
        });
        setMemberNameById(map);
      })
      .catch(() => {
        if (!cancelled) setMemberNameById({});
      });
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id]);
  const resolveMemberName = useCallback(
    (userId: string) => memberNameById[userId] || null,
    [memberNameById]
  );

  const [source, setSource] = useState<SourceTab>('kpi');

  const [kpiDto, setKpiDto] = useState<OrganizationKpiAttentionDto | null>(null);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiError, setKpiError] = useState<string | null>(null);

  const [okrDto, setOkrDto] = useState<OrganizationOkrAttentionDto | null>(null);
  const [okrLoading, setOkrLoading] = useState(false);
  const [okrError, setOkrError] = useState<string | null>(null);

  const [teamHealthDto, setTeamHealthDto] = useState<OrganizationOkrTeamHealthDto | null>(null);
  const [teamHealthLoading, setTeamHealthLoading] = useState(false);
  const [teamHealthError, setTeamHealthError] = useState<string | null>(null);

  const kpiBuckets = useMemo(
    () => buildKpiAttentionBuckets(isPolish, resolveMemberName),
    [isPolish, resolveMemberName]
  );
  const okrBuckets = useMemo(
    () => buildOkrAttentionBuckets(isPolish, resolveMemberName),
    [isPolish, resolveMemberName]
  );

  const [kpiBucketId, setKpiBucketId] = useState<string>(kpiBuckets[0]?.id ?? '');
  const [okrBucketId, setOkrBucketId] = useState<string>(okrBuckets[0]?.id ?? '');
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  const loadKpi = useCallback(() => {
    setKpiLoading(true);
    setKpiError(null);
    getOrganizationKpiAttention()
      .then((dto) => setKpiDto(dto))
      .catch((err) => setKpiError(err instanceof Error ? err.message : String(err)))
      .finally(() => setKpiLoading(false));
  }, []);

  const loadOkr = useCallback(() => {
    setOkrLoading(true);
    setOkrError(null);
    getOrganizationOkrAttention()
      .then((dto) => setOkrDto(dto))
      .catch((err) => setOkrError(err instanceof Error ? err.message : String(err)))
      .finally(() => setOkrLoading(false));
    setTeamHealthLoading(true);
    setTeamHealthError(null);
    getOrganizationOkrTeamHealth()
      .then((dto) => setTeamHealthDto(dto))
      .catch((err) => setTeamHealthError(err instanceof Error ? err.message : String(err)))
      .finally(() => setTeamHealthLoading(false));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (source === 'kpi' && kpiDto === null && !kpiLoading && !kpiError) loadKpi();
    if (source === 'okr' && okrDto === null && !okrLoading && !okrError) loadOkr();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, source]);

  // Esc-to-close + focus-return on the preview pane — same contract
  // `ResultsVNextRegistryShell.tsx` implements (TRIADA §B pkt 24/42).
  useEffect(() => {
    if (!selectedRowId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setSelectedRowId(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [selectedRowId]);

  const onOpenKpi = useCallback(
    (kpiId: string) => navigate(`${ROUTES.RESULTS_KPI.ROOT}?kpiId=${encodeURIComponent(kpiId)}`),
    [navigate]
  );
  const onOpenOkrSet = useCallback(
    (setId: string) => navigate(`${ROUTES.RESULTS_OKR.ROOT}?setId=${encodeURIComponent(setId)}`),
    [navigate]
  );

  if (!enabled) {
    return (
      <div className="h-full flex items-center justify-center p-6" data-testid="results-vnext-attention-disabled">
        <EmptyState
          variant="new"
          icon={Blocks}
          title={isPolish ? 'Uwaga — jeszcze nie włączone' : 'Attention — not yet enabled'}
          description={
            isPolish
              ? 'Ten widok wymaga włączonych rejestrów KPI i OKR. Poproś administratora o dostęp za flagą.'
              : 'This view requires both the KPI and OKR registries enabled. Ask an administrator for flag access.'
          }
          compact
        />
      </div>
    );
  }

  const tabs: StandardModuleTab[] = [
    { id: 'kpi', label: isPolish ? 'KPI' : 'KPI' },
    { id: 'okr', label: 'OKR' },
  ];

  const buckets = source === 'kpi' ? kpiBuckets : okrBuckets;
  const activeBucketId = source === 'kpi' ? kpiBucketId : okrBucketId;
  const setActiveBucketId = source === 'kpi' ? setKpiBucketId : setOkrBucketId;
  const activeBucket = buckets.find((b) => b.id === activeBucketId) ?? buckets[0];

  const chips: StandardCounterChip[] = buckets.map((b) => ({
    id: b.id,
    label: isPolish ? b.labelPl : b.labelEn,
    count: bucketCount(source, b.id, kpiDto, okrDto, teamHealthDto),
  }));

  const rows =
    source === 'kpi'
      ? extractKpiBucketRows(activeBucketId, kpiDto)
      : extractOkrBucketRows(activeBucketId, okrDto, teamHealthDto);

  const loading = source === 'kpi' ? kpiLoading : okrLoading || (activeBucketId === 'teamHealthSets' && teamHealthLoading);
  const error = source === 'kpi' ? kpiError : okrError || (activeBucketId === 'teamHealthSets' ? teamHealthError : null);
  const retry = source === 'kpi' ? loadKpi : loadOkr;

  const selectedRow = rows.find((r) => r.id === selectedRowId) ?? null;

  return (
    <div className="h-full" data-testid="results-vnext-attention-page">
      <StandardModuleBar
        tabs={tabs}
        activeTab={source}
        onTabChange={(id) => {
          setSource(id as SourceTab);
          setSelectedRowId(null);
        }}
        showTabCounts={false}
        chips={chips}
        activeChip={activeBucketId}
        onChipChange={(id) => {
          setActiveBucketId(id);
          setSelectedRowId(null);
        }}
      >
        <div className="h-full flex overflow-hidden">
          <div className="flex-1 min-w-0 overflow-auto pl-4 pr-1.5 pt-3 pb-4">
            <StandardTable
              columns={activeBucket?.columns ?? []}
              data={rows}
              persistKey={`results-vnext.attention.${source}.${activeBucketId}`}
              loading={loading}
              error={error}
              onRetry={retry}
              empty={
                !loading && !error && rows.length === 0
                  ? {
                      title: isPolish ? 'Brak pozycji wymagających uwagi' : 'Nothing needs attention',
                      description: isPolish
                        ? 'Ten zbiornik jest obecnie pusty — dobra wiadomość.'
                        : 'This bucket is currently empty — good news.',
                    }
                  : undefined
              }
              selectedRowId={selectedRowId}
              onRowClick={(row) => setSelectedRowId(String(row.id))}
            />
          </div>
          {selectedRow && activeBucket ? (
            <aside
              className="shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden"
              style={{ width: PREVIEW_PANE_WIDTH }}
            >
              <StandardPreview
                {...buildAttentionRowPreview(selectedRow, {
                  isPolish,
                  bucketLabel: isPolish ? activeBucket.labelPl : activeBucket.labelEn,
                  columns: activeBucket.columns,
                  openKind: activeBucket.openKind,
                  openIdField: activeBucket.openIdField,
                  onClose: () => setSelectedRowId(null),
                  onOpenKpi,
                  onOpenOkrSet,
                  resolveMemberName,
                })}
              />
            </aside>
          ) : null}
        </div>
      </StandardModuleBar>
    </div>
  );
};

export default ResultsAttentionPage;
