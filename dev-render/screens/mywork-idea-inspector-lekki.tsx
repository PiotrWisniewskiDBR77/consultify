/**
 * Dev-render: LEKKI inspektor elementu Idea (DEC-68) — `IdeaElementInspector`
 * po przeprojektowaniu wg `mywork-inspektor-prototyp.html`.
 *
 * Renderuje REALNY komponent produkcyjny, bez mocków API (komponent jest
 * czysto prezentacyjny — dane wchodzą przez propsy). Pokazuje 360px, sekcje
 * accordion, typografię zamiast tabeli właściwości, ciche kontrolki.
 */
import React from 'react';

import {
  IdeaElementInspector,
  type IdeaInspectorElement,
} from '@/components/MyWork/panel/IdeaElementInspector';

const ELEMENT: IdeaInspectorElement = {
  id: 'row-2',
  label: 'Migracja danych: braki i duplikaty',
  state: 'in_progress',
  priority: 70,
  owner: 'Anna Kowalska',
  semanticType: 'Ryzyko',
  branch: 'Wdrożenie ERP (end-to-end)',
  description:
    'Trzy systemy źródłowe (sprzedażowy, magazynowy, finansowy) prowadzą własne kartoteki kontrahentów. Żadna nie jest nadrzędna.',
  context: 'Audyt jakości danych z 8 sierpnia pokazał 12% odrzuceń walidacji na próbce 5 000 rekordów.',
  goal: 'Wspólny klucz klienta (MDM) zatwierdzony przed cutoverem.',
  rationale: 'Bez wspólnego klucza migracja jednorazowa niesie zbyt duże ryzyko utraty danych.',
  risk: 'Zamrożenie zmian w systemach źródłowych może się przesunąć, jeśli zarząd nie zatwierdzi standardu na czas.',
  tags: ['erp', 'dane', 'migracja'],
  evidence: [
    { id: 'e1', title: 'Audyt jakości danych', type: 'Raport', source: 'Zespół danych', date: '08.08' },
    { id: 'e2', title: 'Log duplikatów kontrahentów', type: 'Wyciąg', source: 'CRM', date: '05.08' },
  ],
  relations: [
    { id: 'r1', title: 'Standard klucza klienta (MDM)', type: 'Decyzja', branch: 'ERP' },
    { id: 'r2', title: 'Dry-run migracji na próbce 5%', type: 'Eksperyment', branch: 'ERP' },
  ],
  outputs: [
    { id: 'o1', title: 'Zadanie: zdefiniować standard MDM', type: 'Zadanie', status: 'W trakcie', targetId: 'task-mdm-1' },
  ],
  lineage: 'Rodowód: Tabela pomysłów · wiersz 2 · zmieniono 14:32',
  savedAt: '2026-08-25T14:32:00Z',
};

export default function MyWorkIdeaInspectorLekkiScreen(): React.ReactElement {
  return (
    <div className="flex h-screen w-screen items-stretch justify-end bg-c-bg">
      <div className="flex-1 min-w-0 flex items-center justify-center p-10 text-c-text-muted text-sm">
        (centrum: Tabela pomysłów — patrz ekran „idea-table"; ten harness izoluje wyłącznie inspektor)
      </div>
      <div className="h-full border-l border-c-border-subtle">
        <IdeaElementInspector
          element={ELEMENT}
          tool="table"
          nativeStates={['idea', 'in_progress', 'done', 'blocked']}
          onSave={async (patch) => ({ ...ELEMENT, ...patch })}
          onReturnToCanvas={() => undefined}
        />
      </div>
    </div>
  );
}
