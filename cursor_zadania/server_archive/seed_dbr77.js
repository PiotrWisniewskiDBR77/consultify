import sqlite3 from 'sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { verbose } = sqlite3;
const dbPath = path.resolve(__dirname, 'consultify.db');
const sqlite = verbose();

// 1. Delete existing DB
try {
    if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
        console.log("Deleted old database.");
    }
} catch (e) {
    console.log("Error deleting DB:", e);
}

const db = new sqlite.Database(dbPath);

const SA_ORG_ID = uuidv4();
const ORG_ID = uuidv4();
const ADMIN_ID = uuidv4();
const PIOTR_ID = uuidv4();
const JUSTYNA_ID = uuidv4();
const PROJECT_ID = uuidv4();

// Mock Session Data (Refined for DBR77)
const SESSION_DATA = {
    steps: {
        step1Completed: true,
        step2Completed: true,
        step3Completed: true, // Review & Roadmap
        step4Completed: false, // Execution
        step5Completed: false
    },
    assessment: {
        completedAxes: ["processes", "organization", "technology"],
        processes: { answers: [6, 5, 6, 7], score: 6.0, status: "COMPLETED" },
        organization: { answers: [5, 6, 5, 5], score: 5.25, status: "COMPLETED" },
        technology: { answers: [4, 5, 3, 5], score: 4.25, status: "COMPLETED" },
        digitalProducts: { score: 0, answers: [], status: "NOT_STARTED" },
    },
    initiatives: [], // Will be populated via DB
    economics: { totalCost: 150000, totalAnnualBenefit: 450000, overallROI: 200, paybackPeriodYears: 0.33 },
    chatHistory: []
};

console.log("Seeding DBR77 Data (English)...");

db.serialize(() => {
    // =========================================================================
    // 2. CREATE SCHEMA
    // =========================================================================

    // Organizations
    db.run(`CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT,
        plan TEXT DEFAULT 'free',
        status TEXT DEFAULT 'active'
    )`);

    // Users
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
        position TEXT,
        department TEXT,
        FOREIGN KEY (organization_id) REFERENCES organizations(id)
    )`);

    // Projects
    db.run(`CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        name TEXT,
        status TEXT DEFAULT 'active',
        owner_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        description TEXT,
        budget REAL,
        start_date DATETIME,
        end_date DATETIME,
        FOREIGN KEY (organization_id) REFERENCES organizations(id)
    )`);

    // Sessions (Legacy/App State)
    db.run(`CREATE TABLE IF NOT EXISTS sessions (
        user_id TEXT,
        type TEXT,
        data TEXT,
        project_id TEXT,
        PRIMARY KEY (user_id, type, project_id)
    )`);

    // Settings
    db.run(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )`);

    // Initiatives
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
        progress INTEGER DEFAULT 0,
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (project_id) REFERENCES projects(id)
    )`);

    // Tasks
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
        progress INTEGER DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (assignee_id) REFERENCES users(id),
        FOREIGN KEY (initiative_id) REFERENCES initiatives(id)
    )`);

    // Risks (RAID)
    db.run(`CREATE TABLE IF NOT EXISTS risks (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        organization_id TEXT,
        initiative_id TEXT,
        description TEXT,
        probability TEXT, -- Low, Medium, High
        impact TEXT, -- Low, Medium, High
        mitigation_plan TEXT,
        status TEXT, -- Open, Mitigated, Closed
        owner_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (initiative_id) REFERENCES initiatives(id)
    )`);

    // KPIs
    db.run(`CREATE TABLE IF NOT EXISTS kpis (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        initiative_id TEXT,
        name TEXT,
        target_value REAL,
        current_value REAL,
        unit TEXT, -- %, USD, FTE
        frequency TEXT, -- Monthly, Quarterly
        owner_id TEXT,
        status TEXT, -- On Track, At Risk, Off Track
        FOREIGN KEY (initiative_id) REFERENCES initiatives(id)
    )`);

    // Assessments
    db.run(`CREATE TABLE IF NOT EXISTS assessments (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        project_id TEXT,
        type TEXT, -- Maturity, Readiness
        status TEXT,
        score REAL,
        completed_at DATETIME,
        details TEXT -- JSON
    )`);

    // Comments
    db.run(`CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        entity_type TEXT, -- task, initiative, document
        entity_id TEXT,
        user_id TEXT,
        content TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);


    // =========================================================================
    // 3. SEED DATA
    // =========================================================================

    // Organizations
    db.run(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`, [SA_ORG_ID, 'System Admin Org', 'enterprise', 'active']);
    db.run(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`, [ORG_ID, 'Consultify / DBR77', 'enterprise', 'active'], (err) => {
        if (!err) console.log("✅ Organization created: Consultify / DBR77");
    });

    // Users
    const password = bcrypt.hashSync('123456', 8);

    db.run(`INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [ADMIN_ID, SA_ORG_ID, 'admin@dbr77.com', password, 'Super', 'Admin', 'SUPERADMIN', 'System Administrator']);

    db.run(`INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [PIOTR_ID, ORG_ID, 'piotr.wisniewski@dbr77.com', password, 'Piotr', 'Wisniewski', 'ADMIN', 'CEO / Transformation Lead'], (err) => {
            if (!err) console.log("✅ User created: Piotr");
        });

    db.run(`INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [JUSTYNA_ID, ORG_ID, 'justyna.laskowska@dbr77.com', password, 'Justyna', 'Laskowska', 'USER', 'Project Manager']);

    // Project
    db.run(`INSERT INTO projects (id, organization_id, name, status, owner_id, description, start_date) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [PROJECT_ID, ORG_ID, 'DBR77 Digital Transformation', 'active', PIOTR_ID, 'Company-wide digital transformation and robotization program.', new Date().toISOString()]);

    // Session
    db.run(`INSERT INTO sessions (user_id, type, data, project_id) VALUES (?, ?, ?, ?)`,
        [PIOTR_ID, 'full', JSON.stringify(SESSION_DATA), PROJECT_ID]);

    // Initiatives (English)
    const init1_id = uuidv4();
    const init2_id = uuidv4();
    const init3_id = uuidv4();

    const INITIATIVES = [
        {
            id: init1_id,
            name: "Autonomous Logistics Robots",
            description: "Implementation of AMR robots to automate internal logistics in the production hall.",
            axis: "technology",
            area: "Production",
            status: "execution",
            current_stage: "Pilot",
            business_value: "High",
            cost_capex: 120000,
            expected_roi: 250,
            owner_id: PIOTR_ID
        },
        {
            id: init2_id,
            name: "AI-Driven Quality Control",
            description: "Vision system based on deep learning to detect defects in real-time.",
            axis: "technology",
            area: "Quality",
            status: "planning",
            current_stage: "Blueprint",
            business_value: "Medium",
            cost_capex: 45000,
            expected_roi: 180,
            owner_id: JUSTYNA_ID
        },
        {
            id: init3_id,
            name: "Digital Twin of Production Line",
            description: "Creating a digital replica of the main assembly line for simulation and optimization.",
            axis: "processes",
            area: "R&D",
            status: "backlog",
            current_stage: "Idea",
            business_value: "High",
            cost_capex: 80000,
            expected_roi: 150,
            owner_id: PIOTR_ID
        }
    ];

    const insertInit = db.prepare(`
        INSERT INTO initiatives (
            id, organization_id, project_id, name, description, axis, area, 
            status, current_stage, business_value, cost_capex, expected_roi, owner_execution_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    INITIATIVES.forEach(i => {
        insertInit.run(
            i.id, ORG_ID, PROJECT_ID, i.name, i.description, i.axis, i.area,
            i.status, i.current_stage, i.business_value, i.cost_capex, i.expected_roi, i.owner_id
        );
    });
    insertInit.finalize(() => console.log(`✅ Seeded ${INITIATIVES.length} initiatives`));

    // Tasks (English)
    const TASKS = [
        // Init 1 Tasks
        { title: "Define AMR specifications", status: "completed", type: "analytical", priority: "high", init_id: init1_id, assignee: PIOTR_ID },
        { title: "Vendor selection for Robots", status: "completed", type: "execution", priority: "high", init_id: init1_id, assignee: PIOTR_ID },
        { title: "Safety protocol integration", status: "in_progress", type: "execution", priority: "critical", init_id: init1_id, assignee: JUSTYNA_ID },
        { title: "Pilot deployment in Zone A", status: "todo", type: "execution", priority: "high", init_id: init1_id, assignee: PIOTR_ID },

        // Init 2 Tasks
        { title: "Collect defect image dataset", status: "in_progress", type: "analytical", priority: "medium", init_id: init2_id, assignee: JUSTYNA_ID },
        { title: "Train initial model", status: "todo", type: "execution", priority: "medium", init_id: init2_id, assignee: PIOTR_ID },

        // General PMO Tasks
        { title: "Q1 Strategy Review", status: "todo", type: "meeting", priority: "high", init_id: null, assignee: PIOTR_ID },
        { title: "Update Budget Forecast", status: "in_progress", type: "financial", priority: "medium", init_id: null, assignee: JUSTYNA_ID }
    ];

    const insertTask = db.prepare(`
        INSERT INTO tasks (
            id, project_id, organization_id, title, status, task_type, priority, 
            initiative_id, assignee_id, reporter_id, due_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    TASKS.forEach(t => {
        insertTask.run(
            uuidv4(), PROJECT_ID, ORG_ID, t.title, t.status, t.type, t.priority,
            t.init_id, t.assignee, PIOTR_ID, new Date(Date.now() + 86400000).toISOString()
        );
    });
    insertTask.finalize(() => console.log(`✅ Seeded ${TASKS.length} tasks`));

    // KPIs
    db.run(`INSERT INTO kpis (id, organization_id, initiative_id, name, target_value, current_value, unit, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), ORG_ID, init1_id, "Logistics Throughput", 1000, 850, "Units/Hour", "On Track"]);

    // Risks
    db.run(`INSERT INTO risks (id, project_id, organization_id, initiative_id, description, probability, impact, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), PROJECT_ID, ORG_ID, init1_id, "Wi-Fi interference causing robot stalls", "Medium", "High", "Open"]);

});

setTimeout(() => {
    db.close();
    console.log("✅ Database seeding complete. DBR77 environment ready.");
}, 2000);
