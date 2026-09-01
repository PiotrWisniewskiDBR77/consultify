import React from 'react';

import { DeckOverflowWarning } from '../../src/components/Presentations/DeckBuilder/DeckOverflowWarning';

export default function Day230Przepelnienie(): React.ReactElement {
  const clean = new URLSearchParams(window.location.search).get('state') === 'clean';
  const warnings = clean
    ? []
    : [
        {
          slideIndex: 7,
          slideTitle: 'Ryzyka wdrożenia',
          powod: 'tresc' as const,
          zmierzone: 369,
          budzet: 240,
          pewnosc: 'wysoka' as const,
        },
      ];

  return (
    <main className="min-h-screen bg-c-bg px-10 py-8 text-c-text">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl border border-c-border bg-c-surface shadow-sm">
        <header className="border-b border-c-border px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-c-text-secondary">
            Prezentacje · eksport
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Transformacja operacyjna — plan decyzji</h1>
        </header>
        <DeckOverflowWarning
          warnings={warnings}
          onJumpToSlide={() => undefined}
          onContinueExport={() => undefined}
          onCancel={() => undefined}
        />
        <section className="grid grid-cols-[220px_1fr] gap-6 p-6">
          <aside className="space-y-2 border-r border-c-border pr-5">
            {[1, 2, 3, 4, 5, 6, 7].map((slide) => (
              <div
                key={slide}
                className={`rounded-md border px-3 py-2 text-sm ${slide === 7 ? 'border-c-warning bg-c-warning/10' : 'border-c-border'}`}
              >
                Slajd {slide}
              </div>
            ))}
          </aside>
          <div className="aspect-video rounded-xl border border-c-border bg-c-surface-raised p-12">
            <p className="text-sm text-c-text-secondary">SLIDE 7 · RYZYKA</p>
            <h2 className="mt-4 max-w-3xl text-4xl font-semibold">
              Ryzyka wdrożenia i działania osłonowe
            </h2>
            <p className="mt-5 max-w-2xl text-lg text-c-text-secondary">
              Dane na tym ekranie pochodzą z propsów harnessu. Stan czysty celowo nie renderuje
              żadnej pustej ramki ostrzeżenia.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
