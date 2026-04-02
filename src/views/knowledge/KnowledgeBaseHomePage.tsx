/**
 * Knowledge Base Home Page
 * Route: /knowledge-base
 *
 * Premium KB landing matching the LP dark glass aesthetic.
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
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';

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
  'consultify-governance-and-roi': <Shield size={22} />,
  'consultify-execution-and-rollout': <Rocket size={22} />,
  'consultify-ai-and-decision-making': <Brain size={22} />,
};

const SECTION_ACCENT: Record<string, { gradient: string; border: string; glow: string; text: string }> = {
  'consultify-governance-and-roi': {
    gradient: 'from-emerald-400 to-teal-500',
    border: 'border-emerald-500/20 hover:border-emerald-500/40',
    glow: 'group-hover:shadow-[0_0_30px_-8px_rgba(16,185,129,0.35)]',
    text: 'text-emerald-400',
  },
  'consultify-execution-and-rollout': {
    gradient: 'from-violet-400 to-fuchsia-500',
    border: 'border-violet-500/20 hover:border-violet-500/40',
    glow: 'group-hover:shadow-[0_0_30px_-8px_rgba(139,92,246,0.35)]',
    text: 'text-violet-400',
  },
  'consultify-ai-and-decision-making': {
    gradient: 'from-amber-400 to-orange-500',
    border: 'border-amber-500/20 hover:border-amber-500/40',
    glow: 'group-hover:shadow-[0_0_30px_-8px_rgba(245,158,11,0.35)]',
    text: 'text-amber-400',
  },
};

export const KnowledgeBaseHomePage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [activeSearch, setActiveSearch] = useState(searchParams.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const docsLanguage = i18n.language?.startsWith('pl') ? 'pl' : i18n.language?.startsWith('de') ? 'de' : 'en';

  const { data: categories } = useDocsCategories(docsLanguage);
  const { data: allFeatured } = useDocsFeatured(docsLanguage, 20);
  const { data: searchResults } = useDocsSearch(activeSearch, docsLanguage);
  const { data: tags } = useKnowledgeTags(docsLanguage);

  const consultifyCategories = useMemo(() =>
    categories?.filter((c: KbCategory) => c.slug.startsWith('consultify-')) || [],
    [categories]
  );

  const featured = useMemo(() =>
    allFeatured?.filter((a: KbArticleListItem) => a.category_slug?.startsWith('consultify-')).slice(0, 6) || [],
    [allFeatured]
  );

  const { data: categoryArticles } = useDocsArticles({
    language: docsLanguage,
    categorySlug: selectedCategory || undefined,
    limit: 50,
  });

  const displayArticles = useMemo(() => {
    if (activeSearch && searchResults?.length) {
      return searchResults.filter((a: KbArticleListItem) => a.category_slug?.startsWith('consultify-'));
    }
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
    <div className="min-h-screen bg-[#0A0A1F] text-white relative overflow-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[linear-gradient(160deg,#0D0828_0%,#0A0A1F_45%,#12082E_100%)]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            mask: 'radial-gradient(ellipse at 50% 30%, black 0%, transparent 72%)',
            WebkitMask: 'radial-gradient(ellipse at 50% 30%, black 0%, transparent 72%)',
          }}
        />
        <div className="absolute top-[-20%] left-[10%] w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(109,40,217,0.18)_0%,transparent_65%)] blur-[80px]" />
        <div className="absolute bottom-[-10%] right-[5%] w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(0,210,255,0.10)_0%,transparent_65%)] blur-[90px]" />
      </div>

      {/* Hero Section */}
      <section className="relative z-10 pt-24 pb-16 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary-500/35 bg-primary-600/10 backdrop-blur-sm text-xs font-bold text-primary-300 tracking-wide mb-8">
              <Sparkles size={14} className="text-primary-300" />
              <span>{t('kb.hero.badge', '50 expert articles on transformation management')}</span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.0]">
              {t('kb.hero.title', 'Knowledge Base')}
            </h1>

            <p className="mt-6 text-lg text-white/55 font-medium leading-relaxed max-w-2xl mx-auto">
              {t('kb.hero.subtitle', 'Governance, execution, and AI decision support for transformation leaders. Built from real industrial practice, not theory.')}
            </p>

            {/* Search */}
            <form onSubmit={handleSearch} className="mt-10 max-w-xl mx-auto">
              <div className="relative">
                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('kb.hero.searchPlaceholder', 'Search articles...')}
                  className="w-full pl-12 pr-12 py-4 rounded-2xl bg-white/[0.05] backdrop-blur-sm border border-white/[0.10] text-white placeholder-white/40 text-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500/30 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(''); setActiveSearch(''); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            </form>
          </motion.div>
        </div>
      </section>

      {/* Section Navigation Cards */}
      <section className="relative z-10 px-6 pb-12">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {consultifyCategories.map((category: KbCategory) => {
              const accent = SECTION_ACCENT[category.slug] || SECTION_ACCENT['consultify-execution-and-rollout'];
              const isActive = selectedCategory === category.slug;
              return (
                <button
                  key={category.id}
                  onClick={() => {
                    setSelectedCategory(isActive ? null : category.slug);
                    setActiveSearch('');
                  }}
                  className={cn(
                    'group relative flex items-start gap-4 p-6 rounded-2xl border transition-all duration-300 text-left',
                    isActive
                      ? `${accent.border} bg-white/[0.06] backdrop-blur-xl`
                      : `border-white/[0.06] bg-white/[0.025] backdrop-blur-sm hover:bg-white/[0.04] ${accent.border}`,
                    accent.glow
                  )}
                >
                  <div className={cn(
                    'flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br',
                    accent.gradient
                  )}>
                    {SECTION_ICONS[category.slug] || <BookOpen size={22} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white text-sm tracking-tight">
                      {category.name}
                    </h3>
                    {category.description && (
                      <p className="mt-1.5 text-xs text-white/45 line-clamp-2 leading-relaxed">
                        {category.description}
                      </p>
                    )}
                    <div className={cn('mt-3 flex items-center gap-1 text-xs font-bold', accent.text)}>
                      <span>{category.article_count} {t('kb.articles', 'articles')}</span>
                      <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </button>
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
              <Tag size={14} className="flex-shrink-0 text-white/30" />
              {tags.slice(0, 12).map((tag: any) => (
                <button
                  key={tag.id}
                  onClick={() => setSelectedTag(selectedTag === tag.slug ? null : tag.slug)}
                  className={cn(
                    'flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200',
                    selectedTag === tag.slug
                      ? 'bg-primary-600/20 border-primary-500/40 text-primary-300'
                      : 'bg-white/[0.03] border-white/[0.08] text-white/50 hover:border-white/[0.15] hover:text-white/70'
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
            <div className="max-w-7xl mx-auto py-3 flex items-center justify-between border-t border-white/[0.06]">
              <div className="flex items-center gap-2 text-sm text-white/50">
                <Filter size={14} />
                {activeSearch && <span>Search: &ldquo;{activeSearch}&rdquo;</span>}
                {selectedCategory && (
                  <span className="px-2.5 py-0.5 rounded-full bg-primary-600/15 border border-primary-500/25 text-primary-300 text-xs font-semibold">
                    {consultifyCategories.find((c: KbCategory) => c.slug === selectedCategory)?.name}
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
            <h2 className="text-2xl font-black text-white tracking-tight mb-8">
              {activeSearch
                ? t('kb.results.searchTitle', 'Search results')
                : t('kb.results.categoryTitle', 'Articles')}
              <span className="ml-2 text-lg font-normal text-white/40">({displayArticles.length})</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayArticles.map((article: KbArticleListItem) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-20">
            {/* Featured Articles */}
            {featured && featured.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-10">
                  <div>
                    <h2 className="text-3xl font-black text-white tracking-tight">
                      {t('kb.featured.title', 'Featured Articles')}
                    </h2>
                    <p className="mt-2 text-white/45 font-medium">
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
      <section className="relative z-10 mx-6 mb-16">
        <div className="max-w-5xl mx-auto rounded-[32px] border border-white/[0.08] bg-white/[0.035] backdrop-blur-xl p-12 text-center">
          <h2 className="text-3xl font-black text-white tracking-tight">
            {t('kb.cta.title', 'Ready to transform how you manage change?')}
          </h2>
          <p className="mt-4 text-lg text-white/50 max-w-2xl mx-auto">
            {t('kb.cta.subtitle', 'See how Consultify connects strategy, governance, and execution in one system.')}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/trial/start"
              className="px-8 py-3.5 rounded-full font-bold text-white transition-all"
              style={{
                background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #c026d3 100%)',
                boxShadow: '0 0 36px -14px rgba(124,58,237,0.70)',
              }}
            >
              {t('kb.cta.trial', 'Start Free Trial')}
            </Link>
            <Link
              to="/demo"
              className="px-8 py-3.5 rounded-full font-bold text-white/80 border border-white/[0.18] bg-white/[0.05] hover:bg-white/[0.09] hover:border-primary-500/45 transition-all"
            >
              {t('kb.cta.demo', 'Book a Demo')}
            </Link>
          </div>
        </div>
      </section>

      {/* Gradient separator */}
      <div className="relative z-10 h-px mx-auto max-w-4xl bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />
    </div>
  );
};

const ArticleCard: React.FC<{ article: KbArticleListItem; featured?: boolean }> = ({ article, featured }) => {
  const { t } = useTranslation();

  return (
    <Link
      to={`/knowledge-base/${article.category_slug}/${article.slug}`}
      className={cn(
        'group flex flex-col rounded-2xl border transition-all duration-300 overflow-hidden',
        'border-white/[0.06] bg-white/[0.025] backdrop-blur-sm',
        'hover:bg-white/[0.04] hover:border-white/[0.12]',
        'hover:shadow-[0_0_40px_-12px_rgba(124,58,237,0.20)]'
      )}
    >
      {/* Thumbnail */}
      {article.thumbnail_url ? (
        <div className="relative aspect-[16/9] overflow-hidden bg-[#0D0828]">
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
        <div className="relative aspect-[16/9] bg-gradient-to-br from-[#0D0828] to-[#12082E] flex items-center justify-center">
          <BookOpen size={32} className="text-white/15" />
        </div>
      )}

      <div className="p-5 flex-1 flex flex-col">
        {article.category_name && (
          <span className="self-start px-2.5 py-0.5 rounded-full border border-primary-500/20 bg-primary-600/10 text-primary-300 text-[10px] font-bold uppercase tracking-wider mb-3">
            {article.category_name}
          </span>
        )}

        <h3 className="text-[15px] font-bold text-white group-hover:text-primary-300 transition-colors line-clamp-2 leading-snug">
          {article.title}
        </h3>

        {article.summary && (
          <p className="mt-2 text-xs text-white/40 line-clamp-2 leading-relaxed flex-1">
            {article.summary}
          </p>
        )}

        <div className="mt-4 flex items-center gap-4 text-[11px] text-white/30 font-medium">
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

      <div className="px-5 py-3 border-t border-white/[0.04] flex items-center justify-between">
        <span className="text-xs font-bold text-primary-400">
          {t('kb.card.read', 'Read article')}
        </span>
        <ArrowRight size={13} className="text-primary-400 group-hover:translate-x-1 transition-transform" />
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

  const accent = SECTION_ACCENT[category.slug] || SECTION_ACCENT['consultify-execution-and-rollout'];

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
            <h2 className="text-xl font-black text-white tracking-tight">{category.name}</h2>
            {category.description && (
              <p className="text-sm text-white/40">{category.description}</p>
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
            className="group p-5 rounded-2xl border border-white/[0.045] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.10] backdrop-blur-sm transition-all duration-200"
          >
            {article.thumbnail_url && (
              <div className="aspect-[16/9] rounded-lg overflow-hidden mb-3 bg-[#0D0828]">
                <img
                  src={article.thumbnail_url}
                  alt={article.title}
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                  loading="lazy"
                />
              </div>
            )}
            <h4 className="font-bold text-sm text-white group-hover:text-primary-300 transition-colors line-clamp-2 leading-snug">
              {article.title}
            </h4>
            <p className="mt-2 text-[11px] text-white/35 line-clamp-2 leading-relaxed">
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
