/**
 * REST Client Tests
 * Tests for REST API client patterns
 * 
 * @module tests/rest/rest-client.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// REST client implementation
const createRESTClient = (baseURL, options = {}) => {
    const { headers = {}, timeout = 30000 } = options;
    const interceptors = { request: [], response: [] };

    // Mock fetch
    let mockFetch = vi.fn();

    const buildURL = (path, params = {}) => {
        const url = new URL(path, baseURL);
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                if (Array.isArray(value)) {
                    value.forEach(v => url.searchParams.append(key, v));
                } else {
                    url.searchParams.append(key, value);
                }
            }
        });
        return url.toString();
    };

    const request = async (method, path, options = {}) => {
        const { params, body, headers: customHeaders } = options;

        let config = {
            method,
            url: buildURL(path, params),
            headers: { ...headers, ...customHeaders },
            body: body ? JSON.stringify(body) : undefined,
        };

        // Apply request interceptors
        for (const interceptor of interceptors.request) {
            config = await interceptor(config);
        }

        // Execute request
        let response = await mockFetch(config.url, {
            method: config.method,
            headers: config.headers,
            body: config.body,
        });

        // Apply response interceptors
        for (const interceptor of interceptors.response) {
            response = await interceptor(response);
        }

        if (!response.ok) {
            const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
            error.status = response.status;
            error.response = response;
            throw error;
        }

        return response.data;
    };

    return {
        get: (path, params, options) => request('GET', path, { ...options, params }),
        post: (path, body, options) => request('POST', path, { ...options, body }),
        put: (path, body, options) => request('PUT', path, { ...options, body }),
        patch: (path, body, options) => request('PATCH', path, { ...options, body }),
        delete: (path, options) => request('DELETE', path, options),

        addRequestInterceptor: (interceptor) => {
            interceptors.request.push(interceptor);
            return () => {
                const index = interceptors.request.indexOf(interceptor);
                if (index !== -1) interceptors.request.splice(index, 1);
            };
        },

        addResponseInterceptor: (interceptor) => {
            interceptors.response.push(interceptor);
            return () => {
                const index = interceptors.response.indexOf(interceptor);
                if (index !== -1) interceptors.response.splice(index, 1);
            };
        },

        setHeader: (key, value) => {
            headers[key] = value;
        },

        removeHeader: (key) => {
            delete headers[key];
        },

        _setMockFetch: (fn) => {
            mockFetch = fn;
        },
    };
};

// Resource factory for CRUD operations
const createResource = (client, basePath) => {
    return {
        list: (params) => client.get(basePath, params),
        get: (id, params) => client.get(`${basePath}/${id}`, params),
        create: (data) => client.post(basePath, data),
        update: (id, data) => client.put(`${basePath}/${id}`, data),
        patch: (id, data) => client.patch(`${basePath}/${id}`, data),
        delete: (id) => client.delete(`${basePath}/${id}`),

        // Nested resource
        nested: (id, nestedPath) => createResource(client, `${basePath}/${id}/${nestedPath}`),

        // Custom actions
        action: (id, action, data) => client.post(`${basePath}/${id}/${action}`, data),
    };
};

// Request builder
const createRequestBuilder = () => {
    let config = {
        method: 'GET',
        path: '',
        params: {},
        headers: {},
        body: null,
    };

    const builder = {
        get: (path) => {
            config.method = 'GET';
            config.path = path;
            return builder;
        },

        post: (path) => {
            config.method = 'POST';
            config.path = path;
            return builder;
        },

        put: (path) => {
            config.method = 'PUT';
            config.path = path;
            return builder;
        },

        patch: (path) => {
            config.method = 'PATCH';
            config.path = path;
            return builder;
        },

        delete: (path) => {
            config.method = 'DELETE';
            config.path = path;
            return builder;
        },

        param: (key, value) => {
            config.params[key] = value;
            return builder;
        },

        params: (params) => {
            Object.assign(config.params, params);
            return builder;
        },

        header: (key, value) => {
            config.headers[key] = value;
            return builder;
        },

        headers: (headers) => {
            Object.assign(config.headers, headers);
            return builder;
        },

        body: (data) => {
            config.body = data;
            return builder;
        },

        json: (data) => {
            config.body = data;
            config.headers['Content-Type'] = 'application/json';
            return builder;
        },

        formData: (data) => {
            config.body = data;
            config.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            return builder;
        },

        auth: (token, type = 'Bearer') => {
            config.headers['Authorization'] = `${type} ${token}`;
            return builder;
        },

        build: () => ({ ...config }),

        execute: async (client) => {
            const { method, path, params, headers, body } = config;

            switch (method) {
                case 'GET':
                    return client.get(path, params, { headers });
                case 'POST':
                    return client.post(path, body, { headers, params });
                case 'PUT':
                    return client.put(path, body, { headers, params });
                case 'PATCH':
                    return client.patch(path, body, { headers, params });
                case 'DELETE':
                    return client.delete(path, { headers, params });
            }
        },

        reset: () => {
            config = {
                method: 'GET',
                path: '',
                params: {},
                headers: {},
                body: null,
            };
            return builder;
        },
    };

    return builder;
};

describe('REST Client Tests', () => {
    let client;
    let mockFetch;

    beforeEach(() => {
        client = createRESTClient('https://api.example.com');
        mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            data: {},
        });
        client._setMockFetch(mockFetch);
    });

    // ═══════════════════════════════════════════════════════════════════
    // HTTP METHODS
    // ═══════════════════════════════════════════════════════════════════

    describe('HTTP Methods', () => {
        it('should make GET request', async () => {
            mockFetch.mockResolvedValue({ ok: true, data: { users: [] } });

            const result = await client.get('/users');

            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.example.com/users',
                expect.objectContaining({ method: 'GET' })
            );
            expect(result.users).toEqual([]);
        });

        it('should make GET request with params', async () => {
            await client.get('/users', { page: 1, limit: 10 });

            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.example.com/users?page=1&limit=10',
                expect.any(Object)
            );
        });

        it('should make POST request', async () => {
            await client.post('/users', { name: 'John' });

            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.example.com/users',
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ name: 'John' }),
                })
            );
        });

        it('should make PUT request', async () => {
            await client.put('/users/1', { name: 'Jane' });

            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.example.com/users/1',
                expect.objectContaining({ method: 'PUT' })
            );
        });

        it('should make PATCH request', async () => {
            await client.patch('/users/1', { email: 'test@example.com' });

            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.example.com/users/1',
                expect.objectContaining({ method: 'PATCH' })
            );
        });

        it('should make DELETE request', async () => {
            await client.delete('/users/1');

            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.example.com/users/1',
                expect.objectContaining({ method: 'DELETE' })
            );
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // ERROR HANDLING
    // ═══════════════════════════════════════════════════════════════════

    describe('Error Handling', () => {
        it('should throw on error response', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 404,
                statusText: 'Not Found',
            });

            await expect(client.get('/users/999')).rejects.toThrow('HTTP 404');
        });

        it('should include status in error', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
            });

            try {
                await client.get('/error');
            } catch (error) {
                expect(error.status).toBe(500);
            }
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // INTERCEPTORS
    // ═══════════════════════════════════════════════════════════════════

    describe('Interceptors', () => {
        it('should apply request interceptor', async () => {
            client.addRequestInterceptor((config) => ({
                ...config,
                headers: { ...config.headers, 'X-Custom': 'value' },
            }));

            await client.get('/test');

            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({ 'X-Custom': 'value' }),
                })
            );
        });

        it('should apply response interceptor', async () => {
            client.addResponseInterceptor((response) => ({
                ...response,
                data: { ...response.data, intercepted: true },
            }));

            const result = await client.get('/test');

            expect(result.intercepted).toBe(true);
        });

        it('should remove interceptor', async () => {
            const interceptor = vi.fn((config) => config);
            const remove = client.addRequestInterceptor(interceptor);

            remove();
            await client.get('/test');

            expect(interceptor).not.toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // HEADERS
    // ═══════════════════════════════════════════════════════════════════

    describe('Headers', () => {
        it('should set header', async () => {
            client.setHeader('Authorization', 'Bearer token');
            await client.get('/test');

            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({ 'Authorization': 'Bearer token' }),
                })
            );
        });
    });
});

describe('Resource Tests', () => {
    let client;
    let mockFetch;
    let resource;

    beforeEach(() => {
        client = createRESTClient('https://api.example.com');
        mockFetch = vi.fn().mockResolvedValue({ ok: true, data: {} });
        client._setMockFetch(mockFetch);
        resource = createResource(client, '/users');
    });

    it('should list resources', async () => {
        await resource.list({ page: 1 });

        expect(mockFetch).toHaveBeenCalledWith(
            'https://api.example.com/users?page=1',
            expect.objectContaining({ method: 'GET' })
        );
    });

    it('should get single resource', async () => {
        await resource.get('1');

        expect(mockFetch).toHaveBeenCalledWith(
            'https://api.example.com/users/1',
            expect.objectContaining({ method: 'GET' })
        );
    });

    it('should create resource', async () => {
        await resource.create({ name: 'John' });

        expect(mockFetch).toHaveBeenCalledWith(
            'https://api.example.com/users',
            expect.objectContaining({ method: 'POST' })
        );
    });

    it('should update resource', async () => {
        await resource.update('1', { name: 'Jane' });

        expect(mockFetch).toHaveBeenCalledWith(
            'https://api.example.com/users/1',
            expect.objectContaining({ method: 'PUT' })
        );
    });

    it('should delete resource', async () => {
        await resource.delete('1');

        expect(mockFetch).toHaveBeenCalledWith(
            'https://api.example.com/users/1',
            expect.objectContaining({ method: 'DELETE' })
        );
    });

    it('should handle nested resources', async () => {
        const postsResource = resource.nested('1', 'posts');
        await postsResource.list();

        expect(mockFetch).toHaveBeenCalledWith(
            'https://api.example.com/users/1/posts',
            expect.any(Object)
        );
    });

    it('should call custom action', async () => {
        await resource.action('1', 'activate', { reason: 'test' });

        expect(mockFetch).toHaveBeenCalledWith(
            'https://api.example.com/users/1/activate',
            expect.objectContaining({ method: 'POST' })
        );
    });
});

describe('Request Builder Tests', () => {
    let builder;

    beforeEach(() => {
        builder = createRequestBuilder();
    });

    it('should build GET request', () => {
        const config = builder
            .get('/users')
            .param('page', 1)
            .build();

        expect(config.method).toBe('GET');
        expect(config.path).toBe('/users');
        expect(config.params.page).toBe(1);
    });

    it('should build POST request with body', () => {
        const config = builder
            .post('/users')
            .json({ name: 'John' })
            .build();

        expect(config.method).toBe('POST');
        expect(config.body).toEqual({ name: 'John' });
        expect(config.headers['Content-Type']).toBe('application/json');
    });

    it('should add auth header', () => {
        const config = builder
            .get('/profile')
            .auth('my-token')
            .build();

        expect(config.headers['Authorization']).toBe('Bearer my-token');
    });

    it('should chain multiple params', () => {
        const config = builder
            .get('/search')
            .param('q', 'test')
            .param('page', 1)
            .params({ limit: 20, sort: 'name' })
            .build();

        expect(config.params).toEqual({ q: 'test', page: 1, limit: 20, sort: 'name' });
    });
});
