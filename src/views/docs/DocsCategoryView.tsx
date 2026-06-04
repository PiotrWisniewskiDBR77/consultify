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
      <nav className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-6">
        <Link to="/docs" className="hover:text-primary-600 dark:hover:text-primary-400">
          {t('docs.common.docs', 'Docs')}
        </Link>
        <ChevronRight size={14} />
        <span className="text-slate-900 dark:text-white font-medium">
          {currentCategory?.name || categorySlug}
        </span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          {currentCategory?.name || t('docs.category.fallbackTitle', 'Category')}
        </h1>
        {currentCategory?.description && (
          <p className="text-lg text-slate-600 dark:text-slate-400">
            {currentCategory.description}
          </p>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('docs.category.searchPlaceholder', 'Search in this category...')}
          className="w-full pl-10 pr-4 py-3 rounded-lg bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
        />
      </div>

      {/* Articles List */}
      <div className="space-y-4">
        {isLoading ? (
          // Loading skeleton
          Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="p-6 rounded-xl border border-slate-200 dark:border-navy-800 animate-pulse"
            >
              <div className="h-5 w-3/4 rounded bg-slate-200 dark:bg-navy-800 mb-2" />
              <div className="h-4 w-full rounded bg-slate-200 dark:bg-navy-800 mb-4" />
              <div className="h-3 w-32 rounded bg-slate-200 dark:bg-navy-800" />
            </div>
          ))
        ) : articles.length === 0 ? (
          <div className="text-center py-12">
            <Book size={48} className="mx-auto text-slate-600 dark:text-slate-400 mb-4" />
            <h3 className="text-lg font-medium text-slate-600 dark:text-slate-400 mb-2">
              {t('docs.category.emptyTitle', 'No articles found')}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-500">
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
                className="block p-6 rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900/50 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold mb-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                      {article.title}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">
                      {article.summary}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
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
                    className="text-slate-600 group-hover:text-primary-500 group-hover:translate-x-1 transition-all flex-shrink-0 mt-1"
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
          className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
        >
          <ArrowLeft size={16} />
          {t('docs.category.backToCategories', 'Back to all categories')}
        </Link>
      </div>
    </div>
  );
};

export default DocsCategoryView;
