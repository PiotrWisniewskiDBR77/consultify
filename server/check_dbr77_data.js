const sqlite3 = require('sqlite3').verbose();
import path from 'path';

const dbPath = path.resolve(__dirname, 'consultify.db');
const db = new sqlite3.Database(dbPath);

const email = 'piotr.wisniewski@dbr77.com';

db.get('SELECT organization_id FROM users WHERE email = ?', [email], (err, row) => {
    if (err) {
        console.error(err);
        return;
    }
    if (!row) {
        console.log('User not found');
        return;
    }
    const orgId = row.organization_id;
    console.log('Org ID:', orgId);

    db.all('SELECT title, description FROM tasks WHERE organization_id = ?', [orgId], (err, rows) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log('Tasks:', rows);
    });

    db.all('SELECT name, description, summary FROM initiatives WHERE organization_id = ?', [orgId], (err, rows) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log('Initiatives:', rows);
    });
});
