/**
 * @vitest-environment jsdom
 *
 * K5 — naprawy defektów Inicjatyw ze zrzutów żywego stagingu (2026-09-13).
 *
 *   I1 — kropka priorytetu „Medium" miała TRZY kolory na trzech powierzchniach
 *        jednego modułu: niebieski (kanban), BORDOWY #85182F (karta grid, przez
 *        `tone: 'accent'` → `var(--c-accent)` = Harvard Crimson) i
 *        POMARAŃCZOWY (panel Właściwości artefaktu, `bg-amber-400`).
 *        Crimson jako dana jest zakazany (tailwind.config.js §15.1).
 *   I2 — kebab wiersza: „Otwórz" po polsku obok „Open preview" po angielsku,
 *        a wyszarzone „Archive" niosło polskie zdanie — na koncie EN (DEC-461).
 *   I4 — pasek „Top Warnings": „179d overdue" na WYPEŁNIONEJ czerwieni obok
 *        bursztynowego „Blocked", plus „Blocked" doklejane do KAŻDEJ inicjatywy
 *        w realizacji (9 z 10 ostrzeżeń dotyczyło niezablokowanych).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { priorityToneStyle } from '@/components/standard/PriorityCell';
import { PRIORITY_STYLES } from '@/constants/statusColors';
import { createInitiativeRegisterRowMenu } from '@/components/Initiatives/initiativeRegisterColumns.shared';

describe('K5-I1 — jedna skala kropki priorytetu dla całego modułu', () => {
  it('nie używa crimsona (brand/accent) dla żadnego priorytetu', () => {
    for (const value of ['critical', 'high', 'medium', 'low']) {
      const { dot } = priorityToneStyle(value);
      expect(dot).not.toContain('c-accent');
      expect(dot).not.toContain('primary');
      expect(dot).not.toContain('85182F');
      expect(dot).not.toContain('902C41');
    }
  });

  it('„Medium" jest niebieska, „High" bursztynowa — i nie mylą się ze sobą', () => {
    expect(priorityToneStyle('medium').dot).toBe('bg-blue-500');
    expect(priorityToneStyle('high').dot).toBe('bg-amber-500');
    expect(priorityToneStyle('medium').dot).not.toBe(priorityToneStyle('high').dot);
  });

  it('kanban (PRIORITY_STYLES) trzyma się tej samej skali kropki co SSOT', () => {
    /*
     * Kanban czyta `getPriorityStyle` z `constants/statusColors`. Ten test
     * PILNUJE, żeby ta mapa nigdy nie odjechała od `standard/PriorityCell` —
     * bo właśnie rozjazd trzech map dał trzy kolory jednej „Średniej".
     */
    for (const value of ['CRITICAL', 'HIGH', 'MEDIUM']) {
      expect(PRIORITY_STYLES[value].dot).toBe(priorityToneStyle(value).dot);
    }
  });
});

describe('K5-I1 — panel Właściwości artefaktu bierze kropkę z tej samej skali', () => {
  /*
   * `InitiativeDocumentView` to 7 tys. linii z fetchami i studiem dokumentu —
   * montowanie go w teście jednostkowym byłoby pomiarem czegoś innego niż
   * kolor kropki. Straż jest więc na ŹRÓDLE: mapa `priorityMeta` nie może
   * wrócić do własnych literałów (`bg-amber-400` dla „Medium" dawało trzeci
   * kolor tej samej wartości).
   */
  const source = readFileSync(
    resolve(process.cwd(), 'src/components/Initiatives/InitiativeDocumentView.tsx'),
    'utf8'
  );

  it('nie trzyma własnych klas kropki priorytetu', () => {
    const priorityMetaBlock = source.slice(
      source.indexOf('const priorityMeta:'),
      source.indexOf('const currentPriorityMeta')
    );
    expect(priorityMetaBlock.length).toBeGreaterThan(0);
    expect(priorityMetaBlock).not.toContain('bg-amber-400');
    expect(priorityMetaBlock).toContain("priorityToneStyle('medium').dot");
    expect(priorityMetaBlock).toContain("priorityToneStyle('high').dot");
    expect(priorityMetaBlock).toContain("priorityToneStyle('critical').dot");
    expect(priorityMetaBlock).toContain("priorityToneStyle('low').dot");
  });
});

describe('K5-I2 — kebab rejestru Inicjatyw mówi jednym językiem', () => {
  it('nie zawiera polskich literałów wpisanych na sztywno', () => {
    const menu = createInitiativeRegisterRowMenu({
      row: { id: 'i-1' } as never,
      onOpen: () => undefined,
      onPreview: () => undefined,
    });

    const openLabel = menu.primary?.[0]?.label ?? '';
    const archiveNote = menu.universalHandlers?.archiveNote ?? '';

    // i18n w teście nie jest zainicjowany → `t` oddaje defaultValue (angielski).
    expect(openLabel).toBe('Open');
    expect(archiveNote).toBe(
      'Lifecycle changes and archiving run through a controlled process.'
    );
    expect(openLabel).not.toBe('Otwórz');
    expect(archiveNote).not.toContain('wykonywane');
  });

  it('akcja główna ma ikonę (parytet z „Open preview")', () => {
    const menu = createInitiativeRegisterRowMenu({
      row: { id: 'i-1' } as never,
      onOpen: () => undefined,
      onPreview: () => undefined,
    });
    expect(menu.primary?.[0]?.icon).toBeTruthy();
  });
});
