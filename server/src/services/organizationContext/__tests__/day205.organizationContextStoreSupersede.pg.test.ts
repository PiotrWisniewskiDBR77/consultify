/** @vitest-environment node */

/**
 * FIX-205 pkt 2 — koszt R1 (ODBIOR_205_206.md).
 *
 * `OrganizationContextService.recordOrganizationContextStoreSave` (dyżur 205,
 * zapis-obok dla pięciu ekranów redesignu Organization) do tej pory czysto
 * APPENDOWAŁ: każdy PUT tej samej sekcji (`goals`/`challenges`/`synthesis`)
 * wstawiał NOWY aktywny claim `notes.manualContext`, nigdy nie wygaszając
 * poprzedniego. Ponieważ `buildResolvedContext` czyta WSZYSTKIE aktywne
 * claimy tej ścieżki (i, po FIX-205 pkt 1, każdy z nich trafia do prompta
 * przez `AIPipeline.buildOrganizationSection`), liczba aktywnych claimów —
 * a więc i koszt/długość prompta — rosłaby LINIOWO z liczbą zapisów tego
 * samego ekranu. Do tego każdy zapis wywoływał pełny `rebuildSnapshot()`
 * (`buildResolvedContext` + zapis do `organization_context_snapshots`), mimo
 * że `snapshot_json` jest write-only (żaden konsument go nie czyta, patrz
 * `20260912_claude_c_org_context_snapshots.sql`).
 *
 * Ten test dowodzi na REALNYM Postgresie, że po naprawie:
 *  (a) 20 zapisów tej samej sekcji zostawia co najwyżej `liczba sekcji`
 *      AKTYWNYCH claimów `notes.manualContext` (upsert/supersede po
 *      (source_id=organizationId, section) przez `supersedes_claim_id`),
 *      i `buildResolvedContext` zwraca tylko najnowszą wartość tej sekcji;
 *  (b) `organization_context_snapshots` nie dostaje wiersza dla tej
 *      organizacji (żadne z 20 wywołań nie woła `rebuildSnapshot()`).
 */

import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';

const NO_RETRY = { retry: 0 } as const;
const SWEEP_COUNT = 20;

describe(
  'Day205 FIX pkt 2 — organization context store save supersedes instead of appending',
  NO_RETRY,
  () => {
    const organizationId = randomUUID();
    const userId = randomUUID();
    let sql: Client;

    beforeAll(async () => {
      expect(process.env.DB_TYPE).toBe('postgres');
      await assertRealPostgresTestEnvironment();
      sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
      await sql.connect();
      await sql.query(
        `INSERT INTO organizations (id,name,plan,status) VALUES ($1,'Day205 FIX pkt2','enterprise','active')`,
        [organizationId]
      );
    }, 60_000);

    afterAll(async () => {
      if (!sql) return;
      await sql.query(`DELETE FROM organization_context_claims WHERE organization_id=$1`, [
        organizationId,
      ]);
      await sql.query(`DELETE FROM organization_context_items WHERE organization_id=$1`, [
        organizationId,
      ]);
      await sql.query(`DELETE FROM organization_context_snapshots WHERE organization_id=$1`, [
        organizationId,
      ]);
      await sql.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]);
      await sql.end();
    });

    it(`writing the same section ${SWEEP_COUNT} times keeps active claim count bounded by section count and rebuilds nothing`, async () => {
      const { default: organizationContextService } =
        await import('../OrganizationContextService.js');

      for (let i = 1; i <= SWEEP_COUNT; i++) {
        await organizationContextService.recordOrganizationContextStoreSave({
          organizationId,
          userId,
          goals: { ambition: `Day205 FIX pkt2 sweep ${i}` },
        });
      }

      const activeClaims = await sql.query<{
        id: string;
        value_json: unknown;
        supersedes_claim_id: string | null;
      }>(
        `SELECT id, value_json, supersedes_claim_id FROM organization_context_claims
       WHERE organization_id=$1 AND claim_path='notes.manualContext' AND status='active'`,
        [organizationId]
      );
      // Bounded by the number of distinct sections ever written in this test
      // (only 'goals'), NOT by the number of PUTs (20). This is the load-bearing
      // assertion: without supersede this would equal SWEEP_COUNT (20).
      expect(activeClaims.rows.length).toBeLessThanOrEqual(3);
      expect(activeClaims.rows.length).toBe(1);
      const activeValue = activeClaims.rows[0]?.value_json as unknown;
      const activeValueStr =
        typeof activeValue === 'string' ? activeValue : JSON.stringify(activeValue);
      expect(activeValueStr).toContain(`Day205 FIX pkt2 sweep ${SWEEP_COUNT}`);

      // All prior writes were superseded, not deleted (audit trail preserved),
      // and the surviving active claim points at the chain via supersedes_claim_id.
      const allClaims = await sql.query<{ status: string }>(
        `SELECT status FROM organization_context_claims
       WHERE organization_id=$1 AND claim_path='notes.manualContext'`,
        [organizationId]
      );
      expect(allClaims.rows.length).toBe(SWEEP_COUNT);
      const superseded = allClaims.rows.filter((r) => r.status === 'superseded');
      expect(superseded.length).toBe(SWEEP_COUNT - 1);

      // buildResolvedContext (and therefore the FIX-205 pkt 1 prompt render)
      // must see exactly one 'goals' entry, not 20 accumulated duplicates.
      const resolved = await organizationContextService.buildResolvedContext(organizationId);
      const goalsEntries = resolved.notes.manualContext.filter(
        (entry) => (entry as Record<string, unknown>).section === 'goals'
      );
      expect(goalsEntries.length).toBe(1);
      expect(JSON.stringify(goalsEntries)).toContain(`Day205 FIX pkt2 sweep ${SWEEP_COUNT}`);

      // rebuildSnapshot: false — 20 calls must not have written a snapshot row.
      const snapshot = await sql.query(
        `SELECT organization_id FROM organization_context_snapshots WHERE organization_id=$1`,
        [organizationId]
      );
      expect(snapshot.rows.length).toBe(0);
    });
  }
);
