/**
 * @vitest-environment jsdom
 *
 * `FinanceErrorBoundary` — kontrola negatywna (Pakiet C, OWN-FIN-002).
 *
 * Dowodzi:
 *   - wstrzyknięty błąd w JEDNYM dokumencie NIE wywala reszty strony —
 *     rodzeństwo poza boundary renderuje się normalnie.
 *   - correlation ID jest widoczny w UI.
 *   - `Ponów` przywraca normalny render (cofnięcie stanu błędu).
 *   - `Wróć do listy` woła callback bez modyfikowania niczego innego.
 *   - artefakt/draft (stan RODZICA, poza boundary) przetrwa cały cykl błąd→ponów.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { FinanceErrorBoundary } from '../FinanceErrorBoundary';

function Boom(): React.ReactElement {
  throw new Error('Symulowany błąd wyceny — Boom');
}

function SafeSibling(): React.ReactElement {
  return <div data-testid="safe-sibling">Reszta powłoki żyje</div>;
}

describe('FinanceErrorBoundary — izolacja błędu jednego dokumentu', () => {
  it('błąd w dziecku NIE wywala rodzeństwa poza boundary', () => {
    render(
      <div>
        <SafeSibling />
        <FinanceErrorBoundary documentLabel="Wycena DBR77 FY2026" onRetry={vi.fn()} onBackToList={vi.fn()}>
          <Boom />
        </FinanceErrorBoundary>
      </div>
    );
    expect(screen.getByTestId('safe-sibling')).toBeInTheDocument();
    expect(screen.getByTestId('finance-error-boundary')).toBeInTheDocument();
    expect(screen.getByText(/Nie udało się wyświetlić: Wycena DBR77 FY2026/)).toBeInTheDocument();
  });

  it('pokazuje correlation ID w UI', () => {
    render(
      <FinanceErrorBoundary documentLabel="Model X" onRetry={vi.fn()} onBackToList={vi.fn()}>
        <Boom />
      </FinanceErrorBoundary>
    );
    const correlationEl = screen.getByTestId('finance-error-boundary-correlation-id');
    expect(correlationEl.textContent).toMatch(/ID zgłoszenia:/);
    expect(correlationEl.textContent!.length).toBeGreaterThan('ID zgłoszenia: '.length);
  });

  it('KONTROLA NEGATYWNA: „Ponów” cofa stan błędu i pozwala normalnemu drzewu wyrenderować się ponownie', () => {
    let shouldThrow = true;
    function MaybeBoom(): React.ReactElement {
      if (shouldThrow) throw new Error('Błąd tymczasowy');
      return <div data-testid="recovered">Wyrenderowano poprawnie</div>;
    }
    const onRetry = vi.fn(() => {
      shouldThrow = false;
    });

    render(
      <FinanceErrorBoundary documentLabel="Analiza Y" onRetry={onRetry} onBackToList={vi.fn()}>
        <MaybeBoom />
      </FinanceErrorBoundary>
    );
    expect(screen.getByTestId('finance-error-boundary')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Ponów'));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('recovered')).toBeInTheDocument();
    expect(screen.queryByTestId('finance-error-boundary')).not.toBeInTheDocument();
  });

  it('KONTROLA NEGATYWNA: artefakt wybrany i draft w STANIE RODZICA przetrwają cały cykl błąd→ponów (boundary nie resetuje nic poza własnym stanem)', () => {
    function Harness(): React.ReactElement {
      const [selectedArtifactId] = useState('artifact-42'); // nigdy nie zmieniane przez boundary
      const [draftValue, setDraftValue] = useState('niezapisana zmiana użytkownika');
      const [throwError, setThrowError] = useState(true);

      function Content(): React.ReactElement {
        if (throwError) throw new Error('Awaria renderu wyceny');
        return <div data-testid="draft-echo">{draftValue}</div>;
      }

      return (
        <div>
          <div data-testid="selected-artifact">{selectedArtifactId}</div>
          <FinanceErrorBoundary
            documentLabel="Wycena Z"
            onRetry={() => setThrowError(false)}
            onBackToList={vi.fn()}
          >
            <Content />
          </FinanceErrorBoundary>
        </div>
      );
    }

    render(<Harness />);
    expect(screen.getByTestId('selected-artifact')).toHaveTextContent('artifact-42');
    expect(screen.getByTestId('finance-error-boundary')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Ponów'));

    // Artefakt wybrany w rodzicu — niezmieniony.
    expect(screen.getByTestId('selected-artifact')).toHaveTextContent('artifact-42');
    // Draft z rodzica przetrwał (boundary nigdy go nie widział/nie skasował).
    expect(screen.getByTestId('draft-echo')).toHaveTextContent('niezapisana zmiana użytkownika');
  });

  it('„Wróć do listy” woła onBackToList', () => {
    const onBackToList = vi.fn();
    render(
      <FinanceErrorBoundary documentLabel="Model Q" onRetry={vi.fn()} onBackToList={onBackToList}>
        <Boom />
      </FinanceErrorBoundary>
    );
    fireEvent.click(screen.getByText('Wróć do listy'));
    expect(onBackToList).toHaveBeenCalledTimes(1);
  });

  it('bez błędu renderuje dzieci normalnie (brak fałszywego boundary UI)', () => {
    render(
      <FinanceErrorBoundary documentLabel="Model OK" onRetry={vi.fn()} onBackToList={vi.fn()}>
        <div data-testid="normal-child">Wszystko gra</div>
      </FinanceErrorBoundary>
    );
    expect(screen.getByTestId('normal-child')).toBeInTheDocument();
    expect(screen.queryByTestId('finance-error-boundary')).not.toBeInTheDocument();
  });
});
