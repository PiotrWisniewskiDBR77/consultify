import {
  ArrowRight,
  Award,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  CreditCard,
  GraduationCap,
  Rocket,
  Shield,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { MarketingLayout } from '@/components/Landing/MarketingLayout';
import { ROUTES } from '@/routes/routeConfig';
import { PARTNER_TIERS } from '@/views/partner/partnerPricingData';

/**
 * BecomePartnerView — Partner Recruitment Landing Page
 *
 * Public-facing page inviting potential partners to join the Consultify
 * PMO + AI ecosystem. Links back to main landing page and partner portal.
 */

export const BecomePartnerView: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleApplyClick = () => {
    navigate(ROUTES.PARTNER.PUBLIC_APPLY);
  };

  const handleLearnMoreClick = () => {
    navigate(ROUTES.PARTNER.PRICING);
  };

  const BENEFIT_KEYS = ['platform', 'certifications', 'billing', 'materials'] as const;
  const BENEFIT_VISUALS = [
    { icon: Rocket },
    { icon: GraduationCap },
    { icon: CreditCard },
    { icon: BookOpen },
  ];

  // SSOT — partnership tiers come from PARTNER_TIERS (shared with the public
  // pricing page AND the in-product ProviderHomeView), so the public landing
  // can never advertise a different program than the portal shows inside.
  const maxCommissionPct = PARTNER_TIERS[PARTNER_TIERS.length - 1].commissionRate;

  const STEP_KEYS = ['apply', 'meet', 'onboarding', 'grow'] as const;

  return (
    <MarketingLayout>
      <div className="min-h-[calc(100vh-3.5rem)] bg-navy-950 text-white selection:bg-c-accent-soft overflow-x-hidden relative">
        {/* Background Atmosphere */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-5%] right-[-10%] w-[50%] h-[50%] bg-c-accent/15 rounded-full blur-[150px]" />
          <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-c-accent/10 rounded-full blur-[120px]" />
          <div className="absolute top-[40%] left-[20%] w-[30%] h-[30%] bg-c-info/8 rounded-full blur-[100px]" />
        </div>

        <main className="relative z-10 pt-16 pb-20 px-6">
          {/* HERO SECTION */}
          <section className="max-w-5xl mx-auto text-center mb-24 animate-fade-in">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-c-accent-soft border border-c-accent/20 mb-8">
              <Sparkles size={16} className="text-c-accent" />
              <span className="text-sm font-medium text-c-accent">
                {t('pages.partner.hero.badge', 'Consultify Partner Program')}
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-8 bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
              {t('pages.partner.hero.titleLine1', 'Join the')} <br className="hidden md:block" />
              <span className="text-c-accent">
                {t('pages.partner.hero.titleLine2', 'Consultify Partner Program')}
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-white/60 font-light max-w-3xl mx-auto mb-12 leading-relaxed">
              {t(
                'pages.partner.hero.subtitle',
                'Join a network of partners using Consultify for digital transformation. Professional PMO standards combined with the power of AI.'
              )}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={handleApplyClick}
                className="group relative inline-flex items-center gap-3 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] font-semibold text-lg px-8 py-4 rounded-xl shadow-[0_0_50px_-12px_rgba(165,28,48,0.5)] hover:shadow-[0_0_60px_-12px_rgba(165,28,48,0.7)] active:scale-[0.98] transition-all duration-500 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                <span>{t('pages.partner.hero.applyBtn', 'Apply for Partnership')}</span>
                <ArrowRight
                  className="group-hover:translate-x-1 transition-transform duration-300"
                  size={20}
                />
              </button>

              <button
                onClick={handleLearnMoreClick}
                className="inline-flex items-center gap-2 text-white/60 hover:text-white font-medium text-lg px-6 py-4 rounded-xl hover:bg-white/10 transition-all duration-300"
              >
                {t('pages.partner.hero.learnMore', 'Odkrywaj program')}
                <ArrowRight size={18} />
              </button>

              <button
                onClick={() => navigate('/login')}
                className="inline-flex items-center gap-2 text-white/60 hover:text-white font-medium text-lg px-6 py-4 rounded-xl hover:bg-white/10 transition-all duration-300"
              >
                <Shield size={18} className="text-c-accent" />
                {t('pages.partner.hero.existingPartner', 'Zaloguj się jako partner')}
              </button>
            </div>

            {/* Trust / value strip — SSOT-derived, truthful (beta program) */}
            <div className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-white/50">
              <span className="flex items-center gap-2">
                <TrendingUp size={16} className="text-c-accent" />
                {t('pages.partner.hero.stat.commission', 'do {{pct}}% prowizji', {
                  pct: maxCommissionPct,
                })}
              </span>
              <span className="text-white/15">•</span>
              <span className="flex items-center gap-2">
                <Award size={16} className="text-c-accent" />
                {t('pages.partner.hero.stat.tiers', '4 poziomy partnerstwa')}
              </span>
              <span className="text-white/15">•</span>
              <span className="flex items-center gap-2">
                <GraduationCap size={16} className="text-c-accent" />
                {t('pages.partner.hero.stat.academy', 'Partner Academy + certyfikacja')}
              </span>
              <span className="text-white/15">•</span>
              <span className="flex items-center gap-2">
                <Shield size={16} className="text-c-accent" />
                {t('pages.partner.hero.stat.standards', 'ISO 21500 / PMBOK 7 / PRINCE2')}
              </span>
            </div>
          </section>

          {/* BENEFITS SECTION */}
          <section className="max-w-6xl mx-auto mb-24">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                {t('pages.partner.benefits.heading', 'What You Get as a Partner')}
              </h2>
              <p className="text-white/50 text-lg max-w-2xl mx-auto">
                {t(
                  'pages.partner.benefits.sub',
                  'Partnership with Consultify opens new opportunities for growing your consulting practice.'
                )}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {BENEFIT_KEYS.map((key, index) => {
                const visual = BENEFIT_VISUALS[index];
                const prefix = `pages.partner.benefits.items.${key}`;
                return (
                  <div
                    key={key}
                    className="bg-navy-900/30 backdrop-blur-sm p-6 rounded-xl group hover:bg-c-accent/5 transition-all duration-500 border border-white/5 hover:border-c-accent/20 overflow-hidden relative"
                  >
                    <visual.icon
                      className="text-c-accent mb-4 group-hover:scale-110 transition-transform duration-500 relative z-10"
                      size={32}
                    />
                    <h3 className="text-lg font-semibold mb-2 relative z-10">
                      {t(`${prefix}.title`)}
                    </h3>
                    <p className="text-white/50 text-sm leading-relaxed relative z-10">
                      {t(`${prefix}.description`)}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* PARTNERSHIP TIERS SECTION */}
          <section className="max-w-6xl mx-auto mb-24">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                {t('pages.partner.tiers.heading', 'Partnership Tiers')}
              </h2>
              <p className="text-white/50 text-lg max-w-2xl mx-auto">
                {t(
                  'pages.partner.tiers.sub',
                  'Choose the tier that matches your goals. Advance as your partnership grows.'
                )}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {PARTNER_TIERS.map((tier) => {
                const TierIcon = tier.icon;
                const topBenefits = tier.features.filter((f) => f.included).slice(0, 4);
                return (
                  <div
                    key={tier.id}
                    className={`relative bg-navy-900/30 backdrop-blur-sm p-8 rounded-xl border transition-all duration-500 group ${
                      tier.highlight
                        ? 'border-c-accent/40 shadow-lg shadow-c-accent/10'
                        : 'border-white/10 hover:border-c-accent/20'
                    }`}
                  >
                    {tier.badge && (
                      <span className="absolute top-4 right-4 px-2 py-0.5 rounded-full bg-c-accent-soft text-c-accent text-[10px] font-semibold uppercase tracking-wide">
                        {tier.badge}
                      </span>
                    )}
                    <div className="w-14 h-14 rounded-xl bg-c-accent/20 flex items-center justify-center mb-6 group-hover:bg-c-accent/30 transition-colors">
                      <TierIcon size={28} className="text-c-accent" />
                    </div>
                    <h3 className="text-xl font-bold mb-1">{tier.name}</h3>
                    <p className="text-white/50 text-sm mb-4">{tier.description}</p>

                    {/* Commission headline — SSOT, matches pricing + portal */}
                    <div className="flex items-baseline gap-1 mb-6">
                      <span className="text-3xl font-bold text-white">{tier.commissionRate}%</span>
                      <span className="text-white/40 text-sm">
                        {t('pages.partner.tiers.commissionLabel', 'prowizji')}
                      </span>
                    </div>

                    <div className="mb-6">
                      <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-2">
                        {t('pages.partner.tiers.requirementsLabel', 'Wymagania')}
                      </h4>
                      <ul className="space-y-1.5">
                        {tier.requirements.map((req, rIndex) => (
                          <li key={rIndex} className="flex items-start gap-2 text-sm text-white/60">
                            <CheckCircle2
                              size={14}
                              className="mt-0.5 text-white/30 flex-shrink-0"
                            />
                            <span>
                              {req.label}: <span className="text-white/80">{req.value}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-2">
                        {t('pages.partner.tiers.benefitsLabel', 'Korzyści')}
                      </h4>
                      <ul className="space-y-1.5">
                        {topBenefits.map((benefit, bIndex) => (
                          <li key={bIndex} className="flex items-start gap-2 text-sm text-white/70">
                            <CheckCircle2
                              size={14}
                              className="mt-0.5 text-c-accent flex-shrink-0"
                            />
                            {benefit.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* PROCESS SECTION */}
          <section className="max-w-4xl mx-auto mb-24">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                {t('pages.partner.process.heading', 'How to Join?')}
              </h2>
              <p className="text-white/50 text-lg">
                {t('pages.partner.process.sub', 'Simple 4-step process to start the partnership.')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {STEP_KEYS.map((key, index) => {
                const prefix = `pages.partner.process.steps.${key}`;
                return (
                  <div key={key} className="relative">
                    <div className="bg-navy-900/30 backdrop-blur-sm p-6 rounded-xl text-center border border-white/5 hover:border-c-accent/20 transition-all duration-300">
                      <div className="w-12 h-12 rounded-full bg-navy-900 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                        {index + 1}
                      </div>
                      <h4 className="font-semibold mb-2">{t(`${prefix}.title`)}</h4>
                      <p className="text-white/50 text-sm">{t(`${prefix}.description`)}</p>
                    </div>
                    {index < STEP_KEYS.length - 1 && (
                      <div className="hidden md:block absolute top-1/2 -right-2 transform -translate-y-1/2">
                        <ArrowRight size={16} className="text-white/20" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* FINAL CTA SECTION */}
          <section className="max-w-3xl mx-auto text-center py-16 px-8 bg-navy-900/30 backdrop-blur-sm rounded-xl border border-white/10">
            <BadgeCheck size={48} className="text-c-accent mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              {t('pages.partner.cta.heading', 'Ready to Partner?')}
            </h2>
            <p className="text-white/60 text-lg mb-8 max-w-xl mx-auto">
              {t(
                'pages.partner.cta.body',
                'Join the Consultify partner community and together deliver professional PMO + AI solutions for organizations in transformation.'
              )}
            </p>
            <button
              onClick={handleApplyClick}
              className="group relative inline-flex items-center gap-3 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] font-semibold text-xl px-10 py-4 rounded-xl shadow-[0_0_50px_-12px_rgba(165,28,48,0.5)] hover:shadow-[0_0_60px_-12px_rgba(165,28,48,0.7)] active:scale-[0.98] transition-all duration-500 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              <span>{t('pages.partner.cta.applyBtn', 'Start Application')}</span>
              <ArrowRight
                className="group-hover:translate-x-2 transition-transform duration-500"
                size={24}
              />
            </button>
            <p className="mt-6 text-white/30 text-sm">
              {t('pages.partner.cta.noObligation', 'No obligations • We respond within 24h')}
            </p>
          </section>
        </main>
      </div>
    </MarketingLayout>
  );
};

export default BecomePartnerView;
