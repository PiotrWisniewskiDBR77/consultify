const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../server/consultify.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Check if column exists, if not add it
    db.all("PRAGMA table_info(notifications)", (err, rows) => {
        if (err) {
            console.error('Error checking table info:', err);
            return;
        }

        const hasPriority = rows.some(row => row.name === 'priority');
        if (!hasPriority) {
            console.log('Adding priority column...');
            db.run("ALTER TABLE notifications ADD COLUMN priority TEXT DEFAULT 'normal'", (err) => {
                if (err) console.error('Error altering table:', err);
                else console.log('Successfully added priority column.');
                db.close();
            });
        } else {
            console.log('Priority column already exists.');
            db.close();
        }
    });
});
