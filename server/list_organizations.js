const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'consultify.db');
const db = new sqlite3.Database(dbPath);

db.all('SELECT id, name, plan FROM organizations', [], (err, rows) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log('Current Organizations:');
    console.table(rows);
    db.close();
});
