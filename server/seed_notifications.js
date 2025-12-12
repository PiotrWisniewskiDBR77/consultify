const db = require('./database');
const { v4: uuidv4 } = require('uuid');

// Use the specific user ID we've been working with or fetch the first one
const TARGET_USER_EMAIL = 'piotr.wisniewski@dbr77.com';

const notifications = [
    {
        type: 'ai_insight',
        title: 'Strategy Optimization',
        message: 'AI has analyzed your recent project flow and suggests a 15% efficiency gain by reallocating "Strategy Report" resources.',
        data: {
            priority: 'high',
            category: 'ai',
            actionLabel: 'View Analysis',
            link: '/dashboard/analytics'
        },
        createdAt: new Date().toISOString() // Just now
    },
    {
        type: 'task_assigned',
        title: 'New Assignment: Q4 Review',
        message: 'Justyna assigned you to the "Q4 Financial Review" task. Due date is approaching.',
        data: {
            priority: 'normal',
            category: 'task',
            actionLabel: 'View Task',
            link: '/tasks/123'
        },
        createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString() // 30 mins ago
    },
    {
        type: 'system',
        title: 'System Update Completed',
        message: 'The platform has been updated to version 2.4.0. New features include "Team Collaboration Space".',
        data: {
            priority: 'normal',
            category: 'system',
            actionLabel: 'Read Changelog',
            link: '/settings'
        },
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() // 2 hours ago
    },
    {
        type: 'ai_message',
        title: 'Meeting Summary Ready',
        message: 'Your transcript from "Client Sync" has been processed. Action items have been extracted.',
        data: {
            priority: 'low',
            category: 'ai',
            actionLabel: 'Review Summary',
            link: '/chat'
        },
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() // 1 day ago
    },
    {
        type: 'alert',
        title: 'Subscription Renewing Soon',
        message: 'Your Pro Plan will renew in 3 days. Please ensure your payment method is up to date.',
        data: {
            priority: 'high',
            category: 'system',
            actionLabel: 'Billing Settings',
            link: '/settings/billing'
        },
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString() // 2 days ago
    }
];

db.serialize(() => {
    db.get('SELECT id FROM users WHERE email = ?', [TARGET_USER_EMAIL], (err, user) => {
        if (err) {
            console.error('Error finding user:', err);
            return;
        }
        if (!user) {
            console.error('User not found!');
            return;
        }

        console.log(`Seeding notifications for user ${user.id}...`);

        // Clear existing for clean slate (Optional, but good for testing)
        // db.run('DELETE FROM notifications WHERE user_id = ?', [user.id]);

        const stmt = db.prepare(`
            INSERT INTO notifications (id, user_id, type, title, message, data, read, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 0, ?)
        `);

        notifications.forEach(n => {
            stmt.run(
                uuidv4(),
                user.id,
                n.type,
                n.title,
                n.message,
                JSON.stringify(n.data),
                n.createdAt
            );
        });

        stmt.finalize(() => {
            console.log('Notifications seeded successfully!');
        });
    });
});
