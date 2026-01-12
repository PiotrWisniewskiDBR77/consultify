/**
 * Seed Script for Enterprise Customers Module
 * Populates test data for all new tables
 */

import { getDatabase } from '../database/Database.js';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';

async function seedEnterpriseCustomers() {
    console.log('🌱 Seeding Enterprise Customers Module...');

    try {
        // Wait for database initialization - use a longer delay to ensure tables are created
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Get existing organizations and users
        const organizations = await new Promise((resolve, reject) => {
            db.all('SELECT id, name FROM organizations LIMIT 10', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        const users = await new Promise((resolve, reject) => {
            db.all('SELECT id, organization_id, email FROM users LIMIT 20', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        if (organizations.length === 0 || users.length === 0) {
            console.log('⚠️  No organizations or users found. Skipping seed.');
            return;
        }

        const org = organizations[0];
        const user = users[0];

        // 1. Organization Metadata
        console.log('  📝 Seeding organization metadata...');
        for (let i = 0; i < 5; i++) {
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT OR IGNORE INTO organization_metadata 
                     (id, organization_id, key, value, value_type, category)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [uuidv4(), org.id, `custom_field_${i}`, `Value ${i}`, 'string', 'general'],
                    (err) => err ? reject(err) : resolve()
                );
            });
        }

        // 2. Organization Tags
        console.log('  🏷️  Seeding organization tags...');
        const tags = ['enterprise', 'trial', 'active', 'premium', 'partner'];
        for (const tag of tags) {
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT OR IGNORE INTO organization_tags 
                     (id, organization_id, tag, color, category)
                     VALUES (?, ?, ?, ?, ?)`,
                    [uuidv4(), org.id, tag, '#8B5CF6', 'status'],
                    (err) => err ? reject(err) : resolve()
                );
            });
        }

        // 3. Organization Health Scores
        console.log('  💚 Seeding organization health scores...');
        const today = new Date().toISOString().split('T')[0];
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT OR IGNORE INTO organization_health_scores 
                 (id, organization_id, score_date, overall_score, engagement_score, adoption_score, 
                  support_score, technical_score, billing_score, churn_risk, health_trend)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [uuidv4(), org.id, today, 85, 90, 80, 85, 90, 100, 15, 'improving'],
                (err) => err ? reject(err) : resolve()
            );
        });

        // 4. User Profiles
        console.log('  👤 Seeding user profiles...');
        for (const u of users.slice(0, 5)) {
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT OR IGNORE INTO user_profiles 
                     (id, user_id, job_title, department, timezone, locale)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [uuidv4(), u.id, 'Manager', 'Engineering', 'UTC', 'en'],
                    (err) => err ? reject(err) : resolve()
                );
            });
        }

        // 5. User Sessions
        console.log('  🔐 Seeding user sessions...');
        for (const u of users.slice(0, 3)) {
            await new Promise((resolve, reject) => {
                const expiresAt = new Date();
                expiresAt.setHours(expiresAt.getHours() + 24);
                db.run(
                    `INSERT OR IGNORE INTO user_sessions 
                     (id, user_id, organization_id, session_token, ip_address, user_agent, device_type, expires_at, is_active)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [uuidv4(), u.id, u.organization_id, uuidv4(), '192.168.1.1', 'Mozilla/5.0', 'desktop', expiresAt.toISOString(), 1],
                    (err) => err ? reject(err) : resolve()
                );
            });
        }

        // 6. Support Tickets
        console.log('  🎫 Seeding support tickets...');
        for (let i = 0; i < 5; i++) {
            await new Promise((resolve, reject) => {
                const ticketNumber = `TKT-${Date.now()}-${i}`;
                db.run(
                    `INSERT OR IGNORE INTO support_tickets 
                     (id, organization_id, user_id, ticket_number, subject, description, priority, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [uuidv4(), org.id, user.id, ticketNumber, `Support Ticket ${i}`, `Description for ticket ${i}`, 'medium', 'open'],
                    (err) => err ? reject(err) : resolve()
                );
            });
        }

        // 7. Feedback Items
        console.log('  💬 Seeding feedback items...');
        for (let i = 0; i < 5; i++) {
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT OR IGNORE INTO feedback_items 
                     (id, organization_id, user_id, feedback_type, title, description, priority, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [uuidv4(), org.id, user.id, 'feature_request', `Feature Request ${i}`, `Description ${i}`, 'medium', 'new'],
                    (err) => err ? reject(err) : resolve()
                );
            });
        }

        // 8. Security Events
        console.log('  🛡️  Seeding security events...');
        const eventTypes = ['failed_login', 'suspicious_activity', 'data_export'];
        for (let i = 0; i < 5; i++) {
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT OR IGNORE INTO security_events 
                     (id, organization_id, user_id, event_type, severity, ip_address)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [uuidv4(), org.id, user.id, eventTypes[i % eventTypes.length], 'medium', '192.168.1.1'],
                    (err) => err ? reject(err) : resolve()
                );
            });
        }

        // 9. IP Whitelist
        console.log('  🌐 Seeding IP whitelist...');
        const ips = ['192.168.1.0/24', '10.0.0.1', '172.16.0.1'];
        for (const ip of ips) {
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT OR IGNORE INTO organization_ip_whitelist 
                     (id, organization_id, ip_address, description)
                     VALUES (?, ?, ?, ?)`,
                    [uuidv4(), org.id, ip, `Office network ${ip}`],
                    (err) => err ? reject(err) : resolve()
                );
            });
        }

        // 10. Email Templates
        console.log('  📧 Seeding email templates...');
        const templates = [
            { key: 'welcome', name: 'Welcome Email', subject: 'Welcome to Consultify', category: 'onboarding' },
            { key: 'password_reset', name: 'Password Reset', subject: 'Reset Your Password', category: 'security' }
        ];
        for (const template of templates) {
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT OR IGNORE INTO email_templates 
                     (id, template_key, name, subject, body_html, body_text, category)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [uuidv4(), template.key, template.name, template.subject, '<p>Email body</p>', 'Email body', template.category],
                    (err) => err ? reject(err) : resolve()
                );
            });
        }

        console.log('✅ Enterprise Customers Module seeded successfully!');
    } catch (error) {
        console.error('❌ Error seeding Enterprise Customers Module:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    seedEnterpriseCustomers()
        .then(() => {
            console.log('Seed completed');
            process.exit(0);
        })
        .catch((err) => {
            console.error('Seed failed:', err);
            process.exit(1);
        });
}

export {
seedEnterpriseCustomers
};

export default { seedEnterpriseCustomers };

