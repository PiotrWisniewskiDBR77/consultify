// @ts-nocheck
/**
 * AI Settings Service (SuperAdmin → Org → User)
 * Minimal but persistent implementation backed by SQLite tables created in migration 090_ai_settings_system.sql.sql
 *
 * Supported methods (used by ai-settings.routes.ts):
 * - getSuperAdminSettings / updateSuperAdminSettings
 * - getOrgSettings / updateOrgSettings
 * - getUserSettings / updateUserSettings
 * - getEffectiveSettings (merged superadmin + org + user)
 * - getAvailableModels (active providers)
 * - getAuditLog (settings changes)
 * - getUserCostHistory / getOrgCostAttribution (from ai_usage_logs)
 * - getOrgUserTiers / assignUserTier (lightweight store)
 * - generateComplianceReport (DB-backed summary; no degraded PDF fallback)
 */

import { v4 as uuidv4Default } from 'uuid';

import {
  all as dbAllDefault,
  get as dbGetDefault,
  run as dbRunDefault,
} from '../utils/DbPromise.js';
import { AppError } from '../utils/ErrorHandler.js';
import logger from '../utils/Logger.js';

// Mutable bindings so tests can inject a mock db (see setDependencies below).
// The single-arg DbPromise overloads used throughout this file (dbAll(sql,
// params), dbGet(sql, params), dbRun(sql, params)) resolve the db via the
// production getDatabase() singleton internally — there was previously no
// way to point them at a test double at all. Every call site in this file
// already calls these as free functions (not imports fixed at load time), so
// rebinding them here is a drop-in fix with no call-site changes needed.
let dbAll = dbAllDefault;
let dbGet = dbGetDefault;
let dbRun = dbRunDefault;
let uuidv4 = uuidv4Default;

/**
 * Inject test dependencies. Without this, mocks.db passed by tests had zero
 * effect — every method kept hitting the real database singleton.
 */
const setDependencies = (newDeps: { db?: any; uuidv4?: () => string } = {}): void => {
  if (newDeps.db) {
    const injectedDb = newDeps.db;
    dbAll = ((sql: string, params?: unknown[], options?: any) =>
      dbAllDefault(injectedDb, sql, params, options)) as typeof dbAllDefault;
    dbGet = ((sql: string, params?: unknown[], options?: any) =>
      dbGetDefault(injectedDb, sql, params, options)) as typeof dbGetDefault;
    dbRun = ((sql: string, params?: unknown[], options?: any) =>
      dbRunDefault(injectedDb, sql, params, options)) as typeof dbRunDefault;
  }
  if (newDeps.uuidv4) {
    uuidv4 = newDeps.uuidv4;
  }
};

const dateWindowSql = (days: number) => `CURRENT_TIMESTAMP - INTERVAL '${days} days'`;

// Helper: safe JSON parse
const parseJSON = <T>(value: any, fallback: T): T => {
  if (value === null || value === undefined) return fallback;
  try {
    if (typeof value === 'string') return JSON.parse(value) as T;
    return value as T;
  } catch {
    return fallback;
  }
};

// Helper: write audit entry
const logAudit = async (opts: {
  level: 'superadmin' | 'admin' | 'user';
  actorId: string;
  actorRole: string;
  targetId: string;
  settingKey: string;
  oldValue: any;
  newValue: any;
  ip?: string | null;
  userAgent?: string | null;
}) => {
  await dbRun(
    `INSERT INTO ai_settings_audit (id, level, actor_id, actor_role, target_id, setting_key, old_value, new_value, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      opts.level,
      opts.actorId,
      opts.actorRole,
      opts.targetId,
      opts.settingKey,
      JSON.stringify(opts.oldValue ?? null),
      JSON.stringify(opts.newValue ?? null),
      opts.ip || null,
      opts.userAgent || null,
    ]
  );
};

// Defaults aligned with UI expectations
const DEFAULT_SUPERADMIN = {
  default_provider: 'gpt-4o',
  fallback_chain: [],
  circuit_breaker_config: { failureThreshold: 5, cooldownSeconds: 60 },
  global_token_limit: 10_000_000,
  global_rate_limit: { requestsPerMinute: 60, requestsPerHour: 1000 },
  max_context_window_size: 128000,
  max_tokens_per_request: 8192,
  pii_detection_sensitivity: 'medium',
  require_encryption: true,
  data_residency: null,
};

const DEFAULT_ORG = {
  policy_level: 'ADVISORY',
  max_policy_level: 'ASSISTED',
  default_proactivity_mode: 'BALANCED',
  active_roles: ['ADVISOR'],
  default_role: 'ADVISOR',
  enabled_model_ids: [],
  max_ai_calls_per_day: 100,
  max_tokens_per_month: 500000,
  monthly_budget_usd: 0,
  hard_limit_usd: 0,
  freeze_on_limit: false,
  web_search_enabled: true,
  artifacts_enabled: true,
  thinking_steps_enabled: true,
  focus_modes_enabled: true,
  voice_enabled: false,
  audit_all_requests: false,
  audit_policy_changes: true,
};

const DEFAULT_USER = {
  response_style: 'balanced',
  writing_tone: 'professional',
  preferred_language: 'auto',
  code_explanations: true,
  show_sources: true,
  proactivity_mode: 'BALANCED',
  model_temperature: 0.7,
  max_tokens: 4096,
  top_p: 1,
  frequency_penalty: 0,
  presence_penalty: 0,
  system_instructions: '',
  visible_model_ids: [],
  preferred_model_id: null,
  enable_pii_redaction: false,
  data_retention_policy: 'standard',
  share_usage_analytics: true,
  context_retention: 'session',
  auto_suggestions: true,
};

// Ensure lightweight table for tiers (if not present).
// Reproducible from server/migrations/20260903_ai_user_tiers.sql — this
// runtime DDL is a compatibility fallback for DBs that predate that
// migration, kept in sync with it. TIMESTAMPTZ (not DATETIME): DbPromise's
// `run()` adapts DATETIME->TIMESTAMP for Postgres via adaptQuery, but the
// column type is written explicitly here so it stays correct even if this
// call is ever moved to a DB method that bypasses that adapter (see
// commit 5b5c0e3849 — emailVerificationService hit exactly that via
// DbPromise.exec(), which does not adaptQuery, and failed with
// Postgres 42704 "type \"datetime\" does not exist").
const ensureUserTiersTable = async () => {
  // G14 13-16 (dyżur 2026-09-03) — ten runtime DDL wołany BEZWARUNKOWO z
  // getOrgUserTiers/assignUserTier (ekran „Model Tier Assignments") nie miał
  // try/catch: na środowisku, gdzie migracja 20260903_ai_user_tiers.sql
  // jeszcze nie przeszła (świeży Postgres, odtworzenie po awarii), pierwsze
  // wejście na ten ekran rzuca NIEOBSŁUŻONE odrzucenie — dokładnie ten sam
  // wzorzec, który już raz ubił proces serwera przy `email_verification_tokens`
  // (commit 5b5c0e3849). Wzorzec best-effort z `chatTraceService.ts`
  // (`ensureTables`): CREATE TABLE IF NOT EXISTS jest idempotentny — połknięty
  // błąd nie maskuje realnej awarii zapisu/odczytu niżej (te wołania rzucają
  // własne błędy niezależnie), tylko chroni PRZED wejściem do bloku, który go
  // nie potrzebuje (bo migracja już go stworzyła).
  try {
    await dbRun(
      `
          CREATE TABLE IF NOT EXISTS ai_user_tiers (
              organization_id TEXT NOT NULL,
              user_id TEXT NOT NULL,
              tier TEXT NOT NULL,
              created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (organization_id, user_id)
          )
      `,
      []
    );
  } catch (err) {
    logger.warn('[AISettingsService] ensureUserTiersTable degraded (table may already exist via migration): ', err);
  }
};

class AISettingsService {
  static setDependencies = setDependencies;

  // SUPERADMIN
  static async getSuperAdminSettings() {
    try {
      const row = await dbGet('SELECT * FROM superadmin_ai_settings WHERE id = ?', ['global']);
      if (!row) return DEFAULT_SUPERADMIN;
      return {
        ...DEFAULT_SUPERADMIN,
        default_provider: row.default_provider || DEFAULT_SUPERADMIN.default_provider,
        fallback_chain: parseJSON(row.fallback_chain, DEFAULT_SUPERADMIN.fallback_chain),
        circuit_breaker_config: parseJSON(
          row.circuit_breaker_config,
          DEFAULT_SUPERADMIN.circuit_breaker_config
        ),
        global_token_limit: row.global_token_limit ?? DEFAULT_SUPERADMIN.global_token_limit,
        global_rate_limit: parseJSON(row.global_rate_limit, DEFAULT_SUPERADMIN.global_rate_limit),
        max_context_window_size:
          row.max_context_window_size ?? DEFAULT_SUPERADMIN.max_context_window_size,
        max_tokens_per_request:
          row.max_tokens_per_request ?? DEFAULT_SUPERADMIN.max_tokens_per_request,
        pii_detection_sensitivity:
          row.pii_detection_sensitivity || DEFAULT_SUPERADMIN.pii_detection_sensitivity,
        require_encryption: !!row.require_encryption,
        data_residency: row.data_residency || null,
      };
    } catch (err) {
      logger.error('[AISettingsService] Error in getSuperAdminSettings:', err);
      return DEFAULT_SUPERADMIN;
    }
  }

  static async updateSuperAdminSettings(
    settings: any,
    actorId: string,
    actorRole: string,
    ip?: string | null,
    ua?: string | null
  ) {
    const current = await this.getSuperAdminSettings();
    await dbRun(
      `INSERT INTO superadmin_ai_settings (id, default_provider, fallback_chain, circuit_breaker_config, global_token_limit, global_rate_limit, max_context_window_size, max_tokens_per_request, pii_detection_sensitivity, require_encryption, data_residency, updated_at, updated_by)
             VALUES ('global', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
             ON CONFLICT(id) DO UPDATE SET 
                default_provider=excluded.default_provider,
                fallback_chain=excluded.fallback_chain,
                circuit_breaker_config=excluded.circuit_breaker_config,
                global_token_limit=excluded.global_token_limit,
                global_rate_limit=excluded.global_rate_limit,
                max_context_window_size=excluded.max_context_window_size,
                max_tokens_per_request=excluded.max_tokens_per_request,
                pii_detection_sensitivity=excluded.pii_detection_sensitivity,
                require_encryption=excluded.require_encryption,
                data_residency=excluded.data_residency,
                updated_at=CURRENT_TIMESTAMP,
                updated_by=excluded.updated_by`,
      [
        settings.default_provider ?? current.default_provider,
        JSON.stringify(settings.fallback_chain ?? current.fallback_chain),
        JSON.stringify(settings.circuit_breaker_config ?? current.circuit_breaker_config),
        settings.global_token_limit ?? current.global_token_limit,
        JSON.stringify(settings.global_rate_limit ?? current.global_rate_limit),
        settings.max_context_window_size ?? current.max_context_window_size,
        settings.max_tokens_per_request ?? current.max_tokens_per_request,
        settings.pii_detection_sensitivity ?? current.pii_detection_sensitivity,
        (settings.require_encryption ?? current.require_encryption) ? 1 : 0,
        settings.data_residency ?? current.data_residency,
        actorId,
      ]
    );

    await logAudit({
      level: 'superadmin',
      actorId,
      actorRole,
      targetId: 'global',
      settingKey: 'superadmin_settings',
      oldValue: current,
      newValue: settings,
      ip,
      userAgent: ua,
    });

    return this.getSuperAdminSettings();
  }

  // ORG
  static async getOrgSettings(orgId: string) {
    try {
      const row = await dbGet('SELECT * FROM organization_ai_settings WHERE organization_id = ?', [
        orgId,
      ]);
      if (!row) return { ...DEFAULT_ORG, organization_id: orgId };
      return {
        organization_id: row.organization_id,
        policy_level: row.policy_level,
        max_policy_level: row.max_policy_level,
        default_proactivity_mode: row.default_proactivity_mode,
        active_roles: parseJSON(row.active_roles, DEFAULT_ORG.active_roles),
        default_role: row.default_role,
        enabled_model_ids: parseJSON(row.enabled_model_ids, DEFAULT_ORG.enabled_model_ids),
        max_ai_calls_per_day: row.max_ai_calls_per_day,
        max_tokens_per_month: row.max_tokens_per_month,
        monthly_budget_usd: row.monthly_budget_usd,
        hard_limit_usd: row.hard_limit_usd,
        freeze_on_limit: !!row.freeze_on_limit,
        web_search_enabled: !!row.web_search_enabled,
        artifacts_enabled: !!row.artifacts_enabled,
        thinking_steps_enabled: !!row.thinking_steps_enabled,
        focus_modes_enabled: !!row.focus_modes_enabled,
        voice_enabled: !!row.voice_enabled,
        audit_all_requests: !!row.audit_all_requests,
        audit_policy_changes: !!row.audit_policy_changes,
      };
    } catch (err) {
      logger.error('[AISettingsService] Error in getOrgSettings:', err);
      return { ...DEFAULT_ORG, organization_id: orgId };
    }
  }

  static async updateOrgSettings(
    orgId: string,
    settings: any,
    actorId: string,
    actorRole: string,
    ip?: string | null,
    ua?: string | null
  ) {
    const current = await this.getOrgSettings(orgId);
    await dbRun(
      `INSERT INTO organization_ai_settings (
                organization_id, policy_level, max_policy_level, default_proactivity_mode,
                active_roles, default_role, enabled_model_ids,
                max_ai_calls_per_day, max_tokens_per_month, monthly_budget_usd, hard_limit_usd, freeze_on_limit,
                web_search_enabled, artifacts_enabled, thinking_steps_enabled, focus_modes_enabled, voice_enabled,
                audit_all_requests, audit_policy_changes, updated_at, updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
            ON CONFLICT(organization_id) DO UPDATE SET
                policy_level=excluded.policy_level,
                max_policy_level=excluded.max_policy_level,
                default_proactivity_mode=excluded.default_proactivity_mode,
                active_roles=excluded.active_roles,
                default_role=excluded.default_role,
                enabled_model_ids=excluded.enabled_model_ids,
                max_ai_calls_per_day=excluded.max_ai_calls_per_day,
                max_tokens_per_month=excluded.max_tokens_per_month,
                monthly_budget_usd=excluded.monthly_budget_usd,
                hard_limit_usd=excluded.hard_limit_usd,
                freeze_on_limit=excluded.freeze_on_limit,
                web_search_enabled=excluded.web_search_enabled,
                artifacts_enabled=excluded.artifacts_enabled,
                thinking_steps_enabled=excluded.thinking_steps_enabled,
                focus_modes_enabled=excluded.focus_modes_enabled,
                voice_enabled=excluded.voice_enabled,
                audit_all_requests=excluded.audit_all_requests,
                audit_policy_changes=excluded.audit_policy_changes,
                updated_at=CURRENT_TIMESTAMP,
                updated_by=excluded.updated_by`,
      [
        orgId,
        settings.policy_level ?? current.policy_level,
        settings.max_policy_level ?? current.max_policy_level,
        settings.default_proactivity_mode ?? current.default_proactivity_mode,
        JSON.stringify(settings.active_roles ?? current.active_roles),
        settings.default_role ?? current.default_role,
        JSON.stringify(settings.enabled_model_ids ?? current.enabled_model_ids),
        settings.max_ai_calls_per_day ?? current.max_ai_calls_per_day,
        settings.max_tokens_per_month ?? current.max_tokens_per_month,
        settings.monthly_budget_usd ?? current.monthly_budget_usd,
        settings.hard_limit_usd ?? current.hard_limit_usd,
        (settings.freeze_on_limit ?? current.freeze_on_limit) ? 1 : 0,
        (settings.web_search_enabled ?? current.web_search_enabled) ? 1 : 0,
        (settings.artifacts_enabled ?? current.artifacts_enabled) ? 1 : 0,
        (settings.thinking_steps_enabled ?? current.thinking_steps_enabled) ? 1 : 0,
        (settings.focus_modes_enabled ?? current.focus_modes_enabled) ? 1 : 0,
        (settings.voice_enabled ?? current.voice_enabled) ? 1 : 0,
        (settings.audit_all_requests ?? current.audit_all_requests) ? 1 : 0,
        (settings.audit_policy_changes ?? current.audit_policy_changes) ? 1 : 0,
        actorId,
      ]
    );

    await logAudit({
      level: 'admin',
      actorId,
      actorRole,
      targetId: orgId,
      settingKey: 'org_settings',
      oldValue: current,
      newValue: settings,
      ip,
      userAgent: ua,
    });

    return this.getOrgSettings(orgId);
  }

  // USER
  static async getUserSettings(userId: string) {
    try {
      const row = await dbGet('SELECT * FROM user_ai_settings WHERE user_id = ?', [userId]);
      if (!row) return { ...DEFAULT_USER, user_id: userId };
      return {
        user_id: row.user_id,
        response_style: row.response_style,
        writing_tone: row.writing_tone,
        preferred_language: row.preferred_language,
        code_explanations: !!row.code_explanations,
        show_sources: !!row.show_sources,
        proactivity_mode: row.proactivity_mode,
        model_temperature: row.model_temperature,
        max_tokens: row.max_tokens,
        top_p: row.top_p,
        frequency_penalty: row.frequency_penalty,
        presence_penalty: row.presence_penalty,
        system_instructions: row.system_instructions,
        visible_model_ids: parseJSON(row.visible_model_ids, DEFAULT_USER.visible_model_ids),
        preferred_model_id: row.preferred_model_id,
        enable_pii_redaction: !!row.enable_pii_redaction,
        data_retention_policy: row.data_retention_policy,
        share_usage_analytics: !!row.share_usage_analytics,
        context_retention: row.context_retention,
        auto_suggestions: !!row.auto_suggestions,
      };
    } catch (err) {
      logger.error('[AISettingsService] Error in getUserSettings:', err);
      return { ...DEFAULT_USER, user_id: userId };
    }
  }

  static async updateUserSettings(
    userId: string,
    settings: any,
    actorId?: string,
    actorRole?: string,
    ip?: string | null,
    ua?: string | null
  ) {
    const current = await this.getUserSettings(userId);
    const result = await dbRun(
      `INSERT INTO user_ai_settings (
                user_id, response_style, writing_tone, preferred_language,
                code_explanations, show_sources, proactivity_mode,
                model_temperature, max_tokens, top_p, frequency_penalty, presence_penalty,
                system_instructions, visible_model_ids, preferred_model_id,
                enable_pii_redaction, data_retention_policy, share_usage_analytics, context_retention, auto_suggestions,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
                response_style=excluded.response_style,
                writing_tone=excluded.writing_tone,
                preferred_language=excluded.preferred_language,
                code_explanations=excluded.code_explanations,
                show_sources=excluded.show_sources,
                proactivity_mode=excluded.proactivity_mode,
                model_temperature=excluded.model_temperature,
                max_tokens=excluded.max_tokens,
                top_p=excluded.top_p,
                frequency_penalty=excluded.frequency_penalty,
                presence_penalty=excluded.presence_penalty,
                system_instructions=excluded.system_instructions,
                visible_model_ids=excluded.visible_model_ids,
                preferred_model_id=excluded.preferred_model_id,
                enable_pii_redaction=excluded.enable_pii_redaction,
                data_retention_policy=excluded.data_retention_policy,
                share_usage_analytics=excluded.share_usage_analytics,
                context_retention=excluded.context_retention,
                auto_suggestions=excluded.auto_suggestions,
                updated_at=CURRENT_TIMESTAMP`,
      [
        userId,
        settings.response_style ?? current.response_style,
        settings.writing_tone ?? current.writing_tone,
        settings.preferred_language ?? current.preferred_language,
        (settings.code_explanations ?? current.code_explanations) ? 1 : 0,
        (settings.show_sources ?? current.show_sources) ? 1 : 0,
        settings.proactivity_mode ?? current.proactivity_mode,
        settings.model_temperature ?? current.model_temperature,
        settings.max_tokens ?? current.max_tokens,
        settings.top_p ?? current.top_p,
        settings.frequency_penalty ?? current.frequency_penalty,
        settings.presence_penalty ?? current.presence_penalty,
        settings.system_instructions ?? current.system_instructions,
        JSON.stringify(settings.visible_model_ids ?? current.visible_model_ids),
        settings.preferred_model_id ?? current.preferred_model_id,
        (settings.enable_pii_redaction ?? current.enable_pii_redaction) ? 1 : 0,
        settings.data_retention_policy ?? current.data_retention_policy,
        (settings.share_usage_analytics ?? current.share_usage_analytics) ? 1 : 0,
        settings.context_retention ?? current.context_retention,
        (settings.auto_suggestions ?? current.auto_suggestions) ? 1 : 0,
      ],
      { fallback: false }
    );
    if (!result.success) {
      throw new Error(result.error || 'Failed to persist AI user settings');
    }

    if (actorId && actorRole) {
      await logAudit({
        level: 'user',
        actorId,
        actorRole,
        targetId: userId,
        settingKey: 'user_settings',
        oldValue: current,
        newValue: settings,
        ip,
        userAgent: ua,
      });
    }

    return this.getUserSettings(userId);
  }

  // EFFECTIVE SETTINGS
  static async getEffectiveSettings(userId: string, orgId: string) {
    try {
      const [superadmin, org, user] = await Promise.all([
        this.getSuperAdminSettings(),
        this.getOrgSettings(orgId),
        this.getUserSettings(userId),
      ]);
      const effective = {
        ...(superadmin || {}),
        ...(org || {}),
        ...(user || {}),
      };
      return { ...effective, superadmin, org, user };
    } catch (err) {
      logger.error('[AISettingsService] Error in getEffectiveSettings:', err);
      const superadmin = DEFAULT_SUPERADMIN;
      const org = { ...DEFAULT_ORG, organization_id: orgId };
      const user = { ...DEFAULT_USER, user_id: userId };
      const effective = { ...superadmin, ...org, ...user };
      return { ...effective, superadmin, org, user };
    }
  }

  // MODELS
  static async getAvailableModels(_userId: string, orgId: string) {
    try {
      // Return active providers; if org has enabled_model_ids, filter accordingly
      const providers = await dbAll('SELECT * FROM llm_providers WHERE is_active = 1', []);
      const org = await this.getOrgSettings(orgId);
      const enabled = org.enabled_model_ids;
      if (enabled && enabled.length > 0) {
        return (providers || []).filter((p: any) => enabled.includes(p.id));
      }
      return providers || [];
    } catch (err) {
      logger.error('[AISettingsService] Error in getAvailableModels:', err);
      throw new AppError('Available models are not available', 503, 'FEATURE_UNAVAILABLE', {
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // AUDIT LOG
  static async getAuditLog(filters: {
    level?: string;
    actorId?: string;
    targetId?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: string[] = [];
    const params: any[] = [];

    if (filters.level) {
      where.push('level = ?');
      params.push(filters.level);
    }
    if (filters.actorId) {
      where.push('actor_id = ?');
      params.push(filters.actorId);
    }
    if (filters.targetId) {
      where.push('target_id = ?');
      params.push(filters.targetId);
    }

    const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    const rows = await dbAll(
      `SELECT * FROM ai_settings_audit ${sqlWhere} ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const countRow = await dbGet(
      `SELECT COUNT(*) as total FROM ai_settings_audit ${sqlWhere}`,
      params
    );

    const safeRows = rows || [];
    return {
      total: countRow?.total || 0,
      rows: safeRows,
      entries: safeRows,
    };
  }

  // COST HISTORY (user)
  static async getUserCostHistory(userId: string, period: string = '7d') {
    const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
    const rows = await dbAll(
      `SELECT date(created_at) as date,
              COUNT(*) as requests,
              COALESCE(SUM(estimated_cost_usd), 0) as cost,
              COALESCE(SUM(tokens_used), 0) as tokens
             FROM ai_usage_logs
             WHERE user_id = ? AND created_at > ${dateWindowSql(days)}
             GROUP BY date(created_at)
             ORDER BY date(created_at)`,
      [userId]
    );
    return rows;
  }

  // ORG TIERS
  static async getOrgUserTiers(orgId: string) {
    await ensureUserTiersTable();
    return dbAll(
      'SELECT user_id, tier, created_at, updated_at FROM ai_user_tiers WHERE organization_id = ?',
      [orgId]
    );
  }

  static async assignUserTier(orgId: string, userId: string, tier: string) {
    await ensureUserTiersTable();
    await dbRun(
      `INSERT INTO ai_user_tiers (organization_id, user_id, tier, updated_at)
             VALUES (?, ?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(organization_id, user_id) DO UPDATE SET tier=excluded.tier, updated_at=CURRENT_TIMESTAMP`,
      [orgId, userId, tier]
    );
    return { organization_id: orgId, user_id: userId, tier };
  }

  // ORG COST ATTRIBUTION
  static async getOrgCostAttribution(orgId: string, period: string = '7d') {
    const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
    // NOTE: column was `cost_usd` (never existed on ai_usage_logs — real column is
    // `estimated_cost_usd`, see migration 605_ai_usage_logs_cost_contract_v3.sql, same
    // stale-schema bug fixed in aiObservabilityService.ts / getUserCostHistory above).
    // Was throwing "column does not exist" -> GET /api/ai-settings/org/:orgId/costs 500ed.
    const rows = await dbAll(
      `SELECT user_id, COALESCE(SUM(estimated_cost_usd), 0) as cost, COALESCE(SUM(tokens_used), 0) as tokens
             FROM ai_usage_logs
             WHERE organization_id = ? AND created_at > ${dateWindowSql(days)}
             GROUP BY user_id`,
      [orgId]
    );
    return rows;
  }

  // COMPLIANCE REPORT (DB-backed summary; no degraded PDF fallbacks)
  static async generateComplianceReport(orgId: string, standard: string, format: string = 'json') {
    const orgSettings = await this.getOrgSettings(orgId);
    const report = {
      orgId,
      standard,
      generatedAt: new Date().toISOString(),
      summary: {
        policyLevel: orgSettings.policy_level,
        auditEnabled: orgSettings.audit_all_requests,
        webSearchEnabled: orgSettings.web_search_enabled,
      },
      status: 'READY',
    };

    if (format === 'pdf') {
      throw new AppError(
        'Compliance report PDF export is not available',
        503,
        'FEATURE_UNAVAILABLE',
        { orgId, standard }
      );
    }
    return report;
  }
}

export default AISettingsService;
