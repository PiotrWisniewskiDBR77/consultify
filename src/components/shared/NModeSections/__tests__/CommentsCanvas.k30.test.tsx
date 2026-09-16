/**
 * K-30 (zgłoszenie testera #82, Kasia, `/my-work`, „10. Komentarze — w tym pusty"):
 *   „komentarz pojawia się z nazwiskiem, ale z datą, a nie godziną.
 *    Nie było komunikatu: Czy na pewno chcesz usunąć ten komentarz?"
 *
 * KROK 0 — PREMISA ZMIERZONA NA `258043df9f` (w triage stało „nie sprawdzono"):
 * wątek komentarzy zadania rysuje NIE `MyWork/shared/CommentsSection` (ta ma
 * `confirm()` i godzinę), tylko `shared/NModeSections/CommentsCanvas` —
 * powierzchnia N-mode, której używa `TaskDetailView.tsx:5709`. Tam było:
 *   - `formatListDate(c.createdAt)` → sam DZIEŃ, bez godziny (`:186`),
 *   - `onClick={() => onDeleteComment(c.id)}` → usunięcie bez pytania (`:198`).
 * Obie usterki tester opisał dokładnie.
 *
 * Naprawa siedzi w komponencie WSPÓLNYM, więc obejmuje całą rodzinę wołaczy
 * (Zadanie, Decyzja, Powiadomienie, Inicjatywa) — pamięć „zlecenie obejmuje
 * rodzinę" i „naprawa per-wywołanie odrasta".
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, arg?: any) =>
      typeof arg === 'string' ? arg : typeof arg?.defaultValue === 'string' ? arg.defaultValue : key,
    i18n: { language: 'en' },
  }),
}));

import { CommentsCanvas } from '../CommentsCanvas';

/** 14:37 lokalnego czasu — godzina MUSI być widoczna obok daty. */
const KIEDY = new Date(2026, 8, 16, 14, 37, 0);

const wlasciwosci = (nadpisania: Record<string, unknown> = {}) => ({
  comments: [
    {
      id: 'c1',
      authorName: 'Katarzyna Szwarocka',
      content: 'Pierwszy komentarz',
      createdAt: KIEDY.toISOString(),
    },
  ],
  onDeleteComment: vi.fn(),
  dateFilter: 'all' as const,
  onDateFilterChange: vi.fn(),
  sortOrder: 'desc' as const,
  onToggleSort: vi.fn(),
  commentDraft: '',
  onCommentDraftChange: vi.fn(),
  onSubmitComment: vi.fn(),
  draftPriority: 'normal' as const,
  onDraftPriorityChange: vi.fn(),
  getPriorityDotClass: () => 'bg-c-border',
  getCommentPriority: () => 'normal' as const,
  getPriorityButtonClass: () => 'px-2',
  getCommentPriorityLabel: (p: string) => p,
  getCommentPriorityHint: (p: string) => p,
  ...nadpisania,
});

describe('K-30 — komentarz: godzina obok daty', () => {
  it('pokazuje datę Z GODZINĄ, nie sam dzień', () => {
    render(<CommentsCanvas {...(wlasciwosci() as any)} />);

    expect(screen.getByText('16/09/2026 14:37')).toBeTruthy();
    expect(screen.queryByText('16/09/2026')).toBeNull();
  });
});

describe('K-30 — usunięcie komentarza pyta o potwierdzenie', () => {
  it('sam klik w „×" NIE usuwa — najpierw pytanie', async () => {
    const onDeleteComment = vi.fn();
    render(<CommentsCanvas {...(wlasciwosci({ onDeleteComment }) as any)} />);

    await userEvent.click(screen.getByRole('button', { name: /Delete comment/i }));

    await waitFor(() => {
      expect(screen.getByText('Delete this comment?')).toBeTruthy();
    });
    expect(onDeleteComment).not.toHaveBeenCalled();
  });

  it('„Anuluj" zostawia komentarz w wątku', async () => {
    const onDeleteComment = vi.fn();
    render(<CommentsCanvas {...(wlasciwosci({ onDeleteComment }) as any)} />);

    await userEvent.click(screen.getByRole('button', { name: /Delete comment/i }));
    await screen.findByText('Delete this comment?');
    // W dialogu jest wlasny „Cancel” ORAZ ikona zamkniecia z aria-label
    // „Cancel” — bierzemy ten z tekstem, czyli widziany przez testera.
    const anuluj = screen
      .getAllByRole('button', { name: /^Cancel$/i })
      .find((el) => el.textContent?.trim() === 'Cancel');
    expect(anuluj).toBeTruthy();
    await userEvent.click(anuluj as HTMLElement);

    expect(onDeleteComment).not.toHaveBeenCalled();
  });

  it('potwierdzenie dopiero woła usunięcie — z właściwym identyfikatorem', async () => {
    const onDeleteComment = vi.fn();
    render(<CommentsCanvas {...(wlasciwosci({ onDeleteComment }) as any)} />);

    await userEvent.click(screen.getByRole('button', { name: /Delete comment/i }));
    await screen.findByText('Delete this comment?');
    await userEvent.click(screen.getByRole('button', { name: /^Delete$/i }));

    await waitFor(() => {
      expect(onDeleteComment).toHaveBeenCalledWith('c1');
    });
    expect(onDeleteComment).toHaveBeenCalledTimes(1);
  });
});
