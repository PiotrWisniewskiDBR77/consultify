/**
 * @vitest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getOrganizationMembers, storeState } = vi.hoisted(() => ({
  getOrganizationMembers: vi.fn(),
  storeState: {
    currentOrganization: { id: 'org-a', name: 'Org A' } as { id: string; name: string } | null,
    currentUser: { id: 'admin-a', role: 'ADMIN' } as { id: string; role: string } | null,
  },
}));

vi.mock('@/services/api/organizations.api', () => ({
  OrganizationApi: { getOrganizationMembers },
}));
vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (state: typeof storeState) => unknown) => selector(storeState),
}));

import { memberNameOrUnknown, useOrganizationMemberNames } from '../useOrganizationMemberNames';

describe('useOrganizationMemberNames tenant directory access and cache scope', () => {
  beforeEach(() => {
    getOrganizationMembers.mockReset();
    storeState.currentOrganization = { id: 'org-a', name: 'Org A' };
    storeState.currentUser = { id: 'admin-a', role: 'ADMIN' };
  });

  it('resolves a minimal directory response for a MEMBER in the current organization', async () => {
    storeState.currentUser = { id: 'user-a', role: 'MEMBER' };
    getOrganizationMembers.mockResolvedValueOnce([
      { id: 'person-a', displayName: 'Alice Member', avatar: null },
    ]);
    const { result } = renderHook(() => useOrganizationMemberNames());

    await waitFor(() => expect(result.current('person-a')).toBe('Alice Member'));
    expect(getOrganizationMembers).toHaveBeenCalledWith('org-a');
  });

  it('clears cached names synchronously across organization, user, and role transitions', async () => {
    getOrganizationMembers
      .mockResolvedValueOnce([{ user_id: 'person-a', first_name: 'Alice', last_name: 'A' }])
      .mockResolvedValueOnce([{ user_id: 'person-b', first_name: 'Bob', last_name: 'B' }])
      .mockResolvedValueOnce([{ user_id: 'person-c', first_name: 'Carol', last_name: 'C' }])
      .mockResolvedValueOnce([]);
    const { result, rerender } = renderHook(() => useOrganizationMemberNames());

    await waitFor(() => expect(result.current('person-a')).toBe('Alice A'));

    act(() => {
      storeState.currentOrganization = { id: 'org-b', name: 'Org B' };
      rerender();
    });
    expect(result.current('person-a')).toBeNull();
    await waitFor(() => expect(result.current('person-b')).toBe('Bob B'));

    act(() => {
      storeState.currentUser = { id: 'admin-b', role: 'ADMIN' };
      rerender();
    });
    expect(result.current('person-b')).toBeNull();
    await waitFor(() => expect(result.current('person-c')).toBe('Carol C'));

    act(() => {
      storeState.currentUser = { id: 'user-b', role: 'MEMBER' };
      rerender();
    });
    expect(result.current('person-c')).toBeNull();
    await waitFor(() => expect(getOrganizationMembers).toHaveBeenCalledTimes(4));
  });

  it('ignores a late member-directory response from the previous organization scope', async () => {
    let resolveOrgA!: (members: unknown[]) => void;
    let resolveOrgB!: (members: unknown[]) => void;
    getOrganizationMembers.mockImplementation(
      (organizationId: string) =>
        new Promise((resolve) => {
          if (organizationId === 'org-a') resolveOrgA = resolve;
          if (organizationId === 'org-b') resolveOrgB = resolve;
        })
    );
    const { result, rerender } = renderHook(() => useOrganizationMemberNames());
    await waitFor(() => expect(getOrganizationMembers).toHaveBeenCalledWith('org-a'));

    act(() => {
      storeState.currentOrganization = { id: 'org-b', name: 'Org B' };
      rerender();
    });
    await waitFor(() => expect(getOrganizationMembers).toHaveBeenCalledWith('org-b'));

    await act(async () => {
      resolveOrgB([{ user_id: 'person-b', first_name: 'Bob', last_name: 'B' }]);
    });
    await waitFor(() => expect(result.current('person-b')).toBe('Bob B'));

    await act(async () => {
      resolveOrgA([{ user_id: 'person-a', first_name: 'Alice', last_name: 'A' }]);
    });
    expect(result.current('person-a')).toBeNull();
    expect(result.current('person-b')).toBe('Bob B');
  });

  it('renders Unknown user when a foreign-directory request is rejected', async () => {
    storeState.currentUser = { id: 'member-a', role: 'MEMBER' };
    getOrganizationMembers.mockRejectedValueOnce(
      Object.assign(new Error('Access denied'), { status: 403 })
    );
    const { result } = renderHook(() => useOrganizationMemberNames());

    await waitFor(() => expect(getOrganizationMembers).toHaveBeenCalledWith('org-a'));
    await waitFor(() =>
      expect(memberNameOrUnknown(result.current, 'person-b', false)).toBe('Unknown user')
    );
  });
});
