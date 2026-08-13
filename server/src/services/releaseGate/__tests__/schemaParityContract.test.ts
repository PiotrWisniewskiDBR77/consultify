/**
 * Schema parity contracts for 542 / 548 / 573.
 *
 * These three migrations were approved on their exact (stored, current) checksum pair, but a
 * checksum only proves WHICH bytes ran — not that the resulting schema is acceptable. Each of
 * these produced a live shape that differs from a fresh install, so the evaluator additionally
 * re-proves the live shape on every evaluation via POSTCONDITION_ATTESTATIONS.
 *
 * Exercises the REAL exported attestation functions and the REAL evaluator. No logic is rebuilt
 * here; the DB is a thin query double so every branch (including the unsupported-type branch,
 * which is hard to create in a real database) is reachable.
 */
import { describe, expect, it } from 'vitest';

import {
  POSTCONDITION_ATTESTATIONS,
  attestApiKeyStatusContract,
  attestCommunicationPlanKeyParity,
  attestSteeringBoardTimestamps,
} from '../schemaAttestation.js';

/** Returns rows per SQL fragment matched, so one double can serve several queries. */
function db(routes: Array<[RegExp, any[]]>) {
  return {
    query: async (sql: string) => {
      for (const [re, rows] of routes) if (re.test(sql)) return { rows };
      return { rows: [] };
    },
  } as any;
}

describe('postcondition registry', () => {
  it('covers exactly the three divergent migrations', () => {
    expect(Object.keys(POSTCONDITION_ATTESTATIONS).sort()).toEqual([
      '542_project_members_consultant_overlay_and_steering_board.sql',
      '548_audit_log_api_keys_compatibility.sql',
      '573_people_change_comms_t043_t044_t045.sql',
    ]);
  });
});

describe('542 — steering-board timestamp parity', () => {
  const cols = (type: string) => [
    { table_name: 'project_steering_board', column_name: 'created_at', data_type: type },
    { table_name: 'project_steering_board', column_name: 'updated_at', data_type: type },
    { table_name: 'project_steering_board_members', column_name: 'created_at', data_type: type },
    { table_name: 'project_steering_board_members', column_name: 'updated_at', data_type: type },
  ];

  it('PASSES on the canonical timestamptz shape', async () => {
    const r = await attestSteeringBoardTimestamps(db([[/information_schema\.columns/, cols('timestamp with time zone')]]));
    expect(r.attested).toBe(true);
    expect(r.checks.every((c) => c.ok)).toBe(true);
  });

  it('PASSES on timestamp without time zone (still a real timestamp type)', async () => {
    const r = await attestSteeringBoardTimestamps(db([[/information_schema\.columns/, cols('timestamp without time zone')]]));
    expect(r.attested).toBe(true);
  });

  it('FAILS CLOSED on the unconverged legacy TEXT shape and names the repair', async () => {
    const r = await attestSteeringBoardTimestamps(db([[/information_schema\.columns/, cols('text')]]));
    expect(r.attested).toBe(false);
    expect(r.failureReason).toMatch(/20260813_repair_d_steering_board_timestamptz/);
    expect(r.checks.filter((c) => !c.ok)).toHaveLength(4);
  });

  it('PASSES when the feature tables are absent entirely', async () => {
    const r = await attestSteeringBoardTimestamps(db([]));
    expect(r.attested).toBe(true);
  });

  it('FAILS CLOSED when the attestation query throws', async () => {
    const r = await attestSteeringBoardTimestamps({
      query: async () => {
        throw new Error('db down');
      },
    } as any);
    expect(r.attested).toBe(false);
  });
});

describe('548 — api_keys status contract works for both integer and boolean', () => {
  const cols = (isActiveType: string | null, withStatus = true) => [
    ...(isActiveType ? [{ column_name: 'is_active', data_type: isActiveType }] : []),
    ...(withStatus ? [{ column_name: 'status', data_type: 'text' }] : []),
  ];

  it('PASSES on INTEGER (the shape on demo AND on a fresh install)', async () => {
    const r = await attestApiKeyStatusContract(db([[/information_schema\.columns/, cols('integer')]]));
    expect(r.attested).toBe(true);
  });

  it('PASSES on BOOLEAN', async () => {
    const r = await attestApiKeyStatusContract(db([[/information_schema\.columns/, cols('boolean')]]));
    expect(r.attested).toBe(true);
  });

  it.each(['smallint', 'bigint'])('PASSES on %s', async (t) => {
    const r = await attestApiKeyStatusContract(db([[/information_schema\.columns/, cols(t)]]));
    expect(r.attested).toBe(true);
  });

  it('FAILS CLOSED on an unsupported type (text)', async () => {
    const r = await attestApiKeyStatusContract(db([[/information_schema\.columns/, cols('text')]]));
    expect(r.attested).toBe(false);
    expect(r.failureReason).toMatch(/not supported by the status contract/);
  });

  it('FAILS CLOSED when status is missing', async () => {
    const r = await attestApiKeyStatusContract(db([[/information_schema\.columns/, cols('integer', false)]]));
    expect(r.attested).toBe(false);
  });

  it('PASSES when api_keys is absent entirely', async () => {
    const r = await attestApiKeyStatusContract(db([]));
    expect(r.attested).toBe(true);
  });
});

describe('573 — communication plan key parity (UUID or TEXT, but never mixed)', () => {
  const cols = (planType: string, itemType: string) => [
    { table_name: 'communication_plans', column_name: 'id', data_type: planType },
    { table_name: 'communication_plan_items', column_name: 'plan_id', data_type: itemType },
  ];
  const fkPresent: Array<[RegExp, any[]]> = [[/pg_constraint/, [{ conname: 'communication_plan_items_plan_id_fkey' }]]];

  it('PASSES on uuid/uuid — the demo shape', async () => {
    const r = await attestCommunicationPlanKeyParity(
      db([[/information_schema\.columns/, cols('uuid', 'uuid')], ...fkPresent])
    );
    expect(r.attested).toBe(true);
  });

  it('PASSES on text/text — the fresh-install shape', async () => {
    const r = await attestCommunicationPlanKeyParity(
      db([[/information_schema\.columns/, cols('text', 'text')], ...fkPresent])
    );
    expect(r.attested).toBe(true);
  });

  it('FAILS CLOSED on a uuid/text MISMATCH', async () => {
    const r = await attestCommunicationPlanKeyParity(
      db([[/information_schema\.columns/, cols('uuid', 'text')], ...fkPresent])
    );
    expect(r.attested).toBe(false);
    expect(r.failureReason).toMatch(/key type mismatch/);
  });

  it('FAILS CLOSED when the FK is missing', async () => {
    const r = await attestCommunicationPlanKeyParity(db([[/information_schema\.columns/, cols('uuid', 'uuid')]]));
    expect(r.attested).toBe(false);
    expect(r.failureReason).toMatch(/no FK to communication_plans/);
  });

  it('FAILS CLOSED when only one side of the pair exists', async () => {
    const r = await attestCommunicationPlanKeyParity(
      db([[/information_schema\.columns/, [{ table_name: 'communication_plans', column_name: 'id', data_type: 'uuid' }]]])
    );
    expect(r.attested).toBe(false);
  });

  it('PASSES when neither table exists', async () => {
    const r = await attestCommunicationPlanKeyParity(db([]));
    expect(r.attested).toBe(true);
  });
});
