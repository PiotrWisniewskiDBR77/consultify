import crypto from 'crypto';

import { getDatabase } from '../database/Database.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

export type CertificationType = 'sales';
export type PartnerResourceLanguage = 'en' | 'pl';

const COOLDOWN_MINUTES = 10;
const EXAM_DEADLINE_MINUTES = 30;
const EXAM_QUESTION_COUNT = 10;

type CanonicalTier = 'REGISTERED' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
const TIER_ORDER: CanonicalTier[] = ['REGISTERED', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];

function tierRank(t: string | null | undefined): number {
  if (!t) return 0;
  const upper = String(t).trim().toUpperCase();
  const idx = TIER_ORDER.indexOf(upper as CanonicalTier);
  return idx >= 0 ? idx : 0;
}

function maxTier(a: string | null | undefined, b: string | null | undefined): CanonicalTier {
  return tierRank(a) >= tierRank(b)
    ? (String(a || 'REGISTERED').toUpperCase() as CanonicalTier)
    : (String(b || 'REGISTERED').toUpperCase() as CanonicalTier);
}

function toLanguage(input: unknown): PartnerResourceLanguage {
  return input === 'pl' ? 'pl' : 'en';
}

function legacyPartnerTierToCanonical(legacy: unknown): CanonicalTier {
  const v = String(legacy || '').toLowerCase();
  if (v === 'elite') return 'PLATINUM';
  if (v === 'premier') return 'GOLD';
  if (v === 'certified') return 'SILVER';
  return 'REGISTERED';
}

export async function getEffectivePartnerTier(partnerOrgId: string): Promise<CanonicalTier> {
  const db = getDatabase();
  const row = await DbPromise.get<any>(
    db,
    `SELECT tier, tier_override, certification_tier_floor
     FROM partner_organizations
     WHERE id = ?`,
    [partnerOrgId]
  );
  if (!row) return 'REGISTERED';
  const legacy = legacyPartnerTierToCanonical(row.tier);
  const override = row.tier_override ? String(row.tier_override).toUpperCase() : null;
  const floor = row.certification_tier_floor
    ? String(row.certification_tier_floor).toUpperCase()
    : null;
  return maxTier(maxTier(legacy, override), floor);
}

interface PartnerCertificationRow {
  id: string;
  certification_name?: string;
  certification_type?: string;
  status?: string;
  progress_percent?: number;
  started_at?: string;
  completed_at?: string;
  certificate_id?: string | null;
  certificate_url?: string | null;
  attempt_count?: number | null;
  last_attempt_at?: string | null;
}

interface LearningModuleRow {
  id: string;
  name: string;
  description?: string | null;
  certification_type: string;
  module_order: number;
  duration_minutes?: number | null;
  content_type?: string | null;
  required_for_certification?: boolean | null;
  language?: string | null;
  minutes?: number | null;
}

export async function ensureSalesCertification(params: {
  partnerOrgId: string;
  userId: string;
}): Promise<PartnerCertificationRow> {
  const db = getDatabase();
  const existing = await DbPromise.get<PartnerCertificationRow>(
    db,
    `SELECT *
     FROM partner_certifications
     WHERE partner_org_id = ? AND user_id = ? AND certification_type = 'sales'
     LIMIT 1`,
    [params.partnerOrgId, params.userId]
  );

  if (existing) return existing;

  const id = crypto.randomUUID();
  await DbPromise.run(
    db,
    `INSERT INTO partner_certifications
      (id, partner_org_id, user_id, certification_name, certification_type, status, progress_percent, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'sales', 'not_started', 0, NOW(), NOW())`,
    [id, params.partnerOrgId, params.userId, 'Sales Certification']
  );

  const created = await DbPromise.get<PartnerCertificationRow>(
    db,
    `SELECT * FROM partner_certifications WHERE id = ?`,
    [id]
  );
  if (!created) throw new Error('Failed to create certification');
  return created;
}

export async function getSalesModules(
  language: PartnerResourceLanguage
): Promise<LearningModuleRow[]> {
  const db = getDatabase();
  const rows = await DbPromise.all<LearningModuleRow>(
    db,
    `SELECT id, name, description, certification_type, module_order, duration_minutes, content_type,
            required_for_certification, language, minutes
     FROM partner_learning_modules
     WHERE is_active = TRUE AND certification_type = 'sales' AND COALESCE(language, 'en') = ?
     ORDER BY module_order ASC`,
    [language]
  );
  return rows;
}

export async function ensureLearningProgressRows(params: {
  certificationId: string;
  moduleIds: string[];
}): Promise<void> {
  const db = getDatabase();
  for (const moduleId of params.moduleIds) {
    await DbPromise.run(
      db,
      `INSERT INTO partner_learning_progress (id, certification_id, module_id, status, progress_percent, created_at, updated_at)
       VALUES (?, ?, ?, 'not_started', 0, NOW(), NOW())
       ON CONFLICT (certification_id, module_id) DO NOTHING`,
      [crypto.randomUUID(), params.certificationId, moduleId]
    );
  }
}

export async function recalcCertificationProgress(certificationId: string): Promise<void> {
  const db = getDatabase();
  const agg = await DbPromise.get<{ total: number; completed: number }>(
    db,
    `SELECT
        COUNT(*)::int as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::int as completed
     FROM partner_learning_progress
     WHERE certification_id = ?`,
    [certificationId]
  );

  const total = agg?.total || 0;
  const completed = agg?.completed || 0;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  const newStatus =
    completed > 0 ? (completed === total ? 'completed' : 'in_progress') : 'not_started';
  const completedAt = completed === total ? 'NOW()' : 'NULL';
  await DbPromise.run(
    db,
    `UPDATE partner_certifications
     SET progress_percent = ?, status = ?, started_at = COALESCE(started_at, NOW()),
         completed_at = ${completedAt}, updated_at = NOW()
     WHERE id = ?`,
    [progress, newStatus, certificationId]
  );
}

export async function startSalesExam(params: {
  certificationId: string;
  partnerOrgId: string;
  userId: string;
  language: PartnerResourceLanguage;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<{
  attemptId: string;
  deadlineAt: string;
  questions: Array<{ id: string; text: string; options: Array<{ id: string; label: string }> }>;
}> {
  const db = getDatabase();

  const cert = await DbPromise.get<PartnerCertificationRow>(
    db,
    `SELECT * FROM partner_certifications WHERE id = ? AND partner_org_id = ? AND user_id = ?`,
    [params.certificationId, params.partnerOrgId, params.userId]
  );
  if (!cert) {
    throw new Error('Certification not found');
  }

  // Cooldown (best-effort)
  if (cert.last_attempt_at) {
    const last = new Date(cert.last_attempt_at).getTime();
    const mins = (Date.now() - last) / (1000 * 60);
    if (mins < COOLDOWN_MINUTES) {
      throw new Error(`Please wait ${Math.ceil(COOLDOWN_MINUTES - mins)} minutes before retrying`);
    }
  }

  const questions = await DbPromise.all<any>(
    db,
    `SELECT id, question_text, options_json
     FROM partner_exam_questions
     WHERE certification_type = 'sales' AND language = ?
     ORDER BY RANDOM()
     LIMIT ${EXAM_QUESTION_COUNT}`,
    [params.language]
  );

  if (questions.length < EXAM_QUESTION_COUNT) {
    throw new Error('Question bank not configured');
  }

  const attemptId = crypto.randomUUID();
  const deadlineAt = new Date(Date.now() + EXAM_DEADLINE_MINUTES * 60 * 1000).toISOString();
  const ipHash = params.ip
    ? crypto.createHash('sha256').update(String(params.ip)).digest('hex')
    : null;

  await DbPromise.run(
    db,
    `INSERT INTO partner_certification_attempts
      (id, certification_id, partner_org_id, user_id, deadline_at, language, questions_json, ip_hash, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      attemptId,
      params.certificationId,
      params.partnerOrgId,
      params.userId,
      deadlineAt,
      params.language,
      JSON.stringify(questions.map((q: any) => ({ questionId: q.id }))),
      ipHash,
      params.userAgent || null,
    ]
  );

  await DbPromise.run(
    db,
    `UPDATE partner_certifications
     SET attempt_count = COALESCE(attempt_count, 0) + 1,
         last_attempt_at = NOW(),
         updated_at = NOW()
     WHERE id = ?`,
    [params.certificationId]
  );

  return {
    attemptId,
    deadlineAt,
    questions: questions.map((q: any) => ({
      id: q.id,
      text: q.question_text,
      options: Array.isArray(q.options_json) ? q.options_json : JSON.parse(q.options_json || '[]'),
    })),
  };
}

export async function submitSalesExam(params: {
  attemptId: string;
  certificationId: string;
  partnerOrgId: string;
  userId: string;
  answers: Record<string, string>;
}): Promise<{
  passed: boolean;
  scorePercent: number;
  certificateId?: string;
}> {
  const db = getDatabase();

  const attempt = await DbPromise.get<any>(
    db,
    `SELECT *
     FROM partner_certification_attempts
     WHERE id = ? AND certification_id = ? AND partner_org_id = ? AND user_id = ?`,
    [params.attemptId, params.certificationId, params.partnerOrgId, params.userId]
  );
  if (!attempt) throw new Error('Attempt not found');
  if (attempt.submitted_at) throw new Error('Attempt already submitted');
  if (new Date(attempt.deadline_at).getTime() < Date.now()) throw new Error('Attempt expired');

  const questionIds = (
    Array.isArray(attempt.questions_json)
      ? attempt.questions_json
      : JSON.parse(attempt.questions_json || '[]')
  ).map((q: any) => q.questionId);

  const correct = await DbPromise.all<{ id: string; correct_option_id: string }>(
    db,
    `SELECT id, correct_option_id
     FROM partner_exam_questions
     WHERE id = ANY(?::uuid[])`,
    [questionIds]
  );

  const correctMap = new Map(correct.map((c) => [c.id, c.correct_option_id]));
  let score = 0;
  for (const qid of questionIds) {
    const ans = params.answers[qid];
    if (ans && correctMap.get(qid) === ans) score += 1;
  }
  const scorePercent = Math.round((score / questionIds.length) * 100);
  const passed = scorePercent >= 70;

  await DbPromise.run(
    db,
    `UPDATE partner_certification_attempts
     SET submitted_at = NOW(), answers_json = ?, score_percent = ?, passed = ?
     WHERE id = ?`,
    [JSON.stringify(params.answers || {}), scorePercent, passed, params.attemptId]
  );

  if (!passed) {
    return { passed, scorePercent };
  }

  // Issue certificate
  const certificateId = crypto.randomUUID();
  const shareToken = crypto.randomBytes(18).toString('hex');
  await DbPromise.run(
    db,
    `INSERT INTO partner_certificates
      (id, partner_org_id, user_id, certification_id, certificate_type, share_token)
     VALUES (?, ?, ?, ?, 'sales', ?)`,
    [certificateId, params.partnerOrgId, params.userId, params.certificationId, shareToken]
  );

  await DbPromise.run(
    db,
    `UPDATE partner_certifications
     SET certificate_id = ?, certificate_url = ?, passed_exam_at = NOW(), updated_at = NOW()
     WHERE id = ?`,
    [certificateId, `/api/partners/certificates/${certificateId}/download`, params.certificationId]
  );

  // Incentive floor: at least SILVER
  try {
    const org = await DbPromise.get<any>(
      db,
      `SELECT tier, tier_override, certification_tier_floor FROM partner_organizations WHERE id = ?`,
      [params.partnerOrgId]
    );
    const legacy = legacyPartnerTierToCanonical(org?.tier);
    const currentFloor = org?.certification_tier_floor
      ? String(org.certification_tier_floor).toUpperCase()
      : null;
    const effective = maxTier(maxTier(legacy, org?.tier_override), currentFloor);
    const desired: CanonicalTier = maxTier(effective, 'SILVER');
    if (tierRank(desired) > tierRank(currentFloor)) {
      await DbPromise.run(
        db,
        `UPDATE partner_organizations
         SET certification_tier_floor = ?, updated_at = NOW()
         WHERE id = ?`,
        [desired, params.partnerOrgId]
      );
    }
  } catch (e: unknown) {
    logger.warn('[PartnerCertification] Failed to update incentive floor', (e as Error)?.message);
  }

  return { passed, scorePercent, certificateId };
}
