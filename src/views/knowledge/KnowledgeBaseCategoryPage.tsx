/**
 * Knowledge Base Category Page
 * Route: /knowledge-base/:categorySlug
 *
 * Dark glass aesthetic matching the LP, wrapped in MarketingLayout.
 */

import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, ChevronRight, Clock, Eye, Home } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { MarketingLayout } from '@/components/Landing/MarketingLayout';
import { KbArticleListItem, KbCategory, useDocsArticles, useDocsCategories } from '@/hooks/useDocs';
import { cn } from '@/lib/utils';

export const KnowledgeBaseCategoryPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { categorySlug } = useParams<{ categorySlug: string }>();
  const docsLanguage = i18n.language?.startsWith('pl') ? 'pl' : i18n.language?.startsWith('de') ? 'de' : 'en';

  const { data: categories } = useDocsCategories(docsLanguage);
  const category = categories?.find((c: KbCategory) => c.slug === categorySlug);
  const otherCategories = categories?.filter(
    (c: KbCategory) => c.slug !== categorySlug && c.slug.startsWith('consultify-')
  ) || [];

  const { data: articles, isLoading } = useDocsArticles({
    language: docsLanguage,
    categorySlug: categorySlug || undefined,
    limit: 50,
  });

  const featuredArticles = articles?.filter((a: KbArticleListItem) => a.is_featured) || [];
  const otherArticles = articles?.filter((a: KbArticleListItem) => !a.is_featured) || [];

  return (
    <MarketingLayout>
      <div className="relative">
        {/* Ambient background */}
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 bg-[linear-gradient(160deg,#0D0828_0%,#0A0A1F_45%,#12082E_100%)]" />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
              backgroundSize: '64px 64px',
              mask: 'radial-gradient(ellipse at 50% 20%, black 0%, transparent 72%)',
              WebkitMask: 'radial-gradient(ellipse at 50% 20%, black 0%, transparent 72%)',
            }}
          />
          <div className="absolute top-[-15%] right-[10%] w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(109,40,217,0.15)_0%,transparent_65%)] blur-[80px]" />
        </div>

        {/* Breadcrumb */}
        <div className="relative z-10 border-b border-white/[0.06]">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <nav className="flex items-center gap-2 text-sm text-white/40">
              <Link to="/knowledge-base" className="flex items-center gap-1 hover:text-primary-400 transition-colors">
                <Home size={14} />
                <span>{t('kb.breadcrumb.home', 'Knowledge Base')}</span>
              </Link>
              <ChevronRight size={14} />
              <span className="text-white font-semibold">
                {category?.name || categorySlug}
              </span>
            </nav>
          </div>
        </div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 max-w-7xl mx-auto px-6 py-16"
        >
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-[1.05]">
              {category?.name || categorySlug}
            </h1>
            {category?.description && (
              <p className="mt-4 text-lg text-white/45 font-medium leading-relaxed">
                {category.description}
              </p>
            )}
            <div className="mt-4 text-sm text-white/30 font-semibold">
              {articles?.length || 0} {t('kb.articles', 'articles')}
            </div>
          </div>
        </motion.div>

        {/* Articles */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 pb-20">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
                  <div className="aspect-[16/9] rounded-lg bg-white/[0.04] mb-4" />
                  <div className="h-4 bg-white/[0.06] rounded w-2/3 mb-3" />
                  <div className="h-3 bg-white/[0.04] rounded w-full mb-2" />
                  <div className="h-3 bg-white/[0.04] rounded w-4/5" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-16">
              {featuredArticles.length > 0 && (
                <div>
                  <h2 className="text-lg font-black text-white mb-6 flex items-center gap-2 uppercase tracking-[0.15em]">
                    <BookOpen size={18} className="text-primary-400" />
                    {t('kb.category.featured', 'Featured')}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {featuredArticles.map((article: KbArticleListItem) => (
                      <CategoryArticleCard key={article.id} article={article} categorySlug={categorySlug!} />
                    ))}
                  </div>
                </div>
              )}

              {otherArticles.length > 0 && (
                <div>
                  {featuredArticles.length > 0 && (
                    <h2 className="text-lg font-black text-white mb-6 uppercase tracking-[0.15em]">
                      {t('kb.category.all', 'All Articles')}
                    </h2>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {otherArticles.map((article: KbArticleListItem) => (
                      <CategoryArticleCard key={article.id} article={article} categorySlug={categorySlug!} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Other Categories */}
        {otherCategories.length > 0 && (
          <div className="relative z-10 max-w-7xl mx-auto px-6 pb-20">
            <div className="border-t border-white/[0.06] pt-12">
              <h3 className="text-lg font-black text-white mb-6 tracking-tight">
                {t('kb.category.otherCategories', 'Explore other categories')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {otherCategories.map((cat: KbCategory) => (
                  <Link
                    key={cat.id}
                    to={`/knowledge-base/${cat.slug}`}
                    className="group flex items-center gap-4 p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12] transition-all duration-200"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-white group-hover:text-primary-300 transition-colors">
                        {cat.name}
                      </h4>
                      <p className="text-xs text-white/40 mt-1">{cat.article_count} {t('kb.articles', 'articles')}</p>
                    </div>
                    <ChevronRight size={16} className="text-white/20 group-hover:text-primary-400 group-hover:translate-x-0.5 transition-all" />
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

const CategoryArticleCard: React.FC<{ article: KbArticleListItem; categorySlug: string }> = ({ article, categorySlug }) => {
  const { t } = useTranslation();

  return (
    <Link
      to={`/knowledge-base/${categorySlug}/${article.slug}`}
      className={cn(
        'group flex flex-col rounded-2xl border transition-all duration-300 overflow-hidden',
        'border-white/[0.06] bg-white/[0.025] backdrop-blur-sm',
        'hover:bg-white/[0.04] hover:border-white/[0.12]',
        'hover:shadow-[0_0_40px_-12px_rgba(124,58,237,0.20)]'
      )}
    >
      {article.thumbnail_url ? (
        <div className="relative aspect-[16/9] overflow-hidden bg-[#0D0828]">
          <img
            src={article.thumbnail_url}
            alt={article.title}
            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A1F]/60 via-transparent to-transparent" />
          {article.is_featured && (
            <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/90 text-white">
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

export default KnowledgeBaseCategoryPage;
