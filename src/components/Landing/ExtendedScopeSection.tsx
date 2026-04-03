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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.04] text-xs font-bold uppercase tracking-[0.2em] text-slate-600 dark:text-white/70"
          >
            <BriefcaseBusiness size={12} className="text-primary-600 dark:text-primary-300" />
            {t('landing.extendedScope.badge', 'Beyond classic consulting')}
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            viewport={{ once: true }}
            className="mt-5 text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight"
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
            className="mt-4 text-base text-slate-500 dark:text-white/55 max-w-3xl mx-auto"
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
                className="rounded-3xl border border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.035] p-7 backdrop-blur-xl"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-primary-500/12 bg-primary-500/10">
                  <Icon size={22} className="text-primary-600 dark:text-primary-300" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3">{scope.title}</h3>
                <p className="text-sm text-slate-500 dark:text-white/58 leading-relaxed mb-5">{scope.description}</p>
                <div className="space-y-2">
                  {scope.bullets.map((bullet) => (
                    <div
                      key={bullet}
                      className="rounded-2xl border border-slate-200 dark:border-white/[0.045] bg-slate-50 dark:bg-white/[0.02] px-4 py-3 text-sm text-slate-600 dark:text-white/65 transition-colors hover:bg-slate-100 dark:hover:bg-white/[0.035]"
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
