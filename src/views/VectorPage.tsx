import { motion } from 'framer-motion';
import {
  ArrowRight,
  BrainCircuit,
  ChartNoAxesCombined,
  CircuitBoard,
  Cpu,
  Database,
  Download,
  Factory,
  FlaskConical,
  Layers,
  Network,
  Rocket,
  ScanSearch,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { AnnaAssistantWidget } from '../components/Landing/AnnaAssistantWidget';
import { EntryFooter } from '../components/Landing/EntryFooter';
import { EntryTopBar } from '../components/Landing/EntryTopBar';

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.55 },
};

const PIPELINE_STEPS = [
  {
    num: '01',
    icon: Database,
    title: 'Context Construction',
    body: 'Raw telemetry from ERP, WMS and IoT systems is normalized into a structured operational representation with process flows, constraints and baseline metrics.',
  },
  {
    num: '02',
    icon: ChartNoAxesCombined,
    title: 'Baseline Quantization',
    body: 'Operational indicators derived from ISO 22400-2 establish a rigorous "As-Is" state — cycle times, FTE allocations, OEE baselines.',
  },
  {
    num: '03',
    icon: ScanSearch,
    title: 'Causal Structural Analysis',
    body: 'The engine identifies latent root causes of inefficiencies and their interdependencies through automated planning logic — not surface-level pattern matching.',
  },
  {
    num: '04',
    icon: Target,
    title: 'Action Plan Construction',
    body: 'Interventions are sequenced for maximum feasibility, respecting resource availability, technical dependencies, and operational constraints.',
  },
  {
    num: '05',
    icon: TrendingUp,
    title: 'Executive Financial Evaluation',
    body: 'Every technical intervention is translated into balance-sheet impact — ROI projections, CAPEX/OPEX trajectories, payback period estimations.',
  },
  {
    num: '06',
    icon: Layers,
    title: 'Structured Decision Artifact',
    body: 'The output is not prose — it is a complete, defensible business case with diagnostic summary, prioritized action plan and financial projections.',
  },
];

const COMPARISON_ROWS = [
  {
    dimension: 'Training data',
    vector: '1,400+ authenticated industrial case studies + Digital Twin synthetic data',
    generic: 'Internet-scale text corpora with no industrial grounding',
  },
  {
    dimension: 'Reasoning logic',
    vector: 'MTM, Lean, ISO 22400-2 embedded as reasoning primitives',
    generic: 'Linguistic heuristics — no factory physics awareness',
  },
  {
    dimension: 'Output type',
    vector: 'Structured Decision Object — diagnosis + action plan + financials',
    generic: 'Free-form text responses',
  },
  {
    dimension: 'Validation',
    vector: 'Post-inference validation layer with hallucination mitigation',
    generic: 'No built-in industrial validation',
  },
  {
    dimension: 'Client data usage',
    vector: 'Never used for training — queries not stored beyond session',
    generic: 'May be used for model improvement unless opted out',
  },
  {
    dimension: 'Deployment',
    vector: 'On-premise, private API, or shared — client chooses',
    generic: 'Provider cloud only — limited residency control',
  },
];

const ROADMAP_STAGES = [
  {
    stage: 1,
    title: 'Analytical Systems',
    body: 'Digitization of telemetry. Human decision-making remains dominant.',
    status: 'done' as const,
  },
  {
    stage: 2,
    title: 'Decision Support',
    body: 'AI-generated structured recommendations validated by human experts. Vector 1.0 operates here.',
    status: 'current' as const,
  },
  {
    stage: 3,
    title: 'Constrained Automation',
    body: 'AI autonomously executes predefined, low-risk interventions within controlled parameters.',
    status: 'next' as const,
  },
  {
    stage: 4,
    title: 'Autonomous Decision Systems',
    body: 'Fully closed-loop environment with real-time feedback and iterative learning.',
    status: 'future' as const,
  },
];

const ECOSYSTEM_LAYERS = [
  { icon: CircuitBoard, label: 'Industrial IoT', sub: 'Data Layer' },
  { icon: FlaskConical, label: 'Digital Twin', sub: 'Simulation Layer' },
  { icon: BrainCircuit, label: 'DBR77 Vector', sub: 'Decision Layer' },
  { icon: Network, label: 'IRIS', sub: 'Operating System' },
  { icon: Factory, label: 'Marketplace', sub: 'Execution Layer' },
];

export const VectorPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleTrialClick = () => navigate('/trial/start');
  const handleDemoClick = () => navigate('/demo');
  const handleContactClick = () => navigate('/contact');

  return (
    <div className="min-h-screen bg-white dark:bg-navy-950 flex flex-col">
      <EntryTopBar
        onTrialClick={handleTrialClick}
        onDemoClick={handleDemoClick}
        onLoginClick={() => navigate('/login')}
        isLoggedIn={false}
        hasWorkspace={false}
      />

      {/* ── Hero ── */}
      <section className="pt-32 pb-20 px-6 bg-gradient-to-b from-indigo-50 to-white dark:from-navy-900 dark:to-navy-950">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div {...fadeUp}>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-sm font-semibold mb-6">
              <BrainCircuit size={16} />
              {t('vector.hero.badge', 'Industrial Reasoning Engine')}
            </span>

            <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-black text-navy-950 dark:text-white mb-6 tracking-tight leading-[1.1]">
              {t('vector.hero.title', "The world's first AI that")}{' '}
              <span className="bg-gradient-to-r from-primary-600 to-primary-600 bg-clip-text text-transparent">
                {t('vector.hero.titleHighlight', 'reasons like an industrial engineer.')}
              </span>
            </h1>

            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed">
              {t(
                'vector.hero.subtitle',
                'DBR77 Vector 1.0 transforms raw factory data into structured, executable business decisions in under 120 seconds — achieving 94% parity with senior human consultants in double-blind benchmarks.'
              )}
            </p>

            <div className="flex flex-wrap justify-center gap-4 mt-10">
              <a
                href="/assets/docs/dbr77-vector-whitepaper-v1.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-white transition-all"
                style={{
                  background: 'linear-gradient(135deg, #A51C30, #651120)',
                  boxShadow: '0 0 24px -8px rgba(165,28,48,0.60)',
                }}
              >
                <Download size={16} />
                {t('vector.hero.downloadCta', 'Download Whitepaper')}
              </a>
              <button
                onClick={handleDemoClick}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold border border-slate-200 dark:border-white/12 text-slate-700 dark:text-white/70 hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
              >
                {t('vector.hero.demoCta', 'Book a Demo')}
                <ArrowRight size={15} />
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Beyond Generative AI ── */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-navy-950 dark:text-white tracking-tight">
              {t('vector.beyond.title', 'Beyond Generative AI')}
            </h2>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              {t(
                'vector.beyond.subtitle',
                'Manufacturing faces a "Data-Rich, Decision-Poor" paradox. Vector bridges the gap that generic AI cannot.'
              )}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Factory,
                accent: 'from-danger-500 to-amber-500',
                title: t('vector.beyond.problem.title', 'The Problem'),
                body: t(
                  'vector.beyond.problem.body',
                  "Factories generate exascale telemetry, yet optimization depends on slow, high-latency human analysis. The bottleneck is no longer data — it's the absence of decision systems."
                ),
              },
              {
                icon: Sparkles,
                accent: 'from-slate-400 to-slate-500',
                title: t('vector.beyond.generic.title', 'Generic LLMs'),
                body: t(
                  'vector.beyond.generic.body',
                  'GPT and other LLMs are "industrial-blind." They lack grounding in factory physics, MTM motion analysis and operational constraints. Their outputs are linguistically fluent but operationally irrelevant.'
                ),
              },
              {
                icon: BrainCircuit,
                accent: 'from-primary-500 to-primary-600',
                title: t('vector.beyond.vector.title', 'DBR77 Vector'),
                body: t(
                  'vector.beyond.vector.body',
                  'The first Industrial Reasoning Engine. Trained on 1,400+ authenticated transformation cases. Constructs structured decisions — not text. Embeds MTM, Lean and ISO 22400-2 as reasoning primitives.'
                ),
              },
            ].map((card, idx) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: idx * 0.1 }}
                  className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] p-7"
                >
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${card.accent} text-white shadow-lg mb-5`}
                  >
                    <Icon size={22} />
                  </div>
                  <h3 className="text-lg font-black text-navy-950 dark:text-white mb-2">
                    {card.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {card.body}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How Vector Thinks — Pipeline ── */}
      <section className="py-20 px-6 bg-slate-50 dark:bg-navy-900/40">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-xs font-bold uppercase tracking-widest mb-4">
              <Cpu size={14} />
              {t('vector.pipeline.badge', 'Decision Architecture')}
            </span>
            <h2 className="text-3xl md:text-4xl font-black text-navy-950 dark:text-white tracking-tight">
              {t('vector.pipeline.title', 'How Vector Thinks')}
            </h2>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              {t(
                'vector.pipeline.subtitle',
                'A six-stage reasoning pipeline that transforms raw industrial context into structured, executable decisions.'
              )}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {PIPELINE_STEPS.map((step, idx) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.num}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: idx * 0.07 }}
                  className="relative rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] p-6"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-xs font-black text-primary-500 bg-primary-100 dark:bg-primary-900/30 rounded-lg px-2.5 py-1">
                      {step.num}
                    </span>
                    <Icon size={18} className="text-slate-600 dark:text-slate-500" />
                  </div>
                  <h3 className="text-base font-black text-navy-950 dark:text-white mb-2">
                    {t(`vector.pipeline.steps.${step.num}.title`, step.title)}
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {t(`vector.pipeline.steps.${step.num}.body`, step.body)}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── The Numbers ── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black text-navy-950 dark:text-white tracking-tight">
              {t('vector.numbers.title', 'The Numbers')}
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                value: '94%',
                label: t('vector.numbers.parity', 'Parity with senior consultants'),
                sub: '30/39 vs 32/39 DUS',
              },
              {
                value: '<120s',
                label: t('vector.numbers.speed', 'Analysis time'),
                sub: t('vector.numbers.speedSub', 'vs weeks of manual work'),
              },
              {
                value: '1,400+',
                label: t('vector.numbers.cases', 'Authenticated case studies'),
                sub: t('vector.numbers.casesSub', 'Proprietary training corpus'),
              },
              {
                value: '~20B',
                label: t('vector.numbers.params', 'Model parameters'),
                sub: t('vector.numbers.paramsSub', '+ QLoRA domain adapter'),
              },
            ].map((stat, idx) => (
              <motion.div
                key={stat.value}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.08 }}
                className="text-center rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] p-8"
              >
                <p className="text-4xl md:text-5xl font-black bg-gradient-to-r from-primary-600 to-primary-600 bg-clip-text text-transparent mb-2">
                  {stat.value}
                </p>
                <p className="text-sm font-bold text-navy-950 dark:text-white">{stat.label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">{stat.sub}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Vector vs Generic LLM ── */}
      <section className="py-20 px-6 bg-slate-50 dark:bg-navy-900/40">
        <div className="max-w-5xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black text-navy-950 dark:text-white tracking-tight">
              {t('vector.comparison.title', 'Vector vs. Generic LLMs')}
            </h2>
            <p className="mt-4 text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
              {t(
                'vector.comparison.subtitle',
                'Purpose-built industrial reasoning vs. general-purpose language generation.'
              )}
            </p>
          </motion.div>

          <motion.div
            {...fadeUp}
            className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/[0.08]"
          >
            <table
              /* §27-exempt: layout specjalizowany/read-only/data-viz, nie kanoniczna lista przegladana */ className="w-full text-sm"
            >
              <thead>
                <tr className="bg-slate-100 dark:bg-white/[0.04]">
                  <th className="text-left px-6 py-4 font-bold text-navy-950 dark:text-white">
                    {t('vector.comparison.dimensionHeader', 'Dimension')}
                  </th>
                  <th className="text-left px-6 py-4 font-bold text-primary-600 dark:text-primary-400">
                    {t('vector.comparison.vectorHeader', 'DBR77 Vector')}
                  </th>
                  <th className="text-left px-6 py-4 font-bold text-slate-500">
                    {t('vector.comparison.genericHeader', 'Generic LLM')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, idx) => (
                  <tr
                    key={row.dimension}
                    className={
                      idx % 2 === 0
                        ? 'bg-white dark:bg-transparent'
                        : 'bg-slate-50/50 dark:bg-white/[0.02]'
                    }
                  >
                    <td className="px-6 py-4 font-semibold text-navy-950 dark:text-white whitespace-nowrap">
                      {t(`vector.comparison.rows.${idx}.dimension`, row.dimension)}
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                      {t(`vector.comparison.rows.${idx}.vector`, row.vector)}
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-500">
                      {t(`vector.comparison.rows.${idx}.generic`, row.generic)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </div>
      </section>

      {/* ── Roadmap ── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black text-navy-950 dark:text-white tracking-tight">
              {t('vector.roadmap.title', 'From Decision Support to Autonomy')}
            </h2>
            <p className="mt-4 text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              {t(
                'vector.roadmap.subtitle',
                'A four-stage evolutionary trajectory toward fully autonomous industrial systems.'
              )}
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {ROADMAP_STAGES.map((stage, idx) => (
              <motion.div
                key={stage.stage}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                className={`relative rounded-2xl p-6 border ${
                  stage.status === 'current'
                    ? 'border-primary-400 dark:border-primary-500/50 bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-400/30'
                    : 'border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02]'
                }`}
              >
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider mb-4 ${
                    stage.status === 'done'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                      : stage.status === 'current'
                        ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400'
                        : 'bg-slate-100 dark:bg-white/[0.04] text-slate-500'
                  }`}
                >
                  {t(`vector.roadmap.stages.${stage.stage}.label`, `Stage ${stage.stage}`)}
                  {stage.status === 'current' && ` — ${t('vector.roadmap.now', 'Now')}`}
                  {stage.status === 'done' && ` — ${t('vector.roadmap.done', 'Done')}`}
                </span>
                <h3 className="text-base font-black text-navy-950 dark:text-white mb-2">
                  {t(`vector.roadmap.stages.${stage.stage}.title`, stage.title)}
                </h3>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {t(`vector.roadmap.stages.${stage.stage}.body`, stage.body)}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Ecosystem ── */}
      <section className="py-20 px-6 bg-navy-950 text-white">
        <div className="max-w-5xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">
              {t('vector.ecosystem.title', 'Part of a Complete Industrial Ecosystem')}
            </h2>
            <p className="mt-4 text-lg text-white/50 max-w-2xl mx-auto">
              {t(
                'vector.ecosystem.subtitle',
                'Vector is not a standalone tool. It is the cognitive kernel of the DBR77 Industrial AI Operating System.'
              )}
            </p>
          </motion.div>

          <div className="flex flex-col md:flex-row items-stretch gap-3">
            {ECOSYSTEM_LAYERS.map((layer, idx) => {
              const Icon = layer.icon;
              const isVector = idx === 2;
              return (
                <motion.div
                  key={layer.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: idx * 0.08 }}
                  className={`flex-1 rounded-2xl p-6 text-center border ${
                    isVector
                      ? 'border-primary-500/50 bg-primary-600/15 ring-1 ring-primary-500/30'
                      : 'border-white/[0.08] bg-white/[0.03]'
                  }`}
                >
                  <div
                    className={`mx-auto flex h-12 w-12 items-center justify-center rounded-xl mb-4 ${
                      isVector
                        ? 'bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg shadow-primary-500/30'
                        : 'bg-white/[0.06]'
                    }`}
                  >
                    <Icon size={22} className={isVector ? 'text-white' : 'text-white/50'} />
                  </div>
                  <p
                    className={`text-sm font-black ${isVector ? 'text-primary-300' : 'text-white/70'}`}
                  >
                    {t(`vector.ecosystem.layers.${idx}.label`, layer.label)}
                  </p>
                  <p className="text-xs text-white/35 mt-1">
                    {t(`vector.ecosystem.layers.${idx}.sub`, layer.sub)}
                  </p>
                  {idx < ECOSYSTEM_LAYERS.length - 1 && (
                    <div className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2">
                      <ArrowRight size={14} className="text-white/20" />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div {...fadeUp}>
            <Rocket size={32} className="mx-auto text-primary-500 mb-6" />
            <h2 className="text-3xl font-black text-navy-950 dark:text-white mb-4">
              {t('vector.cta.title', 'Ready to see industrial reasoning in action?')}
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-xl mx-auto">
              {t(
                'vector.cta.subtitle',
                'Download the full whitepaper for technical depth, or book a live demo to see Vector analyze a real industrial scenario.'
              )}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="/assets/docs/dbr77-vector-whitepaper-v1.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-sm font-semibold text-white transition-all"
                style={{
                  background: 'linear-gradient(135deg, #A51C30, #651120)',
                  boxShadow: '0 0 24px -8px rgba(165,28,48,0.60)',
                }}
              >
                <Download size={16} />
                {t('vector.cta.download', 'Download Whitepaper (PDF)')}
              </a>
              <button
                onClick={handleDemoClick}
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-sm font-semibold border border-slate-200 dark:border-white/12 text-slate-700 dark:text-white/70 hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
              >
                <Zap size={16} />
                {t('vector.cta.demo', 'Book a Live Demo')}
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      <EntryFooter />
      <AnnaAssistantWidget
        onDemoClick={handleDemoClick}
        onTrialClick={handleTrialClick}
        onContactClick={handleContactClick}
      />
    </div>
  );
};

export default VectorPage;
