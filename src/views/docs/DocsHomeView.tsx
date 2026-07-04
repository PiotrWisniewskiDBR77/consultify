/**
 * Documentation Home View
 *
 * Landing page for the public documentation portal.
 * Features: Hero with search, category grid, featured articles.
 *
 * Route: /docs
 */

import { motion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  Book,
  BookOpen,
  Brain,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Code,
  Eye,
  Factory,
  FileText,
  FolderOpen,
  GraduationCap,
  History,
  LifeBuoy,
  Link2,
  PlayCircle,
  Rocket,
  Search,
  Settings,
  Shield,
  Sparkles,
  Star,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import {
  getLocalizedText,
  getOverviewCards,
  getOverviewGuides,
  HELP_SYSTEM_OVERVIEW,
} from '@/config/helpExperience';
import { KbArticleListItem, KbCategory, useDocsCategories, useDocsFeatured } from '@/hooks/useDocs';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/routes/routeConfig';

// Icon mapping for categories
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'getting-started': <PlayCircle size={24} className="text-green-500" />,
  'quick-guides': <Rocket size={24} className="text-primary-500" />,
  methodologies: <BookOpen size={24} className="text-blue-500" />,
  'best-practices': <Sparkles size={24} className="text-amber-500" />,
  'case-studies': <FolderOpen size={24} className="text-green-500" />,
  'tools-features': <Wrench size={24} className="text-c-text-muted" />,
  'assessment-frameworks': <ClipboardCheck size={24} className="text-indigo-500" />,
  'industrial-modules': <Factory size={24} className="text-blue-500" />,
  'ai-platform': <Brain size={24} className="text-pink-500" />,
  'analytics-reporting': <BarChart3 size={24} className="text-emerald-500" />,
  transformation: <TrendingUp size={24} className="text-amber-500" />,
  administration: <Settings size={24} className="text-c-text-muted" />,
  'api-reference': <Code size={24} className="text-primary-500" />,
  integrations: <Link2 size={24} className="text-blue-400" />,
  troubleshooting: <LifeBuoy size={24} className="text-danger-500" />,
  default: <Book size={24} className="text-primary-500" />,
};

const DynamicIcon: React.FC<{ name: string; className?: string }> = ({ name, className }) => {
  const IconComponent = (LucideIcons as unknown as Record<string, React.ComponentType<any>>)[name];
  if (!IconComponent) return <BookOpen size={20} className={className} />;
  return <IconComponent size={20} className={className} />;
};

export const DocsHomeView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const docsLanguage = i18n.language?.startsWith('pl') ? 'pl' : 'en';
  const overviewCards = getOverviewCards(docsLanguage);
  const overviewGuides = getOverviewGuides(docsLanguage);

  const { data: categories, isLoading: categoriesLoading } = useDocsCategories(docsLanguage);
  const { data: featuredArticles, isLoading: featuredLoading } = useDocsFeatured(docsLanguage, 6);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/docs/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="min-h-full">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-white dark:from-navy-900 dark:to-navy-950 border-b border-c-border-subtle">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 py-16 lg:py-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-4">
              {t('docs.home.title', 'Consultify Documentation')}
            </h1>
            <p className="text-lg text-c-text-secondary max-w-2xl mx-auto mb-8">
              {t(
                'docs.home.subtitle',
                'Comprehensive guides, tutorials, and best practices for the Consultify Transformation AI Platform. Learn how to accelerate your digital transformation journey.'
              )}
            </p>
            <p className="text-sm text-c-text-muted max-w-3xl mx-auto mb-6">
              {getLocalizedText(HELP_SYSTEM_OVERVIEW.summary, docsLanguage)}
            </p>

            {/* Search Box */}
            <form onSubmit={handleSearch} className="max-w-xl mx-auto">
              <div className="relative">
                <Search
                  size={20}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-c-text-secondary"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('docs.home.searchPlaceholder', 'Search documentation...')}
                  className="w-full pl-12 pr-4 py-4 rounded-xl bg-c-surface border border-c-border-subtle text-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-transparent transition-all"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium transition-colors"
                >
                  {t('docs.home.search', 'Search')}
                </button>
              </div>
            </form>

            {/* Quick Links */}
            <div className="flex flex-wrap justify-center gap-4 mt-8">
              <Link
                to="/docs/quick-guides/getting-started-consultify"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium text-sm hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors"
              >
                <Rocket size={16} />
                {t('docs.home.gettingStarted', 'Getting Started')}
              </Link>
              <Link
                to="/docs/api"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-c-surface border border-c-border-subtle text-c-text-secondary font-medium text-sm hover:bg-c-surface-raised transition-colors"
              >
                <Code size={16} />
                {t('docs.home.apiReference', 'API Reference')}
              </Link>
              <Link
                to="/docs/security"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-c-surface border border-c-border-subtle text-c-text-secondary font-medium text-sm hover:bg-c-surface-raised transition-colors"
              >
                <Shield size={16} />
                {t('docs.home.security', 'Security')}
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="rounded-2xl border border-c-border-subtle bg-c-surface/50 p-6 lg:p-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary-100 dark:bg-primary-900/30 px-3 py-1 text-xs font-semibold text-primary-700 dark:text-primary-300">
                <Sparkles size={14} />
                {t('docs.home.helpRuntime.badge', 'Help runtime')}
              </div>
              <h2 className="mt-4 text-2xl font-bold">
                {t('docs.home.helpRuntime.title', 'Get help your way')}
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-c-text-secondary">
                {t(
                  'docs.home.helpRuntime.subtitle',
                  'Use one support system across documentation, guided Teresa help, in-product contextual support, and product updates.'
                )}
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              {
                title: t('docs.home.helpRuntime.cards.docs.title', 'Browse the knowledge base'),
                description: t(
                  'docs.home.helpRuntime.cards.docs.description',
                  'Use long-form articles, category pages, and featured guidance when you need structured answers.'
                ),
                to: ROUTES.DOCS,
                icon: BookOpen,
              },
              {
                title: t('docs.home.helpRuntime.cards.teresa.title', 'Ask Teresa for guided help'),
                description: t(
                  'docs.home.helpRuntime.cards.teresa.description',
                  'Teresa can explain a workflow, recommend the next step, and help you continue the work from guidance into action.'
                ),
                to: ROUTES.AI_CHAT,
                icon: Brain,
              },
              {
                title: t(
                  'docs.home.helpRuntime.cards.contextual.title',
                  'Use contextual in-app support'
                ),
                description: t(
                  'docs.home.helpRuntime.cards.contextual.description',
                  'Inside the product you get screen-specific help, quick guides, FAQs, and handoff into AI with the right context.'
                ),
                to: ROUTES.APP_INTRO,
                icon: LifeBuoy,
              },
              {
                title: t('docs.home.helpRuntime.cards.updates.title', 'Track updates and releases'),
                description: t(
                  'docs.home.helpRuntime.cards.updates.description',
                  'Stay aligned with product changes, new capabilities, and guided follow-up paths after each release.'
                ),
                to: ROUTES.CHANGELOG,
                icon: History,
              },
            ].map((item) => (
              <Link
                key={item.title}
                to={item.to}
                className="group rounded-xl border border-c-border-subtle bg-c-bg/80 dark:bg-navy-950/40 p-4 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md transition-all"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-c-surface border border-c-border-subtle">
                  <item.icon size={18} className="text-primary-600 dark:text-primary-400" />
                </div>
                <h3 className="mt-4 font-semibold group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-c-text-secondary">
                  {item.description}
                </p>
                <div className="mt-4 flex items-center text-sm font-medium text-primary-600 dark:text-primary-400">
                  {t('docs.home.helpRuntime.cards.cta', 'Open')}
                  <ArrowRight
                    size={14}
                    className="ml-1 group-hover:translate-x-1 transition-transform"
                  />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h2 className="text-2xl font-bold mb-2">
              {t('docs.home.journey.title', 'Consulting journey')}
            </h2>
            <p className="text-sm text-c-text-secondary mb-5">
              {getLocalizedText(HELP_SYSTEM_OVERVIEW.intro, docsLanguage)}
            </p>
            <div className="space-y-3">
              {overviewCards.journey.map((card) => (
                <div
                  key={card.id}
                  className="flex items-start gap-3 rounded-xl border border-c-border-subtle bg-c-surface/40 p-4"
                >
                  <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg bg-c-surface-raised">
                    <DynamicIcon name={card.icon} className="text-primary-500" />
                  </div>
                  <div>
                    <div className="font-semibold">{card.title}</div>
                    <div className="mt-1 text-sm text-c-text-secondary">
                      {card.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-2">
                {t('docs.home.support.title', 'Support surfaces')}
              </h2>
              <p className="text-sm text-c-text-secondary mb-5">
                {t(
                  'docs.home.support.subtitle',
                  'The help system connects the core transformation journey with the work surfaces where teams actually execute.'
                )}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {overviewCards.support.map((card) => (
                  <div
                    key={card.id}
                    className="rounded-xl border border-c-border-subtle bg-c-surface/40 p-4"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-c-surface-raised">
                      <DynamicIcon name={card.icon} className="text-blue-500" />
                    </div>
                    <div className="mt-3 font-semibold">{card.title}</div>
                    <div className="mt-1 text-sm text-c-text-secondary">
                      {card.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-2">
                {t('docs.home.guidedJourneys.title', 'Guided journeys')}
              </h2>
              <p className="text-sm text-c-text-secondary mb-5">
                {t(
                  'docs.home.guidedJourneys.subtitle',
                  'Start with a guide when you need a recommended path instead of searching the whole library.'
                )}
              </p>
              <div className="space-y-3">
                {overviewGuides.map((guide) => (
                  <div
                    key={guide.id}
                    className={cn(
                      'rounded-xl border border-c-border-subtle bg-c-surface/40 p-4',
                      'hover:border-primary-300 dark:hover:border-primary-700 transition-colors'
                    )}
                  >
                    <div className="font-semibold">{guide.title}</div>
                    <div className="mt-1 text-sm text-c-text-secondary">
                      {guide.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-6">
        <div className="rounded-2xl border border-c-border-subtle bg-c-surface/50 p-6 lg:p-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 dark:bg-blue-900/30 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
              <GraduationCap size={14} />
              {t('docs.home.educationScope.badge', 'Education scope')}
            </div>
            <h2 className="mt-4 text-2xl font-bold">
              {t('docs.home.educationScope.title', 'Where Help ends and Education begins')}
            </h2>
            <p className="mt-2 text-sm text-c-text-secondary">
              {t(
                'docs.home.educationScope.subtitle',
                'Help and Knowledge Base stay focused on just-in-time guidance, reference articles, and contextual support. Education is the separate enablement layer for structured learning paths, role-based progress, and certification-style readiness.'
              )}
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-c-border-subtle bg-c-bg/80 dark:bg-navy-950/40 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-c-text">
                <LifeBuoy size={16} className="text-primary-500" />
                {t('docs.home.educationScope.helpTitle', 'Inside Help / Knowledge Base')}
              </div>
              <ul className="mt-3 space-y-2 text-sm text-c-text-secondary">
                <li>
                  {t(
                    'docs.home.educationScope.helpPoint1',
                    'Contextual help, FAQs, quick guides, product walkthroughs, and long-form reference articles.'
                  )}
                </li>
                <li>
                  {t(
                    'docs.home.educationScope.helpPoint2',
                    'Teresa-led discovery when the user needs help to continue real work in the current module.'
                  )}
                </li>
                <li>
                  {t(
                    'docs.home.educationScope.helpPoint3',
                    'Updates, release notes, and knowledge surfacing that reduce friction in day-to-day product usage.'
                  )}
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-c-border-subtle bg-c-bg/80 dark:bg-navy-950/40 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-c-text">
                <GraduationCap size={16} className="text-blue-500" />
                {t(
                  'docs.home.educationScope.educationTitle',
                  'Inside standalone Education / Academy'
                )}
              </div>
              <ul className="mt-3 space-y-2 text-sm text-c-text-secondary">
                <li>
                  {t(
                    'docs.home.educationScope.educationPoint1',
                    'Structured learning paths with foundations, role tracks, and deeper methodology enablement.'
                  )}
                </li>
                <li>
                  {t(
                    'docs.home.educationScope.educationPoint2',
                    'Progress visibility, completion semantics, and certification or readiness checkpoints.'
                  )}
                </li>
                <li>
                  {t(
                    'docs.home.educationScope.educationPoint3',
                    'Role-aware enablement tied to onboarding, partner growth, and skill development over time.'
                  )}
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold">
              {t('docs.home.educationScope.pathTitle', 'Canonical learning-path model')}
            </h3>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  title: t('docs.home.educationScope.path1.title', '1. Foundations'),
                  description: t(
                    'docs.home.educationScope.path1.description',
                    'Learn the platform, core consulting journey, and essential operating concepts.'
                  ),
                },
                {
                  title: t('docs.home.educationScope.path2.title', '2. Role path'),
                  description: t(
                    'docs.home.educationScope.path2.description',
                    'Go deeper by role or motion: operator, consultant, partner, or specialized methodology track.'
                  ),
                },
                {
                  title: t('docs.home.educationScope.path3.title', '3. Proof of readiness'),
                  description: t(
                    'docs.home.educationScope.path3.description',
                    'Close the path with progress evidence, completion state, and certification-style trust signals where needed.'
                  ),
                },
              ].map((step) => (
                <div
                  key={step.title}
                  className="rounded-xl border border-c-border-subtle bg-c-surface/40 p-4"
                >
                  <div className="font-semibold text-c-text">{step.title}</div>
                  <div className="mt-2 text-sm text-c-text-secondary">
                    {step.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Categories Grid */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold mb-6">
          {t('docs.home.browseByCategory', 'Browse by Category')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categoriesLoading
            ? // Loading skeleton
              Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="p-6 rounded-xl border border-c-border-subtle bg-c-surface-raised/50 animate-pulse"
                >
                  <div className="h-12 w-12 rounded-lg bg-slate-200 dark:bg-navy-800 mb-4" />
                  <div className="h-5 w-32 rounded bg-slate-200 dark:bg-navy-800 mb-2" />
                  <div className="h-4 w-full rounded bg-slate-200 dark:bg-navy-800" />
                </div>
              ))
            : categories?.map((category: KbCategory) => (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.02 }}
                  className="group"
                >
                  <Link
                    to={`/docs/${category.slug}`}
                    className="block p-6 rounded-xl border border-c-border-subtle bg-c-surface/50 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-lg transition-all"
                  >
                    <div className="h-12 w-12 rounded-lg bg-c-surface-raised flex items-center justify-center mb-4 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30 transition-colors">
                      {CATEGORY_ICONS[category.slug] || CATEGORY_ICONS['default']}
                    </div>
                    <h3 className="text-lg font-semibold mb-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                      {category.name}
                    </h3>
                    <p className="text-sm text-c-text-secondary mb-3">
                      {category.description ||
                        t('docs.home.categoryFallback', 'Explore articles in this category')}
                    </p>
                    <div className="flex items-center text-sm text-primary-600 dark:text-primary-400 font-medium">
                      {t('docs.home.browseArticles', 'Browse articles')}
                      <ChevronRight
                        size={16}
                        className="ml-1 group-hover:translate-x-1 transition-transform"
                      />
                    </div>
                  </Link>
                </motion.div>
              ))}
        </div>
      </section>

      {/* Featured Articles */}
      <section className="max-w-6xl mx-auto px-4 py-12 border-t border-c-border-subtle">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Star size={24} className="text-amber-500" />
            {t('docs.home.featuredArticles', 'Featured Articles')}
          </h2>
          <Link
            to="/docs/featured"
            className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center gap-1"
          >
            {t('docs.home.viewAll', 'View all')}
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredLoading
            ? // Loading skeleton
              Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="p-6 rounded-xl border border-c-border-subtle bg-c-surface-raised/50 animate-pulse"
                >
                  <div className="h-4 w-20 rounded bg-slate-200 dark:bg-navy-800 mb-3" />
                  <div className="h-6 w-full rounded bg-slate-200 dark:bg-navy-800 mb-2" />
                  <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-navy-800 mb-4" />
                  <div className="h-4 w-24 rounded bg-slate-200 dark:bg-navy-800" />
                </div>
              ))
            : featuredArticles?.map((article: KbArticleListItem) => (
                <motion.div
                  key={article.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -4 }}
                  className="group"
                >
                  <Link
                    to={`/docs/${article.category_slug}/${article.slug}`}
                    className="block p-6 rounded-xl border border-c-border-subtle bg-c-surface/50 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-lg transition-all h-full"
                  >
                    {/* Category Badge */}
                    <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-medium mb-3">
                      <Book size={12} />
                      {article.category_name}
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-semibold mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-2">
                      {article.title}
                    </h3>

                    {/* Summary */}
                    <p className="text-sm text-c-text-secondary mb-4 line-clamp-2">
                      {article.summary}
                    </p>

                    {/* Meta */}
                    <div className="flex items-center gap-4 text-xs text-c-text-muted">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {article.reading_time_minutes} min read
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye size={12} />
                        {article.view_count} views
                      </span>
                    </div>
                  </Link>
                </motion.div>
              ))}
        </div>
      </section>

      {/* Developer Resources - OpenAI Style */}
      <section className="max-w-6xl mx-auto px-4 py-12 border-t border-c-border-subtle">
        <h2 className="text-2xl font-bold mb-6">Developer Resources</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* API Reference */}
          <Link
            to="/docs/api"
            className="group relative overflow-hidden rounded-xl border border-c-border-subtle bg-gradient-to-br from-primary-50 to-primary-50 dark:from-primary-950/30 dark:to-primary-950/30 p-6 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-lg transition-all"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative">
              <div className="h-12 w-12 rounded-lg bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center mb-4 group-hover:bg-primary-200 dark:group-hover:bg-primary-900 transition-colors">
                <Code size={24} className="text-primary-600 dark:text-primary-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                {t('docs.home.apiReference', 'API Reference')}
              </h3>
              <p className="text-sm text-c-text-secondary mb-4">
                {t(
                  'docs.home.apiCardDescription',
                  'Check the current API documentation status and request access to integration guidance until the live reference is published.'
                )}
              </p>
              <div className="flex items-center text-sm text-primary-600 dark:text-primary-400 font-medium">
                {t('docs.home.apiCardCta', 'View API status')}
                <ArrowRight
                  size={16}
                  className="ml-1 group-hover:translate-x-1 transition-transform"
                />
              </div>
            </div>
          </Link>

          {/* Changelog */}
          <Link
            to="/docs/changelog"
            className="group relative overflow-hidden rounded-xl border border-c-border-subtle bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 p-6 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-lg transition-all"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative">
              <div className="h-12 w-12 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center mb-4 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-900 transition-colors">
                <History size={24} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                Changelog
              </h3>
              <p className="text-sm text-c-text-secondary mb-4">
                Stay up to date with new features, improvements, bug fixes, and breaking changes.
              </p>
              <div className="flex items-center text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                View releases
                <ArrowRight
                  size={16}
                  className="ml-1 group-hover:translate-x-1 transition-transform"
                />
              </div>
            </div>
          </Link>

          {/* Security & Compliance */}
          <Link
            to="/docs/security"
            className="group relative overflow-hidden rounded-xl border border-c-border-subtle bg-gradient-to-br from-blue-50 to-blue-50 dark:from-blue-950/30 dark:to-blue-950/30 p-6 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg transition-all"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative">
              <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center mb-4 group-hover:bg-blue-200 dark:group-hover:bg-blue-900 transition-colors">
                <Shield size={24} className="text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                Security & Trust
              </h3>
              <p className="text-sm text-c-text-secondary mb-4">
                Enterprise security certifications, compliance standards, and data protection
                policies.
              </p>
              <div className="flex items-center text-sm text-blue-600 dark:text-blue-400 font-medium">
                Trust Center
                <ArrowRight
                  size={16}
                  className="ml-1 group-hover:translate-x-1 transition-transform"
                />
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary-600 to-crimson-600 p-8 lg:p-12 text-center text-white">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImEiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgcGF0dGVyblRyYW5zZm9ybT0icm90YXRlKDQ1KSI+PHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9IjEiIGhlaWdodD0iMjAiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3QgZmlsbD0idXJsKCNhKSIgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIvPjwvc3ZnPg==')] opacity-50" />
          <div className="relative">
            <GraduationCap size={48} className="mx-auto mb-4 opacity-90" />
            <h2 className="text-2xl lg:text-3xl font-bold mb-3">
              Ready to Transform Your Organization?
            </h2>
            <p className="text-lg opacity-90 max-w-xl mx-auto mb-6">
              Start your free trial today and access the complete Consultify Transformation AI
              Platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/trial/start"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-c-surface text-primary-700 font-semibold hover:bg-c-surface-raised transition-colors"
              >
                Start Free Trial
                <ArrowRight size={18} />
              </Link>
              <Link
                to="/demo"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-c-surface/20 text-white font-semibold hover:bg-c-surface/30 transition-colors border border-c-border"
              >
                Explore Demo
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DocsHomeView;
