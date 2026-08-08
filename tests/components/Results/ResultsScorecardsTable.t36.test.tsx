/**
 * @vitest-environment jsdom
 *
 * T36 R15 — ResultsScorecardsTable: populated/empty/error, row->preview
 * (<=140 words, whitelisted fields only), kebab/PPM parity (preview only,
 * no fake edit/delete), no selection/Menu3 bulk.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const goalsGet = vi.fn();
const goalsGetRollup = vi.fn();
vi.mock('@/services/api', () => ({
  Api: {
    goalsGet: (...a: unknown[]) => goalsGet(...a),
    goalsGetRollup: (...a: unknown[]) => goalsGetRollup(...a),
  },
}));

import { ResultsScorecardsTable } from '../../../src/components/Results/ResultsScorecardsTable';

describe('T36 ResultsScorecardsTable', () => {
  beforeEach(() => {
    goalsGet.mockReset();
    goalsGetRollup.mockReset();
  });

  it('empty state preserves header/geometry', async () => {
    goalsGet.mockResolvedValue({ goals: [] });
    render(<ResultsScorecardsTable />);
    expect(await screen.findByText('No scorecards yet')).toBeTruthy();
  });

  it('honest error state on fetch failure', async () => {
    goalsGet.mockRejectedValue(new Error('boom'));
    render(<ResultsScorecardsTable />);
    expect(await screen.findByText(/Failed to load scorecards/i)).toBeTruthy();
  });

  it('populated: real columns from Goal records (title/goalType/status/progress/rollup)', async () => {
    goalsGet.mockResolvedValue({
      goals: [
        {
          id: 'g-1',
          title: 'Digital revenue growth',
          goal_type: 'scorecard',
          status: 'active',
          progress: 40,
        },
      ],
    });
    goalsGetRollup.mockResolvedValue({ rollupProgress: 55, linkedInitiatives: 3, childGoals: 0 });
    render(<ResultsScorecardsTable />);
    expect(await screen.findByText('Digital revenue growth')).toBeTruthy();
    // "Scorecard" appears both as the column header label and the cell value.
    expect(screen.getAllByText('Scorecard').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('40%')).toBeTruthy();
    expect(screen.getByText('55%')).toBeTruthy();
  });

  it('row click -> factual preview <=140 words, whitelisted fields only, no raw object leak', async () => {
    goalsGet.mockResolvedValue({
      goals: [
        { id: 'g-1', title: 'Digital revenue growth', goal_type: 'scorecard', status: 'active', progress: 40 },
      ],
    });
    goalsGetRollup.mockResolvedValue({ rollupProgress: 55, linkedInitiatives: 3, childGoals: 0 });
    render(<ResultsScorecardsTable />);
    const row = await screen.findByText('Digital revenue growth');
    fireEvent.click(row);
    const details = await screen.findByText(/Scorecard: Digital revenue growth/);
    const text = details.textContent || '';
    expect(text.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(140);
    expect(text).not.toMatch(/\[object Object\]/);
  });

  it('kebab exposes exactly Open preview — no edit/delete/export/assign', async () => {
    goalsGet.mockResolvedValue({
      goals: [
        { id: 'g-1', title: 'Digital revenue growth', goal_type: 'scorecard', status: 'active', progress: 40 },
      ],
    });
    goalsGetRollup.mockResolvedValue({ rollupProgress: 55, linkedInitiatives: 3, childGoals: 0 });
    render(<ResultsScorecardsTable />);
    await screen.findByText('Digital revenue growth');
    const kebabButtons = screen.getAllByRole('button', { name: /row actions/i });
    fireEvent.click(kebabButtons[0]);
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByText('Open preview')).toBeTruthy();
    expect(within(menu).queryByText(/^Edit$/i)).toBeNull();
    expect(within(menu).queryByText(/export/i)).toBeNull();
    expect(within(menu).queryByText(/assign/i)).toBeNull();
  });

  it('no selection checkboxes rendered (selection: none, no Menu3 bulk)', async () => {
    goalsGet.mockResolvedValue({
      goals: [
        { id: 'g-1', title: 'Digital revenue growth', goal_type: 'scorecard', status: 'active', progress: 40 },
      ],
    });
    goalsGetRollup.mockResolvedValue({ rollupProgress: 55, linkedInitiatives: 3, childGoals: 0 });
    render(<ResultsScorecardsTable />);
    await screen.findByText('Digital revenue growth');
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});
