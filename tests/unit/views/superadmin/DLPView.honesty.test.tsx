import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import DLPView from '@/views/superadmin/iam/DLPView';

vi.mock('@/services/api', () => ({
  Api: {
    getDLPPolicies: vi.fn(),
    getDLPViolations: vi.fn(),
    getDLPStats: vi.fn(),
    createDLPPolicy: vi.fn(),
    toggleDLPPolicy: vi.fn(),
    deleteDLPPolicy: vi.fn(),
    resolveDLPViolation: vi.fn(),
  },
}));

const dlpStats = {
  policies: {
    total: 0,
    active: 0,
  },
  violations: {
    total: 0,
    unresolved: 0,
    bySeverity: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    },
  },
};

const policy = {
  id: 'policy-1',
  name: 'PII Guard',
  description: 'Protect PII',
  policyType: 'pii_detection',
  rules: [],
  enforcementAction: 'warn',
  isActive: true,
  createdBy: 'admin-1',
  createdByEmail: 'admin@example.com',
  createdAt: '2026-04-26T00:00:00.000Z',
  updatedAt: '2026-04-26T00:00:00.000Z',
};

const violation = {
  id: 'violation-1',
  policyId: 'policy-1',
  policyName: 'PII Guard',
  policyType: 'pii_detection',
  resourceType: 'document',
  resourceId: 'doc-1',
  violationType: 'email',
  severity: 'HIGH',
  detectedAt: 'not-a-date',
  resolvedAt: null,
  resolvedBy: null,
  resolvedByEmail: null,
};

describe('DLPView honest UI', () => {
  const openRowActions = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Row actions' }));
  };

  const chooseRowAction = (name: string) => {
    openRowActions();
    fireEvent.click(screen.getByRole('menuitem', { name }));
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true)
    );
    vi.mocked(Api.getDLPPolicies).mockRejectedValue(new Error('DLP backend down'));
    vi.mocked(Api.getDLPViolations).mockResolvedValue([]);
    vi.mocked(Api.getDLPStats).mockResolvedValue(dlpStats);
    vi.mocked(Api.createDLPPolicy).mockResolvedValue({ id: 'policy-1' });
    vi.mocked(Api.toggleDLPPolicy).mockResolvedValue({ success: true });
    vi.mocked(Api.deleteDLPPolicy).mockResolvedValue({ success: true });
    vi.mocked(Api.resolveDLPViolation).mockResolvedValue({ success: true });
  });

  it('does not render DLP load failures as empty policies or violations', async () => {
    render(<DLPView />);

    await waitFor(() => {
      expect(screen.getByText('DLP data unavailable')).toBeInTheDocument();
    });

    expect(screen.getAllByText('DLP backend down').length).toBeGreaterThan(0);
    expect(screen.getByText('DLP policies unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No DLP policies found')).not.toBeInTheDocument();
    expect(screen.queryByText('Total Policies')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Policy/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Violations/i }));

    expect(screen.getByText('DLP violations unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No unresolved violations')).not.toBeInTheDocument();
    expect(Api.createDLPPolicy).not.toHaveBeenCalled();
    expect(Api.toggleDLPPolicy).not.toHaveBeenCalled();
    expect(Api.deleteDLPPolicy).not.toHaveBeenCalled();
    expect(Api.resolveDLPViolation).not.toHaveBeenCalled();
  });

  it('does not close create policy modal when read-back does not confirm the policy', async () => {
    vi.mocked(Api.getDLPPolicies).mockResolvedValue([]);

    render(<DLPView />);

    await screen.findByText('No DLP policies found');
    fireEvent.click(screen.getByRole('button', { name: /Create Policy/i }));
    fireEvent.change(screen.getByPlaceholderText('Policy name'), {
      target: { value: 'PII Guard' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /Create Policy/i }).at(-1)!);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'DLP policy creation was not confirmed by the server'
      );
    });
    expect(screen.getByText('Create DLP Policy')).toBeInTheDocument();
  });

  it('keeps create policy modal open when create response does not include an id', async () => {
    vi.mocked(Api.getDLPPolicies).mockResolvedValue([]);
    vi.mocked(Api.createDLPPolicy).mockResolvedValue({ success: true });

    render(<DLPView />);

    await screen.findByText('No DLP policies found');
    fireEvent.click(screen.getByRole('button', { name: /Create Policy/i }));
    fireEvent.change(screen.getByPlaceholderText('Policy name'), {
      target: { value: 'PII Guard' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /Create Policy/i }).at(-1)!);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'DLP policy creation response was incomplete'
      );
    });
    expect(screen.getByText('Create DLP Policy')).toBeInTheDocument();
  });

  it('does not crash or render NaN when DLP stats and severities are malformed', async () => {
    vi.mocked(Api.getDLPPolicies).mockResolvedValue([]);
    vi.mocked(Api.getDLPViolations).mockResolvedValue([
      { ...violation, severity: 'UNKNOWN_SEVERITY' },
    ]);
    vi.mocked(Api.getDLPStats).mockResolvedValue({
      policies: { total: 'bad-total', active: 'bad-active' },
      violations: {
        total: 'bad-violations',
        unresolved: 'bad-unresolved',
        bySeverity: null,
      },
    });

    render(<DLPView />);

    fireEvent.click(await screen.findByRole('button', { name: /Violations/i }));
    expect(await screen.findByText('Unknown')).toBeInTheDocument();
    expect(screen.queryByText(/NaN|bad-/i)).not.toBeInTheDocument();
  });

  it('accepts wrapped policy and violation payloads', async () => {
    vi.mocked(Api.getDLPPolicies).mockResolvedValue({
      data: { data: { policies: [policy] } },
    });
    vi.mocked(Api.getDLPViolations).mockResolvedValue({
      data: { data: { violations: [violation] } },
    });
    vi.mocked(Api.getDLPStats).mockResolvedValue({
      data: { data: dlpStats },
    });

    render(<DLPView />);

    expect(await screen.findByText('PII Guard')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Violations/i }));
    expect(await screen.findByText('email')).toBeInTheDocument();
    openRowActions();
    expect(screen.getByRole('menuitem', { name: 'Resolve' })).toBeInTheDocument();
  });

  it('closes create policy modal only after read-back confirms the policy', async () => {
    vi.mocked(Api.getDLPPolicies).mockResolvedValueOnce([]).mockResolvedValueOnce([policy]);

    render(<DLPView />);

    await screen.findByText('No DLP policies found');
    fireEvent.click(screen.getByRole('button', { name: /Create Policy/i }));
    fireEvent.change(screen.getByPlaceholderText('Policy name'), {
      target: { value: 'PII Guard' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /Create Policy/i }).at(-1)!);

    await waitFor(() => {
      expect(screen.queryByText('Create DLP Policy')).not.toBeInTheDocument();
    });
    expect(screen.getByText('PII Guard')).toBeInTheDocument();
  });

  it('does not toggle or delete policies when read-back remains stale', async () => {
    vi.mocked(Api.getDLPPolicies).mockResolvedValue([policy]);

    render(<DLPView />);

    await screen.findByText('PII Guard');
    chooseRowAction('Deactivate');

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'DLP policy status was not confirmed by the server'
      );
    });

    chooseRowAction('Delete');

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'DLP policy deletion was not confirmed by the server'
      );
    });
    expect(screen.getByText('PII Guard')).toBeInTheDocument();
  });

  it('does not report delete success when policy read-back is unavailable', async () => {
    vi.mocked(Api.getDLPPolicies)
      .mockResolvedValueOnce([policy])
      .mockRejectedValueOnce(new Error('Read-back down'));

    render(<DLPView />);

    await screen.findByText('PII Guard');
    chooseRowAction('Delete');

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'DLP policy deletion was not confirmed by the server'
      );
    });
  });

  it('does not resolve violations when read-back keeps the violation and uses safe dates', async () => {
    vi.mocked(Api.getDLPPolicies).mockResolvedValue([policy]);
    vi.mocked(Api.getDLPViolations).mockResolvedValue([violation]);

    render(<DLPView />);

    fireEvent.click(await screen.findByRole('button', { name: /Violations/i }));
    expect(await screen.findByText('Unknown date')).toBeInTheDocument();
    chooseRowAction('Resolve');

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'DLP violation resolution was not confirmed by the server'
      );
    });
    expect(screen.getByText('PII Guard')).toBeInTheDocument();
  });

  it('does not report violation resolution success when read-back is unavailable', async () => {
    vi.mocked(Api.getDLPPolicies).mockResolvedValue([policy]);
    vi.mocked(Api.getDLPViolations)
      .mockResolvedValueOnce([violation])
      .mockRejectedValueOnce(new Error('Read-back down'));

    render(<DLPView />);

    fireEvent.click(await screen.findByRole('button', { name: /Violations/i }));
    expect(await screen.findByText('PII Guard')).toBeInTheDocument();
    chooseRowAction('Resolve');

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'DLP violation resolution was not confirmed by the server'
      );
    });
  });

  it('accepts a deeply wrapped policy create response when read-back confirms it', async () => {
    vi.mocked(Api.getDLPPolicies).mockResolvedValueOnce([]).mockResolvedValueOnce([policy]);
    vi.mocked(Api.createDLPPolicy).mockResolvedValue({
      data: { data: { policy: { id: 'policy-1' } } },
    });

    render(<DLPView />);

    await screen.findByText('No DLP policies found');
    fireEvent.click(screen.getByRole('button', { name: /Create Policy/i }));
    fireEvent.change(screen.getByPlaceholderText('Policy name'), {
      target: { value: 'PII Guard' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /Create Policy/i }).at(-1)!);

    await waitFor(() => {
      expect(screen.queryByText('Create DLP Policy')).not.toBeInTheDocument();
    });
    expect(screen.getByText('PII Guard')).toBeInTheDocument();
  });

  it('does not render malformed policy payloads as empty policies', async () => {
    vi.mocked(Api.getDLPPolicies).mockResolvedValue({ unexpected: true });

    render(<DLPView />);

    await waitFor(() => {
      expect(screen.getByText('DLP data unavailable')).toBeInTheDocument();
    });
    expect(screen.getAllByText('DLP policies response was not a list').length).toBeGreaterThan(0);
    expect(screen.queryByText('No DLP policies found')).not.toBeInTheDocument();
  });
});
