import { motion } from 'framer-motion';
import { ArrowRight, Building2, CheckCircle2, Coins, Layers3, MessageSquare, ShieldCheck, Sparkles } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { MarketingLayout } from '../components/Landing/MarketingLayout';
import { ROUTES } from '../routes/routeConfig';

const SEAT_PACKS = [
  {
    name: 'Core Seat',
    price: 'EUR 29',
    subtitle: 'per seat / month',
    description:
      'Built for contributors who need structured consulting workflows, workspace access, and controlled AI support.',
    bullets: [
      'Minimum organization package: 10 seats',
      'Shared organizational AI budget',
      'Access to existing data and workspace artifacts',
      'Upgrade path into manager-led rollouts',
    ],
  },
  {
    name: 'Manager Seat',
    price: 'EUR 49',
    subtitle: 'per seat / month',
    description:
      'For leaders managing initiatives, governance, delivery flow, and executive-facing outputs across the organization.',
    bullets: [
      'Portfolio, governance, and reporting workflows',
      'Uses the same shared AI budget as core seats',
      'Best fit for transformation leads and decision owners',
      'Designed for mixed teams, not isolated premium users',
    ],
    featured: true,
  },
] as const;

const BUDGET_LAYERS = [
  {
    title: 'Shared AI budget for the organization',
    body:
      'AI usage is pooled at organization level instead of being fragmented per user, which matches how real consulting teams work.',
  },
  {
    title: 'Monthly top-up packages',
    body:
      'Organizations can buy additional monthly AI budget packages. Unused balance rolls forward and accumulates instead of disappearing.',
  },
  {
    title: 'Automatic pay-as-you-go fallback',
    body:
      'When the included budget is exhausted, AI usage can continue through pay-as-you-go or by switching to a larger package.',
  },
] as const;

const LICENSED_TOOLS = [
  'Selected assessments and frameworks such as SIR or DRD can require separate licensing.',
  'Licensed tools are sold as add-ons or handled as pricing on request, not mixed into the base seat price.',
  'This keeps the core platform readable while preserving room for specialized enterprise configurations.',
] as const;

export const PricingLandingPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <MarketingLayout>
      <section className="relative overflow-hidden px-6 pb-20 pt-20 text-center">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(160deg,#0D0828,#0A0A1F,#12082E)]" />
        <div className="absolute left-1/2 top-0 -z-10 h-[420px] w-[60%] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(124,58,237,0.22)_0%,transparent_65%)] blur-[80px]" />

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 rounded-full border border-primary-500/30 bg-primary-600/10 px-3 py-1.5"
        >
          <Sparkles size={12} className="text-primary-300" />
          <span className="text-xs font-bold uppercase tracking-wider text-primary-300">
            {t('pricing.badge', 'Pricing')}
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="mx-auto mt-6 max-w-5xl font-black tracking-tight text-white"
          style={{ fontSize: 'clamp(36px, 5vw, 68px)', lineHeight: 1.05 }}
        >
          {t('pricing.heading', 'Commercial model for real rollout.')}
          <span className="block bg-gradient-to-r from-violet-300 to-cyan-300 bg-clip-text text-transparent">
            {t('pricing.headingAccent', 'Seats, shared AI budget, licensed tools, and enterprise control.')}
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.14 }}
          className="mx-auto mt-6 max-w-3xl text-lg text-white/55"
        >
          {t(
            'pricing.sub',
            'Consultify is sold as an organizational platform. Start with the seat layer, add shared AI budget for the team, and attach licensed tools only when the use case requires them.'
          )}
        </motion.p>
      </section>

      <section className="px-6 pb-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-2">
          {SEAT_PACKS.map((pack) => (
            <div
              key={pack.name}
              className={`rounded-3xl border p-8 ${
                pack.featured
                  ? 'border-violet-500/35 bg-violet-500/10 shadow-[0_0_60px_-24px_rgba(124,58,237,0.45)]'
                  : 'border-white/10 bg-white/[0.03]'
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-violet-300">
                    {pack.name}
                  </p>
                  <p className="mt-3 text-4xl font-black text-white">{pack.price}</p>
                  <p className="mt-1 text-sm text-white/45">{pack.subtitle}</p>
                </div>
                {pack.featured && (
                  <span className="rounded-full bg-violet-500 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-white">
                    Most used
                  </span>
                )}
              </div>

              <p className="mt-6 text-sm leading-6 text-white/65">{pack.description}</p>

              <div className="mt-6 space-y-3">
                {pack.bullets.map((bullet) => (
                  <div key={bullet} className="flex items-start gap-3">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-violet-300" />
                    <span className="text-sm text-white/68">{bullet}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 py-10">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-navy-700 dark:bg-navy-900">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300">
                <Coins size={22} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-500">
                  Shared AI budget
                </p>
                <h2 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
                  Usage is pooled for the whole organization
                </h2>
              </div>
            </div>

            <div className="mt-8 space-y-5">
              {BUDGET_LAYERS.map((layer) => (
                <div key={layer.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-navy-700 dark:bg-navy-950/50">
                  <p className="text-sm font-black text-slate-900 dark:text-white">{layer.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{layer.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-navy-700 dark:bg-navy-900">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300">
                <ShieldCheck size={22} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-500">
                  Over-limit behavior
                </p>
                <h2 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
                  The workspace keeps running even when AI stops
                </h2>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              {[
                'After the AI budget is exhausted, users keep access to existing data, workspaces, and prior outputs.',
                'What stops is AI assistance: generation, AI-guided support, and token-consuming actions.',
                'Teams can continue through pay-as-you-go, upgrade the package, or contact sales for a larger commercial setup.',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-navy-700 dark:bg-navy-950/50">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-amber-500" />
                  <span className="text-sm leading-6 text-slate-600 dark:text-slate-400">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-10">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-navy-700 dark:bg-navy-900">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-300">
                <Layers3 size={22} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-500">
                  Licensed tools and frameworks
                </p>
                <h2 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
                  Specialized modules stay outside the base seat price
                </h2>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              {LICENSED_TOOLS.map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-cyan-500" />
                  <span className="text-sm leading-6 text-slate-600 dark:text-slate-400">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-cyan-500/10 p-8 shadow-[0_0_80px_-32px_rgba(124,58,237,0.35)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-white">
                <Building2 size={22} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/70">
                  Enterprise
                </p>
                <h2 className="mt-1 text-2xl font-black text-white">
                  For custom deployment, governance, and commercial negotiation
                </h2>
              </div>
            </div>

            <p className="mt-8 text-sm leading-7 text-white/80">
              Enterprise plans are for organizations that need more than seat pricing: on-premise or dedicated deployment, custom legal flow, procurement support, partner-heavy rollout, licensed tool bundles, or negotiated AI budget structures.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() => navigate(ROUTES.LEGAL.CONTACT)}
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-black text-violet-700 transition hover:bg-violet-50"
              >
                Talk enterprise setup
                <ArrowRight size={16} />
              </button>
              <button
                onClick={() => navigate(ROUTES.TRIAL_ENTRY)}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-black text-white transition hover:bg-white/5"
              >
                Start trial first
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 pb-24 pt-6">
        <div className="mx-auto max-w-6xl rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center dark:border-navy-700 dark:bg-navy-900">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
            <MessageSquare size={13} />
            Sales note
          </div>
          <p className="mx-auto mt-4 max-w-4xl text-sm leading-7 text-slate-600 dark:text-slate-400">
            AI budget is sold as budget, not as a public token-rate promise, because different actions consume different model resources. Anna and Teresa can help explain which package and budget shape fit the workload before purchase.
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
};
