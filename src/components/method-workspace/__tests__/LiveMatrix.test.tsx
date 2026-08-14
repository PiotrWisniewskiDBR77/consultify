/**
 * @vitest-environment jsdom
 *
 * UI-NAV §2.1/§3: clicking a cell opens the side sheet for that cell; the
 * selection is a controlled prop so a parent that keeps it across a re-render
 * demonstrates "wraca do tej samej macierzy, pozycji i zaznaczenia". Every
 * cell also needs a full accessible name and a textual state — never color
 * alone.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { LiveMatrix } from '../LiveMatrix';
import type { MatrixSelection } from '../types';
import { makeMatrixRow } from './fixtures';

function ControlledMatrix() {
  const [selection, setSelection] = useState<MatrixSelection | null>(null);
  return (
    <LiveMatrix
      rows={[makeMatrixRow()]}
      levels={[1, 2, 3, 4]}
      selection={selection}
      onSelect={setSelection}
      onCloseSideSheet={() => setSelection(null)}
      renderSideSheet={(sel) => <p>Pytania dla {sel.unitId} / poziom {sel.level}</p>}
      methodName="DRD"
    />
  );
}

describe('LiveMatrix', () => {
  it('every cell exposes a textual accessible name (method, unit, level, state, evidence) — not color alone', () => {
    render(
      <LiveMatrix
        rows={[makeMatrixRow()]}
        levels={[1, 2, 3, 4]}
        selection={null}
        onSelect={vi.fn()}
        onCloseSideSheet={vi.fn()}
        renderSideSheet={() => null}
        methodName="DRD"
      />
    );
    const cell = screen.getByLabelText(
      'DRD, Strategia i governance, poziom 2, osiągnięty, odpowiedź potwierdzone, dowód kompletny'
    );
    expect(cell).toBeInTheDocument();

    // ★ Komórka jeszcze nieoceniona mówi „jeszcze nieoceniony", a NIE „brak
    // dowodu" — to dwie różne rzeczy i czytnik ekranu musi je rozróżniać
    // tak samo jak wzrok.
    const notAssessedCell = screen.getByLabelText(
      'DRD, Strategia i governance, poziom 4, nieosiągnięty, odpowiedź nierozstrzygnięte, jeszcze nieoceniony'
    );
    expect(notAssessedCell).toBeInTheDocument();
  });

  it('nie maluje komórki nieocenionej tak samo jak komórki z luką dowodową', () => {
    render(
      <LiveMatrix
        rows={[
          makeMatrixRow({
            levels: [
              // oceniona, dowód słaby → realna luka (bursztyn, przerywana)
              {
                unitId: 'unit-1',
                level: 1,
                achieved: true,
                proposed: false,
                target: false,
                answerState: 'confirmed',
                evidenceState: 'weak',
                aiProposalPending: false,
                reviewRequired: false,
                blocker: false,
              },
              // jeszcze nieoceniona → neutralna, NIE alarm
              {
                unitId: 'unit-1',
                level: 2,
                achieved: false,
                proposed: false,
                target: false,
                answerState: 'unresolved',
                evidenceState: 'missing',
                aiProposalPending: false,
                reviewRequired: false,
                blocker: false,
              },
            ],
          }),
        ]}
        levels={[1, 2]}
        selection={null}
        onSelect={vi.fn()}
        onCloseSideSheet={vi.fn()}
        renderSideSheet={() => null}
        methodName="DRD"
      />
    );

    const weak = screen.getByLabelText(/poziom 1,.*dowód słaby/);
    const notAssessed = screen.getByLabelText(/poziom 2,.*jeszcze nieoceniony/);

    expect(weak.className).toContain('border-c-warning');
    expect(notAssessed.className).not.toContain('border-c-warning');
    expect(notAssessed.className).toContain('border-c-border-subtle');
    // najtwardsza asercja: klasy ramki NIE MOGĄ być identyczne
    expect(weak.className).not.toEqual(notAssessed.className);
  });

  it('każdy wiersz niesie odczyt doradczy stan→cel→luka, a nie samą siatkę', () => {
    render(
      <LiveMatrix
        rows={[makeMatrixRow()]}
        levels={[1, 2, 3, 4]}
        selection={null}
        onSelect={vi.fn()}
        onCloseSideSheet={vi.fn()}
        renderSideSheet={() => null}
        methodName="DRD"
      />
    );
    // fixture: osiągnięte L1-L2, cel L4 → bieżący L2, luka 2
    const readout = screen.getByTestId('matrix-row-readout');
    expect(readout).toHaveTextContent('L2');
    expect(readout).toHaveTextContent('L4');
    expect(readout).toHaveTextContent('luka 2');
  });

  it('wiersz bez ani jednej odpowiedzi mówi „Nieocenione", a nie „luka"', () => {
    render(
      <LiveMatrix
        rows={[
          makeMatrixRow({
            levels: [1, 2].map((level) => ({
              unitId: 'unit-1',
              level,
              achieved: false,
              proposed: false,
              target: level === 2,
              answerState: 'unresolved' as const,
              evidenceState: 'missing' as const,
              aiProposalPending: false,
              reviewRequired: false,
              blocker: false,
            })),
          }),
        ]}
        levels={[1, 2]}
        selection={null}
        onSelect={vi.fn()}
        onCloseSideSheet={vi.fn()}
        renderSideSheet={() => null}
        methodName="DRD"
      />
    );
    const readout = screen.getByTestId('matrix-row-readout');
    expect(readout).toHaveTextContent('Nieocenione');
    expect(readout).not.toHaveTextContent('luka');
  });

  it('clicking a cell opens the side sheet scoped to that cell', () => {
    render(<ControlledMatrix />);
    expect(screen.queryByTestId('matrix-side-sheet')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/poziom 3,/));
    const sheet = screen.getByTestId('matrix-side-sheet');
    expect(sheet).toBeInTheDocument();
    expect(sheet).toHaveTextContent('Pytania dla unit-1 / poziom 3');
  });

  it('closing and reopening from the same controlled state returns to the identical position/selection', () => {
    render(<ControlledMatrix />);
    fireEvent.click(screen.getByLabelText(/poziom 2,/));
    expect(screen.getByTestId('matrix-side-sheet')).toHaveTextContent('poziom 2');

    fireEvent.click(screen.getByLabelText('Zamknij szczegóły komórki'));
    expect(screen.queryByTestId('matrix-side-sheet')).not.toBeInTheDocument();

    // Re-selecting the same cell reproduces exactly the same sheet/position.
    fireEvent.click(screen.getByLabelText(/poziom 2,/));
    expect(screen.getByTestId('matrix-side-sheet')).toHaveTextContent('poziom 2');
  });
});
