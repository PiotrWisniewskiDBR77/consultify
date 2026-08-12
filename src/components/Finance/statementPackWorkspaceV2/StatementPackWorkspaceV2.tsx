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
 * ★ ZA FLAGĄ (CLAUDE.md #7): ten plik nie jest montowany przez ŻADEN
 * produkcyjny ekran — `FinancialStatementPackWorkspace.tsx` (poza allowlistą
 * tego pakietu) nadal renderuje swoją bespoke ścieżkę. Wpięcie za
 * `useFinanceStatementPackWorkspaceV2Flag` jest przyszłym krokiem integracji,
 * jawnie NIEDOSTARCZONYM w tym pakiecie — patrz raport §„Co niepokryte".
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
  createFinanceArtifact,
  getFinanceVersionLineage,
  getStatementReconciliationRun,
  listStatementLines,
  listStatementReconciliationRuns,
  transitionFinanceVersion,
} from '@/services/api/financeV2.api';
import type {
  LineageEdgeDto,
  ReconciliationRunDetailDto,
  ReconciliationRunSummaryDto,
  StatementLineDto,
  VersionLineageDto,
  FinanceArtifactType,
} from '@/services/api/financeV2.types';

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

export interface StatementPackWorkspaceV2Fetchers {
  listLines: (businessVersionId: string) => Promise<StatementLineDto[]>;
  getLineage: (businessVersionId: string) => Promise<VersionLineageDto>;
  listReconciliationRuns: (businessVersionId: string) => Promise<ReconciliationRunSummaryDto[]>;
  getReconciliationRunDetail: (reconciliationRunId: string) => Promise<ReconciliationRunDetailDto>;
  /** Krok 1 sekcji raportu — REALNY endpoint (`POST /finance-v2/artifacts`, artifactType=REPORT_EXPORT), nie atrapa. */
  generateReportDraft: () => Promise<ReportArtifactRef>;
  /** Krok 3 — REALNY endpoint (`POST /versions/:id/transitions`, action=submit_for_review). */
  publishReport: (ref: ReportArtifactRef) => Promise<void>;
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
};

export interface StatementPackWorkspaceV2Props {
  businessVersionId: string;
  resolveLineLabel: (rowKey: string, canonicalLineId: string | null, lineCode: string | null) => string;
  fetchers?: Partial<StatementPackWorkspaceV2Fetchers>;
  onOpenArtifact: (edge: LineageEdgeDto) => void;
  onCreateNew: (artifactType: FinanceArtifactType, sourceBusinessVersionId: string) => void;
  /** Wołane, gdy użytkownik klika "Otwórz wynik" po udanym wygenerowaniu szkicu raportu — routing jest zadaniem wywołującego. */
  onOpenReportResult: (ref: ReportArtifactRef) => void;
}

type AsyncListState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'loaded'; data: T };

export function StatementPackWorkspaceV2(props: StatementPackWorkspaceV2Props): React.ReactElement {
  const { businessVersionId, resolveLineLabel, onOpenArtifact, onCreateNew, onOpenReportResult } = props;
  const fetchers: StatementPackWorkspaceV2Fetchers = useMemo(
    () => ({ ...DEFAULT_FETCHERS, ...props.fetchers }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.fetchers]
  );

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

  return (
    <div className="flex h-full gap-3" data-testid="statement-pack-workspace-v2">
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
  );
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
