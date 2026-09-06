/**
 * SEED CD PROJEKT — sumy kontrolne pliku danych + pełny łańcuch na REALNYM PostgreSQL.
 *
 * Dwie warstwy, celowo rozdzielone:
 *
 *  A. `verifyControls` na PLIKU DANYCH — czysta funkcja, bez bazy, biegnie ZAWSZE.
 *     To jest bezpiecznik przeciw cichej literówce przy przepisywaniu 146 pozycji z PDF.
 *     DOWÓD MUTACYJNY jest w tej warstwie i celuje w ZABEZPIECZENIE („żadna kwota nie zmieni się
 *     niezauważona"), a nie w mechanizm ładowania JSON-a: test 4 podmienia JEDNĄ kwotę w kopii
 *     danych i wymaga, żeby kontrola PADŁA. Gdyby ktoś wypatroszył `verifyControls` do `return []`,
 *     testy 2, 3 i 4 zrobią się czerwone, a test 1 (plik się wczytuje, ma 146 pozycji) dalej zielony —
 *     czyli mutacja rozróżnia zabezpieczenie od mechanizmu.
 *
 *  B. Łańcuch zapisu na realnym Postgresie — TA SAMA bramka, co reszta suit `.pg.test.ts`
 *     (`RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=postgres…`). Bez bramki
 *     cały `describe` jest `skipped` — NIGDY `passed`.
 *     Dlaczego TYLKO Postgres: sens seeda stoi na odroczonych triggerach, których atrapa bazy nie zna
 *     (`finance_stmt_check_balance`, `finance_stmt_check_cash_rollforward`), na indeksie
 *     `uq_finance_stmt_lines_cell` i na append-only `artifact_lifecycle_events`. Zieleń na sqlite
 *     nie znaczyłaby nic.
 *
 * Wszystkie odczyty sprawdzające idą OSOBNYM klientem `pg` („na zimno"), nie z wartości zwróconej
 * przez serwis.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  DATA_PATH,
  P0_REQUIRED_LINE_CODES,
  loadDataset,
  verifyControls,
  type SeedDataset,
} from '../../../../../scripts/finance-seed-cdprojekt.js';

// Vitest biegnie z korzenia repo (`include` w vitest.config.ts jest względem korzenia),
// więc `process.cwd()` jest tu stabilnym punktem odniesienia — nie liczymy sześciu `..`.
const REPO_ROOT = process.cwd();
const SCRIPT = join(REPO_ROOT, 'server', 'scripts', 'finance-seed-cdprojekt.ts');

// ---------------------------------------------------------------------------
// A. Plik danych — bez bazy, zawsze
// ---------------------------------------------------------------------------

describe('seed CD PROJEKT — plik danych', () => {
  it('1. wczytuje się i ma komplet pozycji ze wszystkich czterech sprawozdań', () => {
    const data = loadDataset();
    expect(data.lines.length).toBe(146);
    const sections = new Set(data.lines.map((l) => l.section));
    expect([...sections].sort()).toEqual(['BS', 'CF', 'OCI', 'P&L']);
    expect(data.meta.periods.map((p) => p.key)).toEqual(['FY2024', 'FY2025']);
    expect(data.meta.unit).toBe('THOUSANDS');
    expect(data.meta.currency).toBe('PLN');
  });

  it('2. przechodzi WSZYSTKIE sumy kontrolne z PDF (bilans, rolka gotówki, przepływy, pozycje wyliczone)', () => {
    const failures = verifyControls(loadDataset());
    expect(failures).toEqual([]);
  });

  it('3. ma komplet 18 kodów kanonicznych, których żąda katalog wskaźników P0', () => {
    const present = new Set(loadDataset().lines.filter((l) => l.code).map((l) => l.code as string));
    const missing = P0_REQUIRED_LINE_CODES.filter((c) => !present.has(c));
    expect(missing).toEqual([]);
  });

  it('4. MUTACJA: podmiana JEDNEJ kwoty w danych wywala sumy kontrolne (a nie przechodzi po cichu)', () => {
    const base = loadDataset();
    // Aktywa razem 2025: 3 503 320 -> 3 503 321. Jedna złotówka (w tysiącach) różnicy.
    const mutated: SeedDataset = JSON.parse(JSON.stringify(base));
    const assets = mutated.lines.find((l) => l.code === 'TOTAL_ASSETS');
    expect(assets, 'w danych musi być pozycja TOTAL_ASSETS').toBeTruthy();
    assets!.fy2025 = assets!.fy2025 + 1;

    const failures = verifyControls(mutated);
    expect(failures.length).toBeGreaterThan(0);
    expect(failures.map((f) => f.check).join(' | ')).toMatch(/TOTAL_ASSETS|bilans spina się/);

    // Kontrola negatywna tej samej mutacji: nietknięte dane dalej przechodzą,
    // czyli test mierzy zmianę kwoty, a nie ogólną nieszczelność funkcji.
    expect(verifyControls(base)).toEqual([]);
  });

  it('5. MUTACJA: rozspojenie rolki gotówki (stan początkowy) też jest łapane', () => {
    const mutated: SeedDataset = JSON.parse(JSON.stringify(loadDataset()));
    const opening = mutated.lines.find((l) => l.code === 'OPENING_CASH');
    opening!.fy2025 = opening!.fy2025 + 1000;
    const failures = verifyControls(mutated);
    expect(failures.map((f) => f.check).join(' | ')).toMatch(/rolka gotówki/);
  });

  it('6. każda pozycja bez kodu kanonicznego ma jawny powód wykluczenia (nic nie ginie po cichu)', () => {
    const excluded = loadDataset().lines.filter((l) => !l.code);
    expect(excluded.length).toBeGreaterThan(0);
    for (const line of excluded) {
      expect(line.excludeReasonCode, `pozycja "${line.key}" bez powodu wykluczenia`).toBeTruthy();
      expect(line.excludeKind, `pozycja "${line.key}" bez rodzaju wykluczenia`).toBeTruthy();
    }
  });

  it('7. żaden kod kanoniczny nie jest użyty dwa razy w tym samym typie sprawozdania', () => {
    // `uq_finance_stmt_lines_cell` to (entity, canonical_line, period, basis, scope) —
    // druga pozycja z tym samym kodem w tym samym okresie wróciłaby jako DUPLICATE i NIE zapisała
    // wartości. Ten test łapie to na pliku, zanim baza w ogóle zobaczy zapis.
    const byType = new Map<string, string[]>();
    for (const line of loadDataset().lines) {
      if (!line.code) continue;
      const list = byType.get(line.statementType) ?? [];
      list.push(line.code);
      byType.set(line.statementType, list);
    }
    for (const [type, codes] of byType) {
      const duplicates = codes.filter((c, i) => codes.indexOf(c) !== i);
      expect(duplicates, `zdublowane kody w ${type}`).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// B. Realny PostgreSQL
// ---------------------------------------------------------------------------

const connectionString = process.env.DATABASE_URL || '';
const realPg =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  connectionString.startsWith('postgres');
if (realPg) process.env.DB_TYPE = 'postgres';

describe.skipIf(!realPg)('seed CD PROJEKT — realny PostgreSQL', () => {
  const pool = new Pool({ connectionString });
  const orgId = `org-cdp-test-${Date.now()}`;
  const userId = `user-${orgId}`;

  function runSeed(args: string[], dataPath?: string): string {
    return execFileSync('npx', ['tsx', SCRIPT, ...args, `--org=${orgId}`], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        CI: 'true',
        DB_TYPE: 'postgres',
        DATABASE_URL: connectionString,
        ...(dataPath ? { CDPROJEKT_DATA_PATH: dataPath } : {}),
      },
      maxBuffer: 32 * 1024 * 1024,
    });
  }

  async function count(sql: string, params: unknown[] = []): Promise<number> {
    const res = await pool.query(sql, params);
    return Number(res.rows[0]?.count ?? 0);
  }

  beforeAll(async () => {
    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [orgId, orgId]);
    await pool.query(`INSERT INTO users (id, email) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [userId, `${userId}@test.local`]);
    await pool.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role) VALUES ($1, $2, $3, 'OWNER') ON CONFLICT (id) DO NOTHING`,
      [`om-${orgId}`, orgId, userId]
    );
  }, 120_000);

  afterAll(async () => {
    // Sprzątanie po sobie — dane demo to twarz produktu, probe nie zostawia śmieci.
    try {
      runSeed(['--rollback', '--cascade']);
    } catch {
      /* rollback po nieudanym teście nie może przesłonić przyczyny */
    }
    await pool.query(`DELETE FROM organization_members WHERE organization_id = $1`, [orgId]);
    try {
      await pool.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
      await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
    } catch {
      // ZMIERZONE, NIE PRZEMILCZANE: organizacji, w której kiedykolwiek powstał artefakt
      // kanoniczny, NIE DA SIĘ skasować do zera — `finance_artifacts` trzyma FK na organizację,
      // a jego usunięcie wymagałoby skasowania `artifact_lifecycle_events`, które są append-only
      // (`trg_artifact_lifecycle_events_deny_delete`). Zostaje zarchiwizowana skorupa i ślad
      // w rejestrze zdarzeń — dokładnie to, co append-only ma gwarantować. Nie obchodzimy
      // triggera wyłączaniem go w teście.
    }
    await pool.end();
  }, 180_000);

  it('8. --apply zakłada 2 okresy, 238 linii kanonicznych i pakiet legacy w stanie „ready"', async () => {
    const out = runSeed(['--apply']);
    expect(out).toContain('pack_readiness_status = ready');
    expect(out).not.toContain('UNMAPPED');

    const packRow = await pool.query(
      `SELECT bv.business_version_id FROM finance_artifacts a
         JOIN finance_business_versions bv ON bv.artifact_id = a.artifact_id
        WHERE a.organization_id = $1 AND a.natural_key LIKE 'seed:finance-cdprojekt-2025:%'`,
      [orgId]
    );
    expect(packRow.rows.length).toBe(1);
    const bv = packRow.rows[0].business_version_id;

    expect(await count(`SELECT count(*) FROM finance_stmt_lines WHERE business_version_id = $1`, [bv])).toBe(238);
    expect(await count(`SELECT count(DISTINCT period_id) AS count FROM finance_stmt_lines WHERE business_version_id = $1`, [bv])).toBe(2);
    expect(await count(`SELECT count(*) FROM finance_stmt_entities WHERE business_version_id = $1`, [bv])).toBe(1);
    expect(await count(`SELECT count(*) FROM financial_statements WHERE organization_id = $1`, [orgId])).toBe(6);
    expect(await count(`SELECT count(*) FROM financial_statement_values v JOIN financial_statements s ON s.id = v.statement_id WHERE s.organization_id = $1`, [orgId])).toBe(292);
  }, 600_000);

  it('9. sumy kontrolne z PDF zgadzają się z tym, co REALNIE leży w bazie (odczyt na zimno)', async () => {
    const data = loadDataset();
    const res = await pool.query(
      `SELECT fsl.line_code, p.fiscal_year, l.value_decimal
         FROM finance_stmt_lines l
         JOIN financial_statement_lines fsl ON fsl.id = l.canonical_line_id
         JOIN finance_stmt_periods p ON p.period_id = l.period_id
         JOIN finance_stmt_entities e ON e.id = l.entity_id
        WHERE l.organization_id = $1 AND fsl.line_code = ANY($2)`,
      // `CASH` nie jest sumą kontrolną z PDF (jest nią `CLOSING_CASH`), ale ostatni test w tym
      // bloku porównuje je ze sobą — więc musi być w zapytaniu, inaczej porównywalibyśmy z pustką.
      [orgId, [...Object.keys(data.controls), 'CASH']]
    );
    const fromDb = new Map<string, number>();
    for (const row of res.rows) fromDb.set(`${row.line_code}:${row.fiscal_year}`, Number(row.value_decimal));

    // Porównanie CAŁYCH map naraz, nie klucz po kluczu: przy rozjeździe komunikat pokazuje
    // wszystkie różnice, a nie tylko pierwszą — inaczej diagnoza schodzi na zgadywanie.
    const expectedMap: Record<string, number> = {};
    const actualMap: Record<string, number | undefined> = {};
    for (const [code, expected] of Object.entries(data.controls)) {
      expectedMap[`${code}:2025`] = expected.fy2025;
      expectedMap[`${code}:2024`] = expected.fy2024;
      actualMap[`${code}:2025`] = fromDb.get(`${code}:2025`);
      actualMap[`${code}:2024`] = fromDb.get(`${code}:2024`);
    }
    expect(actualMap).toEqual(expectedMap);
    // Bilans i rolka gotówki — sprawdzone na WARTOŚCIACH Z BAZY, nie z pliku.
    for (const year of [2024, 2025]) {
      expect(fromDb.get(`TOTAL_ASSETS:${year}`)).toBe(fromDb.get(`TOTAL_LIABILITIES_EQUITY:${year}`));
      expect((fromDb.get(`OPENING_CASH:${year}`) ?? 0) + (fromDb.get(`NET_CHANGE_CASH:${year}`) ?? 0)).toBe(fromDb.get(`CLOSING_CASH:${year}`));
      expect(fromDb.get(`CASH:${year}`)).toBe(fromDb.get(`CLOSING_CASH:${year}`));
    }
  }, 120_000);

  it('10. analiza historyczna liczy co najmniej 15 z 18 wskaźników z realną wartością', async () => {
    const bvRes = await pool.query(
      `SELECT bv.business_version_id FROM finance_artifacts a
         JOIN finance_business_versions bv ON bv.artifact_id = a.artifact_id
        WHERE a.organization_id = $1 AND a.natural_key LIKE 'seed:finance-cdprojekt-2025:%'`,
      [orgId]
    );
    const bv = bvRes.rows[0].business_version_id;
    execFileSync('npx', ['tsx', join(REPO_ROOT, 'server', 'scripts', 'finance-analiza-dbr77.ts'), '--apply', `--org=${orgId}`, `--pack=${bv}`], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: { ...process.env, CI: 'true', DB_TYPE: 'postgres', DATABASE_URL: connectionString },
      maxBuffer: 32 * 1024 * 1024,
    });

    const res = await pool.query(
      `SELECT c.kpi_code, count(v.value_decimal)::int AS filled
         FROM finance_analysis_kpi_values v
         JOIN finance_analysis_kpi_catalog c ON c.id = v.kpi_catalog_id
        WHERE v.organization_id = $1
        GROUP BY c.kpi_code`,
      [orgId]
    );
    const withValue = res.rows.filter((r) => r.filled > 0);
    const onBothPeriods = res.rows.filter((r) => r.filled === 2);
    expect(res.rows.length).toBe(18);
    expect(withValue.length).toBeGreaterThanOrEqual(15);
    // Uczciwie: wskaźniki na średnim saldzie i r/r nie mają wartości dla PIERWSZEGO okresu
    // (`AVERAGE_CURRENT_AND_PRIOR` / `PRIOR_YEAR_SAME_PERIOD` nie mają skąd wziąć poprzednika),
    // więc „na 2 okresy" jest ich mniej i to nie jest defekt seeda.
    expect(onBothPeriods.length).toBeGreaterThanOrEqual(10);

    const byCode = new Map(res.rows.map((r) => [r.kpi_code, r.filled]));
    for (const code of ['CURRENT_RATIO', 'GROSS_MARGIN_PCT', 'NET_MARGIN_PCT', 'EBITDA_MARGIN_PCT', 'OPERATING_CASH_FLOW_MARGIN', 'FCF_MARGIN', 'DEBT_TO_EQUITY', 'INTEREST_COVERAGE']) {
      expect(byCode.get(code), `${code} powinien mieć wartość w OBU okresach`).toBe(2);
    }
    for (const code of ['ROE', 'ROA', 'DSO', 'DIO', 'DPO', 'CASH_CONVERSION_CYCLE', 'REVENUE_GROWTH_YOY']) {
      expect(byCode.get(code), `${code} powinien mieć wartość w drugim okresie`).toBe(1);
    }

    // Wartości sprawdzone ręcznie z PDF, nie tylko „są niepuste".
    const ratio = await pool.query(
      `SELECT c.kpi_code, round(v.value_decimal, 4)::text AS value
         FROM finance_analysis_kpi_values v
         JOIN finance_analysis_kpi_catalog c ON c.id = v.kpi_catalog_id
         JOIN finance_stmt_periods p ON p.period_id = v.period_id
        WHERE v.organization_id = $1 AND p.fiscal_year = 2025 AND c.kpi_code IN ('CURRENT_RATIO','NET_MARGIN_PCT','ROE')`,
      [orgId]
    );
    const values = new Map(ratio.rows.map((r) => [r.kpi_code, r.value]));
    expect(values.get('CURRENT_RATIO')).toBe('7.4023'); // 1 334 673 / 180 304
    expect(values.get('NET_MARGIN_PCT')).toBe('0.6859'); // 594 708 / 866 989
    expect(values.get('ROE')).toBe('0.1961'); // 594 708 / ((3 289 859 + 2 774 059)/2)
  }, 600_000);

  it('11. powtórny --apply nie dokłada ANI JEDNEGO wiersza', async () => {
    const before = {
      lines: await count(`SELECT count(*) FROM finance_stmt_lines WHERE organization_id = $1`, [orgId]),
      periods: await count(`SELECT count(*) FROM finance_stmt_periods WHERE organization_id = $1`, [orgId]),
      entities: await count(`SELECT count(*) FROM finance_stmt_entities WHERE organization_id = $1`, [orgId]),
      statements: await count(`SELECT count(*) FROM financial_statements WHERE organization_id = $1`, [orgId]),
      values: await count(`SELECT count(*) FROM financial_statement_values v JOIN financial_statements s ON s.id = v.statement_id WHERE s.organization_id = $1`, [orgId]),
      artifacts: await count(`SELECT count(*) FROM finance_artifacts WHERE organization_id = $1`, [orgId]),
    };
    runSeed(['--apply']);
    expect({
      lines: await count(`SELECT count(*) FROM finance_stmt_lines WHERE organization_id = $1`, [orgId]),
      periods: await count(`SELECT count(*) FROM finance_stmt_periods WHERE organization_id = $1`, [orgId]),
      entities: await count(`SELECT count(*) FROM finance_stmt_entities WHERE organization_id = $1`, [orgId]),
      statements: await count(`SELECT count(*) FROM financial_statements WHERE organization_id = $1`, [orgId]),
      values: await count(`SELECT count(*) FROM financial_statement_values v JOIN financial_statements s ON s.id = v.statement_id WHERE s.organization_id = $1`, [orgId]),
      artifacts: await count(`SELECT count(*) FROM finance_artifacts WHERE organization_id = $1`, [orgId]),
    }).toEqual(before);
  }, 600_000);

  it('12. --prune-others usuwa cudze firmy z TEJ organizacji i NIE dotyka innej organizacji', async () => {
    const otherOrg = `${orgId}-obca`;
    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [otherOrg, otherOrg]);
    await pool.query(
      `INSERT INTO financial_statement_packs (id, organization_id, entity_name, period_start, period_end, period_label, currency, scaling, pack_status, version)
       VALUES ($1, $2, 'Tesla, Inc.', '2024-01-01', '2024-12-31', 'FY2024', 'USD', 'thousands', 'draft', 1)`,
      [`junk-${orgId}`, orgId]
    );
    await pool.query(
      `INSERT INTO financial_statements (id, organization_id, entity_name, statement_type, period_start, period_end, period_label, currency, scaling, status, statement_pack_id, values_version)
       VALUES ($1, $2, 'Tesla, Inc.', 'P&L', '2024-01-01', '2024-12-31', 'FY2024', 'USD', 'thousands', 'confirmed', $3, 1)`,
      [`junk-st-${orgId}`, orgId, `junk-${orgId}`]
    );
    await pool.query(
      `INSERT INTO financial_statement_packs (id, organization_id, entity_name, period_start, period_end, period_label, currency, scaling, pack_status, version)
       VALUES ($1, $2, 'Cudza Firma', '2024-01-01', '2024-12-31', 'FY2024', 'PLN', 'thousands', 'draft', 1)`,
      [`obcy-${orgId}`, otherOrg]
    );

    const dry = runSeed(['--prune-others', '--dry-run']);
    expect(dry).toContain('Tesla, Inc.');
    expect(dry).toContain('DRY-RUN: nic nie usunięto');
    // Dry-run naprawdę nic nie ruszył:
    expect(await count(`SELECT count(*) FROM financial_statement_packs WHERE id = $1`, [`junk-${orgId}`])).toBe(1);

    runSeed(['--prune-others', '--apply']);

    expect(await count(`SELECT count(*) FROM financial_statement_packs WHERE organization_id = $1`, [orgId])).toBe(1);
    expect(await count(`SELECT count(*) FROM financial_statements WHERE organization_id = $1`, [orgId])).toBe(6);
    const names = await pool.query(`SELECT DISTINCT entity_name FROM financial_statements WHERE organization_id = $1`, [orgId]);
    expect(names.rows.map((r) => r.entity_name)).toEqual(['Grupa Kapitałowa CD PROJEKT']);
    // Analiza CD PROJEKT PRZEŻYWA prune (jest potomkiem pakietu w grafie rodowodu):
    expect(await count(`SELECT count(*) FROM finance_artifacts WHERE organization_id = $1 AND archived_at IS NULL AND artifact_type = 'HISTORICAL_ANALYSIS'`, [orgId])).toBe(1);
    expect(await count(`SELECT count(*) FROM finance_analysis_kpi_values WHERE organization_id = $1 AND value_decimal IS NOT NULL`, [orgId])).toBeGreaterThanOrEqual(15);
    // Obca organizacja nietknięta:
    expect(await count(`SELECT count(*) FROM financial_statement_packs WHERE organization_id = $1`, [otherOrg])).toBe(1);

    await pool.query(`DELETE FROM financial_statement_packs WHERE organization_id = $1`, [otherOrg]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [otherOrg]);
  }, 600_000);

  it('13. --rollback zostawia zero danych seeda (i mówi wprost, że artefakt zostaje zarchiwizowany)', async () => {
    const out = runSeed(['--rollback', '--cascade']);
    expect(out).toMatch(/ZARCHIWIZOWANY|USUNIĘTY/);
    expect(await count(`SELECT count(*) FROM finance_stmt_lines WHERE organization_id = $1`, [orgId])).toBe(0);
    expect(await count(`SELECT count(*) FROM finance_stmt_entities WHERE organization_id = $1`, [orgId])).toBe(0);
    expect(await count(`SELECT count(*) FROM finance_stmt_periods WHERE organization_id = $1`, [orgId])).toBe(0);
    expect(await count(`SELECT count(*) FROM financial_statements WHERE organization_id = $1`, [orgId])).toBe(0);
    expect(await count(`SELECT count(*) FROM financial_statement_packs WHERE organization_id = $1`, [orgId])).toBe(0);
    expect(await count(`SELECT count(*) FROM finance_analysis_kpi_values WHERE organization_id = $1`, [orgId])).toBe(0);

    // I wraca w całości po ponownym --apply — artefakt jest odarchiwizowany, nie porzucony.
    runSeed(['--apply']);
    expect(await count(`SELECT count(*) FROM finance_stmt_lines WHERE organization_id = $1`, [orgId])).toBe(238);
    expect(await count(`SELECT count(*) FROM finance_artifacts WHERE organization_id = $1 AND archived_at IS NULL AND artifact_type = 'STATEMENT_PACK'`, [orgId])).toBe(1);
  }, 900_000);

  it('14. MUTACJA na łańcuchu zapisu: plik danych z rozspojonym bilansem NIE trafia do bazy', () => {
    const data = loadDataset();
    const mutated: SeedDataset = JSON.parse(JSON.stringify(data));
    mutated.lines.find((l) => l.code === 'TOTAL_ASSETS')!.fy2025 += 7;
    const dir = mkdtempSync(join(tmpdir(), 'cdp-mut-'));
    const path = join(dir, 'cdprojekt-2025.json');
    writeFileSync(path, JSON.stringify(mutated), 'utf8');

    let failed = false;
    let output = '';
    try {
      output = runSeed(['--apply'], path);
    } catch (error) {
      failed = true;
      output = String((error as { stdout?: string; stderr?: string }).stdout ?? '') + String((error as { stderr?: string }).stderr ?? '');
    }
    expect(failed, 'seed MUSI odmówić zapisu danych, które się nie spinają').toBe(true);
    expect(output).toContain('Zapis WSTRZYMANY');
    expect(DATA_PATH).toContain('cdprojekt-2025.json');
  }, 300_000);
});
