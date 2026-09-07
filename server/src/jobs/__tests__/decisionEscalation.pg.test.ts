/**
 * P16 / R3 (DEC-453) — AUTOMAT ESKALACJI I ROZSTRZYGNIĘCIE NA PRAWDZIWYM PG.
 *
 * Czego NIE da się zmierzyć bez realnej bazy (i dlaczego ten plik istnieje
 * obok czystego `decisionEscalationJob.test.ts`):
 *   (h) idempotencja dobowa — liczy się na WIERSZACH `decision_escalation_log`,
 *   (i) TRYB SUCHY — dowodem jest ZERO nowych wierszy po przebiegu,
 *   (j) trwałość rozstrzygnięcia — `status` + `decision_rationale` +
 *       `decided_at` + `decided_by` muszą zostać w tabeli po COMMIT.
 * Atrapa bazy tego repo (`Database.ts:686`) zwraca `changes: 1` dla KAŻDEGO
 * UPDATE niezależnie od WHERE, więc „zapisało się" zmierzone na atrapie jest
 * bezwartościowe — patrz lekcja „Atrapa bazy kłamie o zapisie".
 *
 * URUCHOMIENIE (bez tych trzech zmiennych plik jest POMIJANY, nigdy nie daje
 * fałszywej zieleni — `describe.skipIf`):
 *   RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
 *   DATABASE_URL=postgresql://postgres:noc@127.0.0.1:54400/consultify_p16r3 \
 *   npx vitest run server/src/jobs/__tests__/decisionEscalation.pg.test.ts
 *
 * PUŁAPKA, której ten plik unika: `NODE_ENV=test` BEZ `RUN_DB_TESTS=1`
 * podstawia atrapę bazy — wtedy „zielono" znaczy „nie mierzyłem".
 *
 * SPRZĄTANIE: plik tworzy WYŁĄCZNIE własne wiersze z przedrostkiem
 * `proba-r3-pg-` i kasuje je w `afterAll` (dane demo są twarzą produktu).
 * Nie dotyka schematu — żadnego DROP/TRUNCATE.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');
if (REAL_PG) process.env.DB_TYPE = 'postgres';

const PRZEDROSTEK = 'proba-r3-pg-';

describe.skipIf(!REAL_PG)('(h)(i)(j) eskalacja i rozstrzygnięcie na realnym PG', () => {
  let pool: any;
  let orgId: string;
  let userId: string;

  const idPoTerminie = randomUUID();
  const idRozstrzygnietej = randomUUID();
  const idPrzedTerminem = randomUUID();
  const idDoRozstrzygniecia = randomUUID();

  const wstaw = async (id: string, tytul: string, status: string, deadline: string) =>
    pool.query(
      `INSERT INTO decisions (id, organization_id, title, status, deadline, decision_maker_id,
                              created_by, type, escalation_level, version, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6, 'EXECUTION', 'none', 1,
               CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [id, orgId, tytul, status, deadline, userId]
    );

  const poziom = async (id: string): Promise<number> => {
    const r = await pool.query(
      `SELECT COALESCE(MAX(to_level), 0) AS lvl FROM decision_escalation_log WHERE decision_id = $1`,
      [id]
    );
    return Number(r.rows[0]?.lvl ?? 0);
  };

  const wierszyWLogu = async (): Promise<number> => {
    const r = await pool.query(
      `SELECT COUNT(*) AS n FROM decision_escalation_log el
        JOIN decisions d ON d.id = el.decision_id
       WHERE d.title LIKE $1`,
      [`${PRZEDROSTEK}%`]
    );
    return Number(r.rows[0]?.n ?? 0);
  };

  beforeAll(async () => {
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: CONNECTION_STRING });
    const org = await pool.query(`SELECT id FROM organizations ORDER BY created_at LIMIT 1`);
    orgId = org.rows[0].id;
    const usr = await pool.query(`SELECT id FROM users WHERE organization_id = $1 LIMIT 1`, [
      orgId,
    ]);
    userId = usr.rows[0].id;

    const wczoraj = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const jutro = new Date(Date.now() + 10 * 86_400_000).toISOString();
    await wstaw(idPoTerminie, `${PRZEDROSTEK}po-terminie`, 'pending', wczoraj);
    // Rozstrzygnięta ORAZ po terminie — automat NIE ma prawa jej ruszyć.
    await wstaw(idRozstrzygnietej, `${PRZEDROSTEK}rozstrzygnieta`, 'approved', wczoraj);
    await wstaw(idPrzedTerminem, `${PRZEDROSTEK}przed-terminem`, 'pending', jutro);
    await wstaw(idDoRozstrzygniecia, `${PRZEDROSTEK}do-rozstrzygniecia`, 'pending', wczoraj);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query(
      `DELETE FROM decision_escalation_log WHERE decision_id IN
        (SELECT id FROM decisions WHERE title LIKE $1)`,
      [`${PRZEDROSTEK}%`]
    );
    await pool.query(
      `DELETE FROM decision_history WHERE decision_id IN
        (SELECT id FROM decisions WHERE title LIKE $1)`,
      [`${PRZEDROSTEK}%`]
    );
    await pool.query(`DELETE FROM decisions WHERE title LIKE $1`, [`${PRZEDROSTEK}%`]);
    await pool.end();
  });

  it('(i) TRYB SUCHY wypisuje kandydatów i NIE zapisuje ani jednego wiersza', async () => {
    const { runDecisionEscalationTick } = await import('../decisionEscalationJob.js');
    const przed = await wierszyWLogu();

    const wynik = await runDecisionEscalationTick({ dryRun: true, organizationId: orgId });

    expect(wynik.dryRun).toBe(true);
    expect(wynik.escalated).toBe(0);
    const tytuly = wynik.candidates.map((k) => k.title);
    expect(tytuly).toContain(`${PRZEDROSTEK}po-terminie`);
    expect(tytuly).toContain(`${PRZEDROSTEK}do-rozstrzygniecia`);
    // Dowód, że to naprawdę było „na sucho": stan bazy bez zmian.
    expect(await wierszyWLogu()).toBe(przed);
    expect(await poziom(idPoTerminie)).toBe(0);
  });

  it('(h) pierwszy przebieg na ostro działa wstecznie: 0 → 1', async () => {
    const { runDecisionEscalationTick } = await import('../decisionEscalationJob.js');
    const wynik = await runDecisionEscalationTick({ dryRun: false, organizationId: orgId });

    expect(wynik.errors).toBe(0);
    expect(wynik.escalated).toBeGreaterThanOrEqual(2);
    expect(await poziom(idPoTerminie)).toBe(1);
    expect(await poziom(idDoRozstrzygniecia)).toBe(1);

    const status = await pool.query(`SELECT status FROM decisions WHERE id = $1`, [idPoTerminie]);
    expect(String(status.rows[0].status).toLowerCase()).toBe('escalated');
  });

  it('(h) NIE rusza decyzji rozstrzygniętej ani decyzji przed terminem', async () => {
    expect(await poziom(idRozstrzygnietej)).toBe(0);
    expect(await poziom(idPrzedTerminem)).toBe(0);
    const s = await pool.query(`SELECT status FROM decisions WHERE id = $1`, [idRozstrzygnietej]);
    expect(String(s.rows[0].status).toLowerCase()).toBe('approved');
  });

  it('(h) drugi przebieg TEGO SAMEGO DNIA nie podnosi niczego', async () => {
    const { runDecisionEscalationTick } = await import('../decisionEscalationJob.js');
    const przed = await wierszyWLogu();

    const wynik = await runDecisionEscalationTick({ dryRun: false, organizationId: orgId });

    expect(wynik.escalated).toBe(0);
    expect(wynik.skippedAlreadyToday).toBeGreaterThanOrEqual(2);
    expect(await wierszyWLogu()).toBe(przed);
    expect(await poziom(idPoTerminie)).toBe(1);
  });

  it('(j) rozstrzygnięcie zapisuje TRWALE status, uzasadnienie, decided_at i decided_by', async () => {
    const { finalizeDecisionTransition } = await import(
      '../../services/decisionCollaborationService.js'
    );
    const uzasadnienie = 'proba-r3-pg: zakres potwierdzony przez sponsora.';

    const wynik = await finalizeDecisionTransition({
      decisionId: idDoRozstrzygniecia,
      organizationId: orgId,
      actorId: userId,
      targetStatus: 'superseded',
      rationaleText: uzasadnienie,
    });
    expect(wynik.status).toBe('superseded');

    // Odczyt Z BAZY, nie z odpowiedzi funkcji — dopiero to jest dowód trwałości.
    const r = await pool.query(
      `SELECT status, decision_rationale, decided_at, decided_by FROM decisions WHERE id = $1`,
      [idDoRozstrzygniecia]
    );
    expect(String(r.rows[0].status).toLowerCase()).toBe('superseded');
    expect(r.rows[0].decision_rationale).toBe(uzasadnienie);
    expect(r.rows[0].decided_at).not.toBeNull();
    expect(r.rows[0].decided_by).toBe(userId);
  });

  it('(j) rozstrzygnięcie BEZ uzasadnienia jest odrzucane, z zerową zmianą w bazie', async () => {
    const { finalizeDecisionTransition } = await import(
      '../../services/decisionCollaborationService.js'
    );
    const przed = await pool.query(`SELECT status, decision_rationale FROM decisions WHERE id = $1`, [
      idPoTerminie,
    ]);

    await expect(
      finalizeDecisionTransition({
        decisionId: idPoTerminie,
        organizationId: orgId,
        actorId: userId,
        targetStatus: 'superseded',
        rationaleText: '   ',
      })
    ).rejects.toThrow();

    const po = await pool.query(`SELECT status, decision_rationale FROM decisions WHERE id = $1`, [
      idPoTerminie,
    ]);
    expect(po.rows[0].status).toBe(przed.rows[0].status);
    expect(po.rows[0].decision_rationale).toBe(przed.rows[0].decision_rationale);
  });

  it('(j) decyzji rozstrzygniętej nie da się rozstrzygnąć drugi raz (wpis nieusuwalny)', async () => {
    const { finalizeDecisionTransition } = await import(
      '../../services/decisionCollaborationService.js'
    );
    await expect(
      finalizeDecisionTransition({
        decisionId: idDoRozstrzygniecia,
        organizationId: orgId,
        actorId: userId,
        targetStatus: 'approved',
        rationaleText: 'proba-r3-pg: proba nadpisania wyniku',
      })
    ).rejects.toThrow();

    const r = await pool.query(`SELECT status FROM decisions WHERE id = $1`, [
      idDoRozstrzygniecia,
    ]);
    expect(String(r.rows[0].status).toLowerCase()).toBe('superseded');
  });
});
