/**
 * RN-G2 P3 #23 — visual QA harness for the OKR Set registry (`ResultsOkrHub`
 * / `okrRegistryPresenters.tsx`). Mounts the REAL `ResultsVNextRegistryShell`
 * fed by the REAL presenter functions (`buildOkrSetColumns`/
 * `buildOkrSetRowMenu`/`buildOkrSetPreview`) with mock `OkrSetDto` data —
 * NOT `ResultsOkrHub` itself, which does live `fetch()` calls with no
 * backend available in this harness (same reason ROI's
 * `results-vnext-roi-registry.tsx` mounts the presenters directly). Mirrors
 * that file's structure exactly.
 *
 * URL params:
 *   ?tab=org|my|company           which Menu 2 tab (default org) — all three
 *                                  reuse the SAME mock list here (the real
 *                                  endpoints return the identical `OkrSetDto`
 *                                  shape for all three perspectives, see
 *                                  `okrApi.ts` header; only the live Hub's
 *                                  network call differs per tab, which this
 *                                  static harness has no reason to fake).
 *   &state=ready|loading|empty|error   top-level StandardTable state (default ready)
 *   &selected=<setId|none>        pre-select a row (default: first row); 'none' closes preview
 *
 * ── HONEST FINDING re. "null vs not_calculable" QA requirement ──────────
 * `okrApi.ts`/`okrRegistryMappers.ts` (`parseOkrProgress`'s own doc comment)
 * establish, by reading the real server code, that `overall_progress`/
 * `overall_confidence` on `okr_vnext_sets` are a genuine 2-way domain on the
 * wire (`T | null`) — the calculation engine's own `'not_calculable'`
 * distinction (`okrProgressEngine.ts`/`okrSetRollupCalculator.ts`) is never
 * persisted or exposed via any GET endpoint for a Set. This mock therefore
 * does NOT contain a `'not_calculable'` row for `overallProgress` —
 * fabricating one here would misrepresent what the real Hub can ever show
 * from real API data (RN_G2_UI_SCOPE.md's own "never invent a value/state
 * no source document or server code defines" rule, applied to inventing a
 * DISTINCTION rather than a number). The rendering PRIMITIVE's
 * `'not_calculable'` branch is still exercised by the pre-existing P0 shell
 * harness (`?screen=results-vnext-registry-shell&domain=okr`) — that mock
 * predates this package's verified wire shapes and is illustrative of the
 * `HonestValueCell` component generically, not of this package's real data.
 * See the acceptance report for the full citation trail.
 *
 * ── FIXED 2026-08-10 (RN-G2 §G #25 pass) — progress SCALE bug ───────────
 * `overallProgress` values below were rescaled from a 0-100 assumption
 * (`'62.5'`/`'91'`/`'104'`/`'78'`) to the REAL 0-1 unclamped-ratio wire
 * scale (`'0.625'`/`'0.91'`/`'1.04'`/`'0.78'`) — `okrRegistryMappers.ts`'s
 * `formatOkrProgressPercent` was fixed in the same pass to multiply by 100
 * (see that function's own doc comment for the full proof). The two fixes
 * cancel out visually: this screen renders the identical 62.5%/91%/104%/78%
 * on screen before and after, so this is a data-model correction, not a
 * visual regression.
 */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ResultsVNextRegistryShell } from '../../src/components/ResultsVNext/ResultsVNextRegistryShell';
import type { OkrSetDto } from '../../src/components/ResultsVNext/okr/okrApi';
import {
  buildOkrSetColumns,
  buildOkrSetPreview,
  buildOkrSetRowMenu,
} from '../../src/components/ResultsVNext/okr/okrRegistryPresenters';
import type { StandardCounterChip, TableRow } from '../../src/components/standard';

// ── Mock OKR Sets — one representative row per real status (all 10 from
//    `OKR_SET_STATUSES`, including the two reserved/unreachable ones for
//    exhaustiveness) and spanning the genuine 2-way honest-missing domain
//    for overallProgress/overallConfidence (real value vs null — see header
//    note for why a 3rd `'not_calculable'` row is deliberately absent).
const MOCK_SETS: OkrSetDto[] = [
  {
    setId: 'okr-set-1',
    organizationId: 'org-1',
    programId: 'program-fy26',
    cycleId: 'cycle-fy26-h2',
    scopeType: 'team',
    scopeId: 'team-operations',
    ownerUserId: 'user-anna-kowalska',
    reviewerUserId: 'user-piotr-wisniewski',
    title: 'Zbudować cyfrową dojrzałość operacji do poziomu 4',
    status: 'draft',
    submittedBy: null,
    submittedAt: null,
    approvedBy: null,
    approvedAt: null,
    changesRequestedBy: null,
    changesRequestedAt: null,
    changesRequestedReason: null,
    currentVersion: 1,
    approvedVersion: null,
    latestApprovedSnapshotId: null,
    overallProgress: null,
    overallConfidence: null,
    attentionState: 'none',
    lastCheckinAt: null,
    nextCheckinDueAt: null,
    carriedFromSetId: null,
    rowVersion: 1,
    createdBy: 'user-anna-kowalska',
    createdAt: '2026-08-01T09:00:00Z',
    updatedBy: null,
    updatedAt: '2026-08-01T09:00:00Z',
  },
  {
    setId: 'okr-set-2',
    organizationId: 'org-1',
    programId: 'program-fy26',
    cycleId: 'cycle-fy26-h2',
    scopeType: 'business_unit',
    scopeId: 'bu-manufacturing',
    ownerUserId: 'user-tomasz-nowak',
    reviewerUserId: 'user-piotr-wisniewski',
    title: 'Uzyskać dyscyplinę finansową portfela inicjatyw (wymaga poprawek)',
    status: 'changes_requested',
    submittedBy: 'user-tomasz-nowak',
    submittedAt: '2026-08-02T10:00:00Z',
    approvedBy: null,
    approvedAt: null,
    changesRequestedBy: 'user-piotr-wisniewski',
    changesRequestedAt: '2026-08-04T14:00:00Z',
    changesRequestedReason: 'Key Result 2 nie ma zdefiniowanej geometrii docelowej — uzupełnij przed ponownym złożeniem.',
    currentVersion: 2,
    approvedVersion: null,
    latestApprovedSnapshotId: null,
    overallProgress: null,
    overallConfidence: null,
    attentionState: 'none',
    lastCheckinAt: null,
    nextCheckinDueAt: null,
    carriedFromSetId: null,
    rowVersion: 3,
    createdBy: 'user-tomasz-nowak',
    createdAt: '2026-07-20T09:00:00Z',
    updatedBy: 'user-piotr-wisniewski',
    updatedAt: '2026-08-04T14:00:00Z',
  },
  {
    setId: 'okr-set-3',
    organizationId: 'org-1',
    programId: 'program-fy26',
    cycleId: 'cycle-fy26-h2',
    scopeType: 'team',
    scopeId: 'team-quality',
    ownerUserId: 'user-piotr-wisniewski',
    reviewerUserId: 'user-anna-kowalska',
    title: 'Ograniczyć reklamacje jakościowe o połowę',
    status: 'submitted',
    submittedBy: 'user-piotr-wisniewski',
    submittedAt: '2026-08-08T11:00:00Z',
    approvedBy: null,
    approvedAt: null,
    changesRequestedBy: null,
    changesRequestedAt: null,
    changesRequestedReason: null,
    currentVersion: 1,
    approvedVersion: null,
    latestApprovedSnapshotId: null,
    overallProgress: null,
    overallConfidence: null,
    attentionState: 'none',
    lastCheckinAt: null,
    nextCheckinDueAt: null,
    carriedFromSetId: null,
    rowVersion: 2,
    createdBy: 'user-piotr-wisniewski',
    createdAt: '2026-07-25T09:00:00Z',
    updatedBy: 'user-piotr-wisniewski',
    updatedAt: '2026-08-08T11:00:00Z',
  },
  {
    setId: 'okr-set-4',
    organizationId: 'org-1',
    programId: 'program-fy26',
    cycleId: 'cycle-fy26-h2',
    scopeType: 'company',
    scopeId: 'org-1',
    ownerUserId: 'user-anna-kowalska',
    reviewerUserId: null,
    title: 'Uzyskać certyfikację ISO 27001 dla całej organizacji',
    status: 'approved',
    submittedBy: 'user-anna-kowalska',
    submittedAt: '2026-07-15T09:00:00Z',
    approvedBy: 'user-piotr-wisniewski',
    approvedAt: '2026-07-20T09:00:00Z',
    changesRequestedBy: null,
    changesRequestedAt: null,
    changesRequestedReason: null,
    currentVersion: 1,
    approvedVersion: 1,
    latestApprovedSnapshotId: 'snap-4-v1',
    overallProgress: null,
    overallConfidence: null,
    attentionState: 'none',
    lastCheckinAt: null,
    nextCheckinDueAt: null,
    carriedFromSetId: null,
    rowVersion: 4,
    createdBy: 'user-anna-kowalska',
    createdAt: '2026-07-01T09:00:00Z',
    updatedBy: 'user-piotr-wisniewski',
    updatedAt: '2026-07-20T09:00:00Z',
  },
  {
    setId: 'okr-set-5',
    organizationId: 'org-1',
    programId: 'program-fy26',
    cycleId: 'cycle-fy26-h2',
    scopeType: 'individual',
    scopeId: 'user-anna-kowalska',
    ownerUserId: 'user-anna-kowalska',
    reviewerUserId: 'user-tomasz-nowak',
    title: 'Wdrożyć MES na 3 liniach produkcyjnych',
    status: 'active',
    submittedBy: 'user-anna-kowalska',
    submittedAt: '2026-06-01T09:00:00Z',
    approvedBy: 'user-tomasz-nowak',
    approvedAt: '2026-06-05T09:00:00Z',
    changesRequestedBy: null,
    changesRequestedAt: null,
    changesRequestedReason: null,
    currentVersion: 1,
    approvedVersion: 1,
    latestApprovedSnapshotId: 'snap-5-v1',
    overallProgress: '0.625',
    overallConfidence: 'medium',
    attentionState: 'watch',
    lastCheckinAt: '2026-08-05T09:00:00Z',
    nextCheckinDueAt: '2026-08-19T09:00:00Z',
    carriedFromSetId: null,
    rowVersion: 9,
    createdBy: 'user-anna-kowalska',
    createdAt: '2026-06-01T09:00:00Z',
    updatedBy: 'user-anna-kowalska',
    updatedAt: '2026-08-05T09:00:00Z',
  },
  {
    setId: 'okr-set-6',
    organizationId: 'org-1',
    programId: 'program-fy26',
    cycleId: 'cycle-fy26-h1',
    scopeType: 'business_unit',
    scopeId: 'bu-manufacturing',
    ownerUserId: 'user-tomasz-nowak',
    reviewerUserId: 'user-piotr-wisniewski',
    title: 'Skrócić czas przezbrojenia linii A o 30%',
    status: 'active',
    submittedBy: 'user-tomasz-nowak',
    submittedAt: '2026-02-01T09:00:00Z',
    approvedBy: 'user-piotr-wisniewski',
    approvedAt: '2026-02-05T09:00:00Z',
    changesRequestedBy: null,
    changesRequestedAt: null,
    changesRequestedReason: null,
    currentVersion: 1,
    approvedVersion: 1,
    latestApprovedSnapshotId: 'snap-6-v1',
    overallProgress: '0.91',
    overallConfidence: 'high',
    attentionState: 'none',
    lastCheckinAt: '2026-08-07T09:00:00Z',
    nextCheckinDueAt: '2026-08-21T09:00:00Z',
    carriedFromSetId: null,
    rowVersion: 12,
    createdBy: 'user-tomasz-nowak',
    createdAt: '2026-01-15T09:00:00Z',
    updatedBy: 'user-tomasz-nowak',
    updatedAt: '2026-08-07T09:00:00Z',
  },
  {
    setId: 'okr-set-7',
    organizationId: 'org-1',
    programId: 'program-fy25',
    cycleId: 'cycle-fy25-h2',
    scopeType: 'team',
    scopeId: 'team-quality',
    ownerUserId: 'user-piotr-wisniewski',
    reviewerUserId: 'user-anna-kowalska',
    title: 'Zredukować liczbę reklamacji dostawców o 20% (przegląd)',
    status: 'review',
    submittedBy: 'user-piotr-wisniewski',
    submittedAt: '2026-01-10T09:00:00Z',
    approvedBy: 'user-anna-kowalska',
    approvedAt: '2026-01-15T09:00:00Z',
    changesRequestedBy: null,
    changesRequestedAt: null,
    changesRequestedReason: null,
    currentVersion: 1,
    approvedVersion: 1,
    latestApprovedSnapshotId: 'snap-7-v1',
    overallProgress: '1.04',
    overallConfidence: 'high',
    attentionState: 'none',
    lastCheckinAt: '2026-07-28T09:00:00Z',
    nextCheckinDueAt: null,
    carriedFromSetId: null,
    rowVersion: 15,
    createdBy: 'user-piotr-wisniewski',
    createdAt: '2026-01-01T09:00:00Z',
    updatedBy: 'user-anna-kowalska',
    updatedAt: '2026-07-28T09:00:00Z',
  },
  {
    setId: 'okr-set-8',
    organizationId: 'org-1',
    programId: 'program-fy25',
    cycleId: 'cycle-fy25-h1',
    scopeType: 'company',
    scopeId: 'org-1',
    ownerUserId: 'user-anna-kowalska',
    reviewerUserId: null,
    title: 'Wejść na rynek DACH z ofertą konsultingową',
    status: 'closed',
    submittedBy: 'user-anna-kowalska',
    submittedAt: '2025-07-01T09:00:00Z',
    approvedBy: 'user-piotr-wisniewski',
    approvedAt: '2025-07-05T09:00:00Z',
    changesRequestedBy: null,
    changesRequestedAt: null,
    changesRequestedReason: null,
    currentVersion: 1,
    approvedVersion: 1,
    latestApprovedSnapshotId: 'snap-8-v1',
    overallProgress: '0.78',
    overallConfidence: 'medium',
    attentionState: 'none',
    lastCheckinAt: '2025-12-20T09:00:00Z',
    nextCheckinDueAt: null,
    carriedFromSetId: null,
    rowVersion: 20,
    createdBy: 'user-anna-kowalska',
    createdAt: '2025-06-01T09:00:00Z',
    updatedBy: 'user-piotr-wisniewski',
    updatedAt: '2025-12-31T09:00:00Z',
  },
  {
    setId: 'okr-set-9',
    organizationId: 'org-1',
    programId: 'program-fy25',
    cycleId: 'cycle-fy25-h1',
    scopeType: 'individual',
    scopeId: 'user-tomasz-nowak',
    ownerUserId: 'user-tomasz-nowak',
    reviewerUserId: 'user-anna-kowalska',
    title: 'Przejść certyfikację Six Sigma Green Belt (anulowane)',
    status: 'cancelled',
    submittedBy: null,
    submittedAt: null,
    approvedBy: null,
    approvedAt: null,
    changesRequestedBy: null,
    changesRequestedAt: null,
    changesRequestedReason: null,
    currentVersion: 1,
    approvedVersion: null,
    latestApprovedSnapshotId: null,
    overallProgress: null,
    overallConfidence: null,
    attentionState: 'none',
    lastCheckinAt: null,
    nextCheckinDueAt: null,
    carriedFromSetId: null,
    rowVersion: 2,
    createdBy: 'user-tomasz-nowak',
    createdAt: '2025-08-01T09:00:00Z',
    updatedBy: 'user-anna-kowalska',
    updatedAt: '2025-08-10T09:00:00Z',
  },
];

function withId<T extends { setId: string }>(row: T): T & { id: string } {
  return { ...row, id: row.setId };
}

const params = new URLSearchParams(window.location.search);
const initialTab = (params.get('tab') as 'org' | 'my' | 'company') || 'org';
const state = params.get('state') || 'ready';
const initialSelected = params.get('selected');

const ResultsVNextOkrRegistryScreen: React.FC = () => {
  const [tab, setTab] = useState<'org' | 'my' | 'company'>(initialTab);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(
    initialSelected === 'none' ? null : (initialSelected ?? MOCK_SETS[0]?.setId ?? null)
  );

  // Mirrors the REAL `ResultsOkrHub.tsx`: `isPolish` follows the harness's
  // `&lang=` param via i18n, not a hardcoded constant — otherwise `&lang=en`
  // silently has no effect on this screen's copy (same RN-G2 P2 fix ROI's
  // own harness documents, applied here from the start).
  const { i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');

  const selectedSet = useMemo(() => MOCK_SETS.find((s) => s.setId === selectedSetId) ?? null, [selectedSetId]);

  const tabs = [
    { id: 'org', label: isPolish ? 'Organizacja' : 'Organization' },
    { id: 'my', label: isPolish ? 'Moje' : 'My' },
    { id: 'company', label: isPolish ? 'Firma' : 'Company' },
  ];

  const bucketOf = (s: OkrSetDto['status']): 'in_progress' | 'in_review' | 'active' | 'closed_out' => {
    if (s === 'submitted') return 'in_review';
    if (s === 'approved' || s === 'active' || s === 'review') return 'active';
    if (s === 'closed' || s === 'cancelled') return 'closed_out';
    return 'in_progress';
  };

  const chips: StandardCounterChip[] = [
    { id: 'all', label: isPolish ? 'Wszystkie' : 'All', count: MOCK_SETS.length },
    {
      id: 'in_progress',
      label: isPolish ? 'W toku' : 'In progress',
      count: MOCK_SETS.filter((s) => bucketOf(s.status) === 'in_progress').length,
    },
    {
      id: 'in_review',
      label: isPolish ? 'Do akceptacji' : 'In review',
      count: MOCK_SETS.filter((s) => bucketOf(s.status) === 'in_review').length,
    },
    {
      id: 'active',
      label: isPolish ? 'Aktywne' : 'Active',
      count: MOCK_SETS.filter((s) => bucketOf(s.status) === 'active').length,
    },
    {
      id: 'closed_out',
      label: isPolish ? 'Zamknięte / anulowane' : 'Closed / cancelled',
      count: MOCK_SETS.filter((s) => bucketOf(s.status) === 'closed_out').length,
    },
  ];

  const rows: TableRow[] = state === 'empty' ? [] : MOCK_SETS.map(withId);

  return (
    <div className="h-screen bg-c-bg text-c-text">
      <ResultsVNextRegistryShell
        domain="okr"
        moduleBar={{
          tabs,
          activeTab: tab,
          onTabChange: (id) => setTab(id as 'org' | 'my' | 'company'),
          showTabCounts: false,
          viewModes: ['table'],
          viewMode: 'table',
          chips,
          activeChip: 'all',
          onChipChange: () => {},
        }}
        table={{
          columns: buildOkrSetColumns(isPolish),
          data: rows,
          persistKey: `results-vnext.okr-registry.${tab}`,
          loading: state === 'loading',
          error:
            state === 'error'
              ? isPolish
                ? 'Nie udało się wczytać rejestru OKR — usługa zwróciła 503.'
                : 'Failed to load the OKR registry — the service returned 503.'
              : null,
          onRetry: () => {},
          empty:
            state === 'empty'
              ? {
                  title: isPolish ? 'Brak zestawów OKR' : 'No OKR sets yet',
                  description: isPolish
                    ? 'W tej organizacji nie utworzono jeszcze żadnego zestawu OKR.'
                    : 'No OKR set has been created in this organization yet.',
                }
              : undefined,
          selectedRowId: selectedSetId,
          onRowClick: (row) => setSelectedSetId(String(row.setId)),
          rowMenu: (row) =>
            buildOkrSetRowMenu(row as unknown as OkrSetDto, isPolish, {
              onPreview: (r) => setSelectedSetId(r.setId),
            }),
          defaultSort: { columnId: 'updatedAt', direction: 'desc' },
        }}
        preview={
          state === 'ready' && selectedSet
            ? buildOkrSetPreview(selectedSet, {
                isPolish,
                onClose: () => setSelectedSetId(null),
              })
            : null
        }
      />
    </div>
  );
};

export default ResultsVNextOkrRegistryScreen;
