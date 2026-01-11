/**
 * Seed Help Playbooks
 *
 * Core MVP playbooks for Demo, Trial, Paid, and Admin users.
 * Run this seed to populate the help_playbooks and help_steps tables.
 *
 * Step 6: Enterprise+ Ready
 */

import { getDatabase } from '../src/database/Database.js';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';

/**
 * Core Playbooks Definition (MVP Required)
 */
const CORE_PLAYBOOKS = [
  // ==========================================
  // DEMO ORG PLAYBOOKS
  // ==========================================
  {
    key: 'demo_mode_explained',
    title: 'help.playbooks.demo_mode_explained.title',
    description: 'help.playbooks.demo_mode_explained.description',
    targetRole: 'ANY',
    targetOrgType: 'DEMO',
    priority: 1,
    steps: [
      {
        title: 'help.playbooks.demo_mode_explained.steps.1.title',
        contentMd: 'help.playbooks.demo_mode_explained.steps.1.content',
        actionType: 'INFO',
      },
      {
        title: 'help.playbooks.demo_mode_explained.steps.2.title',
        contentMd: 'help.playbooks.demo_mode_explained.steps.2.content',
        actionType: 'INFO',
      },
      {
        title: 'help.playbooks.demo_mode_explained.steps.3.title',
        contentMd: 'help.playbooks.demo_mode_explained.steps.3.content',
        actionType: 'CTA',
        actionPayload: {
          label: 'help.playbooks.demo_mode_explained.steps.3.action',
          route: '/auth?action=trial',
        },
      },
    ],
  },
  {
    key: 'start_trial_from_demo',
    title: 'help.playbooks.start_trial_from_demo.title',
    description: 'help.playbooks.start_trial_from_demo.description',
    targetRole: 'ANY',
    targetOrgType: 'DEMO',
    priority: 2,
    steps: [
      {
        title: 'help.playbooks.start_trial_from_demo.steps.1.title',
        contentMd: 'help.playbooks.start_trial_from_demo.steps.1.content',
        actionType: 'INFO',
      },
      {
        title: 'help.playbooks.start_trial_from_demo.steps.2.title',
        contentMd: 'help.playbooks.start_trial_from_demo.steps.2.content',
        actionType: 'CTA',
        actionPayload: {
          label: 'help.playbooks.start_trial_from_demo.steps.2.action',
          route: '/auth?action=trial',
        },
      },
    ],
  },

  // ==========================================
  // TRIAL ORG PLAYBOOKS
  // ==========================================
  {
    key: 'trial_days_remaining',
    title: 'help.playbooks.trial_days_remaining.title',
    description: 'help.playbooks.trial_days_remaining.description',
    targetRole: 'ANY',
    targetOrgType: 'TRIAL',
    priority: 1,
    steps: [
      {
        title: 'help.playbooks.trial_days_remaining.steps.1.title',
        contentMd: 'help.playbooks.trial_days_remaining.steps.1.content',
        actionType: 'INFO',
      },
      {
        title: 'help.playbooks.trial_days_remaining.steps.2.title',
        contentMd: 'help.playbooks.trial_days_remaining.steps.2.content',
        actionType: 'INFO',
      },
      {
        title: 'help.playbooks.trial_days_remaining.steps.3.title',
        contentMd: 'help.playbooks.trial_days_remaining.steps.3.content',
        actionType: 'CTA',
        actionPayload: {
          label: 'help.playbooks.trial_days_remaining.steps.3.action',
          route: '/billing',
        },
      },
    ],
  },
  {
    key: 'invite_team',
    title: 'help.playbooks.invite_team.title',
    description: 'help.playbooks.invite_team.description',
    targetRole: 'ADMIN',
    targetOrgType: 'TRIAL',
    priority: 2,
    steps: [
      {
        title: 'help.playbooks.invite_team.steps.1.title',
        contentMd: 'help.playbooks.invite_team.steps.1.content',
        actionType: 'INFO',
      },
      {
        title: 'help.playbooks.invite_team.steps.2.title',
        contentMd: 'help.playbooks.invite_team.steps.2.content',
        actionType: 'INFO',
      },
      {
        title: 'help.playbooks.invite_team.steps.3.title',
        contentMd: 'help.playbooks.invite_team.steps.3.content',
        actionType: 'CTA',
        actionPayload: {
          label: 'help.playbooks.invite_team.steps.3.action',
          route: '/settings/team',
        },
      },
    ],
  },
  {
    key: 'upgrade_to_paid',
    title: 'help.playbooks.upgrade_to_paid.title',
    description: 'help.playbooks.upgrade_to_paid.description',
    targetRole: 'ADMIN',
    targetOrgType: 'TRIAL',
    priority: 3,
    steps: [
      {
        title: 'help.playbooks.upgrade_to_paid.steps.1.title',
        contentMd: 'help.playbooks.upgrade_to_paid.steps.1.content',
        actionType: 'INFO',
      },
      {
        title: 'help.playbooks.upgrade_to_paid.steps.2.title',
        contentMd: 'help.playbooks.upgrade_to_paid.steps.2.content',
        actionType: 'CTA',
        actionPayload: {
          label: 'help.playbooks.upgrade_to_paid.steps.2.action',
          route: '/billing/plans',
        },
      },
    ],
  },
  {
    key: 'trial_last_week_upgrade',
    title: 'help.playbooks.trial_last_week_upgrade.title',
    description: 'help.playbooks.trial_last_week_upgrade.description',
    targetRole: 'ANY',
    targetOrgType: 'TRIAL',
    priority: 1,
    steps: [
      {
        title: 'help.playbooks.trial_last_week_upgrade.steps.1.title',
        contentMd: 'help.playbooks.trial_last_week_upgrade.steps.1.content',
        actionType: 'INFO',
      },
      {
        title: 'help.playbooks.trial_last_week_upgrade.steps.2.title',
        contentMd: 'help.playbooks.trial_last_week_upgrade.steps.2.content',
        actionType: 'CTA',
        actionPayload: {
          label: 'help.playbooks.trial_last_week_upgrade.steps.2.action',
          route: '/settings?tab=billing',
        },
      },
    ],
  },
  {
    key: 'trial_expired_upgrade',
    title: 'help.playbooks.trial_expired_upgrade.title',
    description: 'help.playbooks.trial_expired_upgrade.description',
    targetRole: 'ANY',
    targetOrgType: 'TRIAL',
    priority: 1,
    steps: [
      {
        title: 'help.playbooks.trial_expired_upgrade.steps.1.title',
        contentMd: 'help.playbooks.trial_expired_upgrade.steps.1.content',
        actionType: 'INFO',
      },
      {
        title: 'help.playbooks.trial_expired_upgrade.steps.2.title',
        contentMd: 'help.playbooks.trial_expired_upgrade.steps.2.content',
        actionType: 'CTA',
        actionPayload: {
          label: 'help.playbooks.trial_expired_upgrade.steps.2.action',
          route: '/settings?tab=billing',
          primary: true,
        },
      },
    ],
  },
  {
    key: 'invite_blocked_explained',
    title: 'help.playbooks.invite_blocked_explained.title',
    description: 'help.playbooks.invite_blocked_explained.description',
    targetRole: 'ADMIN',
    targetOrgType: 'ANY',
    priority: 2,
    steps: [
      {
        title: 'help.playbooks.invite_blocked_explained.steps.1.title',
        contentMd: 'help.playbooks.invite_blocked_explained.steps.1.content',
        actionType: 'INFO',
      },
      {
        title: 'help.playbooks.invite_blocked_explained.steps.2.title',
        contentMd: 'help.playbooks.invite_blocked_explained.steps.2.content',
        actionType: 'CTA',
        actionPayload: {
          label: 'help.playbooks.invite_blocked_explained.steps.2.action',
          route: '/settings?tab=billing',
        },
      },
    ],
  },

  // ==========================================
  // PAID ORG PLAYBOOKS
  // ==========================================
  {
    key: 'first_value_checklist',
    title: 'help.playbooks.first_value_checklist.title',
    description: 'help.playbooks.first_value_checklist.description',
    targetRole: 'ADMIN',
    targetOrgType: 'PAID',
    priority: 1,
    steps: [
      {
        title: 'help.playbooks.first_value_checklist.steps.1.title',
        contentMd: 'help.playbooks.first_value_checklist.steps.1.content',
        actionType: 'INFO',
      },
      {
        title: 'help.playbooks.first_value_checklist.steps.2.title',
        contentMd: 'help.playbooks.first_value_checklist.steps.2.content',
        actionType: 'CTA',
        actionPayload: {
          label: 'help.playbooks.first_value_checklist.steps.2.action',
          route: '/settings/organization',
        },
      },
      {
        title: 'help.playbooks.first_value_checklist.steps.3.title',
        contentMd: 'help.playbooks.first_value_checklist.steps.3.content',
        actionType: 'CTA',
        actionPayload: {
          label: 'help.playbooks.first_value_checklist.steps.3.action',
          route: '/settings/team',
        },
      },
      {
        title: 'help.playbooks.first_value_checklist.steps.4.title',
        contentMd: 'help.playbooks.first_value_checklist.steps.4.content',
        actionType: 'CTA',
        actionPayload: {
          label: 'help.playbooks.first_value_checklist.steps.4.action',
          route: '/projects/new',
        },
      },
    ],
  },
  {
    key: 'invite_users',
    title: 'help.playbooks.invite_users.title',
    description: 'help.playbooks.invite_users.description',
    targetRole: 'ADMIN',
    targetOrgType: 'PAID',
    priority: 2,
    steps: [
      {
        title: 'help.playbooks.invite_users.steps.1.title',
        contentMd: 'help.playbooks.invite_users.steps.1.content',
        actionType: 'INFO',
      },
      {
        title: 'help.playbooks.invite_users.steps.2.title',
        contentMd: 'help.playbooks.invite_users.steps.2.content',
        actionType: 'INFO',
      },
      {
        title: 'help.playbooks.invite_users.steps.3.title',
        contentMd: 'help.playbooks.invite_users.steps.3.content',
        actionType: 'CTA',
        actionPayload: {
          label: 'help.playbooks.invite_users.steps.3.action',
          route: '/settings/team',
        },
      },
    ],
  },
  {
    key: 'use_ai_features',
    title: 'help.playbooks.use_ai_features.title',
    description: 'help.playbooks.use_ai_features.description',
    targetRole: 'ANY',
    targetOrgType: 'PAID',
    priority: 3,
    steps: [
      {
        title: 'help.playbooks.use_ai_features.steps.1.title',
        contentMd: 'help.playbooks.use_ai_features.steps.1.content',
        actionType: 'INFO',
      },
      {
        title: 'help.playbooks.use_ai_features.steps.2.title',
        contentMd: 'help.playbooks.use_ai_features.steps.2.content',
        actionType: 'INFO',
      },
      {
        title: 'help.playbooks.use_ai_features.steps.3.title',
        contentMd: 'help.playbooks.use_ai_features.steps.3.content',
        actionType: 'CTA',
        actionPayload: {
          label: 'help.playbooks.use_ai_features.steps.3.action',
          action: 'open_ai_chat',
        },
      },
    ],
  },

  // ==========================================
  // ADMIN PLAYBOOKS (ANY Org Type)
  // ==========================================
  {
    key: 'manage_users',
    title: 'help.playbooks.manage_users.title',
    description: 'help.playbooks.manage_users.description',
    targetRole: 'ADMIN',
    targetOrgType: 'ANY',
    priority: 3,
    steps: [
      {
        title: 'help.playbooks.manage_users.steps.1.title',
        contentMd: 'help.playbooks.manage_users.steps.1.content',
        actionType: 'INFO',
      },
      {
        title: 'help.playbooks.manage_users.steps.2.title',
        contentMd: 'help.playbooks.manage_users.steps.2.content',
        actionType: 'INFO',
      },
      {
        title: 'help.playbooks.manage_users.steps.3.title',
        contentMd: 'help.playbooks.manage_users.steps.3.content',
        actionType: 'CTA',
        actionPayload: {
          label: 'help.playbooks.manage_users.steps.3.action',
          route: '/admin/users',
        },
      },
    ],
  },
  {
    key: 'billing_overview',
    title: 'help.playbooks.billing_overview.title',
    description: 'help.playbooks.billing_overview.description',
    targetRole: 'ADMIN',
    targetOrgType: 'ANY',
    priority: 4,
    steps: [
      {
        title: 'help.playbooks.billing_overview.steps.1.title',
        contentMd: 'help.playbooks.billing_overview.steps.1.content',
        actionType: 'INFO',
      },
      {
        title: 'help.playbooks.billing_overview.steps.2.title',
        contentMd: 'help.playbooks.billing_overview.steps.2.content',
        actionType: 'INFO',
      },
      {
        title: 'help.playbooks.billing_overview.steps.3.title',
        contentMd: 'help.playbooks.billing_overview.steps.3.content',
        actionType: 'CTA',
        actionPayload: {
          label: 'help.playbooks.billing_overview.steps.3.action',
          route: '/billing',
        },
      },
    ],
  },
  {
    key: 'partner_attribution_explained',
    title: 'help.playbooks.partner_attribution_explained.title',
    description: 'help.playbooks.partner_attribution_explained.description',
    targetRole: 'ADMIN',
    targetOrgType: 'ANY',
    priority: 5,
    steps: [
      {
        title: 'help.playbooks.partner_attribution_explained.steps.1.title',
        contentMd: 'help.playbooks.partner_attribution_explained.steps.1.content',
        actionType: 'INFO',
      },
      {
        title: 'help.playbooks.partner_attribution_explained.steps.2.title',
        contentMd: 'help.playbooks.partner_attribution_explained.steps.2.content',
        actionType: 'CTA',
        actionPayload: {
          label: 'help.playbooks.partner_attribution_explained.steps.2.action',
          route: '/settings/organization',
        },
      },
    ],
  },
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
          [
            playbookId,
            playbook.key,
            playbook.title,
            playbook.description,
            playbook.targetRole,
            playbook.targetOrgType,
            playbook.priority,
          ],
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
              JSON.stringify(step.actionPayload || {}),
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
      db.run('SELECT 1', () => {
        console.log(
          `[SeedHelpPlaybooks] Completed: ${CORE_PLAYBOOKS.length} playbooks, ${CORE_PLAYBOOKS.reduce((sum, p) => sum + p.steps.length, 0)} steps.`
        );
        resolve({
          playbookCount: CORE_PLAYBOOKS.length,
          stepCount: CORE_PLAYBOOKS.reduce((sum, p) => sum + p.steps.length, 0),
        });
      });
    });
  });
};

// Export for CLI or programmatic use
export { seedHelpPlaybooks, CORE_PLAYBOOKS };

export default { seedHelpPlaybooks, CORE_PLAYBOOKS };

// Run if called directly
if (require.main === module) {
  seedHelpPlaybooks()
    .then(() => {
      console.log('[SeedHelpPlaybooks] Done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[SeedHelpPlaybooks] Error:', err);
      process.exit(1);
    });
}
