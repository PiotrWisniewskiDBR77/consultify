/**
 * DocumentationSection (T094)
 *
 * Landing page section showcasing documentation resources.
 * Shortcuts: Getting Started, Security, API Reference, Changelog, Legal Center, Integrations.
 * Includes search CTA and "freshness" signal.
 */

import {
  ArrowRight,
  BookOpen,
  FileText,
  Gavel,
  History,
  Search,
  Shield,
  Terminal,
} from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { trackFunnelEvent } from '../../services/funnelAnalytics';

const DOC_CARDS = [
  { titleKey: 'gettingStarted', descKey: 'gettingStartedDesc', icon: BookOpen, href: '/docs', color: 'violet', target: 'getting_started' },
  { titleKey: 'security', descKey: 'securityDesc', icon: Shield, href: '/docs/security', color: 'emerald', target: 'security' },
  { titleKey: 'apiReference', descKey: 'apiReferenceDesc', icon: Terminal, href: '/docs/api', color: 'blue', target: 'api' },
  { titleKey: 'changelog', descKey: 'changelogDesc', icon: History, href: '/docs/changelog', color: 'amber', target: 'changelog' },
  { titleKey: 'legalCenter', descKey: 'legalCenterDesc', icon: Gavel, href: '/legal', color: 'slate', target: 'legal' },
  { titleKey: 'integrations', descKey: 'integrationsDesc', icon: FileText, href: '/docs/integrations', color: 'purple', target: 'integrations' },
] as const;

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; hover: string }> = {
  violet: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20', hover: 'hover:border-violet-500/40 hover:bg-violet-500/15' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', hover: 'hover:border-emerald-500/40 hover:bg-emerald-500/15' },
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', hover: 'hover:border-blue-500/40 hover:bg-blue-500/15' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', hover: 'hover:border-amber-500/40 hover:bg-amber-500/15' },
  slate: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20', hover: 'hover:border-slate-500/40 hover:bg-slate-500/15' },
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20', hover: 'hover:border-purple-500/40 hover:bg-purple-500/15' },
};

interface DocumentationSectionProps {
  className?: string;
}

export const DocumentationSection: React.FC<DocumentationSectionProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const hasTrackedView = useRef(false);

  const tp = (key: string, fallback?: string) => t(`landing.docs.${key}`, fallback || key);

  const handleSectionView = useCallback(() => {
    if (!hasTrackedView.current) {
      trackFunnelEvent('landing_docs_section_viewed', { location: 'landing' });
      hasTrackedView.current = true;
    }
  }, []);

  const handleCardClick = (target: string) => {
    trackFunnelEvent('landing_docs_cta_clicked', { target, location: 'landing' });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      trackFunnelEvent('landing_docs_search_used', { queryLength: searchQuery.trim().length });
      navigate(`/docs/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <section className={`py-20 md:py-28 ${className}`} onMouseEnter={handleSectionView}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-medium mb-6">
            <BookOpen size={14} />
            {tp('badge', 'Documentation')}
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
            {tp('title', 'Built for transparency')}
          </h2>
          <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
            {tp('subtitle', 'Everything you need to evaluate, integrate, and trust our platform.')}
          </p>
        </div>

        <form onSubmit={handleSearch} className="max-w-xl mx-auto mb-14 flex items-center gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tp('searchPlaceholder', 'Search documentation...')}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/80 dark:bg-navy-800/80 border border-slate-200 dark:border-navy-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40 transition-shadow backdrop-blur-sm"
            />
          </div>
          <button type="submit" className="px-5 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors flex items-center gap-2">
            <Search size={14} />
            {tp('searchBtn', 'Search')}
          </button>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {DOC_CARDS.map((card) => {
            const colors = COLOR_MAP[card.color];
            const IconComp = card.icon;
            return (
              <Link
                key={card.target}
                to={card.href}
                onClick={() => handleCardClick(card.target)}
                className={`group p-6 rounded-xl border transition-all duration-300 ${colors.border} ${colors.hover} bg-white/50 dark:bg-navy-900/50 backdrop-blur-sm`}
              >
                <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center mb-4`}>
                  <IconComp size={20} className={colors.text} />
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">{tp(card.titleKey)}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-3">{tp(card.descKey)}</p>
                <span className={`inline-flex items-center gap-1 text-xs font-medium ${colors.text} group-hover:gap-2 transition-all`}>
                  {tp('explore', 'Explore')}
                  <ArrowRight size={12} />
                </span>
              </Link>
            );
          })}
        </div>

        <div className="mt-10 text-center">
          <Link
            to="/docs/changelog"
            onClick={() => handleCardClick('whats_new')}
            className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-violet-400 transition-colors"
          >
            <History size={14} />
            <span>{tp('lastUpdated', 'Last updated')}: {tp('lastUpdatedDate', 'February 2026')}</span>
            <span className="text-violet-400 font-medium">\u2014 {tp('whatsNew', "See what\'s new")}</span>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default DocumentationSection;
