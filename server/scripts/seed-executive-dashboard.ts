/**
 * Seed script: populates dbr77 org with comprehensive data for the Executive Dashboard.
 * Covers: Portfolio Health, KPI Grid, Action Required, Decision Queue, Team Performance,
 *         AI Signals, Initiatives, Work Patterns, AI Operator.
 *
 * Run: npx tsx server/scripts/seed-executive-dashboard.ts
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
  return new Date(Date.now() - n * 86400000).toISOString();
}
function daysFromNow(n: number) {
  return new Date(Date.now() + n * 86400000).toISOString();
}
function hoursAgo(n: number) {
  return new Date(Date.now() - n * 3600000).toISOString();
}

// ─── Phase 0: Clean previous seeded data ───────────────────────────────────

async function cleanPreviousData() {
  console.log('  Cleaning previous demo data...');
  await pool.query(`DELETE FROM ai_operator_plans WHERE organization_id = $1`, [ORG]);
  await pool.query(`DELETE FROM ai_operator_profiles WHERE organization_id = $1`, [ORG]);
  await pool.query(`DELETE FROM tasks WHERE organization_id = $1`, [ORG]);
  await pool.query(`DELETE FROM decisions WHERE organization_id = $1`, [ORG]);
  await pool.query(`DELETE FROM initiatives WHERE organization_id = $1`, [ORG]);
  try { await pool.query(`DELETE FROM raid_items WHERE organization_id = $1`, [ORG]); } catch {}
  try { await pool.query(`DELETE FROM meetings WHERE organization_id = $1`, [ORG]); } catch {}
  try { await pool.query(`DELETE FROM conversations WHERE organization_id = $1`, [ORG]); } catch {}
  await pool.query(`DELETE FROM projects WHERE organization_id = $1`, [ORG]);
  await pool.query(`DELETE FROM users WHERE organization_id = $1 AND id != $2`, [ORG, USER_ID]);
  console.log('  ✓ cleaned');
}

// ─── Phase 1: Ensure org + user ────────────────────────────────────────────

async function ensureOrg() {
  await pool.query(`
    INSERT INTO organizations (id, name, plan, status, is_active, created_at)
    VALUES ($1, 'DBR77 Digital Consulting', 'enterprise', 'active', 1, NOW())
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, plan = EXCLUDED.plan, status = EXCLUDED.status
  `, [ORG]);
}

async function ensureUser() {
  await pool.query(`
    INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status, created_at)
    VALUES ($1, $2, 'piotr@dbr77.com', 'hashed', 'Piotr', 'Wiśniewski', 'ADMIN', 'active', NOW())
    ON CONFLICT (id) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name
  `, [USER_ID, ORG]);
}

// ─── Phase 2: Team members (for Team Capacity) ────────────────────────────

const teamMembers = [
  { id: uuid(), first: 'Anna', last: 'Kowalska', email: 'anna.kowalska@dbr77.com' },
  { id: uuid(), first: 'Marek', last: 'Nowak', email: 'marek.nowak@dbr77.com' },
  { id: uuid(), first: 'Katarzyna', last: 'Wójcik', email: 'katarzyna.wojcik@dbr77.com' },
  { id: uuid(), first: 'Jan', last: 'Zieliński', email: 'jan.zielinski@dbr77.com' },
  { id: uuid(), first: 'Ewa', last: 'Nowicka', email: 'ewa.nowicka@dbr77.com' },
  { id: uuid(), first: 'Tomasz', last: 'Lewandowski', email: 'tomasz.lewandowski@dbr77.com' },
];

async function ensureTeam() {
  for (const m of teamMembers) {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [m.email]);
    if (existing.rows.length > 0) {
      m.id = existing.rows[0].id;
    } else {
      await pool.query(`
        INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status, created_at)
        VALUES ($1, $2, $3, 'hashed', $4, $5, 'MEMBER', 'active', NOW())
        ON CONFLICT (id) DO NOTHING
      `, [m.id, ORG, m.email, m.first, m.last]);
    }
  }
  console.log(`  ✓ ${teamMembers.length} team members`);
}

// ─── Phase 3: Project + Initiatives ────────────────────────────────────────

const PROJECT_ID = uuid();

async function ensureProject() {
  await pool.query(`
    INSERT INTO projects (id, organization_id, name, description, status, owner_id, current_phase, created_at)
    VALUES ($1, $2, 'Transformacja Cyfrowa Q2 2026', 'Program transformacji cyfrowej — Q2 2026', 'active', $3, 'execution', NOW())
    ON CONFLICT (id) DO NOTHING
  `, [PROJECT_ID, ORG, USER_ID]);
}

// DEC-424: IN_PROGRESS/ACTIVE/BLOCKED/PLANNING były poprawne przed migracją P12
// (20262103_p12_initiative_status_slownik.sql); initiatives_status_check_p12 dopuszcza
// dziś wyłącznie 7 kodów z server/src/constants/initiativeStatuses.ts.
const initiatives = [
  { id: uuid(), name: 'Cloud Migration — Azure', status: 'IN_EXECUTION', priority: 'HIGH', owner: 0, startOff: -30, endOff: 45 },
  { id: uuid(), name: 'Data Platform — Lakehouse', status: 'IN_EXECUTION', priority: 'HIGH', owner: 1, startOff: -20, endOff: 60 },
  { id: uuid(), name: 'API Gateway v2', status: 'IN_EXECUTION', priority: 'MEDIUM', owner: 2, startOff: -15, endOff: 30 },
  { id: uuid(), name: 'Process Automation — RPA', status: 'IN_EXECUTION', priority: 'HIGH', owner: 3, startOff: -25, endOff: 40 },
  { id: uuid(), name: 'Security Hardening', status: 'IN_EXECUTION', priority: 'CRITICAL', owner: 4, startOff: -10, endOff: 20 },
  { id: uuid(), name: 'Customer Portal Redesign', status: 'PENDING_APPROVAL', priority: 'MEDIUM', owner: 5, startOff: 5, endOff: 75 },
];

async function seedInitiatives() {
  for (const init of initiatives) {
    await pool.query(`
      INSERT INTO initiatives (id, organization_id, project_id, name, status, priority,
        owner_execution_id, start_date, end_date, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, [
      init.id, ORG, PROJECT_ID, init.name, init.status, init.priority,
      teamMembers[init.owner].id,
      daysAgo(-init.startOff), daysFromNow(init.endOff),
    ]);
  }
  console.log(`  ✓ ${initiatives.length} initiatives`);
}

// ─── Phase 4: Tasks (mix of done, in_progress, overdue, todo) ──────────────
// Target stats: ~45 tasks, ~18 done, ~15 in_progress (some overdue), ~12 todo

const taskTemplates: Array<{
  init: number; title: string; status: string; assignee: number;
  dueOff: number; hours: number; completedOff?: number;
}> = [
  // Done tasks (18) — completed in last 2 weeks
  { init: 0, title: 'Azure subscription setup', status: 'done', assignee: 0, dueOff: -14, hours: 8, completedOff: 15 },
  { init: 0, title: 'Set up Azure Kubernetes cluster', status: 'done', assignee: 1, dueOff: -10, hours: 16, completedOff: 11 },
  { init: 0, title: 'Network security groups config', status: 'done', assignee: 2, dueOff: -7, hours: 8, completedOff: 8 },
  { init: 1, title: 'Set up Delta Lake storage', status: 'done', assignee: 1, dueOff: -12, hours: 20, completedOff: 13 },
  { init: 1, title: 'Schema design for raw layer', status: 'done', assignee: 4, dueOff: -8, hours: 12, completedOff: 9 },
  { init: 2, title: 'API versioning strategy', status: 'done', assignee: 2, dueOff: -9, hours: 8, completedOff: 10 },
  { init: 2, title: 'Gateway authentication module', status: 'done', assignee: 2, dueOff: -6, hours: 16, completedOff: 7 },
  { init: 3, title: 'Process mapping workshop', status: 'done', assignee: 5, dueOff: -15, hours: 16, completedOff: 16 },
  { init: 4, title: 'Security audit kickoff', status: 'done', assignee: 4, dueOff: -8, hours: 4, completedOff: 9 },
  { init: 4, title: 'Vulnerability scan phase 1', status: 'done', assignee: 4, dueOff: -5, hours: 12, completedOff: 6 },
  { init: 0, title: 'CI/CD for Azure Functions', status: 'done', assignee: 1, dueOff: -4, hours: 8, completedOff: 5 },
  { init: 1, title: 'Data catalog setup', status: 'done', assignee: 4, dueOff: -6, hours: 12, completedOff: 7 },
  { init: 0, title: 'Cost estimation for prod environment', status: 'done', assignee: 0, dueOff: -11, hours: 6, completedOff: 12 },
  { init: 4, title: 'SOC2 readiness checklist', status: 'done', assignee: 0, dueOff: -3, hours: 8, completedOff: 4 },
  { init: 2, title: 'Rate limiting spike', status: 'done', assignee: 3, dueOff: -5, hours: 4, completedOff: 6 },
  { init: 5, title: 'Stakeholder interviews round 1', status: 'done', assignee: 5, dueOff: -2, hours: 12, completedOff: 3 },
  { init: 1, title: 'Access control policies for Lakehouse', status: 'done', assignee: 1, dueOff: -3, hours: 6, completedOff: 4 },
  { init: 0, title: 'Azure DevOps project configuration', status: 'done', assignee: 2, dueOff: -13, hours: 4, completedOff: 14 },

  // In-progress tasks (15) — some on time, some overdue
  { init: 0, title: 'Migrate auth service to Azure', status: 'in_progress', assignee: 1, dueOff: 5, hours: 24 },
  { init: 0, title: 'Database migration plan', status: 'in_progress', assignee: 2, dueOff: 10, hours: 32 },
  { init: 1, title: 'Build ingestion pipelines', status: 'in_progress', assignee: 4, dueOff: 8, hours: 40 },
  { init: 2, title: 'Rate limiting middleware implementation', status: 'in_progress', assignee: 2, dueOff: 3, hours: 12 },
  { init: 4, title: 'Penetration test execution', status: 'in_progress', assignee: 4, dueOff: 5, hours: 24 },
  { init: 4, title: 'SOC2 evidence collection', status: 'in_progress', assignee: 0, dueOff: 7, hours: 32 },
  // Overdue in-progress (visible in Action Required)
  { init: 0, title: 'VM sizing for prod environment', status: 'in_progress', assignee: 1, dueOff: -7, hours: 8 },
  { init: 1, title: 'Data governance policy draft', status: 'in_progress', assignee: 4, dueOff: -5, hours: 12 },
  { init: 2, title: 'API documentation update', status: 'in_progress', assignee: 2, dueOff: -3, hours: 6 },
  { init: 4, title: 'Vulnerability scan report — phase 2', status: 'in_progress', assignee: 4, dueOff: -2, hours: 8 },
  { init: 3, title: 'UiPath alternative evaluation', status: 'in_progress', assignee: 3, dueOff: -4, hours: 16 },
  // Due soon
  { init: 0, title: 'Monitoring dashboard setup', status: 'in_progress', assignee: 1, dueOff: 2, hours: 8 },
  { init: 1, title: 'Spark job optimization', status: 'in_progress', assignee: 4, dueOff: 1, hours: 12 },
  { init: 4, title: 'DPIA submission deadline', status: 'in_progress', assignee: 0, dueOff: 2, hours: 4 },
  { init: 2, title: 'Grafana alert rules', status: 'in_progress', assignee: 3, dueOff: 3, hours: 6 },

  // Todo tasks (12) — future work
  { init: 0, title: 'Load testing after migration', status: 'todo', assignee: 3, dueOff: 20, hours: 12 },
  { init: 1, title: 'Create data quality checks', status: 'todo', assignee: 2, dueOff: 15, hours: 16 },
  { init: 1, title: 'Dashboard prototyping', status: 'todo', assignee: 5, dueOff: 25, hours: 24 },
  { init: 3, title: 'First bot development', status: 'todo', assignee: 3, dueOff: 12, hours: 40 },
  { init: 4, title: 'ZeroTrust network policy', status: 'todo', assignee: 4, dueOff: 12, hours: 16 },
  { init: 5, title: 'Wireframes & prototyping', status: 'todo', assignee: 5, dueOff: 35, hours: 32 },
  { init: 5, title: 'UX research report', status: 'todo', assignee: 5, dueOff: 20, hours: 24 },
  { init: 0, title: 'Disaster recovery setup', status: 'todo', assignee: 0, dueOff: 30, hours: 16 },
  { init: 1, title: 'ML feature store integration', status: 'todo', assignee: 1, dueOff: 40, hours: 32 },
  { init: 2, title: 'GraphQL layer for mobile', status: 'todo', assignee: 2, dueOff: 25, hours: 20 },
  { init: 4, title: 'Security training for team', status: 'todo', assignee: 0, dueOff: 18, hours: 8 },
  { init: 3, title: 'UAT for invoice bot', status: 'todo', assignee: 5, dueOff: 28, hours: 8 },
];

async function seedTasks() {
  for (const t of taskTemplates) {
    const initId = initiatives[t.init].id;
    const assigneeId = teamMembers[t.assignee].id;
    const dueDate = t.dueOff >= 0 ? daysFromNow(t.dueOff) : daysAgo(-t.dueOff);
    const completedAt = t.completedOff ? daysAgo(t.completedOff) : null;
    await pool.query(`
      INSERT INTO tasks (id, organization_id, project_id, initiative_id, title, status, priority,
        assignee_id, due_date, estimated_hours, completed_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'medium', $7, $8, $9, $10, $11, NOW())
      ON CONFLICT (id) DO NOTHING
    `, [
      uuid(), ORG, PROJECT_ID, initId, t.title, t.status,
      assigneeId, dueDate, t.hours, completedAt,
      daysAgo(Math.abs(t.dueOff) + 5),
    ]);
  }
  console.log(`  ✓ ${taskTemplates.length} tasks (18 done, 15 in_progress, 12 todo)`);
}

// ─── Phase 5: Decisions (assigned to USER_ID so they appear on dashboard) ──

const decisionTemplates = [
  // PENDING for USER_ID (shows in Decisions Pending + Action Required)
  { title: 'Zatwierdzenie budżetu Q2 — Cloud Migration', status: 'PENDING', priority: 'HIGH', deadlineOff: -3, type: 'BUDGET' },
  { title: 'Wybór dostawcy SAP — partner integracyjny', status: 'PENDING', priority: 'HIGH', deadlineOff: -1, type: 'VENDOR' },
  { title: 'Go/No-Go — Data Platform MVP', status: 'PENDING', priority: 'HIGH', deadlineOff: 3, type: 'GO_NO_GO' },
  { title: 'Rozszerzenie zakresu Security Hardening', status: 'PENDING', priority: 'CRITICAL', deadlineOff: 2, type: 'SCOPE' },
  { title: 'Zmiana dostawcy RPA: UiPath → Automation Anywhere', status: 'PENDING', priority: 'MEDIUM', deadlineOff: -2, type: 'VENDOR' },
  { title: 'Zatrudnienie 2 senior cloud engineers', status: 'PENDING', priority: 'HIGH', deadlineOff: 5, type: 'HIRING' },
  { title: 'Przedłużenie deadline GDPR remediation', status: 'ESCALATED', priority: 'CRITICAL', deadlineOff: -5, type: 'COMPLIANCE' },
  // RESOLVED (for stats)
  { title: 'Architektura ZeroTrust — podejście', status: 'APPROVED', priority: 'CRITICAL', deadlineOff: -15, type: 'ARCHITECTURE' },
  { title: 'Customer Portal — React vs Angular', status: 'APPROVED', priority: 'MEDIUM', deadlineOff: -20, type: 'TECHNOLOGY' },
  { title: 'Redukcja zakresu Legacy Decommission', status: 'APPROVED', priority: 'LOW', deadlineOff: -10, type: 'SCOPE' },
  { title: 'Budżet szkoleniowy — program upskilling', status: 'REJECTED', priority: 'MEDIUM', deadlineOff: -8, type: 'BUDGET' },
  { title: 'Wybór narzędzia CI/CD', status: 'APPROVED', priority: 'MEDIUM', deadlineOff: -12, type: 'TECHNOLOGY' },
];

async function seedDecisions() {
  for (const d of decisionTemplates) {
    const deadline = d.deadlineOff >= 0 ? daysFromNow(d.deadlineOff) : daysAgo(-d.deadlineOff);
    const createdBy = teamMembers[Math.floor(Math.random() * teamMembers.length)].id;
    await pool.query(`
      INSERT INTO decisions (id, organization_id, project_id, title, type, status, priority,
        decision_maker_id, deadline, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      ON CONFLICT (id) DO NOTHING
    `, [
      uuid(), ORG, PROJECT_ID, d.title, d.type, d.status, d.priority,
      USER_ID, deadline, createdBy, daysAgo(Math.abs(d.deadlineOff) + 3),
    ]);
  }
  console.log(`  ✓ ${decisionTemplates.length} decisions (7 pending for user, 5 resolved)`);
}

// ─── Phase 6: Conversations + Meetings (for AI Operator relationship) ──────

async function seedConversations() {
  const convos = [
    { title: 'Strategia migracji chmurowej — kick-off', ago: 2 },
    { title: 'Przegląd statusu Data Platform', ago: 5 },
    { title: 'Analiza ryzyk Q2 2026', ago: 8 },
    { title: 'Spotkanie z zespołem Security', ago: 12 },
    { title: 'Debriefing po audycie GDPR', ago: 15 },
    { title: 'Planowanie budżetu IT Q3', ago: 20 },
  ];
  for (const c of convos) {
    try {
      await pool.query(`
        INSERT INTO conversations (id, user_id, organization_id, title, message_count, last_message_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO NOTHING
      `, [uuid(), USER_ID, ORG, c.title, Math.floor(Math.random() * 20) + 3, hoursAgo(c.ago * 24), daysAgo(c.ago), daysAgo(c.ago)]);
    } catch {}
  }
  console.log(`  ✓ ${convos.length} conversations`);
}

async function seedMeetings() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS meetings (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        project_id TEXT,
        title TEXT NOT NULL,
        start_at TEXT NOT NULL,
        end_at TEXT NOT NULL,
        location TEXT DEFAULT '',
        attendees_json TEXT DEFAULT '[]',
        status TEXT DEFAULT 'scheduled',
        created_by TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch {}

  const meetings = [
    { title: 'Weekly Stand-up — Program Board', agoH: 4 },
    { title: 'Cloud Migration — Architecture Review', agoH: 48 },
    { title: 'Security Sprint Planning', agoH: 72 },
    { title: 'Data Platform — Demo Day', agoH: 120 },
    { title: 'Executive Steering Committee', agoH: 168 },
  ];
  for (const m of meetings) {
    try {
      await pool.query(`
        INSERT INTO meetings (id, organization_id, project_id, title, start_at, end_at, status, created_by, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'completed', $7, $8)
        ON CONFLICT (id) DO NOTHING
      `, [uuid(), ORG, PROJECT_ID, m.title, hoursAgo(m.agoH), hoursAgo(m.agoH - 1), USER_ID, hoursAgo(m.agoH)]);
    } catch {}
  }
  console.log(`  ✓ ${meetings.length} meetings`);
}

// ─── Phase 7: AI Operator Profile + Plan ───────────────────────────────────

async function seedAIOperator() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_operator_profiles (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        user_id TEXT,
        current_stage TEXT DEFAULT 'discovery',
        relationship_status TEXT DEFAULT 'watch',
        client_dna_json TEXT DEFAULT '{}',
        preferences_json TEXT DEFAULT '{}',
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (organization_id, user_id)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_operator_plans (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        current_stage TEXT,
        status TEXT DEFAULT 'active',
        plan_json TEXT DEFAULT '{}',
        created_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch {}

  await pool.query(`
    INSERT INTO ai_operator_profiles (id, organization_id, user_id, current_stage, relationship_status, client_dna_json, preferences_json, notes, updated_at)
    VALUES ($1, $2, $3, 'execution', 'strong', $4, $5, $6, CURRENT_TIMESTAMP)
    ON CONFLICT (organization_id, user_id) DO UPDATE SET
      current_stage = EXCLUDED.current_stage,
      relationship_status = EXCLUDED.relationship_status,
      client_dna_json = EXCLUDED.client_dna_json,
      notes = EXCLUDED.notes,
      updated_at = CURRENT_TIMESTAMP
  `, [
    uuid(), ORG, USER_ID,
    JSON.stringify({
      industry: 'Technology Consulting',
      size: '50-200',
      maturity: 'growth',
      keyStakeholders: ['CTO', 'VP Engineering', 'Head of Data'],
    }),
    JSON.stringify({ communicationCadence: 'weekly', preferredChannel: 'dashboard' }),
    'Active digital transformation program. 6 initiatives running. Focus on cloud migration and data platform.',
  ]);

  const planJson = JSON.stringify({
    objective: 'Deliver Cloud Migration milestone + Data Platform MVP by end of Q2',
    progressPct: 62,
    nodes: [
      { key: 'cloud-infra', title: 'Cloud infrastructure ready', description: 'Azure K8s + networking', status: 'done', ownerTrack: 'Anna Kowalska' },
      { key: 'auth-migrate', title: 'Auth service migration', description: 'Migrate to Azure AD', status: 'in_progress', ownerTrack: 'Marek Nowak' },
      { key: 'data-ingest', title: 'Data ingestion pipelines', description: 'Delta Lake + Spark', status: 'in_progress', ownerTrack: 'Ewa Nowicka' },
      { key: 'security-audit', title: 'Security audit completion', description: 'SOC2 + pen-test', status: 'in_progress', ownerTrack: 'Ewa Nowicka' },
      { key: 'api-gateway', title: 'API Gateway v2 launch', description: 'Rate limiting + observability', status: 'pending', ownerTrack: 'Katarzyna Wójcik' },
      { key: 'data-mvp', title: 'Data Platform MVP demo', description: 'End-to-end pipeline + dashboard', status: 'pending', ownerTrack: 'Marek Nowak' },
    ],
    nextMilestone: 'Auth service migration complete — target: +5 days',
    blockers: [
      'UiPath license expired — blocking RPA workstream',
      'SAP integration middleware timeout errors unresolved',
    ],
    summary: {
      'Total initiatives': 6,
      'On track': 4,
      'At risk': 1,
      'Blocked': 1,
    },
  });

  await pool.query(`
    INSERT INTO ai_operator_plans (id, organization_id, current_stage, status, plan_json, created_by, updated_at)
    VALUES ($1, $2, 'execution', 'active', $3, $4, CURRENT_TIMESTAMP)
    ON CONFLICT (id) DO NOTHING
  `, [uuid(), ORG, planJson, USER_ID]);

  console.log('  ✓ AI Operator profile + plan');
}

// ─── Phase 8: RAID items ───────────────────────────────────────────────────

async function seedRaidItems() {
  try {
    const raidItems = [
      { type: 'RISK', title: 'Azure region outage risk', status: 'OPEN', prob: 'MEDIUM', impact: 'HIGH', init: 0, score: 12 },
      { type: 'RISK', title: 'Data loss during Lakehouse migration', status: 'OPEN', prob: 'LOW', impact: 'CRITICAL', init: 1, score: 15 },
      { type: 'RISK', title: 'GDPR non-compliance penalty', status: 'OPEN', prob: 'MEDIUM', impact: 'CRITICAL', init: 4, score: 18 },
      { type: 'RISK', title: 'Key person dependency — Marek', status: 'OPEN', prob: 'HIGH', impact: 'HIGH', init: 0, score: 16 },
      { type: 'ISSUE', title: 'UiPath license expired — blocking RPA', status: 'OPEN', prob: 'HIGH', impact: 'HIGH', init: 3, score: 16 },
      { type: 'ISSUE', title: 'CI/CD pipeline flaky tests', status: 'OPEN', prob: 'MEDIUM', impact: 'MEDIUM', init: 2, score: 9 },
      { type: 'DEPENDENCY', title: 'API Gateway depends on Auth Service migration', status: 'OPEN', prob: 'HIGH', impact: 'HIGH', init: 2, score: 16 },
    ];
    for (const r of raidItems) {
      await pool.query(`
        INSERT INTO raid_items (id, organization_id, initiative_id, type, title, status, probability, impact,
          owner_id, risk_score, score_category, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `, [
        uuid(), ORG, initiatives[r.init].id, r.type, r.title, r.status, r.prob, r.impact,
        teamMembers[r.init % teamMembers.length].id, r.score,
        r.score >= 15 ? 'CRITICAL' : r.score >= 10 ? 'HIGH' : 'MEDIUM',
      ]);
    }
    console.log(`  ✓ ${raidItems.length} RAID items`);
  } catch {
    console.log('  ⚠ RAID items skipped (table may not exist)');
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  Seeding Executive Dashboard data for org: dbr77    ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');

  await cleanPreviousData();
  await ensureOrg();
  console.log('  ✓ organization');
  await ensureUser();
  console.log('  ✓ admin user (Piotr Wiśniewski)');
  await ensureTeam();
  await ensureProject();
  console.log('  ✓ project');

  await seedInitiatives();
  await seedTasks();
  await seedDecisions();
  await seedConversations();
  await seedMeetings();
  await seedAIOperator();
  await seedRaidItems();

  console.log('');
  console.log('Expected dashboard values:');
  console.log('  • Portfolio Health:  ~55-65% (18/45 tasks done, decisions pending)');
  console.log('  • Task Execution:    40% (18/45), 5 overdue, On-time ~70%');
  console.log('  • Decisions Pending:  7 awaiting (2 critical)');
  console.log('  • Team Capacity:     6 members, varied workload');
  console.log('  • Risk Level:        HIGH (5 overdue tasks + 2 escalations)');
  console.log('  • Action Required:   5+ items (overdue tasks + critical decisions)');
  console.log('  • AI Operator:       Stage: execution, Relationship: strong, ~60% readiness');
  console.log('  • Initiatives:       6 active (4 on track, 1 at risk, 1 blocked)');
  console.log('');
  console.log('Done! Refresh the browser → Manager tab to see data.');
  await pool.end();
}

main().catch((e) => {
  console.error('SEED ERROR:', e);
  pool.end();
  process.exit(1);
});
