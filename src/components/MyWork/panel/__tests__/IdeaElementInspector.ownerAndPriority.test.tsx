/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { IdeaElementInspector, type IdeaInspectorElement } from '../IdeaElementInspector';

// FIX-17 (Day 3 layer-2 acceptance): the accepted inspector prototype
// (mywork-fala3/proto-01-ideas-inspektor.html) shows (a) the priority slider
// with a numeric readout right next to it ("Priorytet — 70") and (b) Owner as
// an editable input, like Etykieta — for Table ("person" column) and Mindmap
// (AssignPersonModal's real "assign person" feature), the two tools whose OLD
// panel already had a functioning edit for it. Process Flow's own assignee
// input was never wired to persistence (dead field) and Whiteboard never had
// an assign feature, so both keep the read-only rendering.

const element: IdeaInspectorElement = {
  id: 'row-1',
  label: 'Migracja danych',
  state: 'todo',
  priority: 70,
  owner: 'Anna Kowalska',
};

describe('IdeaElementInspector — priority readout and Owner editability', () => {
  it('shows a numeric readout beside the priority slider', () => {
    render(<IdeaElementInspector element={element} tool="table" nativeStates={['todo']} />);
    expect(screen.getByText(/Priorytet.*70/)).toBeInTheDocument();
  });

  it('updates the readout as the slider moves, before commit', () => {
    render(<IdeaElementInspector element={element} tool="table" nativeStates={['todo']} />);
    fireEvent.change(screen.getByLabelText('Priorytet'), { target: { value: '55' } });
    expect(screen.getByText(/Priorytet.*55/)).toBeInTheDocument();
  });

  it.each(['table', 'mindmap'] as const)(
    'renders an editable Owner input for %s and commits on blur',
    async (tool) => {
      const onSave = vi.fn().mockResolvedValue({ ...element, owner: 'Piotr Nowak' });
      render(
        <IdeaElementInspector
          element={element}
          tool={tool}
          nativeStates={['todo']}
          onSave={onSave}
        />
      );
      const input = screen.getByLabelText('Właściciel');
      expect(input.tagName).toBe('INPUT');
      expect(input).toHaveValue('Anna Kowalska');
      fireEvent.change(input, { target: { value: 'Piotr Nowak' } });
      fireEvent.blur(input);
      expect(onSave).toHaveBeenCalledWith({ owner: 'Piotr Nowak' });
    }
  );

  it.each(['process', 'whiteboard'] as const)(
    'keeps Owner read-only for %s (no functioning old-panel edit to preserve)',
    (tool) => {
      render(<IdeaElementInspector element={element} tool={tool} nativeStates={[]} />);
      expect(screen.queryByLabelText('Właściciel')).not.toBeInTheDocument();
      expect(screen.getByText('Anna Kowalska')).toBeInTheDocument();
    }
  );

  // FIX (Day 3 layer-2 acceptance): the "Stan" <select> rendered raw native
  // status strings ("in_progress") as its own option text. A native <option>
  // can't host a <EntityStatusChip> component, so this routes through the
  // chip's own label-resolution helper (statusChipLabel, exported from
  // EntityStatusChip.tsx) — the same statusChip.* dictionary NotebookContextPanel
  // uses (commit 58ff6ac3fe) — instead of a bare raw value.
  it('humanizes the Stan option labels instead of showing the raw status value', () => {
    render(
      <IdeaElementInspector
        element={{ ...element, state: 'in_progress' }}
        tool="table"
        nativeStates={['todo', 'in_progress']}
      />
    );
    const select = screen.getByLabelText('Stan') as HTMLSelectElement;
    const options = Array.from(select.options).map((option) => option.textContent);
    expect(options).not.toContain('in_progress');
    expect(options).not.toContain('todo');
    // Mechanical fallback humanization (no PL i18n resources loaded in this
    // unit test env, same as NotebookContextPanel's equivalent test).
    expect(options).toContain('In progress');
    expect(options).toContain('Todo');
    // The underlying value stays the raw string — only the label changed.
    expect(select.value).toBe('in_progress');
  });
});
