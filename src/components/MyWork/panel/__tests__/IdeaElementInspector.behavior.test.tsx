/** @vitest-environment jsdom */
import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { IdeaElementInspector, type IdeaInspectorElement } from '../IdeaElementInspector';

const full: IdeaInspectorElement = {
  id: 'b1a87f77-5fdd-4ab4-969b-8ec9dc72348a',
  label: 'Adopcja użytkowników',
  state: 'idea',
  priority: 40,
  owner: 'Piotr',
  semanticType: 'Ryzyko',
  description: 'Opis',
  context: 'Kontekst',
  goal: 'Cel',
  rationale: 'Uzasadnienie',
  risk: 'Ryzyko',
  tags: ['erp', 'dane'],
  evidence: [{ id: 'e1', title: 'Badanie', type: 'Raport' }],
  relations: [{ id: 'r1', title: 'KPI adopcji', type: 'KPI' }],
  outputs: [{ id: 'o1', title: 'Pilotaż', type: 'Inicjatywa', targetId: 'initiative-1' }],
  branch: 'ERP',
  lineage: 'Rodowód: mapa w wersji 41',
};

describe('IdeaElementInspector behavior', () => {
  it('renders seven sections in the fixed order with counters', () => {
    render(
      <IdeaElementInspector
        element={full}
        tool="mindmap"
        nativeStates={['idea']}
        toolSection={<p>Styl</p>}
      />
    );
    const headings = screen.getAllByRole('heading', { level: 3 }).map((node) => node.textContent);
    expect(headings).toEqual([
      'Podstawowe 1',
      'Treść i głębia 5',
      'Klasyfikacja 2',
      'Dowody i źródła 1',
      'Powiązania 1',
      'Artefakty wyjściowe 1',
      'Wygląd węzła 1',
    ]);
  });

  it('keeps the unconfirmed draft and shows no saved receipt after a failed save', async () => {
    render(
      <IdeaElementInspector
        element={full}
        tool="table"
        nativeStates={['todo']}
        onSave={vi.fn().mockRejectedValue(new Error('500'))}
      />
    );
    fireEvent.change(screen.getByLabelText('Etykieta'), { target: { value: 'Nowa etykieta' } });
    fireEvent.blur(screen.getByLabelText('Etykieta'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się zapisać');
    expect(screen.queryByText(/^Zapisano/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Etykieta')).toHaveValue('Nowa etykieta');
  });

  it('renders the common empty state and omits an empty recent-items frame', () => {
    render(<IdeaElementInspector element={null} tool="process" recentItems={[]} />);
    expect(screen.getByText('Zaznacz element, aby zobaczyć właściwości')).toBeInTheDocument();
    expect(screen.queryByText('Ostatnio otwarte')).not.toBeInTheDocument();
  });

  it('keeps evidence, relations, and output sections visible at zero', () => {
    render(
      <IdeaElementInspector
        element={{ ...full, evidence: [], relations: [], outputs: [] }}
        tool="whiteboard"
      />
    );
    for (const title of ['Dowody i źródła', 'Powiązania', 'Artefakty wyjściowe']) {
      expect(
        screen.getByRole('heading', { name: new RegExp(`^${title}.*0$`) })
      ).toBeInTheDocument();
    }
  });

  it('does not expose the element UUID or an output target slug in rendered text', () => {
    const { container } = render(<IdeaElementInspector element={full} tool="table" />);
    expect(container.textContent).not.toContain(full.id);
    expect(container.textContent).not.toContain('initiative-1');
    expect(within(container).getByRole('button', { name: 'Otwórz' })).toBeInTheDocument();
  });
});
