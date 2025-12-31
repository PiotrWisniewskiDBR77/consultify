/**
 * Seed My Work English Test Data
 * 
 * Creates comprehensive test data for the My Work module in English:
 * - 15 tasks with various due dates, priorities, and statuses
 * - 8 decisions with different types and priorities
 * 
 * Usage:
 *   node server/seed/seed_mywork_english.js
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
// SAMPLE DATA - ENGLISH ONLY
// ============================================================

// Tasks with different time categories
const SAMPLE_TASKS = [
    // OVERDUE (3 tasks)
    {
        title: 'Review Q4 budget proposal',
        description: 'Analyze the quarterly budget proposal and provide feedback to the finance team',
        status: 'in_progress',
        priority: 'urgent',
        dueDateOffset: -2, // 2 days ago
        initiativeName: 'Financial Planning 2025'
    },
    {
        title: 'Complete security audit documentation',
        description: 'Finalize the security compliance documentation for SOC2 certification',
        status: 'todo',
        priority: 'high',
        dueDateOffset: -1, // 1 day ago
        initiativeName: 'Security Compliance'
    },
    {
        title: 'Submit compliance report',
        description: 'Submit the quarterly compliance report to the regulatory body',
        status: 'todo',
        priority: 'high',
        dueDateOffset: -3, // 3 days ago
        initiativeName: null
    },
    
    // TODAY (2 tasks)
    {
        title: 'Prepare board meeting presentation',
        description: 'Create presentation slides for the upcoming board meeting',
        status: 'in_progress',
        priority: 'high',
        dueDateOffset: 0, // Today
        initiativeName: 'Strategic Planning'
    },
    {
        title: 'Finalize vendor contract terms',
        description: 'Review and finalize the contract terms with the new cloud vendor',
        status: 'todo',
        priority: 'medium',
        dueDateOffset: 0, // Today
        initiativeName: 'Cloud Migration'
    },
    
    // THIS WEEK (5 tasks)
    {
        title: 'Design system architecture review',
        description: 'Conduct a comprehensive review of the current system architecture',
        status: 'todo',
        priority: 'medium',
        dueDateOffset: 3,
        initiativeName: 'Platform Modernization'
    },
    {
        title: 'Team capacity planning for Q1',
        description: 'Plan resource allocation and team capacity for Q1 projects',
        status: 'todo',
        priority: 'medium',
        dueDateOffset: 4,
        initiativeName: null
    },
    {
        title: 'Update project risk register',
        description: 'Review and update the risk register with new identified risks',
        status: 'todo',
        priority: 'low',
        dueDateOffset: 5,
        initiativeName: 'Risk Management'
    },
    {
        title: 'Client feedback integration',
        description: 'Analyze client feedback and create action items for product improvements',
        status: 'in_progress',
        priority: 'high',
        dueDateOffset: 2,
        initiativeName: 'Customer Success'
    },
    {
        title: 'Technical debt assessment',
        description: 'Document and prioritize technical debt items for the development team',
        status: 'todo',
        priority: 'medium',
        dueDateOffset: 6,
        initiativeName: 'Platform Modernization'
    },
    
    // LATER (2 tasks)
    {
        title: 'Annual training program review',
        description: 'Review and update the employee training program for next year',
        status: 'todo',
        priority: 'low',
        dueDateOffset: 14,
        initiativeName: 'HR Excellence'
    },
    {
        title: 'Platform migration planning',
        description: 'Create a detailed plan for migrating to the new platform',
        status: 'todo',
        priority: 'medium',
        dueDateOffset: 21,
        initiativeName: 'Cloud Migration'
    },
    
    // NO DATE (3 tasks)
    {
        title: 'Knowledge base documentation',
        description: 'Create comprehensive documentation for the internal knowledge base',
        status: 'todo',
        priority: 'low',
        dueDateOffset: null,
        initiativeName: null
    },
    {
        title: 'Process optimization ideas',
        description: 'Brainstorm and document ideas for optimizing internal processes',
        status: 'todo',
        priority: 'low',
        dueDateOffset: null,
        initiativeName: 'Operational Excellence'
    },
    {
        title: 'Internal tool improvements',
        description: 'Identify and document improvements for internal productivity tools',
        status: 'todo',
        priority: 'low',
        dueDateOffset: null,
        initiativeName: null
    }
];

// Decisions
const SAMPLE_DECISIONS = [
    // MY DECISIONS (to approve/reject) - 5
    {
        title: 'Approve new vendor partnership',
        description: 'Review and approve the partnership agreement with the new technology vendor',
        decisionType: 'BUDGET',
        priority: 'HIGH',
        isMyDecision: true,
        daysWaiting: 3
    },
    {
        title: 'Phase 2 scope change approval',
        description: 'Approve the proposed scope changes for Phase 2 of the digital transformation project',
        decisionType: 'SCOPE_CHANGE',
        priority: 'CRITICAL',
        isMyDecision: true,
        daysWaiting: 1
    },
    {
        title: 'Resource allocation for Q1',
        description: 'Decide on the resource allocation strategy for Q1 initiatives',
        decisionType: 'GENERAL',
        priority: 'MEDIUM',
        isMyDecision: true,
        daysWaiting: 5
    },
    {
        title: 'Technology stack selection',
        description: 'Select the technology stack for the new microservices architecture',
        decisionType: 'GENERAL',
        priority: 'HIGH',
        isMyDecision: true,
        daysWaiting: 7
    },
    {
        title: 'Go-live date confirmation',
        description: 'Confirm the go-live date for the production release',
        decisionType: 'PHASE_TRANSITION',
        priority: 'HIGH',
        isMyDecision: true,
        daysWaiting: 2
    },
    
    // AWAITING OTHERS (3)
    {
        title: 'Budget increase request',
        description: 'Request for additional budget allocation for the infrastructure upgrade',
        decisionType: 'BUDGET',
        priority: 'HIGH',
        isMyDecision: false,
        ownerName: 'John Smith (CFO)',
        daysWaiting: 10
    },
    {
        title: 'Legal review completion',
        description: 'Awaiting legal review of the new terms of service',
        decisionType: 'GENERAL',
        priority: 'MEDIUM',
        isMyDecision: false,
        ownerName: 'Legal Team',
        daysWaiting: 4
    },
    {
        title: 'Security clearance approval',
        description: 'Pending security clearance for the new data center access',
        decisionType: 'GENERAL',
        priority: 'MEDIUM',
        isMyDecision: false,
        ownerName: 'Security Officer',
        daysWaiting: 6
    }
];

// ============================================================
// SEED FUNCTION
// ============================================================

async function seedMyWorkEnglishData() {
    console.log('🌱 Seeding My Work English test data...\n');

    try {
        // Get first user and organization
        const user = await dbGet('SELECT id, organization_id FROM users LIMIT 1');
        if (!user) {
            console.error('❌ No users found. Please run the main seed first.');
            process.exit(1);
        }

        const userId = user.id;
        const organizationId = user.organization_id;

        console.log(`📋 Using user: ${userId}`);
        console.log(`🏢 Using organization: ${organizationId}\n`);

        // Get first project (if exists)
        const project = await dbGet('SELECT id FROM projects WHERE organization_id = ? LIMIT 1', [organizationId]);
        const projectId = project?.id || null;

        // Clear existing test data (optional - uncomment if needed)
        // await dbRun('DELETE FROM tasks WHERE organization_id = ? AND title LIKE \'%Q4%\'', [organizationId]);
        // await dbRun('DELETE FROM decisions WHERE organization_id = ?', [organizationId]);

        // ============================================================
        // SEED TASKS
        // ============================================================
        console.log('📝 Creating tasks...');
        
        const now = new Date();
        let taskCount = 0;

        for (const taskData of SAMPLE_TASKS) {
            const taskId = uuidv4();
            
            // Calculate due date
            let dueDate = null;
            if (taskData.dueDateOffset !== null) {
                const date = new Date(now);
                date.setDate(date.getDate() + taskData.dueDateOffset);
                dueDate = date.toISOString().split('T')[0];
            }

            await dbRun(`
                INSERT INTO tasks (
                    id, project_id, organization_id, title, description,
                    status, priority, assignee_id, reporter_id, due_date,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `, [
                taskId,
                projectId,
                organizationId,
                taskData.title,
                taskData.description,
                taskData.status,
                taskData.priority,
                userId,
                userId,
                dueDate
            ]);

            taskCount++;
            console.log(`  ✓ Created: ${taskData.title.substring(0, 40)}...`);
        }

        console.log(`\n✅ Created ${taskCount} tasks\n`);

        // ============================================================
        // SEED DECISIONS
        // ============================================================
        console.log('⚖️ Creating decisions...');
        
        let decisionCount = 0;

        // Get another user for "awaiting others" decisions
        const otherUsers = await dbAll('SELECT id FROM users WHERE id != ? LIMIT 3', [userId]);
        let otherUserIndex = 0;

        for (const decisionData of SAMPLE_DECISIONS) {
            const decisionId = uuidv4();
            const relatedObjectId = uuidv4(); // Fake related object
            
            // Calculate created_at based on daysWaiting
            const createdAt = new Date(now);
            createdAt.setDate(createdAt.getDate() - decisionData.daysWaiting);

            // For "awaiting others", use a different owner; for "my decisions", use current user
            let ownerId = userId;
            if (!decisionData.isMyDecision && otherUsers.length > 0) {
                ownerId = otherUsers[otherUserIndex % otherUsers.length].id;
                otherUserIndex++;
            }

            // Build audit trail with priority info
            const auditTrail = JSON.stringify([{
                action: 'CREATED',
                timestamp: createdAt.toISOString(),
                requestedBy: decisionData.isMyDecision ? null : userId,
                priority: decisionData.priority,
                ownerName: decisionData.ownerName || null
            }]);

            await dbRun(`
                INSERT INTO decisions (
                    id, project_id, decision_type, related_object_type, related_object_id,
                    decision_owner_id, status, required, title, description, 
                    audit_trail, created_at
                ) VALUES (?, ?, ?, 'GENERAL', ?, ?, 'PENDING', 1, ?, ?, ?, ?)
            `, [
                decisionId,
                projectId,
                decisionData.decisionType,
                relatedObjectId,
                ownerId,
                decisionData.title,
                decisionData.description,
                auditTrail,
                createdAt.toISOString()
            ]);

            decisionCount++;
            console.log(`  ✓ Created: ${decisionData.title.substring(0, 40)}...`);
        }

        console.log(`\n✅ Created ${decisionCount} decisions\n`);

        // ============================================================
        // SUMMARY
        // ============================================================
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 SEED SUMMARY');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`   Tasks created: ${taskCount}`);
        console.log(`   Decisions created: ${decisionCount}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n🎉 My Work English test data seeded successfully!\n');

        // Verify data
        const taskVerify = await dbGet('SELECT COUNT(*) as count FROM tasks WHERE organization_id = ?', [organizationId]);
        const decisionVerify = await dbGet('SELECT COUNT(*) as count FROM decisions WHERE project_id = ?', [projectId]);
        
        console.log('🔍 Verification:');
        console.log(`   Total tasks in database: ${taskVerify?.count || 0}`);
        console.log(`   Total decisions in database: ${decisionVerify?.count || 0}`);

    } catch (error) {
        console.error('❌ Error seeding data:', error);
        process.exit(1);
    } finally {
        if (isPostgres) {
            await db.end();
        }
    }
}

// Run the seed
seedMyWorkEnglishData();

