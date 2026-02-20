/**
 * Documentation Layout
 *
 * Main layout wrapper for the public documentation portal.
 * Features: Sidebar navigation, search, responsive design.
 *
 * Route: /docs/*
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Book,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Home,
  Menu,
  Search,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { KbCategory, useDocsCategories } from '@/hooks/useDocs';
import { cn } from '@/lib/utils';

interface DocsLayoutProps {
  children?: React.ReactNode;
}

export const DocsLayout: React.FC<DocsLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const { data: categories, isLoading: categoriesLoading } = useDocsCategories();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Keyboard shortcut for search (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/docs/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-navy-950 text-slate-900 dark:text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-slate-200 dark:border-navy-800 bg-white/80 dark:bg-navy-950/80 backdrop-blur-lg">
        <div className="h-full flex items-center justify-between px-4 lg:px-6">
          {/* Left: Logo + Mobile Menu Toggle */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <Link to="/docs" className="flex items-center gap-2 text-lg font-bold tracking-tight">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <Book size={16} className="text-white" />
              </div>
              <span className="hidden sm:inline">Consultinity Docs</span>
            </Link>
          </div>

          {/* Center: Search */}
          <div className="flex-1 max-w-xl mx-4">
            <button
              onClick={() => setSearchOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-2 rounded-lg bg-slate-100 dark:bg-navy-900 border border-transparent hover:border-slate-300 dark:hover:border-navy-700 text-slate-500 dark:text-slate-400 text-sm transition-colors"
            >
              <Search size={16} />
              <span className="flex-1 text-left">Search documentation...</span>
              <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-xs font-medium">
                <span>⌘</span>K
              </kbd>
            </button>
          </div>

          {/* Right: Navigation Links */}
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
            >
              <Home size={16} />
              <span>Home</span>
            </Link>
            <Link
              to="/login"
              className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Search Modal */}
      <AnimatePresence>
        {searchOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
              onClick={() => setSearchOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-[20%] left-1/2 -translate-x-1/2 z-[70] w-full max-w-2xl mx-4"
            >
              <div className="bg-white dark:bg-navy-900 rounded-xl shadow-2xl border border-slate-200 dark:border-navy-700 overflow-hidden">
                <form onSubmit={handleSearch}>
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-navy-700">
                    <Search size={20} className="text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search documentation..."
                      className="flex-1 bg-transparent outline-none text-lg placeholder-slate-400"
                      autoFocus
                    />
                    <kbd className="px-2 py-1 rounded bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-xs font-medium text-slate-500">
                      ESC
                    </kbd>
                  </div>
                </form>
                <div className="p-4">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Press{' '}
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-navy-800 text-xs">
                      Enter
                    </kbd>{' '}
                    to search
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="pt-14 flex">
        {/* Sidebar - Desktop */}
        <aside
          className={cn(
            'hidden lg:block fixed left-0 top-14 bottom-0 w-64 border-r border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-900/50 overflow-y-auto transition-all duration-300',
            !sidebarOpen && '-translate-x-full'
          )}
        >
          <div className="p-4 space-y-6">
            {/* Toggle Sidebar */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-full flex items-center justify-center py-2 rounded-lg border border-slate-200 dark:border-navy-700 text-slate-500 hover:bg-white dark:hover:bg-navy-800 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>

            {/* Categories */}
            <nav className="space-y-1">
              <Link
                to="/docs"
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  location.pathname === '/docs'
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-white/5'
                )}
              >
                <Home size={16} />
                Overview
              </Link>

              {categories?.map((category: KbCategory) => (
                <Link
                  key={category.id}
                  to={`/docs/${category.slug}`}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    location.pathname.startsWith(`/docs/${category.slug}`)
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-white/5'
                  )}
                >
                  <Book size={16} />
                  {category.name}
                </Link>
              ))}
            </nav>
          </div>
        </aside>

        {/* Mobile Sidebar */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="lg:hidden fixed inset-0 z-40 bg-black/50"
                onClick={() => setMobileMenuOpen(false)}
              />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                className="lg:hidden fixed left-0 top-14 bottom-0 z-50 w-72 bg-white dark:bg-navy-900 border-r border-slate-200 dark:border-navy-800 overflow-y-auto"
              >
                <div className="p-4 space-y-6">
                  <nav className="space-y-1">
                    <Link
                      to="/docs"
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        location.pathname === '/docs'
                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                      )}
                    >
                      <Home size={16} />
                      Overview
                    </Link>

                    {categories?.map((category: KbCategory) => (
                      <Link
                        key={category.id}
                        to={`/docs/${category.slug}`}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                          location.pathname.startsWith(`/docs/${category.slug}`)
                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                        )}
                      >
                        <Book size={16} />
                        {category.name}
                      </Link>
                    ))}
                  </nav>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Content Area */}
        <main
          className={cn(
            'flex-1 min-h-[calc(100vh-3.5rem)] transition-all duration-300',
            sidebarOpen ? 'lg:ml-64' : 'lg:ml-0'
          )}
        >
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
};

export default DocsLayout;
