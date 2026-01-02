const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'consultify.db');
const db = new sqlite3.Database(dbPath);

console.log('User details with Org IDs:');
db.all('SELECT email, organization_id, role, first_name, last_name FROM users WHERE email LIKE "%@dbr77.com"', [], (err, rows) => {
    if (err) {
        console.error(err);
        return;
    }
    console.table(rows);
    db.close();
});
