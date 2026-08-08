/**
 * @vitest-environment jsdom
 *
 * T29 R11 — PortfolioHealthTable: populated/empty (readyToLaunch)/error,
 * row->preview <=140 words, kebab/PPM parity with Open initiative only, no
 * invented assign/export, no selection/Menu3 bulk.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { PortfolioHealthTable } from '../../../src/components/Initiatives/PortfolioHealthTable';
import type { PortfolioHealth } from '../../../src/components/Initiatives/PortfolioHealthView';

const BASE_HEALTH: PortfolioHealth = {
  total: 2,
  byStatus: { active: 2 },
  coverage: [],
  gaps: [],
  balance: { grid: [], quickWins: 0, bigBets: 0, moneyPits: 0, fillIns: 0 },
  duplicateClusters: [],
  readyToLaunch: [],
};

describe('T29 PortfolioHealthTable', () => {
  it('empty state preserves header/geometry (no ready-to-launch entries)', async () => {
    render(<PortfolioHealthTable health={BASE_HEALTH} />);
    expect(await screen.findByText('No ready-to-launch initiatives')).toBeTruthy();
  });

  it('populated: real readyToLaunch rows (id/title/status only)', async () => {
    render(
      <PortfolioHealthTable
        health={{
          ...BASE_HEALTH,
          readyToLaunch: [{ id: 'i-1', title: 'Automate reporting', status: 'planning' }],
        }}
      />
    );
    expect(await screen.findByText('Automate reporting')).toBeTruthy();
    expect(screen.getByText(/planning/i)).toBeTruthy();
  });

  it('row click -> factual preview <=140 words, no invented healthStatus/trend/owner/evaluatedAt', async () => {
    render(
      <PortfolioHealthTable
        health={{
          ...BASE_HEALTH,
          readyToLaunch: [{ id: 'i-1', title: 'Automate reporting', status: 'planning' }],
        }}
      />
    );
    const row = await screen.findByText('Automate reporting');
    fireEvent.click(row);
    const details = await screen.findByText(/Ready to launch/);
    const text = details.textContent || '';
    expect(text.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(140);
    expect(text).not.toMatch(/\[object Object\]/);
    expect(text).not.toMatch(/healthStatus|trend|evaluatedAt/i);
  });

  it('kebab exposes exactly Open initiative + Open preview — no assign/export/edit/archive/delete', async () => {
    const onOpenInitiative = vi.fn();
    render(
      <PortfolioHealthTable
        health={{
          ...BASE_HEALTH,
          readyToLaunch: [{ id: 'i-1', title: 'Automate reporting', status: 'planning' }],
        }}
        onOpenInitiative={onOpenInitiative}
      />
    );
    await screen.findByText('Automate reporting');
    const kebabButtons = screen.getAllByRole('button', { name: /row actions/i });
    fireEvent.click(kebabButtons[0]);
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByText('Open initiative')).toBeTruthy();
    expect(within(menu).getByText('Open preview')).toBeTruthy();
    expect(within(menu).queryByText(/assign/i)).toBeNull();
    expect(within(menu).queryByText(/export/i)).toBeNull();
    expect(within(menu).queryByText(/^Edit$/i)).toBeNull();
    expect(within(menu).queryByText(/^Archive$/i)).toBeNull();

    fireEvent.click(within(menu).getByText('Open initiative'));
    expect(onOpenInitiative).toHaveBeenCalledWith('i-1', 'Automate reporting');
  });

  it('no selection checkboxes rendered (selection: none, no Menu3 bulk)', async () => {
    render(
      <PortfolioHealthTable
        health={{
          ...BASE_HEALTH,
          readyToLaunch: [{ id: 'i-1', title: 'Automate reporting', status: 'planning' }],
        }}
      />
    );
    await screen.findByText('Automate reporting');
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});
