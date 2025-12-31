/**
 * Seed My Work Test Data
 * 
 * Creates comprehensive test data for the My Work module:
 * - 20 tasks with various statuses, priorities, and PMO labels
 * - Focus tasks with time blocks
 * - Notifications of different severities
 * - Pending decisions
 * 
 * Usage:
 *   node server/seed/seed_mywork_testdata.js
 */

const { v4: uuidv4 } = require('uuid');

// Detect database type
const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres');

let db;
if (isPostgres) {
    require('dotenv').config();
    const { Pool } = require('pg');
    db = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    });
} else {
    db = require('../database');
}

// ============================================================
// DATABASE HELPERS
// ============================================================

async function dbRun(sql, params = []) {
    if (isPostgres) {
        let pgSql = sql;
        let paramIndex = 0;
        pgSql = pgSql.replace(/\?/g, () => `$${++paramIndex}`);
        pgSql = pgSql.replace(/datetime\('now'\)/gi, 'NOW()');
        pgSql = pgSql.replace(/datetime\('now', '([^']+)'\)/gi, "NOW() + INTERVAL '$1'");
        const result = await db.query(pgSql, params);
        return result;
    } else {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    }
}

async function dbGet(sql, params = []) {
    if (isPostgres) {
        let pgSql = sql;
        let paramIndex = 0;
        pgSql = pgSql.replace(/\?/g, () => `$${++paramIndex}`);
        const result = await db.query(pgSql, params);
        return result.rows[0];
    } else {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }
}

async function dbAll(sql, params = []) {
    if (isPostgres) {
        let pgSql = sql;
        let paramIndex = 0;
        pgSql = pgSql.replace(/\?/g, () => `$${++paramIndex}`);
        const result = await db.query(pgSql, params);
        return result.rows;
    } else {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
}

// ============================================================
// TASK DATA - PMO-focused tasks
// ============================================================

const MY_WORK_TASKS = [
    // 🔴 BLOCKING PHASE tasks
    {
        title: 'Prepare Gate Review Documentation',
        description: 'Required documentation to pass the Design to Execution gate. Blocks initiative approval.',
        status: 'in_progress',
        priority: 'urgent',
        stepPhase: 'design',
        taskType: 'VALIDATION',
        dueDateOffset: -1, // Overdue
        labels: ['BLOCKING_PHASE', 'GATE_BLOCKER'],
        initiativeName: 'Smart Factory Initiative'
    },
    {
        title: 'Obtain Sponsor Approval for Phase 2 Budget',
        description: 'Sponsor must approve the budget before moving to the pilot phase. Critical for the schedule.',
        status: 'todo',
        priority: 'urgent',
        stepPhase: 'design',
        taskType: 'DECISION',
        dueDateOffset: 0, // Today
        labels: ['BLOCKING_PHASE', 'DECISION_REQUIRED'],
        initiativeName: 'Digital Transformation 2025'
    },
    {
        title: 'Finalize Resource Plan for Execution Phase',
        description: 'Team allocation and budget plan for the execution phase. Requires PMO acceptance.',
        status: 'blocked',
        priority: 'high',
        stepPhase: 'design',
        taskType: 'ANALYSIS',
        dueDateOffset: 1,
        labels: ['BLOCKING_PHASE'],
        blockedReason: 'Missing HR data on consultant availability'
    },

    // 🟠 BLOCKING INITIATIVE tasks
    {
        title: 'Resolve Vendor API Integration Issue',
        description: 'Third-party API is not responding according to specification. Blocking IoT initiative progress.',
        status: 'in_progress',
        priority: 'high',
        stepPhase: 'execution',
        taskType: 'BUILD',
        dueDateOffset: 2,
        labels: ['BLOCKING_INITIATIVE', 'BLOCKED'],
        initiativeName: 'IoT Platform Integration'
    },
    {
        title: 'Obtain Security Certificates for Production Environment',
        description: 'Production deployment requires SOC2 certificates. Blocks initiative go-live.',
        status: 'todo',
        priority: 'high',
        stepPhase: 'execution',
        taskType: 'VALIDATION',
        dueDateOffset: 5,
        labels: ['BLOCKING_INITIATIVE'],
        initiativeName: 'Cloud Migration Program'
    },
    {
        title: 'Fix Critical UAT Bugs',
        description: '3 critical bugs identified during acceptance testing. No acceptance without fixes.',
        status: 'in_progress',
        priority: 'urgent',
        stepPhase: 'pilot',
        taskType: 'BUILD',
        dueDateOffset: -2, // Overdue
        labels: ['BLOCKING_INITIATIVE'],
        initiativeName: 'E-Commerce Platform'
    },

    // 🟡 AWAITING DECISION tasks
    {
        title: 'Select CRM Platform Vendor',
        description: 'Decision needed between Salesforce and Microsoft Dynamics. Waiting for board.',
        status: 'todo',
        priority: 'high',
        stepPhase: 'design',
        taskType: 'DECISION',
        dueDateOffset: 3,
        labels: ['AWAITING_DECISION', 'DECISION_REQUIRED'],
        initiativeName: 'CRM Implementation'
    },
    {
        title: 'Approve Scope Change for Reporting Module',
        description: 'Client requests additional dashboards. Requires decision on scope and budget extension.',
        status: 'todo',
        priority: 'medium',
        stepPhase: 'execution',
        taskType: 'DECISION',
        dueDateOffset: 4,
        labels: ['AWAITING_DECISION'],
        initiativeName: 'BI Analytics Platform'
    },
    {
        title: 'Decide on Data Migration Strategy',
        description: 'Big Bang vs Phased migration - requires decision before sprint planning.',
        status: 'in_progress',
        priority: 'medium',
        stepPhase: 'design',
        taskType: 'ANALYSIS',
        dueDateOffset: 6,
        labels: ['AWAITING_DECISION'],
        initiativeName: 'Legacy System Migration'
    },

    // ⚫ OVERDUE tasks
    {
        title: 'Deliver Discovery Phase Report',
        description: 'Report summarizing discovery phase for AI initiative. Deadline passed 5 days ago.',
        status: 'in_progress',
        priority: 'high',
        stepPhase: 'design',
        taskType: 'ANALYSIS',
        dueDateOffset: -5,
        labels: ['OVERDUE'],
        initiativeName: 'AI Predictive Maintenance'
    },
    {
        title: 'Update Architecture Documentation',
        description: 'Documentation needs update after design changes. Delay impacts dev team.',
        status: 'todo',
        priority: 'medium',
        stepPhase: 'design',
        taskType: 'DESIGN',
        dueDateOffset: -3,
        labels: ['OVERDUE'],
        initiativeName: 'Microservices Architecture'
    },

    // ✅ REGULAR tasks (various statuses)
    {
        title: 'Prepare Presentation for Steering Committee',
        description: 'Initiative portfolio status presentation for quarterly meeting.',
        status: 'todo',
        priority: 'medium',
        stepPhase: 'execution',
        taskType: 'ANALYSIS',
        dueDateOffset: 7,
        labels: [],
        initiativeName: 'Portfolio Management'
    },
    {
        title: 'Conduct Workshop with Business Team',
        description: 'Requirements workshop for new order module.',
        status: 'todo',
        priority: 'medium',
        stepPhase: 'design',
        taskType: 'ANALYSIS',
        dueDateOffset: 10,
        labels: [],
        initiativeName: 'Order Management System'
    },
    {
        title: 'Code Review for Payment Module',
        description: 'Code review before merge to main branch. Standard procedure.',
        status: 'in_progress',
        priority: 'low',
        stepPhase: 'execution',
        taskType: 'BUILD',
        dueDateOffset: 2,
        labels: [],
        initiativeName: 'Payment Gateway Integration'
    },
    {
        title: 'Update Sprint Backlog',
        description: 'Review and update priorities in backlog for next sprint.',
        status: 'completed',
        priority: 'low',
        stepPhase: 'execution',
        taskType: 'ANALYSIS',
        dueDateOffset: -1,
        labels: [],
        initiativeName: 'Agile Transformation'
    },
    {
        title: 'Write Unit Tests for User Service',
        description: 'Unit test coverage for UserService. Target: 80%.',
        status: 'in_progress',
        priority: 'medium',
        stepPhase: 'execution',
        taskType: 'BUILD',
        dueDateOffset: 4,
        labels: [],
        initiativeName: 'Quality Improvement Program'
    },
    {
        title: 'Staging Environment Configuration',
        description: 'Prepare staging environment before deployment.',
        status: 'completed',
        priority: 'medium',
        stepPhase: 'pilot',
        taskType: 'BUILD',
        dueDateOffset: -2,
        labels: [],
        initiativeName: 'DevOps Excellence'
    },
    {
        title: 'Analyze A/B Test Results',
        description: 'Analyze A/B test results for new checkout UI.',
        status: 'todo',
        priority: 'low',
        stepPhase: 'pilot',
        taskType: 'VALIDATION',
        dueDateOffset: 8,
        labels: [],
        initiativeName: 'UX Optimization'
    },
    {
        title: 'End-user Training',
        description: 'Prepare and conduct training on the new system.',
        status: 'todo',
        priority: 'medium',
        stepPhase: 'execution',
        taskType: 'CHANGE_MGMT',
        dueDateOffset: 14,
        labels: [],
        initiativeName: 'Change Management Program'
    },
    {
        title: 'API Documentation for Partners',
        description: 'Prepare OpenAPI documentation for integration partners.',
        status: 'in_progress',
        priority: 'low',
        stepPhase: 'execution',
        taskType: 'DESIGN',
        dueDateOffset: 12,
        labels: [],
        initiativeName: 'Partner Integration Platform'
    }
];

// ============================================================
// NOTIFICATIONS DATA
// ============================================================

const MY_WORK_NOTIFICATIONS = [
    // CRITICAL
    {
        type: 'INITIATIVE_BLOCKED',
        severity: 'CRITICAL',
        title: 'Initiative Blocked',
        message: 'Smart Factory Initiative has been blocked due to resource shortage. Immediate intervention required.',
        relatedObjectType: 'INITIATIVE',
        actionUrl: '/initiatives/smart-factory',
        createdAtOffset: 0 // Just now
    },
    {
        type: 'TASK_OVERDUE',
        severity: 'CRITICAL',
        title: 'Task Overdue - Blocking Phase',
        message: 'Task "Prepare Gate Review Documentation" is overdue and blocking phase transition.',
        relatedObjectType: 'TASK',
        actionUrl: '/my-work/tasks',
        createdAtOffset: -30 // 30 min ago
    },
    {
        type: 'AI_RISK_DETECTED',
        severity: 'CRITICAL',
        title: 'AI Dedicated Project Risk',
        message: 'AI analysis indicates 85% probability of E-Commerce Platform project delay by 2 weeks.',
        relatedObjectType: 'PROJECT',
        actionUrl: '/projects/ecommerce',
        createdAtOffset: -60 // 1 hour ago
    },

    // WARNING
    {
        type: 'DECISION_REQUIRED',
        severity: 'WARNING',
        title: 'Decision Required',
        message: 'Decision on CRM vendor selection awaiting approval. Deadline: 3 days.',
        relatedObjectType: 'DECISION',
        actionUrl: '/decisions/crm-vendor',
        createdAtOffset: -120 // 2 hours ago
    },
    {
        type: 'GATE_APPROACHING',
        severity: 'WARNING',
        title: 'Gate Review Approaching',
        message: 'Gate Review for Digital Transformation 2025 in 5 days. 2 tasks unfinished.',
        relatedObjectType: 'PROJECT',
        actionUrl: '/projects/dt2025',
        createdAtOffset: -180 // 3 hours ago
    },
    {
        type: 'TASK_OVERDUE',
        severity: 'WARNING',
        title: 'Task Overdue',
        message: 'Task "Deliver Discovery Phase Report" is overdue by 5 days.',
        relatedObjectType: 'TASK',
        actionUrl: '/my-work/tasks',
        createdAtOffset: -360 // 6 hours ago
    },
    {
        type: 'BOTTLENECK_DETECTED',
        severity: 'WARNING',
        title: 'Bottleneck Detected',
        message: 'Bottleneck identified in approval process. 4 tasks waiting for acceptance.',
        relatedObjectType: 'WORKFLOW',
        actionUrl: '/my-work/inbox',
        createdAtOffset: -720 // 12 hours ago
    },

    // INFO
    {
        type: 'TASK_ASSIGNED',
        severity: 'INFO',
        title: 'New Task Assigned',
        message: 'You have been assigned to task "Prepare Presentation for Steering Committee".',
        relatedObjectType: 'TASK',
        actionUrl: '/my-work/tasks',
        createdAtOffset: -1440 // 1 day ago
    },
    {
        type: 'TASK_COMPLETED',
        severity: 'INFO',
        title: 'Task Completed',
        message: 'Task "Staging Environment Configuration" has been marked as completed.',
        relatedObjectType: 'TASK',
        actionUrl: '/my-work/tasks',
        createdAtOffset: -2880 // 2 days ago
    },
    {
        type: 'WEEKLY_DIGEST',
        severity: 'INFO',
        title: 'Weekly Digest',
        message: 'Completed 8 tasks, 3 initiatives advanced to next phase. Execution Score: 82/100.',
        relatedObjectType: 'DIGEST',
        actionUrl: '/my-work/dashboard',
        createdAtOffset: -4320 // 3 days ago
    }
];

// ============================================================
// DECISIONS DATA
// ============================================================

const MY_WORK_DECISIONS = [
    {
        title: 'Select CRM Platform Vendor',
        description: 'Strategic decision to choose between Salesforce and Microsoft Dynamics 365. Impacts budget and timeline of the whole program.',
        status: 'PENDING',
        dueDate: 3,
        relatedObjectType: 'INITIATIVE',
        projectName: 'CRM Implementation'
    },
    {
        title: 'Approve Project Scope Extension',
        description: 'Client requests additional BI dashboards. Scope extension will increase budget by 15% and extend timeline by 3 weeks.',
        status: 'PENDING',
        dueDate: 4,
        relatedObjectType: 'INITIATIVE',
        projectName: 'BI Analytics Platform'
    },
    {
        title: 'Data Migration Strategy',
        description: 'Big Bang vs Phased Migration for Legacy system. Big Bang = higher risk, lower cost. Phased = safer, more expensive.',
        status: 'PENDING',
        dueDate: 6,
        relatedObjectType: 'INITIATIVE',
        projectName: 'Legacy System Migration'
    },
    {
        title: 'Phase 2 Budget Approval',
        description: 'Budget 1.2M PLN for pilot phase. Requires CFO and Sponsor approval.',
        status: 'PENDING',
        dueDate: 0, // Today
        relatedObjectType: 'PROJECT',
        projectName: 'Digital Transformation 2025'
    },
    {
        title: 'Go/No-Go for Production Deployment',
        description: 'Decision to move from pilot to production. All technical criteria met, awaiting business approval.',
        status: 'PENDING',
        dueDate: 7,
        relatedObjectType: 'INITIATIVE',
        projectName: 'Cloud Migration Program'
    }
];

// ============================================================
// MAIN SEED FUNCTION
// ============================================================

async function seedMyWorkTestData() {
    console.log('🌱 Seeding My Work Test Data...\n');
    console.log(`   Database: ${isPostgres ? 'PostgreSQL' : 'SQLite'}\n`);

    try {
        // 1. Find user and organization
        const user = await dbGet(`SELECT id, organization_id FROM users WHERE email LIKE '%piotr%' LIMIT 1`);
        if (!user) {
            console.error('❌ User not found. Run seed_dbr77 first.');
            process.exit(1);
        }
        const userId = user.id;
        const organizationId = user.organization_id;
        console.log(`✅ Found user: ${userId}`);
        console.log(`✅ Organization: ${organizationId}`);

        // 2. Find or create project
        let project = await dbGet(`SELECT id FROM projects WHERE organization_id = ? LIMIT 1`, [organizationId]);
        if (!project) {
            const projectId = uuidv4();
            await dbRun(`INSERT INTO projects (id, organization_id, name, status, owner_id, created_at) 
                         VALUES (?, ?, 'My Work Test Project', 'active', ?, datetime('now'))`,
                [projectId, organizationId, userId]);
            project = { id: projectId };
            console.log(`✅ Created test project`);
        }

        // ============================================================
        // CLEAR EXISTING TEST DATA (optional - for clean re-runs)
        // ============================================================
        console.log('\n🧹 Clearing existing test data...');
        await dbRun(`DELETE FROM tasks WHERE title LIKE '%PMO Test%' OR title IN (${MY_WORK_TASKS.map(() => '?').join(',')})`,
            MY_WORK_TASKS.map(t => t.title));
        await dbRun(`DELETE FROM notifications WHERE title LIKE '%Test%' OR type IN ('INITIATIVE_BLOCKED', 'BOTTLENECK_DETECTED', 'WEEKLY_DIGEST')`);
        console.log('   ✅ Cleared existing data');

        // ============================================================
        // CREATE TASKS
        // ============================================================
        console.log('\n📋 Creating tasks...');

        let tasksCreated = 0;
        for (const taskDef of MY_WORK_TASKS) {
            const taskId = uuidv4();
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + taskDef.dueDateOffset);

            // Serialize labels as JSON
            const labelsJson = JSON.stringify(taskDef.labels.map(code => ({
                code,
                text: getLabelText(code),
                severity: getLabelSeverity(code)
            })));

            await dbRun(`INSERT INTO tasks 
                (id, project_id, organization_id, title, description, status, priority, 
                 step_phase, task_type, due_date, assignee_id, reporter_id, 
                 blocked_reason, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                [
                    taskId, project.id, organizationId,
                    taskDef.title, taskDef.description, taskDef.status, taskDef.priority,
                    taskDef.stepPhase, taskDef.taskType, dueDate.toISOString(),
                    userId, userId, taskDef.blockedReason || null
                ]);

            tasksCreated++;

            // Log with emoji based on labels
            let emoji = '✅';
            if (taskDef.labels.includes('BLOCKING_PHASE')) emoji = '🔴';
            else if (taskDef.labels.includes('BLOCKING_INITIATIVE')) emoji = '🟠';
            else if (taskDef.labels.includes('AWAITING_DECISION')) emoji = '🟡';
            else if (taskDef.labels.includes('OVERDUE') || taskDef.dueDateOffset < 0) emoji = '⚫';

            console.log(`   ${emoji} ${taskDef.title} (${taskDef.status}, ${taskDef.priority})`);
        }
        console.log(`\n   ✅ Created ${tasksCreated} tasks`);

        // ============================================================
        // CREATE NOTIFICATIONS
        // ============================================================
        console.log('\n🔔 Creating notifications...');

        let notificationsCreated = 0;
        for (const notifDef of MY_WORK_NOTIFICATIONS) {
            const notifId = uuidv4();
            const createdAt = new Date();
            createdAt.setMinutes(createdAt.getMinutes() + notifDef.createdAtOffset);

            // Map severity to priority for existing schema
            const priority = notifDef.severity === 'CRITICAL' ? 'high' :
                notifDef.severity === 'WARNING' ? 'normal' : 'low';

            // Generate a related object ID if needed
            const relatedObjectId = notifDef.relatedObjectType ? uuidv4() : null;

            await dbRun(`INSERT INTO notifications 
                (id, user_id, organization_id, project_id, type, severity, title, message, 
                 related_object_type, related_object_id, is_read, priority, is_actionable, action_url, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
                [
                    notifId, userId, organizationId, project.id, notifDef.type, notifDef.severity,
                    notifDef.title, notifDef.message,
                    notifDef.relatedObjectType || null, relatedObjectId,
                    priority, notifDef.actionUrl ? 1 : 0, notifDef.actionUrl || null,
                    createdAt.toISOString()
                ]);

            notificationsCreated++;

            let emoji = '🔵';
            if (notifDef.severity === 'CRITICAL') emoji = '🔴';
            else if (notifDef.severity === 'WARNING') emoji = '🟡';

            console.log(`   ${emoji} ${notifDef.title} (${notifDef.severity})`);
        }
        console.log(`\n   ✅ Created ${notificationsCreated} notifications`);

        // ============================================================
        // CREATE DECISIONS
        // ============================================================
        console.log('\n❓ Creating decisions...');

        let decisionsCreated = 0;
        try {
            // Check if decisions table exists
            await dbGet(`SELECT 1 FROM decisions LIMIT 1`);

            for (const decisionDef of MY_WORK_DECISIONS) {
                const decisionId = uuidv4();
                const relatedObjectId = uuidv4(); // Generate a fake related object ID

                await dbRun(`INSERT INTO decisions 
                    (id, project_id, decision_type, related_object_type, related_object_id,
                     decision_owner_id, status, required, title, description, 
                     pmo_domain_id, created_at)
                    VALUES (?, ?, 'INITIATIVE_APPROVAL', ?, ?, ?, ?, 1, ?, ?, 
                            'GOVERNANCE_DECISION_MAKING', datetime('now'))`,
                    [
                        decisionId, project.id, decisionDef.relatedObjectType, relatedObjectId,
                        userId, decisionDef.status, decisionDef.title, decisionDef.description
                    ]);

                decisionsCreated++;
                console.log(`   🟡 ${decisionDef.title} (${decisionDef.status})`);
            }
            console.log(`\n   ✅ Created ${decisionsCreated} decisions`);
        } catch (e) {
            console.log('   ⚠️ decisions table not available, skipping:', e.message);
        }

        // ============================================================
        // CREATE FOCUS TASKS WITH TIME BLOCKS
        // ============================================================
        console.log('\n🎯 Creating focus tasks...');

        let focusTasksCreated = 0;
        try {
            // First, try to create focus_tasks table if it doesn't exist
            await dbRun(`CREATE TABLE IF NOT EXISTS focus_tasks (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                task_id TEXT NOT NULL,
                order_index INTEGER NOT NULL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
            )`);

            await dbRun(`CREATE TABLE IF NOT EXISTS focus_time_blocks (
                id TEXT PRIMARY KEY,
                focus_task_id TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (focus_task_id) REFERENCES focus_tasks(id) ON DELETE CASCADE
            )`);

            console.log('   ✅ Focus tables ready');

            // Clear existing focus data
            await dbRun(`DELETE FROM focus_time_blocks`);
            await dbRun(`DELETE FROM focus_tasks WHERE user_id = ?`, [userId]);

            // Get first 3 urgent/high priority tasks for focus
            const focusCandidates = await dbAll(`
                SELECT id, title FROM tasks 
                WHERE assignee_id = ? AND status != 'completed' 
                ORDER BY 
                    CASE priority 
                        WHEN 'urgent' THEN 1 
                        WHEN 'high' THEN 2 
                        ELSE 3 
                    END,
                    due_date ASC
                LIMIT 3
            `, [userId]);

            const timeBlocks = [
                { start: '09:00', end: '10:30' },
                { start: '11:00', end: '12:30' },
                { start: '14:00', end: '16:00' }
            ];

            for (let i = 0; i < focusCandidates.length; i++) {
                const task = focusCandidates[i];
                const focusTaskId = uuidv4();

                await dbRun(`INSERT INTO focus_tasks (id, user_id, task_id, order_index, created_at)
                    VALUES (?, ?, ?, ?, datetime('now'))`,
                    [focusTaskId, userId, task.id, i]);

                // Add time block
                const block = timeBlocks[i];
                const timeBlockId = uuidv4();
                await dbRun(`INSERT INTO focus_time_blocks (id, focus_task_id, start_time, end_time, created_at)
                    VALUES (?, ?, ?, ?, datetime('now'))`,
                    [timeBlockId, focusTaskId, block.start, block.end]);

                focusTasksCreated++;
                console.log(`   🎯 ${task.title} (${block.start}-${block.end})`);
            }
            console.log(`\n   ✅ Created ${focusTasksCreated} focus tasks with time blocks`);
        } catch (e) {
            console.log('   ⚠️ Could not create focus tasks:', e.message);
        }

        // ============================================================
        // UPDATE NOTIFICATION SETTINGS
        // ============================================================
        console.log('\n⚙️ Setting up notification preferences...');

        try {
            // Create table if not exists
            await dbRun(`CREATE TABLE IF NOT EXISTS user_notification_settings (
                user_id TEXT PRIMARY KEY,
                mute_info INTEGER DEFAULT 0,
                mute_warning INTEGER DEFAULT 0,
                mute_critical INTEGER DEFAULT 0,
                muted_types TEXT DEFAULT '[]',
                digest_enabled INTEGER DEFAULT 1,
                digest_frequency TEXT DEFAULT 'daily',
                digest_time TEXT DEFAULT '08:00',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`);

            // Check if settings exist for user
            const existingSettings = await dbGet(`SELECT * FROM user_notification_settings WHERE user_id = ?`, [userId]);

            if (!existingSettings) {
                await dbRun(`INSERT INTO user_notification_settings 
                    (user_id, mute_info, mute_warning, mute_critical, muted_types, 
                     digest_enabled, digest_frequency, digest_time)
                    VALUES (?, 0, 0, 0, '[]', 1, 'daily', '08:00')`,
                    [userId]);
                console.log('   ✅ Created notification preferences');
            } else {
                console.log('   ✅ Notification preferences already exist');
            }
        } catch (e) {
            console.log('   ⚠️ Could not setup notification settings:', e.message);
        }

        // ============================================================
        // SUMMARY
        // ============================================================
        console.log('\n' + '='.repeat(60));
        console.log('✅ My Work Test Data seeding complete!');
        console.log('='.repeat(60));
        console.log('\n📋 Summary:');
        console.log(`   Tasks: ${tasksCreated}`);
        console.log(`   - 🔴 Blocking Phase: ${MY_WORK_TASKS.filter(t => t.labels.includes('BLOCKING_PHASE')).length}`);
        console.log(`   - 🟠 Blocking Initiative: ${MY_WORK_TASKS.filter(t => t.labels.includes('BLOCKING_INITIATIVE')).length}`);
        console.log(`   - 🟡 Awaiting Decision: ${MY_WORK_TASKS.filter(t => t.labels.includes('AWAITING_DECISION')).length}`);
        console.log(`   - ⚫ Overdue: ${MY_WORK_TASKS.filter(t => t.dueDateOffset < 0).length}`);
        console.log(`   Notifications: ${notificationsCreated}`);
        console.log(`   - 🔴 Critical: ${MY_WORK_NOTIFICATIONS.filter(n => n.severity === 'CRITICAL').length}`);
        console.log(`   - 🟡 Warning: ${MY_WORK_NOTIFICATIONS.filter(n => n.severity === 'WARNING').length}`);
        console.log(`   - 🔵 Info: ${MY_WORK_NOTIFICATIONS.filter(n => n.severity === 'INFO').length}`);
        console.log(`   Decisions: ${decisionsCreated}`);
        console.log(`   Focus Tasks: ${focusTasksCreated}`);
        console.log('\n🌐 You can now test My Work module at: /my-work');

    } catch (error) {
        console.error('\n❌ Error seeding:', error);
        throw error;
    } finally {
        if (isPostgres) {
            await db.end();
        }
    }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getLabelText(code) {
    const labels = {
        'BLOCKING_PHASE': 'Blocking Phase',
        'BLOCKING_INITIATIVE': 'Blocking Initiative',
        'GATE_BLOCKER': 'Gate Blocker',
        'AWAITING_DECISION': 'Awaiting Decision',
        'DECISION_REQUIRED': 'Decision Required',
        'OVERDUE': 'Overdue',
        'BLOCKED': 'Blocked',
        'UNASSIGNED': 'Unassigned'
    };
    return labels[code] || code;
}

function getLabelSeverity(code) {
    const critical = ['BLOCKING_PHASE', 'GATE_BLOCKER', 'BLOCKED', 'OVERDUE'];
    const warning = ['BLOCKING_INITIATIVE', 'AWAITING_DECISION', 'DECISION_REQUIRED'];

    if (critical.includes(code)) return 'critical';
    if (warning.includes(code)) return 'warning';
    return 'info';
}

function getNotificationCategory(type) {
    const categories = {
        'TASK_ASSIGNED': 'task',
        'TASK_COMPLETED': 'task',
        'TASK_OVERDUE': 'task',
        'DECISION_REQUIRED': 'decision',
        'INITIATIVE_BLOCKED': 'initiative',
        'AI_RISK_DETECTED': 'ai',
        'GATE_APPROACHING': 'gate',
        'BOTTLENECK_DETECTED': 'system',
        'WEEKLY_DIGEST': 'digest'
    };
    return categories[type] || 'system';
}

// ============================================================
// RUN
// ============================================================

if (require.main === module) {
    seedMyWorkTestData()
        .then(() => {
            console.log('\n🎉 Done!');
            process.exit(0);
        })
        .catch((err) => {
            console.error('Fatal error:', err);
            process.exit(1);
        });
}

module.exports = seedMyWorkTestData;

