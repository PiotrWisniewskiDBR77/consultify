import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Sparkles, Zap } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { MarketingLayout } from '../components/Landing/MarketingLayout';
import { ROUTES } from '../routes/routeConfig';

type PlanAction = 'trial' | 'contact';

const PLAN_KEYS = ['trial', 'user', 'manager', 'enterprise'] as const;

const PLAN_VISUALS = [
  { price: { monthly: 0, annual: 0 }, color: '#6b7280', popular: false, action: 'trial' as PlanAction },
  { price: { monthly: 29, annual: 23 }, color: '#7c3aed', popular: false, action: 'trial' as PlanAction },
  { price: { monthly: 49, annual: 39 }, color: '#a855f7', popular: true, action: 'trial' as PlanAction },
  { price: { monthly: null, annual: null }, color: '#06b6d4', popular: false, action: 'contact' as PlanAction },
];

export const PricingLandingPage: React.FC = () => {
  const { t } = useTranslation();
  const [annual, setAnnual] = useState(false);

  const handlePlanClick = (action: PlanAction) => {
    if (action === 'contact') {
      window.location.href = ROUTES.LEGAL.CONTACT;
      return;
    }

    window.location.href = ROUTES.TRIAL_ENTRY;
  };

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
            {t('pricing.badge', 'Pricing')}
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="font-black tracking-tight text-white mb-4"
          style={{ fontSize: 'clamp(36px, 5vw, 68px)', lineHeight: 1.05 }}
        >
          {t('pricing.heading', 'Simple plans.')}
          <span
            className="block"
            style={{
              background: 'linear-gradient(90deg, #a78bfa, #67e8f9)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {t('pricing.headingAccent', 'Clear usage limits.')}
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.14 }}
          className="text-lg text-white/50 max-w-xl mx-auto mb-8"
        >
          {t('pricing.sub', 'Choose the package that matches your actual usage, team size, and rollout stage.')}
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
            {t('pricing.monthly', 'Monthly')}
          </button>
          <button
            onClick={() => setAnnual(true)}
            className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5"
            style={{
              background: annual ? 'linear-gradient(135deg, #7c3aed, #a855f7)' : 'transparent',
              color: annual ? '#fff' : 'rgba(255,255,255,0.45)',
            }}
          >
            {t('pricing.annual', 'Annual')}
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
        <div className="max-w-7xl mx-auto grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {PLAN_KEYS.map((key, idx) => {
            const plan = PLAN_VISUALS[idx];
            const prefix = `pricing.plans.${key}`;
            const features = (t(`${prefix}.features`, { returnObjects: true }) || []) as string[];
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
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
                    {t('pricing.mostPopular', 'Most popular')}
                  </div>
                )}

                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap size={14} style={{ color: plan.color }} />
                    <span className="text-sm font-black" style={{ color: plan.color }}>
                      {t(`${prefix}.name`)}
                    </span>
                  </div>
                  <div className="mb-2">
                    {plan.price.monthly !== null ? (
                      <div className="flex items-end gap-1">
                        <span className="text-4xl font-black text-white">
                          €{annual ? plan.price.annual : plan.price.monthly}
                        </span>
                        <span className="text-white/40 text-sm mb-1.5">{t('pricing.perMonth', '/mo')}</span>
                      </div>
                    ) : (
                      <div className="text-3xl font-black text-white">{t('pricing.custom', 'Custom')}</div>
                    )}
                  </div>
                  <p className="text-sm text-white/45">{t(`${prefix}.description`)}</p>
                </div>

                <div className="space-y-2.5 mb-8 flex-1">
                  {(Array.isArray(features) ? features : []).map((f, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <CheckCircle2 size={13} style={{ color: plan.color }} className="shrink-0" />
                      <span className="text-sm text-white/65">{f}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handlePlanClick(plan.action)}
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
                  {t(`${prefix}.cta`)} {plan.popular && <ArrowRight size={14} />}
                </button>
              </motion.div>
            );
          })}
        </div>

        <div className="max-w-lg mx-auto text-center mt-12">
          <p className="text-sm text-white/30">
            {t('pricing.footnote', 'Pricing is explicit on seats, projects, exports, and AI usage so teams can scale predictably.')}
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
};
