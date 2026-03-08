import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Sparkles, Zap } from 'lucide-react';
import React, { useState } from 'react';

import { MarketingLayout } from '../components/Landing/MarketingLayout';

const plans = [
  {
    name: 'Starter',
    price: { monthly: 0, annual: 0 },
    description: 'For individuals and small teams ready to try AI-powered strategy.',
    color: '#6b7280',
    features: [
      '3 active projects',
      'AI Chat (50 messages/mo)',
      'Basic financial modeling',
      '2 report exports/mo',
      'Community support',
    ],
    cta: 'Start for free',
    popular: false,
  },
  {
    name: 'Pro',
    price: { monthly: 149, annual: 119 },
    description: 'For founders and executives running serious transformations.',
    color: '#7c3aed',
    features: [
      'Unlimited projects',
      'AI Chat (unlimited)',
      'Full financial modeling suite',
      'NPV / IRR / Sensitivity analysis',
      'Initiative management',
      'Unlimited report exports',
      'Board-ready presentation builder',
      'Priority support',
    ],
    cta: 'Start 14-day free trial',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: { monthly: null, annual: null },
    description: 'For consulting firms and enterprise teams. Custom pricing.',
    color: '#06b6d4',
    features: [
      'Everything in Pro',
      'White-label workspaces',
      'Custom LLM routing',
      'Full API & MCP access',
      'Partner revenue share',
      'SSO & advanced security',
      'SLA guarantee',
      'Dedicated success manager',
    ],
    cta: 'Talk to us',
    popular: false,
  },
];

export const PricingLandingPage: React.FC = () => {
  const [annual, setAnnual] = useState(true);

  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="relative px-6 pt-20 pb-20 overflow-hidden text-center">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[linear-gradient(160deg,#0D0828,#0A0A1F,#12082E)]" />
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-[50%] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(124,58,237,0.22) 0%, transparent 65%)',
              filter: 'blur(80px)',
            }}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary-500/30 bg-primary-600/10 mb-6"
        >
          <Sparkles size={12} className="text-primary-300" />
          <span className="text-xs font-bold text-primary-300 uppercase tracking-wider">
            Pricing
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="font-black tracking-tight text-white mb-4"
          style={{ fontSize: 'clamp(36px, 5vw, 68px)', lineHeight: 1.05 }}
        >
          Simple plans.
          <span
            className="block"
            style={{
              background: 'linear-gradient(90deg, #a78bfa, #67e8f9)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Unlimited intelligence.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.14 }}
          className="text-lg text-white/50 max-w-xl mx-auto mb-8"
        >
          Start free for 14 days. No credit card required. Cancel anytime.
        </motion.p>

        {/* Toggle */}
        <div
          className="inline-flex items-center gap-3 p-1 rounded-full mb-12"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
          }}
        >
          <button
            onClick={() => setAnnual(false)}
            className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all"
            style={{
              background: !annual ? 'rgba(255,255,255,0.12)' : 'transparent',
              color: !annual ? '#fff' : 'rgba(255,255,255,0.45)',
            }}
          >
            Monthly
          </button>
          <button
            onClick={() => setAnnual(true)}
            className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5"
            style={{
              background: annual ? 'linear-gradient(135deg, #7c3aed, #a855f7)' : 'transparent',
              color: annual ? '#fff' : 'rgba(255,255,255,0.45)',
            }}
          >
            Annual
            {annual && (
              <span className="text-[9px] font-black bg-white/20 px-1.5 py-0.5 rounded-full">
                -20%
              </span>
            )}
          </button>
        </div>
      </section>

      {/* Plans */}
      <section className="px-6 pb-24">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6">
          {plans.map((plan, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.08 }}
              className="relative p-7 rounded-2xl flex flex-col"
              style={{
                background: plan.popular ? `rgba(124,58,237,0.10)` : 'rgba(255,255,255,0.03)',
                border: plan.popular
                  ? '1px solid rgba(124,58,237,0.40)'
                  : '1px solid rgba(255,255,255,0.08)',
                boxShadow: plan.popular ? '0 0 60px -20px rgba(124,58,237,0.40)' : 'none',
              }}
            >
              {plan.popular && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-black text-white"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
                >
                  Most popular
                </div>
              )}

              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={14} style={{ color: plan.color }} />
                  <span className="text-sm font-black" style={{ color: plan.color }}>
                    {plan.name}
                  </span>
                </div>
                <div className="mb-2">
                  {plan.price.monthly !== null ? (
                    <div className="flex items-end gap-1">
                      <span className="text-4xl font-black text-white">
                        €{annual ? plan.price.annual : plan.price.monthly}
                      </span>
                      <span className="text-white/40 text-sm mb-1.5">/mo</span>
                    </div>
                  ) : (
                    <div className="text-3xl font-black text-white">Custom</div>
                  )}
                </div>
                <p className="text-sm text-white/45">{plan.description}</p>
              </div>

              <div className="space-y-2.5 mb-8 flex-1">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-center gap-2.5">
                    <CheckCircle2 size={13} style={{ color: plan.color }} className="shrink-0" />
                    <span className="text-sm text-white/65">{f}</span>
                  </div>
                ))}
              </div>

              <button
                className="w-full py-3 rounded-full text-sm font-semibold text-white transition-all flex items-center justify-center gap-2"
                style={
                  plan.popular
                    ? {
                        background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                        boxShadow: '0 0 30px -10px rgba(124,58,237,0.60)',
                      }
                    : {
                        background: 'rgba(255,255,255,0.07)',
                        border: '1px solid rgba(255,255,255,0.12)',
                      }
                }
              >
                {plan.cta} {plan.popular && <ArrowRight size={14} />}
              </button>
            </motion.div>
          ))}
        </div>

        <div className="max-w-lg mx-auto text-center mt-12">
          <p className="text-sm text-white/30">
            All plans include GDPR compliance, EU data residency, and AES-256 encryption. No AI
            training on your data.
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
};
