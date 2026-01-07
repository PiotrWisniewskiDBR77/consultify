/**
 * Protocol Adapter Tests
 * Tests for protocol adapters and converters
 * 
 * @module tests/protocol/protocol-adapter.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Protocol adapter factory
const createProtocolAdapter = (type) => {
    const adapters = {
        'http-to-ws': {
            adapt: (httpRequest) => ({
                type: 'message',
                event: httpRequest.method.toLowerCase(),
                payload: httpRequest.body,
                headers: httpRequest.headers,
                path: httpRequest.path,
            }),
            reverse: (wsMessage) => ({
                method: wsMessage.event?.toUpperCase() || 'POST',
                path: wsMessage.path || '/',
                body: wsMessage.payload,
                headers: wsMessage.headers || {},
            }),
        },

        'rest-to-graphql': {
            adapt: (restRequest) => {
                const { method, path, body, params } = restRequest;
                const parts = path.split('/').filter(Boolean);
                const resource = parts[0];
                const id = parts[1];

                if (method === 'GET' && !id) {
                    return {
                        query: `query { ${resource}(${Object.entries(params || {}).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')}) { id } }`,
                        variables: {},
                    };
                }
                if (method === 'GET' && id) {
                    return {
                        query: `query { ${resource}(id: $id) { id } }`,
                        variables: { id },
                    };
                }
                if (method === 'POST') {
                    return {
                        query: `mutation { create${capitalize(resource)}(input: $input) { id } }`,
                        variables: { input: body },
                    };
                }
                if (method === 'PUT' || method === 'PATCH') {
                    return {
                        query: `mutation { update${capitalize(resource)}(id: $id, input: $input) { id } }`,
                        variables: { id, input: body },
                    };
                }
                if (method === 'DELETE') {
                    return {
                        query: `mutation { delete${capitalize(resource)}(id: $id) { success } }`,
                        variables: { id },
                    };
                }
                throw new Error(`Unsupported method: ${method}`);
            },
        },

        'json-to-xml': {
            adapt: (json) => {
                const toXML = (obj, rootName = 'root') => {
                    if (obj === null || obj === undefined) return '';
                    if (typeof obj !== 'object') return String(obj);

                    if (Array.isArray(obj)) {
                        return obj.map(item => `<item>${toXML(item)}</item>`).join('');
                    }

                    const children = Object.entries(obj)
                        .map(([key, value]) => `<${key}>${toXML(value)}</${key}>`)
                        .join('');

                    return children;
                };

                return `<?xml version="1.0" encoding="UTF-8"?><root>${toXML(json)}</root>`;
            },
            reverse: (xml) => {
                // Simplified XML to JSON (for demo)
                const result = {};
                const tagRegex = /<(\w+)>([^<]*)<\/\1>/g;
                let match;

                while ((match = tagRegex.exec(xml)) !== null) {
                    result[match[1]] = match[2];
                }

                return result;
            },
        },

        'soap-to-rest': {
            adapt: (soapEnvelope) => {
                // Extract method from SOAP body
                const methodMatch = soapEnvelope.match(/<(\w+)Request/);
                const method = methodMatch ? methodMatch[1] : 'unknown';

                // Extract parameters (simplified)
                const params = {};
                const paramRegex = /<(\w+)>([^<]+)<\/\1>/g;
                let match;
                while ((match = paramRegex.exec(soapEnvelope)) !== null) {
                    if (!match[1].includes('Request') && !match[1].includes('Body')) {
                        params[match[1]] = match[2];
                    }
                }

                return {
                    method: 'POST',
                    path: `/${method.toLowerCase()}`,
                    body: params,
                };
            },
        },
    };

    return adapters[type] || null;
};

const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

// Message format converter
const createMessageConverter = () => {
    return {
        jsonToForm: (json) => {
            return new URLSearchParams(
                Object.entries(json).map(([k, v]) => [k, String(v)])
            ).toString();
        },

        formToJson: (formData) => {
            const result = {};
            const params = new URLSearchParams(formData);
            for (const [key, value] of params) {
                result[key] = value;
            }
            return result;
        },

        jsonToQuery: (json) => {
            return Object.entries(json)
                .filter(([, v]) => v !== undefined && v !== null)
                .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
                .join('&');
        },

        queryToJson: (query) => {
            const result = {};
            const clean = query.startsWith('?') ? query.slice(1) : query;

            for (const pair of clean.split('&')) {
                const [key, value] = pair.split('=').map(decodeURIComponent);
                result[key] = value;
            }

            return result;
        },

        flattenJson: (json, prefix = '') => {
            const result = {};

            for (const [key, value] of Object.entries(json)) {
                const newKey = prefix ? `${prefix}.${key}` : key;

                if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                    Object.assign(result, this.flattenJson(value, newKey));
                } else {
                    result[newKey] = value;
                }
            }

            return result;
        },

        unflattenJson: (flat) => {
            const result = {};

            for (const [key, value] of Object.entries(flat)) {
                const parts = key.split('.');
                let current = result;

                for (let i = 0; i < parts.length - 1; i++) {
                    if (!current[parts[i]]) {
                        current[parts[i]] = {};
                    }
                    current = current[parts[i]];
                }

                current[parts[parts.length - 1]] = value;
            }

            return result;
        },
    };
};

// Transport wrapper
const createTransportWrapper = (transport) => {
    const middleware = [];

    return {
        use: (fn) => {
            middleware.push(fn);
        },

        send: async (message) => {
            let processed = message;

            for (const fn of middleware) {
                processed = await fn(processed, 'outgoing');
            }

            const response = await transport.send(processed);

            for (const fn of [...middleware].reverse()) {
                response = await fn(response, 'incoming');
            }

            return response;
        },

        wrap: (adapter) => ({
            send: async (message) => {
                const adapted = adapter.adapt(message);
                const response = await this.send(adapted);
                return adapter.reverse ? adapter.reverse(response) : response;
            },
        }),
    };
};

describe('Protocol Adapter Tests', () => {
    // ═══════════════════════════════════════════════════════════════════
    // HTTP TO WEBSOCKET
    // ═══════════════════════════════════════════════════════════════════

    describe('HTTP to WebSocket', () => {
        let adapter;

        beforeEach(() => {
            adapter = createProtocolAdapter('http-to-ws');
        });

        it('should adapt HTTP request to WS message', () => {
            const http = {
                method: 'POST',
                path: '/messages',
                body: { text: 'Hello' },
                headers: { 'Content-Type': 'application/json' },
            };

            const ws = adapter.adapt(http);

            expect(ws.type).toBe('message');
            expect(ws.event).toBe('post');
            expect(ws.payload.text).toBe('Hello');
        });

        it('should reverse WS message to HTTP request', () => {
            const ws = {
                event: 'GET',
                path: '/users',
                payload: null,
            };

            const http = adapter.reverse(ws);

            expect(http.method).toBe('GET');
            expect(http.path).toBe('/users');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // REST TO GRAPHQL
    // ═══════════════════════════════════════════════════════════════════

    describe('REST to GraphQL', () => {
        let adapter;

        beforeEach(() => {
            adapter = createProtocolAdapter('rest-to-graphql');
        });

        it('should adapt GET list to query', () => {
            const rest = { method: 'GET', path: '/users', params: { limit: 10 } };
            const gql = adapter.adapt(rest);

            expect(gql.query).toContain('query');
            expect(gql.query).toContain('users');
        });

        it('should adapt GET by ID to query', () => {
            const rest = { method: 'GET', path: '/users/123' };
            const gql = adapter.adapt(rest);

            expect(gql.query).toContain('users');
            expect(gql.variables.id).toBe('123');
        });

        it('should adapt POST to mutation', () => {
            const rest = { method: 'POST', path: '/users', body: { name: 'John' } };
            const gql = adapter.adapt(rest);

            expect(gql.query).toContain('mutation');
            expect(gql.query).toContain('createUsers');
        });

        it('should adapt DELETE to mutation', () => {
            const rest = { method: 'DELETE', path: '/users/123' };
            const gql = adapter.adapt(rest);

            expect(gql.query).toContain('deleteUsers');
            expect(gql.variables.id).toBe('123');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // JSON TO XML
    // ═══════════════════════════════════════════════════════════════════

    describe('JSON to XML', () => {
        let adapter;

        beforeEach(() => {
            adapter = createProtocolAdapter('json-to-xml');
        });

        it('should convert JSON to XML', () => {
            const json = { name: 'John', age: 30 };
            const xml = adapter.adapt(json);

            expect(xml).toContain('<?xml version="1.0"');
            expect(xml).toContain('<name>John</name>');
            expect(xml).toContain('<age>30</age>');
        });

        it('should convert simple XML to JSON', () => {
            const xml = '<root><name>Jane</name><city>NYC</city></root>';
            const json = adapter.reverse(xml);

            expect(json.name).toBe('Jane');
            expect(json.city).toBe('NYC');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // SOAP TO REST
    // ═══════════════════════════════════════════════════════════════════

    describe('SOAP to REST', () => {
        let adapter;

        beforeEach(() => {
            adapter = createProtocolAdapter('soap-to-rest');
        });

        it('should extract method from SOAP', () => {
            const soap = `
                <soap:Envelope>
                    <soap:Body>
                        <GetUserRequest>
                            <userId>123</userId>
                        </GetUserRequest>
                    </soap:Body>
                </soap:Envelope>
            `;

            const rest = adapter.adapt(soap);

            expect(rest.path).toBe('/getuser');
            expect(rest.body.userId).toBe('123');
        });
    });
});

describe('Message Converter Tests', () => {
    let converter;

    beforeEach(() => {
        converter = createMessageConverter();
    });

    describe('JSON to Form', () => {
        it('should convert JSON to form data', () => {
            const json = { name: 'John', age: 30 };
            const form = converter.jsonToForm(json);

            expect(form).toBe('name=John&age=30');
        });
    });

    describe('Form to JSON', () => {
        it('should convert form data to JSON', () => {
            const form = 'name=Jane&city=NYC';
            const json = converter.formToJson(form);

            expect(json.name).toBe('Jane');
            expect(json.city).toBe('NYC');
        });
    });

    describe('Query conversions', () => {
        it('should convert JSON to query string', () => {
            const json = { search: 'test', page: 1 };
            const query = converter.jsonToQuery(json);

            expect(query).toBe('search=test&page=1');
        });

        it('should convert query string to JSON', () => {
            const query = '?q=hello&limit=10';
            const json = converter.queryToJson(query);

            expect(json.q).toBe('hello');
            expect(json.limit).toBe('10');
        });
    });

    describe('Flatten / Unflatten', () => {
        it('should flatten nested JSON', () => {
            const nested = {
                user: { name: 'John', address: { city: 'NYC' } },
            };
            const flat = converter.flattenJson(nested);

            expect(flat['user.name']).toBe('John');
            expect(flat['user.address.city']).toBe('NYC');
        });

        it('should unflatten JSON', () => {
            const flat = {
                'user.name': 'Jane',
                'user.age': 25,
            };
            const nested = converter.unflattenJson(flat);

            expect(nested.user.name).toBe('Jane');
            expect(nested.user.age).toBe(25);
        });
    });
});
