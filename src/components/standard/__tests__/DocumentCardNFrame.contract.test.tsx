import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DocumentCardNFrame } from '../DocumentCardNFrame';
import { DOCUMENT_CARD_CONTRACTS } from '../documentCardContracts';

describe('P14-B document card family contract', () => {
  it('defines all five cards and derives six canonical right-panel sections', () => {
    expect(Object.keys(DOCUMENT_CARD_CONTRACTS)).toEqual([
      'presentation',
      'report-builder',
      'template-architect-doc',
      'template-architect-deck',
      'finance-statement-pack',
    ]);
    for (const sections of Object.values(DOCUMENT_CARD_CONTRACTS)) {
      expect(sections.filter((section) => section.column === 'right').map((section) => section.id)).toEqual([
        'actions',
        'properties',
        'relations',
        'evidence',
        'comments',
        'history',
      ]);
    }
  });

  it('renders the standard properties table and the one canonical AI entry', () => {
    render(
      <DocumentCardNFrame
        type="finance-statement-pack"
        title="Pakiet 2026"
        isPolish
        properties={[{ id: 'status', label: 'Status', value: 'Szkic' }]}
        onAnalyze={vi.fn()}
      >
        <div>Treść</div>
      </DocumentCardNFrame>
    );
    expect(screen.getByText('Właściwość')).toBeInTheDocument();
    expect(screen.getByText('Wartość')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pracuj z AI' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pracuj z AI' }));
    expect(screen.getByRole('menuitem', { name: /Analizuj/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Uzupełnij tę sekcję/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Uzupełnij cały dokument/ })).toBeInTheDocument();
  });
});
