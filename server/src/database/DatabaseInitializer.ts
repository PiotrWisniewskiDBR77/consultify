// @ts-nocheck
/**
 * Database Initializer
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Ensures database schema is initialized and verified on startup
 * Prevents table loss by verifying schema integrity
 */

import fs from 'fs';

import { databaseConfig } from '../config/DatabaseConfig.js';
import logger from '../utils/Logger.js';
import { getDatabase, getDatabaseAsync } from './Database.js';

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
  // Dependencies API uses these columns directly in SELECT/INSERT; missing columns degrade to empty
  // arrays due to DbPromise fallback behaviour, which creates "fake green" behaviour in integration tests.
  initiatives: ['created_by', 'updated_by'],
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
  initiatives: [
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
  if (!chatProjectCols.has('description'))
    await addColumn('chat_projects', `description TEXT`);
  if (!chatProjectCols.has('color'))
    await addColumn('chat_projects', `color TEXT DEFAULT '#6366f1'`);
  if (!chatProjectCols.has('icon'))
    await addColumn('chat_projects', `icon TEXT DEFAULT 'folder'`);
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

/**
 * Initialize database schema
 * This ensures all tables are created if they don't exist
 */
export async function initializeDatabase(): Promise<{ success: boolean; message: string }> {
  try {
    logger.info('[DatabaseInitializer] Starting database initialization...');

    // Get database instance
    const db = await getDatabaseAsync();
    const dbType = databaseConfig.type;

    logger.info(`[DatabaseInitializer] Database type: ${dbType}`);

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

    // Ensure initiative section types exist (Initiatives UI; avoids SQLITE_ERROR logs on fresh SQLite).
    try {
      await ensureInitiativeSectionTypesTables();
    } catch (e: any) {
      logger.warn(
        '[DatabaseInitializer] ensureInitiativeSectionTypesTables failed (continuing):',
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
      const hasCriticalMissing = finalVerification.missing.some((t) =>
        ['organizations', 'users', 'sessions', 'projects', 'tasks'].includes(t)
      );
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
      logger.warn(
        `[DatabaseInitializer] Schema integrity check failed. Missing: ${verification.missing.join(', ')}`
      );

      // Attempt to reinitialize if tables are missing
      if (verification.missing.length > 0) {
        logger.info('[DatabaseInitializer] Attempting to reinitialize missing tables...');
        const reinitResult = await initializeDatabase();
        if (!reinitResult.success) {
          logger.error(`[DatabaseInitializer] Failed to reinitialize: ${reinitResult.message}`);
          return false;
        }
        // Verify again after reinit
        const recheck = await verifySchema();
        if (!recheck.valid) {
          logger.error(
            `[DatabaseInitializer] Schema still invalid after reinit. Missing: ${recheck.missing.join(', ')}`
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
