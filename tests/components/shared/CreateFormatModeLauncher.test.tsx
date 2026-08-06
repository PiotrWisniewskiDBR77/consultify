/** @vitest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { FileType2, PenLine, Sparkles } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import { CreateFormatModeLauncher } from '@/components/shared/CreateFormatModeLauncher';

const formatTiles = [
  {
    id: 'document' as const,
    icon: FileType2,
    title: 'Szablon dokumentu Word',
    hint: 'Raporty zarządcze i memoranda.',
  },
];

const modeTiles = [
  { id: 'blank' as const, icon: PenLine, title: 'Od czystego', desc: 'Zacznij od zera.' },
  { id: 'ai' as const, icon: Sparkles, title: 'Z AI', desc: 'Zaplanuj strukturę z AI.' },
];

describe('CreateFormatModeLauncher', () => {
  it('exposes a named modal and descriptive, keyboard-focusable format card', () => {
    render(
      <CreateFormatModeLauncher
        isOpen
        onClose={vi.fn()}
        title="Nowy szablon"
        stepOneHint="Wybierz typ szablonu"
        formatTiles={formatTiles}
        modeTiles={modeTiles}
        onSelect={vi.fn()}
        testId="template-launcher"
      />
    );

    const dialog = screen.getByRole('dialog', { name: 'Nowy szablon' });
    expect(dialog).toHaveAccessibleDescription('Wybierz typ szablonu');
    expect(
      screen.getByRole('button', {
        name: 'Szablon dokumentu Word. Raporty zarządcze i memoranda.',
      })
    ).toBeVisible();
  });

  it('keeps the two-step navigation contract and returns the selected pair', () => {
    const onSelect = vi.fn();
    render(
      <CreateFormatModeLauncher
        isOpen
        onClose={vi.fn()}
        title="Nowy szablon"
        stepOneHint="Wybierz typ szablonu"
        stepTwoTitle={() => 'Jak chcesz zacząć?'}
        stepTwoHint={() => 'Wybierz tryb pracy'}
        formatTiles={formatTiles}
        modeTiles={modeTiles}
        onSelect={onSelect}
        testId="template-launcher"
      />
    );

    fireEvent.click(screen.getByTestId('template-launcher-format-document'));
    expect(screen.getByRole('dialog', { name: 'Jak chcesz zacząć?' })).toHaveAccessibleDescription(
      'Wybierz tryb pracy'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Z AI. Zaplanuj strukturę z AI.' }));
    expect(onSelect).toHaveBeenCalledWith('document', 'ai');
  });

  it('closes from Escape at the first step', () => {
    const onClose = vi.fn();
    render(
      <CreateFormatModeLauncher
        isOpen
        onClose={onClose}
        title="Nowy szablon"
        formatTiles={formatTiles}
        modeTiles={modeTiles}
        onSelect={vi.fn()}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
