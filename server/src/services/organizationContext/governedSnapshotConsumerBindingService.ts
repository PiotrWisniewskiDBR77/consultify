import { randomUUID } from 'node:crypto';

import { withPgTransaction } from '../../database/PostgresDatabase.js';
import organizationContextService, {
  type GovernedSnapshotVersion,
  type PinnedSnapshotRead,
} from './OrganizationContextService.js';

export interface GovernedSnapshotRef {
  snapshotId: string;
  version: number;
  contentHash: string;
}

export class GovernedSnapshotBindingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number
  ) {
    super(message);
    this.name = 'GovernedSnapshotBindingError';
  }
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new GovernedSnapshotBindingError(`${field} is required`, 'SNAPSHOT_REF_REQUIRED', 400);
  }
  return value.trim();
}

export async function validateGovernedSnapshotRef(
  organizationId: string,
  ref: GovernedSnapshotRef | null | undefined
): Promise<PinnedSnapshotRead> {
  if (!ref) {
    throw new GovernedSnapshotBindingError(
      'governedSnapshotRef is required',
      'SNAPSHOT_REF_REQUIRED',
      400
    );
  }
  const snapshotId = requireText(ref.snapshotId, 'snapshotId');
  const contentHash = requireText(ref.contentHash, 'contentHash');
  if (!Number.isInteger(ref.version) || ref.version <= 0) {
    throw new GovernedSnapshotBindingError('version must be a positive integer', 'SNAPSHOT_REF_INVALID', 400);
  }

  const snapshot = await organizationContextService.getSnapshotVersion(organizationId, ref.version, {
    includeRestricted: true,
  });
  if (!snapshot || snapshot.snapshotId !== snapshotId) {
    throw new GovernedSnapshotBindingError('governed snapshot not found', 'SNAPSHOT_NOT_FOUND', 404);
  }
  if (snapshot.contentHash !== contentHash) {
    throw new GovernedSnapshotBindingError(
      'governed snapshot content hash does not match the published version',
      'SNAPSHOT_HASH_MISMATCH',
      409
    );
  }
  return snapshot;
}

export async function resolveLatestGovernedSnapshotRef(
  organizationId: string
): Promise<GovernedSnapshotRef | null> {
  const versions = await organizationContextService.listSnapshotVersions(organizationId, 1);
  const latest: GovernedSnapshotVersion | undefined = versions[0];
  return latest
    ? { snapshotId: latest.snapshotId, version: latest.version, contentHash: latest.contentHash }
    : null;
}

interface ProposalRow {
  proposal_id: string;
  producer_kind: string;
  producer_record_id: string;
  source_content_hash: string;
  payload_json: string | Record<string, unknown>;
}

interface BindingRow {
  binding_id: string;
  organization_id: string;
  consumer_kind: 'chat' | 'idea';
  consumer_record_id: string;
  proposal_id: string;
  snapshot_id: string;
  snapshot_version: number;
  snapshot_content_hash: string;
  proposal_source_hash: string;
  bound_by: string;
  bound_at: Date | string;
}

export interface GovernedConsumerBinding {
  bindingId: string;
  organizationId: string;
  consumerKind: 'chat' | 'idea';
  consumerRecordId: string;
  proposalId: string;
  snapshotRef: GovernedSnapshotRef;
  proposalSourceHash: string;
  boundBy: string;
  boundAt: string;
}

function mapBinding(row: BindingRow): GovernedConsumerBinding {
  return {
    bindingId: row.binding_id,
    organizationId: row.organization_id,
    consumerKind: row.consumer_kind,
    consumerRecordId: row.consumer_record_id,
    proposalId: row.proposal_id,
    snapshotRef: {
      snapshotId: row.snapshot_id,
      version: Number(row.snapshot_version),
      contentHash: row.snapshot_content_hash,
    },
    proposalSourceHash: row.proposal_source_hash,
    boundBy: row.bound_by,
    boundAt: row.bound_at instanceof Date ? row.bound_at.toISOString() : row.bound_at,
  };
}

function parsePayload(raw: ProposalRow['payload_json']): Record<string, unknown> {
  if (typeof raw !== 'string') return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function recordGovernedConsumerBinding(input: {
  organizationId: string;
  consumerKind: 'chat' | 'idea';
  consumerRecordId: string;
  proposalId: string;
  snapshotRef: GovernedSnapshotRef;
  boundBy: string;
}): Promise<{ binding: GovernedConsumerBinding; replayed: boolean }> {
  const snapshot = await validateGovernedSnapshotRef(input.organizationId, input.snapshotRef);
  return withPgTransaction(async (query) => {
    // Lock the immutable snapshot identity and proposal in one transaction.
    // The proposal lock serializes concurrent replay attempts before the
    // SELECT-existing -> INSERT branch, so the unique index is defense in
    // depth rather than a caller-visible 500 race.
    const snapshotRows = await query<{ id: string; version: number; content_hash: string }>(
      `SELECT id, version, content_hash FROM organization_context_snapshot_versions
        WHERE id=$1 AND organization_id=$2 FOR SHARE`,
      [snapshot.snapshotId, input.organizationId]
    );
    const pinned = snapshotRows.rows[0];
    if (!pinned || Number(pinned.version) !== snapshot.version || pinned.content_hash !== snapshot.contentHash) {
      throw new GovernedSnapshotBindingError('snapshot changed during binding', 'SNAPSHOT_POLICY_DRIFT', 409);
    }
    const proposalResult = await query<ProposalRow>(
      `SELECT proposal_id, producer_kind, producer_record_id, source_content_hash, payload_json
         FROM artifact_handoff_proposals
        WHERE proposal_id=$1 AND organization_id=$2 FOR UPDATE`,
      [input.proposalId, input.organizationId]
    );
    const proposal = proposalResult.rows[0];
    if (!proposal || proposal.producer_kind !== input.consumerKind || proposal.producer_record_id !== input.consumerRecordId) {
      throw new GovernedSnapshotBindingError('consumer proposal not found', 'PROPOSAL_NOT_FOUND', 404);
    }
    const payloadRef = parsePayload(proposal.payload_json).governedSnapshotRef as GovernedSnapshotRef | undefined;
    if (!payloadRef || payloadRef.snapshotId !== snapshot.snapshotId || Number(payloadRef.version) !== snapshot.version || payloadRef.contentHash !== snapshot.contentHash) {
      throw new GovernedSnapshotBindingError('proposal payload is not pinned to the requested governed snapshot', 'PROPOSAL_SNAPSHOT_MISMATCH', 409);
    }
    const existing = await query<BindingRow>(
      `SELECT * FROM organization_context_consumer_bindings
        WHERE organization_id=$1 AND proposal_id=$2`,
      [input.organizationId, input.proposalId]
    );
    if (existing.rows[0]) {
      const row = existing.rows[0];
      if (row.consumer_kind !== input.consumerKind || row.consumer_record_id !== input.consumerRecordId || row.snapshot_id !== snapshot.snapshotId || Number(row.snapshot_version) !== snapshot.version || row.snapshot_content_hash !== snapshot.contentHash || row.proposal_source_hash !== proposal.source_content_hash) {
        throw new GovernedSnapshotBindingError('existing binding differs from proposal/snapshot bytes', 'BINDING_CONFLICT', 409);
      }
      return { binding: mapBinding(row), replayed: true };
    }
    const bindingId = randomUUID();
    await query(
      `INSERT INTO organization_context_consumer_bindings (
         binding_id, organization_id, consumer_kind, consumer_record_id, proposal_id,
         snapshot_id, snapshot_version, snapshot_content_hash, proposal_source_hash, bound_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [bindingId, input.organizationId, input.consumerKind, input.consumerRecordId, input.proposalId, snapshot.snapshotId, snapshot.version, snapshot.contentHash, proposal.source_content_hash, input.boundBy]
    );
    const inserted = await query<BindingRow>(
      `SELECT * FROM organization_context_consumer_bindings WHERE binding_id=$1 AND organization_id=$2`,
      [bindingId, input.organizationId]
    );
    if (!inserted.rows[0]) throw new GovernedSnapshotBindingError('binding readback failed', 'READBACK_FAILED', 500);
    return { binding: mapBinding(inserted.rows[0]), replayed: false };
  });
}
