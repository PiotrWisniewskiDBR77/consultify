import {
  ArrowRight,
  BookOpen,
  Handshake,
  Layers,
  Shield,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { DocumentationSection } from '../components/Landing/DocumentationSection';
import { KnowledgePreviewSection } from '../components/Landing/KnowledgePreviewSection';

/**
 * PublicLandingPage — Phase A: Pre-Entry
 *
 * ENTERPRISE SPEC COMPLIANCE:
 * - EPIC-A1: Category Clarity Before Any Product Claim
 * - EPIC-A2: Trust Built Through Restraint
 * - EPIC-A3: Absence of AI as a Signal of Seriousness
 */

export const PublicLandingPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const brandLogoSrc = new URL(
    '../../Logo consultify/Consultify_logo_dark_medium.svg',
    import.meta.url
  ).href;

  const handleDemoClick = () => {
    navigate('/demo');
  };

  const handlePartnerClick = () => {
    navigate('/become-partner');
  };

  return (
    <div className="min-h-screen bg-c-bg text-c-text selection:bg-c-accent/30 overflow-x-hidden relative">
      {/* Background Atmosphere */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-c-accent/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]" />
      </div>

      {/* HEADER — Minimalist */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-8">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3 group cursor-default select-none">
            <img
              src={brandLogoSrc}
              alt="Consultify"
              className="h-7 md:h-8 w-auto drop-shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
            />
          </div>
          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              to="/docs"
              className="flex items-center gap-2 text-sm font-medium text-white/60 hover:text-white transition-colors"
            >
              <BookOpen size={14} />
              {t('pages.public.nav.docs', 'Docs')}
            </Link>
            <Link
              to="/login"
              className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors border border-c-border-subtle"
            >
              {t('pages.public.nav.signIn', 'Sign In')}
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10 pt-32 pb-20 px-6">
        {/* HERO SECTION */}
        <section className="max-w-5xl mx-auto text-center mb-24 animate-fade-in">
          {/* North Star Sentence */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-8 bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
            {t(
              'pages.public.hero.title',
              'Strategic decisions are too complex for intuition and too important for chance.'
            )}
          </h1>

          {/* 6-Card Grid — Experience Navigator */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-16">
            {/* Card 1: Explore Demo */}
            <div
              onClick={handleDemoClick}
              className="glass-card p-8 rounded-xl group hover:bg-c-accent/5 transition duration-300 border-c-border-subtle cursor-pointer relative overflow-hidden"
            >
              <div className="absolute top-4 left-4 text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">
                {t('pages.public.cards.demo.meta', 'Instant Access')}
              </div>
              <div className="mt-8">
                <h3 className="text-2xl font-bold mb-3">
                  {t('pages.public.cards.demo.title', 'Explore Demo')}
                </h3>
                <p className="text-white/50 leading-relaxed text-sm">
                  {t(
                    'pages.public.cards.demo.description',
                    'Experience a live environment with fictional, realistic data.'
                  )}
                </p>
              </div>
            </div>

            {/* Card 2: Start Free Trial - PRIMARY PATH (Highlighted) */}
            <div
              onClick={() => navigate('/trial')}
              className="glass-card p-8 rounded-xl group hover:bg-c-accent/10 transition duration-300 border-2 border-c-accent/30 cursor-pointer relative overflow-hidden row-span-2"
            >
              <div className="absolute top-4 left-4 text-[10px] font-bold text-c-accent uppercase tracking-[0.2em]">
                {t('pages.public.cards.trial.meta', 'Primary Path')}
              </div>
              <div className="mt-8 flex flex-col h-full justify-center">
                <h3 className="text-3xl md:text-4xl font-bold mb-4">
                  {t('pages.public.cards.trial.title', 'Start Free Trial')}
                </h3>
                <p className="text-white/60 leading-relaxed mb-6">
                  {t(
                    'pages.public.cards.trial.description',
                    'Use Consultify on your real organization data and build your transformation roadmap.'
                  )}
                </p>
                <ArrowRight
                  className="text-c-accent group-hover:translate-x-2 transition-transform duration-300"
                  size={32}
                />
              </div>
            </div>

            {/* Card 3: How It Works - Video Tour */}
            <div
              onClick={() => navigate('/demo')}
              className="glass-card p-6 rounded-xl group hover:bg-blue-600/5 transition duration-300 border-c-border-subtle cursor-pointer relative overflow-hidden"
            >
              <div className="absolute top-4 left-4 text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">
                {t('pages.public.cards.tour.meta', 'Product Tour')}
              </div>
              <div className="mt-8 flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-c-accent/20 transition-colors">
                  <div className="w-0 h-0 border-l-[12px] border-l-white border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent ml-1" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1">
                    {t('pages.public.cards.tour.title', 'How It Works')}
                  </h3>
                  <p className="text-white/40 text-sm">
                    {t('pages.public.cards.tour.description', 'Guided by Dr. Piotr Wiśniewski')}
                  </p>
                </div>
              </div>
            </div>

            {/* Card 4: Learn Our Tools - Education Hub */}
            <div
              onClick={() => navigate('/tools')}
              className="glass-card p-8 rounded-xl group hover:shadow-2xl shadow-blue-500/20 hover:shadow-xl transition duration-300 cursor-pointer relative overflow-hidden"
            >
              {/* Background Image */}
              <div className="absolute inset-0 ring-2 ring-blue-500/40 group-hover:ring-blue-400/60 ring-inset transition duration-300 pointer-events-none">
                <img
                  src="/assets/landing/cinematic/tools_education.png"
                  alt="Education Hub"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03] opacity-60"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent group-hover:from-black/95 transition-colors" />
              </div>

              <div className="relative z-10">
                <div className="absolute top-4 left-4 text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">
                  {t('pages.public.cards.tools.meta', 'Education Hub')}
                </div>
                <div className="mt-8 flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-blue-600/20 flex items-center justify-center border border-blue-500/30 group-hover:bg-blue-600/30 transition-colors">
                    <Sparkles size={32} className="text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold mb-1 text-white">
                      {t('pages.public.cards.tools.title', 'Learn Our Tools')}
                    </h3>
                    <p className="text-white/60 text-sm">
                      {t('pages.public.cards.tools.description', 'Watch demos and masterclasses.')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 5: Become Partner - Replacing Log In */}
            <div
              onClick={handlePartnerClick}
              className="glass-card p-8 rounded-xl group hover:bg-c-accent/5 transition duration-300 border-c-border-subtle cursor-pointer relative overflow-hidden"
            >
              <div className="absolute top-4 left-4 text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">
                {t('pages.public.cards.partner.meta', 'Returning Users')}
              </div>
              <div className="mt-8 flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-c-accent-soft flex items-center justify-center border border-c-accent/30 group-hover:bg-c-accent/30 transition-colors">
                  <Handshake size={32} className="text-c-accent" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-1">
                    {t('pages.public.cards.partner.title', 'Become Partner')}
                  </h3>
                  <p className="text-white/40 text-sm">
                    {t('pages.public.cards.partner.description', 'Join our ecosystem.')}
                  </p>
                </div>
              </div>
            </div>

            {/* Card 7: AI Consulting Pitch */}
            <div className="glass-card p-8 rounded-xl group hover:bg-c-accent/10 transition duration-300 border-c-border-subtle relative overflow-hidden">
              <div className="flex flex-col h-full justify-center items-center text-center">
                <h3 className="text-3xl font-bold mb-2">
                  {t('pages.public.tagline.line1', 'AI consulting.')}
                </h3>
                <h3 className="text-3xl font-bold mb-2">
                  <span className="text-c-accent">
                    {t('pages.public.tagline.line2', 'No slides.')}
                  </span>
                </h3>
                <h3 className="text-3xl font-bold">
                  {t('pages.public.tagline.line3', 'Just decisions.')}
                </h3>
                <div className="w-12 h-1 bg-c-accent mt-4 rounded-full" />
              </div>
            </div>
          </div>
        </section>

        {/* KNOWLEDGE BASE PREVIEW */}
        <DocumentationSection />

        <KnowledgePreviewSection className="mb-12" />

        {/* CALL TO ACTION — Invitation */}
        <section
          className="max-w-3xl mx-auto text-center py-20 animate-fade-up"
          style={{ animationDelay: '0.2s' }}
        >
          <div className="inline-block glass-panel p-2 rounded-xl mb-12">
            <div className="px-6 py-3 rounded-xl bg-c-surface-raised flex items-center gap-4 text-sm font-medium text-c-text-secondary">
              <span>{t('pages.public.cta.noPressure', 'No rush. No sales pressure.')}</span>
              <div className="w-1 h-1 rounded-full bg-c-accent" />
              <span>{t('pages.public.cta.justSubstance', 'Just substance.')}</span>
            </div>
          </div>

          <p className="text-xl md:text-2xl text-white/70 font-light mb-12 max-w-2xl mx-auto leading-relaxed">
            {t(
              'pages.public.cta.body',
              'If you feel your organization needs a new discipline in decision-making, we invite you to explore our method.'
            )}
          </p>

          <button
            onClick={handleDemoClick}
            className="
                            group relative inline-flex items-center gap-4
                            bg-c-accent hover:opacity-90
                            text-white font-semibold text-xl
                            px-10 p-4 rounded-xl
                            shadow-[0_0_50px_-12px_rgba(165,28,48,0.5)]
                            hover:shadow-[0_0_60px_-12px_rgba(165,28,48,0.7)]
                            active:scale-[0.98]
                            transition duration-300 overflow-hidden
                        "
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-300" />
            <span>{t('pages.public.cta.button', 'Discover the Consultify Method')}</span>
            <ArrowRight
              className="group-hover:translate-x-2 transition-transform duration-300"
              size={24}
            />
          </button>

          <div className="mt-8 text-white/30 text-xs font-medium uppercase tracking-[0.3em]">
            {t('pages.public.cta.noForms', 'No Forms • No Obligations')}
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="relative z-10 py-12 px-6 border-t border-c-border-subtle bg-c-bg/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3 opacity-30 grayscale hover:opacity-100 hover:grayscale-0 transition duration-300">
            <div className="h-6 px-2 rounded bg-c-accent flex items-center justify-center">
              <span className="text-white font-bold text-[10px] tracking-tight">C</span>
            </div>
            <span className="text-sm font-bold tracking-[0.2em] text-white">CONSULTIFY</span>
          </div>

          <div className="flex items-center gap-8 text-xs font-semibold text-white/30 tracking-widest uppercase">
            <a href="/docs" className="hover:text-c-accent transition-colors">
              {t('pages.public.footer.docs', 'Documentation')}
            </a>
            <a href="/legal/privacy" className="hover:text-c-accent transition-colors">
              {t('pages.public.footer.privacy', 'Privacy')}
            </a>
            <a href="/legal/terms" className="hover:text-c-accent transition-colors">
              {t('pages.public.footer.terms', 'Terms')}
            </a>
            <a href="/docs/security" className="hover:text-c-accent transition-colors">
              {t('pages.public.footer.security', 'Security')}
            </a>
          </div>

          <div className="flex items-center gap-2 text-[10px] font-bold text-white/20 uppercase tracking-[0.4em] relative">
            <Shield size={12} className="mb-0.5" />
            {t('pages.public.footer.secured', 'Secured by DBR77 Governance')}
            {/* Hidden System Health Icon - Triple-click to access */}
            <div
              className="absolute -right-8 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-green-500/20 hover:bg-green-500/40 cursor-pointer transition group"
              onClick={(e) => {
                if (e.detail === 3) {
                  // Triple-click detected
                  window.location.href = '/system/health';
                }
              }}
              title="Triple-click for system diagnostics"
            >
              <div className="absolute inset-0 rounded-full bg-green-500 animate-pulse opacity-20 group-hover:opacity-40" />
            </div>
          </div>
        </div>
      </footer>

      {/* Custom Mouse Glow Effect (Decorative) */}
      <div
        className="fixed inset-0 pointer-events-none z-50 mix-blend-soft-light opacity-50"
        style={{
          background:
            'radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(165,28,48, 0.08), transparent 40%)',
        }}
      />
    </div>
  );
};

export default PublicLandingPage;
