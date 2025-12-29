/**
 * useOrgContext Hook Tests
 * 
 * Tests for organization context hook.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { useOrgContext, useCurrentOrg } from '../../../contexts/OrgContext';
import { useAppStore } from '../../../store/useAppStore';
import { Api } from '../../../services/api';

// Mock dependencies
vi.mock('../../../store/useAppStore');
vi.mock('../../../services/api');

// Mock OrgProvider wrapper
const createWrapper = (mockStore: any) => {
    return ({ children }: { children: React.ReactNode }) => {
        const { OrgProvider } = require('../../../contexts/OrgContext');
        return <OrgProvider>{children}</OrgProvider>;
    };
};

describe('useOrgContext Hook', () => {
    const mockUser = {
        id: 'user-1',
        organizationId: 'org-1',
        role: 'ADMIN'
    };

    const mockOrganizations = [
        { id: 'org-1', name: 'Organization 1', isActive: true },
        { id: 'org-2', name: 'Organization 2', isActive: true }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        (useAppStore as Mock).mockReturnValue({
            currentUser: mockUser,
            organizations: mockOrganizations,
            currentOrgId: 'org-1'
        });

        vi.mocked(Api.get).mockResolvedValue(mockOrganizations);
    });

    it('should return organization context', () => {
        const wrapper = createWrapper(useAppStore);
        const { result } = renderHook(() => useOrgContext(), { wrapper });

        expect(result.current).toBeDefined();
        expect(result.current.organizations).toBeDefined();
        expect(result.current.currentOrg).toBeDefined();
    });

    it('should return current organization', () => {
        const wrapper = createWrapper(useAppStore);
        const { result } = renderHook(() => useCurrentOrg(), { wrapper });

        expect(result.current).toBeDefined();
        if (result.current) {
            expect(result.current.id).toBe('org-1');
        }
    });

    it('should throw error when used outside provider', () => {
        // Render without provider wrapper
        expect(() => {
            renderHook(() => useOrgContext());
        }).toThrow('useOrgContext must be used within an OrgProvider');
    });

    it('should handle organization switching', async () => {
        const wrapper = createWrapper(useAppStore);
        const { result } = renderHook(() => useOrgContext(), { wrapper });

        if (result.current.switchOrg) {
            await result.current.switchOrg('org-2');

            await waitFor(() => {
                expect(result.current.currentOrg?.id).toBe('org-2');
            });
        }
    });

    it('should refresh organizations', async () => {
        const wrapper = createWrapper(useAppStore);
        const { result } = renderHook(() => useOrgContext(), { wrapper });

        if (result.current.refresh) {
            await result.current.refresh();

            expect(Api.get).toHaveBeenCalledWith('/organizations');
        }
    });
});

