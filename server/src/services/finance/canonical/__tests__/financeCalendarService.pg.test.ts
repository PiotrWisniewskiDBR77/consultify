/**
 * F-M5 (ogniwo 1) — `financeCalendarService` wpięty w `confirmAndRegisterStatementPack`.
 * Test na REALNYM PostgreSQL; ta sama bramka, co reszta suit `.pg.test.ts` w tym katalogu
 * (`RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=postgres…`). Bez bramki cały
 * `describe` jest `skipped` — NIGDY `passed`.
 *
 * Dlaczego TYLKO Postgres: cały sens tej paczki stoi na CHECK-ach i indeksach częściowych, których
 * atrapa bazy nie zna (`chk_finance_stmt_period_*_shape`, `uq_finance_stmt_period_fy/_month`,
 * trigger `finance_stmt_period_check_week_calendar`, `pg_advisory_xact_lock`). Zieleń na sqlite
 * nie znaczyłaby nic.
 *
 * ZABEZPIECZENIE, w które celuje mutacja (a nie mechanizm rejestracji):
 *   „pakiet bez okresów jest bezużyteczny" — `statementMappingService.ts:259-321` odrzuca każdą
 *   linię, której `periodId` nie rozwiązuje się do wiersza `finance_stmt_periods`, a
 *   `analysisDefinitionService` odmawia kodem `SOURCE_PACK_HAS_NO_PERIODS`.
 * Dowód mutacyjny (wykonany, opisany w raporcie paczki): usunięcie wywołania `ensurePeriods`
 * z `ensureStatementPackTemporalContext` wywraca testy 1-5 i 7, MIMO że artefakt kanoniczny
 * i alias dalej powstają (test 6 to pokazuje wprost).
 *
 * Wszystkie odczyty sprawdzające idą OSOBNYM klientem `pg` („na zimno"), nie przez wartość
 * zwróconą z serwisu.
 */
import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const connectionString = process.env.DATABASE_URL || '';
const realPg =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  connectionString.startsWith('postgres');
if (realPg) process.env.DB_TYPE = 'postgres';

describe.skipIf(!realPg)('F-M5 financeCalendarService — realny PostgreSQL', () => {
  const pool = new Pool({ connectionString });
  const ownedOrganizations: string[] = [];

  let confirmAndRegisterStatementPack: typeof import('../statementPackRegistrationService.js').confirmAndRegisterStatementPack;
  let derivePeriodShape: typeof import('../financeCalendarService.js').derivePeriodShape;

  const readiness = {
    readinessStatus: 'ready' as const,
    readinessScore: 100,
    summary: 'Ready for canonical registration.',
    reasonCodes: [] as string[],
    eligibleLineCount: 1,
    mappedLineCount: 1,
    unmappedLineCount: 0,
    nonFinancialLineCount: 0,
    hardFailCount: 0,
    warningCount: 0,
    isReady: true,
  };

  interface PeriodSpec {
    periodStart: string;
    periodEnd: string;
    periodLabel: string;
  }

  const FY2023: PeriodSpec = {
    periodStart: '2023-01-01',
    periodEnd: '2023-12-31',
    periodLabel: '2023',
  };
  const FY2024: PeriodSpec = {
    periodStart: '2024-01-01',
    periodEnd: '2024-12-31',
    periodLabel: '2024',
  };
  const FY2025: PeriodSpec = {
    periodStart: '2025-01-01',
    periodEnd: '2025-12-31',
    periodLabel: '2025',
  };

  async function seedOrganization(): Promise<string> {
    const organizationId = `org-fm5-${randomUUID()}`;
    ownedOrganizations.push(organizationId);
    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
      organizationId,
      'F-M5 realPG fixture',
    ]);
    return organizationId;
  }

  /** Sprawozdanie legacy w kształcie, jaki produkuje kreator importu (status `mapped`). */
  async function seedStatement(
    organizationId: string,
    statementType: 'P&L' | 'BS' | 'CF',
    period: PeriodSpec | null,
    entityName = 'DBR77 Sp. z o.o.'
  ): Promise<string> {
    const statementId = `stmt-fm5-${randomUUID()}`;
    await pool.query(
      `INSERT INTO financial_statements
         (id, organization_id, entity_name, statement_type, period_start, period_end,
          period_label, currency, scaling, status, validation_status, readiness_status,
          readiness_score, quality_summary, quality_reason_codes)
       VALUES ($1, $2, $3, $4, $5::date, $6::date, $7, 'PLN', 'units', 'mapped', 'pass',
               'ready', 100, 'ready', '[]')`,
      [
        statementId,
        organizationId,
        entityName,
        statementType,
        period ? period.periodStart : '1900-01-01',
        period ? period.periodEnd : '1900-12-31',
        period ? period.periodLabel : null,
      ]
    );
    if (!period) {
      // „Sprawozdanie bez okresu" jako NULL jest w torze legacy NIEOSIĄGALNE —
      // `financial_statements.period_start/period_end` są NOT NULL (migracja
      // `20260316_financial_statement_packs.sql:46-47`). Osiągalny kształt tego samego defektu
      // to okres BEZSENSOWNY: parser wpisał ten sam dzień jako początek i koniec.
      await pool.query(
        `UPDATE financial_statements SET period_start = DATE '2025-01-01',
                period_end = DATE '2025-01-01', period_label = NULL WHERE id = $1`,
        [statementId]
      );
    }
    return statementId;
  }

  function register(params: {
    organizationId: string;
    statementId: string;
    userId?: string;
  }) {
    return confirmAndRegisterStatementPack({
      organizationId: params.organizationId,
      statementId: params.statementId,
      userId: params.userId ?? `user-fm5-${randomUUID()}`,
      statement: { extraction_strategy: 'manual_confirmation' },
      values: [],
      validations: [],
      readiness,
    });
  }

  /** Odczyt na zimno — osobny klient `pg`, po fakcie, nie wartość z serwisu. */
  async function coldCount(table: string, organizationId: string): Promise<number> {
    const result = await pool.query<{ count: string }>(
      `SELECT count(*) AS count FROM ${table} WHERE organization_id = $1`,
      [organizationId]
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async function coldPeriods(organizationId: string) {
    const result = await pool.query<{
      period_id: string;
      period_type: string;
      fiscal_year: number;
      fiscal_month: number | null;
      period_start: string;
      period_end: string;
      previous_period_id: string | null;
      label: string;
      is_stub: boolean;
    }>(
      `SELECT period_id, period_type, fiscal_year, fiscal_month,
              period_start::text AS period_start, period_end::text AS period_end,
              previous_period_id, label, is_stub
         FROM finance_stmt_periods WHERE organization_id = $1
        ORDER BY period_type, period_start`,
      [organizationId]
    );
    return result.rows;
  }

  beforeAll(async () => {
    ({ confirmAndRegisterStatementPack } = await import('../statementPackRegistrationService.js'));
    ({ derivePeriodShape } = await import('../financeCalendarService.js'));
  });

  afterAll(async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL session_replication_role = replica`);
      for (const organizationId of ownedOrganizations) {
        const artifacts = await client.query<{ artifact_id: string }>(
          `SELECT artifact_id FROM finance_artifacts WHERE organization_id = $1`,
          [organizationId]
        );
        await client.query(`DELETE FROM finance_artifact_aliases WHERE organization_id = $1`, [
          organizationId,
        ]);
        for (const { artifact_id } of artifacts.rows) {
          await client.query(`DELETE FROM artifact_lifecycle_events WHERE artifact_id = $1`, [
            artifact_id,
          ]);
          await client.query(`DELETE FROM finance_working_revisions WHERE artifact_id = $1`, [
            artifact_id,
          ]);
          await client.query(`DELETE FROM finance_business_versions WHERE artifact_id = $1`, [
            artifact_id,
          ]);
          await client.query(`DELETE FROM finance_artifacts WHERE artifact_id = $1`, [artifact_id]);
        }
        await client.query(`DELETE FROM finance_stmt_lines WHERE organization_id = $1`, [
          organizationId,
        ]);
        await client.query(`DELETE FROM finance_stmt_entities WHERE organization_id = $1`, [
          organizationId,
        ]);
        await client.query(`DELETE FROM finance_stmt_periods WHERE organization_id = $1`, [
          organizationId,
        ]);
        await client.query(`DELETE FROM finance_stmt_calendars WHERE organization_id = $1`, [
          organizationId,
        ]);
        await client.query(`DELETE FROM financial_statement_packs WHERE organization_id = $1`, [
          organizationId,
        ]);
        await client.query(`DELETE FROM financial_statements WHERE organization_id = $1`, [
          organizationId,
        ]);
        const residue = await client.query<{ count: number }>(
          `SELECT (
             (SELECT count(*) FROM finance_artifacts WHERE organization_id = $1) +
             (SELECT count(*) FROM finance_stmt_calendars WHERE organization_id = $1) +
             (SELECT count(*) FROM finance_stmt_periods WHERE organization_id = $1) +
             (SELECT count(*) FROM finance_stmt_entities WHERE organization_id = $1) +
             (SELECT count(*) FROM financial_statements WHERE organization_id = $1)
           )::int AS count`,
          [organizationId]
        );
        expect(residue.rows[0]?.count).toBe(0);
        await client.query(`DELETE FROM organizations WHERE id = $1`, [organizationId]);
      }
      await client.query(`SET LOCAL session_replication_role = origin`);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    await pool.end();
  });

  it('1. potwierdzenie importu zakłada DOKŁADNIE JEDEN kalendarz organizacji', async () => {
    const organizationId = await seedOrganization();
    const first = await register({
      organizationId,
      statementId: await seedStatement(organizationId, 'P&L', FY2025),
    });
    expect(first.temporalContext.calendarCreated).toBe(true);
    // Drugie sprawozdanie tej samej organizacji (inny pakiet) NIE zakłada drugiego kalendarza.
    const second = await register({
      organizationId,
      statementId: await seedStatement(organizationId, 'BS', FY2024),
    });
    expect(second.temporalContext.calendarCreated).toBe(false);
    expect(second.temporalContext.fiscalCalendarId).toBe(first.temporalContext.fiscalCalendarId);
    expect(await coldCount('finance_stmt_calendars', organizationId)).toBe(1);
  });

  it('2. liczba okresów odpowiada okresom sprawozdania, a łańcuch previous_period_id jest ciągły', async () => {
    const organizationId = await seedOrganization();
    for (const period of [FY2023, FY2024, FY2025]) {
      await register({
        organizationId,
        statementId: await seedStatement(organizationId, 'P&L', period),
      });
    }
    const periods = await coldPeriods(organizationId);
    const fy = periods.filter((p) => p.period_type === 'FY');
    // Trzy lata sprawozdań => trzy okresy FY (i ani jednego więcej).
    expect(fy.map((p) => p.fiscal_year)).toEqual([2023, 2024, 2025]);
    // Łańcuch: pierwszy bez poprzednika, każdy kolejny wskazuje bezpośrednio poprzedni.
    expect(fy[0]!.previous_period_id).toBeNull();
    expect(fy[1]!.previous_period_id).toBe(fy[0]!.period_id);
    expect(fy[2]!.previous_period_id).toBe(fy[1]!.period_id);
    // Etykieta ze sprawozdania, nie wygenerowana.
    expect(fy.map((p) => p.label)).toEqual(['2023', '2024', '2025']);
  });

  it('3. period_type jest WYPROWADZONY Z DANYCH, a rok roczny dostaje miesiąc domknięcia (kontrakt ogniwa 6)', async () => {
    const organizationId = await seedOrganization();
    await register({
      organizationId,
      statementId: await seedStatement(organizationId, 'P&L', FY2025),
    });
    await register({
      organizationId,
      statementId: await seedStatement(organizationId, 'BS', {
        periodStart: '2025-07-01',
        periodEnd: '2025-09-30',
        periodLabel: 'Q3 2025',
      }),
    });
    const periods = await coldPeriods(organizationId);
    const byType = new Map(periods.map((p) => [`${p.period_type}:${p.fiscal_year}`, p]));

    // Rozpiętość 12 miesięcy => FY; 3 miesiące => Q; oba bez flagi stub.
    expect(byType.get('FY:2025')?.period_start).toBe('2025-01-01');
    expect(byType.get('FY:2025')?.is_stub).toBe(false);
    expect(byType.get('Q:2025')?.period_start).toBe('2025-07-01');
    expect(byType.get('Q:2025')?.is_stub).toBe(false);

    // `baselineContextService.ts:505` wymaga period_type='MONTH' dla okresu otwarcia bilansu.
    // Rok obrotowy dostaje więc miesiąc domknięcia (grudzień) na TYM SAMYM kalendarzu.
    const month = periods.filter((p) => p.period_type === 'MONTH');
    expect(month).toHaveLength(1);
    expect(month[0]!.fiscal_month).toBe(12);
    expect(month[0]!.period_start).toBe('2025-12-01');
    expect(month[0]!.period_end).toBe('2025-12-31');
    expect(month[0]!.fiscal_calendar_id ?? null).not.toBe(undefined);

    // Czysta funkcja wyprowadzania typu — bez bazy, dla jasności kontraktu.
    expect(derivePeriodShape('2025-01-01', '2025-12-31').periodType).toBe('FY');
    expect(derivePeriodShape('2025-07-01', '2025-09-30').periodType).toBe('Q');
    expect(derivePeriodShape('2025-03-01', '2025-03-31').periodType).toBe('MONTH');
    // Rozpiętość poza wzorcem: najbliższy typ + jawna flaga stub, nigdy ciche zaokrąglenie.
    const stub = derivePeriodShape('2025-01-01', '2025-08-31');
    expect(stub.periodType).toBe('FY');
    expect(stub.isStub).toBe(true);
    expect(stub.stubReason).toContain('243');
  });

  it('4. powtórne potwierdzenie tego samego sprawozdania NIE tworzy drugiego kompletu', async () => {
    const organizationId = await seedOrganization();
    const statementId = await seedStatement(organizationId, 'P&L', FY2025);
    await register({ organizationId, statementId });
    const afterFirst = {
      calendars: await coldCount('finance_stmt_calendars', organizationId),
      periods: await coldCount('finance_stmt_periods', organizationId),
      entities: await coldCount('finance_stmt_entities', organizationId),
    };
    const replay = await register({ organizationId, statementId });
    expect(replay.replayed).toBe(true);
    expect(replay.temporalContext.periodsCreated).toBe(0);
    expect(replay.temporalContext.calendarCreated).toBe(false);
    expect(replay.temporalContext.entityCreated).toBe(false);
    expect({
      calendars: await coldCount('finance_stmt_calendars', organizationId),
      periods: await coldCount('finance_stmt_periods', organizationId),
      entities: await coldCount('finance_stmt_entities', organizationId),
    }).toEqual(afterFirst);
  });

  it('5. pakiet dostaje JEDNOSTKĘ sprawozdawczą związaną z wersją biznesową', async () => {
    const organizationId = await seedOrganization();
    const result = await register({
      organizationId,
      statementId: await seedStatement(organizationId, 'P&L', FY2025, 'DBR77 Sp. z o.o.'),
    });
    const entities = await pool.query<{
      id: string;
      entity_code: string;
      legal_name: string;
      business_version_id: string;
      functional_currency: string;
    }>(
      `SELECT id, entity_code, legal_name, business_version_id, functional_currency
         FROM finance_stmt_entities WHERE organization_id = $1`,
      [organizationId]
    );
    expect(entities.rows).toHaveLength(1);
    expect(entities.rows[0]!.business_version_id).toBe(result.businessVersionId);
    expect(entities.rows[0]!.entity_code).toBe('DBR77_SP_Z_O_O');
    expect(entities.rows[0]!.legal_name).toBe('DBR77 Sp. z o.o.');
    expect(entities.rows[0]!.functional_currency).toBe('PLN');
    expect(result.temporalContext.entityId).toBe(entities.rows[0]!.id);
  });

  it('6. KONTROLA NEGATYWNA: sprawozdanie bez użytecznego okresu => odmowa i ZERO zapisu (także artefaktu)', async () => {
    const organizationId = await seedOrganization();
    const statementId = await seedStatement(organizationId, 'P&L', null);
    await expect(register({ organizationId, statementId })).rejects.toThrow(
      /nie jest późniejszy niż początek|ani jednego sprawozdania z okresem/
    );
    // Transakcja wycofuje CAŁOŚĆ: nie ma okresów, ale nie ma też artefaktu kanonicznego
    // ani potwierdzenia w torze legacy. To jest właśnie zabezpieczenie, w które celuje mutacja.
    expect(await coldCount('finance_stmt_periods', organizationId)).toBe(0);
    expect(await coldCount('finance_stmt_calendars', organizationId)).toBe(0);
    expect(await coldCount('finance_stmt_entities', organizationId)).toBe(0);
    expect(await coldCount('finance_artifacts', organizationId)).toBe(0);
    const statement = await pool.query<{ status: string }>(
      `SELECT status FROM financial_statements WHERE id = $1`,
      [statementId]
    );
    expect(statement.rows[0]?.status).toBe('mapped');
  });

  it('7. okresy są UŻYWALNE: linia kanoniczna wpina się w okres pakietu (koniec „0 / 0")', async () => {
    const organizationId = await seedOrganization();
    const result = await register({
      organizationId,
      statementId: await seedStatement(organizationId, 'P&L', FY2025),
    });
    const fyPeriod = (await coldPeriods(organizationId)).find((p) => p.period_type === 'FY');
    expect(fyPeriod).toBeTruthy();
    const canonicalLine = await pool.query<{ id: string }>(
      `SELECT id FROM financial_statement_lines
        WHERE line_code = 'REVENUE' AND organization_id IS NULL LIMIT 1`
    );
    expect(canonicalLine.rows[0]).toBeTruthy();
    await pool.query(
      `INSERT INTO finance_stmt_lines (
         organization_id, business_version_id, statement_type, canonical_line_id, entity_id, period_id,
         accumulation_basis, consolidation_scope, value_status, value_decimal, native_currency,
         presentation_currency, unit, sign_convention, accounting_policy, created_by
       ) VALUES ($1, $2, 'P&L', $3, $4, $5, 'FULL_YEAR', 'CONSOLIDATED', 'PRESENT_NONZERO',
                 182000000, 'PLN', 'PLN', 'UNITS', 'NATURAL', 'IFRS', 'test')`,
      [
        organizationId,
        result.businessVersionId,
        canonicalLine.rows[0]!.id,
        result.temporalContext.entityId,
        fyPeriod!.period_id,
      ]
    );
    const packPeriods = await pool.query<{ count: string }>(
      `SELECT count(DISTINCT period_id) AS count FROM finance_stmt_lines WHERE business_version_id = $1`,
      [result.businessVersionId]
    );
    expect(Number(packPeriods.rows[0]!.count)).toBe(1);
  });
});
