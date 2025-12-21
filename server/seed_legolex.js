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
        // Using a fixed ID part to ensure we can easily find it later or avoid duplication if we added checks
        const orgId = 'org-legolex-demo-123';

        console.log(`Seeding Legolex Organization... ID: ${orgId}`);

        // Clean up previous run if it exists (Optional, but good for reliable demo state)
        db.run(`DELETE FROM organizations WHERE id = ?`, [orgId]);
        db.run(`DELETE FROM users WHERE organization_id = ?`, [orgId]);
        db.run(`DELETE FROM projects WHERE organization_id = ?`, [orgId]);
        // Note: Cascading deletes should handle children, but let's be safe
        // For other tables, we rely on cascade or lack of strict constraints for this demo seed
        // But to be cleaner:
        // Initiatives, Tasks etc depend on Org ID often.
        db.run(`DELETE FROM initiatives WHERE organization_id = ?`, [orgId]);
        db.run(`DELETE FROM tasks WHERE organization_id = ?`, [orgId]);
        db.run(`DELETE FROM maturity_scores WHERE organization_id = ?`, [orgId]);
        db.run(`DELETE FROM notifications WHERE organization_id = ?`, [orgId]);
        db.run(`DELETE FROM sessions WHERE project_id = ?`, ['proj-legolex-main']); // Hardcoded project ID from below


        const insertOrg = db.prepare(`INSERT INTO organizations(id, name, plan, status, industry) VALUES(?, ?, ?, ?, ?)`);
        insertOrg.run(orgId, 'Legolex', 'enterprise', 'active', 'Manufacturing');
        insertOrg.finalize();

        // --- 2. Create Users ---
        const adminId = 'user-legolex-admin';
        const cfoId = 'user-legolex-cfo';
        const cooId = 'user-legolex-coo';
        const managerId = 'user-legolex-manager';

        const passwordHash = bcrypt.hashSync('123456', 8);

        const insertUser = db.prepare(`INSERT INTO users(id, organization_id, email, password, first_name, last_name, role, avatar_url) VALUES(?, ?, ?, ?, ?, ?, ?, ?)`);

        // Admin / CEO
        insertUser.run(adminId, orgId, 'admin@legolex.com', passwordHash, 'Alexander', 'Pierce', 'ADMIN', 'https://i.pravatar.cc/150?u=alex');
        // CFO
        insertUser.run(cfoId, orgId, 'finance@legolex.com', passwordHash, 'Sarah', 'Jenkins', 'USER', 'https://i.pravatar.cc/150?u=sarah');
        // COO
        insertUser.run(cooId, orgId, 'ops@legolex.com', passwordHash, 'Marcus', 'Vance', 'USER', 'https://i.pravatar.cc/150?u=marcus');
        // Innovation Manager
        insertUser.run(managerId, orgId, 'elena@legolex.com', passwordHash, 'Elena', 'Rodriguez', 'USER', 'https://i.pravatar.cc/150?u=elena');

        insertUser.finalize();
        console.log('Seeded Users: admin, finance, ops, elena @legolex.com (pass: 123456)');

        // --- 3. Create Project (Legacy/Container) ---
        const projectId = 'proj-legolex-main';
        const insertProject = db.prepare(`INSERT INTO projects(id, organization_id, name, status, owner_id) VALUES(?, ?, ?, ?, ?)`);
        insertProject.run(projectId, orgId, 'Legolex Digital Transformation 2025', 'active', adminId);
        insertProject.finalize();
        console.log('Seeded Project.');

        // --- 4. Create Initiatives ---
        const initiatives = [
            {
                name: "AI-Driven Brick Sorting",
                axis: "data",
                status: "step4_pilot",
                business_value: "Critical",
                summary: "Implementing computer vision to sort bricks by color and shape automatically, reducing manual QA costs by 40%.",
                roi: 250,
                cost: 500000,
                owner: cooId
            },
            {
                name: "Global ERP Modernization",
                axis: "technology",
                status: "step3_list",
                business_value: "High",
                summary: "Migrating legacy on-prem ERP to Cloud-based solution for better scalability and real-time data access.",
                roi: 120,
                cost: 2000000,
                owner: cfoId
            },
            {
                name: "Digital Twin of Molding Plant",
                axis: "processes",
                status: "step5_full",
                business_value: "Medium",
                summary: "Digital twin to simulate production flows and optimize energy consumption. Currently deployed in 2 plants.",
                roi: 180,
                cost: 800000,
                owner: cooId
            },
            {
                name: "Customer Loyalty App 2.0",
                axis: "customer",
                status: "step4_pilot",
                business_value: "High",
                summary: "Revamping the mobile app to include AR building instructions and rewards. Pilot engaged with 10k users.",
                roi: 400,
                cost: 300000,
                owner: managerId
            },
            {
                name: "Sustainable Plastic R&D",
                axis: "culture",
                status: "step2_assess",
                business_value: "Critical",
                summary: "Researching bio-based materials to replace ABS plastic. Core alignment with 2030 sustainability goals.",
                roi: 150,
                cost: 1200000,
                owner: managerId
            }
        ];

        const insertInit = db.prepare(`INSERT INTO initiatives(id, organization_id, project_id, name, axis, status, business_value, summary, expected_roi, cost_capex, owner_business_id) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

        const initIds = [];

        initiatives.forEach(init => {
            const id = 'init-legolex-' + uuidv4().slice(0, 8);
            initIds.push(id);
            insertInit.run(id, orgId, projectId, init.name, init.axis, init.status, init.business_value, init.summary, init.roi, init.cost, init.owner);
        });
        insertInit.finalize();
        console.log(`Seeded ${initiatives.length} Initiatives.`);

        // --- 5. Create Maturity Scores ---
        const maturityScores = [
            { axis: 'Strategy', score: 3.8 },
            { axis: 'Culture', score: 4.2 },
            { axis: 'Technology', score: 2.8 },
            { axis: 'Data', score: 2.1 }, // Weakness identified
            { axis: 'Processes', score: 3.9 },
            { axis: 'Customer', score: 4.5 }
        ];

        const insertScore = db.prepare(`INSERT INTO maturity_scores(id, organization_id, axis, score, industry) VALUES(?, ?, ?, ?, ?)`);
        maturityScores.forEach(score => {
            insertScore.run(uuidv4(), orgId, score.axis, score.score, 'Manufacturing');
        });
        insertScore.finalize();
        console.log('Seeded Maturity Scores.');

        // --- 6. Create Tasks ---
        const insertTask = db.prepare(`INSERT INTO tasks(id, organization_id, project_id, title, status, priority, assignee_id, initiative_id, task_type, due_date) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        const nextWeekStr = nextWeek.toISOString();

        // AI Brick Sorting Tasks
        const initId1 = initIds[0];
        insertTask.run(uuidv4(), orgId, projectId, "Select Camera Hardware Vendor", "done", "high", managerId, initId1, "execution", nextWeekStr);
        insertTask.run(uuidv4(), orgId, projectId, "Train CV Model v1", "in_progress", "critical", cooId, initId1, "execution", nextWeekStr);
        insertTask.run(uuidv4(), orgId, projectId, "Integration Test with Conveyor Belt", "todo", "medium", managerId, initId1, "validation", nextWeekStr);

        // ERP Tasks
        const initId2 = initIds[1];
        insertTask.run(uuidv4(), orgId, projectId, "Map Current Business Processes", "done", "high", cfoId, initId2, "analytical", nextWeekStr);
        insertTask.run(uuidv4(), orgId, projectId, "Define Cloud Architecture", "review", "high", adminId, initId2, "design", nextWeekStr);
        insertTask.run(uuidv4(), orgId, projectId, "Vendor Selection (SAP vs Oracle)", "in_progress", "critical", cfoId, initId2, "analytical", nextWeekStr);

        // App Tasks
        const initId4 = initIds[3];
        insertTask.run(uuidv4(), orgId, projectId, "Finalize UX Designs", "done", "medium", managerId, initId4, "design", nextWeekStr);
        insertTask.run(uuidv4(), orgId, projectId, "Develop AR Module", "in_progress", "high", managerId, initId4, "execution", nextWeekStr);

        insertTask.finalize();
        console.log('Seeded Tasks.');

        // --- 7. Create Notifications ---
        const insertNotif = db.prepare(`INSERT INTO notifications(id, user_id, organization_id, type, title, message, is_read, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?)`);

        // Admin Notifications
        insertNotif.run(uuidv4(), adminId, orgId, 'system', 'Welcome to Consultify', 'Your robust digital transformation platform is ready.', 0, new Date().toISOString());
        insertNotif.run(uuidv4(), adminId, orgId, 'task_completed', 'Task Completed', 'Elena finished "Select Camera Hardware Vendor".', 0, new Date().toISOString());
        insertNotif.run(uuidv4(), adminId, orgId, 'mention', 'Budget Approval Required', 'Sarah mentioned you in "Global ERP Modernization": We need sign-off on the cloud budget.', 0, new Date().toISOString());
        insertNotif.run(uuidv4(), adminId, orgId, 'ai_insight', 'New AI Insight', 'Based on recent data, your "Data" maturity score is lagging behind the industry average (2.1 vs 3.4).', 0, new Date().toISOString());

        // CFO Notifications
        insertNotif.run(uuidv4(), cfoId, orgId, 'task_assigned', 'New Task Assigned', 'You have been assigned to "Vendor Selection".', 0, new Date().toISOString());

        // COO Notifications
        insertNotif.run(uuidv4(), cooId, orgId, 'deadline', 'Upcoming Deadline', 'Task "Train CV Model v1" is due in 3 days.', 0, new Date().toISOString());

        insertNotif.finalize();
        console.log('Seeded Notifications.');

        // --- 8. Create Session Data (Legacy Compatibility) ---
        // Ensuring session blob matches the complex scenario
        const sessionData = {
            steps: {
                step1Completed: true,
                step2Completed: true,
                step3Completed: true,
                step4Completed: true,
                step5Completed: false
            },
            assessment: {
                completedAxes: maturityScores.map(m => m.axis.toLowerCase()),
            },
            // Just basic metadata here, the UI should ideally pull from DB now, but for legacy views:
            initiatives: initiatives.map((init, index) => ({
                id: initIds[index],
                name: init.name,
                axis: init.axis,
                status: "Approved",
                quarter: "Q1 2025"
            }))
        };

        const insertSession = db.prepare(`INSERT INTO sessions(id, user_id, project_id, type, data) VALUES(?, ?, ?, ?, ?)`);
        insertSession.run(uuidv4(), adminId, projectId, 'full', JSON.stringify(sessionData));
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
