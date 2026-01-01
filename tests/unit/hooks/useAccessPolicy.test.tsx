/**
 * useAccessPolicy Hook Tests
 * 
 * Tests for access policy context hooks (usePolicySnapshot, useIsDemo, useIsTrial, etc.).
 */

import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import {
    usePolicySnapshot,
    useIsDemo,
    useIsTrial,
    useIsPaid,
    useTrialDaysLeft,
    useIsTrialExpired,
    AccessPolicyProvider
} from '../../../contexts/AccessPolicyContext';
import { useAppStore } from '../../../store/useAppStore';

// Mock dependencies
vi.mock('../../../store/useAppStore');

// Mock fetch
global.fetch = vi.fn();

describe('useAccessPolicy Hooks', () => {
    const mockUser = {
        id: 'user-1',
        organizationId: 'org-1'
    };

    const mockPolicySnapshot = {
        orgType: 'TRIAL' as const,
        isDemo: false,
        isTrial: true,
        isPaid: false,
        trialStartedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        trialExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        trialDaysLeft: 7,
        isTrialExpired: false,
        warningLevel: 'none' as const,
        limits: {
            maxProjects: 3,
            maxUsers: 5,
            maxAICallsPerDay: 100,
            maxInitiatives: 10,
            maxStorageMb: 1000,
            aiRolesEnabled: ['USER', 'ADMIN']
        },
        usageToday: {
            aiCalls: 10,
            projects: 1,
            users: 2
        },
        blockedFeatures: [],
        blockedActions: [],
        upgradeCtas: {
            primaryAction: 'Upgrade Now',
            urlOrRoute: '/settings/billing'
        },
        messages: {
            bannerText: null,
            modalText: null
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        (useAppStore as Mock).mockReturnValue({
            currentUser: mockUser
        });

        vi.mocked(global.fetch).mockImplementation((url: any) => {
            if (url.includes('/api/organization/policy-snapshot')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => mockPolicySnapshot
                } as Response);
            }
            return Promise.resolve({ ok: false } as Response);
        });
    });

    const createWrapper = () => {
        return ({ children }: { children: React.ReactNode }) => (
            <AccessPolicyProvider>{children}</AccessPolicyProvider>
        );
    };

    describe('usePolicySnapshot', () => {
        it('should return policy snapshot', async () => {
            localStorage.setItem('consultify-storage', JSON.stringify({
                state: { currentUser: { token: 'test-token' } }
            }));

            const wrapper = createWrapper();
            const { result } = renderHook(() => usePolicySnapshot(), { wrapper });

            await waitFor(() => {
                expect(result.current.snapshot).toBeDefined();
            });

            expect(result.current.snapshot?.orgType).toBe('TRIAL');
            expect(result.current.snapshot?.isTrial).toBe(true);
        });

        it('should check if action is blocked', async () => {
            localStorage.setItem('consultify-storage', JSON.stringify({
                state: { currentUser: { token: 'test-token' } }
            }));

            vi.mocked(global.fetch).mockImplementation((url: any) => {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        ...mockPolicySnapshot,
                        blockedActions: ['create_project']
                    })
                } as Response);
            });

            const wrapper = createWrapper();
            const { result } = renderHook(() => usePolicySnapshot(), { wrapper });

            await waitFor(() => {
                expect(result.current.snapshot).toBeDefined();
                expect(result.current.isActionBlocked('create_project')).toBe(true);
            });

            expect(result.current.isActionBlocked('view_dashboard')).toBe(false);
        });

        it('should check if feature is blocked', async () => {
            localStorage.setItem('consultify-storage', JSON.stringify({
                state: { currentUser: { token: 'test-token' } }
            }));

            vi.mocked(global.fetch).mockImplementation((url: any) => {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        ...mockPolicySnapshot,
                        blockedFeatures: ['advanced-analytics']
                    })
                } as Response);
            });

            const wrapper = createWrapper();
            const { result } = renderHook(() => usePolicySnapshot(), { wrapper });

            await waitFor(() => {
                expect(result.current.snapshot).toBeDefined();
                expect(result.current.isFeatureBlocked('advanced-analytics')).toBe(true);
            });

            expect(result.current.isFeatureBlocked('basic-dashboard')).toBe(false);
        });

        it('should refresh snapshot', async () => {
            localStorage.setItem('consultify-storage', JSON.stringify({
                state: { currentUser: { token: 'test-token' } }
            }));

            const wrapper = createWrapper();
            const { result } = renderHook(() => usePolicySnapshot(), { wrapper });

            await waitFor(() => {
                expect(result.current.refresh).toBeDefined();
            });

            await result.current.refresh();

            expect(global.fetch).toHaveBeenCalled();
        });

        it('should throw error when used outside provider', () => {
            expect(() => {
                renderHook(() => usePolicySnapshot());
            }).toThrow('usePolicySnapshot must be used within AccessPolicyProvider');
        });
    });

    describe('useIsDemo', () => {
        it('should return true for demo org', async () => {
            localStorage.setItem('consultify-storage', JSON.stringify({
                state: { currentUser: { token: 'test-token' } }
            }));

            vi.mocked(global.fetch).mockImplementation((url: any) => {
                if (url.includes('/api/organization/policy-snapshot')) {
                    return Promise.resolve({
                        ok: true,
                        json: async () => ({
                            ...mockPolicySnapshot,
                            orgType: 'DEMO',
                            isDemo: true
                        })
                    } as Response);
                }
                return Promise.resolve({ ok: false } as Response);
            });

            const wrapper = createWrapper();
            const { result } = renderHook(() => useIsDemo(), { wrapper });

            await waitFor(() => {
                expect(result.current).toBe(true);
            });
        });

        it('should return false for non-demo org', async () => {
            localStorage.setItem('consultify-storage', JSON.stringify({
                state: { currentUser: { token: 'test-token' } }
            }));

            const wrapper = createWrapper();
            const { result } = renderHook(() => useIsDemo(), { wrapper });

            await waitFor(() => {
                expect(result.current).toBe(false);
            });
        });
    });

    describe('useIsTrial', () => {
        it('should return true for trial org', async () => {
            localStorage.setItem('consultify-storage', JSON.stringify({
                state: { currentUser: { token: 'test-token' } }
            }));

            const wrapper = createWrapper();
            const { result } = renderHook(() => useIsTrial(), { wrapper });

            await waitFor(() => {
                expect(result.current).toBe(true);
            });
        });

        it('should return false for paid org', async () => {
            localStorage.setItem('consultify-storage', JSON.stringify({
                state: { currentUser: { token: 'test-token' } }
            }));

            vi.mocked(global.fetch).mockImplementation((url: any) => {
                if (url.includes('/api/organization/policy-snapshot')) {
                    return Promise.resolve({
                        ok: true,
                        json: async () => ({
                            ...mockPolicySnapshot,
                            orgType: 'PAID',
                            isTrial: false
                        })
                    } as Response);
                }
                return Promise.resolve({ ok: false } as Response);
            });

            const wrapper = createWrapper();
            const { result } = renderHook(() => useIsTrial(), { wrapper });

            await waitFor(() => {
                expect(result.current).toBe(false);
            });
        });
    });

    describe('useIsPaid', () => {
        it('should return true for paid org', async () => {
            localStorage.setItem('consultify-storage', JSON.stringify({
                state: { currentUser: { token: 'test-token' } }
            }));

            vi.mocked(global.fetch).mockImplementation((url: any) => {
                if (url.includes('/api/organization/policy-snapshot')) {
                    return Promise.resolve({
                        ok: true,
                        json: async () => ({
                            ...mockPolicySnapshot,
                            orgType: 'PAID',
                            isPaid: true
                        })
                    } as Response);
                }
                return Promise.resolve({ ok: false } as Response);
            });

            const wrapper = createWrapper();
            const { result } = renderHook(() => useIsPaid(), { wrapper });

            await waitFor(() => {
                expect(result.current).toBe(true);
            });
        });
    });

    describe('useTrialDaysLeft', () => {
        it('should return trial days left', async () => {
            localStorage.setItem('consultify-storage', JSON.stringify({
                state: { currentUser: { token: 'test-token' } }
            }));

            const wrapper = createWrapper();
            const { result } = renderHook(() => useTrialDaysLeft(), { wrapper });

            await waitFor(() => {
                expect(result.current).toBe(7);
            });
        });
    });

    describe('useIsTrialExpired', () => {
        it('should return true for expired trial', async () => {
            localStorage.setItem('consultify-storage', JSON.stringify({
                state: { currentUser: { token: 'test-token' } }
            }));

            vi.mocked(global.fetch).mockImplementation((url: any) => {
                if (url.includes('/api/organization/policy-snapshot')) {
                    return Promise.resolve({
                        ok: true,
                        json: async () => ({
                            ...mockPolicySnapshot,
                            isTrialExpired: true,
                            trialDaysLeft: 0
                        })
                    } as Response);
                }
                return Promise.resolve({ ok: false } as Response);
            });

            const wrapper = createWrapper();
            const { result } = renderHook(() => useIsTrialExpired(), { wrapper });

            await waitFor(() => {
                expect(result.current).toBe(true);
            });
        });
    });
});

