/**
 * Help Service Unit Tests
 *
 * Tests for help/knowledge base article retrieval and search.
 * Tests the real HelpService via mocked database calls.
 *
 * @module tests/unit/backend/helpService.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = {
  all: vi.fn(),
  get: vi.fn(),
  run: vi.fn(),
};

vi.mock('../../../server/src/database/Database.js', () => ({
  getDatabase: vi.fn().mockResolvedValue(mockDb),
}));

const { default: helpService } = await import(
  '../../../server/src/services/helpService.js'
);

describe('HelpService (production)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getArticles', () => {
    it('returns mapped articles from DB', async () => {
      mockDb.all.mockResolvedValue([
        {
          id: 'a1',
          category: 'getting-started',
          subcategory: null,
          title: 'Getting Started',
          slug: 'getting-started',
          content: 'Welcome!',
          excerpt: 'Intro',
          video_url: null,
          video_duration_seconds: null,
          related_module: 'dashboard',
          tags: '["intro","onboarding"]',
          is_published: 1,
          view_count: 10,
          helpful_count: 5,
          not_helpful_count: 1,
        },
      ]);

      const articles = await helpService.getArticles();

      expect(articles).toHaveLength(1);
      expect(articles[0].title).toBe('Getting Started');
      expect(articles[0].tags).toEqual(['intro', 'onboarding']);
      expect(articles[0].isPublished).toBe(true);
    });

    it('applies category filter', async () => {
      mockDb.all.mockResolvedValue([]);

      await helpService.getArticles({ category: 'tools' });

      const query = mockDb.all.mock.calls[0][0];
      expect(query).toContain('category = ?');
      expect(mockDb.all.mock.calls[0][1]).toContain('tools');
    });

    it('applies search filter to title, content and tags', async () => {
      mockDb.all.mockResolvedValue([]);

      await helpService.getArticles({ search: 'maturity' });

      const query = mockDb.all.mock.calls[0][0];
      expect(query).toContain('title LIKE ?');
      expect(query).toContain('content LIKE ?');
      expect(query).toContain('tags LIKE ?');
    });

    it('returns empty array when DB returns null', async () => {
      mockDb.all.mockResolvedValue(null);

      const articles = await helpService.getArticles();

      expect(articles).toEqual([]);
    });
  });

  describe('getArticleBySlug', () => {
    it('returns article and increments view count', async () => {
      mockDb.get.mockResolvedValue({
        id: 'a2',
        category: 'guides',
        subcategory: null,
        title: 'Guide',
        slug: 'test-guide',
        content: 'Content here',
        excerpt: '',
        video_url: null,
        video_duration_seconds: null,
        related_module: null,
        tags: '[]',
        is_published: 1,
        view_count: 5,
        helpful_count: 0,
        not_helpful_count: 0,
      });
      mockDb.run.mockResolvedValue(undefined);

      const article = await helpService.getArticleBySlug('test-guide');

      expect(article).not.toBeNull();
      expect(article.slug).toBe('test-guide');
      expect(article.viewCount).toBe(6);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('view_count = view_count + 1'),
        ['a2']
      );
    });

    it('returns null for non-existent slug', async () => {
      mockDb.get.mockResolvedValue(null);

      const article = await helpService.getArticleBySlug('non-existent');

      expect(article).toBeNull();
    });
  });

  describe('getModuleHelp', () => {
    it('returns module help when found', async () => {
      mockDb.get.mockResolvedValue({
        id: 'm1',
        module_key: 'dashboard',
        title: 'Dashboard Help',
        short_description: 'Overview of dashboard',
        video_url: '/vid/dash.mp4',
        video_duration_seconds: 120,
        article_id: 'a1',
        tips: '["tip1","tip2"]',
      });

      const help = await helpService.getModuleHelp('dashboard');

      expect(help).not.toBeNull();
      expect(help.moduleKey).toBe('dashboard');
      expect(help.tips).toEqual(['tip1', 'tip2']);
    });

    it('returns null when module not found', async () => {
      mockDb.get.mockResolvedValue(null);

      const help = await helpService.getModuleHelp('nonexistent');

      expect(help).toBeNull();
    });
  });

  describe('submitArticleFeedback', () => {
    it('increments helpful_count when isHelpful=true', async () => {
      mockDb.run.mockResolvedValue(undefined);

      await helpService.submitArticleFeedback('a1', 'u1', true);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('helpful_count = helpful_count + 1'),
        ['a1']
      );
    });

    it('increments not_helpful_count when isHelpful=false', async () => {
      mockDb.run.mockResolvedValue(undefined);

      await helpService.submitArticleFeedback('a1', 'u1', false);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('not_helpful_count = not_helpful_count + 1'),
        ['a1']
      );
    });
  });

  describe('isTooltipDismissed', () => {
    it('returns false when no dismissal exists', async () => {
      mockDb.get.mockResolvedValue(null);

      const result = await helpService.isTooltipDismissed('u1', 'tip-1');

      expect(result).toBe(false);
    });

    it('returns true for forever dismissal', async () => {
      mockDb.get.mockResolvedValue({ show_again_at: null });

      const result = await helpService.isTooltipDismissed('u1', 'tip-1');

      expect(result).toBe(true);
    });
  });
});
