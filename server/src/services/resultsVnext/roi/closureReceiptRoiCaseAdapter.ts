import { createHash } from 'node:crypto';

import * as queryHelpers from '../../../utils/queryHelpers.js';
import { createRoiCase, type CreateRoiCaseResult } from './roiCaseCommands.js';
import type { AtomicCommandOutcome } from '../platform/atomicWrite.js';

export class ClosureReceiptRoiBindingError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'ClosureReceiptRoiBindingError';
  }
}

interface BindingSourceRow {
  receipt_id: string;
  organization_id: string;
  initiative_id: string;
  transition_audit_ref: string;
  actor_id: string | null;
  initiative_title: string;
  budget_currency: string | null;
  owner_user_id: string | null;
  actor_role: string | null;
}

export interface EnsureClosureReceiptRoiCaseInput {
  organizationId: string;
  receiptId: string;
}

/** PostgreSQL's platform event envelope requires UUID correlation/causation,
 * while the canonical closure receipt deliberately owns TEXT identities.
 * Preserve TEXT in the idempotency/reason and derive a stable UUID only for
 * the typed event columns. */
export function closureTextIdentityUuid(namespace: string, value: string): string {
  const hex = createHash('sha256').update(`${namespace}\u0000${value}`).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${(
    (parseInt(hex[16]!, 16) & 0x3) |
    0x8
  ).toString(16)}${hex.slice(17, 20)}-${hex.slice(20)}`;
}

/**
 * Binds an immutable closure identity to the existing ROI owner without adding
 * another owner table. The durable binding is the canonical roi.case_created
 * platform event: correlation_id is the closure receipt id and aggregate_id is
 * the ROI case id. Replays use the same tenant-scoped idempotency key.
 *
 * This creates only the inert ROI case/baseline shell. It never approves a
 * Finance candidate and never schedules or starts a PIR.
 */
export async function ensureRoiCaseForClosureReceipt(
  input: EnsureClosureReceiptRoiCaseInput
): Promise<AtomicCommandOutcome<CreateRoiCaseResult>> {
  const source = await queryHelpers.queryOne<BindingSourceRow>(
    `SELECT r.id AS receipt_id,
            r.organization_id,
            r.initiative_id,
            r.transition_audit_ref,
            r.actor_id,
            i.name AS initiative_title,
            i.budget_currency,
            COALESCE(i.owner_business_id, i.created_by, r.actor_id) AS owner_user_id,
            om.role AS actor_role
       FROM closure_delivery_receipts r
       JOIN initiatives i
         ON i.id = r.initiative_id
        AND i.organization_id = r.organization_id
       LEFT JOIN organization_members om
         ON om.organization_id = r.organization_id
        AND om.user_id = COALESCE(i.owner_business_id, i.created_by, r.actor_id)
        AND UPPER(om.status) = 'ACTIVE'
      WHERE r.id = ? AND r.organization_id = ?`,
    [input.receiptId, input.organizationId]
  );

  if (!source) {
    throw new ClosureReceiptRoiBindingError(
      'Closure receipt not found in the caller organization',
      'CLOSURE_RECEIPT_NOT_FOUND'
    );
  }
  if (!source.owner_user_id || !source.actor_role) {
    throw new ClosureReceiptRoiBindingError(
      'Closure receipt has no ACTIVE tenant member capable of owning the ROI case',
      'CLOSURE_RECEIPT_ACTOR_NOT_ACTIVE'
    );
  }
  if (!source.budget_currency?.trim()) {
    throw new ClosureReceiptRoiBindingError(
      'Initiative has no budget currency; an ROI case currency cannot be inferred',
      'CLOSURE_RECEIPT_CURRENCY_REQUIRED'
    );
  }

  return createRoiCase({
    organizationId: source.organization_id,
    initiativeId: source.initiative_id,
    title: `${source.initiative_title} — post-closure ROI`,
    ownerUserId: source.owner_user_id,
    currency: source.budget_currency,
    createdBy: source.owner_user_id,
    actorEffectiveRole: source.actor_role,
    idempotencyKey: `closure-receipt:${source.receipt_id}:roi-case:v1`,
    correlationId: closureTextIdentityUuid('closure-receipt', source.receipt_id),
    causationId: closureTextIdentityUuid('closure-transition', source.transition_audit_ref),
    reason: `Create an inert ROI case shell for closure receipt ${source.receipt_id}; transition ${source.transition_audit_ref}`,
  });
}
