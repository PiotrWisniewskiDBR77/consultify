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
        console.log('Connected to the SQLite database.');
        initDb();
        // db.initResolve will be called inside initDb after serialization
        // if (db.initResolve) db.initResolve();
    }
});

db.initPromise = new Promise((resolve, reject) => {
    db.initResolve = resolve;
    db.initReject = reject;
});

function initDb() {
    db.serialize(() => {
        // Organizations Table (New)
        db.run(`CREATE TABLE IF NOT EXISTS organizations (
            id TEXT PRIMARY KEY,
            name TEXT,
            plan TEXT DEFAULT 'free',
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            valid_until DATETIME
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
            role TEXT, 
            status TEXT DEFAULT 'active',
            avatar_url TEXT,
            timezone TEXT DEFAULT 'UTC',
            units TEXT DEFAULT 'metric',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME,
            FOREIGN KEY(organization_id) REFERENCES organizations(id)
        )`);

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
                                                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                                        FOREIGN KEY(organization_id) REFERENCES organizations(id)
                                                    )`, (err) => {
            if (err) console.error('Error creating projects table:', err.message);
            else console.log('Projects table created successfully (or already exists).');
        });

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
            FOREIGN KEY(doc_id) REFERENCES knowledge_docs(id) ON DELETE CASCADE
        )`);

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
            estimated_hours REAL,
            checklist TEXT, -- JSON array of {id, text, completed}
            attachments TEXT, -- JSON array of {id, name, url}
            tags TEXT, -- JSON array of strings
            custom_status_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(assignee_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY(reporter_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY(custom_status_id) REFERENCES custom_statuses(id) ON DELETE SET NULL
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

        // Notifications Table
        db.run(`CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            type TEXT NOT NULL, -- task_assigned, task_completed, status_changed, deadline, mention, project_milestone
            title TEXT NOT NULL,
            message TEXT,
            data TEXT, -- JSON with entity_type, entity_id, etc.
            read INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // Activity Logs (Audit Trail)
        db.run(`CREATE TABLE IF NOT EXISTS activity_logs (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            user_id TEXT,
            action TEXT NOT NULL, -- created, updated, deleted, status_changed, assigned, etc.
            entity_type TEXT NOT NULL, -- task, project, user, team, etc.
            entity_id TEXT,
            entity_name TEXT,
            old_value TEXT, -- JSON
            new_value TEXT, -- JSON
            ip_address TEXT,
            user_agent TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
        )`);

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
        db.run(`CREATE TABLE IF NOT EXISTS ai_feedback (
            id TEXT PRIMARY KEY,
            organization_id TEXT,
            user_id TEXT,
            context TEXT, -- diagnosis, recommendation, chat
            prompt TEXT,
            response TEXT,
            helpful INTEGER, -- 0 or 1
            comment TEXT,
            rating INTEGER, -- 1-5
            correction TEXT, -- User provided better answer
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
        )`);

        // Custom AI Prompts (Organization-specific)
        db.run(`CREATE TABLE IF NOT EXISTS custom_prompts (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            name TEXT NOT NULL,
            context TEXT NOT NULL, -- diagnosis, recommendation, roadmap, etc.
            template TEXT NOT NULL,
            variables TEXT, -- JSON array of variable names
            is_active INTEGER DEFAULT 1,
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
        )`);

        // Webhooks (Integration Hub)
        db.run(`CREATE TABLE IF NOT EXISTS webhooks (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            url TEXT NOT NULL,
            events TEXT NOT NULL, -- JSON array of event types
            secret TEXT NOT NULL, -- For signature verification
            is_active INTEGER DEFAULT 1,
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
        )`);

        // AI Logs (Analytics)
        db.run(`CREATE TABLE IF NOT EXISTS ai_logs (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            action TEXT, -- diagnose, chat, etc.
            model TEXT,
            input_tokens INTEGER,
            output_tokens INTEGER,
            latency_ms INTEGER,
            topic TEXT, -- Classified topic
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // System Prompts (Super Admin Control)
        db.run(`CREATE TABLE IF NOT EXISTS system_prompts (
            id TEXT PRIMARY KEY,
            key TEXT UNIQUE, -- e.g. 'ANALYST', 'CONSULTANT'
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

        const insertPrompt = db.prepare(`INSERT OR IGNORE INTO system_prompts (id, key, description, content, updated_by) VALUES (?, ?, ?, ?, ?)`);
        defaultPrompts.forEach(p => {
            insertPrompt.run(uuidv4(), p.key, p.desc, p.content, 'system');
        });
        insertPrompt.finalize();

        // Feedback / System Issues Table
        db.run(`CREATE TABLE IF NOT EXISTS feedback (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            type TEXT NOT NULL, -- bug, feature, general
            message TEXT NOT NULL,
            screenshot TEXT, -- Base64
            url TEXT,
            status TEXT DEFAULT 'new', -- new, read, resolved, rejected
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // Revoked Tokens Table (JWT Blacklist)
        db.run(`CREATE TABLE IF NOT EXISTS revoked_tokens (
            jti TEXT PRIMARY KEY,
            user_id TEXT,
            expires_at DATETIME NOT NULL,
            revoked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            reason TEXT DEFAULT 'logout',
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // Password Resets Table
        db.run(`CREATE TABLE IF NOT EXISTS password_resets (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            token TEXT NOT NULL UNIQUE,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // Invitations Table
        db.run(`CREATE TABLE IF NOT EXISTS invitations (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            email TEXT NOT NULL,
            role TEXT DEFAULT 'USER',
            token TEXT NOT NULL UNIQUE,
            status TEXT DEFAULT 'pending', -- pending, accepted, expired, revoked
            invited_by TEXT,
            expires_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            accepted_at DATETIME,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(invited_by) REFERENCES users(id) ON DELETE SET NULL
        )`);

        // Access Requests Table (for controlled organization access)
        db.run(`CREATE TABLE IF NOT EXISTS access_requests (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            first_name TEXT,
            last_name TEXT,
            phone TEXT,
            organization_id TEXT,
            organization_name TEXT,
            requested_role TEXT DEFAULT 'USER',
            status TEXT DEFAULT 'pending', -- pending, approved, rejected, expired
            request_type TEXT DEFAULT 'new_user', -- new_user, join_org
            metadata TEXT,
            requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            reviewed_by TEXT,
            reviewed_at DATETIME,
            rejection_reason TEXT,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(reviewed_by) REFERENCES users(id) ON DELETE SET NULL
        )`);

        // Access Codes Table (Admin-generated codes for organization access)
        db.run(`CREATE TABLE IF NOT EXISTS access_codes (
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
        db.run(`CREATE TABLE IF NOT EXISTS access_code_usage (
            id TEXT PRIMARY KEY,
            code_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(code_id) REFERENCES access_codes(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // ==========================================
        // PHASE 1.5: NOTIFICATIONS & INTEGRATIONS
        // ==========================================

        // Integrations Table (Slack, Teams, etc.)
        db.run(`CREATE TABLE IF NOT EXISTS integrations (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            provider TEXT NOT NULL, -- slack, teams, whatsapp, trello, jira, clickup
            config TEXT, -- JSON: webhook_url, api_token, channel_id, etc.
            status TEXT DEFAULT 'active', -- active, error, disabled
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);

        // Add notification_preferences to users if not exists
        db.run(`ALTER TABLE users ADD COLUMN notification_preferences TEXT DEFAULT '{}'`, (err) => {
            // Ignore if exists
        });

        // Add priority to notifications if not exists
        db.run(`ALTER TABLE notifications ADD COLUMN priority TEXT DEFAULT 'normal'`, (err) => {
            // Ignore if exists
        });

        // ==========================================
        // PHASE 2: DRD STRATEGY EXECUTION ENGINE
        // ==========================================

        // --- PHASE 1.5: AI LEARNING & CONTEXT (NEW) ---

        // 1. Knowledge Candidates (The "Inbox" for AI Ideas)
        db.run(`CREATE TABLE IF NOT EXISTS knowledge_candidates (
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL,          -- The proposed insight/idea
            reasoning TEXT,                 -- Why is this useful?
            source TEXT,                    -- 'interaction', 'manual', 'analysis'
            origin_context TEXT,            -- Anonymized snippet of where it came from
            related_axis TEXT,              -- Linked to specific axis if applicable
            priority TEXT DEFAULT 'medium', -- low, medium, high
            status TEXT DEFAULT 'pending',  -- pending, approved, rejected, edited
            admin_comment TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // 2. Global Strategic Directions (Admin Controls)
        db.run(`CREATE TABLE IF NOT EXISTS global_strategies (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            is_active INTEGER DEFAULT 1,
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // 2.5 Structured Entity Context (Facilities)
        db.run(`CREATE TABLE IF NOT EXISTS organization_facilities (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            name TEXT NOT NULL, -- e.g. "Gdansk Plant"
            headcount INTEGER DEFAULT 0,
            location TEXT, -- City, Country
            activity_profile TEXT, -- e.g. "Assembly Line", "R&D Center"
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);

        // 3. Client Context (Persistent Memory per Client)
        db.run(`CREATE TABLE IF NOT EXISTS client_context (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            key TEXT NOT NULL,              -- e.g., 'cultural_tone', 'risk_appetite', 'industry_focus'
            value TEXT,                     -- JSON or Text
            source TEXT,                    -- 'inferred', 'explicit'
            confidence REAL,                -- 0.0 - 1.0
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);

        // Update Knowledge Chunks for Vector Support
        db.run(`ALTER TABLE knowledge_chunks ADD COLUMN embedding TEXT`, (err) => {
            // Ignore if exists
        });

        // ==========================================
        // PHASE 4: ANALYTICS & BENCHMARKING
        // ==========================================

        // 1. Add Industry to Organizations
        db.run(`ALTER TABLE organizations ADD COLUMN industry TEXT DEFAULT 'General'`, (err) => {
            // Ignore if exists
        });

        // 2. Maturity Scores (Structured Data for Benchmarking)
        db.run(`CREATE TABLE IF NOT EXISTS maturity_scores (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            axis TEXT NOT NULL,         -- e.g. 'Culture', 'Data'
            score REAL NOT NULL,        -- 1.0 to 5.0
            industry TEXT,              -- Denormalized for easier querying
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);

        // Add Active LLM Provider to Organizations
        db.run(`ALTER TABLE organizations ADD COLUMN active_llm_provider_id TEXT`, (err) => {
            // Ignore if exists
        });

        // ==========================================
        // PHASE 2: DRD STRATEGY EXECUTION ENGINE
        // ==========================================

        // Initiatves Table (Master Object)
        db.run(`CREATE TABLE IF NOT EXISTS initiatives (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            project_id TEXT, -- Optional link to legacy project container
            name TEXT NOT NULL,
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
            owner_business_id TEXT,
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
            db.run(`ALTER TABLE initiatives ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.default}`, (err) => {
                // Ignore error if column already exists
            });
        });

        // Task Dependencies
        db.run(`CREATE TABLE IF NOT EXISTS task_dependencies (
            id TEXT PRIMARY KEY,
            from_task_id TEXT NOT NULL,
            to_task_id TEXT NOT NULL,
            type TEXT DEFAULT 'hard', -- hard (blocker), soft (recommended)
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
            db.run(`ALTER TABLE tasks ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.default}`, (err) => {
                // Ignore error if column already exists
            });
        });

        // ==========================================
        // PHASE: ENTERPRISE SAAS BILLING
        // ==========================================

        // 0. TOKEN BILLING & MARGINS
        db.run(`CREATE TABLE IF NOT EXISTS billing_margins (
            source_type TEXT PRIMARY KEY, -- platform, byok, local
            base_cost_per_1k REAL DEFAULT 0,
            margin_percent REAL DEFAULT 20,
            min_charge REAL DEFAULT 0.01,
            is_active INTEGER DEFAULT 1,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Seed default margins
        db.run(`INSERT OR IGNORE INTO billing_margins (source_type, base_cost_per_1k, margin_percent) VALUES 
            ('platform', 0.03, 30),
            ('byok', 0, 5),
            ('local', 0, 0)
        `);

        db.run(`CREATE TABLE IF NOT EXISTS token_packages (
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

        db.run(`CREATE TABLE IF NOT EXISTS user_token_balance (
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

        db.run(`CREATE TABLE IF NOT EXISTS token_transactions (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            organization_id TEXT,
            type TEXT, -- purchase, usage
            source_type TEXT, -- platform, byok, local
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

        db.run(`CREATE TABLE IF NOT EXISTS billing_invoices (
             id TEXT PRIMARY KEY,
             organization_id TEXT,
             amount_due REAL,
             currency TEXT DEFAULT 'USD',
             status TEXT,
             stripe_invoice_id TEXT,
             created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS user_api_keys (
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
             created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
             FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // 1. SUBSCRIPTION PLANS (Superadmin-managed)
        db.run(`CREATE TABLE IF NOT EXISTS subscription_plans (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            price_monthly REAL NOT NULL,
            token_limit INTEGER,
            storage_limit_gb REAL,
            token_overage_rate REAL,
            storage_overage_rate REAL,
            stripe_price_id TEXT,
            features TEXT DEFAULT '{}', -- JSON: printing, analytics_level, etc.
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // 1.5 USER LICENSE PLANS (New)
        db.run(`CREATE TABLE IF NOT EXISTS user_license_plans (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL, -- Standard, Premium
            price_monthly REAL NOT NULL,
            features TEXT DEFAULT '{}', -- JSON
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // 2. ORGANIZATION BILLING (per tenant)
        db.run(`CREATE TABLE IF NOT EXISTS organization_billing (
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
        db.run(`CREATE TABLE IF NOT EXISTS usage_records (
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
        db.run(`CREATE TABLE IF NOT EXISTS usage_summaries (
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
        db.run(`CREATE TABLE IF NOT EXISTS invoices (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            stripe_invoice_id TEXT UNIQUE,
            amount_due REAL,
            amount_paid REAL,
            status TEXT, -- paid, open, void, uncollectible
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

            const insertOrgPlan = db.prepare(`INSERT OR IGNORE INTO subscription_plans (id, name, price_monthly, token_limit, storage_limit_gb, features) VALUES (?, ?, ?, ?, ?, ?)`);
            for (const p of orgPlans) {
                insertOrgPlan.run(p.id, p.name, p.price, p.tokens, p.storage, p.features);
            }
            insertOrgPlan.finalize();

            // USER LICENSES
            const userPlans = [
                { id: 'license-standard', name: 'Standard User', price: 20, features: JSON.stringify({ access: 'standard' }) },
                { id: 'license-premium', name: 'Premium User', price: 100, features: JSON.stringify({ access: 'full' }) }
            ];

            const insertUserPlan = db.prepare(`INSERT OR IGNORE INTO user_license_plans (id, name, price_monthly, features) VALUES (?, ?, ?, ?)`);
            for (const p of userPlans) {
                insertUserPlan.run(p.id, p.name, p.price, p.features);
            }
            insertUserPlan.finalize();
        };
        seedPricing();


        console.log('Created billing tables and seeded default subscription plans.');

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
            { name: 'deleted_at', type: 'DATETIME', default: 'NULL' } // Soft delete
        ];

        docStorageCols.forEach(col => {
            db.run(`ALTER TABLE knowledge_docs ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.default} `, (err) => {
                // Ignore if exists
            });
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
        db.run(`CREATE TABLE IF NOT EXISTS megatrends (
            id TEXT PRIMARY KEY,
            industry TEXT NOT NULL,
            type TEXT NOT NULL,          -- Technology, Business, Societal
            label TEXT NOT NULL,
            description TEXT,
            base_impact_score REAL,
            initial_ring TEXT DEFAULT 'Watch Closely'
        )`);

        // Custom Trends (Company Specific)
        db.run(`CREATE TABLE IF NOT EXISTS custom_trends (
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

module.exports = db;
