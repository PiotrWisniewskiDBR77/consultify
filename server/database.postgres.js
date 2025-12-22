const { Pool } = require('pg');
const config = require('./config/database.config');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

console.log('[Postgres] Initializing connection pool...');

const pool = new Pool(config.postgres);

pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

// Helper to convert SQLite params (?) to Postgres params ($1, $2)
function adaptQuery(sql) {
    let paramIndex = 1;
    // Replace ? with $1, $2, etc.
    // Also replace SQLite specific functions if possible
    let adapted = sql.replace(/\?/g, () => `$${paramIndex++}`);

    // Replace datetime('now') with NOW()
    adapted = adapted.replace(/datetime\('now'\)/g, "NOW()");

    // Replace INSERT OR IGNORE with INSERT ... ON CONFLICT DO NOTHING
    // This is a naive regex, might need more care for specific tables involving constraints
    if (adapted.includes('INSERT OR IGNORE')) {
        adapted = adapted.replace('INSERT OR IGNORE', 'INSERT');
        adapted += ' ON CONFLICT DO NOTHING';
    }

    return adapted;
}

const db = {
    // Mock serialize as immediate execution because pg pool handles concurrency
    serialize: (callback) => {
        if (callback) callback();
    },

    // Prepare statement mock
    prepare: (sql) => {
        const adaptedSql = adaptQuery(sql);
        return {
            run: (...args) => {
                // Last arg might be callback
                let callback = null;
                let params = args;
                if (args.length > 0 && typeof args[args.length - 1] === 'function') {
                    callback = args[args.length - 1];
                    params = args.slice(0, -1);
                }

                pool.query(adaptedSql, params)
                    .then(res => {
                        if (callback) callback.call({ changes: res.rowCount, lastID: null }, null);
                    })
                    .catch(err => {
                        console.error('[Postgres] Prepare Run Error:', err.message, adaptedSql);
                        if (callback) callback(err);
                    });
            },
            finalize: () => { }
        };
    },

    run: (sql, params, callback) => {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        params = params || [];

        const adaptedSql = adaptQuery(sql);

        pool.query(adaptedSql, params)
            .then(res => {
                // SQLite's "this" context in callback has changes and lastID
                if (callback) callback.call({ changes: res.rowCount, lastID: null }, null);
            })
            .catch(err => {
                console.error('[Postgres] Run Error:', err.message, adaptedSql);
                if (callback) callback(err);
            });
    },

    get: (sql, params, callback) => {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        params = params || [];

        const adaptedSql = adaptQuery(sql);

        pool.query(adaptedSql, params)
            .then(res => {
                if (callback) callback(null, res.rows[0]);
            })
            .catch(err => {
                console.error('[Postgres] Get Error:', err.message, adaptedSql);
                if (callback) callback(err);
            });
    },

    all: (sql, params, callback) => {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        params = params || [];

        const adaptedSql = adaptQuery(sql);

        pool.query(adaptedSql, params)
            .then(res => {
                if (callback) callback(null, res.rows);
            })
            .catch(err => {
                console.error('[Postgres] All Error:', err.message, adaptedSql);
                if (callback) callback(err);
            });
    },

    // Close pool
    close: () => {
        pool.end();
    }
};

// Initialize Database Schema
function initDb() {
    console.log('[Postgres] Checking/Initializing Schema...');

    // We use a simplified flow here compared to SQLite because strictly serialized execution 
    // of a massive list of async queries without Promises in a specific order is hard in node without async/await.
    // However, since we wrapped db.run to be promise-based under the hood (in pool), we can't just fire them all.
    // Use an async function IIFE to handle migration order.

    (async () => {
        try {
            // Organizations Table
            await query(`CREATE TABLE IF NOT EXISTS organizations (
                id TEXT PRIMARY KEY,
                name TEXT,
                plan TEXT DEFAULT 'free',
                status TEXT DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                valid_until TIMESTAMP,
                -- MFA enforcement settings (enterprise feature)
                mfa_required INTEGER DEFAULT 0,
                mfa_grace_period_days INTEGER DEFAULT 7
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

            // Add columns if missing (Postgres doesn't do IF NOT EXISTS for columns easily in one line)
            // We'll skip complex migration logic for Phase 1 and rely on CREATE TABLE IF NOT EXISTS
            // For ALTERs, we should wrap in try/catch or checks.

            // Settings (no dependencies)
            await query(`CREATE TABLE IF NOT EXISTS settings(
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);

            // Projects (must be created before sessions, which references it)
            await query(`CREATE TABLE IF NOT EXISTS projects(
                id TEXT PRIMARY KEY,
                organization_id TEXT,
                name TEXT,
                status TEXT DEFAULT 'active',
                owner_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(organization_id) REFERENCES organizations(id)
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
            await query(`CREATE TABLE IF NOT EXISTS teams (
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
            await query(`CREATE TABLE IF NOT EXISTS team_members (
                team_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                role TEXT DEFAULT 'member',
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY(team_id, user_id),
                FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )`);

            // Project Users
            await query(`CREATE TABLE IF NOT EXISTS project_users (
                project_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                role TEXT DEFAULT 'member', 
                assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY(project_id, user_id),
                FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )`);

            // Custom Statuses
            await query(`CREATE TABLE IF NOT EXISTS custom_statuses (
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
            await query(`CREATE TABLE IF NOT EXISTS tasks (
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
            await query(`CREATE TABLE IF NOT EXISTS task_comments (
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
            await query(`CREATE TABLE IF NOT EXISTS notifications (
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
            await query(`CREATE TABLE IF NOT EXISTS activity_logs (
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

            // Alter Users
            await safeRun("ALTER TABLE users ADD COLUMN token_limit INTEGER DEFAULT 100000");
            await safeRun("ALTER TABLE users ADD COLUMN token_used INTEGER DEFAULT 0");
            await safeRun("ALTER TABLE users ADD COLUMN token_reset_at TIMESTAMP");
            await safeRun("ALTER TABLE users ADD COLUMN avatar_url TEXT");

            // AI Feedback
            await query(`CREATE TABLE IF NOT EXISTS ai_feedback (
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
            await query(`CREATE TABLE IF NOT EXISTS custom_prompts (
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
            await query(`CREATE TABLE IF NOT EXISTS webhooks (
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
            await query(`CREATE TABLE IF NOT EXISTS ai_logs (
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
            await query(`CREATE TABLE IF NOT EXISTS system_prompts (
                id TEXT PRIMARY KEY,
                key TEXT UNIQUE,
                content TEXT,
                description TEXT,
                updated_by TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);

            // Seed System Prompts
            // TODO: Seeding logic

            // Feedback
            await query(`CREATE TABLE IF NOT EXISTS feedback (
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
            await query(`CREATE TABLE IF NOT EXISTS revoked_tokens (
                jti TEXT PRIMARY KEY,
                user_id TEXT,
                expires_at TIMESTAMP NOT NULL,
                revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                reason TEXT DEFAULT 'logout',
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )`);

            // Invitations
            await query(`CREATE TABLE IF NOT EXISTS invitations (
                id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL,
                email TEXT NOT NULL,
                role TEXT DEFAULT 'USER',
                token TEXT NOT NULL UNIQUE,
                status TEXT DEFAULT 'pending',
                invited_by TEXT,
                expires_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                accepted_at TIMESTAMP,
                FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                FOREIGN KEY(invited_by) REFERENCES users(id) ON DELETE SET NULL
            )`);

            // Access Requests
            await query(`CREATE TABLE IF NOT EXISTS access_requests (
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
            await query(`CREATE TABLE IF NOT EXISTS access_codes (
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
            await query(`CREATE TABLE IF NOT EXISTS access_code_usage (
                id TEXT PRIMARY KEY,
                code_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(code_id) REFERENCES access_codes(id) ON DELETE CASCADE,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )`);

            // Initiatives
            await query(`CREATE TABLE IF NOT EXISTS initiatives (
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                FOREIGN KEY(owner_business_id) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY(owner_execution_id) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY(sponsor_id) REFERENCES users(id) ON DELETE SET NULL
            )`);

            // Task Dependencies
            await query(`CREATE TABLE IF NOT EXISTS task_dependencies (
                id TEXT PRIMARY KEY,
                from_task_id TEXT NOT NULL,
                to_task_id TEXT NOT NULL,
                type TEXT DEFAULT 'hard',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(from_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                FOREIGN KEY(to_task_id) REFERENCES tasks(id) ON DELETE CASCADE
            )`);

            // Subscription Plans
            await query(`CREATE TABLE IF NOT EXISTS subscription_plans (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                price_monthly REAL NOT NULL,
                token_limit INTEGER,
                storage_limit_gb REAL,
                token_overage_rate REAL,
                storage_overage_rate REAL,
                stripe_price_id TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);

            // Organization Billing
            await query(`CREATE TABLE IF NOT EXISTS organization_billing (
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
            await query(`CREATE TABLE IF NOT EXISTS usage_records (
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
            await query(`CREATE TABLE IF NOT EXISTS usage_summaries (
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
            await query(`CREATE TABLE IF NOT EXISTS invoices (
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
            await query(`CREATE TABLE IF NOT EXISTS plan_features (
                id TEXT PRIMARY KEY,
                plan_id TEXT NOT NULL,
                feature_key TEXT NOT NULL,
                enabled INTEGER DEFAULT 1,
                limit_value INTEGER,
                FOREIGN KEY(plan_id) REFERENCES subscription_plans(id) ON DELETE CASCADE
            )`);

            // Billing Margins
            await query(`CREATE TABLE IF NOT EXISTS billing_margins (
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
            await query(`CREATE TABLE IF NOT EXISTS token_packages (
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
            await query(`CREATE TABLE IF NOT EXISTS user_token_balance (
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
            await query(`CREATE TABLE IF NOT EXISTS token_transactions (
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
            await query(`CREATE TABLE IF NOT EXISTS user_api_keys (
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

            // AI Ideas Board
            await query(`CREATE TABLE IF NOT EXISTS ai_ideas (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                title TEXT NOT NULL,
                description TEXT,
                status VARCHAR(50) DEFAULT 'new',
                priority VARCHAR(50) DEFAULT 'medium',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);

            // AI System Observations
            await query(`CREATE TABLE IF NOT EXISTS ai_observations (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                content TEXT NOT NULL,
                category VARCHAR(50),
                confidence_score REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);

            // Approval Assignments (for SLA tracking and escalation)
            await query(`CREATE TABLE IF NOT EXISTS approval_assignments (
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
            await query(`CREATE INDEX IF NOT EXISTS idx_approval_assignments_org ON approval_assignments(org_id)`);
            await query(`CREATE INDEX IF NOT EXISTS idx_approval_assignments_user ON approval_assignments(assigned_to_user_id, status)`);
            await query(`CREATE INDEX IF NOT EXISTS idx_approval_assignments_proposal ON approval_assignments(proposal_id)`);
            await query(`CREATE INDEX IF NOT EXISTS idx_approval_assignments_sla ON approval_assignments(sla_due_at, status)`);

            // MFA Attempts Table (for brute-force protection)
            await query(`CREATE TABLE IF NOT EXISTS mfa_attempts (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                attempt_type TEXT NOT NULL CHECK(attempt_type IN ('TOTP', 'BACKUP_CODE', 'SMS', 'EMAIL')),
                success INTEGER NOT NULL DEFAULT 0,
                ip_address TEXT,
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`);

            await query(`CREATE INDEX IF NOT EXISTS idx_mfa_attempts_user_time ON mfa_attempts(user_id, created_at DESC)`);
            await query(`CREATE INDEX IF NOT EXISTS idx_mfa_attempts_ip ON mfa_attempts(ip_address, created_at DESC)`);

            // Trusted Devices Table (remember this device feature)
            await query(`CREATE TABLE IF NOT EXISTS trusted_devices (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                device_fingerprint TEXT NOT NULL,
                device_name TEXT,
                last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(user_id, device_fingerprint)
            )`);

            await query(`CREATE INDEX IF NOT EXISTS idx_trusted_devices_user ON trusted_devices(user_id)`);
            await query(`CREATE INDEX IF NOT EXISTS idx_trusted_devices_fingerprint ON trusted_devices(device_fingerprint)`);

            console.log('[Postgres] Schema Check Complete.');

            // Note: Seeding is skipped in this simplified adapter for now to avoid complexity.
            // In a real Enterprise setup, use a separate seed script or migration tool.

        } catch (err) {
            console.error('[Postgres] InitDb Failed:', err);
            // Log detailed error information
            if (err.code) {
                console.error('[Postgres] Error code:', err.code);
            }
            if (err.message) {
                console.error('[Postgres] Error message:', err.message);
            }
            // Don't exit - allow app to start even if some tables fail
            // This is important for Railway where tables might already exist or be created separately
        }
    })();
}

async function query(sql, params) {
    const adapted = adaptQuery(sql);
    try {
        await pool.query(adapted, params);
    } catch (e) {
        console.error('[Postgres] Query Failed:', e.message);
        throw e;
    }
}

async function safeRun(sql) {
    try {
        await pool.query(sql);
    } catch (e) {
        // Ignore specific errors (like column exists)
    }
}

// Initialize on load
initDb();

module.exports = db;
