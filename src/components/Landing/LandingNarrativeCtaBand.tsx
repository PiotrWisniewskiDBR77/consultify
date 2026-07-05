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
      <div className="max-w-6xl mx-auto rounded-[32px] border border-c-border bg-c-surface-raised backdrop-blur-xl overflow-hidden">
        <div className="grid gap-8 lg:grid-cols-[1.3fr_0.9fr] p-8 md:p-10">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-c-accent bg-c-accent-soft text-xs font-black uppercase tracking-[0.18em] text-c-accent">
              <Sparkles size={12} />
              <span>{t('landing.narrativeCta.badge', 'Choose your entry path')}</span>
            </div>

            <h2 className="mt-5 text-3xl md:text-4xl font-black tracking-tight text-c-text leading-tight">
              {t(
                'landing.narrativeCta.heading',
                'Move from category clarity to your first value moment.'
              )}
            </h2>

            <p className="mt-4 max-w-2xl text-sm md:text-base leading-relaxed text-c-text-secondary">
              {t(
                'landing.narrativeCta.sub',
                'Start with Anna if you want guided orientation, try the demo if you want to explore the platform, or launch a trial when you are ready to apply consulting intelligence to your own organization.'
              )}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onAnnaClick}
                className="inline-flex items-center gap-2 rounded-full border border-c-accent bg-c-accent-soft px-4 py-2.5 text-sm font-semibold text-c-accent transition-all duration-200 hover:bg-c-accent-soft"
              >
                <Sparkles size={14} />
                <span>{t('landing.narrativeCta.askAnna', 'Ask Anna first')}</span>
              </button>

              <button
                type="button"
                onClick={onDemoClick}
                className="inline-flex items-center gap-2 rounded-full border border-c-border bg-c-surface px-4 py-2.5 text-sm font-semibold text-c-text transition-all duration-200 hover:bg-c-surface-raised"
              >
                <Play size={14} className="text-c-text-muted" fill="currentColor" />
                <span>{t('landing.narrativeCta.tryDemo', 'Try demo')}</span>
              </button>

              <button
                type="button"
                onClick={onTrialClick}
                className="inline-flex items-center gap-2 rounded-full bg-c-accent px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_36px_-14px_rgba(165,28,48,0.7)] transition-all duration-200 hover:shadow-[0_0_42px_-12px_rgba(165,28,48,0.82)]"
              >
                <span>{t('landing.narrativeCta.startTrial', 'Start trial')}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          <div className="rounded-[28px] border border-c-border bg-c-surface p-6">
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
                  className="rounded-2xl border border-c-border bg-c-surface-raised px-4 py-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-c-accent bg-c-accent-soft text-[11px] font-black text-c-accent">
                      {index + 1}
                    </div>
                    <p className="text-sm leading-relaxed text-c-text-secondary">
                      {point}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-c-success/20 bg-c-success/10 px-4 py-3 text-xs font-medium text-c-success">
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
