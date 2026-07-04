import { motion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Factory,
  Gauge,
  GitBranch,
  Landmark,
  Layers3,
  Quote,
  Target,
  TrendingUp,
  Users2,
} from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';

import { MarketingLayout } from '../components/Landing/MarketingLayout';
import { ROUTES } from '../routes/routeConfig';

const fade = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

export const BusinessCasesPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <MarketingLayout>
      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 px-6 pb-20 pt-24">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(165,28,48,0.28),transparent_70%)]" />
        <div className="relative mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full border border-primary-400/30 bg-primary-500/10 px-4 py-2"
          >
            <Factory size={14} className="text-primary-300" />
            <span className="text-xs font-bold uppercase tracking-widest text-primary-300">
              Business Case — Multi-site manufacturing
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className="mt-8 max-w-4xl text-4xl font-black leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl"
          >
            Five plants. One headquarters.{' '}
            <span className="bg-gradient-to-r from-primary-400 to-blue-400 bg-clip-text text-transparent">
              Zero shared view of the transformation.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.14 }}
            className="mt-6 max-w-3xl text-lg leading-8 text-c-text-secondary"
          >
            AluForm Group had ambitious targets for operational improvement, but each plant ran its
            own spreadsheets, its own priorities, and its own business cases. The board saw dozens
            of project ideas. What they didn't have was a single system that could compare them,
            fund the best ones, and track whether the money actually delivered results.
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-4 max-w-3xl text-lg leading-8 text-c-text-secondary"
          >
            This is the story of how they fixed that with Consultify.
          </motion.p>

          {/* outcome badges */}
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                value: '+11 %',
                sub: 'OEE on critical lines',
                color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
              },
              {
                value: '-9 %',
                sub: 'scrap on priority families',
                color: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
              },
              {
                value: '10 days',
                sub: 'to approve a business case (was 8 weeks)',
                color: 'border-primary-500/40 bg-primary-500/10 text-primary-300',
              },
              {
                value: '14 mo',
                sub: 'payback for the entire program',
                color: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
              },
            ].map((m) => (
              <div key={m.sub} className={`rounded-2xl border px-5 py-5 ${m.color}`}>
                <p className="text-3xl font-black text-white">{m.value}</p>
                <p className="mt-1 text-sm text-c-text-secondary">{m.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPANY PROFILE ── */}
      <section className="bg-c-surface px-6 py-16 dark:bg-slate-950">
        <motion.div
          {...fade}
          className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary-600">
              The company
            </p>
            <h2 className="mt-4 text-3xl font-black text-c-text sm:text-4xl">
              AluForm Group
            </h2>
            <p className="mt-5 text-base leading-8 text-c-text-secondary">
              AluForm Group is a European manufacturer of precision metal and aluminum components
              supplying HVAC, white goods, and automotive tier-1 supply chains. With five production
              plants across Central Europe, 2,800 employees, and annual revenue of EUR 420 million,
              the group sits at the intersection of scale, complexity, and margin pressure that
              defines mid-market industrial manufacturing.
            </p>
            <p className="mt-4 text-base leading-8 text-c-text-secondary">
              Each plant had its own product focus, its own engineering culture, and its own way of
              running improvement projects. Headquarters set strategic targets, but had no reliable
              mechanism to compare initiatives across sites, validate financial assumptions, or
              monitor whether approved investments were actually delivering value.
            </p>
          </div>

          <div className="space-y-3">
            {[
              {
                site: 'Plant 1 — Toruń',
                focus: 'Precision aluminum parts',
                note: 'CNC machining and finishing for HVAC OEMs',
              },
              {
                site: 'Plant 2 — Bydgoszcz',
                focus: 'Stamped metal assemblies',
                note: 'Automotive supplier with tight throughput constraints',
              },
              {
                site: 'Plant 3 — Poznań',
                focus: 'White goods subcomponents',
                note: 'Labor-heavy assembly with quality and planning variation',
              },
              {
                site: 'Plant 4 — Wrocław',
                focus: 'Surface treatment & coating',
                note: 'Energy-intensive with high downtime sensitivity',
              },
              {
                site: 'Plant 5 — Łódź',
                focus: 'Final integrated modules',
                note: 'Cross-site coordination point for on-time delivery',
              },
            ].map((p) => (
              <div
                key={p.site}
                className="rounded-2xl border border-c-border-subtle bg-c-bg px-5 py-4 dark:border-c-border-subtle dark:bg-c-surface/[0.03]"
              >
                <p className="text-xs font-bold uppercase tracking-widest text-primary-600 dark:text-primary-400">
                  {p.site}
                </p>
                <p className="mt-1 text-base font-bold text-c-text">{p.focus}</p>
                <p className="mt-1 text-sm text-c-text-muted">{p.note}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── THE PROBLEM ── */}
      <section className="bg-c-bg px-6 py-16 dark:bg-slate-900/50">
        <motion.div {...fade} className="mx-auto max-w-7xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger-100 text-danger-600 dark:bg-danger-500/10 dark:text-danger-400">
              <Clock size={20} />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-danger-600 dark:text-danger-400">
              The problem
            </p>
          </div>

          <h2 className="mt-6 max-w-4xl text-3xl font-black text-c-text sm:text-4xl">
            "We had 40 project ideas and no way to tell the board which five to fund first."
          </h2>
          <p className="mt-5 max-w-4xl text-base leading-8 text-c-text-secondary">
            The COO of AluForm Group described the situation bluntly: every plant had its own
            backlog of improvements, but no two plants used the same methodology. One site tracked
            initiatives in Excel with estimated paybacks. Another used PowerPoint decks prepared
            once a quarter. A third relied on the plant manager's memory.
          </p>
          <p className="mt-4 max-w-4xl text-base leading-8 text-c-text-secondary">
            The CFO's team spent weeks before every steering committee reconciling numbers,
            challenging assumptions, and re-building business cases in a format the board could
            compare. By the time an investment was approved, the operational window had often
            shifted.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {[
              {
                icon: Factory,
                text: 'Each plant tracked improvement projects in its own format — spreadsheets, slide decks, or informal lists. HQ had no consistent baseline to compare across sites.',
              },
              {
                icon: CircleDollarSign,
                text: 'Business cases for automation, quality, maintenance, and energy used different assumptions, different time horizons, and different definitions of value.',
              },
              {
                icon: Users2,
                text: 'The executive team saw many ideas but could not prioritize them by impact, risk, or rollout readiness — because the data was never in one place at the same time.',
              },
              {
                icon: Clock,
                text: 'Investment decisions took 6–8 weeks on average because every meeting required manual data reconciliation between operations, finance, and plant management.',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.text}
                  className="flex items-start gap-4 rounded-2xl border border-c-border-subtle bg-c-surface p-5 shadow-sm dark:border-c-border-subtle dark:bg-slate-800/50"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-danger-100 text-danger-600 dark:bg-danger-500/10 dark:text-danger-400">
                    <Icon size={18} />
                  </div>
                  <p className="text-sm leading-7 text-c-text-secondary">
                    {item.text}
                  </p>
                </div>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* ── WHAT CHANGED ── */}
      <section className="bg-c-surface px-6 py-16 dark:bg-slate-950">
        <motion.div {...fade} className="mx-auto max-w-7xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400">
              <Layers3 size={20} />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary-600 dark:text-primary-400">
              What AluForm deployed
            </p>
          </div>

          <h2 className="mt-6 max-w-4xl text-3xl font-black text-c-text sm:text-4xl">
            One transformation system for HQ, plants, and finance — not another dashboard.
          </h2>
          <p className="mt-5 max-w-4xl text-base leading-8 text-c-text-secondary">
            Consultify was introduced not as a reporting tool, but as the operating layer for
            transformation decisions. The goal was simple: every initiative, whether it started in
            Toruń or Łódź, would be assessed, quantified, prioritized, and tracked using one shared
            methodology that the board, CFO, and plant managers could all read the same way.
          </p>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {[
              {
                icon: Landmark,
                accent: 'text-primary-600 dark:text-primary-400',
                bg: 'bg-primary-100 dark:bg-primary-500/10',
                title: 'HQ & governance',
                body: 'The transformation office gained a single portfolio view: all initiatives from all plants, with comparable value estimates, dependency maps, and rollout status. Steering committees stopped debating data and started making decisions.',
                bullets: [
                  'Group-wide investment pipeline with one scoring model',
                  'Comparable business cases across all five plants',
                  'Shared governance cadence for COO, CFO, and PMO',
                ],
              },
              {
                icon: Factory,
                accent: 'text-blue-600 dark:text-blue-400',
                bg: 'bg-blue-100 dark:bg-blue-500/10',
                title: 'Plant operations',
                body: 'Each plant used the same structured baseline: OEE, scrap, downtime, quality, and planning indicators. From that baseline, they built their own improvement backlog — but in a format the group could compare and prioritize centrally.',
                bullets: [
                  'Structured operational baseline per site',
                  'Site-level initiative backlog and execution tracking',
                  'Multi-site rollout with local ownership and central visibility',
                ],
              },
              {
                icon: CircleDollarSign,
                accent: 'text-emerald-600 dark:text-emerald-400',
                bg: 'bg-emerald-100 dark:bg-emerald-500/10',
                title: 'Finance & ROI',
                body: "Every initiative was quantified using the same value logic — throughput gain, scrap reduction, maintenance savings, energy, labor. The CFO's team stopped re-building numbers and started validating them.",
                bullets: [
                  'Standardized value drivers and financial assumptions',
                  'One model for CAPEX, OPEX, and hybrid interventions',
                  'Value realization tracked after rollout, not just at approval',
                ],
              },
            ].map((stream) => {
              const Icon = stream.icon;
              return (
                <div
                  key={stream.title}
                  className="rounded-3xl border border-c-border-subtle bg-c-bg p-6 dark:border-c-border-subtle dark:bg-c-surface/[0.03]"
                >
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl ${stream.bg} ${stream.accent}`}
                  >
                    <Icon size={22} />
                  </div>
                  <h3 className="mt-5 text-xl font-black text-c-text">
                    {stream.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-c-text-secondary">
                    {stream.body}
                  </p>
                  <div className="mt-5 space-y-2.5 border-t border-c-border-subtle pt-5 dark:border-c-border-subtle">
                    {stream.bullets.map((b) => (
                      <div key={b} className="flex items-start gap-2.5">
                        <CheckCircle2 size={15} className={`mt-0.5 shrink-0 ${stream.accent}`} />
                        <span className="text-sm text-c-text-secondary">{b}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* ── ROLLOUT WAVES ── */}
      <section className="bg-c-bg px-6 py-16 dark:bg-slate-900/50">
        <motion.div {...fade} className="mx-auto max-w-7xl">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
            How the program scaled
          </p>
          <h2 className="mt-4 max-w-4xl text-3xl font-black text-c-text sm:text-4xl">
            Three waves over 12 months — not a big-bang rollout.
          </h2>
          <p className="mt-5 max-w-4xl text-base leading-8 text-c-text-secondary">
            AluForm deliberately avoided a company-wide simultaneous launch. They started with the
            transformation office and two pilot plants, proved the value model worked, then expanded
            to all sites, and finally shifted focus from approval to execution.
          </p>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {[
              {
                num: '01',
                title: 'Pilot & alignment',
                sub: 'Months 1–3',
                body: 'The transformation office, CFO team, and two pilot plants (Toruń and Bydgoszcz) established the operating baseline, agreed on the value methodology, and ran the first batch of comparable business cases through the system.',
              },
              {
                num: '02',
                title: 'Portfolio expansion',
                sub: 'Months 4–7',
                body: 'All five plants were onboarded. The initiative portfolio grew to 14 cross-functional projects. For the first time, the board could see every transformation idea in one view, ranked by impact, feasibility, and rollout readiness.',
              },
              {
                num: '03',
                title: 'Execution & value tracking',
                sub: 'Months 8–12',
                body: 'The focus shifted from planning to delivery. Consultify tracked rollout health, surfaced blockers, and measured realized value against the original business case — so the board knew which bets paid off.',
              },
            ].map((w) => (
              <div
                key={w.num}
                className="rounded-3xl border border-c-border-subtle bg-c-surface p-6 shadow-sm dark:border-c-border-subtle dark:bg-slate-800/50"
              >
                <span className="text-4xl font-black text-slate-200 dark:text-white/10">
                  {w.num}
                </span>
                <h3 className="mt-3 text-xl font-black text-c-text">
                  {w.title}
                </h3>
                <p className="mt-1 text-sm font-semibold text-blue-600 dark:text-blue-400">
                  {w.sub}
                </p>
                <p className="mt-4 text-sm leading-7 text-c-text-secondary">
                  {w.body}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── ROI ── */}
      <section className="bg-c-surface px-6 py-16 dark:bg-slate-950">
        <motion.div {...fade} className="mx-auto max-w-7xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <TrendingUp size={20} />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              Financial results
            </p>
          </div>

          <h2 className="mt-6 max-w-4xl text-3xl font-black text-c-text sm:text-4xl">
            EUR 2.85 million in annual value. 14-month payback. 173 % risk-adjusted ROI.
          </h2>
          <p className="mt-5 max-w-3xl text-base leading-8 text-c-text-secondary">
            These are conservative estimates after ramp-up, not projections built at the start. The
            CFO signed off on these numbers after the first rolling review, nine months in.
          </p>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {/* value side */}
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-500/20 dark:bg-emerald-500/5">
              <p className="text-sm font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                Annual value realized
              </p>
              <p className="mt-3 text-5xl font-black text-c-text">EUR 2.85M</p>
              <div className="mt-6 space-y-3">
                {[
                  { label: 'Throughput and availability improvement', value: 'EUR 1.10M' },
                  { label: 'Scrap reduction on priority product families', value: 'EUR 0.95M' },
                  { label: 'Maintenance and unplanned downtime avoidance', value: 'EUR 0.50M' },
                  { label: 'Planning and reporting effort reduction', value: 'EUR 0.30M' },
                ].map((r) => (
                  <div
                    key={r.label}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-c-surface/70 px-4 py-3 dark:bg-black/10"
                  >
                    <span className="text-sm text-c-text-secondary">{r.label}</span>
                    <span className="shrink-0 text-sm font-black text-c-text">
                      {r.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* cost side */}
            <div className="rounded-3xl border border-c-border-subtle bg-c-bg p-6 dark:border-c-border-subtle dark:bg-c-surface/[0.03]">
              <p className="text-sm font-bold uppercase tracking-widest text-c-text-muted">
                Total program cost
              </p>
              <p className="mt-3 text-5xl font-black text-c-text">EUR 1.65M</p>
              <div className="mt-6 space-y-3">
                {[
                  { label: 'Platform license, rollout, and program setup', value: 'EUR 0.42M' },
                  { label: 'Data integration and implementation support', value: 'EUR 0.38M' },
                  { label: 'Pilot and site deployment effort', value: 'EUR 0.35M' },
                  { label: 'Client PMO and expert involvement', value: 'EUR 0.29M' },
                  { label: 'Training and change management', value: 'EUR 0.21M' },
                ].map((r) => (
                  <div
                    key={r.label}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-c-surface px-4 py-3 dark:bg-black/10"
                  >
                    <span className="text-sm text-c-text-secondary">{r.label}</span>
                    <span className="shrink-0 text-sm font-black text-c-text">
                      {r.value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  { label: 'Payback', value: '14 months' },
                  { label: '3-year ROI', value: '173 %' },
                  { label: 'Benefit-to-cost', value: '1.73 : 1' },
                ].map((k) => (
                  <div
                    key={k.label}
                    className="rounded-2xl border border-c-border-subtle bg-c-surface px-4 py-4 text-center dark:border-c-border-subtle dark:bg-black/10"
                  >
                    <p className="text-[11px] font-bold uppercase tracking-widest text-c-text-muted">
                      {k.label}
                    </p>
                    <p className="mt-2 text-2xl font-black text-c-text">
                      {k.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── ORGANIZATIONAL IMPACT ── */}
      <section className="bg-c-bg px-6 py-16 dark:bg-slate-900/50">
        <motion.div {...fade} className="mx-auto max-w-7xl">
          <p className="text-xs font-bold uppercase tracking-widest text-primary-600 dark:text-primary-400">
            Beyond the numbers
          </p>
          <h2 className="mt-4 max-w-4xl text-3xl font-black text-c-text sm:text-4xl">
            The real transformation was how the organization makes decisions.
          </h2>
          <p className="mt-5 max-w-4xl text-base leading-8 text-c-text-secondary">
            Twelve months after rollout, the financial results were measurable and real. But the
            leaders at AluForm said the bigger shift was structural: the way information flows
            between plants and headquarters, the way initiatives are funded, and the way results are
            tracked after approval.
          </p>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Building2,
                accent: 'text-primary-600 dark:text-primary-400',
                bg: 'bg-primary-100 dark:bg-primary-500/10',
                title: 'For the board',
                bullets: [
                  'One transformation portfolio view across all plants',
                  'Faster investment decisions backed by comparable data',
                  'A clear link between strategy, funding, and execution status',
                ],
              },
              {
                icon: CircleDollarSign,
                accent: 'text-emerald-600 dark:text-emerald-400',
                bg: 'bg-emerald-100 dark:bg-emerald-500/10',
                title: 'For CFO & finance',
                bullets: [
                  'Shared financial assumptions behind every initiative',
                  'Less time debating methodology, more time deciding',
                  'Post-approval tracking of realized value vs. forecast',
                ],
              },
              {
                icon: Gauge,
                accent: 'text-blue-600 dark:text-blue-400',
                bg: 'bg-blue-100 dark:bg-blue-500/10',
                title: 'For plant operations',
                bullets: [
                  'A common language between HQ, plant managers, and engineers',
                  'Less manual reporting and fewer ad-hoc escalations',
                  'Better initiative prioritization based on real operational data',
                ],
              },
              {
                icon: Users2,
                accent: 'text-amber-600 dark:text-amber-400',
                bg: 'bg-amber-100 dark:bg-amber-500/10',
                title: 'For the transformation office',
                bullets: [
                  'One backlog, one cadence, one stage-gate model',
                  'Better control of multi-site rollout dependencies',
                  'Stronger accountability for value realization end-to-end',
                ],
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-3xl border border-c-border-subtle bg-c-surface p-5 shadow-sm dark:border-c-border-subtle dark:bg-slate-800/50"
                >
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl ${item.bg} ${item.accent}`}
                  >
                    <Icon size={20} />
                  </div>
                  <h3 className="mt-5 text-lg font-black text-c-text">
                    {item.title}
                  </h3>
                  <div className="mt-4 space-y-2.5">
                    {item.bullets.map((b) => (
                      <div key={b} className="flex items-start gap-2">
                        <CheckCircle2 size={14} className={`mt-0.5 shrink-0 ${item.accent}`} />
                        <span className="text-sm leading-6 text-c-text-secondary">
                          {b}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* ── QUOTE ── */}
      <section className="bg-c-surface px-6 py-16 dark:bg-slate-950">
        <motion.div {...fade} className="mx-auto max-w-4xl text-center">
          <Quote size={36} className="mx-auto text-primary-300 dark:text-primary-600" />
          <blockquote className="mt-6 text-2xl font-bold leading-relaxed text-c-text sm:text-3xl">
            "We went from eight weeks of manual reconciliation to a ten-day decision cycle — and for
            the first time the board could see the same numbers the plant managers see."
          </blockquote>
          <p className="mt-6 text-base font-semibold text-c-text-muted">
            COO, AluForm Group
          </p>
        </motion.div>
      </section>

      {/* ── CTA ── */}
      <section className="px-6 pb-24 pt-4">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-[32px] bg-gradient-to-br from-primary-600 to-crimson-700 p-10 text-center shadow-[0_0_90px_-36px_rgba(165,28,48,0.5)]">
          <p className="text-xs font-bold uppercase tracking-widest text-white/70">
            Ready to see this for your organization?
          </p>
          <h2 className="mt-4 text-3xl font-black text-white sm:text-4xl">
            Start with a trial or talk to our team about your rollout.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/80">
            Whether you're running one plant or twenty, Consultify can connect your transformation
            portfolio, ROI model, and execution governance in one system the board can trust.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <button
              type="button"
              onClick={() => navigate(ROUTES.TRIAL_ENTRY)}
              className="inline-flex items-center gap-2 rounded-full bg-c-surface px-7 py-3.5 text-sm font-black text-primary-700 transition hover:bg-primary-50"
            >
              Start trial
              <ArrowRight size={16} />
            </button>
            <button
              type="button"
              onClick={() => navigate(ROUTES.LEGAL.CONTACT)}
              className="inline-flex items-center gap-2 rounded-full border border-c-border px-7 py-3.5 text-sm font-black text-white transition hover:bg-c-surface/10"
            >
              Discuss your rollout
            </button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default BusinessCasesPage;
