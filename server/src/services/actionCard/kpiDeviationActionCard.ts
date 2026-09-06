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
 *  · OPIS DZIAŁANIA / GŁÓWNA PRZYCZYNA zostają PUSTE. §2.4 mówi wprost, że
 *    wypełnia je człowiek; wpisanie tu zdania wygenerowanego przez system
 *    byłoby zmyśleniem przyczyny. Karta pokazuje wtedy „—", nigdy zera.
 */
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

function formatNumber(value: number | null | undefined, unit?: string | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const text = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 }).format(value);
  return unit ? `${text} ${unit}` : text;
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

  const period = formatDeviationPeriodLabel(periodStart, periodEnd);
  const problem =
    `Odchylenie: ${input.kpiName} ${period} — rezultat ` +
    `${formatNumber(input.actualValue, input.unit)} poza limitem ` +
    `(cel ${formatNumber(input.targetValue, input.unit)}).`;

  const card = await createActionCard(scope, {
    sourceKind: KPI_DEVIATION_SOURCE_KIND,
    sourceId,
    periodStart,
    periodEnd,
    goalMet: false,
    actionRequired: true,
    problem,
    rootCause: '',
    actionText: '',
    ownerUserId: input.kpiOwnerUserId || input.actorUserId,
    dueDate: addDays(periodEnd, KPI_DEVIATION_DUE_DATE_OFFSET_DAYS),
  });

  return { created: true, card, reason: 'created' };
}
