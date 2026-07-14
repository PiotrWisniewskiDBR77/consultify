import { motion } from 'framer-motion';
import { BriefcaseBusiness, ChartNoAxesCombined, Presentation } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

const SCOPE_ICONS = [ChartNoAxesCombined, Presentation, BriefcaseBusiness] as const;

export const ExtendedScopeSection: React.FC = () => {
  const { t } = useTranslation();

  const scopesRaw = t('landing.extendedScope.items', { returnObjects: true }) as unknown;
  const scopes = Array.isArray(scopesRaw)
    ? (scopesRaw as Array<{ title: string; description: string; bullets: string[] }>)
    : [
        {
          title: 'Financial Intelligence',
          description:
            'Consultify extends classic consulting with financial models, analysis, valuation, and forecasting.',
          bullets: ['Financial models', 'Financial analysis', 'Company valuation', 'Forecasting'],
        },
        {
          title: 'Reports & Presentations',
          description:
            'Consultify turns live work into reports, executive presentations, and consulting deliverables.',
          bullets: ['Reports', 'Executive presentations', 'Notes'],
        },
        {
          title: 'My Work',
          description:
            'Consultify gives teams a personal and shared workspace for follow-through after strategy work starts.',
          bullets: ['Tasks', 'Decisions', 'Ideas', 'Initiatives'],
        },
      ];

  return (
    <section className="py-24 px-6 relative z-10">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-c-border bg-c-surface-raised text-xs font-bold uppercase tracking-[0.2em] text-c-text-secondary"
          >
            <BriefcaseBusiness size={12} className="text-c-accent" />
            {t('landing.extendedScope.badge', 'Beyond classic consulting')}
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            viewport={{ once: true }}
            className="mt-5 text-4xl lg:text-5xl font-black text-c-text tracking-tight"
          >
            {t(
              'landing.extendedScope.heading',
              'Consultify extends consulting into finance, deliverables, and daily execution.'
            )}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.16 }}
            viewport={{ once: true }}
            className="mt-4 text-base text-c-text-secondary max-w-3xl mx-auto"
          >
            {t(
              'landing.extendedScope.sub',
              'The platform does not stop at advisory logic. It carries strategic work into financial intelligence, executive-ready outputs, and the operating workspace where teams continue the work.'
            )}
          </motion.p>
        </div>

        <div className="grid lg:grid-cols-3 gap-5">
          {scopes.map((scope, index) => {
            const Icon = SCOPE_ICONS[index] ?? BriefcaseBusiness;
            return (
              <motion.div
                key={scope.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                viewport={{ once: true }}
                className="rounded-3xl border border-c-border bg-c-surface p-7 backdrop-blur-xl"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-c-accent/20 bg-c-accent-soft">
                  <Icon size={22} className="text-c-accent" />
                </div>
                <h3 className="text-2xl font-black text-c-text mb-3">{scope.title}</h3>
                <p className="text-sm text-c-text-secondary leading-relaxed mb-5">
                  {scope.description}
                </p>
                <div className="space-y-2">
                  {scope.bullets.map((bullet) => (
                    <div
                      key={bullet}
                      className="rounded-2xl border border-c-border bg-c-surface-raised px-4 py-3 text-sm text-c-text-secondary transition-colors hover:bg-c-surface"
                    >
                      {bullet}
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ExtendedScopeSection;
