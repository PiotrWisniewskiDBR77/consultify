/**
 * Seed Extended Demo Data
 * 
 * Rozszerza dane demo o:
 * - Roadmap dla TechVision Industries
 * - Więcej inicjatyw z różnymi statusami
 * - Decisions i Stage Gates
 * - Risk Register
 * - KPI Results
 * - Change Requests
 * 
 * Usage:
 *   node server/seed/seed_demo_extended.js
 */

import { v4 as uuidv4 } from 'uuid';

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
        pgSql = pgSql.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO');
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

// ============================================================
// MAIN SEED
// ============================================================

async function seedDemoExtended() {
    console.log('\n========================================');
    console.log('🚀 Seeding Extended Demo Data');
    console.log('========================================\n');

    try {
        // Find Demo organization
        console.log('📁 Finding Demo organization...');
        const orgs = await dbAll(`SELECT id, name FROM organizations WHERE name LIKE '%TechVision%' OR name LIKE '%Demo%' LIMIT 1`);
        if (!orgs || orgs.length === 0) {
            console.log('⚠️ Demo organization not found. Skipping demo seed.');
            return { success: false, reason: 'Demo org not found' };
        }
        const orgId = orgs[0].id;
        console.log(`   ✓ Found: ${orgs[0].name}`);

        // Get users
        const users = await dbAll(`SELECT id, first_name, last_name, email FROM users WHERE organization_id = ?`, [orgId]);
        console.log(`   ✓ Found ${users.length} users`);
        const demoUser = users.find(u => u.email.includes('demo')) || users[0];

        // Get projects
        let projects = await dbAll(`SELECT id, name FROM projects WHERE organization_id = ?`, [orgId]);
        
        // Create project if none exists
        if (!projects || projects.length === 0) {
            console.log('\n📊 Creating Demo Project...');
            const projectId = uuidv4();
            await dbRun(`
                INSERT OR REPLACE INTO projects (id, name, organization_id, status, owner_id, created_at)
                VALUES (?, 'Digital Transformation 2025', ?, 'active', ?, datetime('now'))
            `, [projectId, orgId, demoUser.id]);
            projects = [{ id: projectId, name: 'Digital Transformation 2025' }];
            console.log('   ✓ Created project');
        }
        
        const projectId = projects[0].id;

        // Get existing initiatives
        let initiatives = await dbAll(`SELECT id, name, status FROM initiatives WHERE organization_id = ?`, [orgId]);
        console.log(`   ✓ Found ${initiatives.length} initiatives`);

        // Create more initiatives if needed
        if (initiatives.length < 15) {
            console.log('\n🎯 Creating Additional Initiatives...');
            const additionalInitiatives = [
                { name: 'ERP System Modernization', status: 'IN_PROGRESS', priority: 'HIGH', axis: 'processes' },
                { name: 'Customer Analytics Platform', status: 'APPROVED', priority: 'HIGH', axis: 'dataManagement' },
                { name: 'Supply Chain Optimization', status: 'APPROVED', priority: 'MEDIUM', axis: 'processes' },
                { name: 'Employee Experience Portal', status: 'DRAFT', priority: 'MEDIUM', axis: 'culture' },
                { name: 'IoT Sensor Network', status: 'IN_PROGRESS', priority: 'HIGH', axis: 'digitalProducts' },
                { name: 'Zero Trust Security', status: 'APPROVED', priority: 'HIGH', axis: 'cybersecurity' },
                { name: 'ML Model Governance', status: 'DRAFT', priority: 'MEDIUM', axis: 'aiMaturity' },
                { name: 'API Marketplace', status: 'IN_PROGRESS', priority: 'MEDIUM', axis: 'digitalProducts' },
                { name: 'Data Quality Framework', status: 'APPROVED', priority: 'HIGH', axis: 'dataManagement' },
                { name: 'Digital Skills Academy', status: 'IN_PROGRESS', priority: 'MEDIUM', axis: 'culture' },
            ];

            for (const init of additionalInitiatives) {
                const id = uuidv4();
                await dbRun(`
                    INSERT OR REPLACE INTO initiatives (id, project_id, organization_id, name, axis, status, priority, owner_business_id, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-${Math.floor(Math.random() * 30)} days'))
                `, [id, projectId, orgId, init.name, init.axis, init.status, init.priority, demoUser.id]);
            }
            console.log(`   ✓ Created ${additionalInitiatives.length} additional initiatives`);

            initiatives = await dbAll(`SELECT id, name, status FROM initiatives WHERE organization_id = ?`, [orgId]);
        }

        // Create Roadmap
        console.log('\n🗺️ Creating Roadmap...');
        const roadmapId = uuidv4();
        await dbRun(`
            INSERT OR REPLACE INTO roadmaps (id, project_id, name, status, planned_start_date, planned_end_date, created_at)
            VALUES (?, ?, 'TechVision Digital Roadmap 2025-2027', 'ACTIVE', datetime('now'), datetime('now', '+24 months'), datetime('now'))
        `, [roadmapId, projectId]);
        console.log('   ✓ Created roadmap');

        // Create Waves
        console.log('\n🌊 Creating Roadmap Waves...');
        const waves = [
            { name: 'Foundation Sprint', desc: 'Core infrastructure and security', monthsStart: 0, duration: 4 },
            { name: 'Data & Analytics', desc: 'Data platform and analytics capabilities', monthsStart: 4, duration: 5 },
            { name: 'Digital Products', desc: 'Customer-facing digital products', monthsStart: 9, duration: 6 },
            { name: 'AI & Automation', desc: 'AI/ML deployment and automation', monthsStart: 15, duration: 5 },
            { name: 'Scale & Optimize', desc: 'Performance optimization and scaling', monthsStart: 20, duration: 4 },
        ];

        for (let i = 0; i < waves.length; i++) {
            const wave = waves[i];
            await dbRun(`
                INSERT OR REPLACE INTO roadmap_waves (id, project_id, name, description, start_date, end_date, sort_order, status)
                VALUES (?, ?, ?, ?, datetime('now', '+${wave.monthsStart} months'), datetime('now', '+${wave.monthsStart + wave.duration} months'), ?, ?)
            `, [uuidv4(), projectId, wave.name, wave.desc, i, i === 0 ? 'ACTIVE' : 'PLANNED']);
            console.log(`   ✓ ${wave.name}`);
        }

        // Link initiatives to roadmap
        console.log('\n🔗 Linking Initiatives to Roadmap...');
        const activeInitiatives = initiatives.filter(i => i.status !== 'CANCELLED');
        let linkedCount = 0;
        for (let i = 0; i < Math.min(activeInitiatives.length, 12); i++) {
            const init = activeInitiatives[i];
            const monthOffset = i * 2;
            const duration = 3 + Math.floor(Math.random() * 5);
            await dbRun(`
                INSERT OR REPLACE INTO roadmap_initiatives (id, roadmap_id, initiative_id, planned_start_date, planned_end_date, planned_duration, sequence_position, is_critical_path)
                VALUES (?, ?, ?, datetime('now', '+${monthOffset} months'), datetime('now', '+${monthOffset + duration} months'), ?, ?, ?)
            `, [uuidv4(), roadmapId, init.id, duration * 30, i, i < 4 ? 1 : 0]);
            linkedCount++;
        }
        console.log(`   ✓ Linked ${linkedCount} initiatives`);

        // Create Initiative Dependencies
        console.log('\n🔀 Creating Initiative Dependencies...');
        if (activeInitiatives.length >= 6) {
            const deps = [
                [0, 1], [1, 2], [2, 4], [3, 5], [4, 5]
            ];
            for (const [from, to] of deps) {
                if (activeInitiatives[from] && activeInitiatives[to]) {
                    await dbRun(`
                        INSERT OR REPLACE INTO initiative_dependencies (id, from_initiative_id, to_initiative_id, type, is_satisfied)
                        VALUES (?, ?, ?, 'FINISH_TO_START', 0)
                    `, [uuidv4(), activeInitiatives[from].id, activeInitiatives[to].id]);
                }
            }
            console.log('   ✓ Created 5 dependencies');
        }

        // Create Stage Gates
        console.log('\n🚪 Creating Stage Gates...');
        const gates = [
            { type: 'READINESS_GATE', from: 'CONTEXT', to: 'ASSESSMENT', status: 'PASSED' },
            { type: 'DESIGN_GATE', from: 'ASSESSMENT', to: 'ROADMAP', status: 'PASSED' },
            { type: 'APPROVAL_GATE', from: 'ROADMAP', to: 'PILOT', status: 'READY' },
            { type: 'PILOT_GATE', from: 'PILOT', to: 'ROLLOUT', status: 'NOT_READY' },
            { type: 'CLOSURE_GATE', from: 'ROLLOUT', to: 'CLOSURE', status: 'NOT_READY' },
        ];

        for (const gate of gates) {
            const criteria = JSON.stringify([
                { id: uuidv4(), name: 'Deliverables Complete', completed: gate.status === 'PASSED' },
                { id: uuidv4(), name: 'Quality Review Passed', completed: gate.status === 'PASSED' },
                { id: uuidv4(), name: 'Stakeholder Sign-off', completed: gate.status !== 'NOT_READY' },
            ]);
            await dbRun(`
                INSERT OR REPLACE INTO stage_gates (id, project_id, gate_type, from_phase, to_phase, status, completion_criteria, evaluated_by, evaluated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${gate.status === 'PASSED' ? "datetime('now', '-5 days')" : 'NULL'})
            `, [uuidv4(), projectId, gate.type, gate.from, gate.to, gate.status, criteria, gate.status !== 'NOT_READY' ? demoUser.id : null]);
            console.log(`   ✓ ${gate.type}: ${gate.status}`);
        }

        // Create Decisions
        console.log('\n📋 Creating Decisions...');
        const decisions = [
            { type: 'INITIATIVE_APPROVAL', title: 'Approve ERP Modernization Budget', status: 'APPROVED' },
            { type: 'INITIATIVE_APPROVAL', title: 'Approve IoT Network Expansion', status: 'APPROVED' },
            { type: 'PHASE_TRANSITION', title: 'Proceed to Pilot Phase', status: 'APPROVED' },
            { type: 'UNBLOCK', title: 'Additional Developer Resources', status: 'PENDING' },
            { type: 'INITIATIVE_APPROVAL', title: 'ML Governance Framework Approval', status: 'PENDING' },
            { type: 'OTHER', title: 'Q3 Budget Reallocation', status: 'PENDING' },
            { type: 'CANCEL', title: 'Legacy System Decommission', status: 'APPROVED' },
        ];

        for (let i = 0; i < decisions.length; i++) {
            const dec = decisions[i];
            const relatedId = activeInitiatives[i % activeInitiatives.length]?.id || projectId;
            await dbRun(`
                INSERT OR REPLACE INTO decisions (id, project_id, decision_type, related_object_type, related_object_id, decision_owner_id, status, title, description, created_at, decided_at)
                VALUES (?, ?, ?, 'INITIATIVE', ?, ?, ?, ?, ?, datetime('now', '-${15 - i} days'), ${dec.status === 'APPROVED' ? `datetime('now', '-${10 - i} days')` : 'NULL'})
            `, [uuidv4(), projectId, dec.type, relatedId, demoUser.id, dec.status, dec.title, `Decision details for: ${dec.title}`]);
        }
        console.log(`   ✓ Created ${decisions.length} decisions`);

        // Create Risk Register
        console.log('\n⚠️ Creating Risk Register...');
        const risks = [
            { title: 'Resource Availability', risk_type: 'capacity', severity: 'high', likelihood: 'medium', status: 'open' },
            { title: 'Technology Complexity', risk_type: 'delivery', severity: 'high', likelihood: 'low', status: 'mitigating' },
            { title: 'Vendor Lock-in', risk_type: 'dependency', severity: 'medium', likelihood: 'high', status: 'open' },
            { title: 'Data Migration Delays', risk_type: 'delivery', severity: 'high', likelihood: 'medium', status: 'escalated' },
            { title: 'Change Resistance', risk_type: 'change_fatigue', severity: 'medium', likelihood: 'high', status: 'open' },
            { title: 'Budget Overrun', risk_type: 'delivery', severity: 'critical', likelihood: 'low', status: 'resolved' },
        ];

        for (const risk of risks) {
            await dbRun(`
                INSERT OR REPLACE INTO risk_register (id, project_id, organization_id, risk_type, severity, likelihood, title, description, status, owner_id, detected_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-${Math.floor(Math.random() * 20)} days'))
            `, [uuidv4(), projectId, orgId, risk.risk_type, risk.severity, risk.likelihood, risk.title, `Risk description: ${risk.title}`, risk.status, demoUser.id]);
        }
        console.log(`   ✓ Created ${risks.length} risks`);

        // Create Change Requests
        console.log('\n📝 Creating Change Requests...');
        const changeRequests = [
            { title: 'Add mobile app support', type: 'SCOPE', status: 'APPROVED', risk: 'MEDIUM' },
            { title: 'Extend pilot duration', type: 'SCHEDULE', status: 'APPROVED', risk: 'LOW' },
            { title: 'Additional security features', type: 'SCOPE', status: 'SUBMITTED', risk: 'HIGH' },
            { title: 'Budget increase for AI tools', type: 'BUDGET', status: 'SUBMITTED', risk: 'MEDIUM' },
            { title: 'Change vendor for analytics', type: 'SCOPE', status: 'REJECTED', risk: 'HIGH' },
        ];

        for (const cr of changeRequests) {
            await dbRun(`
                INSERT OR REPLACE INTO change_requests (id, project_id, title, description, type, status, risk_assessment, created_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-${Math.floor(Math.random() * 15)} days'))
            `, [uuidv4(), projectId, cr.title, `Change request: ${cr.title}`, cr.type, cr.status, cr.risk, demoUser.id]);
        }
        console.log(`   ✓ Created ${changeRequests.length} change requests`);

        // Create Tasks
        console.log('\n✅ Creating Tasks...');
        const taskTemplates = [
            { title: 'Requirements Analysis', status: 'DONE' },
            { title: 'Technical Design', status: 'DONE' },
            { title: 'Development Sprint 1', status: 'DONE' },
            { title: 'Development Sprint 2', status: 'IN_PROGRESS' },
            { title: 'Integration Testing', status: 'TODO' },
            { title: 'User Acceptance Testing', status: 'TODO' },
            { title: 'Documentation', status: 'TODO' },
            { title: 'Training', status: 'TODO' },
            { title: 'Go-Live Preparation', status: 'TODO' },
        ];

        let taskCount = 0;
        for (const init of activeInitiatives.slice(0, 6)) {
            for (const template of taskTemplates) {
                const assignee = users[Math.floor(Math.random() * users.length)];
                await dbRun(`
                    INSERT OR REPLACE INTO tasks (id, project_id, organization_id, initiative_id, title, status, priority, assignee_id, reporter_id, due_date, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+${taskCount % 30} days'), datetime('now', '-${30 - (taskCount % 30)} days'))
                `, [uuidv4(), projectId, orgId, init.id, `${init.name}: ${template.title}`, template.status, 
                    template.status === 'IN_PROGRESS' ? 'HIGH' : 'MEDIUM', assignee.id, demoUser.id]);
                taskCount++;
            }
        }
        console.log(`   ✓ Created ${taskCount} tasks`);

        // Create Notifications
        console.log('\n🔔 Creating Notifications...');
        const notifications = [
            { type: 'decision_required', title: 'Decision Required', message: 'ML Governance Framework needs your approval' },
            { type: 'gate_ready', title: 'Gate Ready', message: 'Approval Gate is ready for review' },
            { type: 'task_assigned', title: 'New Task', message: 'You have been assigned to Development Sprint 2' },
            { type: 'risk_escalated', title: 'Risk Alert', message: 'Resource Availability risk has been escalated' },
            { type: 'milestone_achieved', title: 'Milestone', message: 'Design Gate has been passed!' },
            { type: 'change_request', title: 'Change Request', message: 'New change request for additional security features' },
        ];

        for (const notif of notifications) {
            await dbRun(`
                INSERT OR REPLACE INTO notifications (id, user_id, organization_id, type, title, message, is_read, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now', '-${Math.floor(Math.random() * 48)} hours'))
            `, [uuidv4(), demoUser.id, orgId, notif.type, notif.title, notif.message]);
        }
        console.log(`   ✓ Created ${notifications.length} notifications`);

        // Summary
        console.log('\n========================================');
        console.log('✅ Extended Demo Seeding Complete!');
        console.log('========================================');
        console.log('\n📋 Summary:');
        console.log(`   • Organization: ${orgs[0].name}`);
        console.log(`   • Project: ${projects[0].name}`);
        console.log(`   • Initiatives: ${activeInitiatives.length}`);
        console.log(`   • Roadmap Waves: 5`);
        console.log(`   • Stage Gates: 5`);
        console.log(`   • Decisions: ${decisions.length}`);
        console.log(`   • Risks: ${risks.length}`);
        console.log(`   • Change Requests: ${changeRequests.length}`);
        console.log(`   • Tasks: ${taskCount}`);
        console.log(`   • Notifications: ${notifications.length}`);
        console.log('========================================\n');

        return { success: true };

    } catch (error) {
        console.error('\n❌ Error:', error);
        throw error;
    }
}

if (require.main === module) {
    seedDemoExtended()
        .then(() => {
            console.log('Done!');
            process.exit(0);
        })
        .catch((err) => {
            console.error('Failed:', err);
            process.exit(1);
        });
}

export default seedDemoExtended;

