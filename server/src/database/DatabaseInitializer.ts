// @ts-nocheck
/**
 * Database Initializer
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Ensures database schema is initialized and verified on startup
 * Prevents table loss by verifying schema integrity
 */

import { databaseConfig } from '../config/DatabaseConfig.js';
import logger from '../utils/Logger.js';
import { getDatabase, getDatabaseAsync } from './Database.js';
// @ts-ignore - Dynamic import of legacy module
const getLegacySqlite = async () => import('../../legacy_archive/database.sqlite.js');

// ==========================================
// SCHEMA VERIFICATION
// ==========================================

/**
 * Critical tables that must exist for the application to function
 */
const CRITICAL_TABLES = [
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
  'superadmin_ai_settings',
  'organization_ai_settings',
  'user_ai_settings',
  'ai_policies',
  'initiatives',
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
];

/**
 * Critical columns that must exist in specific tables
 */
const REQUIRED_COLUMNS: Record<string, string[]> = {
  projects: ['current_phase', 'organization_id', 'owner_id', 'status', 'name'],
  users: ['organization_id', 'role', 'status', 'email'],
  organizations: ['plan', 'status', 'name'],
  tasks: ['project_id', 'organization_id', 'status', 'priority'],
  user_api_keys: [
    'scopes',
    'expires_at',
    'rate_limit_per_minute',
    'rate_limit_per_day',
    'quota_used',
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

    if (dbType === 'sqlite' && process.env.RESET_DB === 'true') {
      logger.info('[DatabaseInitializer] RESET_DB=true. Dropping all SQLite tables...');

      // Disable foreign keys during drop to avoid constraint errors
      await new Promise<void>((resolve, reject) => {
        db.run('PRAGMA foreign_keys = OFF', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const tables = await new Promise<any[]>((resolve, reject) => {
        db.all(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      for (const table of tables) {
        await new Promise<void>((resolve, reject) => {
          db.run(`DROP TABLE IF EXISTS ${table.name}`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      // Re-enable foreign keys
      await new Promise<void>((resolve, reject) => {
        db.run('PRAGMA foreign_keys = ON', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      logger.info(`[DatabaseInitializer] Dropped ${tables.length} tables.`);
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
            const path = await import('path');
            const { pathToFileURL } = await import('url');
            const schemaPath = path.resolve(process.cwd(), 'tests/utils/testSchema.js');
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
            logger.warn('[DatabaseInitializer] Falling back to legacy init');
            const sqliteModule = await getLegacySqlite();
            if (sqliteModule && sqliteModule.initDb) {
              sqliteModule.initDb(db);
              // Wait a bit for callbacks to fire
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
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
          const path = await import('path');
          const { pathToFileURL } = await import('url');
          const schemaPath = path.resolve(process.cwd(), 'tests/utils/testSchema.js');
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

      // Verify again
      const recheck = await verifySchema();
      if (!recheck.valid && recheck.missing.length > 0) {
        logger.error(
          `[DatabaseInitializer] SQLite schema still incomplete after initialization. Missing: ${recheck.missing.join(', ')}`
        );
        return {
          success: false,
          message: `SQLite schema incomplete. Missing tables: ${recheck.missing.join(', ')}`,
        };
      }
    }

    // Final verification
    const finalVerification = await verifySchema();
    if (!finalVerification.valid) {
      const missingTables = finalVerification.missing.length > 0 
        ? `Missing tables: ${finalVerification.missing.join(', ')}` 
        : '';
      const missingCols = Object.keys(finalVerification.missingColumns).length > 0
        ? `Missing columns: ${Object.entries(finalVerification.missingColumns).map(([table, cols]) => `${table}(${cols.join(', ')})`).join(', ')}`
        : '';
      const errors = finalVerification.errors.length > 0
        ? `Errors: ${finalVerification.errors.join(', ')}`
        : '';
      
      const parts = [missingTables, missingCols, errors].filter(Boolean);
      return {
        success: false,
        message: `Database schema verification failed. ${parts.join('. ')}`,
      };
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
