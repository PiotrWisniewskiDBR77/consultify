const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'consultify.db');
const db = new sqlite3.Database(dbPath);

console.log('--- Final Database Verification ---');

db.get('SELECT name, plan FROM organizations WHERE id = "org-dbr77-test"', [], (err, row) => {
    if (err) console.error(err);
    else console.log('Organization:', row);
});

db.all('SELECT email, role, is_owner FROM users WHERE organization_id = "org-dbr77-test"', [], (err, rows) => {
    if (err) console.error(err);
    else {
        console.log('Users:');
        console.table(rows);
    }
    db.close();
});
