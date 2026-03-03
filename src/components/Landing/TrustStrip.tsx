import { motion } from 'framer-motion';
import { Award, Globe, Key, Lock, ShieldCheck } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export const TrustStrip: React.FC = () => {
  const { t } = useTranslation();

  const badges = [
    {
      icon: Award,
      label: 'ISO 27001',
      color: 'text-sky-400',
      glowColor: 'rgba(56,189,248,0.20)',
      borderColor: 'rgba(56,189,248,0.20)',
    },
    {
      icon: Lock,
      label: 'SOC2 Type II',
      color: 'text-blue-400',
      glowColor: 'rgba(96,165,250,0.20)',
      borderColor: 'rgba(96,165,250,0.20)',
    },
    {
      icon: ShieldCheck,
      label: 'GDPR',
      color: 'text-emerald-400',
      glowColor: 'rgba(52,211,153,0.20)',
      borderColor: 'rgba(52,211,153,0.20)',
    },
    {
      icon: Key,
      label: 'AES-256',
      color: 'text-amber-400',
      glowColor: 'rgba(251,191,36,0.18)',
      borderColor: 'rgba(251,191,36,0.18)',
    },
  ];

  const regions = [
    { flag: '🇪🇺', name: 'EU', label: t('landing.compliance.regions.eu', 'Europe') },
    { flag: '🇺🇸', name: 'US', label: t('landing.compliance.regions.us', 'North America') },
    { flag: '🇸🇦', name: 'GCC', label: t('landing.compliance.regions.gcc', 'Middle East') },
    { flag: '🇯🇵', name: 'JP', label: t('landing.compliance.regions.jp', 'Japan') },
  ];

  return (
    <section className="relative py-12 px-6 overflow-hidden">
      {/* Subtle separator line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(124,58,237,0.35) 30%, rgba(0,210,255,0.25) 70%, transparent 100%)',
        }}
      />

      <div className="max-w-7xl mx-auto">
        {/* Label */}
        <div className="text-center mb-8">
          <span className="text-[10px] font-bold uppercase tracking-[0.35em] text-white/25">
            {t('landing.compliance.label', 'Enterprise-Grade Security & Compliance')}
          </span>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 mb-8">
          {badges.map((badge, idx) => {
            const Icon = badge.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.08 }}
                viewport={{ once: true }}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl transition-all duration-300 hover:scale-105 cursor-default"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${badge.borderColor}`,
                  boxShadow: `0 0 20px -8px ${badge.glowColor}`,
                }}
              >
                <Icon size={16} className={badge.color} strokeWidth={2} />
                <span className="text-sm font-bold text-white/70">{badge.label}</span>
              </motion.div>
            );
          })}
        </div>

        {/* Data residency */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          viewport={{ once: true }}
          className="flex flex-col items-center gap-3"
        >
          <div className="flex items-center gap-2 text-xs text-white/30">
            <Globe size={13} className="text-primary-400" />
            <span className="font-medium">
              {t('landing.compliance.dataResidency', 'Data Residency Options:')}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {regions.map((region, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.10)',
                }}
              >
                <span className="text-sm">{region.flag}</span>
                <span className="font-bold text-white/60">{region.name}</span>
                <span className="text-white/30 hidden sm:inline">({region.label})</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-white/25 text-center mt-1">
            {t(
              'landing.compliance.dataNote',
              'Your data stays in your chosen region • No AI training on your data • Full regulatory compliance'
            )}
          </p>
        </motion.div>
      </div>

      {/* Bottom separator */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)',
        }}
      />
    </section>
  );
};
