/**
 * OKR-E001 — read repository.
 *
 * Design: docs/product/results-vnext/OKR_E001_DESIGN.md §7. Plain
 * `WHERE organization_id = $1` scoping — NOT `buildVisibilityScopedCte`
 * (Decision P2: Program/Cycle are org-wide configuration, no per-resource
 * ABAC row is ever written for them). Write auth is `requireOrgRole` at the
 * route layer, not `resolveVisibility()` here.
 */
import type { PoolClient, QueryResultRow } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';

import { toOkrProgram, type OkrProgram, type OkrProgramRow } from './okrProgramTypes.js';
import { toOkrCycle, type OkrCycle, type OkrCycleRow, type OkrCycleStatus } from './okrCycleTypes.js';

/** Same pinned-client-per-call shape as `roiRepository.ts`'s
 * `withReadClient` — no BEGIN/COMMIT needed for a read. */
async function withReadClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await acquirePgClient();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

async function queryRows<T extends QueryResultRow>(
  client: PoolClient,
  sql: string,
  values: unknown[]
): Promise<T[]> {
  const result = await client.query<T>(sql, values);
  return result.rows;
}

// ==========================================
// listPrograms
// ==========================================

export interface ListOkrProgramsParams {
  organizationId: string;
  status?: OkrProgramRow['status'];
  limit?: number;
  offset?: number;
}

export async function listPrograms(params: ListOkrProgramsParams): Promise<OkrProgram[]> {
  const { organizationId, status, limit = 100, offset = 0 } = params;

  const values: unknown[] = [organizationId];
  const filters: string[] = [];
  if (status) {
    values.push(status);
    filters.push(`status = $${values.length}`);
  }
  values.push(limit);
  const limitParamIndex = values.length;
  values.push(offset);
  const offsetParamIndex = values.length;

  const sql = `
    SELECT * FROM okr_vnext_programs
     WHERE organization_id = $1
       ${filters.length ? `AND ${filters.join(' AND ')}` : ''}
     ORDER BY updated_at DESC
     LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
  `;

  const rows = await withReadClient((client) => queryRows<OkrProgramRow>(client, sql, values));
  return rows.map(toOkrProgram);
}

// ==========================================
// getProgram
// ==========================================

export interface GetOkrProgramParams {
  organizationId: string;
  programId: string;
}

export async function getProgram(params: GetOkrProgramParams): Promise<OkrProgram | null> {
  const { organizationId, programId } = params;
  const rows = await withReadClient((client) =>
    queryRows<OkrProgramRow>(
      client,
      `SELECT * FROM okr_vnext_programs WHERE organization_id = $1 AND program_id = $2`,
      [organizationId, programId]
    )
  );
  const row = rows[0];
  return row ? toOkrProgram(row) : null;
}

// ==========================================
// listCycles
// ==========================================

export interface ListOkrCyclesParams {
  organizationId: string;
  programId?: string;
  status?: OkrCycleStatus;
  limit?: number;
  offset?: number;
}

export async function listCycles(params: ListOkrCyclesParams): Promise<OkrCycle[]> {
  const { organizationId, programId, status, limit = 100, offset = 0 } = params;

  const values: unknown[] = [organizationId];
  const filters: string[] = [];
  if (programId) {
    values.push(programId);
    filters.push(`program_id = $${values.length}`);
  }
  if (status) {
    values.push(status);
    filters.push(`status = $${values.length}`);
  }
  values.push(limit);
  const limitParamIndex = values.length;
  values.push(offset);
  const offsetParamIndex = values.length;

  const sql = `
    SELECT * FROM okr_vnext_cycles
     WHERE organization_id = $1
       ${filters.length ? `AND ${filters.join(' AND ')}` : ''}
     ORDER BY start_date DESC
     LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
  `;

  const rows = await withReadClient((client) => queryRows<OkrCycleRow>(client, sql, values));
  return rows.map(toOkrCycle);
}

// ==========================================
// getCycle
// ==========================================

export interface GetOkrCycleParams {
  organizationId: string;
  cycleId: string;
}

export async function getCycle(params: GetOkrCycleParams): Promise<OkrCycle | null> {
  const { organizationId, cycleId } = params;
  const rows = await withReadClient((client) =>
    queryRows<OkrCycleRow>(
      client,
      `SELECT * FROM okr_vnext_cycles WHERE organization_id = $1 AND cycle_id = $2`,
      [organizationId, cycleId]
    )
  );
  const row = rows[0];
  return row ? toOkrCycle(row) : null;
}
