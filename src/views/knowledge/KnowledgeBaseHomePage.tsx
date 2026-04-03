/**
 * Knowledge Base Home Page
 * Route: /knowledge-base
 *
 * Premium KB landing matching the LP dark glass aesthetic.
 * Wrapped in MarketingLayout for consistent top bar + footer.
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Clock,
  Eye,
  Filter,
  GraduationCap,
  Search,
  Tag,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';

import { MarketingLayout } from '@/components/Landing/MarketingLayout';
import {
  KbArticleListItem,
  KbCategory,
  useDocsArticles,
  useDocsCategories,
  useDocsFeatured,
  useDocsSearch,
} from '@/hooks/useDocs';
import { useKnowledgeTags } from '@/hooks/useKnowledge';
import { cn } from '@/lib/utils';

const SECTION_ICONS: Record<string, React.ReactNode> = {
  'consultify-why-transformations-fail': <AlertTriangle size={22} />,
  'consultify-the-money-question': <TrendingUp size={22} />,
  'consultify-decisions-that-ship': <Zap size={22} />,
};

const SECTION_ACCENT: Record<string, { gradient: string; border: string; glow: string; text: string; bg: string }> = {
  'consultify-why-transformations-fail': {
    gradient: 'from-rose-400 to-red-500',
    border: 'border-rose-500/20 hover:border-rose-500/40',
    glow: 'group-hover:shadow-[0_0_30px_-8px_rgba(244,63,94,0.35)]',
    text: 'text-rose-400',
    bg: 'bg-rose-500/10',
  },
  'consultify-the-money-question': {
    gradient: 'from-emerald-400 to-teal-500',
    border: 'border-emerald-500/20 hover:border-emerald-500/40',
    glow: 'group-hover:shadow-[0_0_30px_-8px_rgba(16,185,129,0.35)]',
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
  },
  'consultify-decisions-that-ship': {
    gradient: 'from-amber-400 to-orange-500',
    border: 'border-amber-500/20 hover:border-amber-500/40',
    glow: 'group-hover:shadow-[0_0_30px_-8px_rgba(245,158,11,0.35)]',
    text: 'text-amber-400',
    bg: 'bg-amber-500/10',
  },
};

const DEFAULT_ACCENT = SECTION_ACCENT['consultify-decisions-that-ship'];
const SECTION_META: Record<
  string,
  {
    eyebrow: string;
    hook: string;
    chips: string[];
    statLabel: string;
  }
> = {
  'consultify-why-transformations-fail': {
    eyebrow: 'Failure patterns',
    hook: 'Where stalled programs, dead initiatives, and governance theater finally become visible.',
    chips: ['Governance', 'Risk', 'Leadership'],
    statLabel: 'warning signs',
  },
  'consultify-the-money-question': {
    eyebrow: 'Board logic',
    hook: 'ROI defense, budget linkage, and board-ready evidence before the next capital ask.',
    chips: ['ROI', 'Board Room', 'Portfolio'],
    statLabel: 'board cases',
  },
  'consultify-decisions-that-ship': {
    eyebrow: 'Execution moves',
    hook: 'Turn decision latency into owned initiatives, cleaner prioritization, and faster follow-through.',
    chips: ['Execution', 'AI Strategy', 'Decision Speed'],
    statLabel: 'execution plays',
  },
};

const ARTICLES_PER_PAGE = 12;
const CARD_TAG_LIMIT = 4;

function getVisibleArticleTags(article: KbArticleListItem, limit = CARD_TAG_LIMIT) {
  return (article.tags || []).slice(0, limit);
}

function matchesSelectedTag(article: KbArticleListItem, selectedTag: string | null) {
  if (!selectedTag) return true;
  return (article.tags || []).some((tag) => tag.slug === selectedTag);
}

export const KnowledgeBaseHomePage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [activeSearch, setActiveSearch] = useState(searchParams.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [browseLimit, setBrowseLimit] = useState(ARTICLES_PER_PAGE);

  const docsLanguage = i18n.language?.startsWith('pl') ? 'pl' : i18n.language?.startsWith('de') ? 'de' : 'en';

  const { data: categories } = useDocsCategories(docsLanguage);
  const { data: allFeatured } = useDocsFeatured(docsLanguage, 20);
  const { data: searchResults } = useDocsSearch(activeSearch, docsLanguage);
  const { data: tags } = useKnowledgeTags(docsLanguage);
  const { data: allArticlesData } = useDocsArticles({ language: docsLanguage, limit: 100 });
  const allArticles = allArticlesData?.articles;

  const consultifyCategories = useMemo(() =>
    categories?.filter((c: KbCategory) => c.slug.startsWith('consultify-')) || [],
    [categories]
  );

  const featured = useMemo(
    () =>
      allFeatured
        ?.filter((a: KbArticleListItem) => a.category_slug?.startsWith('consultify-'))
        .filter((a: KbArticleListItem) => matchesSelectedTag(a, selectedTag))
        .slice(0, 6) || [],
    [allFeatured, selectedTag]
  );

  const browseArticles = useMemo(
    () =>
      allArticles
        ?.filter((a: KbArticleListItem) => a.category_slug?.startsWith('consultify-'))
        .filter((a: KbArticleListItem) => matchesSelectedTag(a, selectedTag)) || [],
    [allArticles, selectedTag]
  );

  const { data: categoryArticlesData } = useDocsArticles({
    language: docsLanguage,
    categorySlug: selectedCategory || undefined,
    limit: 50,
  });
  const categoryArticles = categoryArticlesData?.articles;

  const displayArticles = useMemo(() => {
    if (activeSearch && searchResults?.length) {
      return searchResults
        .filter((a: KbArticleListItem) => a.category_slug?.startsWith('consultify-'))
        .filter((a: KbArticleListItem) => matchesSelectedTag(a, selectedTag));
    }
    if (selectedCategory && categoryArticles?.length) {
      return categoryArticles.filter((a: KbArticleListItem) => matchesSelectedTag(a, selectedTag));
    }
    return null;
  }, [activeSearch, searchResults, selectedCategory, categoryArticles, selectedTag]);

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
    <MarketingLayout footerVariant="knowledge">
      <div className="relative">
        {/* Ambient background */}
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 bg-[linear-gradient(160deg,#f8fafc_0%,#eef2ff_45%,#f8fafc_100%)] dark:bg-[linear-gradient(160deg,#0D0828_0%,#0A0A1F_45%,#12082E_100%)]" />
          <div
            className="absolute inset-0 opacity-[0.03] dark:opacity-[0.04]"
            style={{
              backgroundImage: 'linear-gradient(rgba(15,23,42,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.06) 1px, transparent 1px)',
              backgroundSize: '64px 64px',
              mask: 'radial-gradient(ellipse at 50% 30%, black 0%, transparent 72%)',
              WebkitMask: 'radial-gradient(ellipse at 50% 30%, black 0%, transparent 72%)',
            }}
          />
          <div className="absolute top-[-20%] left-[10%] w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(109,40,217,0.10)_0%,transparent_65%)] blur-[80px] dark:bg-[radial-gradient(circle,rgba(109,40,217,0.18)_0%,transparent_65%)]" />
          <div className="absolute bottom-[-10%] right-[5%] w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(14,165,233,0.08)_0%,transparent_65%)] blur-[90px] dark:bg-[radial-gradient(circle,rgba(0,210,255,0.10)_0%,transparent_65%)]" />
        </div>

        {/* Hero Section */}
        <section className="relative z-10 pt-20 pb-16 px-6">
          <div className="max-w-7xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary-500/35 bg-primary-600/10 backdrop-blur-sm text-xs font-bold text-primary-300 tracking-wide mb-8">
                <span>{t('kb.hero.badge', '50+ expert articles on transformation management')}</span>
              </div>

              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-slate-900 tracking-tight leading-[1.0] dark:text-white">
                {t('kb.hero.title', 'Knowledge Base')}
              </h1>

              <p className="mt-6 text-lg text-slate-600 font-medium leading-relaxed max-w-2xl mx-auto dark:text-white/55">
                {t('kb.hero.subtitle', 'Read the guides leaders use before they commit budget, launch rollout, or defend ROI. Built for moments when the next decision matters more than another opinion.')}
              </p>

              {/* Search */}
              <form onSubmit={handleSearch} className="mt-10 max-w-xl mx-auto">
                <div className="relative">
                  <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('kb.hero.searchPlaceholder', 'Search articles...')}
                    className="w-full pl-12 pr-12 py-4 rounded-2xl bg-white/90 backdrop-blur-sm border border-slate-200 text-slate-900 placeholder-slate-400 text-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500/30 transition-all dark:bg-white/[0.05] dark:border-white/[0.10] dark:text-white dark:placeholder-white/40"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => { setSearchQuery(''); setActiveSearch(''); }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors dark:text-white/40 dark:hover:text-white"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              </form>
            </motion.div>
          </div>
        </section>

        {/* Section Navigation Cards — clickable, link to category page */}
        <section className="relative z-10 px-6 pb-12">
          <div className="max-w-7xl mx-auto">
            <div className="mb-6 flex items-end justify-between gap-6">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500 dark:text-white/35">
                  {t('kb.sections.eyebrow', 'Choose the tension you want to solve')}
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  {t('kb.sections.title', 'Three sharper ways into the library')}
                </h2>
              </div>
              <p className="hidden max-w-xl text-sm leading-relaxed text-slate-600 dark:text-white/50 md:block">
                {t(
                  'kb.sections.subtitle',
                  'Each lane is framed around a real executive tension, so people can enter through failure, money, or execution instead of generic taxonomy.'
                )}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {consultifyCategories.map((category: KbCategory) => {
                const accent = SECTION_ACCENT[category.slug] || DEFAULT_ACCENT;
                const meta = SECTION_META[category.slug] || {
                  eyebrow: t('kb.sections.defaultEyebrow', 'Category'),
                  hook: category.description || '',
                  chips: [],
                  statLabel: t('kb.sections.defaultStatLabel', 'articles'),
                };
                return (
                  <Link
                    key={category.id}
                    to={`/knowledge-base/${category.slug}`}
                    className={cn(
                      'group relative overflow-hidden rounded-[28px] border p-6 text-left transition-all duration-300',
                      'min-h-[260px] md:min-h-[290px]',
                      `border-slate-200 bg-white/95 backdrop-blur-sm hover:bg-white ${accent.border} dark:border-white/[0.08] dark:bg-slate-950/65 dark:hover:bg-slate-950/78`,
                      accent.glow
                    )}
                  >
                    <div className="pointer-events-none absolute inset-0">
                      <div className={cn('absolute right-[-18%] top-[-10%] h-40 w-40 rounded-full blur-3xl opacity-25', accent.bg)} />
                      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/14" />
                    </div>
                    <div className="relative flex h-full flex-col">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-white/45">
                            {meta.eyebrow}
                          </p>
                          <h3 className="mt-3 max-w-[15ch] text-2xl font-black leading-[1.02] tracking-tight text-slate-900 dark:text-white">
                            {category.name}
                          </h3>
                        </div>
                        <div className={cn(
                          'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg shadow-black/10',
                          accent.gradient
                        )}>
                          {SECTION_ICONS[category.slug] || <BookOpen size={22} />}
                        </div>
                      </div>

                      <p className="mt-4 max-w-[34ch] text-sm leading-6 text-slate-600 dark:text-white/72">
                        {meta.hook}
                      </p>

                      <div className="mt-5 flex flex-wrap gap-2">
                        {meta.chips.map((chip) => (
                          <span
                            key={chip}
                            className={cn(
                              'rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em]',
                              'border-slate-200 bg-slate-50 text-slate-700 dark:border-white/[0.09] dark:bg-white/[0.06] dark:text-white/78'
                            )}
                          >
                            {chip}
                          </span>
                        ))}
                      </div>

                      <div className="mt-auto flex items-end justify-between gap-4 pt-8">
                        <div>
                          <div className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                            {category.article_count}
                          </div>
                          <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-white/42">
                            {meta.statLabel}
                          </div>
                        </div>
                        <div className={cn('inline-flex items-center gap-2 text-sm font-bold', accent.text)}>
                          <span>{t('kb.sections.openLane', 'Open lane')}</span>
                          <ChevronRight size={15} className="transition-transform group-hover:translate-x-1" />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Tags */}
        {tags && tags.length > 0 && (
          <section className="relative z-10 px-6 pb-8">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-none">
                <Tag size={14} className="flex-shrink-0 text-slate-400 dark:text-white/30" />
                {tags.slice(0, 18).map((tag: any) => (
                  <button
                    key={tag.id}
                    onClick={() => setSelectedTag(selectedTag === tag.slug ? null : tag.slug)}
                    className={cn(
                      'flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200',
                      selectedTag === tag.slug
                        ? 'bg-primary-600/20 border-primary-500/40 text-primary-300'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:bg-white/[0.03] dark:border-white/[0.08] dark:text-white/50 dark:hover:border-white/[0.15] dark:hover:text-white/70'
                    )}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Active Filters */}
        <AnimatePresence>
          {isFiltering && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="relative z-10 px-6"
            >
              <div className="max-w-7xl mx-auto py-3 flex items-center justify-between border-t border-slate-200 dark:border-white/[0.06]">
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-white/50">
                  <Filter size={14} />
                  {activeSearch && <span>Search: &ldquo;{activeSearch}&rdquo;</span>}
                  {selectedCategory && (
                    <span className="px-2.5 py-0.5 rounded-full bg-primary-600/15 border border-primary-500/25 text-primary-300 text-xs font-semibold">
                      {consultifyCategories.find((c: KbCategory) => c.slug === selectedCategory)?.name}
                    </span>
                  )}
                  {selectedTag && (
                    <span className="px-2.5 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-semibold dark:bg-white/[0.06] dark:border-white/[0.12] dark:text-white/75">
                      #{tags?.find((tag: any) => tag.slug === selectedTag)?.label || selectedTag}
                    </span>
                  )}
                </div>
                <button onClick={clearFilters} className="text-sm text-primary-400 hover:text-primary-300 font-semibold transition-colors">
                  {t('kb.filtering.clear', 'Clear filters')}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content Area */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-12">
          {displayArticles ? (
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-8 dark:text-white">
                {activeSearch
                  ? t('kb.results.searchTitle', 'Search results')
                  : t('kb.results.categoryTitle', 'Articles')}
                <span className="ml-2 text-lg font-normal text-slate-500 dark:text-white/40">({displayArticles.length})</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayArticles.map((article: KbArticleListItem) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-24">
              {/* Featured Articles */}
              {featured && featured.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-10">
                    <div>
                      <h2 className="text-3xl font-black text-slate-900 tracking-tight dark:text-white">
                        {t('kb.featured.title', 'Featured Articles')}
                      </h2>
                      <p className="mt-2 text-slate-600 font-medium dark:text-white/45">
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
                <SectionPreview
                  key={category.id}
                  category={category}
                  language={docsLanguage}
                  selectedTag={selectedTag}
                />
              ))}

              {/* Browse All Articles */}
              {browseArticles.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br from-slate-400 to-slate-600 text-white">
                        <GraduationCap size={22} />
                      </div>
                      <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight dark:text-white">
                          {t('kb.browse.title', 'Browse All Articles')}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-white/40">
                          {browseArticles.length} {t('kb.articles', 'articles')} {t('kb.browse.subtitle', 'across all categories')}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {browseArticles.slice(0, browseLimit).map((article: KbArticleListItem) => (
                      <BrowseArticleCard key={article.id} article={article} />
                    ))}
                  </div>
                  {browseLimit < browseArticles.length && (
                    <div className="mt-10 text-center">
                      <button
                        onClick={() => setBrowseLimit((prev) => prev + ARTICLES_PER_PAGE)}
                        className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 hover:border-primary-500/30 transition-all duration-300 dark:text-white/80 dark:border-white/[0.12] dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
                      >
                        {t('kb.browse.loadMore', 'Load more articles')}
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </MarketingLayout>
  );
};

/* ─────────────────────────── Article Card (Featured grid) ─────────────────────────── */

const ArticleCard: React.FC<{ article: KbArticleListItem; featured?: boolean }> = ({ article, featured }) => {
  const { t } = useTranslation();
  const visibleTags = getVisibleArticleTags(article);

  return (
    <Link
      to={`/knowledge-base/${article.category_slug}/${article.slug}`}
      className={cn(
        'group flex flex-col rounded-2xl border transition-all duration-300 overflow-hidden',
        'border-slate-200 bg-white backdrop-blur-sm dark:border-white/[0.06] dark:bg-white/[0.025]',
        'hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-white/[0.04] dark:hover:border-white/[0.12]',
        'hover:shadow-[0_0_40px_-12px_rgba(124,58,237,0.20)]'
      )}
    >
      {article.thumbnail_url ? (
        <div className="relative aspect-[16/9] overflow-hidden bg-slate-100 dark:bg-[#0D0828]">
          <img
            src={article.thumbnail_url}
            alt={article.title}
            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A1F]/60 via-transparent to-transparent" />
          {featured && article.is_featured && (
            <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/90 text-white backdrop-blur-sm">
              {t('kb.card.featured', 'Featured')}
            </span>
          )}
        </div>
      ) : (
        <div className="relative aspect-[16/9] bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center dark:from-[#0D0828] dark:to-[#12082E]">
          <BookOpen size={32} className="text-slate-300 dark:text-white/15" />
        </div>
      )}

      <div className="p-5 flex-1 flex flex-col">
        {article.category_name && (
          <span className="self-start px-2.5 py-0.5 rounded-full border border-primary-500/20 bg-primary-600/10 text-primary-300 text-[10px] font-bold uppercase tracking-wider mb-3">
            {article.category_name}
          </span>
        )}

        <h3 className="text-[15px] font-bold text-slate-900 group-hover:text-primary-500 dark:text-white dark:group-hover:text-primary-300 transition-colors line-clamp-2 leading-snug">
          {article.title}
        </h3>

        {article.summary && (
          <p className="mt-2 text-xs text-slate-600 line-clamp-2 leading-relaxed flex-1 dark:text-white/40">
            {article.summary}
          </p>
        )}

        {visibleTags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {visibleTags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/60"
              >
                {tag.label}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center gap-4 text-[11px] text-slate-500 font-medium dark:text-white/30">
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {article.reading_time_minutes} {t('kb.card.min', 'min')}
          </span>
          {article.view_count > 0 && (
            <span className="flex items-center gap-1">
              <Eye size={11} />
              {article.view_count}
            </span>
          )}
        </div>
      </div>

      <div className="px-5 py-3 border-t border-slate-200 dark:border-white/[0.04] flex items-center justify-between">
        <span className="text-xs font-bold text-primary-500 dark:text-primary-400">
          {t('kb.card.read', 'Read article')}
        </span>
        <ArrowRight size={13} className="text-primary-500 dark:text-primary-400 group-hover:translate-x-1 transition-transform" />
      </div>
    </Link>
  );
};

/* ─────────────────────────── Browse Card (compact, 4-col) ─────────────────────────── */

const BrowseArticleCard: React.FC<{ article: KbArticleListItem }> = ({ article }) => {
  const { t } = useTranslation();
  const accent = SECTION_ACCENT[article.category_slug || ''] || DEFAULT_ACCENT;
  const visibleTags = getVisibleArticleTags(article);

  return (
    <Link
      to={`/knowledge-base/${article.category_slug}/${article.slug}`}
      className="group p-5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 backdrop-blur-sm transition-all duration-200 dark:border-white/[0.045] dark:bg-white/[0.02] dark:hover:bg-white/[0.04] dark:hover:border-white/[0.10]"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className={cn('w-2 h-2 rounded-full', accent.bg)} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/30">
          {article.category_name}
        </span>
      </div>
      <h4 className="font-bold text-sm text-slate-900 group-hover:text-primary-500 dark:text-white dark:group-hover:text-primary-300 transition-colors line-clamp-2 leading-snug">
        {article.title}
      </h4>
      <p className="mt-2 text-[11px] text-slate-600 line-clamp-2 leading-relaxed dark:text-white/35">
        {article.summary}
      </p>
      {visibleTags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {visibleTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/55"
            >
              {tag.label}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] text-slate-500 flex items-center gap-1 dark:text-white/25">
          <Clock size={10} />
          {article.reading_time_minutes} {t('kb.card.min', 'min')}
        </span>
        <span className={cn('flex items-center gap-1 text-xs font-bold', accent.text)}>
          <ArrowRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
    </Link>
  );
};

/* ─────────────────────────── Section Preview ─────────────────────────── */

const SectionPreview: React.FC<{ category: KbCategory; language: string; selectedTag: string | null }> = ({
  category,
  language,
  selectedTag,
}) => {
  const { t } = useTranslation();
  const { data: articlesData } = useDocsArticles({
    language,
    categorySlug: category.slug,
    limit: 4,
  });
  const articles = useMemo(
    () => (articlesData?.articles || []).filter((article) => matchesSelectedTag(article, selectedTag)),
    [articlesData?.articles, selectedTag]
  );

  if (!articles?.length) return null;

  const accent = SECTION_ACCENT[category.slug] || DEFAULT_ACCENT;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className={cn(
            'w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br text-white',
            accent.gradient
          )}>
            {SECTION_ICONS[category.slug] || <BookOpen size={22} />}
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight dark:text-white">{category.name}</h2>
            {category.description && (
              <p className="text-sm text-slate-600 dark:text-white/40">{category.description}</p>
            )}
          </div>
        </div>
        <Link
          to={`/knowledge-base/${category.slug}`}
          className={cn('flex items-center gap-1 text-sm font-bold transition-colors', accent.text)}
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
            className="group p-5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 backdrop-blur-sm transition-all duration-200 dark:border-white/[0.045] dark:bg-white/[0.02] dark:hover:bg-white/[0.04] dark:hover:border-white/[0.10]"
          >
            {article.thumbnail_url && (
              <div className="aspect-[16/9] rounded-lg overflow-hidden mb-3 bg-slate-100 dark:bg-[#0D0828]">
                <img
                  src={article.thumbnail_url}
                  alt={article.title}
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                  loading="lazy"
                />
              </div>
            )}
            <h4 className="font-bold text-sm text-slate-900 group-hover:text-primary-500 dark:text-white dark:group-hover:text-primary-300 transition-colors line-clamp-2 leading-snug">
              {article.title}
            </h4>
            <p className="mt-2 text-[11px] text-slate-600 line-clamp-2 leading-relaxed dark:text-white/35">
              {article.summary}
            </p>
            <div className={cn('mt-3 flex items-center gap-1 text-xs font-bold', accent.text)}>
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
