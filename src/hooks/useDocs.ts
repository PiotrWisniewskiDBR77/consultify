/**
 * Documentation Hooks
 *
 * React Query hooks for Knowledge Base API integration.
 * Used by the public documentation portal at /docs/*
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Api } from '@/services/api';

// ============================================
// TYPES
// ============================================

export interface KbCategory {
    id: string;
    slug: string;
    name: string;
    description?: string;
    icon: string;
    article_count?: number;
}

export interface KbArticleListItem {
    id: string;
    slug: string;
    title: string;
    summary: string;
    thumbnail_url?: string;
    reading_time_minutes: number;
    is_featured: boolean;
    category_slug: string;
    category_name: string;
    category_icon: string;
    view_count: number;
}

export interface KbArticle extends KbArticleListItem {
    content: string;
    video_url?: string;
    video_teaser_url?: string;
    related_modules: string[];
    target_audience: string[];
    video_script?: string;
}

// ============================================
// API FUNCTIONS
// ============================================

const fetchCategories = async (language: string = 'en'): Promise<KbCategory[]> => {
    // Use the existing knowledge base API
    const response = await fetch(`/api/knowledge-base/categories?lang=${language}`);
    if (!response.ok) throw new Error('Failed to fetch categories');
    const data = await response.json();
    return data.categories || data || [];
};

const fetchArticles = async (params: {
    language?: string;
    categorySlug?: string;
    search?: string;
    limit?: number;
    offset?: number;
}): Promise<{ articles: KbArticleListItem[]; total: number }> => {
    const searchParams = new URLSearchParams();
    if (params.language) searchParams.set('lang', params.language);
    if (params.categorySlug) searchParams.set('category', params.categorySlug);
    if (params.search) searchParams.set('search', params.search);
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.offset) searchParams.set('offset', params.offset.toString());

    const response = await fetch(`/api/knowledge-base/articles?${searchParams}`);
    if (!response.ok) throw new Error('Failed to fetch articles');
    return response.json();
};

const fetchArticleBySlug = async (slug: string, language: string = 'en'): Promise<KbArticle | null> => {
    const response = await fetch(`/api/knowledge-base/articles/${slug}?lang=${language}`);
    if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch article');
    }
    return response.json();
};

const fetchFeaturedArticles = async (language: string = 'en', limit: number = 4): Promise<KbArticleListItem[]> => {
    const response = await fetch(`/api/knowledge-base/featured?lang=${language}&limit=${limit}`);
    if (!response.ok) throw new Error('Failed to fetch featured articles');
    const data = await response.json();
    return data.articles || data || [];
};

const searchArticles = async (query: string, language: string = 'en'): Promise<KbArticleListItem[]> => {
    const response = await fetch(`/api/knowledge-base/search?q=${encodeURIComponent(query)}&lang=${language}`);
    if (!response.ok) throw new Error('Failed to search articles');
    const data = await response.json();
    return data.articles || data || [];
};

const trackArticleView = async (articleId: string): Promise<void> => {
    await fetch(`/api/knowledge-base/articles/${articleId}/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
};

// ============================================
// HOOKS
// ============================================

/**
 * Fetch all documentation categories
 */
export function useDocsCategories(language: string = 'en') {
    return useQuery({
        queryKey: ['docs', 'categories', language],
        queryFn: () => fetchCategories(language),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Fetch articles with optional filtering
 */
export function useDocsArticles(params: {
    language?: string;
    categorySlug?: string;
    search?: string;
    limit?: number;
    offset?: number;
}) {
    return useQuery({
        queryKey: ['docs', 'articles', params],
        queryFn: () => fetchArticles(params),
        staleTime: 2 * 60 * 1000, // 2 minutes
    });
}

/**
 * Fetch single article by slug
 */
export function useDocsArticle(slug: string, language: string = 'en') {
    return useQuery({
        queryKey: ['docs', 'article', slug, language],
        queryFn: () => fetchArticleBySlug(slug, language),
        staleTime: 5 * 60 * 1000, // 5 minutes
        enabled: !!slug,
    });
}

/**
 * Fetch featured articles for homepage
 */
export function useDocsFeatured(language: string = 'en', limit: number = 4) {
    return useQuery({
        queryKey: ['docs', 'featured', language, limit],
        queryFn: () => fetchFeaturedArticles(language, limit),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Search articles with debouncing (handled by caller)
 */
export function useDocsSearch(query: string, language: string = 'en') {
    return useQuery({
        queryKey: ['docs', 'search', query, language],
        queryFn: () => searchArticles(query, language),
        staleTime: 60 * 1000, // 1 minute
        enabled: query.length >= 2,
    });
}

/**
 * Track article view (mutation)
 */
export function useDocsTrackView() {
    return useMutation({
        mutationFn: (articleId: string) => trackArticleView(articleId),
    });
}

export default {
    useDocsCategories,
    useDocsArticles,
    useDocsArticle,
    useDocsFeatured,
    useDocsSearch,
    useDocsTrackView,
};
