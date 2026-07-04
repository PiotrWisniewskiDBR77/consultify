/**
 * @vitest-environment jsdom
 *
 * views/GalleryView — sort and filter controls (tp-views-finish task 4).
 *
 * Reuses the same filter utility (`filterEval.evaluateFilterRule`) and the same
 * `FilterPanel` builder component as the Grid view, plus a lightweight sort
 * select/direction toggle. No new design — same tokens/controls as elsewhere
 * in the table platform.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { GalleryView } from '../views/GalleryView';
import type { ColumnDef, TableNode } from '../tableTypes';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
}));

const columns: ColumnDef[] = [
  { key: 'label', header: 'Name', type: 'text', visible: true, width: 160 },
  { key: 'status', header: 'Status', type: 'status', visible: true, width: 120, options: ['Todo', 'Done'] },
  { key: 'score', header: 'Score', type: 'number', visible: true, width: 100 },
];

function node(id: string, data: Record<string, unknown>): TableNode {
  return { id, type: 'idea', data, position: { x: 0, y: 0 } };
}

const records = [
  node('n1', { label: 'Charlie', status: 'Todo', score: 3 }),
  node('n2', { label: 'Alpha', status: 'Done', score: 1 }),
  node('n3', { label: 'Bravo', status: 'Todo', score: 2 }),
];

function renderGallery() {
  return render(
    <GalleryView
      records={records}
      columns={columns}
      visibleFieldIds={['status', 'score']}
      cardSize="medium"
      onRecordClick={vi.fn()}
    />
  );
}

describe('GalleryView — sort', () => {
  it('sorts cards alphabetically by label ascending/descending', () => {
    renderGallery();
    const sortSelect = screen.getByDisplayValue('None');
    fireEvent.change(sortSelect, { target: { value: 'label' } });

    const cardsContainer = screen.getByText('Charlie').closest('.grid')!;
    let names = within(cardsContainer as HTMLElement)
      .getAllByText(/Alpha|Bravo|Charlie/)
      .map((el) => el.textContent);
    expect(names).toEqual(['Alpha', 'Bravo', 'Charlie']);

    // toggle direction (button title reflects current direction; asc → click flips to desc)
    fireEvent.click(screen.getByTitle('Ascending'));
    names = within(cardsContainer as HTMLElement)
      .getAllByText(/Alpha|Bravo|Charlie/)
      .map((el) => el.textContent);
    expect(names).toEqual(['Charlie', 'Bravo', 'Alpha']);
  });

  it('sorts numerically when the sort field is numeric', () => {
    renderGallery();
    const sortSelect = screen.getByDisplayValue('None');
    fireEvent.change(sortSelect, { target: { value: 'score' } });

    const cardsContainer = screen.getByText('Charlie').closest('.grid')!;
    const names = within(cardsContainer as HTMLElement)
      .getAllByText(/Alpha|Bravo|Charlie/)
      .map((el) => el.textContent);
    // score asc: Alpha(1), Bravo(2), Charlie(3)
    expect(names).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });
});

describe('GalleryView — filter', () => {
  it('opens the shared FilterPanel and filters cards using evaluateFilterRule', () => {
    renderGallery();
    fireEvent.click(screen.getByText('Filter'));
    fireEvent.click(screen.getByText('Add filter'));

    // rule 1: column select defaults to first column (label); switch to status
    const columnSelect = screen.getAllByRole('combobox').find((el) =>
      within(el as HTMLElement)
        .queryAllByRole('option')
        .some((o) => o.textContent === 'Status')
    )!;
    fireEvent.change(columnSelect, { target: { value: 'status' } });

    const operatorSelect = screen.getAllByRole('combobox').find((el) =>
      within(el as HTMLElement)
        .queryAllByRole('option')
        .some((o) => o.textContent === 'Equals')
    )!;
    fireEvent.change(operatorSelect, { target: { value: 'equals' } });

    const valueInput = screen.getByPlaceholderText('...');
    fireEvent.change(valueInput, { target: { value: 'Done' } });

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Charlie')).not.toBeInTheDocument();
    expect(screen.queryByText('Bravo')).not.toBeInTheDocument();
  });

  it('shows an empty-results message when the filter matches nothing', () => {
    renderGallery();
    fireEvent.click(screen.getByText('Filter'));
    fireEvent.click(screen.getByText('Add filter'));

    const columnSelect = screen.getAllByRole('combobox').find((el) =>
      within(el as HTMLElement)
        .queryAllByRole('option')
        .some((o) => o.textContent === 'Status')
    )!;
    fireEvent.change(columnSelect, { target: { value: 'status' } });
    const operatorSelect = screen.getAllByRole('combobox').find((el) =>
      within(el as HTMLElement)
        .queryAllByRole('option')
        .some((o) => o.textContent === 'Equals')
    )!;
    fireEvent.change(operatorSelect, { target: { value: 'equals' } });
    fireEvent.change(screen.getByPlaceholderText('...'), { target: { value: 'Archived' } });

    expect(screen.getByText('No results for these filters')).toBeInTheDocument();
  });
});
