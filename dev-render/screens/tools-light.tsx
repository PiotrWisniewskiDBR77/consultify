/**
 * Mock host for <ToolsLightShell> — the Discovery Tools module light shell.
 *
 * Reuses the REAL component (no re-implementation) and feeds it realistic
 * DBR77 scale-up data shaped like the real hub's catalog/session/output rows
 * (`consultingToolsStandard.ts` lifecycle + `deepeningLadder.ts` 4-rung
 * insight staircase) — same split as `materials-light.tsx` vs
 * `MaterialsLightShell`.
 */
import React from 'react';

import ToolsLightShell, {
  type ToolFrameworkLite,
  type ToolOutputLite,
  type ToolSessionLite,
} from '../../src/components/Discovery/ToolsLightShell';

// 22 frameworks across the 5 real categories (Strategy/Operations/Digital/
// Process Automation/Licensed), mirroring `transformationTools.ts` +
// `src/config/<slug>/` folders (a3problemsolving, ansoff, sopbuilder, swot,
// porter, capabilitymapper, dmsbuilder, smedplanner, valuechain, ...).
const FRAMEWORKS: ToolFrameworkLite[] = [
  { id: 'swot', name: 'SWOT Analysis', category: 'Strategy', author: 'Anna Kowalska', sessionsCount: 6, ladderRungs: 4, status: 'available' },
  { id: 'porter', name: "Porter's 5 Forces", category: 'Strategy', author: 'Anna Kowalska', sessionsCount: 3, ladderRungs: 4, status: 'available' },
  { id: 'ansoff', name: 'Ansoff Matrix', category: 'Strategy', author: 'Piotr Wiśniewski', sessionsCount: 4, ladderRungs: 4, status: 'available' },
  { id: 'bcg', name: 'BCG Matrix', category: 'Strategy', author: 'Piotr Wiśniewski', sessionsCount: 2, ladderRungs: 4, status: 'available' },
  { id: 'scenario_planning', name: 'Scenario Planning', category: 'Strategy', author: 'Marek Zieliński', sessionsCount: 1, ladderRungs: 4, status: 'available' },
  { id: 'business_model_canvas', name: 'Business Model Canvas', category: 'Strategy', author: 'Anna Kowalska', sessionsCount: 5, ladderRungs: 4, status: 'available' },
  { id: 'okr', name: 'OKR Framework', category: 'Strategy', author: 'Piotr Wiśniewski', sessionsCount: 8, ladderRungs: 4, status: 'available' },
  { id: 'a3problemsolving', name: 'A3 Problem Solving', category: 'Operations', author: 'Marek Zieliński', sessionsCount: 9, ladderRungs: 4, status: 'available' },
  { id: 'sopbuilder', name: 'SOP Builder', category: 'Operations', author: 'Marek Zieliński', sessionsCount: 5, ladderRungs: 4, status: 'available' },
  { id: 'vsm', name: 'Value Stream Mapping', category: 'Operations', author: 'Marek Zieliński', sessionsCount: 3, ladderRungs: 4, status: 'available' },
  { id: 'smedplanner', name: 'SMED', category: 'Operations', author: 'Marek Zieliński', sessionsCount: 2, ladderRungs: 4, status: 'available' },
  { id: 'kaizen', name: 'Kaizen Events', category: 'Operations', author: 'Anna Kowalska', sessionsCount: 4, ladderRungs: 4, status: 'available' },
  { id: '5s', name: '5S Methodology', category: 'Operations', author: 'Marek Zieliński', sessionsCount: 1, ladderRungs: 4, status: 'available' },
  { id: 'six_sigma', name: 'Six Sigma DMAIC', category: 'Operations', author: 'Marek Zieliński', sessionsCount: 0, ladderRungs: 4, status: 'coming_soon' },
  { id: 'standardized_work', name: 'Standardized Work', category: 'Operations', author: 'Marek Zieliński', sessionsCount: 2, ladderRungs: 4, status: 'available' },
  { id: 'capabilitymapper', name: 'Capability Mapper', category: 'Digital', author: 'Piotr Wiśniewski', sessionsCount: 3, ladderRungs: 4, status: 'available' },
  { id: 'ai_readiness', name: 'AI/ML Readiness Assessment', category: 'Digital', author: 'Piotr Wiśniewski', sessionsCount: 2, ladderRungs: 4, status: 'available' },
  { id: 'cloud_readiness', name: 'Cloud Readiness Assessment', category: 'Digital', author: 'Piotr Wiśniewski', sessionsCount: 1, ladderRungs: 4, status: 'available' },
  { id: 'digital_twin', name: 'Digital Twin Roadmap', category: 'Digital', author: 'Piotr Wiśniewski', sessionsCount: 0, ladderRungs: 4, status: 'coming_soon' },
  { id: 'processautomation', name: 'Process Mining', category: 'Process Automation', author: 'Marek Zieliński', sessionsCount: 2, ladderRungs: 4, status: 'available' },
  { id: 'rpascanner', name: 'RPA Assessment', category: 'Process Automation', author: 'Marek Zieliński', sessionsCount: 1, ladderRungs: 4, status: 'available' },
  { id: 'dmsbuilder', name: 'Management System Builder', category: 'Licensed', author: 'DBR77', sessionsCount: 3, ladderRungs: 4, status: 'available' },
];

const SESSIONS: ToolSessionLite[] = [
  {
    id: 's1',
    title: 'A3 — przestoje linii pakowania W27',
    frameworkName: 'A3 Problem Solving',
    status: 'deepening',
    ladderDepth: 2,
    owner: 'Marek Zieliński',
    updatedAt: '2026-07-11',
    outputsCount: 1,
    sources: [
      { label: 'Gemba walk', detail: '3 obserwacje, linia 2, zmiana B' },
      { label: 'Dane produkcyjne', detail: 'OEE tygodniowe, ERP export' },
    ],
  },
  {
    id: 's2',
    title: 'SWOT — wejście na segment Manufacturing',
    frameworkName: 'SWOT Analysis',
    status: 'synthesis',
    ladderDepth: 3,
    owner: 'Anna Kowalska',
    updatedAt: '2026-07-10',
    outputsCount: 2,
    sources: [
      { label: 'Wywiady', detail: '6 wywiadów z klientami segmentu' },
      { label: 'Analiza rynku', detail: 'Raport branżowy Q2 2026' },
    ],
  },
  {
    id: 's3',
    title: 'Ansoff — ekspansja produktowa 2027',
    frameworkName: 'Ansoff Matrix',
    status: 'completed',
    ladderDepth: 4,
    owner: 'Piotr Wiśniewski',
    updatedAt: '2026-07-09',
    outputsCount: 3,
    sources: [
      { label: 'Dane finansowe', detail: 'P&L per linia produktowa FY25' },
      { label: 'Ocena DRD', detail: 'Digital Readiness — wynik ogólny' },
      { label: 'Notatki ze strategii', detail: 'Warsztat zarządu 06-2026' },
    ],
  },
  {
    id: 's4',
    title: 'SOP — proces przyjęcia magazynowego',
    frameworkName: 'SOP Builder',
    status: 'in_progress',
    ladderDepth: 1,
    owner: 'Marek Zieliński',
    updatedAt: '2026-07-11',
    outputsCount: 0,
    sources: [{ label: 'Obserwacja procesu', detail: 'Magazyn centralny, 2 zmiany' }],
  },
  {
    id: 's5',
    title: 'Capability Mapper — dojrzałość IT',
    frameworkName: 'Capability Mapper',
    status: 'draft',
    ladderDepth: 0,
    owner: 'Piotr Wiśniewski',
    updatedAt: '2026-07-08',
    outputsCount: 0,
    sources: [],
  },
  {
    id: 's6',
    title: 'BCG — portfel 8 linii produktowych',
    frameworkName: 'BCG Matrix',
    status: 'completed',
    ladderDepth: 4,
    owner: 'Anna Kowalska',
    updatedAt: '2026-07-05',
    outputsCount: 1,
    sources: [
      { label: 'Dane sprzedażowe', detail: 'Udział rynkowy per linia, 24 mies.' },
    ],
  },
];

const OUTPUTS: ToolOutputLite[] = [
  {
    id: 'o1',
    title: 'Inicjatywa: redukcja przestojów linii pakowania',
    outputType: 'initiative',
    sourceSessionTitle: 'A3 — przestoje linii pakowania W27',
    frameworkName: 'A3 Problem Solving',
    status: 'linked',
    owner: 'Marek Zieliński',
    updatedAt: '2026-07-11',
  },
  {
    id: 'o2',
    title: 'Raport SWOT — segment Manufacturing',
    outputType: 'report',
    sourceSessionTitle: 'SWOT — wejście na segment Manufacturing',
    frameworkName: 'SWOT Analysis',
    status: 'generated',
    owner: 'Anna Kowalska',
    updatedAt: '2026-07-10',
  },
  {
    id: 'o3',
    title: 'Prezentacja zarządu — ekspansja produktowa 2027',
    outputType: 'presentation',
    sourceSessionTitle: 'Ansoff — ekspansja produktowa 2027',
    frameworkName: 'Ansoff Matrix',
    status: 'exported',
    owner: 'Piotr Wiśniewski',
    updatedAt: '2026-07-09',
  },
  {
    id: 'o4',
    title: 'Inicjatywa: nowa linia produktowa — segment premium',
    outputType: 'initiative',
    sourceSessionTitle: 'Ansoff — ekspansja produktowa 2027',
    frameworkName: 'Ansoff Matrix',
    status: 'linked',
    owner: 'Piotr Wiśniewski',
    updatedAt: '2026-07-09',
  },
  {
    id: 'o5',
    title: 'Pomysł: automatyzacja przyjęcia magazynowego skanerem',
    outputType: 'idea',
    sourceSessionTitle: 'SOP — proces przyjęcia magazynowego',
    frameworkName: 'SOP Builder',
    status: 'draft',
    owner: 'Marek Zieliński',
    updatedAt: '2026-07-11',
  },
  {
    id: 'o6',
    title: 'Raport portfela — 8 linii produktowych (BCG)',
    outputType: 'report',
    sourceSessionTitle: 'BCG — portfel 8 linii produktowych',
    frameworkName: 'BCG Matrix',
    status: 'exported',
    owner: 'Anna Kowalska',
    updatedAt: '2026-07-05',
  },
];

export function ToolsLightScreen(): React.ReactElement {
  const noop = () => {};
  return (
    <ToolsLightShell
      libraryName="DBR77 Sp. z o.o. — narzędzia doradcze"
      frameworks={FRAMEWORKS}
      sessions={SESSIONS}
      outputs={OUTPUTS}
      lastUpdatedLabel="Zaktualizowano dziś, 11:40 · sesja A3 w toku"
      onNewSession={noop}
      onOpenChat={noop}
      onOpenFramework={noop}
      onOpenSession={noop}
      onOpenOutput={noop}
    />
  );
}

export default ToolsLightScreen;
