import { User } from '../../types';
import { API_URL, getHeaders, handleResponse } from '../apiUtils';

export const AuthService = {
  // Login
  login: async (email: string, password: string): Promise<{ user: User; token: string }> => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Login failed');
    return json;
  },

  // Register
  register: async (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<{ user: User; token: string }> => {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Registration failed');
    return json;
  },

  // Logout
  logout: async (): Promise<void> => {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: getHeaders(),
    });
  },

  // Get current user
  getCurrentUser: async (): Promise<User> => {
    const res = await fetch(`${API_URL}/auth/me`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get user');
  },

  // Refresh token
  refreshToken: async (refreshToken: string): Promise<{ token: string }> => {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Token refresh failed');
    return json;
  },

  // Request password reset
  requestPasswordReset: async (email: string): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to request password reset');
    return json;
  },

  // Reset password with token
  resetPassword: async (token: string, newPassword: string): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to reset password');
    return json;
  },
};
