const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const dbPath = path.resolve(__dirname, 'consultify.db');

console.log('========================================');
console.log('  CONSULTIFY - UNIFIED DATABASE SEED');
console.log('========================================\n');

// Delete existing DB
try {
    if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
        console.log('✓ Deleted old database\n');
    }
} catch (e) {
    console.log('! Error deleting DB:', e);
}

const db = new sqlite3.Database(dbPath);

// ==========================================
// ORGANIZATION IDS
// ==========================================
const DBR77_ORG_ID = uuidv4();
const LEGOLEX_ORG_ID = 'org-legolex-demo-123';
const SAUDI_ORG_ID = uuidv4();

// ==========================================
// USER IDS - DBR77
// ==========================================
const DBR77_SUPERADMIN_ID = uuidv4();
const DBR77_PIOTR_ID = uuidv4();
const DBR77_JUSTYNA_ID = uuidv4();
const DBR77_PROJECT_ID = uuidv4();

// ==========================================
// USER IDS - LEGOLEX
// ==========================================
const LEGOLEX_ADMIN_ID = 'user-legolex-admin';
const LEGOLEX_CFO_ID = 'user-legolex-cfo';
const LEGOLEX_COO_ID = 'user-legolex-coo';
const LEGOLEX_MANAGER_ID = 'user-legolex-manager';
const LEGOLEX_PROJECT_ID = 'proj-legolex-main';

// ==========================================
// USER IDS - SAUDI
// ==========================================
const SAUDI_MINISTER_ID = uuidv4();
const SAUDI_PROJECT_ID = uuidv4();

// ==========================================
// PASSWORDS
// ==========================================
const STANDARD_PASSWORD = bcrypt.hashSync('123456', 8);
const SAUDI_PASSWORD = bcrypt.hashSync('Saudi2030!', 8);

console.log('Starting database seed...\n');

db.serialize(() => {
    // ==========================================
    // CREATE SCHEMA
    // ==========================================
    console.log('Creating schema...');

    db.run(`CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT,
        plan TEXT DEFAULT 'free',
        status TEXT DEFAULT 'active',
        industry TEXT
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
        avatar_url TEXT,
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
        id TEXT PRIMARY KEY,
        user_id TEXT,
        type TEXT,
        data TEXT,
        project_id TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS initiatives (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        project_id TEXT,
        name TEXT,
        description TEXT,
        axis TEXT,
        area TEXT,
        summary TEXT,
        hypothesis TEXT,
        status TEXT,
        current_stage TEXT,
        business_value TEXT,
        cost_capex REAL,
        cost_opex REAL,
        expected_roi REAL,
        owner_business_id TEXT,
        owner_execution_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (project_id) REFERENCES projects(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        organization_id TEXT,
        title TEXT,
        description TEXT,
        status TEXT,
        priority TEXT,
        step_phase TEXT,
        task_type TEXT,
        due_date TEXT,
        assignee_id TEXT,
        reporter_id TEXT,
        initiative_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        updated_at DATETIME,
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (assignee_id) REFERENCES users(id),
        FOREIGN KEY (initiative_id) REFERENCES initiatives(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS maturity_scores (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        axis TEXT,
        score REAL,
        industry TEXT,
        FOREIGN KEY (organization_id) REFERENCES organizations(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        organization_id TEXT,
        type TEXT,
        title TEXT,
        message TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (organization_id) REFERENCES organizations(id)
    )`);

    console.log('✓ Schema created\n');

    // ==========================================
    // ORGANIZATION 1: DBR77
    // ==========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 ORGANIZATION 1: DBR77');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    db.run(`INSERT INTO organizations (id, name, plan, status, industry) VALUES (?, ?, ?, ?, ?)`,
        [DBR77_ORG_ID, 'DBR77', 'enterprise', 'active', 'Consulting']);

    db.run(`INSERT INTO users (id, organization_id, email, password, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [DBR77_SUPERADMIN_ID, DBR77_ORG_ID, 'admin@dbr77.com', STANDARD_PASSWORD, 'Super', 'Admin', 'SUPERADMIN']);

    db.run(`INSERT INTO users (id, organization_id, email, password, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [DBR77_PIOTR_ID, DBR77_ORG_ID, 'piotr.wisniewski@dbr77.com', STANDARD_PASSWORD, 'Piotr', 'Wiśniewski', 'ADMIN']);

    db.run(`INSERT INTO users (id, organization_id, email, password, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [DBR77_JUSTYNA_ID, DBR77_ORG_ID, 'justyna.laskowska@dbr77.com', STANDARD_PASSWORD, 'Justyna', 'Laskowska', 'USER']);

    db.run(`INSERT INTO projects (id, organization_id, name, status, owner_id) VALUES (?, ?, ?, ?, ?)`,
        [DBR77_PROJECT_ID, DBR77_ORG_ID, 'DBR77 Transformation', 'active', DBR77_PIOTR_ID]);

    console.log('✓ DBR77 Organization created');
    console.log('  └─ Users: Super Admin, Piotr Wiśniewski, Justyna Laskowska\n');

    // ==========================================
    // ORGANIZATION 2: LEGOLEX
    // ==========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 ORGANIZATION 2: LEGOLEX (Demo #1)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    db.run(`INSERT INTO organizations (id, name, plan, status, industry) VALUES (?, ?, ?, ?, ?)`,
        [LEGOLEX_ORG_ID, 'Legolex', 'enterprise', 'active', 'Manufacturing']);

    // Users
    const insertUser = db.prepare(`INSERT INTO users(id, organization_id, email, password, first_name, last_name, role, avatar_url) VALUES(?, ?, ?, ?, ?, ?, ?, ?)`);

    insertUser.run(LEGOLEX_ADMIN_ID, LEGOLEX_ORG_ID, 'admin@legolex.com', STANDARD_PASSWORD, 'Alexander', 'Pierce', 'ADMIN', 'https://i.pravatar.cc/150?u=alex');
    insertUser.run(LEGOLEX_CFO_ID, LEGOLEX_ORG_ID, 'finance@legolex.com', STANDARD_PASSWORD, 'Sarah', 'Jenkins', 'USER', 'https://i.pravatar.cc/150?u=sarah');
    insertUser.run(LEGOLEX_COO_ID, LEGOLEX_ORG_ID, 'ops@legolex.com', STANDARD_PASSWORD, 'Marcus', 'Vance', 'USER', 'https://i.pravatar.cc/150?u=marcus');
    insertUser.run(LEGOLEX_MANAGER_ID, LEGOLEX_ORG_ID, 'elena@legolex.com', STANDARD_PASSWORD, 'Elena', 'Rodriguez', 'USER', 'https://i.pravatar.cc/150?u=elena');

    insertUser.finalize();

    db.run(`INSERT INTO projects(id, organization_id, name, status, owner_id) VALUES(?, ?, ?, ?, ?)`,
        [LEGOLEX_PROJECT_ID, LEGOLEX_ORG_ID, 'Legolex Digital Transformation 2025', 'active', LEGOLEX_ADMIN_ID]);

    // Initiatives
    const initiatives = [
        { name: "AI-Driven Brick Sorting", axis: "data", status: "step4_pilot", business_value: "Critical", summary: "Implementing computer vision to sort bricks by color and shape automatically, reducing manual QA costs by 40%.", roi: 250, cost: 500000, owner: LEGOLEX_COO_ID },
        { name: "Global ERP Modernization", axis: "technology", status: "step3_list", business_value: "High", summary: "Migrating legacy on-prem ERP to Cloud-based solution for better scalability and real-time data access.", roi: 120, cost: 2000000, owner: LEGOLEX_CFO_ID },
        { name: "Digital Twin of Molding Plant", axis: "processes", status: "step5_full", business_value: "Medium", summary: "Digital twin to simulate production flows and optimize energy consumption. Currently deployed in 2 plants.", roi: 180, cost: 800000, owner: LEGOLEX_COO_ID },
        { name: "Customer Loyalty App 2.0", axis: "customer", status: "step4_pilot", business_value: "High", summary: "Revamping the mobile app to include AR building instructions and rewards. Pilot engaged with 10k users.", roi: 400, cost: 300000, owner: LEGOLEX_MANAGER_ID },
        { name: "Sustainable Plastic R&D", axis: "culture", status: "step2_assess", business_value: "Critical", summary: "Researching bio-based materials to replace ABS plastic. Core alignment with 2030 sustainability goals.", roi: 150, cost: 1200000, owner: LEGOLEX_MANAGER_ID }
    ];

    const insertInit = db.prepare(`INSERT INTO initiatives(id, organization_id, project_id, name, axis, status, business_value, summary, expected_roi, cost_capex, owner_business_id) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const initIds = [];

    initiatives.forEach(init => {
        const id = 'init-legolex-' + uuidv4().slice(0, 8);
        initIds.push(id);
        insertInit.run(id, LEGOLEX_ORG_ID, LEGOLEX_PROJECT_ID, init.name, init.axis, init.status, init.business_value, init.summary, init.roi, init.cost, init.owner);
    });
    insertInit.finalize();

    // Maturity Scores
    const maturityScores = [
        { axis: 'Strategy', score: 3.8 },
        { axis: 'Culture', score: 4.2 },
        { axis: 'Technology', score: 2.8 },
        { axis: 'Data', score: 2.1 },
        { axis: 'Processes', score: 3.9 },
        { axis: 'Customer', score: 4.5 }
    ];

    const insertScore = db.prepare(`INSERT INTO maturity_scores(id, organization_id, axis, score, industry) VALUES(?, ?, ?, ?, ?)`);
    maturityScores.forEach(score => {
        insertScore.run(uuidv4(), LEGOLEX_ORG_ID, score.axis, score.score, 'Manufacturing');
    });
    insertScore.finalize();

    // Tasks
    const insertTask = db.prepare(`INSERT INTO tasks(id, organization_id, project_id, title, status, priority, assignee_id, initiative_id, task_type, due_date) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString();

    insertTask.run(uuidv4(), LEGOLEX_ORG_ID, LEGOLEX_PROJECT_ID, "Select Camera Hardware Vendor", "done", "high", LEGOLEX_MANAGER_ID, initIds[0], "execution", nextWeekStr);
    insertTask.run(uuidv4(), LEGOLEX_ORG_ID, LEGOLEX_PROJECT_ID, "Train CV Model v1", "in_progress", "critical", LEGOLEX_COO_ID, initIds[0], "execution", nextWeekStr);
    insertTask.run(uuidv4(), LEGOLEX_ORG_ID, LEGOLEX_PROJECT_ID, "Map Current Business Processes", "done", "high", LEGOLEX_CFO_ID, initIds[1], "analytical", nextWeekStr);
    insertTask.run(uuidv4(), LEGOLEX_ORG_ID, LEGOLEX_PROJECT_ID, "Define Cloud Architecture", "review", "high", LEGOLEX_ADMIN_ID, initIds[1], "design", nextWeekStr);
    insertTask.run(uuidv4(), LEGOLEX_ORG_ID, LEGOLEX_PROJECT_ID, "Finalize UX Designs", "done", "medium", LEGOLEX_MANAGER_ID, initIds[3], "design", nextWeekStr);
    insertTask.finalize();

    // Notifications
    const insertNotif = db.prepare(`INSERT INTO notifications(id, user_id, organization_id, type, title, message, is_read, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?)`);
    insertNotif.run(uuidv4(), LEGOLEX_ADMIN_ID, LEGOLEX_ORG_ID, 'system', 'Welcome to Consultify', 'Your robust digital transformation platform is ready.', 0, new Date().toISOString());
    insertNotif.run(uuidv4(), LEGOLEX_ADMIN_ID, LEGOLEX_ORG_ID, 'ai_insight', 'New AI Insight', 'Based on recent data, your \"Data\" maturity score is lagging behind the industry average (2.1 vs 3.4).', 0, new Date().toISOString());
    insertNotif.run(uuidv4(), LEGOLEX_CFO_ID, LEGOLEX_ORG_ID, 'task_assigned', 'New Task Assigned', 'You have been assigned to \"Vendor Selection\".', 0, new Date().toISOString());
    insertNotif.finalize();

    console.log('✓ Legolex Organization created');
    console.log('  ├─ Users: 4 (Admin, CFO, COO, Manager)');
    console.log('  ├─ Initiatives: 5');
    console.log('  ├─ Tasks: 5');
    console.log('  ├─ Maturity Scores: 6 axes');
    console.log('  └─ Notifications: 3\n');

    // ==========================================
    // ORGANIZATION 3: SAUDI FUTURE INDUSTRIES
    // ==========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 ORGANIZATION 3: SAUDI (Demo #2)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    db.run(`INSERT INTO organizations (id, name, plan, status, industry) VALUES (?, ?, ?, ?, ?)`,
        [SAUDI_ORG_ID, 'Saudi Future Industries', 'enterprise', 'active', 'Manufacturing']);

    db.run(`INSERT INTO users (id, organization_id, email, password, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [SAUDI_MINISTER_ID, SAUDI_ORG_ID, 'minister@saudi.sa', SAUDI_PASSWORD, 'Ahmed', 'Al-Fagih', 'ADMIN']);

    db.run(`INSERT INTO projects (id, organization_id, name, status, owner_id) VALUES (?, ?, ?, ?, ?)`,
        [SAUDI_PROJECT_ID, SAUDI_ORG_ID, 'Riyadh Smart Factory 2030', 'active', SAUDI_MINISTER_ID]);

    console.log('✓ Saudi Future Industries created');
    console.log('  └─ Users: Ahmed Al-Fagih (Minister)\n');
});

// Close DB
setTimeout(() => {
    db.close(() => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ DATABASE SEED COMPLETE!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('📊 SUMMARY:');
        console.log('  • 3 Organizations created');
        console.log('  • 8 Users created');
        console.log('  • 3 Projects created');
        console.log('  • 5 Initiatives (Legolex)');
        console.log('  • Demo code: 123456\n');
        console.log('🔐 See ACCESS_LIST.md for all credentials\n');
        process.exit(0);
    });
}, 2000);
