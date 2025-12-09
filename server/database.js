const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'consultify.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initDb();
    }
});

function initDb() {
    db.serialize(() => {
        // Users Table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE,
            password TEXT,
            first_name TEXT,
            last_name TEXT,
            role TEXT,
            company_name TEXT,
            status TEXT DEFAULT 'active',
            access_level TEXT DEFAULT 'free',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME
        )`);

        // Sessions Table
        db.run(`CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            type TEXT, 
            data TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // Settings Table (New)
        db.run(`CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Seed Admin User if not exists
        const adminId = 'admin-001';
        const hashedPassword = bcrypt.hashSync('admin123', 8);

        db.get("SELECT id FROM users WHERE email = ?", ['admin@dbr77.com'], (err, row) => {
            if (!row) {
                const insert = db.prepare(`INSERT INTO users (id, email, password, first_name, last_name, role, company_name, status, access_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
                insert.run(adminId, 'admin@dbr77.com', hashedPassword, 'Admin', 'System', 'ADMIN', 'DBR77', 'active', 'full');
                insert.finalize();
                console.log('Default Admin user created (admin@dbr77.com / admin123)');
            }
        });
    });
}

module.exports = db;
