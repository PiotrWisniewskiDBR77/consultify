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

    // Level 4 in the fixture is the TARGET, not yet reached (not achieved, not
    // blocker, not review-required) — an unassessed cell, not a data-quality
    // problem, so its accessible name says so instead of "evidence missing".
    const unassessedCell = screen.getByLabelText(
      'DRD, Strategia i governance, poziom 4, nieosiągnięty, odpowiedź nierozstrzygnięte, jeszcze nieoceniony'
    );
    expect(unassessedCell).toBeInTheDocument();
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

  it('closing the side sheet with Escape works, same as the explicit close button', () => {
    render(<ControlledMatrix />);
    fireEvent.click(screen.getByLabelText(/poziom 2,/));
    expect(screen.getByTestId('matrix-side-sheet')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('matrix-side-sheet')).not.toBeInTheDocument();
  });

  it('shows a Current/Target/Gap summary per row, readable without counting cells', () => {
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
    // Fixture: achieved through level 2 (current), target flagged at level 4.
    const summary = screen.getByTestId('matrix-row-summary');
    expect(summary).toHaveTextContent('C 2');
    expect(summary).toHaveTextContent('T 4');
    expect(summary).toHaveTextContent('Δ 2');
  });
});

describe('LiveMatrix — an unassessed area never looks like a blocker or an evidence gap', () => {
  function rowWith(levels: Array<Record<string, unknown>>) {
    return makeMatrixRow({ levels: levels as never });
  }

  const cellBase = {
    unitId: 'unit-1',
    proposed: false,
    aiProposalPending: false,
  };

  it('an untouched, not-yet-reached cell gets a calm neutral border — no dashed/amber, no danger, regardless of the unit-level evidenceState', () => {
    const row = rowWith([
      { ...cellBase, level: 1, achieved: false, target: false, answerState: 'unresolved', evidenceState: 'missing', reviewRequired: false, blocker: false },
    ]);
    render(
      <LiveMatrix
        rows={[row]}
        levels={[1]}
        selection={null}
        onSelect={vi.fn()}
        onCloseSideSheet={vi.fn()}
        renderSideSheet={() => null}
        methodName="DRD"
      />
    );
    const cell = screen.getByTestId('matrix-cell');
    expect(cell.className).not.toMatch(/border-dashed/);
    expect(cell.className).not.toMatch(/border-c-warning/);
    expect(cell.className).not.toMatch(/border-c-danger/);
    expect(cell.className).toMatch(/border-c-border-subtle/);
  });

  it('a REAL blocker (the current frontier, work has started) is visually distinct from an untouched cell — border-c-danger', () => {
    const row = rowWith([
      { ...cellBase, level: 1, achieved: false, target: false, answerState: 'unresolved', evidenceState: 'missing', reviewRequired: false, blocker: true },
    ]);
    render(
      <LiveMatrix
        rows={[row]}
        levels={[1]}
        selection={null}
        onSelect={vi.fn()}
        onCloseSideSheet={vi.fn()}
        renderSideSheet={() => null}
        methodName="DRD"
      />
    );
    const cell = screen.getByTestId('matrix-cell');
    expect(cell.className).toMatch(/border-c-danger/);
  });

  it('a genuinely engaged evidence gap (achieved level, no evidence attached) is distinct from both the untouched cell and the blocker — dashed amber', () => {
    const row = rowWith([
      { ...cellBase, level: 1, achieved: true, target: false, answerState: 'confirmed', evidenceState: 'missing', reviewRequired: false, blocker: false },
    ]);
    render(
      <LiveMatrix
        rows={[row]}
        levels={[1]}
        selection={null}
        onSelect={vi.fn()}
        onCloseSideSheet={vi.fn()}
        renderSideSheet={() => null}
        methodName="DRD"
      />
    );
    const cell = screen.getByTestId('matrix-cell');
    expect(cell.className).toMatch(/border-dashed/);
    expect(cell.className).toMatch(/border-c-warning/);
    expect(cell.className).not.toMatch(/border-c-danger/);
  });

  it('the accessible name of an untouched cell never claims "brak dowodu" — it says it is simply not assessed yet', () => {
    const row = rowWith([
      { ...cellBase, level: 3, achieved: false, target: false, answerState: 'unresolved', evidenceState: 'missing', reviewRequired: false, blocker: false },
    ]);
    render(
      <LiveMatrix
        rows={[row]}
        levels={[3]}
        selection={null}
        onSelect={vi.fn()}
        onCloseSideSheet={vi.fn()}
        renderSideSheet={() => null}
        methodName="DRD"
      />
    );
    const cell = screen.getByTestId('matrix-cell');
    expect(cell.getAttribute('aria-label')).toMatch(/jeszcze nieoceniony/);
    expect(cell.getAttribute('aria-label')).not.toMatch(/evidence missing/);
  });
});
