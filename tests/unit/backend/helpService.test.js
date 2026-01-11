/**
 * Help Service Unit Tests
 *
 * Tests for help/knowledge base article retrieval and search.
 *
 * @module tests/unit/backend/helpService.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create help service implementation
const createHelpService = () => {
  const articles = new Map();
  const categories = new Map();

  return {
    // Article CRUD
    createArticle: async (data) => {
      if (!data.title || !data.content) {
        throw new Error('Title and content are required');
      }
      const id = `help-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const article = {
        id,
        title: data.title,
        content: data.content,
        category: data.category || 'general',
        tags: data.tags || [],
        views: 0,
        helpful: 0,
        notHelpful: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      articles.set(id, article);
      return article;
    },

    getArticle: async (id) => {
      const article = articles.get(id);
      if (article) {
        article.views++;
      }
      return article || null;
    },

    updateArticle: async (id, updates) => {
      const article = articles.get(id);
      if (!article) throw new Error('Article not found');
      const updated = { ...article, ...updates, updatedAt: new Date().toISOString() };
      articles.set(id, updated);
      return updated;
    },

    deleteArticle: async (id) => {
      return articles.delete(id);
    },

    // Search
    search: async (query, options = {}) => {
      const { category, limit = 10 } = options;
      const results = [];
      const queryLower = query.toLowerCase();

      for (const article of articles.values()) {
        if (category && article.category !== category) continue;

        const titleMatch = article.title.toLowerCase().includes(queryLower);
        const contentMatch = article.content.toLowerCase().includes(queryLower);
        const tagMatch = article.tags.some((t) => t.toLowerCase().includes(queryLower));

        if (titleMatch || contentMatch || tagMatch) {
          let relevance = 0;
          if (titleMatch) relevance += 0.5;
          if (contentMatch) relevance += 0.3;
          if (tagMatch) relevance += 0.2;

          results.push({ ...article, relevance });
        }
      }

      return results.sort((a, b) => b.relevance - a.relevance).slice(0, limit);
    },

    // Categories
    getCategories: async () => {
      const cats = new Map();
      for (const article of articles.values()) {
        const count = cats.get(article.category) || 0;
        cats.set(article.category, count + 1);
      }
      return Array.from(cats.entries()).map(([name, count]) => ({ name, count }));
    },

    // Feedback
    markHelpful: async (id, helpful) => {
      const article = articles.get(id);
      if (!article) throw new Error('Article not found');
      if (helpful) article.helpful++;
      else article.notHelpful++;
      return article;
    },

    // Popular articles
    getPopular: async (limit = 5) => {
      return Array.from(articles.values())
        .sort((a, b) => b.views - a.views)
        .slice(0, limit);
    },

    // Helpers
    clear: () => articles.clear(),
  };
};

describe('HelpService', () => {
  let helpService;

  beforeEach(() => {
    helpService = createHelpService();
  });

  describe('Article CRUD', () => {
    it('should create a help article', async () => {
      const article = await helpService.createArticle({
        title: 'Getting Started',
        content: 'Welcome to our platform!',
        category: 'onboarding',
        tags: ['beginner', 'tutorial'],
      });

      expect(article.id).toBeDefined();
      expect(article.title).toBe('Getting Started');
      expect(article.category).toBe('onboarding');
      expect(article.tags).toContain('beginner');
    });

    it('should require title and content', async () => {
      await expect(helpService.createArticle({})).rejects.toThrow('Title and content are required');
    });

    it('should get article by ID and increment views', async () => {
      const created = await helpService.createArticle({
        title: 'Test Article',
        content: 'Test content',
      });

      const article = await helpService.getArticle(created.id);
      expect(article.views).toBe(1);

      await helpService.getArticle(created.id);
      const updated = await helpService.getArticle(created.id);
      expect(updated.views).toBe(3);
    });

    it('should return null for non-existent article', async () => {
      const article = await helpService.getArticle('non-existent');
      expect(article).toBeNull();
    });

    it('should update article', async () => {
      const created = await helpService.createArticle({
        title: 'Original Title',
        content: 'Original content',
      });

      const updated = await helpService.updateArticle(created.id, {
        title: 'Updated Title',
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.content).toBe('Original content');
    });

    it('should delete article', async () => {
      const created = await helpService.createArticle({
        title: 'Delete Me',
        content: 'To be deleted',
      });

      const result = await helpService.deleteArticle(created.id);
      expect(result).toBe(true);

      const article = await helpService.getArticle(created.id);
      expect(article).toBeNull();
    });
  });

  describe('Search', () => {
    beforeEach(async () => {
      await helpService.createArticle({
        title: 'Getting Started Guide',
        content: 'Learn how to use the platform',
        category: 'onboarding',
        tags: ['beginner'],
      });
      await helpService.createArticle({
        title: 'Advanced Features',
        content: 'Power user tips and tricks',
        category: 'advanced',
        tags: ['power-user'],
      });
      await helpService.createArticle({
        title: 'API Documentation',
        content: 'How to integrate with our API',
        category: 'developer',
        tags: ['api', 'integration'],
      });
    });

    it('should search by title', async () => {
      const results = await helpService.search('Getting Started');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toContain('Getting Started');
    });

    it('should search by content', async () => {
      const results = await helpService.search('API');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should search by tags', async () => {
      const results = await helpService.search('beginner');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should filter by category', async () => {
      const results = await helpService.search('', { category: 'developer' });
      expect(results.every((r) => r.category === 'developer')).toBe(true);
    });

    it('should rank results by relevance', async () => {
      const results = await helpService.search('guide');
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].relevance).toBeGreaterThanOrEqual(results[i].relevance);
      }
    });
  });

  describe('Feedback', () => {
    it('should track helpful feedback', async () => {
      const created = await helpService.createArticle({
        title: 'Helpful Article',
        content: 'Very useful content',
      });

      await helpService.markHelpful(created.id, true);
      await helpService.markHelpful(created.id, true);
      await helpService.markHelpful(created.id, false);

      const article = await helpService.getArticle(created.id);
      expect(article.helpful).toBe(2);
      expect(article.notHelpful).toBe(1);
    });
  });

  describe('Popular Articles', () => {
    it('should return most viewed articles', async () => {
      const a1 = await helpService.createArticle({
        title: 'Popular Article',
        content: 'Very popular',
      });
      const a2 = await helpService.createArticle({
        title: 'Less Popular',
        content: 'Not as popular',
      });

      // Simulate views
      for (let i = 0; i < 10; i++) {
        await helpService.getArticle(a1.id);
      }
      for (let i = 0; i < 3; i++) {
        await helpService.getArticle(a2.id);
      }

      const popular = await helpService.getPopular(5);
      expect(popular[0].title).toBe('Popular Article');
    });
  });
});
