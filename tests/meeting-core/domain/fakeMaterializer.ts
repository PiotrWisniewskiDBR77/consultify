/**
 * fakeMaterializer.ts — test double for OutputTargetMaterializer, backed by
 * the SAME scratch-PG pool as everything else in a given test. Writes into
 * the `tasks`/`decisions` tables from tests/meeting-core/pg/schema.ts,
 * exactly the way the real production adapter
 * (server/src/services/meetingCore/outputsMaterializer.ts) writes into the
 * real tables — same source_type/source_id contract — just without pulling
 * in TaskService/decisionService/DatabaseConfig.ts (see outputsMaterializer.ts
 * docstring for why that must never happen inside this isolated test suite).
 */

import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';

import type { OutputTargetMaterializer } from '../../../server/src/services/meetingCore/outputsMaterializer.js';

const SOURCE_TYPE = 'MEETING_OUTPUT';

export interface FakeMaterializerOptions {
  /** Throw on the Nth call (1-indexed) to createTask instead of inserting. */
  failTaskOnAttempt?: number;
  /** Throw on the Nth call (1-indexed) to createDecision instead of inserting. */
  failDecisionOnAttempt?: number;
}

export function createFakeMaterializer(
  pool: Pool,
  options: FakeMaterializerOptions = {}
): OutputTargetMaterializer {
  let taskAttempts = 0;
  let decisionAttempts = 0;

  return {
    async createTask(input) {
      taskAttempts += 1;
      if (options.failTaskOnAttempt === taskAttempts) {
        throw new Error(
          `[fakeMaterializer] simulated createTask failure (attempt ${taskAttempts})`
        );
      }
      const id = `task-${randomUUID()}`;
      await pool.query(
        `INSERT INTO tasks (id, organization_id, title, description, status, created_by, source_type, source_id)
         VALUES ($1, $2, $3, $4, 'todo', $5, $6, $7)`,
        [
          id,
          input.organizationId,
          input.title,
          input.description || null,
          'fake-materializer',
          SOURCE_TYPE,
          input.sourceId,
        ]
      );
      return { id };
    },

    async createDecision(input) {
      decisionAttempts += 1;
      if (options.failDecisionOnAttempt === decisionAttempts) {
        throw new Error(
          `[fakeMaterializer] simulated createDecision failure (attempt ${decisionAttempts})`
        );
      }
      const id = `decision-${randomUUID()}`;
      await pool.query(
        `INSERT INTO decisions (id, organization_id, title, description, type, decision_maker_id, created_by, source_type, source_id)
         VALUES ($1, $2, $3, $4, 'APPROVAL', $5, $6, $7, $8)`,
        [
          id,
          input.organizationId,
          input.title,
          input.description || null,
          input.decisionMakerId,
          'fake-materializer',
          SOURCE_TYPE,
          input.sourceId,
        ]
      );
      return { id };
    },

    async findTaskBySource(organizationId, sourceId) {
      const result = await pool.query<{ id: string }>(
        `SELECT id FROM tasks WHERE organization_id = $1 AND source_type = $2 AND source_id = $3 LIMIT 1`,
        [organizationId, SOURCE_TYPE, sourceId]
      );
      return result.rows[0] ? { id: result.rows[0].id } : null;
    },

    async findDecisionBySource(organizationId, sourceId) {
      const result = await pool.query<{ id: string }>(
        `SELECT id FROM decisions WHERE organization_id = $1 AND source_type = $2 AND source_id = $3 LIMIT 1`,
        [organizationId, SOURCE_TYPE, sourceId]
      );
      return result.rows[0] ? { id: result.rows[0].id } : null;
    },
  };
}

export async function countTasksBySource(
  pool: Pool,
  organizationId: string,
  sourceId: string
): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT count(*) FROM tasks WHERE organization_id = $1 AND source_type = $2 AND source_id = $3`,
    [organizationId, SOURCE_TYPE, sourceId]
  );
  return Number(result.rows[0]?.count || 0);
}
