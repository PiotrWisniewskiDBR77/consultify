/**
 * Seed: realistic execution data for all 11 P03 Execution Reports.
 *
 * Populates: initiatives, tasks, decisions, raid_items, initiative_milestones,
 * initiative_budgets, budget_line_items — enough for every report to render
 * with real, testable data including overdue work, blockers, budget variance,
 * capacity stress and decision debt.
 *
 * Run:
 *   DATABASE_URL=<public-pg-url> npx tsx server/scripts/seed-execution-reports-data.ts
 *
 * Safe: uses ON CONFLICT DO NOTHING / DO UPDATE so re-runs are idempotent.
 */

import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

const ORG = 'dbr77';
const USER_ID = 'bf0f01a2-9ada-4cb8-a331-4dce1930e4f3';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}
function daysFromNow(n: number) {
  return new Date(Date.now() + n * 86_400_000).toISOString();
}

/* ────── Org / User / Team ────── */

async function ensureOrg() {
  await pool.query(`
    INSERT INTO organizations (id, name, plan, status, is_active, created_at)
    VALUES ($1, 'DBR77', 'enterprise', 'active', 1, NOW())
    ON CONFLICT (id) DO NOTHING
  `, [ORG]);
}

async function ensureUser() {
  await pool.query(`
    INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status, is_active, created_at)
    VALUES ($1, $2, 'piotr@dbr77.com', 'hashed', 'Piotr', 'Wiśniewski', 'ADMIN', 'active', 1, NOW())
    ON CONFLICT (id) DO NOTHING
  `, [USER_ID, ORG]);
}

const team = [
  { id: uuid(), first: 'Anna',      last: 'Kowalska',     email: 'anna.kowalska@dbr77.com' },
  { id: uuid(), first: 'Marek',     last: 'Nowak',        email: 'marek.nowak@dbr77.com' },
  { id: uuid(), first: 'Katarzyna', last: 'Wójcik',       email: 'katarzyna.wojcik@dbr77.com' },
  { id: uuid(), first: 'Jan',       last: 'Zieliński',    email: 'jan.zielinski@dbr77.com' },
  { id: uuid(), first: 'Ewa',       last: 'Nowicka',      email: 'ewa.nowicka@dbr77.com' },
  { id: uuid(), first: 'Tomasz',    last: 'Lewandowski',  email: 'tomasz.lewandowski@dbr77.com' },
  { id: uuid(), first: 'Marta',     last: 'Kamińska',     email: 'marta.kaminska@dbr77.com' },
  { id: uuid(), first: 'Paweł',     last: 'Mazur',        email: 'pawel.mazur@dbr77.com' },
];

async function ensureTeam() {
  for (const m of team) {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [m.email]);
    if (existing.rows.length > 0) {
      m.id = existing.rows[0].id;
    } else {
      await pool.query(`
        INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status, is_active, created_at)
        VALUES ($1, $2, $3, 'hashed', $4, $5, 'MEMBER', 'active', 1, NOW())
        ON CONFLICT (id) DO NOTHING
      `, [m.id, ORG, m.email, m.first, m.last]);
    }
  }
}

/* ────── Project ────── */

const PROJECT_ID = uuid();

async function ensureProject() {
  await pool.query(`
    INSERT INTO projects (id, organization_id, name, description, status, owner_id, current_phase, created_at)
    VALUES ($1, $2, 'Transformacja Cyfrowa Q2-Q3 2026', 'Program transformacji cyfrowej organizacji — fala wykonawcza Q2-Q3 2026', 'active', $3, 'execution', NOW())
    ON CONFLICT (id) DO NOTHING
  `, [PROJECT_ID, ORG, USER_ID]);
}

/* ────── Initiatives ────── */

const initiatives = [
  { id: uuid(), name: 'Cloud Migration — Azure',        status: 'IN_EXECUTION', owner: 0, priority: 'HIGH',     startOff: -30, endOff: 45,  progress: 42 },
  { id: uuid(), name: 'Data Platform — Lakehouse',      status: 'IN_EXECUTION', owner: 1, priority: 'HIGH',     startOff: -20, endOff: 60,  progress: 28 },
  { id: uuid(), name: 'API Gateway v2',                 status: 'IN_EXECUTION', owner: 2, priority: 'MEDIUM',   startOff: -15, endOff: 30,  progress: 65 },
  { id: uuid(), name: 'Process Automation — RPA',       status: 'IN_EXECUTION', owner: 3, priority: 'HIGH',     startOff: -25, endOff: 40,  progress: 15 },
  { id: uuid(), name: 'Security Hardening',             status: 'IN_EXECUTION', owner: 4, priority: 'CRITICAL', startOff: -10, endOff: 20,  progress: 55 },
  { id: uuid(), name: 'Customer Portal Redesign',       status: 'APPROVED', owner: 5, priority: 'MEDIUM',   startOff: 5,   endOff: 75,  progress: 0 },
  { id: uuid(), name: 'ERP SAP Integration',            status: 'IN_EXECUTION', owner: 1, priority: 'HIGH',     startOff: -35, endOff: 50,  progress: 18 },
  { id: uuid(), name: 'Legacy Decommission',            status: 'IN_EXECUTION', owner: 3, priority: 'LOW',      startOff: -40, endOff: 90,  progress: 35 },
  { id: uuid(), name: 'DevOps Maturity Program',        status: 'IN_EXECUTION', owner: 6, priority: 'MEDIUM',   startOff: -12, endOff: 55,  progress: 40 },
  { id: uuid(), name: 'AI-Powered Analytics',           status: 'APPROVED', owner: 4, priority: 'HIGH',     startOff: 10,  endOff: 80,  progress: 0 },
  { id: uuid(), name: 'Compliance & GDPR Audit',        status: 'IN_EXECUTION', owner: 2, priority: 'CRITICAL', startOff: -8,  endOff: 15,  progress: 72 },
  { id: uuid(), name: 'Talent Upskilling Program',      status: 'IN_EXECUTION', owner: 5, priority: 'MEDIUM',   startOff: -18, endOff: 65,  progress: 10 },
  { id: uuid(), name: 'Vendor Consolidation',           status: 'IN_EXECUTION', owner: 7, priority: 'LOW',      startOff: -22, endOff: 35,  progress: 50 },
  { id: uuid(), name: 'Digital Workplace Platform',     status: 'IN_EXECUTION', owner: 6, priority: 'MEDIUM',   startOff: -14, endOff: 48,  progress: 30 },
  { id: uuid(), name: 'Supply Chain Optimization',      status: 'IN_EXECUTION', owner: 7, priority: 'HIGH',     startOff: -10, endOff: 55,  progress: 22 },
];

async function seedInitiatives() {
  for (const init of initiatives) {
    const ownerId = team[init.owner].id;
    await pool.query(`
      INSERT INTO initiatives (id, organization_id, project_id, name, status, priority,
        owner_execution_id, planned_start_date, planned_end_date, progress, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status, priority = EXCLUDED.priority, progress = EXCLUDED.progress,
        planned_start_date = EXCLUDED.planned_start_date, planned_end_date = EXCLUDED.planned_end_date,
        updated_at = NOW()
    `, [
      init.id, ORG, PROJECT_ID, init.name, init.status, init.priority,
      ownerId, daysAgo(-init.startOff), daysFromNow(init.endOff), init.progress,
    ]);
  }
  console.log(`  ✓ ${initiatives.length} initiatives`);
}

/* ────── Tasks ────── */

type TaskTpl = { init: number; title: string; status: string; assignee: number; dueOff: number; hours: number };

const taskTemplates: TaskTpl[] = [
  // Cloud Migration (0) — mix of done, in_progress, overdue, future
  { init: 0, title: 'Migrate auth service to Azure',       status: 'in_progress', assignee: 1, dueOff: 5,   hours: 24 },
  { init: 0, title: 'Set up AKS cluster',                  status: 'done',        assignee: 1, dueOff: -10, hours: 16 },
  { init: 0, title: 'Database migration plan',             status: 'in_progress', assignee: 2, dueOff: 10,  hours: 32 },
  { init: 0, title: 'Network security groups config',      status: 'todo',        assignee: 0, dueOff: 14,  hours: 8 },
  { init: 0, title: 'Load testing after migration',        status: 'todo',        assignee: 3, dueOff: 20,  hours: 12 },
  { init: 0, title: 'VM sizing for prod environment',      status: 'in_progress', assignee: 1, dueOff: -7,  hours: 8 },
  { init: 0, title: 'Monitoring dashboard setup',          status: 'in_progress', assignee: 1, dueOff: 2,   hours: 8 },
  { init: 0, title: 'Cost optimization review',            status: 'todo',        assignee: 0, dueOff: 18,  hours: 6 },

  // Data Platform (1)
  { init: 1, title: 'Set up Delta Lake storage',           status: 'done',        assignee: 1, dueOff: -12, hours: 20 },
  { init: 1, title: 'Build ingestion pipelines',           status: 'in_progress', assignee: 4, dueOff: 8,   hours: 40 },
  { init: 1, title: 'Create data quality checks',          status: 'todo',        assignee: 2, dueOff: 15,  hours: 16 },
  { init: 1, title: 'Dashboard prototyping',               status: 'todo',        assignee: 5, dueOff: 25,  hours: 24 },
  { init: 1, title: 'Data governance policy draft',        status: 'in_progress', assignee: 4, dueOff: -5,  hours: 12 },
  { init: 1, title: 'Spark job optimization',              status: 'in_progress', assignee: 4, dueOff: 1,   hours: 12 },

  // API Gateway (2)
  { init: 2, title: 'Rate limiting middleware',             status: 'in_progress', assignee: 2, dueOff: 3,   hours: 12 },
  { init: 2, title: 'API versioning strategy doc',         status: 'done',        assignee: 2, dueOff: -8,  hours: 8 },
  { init: 2, title: 'Observability integration',           status: 'blocked',     assignee: 3, dueOff: -2,  hours: 16 },
  { init: 2, title: 'API documentation update',            status: 'in_progress', assignee: 2, dueOff: -3,  hours: 6 },

  // Process Automation BLOCKED (3)
  { init: 3, title: 'UiPath license procurement',          status: 'blocked',     assignee: 3, dueOff: -10, hours: 4 },
  { init: 3, title: 'Process mapping workshop',            status: 'done',        assignee: 5, dueOff: -18, hours: 16 },
  { init: 3, title: 'First bot development',               status: 'blocked',     assignee: 3, dueOff: -5,  hours: 40 },
  { init: 3, title: 'UAT for invoice bot',                 status: 'todo',        assignee: 4, dueOff: 12,  hours: 8 },

  // Security Hardening (4)
  { init: 4, title: 'Penetration test execution',          status: 'in_progress', assignee: 4, dueOff: 5,   hours: 24 },
  { init: 4, title: 'SOC2 evidence collection',            status: 'in_progress', assignee: 0, dueOff: 7,   hours: 32 },
  { init: 4, title: 'ZeroTrust network policy',            status: 'todo',        assignee: 4, dueOff: 12,  hours: 16 },
  { init: 4, title: 'Vulnerability scan report',           status: 'in_progress', assignee: 4, dueOff: -2,  hours: 8 },

  // Customer Portal SCHEDULED (5)
  { init: 5, title: 'UX research & interviews',            status: 'todo',        assignee: 5, dueOff: 20,  hours: 24 },
  { init: 5, title: 'Wireframes & prototyping',            status: 'todo',        assignee: 5, dueOff: 35,  hours: 32 },
  { init: 5, title: 'Tech stack decision',                 status: 'todo',        assignee: 6, dueOff: 15,  hours: 8 },

  // ERP SAP BLOCKED (6)
  { init: 6, title: 'SAP FI module config',                status: 'blocked',     assignee: 1, dueOff: -8,  hours: 40 },
  { init: 6, title: 'Integration middleware setup',         status: 'blocked',     assignee: 3, dueOff: -3,  hours: 24 },
  { init: 6, title: 'Data migration dry run',              status: 'todo',        assignee: 1, dueOff: 15,  hours: 16 },
  { init: 6, title: 'SAP MM module testing',               status: 'todo',        assignee: 7, dueOff: 25,  hours: 20 },

  // Legacy Decommission (7)
  { init: 7, title: 'Legacy CRM data export',              status: 'in_progress', assignee: 0, dueOff: 3,   hours: 16 },
  { init: 7, title: 'Monolith service decomposition',      status: 'in_progress', assignee: 3, dueOff: 10,  hours: 40 },
  { init: 7, title: 'Redirect DNS and traffic',            status: 'todo',        assignee: 2, dueOff: 30,  hours: 4 },

  // DevOps (8)
  { init: 8, title: 'CI/CD pipeline for all services',     status: 'in_progress', assignee: 6, dueOff: 5,   hours: 24 },
  { init: 8, title: 'Infrastructure as Code (Terraform)',   status: 'in_progress', assignee: 1, dueOff: 8,   hours: 32 },
  { init: 8, title: 'SRE runbook creation',                status: 'todo',        assignee: 0, dueOff: 20,  hours: 12 },
  { init: 8, title: 'Grafana alert rules',                 status: 'in_progress', assignee: 6, dueOff: 3,   hours: 6 },

  // AI Analytics SCHEDULED (9) — no tasks yet, intentionally sparse
  { init: 9, title: 'ML pipeline architecture doc',        status: 'todo',        assignee: 4, dueOff: 30,  hours: 16 },
  { init: 9, title: 'Data labeling strategy',              status: 'todo',        assignee: 7, dueOff: 40,  hours: 12 },

  // Compliance GDPR (10)
  { init: 10, title: 'GDPR data mapping',                  status: 'in_progress', assignee: 4, dueOff: 3,   hours: 16 },
  { init: 10, title: 'Privacy impact assessment',          status: 'in_progress', assignee: 0, dueOff: 5,   hours: 12 },
  { init: 10, title: 'Remediation action plan',            status: 'todo',        assignee: 2, dueOff: 10,  hours: 8 },
  { init: 10, title: 'DPIA submission deadline',           status: 'in_progress', assignee: 0, dueOff: 2,   hours: 4 },

  // Talent Upskilling BLOCKED (11)
  { init: 11, title: 'Training curriculum design',         status: 'done',        assignee: 5, dueOff: -15, hours: 16 },
  { init: 11, title: 'Cloud certification program',        status: 'blocked',     assignee: 5, dueOff: -5,  hours: 40 },
  { init: 11, title: 'AI/ML workshop series',              status: 'todo',        assignee: 4, dueOff: 20,  hours: 24 },

  // Vendor Consolidation (12)
  { init: 12, title: 'Vendor audit & scoring',             status: 'in_progress', assignee: 7, dueOff: 5,   hours: 16 },
  { init: 12, title: 'Contract renegotiation',             status: 'todo',        assignee: 3, dueOff: 15,  hours: 12 },
  { init: 12, title: 'Migration from deprecated vendors',  status: 'todo',        assignee: 1, dueOff: 25,  hours: 24 },

  // Digital Workplace (13)
  { init: 13, title: 'MS Teams governance policy',         status: 'in_progress', assignee: 6, dueOff: 4,   hours: 8 },
  { init: 13, title: 'Intranet migration to SharePoint',   status: 'in_progress', assignee: 6, dueOff: -4,  hours: 24 },
  { init: 13, title: 'SSO integration',                    status: 'todo',        assignee: 2, dueOff: 18,  hours: 12 },

  // Supply Chain (14)
  { init: 14, title: 'Demand forecasting model',           status: 'in_progress', assignee: 7, dueOff: 7,   hours: 32 },
  { init: 14, title: 'Supplier portal MVP',                status: 'todo',        assignee: 5, dueOff: 22,  hours: 20 },
  { init: 14, title: 'Inventory optimization algorithm',   status: 'in_progress', assignee: 7, dueOff: -1,  hours: 24 },
  { init: 14, title: 'Logistics dashboard',                status: 'todo',        assignee: 6, dueOff: 30,  hours: 16 },

  // Extra overdue tasks without assignee (hygiene gaps)
  { init: 0, title: 'Azure cost allocation tags',          status: 'todo',        assignee: -1, dueOff: -4, hours: 4 },
  { init: 1, title: 'Data catalog setup',                  status: 'todo',        assignee: -1, dueOff: -2, hours: 8 },
  { init: 8, title: 'Terraform state migration',           status: 'todo',        assignee: -1, dueOff: 6,  hours: 4 },

  // Tasks with no due date (missing dates hygiene)
  { init: 7, title: 'Legacy API documentation',            status: 'in_progress', assignee: 3, dueOff: 9999, hours: 8 },
  { init: 13, title: 'Workplace analytics setup',          status: 'todo',        assignee: 6, dueOff: 9999, hours: 6 },
];

async function seedTasks() {
  for (const t of taskTemplates) {
    const initId = initiatives[t.init].id;
    const assigneeId = t.assignee >= 0 ? team[t.assignee].id : null;
    const dueDate = t.dueOff === 9999 ? null : (t.dueOff >= 0 ? daysFromNow(t.dueOff) : daysAgo(-t.dueOff));
    await pool.query(`
      INSERT INTO tasks (id, organization_id, project_id, initiative_id, title, status, priority,
        assignee_id, due_date, estimated_hours, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'MEDIUM', $7, $8, $9, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, [uuid(), ORG, PROJECT_ID, initId, t.title, t.status, assigneeId, dueDate, t.hours]);
  }
  console.log(`  ✓ ${taskTemplates.length} tasks`);
}

/* ────── Decisions ────── */

const decisionTemplates = [
  { title: 'Budget Approval Q2 — Cloud Migration',                 status: 'PENDING',   init: 0,  deadlineOff: -10, priority: 'HIGH',     maker: 0 },
  { title: 'Vendor selection — SAP integration partner',           status: 'PENDING',   init: 6,  deadlineOff: -5,  priority: 'HIGH',     maker: 1 },
  { title: 'Go/No-Go — Data Platform MVP',                        status: 'PENDING',   init: 1,  deadlineOff: 3,   priority: 'HIGH',     maker: 0 },
  { title: 'Security architecture — ZeroTrust approach',           status: 'APPROVED',  init: 4,  deadlineOff: -15, priority: 'CRITICAL', maker: 4 },
  { title: 'RPA vendor change to Automation Anywhere',             status: 'PENDING',   init: 3,  deadlineOff: -3,  priority: 'MEDIUM',   maker: 3 },
  { title: 'Scope reduction for Legacy Decommission',              status: 'DEFERRED',  init: 7,  deadlineOff: -8,  priority: 'LOW',      maker: 0 },
  { title: 'Hire 2 senior cloud engineers (contractor)',           status: 'PENDING',   init: 0,  deadlineOff: 5,   priority: 'HIGH',     maker: 0 },
  { title: 'Customer Portal — React vs Angular',                   status: 'APPROVED',  init: 5,  deadlineOff: -20, priority: 'MEDIUM',   maker: 5 },
  { title: 'Training budget increase for upskilling',              status: 'PENDING',   init: 11, deadlineOff: -2,  priority: 'MEDIUM',   maker: 5 },
  { title: 'Compliance remediation deadline extension',            status: 'PENDING',   init: 10, deadlineOff: 2,   priority: 'CRITICAL', maker: 2 },
  { title: 'Data platform — Databricks vs Snowflake',             status: 'PENDING',   init: 1,  deadlineOff: -7,  priority: 'HIGH',     maker: 1 },
  { title: 'DevOps toolchain consolidation',                       status: 'PENDING',   init: 8,  deadlineOff: -1,  priority: 'MEDIUM',   maker: 6 },
  { title: 'Supply chain AI vendor shortlist',                     status: 'PENDING',   init: 14, deadlineOff: 8,   priority: 'HIGH',     maker: 7 },
  { title: 'SAP go-live date rebaseline approval',                 status: 'PENDING',   init: 6,  deadlineOff: -12, priority: 'HIGH',     maker: 0 },
  { title: 'Digital Workplace — M365 E5 license upgrade',          status: 'PENDING',   init: 13, deadlineOff: 4,   priority: 'MEDIUM',   maker: 6 },
];

async function seedDecisions() {
  for (const d of decisionTemplates) {
    const initId = initiatives[d.init].id;
    const makerId = team[d.maker].id;
    await pool.query(`
      INSERT INTO decisions (id, organization_id, project_id, initiative_id, title, type, status, priority,
        decision_maker_id, deadline, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 'APPROVAL', $6, $7, $8, $9, $10, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, [
      uuid(), ORG, PROJECT_ID, initId, d.title, d.status, d.priority,
      makerId,
      d.deadlineOff >= 0 ? daysFromNow(d.deadlineOff) : daysAgo(-d.deadlineOff),
      USER_ID,
    ]);
  }
  console.log(`  ✓ ${decisionTemplates.length} decisions`);
}

/* ────── RAID Items (risk signals, issues, dependencies) ────── */

const raidItems = [
  { type: 'RISK',       title: 'Azure region outage risk',                     status: 'OPEN', prob: 'MEDIUM', impact: 'HIGH',     init: 0,  score: 12 },
  { type: 'RISK',       title: 'Data loss during Lakehouse migration',          status: 'OPEN', prob: 'LOW',    impact: 'CRITICAL', init: 1,  score: 15 },
  { type: 'RISK',       title: 'SAP vendor hotfix delay',                       status: 'OPEN', prob: 'HIGH',   impact: 'HIGH',     init: 6,  score: 16 },
  { type: 'RISK',       title: 'GDPR non-compliance penalty',                   status: 'OPEN', prob: 'MEDIUM', impact: 'CRITICAL', init: 10, score: 18 },
  { type: 'RISK',       title: 'Key person dependency — Marek Nowak',           status: 'OPEN', prob: 'HIGH',   impact: 'HIGH',     init: 0,  score: 16 },
  { type: 'RISK',       title: 'Budget overrun on contractor hiring',           status: 'OPEN', prob: 'MEDIUM', impact: 'MEDIUM',   init: 0,  score: 9 },
  { type: 'RISK',       title: 'Legacy data corruption during decommission',    status: 'OPEN', prob: 'LOW',    impact: 'HIGH',     init: 7,  score: 10 },
  { type: 'RISK',       title: 'Supply chain data quality risk',                status: 'OPEN', prob: 'HIGH',   impact: 'HIGH',     init: 14, score: 16 },
  { type: 'RISK',       title: 'DevOps pipeline single point of failure',       status: 'OPEN', prob: 'MEDIUM', impact: 'MEDIUM',   init: 8,  score: 9 },
  { type: 'ISSUE',      title: 'UiPath license expired — blocking RPA',         status: 'OPEN', prob: 'HIGH',   impact: 'HIGH',     init: 3,  score: 16 },
  { type: 'ISSUE',      title: 'SAP integration middleware timeout errors',     status: 'OPEN', prob: 'HIGH',   impact: 'CRITICAL', init: 6,  score: 20 },
  { type: 'ISSUE',      title: 'CI/CD flaky tests blocking deploys',            status: 'OPEN', prob: 'MEDIUM', impact: 'MEDIUM',   init: 8,  score: 9 },
  { type: 'ISSUE',      title: 'SharePoint migration data loss incident',       status: 'OPEN', prob: 'HIGH',   impact: 'HIGH',     init: 13, score: 16 },
  { type: 'DEPENDENCY', title: 'API Gateway depends on Auth Service migration', status: 'OPEN', prob: 'HIGH',   impact: 'HIGH',     init: 2,  score: 16 },
  { type: 'DEPENDENCY', title: 'Data Platform depends on Cloud network setup',  status: 'OPEN', prob: 'MEDIUM', impact: 'HIGH',     init: 1,  score: 12 },
  { type: 'DEPENDENCY', title: 'Supply Chain depends on Data Platform feeds',   status: 'OPEN', prob: 'MEDIUM', impact: 'HIGH',     init: 14, score: 12 },
];

async function seedRaidItems() {
  for (const r of raidItems) {
    const initId = initiatives[r.init].id;
    const ownerId = team[r.init % team.length].id;
    await pool.query(`
      INSERT INTO raid_items (id, organization_id, initiative_id, type, title, status, probability, impact,
        owner_id, risk_score, score_category, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, [
      uuid(), ORG, initId, r.type, r.title, r.status, r.prob, r.impact,
      ownerId, r.score, r.score >= 15 ? 'CRITICAL' : r.score >= 10 ? 'HIGH' : 'MEDIUM',
    ]);
  }
  console.log(`  ✓ ${raidItems.length} RAID items`);
}

/* ────── Milestones ────── */

const milestoneTemplates = [
  { init: 0,  name: 'Cloud infra ready for prod',       targetOff: 14,  status: 'PENDING' },
  { init: 0,  name: 'Full migration cutover',           targetOff: 40,  status: 'PENDING' },
  { init: 1,  name: 'Data Platform MVP live',           targetOff: 20,  status: 'PENDING' },
  { init: 1,  name: 'First analytics dashboard',        targetOff: 50,  status: 'PENDING' },
  { init: 2,  name: 'API Gateway v2 production release', targetOff: 10, status: 'IN_PROGRESS' },
  { init: 3,  name: 'First RPA bot in production',      targetOff: 25,  status: 'DELAYED' },
  { init: 4,  name: 'SOC2 Type II certification',       targetOff: 18,  status: 'IN_PROGRESS' },
  { init: 5,  name: 'Portal UX approved by stakeholders', targetOff: 30, status: 'PENDING' },
  { init: 6,  name: 'SAP FI module go-live',            targetOff: 35,  status: 'DELAYED' },
  { init: 7,  name: 'Legacy CRM fully decommissioned',  targetOff: 60,  status: 'PENDING' },
  { init: 8,  name: 'All services on CI/CD',            targetOff: 22,  status: 'IN_PROGRESS' },
  { init: 10, name: 'GDPR audit passed',                targetOff: 12,  status: 'IN_PROGRESS' },
  { init: 11, name: '50% team certified on cloud',      targetOff: 40,  status: 'DELAYED' },
  { init: 12, name: 'Vendor count reduced to 6',        targetOff: 28,  status: 'PENDING' },
  { init: 13, name: 'Intranet fully on SharePoint',     targetOff: 30,  status: 'PENDING' },
  { init: 14, name: 'Forecasting model accuracy >85%',  targetOff: 35,  status: 'PENDING' },
];

async function seedMilestones() {
  for (let idx = 0; idx < milestoneTemplates.length; idx++) {
    const m = milestoneTemplates[idx];
    const initId = initiatives[m.init].id;
    await pool.query(`
      INSERT INTO initiative_milestones (id, initiative_id, organization_id, name, target_date, status, order_index, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, [uuid(), initId, ORG, m.name, daysFromNow(m.targetOff), m.status, idx]);
  }
  console.log(`  ✓ ${milestoneTemplates.length} milestones`);
}

/* ────── Budgets ────── */

const budgetTemplates = [
  { init: 0,  planned: 850_000, actual: 920_000,  cat: 'TECHNOLOGY' },
  { init: 1,  planned: 600_000, actual: 580_000,  cat: 'TECHNOLOGY' },
  { init: 2,  planned: 180_000, actual: 165_000,  cat: 'TECHNOLOGY' },
  { init: 3,  planned: 350_000, actual: 120_000,  cat: 'CONSULTING' },
  { init: 4,  planned: 280_000, actual: 310_000,  cat: 'CONSULTING' },
  { init: 5,  planned: 420_000, actual: 0,         cat: 'TECHNOLOGY' },
  { init: 6,  planned: 950_000, actual: 780_000,  cat: 'CONSULTING' },
  { init: 7,  planned: 150_000, actual: 130_000,  cat: 'INFRASTRUCTURE' },
  { init: 8,  planned: 220_000, actual: 190_000,  cat: 'TECHNOLOGY' },
  { init: 9,  planned: 500_000, actual: 0,         cat: 'TECHNOLOGY' },
  { init: 10, planned: 120_000, actual: 145_000,  cat: 'CONSULTING' },
  { init: 11, planned: 200_000, actual: 65_000,   cat: 'TRAINING' },
  { init: 12, planned: 80_000,  actual: 55_000,   cat: 'CONSULTING' },
  { init: 13, planned: 300_000, actual: 280_000,  cat: 'TECHNOLOGY' },
  { init: 14, planned: 450_000, actual: 390_000,  cat: 'TECHNOLOGY' },
];

async function seedBudgets() {
  for (const b of budgetTemplates) {
    const initId = initiatives[b.init].id;
    const budgetId = uuid();
    await pool.query(`
      INSERT INTO initiative_budgets (id, organization_id, initiative_id, budget_type, planned_amount, approved_amount, currency, fiscal_year, status, created_at, updated_at)
      VALUES ($1, $2, $3, 'COMBINED', $4, $4, 'PLN', 2026, 'APPROVED', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, [budgetId, ORG, initId, b.planned]);

    await pool.query(`
      INSERT INTO budget_line_items (id, budget_id, category, description, planned_amount, actual_amount, forecast_amount, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, [uuid(), budgetId, b.cat, `${initiatives[b.init].name} — ${b.cat.toLowerCase()}`, b.planned, b.actual, b.actual * 1.05]);
  }
  console.log(`  ✓ ${budgetTemplates.length} budgets with line items`);
}

/* ────── Main ────── */

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  Seed: Execution Reports Data (P03)             ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  org: ${ORG}`);
  console.log(`  db:  ${process.env.DATABASE_URL?.replace(/\/\/[^@]+@/, '//***@')}`);
  console.log('');

  await ensureOrg();
  console.log('  ✓ organization');

  await ensureUser();
  console.log('  ✓ admin user');

  await ensureTeam();
  console.log(`  ✓ ${team.length} team members`);

  await ensureProject();
  console.log('  ✓ project');

  await seedInitiatives();
  await seedTasks();
  await seedDecisions();
  await seedRaidItems();
  await seedMilestones();
  await seedBudgets();

  console.log('');
  console.log('  Summary:');
  console.log(`    ${initiatives.length} initiatives (3 IN_EXECUTION[was BLOCKED], 2 APPROVED[was SCHEDULED], 10 IN_EXECUTION[was EXECUTING])`);
  console.log(`    ${taskTemplates.length} tasks (incl. overdue, blocked, unassigned, no-due-date)`);
  console.log(`    ${decisionTemplates.length} decisions (incl. 11 PENDING with aging)`);
  console.log(`    ${raidItems.length} RAID items (risks, issues, dependencies)`);
  console.log(`    ${milestoneTemplates.length} milestones (incl. 3 DELAYED)`);
  console.log(`    ${budgetTemplates.length} budgets with line items (incl. overspend on Cloud, Security, Compliance)`);
  console.log('');
  console.log('  Done! Refresh the browser to see data in Execution > Raporty.');
  await pool.end();
}

main().catch((e) => {
  console.error('SEED ERROR:', e);
  pool.end();
  process.exit(1);
});
