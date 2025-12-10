const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const dbPath = path.resolve(__dirname, 'consultify.db');

// 1. Delete existing DB
try {
    if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
        console.log("Deleted old database.");
    }
} catch (e) {
    console.log("Error deleting DB:", e);
}

const db = new sqlite3.Database(dbPath);

const SA_ORG_ID = uuidv4();
const ORG_ID = uuidv4();
const ADMIN_ID = uuidv4();
const PIOTR_ID = uuidv4();
const JUSTYNA_ID = uuidv4();
const PROJECT_ID = uuidv4();

const MOCK_SESSION_DATA = {
    steps: {
        step1Completed: true,
        step2Completed: false,
        step3Completed: false,
        step4Completed: false,
        step5Completed: false
    },
    assessment: {
        completedAxes: ["processes"],
        processes: { answers: [6, 5, 6], score: 5.7, status: "COMPLETED" },
        digitalProducts: { score: 0, answers: [], status: "NOT_STARTED" },
    },
    initiatives: [],
    economics: { totalCost: 0, totalAnnualBenefit: 0, overallROI: 0, paybackPeriodYears: 0 },
    chatHistory: []
};

console.log("Seeding DBR77 Data...");

db.serialize(() => {
    // 2. Create Schema
    db.run(`CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT,
        plan TEXT DEFAULT 'free',
        status TEXT DEFAULT 'active'
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        email TEXT UNIQUE,
        password TEXT,
        first_name TEXT,
        last_name TEXT,
        role TEXT DEFAULT 'USER',
        status TEXT DEFAULT 'active',
        last_login TEXT,
        FOREIGN KEY (organization_id) REFERENCES organizations(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        name TEXT,
        status TEXT DEFAULT 'active',
        owner_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sessions (
        user_id TEXT,
        type TEXT,
        data TEXT,
        project_id TEXT,
        PRIMARY KEY (user_id, type, project_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )`);

    // 3. Create Organizations
    db.run(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`, [SA_ORG_ID, 'System Admin Org', 'enterprise', 'active']);
    db.run(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`, [ORG_ID, 'Consultify / DBR77', 'enterprise', 'active'], (err) => {
        if (!err) console.log("Organization created: Consultify / DBR77");
    });

    // 4. Create Users
    const password = bcrypt.hashSync('123456', 8); // Standard password

    // Super Admin
    db.run(`INSERT INTO users (id, organization_id, email, password, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [ADMIN_ID, SA_ORG_ID, 'admin@dbr77.com', password, 'Super', 'Admin', 'SUPERADMIN'], (err) => {
            if (!err) console.log("User created: admin@dbr77.com (SUPERADMIN)");
        });

    // Piotr Wisniewski (Admin)
    db.run(`INSERT INTO users (id, organization_id, email, password, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [PIOTR_ID, ORG_ID, 'piotr.wisniewski@dbr77.com', password, 'Piotr', 'Wisniewski', 'ADMIN'], (err) => {
            if (!err) console.log("User created: piotr.wisniewski@dbr77.com (ADMIN)");
        });

    // Justyna Laskowska (User)
    db.run(`INSERT INTO users (id, organization_id, email, password, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [JUSTYNA_ID, ORG_ID, 'justyna.laskowska@dbr77.com', password, 'Justyna', 'Laskowska', 'USER'], (err) => {
            if (!err) console.log("User created: justyna.laskowska@dbr77.com (USER)");
        });

    // 5. Create Project for Piotr
    db.run(`INSERT INTO projects (id, organization_id, name, status, owner_id) VALUES (?, ?, ?, ?, ?)`,
        [PROJECT_ID, ORG_ID, 'DBR77 Transformation', 'active', PIOTR_ID], (err) => {
            if (!err) console.log("Project created for Piotr.");
        });

    // 6. Create Session
    db.run(`INSERT INTO sessions (user_id, type, data, project_id) VALUES (?, ?, ?, ?)`,
        [PIOTR_ID, 'full', JSON.stringify(MOCK_SESSION_DATA), PROJECT_ID]);

});

setTimeout(() => {
    db.close();
    console.log("Done. Restored Piotr & Justyna.");
}, 2000);
