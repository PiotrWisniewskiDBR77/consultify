const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.resolve(__dirname, 'consultify.db');

let db;

// Allow bypassing real DB connection for Unit Tests
if (process.env.MOCK_DB === 'true') {
    console.log('Using MOCKED DB (No connection)');
    db = {
        prepare: () => ({ run: () => { }, finalize: () => { } }),
        run: () => { },
        all: () => { },
        get: () => { },
        serialize: (cb) => cb && cb()
    };
} else {
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error opening database', err.message);
        } else {
            console.log('Connected to the SQLite database.');
            initDb();
        }
    });
}

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
        if (process.env.NODE_ENV !== 'production') {
            // db.run(`DROP TABLE IF EXISTS users`);
        }
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
                                                    )`);

        // Knowledge Base: Documents
        db.run(`CREATE TABLE IF NOT EXISTS knowledge_docs(
                                                        id TEXT PRIMARY KEY,
                                                        filename TEXT,
                                                        filepath TEXT,
                                                        status TEXT DEFAULT 'pending', --pending, indexed, error
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
                                                            markup_multiplier REAL DEFAULT 1.0, -- Margin multiplier (e.g. 2.0 = 2x cost)
                                                            is_active INTEGER DEFAULT 1,
                                                            is_default INTEGER DEFAULT 0,
                                                            visibility TEXT DEFAULT 'admin' -- admin, public, beta
                                                        )`);

        // Migration: Add markup_multiplier if not exists
        db.run(`ALTER TABLE llm_providers ADD COLUMN markup_multiplier REAL DEFAULT 1.0`, (err) => {
            // Ignore error if column already exists
        });

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
        db.run(`ALTER TABLE users ADD COLUMN avatar_url TEXT`, (err) => {
            // Ignore error if column already exists
        });
        db.run(`ALTER TABLE users ADD COLUMN title TEXT`, (err) => {
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

        // Usage Tracking for Access Codes
        db.run(`CREATE TABLE IF NOT EXISTS access_code_usage (
            id TEXT PRIMARY KEY,
            code_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(code_id) REFERENCES access_codes(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // ==========================================
        // PHASE 4: COMPOSABLE REPORTS SYSTEM
        // ==========================================

        // 1. REPORTS TABLE (Container)
        db.run(`CREATE TABLE IF NOT EXISTS reports (
            id TEXT PRIMARY KEY,
            project_id TEXT,
            organization_id TEXT NOT NULL,
            title TEXT NOT NULL,
            status TEXT DEFAULT 'draft', -- draft, final, archived
            version INTEGER DEFAULT 1,
            block_order TEXT, -- JSON array of blockIds ["block_1", "block_2"]
            sources TEXT, -- JSON metadata about input sources
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);

        // 2. REPORT BLOCKS TABLE (Content)
        db.run(`CREATE TABLE IF NOT EXISTS report_blocks (
            id TEXT PRIMARY KEY,
            report_id TEXT NOT NULL,
            type TEXT NOT NULL, -- text, table, cards, matrix, evidence_list, recommendation, image
            title TEXT,
            module TEXT, -- Origin module (e.g. "ChallengeMap")
            anchor TEXT, -- Anchor link
            editable INTEGER DEFAULT 1,
            ai_regeneratable INTEGER DEFAULT 1,
            locked INTEGER DEFAULT 0,
            content TEXT, -- JSON content specific to block type
            meta TEXT, -- JSON metadata (confidence, tags, etc.)
            position INTEGER DEFAULT 0, -- Sort order (redundant with block_order but good for recovery)
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(report_id) REFERENCES reports(id) ON DELETE CASCADE
        )`);

        // 3. REPORT SNAPSHOTS (Versioning)
        db.run(`CREATE TABLE IF NOT EXISTS report_snapshots (
            id TEXT PRIMARY KEY,
            report_id TEXT NOT NULL,
            version INTEGER NOT NULL,
            snapshot_data TEXT, -- Full JSON dump of report + blocks at this version
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(report_id) REFERENCES reports(id) ON DELETE CASCADE
        )`);

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

        // Add Discount Percent to Organizations
        db.run(`ALTER TABLE organizations ADD COLUMN discount_percent INTEGER DEFAULT 0`, (err) => {
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
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Migration: Ensure new columns exist for subscription_plans (if table already existed)
        const planCols = ['token_overage_rate REAL', 'storage_overage_rate REAL', 'stripe_price_id TEXT'];
        planCols.forEach(col => {
            db.run(`ALTER TABLE subscription_plans ADD COLUMN ${col}`, (err) => { /* ignore error if exists */ });
        });

        // Seed Default Subscription Plans
        const defaultPlans = [
            { id: 'plan_free', name: 'Free', price_monthly: 0, token_limit: 50000, storage_limit_gb: 1, token_overage_rate: 0.015, storage_overage_rate: 0.1, stripe_price_id: '' },
            { id: 'plan_basic', name: 'Basic', price_monthly: 20, token_limit: 500000, storage_limit_gb: 10, token_overage_rate: 0.015, storage_overage_rate: 0.1, stripe_price_id: '' },
            { id: 'plan_standard', name: 'Standard', price_monthly: 100, token_limit: 5000000, storage_limit_gb: 50, token_overage_rate: 0.015, storage_overage_rate: 0.1, stripe_price_id: '' },
            { id: 'plan_premium', name: 'Premium', price_monthly: 500, token_limit: 30000000, storage_limit_gb: 500, token_overage_rate: 0.015, storage_overage_rate: 0.1, stripe_price_id: '' }
        ];

        const insertPlan = db.prepare(`INSERT OR IGNORE INTO subscription_plans (id, name, price_monthly, token_limit, storage_limit_gb, token_overage_rate, storage_overage_rate, stripe_price_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

        defaultPlans.forEach(p => {
            insertPlan.run(p.id, p.name, p.price_monthly, p.token_limit, p.storage_limit_gb, p.token_overage_rate, p.storage_overage_rate, p.stripe_price_id);
        });
        insertPlan.finalize();

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
            currency TEXT DEFAULT 'usd',
            status TEXT,
            period_start DATE,
            period_end DATE,
            pdf_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);

        // 6. FEATURE FLAGS (per plan)
        db.run(`CREATE TABLE IF NOT EXISTS plan_features (
            id TEXT PRIMARY KEY,
            plan_id TEXT NOT NULL,
            feature_key TEXT NOT NULL,
            enabled INTEGER DEFAULT 1,
            limit_value INTEGER,
            FOREIGN KEY(plan_id) REFERENCES subscription_plans(id) ON DELETE CASCADE
        )`);

        // ==========================================
        // PHASE: 3-TIER TOKEN BILLING SYSTEM
        // ==========================================

        // 1. Billing Margins (Configurable per source type)
        db.run(`CREATE TABLE IF NOT EXISTS billing_margins (
            id TEXT PRIMARY KEY,
            source_type TEXT NOT NULL UNIQUE, -- 'platform', 'byok', 'local'
            display_name TEXT,
            base_cost_per_1k REAL DEFAULT 0,  -- Base cost (for platform tokens)
            margin_percent REAL NOT NULL,     -- Margin percentage
            min_charge REAL DEFAULT 0,        -- Minimum charge per request
            is_active INTEGER DEFAULT 1,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // 2. Token Packages (Purchasable bundles)
        db.run(`CREATE TABLE IF NOT EXISTS token_packages (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            tokens INTEGER NOT NULL,
            price_usd REAL NOT NULL,
            stripe_price_id TEXT,
            bonus_percent INTEGER DEFAULT 0,  -- e.g., 10% bonus tokens
            is_popular INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // 3. User Token Balance (Per-user token wallet)
        db.run(`CREATE TABLE IF NOT EXISTS user_token_balance (
            user_id TEXT PRIMARY KEY,
            platform_tokens INTEGER DEFAULT 0,      -- Purchased from us
            platform_tokens_bonus INTEGER DEFAULT 0, -- Bonus tokens
            byok_usage_tokens INTEGER DEFAULT 0,    -- Usage tracked for BYOK billing
            local_usage_tokens INTEGER DEFAULT 0,   -- Usage tracked for local billing
            lifetime_purchased INTEGER DEFAULT 0,
            lifetime_used INTEGER DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // 4. Token Transactions (Full audit trail)
        db.run(`CREATE TABLE IF NOT EXISTS token_transactions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            organization_id TEXT,
            type TEXT NOT NULL,           -- 'purchase', 'usage', 'refund', 'bonus', 'adjustment'
            source_type TEXT,             -- 'platform', 'byok', 'local'
            tokens INTEGER NOT NULL,
            cost_usd REAL DEFAULT 0,
            margin_usd REAL DEFAULT 0,
            net_revenue_usd REAL DEFAULT 0,
            stripe_payment_id TEXT,
            package_id TEXT,
            llm_provider TEXT,
            model_used TEXT,
            description TEXT,
            metadata TEXT,                -- JSON for extra data
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(package_id) REFERENCES token_packages(id) ON DELETE SET NULL
        )`);

        // Migration: Add metadata if not exists
        db.run(`ALTER TABLE token_transactions ADD COLUMN metadata TEXT`, (err) => {
            // Ignore error if column already exists
        });

        // 5. User API Keys (BYOK - Bring Your Own Key)
        db.run(`CREATE TABLE IF NOT EXISTS user_api_keys (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            organization_id TEXT,
            provider TEXT NOT NULL,       -- 'openai', 'anthropic', 'google', etc.
            display_name TEXT,
            encrypted_key TEXT NOT NULL,  -- AES encrypted
            model_preference TEXT,        -- Preferred model for this key
            is_active INTEGER DEFAULT 1,
            is_default INTEGER DEFAULT 0,
            usage_count INTEGER DEFAULT 0,
            last_used_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);

        // Seed Default Billing Margins
        const defaultMargins = [
            { id: 'margin-platform', source_type: 'platform', display_name: 'Platform Tokens', base_cost: 0.010, margin: 40 },
            { id: 'margin-byok', source_type: 'byok', display_name: 'User API Key (BYOK)', base_cost: 0, margin: 15 },
            { id: 'margin-local', source_type: 'local', display_name: 'Local/Self-Hosted', base_cost: 0, margin: 5 }
        ];

        const insertMargin = db.prepare(`INSERT OR IGNORE INTO billing_margins (id, source_type, display_name, base_cost_per_1k, margin_percent) VALUES (?, ?, ?, ?, ?)`);
        defaultMargins.forEach(m => {
            insertMargin.run(m.id, m.source_type, m.display_name, m.base_cost, m.margin);
        });
        insertMargin.finalize();

        // Seed Default Token Packages
        const defaultTokenPackages = [
            { id: 'pkg-1k', name: 'Starter', tokens: 10000, price: 1.50, bonus: 0, popular: 0, order: 1 },
            { id: 'pkg-10k', name: 'Basic', tokens: 100000, price: 12.00, bonus: 5, popular: 0, order: 2 },
            { id: 'pkg-100k', name: 'Pro', tokens: 1000000, price: 100.00, bonus: 10, popular: 1, order: 3 },
            { id: 'pkg-1m', name: 'Enterprise', tokens: 10000000, price: 800.00, bonus: 20, popular: 0, order: 4 }
        ];

        const insertPackage = db.prepare(`INSERT OR IGNORE INTO token_packages (id, name, tokens, price_usd, bonus_percent, is_popular, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`);
        defaultTokenPackages.forEach(p => {
            insertPackage.run(p.id, p.name, p.tokens, p.price, p.bonus, p.popular, p.order);
        });
        insertPackage.finalize();


        // AI Ideas Board
        db.run(`CREATE TABLE IF NOT EXISTS ai_ideas (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'new',
            priority TEXT DEFAULT 'medium',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // AI System Observations
        db.run(`CREATE TABLE IF NOT EXISTS ai_observations (
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            category TEXT,
            confidence_score REAL,
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

        console.log('Database initialized successfully');

        // Seed Super Admin & Default Organization
        const superAdminOrgId = 'org-dbr77-system';
        const superAdminId = 'admin-001';
        const hashedPassword = bcrypt.hashSync('123456', 8);

        // Check if admin exists (or rather, just ensure seed since we dropped table)
        db.get("SELECT id FROM organizations WHERE id = ?", [superAdminOrgId], (err, row) => {
            if (!row) {
                // Create System Organization
                const insertOrg = db.prepare(`INSERT INTO organizations(id, name, plan, status) VALUES(?, ?, ?, ?)`);
                insertOrg.run(superAdminOrgId, 'DBR77 System', 'enterprise', 'active');
                insertOrg.finalize();

                // Create Super Admin User
                const insertUser = db.prepare(`INSERT INTO users(id, organization_id, email, password, first_name, last_name, role) VALUES(?, ?, ?, ?, ?, ?, ?)`);
                const superAdminPassword = bcrypt.hashSync('Admin123!', 8);
                insertUser.run(superAdminId, superAdminOrgId, 'admin@dbr77.com', superAdminPassword, 'Super', 'Admin', 'SUPERADMIN');
                insertUser.finalize();

                console.log('Seeded SuperAdmin (admin@dbr77.com) and System Org.');

                // --- SEED TEST ORGANIZATION: DBR77 ---
                const dbr77OrgId = 'org-dbr77-test';
                const dbr77AdminId = 'user-dbr77-admin';
                const dbr77UserId = 'user-dbr77-user';

                // Create DBR77 Organization
                const insertDbr77Org = db.prepare(`INSERT INTO organizations(id, name, plan, status) VALUES(?, ?, ?, ?)`);
                insertDbr77Org.run(dbr77OrgId, 'DBR77', 'pro', 'active');
                insertDbr77Org.finalize();

                // Create Admin user for DBR77
                const insertDbr77Admin = db.prepare(`INSERT INTO users(id, organization_id, email, password, first_name, last_name, role) VALUES(?, ?, ?, ?, ?, ?, ?)`);
                insertDbr77Admin.run(dbr77AdminId, dbr77OrgId, 'piotr.wisniewski@dbr77.com', hashedPassword, 'Piotr', 'Wiśniewski', 'ADMIN');
                insertDbr77Admin.finalize();

                // Create regular User for DBR77
                const insertDbr77User = db.prepare(`INSERT INTO users(id, organization_id, email, password, first_name, last_name, role) VALUES(?, ?, ?, ?, ?, ?, ?)`);
                insertDbr77User.run(dbr77UserId, dbr77OrgId, 'justyna.laskowska@dbr77.com', hashedPassword, 'Justyna', 'Laskowska', 'USER');
                insertDbr77User.finalize();

                // Create a sample project for DBR77
                const dbr77ProjectId = 'project-dbr77-001';
                const insertProject = db.prepare(`INSERT INTO projects(id, organization_id, name, status, owner_id) VALUES(?, ?, ?, ?, ?)`);
                insertProject.run(dbr77ProjectId, dbr77OrgId, 'Digital Transformation 2025', 'active', dbr77AdminId);
                insertProject.finalize();

                console.log('Seeded DBR77 Organization with Admin (piotr.wisniewski@dbr77.com) and User (justyna.laskowska@dbr77.com).');
            }
        });
    });
}

module.exports = db;
