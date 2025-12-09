const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

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
        // Organizations Table (New)
        db.run(`CREATE TABLE IF NOT EXISTS organizations (
            id TEXT PRIMARY KEY,
            name TEXT,
            plan TEXT DEFAULT 'free',
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            valid_until DATETIME
        )`);

        // Users Table (Updated with organization_id)
        // We will drop the old one if it exists to ensure clean schema for this major refactor
        // In a real prod env, we would migrate. Here we wipe for simplicity as agreed.
        // ONLY drop in dev mode
        if (process.env.NODE_ENV !== 'production') {
            db.run(`DROP TABLE IF EXISTS users`);
        }
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            organization_id TEXT,
            email TEXT UNIQUE,
            password TEXT,
            first_name TEXT,
            last_name TEXT,
            role TEXT, 
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME,
            FOREIGN KEY(organization_id) REFERENCES organizations(id)
        )`);

        // Sessions Table (Linked to user_id and optionally project_id)
        db.run(`CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            project_id TEXT,
            type TEXT, 
            data TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(project_id) REFERENCES projects(id)
        )`);

        // Settings Table (Global/System settings)
        db.run(`CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Projects Table
        db.run(`CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            organization_id TEXT,
            name TEXT,
            status TEXT DEFAULT 'active',
            owner_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(organization_id) REFERENCES organizations(id)
        )`);

        // Knowledge Base: Documents
        db.run(`CREATE TABLE IF NOT EXISTS knowledge_docs (
            id TEXT PRIMARY KEY,
            filename TEXT,
            filepath TEXT,
            status TEXT DEFAULT 'pending', -- pending, indexed, error
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Knowledge Base: Chunks (Simple Text Search / Vector Store Placeholder)
        db.run(`CREATE TABLE IF NOT EXISTS knowledge_chunks (
            id TEXT PRIMARY KEY,
            doc_id TEXT,
            content TEXT,
            chunk_index INTEGER,
            embedding TEXT, -- JSON string or blob if we add vectors later
            FOREIGN KEY(doc_id) REFERENCES knowledge_docs(id) ON DELETE CASCADE
        )`);

        // LLM Providers
        db.run(`CREATE TABLE IF NOT EXISTS llm_providers (
            id TEXT PRIMARY KEY,
            name TEXT,
            provider TEXT, -- openai, anthropic, google, local
            api_key TEXT,
            endpoint TEXT,
            model_id TEXT,
            cost_per_1k REAL DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            is_default INTEGER DEFAULT 0,
            visibility TEXT DEFAULT 'admin' -- admin, public, beta
        )`);

        // Seed Super Admin & Default Organization
        const superAdminOrgId = 'org-dbr77-system';
        const superAdminId = 'admin-001';
        const hashedPassword = bcrypt.hashSync('123456', 8);

        // Check if admin exists (or rather, just ensure seed since we dropped table)
        db.get("SELECT id FROM organizations WHERE id = ?", [superAdminOrgId], (err, row) => {
            if (!row) {
                // Create System Organization
                const insertOrg = db.prepare(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`);
                insertOrg.run(superAdminOrgId, 'DBR77 System', 'enterprise', 'active');
                insertOrg.finalize();

                // Create Super Admin User
                const insertUser = db.prepare(`INSERT INTO users (id, organization_id, email, password, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?, ?)`);
                insertUser.run(superAdminId, superAdminOrgId, 'admin@dbr77.ai', hashedPassword, 'Super', 'Admin', 'SUPERADMIN');
                insertUser.finalize();

                console.log('Seeded SuperAdmin (admin@dbr77.ai) and System Org.');

                // --- SEED TEST ORGANIZATION: DBR77 ---
                const dbr77OrgId = 'org-dbr77-test';
                const dbr77AdminId = 'user-dbr77-admin';
                const dbr77UserId = 'user-dbr77-user';

                // Create DBR77 Organization
                const insertDbr77Org = db.prepare(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`);
                insertDbr77Org.run(dbr77OrgId, 'DBR77', 'pro', 'active');
                insertDbr77Org.finalize();

                // Create Admin user for DBR77
                const insertDbr77Admin = db.prepare(`INSERT INTO users (id, organization_id, email, password, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?, ?)`);
                insertDbr77Admin.run(dbr77AdminId, dbr77OrgId, 'piotr.wisniewski@dbr77.com', hashedPassword, 'Piotr', 'Wiśniewski', 'ADMIN');
                insertDbr77Admin.finalize();

                // Create regular User for DBR77
                const insertDbr77User = db.prepare(`INSERT INTO users (id, organization_id, email, password, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?, ?)`);
                insertDbr77User.run(dbr77UserId, dbr77OrgId, 'justyna.laskowska@dbr77.com', hashedPassword, 'Justyna', 'Laskowska', 'USER');
                insertDbr77User.finalize();

                // Create a sample project for DBR77
                const dbr77ProjectId = 'project-dbr77-001';
                const insertProject = db.prepare(`INSERT INTO projects (id, organization_id, name, status, owner_id) VALUES (?, ?, ?, ?, ?)`);
                insertProject.run(dbr77ProjectId, dbr77OrgId, 'Digital Transformation 2025', 'active', dbr77AdminId);
                insertProject.finalize();

                console.log('Seeded DBR77 Organization with Admin (piotr.wisniewski@dbr77.com) and User (justyna.laskowska@dbr77.com).');
            }
        });
    });
}

module.exports = db;
