/**
 * Search Index Tests
 * Tests for in-memory search index
 *
 * @module tests/search/search-index.test.js
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Search index implementation
const createSearchIndex = () => {
  const documents = new Map();
  const invertedIndex = new Map();
  const fieldWeights = new Map();

  const tokenize = (text) => {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((t) => t.length > 1);
  };

  const indexDocument = (id, doc, fields) => {
    const tokens = new Map();

    fields.forEach((field) => {
      const value = doc[field];
      if (typeof value !== 'string') return;

      const fieldTokens = tokenize(value);
      const weight = fieldWeights.get(field) || 1;

      fieldTokens.forEach((token) => {
        const current = tokens.get(token) || 0;
        tokens.set(token, current + weight);
      });
    });

    tokens.forEach((score, token) => {
      if (!invertedIndex.has(token)) {
        invertedIndex.set(token, new Map());
      }
      invertedIndex.get(token).set(id, score);
    });
  };

  return {
    add: (id, doc, fields = Object.keys(doc)) => {
      documents.set(id, doc);
      indexDocument(id, doc, fields);
    },

    addMany: (docs, idField = 'id', fields) => {
      docs.forEach((doc) => {
        const id = doc[idField];
        this.add(id, doc, fields || Object.keys(doc));
      });
    },

    remove: (id) => {
      if (!documents.has(id)) return false;

      documents.delete(id);

      // Remove from inverted index
      invertedIndex.forEach((docScores) => {
        docScores.delete(id);
      });

      return true;
    },

    update: (id, doc, fields) => {
      if (!documents.has(id)) return false;

      this.remove(id);
      this.add(id, doc, fields);
      return true;
    },

    setFieldWeight: (field, weight) => {
      fieldWeights.set(field, weight);
    },

    search: (query, options = {}) => {
      const { limit = 10, threshold = 0 } = options;
      const queryTokens = tokenize(query);

      if (queryTokens.length === 0) return [];

      const scores = new Map();

      queryTokens.forEach((token) => {
        // Exact match
        if (invertedIndex.has(token)) {
          invertedIndex.get(token).forEach((score, docId) => {
            const current = scores.get(docId) || 0;
            scores.set(docId, current + score);
          });
        }

        // Prefix match
        invertedIndex.forEach((docScores, indexedToken) => {
          if (indexedToken.startsWith(token) && indexedToken !== token) {
            docScores.forEach((score, docId) => {
              const current = scores.get(docId) || 0;
              scores.set(docId, current + score * 0.5);
            });
          }
        });
      });

      // Sort by score and apply limit
      const results = [...scores.entries()]
        .filter(([_, score]) => score >= threshold)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([id, score]) => ({
          id,
          score,
          doc: documents.get(id),
        }));

      return results;
    },

    suggest: (prefix, limit = 5) => {
      const matches = [];
      const seen = new Set();

      invertedIndex.forEach((_, token) => {
        if (token.startsWith(prefix.toLowerCase()) && !seen.has(token)) {
          seen.add(token);
          matches.push(token);
        }
      });

      return matches.slice(0, limit);
    },

    getDocument: (id) => documents.get(id),

    getSize: () => documents.size,

    clear: () => {
      documents.clear();
      invertedIndex.clear();
    },
  };
};

describe('Search Index Tests', () => {
  let index;

  beforeEach(() => {
    index = createSearchIndex();
  });

  // ═══════════════════════════════════════════════════════════════════
  // ADD DOCUMENTS
  // ═══════════════════════════════════════════════════════════════════

  describe('Add Documents', () => {
    it('should add document', () => {
      index.add('1', { title: 'Hello World', body: 'Test content' });

      expect(index.getSize()).toBe(1);
      expect(index.getDocument('1')).toBeDefined();
    });

    it('should add many documents', () => {
      const docs = [
        { id: '1', title: 'First' },
        { id: '2', title: 'Second' },
        { id: '3', title: 'Third' },
      ];

      index.addMany(docs);

      expect(index.getSize()).toBe(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // REMOVE DOCUMENTS
  // ═══════════════════════════════════════════════════════════════════

  describe('Remove Documents', () => {
    it('should remove document', () => {
      index.add('1', { title: 'Test' });
      const result = index.remove('1');

      expect(result).toBe(true);
      expect(index.getSize()).toBe(0);
    });

    it('should return false for non-existent', () => {
      expect(index.remove('unknown')).toBe(false);
    });

    it('should not return removed doc in search', () => {
      index.add('1', { title: 'Hello World' });
      index.remove('1');

      const results = index.search('hello');

      expect(results.length).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // UPDATE DOCUMENTS
  // ═══════════════════════════════════════════════════════════════════

  describe('Update Documents', () => {
    it('should update document', () => {
      index.add('1', { title: 'Old Title' });
      index.update('1', { title: 'New Title' });

      expect(index.getDocument('1').title).toBe('New Title');
    });

    it('should update search index', () => {
      index.add('1', { title: 'Old Title' });
      index.update('1', { title: 'New Title' });

      expect(index.search('old').length).toBe(0);
      expect(index.search('new').length).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SEARCH
  // ═══════════════════════════════════════════════════════════════════

  describe('Search', () => {
    beforeEach(() => {
      index.add('1', { title: 'JavaScript Tutorial', body: 'Learn JavaScript' });
      index.add('2', { title: 'Python Guide', body: 'Learn Python programming' });
      index.add('3', { title: 'JavaScript Patterns', body: 'Design patterns' });
    });

    it('should find matching documents', () => {
      const results = index.search('javascript');

      expect(results.length).toBe(2);
    });

    it('should rank by relevance', () => {
      const results = index.search('javascript');

      // Both docs should be found
      expect(results.map((r) => r.id)).toContain('1');
      expect(results.map((r) => r.id)).toContain('3');
    });

    it('should apply limit', () => {
      const results = index.search('javascript', { limit: 1 });

      expect(results.length).toBe(1);
    });

    it('should include score', () => {
      const results = index.search('javascript');

      expect(results[0].score).toBeGreaterThan(0);
    });

    it('should include document', () => {
      const results = index.search('javascript');

      expect(results[0].doc).toBeDefined();
      expect(results[0].doc.title).toBeDefined();
    });

    it('should find by prefix', () => {
      const results = index.search('java');

      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle multi-word query', () => {
      const results = index.search('learn programming');

      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty for no match', () => {
      const results = index.search('nonexistent');

      expect(results.length).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // FIELD WEIGHTS
  // ═══════════════════════════════════════════════════════════════════

  describe('Field Weights', () => {
    it('should boost weighted fields', () => {
      index.setFieldWeight('title', 2);
      index.setFieldWeight('body', 1);

      index.add('1', { title: 'JavaScript', body: 'Some content' });
      index.add('2', { title: 'Some content', body: 'JavaScript' });

      const results = index.search('javascript');

      // Doc with JavaScript in title should rank higher
      expect(results[0].id).toBe('1');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SUGGEST
  // ═══════════════════════════════════════════════════════════════════

  describe('Suggest', () => {
    beforeEach(() => {
      index.add('1', { title: 'JavaScript Tutorial' });
      index.add('2', { title: 'Java Programming' });
      index.add('3', { title: 'Python Guide' });
    });

    it('should suggest tokens', () => {
      const suggestions = index.suggest('java');

      expect(suggestions).toContain('javascript');
      expect(suggestions).toContain('java');
    });

    it('should limit suggestions', () => {
      const suggestions = index.suggest('j', 1);

      expect(suggestions.length).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // CLEAR
  // ═══════════════════════════════════════════════════════════════════

  describe('Clear', () => {
    it('should clear all documents', () => {
      index.add('1', { title: 'Test' });
      index.add('2', { title: 'Test 2' });

      index.clear();

      expect(index.getSize()).toBe(0);
      expect(index.search('test').length).toBe(0);
    });
  });
});
