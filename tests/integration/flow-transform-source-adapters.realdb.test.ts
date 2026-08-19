import fs from 'node:fs/promises';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://consultinity:consultinity@localhost:5442/consultinity';
process.env.DATABASE_URL = DATABASE_URL;
process.env.DB_TYPE = 'postgres';

const prefix = `flow-transform-${Date.now()}`;
const orgA = `${prefix}-a`;
const orgB = `${prefix}-b`;
const actor = `${prefix}-actor`;
const snapshotId = `${prefix}-snapshot`;
const hash = 'a'.repeat(64);

let service: typeof import('../../server/src/services/organizationContext/organizationSnapshotCandidateHandoffService.js');

async function db() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  return client;
}

beforeAll(async () => {
  const client = await db();
  try {
    await client.query(
      await fs.readFile('server/migrations/20261035_flow_transform_source_lineage.sql', 'utf8')
    );
    await client.query(
      `INSERT INTO organization_context_snapshot_versions
        (id, organization_id, version, schema_version, content_hash, claim_count, snapshot_json, source_refs_json, created_by)
       VALUES ($1,$2,1,1,$3,1,$4,'[]',$5)`,
      [
        snapshotId,
        orgA,
        hash,
        JSON.stringify({ organizationId: orgA, schemaVersion: 1, claims: [{ claimId: 'c1' }] }),
        actor,
      ]
    );
  } finally {
    await client.end();
  }
  service =
    await import('../../server/src/services/organizationContext/organizationSnapshotCandidateHandoffService.js');
});

afterAll(async () => {
  service?.setOrganizationSnapshotCandidateHandoffFaultInjectorForTests(null);
});

describe('FLOW source adapter — governed Organization snapshot', () => {
  it('creates one canonical Candidate and reopens the exact immutable receipt', async () => {
    const first = await service.handoffOrganizationSnapshotToCandidate({
      organizationId: orgA,
      snapshotId,
      snapshotVersion: 1,
      snapshotContentHash: hash,
      actorId: actor,
    });
    const replay = await service.handoffOrganizationSnapshotToCandidate({
      organizationId: orgA,
      snapshotId,
      snapshotVersion: 1,
      snapshotContentHash: hash,
      actorId: actor,
    });
    expect(first.created).toBe(true);
    expect(replay.created).toBe(false);
    expect(replay.candidate.id).toBe(first.candidate.id);
    expect(replay.receipt).toMatchObject({
      snapshotId,
      snapshotVersion: 1,
      snapshotContentHash: hash,
      candidateId: first.candidate.id,
    });
  });

  it('rejects stale, collision, and foreign references without writes', async () => {
    await expect(
      service.handoffOrganizationSnapshotToCandidate({
        organizationId: orgA,
        snapshotId,
        snapshotVersion: 2,
        snapshotContentHash: hash,
        actorId: actor,
      })
    ).rejects.toMatchObject({ code: 'SNAPSHOT_REF_STALE' });
    await expect(
      service.handoffOrganizationSnapshotToCandidate({
        organizationId: orgA,
        snapshotId,
        snapshotVersion: 1,
        snapshotContentHash: 'b'.repeat(64),
        actorId: actor,
      })
    ).rejects.toMatchObject({ code: 'SNAPSHOT_REF_STALE' });
    await expect(
      service.handoffOrganizationSnapshotToCandidate({
        organizationId: orgB,
        snapshotId,
        snapshotVersion: 1,
        snapshotContentHash: hash,
        actorId: actor,
      })
    ).rejects.toMatchObject({ code: 'SNAPSHOT_NOT_FOUND' });
  });

  it('serializes concurrent approval to one Candidate and one receipt', async () => {
    const client = await db();
    const id = `${snapshotId}-concurrent`;
    try {
      await client.query(
        `INSERT INTO organization_context_snapshot_versions (id,organization_id,version,schema_version,content_hash,claim_count,snapshot_json,source_refs_json,created_by) VALUES ($1,$2,2,1,$3,1,'{}','[]',$4)`,
        [id, orgA, 'c'.repeat(64), actor]
      );
    } finally {
      await client.end();
    }
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        service.handoffOrganizationSnapshotToCandidate({
          organizationId: orgA,
          snapshotId: id,
          snapshotVersion: 2,
          snapshotContentHash: 'c'.repeat(64),
          actorId: actor,
        })
      )
    );
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(new Set(results.map((r) => r.candidate.id)).size).toBe(1);
  });

  it('rolls Candidate back when receipt creation fails and protects receipts from mutation', async () => {
    const client = await db();
    const id = `${snapshotId}-rollback`;
    try {
      await client.query(
        `INSERT INTO organization_context_snapshot_versions (id,organization_id,version,schema_version,content_hash,claim_count,snapshot_json,source_refs_json,created_by) VALUES ($1,$2,3,1,$3,1,'{}','[]',$4)`,
        [id, orgA, 'd'.repeat(64), actor]
      );
    } finally {
      await client.end();
    }
    service.setOrganizationSnapshotCandidateHandoffFaultInjectorForTests(() => {
      throw new Error('injected');
    });
    await expect(
      service.handoffOrganizationSnapshotToCandidate({
        organizationId: orgA,
        snapshotId: id,
        snapshotVersion: 3,
        snapshotContentHash: 'd'.repeat(64),
        actorId: actor,
      })
    ).rejects.toThrow('injected');
    service.setOrganizationSnapshotCandidateHandoffFaultInjectorForTests(null);
    const verify = await db();
    try {
      expect(
        (
          await verify.query(
            `SELECT count(*)::int n FROM initiative_candidates WHERE organization_id=$1 AND source_id=$2`,
            [orgA, id]
          )
        ).rows[0].n
      ).toBe(0);
      await expect(
        verify.query(
          `UPDATE organization_snapshot_candidate_handoffs SET snapshot_content_hash=$1 WHERE organization_id=$2 AND snapshot_id=$3`,
          ['e'.repeat(64), orgA, snapshotId]
        )
      ).rejects.toMatchObject({ code: '23514' });
    } finally {
      await verify.end();
    }
  });
});
