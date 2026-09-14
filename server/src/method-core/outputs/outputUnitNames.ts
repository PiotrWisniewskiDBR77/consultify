/**
 * NAZWY JEDNOSTEK DLA ZAMRAŻANEGO OUTPUTU — rejestr po `methodPackId`,
 * a nie gałąź `if (method === 'drd')` w mostku.
 *
 * ★ CO BYŁO ZMIERZONE (fala J3, 2026-09-14). `EventDerivedOutputBridge`
 * zapisywał `findings[].unitName = unitId` dla 39/39 jednostek, więc raport
 * z oceny drukował „Area 1A" tam, gdzie miał stać „Sales Processes"
 * (staging a2b0a0fe32, output fa94f405). Luka była znana z README zasiewu
 * i nadal otwarta.
 *
 * ★ DLACZEGO OSOBNY PLIK, A NIE `import { DRD_STRUCTURE }` W MOSTKU.
 * Nagłówek `EventDerivedOutputBridge` stawia twardą granicę: jądro jest
 * świadomie agnostyczne wobec metody i nie ma w nim mieć gałęzi per metoda.
 * Mostek dostaje więc FUNKCJĘ `(unitId) => string`, a wybór słownika zapada
 * tutaj — w jednym, jawnym rejestrze, do którego kolejna metodyka
 * (SIRI/ADMA/CMMI) dokłada wpis, nie zmieniając mostka.
 *
 * ★ CO TO ZMIENIA W DANYCH. `unitName` wchodzi do treści zamrożonego Outputu,
 * czyli także do `contentHash`. Dotyczy to WYŁĄCZNIE Outputów zamrażanych od
 * teraz — rekordy już zamrożone nie są ruszane ani przeliczane (zapis jest
 * INSERT-only, patrz `MethodOutputService.freezeOutput`).
 *
 * ★ JĘZYK. Ta sama reguła, co dla `scope`/`limitations` w mostku: wariant
 * wybiera język odpowiedzi (`users.language` zamrażającego, brak → 'en').
 * Nieznany identyfikator jednostki wraca jako sam identyfikator — uczciwa
 * degradacja, nigdy zmyślona nazwa.
 */

import { DRD_STRUCTURE } from '../../data/drdStructure.js';
import { DRD_METHOD_PACK_ID } from '../MethodPackRegistry.js';

import type { ResponseLanguage } from '../../services/ai/responseLanguage.js';

/** `unitId` -> nazwa w danym języku. */
export type UnitNameResolver = (unitId: string) => string;

const DRD_UNIT_NAMES: ReadonlyMap<string, { readonly pl: string; readonly en: string }> = new Map(
  DRD_STRUCTURE.flatMap((axis) =>
    axis.areas.map(
      (area) =>
        [
          area.id,
          {
            // `namePL || name` tylko dla wariantu POLSKIEGO — wariant
            // angielski nigdy nie wpada w polską nazwę, bo to właśnie ten
            // fallback robił z angielskiego raportu dokument dwujęzyczny
            // (fala J1/J3, `src/components/assessment/drd/drdNazwa.ts`).
            pl: area.namePL || area.name,
            en: area.name || area.namePL || area.id,
          },
        ] as const
    )
  )
);

/**
 * Słownik nazw jednostek dla pakietu metodycznego, albo `null`, gdy tej
 * metodyki rejestr nie zna. `null` (a nie pusta funkcja) jest celowe: wołacz
 * ma wtedy zostać przy dotychczasowym zachowaniu, czyli `unitName = unitId`.
 */
export function unitNameResolverForPack(
  methodPackId: string,
  jezyk: ResponseLanguage
): UnitNameResolver | null {
  if (methodPackId !== DRD_METHOD_PACK_ID) return null;
  return (unitId: string): string => DRD_UNIT_NAMES.get(unitId)?.[jezyk] ?? unitId;
}
