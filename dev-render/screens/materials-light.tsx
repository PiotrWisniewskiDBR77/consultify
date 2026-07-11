/**
 * Mock host for <MaterialsLightShell> — the Materials module light shell.
 *
 * Reuses the REAL component (no re-implementation) and feeds it realistic
 * DBR77 scale-up materials shaped like the real hub's list rows
 * (`ReportsAndPresentations/types.ts`: ReportItem / PresentationItem +
 * sheet rows) — same split as `finance-light.tsx` vs `FinanceLightShell`.
 */
import React from 'react';

import MaterialsLightShell, {
  type MaterialDocumentLite,
  type MaterialPresentationLite,
  type MaterialSheetLite,
} from '../../src/components/ReportsAndPresentations/MaterialsLightShell';

const PRESENTATIONS: MaterialPresentationLite[] = [
  {
    id: 'p1',
    title: 'DBR77 · Steering Committee Q3 2026',
    sourceType: 'tool',
    status: 'ready',
    slideCount: 18,
    owner: 'Piotr Wiśniewski',
    updatedAt: '2026-07-10',
  },
  {
    id: 'p2',
    title: 'Digital Readiness — wyniki diagnozy',
    sourceType: 'assessment',
    status: 'shared',
    slideCount: 24,
    owner: 'Anna Kowalska',
    updatedAt: '2026-07-08',
  },
  {
    id: 'p3',
    title: 'Wycena EV — koszyk 4 metod',
    sourceType: 'finance',
    status: 'editing',
    slideCount: 9,
    owner: 'Marek Zieliński',
    updatedAt: '2026-07-11',
  },
  {
    id: 'p4',
    title: 'Segment Manufacturing — kickoff',
    sourceType: 'tool',
    status: 'generated',
    slideCount: 14,
    owner: 'Piotr Wiśniewski',
    updatedAt: '2026-07-09',
  },
  {
    id: 'p5',
    title: 'Board deck — roczne podsumowanie 2025',
    sourceType: 'upload',
    status: 'archived',
    slideCount: 32,
    owner: 'Anna Kowalska',
    updatedAt: '2026-05-20',
  },
];

const DOCUMENTS: MaterialDocumentLite[] = [
  {
    id: 'd1',
    title: 'Raport tygodniowy — realizacja W28',
    reportType: 'R1',
    status: 'exported',
    owner: 'Marek Zieliński',
    updatedAt: '2026-07-11',
    exportFormats: ['PDF', 'DOCX'],
  },
  {
    id: 'd2',
    title: 'Komitet sterujący — materiał Q3',
    reportType: 'R2',
    status: 'ready',
    owner: 'Piotr Wiśniewski',
    updatedAt: '2026-07-10',
    exportFormats: ['PDF'],
  },
  {
    id: 'd3',
    title: 'Śledzenie korzyści — inicjatywy digitalizacji',
    reportType: 'R3',
    status: 'draft',
    owner: 'Anna Kowalska',
    updatedAt: '2026-07-09',
    exportFormats: [],
  },
  {
    id: 'd4',
    title: 'Przegląd portfela inicjatyw H1 2026',
    reportType: 'R4',
    status: 'exported',
    owner: 'Piotr Wiśniewski',
    updatedAt: '2026-06-30',
    exportFormats: ['PDF', 'PPTX'],
  },
  {
    id: 'd5',
    title: 'Notatka własna — analiza konkurencji',
    reportType: 'custom',
    status: 'archived',
    owner: 'Marek Zieliński',
    updatedAt: '2026-05-14',
    exportFormats: ['DOCX'],
  },
];

const SHEETS: MaterialSheetLite[] = [
  {
    id: 's1',
    title: 'Model finansowy — scenariusz Base case v7',
    status: 'ready',
    rowCount: 340,
    owner: 'Marek Zieliński',
    updatedAt: '2026-07-10',
  },
  {
    id: 's2',
    title: 'Katalog wskaźników — 24 wskaźniki, 5 rodzin',
    status: 'exported',
    rowCount: 24,
    owner: 'Piotr Wiśniewski',
    updatedAt: '2026-07-09',
  },
  {
    id: 's3',
    title: 'Import Excel — DBR77_FY2025_statements',
    status: 'draft',
    rowCount: 1280,
    owner: 'Anna Kowalska',
    updatedAt: '2026-07-11',
  },
];

export function MaterialsLightScreen(): React.ReactElement {
  const noop = () => {};
  return (
    <MaterialsLightShell
      libraryName="DBR77 Sp. z o.o. — biblioteka materiałów"
      presentations={PRESENTATIONS}
      documents={DOCUMENTS}
      sheets={SHEETS}
      lastUpdatedLabel="Zaktualizowano dziś, 11:20 · eksport PDF"
      onNewMaterial={noop}
      onOpenChat={noop}
      onOpenItem={noop}
    />
  );
}

export default MaterialsLightScreen;
