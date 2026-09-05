/**
 * Dev-render host — dowód wizualny naprawy `EmbeddedMatrix` (macierz DRD).
 *
 * PO CO: `src/components/Reports/EmbeddedMatrix.tsx` miał własną, odklejoną
 * kopię konfiguracji osi (`DRD_AXES`) z `maxLevel: 5` dla „culture" i
 * „cybersecurity", mimo że jedyne źródło prawdy (`src/services/drdStructure.ts`
 * → `DRD_STRUCTURE[*].levelCount`) mówi 6 dla obu osi. Naprawa zamienia lokalną
 * kopię na cienki adapter nad `DRD_STRUCTURE`/`DRD_AXIS_KEY_MAP`. Ten ekran
 * montuje REALNY `EmbeddedMatrix` (nie atrapę) z mock `axisData`, w którym
 * `culture` i `cybersecurity` mają actual=target=6 — jeśli maxLevel nadal
 * błędnie wynosiłby 5, poziom 6. byłby nieosiągalny: pasek postępu
 * przekroczyłby 100% (100*6/5=120%), etykieta „/ maxLevel" pokazałaby „/ 5",
 * a znaczników skali (maxLevel-1) byłoby 4 zamiast 5.
 *
 * `EmbeddedMatrix` sam w sobie NIE jest za flagą — flagą (`isDrdReportEnabled`,
 * domyślnie OFF) jest tylko trasa `/assessment-reports/:id/full` →
 * `DRDAuditReportView` → `ReportBuilder`, która go osadza w prawdziwej apce.
 * Ten harness omija trasę i montuje komponent bezpośrednio z mock danymi —
 * zgodnie z CLAUDE.md #7 (Piotr nigdy nie jest pierwszym testerem, ale to nie
 * znaczy że komponentu nie wolno w ogóle zobaczyć przed akceptem UI).
 *
 * URL params: ?screen=drd-embedded-matrix-axis-levels&theme=light|dark&lang=pl
 */
import React from 'react';

import { EmbeddedMatrix } from '@/components/Reports/EmbeddedMatrix';

// Wszystkie 7 osi obsadzone tak, by dało się policzyć kolumny/poziomy.
// culture i cybersecurity celowo na actual=target=6 (poziom najwyższy tych osi).
//
// UWAGA o kolejności: `MaturityOverviewMatrix`/`GapAnalysisMatrix` w
// EmbeddedMatrix.tsx CELOWO sortują osie malejąco po wielkości luki
// (`.sort((a, b) => b.gap - a.gap)` — istniejąca, zamierzona logika
// priorytetyzacji, poza zakresem tej naprawy). Poprzednia wersja tego mocka
// dawała aiMaturity gap=2 (remis z processes/digitalProducts, przed
// businessModels), więc „Dojrzałość AI" lądowała na 3. miejscu zamiast na
// 7. — to była wina DANYCH MOCKOWYCH harnessu, nie utrata kolejności w
// komponencie (DRD_STRUCTURE wciąż ma AI jako oś 7). Poniższe luki są
// dobrane tak, by malały monotonicznie zgodnie z numerem osi (6,4,3,2,0,0,0
// — ostatnie trzy remisują na zero i stabilny sort JS zachowuje wtedy ich
// oryginalną kolejność wstawienia: culture, cybersecurity, aiMaturity), więc
// widok macierzy pokazuje naturalny porządek 1→7.
const axisData = {
  processes: { actual: 1, target: 7 },
  digitalProducts: { actual: 1, target: 5 },
  businessModels: { actual: 2, target: 5 },
  dataManagement: { actual: 5, target: 7 },
  // `areaScores` obsadzone dla obu osi pokazywanych niżej w trybie
  // `axis_detail` — od 2026-09-05 to one karmią macierz DRD właściciela
  // (`DRDMatrixReadOnly`), która zastąpiła tabelę „Area/Current/Target/Gap".
  // Bez nich sekcja obszarów w ogóle się nie rysuje i harness nie pokazywałby
  // tego, co pokazuje realny raport. Id obszarów z `DRD_STRUCTURE` (5A..5E, 6A..6E).
  culture: {
    actual: 6,
    target: 6,
    areaScores: {
      '5A': { actual: 4, target: 6 },
      '5B': { actual: 3, target: 5 },
      '5C': { actual: 5, target: 6 },
      '5D': { actual: 2, target: 4 },
      '5E': { actual: 6, target: 6 },
    },
  },
  cybersecurity: {
    actual: 6,
    target: 6,
    areaScores: {
      '6A': { actual: 5, target: 6 },
      '6B': { actual: 2, target: 5 },
      '6C': { actual: 4, target: 6 },
      '6D': { actual: 3, target: 4 },
      '6E': { actual: 1, target: 3 },
    },
  },
  aiMaturity: { actual: 4, target: 4 },
};

export default function DrdEmbeddedMatrixAxisLevelsScreen() {
  return (
    <div className="min-h-screen bg-white dark:bg-navy-950 p-8 space-y-8 max-w-5xl mx-auto">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
          maturity_overview — wszystkie 7 osi (kolumny Current/Target/Gap/Progress)
        </h3>
        <EmbeddedMatrix sectionType="maturity_overview" dataSnapshot={{}} axisData={axisData} />
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
          axis_detail — culture (oczekiwane maxLevel = 6: „/ 6", 5 znaczników skali)
        </h3>
        <EmbeddedMatrix
          sectionType="axis_detail"
          axisId="culture"
          dataSnapshot={{}}
          axisData={axisData}
        />
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
          axis_detail — cybersecurity (oczekiwane maxLevel = 6: „/ 6", 5 znaczników skali)
        </h3>
        <EmbeddedMatrix
          sectionType="axis_detail"
          axisId="cybersecurity"
          dataSnapshot={{}}
          axisData={axisData}
        />
      </div>
    </div>
  );
}
