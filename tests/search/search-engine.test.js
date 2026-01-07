/**
 * Search and Indexing Tests
 * Tests for full-text search and indexing
 * 
 * @module tests/search/search-engine.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Full-text search engine
const createSearchEngine = () => {
    const documents = new Map();
    const index = new Map(); // term -> Set of docIds

    const tokenize = (text) => {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(t => t.length > 1);
    };

    return {
        index: (id, doc, fields = ['title', 'content']) => {
            documents.set(id, doc);

            for (const field of fields) {
                const text = doc[field];
                if (typeof text === 'string') {
                    const tokens = tokenize(text);
                    for (const token of tokens) {
                        if (!index.has(token)) {
                            index.set(token, new Set());
                        }
                        index.get(token).add(id);
                    }
                }
            }
        },

        remove: (id) => {
            const doc = documents.get(id);
            if (!doc) return false;

            for (const [term, docIds] of index) {
                docIds.delete(id);
                if (docIds.size === 0) {
                    index.delete(term);
                }
            }

            documents.delete(id);
            return true;
        },

        search: (query, options = {}) => {
            const tokens = tokenize(query);
            if (tokens.length === 0) return [];

            // Find matching document IDs
            let matchingIds = null;

            for (const token of tokens) {
                const docIds = index.get(token);
                if (docIds) {
                    if (matchingIds === null) {
                        matchingIds = new Set(docIds);
                    } else if (options.operator === 'AND') {
                        matchingIds = new Set([...matchingIds].filter(id => docIds.has(id)));
                    } else {
                        docIds.forEach(id => matchingIds.add(id));
                    }
                } else if (options.operator === 'AND') {
                    return [];
                }
            }

            if (!matchingIds) return [];

            // Get documents and calculate relevance
            const results = [...matchingIds].map(id => {
                const doc = documents.get(id);
                const score = tokens.reduce((s, token) => {
                    return s + (index.get(token)?.has(id) ? 1 : 0);
                }, 0);
                return { id, doc, score };
            });

            // Sort by score
            results.sort((a, b) => b.score - a.score);

            // Apply limit
            if (options.limit) {
                return results.slice(0, options.limit);
            }

            return results;
        },

        suggest: (prefix, limit = 5) => {
            const suggestions = [];
            for (const term of index.keys()) {
                if (term.startsWith(prefix.toLowerCase())) {
                    suggestions.push(term);
                }
            }
            return suggestions.slice(0, limit);
        },

        getDocumentCount: () => documents.size,

        getTermCount: () => index.size,
    };
};

// Faceted search
const createFacetedSearch = () => {
    const documents = [];
    const facets = new Map(); // facetName -> Map<value, Set<docIndex>>

    return {
        add: (doc) => {
            const docIndex = documents.length;
            documents.push(doc);

            // Index facets
            for (const [key, value] of Object.entries(doc)) {
                if (typeof value === 'string' || typeof value === 'number') {
                    if (!facets.has(key)) {
                        facets.set(key, new Map());
                    }
                    const facet = facets.get(key);
                    if (!facet.has(value)) {
                        facet.set(value, new Set());
                    }
                    facet.get(value).add(docIndex);
                }
            }

            return docIndex;
        },

        search: (filters = {}) => {
            let matchingIndices = null;

            for (const [facetName, value] of Object.entries(filters)) {
                const facet = facets.get(facetName);
                if (!facet) continue;

                const indices = facet.get(value);
                if (!indices) return [];

                if (matchingIndices === null) {
                    matchingIndices = new Set(indices);
                } else {
                    matchingIndices = new Set(
                        [...matchingIndices].filter(i => indices.has(i))
                    );
                }
            }

            if (matchingIndices === null) {
                return [...documents];
            }

            return [...matchingIndices].map(i => documents[i]);
        },

        getFacetValues: (facetName) => {
            const facet = facets.get(facetName);
            if (!facet) return [];

            return [...facet.entries()].map(([value, indices]) => ({
                value,
                count: indices.size,
            })).sort((a, b) => b.count - a.count);
        },

        getAvailableFacets: () => [...facets.keys()],
    };
};

// Fuzzy matcher
const createFuzzyMatcher = () => {
    const levenshtein = (a, b) => {
        const matrix = [];

        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[b.length][a.length];
    };

    return {
        distance: levenshtein,

        match: (query, candidates, maxDistance = 2) => {
            const results = [];

            for (const candidate of candidates) {
                const distance = levenshtein(query.toLowerCase(), candidate.toLowerCase());
                if (distance <= maxDistance) {
                    results.push({ value: candidate, distance });
                }
            }

            return results.sort((a, b) => a.distance - b.distance);
        },

        similarity: (a, b) => {
            const maxLen = Math.max(a.length, b.length);
            if (maxLen === 0) return 1;
            return 1 - levenshtein(a, b) / maxLen;
        },
    };
};

// Query parser
const createQueryParser = () => {
    return {
        parse: (query) => {
            const result = {
                terms: [],
                phrases: [],
                excluded: [],
                fields: {},
            };

            // Extract quoted phrases
            const phraseRegex = /"([^"]+)"/g;
            let match;
            while ((match = phraseRegex.exec(query)) !== null) {
                result.phrases.push(match[1]);
            }
            query = query.replace(phraseRegex, '');

            // Extract field:value pairs
            const fieldRegex = /(\w+):(\S+)/g;
            while ((match = fieldRegex.exec(query)) !== null) {
                result.fields[match[1]] = match[2];
            }
            query = query.replace(fieldRegex, '');

            // Extract excluded terms (prefixed with -)
            const excludeRegex = /-(\S+)/g;
            while ((match = excludeRegex.exec(query)) !== null) {
                result.excluded.push(match[1]);
            }
            query = query.replace(excludeRegex, '');

            // Remaining are regular terms
            result.terms = query.split(/\s+/).filter(t => t.length > 0);

            return result;
        },

        stringify: (parsed) => {
            const parts = [];

            if (parsed.terms.length > 0) {
                parts.push(...parsed.terms);
            }

            for (const phrase of parsed.phrases) {
                parts.push(`"${phrase}"`);
            }

            for (const term of parsed.excluded) {
                parts.push(`-${term}`);
            }

            for (const [field, value] of Object.entries(parsed.fields)) {
                parts.push(`${field}:${value}`);
            }

            return parts.join(' ');
        },
    };
};

describe('Search Engine Tests', () => {
    let engine;

    beforeEach(() => {
        engine = createSearchEngine();
        engine.index('1', { title: 'JavaScript Basics', content: 'Learn JavaScript fundamentals' });
        engine.index('2', { title: 'Advanced TypeScript', content: 'TypeScript and JavaScript' });
        engine.index('3', { title: 'Python Tutorial', content: 'Learn Python programming' });
    });

    it('should search documents', () => {
        const results = engine.search('javascript');

        expect(results.length).toBe(2);
    });

    it('should rank by relevance', () => {
        const results = engine.search('learn python');

        expect(results[0].doc.title).toContain('Python');
    });

    it('should support AND operator', () => {
        const results = engine.search('javascript typescript', { operator: 'AND' });

        expect(results.length).toBe(1);
        expect(results[0].doc.title).toContain('TypeScript');
    });

    it('should suggest terms', () => {
        const suggestions = engine.suggest('java');

        expect(suggestions).toContain('javascript');
    });

    it('should remove documents', () => {
        engine.remove('1');

        const results = engine.search('basics');
        expect(results.length).toBe(0);
    });
});

describe('Faceted Search Tests', () => {
    let search;

    beforeEach(() => {
        search = createFacetedSearch();
        search.add({ name: 'Laptop', category: 'Electronics', brand: 'Apple', price: 1200 });
        search.add({ name: 'Phone', category: 'Electronics', brand: 'Samsung', price: 800 });
        search.add({ name: 'Shirt', category: 'Clothing', brand: 'Nike', price: 50 });
        search.add({ name: 'Headphones', category: 'Electronics', brand: 'Apple', price: 300 });
    });

    it('should filter by facet', () => {
        const results = search.search({ category: 'Electronics' });

        expect(results.length).toBe(3);
    });

    it('should filter by multiple facets', () => {
        const results = search.search({ category: 'Electronics', brand: 'Apple' });

        expect(results.length).toBe(2);
    });

    it('should get facet values', () => {
        const values = search.getFacetValues('category');

        expect(values).toContainEqual({ value: 'Electronics', count: 3 });
        expect(values).toContainEqual({ value: 'Clothing', count: 1 });
    });

    it('should list available facets', () => {
        const facets = search.getAvailableFacets();

        expect(facets).toContain('category');
        expect(facets).toContain('brand');
    });
});

describe('Fuzzy Matcher Tests', () => {
    let matcher;

    beforeEach(() => {
        matcher = createFuzzyMatcher();
    });

    it('should calculate distance', () => {
        expect(matcher.distance('cat', 'cat')).toBe(0);
        expect(matcher.distance('cat', 'bat')).toBe(1);
        expect(matcher.distance('kitten', 'sitting')).toBe(3);
    });

    it('should find fuzzy matches', () => {
        const candidates = ['apple', 'application', 'banana', 'apricot'];
        const results = matcher.match('aple', candidates);

        expect(results[0].value).toBe('apple');
    });

    it('should calculate similarity', () => {
        expect(matcher.similarity('test', 'test')).toBe(1);
        expect(matcher.similarity('test', 'best')).toBeGreaterThan(0.5);
    });
});

describe('Query Parser Tests', () => {
    let parser;

    beforeEach(() => {
        parser = createQueryParser();
    });

    it('should parse terms', () => {
        const result = parser.parse('hello world');

        expect(result.terms).toContain('hello');
        expect(result.terms).toContain('world');
    });

    it('should parse phrases', () => {
        const result = parser.parse('find "exact phrase" here');

        expect(result.phrases).toContain('exact phrase');
    });

    it('should parse excluded terms', () => {
        const result = parser.parse('javascript -jquery');

        expect(result.terms).toContain('javascript');
        expect(result.excluded).toContain('jquery');
    });

    it('should parse field:value', () => {
        const result = parser.parse('author:john category:tech');

        expect(result.fields.author).toBe('john');
        expect(result.fields.category).toBe('tech');
    });

    it('should stringify parsed query', () => {
        const parsed = {
            terms: ['hello'],
            phrases: ['exact match'],
            excluded: ['bad'],
            fields: { type: 'article' },
        };

        const str = parser.stringify(parsed);
        expect(str).toContain('hello');
        expect(str).toContain('"exact match"');
        expect(str).toContain('-bad');
        expect(str).toContain('type:article');
    });
});
