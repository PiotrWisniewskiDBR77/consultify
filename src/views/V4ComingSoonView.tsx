import React from 'react';
import { useLocation } from 'react-router-dom';

type ModuleKey =
  | 'iris'
  | 'marketplace'
  | 'execution'
  | 'results'
  | 'finance'
  | 'presentations'
  | 'meeting';

const copyByModule: Record<ModuleKey, { title: string; subtitle: string; bullets: string[] }> = {
  iris: {
    title: 'MCP IRIS',
    subtitle: 'Coming soon (V4)',
    bullets: [
      'Cross-tool orchestration powered by MCP integrations.',
      'Deeper context routing for multi-step consultant workflows.',
      'Enterprise-safe policy and audit controls for orchestration.',
    ],
  },
  marketplace: {
    title: 'MCP Marketplace',
    subtitle: 'Coming soon (V4)',
    bullets: [
      'Catalog of MCP integrations and reusable workflow connectors.',
      'Standardized setup for organization-ready toolchains.',
      'Clear compatibility and governance metadata per integration.',
    ],
  },
  execution: {
    title: 'Execution & Implementation',
    subtitle: 'Coming soon',
    bullets: [
      'Track initiative implementation progress with milestones and deliverables.',
      'Manage pilot programs, rollouts, and change management workflows.',
      'Real-time execution dashboards with risk and dependency tracking.',
    ],
  },
  results: {
    title: 'Results & KPI/OKR',
    subtitle: 'Coming soon',
    bullets: [
      'Monitor KPIs and OKRs tied to transformation initiatives.',
      'Benefits realization tracking with automated progress reports.',
      'ROI dashboards connecting execution outcomes to business value.',
    ],
  },
  finance: {
    title: 'Financial Analysis',
    subtitle: 'Coming soon',
    bullets: [
      'Comprehensive cost-benefit analysis for transformation programs.',
      'Budget tracking, forecasting, and variance analysis.',
      'Economic impact modeling with scenario comparison tools.',
    ],
  },
  presentations: {
    title: 'Reports & Presentations',
    subtitle: 'Coming soon',
    bullets: [
      'AI-powered presentation builder with consulting-grade templates.',
      'Automated report generation from assessment and initiative data.',
      'Shareable decks with real-time collaboration and export options.',
    ],
  },
  meeting: {
    title: 'Meeting Intelligence',
    subtitle: 'Coming soon',
    bullets: [
      'AI-assisted meeting preparation with context-aware agendas.',
      'Real-time meeting notes, action items, and decision capture.',
      'Post-meeting summaries with automatic task assignment.',
    ],
  },
};

function resolveModuleKey(pathname: string): ModuleKey {
  if (pathname.includes('marketplace')) return 'marketplace';
  if (pathname.includes('mcp')) return 'iris';
  if (
    pathname.includes('execution') ||
    pathname.includes('implementation') ||
    pathname.includes('rollout')
  )
    return 'execution';
  if (pathname.includes('benefits') || pathname.includes('kpi')) return 'results';
  if (pathname.includes('economics') || pathname.includes('finance')) return 'finance';
  if (pathname.includes('presentations') || pathname.includes('reports')) return 'presentations';
  if (pathname.includes('meeting')) return 'meeting';
  return 'iris';
}

export const V4ComingSoonView: React.FC = () => {
  const location = useLocation();
  const moduleKey = resolveModuleKey(location.pathname);
  const copy = copyByModule[moduleKey];

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-navy-700 dark:bg-navy-900">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-600 dark:text-purple-400">
          Coming Soon
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{copy.title}</h1>
        <p className="mt-2 text-base text-slate-600 dark:text-slate-300">{copy.subtitle}</p>

        <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-slate-700 dark:text-slate-200">
          {copy.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>

        <div className="mt-8 rounded-lg bg-slate-50 p-4 dark:bg-navy-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            This module is under active development and will be available in an upcoming release.
            Your current subscription will include access when it launches.
          </p>
        </div>
      </div>
    </div>
  );
};

export default V4ComingSoonView;
