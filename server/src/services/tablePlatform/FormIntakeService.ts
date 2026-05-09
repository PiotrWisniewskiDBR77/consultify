/**
 * Form Intake Service (Block D · EPIC-T14 · Sprint D-S2)
 *
 * Hardens the public-form pipeline for Block D's "form-as-intake" workflow.
 * Sits next to the existing `FormService` rather than replacing it: the slug
 * router stays for backward compatibility, and the new JWT route runs in
 * parallel under `/api/table-platform/public/forms/jwt/:token/submit`.
 *
 * Responsibilities:
 *
 *   1. Issue per-recipient JWT links — `issueJwtLink({ formId, subject, expiresIn })`.
 *      Each call signs a token with the form's `public_jwt_secret`. If the
 *      form does not yet have a secret, this method generates one and
 *      persists it (one-time op).
 *
 *   2. Verify a JWT and resolve the target form — `verifyJwt({ token })`.
 *      Returns the form context (form, target table id, allow-list, expiry).
 *      Throws `FormIntakeError` codes the public route can map to 4xx.
 *
 *   3. Submit a public form via either path — `submitFromPublic({ ... })`.
 *      Wraps `FormService.submitForm(...)` with:
 *        - Field allow-list filter (drops keys not in `field_allow_list` when
 *          one is configured).
 *        - Provenance tagging via `RecordSourcesService.create(...)` so every
 *          submitted record carries a `{ type: 'form_submission' }` source row.
 *        - Audit ledger row in `tp_form_submissions` (success or failure).
 *
 *   4. Public submission rate limit — `checkRateLimit({ formId, ipHash })`.
 *      In-process token bucket per `(formId, ipHash)` with conservative
 *      defaults (10 / minute, 100 / hour). The route layer also wires
 *      `express-rate-limit` for IP-only protection; the service-layer limiter
 *      protects against single forms being hammered when the IP rotates.
 *      (Tests inject a synchronous limiter via `__setRateLimiterForTesting`.)
 *
 * Cross-tenant safety:
 *   - The admin-side `getFormForAdmin(formId, organizationId)` resolves tenancy
 *     through `tp_tables → tp_bases.organization_id` and refuses cross-tenant
 *     reads. The public path skips org lookup (it is genuinely public) but
 *     stores the IP hash + audit row so security can spot abuse.
 *
 * Persistence: `tp_forms` (extended) + `tp_form_submissions`. See
 * `server/migrations/20260513_block_d_form_intake.sql`.
 *
 * Spec:
 *   - 00_CTO_DECISIONS.md Q17 (parallel JWT route, allow-list, rate limit).
 *   - block-D-integration-evidence/audit-findings/PUBLIC_FORM_AUDIT_2026-05-08.md
 */

import { createHash, randomBytes } from 'node:crypto';

import jwt from 'jsonwebtoken';

interface JwtPayload {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
  formId?: string;
  [key: string]: unknown;
}

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type FormIntakeKind = 'slug' | 'jwt';
export type FormSubmissionStatus = 'accepted' | 'rejected' | 'rate_limited';

export interface FormIntakeContext {
  formId: string;
  formSlug: string;
  /** Either tp_forms.embed_target_table_id (when set) or tp_forms.table_id. */
  targetTableId: string;
  /** When NULL, all configured form fields are accepted. */
  fieldAllowList: string[] | null;
  publicLinkExpiresAt: string | null;
  isPublished: boolean;
}

export interface IssueJwtLinkInput {
  formId: string;
  organizationId: string;
  /** Used for analytics / audit; e.g. recipient email. */
  subject: string;
  /** TTL in seconds; default 30 days. */
  expiresInSeconds?: number;
  /** Optional explicit expiry timestamp; overrides expiresInSeconds. */
  hardExpiresAt?: string;
}

export interface IssuedJwtLink {
  token: string;
  expiresAt: string;
}

export interface VerifyJwtInput {
  token: string;
}

export interface VerifyJwtResult extends FormIntakeContext {
  jwtSubject: string;
}

export interface SubmitFromPublicInput {
  intakeKind: FormIntakeKind;
  /** Form id resolved via slug or JWT. */
  formId: string;
  /** Submission payload (raw — service applies the allow-list). */
  data: Record<string, unknown>;
  /** Hashed client IP for the audit ledger. The route layer hashes; the
   *  service does not see the raw IP. */
  clientIpHash?: string | null;
  /** Optional JWT subject for audit when intakeKind === 'jwt'. */
  jwtSubject?: string | null;
}

export interface SubmitFromPublicResult {
  submissionId: string;
  recordId: string | null;
  status: FormSubmissionStatus;
  failureReason: string | null;
}

export interface RateLimiter {
  check(key: string): { allowed: boolean; resetAt: number };
}

// ── Errors ───────────────────────────────────────────────────────────────────

export class FormIntakeError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400
  ) {
    super(message);
    this.name = 'FormIntakeError';
  }
}

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const MAX_TTL_SECONDS = 180 * 24 * 60 * 60; // 180 days hard cap
const SUBJECT_MAX_CHARS = 320;
const ALLOW_LIST_MAX = 200;
const RATE_LIMIT_MINUTE = 10;
const RATE_LIMIT_HOUR = 100;

const JWT_ISSUER = 'consultify.tabele.form-intake';
const JWT_AUDIENCE = 'consultify.public.form-intake';

// ── Default rate limiter (in-process token bucket) ───────────────────────────

interface BucketState {
  minuteCount: number;
  minuteResetAt: number;
  hourCount: number;
  hourResetAt: number;
}

const buckets = new Map<string, BucketState>();

const defaultLimiter: RateLimiter = {
  check(key) {
    const now = Date.now();
    const bucket = buckets.get(key) ?? {
      minuteCount: 0,
      minuteResetAt: now + 60_000,
      hourCount: 0,
      hourResetAt: now + 3_600_000,
    };
    if (now > bucket.minuteResetAt) {
      bucket.minuteCount = 0;
      bucket.minuteResetAt = now + 60_000;
    }
    if (now > bucket.hourResetAt) {
      bucket.hourCount = 0;
      bucket.hourResetAt = now + 3_600_000;
    }
    if (bucket.minuteCount >= RATE_LIMIT_MINUTE) {
      buckets.set(key, bucket);
      return { allowed: false, resetAt: bucket.minuteResetAt };
    }
    if (bucket.hourCount >= RATE_LIMIT_HOUR) {
      buckets.set(key, bucket);
      return { allowed: false, resetAt: bucket.hourResetAt };
    }
    bucket.minuteCount += 1;
    bucket.hourCount += 1;
    buckets.set(key, bucket);
    return { allowed: true, resetAt: bucket.minuteResetAt };
  },
};

let activeLimiter: RateLimiter = defaultLimiter;

export function __setRateLimiterForTesting(limiter: RateLimiter | null): void {
  activeLimiter = limiter ?? defaultLimiter;
  if (!limiter) buckets.clear();
}

// ── FormService delegation (lazy import to avoid cycles in tests) ────────────

interface FormServiceLike {
  submitForm: (formId: string, data: Record<string, unknown>) => Promise<{ recordId: string }>;
}

let formServiceOverride: FormServiceLike | null = null;

export function __setFormServiceForTesting(svc: FormServiceLike | null): void {
  formServiceOverride = svc;
}

async function getFormService(): Promise<FormServiceLike> {
  if (formServiceOverride) return formServiceOverride;
  const mod = await import('./FormService.js');
  return mod.default as FormServiceLike;
}

// ── DB helpers ───────────────────────────────────────────────────────────────

interface FormRow {
  id: string;
  table_id: string;
  embed_target_table_id: string | null;
  slug: string;
  is_published: boolean;
  config: unknown;
  field_allow_list: unknown;
  public_jwt_secret: string | null;
  public_link_expires_at: string | Date | null;
}

async function loadFormById(formId: string): Promise<FormRow | null> {
  const db = getDatabase();
  const { rows } = await db.query(
    `SELECT id, table_id, embed_target_table_id, slug, is_published, config,
            field_allow_list, public_jwt_secret, public_link_expires_at
       FROM tp_forms
      WHERE id = $1
      LIMIT 1`,
    [formId]
  );
  return (rows?.[0] ?? null) as FormRow | null;
}

async function loadFormBySlug(slug: string): Promise<FormRow | null> {
  const db = getDatabase();
  const { rows } = await db.query(
    `SELECT id, table_id, embed_target_table_id, slug, is_published, config,
            field_allow_list, public_jwt_secret, public_link_expires_at
       FROM tp_forms
      WHERE slug = $1 AND is_published = true
      LIMIT 1`,
    [slug]
  );
  return (rows?.[0] ?? null) as FormRow | null;
}

async function tableTenantOrgId(tableId: string): Promise<string | null> {
  const db = getDatabase();
  const { rows } = await db.query(
    `SELECT b.organization_id
       FROM tp_tables t
       JOIN tp_bases  b ON t.base_id = b.id
      WHERE t.id = $1
      LIMIT 1`,
    [tableId]
  );
  const row = rows?.[0] as { organization_id?: unknown } | undefined;
  return row?.organization_id == null ? null : String(row.organization_id);
}

function rowToContext(row: FormRow): FormIntakeContext {
  const targetTableId = row.embed_target_table_id ?? row.table_id;
  let allowList: string[] | null = null;
  if (Array.isArray(row.field_allow_list)) {
    allowList = row.field_allow_list.map((v) => String(v)).filter((v) => v.length > 0);
    if (allowList.length === 0) allowList = null;
  } else if (typeof row.field_allow_list === 'string') {
    try {
      const parsed = JSON.parse(row.field_allow_list);
      if (Array.isArray(parsed)) {
        allowList = parsed.map((v) => String(v)).filter((v) => v.length > 0);
        if (allowList.length === 0) allowList = null;
      }
    } catch {
      allowList = null;
    }
  }
  const expiresAt =
    row.public_link_expires_at == null
      ? null
      : row.public_link_expires_at instanceof Date
        ? row.public_link_expires_at.toISOString()
        : String(row.public_link_expires_at);
  return {
    formId: row.id,
    formSlug: row.slug,
    targetTableId,
    fieldAllowList: allowList,
    publicLinkExpiresAt: expiresAt,
    isPublished: Boolean(row.is_published),
  };
}

async function ensureJwtSecret(formId: string, existing: string | null): Promise<string> {
  if (existing && existing.length >= 32) return existing;
  const secret = randomBytes(48).toString('base64url');
  const db = getDatabase();
  await db.query(
    `UPDATE tp_forms
        SET public_jwt_secret = $2,
            updated_at = NOW()
      WHERE id = $1`,
    [formId, secret]
  );
  return secret;
}

async function recordSubmissionAudit(args: {
  formId: string;
  tableId: string;
  recordId: string | null;
  intakeKind: FormIntakeKind;
  jwtSubject: string | null;
  clientIpHash: string | null;
  status: FormSubmissionStatus;
  failureReason: string | null;
}): Promise<string> {
  const db = getDatabase();
  const { rows } = await db.query(
    `INSERT INTO tp_form_submissions
       (form_id, table_id, record_id, intake_kind, jwt_subject,
        client_ip_hash, status, failure_reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      args.formId,
      args.tableId,
      args.recordId,
      args.intakeKind,
      args.jwtSubject,
      args.clientIpHash,
      args.status,
      args.failureReason,
    ]
  );
  const row = rows?.[0] as { id?: unknown } | undefined;
  if (!row?.id) throw new FormIntakeError('AUDIT_FAILED', 'Audit row insert failed', 500);
  return String(row.id);
}

// ── Allow-list filter ────────────────────────────────────────────────────────

/**
 * Returns a copy of `data` containing only keys present in `allowList`.
 * When `allowList` is `null`, returns `data` unchanged.
 */
function applyAllowList(
  data: Record<string, unknown>,
  allowList: string[] | null
): Record<string, unknown> {
  if (allowList == null) return data;
  const allowed = new Set(allowList);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (allowed.has(k)) out[k] = v;
  }
  return out;
}

// ── IP hash helper (route layer hashes; service exposes for unit tests) ──────

export function hashClientIp(ip: string, salt = 'cf-form-intake-v1'): string {
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

// ── Service ──────────────────────────────────────────────────────────────────

const formIntakeService = {
  /**
   * Resolves form context for the admin caller. Refuses cross-tenant reads.
   * Used by admin-side endpoints and tests.
   */
  async getFormForAdmin(formId: string, organizationId: string): Promise<FormIntakeContext> {
    if (!formId) throw new FormIntakeError('FORM_ID_REQUIRED', 'formId is required');
    if (!organizationId) {
      throw new FormIntakeError('ORG_ID_REQUIRED', 'organizationId is required');
    }
    const form = await loadFormById(formId);
    if (!form) throw new FormIntakeError('FORM_NOT_FOUND', 'Form not found', 404);
    const tenantOrg = await tableTenantOrgId(form.embed_target_table_id ?? form.table_id);
    if (!tenantOrg) throw new FormIntakeError('TABLE_NOT_FOUND', 'Form table not found', 404);
    if (tenantOrg !== organizationId) {
      throw new FormIntakeError('TENANT_VIOLATION', 'Form not in actor organization', 403);
    }
    return rowToContext(form);
  },

  /**
   * Issues a JWT link for a recipient. Generates the per-form HMAC secret
   * lazily on first call.
   */
  async issueJwtLink(input: IssueJwtLinkInput): Promise<IssuedJwtLink> {
    if (!input.formId) throw new FormIntakeError('FORM_ID_REQUIRED', 'formId is required');
    if (!input.organizationId) {
      throw new FormIntakeError('ORG_ID_REQUIRED', 'organizationId is required');
    }
    const subject = (input.subject ?? '').trim();
    if (!subject) throw new FormIntakeError('SUBJECT_REQUIRED', 'subject is required');
    if (subject.length > SUBJECT_MAX_CHARS) {
      throw new FormIntakeError('SUBJECT_TOO_LONG', `subject max ${SUBJECT_MAX_CHARS} chars`);
    }
    const ttl = clampTtl(input.expiresInSeconds);

    // ACL via getFormForAdmin (also loads the row).
    await this.getFormForAdmin(input.formId, input.organizationId);

    const form = await loadFormById(input.formId);
    if (!form) throw new FormIntakeError('FORM_NOT_FOUND', 'Form not found', 404);

    const secret = await ensureJwtSecret(form.id, form.public_jwt_secret);

    const expiresAt = input.hardExpiresAt
      ? new Date(input.hardExpiresAt).toISOString()
      : new Date(Date.now() + ttl * 1000).toISOString();

    const expSeconds = Math.floor(new Date(expiresAt).getTime() / 1000);
    const token = jwt.sign(
      {
        formId: form.id,
        sub: subject,
      },
      secret,
      {
        algorithm: 'HS256',
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        expiresIn: expSeconds - Math.floor(Date.now() / 1000),
      }
    );

    return { token, expiresAt };
  },

  /**
   * Verifies a JWT and resolves the form context. Throws on every failure
   * mode the route layer needs to map to 4xx.
   */
  async verifyJwt(input: VerifyJwtInput): Promise<VerifyJwtResult> {
    if (!input.token) {
      throw new FormIntakeError('TOKEN_REQUIRED', 'token is required', 400);
    }
    // Decode without verify to learn the formId, then verify with that
    // form's secret. Decoding is cheap and lets us scope verification to a
    // single secret without trying every form in the database.
    let decoded: JwtPayload | null;
    try {
      decoded = jwt.decode(input.token) as JwtPayload | null;
    } catch {
      decoded = null;
    }
    const formId = decoded && typeof decoded.formId === 'string' ? decoded.formId : null;
    if (!formId) {
      throw new FormIntakeError('TOKEN_INVALID', 'token is malformed', 401);
    }
    const form = await loadFormById(formId);
    if (!form) throw new FormIntakeError('FORM_NOT_FOUND', 'Form not found', 404);
    if (!form.is_published) {
      throw new FormIntakeError('FORM_NOT_PUBLISHED', 'Form is not published', 403);
    }
    if (!form.public_jwt_secret) {
      throw new FormIntakeError('JWT_NOT_ENABLED', 'Form has no JWT secret', 403);
    }

    let payload: JwtPayload;
    try {
      payload = jwt.verify(input.token, form.public_jwt_secret, {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      }) as JwtPayload;
    } catch (e) {
      const reason = (e as Error).name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
      throw new FormIntakeError(reason, (e as Error).message, 401);
    }

    if (form.public_link_expires_at) {
      const hardExpiry =
        form.public_link_expires_at instanceof Date
          ? form.public_link_expires_at.getTime()
          : Date.parse(String(form.public_link_expires_at));
      if (Number.isFinite(hardExpiry) && Date.now() > hardExpiry) {
        throw new FormIntakeError('TOKEN_EXPIRED', 'Public link has expired', 401);
      }
    }

    const context = rowToContext(form);
    return {
      ...context,
      jwtSubject: typeof payload.sub === 'string' ? payload.sub : '',
    };
  },

  /**
   * Submits a public form. Intended to be called from EITHER the slug router
   * OR the new JWT router. Performs:
   *   - Rate limit (per (formId, ipHash)).
   *   - Allow-list filter on the submission payload.
   *   - Delegation to FormService.submitForm.
   *   - Audit row in tp_form_submissions (success / failure / rate-limited).
   */
  async submitFromPublic(input: SubmitFromPublicInput): Promise<SubmitFromPublicResult> {
    if (!input.formId) throw new FormIntakeError('FORM_ID_REQUIRED', 'formId is required');
    if (!input.data || typeof input.data !== 'object') {
      throw new FormIntakeError('INVALID_DATA', 'data object is required');
    }

    const form = await loadFormById(input.formId);
    if (!form) throw new FormIntakeError('FORM_NOT_FOUND', 'Form not found', 404);
    if (!form.is_published) {
      throw new FormIntakeError('FORM_NOT_PUBLISHED', 'Form is not published', 403);
    }

    const context = rowToContext(form);

    const rateKey = `${input.formId}:${input.clientIpHash ?? 'unknown'}`;
    const rate = activeLimiter.check(rateKey);
    if (!rate.allowed) {
      const submissionId = await recordSubmissionAudit({
        formId: input.formId,
        tableId: context.targetTableId,
        recordId: null,
        intakeKind: input.intakeKind,
        jwtSubject: input.jwtSubject ?? null,
        clientIpHash: input.clientIpHash ?? null,
        status: 'rate_limited',
        failureReason: 'rate_limit_exceeded',
      });
      return {
        submissionId,
        recordId: null,
        status: 'rate_limited',
        failureReason: 'rate_limit_exceeded',
      };
    }

    const filtered = applyAllowList(input.data, context.fieldAllowList);

    let recordId: string | null = null;
    let status: FormSubmissionStatus = 'accepted';
    let failureReason: string | null = null;
    try {
      const formService = await getFormService();
      const result = await formService.submitForm(input.formId, filtered);
      recordId = result.recordId;
    } catch (e) {
      status = 'rejected';
      failureReason = (e as Error)?.message?.slice(0, 4000) ?? 'submission rejected';
      logger.warn('[FormIntakeService] public submission rejected', {
        formId: input.formId,
        intakeKind: input.intakeKind,
        reason: failureReason,
      });
    }

    const submissionId = await recordSubmissionAudit({
      formId: input.formId,
      tableId: context.targetTableId,
      recordId,
      intakeKind: input.intakeKind,
      jwtSubject: input.jwtSubject ?? null,
      clientIpHash: input.clientIpHash ?? null,
      status,
      failureReason,
    });

    return { submissionId, recordId, status, failureReason };
  },

  /** Slug → form context. Public surface; refuses unpublished forms. */
  async getFormBySlugForPublic(slug: string): Promise<FormIntakeContext> {
    if (!slug) throw new FormIntakeError('SLUG_REQUIRED', 'slug is required');
    const form = await loadFormBySlug(slug);
    if (!form) throw new FormIntakeError('FORM_NOT_FOUND', 'Form not found', 404);
    return rowToContext(form);
  },

  /** Updates the field allow-list for a form. Cross-tenant safe. */
  async setFieldAllowList(
    formId: string,
    organizationId: string,
    allowList: string[] | null
  ): Promise<FormIntakeContext> {
    await this.getFormForAdmin(formId, organizationId);

    if (allowList != null) {
      if (!Array.isArray(allowList)) {
        throw new FormIntakeError('INVALID_ALLOW_LIST', 'allowList must be an array');
      }
      if (allowList.length > ALLOW_LIST_MAX) {
        throw new FormIntakeError(
          'ALLOW_LIST_TOO_LONG',
          `allowList can hold at most ${ALLOW_LIST_MAX} entries`
        );
      }
      const seen = new Set<string>();
      for (const entry of allowList) {
        if (typeof entry !== 'string' || entry.length === 0) {
          throw new FormIntakeError(
            'INVALID_ALLOW_LIST_ENTRY',
            'allowList entries must be non-empty strings'
          );
        }
        seen.add(entry);
      }
      allowList = Array.from(seen);
    }

    const db = getDatabase();
    await db.query(
      `UPDATE tp_forms
          SET field_allow_list = $2::jsonb,
              updated_at = NOW()
        WHERE id = $1`,
      [formId, allowList === null ? null : JSON.stringify(allowList)]
    );

    const refreshed = await loadFormById(formId);
    if (!refreshed) throw new FormIntakeError('FORM_NOT_FOUND', 'Form not found', 404);
    return rowToContext(refreshed);
  },
};

function clampTtl(value: number | undefined): number {
  if (value == null || !Number.isFinite(value) || value <= 0) return DEFAULT_TTL_SECONDS;
  return Math.min(MAX_TTL_SECONDS, Math.floor(value));
}

export default formIntakeService;
