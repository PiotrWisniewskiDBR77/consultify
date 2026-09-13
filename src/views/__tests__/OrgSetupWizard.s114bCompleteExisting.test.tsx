/**
 * S1.14b / B3 — "Complete Setup" created a SECOND organization instead of
 * completing the one in session.
 *
 * Measured on staging 13.09: Teresa blocked with TRIAL_PROFILE_INCOMPLETE →
 * "Access required" modal → CTA → /setup/organization → the wizard posted
 * /organizations and produced a duplicate org ("QA Fable 13.09" twice), while the
 * org actually in session kept onboarding_status != 'ORG_SETUP_COMPLETED' and
 * Teresa stayed blocked. The unblock path was a loop.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiPost = vi.fn();
const apiPut = vi.fn();
vi.mock('@/services/api', () => ({ Api: { post: (...a: unknown[]) => apiPost(...a), put: (...a: unknown[]) => apiPut(...a) } }));
vi.mock('@/services/funnelAnalytics', () => ({ trackFunnelEvent: vi.fn() }));
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, d?: string) => (typeof d === 'string' ? d : _k) }),
}));

const setCurrentView = vi.fn();
let storeState: Record<string, unknown> = {};
vi.mock('../../store/useAppStore', () => ({
  useAppStore: () => storeState,
  AppView: {},
}));

import { OrgSetupWizard } from '../OrgSetupWizard';

const fillAndSubmit = async () => {
  await userEvent.click(screen.getByRole('checkbox'));
  const submit = screen.getByRole('button', { name: /Save and continue|Create organization/ });
  await userEvent.click(submit);
};

describe('S1.14b/B3 — the wizard completes the organization in session', () => {
  beforeEach(() => {
    apiPost.mockReset().mockResolvedValue({ id: 'new-org' });
    apiPut.mockReset().mockResolvedValue({ id: 'org-in-session' });
    setCurrentView.mockReset();
  });

  it('updates the existing organization and marks setup complete — no second org', async () => {
    storeState = {
      setCurrentView,
      currentUser: { id: 'user-1', email: 'qa@dbr77.com' },
      currentOrganization: { id: 'org-in-session', name: 'QA Fable 13.09' },
    };

    render(<OrgSetupWizard />);
    await fillAndSubmit();

    expect(apiPost).not.toHaveBeenCalled();
    expect(apiPut).toHaveBeenCalledWith(
      '/organizations/org-in-session',
      expect.objectContaining({ onboardingStatus: 'ORG_SETUP_COMPLETED' })
    );
  });

  it('shows a "complete your profile" heading, not "create a space"', () => {
    storeState = {
      setCurrentView,
      currentUser: { id: 'user-1', email: 'qa@dbr77.com' },
      currentOrganization: { id: 'org-in-session', name: 'QA Fable 13.09' },
    };
    render(<OrgSetupWizard />);
    expect(screen.getByText('Complete your organization profile')).toBeTruthy();
  });

  it('still creates an organization when there is none in session', async () => {
    storeState = {
      setCurrentView,
      currentUser: { id: 'user-1', email: 'qa@dbr77.com' },
      currentOrganization: null,
    };

    render(<OrgSetupWizard />);
    await userEvent.clear(screen.getByPlaceholderText(/VTS Group/));
    await userEvent.type(screen.getByPlaceholderText(/VTS Group/), 'Fresh Org');
    await fillAndSubmit();

    expect(apiPost).toHaveBeenCalledWith('/organizations', expect.objectContaining({ name: 'Fresh Org' }));
  });
});
