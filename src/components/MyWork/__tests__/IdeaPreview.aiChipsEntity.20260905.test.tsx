/**
 * Blok 4 (AI) podglądu Idei — chipy muszą być z ENCJI „pomysł", nie z Zadania.
 *
 * Zmierzone 2026-09-05 na żywo (Moja Praca → Pomysły → klik w wiersz): podgląd
 * Idei pokazywał „Dlaczego pilne? / Plan działania / Kto może pomóc?" — te trzy
 * stringi to co do znaku komplet z `MyTasksListContent.tsx`. Obraz zatwierdzony
 * przez właściciela (`evidence/grafika/144-runda-pelna-b/preview-4-zakladki__PO__light.png`,
 * kolumna Ideas) ma „Rozwiń pomysł / Znajdź ryzyka / Zaproponuj następny krok".
 *
 * DOWÓD MUTACYJNY: przywróć zestaw zadaniowy w `IdeaPreview.tsx` — oba testy padają.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { IdeaPreviewFooter } from '../IdeaPreview';
import type { MyIdea } from '../myIdeasTypes';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: string) => fallback ?? _k,
    i18n: { language: 'pl' },
  }),
}));

vi.mock('../ConvertToOutputMenu', () => ({
  ConvertToOutputMenu: () => <div data-testid="convert-menu" />,
}));

const idea = { id: 'i1', title: 'Wejście na rynek DACH', stage: 'spark' } as unknown as MyIdea;

describe('podgląd Idei — blok AI dopasowany do encji', () => {
  it('pokazuje chipy pomysłu', () => {
    render(
      <IdeaPreviewFooter
        idea={idea}
        isPolish
        onOpenIdeaInProcessFlow={() => undefined}
        onConvertComplete={() => undefined}
      />
    );
    expect(screen.getByText('Rozwiń pomysł')).toBeInTheDocument();
    expect(screen.getByText('Znajdź ryzyka')).toBeInTheDocument();
    expect(screen.getByText('Zaproponuj następny krok')).toBeInTheDocument();
  });

  it('NIE pokazuje chipów skopiowanych z podglądu Zadań', () => {
    render(
      <IdeaPreviewFooter
        idea={idea}
        isPolish
        onOpenIdeaInProcessFlow={() => undefined}
        onConvertComplete={() => undefined}
      />
    );
    expect(screen.queryByText('Dlaczego pilne?')).toBeNull();
    expect(screen.queryByText('Plan działania')).toBeNull();
    expect(screen.queryByText('Kto może pomóc?')).toBeNull();
  });
});
