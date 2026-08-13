/**
 * Pakiet E (Analysis Product Engineer) — kontrakt lifecycle/CTA workspace'u
 * Analizy Historycznej (`HISTORICAL_ANALYSIS`), adresujący wprost cztery
 * zgłoszenia właściciela cytowane w brifie:
 *
 *   OWN-FIN-008 — "Utworzenie analizy daje pusty Draft bez KPI; obecny
 *     formularz nie pozwala dobrać wskaźników." → `resolveAnalysisPrimaryCta`
 *     NIGDY nie zwraca `approve`/`submit_for_review` dla pustego draftu;
 *     zwraca `configure_kpis` jako JEDYNY sensowny CTA.
 *   OWN-FIN-012 — "status DRAFT jest tylko etykietą — brak przejść,
 *     zatwierdzania, review, edycji KPI." → `buildAnalysisLifecycleTransitions`
 *     zwraca realny zestaw przejść zależny od stanu+kompletności+roli.
 *   OWN-FIN-013 — "przy APPROVED użytkownik nie ma żadnej ścieżki dalszej
 *     pracy." → `buildAnalysisLifecycleTransitions('APPROVED', …)` zwraca
 *     `reopen`/`new_version`, NIGDY pustą listę.
 *   OWN-FIN-014 — (tabela, patrz `analysisKpiTable.contract.ts`).
 *
 * Ten plik NIE renderuje niczego — czysta logika, testowalna bez DOM
 * (`__tests__/analysisWorkspace.contract.test.ts`). `AnalysisWorkspace.tsx`
 * konsumuje go i przekłada na `WorkspaceBarConfig` (Pakiet C,
 * `financeWorkspaceBar.contract.ts` — `moduleId: 'analysis'` już tam
 * przewidziany, `FinanceWorkspaceModuleId` linia 309).
 */

import {
  canRenameArtifact,
  ENABLEMENT_ALWAYS,
  type WorkspaceBarConfig,
  type WorkspaceBarEnablement,
  type WorkspaceBarLifecycleTransition,
} from '../shared/financeWorkspaceBar.contract';
import type { BusinessVersionStatus, FinanceRole } from '../../../services/api/financeV2.types';

// ---------------------------------------------------------------------------
// Stan kompletności KPI — jedyny sygnał, którego brakowało w istniejącym
// pasku Modeli/Wycen (tam "kompletność" = zawsze prawda, bo assumption rows
// zawsze coś mają). Analiza z zerem wybranych KPI jest z definicji niekompletna.
// ---------------------------------------------------------------------------

export interface AnalysisCompleteness {
  selectedKpiCount: number;
  /** Ile z wybranych KPI ma realną wartość (PRESENT_*) po ostatnim przeliczeniu — 0 przy nigdy-nie-przeliczonym. */
  computedValueCount: number;
}

export function isAnalysisEmpty(completeness: AnalysisCompleteness): boolean {
  return completeness.selectedKpiCount === 0;
}

// ---------------------------------------------------------------------------
// OWN-FIN-008 — CTA główne. `configure_kpis` wygrywa zawsze, gdy KPI=0,
// niezależnie od statusu (nawet gdyby ktoś ręcznie przestawił status wersji
// bez KPI — obrona w głąb, nie tylko "bo tak mówi kreator").
// ---------------------------------------------------------------------------

export type AnalysisPrimaryCtaId =
  | 'configure_kpis'
  | 'recompute'
  | 'compute_first_time'
  | 'submit_for_review'
  | 'view_review'
  | 'reopen_or_new_version';

export interface AnalysisPrimaryCta {
  id: AnalysisPrimaryCtaId;
  labelPl: string;
  /** `true` ⇒ nawiguje do kroku wyboru KPI (kreator/Customize krok 3), NIE do zatwierdzenia. */
  navigatesToKpiSelection: boolean;
}

export function resolveAnalysisPrimaryCta(
  status: BusinessVersionStatus,
  completeness: AnalysisCompleteness,
  freshnessIsStale: boolean
): AnalysisPrimaryCta {
  if (isAnalysisEmpty(completeness)) {
    // Kontrola negatywna obowiązkowa (brief): to jest jedyna gałąź dla
    // pustego draftu — nie istnieje ścieżka, którą pusty draft dotrze do
    // 'submit_for_review'/'reopen_or_new_version' z tej funkcji.
    return { id: 'configure_kpis', labelPl: 'Skonfiguruj wskaźniki', navigatesToKpiSelection: true };
  }
  if (status === 'APPROVED' || status === 'SUPERSEDED') {
    return { id: 'reopen_or_new_version', labelPl: 'Otwórz ponownie', navigatesToKpiSelection: false };
  }
  if (status === 'IN_REVIEW') {
    return { id: 'view_review', labelPl: 'Zobacz w przeglądzie', navigatesToKpiSelection: false };
  }
  if (completeness.computedValueCount === 0 || freshnessIsStale) {
    return {
      id: completeness.computedValueCount === 0 ? 'compute_first_time' : 'recompute',
      labelPl: completeness.computedValueCount === 0 ? 'Przelicz' : 'Nieaktualne · Przelicz',
      navigatesToKpiSelection: false,
    };
  }
  return { id: 'submit_for_review', labelPl: 'Przekaż do przeglądu', navigatesToKpiSelection: false };
}

// ---------------------------------------------------------------------------
// OWN-FIN-008 kontrola negatywna wprost: "spróbuj zatwierdzić pusty draft →
// musi się nie dać". Ta funkcja jest gate'em wołanym PRZED każdym wywołaniem
// `transitionFinanceVersion({action:'submit_for_review'|...})` /
// `approveFinanceModel` z UI — a nie tylko ukryta za disabled CTA (obrona w
// głąb: nawet gdyby ktoś wywołał handler bezpośrednio, np. skrótem
// klawiszowym, gate i tak odmawia).
// ---------------------------------------------------------------------------

export type AnalysisApprovalGateResult =
  | { ok: true }
  | { ok: false; code: 'NO_KPIS_SELECTED' | 'NOT_IN_REVIEW'; messagePl: string };

export function canSubmitAnalysisForReview(completeness: AnalysisCompleteness): AnalysisApprovalGateResult {
  if (isAnalysisEmpty(completeness)) {
    return {
      ok: false,
      code: 'NO_KPIS_SELECTED',
      messagePl: 'Wybierz przynajmniej jeden wskaźnik przed przekazaniem analizy do przeglądu.',
    };
  }
  return { ok: true };
}

export function canApproveAnalysis(
  status: BusinessVersionStatus,
  completeness: AnalysisCompleteness
): AnalysisApprovalGateResult {
  if (isAnalysisEmpty(completeness)) {
    return {
      ok: false,
      code: 'NO_KPIS_SELECTED',
      messagePl: 'Nie można zatwierdzić analizy bez żadnego skonfigurowanego wskaźnika.',
    };
  }
  if (status !== 'IN_REVIEW') {
    return {
      ok: false,
      code: 'NOT_IN_REVIEW',
      messagePl: 'Zatwierdzenie jest możliwe tylko dla wersji w przeglądzie (IN_REVIEW).',
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// OWN-FIN-012/013 — pełny zestaw przejść lifecycle per status. `APPROVED`
// NIGDY nie zwraca pustej listy (OWN-FIN-013 dosłownie: "brak jakiejkolwiek
// ścieżki dalszej pracy").
//
// `WorkspaceBarEnablement` (Pakiet C) jest DEKLARATYWNA (statuses/roles/
// freshness/requiresGates), oceniana przez `resolveControlState` przeciw
// `WorkspaceBarEvaluationContext.gates` w komponencie — NIE jest to
// gotowy boolean tu policzony. Bramka `ANALYSIS_HAS_KPIS_GATE` musi być
// ustawiona w `gates` przez callera (`AnalysisWorkspace.tsx`) na podstawie
// TEJ SAMEJ `AnalysisCompleteness`, którą dostała ta funkcja — inaczej
// przycisk i logika rozjadą się cicho.
// ---------------------------------------------------------------------------

export const ANALYSIS_HAS_KPIS_GATE = 'analysis.hasConfiguredKpis';
export const ANALYSIS_APPROVER_ROLES: readonly FinanceRole[] = ['approver', 'finance_admin'];

function requireKpisGate(): WorkspaceBarEnablement {
  return { statuses: 'any', roles: 'any', freshness: 'any', requiresGates: [ANALYSIS_HAS_KPIS_GATE] };
}

function requireKpisAndApproverRole(): WorkspaceBarEnablement {
  return { statuses: 'any', roles: ANALYSIS_APPROVER_ROLES, freshness: 'any', requiresGates: [ANALYSIS_HAS_KPIS_GATE] };
}

export function buildAnalysisLifecycleTransitions(
  status: BusinessVersionStatus,
  completeness: AnalysisCompleteness,
  role: FinanceRole
): WorkspaceBarLifecycleTransition[] {
  void completeness; // kompletność jest oceniana deklaratywnie w `resolveControlState` przez bramkę ANALYSIS_HAS_KPIS_GATE, nie tutaj.
  void role; // rola jest oceniana deklaratywnie w `resolveControlState`, nie tutaj — zostawiona w sygnaturze dla czytelności API wołających.

  switch (status) {
    case 'DRAFT':
    case 'NEEDS_CHANGES':
      return [
        {
          action: 'save_draft',
          label: { key: 'save_draft', pl: 'Zapisz wersję roboczą' },
          enablement: ENABLEMENT_ALWAYS,
          destructive: false,
          requiresConfirmation: false,
          requiresReason: false,
        },
        {
          action: 'submit_for_review',
          label: { key: 'submit_for_review', pl: 'Przekaż do przeglądu' },
          // OWN-FIN-008 kontrola negatywna: disabled + powód, gdy KPI=0 —
          // NIGDY aktywny przycisk, który cicho nic nie robi.
          enablement: requireKpisGate(),
          destructive: false,
          requiresConfirmation: false,
          requiresReason: false,
        },
        {
          action: 'archive',
          label: { key: 'archive', pl: 'Archiwizuj' },
          enablement: ENABLEMENT_ALWAYS,
          destructive: true,
          requiresConfirmation: true,
          requiresReason: false,
        },
      ];
    case 'READY_FOR_REVIEW':
      return [
        {
          action: 'withdraw',
          label: { key: 'withdraw', pl: 'Wycofaj z przeglądu' },
          enablement: ENABLEMENT_ALWAYS,
          destructive: false,
          requiresConfirmation: false,
          requiresReason: false,
        },
        {
          action: 'start_review',
          label: { key: 'start_review', pl: 'Rozpocznij przegląd' },
          enablement: ENABLEMENT_ALWAYS,
          destructive: false,
          requiresConfirmation: false,
          requiresReason: false,
        },
      ];
    case 'IN_REVIEW':
      return [
        {
          action: 'request_changes',
          label: { key: 'request_changes', pl: 'Odeślij do poprawek' },
          enablement: ENABLEMENT_ALWAYS,
          destructive: false,
          requiresConfirmation: false,
          requiresReason: true,
        },
        {
          action: 'approve',
          label: { key: 'approve', pl: 'Zatwierdź' },
          enablement: requireKpisAndApproverRole(),
          destructive: false,
          requiresConfirmation: true,
          requiresReason: false,
        },
      ];
    case 'APPROVED':
      // OWN-FIN-013 — dosłowna naprawa: dwie ścieżki dalszej pracy, nigdy pusto.
      return [
        {
          action: 'new_version',
          label: { key: 'new_version', pl: 'Utwórz nową wersję' },
          enablement: ENABLEMENT_ALWAYS,
          destructive: false,
          requiresConfirmation: false,
          requiresReason: false,
        },
        {
          action: 'reopen',
          label: { key: 'reopen', pl: 'Otwórz ponownie' },
          enablement: ENABLEMENT_ALWAYS,
          destructive: true,
          requiresConfirmation: true,
          requiresReason: true,
        },
      ];
    case 'SUPERSEDED':
    case 'ARCHIVED':
    case 'INVALIDATED':
      return [
        {
          action: 'new_version',
          label: { key: 'new_version', pl: 'Utwórz nową wersję' },
          enablement: ENABLEMENT_ALWAYS,
          destructive: false,
          requiresConfirmation: false,
          requiresReason: false,
        },
      ];
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

// ---------------------------------------------------------------------------
// Rename — Approved niezmienne. Reużywa `canRenameArtifact` z Pakietu C
// (statusy renameable identyczne dla wszystkich modułów, brief nie prosi o
// wyjątek dla Analysis).
// ---------------------------------------------------------------------------

export { canRenameArtifact };

// ---------------------------------------------------------------------------
// "Approved jest niezmienne" — reopen tworzy JAWNIE numerowaną nową wersję z
// odniesieniem do poprzedniej + powodem + historią (brief, sekcja 3). Ta
// funkcja buduje METADANE tej nowej wersji z tego, co UI zna o starej —
// zapis idzie przez `reopenFinanceModel` (Pakiet C, `/models/:id/reopen`,
// generyczny mimo nazwy — zweryfikowane czytaniem `models.routes.ts`,
// `findCurrentArtifactVersion` filtruje tylko po `artifact_id`+`status`, bez
// filtra typu artefaktu).
// ---------------------------------------------------------------------------

export interface AnalysisReopenedVersionMeta {
  previousBusinessVersionId: string;
  previousVersionNo: number;
  reason: string;
  reopenedAtIso: string;
  reopenedByUserId: string;
  /** Etykieta do historii wersji w UI — "v3 (poprzednio: v2, powód: …)". */
  historyLabelPl: string;
}

export function buildReopenedVersionMeta(params: {
  previousBusinessVersionId: string;
  previousVersionNo: number;
  reason: string;
  reopenedByUserId: string;
  nowIso: string;
}): AnalysisReopenedVersionMeta {
  const nextVersionNo = params.previousVersionNo + 1;
  return {
    previousBusinessVersionId: params.previousBusinessVersionId,
    previousVersionNo: params.previousVersionNo,
    reason: params.reason,
    reopenedAtIso: params.nowIso,
    reopenedByUserId: params.reopenedByUserId,
    historyLabelPl: `v${nextVersionNo} (poprzednio: v${params.previousVersionNo}, powód: ${params.reason})`,
  };
}

// ---------------------------------------------------------------------------
// Budowa całego WorkspaceBarConfig (moduleId: 'analysis') — most między tym
// kontraktem a komponentem Pakietu C. Wywołane z `AnalysisWorkspace.tsx`.
// ---------------------------------------------------------------------------

export interface AnalysisWorkspaceIdentityInput {
  artifactId: string;
  businessVersionId: string;
  versionNo: number;
  name: string;
  status: BusinessVersionStatus;
  freshness: WorkspaceBarConfig['identity']['freshness'];
  hasUncommittedWorkingRevision: boolean;
  role: FinanceRole;
}

export function buildAnalysisWorkspaceBarConfig(
  input: AnalysisWorkspaceIdentityInput,
  completeness: AnalysisCompleteness
): WorkspaceBarConfig {
  const rename = canRenameArtifact(input.status, input.role);
  const cta = resolveAnalysisPrimaryCta(input.status, completeness, input.freshness === 'STALE_SOURCE' || input.freshness === 'STALE_ASSUMPTIONS');
  const transitions = buildAnalysisLifecycleTransitions(input.status, completeness, input.role);

  return {
    moduleId: 'analysis',
    artifactType: 'HISTORICAL_ANALYSIS',
    identity: {
      artifactRef: { artifactType: 'HISTORICAL_ANALYSIS', businessVersionId: input.businessVersionId, artifactId: input.artifactId },
      back: { targetListRoute: '/finance', label: { key: 'back', pl: 'Wróć do listy' } },
      name: {
        value: input.name,
        editable: rename.editable,
        editableBlockedReason: rename.editable ? null : rename.reason,
        maxChars: 120,
        layoutBudgetChars: 60,
      },
      version: {
        label: `v${input.versionNo}`,
        businessVersionId: input.businessVersionId,
        hasUncommittedWorkingRevision: input.hasUncommittedWorkingRevision,
      },
      status: input.status,
      freshness: input.freshness,
      contextFields: ['type', 'period', 'entity', 'currencyScale', 'source', 'lastCompute'],
    },
    viewNavigation: {
      kind: 'tabs',
      views: [{ id: 'kpis', label: { key: 'kpis', pl: 'Wskaźniki' }, state: null }],
      activeViewId: 'kpis',
      placement: 'in-bar',
    },
    actions: {
      primary: {
        kind: 'primary',
        id: `primary.${cta.id}`,
        label: { key: cta.id, pl: cta.labelPl },
        enablement: ENABLEMENT_ALWAYS,
        mergesFreshness: cta.id === 'recompute' || cta.id === 'compute_first_time',
        keyboardCommandId: null,
      },
      secondary: null,
      lifecycle:
        transitions.length > 0
          ? {
              kind: 'lifecycle',
              id: 'lifecycle.status',
              label: { key: 'status', pl: analysisStatusLabelPl(input.status) },
              enablement: ENABLEMENT_ALWAYS,
              transitions,
            }
          : null,
      more: {
        kind: 'more',
        id: 'more.menu',
        label: { key: 'more', pl: 'Więcej' },
        enablement: ENABLEMENT_ALWAYS,
        items: [
          { id: 'more.duplicate', label: { key: 'duplicate', pl: 'Duplikuj' }, group: 'document', enablement: ENABLEMENT_ALWAYS, destructive: false, requiresConfirmation: false },
          { id: 'more.export', label: { key: 'export', pl: 'Eksportuj' }, group: 'report', enablement: requireKpisGate(), destructive: false, requiresConfirmation: false },
          { id: 'more.history', label: { key: 'history', pl: 'Historia wersji' }, group: 'navigation', enablement: ENABLEMENT_ALWAYS, destructive: false, requiresConfirmation: false },
          { id: 'more.archive', label: { key: 'archive', pl: 'Archiwizuj' }, group: 'danger', enablement: ENABLEMENT_ALWAYS, destructive: true, requiresConfirmation: true },
        ],
      },
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
}

function analysisStatusLabelPl(status: BusinessVersionStatus): string {
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
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
