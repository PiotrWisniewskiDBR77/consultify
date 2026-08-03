/**
 * PILNE-9 (2026-07-27) — DOWÓD WZROKOWY: pływające przyciski (rail `?`/komentarz/
 * dokument) vs. kebab ostatniego wiersza tabeli.
 *
 * Odtwarza 1:1 geometrię `src/layouts/MainLayout.tsx`:
 *   - rail: `fixed z-dropdown flex flex-col gap-1 items-end` + pozycja,
 *   - `<main>`: `flex-1 flex flex-col overflow-hidden ...` + rezerwa pasa railu.
 * W środku REALNY `<StandardTable />` (fasada triady) z kebabem w każdym wierszu.
 *
 * URL:
 *   ?screen=fab-rail-kebab            → stan PO naprawie (rail `right-0`, main `md:pr-8`)
 *   ?screen=fab-rail-kebab&fix=off    → stan PRZED (rail `right-4`, brak rezerwy)
 *
 * Dolny pasek odtwarza stopkę podglądu (`PreviewActionBar` z `overflowActions`)
 * przyklejoną do dolnej krawędzi — miejsce, w którym menu spod „…" ucinało
 * pozycję „Delegate", zanim dostało odbicie w górę.
 */
import { Bell, TrendingUp, UserPlus } from 'lucide-react';
import React from 'react';

import { DocumentToggleButton } from '../../src/components/documents/DocumentToggleButton';
import { FeedbackToggleButton } from '../../src/components/Feedback/FeedbackToggleButton';
import { HelpToggleButton } from '../../src/components/Help/HelpToggleButton';
import { PreviewActionBar } from '../../src/components/shared/PreviewPane/PreviewActionBar';
import type { TableColumn, TableRow } from '../../src/components/standard/StandardTable';
import { StandardTable } from '../../src/components/standard/StandardTable';

const COLUMNS: TableColumn[] = [
  { id: 'title', label: 'Nazwa', type: 'text', width: '40%' },
  { id: 'owner', label: 'Właściciel', type: 'text' },
  { id: 'status', label: 'Status', type: 'text' },
  { id: 'updated', label: 'Aktualizacja', type: 'text' },
];

const ROWS: TableRow[] = Array.from({ length: 14 }, (_, i) => ({
  id: `row-${i + 1}`,
  title: `Ocena gotowości — obszar ${i + 1}`,
  owner: i % 2 === 0 ? 'Piotr Wiśniewski' : 'Anna Kowalska',
  status: i % 3 === 0 ? 'W toku' : 'Do zrobienia',
  updated: `2026-07-${String(10 + i).padStart(2, '0')}`,
}));

const FabRailKebabScreen: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const fixOff = params.get('fix') === 'off';

  // PRZED: rail na `right-4` nad treścią, main bez rezerwy.
  // PO:    rail dosunięty do krawędzi (`right-0`), main rezerwuje `md:pr-8`.
  const railPosition = fixOff ? 'right-4 top-[70%]' : 'right-0 top-[70%]';
  const mainReserve = fixOff ? '' : 'md:pr-8';

  return (
    <div className="flex h-screen w-full bg-c-bg text-c-text font-sans overflow-hidden">
      <div
        data-testid="global-fab-rail"
        className={`fixed z-dropdown flex flex-col gap-1 items-end pointer-events-none ${railPosition}`}
      >
        <div className="pointer-events-auto">
          <HelpToggleButton />
        </div>
        <div className="pointer-events-auto">
          <FeedbackToggleButton />
        </div>
        <div className="pointer-events-auto">
          <DocumentToggleButton />
        </div>
      </div>

      <main
        className={`flex-1 flex flex-col overflow-hidden relative min-w-0 h-full min-h-0 ${mainReserve}`}
      >
        <div className="h-12 shrink-0 border-b border-c-border-subtle flex items-center px-3 text-sm text-c-text-secondary">
          {fixOff
            ? 'PRZED naprawą — rail na right-4 nad tabelą'
            : 'PO naprawie — rail we własnym pasie'}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <StandardTable
            columns={COLUMNS}
            data={ROWS}
            persistKey="dev-render.fab-rail-kebab"
            rowMenu={() => ({
              primary: [{ id: 'open', label: 'Otwórz', onClick: () => undefined }],
              statusTransitions: [
                { id: 'todo', label: 'Do zrobienia', onClick: () => undefined },
                { id: 'in-progress', label: 'W toku', onClick: () => undefined },
              ],
              universalHandlers: { preview: () => undefined, edit: () => undefined },
              destructive: { onClick: () => undefined },
            })}
          />
        </div>
        {/* Szerokość ograniczona, żeby trigger „…" nie chował się pod przyciskami
            panelu odbioru harnessu (prawy dolny róg) — w aplikacji stopka podglądu
            ma szerokość panelu, tu odtwarzamy tę samą sytuację przy dolnej krawędzi. */}
        <div className="shrink-0 border-t border-c-border-subtle px-3 py-2 bg-c-surface max-w-[560px]">
          <PreviewActionBar
            rows={[
              {
                buttons: [
                  {
                    label: 'Zatwierdź',
                    onClick: () => undefined,
                    colorScheme: 'emerald',
                    flex: true,
                  },
                  { label: 'Odrzuć', onClick: () => undefined, colorScheme: 'neutral', flex: true },
                ],
              },
            ]}
            overflowLabel="Więcej akcji"
            overflowActions={[
              {
                label: 'Delegate',
                icon: UserPlus,
                onClick: () => undefined,
                colorScheme: 'neutral',
              },
              { label: 'Remind', icon: Bell, onClick: () => undefined, colorScheme: 'neutral' },
              {
                label: 'Escalate',
                icon: TrendingUp,
                onClick: () => undefined,
                colorScheme: 'amber',
              },
            ]}
          />
        </div>
      </main>
    </div>
  );
};

export default FabRailKebabScreen;
