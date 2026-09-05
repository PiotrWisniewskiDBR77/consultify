/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  IdeaElementInspector,
  type IdeaInspectorActivityItem,
  type IdeaInspectorElement,
} from '../IdeaElementInspector';

// RowDetailPanel parity (P0, 2026-08-26 — STOP `f864a060f0`, day 3): covers
// the section merging the old Table detail panel's "Activity" and
// "AI Insights" tabs into the shared rail.
//
// ★ NAPRAWA 2026-09-05 (uwaga właściciela, odbiór na żywo
// `mywork-idea-inspector-lekki`): the section moved into the canonical
// `ArtifactRightPanel` shell and was renamed from "Historia i AI" to
// "Historia" (SPEC-A's own SSOT, `ARTIFACT_PANEL_SECTION_LABELS.history`,
// already bans the "/ AI" suffix — AI is a content type inside the stream,
// not part of the section name). The global i18n test mock fixes
// `i18n.language: 'en'`, so the canonical label renders as "History" here
// (see `IdeaElementInspector.behavior.test.tsx` for the same pattern).

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

const historyButton = () => screen.getByText('History').closest('button')!;

describe('IdeaElementInspector — Historia (RowDetailPanel parity)', () => {
  it('starts collapsed and shows the honest empty state with no activity/insights', () => {
    render(<IdeaElementInspector element={element} tool="table" nativeStates={['todo']} />);
    const button = historyButton();
    expect(button).toHaveTextContent('History');
    expect(button).toHaveTextContent('0');
    expect(button).toHaveAttribute('aria-expanded', 'false');
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
    fireEvent.click(historyButton());
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
    fireEvent.click(historyButton());
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
    fireEvent.click(historyButton());
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
    fireEvent.click(historyButton());
    const button = screen.getByRole('button', { name: /Generowanie/ });
    expect(button).toBeDisabled();
  });
});
