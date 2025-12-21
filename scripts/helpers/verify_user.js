const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'server/consultify.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.get('SELECT * FROM users WHERE email = "piotr.wisniewski@dbr77.com"', (err, row) => {
        if (err) {
            console.error(err);
        } else {
            console.log('User found:', row ? 'YES' : 'NO');
            if (row) console.log('Role:', row.role);
        }
        db.close();
    });
});
