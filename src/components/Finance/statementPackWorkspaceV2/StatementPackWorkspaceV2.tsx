/**
 * `StatementPackWorkspaceV2` — brief pkt 1: "domknij pion Statements".
 *
 * Zestawia REALNE, już zweryfikowane komponenty tego pakietu w JEDEN widok
 * roboczy: `CanonicalStatementTableV2` (główna tabela) + `SourceEvidencePanel`
 * (dowód dla wybranej komórki, ★ ŁAŃCUCH: krok 1 = `FinanceValue.sourceRef`,
 * krok 2 = `mappingRow` z rekoncyliacji) + `NamedCollapsibleSection`×3
 * (Rekoncyliacja / Powiązane artefakty / Sekcja raportu) opakowujące
 * `ReconciliationLedgerPanel`, `RelatedArtifactsSection`,
 * `StatementReportActionsSection`.
 *
 * Dane WYŁĄCZNIE z realnego kontraktu B2 (`financeV2.api.ts`) — wstrzykiwane
 * przez `fetchers` (domyślnie prawdziwe funkcje klienta), tak żeby ten sam
 * komponent dało się bez mocków sieciowych testować (Vitest) i renderować w
 * `dev-render` (harness, mock fetchers z realistycznym kształtem — CLAUDE.md
 * #7, ten sam wzorzec co `ValueOfficePanel.valueBridgeFetcher` w Pakiecie
 * Economics).
 *
 * ★ ZA FLAGĄ (CLAUDE.md #7/#9): eksportowany `StatementPackWorkspaceV2`
 * odczytuje `useFinanceStatementPackWorkspaceV2Flag().enabled` SAM (nie
 * tylko caller) — przy `false` zwraca `null` PRZED zamontowaniem
 * `StatementPackWorkspaceV2Inner`, więc żaden z trzech `useEffect`y ładujących
 * dane na mount nigdy się nie uruchamia. `FinancialStatementPackWorkspace.tsx`
 * (poza allowlistą tego pakietu) nadal renderuje swoją bespoke ścieżkę —
 * wpięcie TEGO pliku jako gałęzi WEWNĄTRZ `FinancialStatementPackWorkspace`
 * pozostaje przyszłym krokiem integracji, jawnie NIEDOSTARCZONYM tutaj
 * (poza zakresem AP_MOUNT §C, patrz raport).
 *
 * ★ C/D/E (AP_MOUNT §C/§D/§E): ten plik wcześniej NIE importował
 * `FinanceWorkspaceBar`/`FinanceErrorBoundary`/`useFinanceFocusMode` w ogóle
 * (jedyny z pięciu workspace'ów bez wspólnego paska) — dodane tutaj, tym
 * samym wzorcem co Baseline/Prediction/Valuation/Analysis. Tożsamość
 * (nazwa/status/wersja/freshness) jest doczytywana z `getFinanceBusinessVersion`
 * + `getFinanceArtifact` (ten sam dwukrokowy wzorzec co inne workspace'y —
 * `businessVersionId` → `artifactId` → `naturalKey`), bo props tego
 * komponentu nigdy nie niosły `artifactId`/nazwy (widok był montowany bez
 * chrome). Lifecycle (`transitionFinanceVersion`/`approveFinanceModel`/
 * `reopenFinanceModel`) używa DOKŁADNIE tego samego zestawu przejść co
 * `BaselineWorkspace.tsx` (`lifecycleTransitionsFor`) — generyczny automat
 * `BusinessVersionStatus`, nie specyficzny dla Baseline.
 *
 * Rekoncyliacja: TYLKO odczyt ledgera (patrz komentarz w
 * `ReconciliationLedgerPanel.tsx`) — mapowanie/reconcile wymagają
 * `rawLines`/`rules`, których ten workspace (widok już-zmapowanego packa) nie
 * posiada. Krok mapowania w `SourceEvidencePanel` (mappingRow) działa
 * WYŁĄCZNIE dla przebiegów, które już istnieją w ledgerze — honest UI: dopóki
 * użytkownik nie wybierze przebiegu, panel dowodowy pokazuje tylko krok 1
 * (sourceRef), nie fabrykuje kroku 2.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  approveFinanceModel,
  createFinanceArtifact,
  getFinanceArtifact,
  getFinanceBusinessVersion,
  getFinanceVersionLineage,
  getStatementReconciliationRun,
  listStatementLines,
  listStatementReconciliationRuns,
  renameFinanceArtifact,
  reopenFinanceModel,
  transitionFinanceVersion,
  type RoutableTransitionAction,
} from '@/services/api/financeV2.api';
import {
  describeFinanceV2Error,
  type BusinessVersionStatus,
  type FinanceArtifactFreshness,
  type LineageEdgeDto,
  type ReconciliationRunDetailDto,
  type ReconciliationRunSummaryDto,
  type StatementLineDto,
  type VersionLineageDto,
  type FinanceArtifactType,
} from '@/services/api/financeV2.types';

import { FinanceErrorBoundary } from '../shared/FinanceErrorBoundary';
import { FinanceWorkspaceBar } from '../shared/FinanceWorkspaceBar';
import {
  ENABLEMENT_ALWAYS,
  type WorkspaceBarConfig,
  type WorkspaceBarEvaluationContext,
  type WorkspaceBarLifecycleTransition,
  type WorkspaceBarMoreMenuItem,
} from '../shared/financeWorkspaceBar.contract';
import { useFinanceFocusMode } from '../../../hooks/useFinanceFocusMode';
import { useFinanceStatementPackWorkspaceV2Flag } from '../../../hooks/useFinanceStatementPackWorkspaceV2Flag';

import {
  CanonicalStatementTableV2,
  type CanonicalStatementCellSelection,
} from './CanonicalStatementTableV2';
import { canonicalLineIdFromRowKey, findReconciliationDetailRowForCell } from './deriveStatementTable';
import { NamedCollapsibleSection } from './NamedCollapsibleSection';
import { ReconciliationLedgerPanel } from './ReconciliationLedgerPanel';
import { RelatedArtifactsSection } from './RelatedArtifactsSection';
import { SourceEvidencePanel } from './SourceEvidencePanel';
import {
  StatementReportActionsSection,
  type ReportDraftStageStatus,
  type ReportOpenStageStatus,
  type ReportPublishStageStatus,
} from './StatementReportActionsSection';

export interface ReportArtifactRef {
  artifactId: string;
  businessVersionId: string;
  version: number;
}

export interface StatementPackIdentityDto {
  artifactId: string;
  name: string;
  status: BusinessVersionStatus;
  freshness: FinanceArtifactFreshness;
  versionNo: number;
  version: number;
}

export interface StatementPackWorkspaceV2Fetchers {
  listLines: (businessVersionId: string) => Promise<StatementLineDto[]>;
  getLineage: (businessVersionId: string) => Promise<VersionLineageDto>;
  listReconciliationRuns: (businessVersionId: string) => Promise<ReconciliationRunSummaryDto[]>;
  getReconciliationRunDetail: (reconciliationRunId: string) => Promise<ReconciliationRunDetailDto>;
  /** Krok 1 sekcji raportu — REALNY endpoint (`POST /finance-v2/artifacts`, artifactType=REPORT_EXPORT), nie atrapa. */
  generateReportDraft: () => Promise<ReportArtifactRef>;
  /** Krok 3 — REALNY endpoint (`POST /versions/:id/transitions`, action=submit_for_review). */
  publishReport: (ref: ReportArtifactRef) => Promise<void>;
  /** §C — tożsamość paska: `GET /versions/:id` + `GET /artifacts/:id`, dwukrokowo (jak `AnalysisWorkspace`). */
  getIdentity: (businessVersionId: string) => Promise<StatementPackIdentityDto>;
  /** §C — OWN-FIN-011 rename kontrolowany. */
  renameArtifact: (artifactId: string, nextName: string) => Promise<void>;
  /** §C — lifecycle (poza approve/reopen, patrz `approveModel`/`reopenModel`). */
  transitionVersion: (params: { businessVersionId: string; action: RoutableTransitionAction; expectedVersion: number; reason?: string }) => Promise<{ status: BusinessVersionStatus; version: number }>;
  /** Zwraca `void` celowo — `FinanceApproveModelResultDto.status` to literał `'approved'` (nie `BusinessVersionStatus`); caller po sukcesie sam ustawia `'APPROVED'` (ten sam wzorzec co `BaselineWorkspace.handleLifecycleTransition`). */
  approveModel: (params: { modelArtifactId: string; expectedVersion: number }) => Promise<void>;
  reopenModel: (params: { modelArtifactId: string; reason: string; idempotencyKey: string }) => Promise<{ status: BusinessVersionStatus; versionNo: number }>;
}

const DEFAULT_FETCHERS: StatementPackWorkspaceV2Fetchers = {
  listLines: (businessVersionId) => listStatementLines(businessVersionId),
  getLineage: (businessVersionId) => getFinanceVersionLineage(businessVersionId),
  listReconciliationRuns: (businessVersionId) => listStatementReconciliationRuns(businessVersionId),
  getReconciliationRunDetail: (reconciliationRunId) => getStatementReconciliationRun(reconciliationRunId),
  generateReportDraft: async () => {
    const created = await createFinanceArtifact({ artifactType: 'REPORT_EXPORT' });
    return {
      artifactId: created.artifactId,
      businessVersionId: created.currentBusinessVersion.businessVersionId,
      version: created.currentBusinessVersion.version,
    };
  },
  publishReport: async (ref) => {
    await transitionFinanceVersion({
      businessVersionId: ref.businessVersionId,
      action: 'submit_for_review',
      expectedVersion: ref.version,
    });
  },
  getIdentity: async (businessVersionId) => {
    const bv = await getFinanceBusinessVersion(businessVersionId);
    const artifact = await getFinanceArtifact(bv.artifactId);
    return {
      artifactId: bv.artifactId,
      name: artifact.naturalKey ?? 'Sprawozdanie bez nazwy',
      status: bv.status,
      freshness: bv.freshness,
      versionNo: bv.versionNo,
      version: bv.version,
    };
  },
  renameArtifact: async (artifactId, nextName) => {
    await renameFinanceArtifact(artifactId, nextName);
  },
  transitionVersion: (params) => transitionFinanceVersion(params),
  approveModel: async (params) => {
    await approveFinanceModel(params);
  },
  reopenModel: (params) => reopenFinanceModel(params),
};

export interface StatementPackWorkspaceV2Props {
  businessVersionId: string;
  resolveLineLabel: (rowKey: string, canonicalLineId: string | null, lineCode: string | null) => string;
  fetchers?: Partial<StatementPackWorkspaceV2Fetchers>;
  onOpenArtifact: (edge: LineageEdgeDto) => void;
  onCreateNew: (artifactType: FinanceArtifactType, sourceBusinessVersionId: string) => void;
  /** Wołane, gdy użytkownik klika "Otwórz wynik" po udanym wygenerowaniu szkicu raportu — routing jest zadaniem wywołującego. */
  onOpenReportResult: (ref: ReportArtifactRef) => void;
  /** Kanon paska (§C): powrót do listy z identity bloku `FinanceWorkspaceBar`. Domyślnie no-op (harness/testy). */
  onNavigateBack?: () => void;
}

type AsyncListState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'loaded'; data: T };

/**
 * Gate publiczny (CLAUDE.md #7/#9): przy `financeStatementPackWorkspaceV2`
 * OFF zwraca `null` PRZED zamontowaniem `StatementPackWorkspaceV2Inner` —
 * żaden z trzech `useEffect`y ładujących linie/lineage/rekoncyliację nigdy
 * się nie uruchamia. Flaga jest jedynym hookiem tego komponentu.
 */
export function StatementPackWorkspaceV2(props: StatementPackWorkspaceV2Props): React.ReactElement | null {
  const { enabled } = useFinanceStatementPackWorkspaceV2Flag();
  if (!enabled) return null;
  return <StatementPackWorkspaceV2Inner {...props} />;
}

function StatementPackWorkspaceV2Inner(props: StatementPackWorkspaceV2Props): React.ReactElement {
  const { businessVersionId, resolveLineLabel, onOpenArtifact, onCreateNew, onOpenReportResult, onNavigateBack = () => {} } = props;
  const fetchers: StatementPackWorkspaceV2Fetchers = useMemo(
    () => ({ ...DEFAULT_FETCHERS, ...props.fetchers }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.fetchers]
  );

  // ── Tożsamość paska (§C): props tego widoku nigdy nie niosły artifactId/
  // nazwy (montowany dotąd bez chrome) — doczytywana dwukrokowo, tak jak
  // `AnalysisWorkspace`: businessVersionId → artifactId (+status/freshness/
  // wersja) → naturalKey (nazwa). ──────────────────────────────────────────
  const [artifactId, setArtifactId] = useState<string | null>(null);
  const [name, setName] = useState('Sprawozdanie finansowe');
  const [status, setStatus] = useState<BusinessVersionStatus>('DRAFT');
  const [freshness, setFreshness] = useState<FinanceArtifactFreshness>('NEVER_COMPUTED');
  const [versionNo, setVersionNo] = useState(1);
  const [version, setVersion] = useState(1);
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);
  const [pendingReasonFor, setPendingReasonFor] = useState<{ kind: 'transition'; action: RoutableTransitionAction; destructive: boolean } | { kind: 'reopen' } | null>(null);
  const [reasonDraft, setReasonDraft] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchers
      .getIdentity(businessVersionId)
      .then((identity) => {
        if (cancelled) return;
        setArtifactId(identity.artifactId);
        setName(identity.name);
        setStatus(identity.status);
        setFreshness(identity.freshness);
        setVersionNo(identity.versionNo);
        setVersion(identity.version);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLifecycleError(describeFinanceV2Error(err).detail);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessVersionId, fetchers]);

  const [linesState, setLinesState] = useState<AsyncListState<StatementLineDto[]>>({ status: 'loading' });
  const [lineageState, setLineageState] = useState<AsyncListState<LineageEdgeDto[]>>({ status: 'loading' });
  const [runsState, setRunsState] = useState<AsyncListState<ReconciliationRunSummaryDto[]>>({ status: 'loading' });
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<ReconciliationRunDetailDto | null>(null);
  const [runDetailLoading, setRunDetailLoading] = useState(false);
  const [selection, setSelection] = useState<CanonicalStatementCellSelection | null>(null);

  const [draftStatus, setDraftStatus] = useState<ReportDraftStageStatus>('not_started');
  const [draftError, setDraftError] = useState<string | null>(null);
  const [openStatus, setOpenStatus] = useState<ReportOpenStageStatus>('blocked');
  const [publishStatus, setPublishStatus] = useState<ReportPublishStageStatus>('blocked');
  const [publishError, setPublishError] = useState<string | null>(null);
  const [reportArtifact, setReportArtifact] = useState<ReportArtifactRef | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLinesState({ status: 'loading' });
    fetchers
      .listLines(businessVersionId)
      .then((data) => {
        if (!cancelled) setLinesState({ status: 'loaded', data });
      })
      .catch((err: unknown) => {
        if (!cancelled) setLinesState({ status: 'error', error: err instanceof Error ? err.message : 'Nieznany błąd' });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessVersionId, fetchers]);

  useEffect(() => {
    let cancelled = false;
    setLineageState({ status: 'loading' });
    fetchers
      .getLineage(businessVersionId)
      .then((data) => {
        if (!cancelled) setLineageState({ status: 'loaded', data: data.descendants });
      })
      .catch((err: unknown) => {
        if (!cancelled) setLineageState({ status: 'error', error: err instanceof Error ? err.message : 'Nieznany błąd' });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessVersionId, fetchers]);

  useEffect(() => {
    let cancelled = false;
    setRunsState({ status: 'loading' });
    setSelectedRunId(null);
    setRunDetail(null);
    fetchers
      .listReconciliationRuns(businessVersionId)
      .then((data) => {
        if (!cancelled) setRunsState({ status: 'loaded', data });
      })
      .catch((err: unknown) => {
        if (!cancelled) setRunsState({ status: 'error', error: err instanceof Error ? err.message : 'Nieznany błąd' });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessVersionId, fetchers]);

  const handleSelectRun = useCallback(
    (runId: string) => {
      setSelectedRunId(runId);
      setRunDetail(null);
      setRunDetailLoading(true);
      fetchers
        .getReconciliationRunDetail(runId)
        .then((detail) => setRunDetail(detail))
        .catch(() => setRunDetail(null))
        .finally(() => setRunDetailLoading(false));
    },
    [fetchers]
  );

  const handleGenerateDraft = useCallback(() => {
    setDraftStatus('in_progress');
    setDraftError(null);
    fetchers
      .generateReportDraft()
      .then((ref) => {
        setReportArtifact(ref);
        setDraftStatus('ready');
        setOpenStatus('available');
      })
      .catch((err: unknown) => {
        setDraftStatus('failed');
        setDraftError(err instanceof Error ? err.message : 'Nieznany błąd');
      });
  }, [fetchers]);

  const handleOpenResult = useCallback(() => {
    if (!reportArtifact) return;
    setOpenStatus('opened');
    setPublishStatus('available');
    onOpenReportResult(reportArtifact);
  }, [reportArtifact, onOpenReportResult]);

  const handlePublish = useCallback(() => {
    if (!reportArtifact) return;
    setPublishStatus('in_progress');
    setPublishError(null);
    fetchers
      .publishReport(reportArtifact)
      .then(() => setPublishStatus('published'))
      .catch((err: unknown) => {
        setPublishStatus('failed');
        setPublishError(err instanceof Error ? err.message : 'Nieznany błąd');
      });
  }, [fetchers, reportArtifact]);

  const lines = linesState.status === 'loaded' ? linesState.data : [];
  const descendants = lineageState.status === 'loaded' ? lineageState.data : [];
  const runs = runsState.status === 'loaded' ? runsState.data : [];

  // ★ ŁAŃCUCH krok 2 — wyszukiwane TYLKO gdy użytkownik wybrał przebieg
  // rekoncyliacji I jego detal się wczytał; inaczej `mappingRow` zostaje
  // `undefined` (SourceEvidencePanel renderuje to jako "nie wyszukane", nie
  // "brak"), bo honest UI nie zgaduje kroku, który nie został jeszcze podjęty.
  const mappingRow = useMemo(() => {
    if (!selection || !runDetail) return undefined;
    const canonicalLineId = canonicalLineIdFromRowKey(selection.rowKey);
    return findReconciliationDetailRowForCell(
      { canonicalLineId, periodId: selection.periodId, entityId: selection.cell.entityId },
      runDetail.rows
    );
  }, [selection, runDetail]);

  const selectedRowLabel = selection
    ? resolveLineLabel(selection.rowKey, canonicalLineIdFromRowKey(selection.rowKey), null)
    : '';

  // ── Focus Mode (§E): stan roboczy (selekcja komórki + draft raportu +
  // przebieg rekoncyliacji) wchodzi jako referencja `workspaceState` — toggle
  // NIGDY go nie resetuje (dowód "nie refetchuje" — `__tests__/
  // StatementPackWorkspaceV2.focusMode.test.tsx`). Jeden widok (brak
  // zakładek), `activeViewId` stały.
  const focusMode = useFinanceFocusMode({
    workspaceState: { selection, selectedRunId, draftStatus, openStatus, publishStatus },
    activeViewId: 'statements',
  });

  // ── Odśwież (akcja primary paska) — ręczne przeładowanie wszystkich trzech
  // list + tożsamości, bez dotykania zależności montujących `useEffect`ów
  // (te zostają wyzwalane WYŁĄCZNIE przez zmianę `businessVersionId`, zgodnie
  // z resztą pliku). ──────────────────────────────────────────────────────
  const refreshAll = useCallback((): void => {
    setLinesState({ status: 'loading' });
    fetchers
      .listLines(businessVersionId)
      .then((data) => setLinesState({ status: 'loaded', data }))
      .catch((err: unknown) => setLinesState({ status: 'error', error: err instanceof Error ? err.message : 'Nieznany błąd' }));

    setLineageState({ status: 'loading' });
    fetchers
      .getLineage(businessVersionId)
      .then((data) => setLineageState({ status: 'loaded', data: data.descendants }))
      .catch((err: unknown) => setLineageState({ status: 'error', error: err instanceof Error ? err.message : 'Nieznany błąd' }));

    setRunsState({ status: 'loading' });
    fetchers
      .listReconciliationRuns(businessVersionId)
      .then((data) => setRunsState({ status: 'loaded', data }))
      .catch((err: unknown) => setRunsState({ status: 'error', error: err instanceof Error ? err.message : 'Nieznany błąd' }));
  }, [businessVersionId, fetchers]);

  // ── Lifecycle (§C) — DOKŁADNIE ten sam automat co `BaselineWorkspace.tsx`
  // (`lifecycleTransitionsFor`), generyczny nad `BusinessVersionStatus`. ───
  async function performTransition(action: RoutableTransitionAction, reason: string | undefined): Promise<void> {
    setLifecycleError(null);
    try {
      const result = await fetchers.transitionVersion({ businessVersionId, action, expectedVersion: version, reason });
      setStatus(result.status);
      setVersion(result.version);
    } catch (e) {
      setLifecycleError(describeFinanceV2Error(e).detail);
    }
  }

  async function handleLifecycleTransition(transition: WorkspaceBarLifecycleTransition): Promise<void> {
    if (!artifactId) {
      setLifecycleError('Tożsamość artefaktu jeszcze się nie wczytała — spróbuj ponownie za chwilę.');
      return;
    }
    if (transition.action === 'approve') {
      setLifecycleError(null);
      try {
        await fetchers.approveModel({ modelArtifactId: artifactId, expectedVersion: version });
        setStatus('APPROVED');
      } catch (e) {
        setLifecycleError(describeFinanceV2Error(e).detail);
      }
      return;
    }
    if (transition.action === 'reopen') {
      setPendingReasonFor({ kind: 'reopen' });
      return;
    }
    if (transition.action === 'save_draft' || transition.action === 'new_version') {
      setLifecycleError('Ta operacja nie ma dziś odpowiednika w API — zgłoszone jako niepokryte.');
      return;
    }
    const action = transition.action as RoutableTransitionAction;
    if (transition.requiresReason) {
      setPendingReasonFor({ kind: 'transition', action, destructive: transition.destructive });
      return;
    }
    await performTransition(action, undefined);
  }

  async function submitReason(): Promise<void> {
    if (!pendingReasonFor || !artifactId) return;
    const reason = reasonDraft.trim();
    if (reason.length === 0) return;
    setLifecycleError(null);
    try {
      if (pendingReasonFor.kind === 'reopen') {
        const result = await fetchers.reopenModel({ modelArtifactId: artifactId, reason, idempotencyKey: `reopen:${artifactId}:${businessVersionId}:${Date.now()}` });
        setStatus(result.status);
        setVersion(result.versionNo);
      } else {
        const result = await fetchers.transitionVersion({ businessVersionId, action: pendingReasonFor.action, expectedVersion: version, reason });
        setStatus(result.status);
        setVersion(result.version);
      }
    } catch (e) {
      setLifecycleError(describeFinanceV2Error(e).detail);
    } finally {
      setPendingReasonFor(null);
      setReasonDraft('');
    }
  }

  async function handleCommitRename(nextName: string): Promise<{ ok: true } | { ok: false; message: string }> {
    if (!artifactId) return { ok: false, message: 'Tożsamość artefaktu jeszcze się nie wczytała.' };
    try {
      await fetchers.renameArtifact(artifactId, nextName);
      setName(nextName);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: describeFinanceV2Error(e).detail };
    }
  }

  const config: WorkspaceBarConfig = {
    moduleId: 'statements',
    artifactType: 'STATEMENT_PACK',
    identity: {
      artifactRef: { artifactType: 'STATEMENT_PACK', businessVersionId, artifactId: artifactId ?? businessVersionId },
      back: { targetListRoute: '/finance/statements', label: { key: 'back', pl: 'Wróć do listy' } },
      name: {
        value: name,
        editable: ['DRAFT', 'READY_FOR_REVIEW', 'IN_REVIEW', 'NEEDS_CHANGES'].includes(status),
        editableBlockedReason: status === 'APPROVED' ? 'STATUS_IMMUTABLE' : null,
        maxChars: 120,
        layoutBudgetChars: 60,
      },
      version: { label: `v${versionNo}`, businessVersionId, hasUncommittedWorkingRevision: false },
      status,
      freshness,
      contextFields: ['type'],
    },
    viewNavigation: {
      kind: 'tabs',
      views: [{ id: 'statements', label: { key: 'statements', pl: 'Sprawozdanie' }, state: null }],
      activeViewId: 'statements',
      placement: 'in-bar',
    },
    actions: {
      primary: {
        kind: 'primary',
        id: 'primary.refresh',
        label: { key: 'refresh', pl: 'Odśwież' },
        enablement: ENABLEMENT_ALWAYS,
        mergesFreshness: false,
        keyboardCommandId: null,
      },
      secondary: null,
      lifecycle: {
        kind: 'lifecycle',
        id: 'lifecycle.status',
        label: { key: 'status', pl: lifecycleShortLabel(status) },
        enablement: ENABLEMENT_ALWAYS,
        transitions: lifecycleTransitionsFor(status),
      },
      more: null,
      fullscreen: {
        kind: 'fullscreen',
        id: 'fullscreen.toggle',
        label: { key: 'fullscreen', pl: 'Pełny ekran' },
        enablement: ENABLEMENT_ALWAYS,
        iconOnly: true,
        ariaLabel: { key: 'fullscreen.aria', pl: 'Tryb pełnego obszaru roboczego' },
      },
      extraDirectControls: [],
    },
  };

  const evaluationContext: WorkspaceBarEvaluationContext = { status, role: 'preparer', freshness, gates: {} };

  return (
    <div className="flex h-full min-h-screen w-full flex-col bg-c-bg" data-testid="statement-pack-workspace-v2">
      <FinanceWorkspaceBar
        config={config}
        evaluationContext={evaluationContext}
        contextValues={{ type: 'Sprawozdanie finansowe' }}
        onNavigateBack={onNavigateBack}
        onSelectView={() => {}}
        onPrimaryAction={refreshAll}
        onLifecycleTransition={(t) => void handleLifecycleTransition(t)}
        onMoreItem={(_item: WorkspaceBarMoreMenuItem) => {}}
        onEnterFocusMode={() => focusMode.enter('finance-workspace-bar-fullscreen')}
        onCommitRename={handleCommitRename}
      />

      {lifecycleError && (
        <p role="alert" className="border-b border-c-border-subtle bg-c-danger/5 px-4 py-1.5 text-xs text-c-danger" data-testid="statement-pack-lifecycle-error">
          {lifecycleError}
        </p>
      )}

      <FinanceErrorBoundary documentLabel={name} onRetry={refreshAll} onBackToList={onNavigateBack}>
        <div className="flex flex-1 gap-3 overflow-hidden p-3">
          <div className="min-w-0 flex-1">
            {linesState.status === 'error' ? (
              <div className="p-4 text-xs text-c-danger" data-testid="statement-pack-lines-error">
                Nie udało się wczytać linii sprawozdania: {linesState.error}
              </div>
            ) : (
              <CanonicalStatementTableV2
                lines={lines}
                resolveLineLabel={resolveLineLabel}
                selectedCellKey={selection ? `${selection.rowKey}::${selection.periodId}` : null}
                onSelectCell={setSelection}
                emptyLabel="Brak linii sprawozdania dla tej wersji."
              />
            )}
          </div>

          <div className="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto">
            <div className="rounded-xl border border-c-border-subtle bg-c-surface">
              <SourceEvidencePanel
                rowLabel={selectedRowLabel}
                periodLabel={selection?.periodId ?? ''}
                cell={selection?.cell ?? null}
                emptyLabel="Kliknij komórkę w tabeli, żeby zobaczyć jej dowód źródłowy."
                mappingRow={mappingRow}
              />
            </div>

            <div className="rounded-xl border border-c-border-subtle bg-c-surface">
              <NamedCollapsibleSection
                id="reconciliation"
                title="Rekoncyliacja"
                state={reconciliationSectionState(runsState, runs.length)}
                tone={runsState.status === 'error' ? 'danger' : 'neutral'}
                open={selectedRunId !== null}
                onToggle={() => {
                  if (selectedRunId !== null) {
                    setSelectedRunId(null);
                    setRunDetail(null);
                  } else if (runs.length > 0) {
                    handleSelectRun(runs[0]!.reconciliationRunId);
                  }
                }}
              >
                <ReconciliationLedgerPanel
                  runs={runs}
                  loading={runsState.status === 'loading'}
                  selectedRunId={selectedRunId}
                  onSelectRun={handleSelectRun}
                  runDetail={runDetail}
                  runDetailLoading={runDetailLoading}
                  emptyLabel="Brak przebiegów rekoncyliacji dla tej wersji."
                />
              </NamedCollapsibleSection>
            </div>

            <div className="rounded-xl border border-c-border-subtle bg-c-surface">
              <NamedCollapsibleSection
                id="related-artifacts"
                title="Powiązane artefakty"
                state={relatedArtifactsSectionState(lineageState, descendants.length)}
                tone={lineageState.status === 'error' ? 'danger' : 'neutral'}
                open
                onToggle={() => {}}
              >
                <RelatedArtifactsSection
                  sourceBusinessVersionId={businessVersionId}
                  descendants={descendants}
                  loading={lineageState.status === 'loading'}
                  loaded={lineageState.status === 'loaded'}
                  onOpenArtifact={onOpenArtifact}
                  onCreateNew={onCreateNew}
                />
              </NamedCollapsibleSection>
            </div>

            <div className="rounded-xl border border-c-border-subtle bg-c-surface">
              <NamedCollapsibleSection
                id="report"
                title="Sekcja raportu"
                state={reportSectionState(draftStatus, openStatus, publishStatus)}
                tone={publishStatus === 'published' ? 'ok' : draftStatus === 'failed' || publishStatus === 'failed' ? 'danger' : 'neutral'}
                open
                onToggle={() => {}}
              >
                <StatementReportActionsSection
                  draftStatus={draftStatus}
                  draftError={draftError}
                  openStatus={openStatus}
                  publishStatus={publishStatus}
                  publishError={publishError}
                  onGenerateDraft={handleGenerateDraft}
                  onOpenResult={handleOpenResult}
                  onPublish={handlePublish}
                />
              </NamedCollapsibleSection>
            </div>
          </div>
        </div>
      </FinanceErrorBoundary>

      {pendingReasonFor && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={() => setPendingReasonFor(null)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label="Podaj powód"
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-xl border border-c-border-subtle bg-c-surface p-4 shadow-xl"
            data-testid="statement-pack-reason-dialog"
          >
            <p className="text-sm font-semibold text-c-text">Podaj powód</p>
            <textarea
              autoFocus
              value={reasonDraft}
              onChange={(e) => setReasonDraft(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-lg border border-c-border-subtle bg-c-bg px-2 py-1.5 text-sm text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              data-testid="statement-pack-reason-input"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPendingReasonFor(null);
                  setReasonDraft('');
                }}
                className="inline-flex min-h-[2.75rem] items-center rounded-lg border border-c-border-subtle px-3.5 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                Anuluj
              </button>
              <button
                type="button"
                disabled={reasonDraft.trim().length === 0}
                onClick={() => void submitReason()}
                data-testid="statement-pack-reason-submit"
                className="inline-flex min-h-[2.75rem] items-center rounded-lg bg-c-danger px-3.5 text-xs font-semibold text-white hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-40"
              >
                Potwierdź
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function lifecycleShortLabel(status: BusinessVersionStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'Wersja robocza';
    case 'READY_FOR_REVIEW':
      return 'Gotowe do przeglądu';
    case 'IN_REVIEW':
      return 'W przeglądzie';
    case 'APPROVED':
      return 'Zatwierdzone';
    case 'NEEDS_CHANGES':
      return 'Wymaga zmian';
    case 'SUPERSEDED':
      return 'Zastąpione';
    case 'ARCHIVED':
      return 'Zarchiwizowane';
    case 'INVALIDATED':
      return 'Unieważnione';
    default:
      return status;
  }
}

/** Tylko przejścia z realnym odpowiednikiem w API (transitionFinanceVersion/approveFinanceModel/reopenFinanceModel) — ten sam automat co `BaselineWorkspace.tsx`. */
function lifecycleTransitionsFor(status: BusinessVersionStatus): WorkspaceBarLifecycleTransition[] {
  const t = (action: WorkspaceBarLifecycleTransition['action'], pl: string, opts: Partial<WorkspaceBarLifecycleTransition> = {}): WorkspaceBarLifecycleTransition => ({
    action,
    label: { key: action, pl },
    enablement: ENABLEMENT_ALWAYS,
    destructive: false,
    requiresConfirmation: false,
    requiresReason: false,
    ...opts,
  });

  switch (status) {
    case 'DRAFT':
      return [t('submit_for_review', 'Przekaż do przeglądu'), t('invalidate', 'Unieważnij', { destructive: true, requiresConfirmation: true, requiresReason: true })];
    case 'READY_FOR_REVIEW':
      return [t('start_review', 'Rozpocznij przegląd'), t('withdraw', 'Wycofaj z przeglądu')];
    case 'IN_REVIEW':
      return [
        t('approve', 'Zatwierdź', { requiresConfirmation: true }),
        t('request_changes', 'Poproś o zmiany', { requiresReason: true }),
      ];
    case 'NEEDS_CHANGES':
      return [t('resume_editing', 'Wróć do edycji')];
    case 'APPROVED':
      return [t('reopen', 'Otwórz ponownie', { destructive: true, requiresConfirmation: true, requiresReason: true })];
    default:
      return [];
  }
}

function reconciliationSectionState(state: AsyncListState<unknown>, count: number): string {
  if (state.status === 'loading') return 'ładowanie…';
  if (state.status === 'error') return 'błąd wczytywania';
  return `${count} ${count === 1 ? 'przebieg' : 'przebiegów'}`;
}

function relatedArtifactsSectionState(state: AsyncListState<unknown>, count: number): string {
  if (state.status === 'loading') return 'ładowanie…';
  if (state.status === 'error') return 'błąd wczytywania';
  return `${count} ${count === 1 ? 'powiązanie' : 'powiązań'}`;
}

function reportSectionState(
  draftStatus: ReportDraftStageStatus,
  openStatus: ReportOpenStageStatus,
  publishStatus: ReportPublishStageStatus
): string {
  if (publishStatus === 'published') return 'opublikowano';
  if (openStatus === 'opened') return 'otwarty, gotowy do publikacji';
  if (draftStatus === 'ready') return 'szkic gotowy';
  if (draftStatus === 'in_progress') return 'generowanie…';
  if (draftStatus === 'failed') return 'błąd generowania';
  return 'nie rozpoczęto';
}

export default StatementPackWorkspaceV2;
