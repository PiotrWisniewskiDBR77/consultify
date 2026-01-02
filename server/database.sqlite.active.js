const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const dbPath = process.env.NODE_ENV === 'test'
    ? ':memory:'
    : path.resolve(__dirname, 'consultify.db');

const dbId = Math.random().toString(36).substring(7);
const db = new sqlite3.Database(dbPath, (err) => {
    console.log(`[DB:${dbId}] Initializing database at ${dbPath}`);
    if (err) {
        console.error('Error opening database', err.message);
        if (db.initReject) db.initReject(err);
    } else {
        console.log(`[DB:${dbId}] Connected to the SQLite database.`);

        // Hardening & Performance Optimization
        db.serialize(() => {
            db.run('PRAGMA journal_mode=WAL;');
            db.run('PRAGMA busy_timeout=10000;');
            db.run('PRAGMA synchronous=NORMAL;');
            console.log(`[DB:${dbId}] WAL mode, Busy Timeout (10s), and Synchronous=NORMAL enabled.`);
        });

        // POLYFILL: db.query for Postgres compatibility (used by MultiFramework services)
        db.query = function (text, params = []) {
            // 1. Convert $1, $2... to ?
            let sql = text.replace(/\$\d+/g, '?');

            // 2. Replace NOW() with datetime('now') for SQLite compatibility
            sql = sql.replace(/NOW\(\)/gi, "datetime('now')");

            // 3. Handle RETURNING clause (SQLite doesn't support it natively in standard/older versions)
            // We strip it and will try to fetch the result manually if needed
            const returningMatch = sql.match(/RETURNING\s+(\*|id|[\w,]+)/i);
            const cleanSql = sql.replace(/RETURNING\s+(\*|id|[\w,]+)/i, '');

            return new Promise((resolve, reject) => {
                const isSelect = cleanSql.trim().toUpperCase().startsWith('SELECT');

                if (isSelect) {
                    this.all(cleanSql, params, (err, rows) => {
                        if (err) return reject(err);
                        resolve({ rows: rows || [], rowCount: rows ? rows.length : 0 });
                    });
                } else {
                    // INSERT/UPDATE/DELETE
                    this.run(cleanSql, params, function (err) {
                        if (err) return reject(err);

                        // If they wanted RETURNING info
                        if (returningMatch) {
                            // Try to find the modified row.
                            // Strategy: If there's an ID in params, use it.
                            // If it is an INSERT and we have lastID, use it.

                            // Simple heuristic: check if first param is a UUID-like string and assume it's ID
                            // (Many of our services generate ID in app)
                            let idToFetch = null;
                            if (params.length > 0 && typeof params[0] === 'string' && params[0].length > 30) {
                                idToFetch = params[0];
                            } else if (this.lastID) {
                                idToFetch = this.lastID;
                            }

                            if (idToFetch) {
                                // Extract table name to select from
                                // INSERT INTO table ... or UPDATE table ...
                                const tableMatch = cleanSql.match(/(?:INSERT\s+INTO|UPDATE|FROM)\s+([a-zA-Z0-9_]+)/i);
                                if (tableMatch) {
                                    const tableName = tableMatch[1];
                                    db.get(`SELECT * FROM ${tableName} WHERE id = ?`, [idToFetch], (err, row) => {
                                        if (err) {
                                            console.warn('[DB Polyfill] Failed to fetch RETURNING row', err);
                                            resolve({ rows: [], rowCount: this.changes });
                                        } else {
                                            resolve({ rows: row ? [row] : [], rowCount: this.changes });
                                        }
                                    });
                                    return; // Async flow taken
                                }
                            }
                        }

                        // Default resolve if no returning or couldn't fetch
                        resolve({ rows: [], rowCount: this.changes });
                    });
                }
            });
        };

        initDb();
    }
});

db.initPromise = new Promise((resolve, reject) => {
    db.initResolve = resolve;
    db.initReject = reject;
});

function initDb() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS organizations (
            id TEXT PRIMARY KEY,
            name TEXT,
            plan TEXT DEFAULT 'free',
            status TEXT DEFAULT 'active',
            billing_status TEXT DEFAULT 'PENDING',
            organization_type TEXT DEFAULT 'TRIAL',
            token_balance INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            
            -- AI Governance Fields
            ai_assertiveness_level TEXT DEFAULT 'MEDIUM',
            ai_autonomy_level TEXT DEFAULT 'SUGGEST_ONLY',
            
            -- Phase E: Onboarding Context
            transformation_context TEXT DEFAULT '{}', -- JSON: role, problems, urgency, markets, etc.
            onboarding_status TEXT DEFAULT 'NOT_STARTED', -- NOT_STARTED | IN_PROGRESS | GENERATED | ACCEPTED
            onboarding_plan_snapshot TEXT, -- JSON: last generated plan
            onboarding_plan_version INTEGER DEFAULT 0,
            onboarding_accepted_at DATETIME,
            onboarding_accept_idempotency_key TEXT,
            
            -- Attribution
            attribution_data TEXT,
            
            -- Trial Fields
            trial_started_at DATETIME,
            trial_expires_at DATETIME,
            trial_extension_count INTEGER DEFAULT 0,
            trial_warning_sent_at DATETIME,
            trial_tokens_used INTEGER DEFAULT 0,
            
            created_by_user_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            valid_until DATETIME
        )`);

        // Token Transactions (Ledger)
        db.run(`CREATE TABLE IF NOT EXISTS token_transactions (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            user_id TEXT,
            type TEXT NOT NULL, -- CREDIT, DEBIT, usage, purchase
            source_type TEXT, -- PLATFORM, CHECKOUT, MANUAL
            
            tokens INTEGER NOT NULL, -- "amount" in some contexts, but service calls it "tokens"
            margin_usd REAL DEFAULT 0,
            net_revenue_usd REAL DEFAULT 0,
            
            llm_provider TEXT,
            model_used TEXT,
            description TEXT,
            metadata TEXT, -- JSON
            
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);

        // Token Ledger (Immutable ledger for AI cost tracking and metering)
        db.run(`CREATE TABLE IF NOT EXISTS token_ledger (
            id TEXT PRIMARY KEY,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            organization_id TEXT NOT NULL,
            actor_user_id TEXT,
            actor_type TEXT DEFAULT 'USER' CHECK(actor_type IN ('USER', 'SYSTEM', 'API')),
            type TEXT NOT NULL CHECK(type IN ('CREDIT', 'DEBIT')),
            amount INTEGER NOT NULL CHECK(amount > 0),
            reason TEXT,
            ref_entity_type TEXT CHECK(ref_entity_type IN ('AI_CALL', 'PURCHASE', 'GRANT', 'TRIAL_BONUS', 'ADJUSTMENT', 'REFUND')),
            ref_entity_id TEXT,
            metadata_json TEXT,
            FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
        )`);

        // Indexes for token_ledger
        db.run(`CREATE INDEX IF NOT EXISTS idx_token_ledger_org_id ON token_ledger(organization_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_token_ledger_org_created ON token_ledger(organization_id, created_at DESC)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_token_ledger_type ON token_ledger(type)`);
        // Organization Members (RBAC)
        db.run(`CREATE TABLE IF NOT EXISTS organization_members (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'MEMBER', -- OWNER, ADMIN, MEMBER, CONSULTANT
            status TEXT DEFAULT 'ACTIVE', -- ACTIVE, INVITED, SUSPENDED
            invited_by_user_id TEXT,
            permission_scope TEXT DEFAULT '{}', -- Custom RBAC overrides
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // Consultants Profile
        db.run(`CREATE TABLE IF NOT EXISTS consultants (
            id TEXT PRIMARY KEY,
            display_name TEXT,
            status TEXT DEFAULT 'ACTIVE',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // Consultant Invites
        db.run(`CREATE TABLE IF NOT EXISTS consultant_invites (
            id TEXT PRIMARY KEY,
            consultant_id TEXT NOT NULL,
            invite_code TEXT UNIQUE NOT NULL,
            invite_type TEXT NOT NULL, -- 'LINK_TO_ORG' or 'ORG_ADD_CONSULTANT'
            organization_id TEXT, -- If specific org context
            target_email TEXT, -- If inviting specific person
            target_company_name TEXT,
            max_uses INTEGER DEFAULT 1,
            uses_count INTEGER DEFAULT 0,
            expires_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(consultant_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // Invite Usage Log
        db.run(`CREATE TABLE IF NOT EXISTS invite_usage_log (
            id TEXT PRIMARY KEY,
            invite_code TEXT NOT NULL,
            used_by_user_id TEXT,
            used_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Consultant Links
        db.run(`CREATE TABLE IF NOT EXISTS consultant_org_links (
            id TEXT PRIMARY KEY,
            consultant_id TEXT NOT NULL,
            organization_id TEXT NOT NULL,
            status TEXT DEFAULT 'ACTIVE',
            permission_scope TEXT, -- JSON
            created_by_user_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(consultant_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);

        // Users Table (Updated with organization_id)
        // We will drop the old one if it exists to ensure clean schema for this major refactor
        // In a real prod env, we would migrate. Here we wipe for simplicity as agreed.
        // ONLY drop in dev mode
        // if (process.env.NODE_ENV !== 'production') {
        //    db.run(`DROP TABLE IF EXISTS users`);
        // }
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            organization_id TEXT,
            email TEXT UNIQUE,
            password TEXT,
            first_name TEXT,
            last_name TEXT,
            name TEXT,
            role TEXT, 
            status TEXT DEFAULT 'active',
            avatar_url TEXT,
            job_title TEXT,
            timezone TEXT DEFAULT 'UTC',
            locale TEXT DEFAULT 'en',
            date_format TEXT DEFAULT 'YYYY-MM-DD',
            time_format TEXT DEFAULT '24h',
            first_day_of_week TEXT DEFAULT 'MONDAY',
            accessibility_settings TEXT, -- JSON
            notification_preferences TEXT, -- JSON
            ui_preferences TEXT, -- JSON
            linked_accounts TEXT DEFAULT '{}', -- JSON: Google, LinkedIn connections
            units TEXT DEFAULT 'metric',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME,
            FOREIGN KEY(organization_id) REFERENCES organizations(id)
        )`);

        // Refresh Tokens
        db.run(`CREATE TABLE IF NOT EXISTS refresh_tokens (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            token_hash TEXT NOT NULL,
            token_family TEXT NOT NULL,
            device_info TEXT,
            ip_address TEXT,
            user_agent TEXT,
            expires_at DATETIME NOT NULL,
            revoked_at DATETIME,
            revoked_reason TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // Revoked Tokens (Blacklist)
        db.run(`CREATE TABLE IF NOT EXISTS revoked_tokens (
            jti TEXT PRIMARY KEY,
            user_id TEXT,
            reason TEXT,
            revoked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME, -- When the token would have expired anyway
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // Organization Context (for Reports)
        db.run(`CREATE TABLE IF NOT EXISTS organization_context (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            goals JSON,
            digital_maturity TEXT,
            transformation_type TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);

        // Management Reports
        db.run(`CREATE TABLE IF NOT EXISTS management_reports (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            project_id TEXT,
            report_type TEXT NOT NULL CHECK (report_type IN ('TEAM_MEETING', 'STEERING_COMMITTEE')),
            scope TEXT NOT NULL DEFAULT 'PROJECT' CHECK (scope IN ('PROJECT', 'PORTFOLIO')),
            title TEXT NOT NULL,
            period_start DATE,
            period_end DATE,
            status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'FINAL', 'ARCHIVED')),
            generated_by TEXT NOT NULL,
            content JSON,
            ai_narrative TEXT,
            ai_warnings JSON,
            pdf_path TEXT,
            pptx_path TEXT,
            share_token TEXT UNIQUE,
            share_expires_at DATETIME,
            pmo_domain TEXT DEFAULT 'PERFORMANCE_MONITORING',
            iso21500_mapping TEXT DEFAULT 'Project Performance Measurement (Clause 4.4.22)',
            pmbok_mapping TEXT DEFAULT 'Measurement Performance Domain',
            prince2_mapping TEXT DEFAULT 'Highlight Report / Progress Theme',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS management_report_sections (
            id TEXT PRIMARY KEY,
            report_id TEXT NOT NULL,
            section_type TEXT NOT NULL,
            section_order INTEGER DEFAULT 0,
            title TEXT,
            content JSON,
            is_included BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (report_id) REFERENCES management_reports(id) ON DELETE CASCADE
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS management_report_recipients (
            id TEXT PRIMARY KEY,
            report_id TEXT NOT NULL,
            user_id TEXT,
            email TEXT,
            sent_at DATETIME,
            opened_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (report_id) REFERENCES management_reports(id) ON DELETE CASCADE
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS management_report_schedules (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            project_id TEXT,
            report_type TEXT NOT NULL CHECK (report_type IN ('TEAM_MEETING', 'STEERING_COMMITTEE')),
            scope TEXT NOT NULL DEFAULT 'PROJECT' CHECK (scope IN ('PROJECT', 'PORTFOLIO')),
            frequency TEXT NOT NULL CHECK (frequency IN ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY')),
            day_of_week INTEGER,
            day_of_month INTEGER,
            time_of_day TEXT DEFAULT '09:00',
            timezone TEXT DEFAULT 'Europe/Warsaw',
            is_active BOOLEAN DEFAULT 1,
            last_generated_at DATETIME,
            next_scheduled_at DATETIME,
            recipients JSON,
            created_by TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);

        // ============================================
        // Economics / Digitization Module Tables
        // ============================================

        // Digitization Analyses
        db.run(`CREATE TABLE IF NOT EXISTS digitization_analyses (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed')),
            project_id TEXT,
            organization_id INTEGER NOT NULL,
            created_by TEXT NOT NULL,
            overall_score REAL,
            completion_percent INTEGER DEFAULT 0,
            axis_scores TEXT, -- JSON
            imported_from TEXT,
            import_date DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (organization_id) REFERENCES organizations(id)
        )`);

        // Axis Scores
        db.run(`CREATE TABLE IF NOT EXISTS digitization_axis_scores (
            id TEXT PRIMARY KEY,
            analysis_id TEXT NOT NULL,
            axis_id TEXT NOT NULL,
            area_id TEXT NOT NULL,
            area_code TEXT,
            current_level INTEGER CHECK (current_level >= 0 AND current_level <= 7),
            target_level INTEGER CHECK (target_level >= 0 AND target_level <= 7),
            notes TEXT,
            evidence TEXT, -- JSON
            justification TEXT,
            assessed_by TEXT,
            assessed_at DATETIME,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (analysis_id) REFERENCES digitization_analyses(id) ON DELETE CASCADE,
            UNIQUE(analysis_id, axis_id, area_id)
        )`);

        // Comparisons
        db.run(`CREATE TABLE IF NOT EXISTS digitization_comparisons (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            organization_id INTEGER NOT NULL,
            created_by TEXT NOT NULL,
            analysis_ids TEXT NOT NULL, -- JSON
            comparison_type TEXT DEFAULT 'side_by_side',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (organization_id) REFERENCES organizations(id)
        )`);

        // Exports History
        db.run(`CREATE TABLE IF NOT EXISTS digitization_exports (
            id TEXT PRIMARY KEY,
            analysis_id TEXT NOT NULL,
            export_type TEXT NOT NULL,
            export_filename TEXT,
            export_path TEXT,
            exported_by TEXT NOT NULL,
            exported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (analysis_id) REFERENCES digitization_analyses(id) ON DELETE CASCADE
        )`);

        // Analysis Versions
        db.run(`CREATE TABLE IF NOT EXISTS digitization_analysis_versions (
            id TEXT PRIMARY KEY,
            analysis_id TEXT NOT NULL,
            version_number INTEGER NOT NULL,
            version_name TEXT,
            version_type TEXT DEFAULT 'snapshot',
            snapshot_data TEXT NOT NULL,
            created_by TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            notes TEXT,
            overall_score REAL,
            completion_percent INTEGER,
            FOREIGN KEY (analysis_id) REFERENCES digitization_analyses(id) ON DELETE CASCADE,
            UNIQUE(analysis_id, version_number)
        )`);

        // Evidence
        db.run(`CREATE TABLE IF NOT EXISTS digitization_evidence (
            id TEXT PRIMARY KEY,
            score_id TEXT NOT NULL,
            evidence_type TEXT DEFAULT 'note',
            title TEXT NOT NULL,
            content TEXT,
            file_path TEXT,
            file_size INTEGER,
            mime_type TEXT,
            uploaded_by TEXT NOT NULL,
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            category TEXT,
            is_verified BOOLEAN DEFAULT 0,
            verified_by TEXT,
            verified_at DATETIME,
            FOREIGN KEY (score_id) REFERENCES digitization_axis_scores(id) ON DELETE CASCADE
        )`);

        // AI Recommendations
        db.run(`CREATE TABLE IF NOT EXISTS digitization_ai_recommendations (
            id TEXT PRIMARY KEY,
            analysis_id TEXT NOT NULL,
            axis_id TEXT,
            area_id TEXT,
            recommendation_type TEXT,
            title TEXT NOT NULL,
            description TEXT,
            rationale TEXT,
            estimated_effort TEXT,
            estimated_impact TEXT,
            priority_score INTEGER,
            status TEXT DEFAULT 'suggested',
            accepted_by TEXT,
            accepted_at DATETIME,
            initiative_id TEXT,
            ai_model TEXT,
            ai_confidence REAL,
            generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (analysis_id) REFERENCES digitization_analyses(id) ON DELETE CASCADE
        )`);

        db.run(`ALTER TABLE users ADD COLUMN avatar_url TEXT`, (err) => {
            // Ignore error if column exists
        });

        // Migration: OAuth provider columns
        db.run(`ALTER TABLE users ADD COLUMN auth_provider TEXT DEFAULT 'local'`, (err) => {
            // Ignore error if column exists - values: 'local', 'google', 'linkedin'
        });
        db.run(`ALTER TABLE users ADD COLUMN google_id TEXT`, (err) => {
            // Ignore error if column exists - Google OAuth sub ID
        });
        db.run(`ALTER TABLE users ADD COLUMN linkedin_id TEXT`, (err) => {
            // Ignore error if column exists - LinkedIn OAuth ID
        });
        db.run(`ALTER TABLE users ADD COLUMN user_journey_state TEXT DEFAULT 'ANON'`, (err) => {
            // Ignore
        });
        db.run(`ALTER TABLE users ADD COLUMN current_phase TEXT DEFAULT 'A'`, (err) => {
            // Ignore
        });
        db.run(`ALTER TABLE users ADD COLUMN journey_state_changed_at DATETIME`, (err) => {
            // Ignore
        });
        db.run(`ALTER TABLE users ADD COLUMN phase_changed_at DATETIME`, (err) => {
            // Ignore
        });
        // Migration: MFA columns
        db.run(`ALTER TABLE users ADD COLUMN mfa_enabled INTEGER DEFAULT 0`, (err) => {
            // Ignore error if column exists
        });
        db.run(`ALTER TABLE users ADD COLUMN mfa_secret TEXT`, (err) => {
            // Ignore error if column exists
        });
        db.run(`ALTER TABLE users ADD COLUMN mfa_verified_at DATETIME`, (err) => {
            // Ignore error if column exists
        });

        // Migration: Email Verification columns
        db.run(`ALTER TABLE users ADD COLUMN email_verification_token TEXT`, (err) => {
            // Ignore error if column exists
        });
        db.run(`ALTER TABLE users ADD COLUMN email_verification_expires_at DATETIME`, (err) => {
            // Ignore error if column exists
        });
        db.run(`ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0`, (err) => {
            // Ignore error if column exists
        });
        // Migration: Organization MFA settings
        db.run(`ALTER TABLE organizations ADD COLUMN mfa_required INTEGER DEFAULT 0`, (err) => {
            // Ignore error if column exists
        });
        db.run(`ALTER TABLE organizations ADD COLUMN mfa_grace_period_days INTEGER DEFAULT 0`, (err) => {
            // Ignore error if column exists
        });
        // Migration: Activity logs correlation_id
        db.run(`ALTER TABLE activity_logs ADD COLUMN correlation_id TEXT`, (err) => {
            // Ignore error if column exists
        });

        // Sessions Table (Linked to user_id and optionally project_id)
        db.run(`CREATE TABLE IF NOT EXISTS sessions(
                                                        id TEXT PRIMARY KEY,
                                                        user_id TEXT,
                                                        project_id TEXT,
                                                        type TEXT,
                                                        data TEXT,
                                                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                                        FOREIGN KEY(user_id) REFERENCES users(id),
                                                        FOREIGN KEY(project_id) REFERENCES projects(id)
                                                    )`);

        // Settings Table (Global/System settings)
        db.run(`CREATE TABLE IF NOT EXISTS settings(
                                                        key TEXT PRIMARY KEY,
                                                        value TEXT,
                                                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                                                    )`);

        // Projects Table
        db.run(`CREATE TABLE IF NOT EXISTS projects(
                                                        id TEXT PRIMARY KEY,
                                                        organization_id TEXT,
                                                        name TEXT,
                                                        status TEXT DEFAULT 'active',
                                                        owner_id TEXT,
                                                        sponsor_id TEXT,
                                                        governance_model TEXT DEFAULT 'STANDARD',
                                                        context_data TEXT DEFAULT '{}',
                                                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                                        FOREIGN KEY(organization_id) REFERENCES organizations(id)
                                                    )`, (err) => {
            if (err) console.error('Error creating projects table:', err.message);
            else console.log('Projects table created successfully (or already exists).');
        });

        // ==========================================
        // PHASE 2: DRD STRATEGY EXECUTION ENGINE
        // ==========================================

        // Initiatves Table (Master Object)
        db.run(`CREATE TABLE IF NOT EXISTS initiatives (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            org_id TEXT, -- Legacy alias for reports compatibility
            project_id TEXT, -- Optional link to legacy project container
            title TEXT NOT NULL,
            axis TEXT, -- 1-6 or 7 (AI)
            area TEXT,
            summary TEXT,
            hypothesis TEXT,
            status TEXT DEFAULT 'step3', -- step3_list, step4_pilot, step5_full
            current_stage TEXT,
            business_value TEXT, -- High/Med/Low
            competencies_required TEXT, -- JSON array
            cost_capex REAL,
            cost_opex REAL,
            expected_roi REAL,
            social_impact TEXT,
            start_date DATETIME,
            pilot_end_date DATETIME,
            end_date DATETIME,
            due_date DATETIME,
            owner_business_id TEXT,
            owner_id TEXT, -- Legacy alias
            owner_execution_id TEXT,
            sponsor_id TEXT,
            market_context TEXT, -- AI-gathered research data
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(owner_business_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY(owner_execution_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY(sponsor_id) REFERENCES users(id) ON DELETE SET NULL
        )`);

        // Migration: Add context_data if missing
        db.run(`ALTER TABLE projects ADD COLUMN context_data TEXT DEFAULT '{}'`, (err) => {
            // Ignore if exists
        });
        db.run(`ALTER TABLE projects ADD COLUMN sponsor_id TEXT`, (err) => {
            // Ignore if exists
        });
        db.run(`ALTER TABLE projects ADD COLUMN governance_model TEXT DEFAULT 'STANDARD'`, (err) => {
            // Ignore if exists
        });

        // Initiative Templates
        db.run(`CREATE TABLE IF NOT EXISTS initiative_templates (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT,
            description TEXT,
            applicable_axes TEXT, -- JSON array
            template_data TEXT, -- JSON structure
            is_public INTEGER DEFAULT 0,
            organization_id TEXT,
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
        )`);

        // Knowledge Base: Documents
        db.run(`CREATE TABLE IF NOT EXISTS knowledge_docs(
            id TEXT PRIMARY KEY,
            organization_id TEXT,
            filename TEXT,
            file_type TEXT,
            file_size INTEGER,
            content TEXT,
            filepath TEXT,
            status TEXT DEFAULT 'pending', --pending, indexed, error
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);

        // Knowledge Base: Chunks (Simple Text Search / Vector Store Placeholder)
        db.run(`CREATE TABLE IF NOT EXISTS knowledge_chunks(
            id TEXT PRIMARY KEY,
            doc_id TEXT,
            content TEXT,
            chunk_index INTEGER,
            embedding TEXT, --JSON string or blob if we add vectors later
            metadata TEXT, -- JSON Object
            FOREIGN KEY(doc_id) REFERENCES knowledge_docs(id) ON DELETE CASCADE
        )`);

        // Documents Library (Project + User scope separation)
        db.run(`CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            project_id TEXT,
            owner_id TEXT NOT NULL,
            scope TEXT NOT NULL DEFAULT 'user' CHECK(scope IN ('project', 'user')),
            filename TEXT NOT NULL,
            original_name TEXT,
            file_type TEXT,
            file_size INTEGER,
            mime_type TEXT,
            filepath TEXT,
            description TEXT,
            tags TEXT,
            status TEXT DEFAULT 'active' CHECK(status IN ('active', 'archived', 'deleted')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL,
            FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // Indexes for documents
        db.run(`CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id, scope)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id, scope)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_documents_org ON documents(organization_id)`);

        // LLM Providers
        db.run(`CREATE TABLE IF NOT EXISTS llm_providers(
                                                            id TEXT PRIMARY KEY,
                                                            name TEXT,
                                                            provider TEXT, --openai, anthropic, google, local
            api_key TEXT,
                                                            endpoint TEXT,
                                                            model_id TEXT,
                                                            cost_per_1k REAL DEFAULT 0,
                                                            is_active INTEGER DEFAULT 1,
                                                            is_default INTEGER DEFAULT 0,
                                                            visibility TEXT DEFAULT 'admin' -- admin, public, beta
                                                        )`);

        // ==========================================
        // NEW LLM DELIVERY SYSTEM - Dynamic Tier Assignments
        // ==========================================

        // Model-to-Tier Assignments (many-to-many: one model can be in multiple tiers)
        db.run(`CREATE TABLE IF NOT EXISTS model_tier_assignments (
            id TEXT PRIMARY KEY,
            provider_id TEXT NOT NULL,
            tier TEXT NOT NULL CHECK(tier IN ('BUDGET', 'STANDARD', 'PREMIUM', 'REASONING')),
            priority INTEGER DEFAULT 0, -- Lower = higher priority within tier
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(provider_id) REFERENCES llm_providers(id) ON DELETE CASCADE,
            UNIQUE(provider_id, tier)
        )`);

        // Index for fast tier lookups
        db.run(`CREATE INDEX IF NOT EXISTS idx_model_tier_active ON model_tier_assignments(tier, is_active, priority)`);

        // Organization Provider Settings (which providers org admin has enabled)
        db.run(`CREATE TABLE IF NOT EXISTS organization_provider_settings (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            provider_id TEXT NOT NULL,
            is_enabled INTEGER DEFAULT 1,
            custom_priority INTEGER, -- Org-specific priority override
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(provider_id) REFERENCES llm_providers(id) ON DELETE CASCADE,
            UNIQUE(organization_id, provider_id)
        )`);

        // Index for org lookups
        db.run(`CREATE INDEX IF NOT EXISTS idx_org_provider_settings ON organization_provider_settings(organization_id, is_enabled)`);

        // Round-robin state tracking per tier per organization
        db.run(`CREATE TABLE IF NOT EXISTS tier_round_robin_state (
            id TEXT PRIMARY KEY,
            organization_id TEXT,
            tier TEXT NOT NULL,
            last_provider_id TEXT,
            last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(organization_id, tier)
        )`);

        // Add tier column to llm_providers if not exists (for backwards compatibility)
        db.run(`ALTER TABLE llm_providers ADD COLUMN tier TEXT DEFAULT 'STANDARD'`, (err) => {
            // Ignore if exists
        });

        // Add priority column to llm_providers if not exists
        db.run(`ALTER TABLE llm_providers ADD COLUMN priority INTEGER DEFAULT 0`, (err) => {
            // Ignore if exists
        });

        // Add health_status column to llm_providers if not exists
        db.run(`ALTER TABLE llm_providers ADD COLUMN health_status TEXT DEFAULT 'unknown'`, (err) => {
            // Ignore if exists
        });

        // Add last_health_check column to llm_providers if not exists
        db.run(`ALTER TABLE llm_providers ADD COLUMN last_health_check DATETIME`, (err) => {
            // Ignore if exists
        });

        // AI System Prompts (Governance Hub)
        db.run(`CREATE TABLE IF NOT EXISTS ai_system_prompts (
            id TEXT PRIMARY KEY,
            key TEXT UNIQUE NOT NULL, -- e.g. INITIATIVE_GENERATOR
            description TEXT,
            content TEXT NOT NULL,
            context_config TEXT DEFAULT '{}', -- JSON: { include_project_context: true, ... }
            is_active INTEGER DEFAULT 1,
            version INTEGER DEFAULT 1,
            updated_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL
        )`);

        // AI Conversation History (Persistent Session Layer 1)
        db.run(`CREATE TABLE IF NOT EXISTS conversation_history (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            user_id TEXT,
            role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
            content TEXT NOT NULL,
            tokens INTEGER,
            metadata TEXT, -- JSON for extra data (timestamps, citations, relevance scores)
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_conv_hist_user_created ON conversation_history(user_id, created_at DESC)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_conv_hist_id_created ON conversation_history(conversation_id, created_at)`);

        // ==========================================
        // PHASE 1: CORE INFRASTRUCTURE TABLES
        // ==========================================

        // Teams Table
        db.run(`CREATE TABLE IF NOT EXISTS teams (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            lead_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(lead_id) REFERENCES users(id) ON DELETE SET NULL
        )`);

        // Team Members Junction Table
        db.run(`CREATE TABLE IF NOT EXISTS team_members (
            team_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            role TEXT DEFAULT 'member', -- member, lead
            joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY(team_id, user_id),
            FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // Project Users Junction Table (for visibility control)
        db.run(`CREATE TABLE IF NOT EXISTS project_users (
            project_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            role TEXT DEFAULT 'member', -- owner, admin, member, viewer
            assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY(project_id, user_id),
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // Custom Workflow Statuses per Organization
        db.run(`CREATE TABLE IF NOT EXISTS custom_statuses (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            name TEXT NOT NULL,
            color TEXT DEFAULT '#6B7280',
            sort_order INTEGER DEFAULT 0,
            is_default INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);

        // Tasks Table (Full Task Module)
        db.run(`CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            project_id TEXT,
            organization_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'todo', -- todo, in_progress, review, done, blocked, on_hold
            priority TEXT DEFAULT 'medium', -- low, medium, high, urgent
            assignee_id TEXT,
            reporter_id TEXT,
            due_date DATETIME,
            sla_due_at DATETIME,
            sla_hours REAL,
            estimated_hours REAL,
            checklist TEXT, -- JSON array of {id, text, completed}
            attachments TEXT, -- JSON array of {id, name, url}
            tags TEXT, -- JSON array of strings
            custom_status_id TEXT,
            escalation_level INTEGER DEFAULT 0,
            escalated_to_id TEXT,
            last_escalated_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME,
            
            -- DRD Strategic Execution Fields
            task_type TEXT DEFAULT 'execution', -- ANALYSIS, DESIGN, BUILD...
            budget_allocated REAL DEFAULT 0,
            budget_spent REAL DEFAULT 0,
            risk_rating TEXT DEFAULT 'low',
            acceptance_criteria TEXT DEFAULT '',
            blocking_issues TEXT DEFAULT '',
            step_phase TEXT DEFAULT 'design',
            initiative_id TEXT,
            why TEXT DEFAULT '',
            expected_outcome TEXT DEFAULT '',
            decision_impact TEXT DEFAULT '{}',
            evidence_required TEXT DEFAULT '[]',
            evidence_items TEXT DEFAULT '[]',
            strategic_contribution TEXT DEFAULT '[]',
            ai_insight TEXT DEFAULT '{}',
            change_log TEXT DEFAULT '[]',

            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(assignee_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY(reporter_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY(custom_status_id) REFERENCES custom_statuses(id) ON DELETE SET NULL
        )`);

        // Task Escalations
        db.run(`CREATE TABLE IF NOT EXISTS task_escalations (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            project_id TEXT NOT NULL,
            from_level INTEGER,
            to_level INTEGER,
            escalated_to_id TEXT,
            reason TEXT,
            trigger_type TEXT,
            resolved_at DATETIME,
            resolution_note TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        )`);

        // PMO Role Schema (Role definitions & Capabilities)
        db.run(`CREATE TABLE IF NOT EXISTS capabilities (
            id TEXT PRIMARY KEY,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            name_pl TEXT,
            category TEXT,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS pmo_role_definitions (
            id TEXT PRIMARY KEY,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            name_pl TEXT,
            level INTEGER DEFAULT 0,
            description TEXT,
            description_pl TEXT,
            reports_to_code TEXT,
            is_system INTEGER DEFAULT 1,
            is_required INTEGER DEFAULT 0,
            prince2_role TEXT,
            pmbok_role TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS pmo_role_capabilities (
            id TEXT PRIMARY KEY,
            pmo_role_id TEXT NOT NULL,
            capability_id TEXT NOT NULL,
            scope TEXT DEFAULT 'own',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(pmo_role_id) REFERENCES pmo_role_definitions(id) ON DELETE CASCADE,
            FOREIGN KEY(capability_id) REFERENCES capabilities(id) ON DELETE CASCADE,
            UNIQUE(pmo_role_id, capability_id)
        )`);

        // Workstreams (Logical grouping of initiatives)
        // ISO 21500: Work Breakdown Structure
        db.run(`CREATE TABLE IF NOT EXISTS workstreams (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            owner_id TEXT,
            status TEXT NOT NULL DEFAULT 'ACTIVE',
            color TEXT DEFAULT '#3B82F6',
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE SET NULL
        )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_workstreams_project ON workstreams(project_id)`);

        db.run(`CREATE TABLE IF NOT EXISTS project_members (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            pmo_role_id TEXT,
            project_role TEXT, -- Legacy
            allocation_percent INTEGER DEFAULT 100,
            start_date DATE,
            end_date DATE,
            responsibilities TEXT, -- JSON
            notes TEXT,
            added_by_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(pmo_role_id) REFERENCES pmo_role_definitions(id) ON DELETE SET NULL,
            UNIQUE(project_id, user_id)
        )`);

        // Extension: Workstream assignment for project members
        db.run(`ALTER TABLE project_members ADD COLUMN workstream_id TEXT`, (err) => {
            // Ignore if exists
        });

        // AI Settings 3-Tier System
        db.run(`CREATE TABLE IF NOT EXISTS superadmin_ai_settings (
            id TEXT PRIMARY KEY DEFAULT 'global',
            default_provider TEXT,
            fallback_chain TEXT DEFAULT '[]',
            circuit_breaker_config TEXT DEFAULT '{"failureThreshold": 5, "cooldownSeconds": 60}',
            global_token_limit INTEGER DEFAULT 10000000,
            global_rate_limit TEXT DEFAULT '{"requestsPerMinute": 60, "requestsPerHour": 1000}',
            max_context_window_size INTEGER DEFAULT 128000,
            max_tokens_per_request INTEGER DEFAULT 8192,
            pii_detection_sensitivity TEXT DEFAULT 'medium',
            require_encryption INTEGER DEFAULT 1,
            data_residency TEXT DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_by TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS organization_ai_settings (
            organization_id TEXT PRIMARY KEY,
            policy_level TEXT DEFAULT 'ADVISORY',
            max_policy_level TEXT DEFAULT 'ASSISTED',
            default_proactivity_mode TEXT DEFAULT 'BALANCED',
            active_roles TEXT DEFAULT '["ADVISOR"]',
            default_role TEXT DEFAULT 'ADVISOR',
            enabled_model_ids TEXT DEFAULT '[]',
            max_ai_calls_per_day INTEGER DEFAULT 100,
            max_tokens_per_month INTEGER DEFAULT 500000,
            monthly_budget_usd REAL DEFAULT 0,
            hard_limit_usd REAL DEFAULT 0,
            freeze_on_limit INTEGER DEFAULT 0,
            web_search_enabled INTEGER DEFAULT 1,
            artifacts_enabled INTEGER DEFAULT 1,
            thinking_steps_enabled INTEGER DEFAULT 1,
            focus_modes_enabled INTEGER DEFAULT 1,
            voice_enabled INTEGER DEFAULT 0,
            audit_all_requests INTEGER DEFAULT 0,
            audit_policy_changes INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_by TEXT,
            FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS user_ai_settings (
            user_id TEXT PRIMARY KEY,
            response_style TEXT DEFAULT 'balanced',
            writing_tone TEXT DEFAULT 'professional',
            preferred_language TEXT DEFAULT 'auto',
            code_explanations INTEGER DEFAULT 1,
            show_sources INTEGER DEFAULT 1,
            proactivity_mode TEXT DEFAULT 'BALANCED',
            model_temperature REAL DEFAULT 0.7,
            max_tokens INTEGER DEFAULT 4096,
            top_p REAL DEFAULT 1.0,
            frequency_penalty REAL DEFAULT 0.0,
            presence_penalty REAL DEFAULT 0.0,
            system_instructions TEXT DEFAULT '',
            visible_model_ids TEXT DEFAULT '[]',
            preferred_model_id TEXT DEFAULT NULL,
            enable_pii_redaction INTEGER DEFAULT 0,
            data_retention_policy TEXT DEFAULT 'standard',
            share_usage_analytics INTEGER DEFAULT 1,
            context_retention TEXT DEFAULT 'session',
            auto_suggestions INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS ai_settings_audit (
            id TEXT PRIMARY KEY,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            level TEXT NOT NULL,
            actor_id TEXT NOT NULL,
            actor_role TEXT NOT NULL,
            target_id TEXT NOT NULL,
            setting_key TEXT NOT NULL,
            old_value TEXT,
            new_value TEXT,
            ip_address TEXT,
            user_agent TEXT
        )`);

        // Insert default SuperAdmin settings
        db.run("INSERT OR IGNORE INTO superadmin_ai_settings (id) VALUES ('global')");

        // Migration Check: Add new columns if missing (Safe Migration)
        const migrationColumns = [
            'expected_outcome', 'decision_impact', 'evidence_required',
            'evidence_items', 'strategic_contribution', 'ai_insight', 'change_log'
        ];

        migrationColumns.forEach(col => {
            db.run(`ALTER TABLE tasks ADD COLUMN ${col} TEXT DEFAULT ''`, (err) => {
                // Ignore errors (column likely exists)
            });
        });

        // Additional task columns migration
        const extraTaskColumns = [
            { name: 'escalation_level', type: 'INTEGER DEFAULT 0' },
            { name: 'escalated_to_id', type: 'TEXT' },
            { name: 'last_escalated_at', type: 'DATETIME' },
            { name: 'sla_hours', type: 'REAL' }
        ];

        extraTaskColumns.forEach(col => {
            db.run(`ALTER TABLE tasks ADD COLUMN ${col.name} ${col.type}`, (err) => {
                // Ignore
            });
        });

        // My Work Module Fields
        const myWorkColumns = [
            'roadmap_initiative_id', 'kpi_id', 'raid_item_id'
        ];

        myWorkColumns.forEach(col => {
            db.run(`ALTER TABLE tasks ADD COLUMN ${col} TEXT DEFAULT NULL`, (err) => {
                // Ignore
            });
        });

        db.run(`ALTER TABLE tasks ADD COLUMN assignees TEXT DEFAULT '[]'`, (err) => {
            // Ignore
        });

        // Task & Execution System Fields (Added Event Map Support)
        db.run(`ALTER TABLE tasks ADD COLUMN progress INTEGER DEFAULT 0`, (err) => {
            // Ignore
        });
        db.run(`ALTER TABLE tasks ADD COLUMN blocked_reason TEXT DEFAULT ''`, (err) => {
            // Ignore
        });
        db.run(`ALTER TABLE initiatives ADD COLUMN progress INTEGER DEFAULT 0`, (err) => {
            // Ignore
        });

        // Task History (New Table)
        db.run(`CREATE TABLE IF NOT EXISTS task_history (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            field TEXT NOT NULL,
            old_value TEXT,
            new_value TEXT,
            changed_by TEXT,
            changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            FOREIGN KEY(changed_by) REFERENCES users(id) ON DELETE SET NULL
        )`);

        // Task Comments
        db.run(`CREATE TABLE IF NOT EXISTS task_comments (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);


        // ==========================================
        // PHASE 1: GOVERNANCE & RBAC (Step 1)
        // ==========================================

        // Change Requests (PMO Governance)
        db.run(`CREATE TABLE IF NOT EXISTS change_requests (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            type TEXT NOT NULL, -- SCOPE, SCHEDULE, BUDGET, GOVERNANCE
            status TEXT DEFAULT 'DRAFT', -- DRAFT, SUBMITTED, APPROVED, REJECTED, IMPLEMENTED
            risk_assessment TEXT DEFAULT 'LOW',
            rationale TEXT,
            impact_analysis TEXT DEFAULT '[]', -- JSON: [{type, id}]
            
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            approved_by TEXT,
            approved_at DATETIME,
            rejected_reason TEXT,
            
            ai_recommended_decision TEXT, -- APPROVE, REJECT
            ai_analysis TEXT,
            
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY(approved_by) REFERENCES users(id) ON DELETE SET NULL
        )`);

        // Governance Policies (Permission & AI Strictness)
        db.run(`CREATE TABLE IF NOT EXISTS governance_policies (
            id TEXT PRIMARY KEY,
            scope_id TEXT NOT NULL, -- org_id or project_id
            scope_type TEXT NOT NULL, -- ORGANIZATION or PROJECT
            
            require_cr_for TEXT DEFAULT '["SCOPE","BUDGET"]', -- JSON Array of types requiring CR
            approval_threshold_cost REAL DEFAULT 10000,
            
            ai_mode TEXT DEFAULT 'ADVISORY', -- ADVISORY, ASSISTED, PROACTIVE
            allowed_ai_actions TEXT DEFAULT '[]', -- JSON Array of Capabilities AI can execute automatically
            
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Maturity Assessments (SCMS Phase 2)
        db.run(`CREATE TABLE IF NOT EXISTS maturity_assessments (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL UNIQUE,
            axis_scores TEXT DEFAULT '[]', -- JSON Array
            completed_axes TEXT DEFAULT '[]', -- JSON Array
            overall_as_is REAL DEFAULT 0,
            overall_to_be REAL DEFAULT 0,
            overall_gap REAL DEFAULT 0,
            gap_analysis_summary TEXT,
            prioritized_gaps TEXT DEFAULT '[]',
            is_complete INTEGER DEFAULT 0,
            assessment_status TEXT DEFAULT 'IN_PROGRESS', -- IN_PROGRESS | FINALIZED
            report_id TEXT, -- Link to assessment_reports
            finalized_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(report_id) REFERENCES assessment_reports(id) ON DELETE SET NULL
        )`);

        // Assessment Reports (DRD Report Archive)
        db.run(`CREATE TABLE IF NOT EXISTS assessment_reports (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            organization_id TEXT NOT NULL,            title TEXT,
            generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            assessment_snapshot TEXT NOT NULL, -- JSON: full assessment data
            summary TEXT, -- AI-generated summary
            avg_actual REAL DEFAULT 0,
            avg_target REAL DEFAULT 0,
            gap_points INTEGER DEFAULT 0,
            created_by TEXT,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
        )`);

        // Migration: Add enhanced report management columns
        db.run(`ALTER TABLE assessment_reports ADD COLUMN category TEXT DEFAULT 'assessment'`, (err) => {
            // Ignore if exists - Report category/type
        });
        db.run(`ALTER TABLE assessment_reports ADD COLUMN tags TEXT DEFAULT '[]'`, (err) => {
            // Ignore if exists - JSON array of tags
        });
        db.run(`ALTER TABLE assessment_reports ADD COLUMN export_formats TEXT DEFAULT '["json"]'`, (err) => {
            // Ignore if exists - JSON array of available export formats
        });
        db.run(`ALTER TABLE assessment_reports ADD COLUMN is_archived INTEGER DEFAULT 0`, (err) => {
            // Ignore if exists - Soft delete flag
        });
        db.run(`ALTER TABLE assessment_reports ADD COLUMN archived_at DATETIME`, (err) => {
            // Ignore if exists - Archive timestamp
        });
        db.run(`ALTER TABLE assessment_reports ADD COLUMN notes TEXT`, (err) => {
            // Ignore if exists - User notes/annotations
        });
        db.run(`ALTER TABLE assessment_reports ADD COLUMN pdf_url TEXT`, (err) => {
            // Ignore if exists - Generated PDF file path
        });
        db.run(`ALTER TABLE assessment_reports ADD COLUMN excel_url TEXT`, (err) => {
            // Ignore if exists - Generated Excel file path
        });
        db.run(`ALTER TABLE assessment_reports ADD COLUMN custom_data TEXT DEFAULT '{}'`, (err) => {
            // Ignore if exists - Additional metadata JSON
        });

        // Migration: Add report status and content for 3-phase workflow
        db.run(`ALTER TABLE assessment_reports ADD COLUMN report_status TEXT DEFAULT 'DRAFT'`, (err) => {
            // Ignore if exists - DRAFT | FINALIZED
        });
        db.run(`ALTER TABLE assessment_reports ADD COLUMN report_content TEXT DEFAULT '{}'`, (err) => {
            // Ignore if exists - JSON: ReportContent with sections
        });
        db.run(`ALTER TABLE assessment_reports ADD COLUMN report_sections TEXT DEFAULT '[]'`, (err) => {
            // Ignore if exists - JSON array of ReportSection
        });
        db.run(`ALTER TABLE assessment_reports ADD COLUMN recommendations TEXT DEFAULT '[]'`, (err) => {
            // Ignore if exists - JSON array of Recommendation
        });
        db.run(`ALTER TABLE assessment_reports ADD COLUMN finalized_at DATETIME`, (err) => {
            // Ignore if exists - Timestamp when report was finalized
        });
        db.run(`ALTER TABLE assessment_reports ADD COLUMN based_on_id TEXT`, (err) => {
            // Ignore if exists - Link to source report if copied
            // FOREIGN KEY(based_on_id) REFERENCES assessment_reports(id)
        });
        db.run(`ALTER TABLE assessment_reports ADD COLUMN version INTEGER DEFAULT 1`, (err) => {
            // Ignore if exists - Version number for version control
        });
        db.run(`ALTER TABLE assessment_reports ADD COLUMN previous_version_id TEXT`, (err) => {
            // Ignore if exists - Link to previous version
        });

        // Migration: Add assessment status to maturity_assessments
        db.run(`ALTER TABLE maturity_assessments ADD COLUMN assessment_status TEXT DEFAULT 'IN_PROGRESS'`, (err) => {
            // Ignore if exists - IN_PROGRESS | FINALIZED
        });
        db.run(`ALTER TABLE maturity_assessments ADD COLUMN report_id TEXT`, (err) => {
            // Ignore if exists - Link to assessment_reports
        });
        db.run(`ALTER TABLE maturity_assessments ADD COLUMN finalized_at DATETIME`, (err) => {
            // Ignore if exists - Timestamp when assessment was finalized
        });

        // Report Templates
        db.run(`CREATE TABLE IF NOT EXISTS report_templates (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            template_type TEXT DEFAULT 'assessment', -- assessment, custom
            is_default INTEGER DEFAULT 0,
            is_public INTEGER DEFAULT 0, -- Available to all users in org
            created_by TEXT NOT NULL,
            sections TEXT DEFAULT '[]', -- JSON array of template sections
            styling TEXT DEFAULT '{}', -- JSON object for custom styling
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
        )`);

        // Report Comparisons (Saved comparisons)
        db.run(`CREATE TABLE IF NOT EXISTS report_comparisons (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            project_id TEXT,
            name TEXT NOT NULL,
            description TEXT,
            report_ids TEXT NOT NULL, -- JSON array of report IDs being compared
            comparison_data TEXT, -- JSON object with calculated deltas and trends
            created_by TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
        )`);

        // Report Shares (Shareable links with access control)
        db.run(`CREATE TABLE IF NOT EXISTS report_shares (
            id TEXT PRIMARY KEY,
            report_id TEXT NOT NULL,
            share_token TEXT UNIQUE NOT NULL,
            created_by TEXT NOT NULL,
            expires_at DATETIME,
            access_count INTEGER DEFAULT 0,
            max_access_count INTEGER, -- NULL = unlimited
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_accessed_at DATETIME,
            FOREIGN KEY(report_id) REFERENCES assessment_reports(id) ON DELETE CASCADE,
            FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
        )`);

        // Report Annotations (Comments and highlights)
        db.run(`CREATE TABLE IF NOT EXISTS report_annotations (
            id TEXT PRIMARY KEY,
            report_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            annotation_type TEXT DEFAULT 'comment', -- comment, highlight, note
            section TEXT, -- Which section of the report
            content TEXT NOT NULL,
            position_data TEXT, -- JSON for highlight position/coords
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(report_id) REFERENCES assessment_reports(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // ==========================================
        // DRD AUDIT REPORT SECTIONS
        // Editable report sections with AI support
        // ==========================================

        // Report Sections - Individual editable sections of a report
        db.run(`CREATE TABLE IF NOT EXISTS report_sections (
            id TEXT PRIMARY KEY,
            report_id TEXT NOT NULL,
            section_type TEXT NOT NULL,
            axis_id TEXT,
            area_id TEXT,
            title TEXT NOT NULL,
            content TEXT,
            data_snapshot TEXT,
            order_index INTEGER DEFAULT 0,
            is_ai_generated INTEGER DEFAULT 0,
            ai_model_used TEXT,
            last_edited_by TEXT,
            version INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(report_id) REFERENCES assessment_reports(id) ON DELETE CASCADE,
            FOREIGN KEY(last_edited_by) REFERENCES users(id) ON DELETE SET NULL
        )`);

        // Indexes for report_sections
        db.run(`CREATE INDEX IF NOT EXISTS idx_report_sections_report_id ON report_sections(report_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_report_sections_type ON report_sections(report_id, section_type)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_report_sections_order ON report_sections(report_id, order_index)`);

        // Section version history for tracking changes
        db.run(`CREATE TABLE IF NOT EXISTS report_section_history (
            id TEXT PRIMARY KEY,
            section_id TEXT NOT NULL,
            version INTEGER NOT NULL,
            content TEXT,
            data_snapshot TEXT,
            edited_by TEXT,
            edit_source TEXT,
            ai_prompt TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(section_id) REFERENCES report_sections(id) ON DELETE CASCADE,
            FOREIGN KEY(edited_by) REFERENCES users(id) ON DELETE SET NULL
        )`);

        // Index for version history
        db.run(`CREATE INDEX IF NOT EXISTS idx_section_history_section ON report_section_history(section_id, version)`);

        // Migration: Add template_id to assessment_reports for template-based generation
        db.run(`ALTER TABLE assessment_reports ADD COLUMN template_id TEXT`, (err) => {
            // Ignore if exists
        });

        // ==========================================
        // ASSESSMENT MODULE - PHASE 2 EXPANSION
        // Multi-Framework Assessment System
        // ==========================================

        // RapidLean Assessments
        db.run(`CREATE TABLE IF NOT EXISTS rapid_lean_assessments (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            project_id TEXT,
            
            -- Scoring (6 dimensions on 1-5 scale)
            value_stream_score REAL DEFAULT 0,
            waste_elimination_score REAL DEFAULT 0,
            flow_pull_score REAL DEFAULT 0,
            quality_source_score REAL DEFAULT 0,
            continuous_improvement_score REAL DEFAULT 0,
            visual_management_score REAL DEFAULT 0,
            
            -- Aggregated
            overall_score REAL DEFAULT 0,
            industry_benchmark REAL DEFAULT 3.3,
            
            -- AI Analysis
            ai_recommendations TEXT DEFAULT '[]',
            top_gaps TEXT DEFAULT '[]',
            
            -- Raw Data & Mapping
            questionnaire_responses TEXT DEFAULT '{}',
            drd_mapping TEXT DEFAULT '{}',
            observation_count INTEGER DEFAULT 0,
            report_generated INTEGER DEFAULT 0,
            
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS rapid_lean_observations (
            id TEXT PRIMARY KEY,
            assessment_id TEXT,
            organization_id TEXT NOT NULL,
            project_id TEXT,
            template_id TEXT NOT NULL,
            location TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            answers TEXT DEFAULT '{}',
            photos TEXT DEFAULT '[]',
            notes TEXT,
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(assessment_id) REFERENCES rapid_lean_assessments(id) ON DELETE CASCADE,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS rapid_lean_reports (
            id TEXT PRIMARY KEY,
            assessment_id TEXT NOT NULL,
            organization_id TEXT NOT NULL,
            project_id TEXT,
            report_type TEXT DEFAULT 'detailed',
            format TEXT DEFAULT 'pdf',
            file_url TEXT,
            report_data TEXT DEFAULT '{}',
            generated_by TEXT,
            generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(assessment_id) REFERENCES rapid_lean_assessments(id) ON DELETE CASCADE,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(generated_by) REFERENCES users(id) ON DELETE SET NULL
        )`);

        // External Digital Assessments (SIRI, ADMA, CMMI, etc.)
        db.run(`CREATE TABLE IF NOT EXISTS external_digital_assessments(
                    id TEXT PRIMARY KEY,
                    organization_id TEXT NOT NULL,
                    project_id TEXT,

                    --Framework Info
            framework_type TEXT NOT NULL CHECK(framework_type IN('SIRI', 'ADMA', 'CMMI', 'DIGITAL_OTHER')),
                    framework_version TEXT,
                    assessment_date DATETIME,

                    --Scores
            raw_scores_json TEXT NOT NULL,
                    normalized_scores_json TEXT,
                    mapping_confidence REAL DEFAULT 0,

                    --Mapping to DRD
            drd_axis_mapping TEXT DEFAULT '{}',
                    inconsistencies TEXT DEFAULT '[]',

                    --File Info
            file_path TEXT,
                    file_name TEXT,
                    file_size INTEGER,
                    upload_method TEXT DEFAULT 'MANUAL' CHECK(upload_method IN('PDF_PARSE', 'MANUAL', 'API')),

                    --Metadata
            uploaded_by TEXT NOT NULL,
                    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    processing_status TEXT DEFAULT 'uploaded' CHECK(processing_status IN('uploaded', 'processing', 'mapped', 'error')),
                    processing_error TEXT,

                    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
                    FOREIGN KEY(uploaded_by) REFERENCES users(id) ON DELETE SET NULL
                )`);

        // Generic Assessment Reports (ISO, Consulting, Compliance, etc.)
        db.run(`CREATE TABLE IF NOT EXISTS generic_assessment_reports(
                    id TEXT PRIMARY KEY,
                    organization_id TEXT NOT NULL,
                    project_id TEXT,

                    --Report Info
            report_type TEXT DEFAULT 'OTHER' CHECK(report_type IN('ISO_AUDIT', 'CONSULTING', 'COMPLIANCE', 'LEAN', 'OTHER')),
                    title TEXT NOT NULL,
                    consultant_name TEXT,
                    report_date DATETIME,

                    --File Info
            file_path TEXT NOT NULL,
                    file_name TEXT NOT NULL,
                    file_size INTEGER,
                    file_type TEXT,

                    --AI Processing
            ocr_text TEXT,
                    ai_summary TEXT,
                    ai_key_findings TEXT DEFAULT '[]',

                    --Organization
            tags_json TEXT DEFAULT '[]',
                    linked_initiatives TEXT DEFAULT '[]',

                    --Metadata
            uploaded_by TEXT NOT NULL,
                    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    processing_status TEXT DEFAULT 'pending' CHECK(processing_status IN('pending', 'processing', 'completed', 'error')),
                    processing_error TEXT,

                    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
                    FOREIGN KEY(uploaded_by) REFERENCES users(id) ON DELETE SET NULL
                )`);

        // Assessment Correlations (Cross-framework analysis)
        db.run(`CREATE TABLE IF NOT EXISTS assessment_correlations(
                    id TEXT PRIMARY KEY,
                    organization_id TEXT NOT NULL,
                    project_id TEXT,

                    --Source Assessment
            source_type TEXT NOT NULL,
                    source_id TEXT NOT NULL,
                    source_dimension TEXT,
                    source_score REAL,

                    --Target Assessment
            target_type TEXT NOT NULL,
                    target_id TEXT NOT NULL,
                    target_dimension TEXT,
                    target_score REAL,

                    --Correlation Analysis
            correlation_strength REAL DEFAULT 0,
                    inconsistency_flag INTEGER DEFAULT 0,
                    ai_explanation TEXT,

                    --Metadata
            detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    reviewed_by TEXT,
                    reviewed_at DATETIME,
                    resolution_notes TEXT,

                    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
                    FOREIGN KEY(reviewed_by) REFERENCES users(id) ON DELETE SET NULL
                )`);


        // Roadmap Waves (SCMS Phase 4)
        db.run(`CREATE TABLE IF NOT EXISTS roadmap_waves(
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT,
                    start_date DATETIME,
                    end_date DATETIME,
                    sort_order INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'PLANNED', --PLANNED, ACTIVE, COMPLETED
            is_baselined INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
                )`);

        // Add wave_id to initiatives
        db.run(`ALTER TABLE initiatives ADD COLUMN wave_id TEXT`, (err) => {
            // Ignore if exists
        });
        db.run(`ALTER TABLE initiatives ADD COLUMN baseline_version INTEGER DEFAULT 0`, (err) => {
            // Ignore if exists
        });

        // KPI Results (SCMS Phase 6 - Stabilization)
        db.run(`CREATE TABLE IF NOT EXISTS kpi_results(
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    initiative_id TEXT,
                    name TEXT NOT NULL,
                    baseline_value REAL DEFAULT 0,
                    target_value REAL DEFAULT 0,
                    current_value REAL DEFAULT 0,
                    unit TEXT DEFAULT 'units',
                    measurement_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
                    FOREIGN KEY(initiative_id) REFERENCES initiatives(id) ON DELETE SET NULL
                )`);

        // ==========================================
        // STEP 3: PMO OBJECT MODEL TABLES
        // ==========================================

        // Decisions (Governance Checkpoints)
        db.run(`CREATE TABLE IF NOT EXISTS decisions(
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    decision_type TEXT NOT NULL, --INITIATIVE_APPROVAL, PHASE_TRANSITION, UNBLOCK, CANCEL, OTHER
            related_object_type TEXT NOT NULL, --INITIATIVE, PHASE, ROADMAP, TASK
            related_object_id TEXT NOT NULL,
                    decision_owner_id TEXT NOT NULL,
                    status TEXT DEFAULT 'PENDING', --PENDING, APPROVED, REJECTED
            required INTEGER DEFAULT 1,
                    title TEXT NOT NULL,
                    description TEXT,
                    outcome TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    decided_at DATETIME,
                    audit_trail TEXT DEFAULT '[]', --JSON Array
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
                    FOREIGN KEY(decision_owner_id) REFERENCES users(id) ON DELETE SET NULL
                )`);

        // Initiative Dependencies
        db.run(`CREATE TABLE IF NOT EXISTS initiative_dependencies(
            id TEXT PRIMARY KEY,
            from_initiative_id TEXT NOT NULL, --Must complete first
            to_initiative_id TEXT NOT NULL, --Dependent initiative
            type TEXT DEFAULT 'FINISH_TO_START', --FINISH_TO_START, SOFT
            lag_days INTEGER DEFAULT 0,
            is_satisfied INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(from_initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE,
            FOREIGN KEY(to_initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE
        )`);

        // ==========================================
        // STEP 4: MULTI-FRAMEWORK ASSESSMENTS (New)
        // ==========================================

        db.run(`CREATE TABLE IF NOT EXISTS multi_framework_assessments (
            id TEXT PRIMARY KEY,
            project_id TEXT,
            organization_id TEXT,
            framework TEXT,
            name TEXT,
            data TEXT,
            overall_score REAL,
            category_scores TEXT,
            import_source TEXT,
            status TEXT DEFAULT 'DRAFT',
            version INTEGER DEFAULT 1,
            created_by TEXT,
            updated_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS multi_framework_assessment_versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            assessment_id TEXT,
            version INTEGER,
            data TEXT,
            overall_score REAL,
            category_scores TEXT,
            change_summary TEXT,
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS multi_framework_audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            assessment_id TEXT,
            framework TEXT,
            action TEXT,
            action_category TEXT,
            actor_id TEXT,
            actor_name TEXT,
            actor_email TEXT,
            actor_role TEXT,
            old_data TEXT,
            new_data TEXT,
            diff TEXT,
            entity_type TEXT,
            entity_id TEXT,
            entity_name TEXT,
            project_id TEXT,
            organization_id TEXT,
            ip_address TEXT,
            user_agent TEXT,
            request_id TEXT,
            notes TEXT,
            tags TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS multi_framework_audit_actions (
            code TEXT PRIMARY KEY,
            name TEXT,
            severity TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS multi_framework_assessment_reviewers (
            id TEXT PRIMARY KEY,
            assessment_id TEXT,
            user_id TEXT,
            status TEXT,
            assigned_at DATETIME,
            completed_at DATETIME
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS user_framework_roles (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            role_id TEXT,
            assigned_by TEXT,
            assigned_at DATETIME
        )`);

        // Stage Gates
        db.run(`CREATE TABLE IF NOT EXISTS stage_gates(
                        id TEXT PRIMARY KEY,
                        project_id TEXT NOT NULL,
                        gate_type TEXT NOT NULL, --READINESS_GATE, DESIGN_GATE, etc.
            from_phase TEXT NOT NULL,
                        to_phase TEXT NOT NULL,
                        status TEXT DEFAULT 'NOT_READY', --NOT_READY, READY, PASSED, FAILED
            requires_approval INTEGER DEFAULT 1,
                        evaluated_at DATETIME,
                        evaluated_by TEXT,
                        approved_at DATETIME,
                        approved_by TEXT,
                        notes TEXT,
                        completion_criteria TEXT DEFAULT '[]', --JSON Array
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
                        FOREIGN KEY(evaluated_by) REFERENCES users(id) ON DELETE SET NULL,
                        FOREIGN KEY(approved_by) REFERENCES users(id) ON DELETE SET NULL
                    )`);

        // Update initiatives table with PMO fields
        db.run(`ALTER TABLE initiatives ADD COLUMN status TEXT DEFAULT 'DRAFT'`, (err) => {
            // Ignore if exists
        });
        db.run(`ALTER TABLE initiatives ADD COLUMN blocked_reason TEXT`, (err) => {
            // Ignore if exists
        });
        db.run(`ALTER TABLE initiatives ADD COLUMN priority TEXT DEFAULT 'MEDIUM'`, (err) => {
            // Ignore if exists
        });
        db.run(`ALTER TABLE initiatives ADD COLUMN dependencies TEXT DEFAULT '[]'`, (err) => {
            // Ignore if exists
        });

        // Extension: Workstream assignment for initiatives
        db.run(`ALTER TABLE initiatives ADD COLUMN workstream_id TEXT`, (err) => {
            // Ignore if exists
        });

        // Update tasks table with PMO fields
        db.run(`ALTER TABLE tasks ADD COLUMN blocker_type TEXT`, (err) => {
            // Ignore if exists
        });

        // Extension: Workstream assignment for tasks
        db.run(`ALTER TABLE tasks ADD COLUMN workstream_id TEXT`, (err) => {
            // Ignore if exists
        });

        // Update projects table with PMO fields
        db.run(`ALTER TABLE projects ADD COLUMN current_phase TEXT DEFAULT 'Context'`, (err) => {
            // Ignore if exists
        });
        db.run(`ALTER TABLE projects ADD COLUMN phase_history TEXT DEFAULT '[]'`, (err) => {
            // Ignore if exists
        });
        db.run(`ALTER TABLE projects ADD COLUMN decision_owner_id TEXT`, (err) => {
            // Ignore if exists
        });
        db.run(`ALTER TABLE projects ADD COLUMN locations_in_scope TEXT DEFAULT '[]'`, (err) => {
            // Ignore if exists
        });
        db.run(`ALTER TABLE projects ADD COLUMN progress INTEGER DEFAULT 0`, (err) => {
            // Ignore if exists
        });

        // AI Roles Model: Project-level AI governance role (ADVISOR, MANAGER, OPERATOR)
        db.run(`ALTER TABLE projects ADD COLUMN ai_role TEXT DEFAULT 'ADVISOR'`, (err) => {
            // Ignore if exists - Default to ADVISOR (safest)
        });

        // Regulatory Mode: Strict compliance mode - AI can only advise, never execute
        // Default TRUE (1) for maximum safety in regulated environments
        db.run(`ALTER TABLE projects ADD COLUMN regulatory_mode_enabled INTEGER DEFAULT 1`, (err) => {
            // Ignore if exists - Default to enabled (safest for compliance)
        });

        // ==========================================
        // STEP 4: ROADMAP, SEQUENCING & CAPACITY TABLES
        // ==========================================

        // Roadmaps (one active per project)
        db.run(`CREATE TABLE IF NOT EXISTS roadmaps(
                        id TEXT PRIMARY KEY,
                        project_id TEXT NOT NULL,
                        name TEXT NOT NULL,
                        status TEXT DEFAULT 'DRAFT', --DRAFT, ACTIVE, BASELINED, ARCHIVED
            planned_start_date DATETIME,
                        planned_end_date DATETIME,
                        current_baseline_version INTEGER DEFAULT 0,
                        last_baselined_at DATETIME,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
                    )`);

        // Roadmap Initiatives (timeline entries)
        db.run(`CREATE TABLE IF NOT EXISTS roadmap_initiatives(
                        id TEXT PRIMARY KEY,
                        roadmap_id TEXT NOT NULL,
                        initiative_id TEXT NOT NULL,
                        planned_start_date DATETIME NOT NULL,
                        planned_end_date DATETIME NOT NULL,
                        planned_duration INTEGER DEFAULT 0, --Days
            sequence_position INTEGER DEFAULT 0,
                        actual_start_date DATETIME,
                        actual_end_date DATETIME,
                        is_milestone INTEGER DEFAULT 0,
                        is_critical_path INTEGER DEFAULT 0,
                        start_variance_days INTEGER DEFAULT 0,
                        end_variance_days INTEGER DEFAULT 0,
                        FOREIGN KEY(roadmap_id) REFERENCES roadmaps(id) ON DELETE CASCADE,
                        FOREIGN KEY(initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE
                    )`);

        // Schedule Baselines
        db.run(`CREATE TABLE IF NOT EXISTS schedule_baselines(
                        id TEXT PRIMARY KEY,
                        roadmap_id TEXT NOT NULL,
                        project_id TEXT NOT NULL,
                        version INTEGER NOT NULL,
                        initiative_snapshots TEXT NOT NULL, --JSON Array
            approved_by TEXT NOT NULL,
                        approved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        rationale TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(roadmap_id) REFERENCES roadmaps(id) ON DELETE CASCADE,
                        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
                        FOREIGN KEY(approved_by) REFERENCES users(id) ON DELETE SET NULL
                    )`);

        // User Capacity (weekly)
        db.run(`CREATE TABLE IF NOT EXISTS user_capacity(
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        project_id TEXT,
                        week_start DATETIME NOT NULL,
                        allocated_hours REAL DEFAULT 0,
                        available_hours REAL DEFAULT 40,
                        utilization_percent REAL DEFAULT 0,
                        initiative_allocations TEXT DEFAULT '[]', --JSON Array
            is_overloaded INTEGER DEFAULT 0,
                        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
                    )`);

        // Scenarios (what-if, can be non-persistent)
        db.run(`CREATE TABLE IF NOT EXISTS scenarios(
                        id TEXT PRIMARY KEY,
                        project_id TEXT NOT NULL,
                        name TEXT NOT NULL,
                        proposed_changes TEXT DEFAULT '[]', --JSON Array
            impact_analysis TEXT, --JSON Object
            created_by TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
                        FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
                    )`);

        // Add timeline fields to initiatives
        db.run(`ALTER TABLE initiatives ADD COLUMN planned_start_date DATETIME`, (err) => { });
        db.run(`ALTER TABLE initiatives ADD COLUMN planned_end_date DATETIME`, (err) => { });
        db.run(`ALTER TABLE initiatives ADD COLUMN actual_start_date DATETIME`, (err) => { });
        db.run(`ALTER TABLE initiatives ADD COLUMN actual_end_date DATETIME`, (err) => { });
        db.run(`ALTER TABLE initiatives ADD COLUMN sequence_position INTEGER DEFAULT 0`, (err) => { });
        db.run(`ALTER TABLE initiatives ADD COLUMN is_critical_path INTEGER DEFAULT 0`, (err) => { });

        // Phase E->F Linkage (Fix Pack 1)
        db.run(`ALTER TABLE initiatives ADD COLUMN created_from TEXT DEFAULT 'MANUAL'`, (err) => { });
        db.run(`ALTER TABLE initiatives ADD COLUMN created_from_plan_id TEXT`, (err) => { });

        // Assessment → Initiatives Traceability (Phase 2 Integration)
        db.run(`ALTER TABLE initiatives ADD COLUMN derived_from_assessments TEXT DEFAULT '[]'`, (err) => {
            // JSON array: [{ source: 'DRD', axis: 'dataManagement', gap: 4.5, score: 2.5 }, ...]
        });
        db.run(`ALTER TABLE initiatives ADD COLUMN gap_justification TEXT`, (err) => {
            // AI-generated explanation of why this initiative addresses the gaps
        });
        db.run(`ALTER TABLE initiatives ADD COLUMN assessment_traceability TEXT DEFAULT '{}'`, (err) => {
            // JSON object: { drd_id, lean_id, external_ids[], report_ids[], generated_at }
        });
        db.run(`ALTER TABLE initiatives ADD COLUMN report_id TEXT`, (err) => {
            // Link to assessment_reports for traceability
        });

        // ==========================================
        // STEP 5: EXECUTION CONTROL & NOTIFICATIONS
        // ==========================================

        // Notifications
        db.run(`CREATE TABLE IF NOT EXISTS notifications(
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        organization_id TEXT NOT NULL,
                        project_id TEXT,
                        type TEXT NOT NULL,
                        severity TEXT DEFAULT 'INFO', --INFO, WARNING, CRITICAL
            title TEXT NOT NULL,
                        message TEXT NOT NULL,
                        related_object_type TEXT,
                        related_object_id TEXT,
                        is_read INTEGER DEFAULT 0,
                        is_actionable INTEGER DEFAULT 0,
                        action_url TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        read_at DATETIME,
                        expires_at DATETIME,
                        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                        FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL
                    )`);

        // User Notification Settings
        db.run(`CREATE TABLE IF NOT EXISTS user_notification_settings(
                        user_id TEXT PRIMARY KEY,
                        in_app_enabled INTEGER DEFAULT 1,
                        email_enabled INTEGER DEFAULT 0,
                        mute_info INTEGER DEFAULT 0,
                        mute_warning INTEGER DEFAULT 0,
                        mute_critical INTEGER DEFAULT 0,
                        muted_types TEXT DEFAULT '[]', --JSON Array
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                    )`);

        // Escalations
        db.run(`CREATE TABLE IF NOT EXISTS escalations(
                        id TEXT PRIMARY KEY,
                        project_id TEXT NOT NULL,
                        source_type TEXT NOT NULL, --DECISION, INITIATIVE, TASK, CAPACITY
            source_id TEXT NOT NULL,
                        from_user_id TEXT,
                        to_user_id TEXT NOT NULL,
                        to_role TEXT NOT NULL,
                        reason TEXT NOT NULL,
                        trigger_type TEXT NOT NULL, --OVERDUE, STALLED, OVERLOAD, MANUAL
            days_overdue INTEGER DEFAULT 0,
                        status TEXT DEFAULT 'PENDING', --PENDING, ACKNOWLEDGED, RESOLVED
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        acknowledged_at DATETIME,
                        resolved_at DATETIME,
                        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
                        FOREIGN KEY(from_user_id) REFERENCES users(id) ON DELETE SET NULL,
                        FOREIGN KEY(to_user_id) REFERENCES users(id) ON DELETE SET NULL
                    )`);

        // ==========================================
        // STEP 6: STABILIZATION, REPORTING & ECONOMICS
        // ==========================================

        // Core Audit Events Table (RBAC + Org Context Foundation)
        db.run(`CREATE TABLE IF NOT EXISTS audit_events(
                        id TEXT PRIMARY KEY,
                        ts DATETIME DEFAULT CURRENT_TIMESTAMP,
                        actor_user_id TEXT,
                        actor_type TEXT NOT NULL DEFAULT 'USER', --USER, CONSULTANT, SYSTEM, AI
            org_id TEXT,
                        action_type TEXT NOT NULL,
                        entity_type TEXT,
                        entity_id TEXT,
                        metadata_json TEXT DEFAULT '{}',
                        ip TEXT,
                        user_agent TEXT,
                        FOREIGN KEY(actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
                        FOREIGN KEY(org_id) REFERENCES organizations(id) ON DELETE SET NULL
                    )`);

        // Indexes for audit_events (composite for efficient queries)
        db.run(`CREATE INDEX IF NOT EXISTS idx_audit_events_org_ts ON audit_events(org_id, ts)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_audit_events_actor_ts ON audit_events(actor_user_id, ts)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_audit_events_action_ts ON audit_events(action_type, ts)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events(entity_type, entity_id)`);

        // Value Hypotheses
        db.run(`CREATE TABLE IF NOT EXISTS value_hypotheses(
                        id TEXT PRIMARY KEY,
                        initiative_id TEXT NOT NULL,
                        project_id TEXT NOT NULL,
                        description TEXT NOT NULL,
                        type TEXT NOT NULL, --COST_REDUCTION, REVENUE_INCREASE, RISK_REDUCTION, EFFICIENCY, STRATEGIC_OPTION
            confidence_level TEXT DEFAULT 'MEDIUM', --LOW, MEDIUM, HIGH
            owner_id TEXT NOT NULL,
                        related_initiative_ids TEXT DEFAULT '[]', --JSON Array
            is_validated INTEGER DEFAULT 0,
                        validated_at DATETIME,
                        validated_by TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE,
                        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
                        FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE SET NULL
                    )`);

        // Financial Assumptions (light, range-based)
        db.run(`CREATE TABLE IF NOT EXISTS financial_assumptions(
                        id TEXT PRIMARY KEY,
                        value_hypothesis_id TEXT NOT NULL,
                        low_estimate REAL,
                        expected_estimate REAL,
                        high_estimate REAL,
                        currency TEXT DEFAULT 'USD',
                        timeframe TEXT DEFAULT 'per year',
                        notes TEXT,
                        is_non_binding INTEGER DEFAULT 1, --Always true
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(value_hypothesis_id) REFERENCES value_hypotheses(id) ON DELETE CASCADE
                    )`);

        // Project Closures
        db.run(`CREATE TABLE IF NOT EXISTS project_closures(
                        id TEXT PRIMARY KEY,
                        project_id TEXT NOT NULL UNIQUE,
                        closure_type TEXT NOT NULL, --COMPLETED, CANCELLED, ARCHIVED
            closure_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                        closed_by TEXT NOT NULL,
                        lessons_learned TEXT,
                        final_status TEXT,
                        total_initiatives INTEGER DEFAULT 0,
                        completed_initiatives INTEGER DEFAULT 0,
                        cancelled_initiatives INTEGER DEFAULT 0,
                        value_hypotheses_validated INTEGER DEFAULT 0,
                        value_hypotheses_total INTEGER DEFAULT 0,
                        approved_by TEXT,
                        approved_at DATETIME,
                        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
                        FOREIGN KEY(closed_by) REFERENCES users(id) ON DELETE SET NULL,
                        FOREIGN KEY(approved_by) REFERENCES users(id) ON DELETE SET NULL
                    )`);

        // Add stabilization_status to initiatives
        db.run(`ALTER TABLE initiatives ADD COLUMN stabilization_status TEXT DEFAULT 'NOT_APPLICABLE'`, (err) => { });

        // Add project status for closure
        db.run(`ALTER TABLE projects ADD COLUMN is_closed INTEGER DEFAULT 0`, (err) => { });
        db.run(`ALTER TABLE projects ADD COLUMN closed_at DATETIME`, (err) => { });

        // Activity Logs (Audit Trail)
        db.run(`CREATE TABLE IF NOT EXISTS activity_logs(
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        user_id TEXT,
                        action TEXT NOT NULL, --created, updated, deleted, status_changed, assigned, etc.
            entity_type TEXT NOT NULL, --task, project, user, team, etc.
            entity_id TEXT,
                        entity_name TEXT,
                        old_value TEXT, --JSON
            new_value TEXT, --JSON
            ip_address TEXT,
                        user_agent TEXT,
                        correlation_id TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
                    )`);

        // ==========================================
        // META-PMO FRAMEWORK: DOMAIN REGISTRY & AUDIT
        // Certifiable, Methodology-Neutral PMO Model
        // Standards: ISO 21500, PMI PMBOK 7th Ed, PRINCE2
        // ==========================================

        /**
         * PMO Domains Registry (Reference Table)
         * 
         * Stores the 7 certifiable PMO domains with explicit standards mapping.
         * This is a reference table - domains are seeded on initialization.
         * 
         * @mapping ISO 21500: Subject Groups
         * @mapping PMBOK 7: Performance Domains
         * @mapping PRINCE2: Themes
         */
        db.run(`CREATE TABLE IF NOT EXISTS pmo_domains(
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        description TEXT,
                        iso21500_term TEXT, --ISO 21500 equivalent terminology
            pmbok_term TEXT, --PMI PMBOK equivalent terminology
            prince2_term TEXT, --PRINCE2 equivalent terminology
            is_configurable INTEGER DEFAULT 1, --Can be enabled / disabled per project
            sort_order INTEGER DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )`);

        /**
         * Project PMO Domain Configuration
         * 
         * Junction table allowing per-project enablement of PMO domains.
         * Projects can choose which domains are active for their governance model.
         */
        db.run(`CREATE TABLE IF NOT EXISTS project_pmo_domains(
                        project_id TEXT NOT NULL,
                        domain_id TEXT NOT NULL,
                        is_enabled INTEGER DEFAULT 1,
                        enabled_by TEXT,
                        enabled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        custom_label TEXT, --Optional custom terminology for this project
            PRIMARY KEY(project_id, domain_id),
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY(domain_id) REFERENCES pmo_domains(id),
                    FOREIGN KEY(enabled_by) REFERENCES users(id) ON DELETE SET NULL
        )`);

        /**
         * PMO Audit Trail (Certification Traceability)
         * 
         * Every governance action (decision, baseline, change) is logged with:
         * - PMO domain reference
         * - Current phase reference
         * - Standards mapping (ISO/PMI/PRINCE2 terminology)
         * 
         * This enables auditors to trace:
         * - Decisions → Domain → Standard
         * - Baselines → Domain → Standard
         * - Changes → Domain → Standard
         */
        db.run(`CREATE TABLE IF NOT EXISTS pmo_audit_trail(
                        id TEXT PRIMARY KEY,
                        project_id TEXT NOT NULL,
                        pmo_domain_id TEXT NOT NULL,
                        pmo_phase TEXT NOT NULL, --Current phase when action occurred
            object_type TEXT NOT NULL, --DECISION, BASELINE, CHANGE_REQUEST, STAGE_GATE, etc.
            object_id TEXT NOT NULL, --ID of the PMO object
            action TEXT NOT NULL, --CREATED, UPDATED, APPROVED, REJECTED, TRANSITIONED, etc.
            actor_id TEXT, --User who performed the action
            iso21500_mapping TEXT, --ISO 21500 term at time of action
            pmbok_mapping TEXT, --PMBOK term at time of action
            prince2_mapping TEXT, --PRINCE2 term at time of action
            metadata TEXT DEFAULT '{}', --JSON: additional context
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
                        FOREIGN KEY(pmo_domain_id) REFERENCES pmo_domains(id),
                        FOREIGN KEY(actor_id) REFERENCES users(id) ON DELETE SET NULL
                    )`);

        /**
         * Add PMO domain references to existing governance tables
         * These columns enable traceability from objects to domains
         */

        // Decisions: Add domain and phase tracking
        db.run(`ALTER TABLE decisions ADD COLUMN pmo_domain_id TEXT DEFAULT 'GOVERNANCE_DECISION_MAKING'`, (err) => {
            // Ignore if exists
        });
        db.run(`ALTER TABLE decisions ADD COLUMN pmo_phase TEXT`, (err) => {
            // Ignore if exists
        });

        // Schedule Baselines: Add domain tracking
        db.run(`ALTER TABLE schedule_baselines ADD COLUMN pmo_domain_id TEXT DEFAULT 'SCOPE_CHANGE_CONTROL'`, (err) => {
            // Ignore if exists
        });

        // Change Requests: Add domain tracking
        db.run(`ALTER TABLE change_requests ADD COLUMN pmo_domain_id TEXT DEFAULT 'SCOPE_CHANGE_CONTROL'`, (err) => {
            // Ignore if exists
        });

        // Stage Gates: Add domain tracking
        db.run(`ALTER TABLE stage_gates ADD COLUMN pmo_domain_id TEXT DEFAULT 'SCHEDULE_MILESTONES'`, (err) => {
            // Ignore if exists
        });

        // ==========================================
        // AI CORE LAYER — ENTERPRISE PMO BRAIN
        // ==========================================

        // AI Policies (Tenant-level settings)
        db.run(`CREATE TABLE IF NOT EXISTS ai_policies(
                        organization_id TEXT PRIMARY KEY,
                        policy_level TEXT DEFAULT 'ADVISORY', --ADVISORY, ASSISTED, PROACTIVE, AUTOPILOT
            internet_enabled INTEGER DEFAULT 0,
                        audit_required INTEGER DEFAULT 1,
                        active_roles TEXT DEFAULT '["ADVISOR","PMO_MANAGER","EXECUTOR","EDUCATOR"]', --JSON Array
            max_policy_level TEXT DEFAULT 'ASSISTED',
                        default_ai_role TEXT DEFAULT 'ADVISOR',
                        proactive_notifications INTEGER DEFAULT 1,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
                    )`);

        // AI Project Memory (Persistent per project)
        db.run(`CREATE TABLE IF NOT EXISTS ai_project_memory(
                        id TEXT PRIMARY KEY,
                        project_id TEXT NOT NULL,
                        memory_type TEXT NOT NULL, --DECISION, PHASE_TRANSITION, RECOMMENDATION
            content TEXT NOT NULL, --JSON Object
            recorded_by TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
                        FOREIGN KEY(recorded_by) REFERENCES users(id) ON DELETE SET NULL
                    )`);

        // AI Organization Memory
        db.run(`CREATE TABLE IF NOT EXISTS ai_organization_memory(
                        organization_id TEXT PRIMARY KEY,
                        governance_style TEXT DEFAULT 'BALANCED', --STRICT, BALANCED, FLEXIBLE
            ai_strictness TEXT DEFAULT 'STANDARD', --MINIMAL, STANDARD, AGGRESSIVE
            recurring_patterns TEXT DEFAULT '[]', --JSON Array
            pmo_maturity TEXT DEFAULT 'BASIC', --BASIC, INTERMEDIATE, ADVANCED
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
                    )`);

        // AI User Preferences
        db.run(`CREATE TABLE IF NOT EXISTS ai_user_preferences(
                        user_id TEXT PRIMARY KEY,
                        preferred_tone TEXT DEFAULT 'EXPERT', --BUDDY, EXPERT, MANAGER
            education_mode INTEGER DEFAULT 0,
                        proactive_notifications INTEGER DEFAULT 1,
                        preferred_language TEXT DEFAULT 'en',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                    )`);

        // AI Audit Logs
        db.run(`CREATE TABLE IF NOT EXISTS ai_audit_logs(
            id TEXT PRIMARY KEY,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            user_id TEXT NOT NULL,
            organization_id TEXT NOT NULL,
            project_id TEXT,
            capability TEXT,
            action_type TEXT,
            action_description TEXT,
            context_snapshot TEXT,
            data_sources_used TEXT DEFAULT '[]',
            ai_role TEXT,
            policy_level TEXT,
            confidence_level REAL,
            ai_suggestion TEXT,
            user_decision TEXT,
            user_feedback TEXT,
            regulatory_mode INTEGER DEFAULT 0,
            reasoning_summary TEXT,
            data_used_json TEXT,
            constraints_applied_json TEXT,
            correlation_id TEXT,
            model TEXT,
            latency_ms INTEGER,
            has_screen_context INTEGER,
            screen_context_hash TEXT,
            success INTEGER,
            error_message TEXT,
            tokens_used INTEGER,
            cost_usd REAL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL
        )`);

        // Migration for ai_audit_logs timestamp
        db.run(`ALTER TABLE ai_audit_logs ADD COLUMN timestamp DATETIME DEFAULT CURRENT_TIMESTAMP`, (err) => { });
        db.run(`ALTER TABLE ai_audit_logs ADD COLUMN capability TEXT`, (err) => { });
        db.run(`ALTER TABLE ai_audit_logs ADD COLUMN model TEXT`, (err) => { });
        db.run(`ALTER TABLE ai_audit_logs ADD COLUMN latency_ms INTEGER`, (err) => { });
        db.run(`ALTER TABLE ai_audit_logs ADD COLUMN has_screen_context INTEGER`, (err) => { });
        db.run(`ALTER TABLE ai_audit_logs ADD COLUMN screen_context_hash TEXT`, (err) => { });
        db.run(`ALTER TABLE ai_audit_logs ADD COLUMN success INTEGER`, (err) => { });
        db.run(`ALTER TABLE ai_audit_logs ADD COLUMN error_message TEXT`, (err) => { });
        db.run(`ALTER TABLE ai_audit_logs ADD COLUMN tokens_used INTEGER`, (err) => { });
        db.run(`ALTER TABLE ai_audit_logs ADD COLUMN cost_usd REAL`, (err) => { });

        // AI Learning Interactions
        db.run(`CREATE TABLE IF NOT EXISTS ai_learning_interactions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            organization_id TEXT,
            request_type TEXT NOT NULL,
            prompt_hash TEXT,
            response_quality REAL,
            feedback_score REAL,
            auto_feedback_score REAL,
            auto_feedback_reason TEXT,
            model TEXT,
            latency_ms INTEGER,
            token_count INTEGER,
            prompt_signature TEXT,
            response_signature TEXT,
            metadata TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`ALTER TABLE ai_learning_interactions ADD COLUMN model TEXT`, (err) => { });
        db.run(`ALTER TABLE ai_learning_interactions ADD COLUMN auto_feedback_score REAL`, (err) => { });
        db.run(`ALTER TABLE ai_learning_interactions ADD COLUMN auto_feedback_reason TEXT`, (err) => { });
        db.run(`ALTER TABLE ai_learning_interactions ADD COLUMN latency_ms INTEGER`, (err) => { });
        db.run(`ALTER TABLE ai_learning_interactions ADD COLUMN token_count INTEGER`, (err) => { });
        db.run(`ALTER TABLE ai_learning_interactions ADD COLUMN prompt_signature TEXT`, (err) => { });
        db.run(`ALTER TABLE ai_learning_interactions ADD COLUMN response_signature TEXT`, (err) => { });

        // AI Learning Jobs
        db.run(`CREATE TABLE IF NOT EXISTS ai_learning_jobs (
            id TEXT PRIMARY KEY,
            job_type TEXT NOT NULL,
            status TEXT NOT NULL,
            started_at DATETIME,
            completed_at DATETIME,
            duration_ms INTEGER,
            records_processed INTEGER,
            patterns_extracted INTEGER,
            strategies_created INTEGER,
            error_message TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // AI Learned Patterns
        db.run(`CREATE TABLE IF NOT EXISTS ai_learned_patterns (
            id TEXT PRIMARY KEY, -- organization_id:request_type
            organization_id TEXT NOT NULL,
            request_type TEXT NOT NULL,
            successful_patterns TEXT, -- JSON
            failed_patterns TEXT, -- JSON
            sample_count INTEGER DEFAULT 0,
            confidence_score REAL DEFAULT 0,
            ai_insights TEXT, -- JSON
            improvement_suggestions TEXT, -- JSON
            last_extraction_at DATETIME,
            extraction_count INTEGER DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // AI Global Strategies
        db.run(`CREATE TABLE IF NOT EXISTS ai_global_strategies (
            id TEXT PRIMARY KEY,
            strategy_type TEXT NOT NULL,
            capability TEXT NOT NULL,
            strategy_content TEXT, -- JSON
            source_organizations TEXT, -- JSON
            sample_size INTEGER,
            confidence_score REAL,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // AI Actions (Pending approvals)
        db.run(`CREATE TABLE IF NOT EXISTS ai_actions(
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        organization_id TEXT NOT NULL,
                        project_id TEXT,
                        action_type TEXT NOT NULL,
                        payload TEXT NOT NULL, --JSON Object
            draft_content TEXT,
                        required_policy_level TEXT NOT NULL,
                        current_policy_level TEXT NOT NULL,
                        requires_approval INTEGER DEFAULT 1,
                        status TEXT DEFAULT 'PENDING', --PENDING, APPROVED, REJECTED, EXECUTED
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        approved_at DATETIME,
                        approved_by TEXT,
                        executed_at DATETIME,
                        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
                        FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                        FOREIGN KEY(approved_by) REFERENCES users(id) ON DELETE SET NULL
                    )`);

        // AI Roles Model: Add columns to ai_audit_logs for enhanced tracking
        db.run(`ALTER TABLE ai_audit_logs ADD COLUMN ai_project_role TEXT DEFAULT 'ADVISOR'`, (err) => {
            // Ignore if exists
        });
        db.run(`ALTER TABLE ai_audit_logs ADD COLUMN justification TEXT`, (err) => {
            // Ignore if exists
        });
        db.run(`ALTER TABLE ai_audit_logs ADD COLUMN approving_user TEXT`, (err) => {
            // Ignore if exists
        });

        // User Token Quota (Add columns to users - we'll use ALTER TABLE to add if not exists)
        db.run(`ALTER TABLE users ADD COLUMN token_limit INTEGER DEFAULT 100000`, (err) => {
            // Ignore error if column already exists
        });
        db.run(`ALTER TABLE users ADD COLUMN token_used INTEGER DEFAULT 0`, (err) => {
            // Ignore error if column already exists
        });
        db.run(`ALTER TABLE users ADD COLUMN token_reset_at DATETIME`, (err) => {
            // Ignore error if column already exists
        });

        // AI Config (JSON)
        db.run(`ALTER TABLE users ADD COLUMN ai_config TEXT DEFAULT '{}'`, (err) => {
            // Ignore error if column already exists
        });

        // ==========================================
        // PHASE 3: AI EVOLUTION TABLES
        // ==========================================

        // AI Feedback (Self-Learning Memory)
        db.run(`CREATE TABLE IF NOT EXISTS ai_feedback(
                        id TEXT PRIMARY KEY,
                        organization_id TEXT,
                        user_id TEXT,
                        context TEXT, --diagnosis, recommendation, chat
            prompt TEXT,
                        response TEXT,
                        helpful INTEGER, --0 or 1
            comment TEXT,
                        rating INTEGER, --1 - 5
            correction TEXT, --User provided better answer
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
                    )`);

        // Custom AI Prompts (Organization-specific)
        db.run(`CREATE TABLE IF NOT EXISTS custom_prompts(
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        name TEXT NOT NULL,
                        context TEXT NOT NULL, --diagnosis, recommendation, roadmap, etc.
            template TEXT NOT NULL,
                        variables TEXT, --JSON array of variable names
            is_active INTEGER DEFAULT 1,
                        created_by TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                        FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
                    )`);

        // Webhooks (Integration Hub)
        db.run(`CREATE TABLE IF NOT EXISTS webhooks(
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        name TEXT NOT NULL,
                        description TEXT,
                        url TEXT NOT NULL,
                        events TEXT NOT NULL, --JSON array of event types
            secret TEXT NOT NULL, --For signature verification
            signature_secret TEXT, --Additional secret for HMAC verification
            retry_config TEXT, --JSON: max_retries, backoff_strategy, retry_delays
            filter_rules TEXT, --JSON: event filters and conditions
            version TEXT DEFAULT '1.0', --Webhook version for compatibility
            is_active INTEGER DEFAULT 1,
                        created_by TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                        FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
                    )`);

        // Migrate existing webhooks table - add new columns if they don't exist
        db.run(`ALTER TABLE webhooks ADD COLUMN signature_secret TEXT`, (err) => {
            // Ignore duplicate column errors
            if (err && !err.message.includes('duplicate column')) {
                console.warn('[DB] Webhook signature_secret column error:', err.message);
            }
        });
        db.run(`ALTER TABLE webhooks ADD COLUMN retry_config TEXT`, (err) => {
            // Ignore duplicate column errors
            if (err && !err.message.includes('duplicate column')) {
                console.warn('[DB] Webhook retry_config column error:', err.message);
            }
        });
        db.run(`ALTER TABLE webhooks ADD COLUMN filter_rules TEXT`, (err) => {
            // Ignore duplicate column errors
            if (err && !err.message.includes('duplicate column')) {
                console.warn('[DB] Webhook filter_rules column error:', err.message);
            }
        });
        db.run(`ALTER TABLE webhooks ADD COLUMN version TEXT DEFAULT '1.0'`, (err) => {
            // Ignore duplicate column errors
            if (err && !err.message.includes('duplicate column')) {
                console.warn('[DB] Webhook version column error:', err.message);
            }
        });

        // AI Logs (Analytics)
        db.run(`CREATE TABLE IF NOT EXISTS ai_logs(
                        id TEXT PRIMARY KEY,
                        user_id TEXT,
                        action TEXT, --diagnose, chat, etc.
            model TEXT,
                        input_tokens INTEGER,
                        output_tokens INTEGER,
                        latency_ms INTEGER,
                        topic TEXT, --Classified topic
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )`);

        // System Prompts (Super Admin Control)
        db.run(`CREATE TABLE IF NOT EXISTS system_prompts(
                        id TEXT PRIMARY KEY,
                        key TEXT UNIQUE, --e.g. 'ANALYST', 'CONSULTANT'
            content TEXT,
                        description TEXT,
                        updated_by TEXT,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )`);

        // Seed Default System Prompts if not exist
        const defaultPrompts = [
            { key: 'ANALYST', desc: 'Tone for Diagnosis', content: "You are an Expert Digital Analyst. Your tone is objective, data-driven, and analytical. You focus on interpreting facts, KPIs, and current state assessments without fluff." },
            { key: 'CONSULTANT', desc: 'Tone for Recommendations', content: "You are a Senior Digital Transformation Consultant. Your tone is professional, solution-oriented, and convincing. You bridge the gap between analysis and strategy, recommending concrete initiatives." },
            { key: 'STRATEGIST', desc: 'Tone for Roadmap', content: "You are a Strategic Advisor to the CEO. You think in 3-5 year horizons. You focus on competitive advantage, business models, and high-level roadmap architecture. You prioritize culture and leadership." },
            { key: 'FINANCE', desc: 'Tone for ROI', content: "You are a Financial Expert / CFO Advisor. You speak in terms of ROI, CAPEX, OPEX, payback periods, and net present value. You justify every initiative with economic logic." },
            { key: 'MENTOR', desc: 'Tone for Coaching', content: "You are a Leadership Coach and Mentor. Your tone is supportive, encouraging, and psychological. You focus on mindset, change management, and overcoming resistance." }
        ];

        const insertPrompt = db.prepare(`INSERT OR IGNORE INTO system_prompts(id, key, description, content, updated_by) VALUES(?, ?, ?, ?, ?)`);
        defaultPrompts.forEach(p => {
            insertPrompt.run(uuidv4(), p.key, p.desc, p.content, 'system');
        });
        insertPrompt.finalize();

        // Feedback / System Issues Table
        db.run(`CREATE TABLE IF NOT EXISTS feedback(
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        type TEXT NOT NULL, --bug, feature, general
            message TEXT NOT NULL,
                        screenshot TEXT, --Base64
            url TEXT,
                        status TEXT DEFAULT 'new', --new, read, resolved, rejected
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                    )`);

        // Revoked Tokens Table (JWT Blacklist)
        db.run(`CREATE TABLE IF NOT EXISTS revoked_tokens(
                        jti TEXT PRIMARY KEY,
                        user_id TEXT,
                        expires_at DATETIME NOT NULL,
                        revoked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        reason TEXT DEFAULT 'logout',
                        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                    )`);

        // Password Resets Table
        db.run(`CREATE TABLE IF NOT EXISTS organization_facilities(
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        name TEXT,
                        location TEXT,
                        headcount INTEGER DEFAULT 0,
                        activity_profile TEXT, --JSON
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
                    )`);

        // Client Context
        db.run(`CREATE TABLE IF NOT EXISTS client_context(
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        key TEXT NOT NULL,
                        value TEXT,
                        confidence REAL DEFAULT 1.0,
                        source TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
                    )`); db.run(`CREATE TABLE IF NOT EXISTS password_resets(
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        token TEXT NOT NULL UNIQUE,
                        expires_at DATETIME NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                    )`);

        // Invitations Table
        db.run(`CREATE TABLE IF NOT EXISTS invitations(
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        email TEXT NOT NULL,
                        role TEXT DEFAULT 'USER',
                        token TEXT UNIQUE, -- Moved to NULLABLE for hash-based security (Step 3)
                        token_hash TEXT UNIQUE, -- Added to base for secure token storage
                        status TEXT DEFAULT 'pending', --pending, accepted, expired, revoked
            invited_by TEXT,
                        expires_at DATETIME,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        accepted_at DATETIME,
                        FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                        FOREIGN KEY(invited_by) REFERENCES users(id) ON DELETE SET NULL
                    )`);

        // ==========================================
        // INVITATION SYSTEM EXTENSIONS (Enterprise-Ready)
        // Supports ORG and PROJECT level invitations with full audit trail
        // ==========================================

        // Extend invitations table with enterprise features
        db.run(`ALTER TABLE invitations ADD COLUMN invitation_type TEXT DEFAULT 'ORG'`, (err) => {
            // Ignore if column exists - Values: ORG, PROJECT
        });
        db.run(`ALTER TABLE invitations ADD COLUMN project_id TEXT`, (err) => {
            // Ignore if column exists - Only for PROJECT type invitations
        });
        db.run(`ALTER TABLE invitations ADD COLUMN role_to_assign TEXT`, (err) => {
            // Ignore if column exists - More explicit role assignment field
        });
        db.run(`ALTER TABLE invitations ADD COLUMN accepted_by_user_id TEXT`, (err) => {
            // Ignore if column exists - User who accepted the invitation
        });
        db.run(`ALTER TABLE invitations ADD COLUMN metadata TEXT DEFAULT '{}'`, (err) => {
            // Ignore if column exists - JSON for extensibility (partner codes, billing hooks, etc.)
        });

        /**
         * Invitation Events (Audit Trail)
         * 
         * Every state change for invitations is logged here for:
         * - Enterprise compliance (SOC2, ISO 27001)
         * - Security audit trails
         * - Partner attribution tracking
         */
        db.run(`CREATE TABLE IF NOT EXISTS invitation_events(
                        id TEXT PRIMARY KEY,
                        invitation_id TEXT NOT NULL,
                        event_type TEXT NOT NULL, --created, sent, resent, accepted, expired, revoked
            performed_by_user_id TEXT,
                        ip_address TEXT,
                        user_agent TEXT,
                        metadata TEXT DEFAULT '{}',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(invitation_id) REFERENCES invitations(id) ON DELETE CASCADE,
                        FOREIGN KEY(performed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
                    )`);

        // Indexes for invitation performance
        db.run(`CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_invitations_token_hash ON invitations(token_hash)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_invitations_org_status ON invitations(organization_id, status)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_invitations_project ON invitations(project_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_invitation_events_invitation ON invitation_events(invitation_id)`);

        // Step 3 Finalization: Resend tracking columns
        db.run(`ALTER TABLE invitations ADD COLUMN resend_count INTEGER DEFAULT 0`, (err) => {
            // Ignore if column exists
        });
        db.run(`ALTER TABLE invitations ADD COLUMN last_resent_at DATETIME`, (err) => {
            // Ignore if column exists
        });
        db.run(`ALTER TABLE invitations ADD COLUMN token_hash TEXT`, (err) => {
            // Ignore if column exists
        });

        // Access Requests Table (for controlled organization access)
        db.run(`CREATE TABLE IF NOT EXISTS access_requests(
                        id TEXT PRIMARY KEY,
                        email TEXT NOT NULL,
                        first_name TEXT,
                        last_name TEXT,
                        phone TEXT,
                        organization_id TEXT,
                        organization_name TEXT,
                        requested_role TEXT DEFAULT 'USER',
                        status TEXT DEFAULT 'pending', --pending, approved, rejected, expired
            request_type TEXT DEFAULT 'new_user', --new_user, join_org
            metadata TEXT,
                        requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        reviewed_by TEXT,
                        reviewed_at DATETIME,
                        rejection_reason TEXT,
                        FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                        FOREIGN KEY(reviewed_by) REFERENCES users(id) ON DELETE SET NULL
                    )`);

        // Permission Requests Table (User requests for role/limit changes)
        db.run(`CREATE TABLE IF NOT EXISTS permission_requests (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            request_type TEXT NOT NULL, -- ROLE_CHANGE, TOKEN_LIMIT, STORAGE_LIMIT, FEATURE_ACCESS
            current_value TEXT,
            requested_value TEXT,
            justification TEXT,
            status TEXT DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED, CANCELLED
            priority TEXT DEFAULT 'NORMAL', -- LOW, NORMAL, HIGH, URGENT
            reviewed_by TEXT,
            reviewed_at DATETIME,
            admin_notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(reviewed_by) REFERENCES users(id) ON DELETE SET NULL
        )`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_permission_requests_user ON permission_requests(user_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_permission_requests_org ON permission_requests(organization_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_permission_requests_status ON permission_requests(status)`);

        // Access Codes Table (Admin-generated codes for organization access)
        db.run(`CREATE TABLE IF NOT EXISTS access_codes(
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        code TEXT NOT NULL UNIQUE,
                        created_by TEXT NOT NULL,
                        role TEXT DEFAULT 'USER',
                        max_uses INTEGER DEFAULT 1,
                        current_uses INTEGER DEFAULT 0,
                        expires_at DATETIME,
                        is_active INTEGER DEFAULT 1,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                        FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
                    )`);

        // Access Code Usage Tracking
        db.run(`CREATE TABLE IF NOT EXISTS access_code_usage(
                        id TEXT PRIMARY KEY,
                        code_id TEXT NOT NULL,
                        user_id TEXT NOT NULL,
                        used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(code_id) REFERENCES access_codes(id) ON DELETE CASCADE,
                        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                    )`);

        // ==========================================
        // LEGAL & COMPLIANCE FOUNDATION
        // Production-grade audit-friendly legal document management
        // ==========================================

        /**
         * Legal Documents Table
         * Stores versioned legal documents (ToS, Privacy Policy, DPA, etc.)
         * Only one active document per doc_type at any time.
         * 
         * @doc_type Valid values: TOS, PRIVACY, COOKIES, AUP, AI_POLICY, DPA
         */
        db.run(`CREATE TABLE IF NOT EXISTS legal_documents(
                        id TEXT PRIMARY KEY,
                        doc_type TEXT NOT NULL,
                        version TEXT NOT NULL,
                        title TEXT NOT NULL,
                        content_md TEXT NOT NULL,
                        effective_from TEXT NOT NULL,
                        created_at TEXT DEFAULT(datetime('now')),
                        created_by TEXT,
                        is_active INTEGER DEFAULT 0,
                        FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
                    )`);

        /**
         * Legal Acceptances Table
         * Records every user/organization acceptance event for audit trail.
         * 
         * @acceptance_scope: 'USER' for individual acceptance, 'ORG_ADMIN' for org-level (DPA)
         * @evidence_json: Contains hash of document, timestamps, and metadata snapshot
         */
        db.run(`CREATE TABLE IF NOT EXISTS legal_acceptances(
                        id TEXT PRIMARY KEY,
                        organization_id TEXT,
                        user_id TEXT NOT NULL,
                        doc_type TEXT NOT NULL,
                        version TEXT NOT NULL,
                        accepted_at TEXT DEFAULT(datetime('now')),
                        accepted_ip TEXT,
                        user_agent TEXT,
                        acceptance_scope TEXT DEFAULT 'USER',
                        evidence_json TEXT DEFAULT '{}',
                        FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE SET NULL,
                        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                    )`);

        // Create index for faster acceptance lookups
        db.run(`CREATE INDEX IF NOT EXISTS idx_legal_acceptances_user ON legal_acceptances(user_id, doc_type)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_legal_acceptances_org ON legal_acceptances(organization_id, doc_type)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_legal_documents_active ON legal_documents(doc_type, is_active)`);

        /**
         * ENTERPRISE+ COMPLIANCE EXTENSIONS
         * ISO 21500 / SOC2 / Due Diligence Ready
         */

        /**
         * Legal Events Table (Immutable Audit Log)
         * Append-only audit trail for all legal compliance events.
         * CRITICAL: Never update or delete rows from this table.
         */
        db.run(`CREATE TABLE IF NOT EXISTS legal_events(
                        id TEXT PRIMARY KEY,
                        event_type TEXT NOT NULL,
                        document_id TEXT,
                        document_version TEXT,
                        user_id TEXT,
                        organization_id TEXT,
                        performed_by TEXT NOT NULL,
                        metadata TEXT DEFAULT '{}',
                        created_at TEXT DEFAULT(datetime('now'))
                    )`);

        // Indexes for audit log queries
        db.run(`CREATE INDEX IF NOT EXISTS idx_legal_events_type ON legal_events(event_type)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_legal_events_doc ON legal_events(document_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_legal_events_org ON legal_events(organization_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_legal_events_created ON legal_events(created_at)`);

        // Legal Documents Lifecycle Extensions
        db.run(`ALTER TABLE legal_documents ADD COLUMN expires_at TEXT`, (err) => {
            // Ignore if column exists
        });
        db.run(`ALTER TABLE legal_documents ADD COLUMN reaccept_required_from TEXT`, (err) => {
            // Ignore if column exists
        });

        // Legal Documents Scope Extensions
        db.run(`ALTER TABLE legal_documents ADD COLUMN scope_type TEXT DEFAULT 'global'`, (err) => {
            // Ignore if column exists - Values: global, region, product, license_tier
        });
        db.run(`ALTER TABLE legal_documents ADD COLUMN scope_value TEXT`, (err) => {
            // Ignore if column exists - JSON string for scope details
        });

        // Legal Documents Version History
        db.run(`ALTER TABLE legal_documents ADD COLUMN change_summary TEXT`, (err) => {
            // Ignore if column exists - Human-readable summary of changes
        });
        db.run(`ALTER TABLE legal_documents ADD COLUMN previous_version_id TEXT`, (err) => {
            // Ignore if column exists - Link to previous version for diff
        });

        // ==========================================
        // TRIAL + DEMO ACCESS MODEL
        // Supports Demo (read-only), Trial (time-limited), and Paid modes
        // All restrictions enforced backend-side
        // ==========================================

        /**
         * Extend organizations table with Trial/Demo fields
         * organization_type: DEMO | TRIAL | PAID
         */
        db.run(`ALTER TABLE organizations ADD COLUMN organization_type TEXT DEFAULT 'TRIAL'`, (err) => {
            // Ignore if exists
        });
        db.run(`ALTER TABLE organizations ADD COLUMN trial_started_at TEXT`, (err) => {
            // Ignore if exists
        });
        db.run(`ALTER TABLE organizations ADD COLUMN trial_expires_at TEXT`, (err) => {
            // Ignore if exists
        });
        db.run(`ALTER TABLE organizations ADD COLUMN is_active INTEGER DEFAULT 1`, (err) => {
            // Ignore if exists
        });
        db.run(`ALTER TABLE organizations ADD COLUMN created_by_user_id TEXT`, (err) => {
            // Ignore if exists
        });

        /**
         * Organization Limits Table
         * Per-org constraints for Trial/Demo mode
         * Enforced by AccessPolicyService
         */
        db.run(`CREATE TABLE IF NOT EXISTS organization_limits(
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL UNIQUE,
                        max_projects INTEGER DEFAULT 3,
                        max_users INTEGER DEFAULT 5,
                        max_ai_calls_per_day INTEGER DEFAULT 50,
                        max_initiatives INTEGER DEFAULT 10,
                        max_storage_mb INTEGER DEFAULT 100,
                        ai_roles_enabled_json TEXT DEFAULT '["ADVISOR"]',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
                    )`);

        /**
         * Demo Templates Table
         * Seed data snapshots for demo organizations
         * Used by demoService to hydrate ephemeral demo orgs
         */
        db.run(`CREATE TABLE IF NOT EXISTS demo_templates(
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        description TEXT,
                        seed_data_json TEXT NOT NULL,
                        is_active INTEGER DEFAULT 1,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )`);

        /**
         * Usage Counters Table
         * Daily tracking of AI calls, projects, users per organization
         * Reset daily by cron job
         */
        db.run(`CREATE TABLE IF NOT EXISTS usage_counters(
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        counter_date TEXT NOT NULL,
                        ai_calls_count INTEGER DEFAULT 0,
                        projects_count INTEGER DEFAULT 0,
                        users_count INTEGER DEFAULT 0,
                        initiatives_count INTEGER DEFAULT 0,
                        storage_used_mb INTEGER DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(organization_id, counter_date),
                        FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
                    )`);

        // Indexes for Trial/Demo performance
        db.run(`CREATE INDEX IF NOT EXISTS idx_org_type ON organizations(organization_type)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_org_limits ON organization_limits(organization_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_usage_counters_date ON usage_counters(organization_id, counter_date)`);

        /**
         * Organization Events Table (Audit Trail)
         * Immutable log for trial/demo/paid lifecycle events
         * Enterprise+ compliance requirement
         */
        db.run(`CREATE TABLE IF NOT EXISTS organization_events(
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        event_type TEXT NOT NULL,
                        performed_by_user_id TEXT,
                        metadata TEXT DEFAULT '{}',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
                    )`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_org_events ON organization_events(organization_id, event_type)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_org_events_created ON organization_events(created_at)`);

        // Step 2 Finalization: Trial extension tracking and anti-spam
        db.run(`ALTER TABLE organizations ADD COLUMN trial_warning_sent_at TEXT`, (err) => {
            // Ignore if exists - tracks T-7 warning to prevent spam
        });
        db.run(`ALTER TABLE organizations ADD COLUMN trial_extension_count INTEGER DEFAULT 0`, (err) => {
            // Ignore if exists - max 2 extensions allowed
        });

        // ==========================================
        // STEP 4: PROMO CODES + ATTRIBUTION
        // Enterprise+ partner tracking and promotional codes
        // ==========================================

        /**
         * Promo Codes Table
         * Supports DISCOUNT, PARTNER, and CAMPAIGN type codes
         * Partner codes for attribution tracking (no discount required)
         */
        db.run(`CREATE TABLE IF NOT EXISTS promo_codes(
                        id TEXT PRIMARY KEY,
                        code TEXT UNIQUE NOT NULL,
                        type TEXT NOT NULL, --DISCOUNT | PARTNER | CAMPAIGN
            discount_type TEXT DEFAULT 'NONE', --PERCENT | FIXED | NONE
            discount_value REAL, --nullable, only if discount_type != NONE
            valid_from TEXT NOT NULL,
        valid_until TEXT, --nullable = infinite
            max_uses INTEGER, --nullable = unlimited
            used_count INTEGER DEFAULT 0,
        created_by_user_id TEXT,
            is_active INTEGER DEFAULT 1,
                metadata TEXT DEFAULT '{}', --JSON for extensibility
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
        )`);

        // Indexes for promo code performance
        db.run(`CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes(is_active, valid_from, valid_until)`);

        /**
         * Attribution Events Table (IMMUTABLE)
         * Append-only audit trail for organization acquisition sources.
         * CRITICAL: Never UPDATE or DELETE rows from this table.
         * Used for partner settlements and marketing analytics.
         */
        db.run(`CREATE TABLE IF NOT EXISTS attribution_events(
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            user_id TEXT, --nullable(anonymous demos)
            source_type TEXT NOT NULL, --PROMO_CODE | INVITATION | DEMO | SALES | SELF_SERVE
            source_id TEXT, --promo_code_id | invitation_id | null
            campaign TEXT, --UTM campaign or similar
            partner_code TEXT, --Partner attribution
            medium TEXT, --UTM medium or channel
            metadata TEXT DEFAULT '{}', --JSON for extensibility
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);

        // Indexes for attribution performance
        db.run(`CREATE INDEX IF NOT EXISTS idx_attribution_org ON attribution_events(organization_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_attribution_source ON attribution_events(source_type)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_attribution_partner ON attribution_events(partner_code)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_attribution_created ON attribution_events(created_at)`);

        /**
         * Promo Code Usage Log (for detailed tracking)
         * Links promo code uses to organizations
         */
        db.run(`CREATE TABLE IF NOT EXISTS promo_code_usage(
            id TEXT PRIMARY KEY,
            promo_code_id TEXT NOT NULL,
            organization_id TEXT NOT NULL,
            user_id TEXT,
            used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(promo_code_id) REFERENCES promo_codes(id) ON DELETE CASCADE,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
        )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_promo_usage_code ON promo_code_usage(promo_code_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_promo_usage_org ON promo_code_usage(organization_id)`);

        // ==========================================
        // PHASE 1.5: NOTIFICATIONS & INTEGRATIONS
        // ==========================================

        // Integrations Table (Slack, Teams, etc.)
        db.run(`CREATE TABLE IF NOT EXISTS integrations(
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            provider TEXT NOT NULL, --slack, teams, whatsapp, trello, jira, clickup
            config TEXT, --JSON: webhook_url, api_token, channel_id, etc.
            status TEXT DEFAULT 'active', --active, error, disabled
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);

        // Add notification_preferences to users if not exists
        db.run(`ALTER TABLE users ADD COLUMN notification_preferences TEXT DEFAULT '{}'`, (err) => {
            // Ignore if exists
        });

        // Add extended_preferences to users if not exists (work, dashboard, accessibility, privacy, ai preferences)
        db.run(`ALTER TABLE users ADD COLUMN extended_preferences TEXT DEFAULT '{}'`, (err) => {
            // Ignore if exists
        });

        // Add priority to notifications if not exists
        db.run(`ALTER TABLE notifications ADD COLUMN priority TEXT DEFAULT 'normal'`, (err) => {
            // Ignore if exists
        });

        // Notification Preferences Table
        db.run(`CREATE TABLE IF NOT EXISTS notification_preferences(
            user_id TEXT PRIMARY KEY,
            channels TEXT DEFAULT '{"inApp":true,"email":true}', --JSON
            digest TEXT DEFAULT 'daily', --daily, weekly, off
            triggers TEXT DEFAULT '{"overdue":true,"assigned":true,"blocked":true,"mentioned":true}', --JSON
            quiet_hours TEXT DEFAULT '{"enabled":false,"start":"22:00","end":"08:00"}', --JSON
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // ==========================================
        // PHASE 2: DRD STRATEGY EXECUTION ENGINE
        // ==========================================

        // --- PHASE 1.5: AI LEARNING & CONTEXT (NEW) ---

        // 1. Knowledge Candidates (The "Inbox" for AI Ideas)
        db.run(`CREATE TABLE IF NOT EXISTS knowledge_candidates(
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL, --The proposed insight / idea
            reasoning TEXT, --Why is this useful ?
            source TEXT, -- 'interaction', 'manual', 'analysis'
            origin_context TEXT, --Anonymized snippet of where it came from
            related_axis TEXT, --Linked to specific axis if applicable
            priority TEXT DEFAULT 'medium', --low, medium, high
            status TEXT DEFAULT 'pending', --pending, approved, rejected, edited
            admin_comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // 2. Global Strategic Directions (Admin Controls)
        db.run(`CREATE TABLE IF NOT EXISTS global_strategies(
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            is_active INTEGER DEFAULT 1,
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // 2.5 Structured Entity Context (Facilities) - Defined earlier
        // 3. Client Context (Persistent Memory per Client) - Defined earlier

        // Update Knowledge Chunks for Vector Support
        db.run(`ALTER TABLE knowledge_chunks ADD COLUMN embedding TEXT`, (err) => {
            // Ignore if exists
        });

        // ==========================================
        // GLOBAL KNOWLEDGE BRAIN ENHANCEMENTS
        // ==========================================

        // Extend knowledge_candidates table
        const candidateEnhancementCols = [
            { name: 'category', type: 'TEXT', default: 'NULL' },
            { name: 'tags', type: 'TEXT', default: "'[]'" },
            { name: 'related_project_ids', type: 'TEXT', default: "'[]'" },
            { name: 'implementation_notes', type: 'TEXT', default: 'NULL' },
            { name: 'impact_score', type: 'INTEGER', default: 'NULL' }
        ];

        candidateEnhancementCols.forEach(col => {
            db.run(`ALTER TABLE knowledge_candidates ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.default}`, (err) => {
                // Ignore if exists
            });
        });

        // Extend global_strategies table
        const strategyEnhancementCols = [
            { name: 'success_metrics', type: 'TEXT', default: "'[]'" },
            { name: 'related_document_ids', type: 'TEXT', default: "'[]'" },
            { name: 'related_idea_ids', type: 'TEXT', default: "'[]'" },
            { name: 'related_initiative_ids', type: 'TEXT', default: "'[]'" },
            { name: 'priority', type: 'TEXT', default: "'medium'" },
            { name: 'target_date', type: 'DATETIME', default: 'NULL' },
            { name: 'progress_percentage', type: 'INTEGER', default: '0' }
        ];

        strategyEnhancementCols.forEach(col => {
            db.run(`ALTER TABLE global_strategies ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.default}`, (err) => {
                // Ignore if exists
            });
        });

        // ==========================================
        // PHASE 4: ANALYTICS & BENCHMARKING
        // ==========================================

        // 1. Add Industry to Organizations
        db.run(`ALTER TABLE organizations ADD COLUMN industry TEXT DEFAULT 'General'`, (err) => {
            // Ignore if exists
        });

        // 2. Maturity Scores (Structured Data for Benchmarking)
        db.run(`CREATE TABLE IF NOT EXISTS maturity_scores(
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            axis TEXT NOT NULL, --e.g. 'Culture', 'Data'
            score REAL NOT NULL, --1.0 to 5.0
            industry TEXT, --Denormalized for easier querying
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);

        // Add Active LLM Provider to Organizations
        db.run(`ALTER TABLE organizations ADD COLUMN active_llm_provider_id TEXT`, (err) => {
            // Ignore if exists
        });


        // Update Initiatives Table with Professional Card fields
        const initiativeColumns = [
            { name: 'problem_statement', type: 'TEXT', default: "''" },
            { name: 'deliverables', type: 'TEXT', default: "'[]'" }, // JSON
            { name: 'success_criteria', type: 'TEXT', default: "'[]'" }, // JSON
            { name: 'scope_in', type: 'TEXT', default: "'[]'" }, // JSON
            { name: 'scope_out', type: 'TEXT', default: "'[]'" }, // JSON
            { name: 'key_risks', type: 'TEXT', default: "'[]'" } // JSON
        ];

        initiativeColumns.forEach(col => {
            db.run(`ALTER TABLE initiatives ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.default} `, (err) => {
                // Ignore error if column already exists
            });
        });

        // New Value & Finance Fields
        const valueColumns = [
            { name: 'value_driver', type: 'TEXT', default: 'NULL' },
            { name: 'confidence_level', type: 'TEXT', default: 'NULL' },
            { name: 'value_timing', type: 'TEXT', default: 'NULL' }
        ];

        valueColumns.forEach(col => {
            db.run(`ALTER TABLE initiatives ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.default} `, (err) => {
                // Ignore error if column already exists
            });
        });

        // Task 8: Decision & Overview Fields
        const decisionColumns = [
            { name: 'strategic_fit', type: 'TEXT', default: "'{}'" }, // JSON
            { name: 'attachments', type: 'TEXT', default: "'[]'" }, // JSON
            { name: 'change_log', type: 'TEXT', default: "'[]'" }, // JSON
            { name: 'target_state', type: 'TEXT', default: "'{}'" }, // JSON
            { name: 'decision_readiness_breakdown', type: 'TEXT', default: "'{}'" }, // JSON
            { name: 'applicant_one_liner', type: 'TEXT', default: "''" },
            { name: 'strategic_intent', type: 'TEXT', default: "''" },
            { name: 'decision_to_make', type: 'TEXT', default: "''" },
            { name: 'decision_owner_id', type: 'TEXT', default: "NULL" }
        ];

        decisionColumns.forEach(col => {
            db.run(`ALTER TABLE initiatives ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.default} `, (err) => {
                // Ignore error if column already exists
            });
        });

        // Roadmap Enhancements (Task 3)
        const roadmapColumns = [
            { name: 'strategic_role', type: 'TEXT', default: 'NULL' },
            { name: 'placement_reason', type: 'TEXT', default: "''" },
            { name: 'effort_profile', type: 'TEXT', default: "'{}'" } // JSON { analytical, operational, change }
        ];

        roadmapColumns.forEach(col => {
            db.run(`ALTER TABLE initiatives ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.default} `, (err) => {
                // Ignore error if column already exists
            });
        });

        // Transfer to Roadmap columns (Assessment Integration)
        db.run(`ALTER TABLE initiatives ADD COLUMN target_quarter TEXT`, (err) => { });
        db.run(`ALTER TABLE initiatives ADD COLUMN roadmap_notes TEXT`, (err) => { });
        db.run(`ALTER TABLE initiatives ADD COLUMN source_report_id TEXT`, (err) => { });

        // Task Dependencies
        db.run(`CREATE TABLE IF NOT EXISTS task_dependencies(
            id TEXT PRIMARY KEY,
            from_task_id TEXT NOT NULL,
            to_task_id TEXT NOT NULL,
            type TEXT DEFAULT 'hard', --hard(blocker), soft(recommended)
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(from_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            FOREIGN KEY(to_task_id) REFERENCES tasks(id) ON DELETE CASCADE
        )`);

        // Extend TASKS table with Consulting-Grade fields
        // We use ALTER TABLE for each new column to ensure backward compatibility
        const taskColumns = [
            { name: 'task_type', type: 'TEXT', default: "'execution'" }, // analytical, design, execution, validation
            { name: 'budget_allocated', type: 'REAL', default: '0' },
            { name: 'budget_spent', type: 'REAL', default: '0' },
            { name: 'risk_rating', type: 'TEXT', default: "'low'" }, // low, medium, high, critical
            { name: 'acceptance_criteria', type: 'TEXT', default: "''" },
            { name: 'blocking_issues', type: 'TEXT', default: "''" }, // JSON or Text description
            { name: 'step_phase', type: 'TEXT', default: "'design'" }, // design, pilot, rollout
            { name: 'initiative_id', type: 'TEXT', default: 'NULL' },
            { name: 'why', type: 'TEXT', default: "''" } // justification // Link to parent Initiative
        ];

        taskColumns.forEach(col => {
            db.run(`ALTER TABLE tasks ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.default} `, (err) => {
                // Ignore error if column already exists
            });
        });

        // Add effort_estimate column (alias for estimated_hours for capacity service)
        db.run(`ALTER TABLE tasks ADD COLUMN effort_estimate REAL DEFAULT NULL`, (err) => {
            // Ignore error if column already exists
        });

        // ==========================================
        // PHASE: ENTERPRISE SAAS BILLING
        // ==========================================

        // 0. TOKEN BILLING & MARGINS
        db.run(`CREATE TABLE IF NOT EXISTS billing_margins(
            source_type TEXT PRIMARY KEY, --platform, byok, local
            base_cost_per_1k REAL DEFAULT 0,
            margin_percent REAL DEFAULT 20,
            min_charge REAL DEFAULT 0.01,
            is_active INTEGER DEFAULT 1,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Seed default margins
        db.run(`INSERT OR IGNORE INTO billing_margins(source_type, base_cost_per_1k, margin_percent) VALUES
        ('platform', 0.03, 30),
        ('byok', 0, 5),
        ('local', 0, 0)
            `);

        db.run(`CREATE TABLE IF NOT EXISTS token_packages(
                id TEXT PRIMARY KEY,
                name TEXT,
                description TEXT,
                tokens INTEGER,
                price_usd REAL,
                bonus_percent REAL DEFAULT 0,
                is_popular INTEGER DEFAULT 0,
                sort_order INTEGER DEFAULT 0,
                stripe_price_id TEXT,
                is_active INTEGER DEFAULT 1
            )`);

        db.run(`CREATE TABLE IF NOT EXISTS user_token_balance(
                user_id TEXT PRIMARY KEY,
                platform_tokens INTEGER DEFAULT 0,
                platform_tokens_bonus INTEGER DEFAULT 0,
                byok_usage_tokens INTEGER DEFAULT 0,
                local_usage_tokens INTEGER DEFAULT 0,
                lifetime_purchased INTEGER DEFAULT 0,
                lifetime_used INTEGER DEFAULT 0,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )`);

        db.run(`CREATE TABLE IF NOT EXISTS token_transactions(
                id TEXT PRIMARY KEY,
                user_id TEXT,
                organization_id TEXT,
                type TEXT, --purchase, usage
            source_type TEXT, --platform, byok, local
            tokens INTEGER,
                package_id TEXT,
                stripe_payment_id TEXT,
                description TEXT,
                margin_usd REAL,
                net_revenue_usd REAL,
                llm_provider TEXT,
                model_used TEXT,
                metadata TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

        db.run(`CREATE TABLE IF NOT EXISTS billing_invoices(
                id TEXT PRIMARY KEY,
                organization_id TEXT,
                amount_due REAL,
                currency TEXT DEFAULT 'USD',
                status TEXT,
                stripe_invoice_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

        db.run(`CREATE TABLE IF NOT EXISTS user_api_keys(
                id TEXT PRIMARY KEY,
                user_id TEXT,
                organization_id TEXT,
                provider TEXT,
                display_name TEXT,
                encrypted_key TEXT,
                model_preference TEXT,
                is_active INTEGER DEFAULT 1,
                is_default INTEGER DEFAULT 0,
                usage_count INTEGER DEFAULT 0,
                last_used_at DATETIME,
                rate_limit INTEGER, --requests per minute/hour
                quota_limit INTEGER, --total requests quota
                quota_used INTEGER DEFAULT 0, --current usage
                quota_reset_at DATETIME, --when quota resets
                expires_at DATETIME, --key expiration date
                ip_whitelist TEXT, --JSON array of allowed IPs
                scopes TEXT, --JSON array of permission scopes
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )`);

        // Migrate existing user_api_keys table - add new columns if they don't exist
        // SQLite doesn't support IF NOT EXISTS for columns, so we use error callback approach
        const addColumnIfNotExists = (table, column, definition) => {
            db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`, (err) => {
                // Ignore duplicate column errors
                if (err && !err.message.includes('duplicate column')) {
                    console.warn(`[DB] ${table} ${column} column error:`, err.message);
                }
            });
        };
        
        addColumnIfNotExists('user_api_keys', 'rate_limit', 'INTEGER');
        addColumnIfNotExists('user_api_keys', 'quota_limit', 'INTEGER');
        addColumnIfNotExists('user_api_keys', 'quota_used', 'INTEGER DEFAULT 0');
        addColumnIfNotExists('user_api_keys', 'quota_reset_at', 'DATETIME');
        addColumnIfNotExists('user_api_keys', 'expires_at', 'DATETIME');
        addColumnIfNotExists('user_api_keys', 'ip_whitelist', 'TEXT');
        addColumnIfNotExists('user_api_keys', 'scopes', 'TEXT');

        // 1. SUBSCRIPTION PLANS (Superadmin-managed)
        db.run(`CREATE TABLE IF NOT EXISTS subscription_plans(
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                price_monthly REAL NOT NULL,
                token_limit INTEGER,
                storage_limit_gb REAL,
                token_overage_rate REAL,
                storage_overage_rate REAL,
                stripe_price_id TEXT,
                features TEXT DEFAULT '{}', --JSON: printing, analytics_level, etc.
            is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

        // 1.5 USER LICENSE PLANS (New)
        db.run(`CREATE TABLE IF NOT EXISTS user_license_plans(
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL, --Standard, Premium
            price_monthly REAL NOT NULL,
                features TEXT DEFAULT '{}', --JSON
            is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

        // 2. ORGANIZATION BILLING (per tenant)
        db.run(`CREATE TABLE IF NOT EXISTS organization_billing(
                id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL UNIQUE,
                subscription_plan_id TEXT,
                stripe_customer_id TEXT,
                stripe_subscription_id TEXT,
                billing_email TEXT,
                billing_address TEXT,
                payment_method_last4 TEXT,
                payment_method_brand TEXT,
                current_period_start DATETIME,
                current_period_end DATETIME,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                FOREIGN KEY(subscription_plan_id) REFERENCES subscription_plans(id)
            )`);

        // 3. USAGE RECORDS (detailed token/storage tracking)
        db.run(`CREATE TABLE IF NOT EXISTS usage_records(
                id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL,
                user_id TEXT,
                type TEXT NOT NULL,
                amount INTEGER NOT NULL,
                action TEXT,
                metadata TEXT,
                recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
            )`);

        // 4. MONTHLY USAGE SUMMARIES (for billing)
        db.run(`CREATE TABLE IF NOT EXISTS usage_summaries(
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
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(organization_id, period_start)
            )`);

        // 5. INVOICES (for history & reconciliation)
        db.run(`CREATE TABLE IF NOT EXISTS invoices(
                id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL,
                stripe_invoice_id TEXT UNIQUE,
                amount_due REAL,
                amount_paid REAL,
                status TEXT, --paid, open, void, uncollectible
            period_start DATETIME,
                period_end DATETIME,
                pdf_url TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
            )`);

        // User License Link
        db.run(`ALTER TABLE users ADD COLUMN license_plan_id TEXT`, (err) => {
            // Ignore if exists
        });

        db.run(`ALTER TABLE users ADD COLUMN phone TEXT`, (err) => {
            // Ignore if exists
        });

        // Add features column to subscription_plans if not exists (for existing dbs)
        db.run(`ALTER TABLE subscription_plans ADD COLUMN features TEXT DEFAULT '{}'`, (err) => {
            // Ignore if exists
        });

        // SEED PRICING DATA
        const seedPricing = async () => {
            const { v4: uuidv4 } = require('uuid');

            // ORG PLANS
            const orgPlans = [
                { id: 'plan-trial', name: 'Trial (7 Days)', price: 0, tokens: 10000, storage: 1, features: JSON.stringify({ printing: false, analytics: 'basic', duration_days: 7 }) },
                { id: 'plan-pro', name: 'Pro', price: 299, tokens: 500000, storage: 50, features: JSON.stringify({ printing: true, analytics: 'standard' }) },
                { id: 'plan-elite', name: 'Elite', price: 999, tokens: 2000000, storage: 500, features: JSON.stringify({ printing: true, analytics: 'advanced' }) },
                { id: 'plan-enterprise', name: 'Enterprise', price: 2999, tokens: 10000000, storage: 5000, features: JSON.stringify({ printing: true, analytics: 'full', support: 'dedicated' }) }
            ];

            const insertOrgPlan = db.prepare(`INSERT OR IGNORE INTO subscription_plans(id, name, price_monthly, token_limit, storage_limit_gb, features) VALUES(?, ?, ?, ?, ?, ?)`);
            for (const p of orgPlans) {
                insertOrgPlan.run(p.id, p.name, p.price, p.tokens, p.storage, p.features);
            }
            insertOrgPlan.finalize();

            // USER LICENSES
            const userPlans = [
                { id: 'license-standard', name: 'Standard User', price: 20, features: JSON.stringify({ access: 'standard' }) },
                { id: 'license-premium', name: 'Premium User', price: 100, features: JSON.stringify({ access: 'full' }) }
            ];

            const insertUserPlan = db.prepare(`INSERT OR IGNORE INTO user_license_plans(id, name, price_monthly, features) VALUES(?, ?, ?, ?)`);
            for (const p of userPlans) {
                insertUserPlan.run(p.id, p.name, p.price, p.features);
            }
            insertUserPlan.finalize();
        };
        seedPricing();


        console.log('Created billing tables and seeded default subscription plans.');

        // ==========================================
        // PHASE: PROFESSIONAL BILLING SYSTEM ENHANCEMENTS
        // ==========================================

        // 1. ORGANIZATION SEATS (Seat Management)
        db.run(`CREATE TABLE IF NOT EXISTS organization_seats(
                id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL UNIQUE,
                base_seats_included INTEGER DEFAULT 0,
                additional_seats_purchased INTEGER DEFAULT 0,
                total_seats_available INTEGER DEFAULT 0,
                seats_used INTEGER DEFAULT 0,
                billing_model TEXT DEFAULT 'subscription' CHECK(billing_model IN('subscription', 'pay_as_you_go', 'hybrid')),
                seat_price_monthly REAL DEFAULT 0,
                auto_add_seats_on_invite INTEGER DEFAULT 0,
                auto_add_seats_threshold INTEGER DEFAULT 80,
                seat_pool_enabled INTEGER DEFAULT 1,
                reserved_seats INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
            )`);

        // 2. SEAT TRANSACTIONS (History of seat purchases/releases)
        db.run(`CREATE TABLE IF NOT EXISTS seat_transactions(
                id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL,
                transaction_type TEXT NOT NULL CHECK(transaction_type IN('purchase', 'release', 'auto_add', 'manual_adjustment')),
                seats_count INTEGER NOT NULL,
                unit_price REAL DEFAULT 0,
                total_amount REAL DEFAULT 0,
                stripe_invoice_item_id TEXT,
                billing_period_start DATETIME,
                billing_period_end DATETIME,
                triggered_by TEXT DEFAULT 'admin' CHECK(triggered_by IN('admin', 'auto', 'invite', 'webhook')),
                triggered_by_user_id TEXT,
                reason TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                FOREIGN KEY(triggered_by_user_id) REFERENCES users(id) ON DELETE SET NULL
            )`);

        // 3. Extend SUBSCRIPTION_PLANS with seat-related fields
        db.run(`ALTER TABLE subscription_plans ADD COLUMN seats_included INTEGER DEFAULT 0`, (err) => {
            // Ignore if exists
        });
        db.run(`ALTER TABLE subscription_plans ADD COLUMN seat_price_monthly REAL DEFAULT 0`, (err) => {
            // Ignore if exists
        });
        db.run(`ALTER TABLE subscription_plans ADD COLUMN billing_model TEXT DEFAULT 'subscription'`, (err) => {
            // Ignore if exists
        });
        db.run(`ALTER TABLE subscription_plans ADD COLUMN allow_seat_pooling INTEGER DEFAULT 0`, (err) => {
            // Ignore if exists
        });
        db.run(`ALTER TABLE subscription_plans ADD COLUMN max_seats INTEGER DEFAULT -1`, (err) => {
            // Ignore if exists (-1 = unlimited)
        });

        // 4. USER BUDGETS (Budget management per user)
        db.run(`CREATE TABLE IF NOT EXISTS user_budgets(
                id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                monthly_token_budget INTEGER DEFAULT NULL,
                monthly_storage_budget_gb REAL DEFAULT NULL,
                monthly_cost_budget_usd REAL DEFAULT NULL,
                tokens_used_this_month INTEGER DEFAULT 0,
                storage_used_this_month_gb REAL DEFAULT 0,
                cost_this_month_usd REAL DEFAULT 0,
                budget_alert_80 INTEGER DEFAULT 1,
                budget_alert_90 INTEGER DEFAULT 1,
                budget_alert_100 INTEGER DEFAULT 1,
                hard_limit_enabled INTEGER DEFAULT 0,
                auto_upgrade_on_limit INTEGER DEFAULT 0,
                last_reset_date DATE,
                reset_day_of_month INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(organization_id, user_id)
            )`);

        // 5. PROJECT BUDGETS (Budget management per project)
        db.run(`CREATE TABLE IF NOT EXISTS project_budgets(
                id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL,
                project_id TEXT NOT NULL,
                monthly_token_budget INTEGER DEFAULT NULL,
                monthly_storage_budget_gb REAL DEFAULT NULL,
                monthly_cost_budget_usd REAL DEFAULT NULL,
                tokens_used_this_month INTEGER DEFAULT 0,
                storage_used_this_month_gb REAL DEFAULT 0,
                cost_this_month_usd REAL DEFAULT 0,
                budget_alert_80 INTEGER DEFAULT 1,
                budget_alert_90 INTEGER DEFAULT 1,
                budget_alert_100 INTEGER DEFAULT 1,
                hard_limit_enabled INTEGER DEFAULT 0,
                auto_upgrade_on_limit INTEGER DEFAULT 0,
                last_reset_date DATE,
                reset_day_of_month INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
                UNIQUE(organization_id, project_id)
            )`);

        // 6. Create billing_alerts table if it doesn't exist
        db.run(`CREATE TABLE IF NOT EXISTS billing_alerts(
                id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL UNIQUE,
                token_threshold_80 INTEGER DEFAULT 1,
                token_threshold_90 INTEGER DEFAULT 1,
                token_threshold_100 INTEGER DEFAULT 1,
                storage_threshold_80 INTEGER DEFAULT 1,
                storage_threshold_90 INTEGER DEFAULT 1,
                storage_threshold_100 INTEGER DEFAULT 1,
                seat_threshold_80 INTEGER DEFAULT 1,
                seat_threshold_90 INTEGER DEFAULT 1,
                seat_threshold_100 INTEGER DEFAULT 1,
                user_budget_alerts_enabled INTEGER DEFAULT 1,
                project_budget_alerts_enabled INTEGER DEFAULT 1,
                alert_channels TEXT DEFAULT '["email"]',
                alert_frequency TEXT DEFAULT 'once' CHECK(alert_frequency IN('once', 'daily', 'weekly')),
                admin_notification_threshold REAL DEFAULT 1000,
                auto_upgrade_enabled INTEGER DEFAULT 0,
                auto_upgrade_plan_id TEXT,
                cost_cap_monthly REAL DEFAULT NULL,
                email_notifications INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                FOREIGN KEY(auto_upgrade_plan_id) REFERENCES subscription_plans(id)
            )`);

        // 7. ADMIN BILLING ALERTS (Advanced alerting system)
        db.run(`CREATE TABLE IF NOT EXISTS admin_billing_alerts(
                id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL,
                alert_type TEXT NOT NULL CHECK(alert_type IN('cost_spike', 'usage_anomaly', 'budget_exceeded', 'seat_limit_reached')),
                severity TEXT DEFAULT 'medium' CHECK(severity IN('low', 'medium', 'high', 'critical')),
                cost_threshold_usd REAL DEFAULT NULL,
                usage_threshold_percent REAL DEFAULT NULL,
                seat_threshold_percent REAL DEFAULT NULL,
                notify_admins INTEGER DEFAULT 1,
                notify_billing_contact INTEGER DEFAULT 1,
                notify_superadmin INTEGER DEFAULT 0,
                email_enabled INTEGER DEFAULT 1,
                slack_webhook_url TEXT DEFAULT NULL,
                webhook_url TEXT DEFAULT NULL,
                alert_frequency TEXT DEFAULT 'once' CHECK(alert_frequency IN('once', 'daily', 'weekly')),
                cooldown_hours INTEGER DEFAULT 24,
                is_active INTEGER DEFAULT 1,
                last_triggered_at DATETIME DEFAULT NULL,
                trigger_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
            )`);

        // 8. SPENDING ALERTS (User-configurable alerts for SpendingAlertsView)
        db.run(`CREATE TABLE IF NOT EXISTS spending_alerts(
                id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('AI_TOKENS', 'STORAGE', 'USERS', 'TOTAL_SPEND')),
                threshold REAL NOT NULL,
                threshold_type TEXT NOT NULL CHECK(threshold_type IN ('PERCENTAGE', 'ABSOLUTE')),
                action TEXT NOT NULL CHECK(action IN ('NOTIFY', 'NOTIFY_AND_PAUSE', 'HARD_LIMIT')),
                notify_emails TEXT NOT NULL DEFAULT '[]',
                is_active INTEGER DEFAULT 1,
                last_triggered_at DATETIME DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
            )`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_spending_alerts_org ON spending_alerts(organization_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_spending_alerts_type ON spending_alerts(type)`);

        // 9. PAY-AS-YOU-GO USAGE (PAYG tracking)
        db.run(`CREATE TABLE IF NOT EXISTS pay_as_you_go_usage(
                id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL,
                user_id TEXT DEFAULT NULL,
                project_id TEXT DEFAULT NULL,
                usage_type TEXT NOT NULL CHECK(usage_type IN('tokens', 'storage', 'seats', 'api_calls')),
                quantity REAL NOT NULL,
                unit_price REAL NOT NULL,
                total_cost REAL NOT NULL,
                billing_period_start DATETIME NOT NULL,
                billing_period_end DATETIME NOT NULL,
                stripe_invoice_item_id TEXT DEFAULT NULL,
                invoiced INTEGER DEFAULT 0,
                metadata TEXT DEFAULT '{}',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL
            )`);

        // Create indexes for performance
        db.run(`CREATE INDEX IF NOT EXISTS idx_seat_transactions_org ON seat_transactions(organization_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_seat_transactions_type ON seat_transactions(transaction_type)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_user_budgets_org ON user_budgets(organization_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_user_budgets_user ON user_budgets(user_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_project_budgets_org ON project_budgets(organization_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_project_budgets_project ON project_budgets(project_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_admin_billing_alerts_org ON admin_billing_alerts(organization_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_admin_billing_alerts_type ON admin_billing_alerts(alert_type)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_payg_usage_org ON pay_as_you_go_usage(organization_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_payg_usage_period ON pay_as_you_go_usage(billing_period_start, billing_period_end)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_payg_usage_type ON pay_as_you_go_usage(usage_type)`);

        console.log('Created professional billing system enhancement tables.');

        // ==========================================
        // PHASE 5: ENTERPRISE STORAGE UPGRADE
        // ==========================================

        // 1. PROJECT STORAGE & LIFECYCLE
        // Add columns to PROJECTS if they don't exist
        const projectStorageCols = [
            { name: 'storage_limit_gb', type: 'REAL', default: 'NULL' }, // NULL means inherit Org limit
            { name: 'storage_used_bytes', type: 'INTEGER', default: '0' },
            { name: 'is_archived', type: 'INTEGER', default: '0' },
            { name: 'archived_at', type: 'DATETIME', default: 'NULL' }
        ];

        projectStorageCols.forEach(col => {
            db.run(`ALTER TABLE projects ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.default} `, (err) => {
                // Ignore if exists
            });
        });

        // 2. KNOWLEDGE DOCS ISOLATION
        // Add columns to KNOWLEDGE_DOCS (Documents)
        const docStorageCols = [
            { name: 'organization_id', type: 'TEXT', default: 'NULL' },
            { name: 'project_id', type: 'TEXT', default: 'NULL' },
            { name: 'file_size_bytes', type: 'INTEGER', default: '0' },
            { name: 'deleted_at', type: 'DATETIME', default: 'NULL' }, // Soft delete
            { name: 'category', type: 'TEXT', default: 'NULL' }, // Category for documents
            { name: 'tags', type: 'TEXT', default: "'[]'" }, // JSON array of tags
            { name: 'version', type: 'INTEGER', default: '1' }, // Document versioning
            { name: 'parent_doc_id', type: 'TEXT', default: 'NULL' } // Reference to previous version
        ];

        docStorageCols.forEach(col => {
            db.run(`ALTER TABLE knowledge_docs ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.default} `, (err) => {
                // Ignore if exists
            });
        });

        // Ensure project_id is NULL for global knowledge docs (organization-level only)
        db.run(`UPDATE knowledge_docs SET project_id = NULL WHERE project_id IS NOT NULL`, (err) => {
            // Ignore errors - this is a migration step
        });

        // 3. STORAGE AUDIT LOG (Physical File Reconciliation)
        db.run(`CREATE TABLE IF NOT EXISTS storage_audit_logs(
                id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL,
                action TEXT, -- 'reconciliation', 'cleanup'
            files_scanned INTEGER,
                files_deleted INTEGER,
                space_reclaimed_bytes INTEGER,
                discrepancies_found INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

        // ==========================================
        // PHASE 5: MEGATREND SCANNER
        // ==========================================

        // Megatrends (Baseline Data)
        db.run(`CREATE TABLE IF NOT EXISTS megatrends(
                id TEXT PRIMARY KEY,
                industry TEXT NOT NULL,
                type TEXT NOT NULL, --Technology, Business, Societal
            label TEXT NOT NULL,
                description TEXT,
                base_impact_score REAL,
                initial_ring TEXT DEFAULT 'Watch Closely'
            )`);

        // Custom Trends (Company Specific)
        db.run(`CREATE TABLE IF NOT EXISTS custom_trends(
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                industry TEXT,
                type TEXT,
                label TEXT NOT NULL,
                description TEXT,
                ring TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(company_id) REFERENCES organizations(id) ON DELETE CASCADE
            )`);

        // ==========================================
        // PHASE 6: REPORT BUILDER (Added Fix)
        // ==========================================

        db.run(`CREATE TABLE IF NOT EXISTS reports(
                id TEXT PRIMARY KEY,
                project_id TEXT,
                organization_id TEXT,
                title TEXT,
                status TEXT DEFAULT 'draft',
                version INTEGER DEFAULT 1,
                block_order TEXT DEFAULT '[]', --JSON array of block IDs
            sources TEXT DEFAULT '[]', --JSON array of sources used
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
            )`);

        db.run(`CREATE TABLE IF NOT EXISTS report_blocks(
                id TEXT PRIMARY KEY,
                report_id TEXT NOT NULL,
                type TEXT NOT NULL, --text, table, chart, etc.
            title TEXT,
                module TEXT, --Origin module
            content TEXT, --JSON content
            meta TEXT, --JSON metadata(layout, chart config)
            position INTEGER DEFAULT 0,
                locked INTEGER DEFAULT 0, --boolean
            ai_regeneratable INTEGER DEFAULT 1, --boolean
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(report_id) REFERENCES reports(id) ON DELETE CASCADE
            )`);

        // ==========================================
        // AI ENTERPRISE CONTROL LAYERS
        // ==========================================

        // AI-1: Budget Management
        db.run(`CREATE TABLE IF NOT EXISTS ai_budgets(
                id TEXT PRIMARY KEY,
                scope_type TEXT NOT NULL, -- 'global' | 'tenant' | 'project'
            scope_id TEXT,
                monthly_limit_usd REAL,
                current_month_usage REAL DEFAULT 0,
                reset_day INTEGER DEFAULT 1,
                auto_downgrade INTEGER DEFAULT 1, --auto - downgrade when exceeded
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(scope_type, scope_id)
            )`);

        // AI-1: Usage Logging (Audit)
        db.run(`CREATE TABLE IF NOT EXISTS ai_usage_log(
                id TEXT PRIMARY KEY,
                organization_id TEXT,
                project_id TEXT,
                user_id TEXT,
                model_used TEXT,
                model_category TEXT, --reasoning | execution | chat | summarization
            action_type TEXT, --chat | analysis | generation | etc.
            input_tokens INTEGER,
                output_tokens INTEGER,
                estimated_cost_usd REAL,
                actual_cost_usd REAL,
                was_downgraded INTEGER DEFAULT 0,
                downgrade_reason TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(organization_id) REFERENCES organizations(id),
                FOREIGN KEY(project_id) REFERENCES projects(id),
                FOREIGN KEY(user_id) REFERENCES users(id)
            )`);

        // AI-1: Model Categories Configuration
        db.run(`CREATE TABLE IF NOT EXISTS ai_model_config(
                id TEXT PRIMARY KEY,
                provider_id TEXT,
                category TEXT NOT NULL, --reasoning | execution | chat | summarization
            priority_tier INTEGER DEFAULT 1, --1=premium, 2 = standard, 3 = budget
            cost_per_1k_input REAL,
                cost_per_1k_output REAL,
                max_context_tokens INTEGER,
                capabilities TEXT, --JSON array of capabilities
            is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(provider_id) REFERENCES llm_providers(id)
            )`);

        // AI-2: Hierarchical Prompts (Versioned)
        db.run(`CREATE TABLE IF NOT EXISTS ai_system_prompts(
                id TEXT PRIMARY KEY,
                prompt_type TEXT NOT NULL, -- 'system' | 'role' | 'phase'
            prompt_key TEXT NOT NULL, --e.g., 'ADVISOR', 'Context', 'GLOBAL'
            content TEXT NOT NULL,
                version INTEGER DEFAULT 1,
                is_active INTEGER DEFAULT 1,
                created_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(prompt_type, prompt_key, version)
            )`);

        // AI-2: User Prompt Preferences
        db.run(`CREATE TABLE IF NOT EXISTS ai_user_prompt_prefs(
                user_id TEXT PRIMARY KEY,
                preferred_tone TEXT DEFAULT 'PROFESSIONAL', --PROFESSIONAL | FRIENDLY | EXPERT
            education_mode INTEGER DEFAULT 0,
                language_preference TEXT DEFAULT 'en',
                custom_instructions TEXT,
                max_response_length TEXT DEFAULT 'medium', --short | medium | long
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )`);

        // AI-3: Project RAG Settings
        db.run(`CREATE TABLE IF NOT EXISTS project_rag_settings(
                project_id TEXT PRIMARY KEY,
                rag_enabled INTEGER DEFAULT 1,
                max_chunks_per_query INTEGER DEFAULT 5,
                min_relevance_score REAL DEFAULT 0.5,
                knowledge_visibility TEXT DEFAULT 'project', -- 'project' | 'organization'
            prefer_internal_knowledge INTEGER DEFAULT 1,
                include_citations INTEGER DEFAULT 1,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(project_id) REFERENCES projects(id)
            )`);

        // AI-4: External Data Settings
        db.run(`CREATE TABLE IF NOT EXISTS external_data_settings(
                id TEXT PRIMARY KEY,
                scope_type TEXT NOT NULL, -- 'tenant' | 'project'
            scope_id TEXT NOT NULL,
                enabled INTEGER DEFAULT 0, --disabled by default
                allowed_providers TEXT, --JSON array of allowed providers
            max_queries_per_day INTEGER DEFAULT 100,
                require_labeling INTEGER DEFAULT 1,
                enabled_by TEXT,
                enabled_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(scope_type, scope_id),
                FOREIGN KEY(enabled_by) REFERENCES users(id)
            )`);

        // AI-4: External Data Audit Log
        db.run(`CREATE TABLE IF NOT EXISTS external_data_log(
                id TEXT PRIMARY KEY,
                organization_id TEXT,
                project_id TEXT,
                user_id TEXT,
                query TEXT,
                provider TEXT,
                sources_count INTEGER,
                sources_used TEXT, --JSON array of source URLs
            response_summary TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(organization_id) REFERENCES organizations(id),
                FOREIGN KEY(project_id) REFERENCES projects(id),
                FOREIGN KEY(user_id) REFERENCES users(id)
            )`);

        // AI-5: Integration Configurations
        db.run(`CREATE TABLE IF NOT EXISTS integration_configs(
                id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL,
                project_id TEXT,
                integration_type TEXT NOT NULL, --task_sync | notifications | calendar | document
            provider TEXT NOT NULL, --jira | clickup | slack | teams | etc.
            config TEXT, --Encrypted JSON configuration
            webhook_url TEXT,
                webhook_secret TEXT,
                is_active INTEGER DEFAULT 0,
                last_sync_at DATETIME,
                sync_direction TEXT DEFAULT 'bidirectional', --inbound | outbound | bidirectional
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(organization_id) REFERENCES organizations(id),
                FOREIGN KEY(project_id) REFERENCES projects(id)
            )`);

        // AI-5: Pending Sync Actions (AI suggestions requiring approval)
        db.run(`CREATE TABLE IF NOT EXISTS integration_pending_actions(
                id TEXT PRIMARY KEY,
                organization_id TEXT,
                project_id TEXT,
                integration_id TEXT,
                action_type TEXT, --create_task | update_task | send_notification | sync_status
            target_entity_type TEXT, --task | initiative | decision | etc.
            target_entity_id TEXT,
                payload TEXT, --JSON payload to send
            suggested_by TEXT DEFAULT 'ai', -- 'ai' | 'system' | 'user'
            suggestion_reason TEXT,
                status TEXT DEFAULT 'pending', --pending | approved | rejected | executed | expired
            approved_by TEXT,
                approved_at DATETIME,
                rejected_reason TEXT,
                executed_at DATETIME,
                execution_result TEXT,
                expires_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(organization_id) REFERENCES organizations(id),
                FOREIGN KEY(project_id) REFERENCES projects(id),
                FOREIGN KEY(integration_id) REFERENCES integration_configs(id),
                FOREIGN KEY(approved_by) REFERENCES users(id)
            )`);

        // AI-5: Integration Sync Log
        db.run(`CREATE TABLE IF NOT EXISTS integration_sync_log(
                id TEXT PRIMARY KEY,
                integration_id TEXT,
                direction TEXT, --inbound | outbound
            action_type TEXT,
                external_id TEXT,
                external_url TEXT,
                internal_entity_type TEXT,
                internal_entity_id TEXT,
                status TEXT, --success | failed | partial
            error_message TEXT,
                sync_data TEXT, --JSON of synced data
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(integration_id) REFERENCES integration_configs(id)
            )`);

        // ==========================================
        // INTEGRATION ANALYTICS & MONITORING
        // ==========================================

        // API Usage Logs - track all API calls per integration
        db.run(`CREATE TABLE IF NOT EXISTS api_usage_logs(
                id TEXT PRIMARY KEY,
                user_id TEXT,
                integration_id TEXT,
                api_key_id TEXT,
                endpoint TEXT,
                method TEXT DEFAULT 'GET',
                status_code INTEGER,
                response_time_ms INTEGER,
                tokens_used INTEGER DEFAULT 0,
                cost REAL DEFAULT 0,
                request_body TEXT, --JSON
                response_body TEXT, --JSON (truncated)
                error_message TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY(integration_id) REFERENCES integration_configs(id) ON DELETE SET NULL,
                FOREIGN KEY(api_key_id) REFERENCES user_api_keys(id) ON DELETE SET NULL
            )`);

        // Webhook Delivery Logs - track webhook deliveries
        db.run(`CREATE TABLE IF NOT EXISTS webhook_delivery_logs(
                id TEXT PRIMARY KEY,
                webhook_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                status TEXT DEFAULT 'pending', --'success', 'failed', 'retrying', 'pending'
                response_code INTEGER,
                response_time_ms INTEGER,
                retry_count INTEGER DEFAULT 0,
                error_message TEXT,
                payload TEXT, --JSON payload sent
                response_body TEXT, --JSON response received
                delivered_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
            )`);

        // Integration Health Checks - periodic health status
        db.run(`CREATE TABLE IF NOT EXISTS integration_health_checks(
                id TEXT PRIMARY KEY,
                integration_id TEXT NOT NULL,
                status TEXT DEFAULT 'healthy', --'healthy', 'degraded', 'down'
                latency_ms INTEGER,
                error_message TEXT,
                check_type TEXT DEFAULT 'ping', --'ping', 'auth', 'api', 'sync'
                checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(integration_id) REFERENCES integration_configs(id) ON DELETE CASCADE
            )`);

        // Integration Analytics - aggregated daily/hourly stats
        db.run(`CREATE TABLE IF NOT EXISTS integration_analytics(
                id TEXT PRIMARY KEY,
                integration_id TEXT NOT NULL,
                period_type TEXT DEFAULT 'daily', --'hourly', 'daily', 'weekly', 'monthly'
                period_start DATETIME NOT NULL,
                period_end DATETIME NOT NULL,
                total_requests INTEGER DEFAULT 0,
                successful_requests INTEGER DEFAULT 0,
                failed_requests INTEGER DEFAULT 0,
                total_tokens INTEGER DEFAULT 0,
                total_cost REAL DEFAULT 0,
                avg_response_time_ms REAL DEFAULT 0,
                error_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(integration_id) REFERENCES integration_configs(id) ON DELETE CASCADE,
                UNIQUE(integration_id, period_type, period_start)
            )`);

        // ==========================================
        // WORKFLOW AUTOMATIONS
        // ==========================================

        // Automation Workflows - workflow definitions
        db.run(`CREATE TABLE IF NOT EXISTS automation_workflows(
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                organization_id TEXT,
                name TEXT NOT NULL,
                description TEXT,
                trigger_type TEXT NOT NULL, --'event', 'schedule', 'webhook', 'manual'
                trigger_config TEXT, --JSON: event filters, schedule cron, webhook config
                actions TEXT NOT NULL, --JSON array of action definitions
                conditions TEXT, --JSON: conditional logic (if/then/else)
                is_active INTEGER DEFAULT 1,
                last_executed_at DATETIME,
                execution_count INTEGER DEFAULT 0,
                success_count INTEGER DEFAULT 0,
                failure_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
            )`);

        // Automation Executions - execution history
        db.run(`CREATE TABLE IF NOT EXISTS automation_executions(
                id TEXT PRIMARY KEY,
                workflow_id TEXT NOT NULL,
                trigger_data TEXT, --JSON: data that triggered the workflow
                status TEXT DEFAULT 'running', --'running', 'completed', 'failed', 'cancelled'
                result TEXT, --JSON: execution result
                error_message TEXT,
                started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME,
                execution_time_ms INTEGER,
                FOREIGN KEY(workflow_id) REFERENCES automation_workflows(id) ON DELETE CASCADE
            )`);

        // Automation Triggers - trigger configurations (normalized)
        db.run(`CREATE TABLE IF NOT EXISTS automation_triggers(
                id TEXT PRIMARY KEY,
                workflow_id TEXT NOT NULL,
                trigger_type TEXT NOT NULL, --'event', 'schedule', 'webhook'
                event_type TEXT, --for event triggers: 'task.created', 'initiative.updated', etc.
                schedule_cron TEXT, --for schedule triggers: cron expression
                webhook_url TEXT, --for webhook triggers
                filter_conditions TEXT, --JSON: additional filter conditions
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(workflow_id) REFERENCES automation_workflows(id) ON DELETE CASCADE
            )`);

        // Automation Actions - action configurations (normalized)
        db.run(`CREATE TABLE IF NOT EXISTS automation_actions(
                id TEXT PRIMARY KEY,
                workflow_id TEXT NOT NULL,
                action_type TEXT NOT NULL, --'create_task', 'update_field', 'send_notification', 'call_api', etc.
                action_order INTEGER DEFAULT 0, --order of execution
                target_integration_id TEXT, --which integration to use
                action_config TEXT NOT NULL, --JSON: action-specific configuration
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(workflow_id) REFERENCES automation_workflows(id) ON DELETE CASCADE,
                FOREIGN KEY(target_integration_id) REFERENCES integration_configs(id) ON DELETE SET NULL
            )`);

        // Data Mappings - field mappings between systems
        db.run(`CREATE TABLE IF NOT EXISTS data_mappings(
                id TEXT PRIMARY KEY,
                workflow_id TEXT NOT NULL,
                source_field TEXT NOT NULL, --field path in source system (e.g., 'task.title')
                target_field TEXT NOT NULL, --field path in target system (e.g., 'issue.summary')
                transformation TEXT, --JSONPath/JQ expression for transformation
                default_value TEXT, --default if source field is empty
                is_required INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(workflow_id) REFERENCES automation_workflows(id) ON DELETE CASCADE
            )`);

        // ==========================================
        // AI PMO INTELLIGENCE LAYERS (AI-6 to AI-11)
        // ==========================================

        // AI-6: Decision Briefs (AI-generated context for decisions)
        db.run(`CREATE TABLE IF NOT EXISTS decision_briefs(
                id TEXT PRIMARY KEY,
                decision_id TEXT NOT NULL,
                context_summary TEXT,
                options TEXT, --JSON array of options with pros / cons
            risks TEXT, --JSON array of risks
            ai_recommendation TEXT,
        recommendation_rationale TEXT,
            recommendation_confidence REAL,
                data_sources_used TEXT, --JSON array of sources
            generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(decision_id) REFERENCES decisions(id) ON DELETE CASCADE
        )`);

        // AI-6: Decision Impact Tracking
        db.run(`CREATE TABLE IF NOT EXISTS decision_impacts(
            id TEXT PRIMARY KEY,
            decision_id TEXT NOT NULL,
            impacted_type TEXT NOT NULL, --initiative | task | roadmap | project
            impacted_id TEXT NOT NULL,
            impact_description TEXT,
            is_blocker INTEGER DEFAULT 0,
            blocking_since DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(decision_id) REFERENCES decisions(id) ON DELETE CASCADE
        )`);

        // AI-7: Risk Register
        db.run(`CREATE TABLE IF NOT EXISTS risk_register(
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            organization_id TEXT,
            risk_type TEXT NOT NULL, --delivery | capacity | dependency | decision | change_fatigue
            severity TEXT DEFAULT 'medium', --low | medium | high | critical
            likelihood TEXT DEFAULT 'medium', --low | medium | high
            title TEXT NOT NULL,
            description TEXT,
            trigger_conditions TEXT, --What triggered detection
            affected_entities TEXT, --JSON array of affected items
            mitigation_plan TEXT,
            owner_id TEXT,
            status TEXT DEFAULT 'open', --open | mitigating | resolved | accepted | escalated
            detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            detected_by TEXT DEFAULT 'ai', --ai | user
            escalated_at DATETIME,
            resolved_at DATETIME,
            resolution_notes TEXT,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(owner_id) REFERENCES users(id)
        )`);

        // AI-7: Scope Change Log
        db.run(`CREATE TABLE IF NOT EXISTS scope_change_log(
            id TEXT PRIMARY KEY,
            project_id TEXT,
            organization_id TEXT,
            entity_type TEXT NOT NULL, --initiative | roadmap | task | project
            entity_id TEXT NOT NULL,
            change_type TEXT NOT NULL, --add | remove | modify | expand | reduce
            change_summary TEXT,
            field_changed TEXT, --Which field was changed
            previous_value TEXT,
            new_value TEXT,
            is_controlled INTEGER DEFAULT 1, --Was it through proper approval ?
            change_reason TEXT,
            approved_by TEXT,
            changed_by TEXT,
            changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(project_id) REFERENCES projects(id),
            FOREIGN KEY(approved_by) REFERENCES users(id),
            FOREIGN KEY(changed_by) REFERENCES users(id)
        )`);

        // AI-8: User Capacity Profiles
        db.run(`CREATE TABLE IF NOT EXISTS user_capacity_profile(
            user_id TEXT PRIMARY KEY,
            organization_id TEXT,
            default_weekly_hours REAL DEFAULT 40,
            role_type TEXT DEFAULT 'full_time', --full_time | part_time | contractor
            capacity_unit TEXT DEFAULT 'hours', --hours | points | percentage
            vacation_calendar TEXT, --JSON of planned absences
            skills TEXT, --JSON array of skills
            max_concurrent_initiatives INTEGER DEFAULT 3,
            preferred_work_types TEXT, --JSON array
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(organization_id) REFERENCES organizations(id)
        )`);

        // AI-8: Workload Snapshots (for trend analysis)
        db.run(`CREATE TABLE IF NOT EXISTS workload_snapshots(
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            project_id TEXT,
            organization_id TEXT,
            snapshot_date DATE NOT NULL,
            allocated_hours REAL,
            available_hours REAL,
            utilization_percent REAL,
            task_count INTEGER,
            initiative_count INTEGER,
            burnout_risk_score REAL, --0 - 100
            is_overloaded INTEGER DEFAULT 0,
            trend_direction TEXT, --improving | stable | worsening
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(project_id) REFERENCES projects(id)
        )`);

        // AI-9: Maturity Assessments
        db.run(`CREATE TABLE IF NOT EXISTS maturity_assessments(
            id TEXT PRIMARY KEY,
            project_id TEXT,
            organization_id TEXT,
            assessment_date DATE NOT NULL,
            planning_score REAL, --0 - 5
            decision_score REAL, --0 - 5
            execution_score REAL, --0 - 5
            governance_score REAL, --0 - 5
            adoption_score REAL, --0 - 5
            overall_score REAL, --Average
            overall_level INTEGER, --1 - 5(Initial to Optimizing)
            insights TEXT, --JSON of observations
            recommendations TEXT, --JSON of recommendations
            benchmarks_used TEXT, --JSON of comparison data
            assessed_by TEXT DEFAULT 'ai',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(project_id) REFERENCES projects(id),
            FOREIGN KEY(organization_id) REFERENCES organizations(id)
        )`);

        // AI-9: Discipline Events (for pattern detection)
        db.run(`CREATE TABLE IF NOT EXISTS discipline_events(
            id TEXT PRIMARY KEY,
            project_id TEXT,
            organization_id TEXT,
            event_type TEXT NOT NULL, --missed_deadline | late_decision | scope_creep | blocked_task | stalled_initiative
            severity TEXT DEFAULT 'medium',
            entity_type TEXT,
            entity_id TEXT,
            description TEXT,
            root_cause TEXT,
            occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            detected_by TEXT DEFAULT 'ai',
            FOREIGN KEY(project_id) REFERENCES projects(id)
        )`);

        // AI-11: AI Failure Log
        db.run(`CREATE TABLE IF NOT EXISTS ai_failure_log(
            id TEXT PRIMARY KEY,
            failure_type TEXT NOT NULL, --model_unavailable | budget_exceeded | context_incomplete | rate_limited | timeout
            context TEXT, --JSON context of the request
            user_id TEXT,
            organization_id TEXT,
            project_id TEXT,
            error_message TEXT,
            error_code TEXT,
            fallback_used TEXT, --What fallback was applied
            recovery_action TEXT,
            user_notified INTEGER DEFAULT 0,
            occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(organization_id) REFERENCES organizations(id)
        )`);

        // AI-11: AI Health Status (singleton table for monitoring)
        db.run(`CREATE TABLE IF NOT EXISTS ai_health_status(
            id TEXT PRIMARY KEY DEFAULT 'singleton',
            overall_status TEXT DEFAULT 'healthy', --healthy | degraded | unavailable
            model_status TEXT DEFAULT 'available', --available | limited | unavailable
            budget_status TEXT DEFAULT 'ok', --ok | warning | exceeded
            knowledge_status TEXT DEFAULT 'ok', --ok | empty | error
            integration_status TEXT DEFAULT 'ok',
            last_successful_call DATETIME,
            last_failure DATETIME,
            failure_count_24h INTEGER DEFAULT 0,
            last_check_at DATETIME,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // ==========================================
        // STEP 4: PROMO CODES & ATTRIBUTION EXTENSIONS
        // Enterprise+ commercial backbone foundation
        // ==========================================

        // Add partner_id column to promo_codes for partner settlements link
        db.run(`ALTER TABLE promo_codes ADD COLUMN partner_id TEXT`, (err) => {
            // Ignore if exists
        });

        // Add revenue_amount and currency to attribution_events for settlement calculations  
        db.run(`ALTER TABLE attribution_events ADD COLUMN revenue_amount REAL DEFAULT 0`, (err) => {
            // Ignore if exists
        });
        db.run(`ALTER TABLE attribution_events ADD COLUMN currency TEXT DEFAULT 'USD'`, (err) => {
            // Ignore if exists
        });

        // Create index on partner_id for promo_codes
        db.run(`CREATE INDEX IF NOT EXISTS idx_promo_codes_partner ON promo_codes(partner_id)`);

        // ==========================================
        // STEP 5: PARTNER SETTLEMENTS
        // Enterprise+ revenue sharing and partner payouts ledger
        // ==========================================

        /**
         * Partners Table
         * Referral partners, resellers, and sales partners.
         */
        db.run(`CREATE TABLE IF NOT EXISTS partners(
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            partner_type TEXT NOT NULL, --REFERRAL | RESELLER | SALES
            email TEXT,
            contact_name TEXT,
            default_revenue_share_percent REAL DEFAULT 10,
            is_active INTEGER DEFAULT 1,
            metadata TEXT DEFAULT '{}',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_partners_type ON partners(partner_type, is_active)`);

        /**
         * Partner Agreements Table
         * Allows changing revenue share terms over time (enterprise must-have).
         * Valid agreement is determined by date range.
         */
        db.run(`CREATE TABLE IF NOT EXISTS partner_agreements(
            id TEXT PRIMARY KEY,
            partner_id TEXT NOT NULL,
            valid_from DATETIME NOT NULL,
            valid_until DATETIME, --NULL = indefinitely valid
            revenue_share_percent REAL NOT NULL,
            applies_to TEXT DEFAULT 'GLOBAL', --GLOBAL | CAMPAIGN | PRODUCT
            applies_value TEXT, --Campaign / product ID if scoped
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(partner_id) REFERENCES partners(id) ON DELETE CASCADE
        )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_partner_agreements_partner ON partner_agreements(partner_id, valid_from)`);

        /**
         * Settlement Periods Table (IMMUTABLE after LOCKED)
         * 
         * Status flow: OPEN → CALCULATED → LOCKED
         * Once LOCKED, no changes allowed.
         */
        db.run(`CREATE TABLE IF NOT EXISTS settlement_periods(
            id TEXT PRIMARY KEY,
            period_start DATETIME NOT NULL,
            period_end DATETIME NOT NULL,
            status TEXT DEFAULT 'OPEN', --OPEN | CALCULATED | LOCKED
            calculated_at DATETIME,
            calculated_by TEXT,
            locked_at DATETIME,
            locked_by TEXT,
            total_revenue REAL DEFAULT 0,
            total_settlements REAL DEFAULT 0,
            partner_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(calculated_by) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY(locked_by) REFERENCES users(id) ON DELETE SET NULL
        )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_settlement_periods_status ON settlement_periods(status)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_settlement_periods_dates ON settlement_periods(period_start, period_end)`);

        /**
         * Partner Settlements Table (IMMUTABLE - append-only)
         * 
         * CRITICAL: This table is append-only for audit compliance.
         * Never UPDATE or DELETE rows from this table.
         * After period is LOCKED, no new rows can be added for that period.
         * Corrections require new adjustment entries in a new period.
         * 
         * Each row tracks:
         * - Which partner gets paid
         * - For which organization's revenue
         * - From which attribution event
         * - Using which agreement's terms
         * - Entry type (NORMAL or ADJUSTMENT for corrections)
         */
        db.run(`CREATE TABLE IF NOT EXISTS partner_settlements(
            id TEXT PRIMARY KEY,
            settlement_period_id TEXT NOT NULL,
            partner_id TEXT NOT NULL,
            organization_id TEXT NOT NULL,
            source_attribution_id TEXT NOT NULL,
            revenue_amount REAL NOT NULL,
            revenue_share_percent REAL NOT NULL,
            settlement_amount REAL NOT NULL,
            currency TEXT DEFAULT 'USD',
            agreement_id TEXT,
            entry_type TEXT DEFAULT 'NORMAL', --NORMAL | ADJUSTMENT
            adjusts_settlement_id TEXT, --FK to original settlement being corrected
            adjustment_reason TEXT, --Required if entry_type = ADJUSTMENT
            metadata TEXT DEFAULT '{}', --calculation timestamp, rate source, etc.
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(settlement_period_id) REFERENCES settlement_periods(id),
            FOREIGN KEY(partner_id) REFERENCES partners(id),
                FOREIGN KEY(organization_id) REFERENCES organizations(id),
                    FOREIGN KEY(source_attribution_id) REFERENCES attribution_events(id),
                        FOREIGN KEY(agreement_id) REFERENCES partner_agreements(id),
                            FOREIGN KEY(adjusts_settlement_id) REFERENCES partner_settlements(id)
        )`);

        // Migration: Add adjustment columns to existing table
        db.run(`ALTER TABLE partner_settlements ADD COLUMN entry_type TEXT DEFAULT 'NORMAL'`, () => { });
        db.run(`ALTER TABLE partner_settlements ADD COLUMN adjusts_settlement_id TEXT`, () => { });
        db.run(`ALTER TABLE partner_settlements ADD COLUMN adjustment_reason TEXT`, () => { });

        db.run(`CREATE INDEX IF NOT EXISTS idx_partner_settlements_period ON partner_settlements(settlement_period_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_partner_settlements_partner ON partner_settlements(partner_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_partner_settlements_org ON partner_settlements(organization_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_partner_settlements_attribution ON partner_settlements(source_attribution_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_partner_settlements_entry_type ON partner_settlements(entry_type)`);

        // ==========================================
        // STEP 6: IN-APP HELP + TRAINING + PLAYBOOKS
        // Enterprise+ contextual help and user guidance system
        // ==========================================

        /**
         * Help Playbooks Table
         * 
         * Stores contextual help sequences that guide users through features.
         * Playbooks are filtered by organization type (DEMO/TRIAL/PAID) and user role.
         */
        db.run(`CREATE TABLE IF NOT EXISTS help_playbooks(
                                id TEXT PRIMARY KEY,
                                key TEXT UNIQUE NOT NULL, --Unique key e.g. "trial_expired", "invite_users"
            title TEXT NOT NULL,
                                description TEXT,
                                target_role TEXT DEFAULT 'ANY', --ADMIN | USER | SUPERADMIN | PARTNER | ANY
            target_org_type TEXT DEFAULT 'ANY', --DEMO | TRIAL | PAID | ANY
            priority INTEGER DEFAULT 3, --1 - 5(1 = highest priority)
            is_active INTEGER DEFAULT 1,
                                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                            )`);

        /**
         * Help Steps Table
         * 
         * Individual steps within each playbook.
         * Steps are displayed in order and can link to specific UI elements or routes.
         */
        db.run(`CREATE TABLE IF NOT EXISTS help_steps(
                                id TEXT PRIMARY KEY,
                                playbook_id TEXT NOT NULL,
                                step_order INTEGER NOT NULL,
                                title TEXT NOT NULL,
                                content_md TEXT NOT NULL, --Markdown content
            ui_target TEXT, --CSS selector or route path
            action_type TEXT DEFAULT 'INFO', --INFO | CTA | LINK
            action_payload TEXT DEFAULT '{}', --JSON payload for CTA / LINK actions
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(playbook_id) REFERENCES help_playbooks(id) ON DELETE CASCADE
        )`);

        /**
         * Help Events Table (AUDIT / ANALYTICS)
         * 
         * CRITICAL: This table is APPEND-ONLY for audit compliance.
         * Never UPDATE or DELETE rows. All interactions are logged for analytics.
         */
        db.run(`CREATE TABLE IF NOT EXISTS help_events(
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            organization_id TEXT NOT NULL,
            playbook_key TEXT,
            event_type TEXT NOT NULL, --VIEWED | STARTED | COMPLETED | DISMISSED | SEARCH
            content_type TEXT,
            content_id TEXT,
            metadata TEXT, --JSON
            step_id TEXT,
            action TEXT,
            context TEXT DEFAULT '{}', --JSON context
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);

        /**
         * Help Feedback Table
         * Specific feedback on help content (was/was not helpful)
         */
        db.run(`CREATE TABLE IF NOT EXISTS help_feedback(
            id TEXT PRIMARY KEY,
            user_id TEXT,
            organization_id TEXT,
            content_type TEXT,
            content_id TEXT,
            is_helpful BOOLEAN,
            rating INTEGER,
            comment TEXT,
            metadata TEXT, --JSON
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);

        // Indexes for Help System performance
        db.run(`CREATE INDEX IF NOT EXISTS idx_help_playbooks_key ON help_playbooks(key)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_help_playbooks_target ON help_playbooks(target_org_type, target_role, is_active)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_help_steps_playbook ON help_steps(playbook_id, step_order)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_help_events_user ON help_events(user_id, playbook_key)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_help_events_org ON help_events(organization_id, event_type)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_help_events_created ON help_events(created_at)`);

        // ==========================================
        // STEP 7: METRICS & CONVERSION INTELLIGENCE
        // Enterprise+ Decision Layer
        // ==========================================


        /**
         * Help Analytics Table
         * General usage tracking (Views, Searches, Video Progress)
         */
        db.run(`CREATE TABLE IF NOT EXISTS help_analytics(
            id TEXT PRIMARY KEY,
            user_id TEXT,
            organization_id TEXT,
            session_id TEXT,
            event_type TEXT NOT NULL, --view, search, click, complete, video_progress
            content_type TEXT,
            content_id TEXT,
            metadata TEXT, --JSON
            duration_ms INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);

        /**
         * Metrics Events Table (APPEND-ONLY - Single Source of Truth)
         * 
         * CRITICAL: This table is APPEND-ONLY for audit compliance.
         * NEVER UPDATE or DELETE rows - all business intelligence is derived from this.
         * 
         * Event Sources:
         * - trial_started: Trial organization created
         * - trial_extended: Trial period extended
         * - trial_expired: Trial expired without upgrade
         * - upgraded_to_paid: Trial converted to paid plan
         * - demo_started: Demo session initiated
         * - invite_sent: Invitation email sent
         * - invite_accepted: User accepted invitation
         * - help_started: User started a playbook
         * - help_completed: User completed a playbook
         * - settlement_generated: Partner settlement calculated
         */
        db.run(`CREATE TABLE IF NOT EXISTS metrics_events(
            id TEXT PRIMARY KEY,
            event_type TEXT NOT NULL,
            user_id TEXT,
            organization_id TEXT,
            source TEXT,
            context TEXT DEFAULT '{}',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);

        // Indexes for metrics_events performance
        db.run(`CREATE INDEX IF NOT EXISTS idx_metrics_events_type ON metrics_events(event_type)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_metrics_events_org ON metrics_events(organization_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_metrics_events_created ON metrics_events(created_at)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_metrics_events_source ON metrics_events(source)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_metrics_events_type_created ON metrics_events(event_type, created_at)`);

        /**
         * Metrics Snapshots Table (Materialized Views)
         * 
         * Generated daily via cron for dashboard performance.
         * Can be rebuilt from metrics_events at any time (idempotent).
         * 
         * Metric Keys:
         * - funnel_demo_to_trial: Demo to Trial conversion rate
         * - funnel_trial_to_paid: Trial to Paid conversion rate
         * - funnel_help_completion: Help playbook completion rate
         * - funnel_attribution_conversion: Attribution channel conversion rates
         * - avg_days_to_upgrade: Average days from trial to paid
         * - trial_expiry_rate: Trials that expire without action
         * - partner_revenue: Revenue per partner
         * - help_effectiveness: Help leading to action rate
         */
        db.run(`CREATE TABLE IF NOT EXISTS metrics_snapshots(
            id TEXT PRIMARY KEY,
            snapshot_date DATE NOT NULL,
            metric_key TEXT NOT NULL,
            metric_value REAL NOT NULL,
            dimensions TEXT DEFAULT '{}',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Indexes for metrics_snapshots performance
        db.run(`CREATE INDEX IF NOT EXISTS idx_snapshots_date ON metrics_snapshots(snapshot_date)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_snapshots_key ON metrics_snapshots(metric_key)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_snapshots_date_key ON metrics_snapshots(snapshot_date, metric_key)`);

        // Unique constraint for snapshot deduplication (allows rebuilding)
        db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_snapshots_unique ON metrics_snapshots(snapshot_date, metric_key, dimensions)`);

        /**
         * Action Decisions Table (IMMUTABLE AUDIT LOG)
         * Step 9.2: Approval & Audit Layer
         * Captures human decisions (Approved, Rejected, Modified) for AI Action Proposals.
         */
        db.run(`CREATE TABLE IF NOT EXISTS action_decisions(
            id TEXT PRIMARY KEY,
            proposal_id TEXT NOT NULL,
            organization_id TEXT, --Added for RBAC hardening
            correlation_id TEXT, --Step 9.5: For tracing proposal→decision→execution
            decision TEXT, --APPROVED | REJECTED | MODIFIED(Nullable for pending)
            decided_by_user_id TEXT, --Nullable for pending
            decision_reason TEXT,
        action_type TEXT NOT NULL, --Denormalized for filtering
            scope TEXT NOT NULL, --Denormalized for filtering
            status TEXT DEFAULT 'PENDING', --PENDING | DECIDED
            proposal_snapshot TEXT, --Full JSON of AI proposal(Step 9.2 alignment)
            original_payload TEXT, --JSON(deprecated, use snapshot)
            modified_payload TEXT, --JSON(only if MODIFIED)
            archived_at DATETIME, --Step 9.7: For retention policy
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(decided_by_user_id) REFERENCES users(id) ON DELETE SET NULL
        )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_action_decisions_proposal ON action_decisions(proposal_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_action_decisions_user ON action_decisions(decided_by_user_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_action_decisions_correlation ON action_decisions(correlation_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_action_decisions_org_created ON action_decisions(organization_id, created_at)`);

        /**
         * Action Executions Table (APPEND-ONLY)
         * Step 9.3: Execution Adapter
         * Logs the result of executing approved decisions.
         */
        db.run(`CREATE TABLE IF NOT EXISTS action_executions(
            id TEXT PRIMARY KEY,
            decision_id TEXT NOT NULL,
            proposal_id TEXT NOT NULL, --Consistency
            action_type TEXT NOT NULL, --Consistency
            organization_id TEXT NOT NULL, --Consistency
            correlation_id TEXT NOT NULL, --Step 9.5: For tracing
            executed_by TEXT DEFAULT 'SYSTEM',
            status TEXT NOT NULL, --SUCCESS | FAILED
            result TEXT, --JSON
            error_code TEXT, --For diagnostics(uses ACTION_ERROR_CODES)
            error_message TEXT, --For diagnostics
            duration_ms INTEGER, --Step 9.5: Execution duration
            archived_at DATETIME, --Step 9.7: For retention policy
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(decision_id) REFERENCES action_decisions(id)
        )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_action_executions_decision ON action_executions(decision_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_action_exec_org_created ON action_executions(organization_id, created_at)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_action_executions_correlation ON action_executions(correlation_id)`);

        // ==========================================
        // STEP 9.8: POLICY ENGINE
        // AI Auto-Approval & Threshold Rules
        // ==========================================

        /**
         * AI Policy Rules Table
         * 
         * Defines rules for conditional auto-approval of AI Action Proposals.
         * Policy Engine is deterministic, auditable, and always overridable.
         */
        db.run(`CREATE TABLE IF NOT EXISTS ai_policy_rules(
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            enabled INTEGER DEFAULT 1,
            action_type TEXT NOT NULL, --TASK_CREATE | PLAYBOOK_ASSIGN | etc.
            scope TEXT NOT NULL, --USER | ORG | INITIATIVE
            max_risk_level TEXT NOT NULL, --LOW | MEDIUM | HIGH
            conditions JSON NOT NULL, --Rule conditions JSON
            auto_decision TEXT NOT NULL, --APPROVED | MODIFIED
            auto_decision_reason TEXT NOT NULL,
            created_by_user_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
        )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_policy_rules_org ON ai_policy_rules(organization_id, enabled)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_policy_rules_action ON ai_policy_rules(action_type, scope)`);

        // Migration: Add policy_rule_id to action_decisions for auto-approval tracking
        db.run(`ALTER TABLE action_decisions ADD COLUMN policy_rule_id TEXT`, () => { });

        /**
         * Global Policy Engine Settings (Singleton)
         */
        db.run(`CREATE TABLE IF NOT EXISTS ai_policy_settings(
            id TEXT PRIMARY KEY DEFAULT 'singleton',
            policy_engine_enabled INTEGER DEFAULT 1,
            updated_by TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Ensure singleton row exists
        db.run(`INSERT OR IGNORE INTO ai_policy_settings(id) VALUES('singleton')`);

        // ==========================================
        // STEP 10: AI PLAYBOOKS (Multi-Step Action Plans)
        // ==========================================

        /**
         * AI Playbook Templates
         * Defines reusable multi-step action sequences triggered by signals.
         */
        db.run(`CREATE TABLE IF NOT EXISTS ai_playbook_templates(
            id TEXT PRIMARY KEY,
            key TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            trigger_signal TEXT,
            estimated_duration_mins INTEGER,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_ai_playbook_templates_key ON ai_playbook_templates(key)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_ai_playbook_templates_signal ON ai_playbook_templates(trigger_signal)`);

        /**
         * AI Playbook Template Steps
         * Individual actions within a playbook template.
         */
        db.run(`CREATE TABLE IF NOT EXISTS ai_playbook_template_steps(
            id TEXT PRIMARY KEY,
            template_id TEXT NOT NULL,
            step_order INTEGER NOT NULL,
            action_type TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            payload_template TEXT,
            is_optional INTEGER DEFAULT 0,
            wait_for_previous INTEGER DEFAULT 1,
            FOREIGN KEY(template_id) REFERENCES ai_playbook_templates(id) ON DELETE CASCADE
        )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_ai_playbook_steps_template ON ai_playbook_template_steps(template_id)`);

        /**
         * AI Playbook Runs
         * Execution instances of playbook templates.
         */
        db.run(`CREATE TABLE IF NOT EXISTS ai_playbook_runs(
            id TEXT PRIMARY KEY,
            template_id TEXT NOT NULL,
            organization_id TEXT NOT NULL,
            correlation_id TEXT NOT NULL,
            initiated_by TEXT NOT NULL,
            status TEXT NOT NULL,
            context_snapshot TEXT,
            started_at DATETIME,
            completed_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(template_id) REFERENCES ai_playbook_templates(id)
        )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_ai_playbook_runs_template ON ai_playbook_runs(template_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_ai_playbook_runs_org ON ai_playbook_runs(organization_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_ai_playbook_runs_correlation ON ai_playbook_runs(correlation_id)`);

        /**
         * AI Playbook Run Steps
         * Progress tracking for each step in a run.
         */
        db.run(`CREATE TABLE IF NOT EXISTS ai_playbook_run_steps(
            id TEXT PRIMARY KEY,
            run_id TEXT NOT NULL,
            template_step_id TEXT NOT NULL,
            decision_id TEXT,
            execution_id TEXT,
            status TEXT NOT NULL,
            resolved_payload TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(run_id) REFERENCES ai_playbook_runs(id) ON DELETE CASCADE
        )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_ai_playbook_run_steps_run ON ai_playbook_run_steps(run_id)`);

        // ==========================================
        // STEP 13: VISUAL PLAYBOOK EDITOR - VERSIONING
        // Template versioning, graph model, publish workflow
        // ==========================================

        // Add versioning columns to ai_playbook_templates
        db.run(`ALTER TABLE ai_playbook_templates ADD COLUMN version INTEGER DEFAULT 1`, () => { });
        db.run(`ALTER TABLE ai_playbook_templates ADD COLUMN status TEXT DEFAULT 'DRAFT'`, () => { });
        db.run(`ALTER TABLE ai_playbook_templates ADD COLUMN published_at DATETIME`, () => { });
        db.run(`ALTER TABLE ai_playbook_templates ADD COLUMN published_by_user_id TEXT`, () => { });
        db.run(`ALTER TABLE ai_playbook_templates ADD COLUMN template_graph TEXT`, () => { });
        db.run(`ALTER TABLE ai_playbook_templates ADD COLUMN parent_template_id TEXT`, () => { });

        // Indexes for versioning queries
        db.run(`CREATE INDEX IF NOT EXISTS idx_ai_playbook_templates_status_signal ON ai_playbook_templates(status, trigger_signal)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_ai_playbook_templates_parent ON ai_playbook_templates(parent_template_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_ai_playbook_templates_status ON ai_playbook_templates(status)`);

        // ==========================================
        // STEP 11: ASYNC / QUEUE / SAGA EXECUTION
        // Job Registry for Async Action & Playbook Execution
        // ==========================================

        /**
         * Async Jobs Table (Job Registry - Append-Only)
         * 
         * DB is source of truth, queue (BullMQ) is execution mechanism.
         * Tracks all async jobs for Action Decisions and Playbook Step Advances.
         */
        db.run(`CREATE TABLE IF NOT EXISTS async_jobs(
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL, --EXECUTE_DECISION | ADVANCE_PLAYBOOK_STEP
            organization_id TEXT NOT NULL,
            correlation_id TEXT NOT NULL,
            entity_id TEXT NOT NULL, --decisionId or playbookRunStepId
            status TEXT NOT NULL DEFAULT 'QUEUED', --QUEUED | RUNNING | SUCCESS | FAILED | DEAD_LETTER | CANCELLED
            priority TEXT DEFAULT 'normal', --low | normal | high
            attempts INTEGER DEFAULT 0,
            max_attempts INTEGER DEFAULT 3,
            last_error_code TEXT,
            last_error_message TEXT,
            scheduled_at DATETIME,
            started_at DATETIME,
            finished_at DATETIME,
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_async_jobs_org_created ON async_jobs(organization_id, created_at)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_async_jobs_status ON async_jobs(status)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_async_jobs_type_entity ON async_jobs(type, entity_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_async_jobs_correlation ON async_jobs(correlation_id)`);

        // Migration: Add job_id to action_executions for linking
        db.run(`ALTER TABLE action_executions ADD COLUMN job_id TEXT`, () => { });

        // Migration: Add job_id and async_status to ai_playbook_run_steps
        db.run(`ALTER TABLE ai_playbook_run_steps ADD COLUMN job_id TEXT`, () => { });
        db.run(`ALTER TABLE ai_playbook_run_steps ADD COLUMN async_status TEXT`, () => { });

        // ==========================================
        // STEP 12: CONDITIONAL BRANCHING & DYNAMIC PLAYBOOKS
        // Extends Step 10 with branching, routing, and debug traces.
        // ==========================================

        /**
         * Extend ai_playbook_template_steps with branching support.
         * step_type: ACTION | CHECK | WAIT | BRANCH | AI_ROUTER
         * next_step_id: Default next step for linear flow
         * branch_rules: JSON for conditional routing
         * inputs_schema: JSON Schema of required inputs
         * outputs_schema: JSON Schema of produced outputs
         */
        db.run(`ALTER TABLE ai_playbook_template_steps ADD COLUMN step_type TEXT DEFAULT 'ACTION'`, () => { });
        db.run(`ALTER TABLE ai_playbook_template_steps ADD COLUMN next_step_id TEXT`, () => { });
        db.run(`ALTER TABLE ai_playbook_template_steps ADD COLUMN branch_rules TEXT`, () => { });
        db.run(`ALTER TABLE ai_playbook_template_steps ADD COLUMN inputs_schema TEXT DEFAULT '{}'`, () => { });
        db.run(`ALTER TABLE ai_playbook_template_steps ADD COLUMN outputs_schema TEXT DEFAULT '{}'`, () => { });

        /**
         * Extend ai_playbook_run_steps with routing trace support.
         * status_reason: Human-readable reason for status
         * outputs: JSON of step outputs (for CHECK/BRANCH evaluation)
         * selected_next_step_id: Which step was routed to after branching
         * evaluation_trace: Debug JSON with matched rule and context snapshot
         */
        db.run(`ALTER TABLE ai_playbook_run_steps ADD COLUMN status_reason TEXT`, () => { });
        db.run(`ALTER TABLE ai_playbook_run_steps ADD COLUMN outputs TEXT DEFAULT '{}'`, () => { });
        db.run(`ALTER TABLE ai_playbook_run_steps ADD COLUMN selected_next_step_id TEXT`, () => { });
        db.run(`ALTER TABLE ai_playbook_run_steps ADD COLUMN evaluation_trace TEXT DEFAULT '{}'`, () => { });

        // ==========================================
        // STEP 17: INTEGRATIONS & SECRETS PLATFORM
        // Connector framework with encrypted secrets vault
        // ==========================================

        /**
         * Connectors Catalog (Reference Table)
         * Stores available integration connectors with capabilities.
         */
        db.run(`CREATE TABLE IF NOT EXISTS connectors(
            key TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            capabilities_json TEXT NOT NULL DEFAULT '[]',
            icon_url TEXT,
            documentation_url TEXT,
            required_scopes_json TEXT DEFAULT '[]',
            is_available INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        /**
         * Organization Connector Configurations
         * Stores per-org connector configs with encrypted secrets (AES-256-GCM).
         */
        db.run(`CREATE TABLE IF NOT EXISTS org_connector_configs(
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL,
            connector_key TEXT NOT NULL,
            status TEXT DEFAULT 'DISCONNECTED',
            encrypted_secrets TEXT,
            scopes_json TEXT DEFAULT '[]',
            sandbox_mode INTEGER DEFAULT 0,
            configured_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(org_id, connector_key),
            FOREIGN KEY(org_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(connector_key) REFERENCES connectors(key),
            FOREIGN KEY(configured_by) REFERENCES users(id) ON DELETE SET NULL
        )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_org_connector_configs_org ON org_connector_configs(org_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_org_connector_configs_status ON org_connector_configs(status)`);

        /**
         * Connector Health Monitoring
         * Tracks health status of each org's connector configuration.
         */
        db.run(`CREATE TABLE IF NOT EXISTS connector_health(
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL,
            connector_key TEXT NOT NULL,
            last_check_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_ok_at DATETIME,
            last_error_code TEXT,
            last_error_message TEXT,
            consecutive_failures INTEGER DEFAULT 0,
            UNIQUE(org_id, connector_key),
            FOREIGN KEY(org_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(connector_key) REFERENCES connectors(key)
        )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_connector_health_org ON connector_health(org_id)`);

        // Seed default connectors catalog
        const connectorsCatalog = [
            { key: 'jira', name: 'Jira Cloud', category: 'project_management', capabilities: ['issue_create', 'issue_update', 'issue_read', 'webhook'] },
            { key: 'google_calendar', name: 'Google Calendar', category: 'calendar', capabilities: ['event_create', 'event_update', 'event_read'] },
            { key: 'slack', name: 'Slack', category: 'communication', capabilities: ['message_send', 'channel_read', 'webhook'] },
            { key: 'teams', name: 'Microsoft Teams', category: 'communication', capabilities: ['message_send', 'channel_read'] },
            { key: 'hubspot', name: 'HubSpot', category: 'crm', capabilities: ['contact_create', 'contact_update', 'deal_create', 'deal_update'] }
        ];

        const insertConnector = db.prepare(`INSERT OR IGNORE INTO connectors(key, name, category, capabilities_json) VALUES(?, ?, ?, ?)`);
        connectorsCatalog.forEach(c => {
            insertConnector.run(c.key, c.name, c.category, JSON.stringify(c.capabilities));
        });
        insertConnector.finalize();

        // ==========================================
        // STEP 18: OUTCOMES, ROI & CONTINUOUS LEARNING LOOP
        // Outcome tracking, ROI dashboards, effectiveness measurement
        // ==========================================

        /**
         * Outcome Definitions Table
         * Defines what metrics to track per action type or playbook template.
         * Each org can customize their outcome tracking criteria.
         */
        db.run(`CREATE TABLE IF NOT EXISTS outcome_definitions(
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL,
            entity_type TEXT NOT NULL, --ACTION_TYPE | PLAYBOOK_TEMPLATE
            entity_key TEXT NOT NULL, --e.g., 'TASK_CREATE' or playbook template key
            metrics_tracked TEXT NOT NULL DEFAULT '{}', --JSON: { "tasks_completed": true, "time_saved_mins": true }
            measurement_window_days INTEGER DEFAULT 7,
            baseline_query TEXT, --Optional custom SQL for baseline
            success_criteria TEXT DEFAULT '{}', --JSON: { "tasks_completed_delta": "> 0" }
            is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(org_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_outcome_definitions_org ON outcome_definitions(org_id, entity_type)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_outcome_definitions_entity ON outcome_definitions(entity_type, entity_key)`);

        /**
         * Outcome Measurements Table (APPEND-ONLY for Audit)
         * Stores before/after snapshots for each action/playbook execution.
         * Delta is computed after measurement window.
         */
        db.run(`CREATE TABLE IF NOT EXISTS outcome_measurements(
                    id TEXT PRIMARY KEY,
                    org_id TEXT NOT NULL,
                    definition_id TEXT NOT NULL,
                    run_id TEXT, --Link to ai_playbook_runs(nullable)
            execution_id TEXT, --Link to action_executions(nullable)
            entity_type TEXT NOT NULL,
                    entity_key TEXT NOT NULL,
                    baseline_json TEXT NOT NULL DEFAULT '{}',
                    after_json TEXT DEFAULT '{}',
                    delta_json TEXT DEFAULT '{}',
                    is_success INTEGER, --Computed based on success_criteria
            baseline_captured_at DATETIME NOT NULL,
                    after_captured_at DATETIME,
                    computed_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(org_id) REFERENCES organizations(id) ON DELETE CASCADE,
                    FOREIGN KEY(definition_id) REFERENCES outcome_definitions(id) ON DELETE SET NULL
                )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_outcome_measurements_org ON outcome_measurements(org_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_outcome_measurements_run ON outcome_measurements(run_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_outcome_measurements_exec ON outcome_measurements(execution_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_outcome_measurements_computed ON outcome_measurements(computed_at)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_outcome_measurements_success ON outcome_measurements(org_id, is_success)`);

        /**
         * ROI Models Table
         * Defines assumptions and formulas for ROI calculations.
         * Each org can have multiple models, one is default.
         */
        db.run(`CREATE TABLE IF NOT EXISTS roi_models(
                    id TEXT PRIMARY KEY,
                    org_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT,
                    assumptions TEXT NOT NULL DEFAULT '{}', --JSON: { "hourly_cost": 75, "downtime_cost_per_hour": 500 }
            metric_mappings TEXT NOT NULL DEFAULT '{}', --JSON: { "time_saved_mins": { "formula": "value * (hourly_cost/60)" } }
            is_default INTEGER DEFAULT 0,
                    created_by TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(org_id) REFERENCES organizations(id) ON DELETE CASCADE,
                    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
                )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_roi_models_org ON roi_models(org_id, is_default)`);

        // ==========================================
        // STEP 16: HUMAN WORKFLOW, SLA, ESCALATION & NOTIFICATIONS
        // Assignment tracking, SLA timers, escalations, notification outbox
        // ==========================================

        /**
         * Approval Assignments Table
         * 
         * Tracks assignment of proposals to specific users with SLA deadlines.
         * Status flow: PENDING → ACKED → DONE | EXPIRED
         * Supports escalation when SLA expires.
         */
        db.run(`CREATE TABLE IF NOT EXISTS approval_assignments(
                    id TEXT PRIMARY KEY,
                    org_id TEXT NOT NULL,
                    proposal_id TEXT NOT NULL,
                    assigned_to_user_id TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'PENDING', --PENDING | ACKED | DONE | EXPIRED
            sla_due_at DATETIME NOT NULL,
                    escalated_to_user_id TEXT,
                    escalated_at DATETIME,
                    escalation_reason TEXT,
                    acked_at DATETIME,
                    completed_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(org_id) REFERENCES organizations(id) ON DELETE CASCADE,
                    FOREIGN KEY(assigned_to_user_id) REFERENCES users(id) ON DELETE SET NULL,
                    FOREIGN KEY(escalated_to_user_id) REFERENCES users(id) ON DELETE SET NULL
                )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_approval_assignments_org ON approval_assignments(org_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_approval_assignments_user ON approval_assignments(assigned_to_user_id, status)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_approval_assignments_proposal ON approval_assignments(proposal_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_approval_assignments_sla ON approval_assignments(sla_due_at, status)`);

        /**
         * User Notification Preferences Table
         * 
         * Per-user notification settings covering channels and event types.
         * Unique constraint per user/org combination.
         */
        db.run(`CREATE TABLE IF NOT EXISTS user_notification_preferences(
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    org_id TEXT NOT NULL,
                    channel_email INTEGER DEFAULT 1,
                    channel_slack INTEGER DEFAULT 0,
                    channel_teams INTEGER DEFAULT 0,
                    event_approval_due INTEGER DEFAULT 1,
                    event_playbook_stuck INTEGER DEFAULT 1,
                    event_dead_letter INTEGER DEFAULT 1,
                    event_escalation INTEGER DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY(org_id) REFERENCES organizations(id) ON DELETE CASCADE,
                    UNIQUE(user_id, org_id)
                )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_user_notification_prefs_user ON user_notification_preferences(user_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_user_notification_prefs_org ON user_notification_preferences(org_id)`);

        /**
         * Notification Outbox Table (APPEND-ONLY)
         * 
         * CRITICAL: This table is APPEND-ONLY for reliability.
         * Implements outbox pattern for async notification delivery.
         * Status flow: QUEUED → SENT | FAILED
         */
        db.run(`CREATE TABLE IF NOT EXISTS notification_outbox(
                    id TEXT PRIMARY KEY,
                    org_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    notification_type TEXT NOT NULL, --APPROVAL_DUE | PLAYBOOK_STUCK | DEAD_LETTER | ESCALATION
            payload_json TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'QUEUED', --QUEUED | SENT | FAILED
            channel TEXT NOT NULL DEFAULT 'email',
                    attempts INTEGER DEFAULT 0,
                    last_attempt_at DATETIME,
                    sent_at DATETIME,
                    error_message TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(org_id) REFERENCES organizations(id) ON DELETE CASCADE,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_notification_outbox_status ON notification_outbox(status)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_notification_outbox_user ON notification_outbox(user_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_notification_outbox_org ON notification_outbox(org_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_notification_outbox_created ON notification_outbox(created_at)`);

        // ==========================================
        // STEP 15: EXPLAINABILITY LEDGER & EVIDENCE PACK
        // Evidence objects, explainability links, and reasoning ledger
        // ==========================================

        /**
         * AI Evidence Objects Table
         * 
         * Stores raw evidence (metrics, signals, docs, events) used for AI decisions.
         * Payloads are redacted before storage to prevent PII exposure.
         * Types: METRIC_SNAPSHOT | SIGNAL | DOC_REF | USER_EVENT | SYSTEM_EVENT
         */
        db.run(`CREATE TABLE IF NOT EXISTS ai_evidence_objects(
                    id TEXT PRIMARY KEY,
                    org_id TEXT NOT NULL,
                    type TEXT NOT NULL,
                    source TEXT NOT NULL,
                    payload_json TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(org_id) REFERENCES organizations(id) ON DELETE CASCADE
                )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_ai_evidence_objects_org ON ai_evidence_objects(org_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_ai_evidence_objects_type ON ai_evidence_objects(type, created_at)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_ai_evidence_objects_source ON ai_evidence_objects(source)`);

        /**
         * AI Explainability Links Table
         * 
         * Links evidence objects to AI entities (proposals, decisions, executions, run_steps).
         * Many-to-many relationship with weight (0-1) for importance scoring.
         */
        db.run(`CREATE TABLE IF NOT EXISTS ai_explainability_links(
                    id TEXT PRIMARY KEY,
                    from_type TEXT NOT NULL,
                    from_id TEXT NOT NULL,
                    evidence_id TEXT NOT NULL,
                    weight REAL DEFAULT 1.0,
                    note TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(evidence_id) REFERENCES ai_evidence_objects(id) ON DELETE CASCADE
                )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_ai_explainability_links_from ON ai_explainability_links(from_type, from_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_ai_explainability_links_evidence ON ai_explainability_links(evidence_id)`);

        /**
         * AI Reasoning Ledger Table (IMMUTABLE)
         * 
         * Server-generated reasoning summaries. CRITICAL: No client input allowed.
         * Each entry is immutable - corrections require new entries.
         */
        db.run(`CREATE TABLE IF NOT EXISTS ai_reasoning_ledger(
                    id TEXT PRIMARY KEY,
                    entity_type TEXT NOT NULL,
                    entity_id TEXT NOT NULL,
                    reasoning_summary TEXT NOT NULL,
                    assumptions_json TEXT DEFAULT '[]',
                    confidence REAL NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_ai_reasoning_ledger_entity ON ai_reasoning_ledger(entity_type, entity_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_ai_reasoning_ledger_confidence ON ai_reasoning_ledger(confidence)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_ai_reasoning_ledger_created ON ai_reasoning_ledger(created_at)`);

        // ==========================================
        // STEP 19: ENTERPRISE GOVERNANCE LAYER
        // ==========================================

        /**
         * Permissions Table (PBAC)
         * Granular permissions that can be assigned to roles.
         */
        db.run(`CREATE TABLE IF NOT EXISTS permissions(
                    id TEXT PRIMARY KEY,
                    scope TEXT NOT NULL, --global, organization, project
            resource TEXT NOT NULL, --e.g. 'financials', 'settings', 'ai_ops'
            action TEXT NOT NULL, --create, read, update, delete, approve
            name TEXT NOT NULL,
                    description TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(scope, resource, action)
                )`);

        /**
         * Role Permissions Table
         * Maps defined roles (e.g. 'ORG_ADMIN', 'PMO_MANAGER') to specific permissions.
         * Compatible with permissionService.js which uses 'role' and 'permission_key'.
         */
        db.run(`CREATE TABLE IF NOT EXISTS role_permissions(
                    id TEXT PRIMARY KEY,
                    role TEXT NOT NULL,
                    permission_key TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(role, permission_key),
                    FOREIGN KEY(permission_key) REFERENCES permissions(key) ON DELETE CASCADE
                )`);

        /**
         * Organization User Permissions (Overrides)
         * Specific permissions granted to a user within an org, independent of their role.
         * Uses permission_key (string) instead of permission_id for compatibility with permissionService.
         */
        db.run(`CREATE TABLE IF NOT EXISTS org_user_permissions(
                    id TEXT PRIMARY KEY,
                    organization_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    permission_key TEXT NOT NULL,
                    grant_type TEXT NOT NULL CHECK(grant_type IN('GRANT', 'REVOKE')),
                    granted_by TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, organization_id, permission_key),
                    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                )`);

        // Index for org_user_permissions
        db.run(`CREATE INDEX IF NOT EXISTS idx_org_user_perms_user ON org_user_permissions(user_id, organization_id)`);

        /**
         * Governance Audit Log (Immutable)
         * High-fidelity audit trail for all governance actions.
         */
        db.run(`CREATE TABLE IF NOT EXISTS governance_audit_log(
                    id TEXT PRIMARY KEY,
                    event_type TEXT DEFAULT 'audit', --KEEPING for compatibility, though action is used
                    action TEXT, --ADDED to match service
                    actor_id TEXT NOT NULL,
        actor_role TEXT, --ADDED
                    organization_id TEXT,
        project_id TEXT,
            resource_type TEXT NOT NULL,
                resource_id TEXT NOT NULL,
                    before_json TEXT, --Renamed from previous_state
                    after_json TEXT, --Renamed from new_state
                    metadata TEXT,
        correlation_id TEXT, --ADDED
                    record_hash TEXT, --Renamed from hash
                    prev_hash TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_gov_audit_org ON governance_audit_log(organization_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_gov_audit_actor ON governance_audit_log(actor_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_gov_audit_resource ON governance_audit_log(resource_type, resource_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_gov_audit_created ON governance_audit_log(created_at)`);

        /**
         * Break Glass Sessions
         * Tracks emergency administrative access.
         */
        // Align schema with Step 14 governance controls (see migrations/014_governance_enterprise.sql)
        // NOTE: Keep fields compatible with BreakGlassService expectations.
        db.run(`CREATE TABLE IF NOT EXISTS break_glass_sessions(
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            actor_id TEXT NOT NULL,
            reason TEXT NOT NULL,
            scope TEXT NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            closed_at DATETIME,
            --Legacy / compat fields(safe to keep, optional)
            ticket_ref TEXT,
            permissions_granted TEXT,
            started_at DATETIME,
            ended_at DATETIME,
            is_active INTEGER DEFAULT 1,
            FOREIGN KEY(actor_id) REFERENCES users(id),
            FOREIGN KEY(organization_id) REFERENCES organizations(id)
        )`);

        // ==========================================
        // ASSESSMENT LEVEL ATTACHMENTS
        // For attaching evidence files to specific maturity levels
        // ==========================================
        db.run(`CREATE TABLE IF NOT EXISTS assessment_level_attachments(
            id TEXT PRIMARY KEY,
            assessment_id TEXT NOT NULL,
            axis_id TEXT NOT NULL,
            area_id TEXT,
            level_number INTEGER NOT NULL,
            attachment_type TEXT DEFAULT 'EVIDENCE',
            file_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_size INTEGER,
            mime_type TEXT,
            description TEXT,
            uploaded_by TEXT NOT NULL,
            organization_id TEXT NOT NULL,
            ai_analysis TEXT,
            ai_suggested_score INTEGER,
            ai_confidence REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(assessment_id) REFERENCES maturity_assessments(id) ON DELETE CASCADE,
            FOREIGN KEY(uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_level_attachments_assessment ON assessment_level_attachments(assessment_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_level_attachments_axis ON assessment_level_attachments(axis_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_level_attachments_level ON assessment_level_attachments(level_number)`);

        // ==========================================
        // ORGANIZATION PROFILES (Enterprise AI)
        // ==========================================
        db.run(`CREATE TABLE IF NOT EXISTS organization_profiles(
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL UNIQUE,
            industry TEXT,
            industry_code TEXT,
            industry_subsector TEXT,
            company_size TEXT,
            employee_count INTEGER,
            annual_revenue REAL,
            founding_year INTEGER,
            headquarters_country TEXT,
            strategic_priorities TEXT DEFAULT '[]',
            competitive_position TEXT,
            growth_stage TEXT,
            mission_statement TEXT,
            vision_statement TEXT,
            digital_maturity_overall REAL,
            technology_stack TEXT DEFAULT '[]',
            digital_budget_percent REAL,
            cloud_adoption_level TEXT,
            primary_markets TEXT DEFAULT '[]',
            customer_segments TEXT DEFAULT '[]',
            key_competitors TEXT DEFAULT '[]',
            market_share_estimate REAL,
            regulatory_environment TEXT DEFAULT '[]',
            risk_appetite TEXT DEFAULT 'MODERATE',
            budget_constraints TEXT,
            timeline_constraints TEXT,
            preferred_language TEXT DEFAULT 'pl',
            communication_style TEXT DEFAULT 'PROFESSIONAL',
            industry_jargon_level TEXT DEFAULT 'MEDIUM',
            last_assessment_date DATETIME,
            profile_completeness REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT,
            updated_by TEXT,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_org_profiles_org_id ON organization_profiles(organization_id)`);

        // ==========================================
        // WORKSPACE DEFAULTS
        // Organization-level workspace default settings
        // ==========================================
        db.run(`CREATE TABLE IF NOT EXISTS workspace_defaults(
            organization_id TEXT PRIMARY KEY,
            project_default_view_mode TEXT DEFAULT 'kanban',
            project_auto_assign_creator INTEGER DEFAULT 1,
            project_default_privacy TEXT DEFAULT 'team',
            project_enable_time_tracking INTEGER DEFAULT 1,
            project_enable_dependencies INTEGER DEFAULT 1,
            project_default_estimation_unit TEXT DEFAULT 'hours',
            task_default_priority TEXT DEFAULT 'medium',
            task_default_due_offset INTEGER DEFAULT 7,
            task_default_assignee TEXT DEFAULT 'creator',
            task_auto_add_to_my_work INTEGER DEFAULT 1,
            workflow_states TEXT DEFAULT '[]',
            priorities TEXT DEFAULT '[]',
            timezone TEXT DEFAULT 'Europe/Warsaw',
            date_format TEXT DEFAULT 'DD/MM/YYYY',
            time_format TEXT DEFAULT '24h',
            week_start TEXT DEFAULT 'monday',
            working_days TEXT DEFAULT '[1,2,3,4,5]',
            working_hours_start TEXT DEFAULT '09:00',
            working_hours_end TEXT DEFAULT '17:00',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);

        // ==========================================
        // PINNED PROMPTS (AI Chat)
        // User's frequently used AI prompts
        // ==========================================
        db.run(`CREATE TABLE IF NOT EXISTS pinned_prompts(
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            organization_id TEXT,
            prompt TEXT NOT NULL,
            label TEXT,
            category TEXT DEFAULT 'general',
            usage_count INTEGER DEFAULT 0,
            last_used_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_pinned_prompts_user ON pinned_prompts(user_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_pinned_prompts_org ON pinned_prompts(organization_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_pinned_prompts_usage ON pinned_prompts(user_id, usage_count DESC)`);

        // ==========================================
        // AI USER MEMORY
        // Stores user preferences and context learned by AI
        // ==========================================
        db.run(`CREATE TABLE IF NOT EXISTS ai_user_memory(
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            organization_id TEXT,
            key TEXT NOT NULL,
            value TEXT,
            source TEXT DEFAULT 'explicit' CHECK(source IN('explicit', 'inferred')),
            confidence REAL DEFAULT 1.0,
            context TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, key)
        )`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_ai_memory_user ON ai_user_memory(user_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_ai_memory_user_key ON ai_user_memory(user_id, key)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_ai_memory_org ON ai_user_memory(organization_id)`);

        // ==========================================
        // AI APPROVAL PATTERNS (HITL Learning System)
        // Stores learned approval/rejection patterns for auto-decision
        // ==========================================
        db.run(`CREATE TABLE IF NOT EXISTS ai_approval_patterns(
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            organization_id TEXT NOT NULL,
            action_type TEXT NOT NULL,
            action_signature TEXT NOT NULL,
            payload_template TEXT,
            decision TEXT NOT NULL CHECK(decision IN('APPROVED', 'REJECTED')),
            decision_count INTEGER DEFAULT 1,
            last_decision_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            auto_apply INTEGER DEFAULT 0,
            confidence_threshold REAL DEFAULT 0.9,
            risk_level TEXT DEFAULT 'LOW' CHECK(risk_level IN('LOW', 'MEDIUM', 'HIGH')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            UNIQUE(user_id, action_type, action_signature)
        )`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_approval_patterns_lookup ON ai_approval_patterns(user_id, action_type, action_signature)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_approval_patterns_org ON ai_approval_patterns(organization_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_approval_patterns_auto ON ai_approval_patterns(user_id, auto_apply, action_type)`);

        // ==========================================
        // CONVERSATIONS (AI Chat)
        // Stores AI chat conversation metadata
        // ==========================================
        db.run(`CREATE TABLE IF NOT EXISTS conversations(
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            organization_id TEXT,
            project_id TEXT,
            title TEXT NOT NULL DEFAULT 'Nowa rozmowa',
            title_source TEXT DEFAULT 'auto' CHECK(title_source IN('auto', 'user')),
            starred INTEGER DEFAULT 0,
            archived INTEGER DEFAULT 0,
            tags TEXT DEFAULT '[]',
            pmo_context TEXT DEFAULT '{}',
            message_count INTEGER DEFAULT 0,
            last_message_preview TEXT,
            last_message_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL
        )`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_conversations_user_list ON conversations(user_id, archived, updated_at DESC)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations(project_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_conversations_starred ON conversations(user_id, starred)`);

        // ==========================================
        // CONVERSATION MESSAGES (AI Chat)
        // Stores individual messages within conversations
        // ==========================================
        db.run(`CREATE TABLE IF NOT EXISTS conversation_messages(
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN('user', 'ai')),
            content TEXT NOT NULL,
            message_type TEXT DEFAULT 'text' CHECK(message_type IN('text', 'action_request', 'summary', 'file', 'tool_call')),
            metadata TEXT DEFAULT '{}',
            token_count INTEGER,
            model_used TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        )`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON conversation_messages(conversation_id, created_at ASC)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_messages_recent ON conversation_messages(conversation_id, created_at DESC)`);

        // ==========================================
        // REPORT COMMENTS
        // Collaborative feedback on report sections
        // ==========================================
        db.run(`CREATE TABLE IF NOT EXISTS report_comments(
            id TEXT PRIMARY KEY,
            report_id TEXT NOT NULL,
            section_id TEXT,
            section_type TEXT,
            user_id TEXT NOT NULL,
            user_name TEXT,
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(report_id) REFERENCES assessment_reports(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(resolved_by) REFERENCES users(id),
            FOREIGN KEY(parent_comment_id) REFERENCES report_comments(id) ON DELETE CASCADE
        )`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_report_comments_report ON report_comments(report_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_report_comments_section ON report_comments(report_id, section_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_report_comments_status ON report_comments(status)`);

        // ==========================================
        // REPORT EDIT HISTORY
        // Track all changes to report sections
        // ==========================================
        db.run(`CREATE TABLE IF NOT EXISTS report_edit_history(
            id TEXT PRIMARY KEY,
            report_id TEXT NOT NULL,
            section_id TEXT NOT NULL,
            edit_type TEXT DEFAULT 'MANUAL',
            editor_id TEXT NOT NULL,
            editor_name TEXT,
            previous_content TEXT,
            new_content TEXT,
            change_summary TEXT,
            related_comment_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(report_id) REFERENCES assessment_reports(id) ON DELETE CASCADE,
            FOREIGN KEY(editor_id) REFERENCES users(id),
            FOREIGN KEY(related_comment_id) REFERENCES report_comments(id) ON DELETE SET NULL
        )`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_report_edit_history_report ON report_edit_history(report_id)`);

        // ==========================================
        // SYSTEM FEEDBACK
        // General bugs, feature requests, and ideas from users
        // Enhanced with admin response capabilities
        // ==========================================
        db.run(`CREATE TABLE IF NOT EXISTS system_feedback(
            id TEXT PRIMARY KEY,
            user_id TEXT,
            user_email TEXT,
            user_name TEXT,
            type TEXT,
            message TEXT,
            rating INTEGER,
            priority TEXT DEFAULT 'medium',
            status TEXT DEFAULT 'NEW',
            metadata TEXT,
            admin_response TEXT,
            admin_notes TEXT,
            responded_at DATETIME,
            responded_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME
        )`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_feedback_created ON system_feedback(created_at DESC)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_feedback_status ON system_feedback(status)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_feedback_type ON system_feedback(type)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_feedback_user ON system_feedback(user_id)`);

        // ==========================================
        // CONSULTIFY STUDIO - Visual AI Workspace
        // ==========================================

        // Studio Documents
        db.run(`CREATE TABLE IF NOT EXISTS studio_documents(
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            type TEXT DEFAULT 'process_flow',
            nodes_json TEXT DEFAULT '[]',
            edges_json TEXT DEFAULT '[]',
            viewport_json TEXT DEFAULT '{"x": 0, "y": 0, "zoom": 1}',
            conversation_id TEXT,
            ai_context_json TEXT DEFAULT '{}',
            linked_task_id TEXT,
            linked_project_id TEXT,
            linked_initiative_id TEXT,
            is_public INTEGER DEFAULT 0,
            share_token TEXT UNIQUE,
            thumbnail_url TEXT,
            tags_json TEXT DEFAULT '[]',
            created_by TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
        )`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_studio_documents_org ON studio_documents(organization_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_studio_documents_type ON studio_documents(type)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_studio_documents_created_by ON studio_documents(created_by)`);

        // Studio Snapshots (Version History)
        db.run(`CREATE TABLE IF NOT EXISTS studio_snapshots(
            id TEXT PRIMARY KEY,
            document_id TEXT NOT NULL,
            version INTEGER NOT NULL,
            name TEXT,
            nodes_json TEXT NOT NULL,
            edges_json TEXT NOT NULL,
            viewport_json TEXT,
            snapshot_reason TEXT,
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(document_id) REFERENCES studio_documents(id) ON DELETE CASCADE,
            FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
        )`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_studio_snapshots_document ON studio_snapshots(document_id)`);

        // Studio Comments
        db.run(`CREATE TABLE IF NOT EXISTS studio_comments(
            id TEXT PRIMARY KEY,
            document_id TEXT NOT NULL,
            node_id TEXT NOT NULL,
            text TEXT NOT NULL,
            ai_response TEXT,
            ai_action_taken TEXT,
            resolved INTEGER DEFAULT 0,
            resolved_at DATETIME,
            resolved_by TEXT,
            author_id TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(document_id) REFERENCES studio_documents(id) ON DELETE CASCADE,
            FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE SET NULL
        )`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_studio_comments_document ON studio_comments(document_id)`);

        // Studio Templates
        db.run(`CREATE TABLE IF NOT EXISTS studio_templates(
            id TEXT PRIMARY KEY,
            organization_id TEXT,
            name TEXT NOT NULL,
            description TEXT,
            category TEXT NOT NULL,
            icon TEXT DEFAULT 'file-diagram',
            nodes_json TEXT NOT NULL DEFAULT '[]',
            edges_json TEXT NOT NULL DEFAULT '[]',
            default_viewport_json TEXT DEFAULT '{"x": 0, "y": 0, "zoom": 1}',
            thumbnail_url TEXT,
            tags_json TEXT DEFAULT '[]',
            is_public INTEGER DEFAULT 0,
            is_featured INTEGER DEFAULT 0,
            usage_count INTEGER DEFAULT 0,
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_studio_templates_org ON studio_templates(organization_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_studio_templates_category ON studio_templates(category)`);

        // Studio AI Sessions
        db.run(`CREATE TABLE IF NOT EXISTS studio_ai_sessions(
            id TEXT PRIMARY KEY,
            document_id TEXT NOT NULL,
            messages_json TEXT DEFAULT '[]',
            intent_history_json TEXT DEFAULT '[]',
            entities_json TEXT DEFAULT '{}',
            total_generations INTEGER DEFAULT 0,
            total_modifications INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(document_id) REFERENCES studio_documents(id) ON DELETE CASCADE
        )`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_studio_ai_sessions_document ON studio_ai_sessions(document_id)`);

        // ==========================================
        // SCHEDULED EVENTS (Organization Calendar)
        // ==========================================
        db.run(`CREATE TABLE IF NOT EXISTS scheduled_events(
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            event_type TEXT DEFAULT 'meeting', -- meeting, deadline, milestone, review, other
            start_time DATETIME NOT NULL,
            end_time DATETIME,
            location TEXT,
            is_all_day INTEGER DEFAULT 0,
            status TEXT DEFAULT 'SCHEDULED', -- SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
            project_id TEXT,
            attendees TEXT DEFAULT '[]', -- JSON array of user IDs
            reminder_minutes INTEGER DEFAULT 15,
            recurrence_rule TEXT, -- iCal RRULE format for recurring events
            created_by TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL,
            FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
        )`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_scheduled_events_org ON scheduled_events(organization_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_scheduled_events_start ON scheduled_events(start_time)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_scheduled_events_project ON scheduled_events(project_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_scheduled_events_status ON scheduled_events(status)`);

        // Seed Super Admin & Default Organization
        const superAdminOrgId = 'org-dbr77-system';
        const superAdminId = 'admin-001';
        const hashedPassword = bcrypt.hashSync('123456', 8);

        // Check if admin exists (or rather, just ensure seed since we dropped table)
        // Check if admin exists (or rather, just ensure seed since we dropped table)
        // Refactored to ensure users are always seeded in DEV because we drop the users table

        // 1. Ensure System Organization Exists
        const insertOrg = db.prepare(`INSERT OR IGNORE INTO organizations(id, name, plan, status) VALUES(?, ?, ?, ?)`);
        insertOrg.run(superAdminOrgId, 'DBR77 System', 'enterprise', 'active');
        insertOrg.run('org-dbr77-test', 'DBR77', 'pro', 'active'); // Ensure DBR77 org exists context
        insertOrg.finalize();

        // 2. Create Users (Table was dropped in DEV, so we must recreate)
        // Use INSERT OR IGNORE just in case we are in prod or table wasn't dropped
        const insertUser = db.prepare(`INSERT OR IGNORE INTO users(id, organization_id, email, password, first_name, last_name, role) VALUES(?, ?, ?, ?, ?, ?, ?)`);

        // Super Admin
        insertUser.run(superAdminId, superAdminOrgId, 'admin@dbr77.com', hashedPassword, 'Super', 'Admin', 'SUPERADMIN');

        // DBR77 Admin
        const dbr77OrgId = 'org-dbr77-test'; // Hardcoded ID from previous code
        const dbr77AdminId = 'user-dbr77-admin';
        insertUser.run(dbr77AdminId, dbr77OrgId, 'piotr.wisniewski@dbr77.com', hashedPassword, 'Piotr', 'Wiśniewski', 'ADMIN');

        // DBR77 User
        const dbr77UserId = 'user-dbr77-user';
        insertUser.run(dbr77UserId, dbr77OrgId, 'justyna.laskowska@dbr77.com', hashedPassword, 'Justyna', 'Laskowska', 'USER');

        insertUser.finalize();

        console.log('Seeded SuperAdmin and DBR77 Users.');

        // 3. Create Default Project if not exists
        const dbr77ProjectId = 'project-dbr77-001';
        const insertProject = db.prepare(`INSERT OR IGNORE INTO projects(id, organization_id, name, status, owner_id) VALUES(?, ?, ?, ?, ?)`);
        insertProject.run(dbr77ProjectId, dbr77OrgId, 'Digital Transformation 2025', 'active', dbr77AdminId);
        insertProject.finalize();
        // Ensure all previous commands are finished before resolving initPromise
        db.run("SELECT 1", () => {
            console.log('Database initialization complete.');
            if (db.initResolve) db.initResolve();
        });
    });
}

// ==========================================
// PROMISIFY ACTIONS FOR ASYNC/AWAIT SUPPORT
// ==========================================
const originalRun = db.run.bind(db);
const originalGet = db.get.bind(db);
const originalAll = db.all.bind(db);

db.run = function (sql, params, callback) {
    if (typeof params === 'function') {
        callback = params;
        params = [];
    }
    if (!params) params = [];

    if (callback) {
        return originalRun.call(this, sql, params, callback);
    }

    return new Promise((resolve, reject) => {
        originalRun.call(this, sql, params, function (err) {
            if (err) {
                // Log only if it's not a known safe error? 
                // Getting many "duplicate column" errors during init is "safe" but annoying.
                // We'll log them for now.
                // console.error('SQL Error (RUN):', err.message, 'Query:', sql);
                reject(err);
            } else {
                resolve(this);
            }
        });
    });
};

db.get = function (sql, params, callback) {
    if (typeof params === 'function') {
        callback = params;
        params = [];
    }
    if (!params) params = [];

    if (callback) {
        return originalGet.call(this, sql, params, callback);
    }

    return new Promise((resolve, reject) => {
        originalGet.call(this, sql, params, (err, row) => {
            if (err) {
                console.error('SQL Error (GET):', err.message, 'Query:', sql);
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
};

db.all = function (sql, params, callback) {
    if (typeof params === 'function') {
        callback = params;
        params = [];
    }
    if (!params) params = [];

    if (callback) {
        return originalAll.call(this, sql, params, callback);
    }

    return new Promise((resolve, reject) => {
        originalAll.call(this, sql, params, (err, rows) => {
            if (err) {
                console.error('SQL Error (ALL):', err.message, 'Query:', sql);
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });
};

// Add Async aliases for services that expect them
db.runAsync = db.run;
db.getAsync = db.get;
db.allAsync = db.all;

module.exports = db;
