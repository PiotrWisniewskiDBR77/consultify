const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.resolve(__dirname, 'consultify.db');
const db = new sqlite3.Database(dbPath);

const passwordHash = bcrypt.hashSync('123456', 8);

// Target accounts
const DATA_ACCOUNT_ID = '8aa8bb78-b834-4dfd-8af2-c0b48e882e02'; // Has 11 projects and 24 tasks
const EMPTY_ACCOUNT_ID = 'user-dbr77-admin'; // Has 0 projects and 0 tasks, but correct email
const CORRECT_EMAIL = 'piotr.wisniewski@dbr77.com';

// Organization IDs
const DBR77_ORG_ID = '5adb0b59-3130-4f50-bae5-77a9bbc84d5d';
const DBR77_SYSTEM_ORG_ID = 'org-dbr77-test';

console.log('🚀 Starting Data Restoration and Account Consolidation...');

db.serialize(() => {
    // 1. Delete the empty account to free up the correct email address
    db.run(`DELETE FROM users WHERE id = ?`, [EMPTY_ACCOUNT_ID], function (err) {
        if (err) console.error('❌ Error deleting empty account:', err);
        else console.log(`✅ Deleted empty account ${EMPTY_ACCOUNT_ID}`);
    });

    // 2. Rename the data-rich account to the correct email and update password/status/role
    db.run(`UPDATE users SET email = ?, password = ?, status = 'active', role = 'ADMIN' WHERE id = ?`,
        [CORRECT_EMAIL, passwordHash, DATA_ACCOUNT_ID], function (err) {
            if (err) console.error('❌ Error renaming data account:', err);
            else if (this.changes === 0) {
                console.log('⚠️ Data account NOT found by ID. Attempting to find by typo email...');
                db.run(`UPDATE users SET email = ?, password = ?, status = 'active', role = 'ADMIN' WHERE email = 'piotr.wisneiwski@dbr77.com'`,
                    [CORRECT_EMAIL, passwordHash], function (err2) {
                        if (err2) console.error('❌ Error renaming by email:', err2);
                        else console.log('✅ Renamed data account via email typo');
                    });
            } else {
                console.log(`✅ Renamed data-rich account ${DATA_ACCOUNT_ID} to ${CORRECT_EMAIL}`);
            }
        }
    );

    // 3. Populate organization_members table for both orgs
    const memberships = [
        { org: DBR77_ORG_ID, role: 'ADMIN' },
        { org: DBR77_SYSTEM_ORG_ID, role: 'ADMIN' }
    ];

    memberships.forEach(m => {
        db.run(`INSERT OR IGNORE INTO organization_members (id, user_id, organization_id, role, status) VALUES (?, ?, ?, ?, 'ACTIVE')`,
            [uuidv4(), DATA_ACCOUNT_ID, m.org, m.role], function (err) {
                if (err) console.error(`❌ Error adding membership for ${m.org}:`, err);
                else console.log(`✅ Added ${CORRECT_EMAIL} to organization ${m.org}`);
            });
    });

    // 4. Update admin@dbr77.com to SUPERADMIN and ensure password is 123456
    db.run(`UPDATE users SET role = 'SUPERADMIN', password = ?, status = 'active' WHERE email = 'admin@dbr77.com'`,
        [passwordHash], function (err) {
            if (err) console.error('❌ Error updating admin@dbr77.com:', err);
            else console.log('✅ Verified admin@dbr77.com is SUPERADMIN with password 123456');
        });

    // 5. Add Admin to organizations too for visibility
    db.get(`SELECT id FROM users WHERE email = 'admin@dbr77.com'`, (err, admin) => {
        if (admin) {
            memberships.forEach(m => {
                db.run(`INSERT OR IGNORE INTO organization_members (id, user_id, organization_id, role, status) VALUES (?, ?, ?, ?, 'ACTIVE')`,
                    [uuidv4(), admin.id, m.org, 'SUPERADMIN'], function (err) {
                        if (err) console.error(`❌ Error adding admin membership for ${m.org}:`, err);
                        else console.log(`✅ Added admin@dbr77.com to organization ${m.org}`);
                    });
            });
        }
    });

    console.log('⏳ Finishing up...');
});

setTimeout(() => {
    db.close();
    console.log('🏁 Data restoration script finished.');
}, 3000);
