const sqlite3 = require('sqlite3').verbose();
import path from 'path';
const dbPath = path.resolve(__dirname, 'consultify.db');
const db = new sqlite3.Database(dbPath);

db.all('SELECT email, role FROM users', [], (err, rows) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log('Current Users:');
    console.table(rows);
    db.close();
});
