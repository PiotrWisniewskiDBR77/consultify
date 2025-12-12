const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'consultify.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log('Dropping old sessions table...');
    db.run("DROP TABLE IF EXISTS sessions");

    console.log('Creating new sessions table...');
    db.run(`CREATE TABLE sessions(
            id TEXT PRIMARY KEY,
            user_id TEXT,
            project_id TEXT,
            type TEXT,
            data TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(project_id) REFERENCES projects(id)
        )`, (err) => {
        if (err) {
            console.error('Error creating table:', err.message);
            process.exit(1);
        } else {
            console.log('Table created successfully.');
        }
    });
});

db.close(() => {
    console.log('Migration complete.');
});
