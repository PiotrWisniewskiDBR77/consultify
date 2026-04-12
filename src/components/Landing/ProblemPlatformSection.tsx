import { motion } from 'framer-motion';
import { Globe2, Lightbulb, LockKeyhole, Sparkles } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export const ProblemPlatformSection: React.FC = () => {
  const { t } = useTranslation();

  const problemPoints = [
    t(
      'landing.problemPlatform.problem.points.0',
      'Consulting remains inaccessible to most firms.'
    ),
    t(
      'landing.problemPlatform.problem.points.1',
      'Large language models are not specialists and do not understand company context.'
    ),
    t(
      'landing.problemPlatform.problem.points.2',
      'Most AI solutions are not secure enough for real business work.'
    ),
  ];

  const patternExamples = [
    t(
      'landing.problemPlatform.pattern.examples.0',
      'Direct access to business knowledge from Harvard.'
    ),
    t(
      'landing.problemPlatform.pattern.examples.1',
      'Intelligence that works in the full context of your company, not in isolated prompts.'
    ),
    t(
      'landing.problemPlatform.pattern.examples.2',
      "Trust and security through technology tailored to your company's requirements."
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
            <Sparkles size={12} className="text-primary-600 dark:text-primary-300" />
            {t('landing.problemPlatform.badge', 'Why this category matters')}
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            viewport={{ once: true }}
            className="mt-5 font-black text-slate-900 dark:text-white tracking-tight leading-[1.05]"
            style={{ fontSize: 'clamp(32px, 5vw, 56px)' }}
          >
            {t('landing.problemPlatform.heading', 'What Spotify did for music,')}{' '}
            <span
              style={{
                background: 'linear-gradient(90deg, #a78bfa, #c084fc, #67e8f9)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {t('landing.problemPlatform.headingAccent', 'we do for consulting.')}
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.16 }}
            viewport={{ once: true }}
            className="mt-5 text-lg text-slate-500 dark:text-white/50 max-w-2xl mx-auto leading-relaxed"
          >
            {t(
              'landing.problemPlatform.sub',
              'Consulting intelligence should be accessible, not locked behind elite access.'
            )}
          </motion.p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 items-stretch">
          {/* Problem card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 backdrop-blur-xl"
          >
            <div className="flex items-start gap-4 mb-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shrink-0" style={{ boxShadow: '0 4px 20px -4px rgba(245,158,11,0.30)' }}>
                <LockKeyhole size={18} className="text-white" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400 mb-1">
                  {t('landing.problemPlatform.problem.badge', 'The market problem')}
                </p>
                <h3 className="text-lg font-bold text-white leading-snug">
                  {t(
                    'landing.problemPlatform.problem.title',
                    'Business intelligence is still inaccessible, generic, and unsafe.'
                  )}
                </h3>
              </div>
            </div>

            <p className="text-sm text-white/45 leading-relaxed mb-6">
              {t(
                'landing.problemPlatform.problem.body',
                'The market still has not turned AI and digital tools into a scalable layer for tactical and strategic business execution.'
              )}
            </p>

            <div className="grid gap-3 mt-auto auto-rows-fr">
              {problemPoints.map((point) => (
                <div
                  key={point}
                  className="flex h-full items-start gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3"
                >
                  <Lightbulb size={14} className="text-amber-400 mt-0.5 shrink-0" />
                  <span className="text-sm text-white/60 leading-relaxed">{point}</span>
                </div>
              ))}
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3">
                <p className="text-sm font-semibold text-amber-300">
                  {t('landing.problemPlatform.problem.solve', 'That is exactly the gap Consultify closes.')}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Platform pattern card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            viewport={{ once: true }}
            className="flex flex-col rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 backdrop-blur-xl"
          >
            <div className="flex items-start gap-4 mb-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shrink-0" style={{ boxShadow: '0 4px 20px -4px rgba(6,182,212,0.30)' }}>
                <Globe2 size={18} className="text-white" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400 mb-1">
                  {t('landing.problemPlatform.pattern.badge', 'The category shift')}
                </p>
                <h3 className="text-lg font-bold text-white leading-snug">
                  {t(
                    'landing.problemPlatform.pattern.title',
                    'What Spotify did for music: access, quality, and trust at scale.'
                  )}
                </h3>
              </div>
            </div>

            <p className="text-sm text-white/45 leading-relaxed mb-6">
              {t(
                'landing.problemPlatform.pattern.body',
                'Spotify did not create more music. It made great music instantly accessible, reliable, and easy to use. Consultify applies the same shift to business intelligence.'
              )}
            </p>

            <div className="grid gap-3 mt-auto auto-rows-fr">
              {patternExamples.map((item) => (
                <div
                  key={item}
                  className="flex h-full items-start rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3 text-sm text-white/60 leading-relaxed"
                >
                  {item}
                </div>
              ))}

              <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.06] px-4 py-3">
                <p className="text-sm font-semibold text-violet-300">
                  {t(
                    'landing.problemPlatform.pattern.summary',
                    'Access. Quality. Trust. That is the shift.'
                  )}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ProblemPlatformSection;
