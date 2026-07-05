/**
 * Knowledge Base Home Page
 * Route: /knowledge-base
 *
 * Premium KB landing matching the LP dark glass aesthetic.
 * Wrapped in MarketingLayout for consistent top bar + footer.
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Clock,
  Eye,
  Filter,
  FolderOpen,
  GraduationCap,
  Search,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';

import { MarketingLayout } from '@/components/Landing/MarketingLayout';
import { isKbCategoryForCurrentSite, KNOWLEDGE_BASE_SITE } from '@/config/knowledgeBaseSite';
import {
  KbArticleListItem,
  useDocsArticles,
  useDocsFeatured,
  useDocsSearch,
} from '@/hooks/useDocs';
import {
  KbCollection,
  useKnowledgeCollectionArticles,
  useKnowledgeCollections,
  useKnowledgeTags,
} from '@/hooks/useKnowledge';
import { cn } from '@/lib/utils';
import { resolveKnowledgeLanguage } from '@/utils/knowledgeLanguage';

type AccentTheme = { gradient: string; border: string; glow: string; text: string; bg: string };

const ACCENT_THEMES: AccentTheme[] = [
  {
    gradient: 'from-c-tag-4 to-c-tag-11',
    border: 'border-c-tag-4 hover:border-c-tag-4',
    glow: 'group-hover:shadow-lg',
    text: 'text-c-tag-4',
    bg: 'bg-[color-mix(in_srgb,var(--c-tag-4)_10%,transparent)]',
  },
  {
    gradient: 'from-c-tag-6 to-c-tag-1',
    border: 'border-c-tag-6 hover:border-c-tag-6',
    glow: 'group-hover:shadow-lg',
    text: 'text-c-tag-6',
    bg: 'bg-[color-mix(in_srgb,var(--c-tag-6)_10%,transparent)]',
  },
  {
    gradient: 'from-c-tag-9 to-c-tag-5',
    border: 'border-c-tag-9 hover:border-c-tag-9',
    glow: 'group-hover:shadow-lg',
    text: 'text-c-tag-9',
    bg: 'bg-[color-mix(in_srgb,var(--c-tag-9)_10%,transparent)]',
  },
];

const DEFAULT_ACCENT = ACCENT_THEMES[2];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function accentForSlug(slug: string | null | undefined): AccentTheme {
  if (!slug) return DEFAULT_ACCENT;
  return ACCENT_THEMES[hashString(slug) % ACCENT_THEMES.length] || DEFAULT_ACCENT;
}

function kbImg(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('/kb/') && url.endsWith('.png')) return url.slice(0, -4) + '.webp';
  return url;
}

function kbThumb(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const resolved = kbImg(url);
  if (!resolved) return undefined;
  if (resolved.endsWith('/hero.webp')) return resolved.replace('/hero.webp', '/thumb.webp');
  return resolved;
}

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
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [browseLimit, setBrowseLimit] = useState(ARTICLES_PER_PAGE);

  const docsLanguage = resolveKnowledgeLanguage(i18n.language);

  const { data: collections = [] } = useKnowledgeCollections(undefined, docsLanguage);
  const { data: allFeatured = [] } = useDocsFeatured(docsLanguage, 20);
  const { data: searchResults = [] } = useDocsSearch(activeSearch, docsLanguage);
  const { data: tags = [] } = useKnowledgeTags(undefined, docsLanguage);
  const { data: allArticlesData } = useDocsArticles({ language: docsLanguage, limit: 100 });
  const allArticles = allArticlesData?.articles || [];

  const siteCollections = useMemo(
    () =>
      (collections || [])
        .filter((c: KbCollection) => (c.article_count || 0) > 0)
        .filter((c: KbCollection) => c.slug?.startsWith(KNOWLEDGE_BASE_SITE.categoryPrefix))
        .slice(0, 3),
    [collections]
  );

  const featured = useMemo(
    () =>
      allFeatured
        .filter((a: KbArticleListItem) => isKbCategoryForCurrentSite(a.category_slug))
        .filter((a: KbArticleListItem) => matchesSelectedTag(a, selectedTag))
        .slice(0, 6),
    [allFeatured, selectedTag]
  );

  const browseArticles = useMemo(
    () =>
      allArticles
        .filter((a: KbArticleListItem) => isKbCategoryForCurrentSite(a.category_slug))
        .filter((a: KbArticleListItem) => matchesSelectedTag(a, selectedTag)),
    [allArticles, selectedTag]
  );

  const { data: collectionArticlesData } = useKnowledgeCollectionArticles(
    selectedCollection || undefined,
    50,
    0,
    docsLanguage
  );
  const collectionArticles = collectionArticlesData?.articles;

  const displayArticles = useMemo(() => {
    if (activeSearch) {
      return searchResults
        .filter((a: KbArticleListItem) => isKbCategoryForCurrentSite(a.category_slug))
        .filter((a: KbArticleListItem) => matchesSelectedTag(a, selectedTag));
    }
    if (selectedCollection && collectionArticles?.length) {
      return collectionArticles
        .filter((a: KbArticleListItem) => isKbCategoryForCurrentSite(a.category_slug))
        .filter((a: KbArticleListItem) => matchesSelectedTag(a, selectedTag));
    }
    return null;
  }, [activeSearch, searchResults, selectedCollection, collectionArticles, selectedTag]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchQuery.trim());
    setSelectedCollection(null);
  };

  useEffect(() => {
    const trimmed = searchQuery.trim();
    const timeoutId = window.setTimeout(() => {
      setActiveSearch(trimmed);
      if (trimmed) setSelectedCollection(null);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  const clearFilters = () => {
    setSearchQuery('');
    setActiveSearch('');
    setSelectedCollection(null);
    setSelectedTag(null);
  };

  const isFiltering = !!activeSearch || !!selectedCollection || !!selectedTag;
  const isResultView = displayArticles !== null;

  return (
    <MarketingLayout footerVariant="knowledge">
      <div className="relative">
        {/* Ambient background */}
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 bg-c-bg" />
          <div
            className="absolute inset-0 opacity-[0.03] dark:opacity-[0.04]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(15,23,42,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.06) 1px, transparent 1px)',
              backgroundSize: '64px 64px',
              mask: 'radial-gradient(ellipse at 50% 30%, black 0%, transparent 72%)',
              WebkitMask: 'radial-gradient(ellipse at 50% 30%, black 0%, transparent 72%)',
            }}
          />
          <div className="absolute top-[-20%] left-[10%] w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(109,40,217,0.10)_0%,transparent_65%)] blur-[80px] dark:bg-[radial-gradient(circle,rgba(109,40,217,0.18)_0%,transparent_65%)]" />
          <div className="absolute bottom-[-10%] right-[5%] w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(14,165,233,0.08)_0%,transparent_65%)] blur-[90px] dark:bg-[radial-gradient(circle,rgba(0,210,255,0.10)_0%,transparent_65%)]" />
        </div>

        {/* Hero Section */}
        <section className="relative z-10 pt-12 sm:pt-20 pb-10 sm:pb-16 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full border border-c-accent bg-c-accent-soft backdrop-blur-sm text-[11px] sm:text-xs font-bold text-c-accent tracking-wide mb-6 sm:mb-8">
                <span>{t('kb.hero.badge', KNOWLEDGE_BASE_SITE.heroBadge)}</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-7xl font-black text-c-text tracking-tight leading-[1.05] dark:text-c-text">
                {t('kb.hero.title', 'Knowledge Base')}
              </h1>

              <p className="mt-4 sm:mt-6 text-base sm:text-lg text-c-text-secondary font-medium leading-relaxed max-w-2xl mx-auto px-2 dark:text-c-text-muted">
                {t('kb.hero.subtitle', KNOWLEDGE_BASE_SITE.heroSubtitle)}
              </p>

              {/* Search */}
              <form onSubmit={handleSearch} className="mt-8 sm:mt-10 max-w-xl mx-auto">
                <div className="relative">
                  <Search
                    size={18}
                    className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-c-text-secondary dark:text-c-text-muted"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('kb.hero.searchPlaceholder', 'Search articles...')}
                    className="w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-c-surface-raised backdrop-blur-sm border border-c-border-subtle text-c-text placeholder-c-text-muted text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-accent transition-all dark:bg-white/[0.05] dark:border-white/[0.10] dark:text-c-text dark:placeholder-white/40"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setActiveSearch('');
                      }}
                      className="absolute right-3.5 sm:right-4 top-1/2 -translate-y-1/2 text-c-text-secondary hover:text-c-text-secondary transition-colors dark:text-c-text-muted dark:hover:text-c-text"
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
        {!activeSearch && (
          <section className="relative z-10 px-4 sm:px-6 pb-10 sm:pb-12">
            <div className="max-w-7xl mx-auto">
              <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-6">
                <div>
                  <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.24em] text-c-text-muted dark:text-c-text-muted">
                    {t('kb.sections.eyebrow', KNOWLEDGE_BASE_SITE.sectionsEyebrow)}
                  </p>
                  <h2 className="mt-2 text-xl sm:text-2xl font-black tracking-tight text-c-text">
                    {t('kb.sections.title', KNOWLEDGE_BASE_SITE.sectionsTitle)}
                  </h2>
                </div>
                <p className="hidden max-w-xl text-sm leading-relaxed text-c-text-secondary dark:text-c-text-muted md:block">
                  {t('kb.sections.subtitle', KNOWLEDGE_BASE_SITE.sectionsSubtitle)}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5">
                {siteCollections.map((coll: KbCollection) => {
                  const accent = accentForSlug(coll.slug);
                  const eyebrow = t('kb.sections.defaultEyebrow', 'Collection');
                  const statLabel = t('kb.sections.defaultStatLabel', 'articles');
                  return (
                    <Link
                      key={coll.id}
                      to={`/knowledge-base/${coll.slug}`}
                      className={cn(
                        'group relative overflow-hidden rounded-2xl sm:rounded-[28px] border p-5 sm:p-6 text-left transition-all duration-300',
                        'min-h-[220px] sm:min-h-[260px] md:min-h-[290px]',
                        `border-c-border-subtle bg-c-surface-raised backdrop-blur-sm hover:bg-c-surface ${accent.border} dark:border-white/[0.08] dark:bg-c-bg dark:hover:bg-c-bg`,
                        accent.glow
                      )}
                    >
                      <div className="pointer-events-none absolute inset-0">
                        <div
                          className={cn(
                            'absolute right-[-18%] top-[-10%] h-40 w-40 rounded-full blur-3xl opacity-25',
                            accent.bg
                          )}
                        />
                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/14" />
                      </div>
                      <div className="relative flex h-full flex-col">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-c-text-muted dark:text-c-text-muted">
                              {eyebrow}
                            </p>
                            <h3 className="mt-3 max-w-[15ch] text-2xl font-black leading-[1.02] tracking-tight text-c-text">
                              {coll.title}
                            </h3>
                          </div>
                          <div
                            className={cn(
                              'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg shadow-black/10',
                              accent.gradient
                            )}
                          >
                            <FolderOpen size={22} />
                          </div>
                        </div>

                        {coll.description && (
                          <p className="mt-4 max-w-[34ch] text-sm leading-6 text-c-text-secondary dark:text-c-text-secondary">
                            {coll.description}
                          </p>
                        )}

                        {coll.featured && (
                          <div className="mt-5">
                            <span
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em]',
                                'border-c-warning bg-[color-mix(in_srgb,var(--c-warning)_12%,transparent)] text-c-warning'
                              )}
                            >
                              <Sparkles size={10} />
                              {t('kb.sections.featured', 'Featured')}
                            </span>
                          </div>
                        )}

                        <div className="mt-auto flex items-end justify-between gap-4 pt-8">
                          <div>
                            <div className="text-3xl font-black tracking-tight text-c-text">
                              {coll.article_count}
                            </div>
                            <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-c-text-muted dark:text-c-text-muted">
                              {statLabel}
                            </div>
                          </div>
                          <div
                            className={cn(
                              'inline-flex items-center gap-2 text-sm font-bold',
                              accent.text
                            )}
                          >
                            <span>{t('kb.sections.openLane', 'Open lane')}</span>
                            <ChevronRight
                              size={15}
                              className="transition-transform group-hover:translate-x-1"
                            />
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Tags */}
        {tags && tags.length > 0 && (
          <section className="relative z-10 px-4 sm:px-6 pb-6 sm:pb-8">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
                <Tag size={14} className="flex-shrink-0 text-c-text-secondary dark:text-c-text-muted" />
                {tags.slice(0, 18).map((tag: any) => (
                  <button
                    key={tag.id}
                    onClick={() => setSelectedTag(selectedTag === tag.slug ? null : tag.slug)}
                    className={cn(
                      'flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200',
                      selectedTag === tag.slug
                        ? 'bg-c-accent-soft border-c-accent text-c-accent'
                        : 'bg-c-surface border-c-border-subtle text-c-text-secondary hover:border-c-border hover:text-c-text dark:bg-white/[0.03] dark:border-white/[0.08] dark:text-c-text-muted dark:hover:border-white/[0.15] dark:hover:text-c-text-secondary'
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
              <div className="max-w-7xl mx-auto py-3 flex items-center justify-between border-t border-c-border-subtle dark:border-white/[0.06]">
                <div className="flex items-center gap-2 text-sm text-c-text-secondary dark:text-c-text-muted">
                  <Filter size={14} />
                  {activeSearch && <span>Search: &ldquo;{activeSearch}&rdquo;</span>}
                  {selectedCollection && (
                    <span className="px-2.5 py-0.5 rounded-full bg-c-accent-soft border border-c-accent text-c-accent text-xs font-semibold">
                      {
                        siteCollections.find((c: KbCollection) => c.slug === selectedCollection)
                          ?.title
                      }
                    </span>
                  )}
                  {selectedTag && (
                    <span className="px-2.5 py-0.5 rounded-full bg-c-surface border border-c-border-subtle text-c-text-secondary text-xs font-semibold dark:bg-white/[0.06] dark:border-white/[0.12] dark:text-c-text-secondary">
                      #{tags?.find((tag: any) => tag.slug === selectedTag)?.label || selectedTag}
                    </span>
                  )}
                </div>
                <button
                  onClick={clearFilters}
                  className="text-sm text-c-accent hover:text-c-accent font-semibold transition-colors"
                >
                  {t('kb.filtering.clear', 'Clear filters')}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content Area */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          {isResultView && displayArticles.length > 0 ? (
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-c-text tracking-tight mb-6 sm:mb-8 dark:text-c-text">
                {activeSearch
                  ? t('kb.results.searchTitle', 'Search results')
                  : t('kb.results.categoryTitle', 'Articles')}
                <span className="ml-2 text-base sm:text-lg font-normal text-c-text-muted dark:text-c-text-muted">
                  ({displayArticles.length})
                </span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {displayArticles.map((article: KbArticleListItem) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            </div>
          ) : isResultView ? (
            <div className="rounded-2xl sm:rounded-[28px] border border-c-border-subtle bg-c-surface-raised p-6 sm:p-8 text-center backdrop-blur-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-c-surface-raised text-c-text-muted dark:bg-white/[0.06] dark:text-c-text-muted">
                <Search size={22} />
              </div>
              <h2 className="mt-5 text-2xl font-black tracking-tight text-c-text">
                {t('kb.results.emptyTitle', 'No matching articles yet')}
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-c-text-secondary dark:text-c-text-muted">
                {t(
                  'kb.results.emptyBody',
                  'Try a broader phrase, switch the tag filter, or clear search to browse the three main lanes.'
                )}
              </p>
              <button
                onClick={clearFilters}
                className="mt-6 inline-flex items-center gap-2 rounded-full border border-c-border-subtle bg-c-surface px-5 py-2.5 text-sm font-bold text-c-text-secondary transition-all hover:border-c-border hover:bg-c-bg dark:border-white/[0.12] dark:bg-white/[0.05] dark:text-c-text-secondary dark:hover:bg-white/[0.08]"
              >
                {t('kb.filtering.clear', 'Clear filters')}
                <ArrowRight size={14} />
              </button>
            </div>
          ) : (
            <div className="space-y-16 sm:space-y-24">
              {/* Featured Articles */}
              {featured && featured.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-6 sm:mb-10">
                    <div>
                      <h2 className="text-2xl sm:text-3xl font-black text-c-text tracking-tight dark:text-c-text">
                        {t('kb.featured.title', 'Featured Articles')}
                      </h2>
                      <p className="mt-1.5 sm:mt-2 text-sm sm:text-base text-c-text-secondary font-medium dark:text-c-text-muted">
                        {t('kb.featured.subtitle', 'Start here for the most impactful insights')}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {featured.map((article: KbArticleListItem) => (
                      <ArticleCard key={article.id} article={article} featured />
                    ))}
                  </div>
                </div>
              )}

              {/* Section Previews */}
              {siteCollections.map((coll: KbCollection) => (
                <SectionPreview
                  key={coll.id}
                  collection={coll}
                  language={docsLanguage}
                  selectedTag={selectedTag}
                />
              ))}

              {/* Browse All Articles */}
              {browseArticles.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-6 sm:mb-10">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center bg-c-tag-8 text-white">
                        <GraduationCap size={18} className="sm:hidden" />
                        <GraduationCap size={22} className="hidden sm:block" />
                      </div>
                      <div>
                        <h2 className="text-xl sm:text-2xl font-black text-c-text tracking-tight dark:text-c-text">
                          {t('kb.browse.title', 'Browse All Articles')}
                        </h2>
                        <p className="text-xs sm:text-sm text-c-text-muted dark:text-c-text-muted">
                          {browseArticles.length} {t('kb.articles', 'articles')}{' '}
                          {t('kb.browse.subtitle', 'across all categories')}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                    {browseArticles.slice(0, browseLimit).map((article: KbArticleListItem) => (
                      <BrowseArticleCard key={article.id} article={article} />
                    ))}
                  </div>
                  {browseLimit < browseArticles.length && (
                    <div className="mt-10 text-center">
                      <button
                        onClick={() => setBrowseLimit((prev) => prev + ARTICLES_PER_PAGE)}
                        className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-c-text-secondary border border-c-border-subtle bg-c-surface hover:bg-c-bg hover:border-c-accent transition-all duration-300 dark:text-c-text-secondary dark:border-white/[0.12] dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
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

const ArticleCard: React.FC<{ article: KbArticleListItem; featured?: boolean }> = ({
  article,
  featured,
}) => {
  const { t } = useTranslation();
  const visibleTags = getVisibleArticleTags(article);

  return (
    <Link
      to={`/knowledge-base/${article.category_slug}/${article.slug}`}
      className={cn(
        'group flex flex-col rounded-2xl border transition-all duration-300 overflow-hidden',
        'border-c-border-subtle bg-c-surface backdrop-blur-sm dark:border-white/[0.06] dark:bg-white/[0.025]',
        'hover:bg-c-bg hover:border-c-border dark:hover:bg-white/[0.04] dark:hover:border-white/[0.12]',
        'hover:shadow-[0_0_40px_-12px_rgba(165,28,48,0.20)]'
      )}
    >
      {article.thumbnail_url ? (
        <div className="relative aspect-[16/9] overflow-hidden bg-c-surface-raised">
          <img
            src={kbImg(article.thumbnail_url)}
            alt={article.title}
            width={1200}
            height={675}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
            loading="lazy"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-c-bg via-transparent to-transparent" />
          {featured && article.is_featured && (
            <span className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider bg-c-warning text-white backdrop-blur-sm">
              {t('kb.card.featured', 'Featured')}
            </span>
          )}
        </div>
      ) : (
        <div className="relative aspect-[16/9] bg-c-surface-raised flex items-center justify-center">
          <BookOpen size={32} className="text-c-text-secondary dark:text-c-text-muted" />
        </div>
      )}

      <div className="p-4 sm:p-5 flex-1 flex flex-col">
        {article.category_name && (
          <span className="self-start px-2.5 py-0.5 rounded-full border border-c-accent bg-c-accent-soft text-c-accent text-[10px] font-bold uppercase tracking-wider mb-3">
            {article.category_name}
          </span>
        )}

        <h3 className="text-[15px] font-bold text-c-text group-hover:text-c-accent dark:text-c-text dark:group-hover:text-c-accent transition-colors line-clamp-2 leading-snug">
          {article.title}
        </h3>

        {article.summary && (
          <p className="mt-2 text-xs text-c-text-secondary line-clamp-2 leading-relaxed flex-1 dark:text-c-text-muted">
            {article.summary}
          </p>
        )}

        {visibleTags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {visibleTags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center rounded-full border border-c-border-subtle bg-c-bg px-2.5 py-1 text-[10px] font-semibold text-c-text-secondary dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-c-text-secondary"
              >
                {tag.label}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center gap-4 text-[11px] text-c-text-muted font-medium dark:text-c-text-muted">
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

      <div className="px-4 sm:px-5 py-2.5 sm:py-3 border-t border-c-border-subtle dark:border-white/[0.04] flex items-center justify-between">
        <span className="text-xs font-bold text-c-accent dark:text-c-accent">
          {t('kb.card.read', 'Read article')}
        </span>
        <ArrowRight
          size={13}
          className="text-c-accent dark:text-c-accent group-hover:translate-x-1 transition-transform"
        />
      </div>
    </Link>
  );
};

/* ─────────────────────────── Browse Card (compact, 4-col) ─────────────────────────── */

const BrowseArticleCard: React.FC<{ article: KbArticleListItem }> = ({ article }) => {
  const { t } = useTranslation();
  const accent = accentForSlug(article.category_slug);
  const visibleTags = getVisibleArticleTags(article);

  return (
    <Link
      to={`/knowledge-base/${article.category_slug}/${article.slug}`}
      className="group p-5 rounded-2xl border border-c-border-subtle bg-c-surface hover:bg-c-bg hover:border-c-border backdrop-blur-sm transition-all duration-200 dark:border-white/[0.045] dark:bg-white/[0.02] dark:hover:bg-white/[0.04] dark:hover:border-white/[0.10]"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className={cn('w-2 h-2 rounded-full', accent.bg)} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-c-text-muted dark:text-c-text-muted">
          {article.category_name}
        </span>
      </div>
      <h4 className="font-bold text-sm text-c-text group-hover:text-c-accent dark:text-c-text dark:group-hover:text-c-accent transition-colors line-clamp-2 leading-snug">
        {article.title}
      </h4>
      <p className="mt-2 text-[11px] text-c-text-secondary line-clamp-2 leading-relaxed dark:text-c-text-muted">
        {article.summary}
      </p>
      {visibleTags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {visibleTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center rounded-full border border-c-border-subtle bg-c-bg px-2 py-1 text-[10px] font-semibold text-c-text-secondary dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-c-text-muted"
            >
              {tag.label}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] text-c-text-muted flex items-center gap-1 dark:text-c-text-muted">
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

const SectionPreview: React.FC<{
  collection: KbCollection;
  language: string;
  selectedTag: string | null;
}> = ({ collection, language, selectedTag }) => {
  const { t } = useTranslation();
  const { data: articlesData } = useKnowledgeCollectionArticles(collection.slug, 4, 0, language);
  const articles = useMemo(
    () =>
      (articlesData?.articles || []).filter((article) => matchesSelectedTag(article, selectedTag)),
    [articlesData?.articles, selectedTag]
  );

  if (!articles?.length) return null;

  const accent = accentForSlug(collection.slug);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div className="flex items-center gap-3 sm:gap-4">
          <div
            className={cn(
              'w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center bg-gradient-to-br text-white flex-shrink-0',
              accent.gradient
            )}
          >
            <FolderOpen size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-black text-c-text tracking-tight dark:text-c-text truncate">
              {collection.title}
            </h2>
            {collection.description && (
              <p className="text-xs sm:text-sm text-c-text-secondary dark:text-c-text-muted line-clamp-1">
                {collection.description}
              </p>
            )}
          </div>
        </div>
        <Link
          to={`/knowledge-base/${collection.slug}`}
          className={cn(
            'flex items-center gap-1 text-sm font-bold transition-colors flex-shrink-0',
            accent.text
          )}
        >
          {t('kb.section.viewAll', 'View all')}
          <ChevronRight size={14} />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {articles.slice(0, 4).map((article: KbArticleListItem) => (
          <Link
            key={article.id}
            to={`/knowledge-base/${collection.slug}/${article.slug}`}
            className="group p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-c-border-subtle bg-c-surface hover:bg-c-bg hover:border-c-border backdrop-blur-sm transition-all duration-200 dark:border-white/[0.045] dark:bg-white/[0.02] dark:hover:bg-white/[0.04] dark:hover:border-white/[0.10]"
          >
            {article.thumbnail_url && (
              <div className="aspect-[16/9] rounded-lg overflow-hidden mb-3 bg-c-surface-raised">
                <img
                  src={kbThumb(article.thumbnail_url) || kbImg(article.thumbnail_url)}
                  alt={article.title}
                  width={600}
                  height={338}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            )}
            <h4 className="font-bold text-sm text-c-text group-hover:text-c-accent dark:text-c-text dark:group-hover:text-c-accent transition-colors line-clamp-2 leading-snug">
              {article.title}
            </h4>
            <p className="mt-2 text-[11px] text-c-text-secondary line-clamp-2 leading-relaxed dark:text-c-text-muted">
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
