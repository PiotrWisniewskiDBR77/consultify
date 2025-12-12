
const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const TASKS = [
    {
        title: 'Define Expectations & Challenges',
        description: 'Begin your journey by outlining your company\'s current state and strategic goals.',
        status: 'completed',
        stepPhase: 'design',
        taskType: 'analytical',
        due_date_offset: -7 // 7 days ago
    },
    {
        title: 'Complete Maturity Assessment',
        description: 'Evaluate your organization across 7 key dimensions to identify gaps.',
        status: 'in_progress',
        stepPhase: 'design',
        taskType: 'analytical',
        due_date_offset: 2 // in 2 days
    },
    {
        title: 'Review Initiatives & Roadmap',
        description: 'Analyze AI-recommended initiatives and approve the transformation roadmap.',
        status: 'todo',
        stepPhase: 'design',
        taskType: 'execution',
        due_date_offset: 14 // in 14 days
    },
    {
        title: 'Q1 Strategy Workshop',
        description: 'align key stakeholders on the digital transformation goals for the quarter.',
        status: 'todo',
        stepPhase: 'execution',
        taskType: 'meeting',
        due_date_offset: 5
    },
    {
        title: 'Vendor Selection for IoT Platform',
        description: 'Evaluate and shortlist top 3 vendors for the industrial IoT implementation.',
        status: 'todo',
        stepPhase: 'pilot',
        taskType: 'execution',
        priority: 'high',
        due_date_offset: 21
    },
    {
        title: 'Data Security Audit',
        description: 'Perform a comprehensive security audit of current OT systems.',
        status: 'blocked',
        stepPhase: 'design',
        taskType: 'analytical',
        priority: 'high',
        due_date_offset: 1
    }
];

function seedTasks() {
    return new Promise((resolve, reject) => {
        // 1. Find User and Organization
        db.get(`SELECT id, organization_id FROM users WHERE email = ?`, ['piotr.wisniewski@dbr77.com'], (err, user) => {
            if (err) return reject(err);
            if (!user) {
                // Fallback to finding any admin or superadmin
                db.get(`SELECT id, organization_id FROM users LIMIT 1`, (err, fallbackUser) => {
                    if (err) return reject(err);
                    if (!fallbackUser) return reject(new Error('No users found to assign tasks to.'));
                    insertTasksForUser(fallbackUser, resolve, reject);
                });
            } else {
                insertTasksForUser(user, resolve, reject);
            }
        });
    });
}

function insertTasksForUser(user, resolve, reject) {
    const { id: userId, organization_id: orgId } = user;

    // Check if project exists, if not create one or use null
    db.get(`SELECT id FROM projects WHERE organization_id = ? LIMIT 1`, [orgId], (err, project) => {
        const projectId = project ? project.id : null;

        let insertedCount = 0;
        let completed = 0;

        const stmt = db.prepare(`
            INSERT INTO tasks (
                id, project_id, organization_id, title, description, status, priority, 
                step_phase, task_type, due_date, assignee_id, reporter_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        db.serialize(() => {
            TASKS.forEach(t => {
                // Check if task with same title exists to avoid dupes on re-run
                db.get(`SELECT id FROM tasks WHERE title = ? AND organization_id = ?`, [t.title, orgId], (err, row) => {
                    if (!row) {
                        const dueDate = new Date();
                        dueDate.setDate(dueDate.getDate() + (t.due_date_offset || 0));

                        stmt.run(
                            uuidv4(),
                            projectId,
                            orgId,
                            t.title,
                            t.description,
                            t.status,
                            t.priority || 'medium',
                            t.stepPhase || 'execution',
                            t.taskType || 'general',
                            dueDate.toISOString(),
                            userId, // Assignee
                            userId, // Reporter
                            new Date().toISOString(),
                            (err) => {
                                if (err) console.error('Failed to insert task:', t.title, err);
                                else insertedCount++;
                            }
                        );
                    }
                });
            });

            stmt.finalize(() => {
                resolve({ message: 'Tasks seeding process completed.' });
            });
        });
    });
}

module.exports = { seedTasks };
