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
            db.run(sql, params, function(err) {
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
        title: 'Przygotuj dokumentację Gate Review',
        description: 'Niezbędna dokumentacja do przejścia bramki fazy Design do Execution. Blokuje zatwierdzenie inicjatywy.',
        status: 'in_progress',
        priority: 'urgent',
        stepPhase: 'design',
        taskType: 'VALIDATION',
        dueDateOffset: -1, // Overdue
        labels: ['BLOCKING_PHASE', 'GATE_BLOCKER'],
        initiativeName: 'Smart Factory Initiative'
    },
    {
        title: 'Uzyskaj akceptację Sponsora dla budżetu Fazy 2',
        description: 'Sponsor musi zatwierdzić budżet przed przejściem do fazy pilotażowej. Krytyczne dla harmonogramu.',
        status: 'todo',
        priority: 'urgent',
        stepPhase: 'design',
        taskType: 'DECISION',
        dueDateOffset: 0, // Today
        labels: ['BLOCKING_PHASE', 'DECISION_REQUIRED'],
        initiativeName: 'Digital Transformation 2025'
    },
    {
        title: 'Finalizacja planu zasobów dla Fazy Execution',
        description: 'Plan alokacji zespołu i budżetu na fazę wykonania. Wymaga akceptacji PMO.',
        status: 'blocked',
        priority: 'high',
        stepPhase: 'design',
        taskType: 'ANALYSIS',
        dueDateOffset: 1,
        labels: ['BLOCKING_PHASE'],
        blockedReason: 'Brak danych z HR o dostępności konsultantów'
    },
    
    // 🟠 BLOCKING INITIATIVE tasks
    {
        title: 'Rozwiąż problem integracji API dostawcy',
        description: 'API trzeciego dostawcy nie odpowiada zgodnie ze specyfikacją. Blokuje postęp inicjatywy IoT.',
        status: 'in_progress',
        priority: 'high',
        stepPhase: 'execution',
        taskType: 'BUILD',
        dueDateOffset: 2,
        labels: ['BLOCKING_INITIATIVE', 'BLOCKED'],
        initiativeName: 'IoT Platform Integration'
    },
    {
        title: 'Uzyskaj certyfikaty bezpieczeństwa dla środowiska produkcyjnego',
        description: 'Wdrożenie na produkcję wymaga certyfikatów SOC2. Blokuje go-live inicjatywy.',
        status: 'todo',
        priority: 'high',
        stepPhase: 'execution',
        taskType: 'VALIDATION',
        dueDateOffset: 5,
        labels: ['BLOCKING_INITIATIVE'],
        initiativeName: 'Cloud Migration Program'
    },
    {
        title: 'Napraw błędy krytyczne z UAT',
        description: '3 błędy krytyczne zidentyfikowane podczas testów akceptacyjnych. Bez naprawy nie ma akceptacji.',
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
        title: 'Wybór dostawcy platformy CRM',
        description: 'Należy podjąć decyzję między Salesforce a Microsoft Dynamics. Czeka na zarząd.',
        status: 'todo',
        priority: 'high',
        stepPhase: 'design',
        taskType: 'DECISION',
        dueDateOffset: 3,
        labels: ['AWAITING_DECISION', 'DECISION_REQUIRED'],
        initiativeName: 'CRM Implementation'
    },
    {
        title: 'Zatwierdź scope change dla modułu raportowania',
        description: 'Klient żąda dodatkowych dashboardów. Wymaga decyzji o rozszerzeniu scope i budżetu.',
        status: 'todo',
        priority: 'medium',
        stepPhase: 'execution',
        taskType: 'DECISION',
        dueDateOffset: 4,
        labels: ['AWAITING_DECISION'],
        initiativeName: 'BI Analytics Platform'
    },
    {
        title: 'Decyzja o strategii migracji danych',
        description: 'Big Bang vs Phased migration - wymaga decyzji przed planowaniem sprintu.',
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
        title: 'Dostarczyć raport z fazy Discovery',
        description: 'Raport podsumowujący fazę discovery dla inicjatywy AI. Termin minął 5 dni temu.',
        status: 'in_progress',
        priority: 'high',
        stepPhase: 'design',
        taskType: 'ANALYSIS',
        dueDateOffset: -5,
        labels: ['OVERDUE'],
        initiativeName: 'AI Predictive Maintenance'
    },
    {
        title: 'Zaktualizować dokumentację architektury',
        description: 'Dokumentacja wymaga aktualizacji po zmianach w designie. Opóźnienie wpływa na zespół dev.',
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
        title: 'Przygotuj prezentację dla Steering Committee',
        description: 'Prezentacja statusu portfela inicjatyw na spotkanie kwartalne.',
        status: 'todo',
        priority: 'medium',
        stepPhase: 'execution',
        taskType: 'ANALYSIS',
        dueDateOffset: 7,
        labels: [],
        initiativeName: 'Portfolio Management'
    },
    {
        title: 'Przeprowadź workshop z zespołem biznesowym',
        description: 'Warsztaty wymagań dla nowego modułu zamówień.',
        status: 'todo',
        priority: 'medium',
        stepPhase: 'design',
        taskType: 'ANALYSIS',
        dueDateOffset: 10,
        labels: [],
        initiativeName: 'Order Management System'
    },
    {
        title: 'Review kodu dla modułu płatności',
        description: 'Code review przed merge do main branch. Standardowa procedura.',
        status: 'in_progress',
        priority: 'low',
        stepPhase: 'execution',
        taskType: 'BUILD',
        dueDateOffset: 2,
        labels: [],
        initiativeName: 'Payment Gateway Integration'
    },
    {
        title: 'Zaktualizuj backlog sprintu',
        description: 'Przejrzeć i zaktualizować priorytety w backlogu na następny sprint.',
        status: 'completed',
        priority: 'low',
        stepPhase: 'execution',
        taskType: 'ANALYSIS',
        dueDateOffset: -1,
        labels: [],
        initiativeName: 'Agile Transformation'
    },
    {
        title: 'Napisz testy jednostkowe dla serwisu użytkowników',
        description: 'Pokrycie testami jednostkowymi dla UserService. Target: 80%.',
        status: 'in_progress',
        priority: 'medium',
        stepPhase: 'execution',
        taskType: 'BUILD',
        dueDateOffset: 4,
        labels: [],
        initiativeName: 'Quality Improvement Program'
    },
    {
        title: 'Konfiguracja środowiska staging',
        description: 'Przygotowanie środowiska staging przed deploymentem.',
        status: 'completed',
        priority: 'medium',
        stepPhase: 'pilot',
        taskType: 'BUILD',
        dueDateOffset: -2,
        labels: [],
        initiativeName: 'DevOps Excellence'
    },
    {
        title: 'Analiza wyników A/B testu',
        description: 'Przeanalizować wyniki testu A/B dla nowego UI checkout.',
        status: 'todo',
        priority: 'low',
        stepPhase: 'pilot',
        taskType: 'VALIDATION',
        dueDateOffset: 8,
        labels: [],
        initiativeName: 'UX Optimization'
    },
    {
        title: 'Szkolenie dla end-userów',
        description: 'Przygotować i przeprowadzić szkolenie z nowego systemu.',
        status: 'todo',
        priority: 'medium',
        stepPhase: 'execution',
        taskType: 'CHANGE_MGMT',
        dueDateOffset: 14,
        labels: [],
        initiativeName: 'Change Management Program'
    },
    {
        title: 'Dokumentacja API dla partnerów',
        description: 'Przygotować dokumentację OpenAPI dla partnerów integracyjnych.',
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
        title: 'Inicjatywa zablokowana',
        message: 'Smart Factory Initiative została zablokowana z powodu braku zasobów. Wymagana natychmiastowa interwencja.',
        relatedObjectType: 'INITIATIVE',
        actionUrl: '/initiatives/smart-factory',
        createdAtOffset: 0 // Just now
    },
    {
        type: 'TASK_OVERDUE',
        severity: 'CRITICAL',
        title: 'Zadanie przeterminowane - blokuje fazę',
        message: 'Zadanie "Przygotuj dokumentację Gate Review" przekroczyło termin i blokuje przejście fazy.',
        relatedObjectType: 'TASK',
        actionUrl: '/my-work/tasks',
        createdAtOffset: -30 // 30 min ago
    },
    {
        type: 'AI_RISK_DETECTED',
        severity: 'CRITICAL',
        title: 'AI wykryło ryzyko projektu',
        message: 'Analiza AI wskazuje na 85% prawdopodobieństwo opóźnienia projektu E-Commerce Platform o 2 tygodnie.',
        relatedObjectType: 'PROJECT',
        actionUrl: '/projects/ecommerce',
        createdAtOffset: -60 // 1 hour ago
    },
    
    // WARNING
    {
        type: 'DECISION_REQUIRED',
        severity: 'WARNING',
        title: 'Wymagana decyzja',
        message: 'Decyzja o wyborze dostawcy CRM czeka na zatwierdzenie. Termin: 3 dni.',
        relatedObjectType: 'DECISION',
        actionUrl: '/decisions/crm-vendor',
        createdAtOffset: -120 // 2 hours ago
    },
    {
        type: 'GATE_APPROACHING',
        severity: 'WARNING',
        title: 'Zbliża się Gate Review',
        message: 'Gate Review dla projektu Digital Transformation 2025 za 5 dni. 2 zadania niezakończone.',
        relatedObjectType: 'PROJECT',
        actionUrl: '/projects/dt2025',
        createdAtOffset: -180 // 3 hours ago
    },
    {
        type: 'TASK_OVERDUE',
        severity: 'WARNING',
        title: 'Zadanie przeterminowane',
        message: 'Zadanie "Dostarczyć raport z fazy Discovery" jest przeterminowane o 5 dni.',
        relatedObjectType: 'TASK',
        actionUrl: '/my-work/tasks',
        createdAtOffset: -360 // 6 hours ago
    },
    {
        type: 'BOTTLENECK_DETECTED',
        severity: 'WARNING',
        title: 'Wykryto wąskie gardło',
        message: 'Zidentyfikowano wąskie gardło w procesie zatwierdzania. 4 zadania czekają na akceptację.',
        relatedObjectType: 'WORKFLOW',
        actionUrl: '/my-work/inbox',
        createdAtOffset: -720 // 12 hours ago
    },
    
    // INFO
    {
        type: 'TASK_ASSIGNED',
        severity: 'INFO',
        title: 'Nowe zadanie przypisane',
        message: 'Zostałeś przypisany do zadania "Przygotuj prezentację dla Steering Committee".',
        relatedObjectType: 'TASK',
        actionUrl: '/my-work/tasks',
        createdAtOffset: -1440 // 1 day ago
    },
    {
        type: 'TASK_COMPLETED',
        severity: 'INFO',
        title: 'Zadanie zakończone',
        message: 'Zadanie "Konfiguracja środowiska staging" zostało oznaczone jako zakończone.',
        relatedObjectType: 'TASK',
        actionUrl: '/my-work/tasks',
        createdAtOffset: -2880 // 2 days ago
    },
    {
        type: 'WEEKLY_DIGEST',
        severity: 'INFO',
        title: 'Podsumowanie tygodnia',
        message: 'Ukończono 8 zadań, 3 inicjatywy awansowały do następnej fazy. Execution Score: 82/100.',
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
        title: 'Wybór dostawcy platformy CRM',
        description: 'Decyzja strategiczna dotycząca wyboru między Salesforce a Microsoft Dynamics 365. Wpływa na budżet i timeline całego programu.',
        status: 'PENDING',
        dueDate: 3,
        relatedObjectType: 'INITIATIVE',
        projectName: 'CRM Implementation'
    },
    {
        title: 'Zatwierdź rozszerzenie zakresu projektu',
        description: 'Klient żąda dodatkowych dashboardów BI. Rozszerzenie scope zwiększy budżet o 15% i wydłuży timeline o 3 tygodnie.',
        status: 'PENDING',
        dueDate: 4,
        relatedObjectType: 'INITIATIVE',
        projectName: 'BI Analytics Platform'
    },
    {
        title: 'Strategia migracji danych',
        description: 'Big Bang vs Phased Migration dla systemu Legacy. Big Bang = wyższe ryzyko, niższy koszt. Phased = bezpieczniej, drożej.',
        status: 'PENDING',
        dueDate: 6,
        relatedObjectType: 'INITIATIVE',
        projectName: 'Legacy System Migration'
    },
    {
        title: 'Zatwierdzenie budżetu Fazy 2',
        description: 'Budżet 1.2M PLN na fazę pilotażową. Wymaga akceptacji CFO i Sponsora.',
        status: 'PENDING',
        dueDate: 0, // Today
        relatedObjectType: 'PROJECT',
        projectName: 'Digital Transformation 2025'
    },
    {
        title: 'Go/No-Go dla produkcyjnego wdrożenia',
        description: 'Decyzja o przejściu z pilota na produkcję. Wszystkie kryteria techniczne spełnione, czekamy na biznes.',
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

            await dbRun(`INSERT INTO notifications 
                (id, user_id, organization_id, type, title, message, is_read, priority, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
                [
                    notifId, userId, organizationId, notifDef.type, notifDef.title, notifDef.message,
                    priority, createdAt.toISOString()
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
        'BLOCKING_PHASE': 'Blokuje Fazę',
        'BLOCKING_INITIATIVE': 'Blokuje Inicjatywę',
        'GATE_BLOCKER': 'Blokuje Bramkę',
        'AWAITING_DECISION': 'Oczekuje na Decyzję',
        'DECISION_REQUIRED': 'Wymaga Decyzji',
        'OVERDUE': 'Przeterminowane',
        'BLOCKED': 'Zablokowane',
        'UNASSIGNED': 'Nieprzypisane'
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

