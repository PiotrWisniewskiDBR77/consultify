const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'consultify.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log('Adding title column to users table...');
    db.run(`ALTER TABLE users ADD COLUMN title TEXT`, (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('Column already exists.');
            } else {
                console.error('Error adding column:', err.message);
                process.exit(1);
            }
        } else {
            console.log('Column added successfully.');
        }
    });
});

db.close(() => {
    console.log('Migration complete.');
});
