// @ts-nocheck
/**
 * Auth Routes
 * Authentication and authorization endpoints
 */

import bcrypt from 'bcryptjs';
import { Response, Router } from 'express';

import {
  authRuntimeConfig,
  buildPasswordResetLink,
  getPasswordResetExpiresAt,
} from '../config/authRuntime.js';
import { login } from '../controllers/AuthController.js';
import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import {
  demoSignupIdentityRateLimiter,
  demoSignupIpRateLimiter,
} from '../middleware/rateLimiting.middleware.js';
import { validateBody, validateParams } from '../middleware/validation.middleware.js';
import {
  assertDemoPrincipalMayReceiveCredentials,
  DEMO_SESSION_EXPIRED_CODE,
} from '../services/demo/demoPrincipalGuard.js';
import {
  DEMO_SIGNUP_ROLE,
  provisionPublicDemoAccount,
} from '../services/demo/demoSignupProvisioning.js';
import auditEventsService from '../services/AuditEventsService.js';
import legalService from '../services/legalService.js';
import mfaService from '../services/MFAService.js';
import {
  assertOrganizationNameAvailable,
  DuplicateOrganizationNameError,
  isGenericOrganizationName,
} from '../services/organizationIdentityService.js';
import refreshTokenService from '../services/RefreshTokenService.js';
import slackService from '../services/slackService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  buildCaseInsensitiveUserEmailLookupQuery,
  normalizeAuthEmail,
} from '../utils/authEmail.js';
import {
  ACCESS_TOKEN_COOKIE,
  clearAuthCookies,
  REFRESH_TOKEN_COOKIE,
  setAccessTokenCookie,
  setAuthCookies,
} from '../utils/cookieAuth.js';
import { all as _dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import { getTableColumns } from '../utils/dbSchema.js';
import logger from '../utils/Logger.js';
import { isForcedSuperAdminEmail, resolveAuthEffectiveRole } from '../utils/platformRoles.js';
import { SEED_EMAIL_DOMAINS } from '../utils/superadminSeedFilter.js';
import {
  ChangePasswordRequestSchema,
  ForgotPasswordRequestSchema,
  LoginRequestSchema,
  MFADisableRequestSchema,
  MFAEnableRequestSchema,
  MFASetupRequestSchema,
  RefreshTokenRequestSchema,
  RegisterDemoRequestSchema,
  RegisterRequestSchema,
  ResetPasswordRequestSchema,
  RevokeAllTokensRequestSchema,
  SessionIdParamSchema,
  VerifyEmailRequestSchema,
} from '../validators/auth.validators.js';

const router = Router();
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

import config from '../config/Config.js';
import { ORG_TYPES, TRIAL_DURATION_DAYS } from '../services/access/AccessTypes.js';
import ActivityService from '../services/ActivityService.js';
import {
  DEMO_TRIAL_EVENT_TYPES,
  recordDemoTrialEvent,
} from '../services/demoTrialTelemetryService.js';
import { AppError } from '../utils/ErrorHandler.js';

const FORCED_SUPERADMIN_EMAILS = (() => {
  const raw = String(process.env.FORCE_SUPERADMIN_EMAILS || '');
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
})();

const passwordResetSuccessMessage = 'If the email exists, a reset link has been sent.';

// The public demo signup role lives with the provisioning saga that writes it
// (server/src/services/demo/demoSignupProvisioning.ts → DEMO_SIGNUP_ROLE), so the
// value and the three constraints it has to satisfy stay in one place.
const APLIX_ACCESS_CODE = 'APLIX-2026';
const APLIX_DEFAULT_TEMPLATE_SUFFIXES = [
  'aplix_global_all_v1',
  'aplix_plant_charlotte_v1',
] as const;
const APLIX_DEFAULT_TEMPLATE_NAMES = [
  'APLIX Global - All Respondents',
  'APLIX Plant - Charlotte Leadership',
] as const;

const buildPasswordResetEmailHtml = (resetLink: string): string => `
  <h2>Password Reset Request</h2>
  <p>Click the link below to reset your password. This link expires in ${authRuntimeConfig.passwordResetTtlMinutes} minutes.</p>
  <p><a href="${resetLink}">${resetLink}</a></p>
  <p>If you did not request this, you can safely ignore this email.</p>
`;

async function assignAplixDefaultInterviews(params: {
  organizationId: string;
  userId: string;
  createdBy: string;
  accessCode?: string | null;
}) {
  const normalizedAccessCode = String(params.accessCode || '')
    .trim()
    .toUpperCase();
  if (normalizedAccessCode !== APLIX_ACCESS_CODE) return;

  const { default: interviewAssignmentService } =
    (await import('../services/InterviewAssignmentService.js')) as any;
  const dueAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  for (const templateSuffix of APLIX_DEFAULT_TEMPLATE_SUFFIXES) {
    const templateId = `${params.organizationId}__${templateSuffix}`;
    const existingAssignment = await dbGet<{ id: string }>(
      `SELECT id
         FROM interview_assignments
        WHERE organization_id = ?
          AND assignee_user_id = ?
          AND template_id = ?
        LIMIT 1`,
      [params.organizationId, params.userId, templateId]
    );

    if (existingAssignment?.id) continue;

    await interviewAssignmentService.create({
      organizationId: params.organizationId,
      templateId,
      assigneeUserIds: [params.userId],
      dueAt,
      priority: 'medium',
      notes: 'Auto-assigned during APLIX access-code onboarding.',
      createdBy: params.createdBy,
      escalateTo: params.createdBy,
    });
  }
}

async function notifyAplixRegistrationInSlack(params: {
  accessCode?: string | null;
  firstName: string;
  lastName?: string;
  email: string;
}) {
  const normalizedAccessCode = String(params.accessCode || '')
    .trim()
    .toUpperCase();
  if (normalizedAccessCode !== APLIX_ACCESS_CODE) return;

  await slackService.sendRegistrationAlert({
    firstName: params.firstName,
    lastName: params.lastName,
    email: params.email,
    organizationName: 'APLIX Inc. - North America',
    role: 'Manager',
    accessCode: APLIX_ACCESS_CODE,
    assignedInterviewNames: [...APLIX_DEFAULT_TEMPLATE_NAMES],
  });
}

// Helper to add timeout to promises
const _withTimeout = <T>(promise: Promise<T>, timeoutMs = 1000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timeout')), timeoutMs)
    ),
  ]);
};

const normalizeMembershipStatus = (status: unknown): string => {
  if (typeof status !== 'string') return '';
  return status.trim().toUpperCase();
};

const normalizeOrganizationStatus = (status: unknown): string => {
  if (typeof status !== 'string') return '';
  return status.trim().toLowerCase();
};

// LOGIN
logger.info('[AuthRoutes] login handler is type:', typeof login);
router.post('/login', validateBody(LoginRequestSchema), asyncHandler(login));

// REFRESH TOKEN - Get new access token using refresh token
router.post(
  '/refresh',
  validateBody(RefreshTokenRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const bodyRefreshToken = req.body?.refreshToken;
    const cookieRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    const refreshToken =
      (typeof bodyRefreshToken === 'string' && bodyRefreshToken.trim().length > 0
        ? bodyRefreshToken.trim()
        : null) ||
      (typeof cookieRefreshToken === 'string' && cookieRefreshToken.trim().length > 0
        ? cookieRefreshToken.trim()
        : null);

    try {
      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required' });
      }

      const result = await refreshTokenService.refreshAccessToken(refreshToken, {
        ip: req.ip,
        userAgent: req.get('user-agent') || null,
      });

      if (!result) {
        return res.status(401).json({ error: 'Invalid or expired refresh token' });
        return;
      }

      // Set cookie-based auth for stability across reloads/restarts.
      try {
        setAuthCookies(res, result.accessToken, result.refreshToken);
      } catch {
        // ignore
      }

      return res.json({
        token: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
      });
    } catch (error: unknown) {
      logger.error('[Auth] Refresh error:', {
        error,
        correlationId: (req as any).correlationId,
      });
      return res
        .status(500)
        .json({ error: 'Token refresh failed', code: 'AUTH_TOKEN_REFRESH_FAILED' });
    }
  })
);

// GET ACTIVE SESSIONS
router.get(
  '/sessions',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const sessions = await refreshTokenService.getActiveSessions(req.user!.id);
      return res.json({ sessions });
    } catch (error: unknown) {
      logger.error('[Auth] Get sessions error:', {
        error,
        correlationId: (req as any).correlationId,
      });
      return res
        .status(500)
        .json({ error: 'Failed to get sessions', code: 'AUTH_GET_SESSIONS_FAILED' });
    }
  })
);

// REVOKE SESSION
router.delete(
  '/sessions/:id',
  verifyToken,
  validateParams(SessionIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
      await refreshTokenService.revokeSession(req.user!.id, id);
      return res.json({ success: true, message: 'Session revoked' });
    } catch (error: unknown) {
      logger.error('[Auth] Revoke session error:', error);
      return res.status(500).json({ error: 'Failed to revoke session' });
    }
  })
);

// GET ME - Validate token and return user data
router.get(
  '/me',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      // ------------------------------------------------------------
      // E2E_MODE: deterministic "who am I" without DB dependency
      // ------------------------------------------------------------
      // Playwright runtime smoke tests use an unsigned JWT-like token
      // accepted by auth middleware only when E2E_MODE=true. In that mode
      // we return a valid user payload directly from the decoded token.
      if (process.env.E2E_MODE === 'true' && req.user && (req.user as any).id) {
        const e2eRole = String(req.userRole || (req.user as any).role || 'ADMIN').toUpperCase();
        return res.json({
          user: {
            id: req.user.id,
            email: req.user.email || 'e2e@local.test',
            // Preserve raw persona role in E2E mode (e.g. SUPERADMIN),
            // instead of mapped UI role labels like OWNER.
            role: e2eRole,
            organizationId: req.organizationId || (req.user as any).organizationId || 'e2e-org-id',
            organizationName: 'E2E Organization',
            firstName: (req.user as any).name?.split?.(' ')?.[0] || 'E2E',
            lastName: (req.user as any).name?.split?.(' ')?.slice?.(1)?.join?.(' ') || 'User',
            avatarUrl: null,
            impersonatorId: null,
            companyName: 'E2E Organization',
            isAuthenticated: true,
            accessLevel: 'full',
          },
        });
      }

      // Try query with impersonator_id first, fallback if column doesn't exist
      let user: {
        id: string;
        email: string;
        role: string;
        organization_id: string;
        first_name: string;
        last_name: string;
        avatar_url: string | null;
        impersonator_id: string | null;
        organization_name: string | null;
        organization_plan: string | null;
        organization_status: string | null;
        // Extended profile fields
        display_name: string | null;
        pronouns: string | null;
        department: string | null;
        job_title: string | null;
        status_message: string | null;
        out_of_office: number | null;
        vacation_end: string | null;
        linkedin_id: string | null;
        phone: string | null;
        timezone: string | null;
        location: string | null;
        company_name: string | null;
        date_format: string | null;
        time_format: string | null;
        out_of_office_message: string | null;
        language: string | null;
        // VTS metrics
        seniority_level: string | null;
        site_location: string | null;
        tenure_years: string | null;
        manages_team: number | null;
        team_size: string | null;
        expertise_tags: string | null;
        engagement_level: string | null;
        // Survey tracking
        profile_survey_completed_at: string | null;
        profile_survey_dismissed_count: number | null;
        profile_survey_last_dismissed_at: string | null;
        profile_department: string | null;
        profile_job_title: string | null;
        profile_extended_department: string | null;
        profile_extended_job_title: string | null;
        profile_extended_title: string | null;
      } | null = null;

      // Build a schema-aware select to avoid noisy "column does not exist" errors
      // on legacy databases (e.g., staging snapshots used for local dev).
      const userCols = await getTableColumns('users');
      const userProfileCols = await getTableColumns('user_profiles');
      const userProfileExtendedCols = await getTableColumns('user_profile_extended');
      const hasUserProfiles = userProfileCols.size > 0 && userProfileCols.has('user_id');
      const hasUserProfileExtended =
        userProfileExtendedCols.size > 0 && userProfileExtendedCols.has('user_id');
      let profileFallbackPreferences: Record<string, unknown> = {};
      try {
        const fallbackPreference = await dbGet<{ value?: string }>(
          `SELECT value FROM user_preferences WHERE user_id = ? AND key = ? LIMIT 1`,
          [req.user!.id, 'settings:profile-fallback']
        );
        if (fallbackPreference?.value) {
          profileFallbackPreferences = JSON.parse(fallbackPreference.value);
        }
      } catch {
        profileFallbackPreferences = {};
      }
      const ucol = (col: string, fallbackSql: string) =>
        userCols.has(col) ? `u.${col}` : `${fallbackSql} as ${col}`;

      const ME_SELECT_COLS = [
        'u.id',
        'u.email',
        'u.role',
        'u.organization_id',
        'u.first_name',
        'u.last_name',
        ucol('avatar_url', 'NULL'),
        ucol('impersonator_id', 'NULL'),
        ucol('display_name', 'NULL'),
        ucol('pronouns', 'NULL'),
        ucol('department', 'NULL'),
        ucol('job_title', 'NULL'),
        ucol('status_message', 'NULL'),
        ucol('out_of_office', 'NULL'),
        ucol('vacation_end', 'NULL'),
        ucol('linkedin_id', 'NULL'),
        ucol('phone', 'NULL'),
        ucol('timezone', 'NULL'),
        ucol('location', 'NULL'),
        ucol('company_name', 'NULL'),
        ucol('date_format', 'NULL'),
        ucol('time_format', 'NULL'),
        ucol('out_of_office_message', 'NULL'),
        ucol('language', 'NULL'),
        ucol('seniority_level', 'NULL'),
        ucol('site_location', 'NULL'),
        ucol('tenure_years', 'NULL'),
        ucol('manages_team', 'NULL'),
        ucol('team_size', 'NULL'),
        ucol('expertise_tags', 'NULL'),
        ucol('engagement_level', 'NULL'),
        ucol('profile_survey_completed_at', 'NULL'),
        ucol('profile_survey_dismissed_count', '0'),
        ucol('profile_survey_last_dismissed_at', 'NULL'),
        hasUserProfiles && userProfileCols.has('department')
          ? 'up.department as profile_department'
          : 'NULL as profile_department',
        hasUserProfiles && userProfileCols.has('job_title')
          ? 'up.job_title as profile_job_title'
          : 'NULL as profile_job_title',
        hasUserProfileExtended && userProfileExtendedCols.has('department')
          ? 'upe.department as profile_extended_department'
          : 'NULL as profile_extended_department',
        hasUserProfileExtended && userProfileExtendedCols.has('job_title')
          ? 'upe.job_title as profile_extended_job_title'
          : 'NULL as profile_extended_job_title',
        hasUserProfileExtended && userProfileExtendedCols.has('title')
          ? 'upe.title as profile_extended_title'
          : 'NULL as profile_extended_title',
        'o.name as organization_name',
        'o.plan as organization_plan',
        'o.status as organization_status',
      ].join(', ');

      try {
        user = await dbGet(
          `SELECT ${ME_SELECT_COLS}
                   FROM users u
                   ${hasUserProfiles ? 'LEFT JOIN user_profiles up ON up.user_id = u.id' : ''}
                   ${hasUserProfileExtended ? 'LEFT JOIN user_profile_extended upe ON upe.user_id = u.id' : ''}
                   LEFT JOIN organizations o ON u.organization_id = o.id
                   WHERE u.id = ?`,
          [req.user!.id]
        );
      } catch (err: any) {
        // If new columns don't exist yet, retry with basic columns
        if (err.message?.includes('does not exist') || err.message?.includes('no such column')) {
          try {
            user = await dbGet(
              `SELECT u.id, u.email, u.role, u.organization_id, u.first_name, u.last_name, u.avatar_url, u.impersonator_id,
                              o.name as organization_name, o.plan as organization_plan, o.status as organization_status
                       FROM users u
                       LEFT JOIN organizations o ON u.organization_id = o.id
                       WHERE u.id = ?`,
              [req.user!.id]
            );
          } catch {
            user = await dbGet(
              `SELECT u.id, u.email, u.role, u.organization_id, u.first_name, u.last_name, u.avatar_url, NULL as impersonator_id,
                              o.name as organization_name, o.plan as organization_plan, o.status as organization_status
                       FROM users u
                       LEFT JOIN organizations o ON u.organization_id = o.id
                       WHERE u.id = ?`,
              [req.user!.id]
            );
          }
        } else {
          throw err;
        }
      }

      let remappedUserId = false;
      if (!user && req.user?.email) {
        const normalizedEmail = String(req.user.email).trim().toLowerCase();
        if (normalizedEmail) {
          try {
            user = await dbGet<{
              id: string;
              email: string;
              role: string;
              organization_id: string;
              first_name: string;
              last_name: string;
              avatar_url: string | null;
              impersonator_id: string | null;
              organization_name: string | null;
              organization_plan: string | null;
              organization_status: string | null;
            }>(
              `SELECT u.id, u.email, u.role, u.organization_id, u.first_name, u.last_name, u.avatar_url, NULL as impersonator_id,
                              o.name as organization_name, o.plan as organization_plan, o.status as organization_status
                       FROM users u
                       LEFT JOIN organizations o ON u.organization_id = o.id
                       WHERE lower(u.email) = lower(?)`,
              [normalizedEmail]
            );
            remappedUserId = Boolean(user && user.id !== req.user!.id);
          } catch {
            // ignore fallback lookup failures and return the original 404 below
          }
        }
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // -------------------------------------------------------------------
      // OPS-DEMO-002 — a lapsed public demo principal gets nothing from /me.
      //
      // This endpoint mints an access token further down (role change / user
      // remap), and `generateTokenPair` — which it used to call — carries NO
      // demo TTL gate of its own: the gate added earlier lives in
      // `refreshAccessToken` and in `AuthController.login`. So `/me` was a third
      // door that handed a lapsed public demo principal a brand-new refresh
      // family (7 days on staging, 30 in production), on a GET.
      //
      // The check runs on `user.id` — the row this request actually resolved,
      // which after the email fallback below is NOT necessarily the id in the
      // token. That distinction is the whole point: `attachUser` gates on the
      // TOKEN's id, so a token whose id no longer resolves sails past the
      // middleware and lands here, where the remap re-attaches it to the demo
      // account by email. Gating on `req.user.id` would repeat that miss.
      //
      // Deliberately NOT conditional on whether a token is about to be minted:
      // answering `isAuthenticated: true` for an account whose demo is over is
      // dishonest whether or not credentials ride along, and 403 is what the
      // rest of the system already says (`attachUser`, `login`). The shared
      // helper also performs the lazy retirement — status flip plus family
      // revocation — that nothing else will run for this principal.
      // For every non-demo caller this is a cached marker lookup and a pass.
      // -------------------------------------------------------------------
      const demoCredentialCheck = await assertDemoPrincipalMayReceiveCredentials(user.id);
      if (!demoCredentialCheck.allowed) {
        return res.status(403).json({
          error: 'This demo session has ended. Start a new demo to continue.',
          code: DEMO_SESSION_EXPIRED_CODE,
        });
      }

      // Permanent role fix for selected internal accounts.
      // Ensure DB is updated so future tokens stay consistent.
      const isForcedPlatformSuperAdmin =
        isForcedSuperAdminEmail(user.email) ||
        FORCED_SUPERADMIN_EMAILS.has(
          String(user.email || '')
            .trim()
            .toLowerCase()
        );

      if (isForcedPlatformSuperAdmin) {
        if (user.role !== 'SUPERADMIN') {
          try {
            await dbRun(`UPDATE users SET role = ? WHERE id = ?`, ['SUPERADMIN', user.id]);
          } catch {
            // ignore DB write errors, we still override response below
          }
          user.role = 'SUPERADMIN';
        }
      }

      // Resolve effective role: prefer organization_members.role for the
      // user's current org so that switch-organization is not silently undone.
      let membershipRole: string | null = null;
      // Tracks whether the ACTIVE-membership lookup actually ran (vs. threw,
      // e.g. missing table/column on a legacy schema). Kept separate from
      // `membershipRole` so a DB/schema error still fails OPEN (matches
      // `validateOrgMembership`'s own fail-open-on-DB-error contract) instead
      // of being misread as "membership confirmed revoked".
      let membershipLookupSucceeded = false;
      if (user.organization_id) {
        try {
          const orgMembership = await dbGet<{ role: string }>(
            `SELECT role FROM organization_members
             WHERE user_id = ? AND organization_id = ?
               AND UPPER(COALESCE(status, '')) = 'ACTIVE'`,
            [user.id, user.organization_id]
          );
          membershipLookupSucceeded = true;
          if (orgMembership?.role) {
            membershipRole = orgMembership.role;
          }
        } catch {
          // If table/column missing, fall back to users.role
        }
      }

      const effectiveRole = resolveAuthEffectiveRole({
        email: user.email,
        userRole: user.role,
        membershipRole,
      });

      // AUD-G4 — /me must not hand back *organization* data (name/plan/status,
      // surfaced here as organizationName + accessLevel) for an org the caller
      // no longer has an ACTIVE membership row in. `user.organization_id` /
      // `organization_name` etc. come from `users.organization_id` via a plain
      // LEFT JOIN, which is NOT updated when `organization_members.status`
      // flips away from ACTIVE — so without this gate a JWT minted before
      // revocation keeps reading its old org's name/plan through this
      // identity endpoint even though every org-scoped resource endpoint
      // (validateOrgMembership) would now 403 it. Fails OPEN (keeps prior
      // behavior) when the membership lookup itself didn't run/succeed, when
      // there is no org on the account at all (nothing to leak), and for
      // SUPERADMIN (mirrors validateOrgMembership's own bypass) — only a
      // lookup that ran, found the account has an org, and came back
      // definitively non-ACTIVE flips this to false.
      const hasActiveOrgMembership =
        effectiveRole === 'SUPERADMIN' ||
        !user.organization_id ||
        !membershipLookupSucceeded ||
        Boolean(membershipRole);

      // ---------------------------------------------------------------------
      // Effective role changed vs the JWT, or the user was re-mapped by email:
      // hand back an ACCESS token carrying the corrected claims.
      //
      // ACCESS TOKEN ONLY — no refresh family. This used to call
      // `generateTokenPair`, which inserts a fresh `refresh_tokens` row and
      // therefore opens a second full-length family (30 days by default, 7 on
      // staging) every time a GET /me disagreed with the token's role claim.
      // A re-map is not a re-authentication: it is a lookup correction, and it
      // must not extend the caller's ability to stay signed in beyond the
      // family they logged in with. The client keeps
      // its existing refresh token (`tokenService.saveTokens` preserves the
      // stored one when the response omits `refreshToken`), so nothing about
      // the session's lifetime changes — only its claims.
      //
      // Claims mirror `RefreshTokenService.generateTokenPair` exactly, including
      // `isDemo`. That flag is read from the organization row rather than from
      // `req.user.isDemo`, because `attachUser` ORs the client's `X-Demo-Mode`
      // header into that field — minting from it would let a header bake itself
      // into a signed token.
      // ---------------------------------------------------------------------
      let newToken: string | null = null;
      // Never set. Kept as a named constant so the response shape below stays
      // explicit about what /me does and does not issue.
      const newRefreshToken: string | null = null;
      if (effectiveRole !== req.user!.role || remappedUserId) {
        let isDemoOrganization = false;
        try {
          const orgTypeRow = await dbGet<{ organization_type?: string }>(
            'SELECT organization_type FROM organizations WHERE id = ? LIMIT 1',
            [user.organization_id]
          );
          isDemoOrganization =
            String(orgTypeRow?.organization_type || '')
              .trim()
              .toUpperCase() === 'DEMO';
        } catch {
          isDemoOrganization = false;
        }

        newToken = jwt.sign(
          {
            id: user.id,
            email: user.email,
            role: effectiveRole,
            organizationId: user.organization_id,
            isSuperAdmin: effectiveRole === 'SUPERADMIN',
            isDemo: isDemoOrganization,
            jti: uuidv4(),
          },
          config.JWT_SECRET,
          { expiresIn: authRuntimeConfig.accessTokenExpiry }
        );
      }

      if (newToken) {
        try {
          const existingRefreshToken = newRefreshToken || req.cookies?.[REFRESH_TOKEN_COOKIE];
          // Only rewrite the refresh cookie when there is a real value to write:
          // now that /me never mints one, `setAuthCookies` would otherwise be
          // handed `undefined` and Express would serialize it as the literal
          // string "undefined".
          if (existingRefreshToken) {
            setAuthCookies(res, newToken, existingRefreshToken);
          } else {
            setAccessTokenCookie(res, newToken);
          }
        } catch {
          // ignore cookie write failures
        }
      }

      let parsedExpertiseTags: string[] = [];
      try {
        if (user.expertise_tags) parsedExpertiseTags = JSON.parse(user.expertise_tags);
      } catch {
        /* ignore bad JSON */
      }

      const response: {
        user: Record<string, unknown>;
        token?: string;
        refreshToken?: string;
        roleChanged?: boolean;
        userRemapped?: boolean;
      } = {
        user: {
          id: user.id,
          email: user.email,
          role: effectiveRole,
          organizationId: user.organization_id,
          // Gated on hasActiveOrgMembership — see comment above its
          // definition. organizationId is left ungated: it is already a
          // claim inside the caller's own (signed, not encrypted) JWT, so
          // echoing it back discloses nothing the caller doesn't already
          // hold. organizationName/accessLevel below are the actual
          // `organizations` table data and must not survive revocation.
          organizationName: hasActiveOrgMembership ? user.organization_name : null,
          firstName: user.first_name,
          lastName: user.last_name,
          avatarUrl: user.avatar_url,
          impersonatorId: user.impersonator_id,
          isAuthenticated: true,
          accessLevel:
            hasActiveOrgMembership &&
            user.organization_status === 'active' &&
            (user.organization_plan === 'enterprise' || user.organization_plan === 'pro')
              ? 'full'
              : 'free',
          // Extended profile fields
          displayName:
            user.display_name ||
            (profileFallbackPreferences.displayName as string | undefined) ||
            null,
          pronouns:
            user.pronouns || (profileFallbackPreferences.pronouns as string | undefined) || null,
          department:
            user.department || user.profile_department || user.profile_extended_department || null,
          jobTitle:
            user.job_title ||
            user.profile_job_title ||
            user.profile_extended_job_title ||
            user.profile_extended_title ||
            null,
          statusMessage:
            user.status_message ||
            (profileFallbackPreferences.statusMessage as string | undefined) ||
            null,
          isOutOfOffice:
            user.out_of_office === 1 || Boolean(profileFallbackPreferences.isOutOfOffice || false),
          outOfOfficeUntil:
            user.vacation_end ||
            (profileFallbackPreferences.outOfOfficeUntil as string | undefined) ||
            null,
          outOfOfficeMessage:
            user.out_of_office_message ||
            (profileFallbackPreferences.outOfOfficeMessage as string | undefined) ||
            null,
          linkedinId:
            user.linkedin_id ||
            (profileFallbackPreferences.linkedinId as string | undefined) ||
            null,
          phone: user.phone || null,
          timezone:
            user.timezone || (profileFallbackPreferences.timezone as string | undefined) || null,
          dateFormat:
            user.date_format ||
            (profileFallbackPreferences.dateFormat as string | undefined) ||
            null,
          timeFormat:
            user.time_format ||
            (profileFallbackPreferences.timeFormat as string | undefined) ||
            null,
          // P0.3 (2026-07-26): interface language preference — SSOT priority
          // is account > localStorage > navigator. See
          // src/services/languagePreference.ts (syncLanguageFromAccount).
          language:
            user.language || (profileFallbackPreferences.language as string | undefined) || null,
          location: user.location || null,
          companyName:
            user.company_name ||
            (profileFallbackPreferences.companyName as string | undefined) ||
            (hasActiveOrgMembership ? user.organization_name : null),
          // VTS metrics
          seniorityLevel: user.seniority_level || null,
          siteLocation: user.site_location || null,
          tenureYears: user.tenure_years || null,
          managesTeam: user.manages_team === 1,
          teamSize: user.team_size || null,
          expertiseTags: parsedExpertiseTags,
          engagementLevel: user.engagement_level || null,
          // Survey tracking
          profileSurveyCompletedAt: user.profile_survey_completed_at || null,
          profileSurveyDismissedCount: user.profile_survey_dismissed_count || 0,
          profileSurveyLastDismissedAt: user.profile_survey_last_dismissed_at || null,
        },
      };

      // Include new token if role changed
      if (newToken) {
        response.token = newToken;
        if (newRefreshToken) {
          response.refreshToken = newRefreshToken;
        }
        response.roleChanged = effectiveRole !== req.user!.role;
      }
      if (remappedUserId) {
        response.userRemapped = true;
      }

      return res.json(response);
    } catch (err: any) {
      logger.error('[Auth] /me DB error:', err);
      // Fallback to token data if DB fails
      return res.json({
        user: {
          id: req.user!.id,
          email: req.user!.email || '',
          role: req.user!.role,
          organizationId: req.user!.organizationId || '',
          impersonatorId: req.user!.impersonatorId || null,
          companyName: 'Loading...',
          isAuthenticated: true,
          accessLevel: 'free', // Default fallback
        },
      });
    }
  })
);

// SWITCH ORGANIZATION — Exchange current token for one scoped to a different org
router.post(
  '/switch-organization',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const { organizationId } = req.body;

    if (!organizationId || typeof organizationId !== 'string') {
      return res.status(400).json({
        error: 'organizationId is required',
        code: 'MISSING_ORGANIZATION_ID',
      });
    }

    if (organizationId === req.organizationId) {
      return res.status(200).json({
        success: true,
        message: 'Already in this organization',
        organization: { id: organizationId },
      });
    }

    try {
      const membership = await dbGet<{
        role: string;
        status: string;
        org_name: string;
        org_status: string;
        org_plan: string;
        organization_type: string | null;
      }>(
        `SELECT m.role, m.status, o.name AS org_name, o.status AS org_status, o.plan AS org_plan,
                o.organization_type
         FROM organization_members m
         JOIN organizations o ON o.id = m.organization_id
         WHERE m.user_id = ? AND m.organization_id = ?`,
        [userId, organizationId]
      );

      if (!membership || normalizeMembershipStatus(membership.status) !== 'ACTIVE') {
        return res.status(403).json({
          error: 'You do not have access to this organization',
          code: 'ORG_ACCESS_DENIED',
        });
      }

      if (normalizeOrganizationStatus(membership.org_status) !== 'active') {
        return res.status(403).json({
          error: 'This organization is not active',
          code: 'ORG_NOT_ACTIVE',
          orgStatus: membership.org_status,
        });
      }

      const orgType = String(membership.organization_type || '')
        .trim()
        .toUpperCase();
      const isDemo = orgType === ORG_TYPES.DEMO;

      // Update users.organization_id so token refresh stays consistent
      await dbRun('UPDATE users SET organization_id = ? WHERE id = ?', [organizationId, userId]);

      const deviceInfo = (req.get('user-agent') || 'Unknown Device').substring(0, 200);
      const effectiveRole = resolveAuthEffectiveRole({
        email: req.user!.email || '',
        userRole: req.user!.role,
        membershipRole: membership.role,
      });

      const tokenPair = await refreshTokenService.generateTokenPair(
        {
          id: userId,
          email: req.user!.email || '',
          role: effectiveRole,
          organization_id: organizationId,
          isDemo,
        },
        { deviceInfo, ip: req.ip, userAgent: req.get('user-agent') }
      );

      try {
        setAuthCookies(res, tokenPair.accessToken, tokenPair.refreshToken);
      } catch {
        // Non-fatal
      }

      // Fire-and-forget: log the org switch
      const previousOrgId = req.organizationId;
      void Promise.resolve().then(async () => {
        ActivityService.log({
          organizationId,
          userId,
          action: 'organization_switch',
          entityType: 'organization',
          entityId: organizationId,
          entityName: membership.org_name,
        });
        try {
          await dbRun(
            `INSERT INTO organization_switch_log (id, user_id, from_organization_id, to_organization_id, ip_address, user_agent)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              uuidv4(),
              userId,
              previousOrgId || null,
              organizationId,
              req.ip || null,
              req.get('user-agent') || null,
            ]
          );
        } catch {
          // Non-critical audit logging
        }
      });

      return res.json({
        success: true,
        organization: {
          id: organizationId,
          name: membership.org_name,
          role: membership.role,
          plan: membership.org_plan,
        },
        token: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresIn: tokenPair.expiresIn,
      });
    } catch (error: unknown) {
      logger.error('[Auth] Switch organization error:', error);
      return res.status(500).json({ error: 'Failed to switch organization' });
    }
  })
);

// LOGOUT - Revokes the current token
router.post(
  '/logout',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      // Always clear cookie-based auth (even if revocation fails).
      try {
        clearAuthCookies(res);
      } catch {
        // ignore
      }

      // Token can come from Authorization header OR cookie-based auth.
      const authHeader = req.headers.authorization;
      const headerToken =
        authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
      const cookieToken = req.cookies?.[ACCESS_TOKEN_COOKIE];
      const rawToken = headerToken || cookieToken;

      if (!rawToken) {
        // If we got here, verifyToken probably used a different extraction; still return OK.
        return res.json({ message: 'Logged out successfully' });
      }

      const decoded = jwt.decode(rawToken) as { jti?: string; exp?: number; id?: string } | null;

      if (!decoded || !decoded.jti) {
        // Token doesn't have jti (old token format), just acknowledge logout
        return res.json({ message: 'Logged out successfully' });
        return;
      }

      // Calculate expiry from token
      const expiresAt = new Date((decoded.exp || 0) * 1000).toISOString();

      // Add token to revocation list
      await dbRun(
        `INSERT OR IGNORE INTO revoked_tokens (jti, user_id, expires_at, reason) VALUES (?, ?, ?, ?)`,
        [decoded.jti, (req.user as any)?.id || decoded.id || 'unknown', expiresAt, 'logout']
      );
      return res.json({ message: 'Logged out successfully' });
    } catch (error: unknown) {
      logger.error('Logout error:', error);
      return res.status(500).json({ error: 'Logout failed' });
    }
  })
);

// REVERT IMPERSONATION (Back to Admin)
router.post(
  '/revert-impersonation',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const impersonatorId = req.user!.impersonatorId;
    const impersonationSessionId = (req.user as any)?.impersonationSessionId;
    if (!impersonatorId) {
      return res.status(400).json({ error: 'Not currently impersonating' });
      return;
    }

    const adminUser = await dbGet<{
      id: string;
      email: string;
      role: string;
      organization_id: string;
      first_name: string;
      last_name: string;
      status: string;
    }>('SELECT * FROM users WHERE id = ?', [impersonatorId]);

    if (!adminUser) {
      return res.status(404).json({ error: 'Original admin not found' });
      return;
    }

    // Verify the original user is indeed an admin/superadmin (security check)
    if (adminUser.role !== 'SUPERADMIN' && adminUser.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Original user is not an admin' });
      return;
    }

    // Generate new token for the admin
    const jti = uuidv4();
    const token = jwt.sign(
      {
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
        organizationId: adminUser.organization_id,
        jti: jti,
      },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN }
    );

    const rawToken = req.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
    const decodedCurrent = rawToken
      ? (jwt.decode(rawToken) as { jti?: string; exp?: number; id?: string } | null)
      : null;
    if (decodedCurrent?.jti && decodedCurrent?.exp) {
      await dbRun(
        `INSERT OR IGNORE INTO revoked_tokens (jti, user_id, expires_at, reason) VALUES (?, ?, ?, ?)`,
        [
          decodedCurrent.jti,
          decodedCurrent.id || req.user!.id || 'unknown',
          new Date(decodedCurrent.exp * 1000).toISOString(),
          'impersonation-end',
        ],
        { fallback: false }
      );
    }

    let durationMinutes = 30;
    if (impersonationSessionId) {
      const session = await dbGet<{
        id: string;
        started_at: string;
        target_user_id: string;
      }>(
        'SELECT id, started_at, target_user_id FROM superadmin_impersonation_sessions WHERE id = ?',
        [impersonationSessionId]
      );

      if (session?.started_at) {
        durationMinutes = Math.max(
          0,
          Math.round((Date.now() - new Date(session.started_at).getTime()) / 60000)
        );
      }

      await dbRun(
        `UPDATE superadmin_impersonation_sessions
         SET ended_at = datetime('now'), is_active = 0
         WHERE id = ?`,
        [impersonationSessionId],
        { fallback: false }
      );
    }

    await auditEventsService.log({
      actorId: impersonatorId,
      actorType: 'USER',
      organizationId: req.user!.organizationId,
      action: 'user.impersonation_end',
      resourceType: 'user',
      resourceId: req.user!.id,
      metadata: {
        targetUserId: req.user!.id,
        tenantId: req.user!.organizationId,
        durationMinutes,
        sessionId: impersonationSessionId || null,
      },
      ip: req.ip,
      userAgent: req.get('user-agent') || undefined,
    });

    // Log the reversion
    ActivityService.log({
      organizationId: adminUser.organization_id,
      userId: adminUser.id,
      action: 'impersonate_end',
      entityType: 'user',
      entityId: req.user!.id,
      entityName: req.user!.email || '',
    });

    // Return admin user and token
    const safeUser = {
      id: adminUser.id,
      email: adminUser.email,
      firstName: adminUser.first_name,
      lastName: adminUser.last_name,
      role: adminUser.role,
      status: adminUser.status,
      organizationId: adminUser.organization_id,
      companyName: 'Admin Console',
      isAuthenticated: true,
      accessLevel: 'full' as const, // Admin should have full access
    };

    return res.json({ user: safeUser, token });
  })
);

// REGISTER DEMO - public `Try demo` entry (OPS-DEMO-002).
//
// Abuse surface: unauthenticated, CSRF-exempt, and every success provisions a
// seeded tenant. It is throttled on two independent axes — source IP, and the
// submitted address hashed into an opaque key — so neither a single network nor
// a proxy pool hammering one address can fill the demo database or enumerate
// registrations cheaply.
router.post(
  '/register-demo',
  demoSignupIpRateLimiter,
  demoSignupIdentityRateLimiter,
  validateBody(RegisterDemoRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { password, firstName, acceptedLegalDocs } = req.body;
    // Store the SAME normalized form the login lookup uses. `login` resolves the
    // account with `WHERE email = ?` on an already-lowercased address, so storing
    // the raw mixed-case input here produced accounts that could never sign in and
    // could never be re-registered (the duplicate check below is case-insensitive).
    // That was the root cause of the "account exists but the password is wrong"
    // dead end on demo.consultify.ai.
    const normalizedEmail = normalizeAuthEmail(req.body?.email);

    // One identical body for every non-seed rejection — duplicate address
    // included — so status, code and wording cannot separate a registered address
    // from an unknown one. The real reason is logged server-side only.
    //
    // Honest limit, recorded in the packet: this endpoint PROVISIONS on success,
    // so an unknown address returns 200 and a registered one returns 409. That
    // difference is inherent to a signup endpoint and is not removable here; the
    // rate limiters above are what make walking it expensive.
    const respondSignupUnavailable = () =>
      res.status(409).json({
        error:
          'We could not start a demo with those details. Log in if you already have an account, or use a different email address.',
        code: 'DEMO_SIGNUP_UNAVAILABLE',
      });

    const existingUser = await dbGet<{ id: string; organization_id: string }>(
      buildCaseInsensitiveUserEmailLookupQuery('id, organization_id'),
      [normalizedEmail]
    );
    if (existingUser) {
      // Spend the same bcrypt cost the accepted path spends before answering.
      // Without this the duplicate branch returns an order of magnitude faster
      // than any branch that hashes, which is a timing oracle on its own.
      bcrypt.hashSync(password, 8);
      logger.info('[Auth] Demo signup rejected: address already registered');
      return respondSignupUnavailable();
    }

    const hashedPassword = bcrypt.hashSync(password, 8);
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      '';

    const provisioned = await provisionPublicDemoAccount({
      normalizedEmail,
      hashedPassword,
      firstName: firstName || '',
      acceptedLegalDocs: Array.isArray(acceptedLegalDocs) ? acceptedLegalDocs : [],
      locale: String(req.get('X-App-Language') || req.get('Accept-Language') || 'en'),
      ipAddress,
      userAgent: req.get('user-agent') || '',
    });

    if (!provisioned.ok) {
      // The saga already unwound. When it could not verify the unwind the address
      // may still be occupied, so say so in the logs — a prospect retrying will
      // otherwise hit the duplicate branch forever with no trace of why.
      logger.error('[Auth] Demo signup failed', {
        failedStep: provisioned.failedStep,
        compensationComplete: provisioned.compensation.complete,
      });
      return res.status(503).json({
        error: 'The demo workspace is temporarily unavailable. Please try again shortly.',
        code: 'DEMO_SEED_UNAVAILABLE',
      });
    }

    const { userId, organizationId: demoOrgId, session: demoSession, tokens } = provisioned;

    // No read-back of the row we just wrote. The saga has already committed the
    // account, the session and the tokens by this point, so a failed SELECT here
    // used to answer 503 DEMO_SEED_UNAVAILABLE while leaving a LIVE account behind
    // — and because the duplicate check above is the first thing the next attempt
    // hits, that address became permanently unusable. There is no failure path to
    // report because there is no longer a query that can fail.
    //
    // Every field below is what `provisionPublicDemoAccount` itself wrote, taken
    // from its result or from the values it was handed:
    //   id              -> provisioned.userId
    //   email           -> normalizedEmail (the exact string inserted; the row is
    //                      written from it, so re-reading could only echo it back)
    //   first_name      -> firstName (same value passed into the saga)
    //   last_name       -> '' (the saga inserts a literal empty string)
    //   role            -> DEMO_SIGNUP_ROLE (the saga's own constant, imported so
    //                      the two cannot drift)
    //   organization_id -> provisioned.organizationId (the base demo org the user
    //                      row belongs to — NOT the isolated session tenant, which
    //                      travels separately in `demoSession`)
    const language = String(req.get('Accept-Language') || '')
      .split(',')[0]
      ?.split('-')[0]
      ?.toLowerCase();

    await recordDemoTrialEvent({
      eventType: DEMO_TRIAL_EVENT_TYPES.DEMO_STARTED,
      organizationId: demoSession.session_org_id || demoOrgId,
      userId,
      source: 'register_demo',
      language: language || undefined,
      metadata: { entryPoint: 'demo_signup', hasContact: true },
    });

    const org = await dbGet<{ name: string }>('SELECT name FROM organizations WHERE id = ?', [
      demoOrgId,
    ]);

    const safeUser = {
      id: userId,
      email: normalizedEmail,
      firstName: firstName || '',
      lastName: '',
      role: DEMO_SIGNUP_ROLE,
      status: 'active',
      organizationId: demoOrgId,
      companyName: org?.name || 'Atelier Toys',
      isDemo: true,
      hasWorkspace: true,
      isAuthenticated: true,
      accessLevel: 'full' as const,
    };

    try {
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    } catch {
      /* ignore */
    }

    logger.info('[Auth] Demo signup successful', { userId });
    return res.json({
      user: safeUser,
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: config.JWT_EXPIRES_IN,
      isDemo: true,
      // The client must echo `organizationId` back as `X-Demo-Session-Org`. The
      // server also derives the tenant from the active session, so a missing
      // header cannot widen access — it just costs a round trip.
      demoSession: {
        id: demoSession.id,
        organizationId: demoSession.session_org_id,
        locale: demoSession.locale,
        expiresAt: demoSession.expires_at,
        anchorDate: demoSession.anchor_date,
      },
    });
  })
);

/**
 * Minimum length a configured `TEST_SUPPORT_KEY` must have to count as real.
 * Same threshold `server/src/routes/testSupport.routes.ts` (`assertEnabled`) uses,
 * so "this box is provisioned for test support" means one thing in both places.
 */
const TEST_SUPPORT_KEY_MIN_LENGTH = 12;

/**
 * Is the anonymous demo gateway (`POST /api/auth/demo-login`) reachable?
 *
 * That endpoint is unauthenticated, CSRF-exempt, hands out a full session, AND
 * auto-provisions a demo user when the seeded one is missing. It exists only so
 * CI/E2E can obtain a deterministic session without depending on a seed script.
 *
 * ALL THREE conditions must hold simultaneously. The conjunction is the whole
 * point: each condition on its own is something a single deploy mistake can flip.
 *
 *   1. `NODE_ENV === 'test'` — never 'production', never 'staging', never unset.
 *      This is the anchor: a real deployment cannot be switched to NODE_ENV=test
 *      by accident without visibly breaking much else first.
 *   2. an explicit opt-in flag (`ENABLE_TEST_GATEWAY` or `E2E_MODE`) — so a
 *      process that legitimately runs under NODE_ENV=test (a unit-test worker, a
 *      script) does not expose the gateway unless somebody asked for it. This is
 *      ADDITIONAL to (1), not an alternative to it.
 *   3. a configured `TEST_SUPPORT_KEY` of at least TEST_SUPPORT_KEY_MIN_LENGTH
 *      characters — the same signal `testSupport.routes.ts` requires. A harness
 *      provisioned for test support has one; a production box does not.
 *
 * The previous form was a DISJUNCTION — `NODE_ENV === 'test' || E2E_MODE ===
 * 'true' || ENABLE_TEST_GATEWAY === 'true'` — so setting one variable on a
 * production deployment re-opened anonymous auth plus auto-provisioning. Env vars
 * are the easiest thing to get wrong on Railway, which made that a one-typo hole.
 * With the conjunction a production box has to get three independent things wrong
 * at once, and the one that dominates (NODE_ENV) is not a stray toggle.
 *
 * Deliberately NOT an `x-test-support-key` REQUEST-HEADER check, unlike
 * `testSupport.routes.ts`. Every existing caller — the Playwright specs under
 * `tests/e2e/**` and the browser client in `src/services/api.ts` — posts to this
 * endpoint with no custom headers, so a header requirement would break them all.
 * It would also buy nothing against the threat actually being closed here, which
 * is a MISCONFIGURED DEPLOYMENT, not an attacker who is already inside a
 * NODE_ENV=test process. The key is read as a provisioning assertion about the
 * environment, not as a per-request credential. `testSupport.routes.ts` keeps the
 * header check because its callers are server-side fixtures that can send one.
 *
 * Read from `process.env` at REQUEST time, not module load, so the answer can
 * never be a stale snapshot taken before the process finished configuring itself
 * (and so tests can toggle env per case without re-importing the module).
 */
export function isDemoLoginGatewayOpen(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV !== 'test') return false;

  const explicitlyEnabled = env.ENABLE_TEST_GATEWAY === 'true' || env.E2E_MODE === 'true';
  if (!explicitlyEnabled) return false;

  const testSupportKey = env.TEST_SUPPORT_KEY;
  if (!testSupportKey || testSupportKey.length < TEST_SUPPORT_KEY_MIN_LENGTH) return false;

  return true;
}

// DEMO LOGIN - Anonymous demo (deprecated in production; use register-demo or login+demo/enter)
// Kept for E2E and test gateway compatibility
router.post(
  '/demo-login',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!isDemoLoginGatewayOpen()) {
      return res.status(410).json({
        error: 'Anonymous demo is no longer available. Please sign up or log in to try the demo.',
        code: 'DEMO_LOGIN_DEPRECATED',
        alternatives: ['/api/auth/register-demo', '/api/auth/login + /api/demo/toggle'],
      });
    }

    // Single demo account (do not use DBR77 domain)
    const DEMO_EMAILS = ['piotr.wisniewski@demo.com'];

    logger.info('[Auth] Demo login request (test mode)');

    try {
      let user = null as any;
      let matchedEmail = DEMO_EMAILS[0];
      for (const email of DEMO_EMAILS) {
        const found = await dbGet<{
          id: string;
          email: string;
          role: string;
          organization_id: string;
          first_name: string;
          last_name: string;
          status: string;
        }>('SELECT * FROM users WHERE email = ?', [email]);
        if (found) {
          user = found;
          matchedEmail = email;
          break;
        }
      }

      if (!user) {
        // Deterministic E2E/CI support: auto-provision a demo user when running in test gateway mode.
        // This avoids flaky smoke tests that depend on external seed scripts.
        //
        // Same predicate as the entry guard above — not a second copy. The two
        // copies of this computation used to drift apart trivially, and this is the
        // branch that WRITES an ADMIN-shaped account into whatever database the
        // process is pointed at, so it must never be reachable on a stricter
        // condition than the endpoint itself.
        if (!isDemoLoginGatewayOpen()) {
          logger.error('[Auth] Demo user not found - please run seed script');
          return res.status(404).json({
            error: 'Demo user not found. Please contact support.',
            code: 'DEMO_USER_NOT_FOUND',
          });
        }

        const demoOrgId = 'demo-org';
        const demoUserId = 'demo-user-id';
        const demoEmail = DEMO_EMAILS[0];

        await dbRun(
          `
            INSERT INTO organizations (id, name, plan, status)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO NOTHING
          `,
          [demoOrgId, 'Demo Organization', 'enterprise', 'active']
        );

        await dbRun(
          `
            INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO NOTHING
          `,
          [demoUserId, demoOrgId, demoEmail, 'demo-not-used', 'ADMIN', 'active', 'Demo', 'User']
        );

        user = await dbGet<{
          id: string;
          email: string;
          role: string;
          organization_id: string;
          first_name: string;
          last_name: string;
          status: string;
        }>('SELECT * FROM users WHERE id = ?', [demoUserId]);
        matchedEmail = demoEmail;

        if (!user) {
          logger.error('[Auth] Demo user auto-provision failed');
          return res.status(500).json({ error: 'Demo login failed. Please try again.' });
        }
      }

      const org = await dbGet<{
        id: string;
        name: string;
      }>('SELECT * FROM organizations WHERE id = ?', [user.organization_id]);

      const tokenResult = await refreshTokenService.generateTokenPair(user, {
        deviceInfo: 'Demo Session',
        ip: req.ip,
        userAgent: req.get('user-agent') || null,
      });

      ActivityService.log({
        organizationId: user.organization_id,
        userId: user.id,
        action: 'demo_login',
        entityType: 'user',
        entityId: user.id,
        entityName: matchedEmail,
        metadata: { ip: req.ip },
      });
      await recordDemoTrialEvent({
        eventType: DEMO_TRIAL_EVENT_TYPES.DEMO_STARTED,
        organizationId: user.organization_id,
        userId: user.id,
        source: 'demo_login',
        language: String(req.get('Accept-Language') || '')
          .split(',')[0]
          ?.split('-')[0]
          ?.toLowerCase(),
      });

      const safeUser = {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        status: user.status,
        organizationId: user.organization_id,
        companyName: org?.name || 'Demo Company',
        isDemo: true,
        hasWorkspace: true,
        isAuthenticated: true,
        accessLevel: 'full' as const, // Demo user should have full access
      };

      logger.info('[Auth] Demo login successful');
      try {
        setAuthCookies(res, tokenResult.accessToken, tokenResult.refreshToken);
      } catch {
        // ignore
      }
      return res.json({
        user: safeUser,
        token: tokenResult.accessToken,
        refreshToken: tokenResult.refreshToken,
        isDemo: true,
      });
    } catch (error: unknown) {
      logger.error('[Auth] Demo login error:', error);
      return res.status(500).json({ error: 'Demo login failed. Please try again.' });
    }
  })
);

/*
 * Legacy implementation (kept in git history) used a fixed DEMO_EMAIL and DEMO_PASSWORD.
 * Demo login now selects the first available account from DEMO_EMAILS.
 */
/*
    const user = await dbGet<{
        id: string;
        email: string;
        role: string;
        organization_id: string;
        first_name: string;
        last_name: string;
        status: string;
      }>('SELECT * FROM users WHERE email = ?', [DEMO_EMAIL]);

      if (!user) {
        logger.error('[Auth] Demo user not found - please run seed script');
        return res.status(404).json({
          error: 'Demo user not found. Please contact support.',
          code: 'DEMO_USER_NOT_FOUND',
        });
        return;
      }

      const org = await dbGet<{
        id: string;
        name: string;
      }>('SELECT * FROM organizations WHERE id = ?', [user.organization_id]);

      const tokenResult = await refreshTokenService.generateTokenPair(user, {
        deviceInfo: 'Demo Session',
        ip: req.ip,
        userAgent: req.get('user-agent') || null,
      });

      ActivityService.log({
        organizationId: user.organization_id,
        userId: user.id,
        action: 'demo_login',
        entityType: 'user',
        entityId: user.id,
        entityName: DEMO_EMAIL,
        metadata: { ip: req.ip },
      });

      const safeUser = {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        status: user.status,
        organizationId: user.organization_id,
        companyName: org?.name || 'Demo Company',
        isDemo: true,
        hasWorkspace: true,
        isAuthenticated: true,
        accessLevel: 'full' as const, // Demo user should have full access
      };

      logger.info('[Auth] Demo login successful');
      return res.json({
        user: safeUser,
        token: tokenResult.accessToken,
        refreshToken: tokenResult.refreshToken,
        isDemo: true,
      });
    } catch (error: unknown) {
      logger.error('[Auth] Demo login error:', error);
      return res.status(500).json({ error: 'Demo login failed. Please try again.' });
    }
  })
);
*/

// REGISTER (New Company)
router.post(
  '/register',
  validateBody(RegisterRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const {
      email: requestedEmail,
      password,
      firstName,
      lastName,
      companyName,
      accessCode,
      isDemo,
      promoCode,
      utm_campaign,
      utm_medium,
      partner_code,
      acceptedLegalDocs,
    } = req.body;
    const email = String(requestedEmail || '').trim();
    const normalizedEmail = normalizeAuthEmail(requestedEmail);

    const { default: PromoCodeService } = (await import('../services/promoCodeService.js')) as any;
    const { default: AttributionService } =
      (await import('../services/attributionService.js')) as any;

    let promoValidation: any = null;
    if (promoCode) {
      try {
        promoValidation = await PromoCodeService.validatePromoCode(promoCode);
        if (!promoValidation.valid) {
          return res.status(400).json({
            error: promoValidation.reason,
            errorCode: 'INVALID_PROMO_CODE',
          });
          return;
        }
      } catch (err: any) {
        logger.error('[Auth] Promo validation error:', err);
        return res.status(500).json({ error: 'Failed to validate promo code' });
        return;
      }
    }

    const existingUser = await dbGet<{ id: string }>(
      buildCaseInsensitiveUserEmailLookupQuery('id'),
      [normalizedEmail]
    );
    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use' });
      return;
    }

    let orgId = uuidv4();
    const userId = uuidv4();
    const hashedPassword = bcrypt.hashSync(password, 8);
    let joiningExistingOrg = false;
    let accessCodeRole = 'MEMBER';

    const proceedWithRegistration = async (finalStatus: string, finalPlan: string) => {
      try {
        let trialStartedAt: string | null = null;
        let trialExpiresAt: string | null = null;

        if (!joiningExistingOrg) {
          if (!isGenericOrganizationName(companyName)) {
            try {
              await assertOrganizationNameAvailable(companyName);
            } catch (error) {
              if (error instanceof DuplicateOrganizationNameError) {
                return res.status(409).json({
                  error:
                    'An organization with this company name already exists. Ask your admin for an invite or use the existing access flow instead of creating a duplicate workspace.',
                  code: error.code,
                  existingOrganization: {
                    id: error.existingOrganization.id,
                    name: error.existingOrganization.name,
                  },
                });
              }
              throw error;
            }
          }

          // Create self-serve trial organization with explicit trial metadata.
          trialStartedAt = new Date().toISOString();
          trialExpiresAt = new Date(
            Date.now() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000
          ).toISOString();

          const orgResult = await dbRun(
            `INSERT INTO organizations (
               id, name, plan, status, organization_type, trial_started_at, trial_expires_at,
               onboarding_status, is_active
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              orgId,
              companyName || 'My Company',
              finalPlan,
              finalStatus,
              ORG_TYPES.TRIAL,
              trialStartedAt,
              trialExpiresAt,
              'NOT_STARTED',
              1,
            ]
          );

          if (!orgResult.success) {
            if (process.env.NODE_ENV !== 'production')
              logger.error('Register Org Error:', orgResult.error);
            return res.status(500).json({
              error: 'Failed to create a fully configured trial organization',
            });
          }

          try {
            const accessPolicyModule = (await import('../services/accessPolicyService.js')) as any;
            const accessPolicyService = accessPolicyModule.default || accessPolicyModule;
            await accessPolicyService.createDefaultLimits(orgId, ORG_TYPES.TRIAL);
          } catch (limitErr) {
            logger.error('[Auth] Failed to initialize default trial limits:', limitErr);
            await dbRun(`DELETE FROM organizations WHERE id = ?`, [orgId]);
            return res.status(500).json({ error: 'Failed to initialize trial limits' });
          }
        }

        const userRole = joiningExistingOrg ? accessCodeRole : 'ADMIN';

        // Create user
        const userResult = await dbRun(
          `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [userId, orgId, email, hashedPassword, firstName, lastName, userRole]
        );

        if (!userResult.success) {
          if (process.env.NODE_ENV !== 'production')
            logger.error('Register User Error:', userResult.error);
          if (!joiningExistingOrg) {
            await dbRun(`DELETE FROM organization_limits WHERE organization_id = ?`, [orgId]).catch(
              () => undefined
            );
            await dbRun(`DELETE FROM organizations WHERE id = ?`, [orgId]).catch(() => undefined);
          }
          return res.status(500).json({ error: 'Failed to create user' });
        }

        const memberRole = joiningExistingOrg ? accessCodeRole : 'OWNER';

        // Ensure organization_members row exists for multi-org support
        await dbRun(
          `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
           VALUES (?, ?, ?, ?, 'ACTIVE', datetime('now'))
           ON CONFLICT(organization_id, user_id) DO NOTHING`,
          [uuidv4(), orgId, userId, memberRole]
        );

        try {
          await assignAplixDefaultInterviews({
            organizationId: orgId,
            userId,
            createdBy: userId,
            accessCode,
          });
        } catch (assignmentErr) {
          logger.error('[Auth] Failed to auto-assign APLIX interviews:', assignmentErr);
          return res.status(500).json({ error: 'Failed to assign required APLIX interviews' });
        }

        if (Array.isArray(acceptedLegalDocs) && acceptedLegalDocs.length > 0) {
          try {
            const ipAddress =
              (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
              req.socket?.remoteAddress ||
              '';
            await legalService.acceptDocuments(
              userId,
              acceptedLegalDocs,
              'USER',
              ipAddress,
              req.get('user-agent') || '',
              orgId
            );
          } catch (legalErr) {
            logger.warn('[Auth] Registration legal acceptance recording failed:', legalErr);
          }
        }

        if (!joiningExistingOrg && trialExpiresAt) {
          await recordDemoTrialEvent({
            eventType: DEMO_TRIAL_EVENT_TYPES.TRIAL_STARTED,
            organizationId: orgId,
            userId,
            source: isDemo ? 'demo' : 'landing',
            language: String(req.get('Accept-Language') || '')
              .split(',')[0]
              ?.split('-')[0]
              ?.toLowerCase(),
            metadata: {
              trialDurationDays: TRIAL_DURATION_DAYS,
              trialExpiresAt,
              trialStartedAt,
            },
          });
        }

        try {
          await AttributionService.recordAttribution({
            organizationId: orgId,
            userId: userId,
            sourceType: promoCode
              ? AttributionService.SOURCE_TYPES.PROMO_CODE
              : AttributionService.SOURCE_TYPES.SELF_SERVE,
            sourceId: promoValidation?.codeId || null,
            campaign: utm_campaign,
            partnerCode: promoValidation?.partnerCode || partner_code,
            medium: utm_medium,
            metadata: {
              promoCode: promoCode || null,
              accessCode: accessCode || null,
              isDemo,
              entryPoint: 'registration',
            },
          });
        } catch (attrErr) {
          logger.error('[Auth] Attribution recording failed:', attrErr);
        }

        // GAP-PARTNER-007: Create partner attribution if partner_code is provided
        const effectivePartnerCode = promoValidation?.partnerCode || partner_code;
        if (effectivePartnerCode) {
          try {
            const { default: PartnerReferralService } =
              (await import('../services/partnerReferralService.js')) as any;

            // Validate the partner code
            const validation =
              await PartnerReferralService.validateReferralCode(effectivePartnerCode);

            if (validation.valid && validation.partnerOrgId) {
              // Create partner attribution
              await PartnerReferralService.createAttribution({
                partnerOrgId: validation.partnerOrgId,
                organizationId: orgId,
                attributionType: 'PROMO_CODE',
                referralCodeUsed: effectivePartnerCode,
                commissionRatePercent: validation.commissionRate || 15,
              });

              // Create discount if applicable
              const { getDatabase } = await import('../database/Database.js');
              const db = getDatabase();

              // Get discount config
              const discountConfig = await db.get(
                `SELECT discount_type, discount_value, duration_months
                                 FROM partner_discount_config
                                 WHERE is_active = 1
                                 ORDER BY created_at DESC
                                 LIMIT 1`
              );

              if (discountConfig) {
                const endDate = new Date();
                endDate.setMonth(
                  endDate.getMonth() + ((discountConfig as any).duration_months || 12)
                );

                await db.run(
                  `INSERT INTO organization_discounts 
                                     (id, organization_id, partner_org_id, discount_type, discount_value, start_date, end_date, status, created_at)
                                     VALUES (?, ?, ?, ?, ?, datetime('now'), ?, 'ACTIVE', datetime('now'))`,
                  [
                    uuidv4(),
                    orgId,
                    validation.partnerOrgId,
                    (discountConfig as any).discount_type,
                    (discountConfig as any).discount_value,
                    endDate.toISOString(),
                  ]
                );
              }

              logger.info(
                `[Auth] Partner attribution created for org ${orgId} with code ${effectivePartnerCode}`
              );

              // GAP-PARTNER-008: Send email notification to partner
              try {
                const PartnerEmailService = await import('../services/partnerEmailService.js');
                const partnerInfo = await db.get(
                  `SELECT partner_name, contact_email FROM partner_organizations WHERE id = ?`,
                  [validation.partnerOrgId]
                );

                if ((partnerInfo as any)?.contact_email) {
                  await PartnerEmailService.sendNewReferralNotification({
                    partnerEmail: (partnerInfo as any).contact_email,
                    partnerName: (partnerInfo as any).partner_name || 'Partner',
                    organizationName: companyName || 'New Organization',
                    referralCode: effectivePartnerCode,
                    attributionDate: new Date().toISOString(),
                  });
                }
              } catch (emailErr) {
                // Don't fail registration on email error
                logger.warn('[Auth] Failed to send partner notification email:', emailErr);
              }
            } else {
              logger.warn(
                `[Auth] Invalid partner code provided at registration: ${effectivePartnerCode}`
              );
            }
          } catch (partnerErr) {
            // Don't fail registration if partner attribution fails
            logger.error('[Auth] Partner attribution creation failed:', partnerErr);
          }
        }

        if (promoCode && promoValidation?.valid) {
          try {
            await PromoCodeService.markPromoCodeUsed(promoCode, orgId, userId);
          } catch (promoErr) {
            logger.error('[Auth] Promo code usage marking failed:', promoErr);
          }
        }

        const jti = uuidv4();
        const effectiveRole = joiningExistingOrg ? accessCodeRole : 'ADMIN';
        const token = jwt.sign(
          {
            id: userId,
            email: email,
            role: effectiveRole,
            organizationId: orgId,
            jti: jti,
          },
          config.JWT_SECRET,
          { expiresIn: config.JWT_EXPIRES_IN }
        );

        ActivityService.log({
          organizationId: orgId,
          userId: userId,
          action: 'registered',
          entityType: 'organization',
          entityId: orgId,
          entityName: joiningExistingOrg ? undefined : companyName,
        });

        // GAP-AUTH-001: Send email verification
        let emailVerificationSent = false;
        try {
          const emailVerificationService = (await import('../services/emailVerificationService.js'))
            .default;
          const token = await emailVerificationService.createVerificationToken(userId, email);
          // Do not block registration on flaky SMTP/network.
          await _withTimeout(
            emailVerificationService.sendVerificationEmail(email, firstName, token),
            1500
          );
          emailVerificationSent = true;
          logger.info(`[Auth] Email verification sent to ${email}`);
        } catch (verifyErr) {
          logger.warn('[Auth] Failed to send verification email:', verifyErr);
          // Don't fail registration if email verification fails
        }

        // GAP-AUTH-003: Send welcome email
        try {
          const welcomeEmailService = (await import('../services/welcomeEmailService.js')).default;
          // Do not block registration on flaky SMTP/network.
          await _withTimeout(
            welcomeEmailService.sendWelcomeEmail({
              email,
              firstName,
              companyName: companyName || 'Your Organization',
              isDemo,
            }),
            1500
          );
          logger.info(`[Auth] Welcome email sent to ${email}`);
        } catch (welcomeErr) {
          logger.warn('[Auth] Failed to send welcome email:', welcomeErr);
        }

        try {
          await _withTimeout(
            notifyAplixRegistrationInSlack({
              accessCode,
              firstName,
              lastName,
              email,
            }),
            1500
          );
        } catch (slackErr) {
          logger.warn('[Auth] Failed to send APLIX registration Slack alert:', slackErr);
        }

        // Slack Command Center (Filar 5): alert #cf-progress for EVERY signup,
        // not just APLIX. The dedicated APLIX alert above is unchanged.
        // Skip seed/test-fixture accounts (e.g. e2e+...@local.test created by
        // automated test runs) — they aren't real signups and were flooding
        // #cf-progress (observed: 20 "Rejestracja" posts in one 24h digest
        // window, all e2e+work-canvas-owner-...@local.test / e2e+xlsx-shell-...).
        const registrationEmailDomain = String(email || '')
          .split('@')[1]
          ?.trim()
          .toLowerCase();
        const isSeedRegistration = SEED_EMAIL_DOMAINS.some(
          (domain) =>
            registrationEmailDomain === domain || registrationEmailDomain?.endsWith(`.${domain}`)
        );
        if (isSeedRegistration) {
          logger.debug('[Auth] Skipping progress Slack alert for seed/test account', {
            emailDomain: registrationEmailDomain,
          });
        } else {
          try {
            const { routeToSlack } = await import('../services/slack/slackRouter.js');
            const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || email;
            const orgLabel = joiningExistingOrg
              ? `existing org ${orgId}`
              : companyName || 'new organization';
            await _withTimeout(
              routeToSlack({
                channel: 'progress',
                severity: 'INFO',
                // Headline (watch/phone): `🙋 Rejestracja · <imię> (<organizacja>)`.
                category: 'Rejestracja',
                title: `${fullName} (${orgLabel})`,
                text: `Email: ${email} · Rola: ${effectiveRole}`,
                dedupeKey: `registration:${userId}`,
              }).then(() => undefined),
              1500
            );
          } catch (progressErr) {
            logger.warn('[Auth] Failed to send progress registration Slack alert:', progressErr);
          }
        }

        return res.json({
          user: {
            id: userId,
            email,
            firstName,
            lastName,
            role: effectiveRole,
            companyName: joiningExistingOrg ? undefined : companyName,
            organizationId: orgId,
            emailVerified: false,
          },
          token,
          joiningExistingOrg,
          promoApplied: promoCode
            ? {
                code: promoCode,
                discountType: promoValidation?.discountType,
                discountValue: promoValidation?.discountValue,
              }
            : null,
          emailVerificationSent,
        });
      } catch (regErr) {
        logger.error('[Auth] Registration error:', regErr);
        return res.status(500).json({ error: 'Registration failed' });
      }
    };

    if (isDemo) {
      return await proceedWithRegistration('active', 'trial');
    }

    if (accessCode) {
      const codeRow = await dbGet<{
        id: string;
        organization_id: string;
        role: string;
        expires_at: string | null;
        max_uses: number;
        current_uses: number;
      }>('SELECT * FROM access_codes WHERE code = ? AND is_active = 1', [accessCode]);

      if (!codeRow) {
        return res
          .status(400)
          .json({ error: 'Invalid access code', errorCode: 'INVALID_ACCESS_CODE' });
      } else {
        if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
          return res
            .status(400)
            .json({ error: 'Access code has expired', errorCode: 'ACCESS_CODE_EXPIRED' });
        } else if (codeRow.max_uses > 0 && codeRow.current_uses >= codeRow.max_uses) {
          return res.status(400).json({
            error: 'Access code usage limit reached',
            errorCode: 'ACCESS_CODE_EXHAUSTED',
          });
        } else {
          // Join existing organization instead of creating a new one
          if (codeRow.organization_id) {
            const existingOrg = await dbGet<{ id: string; plan: string }>(
              'SELECT id, plan FROM organizations WHERE id = ?',
              [codeRow.organization_id]
            );
            if (existingOrg) {
              orgId = existingOrg.id;
              joiningExistingOrg = true;
              accessCodeRole = codeRow.role || 'MEMBER';
            }
          }

          await dbRun('UPDATE access_codes SET current_uses = current_uses + 1 WHERE id = ?', [
            codeRow.id,
          ]);
          await dbRun(`INSERT INTO access_code_usage (id, code_id, user_id) VALUES (?, ?, ?)`, [
            uuidv4(),
            codeRow.id,
            userId,
          ]);
          return await proceedWithRegistration(
            'active',
            joiningExistingOrg ? 'enterprise' : 'trial'
          );
        }
      }
    }

    return await proceedWithRegistration('active', 'trial');
  })
);

// Revoke all tokens for a user (admin action)
router.post(
  '/revoke-all',
  verifyToken,
  validateBody(RevokeAllTokensRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (req.user!.role !== 'ADMIN' && req.user!.role !== 'SUPERADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const { userId } = req.body;
    const targetUserId = userId || req.user!.id;

    const performRevocation = async (userIdToRevoke: string) => {
      const marker = `revoke-all-${userIdToRevoke}-${Date.now()}`;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      try {
        const result = await dbRun(
          `INSERT INTO revoked_tokens (jti, user_id, expires_at, reason) VALUES (?, ?, ?, ?)`,
          [marker, userIdToRevoke, expiresAt, 'revoke-all']
        );

        if (!result.success) {
          return res.status(500).json({ error: 'Failed to revoke tokens' });
        }
        return res.json({ message: 'All tokens revoked successfully' });
      } catch (err) {
        logger.error('Error revoking all tokens:', err);
        return res.status(500).json({ error: 'Failed to revoke tokens' });
      }
    };

    if (req.user!.role !== 'SUPERADMIN' && userId && userId !== req.user!.id) {
      const targetUser = await dbGet<{
        organization_id: string;
      }>('SELECT organization_id FROM users WHERE id = ?', [userId]);

      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      if (targetUser.organization_id !== req.user!.organizationId) {
        return res
          .status(403)
          .json({ error: 'Not authorized to revoke tokens for users outside your organization' });
      }
      return await performRevocation(targetUserId);
    } else {
      return await performRevocation(targetUserId);
    }
  })
);

// CHANGE PASSWORD (Authenticated User)
router.post(
  '/change-password',
  verifyToken,
  validateBody(ChangePasswordRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.id;

    try {
      const user = await dbGet<{
        id: string;
        password: string;
      }>('SELECT id, password FROM users WHERE id = ?', [userId]);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
        return;
      }

      const passwordIsValid = bcrypt.compareSync(currentPassword, user.password);
      if (!passwordIsValid) {
        return res.status(401).json({ error: 'Current password is incorrect' });
        return;
      }

      if (bcrypt.compareSync(newPassword, user.password)) {
        return res
          .status(400)
          .json({ error: 'New password must be different from current password' });
        return;
      }

      const hashedPassword = bcrypt.hashSync(newPassword, 10);

      const result = await dbRun('UPDATE users SET password = ? WHERE id = ?', [
        hashedPassword,
        userId,
      ]);
      if (!result.success) {
        throw new Error(result.error || 'Failed to update password');
      }

      ActivityService.log({
        organizationId: req.user!.organizationId || '',
        userId,
        action: 'password_changed',
        entityType: 'user',
        entityId: userId,
        entityName: 'Password Change',
      });

      await refreshTokenService.revokeAllUserTokens(userId);

      return res.json({
        success: true,
        message:
          'Password changed successfully. All other sessions have been logged out for security.',
      });
    } catch (error: unknown) {
      logger.error('[Auth] Change password error:', error);
      return res.status(500).json({ error: 'Failed to change password' });
    }
  })
);

// FORGOT PASSWORD — request a reset link (Public)
router.post(
  '/forgot-password',
  validateBody(ForgotPasswordRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const normalizedEmail = normalizeAuthEmail(req.body?.email);

    const user = await dbGet<{ id: string; email: string; status?: string }>(
      buildCaseInsensitiveUserEmailLookupQuery('id, email, status'),
      [normalizedEmail]
    );

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({
        success: true,
        message: passwordResetSuccessMessage,
      });
    }

    const userStatus = String(user.status || 'active')
      .trim()
      .toLowerCase();
    if (userStatus === 'deleted') {
      return res.json({ success: true, message: passwordResetSuccessMessage });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = getPasswordResetExpiresAt();

    await dbRun('DELETE FROM password_resets WHERE user_id = ?', [user.id]);
    await dbRun(
      'INSERT INTO password_resets (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
      [uuidv4(), user.id, token, expiresAt]
    );

    const resetLink = buildPasswordResetLink(token, req);

    try {
      const emailService = (await import('../services/emailService.js')).default;
      const delivered = await emailService.send({
        to: user.email,
        subject: 'Consultify — Password Reset',
        html: buildPasswordResetEmailHtml(resetLink),
      });
      if (!delivered) {
        logger.warn('[Auth] Password reset email was not delivered', {
          userId: user.id,
          email: user.email,
        });
      }
    } catch (err) {
      logger.error('[Auth] Failed to send password reset email:', err);
    }

    return res.json({ success: true, message: passwordResetSuccessMessage });
  })
);

// RESET PASSWORD (Public)
router.post(
  '/reset-password',
  validateBody(ResetPasswordRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { token, newPassword } = req.body;

    const resetData = await dbGet<{
      user_id: string;
      expires_at: string;
      current_password: string;
      user_status: string;
    }>(
      `SELECT pr.user_id, pr.expires_at, u.password as current_password, u.status as user_status
       FROM password_resets pr
       JOIN users u ON u.id = pr.user_id
       WHERE pr.token = ?`,
      [token]
    );

    if (!resetData) {
      return res.status(400).json({
        error: 'Invalid or expired reset link. Please request a new one.',
        code: 'PASSWORD_RESET_INVALID',
      });
      return;
    }

    if (new Date(resetData.expires_at) < new Date()) {
      await dbRun('DELETE FROM password_resets WHERE token = ?', [token]);
      return res.status(400).json({
        error: 'This reset link has expired. Please request a new one.',
        code: 'PASSWORD_RESET_EXPIRED',
      });
      return;
    }

    const userStatus = String(resetData.user_status || 'active')
      .trim()
      .toLowerCase();
    if (userStatus === 'deleted') {
      await dbRun('DELETE FROM password_resets WHERE user_id = ?', [resetData.user_id]);
      return res.status(403).json({
        error: 'This account is no longer available.',
        code: 'ACCOUNT_DELETED',
      });
    }

    if (bcrypt.compareSync(newPassword, resetData.current_password)) {
      return res.status(400).json({
        error: 'New password must be different from the current password.',
        code: 'PASSWORD_REUSE_NOT_ALLOWED',
      });
      return;
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);

    const updateResult = await dbRun('UPDATE users SET password = ? WHERE id = ?', [
      hashedPassword,
      resetData.user_id,
    ]);
    if (!updateResult.success) {
      return res.status(500).json({ error: 'Failed to update password' });
      return;
    }

    await dbRun('DELETE FROM password_resets WHERE user_id = ?', [resetData.user_id]);
    await refreshTokenService.revokeAllUserTokens(resetData.user_id, 'password_reset');

    ActivityService.log({
      organizationId: req.user?.organizationId || '',
      userId: resetData.user_id,
      action: 'password_reset_completed',
      entityType: 'user',
      entityId: resetData.user_id,
      entityName: 'Password Reset',
    });

    try {
      clearAuthCookies(res);
    } catch {
      // ignore cookie clear failures
    }

    return res.json({
      success: true,
      message: 'Password updated successfully. Please sign in again on this device.',
    });
  })
);

// EMAIL VERIFICATION
router.post(
  '/verify-email',
  validateBody(VerifyEmailRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { token } = req.body;

    try {
      const emailVerificationService = (await import('../services/emailVerificationService.js'))
        .default;
      const result = await emailVerificationService.verifyEmail(String(token || ''));

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      return res.json({ success: true, message: 'Email verified successfully' });
    } catch (error: unknown) {
      logger.error('Email verify error:', error);
      return res.status(500).json({ error: 'Verification failed' });
    }
  })
);

// MFA SETUP
router.post(
  '/mfa/setup',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const result = await mfaService.setupMFA(req.user!.id, req.user!.email || '');
      return res.json(result);
    } catch (error: unknown) {
      logger.error('MFA Setup error:', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ error: error.message, code: error.code });
      }
      return res.status(500).json({ error: 'MFA setup failed' });
    }
  })
);

router.post(
  '/mfa/enable',
  verifyToken,
  validateBody(MFAEnableRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { token } = req.body;
    try {
      const result = await mfaService.verifyAndEnableMFA(req.user!.id, token);
      if (!result.success) {
        return res.status(400).json(result);
        return;
      }
      return res.json(result);
    } catch (error: unknown) {
      logger.error('MFA Enable error:', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ error: error.message, code: error.code });
      }
      return res.status(500).json({ error: 'MFA activation failed' });
    }
  })
);

router.post(
  '/mfa/disable',
  verifyToken,
  validateBody(MFADisableRequestSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { token } = req.body;
    try {
      const result = await mfaService.disableMFA(req.user!.id, token);
      if (!result.success) {
        return res.status(400).json(result);
        return;
      }
      return res.json(result);
    } catch (error: unknown) {
      logger.error('MFA Disable error:', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ error: error.message, code: error.code });
      }
      return res.status(500).json({ error: 'MFA disable failed' });
    }
  })
);

// ==========================================
// GAP-AUTH-001: EMAIL VERIFICATION
// ==========================================

/**
 * GET /auth/verify-email
 * Verify email with token
 */
router.get(
  '/verify-email',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'Verification token is required' });
      }

      const emailVerificationService = (await import('../services/emailVerificationService.js'))
        .default;
      const result = await emailVerificationService.verifyEmail(token);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      // Redirect to frontend with success
      const redirectUrl = `${process.env.FRONTEND_URL || 'https://app.consultify.com'}/email-verified?success=true`;
      return res.redirect(redirectUrl);
    } catch (error: unknown) {
      logger.error('Email verification error:', error);
      return res.status(500).json({ error: 'Email verification failed' });
    }
  })
);

/**
 * POST /auth/resend-verification
 * Resend verification email
 */
router.post(
  '/resend-verification',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;

      const emailVerificationService = (await import('../services/emailVerificationService.js'))
        .default;
      const result = await emailVerificationService.resendVerificationEmail(userId);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      return res.json({ success: true, message: 'Verification email sent' });
    } catch (error: unknown) {
      logger.error('Resend verification error:', error);
      return res.status(500).json({ error: 'Failed to resend verification email' });
    }
  })
);

/**
 * GET /auth/verification-status
 * Check if user's email is verified
 */
router.get(
  '/verification-status',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;

      const emailVerificationService = (await import('../services/emailVerificationService.js'))
        .default;
      const isVerified = await emailVerificationService.isEmailVerified(userId);

      return res.json({ emailVerified: isVerified });
    } catch (error: unknown) {
      logger.error('Verification status error:', error);
      return res.status(500).json({ error: 'Failed to check verification status' });
    }
  })
);

export default router;
export const __private__ = { normalizeMembershipStatus, normalizeOrganizationStatus };
