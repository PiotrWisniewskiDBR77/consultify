/**
 * Seed Script for DBR77 Example Data
 * 
 * This script populates the database with realistic example data
 * for the DBR77 Digital Transformation project
 */

const sqlite3 = require('sqlite3').verbose();
import path from 'path';
import { v4: uuidv4 } from 'uuid';

const DB_PATH = path.join(__dirname, '..', 'consultify.db');
const db = new sqlite3.Database(DB_PATH);

// Helper to run SQL
const run = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
};

const get = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const all = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

async function seedDBR77Data() {
    console.log('🚀 Starting DBR77 data seed...\n');

    try {
        // 1. Get existing DBR77 organization
        let org = await get('SELECT * FROM organizations WHERE id = ? OR name LIKE ? LIMIT 1', ['org-dbr77-test', '%DBR77%']);
        if (!org) {
            console.error('❌ No DBR77 organization found. Please create one first.');
            return;
        }
        
        const orgId = org.id;
        console.log(`✅ Using organization: ${org.name} (${orgId})`);

        // 2. Get existing users
        const existingUsers = await all('SELECT * FROM users WHERE organization_id = ?', [orgId]);
        console.log(`\n👥 Found ${existingUsers.length} existing users`);
        
        const userIds = existingUsers.map(u => u.id);

        // 3. Create security events table and data
        console.log('\n🔒 Creating security events...');
        await run(`
            CREATE TABLE IF NOT EXISTS security_events (
                id TEXT PRIMARY KEY,
                organization_id TEXT,
                user_id TEXT,
                type TEXT NOT NULL,
                severity TEXT DEFAULT 'low',
                details TEXT,
                resolved INTEGER DEFAULT 0,
                resolved_at TEXT,
                resolved_by TEXT,
                ip_address TEXT,
                user_agent TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (organization_id) REFERENCES organizations(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        // Clear old security events for this org
        await run('DELETE FROM security_events WHERE organization_id = ?', [orgId]);

        const securityEvents = [
            { type: 'pii_detected', severity: 'medium', userIdx: 0, details: 'PII (email address) detected and automatically redacted in AI request', hoursAgo: 2, resolved: 1 },
            { type: 'rate_limit', severity: 'low', userIdx: 1, details: 'User exceeded daily AI request limit (100/100)', hoursAgo: 5, resolved: 1 },
            { type: 'access_denied', severity: 'low', userIdx: 2, details: 'Attempted access to premium AI model without proper tier', hoursAgo: 12, resolved: 1 },
            { type: 'pii_detected', severity: 'medium', userIdx: 0, details: 'Phone number detected and masked in conversation context', hoursAgo: 24, resolved: 1 },
            { type: 'budget_exceeded', severity: 'medium', userIdx: null, details: 'Organization AI budget reached 95% threshold', hoursAgo: 48, resolved: 0 },
            { type: 'injection_attempt', severity: 'high', userIdx: 1, details: 'Potential prompt injection attempt detected and blocked', hoursAgo: 72, resolved: 0 },
        ];

        for (const event of securityEvents) {
            const userId = event.userIdx !== null && userIds[event.userIdx] ? userIds[event.userIdx] : null;
            await run(`
                INSERT INTO security_events (id, organization_id, user_id, type, severity, details, resolved, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-${event.hoursAgo} hours'))
            `, [uuidv4(), orgId, userId, event.type, event.severity, event.details, event.resolved]);
        }
        console.log(`  ✓ Created ${securityEvents.length} security events`);

        // 4. Create AI usage stats table and data
        console.log('\n📊 Creating AI usage stats...');
        await run(`
            CREATE TABLE IF NOT EXISTS ai_usage_stats (
                id TEXT PRIMARY KEY,
                organization_id TEXT,
                user_id TEXT,
                project_id TEXT,
                period_start TEXT,
                period_end TEXT,
                requests_count INTEGER DEFAULT 0,
                tokens_used INTEGER DEFAULT 0,
                cost_usd REAL DEFAULT 0,
                tier TEXT DEFAULT 'STANDARD',
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (organization_id) REFERENCES organizations(id),
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (project_id) REFERENCES projects(id)
            )
        `);

        // Clear old usage stats for this org
        await run('DELETE FROM ai_usage_stats WHERE organization_id = ?', [orgId]);

        // Create usage data for each user with tier information
        const usageData = [
            { userIdx: 0, requests: 456, tokens: 185000, cost: 18.50, tier: 'PREMIUM' },
            { userIdx: 1, requests: 234, tokens: 89000, cost: 8.50, tier: 'STANDARD' },
            { userIdx: 2, requests: 89, tokens: 32000, cost: 2.10, tier: 'BUDGET' },
        ];

        for (const usage of usageData) {
            if (userIds[usage.userIdx]) {
                await run(`
                    INSERT INTO ai_usage_stats (id, organization_id, user_id, period_start, period_end, requests_count, tokens_used, cost_usd, tier)
                    VALUES (?, ?, ?, date('now', '-7 days'), date('now'), ?, ?, ?, ?)
                `, [uuidv4(), orgId, userIds[usage.userIdx], usage.requests, usage.tokens, usage.cost, usage.tier]);
            }
        }
        console.log(`  ✓ Created ${usageData.length} user usage records`);

        // Create project usage
        const projects = await all('SELECT * FROM projects WHERE organization_id = ? LIMIT 3', [orgId]);
        for (let i = 0; i < projects.length; i++) {
            const projectUsage = [
                { requests: 234, tokens: 89000, cost: 8.50 },
                { requests: 156, tokens: 58000, cost: 5.40 },
                { requests: 89, tokens: 32000, cost: 2.90 },
            ][i] || { requests: 50, tokens: 20000, cost: 1.50 };
            
            await run(`
                INSERT INTO ai_usage_stats (id, organization_id, project_id, period_start, period_end, requests_count, tokens_used, cost_usd)
                VALUES (?, ?, ?, date('now', '-7 days'), date('now'), ?, ?, ?)
            `, [uuidv4(), orgId, projects[i].id, projectUsage.requests, projectUsage.tokens, projectUsage.cost]);
        }
        console.log(`  ✓ Created ${projects.length} project usage records`);

        // 5. Create audit events if table exists
        console.log('\n📝 Creating audit events...');
        const auditTableExists = await get("SELECT name FROM sqlite_master WHERE type='table' AND name='audit_events'");
        
        if (auditTableExists) {
            const auditEvents = [
                { type: 'USER_LOGIN', description: 'Admin logged in from Warsaw, Poland' },
                { type: 'PROJECT_CREATE', description: 'Created project: AI Integration Initiative' },
                { type: 'SETTINGS_UPDATE', description: 'Updated AI settings: increased daily token limit to 50,000' },
                { type: 'USER_ROLE_CHANGE', description: 'Changed role for team member from USER to PROJECT_MANAGER' },
                { type: 'TASK_COMPLETE', description: 'Completed task: Database schema migration for Q1 release' },
                { type: 'INVITATION_SEND', description: 'Sent invitation to external consultant' },
                { type: 'REPORT_GENERATE', description: 'Generated monthly progress report for stakeholders' },
                { type: 'AI_MODEL_CHANGE', description: 'Changed default AI model from GPT-4o-mini to GPT-4o' },
                { type: 'SECURITY_SETTING_CHANGE', description: 'Enabled 2FA requirement for all admin users' },
                { type: 'BILLING_UPDATE', description: 'Updated billing contact information' },
            ];

            for (let i = 0; i < auditEvents.length; i++) {
                const event = auditEvents[i];
                const actorId = userIds[i % userIds.length] || userIds[0];
                const hoursAgo = i * 4;
                await run(`
                    INSERT INTO audit_events (id, org_id, actor_user_id, action_type, metadata_json, ts)
                    VALUES (?, ?, ?, ?, ?, datetime('now', '-${hoursAgo} hours'))
                `, [uuidv4(), orgId, actorId, event.type, JSON.stringify({ description: event.description })]);
            }
            console.log(`  ✓ Created ${auditEvents.length} audit events`);
        } else {
            console.log('  ⚠ audit_events table not found, skipping...');
        }

        // 6. Create login history
        console.log('\n🔐 Creating login history...');
        const loginHistoryExists = await get("SELECT name FROM sqlite_master WHERE type='table' AND name='login_history'");
        
        if (loginHistoryExists) {
            // Clear and add new login history
            await run('DELETE FROM login_history WHERE organization_id = ?', [orgId]);

            const loginEntries = [
                { userIdx: 0, ip: '192.168.1.100', location: 'Warsaw, Poland', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
                { userIdx: 1, ip: '10.0.0.45', location: 'Krakow, Poland', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                { userIdx: 0, ip: '192.168.1.100', location: 'Warsaw, Poland', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)' },
                { userIdx: 2, ip: '203.0.113.50', location: 'Gdansk, Poland', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
                { userIdx: 0, ip: '192.168.1.105', location: 'Warsaw, Poland', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                { userIdx: 1, ip: '198.51.100.25', location: 'Wroclaw, Poland', ua: 'Mozilla/5.0 (X11; Linux x86_64)' },
            ];

            for (let i = 0; i < loginEntries.length; i++) {
                const entry = loginEntries[i];
                if (userIds[entry.userIdx]) {
                    const hoursAgo = i * 6;
                    await run(`
                        INSERT INTO login_history (id, user_id, organization_id, ip_address, user_agent, location, status, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, 'success', datetime('now', '-${hoursAgo} hours'))
                    `, [uuidv4(), userIds[entry.userIdx], orgId, entry.ip, entry.ua, entry.location]);
                }
            }
            console.log(`  ✓ Created ${loginEntries.length} login history entries`);
        } else {
            console.log('  ⚠ login_history table not found, skipping...');
        }

        // 7. Create active sessions
        console.log('\n💻 Creating active sessions...');
        const sessionsTableExists = await get("SELECT name FROM sqlite_master WHERE type='table' AND name='user_sessions'");
        
        if (sessionsTableExists) {
            // Clear old sessions for users in this org
            await run('DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE organization_id = ?)', [orgId]);

            const sessions = [
                { userIdx: 0, device: 'MacBook Pro 16"', location: 'Warsaw, Poland', isCurrent: 1, ip: '192.168.1.100' },
                { userIdx: 0, device: 'iPhone 15 Pro', location: 'Warsaw, Poland', isCurrent: 0, ip: '192.168.1.105' },
                { userIdx: 1, device: 'Dell XPS 15', location: 'Krakow, Poland', isCurrent: 1, ip: '10.0.0.45' },
            ];

            for (const session of sessions) {
                if (userIds[session.userIdx]) {
                    await run(`
                        INSERT INTO user_sessions (id, user_id, device_info, location, ip_address, is_current, last_active_at, expires_at, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-30 minutes'), datetime('now', '+7 days'), datetime('now', '-2 days'))
                    `, [uuidv4(), userIds[session.userIdx], session.device, session.location, session.ip, session.isCurrent]);
                }
            }
            console.log(`  ✓ Created ${sessions.length} active sessions`);
        } else {
            console.log('  ⚠ user_sessions table not found, skipping...');
        }

        // 8. Update billing data
        console.log('\n💰 Updating billing data...');
        const billingExists = await get('SELECT * FROM organization_billing WHERE organization_id = ?', [orgId]);
        
        if (!billingExists) {
            await run(`
                INSERT INTO organization_billing 
                (id, organization_id, billing_email, billing_address, status, current_period_start, current_period_end, payment_method_last4, payment_method_brand)
                VALUES (?, ?, 'billing@dbr77.com', ?, 'active', date('now', '-1 month'), date('now', '+1 month'), '4242', 'visa')
            `, [uuidv4(), orgId, JSON.stringify({ line1: 'ul. Technologiczna 15', city: 'Warsaw', postalCode: '00-001', country: 'Poland' })]);
            console.log('  ✓ Created billing record');
        } else {
            await run(`
                UPDATE organization_billing 
                SET billing_email = 'billing@dbr77.com',
                    billing_address = ?,
                    payment_method_last4 = '4242',
                    payment_method_brand = 'visa',
                    status = 'active',
                    updated_at = datetime('now')
                WHERE organization_id = ?
            `, [JSON.stringify({ line1: 'ul. Technologiczna 15', city: 'Warsaw', postalCode: '00-001', country: 'Poland' }), orgId]);
            console.log('  ✓ Updated billing record');
        }

        // 9. Create invoices
        console.log('\n🧾 Creating invoices...');
        const invoicesTableExists = await get("SELECT name FROM sqlite_master WHERE type='table' AND name='invoices'");
        
        if (invoicesTableExists) {
            // Clear old invoices
            await run('DELETE FROM invoices WHERE organization_id = ?', [orgId]);

            const invoices = [
                { amount: 299.00, status: 'paid', monthsAgo: 0 },
                { amount: 299.00, status: 'paid', monthsAgo: 1 },
                { amount: 299.00, status: 'paid', monthsAgo: 2 },
                { amount: 299.00, status: 'paid', monthsAgo: 3 },
            ];

            for (let i = 0; i < invoices.length; i++) {
                const inv = invoices[i];
                await run(`
                    INSERT INTO invoices (id, organization_id, amount_due, amount_paid, status, period_start, period_end, pdf_url, created_at)
                    VALUES (?, ?, ?, ?, ?, date('now', '-${inv.monthsAgo} months', 'start of month'), date('now', '-${inv.monthsAgo} months', 'start of month', '+1 month', '-1 day'), ?, datetime('now', '-${inv.monthsAgo} months'))
                `, [uuidv4(), orgId, inv.amount, inv.amount, inv.status, `https://pay.stripe.com/invoice/INV-2026-00${i + 1}`]);
            }
            console.log(`  ✓ Created ${invoices.length} invoices`);
        } else {
            console.log('  ⚠ invoices table not found, skipping...');
        }

        // 10. Create compliance reports
        console.log('\n📋 Creating compliance reports...');
        await run(`
            CREATE TABLE IF NOT EXISTS compliance_reports (
                id TEXT PRIMARY KEY,
                organization_id TEXT,
                name TEXT,
                standard TEXT,
                status TEXT DEFAULT 'compliant',
                findings_count INTEGER DEFAULT 0,
                report_data TEXT,
                generated_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (organization_id) REFERENCES organizations(id)
            )
        `);

        // Clear old reports
        await run('DELETE FROM compliance_reports WHERE organization_id = ?', [orgId]);

        const complianceReports = [
            { name: 'AI Audit Trail Compliance', standard: 'ISO21500', status: 'compliant', findings: 0 },
            { name: 'Performance Monitoring Assessment', standard: 'PMBOK7', status: 'compliant', findings: 0 },
            { name: 'Progress Theme Compliance', standard: 'PRINCE2', status: 'partial', findings: 2 },
            { name: 'Data Protection Assessment', standard: 'GDPR', status: 'compliant', findings: 0 },
            { name: 'Security Controls Audit', standard: 'SOC2', status: 'compliant', findings: 1 },
        ];

        for (let i = 0; i < complianceReports.length; i++) {
            const report = complianceReports[i];
            const daysAgo = i * 5;
            await run(`
                INSERT INTO compliance_reports (id, organization_id, name, standard, status, findings_count, generated_at)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-${daysAgo} days'))
            `, [uuidv4(), orgId, report.name, report.standard, report.status, report.findings]);
        }
        console.log(`  ✓ Created ${complianceReports.length} compliance reports`);

        // 11. Update organization profile
        console.log('\n🏢 Updating organization profile...');
        const profileExists = await get('SELECT * FROM organization_profiles WHERE organization_id = ?', [orgId]);
        if (!profileExists) {
            await run(`
                INSERT INTO organization_profiles (id, organization_id, industry, company_size, employee_count, headquarters_country, 
                    mission_statement, vision_statement, digital_maturity_overall, growth_stage, profile_completeness)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                uuidv4(), 
                orgId, 
                'Technology',
                '51-200',
                120,
                'Poland',
                'DBR77 Digital Solutions delivers cutting-edge digital transformation services, empowering enterprises with AI-powered solutions and cloud-native architectures.',
                'To be the leading provider of AI-driven enterprise solutions in Central and Eastern Europe.',
                3.5,
                'SCALE',
                0.85
            ]);
            console.log('  ✓ Created organization profile');
        } else {
            await run(`
                UPDATE organization_profiles SET 
                    industry = 'Technology',
                    company_size = '51-200',
                    employee_count = 120,
                    headquarters_country = 'Poland',
                    mission_statement = 'DBR77 Digital Solutions delivers cutting-edge digital transformation services, empowering enterprises with AI-powered solutions and cloud-native architectures.',
                    vision_statement = 'To be the leading provider of AI-driven enterprise solutions in Central and Eastern Europe.',
                    digital_maturity_overall = 3.5,
                    growth_stage = 'SCALE',
                    profile_completeness = 0.85,
                    updated_at = datetime('now')
                WHERE organization_id = ?
            `, [orgId]);
            console.log('  ✓ Updated organization profile');
        }

        // 12. Create ownership data
        console.log('\n👑 Creating ownership data...');
        await run(`
            CREATE TABLE IF NOT EXISTS organization_ownership (
                id TEXT PRIMARY KEY,
                organization_id TEXT UNIQUE,
                owner_user_id TEXT,
                billing_email TEXT,
                billing_name TEXT,
                tax_id TEXT,
                vat_number TEXT,
                billing_address TEXT,
                status TEXT DEFAULT 'ACTIVE',
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (organization_id) REFERENCES organizations(id),
                FOREIGN KEY (owner_user_id) REFERENCES users(id)
            )
        `);

        // Find owner user
        const ownerUser = existingUsers.find(u => u.role === 'ADMIN' || u.is_owner === 1) || existingUsers[0];
        
        await run(`
            INSERT OR REPLACE INTO organization_ownership 
            (id, organization_id, owner_user_id, billing_email, billing_name, tax_id, vat_number, billing_address, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
        `, [
            uuidv4(), 
            orgId, 
            ownerUser?.id, 
            'billing@dbr77.com', 
            `${ownerUser?.first_name || 'Admin'} ${ownerUser?.last_name || 'DBR77'}`,
            'PL1234567890',
            'EU1234567890',
            JSON.stringify({ line1: 'ul. Technologiczna 15', line2: 'Piętro 3', city: 'Warsaw', postalCode: '00-001', country: 'Poland' })
        ]);
        console.log('  ✓ Created/updated ownership record');

        // 13. Update payment methods
        console.log('\n💳 Creating payment methods...');
        await run(`
            CREATE TABLE IF NOT EXISTS payment_methods (
                id TEXT PRIMARY KEY,
                organization_id TEXT,
                type TEXT DEFAULT 'card',
                last_four TEXT,
                brand TEXT,
                exp_month INTEGER,
                exp_year INTEGER,
                is_default INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (organization_id) REFERENCES organizations(id)
            )
        `);

        const existingMethod = await get('SELECT * FROM payment_methods WHERE organization_id = ?', [orgId]);
        if (!existingMethod) {
            await run(`
                INSERT INTO payment_methods (id, organization_id, type, last_four, brand, exp_month, exp_year, is_default, created_at)
                VALUES (?, ?, 'card', '4242', 'visa', 12, 2026, 1, datetime('now'))
            `, [uuidv4(), orgId]);
            console.log('  ✓ Created payment method');
        } else {
            console.log('  ⊛ Payment method already exists');
        }

        // 14. Create user groups
        console.log('\n👥 Creating user groups...');
        await run(`
            CREATE TABLE IF NOT EXISTS user_groups (
                id TEXT PRIMARY KEY,
                organization_id TEXT,
                name TEXT,
                description TEXT,
                color TEXT DEFAULT '#8B5CF6',
                members_count INTEGER DEFAULT 0,
                permissions TEXT DEFAULT '[]',
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (organization_id) REFERENCES organizations(id)
            )
        `);

        const existingGroups = await all('SELECT * FROM user_groups WHERE organization_id = ?', [orgId]);
        if (existingGroups.length === 0) {
            const groups = [
                { name: 'Engineering Team', description: 'Software developers and architects', color: '#3B82F6', members: 4 },
                { name: 'Product Management', description: 'Product managers and owners', color: '#10B981', members: 2 },
                { name: 'Leadership', description: 'C-level and department heads', color: '#8B5CF6', members: 2 },
            ];

            for (const group of groups) {
                await run(`
                    INSERT INTO user_groups (id, organization_id, name, description, color, members_count)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [uuidv4(), orgId, group.name, group.description, group.color, group.members]);
            }
            console.log(`  ✓ Created ${groups.length} user groups`);
        } else {
            console.log(`  ⊛ ${existingGroups.length} groups already exist`);
        }

        // 15. Create custom templates for compliance
        console.log('\n📑 Creating custom compliance templates...');
        await run(`
            CREATE TABLE IF NOT EXISTS custom_compliance_templates (
                id TEXT PRIMARY KEY,
                organization_id TEXT,
                name TEXT,
                description TEXT,
                based_on TEXT,
                sections_count INTEGER DEFAULT 0,
                checkpoints_count INTEGER DEFAULT 0,
                template_data TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (organization_id) REFERENCES organizations(id)
            )
        `);

        await run('DELETE FROM custom_compliance_templates WHERE organization_id = ?', [orgId]);

        const templates = [
            { name: 'DBR77 AI Governance Framework', description: 'Organization-specific AI governance based on ISO 21500', basedOn: 'ISO21500', sections: 4, checkpoints: 12 },
            { name: 'Data Privacy Compliance', description: 'Extended GDPR framework with AI-specific controls', basedOn: 'GDPR', sections: 5, checkpoints: 18 },
        ];

        for (const template of templates) {
            await run(`
                INSERT INTO custom_compliance_templates (id, organization_id, name, description, based_on, sections_count, checkpoints_count)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [uuidv4(), orgId, template.name, template.description, template.basedOn, template.sections, template.checkpoints]);
        }
        console.log(`  ✓ Created ${templates.length} custom compliance templates`);

        console.log('\n✅ DBR77 data seed completed successfully!\n');
        console.log('📊 Summary:');
        console.log(`   • Organization: ${org.name} (${orgId})`);
        console.log(`   • Users: ${existingUsers.length}`);
        console.log(`   • Security events: 6`);
        console.log(`   • Audit events: 10`);
        console.log(`   • Login history entries: 6`);
        console.log(`   • Active sessions: 3`);
        console.log(`   • Invoices: 4`);
        console.log(`   • Compliance reports: 5`);
        console.log(`   • User groups: 3`);
        console.log(`   • Custom templates: 2`);

    } catch (error) {
        console.error('❌ Error seeding data:', error);
        throw error;
    } finally {
        db.close();
    }
}

// Run the seed
seedDBR77Data();
