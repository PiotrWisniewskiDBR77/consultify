/**
 * pirService — Post-Implementation Review (PIR) artifacts.
 *
 * M14/F8 (8.5): captures lessons-learned for a delivered initiative
 * (went_well / went_wrong / do_better / recommendations). A review starts
 * as DRAFT and is FINALIZED once the retro is signed off.
 *
 * All reads/writes are org-scoped (organization_id) for tenant isolation.
 * node-pg, snake_case columns mapped directly to the row shape.
 */

import { v4 as uuidv4 } from 'uuid';

import DbPromise from '../utils/DbPromise.js';

export type PirStatus = 'DRAFT' | 'FINALIZED';

export interface PostImplementationReview {
  id: string;
  organization_id: string;
  initiative_id: string;
  title: string | null;
  went_well: string | null;
  went_wrong: string | null;
  do_better: string | null;
  recommendations: string | null;
  status: PirStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePirInput {
  title?: string | null;
  went_well?: string | null;
  went_wrong?: string | null;
  do_better?: string | null;
  recommendations?: string | null;
}

/**
 * List PIRs for an initiative within an org (most recent first).
 */
export async function getPir(
  orgId: string,
  initiativeId: string
): Promise<PostImplementationReview[]> {
  return DbPromise.all<PostImplementationReview>(
    `SELECT id, organization_id, initiative_id, title,
            went_well, went_wrong, do_better, recommendations,
            status, reviewed_by, reviewed_at, created_at, updated_at
       FROM post_implementation_reviews
      WHERE organization_id = $1
        AND initiative_id = $2
      ORDER BY created_at DESC`,
    [orgId, initiativeId]
  );
}

/**
 * Create a new DRAFT PIR for an initiative.
 */
export async function createPir(
  orgId: string,
  initiativeId: string,
  data: CreatePirInput
): Promise<PostImplementationReview> {
  const id = uuidv4();
  const now = new Date().toISOString();

  const row: PostImplementationReview = {
    id,
    organization_id: orgId,
    initiative_id: initiativeId,
    title: data.title ?? null,
    went_well: data.went_well ?? null,
    went_wrong: data.went_wrong ?? null,
    do_better: data.do_better ?? null,
    recommendations: data.recommendations ?? null,
    status: 'DRAFT',
    reviewed_by: null,
    reviewed_at: null,
    created_at: now,
    updated_at: now,
  };

  await DbPromise.run(
    `INSERT INTO post_implementation_reviews (
       id, organization_id, initiative_id, title,
       went_well, went_wrong, do_better, recommendations,
       status, reviewed_by, reviewed_at, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      row.id,
      row.organization_id,
      row.initiative_id,
      row.title,
      row.went_well,
      row.went_wrong,
      row.do_better,
      row.recommendations,
      row.status,
      row.reviewed_by,
      row.reviewed_at,
      row.created_at,
      row.updated_at,
    ]
  );

  return row;
}

/**
 * Finalize a DRAFT PIR: status DRAFT → FINALIZED, stamp reviewer + timestamp.
 * Org-scoped; only transitions rows that are still in DRAFT.
 * Returns the finalized review, or null if nothing matched.
 */
export async function finalizePir(
  orgId: string,
  id: string,
  reviewedBy: string
): Promise<PostImplementationReview | null> {
  const now = new Date().toISOString();

  await DbPromise.run(
    `UPDATE post_implementation_reviews
        SET status = 'FINALIZED',
            reviewed_by = $1,
            reviewed_at = $2,
            updated_at = $2
      WHERE organization_id = $3
        AND id = $4
        AND status = 'DRAFT'`,
    [reviewedBy, now, orgId, id]
  );

  const updated = await DbPromise.get<PostImplementationReview>(
    `SELECT id, organization_id, initiative_id, title,
            went_well, went_wrong, do_better, recommendations,
            status, reviewed_by, reviewed_at, created_at, updated_at
       FROM post_implementation_reviews
      WHERE organization_id = $1
        AND id = $2`,
    [orgId, id]
  );

  return updated ?? null;
}

export default { getPir, createPir, finalizePir };
