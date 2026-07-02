/**
 * KPIGrid — Team Capacity credibility guard (render test).
 *
 * The owner flagged "TEAM CAPACITY 512% utilized" on the Manager tab. This test
 * asserts the rendered KPI never surfaces such an absurd number, and instead
 * degrades to a "Needs setup" state with an em dash.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// t() returns the provided fallback so assertions read against English copy.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
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

describe('KPIGrid — Team Capacity guard', () => {
  it('does not render an absurd 512% utilization', () => {
    render(
      <KPIGrid
        data={{
          team: { avgCapacity: 512, overloaded: 4, available: 0, trend: 'down', memberCount: 3 },
        }}
      />
    );
    expect(screen.queryByText('512%')).not.toBeInTheDocument();
    expect(screen.getByText('Needs setup')).toBeInTheDocument();
  });

  it('renders a credible utilization as a real percent', () => {
    render(
      <KPIGrid
        data={{
          team: { avgCapacity: 82, overloaded: 1, available: 2, trend: 'stable', memberCount: 5 },
        }}
      />
    );
    expect(screen.getByText('82%')).toBeInTheDocument();
    expect(screen.getByText('utilized')).toBeInTheDocument();
  });

  it('shows a needs-config state for a zero-member team instead of 0% utilized', () => {
    render(
      <KPIGrid
        data={{
          team: { avgCapacity: 0, overloaded: 0, available: 0, trend: 'stable', memberCount: 0 },
        }}
      />
    );
    expect(screen.getByText('Needs setup')).toBeInTheDocument();
    // The "utilized" sublabel (which would imply a real reading) must be gone.
    expect(screen.queryByText('utilized')).not.toBeInTheDocument();
  });
});
