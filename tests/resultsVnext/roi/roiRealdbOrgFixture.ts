/**
 * CLOSEOUT-CO5 — the one shared `organizations` fixture precondition for
 * every ROI realdb suite.
 *
 * WHY THIS EXISTS. On a fully-migrated Postgres, `initiatives
 * .organization_id` carries a real FK (`initiatives_organization_id_fkey`)
 * to `organizations(id)`. Most ROI realdb suites open their `beforeAll`
 * with a defensive `CREATE TABLE IF NOT EXISTS initiatives (...)` — a
 * three-column stub for the resultsVnext-slice-only schema. Against the
 * real schema that statement is a silent no-op: the table already exists,
 * WITH the FK. Any suite that then inserts an initiative without first
 * creating its organization row fails with a 23503, and the stub in its
 * own `beforeAll` makes the failure look like a schema problem rather than
 * the missing precondition it is.
 *
 * Eighteen suites had exactly that gap. Rather than paste the same INSERT
 * eighteen times (the shape the already-green suites each grew
 * independently), they all call this one helper. `ON CONFLICT DO NOTHING`
 * keeps it safe to call from a `beforeAll` that may re-run, and safe for
 * suites whose org id is not per-run unique.
 *
 * NOT a `.test.ts` file — vitest never collects it.
 */
import type { Client } from 'pg';

export async function ensureRoiFixtureOrganization(
  client: Client,
  organizationId: string,
  name: string
): Promise<void> {
  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, $2, 'enterprise', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [organizationId, name]
  );
}
