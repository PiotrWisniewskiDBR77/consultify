/**
 * Knowledge Preview Section for Landing Page
 * Shows featured articles with teaser videos and CTAs
 */

import { ArrowRight, BookOpen, Clock, Play } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { KbArticleListItem, useKnowledgePublicPreview } from '../../hooks/useKnowledge';
import { ROUTES } from '../../routes/routeConfig';

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

// ============================================
// PREVIEW CARD
// ============================================

interface PreviewCardProps {
  article: KbArticleListItem & { video_teaser_url?: string };
  onCTAClick: () => void;
}

const PreviewCard: React.FC<PreviewCardProps> = ({ article, onCTAClick }) => {
  const { t } = useTranslation();

  return (
    <div className="relative bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-xl border border-slate-200 dark:border-slate-700 hover:shadow-2xl transition-all group">
      {/* Video Teaser / Thumbnail */}
      <div className="relative aspect-video bg-gradient-to-br from-purple-900 to-indigo-900 overflow-hidden">
        {article.thumbnail_url ? (
          <img
            src={article.thumbnail_url}
            alt={article.title}
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
            {article.reading_time_minutes} min
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 line-clamp-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
          {article.title}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">
          {article.summary}
        </p>
        <button
          onClick={onCTAClick}
          className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-semibold rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2"
        >
          {t('landing.knowledge.readMore', 'Read Full Article')}
          <ArrowRight size={14} />
        </button>
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
  onTrialClick,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: articles = [], isLoading } = useKnowledgePublicPreview(3);

  const handleCTAClick = () => {
    if (onTrialClick) {
      onTrialClick();
      return;
    }
    navigate(ROUTES.TRIAL_ENTRY);
  };

  const handleExploreAll = () => {
    if (onTrialClick) {
      onTrialClick();
      return;
    }
    navigate(ROUTES.TRIAL_ENTRY);
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
            <PreviewCard key={article.id} article={article} onCTAClick={handleCTAClick} />
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
