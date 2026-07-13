/**
 * Dev-render: #83c/#83d — builder DOKUMENT (Word) na wspólnej powłoce.
 * Mock draft z 5 sekcjami; zapis zamockowany (bez backendu).
 */
import React from 'react';

import { TemplateBuilder } from '@/components/TemplateBuilder';
import type { TemplateDraft } from '@/components/TemplateBuilder';

const draft: TemplateDraft = {
  type: 'doc',
  name: 'Raport statusu projektu',
  description: 'Comiesięczny raport statusu dla komitetu sterującego.',
  scope: 'org',
  themeRef: 'brand-dbr77',
  deck: [],
  table: [],
  doc: [
    { id: 'sec-1', title: 'Streszczenie wykonawcze', block: 'paragraph', depth: 'short', hint: '3 kluczowe wnioski + rekomendacja', aiFilled: true },
    { id: 'sec-2', title: 'Postęp vs plan', block: 'kpi', depth: 'medium', hint: 'Pasek KPI: % ukończenia, budżet, ryzyka', aiFilled: true },
    { id: 'sec-3', title: 'Kamienie milowe', block: 'table', depth: 'medium', hint: 'Tabela: kamień · termin · status', aiFilled: true },
    { id: 'sec-4', title: 'Ryzyka i działania', block: 'bullets', depth: 'long', hint: 'Lista RAID z właścicielem', aiFilled: true },
    { id: 'sec-5', title: 'Następne kroki', block: 'paragraph', depth: 'short', hint: '', aiFilled: false },
  ],
};

export default function TemplateBuilderDocScreen(): React.ReactElement {
  return (
    <TemplateBuilder
      initialDraft={draft}
      persistRailState={false}
      saveFn={async (d) => {
        // eslint-disable-next-line no-console
        console.log('[dev-render] saveTemplate', d);
        return { id: 'mock-doc-1' };
      }}
    />
  );
}
