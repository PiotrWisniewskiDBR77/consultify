/**
 * Seed SuperAdmin Test Data
 * 
 * Creates test data for SuperAdmin panel:
 * - Activity logs
 * - AI logs (token usage)
 * - Metric events (for conversion intelligence)
 * - Token transactions (for billing)
 * 
 * Usage:
 *   node server/seed/seed_superadmin_testdata.js
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
// SEED DATA
// ============================================================

const ACTION_TYPES = [
    'created', 'updated', 'deleted', 'viewed', 'exported', 
    'approved', 'rejected', 'invited', 'login', 'logout'
];

const ENTITY_TYPES = [
    'assessment', 'initiative', 'project', 'task', 'user', 
    'organization', 'report', 'document', 'decision'
];

const AI_ACTIONS = [
    'chat_completion', 'assessment_analysis', 'initiative_generation',
    'report_generation', 'risk_analysis', 'recommendation_engine'
];

const MODELS = [
    { provider: 'openai', model: 'gpt-4o', inputCost: 5, outputCost: 15 },
    { provider: 'openai', model: 'gpt-4o-mini', inputCost: 0.15, outputCost: 0.6 },
    { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', inputCost: 3, outputCost: 15 },
    { provider: 'groq', model: 'llama-3.1-70b-versatile', inputCost: 0.59, outputCost: 0.79 }
];

function randomDate(daysBack) {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * daysBack));
    date.setHours(Math.floor(Math.random() * 24));
    date.setMinutes(Math.floor(Math.random() * 60));
    return date.toISOString();
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ============================================================
// MAIN SEED FUNCTION
// ============================================================

async function seedSuperAdminData() {
    console.log('🌱 Starting SuperAdmin test data seed...');
    console.log(`📊 Database type: ${isPostgres ? 'PostgreSQL' : 'SQLite'}`);

    try {
        // Get existing organizations and users
        const orgs = await dbAll('SELECT id, name FROM organizations');
        const users = await dbAll('SELECT id, email, organization_id FROM users');

        if (orgs.length === 0) {
            console.log('❌ No organizations found. Please run main seed first.');
            process.exit(1);
        }

        console.log(`📁 Found ${orgs.length} organizations and ${users.length} users`);

        // 1. Seed Activity Logs (50 entries)
        console.log('📝 Seeding activity logs...');
        for (let i = 0; i < 50; i++) {
            const user = randomChoice(users);
            const action = randomChoice(ACTION_TYPES);
            const entityType = randomChoice(ENTITY_TYPES);
            
            await dbRun(`
                INSERT INTO activity_logs (id, organization_id, user_id, action, entity_type, entity_id, entity_name, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                uuidv4(),
                user.organization_id,
                user.id,
                action,
                entityType,
                uuidv4(),
                `${entityType}-${randomInt(1, 100)}`,
                randomDate(30)
            ]);
        }
        console.log('✅ Activity logs seeded');

        // 2. Seed AI Logs (100 entries for realistic usage data)
        console.log('🤖 Seeding AI logs...');
        for (let i = 0; i < 100; i++) {
            const user = randomChoice(users);
            const model = randomChoice(MODELS);
            const inputTokens = randomInt(100, 5000);
            const outputTokens = randomInt(50, 2000);
            
            await dbRun(`
                INSERT INTO ai_logs (id, user_id, action, model, input_tokens, output_tokens, latency_ms, topic, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                uuidv4(),
                user.id,
                randomChoice(AI_ACTIONS),
                model.model,
                inputTokens,
                outputTokens,
                randomInt(200, 5000),
                randomChoice(['assessment', 'chat', 'initiative', 'report', 'analysis']),
                randomDate(30)
            ]);
        }
        console.log('✅ AI logs seeded');

        // 3. Seed Metric Events (for conversion intelligence)
        console.log('📊 Seeding metric events...');
        const eventTypes = [
            'DEMO_STARTED', 'DEMO_COMPLETED', 'TRIAL_STARTED', 'TRIAL_CONVERTED',
            'HELP_STARTED', 'HELP_COMPLETED', 'INVITE_SENT', 'INVITE_ACCEPTED',
            'ASSESSMENT_STARTED', 'ASSESSMENT_COMPLETED', 'UPGRADED_TO_PAID'
        ];

        for (let i = 0; i < 80; i++) {
            const user = randomChoice(users);
            const eventType = randomChoice(eventTypes);
            
            await dbRun(`
                INSERT INTO metrics_events (id, organization_id, user_id, event_type, source, context, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                uuidv4(),
                user.organization_id,
                user.id,
                eventType,
                randomChoice(['DIRECT', 'GOOGLE', 'LINKEDIN', 'PARTNER', 'REFERRAL']),
                JSON.stringify({ action: eventType, step: randomInt(1, 5) }),
                randomDate(60)
            ]);
        }
        console.log('✅ Metric events seeded');

        // 4. Seed Token Transactions (for billing view)
        console.log('💰 Seeding token transactions...');
        const transactionTypes = ['purchase', 'usage', 'bonus'];
        
        for (let i = 0; i < 30; i++) {
            const org = randomChoice(orgs);
            const user = users.find(u => u.organization_id === org.id) || users[0];
            const type = randomChoice(transactionTypes);
            const tokens = type === 'purchase' ? randomInt(10000, 100000) : 
                          type === 'bonus' ? randomInt(1000, 5000) : 
                          -randomInt(500, 5000);
            const netRevenue = type === 'purchase' ? randomInt(10, 200) : 0;
            const margin = netRevenue * 0.3;
            
            await dbRun(`
                INSERT INTO token_transactions (id, organization_id, user_id, type, source_type, tokens, margin_usd, net_revenue_usd, description, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                uuidv4(),
                org.id,
                user.id,
                type,
                type === 'purchase' ? 'package' : type === 'bonus' ? 'promotion' : 'ai_usage',
                tokens,
                margin,
                netRevenue,
                type === 'purchase' ? `Token package purchase - ${Math.abs(tokens).toLocaleString()} tokens` :
                type === 'bonus' ? 'Welcome bonus tokens' :
                'AI usage consumption',
                randomDate(60)
            ]);
        }
        console.log('✅ Token transactions seeded');

        // 5. Seed Access Codes (for the SuperAdmin codes tab)
        console.log('🔑 Seeding access codes...');
        const codes = ['WELCOME2025', 'PARTNER100', 'EARLYBIRD', 'PREMIUM50'];
        const adminUser = users.find(u => u.email?.includes('admin')) || users[0];
        
        for (const code of codes) {
            await dbRun(`
                INSERT INTO access_codes (id, organization_id, code, created_by, role, max_uses, current_uses, expires_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `, [
                uuidv4(),
                adminUser?.organization_id || orgs[0].id,
                code,
                adminUser?.id,
                'USER',
                100,
                randomInt(0, 30),
                randomDate(-90) // Future date
            ]);
        }
        console.log('✅ Access codes seeded');

        console.log('\n🎉 SuperAdmin test data seeding completed successfully!');
        console.log('📊 Summary:');
        console.log('   - 50 activity logs');
        console.log('   - 100 AI usage logs');
        console.log('   - 80 metric events');
        console.log('   - 30 token transactions');
        console.log('   - 4 access codes');

    } catch (error) {
        console.error('❌ Error seeding data:', error);
        process.exit(1);
    } finally {
        if (isPostgres) {
            await db.end();
        }
        process.exit(0);
    }
}

// Run the seed
seedSuperAdminData();

