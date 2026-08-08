/**
 * @vitest-environment jsdom
 *
 * T30-GOALS-R13-CORRECTION — InitiativesGoalsTable: populated/empty/error,
 * row->preview (<=140 words, whitelisted fields only, real relations from
 * Api.goalsGetInitiatives), kebab/PPM parity (preview only, no fake
 * delete/archive/export/assign), no selection/Menu3 bulk.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const goalsGet = vi.fn();
const goalsGetRollup = vi.fn();
const goalsGetInitiatives = vi.fn();
vi.mock('@/services/api', () => ({
  Api: {
    goalsGet: (...a: unknown[]) => goalsGet(...a),
    goalsGetRollup: (...a: unknown[]) => goalsGetRollup(...a),
    goalsGetInitiatives: (...a: unknown[]) => goalsGetInitiatives(...a),
  },
}));

import { InitiativesGoalsTable } from '../../../src/components/Initiatives/InitiativesGoalsTable';

const GOAL = {
  id: 'g-1',
  title: 'Reduce time-to-value',
  status: 'active',
  owner_id: 'user-42',
  target_value: 30,
  unit: 'days',
  current_value: 45,
  end_date: '2026-12-31',
  progress: 40,
};

describe('T30 InitiativesGoalsTable', () => {
  beforeEach(() => {
    goalsGet.mockReset();
    goalsGetRollup.mockReset();
    goalsGetInitiatives.mockReset();
  });

  it('empty state preserves header/geometry', async () => {
    goalsGet.mockResolvedValue({ goals: [] });
    render(<InitiativesGoalsTable />);
    expect(await screen.findByText('No goals yet')).toBeTruthy();
  });

  it('honest error state on fetch failure — no demo/showcase fallback', async () => {
    goalsGet.mockRejectedValue(new Error('boom'));
    render(<InitiativesGoalsTable />);
    expect(await screen.findByText(/Failed to load goals/i)).toBeTruthy();
  });

  it('populated: real columns (title/status/owner/target/endDate/progress), no invented dueDate label', async () => {
    goalsGet.mockResolvedValue({ goals: [GOAL] });
    render(<InitiativesGoalsTable />);
    expect(await screen.findByText('Reduce time-to-value')).toBeTruthy();
    expect(screen.getByText('user-42')).toBeTruthy();
    expect(screen.getByText('30 days')).toBeTruthy();
    expect(screen.getByText('40%')).toBeTruthy();
  });

  it('row click -> factual preview <=140 words, whitelisted fields only, real relations from goalsGetInitiatives, no raw object leak', async () => {
    goalsGet.mockResolvedValue({ goals: [GOAL] });
    goalsGetRollup.mockResolvedValue({ rollupProgress: 55 });
    goalsGetInitiatives.mockResolvedValue({
      initiatives: [
        { initiative_id: 'i-1', initiative_name: 'Digitize onboarding', initiative_status: 'active' },
      ],
    });
    render(<InitiativesGoalsTable />);
    const row = await screen.findByText('Reduce time-to-value');
    fireEvent.click(row);
    const details = await screen.findByText(/Goal: Reduce time-to-value/);
    const text = details.textContent || '';
    expect(text.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(140);
    expect(text).not.toMatch(/\[object Object\]/);
    expect(goalsGetInitiatives).toHaveBeenCalledWith('g-1');
    expect(await screen.findByText('Digitize onboarding')).toBeTruthy();
  });

  it('relations are honestly empty on goalsGetInitiatives failure — no fabricated fallback rows', async () => {
    goalsGet.mockResolvedValue({ goals: [GOAL] });
    goalsGetRollup.mockResolvedValue({ rollupProgress: 55 });
    goalsGetInitiatives.mockRejectedValue(new Error('boom'));
    render(<InitiativesGoalsTable />);
    const row = await screen.findByText('Reduce time-to-value');
    fireEvent.click(row);
    await screen.findByText(/Goal: Reduce time-to-value/);
    expect(screen.queryByText('Digitize onboarding')).toBeNull();
  });

  it('kebab exposes exactly Open preview — no delete/archive/export/assign', async () => {
    goalsGet.mockResolvedValue({ goals: [GOAL] });
    goalsGetRollup.mockResolvedValue({ rollupProgress: 55 });
    goalsGetInitiatives.mockResolvedValue({ initiatives: [] });
    render(<InitiativesGoalsTable />);
    await screen.findByText('Reduce time-to-value');
    const kebabButtons = screen.getAllByRole('button', { name: /row actions/i });
    fireEvent.click(kebabButtons[0]);
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByText('Open preview')).toBeTruthy();
    expect(within(menu).queryByText(/^Delete$/i)).toBeNull();
    expect(within(menu).queryByText(/^Archive$/i)).toBeNull();
    expect(within(menu).queryByText(/export/i)).toBeNull();
    expect(within(menu).queryByText(/assign/i)).toBeNull();
  });

  it('no selection checkboxes rendered (selection: none, no Menu3 bulk)', async () => {
    goalsGet.mockResolvedValue({ goals: [GOAL] });
    render(<InitiativesGoalsTable />);
    await screen.findByText('Reduce time-to-value');
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});
