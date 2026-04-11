import {
  ArrowRight,
  Award,
  BadgeCheck,
  BookOpen,
  Building2,
  CheckCircle2,
  CreditCard,
  GraduationCap,
  Rocket,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { MarketingLayout } from '@/components/Landing/MarketingLayout';
import { ROUTES } from '@/routes/routeConfig';

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
    navigate(ROUTES.PARTNER.ONBOARDING);
  };

  const handleLearnMoreClick = () => {
    navigate(ROUTES.PARTNER.PRICING);
  };

  const BENEFIT_KEYS = ['platform', 'certifications', 'billing', 'materials'] as const;
  const BENEFIT_VISUALS = [
    { icon: Rocket, color: 'violet' },
    { icon: GraduationCap, color: 'blue' },
    { icon: CreditCard, color: 'emerald' },
    { icon: BookOpen, color: 'purple' },
  ];

  const TIER_KEYS = ['registered', 'certified', 'premier'] as const;
  const TIER_VISUALS = [
    { icon: Users, color: 'slate' },
    { icon: Award, color: 'violet' },
    { icon: Target, color: 'emerald' },
  ];

  const STEP_KEYS = ['apply', 'meet', 'onboarding', 'grow'] as const;

  return (
    <MarketingLayout>
      <div className="min-h-[calc(100vh-3.5rem)] bg-navy-950 text-white selection:bg-violet-500/30 overflow-x-hidden relative">
        {/* Background Atmosphere */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-5%] right-[-10%] w-[50%] h-[50%] bg-violet-600/15 rounded-full blur-[150px]" />
          <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]" />
          <div className="absolute top-[40%] left-[20%] w-[30%] h-[30%] bg-blue-600/8 rounded-full blur-[100px]" />
        </div>

        <main className="relative z-10 pt-16 pb-20 px-6">
          {/* HERO SECTION */}
          <section className="max-w-5xl mx-auto text-center mb-24 animate-fade-in">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-600/10 border border-violet-500/20 mb-8">
              <Sparkles size={16} className="text-violet-400" />
              <span className="text-sm font-medium text-violet-300">
                {t('pages.partner.hero.badge', 'Consultify Partner Program')}
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-8 bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
              {t('pages.partner.hero.titleLine1', 'Join the')} <br className="hidden md:block" />
              <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                {t('pages.partner.hero.titleLine2', 'Consultify Partner Program')}
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-white/60 font-light max-w-3xl mx-auto mb-12 leading-relaxed">
              {t('pages.partner.hero.subtitle', 'Join a network of partners using Consultify for digital transformation. Professional PMO standards combined with the power of AI.')}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={handleApplyClick}
                className="group relative inline-flex items-center gap-3 bg-violet-600 hover:bg-violet-500 text-white font-semibold text-lg px-8 py-4 rounded-xl shadow-[0_0_50px_-12px_rgba(124,58,237,0.5)] hover:shadow-[0_0_60px_-12px_rgba(124,58,237,0.7)] active:scale-[0.98] transition-all duration-500 overflow-hidden"
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
                className="inline-flex items-center gap-2 text-white/60 hover:text-white font-medium text-lg px-6 py-4 rounded-xl hover:bg-slate-50 dark:hover:bg-navy-800/20 transition-all duration-300"
              >
                {t('pages.partner.hero.learnMore', 'Odkrywaj program')}
                <ArrowRight size={18} />
              </button>

              <button
                onClick={() => navigate('/login')}
                className="inline-flex items-center gap-2 text-white/60 hover:text-white font-medium text-lg px-6 py-4 rounded-xl hover:bg-slate-50 dark:hover:bg-navy-800/20 transition-all duration-300"
              >
                <Shield size={18} className="text-violet-400" />
                {t('pages.partner.hero.existingPartner', 'Zaloguj się jako partner')}
              </button>
            </div>
          </section>

          {/* BENEFITS SECTION */}
          <section className="max-w-6xl mx-auto mb-24">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('pages.partner.benefits.heading', 'What You Get as a Partner')}</h2>
              <p className="text-white/50 text-lg max-w-2xl mx-auto">
                {t('pages.partner.benefits.sub', 'Partnership with Consultify opens new opportunities for growing your consulting practice.')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {BENEFIT_KEYS.map((key, index) => {
                const visual = BENEFIT_VISUALS[index];
                const prefix = `pages.partner.benefits.items.${key}`;
                return (
                  <div
                    key={key}
                    className={`bg-navy-900/30 backdrop-blur-sm p-6 rounded-xl group hover:bg-${visual.color}-600/5 transition-all duration-500 border border-white/5 hover:border-${visual.color}-500/20 overflow-hidden relative`}
                  >
                    <visual.icon
                      className={`text-${visual.color}-400 mb-4 group-hover:scale-110 transition-transform duration-500 relative z-10`}
                      size={32}
                    />
                    <h3 className="text-lg font-semibold mb-2 relative z-10">{t(`${prefix}.title`)}</h3>
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
              <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('pages.partner.tiers.heading', 'Partnership Tiers')}</h2>
              <p className="text-white/50 text-lg max-w-2xl mx-auto">
                {t('pages.partner.tiers.sub', 'Choose the tier that matches your goals. Advance as your partnership grows.')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {TIER_KEYS.map((key, index) => {
                const visual = TIER_VISUALS[index];
                const prefix = `pages.partner.tiers.items.${key}`;
                const requirements = (t(`${prefix}.requirements`, { returnObjects: true }) || []) as string[];
                const tierBenefits = (t(`${prefix}.benefits`, { returnObjects: true }) || []) as string[];
                return (
                  <div
                    key={key}
                    className={`bg-navy-900/30 backdrop-blur-sm p-8 rounded-xl border transition-all duration-500 group ${
                      key === 'certified'
                        ? 'border-violet-500/30 shadow-lg shadow-violet-500/10'
                        : 'border-white/10 hover:border-violet-500/20'
                    }`}
                  >
                    <div
                      className={`w-14 h-14 rounded-xl bg-${visual.color}-600/20 flex items-center justify-center mb-6 group-hover:bg-${visual.color}-600/30 transition-colors`}
                    >
                      <visual.icon size={28} className={`text-${visual.color}-400`} />
                    </div>
                    <h3 className="text-xl font-bold mb-2">{t(`${prefix}.title`)}</h3>
                    <p className="text-white/50 text-sm mb-6">{t(`${prefix}.description`)}</p>

                    <div className="mb-6">
                      <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-2">
                        {t('pages.partner.tiers.requirementsLabel', 'Requirements')}
                      </h4>
                      <ul className="space-y-1.5">
                        {(Array.isArray(requirements) ? requirements : []).map((req, rIndex) => (
                          <li key={rIndex} className="flex items-start gap-2 text-sm text-white/60">
                            <CheckCircle2 size={14} className="mt-0.5 text-white/30 flex-shrink-0" />
                            {req}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-2">
                        {t('pages.partner.tiers.benefitsLabel', 'Benefits')}
                      </h4>
                      <ul className="space-y-1.5">
                        {(Array.isArray(tierBenefits) ? tierBenefits : []).map((benefit, bIndex) => (
                          <li key={bIndex} className="flex items-start gap-2 text-sm text-white/70">
                            <CheckCircle2
                              size={14}
                              className={`mt-0.5 text-${visual.color}-400 flex-shrink-0`}
                            />
                            {benefit}
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
              <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('pages.partner.process.heading', 'How to Join?')}</h2>
              <p className="text-white/50 text-lg">
                {t('pages.partner.process.sub', 'Simple 4-step process to start the partnership.')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {STEP_KEYS.map((key, index) => {
                const prefix = `pages.partner.process.steps.${key}`;
                return (
                  <div key={key} className="relative">
                    <div className="bg-navy-900/30 backdrop-blur-sm p-6 rounded-xl text-center border border-white/5 hover:border-violet-500/20 transition-all duration-300">
                      <div className="w-12 h-12 rounded-full bg-violet-600 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
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
            <BadgeCheck size={48} className="text-violet-400 mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-bold mb-6">{t('pages.partner.cta.heading', 'Ready to Partner?')}</h2>
            <p className="text-white/60 text-lg mb-8 max-w-xl mx-auto">
              {t('pages.partner.cta.body', 'Join the Consultify partner community and together deliver professional PMO + AI solutions for organizations in transformation.')}
            </p>
            <button
              onClick={handleApplyClick}
              className="group relative inline-flex items-center gap-3 bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xl px-10 py-4 rounded-xl shadow-[0_0_50px_-12px_rgba(124,58,237,0.5)] hover:shadow-[0_0_60px_-12px_rgba(124,58,237,0.7)] active:scale-[0.98] transition-all duration-500 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              <span>{t('pages.partner.cta.applyBtn', 'Start Application')}</span>
              <ArrowRight
                className="group-hover:translate-x-2 transition-transform duration-500"
                size={24}
              />
            </button>
            <p className="mt-6 text-white/30 text-sm">{t('pages.partner.cta.noObligation', 'No obligations • We respond within 24h')}</p>
          </section>
        </main>
      </div>
    </MarketingLayout>
  );
};

export default BecomePartnerView;
