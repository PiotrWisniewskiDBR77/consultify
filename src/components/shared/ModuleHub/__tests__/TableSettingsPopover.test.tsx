/**
 * TableSettingsPopover smoke tests
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { type TableSettingsColumn, TableSettingsPopover } from '../TableSettingsPopover';

const columns: TableSettingsColumn[] = [
  { id: 'title', label: 'Title', required: true, visible: true },
  { id: 'status', label: 'Status', visible: true },
  { id: 'owner', label: 'Owner', visible: false },
];

describe('TableSettingsPopover', () => {
  it('is closed by default and opens on trigger click', async () => {
    const user = userEvent.setup();
    render(
      <TableSettingsPopover
        columns={columns}
        onToggle={vi.fn()}
        showDescription={false}
        onToggleDescription={vi.fn()}
      />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Table settings' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('toggles a non-required column and disables required ones', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(
      <TableSettingsPopover
        columns={columns}
        onToggle={onToggle}
        showDescription={false}
        onToggleDescription={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Table settings' }));

    const checkboxes = screen.getAllByRole('checkbox');
    // First checkbox is the required `title` column → disabled.
    expect(checkboxes[0]).toBeDisabled();

    // Owner column is currently hidden → toggling makes it visible.
    await user.click(screen.getByText('Owner'));
    expect(onToggle).toHaveBeenCalledWith('owner', true);
  });

  it('fires onToggleDescription from the description switch', async () => {
    const onToggleDescription = vi.fn();
    const user = userEvent.setup();
    render(
      <TableSettingsPopover
        columns={columns}
        onToggle={vi.fn()}
        showDescription={false}
        onToggleDescription={onToggleDescription}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Table settings' }));
    await user.click(screen.getByText('Show row description'));
    expect(onToggleDescription).toHaveBeenCalledWith(true);
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(
      <TableSettingsPopover
        columns={columns}
        onToggle={vi.fn()}
        showDescription={false}
        onToggleDescription={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Table settings' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
