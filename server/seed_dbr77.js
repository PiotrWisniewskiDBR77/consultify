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

    // 7. Create Initiatives Table
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
        competencies_required TEXT,
        market_context TEXT,
        cost_capex REAL,
        cost_opex REAL,
        expected_roi REAL,
        social_impact TEXT,
        value_driver TEXT,
        confidence_level TEXT,
        value_timing TEXT,
        start_date DATETIME,
        pilot_end_date DATETIME,
        end_date DATETIME,
        owner_business_id TEXT,
        owner_execution_id TEXT,
        sponsor_id TEXT,
        problem_statement TEXT,
        deliverables TEXT,
        success_criteria TEXT,
        scope_in TEXT,
        scope_out TEXT,
        key_risks TEXT,
        strategic_fit TEXT,
        attachments TEXT,
        change_log TEXT,
        target_state TEXT,
        decision_readiness_breakdown TEXT,
        applicant_one_liner TEXT,
        strategic_intent TEXT,
        decision_to_make TEXT,
        decision_owner_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (project_id) REFERENCES projects(id)
    )`);

    // 8. Create Tasks Table (Updated Schema)
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        updated_at DATETIME,
        
        -- Extended Fields
        estimated_hours REAL,
        checklist TEXT,
        attachments TEXT,
        tags TEXT,
        custom_status_id TEXT,
        budget_allocated REAL,
        budget_spent REAL,
        risk_rating TEXT,
        acceptance_criteria TEXT,
        blocking_issues TEXT,
        why TEXT,
        initiative_id TEXT,
        expected_outcome TEXT,
        decision_impact TEXT,
        evidence_required TEXT,
        strategic_contribution TEXT,
        roadmap_initiative_id TEXT,
        kpi_id TEXT,
        raid_item_id TEXT,
        assignees TEXT,

        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (assignee_id) REFERENCES users(id),
        FOREIGN KEY (initiative_id) REFERENCES initiatives(id)
    )`);

    // 8. Seed Consulting Tasks
    const TASKS = [
        {
            title: 'Define Expectations & Challenges',
            description: 'Begin your journey by outlining your company\'s current state and strategic goals.',
            status: 'completed',
            stepPhase: 'design',
            taskType: 'analytical',
            dueDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days ago
        },
        {
            title: 'Complete Maturity Assessment',
            description: 'Evaluate your organization across 7 key dimensions to identify gaps.',
            status: 'in_progress',
            stepPhase: 'design',
            taskType: 'analytical',
            dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() // in 2 days
        },
        {
            title: 'Review Initiatives & Roadmap',
            description: 'Analyze AI-recommended initiatives and approve the transformation roadmap.',
            status: 'todo',
            stepPhase: 'design',
            taskType: 'execution',
            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // in 14 days
        }
    ];

    const insertTask = db.prepare(`
        INSERT INTO tasks (
            id, project_id, organization_id, title, description, status, priority, 
            step_phase, task_type, due_date, assignee_id, reporter_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    TASKS.forEach(t => {
        insertTask.run(
            uuidv4(), PROJECT_ID, ORG_ID, t.title, t.description, t.status, 'high',
            t.stepPhase, t.taskType, t.dueDate, PIOTR_ID, PIOTR_ID, new Date().toISOString()
        );
    });
    insertTask.finalize();

});

setTimeout(() => {
    db.close();
    console.log("Done. Restored Piotr & Justyna.");
}, 2000);
