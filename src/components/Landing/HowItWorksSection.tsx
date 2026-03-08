import { motion } from 'framer-motion';
import { Brain, CheckCircle2, Cpu, FileText, Play, TrendingUp, Zap } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const steps = [
  {
    number: '01',
    icon: FileText,
    color: '#7c3aed',
    glow: 'rgba(124,58,237,0.30)',
    title: 'Feed the relevant data',
    description:
      'Upload documents, connect your data sources, or simply describe your challenge. Consultify absorbs your full context — financials, org structure, market position — in seconds.',
  },
  {
    number: '02',
    icon: Brain,
    color: '#a855f7',
    glow: 'rgba(168,85,247,0.28)',
    title: 'AI instantly understands the full picture',
    description:
      'LLMind — our proprietary AI engine — cross-references your data against 1,000+ real consulting engagements and every frontier model to map gaps, risks, and opportunities.',
  },
  {
    number: '03',
    icon: CheckCircle2,
    color: '#06b6d4',
    glow: 'rgba(6,182,212,0.25)',
    title: 'You receive a bulletproof plan with clear numbers',
    description:
      'A complete strategic roadmap with prioritized initiatives, NPV/IRR projections, timelines, and dependencies. Board-ready from the first output.',
  },
  {
    number: '04',
    icon: Zap,
    color: '#10b981',
    glow: 'rgba(16,185,129,0.25)',
    title: 'Execute with AI guiding every step',
    description:
      'Manage workstreams, assign tasks, and track milestones. AI flags risks before they become problems and nudges your team toward impact at every decision point.',
  },
  {
    number: '05',
    icon: TrendingUp,
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.25)',
    title: 'Watch the results appear',
    description:
      'Live KPI tracking connects every initiative to real business outcomes. See NPV delivered vs. projected, flag deviations instantly, and report results to stakeholders automatically.',
  },
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
            <Play size={11} className="text-cyan-400" fill="currentColor" />
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
              {t('landing.howItWorks.badge', 'How it works')}
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            viewport={{ once: true }}
            className="text-4xl lg:text-5xl font-black text-white tracking-tight mb-4"
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
            className="text-base text-white/50 max-w-xl mx-auto"
          >
            {t(
              'landing.howItWorks.sub',
              'No consulting firm. No 6-month project. Just intelligence turning into action.'
            )}
          </motion.p>
        </div>

        {/* Timeline */}
        <div className="grid lg:grid-cols-5 gap-4 mb-20">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isActive = activeStep === idx;
            return (
              <motion.button
                key={idx}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.08 }}
                onClick={() => setActiveStep(idx)}
                className="text-left p-5 rounded-2xl transition-all duration-300"
                style={{
                  background: isActive
                    ? `rgba(${step.color
                        .replace('#', '')
                        .match(/.{2}/g)
                        ?.map((h) => parseInt(h, 16))
                        .join(',')},0.12)`
                    : 'rgba(255,255,255,0.03)',
                  border: isActive
                    ? `1px solid ${step.color}50`
                    : '1px solid rgba(255,255,255,0.07)',
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

                <h3 className="text-sm font-black text-white leading-snug mb-2">{step.title}</h3>
                <p className="text-xs text-white/45 leading-relaxed">{step.description}</p>
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
          className="relative rounded-2xl p-8 md:p-10 overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(124,58,237,0.25)',
          }}
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
                <Cpu size={18} className="text-primary-400" />
                <span className="text-xs font-black text-primary-400 uppercase tracking-widest">
                  {t('landing.howItWorks.techBadge', 'The technology behind the magic')}
                </span>
              </div>
              <h3 className="text-2xl font-black text-white mb-4 leading-tight">
                {t(
                  'landing.howItWorks.techTitle',
                  'Powered by every frontier LLM + our proprietary LLMind.'
                )}
              </h3>
              <p className="text-sm text-white/55 leading-relaxed">
                {t(
                  'landing.howItWorks.techDesc',
                  'Built on Microsoft infrastructure and trained on 1,000+ real consulting engagements. Full MCP integration for true end-to-end automation — from data ingestion to board presentation.'
                )}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'LLMind™', desc: 'Proprietary consulting AI', color: '#7c3aed' },
                { label: 'MCP Integration', desc: 'Full end-to-end automation', color: '#06b6d4' },
                { label: 'All Frontier LLMs', desc: 'GPT-4o, Claude, Gemini+', color: '#a855f7' },
                {
                  label: '1,000+ Engagements',
                  desc: 'Real consulting training data',
                  color: '#10b981',
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="p-4 rounded-xl"
                  style={{
                    background: `${item.color}10`,
                    border: `1px solid ${item.color}25`,
                  }}
                >
                  <div className="text-sm font-black text-white mb-0.5">{item.label}</div>
                  <div className="text-[11px] text-white/40 leading-snug">{item.desc}</div>
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
