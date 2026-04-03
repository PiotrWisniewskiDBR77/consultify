/**
 * Knowledge Preview Section for Landing Page
 * Shows featured articles with teaser videos and CTAs
 */

import { ArrowRight, BookOpen, Clock, Play } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { KbArticleListItem, useKnowledgeFeatured, useKnowledgePublicPreview } from '../../hooks/useKnowledge';
import { ROUTES } from '../../routes/routeConfig';

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

// ============================================
// DYNAMIC ICON
// ============================================

const DynamicIcon: React.FC<{ name: string; size?: number; className?: string }> = ({
  name,
  size = 20,
  className,
}) => {
  const IconComponent = (LucideIcons as any)[name];
  if (!IconComponent) return <BookOpen size={size} className={className} />;
  return <IconComponent size={size} className={className} />;
};

function buildLandingArticles(
  featuredArticles: KbArticleListItem[],
  previewArticles: KbArticleListItem[],
  limit: number
) {
  const articlesById = new Map<string, KbArticleListItem>();

  featuredArticles.forEach((article) => {
    articlesById.set(article.id, article);
  });

  previewArticles.forEach((article) => {
    if (!articlesById.has(article.id) && articlesById.size < limit) {
      articlesById.set(article.id, article);
    }
  });

  return Array.from(articlesById.values()).slice(0, limit);
}

// ============================================
// PREVIEW CARD
// ============================================

interface PreviewCardProps {
  article: KbArticleListItem & { video_teaser_url?: string };
  onArticleClick: (article: KbArticleListItem) => void;
}

const PreviewCard: React.FC<PreviewCardProps> = ({ article, onArticleClick }) => {
  const { t } = useTranslation();

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl transition-all group hover:shadow-2xl dark:border-slate-700 dark:bg-slate-900 cursor-pointer"
      onClick={() => onArticleClick(article)}
    >
      {/* Video Teaser / Thumbnail */}
      <div className="relative aspect-video bg-gradient-to-br from-purple-900 to-indigo-900 overflow-hidden">
        {article.thumbnail_url ? (
          <img
            src={kbThumb(article.thumbnail_url) || kbImg(article.thumbnail_url) || article.thumbnail_url}
            alt={article.title}
            width={600}
            height={338}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <DynamicIcon name={article.category_icon} size={48} className="text-white/50" />
          </div>
        )}

        {/* Play Button Overlay */}
        {article.video_teaser_url && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
            <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <Play size={24} className="text-purple-600 ml-1" />
            </div>
          </div>
        )}

        {/* Category Badge */}
        <div className="absolute top-3 left-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm text-purple-600 dark:text-purple-400 text-xs font-semibold rounded-full">
            <DynamicIcon name={article.category_icon} size={12} />
            {article.category_name}
          </span>
        </div>

        {/* Reading Time */}
        <div className="absolute bottom-3 right-3">
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-black/60 backdrop-blur-sm text-white text-[10px] font-medium rounded-full">
            <Clock size={10} />
            {article.reading_time_minutes} {t('landing.knowledge.minUnit', 'min')}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="mb-2 min-h-[3.5rem] text-lg font-bold text-slate-900 transition-colors line-clamp-2 group-hover:text-purple-600 dark:text-white dark:group-hover:text-purple-400">
          {article.title}
        </h3>
        <p className="mb-4 flex-1 text-sm text-slate-600 line-clamp-3 dark:text-slate-400">
          {article.summary}
        </p>
        <span className="mt-auto flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-all group-hover:from-purple-700 group-hover:to-indigo-700">
          {t('landing.knowledge.readMore', 'Read Full Article')}
          <ArrowRight size={14} />
        </span>
      </div>
    </div>
  );
};

// ============================================
// MAIN SECTION
// ============================================

interface KnowledgePreviewSectionProps {
  className?: string;
  onTrialClick?: () => void;
}

export const KnowledgePreviewSection: React.FC<KnowledgePreviewSectionProps> = ({
  className = '',
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const previewLimit = 3;
  const { data: featuredArticles = [], isLoading: featuredLoading } = useKnowledgeFeatured(previewLimit);
  const { data: previewArticles = [], isLoading: previewLoading } = useKnowledgePublicPreview(previewLimit * 2);

  const articles = useMemo(
    () => buildLandingArticles(featuredArticles, previewArticles, previewLimit),
    [featuredArticles, previewArticles]
  );
  const isLoading = featuredLoading || previewLoading;

  const handleArticleClick = (article: KbArticleListItem) => {
    navigate(`${ROUTES.KNOWLEDGE_BASE_PUBLIC}/${article.category_slug}/${article.slug}`);
  };

  const handleExploreAll = () => {
    navigate(ROUTES.KNOWLEDGE_BASE_PUBLIC);
  };

  if (isLoading) {
    return (
      <section
        className={`py-20 bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 ${className}`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
          </div>
        </div>
      </section>
    );
  }

  if (articles.length === 0) return null;

  return (
    <section
      className={`py-20 bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 ${className}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm font-semibold mb-4">
            <BookOpen size={16} />
            {t('landing.knowledge.badge', 'Knowledge Base')}
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
            {t('landing.knowledge.title', 'Discover Our Expertise')}
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            {t(
              'landing.knowledge.subtitle',
              'Proven methodologies and best practices trusted by industry leaders across Europe.'
            )}
          </p>
        </div>

        {/* Article Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {articles.map((article) => (
            <PreviewCard key={article.id} article={article} onArticleClick={handleArticleClick} />
          ))}
        </div>

        {/* Footer CTA */}
        <div className="text-center">
          <button
            onClick={handleExploreAll}
            className="inline-flex items-center gap-2 px-8 py-4 bg-white dark:bg-slate-800 border-2 border-purple-600 text-purple-600 dark:text-purple-400 font-semibold rounded-xl hover:bg-purple-50 dark:hover:bg-slate-700 transition-all shadow-lg"
          >
            {t('landing.knowledge.exploreAll', 'Access Full Knowledge Base')}
            <ArrowRight size={18} />
          </button>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            {t(
              'landing.knowledge.ctaSubtext',
              'Start a free trial to unlock all articles, videos, and resources.'
            )}
          </p>
        </div>
      </div>
    </section>
  );
};

export default KnowledgePreviewSection;
