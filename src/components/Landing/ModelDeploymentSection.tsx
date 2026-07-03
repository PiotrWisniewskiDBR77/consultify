import { motion } from 'framer-motion';
import { ArrowRight, Building2, Cloud, Cpu, LockKeyhole, Server, Shield } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

const DEPLOYMENT_OPTIONS = [
  {
    icon: Cloud,
    accent: 'from-sky-400 to-blue-500',
    shadow: 'shadow-sky-500/20',
    titleKey: 'landing.modelDeployment.options.shared.title',
    titleFallback: 'Shared Consultify Cloud',
    bodyKey: 'landing.modelDeployment.options.shared.body',
    bodyFallback:
      'Start fast with managed infrastructure, automatic updates, and shared governance. Ideal for teams evaluating or scaling AI consulting workflows.',
    tagKey: 'landing.modelDeployment.options.shared.tag',
    tagFallback: 'Fastest to start',
  },
  {
    icon: Server,
    accent: 'from-c-accent to-c-accent',
    shadow: 'shadow-c-accent/20',
    titleKey: 'landing.modelDeployment.options.dedicated.title',
    titleFallback: 'Dedicated API',
    bodyKey: 'landing.modelDeployment.options.dedicated.body',
    bodyFallback:
      'Isolated runtime with your own API boundary. Stronger data separation, custom integration rules, and dedicated compute resources for enterprise teams.',
    tagKey: 'landing.modelDeployment.options.dedicated.tag',
    tagFallback: 'Enterprise isolation',
  },
  {
    icon: Building2,
    accent: 'from-amber-400 to-amber-500',
    shadow: 'shadow-amber-500/20',
    titleKey: 'landing.modelDeployment.options.onPrem.title',
    titleFallback: 'On-premise',
    bodyKey: 'landing.modelDeployment.options.onPrem.body',
    bodyFallback:
      'Full control over infrastructure and data. Deploy within your own environment when governance, procurement, or compliance require zero external exposure.',
    tagKey: 'landing.modelDeployment.options.onPrem.tag',
    tagFallback: 'Full control',
  },
] as const;

export const ModelDeploymentSection: React.FC = () => {
  const { t } = useTranslation();

  return (
    <section className="relative overflow-hidden px-6 py-24 md:py-32">
      <div className="absolute inset-0 bg-[linear-gradient(160deg,#f8fafc_0%,#fdf2f3_42%,#f8fafc_100%)] dark:bg-[linear-gradient(160deg,#0F172A_0%,#0A0F1E_45%,#151E32_100%)]" />
      <div className="absolute left-[8%] top-[10%] h-64 w-64 rounded-full bg-c-accent/10 blur-3xl" />
      <div className="absolute bottom-[0%] right-[8%] h-72 w-72 rounded-full bg-blue-500/10 blur-3xl dark:bg-blue-500/15" />

      <div className="relative mx-auto max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-16 md:mb-20"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-c-accent bg-c-accent-soft px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-c-accent mb-6">
            <LockKeyhole size={14} />
            {t('landing.modelDeployment.badge', 'Custom AI model & deployment')}
          </div>

          <h2 className="text-3xl md:text-5xl lg:text-6xl font-black tracking-tight text-c-text max-w-4xl mx-auto leading-[1.08]">
            {t('landing.modelDeployment.title', 'Your governance reality. Your deployment model.')}
          </h2>

          <p className="mt-6 max-w-2xl mx-auto text-lg leading-relaxed text-c-text-secondary">
            {t(
              'landing.modelDeployment.subtitle',
              'Consultify runs on a proprietary DBR77 model layer built for consulting logic and executive-grade outputs. Choose how and where it runs.'
            )}
          </p>
        </motion.div>

        {/* Key differentiators */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16 md:mb-20">
          {[
            {
              icon: Cpu,
              title: t('landing.modelDeployment.points.model.title', 'Proprietary AI model'),
              body: t(
                'landing.modelDeployment.points.model.body',
                'Built for consulting: decision structures, risk framing, and executive-ready outputs.'
              ),
            },
            {
              icon: Shield,
              title: t('landing.modelDeployment.points.control.title', 'Deployment choice'),
              body: t(
                'landing.modelDeployment.points.control.body',
                'Match procurement, integration, and security requirements without forcing a single path.'
              ),
            },
            {
              icon: LockKeyhole,
              title: t('landing.modelDeployment.points.security.title', 'Security by design'),
              body: t(
                'landing.modelDeployment.points.security.body',
                'GDPR compliance, AES-256 encryption, and EU data residency available by default.'
              ),
            },
            {
              icon: ArrowRight,
              title: t('landing.modelDeployment.points.sales.title', 'Guided evaluation'),
              body: t(
                'landing.modelDeployment.points.sales.body',
                'Anna walks you through fit, pricing, and deployment before you commit to a trial or enterprise deal.'
              ),
            },
          ].map((point, idx) => {
            const Icon = point.icon;
            return (
              <motion.div
                key={point.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.08 }}
                viewport={{ once: true }}
                className="rounded-2xl border border-c-border bg-c-surface p-5 backdrop-blur-sm"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-c-accent text-white shadow-lg shadow-c-accent/20 mb-4">
                  <Icon size={16} />
                </div>
                <p className="text-sm font-black text-c-text">{point.title}</p>
                <p className="mt-2 text-sm leading-6 text-c-text-secondary">
                  {point.body}
                </p>
              </motion.div>
            );
          })}
        </div>

        {/* Deployment cards */}
        <div className="grid md:grid-cols-3 gap-5">
          {DEPLOYMENT_OPTIONS.map((option, idx) => {
            const Icon = option.icon;
            return (
              <motion.div
                key={option.titleKey}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.1 + idx * 0.1 }}
                viewport={{ once: true }}
                className="group relative rounded-3xl border border-c-border bg-c-surface p-7 shadow-lg shadow-black/5 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
              >
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${option.accent} text-white shadow-lg ${option.shadow} mb-5`}
                >
                  <Icon size={24} />
                </div>

                <span className="inline-flex items-center rounded-full border border-c-border bg-c-surface-raised px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-c-text-muted mb-4">
                  {t(option.tagKey, option.tagFallback)}
                </span>

                <h3 className="text-xl font-black text-c-text mb-3">
                  {t(option.titleKey, option.titleFallback)}
                </h3>

                <p className="text-sm leading-6 text-c-text-secondary">
                  {t(option.bodyKey, option.bodyFallback)}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ModelDeploymentSection;
