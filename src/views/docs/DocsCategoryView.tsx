/**
 * Documentation Category View
 *
 * Lists articles within a specific documentation category.
 *
 * Route: /docs/:categorySlug
 */

import { motion } from 'framer-motion';
import { ArrowLeft, Book, ChevronRight, Clock, Eye, Search } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { KbArticleListItem, KbCategory, useDocsArticles, useDocsCategories } from '@/hooks/useDocs';
import { cn } from '@/lib/utils';

export const DocsCategoryView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { categorySlug } = useParams<{ categorySlug: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const docsLanguage = i18n.language?.startsWith('pl') ? 'pl' : 'en';

  const { data: categories } = useDocsCategories(docsLanguage);
  const { data: articlesData, isLoading } = useDocsArticles({
    language: docsLanguage,
    categorySlug,
    search: searchQuery || undefined,
  });

  const currentCategory = (categories || []).find((c: KbCategory) => c.slug === categorySlug);
  const articles = (articlesData?.articles || []) as KbArticleListItem[];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-c-text-muted mb-6">
        <Link to="/docs" className="hover:text-c-accent">
          {t('docs.common.docs', 'Docs')}
        </Link>
        <ChevronRight size={14} />
        <span className="text-c-text font-medium">
          {currentCategory?.name || categorySlug}
        </span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          {currentCategory?.name || t('docs.category.fallbackTitle', 'Category')}
        </h1>
        {currentCategory?.description && (
          <p className="text-lg text-c-text-secondary">
            {currentCategory.description}
          </p>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-c-text-muted" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('docs.category.searchPlaceholder', 'Search in this category...')}
          className="w-full pl-10 pr-4 py-3 rounded-lg bg-c-surface-raised border border-c-border focus:outline-none focus:ring-2 focus:ring-c-focus transition-all"
        />
      </div>

      {/* Articles List */}
      <div className="space-y-4">
        {isLoading ? (
          // Loading skeleton
          Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="p-6 rounded-xl border border-c-border animate-pulse"
            >
              <div className="h-5 w-3/4 rounded bg-c-border mb-2" />
              <div className="h-4 w-full rounded bg-c-border mb-4" />
              <div className="h-3 w-32 rounded bg-c-border" />
            </div>
          ))
        ) : articles.length === 0 ? (
          <div className="text-center py-12">
            <Book size={48} className="mx-auto text-c-text-secondary mb-4" />
            <h3 className="text-lg font-medium text-c-text-secondary mb-2">
              {t('docs.category.emptyTitle', 'No articles found')}
            </h3>
            <p className="text-sm text-c-text-muted">
              {searchQuery
                ? t('docs.category.emptySearch', 'Try adjusting your search query')
                : t('docs.category.emptyCategory', 'This category is empty')}
            </p>
          </div>
        ) : (
          articles.map((article: KbArticleListItem, index: number) => (
            <motion.div
              key={article.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link
                to={`/docs/${categorySlug}/${article.slug}`}
                className="block p-6 rounded-xl border border-c-border bg-c-surface hover:border-c-accent hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold mb-1 group-hover:text-c-accent transition-colors">
                      {article.title}
                    </h3>
                    <p className="text-sm text-c-text-secondary mb-3 line-clamp-2">
                      {article.summary}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-c-text-muted">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {t('docs.common.readTime', '{{count}} min read', {
                          count: article.reading_time_minutes,
                        })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye size={12} />
                        {t('docs.common.views', '{{count}} views', { count: article.view_count })}
                      </span>
                      {article.is_featured && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-medium">
                          {t('docs.common.featured', 'Featured')}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight
                    size={20}
                    className="text-c-text-muted group-hover:text-c-accent group-hover:translate-x-1 transition-all flex-shrink-0 mt-1"
                  />
                </div>
              </Link>
            </motion.div>
          ))
        )}
      </div>

      {/* Back Link */}
      <div className="mt-8">
        <Link
          to="/docs"
          className="inline-flex items-center gap-2 text-sm text-c-text-secondary hover:text-c-accent transition-colors"
        >
          <ArrowLeft size={16} />
          {t('docs.category.backToCategories', 'Back to all categories')}
        </Link>
      </div>
    </div>
  );
};

export default DocsCategoryView;
