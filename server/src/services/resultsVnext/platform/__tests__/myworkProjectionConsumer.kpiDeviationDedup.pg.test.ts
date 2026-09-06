/** @vitest-environment node */
/**
 * SKRZYNKA-DUPLIKATY [ODMROZENIE 07_MY_WORK_AGENT DEC-397] — dowód na realnej
 * bazie PG (54400) dla decyzji CTO: stary kanał powiadomień odchyleń KPI
 * (`myworkProjectionConsumer.handleKpiDeviationOpened`) NIE tworzy drugiego
 * wpisu w Skrzynce, gdy P7K-B action card dla TEGO SAMEGO miernika+okresu
 * już istnieje (KRĘGOSŁUP §3 — jedna karta, jedna Skrzynka).
 *
 * ZABEZPIECZENIE: `actionCardAlreadyCoversCase()` w
 * `../myworkProjectionConsumer.ts`, wywołane z `handleKpiDeviationOpened`
 * PRZED `insertNotification`.
 *
 * DOWÓD MUTACYJNY: usunięcie/zablokowanie tego strażnika (np. zamiana
 * `if (coveredByActionCard) { ...; return; }` na martwy kod, albo usunięcie
 * JOIN-a do `rvn_kpi_measurements` tak, by `findMatchingActionCardSourceId`
 * zawsze zwracał `null`) sprawia, że drugie zdarzenie `kpi.deviation_opened`
 * dla miernika/okresu z już istniejącą kartą działania TWORZY drugi wpis w
 * `notifications` — test „drugie zdarzenie dla tego samego miernika+okresu,
 * gdy action card już istnieje, NIE tworzy drugiego powiadomienia" wtedy
 * PADA (liczba wynosi 2, nie 1). Zweryfikowane ręcznie 2026-09-06 (RED po
 * cofnięciu strażnika, GREEN po przywróceniu) — patrz raport dyżuru.
 *
 * Uruchomienie: RUN_DB_TESTS=1 DB_TYPE=postgres DATABASE_URL=… (baza 54400).
 * Bez tych zmiennych zestaw jest POMIJANY, nie „zielony" — atrapa bazy
 * (`NODE_ENV=test` bez `RUN_DB_TESTS`) odpowiada `changes:1` na każdy zapis
 * niezależnie od WHERE i udowodniłaby dowolną tezę.
 */
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildKpiDeviationSourceId } from '../../../actionCard/kpiDeviationActionCard.js';
import { dispatchMyWorkProjection } from '../myworkProjectionConsumer.js';

const enabled = process.env.RUN_DB_TESTS === '1' && !!process.env.DATABASE_URL;

describe.skipIf(!enabled)(
  'SKRZYNKA-DUPLIKATY DEC-397 — stary kanał notifications vs P7K-B action_cards (realny PG)',
  () => {
    const tag = randomUUID().slice(0, 8);
    const org = `org-dupl-${tag}`;
    const assignee = randomUUID();
    const periodStart = '2026-03-01';
    const periodEnd = '2026-03-31';

    let pool: Pool;

    // Osobny KPI per test (unique constraint na rvn_kpi_measurements to
    // (kpi_id, period_start, period_end) — dwa testy na TYM SAMYM
    // miernik+okres kolidowałyby ze sobą; tożsamość, którą testujemy, to
    // sam mechanizm dedup, nie konkretny kpiId).
    async function seedKpiDefinition() {
      const kpiId = randomUUID();
      const definitionVersionId = randomUUID();
      await pool.query(
        `INSERT INTO rvn_kpi_definitions(kpi_id, organization_id, kpi_code, status, owner_user_id, created_by)
         VALUES ($1, $2, $3, 'active', $4, $4)`,
        [kpiId, org, `DEDUP-KPI-${kpiId.slice(0, 8)}`, assignee]
      );
      await pool.query(
        `INSERT INTO rvn_kpi_definition_versions
           (definition_version_id, kpi_id, organization_id, version_number, name,
            target_geometry, approval_status, created_by)
         VALUES ($1, $2, $3, 1, 'Miernik testowy dedup', 'threshold_min', 'approved', $4)`,
        [definitionVersionId, kpiId, org, assignee]
      );
      return { kpiId, definitionVersionId };
    }

    async function seedMeasurementAndCase(caseSuffix: string) {
      const { kpiId, definitionVersionId } = await seedKpiDefinition();
      const measurementId = randomUUID();
      const caseId = randomUUID();
      await pool.query(
        `INSERT INTO rvn_kpi_measurements
           (measurement_id, kpi_id, definition_version_id, organization_id,
            period_start, period_end, actual_value, performance_status, source, recorded_by)
         VALUES ($1, $2, $3, $4, $5::date, $6::date, 100, 'critical', 'manual', $7)`,
        [measurementId, kpiId, definitionVersionId, org, periodStart, periodEnd, assignee]
      );
      await pool.query(
        `INSERT INTO rvn_kpi_deviation_cases
           (case_id, organization_id, kpi_id, trigger_measurement_id, severity, status,
            owner_user_id, created_by)
         VALUES ($1, $2, $3, $4, 'critical', 'open', $5, $5)`,
        [caseId, org, kpiId, measurementId, assignee]
      );
      const obligationId = randomUUID();
      await pool.query(
        `INSERT INTO rvn_platform_obligations
           (obligation_id, organization_id, assignee_user_id, reference_type, reference_id,
            aggregate_version_at_creation, obligation_type, status, deduplication_key)
         VALUES ($1, $2, $3, 'deviation_case', $4, 1, 'explain_deviation', 'open', $5)`,
        [obligationId, org, assignee, caseId, `dedup-test:${caseSuffix}:${tag}`]
      );
      return { caseId, kpiId };
    }

    async function insertKpiDeviationOpenedEvent(caseId: string) {
      const eventId = randomUUID();
      await pool.query(
        `INSERT INTO rvn_platform_events (
           event_id, schema_version, event_type, aggregate_type, aggregate_id,
           organization_id, actor_user_id, actor_effective_role, command_id,
           correlation_id, policy_version, state_hash, source, idempotency_key,
           resulting_version, payload
         ) VALUES ($1, 1, 'kpi.deviation_opened', 'deviation_case', $2, $3, $4,
                   'OWNER', $5, $6, 'v1', 'hash', 'kpi-deviation-command', $7, 1, '{}')`,
        [
          eventId,
          caseId,
          org,
          assignee,
          randomUUID(),
          randomUUID(),
          `kpi.deviation_opened:dedup-test:${caseId}`,
        ]
      );
      return eventId;
    }

    const notificationCount = async () => {
      const { rows } = await pool.query<{ n: string }>(
        `SELECT COUNT(*) AS n FROM notifications
          WHERE organization_id = $1 AND entity_type = 'deviation_case'`,
        [org]
      );
      return Number(rows[0].n);
    };

    beforeAll(async () => {
      pool = new Pool({ connectionString: process.env.DATABASE_URL });
      await pool.query(
        `INSERT INTO organizations(id,name,plan,status) VALUES($1,$2,'enterprise','active')`,
        [org, `SKRZYNKA-DUPL ${org}`]
      );
      await pool.query(
        `INSERT INTO users(id,organization_id,email,password,first_name,last_name,role,status)
         VALUES($1,$2,$3,'unused','Test','Assignee','OWNER','active')`,
        [assignee, org, `${assignee}@dedup.local`]
      );
    });

    afterAll(async () => {
      await pool.query(`DELETE FROM notifications WHERE organization_id=$1`, [org]).catch(() => undefined);
      await pool.query(`DELETE FROM action_cards WHERE organization_id=$1`, [org]).catch(() => undefined);
      await pool.query(`DELETE FROM rvn_platform_consumer_processed WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id=$1)`, [org]).catch(() => undefined);
      await pool.query(`DELETE FROM rvn_platform_obligations WHERE organization_id=$1`, [org]).catch(() => undefined);
      await pool.query(`DELETE FROM rvn_platform_events WHERE organization_id=$1`, [org]).catch(() => undefined);
      await pool.query(`DELETE FROM rvn_kpi_deviation_cases WHERE organization_id=$1`, [org]).catch(() => undefined);
      await pool.query(`DELETE FROM rvn_kpi_measurements WHERE organization_id=$1`, [org]).catch(() => undefined);
      await pool.query(`DELETE FROM rvn_kpi_definition_versions WHERE organization_id=$1`, [org]).catch(() => undefined);
      await pool.query(`DELETE FROM rvn_kpi_definitions WHERE organization_id=$1`, [org]).catch(() => undefined);
      await pool.query(`DELETE FROM users WHERE organization_id=$1`, [org]).catch(() => undefined);
      await pool.query(`DELETE FROM organizations WHERE id=$1`, [org]).catch(() => undefined);
      await pool.end();
    });

    it('bez action card: kpi.deviation_opened tworzy DOKŁADNIE JEDNO powiadomienie (baseline, bez regresji dla warning)', async () => {
      const { caseId } = await seedMeasurementAndCase('bez-karty');
      const eventId = await insertKpiDeviationOpenedEvent(caseId);
      const before = await notificationCount();

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const eventRow = (await client.query(`SELECT * FROM rvn_platform_events WHERE event_id = $1`, [eventId]))
          .rows[0];
        await dispatchMyWorkProjection(client, eventRow as any, {} as any);
        await client.query('COMMIT');
      } finally {
        client.release();
      }

      expect(await notificationCount()).toBe(before + 1);
    });

    it('z istniejącą P7K-B kartą działania na ten sam miernik+okres: kpi.deviation_opened NIE tworzy drugiego wpisu', async () => {
      const { caseId, kpiId } = await seedMeasurementAndCase('z-karta');
      const sourceId = buildKpiDeviationSourceId(kpiId, periodStart, periodEnd);
      await pool.query(
        `INSERT INTO action_cards
           (id, organization_id, source_kind, source_id, period_start, period_end,
            goal_met, action_required, problem, root_cause, action_text, owner_user_id,
            due_date, status, created_by, updated_by)
         VALUES ($1, $2, 'kpi_deviation', $3, $4::date, $5::date, false, true,
                 'Odchylenie: DEDUP-KPI 03.2026 — rezultat poza limitem.', '', '', $6,
                 '2026-04-14', 'OPEN', $6, $6)`,
        [randomUUID(), org, sourceId, periodStart, periodEnd, assignee]
      );

      const eventId = await insertKpiDeviationOpenedEvent(caseId);
      const before = await notificationCount();

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const eventRow = (await client.query(`SELECT * FROM rvn_platform_events WHERE event_id = $1`, [eventId]))
          .rows[0];
        await dispatchMyWorkProjection(client, eventRow as any, {} as any);
        await client.query('COMMIT');
      } finally {
        client.release();
      }

      // DEC-397: karta działania już niesie ten sygnał — stary kanał nie
      // dubluje go w Skrzynce.
      expect(await notificationCount()).toBe(before);
    });
  }
);
