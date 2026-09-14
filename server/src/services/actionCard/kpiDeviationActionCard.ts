/**
 * P7K część B — WYZWALACZ ODCHYLENIA: rezultat KPI poza limitem otwiera
 * KARTĘ DZIAŁANIA (`action_cards`, kręgosłup P9/DEC-397).
 *
 * Umowa (docs/program/PROGRAM_NAPRAWCZY_20260905/P7K_WYNIKI_TRZY_POZIOMY_KOREKTA.md §15
 * + docs/ssot/KREGOSLUP_WARTOSCI.md §2.4/§3):
 *  · POZA LIMITEM = `performanceStatus === 'critical'`. Serwer liczy ten stan
 *    sam, z granic wersji definicji miernika (`evaluatePerformanceStatus`) —
 *    ta funkcja NIGDY nie porównuje liczb po swojemu i nie ufa klientowi.
 *    `warning` NIE otwiera karty: „ostrzeżenie" to żółty wiersz i sprawa
 *    odchylenia (`rvn_kpi_deviation_cases`, otwierana wewnątrz
 *    `recordMeasurement`), a nie zobowiązanie do działania.
 *  · JEDNA DROGA DO SKRZYNKI: karta powstaje przez `createActionCard`, które
 *    wysyła powiadomienie (`notificationService`); Skrzynka Mojej Pracy czyta
 *    otwarte `action_cards` właściciela. Zapis wprost do `canonical_inbox_items`
 *    jest zakazany (KRĘGOSŁUP §3.3) i tu nie występuje.
 *  · IDEMPOTENCJA: klucz źródła to `<kpiId>:<periodStart>:<periodEnd>`. Ten sam
 *    miernik + ten sam okres = JEDNA karta, niezależnie od tego, ile razy
 *    rezultat zostanie zapisany albo poprawiony. Strażnikiem jest odczyt
 *    `findActionCardBySource` (org-scoped) PLUS ograniczenie
 *    `action_cards_source_unique` w bazie — dowód mutacyjny w
 *    `server/src/services/actionCard/__tests__/kpiDeviationActionCard.pg.test.ts`.
 *
 * ZAŁOŻENIE CTO (bez pytania do właściciela, mandat CTO):
 *  · TERMIN karty = koniec okresu + 14 dni. §2.4 wymaga terminu (kolumna NOT
 *    NULL), a arkusz właściciela nie podaje reguły. Czternaście dni to jeden
 *    cykl przeglądu miesięcznego minus tydzień na przygotowanie — do zmiany
 *    jedną stałą, gdy właściciel powie inaczej.
 *  · GŁÓWNA PRZYCZYNA (`root_cause`) zostaje PUSTA. §2.4 mówi wprost, że
 *    wypełnia ją człowiek; wpisanie tu zdania wygenerowanego przez system
 *    byłoby zmyśleniem przyczyny. Karta pokazuje wtedy „—", nigdy zera.
 *
 * ★ [ODMROZENIE 04_ASSESSMENT DEC-510] FALA G1 / kryterium S1.3 — DWIE ZMIANY
 *   wobec stanu z 14.09 (pomiar: Northwind, org EN, 30 z 30 kart po polsku,
 *   `action_text` puste we wszystkich 30):
 *
 *   1. JĘZYK. Teksty karty idą przez słownik `reportLocale.ts`
 *      (klucz + parametry), a język bierze się z OSOBY, która kartę dostanie:
 *      `users.language` odpowiedzialnego → `organizations.default_language`
 *      → `en`. Nie z serwera, nie z nagłówka żądania — kartę czyta
 *      odpowiedzialny, więc to jego język decyduje.
 *
 *   2. `action_text` PRZESTAJE BYĆ PUSTE, ale NADAL NIC NIE ZMYŚLA. Zdanie
 *      składa się WYŁĄCZNIE z liczb, które serwer już policzył (miernik,
 *      okres, rezultat, cel, kierunek i wielkość odchylenia) plus krok
 *      wymagany przez §2.4: „wyjaśnij i zapisz działanie naprawcze
 *      z terminem". Żadnej hipotezy o przyczynie — ta zostaje w `root_cause`,
 *      pusta, dla człowieka. Powód zmiany wobec poprzedniego założenia CTO
 *      („zostaw puste"): puste pole w Skrzynce czytało się jako „karta bez
 *      treści" — odpowiedzialny nie wiedział, czego od niego chcą, a to był
 *      realny bloker kryterium S1.3, nie kosmetyka.
 */
import * as queryHelpers from '../../utils/queryHelpers.js';
import { normalizeReportLocale, type ReportLocale } from '../report/reportLocale.js';
import { actionCardMessage } from './actionCardMessages.js';
import {
  createActionCard,
  findActionCardBySource,
  type ActionCard,
  type ActionCardScope,
} from './actionCardService.js';

/** Ile dni po końcu okresu wypada termin karty otwartej automatycznie. */
export const KPI_DEVIATION_DUE_DATE_OFFSET_DAYS = 14;

export const KPI_DEVIATION_SOURCE_KIND = 'kpi_deviation' as const;

/** `<kpiId>:<periodStart>:<periodEnd>` — patrz nagłówek, IDEMPOTENCJA. */
export function buildKpiDeviationSourceId(
  kpiId: string,
  periodStart: string,
  periodEnd: string
): string {
  return `${kpiId}:${isoDay(periodStart)}:${isoDay(periodEnd)}`;
}

function isoDay(value: string | Date): string {
  const text = value instanceof Date ? value.toISOString() : String(value);
  return text.slice(0, 10);
}

function addDays(day: string, days: number): string {
  const date = new Date(`${isoDay(day)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return isoDay(day);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const NUMBER_LOCALE: Record<ReportLocale, string> = { pl: 'pl-PL', en: 'en-GB' };

function formatNumber(
  value: number | null | undefined,
  unit: string | null | undefined,
  locale: ReportLocale
): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const text = new Intl.NumberFormat(NUMBER_LOCALE[locale], { maximumFractionDigits: 2 }).format(
    value
  );
  return unit ? `${text} ${unit}` : text;
}

/**
 * Język KARTY = język ODPOWIEDZIALNEGO, bo to on ją czyta w Skrzynce.
 * Kolejność: `users.language` → `organizations.default_language` → `en`
 * (DEC-461/DEC-510: domyślnym językiem aplikacji jest angielski).
 * Każdy krok jest best-effort — błąd zapytania NIE wywraca tworzenia karty,
 * tylko schodzi do następnego kandydata. Kartę lepiej mieć po angielsku niż
 * nie mieć wcale.
 */
export async function resolveActionCardLocale(
  organizationId: string,
  ownerUserId: string | null
): Promise<ReportLocale> {
  if (ownerUserId) {
    try {
      const row = await queryHelpers.queryOne<{ language: string | null }>(
        `SELECT language FROM users WHERE id = ?`,
        [ownerUserId]
      );
      const fromUser = normalizeReportLocale(row?.language ?? null);
      if (fromUser) return fromUser;
    } catch {
      /* users.language niedostępne — schodzimy do organizacji */
    }
  }
  try {
    const org = await queryHelpers.queryOne<{ default_language: string | null }>(
      `SELECT default_language FROM organizations WHERE id = ?`,
      [organizationId]
    );
    const fromOrg = normalizeReportLocale(org?.default_language ?? null);
    if (fromOrg) return fromOrg;
  } catch {
    /* organizations.default_language niedostępne — 'en' */
  }
  return 'en';
}

/**
 * OPIS PROBLEMU + OPIS DZIAŁANIA z jednego pomiaru. Czysta funkcja: żadnego
 * wejścia do bazy, żadnej losowości — te same liczby dają to samo zdanie,
 * więc karta odtworzona z tego samego odchylenia jest identyczna.
 */
export function buildKpiDeviationCardText(input: {
  locale: ReportLocale;
  kpiName: string;
  period: string;
  unit?: string | null;
  actualValue: number | null;
  targetValue: number | null;
}): { problem: string; actionText: string } {
  const { locale } = input;
  const actual = formatNumber(input.actualValue, input.unit, locale);
  const target = formatNumber(input.targetValue, input.unit, locale);
  const params = { kpi: input.kpiName, period: input.period, actual, target };

  const problem = actionCardMessage(locale, 'actionCards.kpiDeviation.problem', params);

  const policzalne =
    input.actualValue != null &&
    Number.isFinite(input.actualValue) &&
    input.targetValue != null &&
    Number.isFinite(input.targetValue);
  if (!policzalne) {
    return {
      problem,
      actionText: actionCardMessage(locale, 'actionCards.kpiDeviation.actionUnknownGap', params),
    };
  }
  const roznica = (input.actualValue as number) - (input.targetValue as number);
  const gap = formatNumber(Math.abs(roznica), input.unit, locale);
  const key =
    roznica < 0
      ? ('actionCards.kpiDeviation.actionBelow' as const)
      : ('actionCards.kpiDeviation.actionAbove' as const);
  return { problem, actionText: actionCardMessage(locale, key, { ...params, gap }) };
}

/** „2026-03-01…2026-03-31" → „03.2026" dla pełnego miesiąca, inaczej zakres dat. */
export function formatDeviationPeriodLabel(periodStart: string, periodEnd: string): string {
  const start = isoDay(periodStart);
  const end = isoDay(periodEnd);
  const [ys, ms, ds] = start.split('-');
  const [ye, me] = end.split('-');
  const lastDay = new Date(Date.UTC(Number(ye), Number(me), 0)).toISOString().slice(0, 10);
  if (ys === ye && ms === me && ds === '01' && end === lastDay) return `${ms}.${ys}`;
  return `${start} – ${end}`;
}

export interface KpiDeviationActionCardInput {
  organizationId: string;
  /** Kto zapisał rezultat — twórca karty i awaryjny odpowiedzialny. */
  actorUserId: string;
  kpiId: string;
  kpiName: string;
  unit?: string | null;
  periodStart: string;
  periodEnd: string;
  actualValue: number | null;
  targetValue: number | null;
  /** Stan policzony przez serwer; tylko `'critical'` otwiera kartę. */
  performanceStatus: string | null;
  /** Odpowiedzialny za miernik; `null` ⇒ osoba, która zapisała rezultat. */
  kpiOwnerUserId: string | null;
  /** Język karty. Pominięty ⇒ ustalany z odpowiedzialnego/organizacji
   * (`resolveActionCardLocale`). Wołacz podaje go jawnie tylko wtedy, gdy
   * już go zna — żeby nie robić drugiego zapytania o to samo. */
  locale?: ReportLocale;
}

export interface KpiDeviationActionCardOutcome {
  /** `true` tylko wtedy, gdy karta powstała w TYM wywołaniu. */
  created: boolean;
  card: ActionCard | null;
  reason: 'created' | 'already_open' | 'within_limits';
}

/**
 * Rezultat poza limitem → karta działania w Skrzynce odpowiedzialnego.
 * Rezultat w limicie (`on_target`/`warning`/`neutral`) → NIC nie powstaje.
 */
export async function ensureActionCardForKpiDeviation(
  input: KpiDeviationActionCardInput
): Promise<KpiDeviationActionCardOutcome> {
  if (input.performanceStatus !== 'critical') {
    return { created: false, card: null, reason: 'within_limits' };
  }

  const scope: ActionCardScope = {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
  };
  const periodStart = isoDay(input.periodStart);
  const periodEnd = isoDay(input.periodEnd);
  const sourceId = buildKpiDeviationSourceId(input.kpiId, periodStart, periodEnd);

  const existing = await findActionCardBySource(scope, KPI_DEVIATION_SOURCE_KIND, sourceId);
  if (existing) {
    return { created: false, card: existing, reason: 'already_open' };
  }

  const ownerUserId = input.kpiOwnerUserId || input.actorUserId;
  const locale = input.locale ?? (await resolveActionCardLocale(input.organizationId, ownerUserId));
  const period = formatDeviationPeriodLabel(periodStart, periodEnd);
  const { problem, actionText } = buildKpiDeviationCardText({
    locale,
    kpiName: input.kpiName,
    period,
    unit: input.unit,
    actualValue: input.actualValue,
    targetValue: input.targetValue,
  });

  const card = await createActionCard(scope, {
    sourceKind: KPI_DEVIATION_SOURCE_KIND,
    sourceId,
    periodStart,
    periodEnd,
    goalMet: false,
    actionRequired: true,
    problem,
    // GŁÓWNA PRZYCZYNA zostaje pusta — pole człowieka (§2.4).
    rootCause: '',
    actionText,
    ownerUserId,
    dueDate: addDays(periodEnd, KPI_DEVIATION_DUE_DATE_OFFSET_DAYS),
    locale,
  });

  return { created: true, card, reason: 'created' };
}
