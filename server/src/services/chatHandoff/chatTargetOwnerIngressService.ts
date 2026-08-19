import { randomUUID } from 'node:crypto';

import { withPgTransaction } from '../../database/PostgresDatabase.js';
import {
  HandoffSpineError,
  materializeProposal,
  type HandoffReceipt,
  type TargetKind,
} from '../artifactHandoff/handoffSpineService.js';

const SUPPORTED_CONTRACT_VERSION = 'v1';
const MIN_LEASE_SECONDS = 15;
const MAX_LEASE_SECONDS = 900;

export class ChatTargetOwnerIngressError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number
  ) {
    super(message);
    this.name = 'ChatTargetOwnerIngressError';
  }
}

interface ProposalRow {
  proposal_id: string;
  organization_id: string;
  producer_kind: string;
  target_kind: TargetKind;
  contract_version: string;
  source_version: number;
  source_content_hash: string;
  payload_json: unknown;
  state: string;
}

export interface OwnerIngressReceipt {
  ingressId: string;
  organizationId: string;
  proposalId: string;
  targetKind: TargetKind;
  contractVersion: string;
  sourceVersion: number;
  sourceContentHash: string;
  payload: unknown;
  deliveredBy: string;
  deliveredAt: string;
}

interface IngressRow {
  ingress_id: string;
  organization_id: string;
  proposal_id: string;
  target_kind: TargetKind;
  contract_version: string;
  source_version: number;
  source_content_hash: string;
  payload_json: unknown;
  delivered_by: string;
  delivered_at: Date | string;
}

function required(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ChatTargetOwnerIngressError(`${field} is required`, 'INVALID_ARGUMENT', 400);
  }
  return value.trim();
}

function mapIngress(row: IngressRow): OwnerIngressReceipt {
  return {
    ingressId: row.ingress_id,
    organizationId: row.organization_id,
    proposalId: row.proposal_id,
    targetKind: row.target_kind,
    contractVersion: row.contract_version,
    sourceVersion: Number(row.source_version),
    sourceContentHash: row.source_content_hash,
    payload: row.payload_json,
    deliveredBy: row.delivered_by,
    deliveredAt:
      row.delivered_at instanceof Date ? row.delivered_at.toISOString() : row.delivered_at,
  };
}

function parseProposalPayload(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    throw new ChatTargetOwnerIngressError(
      'approved proposal payload is not valid JSON',
      'INVALID_PROPOSAL_PAYLOAD',
      409
    );
  }
}

export async function deliverApprovedChatProposal(input: {
  organizationId: string;
  proposalId: string;
  deliveredBy: string;
}): Promise<{ ingress: OwnerIngressReceipt; replayed: boolean }> {
  const organizationId = required(input.organizationId, 'organizationId');
  const proposalId = required(input.proposalId, 'proposalId');
  const deliveredBy = required(input.deliveredBy, 'deliveredBy');

  return withPgTransaction(async (query) => {
    const found = await query<ProposalRow>(
      `SELECT proposal_id, organization_id, producer_kind, target_kind, contract_version,
              source_version, source_content_hash, payload_json, state
         FROM artifact_handoff_proposals
        WHERE proposal_id = $1 AND organization_id = $2
        FOR UPDATE`,
      [proposalId, organizationId]
    );
    const proposal = found.rows[0];
    if (!proposal || proposal.producer_kind !== 'chat') {
      throw new ChatTargetOwnerIngressError('chat proposal not found', 'NOT_FOUND', 404);
    }
    if (proposal.contract_version !== SUPPORTED_CONTRACT_VERSION) {
      throw new ChatTargetOwnerIngressError(
        `unsupported chat proposal contract ${proposal.contract_version}`,
        'UNSUPPORTED_CONTRACT_VERSION',
        409
      );
    }
    if (proposal.state !== 'approved' && proposal.state !== 'materialized') {
      throw new ChatTargetOwnerIngressError(
        `proposal must be approved before delivery (state=${proposal.state})`,
        'NOT_APPROVED',
        409
      );
    }

    const existing = await query<IngressRow>(
      `SELECT * FROM chat_handoff_owner_ingress
        WHERE organization_id = $1 AND proposal_id = $2`,
      [organizationId, proposalId]
    );
    if (existing.rows[0]) {
      const row = existing.rows[0];
      if (
        row.source_content_hash !== proposal.source_content_hash ||
        Number(row.source_version) !== Number(proposal.source_version) ||
        row.contract_version !== proposal.contract_version ||
        row.target_kind !== proposal.target_kind
      ) {
        throw new ChatTargetOwnerIngressError(
          'existing ingress no longer matches approved proposal bytes',
          'INGRESS_POLICY_DRIFT',
          409
        );
      }
      return { ingress: mapIngress(row), replayed: true };
    }

    const ingressId = randomUUID();
    await query(
      `INSERT INTO chat_handoff_owner_ingress (
         ingress_id, organization_id, proposal_id, target_kind, contract_version,
         source_version, source_content_hash, payload_json, delivered_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
      [
        ingressId,
        organizationId,
        proposalId,
        proposal.target_kind,
        proposal.contract_version,
        proposal.source_version,
        proposal.source_content_hash,
        JSON.stringify(parseProposalPayload(proposal.payload_json)),
        deliveredBy,
      ]
    );
    const inserted = await query<IngressRow>(
      `SELECT * FROM chat_handoff_owner_ingress WHERE ingress_id = $1 AND organization_id = $2`,
      [ingressId, organizationId]
    );
    if (!inserted.rows[0]) {
      throw new ChatTargetOwnerIngressError('ingress readback failed', 'READBACK_FAILED', 500);
    }
    return { ingress: mapIngress(inserted.rows[0]), replayed: false };
  });
}

export interface ClaimedOwnerIngress extends OwnerIngressReceipt {
  claimToken: string;
  leaseExpiresAt: string;
  attemptCount: number;
}

export async function claimNextChatOwnerIngress(input: {
  organizationId: string;
  targetKind: TargetKind;
  claimedBy: string;
  leaseSeconds?: number;
}): Promise<ClaimedOwnerIngress | null> {
  const organizationId = required(input.organizationId, 'organizationId');
  const claimedBy = required(input.claimedBy, 'claimedBy');
  const leaseSeconds = Math.max(
    MIN_LEASE_SECONDS,
    Math.min(MAX_LEASE_SECONDS, Math.trunc(input.leaseSeconds ?? 60))
  );

  return withPgTransaction(async (query) => {
    const candidates = await query<IngressRow>(
      `SELECT i.*
         FROM chat_handoff_owner_ingress i
         LEFT JOIN chat_handoff_owner_claims c ON c.ingress_id = i.ingress_id
        WHERE i.organization_id = $1 AND i.target_kind = $2
          AND (c.ingress_id IS NULL OR (c.consumed_at IS NULL AND c.lease_expires_at <= NOW()))
        ORDER BY i.delivered_at, i.ingress_id
        FOR UPDATE OF i SKIP LOCKED
        LIMIT 1`,
      [organizationId, input.targetKind]
    );
    const ingress = candidates.rows[0];
    if (!ingress) return null;

    const claimToken = randomUUID();
    const claims = await query<{ lease_expires_at: Date | string; attempt_count: number }>(
      `INSERT INTO chat_handoff_owner_claims (
         ingress_id, organization_id, claim_token, claimed_by, lease_expires_at
       ) VALUES ($1,$2,$3,$4,NOW() + ($5 * INTERVAL '1 second'))
       ON CONFLICT (ingress_id) DO UPDATE SET
         claim_token = EXCLUDED.claim_token,
         claimed_by = EXCLUDED.claimed_by,
         claimed_at = NOW(),
         lease_expires_at = EXCLUDED.lease_expires_at,
         attempt_count = chat_handoff_owner_claims.attempt_count + 1
       WHERE chat_handoff_owner_claims.consumed_at IS NULL
         AND chat_handoff_owner_claims.lease_expires_at <= NOW()
       RETURNING lease_expires_at, attempt_count`,
      [ingress.ingress_id, organizationId, claimToken, claimedBy, leaseSeconds]
    );
    const claim = claims.rows[0];
    if (!claim) return null;
    return {
      ...mapIngress(ingress),
      claimToken,
      leaseExpiresAt:
        claim.lease_expires_at instanceof Date
          ? claim.lease_expires_at.toISOString()
          : claim.lease_expires_at,
      attemptCount: Number(claim.attempt_count),
    };
  });
}

/**
 * Mounted Chat UI claims the ingress it just delivered. Queue-wide
 * `claimNextChatOwnerIngress` is correct for background workers, but unsafe for
 * an interactive request because an older document ingress may win the queue.
 */
export async function claimChatOwnerIngress(input: {
  organizationId: string;
  ingressId: string;
  claimedBy: string;
  leaseSeconds?: number;
}): Promise<ClaimedOwnerIngress> {
  const organizationId = required(input.organizationId, 'organizationId');
  const ingressId = required(input.ingressId, 'ingressId');
  const claimedBy = required(input.claimedBy, 'claimedBy');
  const leaseSeconds = Math.max(
    MIN_LEASE_SECONDS,
    Math.min(MAX_LEASE_SECONDS, Math.trunc(input.leaseSeconds ?? 60))
  );

  return withPgTransaction(async (query) => {
    const selected = await query<IngressRow>(
      `SELECT * FROM chat_handoff_owner_ingress
        WHERE ingress_id = $1 AND organization_id = $2
        FOR UPDATE`,
      [ingressId, organizationId]
    );
    const ingress = selected.rows[0];
    if (!ingress) {
      throw new ChatTargetOwnerIngressError('chat owner ingress not found', 'NOT_FOUND', 404);
    }

    const claims = await query<{
      claim_token: string;
      claimed_by: string;
      lease_expires_at: Date | string;
      attempt_count: number;
      consumed_at: Date | string | null;
    }>(
      `INSERT INTO chat_handoff_owner_claims (
         ingress_id, organization_id, claim_token, claimed_by, lease_expires_at
       ) VALUES ($1,$2,$3,$4,NOW() + ($5 * INTERVAL '1 second'))
       ON CONFLICT (ingress_id) DO UPDATE SET
         claim_token = EXCLUDED.claim_token,
         claimed_by = EXCLUDED.claimed_by,
         claimed_at = NOW(),
         lease_expires_at = EXCLUDED.lease_expires_at,
         attempt_count = chat_handoff_owner_claims.attempt_count + 1
       WHERE chat_handoff_owner_claims.consumed_at IS NULL
         AND chat_handoff_owner_claims.lease_expires_at <= NOW()
       RETURNING claim_token, claimed_by, lease_expires_at, attempt_count, consumed_at`,
      [ingressId, organizationId, randomUUID(), claimedBy, leaseSeconds]
    );
    const claim = claims.rows[0];
    if (!claim) {
      const existing = await query<{
        claimed_by: string;
        consumed_at: Date | string | null;
      }>(
        `SELECT claimed_by, consumed_at FROM chat_handoff_owner_claims
          WHERE ingress_id = $1 AND organization_id = $2`,
        [ingressId, organizationId]
      );
      if (existing.rows[0]?.consumed_at) {
        throw new ChatTargetOwnerIngressError(
          'owner ingress already consumed',
          'ALREADY_CONSUMED',
          409
        );
      }
      throw new ChatTargetOwnerIngressError(
        'owner ingress is currently leased',
        'CLAIM_UNAVAILABLE',
        409
      );
    }
    return {
      ...mapIngress(ingress),
      claimToken: claim.claim_token,
      leaseExpiresAt:
        claim.lease_expires_at instanceof Date
          ? claim.lease_expires_at.toISOString()
          : claim.lease_expires_at,
      attemptCount: Number(claim.attempt_count),
    };
  });
}

export async function completeChatOwnerIngress(input: {
  organizationId: string;
  ingressId: string;
  claimToken: string;
  targetRecordId: string;
  materializedBy: string;
  outputPayload?: unknown;
}): Promise<{ receipt: HandoffReceipt; replayed: boolean }> {
  const organizationId = required(input.organizationId, 'organizationId');
  const ingressId = required(input.ingressId, 'ingressId');
  const claimToken = required(input.claimToken, 'claimToken');
  const targetRecordId = required(input.targetRecordId, 'targetRecordId');
  const materializedBy = required(input.materializedBy, 'materializedBy');

  const verified = await withPgTransaction(async (query) => {
    const rows = await query<
      IngressRow & {
        claim_token: string;
        claimed_by: string;
        lease_expires_at: Date | string;
        consumed_at: Date | string | null;
        handoff_receipt_id: string | null;
      }
    >(
      `SELECT i.*, c.claim_token, c.claimed_by, c.lease_expires_at,
              c.consumed_at, c.handoff_receipt_id
         FROM chat_handoff_owner_ingress i
         JOIN chat_handoff_owner_claims c ON c.ingress_id = i.ingress_id
        WHERE i.ingress_id = $1 AND i.organization_id = $2
        FOR UPDATE OF c`,
      [ingressId, organizationId]
    );
    const row = rows.rows[0];
    if (!row) throw new ChatTargetOwnerIngressError('ingress not found', 'NOT_FOUND', 404);
    if (row.claim_token !== claimToken || row.claimed_by !== materializedBy) {
      throw new ChatTargetOwnerIngressError('claim token or actor mismatch', 'CLAIM_MISMATCH', 409);
    }
    if (row.consumed_at && row.handoff_receipt_id) {
      return { proposalId: row.proposal_id, alreadyConsumed: true };
    }
    const lease =
      row.lease_expires_at instanceof Date ? row.lease_expires_at : new Date(row.lease_expires_at);
    if (lease.getTime() <= Date.now()) {
      throw new ChatTargetOwnerIngressError('claim lease expired', 'CLAIM_EXPIRED', 409);
    }
    const proposals = await query<ProposalRow>(
      `SELECT proposal_id, organization_id, producer_kind, target_kind, contract_version,
              source_version, source_content_hash, payload_json, state
         FROM artifact_handoff_proposals WHERE proposal_id = $1 AND organization_id = $2`,
      [row.proposal_id, organizationId]
    );
    const proposal = proposals.rows[0];
    if (
      !proposal ||
      proposal.producer_kind !== 'chat' ||
      proposal.target_kind !== row.target_kind ||
      proposal.contract_version !== row.contract_version ||
      Number(proposal.source_version) !== Number(row.source_version) ||
      proposal.source_content_hash !== row.source_content_hash
    ) {
      throw new ChatTargetOwnerIngressError(
        'proposal bytes/version/target changed after delivery',
        'INGRESS_POLICY_DRIFT',
        409
      );
    }
    return { proposalId: row.proposal_id, alreadyConsumed: false };
  });

  let materialized: { receipt: HandoffReceipt; replayed: boolean };
  try {
    materialized = await materializeProposal({
      organizationId,
      proposalId: verified.proposalId,
      targetRecordId,
      materializedBy,
      outputPayload: input.outputPayload,
    });
  } catch (err) {
    if (err instanceof HandoffSpineError) {
      throw new ChatTargetOwnerIngressError(
        err.message,
        err.code,
        err.code === 'NOT_FOUND' ? 404 : 409
      );
    }
    throw err;
  }
  if (materialized.receipt.targetRecordId !== targetRecordId) {
    throw new ChatTargetOwnerIngressError(
      'materialized receipt points at a different target record',
      'TARGET_RECORD_CONFLICT',
      409
    );
  }

  await withPgTransaction(async (query) => {
    const updated = await query(
      `UPDATE chat_handoff_owner_claims
          SET consumed_at = COALESCE(consumed_at, NOW()),
              handoff_receipt_id = COALESCE(handoff_receipt_id, $1)
        WHERE ingress_id = $2 AND organization_id = $3
          AND (claim_token = $4 OR handoff_receipt_id = $1)`,
      [materialized.receipt.receiptId, ingressId, organizationId, claimToken]
    );
    if (updated.rowCount !== 1) {
      throw new ChatTargetOwnerIngressError('claim completion CAS failed', 'CLAIM_MISMATCH', 409);
    }
  });
  return materialized;
}
