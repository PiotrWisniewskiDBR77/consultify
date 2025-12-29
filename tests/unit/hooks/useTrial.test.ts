/**
 * useTrial Hook Tests
 * 
 * Tests for trial context hook.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { useTrial, TrialProvider } from '../../../contexts/TrialContext';
import { useAppStore } from '../../../store/useAppStore';

// Mock dependencies
vi.mock('../../../store/useAppStore');

// Mock fetch
global.fetch = vi.fn();

describe('useTrial Hook', () => {
    const mockUser = {
        id: 'user-1',
        organizationId: 'org-1'
    };

    const mockPolicyResponse = {
        isTrial: true,
        isTrialExpired: false,
        trialDaysLeft: 7,
        trialExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        limits: {
            maxProjects: 3,
            maxUsers: 5,
            maxAICallsPerDay: 100,
            maxInitiatives: 10,
            maxStorageMb: 1000,
            maxTotalTokens: 100000
        },
        usageToday: {
            aiCalls: 10,
            projects: 1,
            users: 2
        },
        trialTokenUsage: {
            tokensUsed: 5000
        },
        blockedActions: []
    };

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        (useAppStore as Mock).mockReturnValue({
            currentUser: mockUser
        });

        vi.mocked(global.fetch).mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue(mockPolicyResponse)
        } as any);
    });

    const createWrapper = () => {
        return ({ children }: { children: React.ReactNode }) => (
            <TrialProvider>{children}</TrialProvider>
        );
    };

    it('should return trial state', async () => {
        localStorage.setItem('token', 'test-token');
        const wrapper = createWrapper();
        const { result } = renderHook(() => useTrial(), { wrapper });

        await waitFor(() => {
            expect(result.current.isTrial).toBe(true);
        });

        expect(result.current.daysRemaining).toBe(7);
        expect(result.current.isExpired).toBe(false);
    });

    it('should return trial limits', async () => {
        localStorage.setItem('token', 'test-token');
        const wrapper = createWrapper();
        const { result } = renderHook(() => useTrial(), { wrapper });

        await waitFor(() => {
            expect(result.current.limits).toBeDefined();
        });

        expect(result.current.limits?.maxProjects).toBe(3);
        expect(result.current.limits?.maxUsers).toBe(5);
    });

    it('should return trial usage', async () => {
        localStorage.setItem('token', 'test-token');
        const wrapper = createWrapper();
        const { result } = renderHook(() => useTrial(), { wrapper });

        await waitFor(() => {
            expect(result.current.usage).toBeDefined();
        });

        expect(result.current.usage.aiCalls).toBe(10);
        expect(result.current.usage.projects).toBe(1);
    });

    it('should refresh trial status', async () => {
        localStorage.setItem('token', 'test-token');
        const wrapper = createWrapper();
        const { result } = renderHook(() => useTrial(), { wrapper });

        await waitFor(() => {
            expect(result.current.refreshTrialStatus).toBeDefined();
        });

        await result.current.refreshTrialStatus();

        expect(global.fetch).toHaveBeenCalled();
    });

    it('should handle expired trial', async () => {
        localStorage.setItem('token', 'test-token');
        vi.mocked(global.fetch).mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
                ...mockPolicyResponse,
                isTrialExpired: true,
                trialDaysLeft: 0
            })
        } as any);

        const wrapper = createWrapper();
        const { result } = renderHook(() => useTrial(), { wrapper });

        await waitFor(() => {
            expect(result.current.isExpired).toBe(true);
        });
    });

    it('should handle blocked actions', async () => {
        localStorage.setItem('token', 'test-token');
        vi.mocked(global.fetch).mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
                ...mockPolicyResponse,
                blockedActions: ['create_project', 'invite_user']
            })
        } as any);

        const wrapper = createWrapper();
        const { result } = renderHook(() => useTrial(), { wrapper });

        await waitFor(() => {
            expect(result.current.blockedActions).toBeDefined();
        });

        expect(result.current.blockedActions).toContain('create_project');
    });

    it('should handle no user', async () => {
        (useAppStore as Mock).mockReturnValue({
            currentUser: null
        });

        const wrapper = createWrapper();
        const { result } = renderHook(() => useTrial(), { wrapper });

        expect(result.current.isTrial).toBe(false);
        expect(result.current.loading).toBe(false);
    });

    it('should handle fetch errors', async () => {
        localStorage.setItem('token', 'test-token');
        vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

        const wrapper = createWrapper();
        const { result } = renderHook(() => useTrial(), { wrapper });

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });
    });
});

