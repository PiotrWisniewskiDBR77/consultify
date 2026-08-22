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
 * Authoring jest kanoniczny: mount odczytuje trwały snapshot, zapis ma CAS i
 * idempotency receipt, a preflight/calculate startują dopiero po exact cold readback.
 */
import React, { useCallback, useEffect, useState } from 'react';

import { FinanceErrorBoundary } from '@/components/Finance/shared/FinanceErrorBoundary';
import { FinanceWorkspaceBar } from '@/components/Finance/shared/FinanceWorkspaceBar';
import { EmptyStateInline } from '@/components/shared/NModeBlocks/EmptyStateInline';
import { LoadingState } from '@/components/shared/states';
import { useFinanceFocusMode } from '@/hooks/useFinanceFocusMode';
import { useFinancePredictionWorkspaceFlag } from '@/hooks/useFinancePredictionWorkspaceFlag';
import {
  getFinanceBusinessVersion,
  getFinancePredictionAuthoring,
  runFinancePredictionCalculate,
  runFinancePredictionPreflight,
  saveFinancePredictionAuthoring,
} from '@/services/api/financeV2.api';
import {
  clearPersistentCommandId,
  persistentCommandId,
} from '@/services/initiatives-execution/persistentCommandId';
import {
  businessVersionStatusLabel,
  describeFinanceV2Error,
  type FinanceBusinessVersionDetailDto,
  type FinancePredictionAuthoringDto,
} from '@/services/api/financeV2.types';

import {
  type CanonicalValueMap,
  createEmptyScenarioDraft,
  type ExceptionLedgerEntry,
  type ScenarioDraft,
} from './predictionScenarioModel';
import {
  buildPredictionEvaluationContext,
  buildPredictionWorkspaceBarConfig,
  PREDICTION_VIEW_IDS,
  type PredictionViewId,
} from './predictionWorkspaceBarConfig';
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

type AuthoringState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; revision: number }
  | { kind: 'saving'; revision: number }
  | { kind: 'error'; message: string };

const AUTHORING_COMMAND_NAMESPACE = 'finance-prediction-authoring-v1';
const authoringContent = (draft: ScenarioDraft) =>
  JSON.stringify({
    scenarioMode: draft.scenarioMode,
    name: draft.name,
    driverOverrides: draft.driverOverrides,
    initiatives: draft.initiatives,
    impacts: draft.impacts,
    financing: draft.financing,
  });
const authoringIntent = (businessVersionId: string, revision: number, draft: ScenarioDraft) =>
  `${businessVersionId}:${revision}:${authoringContent(draft)}`;

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

  const [draft, setDraft] = useState<ScenarioDraft>(
    props.initialDraft ?? createEmptyScenarioDraft({ name: 'Nowy scenariusz' })
  );
  const [authoringState, setAuthoringState] = useState<AuthoringState>({ kind: 'idle' });
  const [authoringAttempt, setAuthoringAttempt] = useState(0);
  const [confirmedAuthoringContent, setConfirmedAuthoringContent] = useState<string | null>(null);
  const [computeContext, setComputeContext] = useState<
    FinancePredictionAuthoringDto['computeContext'] | null
  >(null);
  const [canonicalResults, setCanonicalResults] = useState<
    FinancePredictionAuthoringDto['results']
  >({
    scenarioValues: {},
    baselineValues: {},
  });
  const [activeViewId, setActiveViewId] = useState<PredictionViewId>(
    PREDICTION_VIEW_IDS.assumptions
  );
  const [exceptionLedger, setExceptionLedger] = useState<readonly ExceptionLedgerEntry[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Load the canonical authoring snapshot. An unavailable read is fail-closed:
  // never render an editable local scratch that could be mistaken for server state.
  useEffect(() => {
    if (mountCheck.kind !== 'confirmed') return;
    let cancelled = false;
    const confirmedId = mountCheck.version.businessVersionId;
    setAuthoringState({ kind: 'loading' });
    getFinancePredictionAuthoring(confirmedId)
      .then((snapshot) => {
        if (cancelled) return;
        setDraft(
          snapshot.draft
            ? { ...snapshot.draft, businessVersionId: confirmedId }
            : {
                ...(props.initialDraft ?? createEmptyScenarioDraft({ name: 'Nowy scenariusz' })),
                businessVersionId: confirmedId,
              }
        );
        setComputeContext(snapshot.computeContext);
        setCanonicalResults(snapshot.results);
        setConfirmedAuthoringContent(
          snapshot.configured
            ? authoringContent(
                snapshot.draft
                  ? { ...snapshot.draft, businessVersionId: confirmedId }
                  : {
                      ...(props.initialDraft ??
                        createEmptyScenarioDraft({ name: 'Nowy scenariusz' })),
                      businessVersionId: confirmedId,
                    }
              )
            : null
        );
        setAuthoringState({ kind: 'ready', revision: snapshot.revision });
      })
      .catch((error) => {
        if (cancelled) return;
        setAuthoringState({ kind: 'error', message: describeFinanceV2Error(error).detail });
      });
    return () => {
      cancelled = true;
    };
  }, [authoringAttempt, mountCheck, props.initialDraft]);

  const saveAuthoring = useCallback(async (): Promise<ScenarioDraft> => {
    if (
      !draft.businessVersionId ||
      (authoringState.kind !== 'ready' && authoringState.kind !== 'saving')
    ) {
      throw new Error('Canonical prediction authoring is not ready');
    }
    if (confirmedAuthoringContent === authoringContent(draft)) return draft;
    const revision = authoringState.revision;
    const intent = authoringIntent(draft.businessVersionId, revision, draft);
    const idempotencyKey = persistentCommandId(AUTHORING_COMMAND_NAMESPACE, intent);
    setAuthoringState({ kind: 'saving', revision });
    try {
      const written = await saveFinancePredictionAuthoring({
        businessVersionId: draft.businessVersionId,
        expectedRevision: revision,
        draft,
        idempotencyKey,
      });
      const cold = await getFinancePredictionAuthoring(draft.businessVersionId);
      if (!written.draft || !cold.draft || cold.revision !== written.revision) {
        throw new Error('Canonical prediction readback did not confirm the saved revision');
      }
      clearPersistentCommandId(AUTHORING_COMMAND_NAMESPACE, intent);
      const confirmed = { ...cold.draft, businessVersionId: draft.businessVersionId };
      setDraft(confirmed);
      setComputeContext(cold.computeContext);
      setCanonicalResults(cold.results);
      setConfirmedAuthoringContent(authoringContent(confirmed));
      setAuthoringState({ kind: 'ready', revision: cold.revision });
      setStatusMessage(`Założenia zapisane i potwierdzone (rewizja ${cold.revision}).`);
      return confirmed;
    } catch (error) {
      const described = describeFinanceV2Error(error);
      if (described.code === 'PREDICTION_AUTHORING_CONFLICT') {
        try {
          const cold = await getFinancePredictionAuthoring(draft.businessVersionId);
          if (!cold.draft || cold.revision <= revision) {
            throw new Error('Conflict readback did not return a newer canonical revision');
          }
          clearPersistentCommandId(AUTHORING_COMMAND_NAMESPACE, intent);
          const authoritative = { ...cold.draft, businessVersionId: draft.businessVersionId };
          setDraft(authoritative);
          setComputeContext(cold.computeContext);
          setCanonicalResults(cold.results);
          setConfirmedAuthoringContent(authoringContent(authoritative));
          setAuthoringState({ kind: 'ready', revision: cold.revision });
          const reconciled = Object.assign(
            new Error(
              `Założenia zostały zmienione w innym miejscu. Wczytano kanoniczną rewizję ${cold.revision}; sprawdź dane i ponów świadomą zmianę.`
            ),
            {
              status: 409,
              data: { code: 'PREDICTION_AUTHORING_CONFLICT_RECONCILED' },
            }
          );
          throw reconciled;
        } catch (reconciliationError) {
          if (
            reconciliationError instanceof Error &&
            (reconciliationError as Error & { data?: { code?: string } }).data?.code ===
              'PREDICTION_AUTHORING_CONFLICT_RECONCILED'
          ) {
            throw reconciliationError;
          }
          setAuthoringState({ kind: 'ready', revision });
          throw error;
        }
      }
      setAuthoringState({ kind: 'ready', revision });
      throw error;
    }
  }, [authoringState, confirmedAuthoringContent, draft]);

  const focusMode = useFinanceFocusMode({ workspaceState: draft, activeViewId });

  const canonicalVersion = mountCheck.kind === 'confirmed' ? mountCheck.version : null;
  const canonicalStatus = canonicalVersion?.status ?? 'DRAFT';
  const canonicalFreshness = canonicalVersion?.freshness ?? 'NEVER_COMPUTED';
  const hasUncommittedWorkingRevision =
    authoringState.kind === 'ready' &&
    confirmedAuthoringContent !== null &&
    confirmedAuthoringContent !== authoringContent(draft);

  const evaluationContext = buildPredictionEvaluationContext({
    status: canonicalStatus,
    role: 'finance_admin',
    freshness: canonicalFreshness,
  });
  const config = buildPredictionWorkspaceBarConfig({
    draft,
    activeViewId,
    artifactId: props.artifactId,
    status: canonicalStatus,
    role: 'finance_admin',
    freshness: canonicalFreshness,
    versionNo: canonicalVersion?.versionNo,
    hasUncommittedWorkingRevision,
  });

  async function handlePreflight(): Promise<void> {
    if (!draft.businessVersionId) {
      setStatusMessage(
        'Brak realnego scenariusza na serwerze — preflight wymaga kanonicznego businessVersionId.'
      );
      return;
    }
    try {
      const confirmedDraft = await saveAuthoring();
      const result = await runFinancePredictionPreflight({
        businessVersionId: confirmedDraft.businessVersionId!,
        ...(computeContext?.entityIds[0] ? { entityId: computeContext.entityIds[0] } : {}),
        ...(computeContext?.openingBalanceSheetPeriodId
          ? { openingBalanceSheetPeriodId: computeContext.openingBalanceSheetPeriodId }
          : {}),
      });
      setStatusMessage(
        `Preflight: ${result.findingsCount} znalezisk, ${result.requiredResolutionsCount} wymaga rozstrzygnięcia.`
      );
    } catch (err) {
      setStatusMessage(describeFinanceV2Error(err).detail);
    }
  }

  async function handleCalculate(): Promise<void> {
    if (!draft.businessVersionId) {
      setStatusMessage(
        'Brak realnego scenariusza na serwerze — nie można wywołać /calculate bez zapisanego businessVersionId.'
      );
      return;
    }
    try {
      const confirmedDraft = await saveAuthoring();
      if (
        !computeContext?.ready ||
        !computeContext.entityIds[0] ||
        !computeContext.openingBalanceSheetPeriodId
      ) {
        setStatusMessage(
          'Obliczenie jest zablokowane: kanoniczny model bazowy nie ma jeszcze kompletnego zestawu encja + okresy prognozy + okres otwarcia.'
        );
        return;
      }
      await runFinancePredictionCalculate({
        businessVersionId: confirmedDraft.businessVersionId!,
        entityId: computeContext.entityIds[0],
        forecastPeriodIds: computeContext.forecastPeriodIds,
        openingBalanceSheetPeriodId: computeContext.openingBalanceSheetPeriodId,
      });
      const cold = await getFinancePredictionAuthoring(confirmedDraft.businessVersionId!);
      if (
        !cold.draft ||
        cold.businessVersionId !== confirmedDraft.businessVersionId ||
        Object.keys(cold.results.scenarioValues).length === 0
      ) {
        throw new Error('Canonical prediction result readback did not match the saved scenario');
      }
      setDraft({ ...cold.draft, businessVersionId: confirmedDraft.businessVersionId });
      setComputeContext(cold.computeContext);
      setCanonicalResults(cold.results);
      setStatusMessage('Obliczenie zakończone i potwierdzone odczytem kanonicznych wyników.');
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
          action={{
            label: 'Wróć do listy',
            onClick: () => props.onNavigateBack?.(),
            showPrefix: false,
            neutralAccent: true,
          }}
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
          action={{
            label: 'Wróć do listy',
            onClick: () => props.onNavigateBack?.(),
            showPrefix: false,
            neutralAccent: true,
          }}
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
          action={{
            label: 'Spróbuj ponownie',
            onClick: () => setCheckAttempt((n) => n + 1),
            showPrefix: false,
            neutralAccent: true,
          }}
        />
      </div>
    );
  }

  if (authoringState.kind === 'idle' || authoringState.kind === 'loading') {
    return (
      <div className="p-6" data-testid="prediction-authoring-loading">
        <LoadingState template="panel" />
      </div>
    );
  }
  if (authoringState.kind === 'error') {
    return (
      <div className="p-4" data-testid="prediction-authoring-error">
        <EmptyStateInline
          message="Nie udało się odczytać zapisanych założeń scenariusza."
          hint={authoringState.message}
          action={{
            label: 'Spróbuj ponownie',
            onClick: () => setAuthoringAttempt((n) => n + 1),
            showPrefix: false,
            neutralAccent: true,
          }}
        />
      </div>
    );
  }

  return (
    <FinanceErrorBoundary
      documentLabel={draft.name}
      onRetry={() => setStatusMessage(null)}
      onBackToList={() => props.onNavigateBack?.()}
    >
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

        <div
          className="border-b border-c-border-subtle bg-c-surface-raised px-4 py-2 text-xs text-c-text-secondary"
          role="status"
          data-testid="prediction-canonical-authoring-banner"
        >
          Realny rekord (wersja {mountCheck.version.versionNo}, status:{' '}
          {businessVersionStatusLabel(mountCheck.version.status)}) i kanoniczna treść założeń
          zostały odczytane. Rewizja authoringu: {authoringState.revision}.
          <button
            type="button"
            className="ml-3 rounded border border-c-border px-3 py-1 font-medium text-c-text-primary disabled:opacity-50"
            disabled={authoringState.kind === 'saving'}
            onClick={() =>
              void saveAuthoring().catch((error) =>
                setStatusMessage(describeFinanceV2Error(error).detail)
              )
            }
            data-testid="prediction-save-authoring"
          >
            {authoringState.kind === 'saving' ? 'Zapisywanie…' : 'Zapisz założenia'}
          </button>
        </div>

        {statusMessage && (
          <div
            className="border-b border-c-border-subtle bg-c-surface-raised px-4 py-2 text-sm text-c-text-secondary"
            role="status"
            data-testid="prediction-status-message"
          >
            {statusMessage}
          </div>
        )}

        <div className="min-h-0 flex-1">
          {activeViewId === PREDICTION_VIEW_IDS.assumptions && (
            <ScenarioAssumptionsView draft={draft} onChange={setDraft} />
          )}
          {activeViewId === PREDICTION_VIEW_IDS.results && (
            <ScenarioResultsView
              draft={draft}
              scenarioValues={props.scenarioValues ?? canonicalResults.scenarioValues}
              baselineValues={props.baselineValues ?? canonicalResults.baselineValues}
              exceptionLedger={exceptionLedger}
            />
          )}
        </div>
      </div>
    </FinanceErrorBoundary>
  );
}

export default PredictionWorkspace;
