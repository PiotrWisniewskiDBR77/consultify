import { motion } from 'framer-motion';
import { Building2, Cloud, Globe, Lock, Server, ShieldCheck } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export const TrustStrip: React.FC = () => {
  const { t } = useTranslation();

  const trustBadges = [
    {
      icon: ShieldCheck,
      label: t('landing.compliance.badges.gdpr', 'GDPR compliant'),
      color: 'text-emerald-600 dark:text-emerald-400',
      glowColor: 'rgba(16,185,129,0.22)',
      borderColor: 'rgba(16,185,129,0.22)',
    },
    {
      icon: Lock,
      label: t('landing.compliance.badges.encryption', 'AES-256 encryption'),
      color: 'text-blue-600 dark:text-blue-400',
      glowColor: 'rgba(34,211,238,0.20)',
      borderColor: 'rgba(34,211,238,0.20)',
    },
    {
      icon: Globe,
      label: t('landing.compliance.badges.euData', 'Your region, your data'),
      color: 'text-blue-600 dark:text-blue-400',
      glowColor: 'rgba(96,165,250,0.20)',
      borderColor: 'rgba(96,165,250,0.20)',
    },
  ];

  const deploymentBadges = [
    {
      icon: Cloud,
      label: t('landing.compliance.badges.sharedCloud', 'Shared cloud'),
      color: 'text-sky-600 dark:text-sky-400',
      glowColor: 'rgba(56,189,248,0.16)',
      borderColor: 'rgba(56,189,248,0.16)',
    },
    {
      icon: Server,
      label: t('landing.compliance.badges.dedicated', 'Dedicated API'),
      color: 'text-primary-600 dark:text-primary-400',
      glowColor: 'rgba(168,85,247,0.18)',
      borderColor: 'rgba(168,85,247,0.18)',
    },
    {
      icon: Building2,
      label: t('landing.compliance.badges.onPrem', 'On-premise'),
      color: 'text-amber-600 dark:text-amber-400',
      glowColor: 'rgba(251,191,36,0.16)',
      borderColor: 'rgba(251,191,36,0.16)',
    },
  ];

  return (
    <section className="relative py-14 px-6 overflow-hidden">
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(124,58,237,0.35) 30%, rgba(0,210,255,0.25) 70%, transparent 100%)',
        }}
      />

      <div className="max-w-7xl mx-auto">
        {/* Two rows: Security & Compliance + Deployment Options */}
        <div className="grid md:grid-cols-2 gap-10 md:gap-16">
          {/* Security & Compliance */}
          <div className="text-center md:text-left">
            <span className="text-[10px] font-bold uppercase tracking-[0.35em] text-slate-400 dark:text-white/25">
              {t('landing.compliance.securityLabel', 'Security & Compliance')}
            </span>
            <div className="mt-5 flex flex-wrap items-center justify-center md:justify-start gap-3">
              {trustBadges.map((badge, idx) => {
                const Icon = badge.icon;
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: idx * 0.08 }}
                    viewport={{ once: true }}
                    className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl transition-all duration-300 hover:scale-105 cursor-default bg-slate-50 dark:bg-white/[0.03]"
                    style={{
                      border: `1px solid ${badge.borderColor}`,
                      boxShadow: `0 0 20px -8px ${badge.glowColor}`,
                    }}
                  >
                    <Icon size={16} className={badge.color} strokeWidth={2} />
                    <span className="text-sm font-bold text-slate-600 dark:text-white/70">
                      {badge.label}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Deployment Options */}
          <div className="text-center md:text-left">
            <span className="text-[10px] font-bold uppercase tracking-[0.35em] text-slate-400 dark:text-white/25">
              {t('landing.compliance.deployLabel', 'Deployment Options')}
            </span>
            <div className="mt-5 flex flex-wrap items-center justify-center md:justify-start gap-3">
              {deploymentBadges.map((badge, idx) => {
                const Icon = badge.icon;
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.24 + idx * 0.08 }}
                    viewport={{ once: true }}
                    className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl transition-all duration-300 hover:scale-105 cursor-default bg-slate-50 dark:bg-white/[0.03]"
                    style={{
                      border: `1px solid ${badge.borderColor}`,
                      boxShadow: `0 0 20px -8px ${badge.glowColor}`,
                    }}
                  >
                    <Icon size={16} className={badge.color} strokeWidth={2} />
                    <span className="text-sm font-bold text-slate-600 dark:text-white/70">
                      {badge.label}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        {/* EU data note */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          viewport={{ once: true }}
          className="mt-8 flex flex-col items-center gap-2"
        >
          <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full text-xs bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10">
            <span className="flex items-center gap-1.5">
              <span className="text-sm">🇪🇺</span>
              <span className="text-sm">🇺🇸</span>
              <span className="text-sm">🇸🇬</span>
            </span>
            <span className="font-bold text-slate-600 dark:text-white/60">
              {t(
                'landing.compliance.euNote',
                'Your data stays in the region you choose — EU, US, or APAC. You pick, we enforce.'
              )}
            </span>
          </div>
        </motion.div>
      </div>

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
