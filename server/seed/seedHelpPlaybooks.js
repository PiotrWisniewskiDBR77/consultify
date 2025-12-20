/**
 * Seed Help Playbooks
 * 
 * Core MVP playbooks for Demo, Trial, Paid, and Admin users.
 * Run this seed to populate the help_playbooks and help_steps tables.
 * 
 * Step 6: Enterprise+ Ready
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

/**
 * Core Playbooks Definition (MVP Required)
 */
const CORE_PLAYBOOKS = [
    // ==========================================
    // DEMO ORG PLAYBOOKS
    // ==========================================
    {
        key: 'demo_mode_explained',
        title: 'Understanding Demo Mode',
        description: 'Learn what you can do in Demo mode and its limitations.',
        targetRole: 'ANY',
        targetOrgType: 'DEMO',
        priority: 1,
        steps: [
            {
                title: 'Welcome to Demo Mode',
                contentMd: 'Demo mode gives you a **read-only preview** of the platform. You can explore all features, but changes won\'t be saved.',
                actionType: 'INFO'
            },
            {
                title: 'What You Can Do',
                contentMd: 'In Demo mode you can:\n- Browse projects, tasks, and initiatives\n- See AI recommendations (limited)\n- Explore the full UI',
                actionType: 'INFO'
            },
            {
                title: 'Ready for More?',
                contentMd: 'Start a **free 14-day trial** to unlock all features and save your work.',
                actionType: 'CTA',
                actionPayload: { label: 'Start Free Trial', route: '/auth?action=trial' }
            }
        ]
    },
    {
        key: 'start_trial_from_demo',
        title: 'Start Your Free Trial',
        description: 'Upgrade from Demo to a full-featured 14-day trial.',
        targetRole: 'ANY',
        targetOrgType: 'DEMO',
        priority: 2,
        steps: [
            {
                title: 'Why Start a Trial?',
                contentMd: 'A trial gives you:\n- **Full write access** to all features\n- **14 days free** to evaluate\n- Your data is preserved on upgrade',
                actionType: 'INFO'
            },
            {
                title: 'Getting Started',
                contentMd: 'Create your account with just an email address. No credit card required.',
                actionType: 'CTA',
                actionPayload: { label: 'Start Free Trial', route: '/auth?action=trial' }
            }
        ]
    },

    // ==========================================
    // TRIAL ORG PLAYBOOKS
    // ==========================================
    {
        key: 'trial_days_remaining',
        title: 'Your Trial Progress',
        description: 'Track your trial status and make the most of it.',
        targetRole: 'ANY',
        targetOrgType: 'TRIAL',
        priority: 1,
        steps: [
            {
                title: 'Trial Overview',
                contentMd: 'Your trial includes **full access** to all features. Make the most of your remaining days!',
                actionType: 'INFO'
            },
            {
                title: 'Key Features to Try',
                contentMd: '1. **Create projects** and initiatives\n2. **Invite team members** (up to 5)\n3. **Use AI features** for insights\n4. **Track progress** with dashboards',
                actionType: 'INFO'
            },
            {
                title: 'Need More Time?',
                contentMd: 'Contact support if you need a trial extension, or upgrade anytime to keep all your data.',
                actionType: 'CTA',
                actionPayload: { label: 'View Pricing', route: '/billing' }
            }
        ]
    },
    {
        key: 'invite_team',
        title: 'Invite Your Team',
        description: 'Collaboration is key. Invite colleagues to join your workspace.',
        targetRole: 'ADMIN',
        targetOrgType: 'TRIAL',
        priority: 2,
        steps: [
            {
                title: 'Why Invite Team Members?',
                contentMd: 'Get the full picture! Invite your team to:\n- **Collaborate** on projects\n- **Assign tasks** to the right people\n- **Get faster adoption** across your org',
                actionType: 'INFO'
            },
            {
                title: 'Trial Limits',
                contentMd: 'Your trial allows up to **5 team members**. Upgrade for unlimited seats.',
                actionType: 'INFO'
            },
            {
                title: 'Send Invitations',
                contentMd: 'Navigate to Settings → Team to invite colleagues by email.',
                actionType: 'CTA',
                actionPayload: { label: 'Go to Team Settings', route: '/settings/team' }
            }
        ]
    },
    {
        key: 'upgrade_to_paid',
        title: 'Upgrade to Full Access',
        description: 'Remove trial limits and unlock all features.',
        targetRole: 'ADMIN',
        targetOrgType: 'TRIAL',
        priority: 3,
        steps: [
            {
                title: 'Benefits of Upgrading',
                contentMd: '✅ **Unlimited** projects and users\n✅ **Full AI capabilities**\n✅ **Priority support**\n✅ Your trial data is preserved',
                actionType: 'INFO'
            },
            {
                title: 'Flexible Plans',
                contentMd: 'Choose from monthly or annual billing. Enterprise options available for larger teams.',
                actionType: 'CTA',
                actionPayload: { label: 'View Plans', route: '/billing/plans' }
            }
        ]
    },
    {
        key: 'trial_last_week_upgrade',
        title: 'Your Trial is Ending Soon',
        description: 'Less than 7 days left. Time to upgrade!',
        targetRole: 'ANY',
        targetOrgType: 'TRIAL',
        priority: 1,
        steps: [
            {
                title: 'Trial Ending Soon',
                contentMd: '⚠️ Your trial ends in less than 7 days.\n\n✅ Your data is **safe**\n✅ Upgrade to keep editing',
                actionType: 'INFO'
            },
            {
                title: 'Upgrade Now',
                contentMd: 'Choose a plan to continue with full features.',
                actionType: 'CTA',
                actionPayload: { label: 'Upgrade Now', route: '/settings?tab=billing' }
            }
        ]
    },
    {
        key: 'trial_expired_upgrade',
        title: 'Your Trial Has Expired',
        description: 'Upgrade to restore full access.',
        targetRole: 'ANY',
        targetOrgType: 'TRIAL',
        priority: 1,
        steps: [
            {
                title: 'Trial Expired',
                contentMd: '🔒 Your trial has ended. Workspace is **read-only**.\n\n✅ Data is **safe and preserved**\n✅ Upgrade to restore access',
                actionType: 'INFO'
            },
            {
                title: 'Restore Access',
                contentMd: 'Upgrade to unlock your workspace.',
                actionType: 'CTA',
                actionPayload: { label: 'Upgrade Now', route: '/settings?tab=billing', primary: true }
            }
        ]
    },
    {
        key: 'invite_blocked_explained',
        title: 'Why Can\'t I Invite Users?',
        description: 'Understand why invitations are blocked.',
        targetRole: 'ADMIN',
        targetOrgType: 'ANY',
        priority: 2,
        steps: [
            {
                title: 'Invitations Blocked',
                contentMd: 'Invitations blocked because:\n\n- Demo mode (read-only)\n- Trial expired\n- User limit reached',
                actionType: 'INFO'
            },
            {
                title: 'Unlock',
                contentMd: 'Upgrade to invite more team members.',
                actionType: 'CTA',
                actionPayload: { label: 'View Plans', route: '/settings?tab=billing' }
            }
        ]
    },

    // ==========================================
    // PAID ORG PLAYBOOKS
    // ==========================================
    {
        key: 'first_value_checklist',
        title: 'Getting Started Checklist',
        description: 'Set up your workspace for success.',
        targetRole: 'ADMIN',
        targetOrgType: 'PAID',
        priority: 1,
        steps: [
            {
                title: 'Welcome!',
                contentMd: 'Congratulations on upgrading! Let\'s set up your workspace for maximum value.',
                actionType: 'INFO'
            },
            {
                title: 'Step 1: Configure Your Organization',
                contentMd: 'Review org settings, set up branding, and configure defaults.',
                actionType: 'CTA',
                actionPayload: { label: 'Organization Settings', route: '/settings/organization' }
            },
            {
                title: 'Step 2: Invite Your Team',
                contentMd: 'Invite all stakeholders. No seat limits in your plan!',
                actionType: 'CTA',
                actionPayload: { label: 'Invite Team', route: '/settings/team' }
            },
            {
                title: 'Step 3: Create Your First Project',
                contentMd: 'Start managing work by creating your first project.',
                actionType: 'CTA',
                actionPayload: { label: 'New Project', route: '/projects/new' }
            }
        ]
    },
    {
        key: 'invite_users',
        title: 'Growing Your Team',
        description: 'Add more team members to your workspace.',
        targetRole: 'ADMIN',
        targetOrgType: 'PAID',
        priority: 2,
        steps: [
            {
                title: 'Adding Team Members',
                contentMd: 'As a paid customer, you have **no seat limits**. Invite as many users as you need.',
                actionType: 'INFO'
            },
            {
                title: 'Role-Based Access',
                contentMd: 'Assign roles to control what users can do:\n- **Admin**: Full control\n- **User**: Project access',
                actionType: 'INFO'
            },
            {
                title: 'Send Invitations',
                contentMd: 'Go to Team settings to send email invitations.',
                actionType: 'CTA',
                actionPayload: { label: 'Team Settings', route: '/settings/team' }
            }
        ]
    },
    {
        key: 'use_ai_features',
        title: 'AI-Powered Features',
        description: 'Unlock the power of AI in your workflow.',
        targetRole: 'ANY',
        targetOrgType: 'PAID',
        priority: 3,
        steps: [
            {
                title: 'AI Capabilities',
                contentMd: 'Your plan includes full AI access:\n- **Smart recommendations**\n- **Risk detection**\n- **Decision support**\n- **Executive reports**',
                actionType: 'INFO'
            },
            {
                title: 'AI Roles',
                contentMd: 'Configure AI behavior per project:\n- **Advisor**: Suggestions only\n- **Manager**: Can propose actions\n- **Operator**: Full automation',
                actionType: 'INFO'
            },
            {
                title: 'Try It Now',
                contentMd: 'Open a project and start a conversation with the AI assistant.',
                actionType: 'CTA',
                actionPayload: { label: 'Open AI Chat', action: 'open_ai_chat' }
            }
        ]
    },

    // ==========================================
    // ADMIN PLAYBOOKS (ANY Org Type)
    // ==========================================
    {
        key: 'manage_users',
        title: 'Managing Users',
        description: 'Learn how to add, remove, and manage user access.',
        targetRole: 'ADMIN',
        targetOrgType: 'ANY',
        priority: 3,
        steps: [
            {
                title: 'User Management Basics',
                contentMd: 'As an admin, you can:\n- **Invite new users**\n- **Change user roles**\n- **Deactivate users**\n- **View user activity**',
                actionType: 'INFO'
            },
            {
                title: 'User Roles',
                contentMd: '- **Admin**: Can manage org, users, and billing\n- **User**: Can work on assigned projects',
                actionType: 'INFO'
            },
            {
                title: 'Go to User Management',
                contentMd: 'Access all user controls in the admin panel.',
                actionType: 'CTA',
                actionPayload: { label: 'Manage Users', route: '/admin/users' }
            }
        ]
    },
    {
        key: 'billing_overview',
        title: 'Understanding Billing',
        description: 'View and manage your subscription and invoices.',
        targetRole: 'ADMIN',
        targetOrgType: 'ANY',
        priority: 4,
        steps: [
            {
                title: 'Billing Dashboard',
                contentMd: 'View your current plan, usage, and upcoming charges in the billing section.',
                actionType: 'INFO'
            },
            {
                title: 'Invoices & Receipts',
                contentMd: 'Download past invoices for your records and accounting.',
                actionType: 'INFO'
            },
            {
                title: 'View Billing',
                contentMd: 'Access your full billing history and payment methods.',
                actionType: 'CTA',
                actionPayload: { label: 'Go to Billing', route: '/billing' }
            }
        ]
    },
    {
        key: 'partner_attribution_explained',
        title: 'Partner Program',
        description: 'Understand how partner referrals and attribution works.',
        targetRole: 'ADMIN',
        targetOrgType: 'ANY',
        priority: 5,
        steps: [
            {
                title: 'What is Attribution?',
                contentMd: 'Attribution tracks how you discovered our platform - through a partner, promo code, or direct signup.',
                actionType: 'INFO'
            },
            {
                title: 'Your Attribution Info',
                contentMd: 'View your organization\'s referral source in Organization Settings.',
                actionType: 'CTA',
                actionPayload: { label: 'View Attribution', route: '/settings/organization' }
            }
        ]
    }
];

/**
 * Seed all playbooks and their steps
 */
const seedHelpPlaybooks = async () => {
    console.log('[SeedHelpPlaybooks] Starting seed...');

    return new Promise((resolve, reject) => {
        db.serialize(() => {
            let playbookCount = 0;
            let stepCount = 0;

            for (const playbook of CORE_PLAYBOOKS) {
                const playbookId = uuidv4();

                // Insert playbook
                db.run(
                    `INSERT OR REPLACE INTO help_playbooks (id, key, title, description, target_role, target_org_type, priority, is_active)
                     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
                    [playbookId, playbook.key, playbook.title, playbook.description, playbook.targetRole, playbook.targetOrgType, playbook.priority],
                    function (err) {
                        if (err) {
                            console.error(`[SeedHelpPlaybooks] Error inserting playbook ${playbook.key}:`, err);
                            return;
                        }
                        playbookCount++;
                    }
                );

                // Insert steps
                playbook.steps.forEach((step, index) => {
                    const stepId = uuidv4();
                    db.run(
                        `INSERT OR REPLACE INTO help_steps (id, playbook_id, step_order, title, content_md, ui_target, action_type, action_payload)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            stepId,
                            playbookId,
                            index + 1,
                            step.title,
                            step.contentMd,
                            step.uiTarget || null,
                            step.actionType,
                            JSON.stringify(step.actionPayload || {})
                        ],
                        function (err) {
                            if (err) {
                                console.error(`[SeedHelpPlaybooks] Error inserting step for ${playbook.key}:`, err);
                                return;
                            }
                            stepCount++;
                        }
                    );
                });
            }

            // Final callback
            db.run("SELECT 1", () => {
                console.log(`[SeedHelpPlaybooks] Completed: ${CORE_PLAYBOOKS.length} playbooks, ${CORE_PLAYBOOKS.reduce((sum, p) => sum + p.steps.length, 0)} steps.`);
                resolve({ playbookCount: CORE_PLAYBOOKS.length, stepCount: CORE_PLAYBOOKS.reduce((sum, p) => sum + p.steps.length, 0) });
            });
        });
    });
};

// Export for CLI or programmatic use
module.exports = { seedHelpPlaybooks, CORE_PLAYBOOKS };

// Run if called directly
if (require.main === module) {
    seedHelpPlaybooks()
        .then(() => {
            console.log('[SeedHelpPlaybooks] Done.');
            process.exit(0);
        })
        .catch(err => {
            console.error('[SeedHelpPlaybooks] Error:', err);
            process.exit(1);
        });
}
