/**
 * Documentation Search Results View
 *
 * Shows search results for documentation queries.
 *
 * Route: /docs/search?q=...
 */

import { motion } from 'framer-motion';
import { ArrowLeft, Book, ChevronRight, Clock, Eye, Search } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { KbArticleListItem, useDocsSearch } from '@/hooks/useDocs';

export const DocsSearchView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';
  const [searchInput, setSearchInput] = useState(query);
  const docsLanguage = i18n.language?.startsWith('pl') ? 'pl' : 'en';

  const { data: results, isLoading } = useDocsSearch(query, docsLanguage);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      navigate(`/docs/search?q=${encodeURIComponent(searchInput.trim())}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-6">
        <Link to="/docs" className="hover:text-primary-600 dark:hover:text-primary-400">
          {t('docs.common.docs', 'Docs')}
        </Link>
        <ChevronRight size={14} />
        <span className="text-slate-900 dark:text-white font-medium">
          {t('docs.search.title', 'Search')}
        </span>
      </nav>

      {/* Search Box */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="relative">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('docs.search.placeholder', 'Search documentation...')}
            className="w-full pl-12 pr-4 py-4 rounded-xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
            autoFocus
          />
        </div>
      </form>

      {/* Results Header */}
      {query && (
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1">
            {t('docs.search.resultsFor', 'Search results for "{{query}}"', { query })}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {isLoading
              ? t('docs.search.searching', 'Searching...')
              : t('docs.search.resultsCount', '{{count}} results found', {
                  count: results?.length || 0,
                })}
          </p>
        </div>
      )}

      {/* Results List */}
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
        ) : !query ? (
          <div className="text-center py-12">
            <Search size={48} className="mx-auto text-slate-600 dark:text-slate-400 mb-4" />
            <h3 className="text-lg font-medium text-slate-600 dark:text-slate-400 mb-2">
              {t('docs.search.emptyPromptTitle', 'Enter a search query')}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-500">
              {t('docs.search.emptyPromptBody', 'Type in the search box above to find articles')}
            </p>
          </div>
        ) : results?.length === 0 ? (
          <div className="text-center py-12">
            <Book size={48} className="mx-auto text-slate-600 dark:text-slate-400 mb-4" />
            <h3 className="text-lg font-medium text-slate-600 dark:text-slate-400 mb-2">
              {t('docs.search.noResultsTitle', 'No results found')}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-500">
              {t(
                'docs.search.noResultsBody',
                'Try adjusting your search query or browse categories'
              )}
            </p>
          </div>
        ) : (
          results?.map((article: KbArticleListItem, index: number) => (
            <motion.div
              key={article.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link
                to={`/docs/${article.category_slug}/${article.slug}`}
                className="block p-6 rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900/50 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Category Badge */}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-medium mb-2">
                      <Book size={10} />
                      {article.category_name}
                    </span>

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
          {t('docs.search.backToDocs', 'Back to Documentation')}
        </Link>
      </div>
    </div>
  );
};

export default DocsSearchView;
