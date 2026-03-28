/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const docsHooks = vi.hoisted(() => ({
  useDocsArticle: vi.fn(() => ({
    data: {
      id: 'article-1',
      slug: 'wdrozenie',
      title: 'Wdrozenie',
      summary: 'Opis',
      content: '# Naglowek',
      reading_time_minutes: 4,
      is_featured: false,
      category_slug: 'quick-guides',
      category_name: 'Quick Guides',
      category_icon: 'book',
      view_count: 12,
      related_modules: [],
      target_audience: [],
    },
    isLoading: false,
    error: null,
  })),
  useDocsTrackView: vi.fn(() => ({
    mutate: vi.fn(),
  })),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string, params?: Record<string, unknown>) => {
      if (params?.count != null && fallback?.includes('{{count}}')) {
        return fallback.replace('{{count}}', String(params.count));
      }
      return fallback || _key;
    },
    i18n: { language: 'pl' },
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ categorySlug: 'quick-guides', articleSlug: 'wdrozenie' }),
  };
});

vi.mock('../../../src/hooks/useDocs', () => ({
  useDocsArticle: (...args: any[]) => docsHooks.useDocsArticle(...args),
  useDocsTrackView: (...args: any[]) => docsHooks.useDocsTrackView(...args),
}));

vi.mock('../../../src/services/api', () => ({
  getHeaders: () => ({ 'Content-Type': 'application/json' }),
}));

import { DocsArticleView } from '../../../src/views/docs/DocsArticleView';

describe('DocsArticleView locale wiring', () => {
  it('requests the article using the active i18n language', () => {
    render(
      <MemoryRouter>
        <DocsArticleView />
      </MemoryRouter>
    );

    expect(docsHooks.useDocsArticle).toHaveBeenCalledWith('wdrozenie', 'pl');
    expect(screen.getAllByText('Wdrozenie').length).toBeGreaterThan(0);
    expect(screen.getByText('4 min read')).toBeInTheDocument();
  });
});
