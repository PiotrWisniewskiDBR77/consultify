import { v4 as uuidv4 } from 'uuid';

import { type PgTransactionClient, withPgTransaction } from '../../utils/queryHelpers.js';
import { createCandidateFromSource } from '../initiative/initiativeCandidateService.js';

export class OrganizationSnapshotCandidateHandoffError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'OrganizationSnapshotCandidateHandoffError';
  }
}

type SnapshotRow = {
  id: string;
  version: number;
  content_hash: string;
  claim_count: number;
  snapshot_json: string;
};

type ReceiptRow = {
  id: string;
  organization_id: string;
  snapshot_id: string;
  snapshot_version: number;
  snapshot_content_hash: string;
  candidate_id: string;
  created_by: string;
  created_at: string | Date;
};

let testFaultInjector: (() => void | Promise<void>) | null = null;
export function setOrganizationSnapshotCandidateHandoffFaultInjectorForTests(
  injector: (() => void | Promise<void>) | null
) {
  if (process.env.NODE_ENV !== 'test') throw new Error('Fault injection is test-only');
  testFaultInjector = injector;
}

function candidateDb(tx: PgTransactionClient) {
  return {
    queryOne: async <T>(sql: string, params: unknown[] = []): Promise<T | null> =>
      (await tx.query<T>(sql, params)).rows[0] ?? null,
    queryAll: async <T>(sql: string, params: unknown[] = []): Promise<T[]> =>
      (await tx.query<T>(sql, params)).rows,
    queryRun: async (sql: string, params: unknown[] = []) => ({
      changes: (await tx.query(sql, params)).rowCount,
    }),
  };
}

function mapReceipt(row: ReceiptRow) {
  return {
    receiptId: row.id,
    organizationId: row.organization_id,
    snapshotId: row.snapshot_id,
    snapshotVersion: Number(row.snapshot_version),
    snapshotContentHash: row.snapshot_content_hash,
    candidateId: row.candidate_id,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function handoffOrganizationSnapshotToCandidate(input: {
  organizationId: string;
  snapshotId: string;
  snapshotVersion: number;
  snapshotContentHash: string;
  actorId: string;
}) {
  if (!input.snapshotId || !Number.isInteger(input.snapshotVersion) || input.snapshotVersion < 1) {
    throw new OrganizationSnapshotCandidateHandoffError(
      'SNAPSHOT_REF_INVALID',
      400,
      'Exact snapshot reference is required'
    );
  }
  return withPgTransaction(async (tx) => {
    await tx.query('SELECT pg_advisory_xact_lock(hashtext(?), hashtext(?))', [
      input.organizationId,
      `organization-snapshot:${input.snapshotId}`,
    ]);
    const snapshot = (
      await tx.query<SnapshotRow>(
        `SELECT id, version, content_hash, claim_count, snapshot_json
         FROM organization_context_snapshot_versions
        WHERE organization_id = ? AND id = ? FOR SHARE`,
        [input.organizationId, input.snapshotId]
      )
    ).rows[0];
    if (!snapshot) {
      throw new OrganizationSnapshotCandidateHandoffError(
        'SNAPSHOT_NOT_FOUND',
        404,
        'Governed snapshot not found'
      );
    }
    if (
      Number(snapshot.version) !== input.snapshotVersion ||
      snapshot.content_hash !== input.snapshotContentHash
    ) {
      throw new OrganizationSnapshotCandidateHandoffError(
        'SNAPSHOT_REF_STALE',
        409,
        'Snapshot identity, version, or hash changed'
      );
    }
    if (Number(snapshot.claim_count) < 1) {
      throw new OrganizationSnapshotCandidateHandoffError(
        'EMPTY_SNAPSHOT',
        409,
        'An empty governed snapshot cannot create a Candidate'
      );
    }

    const existing = (
      await tx.query<ReceiptRow>(
        `SELECT * FROM organization_snapshot_candidate_handoffs
        WHERE organization_id = ? AND snapshot_id = ?`,
        [input.organizationId, input.snapshotId]
      )
    ).rows[0];
    if (existing) {
      if (
        Number(existing.snapshot_version) !== input.snapshotVersion ||
        existing.snapshot_content_hash !== input.snapshotContentHash
      ) {
        throw new OrganizationSnapshotCandidateHandoffError(
          'HANDOFF_COLLISION',
          409,
          'Existing receipt belongs to different source bytes'
        );
      }
      const candidate = (
        await tx.query<{ id: string; title: string; rationale: string; status: string }>(
          'SELECT id, title, rationale, status FROM initiative_candidates WHERE organization_id = ? AND id = ?',
          [input.organizationId, existing.candidate_id]
        )
      ).rows[0];
      if (!candidate)
        throw new OrganizationSnapshotCandidateHandoffError(
          'HANDOFF_INCONSISTENT',
          500,
          'Receipt points to a missing Candidate'
        );
      return { created: false, receipt: mapReceipt(existing), candidate };
    }

    const candidate = await createCandidateFromSource(candidateDb(tx), {
      organizationId: input.organizationId,
      sourceType: 'organization_governed_snapshot',
      sourceId: input.snapshotId,
      title: `Organization context v${input.snapshotVersion}`,
      rationale: `Promoted from immutable governed organization snapshot v${input.snapshotVersion} (${snapshot.content_hash}).`,
      createdBy: input.actorId,
    });
    await testFaultInjector?.();
    const receipt = (
      await tx.query<ReceiptRow>(
        `INSERT INTO organization_snapshot_candidate_handoffs
         (id, organization_id, snapshot_id, snapshot_version, snapshot_content_hash, candidate_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
        [
          uuidv4(),
          input.organizationId,
          input.snapshotId,
          input.snapshotVersion,
          input.snapshotContentHash,
          candidate.id,
          input.actorId,
        ]
      )
    ).rows[0];
    if (!receipt)
      throw new OrganizationSnapshotCandidateHandoffError(
        'READBACK_FAILED',
        500,
        'Candidate handoff receipt readback failed'
      );
    return { created: true, receipt: mapReceipt(receipt), candidate };
  });
}

export async function getOrganizationSnapshotCandidateHandoff(
  organizationId: string,
  snapshotId: string
) {
  const { queryOne } = await import('../../utils/queryHelpers.js');
  const row = await queryOne<ReceiptRow>(
    'SELECT * FROM organization_snapshot_candidate_handoffs WHERE organization_id = ? AND snapshot_id = ?',
    [organizationId, snapshotId]
  );
  return row ? mapReceipt(row) : null;
}
