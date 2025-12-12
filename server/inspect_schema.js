const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'consultify.db');
const db = new sqlite3.Database(dbPath);

console.log('Inspecting sessions table schema...');
db.get("PRAGMA table_info(sessions)", (err, row) => {
    // PRAGMA table_info returns one row per column, but db.get only returns the first one.
    // Use db.all
});

db.all("PRAGMA table_info(sessions)", (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.log(rows);
    }
    db.close();
});
