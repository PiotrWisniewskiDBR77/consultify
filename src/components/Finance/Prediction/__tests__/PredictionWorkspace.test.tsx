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
 *   - bez realnego zapisanego scenariusza (luka CRUD, patrz predictionScenarioModel.ts nagłówek)
 *     kliknięcie "Uruchom preflight"/"Przelicz scenariusz" pokazuje honest-UI komunikat zamiast
 *     fejkować sukces lub crashować.
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

import { clearFeatureFlagOverrides, setFeatureFlagOverrides } from '@/test-utils/featureFlagOverrides';

import type { FinanceBusinessVersionDetailDto } from '../../../../services/api/financeV2.types';
import { createEmptyScenarioDraft } from '../predictionScenarioModel';

const apiMocks = vi.hoisted(() => ({
  getFinanceBusinessVersion: vi.fn(),
  runFinancePredictionPreflight: vi.fn(),
  runFinancePredictionCalculate: vi.fn(),
}));
vi.mock('@/services/api/financeV2.api', () => apiMocks);

import { PredictionWorkspace } from '../PredictionWorkspace';

const CONFIRMED_VERSION: FinanceBusinessVersionDetailDto = {
  businessVersionId: 'bv-prediction-1',
  artifactId: 'artifact-1',
  versionNo: 1,
  version: 1,
  status: 'DRAFT',
  freshness: 'NEVER_COMPUTED',
  freshnessReason: null,
  staleSince: null,
  riskTier: 'LOW',
  versionKind: 'MAIN',
  parentVersionId: null,
  supersededByVersionId: null,
  computeSnapshotId: null,
  computeRunId: null,
  contentSemanticHash: null,
  submittedBy: null,
  submittedAt: null,
  approvedBy: null,
  approvedAt: null,
  reopenReason: null,
  reopenedBy: null,
  reopenedAt: null,
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
};

/** Same error shape `isFinanceV2ApiError`/`describeFinanceV2Error` expect — `.status`/`.data.code`. */
function apiError(status: number, code: string, message = 'boom'): Error {
  return Object.assign(new Error(message), { status, data: { code, error: message } });
}

describe('PredictionWorkspace — smoke render (real businessVersionId confirmed)', () => {
  beforeEach(() => {
    setFeatureFlagOverrides({ financePredictionWorkspaceV1: true });
    apiMocks.getFinanceBusinessVersion.mockReset().mockResolvedValue(CONFIRMED_VERSION);
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
    expect(apiMocks.getFinanceBusinessVersion).toHaveBeenCalledWith('bv-prediction-1');
  });

  it('gdy businessVersionId jest potwierdzony ale bez zapisanej treści, ekran mówi to WPROST (baner), nie pokazuje cichego formularza', async () => {
    render(<PredictionWorkspace artifactId="artifact-1" businessVersionId="bv-prediction-1" />);
    await waitFor(() => expect(screen.getByTestId('prediction-honest-scratch-banner')).toBeInTheDocument());
    expect(screen.getByTestId('prediction-honest-scratch-banner').textContent).toMatch(
      /nowy szkic|odczyt zapisanej treści scenariusza nie jest dziś dostępny/
    );
  });

  it('przełączenie widoku na Modele/Wyniki faktycznie zmienia DOM (real render, nie atrapa)', async () => {
    render(<PredictionWorkspace artifactId="artifact-1" businessVersionId="bv-prediction-1" />);
    await waitFor(() => expect(screen.getByTestId('prediction-assumptions-view')).toBeInTheDocument());
    expect(screen.queryByTestId('prediction-results-view')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Modele\/Wyniki/i }));
    await waitFor(() => expect(screen.getByTestId('prediction-results-view')).toBeInTheDocument());
    expect(screen.queryByTestId('prediction-assumptions-view')).not.toBeInTheDocument();
  });

  it('KONTROLA NEGATYWNA: zmiana initialDraft.name propaguje się do wyświetlanej nazwy (dowód, że renderuje realne propsy)', async () => {
    const draft = createEmptyScenarioDraft({ name: 'Scenariusz XYZ-Unikalny' });
    render(<PredictionWorkspace artifactId="artifact-1" businessVersionId="bv-prediction-1" initialDraft={draft} />);
    await waitFor(() => expect(screen.getByTestId('finance-workspace-bar-name')).toHaveTextContent('Scenariusz XYZ-Unikalny'));
  });

  it('tryb C (fundamentalny) renderuje panel inicjatyw z przyciskiem "Dodaj inicjatywę"', async () => {
    const draft = createEmptyScenarioDraft({ name: 'x', scenarioMode: 'FUNDAMENTAL_INITIATIVE' });
    render(<PredictionWorkspace artifactId="artifact-1" businessVersionId="bv-prediction-1" initialDraft={draft} />);
    await waitFor(() => expect(screen.getByTestId('add-initiative')).toBeInTheDocument());
  });

  it('gdy realny endpoint preflight odrzuca wywołanie (brak zapisanego scenariusza po stronie serwera — CRUD nie istnieje), klik "Uruchom preflight" pokazuje honest-UI komunikat, nie fejkuje sukcesu i nie crashuje', async () => {
    // Realny stan tej LUKI (patrz nagłówek pliku i `predictionScenarioModel.ts`): businessVersionId
    // jest teraz zawsze potwierdzony/prawdziwy (ID_BRIDGE fix), ale sam ENDPOINT preflight wciąż
    // odrzuca wywołanie, bo nie ma zapisanej treści scenariusza po stronie serwera — więc to REALNY
    // request, który realnie kończy się błędem, nie klient-side guard na brakującym id.
    apiMocks.runFinancePredictionPreflight.mockRejectedValue(apiError(404, 'NOT_FOUND'));
    render(<PredictionWorkspace artifactId="artifact-1" businessVersionId="bv-prediction-1" />);
    await waitFor(() => expect(screen.getByTestId('finance-workspace-bar')).toBeInTheDocument());
    const preflightButton = screen.getByRole('button', { name: /Uruchom preflight/i });
    fireEvent.click(preflightButton);
    await waitFor(() => expect(screen.getByTestId('prediction-status-message')).toBeInTheDocument());
    expect(screen.getByTestId('prediction-status-message').textContent).toMatch(/nie istnieje albo nie masz do niej dostępu/);
    expect(apiMocks.runFinancePredictionPreflight).toHaveBeenCalledWith({ businessVersionId: 'bv-prediction-1' });
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
    apiMocks.getFinanceBusinessVersion.mockReset();
    apiMocks.runFinancePredictionPreflight.mockReset();
    apiMocks.runFinancePredictionCalculate.mockReset();
  });
  afterEach(() => {
    clearFeatureFlagOverrides();
  });

  it('★ podsunięty identyfikator, którego nie da się rozwiązać (businessVersionId=null, most nie znalazł odpowiednika) -> JAWNY komunikat, ZERO wywołań sieciowych, formularz NIGDY nie renderuje się', async () => {
    render(<PredictionWorkspace artifactId="artifact-1" businessVersionId={null} onNavigateBack={() => {}} />);

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
    expect(apiMocks.getFinanceBusinessVersion).not.toHaveBeenCalled();
  });

  it('businessVersionId ustawiony, ale rekord nie istnieje w nowym systemie (404) -> JAWNY komunikat "nie znaleziono", nie pusty formularz', async () => {
    apiMocks.getFinanceBusinessVersion.mockRejectedValue(apiError(404, 'NOT_FOUND'));
    render(<PredictionWorkspace artifactId="artifact-1" businessVersionId="bv-does-not-exist" onNavigateBack={() => {}} />);

    await waitFor(() => expect(screen.getByTestId('prediction-mount-not-found')).toBeInTheDocument());
    expect(screen.getByTestId('prediction-mount-not-found').textContent).toMatch(/Nie znaleziono/);
    expect(screen.queryByTestId('prediction-assumptions-view')).not.toBeInTheDocument();
  });

  it('błąd sieci/serwera przy sprawdzaniu businessVersionId -> JAWNY komunikat błędu z przyciskiem "Spróbuj ponownie", nie pusty formularz', async () => {
    apiMocks.getFinanceBusinessVersion.mockRejectedValue(apiError(500, 'INTERNAL_ERROR'));
    render(<PredictionWorkspace artifactId="artifact-1" businessVersionId="bv-1" onNavigateBack={() => {}} />);

    await waitFor(() => expect(screen.getByTestId('prediction-mount-error')).toBeInTheDocument());
    expect(screen.queryByTestId('prediction-assumptions-view')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Spróbuj ponownie/i })).toBeInTheDocument();
  });

  it('"Spróbuj ponownie" po błędzie faktycznie odpytuje serwer jeszcze raz i przechodzi do prawdziwego workspace po sukcesie', async () => {
    apiMocks.getFinanceBusinessVersion.mockRejectedValueOnce(apiError(500, 'INTERNAL_ERROR'));
    apiMocks.getFinanceBusinessVersion.mockResolvedValueOnce(CONFIRMED_VERSION);
    render(<PredictionWorkspace artifactId="artifact-1" businessVersionId="bv-1" onNavigateBack={() => {}} />);

    await waitFor(() => expect(screen.getByTestId('prediction-mount-error')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Spróbuj ponownie/i }));

    await waitFor(() => expect(screen.getByTestId('prediction-assumptions-view')).toBeInTheDocument());
    expect(apiMocks.getFinanceBusinessVersion).toHaveBeenCalledTimes(2);
  });

  it('podczas sprawdzania (przed odpowiedzią serwera) pokazuje stan ładowania, nie pusty formularz', async () => {
    let resolvePromise!: (v: FinanceBusinessVersionDetailDto) => void;
    apiMocks.getFinanceBusinessVersion.mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      })
    );
    render(<PredictionWorkspace artifactId="artifact-1" businessVersionId="bv-1" onNavigateBack={() => {}} />);

    expect(screen.getByTestId('prediction-mount-checking')).toBeInTheDocument();
    expect(screen.queryByTestId('prediction-assumptions-view')).not.toBeInTheDocument();

    resolvePromise(CONFIRMED_VERSION);
    await waitFor(() => expect(screen.getByTestId('prediction-assumptions-view')).toBeInTheDocument());
  });
});
