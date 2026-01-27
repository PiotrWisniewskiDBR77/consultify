/**
 * SEED: Decisions Data for MyWork Panel
 * 
 * Adds comprehensive decision data for the decisions panel in MyWork:
 * - Pending decisions awaiting current user action
 * - Pending decisions awaiting other users
 * - Completed decisions (approved/rejected/deferred)
 * - Various priority levels
 * - Different decision types
 * 
 * Run: node server/seed/seed_decisions.js
 */

import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Detect database type
const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres');

let db;
async function initializeDatabase() {
    try {
        if (isPostgres) {
            const { Pool } = await import('pg');
            db = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
            });
        } else {
            const sqlite3 = await import('sqlite3');
            const path = await import('path');
            const { fileURLToPath } = await import('url');
            const __dirname = path.dirname(fileURLToPath(import.meta.url));
            const dbPath = path.join(__dirname, '..', 'consultinity.db');
            db = new sqlite3.default.Database(dbPath);
        }
    } catch (error) {
        console.error('Failed to initialize database:', error);
        throw error;
    }
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
        pgSql = pgSql.replace(/INSERT OR REPLACE/gi, 'INSERT');
        // Handle ON CONFLICT for PostgreSQL
        if (pgSql.includes('INSERT INTO decisions')) {
            pgSql = pgSql.replace(/\)$/g, ') ON CONFLICT (id) DO UPDATE SET updated_at = NOW()');
        }
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

// Generate dates
const now = new Date();
const daysAgo = (days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
const daysFromNow = (days) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

// ============================================
// SEED EXECUTION
// ============================================
async function seed() {
    console.log('🚀 Starting Decisions Seed...\n');
    console.log(`   Database: ${isPostgres ? 'PostgreSQL' : 'SQLite'}\n`);

    try {
        await initializeDatabase();

        // 1. Find DBR77 organization dynamically
        let org = await dbGet(`SELECT id FROM organizations WHERE id = 'dbr77' LIMIT 1`);
        if (!org) {
            org = await dbGet(`SELECT id FROM organizations WHERE name LIKE '%DBR77%' OR name LIKE '%Consultinity%' LIMIT 1`);
        }
        if (!org) {
            // Fallback: get any organization
            org = await dbGet(`SELECT id FROM organizations LIMIT 1`);
        }
        if (!org) {
            console.error('❌ No organization found. Please run seed_demo_organization.js first.');
            process.exit(1);
        }
        const ORG_ID = org.id;
        console.log(`✅ Found organization: ${ORG_ID}`);

        // 2. Find a user in this organization
        let user = await dbGet(`SELECT id, first_name, last_name FROM users WHERE organization_id = ? AND status = 'active' LIMIT 1`, [ORG_ID]);
        if (!user) {
            user = await dbGet(`SELECT id, first_name, last_name FROM users WHERE organization_id = ? LIMIT 1`, [ORG_ID]);
        }
        if (!user) {
            console.error('❌ No user found in organization. Please create a user first.');
            process.exit(1);
        }
        const USER_ID = user.id;
        console.log(`✅ Found user: ${user.first_name || ''} ${user.last_name || ''} (${USER_ID})`);

        // 3. Find other users for "awaiting others" decisions
        const otherUsers = await dbAll(`SELECT id, first_name, last_name, role FROM users WHERE organization_id = ? AND id != ? LIMIT 5`, [ORG_ID, USER_ID]);
        console.log(`✅ Found ${otherUsers?.length || 0} other users for decision assignments`);

        // 4. Find existing projects in this organization
        const projects = await dbAll(`SELECT id, name FROM projects WHERE organization_id = ? LIMIT 5`, [ORG_ID]);
        console.log(`✅ Found ${projects?.length || 0} projects`);

        // Use first project or null
        const projectId = projects?.[0]?.id || null;

        // ============================================
        // DECISIONS awaiting current user (My Decisions)
        // ============================================
        const myDecisions = [
            {
                id: `decision-${uuidv4()}`,
                title: 'Approve Phase 2 Budget Increase',
                description: 'Digital Transformation 2025 project requires additional €150K for enhanced AI capabilities',
                type: 'BUDGET',
                priority: 'HIGH',
                status: 'pending',
                deadline: daysFromNow(3),
                options: JSON.stringify(['Approve full amount', 'Approve partial (€100K)', 'Defer to Q2', 'Reject']),
                created_at: daysAgo(5)
            },
            {
                id: `decision-${uuidv4()}`,
                title: 'Vendor Selection for IoT Platform',
                description: 'Choose between Siemens MindSphere, PTC ThingWorx, or Azure IoT Hub for Smart Factory',
                type: 'VENDOR',
                priority: 'CRITICAL',
                status: 'pending',
                deadline: daysFromNow(2),
                options: JSON.stringify(['Siemens MindSphere', 'PTC ThingWorx', 'Azure IoT Hub', 'Custom Solution']),
                created_at: daysAgo(7)
            },
            {
                id: `decision-${uuidv4()}`,
                title: 'Go-Live Date Approval',
                description: 'Confirm planned go-live date of March 15, 2026 for MES Phase 1',
                type: 'PHASE_TRANSITION',
                priority: 'HIGH',
                status: 'pending',
                deadline: daysFromNow(5),
                options: JSON.stringify(['Approve March 15', 'Delay to April 1', 'Delay to April 15']),
                created_at: daysAgo(3)
            },
            {
                id: `decision-${uuidv4()}`,
                title: 'Scope Change: Add Mobile App',
                description: 'Request to include mobile app for shop floor operators in Smart Factory initiative',
                type: 'SCOPE_CHANGE',
                priority: 'MEDIUM',
                status: 'pending',
                deadline: daysFromNow(7),
                options: JSON.stringify(['Approve with current budget', 'Approve with additional budget', 'Defer to Phase 2', 'Reject']),
                created_at: daysAgo(2)
            },
            {
                id: `decision-${uuidv4()}`,
                title: 'Initiative Approval: Predictive Quality',
                description: 'Approve new initiative for AI-powered predictive quality monitoring',
                type: 'INITIATIVE_APPROVAL',
                priority: 'MEDIUM',
                status: 'pending',
                deadline: daysFromNow(10),
                options: JSON.stringify(['Approve', 'Request more information', 'Reject']),
                created_at: daysAgo(1)
            },
            // Overdue decision
            {
                id: `decision-${uuidv4()}`,
                title: 'Critical Security Patch Approval',
                description: 'Approve emergency security patch deployment for production systems',
                type: 'TECHNICAL',
                priority: 'CRITICAL',
                status: 'pending',
                deadline: daysAgo(2), // Overdue!
                options: JSON.stringify(['Approve immediate deployment', 'Schedule for maintenance window', 'Reject']),
                created_at: daysAgo(5)
            }
        ];

        // ============================================
        // DECISIONS awaiting others (I requested)
        // ============================================
        const awaitingOthersDecisions = [];

        if (otherUsers && otherUsers.length > 0) {
            awaitingOthersDecisions.push(
                {
                    id: `decision-${uuidv4()}`,
                    title: 'Resource Allocation for Q2',
                    description: 'Request for 3 additional developers for Digital Transformation team',
                    type: 'RESOURCE',
                    priority: 'HIGH',
                    status: 'pending',
                    deadline: daysFromNow(5),
                    decision_owner: otherUsers[0]?.id || USER_ID,
                    owner_name: `${otherUsers[0]?.first_name || 'Manager'} ${otherUsers[0]?.last_name || ''}`,
                    created_at: daysAgo(4)
                },
                {
                    id: `decision-${uuidv4()}`,
                    title: 'Training Budget Approval',
                    description: 'Request for €25K training budget for Industry 4.0 certifications',
                    type: 'BUDGET',
                    priority: 'MEDIUM',
                    status: 'pending',
                    deadline: daysFromNow(10),
                    decision_owner: otherUsers[1]?.id || otherUsers[0]?.id || USER_ID,
                    owner_name: `${otherUsers[1]?.first_name || otherUsers[0]?.first_name || 'CFO'} ${otherUsers[1]?.last_name || otherUsers[0]?.last_name || ''}`,
                    created_at: daysAgo(6)
                },
                {
                    id: `decision-${uuidv4()}`,
                    title: 'Partnership Agreement with TechVendor',
                    description: 'Strategic partnership for IoT sensor supply and maintenance',
                    type: 'STRATEGIC',
                    priority: 'HIGH',
                    status: 'escalated',
                    deadline: daysAgo(1), // Overdue and escalated
                    decision_owner: otherUsers[2]?.id || otherUsers[0]?.id || USER_ID,
                    owner_name: `${otherUsers[2]?.first_name || otherUsers[0]?.first_name || 'CEO'} ${otherUsers[2]?.last_name || otherUsers[0]?.last_name || ''}`,
                    created_at: daysAgo(14)
                }
            );
        }

        // 1. Insert My Decisions (pending, awaiting my action)
        console.log('\n📊 Inserting My Decisions (pending)...');
        for (const d of myDecisions) {
            await dbRun(`
                INSERT OR REPLACE INTO decisions (
                    id, organization_id, project_id, title, description, type,
                    decision_maker_id, decision_owner_id, options, deadline, status,
                    created_by, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `, [
                d.id, ORG_ID, projectId, d.title, d.description, d.type,
                USER_ID, USER_ID, d.options, d.deadline, d.status,
                USER_ID, d.created_at
            ]);
        }
        console.log(`   ✅ ${myDecisions.length} pending decisions (My Decisions)`);

        // 2. Insert Awaiting Others Decisions
        console.log('📋 Inserting Awaiting Others Decisions...');
        for (const d of awaitingOthersDecisions) {
            await dbRun(`
                INSERT OR REPLACE INTO decisions (
                    id, organization_id, project_id, title, description, type,
                    decision_maker_id, decision_owner_id, deadline, status,
                    created_by, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `, [
                d.id, ORG_ID, projectId, d.title, d.description, d.type,
                d.decision_owner, USER_ID, d.deadline, d.status,
                USER_ID, d.created_at
            ]);
        }
        console.log(`   ✅ ${awaitingOthersDecisions.length} decisions (Awaiting Others)`);

        console.log('\n✨ Decisions Seed finished successfully!');
        console.log('\n📈 Summary:');
        console.log(`   - Organization: ${ORG_ID}`);
        console.log(`   - Decision Maker: ${USER_ID}`);
        console.log(`   - My Decisions (pending): ${myDecisions.length}`);
        console.log(`   - Awaiting Others: ${awaitingOthersDecisions.length}`);

    } catch (error) {
        console.error('❌ Error during seed:', error);
        process.exit(1);
    } finally {
        if (isPostgres && db) {
            await db.end();
        } else if (db && db.close) {
            db.close();
        }
    }
}

seed();
