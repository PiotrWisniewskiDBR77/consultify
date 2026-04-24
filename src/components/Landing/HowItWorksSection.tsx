import { motion } from 'framer-motion';
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  Cpu,
  FileText,
  Play,
  TrendingUp,
  Zap,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const STEP_KEYS = [
  'feedData',
  'aiUnderstands',
  'bulletproofPlan',
  'executeWithAI',
  'watchResults',
] as const;

const STEP_VISUALS = [
  { number: '01', icon: FileText, color: '#7c3aed', glow: 'rgba(124,58,237,0.30)' },
  { number: '02', icon: Brain, color: '#a855f7', glow: 'rgba(168,85,247,0.28)' },
  { number: '03', icon: CheckCircle2, color: '#06b6d4', glow: 'rgba(6,182,212,0.25)' },
  { number: '04', icon: Zap, color: '#10b981', glow: 'rgba(16,185,129,0.25)' },
  { number: '05', icon: TrendingUp, color: '#f59e0b', glow: 'rgba(245,158,11,0.25)' },
];

export const HowItWorksSection: React.FC = () => {
  const { t } = useTranslation();
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section className="py-24 px-6 relative z-10">
      {/* Subtle top separator */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.25), transparent)',
        }}
      />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 mb-5"
          >
            <Play size={11} className="text-cyan-600 dark:text-cyan-400" fill="currentColor" />
            <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
              {t('landing.howItWorks.badge', 'How it works')}
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            viewport={{ once: true }}
            className="text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-4"
          >
            {t('landing.howItWorks.heading', 'From idea to measurable results')}
            <span
              className="block"
              style={{
                background: 'linear-gradient(90deg, #a78bfa, #67e8f9)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {t('landing.howItWorks.headingAccent', 'in five moves.')}
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.16 }}
            viewport={{ once: true }}
            className="text-base text-slate-500 dark:text-white/50 max-w-xl mx-auto"
          >
            {t(
              'landing.howItWorks.sub',
              'No consulting firm. No 6-month project. Just intelligence turning into action.'
            )}
          </motion.p>
        </div>

        {/* Timeline */}
        <div className="grid lg:grid-cols-5 gap-4 mb-20">
          {STEP_KEYS.map((key, idx) => {
            const step = STEP_VISUALS[idx];
            const Icon = step.icon;
            const isActive = activeStep === idx;
            const prefix = `landing.howItWorks.steps.${key}`;
            return (
              <motion.button
                key={key}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.08 }}
                onClick={() => setActiveStep(idx)}
                className={`text-left p-5 rounded-2xl transition-all duration-300 ${
                  isActive
                    ? ''
                    : 'bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07]'
                }`}
                style={{
                  background: isActive
                    ? `rgba(${step.color
                        .replace('#', '')
                        .match(/.{2}/g)
                        ?.map((h) => parseInt(h, 16))
                        .join(',')},0.12)`
                    : undefined,
                  border: isActive ? `1px solid ${step.color}50` : undefined,
                  boxShadow: isActive ? `0 0 30px -10px ${step.glow}` : 'none',
                }}
              >
                {/* Number + Icon row */}
                <div className="flex items-center justify-between mb-4">
                  <span
                    className="text-[11px] font-black uppercase tracking-widest"
                    style={{ color: step.color }}
                  >
                    {step.number}
                  </span>
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: `${step.color}18`, border: `1px solid ${step.color}30` }}
                  >
                    <Icon size={17} style={{ color: step.color }} />
                  </div>
                </div>

                <h3 className="text-sm font-black text-slate-900 dark:text-white leading-snug mb-2">
                  {t(`${prefix}.title`)}
                </h3>
                <p className="text-xs text-slate-500 dark:text-white/45 leading-relaxed">
                  {t(`${prefix}.description`)}
                </p>
              </motion.button>
            );
          })}
        </div>

        {/* Technology block */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative rounded-2xl p-8 md:p-10 overflow-hidden bg-slate-50 dark:bg-white/[0.03] border border-violet-300/25 dark:border-violet-600/25"
        >
          {/* Glow */}
          <div
            aria-hidden
            className="absolute top-0 right-0 w-72 h-72 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(124,58,237,0.20) 0%, transparent 70%)',
              filter: 'blur(40px)',
              transform: 'translate(30%, -30%)',
            }}
          />

          <div className="relative grid md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Cpu size={18} className="text-primary-600 dark:text-primary-400" />
                <span className="text-xs font-black text-primary-600 dark:text-primary-400 uppercase tracking-widest">
                  {t('landing.howItWorks.techBadge', 'The technology behind the magic')}
                </span>
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-4 leading-tight">
                {t(
                  'landing.howItWorks.techTitle',
                  'Powered by DBR77 Vector, our proprietary AI model.'
                )}
              </h3>
              <p className="text-sm text-slate-500 dark:text-white/55 leading-relaxed">
                {t(
                  'landing.howItWorks.techDesc',
                  'Built on 1,000+ real transformation engagements and delivered through secure deployment paths. DBR77 Vector is our model, not a wrapper, with MCP integration for end-to-end automation.'
                )}
              </p>
              <a
                href="https://vector.dbr77.com"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-600 dark:text-cyan-300 transition-colors hover:text-cyan-500 dark:hover:text-cyan-200"
              >
                {t('landing.howItWorks.techExplore', 'Explore DBR77 Vector')}
                <ArrowRight size={14} />
              </a>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  labelKey: 'landing.howItWorks.tech.vector',
                  descKey: 'landing.howItWorks.tech.vectorDesc',
                  color: '#7c3aed',
                },
                {
                  labelKey: 'landing.howItWorks.tech.mcp',
                  descKey: 'landing.howItWorks.tech.mcpDesc',
                  color: '#06b6d4',
                },
                {
                  labelKey: 'landing.howItWorks.tech.private',
                  descKey: 'landing.howItWorks.tech.privateDesc',
                  color: '#a855f7',
                },
                {
                  labelKey: 'landing.howItWorks.tech.engagements',
                  descKey: 'landing.howItWorks.tech.engagementsDesc',
                  color: '#10b981',
                },
              ].map((item) => (
                <div
                  key={item.labelKey}
                  className="p-4 rounded-xl"
                  style={{
                    background: `${item.color}10`,
                    border: `1px solid ${item.color}25`,
                  }}
                >
                  <div className="text-sm font-black text-slate-900 dark:text-white mb-0.5">
                    {t(item.labelKey)}
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-white/40 leading-snug">
                    {t(item.descKey)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
