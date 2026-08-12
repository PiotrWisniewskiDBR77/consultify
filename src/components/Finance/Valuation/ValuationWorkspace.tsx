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
 * `useFinanceValuationWorkspaceFlag` (default OFF, CLAUDE.md rule #7). The only consumer today is
 * `dev-render/screens/finance-valuation-workspace.tsx` for screenshot evidence.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useFinanceFocusMode } from '@/hooks/useFinanceFocusMode';
import { useFinanceValuationWorkspaceFlag } from '@/hooks/useFinanceValuationWorkspaceFlag';
import {
  describeFinanceV2Error,
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
  upsertValuationWaccInputs,
  type UpsertValuationWaccInputsParams,
  type ValuationBasketUpdate,
} from '@/services/api/financeV2.api';

import { FinanceErrorBoundary } from '../shared/FinanceErrorBoundary';
import { FinanceWorkspaceBar } from '../shared/FinanceWorkspaceBar';
import { ENABLEMENT_ALWAYS, type WorkspaceBarConfig, type WorkspaceBarEvaluationContext, type WorkspaceBarViewStateKind } from '../shared/financeWorkspaceBar.contract';
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

export const VALUATION_STEP_IDS = ['source', 'assumptions', 'methods', 'results', 'sensitivity', 'advisor', 'export'] as const;
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
  api?: ValuationWorkspaceApi;
  initialStepId?: ValuationStepId;
  onNavigateBack?: () => void;
  role?: WorkspaceBarEvaluationContext['role'];
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
  const { businessVersionId, api = REAL_VALUATION_WORKSPACE_API, initialStepId = 'source', onNavigateBack = () => {}, role = 'preparer' } = props;

  const [activeStep, setActiveStep] = useState<ValuationStepId>(initialStepId);
  const [variant, setVariant] = useState<ValuationVariantDto | null>(null);
  const [variantError, setVariantError] = useState<string | null>(null);

  const [lineage, setLineage] = useState<ValuationLineageDto | null>(null);
  const [wacc, setWacc] = useState<ValuationWaccInputsRawDto | null>(null);
  const [methodsData, setMethodsData] = useState<{ methods: ValuationMethodDto[]; weightedRecommendation: ValuationWeightedRecommendationDto } | null>(null);
  const [results, setResults] = useState<ValuationResultsDto | null>(null);
  const [advisorFindings, setAdvisorFindings] = useState<(ValuationAdvisorFindingGeneratedDto | ValuationAdvisorFindingStoredDto)[] | null>(null);

  const [reloadNonce, setReloadNonce] = useState(0);

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
      api.getFinanceVersionLineage(businessVersionId).then((l) => !cancelled && setLineage(l)).catch(() => undefined);
    } else if (activeStep === 'assumptions') {
      api.getValuationWaccInputs(businessVersionId).then((w) => !cancelled && setWacc(w)).catch(() => !cancelled && setWacc(null));
    } else if (activeStep === 'methods' || activeStep === 'sensitivity') {
      api.listValuationMethods(businessVersionId).then((m) => !cancelled && setMethodsData(m)).catch(() => undefined);
    } else if (activeStep === 'results') {
      api.getValuationResults(businessVersionId).then((r) => !cancelled && setResults(r)).catch(() => undefined);
    } else if (activeStep === 'advisor') {
      api.listValuationAdvisorOutputs(businessVersionId).then((f) => !cancelled && setAdvisorFindings(f)).catch(() => undefined);
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
      results: results ? (results.headlineEnterpriseValue.value !== null ? 'ready' : 'incomplete') : null,
      sensitivity: null, // computed lazily inside SensitivityStep (needs a method selection first)
      advisor: advisorFindings ? (advisorFindings.length > 0 ? 'ready' : 'not-configured') : null,
      export: 'not-applicable', // no dedicated export endpoint exists in B3 at this base SHA — see report
    };
  }, [lineage, wacc, methodsData, results, advisorFindings]);

  const config: WorkspaceBarConfig = useMemo(() => {
    const name = variant?.name ?? 'Wycena przedsiębiorstwa';
    const status = (variant?.status as WorkspaceBarEvaluationContext['status'] | undefined) ?? 'DRAFT';
    const freshness = (variant?.freshness as WorkspaceBarConfig['identity']['freshness'] | undefined) ?? 'NEVER_COMPUTED';
    return {
      moduleId: 'valuation',
      artifactType: 'VALUATION_CASE',
      identity: {
        artifactRef: { artifactType: 'VALUATION_CASE', businessVersionId, artifactId: businessVersionId },
        back: { targetListRoute: '/finance/valuation', label: { key: 'back', pl: 'Wróć do listy' } },
        name: { value: name, editable: false, editableBlockedReason: 'INSUFFICIENT_ROLE', maxChars: 120, layoutBudgetChars: 60 },
        version: { label: variant ? `v${variant.versionNo}` : 'v—', businessVersionId, hasUncommittedWorkingRevision: false },
        status,
        freshness,
        contextFields: ['type', 'source'],
      },
      viewNavigation: {
        kind: 'stepper',
        views: VALUATION_STEP_IDS.map((id) => ({
          id,
          label: { key: `valuation.step.${id}`, pl: STEP_LABELS[id] },
          state: stepState[id] ? { kind: stepState[id] as WorkspaceBarViewStateKind, label: { key: `valuation.step.${id}.state`, pl: stepStateLabel(stepState[id] as WorkspaceBarViewStateKind) } } : null,
        })),
        activeViewId: activeStep,
        placement: 'separate-row', // 7 steps > WORKSPACE_BAR_INLINE_VIEW_LIMIT (2)
      },
      actions: {
        primary: {
          kind: 'primary',
          id: 'primary.refresh-step',
          label: { key: 'refresh', pl: 'Odśwież krok' },
          enablement: ENABLEMENT_ALWAYS,
          mergesFreshness: false,
          keyboardCommandId: null,
        },
        secondary: null,
        lifecycle: null,
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
  }, [variant, businessVersionId, activeStep, stepState]);

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
    const generated = await api.generateValuationAdvisorOutput(businessVersionId, { persist: true });
    setAdvisorFindings(generated.findings);
  }

  return (
    <div data-testid="valuation-workspace" className="flex min-h-screen flex-col bg-c-bg">
      <FinanceWorkspaceBar
        config={config}
        evaluationContext={evaluationContext}
        contextValues={{ type: 'Wycena przedsiębiorstwa', source: lineage?.ancestors[0]?.sourceVersionId ?? 'nie połączono' }}
        onNavigateBack={onNavigateBack}
        onSelectView={(viewId) => setActiveStep(viewId as ValuationStepId)}
        onPrimaryAction={refreshActiveStep}
        onLifecycleTransition={() => {}}
        onMoreItem={() => {}}
        onEnterFocusMode={() => focusMode.enter('fullscreen.toggle', 'toggle-control')}
        onCommitRename={async () => ({ ok: false, message: 'Zmiana nazwy wariantu wyceny nie jest częścią tego pakietu.' })}
      />

      {variantError && !focusMode.active && (
        <div role="alert" className="mx-6 mt-4 rounded-lg border border-c-danger/30 bg-c-danger/10 px-4 py-2 text-sm text-c-danger" data-testid="valuation-variant-error">
          {variantError}
        </div>
      )}

      <main className="flex-1 p-6" data-testid="valuation-step-content">
        {/* `key={activeStep}`: each step gets its OWN error-boundary instance — switching steps
            after a crash must remount a clean boundary, not keep showing the previous step's
            fallback UI forever. Without this key, React reuses the same class-component
            instance across steps and `hasError` would never reset on navigation. */}
        <FinanceErrorBoundary key={activeStep} documentLabel={`Wycena — ${STEP_LABELS[activeStep]}`} onRetry={refreshActiveStep} onBackToList={onNavigateBack}>
          {activeStep === 'source' && <SourceStep businessVersionId={businessVersionId} variant={variant} lineage={lineage} />}
          {activeStep === 'assumptions' && <AssumptionsStep wacc={wacc} onSave={handleSaveWacc} />}
          {activeStep === 'methods' && <MethodsWeightsStep methodsData={methodsData} onCreateMethod={handleCreateMethod} onSaveBasket={handleSaveBasket} />}
          {activeStep === 'results' && <ResultsStep results={results} />}
          {activeStep === 'sensitivity' && <SensitivityStep businessVersionId={businessVersionId} methodsData={methodsData} getGrid={api.getValuationSensitivityGrid} />}
          {activeStep === 'advisor' && <AdvisorStep findings={advisorFindings} status={config.identity.status} onGenerate={handleGenerateAdvisor} />}
          {activeStep === 'export' && <ExportStep />}
        </FinanceErrorBoundary>
      </main>
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

export default ValuationWorkspace;
