import crypto from 'node:crypto';

import { withPgTransaction } from '../database/PostgresDatabase.js';

export type PartnerOperatorReviewOperation = 'certification_review' | 'application_review';

export class PartnerOperatorReviewError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message);
  }
}

type ReviewQuery = <R = unknown>(
  sql: string,
  params?: unknown[]
) => Promise<{ rows: R[]; rowCount: number }>;

function hashRequest(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function normalizedKey(value: string | undefined): string {
  const key = String(value || '').trim();
  if (!key) {
    throw new PartnerOperatorReviewError(
      'Idempotency-Key is required',
      400,
      'IDEMPOTENCY_KEY_REQUIRED'
    );
  }
  return key;
}

async function runReview<T>(params: {
  actorUserId: string;
  operation: PartnerOperatorReviewOperation;
  targetId: string;
  idempotencyKey?: string;
  payload: unknown;
  execute: (query: ReviewQuery) => Promise<T>;
}): Promise<T> {
  const idempotencyKey = normalizedKey(params.idempotencyKey);
  const targetId = String(params.targetId || '').trim();
  const requestHash = hashRequest({ targetId, payload: params.payload });

  return withPgTransaction(async (query) => {
    await query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [
      `partner-operator-review:${params.operation}:${targetId}`,
    ]);
    const prior = (
      await query<any>(
        `SELECT target_id,request_hash,status,response_json
           FROM partner_operator_review_receipts
          WHERE actor_user_id=$1 AND operation=$2 AND idempotency_key=$3
          FOR UPDATE`,
        [params.actorUserId, params.operation, idempotencyKey]
      )
    ).rows[0];
    if (prior) {
      if (prior.target_id !== targetId || prior.request_hash !== requestHash) {
        throw new PartnerOperatorReviewError(
          'Idempotency replay payload mismatch',
          409,
          'IDEMPOTENCY_PAYLOAD_MISMATCH'
        );
      }
      if (prior.status !== 'COMPLETED') {
        throw new PartnerOperatorReviewError(
          'Idempotency request incomplete',
          409,
          'IDEMPOTENCY_INCOMPLETE'
        );
      }
      return prior.response_json as T;
    }

    await query(
      `INSERT INTO partner_operator_review_receipts
       (actor_user_id,operation,target_id,idempotency_key,request_hash)
       VALUES($1,$2,$3,$4,$5)`,
      [params.actorUserId, params.operation, targetId, idempotencyKey, requestHash]
    );
    const response = await params.execute(query);
    await query(
      `UPDATE partner_operator_review_receipts
          SET status='COMPLETED',response_status=200,response_json=$4::jsonb,
              completed_at=NOW()
        WHERE actor_user_id=$1 AND operation=$2 AND idempotency_key=$3`,
      [params.actorUserId, params.operation, idempotencyKey, JSON.stringify(response)]
    );
    return response;
  });
}

export async function reviewPartnerCertification(params: {
  actorUserId: string;
  certificationId: string;
  reviewState: 'approved' | 'changes_requested' | 'pending';
  notes?: string | null;
  idempotencyKey?: string;
}) {
  const payload = {
    reviewState: params.reviewState,
    notes: String(params.notes || '').trim() || null,
  };
  return runReview({
    actorUserId: params.actorUserId,
    operation: 'certification_review',
    targetId: params.certificationId,
    idempotencyKey: params.idempotencyKey,
    payload,
    execute: async (query) => {
      const cert = (
        await query<any>(`SELECT * FROM partner_certifications WHERE id=$1 FOR UPDATE`, [
          params.certificationId,
        ])
      ).rows[0];
      if (!cert) {
        throw new PartnerOperatorReviewError(
          'Certification not found',
          404,
          'PARTNER_CERTIFICATION_NOT_FOUND'
        );
      }

      let certificateId = cert.certificate_id || null;
      let validUntil = cert.valid_until || null;
      if (params.reviewState === 'approved' && !certificateId) {
        certificateId = crypto.randomUUID();
        if (!validUntil && cert.recertification_policy === 'annual_refresh') {
          const nextYear = new Date();
          nextYear.setFullYear(nextYear.getFullYear() + 1);
          validUntil = nextYear.toISOString();
        }
        await query<any>(
          `INSERT INTO partner_certificates
           (id,partner_org_id,user_id,certification_id,certificate_type,share_token,
            certification_track,certification_level,review_state,valid_until,earned_at,created_at)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,'approved',$9,NOW(),NOW())`,
          [
            certificateId,
            cert.partner_org_id,
            cert.user_id,
            cert.id,
            cert.certification_type,
            crypto.randomBytes(18).toString('hex'),
            cert.certification_track || null,
            cert.certification_level || null,
            validUntil,
          ]
        );
      }
      const row = (
        await query(
          `UPDATE partner_certifications
              SET review_state=$1,review_notes=$2,
                  status=CASE WHEN $1='approved' THEN 'completed' ELSE status END,
                  certificate_id=COALESCE($3,certificate_id),
                  certificate_url=CASE WHEN $3 IS NOT NULL THEN $4 ELSE certificate_url END,
                  completed_at=CASE WHEN $1='approved' THEN COALESCE(completed_at,NOW()) ELSE completed_at END,
                  valid_until=COALESCE($5,valid_until),updated_at=NOW()
            WHERE id=$6
            RETURNING id,partner_org_id,user_id,status,review_state,review_notes,
                      certificate_id,certificate_url,completed_at,valid_until,updated_at`,
          [
            params.reviewState,
            payload.notes,
            certificateId,
            certificateId ? `/api/partners/certificates/${certificateId}/download` : null,
            validUntil,
            params.certificationId,
          ]
        )
      ).rows[0];
      return { certification: row };
    },
  });
}

export async function reviewPartnerApplicationCommand(params: {
  actorUserId: string;
  applicationId: string;
  status: 'pending' | 'approved' | 'rejected' | 'needs_follow_up';
  reviewNote?: string | null;
  idempotencyKey?: string;
}) {
  const payload = {
    status: params.status,
    reviewNote: String(params.reviewNote || '').trim() || null,
  };
  return runReview({
    actorUserId: params.actorUserId,
    operation: 'application_review',
    targetId: params.applicationId,
    idempotencyKey: params.idempotencyKey,
    payload,
    execute: async (query) => {
      const existing = (
        await query<any>(`SELECT id FROM public_partner_applications WHERE id=$1 FOR UPDATE`, [
          params.applicationId,
        ])
      ).rows[0];
      if (!existing) {
        throw new PartnerOperatorReviewError(
          'Partner application not found',
          404,
          'PARTNER_APPLICATION_NOT_FOUND'
        );
      }
      const application = (
        await query<any>(
          `UPDATE public_partner_applications
              SET status=$1,review_note=$2,reviewed_by=$3,reviewed_at=NOW()
            WHERE id=$4
            RETURNING id,status,review_note,reviewed_by,reviewed_at`,
          [payload.status, payload.reviewNote, params.actorUserId, params.applicationId]
        )
      ).rows[0];
      return { application };
    },
  });
}
