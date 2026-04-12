import { getDatabase } from '../database/Database.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

export type PartnerApplicationStatus = 'pending' | 'approved' | 'rejected' | 'needs_follow_up';

export interface CreatePartnerApplicationInput {
  fullName: string;
  email: string;
  company: string;
  website?: string | null;
  country?: string | null;
  role?: string | null;
  teamSize?: string | null;
  focusArea?: string | null;
  message?: string | null;
  locale?: string | null;
}

let schemaEnsured = false;

export async function ensurePartnerApplicationSchema(): Promise<void> {
  if (schemaEnsured) return;

  try {
    const db = getDatabase();
    await DbPromise.run(
      db,
      `CREATE TABLE IF NOT EXISTS public_partner_applications (
        id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL,
        company TEXT NOT NULL,
        website TEXT,
        country TEXT,
        role TEXT,
        team_size TEXT,
        focus_area TEXT,
        message TEXT,
        locale TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        review_note TEXT,
        reviewed_by TEXT,
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      [],
      { fallback: true }
    );
    schemaEnsured = true;
  } catch (error) {
    logger.warn('[PartnerApplicationIntake] Failed to ensure schema:', error);
  }
}

export async function createPartnerApplication(
  id: string,
  input: CreatePartnerApplicationInput
): Promise<void> {
  await ensurePartnerApplicationSchema();
  const db = getDatabase();
  await DbPromise.run(
    db,
    `INSERT INTO public_partner_applications
      (id, full_name, email, company, website, country, role, team_size, focus_area, message, locale, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)`,
    [
      id,
      input.fullName.trim(),
      input.email.trim(),
      input.company.trim(),
      input.website?.trim() || null,
      input.country?.trim() || null,
      input.role?.trim() || null,
      input.teamSize?.trim() || null,
      input.focusArea?.trim() || null,
      input.message?.trim() || null,
      input.locale?.trim() || null,
    ],
    { fallback: true }
  );
}

export async function listPartnerApplications(limit = 100): Promise<any[]> {
  await ensurePartnerApplicationSchema();
  const db = getDatabase();
  return DbPromise.all<any>(
    db,
    `SELECT *
     FROM public_partner_applications
     ORDER BY
       CASE status
         WHEN 'pending' THEN 0
         WHEN 'needs_follow_up' THEN 1
         WHEN 'approved' THEN 2
         WHEN 'rejected' THEN 3
         ELSE 4
       END,
       created_at DESC
     LIMIT ?`,
    [Math.max(1, Math.min(200, limit))]
  );
}

export async function reviewPartnerApplication(params: {
  applicationId: string;
  status: PartnerApplicationStatus;
  reviewNote?: string | null;
  reviewedBy?: string | null;
}): Promise<void> {
  await ensurePartnerApplicationSchema();
  const db = getDatabase();
  await DbPromise.run(
    db,
    `UPDATE public_partner_applications
     SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      params.status,
      params.reviewNote?.trim() || null,
      params.reviewedBy?.trim() || null,
      params.applicationId,
    ],
    { fallback: true }
  );
}
