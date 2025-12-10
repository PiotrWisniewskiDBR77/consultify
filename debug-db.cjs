const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'server/consultify.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error(err.message);
        return;
    }
    console.log('Connected to database.');

    db.all("SELECT id, email, role FROM users", [], (err, rows) => {
        if (err) {
            console.error(err);
        } else {
            console.log("Users:", rows);
        }
    });

    db.all("SELECT id, name FROM organizations", [], (err, rows) => {
        if (err) {
            console.error(err);
        } else {
            console.log("Organizations:", rows);
        }
    });
});
