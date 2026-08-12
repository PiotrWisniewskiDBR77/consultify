/**
 * Pakiet G (Prediction) — powłoka workspace'u: `FinanceWorkspaceBar` (Pakiet C) + Focus Mode +
 * `FinanceErrorBoundary`, dwa widoki (Budowa założeń / Modele-Wyniki), stan draftu scenariusza
 * zachowany przy przełączaniu widoków/focus mode (Focus Mode kontrakt gwarantuje "nie refetchuje").
 *
 * ★ ZA FLAGĄ (CLAUDE.md #7): eksportowany `PredictionWorkspace` odczytuje
 * `useFinancePredictionWorkspaceFlag().enabled` SAM (nie tylko caller) —
 * przy `false` zwraca `null` PRZED zamontowaniem `PredictionWorkspaceInner`,
 * więc żaden hook/efekt tego ekranu (w tym sieciowe preflight/calculate)
 * nigdy się nie uruchamia. Gate na callerze (Task B, `FinanceHub.tsx`) jest
 * DODATKOWY, nie jedyny — komponent nigdy nie polega wyłącznie na tym, że
 * caller sprawdził flagę poprawnie (AP_MOUNT §A).
 *
 * ★ LUKA: preflight/calculate wołają REALNE endpointy (`financeV2.api.ts` PKG-G blok) gdy
 * `draft.businessVersionId` istnieje; bez realnego scenariusza (brak CRUD zapisu, patrz
 * `predictionScenarioModel.ts` nagłówek) przyciski pokazują honest-UI komunikat zamiast fejkować sukces.
 */
import React, { useState } from 'react';

import { FinanceErrorBoundary } from '@/components/Finance/shared/FinanceErrorBoundary';
import { FinanceWorkspaceBar } from '@/components/Finance/shared/FinanceWorkspaceBar';
import { useFinanceFocusMode } from '@/hooks/useFinanceFocusMode';
import { useFinancePredictionWorkspaceFlag } from '@/hooks/useFinancePredictionWorkspaceFlag';
import { runFinancePredictionCalculate, runFinancePredictionPreflight } from '@/services/api/financeV2.api';
import { describeFinanceV2Error } from '@/services/api/financeV2.types';

import { createEmptyScenarioDraft, type CanonicalValueMap, type ExceptionLedgerEntry, type ScenarioDraft } from './predictionScenarioModel';
import { buildPredictionEvaluationContext, buildPredictionWorkspaceBarConfig, PREDICTION_VIEW_IDS, type PredictionViewId } from './predictionWorkspaceBarConfig';
import { ScenarioAssumptionsView } from './ScenarioAssumptionsView';
import { ScenarioResultsView } from './ScenarioResultsView';

export interface PredictionWorkspaceProps {
  artifactId: string;
  initialDraft?: ScenarioDraft;
  /** Dane demo dla widoku wyników — w produkcji pochodziłyby z `finance_prediction_outputs_effective` przez wynik calculate. */
  scenarioValues?: CanonicalValueMap;
  baselineValues?: CanonicalValueMap;
  onNavigateBack?: () => void;
}

/**
 * Gate publiczny (CLAUDE.md #7/#9): przy fladze OFF zwraca `null` PRZED
 * zamontowaniem `PredictionWorkspaceInner` — żaden hook/efekt (w tym
 * `runFinancePredictionPreflight`/`runFinancePredictionCalculate`) nigdy się
 * nie wykonuje. Flaga jest jedynym hookiem tego komponentu, więc Rules of
 * Hooks zostają zachowane (wywołanie bezwarunkowe, wcześniejszy return
 * PRZED jakimkolwiek innym hookiem).
 */
export function PredictionWorkspace(props: PredictionWorkspaceProps): React.ReactElement | null {
  const { enabled } = useFinancePredictionWorkspaceFlag();
  if (!enabled) return null;
  return <PredictionWorkspaceInner {...props} />;
}

function PredictionWorkspaceInner(props: PredictionWorkspaceProps): React.ReactElement {
  const [draft, setDraft] = useState<ScenarioDraft>(props.initialDraft ?? createEmptyScenarioDraft({ name: 'Nowy scenariusz' }));
  const [activeViewId, setActiveViewId] = useState<PredictionViewId>(PREDICTION_VIEW_IDS.assumptions);
  const [exceptionLedger, setExceptionLedger] = useState<readonly ExceptionLedgerEntry[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const focusMode = useFinanceFocusMode({ workspaceState: draft, activeViewId });

  const evaluationContext = buildPredictionEvaluationContext({ status: 'DRAFT', role: 'preparer', freshness: draft.lastComputeAt ? 'CURRENT' : 'NEVER_COMPUTED' });
  const config = buildPredictionWorkspaceBarConfig({ draft, activeViewId, artifactId: props.artifactId, status: 'DRAFT', role: 'preparer', freshness: draft.lastComputeAt ? 'CURRENT' : 'NEVER_COMPUTED' });

  async function handlePreflight(): Promise<void> {
    if (!draft.businessVersionId) {
      setStatusMessage('Brak realnego scenariusza na serwerze — CRUD zapisu (driver overrides/inicjatywy/impact chain/financing) jeszcze nie istnieje (patrz raport pakietu G). Preflight działa tylko na już zapisanym businessVersionId.');
      return;
    }
    try {
      const result = await runFinancePredictionPreflight({ businessVersionId: draft.businessVersionId });
      setStatusMessage(`Preflight: ${result.findingsCount} znalezisk, ${result.requiredResolutionsCount} wymaga rozstrzygnięcia.`);
    } catch (err) {
      setStatusMessage(describeFinanceV2Error(err).detail);
    }
  }

  async function handleCalculate(): Promise<void> {
    if (!draft.businessVersionId) {
      setStatusMessage('Brak realnego scenariusza na serwerze — nie można wywołać /calculate bez zapisanego businessVersionId.');
      return;
    }
    try {
      await runFinancePredictionCalculate({ businessVersionId: draft.businessVersionId, entityId: 'entity-1', forecastPeriodIds: [], openingBalanceSheetPeriodId: '' });
      setDraft((d) => ({ ...d, lastComputeAt: new Date().toISOString() }));
      setActiveViewId(PREDICTION_VIEW_IDS.results);
    } catch (err) {
      setStatusMessage(describeFinanceV2Error(err).detail);
    }
  }

  return (
    <FinanceErrorBoundary documentLabel={draft.name} onRetry={() => setStatusMessage(null)} onBackToList={() => props.onNavigateBack?.()}>
      <div className="flex h-full min-h-0 flex-col bg-c-bg">
        <FinanceWorkspaceBar
          config={config}
          evaluationContext={evaluationContext}
          contextValues={{ type: 'Prediction Scenario' }}
          onNavigateBack={() => props.onNavigateBack?.()}
          onSelectView={(id) => setActiveViewId(id as PredictionViewId)}
          onPrimaryAction={() => void handleCalculate()}
          onSecondaryAction={() => void handlePreflight()}
          onLifecycleTransition={() => {}}
          onMoreItem={() => {}}
          onEnterFocusMode={() => focusMode.enter('finance-workspace-bar-fullscreen')}
          onCommitRename={async (nextName) => {
            setDraft((d) => ({ ...d, name: nextName }));
            return { ok: true };
          }}
        />

        {statusMessage && (
          <div className="border-b border-c-border-subtle bg-c-surface-raised px-4 py-2 text-sm text-c-text-secondary" role="status" data-testid="prediction-status-message">
            {statusMessage}
          </div>
        )}

        <div className="min-h-0 flex-1">
          {activeViewId === PREDICTION_VIEW_IDS.assumptions && <ScenarioAssumptionsView draft={draft} onChange={setDraft} />}
          {activeViewId === PREDICTION_VIEW_IDS.results && (
            <ScenarioResultsView draft={draft} scenarioValues={props.scenarioValues ?? {}} baselineValues={props.baselineValues ?? {}} exceptionLedger={exceptionLedger} />
          )}
        </div>
      </div>
    </FinanceErrorBoundary>
  );
}

export default PredictionWorkspace;
