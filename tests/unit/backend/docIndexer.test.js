/**
 * Doc Indexer Unit Tests
 * Tests document indexing, search, and retrieval
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Doc Indexer implementation
const createDocIndexer = () => {
  const index = new Map();
  const invertedIndex = new Map(); // word -> docIds
  let counter = 0;

  const tokenize = (text) => {
    return (text || '')
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((t) => t.length > 2);
  };

  return {
    index: (docId, document) => {
      const id = docId || `doc-${Date.now()}-${++counter}`;
      const tokens = [
        ...tokenize(document.title),
        ...tokenize(document.content),
        ...(document.tags || []),
      ];

      const doc = {
        id,
        title: document.title,
        content: document.content,
        tokens,
        metadata: document.metadata || {},
        indexedAt: new Date(),
      };

      index.set(id, doc);

      // Build inverted index
      for (const token of tokens) {
        if (!invertedIndex.has(token)) {
          invertedIndex.set(token, new Set());
        }
        invertedIndex.get(token).add(id);
      }

      return { indexed: true, docId: id };
    },

    get: (docId) => index.get(docId) || null,

    search: (query, options = {}) => {
      const queryTokens = tokenize(query);
      const scores = new Map();

      for (const token of queryTokens) {
        const matchingDocs = invertedIndex.get(token);
        if (matchingDocs) {
          for (const docId of matchingDocs) {
            scores.set(docId, (scores.get(docId) || 0) + 1);
          }
        }
      }

      // Sort by score
      const results = Array.from(scores.entries())
        .map(([docId, score]) => ({
          id: docId,
          score: score / queryTokens.length,
          ...index.get(docId),
        }))
        .sort((a, b) => b.score - a.score);

      // Apply limit
      const limit = options.limit || 10;
      return {
        results: results.slice(0, limit),
        total: results.length,
        query,
      };
    },

    remove: (docId) => {
      const doc = index.get(docId);
      if (!doc) return false;

      // Remove from inverted index
      for (const token of doc.tokens) {
        const docIds = invertedIndex.get(token);
        if (docIds) {
          docIds.delete(docId);
          if (docIds.size === 0) {
            invertedIndex.delete(token);
          }
        }
      }

      return index.delete(docId);
    },

    update: (docId, updates) => {
      const existing = index.get(docId);
      if (!existing) throw new Error('Document not found');

      // Remove old tokens
      this.remove?.(docId) || index.delete(docId);

      // Re-index with updates
      return this.index?.(docId, { ...existing, ...updates }) || { indexed: true, docId };
    },

    getStats: () => ({
      totalDocuments: index.size,
      indexedTerms: invertedIndex.size,
    }),

    clear: () => {
      index.clear();
      invertedIndex.clear();
    },
  };
};

describe('DocIndexer', () => {
  let indexer;

  beforeEach(() => {
    indexer = createDocIndexer();
  });

  describe('Document Indexing', () => {
    it('should index document', () => {
      const result = indexer.index('doc-1', {
        title: 'Project Management Guide',
        content: 'This guide covers project management best practices.',
      });

      expect(result.indexed).toBe(true);
      expect(result.docId).toBe('doc-1');
    });

    it('should generate ID if not provided', () => {
      const result = indexer.index(null, { title: 'Test', content: 'Content' });
      expect(result.docId).toBeDefined();
    });

    it('should retrieve indexed document', () => {
      indexer.index('doc-1', { title: 'Test Doc', content: 'Test content' });
      const doc = indexer.get('doc-1');

      expect(doc.title).toBe('Test Doc');
    });
  });

  describe('Document Search', () => {
    it('should search documents', () => {
      indexer.index('doc-1', { title: 'Project Plan', content: 'Planning details' });
      indexer.index('doc-2', { title: 'Task List', content: 'Task management' });

      const results = indexer.search('project plan');

      expect(results.results.length).toBeGreaterThan(0);
      expect(results.results[0].id).toBe('doc-1');
    });

    it('should rank by relevance', () => {
      indexer.index('doc-1', { title: 'Other Topic', content: 'something else' });
      indexer.index('doc-2', {
        title: 'Project Guide',
        content: 'project project project project',
      });

      const results = indexer.search('project');

      expect(results.results.length).toBeGreaterThan(0);
      expect(results.results[0].id).toBe('doc-2');
    });

    it('should limit results', () => {
      for (let i = 0; i < 20; i++) {
        indexer.index(`doc-${i}`, { title: 'Match', content: 'matching content' });
      }

      const results = indexer.search('match', { limit: 5 });
      expect(results.results).toHaveLength(5);
    });
  });

  describe('Document Removal', () => {
    it('should remove document', () => {
      indexer.index('doc-1', { title: 'To Remove', content: 'Content' });
      const removed = indexer.remove('doc-1');

      expect(removed).toBe(true);
      expect(indexer.get('doc-1')).toBeNull();
    });

    it('should not find removed document in search', () => {
      indexer.index('doc-1', { title: 'Unique Term', content: 'Content' });
      indexer.remove('doc-1');

      const results = indexer.search('unique');
      expect(results.results).toHaveLength(0);
    });
  });

  describe('Statistics', () => {
    it('should return index stats', () => {
      indexer.index('doc-1', { title: 'A', content: 'content' });
      indexer.index('doc-2', { title: 'B', content: 'content' });

      const stats = indexer.getStats();

      expect(stats.totalDocuments).toBe(2);
      expect(stats.indexedTerms).toBeGreaterThan(0);
    });
  });
});
