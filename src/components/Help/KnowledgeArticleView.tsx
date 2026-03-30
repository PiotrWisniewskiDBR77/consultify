/**
 * Knowledge Article View Component
 * Full article display with content, video, and navigation
 */

import { ArrowLeft, BookOpen, Clock, Eye, Play, Share2, Star } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';

import { useHelpSidePanel } from '@/contexts/HelpContext';
import { useKnowledgeArticle, useTrackArticleView } from '../../hooks/useKnowledge';

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
// VIDEO PLAYER
// ============================================

interface VideoPlayerProps {
  url: string;
  poster?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ url, poster }) => {
  const [isPlaying, setIsPlaying] = useState(false);

  if (!url) return null;

  // Check if it's a HeyGen or external video URL
  const isEmbedded = url.includes('youtube') || url.includes('vimeo') || url.includes('heygen');

  if (isEmbedded) {
    return (
      <div className="w-full aspect-video rounded-xl overflow-hidden bg-slate-900 mb-6">
        <iframe
          src={url}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className="w-full aspect-video rounded-xl overflow-hidden bg-slate-900 mb-6 relative group">
      <video
        src={url}
        poster={poster}
        controls={isPlaying}
        className="w-full h-full object-cover"
        onPlay={() => setIsPlaying(true)}
      />
      {!isPlaying && (
        <button
          onClick={() => setIsPlaying(true)}
          className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors"
        >
          <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
            <Play size={28} className="text-purple-600 ml-1" />
          </div>
        </button>
      )}
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

interface KnowledgeArticleViewProps {
  slug: string;
  onBack: () => void;
}

export const KnowledgeArticleView: React.FC<KnowledgeArticleViewProps> = ({ slug, onBack }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { setOpen: setHelpOpen } = useHelpSidePanel();
  const { data: article, isLoading, error } = useKnowledgeArticle(slug);
  const { mutate: trackView } = useTrackArticleView();
  const isPolish = i18n.language?.startsWith('pl');

  // Track view on mount
  useEffect(() => {
    if (article?.id) {
      trackView({ articleId: article.id, source: 'help_panel' });
    }
  }, [article?.id, trackView]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="text-center py-12">
        <BookOpen size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('help.knowledge.articleNotFound', 'Article not found.')}
        </p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 text-sm font-medium text-purple-600 hover:text-purple-700"
        >
          ← {t('help.knowledge.backToSearch', 'Search help')}
        </button>
      </div>
    );
  }

  const nextActionRoute = (() => {
    const raw = (article as any)?.next_action;
    if (!raw) return '';
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return typeof parsed === 'object' && parsed ? String((parsed as any).route || '').trim() : '';
      } catch {
        return '';
      }
    }
    return typeof raw === 'object' ? String((raw as any).route || '').trim() : '';
  })();
  const isFallback =
    Boolean((article as any)?.is_fallback) ||
    (String((article as any)?.requested_language || '') === 'pl' &&
      String((article as any)?.resolved_language || '') === 'en');

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200 dark:border-navy-700">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
        >
          <ArrowLeft size={16} className="text-slate-500" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[10px] font-semibold rounded-full uppercase">
              <DynamicIcon name={article.category_icon || 'BookOpen'} size={10} />
              {article.category_name}
            </span>
            {article.is_featured && <Star size={12} className="text-amber-500 fill-amber-500" />}
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">
            {article.title}
          </h2>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Explicit PL degraded + EN fallback */}
        {isPolish && isFallback && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            {t('help.knowledge.missingTranslationBanner', 'Brak wersji PL — wyświetlamy EN')}
          </div>
        )}

        {/* Meta */}
        <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {article.reading_time_minutes} {t('help.knowledge.minRead', 'min read')}
          </span>
          <span className="flex items-center gap-1">
            <Eye size={12} />
            {article.view_count} {t('help.knowledge.views', 'views')}
          </span>
        </div>

        {/* Video */}
        {article.video_url && (
          <VideoPlayer url={article.video_url} poster={article.thumbnail_url} />
        )}

        {/* Next action (if defined) */}
        {nextActionRoute ? (
          <div className="mb-5">
            <button
              type="button"
              onClick={() => {
                setHelpOpen(false);
                navigate(nextActionRoute);
              }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 transition-colors"
              data-testid="help-next-action"
            >
              {t('help.knowledge.nextAction', 'Next action')}
            </button>
          </div>
        ) : (
          <div className="mb-5">
            <button
              type="button"
              onClick={() => setHelpOpen(false)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-navy-700 dark:bg-navy-900 dark:text-slate-200 dark:hover:bg-white/[0.04] transition-colors"
              data-testid="help-back-to-surface"
            >
              {t('help.knowledge.backToSurface', 'Back to work')}
            </button>
          </div>
        )}

        {/* Markdown Content */}
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown
            components={{
              h1: ({ children }) => (
                <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-6 mb-3">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mt-5 mb-2">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-base font-medium text-slate-700 dark:text-slate-200 mt-4 mb-2">
                  {children}
                </h3>
              ),
              p: ({ children }) => (
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-3 leading-relaxed">
                  {children}
                </p>
              ),
              ul: ({ children }) => (
                <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-300 mb-3 space-y-1">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal list-inside text-sm text-slate-600 dark:text-slate-300 mb-3 space-y-1">
                  {children}
                </ol>
              ),
              code: ({ children, className }) => {
                const isBlock = className?.includes('language-');
                if (isBlock) {
                  return (
                    <pre className="bg-slate-100 dark:bg-navy-900 rounded-lg p-3 overflow-x-auto mb-3">
                      <code className="text-xs font-mono text-slate-800 dark:text-slate-200">
                        {children}
                      </code>
                    </pre>
                  );
                }
                return (
                  <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-navy-800 rounded text-xs font-mono text-purple-600 dark:text-purple-400">
                    {children}
                  </code>
                );
              },
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-purple-500 pl-4 py-2 bg-purple-50 dark:bg-purple-900/20 rounded-r-lg mb-3 italic text-slate-600 dark:text-slate-300">
                  {children}
                </blockquote>
              ),
              table: ({ children }) => (
                <div className="overflow-x-auto mb-4">
                  <table className="min-w-full text-sm border-collapse border border-slate-200 dark:border-navy-700">
                    {children}
                  </table>
                </div>
              ),
              th: ({ children }) => (
                <th className="border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 px-3 py-2 text-left font-medium text-slate-700 dark:text-slate-300">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="border border-slate-200 dark:border-navy-700 px-3 py-2 text-slate-600 dark:text-slate-400">
                  {children}
                </td>
              ),
            }}
          >
            {article.content}
          </ReactMarkdown>
        </div>

        {/* Related Modules */}
        {article.related_modules && article.related_modules.length > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-navy-700">
            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">
              {t('help.knowledge.relatedModules', 'Related Modules')}
            </h4>
            <div className="flex flex-wrap gap-2">
              {article.related_modules.map((mod) => (
                <span
                  key={mod}
                  className="px-2 py-1 bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 text-xs rounded-md uppercase"
                >
                  {mod}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div className="pt-4 mt-4 border-t border-slate-200 dark:border-navy-700">
        <button className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg">
          <Share2 size={16} />
          {t('help.knowledge.shareArticle', 'Share Article')}
        </button>
      </div>
    </div>
  );
};

export default KnowledgeArticleView;
