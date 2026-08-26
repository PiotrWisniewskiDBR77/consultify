/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  IdeaElementInspector,
  type IdeaInspectorActivityItem,
  type IdeaInspectorElement,
} from '../IdeaElementInspector';

// RowDetailPanel parity (P0, 2026-08-26 — STOP `f864a060f0`, day 3): this
// covers the new 8th "Historia i AI" section, which merges the old Table
// detail panel's "Activity" and "AI Insights" tabs into the shared rail per
// the accepted prototype (`mywork-inspektor-prototyp.html`, Question 1,
// picked variant).

const element: IdeaInspectorElement = {
  id: 'row-1',
  label: 'Migracja danych',
  state: 'todo',
};

const activity: IdeaInspectorActivityItem[] = [
  {
    id: 'a1',
    action: 'status_change',
    oldValue: 'todo',
    newValue: 'in_progress',
    author: 'Anna Kowalska',
    createdAt: '2026-08-20T10:00:00.000Z',
  },
  {
    id: 'a2',
    action: 'edited',
    field: 'description',
    author: 'Piotr',
    createdAt: '2026-08-21T09:00:00.000Z',
  },
];

describe('IdeaElementInspector — Historia i AI (RowDetailPanel parity)', () => {
  it('starts collapsed and shows the honest empty state with no activity/insights', () => {
    render(<IdeaElementInspector element={element} tool="table" nativeStates={['todo']} />);
    const heading = screen.getByRole('heading', { name: /^Historia i AI/ });
    expect(heading).toHaveTextContent('Historia i AI 0');
    const header = heading.closest('[role="button"]');
    expect(header).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders real activity entries (newest first) once expanded, no fabricated content', () => {
    render(
      <IdeaElementInspector
        element={element}
        tool="table"
        nativeStates={['todo']}
        activity={activity}
      />
    );
    const heading = screen.getByRole('heading', { name: /^Historia i AI/ });
    fireEvent.click(heading.closest('[role="button"]')!);
    expect(screen.getByText(/Piotr/)).toBeInTheDocument();
    expect(screen.getByText(/Anna Kowalska/)).toBeInTheDocument();
    // Newest first — "edited" (a2, Piotr) renders before "status_change" (a1).
    const items = screen.getAllByText(/Piotr|Anna Kowalska/);
    expect(items[0]).toHaveTextContent('Piotr');
  });

  it('does not render a Generate button when no handler is supplied (no dead click)', () => {
    render(
      <IdeaElementInspector
        element={element}
        tool="table"
        nativeStates={['todo']}
        activity={activity}
      />
    );
    expect(
      screen.queryByRole('button', { name: /Wygeneruj podpowiedzi AI/ })
    ).not.toBeInTheDocument();
  });

  it('calls onGenerateInsights and renders the returned insights (real handler, real data)', () => {
    const onGenerateInsights = vi.fn();
    const { rerender } = render(
      <IdeaElementInspector
        element={element}
        tool="table"
        nativeStates={['todo']}
        onGenerateInsights={onGenerateInsights}
      />
    );
    const heading = screen.getByRole('heading', { name: /^Historia i AI/ });
    fireEvent.click(heading.closest('[role="button"]')!);
    fireEvent.click(screen.getByRole('button', { name: /Wygeneruj podpowiedzi AI/ }));
    expect(onGenerateInsights).toHaveBeenCalledTimes(1);

    rerender(
      <IdeaElementInspector
        element={element}
        tool="table"
        nativeStates={['todo']}
        onGenerateInsights={onGenerateInsights}
        aiInsights={['Domknij ryzyko braku klucza klienta w 3 systemach.']}
      />
    );
    expect(
      screen.getByText('Domknij ryzyko braku klucza klienta w 3 systemach.')
    ).toBeInTheDocument();
  });

  it('disables the Generate button and shows a loading label while aiLoading is true', () => {
    render(
      <IdeaElementInspector
        element={element}
        tool="table"
        nativeStates={['todo']}
        onGenerateInsights={vi.fn()}
        aiLoading
      />
    );
    const heading = screen.getByRole('heading', { name: /^Historia i AI/ });
    fireEvent.click(heading.closest('[role="button"]')!);
    const button = screen.getByRole('button', { name: /Generowanie/ });
    expect(button).toBeDisabled();
  });
});
