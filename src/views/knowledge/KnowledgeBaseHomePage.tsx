/**
 * Knowledge Base Home Page
 * Route: /knowledge-base
 *
 * Professional KB landing with hero, section navigation,
 * featured articles, search, and tag filtering.
 * Consumes Consultify articles from /api/public/kb-v8.
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  Brain,
  ChevronRight,
  Clock,
  Eye,
  Filter,
  Rocket,
  Search,
  Shield,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import {
  KbArticleListItem,
  KbCategory,
  useDocsArticles,
  useDocsCategories,
  useDocsFeatured,
  useDocsSearch,
} from '@/hooks/useDocs';
import {
  useKnowledgeCollections,
  useKnowledgeTags,
} from '@/hooks/useKnowledge';
import { cn } from '@/lib/utils';

const SECTION_ICONS: Record<string, React.ReactNode> = {
  'consultify-governance-and-roi': <Shield size={20} />,
  'consultify-execution-and-rollout': <Rocket size={20} />,
  'consultify-ai-and-decision-making': <Brain size={20} />,
};

const SECTION_COLORS: Record<string, string> = {
  'consultify-governance-and-roi': 'from-emerald-500 to-teal-600',
  'consultify-execution-and-rollout': 'from-purple-500 to-indigo-600',
  'consultify-ai-and-decision-making': 'from-amber-500 to-orange-600',
};

const SECTION_BG: Record<string, string> = {
  'consultify-governance-and-roi': 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
  'consultify-execution-and-rollout': 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
  'consultify-ai-and-decision-making': 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
};

export const KnowledgeBaseHomePage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [activeSearch, setActiveSearch] = useState(searchParams.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const docsLanguage = i18n.language?.startsWith('pl') ? 'pl' : i18n.language?.startsWith('de') ? 'de' : 'en';

  const { data: categories } = useDocsCategories(docsLanguage);
  const { data: featured } = useDocsFeatured(docsLanguage, 6);
  const { data: searchResults } = useDocsSearch(activeSearch, docsLanguage);
  const { data: tags } = useKnowledgeTags(docsLanguage);

  const consultifyCategories = useMemo(() =>
    categories?.filter((c: KbCategory) => c.slug.startsWith('consultify-')) || [],
    [categories]
  );

  const { data: categoryArticles } = useDocsArticles({
    language: docsLanguage,
    categorySlug: selectedCategory || undefined,
    limit: 50,
  });

  const displayArticles = useMemo(() => {
    if (activeSearch && searchResults?.length) return searchResults;
    if (selectedCategory && categoryArticles?.length) return categoryArticles;
    return null;
  }, [activeSearch, searchResults, selectedCategory, categoryArticles]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchQuery.trim());
    setSelectedCategory(null);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setActiveSearch('');
    setSelectedCategory(null);
    setSelectedTag(null);
  };

  const isFiltering = !!activeSearch || !!selectedCategory || !!selectedTag;

  return (
    <div className="min-h-screen bg-white dark:bg-navy-950">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-indigo-900">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-500/20 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-grid-white/[0.02]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-sm text-purple-200 mb-6">
              <Sparkles size={14} />
              <span>{t('kb.hero.badge', '50 expert articles on transformation management')}</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-tight">
              {t('kb.hero.title', 'Knowledge Base')}
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-purple-100/80 leading-relaxed max-w-2xl mx-auto">
              {t('kb.hero.subtitle', 'Governance, execution, and AI decision support for transformation leaders. Built from real industrial practice, not theory.')}
            </p>

            {/* Search */}
            <form onSubmit={handleSearch} className="mt-10 max-w-xl mx-auto">
              <div className="relative">
                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('kb.hero.searchPlaceholder', 'Search articles...')}
                  className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-white/50 text-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(''); setActiveSearch(''); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            </form>
          </motion.div>
        </div>
      </section>

      {/* Section Navigation */}
      <section className="border-b border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {consultifyCategories.map((category: KbCategory) => (
              <button
                key={category.id}
                onClick={() => {
                  setSelectedCategory(selectedCategory === category.slug ? null : category.slug);
                  setActiveSearch('');
                }}
                className={cn(
                  'group flex items-start gap-4 p-5 rounded-2xl border transition-all duration-200 text-left',
                  selectedCategory === category.slug
                    ? SECTION_BG[category.slug] || 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
                    : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-800 hover:border-slate-300 dark:hover:border-navy-700 hover:shadow-sm'
                )}
              >
                <div className={cn(
                  'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white bg-gradient-to-br',
                  SECTION_COLORS[category.slug] || 'from-purple-500 to-indigo-600'
                )}>
                  {SECTION_ICONS[category.slug] || <BookOpen size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                    {category.name}
                  </h3>
                  {category.description && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {category.description}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-1 text-xs font-medium text-purple-600 dark:text-purple-400">
                    <span>{category.article_count} {t('kb.articles', 'articles')}</span>
                    <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Tags */}
      {tags && tags.length > 0 && (
        <section className="border-b border-slate-200 dark:border-navy-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center gap-3 overflow-x-auto pb-1">
              <Tag size={14} className="flex-shrink-0 text-slate-400" />
              {tags.slice(0, 12).map((tag: any) => (
                <button
                  key={tag.id}
                  onClick={() => setSelectedTag(selectedTag === tag.slug ? null : tag.slug)}
                  className={cn(
                    'flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                    selectedTag === tag.slug
                      ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300'
                      : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  )}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Active Filters Bar */}
      {isFiltering && (
        <div className="border-b border-slate-200 dark:border-navy-800 bg-purple-50/50 dark:bg-purple-900/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Filter size={14} />
              {activeSearch && <span>{t('kb.filtering.search', 'Search')}: &ldquo;{activeSearch}&rdquo;</span>}
              {selectedCategory && (
                <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs">
                  {consultifyCategories.find((c: KbCategory) => c.slug === selectedCategory)?.name}
                </span>
              )}
            </div>
            <button onClick={clearFilters} className="text-sm text-purple-600 hover:text-purple-700 font-medium">
              {t('kb.filtering.clear', 'Clear filters')}
            </button>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {displayArticles ? (
          /* Filtered/Search Results */
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
              {activeSearch
                ? t('kb.results.searchTitle', 'Search results')
                : t('kb.results.categoryTitle', 'Articles')}
              <span className="ml-2 text-lg font-normal text-slate-500">({displayArticles.length})</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayArticles.map((article: KbArticleListItem) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          </div>
        ) : (
          /* Default: Featured + Sections */
          <div className="space-y-16">
            {/* Featured Articles */}
            {featured && featured.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                      {t('kb.featured.title', 'Featured Articles')}
                    </h2>
                    <p className="mt-1 text-slate-500 dark:text-slate-400">
                      {t('kb.featured.subtitle', 'Start here for the most impactful insights')}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {featured.map((article: KbArticleListItem) => (
                    <ArticleCard key={article.id} article={article} featured />
                  ))}
                </div>
              </div>
            )}

            {/* Section Previews */}
            {consultifyCategories.map((category: KbCategory) => (
              <SectionPreview key={category.id} category={category} language={docsLanguage} />
            ))}
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <section className="bg-gradient-to-r from-purple-600 to-indigo-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-3xl font-bold text-white">
            {t('kb.cta.title', 'Ready to transform how you manage change?')}
          </h2>
          <p className="mt-4 text-lg text-purple-100">
            {t('kb.cta.subtitle', 'See how Consultify connects strategy, governance, and execution in one system.')}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/trial/start"
              className="px-8 py-3 rounded-xl bg-white text-purple-700 font-semibold hover:bg-purple-50 transition-colors"
            >
              {t('kb.cta.trial', 'Start Free Trial')}
            </Link>
            <Link
              to="/demo"
              className="px-8 py-3 rounded-xl border-2 border-white/30 text-white font-semibold hover:bg-white/10 transition-colors"
            >
              {t('kb.cta.demo', 'Book a Demo')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

const ArticleCard: React.FC<{ article: KbArticleListItem; featured?: boolean }> = ({ article, featured }) => {
  const { t } = useTranslation();

  return (
    <Link
      to={`/knowledge-base/${article.category_slug}/${article.slug}`}
      className={cn(
        'group flex flex-col rounded-2xl border transition-all duration-200 overflow-hidden',
        featured
          ? 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-800 hover:shadow-lg hover:border-purple-300 dark:hover:border-purple-700'
          : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-800 hover:shadow-md hover:border-slate-300 dark:hover:border-navy-700'
      )}
    >
      {/* Thumbnail */}
      {article.thumbnail_url ? (
        <div className="relative aspect-[16/9] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-navy-800 dark:to-navy-900 overflow-hidden">
          <img
            src={article.thumbnail_url}
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
          {featured && article.is_featured && (
            <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-amber-500/90 text-white text-xs font-medium backdrop-blur-sm">
              {t('kb.card.featured', 'Featured')}
            </span>
          )}
        </div>
      ) : (
        <div className="relative aspect-[16/9] bg-gradient-to-br from-purple-900/80 to-indigo-900/80 flex items-center justify-center">
          <BookOpen size={32} className="text-white/30" />
        </div>
      )}

      <div className="p-6 flex-1 flex flex-col">
        {/* Category badge */}
        <div className="flex items-center gap-2 mb-3">
          {article.category_name && (
            <span className="px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium">
              {article.category_name}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors line-clamp-2">
          {article.title}
        </h3>

        {/* Summary */}
        {article.summary && (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 line-clamp-3 flex-1">
            {article.summary}
          </p>
        )}

        {/* Meta */}
        <div className="mt-4 flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500">
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

      {/* Read more */}
      <div className="px-6 py-3 border-t border-slate-100 dark:border-navy-800 flex items-center justify-between">
        <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
          {t('kb.card.read', 'Read article')}
        </span>
        <ArrowRight size={14} className="text-purple-600 dark:text-purple-400 group-hover:translate-x-1 transition-transform" />
      </div>
    </Link>
  );
};

const SectionPreview: React.FC<{ category: KbCategory; language: string }> = ({ category, language }) => {
  const { t } = useTranslation();
  const { data: articles } = useDocsArticles({
    language,
    categorySlug: category.slug,
    limit: 4,
  });

  if (!articles?.length) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center text-white bg-gradient-to-br',
            SECTION_COLORS[category.slug] || 'from-purple-500 to-indigo-600'
          )}>
            {SECTION_ICONS[category.slug] || <BookOpen size={20} />}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{category.name}</h2>
            {category.description && (
              <p className="text-sm text-slate-500 dark:text-slate-400">{category.description}</p>
            )}
          </div>
        </div>
        <Link
          to={`/knowledge-base/${category.slug}`}
          className="flex items-center gap-1 text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700"
        >
          {t('kb.section.viewAll', 'View all')}
          <ChevronRight size={14} />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {articles.slice(0, 4).map((article: KbArticleListItem) => (
          <Link
            key={article.id}
            to={`/knowledge-base/${category.slug}/${article.slug}`}
            className="group p-4 rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 hover:shadow-sm hover:border-slate-300 dark:hover:border-navy-700 transition-all"
          >
            <h4 className="font-medium text-sm text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors line-clamp-2">
              {article.title}
            </h4>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
              {article.summary}
            </p>
            <div className="mt-3 flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 font-medium">
              <span>{t('kb.card.read', 'Read article')}</span>
              <ArrowRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default KnowledgeBaseHomePage;
