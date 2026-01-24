const db = require('../database');

async function migrate() {
    console.log('🚀 Starting manual migration to fix invitations schema...');

    try {
        await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('PRAGMA foreign_keys=OFF');

                // 1. Create new table with flexible schema
                db.run(`CREATE TABLE IF NOT EXISTS invitations_new (
                    id TEXT PRIMARY KEY,
                    organization_id TEXT NOT NULL,
                    email TEXT NOT NULL,
                    role TEXT DEFAULT 'USER',
                    token TEXT UNIQUE,
                    token_hash TEXT UNIQUE,
                    status TEXT DEFAULT 'pending',
                    invited_by TEXT,
                    expires_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    accepted_at DATETIME,
                    invitation_type TEXT DEFAULT 'ORG',
                    project_id TEXT,
                    role_to_assign TEXT,
                    accepted_by_user_id TEXT,
                    metadata TEXT DEFAULT '{}',
                    resend_count INTEGER DEFAULT 0,
                    last_resent_at DATETIME,
                    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                    FOREIGN KEY(invited_by) REFERENCES users(id) ON DELETE SET NULL
                )`);

                // 2. Safely copy data
                db.all("PRAGMA table_info(invitations)", [], async (err, columns) => {
                    if (err) {
                        console.error('Failed to get table info', err);
                        return reject(err);
                    }

                    const existingColumns = columns.map(c => c.name);
                    const targetColumns = [
                        'id', 'organization_id', 'email', 'role', 'token', 'status',
                        'invited_by', 'expires_at', 'created_at', 'accepted_at'
                    ];

                    // Add enterprise columns if they exist
                    ['invitation_type', 'project_id', 'role_to_assign', 'accepted_by_user_id', 'metadata', 'resend_count', 'last_resent_at', 'token_hash'].forEach(col => {
                        if (existingColumns.includes(col)) targetColumns.push(col);
                    });

                    const colsStr = targetColumns.join(', ');
                    console.log(`Copying columns: ${colsStr}`);

                    db.run(`INSERT INTO invitations_new (${colsStr}) SELECT ${colsStr} FROM invitations`, (err) => {
                        if (err) {
                            console.error('Data copy failed', err);
                            return reject(err);
                        }

                        // 3. Swap tables
                        db.run('DROP TABLE invitations', (err) => {
                            if (err) return reject(err);

                            db.run('ALTER TABLE invitations_new RENAME TO invitations', (err) => {
                                if (err) return reject(err);

                                // 4. Recreate indices
                                db.run(`CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token)`);
                                db.run(`CREATE INDEX IF NOT EXISTS idx_invitations_token_hash ON invitations(token_hash)`);
                                db.run(`CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email)`);
                                db.run(`CREATE INDEX IF NOT EXISTS idx_invitations_org_status ON invitations(organization_id, status)`);
                                db.run(`CREATE INDEX IF NOT EXISTS idx_invitations_project ON invitations(project_id)`);

                                db.run('PRAGMA foreign_keys=ON', (err) => {
                                    if (err) return reject(err);
                                    console.log('✅ Migration COMPLETED successfully.');
                                    resolve();
                                });
                            });
                        });
                    });
                });
            });
        });
    } catch (error) {
        console.error('❌ Migration FAILED:', error);
    }

    process.exit(0);
}

migrate();
