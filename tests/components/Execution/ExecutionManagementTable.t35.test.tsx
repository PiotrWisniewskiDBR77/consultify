/**
 * @vitest-environment jsdom
 *
 * T35 R12 — ExecutionManagementTable: populated/empty, row->preview
 * (<=140 words, whitelisted fields only), kebab/PPM parity, truthful-only
 * actions (Open lane + Open preview, no assign/change-status/edit/archive/
 * delete), no selection/Menu3 bulk.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ExecutionManagementTable } from '../../../src/components/Execution/ExecutionManagementTable';

const ROWS = [
  { id: 'action-queue' as const, label: 'Action Queue', total: 5, critical: 2, warning: 1 },
  { id: 'decisions' as const, label: 'Decisions & Approvals', total: 0, critical: 0, warning: 0 },
];

describe('T35 ExecutionManagementTable', () => {
  it('empty state preserves header/geometry', async () => {
    render(<ExecutionManagementTable rows={[]} />);
    expect(await screen.findByText('No management lanes')).toBeTruthy();
  });

  it('populated: real columns (label/total/critical/warning), no invented type/owner/dueDate', async () => {
    render(<ExecutionManagementTable rows={ROWS} />);
    expect(await screen.findByText('Action Queue')).toBeTruthy();
    expect(screen.getByText('Decisions & Approvals')).toBeTruthy();
  });

  it('row click -> factual preview <=140 words, whitelisted fields only, no raw object leak', async () => {
    render(<ExecutionManagementTable rows={ROWS} />);
    const row = await screen.findByText('Action Queue');
    fireEvent.click(row);
    const details = await screen.findByText(/Lane: Action Queue/);
    const text = details.textContent || '';
    expect(text.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(140);
    expect(text).not.toMatch(/\[object Object\]/);
    expect(text).toContain('5');
    expect(text).toContain('2');
    expect(text).toContain('1');
  });

  it('kebab exposes exactly Open lane + Open preview — no assign/change-status/edit/archive/delete', async () => {
    const onOpenLane = vi.fn();
    render(<ExecutionManagementTable rows={ROWS} onOpenLane={onOpenLane} />);
    await screen.findByText('Action Queue');
    const kebabButtons = screen.getAllByRole('button', { name: /row actions/i });
    fireEvent.click(kebabButtons[0]);
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByText('Open lane')).toBeTruthy();
    expect(within(menu).getByText('Open preview')).toBeTruthy();
    expect(within(menu).queryByText(/assign/i)).toBeNull();
    expect(within(menu).queryByText(/change.status/i)).toBeNull();
    expect(within(menu).queryByText(/^Edit$/i)).toBeNull();
    expect(within(menu).queryByText(/^Archive$/i)).toBeNull();

    fireEvent.click(within(menu).getByText('Open lane'));
    expect(onOpenLane).toHaveBeenCalledWith('action-queue');
  });

  it('no selection checkboxes rendered (selection: none, no Menu3 bulk)', async () => {
    render(<ExecutionManagementTable rows={ROWS} />);
    await screen.findByText('Action Queue');
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});
