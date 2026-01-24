#!/usr/bin/env node
/**
 * MyWork Test Data Seeder
 * Seeds sample tasks and decisions with various variants for testing MyWorkHub UI
 *
 * Usage:
 *   cd server && npx tsx scripts/seed-mywork-test-data.ts
 */

import { v4 as uuidv4 } from 'uuid';
import { createDatabase } from '../src/database/Database.js';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
};

const log = {
  info: (msg: string) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  step: (msg: string) => console.log(`${colors.dim}  → ${msg}${colors.reset}`),
};

// Helper to get dates
const today = new Date();
const addDays = (days: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

// Sample tasks with various variants
const sampleTasks = [
  // Overdue tasks
  {
    title: 'Review Q4 Budget Report',
    description: 'Analyze and provide feedback on the quarterly budget report from finance team',
    status: 'in_progress',
    priority: 'high',
    due_date: addDays(-5), // 5 days overdue
  },
  {
    title: 'Submit compliance documentation',
    description: 'Complete and submit required compliance documentation for audit',
    status: 'todo',
    priority: 'urgent',
    due_date: addDays(-2), // 2 days overdue
  },
  {
    title: 'Fix critical production bug',
    description: 'Investigate and resolve the memory leak issue in the payment module',
    status: 'in_progress',
    priority: 'urgent',
    due_date: addDays(-1), // 1 day overdue
  },

  // Today's tasks
  {
    title: 'Team standup presentation',
    description: 'Prepare and present weekly progress update to the team',
    status: 'todo',
    priority: 'medium',
    due_date: addDays(0), // Today
  },
  {
    title: 'Review pull requests',
    description: 'Review and approve pending pull requests from development team',
    status: 'in_progress',
    priority: 'high',
    due_date: addDays(0), // Today
  },

  // This week tasks
  {
    title: 'Update project documentation',
    description: 'Update technical documentation with recent API changes',
    status: 'todo',
    priority: 'medium',
    due_date: addDays(2),
  },
  {
    title: 'Prepare demo for stakeholders',
    description: 'Create presentation and demo environment for upcoming stakeholder meeting',
    status: 'todo',
    priority: 'high',
    due_date: addDays(3),
  },
  {
    title: 'Code review session',
    description: 'Conduct code review session for new feature implementation',
    status: 'todo',
    priority: 'medium',
    due_date: addDays(4),
  },
  {
    title: 'Infrastructure planning',
    description: 'Plan cloud infrastructure upgrades for next quarter',
    status: 'todo',
    priority: 'low',
    due_date: addDays(5),
  },

  // Later tasks
  {
    title: 'Annual performance reviews',
    description: 'Complete performance review documentation for team members',
    status: 'todo',
    priority: 'medium',
    due_date: addDays(14),
  },
  {
    title: 'Technology stack evaluation',
    description: 'Evaluate new technologies for potential adoption in 2027',
    status: 'todo',
    priority: 'low',
    due_date: addDays(30),
  },

  // No date tasks
  {
    title: 'Refactor authentication module',
    description: 'Improve code quality and security of authentication system',
    status: 'todo',
    priority: 'medium',
    due_date: null,
  },
  {
    title: 'Research AI integration options',
    description: 'Explore AI/ML integration possibilities for product enhancement',
    status: 'todo',
    priority: 'low',
    due_date: null,
  },

  // Completed tasks
  {
    title: 'Deploy v2.5 release',
    description: 'Successfully deployed version 2.5 to production',
    status: 'completed',
    priority: 'high',
    due_date: addDays(-3),
  },
  {
    title: 'Security audit completion',
    description: 'Completed quarterly security audit with no critical findings',
    status: 'completed',
    priority: 'urgent',
    due_date: addDays(-7),
  },
];

// Sample decisions with various variants
const sampleDecisions = [
  // My decisions - Pending
  {
    title: 'Approve cloud migration budget',
    description: 'Approve $150,000 budget for AWS to Azure migration project',
    decision_type: 'BUDGET',
    status: 'PENDING',
    priority: 'HIGH',
    due_date: addDays(2),
    days_waiting: 3,
    is_owner: true,
  },
  {
    title: 'Select new CRM vendor',
    description: 'Choose between Salesforce and HubSpot for enterprise CRM implementation',
    decision_type: 'GENERAL',
    status: 'PENDING',
    priority: 'CRITICAL',
    due_date: addDays(-1), // Overdue
    days_waiting: 10,
    is_owner: true,
  },
  {
    title: 'Phase 2 Go/No-Go decision',
    description: 'Decide whether to proceed with Phase 2 of digital transformation project',
    decision_type: 'PHASE_TRANSITION',
    status: 'PENDING',
    priority: 'HIGH',
    due_date: addDays(5),
    days_waiting: 2,
    is_owner: true,
  },
  {
    title: 'Hire additional developers',
    description: 'Approve headcount increase for development team (3 senior developers)',
    decision_type: 'GENERAL',
    status: 'PENDING',
    priority: 'MEDIUM',
    due_date: addDays(7),
    days_waiting: 5,
    is_owner: true,
  },

  // My decisions - Escalated
  {
    title: 'Emergency infrastructure upgrade',
    description: 'Urgent decision required for critical infrastructure upgrade',
    decision_type: 'UNBLOCK',
    status: 'ESCALATED',
    priority: 'CRITICAL',
    due_date: addDays(-3), // Overdue
    days_waiting: 12,
    is_owner: true,
  },

  // Awaiting others - Pending
  {
    title: 'Marketing budget reallocation',
    description: 'Waiting for CMO approval on Q2 marketing budget changes',
    decision_type: 'BUDGET',
    status: 'PENDING',
    priority: 'MEDIUM',
    due_date: addDays(3),
    days_waiting: 4,
    is_owner: false,
  },
  {
    title: 'New office location selection',
    description: 'CEO decision pending on new headquarters location',
    decision_type: 'GENERAL',
    status: 'PENDING',
    priority: 'HIGH',
    due_date: addDays(10),
    days_waiting: 8,
    is_owner: false,
  },
  {
    title: 'Partnership agreement approval',
    description: 'Legal review pending for strategic partnership with TechCorp',
    decision_type: 'INITIATIVE_APPROVAL',
    status: 'PENDING',
    priority: 'HIGH',
    due_date: addDays(-2), // Overdue
    days_waiting: 14,
    is_owner: false,
  },

  // Completed decisions (for history)
  {
    title: 'Annual subscription renewal',
    description: 'Approved enterprise software subscription renewal',
    decision_type: 'BUDGET',
    status: 'APPROVED',
    priority: 'MEDIUM',
    due_date: addDays(-10),
    days_waiting: 0,
    is_owner: true,
  },
  {
    title: 'Project cancellation',
    description: 'Legacy system modernization project cancelled due to budget constraints',
    decision_type: 'GENERAL',
    status: 'REJECTED',
    priority: 'LOW',
    due_date: addDays(-15),
    days_waiting: 0,
    is_owner: true,
  },
];

// Sample notifications
const sampleNotifications = [
  {
    type: 'TASK_ASSIGNED',
    title: 'New task assigned: Review API Documentation',
    message: 'You have been assigned a new task to review the updated API documentation',
    severity: 'INFO',
    read: false,
    scope: 'PERSONAL',
    created_at: addDays(0) + 'T10:30:00Z',
  },
  {
    type: 'DECISION_REQUIRED',
    title: 'Decision required: Budget approval pending',
    message: 'Your approval is needed for the Q2 marketing budget reallocation',
    severity: 'WARNING',
    read: false,
    scope: 'PROJECT',
    created_at: addDays(0) + 'T09:15:00Z',
  },
  {
    type: 'TASK_OVERDUE',
    title: 'Task overdue: Submit compliance documentation',
    message: 'The compliance documentation task is now 2 days overdue',
    severity: 'CRITICAL',
    read: false,
    scope: 'PERSONAL',
    created_at: addDays(-1) + 'T14:00:00Z',
  },
  {
    type: 'AI_RECOMMENDATION',
    title: 'AI Insight: Resource optimization opportunity',
    message: 'Analysis suggests 15% cost reduction possible through infrastructure optimization',
    severity: 'INFO',
    read: false,
    scope: 'PROJECT',
    created_at: addDays(-1) + 'T11:00:00Z',
  },
  {
    type: 'GATE_PENDING_APPROVAL',
    title: 'Stage Gate Review: Phase 2 ready',
    message: 'Phase 2 of the transformation project is ready for your review',
    severity: 'WARNING',
    read: true,
    scope: 'PROJECT',
    created_at: addDays(-2) + 'T16:30:00Z',
  },
  {
    type: 'DECISION_OVERDUE',
    title: 'Overdue: CRM vendor selection',
    message: 'The CRM vendor selection decision is 10 days overdue',
    severity: 'CRITICAL',
    read: true,
    scope: 'PROJECT',
    created_at: addDays(-3) + 'T08:00:00Z',
  },
  {
    type: 'AI_RISK_DETECTED',
    title: 'Risk Alert: Budget overrun predicted',
    message: 'AI predicts potential 12% budget overrun if current spending continues',
    severity: 'WARNING',
    read: true,
    scope: 'PROJECT',
    created_at: addDays(-4) + 'T10:45:00Z',
  },
  {
    type: 'TASK_BLOCKED',
    title: 'Task blocked: Integration testing',
    message: 'Integration testing is blocked pending API documentation review',
    severity: 'WARNING',
    read: false,
    scope: 'PROJECT',
    created_at: addDays(-5) + 'T13:20:00Z',
  },
  {
    type: 'AI_RECOMMENDATION',
    title: 'AI Suggestion: Team capacity',
    message: 'Consider redistributing tasks - Team Alpha has 30% more capacity than Team Beta',
    severity: 'INFO',
    read: true,
    scope: 'PROJECT',
    created_at: addDays(-6) + 'T09:00:00Z',
  },
];

async function main() {
  console.log('\n🚀 MyWork Test Data Seeder\n');

  try {
    const db = await createDatabase();
    log.info('Connected to database');

    // Get current user and organization
    const userResult = await db.get(`SELECT id, organization_id FROM users LIMIT 1`);
    
    if (!userResult) {
      log.error('No users found in database. Please run the main seeder first.');
      process.exit(1);
    }

    const userId = userResult.id;
    const orgId = userResult.organization_id;

    log.info(`Using user: ${userId}`);
    log.info(`Using organization: ${orgId}`);

    // Get or create a project
    let project = await db.get(`SELECT id FROM projects WHERE organization_id = ? LIMIT 1`, [orgId]);
    
    if (!project) {
      const projectId = uuidv4();
      await db.run(`
        INSERT INTO projects (id, name, code, description, organization_id, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `, [projectId, 'MyWork Test Project', 'MWTP', 'Test project for MyWork module', orgId, 'active']);
      project = { id: projectId };
      log.step('Created test project');
    }

    // Seed tasks
    log.info('Seeding tasks...');
    for (const task of sampleTasks) {
      const taskId = uuidv4();
      await db.run(`
        INSERT INTO tasks (id, title, description, status, priority, due_date, assignee_id, organization_id, project_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `, [
        taskId,
        task.title,
        task.description,
        task.status,
        task.priority,
        task.due_date,
        userId,
        orgId,
        project.id
      ]);
      log.step(`Created task: ${task.title} (${task.priority}, ${task.status})`);
    }
    log.success(`Seeded ${sampleTasks.length} tasks`);

    // Seed decisions
    log.info('Seeding decisions...');
    for (const decision of sampleDecisions) {
      const decisionId = uuidv4();
      const ownerId = decision.is_owner ? userId : null;
      const requesterId = decision.is_owner ? null : userId;
      
      await db.run(`
        INSERT INTO decisions (id, title, description, decision_type, status, priority, due_date, decision_owner_id, requested_by_id, organization_id, project_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
      `, [
        decisionId,
        decision.title,
        decision.description,
        decision.decision_type,
        decision.status,
        decision.priority,
        decision.due_date,
        ownerId,
        requesterId,
        orgId,
        project.id,
        `-${decision.days_waiting} days`
      ]);
      log.step(`Created decision: ${decision.title} (${decision.priority}, ${decision.status})`);
    }
    log.success(`Seeded ${sampleDecisions.length} decisions`);

    // Seed notifications
    log.info('Seeding notifications...');
    for (const notification of sampleNotifications) {
      const notifId = uuidv4();
      await db.run(`
        INSERT INTO notifications (id, user_id, type, title, message, severity, read, scope, project_id, organization_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        notifId,
        userId,
        notification.type,
        notification.title,
        notification.message,
        notification.severity,
        notification.read ? 1 : 0,
        notification.scope,
        project.id,
        orgId,
        notification.created_at
      ]);
      log.step(`Created notification: ${notification.title} (${notification.severity})`);
    }
    log.success(`Seeded ${sampleNotifications.length} notifications`);

    console.log('\n✅ MyWork test data seeded successfully!\n');
    console.log('Summary:');
    console.log(`  • Tasks: ${sampleTasks.length}`);
    console.log(`    - Overdue: 3`);
    console.log(`    - Today: 2`);
    console.log(`    - This Week: 4`);
    console.log(`    - Later: 2`);
    console.log(`    - No Date: 2`);
    console.log(`    - Completed: 2`);
    console.log(`  • Decisions: ${sampleDecisions.length}`);
    console.log(`    - My Decisions (Pending): 4`);
    console.log(`    - My Decisions (Escalated): 1`);
    console.log(`    - Awaiting Others: 3`);
    console.log(`    - Completed: 2`);
    console.log(`  • Notifications: ${sampleNotifications.length}`);
    console.log(`    - Unread: 5`);
    console.log(`    - Read: 4`);
    console.log('');

    process.exit(0);
  } catch (error: any) {
    log.error(`Seeding failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

main();
