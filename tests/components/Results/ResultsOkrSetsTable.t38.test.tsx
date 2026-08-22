/**
 * @vitest-environment jsdom
 *
 * T38 R15 — ResultsOkrSetsTable: populated/empty/error, row->preview
 * (<=140 words, whitelisted fields only, real key results as relations),
 * kebab/PPM parity (preview only, no fake assign/archive), no
 * selection/Menu3 bulk.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const apiGet = vi.fn();
vi.mock('@/services/api', () => ({
  Api: { get: (...a: unknown[]) => apiGet(...a) },
}));

import { ResultsOkrSetsTable } from '../../../src/components/Results/ResultsOkrSetsTable';

describe('T38 ResultsOkrSetsTable', () => {
  beforeEach(() => {
    apiGet.mockReset();
  });

  it('empty state preserves header/geometry', async () => {
    apiGet.mockResolvedValue({ objectives: [] });
    render(<ResultsOkrSetsTable />);
    expect(await screen.findByText('No OKR objectives yet')).toBeTruthy();
  });

  it('honest error state on fetch failure', async () => {
    apiGet.mockRejectedValue(new Error('boom'));
    render(<ResultsOkrSetsTable />);
    expect(await screen.findByText(/Failed to load OKR objectives/i)).toBeTruthy();
  });

  it('populated: real columns from Objective (label/rollupScore/keyResultCount), calls the real endpoint', async () => {
    apiGet.mockResolvedValue({
      objectives: [
        {
          id: 'o-1',
          label: 'Grow enterprise revenue',
          rollupScore: 62,
          keyResults: [{ id: 'kr-1', label: 'New logos', baseline: 0, target: 20, current: 12 }],
        },
      ],
    });
    render(<ResultsOkrSetsTable projectId="proj-1" />);
    expect(await screen.findByText('Grow enterprise revenue')).toBeTruthy();
    expect(screen.getByText('62%')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(apiGet).toHaveBeenCalledWith('/results-strategic/proj-1/okr');
  });

  it('row click -> factual preview <=140 words + real key results as relations, no raw object leak', async () => {
    apiGet.mockResolvedValue({
      objectives: [
        {
          id: 'o-1',
          label: 'Grow enterprise revenue',
          rollupScore: 62,
          keyResults: [{ id: 'kr-1', label: 'New logos', baseline: 0, target: 20, current: 12 }],
        },
      ],
    });
    render(<ResultsOkrSetsTable />);
    const row = await screen.findByText('Grow enterprise revenue');
    fireEvent.click(row);
    const details = await screen.findByText(/Objective: Grow enterprise revenue/);
    const text = details.textContent || '';
    expect(text.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(140);
    expect(text).not.toMatch(/\[object Object\]/);
    expect(await screen.findByText('New logos')).toBeTruthy();
    expect(screen.getByText('12/20')).toBeTruthy();
  });

  it('kebab exposes exactly Open preview — no assign/archive', async () => {
    apiGet.mockResolvedValue({
      objectives: [
        { id: 'o-1', label: 'Grow enterprise revenue', rollupScore: 62, keyResults: [] },
      ],
    });
    render(<ResultsOkrSetsTable />);
    await screen.findByText('Grow enterprise revenue');
    const kebabButtons = screen.getAllByRole('button', { name: /row actions/i });
    fireEvent.click(kebabButtons[0]);
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByText('Open preview')).toBeTruthy();
    expect(within(menu).queryByText(/assign/i)).toBeNull();
    expect(within(menu).queryByText(/^Archive$/i)).toBeNull();
  });

  it('no selection checkboxes rendered (selection: none, no Menu3 bulk)', async () => {
    apiGet.mockResolvedValue({
      objectives: [
        { id: 'o-1', label: 'Grow enterprise revenue', rollupScore: 62, keyResults: [] },
      ],
    });
    render(<ResultsOkrSetsTable />);
    await screen.findByText('Grow enterprise revenue');
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});
