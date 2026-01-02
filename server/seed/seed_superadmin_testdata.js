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

        // 1. Seed Additional Organizations (10-15 total)
        console.log('🏢 Seeding additional organizations...');
        const orgNames = [
            'Acme Corporation', 'TechStart Inc', 'Global Solutions Ltd', 'Innovation Hub',
            'Digital Ventures', 'Cloud Systems', 'Data Analytics Co', 'Future Tech',
            'Smart Solutions', 'NextGen Industries', 'Enterprise Partners', 'Startup Labs'
        ];
        const plans = ['free', 'pro', 'enterprise'];
        const statuses = ['active', 'trial', 'blocked'];
        
        for (let i = 0; i < Math.min(12, 15 - orgs.length); i++) {
            const orgId = uuidv4();
            const plan = randomChoice(plans);
            const status = randomChoice(statuses);
            
            await dbRun(`
                INSERT INTO organizations (id, name, plan, status, created_at)
                VALUES (?, ?, ?, ?, ?)
            `, [
                orgId,
                orgNames[i] || `Test Org ${i + 1}`,
                plan,
                status,
                randomDate(90)
            ]);
            orgs.push({ id: orgId, name: orgNames[i] || `Test Org ${i + 1}` });
        }
        console.log(`✅ Organizations seeded (total: ${orgs.length})`);

        // 2. Seed Additional Users (50-100 total)
        console.log('👥 Seeding additional users...');
        const firstNames = ['John', 'Jane', 'Mike', 'Sarah', 'David', 'Emily', 'Chris', 'Lisa', 'Tom', 'Anna'];
        const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Moore'];
        const roles = ['USER', 'ADMIN', 'PROJECT_MANAGER', 'VIEWER'];
        
        for (let i = users.length; i < Math.min(100, users.length + 50); i++) {
            const org = randomChoice(orgs);
            const userId = uuidv4();
            const firstName = randomChoice(firstNames);
            const lastName = randomChoice(lastNames);
            const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`;
            const role = randomChoice(roles);
            
            await dbRun(`
                INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
            `, [
                userId,
                org.id,
                email,
                '$2a$08$placeholder', // Placeholder password hash
                firstName,
                lastName,
                role,
                randomDate(60)
            ]);
            users.push({ id: userId, email, organization_id: org.id });
        }
        console.log(`✅ Users seeded (total: ${users.length})`);

        // 3. Seed Activity Logs (500+ entries)
        console.log('📝 Seeding activity logs...');
        for (let i = 0; i < 500; i++) {
            const user = randomChoice(users);
            if (!user.organization_id) {
                console.warn(`Skipping user ${user.id} - no organization_id`);
                continue;
            }
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
                randomDate(90)
            ]);
        }
        console.log('✅ Activity logs seeded (500 entries)');

        // 4. Seed AI Logs (500+ entries)
        console.log('🤖 Seeding AI logs...');
        for (let i = 0; i < 500; i++) {
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
                randomDate(90)
            ]);
        }
        console.log('✅ AI logs seeded (500 entries)');

        // 4b. Seed AI Audit Logs (300+ entries for costs endpoint)
        console.log('📊 Seeding AI audit logs...');
        const capabilities = ['assessment', 'chat', 'initiative', 'report', 'analysis', 'decision', 'planning'];
        const actionTypes = ['generate', 'analyze', 'recommend', 'classify', 'summarize'];
        for (let i = 0; i < 300; i++) {
            const user = randomChoice(users);
            if (!user.organization_id) continue;
            const model = randomChoice(MODELS);
            const inputTokens = randomInt(100, 5000);
            const outputTokens = randomInt(50, 2000);
            const costUsd = (inputTokens + outputTokens) * (model.cost_per_1k || 0.002) / 1000;
            
            await dbRun(`
                INSERT INTO ai_audit_logs (id, organization_id, user_id, model, capability, action_type, tokens_used, cost_usd, timestamp, success)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                uuidv4(),
                user.organization_id,
                user.id,
                model.model,
                randomChoice(capabilities),
                randomChoice(actionTypes),
                inputTokens + outputTokens,
                costUsd,
                randomDate(90),
                1
            ]);
        }
        console.log('✅ AI audit logs seeded (300 entries)');

        // 5. Seed Metric Events (300+ entries)
        console.log('📊 Seeding metric events...');
        const eventTypes = [
            'demo_started', 'trial_started', 'trial_extended', 'trial_expired', 'upgraded_to_paid',
            'help_started', 'help_completed', 'invite_sent', 'invite_accepted',
            'settlement_generated'
        ];

        for (let i = 0; i < 300; i++) {
            const user = randomChoice(users);
            const eventType = randomChoice(eventTypes);
            const source = randomChoice(['DIRECT', 'GOOGLE', 'LINKEDIN', 'PARTNER', 'REFERRAL']);
            
            // Build context based on event type
            let context = {};
            if (eventType === 'help_started' || eventType === 'help_completed') {
                context = { playbookKey: `playbook_${randomInt(1, 10)}`, step: randomInt(1, 5) };
            } else if (source === 'PARTNER') {
                context = { partnerCode: `PARTNER${randomInt(1, 5)}`, action: eventType };
            } else {
                context = { action: eventType, step: randomInt(1, 5) };
            }
            
            await dbRun(`
                INSERT INTO metrics_events (id, organization_id, user_id, event_type, source, context, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                uuidv4(),
                user.organization_id,
                user.id,
                eventType,
                source,
                JSON.stringify(context),
                randomDate(90)
            ]);
        }
        console.log('✅ Metric events seeded (300 entries)');

        // 6. Seed Token Transactions (100+ entries)
        console.log('💰 Seeding token transactions...');
        const transactionTypes = ['purchase', 'usage', 'bonus'];
        
        for (let i = 0; i < 100; i++) {
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
                randomDate(90)
            ]);
        }
        console.log('✅ Token transactions seeded (100 entries)');

        // 7. Seed Access Codes (10+ entries)
        console.log('🔑 Seeding access codes...');
        const codes = ['WELCOME2025', 'PARTNER100', 'EARLYBIRD', 'PREMIUM50', 'STARTUP2025', 
                      'ENTERPRISE', 'TRIAL30', 'BETA2025', 'LAUNCH', 'SPECIAL50'];
        const adminUser = users.find(u => u.email?.includes('admin')) || users[0];
        
        for (const code of codes) {
            await dbRun(`
                INSERT INTO access_codes (id, organization_id, code, created_by, role, max_uses, current_uses, expires_at, is_active, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `, [
                uuidv4(),
                adminUser?.organization_id || orgs[0].id,
                code,
                adminUser?.id,
                'USER',
                100,
                randomInt(0, 30),
                randomDate(-90), // Future date
                1 // is_active
            ]);
        }
        console.log('✅ Access codes seeded (10 entries)');

        // 8. Seed Access Requests (20+ entries)
        console.log('📨 Seeding access requests...');
        const requestStatuses = ['pending', 'approved', 'rejected'];
        for (let i = 0; i < 20; i++) {
            const org = randomChoice(orgs);
            const status = randomChoice(requestStatuses);
            
            await dbRun(`
                INSERT INTO access_requests (id, organization_id, email, organization_name, first_name, last_name, status, requested_at, reviewed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                uuidv4(),
                org.id,
                `request${i}@example.com`,
                `Company ${i + 1}`,
                `First${i}`,
                `Last${i}`,
                status,
                randomDate(30),
                status !== 'pending' ? randomDate(25) : null
            ]);
        }
        console.log('✅ Access requests seeded (20 entries)');

        // 9. Seed Invoices (30+ entries)
        console.log('🧾 Seeding invoices...');
        const invoiceStatuses = ['paid', 'open', 'void', 'uncollectible'];
        for (let i = 0; i < 30; i++) {
            const org = randomChoice(orgs);
            const status = randomChoice(invoiceStatuses);
            const amountDue = randomInt(100, 5000);
            const amountPaid = status === 'paid' ? amountDue : randomInt(0, amountDue);
            const periodStart = randomDate(60);
            const periodEnd = new Date(new Date(periodStart).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
            
            await dbRun(`
                INSERT INTO invoices (id, organization_id, stripe_invoice_id, amount_due, amount_paid, status, period_start, period_end, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                uuidv4(),
                org.id,
                `inv_${Math.random().toString(36).substring(2, 15)}`,
                amountDue,
                amountPaid,
                status,
                periodStart,
                periodEnd,
                randomDate(60)
            ]);
        }
        console.log('✅ Invoices seeded (30 entries)');

        // 10. Seed Subscription Plans
        console.log('📋 Seeding subscription plans...');
        const plansData = [
            { name: 'Free', price_monthly: 0, token_limit: 10000, storage_limit_gb: 1, features: JSON.stringify(['basic']) },
            { name: 'Pro', price_monthly: 49, token_limit: 500000, storage_limit_gb: 50, features: JSON.stringify(['basic', 'advanced']) },
            { name: 'Enterprise', price_monthly: 199, token_limit: 2000000, storage_limit_gb: 500, features: JSON.stringify(['basic', 'advanced', 'premium']) }
        ];
        
        for (const plan of plansData) {
            const existing = await dbGet('SELECT id FROM subscription_plans WHERE name = ?', [plan.name]);
            if (!existing) {
                await dbRun(`
                    INSERT INTO subscription_plans (id, name, price_monthly, token_limit, storage_limit_gb, features, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
                `, [uuidv4(), plan.name, plan.price_monthly, plan.token_limit, plan.storage_limit_gb, plan.features]);
            }
        }
        console.log('✅ Subscription plans seeded');

        // 11. Seed SSO Configurations (5+ entries)
        // Note: SSO configurations are stored in a different table structure
        // For now, we'll skip this as the table structure may vary
        console.log('🔐 Skipping SSO configurations (table structure may vary)');

        // 12. Seed Playbook Templates (10+ entries)
        console.log('📚 Seeding playbook templates...');
        const templateTitles = [
            'Onboarding Process', 'Project Kickoff', 'Risk Assessment', 'Change Management',
            'Quality Review', 'Stakeholder Engagement', 'Resource Planning', 'Performance Review',
            'Incident Response', 'Compliance Check'
        ];
        
        for (let i = 0; i < 10; i++) {
            await dbRun(`
                INSERT INTO ai_playbook_templates (id, key, title, description, is_active, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                uuidv4(),
                `template-${i + 1}`,
                templateTitles[i],
                `Template for ${templateTitles[i]}`,
                randomChoice(['DRAFT', 'PUBLISHED', 'DEPRECATED']) === 'PUBLISHED' ? 1 : 0,
                randomDate(60)
            ]);
        }
        console.log('✅ Playbook templates seeded (10 entries)');

        // 13. Seed Email Templates (5+ entries)
        // Note: Email templates table may not exist in schema - skip for now
        console.log('📧 Skipping email templates (table may not exist in schema)');

        // 14. Seed Legal Documents (5+ entries)
        console.log('📄 Seeding legal documents...');
        const legalDocs = [
            { doc_type: 'TOS', title: 'Terms of Service', version: '1.0' },
            { doc_type: 'PRIVACY', title: 'Privacy Policy', version: '1.0' },
            { doc_type: 'COOKIES', title: 'Cookie Policy', version: '1.0' },
            { doc_type: 'DPA', title: 'Data Processing Agreement', version: '1.0' },
            { doc_type: 'AUP', title: 'Acceptable Use Policy', version: '1.0' }
        ];
        
        for (const doc of legalDocs) {
            await dbRun(`
                INSERT INTO legal_documents (id, doc_type, version, title, content_md, effective_from, is_active, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                uuidv4(),
                doc.doc_type,
                doc.version,
                doc.title,
                `Content for ${doc.title}`,
                randomDate(60),
                1,
                randomDate(90)
            ]);
        }
        console.log('✅ Legal documents seeded (5 entries)');

        // 15. Seed Feature Flags (10+ entries)
        // Note: Feature flags table may not exist in schema - skip for now
        console.log('🚩 Skipping feature flags (table may not exist in schema)');

        // 16. Seed Audit Events (200+ entries)
        console.log('🔍 Seeding audit events...');
        const auditActions = ['create', 'update', 'delete', 'view', 'export', 'login', 'logout'];
        for (let i = 0; i < 200; i++) {
            const user = randomChoice(users);
            const action = randomChoice(auditActions);
            
            await dbRun(`
                INSERT INTO audit_events (id, org_id, actor_user_id, action_type, entity_type, entity_id, ts)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                uuidv4(),
                user.organization_id,
                user.id,
                action,
                randomChoice(ENTITY_TYPES),
                uuidv4(),
                randomDate(90)
            ]);
        }
        console.log('✅ Audit events seeded (200 entries)');

        console.log('\n🎉 SuperAdmin test data seeding completed successfully!');
        console.log('📊 Summary:');
        console.log(`   - ${orgs.length} organizations`);
        console.log(`   - ${users.length} users`);
        console.log('   - 500 activity logs');
        console.log('   - 500 AI usage logs');
        console.log('   - 300 metric events');
        console.log('   - 100 token transactions');
        console.log('   - 10 access codes');
        console.log('   - 20 access requests');
        console.log('   - 30 invoices');
        console.log('   - Subscription plans');
        console.log('   - 10 playbook templates');
        console.log('   - 5 legal documents');
        console.log('   - 200 audit events');

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

