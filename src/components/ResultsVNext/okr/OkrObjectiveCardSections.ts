/**
 * OkrObjectiveCardSections — model JEDNEJ KARTY N dla celu OKR.
 *
 * ── SKĄD TA LISTA SEKCJI ──────────────────────────────────────────────────
 * NIE jest wymyślona. To 1:1 lewa nawigacja z ZATWIERDZONEGO przez właściciela
 * obrazu `evidence/grafika/26-wyniki-karty-n/cel-jedna-karta__PO__light__*.png`
 * (pakiet odbioru `08-wyniki`, wpis `cel-jedna-karta`, ocena A, decyzja „ok”),
 * której prototypem jest `dev-render/screens/cel-jedna-karta.tsx`. Pięć pozycji,
 * w tej kolejności, z tymi ikonami:
 *
 *   1. Cel                 (Compass)     — co chcemy osiągnąć i dlaczego
 *   2. Kluczowe rezultaty  (ListChecks)  — start / cel / wartość bieżąca
 *   3. Postęp              (TrendingUp)  — jak idzie, historia check-inów
 *   4. Powiązania          (Link2)       — wyrównania (alignments) i zestaw
 *   5. Refleksja           (Flag)        — przeglądy zestawu dotyczące celu
 *
 * Ten sam kontrakt-w-osobnym-pliku co `../roi/RoiCaseCardSections.ts`: plik
 * deklaruje TREŚĆ (id + etykiety), komponent (`OkrObjectiveCardPage.tsx`)
 * narzuca wygląd przez `NModeShell`. Zero własnego layoutu, zero własnej
 * tabeli, zero `primary-*`/crimson.
 *
 * SPEC-A §2.1: `comments`/`history`/`activity-log` NIE MOGĄ być sekcją lewej
 * nawigacji — u nas nie są, mieszkają w prawym panelu accordionu
 * (`ArtifactRightPanel`, kolejność `ARTIFACT_PANEL_SECTION_ORDER`).
 */

/** Pięć sekcji karty celu — kolejność narracji zatwierdzona przez właściciela. */
export type OkrObjectiveCardSectionId =
  | 'cel'
  | 'kluczowe-rezultaty'
  | 'check-iny'
  | 'powiazania'
  | 'refleksja';

export interface OkrObjectiveCardSectionDef {
  id: OkrObjectiveCardSectionId;
  /** Etykieta szyny (krótka — szyna ma ~140 px). */
  label: { pl: string; en: string };
  /** Pełny tytuł sekcji (nagłówek treści + dymek szyny). */
  title: { pl: string; en: string };
}

export const OKR_OBJECTIVE_CARD_SECTIONS: OkrObjectiveCardSectionDef[] = [
  {
    id: 'cel',
    label: { pl: 'Cel', en: 'Objective' },
    title: { pl: 'Cel — co chcemy osiągnąć', en: 'Objective — what we want to achieve' },
  },
  {
    id: 'kluczowe-rezultaty',
    label: { pl: 'Kluczowe rezultaty', en: 'Key results' },
    title: { pl: 'Kluczowe rezultaty', en: 'Key results' },
  },
  {
    // P7K część A (05.09): SSOT §3 nazywa tę sekcję CHECK-INAMI („Karta
    // celu: Cel · Kluczowe rezultaty · Check-iny · Powiązania · Refleksja"),
    // a nie „Postępem" — i tak samo nazywa ją zatwierdzony zrzut
    // `evidence/p7k-wyniki/prototype/okr-l3--light.png`. Treść sekcji się
    // nie zmienia (stan celu + oś czasu check-inów), zmienia się nazwa, bo
    // check-in jest tu CZYNNOŚCIĄ, a postęp jego skutkiem.
    id: 'check-iny',
    label: { pl: 'Check-iny', en: 'Check-ins' },
    title: { pl: 'Check-iny i postęp celu', en: 'Check-ins and objective progress' },
  },
  {
    id: 'powiazania',
    label: { pl: 'Powiązania', en: 'Relations' },
    title: { pl: 'Powiązania celu', en: 'Objective relations' },
  },
  {
    id: 'refleksja',
    label: { pl: 'Refleksja', en: 'Reflection' },
    title: { pl: 'Refleksja z przeglądu', en: 'Review reflection' },
  },
];

export const OKR_OBJECTIVE_CARD_DEFAULT_SECTION: OkrObjectiveCardSectionId = 'cel';

export function isOkrObjectiveCardSectionId(value: string | null | undefined): value is OkrObjectiveCardSectionId {
  return !!value && OKR_OBJECTIVE_CARD_SECTIONS.some((section) => section.id === value);
}

export function getOkrObjectiveCardSection(
  sectionId: string | null | undefined
): OkrObjectiveCardSectionDef | undefined {
  return OKR_OBJECTIVE_CARD_SECTIONS.find((section) => section.id === sectionId);
}

// ==========================================
// KARTA KLUCZOWEGO REZULTATU — USUNIĘTA (P7K część A, 05.09).
//
// Poziomy OKR są TRZY, nie cztery: SSOT §1 („Karta celu N (rezultaty jako
// sekcja)") i korekta P7K §4/§6 („usunąć trasy i strony OkrKeyResultSetPage,
// OkrKeyResultCardPage — KR otwiera się w karcie celu, nie osobno").
// Kontrakt `OKR_KEY_RESULT_CARD_SECTIONS` zniknął razem ze stronami, które
// go czytały; kluczowy rezultat jest BLOKIEM w sekcji „Kluczowe rezultaty".
// ==========================================
