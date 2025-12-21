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
            role TEXT, 
            status TEXT DEFAULT 'active',
            avatar_url TEXT,
            timezone TEXT DEFAULT 'UTC',
            units TEXT DEFAULT 'metric',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME,
            FOREIGN KEY(organization_id) REFERENCES organizations(id)
        )`);

        // Migration: Ensure avatar_url exists
        db.run(`ALTER TABLE users ADD COLUMN avatar_url TEXT`, (err) => {
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        )`);

        // Roadmap Waves (SCMS Phase 4)
        db.run(`CREATE TABLE IF NOT EXISTS roadmap_waves (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            start_date DATETIME,
            end_date DATETIME,
            sort_order INTEGER DEFAULT 0,
            status TEXT DEFAULT 'PLANNED', -- PLANNED, ACTIVE, COMPLETED
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
        db.run(`CREATE TABLE IF NOT EXISTS kpi_results (
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
        db.run(`CREATE TABLE IF NOT EXISTS decisions (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            decision_type TEXT NOT NULL, -- INITIATIVE_APPROVAL, PHASE_TRANSITION, UNBLOCK, CANCEL, OTHER
            related_object_type TEXT NOT NULL, -- INITIATIVE, PHASE, ROADMAP, TASK
            related_object_id TEXT NOT NULL,
            decision_owner_id TEXT NOT NULL,
            status TEXT DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
            required INTEGER DEFAULT 1,
            title TEXT NOT NULL,
            description TEXT,
            outcome TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            decided_at DATETIME,
            audit_trail TEXT DEFAULT '[]', -- JSON Array
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(decision_owner_id) REFERENCES users(id) ON DELETE SET NULL
        )`);

        // Initiative Dependencies
        db.run(`CREATE TABLE IF NOT EXISTS initiative_dependencies (
            id TEXT PRIMARY KEY,
            from_initiative_id TEXT NOT NULL, -- Must complete first
            to_initiative_id TEXT NOT NULL,   -- Dependent initiative
            type TEXT DEFAULT 'FINISH_TO_START', -- FINISH_TO_START, SOFT
            is_satisfied INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(from_initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE,
            FOREIGN KEY(to_initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE
        )`);

        // Stage Gates
        db.run(`CREATE TABLE IF NOT EXISTS stage_gates (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            gate_type TEXT NOT NULL, -- READINESS_GATE, DESIGN_GATE, etc.
            from_phase TEXT NOT NULL,
            to_phase TEXT NOT NULL,
            status TEXT DEFAULT 'NOT_READY', -- NOT_READY, READY, PASSED, FAILED
            requires_approval INTEGER DEFAULT 1,
            evaluated_at DATETIME,
            evaluated_by TEXT,
            approved_at DATETIME,
            approved_by TEXT,
            notes TEXT,
            completion_criteria TEXT DEFAULT '[]', -- JSON Array
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

        // Update tasks table with PMO fields
        db.run(`ALTER TABLE tasks ADD COLUMN blocker_type TEXT`, (err) => {
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
        db.run(`CREATE TABLE IF NOT EXISTS roadmaps (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            status TEXT DEFAULT 'DRAFT', -- DRAFT, ACTIVE, BASELINED, ARCHIVED
            planned_start_date DATETIME,
            planned_end_date DATETIME,
            current_baseline_version INTEGER DEFAULT 0,
            last_baselined_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        )`);

        // Roadmap Initiatives (timeline entries)
        db.run(`CREATE TABLE IF NOT EXISTS roadmap_initiatives (
            id TEXT PRIMARY KEY,
            roadmap_id TEXT NOT NULL,
            initiative_id TEXT NOT NULL,
            planned_start_date DATETIME NOT NULL,
            planned_end_date DATETIME NOT NULL,
            planned_duration INTEGER DEFAULT 0, -- Days
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
        db.run(`CREATE TABLE IF NOT EXISTS schedule_baselines (
            id TEXT PRIMARY KEY,
            roadmap_id TEXT NOT NULL,
            project_id TEXT NOT NULL,
            version INTEGER NOT NULL,
            initiative_snapshots TEXT NOT NULL, -- JSON Array
            approved_by TEXT NOT NULL,
            approved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            rationale TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(roadmap_id) REFERENCES roadmaps(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(approved_by) REFERENCES users(id) ON DELETE SET NULL
        )`);

        // User Capacity (weekly)
        db.run(`CREATE TABLE IF NOT EXISTS user_capacity (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            project_id TEXT,
            week_start DATETIME NOT NULL,
            allocated_hours REAL DEFAULT 0,
            available_hours REAL DEFAULT 40,
            utilization_percent REAL DEFAULT 0,
            initiative_allocations TEXT DEFAULT '[]', -- JSON Array
            is_overloaded INTEGER DEFAULT 0,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        )`);

        // Scenarios (what-if, can be non-persistent)
        db.run(`CREATE TABLE IF NOT EXISTS scenarios (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            proposed_changes TEXT DEFAULT '[]', -- JSON Array
            impact_analysis TEXT, -- JSON Object
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

        // ==========================================
        // STEP 5: EXECUTION CONTROL & NOTIFICATIONS
        // ==========================================

        // Notifications
        db.run(`CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            organization_id TEXT NOT NULL,
            project_id TEXT,
            type TEXT NOT NULL,
            severity TEXT DEFAULT 'INFO', -- INFO, WARNING, CRITICAL
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
        db.run(`CREATE TABLE IF NOT EXISTS user_notification_settings (
            user_id TEXT PRIMARY KEY,
            in_app_enabled INTEGER DEFAULT 1,
            email_enabled INTEGER DEFAULT 0,
            mute_info INTEGER DEFAULT 0,
            mute_warning INTEGER DEFAULT 0,
            mute_critical INTEGER DEFAULT 0,
            muted_types TEXT DEFAULT '[]', -- JSON Array
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // Escalations
        db.run(`CREATE TABLE IF NOT EXISTS escalations (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            source_type TEXT NOT NULL, -- DECISION, INITIATIVE, TASK, CAPACITY
            source_id TEXT NOT NULL,
            from_user_id TEXT,
            to_user_id TEXT NOT NULL,
            to_role TEXT NOT NULL,
            reason TEXT NOT NULL,
            trigger_type TEXT NOT NULL, -- OVERDUE, STALLED, OVERLOAD, MANUAL
            days_overdue INTEGER DEFAULT 0,
            status TEXT DEFAULT 'PENDING', -- PENDING, ACKNOWLEDGED, RESOLVED
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
        db.run(`CREATE TABLE IF NOT EXISTS audit_events (
            id TEXT PRIMARY KEY,
            ts DATETIME DEFAULT CURRENT_TIMESTAMP,
            actor_user_id TEXT,
            actor_type TEXT NOT NULL DEFAULT 'USER', -- USER, CONSULTANT, SYSTEM, AI
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
        db.run(`CREATE TABLE IF NOT EXISTS value_hypotheses (
            id TEXT PRIMARY KEY,
            initiative_id TEXT NOT NULL,
            project_id TEXT NOT NULL,
            description TEXT NOT NULL,
            type TEXT NOT NULL, -- COST_REDUCTION, REVENUE_INCREASE, RISK_REDUCTION, EFFICIENCY, STRATEGIC_OPTION
            confidence_level TEXT DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH
            owner_id TEXT NOT NULL,
            related_initiative_ids TEXT DEFAULT '[]', -- JSON Array
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
        db.run(`CREATE TABLE IF NOT EXISTS financial_assumptions (
            id TEXT PRIMARY KEY,
            value_hypothesis_id TEXT NOT NULL,
            low_estimate REAL,
            expected_estimate REAL,
            high_estimate REAL,
            currency TEXT DEFAULT 'USD',
            timeframe TEXT DEFAULT 'per year',
            notes TEXT,
            is_non_binding INTEGER DEFAULT 1, -- Always true
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(value_hypothesis_id) REFERENCES value_hypotheses(id) ON DELETE CASCADE
        )`);

        // Project Closures
        db.run(`CREATE TABLE IF NOT EXISTS project_closures (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL UNIQUE,
            closure_type TEXT NOT NULL, -- COMPLETED, CANCELLED, ARCHIVED
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
        db.run(`CREATE TABLE IF NOT EXISTS pmo_domains (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            iso21500_term TEXT,      -- ISO 21500 equivalent terminology
            pmbok_term TEXT,         -- PMI PMBOK equivalent terminology
            prince2_term TEXT,       -- PRINCE2 equivalent terminology
            is_configurable INTEGER DEFAULT 1,  -- Can be enabled/disabled per project
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        /**
         * Project PMO Domain Configuration
         * 
         * Junction table allowing per-project enablement of PMO domains.
         * Projects can choose which domains are active for their governance model.
         */
        db.run(`CREATE TABLE IF NOT EXISTS project_pmo_domains (
            project_id TEXT NOT NULL,
            domain_id TEXT NOT NULL,
            is_enabled INTEGER DEFAULT 1,
            enabled_by TEXT,
            enabled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            custom_label TEXT,       -- Optional custom terminology for this project
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
        db.run(`CREATE TABLE IF NOT EXISTS pmo_audit_trail (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            pmo_domain_id TEXT NOT NULL,
            pmo_phase TEXT NOT NULL,           -- Current phase when action occurred
            object_type TEXT NOT NULL,         -- DECISION, BASELINE, CHANGE_REQUEST, STAGE_GATE, etc.
            object_id TEXT NOT NULL,           -- ID of the PMO object
            action TEXT NOT NULL,              -- CREATED, UPDATED, APPROVED, REJECTED, TRANSITIONED, etc.
            actor_id TEXT,                     -- User who performed the action
            iso21500_mapping TEXT,             -- ISO 21500 term at time of action
            pmbok_mapping TEXT,                -- PMBOK term at time of action
            prince2_mapping TEXT,              -- PRINCE2 term at time of action
            metadata TEXT DEFAULT '{}',        -- JSON: additional context
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
        db.run(`CREATE TABLE IF NOT EXISTS ai_policies (
            organization_id TEXT PRIMARY KEY,
            policy_level TEXT DEFAULT 'ADVISORY', -- ADVISORY, ASSISTED, PROACTIVE, AUTOPILOT
            internet_enabled INTEGER DEFAULT 0,
            audit_required INTEGER DEFAULT 1,
            active_roles TEXT DEFAULT '["ADVISOR","PMO_MANAGER","EXECUTOR","EDUCATOR"]', -- JSON Array
            max_policy_level TEXT DEFAULT 'ASSISTED',
            default_ai_role TEXT DEFAULT 'ADVISOR',
            proactive_notifications INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);

        // AI Project Memory (Persistent per project)
        db.run(`CREATE TABLE IF NOT EXISTS ai_project_memory (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            memory_type TEXT NOT NULL, -- DECISION, PHASE_TRANSITION, RECOMMENDATION
            content TEXT NOT NULL, -- JSON Object
            recorded_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(recorded_by) REFERENCES users(id) ON DELETE SET NULL
        )`);

        // AI Organization Memory
        db.run(`CREATE TABLE IF NOT EXISTS ai_organization_memory (
            organization_id TEXT PRIMARY KEY,
            governance_style TEXT DEFAULT 'BALANCED', -- STRICT, BALANCED, FLEXIBLE
            ai_strictness TEXT DEFAULT 'STANDARD', -- MINIMAL, STANDARD, AGGRESSIVE
            recurring_patterns TEXT DEFAULT '[]', -- JSON Array
            pmo_maturity TEXT DEFAULT 'BASIC', -- BASIC, INTERMEDIATE, ADVANCED
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);

        // AI User Preferences
        db.run(`CREATE TABLE IF NOT EXISTS ai_user_preferences (
            user_id TEXT PRIMARY KEY,
            preferred_tone TEXT DEFAULT 'EXPERT', -- BUDDY, EXPERT, MANAGER
            education_mode INTEGER DEFAULT 0,
            proactive_notifications INTEGER DEFAULT 1,
            preferred_language TEXT DEFAULT 'en',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // AI Audit Logs
        db.run(`CREATE TABLE IF NOT EXISTS ai_audit_logs (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            organization_id TEXT NOT NULL,
            project_id TEXT,
            action_type TEXT NOT NULL,
            action_description TEXT,
            context_snapshot TEXT, -- JSON Object
            data_sources_used TEXT DEFAULT '[]', -- JSON Array
            ai_role TEXT NOT NULL,
            policy_level TEXT NOT NULL,
            confidence_level REAL,
            ai_suggestion TEXT,
            user_decision TEXT, -- ACCEPTED, REJECTED, MODIFIED, IGNORED
            user_feedback TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL
        )`);

        // AI Actions (Pending approvals)
        db.run(`CREATE TABLE IF NOT EXISTS ai_actions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            organization_id TEXT NOT NULL,
            project_id TEXT,
            action_type TEXT NOT NULL,
            payload TEXT NOT NULL, -- JSON Object
            draft_content TEXT,
            required_policy_level TEXT NOT NULL,
            current_policy_level TEXT NOT NULL,
            requires_approval INTEGER DEFAULT 1,
            status TEXT DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED, EXECUTED
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
        db.run(`CREATE TABLE IF NOT EXISTS organization_facilities (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            name TEXT,
            location TEXT,
            headcount INTEGER DEFAULT 0,
            activity_profile TEXT, -- JSON
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);

        // Client Context
        db.run(`CREATE TABLE IF NOT EXISTS client_context (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            key TEXT NOT NULL,
            value TEXT,
            confidence REAL DEFAULT 1.0,
            source TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`); db.run(`CREATE TABLE IF NOT EXISTS password_resets (
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
        db.run(`CREATE TABLE IF NOT EXISTS invitation_events (
            id TEXT PRIMARY KEY,
            invitation_id TEXT NOT NULL,
            event_type TEXT NOT NULL,  -- created, sent, resent, accepted, expired, revoked
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
        db.run(`CREATE TABLE IF NOT EXISTS legal_documents (
            id TEXT PRIMARY KEY,
            doc_type TEXT NOT NULL,
            version TEXT NOT NULL,
            title TEXT NOT NULL,
            content_md TEXT NOT NULL,
            effective_from TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
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
        db.run(`CREATE TABLE IF NOT EXISTS legal_acceptances (
            id TEXT PRIMARY KEY,
            organization_id TEXT,
            user_id TEXT NOT NULL,
            doc_type TEXT NOT NULL,
            version TEXT NOT NULL,
            accepted_at TEXT DEFAULT (datetime('now')),
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
        db.run(`CREATE TABLE IF NOT EXISTS legal_events (
            id TEXT PRIMARY KEY,
            event_type TEXT NOT NULL,
            document_id TEXT,
            document_version TEXT,
            user_id TEXT,
            organization_id TEXT,
            performed_by TEXT NOT NULL,
            metadata TEXT DEFAULT '{}',
            created_at TEXT DEFAULT (datetime('now'))
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
        db.run(`CREATE TABLE IF NOT EXISTS organization_limits (
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
        db.run(`CREATE TABLE IF NOT EXISTS demo_templates (
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
        db.run(`CREATE TABLE IF NOT EXISTS usage_counters (
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
        db.run(`CREATE TABLE IF NOT EXISTS organization_events (
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
        db.run(`CREATE TABLE IF NOT EXISTS promo_codes (
            id TEXT PRIMARY KEY,
            code TEXT UNIQUE NOT NULL,
            type TEXT NOT NULL,                    -- DISCOUNT | PARTNER | CAMPAIGN
            discount_type TEXT DEFAULT 'NONE',     -- PERCENT | FIXED | NONE
            discount_value REAL,                   -- nullable, only if discount_type != NONE
            valid_from TEXT NOT NULL,
            valid_until TEXT,                      -- nullable = infinite
            max_uses INTEGER,                      -- nullable = unlimited
            used_count INTEGER DEFAULT 0,
            created_by_user_id TEXT,
            is_active INTEGER DEFAULT 1,
            metadata TEXT DEFAULT '{}',            -- JSON for extensibility
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
        db.run(`CREATE TABLE IF NOT EXISTS attribution_events (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            user_id TEXT,                          -- nullable (anonymous demos)
            source_type TEXT NOT NULL,             -- PROMO_CODE | INVITATION | DEMO | SALES | SELF_SERVE
            source_id TEXT,                        -- promo_code_id | invitation_id | null
            campaign TEXT,                         -- UTM campaign or similar
            partner_code TEXT,                     -- Partner attribution
            medium TEXT,                           -- UTM medium or channel
            metadata TEXT DEFAULT '{}',            -- JSON for extensibility
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
        db.run(`CREATE TABLE IF NOT EXISTS promo_code_usage (
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

        // Notification Preferences Table
        db.run(`CREATE TABLE IF NOT EXISTS notification_preferences (
            user_id TEXT PRIMARY KEY,
            channels TEXT DEFAULT '{"inApp":true,"email":true}', -- JSON
            digest TEXT DEFAULT 'daily', -- daily, weekly, off
            triggers TEXT DEFAULT '{"overdue":true,"assigned":true,"blocked":true,"mentioned":true}', -- JSON
            quiet_hours TEXT DEFAULT '{"enabled":false,"start":"22:00","end":"08:00"}', -- JSON
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
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

        // 2.5 Structured Entity Context (Facilities) - Defined earlier
        // 3. Client Context (Persistent Memory per Client) - Defined earlier

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

        // New Value & Finance Fields
        const valueColumns = [
            { name: 'value_driver', type: 'TEXT', default: 'NULL' },
            { name: 'confidence_level', type: 'TEXT', default: 'NULL' },
            { name: 'value_timing', type: 'TEXT', default: 'NULL' }
        ];

        valueColumns.forEach(col => {
            db.run(`ALTER TABLE initiatives ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.default}`, (err) => {
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
            db.run(`ALTER TABLE initiatives ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.default}`, (err) => {
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

        // Add effort_estimate column (alias for estimated_hours for capacity service)
        db.run(`ALTER TABLE tasks ADD COLUMN effort_estimate REAL DEFAULT NULL`, (err) => {
            // Ignore error if column already exists
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

        // ==========================================
        // PHASE 6: REPORT BUILDER (Added Fix)
        // ==========================================

        db.run(`CREATE TABLE IF NOT EXISTS reports (
            id TEXT PRIMARY KEY,
            project_id TEXT,
            organization_id TEXT,
            title TEXT,
            status TEXT DEFAULT 'draft',
            version INTEGER DEFAULT 1,
            block_order TEXT DEFAULT '[]', -- JSON array of block IDs
            sources TEXT DEFAULT '[]', -- JSON array of sources used
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS report_blocks (
            id TEXT PRIMARY KEY,
            report_id TEXT NOT NULL,
            type TEXT NOT NULL, -- text, table, chart, etc.
            title TEXT,
            module TEXT, -- Origin module
            content TEXT, -- JSON content
            meta TEXT, -- JSON metadata (layout, chart config)
            position INTEGER DEFAULT 0,
            locked INTEGER DEFAULT 0, -- boolean
            ai_regeneratable INTEGER DEFAULT 1, -- boolean
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(report_id) REFERENCES reports(id) ON DELETE CASCADE
        )`);

        // ==========================================
        // AI ENTERPRISE CONTROL LAYERS
        // ==========================================

        // AI-1: Budget Management
        db.run(`CREATE TABLE IF NOT EXISTS ai_budgets (
            id TEXT PRIMARY KEY,
            scope_type TEXT NOT NULL, -- 'global' | 'tenant' | 'project'
            scope_id TEXT,
            monthly_limit_usd REAL,
            current_month_usage REAL DEFAULT 0,
            reset_day INTEGER DEFAULT 1,
            auto_downgrade INTEGER DEFAULT 1, -- auto-downgrade when exceeded
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(scope_type, scope_id)
        )`);

        // AI-1: Usage Logging (Audit)
        db.run(`CREATE TABLE IF NOT EXISTS ai_usage_log (
            id TEXT PRIMARY KEY,
            organization_id TEXT,
            project_id TEXT,
            user_id TEXT,
            model_used TEXT,
            model_category TEXT, -- reasoning | execution | chat | summarization
            action_type TEXT, -- chat | analysis | generation | etc.
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
        db.run(`CREATE TABLE IF NOT EXISTS ai_model_config (
            id TEXT PRIMARY KEY,
            provider_id TEXT,
            category TEXT NOT NULL, -- reasoning | execution | chat | summarization
            priority_tier INTEGER DEFAULT 1, -- 1=premium, 2=standard, 3=budget
            cost_per_1k_input REAL,
            cost_per_1k_output REAL,
            max_context_tokens INTEGER,
            capabilities TEXT, -- JSON array of capabilities
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(provider_id) REFERENCES llm_providers(id)
        )`);

        // AI-2: Hierarchical Prompts (Versioned)
        db.run(`CREATE TABLE IF NOT EXISTS ai_system_prompts (
            id TEXT PRIMARY KEY,
            prompt_type TEXT NOT NULL, -- 'system' | 'role' | 'phase'
            prompt_key TEXT NOT NULL, -- e.g., 'ADVISOR', 'Context', 'GLOBAL'
            content TEXT NOT NULL,
            version INTEGER DEFAULT 1,
            is_active INTEGER DEFAULT 1,
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(prompt_type, prompt_key, version)
        )`);

        // AI-2: User Prompt Preferences
        db.run(`CREATE TABLE IF NOT EXISTS ai_user_prompt_prefs (
            user_id TEXT PRIMARY KEY,
            preferred_tone TEXT DEFAULT 'PROFESSIONAL', -- PROFESSIONAL | FRIENDLY | EXPERT
            education_mode INTEGER DEFAULT 0,
            language_preference TEXT DEFAULT 'en',
            custom_instructions TEXT,
            max_response_length TEXT DEFAULT 'medium', -- short | medium | long
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // AI-3: Project RAG Settings
        db.run(`CREATE TABLE IF NOT EXISTS project_rag_settings (
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
        db.run(`CREATE TABLE IF NOT EXISTS external_data_settings (
            id TEXT PRIMARY KEY,
            scope_type TEXT NOT NULL, -- 'tenant' | 'project'
            scope_id TEXT NOT NULL,
            enabled INTEGER DEFAULT 0, -- disabled by default
            allowed_providers TEXT, -- JSON array of allowed providers
            max_queries_per_day INTEGER DEFAULT 100,
            require_labeling INTEGER DEFAULT 1,
            enabled_by TEXT,
            enabled_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(scope_type, scope_id),
            FOREIGN KEY(enabled_by) REFERENCES users(id)
        )`);

        // AI-4: External Data Audit Log
        db.run(`CREATE TABLE IF NOT EXISTS external_data_log (
            id TEXT PRIMARY KEY,
            organization_id TEXT,
            project_id TEXT,
            user_id TEXT,
            query TEXT,
            provider TEXT,
            sources_count INTEGER,
            sources_used TEXT, -- JSON array of source URLs
            response_summary TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id),
            FOREIGN KEY(project_id) REFERENCES projects(id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // AI-5: Integration Configurations
        db.run(`CREATE TABLE IF NOT EXISTS integration_configs (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            project_id TEXT,
            integration_type TEXT NOT NULL, -- task_sync | notifications | calendar | document
            provider TEXT NOT NULL, -- jira | clickup | slack | teams | etc.
            config TEXT, -- Encrypted JSON configuration
            webhook_url TEXT,
            webhook_secret TEXT,
            is_active INTEGER DEFAULT 0,
            last_sync_at DATETIME,
            sync_direction TEXT DEFAULT 'bidirectional', -- inbound | outbound | bidirectional
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id),
            FOREIGN KEY(project_id) REFERENCES projects(id)
        )`);

        // AI-5: Pending Sync Actions (AI suggestions requiring approval)
        db.run(`CREATE TABLE IF NOT EXISTS integration_pending_actions (
            id TEXT PRIMARY KEY,
            organization_id TEXT,
            project_id TEXT,
            integration_id TEXT,
            action_type TEXT, -- create_task | update_task | send_notification | sync_status
            target_entity_type TEXT, -- task | initiative | decision | etc.
            target_entity_id TEXT,
            payload TEXT, -- JSON payload to send
            suggested_by TEXT DEFAULT 'ai', -- 'ai' | 'system' | 'user'
            suggestion_reason TEXT,
            status TEXT DEFAULT 'pending', -- pending | approved | rejected | executed | expired
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
        db.run(`CREATE TABLE IF NOT EXISTS integration_sync_log (
            id TEXT PRIMARY KEY,
            integration_id TEXT,
            direction TEXT, -- inbound | outbound
            action_type TEXT,
            external_id TEXT,
            external_url TEXT,
            internal_entity_type TEXT,
            internal_entity_id TEXT,
            status TEXT, -- success | failed | partial
            error_message TEXT,
            sync_data TEXT, -- JSON of synced data
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(integration_id) REFERENCES integration_configs(id)
        )`);

        // ==========================================
        // AI PMO INTELLIGENCE LAYERS (AI-6 to AI-11)
        // ==========================================

        // AI-6: Decision Briefs (AI-generated context for decisions)
        db.run(`CREATE TABLE IF NOT EXISTS decision_briefs (
            id TEXT PRIMARY KEY,
            decision_id TEXT NOT NULL,
            context_summary TEXT,
            options TEXT, -- JSON array of options with pros/cons
            risks TEXT, -- JSON array of risks
            ai_recommendation TEXT,
            recommendation_rationale TEXT,
            recommendation_confidence REAL,
            data_sources_used TEXT, -- JSON array of sources
            generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(decision_id) REFERENCES decisions(id) ON DELETE CASCADE
        )`);

        // AI-6: Decision Impact Tracking
        db.run(`CREATE TABLE IF NOT EXISTS decision_impacts (
            id TEXT PRIMARY KEY,
            decision_id TEXT NOT NULL,
            impacted_type TEXT NOT NULL, -- initiative | task | roadmap | project
            impacted_id TEXT NOT NULL,
            impact_description TEXT,
            is_blocker INTEGER DEFAULT 0,
            blocking_since DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(decision_id) REFERENCES decisions(id) ON DELETE CASCADE
        )`);

        // AI-7: Risk Register
        db.run(`CREATE TABLE IF NOT EXISTS risk_register (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            organization_id TEXT,
            risk_type TEXT NOT NULL, -- delivery | capacity | dependency | decision | change_fatigue
            severity TEXT DEFAULT 'medium', -- low | medium | high | critical
            likelihood TEXT DEFAULT 'medium', -- low | medium | high
            title TEXT NOT NULL,
            description TEXT,
            trigger_conditions TEXT, -- What triggered detection
            affected_entities TEXT, -- JSON array of affected items
            mitigation_plan TEXT,
            owner_id TEXT,
            status TEXT DEFAULT 'open', -- open | mitigating | resolved | accepted | escalated
            detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            detected_by TEXT DEFAULT 'ai', -- ai | user
            escalated_at DATETIME,
            resolved_at DATETIME,
            resolution_notes TEXT,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(owner_id) REFERENCES users(id)
        )`);

        // AI-7: Scope Change Log
        db.run(`CREATE TABLE IF NOT EXISTS scope_change_log (
            id TEXT PRIMARY KEY,
            project_id TEXT,
            organization_id TEXT,
            entity_type TEXT NOT NULL, -- initiative | roadmap | task | project
            entity_id TEXT NOT NULL,
            change_type TEXT NOT NULL, -- add | remove | modify | expand | reduce
            change_summary TEXT,
            field_changed TEXT, -- Which field was changed
            previous_value TEXT,
            new_value TEXT,
            is_controlled INTEGER DEFAULT 1, -- Was it through proper approval?
            change_reason TEXT,
            approved_by TEXT,
            changed_by TEXT,
            changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(project_id) REFERENCES projects(id),
            FOREIGN KEY(approved_by) REFERENCES users(id),
            FOREIGN KEY(changed_by) REFERENCES users(id)
        )`);

        // AI-8: User Capacity Profiles
        db.run(`CREATE TABLE IF NOT EXISTS user_capacity_profile (
            user_id TEXT PRIMARY KEY,
            organization_id TEXT,
            default_weekly_hours REAL DEFAULT 40,
            role_type TEXT DEFAULT 'full_time', -- full_time | part_time | contractor
            capacity_unit TEXT DEFAULT 'hours', -- hours | points | percentage
            vacation_calendar TEXT, -- JSON of planned absences
            skills TEXT, -- JSON array of skills
            max_concurrent_initiatives INTEGER DEFAULT 3,
            preferred_work_types TEXT, -- JSON array
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(organization_id) REFERENCES organizations(id)
        )`);

        // AI-8: Workload Snapshots (for trend analysis)
        db.run(`CREATE TABLE IF NOT EXISTS workload_snapshots (
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
            burnout_risk_score REAL, -- 0-100
            is_overloaded INTEGER DEFAULT 0,
            trend_direction TEXT, -- improving | stable | worsening
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(project_id) REFERENCES projects(id)
        )`);

        // AI-9: Maturity Assessments
        db.run(`CREATE TABLE IF NOT EXISTS maturity_assessments (
            id TEXT PRIMARY KEY,
            project_id TEXT,
            organization_id TEXT,
            assessment_date DATE NOT NULL,
            planning_score REAL, -- 0-5
            decision_score REAL, -- 0-5
            execution_score REAL, -- 0-5
            governance_score REAL, -- 0-5
            adoption_score REAL, -- 0-5
            overall_score REAL, -- Average
            overall_level INTEGER, -- 1-5 (Initial to Optimizing)
            insights TEXT, -- JSON of observations
            recommendations TEXT, -- JSON of recommendations
            benchmarks_used TEXT, -- JSON of comparison data
            assessed_by TEXT DEFAULT 'ai',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(project_id) REFERENCES projects(id),
            FOREIGN KEY(organization_id) REFERENCES organizations(id)
        )`);

        // AI-9: Discipline Events (for pattern detection)
        db.run(`CREATE TABLE IF NOT EXISTS discipline_events (
            id TEXT PRIMARY KEY,
            project_id TEXT,
            organization_id TEXT,
            event_type TEXT NOT NULL, -- missed_deadline | late_decision | scope_creep | blocked_task | stalled_initiative
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
        db.run(`CREATE TABLE IF NOT EXISTS ai_failure_log (
            id TEXT PRIMARY KEY,
            failure_type TEXT NOT NULL, -- model_unavailable | budget_exceeded | context_incomplete | rate_limited | timeout
            context TEXT, -- JSON context of the request
            user_id TEXT,
            organization_id TEXT,
            project_id TEXT,
            error_message TEXT,
            error_code TEXT,
            fallback_used TEXT, -- What fallback was applied
            recovery_action TEXT,
            user_notified INTEGER DEFAULT 0,
            occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(organization_id) REFERENCES organizations(id)
        )`);

        // AI-11: AI Health Status (singleton table for monitoring)
        db.run(`CREATE TABLE IF NOT EXISTS ai_health_status (
            id TEXT PRIMARY KEY DEFAULT 'singleton',
            overall_status TEXT DEFAULT 'healthy', -- healthy | degraded | unavailable
            model_status TEXT DEFAULT 'available', -- available | limited | unavailable
            budget_status TEXT DEFAULT 'ok', -- ok | warning | exceeded
            knowledge_status TEXT DEFAULT 'ok', -- ok | empty | error
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
        db.run(`CREATE TABLE IF NOT EXISTS partners (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            partner_type TEXT NOT NULL,           -- REFERRAL | RESELLER | SALES
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
        db.run(`CREATE TABLE IF NOT EXISTS partner_agreements (
            id TEXT PRIMARY KEY,
            partner_id TEXT NOT NULL,
            valid_from DATETIME NOT NULL,
            valid_until DATETIME,                 -- NULL = indefinitely valid
            revenue_share_percent REAL NOT NULL,
            applies_to TEXT DEFAULT 'GLOBAL',     -- GLOBAL | CAMPAIGN | PRODUCT
            applies_value TEXT,                   -- Campaign/product ID if scoped
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
        db.run(`CREATE TABLE IF NOT EXISTS settlement_periods (
            id TEXT PRIMARY KEY,
            period_start DATETIME NOT NULL,
            period_end DATETIME NOT NULL,
            status TEXT DEFAULT 'OPEN',           -- OPEN | CALCULATED | LOCKED
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
        db.run(`CREATE TABLE IF NOT EXISTS partner_settlements (
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
            entry_type TEXT DEFAULT 'NORMAL',     -- NORMAL | ADJUSTMENT
            adjusts_settlement_id TEXT,           -- FK to original settlement being corrected
            adjustment_reason TEXT,               -- Required if entry_type = ADJUSTMENT
            metadata TEXT DEFAULT '{}',           -- calculation timestamp, rate source, etc.
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
        db.run(`CREATE TABLE IF NOT EXISTS help_playbooks (
            id TEXT PRIMARY KEY,
            key TEXT UNIQUE NOT NULL,              -- Unique key e.g. "trial_expired", "invite_users"
            title TEXT NOT NULL,
            description TEXT,
            target_role TEXT DEFAULT 'ANY',        -- ADMIN | USER | SUPERADMIN | PARTNER | ANY
            target_org_type TEXT DEFAULT 'ANY',    -- DEMO | TRIAL | PAID | ANY
            priority INTEGER DEFAULT 3,            -- 1-5 (1=highest priority)
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        /**
         * Help Steps Table
         * 
         * Individual steps within each playbook.
         * Steps are displayed in order and can link to specific UI elements or routes.
         */
        db.run(`CREATE TABLE IF NOT EXISTS help_steps (
            id TEXT PRIMARY KEY,
            playbook_id TEXT NOT NULL,
            step_order INTEGER NOT NULL,
            title TEXT NOT NULL,
            content_md TEXT NOT NULL,              -- Markdown content
            ui_target TEXT,                        -- CSS selector or route path
            action_type TEXT DEFAULT 'INFO',       -- INFO | CTA | LINK
            action_payload TEXT DEFAULT '{}',      -- JSON payload for CTA/LINK actions
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(playbook_id) REFERENCES help_playbooks(id) ON DELETE CASCADE
        )`);

        /**
         * Help Events Table (AUDIT / ANALYTICS)
         * 
         * CRITICAL: This table is APPEND-ONLY for audit compliance.
         * Never UPDATE or DELETE rows. All interactions are logged for analytics.
         */
        db.run(`CREATE TABLE IF NOT EXISTS help_events (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            organization_id TEXT NOT NULL,
            playbook_key TEXT NOT NULL,
            event_type TEXT NOT NULL,              -- VIEWED | STARTED | COMPLETED | DISMISSED
            context TEXT DEFAULT '{}',             -- JSON context (route, feature, blocked_action, etc.)
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
        db.run(`CREATE TABLE IF NOT EXISTS metrics_events (
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
        db.run(`CREATE TABLE IF NOT EXISTS metrics_snapshots (
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
        db.run(`CREATE TABLE IF NOT EXISTS action_decisions (
            id TEXT PRIMARY KEY,
            proposal_id TEXT NOT NULL,
            organization_id TEXT,            -- Added for RBAC hardening
            correlation_id TEXT,             -- Step 9.5: For tracing proposal→decision→execution
            decision TEXT NOT NULL,          -- APPROVED | REJECTED | MODIFIED
            decided_by_user_id TEXT NOT NULL,
            decision_reason TEXT,
            action_type TEXT NOT NULL,       -- Denormalized for filtering
            scope TEXT NOT NULL,            -- Denormalized for filtering
            proposal_snapshot TEXT,          -- Full JSON of AI proposal (Step 9.2 alignment)
            original_payload TEXT,           -- JSON (deprecated, use snapshot)
            modified_payload TEXT,           -- JSON (only if MODIFIED)
            archived_at DATETIME,            -- Step 9.7: For retention policy
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
        db.run(`CREATE TABLE IF NOT EXISTS action_executions (
            id TEXT PRIMARY KEY,
            decision_id TEXT NOT NULL,
            proposal_id TEXT NOT NULL,       -- Consistency
            action_type TEXT NOT NULL,       -- Consistency
            organization_id TEXT NOT NULL,   -- Consistency
            correlation_id TEXT NOT NULL,    -- Step 9.5: For tracing
            executed_by TEXT DEFAULT 'SYSTEM',
            status TEXT NOT NULL,            -- SUCCESS | FAILED
            result TEXT,                     -- JSON
            error_code TEXT,                 -- For diagnostics (uses ACTION_ERROR_CODES)
            error_message TEXT,              -- For diagnostics
            duration_ms INTEGER,             -- Step 9.5: Execution duration
            archived_at DATETIME,            -- Step 9.7: For retention policy
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
        db.run(`CREATE TABLE IF NOT EXISTS ai_policy_rules (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            enabled INTEGER DEFAULT 1,
            action_type TEXT NOT NULL,           -- TASK_CREATE | PLAYBOOK_ASSIGN | etc.
            scope TEXT NOT NULL,                 -- USER | ORG | INITIATIVE
            max_risk_level TEXT NOT NULL,        -- LOW | MEDIUM | HIGH
            conditions JSON NOT NULL,            -- Rule conditions JSON
            auto_decision TEXT NOT NULL,         -- APPROVED | MODIFIED
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
        db.run(`CREATE TABLE IF NOT EXISTS ai_policy_settings (
            id TEXT PRIMARY KEY DEFAULT 'singleton',
            policy_engine_enabled INTEGER DEFAULT 1,
            updated_by TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Ensure singleton row exists
        db.run(`INSERT OR IGNORE INTO ai_policy_settings (id) VALUES ('singleton')`);

        // ==========================================
        // STEP 10: AI PLAYBOOKS (Multi-Step Action Plans)
        // ==========================================

        /**
         * AI Playbook Templates
         * Defines reusable multi-step action sequences triggered by signals.
         */
        db.run(`CREATE TABLE IF NOT EXISTS ai_playbook_templates (
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
        db.run(`CREATE TABLE IF NOT EXISTS ai_playbook_template_steps (
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
        db.run(`CREATE TABLE IF NOT EXISTS ai_playbook_runs (
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
        db.run(`CREATE TABLE IF NOT EXISTS ai_playbook_run_steps (
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
        db.run(`CREATE TABLE IF NOT EXISTS async_jobs (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,                    -- EXECUTE_DECISION | ADVANCE_PLAYBOOK_STEP
            organization_id TEXT NOT NULL,
            correlation_id TEXT NOT NULL,
            entity_id TEXT NOT NULL,               -- decisionId or playbookRunStepId
            status TEXT NOT NULL DEFAULT 'QUEUED', -- QUEUED|RUNNING|SUCCESS|FAILED|DEAD_LETTER|CANCELLED
            priority TEXT DEFAULT 'normal',        -- low|normal|high
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
        db.run(`CREATE TABLE IF NOT EXISTS connectors (
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
        db.run(`CREATE TABLE IF NOT EXISTS org_connector_configs (
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
        db.run(`CREATE TABLE IF NOT EXISTS connector_health (
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

        const insertConnector = db.prepare(`INSERT OR IGNORE INTO connectors (key, name, category, capabilities_json) VALUES (?, ?, ?, ?)`);
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
        db.run(`CREATE TABLE IF NOT EXISTS outcome_definitions (
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL,
            entity_type TEXT NOT NULL,               -- ACTION_TYPE | PLAYBOOK_TEMPLATE
            entity_key TEXT NOT NULL,                -- e.g., 'TASK_CREATE' or playbook template key
            metrics_tracked TEXT NOT NULL DEFAULT '{}', -- JSON: { "tasks_completed": true, "time_saved_mins": true }
            measurement_window_days INTEGER DEFAULT 7,
            baseline_query TEXT,                      -- Optional custom SQL for baseline
            success_criteria TEXT DEFAULT '{}',       -- JSON: { "tasks_completed_delta": "> 0" }
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
        db.run(`CREATE TABLE IF NOT EXISTS outcome_measurements (
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL,
            definition_id TEXT NOT NULL,
            run_id TEXT,                              -- Link to ai_playbook_runs (nullable)
            execution_id TEXT,                        -- Link to action_executions (nullable)
            entity_type TEXT NOT NULL,
            entity_key TEXT NOT NULL,
            baseline_json TEXT NOT NULL DEFAULT '{}',
            after_json TEXT DEFAULT '{}',
            delta_json TEXT DEFAULT '{}',
            is_success INTEGER,                       -- Computed based on success_criteria
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
        db.run(`CREATE TABLE IF NOT EXISTS roi_models (
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            assumptions TEXT NOT NULL DEFAULT '{}',   -- JSON: { "hourly_cost": 75, "downtime_cost_per_hour": 500 }
            metric_mappings TEXT NOT NULL DEFAULT '{}', -- JSON: { "time_saved_mins": { "formula": "value * (hourly_cost/60)" } }
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
        db.run(`CREATE TABLE IF NOT EXISTS approval_assignments (
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL,
            proposal_id TEXT NOT NULL,
            assigned_to_user_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING|ACKED|DONE|EXPIRED
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
        db.run(`CREATE TABLE IF NOT EXISTS user_notification_preferences (
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
        db.run(`CREATE TABLE IF NOT EXISTS notification_outbox (
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            notification_type TEXT NOT NULL, -- APPROVAL_DUE|PLAYBOOK_STUCK|DEAD_LETTER|ESCALATION
            payload_json TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'QUEUED', -- QUEUED|SENT|FAILED
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
        db.run(`CREATE TABLE IF NOT EXISTS ai_evidence_objects (
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
        db.run(`CREATE TABLE IF NOT EXISTS ai_explainability_links (
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
        db.run(`CREATE TABLE IF NOT EXISTS ai_reasoning_ledger (
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
        db.run(`CREATE TABLE IF NOT EXISTS permissions (
            id TEXT PRIMARY KEY,
            scope TEXT NOT NULL,         -- global, organization, project
            resource TEXT NOT NULL,      -- e.g. 'financials', 'settings', 'ai_ops'
            action TEXT NOT NULL,        -- create, read, update, delete, approve
            name TEXT NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(scope, resource, action)
        )`);

        /**
         * Role Permissions Table
         * Maps defined roles (e.g. 'ORG_ADMIN', 'PMO_MANAGER') to specific permissions.
         */
        db.run(`CREATE TABLE IF NOT EXISTS role_permissions (
            role_key TEXT NOT NULL,      -- e.g. 'ORG_ADMIN'
            permission_id TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY(role_key, permission_id),
            FOREIGN KEY(permission_id) REFERENCES permissions(id) ON DELETE CASCADE
        )`);

        /**
         * Organization User Permissions (Overrides)
         * Specific permissions granted to a user within an org, independent of their role.
         */
        db.run(`CREATE TABLE IF NOT EXISTS org_user_permissions (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            permission_id TEXT NOT NULL,
            is_granted INTEGER DEFAULT 1, -- 1=grant, 0=deny (explicit deny)
            granted_by TEXT,
            granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(permission_id) REFERENCES permissions(id) ON DELETE CASCADE
        )`);

        /**
         * Governance Audit Log (Immutable)
         * High-fidelity audit trail for all governance actions.
         */
        db.run(`CREATE TABLE IF NOT EXISTS governance_audit_log (
            id TEXT PRIMARY KEY,
            event_type TEXT NOT NULL,
            actor_id TEXT NOT NULL,
            organization_id TEXT,
            project_id TEXT,
            resource_type TEXT NOT NULL,
            resource_id TEXT NOT NULL,
            previous_state TEXT,    -- JSON snapshot
            new_state TEXT,         -- JSON snapshot
            metadata TEXT,          -- JSON: ip, user_agent, correlation_id
            hash TEXT,              -- Tamper-evident hash
            prev_hash TEXT,         -- Link to previous record
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
        db.run(`CREATE TABLE IF NOT EXISTS break_glass_sessions (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            actor_id TEXT NOT NULL,
            reason TEXT NOT NULL,
            scope TEXT NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            closed_at DATETIME,
            -- Legacy/compat fields (safe to keep, optional)
            ticket_ref TEXT,
            permissions_granted TEXT,
            started_at DATETIME,
            ended_at DATETIME,
            is_active INTEGER DEFAULT 1,
            FOREIGN KEY(actor_id) REFERENCES users(id),
            FOREIGN KEY(organization_id) REFERENCES organizations(id)
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
