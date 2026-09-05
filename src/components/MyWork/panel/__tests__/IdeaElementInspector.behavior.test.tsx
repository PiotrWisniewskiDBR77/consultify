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

// ★ NAPRAWA 2026-09-05 (uwaga właściciela, odbiór na żywo
// `mywork-idea-inspector-lekki`): the bespoke 8-section accordion
// (InspectorSection/CountHeading, custom <h3> headings) is retired in favor
// of the canonical `ArtifactRightPanel` shell (SPEC-A) every other artifact
// panel uses — six mandatory sections, fixed order, `data-artifact-section`
// markers instead of headings. The global react-i18next test mock
// (tests/setup.ts) fixes `i18n.language: 'en'`, so `ArtifactRightPanel`'s
// canonical section labels render in ENGLISH in this suite even though the
// component's own field labels (Etykieta/Stan/…) stay Polish — this matches
// the existing pattern in `IdeaRightPanel.menu1Sections.test.tsx`
// (`screen.getByText('Actions')`, `screen.getByText('Relations')`).
const sectionOrder = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[data-artifact-section]')).map((el) =>
    el.getAttribute('data-artifact-section')
  );

const badgeOf = (label: string) => {
  const header = screen.getByText(label).closest('button')!;
  return within(header).queryByText(/^\d+$/)?.textContent ?? null;
};

describe('IdeaElementInspector behavior', () => {
  it('keeps the inspector heading non-empty while an element label is blank', () => {
    render(<IdeaElementInspector element={{ id: 'node-without-label', label: '' }} tool="mindmap" />);

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Element bez nazwy');
  });

  it('renders the six SPEC-A canon sections in the fixed order, with real counts as badges', () => {
    const { container } = render(
      <IdeaElementInspector
        element={full}
        tool="mindmap"
        nativeStates={['idea']}
        toolSection={<p>Styl</p>}
      />
    );

    // Canon order (ArtifactRightPanel ARTIFACT_PANEL_SECTION_ORDER) — measured
    // from the live DOM via the component's own `data-artifact-section`
    // marker, not by counting headings (there are none anymore).
    expect(sectionOrder(container)).toEqual([
      'actions',
      'properties',
      'relations',
      'evidence',
      'comments',
      'history',
    ]);

    // Actions/Properties carry no badge (nothing to count) — matches the
    // owner-approved reference screenshot for this screen.
    expect(within(screen.getByText('Actions').closest('button')!).queryByText(/^\d+$/)).toBeNull();
    expect(
      within(screen.getByText('Properties').closest('button')!).queryByText(/^\d+$/)
    ).toBeNull();

    // Relations merges the old "Powiązania" (1) + "Artefakty wyjściowe" (1) —
    // SPEC-A has no separate outputs slot.
    expect(badgeOf('Relations')).toBe('2');
    expect(badgeOf('Sources and assumptions')).toBe('1');
    // Honest zero counts stay visible (showZeroBadge), matching the approved
    // reference (which showed "0" on every empty section, not a hidden badge).
    expect(badgeOf('Comments')).toBe('0');
    expect(badgeOf('History')).toBe('0');

    // Tool-specific content (mindmap "Wygląd węzła") now lives inside
    // Properties instead of its own 7th accordion.
    expect(screen.getByText('Wygląd węzła')).toBeInTheDocument();
    expect(screen.getByText('Styl')).toBeInTheDocument();
  });

  it('promotes the element description to a block at the very top of the panel (owner note, 2026-09-05)', () => {
    render(<IdeaElementInspector element={full} tool="mindmap" nativeStates={['idea']} />);

    const heading = screen.getByRole('heading', { level: 2, name: 'Adopcja użytkowników' });
    const description = screen.getByText('Opis');
    // The description sits in the DOM right after the title, ahead of every
    // accordion section — `compareDocumentPosition` proves "before", not just
    // "present somewhere".
    expect(
      heading.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    // It is not duplicated inside the merged "Treść i głębia" content further
    // down — only the OTHER depth fields (context/goal/rationale/risk) do.
    expect(screen.getAllByText('Opis')).toHaveLength(1);
    expect(screen.getByText('Kontekst')).toBeInTheDocument();
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

  it('keeps relations and evidence sections visible at zero with honest empty text', () => {
    render(
      <IdeaElementInspector
        element={{ ...full, evidence: [], relations: [], outputs: [] }}
        tool="whiteboard"
      />
    );
    expect(badgeOf('Relations')).toBe('0');
    expect(badgeOf('Sources and assumptions')).toBe('0');
    // Relations/Evidence default COLLAPSED (SPEC-A canon: only Akcje and
    // Właściwości default open) — expand them before asserting body text.
    fireEvent.click(screen.getByText('Relations').closest('button')!);
    fireEvent.click(screen.getByText('Sources and assumptions').closest('button')!);
    expect(screen.getByText('Brak powiązań.')).toBeInTheDocument();
    expect(screen.getByText('Brak zapisanych źródeł i założeń.')).toBeInTheDocument();
  });

  it('does not expose the element UUID or an output target slug in rendered text', () => {
    const { container } = render(<IdeaElementInspector element={full} tool="table" />);
    expect(container.textContent).not.toContain(full.id);
    expect(container.textContent).not.toContain('initiative-1');
    // Relations (which carries the converted-output "Otwórz" link) defaults
    // collapsed — expand it first.
    fireEvent.click(screen.getByText('Relations').closest('button')!);
    expect(within(container).getByRole('button', { name: 'Otwórz' })).toBeInTheDocument();
  });
});
