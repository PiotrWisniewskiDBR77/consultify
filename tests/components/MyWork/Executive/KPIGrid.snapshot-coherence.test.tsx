/**
 * KPIGrid — M02-008 regression: the grid may not print two populations as if
 * they were one, and may not lose a card.
 *
 * The finding: "Task Execution 0% · 0/1" (tasks CREATED in the last 7 days)
 * rendered directly above "Overdue 71" (the ALL-TIME open backlog), with
 * "Decisions pending 10" that was the page size of a `LIMIT 10` list, next to
 * AI copy quoting 77 and 54 from an ORG-wide count. Nothing on screen said the
 * numbers meant different things.
 */
import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: unknown, opts?: Record<string, unknown>) => {
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

const CARD_IDS = ['kpi-tasks', 'kpi-decisions', 'kpi-capacity', 'kpi-risk'];

describe('KPIGrid — one snapshot, labelled bases', () => {
  it('renders all four KPI slots even with no snapshot at all', () => {
    // Regression: the Risk card used to disappear when its source request
    // failed, leaving three cards and a silent empty column.
    render(<KPIGrid snapshot={null} />);
    for (const id of CARD_IDS) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
  });

  it('labels every card with the basis of its numbers', () => {
    render(<KPIGrid snapshot={makeSnapshot()} />);
    expect(screen.getByTestId('kpi-tasks-basis')).toHaveTextContent('Mine');
    expect(screen.getByTestId('kpi-decisions-basis')).toHaveTextContent('Mine');
    expect(screen.getByTestId('kpi-capacity-basis')).toHaveTextContent('Organization');
    // Risk mixes an owner figure with an org figure, and says so.
    expect(screen.getByTestId('kpi-risk-basis')).toHaveTextContent('Mine');
    expect(screen.getByTestId('kpi-risk-basis')).toHaveTextContent('Organization');
  });

  it('states the window for the completion ratio and the backlog for overdue', () => {
    render(<KPIGrid snapshot={makeSnapshot()} />);
    const tasks = within(screen.getByTestId('kpi-tasks'));

    // The ratio is explicitly window-scoped...
    expect(tasks.getByText(/last 7 days/i)).toBeInTheDocument();
    // ...and overdue is explicitly a slice of the OPEN BACKLOG (84), not of the
    // window denominator (1). This is the pair that used to read as "71 of 1".
    expect(tasks.getByText(/Overdue \(of 84 open\)/i)).toBeInTheDocument();
    expect(tasks.getByText('71')).toBeInTheDocument();
  });

  it('never renders an overdue count larger than the population it is drawn from', () => {
    const snapshot = makeSnapshot();
    render(<KPIGrid snapshot={snapshot} />);

    // The invariant the old UI broke on screen.
    expect(snapshot.owner.tasks.overdue).toBeLessThanOrEqual(snapshot.owner.tasks.openTotal);
    const tasks = within(screen.getByTestId('kpi-tasks'));
    const denominator = Math.max(
      snapshot.owner.tasks.windowCreated,
      snapshot.owner.tasks.windowCompleted
    );
    // The window denominator (1) is rendered, but nothing claims the 71
    // overdue items belong to it.
    expect(tasks.getByText(new RegExp(`0/${denominator}`))).toBeInTheDocument();
  });

  it('shows the pending-decision COUNT, which may exceed any list page size', () => {
    render(<KPIGrid snapshot={makeSnapshot()} />);
    const decisions = within(screen.getByTestId('kpi-decisions'));
    // 23 > the old `LIMIT 10`, so a capped list could never have produced it.
    expect(decisions.getByText('23')).toBeInTheDocument();
  });

  it('reads risk blockers and escalations from the same snapshot as the AI copy', () => {
    const snapshot = makeSnapshot();
    render(<KPIGrid snapshot={snapshot} />);
    const risk = within(screen.getByTestId('kpi-risk'));

    expect(risk.getByText(/Overdue tasks \(mine\)/i)).toBeInTheDocument();
    expect(risk.getByText(String(snapshot.risk.blockers))).toBeInTheDocument();
    expect(risk.getByText(/Escalated decisions \(org\)/i)).toBeInTheDocument();
    expect(risk.getByText(String(snapshot.risk.escalations))).toBeInTheDocument();

    // Both are the snapshot's own fields — not recomputed on the client.
    expect(snapshot.risk.blockers).toBe(snapshot.owner.tasks.overdue);
    expect(snapshot.risk.escalations).toBe(snapshot.organization.decisions.escalated);
  });
});
