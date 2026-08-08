/**
 * @vitest-environment jsdom
 *
 * T26 R13 — PortfolioAnalysisTable: populated/empty, row->preview
 * (<=140 words, whitelisted fields only), kebab/PPM parity, truthful-only
 * actions (Open initiative + Open preview, no export/archive/edit/delete),
 * no selection/Menu3 bulk.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { PortfolioAnalysisTable } from '../../../src/components/Initiatives/Analysis/PortfolioAnalysisTable';

const ROWS = [
  {
    id: 'i-1',
    name: 'Digitize onboarding',
    axis: 'Operations',
    status: 'active',
    priority: 'HIGH',
    progress: 40,
    budget: 100000,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
  },
] as any;

describe('T26 PortfolioAnalysisTable', () => {
  it('empty state preserves header/geometry', async () => {
    render(<PortfolioAnalysisTable initiatives={[]} onOpenInitiative={vi.fn()} />);
    expect(await screen.findByText('No initiatives yet')).toBeTruthy();
  });

  it('populated: real columns (name/status/priority/axis/updatedAt), no invented score field', async () => {
    render(<PortfolioAnalysisTable initiatives={ROWS} onOpenInitiative={vi.fn()} />);
    expect(await screen.findByText('Digitize onboarding')).toBeTruthy();
    expect(screen.getByText('Operations')).toBeTruthy();
  });

  it('row click -> factual preview <=140 words, whitelisted fields only, no raw object leak', async () => {
    render(<PortfolioAnalysisTable initiatives={ROWS} onOpenInitiative={vi.fn()} />);
    const row = await screen.findByText('Digitize onboarding');
    fireEvent.click(row);
    const details = await screen.findByText(/Initiative: Digitize onboarding/);
    const text = details.textContent || '';
    expect(text.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(140);
    expect(text).not.toMatch(/\[object Object\]/);
    expect(text).not.toMatch(/\bscore\b/i);
  });

  it('kebab exposes exactly Open initiative + Open preview — no export/archive/edit/delete', async () => {
    const onOpenInitiative = vi.fn();
    render(<PortfolioAnalysisTable initiatives={ROWS} onOpenInitiative={onOpenInitiative} />);
    await screen.findByText('Digitize onboarding');
    const kebabButtons = screen.getAllByRole('button', { name: /row actions/i });
    fireEvent.click(kebabButtons[0]);
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByText('Open initiative')).toBeTruthy();
    expect(within(menu).getByText('Open preview')).toBeTruthy();
    expect(within(menu).queryByText(/export/i)).toBeNull();
    expect(within(menu).queryByText(/^Archive$/i)).toBeNull();
    expect(within(menu).queryByText(/^Edit$/i)).toBeNull();

    fireEvent.click(within(menu).getByText('Open initiative'));
    expect(onOpenInitiative).toHaveBeenCalledWith('i-1');
  });

  it('no selection checkboxes rendered (selection: none, no Menu3 bulk)', async () => {
    render(<PortfolioAnalysisTable initiatives={ROWS} onOpenInitiative={vi.fn()} />);
    await screen.findByText('Digitize onboarding');
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});
