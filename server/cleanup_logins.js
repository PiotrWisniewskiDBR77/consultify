const sqlite3 = require('sqlite3').verbose();
import path from 'path';
import bcrypt from 'bcryptjs';

const dbPath = path.resolve(__dirname, 'consultify.db');
const db = new sqlite3.Database(dbPath);

const passwordHash = bcrypt.hashSync('123456', 8);

console.log('🚀 Starting login cleanup...');

db.serialize(() => {
    // 1. Rename Piotr's email (to match his typo/preferred login) and set role/password
    // First check if target email already exists to avoid unique constraint error
    db.get(`SELECT id FROM users WHERE email = ?`, ['piotr.wisneiwski@dbr77.com'], (err, row) => {
        if (row) {
            console.log('ℹ️ piotr.wisneiwski@dbr77.com already exists, updating role/password...');
            db.run(`UPDATE users SET role = 'ADMIN', password = ?, status = 'active' WHERE email = ?`,
                [passwordHash, 'piotr.wisneiwski@dbr77.com'], function (err) {
                    if (err) console.error('❌ Error updating Piotr:', err);
                    else console.log('✅ Updated existing piotr.wisneiwski@dbr77.com');
                });
        } else {
            console.log('🔄 Renaming piotr.wisniewski@dbr77.com to piotr.wisneiwski@dbr77.com...');
            db.run(`UPDATE users SET email = ?, role = 'ADMIN', password = ?, status = 'active' WHERE email = ?`,
                ['piotr.wisneiwski@dbr77.com', passwordHash, 'piotr.wisniewski@dbr77.com'], function (err) {
                    if (err) console.error('❌ Error renaming/updating Piotr:', err);
                    else if (this.changes === 0) {
                        console.log('⚠️ Could not find piotr.wisniewski@dbr77.com to rename.');
                    } else {
                        console.log('✅ Successfully renamed and updated Piotr.');
                    }
                });
        }
    });

    // 2. Update admin@dbr77.com to SUPERADMIN and set password
    db.run(`UPDATE users SET role = 'SUPERADMIN', password = ?, status = 'active' WHERE email = ?`,
        [passwordHash, 'admin@dbr77.com'], function (err) {
            if (err) console.error('❌ Error updating admin role:', err);
            else if (this.changes === 0) {
                console.log('⚠️ admin@dbr77.com not found.');
            } else {
                console.log('✅ admin@dbr77.com is now SUPERADMIN with password 123456');
            }
        });
});

setTimeout(() => {
    db.close();
    console.log('🏁 Cleanup script finished.');
}, 2000);
