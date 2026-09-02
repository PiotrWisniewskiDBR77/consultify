/**
 * Dyżur 279 — DOWÓD NA REALNEJ BAZIE (bez vitest, bez atrap).
 *
 * Powód osobnego skryptu: `tests/setup.ts:858-896` globalnie podmienia
 * `global.fetch` i mockuje SDK, a `NODE_ENV=test` bez `RUN_DB_TESTS=1`
 * podstawia atrapę bazy pod `DbPromise` (`Database.ts:81-84`) — pomiar przez
 * vitest mógłby dać fałszywy sukces. Ten skrypt startuje REALNY router
 * `financeV2Router` na realnym porcie HTTP i czyta wyniki DWOMA niezależnymi
 * drogami: (1) produkcyjną trasą GET, (2) osobną pulą `pg.Pool` („odczyt na
 * zimno"), bo `Database.ts:686` zwraca `changes:1` dla każdego UPDATE-a,
 * także takiego, który nie trafił w żaden wiersz.
 *
 * Uruchomienie (porty dyżuru 279):
 *   CI=true DB_TYPE=postgres MOCK_DB=false \
 *   DATABASE_URL=postgres://consultify:consultify@127.0.0.1:6262/consultify \
 *   npx tsx server/src/scripts/baselineContextOpeningPeriodRealDbProof.ts
 */
import { randomUUID } from 'node:crypto';

import express from 'express';
import { Pool } from 'pg';

type Json = Record<string, any>;

const PORT = Number(process.env.PROOF_PORT || 5255);
const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
if (!CONNECTION_STRING.startsWith('postgres')) {
  throw new Error('DATABASE_URL musi wskazywać realny Postgres');
}
if (process.env.MOCK_DB === 'true') throw new Error('MOCK_DB=true — atrapa bazy, przerywam');
if (process.env.NODE_ENV === 'test' && process.env.RUN_DB_TESTS !== '1') {
  throw new Error('NODE_ENV=test bez RUN_DB_TESTS=1 podstawia atrapę bazy — przerywam');
}

const results: Array<{ nr: string; opis: string; wynik: string; ok: boolean }> = [];
function check(nr: string, opis: string, ok: boolean, wynik: string): void {
  results.push({ nr, opis, wynik, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${nr} — ${opis}\n      ${wynik}`);
}

const orgId = `org-d279-${randomUUID()}`;
const userId = `user-d279-${randomUUID()}`;

async function main(): Promise<void> {
  const { withPinnedPostgresTransaction } = await import('../database/PostgresDatabase.js');
  const financeV2Router = (await import('../routes/v8/finance-v2/index.js')).default;

  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = { id: userId, organizationId: orgId, role: 'finance_admin' };
    req.v8Context = { organizationId: orgId, userId, userRole: 'finance_admin' };
    next();
  });
  app.use('/api/v8/finance-v2', financeV2Router);
  // `Gateway.ts` nie ma error middleware (jest w `index.ts:1747`) — bez tego
  // każda przyczyna 500 ginęła w pustej odpowiedzi.
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error('[proof] błąd trasy:', err?.stack || err);
    res.status(500).json({ error: String(err?.message || err) });
  });
  const server = app.listen(PORT);
  await new Promise<void>((r) => server.once('listening', () => r()));
  const base = `http://127.0.0.1:${PORT}/api/v8/finance-v2`;

  // Osobna, niezależna pula — „odczyt na zimno" nie przez kod produkcyjny.
  const coldPool = new Pool({ connectionString: CONNECTION_STRING });

  const api = async (
    method: string,
    path: string,
    body?: unknown,
    headers?: Record<string, string>
  ): Promise<{ status: number; body: Json }> => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(headers ?? {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : {} };
  };

  try {
    // ── FIXTURE ────────────────────────────────────────────────────────────
    await withPinnedPostgresTransaction(async (tx) => {
      await tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [
        orgId,
        'Dyzur 279 proof org',
      ]);
      await tx.queryRun(
        `INSERT INTO users (id, email, password, first_name, last_name, role, organization_id)
         VALUES (?, ?, 'proof', 'Dyzur', '279', 'ADMIN', ?)`,
        [userId, `${userId}@example.test`, orgId]
      );
      await tx.queryRun(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES (?, ?, ?, 'ADMIN', 'ACTIVE')`,
        [randomUUID(), orgId, userId]
      );
    });

    const cal = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ fiscal_calendar_id: string }>(
        `INSERT INTO finance_stmt_calendars (organization_id, calendar_type, fiscal_year_end_month, fiscal_year_end_reference, effective_from, created_by)
         VALUES (?, 'STANDARD', 12, 'LAST_DAY_OF_MONTH', '2024-01-01', ?) RETURNING fiscal_calendar_id`,
        [orgId, userId]
      )
    );
    const calendarId = cal!.fiscal_calendar_id;

    async function insertPeriod(o: {
      year: number;
      month: number;
      start: string;
      end: string;
      label: string;
      previous?: string | null;
    }): Promise<string> {
      const row = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ period_id: string }>(
          `INSERT INTO finance_stmt_periods (organization_id, fiscal_calendar_id, period_type, fiscal_year, fiscal_month, period_start, period_end, label, previous_period_id, created_by)
           VALUES (?, ?, 'MONTH', ?, ?, ?, ?, ?, ?, ?) RETURNING period_id`,
          [orgId, calendarId, o.year, o.month, o.start, o.end, o.label, o.previous ?? null, userId]
        )
      );
      return row!.period_id;
    }

    // Okres OTWARCIA — etykieta „12/2025" istnieje WYŁĄCZNIE w bazie.
    const openingPeriodId = await insertPeriod({
      year: 2025,
      month: 12,
      start: '2025-12-01',
      end: '2025-12-31',
      label: '12/2025',
    });
    // Okres HISTORYCZNY spoza prognozy i różny od otwarcia — zakotwiczenie
    // `base_period_id` może wskazywać dowolny okres pakietu sprawozdań.
    const anchorPeriodId = await insertPeriod({
      year: 2025,
      month: 11,
      start: '2025-11-01',
      end: '2025-11-30',
      label: '11/2025',
    });
    const forecastPeriodIds: string[] = [];
    for (let m = 1; m <= 3; m++) {
      forecastPeriodIds.push(
        await insertPeriod({
          year: 2026,
          month: m,
          start: `2026-0${m}-01`,
          end: new Date(Date.UTC(2026, m, 0)).toISOString().slice(0, 10),
          label: `0${m}/2026`,
          previous: forecastPeriodIds.at(-1) ?? openingPeriodId,
        })
      );
    }

    const stmt = await api('POST', '/artifacts', { artifactType: 'STATEMENT_PACK' });
    const stmtBvId = stmt.body?.data?.currentBusinessVersion?.businessVersionId as string;
    if (!stmtBvId) throw new Error(`POST /artifacts STATEMENT_PACK: ${JSON.stringify(stmt)}`);

    const entRow = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ id: string }>(
        `INSERT INTO finance_stmt_entities (organization_id, business_version_id, entity_code, legal_name, role, consolidation_method, ownership_pct, functional_currency, created_by)
         VALUES (?, ?, ?, ?, 'GROUP_PARENT', 'NOT_CONSOLIDATED', NULL, 'PLN', ?) RETURNING id`,
        [orgId, stmtBvId, `D279-${randomUUID().slice(0, 8)}`, 'Dyzur 279 sp. z o.o.', userId]
      )
    );
    const entityId = entRow!.id;

    const cashLine = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ id: string }>(
        `SELECT id FROM financial_statement_lines WHERE line_code = 'CASH' AND organization_id IS NULL LIMIT 1`
      )
    );
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(
        `INSERT INTO finance_stmt_lines (id, organization_id, business_version_id, statement_type, canonical_line_id, entity_id, period_id, value_status, value_decimal, native_currency, presentation_currency, unit, accounting_policy, created_by)
         VALUES (?, ?, ?, 'BS', ?, ?, ?, 'PRESENT_NONZERO', 11000000, 'PLN', 'PLN', 'UNITS', 'IFRS', ?)`,
        [randomUUID(), orgId, stmtBvId, cashLine!.id, entityId, openingPeriodId, userId]
      )
    );

    const analysis = await api('POST', '/artifacts', { artifactType: 'HISTORICAL_ANALYSIS' });
    const analysisBvId = analysis.body?.data?.currentBusinessVersion?.businessVersionId as string;
    const baseline = await api('POST', '/artifacts', { artifactType: 'BASELINE_MODEL' });
    const bvId = baseline.body?.data?.currentBusinessVersion?.businessVersionId as string;
    if (!analysisBvId || !bvId) throw new Error('POST /artifacts (analysis/baseline) nie zwrócił BV');

    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(
        `INSERT INTO finance_baseline_models (id, organization_id, business_version_id, horizon_months, horizon_rationale, horizon_rationale_note, circularity_max_iterations, circularity_tolerance_currency, interest_income_on_cash_modeled, mandatory_contractual_cash_sweep_modeled, created_by)
         VALUES (?, ?, ?, 3, 'DEBT_MATURITY', 'Dyzur 279 proof horizon', 50, 1, false, true, ?)`,
        [randomUUID(), orgId, bvId, userId]
      )
    );
    await withPinnedPostgresTransaction(async (tx) => {
      await tx.queryRun(`SET LOCAL session_replication_role = replica`);
      await tx.queryRun(
        `UPDATE finance_business_versions SET status = 'APPROVED', approved_by = ?, approved_at = now()
          WHERE organization_id = ? AND business_version_id IN (?, ?)`,
        [userId, orgId, stmtBvId, analysisBvId]
      );
      await tx.queryRun(`SET LOCAL session_replication_role = origin`);
      await tx.queryRun(
        `INSERT INTO finance_lineage_edges
           (id, organization_id, source_version_id, source_artifact_type, target_version_id, target_artifact_type, edge_type, transformation_kind, assumption_snapshot_hash, author_id)
         VALUES
           (?, ?, ?, 'STATEMENT_PACK', ?, 'BASELINE_MODEL', 'STATEMENT_TO_MODEL', 'COMPUTE', NULL, ?),
           (?, ?, ?, 'STATEMENT_PACK', ?, 'HISTORICAL_ANALYSIS', 'STATEMENT_TO_ANALYSIS', 'COMPUTE', NULL, ?),
           (?, ?, ?, 'HISTORICAL_ANALYSIS', ?, 'BASELINE_MODEL', 'ANALYSIS_TO_MODEL', 'COMPUTE', ?, ?)`,
        [
          randomUUID(), orgId, stmtBvId, bvId, userId,
          randomUUID(), orgId, stmtBvId, analysisBvId, userId,
          randomUUID(), orgId, analysisBvId, bvId, 'a'.repeat(64), userId,
        ]
      );
    });

    // Jedno założenie musi istnieć ZANIM da się skonfigurować kontekst
    // (`BASELINE_CONTEXT_NOT_READY`). Zakotwiczone w okresie 11/2025 — czyli
    // ani w prognozie, ani w okresie otwarcia.
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(
        `INSERT INTO finance_baseline_assumptions (id, organization_id, business_version_id, schedule_type, driver_code, entity_id, period_id, base_period_id, rule, value_status, value_decimal, unit, quality, created_by)
         VALUES (?, ?, ?, 'cogs_opex', 'COGS_PCT_OF_REVENUE', ?, ?, ?, 'HISTORICAL_AVERAGE', 'PRESENT_NONZERO', 0.58, 'PCT', 'ESTIMATED', ?)`,
        [randomUUID(), orgId, bvId, entityId, forecastPeriodIds[0], anchorPeriodId, userId]
      )
    );

    const put = await api(
      'PUT',
      `/baseline/${bvId}/context`,
      { expectedVersion: 0, entityId, openingBalanceSheetPeriodId: openingPeriodId, forecastPeriodIds },
      { 'Idempotency-Key': `d279-${randomUUID()}` }
    );
    if (put.status !== 200) throw new Error(`PUT context: ${put.status} ${JSON.stringify(put.body)}`);

    // ── D1: GET kontekstu zwraca ETYKIETĘ okresu otwarcia z bazy ───────────
    const get1 = await api('GET', `/baseline/${bvId}/context`);
    const ctx1 = get1.body?.data ?? {};
    check(
      'D1',
      'GET .../context zwraca openingBalanceSheetPeriod {periodId,label,periodStart,periodEnd}',
      get1.status === 200 &&
        ctx1.openingBalanceSheetPeriod?.periodId === openingPeriodId &&
        ctx1.openingBalanceSheetPeriod?.label === '12/2025' &&
        ctx1.openingBalanceSheetPeriod?.periodStart === '2025-12-01' &&
        ctx1.openingBalanceSheetPeriod?.periodEnd === '2025-12-31',
      `status=${get1.status} openingBalanceSheetPeriod=${JSON.stringify(ctx1.openingBalanceSheetPeriod)}`
    );
    check(
      'D2',
      'GET .../context zwraca assumptionBasePeriods z etykietą zakotwiczenia 11/2025',
      Array.isArray(ctx1.assumptionBasePeriods) &&
        ctx1.assumptionBasePeriods.some(
          (p: Json) => p.periodId === anchorPeriodId && p.label === '11/2025'
        ),
      `assumptionBasePeriods=${JSON.stringify(ctx1.assumptionBasePeriods)}`
    );

    // ── D3: DOWÓD MUTACYJNY — etykieta idzie z bazy, nie z napisu ID ───────
    // Zmieniamy `label` w `finance_stmt_periods` (ID bez zmian). Jeśli
    // etykieta byłaby wyprowadzana z `per-…`/zaszyta, odpowiedź się NIE zmieni.
    await coldPool.query(`UPDATE finance_stmt_periods SET label = $1 WHERE period_id = $2`, [
      'GRUDZIEN-2025-DOWOD',
      openingPeriodId,
    ]);
    const get2 = await api('GET', `/baseline/${bvId}/context`);
    check(
      'D3',
      'DOWÓD MUTACYJNY: zmiana label w finance_stmt_periods zmienia odpowiedź GET (etykieta pochodzi z bazy)',
      get2.body?.data?.openingBalanceSheetPeriod?.label === 'GRUDZIEN-2025-DOWOD' &&
        get2.body?.data?.openingBalanceSheetPeriodId === openingPeriodId,
      `label po mutacji=${JSON.stringify(get2.body?.data?.openingBalanceSheetPeriod?.label)}`
    );
    await coldPool.query(`UPDATE finance_stmt_periods SET label = $1 WHERE period_id = $2`, [
      '12/2025',
      openingPeriodId,
    ]);

    // ── D4: PRZYCISK „+ Dodaj założenie" — realna trasa + odczyt na zimno ──
    const coldBefore = await coldPool.query(
      `SELECT count(*)::int AS n FROM finance_baseline_assumptions WHERE organization_id = $1 AND business_version_id = $2`,
      [orgId, bvId]
    );
    const add = await api('POST', `/baseline/${bvId}/assumptions`, {
      assumptions: [
        {
          scheduleType: 'wc_dso_dio_dpo',
          driverCode: 'DSO_DAYS',
          entityId,
          periodId: forecastPeriodIds[0],
          basePeriodId: openingPeriodId,
          rule: 'MANUAL_OVERRIDE',
          valueStatus: 'PRESENT_NONZERO',
          valueDecimal: 45,
          unit: 'DAYS',
          quality: 'ESTIMATED',
        },
      ],
    });
    const addedId = add.body?.data?.assumptions?.[0]?.assumptionId as string;
    const coldAfterAdd = await coldPool.query(
      `SELECT id, driver_code, value_decimal::text AS value_decimal, base_period_id
         FROM finance_baseline_assumptions
        WHERE organization_id = $1 AND business_version_id = $2 AND driver_code = 'DSO_DAYS'`,
      [orgId, bvId]
    );
    check(
      'D4',
      'POST .../assumptions dodaje wiersz — potwierdzone ODCZYTEM NA ZIMNO (osobna pula pg), nie odpowiedzią zapisu',
      add.status === 200 &&
        coldAfterAdd.rowCount === 1 &&
        coldAfterAdd.rows[0].id === addedId &&
        Number(coldAfterAdd.rows[0].value_decimal) === 45,
      `status=${add.status} przed=${coldBefore.rows[0].n} po=${coldAfterAdd.rowCount} wiersz=${JSON.stringify(coldAfterAdd.rows[0] ?? null)}`
    );

    // Druga, niezależna droga odczytu — produkcyjna trasa GET.
    const listAfterAdd = await api('GET', `/baseline/${bvId}/assumptions?entityId=${entityId}`);
    check(
      'D5',
      'GET .../assumptions (kod produkcyjny) widzi dodany wiersz',
      listAfterAdd.status === 200 &&
        (listAfterAdd.body?.data ?? []).some((a: Json) => a.assumptionId === addedId),
      `status=${listAfterAdd.status} liczba=${(listAfterAdd.body?.data ?? []).length}`
    );

    // ── D6: USUWANIE LINII — realna trasa + odczyt na zimno ────────────────
    const del = await api('DELETE', `/baseline/${bvId}/assumptions/${addedId}`);
    const coldAfterDel = await coldPool.query(
      `SELECT count(*)::int AS n FROM finance_baseline_assumptions WHERE organization_id = $1 AND id = $2`,
      [orgId, addedId]
    );
    check(
      'D6',
      'DELETE .../assumptions/:id usuwa wiersz — potwierdzone ODCZYTEM NA ZIMNO',
      del.status === 204 && coldAfterDel.rows[0].n === 0,
      `status=${del.status} wierszy po usunięciu=${coldAfterDel.rows[0].n}`
    );

    // ── D7: usunięcie nieistniejącego id NIE melduje sukcesu ───────────────
    // (`Database.ts:686` zwraca changes:1 dla każdego UPDATE — sprawdzamy, czy
    // ścieżka usuwania nie dziedziczy tego kłamstwa.)
    const delAgain = await api('DELETE', `/baseline/${bvId}/assumptions/${addedId}`);
    check(
      'D7',
      'Powtórny DELETE tego samego id zwraca 404 (brak fałszywego sukcesu)',
      delAgain.status === 404,
      `status=${delAgain.status}`
    );

    // ── D8: kontekst po usunięciu nadal spójny ─────────────────────────────
    const get3 = await api('GET', `/baseline/${bvId}/context`);
    check(
      'D8',
      'GET .../context po dodaniu i usunięciu nadal zwraca etykietę okresu otwarcia',
      get3.status === 200 && get3.body?.data?.openingBalanceSheetPeriod?.label === '12/2025',
      `status=${get3.status} label=${JSON.stringify(get3.body?.data?.openingBalanceSheetPeriod?.label)}`
    );

    console.log('\nbusinessVersionId =', bvId);
  } finally {
    // Sprzątanie danych pomiarowych (dane demo = twarz produktu).
    try {
      // `finance_baseline_context_command_receipts` ma trigger IMMUTABLE
      // (`20261042_...:51`) — paragonów NIE da się skasować z definicji; ten
      // pomiar biegnie na jednorazowym kontenerze, który jest usuwany po
      // dyżurze, więc nie zostaje żaden ślad w bazie długoterminowej.
      await coldPool.query(`DELETE FROM finance_baseline_assumptions WHERE organization_id = $1`, [orgId]);
    } catch (e) {
      console.error('[proof] sprzątanie częściowe:', String(e));
    }
    await coldPool.end();
    server.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\nPODSUMOWANIE: ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) {
    console.log('NIEZALICZONE: ' + failed.map((f) => f.nr).join(', '));
    process.exitCode = 1;
  }
}

main().then(
  () => process.exit(process.exitCode ?? 0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
