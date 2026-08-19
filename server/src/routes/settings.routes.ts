/**
 * Settings Routes
 * API endpoints for settings including user preferences
 */

import crypto from 'crypto';
import { Response, Router } from 'express';

import { requireActiveAuditsMembership } from '../middleware/auditsStrictMembership.middleware.js';
import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { getSettingsActorRole, isRequestSuperAdmin } from '../middleware/requestAccess.js';
import { createAccountDeletionRequest, createDataExportRequest } from '../services/gdprService.js';
import { requireActiveMembership } from '../services/legacyCutover/requireActiveMembership.js';
import { logIntegrationConnectionEvent } from '../services/integrationConnectionLogService.js';
import { CONNECTORS } from '../services/integrationHubService.js';
import { disconnectIntegration } from '../services/integrationHubService.js';
import { updateIntegrationStatus } from '../services/integrationHubService.js';
import * as oauthEngine from '../services/integrationOAuthEngine.js';
import { setIntegrationOwner } from '../services/integrationOwnershipService.js';
import {
  buildGovernedExternalAuthSession,
  getGovernedExternalAuthConfigFields,
} from '../services/v8/pmSyncExternalAuthMaterializationService.js';
import { listGovernedIntegrations } from '../services/v8/pmSyncInventoryService.js';
import { setConnectorAuthState } from '../services/v8/pmSyncTruthService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import { getTableColumns } from '../utils/dbSchema.js';
import logger from '../utils/Logger.js';
import { encryptionEnabled, encryptSecret } from '../utils/secretEncryption.js';
import { verifyUserPassword } from '../utils/verifyUserPassword.js';

const router = Router();

const preferencesKey = (prefType: string) => `settings:${prefType}`;
const LEGACY_SETTINGS_ROOT_GUIDANCE =
  'Use /api/settings/registry for scoped settings and /api/superadmin for platform-wide settings.';
const PROFILE_EXPORT_COLUMNS = [
  'id',
  'email',
  'first_name',
  'last_name',
  'phone',
  'avatar_url',
  'job_title',
  'title',
  'display_name',
  'pronouns',
  'department',
  'status_message',
  'out_of_office',
  'vacation_end',
  'out_of_office_message',
  'company_name',
  'timezone',
  'date_format',
  'time_format',
  'seniority_level',
  'site_location',
  'tenure_years',
  'manages_team',
  'team_size',
  'expertise_tags',
  'engagement_level',
];
const PROFILE_IMPORT_COLUMNS = PROFILE_EXPORT_COLUMNS.filter(
  (column) => !['id', 'email'].includes(column)
);

const snakeToCamel = (value: string) =>
  value.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());

const upsertSettingsValue = async (key: string, value: string) => {
  const result = await dbRun(
    `INSERT INTO settings (key, value, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT (key) DO UPDATE SET
       value = EXCLUDED.value,
       updated_at = CURRENT_TIMESTAMP`,
    [key, value],
    { fallback: false }
  );

  if (!result.success) {
    throw new Error(result.error || 'Failed to save setting');
  }
};

const upsertUserPreferenceValue = async (userId: string, key: string, value: string) => {
  const result = await dbRun(
    `INSERT INTO user_preferences (user_id, key, value, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id, key) DO UPDATE SET
       value = EXCLUDED.value,
       updated_at = CURRENT_TIMESTAMP`,
    [userId, key, value],
    { fallback: false }
  );

  if (!result.success) {
    throw new Error(result.error || 'Failed to save preference');
  }

  return result;
};

const assertDbRunSuccess = (result: { success?: boolean; error?: string }, message: string) => {
  if (!result?.success) {
    throw new Error(result?.error || message);
  }
};

const RECOVERY_EMAIL_KEY = 'security.recovery_email';
const RECOVERY_PHONE_KEY = 'security.recovery_phone';

const getBackupCodesCount = async (userId: string) => {
  const row = await dbGet<{ backup_codes_count?: number | string }>(
    `SELECT backup_codes_count
     FROM user_mfa
     WHERE user_id = ?
     LIMIT 1`,
    [userId],
    { fallback: true }
  );

  return Number(row?.backup_codes_count || 0);
};

const getRecoveryOptions = async (userId: string) => {
  await ensureUserPreferencesTable();

  const rows = await dbAll<{ key: string; value: string }>(
    `SELECT key, value
     FROM user_preferences
     WHERE user_id = ? AND key IN (?, ?)`,
    [userId, RECOVERY_EMAIL_KEY, RECOVERY_PHONE_KEY],
    { fallback: true }
  );
  const values = new Map(rows.map((row) => [row.key, row.value]));

  return {
    recoveryEmail: values.get(RECOVERY_EMAIL_KEY) || '',
    recoveryPhone: values.get(RECOVERY_PHONE_KEY) || '',
    backupCodesCount: await getBackupCodesCount(userId),
  };
};

/**
 * GET /api/settings
 * Get system/user settings
 */
router.get(
  '/',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!isRequestSuperAdmin(req)) {
      return res.status(403).json({
        error: 'Legacy settings root is restricted to platform superadmins',
        code: 'LEGACY_SETTINGS_SCOPE_BLOCKED',
        guidance: LEGACY_SETTINGS_ROOT_GUIDANCE,
      });
    }

    try {
      const sql = `SELECT * FROM settings`;
      const rows = await dbAll(sql, [], { fallback: true });

      // Convert to key-value object
      const settings: Record<string, any> = {};
      rows.forEach((row: any) => {
        settings[row.key] = row.value;
      });

      return res.json(settings);
    } catch (err: any) {
      logger.error('[settings] Failed to load settings', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res
        .status(500)
        .json({ error: 'Failed to load settings', code: 'SETTINGS_LOAD_FAILED' });
    }
  })
);

/**
 * POST /api/settings
 * Update system/user settings
 */
router.post(
  '/',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!isRequestSuperAdmin(req)) {
      return res.status(403).json({
        error: 'Legacy settings root is restricted to platform superadmins',
        code: 'LEGACY_SETTINGS_SCOPE_BLOCKED',
        guidance: LEGACY_SETTINGS_ROOT_GUIDANCE,
      });
    }

    const { key, value } = req.body;

    if (!key) {
      return res.status(400).json({ error: 'Key is required' });
    }

    try {
      await upsertSettingsValue(
        key,
        typeof value === 'object' ? JSON.stringify(value) : String(value)
      );

      return res.json({ success: true });
    } catch (err: any) {
      logger.error('[settings] Failed to update setting', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res
        .status(500)
        .json({ error: 'Failed to update setting', code: 'SETTINGS_UPDATE_FAILED' });
    }
  })
);

// ===========================================
// USER PREFERENCES
// ===========================================

/**
 * Ensure user_preferences table exists
 */
const ensureUserPreferencesTable = async () => {
  // Keep schema compatible with DatabaseInitializer (`user_id`, `key`, `value`, `updated_at`).
  // This DDL is purely opportunistic — the table already exists in every real deployment.
  // Use fallback:true so a transient DDL failure (lock/timeout/brief read-only/connection blip)
  // can NEVER reject and bubble up as a bare 500 on the read endpoints that call this first.
  await dbRun(
    `
      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, key),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `,
    [],
    { fallback: true }
  );
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_user_prefs_user ON user_preferences(user_id)`, [], {
    fallback: true,
  });
};

/**
 * GET /api/settings/recovery
 * Get account recovery options with explicit read-back fields for Honest UI.
 */
router.get(
  '/recovery',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
      return res.json(await getRecoveryOptions(userId));
    } catch (error: any) {
      logger.error('[Settings] Failed to load recovery options:', error);
      return res.status(503).json({
        error: 'Recovery options unavailable',
        code: 'RECOVERY_OPTIONS_UNAVAILABLE',
      });
    }
  })
);

/**
 * PUT /api/settings/recovery
 * Update recovery contact options and return the persisted read-back state.
 */
router.put(
  '/recovery',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const hasRecoveryEmail = Object.prototype.hasOwnProperty.call(req.body || {}, 'recoveryEmail');
    const hasRecoveryPhone = Object.prototype.hasOwnProperty.call(req.body || {}, 'recoveryPhone');

    if (!hasRecoveryEmail && !hasRecoveryPhone) {
      return res.status(400).json({ error: 'At least one recovery option is required' });
    }

    const recoveryEmail = hasRecoveryEmail
      ? String(req.body.recoveryEmail || '').trim()
      : undefined;
    const recoveryPhone = hasRecoveryPhone
      ? String(req.body.recoveryPhone || '').trim()
      : undefined;

    if (recoveryEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recoveryEmail)) {
      return res.status(400).json({ error: 'Recovery email is invalid' });
    }

    try {
      await ensureUserPreferencesTable();

      if (recoveryEmail !== undefined) {
        await upsertUserPreferenceValue(userId, RECOVERY_EMAIL_KEY, recoveryEmail);
      }
      if (recoveryPhone !== undefined) {
        await upsertUserPreferenceValue(userId, RECOVERY_PHONE_KEY, recoveryPhone);
      }

      const persisted = await getRecoveryOptions(userId);
      // Audit log without persisting raw recovery contact values.
      await logSettingsChange(userId, 'security', 'recovery', 'updated', null, {
        recoveryEmailSet: !!persisted.recoveryEmail,
        recoveryPhoneSet: !!persisted.recoveryPhone,
      });
      return res.json({ success: true, ...persisted });
    } catch (error: any) {
      logger.error('[Settings] Failed to save recovery options:', error);
      return res.status(503).json({
        error: 'Recovery options unavailable',
        code: 'RECOVERY_OPTIONS_UNAVAILABLE',
      });
    }
  })
);

/**
 * GET /api/settings/preferences/regional
 * Get user's regional preferences
 */
router.get(
  '/preferences/regional',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
      await ensureUserPreferencesTable();

      const prefs = await dbGet<{ preferences_data: string }>(
        `SELECT value AS preferences_data FROM user_preferences WHERE user_id = ? AND key = ?`,
        [userId, preferencesKey('regional')],
        { fallback: false }
      );

      if (prefs?.preferences_data) {
        return res.json({ preferences: JSON.parse(prefs.preferences_data) });
      }

      const orgId = req.user?.organizationId;
      let tenantDefaults: { timezone?: string | null; currency?: string | null } = {};
      if (orgId) {
        try {
          const { default: organizationContextService } =
            await import('../services/organizationContext/OrganizationContextService.js');
          const context = await organizationContextService.buildResolvedContext(orgId);
          tenantDefaults = {
            timezone: context.profile.defaultTimezone,
            currency: context.profile.currency,
          };
        } catch (contextErr) {
          logger.warn(
            '[settings] Failed to hydrate tenant regional defaults from organization context:',
            contextErr
          );
        }
      }

      // Return defaults
      return res.json({
        preferences: {
          timezone: tenantDefaults.timezone || 'UTC',
          units: 'metric',
          currency: tenantDefaults.currency || 'USD',
          numberFormat: 'en-US',
          dateFormat: 'DD/MM/YYYY',
          timeFormat: '24h',
          firstDayOfWeek: 'monday',
        },
      });
    } catch (err: any) {
      // Read — regional preferences panel. Fail-soft: degrade to safe defaults
      // instead of breaking the settings screen with a 500.
      logger.warn('[settings] Regional preferences fetch degraded', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.json({
        preferences: {
          timezone: 'UTC',
          units: 'metric',
          currency: 'USD',
          numberFormat: 'en-US',
          dateFormat: 'DD/MM/YYYY',
          timeFormat: '24h',
          firstDayOfWeek: 'monday',
        },
        degraded: true,
      });
    }
  })
);

/**
 * PUT /api/settings/preferences/regional
 * Update user's regional preferences
 */
router.put(
  '/preferences/regional',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { preferences } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!preferences) {
      return res.status(400).json({ error: 'Preferences object is required' });
    }

    try {
      await ensureUserPreferencesTable();

      const result = await upsertUserPreferenceValue(
        userId,
        preferencesKey('regional'),
        JSON.stringify(preferences)
      );
      if (!result.success) throw new Error(result.error || 'Failed to save preference');

      logger.info(`[settings] Regional preferences updated for user ${userId}`);

      return res.json({ success: true });
    } catch (err: any) {
      // Write — NEVER fail-soft. Real error with a stable code, no err.message leak.
      logger.error('[settings] Error updating regional preferences:', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się zapisać preferencji regionalnych',
        code: 'SETTINGS_REGIONAL_UPDATE_FAILED',
      });
    }
  })
);

/**
 * GET /api/settings/preferences/notifications
 * Get user's notification preferences
 */
router.get(
  '/preferences/notifications',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
      await ensureUserPreferencesTable();

      const prefs = await dbGet<{ preferences_data: string }>(
        `SELECT value AS preferences_data FROM user_preferences WHERE user_id = ? AND key = ?`,
        [userId, preferencesKey('notifications')],
        { fallback: false }
      );

      if (prefs?.preferences_data) {
        return res.json({ preferences: JSON.parse(prefs.preferences_data) });
      }

      // Return defaults
      return res.json({
        preferences: {
          email: true,
          push: true,
          inApp: true,
          digest: 'daily',
        },
      });
    } catch (err: any) {
      // Read — notification preferences panel. Fail-soft: degrade to safe defaults.
      logger.warn('[settings] Notification preferences fetch degraded', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.json({
        preferences: {
          email: true,
          push: true,
          inApp: true,
          digest: 'daily',
        },
        degraded: true,
      });
    }
  })
);

/**
 * PUT /api/settings/preferences/notifications
 * Update user's notification preferences
 */
router.put(
  '/preferences/notifications',
  verifyToken,
  requireActiveMembership,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { preferences } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!preferences) {
      return res.status(400).json({ error: 'Preferences object is required' });
    }

    try {
      await ensureUserPreferencesTable();

      const result = await upsertUserPreferenceValue(
        userId,
        preferencesKey('notifications'),
        JSON.stringify(preferences)
      );
      if (!result.success) throw new Error(result.error || 'Failed to save preference');

      await logSettingsChange(userId, 'notifications', 'preferences', 'updated', null, preferences);
      logger.info(`[settings] Notification preferences updated for user ${userId}`);

      return res.json({ success: true });
    } catch (err: any) {
      // Write — NEVER fail-soft.
      logger.error('[settings] Error updating notification preferences:', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się zapisać preferencji powiadomień',
        code: 'SETTINGS_NOTIFICATIONS_UPDATE_FAILED',
      });
    }
  })
);

// ===========================================
// QUIET HOURS PREFERENCES
// ===========================================

/**
 * GET /api/settings/preferences/quietHours
 * Get user's quiet hours settings
 */
router.get(
  '/preferences/quietHours',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
      await ensureUserPreferencesTable();

      const prefs = await dbGet<{ preferences_data: string }>(
        `SELECT value AS preferences_data FROM user_preferences WHERE user_id = ? AND key = ?`,
        [userId, preferencesKey('quietHours')],
        { fallback: false }
      );

      if (prefs?.preferences_data) {
        return res.json({ preferences: JSON.parse(prefs.preferences_data) });
      }

      // Return defaults
      return res.json({
        preferences: {
          enabled: false,
          startTime: '22:00',
          endTime: '08:00',
          daysOfWeek: [0, 6],
          allowUrgent: true,
          allowMentions: false,
          allowDirectMessages: false,
          autoReplyEnabled: false,
          autoReplyMessage: '',
        },
      });
    } catch (err: any) {
      // Read — quiet hours panel. Fail-soft: degrade to safe defaults.
      logger.warn('[settings] Quiet hours fetch degraded', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.json({
        preferences: {
          enabled: false,
          startTime: '22:00',
          endTime: '08:00',
          daysOfWeek: [0, 6],
          allowUrgent: true,
          allowMentions: false,
          allowDirectMessages: false,
          autoReplyEnabled: false,
          autoReplyMessage: '',
        },
        degraded: true,
      });
    }
  })
);

/**
 * PUT /api/settings/preferences/quietHours
 * Update user's quiet hours settings
 */
router.put(
  '/preferences/quietHours',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const preferences = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
      await ensureUserPreferencesTable();
      const result = await upsertUserPreferenceValue(
        userId,
        preferencesKey('quietHours'),
        JSON.stringify(preferences)
      );
      if (!result.success) throw new Error(result.error || 'Failed to save preference');

      logger.info(`[settings] Quiet hours updated for user ${userId}`);

      return res.json({ success: true });
    } catch (err: any) {
      // Write — NEVER fail-soft.
      logger.error('[settings] Error updating quiet hours:', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się zapisać godzin ciszy',
        code: 'SETTINGS_QUIET_HOURS_UPDATE_FAILED',
      });
    }
  })
);

const normalizeInboxAIThreshold = (value: unknown) => {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : 0.85;
  return Math.max(0.5, Math.min(0.99, numeric));
};

const normalizeUserAIProviders = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((provider) => provider && typeof provider === 'object')
    .map((rawProvider) => {
      const provider = rawProvider as Record<string, unknown>;
      return {
        id: typeof provider.id === 'string' ? provider.id : crypto.randomUUID(),
        name: typeof provider.name === 'string' ? provider.name : '',
        provider: typeof provider.provider === 'string' ? provider.provider : 'openai',
        apiKey: typeof provider.apiKey === 'string' ? provider.apiKey : undefined,
        endpoint: typeof provider.endpoint === 'string' ? provider.endpoint : undefined,
        isEnabled: provider.isEnabled !== false,
        isLocal: Boolean(provider.isLocal),
      };
    })
    .filter((provider) => provider.name.trim().length > 0);
};

const redactUserAIProviders = (value: unknown) =>
  normalizeUserAIProviders(value).map(({ apiKey, ...provider }) => ({
    ...provider,
    hasApiKey: Boolean(apiKey),
  }));

const protectUserAIProvidersForStorage = (value: unknown) => {
  const providers = normalizeUserAIProviders(value);
  if (providers.some((provider) => provider.apiKey) && !encryptionEnabled()) {
    throw new Error('AI provider secret encryption is not configured');
  }
  return providers.map((provider) => ({
    ...provider,
    ...(provider.apiKey ? { apiKey: encryptSecret(provider.apiKey) } : {}),
  }));
};

/**
 * GET /api/settings/preferences/inbox-ai
 * Get user's inbox AI automation preferences.
 */
router.get(
  '/preferences/inbox-ai',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
      await ensureUserPreferencesTable();

      const prefs = await dbGet<{ preferences_data: string }>(
        `SELECT value AS preferences_data FROM user_preferences WHERE user_id = ? AND key = ?`,
        [userId, preferencesKey('inbox-ai')],
        { fallback: false }
      );

      if (prefs?.preferences_data) {
        const parsed = JSON.parse(prefs.preferences_data) as { threshold?: unknown };
        return res.json({
          preferences: {
            threshold: normalizeInboxAIThreshold(parsed.threshold),
          },
        });
      }

      return res.json({ preferences: { threshold: 0.85 } });
    } catch (err: any) {
      // Enrichment read — degrade to safe default instead of failing the whole response.
      logger.warn('[settings] Error fetching inbox AI preferences, degrading', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.json({ preferences: { threshold: 0.85 }, degraded: true });
    }
  })
);

/**
 * PUT /api/settings/preferences/inbox-ai
 * Update user's inbox AI automation preferences.
 */
router.put(
  '/preferences/inbox-ai',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
      const preferences = {
        threshold: normalizeInboxAIThreshold(
          req.body?.threshold ?? req.body?.preferences?.threshold
        ),
      };

      await ensureUserPreferencesTable();
      const result = await upsertUserPreferenceValue(
        userId,
        preferencesKey('inbox-ai'),
        JSON.stringify(preferences)
      );
      if (!result.success) throw new Error(result.error || 'Failed to save preference');

      return res.json({ success: true, preferences });
    } catch (err: any) {
      logger.error('[settings] Error updating inbox AI preferences:', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się zapisać preferencji AI dla skrzynki',
        code: 'SETTINGS_INBOX_AI_UPDATE_FAILED',
      });
    }
  })
);

/**
 * GET /api/settings/preferences/ai-providers
 * Get current user's personal AI provider configuration.
 */
router.get(
  '/preferences/ai-providers',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
      await ensureUserPreferencesTable();
      const prefs = await dbGet<{ preferences_data: string }>(
        `SELECT value AS preferences_data FROM user_preferences WHERE user_id = ? AND key = ?`,
        [userId, preferencesKey('ai-providers')],
        { fallback: false }
      );

      if (prefs?.preferences_data) {
        const parsed = JSON.parse(prefs.preferences_data) as { providers?: unknown };
        return res.json({ providers: redactUserAIProviders(parsed.providers) });
      }

      return res.json({ providers: [] });
    } catch (err: any) {
      logger.warn('[settings] Error fetching personal AI providers, degrading', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.json({ providers: [], degraded: true });
    }
  })
);

/**
 * PUT /api/settings/preferences/ai-providers
 * Update current user's personal AI provider configuration.
 */
router.put(
  '/preferences/ai-providers',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
      const providers = protectUserAIProvidersForStorage(req.body?.providers);
      await ensureUserPreferencesTable();
      const result = await upsertUserPreferenceValue(
        userId,
        preferencesKey('ai-providers'),
        JSON.stringify({ providers })
      );
      if (!result.success) throw new Error(result.error || 'Failed to save preference');

      return res.json({ success: true, providers: redactUserAIProviders(providers) });
    } catch (err: any) {
      logger.error('[settings] Error updating personal AI providers:', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się zapisać dostawców AI',
        code: 'SETTINGS_AI_PROVIDERS_UPDATE_FAILED',
      });
    }
  })
);

// ===========================================
// DND (DO NOT DISTURB) SETTINGS
// ===========================================

/**
 * GET /api/settings/notifications/dnd
 * Get user's DND settings
 */
router.get(
  '/notifications/dnd',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
      await ensureUserPreferencesTable();

      const prefs = await dbGet<{ preferences_data: string }>(
        `SELECT value AS preferences_data FROM user_preferences WHERE user_id = ? AND key = ?`,
        [userId, preferencesKey('dnd')],
        { fallback: false }
      );

      if (prefs?.preferences_data) {
        return res.json(JSON.parse(prefs.preferences_data));
      }

      // Return defaults
      return res.json({
        enabled: false,
        until: null,
      });
    } catch (err: any) {
      logger.warn('[settings] Error fetching DND settings, degrading', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.json({ enabled: false, until: null, degraded: true });
    }
  })
);

/**
 * PUT /api/settings/notifications/dnd
 * Update user's DND settings
 */
router.put(
  '/notifications/dnd',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { enabled, until } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
      await ensureUserPreferencesTable();

      const data = JSON.stringify({ enabled, until });
      const result = await upsertUserPreferenceValue(userId, preferencesKey('dnd'), data);
      if (!result.success) throw new Error(result.error || 'Failed to save preference');

      logger.info(`[settings] DND settings updated for user ${userId}`);

      return res.json({ success: true });
    } catch (err: any) {
      logger.error('[settings] Error updating DND settings:', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się zapisać trybu nie przeszkadzać',
        code: 'SETTINGS_DND_UPDATE_FAILED',
      });
    }
  })
);

// ===========================================
// NOTIFICATION PREFERENCES (Overview)
// ===========================================

const defaultNotificationPreferences = {
  taskAssignment: { email: true, inApp: true },
  taskUpdates: { email: false, inApp: true },
  milestones: { email: true, inApp: true },
  mentions: { email: true, inApp: true },
};

const defaultEmailNotificationPreferences = {
  taskUpdates: true,
  projectAlerts: true,
  weeklyDigest: true,
  marketing: false,
};

/**
 * GET /api/settings/notifications
 * Get notification channel preferences
 */
router.get(
  '/notifications',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
      await ensureUserPreferencesTable();

      const prefs = await dbGet<{ preferences_data: string }>(
        `SELECT value AS preferences_data FROM user_preferences WHERE user_id = ? AND key = ?`,
        [userId, preferencesKey('notifications')],
        { fallback: false }
      );

      if (prefs?.preferences_data) {
        return res.json(JSON.parse(prefs.preferences_data));
      }

      return res.json(defaultNotificationPreferences);
    } catch (err: any) {
      logger.warn('[settings] Error fetching notification preferences, degrading', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.json({ ...defaultNotificationPreferences, degraded: true });
    }
  })
);

/**
 * POST /api/settings/notifications
 * Save notification channel preferences
 */
router.post(
  '/notifications',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId, preferences } = req.body;
    const requesterId = req.user?.id;

    if (!userId || !preferences) {
      return res.status(400).json({ error: 'Missing userId or preferences' });
    }

    // Only owner or admin/superadmin
    const actorRole = getSettingsActorRole(req);
    if (requesterId !== userId && actorRole !== 'owner' && actorRole !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    try {
      await ensureUserPreferencesTable();

      const data = JSON.stringify(preferences);
      const result = await upsertUserPreferenceValue(userId, preferencesKey('notifications'), data);
      if (!result.success) throw new Error(result.error || 'Failed to save preference');

      logger.info(`[settings] Notification preferences updated for user ${userId}`);
      return res.json({ success: true });
    } catch (err: any) {
      logger.error('[settings] Error saving notification preferences:', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się zapisać preferencji powiadomień',
        code: 'SETTINGS_NOTIFICATIONS_SAVE_FAILED',
      });
    }
  })
);

/**
 * GET /api/settings/notifications/email
 * Get email notification category preferences used by Email & Digest settings.
 */
router.get(
  '/notifications/email',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
      await ensureUserPreferencesTable();

      const prefs = await dbGet<{ preferences_data: string }>(
        `SELECT value AS preferences_data FROM user_preferences WHERE user_id = ? AND key = ?`,
        [userId, preferencesKey('notification-email')],
        { fallback: false }
      );

      if (prefs?.preferences_data) {
        return res.json({
          ...defaultEmailNotificationPreferences,
          ...JSON.parse(prefs.preferences_data),
        });
      }

      return res.json(defaultEmailNotificationPreferences);
    } catch (err: any) {
      logger.warn('[settings] Error fetching email notification preferences, degrading', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.json({ ...defaultEmailNotificationPreferences, degraded: true });
    }
  })
);

/**
 * PUT /api/settings/notifications/email
 * Update email notification category preferences used by Email & Digest settings.
 */
router.put(
  '/notifications/email',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
      await ensureUserPreferencesTable();

      const preferences = {
        ...defaultEmailNotificationPreferences,
        ...(req.body && typeof req.body === 'object' ? req.body : {}),
      };
      const result = await upsertUserPreferenceValue(
        userId,
        preferencesKey('notification-email'),
        JSON.stringify(preferences)
      );
      if (!result.success) throw new Error(result.error || 'Failed to save preference');

      logger.info(`[settings] Email notification preferences updated for user ${userId}`);
      return res.json({ success: true, preferences });
    } catch (err: any) {
      logger.error('[settings] Error updating email notification preferences:', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się zapisać preferencji powiadomień e-mail',
        code: 'SETTINGS_EMAIL_NOTIFICATIONS_UPDATE_FAILED',
      });
    }
  })
);

// ===========================================
// NOTIFICATION SOUNDS
// ===========================================

const defaultSoundPreferences = {
  soundEnabled: true,
  soundPerType: {},
  desktopPosition: 'top-right',
  desktopDuration: 5000,
};

/**
 * GET /api/settings/notifications/sounds
 * Get sound/desktop notification settings
 */
router.get(
  '/notifications/sounds',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
      await ensureUserPreferencesTable();

      const prefs = await dbGet<{ preferences_data: string }>(
        `SELECT value AS preferences_data FROM user_preferences WHERE user_id = ? AND key = ?`,
        [userId, preferencesKey('notification-sounds')],
        { fallback: false }
      );

      if (prefs?.preferences_data) {
        return res.json(JSON.parse(prefs.preferences_data));
      }

      return res.json(defaultSoundPreferences);
    } catch (err: any) {
      logger.warn('[settings] Error fetching sound preferences, degrading', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.json({ ...defaultSoundPreferences, degraded: true });
    }
  })
);

/**
 * PUT /api/settings/notifications/sounds
 * Update sound/desktop notification settings
 */
router.put(
  '/notifications/sounds',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const preferences = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
      await ensureUserPreferencesTable();

      const data = JSON.stringify(preferences || defaultSoundPreferences);
      const result = await upsertUserPreferenceValue(
        userId,
        preferencesKey('notification-sounds'),
        data
      );
      if (!result.success) throw new Error(result.error || 'Failed to save preference');

      logger.info(`[settings] Notification sounds updated for user ${userId}`);
      return res.json({ success: true });
    } catch (err: any) {
      logger.error('[settings] Error updating sound preferences:', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się zapisać dźwięków powiadomień',
        code: 'SETTINGS_SOUND_PREFERENCES_UPDATE_FAILED',
      });
    }
  })
);

// ===========================================
// NOTIFICATION DIGEST
// ===========================================

const defaultDigestPreferences = {
  frequency: 'instant',
  content: 'summary',
  format: 'html',
};

/**
 * GET /api/settings/notifications/digest
 * Get email digest preferences
 */
router.get(
  '/notifications/digest',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
      await ensureUserPreferencesTable();

      const prefs = await dbGet<{ preferences_data: string }>(
        `SELECT value AS preferences_data FROM user_preferences WHERE user_id = ? AND key = ?`,
        [userId, preferencesKey('notification-digest')],
        { fallback: false }
      );

      if (prefs?.preferences_data) {
        return res.json(JSON.parse(prefs.preferences_data));
      }

      return res.json(defaultDigestPreferences);
    } catch (err: any) {
      logger.warn('[settings] Error fetching digest preferences, degrading', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.json({ ...defaultDigestPreferences, degraded: true });
    }
  })
);

/**
 * PUT /api/settings/notifications/digest
 * Update email digest preferences
 */
router.put(
  '/notifications/digest',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const preferences = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
      await ensureUserPreferencesTable();

      const data = JSON.stringify(preferences || defaultDigestPreferences);
      const result = await upsertUserPreferenceValue(
        userId,
        preferencesKey('notification-digest'),
        data
      );
      if (!result.success) throw new Error(result.error || 'Failed to save preference');

      logger.info(`[settings] Notification digest updated for user ${userId}`);
      return res.json({ success: true });
    } catch (err: any) {
      logger.error('[settings] Error updating digest preferences:', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się zapisać podsumowania powiadomień',
        code: 'SETTINGS_DIGEST_PREFERENCES_UPDATE_FAILED',
      });
    }
  })
);

// ===========================================
// INTEGRATIONS (User-level)
// ===========================================

const defaultIntegrationProviders = [
  // Email & Communication
  { id: 'gmail', name: 'Gmail', capabilities: ['email', 'contacts'], category: 'email' },
  {
    id: 'outlook',
    name: 'Microsoft Outlook',
    capabilities: ['email', 'contacts'],
    category: 'email',
  },
  { id: 'slack', name: 'Slack', capabilities: ['messages', 'notifications'], category: 'email' },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    capabilities: ['messages', 'meetings'],
    category: 'email',
  },
  // Calendar
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    capabilities: ['events', 'reminders'],
    category: 'calendar',
  },
  {
    id: 'outlook_calendar',
    name: 'Outlook Calendar',
    capabilities: ['events', 'reminders'],
    category: 'calendar',
  },
  {
    id: 'apple_calendar',
    name: 'Apple Calendar (iCal)',
    capabilities: ['events'],
    category: 'calendar',
  },
  {
    id: 'calendly',
    name: 'Calendly',
    capabilities: ['scheduling', 'events'],
    category: 'calendar',
  },
  // Task Management
  { id: 'jira', name: 'Jira', capabilities: ['issues', 'sprints'], category: 'task_management' },
  { id: 'asana', name: 'Asana', capabilities: ['tasks', 'projects'], category: 'task_management' },
  { id: 'trello', name: 'Trello', capabilities: ['boards', 'cards'], category: 'task_management' },
  {
    id: 'clickup',
    name: 'ClickUp',
    capabilities: ['tasks', 'spaces'],
    category: 'task_management',
  },
  {
    id: 'monday',
    name: 'Monday.com',
    capabilities: ['boards', 'items'],
    category: 'task_management',
  },
  {
    id: 'notion',
    name: 'Notion',
    capabilities: ['databases', 'pages'],
    category: 'task_management',
  },
  {
    id: 'todoist',
    name: 'Todoist',
    capabilities: ['tasks', 'projects'],
    category: 'task_management',
  },
  {
    id: 'linear',
    name: 'Linear',
    capabilities: ['issues', 'projects'],
    category: 'task_management',
  },
  // Cloud Storage
  {
    id: 'google_drive',
    name: 'Google Drive',
    capabilities: ['files', 'sharing'],
    category: 'cloud_storage',
  },
  {
    id: 'onedrive',
    name: 'OneDrive',
    capabilities: ['files', 'sharing'],
    category: 'cloud_storage',
  },
  { id: 'dropbox', name: 'Dropbox', capabilities: ['files', 'sharing'], category: 'cloud_storage' },
  { id: 'box', name: 'Box', capabilities: ['files', 'workflows'], category: 'cloud_storage' },
];

type IntegrationEntry = {
  id: string;
  userId: string;
  provider: string;
  providerName: string;
  status: 'active' | 'expired' | 'revoked' | 'error' | 'pending';
  config: Record<string, any>;
  capabilities: string[];
  externalUserId?: string;
  externalWorkspaceId?: string;
  externalWorkspaceName?: string;
  lastSyncAt?: string | null;
  lastError?: string | null;
  onboardingStatus?: string | null;
  configuredFields?: string[];
  requiredFields?: string[];
  createdAt: string;
  updatedAt: string;
};

type ConnectorSchemaIntegrationRow = {
  id: string;
  connector_id: string;
  config: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const CONNECTOR_ALIAS_MAP: Record<string, string> = {
  microsoft_teams: 'teams',
  google_workspace: 'gmail',
  google: 'gmail',
};

const loadIntegrations = async (userId: string): Promise<IntegrationEntry[]> => {
  await ensureUserPreferencesTable();
  const row = await dbGet<{ preferences_data: string }>(
    `SELECT value AS preferences_data FROM user_preferences WHERE user_id = ? AND key = ?`,
    [userId, preferencesKey('integrations')],
    { fallback: false }
  );
  if (row?.preferences_data) {
    try {
      return JSON.parse(row.preferences_data) as IntegrationEntry[];
    } catch {
      return [];
    }
  }
  return [];
};

const saveIntegrations = async (userId: string, data: IntegrationEntry[]) => {
  await ensureUserPreferencesTable();
  const payload = JSON.stringify(data);
  const result = await dbRun(
    `INSERT INTO user_preferences (user_id, key, value, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id, key) DO UPDATE SET
       value = EXCLUDED.value,
       updated_at = CURRENT_TIMESTAMP`,
    [userId, preferencesKey('integrations'), payload],
    { fallback: false }
  );
  if (!result.success) throw new Error(result.error || 'Failed to save integrations');
};

function parseJsonObject(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function normalizeConnectorId(provider: string): string {
  const normalized = String(provider || '')
    .trim()
    .toLowerCase();
  return CONNECTOR_ALIAS_MAP[normalized] || normalized;
}

function getConfiguredFields(configFields: string[], config: Record<string, unknown>): string[] {
  return configFields.filter((field) => {
    const value = config[field];
    return typeof value === 'string'
      ? value.trim().length > 0
      : value !== undefined && value !== null;
  });
}

function getPendingOnboardingStatus(
  authType: string,
  configFields: string[],
  configuredFields: string[]
) {
  const hasAllRequiredFields =
    configFields.length === 0 || configuredFields.length >= configFields.length;

  if (authType === 'oauth2') {
    return hasAllRequiredFields
      ? ('pending_external_auth' as const)
      : ('pending_external_auth_or_configuration' as const);
  }

  return hasAllRequiredFields
    ? ('configuration_submitted_pending_validation' as const)
    : ('pending_configuration' as const);
}

function getConnectorConfigFields(connectorId: string, baseFields: string[]): string[] {
  return getGovernedExternalAuthConfigFields(connectorId, baseFields);
}

function mapGovernedStatusToSettingsStatus(status: string): IntegrationEntry['status'] {
  if (status === 'connected' || status === 'active') return 'active';
  if (status === 'requires_reauth') return 'expired';
  if (status === 'error' || status === 'dead_letter' || status === 'conflict') return 'error';
  if (status === 'disconnected') return 'revoked';
  return 'pending';
}

async function loadGovernedSettingsIntegrations(
  organizationId: string
): Promise<IntegrationEntry[]> {
  const cols = await getTableColumns('integrations');
  if (!cols.has('connector_id') || !cols.has('config')) {
    return [];
  }

  const governedIntegrations = await listGovernedIntegrations(organizationId);
  const rawRows = await dbAll<ConnectorSchemaIntegrationRow>(
    `SELECT id, connector_id, config, created_at, updated_at
     FROM integrations
     WHERE organization_id = ?
     ORDER BY created_at DESC`,
    [organizationId]
  );
  const rawById = new Map(rawRows.map((row) => [row.id, row]));

  return governedIntegrations.map((integration) => {
    const raw = rawById.get(integration.id);
    const config = parseJsonObject(raw?.config || null);

    return {
      id: integration.id,
      userId: organizationId,
      provider: integration.connectorId,
      providerName: integration.connector?.name || integration.name,
      status: mapGovernedStatusToSettingsStatus(integration.status),
      config,
      capabilities: integration.connector?.capabilities || [],
      externalUserId: integration.credential?.providerAccountId,
      externalWorkspaceId: integration.credential?.workspaceOrTenantId,
      externalWorkspaceName: integration.credential?.workspaceOrTenantId,
      lastSyncAt: integration.lastSyncAt,
      lastError: integration.lastError,
      onboardingStatus: integration.onboardingStatus,
      configuredFields: integration.configuredFields,
      requiredFields: integration.connector?.configFields || [],
      createdAt: raw?.created_at || raw?.updated_at || new Date().toISOString(),
      updatedAt: raw?.updated_at || raw?.created_at || new Date().toISOString(),
    };
  });
}

async function loadEffectiveSettingsIntegrations(
  userId: string,
  organizationId?: string
): Promise<IntegrationEntry[]> {
  const legacyIntegrations = await loadIntegrations(userId);
  const governedIntegrations = organizationId
    ? await loadGovernedSettingsIntegrations(organizationId).catch(() => [])
    : [];
  const governedProviders = new Set(
    governedIntegrations.map((integration) => integration.provider)
  );

  return [
    ...governedIntegrations,
    ...legacyIntegrations.filter((integration) => !governedProviders.has(integration.provider)),
  ];
}

async function loadSettingsIntegrationSyncLogs(integrationId: string, limit: number) {
  const cols = await getTableColumns('integration_sync_log');
  if (!cols.size) return [];

  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const hasNewCols = cols.has('items_processed') || cols.has('trigger_type');
  const rows = await dbAll<any>(
    hasNewCols
      ? `SELECT id, status, sync_type, direction, trigger_type, items_processed, items_created, items_updated, items_failed, error_summary, error_details, started_at, completed_at, duration_ms
         FROM integration_sync_log WHERE integration_id = ? ORDER BY started_at DESC LIMIT ${safeLimit}`
      : `SELECT id, status, sync_type, direction, items_synced, items_failed, error_details, started_at, completed_at, duration_ms
         FROM integration_sync_log WHERE integration_id = ? ORDER BY started_at DESC LIMIT ${safeLimit}`,
    [integrationId]
  );

  return (rows || []).map((row) =>
    hasNewCols
      ? {
          id: row.id,
          status: row.status,
          syncType: row.sync_type,
          direction: row.direction,
          syncScope:
            String(row.direction || '').toLowerCase() === 'bidirectional'
              ? 'bidirectional'
              : 'read_only',
          syncScopeLabel:
            String(row.direction || '').toLowerCase() === 'bidirectional'
              ? 'Bidirectional sync'
              : 'Read-only sync',
          triggerType: row.trigger_type,
          itemsProcessed: row.items_processed ?? 0,
          itemsCreated: row.items_created ?? 0,
          itemsUpdated: row.items_updated ?? 0,
          itemsFailed: row.items_failed ?? 0,
          errorSummary: row.error_summary ?? null,
          errorDetails: row.error_details
            ? (() => {
                try {
                  return JSON.parse(row.error_details);
                } catch {
                  return row.error_details;
                }
              })()
            : null,
          startedAt: row.started_at,
          completedAt: row.completed_at,
          durationMs: row.duration_ms ?? 0,
        }
      : {
          id: row.id,
          status: row.status,
          syncType: row.sync_type,
          direction: row.direction,
          syncScope:
            String(row.direction || '').toLowerCase() === 'bidirectional'
              ? 'bidirectional'
              : 'read_only',
          syncScopeLabel:
            String(row.direction || '').toLowerCase() === 'bidirectional'
              ? 'Bidirectional sync'
              : 'Read-only sync',
          itemsProcessed: row.items_synced ?? 0,
          itemsFailed: row.items_failed ?? 0,
          errorDetails: row.error_details
            ? (() => {
                try {
                  return JSON.parse(row.error_details);
                } catch {
                  return row.error_details;
                }
              })()
            : null,
          startedAt: row.started_at,
          completedAt: row.completed_at,
          durationMs: row.duration_ms ?? 0,
        }
  );
}

/**
 * GET /api/settings/integrations
 */
router.get(
  '/integrations',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const organizationId = req.organizationId || req.user?.organizationId;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    const integrations = await loadEffectiveSettingsIntegrations(userId, organizationId);
    const connectedCount = integrations.filter((i) => i.status === 'active').length;
    const providers = defaultIntegrationProviders.map((provider) => {
      const connection =
        integrations.find((integration) => integration.provider === provider.id) || null;
      return {
        ...provider,
        isConnected: connection?.status === 'active',
        connection,
      };
    });

    return res.json({
      integrations,
      providers,
      connectedCount,
    });
  })
);

/**
 * POST /api/settings/integrations/:provider/connect
 */
router.post(
  '/integrations/:provider/connect',
  verifyToken,
  requireActiveAuditsMembership,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const organizationId = req.organizationId || req.user?.organizationId;
    const { provider } = req.params;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    const providers = defaultIntegrationProviders;
    const providerMeta = providers.find((p) => p.id === provider);
    if (!providerMeta) return res.status(404).json({ error: 'Provider not found' });

    const connectorId = normalizeConnectorId(provider);
    const connector = organizationId ? CONNECTORS[connectorId] : undefined;

    if (organizationId && connector) {
      const connectorConfigFields = getConnectorConfigFields(connector.id, connector.configFields);
      const config = parseJsonObject(req.body?.config);
      const configuredFields = getConfiguredFields(connectorConfigFields, config);
      const onboardingStatus = getPendingOnboardingStatus(
        connector.authType,
        connectorConfigFields,
        configuredFields
      );
      const scopes = connector.capabilities.map((capability) => `read:${capability}`);
      const integrationId = `${connector.id}-${organizationId}-${Date.now()}`;

      // Governed-connector approval MUST be consulted before any write (pending
      // row, ownership row, connection log, connecting-state transition, or
      // consent URL). buildGovernedExternalAuthSession throws (fail closed) via
      // its internal requireApprovedGovernedConnector guard when the connector
      // is not registry-approved, so this call happening first means a denied
      // provider never leaves a pending integration or a 'connecting' state
      // transition behind.
      const willAttemptExternalAuth =
        connector.authType === 'oauth2' && onboardingStatus === 'pending_external_auth';
      const preparedExternalAuth = willAttemptExternalAuth
        ? buildGovernedExternalAuthSession(req, {
            integrationId,
            organizationId,
            connectorId: connector.id,
            mode: 'connect',
            config,
          })
        : null;

      await dbRun(
        `INSERT INTO integrations (
          id, organization_id, connector_id, name, category,
          status, config, capabilities, auth_type, connected_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          integrationId,
          organizationId,
          connector.id,
          providerMeta.name,
          connector.category,
          'pending',
          JSON.stringify(config),
          JSON.stringify(scopes),
          connector.authType,
          // Audit identity: bound ONLY to the verified token's userId (checked
          // non-empty by the `if (!userId) return res.status(401)` guard above,
          // before any of this handler's writes run). Never sourced from
          // req.body — a spoofable connected_by is not an audit identity.
          userId,
        ]
      );
      await setIntegrationOwner({ integrationId, organizationId, ownerUserId: userId });
      await logIntegrationConnectionEvent({
        organizationId,
        userId,
        integrationId,
        connectorId: connector.id,
        eventType: 'connect_initiated',
        metadata: { source: 'settings', provider: connector.id },
        ipAddress: typeof req.ip === 'string' ? req.ip : null,
        userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
      });

      const integrations = await loadIntegrations(userId);
      await saveIntegrations(
        userId,
        integrations.filter((integration) => integration.provider !== provider)
      );

      let authUrl: string | null = null;
      if (willAttemptExternalAuth && preparedExternalAuth) {
        await setConnectorAuthState({
          connectorId: connector.id,
          organizationId,
          targetState: 'connecting',
          transitionedBy: userId,
          reason: 'settings_integrations_connect_initiated',
        });
        authUrl = preparedExternalAuth.authUrl;
        await logIntegrationConnectionEvent({
          organizationId,
          userId,
          integrationId,
          connectorId: connector.id,
          eventType: 'external_auth_prepared',
          metadata: {
            source: 'settings',
            mode: 'connect',
            callbackUrl: preparedExternalAuth.callbackUrl,
            expiresAt: preparedExternalAuth.expiresAt,
          },
          ipAddress: typeof req.ip === 'string' ? req.ip : null,
          userAgent:
            typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
        });
      }

      return res.json({
        success: true,
        id: integrationId,
        onboardingStatus,
        authUrl,
      });
    }

    const integrations = await loadIntegrations(userId);
    const now = new Date().toISOString();
    const entry: IntegrationEntry = {
      id: `${provider}-${userId}`,
      userId,
      provider,
      providerName: providerMeta.name,
      status: 'active',
      config: {},
      capabilities: providerMeta.capabilities,
      createdAt: now,
      updatedAt: now,
    };

    const filtered = integrations.filter((i) => i.provider !== provider);
    filtered.push(entry);
    await saveIntegrations(userId, filtered);

    return res.json({ success: true, authUrl: null });
  })
);

/**
 * DELETE /api/settings/integrations/:provider
 */
router.delete(
  '/integrations/:provider',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const organizationId = req.organizationId || req.user?.organizationId;
    const { provider } = req.params;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    const connectorId = normalizeConnectorId(provider);
    const connector = organizationId ? CONNECTORS[connectorId] : undefined;
    if (organizationId && connector) {
      const rows = await dbAll<{ id: string }>(
        `SELECT id
         FROM integrations
         WHERE organization_id = ? AND connector_id = ? AND status != ?
         ORDER BY created_at DESC
         LIMIT 1`,
        [organizationId, connector.id, 'disconnected']
      );
      const activeIntegration = rows[0];
      if (activeIntegration) {
        await disconnectIntegration(activeIntegration.id);
      }
    }

    const integrations = await loadIntegrations(userId);
    const filtered = integrations.filter((i) => i.provider !== provider);
    await saveIntegrations(userId, filtered);

    return res.json({ success: true });
  })
);

/**
 * POST /api/settings/integrations/:provider/test
 */
router.post(
  '/integrations/:provider/test',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const organizationId = req.organizationId || req.user?.organizationId;
    const { provider } = req.params;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    const oauthResult = await oauthEngine.testConnection(userId, provider);
    if (oauthResult.success) {
      return res.json({ success: true });
    }

    const integrations = await loadEffectiveSettingsIntegrations(userId, organizationId);
    const item = integrations.find((integration) => integration.provider === provider);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, error: oauthResult.error || 'Integration not connected' });
    }

    if (item.status !== 'active') {
      return res.status(409).json({
        success: false,
        error:
          item.status === 'pending'
            ? 'Integration is not fully connected yet'
            : item.status === 'expired'
              ? 'Integration requires reauthorization'
              : item.status === 'revoked'
                ? 'Integration is disconnected'
                : item.lastError || 'Integration is not healthy enough to test',
      });
    }

    return res.json({ success: true });
  })
);

// ===========================================
// OAuth 2.0 Integration Flow
// ===========================================

/**
 * GET /api/settings/integrations/oauth/start/:connectorId
 * Generates authorization URL and redirects the user.
 */
router.get(
  '/integrations/oauth/start/:connectorId',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const organizationId = req.organizationId || req.user?.organizationId;
    const { connectorId } = req.params;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    const cfg = oauthEngine.getConnectorConfig(connectorId);
    if (!cfg) {
      return res.status(404).json({ error: 'Unknown connector' });
    }

    if (cfg.authType === 'basic') {
      return res.status(400).json({
        error:
          'This connector uses credential-based auth, not OAuth. Use POST /connect with credentials.',
      });
    }

    if (
      (cfg.authType === 'oauth2' || cfg.authType === 'token') &&
      !oauthEngine.isConnectorApproved(connectorId)
    ) {
      return res.status(409).json({
        error: 'OAuth provider is disabled until scopes and residency are approved',
        code: 'OAUTH_PROVIDER_NOT_APPROVED',
      });
    }

    const result = oauthEngine.generateAuthUrl(connectorId, userId, organizationId);
    if (!result) {
      return res
        .status(503)
        .json({ error: 'Connector not configured. Missing API credentials in environment.' });
    }

    await logIntegrationConnectionEvent({
      organizationId: organizationId || 'unknown',
      userId,
      integrationId: `${connectorId}-${userId}`,
      connectorId,
      eventType: 'connect_initiated',
      metadata: { source: 'oauth_engine', connectorId },
      ipAddress: typeof req.ip === 'string' ? req.ip : null,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
    });

    return res.json({ authUrl: result.url, state: result.state });
  })
);

/**
 * GET /api/settings/integrations/oauth/callback
 * Handles the OAuth callback from the provider.
 */
router.get(
  '/integrations/oauth/callback',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { code, state, error: oauthError } = req.query as Record<string, string>;

    if (oauthError) {
      logger.warn(`[OAuth callback] Provider returned error: ${oauthError}`);
      return res.redirect('/settings/integrations?oauth_error=' + encodeURIComponent(oauthError));
    }

    if (!state) {
      return res.redirect('/settings/integrations?oauth_error=missing_state');
    }

    const pending = oauthEngine.consumeState(state);
    if (!pending) {
      return res.redirect('/settings/integrations?oauth_error=invalid_or_expired_state');
    }

    if (!code) {
      return res.redirect('/settings/integrations?oauth_error=missing_code');
    }

    const tokens = await oauthEngine.exchangeCode(pending.connectorId, code);
    if (!tokens) {
      return res.redirect(
        `/settings/integrations?oauth_error=token_exchange_failed&connector=${pending.connectorId}`
      );
    }

    const cfg = oauthEngine.getConnectorConfig(pending.connectorId);
    await oauthEngine.storeTokens(pending.userId, pending.connectorId, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      scopes: cfg?.scopes.join(' '),
      extraData: tokens.raw,
    });

    const now = new Date().toISOString();
    const integrations = await loadIntegrations(pending.userId);
    const providerMeta = defaultIntegrationProviders.find((p) => p.id === pending.connectorId);
    const entry: IntegrationEntry = {
      id: `${pending.connectorId}-${pending.userId}`,
      userId: pending.userId,
      provider: pending.connectorId,
      providerName: providerMeta?.name || cfg?.name || pending.connectorId,
      status: 'active',
      config: {},
      capabilities: providerMeta?.capabilities || [],
      createdAt: now,
      updatedAt: now,
    };
    const filtered = integrations.filter((i) => i.provider !== pending.connectorId);
    filtered.push(entry);
    await saveIntegrations(pending.userId, filtered);

    if (pending.organizationId) {
      await setIntegrationOwner({
        integrationId: entry.id,
        organizationId: pending.organizationId,
        ownerUserId: pending.userId,
      });
    }

    await logIntegrationConnectionEvent({
      organizationId: pending.organizationId || 'unknown',
      userId: pending.userId,
      integrationId: entry.id,
      connectorId: pending.connectorId,
      eventType: 'external_auth_callback_received',
      metadata: { source: 'oauth_engine', hasRefreshToken: !!tokens.refreshToken },
    });

    return res.redirect(`/settings/integrations?oauth_success=${pending.connectorId}`);
  })
);

/**
 * POST /api/settings/integrations/:connectorId/oauth-disconnect
 * Disconnect an OAuth-connected integration.
 */
router.post(
  '/integrations/:connectorId/oauth-disconnect',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { connectorId } = req.params;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await oauthEngine.disconnectIntegration(userId, connectorId);

    const integrations = await loadIntegrations(userId);
    const filtered = integrations.filter((i) => i.provider !== connectorId);
    await saveIntegrations(userId, filtered);

    await logIntegrationConnectionEvent({
      organizationId: req.organizationId || req.user?.organizationId || 'unknown',
      userId,
      integrationId: `${connectorId}-${userId}`,
      connectorId,
      eventType: 'disconnect_requested',
      metadata: { source: 'oauth_engine' },
    });

    return res.json({ success: true });
  })
);

/**
 * POST /api/settings/integrations/:connectorId/oauth-test
 * Test an OAuth-connected integration by calling the provider's API.
 */
router.post(
  '/integrations/:connectorId/oauth-test',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { connectorId } = req.params;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    const result = await oauthEngine.testConnection(userId, connectorId);
    return res.json(result);
  })
);

/**
 * GET /api/settings/integrations/oauth/status
 * Get OAuth connection status for all connectors for the current user.
 */
router.get(
  '/integrations/oauth/status',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId)
      return res.status(401).json({ error: 'User not authenticated', code: 'AUTH_REQUIRED' });

    const connected = await oauthEngine.listConnectedIntegrations(userId);
    const availability = oauthEngine.getConnectorAvailability();

    return res.json({ connected, availability });
  })
);

/**
 * POST /api/settings/integrations/:connectorId/basic-connect
 * Connect via credentials (for CalDAV / Apple Calendar).
 */
router.post(
  '/integrations/:connectorId/basic-connect',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { connectorId } = req.params;
    const { username, password, serverUrl } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    const cfg = oauthEngine.getConnectorConfig(connectorId);
    if (!cfg || cfg.authType !== 'basic') {
      return res.status(400).json({ error: 'This connector does not use basic auth' });
    }

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    await oauthEngine.storeTokens(userId, connectorId, {
      accessToken: Buffer.from(`${username}:${password}`).toString('base64'),
      extraData: { username, serverUrl: serverUrl || 'https://caldav.icloud.com/' },
    });

    const providerMeta = defaultIntegrationProviders.find((p) => p.id === connectorId);
    const now = new Date().toISOString();
    const integrations = await loadIntegrations(userId);
    const entry: IntegrationEntry = {
      id: `${connectorId}-${userId}`,
      userId,
      provider: connectorId,
      providerName: providerMeta?.name || cfg.name,
      status: 'active',
      config: { serverUrl: serverUrl || 'https://caldav.icloud.com/' },
      capabilities: providerMeta?.capabilities || [],
      createdAt: now,
      updatedAt: now,
    };
    const filtered = integrations.filter((i) => i.provider !== connectorId);
    filtered.push(entry);
    await saveIntegrations(userId, filtered);

    await logIntegrationConnectionEvent({
      organizationId: req.organizationId || req.user?.organizationId || 'unknown',
      userId,
      integrationId: `${connectorId}-${userId}`,
      connectorId,
      eventType: 'connect_initiated',
      metadata: { source: 'basic_auth', connectorId },
    });

    return res.json({ success: true });
  })
);

/**
 * POST /api/settings/integrations/:provider/refresh
 */
router.post(
  '/integrations/:provider/refresh',
  verifyToken,
  requireActiveAuditsMembership,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const organizationId = req.organizationId || req.user?.organizationId;
    const { provider } = req.params;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    const effectiveIntegrations = await loadEffectiveSettingsIntegrations(userId, organizationId);
    const item = effectiveIntegrations.find((integration) => integration.provider === provider);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Integration not connected' });
    }

    const connectorId = normalizeConnectorId(provider);
    const connector = CONNECTORS[connectorId];
    if (!organizationId || !connector || !item.id) {
      return res.json({ success: true });
    }

    if (connector.authType !== 'oauth2') {
      return res.status(409).json({
        success: false,
        error: 'Integration does not support governed token refresh',
      });
    }

    const connectorConfigFields = getConnectorConfigFields(connector.id, connector.configFields);
    const config = parseJsonObject(item.config);
    const configuredFields = getConfiguredFields(connectorConfigFields, config);
    const onboardingStatus = getPendingOnboardingStatus(
      connector.authType,
      connectorConfigFields,
      configuredFields
    );

    if (onboardingStatus !== 'pending_external_auth') {
      return res.status(409).json({
        success: false,
        error: 'Integration configuration is incomplete',
        onboardingStatus,
      });
    }

    // Approval must be consulted before the pending-status write or the
    // connecting-state transition, so a denied connector leaves no trace.
    const externalAuth = buildGovernedExternalAuthSession(req, {
      integrationId: item.id,
      organizationId,
      connectorId: connector.id,
      mode: 'reauth',
      config,
    });

    await updateIntegrationStatus(item.id, 'pending');
    await setConnectorAuthState({
      connectorId: connector.id,
      organizationId,
      targetState: 'connecting',
      transitionedBy: userId,
      reason: 'settings_integrations_refresh_started',
    });

    return res.json({
      success: true,
      message: 'Re-authorization initiated',
      onboardingStatus,
      authUrl: externalAuth.authUrl,
    });
  })
);

/**
 * PUT /api/settings/integrations/:provider/config
 */
router.put(
  '/integrations/:provider/config',
  verifyToken,
  requireActiveAuditsMembership,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const organizationId = req.organizationId || req.user?.organizationId;
    const { provider } = req.params;
    const config = parseJsonObject(req.body?.config);
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    const effectiveIntegrations = await loadEffectiveSettingsIntegrations(userId, organizationId);
    const item = effectiveIntegrations.find((integration) => integration.provider === provider);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Integration not connected' });
    }

    const connectorId = normalizeConnectorId(provider);
    const connector = CONNECTORS[connectorId];
    if (!organizationId || !connector || !item.id) {
      const integrations = await loadIntegrations(userId);
      const updated = integrations.map((integration) =>
        integration.provider === provider
          ? { ...integration, config, updatedAt: new Date().toISOString() }
          : integration
      );
      await saveIntegrations(userId, updated);
      return res.json({ success: true });
    }

    const connectorConfigFields = getConnectorConfigFields(connector.id, connector.configFields);
    const nextConfig = { ...parseJsonObject(item.config) };
    for (const field of connectorConfigFields) {
      if (Object.prototype.hasOwnProperty.call(config, field)) {
        nextConfig[field] = config[field];
      }
    }

    const configuredFields = getConfiguredFields(connectorConfigFields, nextConfig);
    const onboardingStatus = getPendingOnboardingStatus(
      connector.authType,
      connectorConfigFields,
      configuredFields
    );

    // When this configuration update would also trigger a governed external
    // auth attempt, the approval decision must be consulted before the
    // config write (which can carry credential fields like client_secret)
    // and before the connecting-state transition — never after.
    const willAttemptExternalAuth =
      connector.authType === 'oauth2' && onboardingStatus === 'pending_external_auth';
    const preparedExternalAuth = willAttemptExternalAuth
      ? buildGovernedExternalAuthSession(req, {
          integrationId: item.id,
          organizationId,
          connectorId: connector.id,
          mode: 'connect',
          config: nextConfig,
        })
      : null;

    await dbRun(
      `UPDATE integrations
       SET config = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND organization_id = ?`,
      [JSON.stringify(nextConfig), item.id, organizationId]
    );

    let authUrl: string | null = null;
    if (willAttemptExternalAuth && preparedExternalAuth) {
      await setConnectorAuthState({
        connectorId: connector.id,
        organizationId,
        targetState: 'connecting',
        transitionedBy: userId,
        reason: 'settings_integrations_configured',
      });
      authUrl = preparedExternalAuth.authUrl;
    }

    return res.json({
      success: true,
      onboardingStatus,
      authUrl,
      integration: {
        id: item.id,
        provider,
        status: 'pending',
        config: nextConfig,
        configuredFields,
        requiredFields: connectorConfigFields,
      },
    });
  })
);

/**
 * GET /api/settings/integrations/:provider/status
 */
router.get(
  '/integrations/:provider/status',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const organizationId = req.organizationId || req.user?.organizationId;
    const { provider } = req.params;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    const integrations = await loadEffectiveSettingsIntegrations(userId, organizationId);
    const item = integrations.find((i) => i.provider === provider);
    return res.json({ status: item ? { ...item, isConnected: item.status === 'active' } : null });
  })
);

/**
 * GET /api/settings/integrations/:provider/logs
 */
router.get(
  '/integrations/:provider/logs',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const organizationId = req.organizationId || req.user?.organizationId;
    const { provider } = req.params;
    const rawLimit = parseInt(String(req.query.limit || '50'), 10);
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    const integrations = await loadEffectiveSettingsIntegrations(userId, organizationId);
    const item = integrations.find((integration) => integration.provider === provider);
    if (!item) {
      return res.status(404).json({ logs: [], error: 'Integration not connected' });
    }

    const logs = item.id ? await loadSettingsIntegrationSyncLogs(item.id, rawLimit) : [];
    return res.json({ logs });
  })
);

// ===========================================
// CALENDAR SYNC
// ===========================================

type CalendarConnection = {
  provider: string;
  connected: boolean;
  externalEmail?: string;
  calendarName?: string;
  lastSyncAt?: string;
  syncTasks?: boolean;
  syncMeetings?: boolean;
};

const loadCalendarConnections = async (userId: string): Promise<CalendarConnection[]> => {
  await ensureUserPreferencesTable();
  const row = await dbGet<{ preferences_data: string }>(
    `SELECT value AS preferences_data FROM user_preferences WHERE user_id = ? AND key = ?`,
    [userId, preferencesKey('calendar-connections')],
    { fallback: false }
  );
  if (row?.preferences_data) {
    try {
      return JSON.parse(row.preferences_data) as CalendarConnection[];
    } catch {
      return [];
    }
  }
  return [];
};

const saveCalendarConnections = async (userId: string, data: CalendarConnection[]) => {
  await ensureUserPreferencesTable();
  const payload = JSON.stringify(data);
  const result = await upsertUserPreferenceValue(
    userId,
    preferencesKey('calendar-connections'),
    payload
  );
  if (!result.success) throw new Error(result.error || 'Failed to save calendar connections');
};

/**
 * GET /api/settings/calendar/providers
 */
router.get(
  '/calendar/providers',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    const connections = await loadCalendarConnections(userId);
    const providers = ['google', 'outlook', 'apple'].map((id) => {
      const existing = connections.find((c) => c.provider === id);
      return {
        id,
        name: id === 'google' ? 'Google Calendar' : id === 'outlook' ? 'Outlook' : 'Apple Calendar',
        icon: id === 'google' ? '📅' : id === 'outlook' ? '📆' : '🍎',
        connected: !!existing?.connected,
        connection: existing || null,
      };
    });

    return res.json({ providers });
  })
);

/**
 * POST /api/settings/calendar/connect
 */
router.post(
  '/calendar/connect',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { provider } = req.body;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });
    if (!provider) return res.status(400).json({ error: 'provider required' });

    // Real calendar OAuth is not implemented yet. Previously this endpoint faked a
    // successful connection (wrote connected: true with authUrl: null), which misled
    // the UI into showing a working integration. Until a genuine OAuth flow exists,
    // do NOT pretend the calendar connected — report that the feature is unavailable.
    return res.status(501).json({
      success: false,
      available: false,
      error: 'Calendar integrations are not available yet.',
    });
  })
);

/**
 * POST /api/settings/calendar/disconnect
 */
router.post(
  '/calendar/disconnect',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { provider } = req.body;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });
    if (!provider) return res.status(400).json({ error: 'provider required' });

    const connections = await loadCalendarConnections(userId);
    const updated = connections.filter((c) => c.provider !== provider);
    await saveCalendarConnections(userId, updated);

    return res.json({ success: true });
  })
);

/**
 * GET /api/settings/calendar/settings
 */
router.get(
  '/calendar/settings',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await ensureUserPreferencesTable();
    const row = await dbGet<{ preferences_data: string }>(
      `SELECT value AS preferences_data FROM user_preferences WHERE user_id = ? AND key = ?`,
      [userId, preferencesKey('calendar-settings')],
      { fallback: false }
    );
    if (row?.preferences_data) {
      try {
        return res.json(JSON.parse(row.preferences_data));
      } catch {
        // fallthrough
      }
    }

    return res.json({ syncTasks: true, syncMeetings: true });
  })
);

/**
 * PUT /api/settings/calendar/settings
 */
router.put(
  '/calendar/settings',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const preferences = req.body || {};
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await ensureUserPreferencesTable();
    const payload = JSON.stringify(preferences);
    const result = await upsertUserPreferenceValue(
      userId,
      preferencesKey('calendar-settings'),
      payload
    );
    if (!result.success) throw new Error(result.error || 'Failed to save preference');

    return res.json({ success: true });
  })
);

// ===========================================
// PRIVACY PREFERENCES
// ===========================================

const defaultPrivacyPreferences = {
  showOnlineStatus: true,
  activityVisibility: 'team',
  profileVisibility: 'organization',
  allowMentions: true,
  showInDirectory: true,
  shareActivityWithAI: true,
};

/**
 * GET /api/settings/preferences/privacy
 */
router.get(
  '/preferences/privacy',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await ensureUserPreferencesTable();
    const row = await dbGet<{ preferences_data: string }>(
      `SELECT value AS preferences_data FROM user_preferences WHERE user_id = ? AND key = ?`,
      [userId, preferencesKey('privacy')],
      { fallback: false }
    );
    if (row?.preferences_data) {
      try {
        return res.json({ preferences: JSON.parse(row.preferences_data) });
      } catch {
        return res.status(500).json({
          error: 'Stored AI memory preferences are invalid',
          code: 'AI_MEMORY_PREFERENCES_INVALID_STORE',
        });
      }
    }
    return res.json({ preferences: defaultPrivacyPreferences });
  })
);

/**
 * PUT /api/settings/preferences/privacy
 */
router.put(
  '/preferences/privacy',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { preferences } = req.body || {};

    if (!userId) return res.status(401).json({ error: 'User not authenticated' });
    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ error: 'Invalid preferences payload' });
    }

    await ensureUserPreferencesTable();
    const payload = JSON.stringify(preferences);
    const result = await upsertUserPreferenceValue(userId, preferencesKey('privacy'), payload);
    if (!result.success) throw new Error(result.error || 'Failed to save preference');

    await logSettingsChange(userId, 'privacy', 'preferences', 'updated', null, preferences);
    logger.info(`[settings] Privacy preferences updated for user ${userId}`);
    return res.json({ success: true });
  })
);

// ===========================================
// ACCESSIBILITY PREFERENCES
// ===========================================

const defaultAccessibilityPreferences = {
  fontSize: 'medium',
  highContrastMode: false,
  reduceMotion: false,
  underlineLinks: false,
  colorBlindMode: 'none',
  lineHeight: 'default',
  letterSpacing: 'default',
  fontFamily: 'system',
  textSpacing: 'default',
  textCursorWidth: 'default',
  showShortcuts: true,
  focusIndicator: 'default',
  cursorSize: 'default',
  screenReaderOptimized: false,
  voiceCommands: false,
  speechToText: false,
  textToSpeech: false,
};

router.get(
  '/preferences/accessibility',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await ensureUserPreferencesTable();
    const row = await dbGet<{ preferences_data: string }>(
      `SELECT value AS preferences_data FROM user_preferences WHERE user_id = ? AND key = ?`,
      [userId, preferencesKey('accessibility')],
      { fallback: false }
    );
    if (row?.preferences_data) {
      try {
        return res.json({ preferences: JSON.parse(row.preferences_data) });
      } catch {
        // fallthrough
      }
    }
    return res.json({ preferences: defaultAccessibilityPreferences });
  })
);

router.put(
  '/preferences/accessibility',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { preferences } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });
    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ error: 'Invalid preferences payload' });
    }

    await ensureUserPreferencesTable();
    const payload = JSON.stringify(preferences);
    const result = await upsertUserPreferenceValue(
      userId,
      preferencesKey('accessibility'),
      payload
    );
    if (!result.success) throw new Error(result.error || 'Failed to save preference');

    logger.info(`[settings] Accessibility preferences updated for user ${userId}`);
    return res.json({ success: true });
  })
);

// ===========================================
// KEYBOARD SHORTCUTS
// ===========================================

const defaultShortcuts = {
  aiAssistant: 'cmd+j',
  aiSummarize: 'cmd+shift+s',
  toggleSidebar: 'cmd+\\',
  notifications: 'n n',
  help: '?',
};

router.get(
  '/preferences/shortcuts',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await ensureUserPreferencesTable();
    const row = await dbGet<{ preferences_data: string }>(
      `SELECT value AS preferences_data FROM user_preferences WHERE user_id = ? AND key = ?`,
      [userId, preferencesKey('shortcuts')],
      { fallback: false }
    );
    if (row?.preferences_data) {
      try {
        return res.json({ preferences: JSON.parse(row.preferences_data) });
      } catch {
        // fallthrough
      }
    }
    return res.json({ preferences: defaultShortcuts });
  })
);

router.put(
  '/preferences/shortcuts',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const shortcuts = req.body;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });
    if (!shortcuts || typeof shortcuts !== 'object') {
      return res.status(400).json({ error: 'Invalid shortcuts payload' });
    }

    await ensureUserPreferencesTable();
    const payload = JSON.stringify(shortcuts);
    const result = await upsertUserPreferenceValue(userId, preferencesKey('shortcuts'), payload);
    if (!result.success) throw new Error(result.error || 'Failed to save preference');

    logger.info(`[settings] Shortcuts updated for user ${userId}`);
    return res.json({ success: true });
  })
);

// ===========================================
// DATA EXPORT & ACCOUNT DELETION (GDPR)
// ===========================================

/**
 * POST /api/settings/export-data
 * Create data export request
 */
router.post(
  '/export-data',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    const { format, include } = req.body || {};
    logger.info(`[settings] Export requested by user ${userId} format=${format || 'json'}`);

    const request = await createDataExportRequest({
      userId,
      organizationId: req.organizationId,
      format,
      include,
    });

    return res.status(202).json({ success: true, request });
  })
);

// ===========================================
// GDPR CONSENTS & RETENTION
// ===========================================

const defaultConsents = {
  usageAnalytics: true,
  personalization: true,
  marketingCommunications: false,
  thirdPartySharing: false,
  aiTraining: true,
};

const defaultRetention = {
  period: '365d',
};

router.get(
  '/gdpr/consents',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await ensureUserPreferencesTable();
    const row = await dbGet<{ preferences_data: string }>(
      `SELECT value AS preferences_data FROM user_preferences WHERE user_id = ? AND key = ?`,
      [userId, preferencesKey('gdpr-consents')],
      { fallback: false }
    );
    if (row?.preferences_data) {
      try {
        return res.json({ consents: JSON.parse(row.preferences_data) });
      } catch {
        // fallthrough
      }
    }
    return res.json({ consents: defaultConsents });
  })
);

router.put(
  '/gdpr/consents',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { consents } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });
    if (!consents || typeof consents !== 'object')
      return res.status(400).json({ error: 'Invalid consents payload' });

    await ensureUserPreferencesTable();
    const payload = JSON.stringify(consents);
    const result = await upsertUserPreferenceValue(
      userId,
      preferencesKey('gdpr-consents'),
      payload
    );
    if (!result.success) throw new Error(result.error || 'Failed to save preference');

    await logSettingsChange(userId, 'privacy', 'gdpr-consents', 'updated', null, consents);
    return res.json({ success: true });
  })
);

router.get(
  '/gdpr/retention',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await ensureUserPreferencesTable();
    const row = await dbGet<{ preferences_data: string }>(
      `SELECT value AS preferences_data FROM user_preferences WHERE user_id = ? AND key = ?`,
      [userId, preferencesKey('gdpr-retention')],
      { fallback: false }
    );
    if (row?.preferences_data) {
      try {
        return res.json({ retention: JSON.parse(row.preferences_data) });
      } catch {
        // fallthrough
      }
    }
    return res.json({ retention: defaultRetention });
  })
);

router.put(
  '/gdpr/retention',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { retention } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });
    if (!retention || typeof retention !== 'object') {
      return res.status(400).json({ error: 'Invalid retention payload' });
    }

    await ensureUserPreferencesTable();
    const payload = JSON.stringify(retention);
    const result = await upsertUserPreferenceValue(
      userId,
      preferencesKey('gdpr-retention'),
      payload
    );
    if (!result.success) throw new Error(result.error || 'Failed to save preference');

    await logSettingsChange(userId, 'privacy', 'gdpr-retention', 'updated', null, retention);
    return res.json({ success: true });
  })
);

// ===========================================
// GDPR REQUESTS TABLE
// ===========================================

const ensureGdprRequestsTable = async () => {
  await dbRun(`
        CREATE TABLE IF NOT EXISTS gdpr_requests (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            type TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            reason TEXT,
            download_url TEXT,
            file_path TEXT,
            expires_at TEXT,
            scheduled_at TEXT,
            processed_at TEXT,
            completed_at TEXT,
            error_message TEXT,
            metadata TEXT DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);
};

/**
 * GET /api/settings/gdpr/export-status
 * Check status of user's export requests
 */
router.get(
  '/gdpr/export-status',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await ensureGdprRequestsTable();

    const request = await dbGet<{
      id: string;
      status: string;
      download_url: string;
      expires_at: string;
      created_at: string;
    }>(
      `SELECT id, status, download_url, expires_at, created_at 
             FROM gdpr_requests 
             WHERE user_id = ? AND type = 'export' 
             ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (!request) {
      return res.json({ request: null });
    }

    return res.json({
      request: {
        id: request.id,
        status: request.status,
        downloadUrl: request.download_url,
        expiresAt: request.expires_at,
        requestedAt: request.created_at,
      },
    });
  })
);

/**
 * POST /api/settings/gdpr/export-request
 * Create a new data export request
 */
router.post(
  '/gdpr/export-request',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await ensureGdprRequestsTable();
    await ensureUserPreferencesTable();

    // Check for existing pending request
    const existingRequest = await dbGet(
      `SELECT id FROM gdpr_requests WHERE user_id = ? AND type = 'export' AND status IN ('pending', 'processing')`,
      [userId]
    );

    if (existingRequest) {
      return res.status(400).json({ error: 'An export request is already in progress' });
    }

    const { v4: uuidv4 } = await import('uuid');
    const requestId = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    // gdpr_requests.organization_id is NOT NULL with no DB default (Postgres was
    // strict here, SQLite let it slide) — resolve it from the requesting user's
    // own org rather than threading it through every caller.
    const orgRow = await dbGet(`SELECT organization_id FROM users WHERE id = ?`, [userId]);
    const organizationId = orgRow?.organization_id;
    if (!organizationId) {
      return res.status(404).json({ error: 'User organization not found' });
    }

    // Create request record
    await dbRun(
      `INSERT INTO gdpr_requests (id, organization_id, user_id, type, status, expires_at) VALUES (?, ?, ?, 'export', 'processing', ?)`,
      [requestId, organizationId, userId, expiresAt]
    );

    // Gather user data (this would ideally be done async in a job queue)
    try {
      // Get user profile
      const user = await dbGet(
        `SELECT id, email, name, created_at, updated_at FROM users WHERE id = ?`,
        [userId]
      );

      // Get user preferences
      const preferences = await dbAll(
        `SELECT key, value, updated_at FROM user_preferences WHERE user_id = ?`,
        [userId],
        { fallback: false }
      );

      // Get email signatures
      const signatures = await dbAll(
        `SELECT name, content, is_default, created_at FROM email_signatures WHERE user_id = ?`,
        [userId]
      );

      // Get settings templates
      const templates = await dbAll(
        `SELECT name, description, settings_data, created_at FROM settings_templates WHERE user_id = ?`,
        [userId]
      );

      // Compile export data
      const exportData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        requestId,
        user,
        preferences: (preferences as any[]).map((p) => ({
          key: p.key,
          data: (() => {
            try {
              return JSON.parse(p.value || '{}');
            } catch {
              return p.value;
            }
          })(),
          updatedAt: p.updated_at || null,
        })),
        emailSignatures: signatures,
        settingsTemplates: (templates as any[]).map((t) => ({
          ...t,
          settingsData: JSON.parse(t.settings_data || '{}'),
        })),
      };

      // In a real implementation, we'd save this to a file and provide a download link
      // For now, we'll store it in the metadata field
      const exportJson = JSON.stringify(exportData, null, 2);

      await dbRun(
        `UPDATE gdpr_requests SET status = 'completed', metadata = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [exportJson, requestId]
      );

      logger.info(`[settings] GDPR export completed for user ${userId}, request ${requestId}`);

      return res.json({
        request: {
          id: requestId,
          status: 'completed',
          requestedAt: new Date().toISOString(),
          expiresAt,
        },
        success: true,
      });
    } catch (err: any) {
      await dbRun(
        `UPDATE gdpr_requests SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [err.message, requestId]
      );
      throw err;
    }
  })
);

/**
 * GET /api/settings/gdpr/export-download/:requestId
 * Download exported data
 */
router.get(
  '/gdpr/export-download/:requestId',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { requestId } = req.params;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await ensureGdprRequestsTable();

    const request = await dbGet<{ metadata: string; expires_at: string; status: string }>(
      `SELECT metadata, expires_at, status FROM gdpr_requests WHERE id = ? AND user_id = ? AND type = 'export'`,
      [requestId, userId]
    );

    if (!request) {
      return res.status(404).json({ error: 'Export request not found' });
    }

    if (request.status !== 'completed') {
      return res.status(400).json({ error: 'Export is not yet ready' });
    }

    if (new Date(request.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Export has expired' });
    }

    // Return the data as JSON download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="consultify-data-export-${requestId}.json"`
    );
    return res.send(request.metadata);
  })
);

/**
 * POST /api/settings/gdpr/deletion-request
 * Create a new account deletion request
 */
router.post(
  '/gdpr/deletion-request',
  verifyToken,
  requireActiveMembership,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const tokenOrganizationId = req.user?.organizationId;
    const { reason, password } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await ensureGdprRequestsTable();

    // Re-authenticate every request attempt. The request only schedules a reversible
    // privacy workflow; destructive execution remains disabled pending policy approval.
    const passwordCheck = await verifyUserPassword(userId, password);
    if (passwordCheck.ok === false) {
      return res.status(passwordCheck.status).json({ error: passwordCheck.error });
    }

    const { v4: uuidv4 } = await import('uuid');
    const requestId = uuidv4();
    // gdpr_requests.organization_id is NOT NULL with no DB default (Postgres
    // rejects the row; SQLite let it slide) — resolve from the user's own org.
    const orgRow = await dbGet(`SELECT organization_id FROM users WHERE id = ?`, [userId]);
    const organizationId = orgRow?.organization_id;
    if (!organizationId || organizationId !== tokenOrganizationId) {
      return res.status(404).json({ error: 'User organization not found' });
    }

    const inserted = await dbGet<{ id: string }>(
      `INSERT INTO gdpr_requests (id, organization_id, user_id, type, status, reason, scheduled_at)
       VALUES (?, ?, ?, 'deletion', 'pending', ?, NULL)
       ON CONFLICT (user_id) WHERE type = 'deletion' AND status IN ('pending', 'scheduled')
       DO NOTHING
       RETURNING id`,
      [requestId, organizationId, userId, reason || '']
    );

    const activeRequest = inserted
      ? await dbGet<any>(
          `SELECT id, status, scheduled_at, created_at
             FROM gdpr_requests
            WHERE id = ? AND organization_id = ? AND user_id = ?`,
          [inserted.id, organizationId, userId]
        )
      : await dbGet<any>(
          `SELECT id, status, scheduled_at, created_at
             FROM gdpr_requests
            WHERE organization_id = ? AND user_id = ? AND type = 'deletion'
              AND status IN ('pending', 'scheduled')
            ORDER BY created_at DESC LIMIT 1`,
          [organizationId, userId]
        );
    if (!activeRequest) throw new Error('Account deletion request read-back failed');

    logger.info(`[settings] GDPR deletion request recorded for user ${userId}`);

    return res.json({
      request: {
        id: activeRequest.id,
        status: activeRequest.status,
        scheduledAt: activeRequest.scheduled_at,
        requestedAt: activeRequest.created_at,
      },
      success: true,
    });
  })
);

/**
 * GET /api/settings/gdpr/deletion-status
 * Check status of user's deletion request
 */
router.get(
  '/gdpr/deletion-status',
  verifyToken,
  requireActiveMembership,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await ensureGdprRequestsTable();

    const organizationId = req.user?.organizationId;
    const request = await dbGet<{
      id: string;
      status: string;
      scheduled_at: string;
      reason: string;
      created_at: string;
    }>(
      `SELECT id, status, scheduled_at, reason, created_at 
             FROM gdpr_requests 
             WHERE organization_id = ? AND user_id = ? AND type = 'deletion'
               AND status IN ('pending', 'scheduled')
             ORDER BY created_at DESC LIMIT 1`,
      [organizationId, userId]
    );

    if (!request) {
      return res.json({ request: null });
    }

    return res.json({
      request: {
        id: request.id,
        status: request.status,
        scheduledAt: request.scheduled_at,
        reason: request.reason,
        requestedAt: request.created_at,
      },
    });
  })
);

/**
 * POST /api/settings/gdpr/cancel-deletion
 * Cancel a pending deletion request
 */
router.post(
  '/gdpr/cancel-deletion',
  verifyToken,
  requireActiveMembership,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { requestId } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });
    if (typeof requestId !== 'string' || !requestId.trim()) {
      return res.status(400).json({ error: 'requestId is required' });
    }

    await ensureGdprRequestsTable();

    // Find active deletion request
    const organizationId = req.user?.organizationId;
    const request = await dbGet<{ id: string }>(
      `SELECT id FROM gdpr_requests
        WHERE id = ? AND organization_id = ? AND user_id = ? AND type = 'deletion'
          AND status IN ('pending', 'scheduled')`,
      [requestId, organizationId, userId]
    );

    if (!request) {
      return res.status(404).json({ error: 'No pending deletion request found' });
    }

    const cancelled = await dbGet<{ id: string }>(
      `UPDATE gdpr_requests SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND organization_id = ? AND user_id = ?
          AND type = 'deletion' AND status IN ('pending', 'scheduled')
        RETURNING id`,
      [request.id, organizationId, userId]
    );
    if (!cancelled) return res.status(409).json({ error: 'Deletion request is no longer active' });

    logger.info(`[settings] GDPR deletion request cancelled for user ${userId}`);

    return res.json({ success: true, request: { id: request.id, status: 'cancelled' } });
  })
);

// ===========================================
// DASHBOARD PREFERENCES
// ===========================================

/**
 * GET /api/settings/preferences/dashboard
 * Get user's dashboard preferences
 */
router.get(
  '/preferences/dashboard',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
      await ensureUserPreferencesTable();

      const prefs = await dbGet<{ preferences_data: string }>(
        `SELECT value AS preferences_data FROM user_preferences WHERE user_id = ? AND key = ?`,
        [userId, preferencesKey('dashboard')],
        { fallback: false }
      );

      if (prefs?.preferences_data) {
        return res.json({ preferences: JSON.parse(prefs.preferences_data) });
      }

      // Return defaults (aligned with client DEFAULT_PREFERENCES)
      return res.json({
        preferences: {
          defaultLandingPage: 'ai-assistant',
          showGreeting: true,
          compactMode: false,
          autoRefreshInterval: 0,
          liveUpdates: false,
          widgets: {
            tasks: true,
            initiatives: true,
            calendar: true,
            aiInsights: true,
            recentActivity: true,
            quickActions: true,
            metrics: true,
          },
        },
      });
    } catch (err: any) {
      logger.warn('[settings] Error fetching dashboard preferences, degrading', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.json({
        preferences: {
          defaultLandingPage: 'ai-assistant',
          showGreeting: true,
          compactMode: false,
          autoRefreshInterval: 0,
          liveUpdates: false,
          widgets: {
            tasks: true,
            initiatives: true,
            calendar: true,
            aiInsights: true,
            recentActivity: true,
            quickActions: true,
            metrics: true,
          },
        },
        degraded: true,
      });
    }
  })
);

/**
 * PUT /api/settings/preferences/dashboard
 * Update user's dashboard preferences
 */
router.put(
  '/preferences/dashboard',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { preferences } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!preferences) {
      return res.status(400).json({ error: 'Preferences object is required' });
    }

    try {
      await ensureUserPreferencesTable();
      const result = await upsertUserPreferenceValue(
        userId,
        preferencesKey('dashboard'),
        JSON.stringify(preferences)
      );
      if (!result.success) throw new Error(result.error || 'Failed to save preference');

      logger.info(`[settings] Dashboard preferences updated for user ${userId}`);

      return res.json({ success: true });
    } catch (err: any) {
      logger.error('[settings] Error updating dashboard preferences:', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się zapisać preferencji pulpitu',
        code: 'SETTINGS_DASHBOARD_PREFERENCES_UPDATE_FAILED',
      });
    }
  })
);

// ===========================================
// WORK PREFERENCES
// ===========================================

/**
 * GET /api/settings/preferences/work
 * Get user's work preferences
 */
router.get(
  '/preferences/work',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
      await ensureUserPreferencesTable();

      const prefs = await dbGet<{ preferences_data: string }>(
        `SELECT value AS preferences_data FROM user_preferences WHERE user_id = ? AND key = ?`,
        [userId, preferencesKey('work')],
        { fallback: false }
      );

      if (prefs?.preferences_data) {
        return res.json({ preferences: JSON.parse(prefs.preferences_data) });
      }

      // Return defaults
      return res.json({
        preferences: {
          defaultProjectView: 'kanban',
          defaultTaskSort: 'priority',
          weekStartDay: 'monday',
          showCompletedTasks: false,
          showSubtasks: true,
          autoArchiveDays: 30,
          taskDefaultDueDays: 7,
          defaultTimeTracking: 'none',
          defaultTaskPriority: 'medium',
          defaultReminderBefore: '1day',
          defaultSnoozeDuration: '1hour',
          autoSnoozeOverdue: false,
          enableFocusMode: true,
          focusModeBlocksNotifications: true,
          defaultFocusDuration: 25,
        },
      });
    } catch (err: any) {
      logger.warn('[settings] Error fetching work preferences, degrading', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.json({
        preferences: {
          defaultProjectView: 'kanban',
          defaultTaskSort: 'priority',
          weekStartDay: 'monday',
          showCompletedTasks: false,
          showSubtasks: true,
          autoArchiveDays: 30,
          taskDefaultDueDays: 7,
          defaultTimeTracking: 'none',
          defaultTaskPriority: 'medium',
          defaultReminderBefore: '1day',
          defaultSnoozeDuration: '1hour',
          autoSnoozeOverdue: false,
          enableFocusMode: true,
          focusModeBlocksNotifications: true,
          defaultFocusDuration: 25,
        },
        degraded: true,
      });
    }
  })
);

/**
 * PUT /api/settings/preferences/work
 * Update user's work preferences
 */
router.put(
  '/preferences/work',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { preferences } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!preferences) {
      return res.status(400).json({ error: 'Preferences object is required' });
    }

    try {
      await ensureUserPreferencesTable();
      const result = await upsertUserPreferenceValue(
        userId,
        preferencesKey('work'),
        JSON.stringify(preferences)
      );
      if (!result.success) throw new Error(result.error || 'Failed to save preference');

      logger.info(`[settings] Work preferences updated for user ${userId}`);

      return res.json({ success: true });
    } catch (err: any) {
      logger.error('[settings] Error updating work preferences:', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się zapisać preferencji pracy',
        code: 'SETTINGS_WORK_PREFERENCES_UPDATE_FAILED',
      });
    }
  })
);

// ===========================================
// WORKING HOURS
// ===========================================

/**
 * GET /api/settings/working-hours
 * Get user's working hours schedule
 */
router.get(
  '/working-hours',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
      await ensureUserPreferencesTable();

      const prefs = await dbGet<{ preferences_data: string }>(
        `SELECT value AS preferences_data FROM user_preferences WHERE user_id = ? AND key = ?`,
        [userId, preferencesKey('working-hours')],
        { fallback: false }
      );

      if (prefs?.preferences_data) {
        const data = JSON.parse(prefs.preferences_data);
        return res.json(data);
      }

      // Return defaults
      return res.json({
        timezone: 'Europe/Warsaw',
        schedule: {
          monday: { enabled: true, startTime: '09:00', endTime: '17:00' },
          tuesday: { enabled: true, startTime: '09:00', endTime: '17:00' },
          wednesday: { enabled: true, startTime: '09:00', endTime: '17:00' },
          thursday: { enabled: true, startTime: '09:00', endTime: '17:00' },
          friday: { enabled: true, startTime: '09:00', endTime: '17:00' },
          saturday: { enabled: false, startTime: '09:00', endTime: '17:00' },
          sunday: { enabled: false, startTime: '09:00', endTime: '17:00' },
        },
      });
    } catch (err: any) {
      logger.warn('[settings] Error fetching working hours, degrading', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.json({
        timezone: 'Europe/Warsaw',
        schedule: {
          monday: { enabled: true, startTime: '09:00', endTime: '17:00' },
          tuesday: { enabled: true, startTime: '09:00', endTime: '17:00' },
          wednesday: { enabled: true, startTime: '09:00', endTime: '17:00' },
          thursday: { enabled: true, startTime: '09:00', endTime: '17:00' },
          friday: { enabled: true, startTime: '09:00', endTime: '17:00' },
          saturday: { enabled: false, startTime: '09:00', endTime: '17:00' },
          sunday: { enabled: false, startTime: '09:00', endTime: '17:00' },
        },
        degraded: true,
      });
    }
  })
);

/**
 * PUT /api/settings/working-hours
 * Update user's working hours schedule
 */
router.put(
  '/working-hours',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { timezone, schedule } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!schedule) {
      return res.status(400).json({ error: 'Schedule is required' });
    }

    try {
      await ensureUserPreferencesTable();

      const data = JSON.stringify({ timezone, schedule });
      const result = await upsertUserPreferenceValue(userId, preferencesKey('working-hours'), data);
      if (!result.success) throw new Error(result.error || 'Failed to save preference');

      logger.info(`[settings] Working hours updated for user ${userId}`);

      return res.json({ success: true });
    } catch (err: any) {
      logger.error('[settings] Error updating working hours:', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się zapisać godzin pracy',
        code: 'SETTINGS_WORKING_HOURS_UPDATE_FAILED',
      });
    }
  })
);

// ===========================================
// EMAIL SIGNATURES
// ===========================================

/**
 * Ensure email_signatures table exists
 */
const ensureEmailSignaturesTable = async () => {
  await dbRun(`
        CREATE TABLE IF NOT EXISTS email_signatures (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            content TEXT NOT NULL,
            is_default INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_email_sig_user ON email_signatures(user_id)`);
};

/**
 * GET /api/settings/signatures
 * Get user's email signatures
 */
router.get(
  '/signatures',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
      await ensureEmailSignaturesTable();

      const signatures = await dbAll(
        `SELECT id, name, content, is_default as "isDefault", created_at as "createdAt" 
                 FROM email_signatures WHERE user_id = ? ORDER BY is_default DESC, created_at DESC`,
        [userId]
      );

      return res.json({
        signatures: signatures.map((s: any) => ({ ...s, isDefault: !!s.isDefault })),
      });
    } catch (err: any) {
      logger.warn('[settings] Error fetching signatures, degrading', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.json({ signatures: [], degraded: true });
    }
  })
);

/**
 * POST /api/settings/signatures
 * Create a new email signature
 */
router.post(
  '/signatures',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { name, content, isDefault } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!name || !content) {
      return res.status(400).json({ error: 'Name and content are required' });
    }

    try {
      await ensureEmailSignaturesTable();

      const { v4: uuidv4 } = await import('uuid');
      const id = uuidv4();

      // If setting as default, unset other defaults
      if (isDefault) {
        assertDbRunSuccess(
          await dbRun(`UPDATE email_signatures SET is_default = 0 WHERE user_id = ?`, [userId]),
          'Failed to clear default signature'
        );
      }

      assertDbRunSuccess(
        await dbRun(
          `INSERT INTO email_signatures (id, user_id, name, content, is_default)
                 VALUES (?, ?, ?, ?, ?)`,
          [id, userId, name, content, isDefault ? 1 : 0]
        ),
        'Failed to create signature'
      );

      logger.info(`[settings] Signature created for user ${userId}`);

      return res.json({
        signature: {
          id,
          name,
          content,
          isDefault: !!isDefault,
          createdAt: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      logger.error('[settings] Error creating signature:', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się utworzyć podpisu',
        code: 'SETTINGS_SIGNATURE_CREATE_FAILED',
      });
    }
  })
);

/**
 * PUT /api/settings/signatures/:id
 * Update an email signature
 */
router.put(
  '/signatures/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { id } = req.params;
    const { name, content } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
      await ensureEmailSignaturesTable();

      const existing = await dbGet(`SELECT id FROM email_signatures WHERE id = ? AND user_id = ?`, [
        id,
        userId,
      ]);

      if (!existing) {
        return res.status(404).json({ error: 'Signature not found' });
      }

      assertDbRunSuccess(
        await dbRun(
          `UPDATE email_signatures SET
                    name = COALESCE(?, name),
                    content = COALESCE(?, content),
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = ? AND user_id = ?`,
          [name, content, id, userId]
        ),
        'Failed to update signature'
      );

      logger.info(`[settings] Signature ${id} updated for user ${userId}`);

      return res.json({ success: true });
    } catch (err: any) {
      logger.error('[settings] Error updating signature:', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res
        .status(500)
        .json({ error: 'Nie udało się zapisać podpisu', code: 'SETTINGS_SIGNATURE_UPDATE_FAILED' });
    }
  })
);

/**
 * PUT /api/settings/signatures/:id/default
 * Set signature as default
 */
router.put(
  '/signatures/:id/default',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
      await ensureEmailSignaturesTable();

      const existing = await dbGet(`SELECT id FROM email_signatures WHERE id = ? AND user_id = ?`, [
        id,
        userId,
      ]);

      if (!existing) {
        return res.status(404).json({ error: 'Signature not found' });
      }

      // Unset all defaults for user
      assertDbRunSuccess(
        await dbRun(`UPDATE email_signatures SET is_default = 0 WHERE user_id = ?`, [userId]),
        'Failed to clear default signature'
      );

      // Set this one as default
      assertDbRunSuccess(
        await dbRun(
          `UPDATE email_signatures SET is_default = 1, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ? AND user_id = ?`,
          [id, userId]
        ),
        'Failed to set default signature'
      );

      logger.info(`[settings] Signature ${id} set as default for user ${userId}`);

      return res.json({ success: true });
    } catch (err: any) {
      logger.error('[settings] Error setting default signature:', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się ustawić domyślnego podpisu',
        code: 'SETTINGS_SIGNATURE_SET_DEFAULT_FAILED',
      });
    }
  })
);

/**
 * DELETE /api/settings/signatures/:id
 * Delete an email signature
 */
router.delete(
  '/signatures/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
      await ensureEmailSignaturesTable();

      assertDbRunSuccess(
        await dbRun(`DELETE FROM email_signatures WHERE id = ? AND user_id = ?`, [id, userId]),
        'Failed to delete signature'
      );

      logger.info(`[settings] Signature ${id} deleted for user ${userId}`);

      return res.json({ success: true });
    } catch (err: any) {
      logger.error('[settings] Error deleting signature:', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res
        .status(500)
        .json({ error: 'Nie udało się usunąć podpisu', code: 'SETTINGS_SIGNATURE_DELETE_FAILED' });
    }
  })
);

// ===========================================
// AI SETTINGS PREFERENCES
// ===========================================

const defaultAIInstructions = {
  systemPrompt: '',
  responseStyle: 'balanced',
  includeContext: true,
  maxContextLength: 4000,
};

const defaultAIModel = {
  preferredModel: 'gpt-4',
  fallbackModel: 'gpt-3.5-turbo',
  autoSelect: true,
  preferSpeed: false,
  preferQuality: true,
};

const defaultAIParameters = {
  temperature: 0.7,
  maxTokens: 2048,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  streamResponse: true,
};

const defaultAIPersonality = {
  tone: 'professional',
  formality: 'balanced',
  verbosity: 'concise',
  creativity: 'moderate',
  customInstructions: '',
};

const defaultAIAutoComplete = {
  enabled: true,
  triggerDelay: 500,
  minChars: 3,
  suggestions: 3,
  contexts: ['tasks', 'comments', 'documents'],
};

const defaultAIMemory = {
  enabled: true,
  retentionDays: 30,
  includeConversations: true,
  includePreferences: true,
  includeContext: true,
};

const defaultAIVoice = {
  ttsEnabled: false,
  sttEnabled: false,
  voice: 'alloy',
  speed: 1.0,
  autoPlay: false,
};

const defaultAIPrivacyPreferences = {
  allowProjectData: true,
  allowClientData: true,
  allowFinancialData: false,
  allowPersonalNotes: false,
  optOutTraining: true,
  dataRetention: '30d',
  auditLogEnabled: true,
  anonymizeExports: false,
};

const defaultPromptLibrary = [
  {
    id: 'builtin-professional',
    name: 'Professional',
    category: 'general',
    prompt:
      'I prefer formal, professional responses. Focus on accuracy and clarity. Use industry-standard terminology.',
    createdAt: '2024-01-01',
  },
  {
    id: 'builtin-interview-prep',
    name: 'Interview Preparation',
    category: 'interview',
    prompt:
      'Help me prepare structured interview questions. Focus on behavioral and competency-based questions. Suggest follow-ups for each main question.',
    createdAt: '2024-01-01',
  },
  {
    id: 'builtin-analysis',
    name: 'Data Analysis',
    category: 'analysis',
    prompt:
      'Analyze data thoroughly. Present findings with clear structure: key metrics, trends, anomalies, and actionable recommendations. Use tables when helpful.',
    createdAt: '2024-01-01',
  },
  {
    id: 'builtin-report',
    name: 'Executive Report',
    category: 'report',
    prompt:
      'Write in executive summary style. Lead with conclusions, then supporting evidence. Keep paragraphs short. Use bullet points for key takeaways.',
    createdAt: '2024-01-01',
  },
];

/**
 * GET /api/settings/preferences/ai-instructions
 */
router.get(
  '/preferences/ai-instructions',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await ensureUserPreferencesTable();
    const row = await dbGet<{ preferences_data: string }>(
      `SELECT value AS preferences_data FROM user_preferences WHERE user_id = ? AND key = ?`,
      [userId, preferencesKey('ai-instructions')],
      { fallback: false }
    );
    if (row?.preferences_data) {
      try {
        return res.json({ preferences: JSON.parse(row.preferences_data) });
      } catch {
        // fallthrough
      }
    }
    return res.json({ preferences: defaultAIInstructions });
  })
);

/**
 * PUT /api/settings/preferences/ai-instructions
 */
router.put(
  '/preferences/ai-instructions',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { preferences } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });
    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ error: 'Invalid preferences payload' });
    }

    await ensureUserPreferencesTable();
    const payload = JSON.stringify(preferences);
    const result = await upsertUserPreferenceValue(
      userId,
      preferencesKey('ai-instructions'),
      payload
    );
    if (!result.success) throw new Error(result.error || 'Failed to save preference');

    await logSettingsChange(userId, 'ai', 'ai-instructions', 'updated', null, preferences);
    logger.info(`[settings] AI instructions updated for user ${userId}`);
    return res.json({ success: true });
  })
);

/**
 * GET /api/settings/preferences/ai-model
 */
router.get(
  '/preferences/ai-model',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await ensureUserPreferencesTable();
    const row = await dbGet<{ preferences_data: string }>(
      `SELECT value AS preferences_data FROM user_preferences WHERE user_id = ? AND key = ?`,
      [userId, preferencesKey('ai-model')],
      { fallback: false }
    );
    if (row?.preferences_data) {
      try {
        return res.json({ preferences: JSON.parse(row.preferences_data) });
      } catch {
        // fallthrough
      }
    }
    return res.json({ preferences: defaultAIModel });
  })
);

/**
 * PUT /api/settings/preferences/ai-model
 */
router.put(
  '/preferences/ai-model',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { preferences } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });
    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ error: 'Invalid preferences payload' });
    }

    await ensureUserPreferencesTable();
    const payload = JSON.stringify(preferences);
    const result = await upsertUserPreferenceValue(userId, preferencesKey('ai-model'), payload);
    if (!result.success) throw new Error(result.error || 'Failed to save preference');

    await logSettingsChange(userId, 'ai', 'ai-model', 'updated', null, preferences);
    logger.info(`[settings] AI model preferences updated for user ${userId}`);
    return res.json({ success: true });
  })
);

/**
 * GET /api/settings/preferences/ai-parameters
 */
router.get(
  '/preferences/ai-parameters',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await ensureUserPreferencesTable();
    const row = await dbGet<{ preferences_data: string }>(
      `SELECT value AS preferences_data FROM user_preferences WHERE user_id = ? AND key = ?`,
      [userId, preferencesKey('ai-parameters')],
      { fallback: false }
    );
    if (row?.preferences_data) {
      try {
        return res.json({ preferences: JSON.parse(row.preferences_data) });
      } catch {
        // fallthrough
      }
    }
    return res.json({ preferences: defaultAIParameters });
  })
);

/**
 * PUT /api/settings/preferences/ai-parameters
 */
router.put(
  '/preferences/ai-parameters',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { preferences } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });
    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ error: 'Invalid preferences payload' });
    }

    await ensureUserPreferencesTable();
    const payload = JSON.stringify(preferences);
    const result = await upsertUserPreferenceValue(
      userId,
      preferencesKey('ai-parameters'),
      payload
    );
    if (!result.success) throw new Error(result.error || 'Failed to save preference');

    await logSettingsChange(userId, 'ai', 'ai-parameters', 'updated', null, preferences);
    logger.info(`[settings] AI parameters updated for user ${userId}`);
    return res.json({ success: true });
  })
);

/**
 * GET /api/settings/preferences/ai-personality
 */
router.get(
  '/preferences/ai-personality',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await ensureUserPreferencesTable();
    const row = await dbGet<{ preferences_data: string }>(
      `SELECT value AS preferences_data FROM user_preferences WHERE user_id = ? AND key = ?`,
      [userId, preferencesKey('ai-personality')],
      { fallback: false }
    );
    if (row?.preferences_data) {
      try {
        return res.json({ preferences: JSON.parse(row.preferences_data) });
      } catch {
        // fallthrough
      }
    }
    return res.json({ preferences: defaultAIPersonality });
  })
);

/**
 * PUT /api/settings/preferences/ai-personality
 */
router.put(
  '/preferences/ai-personality',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { preferences } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });
    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ error: 'Invalid preferences payload' });
    }

    await ensureUserPreferencesTable();
    const payload = JSON.stringify(preferences);
    const result = await upsertUserPreferenceValue(
      userId,
      preferencesKey('ai-personality'),
      payload
    );
    if (!result.success) throw new Error(result.error || 'Failed to save preference');

    await logSettingsChange(userId, 'ai', 'ai-personality', 'updated', null, preferences);
    logger.info(`[settings] AI personality updated for user ${userId}`);
    return res.json({ success: true });
  })
);

/**
 * GET /api/settings/preferences/ai-autocomplete
 */
router.get(
  '/preferences/ai-autocomplete',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await ensureUserPreferencesTable();
    const row = await dbGet<{ preferences_data: string }>(
      `SELECT value AS preferences_data FROM user_preferences WHERE user_id = ? AND key = ?`,
      [userId, preferencesKey('ai-autocomplete')],
      { fallback: false }
    );
    if (row?.preferences_data) {
      try {
        return res.json({ preferences: JSON.parse(row.preferences_data) });
      } catch {
        // fallthrough
      }
    }
    return res.json({ preferences: defaultAIAutoComplete });
  })
);

/**
 * PUT /api/settings/preferences/ai-autocomplete
 */
router.put(
  '/preferences/ai-autocomplete',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { preferences } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });
    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ error: 'Invalid preferences payload' });
    }

    await ensureUserPreferencesTable();
    const payload = JSON.stringify(preferences);
    const result = await upsertUserPreferenceValue(
      userId,
      preferencesKey('ai-autocomplete'),
      payload
    );
    if (!result.success) throw new Error(result.error || 'Failed to save preference');

    logger.info(`[settings] AI autocomplete updated for user ${userId}`);
    return res.json({ success: true });
  })
);

/**
 * GET /api/settings/preferences/ai-memory
 */
router.get(
  '/preferences/ai-memory',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId)
      return res.status(401).json({ error: 'User not authenticated', code: 'AUTH_REQUIRED' });

    await ensureUserPreferencesTable();
    const row = await dbGet<{ preferences_data: string }>(
      `SELECT value AS preferences_data FROM user_preferences WHERE user_id = ? AND key = ?`,
      [userId, preferencesKey('ai-memory')],
      { fallback: false }
    );
    if (row?.preferences_data) {
      try {
        return res.json({ preferences: JSON.parse(row.preferences_data) });
      } catch {
        return res.status(500).json({
          error: 'Stored AI memory preferences are invalid',
          code: 'AI_MEMORY_PREFERENCES_INVALID_STORE',
        });
      }
    }
    return res.json({ preferences: defaultAIMemory });
  })
);

/**
 * PUT /api/settings/preferences/ai-memory
 */
router.put(
  '/preferences/ai-memory',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { preferences } = req.body || {};
    if (!userId)
      return res.status(401).json({ error: 'User not authenticated', code: 'AUTH_REQUIRED' });
    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({
        error: 'Invalid preferences payload',
        code: 'AI_MEMORY_PREFERENCES_INVALID_PAYLOAD',
      });
    }

    try {
      await ensureUserPreferencesTable();
      const payload = JSON.stringify(preferences);
      await upsertUserPreferenceValue(userId, preferencesKey('ai-memory'), payload);
    } catch {
      return res.status(500).json({
        error: 'Failed to save AI memory preferences',
        code: 'AI_MEMORY_PREFERENCES_SAVE_FAILED',
      });
    }

    await logSettingsChange(userId, 'ai', 'ai-memory', 'updated', null, preferences);
    logger.info(`[settings] AI memory preferences updated for user ${userId}`);
    return res.json({ success: true });
  })
);

/**
 * DELETE /api/settings/preferences/ai-memory/clear
 * Clear AI memory/context
 */
router.delete(
  '/preferences/ai-memory/clear',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId)
      return res.status(401).json({ error: 'User not authenticated', code: 'AUTH_REQUIRED' });

    // Clear user's AI conversation history if exists
    try {
      await dbRun(`DELETE FROM conversations WHERE user_id = ?`, [userId]);
    } catch {
      // Table may not exist, ignore
    }

    logger.info(`[settings] AI memory cleared for user ${userId}`);
    return res.json({ success: true });
  })
);

/**
 * GET /api/settings/preferences/ai-voice
 */
router.get(
  '/preferences/ai-voice',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await ensureUserPreferencesTable();
    const row = await dbGet<{ preferences_data: string }>(
      `SELECT value AS preferences_data FROM user_preferences WHERE user_id = ? AND key = ?`,
      [userId, preferencesKey('ai-voice')],
      { fallback: false }
    );
    if (row?.preferences_data) {
      try {
        return res.json({ preferences: JSON.parse(row.preferences_data) });
      } catch {
        // fallthrough
      }
    }
    return res.json({ preferences: defaultAIVoice });
  })
);

/**
 * PUT /api/settings/preferences/ai-voice
 */
router.put(
  '/preferences/ai-voice',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { preferences } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });
    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ error: 'Invalid preferences payload' });
    }

    await ensureUserPreferencesTable();
    const payload = JSON.stringify(preferences);
    const result = await upsertUserPreferenceValue(userId, preferencesKey('ai-voice'), payload);
    if (!result.success) throw new Error(result.error || 'Failed to save preference');

    await logSettingsChange(userId, 'ai', 'ai-voice', 'updated', null, preferences);
    logger.info(`[settings] AI voice preferences updated for user ${userId}`);
    return res.json({ success: true });
  })
);

/**
 * GET /api/settings/preferences/ai-privacy
 */
router.get(
  '/preferences/ai-privacy',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await ensureUserPreferencesTable();
    const row = await dbGet<{ preferences_data: string }>(
      `SELECT value AS preferences_data FROM user_preferences WHERE user_id = ? AND key = ?`,
      [userId, preferencesKey('ai-privacy')],
      { fallback: false }
    );
    if (row?.preferences_data) {
      try {
        return res.json({ preferences: JSON.parse(row.preferences_data) });
      } catch {
        // fallthrough
      }
    }

    return res.json({ preferences: defaultAIPrivacyPreferences });
  })
);

/**
 * PUT /api/settings/preferences/ai-privacy
 */
router.put(
  '/preferences/ai-privacy',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { preferences } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });
    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ error: 'Invalid preferences payload' });
    }

    await ensureUserPreferencesTable();
    const result = await upsertUserPreferenceValue(
      userId,
      preferencesKey('ai-privacy'),
      JSON.stringify(preferences)
    );
    if (!result.success) throw new Error(result.error || 'Failed to save preference');

    await logSettingsChange(userId, 'ai', 'ai-privacy', 'updated', null, preferences);
    logger.info(`[settings] AI privacy preferences updated for user ${userId}`);
    return res.json({ success: true });
  })
);

/**
 * GET /api/settings/preferences/prompt-library
 */
router.get(
  '/preferences/prompt-library',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await ensureUserPreferencesTable();
    const row = await dbGet<{ preferences_data: string }>(
      `SELECT value AS preferences_data FROM user_preferences WHERE user_id = ? AND key = ?`,
      [userId, preferencesKey('prompt-library')],
      { fallback: false }
    );
    if (row?.preferences_data) {
      try {
        return res.json({ prompts: JSON.parse(row.preferences_data) });
      } catch {
        // fallthrough
      }
    }

    return res.json({ prompts: defaultPromptLibrary });
  })
);

/**
 * PUT /api/settings/preferences/prompt-library
 */
router.put(
  '/preferences/prompt-library',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { prompts } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });
    if (!Array.isArray(prompts)) {
      return res.status(400).json({ error: 'Invalid prompt library payload' });
    }

    await ensureUserPreferencesTable();
    const result = await upsertUserPreferenceValue(
      userId,
      preferencesKey('prompt-library'),
      JSON.stringify(prompts)
    );
    if (!result.success) throw new Error(result.error || 'Failed to save prompt library');

    logger.info(`[settings] Prompt library updated for user ${userId}`);
    return res.json({ success: true });
  })
);

/**
 * GET /api/settings/ai-usage
 * Get AI usage statistics for the user
 */
router.get(
  '/ai-usage',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const period = (req.query.period as string) || '30d';
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    // Calculate date range
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString();

    try {
      // Try to get real usage from llm_logs if available
      const usageStats = await dbGet<{
        total_requests: number;
        total_tokens: number;
        total_cost: number;
      }>(
        `SELECT 
                    COUNT(*) as total_requests,
                    COALESCE(SUM(tokens_used), 0) as total_tokens,
                    COALESCE(SUM(cost), 0) as total_cost
                 FROM llm_logs 
                 WHERE user_id = ? AND created_at >= ?`,
        [userId, startDateStr]
      );

      // Get usage by feature
      const usageByFeature = await dbAll(
        `SELECT 
                    COALESCE(feature, 'general') as feature,
                    COUNT(*) as count,
                    COALESCE(SUM(tokens_used), 0) as tokens,
                    COALESCE(SUM(cost), 0) as cost
                 FROM llm_logs 
                 WHERE user_id = ? AND created_at >= ?
                 GROUP BY feature`,
        [userId, startDateStr]
      );

      // Get daily usage
      const dailyUsage = await dbAll(
        `SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as requests,
                    COALESCE(SUM(tokens_used), 0) as tokens
                 FROM llm_logs 
                 WHERE user_id = ? AND created_at >= ?
                 GROUP BY DATE(created_at)
                 ORDER BY date`,
        [userId, startDateStr]
      );

      return res.json({
        period,
        stats: {
          totalRequests: usageStats?.total_requests || 0,
          totalTokens: usageStats?.total_tokens || 0,
          totalCost: usageStats?.total_cost || 0,
          avgResponseTime: 1.5,
          successRate: 99.5,
          limit: 1000000,
          used: usageStats?.total_tokens || 0,
        },
        usageByFeature: usageByFeature || [],
        dailyUsage: dailyUsage || [],
      });
    } catch (err: any) {
      // If llm_logs table doesn't exist, return empty stats
      logger.warn('[settings] Could not fetch AI usage stats:', err.message);
      return res.json({
        period,
        stats: {
          totalRequests: 0,
          totalTokens: 0,
          totalCost: 0,
          avgResponseTime: 0,
          successRate: 100,
          limit: 1000000,
          used: 0,
        },
        usageByFeature: [],
        dailyUsage: [],
      });
    }
  })
);

// ===========================================
// ADVANCED: SETTINGS TEMPLATES
// ===========================================

const ensureSettingsTemplatesTable = async () => {
  await dbRun(`
        CREATE TABLE IF NOT EXISTS settings_templates (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            icon TEXT DEFAULT '📋',
            type TEXT DEFAULT 'custom',
            settings_data TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);
};

/**
 * GET /api/settings/templates
 */
router.get(
  '/templates',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await ensureSettingsTemplatesTable();

    const templates = await dbAll(
      `SELECT id, name, description, icon, type, settings_data as "settingsData", created_at as "createdAt"
             FROM settings_templates 
             WHERE user_id = ? AND is_active = 1
             ORDER BY created_at DESC`,
      [userId]
    );

    // Add system templates
    const systemTemplates = [
      {
        id: 'minimal',
        name: 'Minimal',
        description: 'Clean, distraction-free settings',
        icon: '🎯',
        type: 'system',
      },
      {
        id: 'power-user',
        name: 'Power User',
        description: 'All features enabled',
        icon: '⚡',
        type: 'system',
        isRecommended: true,
      },
      {
        id: 'privacy-focused',
        name: 'Privacy Focused',
        description: 'Maximum privacy settings',
        icon: '🔒',
        type: 'system',
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        description: 'Security and compliance focused',
        icon: '🏢',
        type: 'system',
      },
    ];

    return res.json({ templates: [...systemTemplates, ...templates] });
  })
);

/**
 * POST /api/settings/templates
 */
router.post(
  '/templates',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { name, description, icon, settingsData } = req.body;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });
    if (!name || !settingsData)
      return res.status(400).json({ error: 'Name and settingsData required' });

    await ensureSettingsTemplatesTable();
    const { v4: uuidv4 } = await import('uuid');
    const id = uuidv4();

    await dbRun(
      `INSERT INTO settings_templates (id, user_id, name, description, icon, type, settings_data)
             VALUES (?, ?, ?, ?, ?, 'custom', ?)`,
      [id, userId, name, description || '', icon || '📋', JSON.stringify(settingsData)]
    );

    logger.info(`[settings] Template created for user ${userId}`);
    return res.json({ success: true, template: { id, name, description, icon, type: 'custom' } });
  })
);

/**
 * PUT /api/settings/templates/:id
 */
router.put(
  '/templates/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { id } = req.params;
    const { name, description, icon, settingsData } = req.body;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await ensureSettingsTemplatesTable();
    await dbRun(
      `UPDATE settings_templates SET 
                name = COALESCE(?, name),
                description = COALESCE(?, description),
                icon = COALESCE(?, icon),
                settings_data = COALESCE(?, settings_data),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND user_id = ?`,
      [name, description, icon, settingsData ? JSON.stringify(settingsData) : null, id, userId]
    );

    return res.json({ success: true });
  })
);

/**
 * DELETE /api/settings/templates/:id
 */
router.delete(
  '/templates/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await ensureSettingsTemplatesTable();
    await dbRun(`UPDATE settings_templates SET is_active = 0 WHERE id = ? AND user_id = ?`, [
      id,
      userId,
    ]);

    return res.json({ success: true });
  })
);

/**
 * POST /api/settings/templates/:id/apply
 */
router.post(
  '/templates/:id/apply',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await ensureSettingsTemplatesTable();

    // System templates have predefined settings
    const systemSettings: Record<string, any> = {
      minimal: { notifications: { email: false, push: false }, aiAutoComplete: { enabled: false } },
      'power-user': { aiAutoComplete: { enabled: true }, shortcuts: { enabled: true } },
      'privacy-focused': { privacy: { shareActivityWithAI: false, showOnlineStatus: false } },
      enterprise: { privacy: { showOnlineStatus: false }, security: { mfaRequired: true } },
    };

    if (systemSettings[id]) {
      await applySettingsPayload(userId, systemSettings[id]);
      logger.info(`[settings] Applied system template ${id} for user ${userId}`);
      return res.json({ success: true, applied: systemSettings[id] });
    }

    // Custom template
    const template = await dbGet<{ settings_data: string }>(
      `SELECT settings_data FROM settings_templates WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    if (!template) return res.status(404).json({ error: 'Template not found' });

    const applied = JSON.parse(template.settings_data);
    await applySettingsPayload(userId, applied);

    logger.info(`[settings] Applied custom template ${id} for user ${userId}`);
    return res.json({ success: true, applied });
  })
);

// ===========================================
// ADVANCED: SETTINGS HISTORY
// ===========================================

const ensureSettingsAuditLogTable = async () => {
  await dbRun(`
        CREATE TABLE IF NOT EXISTS settings_audit_log (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            category TEXT NOT NULL,
            setting_key TEXT NOT NULL,
            action TEXT NOT NULL,
            old_value TEXT,
            new_value TEXT,
            device TEXT,
            ip_address TEXT,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);
};

/**
 * GET /api/settings/history
 */
router.get(
  '/history',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const category = req.query.category as string;
    const days = parseInt(req.query.days as string) || 30;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await ensureSettingsAuditLogTable();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let query = `SELECT id, category, setting_key as setting, action, old_value as "oldValue", 
                     new_value as "newValue", device, ip_address as "ipAddress", created_at as timestamp
                     FROM settings_audit_log 
                     WHERE user_id = ? AND created_at >= ?`;
    const params: any[] = [userId, startDate.toISOString()];

    if (category && category !== 'all') {
      query += ` AND category = ?`;
      params.push(category);
    }

    query += ` ORDER BY created_at DESC LIMIT 100`;

    const entries = await dbAll(query, params);

    // Get stats
    const stats = await dbGet<{ total: number; today: number }>(
      `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN DATE(created_at) = DATE('now') THEN 1 ELSE 0 END) as today
             FROM settings_audit_log WHERE user_id = ?`,
      [userId]
    );

    return res.json({
      entries,
      stats: {
        total: stats?.total || 0,
        today: stats?.today || 0,
        categories: 7,
      },
    });
  })
);

/**
 * POST /api/settings/history/restore/:id
 */
router.post(
  '/history/restore/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await ensureSettingsAuditLogTable();

    const entry = await dbGet<{ old_value: string; category: string; setting_key: string }>(
      `SELECT old_value, category, setting_key FROM settings_audit_log WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    if (!entry || !entry.old_value) {
      return res.status(404).json({ error: 'History entry not found or cannot be restored' });
    }

    const restoredValue = JSON.parse(entry.old_value);
    await restoreSettingsValue(userId, entry.category, restoredValue);

    // Log the restore action
    const { v4: uuidv4 } = await import('uuid');
    await dbRun(
      `INSERT INTO settings_audit_log (id, user_id, category, setting_key, action, old_value, new_value)
             VALUES (?, ?, ?, ?, 'restored', NULL, ?)`,
      [uuidv4(), userId, entry.category, entry.setting_key, entry.old_value]
    );

    logger.info(`[settings] Restored setting ${entry.setting_key} for user ${userId}`);
    return res.json({ success: true, restoredValue });
  })
);

// ===========================================
// ADVANCED: SETTINGS EXPORT/IMPORT
// ===========================================

/**
 * POST /api/settings/export
 */
router.post(
  '/export',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { categories } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await ensureUserPreferencesTable();

    // Get all user preferences
    const preferences = await dbAll(
      `SELECT key, value FROM user_preferences WHERE user_id = ?`,
      [userId],
      { fallback: false }
    );

    const exportData: Record<string, any> = {};
    if (!categories || categories.includes('profile')) {
      const userColumns = await getTableColumns('users');
      const selectedColumns = PROFILE_EXPORT_COLUMNS.filter((column) => userColumns.has(column));
      if (selectedColumns.length > 0) {
        const profileRow = await dbGet<Record<string, unknown>>(
          `SELECT ${selectedColumns.join(', ')} FROM users WHERE id = ? LIMIT 1`,
          [userId],
          { fallback: false }
        );
        if (profileRow) {
          exportData.profile = Object.fromEntries(
            Object.entries(profileRow).map(([key, value]) => [snakeToCamel(key), value])
          );
        }
      }
    }

    for (const pref of preferences as { key: string; value: string }[]) {
      const type = pref.key.startsWith('settings:') ? pref.key.slice('settings:'.length) : pref.key;
      // Filter by categories if specified
      if (categories && !categories.includes(type)) continue;
      try {
        exportData[type] = JSON.parse(pref.value);
      } catch {
        exportData[type] = pref.value;
      }
    }

    const exportPayload = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      userId,
      settings: exportData,
    };

    logger.info(`[settings] Exported settings for user ${userId}`);
    return res.json({ success: true, data: exportPayload });
  })
);

/**
 * POST /api/settings/import
 */
router.post(
  '/import',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { data, overwrite = false } = req.body;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });
    if (!data || !data.settings) return res.status(400).json({ error: 'Invalid import data' });

    await ensureUserPreferencesTable();

    const imported: string[] = [];
    const skipped: string[] = [];

    for (const [type, value] of Object.entries(data.settings)) {
      if (type === 'profile' && value && typeof value === 'object' && !Array.isArray(value)) {
        const userColumns = await getTableColumns('users');
        const profile = value as Record<string, unknown>;
        const updates: string[] = [];
        const params: unknown[] = [];
        const addProfileColumn = (column: string, apiKey = snakeToCamel(column)) => {
          if (!userColumns.has(column) || profile[apiKey] === undefined) return;
          updates.push(`${column} = ?`);
          params.push(profile[apiKey] === null ? null : String(profile[apiKey]));
        };

        for (const column of PROFILE_IMPORT_COLUMNS) addProfileColumn(column);
        if (
          userColumns.has('job_title') &&
          profile.title !== undefined &&
          profile.jobTitle === undefined
        ) {
          addProfileColumn('job_title', 'title');
        }

        if (updates.length > 0) {
          updates.push('updated_at = CURRENT_TIMESTAMP');
          const result = await dbRun(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, [
            ...params,
            userId,
          ]);
          if (!result.success) throw new Error(result.error || 'Failed to import profile');
        }

        imported.push(type);
        continue;
      }

      const existing = await dbGet(
        `SELECT 1 AS ok FROM user_preferences WHERE user_id = ? AND key = ?`,
        [userId, preferencesKey(type)],
        { fallback: false }
      );

      if (existing && !overwrite) {
        skipped.push(type);
        continue;
      }

      const payload = JSON.stringify(value);
      const result = await upsertUserPreferenceValue(userId, preferencesKey(type), payload);
      if (!result.success) throw new Error(result.error || 'Failed to import preference');
      imported.push(type);
    }

    logger.info(`[settings] Imported ${imported.length} settings for user ${userId}`);
    return res.json({ success: true, imported, skipped });
  })
);

// ===========================================
// ADVANCED: USER API KEYS
// ===========================================

const ensureUserApiKeysTable = async () => {
  await dbRun(
    `
      CREATE TABLE IF NOT EXISTS user_api_keys (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        key_hash TEXT NOT NULL,
        key_prefix TEXT NOT NULL,
        permissions TEXT DEFAULT '[]',
        rate_limit INTEGER DEFAULT 1000,
        last_used_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `,
    [],
    { fallback: false }
  );

  const cols = await getTableColumns('user_api_keys');
  const alterations: Array<[string, string]> = [
    ['name', `ALTER TABLE user_api_keys ADD COLUMN name TEXT`],
    ['key_hash', `ALTER TABLE user_api_keys ADD COLUMN key_hash TEXT`],
    ['key_prefix', `ALTER TABLE user_api_keys ADD COLUMN key_prefix TEXT`],
    ['permissions', `ALTER TABLE user_api_keys ADD COLUMN permissions TEXT DEFAULT '[]'`],
    ['rate_limit', `ALTER TABLE user_api_keys ADD COLUMN rate_limit INTEGER DEFAULT 1000`],
    ['last_used_at', `ALTER TABLE user_api_keys ADD COLUMN last_used_at TIMESTAMPTZ`],
    ['expires_at', `ALTER TABLE user_api_keys ADD COLUMN expires_at TIMESTAMPTZ`],
    ['is_active', `ALTER TABLE user_api_keys ADD COLUMN is_active INTEGER DEFAULT 1`],
    [
      'updated_at',
      `ALTER TABLE user_api_keys ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`,
    ],
  ];

  for (const [column, sql] of alterations) {
    if (!cols.has(column)) {
      await dbRun(sql, [], { fallback: true });
    }
  }
};

const generateApiKey = (): string => {
  // 256-bit random key; URL-safe via hex.
  return `ck_${crypto.randomBytes(32).toString('hex')}`;
};

const hashApiKey = (plainTextKey: string): string => {
  const raw = plainTextKey.startsWith('ck_') ? plainTextKey.slice(3) : plainTextKey;
  return crypto.createHash('sha256').update(raw).digest('hex');
};

/**
 * GET /api/settings/api-keys
 */
router.get(
  '/api-keys',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    // Fail-soft: lazy DDL must not surface as a bare 500 on a read.
    try {
      await ensureUserApiKeysTable();

      const keys = await dbAll(
        `SELECT id, name, key_prefix as "keyPrefix", permissions, rate_limit as "rateLimit",
                      last_used_at as "lastUsedAt", expires_at as "expiresAt", is_active as "isActive",
                      created_at as "createdAt"
               FROM user_api_keys WHERE user_id = ? ORDER BY created_at DESC`,
        [userId]
      );

      return res.json({ keys });
    } catch (err) {
      console.error('[settings] GET /api-keys failed (fail-soft, returning empty):', err);
      return res.json({ keys: [] });
    }
  })
);

/**
 * POST /api/settings/api-keys
 */
router.post(
  '/api-keys',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { name, permissions, rateLimit, expiresAt } = req.body;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });
    if (!name) return res.status(400).json({ error: 'Name is required' });

    await ensureUserApiKeysTable();

    const { v4: uuidv4 } = await import('uuid');
    const id = uuidv4();
    const apiKey = generateApiKey();
    const keyPrefix = apiKey.substring(0, 10);

    const keyHash = hashApiKey(apiKey);

    // user_api_keys.provider and .encrypted_key are NOT NULL with no DB default
    // (Postgres rejects the row; SQLite let both slide). Both columns exist for
    // the BYOK (bring-your-own-LLM-key) feature, which nothing in this codebase
    // currently inserts into — this endpoint mints a personal Consultify API
    // token instead, verified via key_hash (apiKeyAuth.middleware.ts never reads
    // provider/encrypted_key). Use a sentinel provider so these rows stay
    // distinguishable from a real BYOK row, and reuse the already-computed hash
    // rather than fabricating a second "encrypted" value with no real meaning.
    assertDbRunSuccess(
      await dbRun(
        `INSERT INTO user_api_keys (id, user_id, provider, encrypted_key, name, key_hash, key_prefix, permissions, rate_limit, expires_at)
             VALUES (?, ?, 'consultify_api', ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          userId,
          keyHash,
          name,
          keyHash,
          keyPrefix,
          JSON.stringify(permissions || []),
          rateLimit || 1000,
          expiresAt || null,
        ]
      ),
      'Failed to create API key'
    );

    logger.info(`[settings] API key created for user ${userId}`);

    // Return the full key only once (during creation)
    return res.json({
      success: true,
      key: { id, name, key: apiKey, keyPrefix, createdAt: new Date().toISOString() },
    });
  })
);

/**
 * PUT /api/settings/api-keys/:id
 */
router.put(
  '/api-keys/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { id } = req.params;
    const { name, permissions, rateLimit, isActive } = req.body;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await ensureUserApiKeysTable();

    assertDbRunSuccess(
      await dbRun(
        `UPDATE user_api_keys SET
                name = COALESCE(?, name),
                permissions = COALESCE(?, permissions),
                rate_limit = COALESCE(?, rate_limit),
                is_active = COALESCE(?, is_active),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND user_id = ?`,
        [name, permissions ? JSON.stringify(permissions) : null, rateLimit, isActive, id, userId]
      ),
      'Failed to update API key'
    );

    return res.json({ success: true });
  })
);

/**
 * DELETE /api/settings/api-keys/:id
 */
router.delete(
  '/api-keys/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await ensureUserApiKeysTable();
    assertDbRunSuccess(
      await dbRun(`DELETE FROM user_api_keys WHERE id = ? AND user_id = ?`, [id, userId]),
      'Failed to delete API key'
    );

    logger.info(`[settings] API key ${id} deleted for user ${userId}`);
    return res.json({ success: true });
  })
);

/**
 * POST /api/settings/api-keys/:id/rotate
 */
router.post(
  '/api-keys/:id/rotate',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await ensureUserApiKeysTable();

    const newKey = generateApiKey();
    const keyPrefix = newKey.substring(0, 10);
    const keyHash = hashApiKey(newKey);

    assertDbRunSuccess(
      await dbRun(
        `UPDATE user_api_keys SET key_hash = ?, key_prefix = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND user_id = ?`,
        [keyHash, keyPrefix, id, userId]
      ),
      'Failed to rotate API key'
    );

    await logSettingsChange(userId, 'security', 'api-key', 'rotated', null, {
      keyId: id,
      keyPrefix,
    });
    logger.info(`[settings] API key ${id} rotated for user ${userId}`);
    return res.json({ success: true, key: newKey, keyPrefix });
  })
);

// ===========================================
// ADVANCED: USER WEBHOOKS
// ===========================================

const ensureUserWebhooksTable = async () => {
  await dbRun(
    `
      CREATE TABLE IF NOT EXISTS user_webhooks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        events TEXT NOT NULL,
        secret TEXT,
        headers TEXT DEFAULT '{}',
        is_active INTEGER DEFAULT 1,
        last_triggered_at TIMESTAMPTZ,
        last_status INTEGER,
        failure_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `,
    [],
    // Opportunistic DDL — never let a transient CREATE failure reject and 500 the read.
    { fallback: true }
  );

  const cols = await getTableColumns('user_webhooks');
  const alterations: Array<[string, string]> = [
    ['name', `ALTER TABLE user_webhooks ADD COLUMN name TEXT`],
    ['secret', `ALTER TABLE user_webhooks ADD COLUMN secret TEXT`],
    ['headers', `ALTER TABLE user_webhooks ADD COLUMN headers TEXT DEFAULT '{}'`],
    ['is_active', `ALTER TABLE user_webhooks ADD COLUMN is_active INTEGER DEFAULT 1`],
    ['last_triggered_at', `ALTER TABLE user_webhooks ADD COLUMN last_triggered_at TIMESTAMPTZ`],
    ['last_status', `ALTER TABLE user_webhooks ADD COLUMN last_status INTEGER`],
    ['failure_count', `ALTER TABLE user_webhooks ADD COLUMN failure_count INTEGER DEFAULT 0`],
    [
      'updated_at',
      `ALTER TABLE user_webhooks ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`,
    ],
  ];

  for (const [column, sql] of alterations) {
    if (!cols.has(column)) {
      await dbRun(sql, [], { fallback: true });
    }
  }
};

/**
 * GET /api/settings/webhooks
 */
router.get(
  '/webhooks',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    try {
      await ensureUserWebhooksTable();

      const webhooks = await dbAll(
        `SELECT id, name, url, events, is_active as "isActive",
                    last_triggered_at as "lastTriggeredAt", last_status as "lastStatus",
                    failure_count as "failureCount", created_at as "createdAt"
             FROM user_webhooks WHERE user_id = ? ORDER BY created_at DESC`,
        [userId]
      );

      // Parse events JSON defensively — a malformed row must not 500 the whole list.
      const parsed = (webhooks as any[]).map((w) => {
        let events: unknown = [];
        try {
          events = JSON.parse(w.events || '[]');
        } catch {
          events = [];
        }
        return { ...w, events };
      });

      return res.json({ webhooks: parsed });
    } catch (err: any) {
      // Degrade to an empty list rather than a bare 500 / DegradedState on a transient error.
      logger.error('[settings] Error fetching webhooks:', err);
      return res.json({ webhooks: [] });
    }
  })
);

/**
 * POST /api/settings/webhooks
 */
router.post(
  '/webhooks',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { name, url, events, headers } = req.body;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });
    if (!name || !url || !events?.length) {
      return res.status(400).json({ error: 'Name, URL, and events are required' });
    }

    await ensureUserWebhooksTable();

    const { v4: uuidv4 } = await import('uuid');
    const id = uuidv4();
    const secret = `whsec_${generateApiKey().replace('ck_', '')}`;

    await dbRun(
      `INSERT INTO user_webhooks (id, user_id, name, url, events, secret, headers)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, name, url, JSON.stringify(events), secret, JSON.stringify(headers || {})]
    );

    logger.info(`[settings] Webhook created for user ${userId}`);
    return res.json({ success: true, webhook: { id, name, url, events, secret } });
  })
);

/**
 * PUT /api/settings/webhooks/:id
 */
router.put(
  '/webhooks/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { id } = req.params;
    const { name, url, events, headers, isActive, secret } = req.body;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await ensureUserWebhooksTable();

    await dbRun(
      `UPDATE user_webhooks SET 
                name = COALESCE(?, name),
                url = COALESCE(?, url),
                events = COALESCE(?, events),
                headers = COALESCE(?, headers),
                secret = COALESCE(?, secret),
                is_active = COALESCE(?, is_active),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND user_id = ?`,
      [
        name,
        url,
        events ? JSON.stringify(events) : null,
        headers ? JSON.stringify(headers) : null,
        secret ?? null,
        isActive,
        id,
        userId,
      ]
    );

    return res.json({ success: true });
  })
);

/**
 * DELETE /api/settings/webhooks/:id
 */
router.delete(
  '/webhooks/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await ensureUserWebhooksTable();
    await dbRun(`DELETE FROM user_webhooks WHERE id = ? AND user_id = ?`, [id, userId]);

    logger.info(`[settings] Webhook ${id} deleted for user ${userId}`);
    return res.json({ success: true });
  })
);

/**
 * POST /api/settings/webhooks/:id/test
 */
router.post(
  '/webhooks/:id/test',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await ensureUserWebhooksTable();

    const webhook = await dbGet<{ url: string; secret: string }>(
      `SELECT url, secret FROM user_webhooks WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    if (!webhook) return res.status(404).json({ error: 'Webhook not found' });

    try {
      const testPayload = {
        event: 'test',
        timestamp: new Date().toISOString(),
        data: { message: 'This is a test webhook from Consultify' },
      };

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': webhook.secret || '',
        },
        body: JSON.stringify(testPayload),
      });

      await dbRun(
        `UPDATE user_webhooks SET last_triggered_at = CURRENT_TIMESTAMP, last_status = ?
                 WHERE id = ?`,
        [response.status, id]
      );

      return res.json({
        success: response.ok,
        status: response.status,
        message: response.ok ? 'Webhook test successful' : 'Webhook returned non-200 status',
      });
    } catch (err: any) {
      // H6.4 500-leak sweep: `err.message` here can be a DB-driver error from
      // the `dbRun` call below (not only a network-test diagnostic) —
      // never echo it raw. Logged server-side for support/debugging.
      logger.warn('[settings] Webhook test failed', { err });
      await dbRun(`UPDATE user_webhooks SET failure_count = failure_count + 1 WHERE id = ?`, [id]);
      return res.json({
        success: false,
        error: 'Webhook test failed. Check the URL and try again.',
      });
    }
  })
);

// ===========================================
// APPEARANCE & THEME SETTINGS
// ===========================================

/**
 * GET /api/settings/preferences/appearance
 * Get user's appearance preferences (theme, UI density, font scale, etc.)
 */
router.get(
  '/preferences/appearance',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    const defaultPreferences = {
      theme: 'system',
      accentColor: '#6366f1',
      uiDensity: 'comfortable',
      fontScale: 1,
      startPage: 'dashboard',
      sidebarCollapsed: false,
      animations: true,
      reducedMotion: false,
    };

    try {
      await ensureUserPreferencesTable();

      const row = await dbGet<{ preferences_data: string }>(
        `SELECT value AS preferences_data FROM user_preferences WHERE user_id = ? AND key = ?`,
        [userId, preferencesKey('appearance')],
        { fallback: false }
      );

      if (!row) {
        return res.json({ preferences: defaultPreferences });
      }

      try {
        const preferences = JSON.parse(row.preferences_data);
        return res.json({ preferences: { ...defaultPreferences, ...preferences } });
      } catch {
        return res.json({ preferences: defaultPreferences });
      }
    } catch (err: any) {
      // A transient DB error must not turn a settings read into a DegradedState 500.
      // Serve defaults so the panel still renders; the client-side save path will
      // surface a real error if persistence is actually broken.
      logger.error('[settings] Error fetching appearance preferences:', err);
      return res.json({ preferences: defaultPreferences });
    }
  })
);

/**
 * PUT /api/settings/preferences/appearance
 * Update user's appearance preferences
 */
router.put(
  '/preferences/appearance',
  verifyToken,
  requireActiveMembership,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const preferences = req.body;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await ensureUserPreferencesTable();

    // Get existing preferences
    const existing = await dbGet<{ preferences_data: string }>(
      `SELECT value AS preferences_data FROM user_preferences WHERE user_id = ? AND key = ?`,
      [userId, preferencesKey('appearance')],
      { fallback: false }
    );

    let merged = preferences;
    if (existing) {
      try {
        const existingData = JSON.parse(existing.preferences_data);
        merged = { ...existingData, ...preferences };
      } catch {
        // ignore parse error
      }
    }

    const result = await upsertUserPreferenceValue(
      userId,
      preferencesKey('appearance'),
      JSON.stringify(merged)
    );
    if (!result.success) throw new Error(result.error || 'Failed to save preference');

    // Log to audit
    await logSettingsChange(userId, 'appearance', 'preferences', 'updated', null, merged);

    logger.info(`[settings] Appearance preferences updated for user ${userId}`);
    return res.json({ success: true, preferences: merged });
  })
);

// ===========================================
// DEVELOPER SETTINGS
// ===========================================

/**
 * Ensure developer_settings table exists
 */
const ensureDeveloperSettingsTable = async () => {
  await dbRun(`
        CREATE TABLE IF NOT EXISTS developer_settings (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL UNIQUE,
            developer_mode INTEGER DEFAULT 0,
            api_logging INTEGER DEFAULT 0,
            verbose_errors INTEGER DEFAULT 0,
            show_debug_info INTEGER DEFAULT 0,
            beta_features TEXT DEFAULT '[]',
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);
  await dbRun(
    `CREATE INDEX IF NOT EXISTS idx_developer_settings_user ON developer_settings(user_id)`
  );
};

/**
 * GET /api/settings/developer
 * Get user's developer settings
 */
router.get(
  '/developer',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    const defaultSettings = {
      developerMode: false,
      apiLogging: false,
      verboseErrors: false,
      showDebugInfo: false,
      betaFeatures: [],
    };

    // Fail-soft: lazy DDL must not surface as a bare 500 on a read.
    try {
      await ensureDeveloperSettingsTable();

      const row = await dbGet<any>(`SELECT * FROM developer_settings WHERE user_id = ?`, [userId]);

      if (!row) {
        return res.json({ settings: defaultSettings });
      }

      return res.json({
        settings: {
          developerMode: !!row.developer_mode,
          apiLogging: !!row.api_logging,
          verboseErrors: !!row.verbose_errors,
          showDebugInfo: !!row.show_debug_info,
          betaFeatures: JSON.parse(row.beta_features || '[]'),
        },
      });
    } catch (err) {
      console.error('[settings] GET /developer failed (fail-soft, returning defaults):', err);
      return res.json({ settings: defaultSettings });
    }
  })
);

/**
 * PUT /api/settings/developer
 * Update user's developer settings
 */
router.put(
  '/developer',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { developerMode, apiLogging, verboseErrors, showDebugInfo, betaFeatures } = req.body;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await ensureDeveloperSettingsTable();

    const existing = await dbGet<{ id: string }>(
      `SELECT id FROM developer_settings WHERE user_id = ?`,
      [userId]
    );

    const { v4: uuidv4 } = await import('uuid');
    const id = existing?.id || uuidv4();

    const result = await dbRun(
      `INSERT INTO developer_settings
             (id, user_id, developer_mode, api_logging, verbose_errors, show_debug_info, beta_features, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT (user_id) DO UPDATE SET
               developer_mode = EXCLUDED.developer_mode,
               api_logging = EXCLUDED.api_logging,
               verbose_errors = EXCLUDED.verbose_errors,
               show_debug_info = EXCLUDED.show_debug_info,
               beta_features = EXCLUDED.beta_features,
               updated_at = CURRENT_TIMESTAMP`,
      [
        id,
        userId,
        developerMode ? 1 : 0,
        apiLogging ? 1 : 0,
        verboseErrors ? 1 : 0,
        showDebugInfo ? 1 : 0,
        JSON.stringify(betaFeatures || []),
      ],
      { fallback: false }
    );
    if (!result.success) throw new Error(result.error || 'Failed to save developer settings');

    // Log to audit
    await logSettingsChange(userId, 'developer', 'settings', 'updated', null, req.body);

    logger.info(`[settings] Developer settings updated for user ${userId}`);
    return res.json({ success: true });
  })
);

// ===========================================
// API KEY USAGE STATS
// ===========================================

/**
 * GET /api/settings/api-keys/:id/usage
 * Get usage statistics for an API key
 */
router.get(
  '/api-keys/:id/usage',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await ensureUserApiKeysTable();

    // Verify key belongs to user
    const key = await dbGet<{ id: string }>(
      `SELECT id FROM user_api_keys WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    if (!key) {
      return res.status(404).json({ error: 'API key not found' });
    }

    // Check if api_logs table exists and get usage
    try {
      const usageStats = await dbGet<{ requests: number; tokens: number }>(
        `SELECT 
                    COUNT(*) as requests,
                    COALESCE(SUM(CAST(json_extract(metadata, '$.tokens') AS INTEGER)), 0) as tokens
                 FROM api_logs 
                 WHERE api_key_id = ? AND created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'`,
        [id]
      );

      // Estimate cost (rough: $0.002 per 1K tokens)
      const tokens = usageStats?.tokens || 0;
      const cost = (tokens / 1000) * 0.002;

      return res.json({
        requests: usageStats?.requests || 0,
        tokens: tokens,
        cost: Math.round(cost * 100) / 100,
        period: '30d',
      });
    } catch {
      // api_logs table might not exist
      return res.json({ requests: 0, tokens: 0, cost: 0, period: '30d' });
    }
  })
);

// ===========================================
// LOGIN HISTORY
// ===========================================

/**
 * GET /api/settings/login-history
 * Get user's login history
 */
router.get(
  '/login-history',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    try {
      // Try to get from security_events table
      const events = await dbAll(
        `SELECT id, type, title, description, ip_address, location, device, created_at
                 FROM security_events 
                 WHERE user_id = ? AND type IN ('login', 'logout', 'login_failed')
                 ORDER BY created_at DESC
                 LIMIT ?`,
        [userId, limit]
      );

      if (events.length > 0) {
        return res.json({
          history: events.map((e: any) => ({
            id: e.id,
            type: e.type,
            title: e.title,
            description: e.description,
            ipAddress: e.ip_address,
            location: e.location,
            device: e.device,
            timestamp: e.created_at,
          })),
        });
      }

      // Fallback: try login_history table
      const history = await dbAll(
        `SELECT * FROM login_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
        [userId, limit]
      );

      return res.json({
        history: history.map((h: any) => ({
          id: h.id,
          type: 'login',
          title: 'Login',
          description: h.status === 'success' ? 'Successful login' : 'Failed login attempt',
          ipAddress: h.ip_address,
          location: h.location,
          device: h.device || h.user_agent,
          timestamp: h.created_at,
        })),
      });
    } catch {
      // Tables might not exist
      return res.json({ history: [] });
    }
  })
);

// ===========================================
// CONNECTED ACCOUNTS (T112)
// ===========================================

/**
 * GET /api/settings/connected-accounts
 * Returns list of OAuth-connected providers for current user
 */
router.get(
  '/connected-accounts',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    try {
      const { oauthService } = await import('../services/oauthService.js');
      const accounts = await oauthService.getConnectedAccounts(userId);
      return res.json({ accounts });
    } catch (err: any) {
      logger.error(`[settings] Failed to get connected accounts: ${err.message}`);
      return res.json({ accounts: [] });
    }
  })
);

/**
 * DELETE /api/settings/connected-accounts/:provider
 * Disconnect a provider (e.g. linkedin, google)
 */
router.delete(
  '/connected-accounts/:provider',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { provider } = req.params;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    try {
      const { oauthService } = await import('../services/oauthService.js');
      const result = await oauthService.disconnectAccount(provider, userId);

      if ('error' in result) {
        return res.status(400).json({ error: result.error });
      }

      // Log security event
      try {
        const { default: securityService } = await import('../services/securityService.js');
        await securityService.logSecurityEvent({
          userId,
          eventType: 'oauth_unlinked',
          severity: 'info',
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          details: { provider },
        });
      } catch {
        // non-fatal
      }

      return res.json({ success: true });
    } catch (err: any) {
      logger.error(`[settings] Failed to disconnect ${provider}`, {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Failed to disconnect account',
        code: 'SETTINGS_ACCOUNT_DISCONNECT_FAILED',
      });
    }
  })
);

/**
 * Helper function to log settings changes to audit log
 */
async function logSettingsChange(
  userId: string,
  category: string,
  settingKey: string,
  action: string,
  oldValue: any,
  newValue: any
) {
  try {
    await ensureSettingsAuditLogTable();
    const { v4: uuidv4 } = await import('uuid');
    await dbRun(
      `INSERT INTO settings_audit_log (id, user_id, category, setting_key, action, old_value, new_value)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        userId,
        category,
        settingKey,
        action,
        oldValue ? JSON.stringify(oldValue) : null,
        newValue ? JSON.stringify(newValue) : null,
      ]
    );
  } catch (err) {
    logger.warn(`[settings] Failed to log settings change: ${err}`);
  }
}

async function applySettingsPayload(userId: string, settings: Record<string, unknown>) {
  await ensureUserPreferencesTable();

  for (const [type, value] of Object.entries(settings || {})) {
    const result = await upsertUserPreferenceValue(
      userId,
      preferencesKey(type),
      JSON.stringify(value)
    );
    if (!result.success) throw new Error(result.error || `Failed to apply setting ${type}`);
  }
}

async function restoreSettingsValue(
  userId: string,
  category: string,
  value: Record<string, unknown>
) {
  if (category === 'developer') {
    await ensureDeveloperSettingsTable();
    const existing = await dbGet<{ id: string }>(
      `SELECT id FROM developer_settings WHERE user_id = ?`,
      [userId]
    );
    const { v4: uuidv4 } = await import('uuid');
    const id = existing?.id || uuidv4();

    const result = await dbRun(
      `INSERT INTO developer_settings
         (id, user_id, developer_mode, api_logging, verbose_errors, show_debug_info, beta_features, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         developer_mode = EXCLUDED.developer_mode,
         api_logging = EXCLUDED.api_logging,
         verbose_errors = EXCLUDED.verbose_errors,
         show_debug_info = EXCLUDED.show_debug_info,
         beta_features = EXCLUDED.beta_features,
         updated_at = CURRENT_TIMESTAMP`,
      [
        id,
        userId,
        value?.developerMode ? 1 : 0,
        value?.apiLogging ? 1 : 0,
        value?.verboseErrors ? 1 : 0,
        value?.showDebugInfo ? 1 : 0,
        JSON.stringify(value?.betaFeatures || []),
      ],
      { fallback: false }
    );
    if (!result.success) throw new Error(result.error || 'Failed to restore developer settings');
    return;
  }

  await applySettingsPayload(userId, { [category]: value });
}

// ==========================================
// SETTINGS REGISTRY — P31 §2.3.2-§2.3.6
// ==========================================

router.get(
  '/registry',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { default: registryService } = await import('../services/settingsRegistryService.js');
    const scope = req.query.scope as string | undefined;
    const owner = req.query.owner as string | undefined;

    let keys = registryService.getRegistry();
    if (scope) keys = keys.filter((k) => k.scope === scope);
    if (owner) keys = keys.filter((k) => k.ownerContract === owner);

    res.json({ keys, total: keys.length });
  })
);

router.get(
  '/registry/:key/metadata',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { default: registryService } = await import('../services/settingsRegistryService.js');
    const meta = registryService.getKeyMetadata(req.params.key);
    if (!meta) {
      const denial = registryService.buildDenialResponse(req.params.key, 'not_found');
      return res.status(denial.status).json(denial);
    }
    res.json(meta);
  })
);

router.get(
  '/registry/:key/resolve',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { default: registryService } = await import('../services/settingsRegistryService.js');
    const userId = req.userId || req.user?.id;
    const orgId = req.user?.organizationId;

    try {
      const result = await registryService.resolveEffectiveValue(req.params.key, userId!, orgId);
      res.json(result);
    } catch {
      const denial = registryService.buildDenialResponse(req.params.key, 'resolver_unavailable');
      return res.status(denial.status).json(denial);
    }
  })
);

router.put(
  '/registry/:key',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { default: registryService } = await import('../services/settingsRegistryService.js');
    const meta = registryService.getKeyMetadata(req.params.key);
    if (!meta) {
      const denial = registryService.buildDenialResponse(req.params.key, 'not_found');
      return res.status(denial.status).json(denial);
    }

    const userRole = getSettingsActorRole(req);
    const routing = registryService.checkWriteRouting(req.params.key, userRole);

    if (!routing.allowed) {
      const denial = registryService.buildDenialResponse(
        req.params.key,
        meta.readOnlyInSettings || meta.managedIn !== 'settings' ? 'read_only' : 'permission_denied'
      );
      return res.status(denial.status).json({
        ...denial,
        guidance: routing.guidance || denial.guidance,
        routeTo: denial.routeTo || routing.routeTo,
      });
    }

    if (meta?.confirmationGate && !req.body.confirmed) {
      return res.status(428).json({
        code: 'CONFIRMATION_REQUIRED',
        message: `Changing "${req.params.key}" requires confirmation. ${meta.impactLanguage}`,
        impactLanguage: meta.impactLanguage,
        impactedSurface: meta.impactedSurface,
      });
    }

    const userId = req.userId || req.user?.id;
    const organizationId = req.user?.organizationId;
    const { value } = req.body;
    const writeTarget = registryService.getWriteTarget(
      req.params.key,
      userRole,
      req.body.targetScope
    );

    if (writeTarget === 'blocked') {
      const denial = registryService.buildDenialResponse(req.params.key, 'permission_denied');
      return res.status(denial.status).json(denial);
    }

    if (writeTarget === 'personal') {
      await dbRun(
        'INSERT INTO user_preferences (user_id, key, value, updated_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) ON CONFLICT (user_id, key) DO UPDATE SET value = $3, updated_at = CURRENT_TIMESTAMP',
        [
          userId,
          `settings:${meta.key}`,
          typeof value === 'object' ? JSON.stringify(value) : String(value),
        ],
        { fallback: false }
      );
    } else {
      if (!organizationId) {
        return res
          .status(400)
          .json({ error: 'Organization context is required for non-personal settings writes.' });
      }

      const storeKey =
        writeTarget === 'tenant'
          ? `tenant:${organizationId}:${meta.key}`
          : `module:${organizationId}:${meta.moduleId}:${meta.key}`;
      await upsertSettingsValue(
        storeKey,
        typeof value === 'object' ? JSON.stringify(value) : String(value)
      );
    }

    // Audit log (best-effort)
    try {
      const crypto = await import('crypto');
      await dbRun(
        'INSERT INTO settings_audit_log (id, user_id, category, setting_key, action, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [crypto.randomUUID(), userId, writeTarget, meta.key, 'updated', null, String(value)],
        { fallback: true }
      );
    } catch {
      /* audit best-effort */
    }

    res.json({
      success: true,
      key: meta.key,
      scope: meta.scope,
      storedAs: writeTarget,
      impactLanguage: meta.impactLanguage,
    });
  })
);

export default router;
