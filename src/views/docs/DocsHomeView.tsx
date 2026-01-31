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
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { KbArticleListItem, KbCategory, useDocsCategories, useDocsFeatured } from '@/hooks/useDocs';
import { cn } from '@/lib/utils';

// Icon mapping for categories
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'getting-started': <PlayCircle size={24} className="text-green-500" />,
  'quick-guides': <Rocket size={24} className="text-purple-500" />,
  methodologies: <BookOpen size={24} className="text-blue-500" />,
  'best-practices': <Sparkles size={24} className="text-amber-500" />,
  'case-studies': <FolderOpen size={24} className="text-green-500" />,
  'tools-features': <Wrench size={24} className="text-slate-500" />,
  'assessment-frameworks': <ClipboardCheck size={24} className="text-indigo-500" />,
  'industrial-modules': <Factory size={24} className="text-cyan-500" />,
  'ai-platform': <Brain size={24} className="text-pink-500" />,
  'analytics-reporting': <BarChart3 size={24} className="text-emerald-500" />,
  transformation: <TrendingUp size={24} className="text-orange-500" />,
  administration: <Settings size={24} className="text-gray-500" />,
  'api-reference': <Code size={24} className="text-violet-500" />,
  integrations: <Link2 size={24} className="text-blue-400" />,
  troubleshooting: <LifeBuoy size={24} className="text-red-500" />,
  default: <Book size={24} className="text-purple-500" />,
};

export const DocsHomeView: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: categories, isLoading: categoriesLoading } = useDocsCategories();
  const { data: featuredArticles, isLoading: featuredLoading } = useDocsFeatured('en', 6);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/docs/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="min-h-full">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-white dark:from-navy-900 dark:to-navy-950 border-b border-slate-200 dark:border-navy-800">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 py-16 lg:py-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-4">
              IRIS Documentation
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-8">
              Comprehensive guides, tutorials, and best practices for the IRIS Industrial Excellence
              Platform. Learn how to accelerate your digital transformation journey.
            </p>

            {/* Search Box */}
            <form onSubmit={handleSearch} className="max-w-xl mx-auto">
              <div className="relative">
                <Search
                  size={20}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search documentation..."
                  className="w-full pl-12 pr-4 py-4 rounded-xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                >
                  Search
                </button>
              </div>
            </form>

            {/* Quick Links */}
            <div className="flex flex-wrap justify-center gap-4 mt-8">
              <Link
                to="/docs/quick-guides/getting-started-consultinity"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium text-sm hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
              >
                <Rocket size={16} />
                Getting Started
              </Link>
              <Link
                to="/docs/api"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 font-medium text-sm hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors"
              >
                <Code size={16} />
                API Reference
              </Link>
              <Link
                to="/docs/security"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 font-medium text-sm hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors"
              >
                <Shield size={16} />
                Security
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Categories Grid */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold mb-6">Browse by Category</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categoriesLoading
            ? // Loading skeleton
              Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="p-6 rounded-xl border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-900/50 animate-pulse"
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
                    className="block p-6 rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900/50 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-lg transition-all"
                  >
                    <div className="h-12 w-12 rounded-lg bg-slate-100 dark:bg-navy-800 flex items-center justify-center mb-4 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/30 transition-colors">
                      {CATEGORY_ICONS[category.slug] || CATEGORY_ICONS['default']}
                    </div>
                    <h3 className="text-lg font-semibold mb-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                      {category.name}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                      {category.description || 'Explore articles in this category'}
                    </p>
                    <div className="flex items-center text-sm text-purple-600 dark:text-purple-400 font-medium">
                      Browse articles
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
      <section className="max-w-6xl mx-auto px-4 py-12 border-t border-slate-200 dark:border-navy-800">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Star size={24} className="text-amber-500" />
            Featured Articles
          </h2>
          <Link
            to="/docs/featured"
            className="text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center gap-1"
          >
            View all
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredLoading
            ? // Loading skeleton
              Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="p-6 rounded-xl border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-900/50 animate-pulse"
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
                    className="block p-6 rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900/50 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-lg transition-all h-full"
                  >
                    {/* Category Badge */}
                    <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium mb-3">
                      <Book size={12} />
                      {article.category_name}
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-semibold mb-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors line-clamp-2">
                      {article.title}
                    </h3>

                    {/* Summary */}
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">
                      {article.summary}
                    </p>

                    {/* Meta */}
                    <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-500">
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
      <section className="max-w-6xl mx-auto px-4 py-12 border-t border-slate-200 dark:border-navy-800">
        <h2 className="text-2xl font-bold mb-6">Developer Resources</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* API Reference */}
          <Link
            to="/docs/api"
            className="group relative overflow-hidden rounded-xl border border-slate-200 dark:border-navy-800 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 p-6 hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-lg transition-all"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative">
              <div className="h-12 w-12 rounded-lg bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center mb-4 group-hover:bg-violet-200 dark:group-hover:bg-violet-900 transition-colors">
                <Code size={24} className="text-violet-600 dark:text-violet-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                API Reference
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Complete REST API documentation with interactive examples, code samples, and
                authentication guides.
              </p>
              <div className="flex items-center text-sm text-violet-600 dark:text-violet-400 font-medium">
                Explore API
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
            className="group relative overflow-hidden rounded-xl border border-slate-200 dark:border-navy-800 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 p-6 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-lg transition-all"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative">
              <div className="h-12 w-12 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center mb-4 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-900 transition-colors">
                <History size={24} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                Changelog
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
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
            className="group relative overflow-hidden rounded-xl border border-slate-200 dark:border-navy-800 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 p-6 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg transition-all"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative">
              <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center mb-4 group-hover:bg-blue-200 dark:group-hover:bg-blue-900 transition-colors">
                <Shield size={24} className="text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                Security & Trust
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
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
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 p-8 lg:p-12 text-center text-white">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImEiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgcGF0dGVyblRyYW5zZm9ybT0icm90YXRlKDQ1KSI+PHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9IjEiIGhlaWdodD0iMjAiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3QgZmlsbD0idXJsKCNhKSIgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIvPjwvc3ZnPg==')] opacity-50" />
          <div className="relative">
            <GraduationCap size={48} className="mx-auto mb-4 opacity-90" />
            <h2 className="text-2xl lg:text-3xl font-bold mb-3">
              Ready to Transform Your Organization?
            </h2>
            <p className="text-lg opacity-90 max-w-xl mx-auto mb-6">
              Start your free trial today and access the complete IRIS Industrial Excellence
              Platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/trial/start"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white text-purple-700 font-semibold hover:bg-slate-100 transition-colors"
              >
                Start Free Trial
                <ArrowRight size={18} />
              </Link>
              <Link
                to="/demo"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white/20 text-white font-semibold hover:bg-white/30 transition-colors border border-white/30"
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
