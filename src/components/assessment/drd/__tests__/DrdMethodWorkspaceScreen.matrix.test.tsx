/**
 * @vitest-environment jsdom
 *
 * A6 vertical slice — checkpoint test requirement 10: "macierz: skale per
 * oś (1A=1..7, 7A=1..5); klik komórki -> powrót zachowuje pozycję".
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { DRD_STRUCTURE } from '@/services/drdStructure';
import { DrdMethodWorkspaceScreen } from '../DrdMethodWorkspaceScreen';

function makeMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

describe('DRD structure — per-axis level scale is genuinely non-uniform (precondition for the UI test)', () => {
  it('axis 1 (area 1A) runs 1..7, axis 7 (area 7A) runs 1..5', () => {
    const axis1 = DRD_STRUCTURE.find((a) => a.id === 1)!;
    const axis7 = DRD_STRUCTURE.find((a) => a.id === 7)!;
    expect(axis1.areas[0].levels.map((l) => l.level)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(axis7.areas[0].levels.map((l) => l.level)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('DrdMethodWorkspaceScreen — Matrix: per-axis scale, not a global one', () => {
  it('axis 1 renders 7 level columns (L1..L7); switching to axis 7 renders 5 (L1..L5)', () => {
    const storage = makeMemoryStorage();
    render(<DrdMethodWorkspaceScreen storage={storage} seedTo="matrix" initialViewMode="matrix" />);

    expect(screen.getByText('L7')).toBeInTheDocument();
    expect(screen.queryByText('L8')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('axis-tab-7'));

    expect(screen.getByText('L5')).toBeInTheDocument();
    expect(screen.queryByText('L6')).not.toBeInTheDocument();
    expect(screen.queryByText('L7')).not.toBeInTheDocument();
  });

  it('selecting a matrix cell, switching to Interview, then back to Matrix preserves the selected cell (no forked/reset state)', () => {
    const storage = makeMemoryStorage();
    render(<DrdMethodWorkspaceScreen storage={storage} seedTo="matrix" initialViewMode="matrix" />);

    // Select level 2 of the first row (Procesy Sprzedaży / 1A).
    const cells = screen.getAllByTestId('matrix-cell').filter((el) => el.getAttribute('data-unit-id') === '1A');
    const level2Cell = cells.find((el) => el.getAttribute('data-level') === '2')!;
    fireEvent.click(level2Cell);

    expect(within(screen.getByTestId('matrix-side-sheet')).getAllByText(/poziom 2/i).length).toBeGreaterThan(0);

    // Switch to Interview view.
    fireEvent.click(screen.getByTestId('view-mode-interview'));
    expect(screen.queryByTestId('matrix-side-sheet')).not.toBeInTheDocument();

    // Back to Matrix — same selection, same side sheet content, no reset.
    fireEvent.click(screen.getByTestId('view-mode-matrix'));
    expect(screen.getByTestId('matrix-side-sheet')).toBeInTheDocument();
    expect(within(screen.getByTestId('matrix-side-sheet')).getAllByText(/1A · poziom 2/).length).toBeGreaterThan(0);
  });
});
