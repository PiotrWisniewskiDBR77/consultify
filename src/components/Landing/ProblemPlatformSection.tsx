import { motion } from 'framer-motion';
import { Globe2, Lightbulb, LockKeyhole, Sparkles } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export const ProblemPlatformSection: React.FC = () => {
  const { t } = useTranslation();

  const problemPoints = [
    t(
      'landing.problemPlatform.problem.points.0',
      'World-class consulting knowledge is still expensive, fragmented, and unevenly distributed.'
    ),
    t(
      'landing.problemPlatform.problem.points.1',
      'Most teams never get structured access to the methods used by top advisory firms.'
    ),
    t(
      'landing.problemPlatform.problem.points.2',
      'That leaves critical business decisions dependent on guesswork, slides, and one-off advice.'
    ),
  ];

  const patternExamples = [
    t('landing.problemPlatform.pattern.examples.0', 'Spotify simplified access to music.'),
    t('landing.problemPlatform.pattern.examples.1', 'Uber simplified access to transport.'),
    t(
      'landing.problemPlatform.pattern.examples.2',
      'Consultify simplifies access to consulting intelligence.'
    ),
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
            <Sparkles size={12} className="text-primary-300" />
            {t('landing.problemPlatform.badge', 'Why this category matters')}
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            viewport={{ once: true }}
            className="mt-5 text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight"
          >
            {t(
              'landing.problemPlatform.heading',
              'Consulting intelligence should be accessible, not locked behind elite access.'
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
              'landing.problemPlatform.sub',
              'This is the missing narrative layer between the hero promise and the product surface: why access matters and why platform patterns win.'
            )}
          </motion.p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-3xl border border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.035] p-8 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/15 bg-amber-500/10">
                <LockKeyhole size={20} className="text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-400">
                  {t('landing.problemPlatform.problem.badge', 'Problem')}
                </p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                  {t(
                    'landing.problemPlatform.problem.title',
                    'Business knowledge is valuable, but access is still limited.'
                  )}
                </h3>
              </div>
            </div>

            <p className="text-sm text-slate-500 dark:text-white/55 leading-relaxed mb-5">
              {t(
                'landing.problemPlatform.problem.body',
                'For decades, the best consulting methods, decision frameworks, and transformation guidance were effectively reserved for the companies that could afford elite firms.'
              )}
            </p>

            <div className="space-y-3">
              {problemPoints.map((point) => (
                <div key={point} className="flex items-start gap-3">
                  <Lightbulb size={15} className="text-amber-400 mt-0.5 shrink-0" />
                  <span className="text-sm text-slate-600 dark:text-white/65 leading-relaxed">{point}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            viewport={{ once: true }}
            className="rounded-3xl border border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.035] p-8 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/15 bg-cyan-500/10">
                <Globe2 size={20} className="text-cyan-400" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-400">
                  {t('landing.problemPlatform.pattern.badge', 'Platform pattern')}
                </p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                  {t(
                    'landing.problemPlatform.pattern.title',
                    'Great platforms win by transforming access, not only by adding software.'
                  )}
                </h3>
              </div>
            </div>

            <p className="text-sm text-slate-500 dark:text-white/55 leading-relaxed mb-5">
              {t(
                'landing.problemPlatform.pattern.body',
                'The strongest category-defining platforms made scarce value simple to reach. Consultify applies that same pattern to consulting intelligence.'
              )}
            </p>

            <div className="space-y-3 mb-5">
              {patternExamples.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-slate-200 dark:border-white/[0.045] bg-slate-50 dark:bg-white/[0.02] px-4 py-3 text-sm text-slate-600 dark:text-white/65 transition-colors hover:bg-slate-100 dark:hover:bg-white/[0.035]"
                >
                  {item}
                </div>
              ))}
            </div>

            <p className="text-sm font-semibold text-primary-300">
              {t(
                'landing.problemPlatform.pattern.summary',
                'Consultify is the Consulting Intelligence Platform: Spotify for consulting knowledge, delivered as a structured consulting workflow.'
              )}
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ProblemPlatformSection;
