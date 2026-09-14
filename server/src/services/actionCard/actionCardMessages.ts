/**
 * actionCardMessages — SŁOWNIK en/pl TEKSTÓW KARTY DZIAŁANIA.
 *
 * [ODMROZENIE 04_ASSESSMENT DEC-510] FALA G1 / kryterium S1.3.
 *
 * ★ POMIAR, KTÓRY KAZAŁ TO ZBUDOWAĆ (14.09.2026, żywa baza stagingu):
 * Northwind — organizacja ANGIELSKA — miała 30 otwartych kart
 * `source_kind='kpi_deviation'` i WSZYSTKIE 30 było po polsku
 * („Odchylenie: Inventory Turns 01.2026 — rezultat…"), bo zdanie było
 * sklejane na sztywno w serwisie. Do tego `action_text` we wszystkich 30 było
 * puste, więc odpowiedzialny dostawał w Skrzynce kartę, która nie mówiła,
 * czego od niego chcą.
 *
 * ★ DLACZEGO OSOBNY PLIK, A NIE `services/report/reportLocale.ts`.
 * Tamten słownik ma twardy kontrakt (`reportLocale.resources.test.ts`): KAŻDY
 * jego klucz musi mieć bliźniaka w `public/locales/{en,pl}/translation.json`,
 * bo te napisy renderuje także klient. Teksty karty działania klient
 * renderuje INACZEJ — są zapisane jako gotowa treść w kolumnach
 * `action_cards.problem` / `action_cards.action_text` i nigdy nie wracają do
 * i18n przeglądarki. Dopisanie ich tam byłoby martwym kluczem w dwóch
 * plikach tłumaczeń. Typ `ReportLocale` i normalizacja są reużyte, żeby nie
 * powstał drugi pomysł na to, czym jest „język".
 */
import { type ReportLocale } from '../report/reportLocale.js';

const MESSAGES = {
  /** Tytuł powiadomienia o przypisaniu karty (dzwonek). */
  'actionCards.assignedNotification': {
    en: 'An action card needs your response',
    pl: 'Karta działania wymaga reakcji',
  },
  'actionCards.kpiDeviation.problem': {
    en: 'Deviation: {kpi} {period} — result {actual} is outside the limit (target {target}).',
    pl: 'Odchylenie: {kpi} {period} — rezultat {actual} poza limitem (cel {target}).',
  },
  /**
   * ★ `action_text` NIE ZMYŚLA PRZYCZYNY. Zdania poniżej powtarzają wyłącznie
   * to, co serwer już policzył (miernik, okres, rezultat, cel, kierunek
   * i wielkość odchylenia) i nazywają krok wymagany przez §2.4 kręgosłupa:
   * wyjaśnić i zapisać działanie naprawcze z terminem. Żadnej hipotezy —
   * GŁÓWNA PRZYCZYNA (`root_cause`) zostaje pusta, dla człowieka.
   */
  'actionCards.kpiDeviation.actionBelow': {
    en: 'Explain the shortfall of {gap} against the target for {kpi} in {period} (result {actual}, target {target}) and record a corrective action with a deadline.',
    pl: 'Wyjaśnij niedobór {gap} względem celu dla miernika {kpi} w okresie {period} (rezultat {actual}, cel {target}) i zapisz działanie naprawcze z terminem.',
  },
  'actionCards.kpiDeviation.actionAbove': {
    en: 'Explain the overrun of {gap} above the target for {kpi} in {period} (result {actual}, target {target}) and record a corrective action with a deadline.',
    pl: 'Wyjaśnij przekroczenie celu o {gap} dla miernika {kpi} w okresie {period} (rezultat {actual}, cel {target}) i zapisz działanie naprawcze z terminem.',
  },
  /** Wariant bez policzalnego odchylenia (brak celu albo brak rezultatu):
   * zdanie nie może podać wielkości, więc jej NIE PODAJE. */
  'actionCards.kpiDeviation.actionUnknownGap': {
    en: 'Review the result of {kpi} in {period} (result {actual}, target {target}) and record a corrective action with a deadline.',
    pl: 'Sprawdź rezultat miernika {kpi} w okresie {period} (rezultat {actual}, cel {target}) i zapisz działanie naprawcze z terminem.',
  },
} as const;

export type ActionCardMessageKey = keyof typeof MESSAGES;

export const ACTION_CARD_MESSAGE_KEYS = Object.freeze(
  Object.keys(MESSAGES) as ActionCardMessageKey[]
);

export function actionCardMessage(
  locale: ReportLocale,
  key: ActionCardMessageKey,
  params: Record<string, string | number> = {}
): string {
  const template = MESSAGES[key][locale] ?? MESSAGES[key].en;
  return String(template).replace(/\{([A-Za-z0-9_]+)\}/g, (_match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : `{${name}}`
  );
}
