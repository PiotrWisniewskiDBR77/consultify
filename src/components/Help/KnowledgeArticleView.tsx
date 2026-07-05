/**
 * Knowledge Article View Component
 * Full article display with content, video, and navigation
 */

import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Clock,
  Eye,
  Play,
  Share2,
  Star,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { useLocation, useNavigate } from 'react-router-dom';

import { useHelpSidePanel } from '@/contexts/HelpContext';

import {
  useKnowledgeArticle,
  useKnowledgeRedirect,
  useKnowledgeRelated,
  useTrackArticleView,
} from '../../hooks/useKnowledge';

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
            <Play size={28} className="text-primary-600 ml-1" />
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
  onArticleClick?: (slug: string) => void;
  moduleId?: string;
}

function fallbackRouteForModule(moduleId?: string): string {
  const raw = String(moduleId || '')
    .trim()
    .toLowerCase();
  if (!raw) return '';
  if (raw === 'tools' || raw === 'discovery-tools') return '/discovery-tools';
  if (raw === 'interview') return '/interview';
  if (raw === 'outputs' || raw === 'results') return '/presentations';
  return '';
}

export const KnowledgeArticleView: React.FC<KnowledgeArticleViewProps> = ({
  slug,
  onBack,
  onArticleClick,
  moduleId,
}) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { setOpen: setHelpOpen } = useHelpSidePanel();
  const { data: article, isLoading, error } = useKnowledgeArticle(slug);
  const { mutate: trackView } = useTrackArticleView();
  const { data: relatedArticles = [] } = useKnowledgeRelated(article?.slug);
  const { data: redirectInfo } = useKnowledgeRedirect(slug);
  const isNonEnglish = !i18n.language?.startsWith('en');
  const isPolish = i18n.language?.startsWith('pl');
  const articleTags: Array<{ id: string; slug: string; kind: string; label: string }> =
    (article as any)?.tags || [];

  const closePanelAndNavigate = (targetRoute?: string) => {
    window.setTimeout(() => {
      if (targetRoute && location.pathname !== targetRoute) {
        navigate(targetRoute);
      }
      setHelpOpen(false);
    }, 0);
  };

  // Track view on mount
  useEffect(() => {
    if (article?.id) {
      trackView({ articleId: article.id, source: 'help_panel' });
    }
  }, [article?.id, trackView]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="text-center py-12">
        <BookOpen size={40} className="mx-auto text-slate-600 dark:text-slate-400 mb-3" />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {t('help.knowledge.contentMoved', 'This content has been moved or removed.')}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {t('help.knowledge.contentMovedHint', 'Browse our collections to find what you need.')}
        </p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 text-sm font-medium text-primary-600 hover:text-primary-700 bg-primary-50 dark:bg-primary-900/20 rounded-lg"
        >
          ← {t('help.knowledge.browseCollections', 'Browse collections')}
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
        return typeof parsed === 'object' && parsed
          ? String((parsed as any).route || '').trim()
          : '';
      } catch {
        return '';
      }
    }
    return typeof raw === 'object' ? String((raw as any).route || '').trim() : '';
  })();
  const contextualFallbackRoute = fallbackRouteForModule(moduleId);
  const effectiveNextRoute = nextActionRoute || contextualFallbackRoute;
  const requested = String((article as any)?.requested_language || '');
  const resolved = String((article as any)?.resolved_language || '');
  const isFallback =
    Boolean((article as any)?.is_fallback) ||
    (article as any)?.translation_status === 'missing' ||
    (requested !== '' && resolved !== '' && requested !== resolved);

  const isStale = (article as any)?.translation_status === 'stale';

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
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-[10px] font-semibold rounded-full uppercase">
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
        {/* P26-B: Deprecation banner */}
        {redirectInfo?.deprecationReason && (
          <div className="mb-4 rounded-xl border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-900 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-200 flex items-start gap-2">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">
                {t('help.knowledge.deprecated', 'This article has been deprecated')}
              </p>
              <p className="mt-0.5">{redirectInfo.deprecationReason}</p>
              {redirectInfo.redirectSlug ? (
                <button
                  onClick={() => {
                    onBack();
                    setTimeout(() => onArticleClick?.(redirectInfo.redirectSlug!), 100);
                  }}
                  className="mt-1 text-danger-700 dark:text-danger-300 underline hover:no-underline"
                >
                  {t('help.knowledge.viewReplacement', 'View replacement article')} →
                </button>
              ) : (
                <button
                  onClick={() => onBack()}
                  className="mt-1 text-danger-700 dark:text-danger-300 underline hover:no-underline"
                >
                  {t('help.knowledge.browseCollections', 'Browse collections')} →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Explicit PL degraded + EN fallback */}
        {isNonEnglish && isFallback && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            {t('help.knowledge.missingTranslationBanner', 'Translation not available — showing EN')}
          </div>
        )}

        {/* Stale translation banner */}
        {isStale && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            {t(
              'help.knowledge.staleTranslation',
              'This translation may be outdated — the original article has been updated since.'
            )}
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

        {/* P26-B: Article tags */}
        {articleTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {articleTags.map((tag) => {
              const kindColors: Record<string, string> = {
                domain: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
                tool: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
                concept:
                  'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300',
                stage: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
                audience: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
              };
              return (
                <span
                  key={tag.id}
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${kindColors[tag.kind] || 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300'}`}
                >
                  {tag.label}
                </span>
              );
            })}
          </div>
        )}

        {/* Video */}
        {article.video_url && (
          <VideoPlayer url={article.video_url} poster={article.thumbnail_url} />
        )}

        {/* Next action (if defined) */}
        {effectiveNextRoute ? (
          <div className="mb-5">
            <button
              type="button"
              onClick={() => closePanelAndNavigate(effectiveNextRoute)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-c-text px-4 py-2.5 text-sm font-semibold text-c-bg hover:bg-c-text-secondary transition-colors"
              data-testid="help-next-action"
            >
              {nextActionRoute
                ? t('help.knowledge.nextAction', 'Next action')
                : t('help.knowledge.backToSurface', 'Back to work')}
            </button>
          </div>
        ) : (
          <div className="mb-5">
            <button
              type="button"
              onClick={() => closePanelAndNavigate()}
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
                  <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-navy-800 rounded text-xs font-mono text-primary-600 dark:text-primary-400">
                    {children}
                  </code>
                );
              },
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-primary-500 pl-4 py-2 bg-primary-50 dark:bg-primary-900/20 rounded-r-lg mb-3 italic text-slate-600 dark:text-slate-300">
                  {children}
                </blockquote>
              ),
              table: ({ children }) => (
                <div className="overflow-x-auto mb-4">
                  <table /* §27-exempt: render danych nie-listowy, nie spelnia definicji 1 (przegladana kolekcja encji z akcjami) */  className="min-w-full text-sm border-collapse border border-slate-200 dark:border-navy-700">
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

        {/* P26-B: Related Articles (curated) */}
        {relatedArticles.length > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-navy-700">
            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">
              {t('help.knowledge.relatedArticles', 'Related Articles')}
            </h4>
            <div className="grid gap-2">
              {relatedArticles.map((rel) => (
                <button
                  key={rel.id}
                  onClick={() => onArticleClick?.(rel.slug) ?? onBack()}
                  className="w-full text-left p-3 rounded-lg border border-slate-200 dark:border-navy-700 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm transition-all group flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 truncate">
                      {rel.title}
                    </p>
                    <p className="text-[10px] text-slate-600 flex items-center gap-2 mt-0.5">
                      <Clock size={10} /> {rel.reading_time_minutes} min
                    </p>
                  </div>
                  <ChevronRight
                    size={14}
                    className="text-slate-600 group-hover:text-primary-500 flex-shrink-0"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div className="pt-4 mt-4 border-t border-slate-200 dark:border-navy-700">
        <button
          onClick={() => {
            const deepLink = `${window.location.origin}${window.location.pathname}?help_article=${encodeURIComponent(slug)}${moduleId ? `&help_module=${encodeURIComponent(moduleId)}` : ''}`;
            navigator.clipboard.writeText(deepLink).catch(() => {});
          }}
          className="w-full py-3 px-4 bg-gradient-to-r from-primary-600 to-crimson-600 text-white font-medium rounded-xl hover:from-primary-700 hover:to-crimson-700 transition-all flex items-center justify-center gap-2 shadow-lg"
        >
          <Share2 size={16} />
          {t('help.knowledge.shareArticle', 'Share Article')}
        </button>
      </div>
    </div>
  );
};

export default KnowledgeArticleView;
