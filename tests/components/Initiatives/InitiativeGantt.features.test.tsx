/**
 * @vitest-environment jsdom
 *
 * InitiativeGantt — V1 full features (zoom, status filter, dependency
 * connectors, critical-path highlight). The drag behaviour is covered by
 * InitiativeGantt.drag-reschedule.test.tsx.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { InitiativeGantt } from '@/components/Initiatives/gantt/InitiativeGantt';
import type { ScheduleItem } from '@/types/initiativeSchedule';

vi.mock('@/services/api', () => ({ Api: { put: vi.fn() } }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, fb?: string) => fb ?? _k }),
}));

const item = (over: Partial<ScheduleItem>): ScheduleItem => ({
  id: 'task:1',
  type: 'task',
  title: 'Task 1',
  start: '2026-06-10',
  end: '2026-06-14',
  status: 'in_progress',
  sourceId: '1',
  sourceKind: 'task',
  ...over,
});

const items: ScheduleItem[] = [
  item({ id: 'task:1', sourceId: '1', title: 'Analiza', status: 'in_progress' }),
  item({
    id: 'task:2',
    sourceId: '2',
    title: 'Projekt',
    status: 'todo',
    start: '2026-06-16',
    end: '2026-06-20',
  }),
];

describe('InitiativeGantt — V1 features', () => {
  it('renders zoom controls with Week active by default and toggles to Day', () => {
    render(<InitiativeGantt items={items} />);
    const week = screen.getByRole('button', { name: 'Week' });
    const day = screen.getByRole('button', { name: 'Day' });
    expect(week).toHaveAttribute('aria-pressed', 'true');
    expect(day).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(day);
    expect(day).toHaveAttribute('aria-pressed', 'true');
    expect(week).toHaveAttribute('aria-pressed', 'false');
  });

  it('status filter narrows the rendered bars to the chosen status', () => {
    render(<InitiativeGantt items={items} />);
    // both bars visible initially
    expect(screen.getByTitle(/Analiza/)).toBeInTheDocument();
    expect(screen.getByTitle(/Projekt/)).toBeInTheDocument();
    const select = screen.getByLabelText('All statuses') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'todo' } });
    // only the 'todo' bar (Projekt) remains
    expect(screen.queryByTitle(/Analiza/)).not.toBeInTheDocument();
    expect(screen.getByTitle(/Projekt/)).toBeInTheDocument();
  });

  it('renders dependency connector paths when dependencies are provided', () => {
    const { container } = render(
      <InitiativeGantt items={items} dependencies={[{ fromId: 'task:1', toId: 'task:2' }]} />
    );
    const paths = container.querySelectorAll('svg path');
    expect(paths.length).toBeGreaterThanOrEqual(1);
  });

  it('highlights critical-path bars with the semantic danger ring + title marker', () => {
    render(
      <InitiativeGantt
        items={items}
        dependencies={[{ fromId: 'task:1', toId: 'task:2' }]}
        criticalPathIds={['task:1', 'task:2']}
      />
    );
    const critical = screen.getByTitle(/Analiza.*critical path/);
    expect(critical.className).toMatch(/ring-c-danger/);
  });

  it('shows no status filter when items carry no status', () => {
    const noStatus = items.map((i) => ({ ...i, status: null }));
    render(<InitiativeGantt items={noStatus} />);
    expect(screen.queryByLabelText('All statuses')).not.toBeInTheDocument();
    // zoom controls still present
    expect(screen.getByRole('button', { name: 'Week' })).toBeInTheDocument();
  });
});
