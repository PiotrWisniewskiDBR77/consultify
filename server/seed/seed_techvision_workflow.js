/**
 * Seed TechVision Industries Full Workflow
 * 
 * Dodaje kompletne dane workflow dla organizacji TechVision Industries:
 * - Roadmap z waves
 * - Dependencies
 * - Stage Gates
 * - Decisions
 * - Risk Register
 * - Change Requests
 * - Tasks
 * 
 * Usage:
 *   node server/seed/seed_techvision_workflow.js
 */

const { v4: uuidv4 } = require('uuid');

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

async function dbRun(sql, params = []) {
    if (isPostgres) {
        let pgSql = sql;
        let paramIndex = 0;
        pgSql = pgSql.replace(/\?/g, () => `$${++paramIndex}`);
        pgSql = pgSql.replace(/datetime\('now'\)/gi, 'NOW()');
        pgSql = pgSql.replace(/datetime\('now', '([^']+)'\)/gi, "NOW() + INTERVAL '$1'");
        pgSql = pgSql.replace(/INSERT\s+OR\s+REPLACE\s+INTO/gi, 'INSERT INTO');
        return await db.query(pgSql, params);
    } else {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes });
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

async function seedTechVisionWorkflow() {
    console.log('\n========================================');
    console.log('🚀 Seeding TechVision Industries Workflow');
    console.log('========================================\n');

    try {
        // Find TechVision organization with users
        console.log('📁 Finding TechVision Industries...');
        const orgs = await dbAll(`
            SELECT o.id, o.name, COUNT(u.id) as user_count 
            FROM organizations o 
            LEFT JOIN users u ON o.id = u.organization_id 
            WHERE o.name = 'TechVision Industries' 
            GROUP BY o.id 
            HAVING COUNT(u.id) > 0 
            ORDER BY user_count DESC 
            LIMIT 1
        `);
        
        if (!orgs || orgs.length === 0) {
            console.log('⚠️ TechVision Industries not found or has no users. Run seed_demo_complete.js first.');
            return { success: false };
        }
        
        const orgId = orgs[0].id;
        console.log(`   ✓ Found: ${orgs[0].name} (${orgs[0].user_count} users)`);

        // Get users
        const users = await dbAll(`SELECT id, first_name, last_name, email FROM users WHERE organization_id = ?`, [orgId]);
        const demoUser = users.find(u => u.email.includes('demo')) || users[0];
        console.log(`   ✓ Demo user: ${demoUser.email}`);

        // Get or create project
        let projects = await dbAll(`SELECT id, name FROM projects WHERE organization_id = ?`, [orgId]);
        let projectId;
        
        if (!projects || projects.length === 0) {
            console.log('\n📊 Creating TechVision Project...');
            projectId = uuidv4();
            await dbRun(`
                INSERT OR REPLACE INTO projects (id, name, organization_id, status, owner_id, created_at)
                VALUES (?, 'Industry 4.0 Transformation', ?, 'active', ?, datetime('now'))
            `, [projectId, orgId, demoUser.id]);
            console.log('   ✓ Created project');
        } else {
            projectId = projects[0].id;
            console.log(`   ✓ Using project: ${projects[0].name}`);
        }

        // Get initiatives
        let initiatives = await dbAll(`SELECT id, name, status FROM initiatives WHERE organization_id = ?`, [orgId]);
        console.log(`   ✓ Found ${initiatives.length} initiatives`);

        // Create initiatives if none exist
        if (initiatives.length === 0) {
            console.log('\n🎯 Creating Initiatives...');
            const initData = [
                { name: 'Smart Factory Implementation', status: 'IN_PROGRESS', axis: 'processes', priority: 'HIGH' },
                { name: 'Industrial IoT Platform', status: 'IN_PROGRESS', axis: 'digitalProducts', priority: 'HIGH' },
                { name: 'Predictive Maintenance AI', status: 'APPROVED', axis: 'aiMaturity', priority: 'HIGH' },
                { name: 'Digital Supply Chain', status: 'APPROVED', axis: 'processes', priority: 'MEDIUM' },
                { name: 'Real-time Analytics Dashboard', status: 'IN_PROGRESS', axis: 'dataManagement', priority: 'HIGH' },
                { name: 'Quality Vision System', status: 'DRAFT', axis: 'digitalProducts', priority: 'MEDIUM' },
                { name: 'Energy Management System', status: 'APPROVED', axis: 'processes', priority: 'MEDIUM' },
                { name: 'Digital Twin Factory', status: 'DRAFT', axis: 'digitalProducts', priority: 'HIGH' },
                { name: 'OT/IT Integration', status: 'IN_PROGRESS', axis: 'cybersecurity', priority: 'HIGH' },
                { name: 'Workforce Upskilling', status: 'APPROVED', axis: 'culture', priority: 'MEDIUM' },
                { name: 'Autonomous Logistics', status: 'DRAFT', axis: 'processes', priority: 'MEDIUM' },
                { name: 'Carbon Footprint Tracker', status: 'APPROVED', axis: 'dataManagement', priority: 'LOW' },
            ];

            for (const init of initData) {
                const id = uuidv4();
                await dbRun(`
                    INSERT OR REPLACE INTO initiatives (id, project_id, organization_id, name, axis, status, priority, owner_business_id, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-${Math.floor(Math.random() * 60)} days'))
                `, [id, projectId, orgId, init.name, init.axis, init.status, init.priority, demoUser.id]);
            }
            initiatives = await dbAll(`SELECT id, name, status FROM initiatives WHERE organization_id = ?`, [orgId]);
            console.log(`   ✓ Created ${initiatives.length} initiatives`);
        }

        // Create Roadmap
        console.log('\n🗺️ Creating Roadmap...');
        const roadmapId = uuidv4();
        await dbRun(`
            INSERT OR REPLACE INTO roadmaps (id, project_id, name, status, planned_start_date, planned_end_date, created_at)
            VALUES (?, ?, 'Industry 4.0 Transformation Roadmap', 'ACTIVE', datetime('now', '-1 month'), datetime('now', '+24 months'), datetime('now'))
        `, [roadmapId, projectId]);
        console.log('   ✓ Created roadmap');

        // Create Waves
        console.log('\n🌊 Creating Roadmap Waves...');
        const waves = [
            { name: 'Phase 1: Foundation', desc: 'Core infrastructure, IT/OT integration', start: -1, dur: 4, status: 'ACTIVE' },
            { name: 'Phase 2: Connect', desc: 'IoT sensors, data collection, connectivity', start: 3, dur: 5, status: 'PLANNED' },
            { name: 'Phase 3: Analyze', desc: 'Analytics, dashboards, insights', start: 8, dur: 5, status: 'PLANNED' },
            { name: 'Phase 4: Automate', desc: 'AI/ML, predictive systems, automation', start: 13, dur: 6, status: 'PLANNED' },
            { name: 'Phase 5: Optimize', desc: 'Digital twins, autonomous systems', start: 19, dur: 5, status: 'PLANNED' },
        ];

        for (let i = 0; i < waves.length; i++) {
            const wave = waves[i];
            await dbRun(`
                INSERT OR REPLACE INTO roadmap_waves (id, project_id, name, description, start_date, end_date, sort_order, status)
                VALUES (?, ?, ?, ?, datetime('now', '+${wave.start} months'), datetime('now', '+${wave.start + wave.dur} months'), ?, ?)
            `, [uuidv4(), projectId, wave.name, wave.desc, i, wave.status]);
            console.log(`   ✓ ${wave.name}`);
        }

        // Link initiatives to roadmap
        console.log('\n🔗 Linking Initiatives to Roadmap...');
        const activeInits = initiatives.filter(i => i.status !== 'CANCELLED');
        for (let i = 0; i < activeInits.length; i++) {
            const init = activeInits[i];
            const monthOffset = Math.floor(i / 2) * 2; // Every 2 months
            const duration = 3 + Math.floor(Math.random() * 6);
            await dbRun(`
                INSERT OR REPLACE INTO roadmap_initiatives (id, roadmap_id, initiative_id, planned_start_date, planned_end_date, planned_duration, sequence_position, is_critical_path)
                VALUES (?, ?, ?, datetime('now', '+${monthOffset} months'), datetime('now', '+${monthOffset + duration} months'), ?, ?, ?)
            `, [uuidv4(), roadmapId, init.id, duration * 30, i, i < 5 ? 1 : 0]);
        }
        console.log(`   ✓ Linked ${activeInits.length} initiatives`);

        // Create Dependencies
        console.log('\n🔀 Creating Initiative Dependencies...');
        if (activeInits.length >= 8) {
            const deps = [
                [0, 2], [1, 2], [2, 4], [3, 4], [4, 7], [5, 7], [8, 9]
            ];
            for (const [from, to] of deps) {
                if (activeInits[from] && activeInits[to]) {
                    await dbRun(`
                        INSERT OR REPLACE INTO initiative_dependencies (id, from_initiative_id, to_initiative_id, type, is_satisfied)
                        VALUES (?, ?, ?, 'FINISH_TO_START', ?)
                    `, [uuidv4(), activeInits[from].id, activeInits[to].id, from < 2 ? 1 : 0]);
                }
            }
            console.log('   ✓ Created 7 dependencies');
        }

        // Create Stage Gates
        console.log('\n🚪 Creating Stage Gates...');
        const gates = [
            { type: 'READINESS_GATE', from: 'CONTEXT', to: 'ASSESSMENT', status: 'PASSED' },
            { type: 'DESIGN_GATE', from: 'ASSESSMENT', to: 'ROADMAP', status: 'PASSED' },
            { type: 'APPROVAL_GATE', from: 'ROADMAP', to: 'PILOT', status: 'PASSED' },
            { type: 'PILOT_GATE', from: 'PILOT', to: 'ROLLOUT', status: 'READY' },
            { type: 'CLOSURE_GATE', from: 'ROLLOUT', to: 'CLOSURE', status: 'NOT_READY' },
        ];

        for (const gate of gates) {
            const criteria = JSON.stringify([
                { id: uuidv4(), name: 'Technical Review', completed: gate.status === 'PASSED' },
                { id: uuidv4(), name: 'Business Case Approved', completed: gate.status !== 'NOT_READY' },
                { id: uuidv4(), name: 'Resource Allocation', completed: gate.status === 'PASSED' },
                { id: uuidv4(), name: 'Risk Assessment', completed: gate.status !== 'NOT_READY' },
            ]);
            await dbRun(`
                INSERT OR REPLACE INTO stage_gates (id, project_id, gate_type, from_phase, to_phase, status, completion_criteria, evaluated_by, evaluated_at, approved_by, approved_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                uuidv4(), projectId, gate.type, gate.from, gate.to, gate.status, criteria,
                gate.status !== 'NOT_READY' ? demoUser.id : null,
                gate.status !== 'NOT_READY' ? new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000).toISOString() : null,
                gate.status === 'PASSED' ? demoUser.id : null,
                gate.status === 'PASSED' ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString() : null
            ]);
            console.log(`   ✓ ${gate.type}: ${gate.status}`);
        }

        // Create Decisions
        console.log('\n📋 Creating Decisions...');
        const decisions = [
            { type: 'INITIATIVE_APPROVAL', title: 'Approve Smart Factory Budget €2.5M', status: 'APPROVED' },
            { type: 'INITIATIVE_APPROVAL', title: 'Approve IoT Platform Vendor Selection', status: 'APPROVED' },
            { type: 'PHASE_TRANSITION', title: 'Transition to Pilot Phase', status: 'APPROVED' },
            { type: 'UNBLOCK', title: 'Expedite Hardware Procurement', status: 'APPROVED' },
            { type: 'INITIATIVE_APPROVAL', title: 'Approve Digital Twin Investment', status: 'PENDING' },
            { type: 'OTHER', title: 'Partner with University for AI Research', status: 'PENDING' },
            { type: 'CANCEL', title: 'Defer Autonomous Logistics to 2026', status: 'PENDING' },
            { type: 'UNBLOCK', title: 'Additional ML Engineering Resources', status: 'PENDING' },
        ];

        for (let i = 0; i < decisions.length; i++) {
            const dec = decisions[i];
            const relatedId = activeInits[i % activeInits.length]?.id || projectId;
            await dbRun(`
                INSERT OR REPLACE INTO decisions (id, project_id, decision_type, related_object_type, related_object_id, decision_owner_id, status, title, description, created_at, decided_at)
                VALUES (?, ?, ?, 'INITIATIVE', ?, ?, ?, ?, ?, datetime('now', '-${20 - i * 2} days'), ${dec.status === 'APPROVED' ? `datetime('now', '-${15 - i * 2} days')` : 'NULL'})
            `, [uuidv4(), projectId, dec.type, relatedId, demoUser.id, dec.status, dec.title, `Decision: ${dec.title}`]);
        }
        console.log(`   ✓ Created ${decisions.length} decisions`);

        // Create Risk Register
        console.log('\n⚠️ Creating Risk Register...');
        const risks = [
            { title: 'OT System Downtime Risk', type: 'delivery', severity: 'critical', likelihood: 'medium', status: 'mitigating' },
            { title: 'IoT Device Security Vulnerabilities', type: 'delivery', severity: 'high', likelihood: 'high', status: 'open' },
            { title: 'AI Model Accuracy Issues', type: 'delivery', severity: 'high', likelihood: 'medium', status: 'open' },
            { title: 'Skilled Workforce Shortage', type: 'capacity', severity: 'high', likelihood: 'high', status: 'mitigating' },
            { title: 'Legacy System Integration', type: 'dependency', severity: 'medium', likelihood: 'high', status: 'resolved' },
            { title: 'Vendor Delivery Delays', type: 'dependency', severity: 'medium', likelihood: 'medium', status: 'open' },
            { title: 'Change Fatigue in Operations', type: 'change_fatigue', severity: 'medium', likelihood: 'high', status: 'mitigating' },
            { title: 'Regulatory Compliance (NIS2)', type: 'delivery', severity: 'high', likelihood: 'low', status: 'open' },
        ];

        for (const risk of risks) {
            await dbRun(`
                INSERT OR REPLACE INTO risk_register (id, project_id, organization_id, risk_type, severity, likelihood, title, description, status, owner_id, detected_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-${Math.floor(Math.random() * 30)} days'))
            `, [uuidv4(), projectId, orgId, risk.type, risk.severity, risk.likelihood, risk.title, `Risk: ${risk.title}`, risk.status, demoUser.id]);
        }
        console.log(`   ✓ Created ${risks.length} risks`);

        // Create Change Requests
        console.log('\n📝 Creating Change Requests...');
        const changeRequests = [
            { title: 'Expand IoT sensor coverage to Warehouse B', type: 'SCOPE', status: 'APPROVED', risk: 'MEDIUM' },
            { title: 'Accelerate AI deployment by 2 months', type: 'SCHEDULE', status: 'APPROVED', risk: 'HIGH' },
            { title: 'Add real-time alerting to dashboard', type: 'SCOPE', status: 'SUBMITTED', risk: 'LOW' },
            { title: 'Increase cloud compute budget +€150K', type: 'BUDGET', status: 'SUBMITTED', risk: 'MEDIUM' },
            { title: 'Include carbon tracking in Digital Twin', type: 'SCOPE', status: 'DRAFT', risk: 'LOW' },
            { title: 'Postpone Quality Vision to Q2', type: 'SCHEDULE', status: 'REJECTED', risk: 'MEDIUM' },
        ];

        for (const cr of changeRequests) {
            await dbRun(`
                INSERT OR REPLACE INTO change_requests (id, project_id, title, description, type, status, risk_assessment, created_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-${Math.floor(Math.random() * 20)} days'))
            `, [uuidv4(), projectId, cr.title, `Change request: ${cr.title}`, cr.type, cr.status, cr.risk, demoUser.id]);
        }
        console.log(`   ✓ Created ${changeRequests.length} change requests`);

        // Create Tasks
        console.log('\n✅ Creating Tasks...');
        const taskTemplates = [
            { title: 'Kickoff Meeting', status: 'DONE', priority: 'HIGH' },
            { title: 'Requirements Workshop', status: 'DONE', priority: 'HIGH' },
            { title: 'Architecture Design', status: 'DONE', priority: 'HIGH' },
            { title: 'Vendor Evaluation', status: 'DONE', priority: 'MEDIUM' },
            { title: 'Proof of Concept', status: 'IN_PROGRESS', priority: 'HIGH' },
            { title: 'Integration Development', status: 'IN_PROGRESS', priority: 'HIGH' },
            { title: 'Security Audit', status: 'TODO', priority: 'HIGH' },
            { title: 'User Acceptance Testing', status: 'TODO', priority: 'MEDIUM' },
            { title: 'Training Sessions', status: 'TODO', priority: 'MEDIUM' },
            { title: 'Go-Live Support', status: 'TODO', priority: 'HIGH' },
        ];

        let taskCount = 0;
        for (const init of activeInits.slice(0, 8)) {
            for (const template of taskTemplates) {
                const assignee = users[Math.floor(Math.random() * users.length)];
                const dueOffset = (taskCount % 60) - 10;
                await dbRun(`
                    INSERT OR REPLACE INTO tasks (id, project_id, organization_id, initiative_id, title, status, priority, assignee_id, reporter_id, due_date, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+${dueOffset} days'), datetime('now', '-${60 - (taskCount % 60)} days'))
                `, [uuidv4(), projectId, orgId, init.id, `${init.name}: ${template.title}`, template.status, template.priority, assignee.id, demoUser.id]);
                taskCount++;
            }
        }
        console.log(`   ✓ Created ${taskCount} tasks`);

        // Create Focus Tasks
        console.log('\n🎯 Creating Focus Tasks...');
        const inProgressTasks = await dbAll(`SELECT id FROM tasks WHERE organization_id = ? AND status = 'IN_PROGRESS' LIMIT 5`, [orgId]);
        for (let i = 0; i < Math.min(4, inProgressTasks.length); i++) {
            await dbRun(`
                INSERT OR REPLACE INTO focus_tasks (id, user_id, task_id, order_index, created_at, updated_at)
                VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
            `, [uuidv4(), demoUser.id, inProgressTasks[i].id, i + 1]);
        }
        console.log(`   ✓ Created ${Math.min(4, inProgressTasks.length)} focus tasks`);

        // Create Notifications
        console.log('\n🔔 Creating Notifications...');
        const notifications = [
            { type: 'decision_required', title: 'Decision Required', message: 'Digital Twin Investment needs your approval' },
            { type: 'gate_ready', title: 'Pilot Gate Ready', message: 'Pilot Gate is ready for final review' },
            { type: 'risk_escalated', title: 'Risk Escalated', message: 'IoT Security Risk has been escalated to critical' },
            { type: 'task_overdue', title: 'Task Overdue', message: 'Security Audit for Smart Factory is overdue' },
            { type: 'initiative_blocked', title: 'Initiative Blocked', message: 'Digital Twin Factory waiting on dependencies' },
            { type: 'change_approved', title: 'Change Approved', message: 'IoT sensor expansion has been approved' },
            { type: 'milestone_achieved', title: 'Milestone', message: 'Approval Gate passed - Pilot can begin!' },
        ];

        for (const notif of notifications) {
            await dbRun(`
                INSERT OR REPLACE INTO notifications (id, user_id, organization_id, type, title, message, is_read, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-${Math.floor(Math.random() * 72)} hours'))
            `, [uuidv4(), demoUser.id, orgId, notif.type, notif.title, notif.message, Math.random() > 0.7 ? 1 : 0]);
        }
        console.log(`   ✓ Created ${notifications.length} notifications`);

        // Create Activity Logs
        console.log('\n📝 Creating Activity Logs...');
        const activities = [
            { action: 'created', entity: 'roadmap', name: 'Industry 4.0 Transformation Roadmap' },
            { action: 'approved', entity: 'decision', name: 'Smart Factory Budget' },
            { action: 'passed', entity: 'stage_gate', name: 'Approval Gate' },
            { action: 'started', entity: 'initiative', name: 'Smart Factory Implementation' },
            { action: 'completed', entity: 'task', name: 'Architecture Design' },
            { action: 'escalated', entity: 'risk', name: 'IoT Security Vulnerabilities' },
            { action: 'submitted', entity: 'change_request', name: 'Real-time alerting feature' },
            { action: 'assigned', entity: 'task', name: 'Proof of Concept' },
            { action: 'commented', entity: 'initiative', name: 'Predictive Maintenance AI' },
            { action: 'updated', entity: 'roadmap', name: 'Added Phase 4 initiatives' },
        ];

        for (const activity of activities) {
            const user = users[Math.floor(Math.random() * users.length)];
            await dbRun(`
                INSERT OR REPLACE INTO activity_logs (id, user_id, organization_id, action, entity_type, entity_id, entity_name, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-${Math.floor(Math.random() * 168)} hours'))
            `, [uuidv4(), user.id, orgId, activity.action, activity.entity, uuidv4(), activity.name]);
        }
        console.log(`   ✓ Created ${activities.length} activity logs`);

        // Summary
        console.log('\n========================================');
        console.log('✅ TechVision Workflow Seeding Complete!');
        console.log('========================================');
        console.log('\n📋 Summary:');
        console.log(`   • Organization: TechVision Industries`);
        console.log(`   • Users: ${users.length}`);
        console.log(`   • Project: Industry 4.0 Transformation`);
        console.log(`   • Initiatives: ${activeInits.length}`);
        console.log(`   • Roadmap Waves: 5`);
        console.log(`   • Dependencies: 7`);
        console.log(`   • Stage Gates: 5`);
        console.log(`   • Decisions: ${decisions.length}`);
        console.log(`   • Risks: ${risks.length}`);
        console.log(`   • Change Requests: ${changeRequests.length}`);
        console.log(`   • Tasks: ${taskCount}`);
        console.log(`   • Focus Tasks: ${Math.min(4, inProgressTasks.length)}`);
        console.log(`   • Notifications: ${notifications.length}`);
        console.log(`   • Activity Logs: ${activities.length}`);
        console.log('========================================\n');

        return { success: true };

    } catch (error) {
        console.error('\n❌ Error:', error);
        throw error;
    }
}

if (require.main === module) {
    seedTechVisionWorkflow()
        .then(() => {
            console.log('Done!');
            process.exit(0);
        })
        .catch((err) => {
            console.error('Failed:', err);
            process.exit(1);
        });
}

module.exports = seedTechVisionWorkflow;



