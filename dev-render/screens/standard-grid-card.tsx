/**
 * Dev-render host dla JEDNEGO kanonu karty grid/kafelkowej — `StandardGridCard` (#76a).
 *
 * Siatka 4 kafli pokazujących cały kontrakt karty:
 *  1. Portfolio initiative — status info + akcent osi (c-tag), metryki
 *     budżet/ROI, pasek postępu, awatar właściciela, BEZ kebaba (klik→preview).
 *  2. ModuleHub report — status success + akcent typu (c-tag), kebab
 *     Open/Duplicate/Edit/Delete (RowActionsMenu — ten sam dropdown co
 *     StandardTable), footerRight = "3 dni temu".
 *  3. Initiative BLOCKED — pilność critical (pasek czerwony + tint tła),
 *     wygrywa nad akcentem kategorii.
 *  4. Deck z customFooterActions (Export/Otwórz źródło) — pilność pending
 *     (pasek bursztynowy).
 *
 * Bez logowania, bez store/API — czyste propsy. Motyw/lang z URL (?theme, ?lang).
 */
import { Calendar, DollarSign, Download, ExternalLink, TrendingUp } from 'lucide-react';
import React from 'react';

import type { StandardGridCard as StandardGridCardData } from '../../src/components/standard';
import { StandardGridCard } from '../../src/components/standard';

const CARDS: StandardGridCardData[] = [
  {
    id: 'p1',
    title: 'Wdrożenie CRM dla zespołu sprzedaży B2B',
    subtitle: 'Digital Sales',
    statusLabel: 'EXECUTING',
    statusTone: 'info',
    accentColorVar: 'var(--c-tag-2)',
    chips: [{ id: 'priority', label: 'HIGH', tone: 'warning' }],
    progress: 62,
    metrics: [
      { id: 'budget', icon: DollarSign, label: '$420K' },
      { id: 'roi', icon: TrendingUp, label: '2.3x ROI', tone: 'success' },
      { id: 'quarter', icon: Calendar, label: 'Q3 2026' },
    ],
    ownerInitials: 'AK',
    ownerName: 'Anna Kowalska',
  },
  {
    id: 'r2',
    title: 'Raport due diligence — akwizycja SIRI',
    description: 'Ocena dojrzałości cyfrowej 4 zakładów produkcyjnych.',
    statusLabel: 'Approved',
    statusTone: 'success',
    accentColorVar: 'var(--c-tag-1)',
    chips: [{ id: 'type', label: 'SIRI' }],
    progress: 100,
    footerRight: '3 dni temu',
    rowMenuActions: [
      { id: 'open', label: 'Otwórz', onClick: () => console.log('open') },
      { id: 'duplicate', label: 'Duplikuj', onClick: () => console.log('duplicate') },
      { id: 'rename', label: 'Edytuj', onClick: () => console.log('rename'), divider: true },
      { id: 'delete', label: 'Usuń', onClick: () => console.log('delete'), variant: 'danger' },
    ],
  },
  {
    id: 'p3',
    title: 'Integracja płatności — zależność od dostawcy',
    subtitle: 'Payments',
    statusLabel: 'BLOCKED',
    statusTone: 'danger',
    accentColorVar: 'var(--c-tag-4)',
    urgency: 'critical',
    chips: [{ id: 'priority', label: 'CRITICAL', tone: 'danger' }],
    progress: 18,
    metrics: [{ id: 'budget', icon: DollarSign, label: '$1.1M' }],
    ownerInitials: 'PW',
    ownerName: 'Piotr Wiśniewski',
  },
  {
    id: 'd4',
    title: 'Deck: Strategia AI 2027-2030 — Zarząd',
    statusLabel: 'Draft',
    statusTone: 'neutral',
    accentColorVar: 'var(--c-tag-9)',
    urgency: 'pending',
    chips: [{ id: 'type', label: 'Deck' }],
    progress: 40,
    footerRight: '5 h temu',
    customFooterActions: (
      <div className="flex items-center gap-1">
        <button
          className="p-1 rounded hover:bg-c-surface-raised text-c-text-muted hover:text-c-text transition-colors"
          title="Export"
          onClick={() => console.log('export')}
        >
          <Download size={12} />
        </button>
        <button
          className="p-1 rounded hover:bg-c-surface-raised text-c-text-muted hover:text-c-text transition-colors"
          title="Otwórz źródło"
          onClick={() => console.log('open source')}
        >
          <ExternalLink size={12} />
        </button>
      </div>
    ),
  },
];

export default function StandardGridCardScreen(): React.ReactElement {
  return (
    <div className="min-h-screen" style={{ background: 'var(--c-bg)' }}>
      <div className="px-4 pt-4">
        <h1 className="text-lg font-semibold text-c-text">
          #76a — JEDEN kanon karty grid/kafelkowej (StandardGridCard)
        </h1>
        <p className="text-xs text-c-text-muted mt-1">
          4 warianty: portfolio initiative (bez kebaba), hub report (kebab RowActionsMenu), pilność
          critical (pasek czerwony wygrywa nad akcentem kategorii), deck z customFooterActions
          (Export/Otwórz źródło). Akcent kategorii WYŁĄCZNIE z palety --c-tag-1..10, zero
          primary/crimson.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
        {CARDS.map((card) => (
          <StandardGridCard
            key={card.id}
            card={card}
            onClick={() => console.log('click', card.id)}
          />
        ))}
      </div>
    </div>
  );
}
