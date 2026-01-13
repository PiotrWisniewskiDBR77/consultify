/**
 * Migration: Add profile fields and permission_requests table
 * 
 * New columns in users:
 * - job_title
 * - linked_accounts (JSON)
 * 
 * New table: permission_requests
 */

import { getDatabase } from '../src/database/Database.js';
const db = getDatabase();

const MIGRATION_NAME = '20260101_add_profile_fields_and_permission_requests';

async function up() {
    return new Promise((resolve, reject) => {
        console.log(`[Migration] Running ${MIGRATION_NAME}...`);

        db.serialize(() => {
            // Add job_title column to users
            db.run(`ALTER TABLE users ADD COLUMN job_title TEXT`, (err) => {
                if (err && !err.message.includes('duplicate column')) {
                    console.log('[Migration] job_title column may already exist:', err.message);
                } else {
                    console.log('[Migration] Added job_title column to users');
                }
            });

            // Add linked_accounts column to users (JSON for Google/LinkedIn connections)
            db.run(`ALTER TABLE users ADD COLUMN linked_accounts TEXT DEFAULT '{}'`, (err) => {
                if (err && !err.message.includes('duplicate column')) {
                    console.log('[Migration] linked_accounts column may already exist:', err.message);
                } else {
                    console.log('[Migration] Added linked_accounts column to users');
                }
            });

            // Create permission_requests table
            db.run(`
                CREATE TABLE IF NOT EXISTS permission_requests (
                    id TEXT PRIMARY KEY,
                    organization_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    request_type TEXT NOT NULL,
                    current_value TEXT,
                    requested_value TEXT,
                    justification TEXT,
                    status TEXT DEFAULT 'PENDING',
                    priority TEXT DEFAULT 'NORMAL',
                    reviewed_by TEXT,
                    reviewed_at DATETIME,
                    admin_notes TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY(reviewed_by) REFERENCES users(id) ON DELETE SET NULL
                )
            `, (err) => {
                if (err) {
                    console.error('[Migration] Error creating permission_requests table:', err.message);
                } else {
                    console.log('[Migration] Created permission_requests table');
                }
            });

            // Create index for faster queries
            db.run(`CREATE INDEX IF NOT EXISTS idx_permission_requests_user ON permission_requests(user_id)`, (err) => {
                if (err) {
                    console.log('[Migration] Index may already exist:', err.message);
                }
            });

            db.run(`CREATE INDEX IF NOT EXISTS idx_permission_requests_org ON permission_requests(organization_id)`, (err) => {
                if (err) {
                    console.log('[Migration] Index may already exist:', err.message);
                }
            });

            db.run(`CREATE INDEX IF NOT EXISTS idx_permission_requests_status ON permission_requests(status)`, (err) => {
                if (err) {
                    console.log('[Migration] Index may already exist:', err.message);
                }
                resolve();
            });
        });
    });
}

async function down() {
    return new Promise((resolve, reject) => {
        console.log(`[Migration] Rolling back ${MIGRATION_NAME}...`);
        
        // Note: SQLite doesn't support DROP COLUMN easily
        // We would need to recreate the table without these columns
        // For now, we'll just drop the new table
        
        db.run(`DROP TABLE IF EXISTS permission_requests`, (err) => {
            if (err) {
                console.error('[Migration] Error dropping permission_requests:', err.message);
                reject(err);
            } else {
                console.log('[Migration] Dropped permission_requests table');
                resolve();
            }
        });
    });
}

// Auto-run if called directly
if (require.main === module) {
    up()
        .then(() => {
            console.log(`[Migration] ${MIGRATION_NAME} completed successfully`);
            process.exit(0);
        })
        .catch((err) => {
            console.error(`[Migration] ${MIGRATION_NAME} failed:`, err);
            process.exit(1);
        });
}

export {
up, down, MIGRATION_NAME
};

export default { up, down, MIGRATION_NAME };














