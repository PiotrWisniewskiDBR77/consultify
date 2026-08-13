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
      'DRD, Strategia i governance, poziom 2, osiągnięty, odpowiedź potwierdzone, evidence complete'
    );
    expect(cell).toBeInTheDocument();

    const missingCell = screen.getByLabelText(
      'DRD, Strategia i governance, poziom 4, nieosiągnięty, odpowiedź nierozstrzygnięte, evidence missing'
    );
    expect(missingCell).toBeInTheDocument();
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
