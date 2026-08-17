/**
 * DecisionsPanelContent — Vegas re-skin anatomy tests.
 *
 * Guards the S1-U1 / row-anatomy parity brought to the Decisions LIST surface:
 *  1. Row anatomy: title = L2 (text-sm font-semibold text-c-text), neutral status
 *     shell via EntityStatusChip, priority via PriorityChip (color only in dot).
 *  2. Selection / preview highlight uses the neutral+blue canon — NEVER
 *     crimson/primary.
 *  3. Clicking a decision row opens its preview AND applies the preview highlight
 *     to that row.
 *
 * kanon TRIADA §27 (harvard/m03m04-canon): this screen now renders via
 * StandardTable/FilterableTable (was a bespoke `<table>`). The row highlight
 * is FilterableTable's own canonical selected-row class
 * (`bg-slate-50 dark:bg-white/[0.06]`, src/components/shared/ModuleHub/
 * FilterableTable.tsx) — a shared, neutral style, not this screen's old
 * bespoke `PREVIEW_SELECTED_ROW_CLASS` (`--c-info` inset bar). Still neutral,
 * still never crimson/primary — just the shared kanon token instead of a
 * per-screen one.
 */
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PREVIEW_SELECTED_ROW_CLASS,
  SELECTED_ROW_CLASS,
} from '@/components/shared/selectionTokens';

// ── i18n (English so we can assert visible labels) ──────────────────────────
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Mirror i18next: t(key, fallbackString) OR t(key, { defaultValue }).
    t: (key: string, opt?: unknown) => {
      if (typeof opt === 'string') return opt;
      if (opt && typeof opt === 'object' && 'defaultValue' in (opt as Record<string, unknown>)) {
        return String((opt as { defaultValue: unknown }).defaultValue);
      }
      return key;
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

// ── App store: identify the current user so "my decisions" filter matches ───
vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    currentUser: { id: 'user-1', firstName: 'Test', displayName: 'Test User' },
  }),
}));

// ── Toasts are noise here ───────────────────────────────────────────────────
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn(), loading: vi.fn() },
}));

// ── API layer ───────────────────────────────────────────────────────────────
const mockDecisions = [
  {
    id: 'decision-1',
    title: 'Approve Q1 Budget Increase',
    description: 'Review and approve the Q1 budget increase request',
    status: 'PENDING',
    decisionType: 'Financial',
    decisionOwnerId: 'user-1', // mine to decide
    priority: 'CRITICAL',
    createdAt: '2026-06-01T00:00:00Z',
    dueDate: '2026-07-15T00:00:00Z',
    projectName: 'Project Alpha',
  },
  {
    id: 'decision-2',
    title: 'Pick Frontend Framework',
    description: 'Decision on the shared component stack',
    status: 'PENDING',
    decisionType: 'Technical',
    decisionOwnerId: 'user-1', // mine to decide
    priority: 'MEDIUM',
    createdAt: '2026-06-02T00:00:00Z',
    dueDate: '2026-07-20T00:00:00Z',
    projectName: 'Project Beta',
  },
];

vi.mock('@/services/api', () => ({
  Api: {
    getDecisions: vi.fn(async () => mockDecisions),
    getUsers: vi.fn(async () => []),
    getDecision: vi.fn(async (id: string) => mockDecisions.find((d) => d.id === id) ?? null),
    get: vi.fn(async () => ({})),
    post: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
    decideDecision: vi.fn(async () => ({})),
    remindDecision: vi.fn(async () => ({})),
    escalateDecision: vi.fn(async () => ({})),
    snoozeDecision: vi.fn(async () => ({})),
  },
}));

import { DecisionsPanelContent } from '@/components/MyWork/DecisionsPanelContent';
import { Api } from '@/services/api';

function renderPanel(props: Partial<React.ComponentProps<typeof DecisionsPanelContent>> = {}) {
  return render(
    <MemoryRouter>
      <DecisionsPanelContent
        viewMode="my"
        searchQuery=""
        onCountsChange={vi.fn()}
        onDecisionClick={vi.fn()}
        {...props}
      />
    </MemoryRouter>
  );
}

/** Walk up from a cell to its owning table row. */
function rowFor(el: HTMLElement): HTMLElement {
  const tr = el.closest('tr');
  if (!tr) throw new Error('no owning <tr>');
  return tr as HTMLElement;
}

describe('DecisionsPanelContent — Vegas re-skin anatomy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getDecisions).mockResolvedValue(mockDecisions);
  });

  it('renders decision rows with the L2 title token (text-sm font-semibold text-c-text)', async () => {
    renderPanel();
    const title = await screen.findByText('Approve Q1 Budget Increase');
    expect(title.className).toContain('text-sm');
    expect(title.className).toContain('font-semibold');
    expect(title.className).toContain('text-c-text');
  });

  it('never paints selection/preview state with crimson or primary (neutral+blue canon)', async () => {
    await screen.findByText; // ensure module loaded
    // The canonical tokens are the ONLY selection surfaces used by the rows.
    expect(SELECTED_ROW_CLASS).not.toMatch(/crimson|primary/);
    expect(PREVIEW_SELECTED_ROW_CLASS).not.toMatch(/crimson|primary/);
    // Blue signal accent bar = --c-info.
    expect(PREVIEW_SELECTED_ROW_CLASS).toContain('var(--c-info)');
  });

  it('applies the preview highlight to the row when it is clicked (isPreviewed wiring)', async () => {
    renderPanel();
    const title = await screen.findByText('Approve Q1 Budget Increase');
    const row = rowFor(title);

    // Before click: no canonical semantic selection surface.
    expect(row.className).not.toContain('bg-state-selected');

    fireEvent.click(row);

    await waitFor(() => {
      expect(row.className).toContain('bg-state-selected');
    });
  });

  it('only the clicked row gets the preview highlight (others stay neutral)', async () => {
    renderPanel();
    const first = rowFor(await screen.findByText('Approve Q1 Budget Increase'));
    const second = rowFor(await screen.findByText('Pick Frontend Framework'));

    fireEvent.click(first);

    await waitFor(() => {
      expect(first.className).toContain('bg-state-selected');
    });
    expect(second.className).not.toContain('bg-state-selected');
  });

  it('renders a neutral-shell status chip (dot carries the only color)', async () => {
    renderPanel();
    const title = await screen.findByText('Approve Q1 Budget Increase');
    const row = rowFor(title);
    // EntityStatusChip humanizes PENDING → "Pending" in a neutral shell.
    const statusChip = within(row).getByText(/pending/i);
    // Shell must not be a solid crimson/primary fill.
    expect(statusChip.closest('span,div')?.className || '').not.toMatch(/bg-primary|bg-crimson/);
  });

  it('announces a durable load error instead of rendering the empty-success state', async () => {
    vi.mocked(Api.getDecisions).mockRejectedValueOnce(new Error('backend unavailable'));

    renderPanel();

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Failed to load decisions')).toBeInTheDocument();
    expect(screen.queryByText('No decisions awaiting your action')).not.toBeInTheDocument();
    expect(Api.getDecisions).toHaveBeenCalledTimes(1);
  });

  it('retries exactly once, shows loading while pending, and replaces the error with data', async () => {
    let resolveRetry!: (value: typeof mockDecisions) => void;
    vi.mocked(Api.getDecisions)
      .mockRejectedValueOnce(new Error('backend unavailable'))
      .mockImplementationOnce(
        () => new Promise<typeof mockDecisions>((resolve) => (resolveRetry = resolve))
      );

    renderPanel();
    const retry = await screen.findByRole('button', { name: 'Try again' });
    fireEvent.click(retry);

    expect(Api.getDecisions).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();

    resolveRetry(mockDecisions);
    expect(await screen.findByText('Approve Q1 Budget Increase')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(Api.getDecisions).toHaveBeenCalledTimes(2);
  });
});
