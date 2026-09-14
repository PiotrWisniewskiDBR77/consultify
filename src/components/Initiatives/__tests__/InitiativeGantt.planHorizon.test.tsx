/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

import { InitiativeGantt } from '../gantt/InitiativeGantt';

describe('InitiativeGantt portfolio plan horizon', () => {
  it('uses the canonical dependency path rendering and freezes in-execution bars in dark navy', () => {
    const { container } = render(
      <InitiativeGantt
        items={[
          { id: 'a', type: 'phase', title: 'Foundation', start: '2026-09-14', end: '2026-09-30', status: 'IN_EXECUTION', sourceId: 'a', sourceKind: 'phase' },
          { id: 'b', type: 'phase', title: 'Rollout', start: '2026-10-01', end: '2026-10-31', status: 'APPROVED', sourceId: 'b', sourceKind: 'phase' },
        ]}
        dependencies={[{ fromId: 'a', toId: 'b' }]}
        criticalPathIds={['a', 'b']}
        frozenItemIds={['a']}
        rangeStart="2026-09-14"
        rangeEnd="2027-09-14"
        initialZoom="month"
      />
    );

    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('[title*="Foundation"]')).toHaveClass('bg-navy-900');
    expect(container.querySelector('svg path')).toHaveAttribute('stroke', 'var(--c-danger)');
  });
});
