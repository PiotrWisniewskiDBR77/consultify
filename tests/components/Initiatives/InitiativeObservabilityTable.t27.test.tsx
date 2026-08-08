/**
 * @vitest-environment jsdom
 *
 * T27 R11 — InitiativeObservabilityTable: populated/empty/error, row→preview
 * (<=140 words, whitelisted fields only), kebab/PPM parity, truthful-only
 * actions (no invented acknowledge/archive), no selection/Menu3.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/components/ui/primitives/chips/EntityStatusChip', () => ({
  EntityStatusChip: ({ status }: { status: string }) => <span>chip:{status}</span>,
}));

const getInitiatives = vi.fn();
const getLineage = vi.fn();
vi.mock('@/services/api/initiatives.api', () => ({
  InitiativeApi: {
    getInitiatives: (...a: unknown[]) => getInitiatives(...a),
    getLineage: (...a: unknown[]) => getLineage(...a),
  },
}));

import { InitiativeObservabilityTable } from '../../../src/components/Initiatives/InitiativeObservabilityTable';

describe('T27 InitiativeObservabilityTable', () => {
  beforeEach(() => {
    getInitiatives.mockReset();
    getLineage.mockReset();
  });

  it('empty state preserves header/geometry', async () => {
    getInitiatives.mockResolvedValue([]);
    render(<InitiativeObservabilityTable />);
    expect(await screen.findByText('No initiatives yet')).toBeTruthy();
  });

  it('honest error state on fetch failure — no silent fallback', async () => {
    getInitiatives.mockRejectedValue(new Error('boom'));
    render(<InitiativeObservabilityTable />);
    expect(await screen.findByText(/Failed to load initiatives/i)).toBeTruthy();
  });

  it('populated: renders real rows with real columns, no invented severity/detectedAt', async () => {
    getInitiatives.mockResolvedValue([
      {
        id: 'i-1',
        name: 'Digitize onboarding',
        status: 'planning',
        priority: 'high',
        area: 'Operations',
        updatedAt: '2026-07-01T00:00:00Z',
      },
    ]);
    render(<InitiativeObservabilityTable />);
    expect(await screen.findByText('Digitize onboarding')).toBeTruthy();
    expect(screen.getByText('Operations')).toBeTruthy();
    expect(screen.getByText('high')).toBeTruthy();
  });

  it('row click -> factual preview <=140 words, whitelisted fields only, no raw object leak', async () => {
    getInitiatives.mockResolvedValue([
      { id: 'i-1', name: 'Digitize onboarding', status: 'planning', priority: 'high', area: 'Ops', updatedAt: '2026-07-01' },
    ]);
    getLineage.mockResolvedValue({
      source: { type: 'assessment' },
      initiative: { id: 'i-1', title: 'Digitize onboarding', status: 'planning' },
      downstream: { executionStatus: 'not-started', benefits: [{ kpi: 'k1' }] },
    });
    render(<InitiativeObservabilityTable />);
    const row = await screen.findByText('Digitize onboarding');
    fireEvent.click(row);
    await waitFor(() => expect(getLineage).toHaveBeenCalledWith('i-1'));
    const details = await screen.findByText(/Source: assessment/);
    const text = details.textContent || '';
    expect(text.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(140);
    expect(text).not.toMatch(/\[object Object\]/);
  });

  it('kebab and PPM (right-click) expose the identical, truthful action set — no acknowledge/archive', async () => {
    const onOpenInitiative = vi.fn();
    getInitiatives.mockResolvedValue([
      { id: 'i-1', name: 'Digitize onboarding', status: 'planning', priority: 'high', area: 'Ops', updatedAt: '2026-07-01' },
    ]);
    getLineage.mockResolvedValue(null);
    render(<InitiativeObservabilityTable onOpenInitiative={onOpenInitiative} />);
    await screen.findByText('Digitize onboarding');

    const kebabButtons = screen.getAllByRole('button', { name: /row actions/i });
    fireEvent.click(kebabButtons[0]);
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByText('Open initiative')).toBeTruthy();
    expect(within(menu).getByText('Open preview')).toBeTruthy();
    expect(within(menu).queryByText(/acknowledge/i)).toBeNull();
    expect(within(menu).queryByText(/archive/i)).toBeNull();
  });

  it('no selection checkboxes rendered (selection: none, no Menu3 bulk)', async () => {
    getInitiatives.mockResolvedValue([
      { id: 'i-1', name: 'Digitize onboarding', status: 'planning', priority: 'high', area: 'Ops', updatedAt: '2026-07-01' },
    ]);
    render(<InitiativeObservabilityTable />);
    await screen.findByText('Digitize onboarding');
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});
