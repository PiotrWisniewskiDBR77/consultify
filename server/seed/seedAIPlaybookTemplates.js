const db = require('../database');
const { v4: uuidv4 } = require('uuid');

/**
 * Seed AI Playbook Templates
 * Step 10: MVP templates for common AI-driven workflows
 */
async function seedAIPlaybookTemplates() {
    console.log('[SeedAIPlaybooks] Starting seed...');

    const templates = [
        {
            key: 'blocked_initiative_rescue',
            title: 'Blocked Initiative Rescue',
            description: 'AI-orchestrated workflow to unblock a stalled initiative through task creation, meeting scheduling, and stakeholder engagement.',
            triggerSignal: 'BLOCKED_INITIATIVE',
            estimatedDurationMins: 60,
            steps: [
                {
                    stepOrder: 1,
                    actionType: 'TASK_CREATE',
                    title: 'Create Unblocking Task',
                    description: 'Create a priority task to investigate and resolve the blocker',
                    payloadTemplate: {
                        title: 'Investigate blocker for {{entity_name}}',
                        description: 'Analysis of why {{entity_name}} is blocked and action plan to resolve.',
                        priority: 'high',
                        action_type: 'TASK_CREATE'
                    }
                },
                {
                    stepOrder: 2,
                    actionType: 'MEETING_SCHEDULE',
                    title: 'Schedule Unblocking Meeting',
                    description: 'Schedule a meeting with stakeholders to discuss the blocker',
                    payloadTemplate: {
                        summary: 'Unblocking Session: {{entity_name}}',
                        participants: ['{{assignee_email}}'],
                        action_type: 'MEETING_SCHEDULE'
                    }
                },
                {
                    stepOrder: 3,
                    actionType: 'PLAYBOOK_ASSIGN',
                    title: 'Assign Status Update Playbook',
                    description: 'Help the user learn how to provide effective status updates',
                    payloadTemplate: {
                        playbook_key: 'status_update_guide',
                        action_type: 'PLAYBOOK_ASSIGN'
                    },
                    isOptional: true
                }
            ]
        },
        {
            key: 'user_at_risk_engagement',
            title: 'User at Risk Engagement',
            description: 'Re-engage a user who shows signs of disengagement through targeted help and check-ins.',
            triggerSignal: 'USER_AT_RISK',
            estimatedDurationMins: 30,
            steps: [
                {
                    stepOrder: 1,
                    actionType: 'PLAYBOOK_ASSIGN',
                    title: 'Assign Quick-Start Playbook',
                    description: 'Guide the user through a quick-start flow to re-engage',
                    payloadTemplate: {
                        playbook_key: 'first_value_checklist',
                        action_type: 'PLAYBOOK_ASSIGN'
                    }
                },
                {
                    stepOrder: 2,
                    actionType: 'TASK_CREATE',
                    title: 'Create Check-In Task for Manager',
                    description: 'Create a task for the manager to check in with the user',
                    payloadTemplate: {
                        title: 'Check in with {{entity_name}} about platform usage',
                        description: 'User {{entity_name}} shows low engagement. Schedule a brief check-in.',
                        priority: 'medium',
                        action_type: 'TASK_CREATE'
                    }
                }
            ]
        },
        {
            key: 'overdue_tasks_cleanup',
            title: 'Overdue Tasks Cleanup',
            description: 'Systematic cleanup of overdue tasks with reprioritization and stakeholder communication.',
            triggerSignal: 'OVERDUE_TASK',
            estimatedDurationMins: 45,
            steps: [
                {
                    stepOrder: 1,
                    actionType: 'TASK_CREATE',
                    title: 'Create Triage Task',
                    description: 'Create a task to review and reprioritize overdue items',
                    payloadTemplate: {
                        title: 'Triage overdue tasks in project {{entity_name}}',
                        description: 'Review overdue tasks, update due dates or close obsolete items.',
                        priority: 'high',
                        action_type: 'TASK_CREATE'
                    }
                },
                {
                    stepOrder: 2,
                    actionType: 'MEETING_SCHEDULE',
                    title: 'Schedule Backlog Review',
                    description: 'Schedule a team meeting to review backlog priorities',
                    payloadTemplate: {
                        summary: 'Backlog Priority Review',
                        participants: [],
                        action_type: 'MEETING_SCHEDULE'
                    },
                    isOptional: true
                }
            ]
        }
    ];

    for (const tpl of templates) {
        const templateId = `apt-${tpl.key}`;

        // Upsert template
        await new Promise((resolve) => {
            db.run(
                `INSERT OR REPLACE INTO ai_playbook_templates 
                 (id, key, title, description, trigger_signal, estimated_duration_mins, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, 1)`,
                [templateId, tpl.key, tpl.title, tpl.description, tpl.triggerSignal, tpl.estimatedDurationMins],
                resolve
            );
        });

        // Delete existing steps
        await new Promise((resolve) => {
            db.run(`DELETE FROM ai_playbook_template_steps WHERE template_id = ?`, [templateId], resolve);
        });

        // Insert steps
        for (const step of tpl.steps) {
            const stepId = `aps-${tpl.key}-${step.stepOrder}`;
            await new Promise((resolve) => {
                db.run(
                    `INSERT INTO ai_playbook_template_steps 
                     (id, template_id, step_order, action_type, title, description, payload_template, is_optional, wait_for_previous)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        stepId, templateId, step.stepOrder, step.actionType, step.title, step.description,
                        JSON.stringify(step.payloadTemplate), step.isOptional ? 1 : 0, 1
                    ],
                    resolve
                );
            });
        }

        console.log(`[SeedAIPlaybooks] Seeded template: ${tpl.key} (${tpl.steps.length} steps)`);
    }

    console.log(`[SeedAIPlaybooks] Completed: ${templates.length} templates seeded.`);
}

module.exports = { seedAIPlaybookTemplates };

// Allow direct execution
if (require.main === module) {
    const db = require('../database');
    db.initPromise.then(() => {
        seedAIPlaybookTemplates().then(() => {
            console.log('Done.');
            process.exit(0);
        });
    });
}
