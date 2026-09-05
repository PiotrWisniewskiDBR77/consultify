/**
 * Finance v3 canonical — producent KALENDARZA FISKALNEGO, OKRESÓW i JEDNOSTKI pakietu.
 *
 * Paczka F-M5 (`docs/program/PROGRAM_NAPRAWCZY_20260905/F1_FINANSE_PROGRAM_DOKONCZENIA_20260905.md`,
 * sekcja `## F‑M5`), znalezisko audytu F0 §2.3.
 *
 * PRZYCZYNA (zmierzona na `origin/staging`, 05.09.2026, nie przepisana z audytu):
 *   grep -rn "INSERT INTO finance_stmt_periods"   server/src --include='*.ts' | grep -v __tests__  -> tylko server/src/scripts/baselineContextOpeningPeriodRealDbProof.ts:122
 *   grep -rn "INSERT INTO finance_stmt_calendars" server/src --include='*.ts' | grep -v __tests__  -> tylko server/src/scripts/baselineContextOpeningPeriodRealDbProof.ts:105
 * Czyli: ZERO producentów produkcyjnych. `statementMappingService.ts:259-321` odrzuca każdy
 * wiersz, którego `periodId` nie rozwiązuje się do istniejącego `finance_stmt_periods`, więc bez
 * producenta mapowanie zapisuje 0 linii — stąd „Zmapowane linie 0 / 0" w podglądzie pakietu,
 * a `finance_stmt_calendars/_periods/_entities/_lines` mają na stagingu 0 wierszy w CAŁEJ bazie.
 *
 * CO ROBI. Trzy operacje idempotentne, świadome transakcji wołającego
 * (`getCurrentPgTransactionClient` — ten sam wzorzec, co `analysisDefinitionService`
 * i `lineageService.insertEdge`):
 *   1. `ensureCalendar`   — jeden kalendarz `STANDARD` na organizację (+ opcjonalnie na `entity_code`).
 *   2. `ensurePeriods`    — okresy o typie WYPROWADZONYM Z DANYCH (rozpiętość dat), z łańcuchem
 *                           `previous_period_id` domykanym po każdym przebiegu.
 *   3. `ensureStatementPackEntity` — jednostka sprawozdawcza pakietu (`finance_stmt_entities`),
 *                           bo bez niej `finance_stmt_lines` nie ma `entity_id`, a analiza
 *                           (F-P4) odmawia kodem `SOURCE_PACK_HAS_NO_ENTITIES`.
 * Orkiestrator `ensureStatementPackTemporalContext` składa te trzy w jedno wywołanie używane
 * przez `confirmAndRegisterStatementPack` (ogniwo 1) i przez skrypt backfillu DBR77.
 *
 * ── DECYZJA O `period_type` (§8 paczki — ryzyko rozbicia ogniwa 6) ─────────────────────────
 * Typ okresu NIE jest zgadywany ani wpisany na sztywno: wynika z rozpiętości `period_end -
 * period_start` w sprawozdaniu źródłowym (`derivePeriodShape`): ~12 mies. → `FY`, ~3 mies. → `Q`,
 * ~1 mies. → `MONTH`. Rozpiętość odbiegająca od wzorca dostaje najbliższy typ ORAZ `is_stub=true`
 * z jawnym powodem — nigdy cichego zaokrąglenia.
 *
 * `baselineContextService.ts:505` wymaga, żeby okres otwarcia i WSZYSTKIE okresy prognozy miały
 * `period_type='MONTH'` (`INVALID_CONTEXT_PERIOD`). Sprawozdania roczne dają `FY`, więc gdyby na
 * tym poprzestać, ogniwo 6 nie miałoby ani jednego kandydata na okres otwarcia bilansu. Dlatego
 * dla każdego okresu ROCZNEGO zakładamy dodatkowo okres `MONTH` = OSTATNI MIESIĄC tego roku
 * („okres domknięcia", `ensureClosingMonths`). Jest pusty (żadna linia go nie używa), więc nie
 * pojawia się w analizie — `analysisDefinitionService.loadSourcePeriodIds` liczy okresy przez
 * `finance_stmt_lines`, nie przez tabelę okresów — ale daje ogniwu 6 legalny okres otwarcia
 * na TYM SAMYM kalendarzu, co reszta łańcucha. Łańcuchy `previous_period_id` są rozdzielne per
 * `period_type` (osobne indeksy `uq_finance_stmt_period_fy/_q/_month/_week`), więc miesiące
 * prognozy z paczki F-P2 dokleją się do tego samego łańcucha `MONTH` bez kolizji z `FY`.
 *
 * ── IDEMPOTENCJA ──────────────────────────────────────────────────────────────────────────────
 * Kalendarz: `entity_code` bywa `NULL`, a Postgres traktuje `NULL` w `UNIQUE` jako różne wartości
 * (`uq_finance_stmt_cal_scope` NIE złapałby drugiego kalendarza domyślnego), więc idempotencja
 * stoi na `pg_advisory_xact_lock` + `SELECT` przed `INSERT`-em, a nie na `ON CONFLICT`.
 * Okresy: `SELECT` po kluczu naturalnym (kalendarz, typ, rok, kwartał/miesiąc). Gdy istniejący
 * wiersz ma INNE daty niż żądane, moduł ODMAWIA (`PERIOD_SHAPE_CONFLICT`) zamiast po cichu
 * podstawić cudzy okres pod nowe dane.
 * Jednostka: `ON CONFLICT (business_version_id, entity_code)` — `uq_finance_stmt_entities_version_code`.
 *
 * ── CZEGO NIE ROBI ────────────────────────────────────────────────────────────────────────────
 * Nie kasuje ani nie przesuwa okresów już użytych w krawędziach/kontekstach (wiersze są
 * addytywne — §8 paczki). Nie tworzy okresów, gdy sprawozdanie nie ma dat okresu: wtedy rzuca
 * `FinanceCalendarError('NO_SOURCE_PERIODS')` i transakcja wołającego wycofuje CAŁOŚĆ, łącznie
 * z rejestracją artefaktu. Pakiet bez okresów jest bezużyteczny — lepiej brak pakietu niż pakiet-widmo.
 */

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';
import { getCurrentPgTransactionClient } from '../../../utils/queryHelpers.js';

/** Minimalny kontrakt transakcji, wspólny dla ambient (`withPgTransaction`) i pinned. */
export interface CalendarTxLike {
  queryAll<T>(sql: string, params?: unknown[]): Promise<T[]>;
  queryOne<T>(sql: string, params?: unknown[]): Promise<T | null>;
  queryRun(sql: string, params?: unknown[]): Promise<unknown>;
}

export type FinanceCalendarErrorCode =
  | 'NO_SOURCE_PERIODS'
  | 'INVALID_PERIOD_RANGE'
  | 'PERIOD_SHAPE_CONFLICT'
  | 'CALENDAR_INSERT_FAILED'
  | 'ENTITY_INSERT_FAILED';

export class FinanceCalendarError extends Error {
  constructor(
    public readonly code: FinanceCalendarErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'FinanceCalendarError';
  }
}

export type StatementPeriodType = 'FY' | 'Q' | 'MONTH';

export interface PeriodShape {
  periodType: StatementPeriodType;
  fiscalYear: number;
  fiscalQuarter: number | null;
  fiscalMonth: number | null;
  isStub: boolean;
  stubReason: string | null;
  /** Liczba dni okresu (domknięta obustronnie), użyta do wyprowadzenia typu. */
  spanDays: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(value: string, label: string): Date {
  const iso = String(value || '').slice(0, 10);
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new FinanceCalendarError(
      'INVALID_PERIOD_RANGE',
      `Nieprawidłowa data okresu (${label}): "${value}".`
    );
  }
  return parsed;
}

/** `YYYY-MM-DD` w UTC — bez zależności od strefy czasowej procesu. */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Typ okresu WYPROWADZONY Z DANYCH (rozpiętość dat sprawozdania), nie z konfiguracji.
 * Tolerancje dobrane tak, by objąć realne warianty roku obrotowego (365/366 dni, 52/53 tygodnie,
 * kwartały 89-92 dni, miesiące 28-31 dni). Poza tolerancją: najbliższy typ + `is_stub`.
 */
export function derivePeriodShape(periodStart: string, periodEnd: string): PeriodShape {
  const start = parseDate(periodStart, 'period_start');
  const end = parseDate(periodEnd, 'period_end');
  if (end.getTime() <= start.getTime()) {
    throw new FinanceCalendarError(
      'INVALID_PERIOD_RANGE',
      `Koniec okresu (${periodEnd}) nie jest późniejszy niż początek (${periodStart}).`
    );
  }
  // Domknięcie obustronne: 2024-01-01..2024-12-31 to 366 dni, nie 365.
  const spanDays = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
  const endYear = end.getUTCFullYear();
  const endMonth = end.getUTCMonth() + 1;

  let periodType: StatementPeriodType;
  let exact: boolean;
  if (spanDays >= 300 && spanDays <= 400) {
    periodType = 'FY';
    exact = true;
  } else if (spanDays >= 80 && spanDays <= 100) {
    periodType = 'Q';
    exact = true;
  } else if (spanDays >= 27 && spanDays <= 32) {
    periodType = 'MONTH';
    exact = true;
  } else {
    // Najbliższy wzorzec po logarytmicznej odległości od 30/91/365 dni.
    const candidates: Array<[StatementPeriodType, number]> = [
      ['MONTH', 30],
      ['Q', 91],
      ['FY', 365],
    ];
    periodType = candidates.reduce((best, current) =>
      Math.abs(Math.log(spanDays / current[1])) < Math.abs(Math.log(spanDays / best[1]))
        ? current
        : best
    )[0];
    exact = false;
  }

  return {
    periodType,
    fiscalYear: endYear,
    fiscalQuarter: periodType === 'Q' ? Math.ceil(endMonth / 3) : null,
    fiscalMonth: periodType === 'MONTH' ? endMonth : null,
    isStub: !exact,
    stubReason: exact
      ? null
      : `Rozpiętość ${spanDays} dni nie odpowiada pełnemu okresowi typu ${periodType} — okres oznaczony jako niepełny (stub).`,
    spanDays,
  };
}

export interface EnsureCalendarParams {
  organizationId: string;
  createdBy: string;
  /** `null`/pominięte = kalendarz domyślny organizacji. */
  entityCode?: string | null;
  /** Miesiąc końca roku obrotowego; domyślnie 12 (rok kalendarzowy). */
  fiscalYearEndMonth?: number;
  /** Data obowiązywania kalendarza; domyślnie `1900-01-01` (kalendarz „od zawsze"). */
  effectiveFrom?: string;
}

export interface EnsureCalendarResult {
  fiscalCalendarId: string;
  created: boolean;
}

async function ensureCalendarTx(
  tx: CalendarTxLike,
  params: EnsureCalendarParams
): Promise<EnsureCalendarResult> {
  const entityCode = params.entityCode ?? null;
  const fiscalYearEndMonth = params.fiscalYearEndMonth ?? 12;
  const effectiveFrom = params.effectiveFrom ?? '1900-01-01';

  // `entity_code IS NULL` wyłącza `uq_finance_stmt_cal_scope` (NULL != NULL w UNIQUE),
  // więc wyłączność bierze się z blokady doradczej trzymanej do końca transakcji.
  await tx.queryRun(`SELECT pg_advisory_xact_lock(hashtext(?), hashtext(?))`, [
    params.organizationId,
    `finance_stmt_calendars:${entityCode ?? ''}`,
  ]);

  const existing = await tx.queryOne<{ fiscal_calendar_id: string }>(
    `SELECT fiscal_calendar_id FROM finance_stmt_calendars
      WHERE organization_id = ?
        AND entity_code IS NOT DISTINCT FROM ?
        AND calendar_type = 'STANDARD'
        AND fiscal_year_end_month = ?
      ORDER BY effective_from
      LIMIT 1`,
    [params.organizationId, entityCode, fiscalYearEndMonth]
  );
  if (existing) return { fiscalCalendarId: existing.fiscal_calendar_id, created: false };

  const inserted = await tx.queryOne<{ fiscal_calendar_id: string }>(
    `INSERT INTO finance_stmt_calendars (
       organization_id, entity_code, calendar_type, fiscal_year_end_month,
       fiscal_year_end_reference, effective_from, created_by
     ) VALUES (?, ?, 'STANDARD', ?, 'LAST_DAY_OF_MONTH', ?, ?)
     RETURNING fiscal_calendar_id`,
    [params.organizationId, entityCode, fiscalYearEndMonth, effectiveFrom, params.createdBy]
  );
  if (!inserted) {
    throw new FinanceCalendarError(
      'CALENDAR_INSERT_FAILED',
      'INSERT do finance_stmt_calendars nie zwrócił wiersza.'
    );
  }
  return { fiscalCalendarId: inserted.fiscal_calendar_id, created: true };
}

export interface EnsurePeriodInput {
  /** `YYYY-MM-DD` */
  periodStart: string;
  /** `YYYY-MM-DD`, ostatni dzień okresu (domknięcie obustronne). */
  periodEnd: string;
  /** Etykieta ze sprawozdania; gdy pusta — generowana z typu i roku. */
  label?: string | null;
}

export interface EnsurePeriodsParams {
  organizationId: string;
  fiscalCalendarId: string;
  createdBy: string;
  periods: readonly EnsurePeriodInput[];
  /** Domknięcie miesiąca zamykającego dla okresów rocznych (patrz nagłówek). Domyślnie `true`. */
  withClosingMonths?: boolean;
}

export interface EnsuredPeriod {
  periodId: string;
  periodType: StatementPeriodType;
  fiscalYear: number;
  periodStart: string;
  periodEnd: string;
  label: string;
  created: boolean;
}

export interface EnsurePeriodsResult {
  periods: EnsuredPeriod[];
  createdCount: number;
  /** Ile krawędzi łańcucha `previous_period_id` domknięto w tym przebiegu. */
  chainLinksWritten: number;
}

function defaultLabel(shape: PeriodShape): string {
  if (shape.periodType === 'FY') return `FY${shape.fiscalYear}`;
  if (shape.periodType === 'Q') return `Q${shape.fiscalQuarter}-${shape.fiscalYear}`;
  return `${String(shape.fiscalMonth).padStart(2, '0')}-${shape.fiscalYear}`;
}

/** Ostatni dzień miesiąca, w którym kończy się okres roczny — kandydat na okres otwarcia bilansu. */
function closingMonthOf(period: EnsurePeriodInput): EnsurePeriodInput {
  const end = parseDate(period.periodEnd, 'period_end');
  const year = end.getUTCFullYear();
  const month = end.getUTCMonth();
  const firstDay = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  return {
    periodStart: isoDate(firstDay),
    periodEnd: isoDate(lastDay),
    label: null,
  };
}

async function ensureOnePeriod(
  tx: CalendarTxLike,
  params: { organizationId: string; fiscalCalendarId: string; createdBy: string },
  input: EnsurePeriodInput
): Promise<EnsuredPeriod> {
  const shape = derivePeriodShape(input.periodStart, input.periodEnd);
  const label = String(input.label || '').trim() || defaultLabel(shape);
  const periodStart = String(input.periodStart).slice(0, 10);
  const periodEnd = String(input.periodEnd).slice(0, 10);

  const existing = await tx.queryOne<{
    period_id: string;
    period_start: string;
    period_end: string;
    label: string;
  }>(
    `SELECT period_id, period_start::text AS period_start, period_end::text AS period_end, label
       FROM finance_stmt_periods
      WHERE fiscal_calendar_id = ?
        AND period_type = ?
        AND fiscal_year = ?
        AND fiscal_quarter IS NOT DISTINCT FROM ?
        AND fiscal_month IS NOT DISTINCT FROM ?`,
    [
      params.fiscalCalendarId,
      shape.periodType,
      shape.fiscalYear,
      shape.fiscalQuarter,
      shape.fiscalMonth,
    ]
  );
  if (existing) {
    if (existing.period_start !== periodStart || existing.period_end !== periodEnd) {
      throw new FinanceCalendarError(
        'PERIOD_SHAPE_CONFLICT',
        `Okres ${shape.periodType} ${shape.fiscalYear} istnieje już w tym kalendarzu z innymi datami ` +
          `(${existing.period_start}…${existing.period_end}) niż importowane (${periodStart}…${periodEnd}). ` +
          'Nie podstawiam cudzego okresu pod nowe dane — popraw daty w sprawozdaniu albo załóż osobny kalendarz.'
      );
    }
    return {
      periodId: existing.period_id,
      periodType: shape.periodType,
      fiscalYear: shape.fiscalYear,
      periodStart,
      periodEnd,
      label: existing.label,
      created: false,
    };
  }

  const inserted = await tx.queryOne<{ period_id: string }>(
    `INSERT INTO finance_stmt_periods (
       organization_id, fiscal_calendar_id, period_type, fiscal_year, fiscal_quarter, fiscal_month,
       period_start, period_end, is_stub, stub_reason, label, created_by
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING period_id`,
    [
      params.organizationId,
      params.fiscalCalendarId,
      shape.periodType,
      shape.fiscalYear,
      shape.fiscalQuarter,
      shape.fiscalMonth,
      periodStart,
      periodEnd,
      shape.isStub,
      shape.stubReason,
      label,
      params.createdBy,
    ]
  );
  if (!inserted) {
    throw new FinanceCalendarError(
      'PERIOD_SHAPE_CONFLICT',
      `INSERT do finance_stmt_periods nie zwrócił wiersza dla ${shape.periodType} ${shape.fiscalYear}.`
    );
  }
  return {
    periodId: inserted.period_id,
    periodType: shape.periodType,
    fiscalYear: shape.fiscalYear,
    periodStart,
    periodEnd,
    label,
    created: true,
  };
}

/**
 * Domyka łańcuch `previous_period_id` w obrębie JEDNEGO typu okresu (osobne łańcuchy dla
 * `FY`/`Q`/`MONTH` — tak samo, jak osobne są indeksy jednoznaczności). Idempotentne: zapisuje
 * tylko te krawędzie, które faktycznie odbiegają od porządku po `period_start`.
 */
async function relinkChain(
  tx: CalendarTxLike,
  fiscalCalendarId: string,
  periodType: StatementPeriodType
): Promise<number> {
  const rows = await tx.queryAll<{ period_id: string; previous_period_id: string | null }>(
    `SELECT period_id, previous_period_id FROM finance_stmt_periods
      WHERE fiscal_calendar_id = ? AND period_type = ?
      ORDER BY period_start, period_end`,
    [fiscalCalendarId, periodType]
  );
  let written = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const expectedPrevious = i === 0 ? null : rows[i - 1]!.period_id;
    if ((rows[i]!.previous_period_id ?? null) === expectedPrevious) continue;
    await tx.queryRun(`UPDATE finance_stmt_periods SET previous_period_id = ? WHERE period_id = ?`, [
      expectedPrevious,
      rows[i]!.period_id,
    ]);
    written += 1;
  }
  return written;
}

async function ensurePeriodsTx(
  tx: CalendarTxLike,
  params: EnsurePeriodsParams
): Promise<EnsurePeriodsResult> {
  if (params.periods.length === 0) {
    throw new FinanceCalendarError(
      'NO_SOURCE_PERIODS',
      'Sprawozdanie nie ma ani jednego okresu (period_start/period_end) — nie ma z czego założyć okresów pakietu.'
    );
  }
  // Blokada doradcza na kalendarzu: dwa równoległe importy tej samej organizacji nie mogą
  // przeplatać się w łańcuchu `previous_period_id`.
  await tx.queryRun(`SELECT pg_advisory_xact_lock(hashtext(?), hashtext(?))`, [
    params.organizationId,
    `finance_stmt_periods:${params.fiscalCalendarId}`,
  ]);

  const wanted: EnsurePeriodInput[] = [];
  const seen = new Set<string>();
  const push = (input: EnsurePeriodInput) => {
    const key = `${String(input.periodStart).slice(0, 10)}..${String(input.periodEnd).slice(0, 10)}`;
    if (seen.has(key)) return;
    seen.add(key);
    wanted.push(input);
  };
  for (const period of params.periods) push(period);
  if (params.withClosingMonths !== false) {
    for (const period of params.periods) {
      if (derivePeriodShape(period.periodStart, period.periodEnd).periodType !== 'FY') continue;
      push(closingMonthOf(period));
    }
  }

  const ensured: EnsuredPeriod[] = [];
  for (const input of wanted) {
    ensured.push(await ensureOnePeriod(tx, params, input));
  }

  let chainLinksWritten = 0;
  for (const periodType of new Set(ensured.map((p) => p.periodType))) {
    chainLinksWritten += await relinkChain(tx, params.fiscalCalendarId, periodType);
  }

  return {
    periods: ensured,
    createdCount: ensured.filter((p) => p.created).length,
    chainLinksWritten,
  };
}

export interface EnsureStatementPackEntityParams {
  organizationId: string;
  businessVersionId: string;
  createdBy: string;
  entityCode?: string | null;
  legalName?: string | null;
  functionalCurrency?: string | null;
}

export interface EnsureStatementPackEntityResult {
  entityId: string;
  entityCode: string;
  created: boolean;
}

/** Kod jednostki z nazwy firmy — stabilny klucz naturalny w obrębie wersji pakietu. */
export function entityCodeFromName(name: string | null | undefined): string {
  const normalized = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()
    .slice(0, 40);
  return normalized || 'ENTITY';
}

async function ensureStatementPackEntityTx(
  tx: CalendarTxLike,
  params: EnsureStatementPackEntityParams
): Promise<EnsureStatementPackEntityResult> {
  const entityCode = String(params.entityCode || '').trim() || entityCodeFromName(params.legalName);
  const legalName = String(params.legalName || '').trim() || entityCode;
  const currency = String(params.functionalCurrency || '').trim().toUpperCase() || 'PLN';

  const inserted = await tx.queryOne<{ id: string }>(
    `INSERT INTO finance_stmt_entities (
       organization_id, business_version_id, entity_code, legal_name, role,
       consolidation_method, ownership_pct, functional_currency, created_by
     ) VALUES (?, ?, ?, ?, 'GROUP_PARENT', 'FULL', 100, ?, ?)
     ON CONFLICT ON CONSTRAINT uq_finance_stmt_entities_version_code DO NOTHING
     RETURNING id`,
    [params.organizationId, params.businessVersionId, entityCode, legalName, currency, params.createdBy]
  );
  if (inserted) return { entityId: inserted.id, entityCode, created: true };

  const existing = await tx.queryOne<{ id: string }>(
    `SELECT id FROM finance_stmt_entities WHERE business_version_id = ? AND entity_code = ?`,
    [params.businessVersionId, entityCode]
  );
  if (!existing) {
    throw new FinanceCalendarError(
      'ENTITY_INSERT_FAILED',
      `Nie udało się założyć ani odczytać jednostki "${entityCode}" dla wersji ${params.businessVersionId}.`
    );
  }
  return { entityId: existing.id, entityCode, created: false };
}

export interface StatementPackTemporalContextParams {
  organizationId: string;
  businessVersionId: string;
  createdBy: string;
  /** Okresy ze sprawozdań pakietu — muszą być co najmniej jeden, inaczej odmowa bez zapisu. */
  periods: readonly EnsurePeriodInput[];
  entityName?: string | null;
  entityCode?: string | null;
  currency?: string | null;
  fiscalYearEndMonth?: number;
  withClosingMonths?: boolean;
}

export interface StatementPackTemporalContext {
  fiscalCalendarId: string;
  calendarCreated: boolean;
  periods: EnsuredPeriod[];
  periodsCreated: number;
  chainLinksWritten: number;
  entityId: string;
  entityCode: string;
  entityCreated: boolean;
}

async function ensureContextTx(
  tx: CalendarTxLike,
  params: StatementPackTemporalContextParams
): Promise<StatementPackTemporalContext> {
  if (!params.periods || params.periods.length === 0) {
    throw new FinanceCalendarError(
      'NO_SOURCE_PERIODS',
      'Pakiet nie ma ani jednego sprawozdania z okresem — odmawiam rejestracji pakietu bez okresów.'
    );
  }
  const calendar = await ensureCalendarTx(tx, {
    organizationId: params.organizationId,
    createdBy: params.createdBy,
    fiscalYearEndMonth: params.fiscalYearEndMonth,
  });
  const periods = await ensurePeriodsTx(tx, {
    organizationId: params.organizationId,
    fiscalCalendarId: calendar.fiscalCalendarId,
    createdBy: params.createdBy,
    periods: params.periods,
    withClosingMonths: params.withClosingMonths,
  });
  const entity = await ensureStatementPackEntityTx(tx, {
    organizationId: params.organizationId,
    businessVersionId: params.businessVersionId,
    createdBy: params.createdBy,
    entityCode: params.entityCode,
    legalName: params.entityName,
    functionalCurrency: params.currency,
  });
  return {
    fiscalCalendarId: calendar.fiscalCalendarId,
    calendarCreated: calendar.created,
    periods: periods.periods,
    periodsCreated: periods.createdCount,
    chainLinksWritten: periods.chainLinksWritten,
    entityId: entity.entityId,
    entityCode: entity.entityCode,
    entityCreated: entity.created,
  };
}

/** Adapter: pracuj w transakcji wołającego, jeśli jest; inaczej otwórz własną. */
async function inTransaction<T>(fn: (tx: CalendarTxLike) => Promise<T>): Promise<T> {
  const ambient = getCurrentPgTransactionClient();
  if (ambient) {
    return fn({
      queryAll: async <T2>(sql: string, queryParams: unknown[] = []) =>
        (await ambient.query<T2>(sql, queryParams)).rows,
      queryOne: async <T2>(sql: string, queryParams: unknown[] = []) =>
        (await ambient.query<T2>(sql, queryParams)).rows[0] ?? null,
      queryRun: async (sql: string, queryParams: unknown[] = []) =>
        ambient.query(sql, queryParams),
    });
  }
  return withPinnedPostgresTransaction((tx) =>
    fn({
      queryAll: <T2>(sql: string, queryParams: unknown[] = []) =>
        tx.queryAll<T2 & Record<string, unknown>>(sql, queryParams),
      queryOne: <T2>(sql: string, queryParams: unknown[] = []) =>
        tx.queryOne<T2 & Record<string, unknown>>(sql, queryParams),
      queryRun: (sql: string, queryParams: unknown[] = []) => tx.queryRun(sql, queryParams),
    })
  );
}

/** Kalendarz fiskalny organizacji (idempotentnie). */
export async function ensureCalendar(
  params: EnsureCalendarParams
): Promise<EnsureCalendarResult> {
  return inTransaction((tx) => ensureCalendarTx(tx, params));
}

/** Okresy o typie wyprowadzonym z danych + domknięty łańcuch `previous_period_id`. */
export async function ensurePeriods(params: EnsurePeriodsParams): Promise<EnsurePeriodsResult> {
  return inTransaction((tx) => ensurePeriodsTx(tx, params));
}

/** Jednostka sprawozdawcza pakietu (`finance_stmt_entities`) — idempotentnie. */
export async function ensureStatementPackEntity(
  params: EnsureStatementPackEntityParams
): Promise<EnsureStatementPackEntityResult> {
  return inTransaction((tx) => ensureStatementPackEntityTx(tx, params));
}

/**
 * Ogniwo 1: kalendarz + okresy + jednostka dla pakietu sprawozdań, w JEDNEJ transakcji
 * (własnej albo wołającego). Odmawia bez zapisu, gdy pakiet nie ma okresów.
 */
export async function ensureStatementPackTemporalContext(
  params: StatementPackTemporalContextParams
): Promise<StatementPackTemporalContext> {
  return inTransaction((tx) => ensureContextTx(tx, params));
}

export interface LegacyStatementPeriodRow {
  period_start: string | null;
  period_end: string | null;
  period_label: string | null;
  entity_name: string | null;
  currency: string | null;
}

/**
 * Okresy pakietu odczytane z toru legacy (`financial_statements` powiązane z pakietem).
 * To jedyne miejsce, w którym ogniwo 1 dowiaduje się, JAKIE okresy zawiera sprawozdanie —
 * nie zgaduje ich z dat utworzenia ani z nazwy pliku.
 */
export async function readLegacyPackPeriods(
  tx: CalendarTxLike,
  organizationId: string,
  statementPackId: string
): Promise<LegacyStatementPeriodRow[]> {
  return tx.queryAll<LegacyStatementPeriodRow>(
    `SELECT DISTINCT period_start::text AS period_start, period_end::text AS period_end,
            period_label, entity_name, currency
       FROM financial_statements
      WHERE organization_id = ? AND statement_pack_id = ?
        AND COALESCE(status, 'draft') <> 'archived'
        AND period_start IS NOT NULL AND period_end IS NOT NULL
      ORDER BY period_start`,
    [organizationId, statementPackId]
  );
}
