/**
 * @vitest-environment jsdom
 *
 * AutomationsManager — manual run wiring, run-history view, enable/disable
 * toggle, and refresh-after-save behavior.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as TablePlatformApi from '@/services/api/tablePlatform.api';

import { AutomationsManager } from '../automations/AutomationsManager';

// ── External dependency mocks ────────────────────────────────────────────────

const toastError = vi.fn();
const toastSuccess = vi.fn();

vi.mock('react-hot-toast', () => ({
  default: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/services/api/tablePlatform.api', () => ({
  listAutomations: vi.fn(),
  toggleAutomation: vi.fn(),
  deleteAutomation: vi.fn(),
  runAutomationNow: vi.fn(),
  getAutomationRuns: vi.fn(),
  createAutomation: vi.fn(),
}));

const baseAutomation = {
  id: 'auto-1',
  baseId: 'base-1',
  tableId: 'table-1',
  name: 'Notify on create',
  description: '',
  enabled: true,
  triggerType: 'record_created',
  triggerConfig: {},
  actions: [{ id: 'act-1', actionOrder: 0, actionType: 'send_webhook', actionConfig: {} }],
};

describe('AutomationsManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (TablePlatformApi.listAutomations as any).mockResolvedValue([baseAutomation]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the automation list from the API', async () => {
    render(
      <AutomationsManager tableId="table-1" baseId="base-1" onClose={vi.fn()} />
    );

    expect(await screen.findByText('Notify on create')).toBeInTheDocument();
    expect(TablePlatformApi.listAutomations).toHaveBeenCalledWith('table-1');
  });

  it('shows an empty state and does not crash when the API call fails', async () => {
    (TablePlatformApi.listAutomations as any).mockRejectedValue(new Error('network down'));

    render(<AutomationsManager tableId="table-1" baseId="base-1" onClose={vi.fn()} />);

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(await screen.findByText(/no automations yet/i)).toBeInTheDocument();
  });

  it('runs the automation now via the menu and shows a success toast', async () => {
    (TablePlatformApi.runAutomationNow as any).mockResolvedValue({
      runId: 'auto-1',
      status: 'completed',
    });

    render(<AutomationsManager tableId="table-1" baseId="base-1" onClose={vi.fn()} />);

    await screen.findByText('Notify on create');

    // Open the row's actions menu, then click "Run now".
    const menuButtons = screen.getAllByRole('button');
    const moreBtn = menuButtons.find((b) => b.querySelector('svg.lucide-ellipsis'));
    fireEvent.click(moreBtn ?? menuButtons[menuButtons.length - 1]);

    const runNowBtn = await screen.findByText('Run now');
    fireEvent.click(runNowBtn);

    await waitFor(() =>
      expect(TablePlatformApi.runAutomationNow).toHaveBeenCalledWith('auto-1')
    );
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it('shows an error toast when manual run fails', async () => {
    (TablePlatformApi.runAutomationNow as any).mockRejectedValue(new Error('boom'));

    render(<AutomationsManager tableId="table-1" baseId="base-1" onClose={vi.fn()} />);

    await screen.findByText('Notify on create');

    const menuButtons = screen.getAllByRole('button');
    const moreBtn = menuButtons.find((b) => b.querySelector('svg.lucide-ellipsis'));
    fireEvent.click(moreBtn ?? menuButtons[menuButtons.length - 1]);

    const runNowBtn = await screen.findByText('Run now');
    fireEvent.click(runNowBtn);

    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });

  it('toggles enable/disable and reflects the new state', async () => {
    (TablePlatformApi.toggleAutomation as any).mockResolvedValue(undefined);

    render(<AutomationsManager tableId="table-1" baseId="base-1" onClose={vi.fn()} />);

    await screen.findByText('Notify on create');

    const toggle = screen.getByTitle('Disable');
    fireEvent.click(toggle);

    await waitFor(() =>
      expect(TablePlatformApi.toggleAutomation).toHaveBeenCalledWith('auto-1', false)
    );
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it('opens run history and renders statuses, timestamps, and errors', async () => {
    (TablePlatformApi.getAutomationRuns as any).mockResolvedValue([
      {
        id: 'run-1',
        automation_id: 'auto-1',
        trigger_record_id: 'rec-1',
        status: 'completed',
        started_at: '2026-07-01T10:00:00.000Z',
        completed_at: '2026-07-01T10:00:01.000Z',
        duration_ms: 120,
        error: null,
        action_results: [],
      },
      {
        id: 'run-2',
        automation_id: 'auto-1',
        trigger_record_id: null,
        status: 'failed',
        started_at: '2026-07-01T11:00:00.000Z',
        completed_at: '2026-07-01T11:00:00.500Z',
        duration_ms: 40,
        error: 'Webhook timed out',
        action_results: [],
      },
    ]);

    render(<AutomationsManager tableId="table-1" baseId="base-1" onClose={vi.fn()} />);

    await screen.findByText('Notify on create');

    const menuButtons = screen.getAllByRole('button');
    const moreBtn = menuButtons.find((b) => b.querySelector('svg.lucide-ellipsis'));
    fireEvent.click(moreBtn ?? menuButtons[menuButtons.length - 1]);

    const historyBtn = await screen.findByText('History');
    fireEvent.click(historyBtn);

    await waitFor(() =>
      expect(TablePlatformApi.getAutomationRuns).toHaveBeenCalledWith('auto-1', 50)
    );

    expect(await screen.findByText('Success')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Webhook timed out')).toBeInTheDocument();
    expect(screen.getByText('120ms')).toBeInTheDocument();
  });

  it('shows an error message, not a crash, when history fetch fails', async () => {
    (TablePlatformApi.getAutomationRuns as any).mockRejectedValue(new Error('history down'));

    render(<AutomationsManager tableId="table-1" baseId="base-1" onClose={vi.fn()} />);

    await screen.findByText('Notify on create');

    const menuButtons = screen.getAllByRole('button');
    const moreBtn = menuButtons.find((b) => b.querySelector('svg.lucide-ellipsis'));
    fireEvent.click(moreBtn ?? menuButtons[menuButtons.length - 1]);

    const historyBtn = await screen.findByText('History');
    fireEvent.click(historyBtn);

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(await screen.findByText(/no run history yet/i)).toBeInTheDocument();
  });

  it('refreshes the list after creating a new automation in the builder', async () => {
    (TablePlatformApi.createAutomation as any).mockResolvedValue({ id: 'auto-2' });
    (TablePlatformApi.listAutomations as any)
      .mockResolvedValueOnce([baseAutomation])
      .mockResolvedValueOnce([
        baseAutomation,
        { ...baseAutomation, id: 'auto-2', name: 'Second automation' },
      ]);

    render(<AutomationsManager tableId="table-1" baseId="base-1" onClose={vi.fn()} />);

    await screen.findByText('Notify on create');

    fireEvent.click(screen.getByRole('button', { name: /new/i }));

    const nameInput = await screen.findByPlaceholderText(/automation name/i);
    fireEvent.change(nameInput, { target: { value: 'Second automation' } });

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(TablePlatformApi.createAutomation).toHaveBeenCalled());
    // listAutomations called once on mount, once again after save.
    await waitFor(() => expect(TablePlatformApi.listAutomations).toHaveBeenCalledTimes(2));
  });
});
