/**
 * KPIGrid — Team Capacity credibility guard (render test).
 *
 * The owner flagged "TEAM CAPACITY 512% utilized" on the Manager tab. This test
 * asserts the rendered KPI never surfaces such an absurd number, and instead
 * degrades to a "Needs setup" state with an em dash.
 *
 * M02-008: the grid now takes a whole `ManagerSnapshot` rather than loose
 * numbers, so the fixture supplies team figures inside a snapshot.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

// t() returns the provided fallback so assertions read against English copy.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: unknown, opts?: Record<string, unknown>) => {
      // The component calls t(key, fallback) and t(key, fallback, params);
      // interpolate {{name}} placeholders so assertions can match real copy.
      const raw =
        typeof fallback === 'string'
          ? fallback
          : ((fallback as Record<string, unknown>)?.defaultValue as string) ?? _key;
      const params = (opts ?? (typeof fallback === 'object' ? fallback : null)) as Record<
        string,
        unknown
      > | null;
      if (!params) return raw;
      return raw.replace(/\{\{(\w+)\}\}/g, (m, k) => (params[k] != null ? String(params[k]) : m));
    },
    i18n: { language: 'en' },
  }),
}));

// framer-motion → plain DOM so we can query text without animation wrappers.
vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: () => (props: any) => {
        const { children, ...rest } = props ?? {};
        return React.createElement('div', rest, children);
      },
    }
  ),
}));

import { KPIGrid } from '../../../../src/components/MyWork/Executive/KPIGrid';
import { makeSnapshot } from './__fixtures__/managerSnapshot';

const withTeam = (team: Partial<ReturnType<typeof makeSnapshot>['team']>) =>
  makeSnapshot({
    team: { ...makeSnapshot().team, ...team },
  });

describe('KPIGrid — Team Capacity guard', () => {
  it('does not render an absurd 512% utilization', () => {
    render(
      <KPIGrid
        snapshot={withTeam({
          avgUtilizationPct: 512,
          overloaded: 4,
          available: 0,
          memberCount: 3,
          utilizationCredible: false,
        })}
      />
    );
    expect(screen.queryByText('512%')).not.toBeInTheDocument();
    expect(screen.getByText('Needs setup')).toBeInTheDocument();
  });

  it('renders a credible utilization as a real percent', () => {
    render(
      <KPIGrid snapshot={withTeam({ avgUtilizationPct: 82, overloaded: 1, available: 2 })} />
    );
    expect(screen.getByText('82%')).toBeInTheDocument();
    expect(screen.getByText('utilized')).toBeInTheDocument();
  });

  it('shows a needs-config state for a zero-member team instead of 0% utilized', () => {
    render(
      <KPIGrid
        snapshot={withTeam({
          avgUtilizationPct: 0,
          overloaded: 0,
          available: 0,
          memberCount: 0,
          utilizationCredible: false,
        })}
      />
    );
    expect(screen.getByText('Needs setup')).toBeInTheDocument();
    // The "utilized" sublabel (which would imply a real reading) must be gone.
    expect(screen.queryByText('utilized')).not.toBeInTheDocument();
  });
});
