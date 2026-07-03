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
  { number: '01', icon: FileText, color: '#A51C30', glow: 'rgba(165,28,48,0.30)' },
  { number: '02', icon: Brain, color: '#851627', glow: 'rgba(165,28,48,0.28)' },
  { number: '03', icon: CheckCircle2, color: '#3b82f6', glow: 'rgba(6,182,212,0.25)' },
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
          background: 'linear-gradient(90deg, transparent, rgba(165,28,48,0.25), transparent)',
        }}
      />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-c-info/30 bg-c-info/10 mb-5"
          >
            <Play size={11} className="text-c-info" fill="currentColor" />
            <span className="text-xs font-bold text-c-info uppercase tracking-wider">
              {t('landing.howItWorks.badge', 'How it works')}
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            viewport={{ once: true }}
            className="text-4xl lg:text-5xl font-black text-c-text tracking-tight mb-4"
          >
            {t('landing.howItWorks.heading', 'From idea to measurable results')}
            <span
              className="block"
              style={{
                background: 'linear-gradient(90deg, #E45868, #EF8A94)',
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
            className="text-base text-c-text-muted max-w-xl mx-auto"
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
                    : 'bg-c-surface border border-c-border'
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

                <h3 className="text-sm font-black text-c-text leading-snug mb-2">
                  {t(`${prefix}.title`)}
                </h3>
                <p className="text-xs text-c-text-muted leading-relaxed">
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
          className="relative rounded-2xl p-8 md:p-10 overflow-hidden bg-c-surface-raised border border-c-accent/25"
        >
          {/* Glow */}
          <div
            aria-hidden
            className="absolute top-0 right-0 w-72 h-72 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(165,28,48,0.20) 0%, transparent 70%)',
              filter: 'blur(40px)',
              transform: 'translate(30%, -30%)',
            }}
          />

          <div className="relative grid md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Cpu size={18} className="text-c-accent" />
                <span className="text-xs font-black text-c-accent uppercase tracking-widest">
                  {t('landing.howItWorks.techBadge', 'The technology behind the magic')}
                </span>
              </div>
              <h3 className="text-2xl font-black text-c-text mb-4 leading-tight">
                {t(
                  'landing.howItWorks.techTitle',
                  'Powered by DBR77 Vector, our proprietary AI model.'
                )}
              </h3>
              <p className="text-sm text-c-text-secondary leading-relaxed">
                {t(
                  'landing.howItWorks.techDesc',
                  'Built on 1,000+ real transformation engagements and delivered through secure deployment paths. DBR77 Vector is our model, not a wrapper, with MCP integration for end-to-end automation.'
                )}
              </p>
              <a
                href="https://vector.dbr77.com"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-c-info transition-colors hover:opacity-80"
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
                  color: '#A51C30',
                },
                {
                  labelKey: 'landing.howItWorks.tech.mcp',
                  descKey: 'landing.howItWorks.tech.mcpDesc',
                  color: '#3b82f6',
                },
                {
                  labelKey: 'landing.howItWorks.tech.private',
                  descKey: 'landing.howItWorks.tech.privateDesc',
                  color: '#851627',
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
                  <div className="text-sm font-black text-c-text mb-0.5">
                    {t(item.labelKey)}
                  </div>
                  <div className="text-[11px] text-c-text-muted leading-snug">
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
