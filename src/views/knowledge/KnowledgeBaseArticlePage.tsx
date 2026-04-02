/**
 * Knowledge Base Article Page
 * Route: /knowledge-base/:categorySlug/:articleSlug
 *
 * Full article view with dark glass aesthetic matching the LP.
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
      <div className="min-h-screen bg-[#0A0A1F]">
        <div className="max-w-4xl mx-auto px-6 py-24">
          <div className="animate-pulse space-y-6">
            <div className="h-4 bg-white/[0.06] rounded w-1/3" />
            <div className="h-10 bg-white/[0.06] rounded w-2/3" />
            <div className="aspect-[16/9] bg-white/[0.04] rounded-2xl" />
            <div className="h-4 bg-white/[0.04] rounded w-full" />
            <div className="h-4 bg-white/[0.04] rounded w-4/5" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-[#0A0A1F] flex items-center justify-center">
        <div className="text-center">
          <BookOpen size={48} className="mx-auto text-white/20 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">
            {t('kb.article.notFound', 'Article not found')}
          </h2>
          <Link to="/knowledge-base" className="text-primary-400 hover:text-primary-300 font-semibold">
            {t('kb.article.backToKb', 'Back to Knowledge Base')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A1F] text-white relative overflow-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[linear-gradient(160deg,#0D0828_0%,#0A0A1F_45%,#12082E_100%)]" />
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(109,40,217,0.12)_0%,transparent_65%)] blur-[80px]" />
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
            <Link to={`/knowledge-base/${categorySlug}`} className="hover:text-primary-400 transition-colors">
              {article.category_name || categorySlug}
            </Link>
            <ChevronRight size={14} />
            <span className="text-white/70 font-medium truncate max-w-xs">
              {article.title}
            </span>
          </nav>
        </div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        <div className="flex gap-12">
          {/* Main Content */}
          <article className="flex-1 min-w-0 max-w-3xl">
            <motion.header
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-10"
            >
              {article.category_name && (
                <Link
                  to={`/knowledge-base/${categorySlug}`}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-primary-500/25 bg-primary-600/10 text-primary-300 text-[10px] font-bold uppercase tracking-wider mb-5 hover:bg-primary-600/20 transition-colors"
                >
                  {article.category_name}
                </Link>
              )}

              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-[1.1]">
                {article.title}
              </h1>

              {article.summary && (
                <p className="mt-4 text-lg text-white/45 leading-relaxed font-medium">
                  {article.summary}
                </p>
              )}

              <div className="mt-6 flex items-center gap-6 text-sm text-white/30">
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
                  className="flex items-center gap-1.5 hover:text-primary-400 transition-colors"
                >
                  {copied ? <Copy size={14} /> : <LinkIcon size={14} />}
                  {copied ? t('kb.article.copied', 'Copied!') : t('kb.article.share', 'Share')}
                </button>
              </div>

              {/* Hero image is embedded in the markdown content */}
            </motion.header>

            {/* Markdown Body */}
            <div className="
              prose prose-invert prose-lg max-w-none
              prose-headings:scroll-mt-20 prose-headings:font-black prose-headings:tracking-tight
              prose-h2:text-2xl prose-h2:mt-14 prose-h2:mb-5 prose-h2:text-white
              prose-h3:text-xl prose-h3:mt-10 prose-h3:mb-4 prose-h3:text-white/90
              prose-p:leading-relaxed prose-p:text-white/60
              prose-li:text-white/60
              prose-strong:text-white prose-strong:font-bold
              prose-a:text-primary-400 prose-a:no-underline hover:prose-a:underline hover:prose-a:text-primary-300
              prose-blockquote:border-primary-500/40 prose-blockquote:bg-primary-900/10 prose-blockquote:rounded-r-xl prose-blockquote:py-2 prose-blockquote:px-5 prose-blockquote:text-white/55 prose-blockquote:not-italic
              prose-table:border-collapse
              prose-th:bg-white/[0.04] prose-th:border-white/[0.08] prose-th:text-white/70 prose-th:font-bold prose-th:text-sm
              prose-td:border-white/[0.06] prose-td:text-white/55
              prose-code:text-primary-300 prose-code:bg-primary-900/20 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
              prose-pre:bg-[#0D0828] prose-pre:border prose-pre:border-white/[0.06] prose-pre:rounded-xl
              prose-hr:border-white/[0.06]
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
                  img: ({ src, alt, ...props }) => (
                    <figure className="my-10">
                      <img
                        src={src}
                        alt={alt || ''}
                        className="w-full rounded-xl border border-white/[0.06]"
                        loading="lazy"
                        {...props}
                      />
                    </figure>
                  ),
                }}
              >
                {article.content}
              </ReactMarkdown>
            </div>

            {/* Feedback */}
            <div className="mt-16 pt-8 border-t border-white/[0.06]">
              <p className="text-sm text-white/40 mb-3">
                {t('kb.article.helpful', 'Was this article helpful?')}
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setFeedback('up')}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all',
                    feedback === 'up'
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                      : 'border-white/[0.08] text-white/40 hover:border-emerald-500/25 hover:text-emerald-400'
                  )}
                >
                  <ThumbsUp size={14} />
                  {t('kb.article.yes', 'Yes')}
                </button>
                <button
                  onClick={() => setFeedback('down')}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all',
                    feedback === 'down'
                      ? 'bg-red-500/15 border-red-500/30 text-red-400'
                      : 'border-white/[0.08] text-white/40 hover:border-red-500/25 hover:text-red-400'
                  )}
                >
                  <ThumbsDown size={14} />
                  {t('kb.article.no', 'No')}
                </button>
              </div>
            </div>

            {/* Related Articles */}
            {relatedArticles && relatedArticles.length > 0 && (
              <div className="mt-14">
                <h3 className="text-lg font-black text-white mb-5 tracking-tight">
                  {t('kb.article.related', 'Related Articles')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {relatedArticles.map((related: any) => (
                    <Link
                      key={related.id}
                      to={`/knowledge-base/${related.category_slug || categorySlug}/${related.slug}`}
                      className="group p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12] transition-all duration-200"
                    >
                      <h4 className="font-bold text-sm text-white group-hover:text-primary-300 transition-colors line-clamp-2 leading-snug">
                        {related.title}
                      </h4>
                      <div className="mt-3 flex items-center gap-1 text-xs text-primary-400 font-bold">
                        <span>{t('kb.card.read', 'Read article')}</span>
                        <ArrowRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
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
                <h4 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-5">
                  {t('kb.article.toc', 'On this page')}
                </h4>
                <nav className="space-y-0.5">
                  {toc.map((item) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className={cn(
                        'block text-[13px] py-1.5 transition-all duration-200 border-l-2',
                        item.level === 2 ? 'pl-3' : 'pl-6',
                        activeHeading === item.id
                          ? 'border-primary-500 text-primary-400 font-semibold'
                          : 'border-white/[0.06] text-white/35 hover:text-white/60 hover:border-white/[0.15]'
                      )}
                    >
                      {item.text}
                    </a>
                  ))}
                </nav>

                <div className="mt-10 pt-6 border-t border-white/[0.06]">
                  <Link
                    to="/knowledge-base"
                    className="flex items-center gap-2 text-sm text-white/35 hover:text-primary-400 transition-colors font-medium"
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
