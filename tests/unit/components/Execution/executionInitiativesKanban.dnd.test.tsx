/**
 * @vitest-environment jsdom
 *
 * M14 L-08 / S2 — kanban-DnD: verifies onStatusChange is called when a card
 * is dropped on a different-status column, and not called in readOnly mode or
 * same-column drops.
 */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

// ── Mock @dnd-kit so we can invoke onDragEnd deterministically ────────────────
let capturedOnDragEnd: ((e: any) => void) | undefined;

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragEnd }: any) => {
    capturedOnDragEnd = onDragEnd;
    return React.createElement(React.Fragment, null, children);
  },
  DragOverlay: () => null,
  closestCorners: {},
  PointerSensor: class {},
  KeyboardSensor: class {},
  useSensor: () => ({}),
  useSensors: (...args: any[]) => args,
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: any) => React.createElement(React.Fragment, null, children),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
  verticalListSortingStrategy: {},
  sortableKeyboardCoordinates: {},
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}));

// ── Minimal dependency mocks ──────────────────────────────────────────────────
vi.mock('@/constants/statusColors', () => ({
  getStatusStyle: () => ({ dot: '', bg: '', text: '', border: '' }),
  getPriorityStyle: () => ({ dot: '', text: '' }),
}));

vi.mock('@/services/initiativeLifecycle', () => ({
  STATUS_METADATA: {
    SCHEDULED: { label: 'Scheduled' },
    EXECUTING: { label: 'Executing' },
    BLOCKED: { label: 'Blocked' },
    DONE: { label: 'Done' },
    CANCELLED: { label: 'Cancelled' },
    ARCHIVED: { label: 'Archived' },
  },
}));

vi.mock('@/utils/initiativeHelpers', () => ({
  getHealthInfo: () => ({ label: 'OK', icon: null, color: '' }),
  getNextStep: () => null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock('lucide-react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('lucide-react')>()),
  User: () => null,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
import { ExecutionInitiativesKanbanView } from '@/components/Execution/ExecutionInitiativesKanbanView';
import type { PortfolioInitiative } from '@/types';

function makeInitiative(overrides: Partial<PortfolioInitiative>): PortfolioInitiative {
  return {
    id: 'init-1',
    name: 'Alpha',
    axis: 'ops',
    status: 'SCHEDULED',
    priority: 'HIGH',
    progress: 0,
    budget: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  } as PortfolioInitiative;
}

function fire(event: { activeId: string; overId: string }) {
  capturedOnDragEnd?.({
    active: { id: event.activeId },
    over: { id: event.overId },
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('ExecutionInitiativesKanbanView — DnD status change (M14/S2)', () => {
  beforeEach(() => {
    capturedOnDragEnd = undefined;
  });

  it('calls onStatusChange when card dropped on a different column', () => {
    const onStatusChange = vi.fn();
    const onInitiativeClick = vi.fn();
    const initiative = makeInitiative({ id: 'init-1', status: 'SCHEDULED' });

    render(
      <ExecutionInitiativesKanbanView
        initiatives={[initiative]}
        onInitiativeClick={onInitiativeClick}
        onStatusChange={onStatusChange}
        scope="active"
      />
    );

    fire({ activeId: 'init-1', overId: 'EXECUTING' });

    expect(onStatusChange).toHaveBeenCalledOnce();
    expect(onStatusChange).toHaveBeenCalledWith('init-1', 'EXECUTING');
  });

  it('does NOT call onStatusChange when dropped on same column', () => {
    const onStatusChange = vi.fn();
    const initiative = makeInitiative({ id: 'init-1', status: 'SCHEDULED' });

    render(
      <ExecutionInitiativesKanbanView
        initiatives={[initiative]}
        onInitiativeClick={vi.fn()}
        onStatusChange={onStatusChange}
        scope="active"
      />
    );

    fire({ activeId: 'init-1', overId: 'SCHEDULED' });

    expect(onStatusChange).not.toHaveBeenCalled();
  });

  it('does NOT call onStatusChange when readOnly=true', () => {
    const onStatusChange = vi.fn();
    const initiative = makeInitiative({ id: 'init-1', status: 'SCHEDULED' });

    render(
      <ExecutionInitiativesKanbanView
        initiatives={[initiative]}
        onInitiativeClick={vi.fn()}
        onStatusChange={onStatusChange}
        scope="active"
        readOnly
      />
    );

    fire({ activeId: 'init-1', overId: 'EXECUTING' });

    expect(onStatusChange).not.toHaveBeenCalled();
  });

  it('does NOT call onStatusChange when over target is null (drop outside)', () => {
    const onStatusChange = vi.fn();
    const initiative = makeInitiative({ id: 'init-1', status: 'SCHEDULED' });

    render(
      <ExecutionInitiativesKanbanView
        initiatives={[initiative]}
        onInitiativeClick={vi.fn()}
        onStatusChange={onStatusChange}
        scope="active"
      />
    );

    capturedOnDragEnd?.({ active: { id: 'init-1' }, over: null });

    expect(onStatusChange).not.toHaveBeenCalled();
  });

  it('resolves target column when dropped on another card (card-on-card)', () => {
    const onStatusChange = vi.fn();
    const i1 = makeInitiative({ id: 'init-1', status: 'SCHEDULED' });
    const i2 = makeInitiative({ id: 'init-2', status: 'EXECUTING' });

    render(
      <ExecutionInitiativesKanbanView
        initiatives={[i1, i2]}
        onInitiativeClick={vi.fn()}
        onStatusChange={onStatusChange}
        scope="active"
      />
    );

    // Dropped init-1 ON TOP OF init-2 (not on the column id directly)
    fire({ activeId: 'init-1', overId: 'init-2' });

    expect(onStatusChange).toHaveBeenCalledWith('init-1', 'EXECUTING');
  });
});
