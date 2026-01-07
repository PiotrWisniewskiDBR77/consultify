/**
 * API Service Tests
 * Tests for the API service layer
 * 
 * @module tests/services/api-service.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fetch
global.fetch = vi.fn();

// Create mock API service
const createApiService = (baseUrl = '/api') => {
    const defaultHeaders = {
        'Content-Type': 'application/json',
    };

    let authToken = null;

    const request = async (method, endpoint, data = null, options = {}) => {
        const url = `${baseUrl}${endpoint}`;
        const headers = { ...defaultHeaders, ...options.headers };

        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        const config = {
            method,
            headers,
        };

        if (data && method !== 'GET') {
            config.body = JSON.stringify(data);
        }

        const response = await fetch(url, config);

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Request failed' }));
            throw new Error(error.message || error.error || 'Request failed');
        }

        return response.json();
    };

    return {
        setAuthToken: (token) => {
            authToken = token;
        },
        clearAuthToken: () => {
            authToken = null;
        },
        get: (endpoint, options) => request('GET', endpoint, null, options),
        post: (endpoint, data, options) => request('POST', endpoint, data, options),
        put: (endpoint, data, options) => request('PUT', endpoint, data, options),
        patch: (endpoint, data, options) => request('PATCH', endpoint, data, options),
        delete: (endpoint, options) => request('DELETE', endpoint, null, options),
    };
};

describe('API Service Tests', () => {
    let apiService;

    beforeEach(() => {
        vi.clearAllMocks();
        apiService = createApiService();
    });

    // ═══════════════════════════════════════════════════════════════════
    // GET REQUESTS
    // ═══════════════════════════════════════════════════════════════════

    describe('GET Requests', () => {
        it('should make GET request', async () => {
            fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ success: true, data: [] }),
            });

            const result = await apiService.get('/users');

            expect(fetch).toHaveBeenCalledWith('/api/users', expect.objectContaining({
                method: 'GET',
            }));
            expect(result).toEqual({ success: true, data: [] });
        });

        it('should include content-type header', async () => {
            fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({}),
            });

            await apiService.get('/users');

            expect(fetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json',
                    }),
                })
            );
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // POST REQUESTS
    // ═══════════════════════════════════════════════════════════════════

    describe('POST Requests', () => {
        it('should make POST request with body', async () => {
            fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ success: true }),
            });

            const data = { name: 'Test' };
            await apiService.post('/users', data);

            expect(fetch).toHaveBeenCalledWith('/api/users', expect.objectContaining({
                method: 'POST',
                body: JSON.stringify(data),
            }));
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // PUT REQUESTS
    // ═══════════════════════════════════════════════════════════════════

    describe('PUT Requests', () => {
        it('should make PUT request', async () => {
            fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ success: true }),
            });

            await apiService.put('/users/1', { name: 'Updated' });

            expect(fetch).toHaveBeenCalledWith('/api/users/1', expect.objectContaining({
                method: 'PUT',
            }));
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // PATCH REQUESTS
    // ═══════════════════════════════════════════════════════════════════

    describe('PATCH Requests', () => {
        it('should make PATCH request', async () => {
            fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ success: true }),
            });

            await apiService.patch('/users/1', { status: 'active' });

            expect(fetch).toHaveBeenCalledWith('/api/users/1', expect.objectContaining({
                method: 'PATCH',
            }));
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // DELETE REQUESTS
    // ═══════════════════════════════════════════════════════════════════

    describe('DELETE Requests', () => {
        it('should make DELETE request', async () => {
            fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ success: true }),
            });

            await apiService.delete('/users/1');

            expect(fetch).toHaveBeenCalledWith('/api/users/1', expect.objectContaining({
                method: 'DELETE',
            }));
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // AUTHENTICATION
    // ═══════════════════════════════════════════════════════════════════

    describe('Authentication', () => {
        it('should include auth token when set', async () => {
            fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({}),
            });

            apiService.setAuthToken('test-token');
            await apiService.get('/protected');

            expect(fetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer test-token',
                    }),
                })
            );
        });

        it('should not include auth token when cleared', async () => {
            fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({}),
            });

            apiService.setAuthToken('test-token');
            apiService.clearAuthToken();
            await apiService.get('/public');

            expect(fetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.not.objectContaining({
                        'Authorization': expect.any(String),
                    }),
                })
            );
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // ERROR HANDLING
    // ═══════════════════════════════════════════════════════════════════

    describe('Error Handling', () => {
        it('should throw error on failed request', async () => {
            fetch.mockResolvedValueOnce({
                ok: false,
                json: () => Promise.resolve({ error: 'Not found' }),
            });

            await expect(apiService.get('/nonexistent'))
                .rejects.toThrow('Not found');
        });

        it('should handle network errors', async () => {
            fetch.mockRejectedValueOnce(new Error('Network error'));

            await expect(apiService.get('/users'))
                .rejects.toThrow('Network error');
        });

        it('should handle JSON parse errors gracefully', async () => {
            fetch.mockResolvedValueOnce({
                ok: false,
                json: () => Promise.reject(new Error('Invalid JSON')),
            });

            await expect(apiService.get('/bad'))
                .rejects.toThrow('Request failed');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // CUSTOM OPTIONS
    // ═══════════════════════════════════════════════════════════════════

    describe('Custom Options', () => {
        it('should merge custom headers', async () => {
            fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({}),
            });

            await apiService.get('/users', {
                headers: { 'X-Custom-Header': 'value' },
            });

            expect(fetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'X-Custom-Header': 'value',
                    }),
                })
            );
        });
    });
});
