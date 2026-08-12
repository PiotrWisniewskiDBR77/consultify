/**
 * @vitest-environment jsdom
 *
 * `PredictionWorkspace` — smoke render + kontrola negatywna (Pakiet G).
 *
 * Dowodzi:
 *   - render realnego komponentu (nie atrapy): FinanceWorkspaceBar + oba widoki montują się,
 *     przełączanie widoków (Budowa założeń <-> Modele/Wyniki) faktycznie zmienia DOM.
 *   - przełączanie trybu budowy (A/B/C) w widoku założeń renderuje odpowiedni panel.
 *   - bez realnego `businessVersionId` (luka CRUD, patrz predictionScenarioModel.ts nagłówek)
 *     kliknięcie "Uruchom preflight"/"Przelicz scenariusz" pokazuje honest-UI komunikat zamiast
 *     fejkować sukces lub crashować.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { createEmptyScenarioDraft } from '../predictionScenarioModel';
import { PredictionWorkspace } from '../PredictionWorkspace';

describe('PredictionWorkspace — smoke render', () => {
  it('montuje FinanceWorkspaceBar i widok Budowa założeń domyślnie', () => {
    render(<PredictionWorkspace artifactId="artifact-1" />);
    expect(screen.getByTestId('finance-workspace-bar')).toBeInTheDocument();
    expect(screen.getByTestId('prediction-assumptions-view')).toBeInTheDocument();
  });

  it('przełączenie widoku na Modele/Wyniki faktycznie zmienia DOM (real render, nie atrapa)', async () => {
    render(<PredictionWorkspace artifactId="artifact-1" />);
    expect(screen.queryByTestId('prediction-results-view')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Modele\/Wyniki/i }));
    await waitFor(() => expect(screen.getByTestId('prediction-results-view')).toBeInTheDocument());
    expect(screen.queryByTestId('prediction-assumptions-view')).not.toBeInTheDocument();
  });

  it('KONTROLA NEGATYWNA: zmiana initialDraft.name propaguje się do wyświetlanej nazwy (dowód, że renderuje realne propsy)', () => {
    const draft = createEmptyScenarioDraft({ name: 'Scenariusz XYZ-Unikalny' });
    render(<PredictionWorkspace artifactId="artifact-1" initialDraft={draft} />);
    expect(screen.getByTestId('finance-workspace-bar-name')).toHaveTextContent('Scenariusz XYZ-Unikalny');
  });

  it('tryb C (fundamentalny) renderuje panel inicjatyw z przyciskiem "Dodaj inicjatywę"', () => {
    const draft = createEmptyScenarioDraft({ name: 'x', scenarioMode: 'FUNDAMENTAL_INITIATIVE' });
    render(<PredictionWorkspace artifactId="artifact-1" initialDraft={draft} />);
    expect(screen.getByTestId('add-initiative')).toBeInTheDocument();
  });

  it('bez businessVersionId, klik "Uruchom preflight" pokazuje honest-UI komunikat, nie fejkuje sukcesu', async () => {
    render(<PredictionWorkspace artifactId="artifact-1" />);
    // Sekundarna akcja (preflight) jest w pasku — szukamy po tekście etykiety.
    const preflightButton = screen.getByRole('button', { name: /Uruchom preflight/i });
    fireEvent.click(preflightButton);
    await waitFor(() => expect(screen.getByTestId('prediction-status-message')).toBeInTheDocument());
    expect(screen.getByTestId('prediction-status-message').textContent).toMatch(/Brak realnego scenariusza/);
  });
});
