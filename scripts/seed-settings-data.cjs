/**
 * Seed Settings Data Script
 * 
 * Creates sample data for all settings-related tables
 * Run with: node scripts/seed-settings-data.cjs
 */

const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '..', 'server', 'consultify.db');
console.log('Database path:', DB_PATH);
const db = new sqlite3.Database(DB_PATH);

// Helper for promises
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
    });
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
    });
});

async function seedSettings() {
    console.log('🌱 Starting Settings Module seed...\n');

    try {
        // Get first user for seeding
        const user = await dbGet('SELECT id, email, organization_id FROM users LIMIT 1');
        
        if (!user) {
            console.log('❌ No users found. Please create a user first.');
            return;
        }

        console.log(`📦 Seeding data for user: ${user.email}\n`);
        const userId = user.id;
        const orgId = user.organization_id;

        // ==========================================
        // 1. SECURITY EVENTS
        // ==========================================
        console.log('🔐 Seeding security_events...');
        
        const securityEvents = [
            {
                type: 'login',
                severity: 'info',
                title: 'Successful Login',
                description: 'Logged in from Chrome on MacOS',
                ip: '192.168.1.100',
                location: 'Warsaw, Poland',
                device: 'Chrome 120 / MacOS Sonoma'
            },
            {
                type: 'mfa',
                severity: 'info',
                title: 'MFA Verification Successful',
                description: 'Two-factor authentication verified using authenticator app',
                ip: '192.168.1.100',
                location: 'Warsaw, Poland'
            },
            {
                type: 'security',
                severity: 'info',
                title: 'Password Changed',
                description: 'Account password was updated successfully',
                ip: '192.168.1.100'
            },
            {
                type: 'login',
                severity: 'warning',
                title: 'New Device Login',
                description: 'Login detected from a new device',
                ip: '10.0.0.50',
                location: 'Krakow, Poland',
                device: 'Firefox 121 / Windows 11'
            },
            {
                type: 'suspicious',
                severity: 'critical',
                title: 'Multiple Failed Login Attempts',
                description: 'Several failed login attempts detected and blocked',
                ip: '203.0.113.50',
                location: 'Unknown Location',
                metadata: JSON.stringify({ attempts: 5, blocked: true })
            },
            {
                type: 'data',
                severity: 'info',
                title: 'Data Export Requested',
                description: 'GDPR compliant data export initiated',
                ip: '192.168.1.100'
            },
            {
                type: 'mfa',
                severity: 'info',
                title: 'MFA Enabled',
                description: 'Two-factor authentication enabled on account',
                ip: '192.168.1.100'
            },
            {
                type: 'login',
                severity: 'info',
                title: 'Session Expired',
                description: 'Session automatically expired due to 30 days of inactivity',
                ip: '192.168.1.100'
            }
        ];

        for (let i = 0; i < securityEvents.length; i++) {
            const event = securityEvents[i];
            const hoursAgo = i * 24 + Math.floor(Math.random() * 24);
            
            await dbRun(`
                INSERT INTO security_events (id, user_id, type, severity, title, description, ip_address, location, device, metadata, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-${hoursAgo} hours'))
            `, [uuidv4(), userId, event.type, event.severity, event.title, event.description, event.ip, event.location, event.device, event.metadata]);
        }
        console.log(`   ✅ Created ${securityEvents.length} security events`);

        // ==========================================
        // 2. USER SECURITY ALERTS
        // ==========================================
        console.log('🔔 Seeding user_security_alerts...');
        
        await dbRun(`
            INSERT OR REPLACE INTO user_security_alerts (user_id, email_suspicious_login, email_new_device, email_password_change, email_mfa_change, push_notifications, updated_at)
            VALUES (?, 1, 1, 1, 1, 1, datetime('now'))
        `, [userId]);
        console.log('   ✅ Created security alert settings');

        // ==========================================
        // 3. GDPR CONSENTS
        // ==========================================
        console.log('📋 Seeding user_gdpr_consents...');
        
        await dbRun(`
            INSERT OR REPLACE INTO user_gdpr_consents (user_id, analytics, personalization, marketing, third_party_sharing, ai_training, created_at, updated_at)
            VALUES (?, 1, 1, 0, 0, 1, datetime('now'), datetime('now'))
        `, [userId]);
        console.log('   ✅ Created GDPR consent settings');

        // ==========================================
        // 4. DATA RETENTION
        // ==========================================
        console.log('⏰ Seeding user_data_retention...');
        
        await dbRun(`
            INSERT OR REPLACE INTO user_data_retention (user_id, retention_period, auto_delete, updated_at)
            VALUES (?, '365', 0, datetime('now'))
        `, [userId]);
        console.log('   ✅ Created data retention settings');

        // ==========================================
        // 5. TRUSTED DEVICES
        // ==========================================
        console.log('📱 Seeding trusted_devices...');
        
        const trustedDevices = [
            {
                name: 'Chrome on MacOS',
                deviceType: 'desktop',
                browser: 'Chrome 120',
                os: 'macOS Sonoma',
                location: 'Warsaw, Poland',
                ip: '192.168.1.100',
                isCurrent: 1,
                daysAgo: 15
            },
            {
                name: 'Safari on iPhone',
                deviceType: 'mobile',
                browser: 'Safari 17',
                os: 'iOS 17.2',
                location: 'Warsaw, Poland',
                ip: '192.168.1.101',
                isCurrent: 0,
                daysAgo: 7
            },
            {
                name: 'Firefox on Windows',
                deviceType: 'laptop',
                browser: 'Firefox 121',
                os: 'Windows 11',
                location: 'Krakow, Poland',
                ip: '10.0.0.50',
                isCurrent: 0,
                daysAgo: 25
            }
        ];

        for (const device of trustedDevices) {
            const expiresInDays = 30 - device.daysAgo;
            await dbRun(`
                INSERT INTO trusted_devices (id, user_id, device_name, device_type, browser, os, location, ip_address, fingerprint, trusted_at, last_used, expires_at, is_current)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-${device.daysAgo} days'), datetime('now', '-${Math.floor(device.daysAgo/2)} days'), datetime('now', '+${expiresInDays} days'), ?)
            `, [uuidv4(), userId, device.name, device.deviceType, device.browser, device.os, device.location, device.ip, crypto.randomBytes(16).toString('hex'), device.isCurrent]);
        }
        console.log(`   ✅ Created ${trustedDevices.length} trusted devices`);

        // ==========================================
        // 6. CALENDAR INTEGRATIONS
        // ==========================================
        console.log('📅 Seeding user_calendar_integrations...');
        
        await dbRun(`
            INSERT OR REPLACE INTO user_calendar_integrations (id, user_id, provider, status, external_email, calendar_name, sync_tasks, sync_meetings, last_sync_at, created_at)
            VALUES (?, ?, 'google', 'active', 'user@gmail.com', 'Primary Calendar', 1, 1, datetime('now', '-2 hours'), datetime('now', '-30 days'))
        `, [uuidv4(), userId]);
        console.log('   ✅ Created Google Calendar integration');

        // ==========================================
        // 7. CALENDAR SETTINGS
        // ==========================================
        console.log('⚙️ Seeding user_calendar_settings...');
        
        await dbRun(`
            INSERT OR REPLACE INTO user_calendar_settings (user_id, sync_tasks, sync_meetings, updated_at)
            VALUES (?, 1, 1, datetime('now'))
        `, [userId]);
        console.log('   ✅ Created calendar settings');

        // ==========================================
        // 8. USER WEBHOOKS
        // ==========================================
        console.log('🔗 Seeding user_webhooks...');
        
        const webhooks = [
            {
                name: 'Task Notifications',
                url: 'https://api.example.com/webhooks/tasks',
                events: ['task.created', 'task.completed', 'task.updated'],
                isActive: 1
            },
            {
                name: 'Project Updates',
                url: 'https://hooks.slack.com/services/EXAMPLE',
                events: ['project.created', 'project.updated', 'initiative.created'],
                isActive: 1
            },
            {
                name: 'Assessment Reports',
                url: 'https://api.company.com/reports',
                events: ['assessment.completed', 'report.generated'],
                isActive: 0
            }
        ];

        for (const webhook of webhooks) {
            await dbRun(`
                INSERT INTO user_webhooks (id, user_id, organization_id, name, url, events, secret_key, is_active, last_triggered, last_status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-1 hour'), 'success', datetime('now', '-7 days'))
            `, [uuidv4(), userId, orgId, webhook.name, webhook.url, JSON.stringify(webhook.events), crypto.randomBytes(32).toString('hex'), webhook.isActive]);
        }
        console.log(`   ✅ Created ${webhooks.length} webhooks`);

        // ==========================================
        // 9. API KEYS (if organization exists)
        // ==========================================
        if (orgId) {
            console.log('🔑 Seeding api_keys...');
            
            const apiKeys = [
                {
                    name: 'Production API Key',
                    description: 'Main API key for production integrations',
                    scopes: ['read', 'write', 'projects', 'assessments'],
                    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
                },
                {
                    name: 'Analytics Read-Only',
                    description: 'Read-only access for analytics dashboard',
                    scopes: ['read', 'export'],
                    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
                },
                {
                    name: 'CI/CD Pipeline',
                    description: 'Automated deployment integration',
                    scopes: ['read', 'write', 'admin'],
                    expiresAt: null
                }
            ];

            for (const key of apiKeys) {
                const apiKey = 'ck_live_' + crypto.randomBytes(24).toString('hex');
                const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
                const keyPrefix = apiKey.substring(0, 12) + '...';
                
                await dbRun(`
                    INSERT INTO api_keys (id, organization_id, user_id, name, description, key_prefix, key_hash, scopes, expires_at, rate_limit_per_hour, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1000, datetime('now', '-${Math.floor(Math.random() * 30)} days'))
                `, [uuidv4(), orgId, userId, key.name, key.description, keyPrefix, keyHash, JSON.stringify(key.scopes), key.expiresAt]);
            }
            console.log(`   ✅ Created ${apiKeys.length} API keys`);
        }

        // ==========================================
        // 10. USER PRIVACY PREFERENCES
        // ==========================================
        console.log('🔒 Seeding user_privacy_preferences...');
        
        await dbRun(`
            INSERT OR REPLACE INTO user_privacy_preferences (user_id, show_online_status, activity_visibility, profile_visibility, allow_mentions, show_in_directory, share_activity_with_ai, updated_at)
            VALUES (?, 1, 'team', 'organization', 1, 1, 1, datetime('now'))
        `, [userId]);
        console.log('   ✅ Created privacy preferences');

        // ==========================================
        // 11. DATA EXPORT REQUEST (sample)
        // ==========================================
        console.log('📤 Seeding data_export_requests...');
        
        await dbRun(`
            INSERT INTO data_export_requests (id, user_id, status, requested_at, completed_at, expires_at, download_url)
            VALUES (?, ?, 'ready', datetime('now', '-2 days'), datetime('now', '-2 days'), datetime('now', '+5 days'), '/api/gdpr/download-export/${uuidv4()}')
        `, [uuidv4(), userId]);
        console.log('   ✅ Created sample data export request');

        console.log('\n✅ Settings seed completed successfully!');
        console.log('   All tables have been populated with English test data.\n');

    } catch (error) {
        console.error('❌ Seed error:', error);
        throw error;
    }
}

// Run migration first to ensure tables exist
async function runMigration() {
    console.log('📋 Running table creation...\n');
    const fs = require('fs');
    const migrationPath = path.join(__dirname, '..', 'server', 'migrations', '126_settings_complete_tables.sql');
    console.log('Migration path:', migrationPath);
    
    if (fs.existsSync(migrationPath)) {
        const migration = fs.readFileSync(migrationPath, 'utf8');
        const statements = migration.split(';').filter(s => s.trim());
        
        for (const statement of statements) {
            if (statement.trim()) {
                try {
                    await dbRun(statement);
                } catch (err) {
                    // Ignore "already exists" errors
                    if (!err.message.includes('already exists')) {
                        console.warn('   Warning:', err.message.substring(0, 50));
                    }
                }
            }
        }
        console.log('   ✅ Tables created/verified\n');
    }
}

// Main execution
async function main() {
    console.log('='.repeat(60));
    console.log(' SETTINGS MODULE - DATABASE SEEDER');
    console.log('='.repeat(60) + '\n');

    await runMigration();
    await seedSettings();

    db.close((err) => {
        if (err) console.error('Error closing database:', err);
        else console.log('Database connection closed.\n');
    });
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
