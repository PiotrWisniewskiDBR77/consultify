/**
 * Parser Tests
 * Tests for data parsing utilities
 * 
 * @module tests/parser/data-parser.test.js
 */

import { describe, it, expect, beforeEach } from 'vitest';

// CSV Parser
const createCSVParser = (options = {}) => {
    const { delimiter = ',', quote = '"', header = true } = options;

    return {
        parse: (text) => {
            const lines = text.trim().split('\n');
            const rows = [];

            for (const line of lines) {
                const row = [];
                let current = '';
                let inQuotes = false;

                for (let i = 0; i < line.length; i++) {
                    const char = line[i];

                    if (char === quote) {
                        if (inQuotes && line[i + 1] === quote) {
                            current += quote;
                            i++;
                        } else {
                            inQuotes = !inQuotes;
                        }
                    } else if (char === delimiter && !inQuotes) {
                        row.push(current.trim());
                        current = '';
                    } else {
                        current += char;
                    }
                }
                row.push(current.trim());
                rows.push(row);
            }

            if (header && rows.length > 0) {
                const headers = rows.shift();
                return rows.map(row => {
                    const obj = {};
                    headers.forEach((h, i) => {
                        obj[h] = row[i];
                    });
                    return obj;
                });
            }

            return rows;
        },

        stringify: (data, columns) => {
            if (!Array.isArray(data) || data.length === 0) return '';

            const headers = columns || Object.keys(data[0]);
            const lines = [headers.join(delimiter)];

            for (const item of data) {
                const values = headers.map(h => {
                    let value = item[h] ?? '';
                    if (typeof value === 'string' && (value.includes(delimiter) || value.includes(quote))) {
                        value = `${quote}${value.replace(new RegExp(quote, 'g'), quote + quote)}${quote}`;
                    }
                    return value;
                });
                lines.push(values.join(delimiter));
            }

            return lines.join('\n');
        },
    };
};

// Query String Parser
const createQueryStringParser = () => {
    return {
        parse: (queryString) => {
            if (!queryString || queryString.length === 0) return {};

            // Remove leading ?
            const str = queryString.startsWith('?') ? queryString.slice(1) : queryString;

            const result = {};
            const pairs = str.split('&');

            for (const pair of pairs) {
                const [key, value] = pair.split('=').map(decodeURIComponent);

                if (key.endsWith('[]')) {
                    const arrayKey = key.slice(0, -2);
                    (result[arrayKey] = result[arrayKey] || []).push(value);
                } else if (result[key] !== undefined) {
                    if (!Array.isArray(result[key])) {
                        result[key] = [result[key]];
                    }
                    result[key].push(value);
                } else {
                    result[key] = value;
                }
            }

            return result;
        },

        stringify: (obj, options = {}) => {
            const { arrayFormat = 'brackets' } = options;
            const pairs = [];

            for (const [key, value] of Object.entries(obj)) {
                if (value === undefined || value === null) continue;

                if (Array.isArray(value)) {
                    for (const item of value) {
                        const k = arrayFormat === 'brackets' ? `${key}[]` : key;
                        pairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(item)}`);
                    }
                } else {
                    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
                }
            }

            return pairs.join('&');
        },
    };
};

// Path Parser
const createPathParser = () => {
    return {
        parse: (pattern, path) => {
            const patternParts = pattern.split('/').filter(Boolean);
            const pathParts = path.split('/').filter(Boolean);

            if (patternParts.length !== pathParts.length) {
                return null;
            }

            const params = {};

            for (let i = 0; i < patternParts.length; i++) {
                const patternPart = patternParts[i];
                const pathPart = pathParts[i];

                if (patternPart.startsWith(':')) {
                    const paramName = patternPart.slice(1);
                    params[paramName] = pathPart;
                } else if (patternPart !== pathPart) {
                    return null;
                }
            }

            return params;
        },

        build: (pattern, params) => {
            return pattern.replace(/:([^/]+)/g, (_, name) => {
                return params[name] ?? '';
            });
        },

        match: (patterns, path) => {
            for (const [pattern, handler] of Object.entries(patterns)) {
                const params = this.parse(pattern, path);
                if (params !== null) {
                    return { pattern, params, handler };
                }
            }
            return null;
        },
    };
};

// Template Parser
const createTemplateParser = () => {
    return {
        parse: (template, data, options = {}) => {
            const {
                startDelimiter = '{{',
                endDelimiter = '}}',
                filters = {},
            } = options;

            const regex = new RegExp(
                `${startDelimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(.+?)${endDelimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
                'g'
            );

            return template.replace(regex, (_, expression) => {
                const parts = expression.trim().split('|').map(p => p.trim());
                const path = parts[0];

                // Get value from path
                let value = path.split('.').reduce((obj, key) => obj?.[key], data);

                // Apply filters
                for (let i = 1; i < parts.length; i++) {
                    const filterName = parts[i];
                    const filter = filters[filterName];
                    if (filter) {
                        value = filter(value);
                    }
                }

                return value ?? '';
            });
        },

        compile: (template, options = {}) => {
            return (data) => this.parse(template, data, options);
        },
    };
};

describe('Parser Tests', () => {
    // ═══════════════════════════════════════════════════════════════════
    // CSV PARSER
    // ═══════════════════════════════════════════════════════════════════

    describe('CSV Parser', () => {
        let parser;

        beforeEach(() => {
            parser = createCSVParser();
        });

        describe('parse', () => {
            it('should parse simple CSV', () => {
                const csv = 'name,age\nJohn,30\nJane,25';
                const result = parser.parse(csv);

                expect(result.length).toBe(2);
                expect(result[0].name).toBe('John');
                expect(result[0].age).toBe('30');
            });

            it('should handle quoted values', () => {
                const csv = 'name,description\nTest,"Hello, World"';
                const result = parser.parse(csv);

                expect(result[0].description).toBe('Hello, World');
            });

            it('should handle escaped quotes', () => {
                const csv = 'name,quote\nTest,"He said ""Hello"""';
                const result = parser.parse(csv);

                expect(result[0].quote).toBe('He said "Hello"');
            });

            it('should parse without header', () => {
                const parser = createCSVParser({ header: false });
                const csv = 'John,30\nJane,25';
                const result = parser.parse(csv);

                expect(result).toEqual([['John', '30'], ['Jane', '25']]);
            });
        });

        describe('stringify', () => {
            it('should stringify objects', () => {
                const data = [
                    { name: 'John', age: 30 },
                    { name: 'Jane', age: 25 },
                ];

                const csv = parser.stringify(data);

                expect(csv).toContain('name,age');
                expect(csv).toContain('John,30');
            });

            it('should quote special characters', () => {
                const data = [{ name: 'Hello, World' }];
                const csv = parser.stringify(data);

                expect(csv).toContain('"Hello, World"');
            });
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // QUERY STRING PARSER
    // ═══════════════════════════════════════════════════════════════════

    describe('Query String Parser', () => {
        let parser;

        beforeEach(() => {
            parser = createQueryStringParser();
        });

        describe('parse', () => {
            it('should parse simple query string', () => {
                const result = parser.parse('name=John&age=30');

                expect(result.name).toBe('John');
                expect(result.age).toBe('30');
            });

            it('should handle leading ?', () => {
                const result = parser.parse('?name=John');

                expect(result.name).toBe('John');
            });

            it('should parse arrays', () => {
                const result = parser.parse('tags[]=a&tags[]=b&tags[]=c');

                expect(result.tags).toEqual(['a', 'b', 'c']);
            });

            it('should decode URI components', () => {
                const result = parser.parse('name=John%20Doe&email=john%40example.com');

                expect(result.name).toBe('John Doe');
                expect(result.email).toBe('john@example.com');
            });
        });

        describe('stringify', () => {
            it('should stringify object', () => {
                const result = parser.stringify({ name: 'John', age: 30 });

                expect(result).toBe('name=John&age=30');
            });

            it('should stringify arrays', () => {
                const result = parser.stringify({ tags: ['a', 'b'] });

                expect(result).toBe('tags%5B%5D=a&tags%5B%5D=b');
            });

            it('should encode special characters', () => {
                const result = parser.stringify({ email: 'john@example.com' });

                expect(result).toBe('email=john%40example.com');
            });
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // PATH PARSER
    // ═══════════════════════════════════════════════════════════════════

    describe('Path Parser', () => {
        let parser;

        beforeEach(() => {
            parser = createPathParser();
        });

        describe('parse', () => {
            it('should parse path params', () => {
                const result = parser.parse('/users/:id', '/users/123');

                expect(result.id).toBe('123');
            });

            it('should parse multiple params', () => {
                const result = parser.parse('/users/:userId/posts/:postId', '/users/1/posts/42');

                expect(result.userId).toBe('1');
                expect(result.postId).toBe('42');
            });

            it('should return null for non-matching paths', () => {
                const result = parser.parse('/users/:id', '/posts/123');

                expect(result).toBeNull();
            });
        });

        describe('build', () => {
            it('should build path from params', () => {
                const result = parser.build('/users/:id/posts/:postId', { id: '1', postId: '42' });

                expect(result).toBe('/users/1/posts/42');
            });
        });

        describe('match', () => {
            it('should match first matching pattern', () => {
                const patterns = {
                    '/users': 'listUsers',
                    '/users/:id': 'getUser',
                    '/posts/:id': 'getPost',
                };

                const result = parser.match(patterns, '/users/123');

                expect(result.handler).toBe('getUser');
                expect(result.params.id).toBe('123');
            });
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // TEMPLATE PARSER
    // ═══════════════════════════════════════════════════════════════════

    describe('Template Parser', () => {
        let parser;

        beforeEach(() => {
            parser = createTemplateParser();
        });

        it('should parse simple template', () => {
            const result = parser.parse('Hello, {{name}}!', { name: 'John' });

            expect(result).toBe('Hello, John!');
        });

        it('should parse nested paths', () => {
            const result = parser.parse('Hello, {{user.name}}!', { user: { name: 'John' } });

            expect(result).toBe('Hello, John!');
        });

        it('should apply filters', () => {
            const result = parser.parse(
                'Hello, {{name | uppercase}}!',
                { name: 'john' },
                { filters: { uppercase: v => v.toUpperCase() } }
            );

            expect(result).toBe('Hello, JOHN!');
        });

        it('should compile template', () => {
            const template = parser.compile('Hello, {{name}}!');

            expect(template({ name: 'John' })).toBe('Hello, John!');
            expect(template({ name: 'Jane' })).toBe('Hello, Jane!');
        });
    });
});
