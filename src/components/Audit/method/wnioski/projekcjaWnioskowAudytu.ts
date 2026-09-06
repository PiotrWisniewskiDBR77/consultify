/**
 * Projekcja WNIOSKÓW audytu (warstwa `conclusions`) na wiersze listy zakładki
 * „Wnioski" modułu Audyty (DEC-417e, 1.1-A4).
 *
 * DECYZJA WŁAŚCICIELA 06.09: „zamiast Wyniki to Wnioski — to ma działać tak
 * jak pozostałe moduły, które się kończą wnioskami, raportami i inicjatywami".
 * Zakładka „Wyniki" (Outputy jądra) przestała być zakładką; Outputy zostają
 * ŹRÓDŁEM (finalizacja sesji, generator raportu), a Menu 2 kończy się tak samo
 * jak w Ocenie: Wnioski · Raporty · Inicjatywy.
 *
 * Reguła rozdziału jest w JEDNYM miejscu i wynika ze ŹRÓDŁA (`sourceModule` +
 * typ rodowodu), nie ze zgadywania po tytule — warstwa Wniosków jest org-wide
 * i niesie też wnioski z wywiadu, ocen i narzędzi. Pokazanie ich tutaj byłoby
 * tym samym błędem, co pokazywanie cudzego Outputu jako wyniku audytu.
 */
import type { Conclusion } from '@/services/api/conclusions.api';

/** Musi być zgodne z `AUDIT_CONCLUSION_SOURCE_MODULE` w
 * `server/src/services/conclusions/auditReportConclusionBridge.ts`. */
export const MODUL_ZRODLA_AUDYTU = 'audit';
/** Musi być zgodne z `AUDIT_REPORT_REF_TYPE` (tamże). */
export const TYP_RODOWODU_RAPORTU_AUDYTU = 'audit_report';

export type TypZrodlaWniosku = 'raport' | 'sesja' | 'nieznane';

export interface WniosekAudytuWiersz {
  id: string;
  /** Kolumna „Tytuł". */
  title: string;
  /** Kolumna „TYP" — dziś zawsze „Wniosek"; kolumna trzyma rozdział widoczny,
   * gdyby lista kiedykolwiek scaliła inny byt (wzór z Oceny, DEC-416). */
  typWiersza: 'wniosek';
  /** Kolumna „Źródło" — raport audytu albo sesja audytowa. */
  typZrodla: TypZrodlaWniosku;
  zrodloId: string | null;
  zrodloTytul: string | null;
  status: string;
  dataISO: string | null;
  statement: string;
  limits: string;
  recommendedNextAction: string | null;
}

/**
 * Czy wniosek pochodzi z AUDYTU. Sprawdzamy oba końce rodowodu: moduł źródła
 * ORAZ obecność referencji do raportu audytu — sam moduł nie wystarczy, bo
 * warstwa jest wspólna, a same referencje nie wystarczą, bo inny moduł mógłby
 * kiedyś zalinkować raport audytu jako materiał pomocniczy.
 */
export function czyWniosekZAudytu(wniosek: {
  sourceModule?: string | null;
  sourceArtifactRefs?: Array<{ type?: string | null }> | null;
}): boolean {
  const modul = String(wniosek?.sourceModule || '').toLowerCase();
  if (modul !== MODUL_ZRODLA_AUDYTU && !modul.startsWith(`${MODUL_ZRODLA_AUDYTU}_`)) return false;
  const refy = Array.isArray(wniosek?.sourceArtifactRefs) ? wniosek.sourceArtifactRefs : [];
  return refy.some((ref) => String(ref?.type || '') === TYP_RODOWODU_RAPORTU_AUDYTU);
}

export function projektujWniosekAudytu(wniosek: Conclusion): WniosekAudytuWiersz {
  const refy = Array.isArray(wniosek.sourceArtifactRefs) ? wniosek.sourceArtifactRefs : [];
  const raport = refy.find((ref) => ref?.type === TYP_RODOWODU_RAPORTU_AUDYTU) || null;
  const sesja = refy.find((ref) => ref?.type === 'audit_program') || null;
  return {
    id: wniosek.id,
    title: wniosek.title || wniosek.id,
    typWiersza: 'wniosek',
    typZrodla: raport ? 'raport' : sesja ? 'sesja' : 'nieznane',
    zrodloId: raport?.id ?? sesja?.id ?? null,
    zrodloTytul: raport?.title ?? sesja?.title ?? null,
    status: wniosek.status || '',
    dataISO: wniosek.updatedAt || wniosek.createdAt || null,
    statement: wniosek.statement || '',
    limits: wniosek.limits || '',
    recommendedNextAction: wniosek.recommendedNextAction ?? null,
  };
}

/**
 * Etykieta stanu wniosku — TA SAMA reguła, co na zakładce Wnioski Oceny
 * (`src/components/assessment/wnioski/projekcjaWnioskow.ts`). Kod techniczny
 * (`candidate`, `needs_evidence`…) nigdy nie trafia na twarz produktu.
 */
export { etykietaStanuWniosku } from '@/components/assessment/wnioski/projekcjaWnioskow';

/** Etykieta źródła wniosku dla kolumny „Źródło". */
export function etykietaZrodlaWniosku(typ: TypZrodlaWniosku, pl: boolean): string {
  if (typ === 'raport') return pl ? 'Raport audytu' : 'Audit report';
  if (typ === 'sesja') return pl ? 'Sesja audytowa' : 'Audit session';
  return pl ? 'Źródło nieznane' : 'Unknown source';
}
