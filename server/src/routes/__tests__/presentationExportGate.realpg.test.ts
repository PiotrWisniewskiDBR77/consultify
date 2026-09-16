/** @vitest-environment node */

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { enforceQualityGateForExport } from '../presentationExportGate.js';

const connectionString = process.env.DATABASE_URL || '';
const runRealPg =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  connectionString.startsWith('postgres');
const suite = runRealPg ? describe.sequential : describe.skip;

suite('presentation export review warnings — real PostgreSQL', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool({ connectionString, max: 2 });
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('turns a real persisted non-passing review into HTTP 200 advisory warnings', async () => {
    const rows = await pool.query(
      `SELECT id, organization_id, title
         FROM presentation_decks
        WHERE deck_json IS NOT NULL
        ORDER BY updated_at DESC NULLS LAST
        LIMIT 50`
    );
    expect(rows.rowCount).toBeGreaterThan(0);

    let evidence:
      | { deckId: string; organizationId: string; title: string; warningCount: number }
      | undefined;
    for (const row of rows.rows) {
      const result = await enforceQualityGateForExport({
        organizationId: String(row.organization_id),
        deckId: String(row.id),
        format: 'pptx',
      });
      if (result.warnings.length > 0) {
        expect(result.ok).toBe(true);
        expect(result.status).toBe(200);
        expect(result.payload.success).toBe(true);
        expect(result.payload.warnings).toEqual(result.warnings);
        evidence = {
          deckId: String(row.id),
          organizationId: String(row.organization_id),
          title: String(row.title),
          warningCount: result.warnings.length,
        };
        break;
      }
    }

    expect(evidence, 'expected at least one persisted deck with review findings').toBeDefined();
    console.info('REALPG_EXPORT_WARNING_EVIDENCE', evidence);
  });
});
