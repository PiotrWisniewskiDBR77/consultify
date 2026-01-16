/**
 * PostgreSQL Database Implementation
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Full TypeScript migration of database.postgres.js
 * Provides SQLite-compatible interface for PostgreSQL
 */

import { Pool, type PoolClient, type PoolConfig } from 'pg';

import databaseConfig from '../config/DatabaseConfig.js';
import logger from '../utils/Logger.js';
import type { IDatabase, QueryResult, RunResult } from './IDatabase.js';

let pool: Pool | null = null;
let readPool: Pool | null = null;
const SLOW_QUERY_THRESHOLD_MS = 1000;

function getPool(): Pool {
  if (!pool) {
    logger.info('[Postgres] Initializing connection pool...');
    // Ensure config is treated as valid PoolConfig or undefined
    const config = databaseConfig.postgres as PoolConfig | undefined;

    logger.info('[Postgres] Config:', {
      host: config?.host,
      database: config?.database,
      max: config?.max,
    });
    pool = new Pool(config);

    pool.on('error', (err: Error, _client: PoolClient) => {
      logger.error('[Postgres] Unexpected error on idle client:', err.message);
    });

    pool.on('connect', (_client: PoolClient) => {
      logger.info('[Postgres] Client connected');
    });

    // Initialize schema lazily if needed
    if (process.env.NODE_ENV !== 'test') {
      initDb()
        .then(() => {
          logger.info('[Postgres] Schema initialization completed successfully');
        })
        .catch((err: Error | null) => {
          logger.error('[Postgres] Failed to initialize database:', err);
          // In production, this is critical - log but don't crash immediately
          // The DatabaseInitializer will catch this and handle it
          if (process.env.NODE_ENV === 'production') {
            logger.error('[Postgres] CRITICAL: Schema initialization failed in production!');
          }
        });
    }
  }
  return pool;
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
    }
    return readPool;
  }

  // Fallback to primary if no read replica configured
  return getPool();
}

async function executeWithLogging<T>(
  poolFn: () => Pool,
  sql: string,
  params: unknown[],
  method: 'RUN' | 'GET' | 'ALL' | 'QUERY'
): Promise<{ rows: T[]; rowCount: number | null }> {
  const start = Date.now();
  try {
    const pool = poolFn();
    const res = await pool.query(sql, params);

    const duration = Date.now() - start;
    if (duration > SLOW_QUERY_THRESHOLD_MS) {
      logger.warn(`[Postgres] SLOW QUERY (${duration}ms) [${method}]: ${sql.substring(0, 200)}...`);
    }

    return { rows: res.rows as T[], rowCount: res.rowCount };
  } catch (err) {
    // Log query error with context
    logger.error(`[Postgres] Query Error [${method}]:`, (err as Error).message);
    logger.error(`[Postgres] Failed SQL: ${sql.substring(0, 500)}`);
    throw err;
  }
}

/**
 * Helper to convert SQLite params (?) to Postgres params ($1, $2)
 */
function adaptQuery(sql: string): string {
  let paramIndex = 1;
  // Replace ? with $1, $2, etc.
  // Also replace SQLite specific functions if possible
  let adapted = sql.replace(/\?/g, () => `$${paramIndex++}`);

  // Replace datetime('now') and datetime("now") with NOW()
  adapted = adapted.replace(/datetime\(['"]now['"]\)/g, 'NOW()');

  // Replace datetime('now', '-N days') with NOW() - INTERVAL 'N days'
  adapted = adapted.replace(
    /datetime\(['"]now['"],\s*['"]-(\d+)\s+days?['"]\)/gi,
    (_match, days) => {
      return `NOW() - INTERVAL '${days} days'`;
    }
  );

  // Replace datetime('now', '+N days') with NOW() + INTERVAL 'N days'
  adapted = adapted.replace(
    /datetime\(['"]now['"],\s*['"]\+(\d+)\s+days?['"]\)/gi,
    (_match, days) => {
      return `NOW() + INTERVAL '${days} days'`;
    }
  );

  // Replace datetime('now', '-N hours') with NOW() - INTERVAL 'N hours'
  adapted = adapted.replace(
    /datetime\(['"]now['"],\s*['"]-(\d+)\s+hours?['"]\)/gi,
    (_match, hours) => {
      return `NOW() - INTERVAL '${hours} hours'`;
    }
  );

  // Replace datetime('now', '-N days') with NOW() - INTERVAL 'N days' (without quotes around interval)
  adapted = adapted.replace(
    /datetime\(['"]now['"],\s*['"]-(\d+)\s+days?['"]\)/gi,
    (_match, days) => {
      return `NOW() - INTERVAL '${days} days'`;
    }
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

  // Replace date('now') with CURRENT_DATE
  adapted = adapted.replace(/date\(['"]now['"]\)/g, 'CURRENT_DATE');

  // Replace date(column) with column::date (PostgreSQL cast)
  adapted = adapted.replace(/date\(([^)]+)\)/g, '$1::date');

  // Replace DATETIME column type with TIMESTAMP for PostgreSQL
  adapted = adapted.replace(/\bDATETIME\b/gi, 'TIMESTAMP');

  // Replace INSERT OR REPLACE with INSERT ... ON CONFLICT DO UPDATE
  // This is complex - we'll handle common cases
  if (adapted.includes('INSERT OR REPLACE')) {
    // Extract table name and columns for basic cases
    const match = adapted.match(/INSERT\s+OR\s+REPLACE\s+INTO\s+(\w+)\s*\(([^)]+)\)/i);
    if (match) {
      const tableName = match[1];
      const columns = match[2].split(',').map((c) => c.trim());
      // Find primary key or first column as conflict target
      const conflictColumn = columns[0]; // Simplified - assumes first column is key
      adapted = adapted.replace(/INSERT\s+OR\s+REPLACE\s+INTO/i, 'INSERT INTO');
      // Add ON CONFLICT clause - this is a simplified version
      // Full implementation would need to parse VALUES and UPDATE SET properly
      adapted += ` ON CONFLICT (${conflictColumn}) DO UPDATE SET ${columns.map((col) => `${col} = EXCLUDED.${col}`).join(', ')}`;
    } else {
      // Fallback: just remove INSERT OR REPLACE and add basic ON CONFLICT
      adapted = adapted.replace(/INSERT\s+OR\s+REPLACE/i, 'INSERT');
      // Note: This won't work perfectly for all cases, but handles simple ones
    }
  }

  // Replace INSERT OR IGNORE with INSERT ... ON CONFLICT DO NOTHING
  // This is a naive regex, might need more care for specific tables involving constraints
  if (adapted.includes('INSERT OR IGNORE')) {
    adapted = adapted.replace('INSERT OR IGNORE', 'INSERT');
    adapted += ' ON CONFLICT DO NOTHING';
  }

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

    const promise = executeWithLogging<unknown>(getPool, adaptedSql, params || [], 'RUN')
      .then((res) => {
        const result: RunResult = { changes: res.rowCount || 0, lastID: undefined };
        if (callback) {
          callback.call({ changes: res.rowCount, lastID: null }, null);
        }
        return result;
      })
      .catch((err: Error | null) => {
        logger.error('[Postgres] Run Error:', err?.message, adaptedSql);
        if (callback) callback(err);
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
        // Error logged in executeWithLogging
        if (callback) callback(err, null);
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
        if (callback) callback(err, []);
        throw err;
      });

    if (callback) {
      return this;
    }
    return promise;
  }

  exec(sql: string, callback?: (err: Error | null) => void): this | Promise<void> {
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
    const promise = Promise.resolve()
      .then(() => {
        logger.info('[Postgres] Closing connection pool...');
        return pool?.end();
      })
      .then(() => {
        pool = null;
        if (readPool) {
          return readPool.end().then(() => {
            readPool = null;
          });
        }
        return Promise.resolve();
      })
      .then(() => {
        if (callback) callback(null);
      })
      .catch((err: Error | null) => {
        if (callback) callback(err);
        throw err;
      });

    if (callback) {
      return;
    }
    return promise;
  }

  async query<T = unknown>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
    const adapted = adaptQuery(text);
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

// Test connection with retry
async function testConnection(retries = 3, delay = 2000): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      logger.info(`[Postgres] Testing connection (attempt ${i + 1}/${retries})...`);
      const result = await getPool().query('SELECT NOW() as current_time');
      logger.info('[Postgres] Connection test successful:', result.rows[0]);
      return true;
    } catch (err: any) {
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
    
    // Helper function for queries that can fail gracefully (e.g., index creation on non-existent columns)
    const querySafe = async (sql: string, params?: unknown[], errorMessage?: string): Promise<boolean> => {
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

    // Knowledge Docs
    await query(`CREATE TABLE IF NOT EXISTS knowledge_docs(
                id TEXT PRIMARY KEY,
                filename TEXT,
                filepath TEXT,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);

    // Knowledge Chunks
    await query(`CREATE TABLE IF NOT EXISTS knowledge_chunks(
                id TEXT PRIMARY KEY,
                doc_id TEXT,
                content TEXT,
                chunk_index INTEGER,
                embedding TEXT,
                FOREIGN KEY(doc_id) REFERENCES knowledge_docs(id) ON DELETE CASCADE
            )`);

    // LLM Providers
    await query(`CREATE TABLE IF NOT EXISTS llm_providers(
                id TEXT PRIMARY KEY,
                name TEXT,
                provider TEXT,
                api_key TEXT,
                endpoint TEXT,
                model_id TEXT,
                cost_per_1k REAL DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                is_default INTEGER DEFAULT 0,
                visibility TEXT DEFAULT 'admin'
            )`);

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
          await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_token_hash_unique ON invitations(token_hash) WHERE token_hash IS NOT NULL`);
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
        await query(`CREATE INDEX IF NOT EXISTS idx_invitations_token_hash ON invitations(token_hash)`);
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
            start_date TIMESTAMP,
            pilot_end_date TIMESTAMP,
            end_date TIMESTAMP,
            owner_business_id TEXT,
            owner_execution_id TEXT,
            sponsor_id TEXT,
            market_context TEXT,
            problem_statement TEXT DEFAULT '',
            deliverables TEXT DEFAULT '[]',
            success_criteria TEXT DEFAULT '[]',
            scope_in TEXT DEFAULT '[]',
            scope_out TEXT DEFAULT '[]',
            key_risks TEXT DEFAULT '[]',
            report_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(owner_business_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY(owner_execution_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY(sponsor_id) REFERENCES users(id) ON DELETE SET NULL
        )`);

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

    // Subscription Plans
    await query(`CREATE TABLE IF NOT EXISTS subscription_plans(
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            price_monthly REAL NOT NULL,
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

    // Organization Billing
    await query(`CREATE TABLE IF NOT EXISTS organization_billing(
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL UNIQUE,
            subscription_plan_id TEXT,
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
            stripe_invoice_id TEXT UNIQUE,
            amount_due REAL,
            amount_paid REAL,
            currency TEXT DEFAULT 'usd',
            status TEXT,
            period_start DATE,
            period_end DATE,
            pdf_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);

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
            is_active INTEGER DEFAULT 1,
            is_default INTEGER DEFAULT 0,
            usage_count INTEGER DEFAULT 0,
            last_used_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);

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
          await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_refresh_tokens_hash_unique ON refresh_tokens(token_hash)`);
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
        await query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash)`);
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
    await query(
      `CREATE INDEX IF NOT EXISTS idx_access_requests_reviewer ON access_requests(reviewed_by)`
    );
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_access_codes_org ON access_codes(organization_id)`,
      [],
      'Skipping organization_id index on access_codes'
    );
    await query(`CREATE INDEX IF NOT EXISTS idx_access_codes_creator ON access_codes(created_by)`);
    await query(
      `CREATE INDEX IF NOT EXISTS idx_access_code_usage_code ON access_code_usage(code_id)`
    );
    await query(
      `CREATE INDEX IF NOT EXISTS idx_access_code_usage_user ON access_code_usage(user_id)`
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
    await query(`CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id)`);
    await query(
      `CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read, created_at DESC)`
    );
    await query(`CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id)`);

    // AI & Customizations
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_ai_feedback_org ON ai_feedback(organization_id)`,
      [],
      'Skipping organization_id index on ai_feedback'
    );
    await query(`CREATE INDEX IF NOT EXISTS idx_ai_feedback_user ON ai_feedback(user_id)`);
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_custom_prompts_org ON custom_prompts(organization_id)`,
      [],
      'Skipping organization_id index on custom_prompts'
    );
    await query(
      `CREATE INDEX IF NOT EXISTS idx_custom_prompts_creator ON custom_prompts(created_by)`
    );
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_webhooks_org ON webhooks(organization_id)`,
      [],
      'Skipping organization_id index on webhooks'
    );
    await query(`CREATE INDEX IF NOT EXISTS idx_webhooks_creator ON webhooks(created_by)`);

    // Core Modules
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_initiatives_org ON initiatives(organization_id)`,
      [],
      'Skipping organization_id index on initiatives'
    );
    await query(`CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc ON knowledge_chunks(doc_id)`);
    await querySafe(
      `CREATE INDEX IF NOT EXISTS idx_usage_records_org_time ON usage_records(organization_id, recorded_at)`,
      [],
      'Skipping organization_id time index on usage_records'
    );

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
