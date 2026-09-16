/** @vitest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const setCurrentOrganization = vi.fn();
const getToken = vi.fn(() => 'token-current-org');

vi.mock('@/services/tokenService', () => ({
  tokenService: {
    getToken: () => getToken(),
    saveTokens: vi.fn(),
  },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({
      currentUser: { id: 'user-two-orgs', role: 'OWNER' },
      setCurrentOrganization,
      isDemoMode: false,
      demoSessionOrgId: null,
    }),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import { OrgProvider, useOrgContext } from '../OrgContext';

const ContextProbe = () => {
  const { currentOrg, availableOrgs } = useOrgContext();
  return (
    <div>
      <span data-testid="current-org">{currentOrg?.id ?? 'none'}</span>
      <span data-testid="available-orgs">{availableOrgs.map((org) => org.id).join(',')}</span>
    </div>
  );
};

describe('OrgContext token organization priority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('uses the organization marked current by the token response over a stale saved organization', async () => {
    localStorage.setItem('consultify_current_org_id', 'org-old');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          organizations: [
            {
              id: 'org-token',
              name: 'Token Organization',
              role: 'OWNER',
              access_type: 'MEMBER',
              is_current: true,
            },
            {
              id: 'org-old',
              name: 'Old Saved Organization',
              role: 'MEMBER',
              access_type: 'MEMBER',
              is_current: false,
            },
          ],
        }),
      })
    );

    render(
      <OrgProvider>
        <ContextProbe />
      </OrgProvider>
    );

    await waitFor(() => expect(screen.getByTestId('current-org')).toHaveTextContent('org-token'));
    expect(screen.getByTestId('available-orgs')).toHaveTextContent('org-token,org-old');
    expect(localStorage.getItem('consultify_current_org_id')).toBe('org-token');
    expect(setCurrentOrganization).toHaveBeenLastCalledWith({
      id: 'org-token',
      name: 'Token Organization',
    });
  });

  it('uses the saved organization only when the token response has no current organization', async () => {
    localStorage.setItem('consultify_current_org_id', 'org-saved');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          organizations: [
            {
              id: 'org-alpha',
              name: 'Alpha',
              role: 'MEMBER',
              access_type: 'MEMBER',
            },
            {
              id: 'org-saved',
              name: 'Saved',
              role: 'OWNER',
              access_type: 'MEMBER',
            },
          ],
        }),
      })
    );

    render(
      <OrgProvider>
        <ContextProbe />
      </OrgProvider>
    );

    await waitFor(() => expect(screen.getByTestId('current-org')).toHaveTextContent('org-saved'));
  });
});
