/** @vitest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  agentOperationLabel,
  AgentOperationsPanel,
} from '../../../src/components/AIChat/AgentOperationsPanel';

const snapshotMock = vi.fn();
const recoverMock = vi.fn();
const getSettingsMock = vi.fn();
const updateSettingsMock = vi.fn();
const activateMock = vi.fn();
vi.mock('@/services/api', () => ({
  Api: {
    getAgentRunOperationalSnapshot: (...args: unknown[]) => snapshotMock(...args),
    recoverAgentRunTarget: (...args: unknown[]) => recoverMock(...args),
    getAgentTenantSettings: (...args: unknown[]) => getSettingsMock(...args),
    updateAgentTenantSettings: (...args: unknown[]) => updateSettingsMock(...args),
    activateA06ForTenant: (...args: unknown[]) => activateMock(...args),
  },
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue || _key,
  }),
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

describe('AgentOperationsPanel', () => {
  it('localizes known operational keys and keeps unknown keys readable', () => {
    expect(agentOperationLabel('branchesFailed', true)).toBe('Nieudane gałęzie');
    expect(agentOperationLabel('EXPIRED_BRANCH_LEASE', false)).toBe('Branch lease expired');
    expect(agentOperationLabel('new_runtime_metric', false)).toBe('New runtime metric');
  });
  beforeEach(() => {
    vi.clearAllMocks();
    snapshotMock.mockResolvedValue({
      data: {
        correlationId: 'run-1',
        run: { state: 'applying', goal: 'Transformation' },
        metrics: { branchesFailed: 1, toolInvocationsDenied: 2 },
        recoveries: [],
        alerts: [
          {
            severity: 'critical',
            code: 'EXPIRED_BRANCH_LEASE',
            targetId: 'branch-1',
            safeAction: 'recover_expired_lease',
          },
        ],
      },
    });
    recoverMock.mockResolvedValue({ data: { recoveryId: 'recovery-1', status: 'pending' } });
    getSettingsMock.mockResolvedValue({
      data: {
        version: 0,
        in_app_enabled: true,
        email_enabled: false,
        calendar_enabled: false,
        cadence: 'manual',
        timezone: 'Europe/Warsaw',
        legal_hold: false,
        export_enabled: false,
        purge_enabled: false,
      },
    });
    updateSettingsMock.mockResolvedValue({
      data: {
        version: 1,
        in_app_enabled: true,
        email_enabled: true,
        calendar_enabled: false,
        cadence: 'weekly',
        timezone: 'Europe/Warsaw',
        legal_hold: false,
        export_enabled: false,
        purge_enabled: false,
      },
    });
    activateMock.mockResolvedValue({ data: { receipt_id: 'receipt-1', policy_count: 17 } });
  });

  it('loads one correlated operational snapshot with metrics and alerts', async () => {
    render(<AgentOperationsPanel />);
    fireEvent.change(screen.getByLabelText('Canonical run ID'), { target: { value: 'run-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Diagnose' }));
    expect(await screen.findByText('Transformation')).toBeInTheDocument();
    expect(screen.getByText('Branch lease expired')).toBeInTheDocument();
    expect(screen.getByText('Failed branches')).toBeInTheDocument();
    expect(snapshotMock).toHaveBeenCalledWith('run-1');
  });

  it('executes only the safe action advertised by diagnostics and requires a reason', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Worker died and lease expired.');
    render(<AgentOperationsPanel />);
    fireEvent.change(screen.getByLabelText('Canonical run ID'), { target: { value: 'run-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Diagnose' }));
    fireEvent.click(await screen.findByRole('button', { name: /Safe recovery/ }));
    await waitFor(() =>
      expect(recoverMock).toHaveBeenCalledWith(
        'run-1',
        {
          targetId: 'branch-1',
          action: 'recover_expired_lease',
          reason: 'Worker died and lease expired.',
        },
        expect.any(String)
      )
    );
  });

  it('renders a persistent recoverable error and retries without losing the canonical Run', async () => {
    snapshotMock.mockRejectedValueOnce(new Error('operator service unavailable'));
    render(<AgentOperationsPanel initialCanonicalRunId="run-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Diagnose' }));
    expect(await screen.findByText('Failed to load operations')).toBeInTheDocument();
    expect(screen.getByText('operator service unavailable')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Transformation')).toBeInTheDocument();
    expect(snapshotMock).toHaveBeenLastCalledWith('run-1');
  });

  it('fails closed on forbidden diagnostics and offers a local context recovery', async () => {
    snapshotMock.mockRejectedValueOnce(
      Object.assign(new Error('forbidden'), { response: { status: 403 } })
    );
    render(<AgentOperationsPanel initialCanonicalRunId="foreign-run" />);

    const panel = screen.getByTestId('agent-operations-panel');
    expect(panel).toHaveAttribute('aria-busy', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Diagnose' }));
    expect(await screen.findByText('Run diagnostics access denied')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear Run' }));
    expect(screen.getByLabelText('Canonical run ID')).toHaveValue('');
    expect(screen.getByText('Enter a canonical Run to diagnose')).toBeInTheDocument();
  });

  it('uses semantic responsive layout and exposes atomic live progress', () => {
    render(<AgentOperationsPanel />);
    const panel = screen.getByTestId('agent-operations-panel');
    const live = panel.querySelector('.sr-only[role="status"]');
    expect(live).toHaveAttribute('aria-atomic', 'true');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByLabelText('Canonical run ID').closest('form')?.className).toContain(
      'sm:flex-row'
    );
    expect(panel.innerHTML).toContain('border-c-border');
    expect(panel.innerHTML).toContain('bg-c-surface');
  });

  it('shows safe admin defaults, saves explicit settings and activates exactly through the admin API', async () => {
    render(<AgentOperationsPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Load' }));
    expect(await screen.findByText(/Auto-actions: OFF/)).toBeInTheDocument();
    expect(screen.getByText(/30 days detail, 13 months aggregate/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Email'));
    fireEvent.change(screen.getByLabelText('Automation cadence'), { target: { value: 'weekly' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() =>
      expect(updateSettingsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedVersion: 0,
          emailEnabled: true,
          cadence: 'weekly',
          autoActions: {},
        })
      )
    );
    fireEvent.click(screen.getByRole('button', { name: 'Activate Agent' }));
    await waitFor(() => expect(activateMock).toHaveBeenCalledWith(null, expect.any(String)));
  });
});
