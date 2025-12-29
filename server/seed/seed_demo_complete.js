/**
 * Seed Complete Demo Data
 * 
 * Creates comprehensive demo data for a realistic demo experience:
 * - Demo organization with demo user (demo@consultify.io / demo123)
 * - 5 DRD assessments at different stages
 * - 15 initiatives with various statuses
 * - 25 tasks across multiple projects
 * - Notifications and activity logs
 * - Sample reports
 * 
 * Usage:
 *   node server/seed/seed_demo_complete.js
 */

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

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

async function dbGet(sql, params = []) {
    if (isPostgres) {
        let pgSql = sql.replace(/\?/g, () => `$${params.indexOf(params[0]) + 1}`);
        let paramIndex = 0;
        pgSql = sql.replace(/\?/g, () => `$${++paramIndex}`);
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

// ============================================================
// DEMO DATA CONFIGURATION
// ============================================================

const DEMO_ORG_ID = 'demo-org-' + Date.now().toString(36);
const DEMO_USER_ID = 'demo-user-' + Date.now().toString(36);
const DEMO_PROJECT_ID = 'demo-project-' + Date.now().toString(36);

const DEMO_ORG = {
    id: DEMO_ORG_ID,
    name: 'TechVision Industries',
    plan: 'enterprise',
    status: 'active',
    industry: 'Manufacturing & Technology'
};

const DEMO_USER = {
    id: DEMO_USER_ID,
    email: 'demo@consultify.io',
    password: 'demo123',
    firstName: 'Alex',
    lastName: 'Morgan',
    role: 'ADMIN',
    avatar: 'https://i.pravatar.cc/150?u=alex-morgan'
};

// Additional team members
const TEAM_MEMBERS = [
    { id: uuidv4(), firstName: 'Sarah', lastName: 'Chen', role: 'USER', email: 'sarah.chen@techvision.demo', avatar: 'https://i.pravatar.cc/150?u=sarah-chen' },
    { id: uuidv4(), firstName: 'Marcus', lastName: 'Johnson', role: 'USER', email: 'marcus.j@techvision.demo', avatar: 'https://i.pravatar.cc/150?u=marcus-j' },
    { id: uuidv4(), firstName: 'Elena', lastName: 'Rodriguez', role: 'USER', email: 'elena.r@techvision.demo', avatar: 'https://i.pravatar.cc/150?u=elena-r' },
    { id: uuidv4(), firstName: 'David', lastName: 'Kim', role: 'USER', email: 'david.kim@techvision.demo', avatar: 'https://i.pravatar.cc/150?u=david-kim' },
];

// ============================================================
// ASSESSMENT DATA - 5 DIFFERENT SCENARIOS
// ============================================================

const ASSESSMENT_SCENARIOS = [
    {
        name: 'Digital Factory 4.0',
        description: 'Complete Industry 4.0 transformation assessment',
        status: 'APPROVED',
        scores: {
            processes: { asIs: 4, toBe: 6 },
            digitalProducts: { asIs: 3, toBe: 5 },
            businessModels: { asIs: 3, toBe: 5 },
            dataManagement: { asIs: 4, toBe: 6 },
            culture: { asIs: 5, toBe: 6 },
            cybersecurity: { asIs: 5, toBe: 7 },
            aiMaturity: { asIs: 2, toBe: 5 }
        }
    },
    {
        name: 'Supply Chain Digitalization',
        description: 'End-to-end supply chain visibility project',
        status: 'IN_REVIEW',
        scores: {
            processes: { asIs: 3, toBe: 5 },
            digitalProducts: { asIs: 2, toBe: 4 },
            businessModels: { asIs: 2, toBe: 4 },
            dataManagement: { asIs: 3, toBe: 5 },
            culture: { asIs: 4, toBe: 5 },
            cybersecurity: { asIs: 4, toBe: 6 },
            aiMaturity: { asIs: 1, toBe: 4 }
        }
    },
    {
        name: 'Customer Experience Platform',
        description: 'Omnichannel customer engagement transformation',
        status: 'IN_REVIEW',
        scores: {
            processes: { asIs: 3, toBe: 6 },
            digitalProducts: { asIs: 4, toBe: 6 },
            businessModels: { asIs: 4, toBe: 6 },
            dataManagement: { asIs: 3, toBe: 6 },
            culture: { asIs: 4, toBe: 6 },
            cybersecurity: { asIs: 5, toBe: 6 },
            aiMaturity: { asIs: 3, toBe: 5 }
        }
    },
    {
        name: 'AI/ML Operations Center',
        description: 'Enterprise AI capabilities assessment',
        status: 'DRAFT',
        scores: {
            processes: { asIs: 2, toBe: 5 },
            digitalProducts: { asIs: 2, toBe: 5 },
            businessModels: { asIs: 2, toBe: 5 },
            dataManagement: { asIs: 2, toBe: 6 },
            culture: { asIs: 3, toBe: 5 },
            cybersecurity: { asIs: 4, toBe: 6 },
            aiMaturity: { asIs: 1, toBe: 6 }
        }
    },
    {
        name: 'Sustainability Digital Twin',
        description: 'Environmental monitoring and reporting',
        status: 'DRAFT',
        scores: {
            processes: { asIs: 3, toBe: 5 },
            digitalProducts: { asIs: 3, toBe: 5 },
            businessModels: { asIs: 3, toBe: 5 },
            dataManagement: { asIs: 4, toBe: 6 },
            culture: { asIs: 4, toBe: 5 },
            cybersecurity: { asIs: 5, toBe: 6 },
            aiMaturity: { asIs: 2, toBe: 4 }
        }
    }
];

// ============================================================
// INITIATIVES
// ============================================================

const INITIATIVES = [
    // From Digital Factory 4.0
    { name: 'Smart Production Line Integration', category: 'processes', priority: 'HIGH', status: 'IN_PROGRESS', effort: 'L', impact: 'HIGH', budget: 450000 },
    { name: 'Predictive Maintenance System', category: 'aiMaturity', priority: 'HIGH', status: 'APPROVED', effort: 'M', impact: 'HIGH', budget: 280000 },
    { name: 'Digital Twin Implementation', category: 'digitalProducts', priority: 'MEDIUM', status: 'IN_PROGRESS', effort: 'L', impact: 'HIGH', budget: 520000 },
    
    // From Supply Chain
    { name: 'Real-time Inventory Tracking', category: 'dataManagement', priority: 'HIGH', status: 'COMPLETED', effort: 'M', impact: 'HIGH', budget: 180000 },
    { name: 'Supplier Portal 2.0', category: 'processes', priority: 'MEDIUM', status: 'IN_PROGRESS', effort: 'M', impact: 'MEDIUM', budget: 120000 },
    { name: 'Demand Forecasting AI', category: 'aiMaturity', priority: 'HIGH', status: 'APPROVED', effort: 'L', impact: 'HIGH', budget: 350000 },
    
    // From Customer Experience
    { name: 'Customer 360 Platform', category: 'dataManagement', priority: 'HIGH', status: 'IN_PROGRESS', effort: 'L', impact: 'HIGH', budget: 380000 },
    { name: 'AI Chatbot Implementation', category: 'aiMaturity', priority: 'MEDIUM', status: 'COMPLETED', effort: 'S', impact: 'MEDIUM', budget: 85000 },
    { name: 'Mobile App Redesign', category: 'digitalProducts', priority: 'HIGH', status: 'IN_PROGRESS', effort: 'M', impact: 'HIGH', budget: 220000 },
    
    // From AI Operations
    { name: 'ML Platform Setup', category: 'aiMaturity', priority: 'HIGH', status: 'APPROVED', effort: 'L', impact: 'HIGH', budget: 480000 },
    { name: 'Data Lake Architecture', category: 'dataManagement', priority: 'HIGH', status: 'IN_PROGRESS', effort: 'L', impact: 'HIGH', budget: 320000 },
    { name: 'AI Ethics Framework', category: 'culture', priority: 'MEDIUM', status: 'DRAFT', effort: 'S', impact: 'MEDIUM', budget: 45000 },
    
    // From Sustainability
    { name: 'Carbon Footprint Dashboard', category: 'dataManagement', priority: 'MEDIUM', status: 'COMPLETED', effort: 'M', impact: 'MEDIUM', budget: 95000 },
    { name: 'ESG Reporting Automation', category: 'processes', priority: 'HIGH', status: 'IN_PROGRESS', effort: 'M', impact: 'HIGH', budget: 150000 },
    { name: 'Circular Economy Tracker', category: 'businessModels', priority: 'LOW', status: 'DRAFT', effort: 'M', impact: 'MEDIUM', budget: 110000 },
];

// ============================================================
// TASKS
// ============================================================

const TASK_TEMPLATES = [
    // In Progress
    { title: 'Configure ML pipeline for demand forecasting', status: 'IN_PROGRESS', priority: 'HIGH', dueOffset: 3 },
    { title: 'Review supplier integration API documentation', status: 'IN_PROGRESS', priority: 'MEDIUM', dueOffset: 2 },
    { title: 'Prepare stakeholder presentation for Q1 review', status: 'IN_PROGRESS', priority: 'HIGH', dueOffset: 1 },
    { title: 'Test new customer portal authentication flow', status: 'IN_PROGRESS', priority: 'HIGH', dueOffset: 4 },
    { title: 'Document data governance policies', status: 'IN_PROGRESS', priority: 'MEDIUM', dueOffset: 5 },
    
    // To Do
    { title: 'Schedule vendor demo for IoT sensors', status: 'TODO', priority: 'LOW', dueOffset: 7 },
    { title: 'Create training materials for new ERP module', status: 'TODO', priority: 'MEDIUM', dueOffset: 10 },
    { title: 'Analyze legacy system dependencies', status: 'TODO', priority: 'HIGH', dueOffset: 5 },
    { title: 'Set up monitoring dashboards for production', status: 'TODO', priority: 'MEDIUM', dueOffset: 8 },
    { title: 'Review security audit findings', status: 'TODO', priority: 'HIGH', dueOffset: 3 },
    
    // Done (recently)
    { title: 'Complete Phase 1 infrastructure setup', status: 'DONE', priority: 'HIGH', dueOffset: -2 },
    { title: 'Finalize vendor contract negotiations', status: 'DONE', priority: 'HIGH', dueOffset: -3 },
    { title: 'Deploy staging environment', status: 'DONE', priority: 'MEDIUM', dueOffset: -1 },
    { title: 'Conduct user acceptance testing', status: 'DONE', priority: 'HIGH', dueOffset: -4 },
    { title: 'Update project timeline documentation', status: 'DONE', priority: 'LOW', dueOffset: -5 },
    
    // Upcoming
    { title: 'Plan Phase 2 kickoff meeting', status: 'TODO', priority: 'HIGH', dueOffset: 14 },
    { title: 'Prepare budget proposal for board', status: 'TODO', priority: 'HIGH', dueOffset: 12 },
    { title: 'Research AI model optimization techniques', status: 'TODO', priority: 'MEDIUM', dueOffset: 15 },
    { title: 'Draft communication plan for go-live', status: 'TODO', priority: 'MEDIUM', dueOffset: 20 },
    { title: 'Coordinate with legal on data compliance', status: 'TODO', priority: 'HIGH', dueOffset: 7 },
    
    // More variety
    { title: 'Optimize database query performance', status: 'IN_PROGRESS', priority: 'MEDIUM', dueOffset: 6 },
    { title: 'Review code quality metrics', status: 'TODO', priority: 'LOW', dueOffset: 9 },
    { title: 'Prepare disaster recovery test plan', status: 'TODO', priority: 'HIGH', dueOffset: 11 },
    { title: 'Update API documentation', status: 'DONE', priority: 'MEDIUM', dueOffset: -6 },
    { title: 'Conduct team retrospective', status: 'DONE', priority: 'MEDIUM', dueOffset: -7 },
];

// ============================================================
// NOTIFICATIONS
// ============================================================

const NOTIFICATION_TEMPLATES = [
    { type: 'task_assigned', title: 'New Task Assigned', message: 'You have been assigned to "Configure ML pipeline for demand forecasting"', read: false },
    { type: 'assessment_approved', title: 'Assessment Approved', message: 'Digital Factory 4.0 assessment has been approved by stakeholders', read: false },
    { type: 'initiative_update', title: 'Initiative Status Changed', message: 'Predictive Maintenance System moved to Approved status', read: false },
    { type: 'deadline_reminder', title: 'Deadline Approaching', message: 'Task "Prepare stakeholder presentation" is due tomorrow', read: false },
    { type: 'comment_mention', title: 'You were mentioned', message: 'Sarah Chen mentioned you in a comment on the Data Lake project', read: true },
    { type: 'report_ready', title: 'Report Generated', message: 'Your DRD Executive Summary is ready for download', read: true },
    { type: 'team_update', title: 'New Team Member', message: 'David Kim has joined the Digital Factory 4.0 project', read: true },
    { type: 'milestone_completed', title: 'Milestone Completed', message: 'Phase 1 of Supply Chain Digitalization is complete', read: true },
];

// ============================================================
// MAIN SEED FUNCTION
// ============================================================

async function seedDemoData() {
    console.log('\n========================================');
    console.log('🚀 Starting Demo Data Seeding');
    console.log('========================================\n');

    try {
        // 1. Create Demo Organization
        console.log('📁 Creating Demo Organization...');
        await dbRun(`
            INSERT OR REPLACE INTO organizations (id, name, plan, status, industry, organization_type, is_active)
            VALUES (?, ?, ?, ?, ?, 'DEMO', 1)
        `, [DEMO_ORG.id, DEMO_ORG.name, DEMO_ORG.plan, DEMO_ORG.status, DEMO_ORG.industry]);
        console.log(`   ✓ Created organization: ${DEMO_ORG.name}`);

        // 2. Create Demo User
        console.log('\n👤 Creating Demo User...');
        const hashedPassword = bcrypt.hashSync(DEMO_USER.password, 8);
        await dbRun(`
            INSERT OR REPLACE INTO users (id, organization_id, email, password, first_name, last_name, role, avatar_url, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
        `, [DEMO_USER.id, DEMO_ORG.id, DEMO_USER.email, hashedPassword, DEMO_USER.firstName, DEMO_USER.lastName, DEMO_USER.role, DEMO_USER.avatar]);
        console.log(`   ✓ Created user: ${DEMO_USER.email} (password: ${DEMO_USER.password})`);

        // 3. Create Team Members
        console.log('\n👥 Creating Team Members...');
        for (const member of TEAM_MEMBERS) {
            const memberPassword = bcrypt.hashSync('team123', 8);
            await dbRun(`
                INSERT OR REPLACE INTO users (id, organization_id, email, password, first_name, last_name, role, avatar_url, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
            `, [member.id, DEMO_ORG.id, member.email, memberPassword, member.firstName, member.lastName, member.role, member.avatar]);
            console.log(`   ✓ Created: ${member.firstName} ${member.lastName}`);
        }

        // 4. Create Demo Project
        console.log('\n📊 Creating Demo Project...');
        await dbRun(`
            INSERT OR REPLACE INTO projects (id, name, organization_id, status, owner_id, created_at)
            VALUES (?, ?, ?, 'active', ?, datetime('now'))
        `, [DEMO_PROJECT_ID, 'Digital Transformation 2025', DEMO_ORG.id, DEMO_USER.id]);
        console.log(`   ✓ Created project: Digital Transformation 2025`);

        // 5. Create Assessment Workflows and Maturity Data
        console.log('\n📈 Creating Assessments...');
        
        // Ensure tables exist
        await dbRun(`
            CREATE TABLE IF NOT EXISTS assessment_workflows (
                id TEXT PRIMARY KEY,
                assessment_id TEXT NOT NULL,
                organization_id TEXT NOT NULL,
                project_id TEXT NOT NULL,
                assessment_type TEXT DEFAULT 'DRD',
                workflow_state TEXT DEFAULT 'DRAFT',
                assessment_name TEXT,
                created_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await dbRun(`
            CREATE TABLE IF NOT EXISTS maturity_assessments (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                axis_scores TEXT,
                completed_axes TEXT,
                overall_as_is REAL,
                overall_to_be REAL,
                overall_gap REAL,
                is_complete INTEGER DEFAULT 0,
                assessment_status TEXT DEFAULT 'IN_PROGRESS',
                finalized_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        for (let i = 0; i < ASSESSMENT_SCENARIOS.length; i++) {
            const scenario = ASSESSMENT_SCENARIOS[i];
            const assessmentId = uuidv4();
            const workflowId = uuidv4();
            const projectIdForAssessment = `demo-project-${i}-${Date.now().toString(36)}`;
            
            // Create a separate project for each assessment
            await dbRun(`
                INSERT OR REPLACE INTO projects (id, name, organization_id, status, owner_id, created_at)
                VALUES (?, ?, ?, 'active', ?, datetime('now', '-' || ? || ' days'))
            `, [projectIdForAssessment, scenario.name, DEMO_ORG.id, DEMO_USER.id, Math.floor(Math.random() * 60)]);
            
            // Calculate scores
            const axisScores = Object.entries(scenario.scores).map(([axis, scores]) => ({
                axis,
                asIs: scores.asIs,
                toBe: scores.toBe
            }));
            const overallAsIs = axisScores.reduce((sum, s) => sum + s.asIs, 0) / 7;
            const overallToBe = axisScores.reduce((sum, s) => sum + s.toBe, 0) / 7;
            
            await dbRun(`
                INSERT INTO assessment_workflows (id, assessment_id, organization_id, project_id, assessment_type, workflow_state, created_by, created_at)
                VALUES (?, ?, ?, ?, 'DRD', ?, ?, datetime('now', '-' || ? || ' days'))
            `, [workflowId, assessmentId, DEMO_ORG.id, projectIdForAssessment, scenario.status, DEMO_USER.id, Math.floor(Math.random() * 30)]);
            
            await dbRun(`
                INSERT OR REPLACE INTO maturity_assessments (id, project_id, axis_scores, completed_axes, overall_as_is, overall_to_be, overall_gap, is_complete, assessment_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
            `, [assessmentId, projectIdForAssessment, JSON.stringify(axisScores), JSON.stringify(Object.keys(scenario.scores)), overallAsIs.toFixed(2), overallToBe.toFixed(2), (overallToBe - overallAsIs).toFixed(2), scenario.status === 'APPROVED' ? 'FINALIZED' : 'IN_PROGRESS']);
            
            console.log(`   ✓ ${scenario.name} (${scenario.status})`);
        }

        // 6. Create Initiatives
        console.log('\n🎯 Creating Initiatives...');
        for (const initiative of INITIATIVES) {
            const id = uuidv4();
            const owner = [DEMO_USER, ...TEAM_MEMBERS][Math.floor(Math.random() * 5)];
            
            await dbRun(`
                INSERT OR REPLACE INTO initiatives (
                    id, project_id, organization_id, name, description, axis, priority, 
                    status, cost_capex, business_value, owner_business_id, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' days'))
            `, [
                id, DEMO_PROJECT_ID, DEMO_ORG.id, initiative.name,
                `Strategic initiative for ${initiative.name.toLowerCase()}`,
                initiative.category, initiative.priority, initiative.status,
                initiative.budget, initiative.impact, owner.id,
                Math.floor(Math.random() * 60)
            ]);
        }
        console.log(`   ✓ Created ${INITIATIVES.length} initiatives`);

        // 7. Create Tasks
        console.log('\n✅ Creating Tasks...');
        for (const task of TASK_TEMPLATES) {
            const id = uuidv4();
            const assignee = [DEMO_USER, ...TEAM_MEMBERS][Math.floor(Math.random() * 5)];
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + task.dueOffset);
            
            await dbRun(`
                INSERT OR REPLACE INTO tasks (
                    id, project_id, organization_id, title, description, status, priority,
                    assignee_id, due_date, reporter_id, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' days'), datetime('now'))
            `, [
                id, DEMO_PROJECT_ID, DEMO_ORG.id, task.title,
                `Task details for: ${task.title}`,
                task.status, task.priority, assignee.id,
                dueDate.toISOString().split('T')[0],
                DEMO_USER.id, Math.abs(task.dueOffset) + Math.floor(Math.random() * 10)
            ]);
        }
        console.log(`   ✓ Created ${TASK_TEMPLATES.length} tasks`);

        // 8. Create Notifications
        console.log('\n🔔 Creating Notifications...');
        for (const notif of NOTIFICATION_TEMPLATES) {
            const id = uuidv4();
            await dbRun(`
                INSERT OR REPLACE INTO notifications (
                    id, user_id, organization_id, type, title, message, is_read, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' hours'))
            `, [id, DEMO_USER.id, DEMO_ORG.id, notif.type, notif.title, notif.message, notif.read ? 1 : 0, Math.floor(Math.random() * 72)]);
        }
        console.log(`   ✓ Created ${NOTIFICATION_TEMPLATES.length} notifications`);

        // 9. Create Activity Logs
        console.log('\n📝 Creating Activity Logs...');
        const activities = [
            { action: 'created', entity: 'assessment', name: 'Digital Factory 4.0' },
            { action: 'updated', entity: 'initiative', name: 'Predictive Maintenance System' },
            { action: 'completed', entity: 'task', name: 'Phase 1 infrastructure setup' },
            { action: 'approved', entity: 'assessment', name: 'Digital Factory 4.0' },
            { action: 'assigned', entity: 'task', name: 'Configure ML pipeline' },
            { action: 'commented', entity: 'initiative', name: 'Data Lake Architecture' },
            { action: 'generated', entity: 'report', name: 'DRD Executive Summary' },
            { action: 'invited', entity: 'user', name: 'David Kim' },
        ];
        
        for (const activity of activities) {
            const id = uuidv4();
            const user = [DEMO_USER, ...TEAM_MEMBERS][Math.floor(Math.random() * 5)];
            await dbRun(`
                INSERT OR REPLACE INTO activity_logs (
                    id, user_id, organization_id, action, entity_type, entity_id, entity_name, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' hours'))
            `, [id, user.id, DEMO_ORG.id, activity.action, activity.entity, uuidv4(), activity.name, Math.floor(Math.random() * 168)]);
        }
        console.log(`   ✓ Created ${activities.length} activity logs`);

        // 10. Summary
        console.log('\n========================================');
        console.log('✅ Demo Data Seeding Complete!');
        console.log('========================================');
        console.log('\n📋 Summary:');
        console.log(`   • Organization: ${DEMO_ORG.name}`);
        console.log(`   • Demo User: ${DEMO_USER.email} / ${DEMO_USER.password}`);
        console.log(`   • Team Members: ${TEAM_MEMBERS.length}`);
        console.log(`   • Assessments: ${ASSESSMENT_SCENARIOS.length}`);
        console.log(`   • Initiatives: ${INITIATIVES.length}`);
        console.log(`   • Tasks: ${TASK_TEMPLATES.length}`);
        console.log(`   • Notifications: ${NOTIFICATION_TEMPLATES.length}`);
        console.log('\n🔐 Login Credentials:');
        console.log(`   Email: ${DEMO_USER.email}`);
        console.log(`   Password: ${DEMO_USER.password}`);
        console.log('========================================\n');

        return {
            success: true,
            orgId: DEMO_ORG.id,
            userId: DEMO_USER.id,
            credentials: {
                email: DEMO_USER.email,
                password: DEMO_USER.password
            }
        };

    } catch (error) {
        console.error('\n❌ Error during seeding:', error);
        throw error;
    }
}

// ============================================================
// RUN
// ============================================================

if (require.main === module) {
    seedDemoData()
        .then(() => {
            console.log('Done!');
            process.exit(0);
        })
        .catch((err) => {
            console.error('Failed:', err);
            process.exit(1);
        });
}

module.exports = seedDemoData;

