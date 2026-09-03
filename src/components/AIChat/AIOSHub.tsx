import {
  Bot,
  Brain,
  CheckCircle2,
  Database,
  FileText,
  GitBranch,
  ShieldCheck,
  TrendingUp,
  Zap,
} from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';

import { ROUTES } from '@/routes/routeConfig';

import { V10TeresaRuntimeWorkspace } from '../v10/V10TeresaRuntimeWorkspace';
import { AIOSWave0GateReport } from './AIOSWave0GateReport';

const modules = [
  {
    title: 'AI Actions',
    subtitle: 'Approval, AIRun ledger, audit and rollback controls.',
    href: ROUTES.AI_OS.ACTION_CENTER,
    icon: Zap,
    checks: [
      'Create a governed AI action',
      'Approve or reject before execution',
      'Verify ledger and rollback status',
    ],
  },
  {
    title: 'Memory & Scope',
    subtitle: 'Anna/Teresa memory, assistantScope, private mode and retention.',
    href: ROUTES.AI_OS.CONTEXT,
    icon: Database,
    checks: [
      'Switch assistant scope',
      'Verify org/project separation',
      'Confirm private mode blocks learning',
    ],
  },
  {
    title: 'Connectors',
    subtitle: 'Connector catalog, OAuth/session lifecycle and governed connector runs.',
    href: ROUTES.AI_OS.CONNECTORS,
    icon: GitBranch,
    checks: [
      'Register or link a connector',
      'Check token expiry/reconnect state',
      'Confirm mutating tools require AIRun',
    ],
  },
  {
    title: 'Agents',
    subtitle: 'Specialized agents, tool scope, schedules, notifications and eval hooks.',
    href: ROUTES.AI_OS.AGENTS,
    icon: Bot,
    checks: [
      'Launch a specialist agent',
      'Validate tool scope and budget gate',
      'Process due schedules manually',
    ],
  },
  {
    title: 'KPI/ROI & AI Ops',
    subtitle: 'Outcome contracts, evidence, provider health and final acceptance.',
    href: ROUTES.AI_OS.OUTCOMES,
    icon: TrendingUp,
    checks: [
      'Create KPI/ROI outcome',
      'Register acceptance runs/evidence',
      'Run final AI OS acceptance gate',
    ],
  },
  {
    title: 'Research & Artifacts',
    subtitle: 'Deep research sessions, evidence reports and first-class artifacts.',
    href: ROUTES.AI_OS.RESEARCH,
    icon: FileText,
    checks: [
      'Start a research session',
      'Verify citations and evidence',
      'Materialize artifact output',
    ],
  },
];

export const AIOSHub: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-navy-950 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-navy-900">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-c-surface-raised px-3 py-1 text-sm font-semibold text-c-text-secondary dark:bg-c-surface-raised dark:text-c-text-secondary">
                <Brain size={16} />
                Consultify AI OS
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-950 dark:text-white">
                  AI OS control plane
                </h1>
                <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
                  One entrypoint for manual acceptance tests of AI Actions, memory scopes,
                  connectors, agents, artifacts and KPI/ROI governance. These modules are runtime
                  panels, not coming-soon placeholders.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldCheck size={18} />
                Manual gate checklist
              </div>
              <p className="mt-1">
                Test each card below and classify findings as PASS, PASS_WITH_LIMITATIONS or
                BLOCKED.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <Link
                key={module.title}
                to={module.href}
                className="group flex min-h-[260px] flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-white/10 dark:bg-navy-900 dark:hover:border-white/20"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="rounded-2xl bg-slate-100 p-3 text-slate-700 dark:bg-white/10 dark:text-slate-200">
                      <Icon size={22} />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300">
                      Open
                    </span>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                      {module.title}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {module.subtitle}
                    </p>
                  </div>
                </div>
                <ul className="mt-5 space-y-2">
                  {module.checks.map((check) => (
                    <li
                      key={check}
                      className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300"
                    >
                      <CheckCircle2 className="mt-0.5 flex-shrink-0 text-emerald-500" size={15} />
                      <span>{check}</span>
                    </li>
                  ))}
                </ul>
              </Link>
            );
          })}
        </section>

        <AIOSWave0GateReport />
        <V10TeresaRuntimeWorkspace />
      </div>
    </div>
  );
};
