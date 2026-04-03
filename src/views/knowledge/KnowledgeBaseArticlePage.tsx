/**
 * Knowledge Base Article Page
 * Route: /knowledge-base/:categorySlug/:articleSlug
 *
 * Standard for ALL articles: editorial reading experience, not documentation.
 * - Strips metadata headers (Target persona, Funnel stage, etc.)
 * - Lead paragraph with elevated typography
 * - Pullquotes with accent styling
 * - Truncated alt texts (no image generation prompts as captions)
 * - Reading progress bar
 * - Mobile TOC
 * - Listen (TTS) button
 * - "Discuss with Anna" contextual CTA
 * - Per-article SEO (title, og, canonical, JSON-LD)
 * - Previous/Next navigation
 * - Social share (Web Share API + LinkedIn + X)
 * - Back to top
 */

import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Copy,
  Eye,
  Headphones,
  Home,
  Linkedin,
  MessageCircle,
  Pause,
  Share2,
  ThumbsDown,
  ThumbsUp,
  Twitter,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { Link, useParams } from 'react-router-dom';
import remarkGfm from 'remark-gfm';

import { MarketingLayout } from '@/components/Landing/MarketingLayout';
import { KbArticleListItem, useDocsArticle, useDocsArticles, useDocsTrackView } from '@/hooks/useDocs';
import { useKnowledgeRelated } from '@/hooks/useKnowledge';
import { cn } from '@/lib/utils';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface AnnaArticleContext {
  surface: 'knowledge_article';
  articleTitle: string;
  articleSummary?: string;
  categoryName?: string;
  currentSection?: string;
  articleUrl?: string;
}

const METADATA_LINE_PATTERN = /^(Target persona|Funnel stage|Funnel-Stufe|Core problem|Main promise|Docelowa persona|Etap lejka|Główny problem|Główna obietnica|Zielpersona|Kernproblem|Hauptversprechen|Hlavní problém|Direct answer):\s/i;

function stripMetadataFromContent(content: string): string {
  const lines = content.split('\n');
  const filtered: string[] = [];
  let pastHeader = false;

  for (const line of lines) {
    if (!pastHeader && (METADATA_LINE_PATTERN.test(line.trim()) || line.trim() === '')) {
      if (line.trim() === '' && filtered.length === 0) continue;
      if (METADATA_LINE_PATTERN.test(line.trim())) continue;
    } else {
      pastHeader = true;
    }
    if (pastHeader) filtered.push(line);
  }

  return filtered.join('\n').replace(/^\n+/, '');
}

function truncateAltText(alt: string | undefined): string | undefined {
  if (!alt) return undefined;
  if (alt.length <= 80) return alt;
  return undefined;
}

function useScrollProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const st = window.scrollY;
      const dh = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(dh > 0 ? Math.min(st / dh, 1) : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return progress;
}

function useArticleSeo(article: any, categorySlug?: string) {
  useEffect(() => {
    if (!article) return;
    const title = `${article.title} | Consultify`;
    const description = article.summary || '';
    const url = `${window.location.origin}/knowledge-base/${categorySlug}/${article.slug}`;

    document.title = title;

    const setMeta = (attr: string, key: string, val: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!val) { el?.remove(); return; }
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
      el.content = val;
    };

    setMeta('name', 'description', description);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', 'article');
    setMeta('property', 'og:url', url);
    if (article.thumbnail_url) setMeta('property', 'og:image', article.thumbnail_url);
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
    canonical.href = url;

    let jsonLd = document.querySelector('script[data-kb-jsonld]') as HTMLScriptElement | null;
    if (!jsonLd) { jsonLd = document.createElement('script'); jsonLd.type = 'application/ld+json'; jsonLd.setAttribute('data-kb-jsonld', ''); document.head.appendChild(jsonLd); }
    jsonLd.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: article.title,
      description,
      url,
      ...(article.thumbnail_url && { image: article.thumbnail_url }),
      ...(article.reading_time_minutes && { timeRequired: `PT${article.reading_time_minutes}M` }),
      publisher: { '@type': 'Organization', name: 'Consultify', url: 'https://consultify.ai' },
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Knowledge Base', item: `${window.location.origin}/knowledge-base` },
          { '@type': 'ListItem', position: 2, name: article.category_name || categorySlug, item: `${window.location.origin}/knowledge-base/${categorySlug}` },
          { '@type': 'ListItem', position: 3, name: article.title },
        ],
      },
    });

    return () => {
      document.querySelector('link[rel="canonical"]')?.remove();
      document.querySelector('script[data-kb-jsonld]')?.remove();
    };
  }, [article, categorySlug]);
}

function useTTS(content: string | undefined) {
  const [isPlaying, setIsPlaying] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const toggle = useCallback(() => {
    if (!content) return;
    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }
    const plain = content
      .replace(/^#+\s+.*/gm, '')
      .replace(/[*_`~]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\|[^|]+\|/g, '')
      .replace(/-{3,}/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    const utt = new SpeechSynthesisUtterance(plain);
    utt.rate = 0.95;
    utt.onend = () => setIsPlaying(false);
    utt.onerror = () => setIsPlaying(false);
    utteranceRef.current = utt;
    window.speechSynthesis.speak(utt);
    setIsPlaying(true);
  }, [content, isPlaying]);

  useEffect(() => {
    return () => { window.speechSynthesis?.cancel(); };
  }, []);

  return { isPlaying, toggle, supported: typeof window !== 'undefined' && 'speechSynthesis' in window };
}

export const KnowledgeBaseArticlePage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { categorySlug, articleSlug } = useParams<{ categorySlug: string; articleSlug: string }>();
  const docsLanguage = i18n.language?.startsWith('pl') ? 'pl' : i18n.language?.startsWith('de') ? 'de' : 'en';

  const { data: article, isLoading, error } = useDocsArticle(articleSlug || '', docsLanguage);
  const trackView = useDocsTrackView();
  const { data: relatedArticles } = useKnowledgeRelated(articleSlug || '');

  const { data: categoryArticlesData } = useDocsArticles({
    language: docsLanguage,
    categorySlug: categorySlug || undefined,
    limit: 100,
  });
  const categoryArticles = categoryArticlesData?.articles;

  const [activeHeading, setActiveHeading] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const articleContentRef = useRef<HTMLDivElement>(null);

  const scrollProgress = useScrollProgress();
  useArticleSeo(article, categorySlug);

  const cleanContent = useMemo(() => {
    if (!article?.content) return '';
    return stripMetadataFromContent(article.content);
  }, [article?.content]);

  const tts = useTTS(cleanContent);

  useEffect(() => {
    if (article?.id) {
      trackView.mutate(article.id);
    }
  }, [article?.id]);

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const { prevArticle, nextArticle } = useMemo(() => {
    if (!categoryArticles?.length || !articleSlug) return { prevArticle: null, nextArticle: null };
    const idx = categoryArticles.findIndex((a: KbArticleListItem) => a.slug === articleSlug);
    return {
      prevArticle: idx > 0 ? categoryArticles[idx - 1] : null,
      nextArticle: idx >= 0 && idx < categoryArticles.length - 1 ? categoryArticles[idx + 1] : null,
    };
  }, [categoryArticles, articleSlug]);

  const toc = useMemo<TocItem[]>(() => {
    if (!cleanContent) return [];
    const headings: TocItem[] = [];
    for (const line of cleanContent.split('\n')) {
      const match = line.match(/^(#{2,3})\s+(.+)/);
      if (match) {
        const text = match[2].replace(/\*\*/g, '').trim();
        const id = text.toLowerCase().replace(/[^a-z0-9\u0100-\u024f]+/g, '-').replace(/(^-|-$)/g, '');
        headings.push({ id, text, level: match[1].length });
      }
    }
    return headings;
  }, [cleanContent]);

  const currentSectionTitle = useMemo(() => {
    if (!toc.length) return undefined;

    const activeItem = toc.find((item) => item.id === activeHeading);
    if (activeItem) return activeItem.text;

    if (typeof window === 'undefined') return undefined;
    const hash = window.location.hash.replace(/^#/, '').trim();
    return toc.find((item) => item.id === hash)?.text;
  }, [activeHeading, toc]);

  const annaArticleContext = useMemo<AnnaArticleContext | null>(() => {
    if (!article?.title) return null;

    return {
      surface: 'knowledge_article',
      articleTitle: article.title,
      articleSummary: article.summary || undefined,
      categoryName: article.category_name || undefined,
      currentSection: currentSectionTitle,
      articleUrl: typeof window !== 'undefined' ? window.location.href : undefined,
    };
  }, [article?.category_name, article?.summary, article?.title, currentSectionTitle]);

  useEffect(() => {
    if (!toc.length) return;
    const observer = new IntersectionObserver(
      (entries) => { for (const e of entries) { if (e.isIntersecting) setActiveHeading(e.target.id); } },
      { rootMargin: '-80px 0px -70% 0px' }
    );
    for (const item of toc) { const el = document.getElementById(item.id); if (el) observer.observe(el); }
    return () => observer.disconnect();
  }, [toc]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.dispatchEvent(new CustomEvent('anna:context', { detail: { context: annaArticleContext } }));

    return () => {
      window.dispatchEvent(new CustomEvent('anna:context', { detail: { context: null } }));
    };
  }, [annaArticleContext]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try { await navigator.share({ title: article?.title, url: window.location.href }); return; } catch {}
    }
    handleCopyLink();
  }, [article?.title, handleCopyLink]);

  const handleFeedback = useCallback((type: 'up' | 'down') => {
    setFeedback(type);
    fetch(`/api/public/kb-v8/articles/${articleSlug}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, source: 'knowledge_base' }),
    }).catch(() => {});
  }, [articleSlug]);

  const handleAskAnna = useCallback(() => {
    const prompt = article?.title
      ? (docsLanguage === 'pl'
          ? `Przeczytałem artykuł "${article.title}"${currentSectionTitle ? `, sekcja "${currentSectionTitle}"` : ''}. Chcę dowiedzieć się więcej.`
          : docsLanguage === 'de'
          ? `Ich habe den Artikel "${article.title}"${currentSectionTitle ? `, Abschnitt "${currentSectionTitle}"` : ''}, gelesen. Ich möchte mehr erfahren.`
          : `I just read "${article.title}"${currentSectionTitle ? `, especially the section "${currentSectionTitle}"` : ''}. I want to learn more.`)
      : undefined;
    window.dispatchEvent(new CustomEvent('anna:open', { detail: { prompt, context: annaArticleContext } }));
  }, [annaArticleContext, article?.title, currentSectionTitle, docsLanguage]);

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  // --- Rendering helpers for markdown components ---
  let paragraphIndex = 0;

  if (isLoading) {
    return (
      <MarketingLayout>
        <div className="relative">
          <div className="fixed inset-0 pointer-events-none z-0">
            <div className="absolute inset-0 bg-[linear-gradient(160deg,#f8fafc_0%,#eef2ff_45%,#f8fafc_100%)] dark:bg-[linear-gradient(160deg,#0D0828_0%,#0A0A1F_45%,#12082E_100%)]" />
          </div>
          <div className="relative z-10 max-w-4xl mx-auto px-6 py-24">
            <div className="animate-pulse space-y-6">
              <div className="h-4 bg-slate-200 rounded w-1/3 dark:bg-white/[0.06]" />
              <div className="h-10 bg-slate-200 rounded w-2/3 dark:bg-white/[0.06]" />
              <div className="aspect-[16/9] bg-slate-100 rounded-2xl dark:bg-white/[0.04]" />
              <div className="h-4 bg-slate-100 rounded w-full dark:bg-white/[0.04]" />
              <div className="h-4 bg-slate-100 rounded w-4/5 dark:bg-white/[0.04]" />
            </div>
          </div>
        </div>
      </MarketingLayout>
    );
  }

  if (error || !article) {
    return (
      <MarketingLayout>
        <div className="relative">
          <div className="fixed inset-0 pointer-events-none z-0">
            <div className="absolute inset-0 bg-[linear-gradient(160deg,#f8fafc_0%,#eef2ff_45%,#f8fafc_100%)] dark:bg-[linear-gradient(160deg,#0D0828_0%,#0A0A1F_45%,#12082E_100%)]" />
          </div>
          <div className="relative z-10 flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <BookOpen size={48} className="mx-auto text-slate-300 mb-4 dark:text-white/20" />
              <h2 className="text-xl font-bold text-slate-900 mb-2 dark:text-white">
                {t('kb.article.notFound', 'Article not found')}
              </h2>
              <Link to="/knowledge-base" className="text-primary-400 hover:text-primary-300 font-semibold">
                {t('kb.article.backToKb', 'Back to Knowledge Base')}
              </Link>
            </div>
          </div>
        </div>
      </MarketingLayout>
    );
  }

  return (
    <MarketingLayout>
      {/* Reading progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-[3px]">
        <div
          className="h-full transition-[width] duration-100 ease-out"
          style={{ width: `${scrollProgress * 100}%`, background: 'linear-gradient(90deg, #7c3aed 0%, #a855f7 50%, #c026d3 100%)' }}
        />
      </div>

      <div className="relative">
        {/* Ambient background */}
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 bg-[linear-gradient(160deg,#f8fafc_0%,#eef2ff_45%,#f8fafc_100%)] dark:bg-[linear-gradient(160deg,#0D0828_0%,#0A0A1F_45%,#12082E_100%)]" />
          <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(109,40,217,0.10)_0%,transparent_65%)] blur-[80px] dark:bg-[radial-gradient(circle,rgba(109,40,217,0.12)_0%,transparent_65%)]" />
        </div>

        {/* Breadcrumb */}
        <div className="relative z-10 border-b border-slate-200/80 dark:border-white/[0.06]">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <nav className="flex items-center gap-2 text-sm text-slate-500 dark:text-white/40">
              <Link to="/knowledge-base" className="flex items-center gap-1 hover:text-primary-500 dark:hover:text-primary-400 transition-colors">
                <Home size={14} />
                <span className="hidden sm:inline">{t('kb.breadcrumb.home', 'Knowledge Base')}</span>
              </Link>
              <ChevronRight size={14} />
              <Link to={`/knowledge-base/${categorySlug}`} className="hover:text-primary-500 dark:hover:text-primary-400 transition-colors truncate max-w-[200px]">
                {article.category_name || categorySlug}
              </Link>
              <ChevronRight size={14} className="hidden sm:block" />
              <span className="text-slate-700 font-medium truncate max-w-xs hidden sm:block dark:text-white/70">
                {article.title}
              </span>
            </nav>
          </div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-12">
          {/* Mobile TOC */}
          {toc.length > 2 && (
            <div className="xl:hidden mb-8">
              <button
                onClick={() => setMobileTocOpen(!mobileTocOpen)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200/80 bg-white/80 text-sm text-slate-600 hover:border-slate-300 transition-colors dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-white/50 dark:hover:border-white/[0.15]"
              >
                <span className="font-semibold">{t('kb.article.toc', 'On this page')}</span>
                {mobileTocOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {mobileTocOpen && (
                <nav className="mt-2 px-4 py-3 rounded-xl border border-slate-200/80 bg-white/85 space-y-1 dark:border-white/[0.06] dark:bg-white/[0.02]">
                  {toc.map((item) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      onClick={() => setMobileTocOpen(false)}
                      className={cn(
                        'block text-[13px] py-1.5 transition-colors',
                        item.level === 2 ? 'pl-2' : 'pl-5',
                        activeHeading === item.id
                          ? 'text-primary-600 font-semibold dark:text-primary-400'
                          : 'text-slate-500 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/60'
                      )}
                    >
                      {item.text}
                    </a>
                  ))}
                </nav>
              )}
            </div>
          )}

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

                <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-[1.1] dark:text-white">
                  {article.title}
                </h1>

                {article.summary && (
                  <p className="mt-4 text-lg text-slate-600 leading-relaxed font-medium dark:text-white/45">
                    {article.summary}
                  </p>
                )}

                <div className="mt-6 flex flex-wrap items-center gap-4 sm:gap-5 text-sm text-slate-500 dark:text-white/30">
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

                  {/* Listen */}
                  {tts.supported && (
                    <button onClick={tts.toggle} className="flex items-center gap-1.5 hover:text-primary-500 dark:hover:text-primary-400 transition-colors">
                      {tts.isPlaying ? <Pause size={14} /> : <Headphones size={14} />}
                      {tts.isPlaying ? t('kb.article.stopListening', 'Stop') : t('kb.article.listen', 'Listen')}
                    </button>
                  )}

                  {/* Share */}
                  <div className="flex items-center gap-3">
                    <button onClick={handleShare} className="flex items-center gap-1.5 hover:text-primary-500 dark:hover:text-primary-400 transition-colors">
                      {copied ? <Copy size={14} /> : <Share2 size={14} />}
                      {copied ? t('kb.article.copied', 'Copied!') : t('kb.article.share', 'Share')}
                    </button>
                    <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" className="hover:text-[#0A66C2] transition-colors" title="LinkedIn">
                      <Linkedin size={14} />
                    </a>
                    <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(article.title || '')}`} target="_blank" rel="noopener noreferrer" className="hover:text-slate-900 dark:hover:text-white transition-colors" title="X">
                      <Twitter size={14} />
                    </a>
                  </div>
                </div>
              </motion.header>

              {/* Markdown Body — editorial standard */}
              <div
                ref={articleContentRef}
                className="
                  prose prose-slate dark:prose-invert prose-lg max-w-none

                  prose-headings:scroll-mt-20 prose-headings:font-black prose-headings:tracking-tight
                  prose-h2:text-2xl prose-h2:mt-16 prose-h2:mb-6 prose-h2:text-slate-900 prose-h2:border-b prose-h2:border-slate-200 prose-h2:pb-3 dark:prose-h2:text-white dark:prose-h2:border-white/[0.06]
                  prose-h3:text-xl prose-h3:mt-10 prose-h3:mb-4 prose-h3:text-slate-800 dark:prose-h3:text-white/90

                  prose-p:leading-[1.8] prose-p:text-slate-700 prose-p:mb-5 dark:prose-p:text-white/65
                  prose-li:text-slate-700 prose-li:leading-[1.7] dark:prose-li:text-white/65

                  prose-strong:text-slate-900 prose-strong:font-bold dark:prose-strong:text-white

                  prose-a:text-primary-400 prose-a:no-underline hover:prose-a:underline hover:prose-a:text-primary-300

                  prose-blockquote:border-l-4 prose-blockquote:border-primary-500 prose-blockquote:bg-primary-50 prose-blockquote:rounded-xl prose-blockquote:py-4 prose-blockquote:px-6 prose-blockquote:my-8 prose-blockquote:text-slate-700 prose-blockquote:not-italic prose-blockquote:text-[1.1rem] prose-blockquote:font-medium prose-blockquote:leading-relaxed prose-blockquote:shadow-[inset_0_1px_0_rgba(139,92,246,0.12)] dark:prose-blockquote:bg-primary-950/30 dark:prose-blockquote:text-white/70 dark:prose-blockquote:shadow-[inset_0_1px_0_rgba(139,92,246,0.15)]

                  prose-table:border-collapse
                  prose-th:bg-slate-100 prose-th:border-slate-200 prose-th:text-slate-700 prose-th:font-bold prose-th:text-sm dark:prose-th:bg-white/[0.04] dark:prose-th:border-white/[0.08] dark:prose-th:text-white/70
                  prose-td:border-slate-200 prose-td:text-slate-600 dark:prose-td:border-white/[0.06] dark:prose-td:text-white/55

                  prose-code:text-primary-700 prose-code:bg-primary-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm dark:prose-code:text-primary-300 dark:prose-code:bg-primary-900/20
                  prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-200 prose-pre:rounded-xl dark:prose-pre:bg-[#0D0828] dark:prose-pre:border-white/[0.06]

                  prose-hr:border-slate-200 prose-hr:my-12 dark:prose-hr:border-white/[0.08]
                "
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children, ...props }) => {
                      paragraphIndex++;
                      if (paragraphIndex <= 3) {
                        return <p className="!text-slate-800 dark:!text-white/75 !text-[1.15rem] !leading-[1.85]" {...props}>{children}</p>;
                      }
                      return <p {...props}>{children}</p>;
                    },
                    h2: ({ children, ...props }) => {
                      const text = String(children).replace(/\*\*/g, '');
                      const id = text.toLowerCase().replace(/[^a-z0-9\u0100-\u024f]+/g, '-').replace(/(^-|-$)/g, '');
                      return <h2 id={id} {...props}>{children}</h2>;
                    },
                    h3: ({ children, ...props }) => {
                      const text = String(children).replace(/\*\*/g, '');
                      const id = text.toLowerCase().replace(/[^a-z0-9\u0100-\u024f]+/g, '-').replace(/(^-|-$)/g, '');
                      return <h3 id={id} {...props}>{children}</h3>;
                    },
                    img: ({ src, alt, ...props }) => {
                      const caption = truncateAltText(alt);
                      return (
                        <figure className="my-10">
                          <img
                            src={src}
                            alt={alt || ''}
                            className="w-full rounded-xl border border-slate-200 dark:border-white/[0.06]"
                            loading="lazy"
                            {...props}
                          />
                          {caption && (
                            <figcaption className="mt-3 text-center text-sm text-slate-400 italic dark:text-white/25">
                              {caption}
                            </figcaption>
                          )}
                        </figure>
                      );
                    },
                  }}
                >
                  {cleanContent}
                </ReactMarkdown>
              </div>

              {/* "Discuss with Anna" CTA */}
              <div className="mt-12 p-6 rounded-2xl border border-primary-500/20 bg-gradient-to-r from-primary-50 to-white dark:from-primary-950/40 dark:to-primary-900/20">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary-500/15 flex items-center justify-center">
                    <MessageCircle size={20} className="text-primary-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-slate-900 font-bold text-base mb-1 dark:text-white">
                      {docsLanguage === 'pl' ? 'Masz pytania?' : docsLanguage === 'de' ? 'Fragen?' : 'Have questions?'}
                    </h4>
                    <p className="text-slate-600 text-sm leading-relaxed mb-3 dark:text-white/50">
                      {docsLanguage === 'pl'
                        ? 'Porozmawiaj z Anną o tym, jak to dotyczy Twojej firmy — głosowo lub tekstem.'
                        : docsLanguage === 'de'
                        ? 'Sprechen Sie mit Anna darüber, wie das für Ihr Unternehmen relevant ist — per Sprache oder Text.'
                        : 'Talk to Anna about how this applies to your company — voice or text.'}
                    </p>
                    <button
                      onClick={handleAskAnna}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600/20 border border-primary-500/30 text-primary-300 text-sm font-semibold hover:bg-primary-600/30 transition-colors"
                    >
                      <MessageCircle size={14} />
                      {docsLanguage === 'pl' ? 'Zapytaj Annę' : docsLanguage === 'de' ? 'Anna fragen' : 'Ask Anna'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Feedback */}
              <div className="mt-10 pt-8 border-t border-slate-200 dark:border-white/[0.06]">
                <p className="text-sm text-slate-500 mb-3 dark:text-white/40">
                  {t('kb.article.helpful', 'Was this article helpful?')}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleFeedback('up')}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all',
                      feedback === 'up'
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                        : 'border-slate-200 text-slate-500 hover:border-emerald-500/25 hover:text-emerald-500 dark:border-white/[0.08] dark:text-white/40 dark:hover:text-emerald-400'
                    )}
                  >
                    <ThumbsUp size={14} />
                    {t('kb.article.yes', 'Yes')}
                  </button>
                  <button
                    onClick={() => handleFeedback('down')}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all',
                      feedback === 'down'
                        ? 'bg-red-500/15 border-red-500/30 text-red-400'
                        : 'border-slate-200 text-slate-500 hover:border-red-500/25 hover:text-red-500 dark:border-white/[0.08] dark:text-white/40 dark:hover:text-red-400'
                    )}
                  >
                    <ThumbsDown size={14} />
                    {t('kb.article.no', 'No')}
                  </button>
                  {feedback && (
                    <span className="text-xs text-slate-400 ml-2 dark:text-white/25">{t('kb.article.thanksFeedback', 'Thank you')}</span>
                  )}
                </div>
              </div>

              {/* Previous / Next Navigation */}
              {(prevArticle || nextArticle) && (
                <div className="mt-12 grid grid-cols-2 gap-4">
                  {prevArticle ? (
                    <Link
                      to={`/knowledge-base/${categorySlug}/${prevArticle.slug}`}
                      className="group p-5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:bg-white/[0.04] dark:hover:border-white/[0.12]"
                    >
                      <div className="flex items-center gap-1 text-xs text-slate-500 mb-2 dark:text-white/30">
                        <ChevronLeft size={12} />
                        {t('kb.article.prev', 'Previous article')}
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 group-hover:text-primary-500 dark:text-white dark:group-hover:text-primary-300 transition-colors line-clamp-2 leading-snug">
                        {prevArticle.title}
                      </h4>
                    </Link>
                  ) : <div />}
                  {nextArticle ? (
                    <Link
                      to={`/knowledge-base/${categorySlug}/${nextArticle.slug}`}
                      className="group p-5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 text-right dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:bg-white/[0.04] dark:hover:border-white/[0.12]"
                    >
                      <div className="flex items-center justify-end gap-1 text-xs text-slate-500 mb-2 dark:text-white/30">
                        {t('kb.article.next', 'Next article')}
                        <ChevronRight size={12} />
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 group-hover:text-primary-500 dark:text-white dark:group-hover:text-primary-300 transition-colors line-clamp-2 leading-snug">
                        {nextArticle.title}
                      </h4>
                    </Link>
                  ) : <div />}
                </div>
              )}

              {/* Related Articles */}
              {relatedArticles && relatedArticles.length > 0 && (
                <div className="mt-14">
                  <h3 className="text-lg font-black text-slate-900 mb-5 tracking-tight dark:text-white">
                    {t('kb.article.related', 'Related Articles')}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {relatedArticles.map((related: any) => (
                      <Link
                        key={related.id}
                        to={`/knowledge-base/${related.category_slug || categorySlug}/${related.slug}`}
                        className="group p-5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:bg-white/[0.04] dark:hover:border-white/[0.12]"
                      >
                        <h4 className="font-bold text-sm text-slate-900 group-hover:text-primary-500 dark:text-white dark:group-hover:text-primary-300 transition-colors line-clamp-2 leading-snug">
                          {related.title}
                        </h4>
                        {related.summary && (
                          <p className="mt-2 text-xs text-slate-500 line-clamp-2 leading-relaxed dark:text-white/35">{related.summary}</p>
                        )}
                        <div className="mt-3 flex items-center gap-1 text-xs text-primary-500 dark:text-primary-400 font-bold">
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
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-5 dark:text-white/30">
                    {t('kb.article.toc', 'On this page')}
                  </h4>
                  <nav className="space-y-0.5 max-h-[60vh] overflow-y-auto scrollbar-none">
                    {toc.map((item) => (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        className={cn(
                          'block text-[13px] py-1.5 transition-all duration-200 border-l-2',
                          item.level === 2 ? 'pl-3' : 'pl-6',
                          activeHeading === item.id
                            ? 'border-primary-500 text-primary-600 font-semibold dark:text-primary-400'
                            : 'border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:border-white/[0.06] dark:text-white/35 dark:hover:text-white/60 dark:hover:border-white/[0.15]'
                        )}
                      >
                        {item.text}
                      </a>
                    ))}
                  </nav>

                  {/* Category quick links */}
                  <div className="mt-8 pt-6 border-t border-slate-200 dark:border-white/[0.06] space-y-3">
                    <Link
                      to={`/knowledge-base/${categorySlug}`}
                      className="flex items-center gap-2 text-sm text-slate-600 hover:text-primary-500 dark:text-white/35 dark:hover:text-primary-400 transition-colors font-medium"
                    >
                      <ArrowLeft size={14} />
                      {article.category_name || t('kb.article.backToCategory', 'Back to category')}
                    </Link>
                    <Link
                      to="/knowledge-base"
                      className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary-500 dark:text-white/25 dark:hover:text-primary-400 transition-colors font-medium"
                    >
                      <Home size={14} />
                      {t('kb.article.backToKb', 'All articles')}
                    </Link>
                  </div>
                </div>
              </aside>
            )}
          </div>
        </div>
      </div>

      {/* Back to top */}
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-40 p-3 rounded-full bg-white/90 border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-white transition-all shadow-lg backdrop-blur-sm dark:bg-white/[0.06] dark:border-white/[0.1] dark:text-white/40 dark:hover:text-white dark:hover:bg-white/[0.1]"
          aria-label="Back to top"
        >
          <ChevronUp size={18} />
        </button>
      )}
    </MarketingLayout>
  );
};

export default KnowledgeBaseArticlePage;
