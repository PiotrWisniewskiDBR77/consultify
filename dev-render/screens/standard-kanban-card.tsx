/**
 * Dev-render host dla JEDNEGO kanonu karty kanban — `StandardKanbanCard` (#75b).
 *
 * Renderuje REALNĄ fasadę `StandardKanban` (natywny HTML5 DnD) z mock-kartami
 * pokazującymi cały kontrakt karty: pilność (brak/pending/critical → pasek
 * akcentu + tint), ciche chipy z tonami (kolor tylko w kropce), chip projektu,
 * termin (zwykły/overdue), awatar/inicjały, footer slot ("następna bramka").
 * Pod spodem — rząd samodzielnych `<StandardKanbanCard>` (wariant z uchwytem
 * dnd-kit + footer), by pokazać reużycie POZA fasadą.
 *
 * Bez logowania, bez store/API — czyste propsy. Motyw/lang z URL (?theme, ?lang).
 */
import { Flag, Layers } from 'lucide-react';
import React from 'react';

import { StandardKanban, StandardKanbanCard } from '../../src/components/standard';
import type {
  StandardKanbanCard as StandardKanbanCardData,
  StandardKanbanColumn,
} from '../../src/components/standard';

const COLUMNS: StandardKanbanColumn[] = [
  { id: 'scheduled', label: 'Zaplanowane', tone: 'info', onCreate: () => {}, createLabel: 'Dodaj' },
  { id: 'executing', label: 'W realizacji', tone: 'accent' },
  { id: 'blocked', label: 'Zablokowane', tone: 'danger' },
  { id: 'done', label: 'Zakończone', tone: 'success' },
];

const nextGate = (label: string, role: string): React.ReactNode => (
  <>
    <div className="text-[10px] text-c-text-muted mb-1 uppercase tracking-wider font-medium">
      Następna bramka
    </div>
    <div className="text-xs text-c-text-secondary font-medium truncate">{label}</div>
    <div className="text-[10px] text-c-text-muted mt-0.5">{role}</div>
  </>
);

const CARDS: StandardKanbanCardData[] = [
  {
    id: 'i1',
    columnId: 'scheduled',
    title: 'Wdrożenie CRM dla zespołu sprzedaży B2B',
    description: 'Migracja z arkuszy do jednego źródła prawdy o lejku.',
    chips: [
      { id: 'p', label: 'MEDIUM', tone: 'info', icon: Flag },
      { id: 'h', label: 'On track', tone: 'success' },
    ],
    projectLabel: 'Digital Sales',
    dueLabel: 'Termin: 30 lip',
    ownerInitials: 'AK',
    ownerName: 'Anna Kowalska',
    urgency: 'none',
    footer: nextGate('Bramka biznesowa (G1)', 'Sponsor biznesowy'),
  },
  {
    id: 'i2',
    columnId: 'executing',
    title: 'Standaryzacja raportów zarządczych KPI',
    description: 'Ujednolicenie 12 dashboardów do jednej triady wskaźników.',
    chips: [
      { id: 'p', label: 'HIGH', tone: 'warning', icon: Flag },
      { id: 'h', label: 'At risk', tone: 'warning' },
      { id: 't', label: 'Ops', tone: 'neutral', icon: Layers },
    ],
    projectLabel: 'FinOps',
    dueLabel: 'Termin: 18 lip',
    ownerInitials: 'PW',
    ownerName: 'Piotr Wiśniewski',
    urgency: 'pending',
  },
  {
    id: 'i3',
    columnId: 'blocked',
    title: 'Integracja płatności — zależność od dostawcy',
    description: 'Blokada: brak sandboxa API po stronie partnera.',
    chips: [
      { id: 'p', label: 'CRITICAL', tone: 'danger', icon: Flag },
      { id: 'h', label: 'Blocked', tone: 'danger' },
    ],
    projectLabel: 'Payments',
    dueLabel: 'Zaległe: 5 lip',
    dueOverdue: true,
    urgency: 'critical',
    footer: nextGate('Eskalacja do komitetu sterującego', 'PMO'),
  },
  {
    id: 'i4',
    columnId: 'done',
    title: 'Onboarding 30 konsultantów do nowego procesu',
    chips: [{ id: 'h', label: 'Done', tone: 'success' }],
    ownerInitials: 'MZ',
    ownerName: 'Marek Zieliński',
    urgency: 'none',
  },
];

export default function StandardKanbanCardScreen(): React.ReactElement {
  const [board, setBoard] = React.useState<StandardKanbanCardData[]>(CARDS);

  return (
    <div className="min-h-screen" style={{ background: 'var(--c-bg)' }}>
      <div className="px-4 pt-4">
        <h1 className="text-lg font-semibold text-c-text">
          #75b — JEDEN kanon karty kanban (StandardKanbanCard)
        </h1>
        <p className="text-xs text-c-text-muted mt-1">
          Fasada StandardKanban (natywny DnD — przeciągnij między kolumnami). Ciche chipy z tonem
          w kropce, pasek pilności ~3px, footer „następna bramka", termin overdue = czerwony.
        </p>
      </div>

      <div className="h-[520px]">
        <StandardKanban
          columns={COLUMNS}
          cards={(colId) => board.filter((c) => c.columnId === colId)}
          onCardClick={(c) => console.log('click', c.id)}
          onDrop={(cardId, colId) =>
            setBoard((prev) =>
              prev.map((c) => (c.id === cardId ? { ...c, columnId: colId } : c))
            )
          }
        />
      </div>

      {/* Reużycie POZA fasadą: samodzielna karta z uchwytem dnd-kit (dragHandleProps). */}
      <div className="px-4 pb-8 pt-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-c-text-secondary mb-2">
          Samodzielny StandardKanbanCard (wariant dnd-kit: widoczny uchwyt)
        </div>
        <div className="w-[280px]">
          <StandardKanbanCard
            card={CARDS[2]}
            dragHandleProps={{ role: 'button', 'aria-label': 'Przeciągnij' }}
            onClick={() => {}}
          />
        </div>
      </div>
    </div>
  );
}
