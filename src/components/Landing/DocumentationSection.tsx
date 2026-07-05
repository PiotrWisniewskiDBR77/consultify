import { ArrowRight, BookOpen, FileText, Gavel, Search, Shield, Users, Wallet } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { trackFunnelEvent } from '../../services/funnelAnalytics';

const DOC_CARDS = [
  {
    titleKey: 'knowledgeBase',
    descKey: 'knowledgeBaseDesc',
    icon: BookOpen,
    href: '/knowledge-base',
    gradient: 'bg-c-accent',
    glow: 'rgba(165,28,48,0.25)',
  },
  {
    titleKey: 'security',
    descKey: 'securityDesc',
    icon: Shield,
    href: '/security',
    gradient: 'from-emerald-500 to-blue-600',
    glow: 'rgba(16,185,129,0.25)',
  },
  {
    titleKey: 'pricing',
    descKey: 'pricingDesc',
    icon: Wallet,
    href: '/pricing',
    gradient: 'from-blue-500 to-blue-600',
    glow: 'rgba(6,182,212,0.25)',
  },
  {
    titleKey: 'partnerProgram',
    descKey: 'partnerProgramDesc',
    icon: Users,
    href: '/become-partner',
    gradient: 'from-amber-500 to-amber-600',
    glow: 'rgba(245,158,11,0.25)',
  },
  {
    titleKey: 'legalCenter',
    descKey: 'legalCenterDesc',
    icon: Gavel,
    href: '/legal',
    gradient: 'from-slate-400 to-slate-600',
    glow: 'rgba(148,163,184,0.20)',
  },
  {
    titleKey: 'resources',
    descKey: 'resourcesDesc',
    icon: FileText,
    href: '/resources',
    gradient: 'bg-c-accent',
    glow: 'rgba(217,70,239,0.25)',
  },
] as const;

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
      navigate(`/knowledge-base?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <section
      className={`relative py-24 md:py-32 overflow-hidden ${className}`}
      onMouseEnter={handleSectionView}
    >
      <div className="absolute inset-0 bg-[#0A0F1E]" />
      <div className="absolute top-[20%] right-[-5%] w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(165,28,48,0.10)_0%,transparent_65%)] blur-[80px]" />
      <div className="absolute bottom-[10%] left-[-5%] w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(6,182,212,0.06)_0%,transparent_65%)] blur-[90px]" />

      <div className="relative max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-c-accent/30 bg-c-accent-soft backdrop-blur-sm text-xs font-bold text-c-accent tracking-wide mb-8">
            <BookOpen size={14} />
            <span>{tp('badge', 'Help & evaluation')}</span>
          </div>

          <h2
            className="font-black tracking-tight text-white leading-[1.1]"
            style={{ fontSize: 'clamp(28px, 4vw, 48px)' }}
          >
            {tp('title', 'Everything you need to evaluate Consultify')}
          </h2>

          <p className="mt-4 text-base text-white/40 max-w-2xl mx-auto leading-relaxed">
            {tp(
              'subtitle',
              'Use knowledge, security, pricing, and partner materials to decide whether Consultify fits your rollout.'
            )}
          </p>
        </div>

        <form onSubmit={handleSearch} className="max-w-xl mx-auto mb-14 flex items-center gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tp('searchPlaceholder', 'Search knowledge and buyer guidance...')}
              className="w-full pl-11 pr-4 h-[48px] rounded-xl bg-white/[0.04] border border-white/[0.10] text-sm text-white placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-c-accent/40 focus:border-c-accent/30 transition-all backdrop-blur-sm"
            />
          </div>
          <button
            type="submit"
            className="h-[48px] px-6 rounded-xl text-sm font-semibold text-white transition-all flex items-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #A51C30 0%, #851627 100%)',
              boxShadow: '0 0 24px -6px rgba(165,28,48,0.50)',
            }}
          >
            <Search size={14} />
            {tp('searchBtn', 'Search')}
          </button>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {DOC_CARDS.map((card) => {
            const IconComp = card.icon;
            return (
              <Link
                key={card.titleKey}
                to={card.href}
                onClick={() => handleCardClick(card.titleKey)}
                className="group rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm p-6 transition-all duration-300 hover:bg-white/[0.05] hover:border-white/[0.14]"
                style={{ boxShadow: `0 0 0 0 transparent` }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 0 40px -12px ${card.glow}`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 0 transparent';
                }}
              >
                <div
                  className={`w-10 h-10 rounded-xl ${card.gradient.startsWith('from-') ? 'bg-gradient-to-br ' : ''}${card.gradient} flex items-center justify-center mb-4 shadow-lg`}
                  style={{ boxShadow: `0 4px 16px -4px ${card.glow}` }}
                >
                  <IconComp size={18} className="text-white" />
                </div>

                <h3 className="text-sm font-bold text-white mb-1.5">{tp(card.titleKey)}</h3>
                <p className="text-xs text-white/35 leading-relaxed mb-4 line-clamp-2">
                  {tp(card.descKey)}
                </p>

                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-c-accent group-hover:gap-2.5 transition-all">
                  {tp('explore', 'Explore')}
                  <ArrowRight size={12} />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default DocumentationSection;
