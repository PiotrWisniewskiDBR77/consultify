/**
 * Projekcja WNIOSKÓW (warstwa `conclusions`) na wiersze listy „Wnioski” Oceny
 * — i twarde rozdzielenie ich od ZAPISÓW SESJI (DEC-416).
 *
 * PRZYCZYNA: zakładka „Wnioski” listowała wyłącznie zamrożone zapisy sesji
 * (jądro `method_outputs`) i oceny z magazynu zastanego. Oba wyglądały jak
 * wnioski, choć wnioskiem nie były — właściciel czytał to jako „brak narzędzia
 * do generowania wniosków”. Realne wnioski z ocen powstają w warstwie
 * Wniosków (`conclusions`, `source_module` = `assessment*`), tylko nikt ich tu
 * nie pokazywał.
 *
 * Reguła rozdziału jest w JEDNYM miejscu (`typWierszaWnioskow`) i wynika z
 * przestrzeni id, nie ze zgadywania po tytule: `wniosek~…` = WNIOSEK,
 * `ocena~…` = ZAPIS SESJI (magazyn zastany), reszta = zamrożony wynik jądra.
 */
import {
  PREFIKS_OCENY_ZASTANEJ,
  type MethodOutputListItemLike,
} from './typyWierszaWnioskow';

/** Osobna przestrzeń id — zero ryzyka pomylenia wniosku z Outputem jądra. */
export const PREFIKS_WNIOSKU = 'wniosek~';

export function idWierszaWniosku(conclusionId: string): string {
  return `${PREFIKS_WNIOSKU}${conclusionId}`;
}

/** `null`, gdy id nie należy do przestrzeni wniosków. */
export function idWnioskuZWiersza(rowId: string): string | null {
  return rowId.startsWith(PREFIKS_WNIOSKU) ? rowId.slice(PREFIKS_WNIOSKU.length) || null : null;
}

export type TypWiersza = 'wniosek' | 'zapis-sesji' | 'wynik-jadra';

/** JEDNA reguła rozdziału dla kolumny TYP, podglądu i akcji. */
export function typWierszaWnioskow(rowId: string): TypWiersza {
  if (rowId.startsWith(PREFIKS_WNIOSKU)) return 'wniosek';
  if (rowId.startsWith(PREFIKS_OCENY_ZASTANEJ)) return 'zapis-sesji';
  return 'wynik-jadra';
}

/** Wniosek z warstwy Wniosków, w minimalnym kształcie, jakiego potrzebuje lista. */
export interface WniosekListy {
  id: string;
  title: string;
  sourceModule: string;
  status: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  sourceArtifactRefs?: Array<{ type: string; id: string; title?: string | null }>;
}

/** Tylko wnioski pochodzące z OCENY — warstwa jest org-wide i niesie też
 * wnioski z wywiadu, narzędzi i audytów; pokazanie ich tutaj byłoby tym samym
 * błędem, co pokazywanie cudzego Outputu jako wyniku Oceny. */
export function czyWniosekZOceny(wniosek: { sourceModule?: string | null }): boolean {
  const m = String(wniosek.sourceModule || '').toLowerCase();
  return m === 'assessment' || m.startsWith('assessment_');
}

export function projektujWniosekNaWierszListy(w: WniosekListy): MethodOutputListItemLike {
  const raport = (w.sourceArtifactRefs ?? []).find((r) => r?.type === 'assessment_report') || null;
  return {
    id: idWierszaWniosku(w.id),
    organizationId: null,
    sessionId: null,
    module: 'assessment',
    methodPackId: null,
    methodPackVersion: null,
    outputVersion: null,
    revisionOfOutputId: null,
    scope: w.title || w.id,
    limitationsCount: null,
    findingsCount: null,
    contentHash: null,
    // Wniosek nie jest „zamrożony” — data powstania jest tym, co lista ma pokazać.
    frozenAt: w.updatedAt ?? w.createdAt ?? null,
    createdAt: w.createdAt ?? null,
    demoBypassActive: false,
    isSuperseded: false,
    supersededByOutputId: null,
    statusWniosku: w.status || null,
    raportZrodlowyId: raport?.id ?? null,
  };
}

/** Doklejenie wniosków do listy. Wnioski idą NA POCZĄTEK — to one są tym,
 * czego użytkownik szuka na zakładce „Wnioski”; zapisy sesji są kontekstem. */
export function scalWnioskiZWierszami<T extends { id: string }>(
  wnioski: readonly T[],
  pozostale: readonly T[]
): T[] {
  if (wnioski.length === 0) return pozostale as T[];
  const idWnioskow = new Set(wnioski.map((r) => r.id));
  return [...wnioski, ...pozostale.filter((r) => !idWnioskow.has(r.id))];
}
