const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, '../consultinity.db');
const db = new sqlite3.Database(dbPath);

const email = 'piotr.wisniewski@dbr77.com';
const password = '123456';

console.log(`Testing login for ${email} with password '${password}'...`);

db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err) {
        console.error('DB Error:', err);
        return;
    }
    if (!user) {
        console.error('User not found!');
        return;
    }
    console.log('User found:', user.email, 'ID:', user.id);
    console.log('Stored Hash:', user.password);

    const isValid = bcrypt.compareSync(password, user.password);
    console.log('Password valid:', isValid);

    if (isValid) {
        console.log('SUCCESS: Credentials are correct.');
    } else {
        console.log('FAILURE: Password mismatch.');
        // Re-hash to see what it should be
        const newHash = bcrypt.hashSync(password, 10);
        console.log('Expected hash for 123456 should look like:', newHash);
    }

    // Check Organization
    db.get('SELECT * FROM organizations WHERE id = ?', [user.organization_id], (err, org) => {
        if (err) console.error(err);
        console.log('Organization:', org ? `${org.name} (${org.status})` : 'NOT FOUND');

        db.close();
    });
});
