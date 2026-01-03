import { User, SessionMode } from '../../types';
import { tokenService } from '../tokenService';
import { API_URL, fetchWithRetry, handleResponse, getHeaders } from '../apiUtils';
import { UserSchema } from '../../schemas/user.schema';

export const AuthService = {
    login: async (email: string, password: string): Promise<User> => {
        console.log('AuthService.login called:', { email, url: `${API_URL}/auth/login` });
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await handleResponse(res, 'Login failed');
        tokenService.saveTokens(data.token, data.refreshToken);

        // ENTERPRISE HARDENING: Validate response against schema
        return UserSchema.parse(data.user) as User;
    },

    register: async (userData: any): Promise<User | any> => {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        const data = await handleResponse(res, 'Registration failed');
        if (data.status === 'pending') return data;
        tokenService.saveTokens(data.token, data.refreshToken);
        return UserSchema.parse(data.user) as User;
    },

    demoLogin: async (): Promise<User & { isDemo: boolean }> => {
        console.log('AuthService.demoLogin called');
        const res = await fetch(`${API_URL}/auth/demo-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await handleResponse(res, 'Demo login failed');
        tokenService.saveTokens(data.token, data.refreshToken);
        sessionStorage.setItem('isDemo', 'true');
        return { ...(UserSchema.parse(data.user) as User), isDemo: true };
    },

    isDemoSession: (): boolean => {
        return sessionStorage.getItem('isDemo') === 'true';
    },

    clearDemoSession: (): void => {
        sessionStorage.removeItem('isDemo');
    },

    logout: async (): Promise<void> => {
        try {
            await fetch(`${API_URL}/auth/logout`, {
                method: 'POST',
                headers: getHeaders()
            });
        } catch (error) {
            console.warn('Logout API call failed, clearing token anyway:', error);
        }
        tokenService.clearTokens();
    },

    getMe: async (): Promise<User | null> => {
        const res = await fetch(`${API_URL}/auth/me`, { headers: getHeaders() });
        if (!res.ok) return null;
        const data = await res.json();
        return UserSchema.parse(data.user) as User;
    },

    validateAccessCode: async (code: string): Promise<any> => {
        const res = await fetch(`${API_URL}/auth/access-code/validate`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ code })
        });
        return handleResponse(res, 'Failed to validate access code');
    },

    acceptAccessCode: async (code: string): Promise<any> => {
        const res = await fetch(`${API_URL}/auth/access-code/accept`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ code })
        });
        return handleResponse(res, 'Failed to accept access code');
    },

    changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/auth/change-password`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ currentPassword, newPassword })
        });
        return handleResponse(res, 'Failed to change password');
    },

    getActiveSessions: async (): Promise<{ sessions: any[] }> => {
        const res = await fetchWithRetry(`${API_URL}/auth/sessions`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch sessions');
    },

    getLoginHistory: async (): Promise<any[]> => {
        const res = await fetchWithRetry(`${API_URL}/auth/login-history`, {
            headers: getHeaders()
        });
        const data = await handleResponse(res, 'Failed to fetch login history');
        return data.data || [];
    },

    revokeSession: async (sessionId: string): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/auth/sessions/${sessionId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to revoke session');
    },

    revokeAllSessions: async (): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/auth/sessions/revoke-all`, {
            method: 'POST',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to revoke all sessions');
    },

    resendVerificationEmail: async (): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/auth/resend-verification`, {
            method: 'POST',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to send verification email');
    },

    verifyEmail: async (token: string): Promise<{ success: boolean }> => {
        const res = await fetch(`${API_URL}/auth/verify-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        return handleResponse(res, 'Email verification failed');
    },

    resetPassword: async (email: string): Promise<void> => {
        const res = await fetch(`${API_URL}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        return handleResponse(res, 'Failed to reset password');
    },

    revertImpersonation: async (): Promise<{ token: string }> => {
        const res = await fetch(`${API_URL}/auth/revert-impersonation`, {
            method: 'POST',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to revert impersonation');
    }
};
