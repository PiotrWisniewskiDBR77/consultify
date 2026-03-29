import { motion } from 'framer-motion';
import {
  BarChart3,
  Brain,
  CheckCircle2,
  FileText,
  Layers,
  MessageSquare,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

const features = [
  {
    icon: Brain,
    accentColor: '#7c3aed',
    glowColor: 'rgba(124,58,237,0.25)',
    badge: 'AI Core',
    title: 'Strategic AI Advisor',
    description:
      'AI analyzes your organization, identifies gaps, and generates a prioritized strategic roadmap — in minutes, not months.',
    highlights: ['Diagnostic Assessment', 'Gap Analysis', 'Benchmark vs. Industry'],
  },
  {
    icon: BarChart3,
    accentColor: '#0891b2',
    glowColor: 'rgba(8,145,178,0.22)',
    badge: 'Economics',
    title: 'Financial Modeling & ROI',
    description:
      'Build business cases, model NPV / IRR scenarios, and track actual vs. projected returns across every initiative.',
    highlights: ['NPV / IRR Modeling', 'Sensitivity Analysis', 'Live ROI Tracking'],
  },
  {
    icon: Layers,
    accentColor: '#059669',
    glowColor: 'rgba(5,150,105,0.22)',
    badge: 'Execution',
    title: 'Initiative Management',
    description:
      'Turn strategy into execution. Manage workstreams, milestones, and governance — with AI nudging you toward impact.',
    highlights: ['Initiative Roadmap', 'Human Approval Gates', 'Risk Flagging'],
  },
  {
    icon: FileText,
    accentColor: '#c026d3',
    glowColor: 'rgba(192,38,211,0.22)',
    badge: 'Deliverables',
    title: 'Report & Presentation Builder',
    description:
      'Generate board-ready reports and investor decks from your live data. One click from analysis to polished output.',
    highlights: ['Auto-Generated Decks', 'Narrative Engine', 'Source Traceability'],
  },
  {
    icon: MessageSquare,
    accentColor: '#d97706',
    glowColor: 'rgba(217,119,6,0.20)',
    badge: 'Chat',
    title: 'AI Expert Interview',
    description:
      'Ask anything about your business context. AI draws on 10,000+ frameworks and your internal data to answer precisely.',
    highlights: ['Context-Aware Chat', 'Framework Library', 'Cited Answers'],
  },
  {
    icon: TrendingUp,
    accentColor: '#0d9488',
    glowColor: 'rgba(13,148,136,0.22)',
    badge: 'Results',
    title: 'Impact Tracking',
    description:
      'Connect initiatives to real KPIs. Measure actual delivered value and automatically flag deviations before they become problems.',
    highlights: ['KPI Dashboard', 'Deviation Alerts', 'Value Attribution'],
  },
];

export const WhereItHappensSection: React.FC = () => {
  const { t } = useTranslation();

  return (
    <section className="py-24 px-6 relative z-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary-500/30 bg-primary-600/10 mb-5"
          >
            <Zap size={12} className="text-primary-300" />
            <span className="text-xs font-bold text-primary-300 uppercase tracking-wider">
              {t('landing.whereItHappens.badge', 'What Consultify does')}
            </span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            viewport={{ once: true }}
            className="text-4xl lg:text-5xl font-black text-white tracking-tight mb-4"
          >
            {t(
              'landing.whereItHappens.heading',
              'Consultify brings consulting knowledge, frameworks, execution, and deliverables into one working environment.'
            )}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.16 }}
            viewport={{ once: true }}
            className="text-base text-white/50 font-medium max-w-2xl mx-auto"
          >
            {t(
              'landing.whereItHappens.sub',
              'This is the Consulting Intelligence Platform in practice: not just AI answers, but a structured consulting workflow from diagnosis through results.'
            )}
          </motion.p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.07, duration: 0.35 }}
                className="group relative p-6 rounded-2xl transition-all duration-300 hover:scale-[1.02]"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.02)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow =
                    `0 0 40px -12px ${feature.glowColor}, inset 0 0 0 1px rgba(255,255,255,0.06)`;
                  (e.currentTarget as HTMLDivElement).style.borderColor =
                    `${feature.accentColor}40`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow =
                    'inset 0 0 0 1px rgba(255,255,255,0.02)';
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.08)';
                }}
              >
                {/* Icon */}
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                  style={{
                    background: `${feature.accentColor}18`,
                    border: `1px solid ${feature.accentColor}30`,
                  }}
                >
                  <Icon size={20} style={{ color: feature.accentColor }} strokeWidth={2} />
                </div>

                {/* Badge */}
                <div className="mb-2">
                  <span
                    className="text-[9px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded"
                    style={{
                      background: `${feature.accentColor}18`,
                      color: feature.accentColor,
                    }}
                  >
                    {feature.badge}
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-base font-black text-white mb-2 leading-tight">
                  {feature.title}
                </h3>

                {/* Description */}
                <p className="text-sm text-white/45 leading-relaxed mb-4">{feature.description}</p>

                {/* Highlights */}
                <div className="space-y-1.5">
                  {feature.highlights.map((h) => (
                    <div key={h} className="flex items-center gap-2">
                      <CheckCircle2
                        size={12}
                        style={{ color: feature.accentColor }}
                        className="shrink-0"
                      />
                      <span className="text-xs text-white/50 font-medium">{h}</span>
                    </div>
                  ))}
                </div>

                {/* Corner glow */}
                <div
                  aria-hidden
                  className="absolute top-0 right-0 w-28 h-28 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{
                    background: `radial-gradient(circle, ${feature.glowColor} 0%, transparent 70%)`,
                    transform: 'translate(30%, -30%)',
                    filter: 'blur(20px)',
                  }}
                />
              </motion.div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="text-center mt-14"
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs text-white/35 font-medium"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <Target size={12} className="text-primary-400" />
            {t(
              'landing.whereItHappens.closingNote',
              'One category promise, one product surface, one path from understanding to measurable results.'
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default WhereItHappensSection;
