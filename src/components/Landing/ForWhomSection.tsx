import { motion } from 'framer-motion';
import { BarChart3, Brain, Building2, Rocket, Users } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

const personas = [
  {
    icon: Rocket,
    color: '#7c3aed',
    glow: 'rgba(124,58,237,0.28)',
    tag: 'Founders & Owners',
    headline: 'Move fast without burning cash.',
    description:
      'You built something real. Now you need a strategy that scales it — without hiring a McKinsey team. Consultify is your always-on strategic partner: from market analysis to financial modeling to execution tracking, all in one place.',
    points: [
      'Business model stress-testing',
      'Investor-ready financial models',
      'Growth roadmap in days, not months',
    ],
  },
  {
    icon: Users,
    color: '#0891b2',
    glow: 'rgba(8,145,178,0.25)',
    tag: 'Executives & Change Leaders',
    headline: 'Lead transformation. Deliver results.',
    description:
      "You're accountable for change. Consultify gives you a structured, data-backed approach to transformation — with human governance built in. Every decision traceable, every result measured.",
    points: [
      'Organizational diagnostic',
      'Initiative portfolio management',
      'Board-ready reporting in one click',
    ],
  },
  {
    icon: Building2,
    color: '#059669',
    glow: 'rgba(5,150,105,0.25)',
    tag: 'Consulting Firms',
    headline: 'Deliver 10× the value in half the time.',
    description:
      'Stop writing the same slides in PowerPoint. Consultify automates your analysis and deliverables so your team focuses on insight and relationships — not formatting and data gathering.',
    points: [
      'White-label client workspaces',
      'Automated analysis & decks',
      'Partner program with revenue share',
    ],
  },
  {
    icon: Brain,
    color: '#c026d3',
    glow: 'rgba(192,38,211,0.25)',
    tag: 'AI-First Leaders',
    headline: 'You think in systems. We speak your language.',
    description:
      'You already know AI is the lever. Consultify is where that bet pays off — a full MCP-integrated, multi-LLM platform with proprietary consulting intelligence layered on top.',
    points: ['Full API & MCP access', 'Custom LLM routing', 'Build your own AI consulting stack'],
  },
];

export const ForWhomSection: React.FC = () => {
  const { t } = useTranslation();

  return (
    <section className="py-24 px-6 relative z-10">
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
        }}
      />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 mb-5"
          >
            <BarChart3 size={12} className="text-emerald-400" />
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
              {t('landing.forWhom.badge', 'For whom')}
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            viewport={{ once: true }}
            className="text-4xl lg:text-5xl font-black text-white tracking-tight mb-4"
          >
            {t('landing.forWhom.heading', 'Built for the ambitious.')}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.16 }}
            viewport={{ once: true }}
            className="text-base text-white/50 max-w-xl mx-auto"
          >
            {t(
              'landing.forWhom.sub',
              'Whoever you are — if results matter to you, Consultify is your co-pilot.'
            )}
          </motion.p>
        </div>

        {/* Cards grid */}
        <div className="grid md:grid-cols-2 gap-5">
          {personas.map((persona, idx) => {
            const Icon = persona.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.08 }}
                className="group relative p-7 rounded-2xl transition-all duration-300 hover:scale-[1.01]"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = `${persona.color}45`;
                  (e.currentTarget as HTMLDivElement).style.boxShadow =
                    `0 0 40px -12px ${persona.glow}`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.08)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                }}
              >
                {/* Corner glow */}
                <div
                  aria-hidden
                  className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{
                    background: `radial-gradient(circle, ${persona.glow} 0%, transparent 70%)`,
                    transform: 'translate(30%, -30%)',
                    filter: 'blur(20px)',
                  }}
                />

                <div className="relative">
                  <div className="flex items-start justify-between mb-5">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{
                        background: `${persona.color}18`,
                        border: `1px solid ${persona.color}30`,
                      }}
                    >
                      <Icon size={22} style={{ color: persona.color }} strokeWidth={2} />
                    </div>
                    <span
                      className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
                      style={{ background: `${persona.color}15`, color: persona.color }}
                    >
                      {persona.tag}
                    </span>
                  </div>

                  <h3 className="text-xl font-black text-white mb-3 leading-tight">
                    {persona.headline}
                  </h3>
                  <p className="text-sm text-white/50 leading-relaxed mb-5">
                    {persona.description}
                  </p>

                  <div className="space-y-2">
                    {persona.points.map((point) => (
                      <div key={point} className="flex items-center gap-2.5">
                        <div
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: persona.color }}
                        />
                        <span className="text-xs text-white/55 font-medium">{point}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ForWhomSection;
