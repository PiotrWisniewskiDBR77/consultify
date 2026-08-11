/**
 * ResultsOkrHub — RN-G2 P3 #23, the real "/results/okr" screen: OKR Set
 * registry list + preview (RN_G2_UI_SCOPE.md §G #23), PLUS (RN-G2 §G #25,
 * added 2026-08-11) a breadcrumb drill-down into Objectives → Key Results →
 * Check-ins for whichever Set the user opens. Deliberately NOT the full
 * alignment/review/closing tool (§G #26-#29) — those are later packages.
 * Mirrors `../roi/ResultsRoiHub.tsx` exactly for the Sets-tab part.
 *
 * ── §G #25 drill-down (Objectives/Key Results/Check-ins) ────────────────
 * See `OkrObjectivesView.tsx`'s header for the full routing-decision
 * writeup (breadcrumb drill under this SAME `/results/okr` route, not new
 * tabs, not new routes — every level below Sets is structurally scoped to
 * exactly one parent, which is what breadcrumbs are for). This Hub owns the
 * drill NAVIGATION STATE (`drill`) and computes each level's `breadcrumbs`
 * array so a click at any point in the chain jumps straight back — the
 * `OkrObjectivesView`/`OkrKeyResultsView`/`OkrCheckInsView` components
 * themselves only render whichever `breadcrumbs` array they're handed, they
 * never build their own.
 *
 * Three Menu 2 tabs, all real backend data, no fabricated rows:
 *  - "Organization" → `GET /sets` (§C `okr.routes.ts` `/sets`), every Set
 *                      visible to the caller under ABAC, no scope narrowing.
 *  - "My"           → `GET /my` (§C `okr.routes.ts` `/my`) — Set-level
 *                      ownership (owner OR reviewer) only. NOTE: the REAL
 *                      route is a top-level `/my`, NOT `/sets/my` as the
 *                      task brief assumed — verified by reading
 *                      `okr.routes.ts` L918 directly (see `okrApi.ts`
 *                      header for the full citation).
 *  - "Company"      → `GET /company` (§C `okr.routes.ts` `/company`) — same
 *                      `listOkrSets` repository call as Organization, pinned
 *                      to `scopeType='company'` server-side. Also a
 *                      top-level route, NOT `/sets/company`.
 *
 * All three tabs return the identical `OkrSetDto` shape (`okrApi.ts` header
 * note) — one shared column/row-menu/preview builder set
 * (`okrRegistryPresenters.tsx`) covers every tab, no per-tab variant needed.
 *
 * Menu 3 chips bucket the real 10-state machine into 4 groups
 * (`OKR_SET_STATUS_BUCKET` in `okrRegistryMappers.ts`) — counts always
 * shown, including 0, computed from the currently loaded page. Filtering is
 * CLIENT-SIDE on all three tabs (not just "My", which has no server-side
 * status filter at all) for one consistent chip-filtering story across tabs,
 * matching the ROI Hub's own "All cases" precedent.
 *
 * Deep link (§D "forbidden"): `?setId=<id>` resolves via `getOkrSet` — the
 * ONE genuine use of the detail endpoint in this package (see `okrApi.ts`
 * header for why a per-row lazy fetch on selection would be pointless N+1
 * for zero new data). Mirrors `ResultsKpiRegistryPage.tsx`'s own `?kpiId=`
 * pattern: the backend collapses "does not exist" and "visibility denied"
 * into the same 404, so this always renders `NO_VISIBILITY_RECORD`
 * (RN_G1_PLATFORM_DESIGN.md §B's own documented fail-closed default) rather
 * than inventing a reason the API never told it.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { StandardBreadcrumb, StandardCounterChip, StandardModuleTab, TableRow } from '@/components/standard';

import { ResultsVNextRegistryShell } from '../ResultsVNextRegistryShell';
import type { ResultsVNextForbiddenDetail } from '../types';
import {
  getOkrSet,
  listCompanyOkrSets,
  listMyOkrSets,
  listOkrSets,
  type OkrSetDto,
} from './okrApi';
import {
  OKR_SET_STATUS_BUCKET,
  OKR_SET_STATUS_BUCKET_LABEL,
  type OkrSetStatusBucket,
} from './okrRegistryMappers';
import { buildOkrSetColumns, buildOkrSetPreview, buildOkrSetRowMenu } from './okrRegistryPresenters';
import type { OkrKeyResultDto, OkrObjectiveWithKeyResultsDto } from './okrObjectiveApi';
import { OkrObjectivesView } from './OkrObjectivesView';
import { OkrKeyResultsView } from './OkrKeyResultsView';
import { OkrCheckInsView } from './OkrCheckInsView';
import { OkrSetWorkspace } from './OkrSetWorkspace';

type OkrTab = 'org' | 'my' | 'company';
const OKR_SETS_FETCH_LIMIT = 200;

// ==========================================
// RN-G2 §G #25 — drill-down navigation state (see file header). RN-G3 lane
// `okr` full-tool task (2026-08-11) adds `'workspace'` — the FULL OKR tool
// for one Set (`OkrSetWorkspace.tsx`: Overview/Objectives & Key
// Results/Alignment/Conversations & Support/Review & Reflection/History).
// The pre-existing `'objectives'|'keyResults'|'checkIns'` levels are left
// UNCHANGED (still reachable from the Set preview's "Cele" action, per the
// already-accepted §G #25 package) — `'workspace'` is a genuinely additive
// FOURTH entry point, not a replacement, so the already-shipped/QA'd drill
// keeps working byte-for-byte for anyone still using it.
// ==========================================

type OkrDrill =
  | { level: 'objectives'; set: OkrSetDto }
  | { level: 'keyResults'; set: OkrSetDto; objective: OkrObjectiveWithKeyResultsDto }
  | { level: 'checkIns'; set: OkrSetDto; objective: OkrObjectiveWithKeyResultsDto; keyResult: OkrKeyResultDto }
  | { level: 'workspace'; set: OkrSetDto };

function withId<T extends { setId: string }>(row: T): T & { id: string } {
  return { ...row, id: row.setId };
}

export const ResultsOkrHub: React.FC = () => {
  const { i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');

  const [tab, setTab] = useState<OkrTab>('org');
  const [chip, setChip] = useState<'all' | OkrSetStatusBucket>('all');

  const [sets, setSets] = useState<OkrSetDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState<ResultsVNextForbiddenDetail | null>(null);

  // RN-G2 §G #25 — drill-down (see file header). `null` = showing the Sets
  // registry (unchanged §G #23 behaviour).
  const [drill, setDrill] = useState<OkrDrill | null>(null);

  const setsLabel = isPolish ? 'Zestawy OKR' : 'OKR sets';

  const loadSets = useCallback((activeTab: OkrTab) => {
    setLoading(true);
    setError(null);
    const fetcher =
      activeTab === 'org'
        ? listOkrSets({ limit: OKR_SETS_FETCH_LIMIT })
        : activeTab === 'my'
          ? listMyOkrSets({ limit: OKR_SETS_FETCH_LIMIT })
          : listCompanyOkrSets({ limit: OKR_SETS_FETCH_LIMIT });
    fetcher
      .then((rows) => setSets(rows))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // Refetch on every tab switch — each tab is a genuinely different query
    // (different endpoint / scope filter), not a client-side re-slice of
    // one shared list, so a stale cross-tab cache would be dishonest.
    setSets(null);
    setSelectedSetId(null);
    loadSets(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Deep link (§D "forbidden") — ?setId=<id> pre-selects/validates a record,
  // independent of whichever tab is currently active.
  useEffect(() => {
    const deepLinkSetId = new URLSearchParams(window.location.search).get('setId');
    if (!deepLinkSetId) return;
    let cancelled = false;
    (async () => {
      try {
        const set = await getOkrSet(deepLinkSetId);
        if (cancelled) return;
        if (!set) {
          setForbidden({ reason: 'NO_VISIBILITY_RECORD' });
        } else {
          setSelectedSetId(set.setId);
        }
      } catch {
        if (!cancelled) setForbidden({ reason: 'NO_VISIBILITY_RECORD' });
      }
    })();
    return () => {
      cancelled = true;
    };
    // Runs once on mount only — a deep link is a load-time concern, not a
    // per-tab-switch one (matches `ResultsKpiRegistryPage.tsx`'s own effect).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bucketCounts = useMemo(() => {
    const counts: Record<OkrSetStatusBucket, number> = {
      in_progress: 0,
      in_review: 0,
      active: 0,
      closed_out: 0,
    };
    for (const s of sets ?? []) counts[OKR_SET_STATUS_BUCKET[s.status]] += 1;
    return counts;
  }, [sets]);

  const filteredSets = useMemo(() => {
    if (!sets) return [];
    if (chip === 'all') return sets;
    return sets.filter((s) => OKR_SET_STATUS_BUCKET[s.status] === chip);
  }, [sets, chip]);

  const selectedSet = useMemo(
    () => (sets ?? []).find((s) => s.setId === selectedSetId) ?? null,
    [sets, selectedSetId]
  );

  const tabs: StandardModuleTab[] = [
    { id: 'org', label: isPolish ? 'Organizacja' : 'Organization' },
    { id: 'my', label: isPolish ? 'Moje' : 'My' },
    { id: 'company', label: isPolish ? 'Firma' : 'Company' },
  ];

  const chips: StandardCounterChip[] = [
    { id: 'all', label: isPolish ? 'Wszystkie' : 'All', count: sets?.length ?? 0 },
    {
      id: 'in_progress',
      label: isPolish ? OKR_SET_STATUS_BUCKET_LABEL.in_progress.pl : OKR_SET_STATUS_BUCKET_LABEL.in_progress.en,
      count: bucketCounts.in_progress,
    },
    {
      id: 'in_review',
      label: isPolish ? OKR_SET_STATUS_BUCKET_LABEL.in_review.pl : OKR_SET_STATUS_BUCKET_LABEL.in_review.en,
      count: bucketCounts.in_review,
    },
    {
      id: 'active',
      label: isPolish ? OKR_SET_STATUS_BUCKET_LABEL.active.pl : OKR_SET_STATUS_BUCKET_LABEL.active.en,
      count: bucketCounts.active,
    },
    {
      id: 'closed_out',
      label: isPolish ? OKR_SET_STATUS_BUCKET_LABEL.closed_out.pl : OKR_SET_STATUS_BUCKET_LABEL.closed_out.en,
      count: bucketCounts.closed_out,
    },
  ];

  const rows: TableRow[] = filteredSets.map(withId);
  const emptyOrgCopy = {
    org: {
      title: isPolish ? 'Brak zestawów OKR' : 'No OKR sets yet',
      description: isPolish
        ? 'W tej organizacji nie utworzono jeszcze żadnego zestawu OKR.'
        : 'No OKR set has been created in this organization yet.',
    },
    my: {
      title: isPolish ? 'Brak Twoich zestawów OKR' : 'No OKR sets for you yet',
      description: isPolish
        ? 'Nie jesteś jeszcze właścicielem ani recenzentem żadnego zestawu OKR.'
        : "You're not yet the owner or reviewer of any OKR set.",
    },
    company: {
      title: isPolish ? 'Brak firmowych zestawów OKR' : 'No company-level OKR sets yet',
      description: isPolish
        ? 'Nie utworzono jeszcze żadnego zestawu OKR o zasięgu firmowym.'
        : 'No company-scoped OKR set has been created yet.',
    },
  }[tab];

  // RN-G2 §G #25 — breadcrumb chains for each drill level. Every crumb
  // except the current (last) one is clickable, jumping straight back —
  // `undefined onClick` on the last crumb is `StandardModuleBar`'s own
  // "current page, not a link" convention (`StandardBreadcrumb.onClick` is
  // optional; the facade renders the last crumb un-clickable regardless,
  // this just avoids wiring a handler that would never fire).
  if (drill?.level === 'objectives') {
    const breadcrumbs: StandardBreadcrumb[] = [
      { label: setsLabel, onClick: () => setDrill(null) },
      { label: drill.set.title },
    ];
    return (
      <OkrObjectivesView
        set={drill.set}
        isPolish={isPolish}
        breadcrumbs={breadcrumbs}
        onOpenKeyResults={(objective, set) => setDrill({ level: 'keyResults', set, objective })}
      />
    );
  }

  if (drill?.level === 'keyResults') {
    const breadcrumbs: StandardBreadcrumb[] = [
      { label: setsLabel, onClick: () => setDrill(null) },
      { label: drill.set.title, onClick: () => setDrill({ level: 'objectives', set: drill.set }) },
      { label: drill.objective.title },
    ];
    return (
      <OkrKeyResultsView
        set={drill.set}
        objectiveId={drill.objective.objectiveId}
        isPolish={isPolish}
        breadcrumbs={breadcrumbs}
        onOpenCheckIns={(keyResult, objective, set) => setDrill({ level: 'checkIns', set, objective, keyResult })}
      />
    );
  }

  if (drill?.level === 'workspace') {
    return (
      <OkrSetWorkspace
        set={drill.set}
        isPolish={isPolish}
        setsLabel={setsLabel}
        onBackToSets={() => setDrill(null)}
        onSetChanged={(updated) => {
          setSets((prev) => (prev ? prev.map((s) => (s.setId === updated.setId ? updated : s)) : prev));
          setDrill({ level: 'workspace', set: updated });
        }}
      />
    );
  }

  if (drill?.level === 'checkIns') {
    const breadcrumbs: StandardBreadcrumb[] = [
      { label: setsLabel, onClick: () => setDrill(null) },
      { label: drill.set.title, onClick: () => setDrill({ level: 'objectives', set: drill.set }) },
      {
        label: drill.objective.title,
        onClick: () => setDrill({ level: 'keyResults', set: drill.set, objective: drill.objective }),
      },
      { label: drill.keyResult.title },
    ];
    return (
      <OkrCheckInsView
        set={drill.set}
        objective={drill.objective}
        keyResult={drill.keyResult}
        isPolish={isPolish}
        breadcrumbs={breadcrumbs}
      />
    );
  }

  return (
    <ResultsVNextRegistryShell
      domain="okr"
      moduleBar={{
        tabs,
        activeTab: tab,
        onTabChange: (id) => setTab(id as OkrTab),
        showTabCounts: false,
        viewModes: ['table'],
        viewMode: 'table',
        chips,
        activeChip: chip,
        onChipChange: (id) => setChip(id as 'all' | OkrSetStatusBucket),
      }}
      table={{
        columns: buildOkrSetColumns(isPolish),
        data: rows,
        persistKey: `results-vnext.okr-registry.${tab}`,
        loading,
        error,
        onRetry: () => loadSets(tab),
        empty:
          !loading && !error && rows.length === 0
            ? chip === 'all'
              ? emptyOrgCopy
              : {
                  title: isPolish ? 'Brak wierszy dla tego filtra' : 'No rows for this filter',
                  description: isPolish ? 'Żaden zestaw nie pasuje do tego filtra.' : 'No set matches this filter.',
                }
            : undefined,
        selectedRowId: selectedSetId,
        onRowClick: (row) => setSelectedSetId(String(row.setId)),
        rowMenu: (row) =>
          buildOkrSetRowMenu(row as unknown as OkrSetDto, isPolish, {
            onPreview: (r) => setSelectedSetId(r.setId),
            onOpenObjectives: (r) => setDrill({ level: 'objectives', set: r }),
            onOpenWorkspace: (r) => setDrill({ level: 'workspace', set: r }),
          }),
        defaultSort: { columnId: 'updatedAt', direction: 'desc' },
      }}
      preview={
        selectedSet
          ? buildOkrSetPreview(selectedSet, {
              isPolish,
              onClose: () => setSelectedSetId(null),
              onOpenObjectives: (r) => setDrill({ level: 'objectives', set: r }),
              onOpenWorkspace: (r) => setDrill({ level: 'workspace', set: r }),
            })
          : null
      }
      forbidden={forbidden}
      onForbiddenBack={() => setForbidden(null)}
    />
  );
};

export default ResultsOkrHub;
