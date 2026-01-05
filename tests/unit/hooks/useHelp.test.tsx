/**
 * useHelp Hook Tests
 * 
 * Tests for help context hook.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { useHelp, useHelpPlaybooks, useHelpPanel, HelpProvider } from '../../../contexts/HelpContext';
import { useAppStore } from '@/store/useAppStore';

// Mock dependencies
vi.mock('@/store/useAppStore');

// Mock fetch
global.fetch = vi.fn();

describe('useHelp Hook', () => {
    const mockUser = {
        id: 'user-1',
        organizationId: 'org-1',
        role: 'USER'
    };

    const mockPlaybooks = [
        {
            id: 'pb-1',
            key: 'getting-started',
            title: 'Getting Started',
            description: 'Learn the basics',
            targetRole: 'USER',
            targetOrgType: 'TRIAL',
            priority: 1,
            isActive: true,
            isCompleted: false,
            isDismissed: false,
            status: 'AVAILABLE' as const
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        (useAppStore as Mock).mockReturnValue({
            currentUser: mockUser,
            currentView: 'dashboard'
        });

        vi.mocked(global.fetch).mockImplementation((url: any) => {
            if (url.includes('/api/help/playbooks')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ playbooks: mockPlaybooks })
                } as Response);
            }
            return Promise.resolve({ ok: false } as Response);
        });
    });

    const createWrapper = () => {
        return ({ children }: { children: React.ReactNode }) => (
            <HelpProvider>{children}</HelpProvider>
        );
    };

    it('should return help context', async () => {
        localStorage.setItem('consultify-storage', JSON.stringify({
            state: { currentUser: { token: 'test-token' } }
        }));

        const wrapper = createWrapper();
        const { result } = renderHook(() => useHelp(), { wrapper });

        await waitFor(() => {
            expect(result.current).toBeDefined();
        });

        expect(result.current.playbooks).toBeDefined();
        expect(result.current.loading).toBeDefined();
        expect(result.current.refresh).toBeDefined();
    });

    it('should return playbooks', async () => {
        localStorage.setItem('consultify-storage', JSON.stringify({
            state: { currentUser: { token: 'test-token' } }
        }));

        const wrapper = createWrapper();
        const { result } = renderHook(() => useHelpPlaybooks(), { wrapper });

        await waitFor(() => {
            expect(result.current).toBeDefined();
        });

        expect(Array.isArray(result.current)).toBe(true);
    });

    it('should control help panel', async () => {
        localStorage.setItem('consultify-storage', JSON.stringify({
            state: { currentUser: { token: 'test-token' } }
        }));

        const wrapper = createWrapper();
        const { result } = renderHook(() => useHelpPanel(), { wrapper });

        await waitFor(() => {
            expect(result.current).toBeDefined();
        });

        expect(result.current.isPanelOpen).toBeDefined();
        expect(result.current.openPanel).toBeDefined();
        expect(result.current.closePanel).toBeDefined();

        result.current.openPanel();
        await waitFor(() => {
            expect(result.current.isPanelOpen).toBe(true);
        });

        result.current.closePanel();
        await waitFor(() => {
            expect(result.current.isPanelOpen).toBe(false);
        });
    });

    it('should refresh playbooks', async () => {
        localStorage.setItem('consultify-storage', JSON.stringify({
            state: { currentUser: { token: 'test-token' } }
        }));

        const wrapper = createWrapper();
        const { result } = renderHook(() => useHelp(), { wrapper });

        await waitFor(() => {
            expect(result.current.refresh).toBeDefined();
        });

        await result.current.refresh();

        expect(global.fetch).toHaveBeenCalled();
    });

    it('should get playbook by key', async () => {
        localStorage.setItem('consultify-storage', JSON.stringify({
            state: { currentUser: { token: 'test-token' } }
        }));

        vi.mocked(global.fetch).mockImplementation((url: any) => {
            if (url.includes('/api/help/playbooks/getting-started')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => mockPlaybooks[0]
                } as Response);
            }
            // Fallback for the initial fetch in useEffect
            if (url.includes('/api/help/playbooks')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ playbooks: mockPlaybooks })
                } as Response);
            }
            return Promise.resolve({ ok: false } as Response);
        });

        const wrapper = createWrapper();
        const { result } = renderHook(() => useHelp(), { wrapper });

        await waitFor(() => {
            expect(result.current.getPlaybook).toBeDefined();
        });

        const playbook = await result.current.getPlaybook('getting-started');

        expect(playbook).toBeDefined();
        expect(playbook?.key).toBe('getting-started');
    });

    it('should get help hint for feature', async () => {
        localStorage.setItem('consultify-storage', JSON.stringify({
            state: { currentUser: { token: 'test-token' } }
        }));

        const mockHint = {
            featureKey: 'advanced-analytics',
            isBlocked: false,
            isLimited: true,
            reason: 'Trial limitation',
            playbook: {
                key: 'upgrade-guide',
                title: 'Upgrade Guide',
                description: 'Learn how to upgrade'
            },
            suggestedAction: 'upgrade' as const
        };

        vi.mocked(global.fetch).mockImplementation((url: any) => {
            if (url.includes('/api/help/hint/advanced-analytics')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ hint: mockHint })
                } as Response);
            }
            // Fallback for the initial fetch via useEffect
            if (url.includes('/api/help/playbooks')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ playbooks: mockPlaybooks })
                } as Response);
            }
            return Promise.resolve({ ok: false } as Response);
        });

        const wrapper = createWrapper();
        const { result } = renderHook(() => useHelp(), { wrapper });

        await waitFor(() => {
            expect(result.current.getHelpHint).toBeDefined();
        });

        const hint = await result.current.getHelpHint('advanced-analytics');

        expect(hint).toBeDefined();
        expect(hint?.featureKey).toBe('advanced-analytics');
    });

    it('should throw error when used outside provider', () => {
        expect(() => {
            renderHook(() => useHelp());
        }).toThrow('useHelp must be used within HelpProvider');
    });

    it('should handle fetch errors', async () => {
        localStorage.setItem('consultify-storage', JSON.stringify({
            state: { currentUser: { token: 'test-token' } }
        }));

        vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

        const wrapper = createWrapper();
        const { result } = renderHook(() => useHelp(), { wrapper });

        await waitFor(() => {
            expect(result.current.error).toBeDefined();
        });
    });
});

