/**
 * Bramka: skoroszyt eksportowany do .xlsx nie może zawierać angielskich
 * nagłówków.
 *
 * Powód (przegląd 2026-08-31): siedem szablonów miało `header: 'Driver'` na
 * polskim arkuszu „Założenia". Naprawa per plik zamknęła te siedem, ale ten sam
 * defekt siedział jeszcze w dwóch miejscach, których grep po `'Driver'` nie
 * pokrywał w oczywisty sposób:
 *   - `threeScenarioPnL` miał angielskie SCEN_LABEL (Base/Bull/Bear), zasilające
 *     nagłówki TRZECH arkuszy naraz,
 *   - `emitScenarioSwitch` w WorkbookBuilder wpisuje 'Driver'/'Active'/'Scenario'
 *     wprost do komórek pliku, więc żaden szablon tego nie kontrolował.
 *
 * Test czyta KOMÓRKI zbudowanego .xlsx (nie kod), bo „grep nie znalazł" nigdy
 * nie było dowodem — patrz złota reguła nr 1 w CLAUDE.md.
 */
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { buildThreeScenarioPnLSchema } from '../templates/threeScenarioPnL.js';
import { buildWorkbookBuffer } from '../WorkbookBuilder.js';
import type { WorkbookSchema } from '../WorkbookSchema.js';

/** Słowa, które nie mają prawa stać w nagłówku polskiego skoroszytu. */
const ANGIELSKIE = /\b(Driver|Base|Bull|Bear|Active|Scenario)\b/;

function wiersz(ws: ExcelJS.Worksheet, r: number): string[] {
  const out: string[] = [];
  ws.getRow(r).eachCell({ includeEmpty: false }, (c) => out.push(String(c.value ?? '')));
  return out;
}

describe('eksport .xlsx — nagłówki po polsku', () => {
  it('threeScenarioPnL: wszystkie trzy arkusze mają polskie nagłówki', async () => {
    const buf = await buildWorkbookBuffer(
      buildThreeScenarioPnLSchema({
        companyName: 'Acme Sp. z o.o.',
        currencyCode: 'PLN',
        startYear: 2026,
        baseRevenue: 1_000_000,
      })
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);

    expect(wiersz(wb.getWorksheet('Założenia')!, 1)).toEqual([
      'Założenie',
      'Bazowy',
      'Optymistyczny',
      'Pesymistyczny',
    ]);
    // Nagłówki P&L powstają jako `${SCEN_LABEL[scen]} ${rok}` — dowód, że
    // SCEN_LABEL jest jedynym źródłem nazw scenariuszy, nie trzema kopiami.
    expect(wiersz(wb.getWorksheet('P&L')!, 1).slice(1)).toEqual([
      'Bazowy 2026',
      'Bazowy 2027',
      'Bazowy 2028',
      'Optymistyczny 2026',
      'Optymistyczny 2027',
      'Optymistyczny 2028',
      'Pesymistyczny 2026',
      'Pesymistyczny 2027',
      'Pesymistyczny 2028',
    ]);
    expect(wiersz(wb.getWorksheet('Porównanie')!, 1)).toEqual([
      'Metryka',
      'Bazowy',
      'Optymistyczny',
      'Pesymistyczny',
    ]);

    wb.eachSheet((ws) => {
      for (const komorka of wiersz(ws, 1)) expect(komorka).not.toMatch(ANGIELSKIE);
    });
  });

  it('scenarioSwitch: etykiety domyślne po polsku, gdy schemat ich nie poda', async () => {
    const schema = {
      title: 'Model scenariuszowy',
      author: 'Consultify',
      sheets: [
        {
          name: 'Model',
          columns: [
            { key: 'driver', header: 'Założenie', type: 'text', width: 24 },
            { key: 'active', header: 'Aktywna wartość', type: 'number' },
            { key: 'base', header: 'Bazowy', type: 'number' },
            { key: 'bull', header: 'Optymistyczny', type: 'number' },
            { key: 'bear', header: 'Pesymistyczny', type: 'number' },
          ],
          rows: [],
          scenarioSwitch: {
            scenarios: ['Bazowy', 'Optymistyczny', 'Pesymistyczny'],
            active: 'Bazowy',
            labelColumn: 'driver',
            activeColumn: 'active',
            scenarioColumns: ['base', 'bull', 'bear'],
            selectorCell: 'B1',
            // selectorLabel POMINIĘTY celowo — to ścieżka wartości domyślnej.
            drivers: [
              { label: 'Wzrost przychodów %', values: [0.08, 0.15, 0.02], numberFormat: '0.0%' },
            ],
          },
        },
      ],
    } as unknown as WorkbookSchema;

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await buildWorkbookBuffer(schema)) as unknown as ArrayBuffer);
    const ws = wb.getWorksheet('Model')!;
    const plaski = [1, 2, 3, 4]
      .map((r) => wiersz(ws, r))
      .flat()
      .join(' | ');

    expect(plaski).toContain('Scenariusz');
    expect(plaski).toContain('Założenie');
    expect(plaski).toContain('Aktywna wartość');
    expect(plaski).not.toMatch(ANGIELSKIE);
  });
});
