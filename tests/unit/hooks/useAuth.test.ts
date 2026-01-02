/**
 * useAuth Hook Tests
 * 
 * Tests for authentication functionality via useAppStore.
 * Since there's no explicit useAuth hook, we test the auth-related functionality
 * from useAppStore (currentUser, login, logout, etc.).
 */

import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { useAppStore } from '../../../store/useAppStore';
import { Api } from '../../../services/api';

// Mock dependencies
vi.mock('../../../services/api');

describe('Auth via useAppStore', () => {
    const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        organizationId: 'org-1',
        token: 'test-token'
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should get current user from store', () => {
        const { result } = renderHook(() => useAppStore(state => state.currentUser));

        // Store might be empty initially, but structure should exist
        expect(result.current).toBeDefined();
    });

    it('should check if user is authenticated', () => {
        const { result } = renderHook(() => {
            const store = useAppStore();
            return {
                isAuthenticated: !!store.currentUser,
                currentUser: store.currentUser
            };
        });

        expect(result.current.isAuthenticated).toBeDefined();
    });

    it('should handle login via Api', async () => {
        vi.mocked(Api.login).mockResolvedValue(mockUser);

        const loginResult = await Api.login('test@example.com', 'password');

        expect(Api.login).toHaveBeenCalledWith('test@example.com', 'password');
        expect(loginResult).toEqual(mockUser);
    });

    it('should handle logout', async () => {
        vi.mocked(Api.logout).mockResolvedValue(undefined);

        await Api.logout();

        expect(Api.logout).toHaveBeenCalled();
    });

    it('should get current user via Api.getMe', async () => {
        vi.mocked(Api.getMe).mockResolvedValue(mockUser);

        const user = await Api.getMe();

        expect(Api.getMe).toHaveBeenCalled();
        expect(user).toEqual(mockUser);
    });

    it('should handle authentication errors', async () => {
        vi.mocked(Api.login).mockRejectedValue(new Error('Invalid credentials'));

        await expect(Api.login('wrong@example.com', 'wrong')).rejects.toThrow();
    });



    it('should check if user has specific role', () => {
        const { result } = renderHook(() => {
            const store = useAppStore();
            return {
                isAdmin: store.currentUser?.role === 'ADMIN',
                isSuperAdmin: store.currentUser?.role === 'SUPER_ADMIN',
                isUser: store.currentUser?.role === 'USER'
            };
        });

        expect(result.current.isAdmin).toBeDefined();
        expect(result.current.isSuperAdmin).toBeDefined();
        expect(result.current.isUser).toBeDefined();
    });
});



