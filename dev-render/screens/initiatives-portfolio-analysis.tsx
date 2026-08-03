/**
 * Dev-render: Inicjatywy → analiza portfela (2026-07-23).
 *
 * Montuje REALNY `PortfolioAnalysisView` (ten sam komponent, do którego prowadzi
 * ścieżka produkcyjna AppRoutes → InitiativesHub → „Analiza portfela") z danymi
 * mock, żeby MOŻNA BYŁO OBEJRZEĆ na własne oczy efekt wycięcia pięciu atrap AI —
 * bez logowania, backendu i bazy (CLAUDE.md #7).
 *
 * Parametry URL:
 *   &sub=resources|feasibility|logic|timeline|completeness   który podwidok
 *   &ai=ok|fail|empty   zachowanie mocka `/ai/generate` (tylko podwidok „logic")
 *       ok    — model zwraca propozycje (w tym jedną ze ZMYŚLONYM id i jeden
 *               duplikat istniejącej pary — mają zostać odrzucone przez walidację)
 *       fail  — 503 NO_LLM_PROVIDER: sprawdzamy, że widać UCZCIWY powód,
 *               panel się NIE otwiera, a zależności zostają nietknięte
 *       empty — model nie znalazł nic: pusty stan, nie błąd
 *   &theme=light|dark, &lang=pl|en   obsługiwane przez main.tsx harnessu
 */
import React, { useEffect, useMemo, useState } from 'react';

import type { PortfolioInitiative } from '@/types';

import {
  type AiMockMode,
  callLog,
  installPortfolioAnalysisApiMock,
} from '../mocks/portfolioAnalysisMocks';

const PortfolioAnalysisView = React.lazy(() =>
  import('@/components/Initiatives/Analysis/PortfolioAnalysisView').then((m) => ({
    default: m.PortfolioAnalysisView,
  }))
);

const USERS = [
  { id: 'u-1', firstName: 'Anna', lastName: 'Kowalska', email: 'anna@example.com' },
  { id: 'u-2', firstName: 'Marek', lastName: 'Nowak', email: 'marek@example.com' },
  { id: 'u-3', firstName: 'Ewa', lastName: 'Zielińska', email: 'ewa@example.com' },
  { id: 'u-4', firstName: 'Tomasz', lastName: 'Wójcik', email: 'tomasz@example.com' },
];

const NOW = '2026-07-01T00:00:00.000Z';

/**
 * Portfel dobrany tak, żeby KAŻDY z pięciu przycisków miał co pokazać:
 *  · Anna jest właścicielem 4 inicjatyw → przeciążenie (Zasoby)
 *  · init-4 i init-5 nie mają budżetu / dat / właściciela → braki (Wykonalność, Kompletność)
 *  · init-4 i init-5 bez dat → jest co proponować (Harmonogram)
 *  · nazwy i opisy niosą realną kolejność wykonania → jest co wnioskować (Logika)
 */
const INITIATIVES: PortfolioInitiative[] = [
  {
    id: 'init-1',
    name: 'Pulpit zarządczy KPI',
    description:
      'Jeden pulpit z metrykami zarządu, zasilany danymi z hurtowni. Zastępuje ręczne arkusze.',
    axis: 'data',
    status: 'IN_PROGRESS' as PortfolioInitiative['status'],
    priority: 'HIGH',
    progress: 35,
    budget: 240000,
    plannedStartDate: '2026-03-01',
    plannedEndDate: '2026-09-30',
    ownerBusiness: { id: 'u-1', firstName: 'Anna', lastName: 'Kowalska' },
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'init-2',
    name: 'Migracja ERP do chmury',
    description: 'Przeniesienie ERP na infrastrukturę chmurową wraz z odtworzeniem integracji.',
    axis: 'infra',
    status: 'IN_PROGRESS' as PortfolioInitiative['status'],
    priority: 'CRITICAL',
    progress: 20,
    budget: 1800000,
    plannedStartDate: '2026-01-15',
    plannedEndDate: '2026-08-31',
    ownerBusiness: { id: 'u-1', firstName: 'Anna', lastName: 'Kowalska' },
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'init-3',
    name: 'Hurtownia danych — warstwa źródłowa',
    description:
      'Zbudowanie warstwy źródłowej hurtowni: ładowanie z ERP i CRM, słowniki, jakość danych.',
    axis: 'data',
    status: 'IN_PROGRESS' as PortfolioInitiative['status'],
    priority: 'CRITICAL',
    progress: 55,
    budget: 620000,
    plannedStartDate: '2026-02-01',
    plannedEndDate: '2026-06-30',
    ownerBusiness: { id: 'u-1', firstName: 'Anna', lastName: 'Kowalska' },
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'init-4',
    name: 'Automatyzacja raportowania regulacyjnego',
    description: 'Automatyczne generowanie raportów regulacyjnych zamiast obiegu arkuszy.',
    axis: 'ops',
    status: 'PLANNED' as PortfolioInitiative['status'],
    priority: 'MEDIUM',
    progress: 0,
    budget: 0, // brak budżetu → czerwony wymiar + podpowiedź w Kompletności
    ownerBusiness: { id: 'u-1', firstName: 'Anna', lastName: 'Kowalska' },
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'init-5',
    name: 'Przegląd kwartalny zarządu',
    description: 'Cykliczny przegląd wyników: pakiet materiałów, kalendarz, właściciele tematów.',
    axis: 'strategy',
    status: 'PLANNED' as PortfolioInitiative['status'],
    priority: 'LOW',
    progress: 0,
    budget: 0,
    // brak właściciela i brak dat → jest co uzupełniać i co planować
    createdAt: NOW,
    updatedAt: NOW,
  },
];

const SUBVIEWS = ['resources', 'feasibility', 'logic', 'timeline', 'completeness'] as const;
type Subview = (typeof SUBVIEWS)[number];

export default function InitiativesPortfolioAnalysisScreen(): React.ReactElement {
  const params = new URLSearchParams(window.location.search);
  const urlSub = params.get('sub') as Subview | null;
  const aiMode = (params.get('ai') as AiMockMode) || 'ok';

  const [subview, setSubview] = useState<Subview>(
    urlSub && SUBVIEWS.includes(urlSub) ? urlSub : 'resources'
  );
  const [actions, setActions] = useState<React.ReactNode>(null);
  const [ready, setReady] = useState(false);
  const [, forceLog] = useState(0);

  const aiModeRef = useMemo(() => ({ current: aiMode }), [aiMode]);

  useEffect(() => {
    const dispose = installPortfolioAnalysisApiMock(() => aiModeRef.current);
    setReady(true);
    return dispose;
  }, [aiModeRef]);

  useEffect(() => {
    const id = window.setInterval(() => forceLog((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, []);

  if (!ready) return <div className="h-screen w-screen bg-c-bg" />;

  return (
    <div className="flex h-screen w-screen flex-col bg-c-bg">
      {/* Pasek harnessu — NIE jest częścią produktu, służy tylko nawigacji po podwidokach
          i pokazaniu, czy poszło realne żądanie sieciowe. */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-2 dark:border-navy-700 dark:bg-navy-900">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            harness · podwidok
          </span>
          {SUBVIEWS.map((s) => (
            <button
              key={s}
              onClick={() => setSubview(s)}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                subview === s
                  ? 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300'
                  : 'border-slate-300 bg-slate-100 text-slate-700 dark:border-navy-700/60 dark:bg-navy-800 dark:text-slate-300'
              }`}
            >
              {s}
            </button>
          ))}
          <span className="ml-2 rounded-full border border-slate-300 px-2 py-0.5 text-[11px] text-slate-600 dark:border-navy-700 dark:text-slate-400">
            ai={aiMode}
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            wywołania: {callLog.entries.filter((e) => e.includes('/ai/generate')).length}×
            /ai/generate
          </span>
        </div>
      </div>

      {/* Menu 3 — tu ląduje pasek akcji zarejestrowany przez podwidok. To jest miejsce,
          w którym widać pięć przycisków będących przedmiotem naprawy. */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-2 dark:border-navy-700 dark:bg-navy-900">
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>

      <div className="min-h-0 flex-1">
        <React.Suspense
          fallback={<div className="p-8 text-sm text-slate-500">Ładowanie ekranu…</div>}
        >
          <PortfolioAnalysisView
            initiatives={INITIATIVES}
            onOpenInitiative={() => undefined}
            onQuickUpdate={async () => undefined}
            users={USERS}
            subview={subview}
            onRegisterActions={setActions}
          />
        </React.Suspense>
      </div>
    </div>
  );
}
