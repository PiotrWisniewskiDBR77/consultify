import React from 'react';
import { NavLink } from 'react-router-dom';

import { ROUTES } from '@/routes/routeConfig';

const domains = [
  { label: 'KPI', to: ROUTES.RESULTS_KPI.ROOT },
  { label: 'ROI', to: ROUTES.RESULTS_ROI.ROOT },
  { label: 'OKR', to: ROUTES.RESULTS_OKR.ROOT },
] as const;

export const ResultsDomainNav: React.FC = () => (
  <nav
    aria-label="Sekcje Results"
    className="flex items-center gap-2 border-b border-c-border bg-c-bg px-4 py-3"
  >
    {domains.map((domain) => (
      <NavLink
        key={domain.label}
        to={domain.to}
        className={({ isActive }) =>
          `inline-flex h-9 items-center rounded-full border px-4 text-sm font-semibold transition ${
            isActive
              ? 'border-c-focus bg-c-focus/10 text-c-focus-solid'
              : 'border-c-border bg-c-surface text-c-text-muted hover:text-c-text'
          }`
        }
      >
        {domain.label}
      </NavLink>
    ))}
  </nav>
);

export default ResultsDomainNav;
