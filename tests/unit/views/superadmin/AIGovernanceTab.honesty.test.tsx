import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AIGovernanceTab } from '@/views/superadmin/AIPlatformModule/Configuration/AIGovernanceTab';
import { Api } from '@/services/api';
import { toast } from 'react-hot-toast';

vi.mock('@/services/api', () => ({
  Api: {
    getAIGovernanceContextPolicy: vi.fn(),
    updateAIGovernanceContextPolicy: vi.fn(),
    getAIGovernancePolicy: vi.fn(),
    updateAIGovernancePolicy: vi.fn(),
    getAIGovernanceHealth: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const contextPolicy = {
  categories: {
    ORG_PROFILE: true,
    ORG_TERMINOLOGY: true,
    ORG_PATTERNS: false,
    ORG_STRATEGY: true,
    ORG_SECURITY_POSTURE: false,
    ORG_FINANCIAL_SUMMARY: false,
    ORG_DOCUMENTS: true,
  },
  piiRedaction: 'inherit',
  retention: 'standard',
};

const policy = {
  summary: {
    currentLevel: 'balanced',
    description: 'Balanced governance',
    internetEnabled: true,
    auditRequired: true,
  },
};

const health = {
  duplicateMounts: [],
  healthChecks: [{ name: 'routes', status: 'ok', detail: 'mounted once' }],
  timestamp: '2026-04-26T10:00:00.000Z',
};

describe('AIGovernanceTab honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getAIGovernanceContextPolicy).mockResolvedValue({ data: contextPolicy });
    vi.mocked(Api.getAIGovernancePolicy).mockResolvedValue({ data: policy });
    vi.mocked(Api.getAIGovernanceHealth).mockResolvedValue({ data: health });
    vi.mocked(Api.updateAIGovernanceContextPolicy).mockResolvedValue({ success: true });
    vi.mocked(Api.updateAIGovernancePolicy).mockResolvedValue({ success: true });
  });

  it('does not render governance load failures as empty editable policy sections', async () => {
    vi.mocked(Api.getAIGovernanceContextPolicy).mockRejectedValue(
      new Error('Governance API down')
    );

    render(<AIGovernanceTab />);

    await waitFor(() => {
      expect(screen.getByText('AI governance unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Governance API down')).toBeInTheDocument();
    expect(screen.queryByText('No policy loaded.')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Org profile' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('refetches governance policy after saving before showing success state', async () => {
    vi.mocked(Api.getAIGovernanceContextPolicy)
      .mockResolvedValueOnce({ data: contextPolicy })
      .mockResolvedValueOnce({
        data: {
          ...contextPolicy,
          categories: { ...contextPolicy.categories, ORG_PROFILE: false },
        },
      });

    render(<AIGovernanceTab />);

    const orgProfile = await screen.findByRole('checkbox', { name: 'Org profile' });
    fireEvent.click(orgProfile);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(Api.updateAIGovernanceContextPolicy).toHaveBeenCalledWith(
        expect.objectContaining({
          categories: expect.objectContaining({ ORG_PROFILE: false }),
        })
      );
    });

    await waitFor(() => {
      expect(Api.getAIGovernanceContextPolicy).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByRole('checkbox', { name: 'Org profile' })).not.toBeChecked();
  });

  it('accepts deep wrapped governance payloads and normalizes string booleans', async () => {
    vi.mocked(Api.getAIGovernanceContextPolicy).mockResolvedValue({
      data: {
        data: {
          ...contextPolicy,
          categories: { ...contextPolicy.categories, ORG_PROFILE: 'false' },
        },
      },
    });
    vi.mocked(Api.getAIGovernancePolicy).mockResolvedValue({
      data: {
        data: {
          summary: {
            ...policy.summary,
            internetEnabled: 'false',
            auditRequired: 'true',
          },
        },
      },
    });
    vi.mocked(Api.getAIGovernanceHealth).mockResolvedValue({ data: { data: health } });

    render(<AIGovernanceTab />);

    expect(await screen.findByRole('checkbox', { name: 'Org profile' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Internet enabled' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Audit required' })).toBeChecked();
    expect(screen.queryByText('AI governance unavailable')).not.toBeInTheDocument();
  });

  it('does not render malformed governance payloads as editable defaults', async () => {
    vi.mocked(Api.getAIGovernanceContextPolicy).mockResolvedValue({
      data: { data: { unexpected: true } },
    });

    render(<AIGovernanceTab />);

    await waitFor(() => {
      expect(screen.getByText('AI governance unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Governance context policy response was incomplete')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Org profile' })).not.toBeInTheDocument();
  });

  it('does not claim save success when read-back is unavailable', async () => {
    vi.mocked(Api.getAIGovernanceContextPolicy)
      .mockResolvedValueOnce({ data: contextPolicy })
      .mockRejectedValueOnce(new Error('Governance read-back down'));

    render(<AIGovernanceTab />);

    const orgProfile = await screen.findByRole('checkbox', { name: 'Org profile' });
    fireEvent.click(orgProfile);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText('Governance read-back down')).toBeInTheDocument();
    });
    expect(toast.success).not.toHaveBeenCalledWith('Governance settings saved');
  });

  it('surfaces coded governance save failures for support traceability', async () => {
    const codedError = Object.assign(new Error('Save failed'), {
      data: { code: 'CONTEXT_POLICY_PERSIST_FAILED' },
    });
    vi.mocked(Api.updateAIGovernanceContextPolicy).mockRejectedValueOnce(codedError);

    render(<AIGovernanceTab />);

    const orgProfile = await screen.findByRole('checkbox', { name: 'Org profile' });
    fireEvent.click(orgProfile);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Save failed (CONTEXT_POLICY_PERSIST_FAILED)');
    });
  });

  it('surfaces health report unavailable state with coded error', async () => {
    const healthError = Object.assign(new Error('Health endpoint unavailable'), {
      data: { code: 'HEALTH_REPORT_FAILED' },
    });
    vi.mocked(Api.getAIGovernanceHealth).mockRejectedValueOnce(healthError);

    render(<AIGovernanceTab />);

    await waitFor(() => {
      expect(screen.getByText('Health report unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Health endpoint unavailable (HEALTH_REPORT_FAILED)')).toBeInTheDocument();
    expect(screen.queryByText('No report loaded.')).not.toBeInTheDocument();
  });
});
