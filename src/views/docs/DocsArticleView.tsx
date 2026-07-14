/**
 * Documentation Article View
 *
 * Full article renderer with markdown content, TOC, and feedback.
 *
 * Route: /docs/:categorySlug/:articleSlug
 */

import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Book,
  Check,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  MessageSquare,
  PlayCircle,
  Share2,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { Link, useParams } from 'react-router-dom';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';

import { useDocsArticle, useDocsTrackView } from '@/hooks/useDocs';
import { cn } from '@/lib/utils';
import { getHeaders } from '@/services/api';

// Extract headings for TOC
const extractHeadings = (content: string): { id: string; text: string; level: number }[] => {
  const headings: { id: string; text: string; level: number }[] = [];
  const regex = /^(#{1,3})\s+(.+)$/gm;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const level = match[1].length;
    const text = match[2];
    const id = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    headings.push({ id, text, level });
  }
  return headings;
};

export const DocsArticleView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { categorySlug, articleSlug } = useParams<{ categorySlug: string; articleSlug: string }>();
  const [activeHeading, setActiveHeading] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<'up' | 'down' | null>(null);
  const docsLanguage = i18n.language?.startsWith('pl') ? 'pl' : 'en';

  const { data: article, isLoading, error } = useDocsArticle(articleSlug || '', docsLanguage);
  const trackView = useDocsTrackView();

  // Track view on mount
  useEffect(() => {
    if (article?.id) {
      trackView.mutate(article.id);
    }
  }, [article?.id]);

  // Scroll spy for TOC
  useEffect(() => {
    if (!article?.content) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const headings = extractHeadings(article.content);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveHeading(entry.target.id);
          }
        });
      },
      { rootMargin: '-100px 0px -80% 0px' }
    );

    headings.forEach((h) => {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [article?.content]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFeedback = async (type: 'up' | 'down') => {
    setFeedbackGiven(type);
    if (!article?.id) return;
    try {
      await fetch('/api/help/feedback', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          content_type: 'article',
          content_id: article.id,
          is_helpful: type === 'up',
          comment: null,
        }),
      });
    } catch (err) {
      console.warn('[DocsArticleView] Failed to send feedback', err);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 animate-pulse">
        <div className="h-4 w-48 rounded bg-c-border mb-6" />
        <div className="h-10 w-3/4 rounded bg-c-border mb-4" />
        <div className="h-4 w-32 rounded bg-c-border mb-8" />
        <div className="space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-4 w-full rounded bg-c-border" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <Book size={64} className="mx-auto text-c-text-secondary mb-4" />
        <h1 className="text-2xl font-bold mb-2">
          {t('docs.article.notFoundTitle', 'Article Not Found')}
        </h1>
        <p className="text-c-text-secondary mb-6">
          {t(
            'docs.article.notFoundBody',
            "The article you're looking for doesn't exist or has been moved."
          )}
        </p>
        <Link
          to="/docs"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] font-medium hover:bg-navy-800 transition-colors"
        >
          <ArrowLeft size={16} />
          {t('docs.article.backToDocs', 'Back to Documentation')}
        </Link>
      </div>
    );
  }

  const headings = extractHeadings(article.content || '');

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-c-text-muted mb-6">
        <Link to="/docs" className="hover:text-c-accent">
          {t('docs.common.docs', 'Docs')}
        </Link>
        <ChevronRight size={14} />
        <Link to={`/docs/${categorySlug}`} className="hover:text-c-accent">
          {article.category_name}
        </Link>
        <ChevronRight size={14} />
        <span className="text-c-text font-medium truncate max-w-[200px]">{article.title}</span>
      </nav>

      <div className="flex gap-8">
        {/* Main Content */}
        <article className="flex-1 min-w-0">
          {/* Header */}
          <header className="mb-8">
            {/* Category Badge */}
            <Link
              to={`/docs/${categorySlug}`}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-c-accent-soft text-c-accent text-xs font-medium mb-3 hover:bg-c-accent/15 transition-colors"
            >
              <Book size={12} />
              {article.category_name}
            </Link>

            <h1 className="text-3xl lg:text-4xl font-bold mb-4">{article.title}</h1>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-c-text-muted">
              <span className="flex items-center gap-1">
                <Clock size={14} />
                {t('docs.common.readTime', '{{count}} min read', {
                  count: article.reading_time_minutes,
                })}
              </span>
              <span className="flex items-center gap-1">
                <Eye size={14} />
                {t('docs.common.views', '{{count}} views', { count: article.view_count })}
              </span>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1 hover:text-c-accent transition-colors"
              >
                {copied ? <Check size={14} /> : <Share2 size={14} />}
                {copied ? t('docs.article.copied', 'Copied!') : t('docs.article.share', 'Share')}
              </button>
            </div>
          </header>

          {/* Video (if available) */}
          {article.video_url && (
            <div className="mb-8 rounded-xl overflow-hidden border border-c-border">
              <a
                href={article.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block relative aspect-video bg-slate-900 group"
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-navy-900 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <PlayCircle size={40} className="text-white" />
                  </div>
                </div>
                <div className="absolute bottom-4 left-4 flex items-center gap-2 text-white text-sm">
                  <ExternalLink size={14} />
                  {t('docs.article.watchVideo', 'Watch video tutorial')}
                </div>
              </a>
            </div>
          )}

          {/* Markdown Content */}
          <div className="prose prose-slate dark:prose-invert prose-headings:scroll-mt-20 prose-a:text-c-accent prose-code:before:content-none prose-code:after:content-none max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => {
                  const id = (children as string)
                    ?.toString()
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/(^-|-$)/g, '');
                  return <h1 id={id}>{children}</h1>;
                },
                h2: ({ children }) => {
                  const id = (children as string)
                    ?.toString()
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/(^-|-$)/g, '');
                  return <h2 id={id}>{children}</h2>;
                },
                h3: ({ children }) => {
                  const id = (children as string)
                    ?.toString()
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/(^-|-$)/g, '');
                  return <h3 id={id}>{children}</h3>;
                },
                code({ node, className, children, ref: _ref, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const inline = !match;
                  return inline ? (
                    <code className="px-1.5 py-0.5 rounded bg-c-surface-raised text-sm" {...props}>
                      {children}
                    </code>
                  ) : (
                    <SyntaxHighlighter
                      style={oneDark as any}
                      language={match[1]}
                      PreTag="div"
                      className="rounded-lg !bg-slate-900"
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  );
                },
                table: ({ children }) => (
                  <div className="overflow-x-auto">
                    <table
                      /* §27-exempt: tabela dokumentowa/raportowa read-only, do druku/eksportu */ className="min-w-full"
                    >
                      {children}
                    </table>
                  </div>
                ),
              }}
            >
              {article.content || ''}
            </ReactMarkdown>
          </div>

          {/* Feedback Section */}
          <div className="mt-12 p-6 rounded-xl border border-c-border bg-c-surface-raised">
            <h3 className="text-lg font-semibold mb-3">Was this article helpful?</h3>
            {feedbackGiven ? (
              <p className="text-sm text-c-text-secondary">Thank you for your feedback! 🙏</p>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleFeedback('up')}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-c-border hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-300 dark:hover:border-green-700 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                >
                  <ThumbsUp size={16} />
                  Yes
                </button>
                <button
                  onClick={() => handleFeedback('down')}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-c-border hover:bg-danger-50 dark:hover:bg-danger-900/20 hover:border-danger-300 dark:hover:border-danger-700 hover:text-danger-600 dark:hover:text-danger-400 transition-colors"
                >
                  <ThumbsDown size={16} />
                  No
                </button>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between">
            <Link
              to={`/docs/${categorySlug}`}
              className="inline-flex items-center gap-2 text-sm text-c-text-secondary hover:text-c-accent transition-colors"
            >
              <ArrowLeft size={16} />
              Back to {article.category_name}
            </Link>
          </div>
        </article>

        {/* Table of Contents - Desktop */}
        {headings.length > 0 && (
          <aside className="hidden xl:block w-64 shrink-0">
            <div className="sticky top-20">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-c-text-muted mb-3">
                On this page
              </h4>
              <nav className="space-y-1">
                {headings.map((h) => (
                  <a
                    key={h.id}
                    href={`#${h.id}`}
                    className={cn(
                      'block text-sm transition-colors',
                      h.level === 1 && 'pl-0',
                      h.level === 2 && 'pl-3',
                      h.level === 3 && 'pl-6',
                      activeHeading === h.id
                        ? 'text-c-accent font-medium'
                        : 'text-c-text-secondary hover:text-c-text'
                    )}
                  >
                    {h.text}
                  </a>
                ))}
              </nav>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

export default DocsArticleView;
