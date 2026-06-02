import { motion } from 'framer-motion';
import { BarChart3, Brain, Building2, Rocket, Users } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

const PERSONA_KEYS = ['founders', 'executives', 'consultingFirms', 'aiLeaders'] as const;

const PERSONA_VISUALS = [
  { icon: Rocket, color: '#7c3aed', glow: 'rgba(124,58,237,0.28)' },
  { icon: Users, color: '#0891b2', glow: 'rgba(8,145,178,0.25)' },
  { icon: Building2, color: '#059669', glow: 'rgba(5,150,105,0.25)' },
  { icon: Brain, color: '#c026d3', glow: 'rgba(192,38,211,0.25)' },
];

export const ForWhomSection: React.FC = () => {
  const { t } = useTranslation();

  return (
    <section className="py-24 px-6 relative z-10">
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.15), transparent)',
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
            <BarChart3 size={12} className="text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              {t('landing.forWhom.badge', 'For whom')}
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            viewport={{ once: true }}
            className="text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-4"
          >
            {t('landing.forWhom.heading', 'Built for the ambitious.')}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.16 }}
            viewport={{ once: true }}
            className="text-base text-slate-500 dark:text-white/50 max-w-xl mx-auto"
          >
            {t(
              'landing.forWhom.sub',
              'Whoever you are — if results matter to you, Consultify is your co-pilot.'
            )}
          </motion.p>
        </div>

        {/* Cards grid */}
        <div className="grid md:grid-cols-2 gap-5">
          {PERSONA_KEYS.map((key, idx) => {
            const visual = PERSONA_VISUALS[idx];
            const Icon = visual.icon;
            const prefix = `landing.forWhom.personas.${key}`;
            const points = (t(`${prefix}.points`, { returnObjects: true }) || []) as string[];
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.08 }}
                className="group relative p-7 rounded-2xl transition-all duration-300 hover:scale-[1.01]
                  bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08]
                  shadow-sm dark:shadow-none"
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.borderColor = `${visual.color}45`;
                  el.style.boxShadow = `0 0 40px -12px ${visual.glow}`;
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.borderColor = '';
                  el.style.boxShadow = '';
                }}
              >
                <div
                  aria-hidden
                  className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{
                    background: `radial-gradient(circle, ${visual.glow} 0%, transparent 70%)`,
                    transform: 'translate(30%, -30%)',
                    filter: 'blur(20px)',
                  }}
                />

                <div className="relative">
                  <div className="flex items-start justify-between mb-5">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{
                        background: `${visual.color}18`,
                        border: `1px solid ${visual.color}30`,
                      }}
                    >
                      <Icon size={22} style={{ color: visual.color }} strokeWidth={2} />
                    </div>
                    <span
                      className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
                      style={{ background: `${visual.color}15`, color: visual.color }}
                    >
                      {t(`${prefix}.tag`)}
                    </span>
                  </div>

                  <h3 className="text-xl font-black text-slate-900 dark:text-white mb-3 leading-tight">
                    {t(`${prefix}.headline`)}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-white/50 leading-relaxed mb-5">
                    {t(`${prefix}.description`)}
                  </p>

                  <div className="space-y-2">
                    {(Array.isArray(points) ? points : []).map((point, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <div
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: visual.color }}
                        />
                        <span className="text-xs text-slate-500 dark:text-white/55 font-medium">
                          {point}
                        </span>
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
