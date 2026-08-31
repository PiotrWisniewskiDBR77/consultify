/**
 * RoiCaseCardSections — model JEDNEJ KARTY N dla sprawy ROI.
 *
 * ── DECYZJA WŁAŚCICIELA (2026-08-30) ──────────────────────────────────────
 * Trzy ekrany ROI zostały odrzucone jednym uzasadnieniem:
 *   `results-vnext-roi-full-tool`  — „ROI to jedna analiza i powinna mieć
 *      formułę N-karty. […] to menu, które teraz masz, już się nie wciśnie —
 *      byłoby to czwarte menu, a to byłoby zupełnie niepotrzebne. […] Każda
 *      jedna analiza ROI, łącznie z modelem, to jest po prostu jedna karta."
 *   `results-vnext-roi-model`      — „Muszę to odrzucić […] Musimy przenieść
 *      to do jednej n-karty."
 *   `results-vnext-roi-pir-outcomes` — „to jest kolejna N-karta w jednym ROI-u."
 *
 * Prototyp zaakceptowanej formuły: `dev-render/screens/roi-jedna-karta.tsx`
 * (ta sama, co `wskaznik-jedna-karta` i `cel-jedna-karta`). Ten plik przenosi
 * tę formułę na PRODUKCYJNĄ powierzchnię ROI.
 *
 * ── CO SIĘ ZMIENIA, A CO NIE ──────────────────────────────────────────────
 * ZNIKA jeden poziom menu: dotychczasowy pasek faz (Menu 3 —
 * `RoiCasePhaseNav`, cztery pigułki Budowa sprawy / Decyzja / Realizacja
 * wartości / Wnioski) staje się LEWĄ NAWIGACJĄ karty. Menu 2 (podwidoki)
 * zostaje jako rząd zakładek wewnątrz sekcji. Efekt: 1 menu zamiast 3, plus
 * pasek tożsamości Menu 1 — dokładnie to, o co prosił właściciel.
 *
 * NIE ZNIKA ANI JEDEN PODWIDOK. Wszystkie SZESNAŚCIE zakładek czterech
 * dotychczasowych warsztatów jest wypisane niżej z przypisaniem do sekcji —
 * 2 + 3 + 3 + 5 + 3 = 16. Sekcje nie pokrywają się jeden-do-jednego z fazami,
 * bo właściciel nazwał narrację po swojemu (Założenia → Model → Wynik →
 * Wyniki po wdrożeniu → Wnioski), więc sekcja „Wynik" łączy przebiegi
 * kalkulacji (faza Budowa) z migawkami zatwierdzenia i porównaniem (faza
 * Decyzja). Kartą steruje `RoiCaseFullTool`, warsztaty dostają swój podwidok
 * jako prop — nie duplikujemy ani jednego kawałka ich mechaniki.
 *
 * SIEDEMNASTY podwidok jest DOŁOŻONY, nie wymyślony: `pir-outcome` to trzeci
 * odrzucony ekran (`RoiPirOutcomesTab`) zawężony do TEJ sprawy. Stoi w sekcji
 * „Wnioski i rekomendacja", tuż obok `pir`, bo wynik przeglądu jest werdyktem
 * TEGO przeglądu — a nie kolejnym pomiarem wykonania. Zmierzone przy okazji:
 * sekcja z sześcioma zakładkami plus przyciskiem głównym nie mieści się
 * w węższym centrum karty przy 1440 px (1138 px treści na 1088 px miejsca),
 * więc to rozstawienie jest jednocześnie poprawne znaczeniowo i mieszczalne.
 *
 * OSTRZEŻENIE O MECHANICE (zgłoszone, nie ukryte): endpoint tego podwidoku
 * (`GET /vnext/results/roi/org/pir-outcomes`) jest ORGANIZACYJNY — zwraca
 * wiele spraw i nie ma odpowiednika per sprawa. Karta filtruje jego wynik po
 * `caseId` zamiast udawać, że taka trasa istnieje; szczegóły w nagłówku
 * `RoiPirOutcomesTab.tsx`.
 *
 * SPEC-N §2.1: `comments` / `history` / `activity-log` NIE MOGĄ być sekcją
 * lewej nawigacji — u nas nie są, mieszkają w prawym panelu accordionu
 * (`ArtifactRightPanel`, kolejność `ARTIFACT_PANEL_SECTION_ORDER`).
 */
import type { StandardModuleTab } from '@/components/standard';

import type { RoiCasePhase } from './RoiCasePhaseNav';

/** Pięć sekcji karty — kolejność narracji zatwierdzona przez właściciela. */
export type RoiCardSectionId = 'zalozenia' | 'model' | 'wynik' | 'wyniki-po-wdrozeniu' | 'wnioski';

/**
 * Podwidok = jedna zakładka wewnątrz sekcji. `phase` mówi, KTÓRY warsztat
 * go renderuje (mechanika bez zmian), `id` jest identyfikatorem zakładki
 * w tym warsztacie. Wszystkie 17 identyfikatorów jest unikalnych globalnie,
 * więc jeden rząd zakładek karty nie potrzebuje prefiksów.
 */
export interface RoiCardSubview {
  id: string;
  phase: RoiCasePhase | 'pir-outcome';
  label: { pl: string; en: string };
}

export interface RoiCardSectionDef {
  id: RoiCardSectionId;
  label: { pl: string; en: string };
  subviews: RoiCardSubview[];
}

export const ROI_CARD_SECTIONS: RoiCardSectionDef[] = [
  {
    id: 'zalozenia',
    label: { pl: 'Założenia', en: 'Assumptions' },
    subviews: [
      {
        id: 'settings',
        phase: 'build',
        label: { pl: 'Baseline i polityka', en: 'Baseline & policy' },
      },
      { id: 'assumptions', phase: 'build', label: { pl: 'Założenia', en: 'Assumptions' } },
    ],
  },
  {
    id: 'model',
    label: { pl: 'Model', en: 'Model' },
    subviews: [
      { id: 'cost-lines', phase: 'build', label: { pl: 'Koszty', en: 'Cost lines' } },
      { id: 'benefit-lines', phase: 'build', label: { pl: 'Korzyści', en: 'Benefit lines' } },
      { id: 'scenarios', phase: 'build', label: { pl: 'Scenariusze', en: 'Scenarios' } },
    ],
  },
  {
    id: 'wynik',
    label: { pl: 'Wynik', en: 'Result' },
    subviews: [
      {
        id: 'calculation-runs',
        phase: 'build',
        label: { pl: 'Przebiegi kalkulacji', en: 'Calculation runs' },
      },
      {
        id: 'approval-snapshots',
        phase: 'decision',
        label: { pl: 'Migawki zatwierdzenia', en: 'Approval snapshots' },
      },
      { id: 'compare', phase: 'decision', label: { pl: 'Porównanie', en: 'Compare' } },
    ],
  },
  {
    id: 'wyniki-po-wdrozeniu',
    label: { pl: 'Wyniki po wdrożeniu', en: 'Post-implementation results' },
    subviews: [
      { id: 'forecast-versions', phase: 'realize', label: { pl: 'Prognoza', en: 'Forecast' } },
      { id: 'actuals', phase: 'realize', label: { pl: 'Wykonania', en: 'Actuals' } },
      {
        id: 'actual-snapshots',
        phase: 'realize',
        label: { pl: 'Migawki wykonania', en: 'Actual snapshots' },
      },
      { id: 'variances', phase: 'realize', label: { pl: 'Wariancje', en: 'Variances' } },
      {
        id: 'benefits-realization',
        phase: 'realize',
        label: { pl: 'Realizacja korzyści', en: 'Benefits realization' },
      },
    ],
  },
  {
    id: 'wnioski',
    label: { pl: 'Wnioski i rekomendacja', en: 'Learnings & recommendation' },
    subviews: [
      { id: 'pir', phase: 'learn', label: { pl: 'PIR', en: 'PIR' } },
      { id: 'pir-outcome', phase: 'pir-outcome', label: { pl: 'Wynik PIR', en: 'PIR outcome' } },
      {
        id: 'finance-links',
        phase: 'learn',
        label: { pl: 'Powiązania Finance', en: 'Finance links' },
      },
      {
        id: 'finance-reconciliations',
        phase: 'learn',
        label: { pl: 'Rekoncyliacje', en: 'Reconciliations' },
      },
    ],
  },
];

/** Sekcja, do której należy dany podwidok (albo `undefined` dla nieznanego). */
export function findRoiCardSectionOfSubview(subviewId: string): RoiCardSectionDef | undefined {
  return ROI_CARD_SECTIONS.find((s) => s.subviews.some((v) => v.id === subviewId));
}

export function getRoiCardSection(sectionId: string): RoiCardSectionDef | undefined {
  return ROI_CARD_SECTIONS.find((s) => s.id === sectionId);
}

/** Rząd zakładek Menu 2 dla sekcji — w języku interfejsu. */
export function buildRoiCardSectionTabs(
  section: RoiCardSectionDef,
  isPolish: boolean
): StandardModuleTab[] {
  return section.subviews.map((v) => ({ id: v.id, label: isPolish ? v.label.pl : v.label.en }));
}

/**
 * Sekcja startowa dla fazy — pozwala zachować dotychczasowe wejścia
 * (`initialPhase`, m.in. z harnessu dev-render) bez zmiany ich kontraktu.
 */
export const ROI_PHASE_ENTRY_SECTION: Record<RoiCasePhase, RoiCardSectionId> = {
  build: 'zalozenia',
  decision: 'wynik',
  realize: 'wyniki-po-wdrozeniu',
  learn: 'wnioski',
};

/**
 * Tryb karty przekazywany warsztatowi: rząd zakładek pochodzi z sekcji,
 * stan aktywnej zakładki trzyma karta, a pasek faz i okruszki znikają
 * (Menu 1 karty i lewa nawigacja już je niosą).
 */
export interface RoiCardModeProps {
  tabs: StandardModuleTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}
