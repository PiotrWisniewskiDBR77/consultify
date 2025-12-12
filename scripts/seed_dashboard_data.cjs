const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.resolve(__dirname, '../server/consultify.db');
const db = new sqlite3.Database(dbPath);

const userId = 'user-dbr77-admin'; // Piotr
const orgId = 'org-dbr77-test';
const projectId = 'project-dbr77-001';

const notifications = [
    {
        type: 'system',
        title: 'System Update: Advanced AI Models',
        message: 'We have integrated new CoT (Chain of Thought) reasoning models for deeper strategic analysis.',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        priority: 'normal'
    },
    {
        type: 'task_assigned',
        title: 'Action Required: Finish Assessment',
        message: 'Your maturity assessment is 85% complete. Please finalize the "Data Governance" section.',
        createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
        priority: 'high'
    },
    {
        type: 'info',
        title: 'New Module: KPI Tracking',
        message: 'The "Economics & ROI" module has been updated with real-time ROI tracking capabilities.',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        priority: 'low'
    },
    {
        type: 'alert',
        title: 'Security Alert',
        message: 'New login detected from a new device. Please review your security settings.',
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 2 days ago
        priority: 'high'
    },
    {
        type: 'ai_insight',
        title: 'AI Recommendation: Process Optimization',
        message: 'Based on your recent input, we suggest automating the "Client Onboarding" flow. Potential time limits: 40%.',
        createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 mins ago
        priority: 'normal'
    },
    {
        type: 'task_assigned',
        title: 'Review: Q3 Strategy Report',
        message: 'The draft for Q3 Strategy is ready for your review.',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
        priority: 'normal'
    }
];

const tasks = [
    {
        title: 'Define Expectations & Challenges',
        description: 'Begin your journey by outlining your company\'s current state and strategic goals.',
        status: 'completed',
        stepPhase: 'design',
        taskType: 'analytical',
        dueDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
        title: 'Complete Maturity Assessment',
        description: 'Evaluate your organization across 7 key dimensions to identify gaps.',
        status: 'in_progress',
        stepPhase: 'design',
        taskType: 'analytical',
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
        title: 'Review Initiatives & Roadmap',
        description: 'Analyze AI-recommended initiatives and approve the transformation roadmap.',
        status: 'todo',
        stepPhase: 'design',
        taskType: 'execution',
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    }
];

db.serialize(() => {
    // Clear existing for clean slate
    db.run('DELETE FROM notifications WHERE user_id = ?', [userId]);
    db.run('DELETE FROM tasks WHERE organization_id = ?', [orgId]);

    const insertNotif = db.prepare('INSERT INTO notifications (id, user_id, type, title, message, read, created_at, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    notifications.forEach(n => {
        insertNotif.run(uuidv4(), userId, n.type, n.title, n.message, 0, n.createdAt, n.priority);
    });
    insertNotif.finalize();

    const insertTask = db.prepare(`
        INSERT INTO tasks (
            id, project_id, organization_id, title, description, status, priority, 
            step_phase, task_type, due_date, assignee_id, reporter_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    tasks.forEach(t => {
        insertTask.run(
            uuidv4(), projectId, orgId, t.title, t.description, t.status, 'high',
            t.stepPhase, t.taskType, t.dueDate, userId, userId, new Date().toISOString()
        );
    });
    insertTask.finalize();

    console.log('Seeded real dashboard data successfully.');
});

db.close();
