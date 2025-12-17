const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'server/consultify.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.get("SELECT count(*) as count FROM tasks", (err, row) => {
        console.log('Tasks count:', row ? row.count : err);
    });
    db.get("SELECT count(*) as count FROM initiatives", (err, row) => {
        console.log('Initiatives count:', row ? row.count : err);
    });
    db.get("SELECT count(*) as count FROM users", (err, row) => {
        console.log('Users count:', row ? row.count : err);
    });
});

db.close();
