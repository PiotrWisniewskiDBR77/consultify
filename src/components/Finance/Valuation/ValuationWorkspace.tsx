/**
 * `ValuationWorkspace` — Enterprise Valuation screen (Pakiet H), the SEVEN-step canonical flow
 * (OWN-FIN-021 / CLAUDE.md pkg-H brief): Source → Assumptions → Methods & weights → Results →
 * Sensitivity → Valuation Advisor → Export, in exactly that order.
 *
 * Shell only: identity/nav/actions chrome is `<FinanceWorkspaceBar>` (Pakiet C) — this component
 * declares a `WorkspaceBarConfig`, it does not draw its own header/tabs (CLAUDE.md UI rule #1).
 * Each step's CONTENT is wrapped in its own `<FinanceErrorBoundary>` (Pakiet C, OWN-FIN-002) — a
 * crash inside one step (e.g. a malformed sensitivity grid) can never take down the bar, the step
 * navigation, or any OTHER step; `__tests__/ValuationWorkspace.test.tsx` proves this with a step
 * that deliberately throws.
 *
 * ★ NOT wired into any production route/hub — mounting is gated by
 * `useFinanceValuationWorkspaceFlag` (default ON after AMD-FIN-VALUATION-V3-001). The flag remains
 * a controlled rollback seam. The only consumer today is
 * `dev-render/screens/finance-valuation-workspace.tsx` for screenshot evidence.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useFinanceFocusMode } from '@/hooks/useFinanceFocusMode';
import { useFinanceValuationWorkspaceFlag } from '@/hooks/useFinanceValuationWorkspaceFlag';
import { API_URL, getHeaders } from '@/services/api';
import {
  createValuationMethod,
  generateValuationAdvisorOutput,
  getFinanceVersionLineage,
  getValuationResults,
  getValuationSensitivityGrid,
  getValuationVariant,
  getValuationWaccInputs,
  listValuationAdvisorOutputs,
  listValuationMethods,
  setValuationMethodBasketWeights,
  transitionFinanceVersion,
  upsertValuationWaccInputs,
  type RoutableTransitionAction,
  type UpsertValuationWaccInputsParams,
  type ValuationBasketUpdate,
} from '@/services/api/financeV2.api';
import {
  describeFinanceV2Error,
  type BusinessVersionStatus,
  type ValuationAdvisorFindingGeneratedDto,
  type ValuationAdvisorFindingStoredDto,
  type ValuationCompareVariantsResultDto,
  type ValuationLineageDto,
  type ValuationMethodDto,
  type ValuationMethodType,
  type ValuationResultsDto,
  type ValuationSensitivityGridRawDto,
  type ValuationVariantDto,
  type ValuationWaccInputsRawDto,
  type ValuationWeightedRecommendationDto,
} from '@/services/api/financeV2.types';
import {
  confirmValuationRecommendationCandidateHandoff,
  getValuationRecommendationCandidateHandoff,
  previewValuationRecommendationCandidateHandoff,
} from '@/services/api/v8/financeCandidateHandoffValuation';

import { FinanceErrorBoundary } from '../shared/FinanceErrorBoundary';
import { FinanceWorkspaceBar } from '../shared/FinanceWorkspaceBar';
import { FinanceCandidateHandoffModal } from '../shared/FinanceCandidateHandoffModal';
import {
  ENABLEMENT_ALWAYS,
  type WorkspaceBarConfig,
  type WorkspaceBarEvaluationContext,
  type WorkspaceBarLifecycleTransition,
  type WorkspaceBarMoreMenuItem,
  type WorkspaceBarViewStateKind,
} from '../shared/financeWorkspaceBar.contract';
import {
  lifecycleShortLabel,
  lifecycleShortLabelEn,
  lifecycleTransitionsFor,
} from '../shared/financeVersionLifecycle';
import { AdvisorStep } from './steps/AdvisorStep';
import { AssumptionsStep } from './steps/AssumptionsStep';
import { ExportStep } from './steps/ExportStep';
import { MethodsWeightsStep } from './steps/MethodsWeightsStep';
import { ResultsStep } from './steps/ResultsStep';
import { SensitivityStep } from './steps/SensitivityStep';
import { SourceStep } from './steps/SourceStep';

// ---------------------------------------------------------------------------
// The seven canonical steps, in order — never reorderable by a caller.
// ---------------------------------------------------------------------------

export const VALUATION_STEP_IDS = [
  'source',
  'assumptions',
  'methods',
  'results',
  'sensitivity',
  'advisor',
  'export',
] as const;
export type ValuationStepId = (typeof VALUATION_STEP_IDS)[number];

const STEP_LABELS: Record<ValuationStepId, string> = {
  source: 'Źródło',
  assumptions: 'Założenia',
  methods: 'Metody i wagi',
  results: 'Wyniki',
  sensitivity: 'Wrażliwość',
  advisor: 'Doradca wyceny',
  export: 'Eksport',
};

/** G06 i18n (2026-09-03, agent/i18n-pl-en): angielski odpowiednik `STEP_LABELS`. */
const STEP_LABELS_EN: Record<ValuationStepId, string> = {
  source: 'Source',
  assumptions: 'Assumptions',
  methods: 'Methods & weights',
  results: 'Results',
  sensitivity: 'Sensitivity',
  advisor: 'Valuation advisor',
  export: 'Export',
};

/**
 * Pozycje kebaba paska wyceny — WYŁĄCZNIE takie, które ten ekran naprawdę
 * potrafi wykonać (2026-09-05). „Duplikuj"/„Archiwizuj"/„Eksportuj do PPTX"
 * celowo NIE ma: pierwsze dwie nie mają endpointu dla wyceny, trzecia ma
 * (`POST /valuation/legacy/:legacyId/export/pptx`), ale wymaga identyfikatora
 * legacy, którego ta powłoka nie posiada — martwy przycisk byłby gorszy niż
 * jego brak.
 */
const VALUATION_MORE_ITEMS: readonly WorkspaceBarMoreMenuItem[] = [
  {
    id: 'more.source',
    label: { key: 'valuation.more.source', pl: 'Źródło i pochodzenie danych', en: 'Source and lineage' },
    group: 'navigation',
    enablement: ENABLEMENT_ALWAYS,
    destructive: false,
    requiresConfirmation: false,
  },
  {
    id: 'more.copy-link',
    label: { key: 'valuation.more.copyLink', pl: 'Kopiuj link do wyceny', en: 'Copy valuation link' },
    group: 'document',
    enablement: ENABLEMENT_ALWAYS,
    destructive: false,
    requiresConfirmation: false,
  },
];

// ---------------------------------------------------------------------------
// Injectable API surface — real functions by default, overridable in tests so
// `<ValuationWorkspace>` never needs `vi.mock()` of the module path.
// ---------------------------------------------------------------------------

export interface ValuationWorkspaceApi {
  getValuationVariant: typeof getValuationVariant;
  getFinanceVersionLineage: typeof getFinanceVersionLineage;
  getValuationWaccInputs: typeof getValuationWaccInputs;
  upsertValuationWaccInputs: typeof upsertValuationWaccInputs;
  listValuationMethods: typeof listValuationMethods;
  createValuationMethod: typeof createValuationMethod;
  setValuationMethodBasketWeights: typeof setValuationMethodBasketWeights;
  getValuationResults: typeof getValuationResults;
  getValuationSensitivityGrid: typeof getValuationSensitivityGrid;
  generateValuationAdvisorOutput: typeof generateValuationAdvisorOutput;
  listValuationAdvisorOutputs: typeof listValuationAdvisorOutputs;
}

export const REAL_VALUATION_WORKSPACE_API: ValuationWorkspaceApi = {
  getValuationVariant,
  getFinanceVersionLineage,
  getValuationWaccInputs,
  upsertValuationWaccInputs,
  listValuationMethods,
  createValuationMethod,
  setValuationMethodBasketWeights,
  getValuationResults,
  getValuationSensitivityGrid,
  generateValuationAdvisorOutput,
  listValuationAdvisorOutputs,
};

export interface ValuationWorkspaceProps {
  businessVersionId: string;
  /** Explicit legacy identity supplied by FinanceHub's resolved bridge. */
  legacyValuationId?: string;
  api?: ValuationWorkspaceApi;
  initialStepId?: ValuationStepId;
  onNavigateBack?: () => void;
  role?: WorkspaceBarEvaluationContext['role'];
  candidateHandoffApi?: {
    preview: typeof previewValuationRecommendationCandidateHandoff;
    confirm: typeof confirmValuationRecommendationCandidateHandoff;
    get: typeof getValuationRecommendationCandidateHandoff;
  };
}

interface LegacyValuationRecommendation {
  id: string;
  title?: string;
  sourceVersion?: string;
  sourceHash?: string;
}

/**
 * Gate publiczny (CLAUDE.md #7/#9): przy `financeValuationWorkspaceV1` OFF
 * zwraca `null` PRZED zamontowaniem `ValuationWorkspaceInner` — żaden z
 * dwóch `useEffect`y ładujących dane (variant/lineage/WACC/methods/results/
 * advisor) nigdy się nie uruchamia. Flaga jest jedynym hookiem tego
 * komponentu.
 */
export function ValuationWorkspace(props: ValuationWorkspaceProps): React.ReactElement | null {
  const { enabled } = useFinanceValuationWorkspaceFlag();
  if (!enabled) return null;
  return <ValuationWorkspaceInner {...props} />;
}

function ValuationWorkspaceInner(props: ValuationWorkspaceProps): React.ReactElement {
  const {
    businessVersionId,
    legacyValuationId,
    api = REAL_VALUATION_WORKSPACE_API,
    initialStepId = 'source',
    onNavigateBack = () => {},
    role = 'preparer',
    candidateHandoffApi = {
      preview: previewValuationRecommendationCandidateHandoff,
      confirm: confirmValuationRecommendationCandidateHandoff,
      get: getValuationRecommendationCandidateHandoff,
    },
  } = props;

  const [activeStep, setActiveStep] = useState<ValuationStepId>(initialStepId);
  const [variant, setVariant] = useState<ValuationVariantDto | null>(null);
  const [variantError, setVariantError] = useState<string | null>(null);
  /**
   * 2026-09-05 (runda 3 odbioru, `finance-workspace-bar`). Pasek tego jednego
   * adaptera miał na sztywno `secondary: null, lifecycle: null, more: null`,
   * więc brakowało trzech kontrolek z obrazu zatwierdzonego: „Eksportuj",
   * rozwijanego statusu cyklu życia i kebaba. Poniżej REALNE akcje — żadnego
   * martwego przycisku:
   *   · Eksportuj → siódmy, kanoniczny krok tego kreatora („Eksport"),
   *   · status cyklu → `transitionFinanceVersion` (ten sam automat co
   *     `BaselineWorkspace`/`StatementPackWorkspaceV2`, teraz wspólny plik),
   *   · kebab → nawigacja do kroku „Źródło" i kopiowanie linku do wyceny.
   * Świadomie POMINIĘTE (brak drogi w tym ekranie, zgłoszone w raporcie):
   * duplikacja, archiwizacja i eksport PPTX (endpoint istnieje, ale wymaga
   * `legacyId`, którego ta powłoka nie zna — ma tylko `businessVersionId`).
   */
  const [lifecycleStatus, setLifecycleStatus] = useState<BusinessVersionStatus | null>(null);
  const [lifecycleVersion, setLifecycleVersion] = useState<number | null>(null);
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);
  const [moreNotice, setMoreNotice] = useState<string | null>(null);

  const [lineage, setLineage] = useState<ValuationLineageDto | null>(null);
  const [wacc, setWacc] = useState<ValuationWaccInputsRawDto | null>(null);
  const [methodsData, setMethodsData] = useState<{
    methods: ValuationMethodDto[];
    weightedRecommendation: ValuationWeightedRecommendationDto;
  } | null>(null);
  const [results, setResults] = useState<ValuationResultsDto | null>(null);
  const [advisorFindings, setAdvisorFindings] = useState<
    (ValuationAdvisorFindingGeneratedDto | ValuationAdvisorFindingStoredDto)[] | null
  >(null);

  const [reloadNonce, setReloadNonce] = useState(0);
  const [legacyRecommendations, setLegacyRecommendations] = useState<
    LegacyValuationRecommendation[] | null
  >(null);
  const [legacyRecommendationError, setLegacyRecommendationError] = useState<string | null>(null);
  const [candidateRecommendationId, setCandidateRecommendationId] = useState<string | null>(null);
  const [candidateResult, setCandidateResult] = useState<string | null>(null);

  useEffect(() => {
    if (!legacyValuationId) {
      setLegacyRecommendations([]);
      setLegacyRecommendationError(null);
      return;
    }
    let cancelled = false;
    setLegacyRecommendations(null);
    setLegacyRecommendationError(null);
    fetch(`${API_URL}/economics/valuations/${encodeURIComponent(legacyValuationId)}`, {
      headers: getHeaders(),
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(`valuation recommendation source unavailable (${response.status})`);
        const payload = (await response.json()) as { valuation?: { advisory?: unknown } };
        const raw = payload.valuation?.advisory;
        const advisory =
          typeof raw === 'string' ? (JSON.parse(raw) as { recommendations?: unknown }) : raw;
        const recommendations = Array.isArray(
          (advisory as { recommendations?: unknown } | null)?.recommendations
        )
          ? (advisory as { recommendations: unknown[] }).recommendations.filter(
              (item): item is LegacyValuationRecommendation =>
                !!item &&
                typeof item === 'object' &&
                typeof (item as { id?: unknown }).id === 'string'
            )
          : [];
        if (!cancelled) setLegacyRecommendations(recommendations);
      })
      .catch(() => {
        if (!cancelled) {
          setLegacyRecommendations([]);
          setLegacyRecommendationError(
            'Nie udało się zweryfikować rekomendacji źródłowej. Przekazanie kandydata jest zablokowane.'
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [legacyValuationId, reloadNonce]);

  // Variant identity — needed for the bar regardless of active step.
  useEffect(() => {
    let cancelled = false;
    setVariantError(null);
    api
      .getValuationVariant(businessVersionId)
      .then((v) => {
        if (!cancelled) setVariant(v);
      })
      .catch((err: unknown) => {
        // ID_BRIDGE (Gate E) fix: honest-UI PL message (CANON §4.1) — było `err.message` surowe.
        if (!cancelled) setVariantError(describeFinanceV2Error(err).detail);
      });
    return () => {
      cancelled = true;
    };
  }, [api, businessVersionId, reloadNonce]);

  // Per-step lazy data load — only fetch what the active step needs, but keep already-loaded
  // steps' data around so the step-state badges in the bar stay accurate after navigating away.
  useEffect(() => {
    let cancelled = false;
    if (activeStep === 'source') {
      api
        .getFinanceVersionLineage(businessVersionId)
        .then((l) => !cancelled && setLineage(l))
        .catch(() => undefined);
    } else if (activeStep === 'assumptions') {
      api
        .getValuationWaccInputs(businessVersionId)
        .then((w) => !cancelled && setWacc(w))
        .catch(() => !cancelled && setWacc(null));
    } else if (activeStep === 'methods' || activeStep === 'sensitivity') {
      api
        .listValuationMethods(businessVersionId)
        .then((m) => !cancelled && setMethodsData(m))
        .catch(() => undefined);
      api
        .getValuationResults(businessVersionId)
        .then((r) => !cancelled && setResults(r))
        .catch(() => undefined);
    } else if (activeStep === 'results') {
      api
        .getValuationResults(businessVersionId)
        .then((r) => !cancelled && setResults(r))
        .catch(() => undefined);
    } else if (activeStep === 'advisor') {
      api
        .listValuationAdvisorOutputs(businessVersionId)
        .then((f) => !cancelled && setAdvisorFindings(f))
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, businessVersionId, activeStep, reloadNonce]);

  const refreshActiveStep = useCallback(() => setReloadNonce((n) => n + 1), []);

  const focusMode = useFinanceFocusMode<{ activeStep: ValuationStepId }>({
    workspaceState: { activeStep },
    activeViewId: activeStep,
  });

  const stepState = useMemo((): Record<ValuationStepId, WorkspaceBarViewStateKind | null> => {
    const readyMethods = methodsData?.methods.filter((m) => m.readiness === 'READY').length ?? 0;
    return {
      source: lineage ? (lineage.ancestors.length > 0 ? 'ready' : 'blocked') : null,
      assumptions: wacc ? 'ready' : null,
      methods: methodsData ? (readyMethods > 0 ? 'ready' : 'incomplete') : null,
      results: results
        ? results.headlineEnterpriseValue.value !== null
          ? 'ready'
          : 'incomplete'
        : null,
      sensitivity: null, // computed lazily inside SensitivityStep (needs a method selection first)
      advisor: advisorFindings ? (advisorFindings.length > 0 ? 'ready' : 'not-configured') : null,
      export: 'not-applicable', // no dedicated export endpoint exists in B3 at this base SHA — see report
    };
  }, [lineage, wacc, methodsData, results, advisorFindings]);

  const config: WorkspaceBarConfig = useMemo(() => {
    const name = variant?.name ?? 'Wycena przedsiębiorstwa';
    // Status po przejściu cyklu życia (`lifecycleStatus`) ma pierwszeństwo nad
    // tym z ostatniego pobrania wariantu — inaczej pigułka i menu statusu
    // wracałyby do starej wartości do czasu odświeżenia.
    const status = (lifecycleStatus ??
      (variant?.status as WorkspaceBarEvaluationContext['status'] | undefined) ??
      'DRAFT') as WorkspaceBarEvaluationContext['status'];
    const freshness =
      (variant?.freshness as WorkspaceBarConfig['identity']['freshness'] | undefined) ??
      'NEVER_COMPUTED';
    return {
      moduleId: 'valuation',
      artifactType: 'VALUATION_CASE',
      identity: {
        artifactRef: {
          artifactType: 'VALUATION_CASE',
          businessVersionId,
          artifactId: businessVersionId,
        },
        back: {
          targetListRoute: '/finance/valuation',
          label: { key: 'back', pl: 'Wróć do listy', en: 'Back to list' },
        },
        name: {
          value: name,
          editable: false,
          editableBlockedReason: 'INSUFFICIENT_ROLE',
          maxChars: 120,
          layoutBudgetChars: 60,
        },
        version: {
          label: variant ? `v${variant.versionNo}` : 'v—',
          businessVersionId,
          hasUncommittedWorkingRevision: false,
        },
        status,
        freshness,
        contextFields: ['type', 'source'],
      },
      viewNavigation: {
        kind: 'stepper',
        views: VALUATION_STEP_IDS.map((id) => ({
          id,
          label: { key: `valuation.step.${id}`, pl: STEP_LABELS[id], en: STEP_LABELS_EN[id] },
          state: stepState[id]
            ? {
                kind: stepState[id] as WorkspaceBarViewStateKind,
                label: {
                  key: `valuation.step.${id}.state`,
                  pl: stepStateLabel(stepState[id] as WorkspaceBarViewStateKind),
                  en: stepStateLabelEn(stepState[id] as WorkspaceBarViewStateKind),
                },
              }
            : null,
        })),
        activeViewId: activeStep,
        placement: 'separate-row', // 7 steps > WORKSPACE_BAR_INLINE_VIEW_LIMIT (2)
      },
      actions: {
        primary: {
          kind: 'primary',
          id: 'primary.refresh-step',
          label: { key: 'refresh', pl: 'Odśwież krok', en: 'Refresh step' },
          enablement: ENABLEMENT_ALWAYS,
          mergesFreshness: false,
          keyboardCommandId: null,
        },
        secondary: {
          kind: 'secondary',
          id: 'secondary.export',
          label: { key: 'export', pl: 'Eksportuj', en: 'Export' },
          enablement: ENABLEMENT_ALWAYS,
          keyboardCommandId: null,
        },
        lifecycle: {
          kind: 'lifecycle',
          id: 'lifecycle.status',
          label: {
            key: 'status',
            pl: lifecycleShortLabel(status),
            en: lifecycleShortLabelEn(status),
          },
          enablement: ENABLEMENT_ALWAYS,
          transitions: lifecycleTransitionsFor(status),
        },
        more: {
          kind: 'more',
          id: 'more.menu',
          label: { key: 'more', pl: 'Więcej', en: 'More' },
          enablement: ENABLEMENT_ALWAYS,
          items: VALUATION_MORE_ITEMS,
        },
        fullscreen: {
          kind: 'fullscreen',
          id: 'fullscreen.toggle',
          label: { key: 'fullscreen', pl: 'Pełny ekran', en: 'Full screen' },
          enablement: ENABLEMENT_ALWAYS,
          iconOnly: true,
          ariaLabel: { key: 'fullscreen.aria', pl: 'Tryb pełnego obszaru roboczego', en: 'Full workspace mode' },
        },
        extraDirectControls: [],
      },
    };
  }, [variant, businessVersionId, activeStep, stepState, lifecycleStatus]);

  const evaluationContext: WorkspaceBarEvaluationContext = {
    status: config.identity.status,
    role,
    freshness: config.identity.freshness,
    gates: {},
  };

  async function handleSaveWacc(params: UpsertValuationWaccInputsParams): Promise<void> {
    const next = await api.upsertValuationWaccInputs(businessVersionId, params);
    setWacc(next);
  }

  async function handleCreateMethod(methodType: ValuationMethodType): Promise<void> {
    await api.createValuationMethod(businessVersionId, { methodType });
    const next = await api.listValuationMethods(businessVersionId);
    setMethodsData(next);
  }

  async function handleSaveBasket(updates: ValuationBasketUpdate[]): Promise<void> {
    const next = await api.setValuationMethodBasketWeights(businessVersionId, updates);
    setMethodsData(next);
  }

  async function handleGenerateAdvisor(): Promise<void> {
    const generated = await api.generateValuationAdvisorOutput(businessVersionId, {
      persist: true,
    });
    setAdvisorFindings(generated.findings);
  }

  /**
   * Przejścia cyklu życia idą przez ten sam endpoint, co Baseline i Pakiet
   * sprawozdań (`transitionFinanceVersion`). `approve`/`reopen` mają w
   * Finansach osobne endpointy MODELU (`approveFinanceModel`/`reopenFinanceModel`),
   * których wycena nie ma — dlatego zamiast cichego no-opu mówimy wprost, że
   * ta operacja nie ma tu odpowiednika (fail-closed, nie udawanie sukcesu).
   */
  async function handleLifecycleTransition(
    transition: WorkspaceBarLifecycleTransition
  ): Promise<void> {
    setLifecycleError(null);
    setMoreNotice(null);
    if (transition.action === 'approve' || transition.action === 'reopen') {
      setLifecycleError(
        'Zatwierdzenie i ponowne otwarcie wyceny nie mają dziś endpointu — zgłoszone jako niepokryte.'
      );
      return;
    }
    if (transition.action === 'save_draft' || transition.action === 'new_version') {
      setLifecycleError('Ta operacja nie ma dziś odpowiednika w API — zgłoszone jako niepokryte.');
      return;
    }
    try {
      const result = await transitionFinanceVersion({
        businessVersionId,
        action: transition.action as RoutableTransitionAction,
        expectedVersion: lifecycleVersion ?? variant?.versionNo ?? 1,
      });
      setLifecycleStatus(result.status);
      setLifecycleVersion(result.version);
    } catch (e) {
      setLifecycleError(describeFinanceV2Error(e).detail);
    }
  }

  function handleMoreItem(item: WorkspaceBarMoreMenuItem): void {
    setLifecycleError(null);
    if (item.id === 'more.source') {
      setActiveStep('source');
      setMoreNotice(null);
      return;
    }
    if (item.id === 'more.copy-link') {
      void navigator.clipboard?.writeText(window.location.href);
      setMoreNotice('Link do tej wyceny skopiowany do schowka.');
      return;
    }
  }

  return (
    <div data-testid="valuation-workspace" className="flex min-h-screen flex-col bg-c-bg">
      <FinanceWorkspaceBar
        config={config}
        evaluationContext={evaluationContext}
        contextValues={{
          type: 'Wycena przedsiębiorstwa',
          source: lineage?.ancestors[0]?.sourceVersionId ?? 'nie połączono',
        }}
        onNavigateBack={onNavigateBack}
        onSelectView={(viewId) => setActiveStep(viewId as ValuationStepId)}
        onPrimaryAction={refreshActiveStep}
        onSecondaryAction={() => setActiveStep('export')}
        onLifecycleTransition={handleLifecycleTransition}
        onMoreItem={handleMoreItem}
        onEnterFocusMode={() => focusMode.enter('fullscreen.toggle', 'toggle-control')}
        onCommitRename={async () => ({
          ok: false,
          message: 'Zmiana nazwy wariantu wyceny nie jest częścią tego pakietu.',
        })}
      />

      {variantError && !focusMode.active && (
        <div
          role="alert"
          className="mx-6 mt-4 rounded-lg border border-c-danger/30 bg-c-danger/10 px-4 py-2 text-sm text-c-danger"
          data-testid="valuation-variant-error"
        >
          {variantError}
        </div>
      )}

      {lifecycleError && !focusMode.active && (
        <div
          role="alert"
          className="mx-6 mt-4 rounded-lg border border-c-danger/30 bg-c-danger/10 px-4 py-2 text-sm text-c-danger"
          data-testid="valuation-lifecycle-error"
        >
          {lifecycleError}
        </div>
      )}

      {moreNotice && !focusMode.active && (
        <div
          role="status"
          className="mx-6 mt-4 rounded-lg border border-c-border-subtle bg-c-surface-raised px-4 py-2 text-sm text-c-text-secondary"
          data-testid="valuation-more-notice"
        >
          {moreNotice}
        </div>
      )}

      <main className="flex-1 p-6" data-testid="valuation-step-content">
        {/* `key={activeStep}`: each step gets its OWN error-boundary instance — switching steps
            after a crash must remount a clean boundary, not keep showing the previous step's
            fallback UI forever. Without this key, React reuses the same class-component
            instance across steps and `hasError` would never reset on navigation. */}
        <FinanceErrorBoundary
          key={activeStep}
          documentLabel={`Wycena — ${STEP_LABELS[activeStep]}`}
          onRetry={refreshActiveStep}
          onBackToList={onNavigateBack}
        >
          {activeStep === 'source' && (
            <SourceStep businessVersionId={businessVersionId} variant={variant} lineage={lineage} />
          )}
          {activeStep === 'assumptions' && <AssumptionsStep wacc={wacc} onSave={handleSaveWacc} />}
          {activeStep === 'methods' && (
            <MethodsWeightsStep
              methodsData={methodsData}
              onCreateMethod={handleCreateMethod}
              onSaveBasket={handleSaveBasket}
              currency={results?.currency ?? null}
            />
          )}
          {activeStep === 'results' && <ResultsStep results={results} />}
          {activeStep === 'sensitivity' && (
            <SensitivityStep
              businessVersionId={businessVersionId}
              methodsData={methodsData}
              getGrid={api.getValuationSensitivityGrid}
              currency={results?.currency ?? null}
            />
          )}
          {activeStep === 'advisor' && (
            <>
              <AdvisorStep
                findings={advisorFindings}
                status={config.identity.status}
                onGenerate={handleGenerateAdvisor}
              />
              <section className="mt-6 max-w-5xl space-y-3" aria-label="Przekazanie rekomendacji">
                <h3 className="text-sm font-semibold text-c-text">Rekomendacja → kandydat</h3>
                {legacyRecommendations === null && (
                  <p className="text-xs text-c-text-muted">Weryfikowanie źródła rekomendacji…</p>
                )}
                {legacyRecommendationError && (
                  <p role="alert" className="text-xs text-c-danger">
                    {legacyRecommendationError}
                  </p>
                )}
                {legacyRecommendations?.map((recommendation) => (
                  <div
                    key={recommendation.id}
                    className="rounded-lg border border-c-border-subtle bg-c-surface p-3"
                  >
                    <p className="text-sm font-medium text-c-text">
                      {recommendation.title || recommendation.id}
                    </p>
                    <p className="mt-1 text-[10px] text-c-text-muted">
                      Źródło: {recommendation.id}
                      {recommendation.sourceVersion
                        ? ` · wersja ${recommendation.sourceVersion}`
                        : ''}
                      {recommendation.sourceHash ? ` · hash ${recommendation.sourceHash}` : ''}
                    </p>
                    <button
                      type="button"
                      className="mt-2 rounded-lg bg-c-text px-3 py-2 text-xs font-medium text-c-bg"
                      onClick={() => {
                        setCandidateResult(null);
                        setCandidateRecommendationId(recommendation.id);
                      }}
                    >
                      Wyślij jako kandydata na Initiative
                    </button>
                  </div>
                ))}
                {candidateResult && <p className="text-xs text-c-success">{candidateResult}</p>}
              </section>
            </>
          )}
          {activeStep === 'export' && <ExportStep />}
        </FinanceErrorBoundary>
      </main>
      {candidateRecommendationId && (
        <FinanceCandidateHandoffModal
          open
          onClose={() => setCandidateRecommendationId(null)}
          sourceType="finance_valuation_recommendation"
          sourceId={candidateRecommendationId}
          preview={() => candidateHandoffApi.preview(candidateRecommendationId)}
          confirm={() => candidateHandoffApi.confirm(candidateRecommendationId)}
          fetchHandoff={() => candidateHandoffApi.get(candidateRecommendationId)}
          getReopenLink={() => null}
          title="Wyślij jako kandydata na Initiative"
          noticeText="Ta operacja tworzy kandydata do osobnej oceny; nie tworzy Initiative automatycznie."
          confirmLabel="Wyślij"
          cancelLabel="Anuluj"
          checkingLabel="Sprawdzanie zakotwiczenia źródła…"
          previewErrorFallback="Nie udało się zweryfikować rekomendacji źródłowej"
          confirmErrorFallback="Nie udało się utworzyć kandydata"
          onConfirmed={({ created, candidateId }) => {
            setCandidateResult(
              created
                ? `Utworzono kandydata ${candidateId}`
                : `Kandydat ${candidateId} już istnieje — nie utworzono duplikatu`
            );
          }}
        />
      )}
    </div>
  );
}

function stepStateLabel(kind: WorkspaceBarViewStateKind): string {
  switch (kind) {
    case 'ready':
      return 'Gotowe';
    case 'incomplete':
      return 'Niekompletne';
    case 'not-configured':
      return 'Nieskonfigurowane';
    case 'stale':
      return 'Nieaktualne';
    case 'blocked':
      return 'Zablokowane';
    case 'not-applicable':
      return 'Nie dotyczy';
    default:
      return '';
  }
}

/** G06 i18n (2026-09-03, agent/i18n-pl-en): angielski odpowiednik `stepStateLabel`. */
function stepStateLabelEn(kind: WorkspaceBarViewStateKind): string {
  switch (kind) {
    case 'ready':
      return 'Ready';
    case 'incomplete':
      return 'Incomplete';
    case 'not-configured':
      return 'Not configured';
    case 'stale':
      return 'Outdated';
    case 'blocked':
      return 'Blocked';
    case 'not-applicable':
      return 'Not applicable';
    default:
      return '';
  }
}

export default ValuationWorkspace;
