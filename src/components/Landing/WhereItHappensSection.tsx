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

const FEATURE_KEYS = [
  'aiCore',
  'economics',
  'execution',
  'deliverables',
  'chat',
  'results',
] as const;

const FEATURE_VISUALS = [
  { icon: Brain, accentColor: '#A51C30', glowColor: 'rgba(165,28,48,0.25)' },
  { icon: BarChart3, accentColor: '#0891b2', glowColor: 'rgba(8,145,178,0.22)' },
  { icon: Layers, accentColor: '#059669', glowColor: 'rgba(5,150,105,0.22)' },
  { icon: FileText, accentColor: '#651120', glowColor: 'rgba(133,22,39,0.22)' },
  { icon: MessageSquare, accentColor: '#d97706', glowColor: 'rgba(217,119,6,0.20)' },
  { icon: TrendingUp, accentColor: '#0d9488', glowColor: 'rgba(13,148,136,0.22)' },
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
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-c-accent bg-c-accent-soft mb-5"
          >
            <Zap size={12} className="text-c-accent" />
            <span className="text-xs font-bold text-c-accent uppercase tracking-wider">
              {t('landing.whereItHappens.badge', 'What Consultify does')}
            </span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            viewport={{ once: true }}
            className="text-4xl lg:text-5xl font-black text-c-text tracking-tight mb-4"
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
            className="text-base text-c-text-muted font-medium max-w-2xl mx-auto"
          >
            {t(
              'landing.whereItHappens.sub',
              'This is the Consulting Intelligence Platform in practice: not just AI answers, but a structured consulting workflow from diagnosis through results.'
            )}
          </motion.p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURE_KEYS.map((key, idx) => {
            const visual = FEATURE_VISUALS[idx];
            const Icon = visual.icon;
            const prefix = `landing.whereItHappens.features.${key}`;
            const highlights = (t(`${prefix}.highlights`, { returnObjects: true }) ||
              []) as string[];
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.07, duration: 0.35 }}
                className="group relative p-6 rounded-2xl transition-all duration-300 hover:scale-[1.02]
                  bg-c-surface border border-c-border
                  shadow-sm dark:shadow-none"
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.boxShadow = `0 0 40px -12px ${visual.glowColor}, inset 0 0 0 1px rgba(255,255,255,0.06)`;
                  el.style.borderColor = `${visual.accentColor}40`;
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.boxShadow = '';
                  el.style.borderColor = '';
                }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                  style={{
                    background: `${visual.accentColor}18`,
                    border: `1px solid ${visual.accentColor}30`,
                  }}
                >
                  <Icon size={20} style={{ color: visual.accentColor }} strokeWidth={2} />
                </div>

                <div className="mb-2">
                  <span
                    className="text-[9px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded"
                    style={{
                      background: `${visual.accentColor}18`,
                      color: visual.accentColor,
                    }}
                  >
                    {t(`${prefix}.badge`)}
                  </span>
                </div>

                <h3 className="text-base font-black text-c-text mb-2 leading-tight">
                  {t(`${prefix}.title`)}
                </h3>

                <p className="text-sm text-c-text-muted leading-relaxed mb-4">
                  {t(`${prefix}.description`)}
                </p>

                <div className="space-y-1.5">
                  {(Array.isArray(highlights) ? highlights : []).map((h, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <CheckCircle2
                        size={12}
                        style={{ color: visual.accentColor }}
                        className="shrink-0"
                      />
                      <span className="text-xs text-c-text-muted font-medium">
                        {h}
                      </span>
                    </div>
                  ))}
                </div>

                <div
                  aria-hidden
                  className="absolute top-0 right-0 w-28 h-28 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{
                    background: `radial-gradient(circle, ${visual.glowColor} 0%, transparent 70%)`,
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs text-c-text-muted font-medium
              bg-c-surface-raised border border-c-border"
          >
            <Target size={12} className="text-c-accent" />
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
