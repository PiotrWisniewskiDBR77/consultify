import React, { useState } from 'react';

import { OutlineStep } from '../../src/components/Presentations/wizard/OutlineStep';
import type { OutlineItem } from '../../src/components/Presentations/wizard/types';

// Rusztowanie dowodowe (NIE ekran produktu — patrz ODBIOR_231.md).
//
// Status po FIX-2 (server/src/services/presentationKnowledgeOutlineService.ts):
// `filterOutlineSourcesByEvidence` dopasowuje teraz `zrodla[].etykieta`/`id`
// do `documentTitle` z realnego wyniku `executeKBSearch` (normalizacja NFKC +
// whitespace + case). Chipy poniżej pokazują więc kształt, jaki produkt
// faktycznie umie dziś wyprodukować (etykieta = tytuł dokumentu z bazy
// wiedzy); PRZED FIX-2 był to kształt strukturalnie niemożliwy (filtr
// wymagał `documentId`, którego `executeKBSearch` nigdy nie zwraca — żadne
// źródło nie mogło przejść). Nadal jest to STATYCZNY fixture harnessu, nie
// dowód, że model sam wywoła `search_knowledge_base` z właściwym zasięgiem
// (to zostaje otwarte jako R5c, budżet właściciela) — nie promuj tego ekranu
// do produktu.
const fixture: OutlineItem[] = [
  {
    intent: 'cover',
    title: 'Retencja klientów premium — decyzja na Q4',
    keyMessage: 'Pilotaż pokazuje mierzalny wzrost retencji i uzasadnia kontrolowane rozszerzenie.',
    teza: 'Pilotaż pokazuje mierzalny wzrost retencji i uzasadnia kontrolowane rozszerzenie.',
    enabled: true,
    zrodla: [{ typ: 'knowledge_doc', id: 'doc-day231-a', etykieta: 'Raport pilotażu Q2' }],
  },
  {
    intent: 'performance_overview',
    title: 'Wynik przekracza grupę kontrolną o 12,2 p.p.',
    keyMessage: 'Retencja wyniosła 63,4% wobec 51,2% w grupie kontrolnej.',
    teza: 'Retencja wyniosła 63,4% wobec 51,2% w grupie kontrolnej.',
    enabled: true,
    imageHint: 'chart',
    zrodla: [{ typ: 'knowledge_doc', id: 'doc-day231-a', etykieta: 'Raport pilotażu Q2' }],
  },
  {
    intent: 'next_steps',
    title: 'Rozszerzenie wymaga bramki kosztowej',
    keyMessage: 'Zarząd powinien zatwierdzić kolejny etap po potwierdzeniu kosztu utrzymania klienta.',
    teza: 'Zarząd powinien zatwierdzić kolejny etap po potwierdzeniu kosztu utrzymania klienta.',
    enabled: true,
    zrodla: [],
  },
];

export default function Day231KonspektZWiedzy(): React.ReactElement {
  const [outline, setOutline] = useState(fixture);
  const intents = outline.map((item) => ({
    id: item.intent,
    label: item.intent.replace(/_/g, ' '),
    description: '',
    icon: '',
  }));

  return (
    <main className="min-h-screen bg-c-bg text-c-text px-10 py-8">
      <div className="mx-auto max-w-5xl rounded-2xl border border-c-border bg-c-surface p-8 shadow-sm">
        <div className="mb-6 border-b border-c-border pb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-c-text-secondary">
            Prezentacje · konspekt z wiedzy organizacji
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-c-text">Treść przed produkcją slajdów</h1>
          <p className="mt-2 max-w-3xl text-sm text-c-text-secondary">
            Każdą tezę można poprawić. Źródła są widoczne przy pozycji; brak źródła pozostaje jawny.
          </p>
        </div>
        <OutlineStep
          outline={outline}
          intents={intents as any}
          onOutlineChange={setOutline}
          onBack={() => undefined}
          onGenerate={() => undefined}
        />
      </div>
    </main>
  );
}
