/** @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { TemplateStructureList } from '@/components/TemplateBuilder/TemplateStructureList';

describe('TemplateStructureList visual controls', () => {
  it('keeps structural icon controls touch-sized and named', () => {
    render(
      <TemplateStructureList
        items={[
          { id: 'one', label: 'Summary', meta: 'Paragraph', index: 1 },
          { id: 'two', label: 'Risks', meta: 'Table', index: 2 },
        ]}
        selectedId="one"
        addLabel="Dodaj sekcję"
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onMove={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    for (const label of ['Przesuń w górę', 'Przesuń w dół', 'Usuń']) {
      const control = screen.getAllByRole('button', { name: label })[0];
      expect(control).toHaveAttribute('title', label);
      expect(control).toHaveClass('h-9', 'w-9');
    }
    expect(screen.getByRole('button', { name: 'Dodaj sekcję' })).toHaveAttribute(
      'title',
      'Dodaj sekcję'
    );
  });
});
