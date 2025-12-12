const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'consultify.db');
const db = new sqlite3.Database(dbPath);

console.log('Inspecting users table schema...');
db.all("PRAGMA table_info(users)", (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.log(rows);
    }
    db.close();
});
