/**
 * GraphQL Client Tests
 * Tests for GraphQL query/mutation handling
 * 
 * @module tests/graphql/graphql-client.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// GraphQL client implementation
const createGraphQLClient = (endpoint, options = {}) => {
    const { headers = {}, cache = true } = options;
    const queryCache = new Map();
    const middleware = [];

    const executeRequest = async (query, variables, operationType) => {
        const body = JSON.stringify({ query, variables });

        // Check cache for queries
        if (cache && operationType === 'query') {
            const cacheKey = body;
            if (queryCache.has(cacheKey)) {
                return queryCache.get(cacheKey);
            }
        }

        // Apply middleware
        let context = { query, variables, headers: { ...headers } };
        for (const fn of middleware) {
            context = await fn(context) || context;
        }

        // Mock fetch for testing
        const response = await mockFetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...context.headers,
            },
            body,
        });

        if (response.errors) {
            const error = new Error(response.errors[0]?.message || 'GraphQL Error');
            error.errors = response.errors;
            throw error;
        }

        // Cache query results
        if (cache && operationType === 'query') {
            queryCache.set(body, response.data);
        }

        return response.data;
    };

    // Mock fetch for testing
    let mockFetch = vi.fn().mockResolvedValue({ data: {} });

    return {
        query: (query, variables = {}) => {
            return executeRequest(query, variables, 'query');
        },

        mutate: (mutation, variables = {}) => {
            return executeRequest(mutation, variables, 'mutation');
        },

        subscribe: (subscription, variables = {}, callbacks = {}) => {
            const { onData, onError, onComplete } = callbacks;
            let active = true;

            // Simulate subscription
            const interval = setInterval(() => {
                if (!active) return;

                try {
                    onData?.({ data: { timestamp: Date.now() } });
                } catch (error) {
                    onError?.(error);
                }
            }, 1000);

            return {
                unsubscribe: () => {
                    active = false;
                    clearInterval(interval);
                    onComplete?.();
                },
            };
        },

        use: (middlewareFn) => {
            middleware.push(middlewareFn);
            return this;
        },

        clearCache: () => {
            queryCache.clear();
        },

        setHeader: (key, value) => {
            headers[key] = value;
        },

        // For testing
        _setMockFetch: (fn) => {
            mockFetch = fn;
        },
    };
};

// Query builder
const createQueryBuilder = () => {
    let queryParts = {
        type: 'query',
        name: '',
        variables: [],
        selections: [],
        fragments: [],
    };

    const builder = {
        query: (name = '') => {
            queryParts.type = 'query';
            queryParts.name = name;
            return builder;
        },

        mutation: (name = '') => {
            queryParts.type = 'mutation';
            queryParts.name = name;
            return builder;
        },

        variable: (name, type, defaultValue) => {
            queryParts.variables.push({ name, type, defaultValue });
            return builder;
        },

        select: (...fields) => {
            queryParts.selections.push(...fields);
            return builder;
        },

        selectNested: (field, subfields) => {
            queryParts.selections.push({ field, subfields });
            return builder;
        },

        fragment: (name, onType, fields) => {
            queryParts.fragments.push({ name, onType, fields });
            return builder;
        },

        useFragment: (name) => {
            queryParts.selections.push(`...${name}`);
            return builder;
        },

        build: () => {
            let query = '';

            // Build fragments
            for (const frag of queryParts.fragments) {
                query += `fragment ${frag.name} on ${frag.onType} {\n`;
                query += `  ${frag.fields.join('\n  ')}\n`;
                query += `}\n\n`;
            }

            // Build operation
            query += queryParts.type;
            if (queryParts.name) {
                query += ` ${queryParts.name}`;
            }

            // Build variables
            if (queryParts.variables.length > 0) {
                const vars = queryParts.variables.map(v => {
                    let varStr = `$${v.name}: ${v.type}`;
                    if (v.defaultValue !== undefined) {
                        varStr += ` = ${JSON.stringify(v.defaultValue)}`;
                    }
                    return varStr;
                });
                query += `(${vars.join(', ')})`;
            }

            query += ' {\n';

            // Build selections
            for (const sel of queryParts.selections) {
                if (typeof sel === 'string') {
                    query += `  ${sel}\n`;
                } else {
                    query += `  ${sel.field} {\n`;
                    for (const sub of sel.subfields) {
                        query += `    ${sub}\n`;
                    }
                    query += `  }\n`;
                }
            }

            query += '}';

            return query;
        },

        reset: () => {
            queryParts = {
                type: 'query',
                name: '',
                variables: [],
                selections: [],
                fragments: [],
            };
            return builder;
        },
    };

    return builder;
};

// GraphQL error handler
const createErrorHandler = () => {
    const handlers = new Map();

    return {
        on: (errorCode, handler) => {
            handlers.set(errorCode, handler);
        },

        handle: (errors) => {
            const results = [];

            for (const error of errors) {
                const code = error.extensions?.code || 'UNKNOWN';
                const handler = handlers.get(code) || handlers.get('*');

                if (handler) {
                    results.push(handler(error));
                } else {
                    results.push({ handled: false, error });
                }
            }

            return results;
        },

        isAuthError: (errors) => {
            return errors.some(e =>
                e.extensions?.code === 'UNAUTHENTICATED' ||
                e.extensions?.code === 'FORBIDDEN'
            );
        },

        isValidationError: (errors) => {
            return errors.some(e =>
                e.extensions?.code === 'BAD_USER_INPUT' ||
                e.extensions?.code === 'VALIDATION_ERROR'
            );
        },

        isNetworkError: (errors) => {
            return errors.some(e =>
                e.extensions?.code === 'NETWORK_ERROR' ||
                e.message?.includes('fetch')
            );
        },
    };
};

describe('GraphQL Client Tests', () => {
    let client;

    beforeEach(() => {
        client = createGraphQLClient('https://api.example.com/graphql');
    });

    // ═══════════════════════════════════════════════════════════════════
    // QUERY
    // ═══════════════════════════════════════════════════════════════════

    describe('Query', () => {
        it('should execute query', async () => {
            client._setMockFetch(vi.fn().mockResolvedValue({
                data: { user: { id: '1', name: 'John' } },
            }));

            const result = await client.query(`
                query GetUser($id: ID!) {
                    user(id: $id) { id name }
                }
            `, { id: '1' });

            expect(result.user.name).toBe('John');
        });

        it('should cache query results', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                data: { users: [] },
            });
            client._setMockFetch(mockFetch);

            await client.query('query { users { id } }');
            await client.query('query { users { id } }');

            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should clear cache', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                data: { users: [] },
            });
            client._setMockFetch(mockFetch);

            await client.query('query { users { id } }');
            client.clearCache();
            await client.query('query { users { id } }');

            expect(mockFetch).toHaveBeenCalledTimes(2);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // MUTATION
    // ═══════════════════════════════════════════════════════════════════

    describe('Mutation', () => {
        it('should execute mutation', async () => {
            client._setMockFetch(vi.fn().mockResolvedValue({
                data: { createUser: { id: '2', name: 'Jane' } },
            }));

            const result = await client.mutate(`
                mutation CreateUser($name: String!) {
                    createUser(name: $name) { id name }
                }
            `, { name: 'Jane' });

            expect(result.createUser.name).toBe('Jane');
        });

        it('should not cache mutations', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                data: { updateUser: { id: '1' } },
            });
            client._setMockFetch(mockFetch);

            await client.mutate('mutation { updateUser { id } }');
            await client.mutate('mutation { updateUser { id } }');

            expect(mockFetch).toHaveBeenCalledTimes(2);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // ERROR HANDLING
    // ═══════════════════════════════════════════════════════════════════

    describe('Error Handling', () => {
        it('should throw on GraphQL errors', async () => {
            client._setMockFetch(vi.fn().mockResolvedValue({
                errors: [{ message: 'User not found' }],
            }));

            await expect(client.query('query { user { id } }')).rejects.toThrow('User not found');
        });

        it('should include all errors', async () => {
            client._setMockFetch(vi.fn().mockResolvedValue({
                errors: [
                    { message: 'Error 1' },
                    { message: 'Error 2' },
                ],
            }));

            try {
                await client.query('query { user { id } }');
            } catch (error) {
                expect(error.errors.length).toBe(2);
            }
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // MIDDLEWARE
    // ═══════════════════════════════════════════════════════════════════

    describe('Middleware', () => {
        it('should apply middleware', async () => {
            const middleware = vi.fn((ctx) => ({
                ...ctx,
                headers: { ...ctx.headers, 'X-Custom': 'value' },
            }));

            client.use(middleware);
            client._setMockFetch(vi.fn().mockResolvedValue({ data: {} }));

            await client.query('query { test }');

            expect(middleware).toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // SUBSCRIPTION
    // ═══════════════════════════════════════════════════════════════════

    describe('Subscription', () => {
        it('should create subscription', () => {
            const onData = vi.fn();
            const sub = client.subscribe('subscription { messages }', {}, { onData });

            expect(sub.unsubscribe).toBeDefined();
            sub.unsubscribe();
        });

        it('should call onComplete on unsubscribe', () => {
            const onComplete = vi.fn();
            const sub = client.subscribe('subscription { messages }', {}, { onComplete });

            sub.unsubscribe();

            expect(onComplete).toHaveBeenCalled();
        });
    });
});

describe('Query Builder Tests', () => {
    let builder;

    beforeEach(() => {
        builder = createQueryBuilder();
    });

    it('should build simple query', () => {
        const query = builder
            .query('GetUsers')
            .select('id', 'name', 'email')
            .build();

        expect(query).toContain('query GetUsers');
        expect(query).toContain('id');
        expect(query).toContain('name');
    });

    it('should build query with variables', () => {
        const query = builder
            .query('GetUser')
            .variable('id', 'ID!')
            .select('id', 'name')
            .build();

        expect(query).toContain('$id: ID!');
    });

    it('should build nested selections', () => {
        const query = builder
            .query()
            .select('id')
            .selectNested('posts', ['id', 'title', 'content'])
            .build();

        expect(query).toContain('posts {');
        expect(query).toContain('title');
    });

    it('should build mutation', () => {
        const query = builder
            .mutation('CreateUser')
            .variable('input', 'UserInput!')
            .select('id')
            .build();

        expect(query).toContain('mutation CreateUser');
    });

    it('should build with fragments', () => {
        const query = builder
            .query()
            .fragment('UserFields', 'User', ['id', 'name', 'email'])
            .select('users')
            .useFragment('UserFields')
            .build();

        expect(query).toContain('fragment UserFields on User');
        expect(query).toContain('...UserFields');
    });
});

describe('GraphQL Error Handler Tests', () => {
    let errorHandler;

    beforeEach(() => {
        errorHandler = createErrorHandler();
    });

    it('should handle specific error codes', () => {
        errorHandler.on('NOT_FOUND', (error) => ({ handled: true, redirectTo: '/404' }));

        const results = errorHandler.handle([
            { message: 'Not found', extensions: { code: 'NOT_FOUND' } },
        ]);

        expect(results[0].handled).toBe(true);
        expect(results[0].redirectTo).toBe('/404');
    });

    it('should detect auth errors', () => {
        const errors = [{ extensions: { code: 'UNAUTHENTICATED' } }];

        expect(errorHandler.isAuthError(errors)).toBe(true);
    });

    it('should detect validation errors', () => {
        const errors = [{ extensions: { code: 'BAD_USER_INPUT' } }];

        expect(errorHandler.isValidationError(errors)).toBe(true);
    });
});
