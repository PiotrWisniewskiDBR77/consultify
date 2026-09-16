/**
 * PMO-1 (U-35) — MAKIETA (a): Initiatives · kolejki PMO w Menu 3.
 *
 * PO CO: właściciel (przejście 15.09, U-35) — „Do akceptacji cały system
 * zarządzania statusami: do przeglądu, do omówienia, do akceptacji — kto, jak,
 * kiedy, za co odpowiada". Dzisiejsza lista Inicjatyw pokazuje Owner „—",
 * Next gate „Definition" i Next action „Complete the definition" dla WSZYSTKICH
 * 8 szkiców naraz — nie ma ani kolejki, ani osoby, ani terminu.
 *
 * CO TO JEST: makieta DESIGNU na REALNEJ POWŁOCE — ten sam `StandardModuleBar`
 * (Menu 1 breadcrumbs + Menu 2 pigułki/CTA + Menu 3 chipy) i ten sam
 * `StandardTable`, których używa produkcyjny `InitiativesHub`. Zmienia się
 * WYŁĄCZNIE deklarowana treść: pięć kolejek w Menu 3 (To review · To discuss ·
 * To approve · Blocked · Overdue) i cztery kolumny governance
 * (Stage · Responsible · Due · Next step) zamiast dzisiejszych Next gate /
 * Next action bez właściciela.
 *
 * CZEGO TU NIE MA: zero kodu produkcyjnego, zero zmian w `InitiativesHub`,
 * zero backendu. To obraz do akceptu właściciela przed napisaniem kodu
 * (CLAUDE.md #7 — Piotr nigdy nie jest pierwszym testerem wizualnym).
 *
 * URL: ?screen=pmo1-kolejki&lang=en&theme=light  (DEC-461: EN najpierw)
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { StandardModuleBar } from '../../src/components/standard/StandardModuleBar';
import { StandardTable } from '../../src/components/standard/StandardTable';
import type { StandardTableColumn } from '../../src/components/standard/StandardTable';

const COLUMNS: StandardTableColumn[] = [
  { id: 'title', label: 'Initiative', dataType: 'text', primary: true, width: '300px' },
  { id: 'stage', label: 'Stage', dataType: 'status', width: '170px' },
  { id: 'responsible', label: 'Responsible', dataType: 'owner', width: '190px' },
  { id: 'due', label: 'Due', dataType: 'date', width: '120px' },
  { id: 'nextStep', label: 'Next step', dataType: 'text', width: '260px' },
] as StandardTableColumn[];

/** Kolejka „To review" — sześć inicjatyw czekających na przegląd PMO. */
const ROWS = [
  {
    id: 'i1',
    title: 'Resolve Warehouse Cutover Date Discrepancy',
    stage: '4 · Ready for decision',
    responsible: 'Irina Dubois · PMO',
    due: '18 Sep 2026',
    nextStep: 'Review evidence pack, then hand to sponsor',
  },
  {
    id: 'i2',
    title: 'Line 3 MES rollout — scope confirmation',
    stage: '3 · Analyzing',
    responsible: 'James Whitfield · Owner',
    due: '19 Sep 2026',
    nextStep: 'Attach value case and risk profile',
  },
  {
    id: 'i3',
    title: 'Predictive maintenance pilot (Wakefield)',
    stage: '4 · Ready for decision',
    responsible: 'Irina Dubois · PMO',
    due: '17 Sep 2026',
    nextStep: 'Confirm KPI baseline with Results',
  },
  {
    id: 'i4',
    title: 'Supplier quality scorecard rollout',
    stage: '2 · Defined',
    responsible: 'Evelyn Stone · Owner',
    due: '22 Sep 2026',
    nextStep: 'Complete success criteria, then request analysis',
  },
  {
    id: 'i5',
    title: 'Shuttle safety case with the works council',
    stage: '3 · Analyzing',
    responsible: 'James Whitfield · Consultant',
    due: '24 Sep 2026',
    nextStep: 'Close two open dependencies',
  },
  {
    id: 'i6',
    title: 'Energy intensity reduction — Plant 2',
    stage: '4 · Ready for decision',
    responsible: 'Irina Dubois · PMO',
    due: '25 Sep 2026',
    nextStep: 'Schedule steering committee slot',
  },
];

export default function Pmo1KolejkiScreen(): React.ReactElement {
  const [chip, setChip] = React.useState<string>('review');

  return (
    <MemoryRouter>
      <div
        style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}
        className="bg-c-bg"
      >
        <StandardModuleBar
          breadcrumbs={[{ label: 'Initiatives' }]}
          tabs={[
            { id: 'list', label: 'Initiatives' },
            { id: 'plan', label: 'Plan' },
            { id: 'capacity', label: 'Load' },
          ]}
          activeTab="list"
          onTabChange={() => {}}
          onSearch={() => {}}
          primaryCta={{ label: 'New initiative', onClick: () => {} }}
          chips={[
            { id: 'review', label: 'To review', count: 6 },
            { id: 'discuss', label: 'To discuss', count: 3 },
            { id: 'approve', label: 'To approve', count: 4 },
            { id: 'blocked', label: 'Blocked', count: 2 },
            { id: 'overdue', label: 'Overdue', count: 5 },
            { id: 'all', label: 'All', count: 63 },
          ]}
          activeChip={chip}
          onChipChange={setChip}
        />
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }} className="px-6 py-4">
          <StandardTable columns={COLUMNS} data={ROWS} onRowClick={() => {}} />
        </div>
      </div>
    </MemoryRouter>
  );
}
