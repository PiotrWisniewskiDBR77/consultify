import { motion } from 'framer-motion';
import { ArrowRight, Brain, CheckCircle2, Cpu, FileText, Play, TrendingUp, Zap } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { MarketingLayout } from '../components/Landing/MarketingLayout';

const steps = [
  {
    number: '01',
    icon: FileText,
    color: '#7c3aed',
    glow: 'rgba(124,58,237,0.30)',
    title: 'Feed the relevant data',
    description:
      'Upload documents, connect your data sources, or simply describe your challenge in plain language. Consultify absorbs your full context — financials, org structure, competitive position, team capabilities — in seconds. No templates, no lengthy onboarding, no consultants required.',
    details: ['Financial statements & forecasts', 'Strategic documents & meeting notes', 'Market data & competitive intel', 'CRM, ERP or any data source via API'],
  },
  {
    number: '02',
    icon: Brain,
    color: '#a855f7',
    glow: 'rgba(168,85,247,0.28)',
    title: 'AI instantly understands the full picture',
    description:
      'LLMind — our proprietary AI engine — cross-references your data against 1,000+ real consulting engagements and every frontier model to map gaps, risks, and opportunities with surgical precision. No hallucinations. Full citations.',
    details: ['Cross-referenced against 1,000+ engagements', 'Gap analysis vs. industry benchmarks', 'Risk matrix with probability scoring', 'Cited sources for every insight'],
  },
  {
    number: '03',
    icon: CheckCircle2,
    color: '#06b6d4',
    glow: 'rgba(6,182,212,0.25)',
    title: 'You receive a bulletproof plan with clear numbers',
    description:
      'A complete strategic roadmap with prioritized initiatives, NPV/IRR projections, timelines, resource requirements, and dependencies. Board-ready from the first output. Edit, refine, or regenerate in seconds.',
    details: ['NPV/IRR/Payback for every initiative', 'Gantt-style roadmap with milestones', 'Resource allocation model', 'Board-ready presentation, auto-generated'],
  },
  {
    number: '04',
    icon: Zap,
    color: '#10b981',
    glow: 'rgba(16,185,129,0.25)',
    title: 'Execute with AI guiding every step',
    description:
      'Manage workstreams, assign tasks, track milestones, and navigate governance approvals — all in one place. AI flags risks before they escalate and proactively nudges your team toward decisions that matter.',
    details: ['Workstream & task management', 'Human approval gates (governance)', 'AI risk alerts & escalation triggers', 'Integrated chat for every initiative'],
  },
  {
    number: '05',
    icon: TrendingUp,
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.25)',
    title: 'Watch the results appear',
    description:
      'Live KPI tracking connects every initiative to real business outcomes. See NPV delivered vs. projected, flag deviations instantly, and generate stakeholder reports automatically. No more manual status updates.',
    details: ['Live KPI vs. target dashboard', 'Deviation detection & alerts', 'Automatic investor/board reports', 'ROI attribution per initiative'],
  },
];

export const HowItWorksPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeStep, setActiveStep] = useState(0);

  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="relative px-6 pt-20 pb-24 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[linear-gradient(160deg,#0D0828_0%,#0A0A1F_50%,#12082E_100%)]" />
          <div className="absolute -top-[20%] left-[10%] w-[50%] h-[50%] rounded-full" style={{ background: 'radial-gradient(circle, rgba(109,40,217,0.28) 0%, transparent 65%)', filter: 'blur(80px)' }} />
          <div className="absolute bottom-0 right-0 w-[40%] h-[40%] rounded-full" style={{ background: 'radial-gradient(circle, rgba(0,210,255,0.14) 0%, transparent 65%)', filter: 'blur(80px)' }} />
        </div>

        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary-500/30 bg-primary-600/10 mb-6">
            <Play size={11} className="text-primary-300" fill="currentColor" />
            <span className="text-xs font-bold text-primary-300 uppercase tracking-wider">How it works</span>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="font-black tracking-tight leading-tight text-white mb-6" style={{ fontSize: 'clamp(38px, 5vw, 72px)' }}>
            From idea to measurable results.
            <span className="block" style={{ background: 'linear-gradient(90deg, #a78bfa, #67e8f9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Fully automated.
            </span>
          </motion.h1>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.14 }} className="text-lg text-white/55 max-w-2xl mx-auto mb-10">
            No consulting firm. No 6-month project. No slides assembled manually at 2am. Just intelligence turning into execution and results.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }} className="flex flex-col sm:flex-row gap-3 justify-center">
            <button className="inline-flex items-center justify-center gap-2 px-7 py-3 rounded-full text-white font-semibold text-sm transition-all" style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', boxShadow: '0 0 40px -12px rgba(124,58,237,0.65)' }}>
              <span>Open Demo Now</span>
              <ArrowRight size={15} />
            </button>
            <button className="inline-flex items-center justify-center gap-2 px-7 py-3 rounded-full font-semibold text-sm text-white transition-all" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)' }}>
              Launch Free Trial
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
                  border: activeStep === idx ? `1px solid ${step.color}45` : '1px solid rgba(255,255,255,0.08)',
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
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${steps[activeStep].color}18`, border: `1px solid ${steps[activeStep].color}30` }}>
                  {React.createElement(steps[activeStep].icon, { size: 22, style: { color: steps[activeStep].color } })}
                </div>
                <span className="text-xs font-black uppercase tracking-widest" style={{ color: steps[activeStep].color }}>{steps[activeStep].number}</span>
              </div>
              <h2 className="text-2xl font-black text-white mb-4">{steps[activeStep].title}</h2>
              <p className="text-white/55 leading-relaxed">{steps[activeStep].description}</p>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-black text-white/30 uppercase tracking-widest mb-4">What you get:</p>
              {steps[activeStep].details.map((d) => (
                <div key={d} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <CheckCircle2 size={14} style={{ color: steps[activeStep].color }} className="shrink-0" />
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
          <div className="relative rounded-2xl p-8 md:p-12 overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(124,58,237,0.25)' }}>
            <div aria-hidden className="absolute top-0 right-0 w-96 h-96 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)', filter: 'blur(50px)', transform: 'translate(30%,-30%)' }} />

            <div className="relative grid md:grid-cols-2 gap-10 items-center">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Cpu size={18} className="text-primary-400" />
                  <span className="text-xs font-black text-primary-400 uppercase tracking-widest">The technology behind the magic</span>
                </div>
                <h2 className="text-3xl font-black text-white mb-5">Powered by every frontier LLM + our proprietary LLMind.</h2>
                <p className="text-white/55 leading-relaxed mb-6">
                  Built on Microsoft infrastructure and trained on 1,000+ real consulting engagements. Full MCP integration for true end-to-end automation — from data ingestion to board presentation, with zero human bottlenecks.
                </p>
                <button className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold text-white transition-all" style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', boxShadow: '0 0 30px -10px rgba(124,58,237,0.60)' }}>
                  See it in action <ArrowRight size={14} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'LLMind™', desc: 'Proprietary consulting AI engine', color: '#7c3aed', icon: Brain },
                  { label: 'MCP Integration', desc: 'Full end-to-end automation', color: '#06b6d4', icon: Zap },
                  { label: 'All Frontier LLMs', desc: 'GPT-4o, Claude, Gemini+', color: '#a855f7', icon: Cpu },
                  { label: '1,000+ Engagements', desc: 'Real consulting training data', color: '#10b981', icon: CheckCircle2 },
                ].map((item) => {
                  const I = item.icon;
                  return (
                    <div key={item.label} className="p-5 rounded-xl" style={{ background: `${item.color}10`, border: `1px solid ${item.color}25` }}>
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
