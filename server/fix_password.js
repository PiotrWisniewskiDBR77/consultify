const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'consultify.db');
const db = new sqlite3.Database(dbPath);

const password = bcrypt.hashSync('123456', 8);

db.serialize(() => {
    db.run(`UPDATE users SET password = ? WHERE email = ?`, [password, 'admin@dbr77.com'], function (err) {
        if (err) {
            console.error("Error updating password:", err);
        } else {
            console.log(`Password updated for admin@dbr77.com. Rows affected: ${this.changes}`);
        }
    });

    // Also update Piotr just in case
    db.run(`UPDATE users SET password = ? WHERE email = ?`, [password, 'piotr.wisniewski@dbr77.com'], function (err) {
        if (!err) console.log(`Password updated for Piotr. Rows affected: ${this.changes}`);
    });
});

db.close();
