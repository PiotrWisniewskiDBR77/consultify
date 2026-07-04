import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle,
  Cloud,
  Container,
  Database,
  Eye,
  FileCheck,
  GitBranch,
  Globe,
  Key,
  Lock,
  Network,
  Server,
  Shield,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { AnnaAssistantWidget } from '../../components/Landing/AnnaAssistantWidget';
import { EntryFooter } from '../../components/Landing/EntryFooter';
import { EntryTopBar } from '../../components/Landing/EntryTopBar';

const COMPANY = {
  name: 'DBR77 Robotics Sp. z o.o.',
  securityEmail: 'security@dbr77.com',
  website: 'https://consultify.com',
};

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.55 },
};

const SECURITY_FEATURES = [
  {
    icon: Lock,
    title: 'Encryption',
    description:
      'AES-256 encryption at rest, TLS 1.3 in transit. Encryption controls are applied according to the deployment model — never as generic marketing claims.',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    icon: Server,
    title: 'Deployment Options',
    description:
      'Shared cloud, dedicated API/runtime, or fully on-premise. Every path provides session isolation and Docker containerized inference.',
    color: 'text-primary-500',
    bgColor: 'bg-primary-500/10',
  },
  {
    icon: Shield,
    title: 'Governance Review',
    description:
      'Security posture is reviewed with the customer — not hidden behind generic badges. RBAC, audit trails, and governance checkpoints are built in.',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
  {
    icon: Key,
    title: 'Access Control',
    description:
      'Role-based access control (RBAC) with administrative permissions aligned to customer environments. API key management and session controls included.',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
  },
  {
    icon: Eye,
    title: 'Traceability',
    description:
      'Workspace activity, generated outputs, and governance checkpoints can be reviewed inside the operating environment. Full audit trail for every AI interaction.',
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-500/10',
  },
  {
    icon: Users,
    title: 'Client Fit Assessment',
    description:
      'Security and legal detail are aligned to the target client environment. No one-size-fits-all certification language — only what applies to your deployment.',
    color: 'text-pink-500',
    bgColor: 'bg-pink-500/10',
  },
];

const AI_SECURITY_PILLARS = [
  {
    icon: Database,
    title: 'No Training on Client Data',
    body: 'DBR77 Vector is trained exclusively on anonymized historical case studies. No client production data, documents, or queries are used for training. Queries and outputs are not stored beyond the session.',
  },
  {
    icon: Container,
    title: 'Deployment Isolation by Design',
    body: 'Every deployment model — on-premise, private API, or shared — is designed with isolation as a default. On-premise: zero data leaves the network. Private API: dedicated compute, no multi-tenancy.',
  },
  {
    icon: UserCheck,
    title: 'Human Approval in the Loop',
    body: 'Vector is an intelligence layer for decisions, not an autonomous authority. Every recommendation sits inside a human decision loop with traceable reasoning logic.',
  },
  {
    icon: ShieldCheck,
    title: 'Enterprise Governance Alignment',
    body: 'SOC2, GDPR, ISO 27001, and data residency alignment. Audit-friendly outputs with source traceability. Role-based access and encryption at rest and in transit.',
  },
  {
    icon: FileCheck,
    title: 'Anonymized Learning',
    body: 'Continuous improvement is based on anonymized industrial patterns, not client-specific data. No client identifiers, drawings, or proprietary figures in the training base.',
  },
  {
    icon: Network,
    title: 'OT/IT Convergence Ready',
    body: 'Compatible with air-gapped and restricted network environments. No mandatory external API calls during inference. Designed for environments where uptime and safety are non-negotiable.',
  },
];

const DEPLOYMENT_MODELS = [
  {
    icon: Building2,
    accent: 'from-amber-400 to-amber-500',
    shadow: 'shadow-amber-500/20',
    title: 'On-Premise',
    tag: 'Full control',
    body: 'Run DBR77 Vector entirely on your own servers. Production data, transformation plans, and AI reasoning never leave your security perimeter. Best for regulated industries, sensitive IP, and OT-governed environments.',
    bullets: [
      'Complete control over model runtime, data, and access',
      'No external network dependency for inference',
      'Strongest legal, OT, and procurement alignment',
    ],
  },
  {
    icon: Server,
    accent: 'from-primary-400 to-primary-500',
    shadow: 'shadow-primary-500/20',
    title: 'Private Dedicated API',
    tag: 'Enterprise isolation',
    body: 'Isolated hosted environment exclusively for one client. Full isolation, predictable performance, and no shared infrastructure — without managing the underlying systems.',
    bullets: [
      'Dedicated compute and storage — no multi-tenancy',
      'Client-specific access controls and encryption',
      'Managed updates and scaling without internal DevOps burden',
    ],
  },
  {
    icon: Cloud,
    accent: 'from-sky-400 to-blue-500',
    shadow: 'shadow-sky-500/20',
    title: 'Shared API',
    tag: 'Fastest to start',
    body: 'Lower-friction entry path for pilots, workshops, and rapid experimentation. Enterprise security policies still apply. Easy upgrade path to private or on-premise when ready.',
    bullets: [
      'Fastest time to first value',
      'Enterprise security policies still apply',
      'Session isolation with no persistent storage',
    ],
  },
];

const TECH_CONTROLS = [
  { icon: Lock, label: 'AES-256', sub: 'Encryption at rest' },
  { icon: Shield, label: 'TLS 1.3', sub: 'Encryption in transit' },
  { icon: Key, label: 'RBAC', sub: 'Role-based access control' },
  { icon: Container, label: 'Docker Isolation', sub: 'Containerized inference' },
  { icon: Eye, label: 'Session Isolation', sub: 'No persistent storage' },
  { icon: GitBranch, label: 'CI/CD Pipeline', sub: 'Versioned & auditable' },
];

const COMPLIANCE_STANDARDS = [
  { label: 'ISO 27001', sub: 'Information Security Management', status: 'Aligned' },
  { label: 'SOC2', sub: 'Service Organization Control', status: 'Aligned' },
  { label: 'GDPR', sub: 'General Data Protection Regulation', status: 'Compliant' },
  { label: 'NIST AI RMF', sub: 'AI Risk Management Framework', status: 'Aligned' },
  { label: 'ISO 23247', sub: 'Digital Twin Security Standards', status: 'Compliant' },
  { label: 'ISO 22400-2', sub: 'Industrial KPI Framework', status: 'Integrated' },
];

const LLM_COMPARISON = [
  {
    dimension: 'Data used for training',
    vector: 'Anonymized historical cases only. No client data used for training.',
    generic: 'Trained on internet data. May use user inputs for improvement unless opted out.',
  },
  {
    dimension: 'Data residency',
    vector: 'On-premise, private cloud, or region-specific hosting. Client chooses.',
    generic: "Data processed in provider's cloud infrastructure. Limited residency control.",
  },
  {
    dimension: 'Query & output storage',
    vector: 'No persistent storage beyond the session. Client controls retention.',
    generic: 'Queries may be logged, stored, and reviewed by the provider.',
  },
  {
    dimension: 'Network dependency',
    vector: 'On-premise runs fully offline. Private API requires only internal network.',
    generic: "Requires internet connection to provider's servers for every query.",
  },
  {
    dimension: 'Multi-tenancy',
    vector: 'On-premise and private API are single-tenant. Shared API uses session isolation.',
    generic: 'Multi-tenant infrastructure shared across all users.',
  },
  {
    dimension: 'Procurement & compliance',
    vector: 'Designed to pass enterprise security, legal, and OT reviews.',
    generic: 'Often blocked or restricted by enterprise security policies.',
  },
];

export const SecurityView: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleTrialClick = () => navigate('/trial/start');
  const handleDemoClick = () => navigate('/demo');
  const handleContactClick = () => navigate('/contact');

  return (
    <div className="min-h-screen bg-c-surface flex flex-col">
      <EntryTopBar
        onTrialClick={handleTrialClick}
        onDemoClick={handleDemoClick}
        onLoginClick={() => navigate('/login')}
        isLoggedIn={false}
        hasWorkspace={false}
      />

      {/* ── Hero ── */}
      <section className="pt-32 pb-20 px-6 bg-gradient-to-b from-slate-50 to-white dark:from-navy-900 dark:to-navy-950">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div {...fadeUp}>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-sm font-semibold mb-6">
              <Shield size={16} />
              {t('security.hero.badge', 'Enterprise Security')}
            </span>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-navy-950 dark:text-white mb-6 tracking-tight">
              {t('security.hero.titlePre', 'Security guaranteed by')}{' '}
              <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                {t('security.hero.titleHighlight', 'architecture,')}
              </span>{' '}
              {t('security.hero.titlePost', 'not marketing claims.')}
            </h1>

            <p className="text-lg text-c-text-secondary max-w-3xl mx-auto leading-relaxed">
              {t(
                'security.hero.subtitle',
                'Consultify and DBR77 Vector deliver enterprise-grade AI through technical solutions — from encryption and data sovereignty to dedicated deployment models and ISO 27001 alignment.'
              )}
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Security Infrastructure (existing 6 cards — expanded) ── */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-navy-950 dark:text-white mb-12 text-center">
            {t('security.infra.title', 'Security Infrastructure')}
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {SECURITY_FEATURES.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1, duration: 0.5 }}
                  className="p-6 bg-c-surface rounded-xl border border-c-border-subtle shadow-sm hover:shadow-lg transition-shadow"
                >
                  <div
                    className={`w-12 h-12 ${feature.bgColor} rounded-xl flex items-center justify-center mb-4`}
                  >
                    <Icon size={24} className={feature.color} />
                  </div>
                  <h3 className="text-lg font-bold text-navy-950 dark:text-white mb-2">
                    {t(`security.infra.features.${idx}.title`, feature.title)}
                  </h3>
                  <p className="text-c-text-secondary text-sm leading-relaxed">
                    {t(`security.infra.features.${idx}.description`, feature.description)}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Six Pillars of AI Security ── */}
      <section className="py-20 px-6 bg-c-surface-raised/40">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-14">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-widest mb-4">
              <ShieldCheck size={14} />
              {t('security.pillars.badge', 'AI Security Architecture')}
            </span>
            <h2 className="text-3xl md:text-4xl font-black text-navy-950 dark:text-white tracking-tight">
              {t('security.pillars.title', 'Six Pillars of Industrial AI Security')}
            </h2>
            <p className="mt-4 text-c-text-secondary max-w-2xl mx-auto">
              {t(
                'security.pillars.subtitle',
                'Every aspect of DBR77 Vector — from training data to deployment to inference — is designed for environments where data sovereignty and auditability are non-negotiable.'
              )}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {AI_SECURITY_PILLARS.map((pillar, idx) => {
              const Icon = pillar.icon;
              return (
                <motion.div
                  key={pillar.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: idx * 0.08 }}
                  className="rounded-2xl border border-c-border-subtle dark:border-white/[0.08] bg-c-surface dark:bg-c-surface/[0.02] p-7"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/20 mb-5">
                    <Icon size={20} />
                  </div>
                  <h3 className="text-base font-black text-navy-950 dark:text-white mb-2">
                    {t(`security.pillars.items.${idx}.title`, pillar.title)}
                  </h3>
                  <p className="text-sm leading-relaxed text-c-text-secondary">
                    {t(`security.pillars.items.${idx}.body`, pillar.body)}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Deployment Models ── */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black text-navy-950 dark:text-white tracking-tight">
              {t('security.deployment.title', 'Choose Your Deployment Model')}
            </h2>
            <p className="mt-4 text-c-text-secondary max-w-2xl mx-auto">
              {t(
                'security.deployment.subtitle',
                'Same Vector intelligence, same domain depth. The difference is where it runs and who manages the infrastructure.'
              )}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-5">
            {DEPLOYMENT_MODELS.map((model, idx) => {
              const Icon = model.icon;
              return (
                <motion.div
                  key={model.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: idx * 0.1 }}
                  className="group relative rounded-3xl border border-c-border-subtle bg-c-surface/95 p-7 shadow-lg shadow-slate-900/5 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 dark:border-white/[0.08] dark:bg-slate-950/70"
                >
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${model.accent} text-white shadow-lg ${model.shadow} mb-5`}
                  >
                    <Icon size={24} />
                  </div>
                  <span className="inline-flex items-center rounded-full border border-c-border-subtle bg-c-bg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-c-text-muted dark:border-white/[0.08] dark:bg-c-surface/[0.04] dark:text-white/50 mb-4">
                    {t(`security.deployment.models.${idx}.tag`, model.tag)}
                  </span>
                  <h3 className="text-xl font-black text-c-text mb-3">
                    {t(`security.deployment.models.${idx}.title`, model.title)}
                  </h3>
                  <p className="text-sm leading-6 text-c-text-secondary dark:text-white/55 mb-4">
                    {t(`security.deployment.models.${idx}.body`, model.body)}
                  </p>
                  <ul className="space-y-2">
                    {model.bullets.map((b, bIdx) => (
                      <li
                        key={b}
                        className="flex items-start gap-2 text-sm text-c-text-secondary"
                      >
                        <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
                        {t(`security.deployment.models.${idx}.bullets.${bIdx}`, b)}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Data Sovereignty & Residency ── */}
      <section className="py-20 px-6 bg-c-surface-raised/40">
        <div className="max-w-4xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-navy-950 dark:text-white tracking-tight">
              {t('security.sovereignty.title', 'Data Sovereignty & Residency')}
            </h2>
          </motion.div>

          <motion.div
            {...fadeUp}
            className="rounded-2xl border border-c-border-subtle dark:border-white/[0.08] bg-c-surface dark:bg-c-surface/[0.02] p-8 md:p-10"
          >
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <Globe size={20} className="text-blue-500" />
                  <h3 className="text-lg font-black text-navy-950 dark:text-white">
                    {t('security.sovereignty.regionTitle', 'Your Region, Your Rules')}
                  </h3>
                </div>
                <ul className="space-y-3">
                  {[
                    t('security.sovereignty.p1', 'Choose your data residency: EU, US, or APAC'),
                    t(
                      'security.sovereignty.p2',
                      'On-premise deployment: data never leaves your network'
                    ),
                    t(
                      'security.sovereignty.p3',
                      'Private API: dedicated compute in your chosen region'
                    ),
                    t(
                      'security.sovereignty.p4',
                      'Full GDPR compliance with Data Processing Agreements'
                    ),
                  ].map((item, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 text-sm text-c-text-secondary"
                    >
                      <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <Database size={20} className="text-primary-500" />
                  <h3 className="text-lg font-black text-navy-950 dark:text-white">
                    {t('security.sovereignty.dataTitle', 'Zero Client Data Training')}
                  </h3>
                </div>
                <ul className="space-y-3">
                  {[
                    t(
                      'security.sovereignty.d1',
                      'No client production data used for model training or fine-tuning'
                    ),
                    t(
                      'security.sovereignty.d2',
                      'Queries and outputs are not stored beyond the inference session'
                    ),
                    t(
                      'security.sovereignty.d3',
                      'Complete separation between inference and training pipelines'
                    ),
                    t(
                      'security.sovereignty.d4',
                      'Transparent methodology available for security review'
                    ),
                  ].map((item, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 text-sm text-c-text-secondary"
                    >
                      <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Encryption & Technical Controls ── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black text-navy-950 dark:text-white tracking-tight">
              {t('security.techControls.title', 'Encryption & Technical Controls')}
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {TECH_CONTROLS.map((ctrl, idx) => {
              const Icon = ctrl.icon;
              return (
                <motion.div
                  key={ctrl.label}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: idx * 0.07 }}
                  className="flex items-center gap-4 rounded-2xl border border-c-border-subtle dark:border-white/[0.08] bg-c-surface dark:bg-c-surface/[0.02] p-5"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-500 text-white shadow-lg shadow-blue-500/20">
                    <Icon size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-navy-950 dark:text-white">
                      {t(`security.techControls.items.${idx}.label`, ctrl.label)}
                    </p>
                    <p className="text-xs text-c-text-muted">
                      {t(`security.techControls.items.${idx}.sub`, ctrl.sub)}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Compliance & Standards ── */}
      <section className="py-20 px-6 bg-c-surface-raised/40">
        <div className="max-w-5xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black text-navy-950 dark:text-white tracking-tight">
              {t('security.compliance.title', 'Compliance & Standards')}
            </h2>
            <p className="mt-4 text-c-text-secondary max-w-xl mx-auto">
              {t(
                'security.compliance.subtitle',
                'Designed to pass enterprise procurement, legal, and IT security reviews.'
              )}
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {COMPLIANCE_STANDARDS.map((std, idx) => (
              <motion.div
                key={std.label}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.07 }}
                className="rounded-2xl border border-c-border-subtle dark:border-white/[0.08] bg-c-surface dark:bg-c-surface/[0.02] p-6 text-center"
              >
                <p className="text-xl font-black text-navy-950 dark:text-white mb-1">
                  {t(`security.compliance.standards.${idx}.label`, std.label)}
                </p>
                <p className="text-xs text-c-text-muted mb-3">
                  {t(`security.compliance.standards.${idx}.sub`, std.sub)}
                </p>
                <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/30 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-green-600 dark:text-green-400">
                  {t(`security.compliance.standards.${idx}.status`, std.status)}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Vector vs Public LLMs ── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black text-navy-950 dark:text-white tracking-tight">
              {t('security.comparison.title', 'DBR77 Vector vs. Public LLMs')}
            </h2>
            <p className="mt-4 text-c-text-secondary max-w-xl mx-auto">
              {t(
                'security.comparison.subtitle',
                'Security side by side — how Vector compares on the dimensions that matter most.'
              )}
            </p>
          </motion.div>

          <motion.div
            {...fadeUp}
            className="overflow-x-auto rounded-2xl border border-c-border-subtle dark:border-white/[0.08]"
          >
            <table /* §27-exempt: layout specjalizowany/read-only/data-viz, nie kanoniczna lista przegladana */  className="w-full text-sm">
              <thead>
                <tr className="bg-c-surface-raised dark:bg-c-surface/[0.04]">
                  <th className="text-left px-6 py-4 font-bold text-navy-950 dark:text-white">
                    {t('security.comparison.dimensionHeader', 'Dimension')}
                  </th>
                  <th className="text-left px-6 py-4 font-bold text-green-600 dark:text-green-400">
                    {t('security.comparison.vectorHeader', 'DBR77 Vector')}
                  </th>
                  <th className="text-left px-6 py-4 font-bold text-c-text-muted">
                    {t('security.comparison.llmHeader', 'Public LLM')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {LLM_COMPARISON.map((row, idx) => (
                  <tr
                    key={row.dimension}
                    className={
                      idx % 2 === 0
                        ? 'bg-c-surface dark:bg-transparent'
                        : 'bg-c-bg/50 dark:bg-c-surface/[0.02]'
                    }
                  >
                    <td className="px-6 py-4 font-semibold text-navy-950 dark:text-white whitespace-nowrap">
                      {t(`security.comparison.rows.${idx}.dimension`, row.dimension)}
                    </td>
                    <td className="px-6 py-4 text-c-text-secondary">
                      {t(`security.comparison.rows.${idx}.vector`, row.vector)}
                    </td>
                    <td className="px-6 py-4 text-c-text-muted">
                      {t(`security.comparison.rows.${idx}.generic`, row.generic)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </div>
      </section>

      {/* ── Auditable Pipeline ── */}
      <section className="py-20 px-6 bg-navy-950 text-white">
        <div className="max-w-5xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">
              {t('security.pipeline.title', 'Auditable from Code to Inference')}
            </h2>
            <p className="mt-4 text-white/50 max-w-2xl mx-auto">
              {t(
                'security.pipeline.subtitle',
                'Every step in the deployment pipeline is versioned, automated, and traceable. No manual steps. No untracked changes.'
              )}
            </p>
          </motion.div>

          <div className="flex flex-col md:flex-row items-stretch gap-3">
            {[
              { icon: GitBranch, label: 'Source Control', sub: 'Version-controlled repos' },
              { icon: ArrowRight, label: 'CI/CD', sub: 'GitHub Actions' },
              { icon: Container, label: 'Docker Build', sub: 'Containerized model' },
              { icon: Cloud, label: 'Deployment', sub: 'RunPod / On-prem' },
              { icon: Shield, label: 'Isolated Inference', sub: 'No shared state' },
              { icon: Lock, label: 'No Stored Output', sub: 'Session-only data' },
            ].map((step, idx) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.label}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: idx * 0.07 }}
                  className="flex-1 rounded-2xl border border-white/[0.08] bg-c-surface/[0.03] p-5 text-center"
                >
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-c-surface/[0.06] mb-3">
                    <Icon size={18} className="text-white/50" />
                  </div>
                  <p className="text-sm font-bold text-white/80">
                    {t(`security.pipeline.steps.${idx}.label`, step.label)}
                  </p>
                  <p className="text-xs text-white/35 mt-1">
                    {t(`security.pipeline.steps.${idx}.sub`, step.sub)}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Responsible Disclosure ── */}
      <section className="py-20 px-6 bg-c-surface-raised/50">
        <div className="max-w-4xl mx-auto">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 rounded-xl p-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/50 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-navy-950 dark:text-white mb-2">
                  {t('security.disclosure.title', 'Responsible Disclosure')}
                </h3>
                <p className="text-c-text-secondary mb-4">
                  {t(
                    'security.disclosure.intro',
                    'We take security vulnerabilities seriously. If you discover a security issue, please report it to us responsibly. We commit to:'
                  )}
                </p>
                <ul className="list-disc list-inside text-c-text-secondary space-y-1 mb-4">
                  <li>{t('security.disclosure.items.0', 'Acknowledge receipt within 24 hours')}</li>
                  <li>
                    {t(
                      'security.disclosure.items.1',
                      'Provide regular updates on our investigation'
                    )}
                  </li>
                  <li>
                    {t(
                      'security.disclosure.items.2',
                      'Credit researchers who follow responsible disclosure'
                    )}
                  </li>
                  <li>
                    {t(
                      'security.disclosure.items.3',
                      'Not pursue legal action against good-faith researchers'
                    )}
                  </li>
                </ul>
                <p className="text-c-text-secondary">
                  {t('security.disclosure.report', 'Report security issues to:')}{' '}
                  <a
                    href={`mailto:${COMPANY.securityEmail}`}
                    className="text-primary-600 dark:text-primary-400 font-semibold"
                  >
                    {COMPANY.securityEmail}
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div {...fadeUp}>
            <ShieldCheck size={32} className="mx-auto text-green-500 mb-6" />
            <h2 className="text-2xl font-bold text-navy-950 dark:text-white mb-4">
              {t('security.cta.title', 'Ready for an enterprise security review?')}
            </h2>
            <p className="text-c-text-secondary mb-8 max-w-xl mx-auto">
              {t(
                'security.cta.subtitle',
                'For deployment-specific security detail, legal review, or architecture walkthrough — contact us before procurement or rollout.'
              )}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href={`mailto:${COMPANY.securityEmail}`}
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-sm font-semibold text-white transition-all"
                style={{
                  background: 'linear-gradient(135deg, #059669, #10b981)',
                  boxShadow: '0 0 24px -8px rgba(5,150,105,0.60)',
                }}
              >
                <Shield size={16} />
                {t('security.cta.review', 'Book a Security Review')}
              </a>
              <button
                onClick={handleContactClick}
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-sm font-semibold border border-c-border-subtle dark:border-c-border-subtle text-c-text-secondary dark:text-white/70 hover:bg-c-bg dark:hover:bg-c-surface/5 transition-all"
              >
                {t('security.cta.walkthrough', 'Schedule Architecture Walkthrough')}
                <ArrowRight size={15} />
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

export default SecurityView;
