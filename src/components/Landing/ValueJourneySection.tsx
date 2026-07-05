import { motion } from 'framer-motion';
import { ArrowRight, Compass, Lightbulb, PlayCircle, Search, Wrench } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

const VALUE_LAYER_ICONS = [Lightbulb, Search, Wrench, Compass, PlayCircle] as const;

export const ValueJourneySection: React.FC = () => {
  const { t } = useTranslation();

  const valueLayerTranslationsRaw = t('landing.valueJourney.layers', {
    returnObjects: true,
  }) as unknown;
  const valueLayerFallback = [
    { title: 'Inspiration', description: 'Shows users new ideas, directions, and possibilities.' },
    {
      title: 'Knowledge',
      description:
        'Provides access to consulting knowledge that would otherwise be hard to obtain.',
    },
    {
      title: 'Frameworks',
      description: 'Provides strategic and analytical tools for structured thinking.',
    },
    {
      title: 'Guidance',
      description: 'Guides users through the process of building and improving a business.',
    },
    {
      title: 'Execution',
      description: 'Turns thinking into implementation, measurement, and results.',
    },
  ];
  const valueLayerTranslations = Array.isArray(valueLayerTranslationsRaw)
    ? (valueLayerTranslationsRaw as Array<{ title: string; description: string }>)
    : valueLayerFallback;

  const journeyTranslationsRaw = t('landing.valueJourney.journey', {
    returnObjects: true,
  }) as unknown;
  const journeyFallback = [
    {
      title: 'Understanding',
      description: 'Interview, context capture, and organizational understanding.',
    },
    {
      title: 'Diagnosis',
      description: 'Frameworks, assessments, and evidence-based analysis.',
    },
    {
      title: 'Designing initiatives',
      description: 'Transformation program design, priorities, and roadmap.',
    },
    {
      title: 'Execution',
      description: 'Delivery, governance, and operational follow-through.',
    },
    {
      title: 'Results',
      description: 'KPI tracking, value capture, ROI, and proof of impact.',
    },
  ];
  const journeyTranslations = Array.isArray(journeyTranslationsRaw)
    ? (journeyTranslationsRaw as Array<{ title: string; description: string }>)
    : journeyFallback;

  const valueLayers = valueLayerTranslations.map((item, index) => ({
    ...item,
    Icon: VALUE_LAYER_ICONS[index] ?? Lightbulb,
  }));

  const journey = journeyTranslations;

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
            <Compass size={12} className="text-c-accent" />
            {t('landing.valueJourney.badge', 'How the platform creates value')}
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            viewport={{ once: true }}
            className="mt-5 text-4xl lg:text-5xl font-black text-c-text tracking-tight"
          >
            {t(
              'landing.valueJourney.heading',
              'Consultify turns consulting intelligence into a structured journey from insight to results.'
            )}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.16 }}
            viewport={{ once: true }}
            className="mt-4 text-base text-c-text-muted max-w-3xl mx-auto"
          >
            {t(
              'landing.valueJourney.sub',
              'This is the value architecture and operating path behind the category: five value layers and the full consulting journey in one working environment.'
            )}
          </motion.p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-3xl border border-c-border bg-c-surface p-8 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-c-accent bg-c-accent-soft">
                <Lightbulb size={20} className="text-c-accent" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-c-accent">
                  {t('landing.valueJourney.layersBadge', 'Value layers')}
                </p>
                <h3 className="text-2xl font-black text-c-text">
                  {t(
                    'landing.valueJourney.layersTitle',
                    'Five layers of value: Inspiration -> Knowledge -> Frameworks -> Guidance -> Execution.'
                  )}
                </h3>
              </div>
            </div>

            <div className="space-y-3">
              {valueLayers.map(({ title, description }, index) => (
                <div
                  key={title}
                  className="flex gap-4 rounded-2xl border border-c-border bg-c-surface-raised p-4 backdrop-blur-sm transition-colors hover:bg-c-surface"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-c-accent bg-c-accent-soft text-sm font-black text-c-accent">
                    {index + 1}
                  </div>
                  <div>
                    <p className="mb-1 text-sm font-black text-c-text">
                      {title}
                    </p>
                    <p className="text-xs leading-relaxed text-c-text-muted">
                      {description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            viewport={{ once: true }}
            className="rounded-3xl border border-c-border bg-c-surface p-8 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-500/15 bg-blue-500/10">
                <ArrowRight size={20} className="text-blue-400" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
                  {t('landing.valueJourney.journeyBadge', 'Consulting journey')}
                </p>
                <h3 className="text-2xl font-black text-c-text">
                  {t(
                    'landing.valueJourney.journeyTitle',
                    'One platform for the full consulting journey: understanding -> diagnosis -> design -> execution -> results.'
                  )}
                </h3>
              </div>
            </div>

            <div className="space-y-3">
              {journey.map(({ title, description }, index) => (
                <div
                  key={title}
                  className="flex gap-4 rounded-2xl border border-c-border bg-c-surface-raised p-4 backdrop-blur-sm transition-colors hover:bg-c-surface"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blue-500/12 bg-blue-500/10 text-sm font-black text-blue-600 dark:text-blue-300">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-black text-c-text mb-1">
                      {title}
                    </p>
                    <p className="text-xs text-c-text-muted leading-relaxed">
                      {description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ValueJourneySection;
