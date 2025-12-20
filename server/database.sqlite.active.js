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
