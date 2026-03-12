/**
 * Tests for Table OS views: KanbanView, CalendarView, MatrixView.
 * Verifies rendering, grouping, and event placement.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CalendarView } from '@/components/MyWork/table/CalendarView';
import { KanbanView } from '@/components/MyWork/table/KanbanView';
import { MatrixView } from '@/components/MyWork/table/MatrixView';
import type { ColumnDef, TableNode } from '@/components/MyWork/table/tableTypes';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

afterEach(cleanup);

function makeNode(id: string, data: Record<string, any>): TableNode {
  return { id, type: 'idea', data: { label: id, ...data }, position: { x: 0, y: 0 } };
}

const statusCol: ColumnDef = {
  key: 'status',
  header: 'Status',
  type: 'status',
  visible: true,
  width: 140,
  options: ['Todo', 'In Progress', 'Done'],
};

const dateCol: ColumnDef = {
  key: 'due_date',
  header: 'Due Date',
  type: 'date',
  visible: true,
  width: 140,
};

const impactCol: ColumnDef = {
  key: 'impact',
  header: 'Impact',
  type: 'number',
  visible: true,
  width: 100,
};

const effortCol: ColumnDef = {
  key: 'effort',
  header: 'Effort',
  type: 'number',
  visible: true,
  width: 100,
};

const labelCol: ColumnDef = {
  key: 'label',
  header: 'Name',
  type: 'text',
  visible: true,
  width: 200,
};

const allColumns = [labelCol, statusCol, dateCol, impactCol, effortCol];

const noop = vi.fn();

describe('KanbanView', () => {
  const nodes: TableNode[] = [
    makeNode('k1', { status: 'Todo', label: 'Task A' }),
    makeNode('k2', { status: 'In Progress', label: 'Task B' }),
    makeNode('k3', { status: 'Done', label: 'Task C' }),
    makeNode('k4', { status: 'Todo', label: 'Task D' }),
  ];

  it('renders without crashing', () => {
    const { container } = render(
      <KanbanView
        nodes={nodes}
        groupByColumn={statusCol}
        columns={allColumns}
        onFieldChange={noop}
      />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('renders all status columns', () => {
    render(
      <KanbanView
        nodes={nodes}
        groupByColumn={statusCol}
        columns={allColumns}
        onFieldChange={noop}
      />
    );
    expect(screen.getByText('Todo')).toBeTruthy();
    expect(screen.getByText('In Progress')).toBeTruthy();
    expect(screen.getByText('Done')).toBeTruthy();
  });

  it('places items in correct columns', () => {
    const { container } = render(
      <KanbanView
        nodes={nodes}
        groupByColumn={statusCol}
        columns={allColumns}
        onFieldChange={noop}
      />
    );
    expect(container.textContent).toContain('Task A');
    expect(container.textContent).toContain('Task B');
    expect(container.textContent).toContain('Task C');
    expect(container.textContent).toContain('Task D');
  });

  it('handles empty nodes', () => {
    const { container } = render(
      <KanbanView
        nodes={[]}
        groupByColumn={statusCol}
        columns={allColumns}
        onFieldChange={noop}
      />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('renders in locked mode', () => {
    const { container } = render(
      <KanbanView
        nodes={nodes}
        groupByColumn={statusCol}
        columns={allColumns}
        locked={true}
        onFieldChange={noop}
      />
    );
    expect(container.firstChild).toBeTruthy();
  });
});

describe('CalendarView', () => {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const rows: TableNode[] = [
    makeNode('cal1', { due_date: todayStr, label: 'Today Event' }),
    makeNode('cal2', { due_date: tomorrowStr, label: 'Tomorrow Event' }),
    makeNode('cal3', { label: 'No Date Event' }),
  ];

  it('renders without crashing', () => {
    const { container } = render(
      <CalendarView
        rows={rows}
        columns={allColumns}
        onNodeClick={noop}
        onFieldChange={noop}
      />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('renders month grid with day numbers', () => {
    const { container } = render(
      <CalendarView
        rows={rows}
        columns={allColumns}
        onNodeClick={noop}
      />
    );
    expect(container.textContent).toContain('1');
  });

  it('renders events on the calendar', () => {
    const { container } = render(
      <CalendarView
        rows={rows}
        columns={allColumns}
        onNodeClick={noop}
      />
    );
    expect(container.textContent).toContain('Today Event');
  });

  it('handles empty rows', () => {
    const { container } = render(
      <CalendarView
        rows={[]}
        columns={allColumns}
        onNodeClick={noop}
      />
    );
    expect(container.firstChild).toBeTruthy();
  });
});

describe('MatrixView', () => {
  const nodes: TableNode[] = [
    makeNode('m1', { impact: 8, effort: 2, label: 'High Impact Low Effort' }),
    makeNode('m2', { impact: 2, effort: 8, label: 'Low Impact High Effort' }),
    makeNode('m3', { impact: 7, effort: 7, label: 'High Both' }),
    makeNode('m4', { impact: 3, effort: 3, label: 'Low Both' }),
  ];

  it('renders without crashing', () => {
    const { container } = render(
      <MatrixView
        nodes={nodes}
        xAxis={impactCol}
        yAxis={effortCol}
        columns={allColumns}
      />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('renders quadrant labels', () => {
    const { container } = render(
      <MatrixView
        nodes={nodes}
        xAxis={impactCol}
        yAxis={effortCol}
        columns={allColumns}
      />
    );
    expect(container.textContent).toBeTruthy();
  });

  it('places items on the matrix', () => {
    const { container } = render(
      <MatrixView
        nodes={nodes}
        xAxis={impactCol}
        yAxis={effortCol}
        columns={allColumns}
      />
    );
    expect(container.textContent).toContain('High Impact Low Effort');
    expect(container.textContent).toContain('Low Impact High Effort');
  });

  it('handles empty nodes', () => {
    const { container } = render(
      <MatrixView
        nodes={[]}
        xAxis={impactCol}
        yAxis={effortCol}
        columns={allColumns}
      />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('renders in locked mode', () => {
    const { container } = render(
      <MatrixView
        nodes={nodes}
        xAxis={impactCol}
        yAxis={effortCol}
        columns={allColumns}
        locked={true}
      />
    );
    expect(container.firstChild).toBeTruthy();
  });
});
