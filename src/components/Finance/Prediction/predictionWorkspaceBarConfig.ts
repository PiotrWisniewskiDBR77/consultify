/**
 * Pakiet G (Prediction) — buduje `WorkspaceBarConfig` (Pakiet C, `financeWorkspaceBar.contract.ts`)
 * dla workspace'u Prediction. Moduł DEKLARUJE treść (dwa widoki: Budowa założeń / Modele-Wyniki,
 * identity/status/akcje), `FinanceWorkspaceBar` NARZUCA wygląd — zero własnego markupu nagłówka tu.
 */
import {
  ENABLEMENT_ALWAYS,
  WORKSPACE_BAR_CONTEXT_FIELDS,
  WORKSPACE_BAR_NAME_LAYOUT_BUDGET_CHARS,
  WORKSPACE_BAR_NAME_MAX_CHARS,
  canRenameArtifact,
  resolveViewNavigationPlacement,
  type WorkspaceBarConfig,
  type WorkspaceBarEvaluationContext,
} from '@/components/Finance/shared/financeWorkspaceBar.contract';
import type { BusinessVersionStatus, FinanceArtifactFreshness, FinanceRole } from '@/services/api/financeV2.types';

import { resolveResultFreshness, type ScenarioDraft } from './predictionScenarioModel';

export const PREDICTION_VIEW_IDS = { assumptions: 'assumptions', results: 'results' } as const;
export type PredictionViewId = (typeof PREDICTION_VIEW_IDS)[keyof typeof PREDICTION_VIEW_IDS];

export interface BuildPredictionWorkspaceBarConfigParams {
  draft: ScenarioDraft;
  activeViewId: PredictionViewId;
  artifactId: string;
  status: BusinessVersionStatus;
  role: FinanceRole;
  freshness: FinanceArtifactFreshness;
}

export function buildPredictionEvaluationContext(params: Pick<BuildPredictionWorkspaceBarConfigParams, 'status' | 'role' | 'freshness'>): WorkspaceBarEvaluationContext {
  return { status: params.status, role: params.role, freshness: params.freshness, gates: {} };
}

export function buildPredictionWorkspaceBarConfig(params: BuildPredictionWorkspaceBarConfigParams): WorkspaceBarConfig {
  const { draft } = params;
  const resultsFreshness = resolveResultFreshness(draft);
  const rename = canRenameArtifact(params.status, params.role);
  const businessVersionId = draft.businessVersionId ?? 'DRAFT_LOCAL';

  const views = [
    {
      id: PREDICTION_VIEW_IDS.assumptions,
      label: { key: 'finance.prediction.view.assumptions', pl: 'Budowa założeń' },
      state: null,
    },
    {
      id: PREDICTION_VIEW_IDS.results,
      label: { key: 'finance.prediction.view.results', pl: 'Modele/Wyniki' },
      state:
        resultsFreshness === 'NEVER_COMPUTED'
          ? { kind: 'not-configured' as const, label: { key: 'finance.prediction.results.neverComputed', pl: 'Nie przeliczono' } }
          : resultsFreshness === 'STALE'
            ? { kind: 'stale' as const, label: { key: 'finance.prediction.results.stale', pl: 'Nieaktualne' } }
            : { kind: 'ready' as const, label: { key: 'finance.prediction.results.ready', pl: 'Aktualne' } },
    },
  ];

  return {
    moduleId: 'prediction',
    artifactType: 'PREDICTION_SCENARIO',
    identity: {
      artifactRef: { artifactType: 'PREDICTION_SCENARIO', businessVersionId, artifactId: params.artifactId },
      back: { targetListRoute: '/finance/prediction', label: { key: 'finance.back', pl: 'Wróć do listy' } },
      name: {
        value: draft.name,
        editable: rename.editable,
        editableBlockedReason: rename.editable ? null : rename.reason,
        maxChars: WORKSPACE_BAR_NAME_MAX_CHARS,
        layoutBudgetChars: WORKSPACE_BAR_NAME_LAYOUT_BUDGET_CHARS,
      },
      version: { label: 'v1', businessVersionId, hasUncommittedWorkingRevision: draft.lastAssumptionChangeAt > (draft.lastComputeAt ?? '') },
      status: params.status,
      freshness: params.freshness,
      contextFields: [...WORKSPACE_BAR_CONTEXT_FIELDS].filter((f) => f === 'type' || f === 'lastCompute') as (typeof WORKSPACE_BAR_CONTEXT_FIELDS)[number][],
    },
    viewNavigation: {
      kind: 'tabs',
      views,
      activeViewId: params.activeViewId,
      placement: resolveViewNavigationPlacement(views.length),
    },
    actions: {
      primary: {
        kind: 'primary',
        id: 'primary-compute',
        label: { key: 'finance.prediction.primary.compute', pl: 'Przelicz scenariusz' },
        enablement: ENABLEMENT_ALWAYS,
        mergesFreshness: true,
        keyboardCommandId: null,
      },
      secondary: {
        kind: 'secondary',
        id: 'secondary-preflight',
        label: { key: 'finance.prediction.secondary.preflight', pl: 'Uruchom preflight' },
        enablement: ENABLEMENT_ALWAYS,
        keyboardCommandId: null,
      },
      lifecycle: null,
      more: null,
      fullscreen: { kind: 'fullscreen', id: 'fullscreen', label: { key: 'finance.fullscreen', pl: 'Pełny ekran' }, enablement: ENABLEMENT_ALWAYS, iconOnly: true, ariaLabel: { key: 'finance.fullscreen.aria', pl: 'Przełącz tryb pełnoekranowy' } },
      extraDirectControls: [],
    },
  };
}
