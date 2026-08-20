// @ts-nocheck
/**
 * Database Initializer
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Ensures database schema is initialized and verified on startup
 * Prevents table loss by verifying schema integrity
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { databaseConfig } from '../config/DatabaseConfig.js';
import logger from '../utils/Logger.js';
import { compareMigrationFilenames } from '../services/tablePlatform/migrationRunner.js';
import { MIGRATION_PATTERN } from '../services/tablePlatform/migrationIdentity.js';
import { getDatabase, getDatabaseAsync } from './Database.js';

const __filename_esm = fileURLToPath(import.meta.url);
const __dirname_esm = path.dirname(__filename_esm);

const resolveTestSchemaPath = async () => {
  const path = await import('path');
  const cwdPath = path.resolve(process.cwd(), 'tests/utils/testSchema.js');
  const repoPath = path.resolve(process.cwd(), '..', 'tests/utils/testSchema.js');
  if (fs.existsSync(cwdPath)) return cwdPath;
  if (fs.existsSync(repoPath)) return repoPath;
  return cwdPath;
};

// ==========================================
// SCHEMA VERIFICATION
// ==========================================

/**
 * Critical tables that must exist for the application to function
 */
const CRITICAL_TABLES = [
  'organizations',
  'organization_profiles',
  'organization_settings',
  'users',
  'login_history',
  // Settings > Preferences uses this table directly.
  'user_preferences',
  // GDPR & compliance (public deploy must not 5xx).
  'user_gdpr_consents',
  'user_data_retention',
  'data_export_requests',
  'account_deletion_requests',
  'security_policies',
  'compliance_settings',
  // Integrations & enterprise endpoints mounted in prod.
  'connectors',
  'webhook_events',
  'webhook_subscriptions',
  'sso_configs',
  'groups',
  // Security admin UI relies on these being present (do not rely on DbPromise fallbacks in runtime).
  'security_settings',
  // Permissions middleware relies on this for org-user overrides.
  // Missing table causes noisy SQLITE_ERROR logs and can mask permission issues.
  'org_user_permissions',
  // User account/settings modules (Settings > Profile, Availability, Security).
  'user_contact',
  'user_availability',
  'trusted_devices',
  'user_settings_history',
  'user_settings_templates',
  // Settings > Notifications automation rules.
  'notification_rules',
  // Interview (/discovery) module tables (avoid 500s on public deploy).
  'interview_sessions',
  'interview_questions',
  'interview_question_templates',
  'interview_library_templates',
  'interview_library_template_questions',
  'interview_assignments',
  'interview_assignment_members',
  // Report Builder (Reports Builder UI + public report share links)
  'report_builder_reports',
  'report_builder_sections',
  'report_builder_block_types',
  'report_builder_templates',
  'report_builder_sessions',
  'report_builder_activity',
  'report_builder_versions',
  'report_builder_comments',
  'report_builder_comment_activity',
  'report_exports',
  'report_public_links',
  // Brand Voice governance (Report Builder V3 Phase 5)
  'organization_brand_voice_profiles',
  // Scheduled reports (/api/scheduled-reports/*) must not 5xx on deploy.
  'report_schedules',
  'schedule_executions',
  'user_sessions',
  'user_2fa',
  'api_logs',
  'api_keys',
  'error_logs',
  'system_health_history',
  'sessions',
  'projects',
  'tasks',
  'teams',
  'invitations',
  'notifications',
  'notification_settings',
  'settings',
  'revoked_tokens',
  'refresh_tokens',
  'superadmin_ai_settings',
  'organization_ai_settings',
  'user_ai_settings',
  'ai_policies',
  'initiatives',
  // Report Builder sources + assessment hub use this table (legacy schemas may omit columns).
  'assessments',
  'maturity_assessments',
  'subscription_plans',
  'organization_billing',
  'usage_records',
  'usage_summaries',
  'invoices',
  'plan_features',
  'spending_alerts',
  'stripe_events',
  'payment_attempts',
  'dunning_states',
  'subscription_state_history',
  'checkout_sessions',
  'proration_records',
  'billing_usage_events',
  'billing_credits',
  'billing_email_queue',
  'billing_notification_preferences',
  'billing_disputes',
  'billing_refunds',
  'token_ledger',
  'payment_methods',
  'organization_seats',
  'organization_limits',
  'ai_project_memory',
  'ai_organization_memory',
  'usage_counters',
  'ai_partial_responses',
  'ai_audit_logs',
  'ai_system_prompts',
  'ai_knowledge_embeddings',
  'ai_feature_control',
  'ai_conversations',
  'ai_cost_tracking',
  'circuit_breaker_state',
  'admin_audit_logs',
  'admin_sessions',
  'permissions',
  'admin_approval_workflows',
  'admin_approval_requests',
  'admin_dashboards',
  'admin_saved_reports',
  'admin_report_executions',
  'access_requests',
  'system_feedback',
  'custom_statuses',
  'task_comments',
  'activity_logs',
  'custom_prompts',
  'webhooks',
  'ai_logs',
  'ai_ideas',
  'ai_observations',
  'megatrends',
  'custom_trends',
  'maturity_scores',
  'client_context',
  'knowledge_docs',
  'knowledge_chunks',
  'webhook_deliveries',
  'integrations',
  'integration_sync_logs',
  'system_metrics',
  'security_events',
  'security_incidents',
  'compliance_records',
  'backup_records',
  'access_codes',
  'access_code_usage',
  'reports',
  'report_blocks',
  'report_snapshots',
  'multi_framework_assessments',
  'rapid_lean_assessments',
  'help_events',
  'organization_events',
  'task_dependencies',
  'ai_user_memory',
  'ai_experiments',
  'ai_experiment_variants',
  'system_config',
  'user_api_keys',
  'imported_reports',
];

// Periodic health checks should only page/alarm on truly foundational schema
// loss. Many entries in CRITICAL_TABLES are module-specific and should remain
// audit warnings, not "system critical" incidents.
const TRULY_CRITICAL_TABLES = ['organizations', 'users', 'sessions', 'projects', 'tasks'];

const getMissingTrulyCriticalTables = (missing: string[]): string[] =>
  missing.filter((table) => TRULY_CRITICAL_TABLES.includes(table));

/**
 * Critical columns that must exist in specific tables
 */
const REQUIRED_COLUMNS: Record<string, string[]> = {
  projects: [
    'current_phase',
    'organization_id',
    'owner_id',
    'status',
    'name',
    // Queried by ProjectController in some views; missing columns generate noisy SQLITE_ERROR logs.
    'health',
    'progress_pct',
    'updated_at',
  ],
  users: [
    'organization_id',
    'role',
    'status',
    'email',
    'is_active',
    'last_login_at',
    'extended_preferences',
  ],
  assessments: [
    'organization_id',
    'name',
    'status',
    // Report Builder source adapter expects workflow-v2 style columns.
    'assessment_type',
    'answers_json',
    'score_summary',
    'context_snapshot',
    'completion_percent',
    'approved_at',
    'created_by',
  ],
  organizations: [
    'plan',
    'status',
    'name',
    'logo_url',
    'branding_primary_color',
    'branding_accent_color',
    'default_timezone',
    'default_language',
    'updated_at',
  ],
  report_builder_reports: [
    'report_type_v3',
    'period_from',
    'period_to',
    'communication_register',
    'density',
    'form',
    'data_level',
    'confidentiality',
    'theme_id',
    'context_pack_snapshot',
    'goal_v3',
    'source_refs_json',
  ],
  report_builder_sections: [
    'rag',
    'summary',
    'source_refs_json',
    'is_refreshable',
    'last_data_timestamp',
  ],
  report_builder_block_types: [
    // Used by ReportBuilderService.listBlockTypes() ordering + UI metadata.
    'display_order',
    'category',
    'slide_intent',
    'pptx_prompt_template',
    'pptx_output_schema',
  ],
  report_schedules: [
    'organization_id',
    'schedule_name',
    'cron_expression',
    'timezone',
    'next_run_at',
    'last_run_at',
    'run_count',
    'is_active',
    'config_json',
    'created_by',
    'created_at',
    'updated_at',
  ],
  schedule_executions: [
    'schedule_id',
    'status',
    'started_at',
    'completed_at',
    'generated_report_id',
    'error',
    'delivery_results_json',
    'created_at',
  ],
  organization_profiles: [
    'id',
    'organization_id',
    'industry',
    'company_size',
    'preferred_language',
    'created_by',
    'updated_by',
    'created_at',
    'updated_at',
  ],
  organization_settings: ['organization_id', 'setting_key', 'setting_value', 'updated_at'],
  tasks: [
    'project_id',
    'organization_id',
    'title',
    'description',
    'status',
    'priority',
    'assignee_id',
    'backup_assignee_id',
    'reporter_id',
    'created_by',
    'due_date',
    'started_at',
    'estimated_hours',
    'tags',
    'task_type',
    'initiative_id',
    'why',
    'source',
    'owner_id',
    'requires_acceptance',
    'acceptance_type',
    'acceptor_id',
    'weight',
    'weight_reason',
    'expected_outcome',
    'decision_impact',
    'evidence_required',
    'strategic_contribution',
    'roadmap_initiative_id',
    'kpi_id',
    'raid_item_id',
    'assignees',
    'progress',
    'blocked_reason',
    'blocked_by_decision_id',
    'blocked_at',
    // Used by My Work stats + personal task completion bookkeeping.
    'completed_at',
    'created_at',
    'updated_at',
  ],
  task_dependencies: [
    'from_task_id',
    'to_task_id',
    'dependency_type',
    'lag_days',
    'notes',
    'created_by',
    'created_at',
  ],
  // Billing UI relies on stable ordering and toggles.
  subscription_plans: [
    'name',
    'price_monthly',
    'price_yearly',
    'currency',
    'features',
    'limits',
    'trial_days',
    'is_public',
    'is_active',
    'sort_order',
    'created_at',
    'updated_at',
  ],
  spending_alerts: [
    'organization_id',
    'type',
    'threshold',
    'threshold_type',
    'action',
    'notify_emails',
    'is_active',
    'created_at',
    'updated_at',
  ],
  // Billing usage endpoints group by `metric_name` and sum `quantity`.
  // Older SQLite baselines used `type` + `amount` — add the new columns for compatibility.
  usage_records: ['organization_id', 'metric_name', 'quantity', 'recorded_at', 'metadata'],
  org_user_permissions: [
    'user_id',
    'organization_id',
    'permission_key',
    'grant_type',
    'granted_by',
    'created_at',
  ],
  interview_sessions: ['organization_id', 'project_id', 'template_id', 'status', 'created_at'],
  interview_library_templates: ['name', 'status', 'visibility', 'is_default', 'created_at'],
  user_contact: [
    'user_id',
    'phone',
    'address',
    'city',
    'country',
    'postal_code',
    'linkedin',
    'website',
    'updated_at',
  ],
  user_availability: ['user_id', 'settings', 'updated_at'],
  trusted_devices: ['id', 'user_id', 'device_name', 'device_fingerprint', 'trusted_at'],
  user_settings_history: ['id', 'user_id', 'setting_key', 'old_value', 'new_value', 'changed_at'],
  user_settings_templates: [
    'id',
    'user_id',
    'name',
    'settings',
    'is_default',
    'is_global',
    'created_at',
  ],
  user_gdpr_consents: [
    'user_id',
    'analytics',
    'personalization',
    'marketing',
    'third_party_sharing',
    'ai_training',
    'updated_at',
  ],
  user_data_retention: ['user_id', 'retention_period', 'auto_delete', 'updated_at'],
  data_export_requests: ['id', 'user_id', 'status', 'requested_at', 'expires_at', 'download_url'],
  account_deletion_requests: [
    'id',
    'user_id',
    'status',
    'requested_at',
    'scheduled_for',
    'completed_at',
  ],
  security_policies: [
    'id',
    'organization_id',
    'name',
    'category',
    'settings_json',
    'enabled',
    'last_updated',
  ],
  compliance_settings: [
    'id',
    'organization_id',
    'setting_type',
    'settings_data',
    'enabled',
    'created_at',
    'updated_at',
    'updated_by',
  ],
  connectors: [
    'id',
    'organization_id',
    'name',
    'type',
    'provider',
    'status',
    'config',
    'last_synced_at',
    'created_at',
  ],
  webhook_events: ['id', 'provider', 'event_type', 'payload', 'processed', 'created_at'],
  webhook_subscriptions: [
    'id',
    'organization_id',
    'name',
    'url',
    'events',
    'is_active',
    'secret_hash',
    'created_at',
  ],
  sso_configs: ['domain', 'provider', 'entity_id', 'sso_url', 'certificate', 'is_active'],
  groups: ['id', 'name', 'created_at'],
  user_preferences: ['user_id', 'key', 'value', 'updated_at'],
  notification_rules: [
    'id',
    'organization_id',
    'name',
    'description',
    'event_type',
    'conditions',
    'actions',
    'is_active',
    'priority',
    'created_by',
    'created_at',
    'updated_at',
  ],
  // Security admin endpoints query by org + order by created time.
  // Missing columns here causes noisy SQLITE_ERROR logs and can silently downgrade
  // functionality via DbPromise fallback behaviour.
  login_history: ['organization_id'],
  user_sessions: [
    'user_id',
    'device_info',
    'ip_address',
    'user_agent',
    'location',
    'created_at',
    'last_active_at',
    'expires_at',
    'is_current',
  ],
  // Initiative detail views (N-mode) rely on these columns for autosave + persistence.
  // We auto-repair missing columns in SQLite dev DBs so the app behaves "online-first".
  // Dependencies API uses created_by/updated_by in SELECT/INSERT.
  initiatives: [
    'created_by',
    'updated_by',
    'title',
    'summary',
    'hypothesis', // UI alias: description
    'priority',
    'planned_start_date',
    'planned_end_date',
    'owner_execution_id',
    'sponsor_id',
    'market_context',
    'problem_statement',
    'deliverables',
    'success_criteria',
    'scope_in',
    'scope_out',
    'kill_criteria',
    'key_risks',
    'estimated_budget',
    'resource_tools',
    'tags',
    'target_state',
    // Needed by report import → initiative creation flow
    'source_type',
    'source_id',
    'source_report_id',
    'source_assessment_id',
    'created_from',
  ],
  // Used by audit/activity logging across the app (including AI chat).
  // Older dev SQLite DBs were created from legacy baselines where `activity_logs` had fewer columns.
  // Missing columns cause noisy SQLITE_ERROR warnings and can cascade into 500s depending on call path.
  // We auto-repair by adding TEXT columns on startup (SQLite branch below).
  activity_logs: [
    'entity_name',
    'old_value',
    'new_value',
    'ip_address',
    'user_agent',
    'correlation_id',
  ],
  user_api_keys: [
    'scopes',
    'expires_at',
    'rate_limit_per_minute',
    'rate_limit_per_day',
    'quota_used',
  ],
  // Used in project dashboards for counts; older SQLite baselines lacked this column.
  multi_framework_assessments: ['project_id'],
  security_events: ['user_id', 'type', 'title', 'description', 'ip_address', 'created_at'],
  webhook_deliveries: [
    'id',
    'webhook_id',
    'subscription_id',
    'event',
    'event_type',
    'payload',
    'status',
    'attempts',
    'response_code',
    'status_code',
    'response_time_ms',
    'response_body',
    'delivered_at',
    'created_at',
  ],
};

/**
 * Verify that critical tables and columns exist
 */
async function verifySchema(): Promise<{
  valid: boolean;
  missing: string[];
  errors: string[];
  missingColumns: Record<string, string[]>;
}> {
  const missing: string[] = [];
  const errors: string[] = [];
  const missingColumns: Record<string, string[]> = {};

  try {
    const db = await getDatabaseAsync();
    const dbType = databaseConfig.type;

    if (dbType === 'postgres') {
      // PostgreSQL: Check information_schema
      for (const table of CRITICAL_TABLES) {
        try {
          const result = await db.query<{ count: string }>(
            `SELECT COUNT(*)::text as count FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
            [table]
          );
          const count = parseInt(result.rows[0]?.count || '0', 10);
          if (count === 0) {
            missing.push(table);
          } else if (REQUIRED_COLUMNS[table]) {
            // Check columns for Postgres
            for (const column of REQUIRED_COLUMNS[table]) {
              const colResult = await db.query<{ count: string }>(
                `SELECT COUNT(*)::text as count FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
                [table, column]
              );
              if (parseInt(colResult.rows[0]?.count || '0', 10) === 0) {
                if (!missingColumns[table]) missingColumns[table] = [];
                missingColumns[table].push(column);
              }
            }
          }
        } catch (err: any) {
          const error = err instanceof Error ? err : new Error(String(err));
          errors.push(`Error checking table ${table}: ${error.message}`);
        }
      }
    } else {
      // SQLite: Check sqlite_master
      for (const table of CRITICAL_TABLES) {
        try {
          const result = await db.query<{ count: number }>(
            `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name=?`,
            [table]
          );
          const count =
            typeof result.rows[0]?.count === 'number'
              ? result.rows[0].count
              : parseInt(String(result.rows[0]?.count || '0'), 10);
          if (count === 0) {
            missing.push(table);
          } else if (REQUIRED_COLUMNS[table]) {
            // Check columns for SQLite
            const columnsInfo = await new Promise<any[]>((resolve, reject) => {
              db.all(`PRAGMA table_info(${table})`, (err: Error | null, rows: any[]) => {
                if (err) reject(err);
                else resolve(rows);
              });
            });

            const existingColumns = columnsInfo.map((c) => c.name);
            for (const column of REQUIRED_COLUMNS[table]) {
              if (!existingColumns.includes(column)) {
                if (!missingColumns[table]) missingColumns[table] = [];
                missingColumns[table].push(column);
              }
            }
          }
        } catch (err: any) {
          const error = err instanceof Error ? err : new Error(String(err));
          errors.push(`Error checking table ${table}: ${error.message}`);
        }
      }
    }

    return {
      valid:
        missing.length === 0 && errors.length === 0 && Object.keys(missingColumns).length === 0,
      missing,
      errors,
      missingColumns,
    };
  } catch (err: any) {
    const error = err instanceof Error ? err : new Error(String(err));
    return {
      valid: false,
      missing: [],
      errors: [`Schema verification failed: ${error.message}`],
      missingColumns: {},
    };
  }
}

// ==========================================
// TARGETED SELF-HEAL (PROJECT TEAM TABLES)
// ==========================================

async function ensureProjectMembershipTables(): Promise<void> {
  const db = await getDatabaseAsync();
  const dbType = databaseConfig.type;

  // Keep this minimal and safe: only create/repair the few tables required by
  // `/api/projects/:id/members` (ProjectController.*ProjectMember).

  if (dbType === 'postgres') {
    // Workstreams (required FK target for project_members.workstream_id)
    await db.query(`
      CREATE TABLE IF NOT EXISTS workstreams (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        color TEXT DEFAULT '#3B82F6',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_workstreams_project ON workstreams(project_id)`);

    // Canonical project membership (used by initiatives Team section)
    await db.query(`
      CREATE TABLE IF NOT EXISTS project_members (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        project_role TEXT NOT NULL DEFAULT 'TASK_ASSIGNEE',
        workstream_id TEXT REFERENCES workstreams(id) ON DELETE SET NULL,
        allocation_percent INTEGER NOT NULL DEFAULT 100,
        permissions TEXT DEFAULT '{}',
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        added_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        -- Optional consultant overlay (best-effort; UI tolerates nulls)
        is_invoked INTEGER DEFAULT 0,
        consultant_profile TEXT DEFAULT 'NONE',
        engagement_type TEXT DEFAULT 'INTERNAL',
        acting_org_id TEXT,
        role_template_id TEXT,
        normalized_project_role TEXT,
        legacy_project_role TEXT,
        UNIQUE(project_id, user_id)
      )
    `);
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id)`
    );
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id)`
    );
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_project_members_role ON project_members(project_role)`
    );
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_project_members_workstream ON project_members(workstream_id)`
    );
    await db.query(`ALTER TABLE project_members ADD COLUMN IF NOT EXISTS role_template_id TEXT`);
    await db.query(
      `ALTER TABLE project_members ADD COLUMN IF NOT EXISTS normalized_project_role TEXT`
    );
    await db.query(`ALTER TABLE project_members ADD COLUMN IF NOT EXISTS legacy_project_role TEXT`);
    await db.query(`
      CREATE TABLE IF NOT EXISTS project_role_templates (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        role_key TEXT NOT NULL,
        label TEXT NOT NULL,
        description TEXT,
        is_factory INTEGER DEFAULT 0,
        is_required INTEGER DEFAULT 0,
        is_enabled INTEGER DEFAULT 1,
        capabilities_json TEXT DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(organization_id, role_key)
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS project_role_overrides (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        role_key TEXT NOT NULL,
        capabilities_json TEXT DEFAULT '[]',
        is_enabled INTEGER DEFAULT 1,
        fallback_role_key TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(project_id, role_key)
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS role_change_audit_events (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        project_id TEXT,
        actor_id TEXT,
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT,
        before_json TEXT,
        after_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    return;
  }

  // SQLite branch
  // Create tables if missing.
  await new Promise<void>((resolve, reject) => {
    db.run(
      `CREATE TABLE IF NOT EXISTS workstreams (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        color TEXT DEFAULT '#3B82F6',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });

  await new Promise<void>((resolve, reject) => {
    db.run(
      `CREATE TABLE IF NOT EXISTS project_members (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        project_role TEXT NOT NULL DEFAULT 'TASK_ASSIGNEE',
        workstream_id TEXT REFERENCES workstreams(id) ON DELETE SET NULL,
        allocation_percent INTEGER NOT NULL DEFAULT 100,
        permissions TEXT DEFAULT '{}',
        start_date TEXT,
        end_date TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        added_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        -- Optional consultant overlay (best-effort; UI tolerates nulls)
        is_invoked INTEGER DEFAULT 0,
        consultant_profile TEXT DEFAULT 'NONE',
        engagement_type TEXT DEFAULT 'INTERNAL',
        acting_org_id TEXT,
        role_template_id TEXT,
        normalized_project_role TEXT,
        legacy_project_role TEXT,
        UNIQUE(project_id, user_id)
      )`,
      (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });

  // Repair missing columns on older SQLite DBs.
  const columnsInfo = await new Promise<any[]>((resolve, reject) => {
    db.all(`PRAGMA table_info(project_members)`, (err: Error | null, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
  const existingColumns = new Set(columnsInfo.map((c) => c.name));

  const addColumn = async (ddl: string) => {
    await new Promise<void>((resolve) => {
      db.run(`ALTER TABLE project_members ADD COLUMN ${ddl}`, (err: Error | null) => {
        // SQLite doesn't support IF NOT EXISTS for columns; ignore duplicates.
        if (
          err &&
          !String(err.message || '')
            .toLowerCase()
            .includes('duplicate column')
        ) {
          logger.warn(
            '[DatabaseInitializer] Failed to add column to project_members:',
            err.message
          );
        }
        resolve();
      });
    });
  };

  if (!existingColumns.has('project_role'))
    await addColumn(`project_role TEXT DEFAULT 'TASK_ASSIGNEE'`);
  if (!existingColumns.has('allocation_percent'))
    await addColumn(`allocation_percent INTEGER DEFAULT 100`);
  if (!existingColumns.has('permissions')) await addColumn(`permissions TEXT DEFAULT '{}'`);
  if (!existingColumns.has('added_by_id')) await addColumn(`added_by_id TEXT`);
  if (!existingColumns.has('created_at'))
    await addColumn(`created_at TEXT DEFAULT (datetime('now'))`);
  if (!existingColumns.has('updated_at'))
    await addColumn(`updated_at TEXT DEFAULT (datetime('now'))`);
  if (!existingColumns.has('workstream_id')) await addColumn(`workstream_id TEXT`);
  if (!existingColumns.has('is_invoked')) await addColumn(`is_invoked INTEGER DEFAULT 0`);
  if (!existingColumns.has('consultant_profile'))
    await addColumn(`consultant_profile TEXT DEFAULT 'NONE'`);
  if (!existingColumns.has('engagement_type'))
    await addColumn(`engagement_type TEXT DEFAULT 'INTERNAL'`);
  if (!existingColumns.has('acting_org_id')) await addColumn(`acting_org_id TEXT`);
  if (!existingColumns.has('role_template_id')) await addColumn(`role_template_id TEXT`);
  if (!existingColumns.has('normalized_project_role'))
    await addColumn(`normalized_project_role TEXT`);
  if (!existingColumns.has('legacy_project_role')) await addColumn(`legacy_project_role TEXT`);

  await new Promise<void>((resolve, reject) => {
    db.run(
      `CREATE TABLE IF NOT EXISTS project_role_templates (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        role_key TEXT NOT NULL,
        label TEXT NOT NULL,
        description TEXT,
        is_factory INTEGER DEFAULT 0,
        is_required INTEGER DEFAULT 0,
        is_enabled INTEGER DEFAULT 1,
        capabilities_json TEXT DEFAULT '[]',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(organization_id, role_key)
      )`,
      (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });

  await new Promise<void>((resolve, reject) => {
    db.run(
      `CREATE TABLE IF NOT EXISTS project_role_overrides (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        role_key TEXT NOT NULL,
        capabilities_json TEXT DEFAULT '[]',
        is_enabled INTEGER DEFAULT 1,
        fallback_role_key TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(project_id, role_key)
      )`,
      (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });

  await new Promise<void>((resolve, reject) => {
    db.run(
      `CREATE TABLE IF NOT EXISTS role_change_audit_events (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        project_id TEXT,
        actor_id TEXT,
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT,
        before_json TEXT,
        after_json TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

// ==========================================
// TARGETED SELF-HEAL (CHAT CONVERSATIONS)
// ==========================================

async function ensureChatConversationTables(): Promise<void> {
  const db = await getDatabaseAsync();
  const dbType = databaseConfig.type;

  // Conversations + messages are required for AI Chat runtime smoke + history sidebar.
  // Older SQLite dev DBs (and TEST_SCHEMA) may have partial/legacy versions of these tables.

  if (dbType === 'postgres') {
    // Conversations
    await db.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        organization_id TEXT,
        project_id TEXT,
        chat_project_id TEXT,
        created_by TEXT,
        title TEXT,
        title_source TEXT,
        pmo_context TEXT DEFAULT '{}',
        language TEXT DEFAULT 'en',
        starred BOOLEAN DEFAULT FALSE,
        archived BOOLEAN DEFAULT FALSE,
        tags TEXT DEFAULT '[]',
        message_count INTEGER DEFAULT 0,
        last_message_preview TEXT,
        last_message_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Messages
    await db.query(`
      CREATE TABLE IF NOT EXISTS conversation_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        message_type TEXT DEFAULT 'text',
        metadata TEXT DEFAULT '{}',
        token_count INTEGER,
        model_used TEXT,
        author_user_id TEXT,
        version INTEGER DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation ON conversation_messages(conversation_id)`
    );
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_conversation_messages_created ON conversation_messages(created_at)`
    );
    return;
  }

  // SQLite branch
  await new Promise<void>((resolve, reject) => {
    db.run(
      `CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        organization_id TEXT,
        project_id TEXT,
        chat_project_id TEXT,
        created_by TEXT,
        title TEXT,
        title_source TEXT,
        pmo_context TEXT DEFAULT '{}',
        language TEXT DEFAULT 'en',
        starred INTEGER DEFAULT 0,
        archived INTEGER DEFAULT 0,
        tags TEXT DEFAULT '[]',
        message_count INTEGER DEFAULT 0,
        last_message_preview TEXT,
        last_message_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      (err: Error | null) => (err ? reject(err) : resolve())
    );
  });

  await new Promise<void>((resolve, reject) => {
    db.run(
      `CREATE TABLE IF NOT EXISTS conversation_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        message_type TEXT DEFAULT 'text',
        metadata TEXT DEFAULT '{}',
        token_count INTEGER,
        model_used TEXT,
        author_user_id TEXT,
        version INTEGER DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      )`,
      (err: Error | null) => (err ? reject(err) : resolve())
    );
  });

  // Some conversation queries join chat_projects for team-scoped conversations.
  // Ensure chat_projects exists in SQLite test/e2e DBs to avoid 500s / noisy logs.
  await new Promise<void>((resolve) => {
    db.run(
      `CREATE TABLE IF NOT EXISTS chat_projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT '',
        organization_id TEXT,
        name TEXT NOT NULL DEFAULT 'Untitled',
        description TEXT,
        color TEXT DEFAULT '#6366f1',
        icon TEXT DEFAULT 'folder',
        scope TEXT DEFAULT 'personal',
        conversation_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      () => resolve()
    );
  });

  // Repair missing columns on older SQLite DBs (incl. TEST_SCHEMA legacy tables).
  const tableColumns = async (table: string): Promise<Set<string>> => {
    const rows = await new Promise<any[]>((resolve, reject) => {
      db.all(`PRAGMA table_info(${table})`, (err: Error | null, out: any[]) => {
        if (err) reject(err);
        else resolve(out || []);
      });
    });
    return new Set(rows.map((r) => r.name));
  };

  const addColumn = async (table: string, ddl: string) => {
    await new Promise<void>((resolve) => {
      db.run(`ALTER TABLE ${table} ADD COLUMN ${ddl}`, (err: Error | null) => {
        if (
          err &&
          !String(err.message || '')
            .toLowerCase()
            .includes('duplicate column')
        ) {
          logger.warn(`[DatabaseInitializer] Failed to add column to ${table}:`, err.message);
        }
        resolve();
      });
    });
  };

  const convCols = await tableColumns('conversations');
  if (!convCols.has('project_id')) await addColumn('conversations', `project_id TEXT`);
  if (!convCols.has('chat_project_id')) await addColumn('conversations', `chat_project_id TEXT`);
  if (!convCols.has('created_by')) await addColumn('conversations', `created_by TEXT`);
  if (!convCols.has('title_source')) await addColumn('conversations', `title_source TEXT`);
  if (!convCols.has('pmo_context'))
    await addColumn('conversations', `pmo_context TEXT DEFAULT '{}'`);
  if (!convCols.has('language')) await addColumn('conversations', `language TEXT DEFAULT 'en'`);
  if (!convCols.has('starred')) await addColumn('conversations', `starred INTEGER DEFAULT 0`);
  if (!convCols.has('archived')) await addColumn('conversations', `archived INTEGER DEFAULT 0`);
  if (!convCols.has('tags')) await addColumn('conversations', `tags TEXT DEFAULT '[]'`);
  if (!convCols.has('message_count'))
    await addColumn('conversations', `message_count INTEGER DEFAULT 0`);
  if (!convCols.has('last_message_preview'))
    await addColumn('conversations', `last_message_preview TEXT`);
  if (!convCols.has('last_message_at')) await addColumn('conversations', `last_message_at TEXT`);

  const msgCols = await tableColumns('conversation_messages');
  if (!msgCols.has('message_type'))
    await addColumn('conversation_messages', `message_type TEXT DEFAULT 'text'`);
  if (!msgCols.has('token_count')) await addColumn('conversation_messages', `token_count INTEGER`);
  if (!msgCols.has('model_used')) await addColumn('conversation_messages', `model_used TEXT`);
  if (!msgCols.has('author_user_id'))
    await addColumn('conversation_messages', `author_user_id TEXT`);
  if (!msgCols.has('version'))
    await addColumn('conversation_messages', `version INTEGER DEFAULT 1`);

  const chatProjectCols = await tableColumns('chat_projects');
  if (!chatProjectCols.has('user_id'))
    await addColumn('chat_projects', `user_id TEXT NOT NULL DEFAULT ''`);
  if (!chatProjectCols.has('name'))
    await addColumn('chat_projects', `name TEXT NOT NULL DEFAULT 'Untitled'`);
  if (!chatProjectCols.has('description')) await addColumn('chat_projects', `description TEXT`);
  if (!chatProjectCols.has('color'))
    await addColumn('chat_projects', `color TEXT DEFAULT '#6366f1'`);
  if (!chatProjectCols.has('icon')) await addColumn('chat_projects', `icon TEXT DEFAULT 'folder'`);
  if (!chatProjectCols.has('scope'))
    await addColumn('chat_projects', `scope TEXT DEFAULT 'personal'`);
  if (!chatProjectCols.has('organization_id'))
    await addColumn('chat_projects', `organization_id TEXT`);
  if (!chatProjectCols.has('conversation_count'))
    await addColumn('chat_projects', `conversation_count INTEGER DEFAULT 0`);

  // Notifications route expects `is_dismissed` on some schemas.
  try {
    const notifCols = await tableColumns('notifications');
    if (!notifCols.has('is_dismissed'))
      await addColumn('notifications', `is_dismissed INTEGER DEFAULT 0`);
    if (!notifCols.has('snoozed_until')) await addColumn('notifications', `snoozed_until TEXT`);
  } catch (e: any) {
    logger.warn('[DatabaseInitializer] Unable to self-heal notifications columns:', e?.message);
  }

  // Indices (best-effort)
  await new Promise<void>((resolve) => {
    db.run(
      `CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation ON conversation_messages(conversation_id)`,
      () => resolve()
    );
  });
  await new Promise<void>((resolve) => {
    db.run(
      `CREATE INDEX IF NOT EXISTS idx_conversation_messages_created ON conversation_messages(created_at)`,
      () => resolve()
    );
  });
}

// ==========================================
// TARGETED SELF-HEAL (V8 SYNC INTEGRATIONS)
// ==========================================

async function ensureIntegrationRuntimeTables(): Promise<void> {
  const db = await getDatabaseAsync();
  const dbType = databaseConfig.type;

  if (dbType === 'postgres') {
    await db.query(`
      CREATE TABLE IF NOT EXISTS integrations (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        connector_id TEXT,
        name TEXT,
        category TEXT,
        status TEXT DEFAULT 'pending',
        config TEXT DEFAULT '{}',
        capabilities TEXT DEFAULT '[]',
        auth_type TEXT,
        scopes TEXT DEFAULT '[]',
        field_mappings TEXT DEFAULT '[]',
        sync_settings TEXT DEFAULT '{}',
        sync_schedule TEXT,
        is_paused BOOLEAN DEFAULT FALSE,
        paused_at TIMESTAMP,
        workflow_policy TEXT DEFAULT 'active',
        workflow_policy_reason TEXT,
        workflow_policy_set_by TEXT,
        workflow_policy_set_at TIMESTAMPTZ,
        last_sync_at TIMESTAMP,
        last_error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const rows = await db.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'integrations'`
    );
    const cols = new Set(
      (rows.rows || rows || []).map((r: any) => String(r.column_name || r.column || r.name))
    );
    const add = async (name: string, ddl: string) => {
      if (!cols.has(name)) {
        await db.query(`ALTER TABLE integrations ADD COLUMN IF NOT EXISTS ${name} ${ddl}`);
        cols.add(name);
      }
    };

    await add('connector_id', 'TEXT');
    await add('name', 'TEXT');
    await add('category', 'TEXT');
    await add('status', `TEXT DEFAULT 'pending'`);
    await add('config', `TEXT DEFAULT '{}'`);
    await add('capabilities', `TEXT DEFAULT '[]'`);
    await add('auth_type', 'TEXT');
    await add('scopes', `TEXT DEFAULT '[]'`);
    await add('field_mappings', `TEXT DEFAULT '[]'`);
    await add('sync_settings', `TEXT DEFAULT '{}'`);
    await add('sync_schedule', 'TEXT');
    await add('is_paused', 'BOOLEAN DEFAULT FALSE');
    await add('paused_at', 'TIMESTAMP');
    await add('workflow_policy', `TEXT DEFAULT 'active'`);
    await add('workflow_policy_reason', 'TEXT');
    await add('workflow_policy_set_by', 'TEXT');
    await add('workflow_policy_set_at', 'TIMESTAMPTZ');
    await add('last_sync_at', 'TIMESTAMP');
    await add('last_error', 'TEXT');
    await add('created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    await add('updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');

    // Legacy integration tables used provider_id as the required identity column.
    // V8 sync owns connector_id, so old NOT NULL constraints must not block new connections.
    for (const legacyRequiredColumn of ['provider_id', 'auth_type']) {
      try {
        await db.query(
          `ALTER TABLE integrations ALTER COLUMN ${legacyRequiredColumn} DROP NOT NULL`
        );
      } catch (err: any) {
        logger.debug?.(
          `[DatabaseInitializer] integrations.${legacyRequiredColumn} DROP NOT NULL skipped: ${err?.message || err}`
        );
      }
    }

    // Backfill the V8 connector field from earlier integration schemas without referencing
    // columns that may not exist on a given staging DB.
    const coalesceExpr = (candidates: string[], fallback: string) =>
      `COALESCE(${candidates.filter((c) => cols.has(c)).join(', ') || fallback}, ${fallback})`;
    const connectorExpr = coalesceExpr(['connector_id', 'provider_id', 'provider', 'id'], 'id');
    const nameExpr = coalesceExpr(['name', 'provider_id', 'provider', 'connector_id', 'id'], 'id');
    const configExpr = cols.has('settings')
      ? `COALESCE(config, settings, '{}')`
      : `COALESCE(config, '{}')`;

    await db.query(`
      UPDATE integrations
      SET connector_id = ${connectorExpr},
          name = ${nameExpr},
          category = COALESCE(category, 'productivity'),
          status = COALESCE(status, 'pending'),
          is_paused = COALESCE(is_paused, FALSE)
      WHERE connector_id IS NULL OR name IS NULL OR category IS NULL OR config IS NULL
    `);

    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_integrations_org ON integrations(organization_id)`
    );
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_integrations_connector ON integrations(connector_id)`
    );
    return;
  }

  await new Promise<void>((resolve) => {
    db.run(
      `CREATE TABLE IF NOT EXISTS integrations (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        connector_id TEXT,
        name TEXT,
        category TEXT,
        status TEXT DEFAULT 'pending',
        config TEXT DEFAULT '{}',
        capabilities TEXT DEFAULT '[]',
        auth_type TEXT,
        scopes TEXT DEFAULT '[]',
        field_mappings TEXT DEFAULT '[]',
        sync_settings TEXT DEFAULT '{}',
        sync_schedule TEXT,
        is_paused INTEGER DEFAULT 0,
        paused_at TEXT,
        workflow_policy TEXT DEFAULT 'active',
        workflow_policy_reason TEXT,
        workflow_policy_set_by TEXT,
        workflow_policy_set_at TEXT,
        last_sync_at TEXT,
        last_error TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
      () => resolve()
    );
  });

  const rows = await new Promise<any[]>((resolve) => {
    db.all(`PRAGMA table_info(integrations)`, (_err: Error | null, out: any[]) =>
      resolve(out || [])
    );
  });
  const cols = new Set(rows.map((r) => r.name));
  const add = async (name: string, ddl: string) => {
    if (cols.has(name)) return;
    await new Promise<void>((resolve) => {
      db.run(`ALTER TABLE integrations ADD COLUMN ${name} ${ddl}`, (err: Error | null) => {
        if (err && !String(err.message || '').includes('duplicate column')) {
          logger.warn(`[DatabaseInitializer] Failed to add integrations.${name}:`, err.message);
        }
        resolve();
      });
    });
    cols.add(name);
  };

  await add('connector_id', 'TEXT');
  await add('name', 'TEXT');
  await add('category', 'TEXT');
  await add('status', `TEXT DEFAULT 'pending'`);
  await add('config', `TEXT DEFAULT '{}'`);
  await add('capabilities', `TEXT DEFAULT '[]'`);
  await add('auth_type', 'TEXT');
  await add('scopes', `TEXT DEFAULT '[]'`);
  await add('field_mappings', `TEXT DEFAULT '[]'`);
  await add('sync_settings', `TEXT DEFAULT '{}'`);
  await add('sync_schedule', 'TEXT');
  await add('is_paused', 'INTEGER DEFAULT 0');
  await add('paused_at', 'TEXT');
  await add('workflow_policy', `TEXT DEFAULT 'active'`);
  await add('workflow_policy_reason', 'TEXT');
  await add('workflow_policy_set_by', 'TEXT');
  await add('workflow_policy_set_at', 'TEXT');
  await add('last_sync_at', 'TEXT');
  await add('last_error', 'TEXT');
  await add('created_at', `TEXT DEFAULT (datetime('now'))`);
  await add('updated_at', `TEXT DEFAULT (datetime('now'))`);

  const sqliteCoalesceExpr = (candidates: string[], fallback: string) =>
    `COALESCE(${candidates.filter((c) => cols.has(c)).join(', ') || fallback}, ${fallback})`;
  const sqliteConnectorExpr = sqliteCoalesceExpr(['connector_id', 'provider', 'id'], 'id');
  const sqliteNameExpr = sqliteCoalesceExpr(['name', 'provider', 'connector_id', 'id'], 'id');

  await new Promise<void>((resolve) => {
    db.run(
      `UPDATE integrations
       SET connector_id = ${sqliteConnectorExpr},
           name = ${sqliteNameExpr},
           category = COALESCE(category, 'productivity'),
           config = COALESCE(config, '{}'),
           capabilities = COALESCE(capabilities, scopes, '[]'),
           field_mappings = COALESCE(field_mappings, '[]'),
           sync_settings = COALESCE(sync_settings, '{}'),
           status = COALESCE(status, 'pending'),
           is_paused = COALESCE(is_paused, 0)`,
      () => resolve()
    );
  });
  await new Promise<void>((resolve) => {
    db.run(
      `UPDATE integrations
       SET connector_id = COALESCE(connector_id, id),
           name = COALESCE(name, connector_id, id),
           category = COALESCE(category, 'productivity'),
           config = COALESCE(config, '{}'),
           capabilities = COALESCE(capabilities, '[]'),
           field_mappings = COALESCE(field_mappings, '[]'),
           sync_settings = COALESCE(sync_settings, '{}'),
           status = COALESCE(status, 'pending'),
           is_paused = COALESCE(is_paused, 0)
       WHERE connector_id IS NULL OR name IS NULL OR category IS NULL OR config IS NULL`,
      () => resolve()
    );
  });
  await new Promise<void>((resolve) => {
    db.run(`CREATE INDEX IF NOT EXISTS idx_integrations_org ON integrations(organization_id)`, () =>
      resolve()
    );
  });
  await new Promise<void>((resolve) => {
    db.run(
      `CREATE INDEX IF NOT EXISTS idx_integrations_connector ON integrations(connector_id)`,
      () => resolve()
    );
  });
}

// ==========================================
// TARGETED SELF-HEAL (CUSTOMER SUCCESS PLAYBOOKS)
// ==========================================

async function ensureCustomerSuccessPlaybookTables(): Promise<void> {
  const db = await getDatabaseAsync();
  const dbType = databaseConfig.type;

  if (dbType === 'postgres') {
    await db.query(`
      CREATE TABLE IF NOT EXISTS customer_success_playbooks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        trigger_conditions_json TEXT DEFAULT '{}',
        actions_json TEXT DEFAULT '[]',
        is_active INTEGER DEFAULT 1,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS customer_playbook_actions (
        id TEXT PRIMARY KEY,
        playbook_id TEXT,
        organization_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        action_config_json TEXT DEFAULT '{}',
        status TEXT DEFAULT 'pending',
        executed_at TIMESTAMP,
        result_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS customer_success_actions (
        id TEXT PRIMARY KEY,
        playbook_id TEXT,
        organization_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        executed_at TIMESTAMP,
        result_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_playbook_actions_playbook ON customer_playbook_actions(playbook_id)`
    );
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_playbook_actions_org ON customer_playbook_actions(organization_id)`
    );
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_playbook_actions_status ON customer_playbook_actions(status)`
    );
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_customer_success_actions_org ON customer_success_actions(organization_id)`
    );
    return;
  }

  const run = (sql: string) =>
    new Promise<void>((resolve) => {
      db.run(sql, () => resolve());
    });

  await run(`
    CREATE TABLE IF NOT EXISTS customer_success_playbooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      trigger_conditions_json TEXT DEFAULT '{}',
      actions_json TEXT DEFAULT '[]',
      is_active INTEGER DEFAULT 1,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS customer_playbook_actions (
      id TEXT PRIMARY KEY,
      playbook_id TEXT,
      organization_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      action_config_json TEXT DEFAULT '{}',
      status TEXT DEFAULT 'pending',
      executed_at TEXT,
      result_json TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS customer_success_actions (
      id TEXT PRIMARY KEY,
      playbook_id TEXT,
      organization_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      executed_at TEXT,
      result_json TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  await run(
    `CREATE INDEX IF NOT EXISTS idx_playbook_actions_playbook ON customer_playbook_actions(playbook_id)`
  );
  await run(
    `CREATE INDEX IF NOT EXISTS idx_playbook_actions_org ON customer_playbook_actions(organization_id)`
  );
  await run(
    `CREATE INDEX IF NOT EXISTS idx_playbook_actions_status ON customer_playbook_actions(status)`
  );
  await run(
    `CREATE INDEX IF NOT EXISTS idx_customer_success_actions_org ON customer_success_actions(organization_id)`
  );
}

// ==========================================
// TARGETED SELF-HEAL (BUDGET RESOURCE TABLES)
// ==========================================

async function ensureBudgetResourceTables(): Promise<void> {
  const db = await getDatabaseAsync();
  const dbType = databaseConfig.type;

  if (dbType === 'postgres') {
    await db.query(`
      CREATE TABLE IF NOT EXISTS budget_expenses (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('TOKENS', 'STORAGE', 'COMPUTE', 'API', 'OTHER')),
        description TEXT,
        metadata TEXT DEFAULT '{}',
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_quotas (
        user_id TEXT PRIMARY KEY,
        storage_quota_mb INTEGER,
        api_rate_limit_per_hour INTEGER,
        ai_requests_per_day INTEGER,
        max_concurrent_jobs INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_budget_expenses_org ON budget_expenses(organization_id)`
    );
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_budget_expenses_category ON budget_expenses(category)`
    );
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_budget_expenses_recorded_at ON budget_expenses(recorded_at DESC)`
    );
    await db.query(`CREATE INDEX IF NOT EXISTS idx_user_quotas_user ON user_quotas(user_id)`);
    return;
  }

  await new Promise<void>((resolve) => {
    db.run(
      `CREATE TABLE IF NOT EXISTS budget_expenses (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('TOKENS', 'STORAGE', 'COMPUTE', 'API', 'OTHER')),
        description TEXT,
        metadata TEXT DEFAULT '{}',
        recorded_at TEXT DEFAULT (datetime('now'))
      )`,
      () => resolve()
    );
  });
  await new Promise<void>((resolve) => {
    db.run(
      `CREATE TABLE IF NOT EXISTS user_quotas (
        user_id TEXT PRIMARY KEY,
        storage_quota_mb INTEGER,
        api_rate_limit_per_hour INTEGER,
        ai_requests_per_day INTEGER,
        max_concurrent_jobs INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
      () => resolve()
    );
  });
  await new Promise<void>((resolve) => {
    db.run(
      `CREATE INDEX IF NOT EXISTS idx_budget_expenses_org ON budget_expenses(organization_id)`,
      () => resolve()
    );
  });
  await new Promise<void>((resolve) => {
    db.run(
      `CREATE INDEX IF NOT EXISTS idx_budget_expenses_category ON budget_expenses(category)`,
      () => resolve()
    );
  });
  await new Promise<void>((resolve) => {
    db.run(
      `CREATE INDEX IF NOT EXISTS idx_budget_expenses_recorded_at ON budget_expenses(recorded_at DESC)`,
      () => resolve()
    );
  });
  await new Promise<void>((resolve) => {
    db.run(`CREATE INDEX IF NOT EXISTS idx_user_quotas_user ON user_quotas(user_id)`, () =>
      resolve()
    );
  });
}

// ==========================================
// TARGETED SELF-HEAL (IMPORTED REPORTS)
// ==========================================

async function ensureImportedReportsTables(): Promise<void> {
  const db = await getDatabaseAsync();
  const dbType = databaseConfig.type;

  if (dbType === 'postgres') {
    await db.query(`
      CREATE TABLE IF NOT EXISTS imported_reports (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        project_id TEXT,
        source_file_name TEXT NOT NULL,
        source_file_path TEXT,
        source_file_size INTEGER,
        source_format TEXT NOT NULL DEFAULT 'pdf',
        detected_framework TEXT NOT NULL DEFAULT 'DRD',
        detection_confidence REAL DEFAULT 0,
        extracted_data_json TEXT,
        mapped_data_json TEXT,
        extraction_details_json TEXT,
        document_metadata_json TEXT,
        canonical_markdown TEXT,
        auto_summary TEXT,
        coverage_percent REAL DEFAULT 0,
        target_type TEXT,
        target_id TEXT,
        initiatives_created INTEGER DEFAULT 0,
        initiatives_target_ids TEXT DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'pending',
        processing_error TEXT,
        processing_log TEXT,
        created_by TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP
      )
    `);
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_imported_reports_org ON imported_reports(organization_id)`
    );
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_imported_reports_status ON imported_reports(status)`
    );
    return;
  }

  // SQLite branch
  await new Promise<void>((resolve, reject) => {
    db.run(
      `CREATE TABLE IF NOT EXISTS imported_reports (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        project_id TEXT,
        source_file_name TEXT NOT NULL,
        source_file_path TEXT,
        source_file_size INTEGER,
        source_format TEXT NOT NULL DEFAULT 'pdf',
        detected_framework TEXT NOT NULL DEFAULT 'DRD',
        detection_confidence REAL DEFAULT 0,
        extracted_data_json TEXT,
        mapped_data_json TEXT,
        extraction_details_json TEXT,
        document_metadata_json TEXT,
        canonical_markdown TEXT,
        auto_summary TEXT,
        coverage_percent REAL DEFAULT 0,
        target_type TEXT,
        target_id TEXT,
        initiatives_created INTEGER DEFAULT 0,
        initiatives_target_ids TEXT DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'pending',
        processing_error TEXT,
        processing_log TEXT,
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        processed_at TEXT
      )`,
      (err: Error | null) => (err ? reject(err) : resolve())
    );
  });

  // Indices (best-effort)
  await new Promise<void>((resolve) => {
    db.run(
      `CREATE INDEX IF NOT EXISTS idx_imported_reports_org ON imported_reports(organization_id)`,
      () => resolve()
    );
  });
  await new Promise<void>((resolve) => {
    db.run(
      `CREATE INDEX IF NOT EXISTS idx_imported_reports_status ON imported_reports(status)`,
      () => resolve()
    );
  });
}

// ==========================================
// TARGETED SELF-HEAL (PROJECT AI SETTINGS)
// ==========================================

async function ensureProjectAISettingsTables(): Promise<void> {
  const db = await getDatabaseAsync();
  const dbType = databaseConfig.type;

  // Used by:
  // - Project AI role endpoints (`/api/projects/:id/ai-role`)
  // - Project regulatory mode endpoints (`/api/projects/:id/regulatory-mode`)
  // - AI policy/orchestrator enforcement
  if (dbType === 'postgres') {
    await db.query(`
      CREATE TABLE IF NOT EXISTS project_ai_settings (
        project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
        ai_role TEXT NOT NULL DEFAULT 'ADVISOR',
        regulatory_mode_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        regulatory_prompt TEXT DEFAULT '',
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_project_ai_settings_role ON project_ai_settings(ai_role)`
    );
    return;
  }

  // SQLite branch
  await new Promise<void>((resolve, reject) => {
    db.run(
      `CREATE TABLE IF NOT EXISTS project_ai_settings (
        project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
        ai_role TEXT NOT NULL DEFAULT 'ADVISOR',
        regulatory_mode_enabled INTEGER NOT NULL DEFAULT 0,
        regulatory_prompt TEXT DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      (err: Error | null) => (err ? reject(err) : resolve())
    );
  });

  // Best-effort indices
  await new Promise<void>((resolve) => {
    db.run(
      `CREATE INDEX IF NOT EXISTS idx_project_ai_settings_role ON project_ai_settings(ai_role)`,
      () => resolve()
    );
  });
}

// ==========================================
// TARGETED SELF-HEAL (BILLING CORE TABLES)
// ==========================================

async function ensureBillingCoreTables(): Promise<void> {
  const db = await getDatabaseAsync();
  const dbType = databaseConfig.type;

  // L4 deploy-gate billing endpoints rely on subscriptions existing even in fresh SQLite DBs.
  if (dbType === 'postgres') {
    await db.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
        status TEXT NOT NULL DEFAULT 'active',
        billing_cycle TEXT NOT NULL DEFAULT 'monthly',
        current_period_start TIMESTAMP,
        current_period_end TIMESTAMP,
        trial_start TIMESTAMP,
        trial_end TIMESTAMP,
        cancel_at_period_end BOOLEAN DEFAULT FALSE,
        canceled_at TIMESTAMP,
        metadata TEXT DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON subscriptions(organization_id)`
    );
    await db.query(`CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)`);
    return;
  }

  // SQLite branch
  await new Promise<void>((resolve, reject) => {
    db.run(
      `CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
        status TEXT NOT NULL DEFAULT 'active',
        billing_cycle TEXT NOT NULL DEFAULT 'monthly',
        current_period_start TEXT,
        current_period_end TEXT,
        trial_start TEXT,
        trial_end TEXT,
        cancel_at_period_end INTEGER DEFAULT 0,
        canceled_at TEXT,
        metadata TEXT DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      (err: Error | null) => (err ? reject(err) : resolve())
    );
  });

  await new Promise<void>((resolve) => {
    db.run(
      `CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON subscriptions(organization_id)`,
      () => resolve()
    );
  });
  await new Promise<void>((resolve) => {
    db.run(`CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)`, () =>
      resolve()
    );
  });
}

// ==========================================
// TARGETED SELF-HEAL (INITIATIVE SECTION TYPES)
// ==========================================

async function ensureInitiativeSectionTypesTables(): Promise<void> {
  const db = await getDatabaseAsync();
  const dbType = databaseConfig.type;

  if (dbType === 'postgres') {
    await db.query(`
      CREATE TABLE IF NOT EXISTS initiative_section_types (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        key TEXT NOT NULL,
        name TEXT NOT NULL,
        name_pl TEXT,
        description TEXT,
        description_pl TEXT,
        category TEXT NOT NULL DEFAULT 'content',
        column_position TEXT NOT NULL DEFAULT 'left',
        default_order INTEGER NOT NULL DEFAULT 100,
        icon TEXT,
        icon_color TEXT,
        icon_bg TEXT,
        component_key TEXT NOT NULL,
        ai_prompt_template TEXT,
        render_config TEXT,
        default_config TEXT,
        is_system BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_ist_org ON initiative_section_types(organization_id)`
    );
    await db.query(`CREATE INDEX IF NOT EXISTS idx_ist_key ON initiative_section_types(key)`);
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_ist_active ON initiative_section_types(is_active)`
    );
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_ist_column ON initiative_section_types(column_position)`
    );
    return;
  }

  // SQLite branch
  await new Promise<void>((resolve, reject) => {
    db.run(
      `CREATE TABLE IF NOT EXISTS initiative_section_types (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        key TEXT NOT NULL,
        name TEXT NOT NULL,
        name_pl TEXT,
        description TEXT,
        description_pl TEXT,
        category TEXT NOT NULL DEFAULT 'content',
        column_position TEXT NOT NULL DEFAULT 'left',
        default_order INTEGER NOT NULL DEFAULT 100,
        icon TEXT,
        icon_color TEXT,
        icon_bg TEXT,
        component_key TEXT NOT NULL,
        ai_prompt_template TEXT,
        render_config TEXT,
        default_config TEXT,
        is_system INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_by TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
      (err: Error | null) => (err ? reject(err) : resolve())
    );
  });

  // Indices (best-effort)
  await new Promise<void>((resolve) => {
    db.run(
      `CREATE INDEX IF NOT EXISTS idx_ist_org ON initiative_section_types(organization_id)`,
      () => resolve()
    );
  });
  await new Promise<void>((resolve) => {
    db.run(`CREATE INDEX IF NOT EXISTS idx_ist_key ON initiative_section_types(key)`, () =>
      resolve()
    );
  });
  await new Promise<void>((resolve) => {
    db.run(`CREATE INDEX IF NOT EXISTS idx_ist_active ON initiative_section_types(is_active)`, () =>
      resolve()
    );
  });
  await new Promise<void>((resolve) => {
    db.run(
      `CREATE INDEX IF NOT EXISTS idx_ist_column ON initiative_section_types(column_position)`,
      () => resolve()
    );
  });

  // Seed a minimal system library so the Initiatives UI doesn't break on fresh SQLite.
  const seeds: Array<[string, string, string, string, number, string]> = [
    ['ist-overview', 'overview', 'Initiative Description', 'Opis inicjatywy', 10, 'overview'],
    [
      'ist-problem-definition',
      'problemDefinition',
      'Problem Definition',
      'Definicja problemu',
      20,
      'problemDefinition',
    ],
    ['ist-target-state', 'targetState', 'Target State', 'Stan docelowy', 30, 'targetState'],
    ['ist-scope', 'scope', 'Scope', 'Zakres', 40, 'scope'],
    ['ist-tasks', 'tasks', 'Tasks', 'Zadania', 50, 'tasks'],
    ['ist-decisions', 'decisions', 'Decisions', 'Decyzje', 60, 'decisions'],
    ['ist-raid', 'raid', 'RAID Log', 'Rejestr RAID', 70, 'raid'],
    ['ist-gates', 'gates', 'Gate Readiness', 'Bramki decyzyjne', 80, 'gates'],
  ];

  for (const [id, key, name, namePl, order, componentKey] of seeds) {
    await new Promise<void>((resolve) => {
      db.run(
        `INSERT OR IGNORE INTO initiative_section_types
          (id, organization_id, key, name, name_pl, category, column_position, default_order, component_key, is_system, is_active)
         VALUES (?, NULL, ?, ?, ?, 'content', 'left', ?, ?, 1, 1)`,
        [id, key, name, namePl, order, componentKey],
        () => resolve()
      );
    });
  }
}

// ==========================================
// TARGETED SELF-HEAL (REPORT BUILDER + SCHEDULED REPORTS)
// ==========================================

async function ensureReportBuilderAndSchedulingTables(): Promise<void> {
  const db = await getDatabaseAsync();
  const dbType = databaseConfig.type;

  if (dbType === 'postgres') {
    // Core Report Builder tables (minimal, but compatible with Report Builder routes + services)
    await db.query(`
      CREATE TABLE IF NOT EXISTS report_builder_reports (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        project_id TEXT,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        source_name TEXT,
        source_framework TEXT,
        title TEXT NOT NULL,
        description TEXT,
        report_type TEXT NOT NULL,
        template_id TEXT,
        config_json TEXT,
        company_context_json TEXT,
        status TEXT NOT NULL DEFAULT 'DRAFT',
        created_by TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_by TEXT,
        generated_at TIMESTAMP,
        finalized_at TIMESTAMP,
        submitted_at TIMESTAMP,
        approved_at TIMESTAMP,
        approved_by TEXT,
        utilized_at TIMESTAMP,
        version INTEGER DEFAULT 1,
        parent_report_id TEXT,
        pdf_path TEXT,
        pptx_path TEXT,
        generation_metadata TEXT,
        -- V3 Report Definition Layer
        report_type_v3 TEXT DEFAULT 'custom',
        period_from TEXT,
        period_to TEXT,
        communication_register TEXT,
        density TEXT DEFAULT 'standard',
        form TEXT,
        data_level TEXT DEFAULT 'balanced',
        confidentiality TEXT DEFAULT 'internal',
        theme_id TEXT,
        context_pack_snapshot TEXT,
        goal_v3 TEXT,
        source_refs_json TEXT DEFAULT '[]'
      )
    `);
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_rb_reports_org ON report_builder_reports(organization_id)`
    );
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_rb_reports_source ON report_builder_reports(source_type, source_id)`
    );
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_rb_reports_type_v3 ON report_builder_reports(report_type_v3)`
    );
    // Archive/unarchive (#68e) — orthogonal to `status` workflow (DRAFT..UTILIZED) so a
    // report keeps its workflow status while archived and can be restored to it.
    await db.query(
      `ALTER TABLE report_builder_reports ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP`
    );
    await db.query(`ALTER TABLE report_builder_reports ADD COLUMN IF NOT EXISTS archived_by TEXT`);
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_rb_reports_archived ON report_builder_reports(organization_id, archived_at)`
    );

    await db.query(`
      CREATE TABLE IF NOT EXISTS report_builder_sections (
        id TEXT PRIMARY KEY,
        report_id TEXT NOT NULL,
        section_key TEXT NOT NULL,
        section_type TEXT NOT NULL,
        title TEXT NOT NULL,
        order_index INTEGER NOT NULL DEFAULT 0,
        enabled BOOLEAN DEFAULT TRUE,
        required BOOLEAN DEFAULT FALSE,
        length TEXT DEFAULT 'medium',
        language TEXT DEFAULT 'business',
        custom_prompt TEXT,
        generated_content TEXT,
        edited_content TEXT,
        content_format TEXT DEFAULT 'markdown',
        tiptap_content TEXT,
        source_data_snapshot TEXT,
        generated_at TIMESTAMP,
        tokens_used INTEGER,
        generation_model TEXT,
        edited_at TIMESTAMP,
        edited_by TEXT,
        repeat_for TEXT,
        repeat_key TEXT,
        repeat_name TEXT,
        repeat_data TEXT,
        block_type_id TEXT,
        block_config_json TEXT,
        render_kind TEXT,
        chapter_key TEXT,
        chapter_title TEXT,
        -- V3 fields
        rag TEXT,
        summary TEXT,
        source_refs_json TEXT DEFAULT '[]',
        is_refreshable INTEGER DEFAULT 0,
        last_data_timestamp TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_rb_sections_report FOREIGN KEY (report_id) REFERENCES report_builder_reports(id) ON DELETE CASCADE,
        CONSTRAINT uq_rb_sections UNIQUE(report_id, section_key)
      )
    `);
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_rb_sections_report ON report_builder_sections(report_id)`
    );
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_rb_sections_order ON report_builder_sections(report_id, order_index)`
    );
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_rb_sections_block_type ON report_builder_sections(block_type_id)`
    );

    await db.query(`
      CREATE TABLE IF NOT EXISTS report_builder_templates (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        name TEXT NOT NULL,
        description TEXT,
        source_type TEXT NOT NULL,
        report_type TEXT,
        sections_json TEXT NOT NULL,
        default_options_json TEXT,
        is_system BOOLEAN DEFAULT FALSE,
        is_default BOOLEAN DEFAULT FALSE,
        is_public BOOLEAN DEFAULT FALSE,
        created_by TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_rb_templates_org ON report_builder_templates(organization_id)`
    );
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_rb_templates_type ON report_builder_templates(source_type, report_type)`
    );

    await db.query(`
      CREATE TABLE IF NOT EXISTS report_builder_sessions (
        id TEXT PRIMARY KEY,
        report_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        closed_at TIMESTAMP,
        last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        navigation_state TEXT,
        CONSTRAINT uq_rb_sessions UNIQUE(report_id, user_id)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS report_builder_activity (
        id TEXT PRIMARY KEY,
        report_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        action_by TEXT NOT NULL,
        action_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS report_builder_versions (
        id TEXT PRIMARY KEY,
        report_id TEXT NOT NULL,
        version_number INTEGER NOT NULL,
        snapshot_json TEXT NOT NULL,
        change_summary TEXT,
        change_type TEXT,
        previous_status TEXT,
        new_status TEXT,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Block Types (library) — include required columns used by DatabaseInitializer validation
    await db.query(`
      CREATE TABLE IF NOT EXISTS report_builder_block_types (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        name TEXT NOT NULL,
        description TEXT,
        source_types_json TEXT,
        render_kind TEXT NOT NULL DEFAULT 'markdown',
        prompt_template TEXT,
        input_schema_json TEXT,
        default_length TEXT DEFAULT 'medium',
        default_language TEXT DEFAULT 'business',
        is_system BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        category TEXT DEFAULT 'content',
        display_order INTEGER DEFAULT 999,
        slide_intent TEXT,
        pptx_prompt_template TEXT,
        pptx_output_schema TEXT,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_rb_block_types_org ON report_builder_block_types(organization_id)`
    );
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_rb_block_types_active ON report_builder_block_types(is_active)`
    );
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_rb_block_types_category ON report_builder_block_types(category)`
    );
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_rb_block_types_order ON report_builder_block_types(display_order)`
    );

    // Comments (workflow gates)
    await db.query(`
      CREATE TABLE IF NOT EXISTS report_builder_comments (
        id TEXT PRIMARY KEY,
        report_id TEXT NOT NULL,
        section_key TEXT,
        anchor_type TEXT DEFAULT 'section',
        range_start INTEGER,
        range_end INTEGER,
        quote TEXT,
        content_hash TEXT,
        user_id TEXT NOT NULL,
        user_name TEXT,
        user_avatar TEXT,
        comment_type TEXT DEFAULT 'FEEDBACK',
        content TEXT NOT NULL,
        ai_response TEXT,
        ai_suggested_edits TEXT,
        ai_processed_at TEXT,
        status TEXT DEFAULT 'OPEN',
        resolved_by TEXT,
        resolved_at TEXT,
        resolution_notes TEXT,
        parent_comment_id TEXT,
        thread_position INTEGER DEFAULT 0,
        priority TEXT DEFAULT 'normal',
        tags TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_rb_comments_report ON report_builder_comments(report_id)`
    );
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_rb_comments_section ON report_builder_comments(report_id, section_key)`
    );

    await db.query(`
      CREATE TABLE IF NOT EXISTS report_builder_comment_activity (
        id TEXT PRIMARY KEY,
        comment_id TEXT NOT NULL,
        report_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        action_by TEXT NOT NULL,
        action_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        old_value TEXT,
        new_value TEXT,
        metadata TEXT
      )
    `);

    // Exports + public links (used by export endpoints and share UI)
    await db.query(`
      CREATE TABLE IF NOT EXISTS report_exports (
        id TEXT PRIMARY KEY,
        report_id TEXT NOT NULL,
        report_type TEXT NOT NULL,
        format TEXT NOT NULL,
        file_path TEXT,
        file_size INTEGER,
        language TEXT DEFAULT 'en',
        exported_by TEXT NOT NULL,
        exported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        download_count INTEGER DEFAULT 0,
        last_download_at TIMESTAMP
      )
    `);
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_report_exports_report ON report_exports(report_id)`
    );

    await db.query(`
      CREATE TABLE IF NOT EXISTS report_public_links (
        id TEXT PRIMARY KEY,
        report_id TEXT NOT NULL,
        report_type TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        link_token TEXT NOT NULL UNIQUE,
        password_hash TEXT,
        expires_at TIMESTAMP,
        show_company_logo BOOLEAN DEFAULT TRUE,
        show_consultify_branding BOOLEAN DEFAULT TRUE,
        custom_message TEXT,
        view_count INTEGER DEFAULT 0,
        last_viewed_at TIMESTAMP,
        created_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        revoked_at TIMESTAMP
      )
    `);

    // Scheduled reports tables (T062 baseline + execution log)
    await db.query(`
      CREATE TABLE IF NOT EXISTS report_schedules (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        report_template_id TEXT,
        source_assessment_id TEXT,
        source_project_id TEXT,
        schedule_name TEXT NOT NULL,
        cron_expression TEXT NOT NULL,
        timezone TEXT DEFAULT 'UTC',
        next_run_at TIMESTAMP,
        last_run_at TIMESTAMP,
        last_run_status TEXT,
        last_run_report_id TEXT,
        run_count INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        config_json TEXT DEFAULT '{}',
        created_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        schedule_type TEXT DEFAULT 'time_based',
        deliverable_type TEXT DEFAULT 'report',
        scope_type TEXT DEFAULT 'organization',
        scope_id TEXT,
        description TEXT
      )
    `);
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_report_schedules_org ON report_schedules(organization_id)`
    );
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_report_schedules_active ON report_schedules(is_active, next_run_at)`
    );

    await db.query(`
      CREATE TABLE IF NOT EXISTS schedule_executions (
        id TEXT PRIMARY KEY,
        schedule_id TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TIMESTAMP NOT NULL,
        completed_at TIMESTAMP,
        generated_report_id TEXT,
        error TEXT,
        delivery_results_json TEXT DEFAULT '[]',
        trigger_type TEXT,
        trigger_reason TEXT,
        deliverable_type TEXT DEFAULT 'report',
        generated_presentation_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_schedule_exec_schedule FOREIGN KEY (schedule_id) REFERENCES report_schedules(id) ON DELETE CASCADE
      )
    `);
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_schedule_executions_schedule ON schedule_executions(schedule_id)`
    );
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_schedule_executions_started ON schedule_executions(started_at DESC)`
    );

    // Optional: event-triggered scheduling support tables (safe if unused)
    await db.query(`
      CREATE TABLE IF NOT EXISTS schedule_trigger_rules (
        id TEXT PRIMARY KEY,
        schedule_id TEXT NOT NULL,
        trigger_type TEXT NOT NULL,
        conditions_json TEXT DEFAULT '{}',
        is_active BOOLEAN DEFAULT TRUE,
        throttle_hours INTEGER DEFAULT 24,
        last_fired_at TIMESTAMP,
        fire_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_trigger_rules_schedule FOREIGN KEY (schedule_id) REFERENCES report_schedules(id) ON DELETE CASCADE
      )
    `);
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_trigger_rules_schedule ON schedule_trigger_rules(schedule_id)`
    );

    await db.query(`
      CREATE TABLE IF NOT EXISTS trigger_fire_log (
        id TEXT PRIMARY KEY,
        schedule_id TEXT NOT NULL,
        rule_id TEXT NOT NULL,
        trigger_type TEXT NOT NULL,
        scope_type TEXT,
        scope_id TEXT,
        project_id TEXT,
        fired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reason TEXT,
        signal_data_json TEXT DEFAULT '{}',
        execution_id TEXT,
        throttled BOOLEAN DEFAULT FALSE,
        CONSTRAINT fk_trigger_fire_schedule FOREIGN KEY (schedule_id) REFERENCES report_schedules(id) ON DELETE CASCADE,
        CONSTRAINT fk_trigger_fire_rule FOREIGN KEY (rule_id) REFERENCES schedule_trigger_rules(id) ON DELETE CASCADE
      )
    `);

    // Brand Voice profiles (Report Builder V3 Phase 5)
    await db.query(`
      CREATE TABLE IF NOT EXISTS organization_brand_voice_profiles (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL UNIQUE,
        register_preferences TEXT DEFAULT '{}',
        vocabulary_preferences TEXT DEFAULT '{}',
        hedging_rules TEXT DEFAULT '{}',
        compliance_mode BOOLEAN DEFAULT FALSE,
        compliance_rules TEXT DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(
      `CREATE INDEX IF NOT EXISTS idx_brand_voice_org ON organization_brand_voice_profiles(organization_id)`
    );

    // Seed minimal system templates (one default + Final Transformation Report)
    const now = new Date().toISOString();
    const tplAssessmentDefaultSections = JSON.stringify([
      { key: 'cover', type: 'cover', title: 'Cover Page', required: true, order: 0 },
      {
        key: 'executive_summary',
        type: 'summary',
        title: 'Executive Summary',
        required: true,
        order: 1,
        defaultLength: 'medium',
        defaultLanguage: 'business',
      },
      {
        key: 'recommendations',
        type: 'recommendations',
        title: 'Recommendations',
        required: true,
        order: 2,
        defaultLength: 'medium',
        defaultLanguage: 'business',
      },
      {
        key: 'next_steps',
        type: 'action_plan',
        title: 'Next Steps',
        required: true,
        order: 3,
        defaultLength: 'medium',
        defaultLanguage: 'business',
      },
      { key: 'appendix', type: 'appendix', title: 'Appendix', required: false, order: 4 },
    ]);
    const tplFinalTransformationSections = JSON.stringify([
      {
        key: 'cover',
        type: 'cover',
        title: 'Cover Page',
        required: true,
        order: 0,
        defaultLength: 'short',
        defaultLanguage: 'business',
      },
      {
        key: 'executive_summary',
        type: 'summary',
        title: 'Executive Summary',
        required: true,
        order: 1,
        defaultLength: 'medium',
        defaultLanguage: 'business',
        promptHints:
          'Write a board-ready executive summary of the transformation. Focus on outcomes, progress, remaining gaps, and what needs attention next.',
      },
      {
        key: 'transformation_narrative',
        type: 'custom',
        title: 'Transformation Narrative (Before → After)',
        required: true,
        order: 2,
        defaultLength: 'long',
        defaultLanguage: 'business',
        promptHints:
          'Describe the transformation story: starting point, key interventions, turning points, and the new operating model. Be concrete and results-focused.',
      },
      {
        key: 'kpi_impact',
        type: 'custom',
        title: 'KPI & Performance Impact',
        required: true,
        order: 3,
        defaultLength: 'medium',
        defaultLanguage: 'business',
        promptHints:
          'Summarize KPI impact and trends. Highlight the top 5 KPIs that moved, what drove the change, and what is lagging.',
      },
      {
        key: 'roi_financials',
        type: 'custom',
        title: 'ROI / Financial Impact',
        required: true,
        order: 4,
        defaultLength: 'medium',
        defaultLanguage: 'business',
        promptHints:
          'Quantify financial impact where possible: costs, savings, revenue uplift, ROI. Include assumptions and confidence level.',
      },
      {
        key: 'initiatives_portfolio',
        type: 'initiatives',
        title: 'Recommended Next Initiatives Portfolio',
        required: true,
        order: 5,
        defaultLength: 'medium',
        defaultLanguage: 'business',
        promptHints:
          'Propose a realistic next-initiatives portfolio aligned to remaining gaps. Prioritize with impact/effort and include ownership hints.',
      },
      {
        key: 'recommendations',
        type: 'recommendations',
        title: 'Recommendations & Decisions Required',
        required: true,
        order: 6,
        defaultLength: 'medium',
        defaultLanguage: 'business',
        promptHints:
          'Provide 5-10 recommendations. Explicitly call out 3-5 decisions leadership must make in the next 2 weeks.',
      },
      {
        key: 'next_steps',
        type: 'action_plan',
        title: '90-Day Action Plan',
        required: true,
        order: 7,
        defaultLength: 'medium',
        defaultLanguage: 'business',
        promptHints:
          'Create a 90-day action plan broken into 0-30 / 31-60 / 61-90 days with owners and success criteria.',
      },
      {
        key: 'appendix',
        type: 'appendix',
        title: 'Appendix (Evidence & Notes)',
        required: false,
        order: 8,
        defaultLength: 'long',
        defaultLanguage: 'technical',
        promptHints:
          'Add supporting evidence summary, risks/mitigations, and references to data sources used in this report.',
      },
    ]);

    await db.query(
      `
      INSERT INTO report_builder_templates (
        id, organization_id, name, description, source_type, report_type,
        sections_json, default_options_json, is_system, is_default, is_public,
        created_by, created_at, updated_at
      ) VALUES ($1, NULL, $2, $3, $4, NULL, $5, $6, TRUE, TRUE, FALSE, 'system', $7, $7)
      ON CONFLICT (id) DO NOTHING
    `,
      [
        'tpl-assessment-default',
        'Assessment Report (Default)',
        'Default template for assessment-based reports',
        'ASSESSMENT',
        tplAssessmentDefaultSections,
        JSON.stringify({ length: 'medium', language: 'business', verbosity: 'standard' }),
        now,
      ]
    );

    await db.query(
      `
      INSERT INTO report_builder_templates (
        id, organization_id, name, description, source_type, report_type,
        sections_json, default_options_json, is_system, is_default, is_public,
        created_by, created_at, updated_at
      ) VALUES ($1, NULL, $2, $3, $4, NULL, $5, $6, TRUE, FALSE, FALSE, 'system', $7, $7)
      ON CONFLICT (id) DO NOTHING
    `,
      [
        'tpl-final-transformation-report',
        'Final Transformation Report',
        'Board-ready end-of-phase transformation report: impact, ROI, decisions, and next 90-day plan.',
        'ASSESSMENT',
        tplFinalTransformationSections,
        JSON.stringify({ length: 'long', language: 'business', verbosity: 'detailed' }),
        now,
      ]
    );

    return;
  }

  // SQLite branch (best-effort, tolerant of existing schema)
  const run = (sql: string, params: unknown[] = []) =>
    new Promise<void>((resolve) => {
      (db as any).run(sql, params as any, () => resolve());
    });

  // Core tables
  await run(
    `CREATE TABLE IF NOT EXISTS report_builder_reports (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      project_id TEXT,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      source_name TEXT,
      source_framework TEXT,
      title TEXT NOT NULL,
      description TEXT,
      report_type TEXT NOT NULL,
      template_id TEXT,
      config_json TEXT,
      company_context_json TEXT,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      created_by TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      updated_by TEXT,
      generated_at TEXT,
      finalized_at TEXT,
      submitted_at TEXT,
      approved_at TEXT,
      approved_by TEXT,
      utilized_at TEXT,
      version INTEGER DEFAULT 1,
      parent_report_id TEXT,
      pdf_path TEXT,
      pptx_path TEXT,
      generation_metadata TEXT
    )`
  );

  await run(
    `CREATE TABLE IF NOT EXISTS report_builder_sections (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      section_key TEXT NOT NULL,
      section_type TEXT NOT NULL,
      title TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      required INTEGER DEFAULT 0,
      length TEXT DEFAULT 'medium',
      language TEXT DEFAULT 'business',
      custom_prompt TEXT,
      generated_content TEXT,
      edited_content TEXT,
      content_format TEXT DEFAULT 'markdown',
      tiptap_content TEXT,
      source_data_snapshot TEXT,
      generated_at TEXT,
      tokens_used INTEGER,
      generation_model TEXT,
      edited_at TEXT,
      edited_by TEXT,
      repeat_for TEXT,
      repeat_key TEXT,
      repeat_name TEXT,
      repeat_data TEXT,
      block_type_id TEXT,
      block_config_json TEXT,
      render_kind TEXT,
      chapter_key TEXT,
      chapter_title TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(report_id, section_key)
    )`
  );

  await run(
    `CREATE TABLE IF NOT EXISTS report_builder_templates (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      source_type TEXT NOT NULL,
      report_type TEXT,
      sections_json TEXT NOT NULL,
      default_options_json TEXT,
      is_system INTEGER DEFAULT 0,
      is_default INTEGER DEFAULT 0,
      is_public INTEGER DEFAULT 0,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`
  );

  await run(
    `CREATE TABLE IF NOT EXISTS report_builder_block_types (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      source_types_json TEXT,
      render_kind TEXT NOT NULL DEFAULT 'markdown',
      prompt_template TEXT,
      input_schema_json TEXT,
      default_length TEXT DEFAULT 'medium',
      default_language TEXT DEFAULT 'business',
      is_system INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      category TEXT DEFAULT 'content',
      display_order INTEGER DEFAULT 999,
      slide_intent TEXT,
      pptx_prompt_template TEXT,
      pptx_output_schema TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`
  );

  await run(
    `CREATE TABLE IF NOT EXISTS report_builder_comments (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      section_key TEXT,
      anchor_type TEXT DEFAULT 'section',
      range_start INTEGER,
      range_end INTEGER,
      quote TEXT,
      content_hash TEXT,
      user_id TEXT NOT NULL,
      user_name TEXT,
      user_avatar TEXT,
      comment_type TEXT DEFAULT 'FEEDBACK',
      content TEXT NOT NULL,
      ai_response TEXT,
      ai_suggested_edits TEXT,
      ai_processed_at TEXT,
      status TEXT DEFAULT 'OPEN',
      resolved_by TEXT,
      resolved_at TEXT,
      resolution_notes TEXT,
      parent_comment_id TEXT,
      thread_position INTEGER DEFAULT 0,
      priority TEXT DEFAULT 'normal',
      tags TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`
  );
  await run(
    `CREATE TABLE IF NOT EXISTS report_builder_comment_activity (
      id TEXT PRIMARY KEY,
      comment_id TEXT NOT NULL,
      report_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      action_by TEXT NOT NULL,
      action_at TEXT DEFAULT (datetime('now')),
      old_value TEXT,
      new_value TEXT,
      metadata TEXT
    )`
  );

  await run(
    `CREATE TABLE IF NOT EXISTS report_exports (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      report_type TEXT NOT NULL,
      format TEXT NOT NULL,
      file_path TEXT,
      file_size INTEGER,
      language TEXT DEFAULT 'en',
      exported_by TEXT NOT NULL,
      exported_at TEXT DEFAULT (datetime('now')),
      download_count INTEGER DEFAULT 0,
      last_download_at TEXT
    )`
  );
  await run(
    `CREATE TABLE IF NOT EXISTS report_public_links (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      report_type TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      link_token TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      expires_at TEXT,
      show_company_logo INTEGER DEFAULT 1,
      show_consultify_branding INTEGER DEFAULT 1,
      custom_message TEXT,
      view_count INTEGER DEFAULT 0,
      last_viewed_at TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      revoked_at TEXT
    )`
  );

  await run(
    `CREATE TABLE IF NOT EXISTS report_schedules (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      report_template_id TEXT,
      source_assessment_id TEXT,
      source_project_id TEXT,
      schedule_name TEXT NOT NULL,
      cron_expression TEXT NOT NULL,
      timezone TEXT DEFAULT 'UTC',
      next_run_at TEXT,
      last_run_at TEXT,
      last_run_status TEXT,
      last_run_report_id TEXT,
      run_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      config_json TEXT DEFAULT '{}',
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      schedule_type TEXT DEFAULT 'time_based',
      deliverable_type TEXT DEFAULT 'report',
      scope_type TEXT DEFAULT 'organization',
      scope_id TEXT,
      description TEXT
    )`
  );
  await run(
    `CREATE TABLE IF NOT EXISTS schedule_executions (
      id TEXT PRIMARY KEY,
      schedule_id TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      generated_report_id TEXT,
      error TEXT,
      delivery_results_json TEXT DEFAULT '[]',
      trigger_type TEXT,
      trigger_reason TEXT,
      deliverable_type TEXT DEFAULT 'report',
      generated_presentation_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`
  );

  // Brand Voice profiles (Report Builder V3 Phase 5)
  await run(
    `CREATE TABLE IF NOT EXISTS organization_brand_voice_profiles (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL UNIQUE,
      register_preferences TEXT DEFAULT '{}',
      vocabulary_preferences TEXT DEFAULT '{}',
      hedging_rules TEXT DEFAULT '{}',
      compliance_mode INTEGER DEFAULT 0,
      compliance_rules TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`
  );

  // Minimal template seeding
  const now = new Date().toISOString();
  const tplAssessmentDefaultSections = JSON.stringify([
    { key: 'cover', type: 'cover', title: 'Cover Page', required: true, order: 0 },
    {
      key: 'executive_summary',
      type: 'summary',
      title: 'Executive Summary',
      required: true,
      order: 1,
      defaultLength: 'medium',
      defaultLanguage: 'business',
    },
    {
      key: 'recommendations',
      type: 'recommendations',
      title: 'Recommendations',
      required: true,
      order: 2,
      defaultLength: 'medium',
      defaultLanguage: 'business',
    },
    {
      key: 'next_steps',
      type: 'action_plan',
      title: 'Next Steps',
      required: true,
      order: 3,
      defaultLength: 'medium',
      defaultLanguage: 'business',
    },
    { key: 'appendix', type: 'appendix', title: 'Appendix', required: false, order: 4 },
  ]);
  const tplFinalTransformationSections = JSON.stringify([
    {
      key: 'cover',
      type: 'cover',
      title: 'Cover Page',
      required: true,
      order: 0,
      defaultLength: 'short',
      defaultLanguage: 'business',
    },
    {
      key: 'executive_summary',
      type: 'summary',
      title: 'Executive Summary',
      required: true,
      order: 1,
      defaultLength: 'medium',
      defaultLanguage: 'business',
      promptHints:
        'Write a board-ready executive summary of the transformation. Focus on outcomes, progress, remaining gaps, and what needs attention next.',
    },
    {
      key: 'transformation_narrative',
      type: 'custom',
      title: 'Transformation Narrative (Before → After)',
      required: true,
      order: 2,
      defaultLength: 'long',
      defaultLanguage: 'business',
      promptHints:
        'Describe the transformation story: starting point, key interventions, turning points, and the new operating model. Be concrete and results-focused.',
    },
    {
      key: 'kpi_impact',
      type: 'custom',
      title: 'KPI & Performance Impact',
      required: true,
      order: 3,
      defaultLength: 'medium',
      defaultLanguage: 'business',
      promptHints:
        'Summarize KPI impact and trends. Highlight the top 5 KPIs that moved, what drove the change, and what is lagging.',
    },
    {
      key: 'roi_financials',
      type: 'custom',
      title: 'ROI / Financial Impact',
      required: true,
      order: 4,
      defaultLength: 'medium',
      defaultLanguage: 'business',
      promptHints:
        'Quantify financial impact where possible: costs, savings, revenue uplift, ROI. Include assumptions and confidence level.',
    },
    {
      key: 'initiatives_portfolio',
      type: 'initiatives',
      title: 'Recommended Next Initiatives Portfolio',
      required: true,
      order: 5,
      defaultLength: 'medium',
      defaultLanguage: 'business',
      promptHints:
        'Propose a realistic next-initiatives portfolio aligned to remaining gaps. Prioritize with impact/effort and include ownership hints.',
    },
    {
      key: 'recommendations',
      type: 'recommendations',
      title: 'Recommendations & Decisions Required',
      required: true,
      order: 6,
      defaultLength: 'medium',
      defaultLanguage: 'business',
      promptHints:
        'Provide 5-10 recommendations. Explicitly call out 3-5 decisions leadership must make in the next 2 weeks.',
    },
    {
      key: 'next_steps',
      type: 'action_plan',
      title: '90-Day Action Plan',
      required: true,
      order: 7,
      defaultLength: 'medium',
      defaultLanguage: 'business',
      promptHints:
        'Create a 90-day action plan broken into 0-30 / 31-60 / 61-90 days with owners and success criteria.',
    },
    {
      key: 'appendix',
      type: 'appendix',
      title: 'Appendix (Evidence & Notes)',
      required: false,
      order: 8,
      defaultLength: 'long',
      defaultLanguage: 'technical',
      promptHints:
        'Add supporting evidence summary, risks/mitigations, and references to data sources used in this report.',
    },
  ]);

  await run(
    `INSERT OR IGNORE INTO report_builder_templates (
      id, organization_id, name, description, source_type, report_type,
      sections_json, default_options_json, is_system, is_default, is_public,
      created_by, created_at, updated_at
    ) VALUES (?, NULL, ?, ?, 'ASSESSMENT', NULL, ?, ?, 1, 1, 0, 'system', ?, ?)`,
    [
      'tpl-assessment-default',
      'Assessment Report (Default)',
      'Default template for assessment-based reports',
      tplAssessmentDefaultSections,
      JSON.stringify({ length: 'medium', language: 'business', verbosity: 'standard' }),
      now,
      now,
    ]
  );
  await run(
    `INSERT OR IGNORE INTO report_builder_templates (
      id, organization_id, name, description, source_type, report_type,
      sections_json, default_options_json, is_system, is_default, is_public,
      created_by, created_at, updated_at
    ) VALUES (?, NULL, ?, ?, 'ASSESSMENT', NULL, ?, ?, 1, 0, 0, 'system', ?, ?)`,
    [
      'tpl-final-transformation-report',
      'Final Transformation Report',
      'Board-ready end-of-phase transformation report: impact, ROI, decisions, and next 90-day plan.',
      tplFinalTransformationSections,
      JSON.stringify({ length: 'long', language: 'business', verbosity: 'detailed' }),
      now,
      now,
    ]
  );
}

// ==========================================
// SCHEMA COLUMN GAP FIXER
// ==========================================

// Three tables were created by early migrations that predate columns added later.
// CREATE TABLE IF NOT EXISTS in follow-up migrations is a no-op when the table exists,
// so the columns were never backfilled.  This function patches them safely.
async function ensureSchemaColumnGaps(): Promise<void> {
  const db = await getDatabaseAsync();
  const dbType = databaseConfig.type;

  if (dbType !== 'postgres') return; // SQLite local dev recreates tables fresh

  // sso_configurations: migration 032 created the table with `is_active` only;
  // migration 258 (which adds is_enabled/is_default/jit_provisioning) was a no-op.
  await db.query(
    `ALTER TABLE sso_configurations ADD COLUMN IF NOT EXISTS is_enabled INTEGER DEFAULT 0`
  );
  await db.query(
    `ALTER TABLE sso_configurations ADD COLUMN IF NOT EXISTS is_default INTEGER DEFAULT 0`
  );
  await db.query(
    `ALTER TABLE sso_configurations ADD COLUMN IF NOT EXISTS jit_provisioning INTEGER DEFAULT 1`
  );

  // admin_approval_workflows: ensureApprovalWorkflowTables() only runs CREATE TABLE IF NOT EXISTS,
  // so existing tables never got is_active added.
  await db.query(
    `ALTER TABLE admin_approval_workflows ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1`
  );

  // payment_methods: migration 091 never included is_active.
  await db.query(
    `ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1`
  );

  // my_idea_map_snapshots: migration 20260611 never auto-ran on existing prod DB.
  await db.query(`
    CREATE TABLE IF NOT EXISTS my_idea_map_snapshots (
      id TEXT PRIMARY KEY,
      idea_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      label TEXT,
      node_count INTEGER DEFAULT 0,
      edge_count INTEGER DEFAULT 0,
      data_json TEXT NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_my_idea_map_snapshots_idea ON my_idea_map_snapshots(idea_id)`
  );
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_my_idea_map_snapshots_org ON my_idea_map_snapshots(organization_id)`
  );
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_my_idea_map_snapshots_created ON my_idea_map_snapshots(created_at DESC)`
  );

  // my_idea_activity: same — missing from prod until this guard runs.
  await db.query(`
    CREATE TABLE IF NOT EXISTS my_idea_activity (
      id TEXT PRIMARY KEY,
      idea_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      type TEXT NOT NULL,
      actor TEXT,
      node_id TEXT,
      node_label TEXT,
      detail TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_my_idea_activity_idea ON my_idea_activity(idea_id)`
  );
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_my_idea_activity_org ON my_idea_activity(organization_id)`
  );
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_my_idea_activity_created ON my_idea_activity(created_at DESC)`
  );
}

// ==========================================
// TABLE PLATFORM MIGRATION RUNNER
// ==========================================

/**
 * Discovers this runner's ("[TP-Migrations]", hyphen — mechanism #2 in
 * docs/product/case-workspace/evidence/e7-migration-paths-2026-08-12/
 * MIGRATION_PATH_ASSESSMENT.md) migration file set, in the order it will
 * apply them.
 *
 * Extracted into its own exported function (E8) so the ordering fix below
 * is directly testable without exercising the full, side-effectful
 * `initializeDatabase()` — see
 * tests/integration/migration-ordering-parity.realdb.test.ts, which asserts
 * the SAME producer-before-consumer property this module's sibling runner
 * (migrationRunner.ts / "[TP Migrations]", mechanism #1) is already pinned
 * to by tests/integration/case-workspace-fresh-install-migration-order.realdb.test.ts.
 *
 * Pattern: imported from migrationIdentity.ts (the shared discovery
 * predicate module also used by migrationRunner.ts / "[TP Migrations]") so
 * the two runners can never drift on WHICH files count as a runtime
 * migration. Deliberately NOT using `isRuntimeMigrationFile()` here, which
 * would additionally admit RUNTIME_MIGRATION_ALLOWLIST (13 extra files,
 * e.g. 654_canonical_inbox_items_producer_fresh_db_gap.sql) — this runner
 * has always discovered a narrower set than migrationRunner.ts (see E7 §4).
 * That gap is a deliberate, evidenced E8 scope call (harmless today: this
 * runner's failure on 736_inbox_performance_indexes.sql is caught
 * non-fatally by the try/catch around this function's caller, and
 * migrationRunner.ts's own "[TP Migrations]" pass — which DOES carry the
 * allowlist — always runs afterward in the same boot and creates every
 * table this runner missed; verified via a real from-scratch boot, not just
 * by reading the code). Widening discovery here is a separate, reviewable
 * change with its own blast radius and belongs in its own packet.
 *
 * Ordering: was plain prefix-length/localeCompare with NO tiebreak for
 * identical prefixes — the exact bug this shared with migrationRunner.ts
 * before ITS fix; see that file's SAME_PREFIX_ORDER comment for the full
 * root-cause story and E7 §3 for how this exact defect class was found
 * still unfixed here. `compareMigrationFilenames` is imported directly from
 * migrationRunner.ts — ONE shared ordering function for both runtime
 * mechanisms, so a future same-day case_workspace-style file can no longer
 * be correct in one runner and wrong in the other.
 */
export function discoverTablePlatformMigrationFiles(migrationsDir: string): string[] {
  return fs
    .readdirSync(migrationsDir)
    .filter((f: string) => MIGRATION_PATTERN.test(f))
    .sort(compareMigrationFilenames);
}

/**
 * Run Table Platform migrations (server/migrations/7*.sql).
 * Tracks executed migrations in tp_migration_history to ensure idempotency.
 * Each migration runs inside its own transaction.
 * PostgreSQL only — SQLite does not support the table platform.
 */
async function runTablePlatformMigrations(db: any): Promise<void> {
  const TAG = '[TP-Migrations]';
  const candidateDirs = [
    path.resolve(__dirname_esm, '../../migrations'),
    path.resolve(__dirname_esm, '../../../migrations'),
    path.resolve(process.cwd(), 'migrations'),
    path.resolve(process.cwd(), 'server/migrations'),
  ];

  // 1. Ensure migration tracking table exists
  await db.query(`
    CREATE TABLE IF NOT EXISTS tp_migration_history (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      checksum TEXT,
      duration_ms INTEGER
    )
  `);

  // 2. Discover migration files
  const migrationsDir = candidateDirs.find((dir) => fs.existsSync(dir));
  if (!migrationsDir) {
    logger.warn(`${TAG} Migrations directory not found: ${candidateDirs.join(', ')}`);
    return;
  }

  const allFiles = discoverTablePlatformMigrationFiles(migrationsDir);

  if (allFiles.length === 0) {
    logger.info(`${TAG} No migration files found`);
    return;
  }

  logger.info(`${TAG} Found ${allFiles.length} table platform migration files`);

  // 3. Get already-executed migrations
  const executed = await db.query('SELECT filename FROM tp_migration_history ORDER BY filename');
  const executedSet = new Set((executed.rows || []).map((r: any) => r.filename));

  // 4. Run pending migrations in order
  let applied = 0;
  for (const file of allFiles) {
    if (executedSet.has(file)) continue;

    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8').trim();
    if (!sql) {
      logger.warn(`${TAG} Skipping empty migration: ${file}`);
      continue;
    }

    const startMs = Date.now();
    try {
      await db.query('BEGIN');
      await db.query(sql);
      await db.query('INSERT INTO tp_migration_history (filename, duration_ms) VALUES ($1, $2)', [
        file,
        Date.now() - startMs,
      ]);
      await db.query('COMMIT');
      applied++;
      logger.info(`${TAG} ✓ ${file} (${Date.now() - startMs}ms)`);
    } catch (err: any) {
      await db.query('ROLLBACK').catch(() => {});
      const msg = err?.message || '';
      logger.error(`${TAG} ✗ ${file} failed: ${msg}`);
      throw new Error(`Table Platform migration ${file} failed: ${msg}`);
    }
  }

  if (applied > 0) {
    logger.info(`${TAG} Applied ${applied} migration(s) successfully`);
  } else {
    logger.info(`${TAG} All ${allFiles.length} migrations already applied`);
  }
}

/**
 * Initialize database schema
 * This ensures all tables are created if they don't exist
 */
export async function initializeDatabase(): Promise<{ success: boolean; message: string }> {
  try {
    logger.info('[DatabaseInitializer] Starting database initialization...');
    const skipPostgresInitInTests =
      process.env.NODE_ENV === 'test' &&
      ['true', '1', 'yes', 'on'].includes(
        String(process.env.POSTGRES_SKIP_INIT_IN_TEST || '')
          .trim()
          .toLowerCase()
      );

    if (
      process.env.MOCK_DB === 'true' ||
      (process.env.NODE_ENV === 'test' &&
        process.env.RUN_DB_TESTS !== '1' &&
        process.env.MOCK_DB !== 'false')
    ) {
      logger.info(
        '[DatabaseInitializer] MOCK_DB enabled; skipping schema initialization/verification'
      );
      return { success: true, message: 'MOCK_DB enabled; schema init skipped' };
    }

    // Get database instance
    const db = await getDatabaseAsync();
    const dbType = databaseConfig.type;

    logger.info(`[DatabaseInitializer] Database type: ${dbType}`);

    if (dbType === 'postgres' && skipPostgresInitInTests) {
      logger.warn(
        '[DatabaseInitializer] Skipping PostgreSQL schema initialization/verification in test mode (POSTGRES_SKIP_INIT_IN_TEST=1)'
      );
      return {
        success: true,
        message: 'PostgreSQL schema init skipped in test mode',
      };
    }

    // For PostgreSQL, initDb() is called automatically when pool is created
    // But we'll verify it completed successfully
    if (dbType === 'postgres') {
      // Wait a bit for initDb() to complete (it's called asynchronously in getPool)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Verify schema - but only check truly critical tables
      const verification = await verifySchema();

      // Define truly critical tables that must exist for basic functionality
      const TRULY_CRITICAL_TABLES = [
        'organizations',
        'users',
        'sessions',
        'projects',
        'tasks',
        'teams',
        'invitations',
        'notifications',
        'settings',
        'revoked_tokens',
        'refresh_tokens',
      ];

      // Filter missing tables to only truly critical ones
      const criticalMissing = verification.missing.filter((table) =>
        TRULY_CRITICAL_TABLES.includes(table)
      );

      if (criticalMissing.length > 0) {
        logger.error(
          `[DatabaseInitializer] Missing CRITICAL tables: ${criticalMissing.join(', ')}`
        );
        // Try to initialize schema manually
        logger.info('[DatabaseInitializer] Attempting to initialize schema...');
        // Note: initDb is not exported, so we'll trigger it by accessing the pool
        await db.query('SELECT 1');
        // Wait again for initDb
        await new Promise((resolve) => setTimeout(resolve, 5000));
        // Verify again
        const recheck = await verifySchema();
        const criticalMissingRecheck = recheck.missing.filter((table) =>
          TRULY_CRITICAL_TABLES.includes(table)
        );

        if (criticalMissingRecheck.length > 0) {
          return {
            success: false,
            message: `Schema initialization incomplete. Missing critical tables: ${criticalMissingRecheck.join(', ')}`,
          };
        }

        // Log non-critical missing tables as warnings, not errors
        const nonCriticalMissing = recheck.missing.filter(
          (table) => !TRULY_CRITICAL_TABLES.includes(table)
        );
        if (nonCriticalMissing.length > 0) {
          logger.warn(
            `[DatabaseInitializer] Some non-critical tables are missing (this is OK if using migrations): ${nonCriticalMissing.join(', ')}`
          );
        }
      } else if (verification.missing.length > 0) {
        // Only non-critical tables are missing - log as warning
        logger.warn(
          `[DatabaseInitializer] Some non-critical tables are missing (this is OK if using migrations): ${verification.missing.join(', ')}`
        );
      }

      if (verification.errors.length > 0) {
        logger.error(
          `[DatabaseInitializer] Schema verification errors: ${verification.errors.join(', ')}`
        );
        // Don't fail initialization for verification errors, just log them
      }

      // Auto-repair missing columns for PostgreSQL (like SQLite branch does)
      if (Object.keys(verification.missingColumns).length > 0) {
        logger.warn(
          `[DatabaseInitializer] PostgreSQL schema has missing columns, attempting self-heal: ${JSON.stringify(verification.missingColumns)}`
        );
        for (const table of Object.keys(verification.missingColumns)) {
          for (const column of verification.missingColumns[table]) {
            try {
              await db.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} TEXT`);
              logger.info(`[DatabaseInitializer] Added missing column ${table}.${column}`);
            } catch (colErr: any) {
              logger.warn(
                `[DatabaseInitializer] Failed to add column ${table}.${column}: ${colErr?.message}`
              );
            }
          }
        }
      }

      // Run Table Platform migrations (7xx SQL files)
      try {
        await runTablePlatformMigrations(db);

        // Migrations may have added columns (e.g. my_ideas.folder_id from the M2
        // 20260602 migration). getTableColumns() caches its result for the process
        // lifetime, so any snapshot taken before this point would omit the new
        // columns — making guarded writes (folder assignment) silently no-op.
        // Invalidate the cache so the first request sees the post-migration schema.
        try {
          const { clearSchemaCache } = await import('../utils/dbSchema.js');
          clearSchemaCache();
        } catch {
          /* non-fatal */
        }

        // Seed default templates after migrations succeed
        try {
          const { default: templateService } =
            await import('../services/tablePlatform/TemplateService.js');
          await templateService.seedDefaultTemplates();
        } catch (seedErr: any) {
          logger.warn(
            `[DatabaseInitializer] Template seeding failed (non-fatal): ${seedErr?.message}`
          );
        }
      } catch (tpErr: any) {
        logger.error(`[DatabaseInitializer] Table Platform migrations failed: ${tpErr?.message}`);
        throw tpErr;
      }
    } else {
      // SQLite: Check if schema exists, if not, initialize
      const verification = await verifySchema();

      if (
        !verification.valid &&
        (verification.missing.length > 0 || Object.keys(verification.missingColumns).length > 0)
      ) {
        if (verification.missing.length > 0) {
          logger.warn(
            `[DatabaseInitializer] SQLite schema incomplete. Missing tables: ${verification.missing.join(', ')}`
          );

          // Manually trigger schema initialization
          logger.info('[DatabaseInitializer] Manually triggering SQLite schema initialization...');

          // Use TEST_SCHEMA if available
          try {
            const { pathToFileURL } = await import('url');
            const schemaPath = await resolveTestSchemaPath();
            logger.info(`[DatabaseInitializer] Attempting to load TEST_SCHEMA from: ${schemaPath}`);
            const { TEST_SCHEMA } = await import(pathToFileURL(schemaPath).href);
            logger.info('[DatabaseInitializer] Using TEST_SCHEMA for initialization');
            for (const sql of TEST_SCHEMA) {
              await new Promise<void>((resolve, reject) => {
                db.run(sql, (err: Error | null) => {
                  if (err) {
                    // Some errors like "table already exists" might be okay if using IF NOT EXISTS
                    if (err.message.includes('already exists')) resolve();
                    else {
                      logger.error(
                        `[DatabaseInitializer] Error executing schema SQL: ${err.message}`
                      );
                      reject(err);
                    }
                  } else {
                    resolve();
                  }
                });
              });
            }
          } catch (schemaErr: any) {
            logger.warn(`[DatabaseInitializer] TEST_SCHEMA import failed: ${schemaErr.message}`);
            logger.warn('[DatabaseInitializer] No legacy init available; skipping fallback init');
          }
        }

        // Fix missing columns for existing tables
        if (Object.keys(verification.missingColumns).length > 0) {
          logger.warn(
            `[DatabaseInitializer] SQLite schema has missing columns: ${JSON.stringify(verification.missingColumns)}`
          );
          for (const table in verification.missingColumns) {
            for (const column of verification.missingColumns[table]) {
              logger.info(
                `[DatabaseInitializer] Attempting to add column ${column} to table ${table}`
              );
              try {
                await new Promise<void>((resolve, reject) => {
                  // Use TEXT as a safe default for most columns we are missing
                  db.run(`ALTER TABLE ${table} ADD COLUMN ${column} TEXT`, (err: Error | null) => {
                    if (err && !err.message.includes('duplicate column name')) {
                      logger.error(
                        `[DatabaseInitializer] Failed to add column ${column}: ${err.message}`
                      );
                      reject(err);
                    } else {
                      resolve();
                    }
                  });
                });
              } catch (e) {
                // Continue with other columns even if one fails
              }
            }
          }
        }
      }

      // ALWAYS attempt to run SEED statements from TEST_SCHEMA if in E2E_MODE
      // (Moved outside the 'missing tables' block to ensure seeds run on existing DBs too)
      if (process.env.E2E_MODE === 'true') {
        try {
          const { pathToFileURL } = await import('url');
          const schemaPath = await resolveTestSchemaPath();
          const { TEST_SCHEMA } = await import(pathToFileURL(schemaPath).href);
          logger.info('[DatabaseInitializer] E2E_MODE: Ensuring seed data from TEST_SCHEMA');
          for (const sql of TEST_SCHEMA) {
            if (sql.trim().toUpperCase().startsWith('INSERT')) {
              try {
                await new Promise<void>((resolve) => {
                  db.run(sql, (err: Error | null) => {
                    if (err) {
                      if (!err.message.includes('UNIQUE constraint failed')) {
                        logger.error(`[DatabaseInitializer] Seed Error: ${err.message}`);
                      }
                    }
                    resolve(); // Continue anyway
                  });
                });
              } catch (e) {
                /* ignore */
              }
            }
          }
        } catch (e) {
          /* ignore */
        }
      }

      // Ensure `security_settings` upsert semantics work on older SQLite DBs.
      // Some local DBs were created before `organization_id` became PRIMARY KEY, which breaks
      // `INSERT ... ON CONFLICT(organization_id) DO UPDATE` (conflict target requires UNIQUE/PK).
      // Fix by de-duping and adding a unique index.
      try {
        await new Promise<void>((resolve, reject) => {
          db.run(
            `
            DELETE FROM security_settings
            WHERE rowid NOT IN (
              SELECT MAX(rowid) FROM security_settings GROUP BY organization_id
            )
          `,
            (err: Error | null) => {
              if (err) return reject(err);
              resolve();
            }
          );
        });
      } catch (e: any) {
        logger.warn(
          '[DatabaseInitializer] Failed to dedupe security_settings (continuing):',
          e?.message || e
        );
      }
      try {
        await new Promise<void>((resolve, reject) => {
          db.run(
            `CREATE UNIQUE INDEX IF NOT EXISTS idx_security_settings_org ON security_settings(organization_id)`,
            (err: Error | null) => {
              if (err) return reject(err);
              resolve();
            }
          );
        });
      } catch (e: any) {
        logger.warn(
          '[DatabaseInitializer] Failed to ensure unique index on security_settings(organization_id) (continuing):',
          e?.message || e
        );
      }

      // Ensure `knowledge_docs` is compatible with ProjectController queries.
      // Older schemas omit `project_id` and `deleted_at`, which can crash `/api/projects/:id`.
      try {
        await new Promise<void>((resolve) => {
          db.run(`ALTER TABLE knowledge_docs ADD COLUMN project_id TEXT`, (err: Error | null) => {
            if (err && !err.message.includes('duplicate column name')) {
              logger.warn(
                '[DatabaseInitializer] knowledge_docs.project_id add failed:',
                err.message
              );
            }
            resolve();
          });
        });
      } catch {
        // ignore
      }
      try {
        await new Promise<void>((resolve) => {
          db.run(
            `ALTER TABLE knowledge_docs ADD COLUMN deleted_at DATETIME`,
            (err: Error | null) => {
              if (err && !err.message.includes('duplicate column name')) {
                logger.warn(
                  '[DatabaseInitializer] knowledge_docs.deleted_at add failed:',
                  err.message
                );
              }
              resolve();
            }
          );
        });
      } catch {
        // ignore
      }

      // Verify again
      const recheck = await verifySchema();
      if (!recheck.valid && recheck.missing.length > 0) {
        // Only fail hard if truly critical tables are missing.
        // Some modules (connectors/webhooks/notifications rules/etc.) are optional in local SQLite dev.
        const trulyCritical = new Set(['organizations', 'users', 'sessions', 'projects', 'tasks']);
        const criticalMissing = recheck.missing.filter((t) => trulyCritical.has(t));

        if (criticalMissing.length > 0) {
          logger.error(
            `[DatabaseInitializer] SQLite schema still incomplete after initialization. Missing CRITICAL: ${criticalMissing.join(', ')}`
          );
          return {
            success: false,
            message: `SQLite schema incomplete. Missing critical tables: ${criticalMissing.join(', ')}`,
          };
        }

        logger.warn(
          `[DatabaseInitializer] SQLite schema has non-critical gaps (startup continues). Missing: ${recheck.missing.join(', ')}`
        );
      }
    }

    // Ensure the canonical project membership tables exist (used by Initiative Team UI)
    // We do this regardless of the large "critical tables" list so the feature works on older dev DBs.
    try {
      await ensureProjectMembershipTables();
    } catch (e: any) {
      logger.warn(
        '[DatabaseInitializer] ensureProjectMembershipTables failed (continuing):',
        e?.message || e
      );
    }

    // Ensure chat conversation tables are compatible with current routes.
    try {
      await ensureChatConversationTables();
    } catch (e: any) {
      logger.warn(
        '[DatabaseInitializer] ensureChatConversationTables failed (continuing):',
        e?.message || e
      );
    }

    // Ensure imported_reports table exists (used by Report Import feature).
    try {
      await ensureImportedReportsTables();
    } catch (e: any) {
      logger.warn(
        '[DatabaseInitializer] ensureImportedReportsTables failed (continuing):',
        e?.message || e
      );
    }

    // Ensure V8 sync integrations can run against legacy integration schemas.
    try {
      await ensureIntegrationRuntimeTables();
    } catch (e: any) {
      logger.warn(
        '[DatabaseInitializer] ensureIntegrationRuntimeTables failed (continuing):',
        e?.message || e
      );
    }

    // Ensure resource/budget endpoints do not 500 on older staging schemas.
    try {
      await ensureBudgetResourceTables();
    } catch (e: any) {
      logger.warn(
        '[DatabaseInitializer] ensureBudgetResourceTables failed (continuing):',
        e?.message || e
      );
    }

    // Ensure customer success playbook endpoints do not 500 on older staging schemas.
    try {
      await ensureCustomerSuccessPlaybookTables();
    } catch (e: any) {
      logger.warn(
        '[DatabaseInitializer] ensureCustomerSuccessPlaybookTables failed (continuing):',
        e?.message || e
      );
    }

    // Ensure project AI settings table exists (AI role + regulatory mode).
    try {
      await ensureProjectAISettingsTables();
    } catch (e: any) {
      logger.warn(
        '[DatabaseInitializer] ensureProjectAISettingsTables failed (continuing):',
        e?.message || e
      );
    }

    // Ensure billing core tables exist (subscriptions is required by deploy-gate billing endpoints).
    try {
      await ensureBillingCoreTables();
    } catch (e: any) {
      logger.warn(
        '[DatabaseInitializer] ensureBillingCoreTables failed (continuing):',
        e?.message || e
      );
    }

    // Ensure Report Builder + Scheduled Reports tables exist (Reports module + recurring reports).
    try {
      await ensureReportBuilderAndSchedulingTables();
    } catch (e: any) {
      logger.warn(
        '[DatabaseInitializer] ensureReportBuilderAndSchedulingTables failed (continuing):',
        e?.message || e
      );
    }

    // Ensure initiative section types exist (Initiatives UI; avoids SQLITE_ERROR logs on fresh SQLite).
    try {
      await ensureInitiativeSectionTypesTables();
    } catch (e: any) {
      logger.warn(
        '[DatabaseInitializer] ensureInitiativeSectionTypesTables failed (continuing):',
        e?.message || e
      );
    }

    // Backfill columns missing from early migrations (sso_configurations, admin_approval_workflows, payment_methods).
    try {
      await ensureSchemaColumnGaps();
    } catch (e: any) {
      logger.warn(
        '[DatabaseInitializer] ensureSchemaColumnGaps failed (continuing):',
        e?.message || e
      );
    }

    // Final verification
    const finalVerification = await verifySchema();
    if (!finalVerification.valid) {
      const missingTables =
        finalVerification.missing.length > 0
          ? `Missing tables: ${finalVerification.missing.join(', ')}`
          : '';
      const missingCols =
        Object.keys(finalVerification.missingColumns).length > 0
          ? `Missing columns: ${Object.entries(finalVerification.missingColumns)
              .map(([table, cols]) => `${table}(${cols.join(', ')})`)
              .join(', ')}`
          : '';
      const errors =
        finalVerification.errors.length > 0 ? `Errors: ${finalVerification.errors.join(', ')}` : '';

      const parts = [missingTables, missingCols, errors].filter(Boolean);

      // Missing critical tables = hard fail; missing columns/non-critical tables = warn only
      const hasCriticalMissing =
        getMissingTrulyCriticalTables(finalVerification.missing).length > 0;
      if (hasCriticalMissing) {
        return {
          success: false,
          message: `Database schema verification failed. ${parts.join('. ')}`,
        };
      }

      // Non-critical issues: log warning but allow startup to proceed
      logger.warn(
        `[DatabaseInitializer] Schema has non-critical gaps (startup continues): ${parts.join('. ')}`
      );
    }

    logger.info('[DatabaseInitializer] Database schema verified successfully');
    return {
      success: true,
      message: 'Database initialized and verified successfully',
    };
  } catch (err: any) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error(`[DatabaseInitializer] Database initialization failed: ${error.message}`);
    return {
      success: false,
      message: `Database initialization failed: ${error.message}`,
    };
  }
}

/**
 * Verify database connection and schema integrity
 * Called periodically to ensure database is healthy
 */
export async function verifyDatabaseHealth(): Promise<boolean> {
  try {
    const db = await getDatabaseAsync();
    // Simple connection test
    await db.query('SELECT 1');

    // Verify critical tables exist
    const verification = await verifySchema();
    if (!verification.valid) {
      const criticalMissing = getMissingTrulyCriticalTables(verification.missing);
      const hasOnlyNonCriticalGaps =
        criticalMissing.length === 0 &&
        verification.errors.length === 0 &&
        Object.keys(verification.missingColumns).length === 0;

      if (hasOnlyNonCriticalGaps) {
        logger.warn(
          `[DatabaseInitializer] Schema has non-critical gaps (health remains healthy): ${verification.missing.join(', ')}`
        );
        return true;
      }

      logger.warn(
        `[DatabaseInitializer] Schema integrity check failed. Critical missing: ${criticalMissing.join(', ') || 'none'}. Missing: ${verification.missing.join(', ')}`
      );

      // Attempt to reinitialize only if truly foundational tables are missing.
      if (criticalMissing.length > 0) {
        logger.info('[DatabaseInitializer] Attempting to reinitialize missing tables...');
        const reinitResult = await initializeDatabase();
        if (!reinitResult.success) {
          logger.error(`[DatabaseInitializer] Failed to reinitialize: ${reinitResult.message}`);
          return false;
        }
        // Verify again after reinit
        const recheck = await verifySchema();
        const recheckCriticalMissing = getMissingTrulyCriticalTables(recheck.missing);
        if (recheckCriticalMissing.length > 0 || recheck.errors.length > 0) {
          logger.error(
            `[DatabaseInitializer] Schema still invalid after reinit. Critical missing: ${recheckCriticalMissing.join(', ') || 'none'}. Missing: ${recheck.missing.join(', ')}`
          );
          return false;
        }
        logger.info('[DatabaseInitializer] Schema reinitialized successfully');
      }

      if (verification.errors.length > 0) {
        logger.error(
          `[DatabaseInitializer] Schema verification errors: ${verification.errors.join(', ')}`
        );
        return false;
      }
    }

    return true;
  } catch (err: any) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error(`[DatabaseInitializer] Database health check failed: ${error.message}`);
    return false;
  }
}

export default {
  initializeDatabase,
  verifyDatabaseHealth,
  verifySchema,
};
