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

import { MarketingLayout } from '../components/Landing/MarketingLayout';

const STEP_VISUALS = [
  { number: '01', icon: FileText, color: '#A51C30', glow: 'rgba(165,28,48,0.30)' },
  { number: '02', icon: Brain, color: '#D42B3D', glow: 'rgba(212,43,61,0.28)' },
  { number: '03', icon: CheckCircle2, color: '#3b82f6', glow: 'rgba(6,182,212,0.25)' },
  { number: '04', icon: Zap, color: '#10b981', glow: 'rgba(16,185,129,0.25)' },
  { number: '05', icon: TrendingUp, color: '#f59e0b', glow: 'rgba(245,158,11,0.25)' },
];

const TECH_VISUALS = [
  { color: '#A51C30', icon: Brain },
  { color: '#3b82f6', icon: Zap },
  { color: '#D42B3D', icon: Cpu },
  { color: '#10b981', icon: CheckCircle2 },
];

export const HowItWorksPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeStep, setActiveStep] = useState(0);

  const steps = STEP_VISUALS.map((v, i) => ({
    ...v,
    title: t(`pages.howItWorks.steps.${i}.title`),
    description: t(`pages.howItWorks.steps.${i}.description`),
    details: (() => {
      const items = t(`pages.howItWorks.steps.${i}.details`, { returnObjects: true });
      return Array.isArray(items) ? items : [];
    })(),
  }));

  const techCards = TECH_VISUALS.map((v, i) => ({
    ...v,
    label: t(`pages.howItWorks.tech.cards.${i}.label`),
    desc: t(`pages.howItWorks.tech.cards.${i}.desc`),
  }));

  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="relative px-6 pt-20 pb-24 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[linear-gradient(160deg,#0B1220_0%,#0F172A_50%,#0B1220_100%)]" />
          <div
            className="absolute -top-[20%] left-[10%] w-[50%] h-[50%] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(109,40,217,0.28) 0%, transparent 65%)',
              filter: 'blur(80px)',
            }}
          />
          <div
            className="absolute bottom-0 right-0 w-[40%] h-[40%] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(0,210,255,0.14) 0%, transparent 65%)',
              filter: 'blur(80px)',
            }}
          />
        </div>

        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary-500/30 bg-primary-600/10 mb-6"
          >
            <Play size={11} className="text-primary-300" fill="currentColor" />
            <span className="text-xs font-bold text-primary-300 uppercase tracking-wider">
              {t('pages.howItWorks.hero.badge', 'How it works')}
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className="font-black tracking-tight leading-tight text-white mb-6"
            style={{ fontSize: 'clamp(38px, 5vw, 72px)' }}
          >
            {t('pages.howItWorks.hero.titleLine1', 'From idea to measurable results.')}
            <span
              className="block"
              style={{
                background: 'linear-gradient(90deg, #D42B3D, #67e8f9)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {t('pages.howItWorks.hero.titleLine2', 'Fully automated.')}
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.14 }}
            className="text-lg text-white/55 max-w-2xl mx-auto mb-10"
          >
            {t(
              'pages.howItWorks.hero.subtitle',
              'No consulting firm. No 6-month project. No slides assembled manually at 2am. Just intelligence turning into execution and results.'
            )}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <button
              className="inline-flex items-center justify-center gap-2 px-7 py-3 rounded-full text-white font-semibold text-sm transition-all"
              style={{
                background: 'linear-gradient(135deg, #A51C30, #651120)',
                boxShadow: '0 0 40px -12px rgba(165,28,48,0.65)',
              }}
            >
              <span>{t('pages.howItWorks.hero.ctaPrimary', 'Open Demo Now')}</span>
              <ArrowRight size={15} />
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 px-7 py-3 rounded-full font-semibold text-sm text-white transition-all"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              {t('pages.howItWorks.hero.ctaSecondary', 'Launch Free Trial')}
            </button>
          </motion.div>
        </div>
      </section>

      {/* Steps */}
      <section className="px-6 pb-20">
        <div className="max-w-7xl mx-auto">
          {/* Step selector tabs */}
          <div className="flex overflow-x-auto gap-2 mb-10 pb-2">
            {steps.map((step, idx) => (
              <button
                key={idx}
                onClick={() => setActiveStep(idx)}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-200 shrink-0"
                style={{
                  background: activeStep === idx ? `${step.color}20` : 'rgba(255,255,255,0.04)',
                  border:
                    activeStep === idx
                      ? `1px solid ${step.color}45`
                      : '1px solid rgba(255,255,255,0.08)',
                  color: activeStep === idx ? step.color : 'rgba(255,255,255,0.50)',
                }}
              >
                <span className="text-[10px] font-black">{step.number}</span>
                <span>{step.title}</span>
              </button>
            ))}
          </div>

          {/* Active step detail */}
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="grid md:grid-cols-2 gap-10 p-8 rounded-2xl"
            style={{
              background: `${steps[activeStep].color}0C`,
              border: `1px solid ${steps[activeStep].color}30`,
            }}
          >
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{
                    background: `${steps[activeStep].color}18`,
                    border: `1px solid ${steps[activeStep].color}30`,
                  }}
                >
                  {React.createElement(steps[activeStep].icon, {
                    size: 22,
                    style: { color: steps[activeStep].color },
                  })}
                </div>
                <span
                  className="text-xs font-black uppercase tracking-widest"
                  style={{ color: steps[activeStep].color }}
                >
                  {steps[activeStep].number}
                </span>
              </div>
              <h2 className="text-2xl font-black text-white mb-4">{steps[activeStep].title}</h2>
              <p className="text-white/55 leading-relaxed">{steps[activeStep].description}</p>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-black text-white/30 uppercase tracking-widest mb-4">
                {t('pages.howItWorks.steps.whatYouGet', 'What you get:')}
              </p>
              {steps[activeStep].details.map((d: string) => (
                <div
                  key={d}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  <CheckCircle2
                    size={14}
                    style={{ color: steps[activeStep].color }}
                    className="shrink-0"
                  />
                  <span className="text-sm text-white/70 font-medium">{d}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Progress line */}
          <div className="flex items-center gap-2 mt-6 justify-center">
            {steps.map((step, idx) => (
              <button
                key={idx}
                onClick={() => setActiveStep(idx)}
                className="h-1 rounded-full transition-all duration-300"
                style={{
                  width: activeStep === idx ? '32px' : '8px',
                  background: activeStep === idx ? step.color : 'rgba(255,255,255,0.15)',
                }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Technology block */}
      <section className="px-6 pb-24">
        <div className="max-w-7xl mx-auto">
          <div
            className="relative rounded-2xl p-8 md:p-12 overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(165,28,48,0.25)',
            }}
          >
            <div
              aria-hidden
              className="absolute top-0 right-0 w-96 h-96 rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(circle, rgba(165,28,48,0.18) 0%, transparent 70%)',
                filter: 'blur(50px)',
                transform: 'translate(30%,-30%)',
              }}
            />

            <div className="relative grid md:grid-cols-2 gap-10 items-center">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Cpu size={18} className="text-primary-400" />
                  <span className="text-xs font-black text-primary-400 uppercase tracking-widest">
                    {t('pages.howItWorks.tech.badge', 'The technology behind the magic')}
                  </span>
                </div>
                <h2 className="text-3xl font-black text-white mb-5">
                  {t(
                    'pages.howItWorks.tech.title',
                    'Powered by DBR77 Vector, our proprietary AI model.'
                  )}
                </h2>
                <p className="text-white/55 leading-relaxed mb-6">
                  {t(
                    'pages.howItWorks.tech.description',
                    'Built on 1,000+ real transformation engagements and delivered through secure deployment options. DBR77 Vector is our model, not a wrapper, with MCP integration for end-to-end automation from data ingestion to final output.'
                  )}
                </p>
                <a
                  href="https://vector.dbr77.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold text-white transition-all"
                  style={{
                    background: 'linear-gradient(135deg, #A51C30, #651120)',
                    boxShadow: '0 0 30px -10px rgba(165,28,48,0.60)',
                  }}
                >
                  {t('pages.howItWorks.tech.cta', 'Explore DBR77 Vector')} <ArrowRight size={14} />
                </a>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {techCards.map((item) => {
                  const I = item.icon;
                  return (
                    <div
                      key={item.label}
                      className="p-5 rounded-xl"
                      style={{ background: `${item.color}10`, border: `1px solid ${item.color}25` }}
                    >
                      <I size={20} style={{ color: item.color }} className="mb-3" />
                      <div className="text-sm font-black text-white mb-1">{item.label}</div>
                      <div className="text-xs text-white/40 leading-snug">{item.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};
