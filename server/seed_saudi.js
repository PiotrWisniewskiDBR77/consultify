const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const dbPath = path.resolve(__dirname, 'consultify.db');

// 1. Delete existing DB to force fresh schema
try {
    if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
        console.log("Deleted old database.");
    }
} catch (e) {
    console.log("Error deleting DB:", e);
}

const db = new sqlite3.Database(dbPath);

const ORG_ID = uuidv4();
const USER_ID = uuidv4();
const PROJECT_ID = uuidv4();

// Mock Data
const MOCK_SESSION_DATA = {
    steps: {
        step1Completed: true,
        step2Completed: true,
        step3Completed: true,
        step4Completed: false,
        step5Completed: false
    },
    assessment: {
        completedAxes: ["processes", "digitalProducts", "businessModels", "dataManagement", "culture", "aiMaturity"],
        processes: { answers: [6, 5, 6], score: 5.7, status: "COMPLETED" },
        digitalProducts: { answers: [7, 6, 7], score: 6.7, status: "COMPLETED" },
        businessModels: { answers: [6, 7, 7], score: 6.7, status: "COMPLETED" },
        dataManagement: { answers: [2, 3, 2], score: 2.3, status: "COMPLETED" },
        culture: { answers: [5, 4, 5], score: 4.7, status: "COMPLETED" },
        aiMaturity: { answers: [3, 2, 4], score: 3.0, status: "COMPLETED" }
    },
    initiatives: [
        { id: "1", name: "Data Lake Implementation", axis: "dataManagement", priority: "High", complexity: "High", status: "Ready", quarter: "Q1 2024" },
        { id: "2", name: "Predictive Maintenance Pilot", axis: "aiMaturity", priority: "High", complexity: "Medium", status: "Draft", quarter: "Q2 2024" },
        { id: "3", name: "Digital Twin of Riyadh Plant", axis: "processes", priority: "Medium", complexity: "High", status: "Draft", quarter: "Q4 2024" }
    ],
    economics: {
        totalCost: 1500,
        totalAnnualBenefit: 4200,
        overallROI: 280,
        paybackPeriodYears: 0.4
    },
    report: {
        generatedAt: new Date().toISOString(),
        executiveSummary: "Saudi Future Industries is poised to become a regional leader. With strong foundations in Process and Business Models, the focus must shift to Data Management to unlock AI potential.",
        keyFindings: [
            "Strongest Asset: Digital Products (6.7/7)",
            "Critical Gap: Data Management (2.3/7)",
            "Readiness: High for AI adoption once data is fixed."
        ],
        recommendations: ["Build Data Lake", "Train Workforce in AI", "Automate Quality Control"]
    },
    chatHistory: [
        { id: "1", role: "ai", content: "مرحبًا أحمد. أنا مساعد التحول الرقمي الخاص بك. كيف يمكنني مساعدتك في استراتيجية الرياض للمصانع الذكية؟", timestamp: new Date().toISOString() },
        { id: "2", role: "user", content: "كيف يمكننا تحسين إدارة البيانات؟", timestamp: new Date().toISOString() },
        { id: "3", role: "ai", content: "بناءً على التقييم (2.3/7)، أوصي بالبدء بتوحيد مصادر البيانات وتنفيذ 'بحيرة بيانات' مركزية. هذا سيمكننا من تطبيق الذكاء الاصطناعي لاحقًا.", timestamp: new Date().toISOString() }
    ]
};

console.log("Seeding Saudi Demo Data...");

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

    // 3. Create Organization
    db.run(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`, [ORG_ID, 'Saudi Future Industries', 'enterprise', 'active'], (err) => {
        if (err) console.error("Org Error:", err);
        else console.log("Organization created.");
    });

    // 4. Create User
    const password = bcrypt.hashSync('Saudi2030!', 8);
    db.run(`INSERT INTO users (id, organization_id, email, password, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [USER_ID, ORG_ID, 'minister@saudi.sa', password, 'Ahmed', 'Al-Fagih', 'ADMIN'], (err) => {
            if (err) console.error("User Error:", err);
            else console.log("User created: minister@saudi.sa / Saudi2030!");
        });

    // 5. Create Project
    db.run(`INSERT INTO projects (id, organization_id, name, status, owner_id) VALUES (?, ?, ?, ?, ?)`,
        [PROJECT_ID, ORG_ID, 'Riyadh Smart Factory 2030', 'active', USER_ID], (err) => {
            if (err) console.error("Project Error:", err);
            else console.log("Project created.");
        });

    // 6. Create Session Data
    db.run(`INSERT INTO sessions (user_id, type, data, project_id) VALUES (?, ?, ?, ?)`,
        [USER_ID, 'full', JSON.stringify(MOCK_SESSION_DATA), PROJECT_ID], (err) => {
            if (err) console.error("Session Error:", err);
            else console.log("Session data seeded.");
        });

    // 7. Also create default SuperAdmin so the user can verify admin panel too if needed
    const SA_ID = uuidv4();
    const SA_ORG_ID = uuidv4();
    db.run(`INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`, [SA_ORG_ID, 'DBR77 System', 'enterprise', 'active']);
    db.run(`INSERT INTO users (id, organization_id, email, password, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [SA_ID, SA_ORG_ID, 'admin@dbr77.com', bcrypt.hashSync('123456', 8), 'Super', 'Admin', 'SUPERADMIN']);
    console.log("SuperAdmin restored.");

});

// Close DB (Wait a bit for async)
setTimeout(() => {
    db.close();
    console.log("Done. Ready for Demo.");
}, 2000);
