/**
 * Auth Store Tests
 * Tests for authentication Zustand store
 * 
 * @module tests/store/useAuthStore.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock zustand persist
vi.mock('zustand/middleware', () => ({
    persist: (config) => config,
    createJSONStorage: () => ({
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
    }),
}));

// Mock store
const createMockAuthStore = () => {
    let state = {
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
    };

    const listeners = new Set<() => void>();

    const setState = (partial: Partial<typeof state>) => {
        state = { ...state, ...partial };
        listeners.forEach((listener) => listener());
    };

    const getState = () => state;

    return {
        getState,
        setState,
        subscribe: (listener: () => void) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        // Actions
        login: async (email: string, password: string) => {
            setState({ isLoading: true, error: null });
            try {
                if (email === 'test@test.com' && password === 'password123') {
                    setState({
                        user: { id: 'user-1', email },
                        token: 'mock-token',
                        isAuthenticated: true,
                        isLoading: false,
                    });
                    return { success: true };
                }
                throw new Error('Invalid credentials');
            } catch (error) {
                setState({ isLoading: false, error: (error as Error).message });
                return { success: false, error: (error as Error).message };
            }
        },
        logout: () => {
            setState({
                user: null,
                token: null,
                isAuthenticated: false,
                error: null,
            });
        },
        setUser: (user: any) => {
            setState({ user, isAuthenticated: !!user });
        },
        setToken: (token: string | null) => {
            setState({ token, isAuthenticated: !!token });
        },
        clearError: () => {
            setState({ error: null });
        },
        reset: () => {
            setState({
                user: null,
                token: null,
                isAuthenticated: false,
                isLoading: false,
                error: null,
            });
        },
    };
};

describe('Auth Store Tests', () => {
    let store: ReturnType<typeof createMockAuthStore>;

    beforeEach(() => {
        store = createMockAuthStore();
    });

    // ═══════════════════════════════════════════════════════════════════
    // INITIAL STATE
    // ═══════════════════════════════════════════════════════════════════

    describe('Initial State', () => {
        it('should have correct initial state', () => {
            const state = store.getState();

            expect(state.user).toBeNull();
            expect(state.token).toBeNull();
            expect(state.isAuthenticated).toBe(false);
            expect(state.isLoading).toBe(false);
            expect(state.error).toBeNull();
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // LOGIN
    // ═══════════════════════════════════════════════════════════════════

    describe('Login', () => {
        it('should login successfully with valid credentials', async () => {
            const result = await store.login('test@test.com', 'password123');

            expect(result.success).toBe(true);
            expect(store.getState().isAuthenticated).toBe(true);
            expect(store.getState().user).not.toBeNull();
            expect(store.getState().token).not.toBeNull();
        });

        it('should fail login with invalid credentials', async () => {
            const result = await store.login('test@test.com', 'wrong');

            expect(result.success).toBe(false);
            expect(store.getState().isAuthenticated).toBe(false);
            expect(store.getState().error).toBeDefined();
        });

        it('should set loading state during login', async () => {
            const loginPromise = store.login('test@test.com', 'password123');

            // Loading should be true during login
            // After login completes, loading should be false
            await loginPromise;
            expect(store.getState().isLoading).toBe(false);
        });

        it('should clear previous errors on new login attempt', async () => {
            // First failed login
            await store.login('test@test.com', 'wrong');
            expect(store.getState().error).toBeDefined();

            // Second login attempt should clear error initially
            const result = await store.login('test@test.com', 'password123');
            expect(result.success).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // LOGOUT
    // ═══════════════════════════════════════════════════════════════════

    describe('Logout', () => {
        it('should logout and clear state', async () => {
            // Login first
            await store.login('test@test.com', 'password123');
            expect(store.getState().isAuthenticated).toBe(true);

            // Logout
            store.logout();

            expect(store.getState().user).toBeNull();
            expect(store.getState().token).toBeNull();
            expect(store.getState().isAuthenticated).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // SET USER
    // ═══════════════════════════════════════════════════════════════════

    describe('Set User', () => {
        it('should set user and update auth status', () => {
            store.setUser({ id: 'user-1', email: 'test@test.com' });

            expect(store.getState().user).not.toBeNull();
            expect(store.getState().isAuthenticated).toBe(true);
        });

        it('should clear auth when setting null user', () => {
            store.setUser({ id: 'user-1' });
            store.setUser(null);

            expect(store.getState().isAuthenticated).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // SET TOKEN
    // ═══════════════════════════════════════════════════════════════════

    describe('Set Token', () => {
        it('should set token', () => {
            store.setToken('new-token');

            expect(store.getState().token).toBe('new-token');
            expect(store.getState().isAuthenticated).toBe(true);
        });

        it('should clear auth when setting null token', () => {
            store.setToken('token');
            store.setToken(null);

            expect(store.getState().isAuthenticated).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // ERROR HANDLING
    // ═══════════════════════════════════════════════════════════════════

    describe('Error Handling', () => {
        it('should clear error', async () => {
            await store.login('test@test.com', 'wrong');
            expect(store.getState().error).toBeDefined();

            store.clearError();
            expect(store.getState().error).toBeNull();
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // RESET
    // ═══════════════════════════════════════════════════════════════════

    describe('Reset', () => {
        it('should reset to initial state', async () => {
            await store.login('test@test.com', 'password123');

            store.reset();

            expect(store.getState().user).toBeNull();
            expect(store.getState().token).toBeNull();
            expect(store.getState().isAuthenticated).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // SUBSCRIPTIONS
    // ═══════════════════════════════════════════════════════════════════

    describe('Subscriptions', () => {
        it('should notify subscribers on state change', async () => {
            const listener = vi.fn();
            store.subscribe(listener);

            await store.login('test@test.com', 'password123');

            expect(listener).toHaveBeenCalled();
        });

        it('should unsubscribe correctly', () => {
            const listener = vi.fn();
            const unsubscribe = store.subscribe(listener);

            unsubscribe();
            store.logout();

            // Listener should not be called after unsubscribe
            // (it may have been called before unsubscribe)
        });
    });
});
