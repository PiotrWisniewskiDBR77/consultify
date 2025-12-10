const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'consultify.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
        process.exit(1);
    }
    console.log('Connected to SQLite database.');
    seedLegolex();
});

function seedLegolex() {
    db.serialize(() => {
        // --- 1. Create Organization: Legolex ---
        const orgId = 'org-legolex-' + uuidv4().slice(0, 8);

        // Check if exists first to avoid duplicates if run multiple times (optional, but good practice)
        // For this task, I'll just insert. API/DB should handle constraints or I'll just assume unique email check.

        console.log(`Seeding Legolex Organization... ID: ${orgId}`);

        const insertOrg = db.prepare(`INSERT INTO organizations(id, name, plan, status, industry) VALUES(?, ?, ?, ?, ?)`);
        insertOrg.run(orgId, 'Legolex', 'enterprise', 'active', 'Manufacturing');
        insertOrg.finalize();

        // --- 2. Create Users ---
        const adminId = 'user-legolex-admin-' + uuidv4().slice(0, 8);
        const userId = 'user-legolex-user-' + uuidv4().slice(0, 8);
        const passwordHash = bcrypt.hashSync('123456', 8);

        const insertUser = db.prepare(`INSERT INTO users(id, organization_id, email, password, first_name, last_name, role) VALUES(?, ?, ?, ?, ?, ?, ?)`);

        // Admin
        insertUser.run(adminId, orgId, 'Admin@legolex.com', passwordHash, 'Legolex', 'Admin', 'ADMIN');
        // User
        insertUser.run(userId, orgId, 'user@legolex.com', passwordHash, 'Legolex', 'User', 'USER');

        insertUser.finalize();
        console.log('Seeded Users: Admin@legolex.com, user@legolex.com');

        // --- 3. Create Project (Legacy/Container) ---
        const projectId = 'proj-legolex-' + uuidv4().slice(0, 8);
        const insertProject = db.prepare(`INSERT INTO projects(id, organization_id, name, status, owner_id) VALUES(?, ?, ?, ?, ?)`);
        insertProject.run(projectId, orgId, 'Legolex Digital Transformation', 'active', adminId);
        insertProject.finalize();
        console.log('Seeded Project.');

        // --- 4. Create Initiatives (The "Complete Program") ---
        const initiatives = [
            {
                name: "AI-Driven Brick Sorting",
                axis: "data",
                status: "step4_pilot",
                business_value: "High",
                summary: "Implementing computer vision to sort bricks by color and shape automatically.",
                roi: 250,
                cost: 500000
            },
            {
                name: "Global ERP Modernization",
                axis: "technology",
                status: "step3_list",
                business_value: "Critical",
                summary: "Migrating legacy on-prem ERP to Cloud-based solution for better scalability.",
                roi: 120,
                cost: 2000000
            },
            {
                name: "Digital Twin of Molding Plant",
                axis: "processes",
                status: "step5_full",
                business_value: "Medium",
                summary: "Digital twin to simulate production flows and optimize energy consumption.",
                roi: 180,
                cost: 800000
            },
            {
                name: "Customer Loyalty App 2.0",
                axis: "customer",
                status: "step4_pilot",
                business_value: "High",
                summary: "Revamping the mobile app to include AR building instructions and rewards.",
                roi: 400,
                cost: 300000
            }
        ];

        const insertInit = db.prepare(`INSERT INTO initiatives(id, organization_id, project_id, name, axis, status, business_value, summary, expected_roi, cost_capex, owner_business_id) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

        const initIds = [];

        initiatives.forEach(init => {
            const id = 'init-' + uuidv4().slice(0, 8);
            initIds.push(id);
            insertInit.run(id, orgId, projectId, init.name, init.axis, init.status, init.business_value, init.summary, init.roi, init.cost, adminId);
        });
        insertInit.finalize();
        console.log(`Seeded ${initiatives.length} Initiatives.`);

        // --- 5. Create Maturity Scores (Assessments) ---
        const maturityScores = [
            { axis: 'Strategy', score: 3.5 },
            { axis: 'Culture', score: 4.2 },
            { axis: 'Technology', score: 2.8 },
            { axis: 'Data', score: 2.1 },
            { axis: 'Processes', score: 3.9 },
            { axis: 'Customer', score: 4.5 }
        ];

        const insertScore = db.prepare(`INSERT INTO maturity_scores(id, organization_id, axis, score, industry) VALUES(?, ?, ?, ?, ?)`);
        maturityScores.forEach(score => {
            insertScore.run(uuidv4(), orgId, score.axis, score.score, 'Manufacturing');
        });
        insertScore.finalize();
        console.log('Seeded Maturity Scores.');

        // --- 6. Create Tasks for Initiatives ---
        const insertTask = db.prepare(`INSERT INTO tasks(id, organization_id, project_id, title, status, priority, assignee_id, initiative_id, task_type) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`);

        // Add some tasks linked to the first initiative
        const initId1 = initIds[0]; // AI Brick Sorting
        insertTask.run(uuidv4(), orgId, projectId, "Select Camera Hardware Vendor", "done", "high", userId, initId1, "execution");
        insertTask.run(uuidv4(), orgId, projectId, "Train CV Model v1", "in_progress", "critical", userId, initId1, "execution");
        insertTask.run(uuidv4(), orgId, projectId, "Integration Test with Conveyor Belt", "todo", "medium", userId, initId1, "validation");

        // Add some tasks linked to the second initiative
        const initId2 = initIds[1]; // ERP
        insertTask.run(uuidv4(), orgId, projectId, "Map Current Business Processes", "done", "high", adminId, initId2, "analytical");
        insertTask.run(uuidv4(), orgId, projectId, "Define Cloud Architecture", "review", "high", adminId, initId2, "design");

        insertTask.finalize();
        console.log('Seeded Tasks.');

        // --- 7. Create Session Data (Legacy Compatibility) ---
        // Some views might still pull from session.data structure.
        const sessionData = {
            steps: {
                step1Completed: true,
                step2Completed: true,
                step3Completed: true,
                step4Completed: true, // It's a "Complete program"
                step5Completed: false
            },
            assessment: {
                completedAxes: maturityScores.map(m => m.axis.toLowerCase()),
                // Mocking structure for assessment view if it relies on session blob
                ...maturityScores.reduce((acc, curr) => ({
                    ...acc,
                    [curr.axis.toLowerCase()]: { score: curr.score, status: 'COMPLETED', answers: [3, 4, 3] }
                }), {})
            },
            initiatives: initiatives.map((init, index) => ({
                id: initIds[index],
                name: init.name,
                axis: init.axis,
                priority: "High",
                complexity: "Medium",
                status: "Approved",
                quarter: "Q1 2025"
            })),
            economics: {
                totalCost: initiatives.reduce((sum, i) => sum + i.cost, 0),
                totalAnnualBenefit: initiatives.reduce((sum, i) => sum + (i.cost * (i.roi / 100)), 0),
                overallROI: 150
            }
        };

        const insertSession = db.prepare(`INSERT INTO sessions(id, user_id, project_id, type, data) VALUES(?, ?, ?, ?, ?)`);
        insertSession.run(uuidv4(), adminId, projectId, 'full', JSON.stringify(sessionData));
        insertSession.run(uuidv4(), userId, projectId, 'full', JSON.stringify(sessionData));
        insertSession.finalize();
        console.log('Seeded Legacy Session Data.');

    });

    // Close and exit
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Legolex Seed Complete.');
        process.exit(0);
    });
}
