import { motion } from 'framer-motion';
import { ArrowRight, BarChart3, Brain, Building2, CheckCircle2, Rocket, Users } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { MarketingLayout } from '../components/Landing/MarketingLayout';

const PERSONA_VISUALS = [
  { icon: Rocket, color: '#7c3aed', glow: 'rgba(124,58,237,0.28)' },
  { icon: Users, color: '#0891b2', glow: 'rgba(8,145,178,0.25)' },
  { icon: Building2, color: '#059669', glow: 'rgba(5,150,105,0.25)' },
  { icon: Brain, color: '#c026d3', glow: 'rgba(192,38,211,0.25)' },
];

export const ForWhomPage: React.FC = () => {
  const { t } = useTranslation();

  const personas = PERSONA_VISUALS.map((v, i) => ({
    ...v,
    tag: t(`pages.forWhom.personas.${i}.tag`),
    headline: t(`pages.forWhom.personas.${i}.headline`),
    description: t(`pages.forWhom.personas.${i}.description`),
    points: (() => {
      const items = t(`pages.forWhom.personas.${i}.points`, { returnObjects: true });
      return Array.isArray(items) ? items : [];
    })(),
  }));

  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="relative px-6 pt-20 pb-24 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[linear-gradient(160deg,#0D0828_0%,#0A0A1F_50%,#12082E_100%)]" />
          <div
            className="absolute -top-[20%] right-[10%] w-[55%] h-[55%] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(5,150,105,0.22) 0%, transparent 65%)',
              filter: 'blur(90px)',
            }}
          />
        </div>
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 mb-6"
          >
            <BarChart3 size={12} className="text-emerald-400" />
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
              {t('pages.forWhom.hero.badge', 'For whom')}
            </span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className="font-black tracking-tight text-white mb-6"
            style={{ fontSize: 'clamp(38px, 5vw, 72px)', lineHeight: 1.05 }}
          >
            {t('pages.forWhom.hero.titleLine1', 'Whoever you are, you just got')}
            <span
              className="block"
              style={{
                background: 'linear-gradient(90deg, #34d399, #a78bfa)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {t('pages.forWhom.hero.titleLine2', 'the ultimate co-pilot.')}
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.14 }}
            className="text-lg text-white/55 max-w-2xl mx-auto mb-10"
          >
            {t(
              'pages.forWhom.hero.subtitle',
              "If results matter to you — Consultify is built for you. Whether you're scaling a startup, leading transformation, running a consulting firm, or building the AI future."
            )}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
            className="flex justify-center gap-3"
          >
            <button
              className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-white font-semibold text-sm"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                boxShadow: '0 0 40px -12px rgba(124,58,237,0.65)',
              }}
            >
              {t('pages.forWhom.hero.cta', 'Start for free')} <ArrowRight size={15} />
            </button>
          </motion.div>
        </div>
      </section>

      {/* Persona cards */}
      <section className="px-6 pb-24">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-6">
          {personas.map((p, idx) => {
            const Icon = p.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.08 }}
                className="group p-8 rounded-2xl transition-all duration-300"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = `${p.color}45`;
                  (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 50px -15px ${p.glow}`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.08)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                }}
              >
                <div className="flex items-start justify-between mb-6">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: `${p.color}18`, border: `1px solid ${p.color}30` }}
                  >
                    <Icon size={26} style={{ color: p.color }} />
                  </div>
                  <span
                    className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full"
                    style={{ background: `${p.color}15`, color: p.color }}
                  >
                    {p.tag}
                  </span>
                </div>
                <h2 className="text-2xl font-black text-white mb-3">{p.headline}</h2>
                <p className="text-white/50 leading-relaxed mb-6">{p.description}</p>
                <div className="space-y-2.5">
                  {p.points.map((pt: string) => (
                    <div key={pt} className="flex items-center gap-2.5">
                      <CheckCircle2 size={14} style={{ color: p.color }} className="shrink-0" />
                      <span className="text-sm text-white/60 font-medium">{pt}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>
    </MarketingLayout>
  );
};
