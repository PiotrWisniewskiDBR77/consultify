import { ArrowRight, Play, Sparkles } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface LandingNarrativeCtaBandProps {
  onDemoClick: () => void;
  onTrialClick: () => void;
  onAnnaClick: () => void;
}

export const LandingNarrativeCtaBand: React.FC<LandingNarrativeCtaBandProps> = ({
  onDemoClick,
  onTrialClick,
  onAnnaClick,
}) => {
  const { t } = useTranslation();

  return (
    <section className="py-16 px-6 relative z-10">
      <div className="max-w-6xl mx-auto rounded-[32px] border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.035] backdrop-blur-xl overflow-hidden">
        <div className="grid gap-8 lg:grid-cols-[1.3fr_0.9fr] p-8 md:p-10">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary-500/25 bg-primary-500/10 text-xs font-black uppercase tracking-[0.18em] text-primary-600 dark:text-primary-300">
              <Sparkles size={12} />
              <span>{t('landing.narrativeCta.badge', 'Choose your entry path')}</span>
            </div>

            <h2 className="mt-5 text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
              {t(
                'landing.narrativeCta.heading',
                'Move from category clarity to your first value moment.'
              )}
            </h2>

            <p className="mt-4 max-w-2xl text-sm md:text-base leading-relaxed text-slate-500 dark:text-white/60">
              {t(
                'landing.narrativeCta.sub',
                'Start with Anna if you want guided orientation, try the demo if you want to explore the platform, or launch a trial when you are ready to apply consulting intelligence to your own organization.'
              )}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onAnnaClick}
                className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 dark:border-violet-300/20 bg-violet-500/15 dark:bg-violet-500/12 px-4 py-2.5 text-sm font-semibold text-violet-700 dark:text-violet-100 transition-all duration-200 hover:bg-violet-500/25 dark:hover:bg-violet-500/20"
              >
                <Sparkles size={14} />
                <span>{t('landing.narrativeCta.askAnna', 'Ask Anna first')}</span>
              </button>

              <button
                type="button"
                onClick={onDemoClick}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-white/15 bg-slate-100 dark:bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-900 dark:text-white transition-all duration-200 hover:bg-white/[0.08]"
              >
                <Play size={14} className="text-slate-500 dark:text-white/70" fill="currentColor" />
                <span>{t('landing.narrativeCta.tryDemo', 'Try demo')}</span>
              </button>

              <button
                type="button"
                onClick={onTrialClick}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary-600 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-slate-900 dark:text-white shadow-[0_0_36px_-14px_rgba(124,58,237,0.7)] transition-all duration-200 hover:shadow-[0_0_42px_-12px_rgba(124,58,237,0.82)]"
              >
                <span>{t('landing.narrativeCta.startTrial', 'Start trial')}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 dark:border-white/[0.06] bg-slate-100 dark:bg-[#0D0828] p-6">
            <div className="space-y-4">
              {[
                t(
                  'landing.narrativeCta.points.0',
                  'Anna explains fit, pricing, and security before you commit to a path.'
                ),
                t(
                  'landing.narrativeCta.points.1',
                  'The demo shows the Consulting Intelligence Platform on seeded, read-only data.'
                ),
                t(
                  'landing.narrativeCta.points.2',
                  'The trial starts your own guided consulting workflow, from context to execution.'
                ),
              ].map((point, index) => (
                <div
                  key={point}
                  className="rounded-2xl border border-slate-200 dark:border-white/[0.05] bg-slate-50 dark:bg-white/[0.03] px-4 py-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary-500/20 bg-primary-500/12 text-[11px] font-black text-primary-600 dark:text-primary-300">
                      {index + 1}
                    </div>
                    <p className="text-sm leading-relaxed text-slate-600 dark:text-white/65">{point}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-emerald-400/20 dark:border-emerald-400/15 bg-emerald-500/10 px-4 py-3 text-xs font-medium text-emerald-700 dark:text-emerald-100/90">
              {t(
                'landing.narrativeCta.footer',
                'One narrative, three safe entry paths: guided orientation, product exploration, or direct trial onboarding.'
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LandingNarrativeCtaBand;
