/** @vitest-environment jsdom */
/**
 * TEST-DANE D-07 (09.09.2026) — blok DETAILS podglądu sklejał wiersze w jedno
 * zdanie: „Owner: Daniel Osei Slides: 6 Updated: Sep 8, 2026" (Materiały →
 * Prezentacje). To NIE był defekt tamtego ekranu — wołacze kanonu budują treść
 * jako `[...].join('\n')`, a tekst leci przez `ReactMarkdown`, gdzie pojedynczy
 * znak nowej linii jest z definicji CommonMark „miękkim złamaniem" i renderuje
 * się jako SPACJA. Naprawa siedzi w miejscu wspólnym, więc i ten bezpiecznik.
 *
 * DOWÓD MUTACYJNY: przywróć `{resolvedText}` zamiast `{tekstZeZlamaniami}`
 * w `PreviewDetailsSection.tsx` -> pierwszy przypadek RED (trzy wiersze znów
 * sklejają się w jeden akapit).
 */
import { render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: unknown) => (typeof opts === 'string' ? opts : k),
    i18n: { language: 'en' },
  }),
}));

import { PreviewDetailsSection } from '../PreviewDetailsSection';

describe('PreviewDetailsSection — pojedyncze złamanie linii zostaje złamaniem', () => {
  it('trzy wiersze `join("\\n")` rysują się jako TRZY wiersze, nie jedno zdanie', () => {
    const { container } = render(
      <PreviewDetailsSection
        text={['Owner: Daniel Osei', 'Slides: 6', 'Updated: Sep 8, 2026'].join('\n')}
      />
    );
    // Sklejenie objawia się brakiem <br> i jednym ciągiem tekstu w akapicie.
    expect(container.querySelectorAll('br').length).toBeGreaterThanOrEqual(2);
    // Sklejenie objawia sie brakiem <br> MIEDZY wierszami w samym kodzie HTML
    // (`queryByText` normalizuje biale znaki i nie odroznilby obu przypadkow).
    const html = container.querySelector('p')?.innerHTML ?? '';
    expect(html).toMatch(/Owner: Daniel Osei\s*<br\s*\/?>/);
    expect(html).toMatch(/Slides: 6\s*<br\s*\/?>/);
  });

  it('nie rusza tekstu z blokiem kodu (tam spacje na końcu wiersza byłyby widoczne)', () => {
    const kod = ['Przed', '```', 'const a = 1;', '```', 'Po'].join('\n');
    const { container } = render(<PreviewDetailsSection text={kod} />);
    expect(container.querySelector('code')).not.toBeNull();
  });

  it('akapity rozdzielone pustą linią zostają osobnymi akapitami', () => {
    const { container } = render(<PreviewDetailsSection text={'Pierwszy akapit.\n\nDrugi akapit.'} />);
    expect(container.querySelectorAll('p').length).toBeGreaterThanOrEqual(2);
  });
});
