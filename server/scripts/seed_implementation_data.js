const sqlite3 = require('sqlite3').verbose();
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const dbPath = path.resolve(__dirname, '../consultify.db');
const db = new sqlite3.Database(dbPath);

const ORG_ID = 'org-dbr77-test'; // From previous verification
const USER_ID = 'user-dbr77-admin'; // From seed_dbr77.js (Admin ID assumption, or fetch dynamically if needed)

// We used generate UUIDs in seed_dbr77.js, let's try to match one or just use a random one.
// Ideally we should query the user ID first to be safe, but for a dev seed script we can try to query it.

db.serialize(() => {
    // 1. Get a valid User ID
    db.get(`SELECT id FROM users WHERE email='piotr.wisniewski@dbr77.com'`, (err, user) => {
        if (err) {
            console.error("Error fetching user:", err);
            return;
        }
        if (!user) {
            console.error("User piotr.wisniewski@dbr77.com not found. Run seed_dbr77.js first.");
            return;
        }

        const userId = user.id;

        // 2. Create Executing Initiative
        const initiativeId = uuidv4();
        const now = new Date().toISOString();

        console.log(`Seeding Initiative for Org: ${ORG_ID}, User: ${userId}`);

        const insertInitiative = db.prepare(`
            INSERT INTO initiatives (
                id, organization_id, title, summary, 
                status, current_stage, progress,
                owner_execution_id, start_date, planned_end_date, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        insertInitiative.run(
            initiativeId, ORG_ID,
            'AI Customer Service Pilot',
            'Deploying GenAI chatbot for L1 support to reduce ticket volume by 40%.',
            'EXECUTING', 'KICKOFF', 15,
            userId,
            now,
            new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // +90 days
            now, now
            , (err) => {
                if (err) {
                    console.error("Error inserting initiative:", err);
                } else {
                    console.log(`Initiative Created: 'AI Customer Service Pilot' (${initiativeId})`);
                }
            });
        insertInitiative.finalize();

        // 3. Create Tasks
        const tasks = [
            { title: 'Setup Dev Environment', status: 'DONE', priority: 'high' },
            { title: 'Integrate OpenAI API', status: 'IN_PROGRESS', priority: 'urgent' },
            { title: 'Design Chat Widget UI', status: 'TODO', priority: 'medium' }
        ];

        const insertTask = db.prepare(`
            INSERT INTO tasks (
                id, organization_id, initiative_id, title, status, priority, 
                assignee_id, created_at, updated_at, task_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        tasks.forEach(t => {
            insertTask.run(
                uuidv4(), ORG_ID, initiativeId, t.title, t.status, t.priority,
                userId, now, now, 'EXECUTION'
            );
        });
        insertTask.finalize();

        console.log(`Seeded ${tasks.length} tasks for initiative.`);
    });
});

// Close DB after a short delay to allow async ops
setTimeout(() => {
    db.close();
    console.log("Seed complete.");
}, 2000);
