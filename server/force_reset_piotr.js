const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'consultify.db');
const db = new sqlite3.Database(dbPath);

const passwordStr = '123456';
const passwordHash = bcrypt.hashSync(passwordStr, 8);
const EMAIL = 'piotr.wisniewski@dbr77.com';

console.log('🔥 FORCING RESET for:', EMAIL);

db.serialize(() => {
    // 1. Check if user exists
    db.get('SELECT id, email, password FROM users WHERE email = ?', [EMAIL], (err, row) => {
        if (err) {
            console.error('❌ Error finding user:', err);
            return;
        }
        if (!row) {
            console.error('❌ User NOT found:', EMAIL);
            return;
        }
        console.log('✅ Found user:', row.id);

        // 2. Update password
        db.run('UPDATE users SET password = ?, status = "active" WHERE id = ?', [passwordHash, row.id], function (err) {
            if (err) console.error('❌ Error updating password:', err);
            else {
                console.log(`✅ Updated password for ${row.id}. Hash: ${passwordHash}`);

                // 3. Verify immediately
                db.get('SELECT password FROM users WHERE id = ?', [row.id], (err3, row3) => {
                    const verified = bcrypt.compareSync(passwordStr, row3.password);
                    console.log('🔍 Post-update verification:', verified ? 'PASS' : 'FAIL');
                });
            }
        });

        // 4. Clear sessions to be safe
        db.run('DELETE FROM sessions WHERE user_id = ?', [row.id], function (err) {
            if (!err) console.log(`✅ Cleared ${this.changes} sessions`);
        });
    });
});

setTimeout(() => {
    db.close();
    console.log('🏁 Force reset finished.');
}, 2000);
