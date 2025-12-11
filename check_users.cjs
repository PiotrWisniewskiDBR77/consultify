const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'server/consultify.db');
const db = new sqlite3.Database(dbPath);

const emails = [
    'admin@dbr77.com',
    'piotr.wisniewski@dbr77.com',
    'justyna.laskowska@dbr77.com'
];

db.all(`SELECT email, role, password FROM users WHERE email IN (?, ?, ?)`, emails, (err, rows) => {
    if (err) {
        console.error("Error querying database:", err);
        return;
    }
    console.log("Found users:", rows);
    if (rows.length === 0) {
        console.log("No users found.");
    }
});
