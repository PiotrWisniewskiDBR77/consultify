/**
 * FALA B — harness odbiorowy Banku Realizacji (H2 + B-E0).
 *
 * CLAUDE.md reguła #7: właściciel NIGDY nie jest pierwszym testerem wizualnym.
 * Ten ekran renderuje PRODUKCYJNE komponenty — `ExecutionBankViews` (a w nim
 * realny `StandardTable`) i `StandardPreview` na deklaracji zbudowanej realnym
 * `buildExecutionBankPreviewDeclaration` — na danych mock. Nie jest to KOPIA
 * wyglądu: gdyby kolumna albo pastylka była zepsuta, zepsuje się TUTAJ.
 *
 * `ExecutionHub` nie da się zamontować bez kilkunastu dostawców kontekstu —
 * dlatego harness montuje warstwę tuż pod nim, dokładnie tę, która maluje
 * tabelę i podgląd (ta sama granica, dla której powstał osobny plik
 * `executionBankPreviewDeclaration.tsx`).
 *
 * URL:
 *   ?theme=dark        ciemny motyw (klasa `.dark`, tak jak w aplikacji)
 *   ?risk=off          symuluje flagę `VITE_EXEC_RISK_SIGNAL` WYŁĄCZONĄ
 *                      (brak `riskSignals` ⇒ kolumna „Risk" nie powstaje) —
 *                      to jest zrzut PARYTETU z linią
 *   ?view=preview      pokazuje podgląd wiersza zamiast tabeli
 */
import React from 'react';

import { StandardPreview } from '@/components/standard';

import { buildExecutionBankRows } from '../../src/components/Execution/executionBankModel';
import { buildExecutionBankPreviewDeclaration } from '../../src/components/Execution/executionBankPreviewDeclaration';
import { ExecutionBankViews } from '../../src/components/Execution/ExecutionBankViews';
import { buildExecutionRiskSignalMap } from '../../src/components/Execution/executionRiskSignal';

const ASOF = '2026-09-14T00:00:00.000Z';

/** i18n zastępcze — harness nie ładuje i18next, a klucze mają angielskie domyślne. */
const t = (_key: string, defaultValue: string, vars?: Record<string, string | number>) =>
  defaultValue.replace(/\{\{(\w+)\}\}/g, (_m, name) => String(vars?.[name] ?? `{{${name}}}`));

const initiatives = [
  {
    id: 'ini-1',
    name: 'ERP rollout — phase 2 (finance close)',
    description: 'Consolidate month-end close across three legal entities.',
    lifecycleStatus: 'IN_EXECUTION',
    ownerId: 'u-1',
    ownerName: 'Katarzyna Wójcik',
    progress: 62,
    baselineStartDate: '2026-04-01',
    baselineEndDate: '2026-10-31',
    currentPlanStartDate: '2026-04-01',
    currentPlanEndDate: '2026-11-15',
    updatedAt: '2026-09-12T09:30:00.000Z',
  },
  {
    id: 'ini-2',
    name: 'Warehouse automation pilot',
    description: 'Pilot two automated picking lanes before the peak season.',
    lifecycleStatus: 'IN_EXECUTION',
    ownerId: 'u-2',
    ownerName: 'Tomasz Nowak',
    progress: 28,
    baselineStartDate: '2026-05-01',
    baselineEndDate: '2026-09-30',
    currentPlanStartDate: '2026-05-01',
    currentPlanEndDate: '2026-12-20',
    updatedAt: '2026-09-11T14:05:00.000Z',
  },
  {
    id: 'ini-3',
    name: 'Supplier consolidation wave 1',
    description: 'Reduce the tail of one-off suppliers by 40%.',
    lifecycleStatus: 'IN_EXECUTION',
    ownerId: 'u-3',
    ownerName: 'Irina Kowal',
    progress: 45,
    baselineStartDate: '2026-03-01',
    baselineEndDate: '2026-09-15',
    currentPlanStartDate: '2026-03-01',
    currentPlanEndDate: '2026-09-15',
    updatedAt: '2026-09-13T07:45:00.000Z',
  },
  {
    id: 'ini-4',
    name: 'Customer service knowledge base',
    description: 'One searchable answer set for the first line.',
    lifecycleStatus: 'APPROVED',
    ownerId: 'u-4',
    ownerName: 'Justyna Lis',
    progress: 5,
    updatedAt: '2026-09-09T11:20:00.000Z',
  },
] as const;

const executionCases = [
  {
    executionCaseId: 'case-1',
    initiativeId: 'ini-1',
    version: 7,
    state: 'ACTIVE',
    executionPhase: 'Build',
    executionManagerId: 'u-1',
    handoffPackageId: 'pkg-erp-2',
    handoffPackageVersion: 3,
    acceptedAt: '2026-04-02T08:00:00.000Z',
    updatedAt: '2026-09-12T09:30:00.000Z',
  },
  {
    executionCaseId: 'case-2',
    initiativeId: 'ini-2',
    version: 2,
    state: 'ACTIVE',
    executionPhase: 'Pilot',
    executionManagerId: 'u-2',
    // Paczka wskazana, ale bez daty przyjęcia — stan „ślad niepełny".
    handoffPackageId: 'pkg-wh-1',
    handoffPackageVersion: 1,
    acceptedAt: null,
    updatedAt: '2026-09-11T14:05:00.000Z',
  },
  // `ini-3` CELOWO nie ma realizacji: to wiersz sanitizera (status wykonawczy
  // bez przekazania) — plakietka ostrzegawcza, wiersz WIDOCZNY.
] as const;

/** Kształt zgodny z `rows` z `GET /api/report-builder/program-3axis/live`. */
const threeAxisRows = [
  {
    initiativeId: 'ini-1',
    scheduleHealth: { ratio: 0.97, rag: 'GREEN' },
    impactGap: { ratio: 0.88, rag: 'AMBER' },
    deliveryPromise: { ratio: 0.99, rag: 'GREEN' },
  },
  {
    initiativeId: 'ini-2',
    scheduleHealth: { ratio: 0.61, rag: 'RED' },
    impactGap: { ratio: 0.78, rag: 'RED' },
    deliveryPromise: { ratio: null, rag: 'NA' },
  },
  {
    initiativeId: 'ini-3',
    scheduleHealth: { ratio: 0.83, rag: 'RED' },
    impactGap: { ratio: null, rag: 'NA' },
    deliveryPromise: { ratio: 0.96, rag: 'GREEN' },
  },
];

const FalaBBankRealizacjiScreen: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  // `flags=off` = obie flagi FALI B wyłączone (zrzut PARYTETU z linią).
  const flagsOn = params.get('flags') !== 'off' && params.get('risk') !== 'off';
  const riskOn = flagsOn;
  const showPreview = params.get('view') === 'preview';

  const rows = React.useMemo(
    () => buildExecutionBankRows(initiatives as never, executionCases as never, { asOf: ASOF }),
    []
  );
  const riskSignals = React.useMemo(
    () => (riskOn ? buildExecutionRiskSignalMap(threeAxisRows) : undefined),
    [riskOn]
  );

  const previewRow = rows.find((row) => row.initiativeId === 'ini-2') ?? rows[0];
  const declaration = buildExecutionBankPreviewDeclaration({
    row: previewRow,
    t,
    statusChipTone: () => 'neutral',
    asOf: ASOF,
    progressLabel: '28%',
    relations: [],
    riskSignal: riskSignals?.get(previewRow.initiativeId) ?? null,
    showHandoffTrace: flagsOn,
  });

  return (
    <main className="min-h-screen bg-c-bg p-6 text-c-text">
      <header className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-c-text-muted">
          Realizacja · Bank · FALA B (H2 przekazanie + B-E0 ryzyko)
        </p>
        <h1 className="mt-1 text-xl font-semibold">
          {showPreview ? 'Podgląd wiersza' : flagsOn ? 'Tabela — flagi FALI B ON' : 'Tabela — flagi FALI B OFF (parytet z linią)'}
        </h1>
      </header>
      {showPreview ? (
        <div className="max-w-[420px] rounded-2xl border border-c-border-subtle bg-c-surface">
          <StandardPreview title={previewRow.name} {...declaration} />
        </div>
      ) : (
        <div className="h-[720px] rounded-2xl border border-c-border-subtle bg-c-surface">
          <ExecutionBankViews
            rows={rows}
            view="table"
            selected={null}
            calendarWindow={{ asOf: ASOF, resolution: 'MONTH', buckets: [], horizonMonths: 6 } as never}
            onSelect={() => undefined}
            onOpen={() => undefined}
            onHorizonChange={() => undefined}
            onDrilldownMonth={() => undefined}
            riskSignals={riskSignals}
            showHandoffTrace={flagsOn}
          />
        </div>
      )}
    </main>
  );
};

export default FalaBBankRealizacjiScreen;
