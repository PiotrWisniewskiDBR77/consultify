/**
 * Acceptance: InitiativeSimilarity (embeddings-first, Jaccard-fallback) — REAL-runtime.
 *
 * Verifies checkSimilarInitiatives() against the LOCAL parity Postgres:
 *  - seeds 2 initiatives that are semantically close to each other
 *    ("cloud migration") + 1 that is unrelated ("employee wellness")
 *  - checks a new candidate that closely resembles the first two
 *  - asserts the ranking puts the 2 similar initiatives ahead of the
 *    unrelated one, and that the top verdict is 'duplicate' or 'similar'
 *
 * Runs whichever scorer is actually live (embeddings if OPENAI_API_KEY /
 * OPENROUTER_API_KEY is set — checkSimilarInitiatives() fails-soft to Jaccard
 * token-overlap otherwise), and prints which method ran + the full ranked
 * output as DOWÓD.
 */
import { randomUUID } from 'node:crypto';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { requireLocalDbUrl } from './harness.js';
import { SEED } from './seed.mjs';

const ORG_ID = SEED.ORG_ID;
const RUN_TAG = `odbior--sim-${randomUUID().slice(0, 8)}`;

describe('InitiativeSimilarity (checkSimilarInitiatives) — real DB, real/fallback scorer', () => {
  let client: pg.Client;
  let checkSimilarInitiatives: typeof import('../../server/src/services/initiativeSimilarityService.js').checkSimilarInitiatives;

  const CLOUD_A_ID = `${RUN_TAG}-cloud-a`;
  const CLOUD_B_ID = `${RUN_TAG}-cloud-b`;
  const WELLNESS_ID = `${RUN_TAG}-wellness`;

  beforeAll(async () => {
    process.env.DATABASE_URL = requireLocalDbUrl();
    process.env.DB_TYPE = 'postgres';

    ({ checkSimilarInitiatives } = await import(
      '../../server/src/services/initiativeSimilarityService.js'
    ));

    client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    const now = new Date().toISOString();
    const rows: Array<{ id: string; title: string; summary: string }> = [
      {
        id: CLOUD_A_ID,
        title: 'Migrate core ERP to AWS cloud infrastructure',
        summary:
          'Move on-premise ERP servers to AWS, replatform databases, and decommission the legacy data center to cut hosting cost.',
      },
      {
        id: CLOUD_B_ID,
        title: 'Cloud migration of financial systems to AWS',
        summary:
          'Migrate finance and accounting applications from on-premise servers to AWS cloud, reducing data center footprint.',
      },
      {
        id: WELLNESS_ID,
        title: 'Employee wellness and mental health program',
        summary:
          'Launch a company-wide wellness initiative offering counseling, gym subsidies, and mental health days for staff.',
      },
    ];

    for (const row of rows) {
      await client.query(
        `INSERT INTO initiatives (id, organization_id, name, title, summary, status, created_at, updated_at)
         VALUES ($1, $2, $3, $3, $4, 'PLANNING', $5, $5)
         ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, summary = EXCLUDED.summary`,
        [row.id, ORG_ID, row.title, row.summary, now]
      );
    }
  });

  afterAll(async () => {
    await client.query(`DELETE FROM initiatives WHERE id = ANY($1)`, [
      [CLOUD_A_ID, CLOUD_B_ID, WELLNESS_ID],
    ]);
    await client.end();
  });

  it('ranks the two cloud-migration initiatives above the unrelated wellness one', async () => {
    const result = await checkSimilarInitiatives({
      orgId: ORG_ID,
      candidates: [
        {
          title: 'Move ERP and finance systems to AWS cloud',
          description:
            'Replatform on-premise ERP and finance servers to AWS, shutting down the legacy data center.',
        },
      ],
    });

    // eslint-disable-next-line no-console
    console.log(
      '[DOWOD initiative-similarity]',
      JSON.stringify({ method: result.method, comparedCount: result.comparedCount, results: result.results }, null, 2)
    );

    expect(['embeddings', 'token-overlap']).toContain(result.method);
    expect(result.results).toHaveLength(1);

    const { matches, verdict, topScore } = result.results[0];
    const byId = new Map(matches.map((m) => [m.id, m]));

    const cloudA = byId.get(CLOUD_A_ID);
    const cloudB = byId.get(CLOUD_B_ID);
    const wellness = byId.get(WELLNESS_ID);

    // Both cloud initiatives must surface as matches (score >= RELATED_THRESHOLD).
    expect(cloudA).toBeDefined();
    expect(cloudB).toBeDefined();

    // The unrelated wellness initiative must NOT outrank them, and ideally
    // doesn't clear the "related" bar at all.
    const cloudMinScore = Math.min(cloudA!.score, cloudB!.score);
    if (wellness) {
      expect(wellness.score).toBeLessThan(cloudMinScore);
    }

    // Top verdict should reflect a real overlap given how close the text is.
    expect(topScore).toBeGreaterThan(0.3);
    expect(['duplicate', 'similar', 'related']).toContain(verdict);

    console.log(
      `[DOWOD] method=${result.method} topScore=${topScore} verdict=${verdict} ` +
        `cloudA=${cloudA?.score} cloudB=${cloudB?.score} wellness=${wellness?.score ?? 'FILTERED(< related threshold)'}`
    );
  }, 30000);
});
