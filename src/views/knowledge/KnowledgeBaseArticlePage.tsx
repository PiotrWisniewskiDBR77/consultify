/**
 * Knowledge Base Article Page
 * Route: /knowledge-base/:categorySlug/:articleSlug
 *
 * Full article view with markdown rendering, TOC, related articles,
 * and CTA. Reuses the same API as /docs but with KB-specific layout.
 */

import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Clock,
  Copy,
  Eye,
  Home,
  Link as LinkIcon,
  Share2,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { Link, useParams } from 'react-router-dom';
import remarkGfm from 'remark-gfm';

import { useDocsArticle, useDocsTrackView } from '@/hooks/useDocs';
import { useKnowledgeRelated } from '@/hooks/useKnowledge';
import { cn } from '@/lib/utils';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

export const KnowledgeBaseArticlePage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { categorySlug, articleSlug } = useParams<{ categorySlug: string; articleSlug: string }>();
  const docsLanguage = i18n.language?.startsWith('pl') ? 'pl' : i18n.language?.startsWith('de') ? 'de' : 'en';

  const { data: article, isLoading, error } = useDocsArticle(articleSlug || '', docsLanguage);
  const trackView = useDocsTrackView();
  const { data: relatedArticles } = useKnowledgeRelated(articleSlug || '', docsLanguage, 4);

  const [activeHeading, setActiveHeading] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (article?.id) {
      trackView.mutate({ articleId: article.id, source: 'knowledge_base' });
    }
  }, [article?.id]);

  const toc = useMemo<TocItem[]>(() => {
    if (!article?.content) return [];
    const headings: TocItem[] = [];
    const lines = article.content.split('\n');
    for (const line of lines) {
      const match = line.match(/^(#{2,3})\s+(.+)/);
      if (match) {
        const text = match[2].replace(/\*\*/g, '').trim();
        const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        headings.push({ id, text, level: match[1].length });
      }
    }
    return headings;
  }, [article?.content]);

  useEffect(() => {
    if (!toc.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveHeading(entry.target.id);
          }
        }
      },
      { rootMargin: '-80px 0px -70% 0px' }
    );

    for (const item of toc) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [toc]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-navy-950">
        <div className="max-w-4xl mx-auto px-4 py-20">
          <div className="animate-pulse space-y-6">
            <div className="h-4 bg-slate-200 dark:bg-navy-800 rounded w-1/3" />
            <div className="h-10 bg-slate-200 dark:bg-navy-800 rounded w-2/3" />
            <div className="h-4 bg-slate-200 dark:bg-navy-800 rounded w-full" />
            <div className="h-4 bg-slate-200 dark:bg-navy-800 rounded w-4/5" />
            <div className="h-4 bg-slate-200 dark:bg-navy-800 rounded w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-white dark:bg-navy-950 flex items-center justify-center">
        <div className="text-center">
          <BookOpen size={48} className="mx-auto text-slate-300 dark:text-navy-700 mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            {t('kb.article.notFound', 'Article not found')}
          </h2>
          <Link to="/knowledge-base" className="text-purple-600 hover:text-purple-700 font-medium">
            {t('kb.article.backToKb', 'Back to Knowledge Base')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-navy-950">
      {/* Breadcrumb */}
      <div className="border-b border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <nav className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Link to="/knowledge-base" className="flex items-center gap-1 hover:text-purple-600 transition-colors">
              <Home size={14} />
              <span>{t('kb.breadcrumb.home', 'Knowledge Base')}</span>
            </Link>
            <ChevronRight size={14} />
            <Link to={`/knowledge-base/${categorySlug}`} className="hover:text-purple-600 transition-colors">
              {article.category_name || categorySlug}
            </Link>
            <ChevronRight size={14} />
            <span className="text-slate-900 dark:text-white font-medium truncate max-w-xs">
              {article.title}
            </span>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex gap-12">
          {/* Main Content */}
          <article className="flex-1 min-w-0 max-w-3xl">
            {/* Header */}
            <header className="mb-10">
              {article.category_name && (
                <Link
                  to={`/knowledge-base/${categorySlug}`}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium mb-4 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                >
                  {article.category_name}
                </Link>
              )}

              <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white leading-tight">
                {article.title}
              </h1>

              {article.summary && (
                <p className="mt-4 text-lg text-slate-500 dark:text-slate-400 leading-relaxed">
                  {article.summary}
                </p>
              )}

              <div className="mt-6 flex items-center gap-6 text-sm text-slate-400 dark:text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Clock size={14} />
                  {article.reading_time_minutes} {t('kb.card.min', 'min read')}
                </span>
                {article.view_count > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Eye size={14} />
                    {article.view_count} {t('kb.article.views', 'views')}
                  </span>
                )}
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-1.5 hover:text-purple-600 transition-colors"
                >
                  {copied ? <Copy size={14} /> : <LinkIcon size={14} />}
                  {copied ? t('kb.article.copied', 'Copied!') : t('kb.article.share', 'Share')}
                </button>
              </div>
            </header>

            {/* Markdown Body */}
            <div className="prose prose-slate dark:prose-invert prose-lg max-w-none
              prose-headings:scroll-mt-20
              prose-h2:text-2xl prose-h2:font-bold prose-h2:mt-12 prose-h2:mb-4
              prose-h3:text-xl prose-h3:font-semibold prose-h3:mt-8 prose-h3:mb-3
              prose-p:leading-relaxed prose-p:text-slate-600 dark:prose-p:text-slate-300
              prose-li:text-slate-600 dark:prose-li:text-slate-300
              prose-strong:text-slate-900 dark:prose-strong:text-white
              prose-a:text-purple-600 dark:prose-a:text-purple-400 prose-a:no-underline hover:prose-a:underline
              prose-blockquote:border-purple-500 prose-blockquote:bg-purple-50 dark:prose-blockquote:bg-purple-900/10 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-blockquote:px-4
              prose-table:border-collapse prose-th:bg-slate-50 dark:prose-th:bg-navy-900 prose-th:border-slate-200 dark:prose-th:border-navy-700
              prose-td:border-slate-200 dark:prose-td:border-navy-700
            ">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h2: ({ children, ...props }) => {
                    const text = String(children).replace(/\*\*/g, '');
                    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                    return <h2 id={id} {...props}>{children}</h2>;
                  },
                  h3: ({ children, ...props }) => {
                    const text = String(children).replace(/\*\*/g, '');
                    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                    return <h3 id={id} {...props}>{children}</h3>;
                  },
                }}
              >
                {article.content}
              </ReactMarkdown>
            </div>

            {/* Feedback */}
            <div className="mt-16 pt-8 border-t border-slate-200 dark:border-navy-800">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                {t('kb.article.helpful', 'Was this article helpful?')}
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setFeedback('up')}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors',
                    feedback === 'up'
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300'
                      : 'border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-400 hover:border-green-300'
                  )}
                >
                  <ThumbsUp size={14} />
                  {t('kb.article.yes', 'Yes')}
                </button>
                <button
                  onClick={() => setFeedback('down')}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors',
                    feedback === 'down'
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300'
                      : 'border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-400 hover:border-red-300'
                  )}
                >
                  <ThumbsDown size={14} />
                  {t('kb.article.no', 'No')}
                </button>
              </div>
            </div>

            {/* Related Articles */}
            {relatedArticles && relatedArticles.length > 0 && (
              <div className="mt-12">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  {t('kb.article.related', 'Related Articles')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {relatedArticles.map((related: any) => (
                    <Link
                      key={related.id}
                      to={`/knowledge-base/${related.category_slug || categorySlug}/${related.slug}`}
                      className="group p-4 rounded-xl border border-slate-200 dark:border-navy-800 hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
                    >
                      <h4 className="font-medium text-sm text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors line-clamp-2">
                        {related.title}
                      </h4>
                      <div className="mt-2 flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400">
                        <span>{t('kb.card.read', 'Read article')}</span>
                        <ArrowRight size={10} />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </article>

          {/* Sidebar: Table of Contents */}
          {toc.length > 2 && (
            <aside className="hidden xl:block w-64 flex-shrink-0">
              <div className="sticky top-20">
                <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">
                  {t('kb.article.toc', 'On this page')}
                </h4>
                <nav className="space-y-1">
                  {toc.map((item) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className={cn(
                        'block text-sm py-1 transition-colors border-l-2',
                        item.level === 2 ? 'pl-3' : 'pl-6',
                        activeHeading === item.id
                          ? 'border-purple-500 text-purple-600 dark:text-purple-400 font-medium'
                          : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                      )}
                    >
                      {item.text}
                    </a>
                  ))}
                </nav>

                {/* Back to KB */}
                <div className="mt-8 pt-6 border-t border-slate-200 dark:border-navy-800">
                  <Link
                    to="/knowledge-base"
                    className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-purple-600 transition-colors"
                  >
                    <ArrowLeft size={14} />
                    {t('kb.article.backToKb', 'Back to Knowledge Base')}
                  </Link>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBaseArticlePage;
