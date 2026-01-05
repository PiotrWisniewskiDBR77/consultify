/**
 * Seed Full Workflow Data
 * 
 * Uzupełnia wszystkie moduły systemu:
 * - Roadmaps z waves
 * - Initiative Dependencies
 * - Stage Gates
 * - Decisions
 * - Tasks dla inicjatyw
 * - Focus tasks
 * - Notifications
 * 
 * Usage:
 *   node server/seed/seed_full_workflow.js
 */

import { v4 as uuidv4 } from 'uuid';

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
// MAIN SEED FUNCTION
// ============================================================

async function seedFullWorkflow() {
    console.log('\n========================================');
    console.log('🚀 Seeding Full Workflow Data');
    console.log('========================================\n');

    try {
        // 1. Get DBR77 organization and project
        console.log('📁 Finding DBR77 organization...');
        const orgs = await dbAll(`SELECT id, name FROM organizations WHERE name LIKE '%DBR77%' LIMIT 1`);
        if (!orgs || orgs.length === 0) {
            throw new Error('DBR77 organization not found. Run seed_dbr77_complete.js first.');
        }
        const orgId = orgs[0].id;
        console.log(`   ✓ Found: ${orgs[0].name}`);

        // Get users
        const users = await dbAll(`SELECT id, first_name, last_name, email FROM users WHERE organization_id = ?`, [orgId]);
        console.log(`   ✓ Found ${users.length} users`);
        
        // Get Piotr as main user
        const piotr = users.find(u => u.email.includes('piotr')) || users[0];
        
        // Get projects
        const projects = await dbAll(`SELECT id, name FROM projects WHERE organization_id = ?`, [orgId]);
        console.log(`   ✓ Found ${projects.length} projects`);
        
        if (projects.length === 0) {
            throw new Error('No projects found for DBR77');
        }

        // Get initiatives
        let initiatives = await dbAll(`SELECT id, name, project_id, status, axis FROM initiatives WHERE organization_id = ?`, [orgId]);
        console.log(`   ✓ Found ${initiatives.length} initiatives`);

        // If no initiatives, create some
        if (initiatives.length === 0) {
            console.log('\n🎯 Creating initiatives...');
            const projectId = projects[0].id;
            const initiativeData = [
                { name: 'Digital Process Automation', axis: 'processes', status: 'APPROVED', priority: 'HIGH' },
                { name: 'Data Lake Implementation', axis: 'dataManagement', status: 'IN_PROGRESS', priority: 'HIGH' },
                { name: 'AI Predictive Analytics', axis: 'aiMaturity', status: 'APPROVED', priority: 'HIGH' },
                { name: 'Cloud Migration Phase 1', axis: 'processes', status: 'IN_PROGRESS', priority: 'MEDIUM' },
                { name: 'Customer 360 Platform', axis: 'digitalProducts', status: 'APPROVED', priority: 'HIGH' },
                { name: 'Cybersecurity Enhancement', axis: 'cybersecurity', status: 'DRAFT', priority: 'HIGH' },
                { name: 'Change Management Program', axis: 'culture', status: 'APPROVED', priority: 'MEDIUM' },
                { name: 'API Gateway Implementation', axis: 'processes', status: 'IN_PROGRESS', priority: 'MEDIUM' },
                { name: 'Machine Learning Operations', axis: 'aiMaturity', status: 'DRAFT', priority: 'HIGH' },
                { name: 'Digital Twin Pilot', axis: 'digitalProducts', status: 'DRAFT', priority: 'MEDIUM' },
            ];
            
            for (const init of initiativeData) {
                const id = uuidv4();
                await dbRun(`
                    INSERT OR REPLACE INTO initiatives (id, project_id, organization_id, name, axis, status, priority, owner_business_id, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                `, [id, projectId, orgId, init.name, init.axis, init.status, init.priority, piotr.id]);
            }
            
            initiatives = await dbAll(`SELECT id, name, project_id, status, axis FROM initiatives WHERE organization_id = ?`, [orgId]);
            console.log(`   ✓ Created ${initiatives.length} initiatives`);
        }

        // 2. Create Roadmaps
        console.log('\n🗺️ Creating Roadmaps...');
        const projectId = projects[0].id;
        
        const roadmapId = uuidv4();
        await dbRun(`
            INSERT OR REPLACE INTO roadmaps (id, project_id, name, status, planned_start_date, planned_end_date, created_at)
            VALUES (?, ?, 'Digital Transformation Roadmap 2025', 'ACTIVE', datetime('now'), datetime('now', '+18 months'), datetime('now'))
        `, [roadmapId, projectId]);
        console.log('   ✓ Created main roadmap');

        // 3. Create Roadmap Waves
        console.log('\n🌊 Creating Roadmap Waves...');
        const waves = [
            { name: 'Wave 1: Foundation', description: 'Infrastructure and core capabilities', months: 0, duration: 3, status: 'ACTIVE' },
            { name: 'Wave 2: Core Systems', description: 'Core digital systems implementation', months: 3, duration: 4, status: 'PLANNED' },
            { name: 'Wave 3: Integration', description: 'System integration and automation', months: 7, duration: 4, status: 'PLANNED' },
            { name: 'Wave 4: AI & Analytics', description: 'Advanced AI and analytics capabilities', months: 11, duration: 4, status: 'PLANNED' },
            { name: 'Wave 5: Optimization', description: 'Performance optimization and scaling', months: 15, duration: 3, status: 'PLANNED' },
        ];
        
        const waveIds = [];
        for (let i = 0; i < waves.length; i++) {
            const wave = waves[i];
            const waveId = uuidv4();
            waveIds.push(waveId);
            await dbRun(`
                INSERT OR REPLACE INTO roadmap_waves (id, project_id, name, description, start_date, end_date, sort_order, status)
                VALUES (?, ?, ?, ?, datetime('now', '+${wave.months} months'), datetime('now', '+${wave.months + wave.duration} months'), ?, ?)
            `, [waveId, projectId, wave.name, wave.description, i, wave.status]);
            console.log(`   ✓ ${wave.name}`);
        }

        // 4. Link Initiatives to Roadmap
        console.log('\n🔗 Linking Initiatives to Roadmap...');
        const approvedInitiatives = initiatives.filter(i => i.status === 'APPROVED' || i.status === 'IN_PROGRESS');
        
        for (let i = 0; i < approvedInitiatives.length; i++) {
            const init = approvedInitiatives[i];
            const monthOffset = i * 2; // Stagger by 2 months
            const duration = 3 + Math.floor(Math.random() * 4); // 3-6 months
            
            await dbRun(`
                INSERT OR REPLACE INTO roadmap_initiatives (id, roadmap_id, initiative_id, planned_start_date, planned_end_date, planned_duration, sequence_position, is_critical_path)
                VALUES (?, ?, ?, datetime('now', '+${monthOffset} months'), datetime('now', '+${monthOffset + duration} months'), ?, ?, ?)
            `, [uuidv4(), roadmapId, init.id, duration * 30, i, i < 3 ? 1 : 0]);
        }
        console.log(`   ✓ Linked ${approvedInitiatives.length} initiatives to roadmap`);

        // 5. Create Initiative Dependencies
        console.log('\n🔀 Creating Initiative Dependencies...');
        // Create logical dependencies
        if (approvedInitiatives.length >= 4) {
            // Foundation → Core Systems
            await dbRun(`
                INSERT OR REPLACE INTO initiative_dependencies (id, from_initiative_id, to_initiative_id, type, is_satisfied)
                VALUES (?, ?, ?, 'FINISH_TO_START', 0)
            `, [uuidv4(), approvedInitiatives[0].id, approvedInitiatives[1].id]);
            
            // Core Systems → Integration
            await dbRun(`
                INSERT OR REPLACE INTO initiative_dependencies (id, from_initiative_id, to_initiative_id, type, is_satisfied)
                VALUES (?, ?, ?, 'FINISH_TO_START', 0)
            `, [uuidv4(), approvedInitiatives[1].id, approvedInitiatives[2].id]);
            
            // Soft dependency
            if (approvedInitiatives.length >= 5) {
                await dbRun(`
                    INSERT OR REPLACE INTO initiative_dependencies (id, from_initiative_id, to_initiative_id, type, is_satisfied)
                    VALUES (?, ?, ?, 'SOFT', 0)
                `, [uuidv4(), approvedInitiatives[2].id, approvedInitiatives[4].id]);
            }
            console.log('   ✓ Created 3 dependencies');
        }

        // 6. Create Stage Gates
        console.log('\n🚪 Creating Stage Gates...');
        const gateTypes = [
            { type: 'READINESS_GATE', from: 'CONTEXT', to: 'ASSESSMENT', status: 'PASSED' },
            { type: 'DESIGN_GATE', from: 'ASSESSMENT', to: 'ROADMAP', status: 'PASSED' },
            { type: 'APPROVAL_GATE', from: 'ROADMAP', to: 'PILOT', status: 'READY' },
            { type: 'PILOT_GATE', from: 'PILOT', to: 'ROLLOUT', status: 'NOT_READY' },
            { type: 'CLOSURE_GATE', from: 'ROLLOUT', to: 'CLOSURE', status: 'NOT_READY' },
        ];
        
        for (const gate of gateTypes) {
            const gateId = uuidv4();
            const completionCriteria = JSON.stringify([
                { id: uuidv4(), name: 'Documentation Complete', completed: gate.status === 'PASSED' },
                { id: uuidv4(), name: 'Stakeholder Approval', completed: gate.status === 'PASSED' },
                { id: uuidv4(), name: 'Risk Assessment Done', completed: gate.status !== 'NOT_READY' },
            ]);
            
            await dbRun(`
                INSERT OR REPLACE INTO stage_gates (id, project_id, gate_type, from_phase, to_phase, status, completion_criteria, evaluated_by, evaluated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${gate.status === 'PASSED' ? "datetime('now', '-7 days')" : 'NULL'})
            `, [gateId, projectId, gate.type, gate.from, gate.to, gate.status, completionCriteria, gate.status !== 'NOT_READY' ? piotr.id : null]);
            console.log(`   ✓ ${gate.type}: ${gate.status}`);
        }

        // 7. Create Decisions
        console.log('\n📋 Creating Decisions...');
        const decisionTypes = [
            { type: 'INITIATIVE_APPROVAL', title: 'Approve Digital Process Automation', status: 'APPROVED', objType: 'INITIATIVE' },
            { type: 'INITIATIVE_APPROVAL', title: 'Approve Data Lake Implementation', status: 'APPROVED', objType: 'INITIATIVE' },
            { type: 'PHASE_TRANSITION', title: 'Move to Roadmap Phase', status: 'APPROVED', objType: 'PHASE' },
            { type: 'UNBLOCK', title: 'Resource Allocation for AI Team', status: 'PENDING', objType: 'INITIATIVE' },
            { type: 'INITIATIVE_APPROVAL', title: 'Approve Cloud Migration Phase 2', status: 'PENDING', objType: 'INITIATIVE' },
            { type: 'OTHER', title: 'Budget Reallocation Q2', status: 'PENDING', objType: 'ROADMAP' },
        ];
        
        for (let i = 0; i < decisionTypes.length; i++) {
            const dec = decisionTypes[i];
            const relatedId = dec.objType === 'INITIATIVE' && approvedInitiatives[i] ? approvedInitiatives[i].id : projectId;
            
            await dbRun(`
                INSERT OR REPLACE INTO decisions (id, project_id, decision_type, related_object_type, related_object_id, decision_owner_id, status, title, description, created_at, decided_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-${10 - i} days'), ${dec.status === 'APPROVED' ? "datetime('now', '-${5 - i} days')" : 'NULL'})
            `, [uuidv4(), projectId, dec.type, dec.objType, relatedId, piotr.id, dec.status, dec.title, `Decision for: ${dec.title}`]);
        }
        console.log(`   ✓ Created ${decisionTypes.length} decisions`);

        // 8. Create Tasks for Initiatives
        console.log('\n✅ Creating Tasks for Initiatives...');
        const taskTemplates = [
            { title: 'Define requirements', status: 'DONE', priority: 'HIGH' },
            { title: 'Create technical design', status: 'DONE', priority: 'HIGH' },
            { title: 'Develop MVP', status: 'IN_PROGRESS', priority: 'HIGH' },
            { title: 'User acceptance testing', status: 'TODO', priority: 'MEDIUM' },
            { title: 'Documentation', status: 'TODO', priority: 'LOW' },
            { title: 'Training materials', status: 'TODO', priority: 'MEDIUM' },
            { title: 'Go-live preparation', status: 'TODO', priority: 'HIGH' },
        ];
        
        let taskCount = 0;
        for (const init of approvedInitiatives.slice(0, 5)) { // First 5 initiatives
            for (const template of taskTemplates) {
                const taskId = uuidv4();
                const assignee = users[Math.floor(Math.random() * users.length)];
                const dueOffset = taskCount % 30;
                
                await dbRun(`
                    INSERT OR REPLACE INTO tasks (id, project_id, organization_id, initiative_id, title, description, status, priority, assignee_id, reporter_id, due_date, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+${dueOffset} days'), datetime('now', '-${30 - dueOffset} days'))
                `, [taskId, projectId, orgId, init.id, `${init.name}: ${template.title}`, `Task for ${init.name}`, template.status, template.priority, assignee.id, piotr.id]);
                taskCount++;
            }
        }
        console.log(`   ✓ Created ${taskCount} tasks`);

        // 9. Create Focus Tasks
        console.log('\n🎯 Creating Focus Tasks...');
        const inProgressTasks = await dbAll(`SELECT id FROM tasks WHERE organization_id = ? AND status = 'IN_PROGRESS' LIMIT 5`, [orgId]);
        
        for (let i = 0; i < Math.min(3, inProgressTasks.length); i++) {
            await dbRun(`
                INSERT OR REPLACE INTO focus_tasks (id, user_id, task_id, order_index, created_at, updated_at)
                VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
            `, [uuidv4(), piotr.id, inProgressTasks[i].id, i + 1]);
        }
        console.log(`   ✓ Created ${Math.min(3, inProgressTasks.length)} focus tasks`);

        // 10. Create additional Notifications
        console.log('\n🔔 Creating Notifications...');
        const notificationTemplates = [
            { type: 'decision_required', title: 'Decision Required', message: 'Your approval is needed for Cloud Migration Phase 2' },
            { type: 'gate_ready', title: 'Stage Gate Ready', message: 'APPROVAL_GATE is ready for review' },
            { type: 'initiative_blocked', title: 'Initiative Blocked', message: 'AI Predictive Analytics is waiting for dependencies' },
            { type: 'task_overdue', title: 'Task Overdue', message: 'Documentation task is 2 days overdue' },
            { type: 'milestone_approaching', title: 'Milestone Approaching', message: 'Wave 1 completion in 5 days' },
        ];
        
        for (const notif of notificationTemplates) {
            await dbRun(`
                INSERT OR REPLACE INTO notifications (id, user_id, organization_id, type, title, message, is_read, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now', '-${Math.floor(Math.random() * 48)} hours'))
            `, [uuidv4(), piotr.id, orgId, notif.type, notif.title, notif.message]);
        }
        console.log(`   ✓ Created ${notificationTemplates.length} notifications`);

        // 11. Create Activity Logs
        console.log('\n📝 Creating Activity Logs...');
        const activities = [
            { action: 'created', entity: 'roadmap', name: 'Digital Transformation Roadmap 2025' },
            { action: 'approved', entity: 'decision', name: 'Digital Process Automation Approval' },
            { action: 'passed', entity: 'stage_gate', name: 'DESIGN_GATE' },
            { action: 'started', entity: 'initiative', name: 'Data Lake Implementation' },
            { action: 'completed', entity: 'task', name: 'Define requirements' },
            { action: 'assigned', entity: 'task', name: 'Develop MVP' },
            { action: 'commented', entity: 'initiative', name: 'Cloud Migration Phase 1' },
            { action: 'updated', entity: 'roadmap', name: 'Added Wave 3 initiatives' },
        ];
        
        for (const activity of activities) {
            const user = users[Math.floor(Math.random() * users.length)];
            await dbRun(`
                INSERT OR REPLACE INTO activity_logs (id, user_id, organization_id, action, entity_type, entity_id, entity_name, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-${Math.floor(Math.random() * 168)} hours'))
            `, [uuidv4(), user.id, orgId, activity.action, activity.entity, uuidv4(), activity.name]);
        }
        console.log(`   ✓ Created ${activities.length} activity logs`);

        // 12. Update user capacity
        console.log('\n👥 Updating User Capacity...');
        for (const user of users) {
            const allocatedHours = 20 + Math.floor(Math.random() * 20);
            const availableHours = 40;
            const utilization = Math.round((allocatedHours / availableHours) * 100);
            await dbRun(`
                INSERT OR REPLACE INTO user_capacity (id, user_id, project_id, week_start, allocated_hours, available_hours, utilization_percent, is_overloaded)
                VALUES (?, ?, ?, datetime('now', 'weekday 0', '-7 days'), ?, ?, ?, ?)
            `, [uuidv4(), user.id, projectId, allocatedHours, availableHours, utilization, utilization > 100 ? 1 : 0]);
        }
        console.log(`   ✓ Updated capacity for ${users.length} users`);

        // Summary
        console.log('\n========================================');
        console.log('✅ Full Workflow Seeding Complete!');
        console.log('========================================');
        console.log('\n📋 Summary:');
        console.log(`   • Roadmaps: 1`);
        console.log(`   • Waves: ${waves.length}`);
        console.log(`   • Initiatives linked: ${approvedInitiatives.length}`);
        console.log(`   • Dependencies: 3`);
        console.log(`   • Stage Gates: ${gateTypes.length}`);
        console.log(`   • Decisions: ${decisionTypes.length}`);
        console.log(`   • Tasks: ${taskCount}`);
        console.log(`   • Focus Tasks: ${Math.min(3, inProgressTasks.length)}`);
        console.log(`   • Notifications: ${notificationTemplates.length}`);
        console.log(`   • Activity Logs: ${activities.length}`);
        console.log('========================================\n');

        return { success: true };

    } catch (error) {
        console.error('\n❌ Error:', error);
        throw error;
    }
}

// ============================================================
// RUN
// ============================================================

if (require.main === module) {
    seedFullWorkflow()
        .then(() => {
            console.log('Done!');
            process.exit(0);
        })
        .catch((err) => {
            console.error('Failed:', err);
            process.exit(1);
        });
}

export default seedFullWorkflow;

