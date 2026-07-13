/**
 * Knowledge Preview Section for Landing Page
 * Shows featured articles with teaser videos and CTAs
 */

import { ArrowRight, BookOpen, Clock, Play } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { isKbCategoryForCurrentSite } from '../../config/knowledgeBaseSite';
import {
  KbArticleListItem,
  useKnowledgeFeatured,
  useKnowledgePublicPreview,
} from '../../hooks/useKnowledge';
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
      className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-xl transition-all group hover:shadow-2xl cursor-pointer"
      onClick={() => onArticleClick(article)}
    >
      {/* Video Teaser / Thumbnail */}
      <div className="relative aspect-video bg-gradient-to-br from-c-accent to-c-accent/70 overflow-hidden">
        {article.thumbnail_url ? (
          <img
            src={
              kbThumb(article.thumbnail_url) ||
              kbImg(article.thumbnail_url) ||
              article.thumbnail_url
            }
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
              <Play size={24} className="text-c-accent ml-1" />
            </div>
          </div>
        )}

        {/* Category Badge */}
        <div className="absolute top-3 left-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-c-surface/90 backdrop-blur-sm text-c-accent text-xs font-semibold rounded-full">
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
        <h3 className="mb-2 min-h-[3.5rem] text-lg font-bold text-c-text transition-colors line-clamp-2 group-hover:text-c-accent">
          {article.title}
        </h3>
        <p className="mb-4 flex-1 text-sm text-c-text-secondary line-clamp-3">
          {article.summary}
        </p>
        <span className="mt-auto flex w-full items-center justify-center gap-2 rounded-lg bg-c-text px-4 py-2.5 text-sm font-semibold text-c-surface transition-all group-hover:opacity-90">
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
  const { data: featuredArticles = [], isLoading: featuredLoading } =
    useKnowledgeFeatured(previewLimit);
  const { data: previewArticles = [], isLoading: previewLoading } = useKnowledgePublicPreview(
    previewLimit * 2
  );

  const articles = useMemo(
    () =>
      buildLandingArticles(
        featuredArticles.filter((a) => isKbCategoryForCurrentSite(a.category_slug)),
        previewArticles.filter((a) => isKbCategoryForCurrentSite(a.category_slug)),
        previewLimit
      ),
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
        className={`py-20 bg-c-bg ${className}`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-c-accent" />
          </div>
        </div>
      </section>
    );
  }

  if (articles.length === 0) return null;

  return (
    <section className={`py-20 bg-c-bg ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-c-accent-soft text-c-accent rounded-full text-sm font-semibold mb-4">
            <BookOpen size={16} />
            {t('landing.knowledge.badge', 'Knowledge Base')}
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-c-text mb-4">
            {t('landing.knowledge.title', 'Discover Our Expertise')}
          </h2>
          <p className="text-lg text-c-text-secondary max-w-2xl mx-auto">
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
            className="inline-flex items-center gap-2 px-8 py-4 bg-c-surface border-2 border-c-accent text-c-accent font-semibold rounded-xl hover:bg-c-accent-soft transition-all shadow-lg"
          >
            {t('landing.knowledge.exploreAll', 'Access Full Knowledge Base')}
            <ArrowRight size={18} />
          </button>
          <p className="mt-4 text-sm text-c-text-muted">
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
