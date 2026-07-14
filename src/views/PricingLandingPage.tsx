import { motion } from 'framer-motion';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Coins,
  FileText,
  Layers3,
  MessageSquare,
  Scale,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { MarketingLayout } from '../components/Landing/MarketingLayout';
import { ROUTES } from '../routes/routeConfig';

const BUDGET_LAYER_KEYS = [
  {
    titleKey: 'pricing.budget.shared.title',
    titleFallback: 'Shared AI budget for the organization',
    bodyKey: 'pricing.budget.shared.body',
    bodyFallback:
      'AI usage is pooled at organization level instead of being fragmented per user, which matches how real consulting teams work.',
  },
  {
    titleKey: 'pricing.budget.topUp.title',
    titleFallback: 'Monthly top-up packages',
    bodyKey: 'pricing.budget.topUp.body',
    bodyFallback:
      'Organizations can buy additional monthly AI budget packages. Unused balance rolls forward and accumulates instead of disappearing.',
  },
  {
    titleKey: 'pricing.budget.payg.title',
    titleFallback: 'Automatic pay-as-you-go fallback',
    bodyKey: 'pricing.budget.payg.body',
    bodyFallback:
      'When the included budget is exhausted, AI usage can continue through pay-as-you-go or by switching to a larger package.',
  },
] as const;

const LICENSED_TOOL_KEYS = [
  {
    key: 'pricing.licensedTools.items.0',
    fallback:
      'Selected assessments and frameworks such as SIR or DRD can require separate licensing.',
  },
  {
    key: 'pricing.licensedTools.items.1',
    fallback:
      'Licensed tools are sold as add-ons or handled as pricing on request, not mixed into the base seat price.',
  },
  {
    key: 'pricing.licensedTools.items.2',
    fallback:
      'This keeps the core platform readable while preserving room for specialized enterprise configurations.',
  },
] as const;

export const PricingLandingPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const topPlans = [
    {
      key: 'trial',
      name: t('pricing.plans.trial.name', 'Trial'),
      price: t('pricing.plans.trial.price', 'Free'),
      subtitle: t('pricing.plans.trial.subtitle', '7 days'),
      description: t(
        'pricing.plans.trial.description',
        '7 days to validate the workflow in your own workspace before you commit.'
      ),
      features: t('pricing.plans.trial.features', {
        returnObjects: true,
        defaultValue: [
          'Your own workspace',
          'Up to 3 active projects',
          'Up to 4 team members',
          '100k AI tokens included',
          'Basic report export',
          'Email support',
        ],
      }) as string[],
      cta: t('pricing.plans.trial.cta', 'Start trial'),
    },
    {
      key: 'user',
      name: t('pricing.plans.user.name', 'User'),
      price: t('pricing.plans.user.price', 'EUR 29'),
      subtitle: t('pricing.plans.user.subtitle', 'per seat / month'),
      description: t(
        'pricing.plans.user.description',
        'For solo consultants and operators who need steady monthly usage.'
      ),
      features: t('pricing.plans.user.features', {
        returnObjects: true,
        defaultValue: [
          '1 user seat',
          '5 active projects',
          '150 AI credits / month',
          'Scenario builder and report drafts',
          '10 exports / month',
          'Email support',
        ],
      }) as string[],
      cta: t('pricing.plans.user.cta', 'Choose User'),
    },
    {
      key: 'admin',
      name: t('pricing.plans.manager.name', 'Admin'),
      price: t('pricing.plans.manager.price', 'EUR 49'),
      subtitle: t('pricing.plans.manager.subtitle', 'per seat / month'),
      description: t(
        'pricing.plans.manager.description',
        'For team leads running multiple initiatives with shared visibility.'
      ),
      features: t('pricing.plans.manager.features', {
        returnObjects: true,
        defaultValue: [
          '3 user seats included',
          '15 active projects',
          '500 AI credits / month',
          'Shared workspace and approvals',
          'Presentation-ready exports',
          'Priority support',
        ],
      }) as string[],
      cta: t('pricing.plans.manager.cta', 'Choose Admin'),
      featured: true,
    },
    {
      key: 'enterprise',
      name: t('pricing.plans.enterprise.name', 'Enterprise'),
      price: t('pricing.plans.enterprise.price', 'Custom'),
      subtitle: t('pricing.plans.enterprise.subtitle', 'custom setup'),
      description: t(
        'pricing.plans.enterprise.description',
        'For consulting firms and enterprise teams with security and rollout needs.'
      ),
      features: t('pricing.plans.enterprise.features', {
        returnObjects: true,
        defaultValue: [
          'Custom seats and usage packs',
          'SSO / SAML and advanced permissions',
          'API and MCP access',
          'Private model routing or BYOK',
          'Security review and SLA',
          'Dedicated onboarding',
        ],
      }) as string[],
      cta: t('pricing.plans.enterprise.cta', 'Contact sales'),
    },
  ] as const;

  return (
    <MarketingLayout>
      <section className="relative overflow-hidden px-6 pb-20 pt-20 text-center">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(160deg,#0B1220,#0F172A,#0B1220)]" />
        <div className="absolute left-1/2 top-0 -z-10 h-[420px] w-[60%] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(165,28,48,0.22)_0%,transparent_65%)] blur-[80px]" />

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 rounded-full border border-c-accent/30 bg-c-accent-soft px-3 py-1.5"
        >
          <Sparkles size={12} className="text-c-accent" />
          <span className="text-xs font-bold uppercase tracking-wider text-c-accent">
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
          <span className="block bg-gradient-to-r from-primary-300 to-blue-300 bg-clip-text text-transparent">
            {t(
              'pricing.headingAccent',
              'Seats, shared AI budget, licensed tools, and enterprise control.'
            )}
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
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2 xl:grid-cols-4">
          {topPlans.map((pack) => (
            <div
              key={pack.key}
              className={`flex h-full flex-col rounded-3xl border p-7 ${
                (pack as { featured?: boolean }).featured
                  ? 'border-c-accent/35 bg-c-accent-soft shadow-[0_0_60px_-24px_rgba(165,28,48,0.45)]'
                  : 'border-c-border bg-c-surface shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-c-accent">
                    {pack.name}
                  </p>
                  <p className="mt-3 text-4xl font-black text-c-text">{pack.price}</p>
                  <p className="mt-1 text-sm text-c-text-muted">{pack.subtitle}</p>
                </div>
                {(pack as { featured?: boolean }).featured ? (
                  <span className="rounded-full bg-c-accent px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-white">
                    {t('pricing.mostPopular', 'Most popular')}
                  </span>
                ) : pack.key === 'trial' ? (
                  <span className="rounded-full border border-blue-500/30 dark:border-blue-400/30 bg-blue-50 dark:bg-blue-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-blue-700 dark:text-blue-200">
                    {t('pricing.trialPill', 'Start here')}
                  </span>
                ) : null}
              </div>

              <p className="mt-6 min-h-[72px] text-sm leading-6 text-c-text-secondary">
                {pack.description}
              </p>

              <div className="mt-6 space-y-3">
                {pack.features.map((bullet) => (
                  <div key={bullet} className="flex items-start gap-3">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-c-accent" />
                    <span className="text-sm text-c-text-secondary">{bullet}</span>
                  </div>
                ))}
              </div>

              <div className="mt-auto pt-6">
                <button
                  onClick={() =>
                    navigate(pack.key === 'enterprise' ? ROUTES.LEGAL.CONTACT : ROUTES.TRIAL_ENTRY)
                  }
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black transition ${
                    (pack as { featured?: boolean }).featured
                      ? 'bg-c-text text-c-surface hover:opacity-90'
                      : 'border border-c-border text-c-text hover:bg-c-surface-raised'
                  }`}
                >
                  {pack.cta}
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 py-10">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-3xl border border-c-border bg-c-surface p-8 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-c-accent-soft text-c-accent">
                <Coins size={22} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-c-accent">
                  {t('pricing.budget.badge', 'Shared AI budget')}
                </p>
                <h2 className="mt-1 text-2xl font-black text-c-text">
                  {t('pricing.budget.heading', 'Usage is pooled for the whole organization')}
                </h2>
              </div>
            </div>

            <div className="mt-8 space-y-5">
              {BUDGET_LAYER_KEYS.map((layer) => (
                <div
                  key={layer.titleKey}
                  className="rounded-2xl border border-c-border bg-c-surface-raised p-5"
                >
                  <p className="text-sm font-black text-c-text">
                    {t(layer.titleKey, layer.titleFallback)}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-c-text-secondary">
                    {t(layer.bodyKey, layer.bodyFallback)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-c-border bg-c-surface p-8 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300">
                <ShieldCheck size={22} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-500">
                  {t('pricing.overLimit.badge', 'Over-limit behavior')}
                </p>
                <h2 className="mt-1 text-2xl font-black text-c-text">
                  {t('pricing.overLimit.heading', 'The workspace keeps running even when AI stops')}
                </h2>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              {[
                t(
                  'pricing.overLimit.items.0',
                  'After the AI budget is exhausted, users keep access to existing data, workspaces, and prior outputs.'
                ),
                t(
                  'pricing.overLimit.items.1',
                  'What stops is AI assistance: generation, AI-guided support, and token-consuming actions.'
                ),
                t(
                  'pricing.overLimit.items.2',
                  'Teams can continue through pay-as-you-go, upgrade the package, or contact sales for a larger commercial setup.'
                ),
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 rounded-2xl border border-c-border bg-c-surface-raised p-4"
                >
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-amber-500" />
                  <span className="text-sm leading-6 text-c-text-secondary">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-10">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-c-border bg-c-surface p-8 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                <Layers3 size={22} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-500">
                  {t('pricing.licensedTools.badge', 'Licensed tools and frameworks')}
                </p>
                <h2 className="mt-1 text-2xl font-black text-c-text">
                  {t(
                    'pricing.licensedTools.heading',
                    'Specialized modules stay outside the base seat price'
                  )}
                </h2>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              {LICENSED_TOOL_KEYS.map((item) => (
                <div key={item.key} className="flex items-start gap-3">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-blue-500" />
                  <span className="text-sm leading-6 text-c-text-secondary">
                    {t(item.key, item.fallback)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-c-accent/20 bg-c-accent p-8 shadow-[0_0_80px_-32px_rgba(165,28,48,0.35)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-white">
                <Building2 size={22} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/70">
                  {t('pricing.enterpriseNote.badge', 'Enterprise details')}
                </p>
                <h2 className="mt-1 text-2xl font-black text-white">
                  {t(
                    'pricing.enterpriseNote.title',
                    'Custom deployment, governance, and commercial setup'
                  )}
                </h2>
              </div>
            </div>

            <p className="mt-8 text-sm leading-7 text-white/80">
              {t(
                'pricing.enterpriseNote.body',
                'Enterprise plans are for organizations that need more than standard packaging: on-premise or dedicated deployment, custom legal flow, procurement support, partner-heavy rollout, licensed tool bundles, or negotiated AI budget structures.'
              )}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() => navigate(ROUTES.LEGAL.CONTACT)}
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-black text-c-accent transition hover:bg-white/90"
              >
                {t('pricing.enterpriseNote.ctaEnterprise', 'Talk enterprise setup')}
                <ArrowRight size={16} />
              </button>
              <button
                onClick={() => navigate(ROUTES.TRIAL_ENTRY)}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-black text-white transition hover:bg-white/5"
              >
                {t('pricing.enterpriseNote.ctaTrial', 'Start trial first')}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-4">
        <div className="mx-auto max-w-6xl rounded-3xl border border-c-border bg-c-surface p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-c-accent">
                {t('pricing.legalDocs.badge', 'Commercial documentation')}
              </p>
              <h2 className="mt-2 text-2xl font-black text-c-text">
                {t(
                  'pricing.legalDocs.heading',
                  'Review the legal and procurement materials behind the price'
                )}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-c-text-secondary">
                {t(
                  'pricing.legalDocs.body',
                  'Use the same document set across procurement, security review, and subscription decisions: pricing terms, DPA, SLA, security overview, and the full legal center.'
                )}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                title: t('pricing.legalDocs.items.subscription.title', 'Subscription terms'),
                body: t(
                  'pricing.legalDocs.items.subscription.body',
                  'Plans, billing, seats, and AI budget rules.'
                ),
                icon: FileText,
                href: ROUTES.LEGAL.SUBSCRIPTION,
              },
              {
                title: t('pricing.legalDocs.items.dpa.title', 'Data Processing Addendum'),
                body: t(
                  'pricing.legalDocs.items.dpa.body',
                  'Processor terms for compliance and customer procurement.'
                ),
                icon: ShieldCheck,
                href: ROUTES.LEGAL.DPA,
              },
              {
                title: t('pricing.legalDocs.items.sla.title', 'SLA and security'),
                body: t(
                  'pricing.legalDocs.items.sla.body',
                  'Service commitments, support expectations, and security review entry point.'
                ),
                icon: Scale,
                href: ROUTES.LEGAL.SLA,
              },
              {
                title: t('pricing.legalDocs.items.center.title', 'Full legal center'),
                body: t(
                  'pricing.legalDocs.items.center.body',
                  'Browse all policies, compliance references, and supporting documents.'
                ),
                icon: Sparkles,
                href: ROUTES.LEGAL.CENTER,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => navigate(item.href)}
                  className="rounded-2xl border border-c-border bg-c-surface-raised p-4 text-left transition hover:border-c-accent/40 hover:bg-c-accent-soft"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-c-surface text-c-accent shadow-sm">
                      <Icon size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-c-text">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-c-text-secondary">{item.body}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-6 pb-24 pt-6">
        <div className="mx-auto max-w-6xl rounded-3xl border border-c-border bg-c-surface-raised p-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-c-border bg-c-surface px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-c-text-secondary">
            <MessageSquare size={13} />
            {t('pricing.salesNote.badge', 'Sales note')}
          </div>
          <p className="mx-auto mt-4 max-w-4xl text-sm leading-7 text-c-text-secondary">
            {t(
              'pricing.salesNote.body',
              'AI budget is sold as budget, not as a public token-rate promise, because different actions consume different model resources. Anna and Teresa can help explain which package and budget shape fit the workload before purchase.'
            )}
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
};
