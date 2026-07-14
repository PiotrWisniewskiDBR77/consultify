import { motion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  Building2,
  Calendar,
  Check,
  Cpu,
  HelpCircle,
  Key,
  Rocket,
  Server,
  Shield,
  Users,
  X,
  Zap,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { AnnaAssistantWidget } from '../components/Landing/AnnaAssistantWidget';
import { EntryFooter } from '../components/Landing/EntryFooter';
import { EntryTopBar } from '../components/Landing/EntryTopBar';
import TeresaMark from '../components/shared/TeresaMark';
const CALENDAR_URL =
  'https://meetings.hubspot.com/piotr-wisniewski1?uuid=a2976570-a2d2-4682-9e5f-c3958a7af017';

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

export const PricingView: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [billingPeriod, setBillingPeriod] = useState<'annual' | 'monthly'>('annual');

  const handleTrialClick = () => {
    navigate('/trial/start');
  };

  const handleDemoClick = () => {
    navigate('/demo');
  };

  const handleContactClick = () => {
    navigate('/contact');
  };

  const tiers: PricingTier[] = [
    {
      name: 'Growth',
      description: 'For scaling teams starting their transformation journey',
      annualPrice: '€7,990',
      monthlyPrice: '€799',
      priceNote: billingPeriod === 'annual' ? '/year' : '/month',
      icon: Zap,
      seats: '5 seats included',
      aiCredits: '5,000 AI Credits/mo',
      extraSeatPrice: '€99/seat/mo',
      overagePrice: '€0.05/credit',
      features: [
        { name: 'AI Strategic Assessments', included: true },
        { name: 'Roadmap Generation', included: true },
        { name: 'Initiative Management', included: true },
        { name: 'Basic Stage-Gate', included: true },
        { name: '1 Workspace', included: true },
        { name: 'Email Support (48h)', included: true },
        { name: 'Basic Analytics', included: true },
        { name: 'SSO (Google/Microsoft)', included: false },
        { name: 'API Access', included: false },
        { name: 'BYOK (Own AI Keys)', included: false },
        { name: 'Custom Dashboards', included: false },
        { name: 'Dedicated CSM', included: false },
      ],
      cta: 'Start Free Trial',
      ctaVariant: 'outline',
    },
    {
      name: 'Scale',
      description: 'For established organizations driving digital change',
      annualPrice: '€19,990',
      monthlyPrice: '€1,999',
      priceNote: billingPeriod === 'annual' ? '/year' : '/month',
      highlight: true,
      badge: 'Most Popular',
      icon: Rocket,
      seats: '15 seats included',
      aiCredits: '20,000 AI Credits/mo',
      extraSeatPrice: '€79/seat/mo',
      overagePrice: '€0.04/credit',
      byokPrice: '€0.015/credit',
      features: [
        { name: 'AI Strategic Assessments', included: true },
        { name: 'Roadmap Generation', included: true },
        { name: 'Initiative Management', included: true },
        { name: 'Full Stage-Gate Governance', included: true },
        { name: '5 Workspaces', included: true },
        { name: 'Priority Support (24h)', included: true },
        { name: 'Advanced Analytics', included: true },
        { name: 'SSO (Google/Microsoft)', included: true },
        { name: 'API Access', included: true },
        { name: 'BYOK (Own AI Keys)', included: true },
        { name: 'Custom Dashboards', included: true },
        { name: 'Dedicated CSM', included: false },
      ],
      cta: 'Start Free Trial',
      ctaVariant: 'primary',
    },
    {
      name: 'Enterprise',
      description: 'For large organizations with complex requirements',
      annualPrice: 'Custom',
      monthlyPrice: 'from €4,999',
      priceNote: '/month',
      icon: Building2,
      seats: '50+ seats',
      aiCredits: '100,000 AI Credits/mo',
      extraSeatPrice: '€59/seat/mo',
      overagePrice: '€0.03/credit',
      byokPrice: '€0.01/credit',
      features: [
        { name: 'AI Strategic Assessments', included: true },
        { name: 'Roadmap Generation', included: true },
        { name: 'Initiative Management', included: true },
        { name: 'Custom Stage-Gate Workflows', included: true },
        { name: 'Unlimited Workspaces', included: true },
        { name: 'SLA Support (4h)', included: true },
        { name: 'Enterprise Analytics', included: true },
        { name: 'SAML/LDAP/SCIM SSO', included: true },
        { name: 'Full API & Webhooks', included: true },
        { name: 'BYOK (Own AI Keys)', included: true },
        { name: 'Custom Dashboards', included: true },
        { name: 'Dedicated CSM', included: true },
      ],
      cta: 'Contact Sales',
      ctaVariant: 'secondary',
    },
  ];

  const faqs = [
    {
      q: 'What are AI Credits?',
      a: 'AI Credits are used when you interact with AI features like assessments, roadmap generation, and strategic analysis. Each action consumes a certain number of credits based on complexity. Unused credits do not roll over.',
    },
    {
      q: 'What is BYOK (Bring Your Own Key)?',
      a: 'BYOK allows you to use your own OpenAI, Anthropic, or Azure API keys. You pay the AI provider directly for tokens, and we charge a small orchestration fee (€0.01-0.015/credit) for prompt engineering and context management.',
    },
    {
      q: 'Can I add more seats to my plan?',
      a: 'Yes! You can add extra seats at any time. Pricing is €99/seat (Growth), €79/seat (Scale), or €59/seat (Enterprise) per month.',
    },
    {
      q: 'What happens if I exceed my AI Credits?',
      a: "You can continue using AI features - overage is billed at the plan rate (€0.03-0.05/credit). We'll notify you when you reach 80% of your allocation.",
    },
    {
      q: 'Is there a free trial?',
      a: 'Yes! All plans include a 7-day free trial with full access to Scale features, 2,000 AI Credits, and 5 seats. No credit card required.',
    },
    {
      q: "What's the difference between Managed AI and BYOK?",
      a: 'With Managed AI, we handle everything - you just use the features. With BYOK, you control costs and compliance by using your own API keys. BYOK is ideal for enterprises with existing AI contracts or strict data requirements.',
    },
  ];

  const handleCtaClick = (tier: PricingTier) => {
    if (tier.name === 'Enterprise') {
      window.open(CALENDAR_URL, '_blank');
    } else {
      handleTrialClick();
    }
  };

  return (
    <div className="min-h-screen bg-c-surface flex flex-col">
      <EntryTopBar
        onTrialClick={handleTrialClick}
        onDemoClick={handleDemoClick}
        onLoginClick={() => navigate('/login')}
        isLoggedIn={false}
        hasWorkspace={false}
      />

      {/* Hero */}
      <section className="pt-32 pb-12 px-6 bg-gradient-to-b from-primary-50 to-white dark:from-navy-900 dark:to-navy-950">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/30
                                         text-primary-600 dark:text-primary-400 text-sm font-semibold mb-6"
            >
              <BarChart3 size={16} />
              Pricing
            </span>

            <h1 className="text-4xl md:text-5xl font-black text-navy-950 dark:text-white mb-6 tracking-tight">
              AI Strategic Consulting,{' '}
              <span className="bg-gradient-to-r from-primary-600 to-crimson-600 bg-clip-text text-transparent">
                priced for scale
              </span>
            </h1>

            <p className="text-lg text-c-text-secondary max-w-2xl mx-auto leading-relaxed mb-8">
              Replace expensive consultants with AI-powered strategic guidance. 7-day free trial. No
              credit card required.
            </p>

            {/* Billing Toggle */}
            <div className="inline-flex items-center gap-3 p-1.5 bg-c-surface-raised rounded-xl">
              <button
                onClick={() => setBillingPeriod('annual')}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  billingPeriod === 'annual'
                    ? 'bg-c-surface text-navy-950 dark:text-white shadow-md'
                    : 'text-c-text-muted hover:text-c-text-secondary dark:hover:text-slate-300'
                }`}
              >
                Annual
                <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-semibold">
                  Save 17%
                </span>
              </button>
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  billingPeriod === 'monthly'
                    ? 'bg-c-surface text-navy-950 dark:text-white shadow-md'
                    : 'text-c-text-muted hover:text-c-text-secondary dark:hover:text-slate-300'
                }`}
              >
                Monthly
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-12 px-6 flex-1">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
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
                  className={`relative rounded-xl p-8 flex flex-col ${
                    tier.highlight
                      ? 'bg-gradient-to-b from-primary-600 to-primary-700 text-white ring-4 ring-primary-500/50 shadow-2xl shadow-primary-500/20 scale-105 z-10'
                      : 'bg-c-surface border border-c-border-subtle'
                  }`}
                >
                  {tier.badge && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <span className="px-4 py-1.5 bg-amber-400 text-navy-950 text-xs font-black uppercase tracking-wider rounded-full shadow-lg">
                        {tier.badge}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        tier.highlight ? 'bg-c-surface/20' : 'bg-primary-100 dark:bg-primary-900/30'
                      }`}
                    >
                      <Icon
                        size={24}
                        className={
                          tier.highlight ? 'text-white' : 'text-primary-600 dark:text-primary-400'
                        }
                      />
                    </div>
                    <h3
                      className={`text-2xl font-black ${tier.highlight ? 'text-white' : 'text-navy-950 dark:text-white'}`}
                    >
                      {tier.name}
                    </h3>
                  </div>

                  <p
                    className={`text-sm mb-6 ${tier.highlight ? 'text-primary-100' : 'text-c-text-muted'}`}
                  >
                    {tier.description}
                  </p>

                  <div className="mb-4">
                    <span
                      className={`text-4xl font-black ${tier.highlight ? 'text-white' : 'text-navy-950 dark:text-white'}`}
                    >
                      {displayPrice}
                    </span>
                    <span
                      className={`text-sm ml-2 ${tier.highlight ? 'text-primary-200' : 'text-c-text-muted'}`}
                    >
                      {tier.priceNote}
                    </span>
                  </div>

                  {/* Key Metrics */}
                  <div
                    className={`grid grid-cols-2 gap-3 mb-6 p-4 rounded-xl ${
                      tier.highlight ? 'bg-c-surface/10' : 'bg-c-surface-raised'
                    }`}
                  >
                    <div>
                      <div
                        className={`text-xs font-medium mb-1 ${tier.highlight ? 'text-primary-200' : 'text-c-text-muted'}`}
                      >
                        Seats
                      </div>
                      <div
                        className={`text-sm font-bold ${tier.highlight ? 'text-white' : 'text-navy-950 dark:text-white'}`}
                      >
                        {tier.seats}
                      </div>
                    </div>
                    <div>
                      <div
                        className={`text-xs font-medium mb-1 ${tier.highlight ? 'text-primary-200' : 'text-c-text-muted'}`}
                      >
                        AI Credits
                      </div>
                      <div
                        className={`text-sm font-bold ${tier.highlight ? 'text-white' : 'text-navy-950 dark:text-white'}`}
                      >
                        {tier.aiCredits}
                      </div>
                    </div>
                    <div>
                      <div
                        className={`text-xs font-medium mb-1 ${tier.highlight ? 'text-primary-200' : 'text-c-text-muted'}`}
                      >
                        Extra Seats
                      </div>
                      <div
                        className={`text-sm font-bold ${tier.highlight ? 'text-white' : 'text-navy-950 dark:text-white'}`}
                      >
                        {tier.extraSeatPrice}
                      </div>
                    </div>
                    <div>
                      <div
                        className={`text-xs font-medium mb-1 ${tier.highlight ? 'text-primary-200' : 'text-c-text-muted'}`}
                      >
                        Overage
                      </div>
                      <div
                        className={`text-sm font-bold ${tier.highlight ? 'text-white' : 'text-navy-950 dark:text-white'}`}
                      >
                        {tier.overagePrice}
                      </div>
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-2.5 mb-8 flex-1">
                    {tier.features.map((feature, fIdx) => (
                      <li key={fIdx} className="flex items-center gap-3">
                        {feature.included ? (
                          <Check
                            size={16}
                            className={`flex-shrink-0 ${
                              tier.highlight ? 'text-primary-200' : 'text-green-500'
                            }`}
                          />
                        ) : (
                          <X
                            size={16}
                            className={`flex-shrink-0 ${
                              tier.highlight ? 'text-primary-300/50' : 'text-c-text-secondary'
                            }`}
                          />
                        )}
                        <span
                          className={`text-sm ${
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

                  <button
                    onClick={() => handleCtaClick(tier)}
                    className={`w-full py-4 px-6 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
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
          <div className="mt-16 text-center">
            <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-c-text-muted">
              <div className="flex items-center gap-2">
                <Shield size={18} className="text-green-500" />
                <span>GDPR Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <Users size={18} className="text-blue-500" />
                <span>Cancel anytime</span>
              </div>
              <div className="flex items-center gap-2">
                <Cpu size={18} className="text-primary-500" />
                <span>EU Data Centers</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Credits Section */}
      <section className="py-16 px-6 bg-c-surface-raised/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-navy-950 dark:text-white mb-4">
              AI Credits: Two Ways to Pay
            </h2>
            <p className="text-c-text-secondary max-w-2xl mx-auto">
              Choose Managed AI for simplicity, or BYOK for control. Both options give you full
              access to AI features.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Managed AI */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-c-surface rounded-xl p-8 border border-c-border-subtle"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
                  <TeresaMark size={24} className="text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-navy-950 dark:text-white">Managed AI</h3>
                  <span className="text-xs font-medium text-green-600 dark:text-green-400">
                    Default
                  </span>
                </div>
              </div>
              <p className="text-c-text-secondary text-sm mb-6">
                We handle everything. Latest models, optimized prompts, automatic failover between
                providers.
              </p>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-c-border-subtle">
                  <span className="text-sm text-c-text-secondary">Growth overage</span>
                  <span className="font-bold text-navy-950 dark:text-white">€0.05/credit</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-c-border-subtle">
                  <span className="text-sm text-c-text-secondary">Scale overage</span>
                  <span className="font-bold text-navy-950 dark:text-white">€0.04/credit</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-c-text-secondary">Enterprise overage</span>
                  <span className="font-bold text-navy-950 dark:text-white">€0.03/credit</span>
                </div>
              </div>
            </motion.div>

            {/* BYOK */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-c-surface rounded-xl p-8 border border-c-border-subtle"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                  <Key size={24} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-navy-950 dark:text-white">BYOK Mode</h3>
                  <span className="text-xs font-medium text-primary-600 dark:text-primary-400">
                    Scale+ only
                  </span>
                </div>
              </div>
              <p className="text-c-text-secondary text-sm mb-6">
                Use your own OpenAI/Anthropic/Azure keys. You pay providers directly, we charge
                orchestration fee.
              </p>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-c-border-subtle">
                  <span className="text-sm text-c-text-secondary">Scale orchestration</span>
                  <span className="font-bold text-navy-950 dark:text-white">€0.015/credit</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-c-border-subtle">
                  <span className="text-sm text-c-text-secondary">Enterprise orchestration</span>
                  <span className="font-bold text-navy-950 dark:text-white">€0.01/credit</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-c-text-secondary">Local LLM (Llama, Mistral)</span>
                  <span className="font-bold text-navy-950 dark:text-white">€0.01/credit</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Credit Usage Examples */}
          <div className="mt-12 bg-c-surface rounded-xl p-8 border border-c-border-subtle">
            <h3 className="text-lg font-bold text-navy-950 dark:text-white mb-6 flex items-center gap-2">
              <Server size={20} className="text-primary-500" />
              What uses AI Credits?
            </h3>
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { action: 'Assessment Question', credits: '5' },
                { action: 'Initiative Generation', credits: '15' },
                { action: 'Roadmap Generation', credits: '50' },
                { action: 'ROI Calculation', credits: '20' },
                { action: 'Report Generation', credits: '30' },
                { action: 'Chat Message', credits: '2-5' },
                { action: 'Document Analysis', credits: '3/page' },
                { action: 'Strategic Analysis', credits: '25' },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center p-3 bg-c-surface-raised rounded-lg"
                >
                  <span className="text-sm text-c-text-secondary">{item.action}</span>
                  <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                    {item.credits}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-navy-950 dark:text-white mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-c-text-secondary">
              Have more questions?{' '}
              <a href="/contact" className="text-primary-600 hover:underline">
                Contact us
              </a>
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05 }}
                className="bg-c-surface rounded-xl p-6 border border-c-border-subtle"
              >
                <h3 className="font-bold text-navy-950 dark:text-white mb-2 flex items-start gap-3">
                  <HelpCircle size={20} className="text-primary-500 mt-0.5 flex-shrink-0" />
                  {faq.q}
                </h3>
                <p className="text-c-text-secondary text-sm pl-8">{faq.a}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-c-surface-raised/50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-black text-navy-950 dark:text-white mb-4">
            Ready to transform your organization?
          </h2>
          <p className="text-c-text-secondary mb-8 max-w-xl mx-auto">
            Start your 7-day free trial today. Full Scale features, 2,000 AI Credits, 5 seats. No
            credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleTrialClick}
              className="px-8 py-4 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              Start Free Trial
              <ArrowRight size={18} />
            </button>
            <a
              href={CALENDAR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 border-2 border-c-border dark:border-white/20 text-navy-950 dark:text-white font-bold rounded-xl hover:bg-c-surface dark:hover:bg-c-surface/5 transition-colors flex items-center justify-center gap-2"
            >
              <Calendar size={18} />
              Schedule a Demo
            </a>
          </div>
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

export default PricingView;
