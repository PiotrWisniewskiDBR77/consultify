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
 * ★★ ID_BRIDGE (Gate E) fix — ANTY-CICHA-PUSTKA: przed tą zmianą ten
 * komponent NIE ROBIŁ ŻADNEGO pobrania danych na mount — po prostu tworzył
 * pusty `ScenarioDraft` i renderował go tak, jakby to był poprawny,
 * gotowy ekran. Właściciel patrzący na taki ekran wyciągnąłby wniosek
 * "funkcja jest pusta/zepsuta", podczas gdy system nawet nie próbował
 * sprawdzić, czy za `businessVersionId` stoi realny rekord. Teraz:
 *   - `businessVersionId` (nowy prop, ustawiany przez `FinanceHub.tsx` z
 *     `FinanceLegacyBridgeGate` — patrz ten plik dla mostu legacy->canoniczny
 *     id) jest NA MOUNCIE zweryfikowany realnym `GET .../versions/:id`
 *     (`getFinanceBusinessVersion`) — jedyny endpoint, który dziś realnie
 *     potwierdza istnienie wersji (nie ma GET-u treści scenariusza, patrz
 *     niżej).
 *   - Brak `businessVersionId` / 404 / błąd sieci/serwera to TRZY różne,
 *     jawne, POLSKIE komunikaty — żaden z nich nie renderuje cichego pustego
 *     formularza.
 *   - Nawet gdy wersja POTWIERDZONA istnieje, ekran mówi wprost, że to nowy
 *     szkic bez pobranych założeń — bo `finance-v2/prediction` nie ma dziś
 *     GET-u treści scenariusza (tylko `preflight`/`calculate`, zobacz LUKA
 *     niżej) — więc "pobierz dane" fizycznie nie istnieje jako operacja do
 *     wykonania. Ekran to teraz PRZYZNAJE zamiast to ukrywać.
 *
 * ★ LUKA (niezmieniona przez tę poprawkę): preflight/calculate wołają REALNE
 * endpointy (`financeV2.api.ts` PKG-G blok) gdy `draft.businessVersionId`
 * istnieje; bez realnego scenariusza (brak CRUD zapisu, patrz
 * `predictionScenarioModel.ts` nagłówek) przyciski pokazują honest-UI
 * komunikat zamiast fejkować sukces. Ta poprawka NIE dodaje CRUD-u
 * scenariusza (osobny, większy pakiet) — dodaje uczciwość na mouncie.
 */
import React, { useEffect, useState } from 'react';

import { FinanceErrorBoundary } from '@/components/Finance/shared/FinanceErrorBoundary';
import { FinanceWorkspaceBar } from '@/components/Finance/shared/FinanceWorkspaceBar';
import { EmptyStateInline } from '@/components/shared/NModeBlocks/EmptyStateInline';
import { LoadingState } from '@/components/shared/states';
import { useFinanceFocusMode } from '@/hooks/useFinanceFocusMode';
import { useFinancePredictionWorkspaceFlag } from '@/hooks/useFinancePredictionWorkspaceFlag';
import {
  getFinanceBusinessVersion,
  runFinancePredictionCalculate,
  runFinancePredictionPreflight,
} from '@/services/api/financeV2.api';
import { businessVersionStatusLabel, describeFinanceV2Error, type FinanceBusinessVersionDetailDto } from '@/services/api/financeV2.types';

import { createEmptyScenarioDraft, type CanonicalValueMap, type ExceptionLedgerEntry, type ScenarioDraft } from './predictionScenarioModel';
import { buildPredictionEvaluationContext, buildPredictionWorkspaceBarConfig, PREDICTION_VIEW_IDS, type PredictionViewId } from './predictionWorkspaceBarConfig';
import { ScenarioAssumptionsView } from './ScenarioAssumptionsView';
import { ScenarioResultsView } from './ScenarioResultsView';

export interface PredictionWorkspaceProps {
  artifactId: string;
  /** ID_BRIDGE (Gate E) — canonical `finance_business_versions.business_version_id`, resolved by the caller (`FinanceHub.tsx` via `FinanceLegacyBridgeGate`). `null`/undefined means the caller could not resolve one — rendered as an explicit "brak połączenia" state, never a silent empty draft. */
  businessVersionId?: string | null;
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

type MountCheckState =
  | { kind: 'no-id' }
  | { kind: 'checking' }
  | { kind: 'confirmed'; version: FinanceBusinessVersionDetailDto }
  | { kind: 'not-found' }
  | { kind: 'error'; message: string };

function PredictionWorkspaceInner(props: PredictionWorkspaceProps): React.ReactElement {
  const businessVersionId = props.businessVersionId ?? null;

  // ★ Anty-cicha-pustka: NA MOUNCIE, przed pierwszym renderem workspace'u,
  // sprawdź czy `businessVersionId` w ogóle wskazuje na realny rekord —
  // zamiast po cichu montować pusty formularz i udawać, że wszystko gra.
  const [mountCheck, setMountCheck] = useState<MountCheckState>(
    businessVersionId ? { kind: 'checking' } : { kind: 'no-id' }
  );
  const [checkAttempt, setCheckAttempt] = useState(0);

  useEffect(() => {
    if (!businessVersionId) {
      setMountCheck({ kind: 'no-id' });
      return;
    }
    let cancelled = false;
    setMountCheck({ kind: 'checking' });
    getFinanceBusinessVersion(businessVersionId)
      .then((version) => {
        if (cancelled) return;
        setMountCheck({ kind: 'confirmed', version });
      })
      .catch((err) => {
        if (cancelled) return;
        const described = describeFinanceV2Error(err);
        if (described.code === 'NOT_FOUND' || described.code === 'BUSINESS_VERSION_NOT_FOUND') {
          setMountCheck({ kind: 'not-found' });
          return;
        }
        setMountCheck({ kind: 'error', message: described.detail });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessVersionId, checkAttempt]);

  const [draft, setDraft] = useState<ScenarioDraft>(props.initialDraft ?? createEmptyScenarioDraft({ name: 'Nowy scenariusz' }));
  const [activeViewId, setActiveViewId] = useState<PredictionViewId>(PREDICTION_VIEW_IDS.assumptions);
  const [exceptionLedger, setExceptionLedger] = useState<readonly ExceptionLedgerEntry[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Once a real version is confirmed, thread its id into the draft so
  // preflight/calculate (which already gate on `draft.businessVersionId`)
  // work exactly as before this fix for a real, resolved record.
  useEffect(() => {
    if (mountCheck.kind === 'confirmed' && draft.businessVersionId !== mountCheck.version.businessVersionId) {
      setDraft((d) => ({ ...d, businessVersionId: mountCheck.version.businessVersionId }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mountCheck]);

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

  // ── Anty-cicha-pustka: TRZY jawne, nie-formularzowe stany ZAMIAST montażu ──
  if (mountCheck.kind === 'checking') {
    return (
      <div className="p-6" data-testid="prediction-mount-checking">
        <LoadingState template="panel" />
      </div>
    );
  }
  if (mountCheck.kind === 'no-id') {
    return (
      <div className="p-4" data-testid="prediction-mount-no-id">
        <EmptyStateInline
          message="Nie można otworzyć tego scenariusza — brak połączenia z realnym rekordem w nowym systemie."
          hint="Ten wiersz nie ma jeszcze odpowiednika w nowym systemie (nie został przeniesiony). Żadne dane nie zostały pobrane."
          action={{ label: 'Wróć do listy', onClick: () => props.onNavigateBack?.(), showPrefix: false }}
        />
      </div>
    );
  }
  if (mountCheck.kind === 'not-found') {
    return (
      <div className="p-4" data-testid="prediction-mount-not-found">
        <EmptyStateInline
          message="Nie znaleziono tej wersji scenariusza w nowym systemie."
          hint="Rekord mógł zostać usunięty albo nie masz do niego dostępu. Żadne dane nie zostały pobrane."
          action={{ label: 'Wróć do listy', onClick: () => props.onNavigateBack?.(), showPrefix: false }}
        />
      </div>
    );
  }
  if (mountCheck.kind === 'error') {
    return (
      <div className="p-4" data-testid="prediction-mount-error">
        <EmptyStateInline
          message="Nie udało się sprawdzić tego scenariusza."
          hint={mountCheck.message}
          action={{ label: 'Spróbuj ponownie', onClick: () => setCheckAttempt((n) => n + 1), showPrefix: false }}
        />
      </div>
    );
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

        {/* ★ Anty-cicha-pustka: wersja jest potwierdzona (realny rekord istnieje),
            ale ten ekran nie ma dziś GET-u treści scenariusza (LUKA w nagłówku
            pliku) — więc ZAWSZE mówimy to wprost, zamiast dać widzowi zgadywać,
            czy to, co widzi, jest "prawdziwym" stanem czy pustym szkicem. */}
        <div
          className="border-b border-c-border-subtle bg-c-surface-raised px-4 py-2 text-xs text-c-text-secondary"
          role="status"
          data-testid="prediction-honest-scratch-banner"
        >
          Realny rekord (wersja {mountCheck.version.versionNo}, status: {businessVersionStatusLabel(mountCheck.version.status)}) został
          potwierdzony w nowym systemie. Ten ekran pokazuje nowy szkic założeń — odczyt zapisanej treści
          scenariusza nie jest dziś dostępny (brak endpointu GET), więc żadne wcześniejsze założenia nie
          zostały pobrane.
        </div>

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
