/**
 * Knowledge Base Category Page
 * Route: /knowledge-base/:categorySlug
 *
 * Lists all articles within a KB section (category).
 */

import { ArrowRight, BookOpen, ChevronRight, Clock, Eye, Home } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { KbArticleListItem, KbCategory, useDocsArticles, useDocsCategories } from '@/hooks/useDocs';
import { cn } from '@/lib/utils';

export const KnowledgeBaseCategoryPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { categorySlug } = useParams<{ categorySlug: string }>();
  const docsLanguage = i18n.language?.startsWith('pl') ? 'pl' : i18n.language?.startsWith('de') ? 'de' : 'en';

  const { data: categories } = useDocsCategories(docsLanguage);
  const category = categories?.find((c: KbCategory) => c.slug === categorySlug);

  const { data: articles, isLoading } = useDocsArticles({
    language: docsLanguage,
    categorySlug: categorySlug || undefined,
    limit: 50,
  });

  const featuredArticles = articles?.filter((a: KbArticleListItem) => a.is_featured) || [];
  const otherArticles = articles?.filter((a: KbArticleListItem) => !a.is_featured) || [];

  return (
    <div className="min-h-screen bg-white dark:bg-navy-950">
      {/* Breadcrumb */}
      <div className="border-b border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <nav className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Link to="/knowledge-base" className="flex items-center gap-1 hover:text-purple-600 transition-colors">
              <Home size={14} />
              <span>{t('kb.breadcrumb.home', 'Knowledge Base')}</span>
            </Link>
            <ChevronRight size={14} />
            <span className="text-slate-900 dark:text-white font-medium">
              {category?.name || categorySlug}
            </span>
          </nav>
        </div>
      </div>

      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-3xl">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
            {category?.name || categorySlug}
          </h1>
          {category?.description && (
            <p className="mt-4 text-lg text-slate-500 dark:text-slate-400">
              {category.description}
            </p>
          )}
          <div className="mt-4 text-sm text-slate-400">
            {articles?.length || 0} {t('kb.articles', 'articles')}
          </div>
        </div>
      </div>

      {/* Articles */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-slate-200 dark:border-navy-800 p-6">
                <div className="h-4 bg-slate-200 dark:bg-navy-800 rounded w-1/3 mb-4" />
                <div className="h-5 bg-slate-200 dark:bg-navy-800 rounded w-full mb-2" />
                <div className="h-5 bg-slate-200 dark:bg-navy-800 rounded w-2/3 mb-4" />
                <div className="h-3 bg-slate-200 dark:bg-navy-800 rounded w-full mb-2" />
                <div className="h-3 bg-slate-200 dark:bg-navy-800 rounded w-4/5" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-12">
            {featuredArticles.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <BookOpen size={18} className="text-purple-500" />
                  {t('kb.category.featured', 'Featured')}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {featuredArticles.map((article: KbArticleListItem) => (
                    <ArticleCard key={article.id} article={article} categorySlug={categorySlug!} />
                  ))}
                </div>
              </div>
            )}

            {otherArticles.length > 0 && (
              <div>
                {featuredArticles.length > 0 && (
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                    {t('kb.category.all', 'All Articles')}
                  </h2>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {otherArticles.map((article: KbArticleListItem) => (
                    <ArticleCard key={article.id} article={article} categorySlug={categorySlug!} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const ArticleCard: React.FC<{ article: KbArticleListItem; categorySlug: string }> = ({ article, categorySlug }) => {
  const { t } = useTranslation();

  return (
    <Link
      to={`/knowledge-base/${categorySlug}/${article.slug}`}
      className="group flex flex-col rounded-2xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 hover:shadow-md hover:border-slate-300 dark:hover:border-navy-700 transition-all overflow-hidden"
    >
      <div className="p-6 flex-1 flex flex-col">
        {article.is_featured && (
          <span className="self-start px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-medium mb-3">
            {t('kb.card.featured', 'Featured')}
          </span>
        )}
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors line-clamp-2">
          {article.title}
        </h3>
        {article.summary && (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 line-clamp-3 flex-1">
            {article.summary}
          </p>
        )}
        <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {article.reading_time_minutes} {t('kb.card.min', 'min')}
          </span>
          {article.view_count > 0 && (
            <span className="flex items-center gap-1">
              <Eye size={12} />
              {article.view_count}
            </span>
          )}
        </div>
      </div>
      <div className="px-6 py-3 border-t border-slate-100 dark:border-navy-800 flex items-center justify-between">
        <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
          {t('kb.card.read', 'Read article')}
        </span>
        <ArrowRight size={14} className="text-purple-600 dark:text-purple-400 group-hover:translate-x-1 transition-transform" />
      </div>
    </Link>
  );
};

export default KnowledgeBaseCategoryPage;
