/**
 * PostgreSQL Database Implementation
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Full TypeScript migration of database.postgres.js
 * Provides SQLite-compatible interface for PostgreSQL
 */

import { Client, Pool, type PoolClient, type PoolConfig, type QueryResultRow } from 'pg';

import databaseConfig from '../config/DatabaseConfig.js';
import logger from '../utils/Logger.js';
import { recordQueryPerformance } from '../utils/queryHelpers.js';
import { getConflictTarget, resolveConflictTargetSql } from './conflictTargets.js';
import type { IDatabase, QueryResult, RunResult } from './IDatabase.js';

let pool: Pool | null = null;
let readPool: Pool | null = null;
let initDbPromise: Promise<void> | null = null;
const SLOW_QUERY_THRESHOLD_MS = 1000;
let ensuredMissingDatabaseOnce = false;
let testDatabaseOverride: string | null = null;

function getPrimaryDbName(): string | null {
  const cfg = databaseConfig.postgres as PoolConfig | undefined;
  const name = (cfg as any)?.database ? String((cfg as any).database) : '';
  return name && name.trim() ? name.trim() : null;
}

async function ensureDatabaseExistsForTests(err: any): Promise<boolean> {
  if (process.env.NODE_ENV !== 'test') return false;
  if (!err || String(err.code || '') !== '3D000') return false; // invalid_catalog_name
  if (ensuredMissingDatabaseOnce) return false;
  ensuredMissingDatabaseOnce = true;

  const cfg = databaseConfig.postgres as PoolConfig | undefined;
  const dbName = getPrimaryDbName();
  if (!cfg || !dbName) return false;

  // Connect to admin DB (postgres) to create missing test DB.
  const adminCfg: PoolConfig = { ...(cfg as any), database: 'postgres' };
  const client = new Client(adminCfg);
  try {
    await client.connect();
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (!exists.rowCount) {
      const safeIdent = `"${dbName.replace(/"/g, '""')}"`;
      try {
        await client.query(`CREATE DATABASE ${safeIdent}`);
        logger.info('[Postgres] Created missing test database', { database: dbName });
      } catch (e: any) {
        // Common in local dev: user can connect but cannot create DBs.
        // Fall back to an existing DB so integration tests can still run.
        if (
          String(e?.message || '')
            .toLowerCase()
            .includes('permission denied')
        ) {
          testDatabaseOverride = 'postgres';
          logger.warn(
            '[Postgres] No permission to create test DB; falling back to postgres database',
            {
              requestedDatabase: dbName,
            }
          );
          return true;
        }
        throw e;
      }
    }
    return true;
  } catch (e: any) {
    logger.warn('[Postgres] Failed to auto-create missing test database (non-fatal)', {
      database: dbName,
      message: e?.message,
    });
    return false;
  } finally {
    try {
      await client.end();
    } catch {
      // ignore
    }
  }
}

function isDbReadOnlyEnabled(): boolean {
  const v = String(process.env.DB_READONLY || '')
    .trim()
    .toLowerCase();
  if (!v) return false;
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function looksLikeWriteQuery(sql: string): boolean {
  const s = String(sql || '')
    .trim()
    .toLowerCase();
  // Strip leading SQL comments (common in migrations / multi-statement scripts)
  const cleaned = s.replace(/^(?:\s*--.*\n|\s*\/\*[\s\S]*?\*\/\s*)+/g, '').trim();

  // Hard block any obvious mutating keywords anywhere.
  // We keep it conservative; false positives are acceptable in staging read-only.
  if (
    /\b(insert|update|delete|upsert|merge|truncate|create|alter|drop|grant|revoke|comment|vacuum|analyze|reindex)\b/.test(
      cleaned
    )
  )
    return true;

  // Non-mutating common statements
  if (cleaned.startsWith('select')) return false;
  if (cleaned.startsWith('with')) return false; // assume CTE is read-only unless it contains mutating keywords above
  if (cleaned.startsWith('show') || cleaned.startsWith('explain') || cleaned.startsWith('describe'))
    return false;

  // Default: treat as write/unsafe.
  return true;
}

function enforceReadOnly(sql: string): void {
  if (!isDbReadOnlyEnabled()) return;
  if (!looksLikeWriteQuery(sql)) return;
  const err: any = new Error(
    'DB is in read-only mode (DB_READONLY=1). Blocked a write query. Disable DB_READONLY to proceed.'
  );
  err.code = 'DB_READONLY';
  throw err;
}

// AUTO-GENERATED from live Postgres schema (parity pg18 :5443, dump of demo/staging TROLLEY).
// Regenerate when boolean columns change. See fix/sqlite-isms-runtime sweep 2026-07-19.
// Column names that are BOOLEAN in EVERY table that has them → 0/1 comparisons are always safe to rewrite.
const ALWAYS_BOOLEAN_COLUMNS = new Set<string>([
  'acted_upon',
  'adequacy_decision',
  'ai_suggested',
  'allow_password_login',
  'allow_tool_calling',
  'allow_web_research',
  'applied',
  'approved',
  'archived',
  'archived_via_session',
  'auto_payout_enabled',
  'auto_provision_users',
  'can_approve',
  'can_change_status',
  'can_edit',
  'can_generate_initiatives',
  'can_generate_report',
  'can_manage_team',
  'cancel_at_period_end',
  'certified',
  'completed',
  'compliance_mode',
  'confirmation_required',
  'converted',
  'credit_note_issued',
  'custom_domain_verified',
  'deaggregation_ready',
  'deletion_verified',
  'dkim_verified',
  'dmarc_verified',
  'dpa_signed',
  'email_digest_enabled',
  'email_enabled',
  'enable_max_mode',
  'enable_proactive_nudges',
  'enforce_eu_only',
  'enforce_sso',
  'featured',
  'flagged',
  'global_enabled',
  'hard_required',
  'has_tutorial',
  'hide_powered_by',
  'identity_verified',
  'improvement_applied',
  'invoice_created',
  'invoice_overdue',
  'invoice_paid',
  'is_allowed',
  'is_anonymous',
  'is_background',
  'is_beta',
  'is_blocker',
  'is_blocking',
  'is_canonical',
  'is_charge_refundable',
  'is_computed',
  'is_critical',
  'is_enterprise_only',
  'is_estimated',
  'is_hidden',
  'is_initialized',
  'is_locked',
  'is_manual',
  'is_manually_corrected',
  'is_milestone',
  'is_non_financial',
  'is_owner',
  'is_paused',
  'is_personal',
  'is_published',
  'is_retryable',
  'is_selected',
  'is_solution',
  'is_subtotal',
  'is_template',
  'is_throttled',
  'is_total',
  'is_user_configurable',
  'is_verified',
  'legal_hold_override',
  'locked',
  'manages_team',
  'notify_on_create',
  'notify_on_decision',
  'notify_on_escalation',
  'notify_on_update',
  'onboarding_completed',
  'passes_gate',
  'paused',
  'payment_failed',
  'payment_method_expiring',
  'payment_setup',
  'pii_flag',
  'privacy_accepted',
  'public_listing_enabled',
  'published',
  'quiet_hours_weekends_only',
  'readiness_allowed',
  'redacted',
  'regulatory_mode_enabled',
  'requires_acceptance',
  'retain',
  'sample_data_loaded',
  'scim_provisioned',
  'shared_to_project',
  'show_checklist',
  'show_company_logo',
  'show_confidentiality',
  'show_consultify_branding',
  'show_once',
  'show_page_numbers',
  'show_tutorial_tips',
  'signature_present',
  'signature_valid',
  'slack_dm_enabled',
  'slack_enabled',
  'spf_verified',
  'sponsor_mode',
  'starred',
  'subscription_canceled',
  'subscription_renewed',
  'teams_enabled',
  'terms_accepted',
  'throttled',
  'trusted',
  'usage_threshold_warning',
  'user_created',
  'was_helpful',
]);

// Tables whose named column is genuinely BOOLEAN, for column names that are AMBIGUOUS
// (BOOLEAN in some tables, INTEGER in others). Keyed by table → boolean-typed column names.
const AMBIGUOUS_BOOLEAN_TABLE_COLUMNS: Record<string, string[]> = {
  ai_actions: ['requires_approval'],
  ai_agent_plan_steps: ['requires_approval'],
  ai_budgets: ['is_active'],
  ai_dlp_rules: ['is_active'],
  ai_eval_auto_triggers: ['is_active'],
  ai_eval_golden_sets: ['is_active'],
  ai_feature_control: ['is_enabled'],
  ai_global_strategies: ['is_active'],
  ai_governance_policies: ['is_active'],
  ai_model_permissions: ['is_active'],
  ai_prompt_blocks: ['is_active'],
  ai_purpose_assignments: ['is_active'],
  ai_purposes: ['is_active'],
  ai_retention_schedule: ['is_active', 'notification_sent'],
  ai_system_prompts: ['is_active'],
  budget_overspend_signals: ['is_dismissed'],
  budget_scenarios: ['is_active'],
  budget_thresholds: ['is_active'],
  business_metrics: ['is_active'],
  candidate_profiles: ['is_active'],
  capabilities: ['is_active'],
  change_coaching_actions: ['is_global'],
  change_resistance_alerts: ['is_acknowledged'],
  communication_plans: ['is_active'],
  communication_templates: ['is_global'],
  competency_categories: ['is_active', 'is_system'],
  competency_levels: ['is_system'],
  consulting_templates: ['is_active'],
  decision_playbooks: ['is_active', 'is_default'],
  deck_comments: ['resolved'],
  delay_signals: ['is_dismissed'],
  document_studio_templates: ['is_system'],
  domain_verifications: ['ssl_auto_renew'],
  feature_flags: ['enabled'],
  financial_model_events: ['is_active'],
  financial_statement_lines: ['is_active', 'is_system'],
  financial_statement_templates: ['is_system'],
  help_articles: ['is_featured'],
  integration_api_keys: ['is_active'],
  integration_providers: ['is_active'],
  integration_webhooks: ['is_active'],
  interview_library_template_questions: ['is_required'],
  interview_library_templates: ['is_active', 'is_system'],
  interview_template_questions: ['is_required'],
  interview_templates: ['is_default'],
  knowledge_documents: ['is_active'],
  kpi_definitions: ['is_active', 'is_global'],
  legal_documents: ['is_active'],
  llm_providers: ['is_active', 'is_default'],
  llm_routing_rules: ['is_active'],
  login_history: ['success'],
  model_registry: ['is_active'],
  module_access_grants: ['is_active'],
  module_help: ['is_active'],
  notification_preferences: ['quiet_hours_enabled'],
  notification_rules: ['is_active'],
  notification_templates: ['is_active'],
  onboarding_steps: ['is_required'],
  onboarding_tooltips: ['is_active'],
  onboarding_tours: ['is_active'],
  partner_campaign_links: ['is_active'],
  partner_learning_modules: ['is_active'],
  partner_licenses: ['auto_renew'],
  partner_payout_accounts: ['is_primary'],
  partner_regions: ['is_primary'],
  partner_resources: ['is_active', 'is_featured'],
  payment_methods: ['is_default'],
  pinned_insights: ['is_shared'],
  presentation_governance_alert_subscriptions: ['active'],
  presentation_intents: ['is_active'],
  presentation_templates: ['is_active', 'is_system'],
  presentation_watchlist_presets: ['is_default'],
  presentation_watchlist_saved_searches: ['is_default'],
  projects: ['is_system'],
  purpose_assignments: ['is_active'],
  report_builder_block_types: ['is_active', 'is_system'],
  report_builder_sections: ['enabled', 'required'],
  report_builder_templates: ['is_active', 'is_default', 'is_public', 'is_system'],
  report_definitions: ['is_system'],
  report_quality_gates: ['is_resolved'],
  report_schedules: ['is_active'],
  retention_policies: ['is_active'],
  risk_signal_alerts: ['is_dismissed'],
  sandbox_projects: ['is_active'],
  sandbox_templates: ['is_active', 'is_featured'],
  schedule_trigger_rules: ['is_active'],
  sellix_config: ['enabled'],
  sellix_delivery_log: ['success'],
  sso_configurations: ['is_active'],
  sub_processors: ['gdpr_compliant', 'is_active'],
  superadmin_impersonation_sessions: ['is_active'],
  ticket_messages: ['is_internal'],
  tool_assets: ['is_required'],
  tp_automations: ['enabled'],
  tp_base_templates: ['is_featured'],
  tp_distributions: ['is_active'],
  tp_row_policies: ['is_active'],
  tp_scim_tokens: ['enabled'],
  tp_sso_configs: ['enabled'],
  tp_table_syncs: ['is_active'],
  tp_views: ['is_default', 'is_shared'],
  tp_webhook_relays: ['is_active'],
  tp_webhooks: ['is_active'],
  user_sessions: ['is_active'],
  user_tour_progress: ['is_complete'],
  v8_webhook_registrations: ['is_active'],
  white_label_assets: ['is_active'],
  white_label_themes: ['is_public', 'is_system'],
};

// --- referenced-table + boolean-compare rewrite helpers ---
function findPrimaryTableForBooleanFlags(sql: string): string | null {
  const cleaned = sql.trim();
  const update = cleaned.match(/^\s*UPDATE\s+(?:(?:public\.)?("?[a-zA-Z0-9_]+"?))/i);
  if (update) return update[1].replace(/"/g, '').toLowerCase();
  const insert = cleaned.match(/^\s*INSERT\s+INTO\s+(?:(?:public\.)?("?[a-zA-Z0-9_]+"?))/i);
  if (insert) return insert[1].replace(/"/g, '').toLowerCase();
  const from = cleaned.match(/\bFROM\s+(?:(?:public\.)?("?[a-zA-Z0-9_]+"?))/i);
  if (from) return from[1].replace(/"/g, '').toLowerCase();
  return null;
}

// Rewrite `[alias.]col = 0/1` (and !=, <>, and `col = 1 - col` self-toggles) to boolean literals.
// Only the operator/literal is touched; any table/alias qualifier is preserved.
function rewriteBooleanCompare(sql: string, col: string): string {
  const c = col.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let out = sql;
  // Self-toggle: col = 1 - [alias.]col  ->  col = NOT col
  out = out.replace(
    new RegExp(`\\b${c}\\s*=\\s*1\\s*-\\s*(?:[a-zA-Z_][a-zA-Z0-9_]*\\.)?${c}\\b`, 'gi'),
    `${col} = NOT ${col}`
  );
  out = out.replace(new RegExp(`\\b${c}\\s*(=|!=|<>)\\s*1\\b`, 'gi'), `${col} $1 TRUE`);
  out = out.replace(new RegExp(`\\b${c}\\s*(=|!=|<>)\\s*0\\b`, 'gi'), `${col} $1 FALSE`);
  return out;
}

/**
 * Postgres boolean-flag normalization for legacy SQLite-style 0/1 queries.
 *
 * SQLite stores booleans as 0/1; Postgres has a real BOOLEAN type and throws
 * `operator does not exist: boolean = integer` when 0/1 code paths hit a genuine
 * boolean column. We rewrite at the adapter layer (schema-driven, generated above):
 *  - ALWAYS_BOOLEAN_COLUMNS: boolean in every table that has them -> rewrite unconditionally.
 *  - AMBIGUOUS_BOOLEAN_TABLE_COLUMNS: boolean only in some tables -> rewrite ONLY when the
 *    statement's primary table (FROM/UPDATE/INSERT) is one where the column is genuinely boolean.
 *    This preserves INTEGER-typed same-named columns (e.g. initiative_section_types.is_active).
 */
function normalizeBooleanFlags(sql: string): string {
  // Cheap early-out: no `= 0/1` (or `!=`/`<>`) comparison anywhere -> nothing to normalize.
  if (!/(?:=|!=|<>)\s*[01]\b/.test(sql)) return sql;
  let out = sql;
  // 1) Always-boolean columns (safe regardless of table).
  for (const col of ALWAYS_BOOLEAN_COLUMNS) {
    if (out.includes(col)) out = rewriteBooleanCompare(out, col);
  }
  // 2) Ambiguous columns: only for the primary table where they are genuinely boolean.
  const table = findPrimaryTableForBooleanFlags(out);
  if (table) {
    const cols = AMBIGUOUS_BOOLEAN_TABLE_COLUMNS[table];
    if (cols) {
      for (const col of cols) {
        if (out.includes(col)) out = rewriteBooleanCompare(out, col);
      }
    }
  }
  return out;
}

function getPool(): Pool {
  if (!pool) {
    logger.info('[Postgres] Initializing connection pool...');
    // Ensure config is treated as valid PoolConfig or undefined
    const config = databaseConfig.postgres as PoolConfig | undefined;
    const effectiveConfig =
      config && process.env.NODE_ENV === 'test' && testDatabaseOverride
        ? ({ ...(config as any), database: testDatabaseOverride } as PoolConfig)
        : config;

    logger.info('[Postgres] Config:', {
      host: effectiveConfig?.host,
      database: effectiveConfig?.database,
      max: effectiveConfig?.max,
    });
    pool = new Pool(effectiveConfig);

    pool.on('error', (err: Error, _client: PoolClient) => {
      logger.error('[Postgres] Unexpected error on idle client:', err.message);
    });

    pool.on('connect', (client: PoolClient) => {
      logger.debug('[Postgres] Client connected');
      client.query('SET search_path TO public, v8').catch((err: Error) => {
        logger.warn('[Postgres] Failed to set search_path:', err.message);
      });
    });

    // Initialize schema lazily if needed - must complete before first query
    const skipSchemaInit =
      process.env.DB_MANAGED_SCHEMA === 'false' ||
      process.env.DB_MANAGED_SCHEMA === '0' ||
      process.env.DB_MANAGED_SCHEMA === 'off';

    const skipSchemaInitInTests =
      process.env.POSTGRES_SKIP_INIT_IN_TEST === 'true' ||
      process.env.POSTGRES_SKIP_INIT_IN_TEST === '1' ||
      process.env.POSTGRES_SKIP_INIT_IN_TEST === 'yes' ||
      process.env.POSTGRES_SKIP_INIT_IN_TEST === 'on';

    const shouldInitSchema =
      !skipSchemaInit && (process.env.NODE_ENV !== 'test' || !skipSchemaInitInTests);

    if (shouldInitSchema) {
      initDbPromise = initDb()
        .then(() => {
          logger.info('[Postgres] Schema initialization completed successfully');
        })
        .catch((err: Error | null) => {
          logger.error('[Postgres] Failed to initialize database:', err);
          if (process.env.NODE_ENV === 'production') {
            logger.error('[Postgres] CRITICAL: Schema initialization failed in production!');
          }
          throw err;
        });
    } else {
      if (skipSchemaInit) {
        logger.warn('[Postgres] DB_MANAGED_SCHEMA is disabled; skipping initDb()');
      } else if (process.env.NODE_ENV === 'test') {
        logger.warn('[Postgres] Skipping initDb() in test mode (POSTGRES_SKIP_INIT_IN_TEST=1)');
      }
      initDbPromise = Promise.resolve();
    }
  }
  return pool;
}

export interface PinnedTransactionClient {
  queryAll<T extends QueryResultRow = any>(sql: string, params?: unknown[]): Promise<T[]>;
  queryOne<T extends QueryResultRow = any>(sql: string, params?: unknown[]): Promise<T | null>;
  queryRun(sql: string, params?: unknown[]): Promise<{ changes: number }>;
}

/** Run a unit of work on one physical PostgreSQL connection. */
export async function withPinnedPostgresTransaction<T>(
  work: (tx: PinnedTransactionClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  const query = async <R extends QueryResultRow = any>(sql: string, params: unknown[] = []) => {
    const adaptedSql = adaptQuery(sql);
    enforceReadOnly(adaptedSql);
    return client.query<R>(adaptedSql, params);
  };
  const tx: PinnedTransactionClient = {
    queryAll: async <R extends QueryResultRow = any>(
      sql: string,
      params: unknown[] = []
    ): Promise<R[]> => (await query<R>(sql, params)).rows,
    queryOne: async <R extends QueryResultRow = any>(
      sql: string,
      params: unknown[] = []
    ): Promise<R | null> => (await query<R>(sql, params)).rows[0] ?? null,
    queryRun: async (sql: string, params: unknown[] = []) => ({
      changes: (await query(sql, params)).rowCount ?? 0,
    }),
  };

  try {
    await client.query('BEGIN');
    const result = await work(tx);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      logger.error('[Postgres] Transaction rollback failed', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Check out a DEDICATED `pg` connection from the primary pool.
 *
 * WHY THIS EXPORT EXISTS (FIN-005). `DbPromise` — the only database API the
 * services layer uses — routes every statement through `pool.query()`, which
 * picks an arbitrary idle connection per call, and its `transaction()` helper
 * takes a fixed list of SQL strings and never yields a connection handle. A
 * `BEGIN` / `COMMIT` pair issued through that API is therefore not guaranteed
 * to land on the same backend, so a "transaction" built from it is not one.
 * The Atelier Finance demo seed promotes five rows to READY and must do so
 * atomically, which needs a PINNED connection: `BEGIN`, `SELECT … FOR UPDATE`,
 * the writes, the verifying read-back and `COMMIT`/`ROLLBACK` all on one
 * client. `getPool()` is module-private, so this is the single, narrowly named
 * door to it.
 *
 * CONTRACT. The caller OWNS the returned client and MUST `release()` it in a
 * `finally` — this function does not, and cannot, do that for you. It performs
 * no `BEGIN`; transaction control is entirely the caller's. It awaits the lazy
 * schema initialisation exactly like `executeWithLogging` does, so the client
 * is not handed out before the schema promise settles.
 *
 * Authorized callers: `atelierFinancePromotionTransaction.ts` and
 * `kpiDefinitionService.ts` (RES-02 — canonical KPI definition writes need
 * the same one-connection guarantee: a version row and its audit entry must
 * never land without each other). Do not widen this into a general "give me a
 * connection" utility beyond genuinely atomicity-critical, multi-statement
 * writes — routes and services should keep going through `DbPromise`.
 */
export async function getPoolClientForPinnedTransaction(): Promise<PoolClient> {
  const activePool = getPool();
  if (initDbPromise) await initDbPromise;
  return activePool.connect();
}

function getReadPool(): Pool {
  if (readPool) return readPool;

  // Check if read replica is configured
  if (databaseConfig.readReplica) {
    if (!readPool) {
      logger.info('[Postgres] Initializing READ REPLICA pool...');
      const config = databaseConfig.readReplica as PoolConfig;
      readPool = new Pool(config);

      readPool.on('error', (err: Error) => {
        logger.error('[Postgres] Unexpected error on READ REPLICA client:', err.message);
      });
      readPool.on('connect', (client: PoolClient) => {
        client.query('SET search_path TO public, v8').catch((err: Error) => {
          logger.warn('[Postgres] Failed to set read replica search_path:', err.message);
        });
      });
    }
    return readPool;
  }

  // Fallback to primary if no read replica configured
  return getPool();
}

/**
 * Acquire a single pinned PoolClient for a genuine multi-statement Postgres
 * transaction (BEGIN ... COMMIT/ROLLBACK on ONE connection).
 *
 * Why this exists (MW-DEC-001): `IDatabase.query()`/`run()`/`all()`/`get()`
 * all go through `getPool().query()` — the `pg` pool acquires a (possibly
 * different) connection PER CALL. Issuing `BEGIN`, then a separate `UPDATE`,
 * then a separate `INSERT`, then `COMMIT` as four independent pool queries
 * does NOT give atomicity: each statement can land on a different physical
 * connection, so `BEGIN`/`COMMIT` silently no-op relative to the writes and a
 * crash between statements can leave a decision half-updated (e.g. status
 * flipped to APPROVED without decision_rationale/decided_by/decided_at, or
 * without the decision_history audit row). Any caller needing real
 * atomicity — see DecisionController.decide / decisionCollaborationService.
 * finalizeDecisionTransition — must call `acquirePgClient()`, run
 * `BEGIN`/statements/`COMMIT` (or `ROLLBACK` on error) on the SAME returned
 * client, and always `client.release()` in a `finally`.
 *
 * (`ExtensionService.installExtension` calls `(db as any).connect()` for the
 * same reason, but `IDatabase`/`PostgresDatabase` never implemented
 * `connect()` — that call throws at runtime. This is the real, working
 * equivalent; not touched here since ExtensionService is outside this
 * packet's scope.)
 */
export async function acquirePgClient(): Promise<PoolClient> {
  return getPool().connect();
}

function sanitizeParams(params: unknown[]): unknown[] {
  return params.map((p) => (typeof p === 'string' ? p.replace(/\0/g, '') : p));
}

async function executeWithLogging<T>(
  poolFn: () => Pool,
  sql: string,
  params: unknown[],
  method: 'RUN' | 'GET' | 'ALL' | 'QUERY'
): Promise<{ rows: T[]; rowCount: number | null }> {
  const safeParams = sanitizeParams(params);
  const start = Date.now();
  try {
    const pool = poolFn(); // Triggers getPool() which may start initDb and set initDbPromise
    if (initDbPromise) await initDbPromise;
    const res = await pool.query(sql, safeParams);

    const duration = Date.now() - start;
    recordQueryPerformance(method.toLowerCase(), duration);
    if (duration > SLOW_QUERY_THRESHOLD_MS) {
      logger.warn(`[Postgres] SLOW QUERY (${duration}ms) [${method}]: ${sql.substring(0, 200)}...`);
    }

    return { rows: res.rows as T[], rowCount: res.rowCount };
  } catch (err) {
    // Test-only: if the DB doesn't exist yet (common in fresh local env),
    // auto-create it once and retry the query.
    if (await ensureDatabaseExistsForTests(err)) {
      try {
        if (pool) await pool.end();
      } catch {
        // ignore
      }
      pool = null;
      initDbPromise = null;
      const retryPool = poolFn();
      if (initDbPromise) await initDbPromise;
      const res = await retryPool.query(sql, safeParams);
      recordQueryPerformance(method.toLowerCase(), Date.now() - start);
      return { rows: res.rows as T[], rowCount: res.rowCount };
    }

    // Log query error with context
    recordQueryPerformance(method.toLowerCase(), Date.now() - start);
    logger.error(`[Postgres] Query Error [${method}]:`, (err as Error).message);
    logger.error(`[Postgres] Failed SQL: ${sql.substring(0, 500)}`);
    throw err;
  }
}

/**
 * Helper to convert SQLite params (?) to Postgres params ($1, $2)
 */
/**
 * Replace SQLite-style positional placeholders (`?`) with Postgres-style
 * numbered placeholders (`$1`, `$2`, ...), but ONLY when the `?` is a real
 * bind placeholder — i.e. it appears in ordinary SQL text, NOT inside a
 * string literal, an identifier literal, or a comment.
 *
 * Context tracked while scanning char-by-char:
 *   - single-quoted string literal: '...'   (Postgres escape = doubled '')
 *   - double-quoted identifier:     "..."   (Postgres escape = doubled "")
 *   - line comment:                 -- ... \n
 *   - block comment:                /* ... *\/
 *
 * A `?` inside any of those contexts (e.g. a regex `col ~ '.*?'`, a JSON
 * path, or a comment containing `?`) is left untouched. This is a strict
 * superset of the previous naive `sql.replace(/\?/g, ...)` behaviour: for
 * queries whose only `?` are bind placeholders the output is byte-identical.
 */
export function replacePositionalPlaceholders(sql: string): string {
  let result = '';
  let paramIndex = 1;
  let inSingle = false; // inside '...'
  let inDouble = false; // inside "..."
  let inLineComment = false; // inside -- ...
  let inBlockComment = false; // inside /* ... */
  const n = sql.length;
  let i = 0;

  while (i < n) {
    const ch = sql[i];
    const next = i + 1 < n ? sql[i + 1] : '';

    if (inLineComment) {
      result += ch;
      if (ch === '\n') inLineComment = false;
      i++;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        result += '*/';
        i += 2;
        inBlockComment = false;
        continue;
      }
      result += ch;
      i++;
      continue;
    }
    if (inSingle) {
      if (ch === "'" && next === "'") {
        // Escaped single quote ('') — stays inside the string literal.
        result += "''";
        i += 2;
        continue;
      }
      result += ch;
      if (ch === "'") inSingle = false;
      i++;
      continue;
    }
    if (inDouble) {
      if (ch === '"' && next === '"') {
        // Escaped double quote ("") — stays inside the quoted identifier.
        result += '""';
        i += 2;
        continue;
      }
      result += ch;
      if (ch === '"') inDouble = false;
      i++;
      continue;
    }

    // Not currently inside any string/identifier/comment context.
    if (ch === "'") {
      inSingle = true;
      result += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      result += ch;
      i++;
      continue;
    }
    if (ch === '-' && next === '-') {
      inLineComment = true;
      result += '--';
      i += 2;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      result += '/*';
      i += 2;
      continue;
    }
    if (ch === '?') {
      result += `$${paramIndex++}`;
      i++;
      continue;
    }
    result += ch;
    i++;
  }

  return result;
}

export function adaptQuery(sql: string): string {
  // SQLite transaction flavor → Postgres
  // SQLite uses BEGIN IMMEDIATE/EXCLUSIVE to acquire a write lock early.
  // Postgres doesn't support those modifiers; BEGIN is sufficient.
  if (/^\s*BEGIN\s+(IMMEDIATE|EXCLUSIVE)\s*;?\s*$/i.test(sql)) {
    return 'BEGIN';
  }

  // Handle PRAGMA table_info(table_name) -> Postgres equivalent
  const pragmaMatch = sql.match(/^\s*PRAGMA\s+table_info\(["']?(\w+)["']?\)\s*$/i);
  if (pragmaMatch) {
    const tableName = pragmaMatch[1];
    return `SELECT column_name as name, data_type as type, CASE WHEN is_nullable = 'NO' THEN 1 ELSE 0 END as "notnull", column_default as dflt_value FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${tableName}' ORDER BY ordinal_position`;
  }

  // Skip any other PRAGMA statements (they're SQLite-specific and not needed in Postgres)
  if (/^\s*PRAGMA\s+/i.test(sql)) {
    return 'SELECT 1 WHERE false'; // No-op query
  }

  // sqlite_master -> information_schema (PostgreSQL)
  let adapted = sql;
  if (adapted.includes('sqlite_master')) {
    adapted = adapted.replace(
      /SELECT\s+name\s+FROM\s+sqlite_master\s+WHERE\s+type\s*=\s*['"]table['"]\s+AND\s+name\s*=\s*\?/gi,
      "SELECT table_name as name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name = $1"
    );
    adapted = adapted.replace(
      /SELECT\s+name\s+FROM\s+sqlite_master\s+WHERE\s+type\s*=\s*['"]table['"]\s+AND\s+name\s+NOT\s+LIKE\s+['"]sqlite_%['"]\s*(ORDER\s+BY\s+name)?/gi,
      "SELECT table_name as name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name NOT LIKE 'sqlite_%' ORDER BY table_name"
    );
    adapted = adapted.replace(
      /SELECT\s+COUNT\s*\(\s*\*\s*\)\s+as\s+(\w+)\s+FROM\s+sqlite_master\s+WHERE\s+type\s*=\s*['"]table['"]\s+AND\s+name\s*=\s*['"](\w+)['"]/gi,
      "SELECT COUNT(*)::int as $1 FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name='$2'"
    );
    adapted = adapted.replace(
      /SELECT\s+COUNT\s*\(\s*\*\s*\)\s+as\s+(\w+)\s+FROM\s+sqlite_master\s+WHERE\s+type\s*=\s*\?/gi,
      "SELECT COUNT(*)::int as $1 FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"
    );
    adapted = adapted.replace(
      /SELECT\s+COUNT\s*\(\s*\*\s*\)\s+as\s+count\s+FROM\s+sqlite_master\s+WHERE\s+type\s*=\s*['"]table['"]\s+AND\s+name\s*=\s*['"](\w+)['"]/gi,
      "SELECT COUNT(*)::int as count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name='$1'"
    );
    adapted = adapted.replace(
      /SELECT\s+1\s+FROM\s+sqlite_master\s+WHERE\s+type\s*=\s*['"]table['"]\s+AND\s+name\s*=\s*['"](\w+)['"]/gi,
      "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name='$1'"
    );
    adapted = adapted.replace(
      /FROM\s+sqlite_master\s+WHERE\s+type\s*=\s*['"]table['"]/gi,
      "FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"
    );
  }

  // Replace ? with $1, $2, etc. — context-aware so that `?` inside string
  // literals ('...'), quoted identifiers ("..."), or comments (-- / block)
  // is NOT mistaken for a bind placeholder (would otherwise emit a bogus
  // $n and cause 42P18 / wrong-parameter errors, e.g. regex `~ '.*?'`).
  adapted = replacePositionalPlaceholders(adapted);

  // Replace pragma_page_count()/pragma_page_size() with PostgreSQL equivalent
  if (adapted.includes('pragma_page_count') || adapted.includes('pragma_page_size')) {
    adapted = adapted.replace(
      /SELECT\s+page_count\s*\*\s*page_size\s+as\s+size\s+FROM\s+pragma_page_count\(\)\s*,\s*pragma_page_size\(\)/gi,
      'SELECT pg_database_size(current_database()) as size'
    );
  }

  // Replace datetime('now') and datetime("now") with NOW()
  adapted = adapted.replace(/datetime\(['"]now['"]\)/gi, 'NOW()');

  // Generic: datetime('now', '-/+N <unit>') → NOW() -/+ INTERVAL 'N <unit>'
  // Handles all units: minutes, hours, days, months, years, seconds, etc.
  adapted = adapted.replace(
    /datetime\(['"]now['"],\s*['"]-(\d+)\s+(minutes?|hours?|days?|months?|years?|seconds?)['"]\)/gi,
    (_match, n, unit) => `NOW() - INTERVAL '${n} ${unit}'`
  );
  adapted = adapted.replace(
    /datetime\(['"]now['"],\s*['"](?:\+)?(\d+)\s+(minutes?|hours?|days?|months?|years?|seconds?)['"]\)/gi,
    (_match, n, unit) => `NOW() + INTERVAL '${n} ${unit}'`
  );

  // Replace datetime(date, '+' || N || ' days') with date + INTERVAL 'N days'
  adapted = adapted.replace(
    /datetime\(([^,]+),\s*['"]\+['"]\s*\|\|\s*([^|]+)\s*\|\|\s*['"]\s+days?['"]\)/gi,
    (_match, dateExpr, daysExpr) => {
      return `${dateExpr} + INTERVAL '${daysExpr} days'`;
    }
  );

  // Replace datetime(date, '+' || N || ' days') <= datetime('now') with date + INTERVAL 'N days' <= NOW()
  adapted = adapted.replace(
    /datetime\(([^,]+),\s*['"]\+['"]\s*\|\|\s*([^|]+)\s*\|\|\s*['"]\s+days?['"]\)/gi,
    (_match, dateExpr, daysExpr) => {
      return `${dateExpr} + INTERVAL '${daysExpr} days'`;
    }
  );

  // Replace julianday(date1) - julianday(date2) with EXTRACT(EPOCH FROM (date1 - date2)) / 86400
  adapted = adapted.replace(
    /julianday\(([^)]+)\)\s*-\s*julianday\(([^)]+)\)/gi,
    (_match, date1, date2) => {
      return `EXTRACT(EPOCH FROM (${date1} - ${date2})) / 86400`;
    }
  );

  // Replace date('now', 'start of month', '-N months') FIRST (most specific)
  // Handle both single and double quotes, flexible whitespace (including newlines via \s)
  // Match with non-greedy quantifiers to avoid over-matching
  adapted = adapted.replace(
    /date\s*\(\s*['"]now['"]\s*,\s*['"]start\s+of\s+month['"]\s*,\s*['"]-(\d+)\s+months?['"]\s*\)/gi,
    (_match, months) => {
      return `date_trunc('month', CURRENT_DATE) - INTERVAL '${months} month'`;
    }
  );

  // Replace date('now', 'start of month') - must come after the pattern with 3 args
  adapted = adapted.replace(
    /date\s*\(\s*['"]now['"]\s*,\s*['"]start\s+of\s+month['"]\s*\)/gi,
    "date_trunc('month', CURRENT_DATE)"
  );

  // Replace date('now', 'start of day') with CURRENT_DATE (date() already truncates to day)
  adapted = adapted.replace(
    /date\s*\(\s*['"]now['"]\s*,\s*['"]start\s+of\s+day['"]\s*\)/gi,
    'CURRENT_DATE'
  );

  // Replace date('now', '-N <unit>') → (CURRENT_DATE - INTERVAL 'N <unit>')
  // and date('now', '+N <unit>') → (CURRENT_DATE + INTERVAL 'N <unit>')
  // Mirrors the datetime('now', ...) handling above, for the date()-flavored calls
  // used by analytics/cron queries (e.g. date('now', '-6 months')).
  adapted = adapted.replace(
    /date\s*\(\s*['"]now['"]\s*,\s*['"]-(\d+)\s+(minutes?|hours?|days?|months?|years?|seconds?)['"]\s*\)/gi,
    (_match, n, unit) => `(CURRENT_DATE - INTERVAL '${n} ${unit}')`
  );
  adapted = adapted.replace(
    /date\s*\(\s*['"]now['"]\s*,\s*['"](?:\+)?(\d+)\s+(minutes?|hours?|days?|months?|years?|seconds?)['"]\s*\)/gi,
    (_match, n, unit) => `(CURRENT_DATE + INTERVAL '${n} ${unit}')`
  );

  // Replace date('now') with CURRENT_DATE
  adapted = adapted.replace(/date\s*\(\s*['"]now['"]\s*\)/g, 'CURRENT_DATE');

  // Replace date(column) with column::date (PostgreSQL cast)
  // Must come after all date('now', ...) patterns are replaced above
  adapted = adapted.replace(/date\s*\(\s*([^'"]+?)\s*\)/g, (match, content) => {
    if (content.trim().startsWith('now')) {
      return match;
    }
    return `${content}::date`;
  });

  // Replace datetime(column) with just column (PostgreSQL timestamps can be compared directly)
  // Must come after datetime('now', ...) patterns are replaced
  adapted = adapted.replace(/datetime\s*\(\s*([^'"]+?)\s*\)/gi, (match, content) => {
    if (content.trim().startsWith('now')) {
      return match;
    }
    return content.trim();
  });

  // Debug: warn if SQLite date functions survived all replacements
  if (/datetime\s*\(/i.test(adapted) || /\bdate\s*\(\s*['"]now/i.test(adapted)) {
    logger.warn(
      '[Postgres] adaptQuery: SQLite date function still present after replacement:',
      adapted.substring(0, 300)
    );
  }

  // Replace strftime(format, column) with TO_CHAR(column, pg_format)
  adapted = adapted.replace(
    /strftime\s*\(\s*'([^']+)'\s*,\s*([^)]+)\)/gi,
    (_match, fmt: string, col: string) => {
      const pgFmt = fmt
        .replace('%Y', 'YYYY')
        .replace('%m', 'MM')
        .replace('%d', 'DD')
        .replace('%H', 'HH24')
        .replace('%M', 'MI')
        .replace('%S', 'SS')
        .replace('%W', 'IW')
        .replace(/-W/g, '-"W"');
      return `TO_CHAR(${col.trim()}, '${pgFmt}')`;
    }
  );

  // Replace DATETIME column type with TIMESTAMP for PostgreSQL (DDL only, not function calls)
  // Only match DATETIME when it appears as a type (preceded by space/paren, not followed by '(')
  adapted = adapted.replace(/\bDATETIME\b(?!\s*\()/gi, 'TIMESTAMP');

  // Replace INSERT OR REPLACE with INSERT ... ON CONFLICT DO UPDATE
  // This is complex - we'll handle common cases
  if (adapted.includes('INSERT OR REPLACE')) {
    // Extract table name and columns for basic cases
    const match = adapted.match(/INSERT\s+OR\s+REPLACE\s+INTO\s+(\w+)\s*\(([^)]+)\)/i);
    if (match) {
      const tableName = match[1];
      const columns = match[2].split(',').map((c) => c.trim());
      const firstColumn = columns[0]; // legacy heuristic: assumes first column is key
      // Prefer the explicit conflict-target registry; unregistered tables warn
      // loudly and fall back to the historical first-column behaviour.
      const registered = getConflictTarget(tableName);
      const conflictColumns = registered && registered.length > 0 ? [...registered] : [firstColumn];
      if (!registered || registered.length === 0) {
        // Emits the loud once-per-table warning without changing behaviour.
        resolveConflictTargetSql(tableName, firstColumn, 'REPLACE');
      }
      // For registered targets, never overwrite the conflict-key columns — nor
      // the surrogate `id` primary key — in the DO UPDATE SET (standard upsert
      // practice: avoids churning invoices.id on every Stripe re-sync when the
      // real key is stripe_invoice_id). For the unregistered fallback the target
      // IS the first column and EXCLUDED equals the existing value, so keeping
      // the full column set preserves legacy behaviour exactly.
      const targetSet = new Set(conflictColumns.map((c) => c.toLowerCase()));
      let setColumns = registered
        ? columns.filter((col) => {
            const lc = col.toLowerCase();
            return !targetSet.has(lc) && lc !== 'id';
          })
        : columns;
      if (setColumns.length === 0) setColumns = columns; // degenerate: every column is a key
      adapted = adapted.replace(/INSERT\s+OR\s+REPLACE\s+INTO/i, 'INSERT INTO');
      // Add ON CONFLICT clause - this is a simplified version
      // Full implementation would need to parse VALUES and UPDATE SET properly
      adapted += ` ON CONFLICT (${conflictColumns.join(', ')}) DO UPDATE SET ${setColumns.map((col) => `${col} = EXCLUDED.${col}`).join(', ')}`;
    } else {
      // Fallback: just remove INSERT OR REPLACE and add basic ON CONFLICT
      adapted = adapted.replace(/INSERT\s+OR\s+REPLACE/i, 'INSERT');
      // Note: This won't work perfectly for all cases, but handles simple ones
    }
  }

  // Replace INSERT OR IGNORE with INSERT ... ON CONFLICT DO NOTHING
  // Handle both single-line and multi-line INSERT statements
  // Track if we replaced INSERT OR IGNORE so we only add ON CONFLICT for those
  const hadInsertOrIgnore = /INSERT\s+OR\s+IGNORE/gi.test(adapted);

  // Step 1: Replace INSERT OR IGNORE with INSERT
  adapted = adapted.replace(/INSERT\s+OR\s+IGNORE/gi, 'INSERT');

  // Step 2: Add ON CONFLICT clause AFTER VALUES for INSERT statements that had INSERT OR IGNORE
  // Only process if we actually replaced INSERT OR IGNORE (don't modify regular INSERT statements)
  // CRITICAL: Double-check that we're not processing a regular INSERT INTO statement
  if (hadInsertOrIgnore && !adapted.includes('ON CONFLICT') && adapted.includes('VALUES')) {
    // Handle multi-line INSERT statements where column list and VALUES might span multiple lines
    // Pattern: INSERT INTO table (columns...)\nVALUES (values...)
    // We need to find VALUES and add ON CONFLICT after the VALUES clause, not before

    // Strategy: Find the VALUES keyword and insert ON CONFLICT after the VALUES clause
    // Match: INSERT INTO table (columns) ... VALUES (values)
    // Use non-greedy matching with [\s\S] to handle newlines and match balanced parentheses

    // Extract the table name + column list to resolve the conflict target.
    const insertMatch = adapted.match(/INSERT\s+INTO\s+(\w+)\s*\(([\s\S]+?)\)/i);
    if (insertMatch) {
      const tableName = insertMatch[1];
      const columns = insertMatch[2];
      const firstColumn = columns.split(',')[0].trim().split(/\s+/)[0];
      // Registry-driven conflict target; unregistered tables warn loudly and
      // fall back to the historical first-column heuristic (zero behaviour change).
      const conflictTarget = resolveConflictTargetSql(tableName, firstColumn, 'IGNORE');

      // Find the position of VALUES in the INSERT statement
      const valuesMatch = adapted.match(/\bVALUES\s*\(/i);
      if (valuesMatch && valuesMatch.index !== undefined) {
        // Multi-row INSERT: VALUES (row1),(row2),(row3) - there is no single enclosing ().
        // Use the LAST ) after VALUES as the end of the VALUES clause.
        const afterValues = adapted.substring(valuesMatch.index);
        const lastParen = afterValues.lastIndexOf(')');
        const foundEnd = lastParen >= 0;
        const valuesEndPos = foundEnd
          ? valuesMatch.index + lastParen + 1
          : valuesMatch.index + valuesMatch[0].length;

        if (foundEnd) {
          // CRITICAL: Verify VALUES comes before any existing ON CONFLICT
          // Insert ON CONFLICT after the VALUES clause
          const beforeValues = adapted.substring(0, valuesEndPos);
          const afterValues = adapted.substring(valuesEndPos);
          // Double-check: VALUES should be in beforeValues, not afterValues
          if (beforeValues.includes('VALUES') && !beforeValues.includes('ON CONFLICT')) {
            adapted = `${beforeValues} ON CONFLICT (${conflictTarget}) DO NOTHING${afterValues}`;
          }
        } else {
          // Fallback: Use regex if we can't find balanced parentheses
          adapted = adapted.replace(
            /(VALUES\s*\([\s\S]+?\))/i,
            (match) => `${match} ON CONFLICT (${conflictTarget}) DO NOTHING`
          );
        }
      } else {
        // Fallback: Use regex for simpler cases
        // Match INSERT INTO ... (columns) ... VALUES (values) with flexible whitespace
        adapted = adapted.replace(
          /(INSERT\s+INTO\s+(\w+)\s*\([\s\S]+?\))\s+(VALUES\s*\([\s\S]+?\))/gi,
          (match, insertPart, matchedTable, valuesPart) => {
            // Skip if already has ON CONFLICT
            if (match.includes('ON CONFLICT')) {
              return match;
            }
            // Extract first column from column list
            const columnsMatch = insertPart.match(/\(([\s\S]+?)\)/);
            if (columnsMatch) {
              const innerColumns = columnsMatch[1];
              const innerFirstColumn = innerColumns.split(',')[0].trim().split(/\s+/)[0];
              // Resolve per matched statement (a multi-statement string may hit
              // several tables); unregistered tables warn + keep first-column.
              const innerTarget = resolveConflictTargetSql(
                matchedTable,
                innerFirstColumn,
                'IGNORE'
              );
              // Add ON CONFLICT after VALUES clause
              return `${insertPart} ${valuesPart} ON CONFLICT (${innerTarget}) DO NOTHING`;
            }
            return match;
          }
        );
      }
    }
  }

  /**
   * SQLite json_extract(col, '$.a.b') -> Postgres jsonb extraction
   *
   * Notes:
   * - We cast the first argument to jsonb because many columns are stored as TEXT.
   * - Supports simple paths like '$.a' or '$.a.b.c'
   */
  adapted = adapted.replace(
    /json_extract\s*\(\s*([^,]+?)\s*,\s*(['"])\$\.(.+?)\2\s*\)/gi,
    (_m, expr, _q, rawPath) => {
      const path = String(rawPath).trim();
      if (!path) return `(${expr})::jsonb`;
      const parts = path
        .split('.')
        .map((p: string) => p.trim())
        .filter(Boolean);
      if (parts.length <= 1) {
        return `((${expr})::jsonb ->> '${parts[0] || ''}')`;
      }
      return `((${expr})::jsonb #>> '{${parts.join(',')}}')`;
    }
  );

  /**
   * SQLite AUTOINCREMENT -> Postgres identity/serial equivalent
   * We keep this intentionally simple to prevent hard failures when legacy
   * SQLite DDL is executed against Postgres.
   */
  adapted = adapted.replace(
    /\bINTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT\b/gi,
    'BIGSERIAL PRIMARY KEY'
  );
  adapted = adapted.replace(/\bAUTOINCREMENT\b/gi, '');

  adapted = normalizeBooleanFlags(adapted);

  return adapted;
}

interface PreparedStatement {
  run: (...args: unknown[]) => void;
  finalize: () => void;
}

class PostgresDatabase implements IDatabase {
  /**
   * Mock serialize as immediate execution because pg pool handles concurrency
   */
  serialize(callback: () => void): void {
    if (callback) callback();
  }

  /**
   * Prepare statement mock
   */
  prepare(sql: string): PreparedStatement {
    const adaptedSql = adaptQuery(sql);
    return {
      run: (...args: unknown[]) => {
        // Last arg might be callback
        let callback: ((err: Error | null) => void) | null = null;
        let params: unknown[] = args;
        if (args.length > 0 && typeof args[args.length - 1] === 'function') {
          callback = args[args.length - 1] as (err: Error | null) => void;
          params = args.slice(0, -1) as unknown[];
        }

        try {
          enforceReadOnly(adaptedSql);
        } catch (e: any) {
          if (callback) callback(e);
          return;
        }

        executeWithLogging<unknown>(getPool, adaptedSql, params, 'RUN')
          .then((res) => {
            if (callback) callback.call({ changes: res.rowCount, lastID: null }, null);
          })
          .catch((err: Error | null) => {
            // Error logged in executeWithLogging
            if (callback) callback(err);
          });
      },
      finalize: () => {},
    };
  }

  async run(sql: string, params?: unknown[]): Promise<RunResult>;
  run(sql: string, params: unknown[], callback: (err: Error | null) => void): this;
  run(
    sql: string,
    params?: unknown[],
    callback?: (err: Error | null) => void
  ): this | Promise<RunResult> {
    if (typeof params === 'function') {
      callback = params as (err: Error | null) => void;
      params = [];
    }
    params = params || [];

    const adaptedSql = adaptQuery(sql);

    try {
      enforceReadOnly(adaptedSql);
    } catch (e: any) {
      if (callback) {
        callback(e);
        return this;
      }
      return Promise.reject(e);
    }

    const promise = executeWithLogging<unknown>(getPool, adaptedSql, params || [], 'RUN')
      .then((res) => {
        const result: RunResult = { changes: res.rowCount || 0, lastID: undefined };
        if (callback) {
          callback.call({ changes: res.rowCount, lastID: null }, null);
        }
        return result;
      })
      .catch((err: Error | null) => {
        logger.error('[Postgres] Run Error:');
        if (callback) {
          callback(err);
          return { changes: 0, lastID: undefined } as RunResult;
        }
        throw err;
      });

    if (callback) {
      return this;
    }
    return promise;
  }

  get<T = unknown>(sql: string, params?: unknown[]): Promise<T | null>;
  get<T = unknown>(
    sql: string,
    params: unknown[],
    callback: (err: Error | null, row: T | null) => void
  ): this;
  get<T = unknown>(sql: string, params?: any, callback?: any): any {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    params = params || [];

    const adaptedSql = adaptQuery(sql);

    const promise = executeWithLogging<T>(getReadPool, adaptedSql, params, 'GET')
      .then((res) => {
        const row = res.rows[0] || null;
        if (callback) callback(null, row as T);
        return row as T | null;
      })
      .catch((err: Error | null) => {
        if (callback) {
          callback(err, null);
          return null as T | null;
        }
        throw err;
      });

    if (callback) {
      return this;
    }
    return promise;
  }

  all<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  all<T = unknown>(
    sql: string,
    params: unknown[],
    callback: (err: Error | null, rows: T[]) => void
  ): this;
  all<T = unknown>(sql: string, params?: any, callback?: any): any {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    params = params || [];

    const adaptedSql = adaptQuery(sql);

    const promise = executeWithLogging<T>(getReadPool, adaptedSql, params, 'ALL')
      .then((res) => {
        if (callback) callback(null, res.rows);
        return res.rows;
      })
      .catch((err: Error | null) => {
        if (callback) {
          callback(err, []);
          return [] as T[];
        }
        throw err;
      });

    if (callback) {
      return this;
    }
    return promise;
  }

  exec(sql: string, callback?: (err: Error | null) => void): this | Promise<void> {
    try {
      enforceReadOnly(sql);
    } catch (e: any) {
      if (callback) {
        callback(e);
        return this;
      }
      return Promise.reject(e);
    }
    const promise = executeWithLogging(getPool, sql, [], 'RUN')
      .then(() => {
        if (callback) callback(null);
      })
      .catch((err: Error | null) => {
        if (callback) callback(err);
        throw err;
      });

    if (callback) {
      return this;
    }
    return promise;
  }

  close(callback?: (err: Error | null) => void): Promise<void> | void {
    if (!pool) {
      if (callback) callback(null);
      return Promise.resolve();
    }
    // Capture and nullify immediately to prevent double-close race condition
    const poolToClose = pool;
    const readPoolToClose = readPool;
    pool = null;
    readPool = null;

    const promise = Promise.resolve()
      .then(() => {
        logger.info('[Postgres] Closing connection pool...');
        return poolToClose?.end();
      })
      .then(() => {
        if (readPoolToClose && readPoolToClose !== poolToClose) {
          return readPoolToClose.end().then(() => {});
        }
        return Promise.resolve();
      })
      .then(() => {
        if (callback) callback(null);
      })
      .catch((err: Error | null) => {
        if (callback) {
          callback(err);
          return;
        }
        throw err;
      });

    if (callback) {
      return;
    }
    return promise;
  }

  async query<T = unknown>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
    const adapted = adaptQuery(text);
    enforceReadOnly(adapted);
    try {
      const result = await executeWithLogging<T>(
        getPool, // Generic query defaults to primary often used for writes too
        adapted,
        params || [],
        'QUERY'
      );
      return {
        rows: result.rows,
        rowCount: result.rowCount || 0,
      };
    } catch (e: unknown) {
      // Error already logged
      throw e;
    }
  }
}

// Test connection with retry; verify we are connected to PostgreSQL (not SQLite or other)
async function testConnection(retries = 3, delay = 2000): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      logger.info(`[Postgres] Testing connection (attempt ${i + 1}/${retries})...`);
      const result = await getPool().query('SELECT NOW() as current_time');
      const versionResult = await getPool().query<{ version: string }>(
        'SELECT version() as version'
      );
      const version = String(versionResult?.rows?.[0]?.version || '').toUpperCase();
      if (!version.includes('POSTGRESQL')) {
        logger.error(
          '[Postgres] CRITICAL: Connected database is NOT PostgreSQL. version()=' +
            version.substring(0, 80)
        );
        logger.error('[Postgres] This application requires PostgreSQL. Check DATABASE_URL.');
        process.exit(1);
      }
      logger.info('[Postgres] Connection test successful (PostgreSQL verified):', result.rows[0]);
      return true;
    } catch (err: any) {
      // Test-only: recover from missing test DB by creating it (or falling back),
      // then retry without consuming an attempt.
      if (await ensureDatabaseExistsForTests(err)) {
        try {
          if (pool) await pool.end();
        } catch {
          // ignore
        }
        pool = null;
        initDbPromise = null;
        // Retry immediately (doesn't count as a failed attempt)
        i -= 1;
        continue;
      }

      logger.error(
        `[Postgres] Connection test failed (attempt ${i + 1}/${retries}):`,
        (err as Error).message
      );
      if (i < retries - 1) {
        logger.info(`[Postgres] Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      } else {
        logger.error('[Postgres] All connection attempts failed');
        return false;
      }
    }
  }
  return false;
}

/**
 * Initialize Database Schema
 */
/**
 * Initialize Database Schema
 */
export async function initDb(): Promise<void> {
  logger.info('[Postgres] Checking/Initializing Schema...');

  try {
    // Test connection first
    const connected = await testConnection();
    if (!connected) {
      logger.error('[Postgres] Cannot proceed with schema initialization - connection failed');
      return;
    }

    // Helper function for queries
    const query = async (sql: string, params?: unknown[]): Promise<void> => {
      const adapted = adaptQuery(sql);
      try {
        await getPool().query(adapted, params);
      } catch (e: unknown) {
        logger.error('[Postgres] Query Failed:', (e as Error).message);
        throw e;
      }
    };

    // Helper function to check if a column exists in a table
    const columnExists = async (tableName: string, columnName: string): Promise<boolean> => {
      try {
        const result = await getPool().query(
          `SELECT 1 FROM information_schema.columns 
           WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
          [tableName, columnName]
        );
        return result.rows.length > 0;
      } catch {
        return false;
      }
    };

    // Helper to check if a table exists
    const tableExists = async (tableName: string): Promise<boolean> => {
      try {
        const result = await getPool().query(
          `SELECT 1 FROM information_schema.tables 
           WHERE table_schema = 'public' AND table_name = $1`,
          [tableName]
        );
        return result.rows.length > 0;
      } catch {
        return false;
      }
    };

    // Helper function for queries that can fail gracefully (e.g., index creation on non-existent columns)
    const querySafe = async (
      sql: string,
      params?: unknown[],
      errorMessage?: string
    ): Promise<boolean> => {
      const adapted = adaptQuery(sql);
      try {
        await getPool().query(adapted, params);
        return true;
      } catch (e: unknown) {
        const error = e as Error;
        // Don't log errors for missing columns/indexes - these are expected in some cases
        if (errorMessage) {
          logger.debug(`[Postgres] ${errorMessage}: ${error.message}`);
        }
        return false;
      }
    };

    // CRITICAL: Ensure initiatives has created_by/updated_by early (table may exist from migrations)
    if (await tableExists('initiatives')) {
      if (!(await columnExists('initiatives', 'created_by'))) {
        await querySafe(
          'ALTER TABLE initiatives ADD COLUMN created_by TEXT',
          [],
          'initiatives.created_by'
        );
      }
      if (!(await columnExists('initiatives', 'updated_by'))) {
        await querySafe(
          'ALTER TABLE initiatives ADD COLUMN updated_by TEXT',
          [],
          'initiatives.updated_by'
        );
      }
    }

    // Organizations Table
    await query(`CREATE TABLE IF NOT EXISTS organizations (
            id TEXT PRIMARY KEY,
            name TEXT,
            plan TEXT DEFAULT 'free',
            status TEXT DEFAULT 'active',
            billing_status TEXT DEFAULT 'PENDING',
            organization_type TEXT DEFAULT 'TRIAL',
            token_balance INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            valid_until TIMESTAMP,
            discount_percent INTEGER DEFAULT 0,
            -- Budget tracking
            monthly_budget_usd REAL,
            budget_spent_current_period REAL DEFAULT 0,
            budget_alert_threshold REAL DEFAULT 0.8,
            budget_period_start TIMESTAMP,
            -- Resource usage tracking
            memory_usage_mb_current INTEGER DEFAULT 0,
            cpu_usage_percent_avg REAL DEFAULT 0,
            -- MFA enforcement settings (enterprise feature)
            mfa_required INTEGER DEFAULT 0,
            mfa_grace_period_days INTEGER DEFAULT 7,
            -- Trial Fields
            trial_started_at TIMESTAMP,
            trial_expires_at TIMESTAMP,
            trial_extension_count INTEGER DEFAULT 0,
            trial_warning_sent_at TIMESTAMP,
            trial_tokens_used INTEGER DEFAULT 0,
            -- Attribution
            attribution_data TEXT,
            -- Phase E: Onboarding Context
            transformation_context TEXT DEFAULT '{}',
            onboarding_status TEXT DEFAULT 'NOT_STARTED',
            onboarding_plan_snapshot TEXT,
            onboarding_plan_version INTEGER DEFAULT 0,
            onboarding_accepted_at TIMESTAMP,
            onboarding_accept_idempotency_key TEXT,
            -- AI Governance Fields
            ai_assertiveness_level TEXT DEFAULT 'MEDIUM',
            ai_autonomy_level TEXT DEFAULT 'SUGGEST_ONLY',
            created_by_user_id TEXT
        )`);

    // Users Table
    await query(`CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            organization_id TEXT,
            email TEXT UNIQUE,
            password TEXT,
            first_name TEXT,
            last_name TEXT,
            role TEXT, 
            status TEXT DEFAULT 'active',
            avatar_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP,
            -- MFA columns
            mfa_enabled INTEGER DEFAULT 0,
            mfa_secret TEXT,
            mfa_backup_codes TEXT,
            mfa_verified_at TIMESTAMP,
            mfa_recovery_email TEXT,
            FOREIGN KEY(organization_id) REFERENCES organizations(id)
        )`);

    // Settings (no dependencies)
    await query(`CREATE TABLE IF NOT EXISTS settings(
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

    // Projects table (must come before sessions which references it)
    await query(`CREATE TABLE IF NOT EXISTS projects(
            id TEXT PRIMARY KEY,
            organization_id TEXT,
            name TEXT,
            description TEXT,
            goal TEXT,
            status TEXT DEFAULT 'active',
            health TEXT,
            progress_pct REAL DEFAULT 0,
            owner_id TEXT,
            current_phase TEXT DEFAULT 'Context',
            initiative_count INTEGER DEFAULT 0,
            assessment_count INTEGER DEFAULT 0,
            member_count INTEGER DEFAULT 0,
            document_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE SET NULL
        )`);

    // Project AI settings (AI role + regulatory mode)
    await query(`CREATE TABLE IF NOT EXISTS project_ai_settings(
            project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
            ai_role TEXT NOT NULL DEFAULT 'ADVISOR',
            regulatory_mode_enabled BOOLEAN NOT NULL DEFAULT FALSE,
            regulatory_prompt TEXT DEFAULT '',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
    await query(
      `CREATE INDEX IF NOT EXISTS idx_project_ai_settings_role ON project_ai_settings(ai_role)`
    );

    // Ensure projects table has current_phase column (migration for existing tables)
    await query(`
            DO $$
        BEGIN
            IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'projects') THEN
                IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                               WHERE table_name = 'projects' AND column_name = 'current_phase') THEN
                    ALTER TABLE projects ADD COLUMN current_phase TEXT DEFAULT 'Context';
                END IF;
                IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                               WHERE table_name = 'projects' AND column_name = 'health') THEN
                    ALTER TABLE projects ADD COLUMN health TEXT;
                END IF;
                IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                               WHERE table_name = 'projects' AND column_name = 'progress_pct') THEN
                    ALTER TABLE projects ADD COLUMN progress_pct REAL DEFAULT 0;
                END IF;
                IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                               WHERE table_name = 'projects' AND column_name = 'updated_at') THEN
                    ALTER TABLE projects ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
                END IF;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                -- Ignore errors (column may already exist)
                NULL;
        END $$;
        `).catch((err: Error | null) => {
      logger.info('[Postgres] Projects current_phase column migration skipped (may already exist)');
    });

    // Sessions (references users and projects - must come after both)
    await query(`CREATE TABLE IF NOT EXISTS sessions(
                id TEXT PRIMARY KEY,
                user_id TEXT,
                project_id TEXT,
                type TEXT,
                data TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id),
                FOREIGN KEY(project_id) REFERENCES projects(id)
            )`);

    // Knowledge Docs (project_id needed for project list counts; organization_id for org-scoped index)
    await query(`CREATE TABLE IF NOT EXISTS knowledge_docs(
                id TEXT PRIMARY KEY,
                filename TEXT,
                filepath TEXT,
                status TEXT DEFAULT 'pending',
                organization_id TEXT,
                project_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE SET NULL,
                FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL
            )`);

    // Ensure knowledge_docs has required columns on existing DBs (Railway etc.)
    // NOTE: RAG + tool packs rely on `source_type`, `metadata`, `chunk_count`, and timestamps.
    const ensureKnowledgeDocColumn = async (col: string, ddl: string) => {
      if (!(await columnExists('knowledge_docs', col))) {
        await query(`ALTER TABLE knowledge_docs ADD COLUMN ${ddl}`);
      }
    };
    await ensureKnowledgeDocColumn('organization_id', 'organization_id TEXT');
    await ensureKnowledgeDocColumn('project_id', 'project_id TEXT');
    await ensureKnowledgeDocColumn('source_type', 'source_type TEXT');
    await ensureKnowledgeDocColumn('file_hash', 'file_hash TEXT');
    await ensureKnowledgeDocColumn('chunk_count', 'chunk_count INTEGER DEFAULT 0');
    await ensureKnowledgeDocColumn('metadata', 'metadata TEXT');
    await ensureKnowledgeDocColumn('indexed_at', 'indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    await ensureKnowledgeDocColumn('updated_at', 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    // Optional content classification (used by ops and filtering)
    await ensureKnowledgeDocColumn('category', 'category TEXT');
    await ensureKnowledgeDocColumn('tags', 'tags TEXT');
    // Lightweight versioning
    await ensureKnowledgeDocColumn('version', 'version INTEGER DEFAULT 1');
    await ensureKnowledgeDocColumn('parent_doc_id', 'parent_doc_id TEXT');

    // Knowledge Chunks
    await query(`CREATE TABLE IF NOT EXISTS knowledge_chunks(
                id TEXT PRIMARY KEY,
                doc_id TEXT,
                content TEXT,
                chunk_index INTEGER,
                embedding TEXT,
                FOREIGN KEY(doc_id) REFERENCES knowledge_docs(id) ON DELETE CASCADE
            )`);

    const ensureKnowledgeChunkColumn = async (col: string, ddl: string) => {
      if (!(await columnExists('knowledge_chunks', col))) {
        await query(`ALTER TABLE knowledge_chunks ADD COLUMN ${ddl}`);
      }
    };
    // Required for pack-scoped retrieval and provenance
    await ensureKnowledgeChunkColumn('metadata', 'metadata TEXT');
    await ensureKnowledgeChunkColumn(
      'created_at',
      'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
    );

    // LLM Providers
    await query(`CREATE TABLE IF NOT EXISTS llm_providers(
                id TEXT PRIMARY KEY,
                name TEXT,
                provider TEXT,
                api_key TEXT,
                endpoint TEXT,
                model_id TEXT,
                cost_per_1k REAL DEFAULT 0,
                is_active BOOLEAN DEFAULT TRUE,
                is_default BOOLEAN DEFAULT FALSE,
                visibility TEXT DEFAULT 'admin'
            )`);

    // Ensure boolean flags are correct on older DBs (avoid integer/boolean operator errors)
    try {
      await query(
        `ALTER TABLE llm_providers
         ALTER COLUMN is_active TYPE BOOLEAN USING (CASE WHEN (is_active::text) IN ('1', 't', 'true', 'y', 'yes', 'on') THEN TRUE ELSE FALSE END)`
      );
    } catch {
      /* ignore: column may already be boolean or missing */
    }
    try {
      await query(
        `ALTER TABLE llm_providers
         ALTER COLUMN is_default TYPE BOOLEAN USING (CASE WHEN (is_default::text) IN ('1', 't', 'true', 'y', 'yes', 'on') THEN TRUE ELSE FALSE END)`
      );
    } catch {
      /* ignore */
    }

    // Teams
    await query(`CREATE TABLE IF NOT EXISTS teams(
                id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                lead_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                FOREIGN KEY(lead_id) REFERENCES users(id) ON DELETE SET NULL
            )`);

    // Team Members
    await query(`CREATE TABLE IF NOT EXISTS team_members(
                team_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                role TEXT DEFAULT 'member',
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY(team_id, user_id),
                FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )`);

    // Project Users
    await query(`CREATE TABLE IF NOT EXISTS project_users(
                project_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                role TEXT DEFAULT 'member',
                assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY(project_id, user_id),
                FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )`);

    // Custom Statuses
    await query(`CREATE TABLE IF NOT EXISTS custom_statuses(
                id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL,
                name TEXT NOT NULL,
                color TEXT DEFAULT '#6B7280',
                sort_order INTEGER DEFAULT 0,
                is_default INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
            )`);

    // Tasks
    await query(`CREATE TABLE IF NOT EXISTS tasks(
                id TEXT PRIMARY KEY,
                project_id TEXT,
                organization_id TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                status TEXT DEFAULT 'todo',
                priority TEXT DEFAULT 'medium',
                assignee_id TEXT,
                reporter_id TEXT,
                due_date TIMESTAMP,
                estimated_hours REAL,
                checklist TEXT,
                attachments TEXT,
                tags TEXT,
                custom_status_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                task_type TEXT DEFAULT 'execution',
                budget_allocated REAL DEFAULT 0,
                budget_spent REAL DEFAULT 0,
                risk_rating TEXT DEFAULT 'low',
                acceptance_criteria TEXT DEFAULT '',
                blocking_issues TEXT DEFAULT '',
                step_phase TEXT DEFAULT 'design',
                initiative_id TEXT,
                why TEXT DEFAULT '',
                FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                FOREIGN KEY(assignee_id) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY(reporter_id) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY(custom_status_id) REFERENCES custom_statuses(id) ON DELETE SET NULL
            )`);

    // Task Comments
    await query(`CREATE TABLE IF NOT EXISTS task_comments(
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )`);

    // Notifications
    await query(`CREATE TABLE IF NOT EXISTS notifications(
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                message TEXT,
                data TEXT,
                read INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )`);

    // Notification Settings
    await query(`CREATE TABLE IF NOT EXISTS notification_settings(
                user_id TEXT PRIMARY KEY,
                settings TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )`);

    // Login History
    await query(`CREATE TABLE IF NOT EXISTS login_history(
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                organization_id TEXT,
                ip_address TEXT,
                user_agent TEXT,
                location TEXT,
                status TEXT DEFAULT 'success',
                failure_reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )`);

    // Security Settings (org-level)
    await query(`CREATE TABLE IF NOT EXISTS security_settings(
                organization_id TEXT PRIMARY KEY,
                require_2fa INTEGER DEFAULT 0,
                password_min_length INTEGER DEFAULT 8,
                password_require_uppercase INTEGER DEFAULT 1,
                password_require_number INTEGER DEFAULT 1,
                password_require_special INTEGER DEFAULT 0,
                password_expiry_days INTEGER DEFAULT 0,
                session_timeout_minutes INTEGER DEFAULT 30,
                max_sessions_per_user INTEGER DEFAULT 5,
                ip_whitelist TEXT DEFAULT '[]',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_by TEXT,
                FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
            )`);

    // User Sessions
    await query(`CREATE TABLE IF NOT EXISTS user_sessions(
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                device_info TEXT,
                ip_address TEXT,
                user_agent TEXT,
                location TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_active_at TIMESTAMP,
                expires_at TIMESTAMP,
                is_current INTEGER DEFAULT 0,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )`);

    await query(`CREATE TABLE IF NOT EXISTS user_preferences(
                user_id TEXT NOT NULL,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY(user_id, key),
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )`);

    await query(`CREATE TABLE IF NOT EXISTS demo_sessions(
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                base_org_id TEXT NOT NULL,
                session_org_id TEXT NOT NULL,
                source TEXT DEFAULT 'demo_toggle',
                status TEXT DEFAULT 'active',
                anchor_date TIMESTAMP NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ended_at TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(base_org_id) REFERENCES organizations(id) ON DELETE CASCADE,
                FOREIGN KEY(session_org_id) REFERENCES organizations(id) ON DELETE CASCADE
            )`);
    await query(
      `CREATE INDEX IF NOT EXISTS idx_demo_sessions_user_status ON demo_sessions(user_id, status)`
    );
    await query(
      `CREATE INDEX IF NOT EXISTS idx_demo_sessions_expires_at ON demo_sessions(expires_at)`
    );

    await query(`CREATE TABLE IF NOT EXISTS demo_session_tenants(
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                tenant_org_id TEXT NOT NULL,
                base_org_id TEXT NOT NULL,
                ttl_expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(session_id) REFERENCES demo_sessions(id) ON DELETE CASCADE,
                FOREIGN KEY(tenant_org_id) REFERENCES organizations(id) ON DELETE CASCADE,
                FOREIGN KEY(base_org_id) REFERENCES organizations(id) ON DELETE CASCADE
            )`);
    await query(
      `CREATE INDEX IF NOT EXISTS idx_demo_session_tenants_ttl ON demo_session_tenants(ttl_expires_at)`
    );

    // 2FA state
    await query(`CREATE TABLE IF NOT EXISTS user_2fa(
                user_id TEXT PRIMARY KEY,
                is_enabled INTEGER DEFAULT 0,
                enabled_at TIMESTAMP,
                secret TEXT,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )`);

    // API logs (T113) + legacy aggregation fields
    // This table is used by apiLoggingMiddleware to log request metadata.
    await query(`CREATE TABLE IF NOT EXISTS api_logs(
                id TEXT PRIMARY KEY,
                endpoint TEXT,
                method TEXT,
                status_code INTEGER,
                response_time_ms INTEGER,
                user_id TEXT,
                organization_id TEXT,
                correlation_id TEXT,
                error_message TEXT,
                api_key_id TEXT,
                tokens_used REAL DEFAULT 0,
                cost REAL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);

    // Reconcile older schemas that created a minimal api_logs table
    await query(`
            DO $$
        BEGIN
                IF NOT EXISTS(SELECT 1 FROM information_schema.columns
                               WHERE table_name = 'api_logs' AND column_name = 'endpoint') THEN
                    ALTER TABLE api_logs ADD COLUMN endpoint TEXT;
                END IF;
                IF NOT EXISTS(SELECT 1 FROM information_schema.columns
                               WHERE table_name = 'api_logs' AND column_name = 'method') THEN
                    ALTER TABLE api_logs ADD COLUMN method TEXT;
                END IF;
                IF NOT EXISTS(SELECT 1 FROM information_schema.columns
                               WHERE table_name = 'api_logs' AND column_name = 'status_code') THEN
                    ALTER TABLE api_logs ADD COLUMN status_code INTEGER;
                END IF;
                IF NOT EXISTS(SELECT 1 FROM information_schema.columns
                               WHERE table_name = 'api_logs' AND column_name = 'response_time_ms') THEN
                    ALTER TABLE api_logs ADD COLUMN response_time_ms INTEGER;
                END IF;
                IF NOT EXISTS(SELECT 1 FROM information_schema.columns
                               WHERE table_name = 'api_logs' AND column_name = 'user_id') THEN
                    ALTER TABLE api_logs ADD COLUMN user_id TEXT;
                END IF;
                IF NOT EXISTS(SELECT 1 FROM information_schema.columns
                               WHERE table_name = 'api_logs' AND column_name = 'organization_id') THEN
                    ALTER TABLE api_logs ADD COLUMN organization_id TEXT;
                END IF;
                IF NOT EXISTS(SELECT 1 FROM information_schema.columns
                               WHERE table_name = 'api_logs' AND column_name = 'correlation_id') THEN
                    ALTER TABLE api_logs ADD COLUMN correlation_id TEXT;
                END IF;
                IF NOT EXISTS(SELECT 1 FROM information_schema.columns
                               WHERE table_name = 'api_logs' AND column_name = 'error_message') THEN
                    ALTER TABLE api_logs ADD COLUMN error_message TEXT;
                END IF;
            END $$;
        `).catch((_err: Error | null) => {
      logger.info('[Postgres] api_logs schema reconciliation skipped (may already exist)');
    });

    // Verification Tokens (email/account verification)
    await query(`CREATE TABLE IF NOT EXISTS verification_tokens(
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                type TEXT NOT NULL,
                expires_at TIMESTAMP,
                used INTEGER DEFAULT 0,
                used_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )`);

    // MCP Providers (Model Context Protocol)
    await query(`CREATE TABLE IF NOT EXISTS mcp_providers(
                id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                status TEXT DEFAULT 'active',
                config TEXT DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
            )`);

    // Audit Log (canonical) - used by compliance/audit routes and services
    await query(`CREATE TABLE IF NOT EXISTS audit_log(
                id TEXT PRIMARY KEY,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                actor_type TEXT,
                actor_id TEXT,
                actor_email TEXT,
                actor_name TEXT,
                actor_ip TEXT,
                actor_user_agent TEXT,
                action TEXT,
                action_category TEXT,
                action_description TEXT,
                resource_type TEXT,
                resource_id TEXT,
                resource_name TEXT,
                organization_id TEXT,
                project_id TEXT,
                previous_values TEXT,
                new_values TEXT,
                changed_fields TEXT,
                metadata TEXT,
                request_id TEXT,
                result TEXT,
                error_message TEXT,
                retention_category TEXT,
                -- Compatibility columns used by auditLog.routes.ts
                user_id TEXT,
                action_type TEXT,
                details TEXT,
                ip_address TEXT,
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
            )`);

    // Compliance Audits
    await query(`CREATE TABLE IF NOT EXISTS audits(
                id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL,
                name TEXT NOT NULL,
                type TEXT DEFAULT 'internal',
                status TEXT DEFAULT 'planned',
                score REAL,
                auditor TEXT,
                scheduled_date TEXT,
                completed_date TEXT,
                findings TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
            )`);

    // Status reports
    await query(`CREATE TABLE IF NOT EXISTS status_reports(
                id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL,
                project_id TEXT,
                title TEXT,
                content TEXT,
                health TEXT,
                period TEXT,
                created_by TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL,
                FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
            )`);

    // API keys (programmatic access)
    await query(`CREATE TABLE IF NOT EXISTS api_keys(
                id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL,
                name TEXT NOT NULL,
                key_prefix TEXT NOT NULL,
                key_hash TEXT NOT NULL,
                permissions TEXT NOT NULL,
                ip_whitelist TEXT,
                rate_limit INTEGER DEFAULT 100,
                expires_at TIMESTAMP,
                last_used_at TIMESTAMP,
                last_used_ip TEXT,
                rotated_from_id TEXT,
                status TEXT DEFAULT 'active',
                created_by TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY(rotated_from_id) REFERENCES api_keys(id) ON DELETE SET NULL
            )`);

    // Stabilization monitoring tables
    await query(`CREATE TABLE IF NOT EXISTS error_logs(
                id TEXT PRIMARY KEY,
                message TEXT,
                stack TEXT,
                context TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
    await query(`CREATE TABLE IF NOT EXISTS system_health_history(
                date TEXT PRIMARY KEY,
                avg_response_ms REAL,
                error_rate REAL,
                uptime_pct REAL
            )`);

    // Activity Logs
    await query(`CREATE TABLE IF NOT EXISTS activity_logs(
                id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL,
                user_id TEXT,
                action TEXT NOT NULL,
                entity_type TEXT NOT NULL,
                entity_id TEXT,
                entity_name TEXT,
                old_value TEXT,
                new_value TEXT,
                ip_address TEXT,
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
            )`);

    // Alter Users - Add columns if they don't exist (migration)
    await query(`
            DO $$
        BEGIN
                IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                               WHERE table_name = 'users' AND column_name = 'token_limit') THEN
                    ALTER TABLE users ADD COLUMN token_limit INTEGER DEFAULT 100000;
                END IF;
                IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                               WHERE table_name = 'users' AND column_name = 'token_used') THEN
                    ALTER TABLE users ADD COLUMN token_used INTEGER DEFAULT 0;
                END IF;
                IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                               WHERE table_name = 'users' AND column_name = 'token_reset_at') THEN
                    ALTER TABLE users ADD COLUMN token_reset_at TIMESTAMP;
                END IF;
                IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                               WHERE table_name = 'users' AND column_name = 'avatar_url') THEN
                    ALTER TABLE users ADD COLUMN avatar_url TEXT;
                END IF;
            END $$;
        `).catch((err: Error | null) => {
      logger.info('[Postgres] User token columns migration skipped (may already exist)');
    });

    // Ensure tasks table has organization_id column (migration for existing tables)
    await query(`
            DO $$
        BEGIN
            IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') THEN
                IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                               WHERE table_name = 'tasks' AND column_name = 'organization_id') THEN
                    ALTER TABLE tasks ADD COLUMN organization_id TEXT;
                    -- Add foreign key constraint if organizations table exists and constraint doesn't exist
                    IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations') THEN
                        IF NOT EXISTS(
                            SELECT 1 FROM information_schema.table_constraints 
                            WHERE table_name = 'tasks' 
                            AND constraint_name = 'tasks_organization_id_fkey'
                        ) THEN
                            ALTER TABLE tasks ADD CONSTRAINT tasks_organization_id_fkey 
                                FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
                        END IF;
                    END IF;
                END IF;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                -- Ignore errors (column or constraint may already exist)
                NULL;
        END $$;
        `).catch((err: Error | null) => {
      logger.info('[Postgres] Tasks organization_id column migration skipped (may already exist)');
    });

    // AI Feedback
    await query(`CREATE TABLE IF NOT EXISTS ai_feedback(
            id TEXT PRIMARY KEY,
            organization_id TEXT,
            user_id TEXT,
            context TEXT,
            prompt TEXT,
            response TEXT,
            helpful INTEGER,
            comment TEXT,
            rating INTEGER,
            correction TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
        )`);

    // Custom Prompts
    await query(`CREATE TABLE IF NOT EXISTS custom_prompts(
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            name TEXT NOT NULL,
            context TEXT NOT NULL,
            template TEXT NOT NULL,
            variables TEXT,
            is_active INTEGER DEFAULT 1,
            created_by TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
        )`);

    // Webhooks
    await query(`CREATE TABLE IF NOT EXISTS webhooks(
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            url TEXT NOT NULL,
            events TEXT NOT NULL,
            secret TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            created_by TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
        )`);

    // AI Logs
    await query(`CREATE TABLE IF NOT EXISTS ai_logs(
            id TEXT PRIMARY KEY,
            user_id TEXT,
            action TEXT,
            model TEXT,
            input_tokens INTEGER,
            output_tokens INTEGER,
            latency_ms INTEGER,
            topic TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

    // System Prompts
    await query(`CREATE TABLE IF NOT EXISTS system_prompts(
            id TEXT PRIMARY KEY,
            key TEXT UNIQUE,
            content TEXT,
            description TEXT,
            updated_by TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

    // Feedback
    await query(`CREATE TABLE IF NOT EXISTS feedback(
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            type TEXT NOT NULL,
            message TEXT NOT NULL,
            screenshot TEXT,
            url TEXT,
            status TEXT DEFAULT 'new',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

    // Revoked Tokens
    await query(`CREATE TABLE IF NOT EXISTS revoked_tokens(
            jti TEXT PRIMARY KEY,
            user_id TEXT,
            expires_at TIMESTAMP NOT NULL,
            revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            reason TEXT DEFAULT 'logout',
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

    // Invitations
    await query(`CREATE TABLE IF NOT EXISTS invitations(
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            email TEXT NOT NULL,
            role TEXT DEFAULT 'USER',
            token TEXT UNIQUE,
            token_hash TEXT UNIQUE,
            status TEXT DEFAULT 'pending',
            invited_by TEXT,
            expires_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            accepted_at TIMESTAMP,
            invitation_type TEXT DEFAULT 'ORG',
            project_id TEXT,
            role_to_assign TEXT,
            accepted_by_user_id TEXT,
            metadata TEXT DEFAULT '{}',
            resend_count INTEGER DEFAULT 0,
            last_resent_at TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(invited_by) REFERENCES users(id) ON DELETE SET NULL
        )`);

    // Add token_hash column if it doesn't exist (for existing tables created before this column was added)
    try {
      const columnCheck = await getPool().query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = 'invitations' AND column_name = 'token_hash'`
      );
      if (columnCheck.rows.length === 0) {
        await query(`ALTER TABLE invitations ADD COLUMN token_hash TEXT`);
        // Add unique constraint separately if needed
        try {
          await query(
            `CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_token_hash_unique ON invitations(token_hash) WHERE token_hash IS NOT NULL`
          );
        } catch {
          // Unique constraint might already exist or fail, that's OK
        }
      }
    } catch (alterError: unknown) {
      // Column might already exist or have constraints, that's OK
      const err = alterError as Error;
      if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
        logger.warn('[Postgres] Could not add token_hash column:', err.message);
      }
    }

    await query(`CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token)`);

    // Only create index on token_hash if the column exists
    try {
      const columnCheck = await getPool().query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = 'invitations' AND column_name = 'token_hash'`
      );
      if (columnCheck.rows.length > 0) {
        await query(
          `CREATE INDEX IF NOT EXISTS idx_invitations_token_hash ON invitations(token_hash)`
        );
      }
    } catch (indexError: unknown) {
      // Index creation failed, log but don't fail initialization
      const err = indexError as Error;
      if (!err.message.includes('does not exist')) {
        logger.warn('[Postgres] Could not create token_hash index:', err.message);
      }
    }

    await query(`CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email)`);
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_invitations_org_status ON invitations(organization_id, status)`,
      [],
      'Skipping organization_id status index on invitations'
    );
    // Create index on project_id only if column exists
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_invitations_project ON invitations(project_id)`,
      [],
      'Skipping project_id index on invitations'
    );

    // Access Requests
    await query(`CREATE TABLE IF NOT EXISTS access_requests(
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            first_name TEXT,
            last_name TEXT,
            phone TEXT,
            organization_id TEXT,
            organization_name TEXT,
            requested_role TEXT DEFAULT 'USER',
            status TEXT DEFAULT 'pending',
            request_type TEXT DEFAULT 'new_user',
            metadata TEXT,
            requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            reviewed_by TEXT,
            reviewed_at TIMESTAMP,
            rejection_reason TEXT,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(reviewed_by) REFERENCES users(id) ON DELETE SET NULL
        )`);

    // Access Codes
    await query(`CREATE TABLE IF NOT EXISTS access_codes(
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            code TEXT NOT NULL UNIQUE,
            created_by TEXT NOT NULL,
            role TEXT DEFAULT 'USER',
            max_uses INTEGER DEFAULT 1,
            current_uses INTEGER DEFAULT 0,
            expires_at TIMESTAMP,
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
        )`);

    // Access Code Usage
    await query(`CREATE TABLE IF NOT EXISTS access_code_usage(
            id TEXT PRIMARY KEY,
            code_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(code_id) REFERENCES access_codes(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

    // Initiatives
    await query(`CREATE TABLE IF NOT EXISTS initiatives(
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            project_id TEXT,
            name TEXT NOT NULL,
            title TEXT,
            axis TEXT,
            area TEXT,
            summary TEXT,
            hypothesis TEXT,
            status TEXT DEFAULT 'step3',
            current_stage TEXT,
            business_value TEXT,
            competencies_required TEXT,
            cost_capex REAL,
            cost_opex REAL,
            expected_roi REAL,
            social_impact TEXT,
            planned_start_date TIMESTAMP,
            planned_end_date TIMESTAMP,
            start_date TIMESTAMP,
            pilot_end_date TIMESTAMP,
            end_date TIMESTAMP,
            owner_business_id TEXT,
            owner_execution_id TEXT,
            sponsor_id TEXT,
            priority TEXT DEFAULT 'medium',
            market_context TEXT,
            problem_statement TEXT DEFAULT '',
            deliverables TEXT DEFAULT '[]',
            success_criteria TEXT DEFAULT '[]',
            scope_in TEXT DEFAULT '[]',
            scope_out TEXT DEFAULT '[]',
            kill_criteria TEXT DEFAULT '[]',
            key_risks TEXT DEFAULT '[]',
            estimated_budget REAL,
            resource_tools TEXT DEFAULT '[]',
            tags TEXT DEFAULT '[]',
            target_state TEXT DEFAULT '{}',
            baseline_version INTEGER DEFAULT 0,
            schedule_baseline_id TEXT,
            report_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(owner_business_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY(owner_execution_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY(sponsor_id) REFERENCES users(id) ON DELETE SET NULL
        )`);

    // SaaS persistence: ensure initiatives columns exist on older DBs
    // (CREATE TABLE IF NOT EXISTS won't add new columns).
    const ensureColumn = async (column: string, ddl: string) => {
      if (!(await columnExists('initiatives', column))) {
        await query(`ALTER TABLE initiatives ADD COLUMN ${ddl}`);
      }
    };
    await ensureColumn('title', 'title TEXT');
    await ensureColumn('planned_start_date', 'planned_start_date TIMESTAMP');
    await ensureColumn('planned_end_date', 'planned_end_date TIMESTAMP');
    await ensureColumn('priority', "priority TEXT DEFAULT 'medium'");
    await ensureColumn('kill_criteria', "kill_criteria TEXT DEFAULT '[]'");
    await ensureColumn('estimated_budget', 'estimated_budget REAL');
    await ensureColumn('resource_tools', "resource_tools TEXT DEFAULT '[]'");
    await ensureColumn('tags', "tags TEXT DEFAULT '[]'");
    await ensureColumn('target_state', "target_state TEXT DEFAULT '{}'");
    await ensureColumn('source_assessment_id', 'source_assessment_id TEXT');
    await ensureColumn('source_report_id', 'source_report_id TEXT');
    await ensureColumn('source_type', 'source_type TEXT');
    await ensureColumn('source_id', 'source_id TEXT');
    await ensureColumn('created_from', 'created_from TEXT');
    await ensureColumn('created_by', 'created_by TEXT');
    await ensureColumn('updated_by', 'updated_by TEXT');
    await ensureColumn('baseline_version', 'baseline_version INTEGER DEFAULT 0');
    await ensureColumn('schedule_baseline_id', 'schedule_baseline_id TEXT');
    await ensureColumn('action_contract_json', "action_contract_json TEXT DEFAULT '{}'");
    await ensureColumn('source_pack_json', "source_pack_json TEXT DEFAULT '{}'");
    await ensureColumn('evidence_refs_json', "evidence_refs_json TEXT DEFAULT '[]'");

    // Initiative timeline tables (baseline snapshots + milestones + dependencies)
    await query(`CREATE TABLE IF NOT EXISTS initiative_schedule_baselines (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            initiative_id TEXT NOT NULL,
            version INTEGER NOT NULL,
            status_at_baseline TEXT,
            planned_start_date TIMESTAMP,
            planned_end_date TIMESTAMP,
            snapshot TEXT NOT NULL DEFAULT '{}',
            created_by TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE,
            FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
        )`);
    await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ini_schedule_baselines_unique
        ON initiative_schedule_baselines(initiative_id, version)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_ini_schedule_baselines_org
        ON initiative_schedule_baselines(organization_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_ini_schedule_baselines_initiative
        ON initiative_schedule_baselines(initiative_id)`);

    // Decisions registry (required by initiative gates and MyWork integrations).
    await query(`CREATE TABLE IF NOT EXISTS decisions (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            project_id TEXT,
            initiative_id TEXT,
            task_id TEXT,
            title TEXT NOT NULL,
            type TEXT DEFAULT 'APPROVAL',
            decision_maker_id TEXT,
            created_by TEXT,
            status TEXT DEFAULT 'pending',
            options TEXT DEFAULT '[]',
            criteria TEXT,
            deadline TIMESTAMP,
            escalation_deadline TIMESTAMP,
            selected_option TEXT,
            decision_rationale TEXT,
            decided_at TIMESTAMP,
            source_type TEXT,
            source_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL,
            FOREIGN KEY(initiative_id) REFERENCES initiatives(id) ON DELETE SET NULL,
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE SET NULL,
            FOREIGN KEY(decision_maker_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
        )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_decisions_org ON decisions(organization_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_decisions_project ON decisions(project_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_decisions_initiative ON decisions(initiative_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status)`);

    await query(`CREATE TABLE IF NOT EXISTS initiative_milestones (
            id TEXT PRIMARY KEY,
            initiative_id TEXT NOT NULL,
            organization_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            target_date DATE,
            actual_date DATE,
            status TEXT DEFAULT 'PENDING',
            order_index INTEGER DEFAULT 0,
            is_gate INTEGER DEFAULT 0,
            gate_decision_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT,
            FOREIGN KEY(initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(gate_decision_id) REFERENCES decisions(id) ON DELETE SET NULL
        )`);
    await query(
      `CREATE INDEX IF NOT EXISTS idx_milestones_initiative ON initiative_milestones(initiative_id)`
    );
    await query(
      `CREATE INDEX IF NOT EXISTS idx_milestones_org ON initiative_milestones(organization_id)`
    );
    await query(
      `CREATE INDEX IF NOT EXISTS idx_milestones_target_date ON initiative_milestones(target_date)`
    );
    await query(
      `CREATE INDEX IF NOT EXISTS idx_milestones_status ON initiative_milestones(status)`
    );

    await query(`CREATE TABLE IF NOT EXISTS initiative_dependencies (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            project_id TEXT,
            from_initiative_id TEXT NOT NULL,
            to_initiative_id TEXT NOT NULL,
            type TEXT DEFAULT 'FINISH_TO_START',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL,
            FOREIGN KEY(from_initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE,
            FOREIGN KEY(to_initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE
        )`);
    await query(
      `CREATE INDEX IF NOT EXISTS idx_initiative_dependencies_org ON initiative_dependencies(organization_id)`
    );
    await query(
      `CREATE INDEX IF NOT EXISTS idx_initiative_dependencies_project ON initiative_dependencies(project_id)`
    );
    await query(
      `CREATE INDEX IF NOT EXISTS idx_initiative_dependencies_from ON initiative_dependencies(from_initiative_id)`
    );
    await query(
      `CREATE INDEX IF NOT EXISTS idx_initiative_dependencies_to ON initiative_dependencies(to_initiative_id)`
    );

    // Task Dependencies
    await query(`CREATE TABLE IF NOT EXISTS task_dependencies(
            id TEXT PRIMARY KEY,
            from_task_id TEXT NOT NULL,
            to_task_id TEXT NOT NULL,
            type TEXT DEFAULT 'hard',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(from_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            FOREIGN KEY(to_task_id) REFERENCES tasks(id) ON DELETE CASCADE
        )`);

    // PMO Audit Trail (used by TaskController, taskAssignmentService, projectMemberService, pmoDomainRegistry)
    await query(`CREATE TABLE IF NOT EXISTS pmo_audit_trail (
            id TEXT PRIMARY KEY,
            project_id TEXT,
            pmo_domain_id TEXT,
            pmo_phase TEXT,
            object_type TEXT,
            object_id TEXT,
            action TEXT,
            actor_id TEXT,
            iso21500_mapping TEXT,
            pmbok_mapping TEXT,
            prince2_mapping TEXT,
            metadata TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

    // Subscription Plans
    await query(`CREATE TABLE IF NOT EXISTS subscription_plans(
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            price_monthly REAL NOT NULL,
            billing_model TEXT DEFAULT 'subscription',
            token_limit INTEGER,
            storage_limit_gb REAL,
            memory_limit_mb INTEGER,
            cpu_quota_percent REAL,
            max_concurrent_ai_jobs INTEGER,
            token_overage_rate REAL,
            storage_overage_rate REAL,
            stripe_price_id TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

    // SaaS persistence: ensure subscription_plans is compatible with current billing/quota code.
    // Older schemas used TEXT flags and omitted quota columns.
    if (await tableExists('subscription_plans')) {
      const ensurePlanCol = async (column: string, ddl: string) => {
        if (!(await columnExists('subscription_plans', column))) {
          await querySafe(
            `ALTER TABLE subscription_plans ADD COLUMN ${ddl}`,
            [],
            `subscription_plans.${column}`
          );
        }
      };

      await ensurePlanCol('token_limit', 'token_limit INTEGER');
      await ensurePlanCol('billing_model', `billing_model TEXT DEFAULT 'subscription'`);
      await ensurePlanCol('storage_limit_gb', 'storage_limit_gb REAL');
      await ensurePlanCol('memory_limit_mb', 'memory_limit_mb INTEGER');
      await ensurePlanCol('cpu_quota_percent', 'cpu_quota_percent REAL');
      await ensurePlanCol('max_concurrent_ai_jobs', 'max_concurrent_ai_jobs INTEGER');
      await ensurePlanCol('token_overage_rate', 'token_overage_rate REAL');
      await ensurePlanCol('storage_overage_rate', 'storage_overage_rate REAL');
      await ensurePlanCol('stripe_price_id', 'stripe_price_id TEXT');

      // Fix legacy TEXT flags: is_active/is_public/sort_order/updated_at sometimes existed as TEXT.
      try {
        const typeRes = await getPool().query(
          `SELECT column_name, data_type
           FROM information_schema.columns
           WHERE table_schema='public' AND table_name='subscription_plans'
             AND column_name IN ('is_active','is_public','sort_order')`
        );
        const types = new Map<string, string>(
          (typeRes.rows || []).map((r: any) => [String(r.column_name), String(r.data_type)])
        );

        if (types.get('is_active') === 'text') {
          await querySafe(
            `ALTER TABLE subscription_plans
             ALTER COLUMN is_active TYPE INTEGER
             USING (
               CASE
                 WHEN COALESCE(is_active,'') = '' THEN 1
                 WHEN lower(is_active) IN ('1','t','true','y','yes','on') THEN 1
                 ELSE 0
               END
             )`,
            [],
            'subscription_plans.is_active type cast'
          );
          await querySafe(
            `ALTER TABLE subscription_plans ALTER COLUMN is_active SET DEFAULT 1`,
            [],
            'subscription_plans.is_active default'
          );
        }

        if (types.get('is_public') === 'text') {
          await querySafe(
            `ALTER TABLE subscription_plans
             ALTER COLUMN is_public TYPE INTEGER
             USING (
               CASE
                 WHEN COALESCE(is_public,'') = '' THEN 1
                 WHEN lower(is_public) IN ('1','t','true','y','yes','on') THEN 1
                 ELSE 0
               END
             )`,
            [],
            'subscription_plans.is_public type cast'
          );
          await querySafe(
            `ALTER TABLE subscription_plans ALTER COLUMN is_public SET DEFAULT 1`,
            [],
            'subscription_plans.is_public default'
          );
        }

        if (types.get('sort_order') === 'text') {
          await querySafe(
            `ALTER TABLE subscription_plans
             ALTER COLUMN sort_order TYPE INTEGER
             USING (
               CASE
                 WHEN sort_order ~ '^[0-9]+$' THEN sort_order::integer
                 ELSE 0
               END
             )`,
            [],
            'subscription_plans.sort_order type cast'
          );
          await querySafe(
            `ALTER TABLE subscription_plans ALTER COLUMN sort_order SET DEFAULT 0`,
            [],
            'subscription_plans.sort_order default'
          );
        }

        // Ensure existing rows default to active/public if legacy values were NULL/empty
        await querySafe(
          `UPDATE subscription_plans
           SET is_active = COALESCE(is_active, 1),
               is_public = COALESCE(is_public, 1),
               sort_order = COALESCE(sort_order, 0)`,
          [],
          'subscription_plans normalize legacy nulls'
        );
      } catch (e: any) {
        logger.debug('[Postgres] subscription_plans compatibility patch skipped:', e?.message || e);
      }
    }

    // Organization Billing
    await query(`CREATE TABLE IF NOT EXISTS organization_billing(
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL UNIQUE,
            subscription_plan_id TEXT,
            billing_rail TEXT DEFAULT 'stripe_subscription',
            contract_status TEXT,
            contract_type TEXT,
            renewal_at TIMESTAMP,
            grace_until TIMESTAMP,
            access_expires_at TIMESTAMP,
            external_invoice_ref TEXT,
            notes TEXT,
            managed_by_user_id TEXT,
            is_manual_override INTEGER DEFAULT 0,
            stripe_customer_id TEXT,
            stripe_subscription_id TEXT,
            billing_email TEXT,
            billing_address TEXT,
            payment_method_last4 TEXT,
            payment_method_brand TEXT,
            current_period_start TIMESTAMP,
            current_period_end TIMESTAMP,
            status TEXT DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(subscription_plan_id) REFERENCES subscription_plans(id)
        )`);
    await query(
      `ALTER TABLE organization_billing ADD COLUMN IF NOT EXISTS billing_rail TEXT DEFAULT 'stripe_subscription'`
    );
    await query(`ALTER TABLE organization_billing ADD COLUMN IF NOT EXISTS contract_status TEXT`);
    await query(`ALTER TABLE organization_billing ADD COLUMN IF NOT EXISTS contract_type TEXT`);
    await query(`ALTER TABLE organization_billing ADD COLUMN IF NOT EXISTS renewal_at TIMESTAMP`);
    await query(`ALTER TABLE organization_billing ADD COLUMN IF NOT EXISTS grace_until TIMESTAMP`);
    await query(
      `ALTER TABLE organization_billing ADD COLUMN IF NOT EXISTS access_expires_at TIMESTAMP`
    );
    await query(
      `ALTER TABLE organization_billing ADD COLUMN IF NOT EXISTS external_invoice_ref TEXT`
    );
    await query(`ALTER TABLE organization_billing ADD COLUMN IF NOT EXISTS notes TEXT`);
    await query(
      `ALTER TABLE organization_billing ADD COLUMN IF NOT EXISTS managed_by_user_id TEXT`
    );
    await query(
      `ALTER TABLE organization_billing ADD COLUMN IF NOT EXISTS is_manual_override INTEGER DEFAULT 0`
    );

    // Usage Records
    await query(`CREATE TABLE IF NOT EXISTS usage_records(
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            user_id TEXT,
            type TEXT NOT NULL,
            amount INTEGER NOT NULL,
            action TEXT,
            metadata TEXT,
            recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
        )`);

    // Usage Summaries
    await query(`CREATE TABLE IF NOT EXISTS usage_summaries(
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            period_start DATE NOT NULL,
            period_end DATE NOT NULL,
            tokens_used INTEGER DEFAULT 0,
            tokens_included INTEGER DEFAULT 0,
            tokens_overage INTEGER DEFAULT 0,
            storage_bytes_peak INTEGER DEFAULT 0,
            storage_gb_included REAL DEFAULT 0,
            storage_gb_overage REAL DEFAULT 0,
            overage_amount REAL DEFAULT 0,
            billed INTEGER DEFAULT 0,
            stripe_invoice_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(organization_id, period_start)
        )`);

    // Invoices
    await query(`CREATE TABLE IF NOT EXISTS invoices(
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            source TEXT DEFAULT 'stripe',
            stripe_invoice_id TEXT UNIQUE,
            invoice_number TEXT,
            subtotal REAL,
            tax_amount REAL,
            total REAL,
            amount_paid REAL,
            amount_due REAL,
            currency TEXT DEFAULT 'usd',
            status TEXT,
            due_date TIMESTAMP,
            paid_at TIMESTAMP,
            period_start DATE,
            period_end DATE,
            pdf_url TEXT,
            line_items TEXT,
            metadata TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);

    // Ensure newer invoice fields exist even when table pre-dates them
    await query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_number TEXT`);
    await query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'stripe'`);
    await query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal REAL`);
    await query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_amount REAL`);
    await query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total REAL`);
    await query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date TIMESTAMP`);
    await query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP`);
    await query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS line_items TEXT`);
    await query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS metadata TEXT`);
    await query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP`);

    // Plan Features
    await query(`CREATE TABLE IF NOT EXISTS plan_features(
            id TEXT PRIMARY KEY,
            plan_id TEXT NOT NULL,
            feature_key TEXT NOT NULL,
            enabled INTEGER DEFAULT 1,
            limit_value INTEGER,
            FOREIGN KEY(plan_id) REFERENCES subscription_plans(id) ON DELETE CASCADE
        )`);

    // Billing Margins
    await query(`CREATE TABLE IF NOT EXISTS billing_margins(
            id TEXT PRIMARY KEY,
            source_type TEXT NOT NULL UNIQUE,
            display_name TEXT,
            base_cost_per_1k REAL DEFAULT 0,
            margin_percent REAL NOT NULL,
            min_charge REAL DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

    // Token Packages
    await query(`CREATE TABLE IF NOT EXISTS token_packages(
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            tokens INTEGER NOT NULL,
            price_usd REAL NOT NULL,
            stripe_price_id TEXT,
            bonus_percent INTEGER DEFAULT 0,
            is_popular INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

    // User Token Balance
    await query(`CREATE TABLE IF NOT EXISTS user_token_balance(
            user_id TEXT PRIMARY KEY,
            platform_tokens INTEGER DEFAULT 0,
            platform_tokens_bonus INTEGER DEFAULT 0,
            byok_usage_tokens INTEGER DEFAULT 0,
            local_usage_tokens INTEGER DEFAULT 0,
            lifetime_purchased INTEGER DEFAULT 0,
            lifetime_used INTEGER DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

    // Token Transactions
    await query(`CREATE TABLE IF NOT EXISTS token_transactions(
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            organization_id TEXT,
            type TEXT NOT NULL,
            source_type TEXT,
            tokens INTEGER NOT NULL,
            cost_usd REAL DEFAULT 0,
            margin_usd REAL DEFAULT 0,
            net_revenue_usd REAL DEFAULT 0,
            stripe_payment_id TEXT,
            package_id TEXT,
            llm_provider TEXT,
            model_used TEXT,
            description TEXT,
            metadata TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(package_id) REFERENCES token_packages(id) ON DELETE SET NULL
        )`);

    // User API Keys
    await query(`CREATE TABLE IF NOT EXISTS user_api_keys(
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            organization_id TEXT,
            provider TEXT NOT NULL,
            display_name TEXT,
            encrypted_key TEXT NOT NULL,
            model_preference TEXT,
            scopes TEXT DEFAULT '[]',
            expires_at TIMESTAMP,
            rate_limit_per_minute INTEGER,
            rate_limit_per_day INTEGER,
            quota_used INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            is_default INTEGER DEFAULT 0,
            usage_count INTEGER DEFAULT 0,
            last_used_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);

    // Ensure user_api_keys table has required columns (migration for existing tables)
    await query(`
            DO $$
        BEGIN
            IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'user_api_keys') THEN
                IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                               WHERE table_name = 'user_api_keys' AND column_name = 'scopes') THEN
                    ALTER TABLE user_api_keys ADD COLUMN scopes TEXT DEFAULT '[]';
                END IF;
                IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                               WHERE table_name = 'user_api_keys' AND column_name = 'expires_at') THEN
                    ALTER TABLE user_api_keys ADD COLUMN expires_at TIMESTAMP;
                END IF;
                IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                               WHERE table_name = 'user_api_keys' AND column_name = 'rate_limit_per_minute') THEN
                    ALTER TABLE user_api_keys ADD COLUMN rate_limit_per_minute INTEGER;
                END IF;
                IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                               WHERE table_name = 'user_api_keys' AND column_name = 'rate_limit_per_day') THEN
                    ALTER TABLE user_api_keys ADD COLUMN rate_limit_per_day INTEGER;
                END IF;
                IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                               WHERE table_name = 'user_api_keys' AND column_name = 'quota_used') THEN
                    ALTER TABLE user_api_keys ADD COLUMN quota_used INTEGER DEFAULT 0;
                END IF;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                -- Ignore errors (columns may already exist)
                NULL;
        END $$;
        `).catch((err: Error | null) => {
      logger.info('[Postgres] User API keys columns migration skipped (may already exist)');
    });

    // GDPR Requests
    await query(`CREATE TABLE IF NOT EXISTS gdpr_requests(
            id VARCHAR(36) PRIMARY KEY,
            organization_id VARCHAR(36) NOT NULL,
            user_id VARCHAR(36) NOT NULL,
            type VARCHAR(50) NOT NULL,
            status VARCHAR(50) NOT NULL,
            result_url TEXT,
            processed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_gdpr_requests_user ON gdpr_requests(user_id)`);

    // User Consents
    await query(`CREATE TABLE IF NOT EXISTS user_consents(
            id VARCHAR(36) PRIMARY KEY,
            user_id VARCHAR(36) NOT NULL REFERENCES users(id),
            organization_id VARCHAR(36) NOT NULL REFERENCES organizations(id),
            consent_type VARCHAR(100) NOT NULL,
            consent_version VARCHAR(50),
            consent_status VARCHAR(50) NOT NULL,
            ip_address VARCHAR(45),
            user_agent TEXT,
            granted_at TIMESTAMP,
            withdrawn_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, organization_id, consent_type)
        )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_user_consents_user ON user_consents(user_id)`);

    // AI Ideas Board
    await query(`CREATE TABLE IF NOT EXISTS ai_ideas(
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title TEXT NOT NULL,
            description TEXT,
            status VARCHAR(50) DEFAULT 'new',
            priority VARCHAR(50) DEFAULT 'medium',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

    // AI System Observations
    await query(`CREATE TABLE IF NOT EXISTS ai_observations(
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            content TEXT NOT NULL,
            category VARCHAR(50),
            confidence_score REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

    // Approval Assignments
    await query(`CREATE TABLE IF NOT EXISTS approval_assignments(
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL,
            proposal_id TEXT NOT NULL,
            assigned_to_user_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'PENDING',
            sla_due_at TIMESTAMP NOT NULL,
            escalated_to_user_id TEXT,
            escalated_at TIMESTAMP,
            escalation_reason TEXT,
            acked_at TIMESTAMP,
            completed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(org_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(assigned_to_user_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY(escalated_to_user_id) REFERENCES users(id) ON DELETE SET NULL
        )`);

    // Indexes for approval_assignments
    await query(
      `CREATE INDEX IF NOT EXISTS idx_approval_assignments_org ON approval_assignments(org_id)`
    );
    await query(
      `CREATE INDEX IF NOT EXISTS idx_approval_assignments_user ON approval_assignments(assigned_to_user_id, status)`
    );
    await query(
      `CREATE INDEX IF NOT EXISTS idx_approval_assignments_proposal ON approval_assignments(proposal_id)`
    );
    await query(
      `CREATE INDEX IF NOT EXISTS idx_approval_assignments_sla ON approval_assignments(sla_due_at, status)`
    );

    // MFA Attempts
    await query(`CREATE TABLE IF NOT EXISTS mfa_attempts(
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            attempt_type TEXT NOT NULL CHECK(attempt_type IN('TOTP', 'BACKUP_CODE', 'SMS', 'EMAIL')),
            success INTEGER NOT NULL DEFAULT 0,
            ip_address TEXT,
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

    await query(
      `CREATE INDEX IF NOT EXISTS idx_mfa_attempts_user_time ON mfa_attempts(user_id, created_at DESC)`
    );
    await query(
      `CREATE INDEX IF NOT EXISTS idx_mfa_attempts_ip ON mfa_attempts(ip_address, created_at DESC)`
    );

    // Trusted Devices
    await query(`CREATE TABLE IF NOT EXISTS trusted_devices(
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            device_fingerprint TEXT NOT NULL,
            device_name TEXT,
            last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, device_fingerprint)
        )`);

    await query(`CREATE INDEX IF NOT EXISTS idx_trusted_devices_user ON trusted_devices(user_id)`);
    await query(
      `CREATE INDEX IF NOT EXISTS idx_trusted_devices_fingerprint ON trusted_devices(device_fingerprint)`
    );

    // Refresh Tokens
    await query(`CREATE TABLE IF NOT EXISTS refresh_tokens(
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            token_hash TEXT NOT NULL UNIQUE,
            token_family TEXT,
            device_info TEXT,
            ip_address TEXT,
            user_agent TEXT,
            expires_at TIMESTAMP NOT NULL,
            revoked_at TIMESTAMP,
            revoked_reason TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

    // Add token_hash column if it doesn't exist (for existing tables created before this column was added)
    try {
      const columnCheck = await getPool().query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = 'refresh_tokens' AND column_name = 'token_hash'`
      );
      if (columnCheck.rows.length === 0) {
        await query(`ALTER TABLE refresh_tokens ADD COLUMN token_hash TEXT NOT NULL`);
        // Add unique constraint separately
        try {
          await query(
            `CREATE UNIQUE INDEX IF NOT EXISTS idx_refresh_tokens_hash_unique ON refresh_tokens(token_hash)`
          );
        } catch {
          // Unique constraint might already exist, that's OK
        }
      }
    } catch (alterError: unknown) {
      // Column might already exist or have constraints, that's OK
      const err = alterError as Error;
      if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
        logger.warn('[Postgres] Could not add token_hash column to refresh_tokens:', err.message);
      }
    }

    await query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id)`);

    // Only create index on token_hash if the column exists
    try {
      const columnCheck = await getPool().query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = 'refresh_tokens' AND column_name = 'token_hash'`
      );
      if (columnCheck.rows.length > 0) {
        await query(
          `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash)`
        );
      }
    } catch (indexError: unknown) {
      // Index creation failed, log but don't fail initialization
      const err = indexError as Error;
      if (!err.message.includes('does not exist')) {
        logger.warn('[Postgres] Could not create token_hash index on refresh_tokens:', err.message);
      }
    }

    await query(
      `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(token_family)`
    );
    await query(
      `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at)`
    );

    // Scheduled Emails
    await query(`CREATE TABLE IF NOT EXISTS scheduled_emails(
            id TEXT PRIMARY KEY,
            report_id TEXT NOT NULL,
            recipients TEXT NOT NULL,
            scheduled_time TIMESTAMP NOT NULL,
            status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING', 'SENT', 'FAILED')),
            sent_at TIMESTAMP,
            error TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

    await query(
      `CREATE INDEX IF NOT EXISTS idx_scheduled_emails_status_time ON scheduled_emails(status, scheduled_time)`
    );
    await query(
      `CREATE INDEX IF NOT EXISTS idx_scheduled_emails_report ON scheduled_emails(report_id)`
    );

    // Add MFA columns to existing tables if they don't exist (migration)
    await query(`
            DO $$
        BEGIN
                IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                               WHERE table_name = 'users' AND column_name = 'mfa_enabled') THEN
                    ALTER TABLE users ADD COLUMN mfa_enabled INTEGER DEFAULT 0;
                END IF;
                IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                               WHERE table_name = 'users' AND column_name = 'mfa_secret') THEN
                    ALTER TABLE users ADD COLUMN mfa_secret TEXT;
                END IF;
                IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                               WHERE table_name = 'users' AND column_name = 'mfa_backup_codes') THEN
                    ALTER TABLE users ADD COLUMN mfa_backup_codes TEXT;
                END IF;
                IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                               WHERE table_name = 'users' AND column_name = 'mfa_verified_at') THEN
                    ALTER TABLE users ADD COLUMN mfa_verified_at TIMESTAMP;
                END IF;
                IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                               WHERE table_name = 'users' AND column_name = 'mfa_recovery_email') THEN
                    ALTER TABLE users ADD COLUMN mfa_recovery_email TEXT;
                END IF;
            END $$;
        `).catch((err: Error | null) => {
      logger.info('[Postgres] MFA columns migration skipped (may already exist)');
    });

    // Add additional Organization columns if missing
    await query(`
            DO $$
        BEGIN
        --MFA columns
            IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                            WHERE table_name = 'organizations' AND column_name = 'mfa_required') THEN
                ALTER TABLE organizations ADD COLUMN mfa_required INTEGER DEFAULT 0;
            END IF;
            IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                            WHERE table_name = 'organizations' AND column_name = 'mfa_grace_period_days') THEN
                ALTER TABLE organizations ADD COLUMN mfa_grace_period_days INTEGER DEFAULT 7;
            END IF;
            IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                            WHERE table_name = 'organizations' AND column_name = 'discount_percent') THEN
                ALTER TABLE organizations ADD COLUMN discount_percent INTEGER DEFAULT 0;
            END IF;
        --Trial fields
            IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                            WHERE table_name = 'organizations' AND column_name = 'trial_started_at') THEN
                ALTER TABLE organizations ADD COLUMN trial_started_at TIMESTAMP;
            END IF;
            IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                            WHERE table_name = 'organizations' AND column_name = 'trial_expires_at') THEN
                ALTER TABLE organizations ADD COLUMN trial_expires_at TIMESTAMP;
            END IF;
            IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                            WHERE table_name = 'organizations' AND column_name = 'trial_extension_count') THEN
                ALTER TABLE organizations ADD COLUMN trial_extension_count INTEGER DEFAULT 0;
            END IF;
            IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                            WHERE table_name = 'organizations' AND column_name = 'trial_warning_sent_at') THEN
                ALTER TABLE organizations ADD COLUMN trial_warning_sent_at TIMESTAMP;
            END IF;
            IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                            WHERE table_name = 'organizations' AND column_name = 'trial_tokens_used') THEN
                ALTER TABLE organizations ADD COLUMN trial_tokens_used INTEGER DEFAULT 0;
            END IF;
        --Organization type and status
            IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                            WHERE table_name = 'organizations' AND column_name = 'organization_type') THEN
                ALTER TABLE organizations ADD COLUMN organization_type TEXT DEFAULT 'TRIAL';
            END IF;
            IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                            WHERE table_name = 'organizations' AND column_name = 'billing_status') THEN
                ALTER TABLE organizations ADD COLUMN billing_status TEXT DEFAULT 'PENDING';
            END IF;
            IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                            WHERE table_name = 'organizations' AND column_name = 'is_active') THEN
                ALTER TABLE organizations ADD COLUMN is_active INTEGER DEFAULT 1;
            END IF;
            IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                            WHERE table_name = 'organizations' AND column_name = 'token_balance') THEN
                ALTER TABLE organizations ADD COLUMN token_balance INTEGER DEFAULT 0;
            END IF;
        --Attribution
            IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                            WHERE table_name = 'organizations' AND column_name = 'attribution_data') THEN
                ALTER TABLE organizations ADD COLUMN attribution_data TEXT;
            END IF;
        --Onboarding
            IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                            WHERE table_name = 'organizations' AND column_name = 'transformation_context') THEN
                ALTER TABLE organizations ADD COLUMN transformation_context TEXT DEFAULT '{}';
            END IF;
            IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                            WHERE table_name = 'organizations' AND column_name = 'onboarding_status') THEN
                ALTER TABLE organizations ADD COLUMN onboarding_status TEXT DEFAULT 'NOT_STARTED';
            END IF;
            IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                            WHERE table_name = 'organizations' AND column_name = 'onboarding_plan_snapshot') THEN
                ALTER TABLE organizations ADD COLUMN onboarding_plan_snapshot TEXT;
            END IF;
            IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                            WHERE table_name = 'organizations' AND column_name = 'onboarding_plan_version') THEN
                ALTER TABLE organizations ADD COLUMN onboarding_plan_version INTEGER DEFAULT 0;
            END IF;
            IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                            WHERE table_name = 'organizations' AND column_name = 'onboarding_accepted_at') THEN
                ALTER TABLE organizations ADD COLUMN onboarding_accepted_at TIMESTAMP;
            END IF;
            IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                            WHERE table_name = 'organizations' AND column_name = 'onboarding_accept_idempotency_key') THEN
                ALTER TABLE organizations ADD COLUMN onboarding_accept_idempotency_key TEXT;
            END IF;
        --AI Governance
            IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                            WHERE table_name = 'organizations' AND column_name = 'ai_assertiveness_level') THEN
                ALTER TABLE organizations ADD COLUMN ai_assertiveness_level TEXT DEFAULT 'MEDIUM';
            END IF;
            IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                            WHERE table_name = 'organizations' AND column_name = 'ai_autonomy_level') THEN
                ALTER TABLE organizations ADD COLUMN ai_autonomy_level TEXT DEFAULT 'SUGGEST_ONLY';
            END IF;
        --Created by
            IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                            WHERE table_name = 'organizations' AND column_name = 'created_by_user_id') THEN
                ALTER TABLE organizations ADD COLUMN created_by_user_id TEXT;
            END IF;
        --Budget tracking
            IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                            WHERE table_name = 'organizations' AND column_name = 'monthly_budget_usd') THEN
                ALTER TABLE organizations ADD COLUMN monthly_budget_usd REAL;
            END IF;
            IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                            WHERE table_name = 'organizations' AND column_name = 'budget_spent_current_period') THEN
                ALTER TABLE organizations ADD COLUMN budget_spent_current_period REAL DEFAULT 0;
            END IF;
            IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                            WHERE table_name = 'organizations' AND column_name = 'budget_alert_threshold') THEN
                ALTER TABLE organizations ADD COLUMN budget_alert_threshold REAL DEFAULT 0.8;
            END IF;
            IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                            WHERE table_name = 'organizations' AND column_name = 'budget_period_start') THEN
                ALTER TABLE organizations ADD COLUMN budget_period_start TIMESTAMP;
            END IF;
        --Resource usage tracking
            IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                            WHERE table_name = 'organizations' AND column_name = 'memory_usage_mb_current') THEN
                ALTER TABLE organizations ADD COLUMN memory_usage_mb_current INTEGER DEFAULT 0;
            END IF;
            IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                            WHERE table_name = 'organizations' AND column_name = 'cpu_usage_percent_avg') THEN
                ALTER TABLE organizations ADD COLUMN cpu_usage_percent_avg REAL DEFAULT 0;
            END IF;
            END $$;
        `).catch((err: Error | null) => {
      logger.info('[Postgres] Organization columns migration skipped');
    });

    // ---------------------------------------------------------
    // Phase 1.3: Performance Optimization (Missing Indexes)
    // ---------------------------------------------------------
    logger.info('[Postgres] Verifying/Creating Indexes...');

    // Users & Auth
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id)`,
      [],
      'Skipping organization_id index on users'
    );
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_users_org_status ON users(organization_id, status)`,
      [],
      'Skipping organization_id status index on users'
    );
    await query(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`);
    // Create index on project_id only if column exists
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id)`,
      [],
      'Skipping project_id index on sessions'
    );
    await query(`CREATE INDEX IF NOT EXISTS idx_revoked_tokens_user ON revoked_tokens(user_id)`);
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_verification_tokens_user ON verification_tokens(user_id)`,
      [],
      'Skipping user_id index on verification_tokens'
    );
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_verification_tokens_used ON verification_tokens(used)`,
      [],
      'Skipping used index on verification_tokens'
    );
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_mcp_providers_org ON mcp_providers(organization_id)`,
      [],
      'Skipping organization_id index on mcp_providers'
    );
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_audit_log_org ON audit_log(organization_id)`,
      [],
      'Skipping organization_id index on audit_log'
    );
    if (await columnExists('audit_log', 'user_id')) {
      await querySafe(
        `CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id)`,
        [],
        'Skipping user_id index on audit_log'
      );
    }
    if (await columnExists('audit_log', 'action_type')) {
      await querySafe(
        `CREATE INDEX IF NOT EXISTS idx_audit_log_action_type ON audit_log(action_type)`,
        [],
        'Skipping action_type index on audit_log'
      );
    }
    if (await columnExists('audit_log', 'created_at')) {
      await querySafe(
        `CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at)`,
        [],
        'Skipping created_at index on audit_log'
      );
    }
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_audits_org ON audits(organization_id)`,
      [],
      'Skipping organization_id index on audits'
    );
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_audits_status ON audits(status)`,
      [],
      'Skipping status index on audits'
    );
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_status_reports_org_created ON status_reports(organization_id, created_at)`,
      [],
      'Skipping (organization_id, created_at) index on status_reports'
    );
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_status_reports_project ON status_reports(project_id)`,
      [],
      'Skipping project_id index on status_reports'
    );
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_projects_org_updated ON projects(organization_id, updated_at)`,
      [],
      'Skipping (organization_id, updated_at) index on projects'
    );
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(organization_id)`,
      [],
      'Skipping organization_id index on api_keys'
    );
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)`,
      [],
      'Skipping key_hash index on api_keys'
    );
    if (await columnExists('api_keys', 'status')) {
      await querySafe(
        `CREATE INDEX IF NOT EXISTS idx_api_keys_status_expires ON api_keys(status, expires_at)`,
        [],
        'Skipping (status, expires_at) index on api_keys'
      );
    }
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at)`,
      [],
      'Skipping created_at index on error_logs'
    );

    // Teams & Access
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_teams_org ON teams(organization_id)`,
      [],
      'Skipping organization_id index on teams'
    );
    await query(`CREATE INDEX IF NOT EXISTS idx_teams_lead ON teams(lead_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_invitations_inviter ON invitations(invited_by)`);
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_access_requests_org ON access_requests(organization_id)`,
      [],
      'Skipping organization_id index on access_requests'
    );
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_access_requests_reviewer ON access_requests(reviewed_by)`,
      [],
      'Skipping reviewed_by index on access_requests'
    );
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_access_codes_org ON access_codes(organization_id)`,
      [],
      'Skipping organization_id index on access_codes'
    );
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_access_codes_creator ON access_codes(created_by)`,
      [],
      'Skipping created_by index on access_codes'
    );
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_access_code_usage_code ON access_code_usage(code_id)`,
      [],
      'Skipping code_id index on access_code_usage'
    );
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_access_code_usage_user ON access_code_usage(user_id)`,
      [],
      'Skipping user_id index on access_code_usage'
    );

    // Tasks Management
    // Create indexes on organization_id only if column exists
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_tasks_org ON tasks(organization_id)`,
      [],
      'Skipping organization_id index on tasks'
    );
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_tasks_org_status ON tasks(organization_id, status)`,
      [],
      'Skipping organization_id status index on tasks'
    );
    // Create indexes on project_id only if column exists
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id)`,
      [],
      'Skipping project_id index on tasks'
    );
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks(project_id, status)`,
      [],
      'Skipping project_id status index on tasks'
    );
    await query(`CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id)`);
    await query(
      `CREATE INDEX IF NOT EXISTS idx_tasks_assignee_status ON tasks(assignee_id, status)`
    );
    await query(`CREATE INDEX IF NOT EXISTS idx_tasks_reporter ON tasks(reporter_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_tasks_custom_status ON tasks(custom_status_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_tasks_initiative ON tasks(initiative_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_task_comments_user ON task_comments(user_id)`);

    // System Activities & Logs
    await query(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)`);
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_activity_logs_org ON activity_logs(organization_id)`,
      [],
      'Skipping organization_id index on activity_logs'
    );
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_activity_logs_org_time ON activity_logs(organization_id, created_at DESC)`,
      [],
      'Skipping organization_id time index on activity_logs'
    );
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id)`,
      [],
      'Skipping user_id index on activity_logs'
    );
    await query(
      `CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read, created_at DESC)`
    );
    await query(`CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id)`);

    // AI & Customizations
    // Only create index if organization_id column exists
    if (await columnExists('ai_feedback', 'organization_id')) {
      await querySafe(
        `CREATE INDEX IF NOT EXISTS idx_ai_feedback_org ON ai_feedback(organization_id)`,
        [],
        'Skipping organization_id index on ai_feedback'
      );
    }
    await query(`CREATE INDEX IF NOT EXISTS idx_ai_feedback_user ON ai_feedback(user_id)`);
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_custom_prompts_org ON custom_prompts(organization_id)`,
      [],
      'Skipping organization_id index on custom_prompts'
    );
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_custom_prompts_creator ON custom_prompts(created_by)`,
      [],
      'Skipping created_by index on custom_prompts'
    );
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_webhooks_org ON webhooks(organization_id)`,
      [],
      'Skipping organization_id index on webhooks'
    );
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_webhooks_creator ON webhooks(created_by)`,
      [],
      'Skipping created_by index on webhooks'
    );

    // Core Modules
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_initiatives_org ON initiatives(organization_id)`,
      [],
      'Skipping organization_id index on initiatives'
    );
    // Check which column exists: document_id (newer schema) or doc_id (older schema)
    if (await columnExists('knowledge_chunks', 'document_id')) {
      await querySafe(
        `CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc ON knowledge_chunks(document_id)`,
        [],
        'Skipping document_id index on knowledge_chunks'
      );
    } else if (await columnExists('knowledge_chunks', 'doc_id')) {
      await querySafe(
        `CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc ON knowledge_chunks(doc_id)`,
        [],
        'Skipping doc_id index on knowledge_chunks'
      );
    }
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_usage_records_org_time ON usage_records(organization_id, recorded_at)`,
      [],
      'Skipping organization_id time index on usage_records'
    );

    // ai_partial_responses (from 000) may have response_chunk but need content/session_id for streaming
    if (await columnExists('ai_partial_responses', 'id')) {
      if (!(await columnExists('ai_partial_responses', 'session_id'))) {
        await querySafe(
          `ALTER TABLE ai_partial_responses ADD COLUMN session_id TEXT`,
          [],
          'Skipping session_id on ai_partial_responses'
        );
        await querySafe(
          `CREATE UNIQUE INDEX IF NOT EXISTS idx_partial_responses_session ON ai_partial_responses(session_id)`,
          [],
          'Skipping session index'
        );
      }
      if (!(await columnExists('ai_partial_responses', 'content'))) {
        await querySafe(
          `ALTER TABLE ai_partial_responses ADD COLUMN content TEXT DEFAULT ''`,
          [],
          'Skipping content on ai_partial_responses'
        );
      }
      if (!(await columnExists('ai_partial_responses', 'updated_at'))) {
        await querySafe(
          `ALTER TABLE ai_partial_responses ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
          [],
          'Skipping updated_at on ai_partial_responses'
        );
      }
    }

    logger.info('[Postgres] Schema Check Complete.');

    // Verify critical tables exist
    const criticalTables = [
      'organizations',
      'users',
      'sessions',
      'projects',
      'tasks',
      'teams',
      'invitations',
      'notifications',
      'settings',
    ];
    const missingTables: string[] = [];
    for (const table of criticalTables) {
      try {
        const checkResult = await getPool().query<{ count: string }>(
          `SELECT COUNT(*)::text as count FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
          [table]
        );
        const count = parseInt(checkResult.rows[0]?.count || '0', 10);
        if (count === 0) {
          logger.error(`[Postgres] CRITICAL: Table ${table} does not exist after initialization!`);
          missingTables.push(table);
        } else {
          logger.info(`[Postgres] Verified table exists: ${table}`);
        }
      } catch (err: any) {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error(`[Postgres] Error verifying table ${table}: ${error.message}`);
        missingTables.push(table);
      }
    }

    if (missingTables.length > 0) {
      throw new Error(`Critical tables missing after initialization: ${missingTables.join(', ')}`);
    }
  } catch (err: any) {
    logger.error('[Postgres] InitDb Failed:', err);
    // Log detailed error information
    if ((err as any).code) {
      logger.error('[Postgres] Error code:', (err as any).code);
    }
    if ((err as Error).message) {
      logger.error('[Postgres] Error message:', (err as Error).message);
    }
    // Re-throw to ensure initialization failure is noticed
    throw err;
  }
}

// Create database instance
const db = new PostgresDatabase();

export default db;

/**
 * withPgTransaction — MAT-006 (2026-08-02). Real, single-connection Postgres
 * transaction helper.
 *
 * WHY THIS EXISTS: `DbPromise.transaction()` (server/src/utils/DbPromise.ts)
 * issues `BEGIN` / each statement / `COMMIT` as SEPARATE `run()` calls, and
 * every `run()` goes through `executeWithLogging(getPool, ...)` ->
 * `pool.query(...)`, which checks out a DIFFERENT client from the pool on
 * EVERY call and releases it immediately after. `BEGIN` on connection A has
 * no effect on connection B's statements — that helper does not give real
 * atomicity against Postgres despite its name. This function checks out ONE
 * client for the whole transaction, so `BEGIN`/work/`COMMIT`|`ROLLBACK` all
 * run on the same session — genuine atomicity, required for MAT-006 restore
 * (spec: "Restore happens in a transaction" + fault-injection rollback proof).
 *
 * Callers write plain Postgres-native SQL with `$1, $2, ...` placeholders
 * directly (no `?` -> `$n` adaptation is applied here — that adapter lives in
 * `adaptQuery`/`replacePositionalPlaceholders` above and is tied to the
 * SQLite-compatibility surface this helper intentionally bypasses).
 */
export async function withPgTransaction<T>(
  fn: (
    query: <R = unknown>(sql: string, params?: unknown[]) => Promise<QueryResult<R>>
  ) => Promise<T>
): Promise<T> {
  const pool = getPool();
  if (initDbPromise) await initDbPromise;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(async <R = unknown>(sql: string, params: unknown[] = []) => {
      const res = await client.query(sql, sanitizeParams(params));
      return { rows: res.rows as R[], rowCount: res.rowCount ?? 0 };
    });
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      logger.error('[Postgres] withPgTransaction ROLLBACK failed:', rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
}
