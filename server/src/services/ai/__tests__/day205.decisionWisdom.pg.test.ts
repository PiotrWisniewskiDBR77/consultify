/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';

const NO_RETRY = { retry: 0 } as const;

describe(
  'Day205 R3 chat recommendation enters decision memory on real PostgreSQL',
  NO_RETRY,
  () => {
    const organizationId = randomUUID();
    const userId = randomUUID();
    const title = `Day205 expand industrial service ${randomUUID().slice(0, 8)}`;
    let sql: Client;
    let decisionId = '';
    let memoryId = '';
    let generateSectionSpy: ReturnType<typeof vi.spyOn>;

    beforeAll(async () => {
      expect(process.env.DB_TYPE).toBe('postgres');
      await assertRealPostgresTestEnvironment();
      sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
      await sql.connect();
      await sql.query(
        `INSERT INTO organizations (id,name,plan,status) VALUES ($1,'Day205 R3','enterprise','active')`,
        [organizationId]
      );
      await sql.query(
        `INSERT INTO users (id,organization_id,email,password,role,status)
       VALUES ($1,$2,$3,'unused','ADMIN','active')`,
        [userId, organizationId, `${userId}@example.test`]
      );

      const { default: decisionService } = await import('../../decisionService.js');
      generateSectionSpy = vi
        .spyOn(decisionService, 'generateSection')
        .mockImplementation(async (_id: string, sectionKey: any) => {
          if (sectionKey === 'alternatives') {
            return {
              sectionKey,
              content: '',
              isJson: true,
              parsedContent: {
                alternatives: [
                  { title: 'Expand industrial service', pros: ['growth'], cons: ['capacity'] },
                  { title: 'Keep current scope', pros: ['focus'], cons: ['slower growth'] },
                ],
              },
              model: 'day205-test',
              tokensUsed: 0,
            };
          }
          if (sectionKey === 'risk') {
            return {
              sectionKey,
              content: '',
              isJson: true,
              parsedContent: {
                risks: [{ title: 'Capacity', probability: 'medium', impact: 'high' }],
              },
              model: 'day205-test',
              tokensUsed: 0,
            };
          }
          return {
            sectionKey,
            content:
              'Bezczynność ograniczy wzrost.\n\nRekomendacja: Rozszerzyć usługę przemysłową etapami. Uzasadnienie: Popyt jest potwierdzony.',
            isJson: false,
            parsedContent: undefined,
            model: 'day205-test',
            tokensUsed: 0,
          };
        });
    }, 60_000);

    afterAll(async () => {
      generateSectionSpy?.mockRestore();
      if (!sql) return;
      await sql.query(`DELETE FROM ai_decision_outcomes WHERE organization_id=$1`, [
        organizationId,
      ]);
      if (decisionId) await sql.query(`DELETE FROM decisions WHERE id=$1`, [decisionId]);
      await sql.query(`DELETE FROM users WHERE id=$1`, [userId]);
      await sql.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]);
      await sql.end();
    });

    it('records the recommendation, remains pending until outcome, then becomes findable', async () => {
      const { createDecision } = await import('../tools/createDecision.js');
      const created = await createDecision(
        { title, description: 'Choose the next industrial growth move.' },
        { organizationId, userId, language: 'pl' }
      );
      expect(created).toMatchObject({ ok: true, kind: 'decision', title });
      decisionId = String(created.id);

      let memoryRows: Array<{
        id: string;
        decision_summary: string;
        recommendation_text: string;
        outcome_status: string;
      }> = [];
      for (let attempt = 0; attempt < 80 && memoryRows.length === 0; attempt += 1) {
        const result = await sql.query(
          `SELECT id,decision_summary,recommendation_text,outcome_status
         FROM ai_decision_outcomes WHERE organization_id=$1 AND session_id=$2`,
          [organizationId, decisionId]
        );
        memoryRows = result.rows;
        if (!memoryRows.length) await new Promise((resolve) => setTimeout(resolve, 50));
      }
      expect(memoryRows).toHaveLength(1);
      expect(memoryRows[0]).toMatchObject({
        decision_summary: title,
        outcome_status: 'pending',
      });
      expect(memoryRows[0].recommendation_text).toContain('Rozszerzyć usługę przemysłową');
      memoryId = memoryRows[0].id;

      const { findSimilarDecisions, recordOutcome } = await import('../decisionMemoryService.js');
      expect(await findSimilarDecisions({ organizationId, query: title })).toEqual([]);
      await recordOutcome({ decisionId: memoryId, outcomeStatus: 'neutral' });
      const similar = await findSimilarDecisions({ organizationId, query: title });
      expect(similar).toHaveLength(1);
      expect(similar[0].decision).toMatchObject({
        id: memoryId,
        decisionSummary: title,
        outcomeStatus: 'neutral',
      });
    });
  }
);
