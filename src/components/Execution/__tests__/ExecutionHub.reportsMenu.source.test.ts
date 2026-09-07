/**
 * @vitest-environment node
 *
 * 1.12-R4b (zlecenie 12r4b) — Raporty: Menu 3 miało 11 chipów (zrzut R4,
 * `evidence/1-12-r4/03-zdrowie-programu.png`) wychodzących poza ekran przy
 * 1440 (kanon: ≤3), a CTA „Nowy raport" siedziało we własnym nagłówku
 * `ExecutionReportsSurface` zamiast w Menu 2 gospodarza (STOP z R4).
 * ExecutionHub jest zbyt ciężki, by montować w teście jednostkowym (patrz
 * `ExecutionHub.kokpitMenu3.source.test.ts` — ten sam wzorzec: blokada na
 * źródle, nie na zamontowanym drzewie).
 *
 * [ODMROZENIE 06_EXECUTION DEC-453] P16-R6 (D6/D7, właściciel 07.09): czwarty
 * chip „Definicje (N)" dochodzi celowo — liczy CAŁY katalog (12 definicji) i
 * przełącza widok na katalog, ten sam efekt co pigułka Raporty|Definicje w
 * Menu 2. To NIE jest powrót do 11 chipów sprzed R4b (kadencja/poziom/
 * audytorium zostają w dropdownie „Poziom") — stąd test niżej trzyma 4, nie
 * 3, ale nadal odrzuca powrót jakiegokolwiek z ośmiu usuniętych chipów.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const executionHubSource = readFileSync(new URL('../ExecutionHub.tsx', import.meta.url), 'utf8');

describe('Raporty — Menu 3 (4 chipy) i CTA w Menu 2, 1.12-R4b + P16-R6', () => {
  it('getExecutionMenu3 deklaruje DOKŁADNIE cztery chipy dla zakładki reports', () => {
    const start = executionHubSource.indexOf('function getExecutionMenu3');
    const reportsStart = executionHubSource.indexOf('reports: [', start);
    const end = executionHubSource.indexOf('\n    ].map', reportsStart);
    const reportsBlock = executionHubSource.slice(reportsStart, end);

    // Mutacja: dopisanie piątego chipa (np. przywrócenie 'weekly') ma
    // przewrócić ten test — stąd policzenie wpisów tablicy, nie same
    // `toContain`, które przeżyłyby dopisanie #5.
    const chipEntries = reportsBlock.match(/^\s*\['[a-z-]+',/gm) ?? [];
    expect(chipEntries).toHaveLength(4);
    expect(reportsBlock).toContain("['all',");
    expect(reportsBlock).toContain("['needs-review',");
    expect(reportsBlock).toContain("['published',");
    // P16-R6 (D6/D7): czwarty chip — liczy CAŁY katalog i przełącza widok.
    expect(reportsBlock).toContain("['definitions',");
    // Usunięte chipy kadencji/poziomu/„nieudane" — przeniesione do dropdownu
    // „Poziom" w Menu 2 (`ExecutionReportsSurface`'s `onRegisterFilterControl`).
    expect(reportsBlock).not.toContain("'weekly'");
    expect(reportsBlock).not.toContain("'monthly'");
    expect(reportsBlock).not.toContain("'on-demand'");
    expect(reportsBlock).not.toContain("'sponsor'");
    expect(reportsBlock).not.toContain("'needs-generation'");
    expect(reportsBlock).not.toContain("'partial-stale'");
    expect(reportsBlock).not.toContain("'failed'");
    expect(reportsBlock).not.toContain("'recent'");
  });

  it('CTA „Nowy raport" w Menu 2 otwiera kreator zdarzeniem (nie jest undefined)', () => {
    const start = executionHubSource.indexOf('const menuCta = useMemo');
    const reportsBranchStart = executionHubSource.indexOf("activeTab === 'reports'", start);
    const end = executionHubSource.indexOf('\n    }', reportsBranchStart);
    const branch = executionHubSource.slice(reportsBranchStart, end);

    // Mutacja: cofnięcie do `onNewItem: undefined` (stan sprzed 1.12-R4b,
    // STOP z R4) ma przewrócić ten test.
    expect(branch).not.toContain('onNewItem: undefined');
    expect(branch).toContain("dispatch('execution:reports-new-report')");
    expect(branch).toContain("t('executionReports.action.newReport'");
  });

  it('ExecutionReportsSurface dla reports rejestruje kontrolkę Menu 2 (`onRegisterFilterControl`)', () => {
    const idx = executionHubSource.indexOf('<ExecutionReportsSurface');
    const end = executionHubSource.indexOf('/>', idx);
    const block = executionHubSource.slice(idx, end);
    expect(block).toContain('onRegisterFilterControl={setReportsFilterControl}');
  });

  // [ODMROZENIE 06_EXECUTION DEC-453] P16-R6 (D6, test l): przyciski
  // deweloperskie „Nowa definicja"/„Kontrakt raportu (zaawansowane)" muszą
  // być niewidoczne dla MEMBER — gospodarz przekazuje `isAdmin` liczone z
  // roli systemowej, nie zawsze `true`. Mutacja: zastąpienie wywołania
  // stałym `true` (każdy widziałby kebab) ma przewrócić ten test.
  it('ExecutionReportsSurface dla reports dostaje `isAdmin` policzone z roli, nie stałą `true`', () => {
    const idx = executionHubSource.indexOf('<ExecutionReportsSurface');
    const end = executionHubSource.indexOf('/>', idx);
    const block = executionHubSource.slice(idx, end);
    expect(block).toContain('onRegisterMenu3Control={setReportsMenu3Control}');
    expect(block).toContain('isAdmin={isAdminOwnerOrSuperAdminRole(currentUser?.role)}');
    expect(block).not.toContain('isAdmin={true}');
  });

  it('StandardModuleBar dostaje `menu3Right` z kontrolki Raportów tylko na zakładce reports', () => {
    const idx = executionHubSource.indexOf('<StandardModuleBar');
    const end = executionHubSource.indexOf('chips={', idx);
    const block = executionHubSource.slice(idx, end);
    // Mutacja: `menu3Right={reportsMenu3Control}` na sztywno (bez warunku po
    // zakładce) pokazałby kebab Raportów na KAŻDEJ zakładce Realizacji.
    expect(block).toContain(
      "menu3Right={activeTab === 'reports' ? reportsMenu3Control : undefined}"
    );
  });
});
