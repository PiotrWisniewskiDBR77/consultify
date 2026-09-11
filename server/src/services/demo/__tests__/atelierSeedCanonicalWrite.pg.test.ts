/** @vitest-environment node */

/**
 * E7 [ODMROZENIE 05_INITIATIVES DEC-453] — seed demo sesji ma pisac inicjatywy
 * do KANONU (runtime-v1), nie tylko do zastanej tabeli `initiatives`.
 *
 * Pomiar wejsciowy (96_ODBIOR_C2_E3_E5.md "7. pisarz legacy"):
 * `demoSeedService.ts:2295` robil `INSERT INTO initiatives` bez zadnego
 * zapisu do `ie_aggregate_state` — kazda sesja demo zasiewala 22 inicjatywy
 * legacy i 0 kanonicznych.
 *
 * Ten plik dowodzi na REALNYM Postgresie:
 *  1) po jednym seedzie: legacy = 22, kanon = 22, dla TEJ organizacji;
 *  2) drugi seed na tej samej organizacji NIE dodaje nowych agregatow
 *     (idempotencja klientRequestId -> REPLAYED, zero nowych wierszy w
 *     ie_aggregate_state / ie_audit_events / ie_outbox_events /
 *     ie_aggregate_relations / ie_command_receipts / initiative_candidates);
 *  3) `ie_outbox_delivery_receipts` = 0 (Z30 — nic nie zostalo doreczone,
 *     bo test nie uruchamia zadnego drenazu);
 *  4) sprzatanie sesji demo (`deleteDemoDatasetForOrganization`, w1a)
 *     kasuje TAKZE agregaty kanonu tej organizacji — bez tego sprzatacz
 *     zostawia sieroty w kanonie po kazdym demo teardownie.
 *
 * URUCHOMIENIE:
 *   RUN_DB_TESTS=1 DB_TYPE=postgres NODE_ENV=test MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54418/consultify_kopia_e7 \
 *   npx vitest run --retry=0 \
 *     server/src/services/demo/__tests__/atelierSeedCanonicalWrite.pg.test.ts
 *
 * `NODE_ENV=test` bez `RUN_DB_TESTS=1` daje CICHY MOCK bazy — dlatego
 * `beforeAll` asercuje `DB_TYPE` i realne polaczenie zanim cokolwiek zapisze.
 */

import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';
import {
  deleteDemoDatasetForOrganization,
  seedAtelierToysDemoDataset,
} from '../demoSeedService.js';

const NO_RETRY = { retry: 0 } as const;

describe('E7 — seed demo pisze inicjatywy do kanonu (runtime-v1)', NO_RETRY, () => {
  const organizationId = `e7-seed-canon-${randomUUID()}`;
  const anchorDate = '2026-06-01T00:00:00.000Z';
  let sql: Client | undefined;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await sql.connect();
  }, 30_000);

  afterAll(async () => {
    if (!sql) return;
    const client = sql;
    try {
      // Sprzataczka wlasciwa (w1a) — dowodzi punktu 4 wprost: kasuje TAKZE
      // kanon. Jezeli to zawiedzie, wiersze ponizej i tak sa kasowane recznie
      // jako siatka bezpieczenstwa (Z13 — zero rekordow testowych w kopii).
      await deleteDemoDatasetForOrganization(organizationId).catch(() => undefined);
      await client.query(`DELETE FROM ie_outbox_events WHERE organization_id=$1`, [organizationId]).catch(() => undefined);
      await client.query(`DELETE FROM ie_audit_events WHERE organization_id=$1`, [organizationId]).catch(() => undefined);
      await client.query(`DELETE FROM ie_command_receipts WHERE organization_id=$1`, [organizationId]).catch(() => undefined);
      await client.query(`DELETE FROM ie_aggregate_relations WHERE organization_id=$1`, [organizationId]).catch(() => undefined);
      await client.query(`DELETE FROM ie_aggregate_state WHERE organization_id=$1`, [organizationId]).catch(() => undefined);
      await client.query(`DELETE FROM initiative_candidates WHERE organization_id=$1`, [organizationId]).catch(() => undefined);
      await client.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]).catch(() => undefined);
    } finally {
      await client.end().catch(() => undefined);
    }
  });

  it('run #1: legacy=22, kanon=22 dla organizacji seedu; run #2: 0 nowych agregatow', async () => {
    if (!sql) throw new Error('beforeAll nie ustanowil polaczenia SQL.');

    const result1 = await seedAtelierToysDemoDataset({ organizationId, anchorDate, locale: 'en' });
    expect(result1.counts.initiatives, JSON.stringify(result1.failures)).toBe(22);
    // PRZED->PO tej organizacji: 0 kanonicznych -> 22 kanonicznych.
    expect(result1.counts.canonicalInitiatives, JSON.stringify(result1.failures)).toBe(22);
    expect(result1.failures.filter((f) => f.stage === 'canonical_initiative')).toEqual([]);

    const counts1 = await sql.query<{ legacy: string; kanon: string }>(
      `SELECT
         (SELECT count(*)::int FROM initiatives WHERE organization_id=$1) AS legacy,
         (SELECT count(*)::int FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='initiative') AS kanon`,
      [organizationId]
    );
    expect(counts1.rows[0]).toEqual({ legacy: 22, kanon: 22 });

    const receipts1 = await sql.query<{ c: string }>(
      `SELECT count(*)::int AS c FROM ie_command_receipts WHERE organization_id=$1`,
      [organizationId]
    );
    // 22 x (source-proposal.submit + initiative.register) = 44 recepty.
    expect(Number(receipts1.rows[0].c)).toBe(44);

    // Z30: nic nie zostalo DORECZONE (zaden drenaz outboxu nie dziala w tym procesie).
    const delivery1 = await sql.query<{ c: string }>(
      `SELECT count(*)::int AS c FROM ie_outbox_delivery_receipts WHERE organization_id=$1`,
      [organizationId]
    );
    expect(Number(delivery1.rows[0].c)).toBe(0);

    // --- Drugi seed, ta sama organizacja, ta sama kotwica czasu ---
    const result2 = await seedAtelierToysDemoDataset({ organizationId, anchorDate, locale: 'en' });
    expect(result2.counts.initiatives).toBe(22);
    // Drugi przebieg: nadal 22 (REPLAYED, nie duplikaty) — nie 44.
    expect(result2.counts.canonicalInitiatives).toBe(22);

    const counts2 = await sql.query<{ legacy: string; kanon: string }>(
      `SELECT
         (SELECT count(*)::int FROM initiatives WHERE organization_id=$1) AS legacy,
         (SELECT count(*)::int FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='initiative') AS kanon`,
      [organizationId]
    );
    expect(counts2.rows[0]).toEqual({ legacy: 22, kanon: 22 });

    // Idempotencja twarda: zero nowych receptow na drugim przebiegu.
    const receipts2 = await sql.query<{ c: string }>(
      `SELECT count(*)::int AS c FROM ie_command_receipts WHERE organization_id=$1`,
      [organizationId]
    );
    expect(Number(receipts2.rows[0].c)).toBe(44);

    // Zero agregatow source_proposal net-new na drugim przebiegu.
    const proposals2 = await sql.query<{ c: string }>(
      `SELECT count(*)::int AS c FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='source_proposal'`,
      [organizationId]
    );
    expect(Number(proposals2.rows[0].c)).toBe(22);

    // Z30 po drugim przebiegu — nadal 0.
    const delivery2 = await sql.query<{ c: string }>(
      `SELECT count(*)::int AS c FROM ie_outbox_delivery_receipts WHERE organization_id=$1`,
      [organizationId]
    );
    expect(Number(delivery2.rows[0].c)).toBe(0);
  }, 120_000);

  it('sprzatanie sesji demo (w1a) kasuje TAKZE agregaty kanonu tej organizacji', async () => {
    if (!sql) throw new Error('beforeAll nie ustanowil polaczenia SQL.');

    await deleteDemoDatasetForOrganization(organizationId);

    const remaining = await sql.query<{
      legacy: string;
      kanon: string;
      candidates: string;
      receipts: string;
      audit: string;
      outbox: string;
      relations: string;
    }>(
      `SELECT
         (SELECT count(*)::int FROM initiatives WHERE organization_id=$1) AS legacy,
         (SELECT count(*)::int FROM ie_aggregate_state WHERE organization_id=$1) AS kanon,
         (SELECT count(*)::int FROM initiative_candidates WHERE organization_id=$1) AS candidates,
         (SELECT count(*)::int FROM ie_command_receipts WHERE organization_id=$1) AS receipts,
         (SELECT count(*)::int FROM ie_audit_events WHERE organization_id=$1) AS audit,
         (SELECT count(*)::int FROM ie_outbox_events WHERE organization_id=$1) AS outbox,
         (SELECT count(*)::int FROM ie_aggregate_relations WHERE organization_id=$1) AS relations`,
      [organizationId]
    );
    expect(remaining.rows[0]).toEqual({
      legacy: 0,
      kanon: 0,
      candidates: 0,
      receipts: 0,
      audit: 0,
      outbox: 0,
      relations: 0,
    });

    // Re-seed dla nastepnego testu w pliku (afterAll sprzata na koniec) —
    // bez tego drugi `it` zostawia organizacje pusta i afterAll nie ma czego
    // kasowac (co jest OK — deleteDemoDatasetForOrganization jest idempotentne).
  }, 30_000);
});
