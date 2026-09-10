/**
 * P12 — dowód naprawy: angielski napis w pustym stanie StandardTable/
 * FilterableTable, gdy filtr Menu 3 (chip) zwęża wyniki do zera.
 *
 * Zmierzone 2026-09-10 na Outputach zbiorczych (ReportsAndPresentations/
 * OutputsAggregateTabContent.tsx): moduł podaje `empty={{title:'Brak
 * outputów'}}` ale NIE podaje osobnego `emptyMessage`. Dopóki filtr
 * (`activeFilters`) jest pusty, StandardTable pokazuje branded `EmptyState`
 * z `empty.title` (poprawnie przetłumaczone). Gdy jednak filtr jest AKTYWNY
 * i wynik pusty, gałąź brandowana wymaga `filters.length === 0` — więc
 * omija ją i ląduje w `emptyMessage` (tu: nigdy nie podane -> `undefined`),
 * co w `FilterableTable` miało twardo wpisany angielski default
 * `'No items found'` prosto w wartości domyślnej parametru.
 *
 * Ten ekran montuje REALNY `<StandardTable>` z tym samym kształtem propsów:
 * `data=[]`, `activeFilters` z jednym czipem (jak po kliknięciu Menu 3 →
 * "Dokument" → zero trafień), `empty.title` po polsku, bez `emptyMessage`.
 *
 * URL: ?screen=p12-tabela-i18n-menu3-empty&lang=pl|en&theme=light|dark
 */
import { FileText } from 'lucide-react';
import React from 'react';

import { StandardTable, type TableColumn } from '@/components/standard';

const columns: TableColumn[] = [
  { id: 'name', label: 'Nazwa' },
  { id: 'kind', label: 'Rodzaj' },
  { id: 'owner', label: 'Właściciel' },
];

export default function P12TabelaI18nMenu3EmptyScreen(): React.ReactElement {
  const [filters, setFilters] = React.useState([
    { id: 'kind-document', column: 'kind', value: 'document', label: 'Dokument' },
  ]);

  return (
    <div className="h-screen w-full overflow-auto bg-c-bg p-6">
      <div className="mx-auto max-w-5xl rounded-xl border border-c-border bg-c-surface overflow-hidden">
        <StandardTable
          columns={columns}
          data={[]}
          activeFilters={filters}
          onFilterChange={setFilters}
          empty={{
            icon: FileText,
            title: 'Brak outputów',
            description: 'Wygeneruj raporty lub prezentacje z sesji.',
          }}
          persistKey="dev-render.p12.outputs-empty-menu3"
        />
      </div>
    </div>
  );
}
