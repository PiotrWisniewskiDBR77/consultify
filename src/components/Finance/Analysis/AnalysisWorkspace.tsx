/**
 * Pakiet E — Workspace Analizy Historycznej. Spina: `FinanceWorkspaceBar`
 * (Pakiet C, powłoka lifecycle/identity) + `AnalysisKpiTable` (tabela KPI,
 * OWN-FIN-014) + `AnalysisKpiDetailCard` (karta szczegółowa) +
 * `AnalysisCreatorWizard` (kreator — otwierany z pustego stanu/CTA). Logika
 * lifecycle/CTA/gate'ów żyje w `analysisWorkspace.contract.ts` (testowana
 * bez DOM); ten plik tylko ładuje dane, trzyma stan UI i tłumaczy kliknięcia
 * na wywołania `FinanceV2Api`.
 *
 * ★ UCZCIWOŚĆ WOBEC BACKENDU (patrz też nagłówki `analysisCreatorWizard.contract.ts`
 * i `AnalysisCreatorWizard.tsx`):
 *   - `includedInReportByKpiCode`/`markedAsModelInputByKpiCode` — stan
 *     WYŁĄCZNIE w pamięci komponentu. `analysis.routes.ts` nie ma endpointu
 *     zapisu tych flag (tylko `kpi-catalog`/`compute`/`kpi-values`, GET/GET/POST)
 *     — odświeżenie strony je resetuje. Nie udawane jako trwałe.
 *   - `periodColumns` są WYPROWADZONE z okresów obecnych w
 *     `GET /analysis/:id/kpi-values`; endpoint zwraca kanoniczną etykietę z
 *     `finance_stmt_periods`, więc UI nigdy nie pokazuje technicznego UUID jako
 *     nagłówka raportu.
 *   - Krok kreatora "Utwórz i przelicz" woła REALNE `createFinanceArtifact`+
 *     `computeAnalysisKpis` — jeśli backend odpowie `NO_SOURCE_STATEMENT_PACK_EDGE`
 *     (bo nie ma writer'a lineage), UI pokazuje ten honest błąd, nie fejkuje sukcesu.
 *   - `requiresReason` (np. `reopen`/`request_changes`) — `FinanceWorkspaceBar`
 *     (Pakiet C) ma dziś UI TYLKO dla `requiresConfirmation`, nie dla zbierania
 *     powodu tekstowego (zweryfikowane czytaniem całego pliku — `ConfirmDestructiveDialog`
 *     istnieje, żaden komponent zbierania tekstu nie istnieje). Ten plik używa
 *     natywnego `window.prompt` jako świadomego, udokumentowanego obejścia tej
 *     luki (nie cichego pominięcia wymogu powodu) — do czasu, aż Pakiet C doda
 *     właściwy dialog.
 *
 * UI za flagą `financeAnalysisWorkspaceV1`, domyślnie OFF (CLAUDE.md #7) —
 * eksportowany `AnalysisWorkspace` odczytuje `useFinanceAnalysisWorkspaceFlag()`
 * SAM (nie tylko caller): przy `false` zwraca `null` PRZED zamontowaniem
 * `AnalysisWorkspaceInner`, więc `reload()` (który dziś odpala się w
 * `useEffect` NA MOUNCIE, 4 równoległe wywołania API) nigdy się nie uruchamia.
 *
 * ★ D/E (AP_MOUNT §D/§E): ten plik wcześniej NIE miał `FinanceErrorBoundary`
 * ani realnego `useFinanceFocusMode` (`onEnterFocusMode` był no-opem) —
 * dodane tutaj, tym samym wzorcem co Baseline/Prediction/Valuation
 * (Pakiet C już to zapewnia dla tamtych trzech).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useFinanceAnalysisWorkspaceFlag } from '../../../hooks/useFinanceAnalysisWorkspaceFlag';
import { useFinanceFocusMode } from '../../../hooks/useFinanceFocusMode';
import {
  approveFinanceModel,
  computeAnalysisKpis,
  createFinanceArtifact,
  getAnalysisKpiCatalog,
  getAnalysisKpiValues,
  getFinanceArtifact,
  getFinanceBusinessVersion,
  renameFinanceArtifact,
  reopenFinanceModel,
  type RoutableTransitionAction,
  transitionFinanceVersion,
} from '../../../services/api/financeV2.api';
import {
  type AnalysisKpiCatalogEntryDto,
  type AnalysisKpiValueDto,
  type BusinessVersionStatus,
  describeFinanceV2Error,
  type FinanceArtifactFreshness,
  type FinanceRole,
} from '../../../services/api/financeV2.types';
import { FinanceErrorBoundary } from '../shared/FinanceErrorBoundary';
import { FinanceWorkspaceBar } from '../shared/FinanceWorkspaceBar';
import type {
  WorkspaceBarEvaluationContext,
  WorkspaceBarLifecycleTransition,
  WorkspaceBarMoreMenuItem,
} from '../shared/financeWorkspaceBar.contract';
import { AnalysisCreatorWizard } from './AnalysisCreatorWizard';
import type {
  AnalysisCreatorDraftPayload,
  AnalysisCreatorPeriodOption,
  AnalysisCreatorSourceOption,
} from './analysisCreatorWizard.contract';
import {
  AnalysisKpiDetailCard,
  type AnalysisKpiHistoryEntry,
  type AnalysisKpiPeriodSeriesPoint,
} from './AnalysisKpiDetailCard';
import { AnalysisKpiTable, type AnalysisKpiTablePeriodColumn } from './AnalysisKpiTable';
import {
  type AnalysisKpiCatalogFormulaInfo,
  computeYoyDelta,
  groupAnalysisKpiValuesByKpi,
} from './analysisKpiTable.contract';
import {
  ANALYSIS_HAS_KPIS_GATE,
  type AnalysisCompleteness,
  buildAnalysisWorkspaceBarConfig,
  canSubmitAnalysisForReview,
  resolveAnalysisPrimaryCta,
} from './analysisWorkspace.contract';

export interface AnalysisWorkspaceProps {
  artifactId: string;
  businessVersionId: string;
  role: FinanceRole;
  onNavigateBack: () => void;
  /** Kreator kroki 1/2 — brak endpointu listującego (patrz nagłówek), caller dostarcza kandydatów. Domyślnie puste — kreator pokaże uczciwy pusty stan, nie zmyśloną listę. */
  creatorSourceOptions?: AnalysisCreatorSourceOption[];
  creatorPeriodOptions?: AnalysisCreatorPeriodOption[];
  creatorAvailableLineCodes?: string[];
}

interface LoadState {
  loading: boolean;
  error: string | null;
}

/**
 * Gate publiczny (CLAUDE.md #7/#9): przy `financeAnalysisWorkspaceV1` OFF
 * zwraca `null` PRZED zamontowaniem `AnalysisWorkspaceInner` — `reload()`
 * (4 równoległe wywołania API w `useEffect` na mouncie) nigdy się nie
 * uruchamia. Flaga jest jedynym hookiem tego komponentu.
 */
export function AnalysisWorkspace(props: AnalysisWorkspaceProps): React.ReactElement | null {
  const { enabled } = useFinanceAnalysisWorkspaceFlag();
  if (!enabled) return null;
  return <AnalysisWorkspaceInner {...props} />;
}

function AnalysisWorkspaceInner(props: AnalysisWorkspaceProps): React.ReactElement {
  const {
    artifactId,
    businessVersionId,
    role,
    onNavigateBack,
    creatorSourceOptions = [],
    creatorPeriodOptions = [],
    creatorAvailableLineCodes = [],
  } = props;

  const [load, setLoad] = useState<LoadState>({ loading: true, error: null });
  const [name, setName] = useState('Analiza');
  const [status, setStatus] = useState<BusinessVersionStatus>('DRAFT');
  const [freshness, setFreshness] = useState<FinanceArtifactFreshness>('NEVER_COMPUTED');
  const [versionNo, setVersionNo] = useState(1);
  const [version, setVersion] = useState(1);
  const [kpiValues, setKpiValues] = useState<AnalysisKpiValueDto[]>([]);
  const [catalog, setCatalog] = useState<AnalysisKpiCatalogEntryDto[]>([]);

  const [selectedKpiCode, setSelectedKpiCode] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardSubmitting, setWizardSubmitting] = useState(false);
  const [wizardSubmitError, setWizardSubmitError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [includedInReportByKpiCode, setIncludedInReportByKpiCode] = useState<
    Record<string, boolean>
  >({});
  const [markedAsModelInputByKpiCode, setMarkedAsModelInputByKpiCode] = useState<
    Record<string, boolean>
  >({});

  // Analiza ma JEDEN widok (brak zakładek) — `activeViewId` stały; kontrakt
  // Focus Mode (Pakiet C) i tak wymaga jakiegoś id. Stan roboczy (selekcja
  // KPI + toggle'e raportu/model-inputu + otwarty kreator) wchodzi jako
  // referencja `workspaceState`, więc toggle focus mode NIGDY go nie resetuje
  // (dowód "nie refetchuje" — patrz `__tests__/AnalysisWorkspace.focusMode.test.tsx`).
  const focusMode = useFinanceFocusMode({
    workspaceState: {
      selectedKpiCode,
      wizardOpen,
      includedInReportByKpiCode,
      markedAsModelInputByKpiCode,
    },
    activeViewId: 'analysis',
    // ★ NAPRAWA a11y (Pakiet I): `AnalysisCreatorWizard` teraz NAPRAWDĘ
    // zamyka się na Escape (przedtem nie miał żadnej obsługi klawiatury —
    // patrz `AnalysisCreatorWizard.tsx`). Bez tego `escapeContext.modalOpen`
    // Escape wykonywałby DWIE rzeczy naraz przy otwartym kreatorze w focus
    // mode: zamykał kreator I wychodził z focus mode — ten hook już ma
    // gotową precedencję (`resolveEscapeKey`) na dokładnie ten przypadek,
    // po prostu nigdy nie dostawał prawdziwego stanu modala.
    escapeContext: {
      modalOpen: wizardOpen,
      commandPaletteOpen: false,
      popoverOpen: false,
      cellEditing: false,
    },
  });

  const reload = useCallback(async () => {
    setLoad({ loading: true, error: null });
    try {
      const [artifact, bv, values, cat] = await Promise.all([
        getFinanceArtifact(artifactId),
        getFinanceBusinessVersion(businessVersionId),
        getAnalysisKpiValues(businessVersionId),
        getAnalysisKpiCatalog(),
      ]);
      setName(artifact.naturalKey ?? 'Analiza bez nazwy');
      setStatus(bv.status);
      setFreshness(bv.freshness);
      setVersionNo(bv.versionNo);
      setVersion(bv.version);
      setKpiValues(values);
      setCatalog(cat);
      setLoad({ loading: false, error: null });
    } catch (err) {
      setLoad({ loading: false, error: describeFinanceV2Error(err).detail });
    }
  }, [artifactId, businessVersionId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Okresy — wyprowadzone z periodId obecnych w kpiValues i opisane etykietą
  // zwróconą z kanonicznego rejestru okresów. Posortowane deterministycznie.
  const periodColumns: AnalysisKpiTablePeriodColumn[] = useMemo(() => {
    const labels = new Map(
      kpiValues.map((value) => [value.periodId, value.periodLabel || value.periodId])
    );
    return [...labels.entries()]
      .sort((left, right) => left[1].localeCompare(right[1]) || left[0].localeCompare(right[0]))
      .map(([id, label]) => ({ id, label }));
  }, [kpiValues]);

  const groups = useMemo(
    () =>
      groupAnalysisKpiValuesByKpi(
        kpiValues,
        periodColumns.map((p) => p.id)
      ),
    [kpiValues, periodColumns]
  );

  const completeness: AnalysisCompleteness = useMemo(() => {
    const selectedKpiCount = groups.length;
    const computedValueCount = groups.filter(
      (g) =>
        g.latestValue.value.status === 'PRESENT_ZERO' ||
        g.latestValue.value.status === 'PRESENT_NONZERO'
    ).length;
    return { selectedKpiCount, computedValueCount };
  }, [groups]);

  const freshnessIsStale = freshness === 'STALE_SOURCE' || freshness === 'STALE_ASSUMPTIONS';
  const cta = resolveAnalysisPrimaryCta(status, completeness, freshnessIsStale);

  const workspaceConfig = useMemo(
    () =>
      buildAnalysisWorkspaceBarConfig(
        {
          artifactId,
          businessVersionId,
          versionNo,
          name,
          status,
          freshness,
          hasUncommittedWorkingRevision: status === 'DRAFT',
          role,
        },
        completeness
      ),
    [artifactId, businessVersionId, versionNo, name, status, freshness, role, completeness]
  );

  const evaluationContext: WorkspaceBarEvaluationContext = {
    status,
    role,
    freshness,
    gates: { [ANALYSIS_HAS_KPIS_GATE]: completeness.selectedKpiCount > 0 },
  };

  const formulaInfoByKpiCode: Record<string, AnalysisKpiCatalogFormulaInfo | undefined> =
    useMemo(() => {
      const map: Record<string, AnalysisKpiCatalogFormulaInfo | undefined> = {};
      for (const c of catalog) {
        map[c.kpiCode] = {
          formulaDisplay: c.description ?? c.kpiCode,
          interpretationGeneral: c.description ?? '—',
          downstreamUses: [],
        };
      }
      return map;
    }, [catalog]);

  async function handleCompute(): Promise<void> {
    setComputing(true);
    setActionError(null);
    try {
      await computeAnalysisKpis({ businessVersionId });
      await reload();
    } catch (err) {
      setActionError(describeFinanceV2Error(err).detail);
    } finally {
      setComputing(false);
    }
  }

  async function handlePrimaryAction(): Promise<void> {
    setActionError(null);
    switch (cta.id) {
      case 'configure_kpis':
        setWizardOpen(true);
        return;
      case 'compute_first_time':
      case 'recompute':
        await handleCompute();
        return;
      case 'submit_for_review': {
        const gate = canSubmitAnalysisForReview(completeness);
        if (!gate.ok) {
          setActionError(gate.messagePl);
          return;
        }
        try {
          const result = await transitionFinanceVersion({
            businessVersionId,
            action: 'submit_for_review',
            expectedVersion: version,
          });
          setStatus(result.status);
          setVersion(result.version);
        } catch (err) {
          setActionError(describeFinanceV2Error(err).detail);
        }
        return;
      }
      case 'view_review':
        // Brak osobnego ekranu przeglądu w zakresie tego pakietu — status jest
        // już widoczny w odznace lifecycle paska; brak akcji nie jest błędem.
        return;
      case 'reopen_or_new_version': {
        const reason = window.prompt('Powód ponownego otwarcia analizy:', '') ?? '';
        if (!reason.trim()) return;
        try {
          const result = await reopenFinanceModel({
            modelArtifactId: artifactId,
            reason,
            idempotencyKey: `analysis-reopen-${businessVersionId}-${Date.now()}`,
          });
          // Wymóg #8 (Approved niemutowalne): TA wersja (businessVersionId w
          // propsach) zostaje bez zmian — reopen utworzył NOWĄ wersję
          // (`result.businessVersionId`), do której ten komponent nie ma
          // callbacku nawigacji (poza zakresem propsów tego pakietu). Komunikat
          // zamiast cichego no-op lub błędnego przełączenia widoku na starą wersję.
          setActionError(
            `Utworzono nową wersję roboczą (v${result.versionNo}, id ${result.businessVersionId}). Otwórz ją z listy wersji artefaktu.`
          );
        } catch (err) {
          setActionError(describeFinanceV2Error(err).detail);
        }
        return;
      }
      default: {
        const _exhaustive: never = cta.id;
        return _exhaustive;
      }
    }
  }

  async function handleLifecycleTransition(
    transition: WorkspaceBarLifecycleTransition
  ): Promise<void> {
    setActionError(null);
    let reason: string | undefined;
    if (transition.requiresReason) {
      // Świadome obejście luki Pakietu C — patrz nagłówek pliku.
      const entered = window.prompt(`Podaj powód: ${transition.label.pl}`, '');
      if (entered === null) return; // anulowane
      reason = entered;
    }
    try {
      if (transition.action === 'approve') {
        const result = await approveFinanceModel({
          modelArtifactId: artifactId,
          expectedVersion: version,
        });
        if (result.success) await reload();
        return;
      }
      if (transition.action === 'reopen' || transition.action === 'new_version') {
        const result = await reopenFinanceModel({
          modelArtifactId: artifactId,
          reason: reason ?? (transition.action === 'new_version' ? 'Nowa wersja' : ''),
          idempotencyKey: `analysis-${transition.action}-${businessVersionId}-${Date.now()}`,
        });
        // Patrz komentarz w `handlePrimaryAction`'s reopen_or_new_version — TA
        // wersja zostaje bez zmian (Approved niemutowalne), nowa wersja wymaga
        // nawigacji spoza tego komponentu.
        setActionError(
          `Utworzono nową wersję roboczą (v${result.versionNo}, id ${result.businessVersionId}). Otwórz ją z listy wersji artefaktu.`
        );
        return;
      }
      if (transition.action === 'save_draft') {
        // Brak dziś endpointu zapisu treści draftu Analysis poza KPI (patrz
        // nagłówek pliku) — status pozostaje DRAFT, nic do wysłania.
        return;
      }
      const result = await transitionFinanceVersion({
        businessVersionId,
        action: transition.action as RoutableTransitionAction,
        expectedVersion: version,
        reason,
      });
      setStatus(result.status);
      setVersion(result.version);
    } catch (err) {
      setActionError(describeFinanceV2Error(err).detail);
    }
  }

  function handleMoreItem(item: WorkspaceBarMoreMenuItem): void {
    if (item.id === 'more.archive') {
      void transitionFinanceVersion({
        businessVersionId,
        action: 'archive',
        expectedVersion: version,
      })
        .then((result) => {
          setStatus(result.status);
          setVersion(result.version);
        })
        .catch((err) => setActionError(describeFinanceV2Error(err).detail));
      return;
    }
    // duplicate/export/history — poza zakresem tego pakietu (brak backendu/ekranu docelowego).
  }

  async function handleCommitRename(
    nextName: string
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    try {
      await renameFinanceArtifact(artifactId, nextName);
      setName(nextName);
      return { ok: true };
    } catch (err) {
      return { ok: false, message: describeFinanceV2Error(err).detail };
    }
  }

  async function handleWizardComplete(payload: AnalysisCreatorDraftPayload): Promise<void> {
    void payload; // patrz nagłówek: żaden dzisiejszy endpoint nie przyjmuje source/periods/KPI selection.
    setWizardSubmitting(true);
    setWizardSubmitError(null);
    try {
      await createFinanceArtifact({ artifactType: 'HISTORICAL_ANALYSIS' });
      await computeAnalysisKpis({ businessVersionId });
      setWizardOpen(false);
      await reload();
    } catch (err) {
      setWizardSubmitError(describeFinanceV2Error(err).detail);
    } finally {
      setWizardSubmitting(false);
    }
  }

  const selectedGroup = selectedKpiCode
    ? (groups.find((g) => g.kpiCode === selectedKpiCode) ?? null)
    : null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-c-bg" data-testid="analysis-workspace">
      <FinanceWorkspaceBar
        config={workspaceConfig}
        evaluationContext={evaluationContext}
        contextValues={{
          type: 'Analiza historyczna',
          lastCompute: load.loading ? undefined : new Date().toISOString(),
        }}
        onNavigateBack={onNavigateBack}
        onSelectView={() => {}}
        onPrimaryAction={() => void handlePrimaryAction()}
        onLifecycleTransition={(t) => void handleLifecycleTransition(t)}
        onMoreItem={handleMoreItem}
        onEnterFocusMode={() => focusMode.enter('finance-workspace-bar-fullscreen')}
        onCommitRename={handleCommitRename}
      />

      {actionError ? (
        <div
          className="border-b border-c-danger/30 bg-c-danger/10 px-4 py-2 text-sm text-c-text"
          data-testid="analysis-workspace-action-error"
        >
          {actionError}
        </div>
      ) : null}

      <FinanceErrorBoundary
        documentLabel={name}
        onRetry={() => void reload()}
        onBackToList={onNavigateBack}
      >
        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 overflow-auto">
            <AnalysisKpiTable
              businessVersionId={businessVersionId}
              kpiValues={kpiValues}
              formulaInfoByKpiCode={formulaInfoByKpiCode}
              periodColumns={periodColumns}
              includedInReportByKpiCode={includedInReportByKpiCode}
              markedAsModelInputByKpiCode={markedAsModelInputByKpiCode}
              selectedKpiCode={selectedKpiCode}
              onOpenDetail={setSelectedKpiCode}
              onToggleIncludedInReport={(kpiCode, next) =>
                setIncludedInReportByKpiCode((m) => ({ ...m, [kpiCode]: next }))
              }
              onMarkAsModelInput={(kpiCode) =>
                setMarkedAsModelInputByKpiCode((m) => ({ ...m, [kpiCode]: true }))
              }
              isApproved={status === 'APPROVED'}
              loading={load.loading}
              error={load.error}
              onRetry={() => void reload()}
              onConfigureKpis={() => setWizardOpen(true)}
            />
          </div>

          {selectedGroup ? (
            <AnalysisKpiDetailCard
              kpiValue={selectedGroup.latestValue}
              formulaInfo={formulaInfoByKpiCode[selectedGroup.kpiCode] ?? null}
              yoyDelta={computeYoyDelta(
                selectedGroup.latestValue.value,
                selectedGroup.priorPeriodValue
              )}
              periodSeries={buildPeriodSeries(selectedGroup.periodValuesByColumnId, periodColumns)}
              history={buildHistoryPlaceholder(selectedGroup.latestValue)}
              sourceLineageLabel="Pakiet sprawozdań źródłowych (lineage) — szczegóły dostępne po dodaniu endpointu listującego."
              onClose={() => setSelectedKpiCode(null)}
            />
          ) : null}
        </div>
      </FinanceErrorBoundary>

      {wizardOpen ? (
        <AnalysisCreatorWizard
          sourceOptions={creatorSourceOptions}
          periodOptions={creatorPeriodOptions}
          catalog={catalog}
          availableLineCodesForPreflight={creatorAvailableLineCodes}
          onClose={() => setWizardOpen(false)}
          onComplete={(payload) => void handleWizardComplete(payload)}
          submitting={wizardSubmitting}
          submitErrorMessage={wizardSubmitError}
        />
      ) : null}
    </div>
  );
}

function buildPeriodSeries(
  periodValuesByColumnId: Record<string, AnalysisKpiValueDto['value'] | undefined>,
  periodColumns: AnalysisKpiTablePeriodColumn[]
): AnalysisKpiPeriodSeriesPoint[] {
  return periodColumns.map((col) => ({
    periodLabel: col.label,
    value: periodValuesByColumnId[col.id] ?? {
      status: 'MISSING',
      valueDecimal: null,
      nativeCurrency: '',
      presentationCurrency: '',
      unit: '',
      multiplier: '1',
    },
    isForecast: false, // brak dziś sygnału historyczny/prognoza z GET /analysis/:id/kpi-values (patrz nagłówek pliku).
  }));
}

function buildHistoryPlaceholder(kpiValue: AnalysisKpiValueDto): AnalysisKpiHistoryEntry[] {
  // Brak dziś endpointu historii wersji per wartość KPI — pusta lista jest
  // honest (karta pokazuje "Brak wcześniejszych wersji"), nie zmyślona.
  void kpiValue;
  return [];
}

export default AnalysisWorkspace;
