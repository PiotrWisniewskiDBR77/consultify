/**
 * Dev-render: #83c/#83d — builder PREZENTACJA (Deck) na wspólnej powłoce.
 * Ten sam szkielet co Doc; zmienia się TYLKO centrum (edytor slajdu).
 */
import React from 'react';

import { TemplateBuilder } from '@/components/TemplateBuilder';
import type { TemplateDraft } from '@/components/TemplateBuilder';

const draft: TemplateDraft = {
  type: 'deck',
  name: 'Prezentacja zarządu — kwartalna',
  description: 'Standardowy układ prezentacji wyników kwartalnych.',
  scope: 'org',
  themeRef: 'brand-navy',
  doc: [],
  table: [],
  deck: [
    { id: 'slide-1', title: 'Wyniki Q3 2026', archetype: 'cover', hint: 'Tytuł + data + logo', aiFilled: false },
    { id: 'slide-2', title: 'Agenda', archetype: 'agenda', hint: '5 punktów spotkania', aiFilled: true },
    { id: 'slide-3', title: 'Najważniejsze liczby', archetype: 'kpi', hint: 'Przychód, marża, NPS', aiFilled: true },
    { id: 'slide-4', title: 'Trend przychodów', archetype: 'chart', hint: 'Wykres słupkowy 4 kwartały', aiFilled: true },
    { id: 'slide-5', title: 'Ryzyka vs szanse', archetype: 'two-column', hint: 'Lewa: ryzyka, prawa: szanse', aiFilled: true },
    { id: 'slide-6', title: 'Dziękujemy', archetype: 'closing', hint: 'Kontakt + Q&A', aiFilled: false },
  ],
};

export default function TemplateBuilderDeckScreen(): React.ReactElement {
  return (
    <TemplateBuilder
      initialDraft={draft}
      persistRailState={false}
      saveFn={async (d) => {
        // eslint-disable-next-line no-console
        console.log('[dev-render] saveTemplate', d);
        return { id: 'mock-deck-1' };
      }}
    />
  );
}
