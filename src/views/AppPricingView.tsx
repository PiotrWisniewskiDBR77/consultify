/**
 * AppPricingView
 *
 * In-app pricing page for customers showing Growth/Scale/Enterprise tiers.
 * Modern, minimalistic design that's welcoming and not intimidating.
 * Accessible from within the application (Admin panel).
 */
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Building2,
  Calendar,
  Check,
  Cpu,
  HelpCircle,
  Key,
  MessageCircle,
  Rocket,
  Server,
  Shield,
  Sparkles,
  Users,
  X,
  Zap,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import TeresaMark from '../components/shared/TeresaMark';
import { useAppStore } from '../store/useAppStore';
import { AppView } from '../types';

// =============================================================================
// TYPES
// =============================================================================

interface PricingTier {
  name: string;
  description: string;
  annualPrice: string;
  monthlyPrice: string;
  priceNote: string;
  highlight?: boolean;
  badge?: string;
  seats: string;
  aiCredits: string;
  extraSeatPrice: string;
  overagePrice: string;
  byokPrice?: string;
  features: { name: string; included: boolean }[];
  cta: string;
  ctaVariant: 'primary' | 'secondary' | 'outline';
  icon: React.ElementType;
}

interface FAQ {
  question: string;
  answer: string;
}

// =============================================================================
// DATA (funkcje przyjmujące `t` — wzór src/utils/enumLabel.ts)
// =============================================================================

const CALENDAR_URL =
  'https://meetings.hubspot.com/piotr-wisniewski1?uuid=a2976570-a2d2-4682-9e5f-c3958a7af017';

const getTiers = (t: TFunction, billingPeriod: 'annual' | 'monthly'): PricingTier[] => [
  {
    name: 'Growth',
    description: t(
      'pricing.appView.tiers.growth.description',
      'For teams starting digital transformation'
    ),
    annualPrice: '€7,990',
    monthlyPrice: '€799',
    priceNote:
      billingPeriod === 'annual'
        ? t('pricing.appView.priceNote.year', '/year')
        : t('pricing.appView.priceNote.month', '/month'),
    icon: Zap,
    seats: t('pricing.appView.tiers.growth.seats', '5 seats'),
    aiCredits: t('pricing.appView.tiers.growth.aiCredits', '5,000 AI Credits/mo.'),
    extraSeatPrice: t('pricing.appView.tiers.growth.extraSeatPrice', '€99/seat'),
    overagePrice: '€0.05/credit',
    features: [
      { name: 'AI Strategic Assessments', included: true },
      { name: t('pricing.appView.features.roadmapGeneration', 'Roadmap generation'), included: true },
      {
        name: t('pricing.appView.features.initiativeManagement', 'Initiative management'),
        included: true,
      },
      { name: 'Basic Stage-Gate', included: true },
      { name: '1 Workspace', included: true },
      { name: 'Email Support (48h)', included: true },
      { name: t('pricing.appView.features.basicAnalytics', 'Basic analytics'), included: true },
      { name: 'SSO (Google/Microsoft)', included: false },
      { name: 'API Access', included: false },
      { name: t('pricing.appView.features.byok', 'BYOK (bring your own AI keys)'), included: false },
      { name: 'Custom Dashboards', included: false },
      { name: t('pricing.appView.features.dedicatedCsm', 'Dedicated CSM'), included: false },
    ],
    cta: t('pricing.appView.tiers.growth.cta', 'Start trial'),
    ctaVariant: 'outline',
  },
  {
    name: 'Scale',
    description: t(
      'pricing.appView.tiers.scale.description',
      'For organizations running transformation at scale'
    ),
    annualPrice: '€19,990',
    monthlyPrice: '€1,999',
    priceNote:
      billingPeriod === 'annual'
        ? t('pricing.appView.priceNote.year', '/year')
        : t('pricing.appView.priceNote.month', '/month'),
    highlight: true,
    badge: t('pricing.appView.tiers.scale.badge', 'Most popular'),
    icon: Rocket,
    seats: t('pricing.appView.tiers.scale.seats', '15 seats'),
    aiCredits: t('pricing.appView.tiers.scale.aiCredits', '20,000 AI Credits/mo.'),
    extraSeatPrice: t('pricing.appView.tiers.scale.extraSeatPrice', '€79/seat'),
    overagePrice: '€0.04/credit',
    byokPrice: '€0.015/credit',
    features: [
      { name: 'AI Strategic Assessments', included: true },
      { name: t('pricing.appView.features.roadmapGeneration', 'Roadmap generation'), included: true },
      {
        name: t('pricing.appView.features.initiativeManagement', 'Initiative management'),
        included: true,
      },
      { name: 'Full Stage-Gate Governance', included: true },
      { name: '5 Workspaces', included: true },
      { name: 'Priority Support (24h)', included: true },
      {
        name: t('pricing.appView.features.advancedAnalytics', 'Advanced analytics'),
        included: true,
      },
      { name: 'SSO (Google/Microsoft)', included: true },
      { name: 'API Access', included: true },
      { name: t('pricing.appView.features.byok', 'BYOK (bring your own AI keys)'), included: true },
      { name: 'Custom Dashboards', included: true },
      { name: t('pricing.appView.features.dedicatedCsm', 'Dedicated CSM'), included: false },
    ],
    cta: t('pricing.appView.tiers.scale.cta', 'Start trial'),
    ctaVariant: 'primary',
  },
  {
    name: 'Enterprise',
    description: t(
      'pricing.appView.tiers.enterprise.description',
      'For large organizations with comprehensive requirements'
    ),
    annualPrice: 'Custom',
    monthlyPrice: t('pricing.appView.tiers.enterprise.monthlyPrice', 'from €4,999'),
    priceNote: t('pricing.appView.priceNote.month', '/month'),
    icon: Building2,
    seats: t('pricing.appView.tiers.enterprise.seats', '50+ seats'),
    aiCredits: t('pricing.appView.tiers.enterprise.aiCredits', '100,000 AI Credits/mo.'),
    extraSeatPrice: t('pricing.appView.tiers.enterprise.extraSeatPrice', '€59/seat'),
    overagePrice: '€0.03/credit',
    byokPrice: '€0.01/credit',
    features: [
      { name: 'AI Strategic Assessments', included: true },
      { name: t('pricing.appView.features.roadmapGeneration', 'Roadmap generation'), included: true },
      {
        name: t('pricing.appView.features.initiativeManagement', 'Initiative management'),
        included: true,
      },
      { name: 'Custom Stage-Gate Workflows', included: true },
      { name: 'Unlimited Workspaces', included: true },
      { name: 'SLA Support (4h)', included: true },
      { name: 'Enterprise Analytics', included: true },
      { name: 'SAML/LDAP/SCIM SSO', included: true },
      { name: 'Full API & Webhooks', included: true },
      { name: t('pricing.appView.features.byok', 'BYOK (bring your own AI keys)'), included: true },
      { name: 'Custom Dashboards', included: true },
      { name: t('pricing.appView.features.dedicatedCsm', 'Dedicated CSM'), included: true },
    ],
    cta: t('pricing.appView.tiers.enterprise.cta', 'Book a call'),
    ctaVariant: 'secondary',
  },
];

const getFaqs = (t: TFunction): FAQ[] => [
  {
    question: t('pricing.appView.faqs.whatAreCredits.question', 'What are AI Credits?'),
    answer: t(
      'pricing.appView.faqs.whatAreCredits.answer',
      'AI Credits are used when interacting with AI features, such as assessments, roadmap generation, and strategic analysis. Each action consumes a number of credits depending on complexity. Unused credits do not roll over to the next month.'
    ),
  },
  {
    question: t('pricing.appView.faqs.whatIsByok.question', 'What is BYOK (Bring Your Own Key)?'),
    answer: t(
      'pricing.appView.faqs.whatIsByok.answer',
      'BYOK lets you use your own OpenAI, Anthropic, or Azure API keys. You pay the AI provider directly for tokens, and we charge a small orchestration fee (€0.01-0.015/credit) for prompt engineering and context management.'
    ),
  },
  {
    question: t('pricing.appView.faqs.addSeats.question', 'Can I add more seats?'),
    answer: t(
      'pricing.appView.faqs.addSeats.answer',
      'Yes! You can add extra seats at any time. Prices: €99/seat (Growth), €79/seat (Scale), €59/seat (Enterprise) per month.'
    ),
  },
  {
    question: t(
      'pricing.appView.faqs.overCredits.question',
      'What happens when I exceed AI Credits?'
    ),
    answer: t(
      'pricing.appView.faqs.overCredits.answer',
      "You can keep using AI features - the overage is billed at the plan's rate (€0.03-0.05/credit). We'll notify you once you reach 80% of your limit."
    ),
  },
  {
    question: t('pricing.appView.faqs.freeTrial.question', 'Is there a free trial?'),
    answer: t(
      'pricing.appView.faqs.freeTrial.answer',
      'Yes! All plans include a 14-day free trial with full access to Scale features, 2,000 AI Credits, and 5 seats. No credit card required.'
    ),
  },
  {
    question: t(
      'pricing.appView.faqs.managedVsByok.question',
      'What is the difference between Managed AI and BYOK?'
    ),
    answer: t(
      'pricing.appView.faqs.managedVsByok.answer',
      'With Managed AI, we manage everything - you just use the features. With BYOK, you control cost and compliance using your own API keys. BYOK is ideal for enterprises with existing AI contracts or strict data requirements.'
    ),
  },
];

const getCreditUsage = (t: TFunction) => [
  { action: 'Assessment Question', credits: '5' },
  { action: 'Initiative Generation', credits: '15' },
  { action: 'Roadmap Generation', credits: '50' },
  { action: 'ROI Calculation', credits: '20' },
  { action: 'Report Generation', credits: '30' },
  { action: 'Chat Message', credits: '2-5' },
  {
    action: 'Document Analysis',
    credits: t('pricing.appView.creditUsage.perPage', '3/page'),
  },
  { action: 'Strategic Analysis', credits: '25' },
];

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const AppPricingView: React.FC = () => {
  const { t } = useTranslation();
  const { setCurrentView } = useAppStore();
  const [billingPeriod, setBillingPeriod] = useState<'annual' | 'monthly'>('annual');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const tiers = getTiers(t, billingPeriod);
  const faqs = getFaqs(t);
  const creditUsage = getCreditUsage(t);

  const handleCtaClick = (tier: PricingTier) => {
    if (tier.name === 'Enterprise') {
      window.open(CALENDAR_URL, '_blank');
    } else {
      // Navigate to trial or contact
      window.open('/trial/start', '_blank');
    }
  };

  return (
    <div className="min-h-full overflow-y-auto bg-c-surface-raised">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary-50 via-white to-slate-50 px-6 pb-12 pt-10 dark:from-navy-900 dark:via-navy-950 dark:to-navy-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary-100/40 via-transparent to-transparent dark:from-primary-900/20" />

        <div className="relative mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-primary-100 px-4 py-2 text-sm font-semibold text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
              <Sparkles size={16} />
              {t('pricing.appView.badge', 'Pricing')}
            </span>

            <h1 className="mt-6 text-3xl font-black tracking-tight text-navy-950 dark:text-white md:text-4xl">
              {t('pricing.appView.heading', 'AI Strategic Consulting,')}{' '}
              <span className="bg-gradient-to-r from-primary-600 to-crimson-600 bg-clip-text text-transparent">
                {t('pricing.appView.headingAccent', 'scaled for you')}
              </span>
            </h1>

            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-c-text-secondary">
              {t(
                'pricing.appView.subtitle',
                'Replace costly consultants with AI-powered strategic support. 14-day trial. No credit card.'
              )}
            </p>

            {/* Billing Toggle */}
            <div className="mt-8 inline-flex items-center gap-3 rounded-xl bg-c-surface p-1.5 shadow-sm dark:bg-navy-900">
              <button
                onClick={() => setBillingPeriod('annual')}
                className={`rounded-xl p-4 py-2.5 text-sm font-bold transition-all ${
                  billingPeriod === 'annual'
                    ? 'bg-navy-900 text-white shadow-md'
                    : 'text-c-text-muted hover:text-c-text-secondary dark:hover:text-slate-300'
                }`}
              >
                {t('pricing.appView.billingToggle.annual', 'Annually')}
                <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  -17%
                </span>
              </button>
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`rounded-xl p-4 py-2.5 text-sm font-bold transition-all ${
                  billingPeriod === 'monthly'
                    ? 'bg-navy-900 text-white shadow-md'
                    : 'text-c-text-muted hover:text-c-text-secondary dark:hover:text-slate-300'
                }`}
              >
                {t('pricing.appView.billingToggle.monthly', 'Monthly')}
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-6 md:grid-cols-3">
            {tiers.map((tier, idx) => {
              const Icon = tier.icon;
              const displayPrice =
                billingPeriod === 'annual' ? tier.annualPrice : tier.monthlyPrice;

              return (
                <motion.div
                  key={tier.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  className={`relative flex flex-col rounded-xl p-6 ${
                    tier.highlight
                      ? 'bg-gradient-to-b from-primary-600 to-primary-700 text-white ring-4 ring-primary-500/50 shadow-2xl shadow-primary-500/20 scale-[1.02] z-10'
                      : 'bg-c-surface border border-c-border-subtle'
                  }`}
                >
                  {tier.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-black uppercase tracking-wider text-navy-950 shadow-lg">
                        {tier.badge}
                      </span>
                    </div>
                  )}

                  {/* Header */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                        tier.highlight ? 'bg-c-surface/20' : 'bg-primary-100 dark:bg-primary-900/30'
                      }`}
                    >
                      <Icon
                        size={22}
                        className={
                          tier.highlight ? 'text-white' : 'text-primary-600 dark:text-primary-400'
                        }
                      />
                    </div>
                    <h3
                      className={`text-xl font-black ${
                        tier.highlight ? 'text-white' : 'text-navy-950 dark:text-white'
                      }`}
                    >
                      {tier.name}
                    </h3>
                  </div>

                  <p
                    className={`mt-3 text-sm ${
                      tier.highlight ? 'text-primary-100' : 'text-c-text-muted'
                    }`}
                  >
                    {tier.description}
                  </p>

                  {/* Price */}
                  <div className="mt-5">
                    <span
                      className={`text-3xl font-black ${
                        tier.highlight ? 'text-white' : 'text-navy-950 dark:text-white'
                      }`}
                    >
                      {displayPrice}
                    </span>
                    <span
                      className={`ml-1 text-sm ${
                        tier.highlight ? 'text-primary-200' : 'text-c-text-muted'
                      }`}
                    >
                      {tier.priceNote}
                    </span>
                  </div>

                  {/* Key Metrics */}
                  <div
                    className={`mt-5 grid grid-cols-2 gap-2 rounded-xl p-3 ${
                      tier.highlight ? 'bg-c-surface/10' : 'bg-c-surface-raised'
                    }`}
                  >
                    <div>
                      <div
                        className={`text-xs ${
                          tier.highlight ? 'text-primary-200' : 'text-c-text-muted'
                        }`}
                      >
                        {t('pricing.appView.metrics.seats', 'Seats')}
                      </div>
                      <div
                        className={`text-sm font-bold ${
                          tier.highlight ? 'text-white' : 'text-navy-950 dark:text-white'
                        }`}
                      >
                        {tier.seats}
                      </div>
                    </div>
                    <div>
                      <div
                        className={`text-xs ${
                          tier.highlight ? 'text-primary-200' : 'text-c-text-muted'
                        }`}
                      >
                        AI Credits
                      </div>
                      <div
                        className={`text-sm font-bold ${
                          tier.highlight ? 'text-white' : 'text-navy-950 dark:text-white'
                        }`}
                      >
                        {tier.aiCredits}
                      </div>
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="mt-5 flex-1 space-y-2">
                    {tier.features.slice(0, 8).map((feature, fIdx) => (
                      <li key={fIdx} className="flex items-start gap-2">
                        {feature.included ? (
                          <Check
                            size={16}
                            className={`mt-0.5 flex-shrink-0 ${
                              tier.highlight ? 'text-primary-200' : 'text-green-500'
                            }`}
                          />
                        ) : (
                          <X
                            size={16}
                            className={`mt-0.5 flex-shrink-0 ${
                              tier.highlight ? 'text-primary-300/50' : 'text-c-text-secondary'
                            }`}
                          />
                        )}
                        <span
                          className={`text-xs ${
                            feature.included
                              ? tier.highlight
                                ? 'text-primary-100'
                                : 'text-c-text-secondary'
                              : tier.highlight
                                ? 'text-primary-300/50'
                                : 'text-c-text-secondary'
                          }`}
                        >
                          {feature.name}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <button
                    onClick={() => handleCtaClick(tier)}
                    className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition ${
                      tier.ctaVariant === 'primary'
                        ? 'bg-c-surface text-primary-700 hover:bg-primary-50 shadow-lg'
                        : tier.ctaVariant === 'secondary'
                          ? 'bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800'
                          : 'border-2 border-c-border dark:border-white/20 text-navy-950 dark:text-white hover:bg-c-bg dark:hover:bg-c-surface/5'
                    }`}
                  >
                    {tier.cta}
                    <ArrowRight size={16} />
                  </button>
                </motion.div>
              );
            })}
          </div>

          {/* Trust indicators */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-c-text-muted">
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-green-500" />
              <span>GDPR Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <Users size={18} className="text-blue-500" />
              <span>{t('pricing.appView.cancelAnytime', 'Cancel anytime')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Cpu size={18} className="text-primary-500" />
              <span>EU Data Centers</span>
            </div>
          </div>
        </div>
      </section>

      {/* AI Credits Section */}
      <section className="bg-c-surface px-6 py-12 dark:bg-navy-900/50">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-black text-navy-950 dark:text-white">
              {t('pricing.appView.creditsSection.heading', 'AI Credits: two ways to pay')}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-c-text-secondary">
              {t(
                'pricing.appView.creditsSection.subtitle',
                'Choose Managed AI for simplicity or BYOK for control. Both options give full access to AI features.'
              )}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Managed AI */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="rounded-xl border border-c-border-subtle bg-c-surface p-6 dark:border-navy-700 dark:bg-navy-900"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/30">
                  <TeresaMark size={22} className="text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-navy-950 dark:text-white">Managed AI</h3>
                  <span className="text-xs font-medium text-green-600 dark:text-green-400">
                    {t('pricing.appView.creditsSection.default', 'Default')}
                  </span>
                </div>
              </div>
              <p className="text-sm text-c-text-secondary mb-4">
                {t(
                  'pricing.appView.creditsSection.managedDescription',
                  'We manage everything. Latest models, optimized prompts, automatic failover.'
                )}
              </p>
              <div className="space-y-2">
                {[
                  { label: 'Growth overage', value: '€0.05/credit' },
                  { label: 'Scale overage', value: '€0.04/credit' },
                  { label: 'Enterprise overage', value: '€0.03/credit' },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-2 border-b border-c-border-subtle last:border-0 dark:border-navy-700"
                  >
                    <span className="text-sm text-c-text-secondary">{item.label}</span>
                    <span className="text-sm font-bold text-navy-950 dark:text-white">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* BYOK */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="rounded-xl border border-c-border-subtle bg-c-surface p-6 dark:border-navy-700 dark:bg-navy-900"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
                  <Key size={22} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-navy-950 dark:text-white">BYOK Mode</h3>
                  <span className="text-xs font-medium text-primary-600 dark:text-primary-400">
                    Scale+ only
                  </span>
                </div>
              </div>
              <p className="text-sm text-c-text-secondary mb-4">
                {t(
                  'pricing.appView.creditsSection.byokDescription',
                  'Use your own OpenAI/Anthropic/Azure keys. You pay providers directly.'
                )}
              </p>
              <div className="space-y-2">
                {[
                  { label: 'Scale orchestration', value: '€0.015/credit' },
                  { label: 'Enterprise orchestration', value: '€0.01/credit' },
                  { label: 'Local LLM (Llama, Mistral)', value: '€0.01/credit' },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-2 border-b border-c-border-subtle last:border-0 dark:border-navy-700"
                  >
                    <span className="text-sm text-c-text-secondary">{item.label}</span>
                    <span className="text-sm font-bold text-navy-950 dark:text-white">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Credit Usage Examples */}
          <div className="mt-8 rounded-xl border border-c-border-subtle bg-c-surface p-6 dark:border-navy-700 dark:bg-navy-900">
            <h3 className="flex items-center gap-2 text-base font-bold text-navy-950 dark:text-white mb-4">
              <Server size={18} className="text-primary-500" />
              {t('pricing.appView.creditsSection.usageHeading', 'What uses AI Credits?')}
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {creditUsage.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-xl bg-c-bg p-3 dark:bg-navy-950"
                >
                  <span className="text-xs text-c-text-secondary">{item.action}</span>
                  <span className="text-xs font-bold text-primary-600 dark:text-primary-400">
                    {item.credits}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="px-6 py-12">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-black text-navy-950 dark:text-white">
              {t('pricing.appView.faqHeading', 'Frequently asked questions')}
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05 }}
                className="overflow-hidden rounded-xl border border-c-border-subtle bg-c-surface dark:border-navy-700 dark:bg-navy-900"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                  className="flex w-full items-center justify-between p-4 text-left"
                >
                  <div className="flex items-start gap-3">
                    <HelpCircle size={18} className="mt-0.5 flex-shrink-0 text-primary-500" />
                    <span className="text-sm font-bold text-navy-950 dark:text-white">
                      {faq.question}
                    </span>
                  </div>
                  <motion.div
                    animate={{ rotate: expandedFaq === idx ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ArrowRight
                      size={16}
                      className="flex-shrink-0 rotate-90 text-c-text-secondary"
                    />
                  </motion.div>
                </button>
                {expandedFaq === idx && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="border-t border-c-border-subtle px-4 pb-4 pt-3 dark:border-navy-700"
                  >
                    <p className="pl-7 text-sm text-c-text-secondary">{faq.answer}</p>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-12">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-2xl font-black text-white">
            {t('pricing.appView.finalCta.heading', 'Ready to transform?')}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-primary-100">
            {t(
              'pricing.appView.finalCta.subtitle',
              'Start your 14-day trial today. Full Scale features, 2,000 AI Credits, 5 seats. No credit card required.'
            )}
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              onClick={() => window.open('/trial/start', '_blank')}
              className="inline-flex items-center gap-2 rounded-full bg-c-surface px-6 py-3 text-sm font-bold text-primary-700 shadow-lg transition hover:bg-primary-50"
            >
              {t('pricing.appView.finalCta.startTrial', 'Start trial')}
              <ArrowRight size={16} />
            </button>
            <button
              onClick={() => window.open(CALENDAR_URL, '_blank')}
              className="inline-flex items-center gap-2 rounded-full border-2 border-white/30 px-6 py-3 text-sm font-bold text-white transition hover:bg-c-surface-raised/40"
            >
              <Calendar size={16} />
              {t('pricing.appView.finalCta.bookDemo', 'Book a demo')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AppPricingView;
