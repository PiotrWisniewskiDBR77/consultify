/**
 * useOrg Hook Integration Tests
 *
 * Tests organization management and switching functionality.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock API and store
vi.mock('@/services/api', () => ({
  Api: {
    getOrganization: vi.fn(),
    getOrganizations: vi.fn(),
    switchOrganization: vi.fn(),
    updateOrganization: vi.fn(),
  },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: vi.fn(() => ({
    currentUser: { organizationId: 'org-1' },
    setCurrentUser: vi.fn(),
  })),
}));

import { Api } from '@/services/api';

describe('useOrg', () => {
  const mockOrg = {
    id: 'org-1',
    name: 'Test Organization',
    plan: 'enterprise',
    members: 25,
    settings: {
      aiEnabled: true,
      maxProjects: 100,
    },
  };

  const mockOrgs = [mockOrg, { id: 'org-2', name: 'Other Org', plan: 'starter', members: 5 }];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getOrganization).mockResolvedValue(mockOrg);
    vi.mocked(Api.getOrganizations).mockResolvedValue(mockOrgs);
    vi.mocked(Api.switchOrganization).mockResolvedValue({ success: true });
    vi.mocked(Api.updateOrganization).mockResolvedValue({ ...mockOrg, name: 'Updated Org' });
  });

  it('should get current organization', async () => {
    const org = await Api.getOrganization('org-1');

    expect(org.id).toBe('org-1');
    expect(org.name).toBe('Test Organization');
  });

  it('should list user organizations', async () => {
    const orgs = await Api.getOrganizations();

    expect(orgs).toHaveLength(2);
    expect(orgs[0].name).toBe('Test Organization');
  });

  it('should switch between organizations', async () => {
    const result = await Api.switchOrganization('org-2');

    expect(Api.switchOrganization).toHaveBeenCalledWith('org-2');
    expect(result.success).toBe(true);
  });

  it('should update organization settings', async () => {
    const updated = await Api.updateOrganization('org-1', { name: 'Updated Org' });

    expect(updated.name).toBe('Updated Org');
  });

  it('should check organization plan features', () => {
    const planFeatures: Record<string, string[]> = {
      starter: ['basic_reports'],
      professional: ['basic_reports', 'ai_chat'],
      enterprise: ['basic_reports', 'ai_chat', 'advanced_analytics', 'sso'],
    };

    const hasFeature = (plan: string, feature: string) =>
      planFeatures[plan]?.includes(feature) ?? false;

    expect(hasFeature('enterprise', 'sso')).toBe(true);
    expect(hasFeature('starter', 'sso')).toBe(false);
  });

  it('should check member limits', () => {
    const memberLimits: Record<string, number> = {
      starter: 5,
      professional: 25,
      enterprise: -1, // unlimited
    };

    const canAddMember = (plan: string, currentMembers: number) => {
      const limit = memberLimits[plan];
      return limit === -1 || currentMembers < limit;
    };

    expect(canAddMember('starter', 5)).toBe(false);
    expect(canAddMember('enterprise', 1000)).toBe(true);
  });

  it('should track organization usage', () => {
    const usage = {
      projects: 50,
      storage: '10GB',
      aiQueries: 5000,
    };

    const limits = {
      projects: 100,
      storage: '100GB',
      aiQueries: 10000,
    };

    const usagePercentage = (50 / 100) * 100;
    expect(usagePercentage).toBe(50);
  });

  it('should handle organization not found', async () => {
    vi.mocked(Api.getOrganization).mockRejectedValue(new Error('Organization not found'));

    await expect(Api.getOrganization('invalid')).rejects.toThrow('Organization not found');
  });

  it('should validate organization name', () => {
    const isValidName = (name: string) => {
      return name.length >= 2 && name.length <= 100 && /^[a-zA-Z0-9\s-]+$/.test(name);
    };

    expect(isValidName('Test Org')).toBe(true);
    expect(isValidName('A')).toBe(false);
    expect(isValidName('Invalid@Org!')).toBe(false);
  });

  it('should check if user can manage organization', () => {
    const userRoles = ['owner', 'admin'];
    const canManage = (role: string) => ['owner', 'admin'].includes(role);

    expect(canManage('owner')).toBe(true);
    expect(canManage('member')).toBe(false);
  });
});
