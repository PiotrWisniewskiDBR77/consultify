/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WorkRiskBoundaryBadge } from '../workRiskBoundarySurface';

const t = (key: string, fallback?: unknown, options?: Record<string, unknown>) => {
  if (typeof fallback !== 'string') return key;
  return fallback.replace(/{{(\w+)}}/g, (_, name) => String(options?.[name] ?? ''));
};

describe('WorkRiskBoundaryBadge', () => {
  it('renders risk state, decision level, source and evidence completeness', () => {
    render(
      <WorkRiskBoundaryBadge
        t={t as any}
        boundary={{
          sourceType: 'initiative',
          sourceId: 'overdue-init-a',
          riskState: 'red',
          decisionLevel: 3,
          missingEvidence: [],
          requiresHumanReview: false,
        }}
      />
    );

    const badge = screen.getByTestId('rollout-work-risk-boundary');
    expect(badge).toHaveTextContent('Work/risk boundary');
    expect(badge).toHaveTextContent('red');
    expect(badge).toHaveTextContent('L3');
    expect(badge).toHaveTextContent('initiative');
    expect(badge).toHaveTextContent('overdue-init-a');
    expect(badge).toHaveTextContent('Evidence complete');
  });
});
