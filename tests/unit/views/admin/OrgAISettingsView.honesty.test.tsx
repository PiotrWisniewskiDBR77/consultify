import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminApi } from '@/services/api/admin.api';
import { OrgAISettingsView } from '@/views/admin/OrgAISettingsView';

const translate = (_key: string, fallback?: string) => fallback || _key;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: translate }),
}));

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('@/services/api/admin.api', () => ({
  AdminApi: {
    getOrganizationAISettings: vi.fn(),
    updateOrganizationAISettings: vi.fn(),
  },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    currentOrganization: { id: 'org-1', name: 'Acme' },
  }),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('OrgAISettingsView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(AdminApi.getOrganizationAISettings).mockRejectedValue(new Error('AI settings down'));
  });

  it('does not render failed AI settings loads as missing configuration', async () => {
    render(<OrgAISettingsView />);

    await waitFor(() => {
      expect(screen.getByText('Organization AI settings unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('No AI Settings Found')).not.toBeInTheDocument();
  });

  it('saves organization AI settings by reloading the persisted backend state', async () => {
    vi.mocked(AdminApi.getOrganizationAISettings)
      .mockResolvedValueOnce({
        organizationId: 'org-1',
        policyLevel: 'ADVISORY',
        maxPolicyLevel: 'AUTOPILOT',
        defaultProactivityMode: 'REACTIVE',
        activeRoles: ['ADVISOR'],
        defaultRole: 'ADVISOR',
        maxAICallsPerDay: 100,
        maxTokensPerMonth: 500000,
        monthlyBudgetUSD: 100,
        hardLimitUSD: 500,
        artifactsEnabled: false,
        thinkingStepsEnabled: false,
        focusModesEnabled: false,
        webSearchEnabled: false,
        voiceEnabled: false,
      })
      .mockResolvedValueOnce({
        organizationId: 'org-1',
        policyLevel: 'ADVISORY',
        maxPolicyLevel: 'AUTOPILOT',
        defaultProactivityMode: 'REACTIVE',
        activeRoles: ['ADVISOR'],
        defaultRole: 'ADVISOR',
        maxAICallsPerDay: 100,
        maxTokensPerMonth: 500000,
        monthlyBudgetUSD: 100,
        hardLimitUSD: 500,
        artifactsEnabled: true,
        thinkingStepsEnabled: false,
        focusModesEnabled: false,
        webSearchEnabled: false,
        voiceEnabled: false,
      })
      .mockResolvedValueOnce({
        organizationId: 'org-1',
        policyLevel: 'ADVISORY',
        maxPolicyLevel: 'AUTOPILOT',
        defaultProactivityMode: 'REACTIVE',
        activeRoles: ['ADVISOR'],
        defaultRole: 'ADVISOR',
        maxAICallsPerDay: 100,
        maxTokensPerMonth: 500000,
        monthlyBudgetUSD: 100,
        hardLimitUSD: 500,
        artifactsEnabled: true,
        thinkingStepsEnabled: false,
        focusModesEnabled: false,
        webSearchEnabled: false,
        voiceEnabled: false,
      });
    vi.mocked(AdminApi.updateOrganizationAISettings).mockResolvedValue({});

    const { unmount } = render(<OrgAISettingsView />);

    await waitFor(() => {
      expect(screen.getByText('Organization AI Settings')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Features/i }));
    const artifactToggle = screen.getAllByRole('switch')[0];
    expect(artifactToggle).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(artifactToggle);
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(AdminApi.updateOrganizationAISettings).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ artifactsEnabled: true })
      );
    });

    await waitFor(() => {
      expect(screen.getAllByRole('switch')[0]).toHaveAttribute('aria-checked', 'true');
    });

    expect(AdminApi.getOrganizationAISettings).toHaveBeenCalledTimes(2);

    unmount();
    render(<OrgAISettingsView />);

    await waitFor(() => {
      expect(screen.getByText('Organization AI Settings')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Features/i }));

    await waitFor(() => {
      expect(screen.getAllByRole('switch')[0]).toHaveAttribute('aria-checked', 'true');
    });
  });

  it('does not claim AI settings success when read-back returns stale values', async () => {
    const staleSettings = {
      organizationId: 'org-1',
      policyLevel: 'ADVISORY',
      maxPolicyLevel: 'AUTOPILOT',
      defaultProactivityMode: 'REACTIVE',
      activeRoles: ['ADVISOR'],
      defaultRole: 'ADVISOR',
      maxAICallsPerDay: 100,
      maxTokensPerMonth: 500000,
      monthlyBudgetUSD: 100,
      hardLimitUSD: 500,
      artifactsEnabled: false,
      thinkingStepsEnabled: false,
      focusModesEnabled: false,
      webSearchEnabled: false,
      voiceEnabled: false,
      auditAllRequests: false,
      auditPolicyChanges: false,
    };

    vi.mocked(AdminApi.getOrganizationAISettings)
      .mockResolvedValueOnce(staleSettings)
      .mockResolvedValueOnce(staleSettings);
    vi.mocked(AdminApi.updateOrganizationAISettings).mockResolvedValue({});

    render(<OrgAISettingsView />);

    await waitFor(() => {
      expect(screen.getByText('Organization AI Settings')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Features/i }));
    fireEvent.click(screen.getAllByRole('switch')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Organization AI settings save was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Save Changes/i })).not.toBeDisabled();
  });
});
