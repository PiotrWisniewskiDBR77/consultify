import React from 'react';
import { useLocation } from 'react-router-dom';

type ModuleKey = 'iris' | 'marketplace';

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
};

export const V4ComingSoonView: React.FC = () => {
  const location = useLocation();
  const moduleKey: ModuleKey = location.pathname.includes('marketplace') ? 'marketplace' : 'iris';
  const copy = copyByModule[moduleKey];

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-navy-700 dark:bg-navy-900">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
          V4 Placeholder
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{copy.title}</h1>
        <p className="mt-2 text-base text-slate-600 dark:text-slate-300">{copy.subtitle}</p>

        <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-slate-700 dark:text-slate-200">
          {copy.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default V4ComingSoonView;
