/**
 * Knowledge Base Category Page
 * Route: /knowledge-base/:categorySlug
 *
 * Dark glass aesthetic matching the LP, wrapped in MarketingLayout.
 */

import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, ChevronRight, Clock, Eye, FolderOpen, Home } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { MarketingLayout } from '@/components/Landing/MarketingLayout';
import { isKbCategoryForCurrentSite } from '@/config/knowledgeBaseSite';
import { KbArticleListItem } from '@/hooks/useDocs';
import {
  KbCollection,
  useKnowledgeCollectionArticles,
  useKnowledgeCollections,
} from '@/hooks/useKnowledge';
import { cn } from '@/lib/utils';
import { resolveKnowledgeLanguage } from '@/utils/knowledgeLanguage';

function kbImg(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return url.startsWith('/kb/') && url.endsWith('.png') ? url.slice(0, -4) + '.webp' : url;
}

export const KnowledgeBaseCategoryPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { categorySlug } = useParams<{ categorySlug: string }>();
  const docsLanguage = resolveKnowledgeLanguage(i18n.language);

  const { data: collections = [] } = useKnowledgeCollections(undefined, docsLanguage);
  const collection = useMemo(
    () => collections.find((c: KbCollection) => c.slug === categorySlug),
    [collections, categorySlug]
  );
  const otherCollections = useMemo(
    () =>
      collections.filter(
        (c: KbCollection) => c.slug !== categorySlug && isKbCategoryForCurrentSite(c.slug)
      ),
    [collections, categorySlug]
  );

  const { data: collectionData, isLoading } = useKnowledgeCollectionArticles(
    categorySlug,
    50,
    0,
    docsLanguage
  );
  const articles = collectionData?.articles || [];

  const featuredArticles = articles.filter((a: KbArticleListItem) => a.is_featured);
  const otherArticles = articles.filter((a: KbArticleListItem) => !a.is_featured);

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
              mask: 'radial-gradient(ellipse at 50% 20%, black 0%, transparent 72%)',
              WebkitMask: 'radial-gradient(ellipse at 50% 20%, black 0%, transparent 72%)',
            }}
          />
          <div className="absolute top-[-15%] right-[10%] w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(109,40,217,0.10)_0%,transparent_65%)] blur-[80px] dark:bg-[radial-gradient(circle,rgba(109,40,217,0.15)_0%,transparent_65%)]" />
        </div>

        {/* Breadcrumb */}
        <div className="relative z-10 border-b border-c-border dark:border-white/[0.06]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
            <nav className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-c-text-muted dark:text-c-text-muted overflow-hidden">
              <Link
                to="/knowledge-base"
                className="flex items-center gap-1 hover:text-c-accent dark:hover:text-c-accent transition-colors flex-shrink-0"
              >
                <Home size={14} />
                <span className="hidden sm:inline">
                  {t('kb.breadcrumb.home', 'Knowledge Base')}
                </span>
              </Link>
              <ChevronRight size={12} className="flex-shrink-0 sm:hidden" />
              <ChevronRight size={14} className="flex-shrink-0 hidden sm:block" />
              <span className="text-c-text font-semibold dark:text-c-text truncate">
                {collection?.title || categorySlug}
              </span>
            </nav>
          </div>
        </div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16"
        >
          <div className="max-w-3xl">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-c-text tracking-tight leading-[1.05] dark:text-c-text">
              {collection?.title || categorySlug}
            </h1>
            {collection?.description && (
              <p className="mt-3 sm:mt-4 text-base sm:text-lg text-c-text-secondary font-medium leading-relaxed dark:text-c-text-muted">
                {collection.description}
              </p>
            )}
            <div className="mt-3 sm:mt-4 text-sm text-c-text-muted font-semibold dark:text-c-text-muted">
              {articles.length} {t('kb.articles', 'articles')}
            </div>
          </div>
        </motion.div>

        {/* Articles */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-xl sm:rounded-2xl border border-c-border bg-c-surface p-4 sm:p-6 dark:border-white/[0.06] dark:bg-white/[0.02]"
                >
                  <div className="aspect-[16/9] rounded-lg bg-c-surface-raised mb-4 dark:bg-white/[0.04]" />
                  <div className="h-4 bg-c-surface-raised rounded w-2/3 mb-3 dark:bg-white/[0.06]" />
                  <div className="h-3 bg-c-surface-raised rounded w-full mb-2 dark:bg-white/[0.04]" />
                  <div className="h-3 bg-c-surface-raised rounded w-4/5 dark:bg-white/[0.04]" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-16">
              {featuredArticles.length > 0 && (
                <div>
                  <h2 className="text-lg font-black text-c-text mb-6 flex items-center gap-2 uppercase tracking-[0.15em] dark:text-c-text">
                    <BookOpen size={18} className="text-c-accent" />
                    {t('kb.category.featured', 'Featured')}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {featuredArticles.map((article: KbArticleListItem) => (
                      <CategoryArticleCard
                        key={article.id}
                        article={article}
                        categorySlug={categorySlug!}
                      />
                    ))}
                  </div>
                </div>
              )}

              {otherArticles.length > 0 && (
                <div>
                  {featuredArticles.length > 0 && (
                    <h2 className="text-lg font-black text-c-text mb-6 uppercase tracking-[0.15em] dark:text-c-text">
                      {t('kb.category.all', 'All Articles')}
                    </h2>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {otherArticles.map((article: KbArticleListItem) => (
                      <CategoryArticleCard
                        key={article.id}
                        article={article}
                        categorySlug={categorySlug!}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Other Categories */}
        {otherCollections.length > 0 && (
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20">
            <div className="border-t border-c-border dark:border-white/[0.06] pt-8 sm:pt-12">
              <h3 className="text-lg font-black text-c-text mb-6 tracking-tight dark:text-c-text">
                {t('kb.category.otherCategories', 'Explore other collections')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {otherCollections.map((coll: KbCollection) => (
                  <Link
                    key={coll.id}
                    to={`/knowledge-base/${coll.slug}`}
                    className="group flex items-center gap-4 p-5 rounded-2xl border border-c-border bg-c-surface hover:bg-c-surface-raised hover:border-c-border transition-all duration-200 dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:bg-white/[0.04] dark:hover:border-white/[0.12]"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-c-surface-raised text-c-text-muted dark:bg-white/[0.06] dark:text-c-text-muted">
                      <FolderOpen size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-c-text group-hover:text-c-accent dark:text-c-text dark:group-hover:text-c-accent transition-colors">
                        {coll.title}
                      </h4>
                      <p className="text-xs text-c-text-muted mt-1 dark:text-c-text-muted">
                        {coll.article_count} {t('kb.articles', 'articles')}
                      </p>
                    </div>
                    <ChevronRight
                      size={16}
                      className="text-c-text-secondary group-hover:text-c-accent group-hover:translate-x-0.5 transition-all dark:text-c-text-muted dark:group-hover:text-c-accent"
                    />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </MarketingLayout>
  );
};

const CategoryArticleCard: React.FC<{ article: KbArticleListItem; categorySlug: string }> = ({
  article,
  categorySlug,
}) => {
  const { t } = useTranslation();

  return (
    <Link
      to={`/knowledge-base/${categorySlug}/${article.slug}`}
      className={cn(
        'group flex flex-col rounded-2xl border transition-all duration-300 overflow-hidden',
        'border-c-border bg-c-surface backdrop-blur-sm dark:border-white/[0.06] dark:bg-white/[0.025]',
        'hover:bg-c-surface-raised hover:border-c-border dark:hover:bg-white/[0.04] dark:hover:border-white/[0.12]',
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
          {article.is_featured && (
            <span className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider bg-c-warning text-white">
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
        <h3 className="text-[15px] font-bold text-c-text group-hover:text-c-accent dark:text-c-text dark:group-hover:text-c-accent transition-colors line-clamp-2 leading-snug">
          {article.title}
        </h3>
        {article.summary && (
          <p className="mt-2 text-xs text-c-text-secondary line-clamp-2 leading-relaxed flex-1 dark:text-c-text-muted">
            {article.summary}
          </p>
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
      <div className="px-4 sm:px-5 py-2.5 sm:py-3 border-t border-c-border dark:border-white/[0.04] flex items-center justify-between">
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

export default KnowledgeBaseCategoryPage;
