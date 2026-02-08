/**
 * Professional API Mock Factory
 *
 * Enterprise-grade API mocking system for consistent HTTP testing
 */
import { vi } from 'vitest';

// ============================================================================
// Types
// ============================================================================

export interface MockResponse<T = unknown> {
    data: T;
    status: number;
    headers?: Record<string, string>;
    delay?: number;
}

export interface MockError {
    status: number;
    message: string;
    code?: string;
    details?: Record<string, unknown>;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface MockEndpoint {
    method: HttpMethod;
    path: string | RegExp;
    response: MockResponse | MockError | ((req: MockRequest) => MockResponse | MockError);
}

interface MockRequest {
    method: HttpMethod;
    path: string;
    body?: unknown;
    query?: Record<string, string>;
    headers?: Record<string, string>;
}

// ============================================================================
// API Mock Factory
// ============================================================================

export class ApiMockFactory {
    private endpoints: MockEndpoint[] = [];
    private calls: MockRequest[] = [];

    /**
     * Register a mock endpoint
     */
    on(
        method: HttpMethod,
        path: string | RegExp,
        response: MockResponse | MockError | ((req: MockRequest) => MockResponse | MockError)
    ): this {
        this.endpoints.push({ method, path, response });
        return this;
    }

    /**
     * Shorthand methods
     */
    get(path: string | RegExp, response: MockResponse): this {
        return this.on('GET', path, response);
    }

    post(path: string | RegExp, response: MockResponse): this {
        return this.on('POST', path, response);
    }

    put(path: string | RegExp, response: MockResponse): this {
        return this.on('PUT', path, response);
    }

    patch(path: string | RegExp, response: MockResponse): this {
        return this.on('PATCH', path, response);
    }

    delete(path: string | RegExp, response: MockResponse): this {
        return this.on('DELETE', path, response);
    }

    /**
     * Get all recorded calls
     */
    getCalls(): MockRequest[] {
        return [...this.calls];
    }

    /**
     * Get calls to a specific endpoint
     */
    getCallsTo(method: HttpMethod, path: string): MockRequest[] {
        return this.calls.filter((c) => c.method === method && c.path === path);
    }

    /**
     * Assert endpoint was called
     */
    assertCalled(method: HttpMethod, path: string, times?: number): void {
        const calls = this.getCallsTo(method, path);
        if (times !== undefined) {
            if (calls.length !== times) {
                throw new Error(
                    `Expected ${method} ${path} to be called ${times} times, but was called ${calls.length} times`
                );
            }
        } else if (calls.length === 0) {
            throw new Error(`Expected ${method} ${path} to be called, but was never called`);
        }
    }

    /**
     * Reset all mocks and calls
     */
    reset(): void {
        this.endpoints = [];
        this.calls = [];
    }

    /**
     * Create mock fetch function
     */
    createMockFetch(): typeof fetch {
        const self = this;

        return vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
            const url = typeof input === 'string' ? input : input.toString();
            const method = (init?.method?.toUpperCase() || 'GET') as HttpMethod;
            const path = new URL(url, 'http://localhost').pathname;
            const query = Object.fromEntries(new URL(url, 'http://localhost').searchParams);

            let body: unknown;
            if (init?.body) {
                try {
                    body = JSON.parse(init.body as string);
                } catch {
                    body = init.body;
                }
            }

            const request: MockRequest = {
                method,
                path,
                body,
                query,
                headers: init?.headers as Record<string, string>,
            };

            self.calls.push(request);

            // Find matching endpoint
            const endpoint = self.endpoints.find((e) => {
                if (e.method !== method) return false;
                if (typeof e.path === 'string') return e.path === path;
                return e.path.test(path);
            });

            if (!endpoint) {
                return new Response(JSON.stringify({ error: 'Not Found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            const response =
                typeof endpoint.response === 'function'
                    ? endpoint.response(request)
                    : endpoint.response;

            if (response.delay) {
                await new Promise((r) => setTimeout(r, response.delay));
            }

            if ('message' in response) {
                // Error response
                return new Response(
                    JSON.stringify({
                        error: response.message,
                        code: response.code,
                        details: response.details,
                    }),
                    {
                        status: response.status,
                        headers: { 'Content-Type': 'application/json' },
                    }
                );
            }

            return new Response(JSON.stringify(response.data), {
                status: response.status,
                headers: {
                    'Content-Type': 'application/json',
                    ...response.headers,
                },
            });
        }) as typeof fetch;
    }
}

// ============================================================================
// Common API Response Builders
// ============================================================================

export const ApiResponses = {
    success: <T>(data: T, status = 200): MockResponse<T> => ({
        data,
        status,
    }),

    created: <T>(data: T): MockResponse<T> => ({
        data,
        status: 201,
    }),

    noContent: (): MockResponse<null> => ({
        data: null,
        status: 204,
    }),

    paginated: <T>(
        items: T[],
        options: { page?: number; limit?: number; total?: number } = {}
    ): MockResponse => ({
        data: {
            items,
            pagination: {
                page: options.page ?? 1,
                limit: options.limit ?? 20,
                total: options.total ?? items.length,
                totalPages: Math.ceil((options.total ?? items.length) / (options.limit ?? 20)),
            },
        },
        status: 200,
    }),

    error: (status: number, message: string, code?: string): MockError => ({
        status,
        message,
        code,
    }),

    badRequest: (message = 'Bad Request', code?: string): MockError =>
        ApiResponses.error(400, message, code),

    unauthorized: (message = 'Unauthorized'): MockError =>
        ApiResponses.error(401, message, 'UNAUTHORIZED'),

    forbidden: (message = 'Forbidden'): MockError =>
        ApiResponses.error(403, message, 'FORBIDDEN'),

    notFound: (message = 'Not Found'): MockError =>
        ApiResponses.error(404, message, 'NOT_FOUND'),

    conflict: (message = 'Conflict'): MockError =>
        ApiResponses.error(409, message, 'CONFLICT'),

    validationError: (errors: Record<string, string[]>): MockError => ({
        status: 422,
        message: 'Validation Error',
        code: 'VALIDATION_ERROR',
        details: { errors },
    }),

    serverError: (message = 'Internal Server Error'): MockError =>
        ApiResponses.error(500, message, 'INTERNAL_ERROR'),

    withDelay: <T>(response: MockResponse<T>, delay: number): MockResponse<T> => ({
        ...response,
        delay,
    }),
};

// ============================================================================
// Factory Instance
// ============================================================================

export function createApiMock(): ApiMockFactory {
    return new ApiMockFactory();
}

// ============================================================================
// Common Endpoint Presets
// ============================================================================

export function setupAuthMocks(mock: ApiMockFactory): void {
    mock
        .post('/api/auth/login', ApiResponses.success({ token: 'mock-jwt-token', user: { id: 'usr-001' } }))
        .post('/api/auth/logout', ApiResponses.noContent())
        .post('/api/auth/refresh', ApiResponses.success({ token: 'new-mock-jwt-token' }))
        .get('/api/auth/me', ApiResponses.success({ id: 'usr-001', email: 'user@example.com' }));
}

export function setupCrudMocks<T>(
    mock: ApiMockFactory,
    basePath: string,
    items: T[],
    idField = 'id'
): void {
    mock
        .get(basePath, ApiResponses.paginated(items))
        .get(new RegExp(`${basePath}/[^/]+$`), (req) => {
            const id = req.path.split('/').pop();
            const item = items.find((i) => (i as Record<string, unknown>)[idField] === id);
            return item ? ApiResponses.success(item) : ApiResponses.notFound();
        })
        .post(basePath, (req) => {
            const newItem = { ...req.body, [idField]: `new-${Date.now()}` };
            return ApiResponses.created(newItem);
        })
        .put(new RegExp(`${basePath}/[^/]+$`), (req) => {
            return ApiResponses.success(req.body);
        })
        .delete(new RegExp(`${basePath}/[^/]+$`), ApiResponses.noContent());
}
