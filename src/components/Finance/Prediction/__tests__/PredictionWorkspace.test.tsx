/**
 * @vitest-environment jsdom
 *
 * `PredictionWorkspace` — smoke render + kontrola negatywna (Pakiet G) +
 * ID_BRIDGE (Gate E) ANTY-CICHA-PUSTKA.
 *
 * Dowodzi:
 *   - render realnego komponentu (nie atrapy): FinanceWorkspaceBar + oba widoki montują się
 *     PO potwierdzeniu realnego `businessVersionId` (nie od razu — patrz sekcja niżej), przełączanie
 *     widoków (Budowa założeń <-> Modele/Wyniki) faktycznie zmienia DOM.
 *   - przełączanie trybu budowy (A/B/C) w widoku założeń renderuje odpowiedni panel.
 *   - preflight/calculate używają trwałego kontekstu pobranego z serwera.
 *
 * ★★ NAJWAŻNIEJSZY BLOK ("Anty-cicha-pustka" niżej): dowodzi, że komponent NIGDY nie renderuje
 * pustego formularza założeń bez jawnego sygnału — trzy stany (brak id / 404 / błąd sieci) mają
 * TRZY różne, widoczne komunikaty PL, żaden z nich nie jest cichy.
 *
 * AP_MOUNT §A: `PredictionWorkspace` teraz SAM odczytuje
 * `financePredictionWorkspaceV1` i renderuje `null` przy OFF — te testy
 * dowodzą zachowania ekranu przy fladze WŁĄCZONEJ (real local override, nie
 * mock hooka), więc `beforeEach` włącza flagę tym samym mechanizmem, którego
 * użyłby prawdziwy użytkownik/harness (localStorage). Osobny plik
 * `PredictionWorkspace.flag.test.tsx` dowodzi zachowania przy OFF.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearFeatureFlagOverrides,
  setFeatureFlagOverrides,
} from '@/test-utils/featureFlagOverrides';

import type { FinancePredictionDraftDto } from '../../../../services/api/financeV2.types';

const apiMocks = vi.hoisted(() => ({
  getFinancePredictionDraft: vi.fn(),
  saveFinancePredictionDraft: vi.fn(),
  runFinancePredictionPreflight: vi.fn(),
  runFinancePredictionCalculate: vi.fn(),
}));
vi.mock('@/services/api/financeV2.api', () => apiMocks);

import { PredictionWorkspace } from '../PredictionWorkspace';

const PERSISTED_DRAFT: FinancePredictionDraftDto = {
  businessVersionId: 'bv-prediction-1',
  version: 1,
  sourceBaselineVersionId: 'bv-baseline-1',
  sourceBaselineContextVersion: 3,
  sourceBaselineContextHash: 'a'.repeat(64),
  sourceStatementVersionId: 'bv-statement-1',
  sourceAnalysisVersionId: 'bv-analysis-1',
  name: 'Scenariusz zapisany',
  description: null,
  scenarioMode: 'STANDARD_BASE',
  computeContext: {
    entityId: 'entity-real',
    openingBalanceSheetPeriodId: 'period-opening',
    forecastPeriods: [
      {
        periodId: 'period-forecast',
        label: '01/2026',
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
      },
    ],
  },
  driverOverrides: [],
  initiatives: [],
  impacts: [],
  financing: [],
  lastAssumptionChangeAt: '2026-08-01T00:00:00Z',
  lastComputeAt: null,
};

/** Same error shape `isFinanceV2ApiError`/`describeFinanceV2Error` expect — `.status`/`.data.code`. */
function apiError(status: number, code: string, message = 'boom'): Error {
  return Object.assign(new Error(message), { status, data: { code, error: message } });
}

describe('PredictionWorkspace — smoke render (real businessVersionId confirmed)', () => {
  beforeEach(() => {
    setFeatureFlagOverrides({ financePredictionWorkspaceV1: true });
    apiMocks.getFinancePredictionDraft.mockReset().mockResolvedValue(PERSISTED_DRAFT);
    apiMocks.saveFinancePredictionDraft.mockReset();
    apiMocks.runFinancePredictionPreflight.mockReset();
    apiMocks.runFinancePredictionCalculate.mockReset();
  });
  afterEach(() => {
    clearFeatureFlagOverrides();
  });

  it('montuje FinanceWorkspaceBar i widok Budowa założeń dopiero PO potwierdzeniu businessVersionId', async () => {
    render(<PredictionWorkspace artifactId="artifact-1" businessVersionId="bv-prediction-1" />);
    await waitFor(() => expect(screen.getByTestId('finance-workspace-bar')).toBeInTheDocument());
    expect(screen.getByTestId('prediction-assumptions-view')).toBeInTheDocument();
    expect(apiMocks.getFinancePredictionDraft).toHaveBeenCalledWith('bv-prediction-1');
  });

  it('pokazuje wersję trwałego draftu i wersję kontekstu Baseline zamiast scratch bannera', async () => {
    render(<PredictionWorkspace artifactId="artifact-1" businessVersionId="bv-prediction-1" />);
    await waitFor(() => expect(screen.getByTestId('prediction-draft-version')).toBeInTheDocument());
    expect(screen.getByTestId('prediction-draft-version')).toHaveTextContent('Draft v1');
    expect(screen.getByTestId('prediction-draft-version')).toHaveTextContent('Baseline context v3');
  });

  it('przełączenie widoku na Modele/Wyniki faktycznie zmienia DOM (real render, nie atrapa)', async () => {
    render(<PredictionWorkspace artifactId="artifact-1" businessVersionId="bv-prediction-1" />);
    await waitFor(() =>
      expect(screen.getByTestId('prediction-assumptions-view')).toBeInTheDocument()
    );
    expect(screen.queryByTestId('prediction-results-view')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Modele\/Wyniki/i }));
    await waitFor(() => expect(screen.getByTestId('prediction-results-view')).toBeInTheDocument());
    expect(screen.queryByTestId('prediction-assumptions-view')).not.toBeInTheDocument();
  });

  it('kanoniczny GET jest źródłem nazwy wyświetlanej w workspace', async () => {
    apiMocks.getFinancePredictionDraft.mockResolvedValue({
      ...PERSISTED_DRAFT,
      name: 'Scenariusz XYZ-Unikalny',
    });
    render(<PredictionWorkspace artifactId="artifact-1" businessVersionId="bv-prediction-1" />);
    await waitFor(() =>
      expect(screen.getByTestId('finance-workspace-bar-name')).toHaveTextContent(
        'Scenariusz XYZ-Unikalny'
      )
    );
  });

  it('tryb C (fundamentalny) renderuje panel inicjatyw z przyciskiem "Dodaj inicjatywę"', async () => {
    apiMocks.getFinancePredictionDraft.mockResolvedValue({
      ...PERSISTED_DRAFT,
      name: 'x',
      scenarioMode: 'FUNDAMENTAL_INITIATIVE',
    });
    render(<PredictionWorkspace artifactId="artifact-1" businessVersionId="bv-prediction-1" />);
    await waitFor(() => expect(screen.getByTestId('add-initiative')).toBeInTheDocument());
  });

  it('przeliczenie używa wyłącznie encji i okresów z trwałego kontekstu', async () => {
    apiMocks.runFinancePredictionCalculate.mockResolvedValue({
      mode: 'STANDARD_BASE',
      jobId: 'job-1',
      jobStatus: 'SUCCEEDED',
      baselineJobId: 'baseline-job-1',
      passthroughRowCount: 1,
    });
    render(<PredictionWorkspace artifactId="artifact-1" businessVersionId="bv-prediction-1" />);
    await waitFor(() => expect(screen.getByTestId('finance-workspace-bar')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Przelicz/i }));

    await waitFor(() =>
      expect(apiMocks.runFinancePredictionCalculate).toHaveBeenCalledWith({
        businessVersionId: 'bv-prediction-1',
        entityId: 'entity-real',
        forecastPeriodIds: ['period-forecast'],
        openingBalanceSheetPeriodId: 'period-opening',
      })
    );
  });

  it('zapisuje zmieniony draft z bieżącą wersją i po sukcesie pokazuje nową wersję', async () => {
    const fundamental = {
      ...PERSISTED_DRAFT,
      scenarioMode: 'FUNDAMENTAL_INITIATIVE',
    };
    apiMocks.getFinancePredictionDraft.mockResolvedValue(fundamental);
    apiMocks.saveFinancePredictionDraft.mockResolvedValue({
      ...fundamental,
      version: 2,
      name: 'Nazwa znormalizowana przez serwer',
    });
    render(<PredictionWorkspace artifactId="artifact-1" businessVersionId="bv-prediction-1" />);
    await waitFor(() => expect(screen.getByTestId('add-initiative')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('add-initiative'));
    fireEvent.click(screen.getByTestId('prediction-draft-save'));

    await waitFor(() => expect(apiMocks.saveFinancePredictionDraft).toHaveBeenCalledTimes(1));
    expect(apiMocks.saveFinancePredictionDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        businessVersionId: 'bv-prediction-1',
        expectedVersion: 1,
        idempotencyKey: expect.any(String),
        draft: expect.objectContaining({
          scenarioMode: 'FUNDAMENTAL_INITIATIVE',
          initiatives: expect.arrayContaining([expect.objectContaining({ name: 'Nowa inicjatywa' })]),
        }),
      })
    );
    await waitFor(() => expect(screen.getByTestId('prediction-draft-version')).toHaveTextContent('Draft v2'));
    expect(screen.getByTestId('finance-workspace-bar-name')).toHaveTextContent(
      'Nazwa znormalizowana przez serwer'
    );
    expect(screen.getByTestId('prediction-status-message')).toHaveTextContent('Draft zapisany');
  });

  it('nie uruchamia preflight dla niezapisanego draftu', async () => {
    apiMocks.getFinancePredictionDraft.mockResolvedValue({
      ...PERSISTED_DRAFT,
      scenarioMode: 'FUNDAMENTAL_INITIATIVE',
    });
    render(<PredictionWorkspace artifactId="artifact-1" businessVersionId="bv-prediction-1" />);
    await waitFor(() => expect(screen.getByTestId('add-initiative')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('add-initiative'));
    fireEvent.click(screen.getByRole('button', { name: /Uruchom preflight/i }));
    expect(apiMocks.runFinancePredictionPreflight).not.toHaveBeenCalled();
    expect(screen.getByTestId('prediction-status-message')).toHaveTextContent(/Zapisz bieżący draft/);
  });

  it('po konflikcie zachowuje edycję do jawnego wczytania wersji serwera', async () => {
    const fundamental = { ...PERSISTED_DRAFT, scenarioMode: 'FUNDAMENTAL_INITIATIVE' };
    apiMocks.getFinancePredictionDraft
      .mockResolvedValueOnce(fundamental)
      .mockResolvedValueOnce({ ...fundamental, version: 4, name: 'Wersja serwera po konflikcie' });
    apiMocks.saveFinancePredictionDraft.mockRejectedValue(
      apiError(409, 'PREDICTION_DRAFT_VERSION_CONFLICT', 'Draft changed')
    );
    render(<PredictionWorkspace artifactId="artifact-1" businessVersionId="bv-prediction-1" />);
    await waitFor(() => expect(screen.getByTestId('add-initiative')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('add-initiative'));
    fireEvent.click(screen.getByTestId('prediction-draft-save'));
    await waitFor(() => expect(screen.getByTestId('prediction-conflict-reload')).toBeInTheDocument());
    expect(screen.getAllByTestId(/^initiative-card-/)).toHaveLength(1);
    fireEvent.click(screen.getByTestId('prediction-conflict-reload'));
    await waitFor(() => expect(screen.getByTestId('finance-workspace-bar-name')).toHaveTextContent('Wersja serwera po konflikcie'));
    expect(screen.getByTestId('prediction-draft-version')).toHaveTextContent('Draft v4');
  });

  it('nie zaokrągla nieedytowanego decimal string przy niezwiązanej zmianie draftu', async () => {
    const precise = {
      ...PERSISTED_DRAFT,
      scenarioMode: 'FUNDAMENTAL_INITIATIVE',
      initiatives: [{
        id: 'initiative-precise', initiativeCode: 'PRECISE', name: 'Precise', description: null,
        source: null, owner: null, confidencePct: '80.123456789012345678',
        defaultStartPeriodId: null, defaultRampMonths: null, defaultDurationMonths: null,
        implementationCostDecimal: '10.123456789012345678', status: 'DRAFT',
      }],
      impacts: [],
    };
    apiMocks.getFinancePredictionDraft.mockResolvedValue(precise);
    apiMocks.saveFinancePredictionDraft.mockResolvedValue({ ...precise, version: 2 });
    render(<PredictionWorkspace artifactId="artifact-1" businessVersionId="bv-prediction-1" />);
    await waitFor(() => expect(screen.getByTestId('add-initiative')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('add-initiative'));
    fireEvent.click(screen.getByTestId('prediction-draft-save'));
    await waitFor(() => expect(apiMocks.saveFinancePredictionDraft).toHaveBeenCalled());
    const command = apiMocks.saveFinancePredictionDraft.mock.calls.at(-1)?.[0];
    expect(command.draft.initiatives[0]).toMatchObject({
      confidencePct: '80.123456789012345678',
      implementationCostDecimal: '10.123456789012345678',
    });
  });

  it('gdy realny endpoint preflight odrzuca wywołanie, pokazuje honest-UI komunikat bez fałszywego sukcesu', async () => {
    apiMocks.runFinancePredictionPreflight.mockRejectedValue(apiError(404, 'NOT_FOUND'));
    render(<PredictionWorkspace artifactId="artifact-1" businessVersionId="bv-prediction-1" />);
    await waitFor(() => expect(screen.getByTestId('finance-workspace-bar')).toBeInTheDocument());
    const preflightButton = screen.getByRole('button', { name: /Uruchom preflight/i });
    fireEvent.click(preflightButton);
    await waitFor(() =>
      expect(screen.getByTestId('prediction-status-message')).toBeInTheDocument()
    );
    expect(screen.getByTestId('prediction-status-message').textContent).toMatch(
      /nie istnieje albo nie masz do niej dostępu/
    );
    expect(apiMocks.runFinancePredictionPreflight).toHaveBeenCalledWith({
      businessVersionId: 'bv-prediction-1',
      entityId: 'entity-real',
      openingBalanceSheetPeriodId: 'period-opening',
    });
  });
});

// =============================================================================================
// ★★★ ANTY-CICHA-PUSTKA — najważniejszy blok tego pakietu (ID_BRIDGE, Gate E).
//
// Właściciel: "Prediction... pokazuje pusty, niezwiązany szkic bez jakiegokolwiek sygnału, że
// coś jest nie tak. Cicha pustka jest gorsza od widocznego błędu." Te testy dowodzą, że TO SIĘ
// JUŻ NIE DZIEJE: dla KAŻDEGO z trzech "nie mogę pokazać danych" powodów (brak id / rekord nie
// istnieje / błąd sieci-serwera) użytkownik dostaje jawny, odróżnialny komunikat PL — i w ŻADNYM
// z nich nie renderuje się `prediction-assumptions-view` (pusty formularz).
// =============================================================================================
describe('PredictionWorkspace — ANTY-CICHA-PUSTKA (ID_BRIDGE Gate E)', () => {
  beforeEach(() => {
    setFeatureFlagOverrides({ financePredictionWorkspaceV1: true });
    apiMocks.getFinancePredictionDraft.mockReset();
    apiMocks.saveFinancePredictionDraft.mockReset();
    apiMocks.runFinancePredictionPreflight.mockReset();
    apiMocks.runFinancePredictionCalculate.mockReset();
  });
  afterEach(() => {
    clearFeatureFlagOverrides();
  });

  it('★ podsunięty identyfikator, którego nie da się rozwiązać (businessVersionId=null, most nie znalazł odpowiednika) -> JAWNY komunikat, ZERO wywołań sieciowych, formularz NIGDY nie renderuje się', async () => {
    render(
      <PredictionWorkspace
        artifactId="artifact-1"
        businessVersionId={null}
        onNavigateBack={() => {}}
      />
    );

    // Jawny sygnał, natychmiast, bez potrzeby czekania na sieć — bo nie ma czego odpytać.
    expect(screen.getByTestId('prediction-mount-no-id')).toBeInTheDocument();
    expect(screen.getByTestId('prediction-mount-no-id').textContent).toMatch(
      /brak połączenia z realnym rekordem|nie został przeniesiony/
    );

    // Formularz założeń — czyli dokładnie to, co właściciel opisał jako "wiarygodnie wyglądający
    // pusty ekran" — nigdy się nie montuje.
    expect(screen.queryByTestId('prediction-assumptions-view')).not.toBeInTheDocument();
    expect(screen.queryByTestId('finance-workspace-bar')).not.toBeInTheDocument();

    // I nie ma żadnej próby pobrania czegokolwiek — nie ma czego (świadomie, nie przez przypadek).
    expect(apiMocks.getFinancePredictionDraft).not.toHaveBeenCalled();
  });

  it('businessVersionId ustawiony, ale rekord nie istnieje w nowym systemie (404) -> JAWNY komunikat "nie znaleziono", nie pusty formularz', async () => {
    apiMocks.getFinancePredictionDraft.mockRejectedValue(apiError(404, 'NOT_FOUND'));
    render(
      <PredictionWorkspace
        artifactId="artifact-1"
        businessVersionId="bv-does-not-exist"
        onNavigateBack={() => {}}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId('prediction-mount-not-found')).toBeInTheDocument()
    );
    expect(screen.getByTestId('prediction-mount-not-found').textContent).toMatch(/Nie znaleziono/);
    expect(screen.queryByTestId('prediction-assumptions-view')).not.toBeInTheDocument();
  });

  it('błąd sieci/serwera przy sprawdzaniu businessVersionId -> JAWNY komunikat błędu z przyciskiem "Spróbuj ponownie", nie pusty formularz', async () => {
    apiMocks.getFinancePredictionDraft.mockRejectedValue(apiError(500, 'INTERNAL_ERROR'));
    render(
      <PredictionWorkspace
        artifactId="artifact-1"
        businessVersionId="bv-1"
        onNavigateBack={() => {}}
      />
    );

    await waitFor(() => expect(screen.getByTestId('prediction-mount-error')).toBeInTheDocument());
    expect(screen.queryByTestId('prediction-assumptions-view')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Spróbuj ponownie/i })).toBeInTheDocument();
  });

  it('"Spróbuj ponownie" po błędzie faktycznie odpytuje serwer jeszcze raz i przechodzi do prawdziwego workspace po sukcesie', async () => {
    apiMocks.getFinancePredictionDraft.mockRejectedValueOnce(apiError(500, 'INTERNAL_ERROR'));
    apiMocks.getFinancePredictionDraft.mockResolvedValueOnce(PERSISTED_DRAFT);
    render(
      <PredictionWorkspace
        artifactId="artifact-1"
        businessVersionId="bv-1"
        onNavigateBack={() => {}}
      />
    );

    await waitFor(() => expect(screen.getByTestId('prediction-mount-error')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Spróbuj ponownie/i }));

    await waitFor(() =>
      expect(screen.getByTestId('prediction-assumptions-view')).toBeInTheDocument()
    );
    expect(apiMocks.getFinancePredictionDraft).toHaveBeenCalledTimes(2);
  });

  it('podczas sprawdzania (przed odpowiedzią serwera) pokazuje stan ładowania, nie pusty formularz', async () => {
    let resolvePromise!: (v: FinancePredictionDraftDto) => void;
    apiMocks.getFinancePredictionDraft.mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      })
    );
    render(
      <PredictionWorkspace
        artifactId="artifact-1"
        businessVersionId="bv-1"
        onNavigateBack={() => {}}
      />
    );

    expect(screen.getByTestId('prediction-mount-checking')).toBeInTheDocument();
    expect(screen.queryByTestId('prediction-assumptions-view')).not.toBeInTheDocument();

    resolvePromise(PERSISTED_DRAFT);
    await waitFor(() =>
      expect(screen.getByTestId('prediction-assumptions-view')).toBeInTheDocument()
    );
  });
});
