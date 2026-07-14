/**
 * Dev-render: #83c/#83d — builder ARKUSZ (Excel) na wspólnej powłoce.
 * Centrum = edytor kolumny; lista = kolumny schematu.
 */
import React from 'react';

import type { TemplateDraft } from '@/components/TemplateBuilder';
import { TemplateBuilder } from '@/components/TemplateBuilder';

const draft: TemplateDraft = {
  type: 'table',
  name: 'Model kosztów wdrożenia',
  description: 'Schemat arkusza do szacowania kosztów i marży wdrożenia.',
  scope: 'private',
  themeRef: null,
  doc: [],
  deck: [],
  table: [
    { id: 'col-1', name: 'Pozycja', type: 'text', formula: '' },
    { id: 'col-2', name: 'Ilość', type: 'number', formula: '' },
    { id: 'col-3', name: 'Cena jedn.', type: 'currency', formula: '' },
    { id: 'col-4', name: 'Wartość', type: 'formula', formula: '=B*C' },
    { id: 'col-5', name: 'Marża %', type: 'percent', formula: '' },
    { id: 'col-6', name: 'Termin', type: 'date', formula: '' },
  ],
};

export default function TemplateBuilderTableScreen(): React.ReactElement {
  return (
    <TemplateBuilder
      initialDraft={draft}
      persistRailState={false}
      saveFn={async (d) => {
        // eslint-disable-next-line no-console
        console.log('[dev-render] saveTemplate', d);
        return { id: 'mock-table-1' };
      }}
    />
  );
}
