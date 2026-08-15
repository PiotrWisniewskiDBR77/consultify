/**
 * helpers.ts — shared scratch-PG bootstrap + fixtures for
 * tests/meeting-core/domain/**.
 *
 * Every domain test file boots its OWN scratch-PG container (mirrors the
 * existing convention in tests/meeting-core/pg/__tests__/*.test.ts — each
 * file/describe block does its own beforeAll/afterAll). vitest.meeting-core.
 * config.ts runs files sequentially (fileParallelism: false, pool: 'forks'),
 * so there is no cross-file container sharing to engineer around.
 */

import { randomUUID } from 'node:crypto';
import { Client, Pool } from 'pg';

import { startScratchPg, type ScratchPg } from '../pg/scratchPg.js';
import { createMeetingCoreSchema } from '../pg/schema.js';
import { applyMeetingCoreMigration } from './schema.js';

export interface DomainTestDb {
  scratch: ScratchPg;
  pool: Pool;
  teardown: () => Promise<void>;
}

export async function setupDomainTestDb(): Promise<DomainTestDb> {
  const scratch = await startScratchPg();

  // Bootstrap the schema with a plain Client (matches the pg harness's own
  // convention), then hand off to a Pool for the actual meetingCore code
  // under test — meetingCore only ever talks to Pool/PoolClient.
  const bootstrapClient = new Client({ connectionString: scratch.url });
  await bootstrapClient.connect();
  try {
    await createMeetingCoreSchema(bootstrapClient);
    await applyMeetingCoreMigration(bootstrapClient);
  } finally {
    await bootstrapClient.end();
  }

  const pool = new Pool({ connectionString: scratch.url });

  const teardown = async (): Promise<void> => {
    await pool.end();
    await scratch.stop();
  };

  return { scratch, pool, teardown };
}

export function makeOrgId(label = 'org'): string {
  return `${label}-${randomUUID().slice(0, 8)}`;
}

export function makeUserId(label = 'user'): string {
  return `${label}-${randomUUID().slice(0, 8)}`;
}
