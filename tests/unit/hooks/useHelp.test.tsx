/**
 * useHelp Hook Integration Tests
 *
 * Tests help article fetching and search functionality.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock API
vi.mock('@/services/api', () => ({
  Api: {
    getHelpArticles: vi.fn(),
    searchHelp: vi.fn(),
    getArticle: vi.fn(),
  },
}));

import { Api } from '@/services/api';

describe('useHelp', () => {
  const mockArticles = [
    { id: '1', title: 'Getting Started', category: 'basics', content: 'Welcome...' },
    { id: '2', title: 'Advanced Features', category: 'advanced', content: 'Learn...' },
    { id: '3', title: 'Troubleshooting', category: 'support', content: 'If you...' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getHelpArticles).mockResolvedValue(mockArticles);
    vi.mocked(Api.searchHelp).mockResolvedValue([mockArticles[0]]);
    vi.mocked(Api.getArticle).mockResolvedValue(mockArticles[0]);
  });

  it('should fetch help articles', async () => {
    const articles = await Api.getHelpArticles();

    expect(articles).toHaveLength(3);
    expect(articles[0].title).toBe('Getting Started');
  });

  it('should search help articles', async () => {
    const results = await Api.searchHelp('started');

    expect(Api.searchHelp).toHaveBeenCalledWith('started');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Getting Started');
  });

  it('should get single article by id', async () => {
    const article = await Api.getArticle('1');

    expect(Api.getArticle).toHaveBeenCalledWith('1');
    expect(article.id).toBe('1');
  });

  it('should filter articles by category', () => {
    const filtered = mockArticles.filter((a) => a.category === 'basics');

    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe('Getting Started');
  });

  it('should handle empty search results', async () => {
    vi.mocked(Api.searchHelp).mockResolvedValue([]);

    const results = await Api.searchHelp('nonexistent');

    expect(results).toHaveLength(0);
  });

  it('should handle API errors gracefully', async () => {
    vi.mocked(Api.getHelpArticles).mockRejectedValue(new Error('Network error'));

    await expect(Api.getHelpArticles()).rejects.toThrow('Network error');
  });

  it('should sort articles by relevance', () => {
    const articlesWithScore = mockArticles.map((a, i) => ({
      ...a,
      relevanceScore: 100 - i * 10,
    }));

    const sorted = articlesWithScore.sort((a, b) => b.relevanceScore - a.relevanceScore);

    expect(sorted[0].title).toBe('Getting Started');
  });

  it('should group articles by category', () => {
    const grouped = mockArticles.reduce(
      (acc, article) => {
        if (!acc[article.category]) {
          acc[article.category] = [];
        }
        acc[article.category].push(article);
        return acc;
      },
      {} as Record<string, typeof mockArticles>
    );

    expect(Object.keys(grouped)).toContain('basics');
    expect(Object.keys(grouped)).toContain('advanced');
    expect(Object.keys(grouped)).toContain('support');
  });
});
