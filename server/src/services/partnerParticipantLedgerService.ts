import crypto from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import * as DbPromise from '../utils/DbPromise.js';

export const PARTNER_PARTICIPANT_LEDGER_VERSION = 'partner-participant-referral-v1';

export interface PartnerParticipantLedgerEntry {
  id: string;
  tenantOrganizationId: string;
  partnerOrgId: string;
  eventType: 'referral.attributed';
  participantOrganizationId: string;
  sourceKind: 'partner_attribution';
  sourceId: string;
  sourceVersion: string;
  sourceDigest: string;
  sourceRef: Record<string, unknown>;
  actorId: string;
  idempotencyKey: string;
  occurredAt: string;
  recordedAt: string;
}

const digest = (value: unknown) =>
  crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

function mapRow(row: any): PartnerParticipantLedgerEntry {
  return {
    id: row.id,
    tenantOrganizationId: row.tenant_organization_id,
    partnerOrgId: row.partner_org_id,
    eventType: row.event_type,
    participantOrganizationId: row.participant_organization_id,
    sourceKind: row.source_kind,
    sourceId: row.source_id,
    sourceVersion: row.source_version,
    sourceDigest: row.source_digest,
    sourceRef: typeof row.source_ref === 'string' ? JSON.parse(row.source_ref) : row.source_ref,
    actorId: row.actor_id,
    idempotencyKey: row.idempotency_key,
    occurredAt: row.occurred_at,
    recordedAt: row.recorded_at,
  };
}

export class PartnerParticipantLedgerConflict extends Error {
  code = 'PARTNER_PARTICIPANT_LEDGER_IDEMPOTENCY_CONFLICT';
}

export async function appendReferralAttributionFact(input: {
  partnerOrgId: string;
  attributionId: string;
  actorId: string;
  idempotencyKey: string;
}): Promise<{ entry: PartnerParticipantLedgerEntry; duplicate: boolean }> {
  const db = getDatabase();
  const partner = await DbPromise.get<{ owner_organization_id: string | null }>(
    db,
    `SELECT owner_organization_id FROM partner_organizations WHERE id = ? AND status = 'active'`,
    [input.partnerOrgId],
    { fallback: false }
  );
  if (!partner?.owner_organization_id) {
    throw Object.assign(new Error('Active tenant-bound Partner organization required'), {
      code: 'PARTNER_TENANT_BINDING_REQUIRED',
    });
  }
  const attribution = await DbPromise.get<any>(
    db,
    `SELECT id, partner_org_id, organization_id, attribution_type, referral_code_used,
            status, attributed_at, created_at
       FROM partner_attributions WHERE id = ? AND partner_org_id = ?`,
    [input.attributionId, input.partnerOrgId],
    { fallback: false }
  );
  if (!attribution) {
    throw Object.assign(new Error('Partner attribution not found'), {
      code: 'PARTNER_ATTRIBUTION_NOT_FOUND',
    });
  }
  const sourceRef = {
    attributionId: attribution.id,
    attributionType: attribution.attribution_type,
    referralCodeUsed: attribution.referral_code_used ?? null,
    status: attribution.status,
    attributedAt: attribution.attributed_at,
    createdAt: attribution.created_at,
  };
  const sourceDigest = digest(sourceRef);
  const requestDigest = digest({
    partnerOrgId: input.partnerOrgId,
    attributionId: input.attributionId,
    actorId: input.actorId,
    sourceDigest,
    version: PARTNER_PARTICIPANT_LEDGER_VERSION,
  });
  const id = uuidv4();
  const inserted = await DbPromise.run(
    db,
    `INSERT INTO partner_participant_ledger (
       id, tenant_organization_id, partner_org_id, event_type,
       participant_organization_id, source_kind, source_id, source_version,
       source_digest, request_digest, source_ref, actor_id, idempotency_key, occurred_at
     ) VALUES (?, ?, ?, 'referral.attributed', ?, 'partner_attribution', ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (tenant_organization_id, partner_org_id, idempotency_key) DO NOTHING`,
    [
      id,
      partner.owner_organization_id,
      input.partnerOrgId,
      attribution.organization_id,
      attribution.id,
      PARTNER_PARTICIPANT_LEDGER_VERSION,
      sourceDigest,
      requestDigest,
      JSON.stringify(sourceRef),
      input.actorId,
      input.idempotencyKey,
      attribution.attributed_at || attribution.created_at,
    ],
    { fallback: false }
  );
  if (!inserted.success) throw new Error(inserted.error || 'Participant ledger insert failed');
  const row = await DbPromise.get<any>(
    db,
    `SELECT * FROM partner_participant_ledger
      WHERE tenant_organization_id = ? AND partner_org_id = ? AND idempotency_key = ?`,
    [partner.owner_organization_id, input.partnerOrgId, input.idempotencyKey],
    { fallback: false }
  );
  if (!row) throw new Error('Participant ledger cold readback failed');
  if (row.request_digest !== requestDigest) {
    throw new PartnerParticipantLedgerConflict(
      'Idempotency key was already used for another referral fact'
    );
  }
  return { entry: mapRow(row), duplicate: row.id !== id };
}

export async function listPartnerParticipantLedger(input: {
  tenantOrganizationId: string;
  partnerOrgId: string;
  limit?: number;
}): Promise<PartnerParticipantLedgerEntry[]> {
  const rows = await DbPromise.all<any>(
    getDatabase(),
    `SELECT * FROM partner_participant_ledger
      WHERE tenant_organization_id = ? AND partner_org_id = ?
      ORDER BY occurred_at DESC, id DESC LIMIT ?`,
    [input.tenantOrganizationId, input.partnerOrgId, Math.min(100, Math.max(1, input.limit || 50))],
    { fallback: false }
  );
  return rows.map(mapRow);
}
