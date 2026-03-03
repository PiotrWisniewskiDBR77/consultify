/**
 * Search Service Unit Tests
 * Tests full-text search, filtering, and ranking
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// In-memory search service for testing
const createSearchService = () => {
  const documents = new Map();

  const tokenize = (text) => {
    return (text || '')
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0);
  };

  const calculateScore = (doc, queryTokens) => {
    const docTokens = tokenize(doc.content);
    const titleTokens = tokenize(doc.title);
    let score = 0;

    for (const token of queryTokens) {
      // Title matches worth more
      if (titleTokens.includes(token)) score += 2;
      // Content matches
      const contentMatches = docTokens.filter((t) => t.includes(token)).length;
      score += contentMatches * 0.5;
    }

    // Boost recent documents
    if (doc.createdAt) {
      const daysSinceCreation =
        (Date.now() - new Date(doc.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceCreation < 7) score *= 1.2;
    }

    return score;
  };

  return {
    index: (id, document) => {
      documents.set(id, {
        ...document,
        id,
        tokens: tokenize(`${document.title} ${document.content}`),
        indexedAt: new Date(),
      });
    },

    search: (query, options = {}) => {
      const queryTokens = tokenize(query);
      const results = [];

      for (const [id, doc] of documents) {
        // Apply filters
        if (options.type && doc.type !== options.type) continue;
        if (options.status && doc.status !== options.status) continue;
        if (options.organizationId && doc.organizationId !== options.organizationId) continue;

        const score = calculateScore(doc, queryTokens);
        if (score > 0) {
          results.push({ id, ...doc, score });
        }
      }

      // Sort by score descending
      results.sort((a, b) => b.score - a.score);

      // Apply pagination
      const limit = options.limit || 10;
      const offset = options.offset || 0;

      return {
        results: results.slice(offset, offset + limit),
        total: results.length,
        query,
        took: Math.floor(Math.random() * 50) + 5,
      };
    },

    suggest: (prefix, options = {}) => {
      const limit = options.limit || 5;
      const suggestions = new Set();

      for (const doc of documents.values()) {
        for (const token of doc.tokens) {
          if (token.startsWith(prefix.toLowerCase()) && suggestions.size < limit) {
            suggestions.add(token);
          }
        }
      }

      return Array.from(suggestions);
    },

    remove: (id) => documents.delete(id),

    clear: () => documents.clear(),

    count: () => documents.size,
  };
};

describe('SearchService', () => {
  let searchService;

  beforeEach(() => {
    searchService = createSearchService();
  });

  describe('Document Indexing', () => {
    it('should index document', () => {
      searchService.index('doc-1', {
        title: 'Project Alpha',
        content: 'This is the first project',
        type: 'project',
      });

      expect(searchService.count()).toBe(1);
    });

    it('should index multiple documents', () => {
      searchService.index('doc-1', { title: 'Doc 1', content: 'Content 1' });
      searchService.index('doc-2', { title: 'Doc 2', content: 'Content 2' });
      searchService.index('doc-3', { title: 'Doc 3', content: 'Content 3' });

      expect(searchService.count()).toBe(3);
    });
  });

  describe('Basic Search', () => {
    it('should find documents by query', () => {
      searchService.index('doc-1', { title: 'Project Alpha', content: 'Development project' });
      searchService.index('doc-2', { title: 'Task Beta', content: 'Testing task' });

      const result = searchService.search('project');

      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0].title).toContain('Project');
    });

    it('should return total count', () => {
      searchService.index('doc-1', { title: 'Alpha', content: 'unique' });
      searchService.index('doc-2', { title: 'Beta', content: 'unique' });
      searchService.index('doc-3', { title: 'Gamma', content: 'different' });

      const result = searchService.search('unique');

      expect(result.total).toBe(2);
    });

    it('should rank by relevance', () => {
      searchService.index('doc-1', { title: 'Other', content: 'project mentioned once' });
      searchService.index('doc-2', { title: 'Project', content: 'project project project' });

      const result = searchService.search('project');

      expect(result.results[0].id).toBe('doc-2');
      expect(result.results[0].score).toBeGreaterThan(result.results[1].score);
    });
  });

  describe('Filtering', () => {
    it('should filter by type', () => {
      searchService.index('doc-1', { title: 'Project A', content: 'content', type: 'project' });
      searchService.index('doc-2', { title: 'Task A', content: 'content', type: 'task' });

      const result = searchService.search('content', { type: 'project' });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].type).toBe('project');
    });

    it('should filter by status', () => {
      searchService.index('doc-1', { title: 'Active', content: 'test', status: 'active' });
      searchService.index('doc-2', { title: 'Archived', content: 'test', status: 'archived' });

      const result = searchService.search('test', { status: 'active' });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].status).toBe('active');
    });

    it('should filter by organization', () => {
      searchService.index('doc-1', { title: 'Org1 Doc', content: 'test', organizationId: 'org-1' });
      searchService.index('doc-2', { title: 'Org2 Doc', content: 'test', organizationId: 'org-2' });

      const result = searchService.search('test', { organizationId: 'org-1' });

      expect(result.results).toHaveLength(1);
    });
  });

  describe('Pagination', () => {
    it('should limit results', () => {
      for (let i = 0; i < 20; i++) {
        searchService.index(`doc-${i}`, { title: 'Test', content: 'match' });
      }

      const result = searchService.search('match', { limit: 5 });

      expect(result.results).toHaveLength(5);
      expect(result.total).toBe(20);
    });

    it('should support offset', () => {
      for (let i = 0; i < 10; i++) {
        searchService.index(`doc-${i}`, { title: `Doc ${i}`, content: 'match' });
      }

      const page1 = searchService.search('match', { limit: 5, offset: 0 });
      const page2 = searchService.search('match', { limit: 5, offset: 5 });

      expect(page1.results[0].id).not.toBe(page2.results[0].id);
    });
  });

  describe('Suggestions', () => {
    it('should suggest completions', () => {
      searchService.index('doc-1', { title: 'Project Management', content: 'project planning' });
      searchService.index('doc-2', { title: 'Production', content: 'production environment' });

      const suggestions = searchService.suggest('proj');

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.every((s) => s.startsWith('proj'))).toBe(true);
    });
  });

  describe('Document Removal', () => {
    it('should remove document', () => {
      searchService.index('doc-1', { title: 'Remove Me', content: 'test' });
      searchService.remove('doc-1');

      expect(searchService.count()).toBe(0);
    });

    it('should clear all documents', () => {
      searchService.index('doc-1', { title: 'A', content: 'a' });
      searchService.index('doc-2', { title: 'B', content: 'b' });
      searchService.clear();

      expect(searchService.count()).toBe(0);
    });
  });
});
