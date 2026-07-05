import { motion } from 'framer-motion';
import { ArrowRight, Play } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { trackFunnelEvent } from '@/services/funnelAnalytics';

interface ProfitHeroSectionProps {
  onOpenDemoNow: () => void;
  onLaunchTrial: () => void;
  variant: string;
}

export const ProfitHeroSection: React.FC<ProfitHeroSectionProps> = ({
  onOpenDemoNow,
  onLaunchTrial,
  variant,
}) => {
  const { t } = useTranslation();

  return (
    <section className="pt-32 pb-20 px-6 relative z-10">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
        {/* Copy */}
        <div className="space-y-10">
          <div className="space-y-6">
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55 }}
              className="text-5xl lg:text-7xl font-black text-c-text leading-[1.05] tracking-tight"
            >
              {t('landing.profitHero.h1.line1', 'Consultify AI.')}
              <br />
              {t('landing.profitHero.h1.line2', 'All the world’s business knowledge.')}
              <br />
              <span className="text-c-accent">
                {t('landing.profitHero.h1.line3', 'Turned into your profits.')}
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08 }}
              className="text-lg lg:text-xl text-c-text-secondary font-semibold"
            >
              {t('landing.profitHero.sub', 'Diagnose. Plan. Execute. Track impact.')}
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.14 }}
              className="text-sm lg:text-base text-c-text-muted font-medium max-w-xl"
            >
              {t(
                'landing.profitHero.billboard',
                'We did for consulting what Spotify did for music: unlimited access — but instead of playlists, you get profit.'
              )}
            </motion.p>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => {
                trackFunnelEvent('landing_primary_cta_clicked', {
                  cta: 'launch_free_trial',
                  variant,
                });
                onLaunchTrial();
              }}
              className="px-7 py-4 rounded-xl bg-c-accent hover:opacity-90 text-white font-semibold shadow-lg shadow-c-accent/20 transition-opacity flex items-center justify-center gap-2"
            >
              {t('landing.profitHero.ctaPrimary', 'Launch Free Trial')}
              <ArrowRight size={18} />
            </button>

            <button
              onClick={() => {
                trackFunnelEvent('landing_demo_clicked', { cta: 'open_demo_now', variant });
                onOpenDemoNow();
              }}
              className="px-7 py-4 rounded-xl bg-c-surface hover:bg-c-surface-raised border border-c-border text-c-text font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Play size={18} className="text-c-accent" />
              {t('landing.profitHero.ctaSecondary', 'OPEN DEMO NOW')}
            </button>
          </div>

          <div className="text-xs text-c-text-muted font-medium">
            {t(
              'landing.profitHero.ctaNote',
              'Short teasers are public. Full videos unlock after login.'
            )}
          </div>
        </div>

        {/* Visual proof panel */}
        <div className="relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="relative rounded-2xl overflow-hidden bg-c-surface border border-c-border shadow-2xl"
          >
            <div className="p-6 border-b border-c-border">
              <p className="text-sm font-black text-c-text">
                {t('landing.profitHero.panel.title', 'From chat → to deliverables → to profit')}
              </p>
              <p className="text-xs text-c-text-muted mt-1">
                {t('landing.profitHero.panel.subtitle', 'One workspace. End-to-end execution.')}
              </p>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                {[
                  {
                    k: 'landing.profitHero.panel.items.tools',
                    d: 'Tools & frameworks',
                  },
                  {
                    k: 'landing.profitHero.panel.items.finance',
                    d: 'Financial analysis',
                  },
                  {
                    k: 'landing.profitHero.panel.items.reports',
                    d: 'Reports & decks',
                  },
                  {
                    k: 'landing.profitHero.panel.items.governance',
                    d: 'Governance by default',
                  },
                ].map((it) => (
                  <div
                    key={it.k}
                    className="rounded-xl border border-c-border bg-c-surface-raised p-4"
                  >
                    <p className="text-sm font-bold text-c-text">
                      {t(it.k, it.d)}
                    </p>
                    <p className="text-xs text-c-text-muted mt-1">
                      {t(`${it.k}.sub`, 'Built for enterprise')}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-xl overflow-hidden border border-c-border bg-c-surface-raised">
                <img
                  src="/assets/landing/proof/consultify-where-it-happens.png"
                  alt={t('landing.profitHero.panel.imageAlt', 'Consultify product screenshot')}
                  className="w-full h-[260px] object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
                <div className="p-4">
                  <p className="text-xs text-c-text-muted">
                    {t(
                      'landing.profitHero.panel.imageHint',
                      'Screenshots will appear here when assets are available.'
                    )}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ProfitHeroSection;
