import crypto from 'crypto';

import { getDatabase } from '../database/Database.js';
import { withPgTransaction } from '../database/PostgresDatabase.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

export type PartnerResourceLanguage = 'en' | 'pl';
export type PartnerCertificationTrack = 'sales' | 'delivery' | 'strategic';
export type PartnerCertificationLevel = 'foundation' | 'practitioner' | 'advanced';
export type CertificationType =
  | 'sales_foundation'
  | 'sales_practitioner'
  | 'sales_advanced'
  | 'delivery_foundation'
  | 'delivery_practitioner'
  | 'delivery_advanced'
  | 'strategic_foundation'
  | 'strategic_practitioner'
  | 'strategic_advanced';

type CanonicalTier = 'REGISTERED' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

interface PartnerCertificationBlueprint {
  type: CertificationType;
  track: PartnerCertificationTrack;
  level: PartnerCertificationLevel;
  titleEn: string;
  titlePl: string;
  targetTier: CanonicalTier;
  examMode: 'exam' | 'review';
  publicArticleSlug: string;
  lifecycleStep: 'discover' | 'apply' | 'activate' | 'earn' | 'payout';
  recertificationPolicy: string;
  prerequisiteTypes?: CertificationType[];
}

export interface PartnerCertificationRow {
  id: string;
  partner_org_id?: string;
  user_id?: string;
  certification_name?: string;
  certification_type: CertificationType | string;
  certification_track?: PartnerCertificationTrack | string;
  certification_level?: PartnerCertificationLevel | string;
  status?: string;
  progress_percent?: number;
  started_at?: string | null;
  completed_at?: string | null;
  passed_exam_at?: string | null;
  certificate_id?: string | null;
  certificate_url?: string | null;
  attempt_count?: number | null;
  last_attempt_at?: string | null;
  review_state?: string | null;
  valid_until?: string | null;
  recertification_policy?: string | null;
  tier_target?: string | null;
  exam_mode?: 'exam' | 'review' | string | null;
  public_article_slug?: string | null;
  partner_lifecycle_step?: string | null;
  review_notes?: string | null;
}

export interface LearningModuleRow {
  id: string;
  name: string;
  description?: string | null;
  certification_type: string;
  certification_track?: string | null;
  certification_level?: string | null;
  module_order: number;
  duration_minutes?: number | null;
  content_type?: string | null;
  required_for_certification?: boolean | null;
  language?: string | null;
  minutes?: number | null;
  module_kind?: string | null;
  resource_article_slug?: string | null;
  resource_label?: string | null;
  partner_lifecycle_step?: string | null;
  owner_role?: string | null;
  review_required?: boolean | null;
}

export function getCertificationBlueprints(): PartnerCertificationBlueprint[] {
  return CERTIFICATION_BLUEPRINTS;
}

const COOLDOWN_MINUTES = 10;
const EXAM_DEADLINE_MINUTES = 30;
const EXAM_QUESTION_COUNT = 6;
const MIN_QUESTION_COUNT = 5;

const TIER_ORDER: CanonicalTier[] = ['REGISTERED', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];

const CERTIFICATION_BLUEPRINTS: PartnerCertificationBlueprint[] = [
  {
    type: 'sales_foundation',
    track: 'sales',
    level: 'foundation',
    titleEn: 'Sales Foundation Certification',
    titlePl: 'Certyfikacja Sales Foundation',
    targetTier: 'BRONZE',
    examMode: 'exam',
    publicArticleSlug: 'partner-program-overview',
    lifecycleStep: 'discover',
    recertificationPolicy: 'annual_refresh',
  },
  {
    type: 'sales_practitioner',
    track: 'sales',
    level: 'practitioner',
    titleEn: 'Sales Practitioner Certification',
    titlePl: 'Certyfikacja Sales Practitioner',
    targetTier: 'SILVER',
    examMode: 'exam',
    publicArticleSlug: 'partner-case-study-operations-rollout',
    lifecycleStep: 'earn',
    recertificationPolicy: 'annual_refresh',
    prerequisiteTypes: ['sales_foundation'],
  },
  {
    type: 'sales_advanced',
    track: 'sales',
    level: 'advanced',
    titleEn: 'Sales Advanced Certification',
    titlePl: 'Certyfikacja Sales Advanced',
    targetTier: 'GOLD',
    examMode: 'review',
    publicArticleSlug: 'partner-case-study-cfo-governance',
    lifecycleStep: 'payout',
    recertificationPolicy: 'annual_refresh',
    prerequisiteTypes: ['sales_practitioner'],
  },
  {
    type: 'delivery_foundation',
    track: 'delivery',
    level: 'foundation',
    titleEn: 'Delivery Foundation Certification',
    titlePl: 'Certyfikacja Delivery Foundation',
    targetTier: 'BRONZE',
    examMode: 'exam',
    publicArticleSlug: 'partner-payout-and-activation',
    lifecycleStep: 'activate',
    recertificationPolicy: 'annual_refresh',
  },
  {
    type: 'delivery_practitioner',
    track: 'delivery',
    level: 'practitioner',
    titleEn: 'Delivery Practitioner Certification',
    titlePl: 'Certyfikacja Delivery Practitioner',
    targetTier: 'SILVER',
    examMode: 'review',
    publicArticleSlug: 'partner-case-study-operations-rollout',
    lifecycleStep: 'earn',
    recertificationPolicy: 'annual_refresh',
    prerequisiteTypes: ['delivery_foundation'],
  },
  {
    type: 'delivery_advanced',
    track: 'delivery',
    level: 'advanced',
    titleEn: 'Delivery Advanced Certification',
    titlePl: 'Certyfikacja Delivery Advanced',
    targetTier: 'GOLD',
    examMode: 'review',
    publicArticleSlug: 'partner-payout-and-activation',
    lifecycleStep: 'payout',
    recertificationPolicy: 'annual_refresh',
    prerequisiteTypes: ['delivery_practitioner'],
  },
  {
    type: 'strategic_foundation',
    track: 'strategic',
    level: 'foundation',
    titleEn: 'Strategic Foundation Certification',
    titlePl: 'Certyfikacja Strategic Foundation',
    targetTier: 'BRONZE',
    examMode: 'exam',
    publicArticleSlug: 'partner-program-overview',
    lifecycleStep: 'discover',
    recertificationPolicy: 'annual_refresh',
  },
  {
    type: 'strategic_practitioner',
    track: 'strategic',
    level: 'practitioner',
    titleEn: 'Strategic Practitioner Certification',
    titlePl: 'Certyfikacja Strategic Practitioner',
    targetTier: 'SILVER',
    examMode: 'review',
    publicArticleSlug: 'partner-certification-explainer',
    lifecycleStep: 'earn',
    recertificationPolicy: 'annual_refresh',
    prerequisiteTypes: ['strategic_foundation'],
  },
  {
    type: 'strategic_advanced',
    track: 'strategic',
    level: 'advanced',
    titleEn: 'Strategic Advanced Certification',
    titlePl: 'Certyfikacja Strategic Advanced',
    targetTier: 'GOLD',
    examMode: 'review',
    publicArticleSlug: 'partner-case-study-cfo-governance',
    lifecycleStep: 'payout',
    recertificationPolicy: 'annual_refresh',
    prerequisiteTypes: ['strategic_practitioner'],
  },
];

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

function certificationLabel(
  blueprint: PartnerCertificationBlueprint,
  language: PartnerResourceLanguage
): string {
  return language === 'pl' ? blueprint.titlePl : blueprint.titleEn;
}

function validUntilFromPolicy(policy?: string | null): string | null {
  const now = new Date();
  if (!policy) return null;
  if (policy === 'annual_refresh') {
    now.setFullYear(now.getFullYear() + 1);
    return now.toISOString();
  }
  return null;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (!value) return fallback;
  if (Array.isArray(value) || typeof value === 'object') return value as T;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
}

function stableRecordJson(value: Record<string, string>): string {
  return JSON.stringify(
    Object.fromEntries(Object.entries(value || {}).sort(([a], [b]) => a.localeCompare(b)))
  );
}

function certificationPassingScore(certificationLevel?: string | null): number {
  return certificationLevel === 'practitioner' ? 80 : 70;
}

function certificationBlueprint(
  type: string | null | undefined
): PartnerCertificationBlueprint | null {
  if (!type) return null;
  return CERTIFICATION_BLUEPRINTS.find((item) => item.type === type) || null;
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

export async function ensurePartnerCertificationMatrix(params: {
  partnerOrgId: string;
  userId: string;
  language?: PartnerResourceLanguage;
}): Promise<PartnerCertificationRow[]> {
  const db = getDatabase();
  const language = toLanguage(params.language);
  const rows: PartnerCertificationRow[] = [];

  for (const blueprint of CERTIFICATION_BLUEPRINTS) {
    let existing = await DbPromise.get<PartnerCertificationRow>(
      db,
      `SELECT *
       FROM partner_certifications
       WHERE partner_org_id = ? AND user_id = ? AND certification_type = ?
       LIMIT 1`,
      [params.partnerOrgId, params.userId, blueprint.type]
    );

    if (!existing) {
      const id = crypto.randomUUID();
      await DbPromise.run(
        db,
        `INSERT INTO partner_certifications
          (
            id, partner_org_id, user_id, certification_name, certification_type,
            certification_track, certification_level, status, progress_percent,
            review_state, recertification_policy, tier_target, exam_mode,
            public_article_slug, partner_lifecycle_step, created_at, updated_at
          )
         VALUES (?, ?, ?, ?, ?, ?, ?, 'not_started', 0, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          id,
          params.partnerOrgId,
          params.userId,
          certificationLabel(blueprint, language),
          blueprint.type,
          blueprint.track,
          blueprint.level,
          blueprint.examMode === 'review' ? 'ready' : 'not_required',
          blueprint.recertificationPolicy,
          blueprint.targetTier,
          blueprint.examMode,
          blueprint.publicArticleSlug,
          blueprint.lifecycleStep,
        ]
      );
      existing = await DbPromise.get<PartnerCertificationRow>(
        db,
        `SELECT * FROM partner_certifications WHERE id = ?`,
        [id]
      );
    } else {
      await DbPromise.run(
        db,
        `UPDATE partner_certifications
         SET certification_name = COALESCE(certification_name, ?),
             certification_track = COALESCE(certification_track, ?),
             certification_level = COALESCE(certification_level, ?),
             review_state = COALESCE(review_state, ?),
             recertification_policy = COALESCE(recertification_policy, ?),
             tier_target = COALESCE(tier_target, ?),
             exam_mode = COALESCE(exam_mode, ?),
             public_article_slug = COALESCE(public_article_slug, ?),
             partner_lifecycle_step = COALESCE(partner_lifecycle_step, ?),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          certificationLabel(blueprint, language),
          blueprint.track,
          blueprint.level,
          blueprint.examMode === 'review' ? 'ready' : 'not_required',
          blueprint.recertificationPolicy,
          blueprint.targetTier,
          blueprint.examMode,
          blueprint.publicArticleSlug,
          blueprint.lifecycleStep,
          existing.id,
        ]
      );
      existing = await DbPromise.get<PartnerCertificationRow>(
        db,
        `SELECT * FROM partner_certifications WHERE id = ?`,
        [existing.id]
      );
    }

    if (existing) rows.push(existing);
  }

  return rows;
}

export async function ensureSalesCertification(params: {
  partnerOrgId: string;
  userId: string;
}): Promise<PartnerCertificationRow> {
  const rows = await ensurePartnerCertificationMatrix({ ...params, language: 'en' });
  const sales = rows.find((row) => row.certification_type === 'sales_foundation');
  if (!sales) throw new Error('Failed to create sales certification');
  return sales;
}

export async function getCertificationModules(
  certificationType: string,
  language: PartnerResourceLanguage
): Promise<LearningModuleRow[]> {
  const db = getDatabase();
  const rows = await DbPromise.all<LearningModuleRow>(
    db,
    `SELECT id, name, description, certification_type, certification_track, certification_level,
            module_order, duration_minutes, content_type, required_for_certification, language,
            minutes, module_kind, resource_article_slug, resource_label, partner_lifecycle_step,
            owner_role, review_required
     FROM partner_learning_modules
     WHERE is_active = TRUE
       AND certification_type = ?
       AND COALESCE(language, 'en') = ?
     ORDER BY module_order ASC`,
    [certificationType, language]
  );
  return rows;
}

export async function getSalesModules(
  language: PartnerResourceLanguage
): Promise<LearningModuleRow[]> {
  return getCertificationModules('sales_foundation', language);
}

export async function ensureLearningProgressRows(params: {
  certificationId: string;
  moduleIds: string[];
}): Promise<void> {
  const db = getDatabase();
  for (const moduleId of params.moduleIds) {
    await DbPromise.run(
      db,
      `INSERT INTO partner_learning_progress
        (id, certification_id, module_id, status, progress_percent, created_at, updated_at)
       VALUES (?, ?, ?, 'not_started', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (certification_id, module_id) DO NOTHING`,
      [crypto.randomUUID(), params.certificationId, moduleId]
    );
  }
}

export async function recalcCertificationProgress(certificationId: string): Promise<void> {
  const db = getDatabase();
  const cert = await DbPromise.get<PartnerCertificationRow>(
    db,
    `SELECT * FROM partner_certifications WHERE id = ?`,
    [certificationId]
  );
  if (!cert) return;

  const agg = await DbPromise.get<{ total: number; completed: number }>(
    db,
    `SELECT
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) as completed
     FROM partner_learning_progress
     WHERE certification_id = ?`,
    [certificationId]
  );

  const total = agg?.total || 0;
  const completed = agg?.completed || 0;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  const examMode = String(cert.exam_mode || 'exam');
  const reviewState = String(cert.review_state || '');
  let status = 'not_started';
  let completedAt: string | null = null;
  let nextReviewState = cert.review_state || null;

  if (completed > 0) {
    status = completed === total ? 'in_progress' : 'in_progress';
  }

  if (completed === total && total > 0) {
    if (cert.certificate_id || cert.passed_exam_at || reviewState === 'approved') {
      status = 'completed';
      completedAt = cert.completed_at || new Date().toISOString();
    } else if (examMode === 'review') {
      status = 'in_progress';
      nextReviewState =
        reviewState && reviewState !== 'ready' && reviewState !== 'not_required'
          ? reviewState
          : 'pending';
    }
  }

  await DbPromise.run(
    db,
    `UPDATE partner_certifications
     SET progress_percent = ?,
         status = ?,
         review_state = COALESCE(?, review_state),
         started_at = CASE WHEN ? > 0 THEN COALESCE(started_at, CURRENT_TIMESTAMP) ELSE started_at END,
         completed_at = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [progress, status, nextReviewState, progress, completedAt, certificationId]
  );
}

async function requireCertificationOwnership(params: {
  certificationId: string;
  partnerOrgId: string;
  userId: string;
}): Promise<PartnerCertificationRow> {
  const db = getDatabase();
  const cert = await DbPromise.get<PartnerCertificationRow>(
    db,
    `SELECT * FROM partner_certifications
     WHERE id = ? AND partner_org_id = ? AND user_id = ?`,
    [params.certificationId, params.partnerOrgId, params.userId]
  );
  if (!cert) {
    throw new Error('Certification not found');
  }
  return cert;
}

function stableAttemptId(params: {
  certificationId: string;
  partnerOrgId: string;
  userId: string;
  idempotencyKey: string;
}): string {
  const hex = crypto
    .createHash('sha256')
    .update(
      `${params.partnerOrgId}:${params.userId}:${params.certificationId}:${params.idempotencyKey}`
    )
    .digest('hex')
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20)}`;
}

export async function updateCertificationModuleProgress(params: {
  certificationId: string;
  moduleId: string;
  partnerOrgId: string;
  userId: string;
  status?: 'not_started' | 'in_progress' | 'completed';
  progress?: number;
}): Promise<{ status: string; progressPercent: number }> {
  if (!params.status && !Number.isFinite(params.progress)) {
    throw new Error('status or progress required');
  }
  const progress = Number.isFinite(params.progress)
    ? Math.max(0, Math.min(100, Number(params.progress)))
    : null;
  return withPgTransaction(async (query) => {
    const cert = await query<any>(
      `SELECT id, certification_type, exam_mode, review_state, certificate_id, passed_exam_at,
              completed_at
       FROM partner_certifications
       WHERE id=$1 AND partner_org_id=$2 AND user_id=$3 FOR UPDATE`,
      [params.certificationId, params.partnerOrgId, params.userId]
    );
    if (!cert.rows[0]) throw new Error('Certification not found');
    const module = await query(
      `SELECT id FROM partner_learning_modules
       WHERE id=$1 AND certification_type=$2 AND is_active=TRUE`,
      [params.moduleId, cert.rows[0].certification_type]
    );
    if (!module.rows[0]) throw new Error('Module not found for certification');
    await query(
      `INSERT INTO partner_learning_progress
         (id,certification_id,module_id,status,progress_percent,started_at,completed_at,created_at,updated_at)
       VALUES ($1,$2,$3,$4::text,$5::int,NOW(),CASE WHEN $4::text='completed' THEN NOW() END,NOW(),NOW())
       ON CONFLICT (certification_id,module_id) DO UPDATE SET
         status=COALESCE($6::text,partner_learning_progress.status),
         progress_percent=COALESCE($7::int,partner_learning_progress.progress_percent),
         started_at=COALESCE(partner_learning_progress.started_at,NOW()),
         completed_at=CASE WHEN COALESCE($6::text,partner_learning_progress.status)='completed'
                           THEN COALESCE(partner_learning_progress.completed_at,NOW())
                           ELSE partner_learning_progress.completed_at END,
         updated_at=NOW()`,
      [
        crypto.randomUUID(),
        params.certificationId,
        params.moduleId,
        params.status || 'in_progress',
        progress ?? 0,
        params.status || null,
        progress,
      ]
    );
    const agg = await query<any>(
      `SELECT COUNT(*)::int total,
              COUNT(*) FILTER (WHERE status='completed')::int completed
       FROM partner_learning_progress WHERE certification_id=$1`,
      [params.certificationId]
    );
    const total = agg.rows[0]?.total || 0;
    const completed = agg.rows[0]?.completed || 0;
    const percentage = total ? Math.round((completed / total) * 100) : 0;
    await query(
      `UPDATE partner_certifications SET progress_percent=$1,
         status=CASE WHEN certificate_id IS NOT NULL OR passed_exam_at IS NOT NULL THEN 'completed'
                     WHEN $1>0 THEN 'in_progress' ELSE 'not_started' END,
         started_at=CASE WHEN $1>0 THEN COALESCE(started_at,NOW()) ELSE started_at END,
         updated_at=NOW() WHERE id=$2`,
      [percentage, params.certificationId]
    );
    const row = await query<any>(
      `SELECT status,progress_percent FROM partner_learning_progress
       WHERE certification_id=$1 AND module_id=$2`,
      [params.certificationId, params.moduleId]
    );
    return { status: row.rows[0].status, progressPercent: Number(row.rows[0].progress_percent) };
  });
}

export async function startCertificationExam(params: {
  certificationId: string;
  partnerOrgId: string;
  userId: string;
  language: PartnerResourceLanguage;
  ip?: string | null;
  userAgent?: string | null;
  idempotencyKey?: string;
}): Promise<{
  attemptId: string;
  deadlineAt: string;
  questions: Array<{ id: string; text: string; options: Array<{ id: string; label: string }> }>;
}> {
  const db = getDatabase();
  const cert = await requireCertificationOwnership(params);
  const idempotencyKey = String(params.idempotencyKey || '').trim();
  const attemptId = idempotencyKey
    ? stableAttemptId({ ...params, idempotencyKey })
    : crypto.randomUUID();
  const existingAttempt = idempotencyKey
    ? await DbPromise.get<any>(
        db,
        `SELECT * FROM partner_certification_attempts
         WHERE id=? AND certification_id=? AND partner_org_id=? AND user_id=?`,
        [attemptId, params.certificationId, params.partnerOrgId, params.userId]
      )
    : null;
  if (existingAttempt) {
    const ids = parseJson<Array<{ questionId: string }>>(existingAttempt.questions_json, []).map(
      (item) => item.questionId
    );
    const existingQuestions = ids.length
      ? await DbPromise.all<any>(
          db,
          `SELECT id,question_text,options_json FROM partner_exam_questions
           WHERE id IN (${ids.map(() => '?').join(',')})`,
          ids
        )
      : [];
    const byId = new Map(existingQuestions.map((q) => [q.id, q]));
    return {
      attemptId,
      deadlineAt: existingAttempt.deadline_at,
      questions: ids
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map((q: any) => ({
          id: q.id,
          text: q.question_text,
          options: parseJson<Array<{ id: string; label: string }>>(q.options_json, []),
        })),
    };
  }
  const blueprint = certificationBlueprint(cert.certification_type);
  if (!blueprint) throw new Error('Certification blueprint not found');
  if (String(cert.exam_mode || blueprint.examMode) !== 'exam') {
    throw new Error('This certification uses operator review instead of an exam');
  }

  const modules = await getCertificationModules(cert.certification_type, params.language);
  await ensureLearningProgressRows({
    certificationId: cert.id,
    moduleIds: modules.map((module) => module.id),
  });
  await recalcCertificationProgress(cert.id);

  const refreshed = await requireCertificationOwnership(params);
  if ((refreshed.progress_percent || 0) < 100) {
    throw new Error('Complete the learning path before starting the exam');
  }
  if (refreshed.certificate_id) {
    throw new Error('Certification already completed');
  }

  if (refreshed.last_attempt_at) {
    const last = new Date(refreshed.last_attempt_at).getTime();
    const mins = (Date.now() - last) / (1000 * 60);
    if (mins < COOLDOWN_MINUTES) {
      throw new Error(`Please wait ${Math.ceil(COOLDOWN_MINUTES - mins)} minutes before retrying`);
    }
  }

  const questions = await DbPromise.all<any>(
    db,
    `SELECT id, question_text, options_json
     FROM partner_exam_questions
     WHERE certification_type = ?
       AND COALESCE(language, 'en') = ?
     ORDER BY RANDOM()
     LIMIT ${EXAM_QUESTION_COUNT}`,
    [cert.certification_type, params.language]
  );

  if (questions.length < MIN_QUESTION_COUNT) {
    throw new Error('Question bank not configured');
  }

  const deadlineAt = new Date(Date.now() + EXAM_DEADLINE_MINUTES * 60 * 1000).toISOString();
  const ipHash = params.ip
    ? crypto.createHash('sha256').update(String(params.ip)).digest('hex')
    : null;

  const created = await withPgTransaction(async (query) => {
    await query(`SELECT id FROM partner_certifications WHERE id=$1 FOR UPDATE`, [
      params.certificationId,
    ]);
    const inserted = await query(
      `INSERT INTO partner_certification_attempts
        (id,certification_id,partner_org_id,user_id,deadline_at,language,questions_json,ip_hash,user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING RETURNING id`,
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
    if (inserted.rowCount) {
      await query(
        `UPDATE partner_certifications SET attempt_count=COALESCE(attempt_count,0)+1,
         last_attempt_at=NOW(),updated_at=NOW() WHERE id=$1`,
        [params.certificationId]
      );
    }
    return inserted.rowCount > 0;
  });

  if (!created && idempotencyKey) return startCertificationExam(params);

  return {
    attemptId,
    deadlineAt,
    questions: questions.map((q: any) => ({
      id: q.id,
      text: q.question_text,
      options: parseJson<Array<{ id: string; label: string }>>(q.options_json, []),
    })),
  };
}

export async function startSalesExam(params: {
  certificationId: string;
  partnerOrgId: string;
  userId: string;
  language: PartnerResourceLanguage;
  ip?: string | null;
  userAgent?: string | null;
  idempotencyKey?: string;
}) {
  return startCertificationExam(params);
}

export async function submitCertificationExam(params: {
  attemptId: string;
  certificationId: string;
  partnerOrgId: string;
  userId: string;
  answers: Record<string, string>;
  idempotencyKey?: string;
}): Promise<{
  passed: boolean;
  scorePercent: number;
  certificateId?: string;
  reviewState?: string;
}> {
  return withPgTransaction(async (query) => {
    const certResult = await query<any>(
      `SELECT * FROM partner_certifications
     WHERE id=$1 AND partner_org_id=$2 AND user_id=$3 FOR UPDATE`,
      [params.certificationId, params.partnerOrgId, params.userId]
    );
    const cert = certResult.rows[0];
    if (!cert) throw new Error('Certification not found');
    const attemptResult = await query<any>(
      `SELECT * FROM partner_certification_attempts
     WHERE id=$1 AND certification_id=$2 AND partner_org_id=$3 AND user_id=$4 FOR UPDATE`,
      [params.attemptId, params.certificationId, params.partnerOrgId, params.userId]
    );
    const attempt = attemptResult.rows[0];
    if (!attempt) throw new Error('Attempt not found');
    if (attempt.submitted_at) {
      const previous = parseJson<Record<string, string>>(attempt.answers_json, {});
      if (stableRecordJson(previous) !== stableRecordJson(params.answers || {})) {
        throw new Error('Idempotency replay payload mismatch');
      }
      return {
        passed: Boolean(attempt.passed),
        scorePercent: Number(attempt.score_percent),
        ...(cert.certificate_id ? { certificateId: cert.certificate_id } : {}),
        reviewState: cert.review_state || undefined,
      };
    }
    if (new Date(attempt.deadline_at).getTime() < Date.now()) throw new Error('Attempt expired');

    const questionIds = parseJson<Array<{ questionId: string }>>(attempt.questions_json, []).map(
      (item) => item.questionId
    );
    if (questionIds.length === 0) throw new Error('Attempt questions missing');

    const questions = (
      await query<any>(
        `SELECT id, correct_option_id, passing_score
     FROM partner_exam_questions
     WHERE certification_type = $1 AND id = ANY($2::text[])`,
        [cert.certification_type, questionIds]
      )
    ).rows;
    const correctMap = new Map(
      questions.map((question) => [question.id, String(question.correct_option_id || '')])
    );
    let score = 0;
    for (const qid of questionIds) {
      const answer = params.answers[qid];
      if (answer && correctMap.get(qid) === answer) score += 1;
    }

    const scorePercent = Math.round((score / questionIds.length) * 100);
    const passed = scorePercent >= certificationPassingScore(cert.certification_level);
    await query(
      `UPDATE partner_certification_attempts
     SET submitted_at = CURRENT_TIMESTAMP, answers_json = $1, score_percent = $2, passed = $3
     WHERE id = $4`,
      [JSON.stringify(params.answers || {}), scorePercent, passed, params.attemptId]
    );

    if (!passed) {
      return { passed, scorePercent, reviewState: cert.review_state || undefined };
    }

    const blueprint = certificationBlueprint(cert.certification_type);
    const certificateId = crypto.randomUUID();
    const shareToken = crypto.randomBytes(18).toString('hex');
    const validUntil = validUntilFromPolicy(
      cert.recertification_policy || blueprint?.recertificationPolicy
    );

    await query(
      `INSERT INTO partner_certificates
      (
        id, partner_org_id, user_id, certification_id, certificate_type, share_token,
        certification_track, certification_level, review_state, valid_until, earned_at, created_at
      )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'approved',$9,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
      [
        certificateId,
        params.partnerOrgId,
        params.userId,
        params.certificationId,
        cert.certification_type,
        shareToken,
        cert.certification_track || blueprint?.track || null,
        cert.certification_level || blueprint?.level || null,
        validUntil,
      ]
    );

    await query(
      `UPDATE partner_certifications
     SET certificate_id = $1,
         certificate_url = $2,
         passed_exam_at = CURRENT_TIMESTAMP,
         completed_at = CURRENT_TIMESTAMP,
         status = 'completed',
         review_state = 'approved',
         valid_until = $3,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $4`,
      [
        certificateId,
        `/api/partners/certificates/${certificateId}/download`,
        validUntil,
        params.certificationId,
      ]
    );

    try {
      const org = (
        await query<any>(
          `SELECT tier, tier_override, certification_tier_floor FROM partner_organizations WHERE id = $1`,
          [params.partnerOrgId]
        )
      ).rows[0];
      const legacy = legacyPartnerTierToCanonical(org?.tier);
      const currentFloor = org?.certification_tier_floor
        ? String(org.certification_tier_floor).toUpperCase()
        : null;
      const effective = maxTier(maxTier(legacy, org?.tier_override), currentFloor);
      const desired = maxTier(effective, cert.tier_target || blueprint?.targetTier || 'SILVER');
      if (tierRank(desired) > tierRank(currentFloor)) {
        await query(
          `UPDATE partner_organizations
         SET certification_tier_floor = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
          [desired, params.partnerOrgId]
        );
      }
    } catch (error: unknown) {
      logger.warn(
        '[PartnerCertification] Failed to update incentive floor',
        (error as Error)?.message
      );
    }

    return { passed, scorePercent, certificateId, reviewState: 'approved' };
  });
}

export async function submitSalesExam(params: {
  attemptId: string;
  certificationId: string;
  partnerOrgId: string;
  userId: string;
  answers: Record<string, string>;
  idempotencyKey?: string;
}) {
  return submitCertificationExam(params);
}

export async function getCertificationReviewQueue(limit = 100): Promise<any[]> {
  const db = getDatabase();
  return DbPromise.all<any>(
    db,
    `SELECT pc.id, pc.partner_org_id, pc.user_id, pc.certification_name, pc.certification_type,
            pc.certification_track, pc.certification_level, pc.status, pc.review_state,
            pc.progress_percent, pc.updated_at, po.name as partner_name
     FROM partner_certifications pc
     JOIN partner_organizations po ON po.id = pc.partner_org_id
     WHERE COALESCE(pc.exam_mode, 'exam') = 'review'
       AND COALESCE(pc.review_state, 'ready') IN ('pending', 'ready', 'changes_requested')
     ORDER BY pc.updated_at DESC
     LIMIT ?`,
    [limit]
  );
}

export async function updateCertificationReviewState(params: {
  certificationId: string;
  reviewState: 'approved' | 'changes_requested' | 'pending';
  notes?: string | null;
}): Promise<void> {
  const db = getDatabase();
  const cert = await DbPromise.get<PartnerCertificationRow>(
    db,
    `SELECT * FROM partner_certifications WHERE id = ?`,
    [params.certificationId]
  );
  if (!cert) throw new Error('Certification not found');

  let certificateId = cert.certificate_id || null;
  let validUntil = cert.valid_until || null;
  if (params.reviewState === 'approved' && !certificateId) {
    certificateId = crypto.randomUUID();
    validUntil = validUntilFromPolicy(cert.recertification_policy);
    await DbPromise.run(
      db,
      `INSERT INTO partner_certificates
        (
          id, partner_org_id, user_id, certification_id, certificate_type, share_token,
          certification_track, certification_level, review_state, valid_until, earned_at, created_at
        )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
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

  await DbPromise.run(
    db,
    `UPDATE partner_certifications
     SET review_state = ?,
         review_notes = ?,
         status = CASE WHEN ? = 'approved' THEN 'completed' ELSE status END,
         certificate_id = COALESCE(?, certificate_id),
         certificate_url = CASE WHEN ? IS NOT NULL THEN ? ELSE certificate_url END,
         completed_at = CASE WHEN ? = 'approved' THEN COALESCE(completed_at, CURRENT_TIMESTAMP) ELSE completed_at END,
         valid_until = COALESCE(?, valid_until),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      params.reviewState,
      params.notes || null,
      params.reviewState,
      certificateId,
      certificateId,
      certificateId ? `/api/partners/certificates/${certificateId}/download` : null,
      params.reviewState,
      validUntil,
      params.certificationId,
    ]
  );
}

export async function getPartnerCertificationReporting(): Promise<{
  certificationsByTrack: any[];
  reviewBacklog: any[];
  examPassRates: any[];
  blockedReasons: Array<{ reason: string; count: number }>;
}> {
  const db = getDatabase();
  const [certificationsByTrack, reviewBacklog, examPassRates] = await Promise.all([
    DbPromise.all<any>(
      db,
      `SELECT certification_track as track, certification_level as level, status, COUNT(*) as count
       FROM partner_certifications
       GROUP BY certification_track, certification_level, status
       ORDER BY certification_track ASC, certification_level ASC, status ASC`
    ),
    DbPromise.all<any>(
      db,
      `SELECT review_state, COUNT(*) as count
       FROM partner_certifications
       WHERE COALESCE(exam_mode, 'exam') = 'review'
       GROUP BY review_state
       ORDER BY count DESC`
    ),
    DbPromise.all<any>(
      db,
      `SELECT pc.certification_track as track, pc.certification_level as level,
              ROUND(AVG(CASE WHEN pca.passed THEN 100 ELSE 0 END)) as pass_rate,
              COUNT(*) as attempts
       FROM partner_certification_attempts pca
       JOIN partner_certifications pc ON pc.id = pca.certification_id
       GROUP BY pc.certification_track, pc.certification_level
       ORDER BY pc.certification_track ASC, pc.certification_level ASC`
    ),
  ]);

  const blockedReasons = [
    {
      reason: 'review_pending',
      count:
        reviewBacklog
          .filter((row) => ['pending', 'ready'].includes(String(row.review_state || '')))
          .reduce((sum, row) => sum + Number(row.count || 0), 0) || 0,
    },
    {
      reason: 'academy_incomplete',
      count:
        certificationsByTrack
          .filter((row) => row.status === 'in_progress')
          .reduce((sum, row) => sum + Number(row.count || 0), 0) || 0,
    },
    {
      reason: 'not_started',
      count:
        certificationsByTrack
          .filter((row) => row.status === 'not_started')
          .reduce((sum, row) => sum + Number(row.count || 0), 0) || 0,
    },
  ];

  return {
    certificationsByTrack,
    reviewBacklog,
    examPassRates,
    blockedReasons,
  };
}
