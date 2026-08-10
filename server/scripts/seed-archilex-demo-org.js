/**
 * Archilex Demo Organization Seed Script
 *
 * Creates the comprehensive Archilex demo dataset:
 * - 4 demo personas (Admin, PMO, CFO, CTO/Consultant)
 * - 4 projects, 15 initiatives (3 hero + 3 executing + 2 done + 2 blocked + 5 background)
 * - 55 tasks, 16 decisions, 16 RAID items, 18 KPIs, 5 ROI assumptions
 * - 8 tool sessions, 3 reports, 2 decks
 *
 * Consistent with docs/demo/ARCHILEX_STORY.md
 *
 * Usage:
 *   node server/scripts/seed-archilex-demo-org.js [--clean] [--verify]
 *
 * @module seedArchilexDemoOrg
 */

import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// ==========================================
// PRODUCTION GUARD
// ==========================================

if (process.env.NODE_ENV === 'production') {
  console.error('PRODUCTION GUARD: This seed script cannot run in production.');
  process.exit(1);
}

// ==========================================
// CONFIGURATION
// ==========================================

const DEFAULT_PASSWORD = 'demo123';
const HASHED_PASSWORD = bcrypt.hashSync(DEFAULT_PASSWORD, 8);

const IDS = {
  ORG: 'archilex-org-001',
  USER_ADMIN: 'archilex-admin-001',
  USER_PMO: 'archilex-pmo-001',
  USER_CFO: 'archilex-cfo-001',
  USER_CTO: 'archilex-cto-001',
  PROJ_GOVERNANCE: 'archilex-proj-001',
  PROJ_COMPLIANCE: 'archilex-proj-002',
  PROJ_DIGITAL: 'archilex-proj-003',
  PROJ_PEOPLE: 'archilex-proj-004',
  INIT_H1: 'archilex-init-h1',
  INIT_H2: 'archilex-init-h2',
  INIT_H3: 'archilex-init-h3',
  INIT_E1: 'archilex-init-e1',
  INIT_E2: 'archilex-init-e2',
  INIT_E3: 'archilex-init-e3',
  INIT_C1: 'archilex-init-c1',
  INIT_C2: 'archilex-init-c2',
  INIT_B1: 'archilex-init-b1',
  INIT_B2: 'archilex-init-b2',
  INIT_F1: 'archilex-init-f1',
  INIT_F2: 'archilex-init-f2',
  INIT_F3: 'archilex-init-f3',
  INIT_F4: 'archilex-init-f4',
  INIT_F5: 'archilex-init-f5',
};

const NOW = new Date();
const daysAgo = (d) => { const dt = new Date(NOW); dt.setDate(dt.getDate() - d); return dt; };
const T_START = daysAgo(60);
const T_PHASE1 = daysAgo(45);
const T_PHASE2 = daysAgo(20);

// ==========================================
// DATABASE CONNECTION
// ==========================================

import db from '../database.js';

const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });

const dbGet = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

const isPg = process.env.DB_TYPE === 'postgres' || process.env.DATABASE_URL?.startsWith('postgres');

async function cleanup() {
  console.log('Cleaning up existing Archilex data...');
  const allInitIds = Object.entries(IDS).filter(([k]) => k.startsWith('INIT_')).map(([, v]) => `'${v}'`).join(', ');
  const allProjIds = `'${IDS.PROJ_GOVERNANCE}', '${IDS.PROJ_COMPLIANCE}', '${IDS.PROJ_DIGITAL}', '${IDS.PROJ_PEOPLE}'`;
  const queries = [
    `DELETE FROM roi_assumptions WHERE organization_id = '${IDS.ORG}'`,
    `DELETE FROM kpi_measurements WHERE kpi_id IN (SELECT id FROM initiative_kpis WHERE initiative_id IN (${allInitIds}))`,
    `DELETE FROM initiative_kpis WHERE initiative_id IN (${allInitIds})`,
    `DELETE FROM raid_items WHERE organization_id = '${IDS.ORG}'`,
    `DELETE FROM decisions WHERE organization_id = '${IDS.ORG}'`,
    `DELETE FROM tasks WHERE organization_id = '${IDS.ORG}'`,
    `DELETE FROM tool_sessions WHERE organization_id = '${IDS.ORG}'`,
    `DELETE FROM report_builder_reports WHERE organization_id = '${IDS.ORG}'`,
    `DELETE FROM presentation_decks WHERE organization_id = '${IDS.ORG}'`,
    `DELETE FROM initiatives WHERE organization_id = '${IDS.ORG}'`,
    `DELETE FROM sessions WHERE project_id IN (${allProjIds})`,
    `DELETE FROM projects WHERE id IN (${allProjIds})`,
    `DELETE FROM organization_limits WHERE organization_id = '${IDS.ORG}'`,
    `DELETE FROM organization_events WHERE organization_id = '${IDS.ORG}'`,
    `DELETE FROM users WHERE email LIKE '%@archilex.demo'`,
    `DELETE FROM organizations WHERE id = '${IDS.ORG}'`,
  ];
  for (const q of queries) { try { await dbRun(q); } catch { /* ignore */ } }
  console.log('Cleanup complete');
}

async function seedOrganization() {
  console.log('Seeding Organization...');
  const orgColsQuery = isPg
    ? `SELECT column_name as name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations'`
    : `PRAGMA table_info(organizations)`;
  const orgCols = await dbAll(orgColsQuery);
  const hasOwnerId = orgCols.some((c) => c.name === 'owner_id');
  const hasCreatedByUserId = orgCols.some((c) => c.name === 'created_by_user_id');
  const cols = ['id', 'name', 'plan', 'status', 'industry', 'organization_type', 'trial_started_at', 'trial_expires_at', 'is_active'];
  const vals = [IDS.ORG, 'Archilex Group', 'enterprise', 'active', 'Legal & Compliance Consulting', 'PAID', T_START.toISOString(), new Date(NOW.getTime() + 90 * 86400000).toISOString(), 1];
  if (hasCreatedByUserId) { cols.push('created_by_user_id'); vals.push(IDS.USER_ADMIN); }
  else if (hasOwnerId) { cols.push('owner_id'); vals.push(IDS.USER_ADMIN); }
  await dbRun(`INSERT INTO organizations (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, vals);
}

async function seedUsers() {
  console.log('Seeding Users...');
  const users = [
    { id: IDS.USER_ADMIN, email: 'katarzyna@archilex.demo', first: 'Katarzyna', last: 'Nowak', role: 'ADMIN' },
    { id: IDS.USER_PMO, email: 'tomasz@archilex.demo', first: 'Tomasz', last: 'Kowalski', role: 'USER' },
    { id: IDS.USER_CFO, email: 'aleksandra@archilex.demo', first: 'Aleksandra', last: 'Wi\u015bniewska', role: 'USER' },
    { id: IDS.USER_CTO, email: 'mikolaj@archilex.demo', first: 'Miko\u0142aj', last: 'Zieli\u0144ski', role: 'USER' },
  ];
  for (const u of users) {
    await dbRun(`INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [u.id, IDS.ORG, u.email, HASHED_PASSWORD, u.first, u.last, u.role, 'active']);
    console.log(`  User: ${u.first} ${u.last} (${u.role})`);
  }
}

async function seedOrganizationLimits() {
  await dbRun(`INSERT INTO organization_limits (id, organization_id, max_projects, max_users, max_ai_calls_per_day, max_initiatives, max_storage_mb, ai_roles_enabled_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), IDS.ORG, 50, 100, 1000, 200, 10000, '["ADVISOR", "MANAGER", "OPERATOR"]']);
}

async function seedProjects() {
  console.log('Seeding Projects...');
  const projects = [
    { id: IDS.PROJ_GOVERNANCE, name: 'Portfolio Governance & Strategy', owner: IDS.USER_ADMIN },
    { id: IDS.PROJ_COMPLIANCE, name: 'Compliance & Risk Management', owner: IDS.USER_CFO },
    { id: IDS.PROJ_DIGITAL, name: 'Digital Transformation', owner: IDS.USER_CTO },
    { id: IDS.PROJ_PEOPLE, name: 'People & Change Management', owner: IDS.USER_PMO },
  ];
  for (const p of projects) {
    await dbRun(`INSERT INTO projects (id, organization_id, name, status, owner_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [p.id, IDS.ORG, p.name, 'active', p.owner, T_START.toISOString()]);
  }
}

async function seedInitiatives() {
  console.log('Seeding Initiatives...');
  const initiatives = [
    { id: IDS.INIT_H1, proj: IDS.PROJ_GOVERNANCE, name: 'Portfolio Governance Centralisation', axis: 'strategic', status: 'EXECUTING', owner: IDS.USER_PMO },
    { id: IDS.INIT_H2, proj: IDS.PROJ_COMPLIANCE, name: 'Compliance Monitoring Automation', axis: 'operational', status: 'EXECUTING', owner: IDS.USER_CFO },
    { id: IDS.INIT_H3, proj: IDS.PROJ_DIGITAL, name: 'Executive Real-Time Dashboard', axis: 'digital', status: 'DONE', owner: IDS.USER_CTO },
    { id: IDS.INIT_E1, proj: IDS.PROJ_PEOPLE, name: 'Assessment Toolkit Standardisation', axis: 'change', status: 'EXECUTING', owner: IDS.USER_PMO },
    { id: IDS.INIT_E2, proj: IDS.PROJ_COMPLIANCE, name: 'RAID Workflow Automation', axis: 'operational', status: 'EXECUTING', owner: IDS.USER_PMO },
    { id: IDS.INIT_E3, proj: IDS.PROJ_GOVERNANCE, name: 'Cross-BU Dependency Mapping', axis: 'strategic', status: 'EXECUTING', owner: IDS.USER_ADMIN },
    { id: IDS.INIT_C1, proj: IDS.PROJ_DIGITAL, name: 'Historical Data Migration', axis: 'digital', status: 'DONE', owner: IDS.USER_CTO },
    { id: IDS.INIT_C2, proj: IDS.PROJ_PEOPLE, name: 'Stakeholder Communication Framework', axis: 'change', status: 'DONE', owner: IDS.USER_PMO },
    { id: IDS.INIT_B1, proj: IDS.PROJ_COMPLIANCE, name: 'ESG/CSRD Data Pipeline', axis: 'operational', status: 'BLOCKED', owner: IDS.USER_CFO, blockedReason: 'Awaiting vendor API (external dependency)' },
    { id: IDS.INIT_B2, proj: IDS.PROJ_DIGITAL, name: 'AI-Assisted Legal Research', axis: 'digital', status: 'BLOCKED', owner: IDS.USER_CTO, blockedReason: 'Pending compliance review of LLM usage' },
    { id: IDS.INIT_F1, proj: IDS.PROJ_PEOPLE, name: 'Consultant Onboarding Revamp', axis: 'change', status: 'PLANNING', owner: IDS.USER_PMO },
    { id: IDS.INIT_F2, proj: IDS.PROJ_COMPLIANCE, name: 'Finance Data Integration Layer', axis: 'finance', status: 'PLANNING', owner: IDS.USER_CFO },
    { id: IDS.INIT_F3, proj: IDS.PROJ_DIGITAL, name: 'Client Portal Self-Service Module', axis: 'digital', status: 'DRAFT', owner: IDS.USER_CTO },
    { id: IDS.INIT_F4, proj: IDS.PROJ_GOVERNANCE, name: 'Internal Knowledge Base Migration', axis: 'operational', status: 'CANCELLED', owner: IDS.USER_ADMIN },
    { id: IDS.INIT_F5, proj: IDS.PROJ_PEOPLE, name: 'Talent Retention Program', axis: 'change', status: 'PLANNING', owner: IDS.USER_PMO },
  ];
  for (const init of initiatives) {
    await dbRun(`INSERT INTO initiatives (id, organization_id, project_id, name, axis, status, owner_business_id, blocked_reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [init.id, IDS.ORG, init.proj, init.name, init.axis, init.status, init.owner, init.blockedReason || null, T_PHASE1.toISOString()]);
  }
}

async function seedTasks() {
  console.log('Seeding Tasks...');
  const heroTasks = [
    { init: IDS.INIT_H1, proj: IDS.PROJ_GOVERNANCE, title: 'Define governance framework charter', status: 'done', assignee: IDS.USER_PMO, priority: 'high' },
    { init: IDS.INIT_H1, proj: IDS.PROJ_GOVERNANCE, title: 'Map existing BU tracking tools', status: 'done', assignee: IDS.USER_CTO, priority: 'high' },
    { init: IDS.INIT_H1, proj: IDS.PROJ_GOVERNANCE, title: 'Configure portfolio dashboard widgets', status: 'in_progress', assignee: IDS.USER_CTO, priority: 'high' },
    { init: IDS.INIT_H1, proj: IDS.PROJ_GOVERNANCE, title: 'Migrate BU-1 initiatives to platform', status: 'in_progress', assignee: IDS.USER_PMO, priority: 'medium' },
    { init: IDS.INIT_H1, proj: IDS.PROJ_GOVERNANCE, title: 'Migrate BU-2 initiatives to platform', status: 'todo', assignee: IDS.USER_PMO, priority: 'medium' },
    { init: IDS.INIT_H1, proj: IDS.PROJ_GOVERNANCE, title: 'Train BU leads on new platform', status: 'todo', assignee: IDS.USER_PMO, priority: 'medium' },
    { init: IDS.INIT_H1, proj: IDS.PROJ_GOVERNANCE, title: 'Stakeholder review of governance model', status: 'blocked', assignee: IDS.USER_ADMIN, priority: 'high' },
    { init: IDS.INIT_H1, proj: IDS.PROJ_GOVERNANCE, title: 'Go-live readiness check', status: 'todo', assignee: IDS.USER_PMO, priority: 'high' },
    { init: IDS.INIT_H2, proj: IDS.PROJ_COMPLIANCE, title: 'Audit current compliance monitoring process', status: 'done', assignee: IDS.USER_CFO, priority: 'high' },
    { init: IDS.INIT_H2, proj: IDS.PROJ_COMPLIANCE, title: 'Define automated alert rules', status: 'done', assignee: IDS.USER_CFO, priority: 'high' },
    { init: IDS.INIT_H2, proj: IDS.PROJ_COMPLIANCE, title: 'Integrate regulatory feed API', status: 'in_progress', assignee: IDS.USER_CTO, priority: 'high' },
    { init: IDS.INIT_H2, proj: IDS.PROJ_COMPLIANCE, title: 'Build compliance dashboard', status: 'in_progress', assignee: IDS.USER_CTO, priority: 'medium' },
    { init: IDS.INIT_H2, proj: IDS.PROJ_COMPLIANCE, title: 'User acceptance testing with legal team', status: 'todo', assignee: IDS.USER_PMO, priority: 'medium' },
    { init: IDS.INIT_H2, proj: IDS.PROJ_COMPLIANCE, title: 'Document compliance workflows', status: 'todo', assignee: IDS.USER_PMO, priority: 'low' },
    { init: IDS.INIT_H2, proj: IDS.PROJ_COMPLIANCE, title: 'Regulatory body pilot submission', status: 'todo', assignee: IDS.USER_CFO, priority: 'high' },
    { init: IDS.INIT_H3, proj: IDS.PROJ_DIGITAL, title: 'Requirements gathering with CEO', status: 'done', assignee: IDS.USER_CTO, priority: 'high' },
    { init: IDS.INIT_H3, proj: IDS.PROJ_DIGITAL, title: 'Design dashboard wireframes', status: 'done', assignee: IDS.USER_CTO, priority: 'high' },
    { init: IDS.INIT_H3, proj: IDS.PROJ_DIGITAL, title: 'Implement real-time data pipeline', status: 'done', assignee: IDS.USER_CTO, priority: 'high' },
    { init: IDS.INIT_H3, proj: IDS.PROJ_DIGITAL, title: 'Build dashboard frontend', status: 'done', assignee: IDS.USER_CTO, priority: 'medium' },
    { init: IDS.INIT_H3, proj: IDS.PROJ_DIGITAL, title: 'Integrate KPI feeds', status: 'done', assignee: IDS.USER_CTO, priority: 'medium' },
    { init: IDS.INIT_H3, proj: IDS.PROJ_DIGITAL, title: 'Security review and sign-off', status: 'done', assignee: IDS.USER_ADMIN, priority: 'high' },
    { init: IDS.INIT_H3, proj: IDS.PROJ_DIGITAL, title: 'CEO training and rollout', status: 'done', assignee: IDS.USER_PMO, priority: 'medium' },
  ];
  const genericInitTasks = [
    { init: IDS.INIT_E1, proj: IDS.PROJ_PEOPLE, tasks: ['Map existing assessment tools', 'Define standardised framework', 'Build template library', 'Pilot with 2 BUs'] },
    { init: IDS.INIT_E2, proj: IDS.PROJ_COMPLIANCE, tasks: ['Map RAID workflow gaps', 'Configure automation rules', 'Test escalation triggers', 'Roll out to project leads'] },
    { init: IDS.INIT_E3, proj: IDS.PROJ_GOVERNANCE, tasks: ['Identify cross-BU dependencies', 'Build dependency graph', 'Configure alerts', 'Review with stakeholders'] },
    { init: IDS.INIT_C1, proj: IDS.PROJ_DIGITAL, tasks: ['Extract BU spreadsheet data', 'Transform and validate', 'Load into platform', 'Verify data integrity'] },
    { init: IDS.INIT_C2, proj: IDS.PROJ_PEOPLE, tasks: ['Define communication plan', 'Create stakeholder map', 'Roll out newsletters', 'Measure engagement'] },
    { init: IDS.INIT_B1, proj: IDS.PROJ_COMPLIANCE, tasks: ['Research ESG data vendors', 'Draft API requirements', 'Await vendor response'] },
    { init: IDS.INIT_B2, proj: IDS.PROJ_DIGITAL, tasks: ['LLM compliance assessment', 'Data privacy review', 'Legal counsel briefing'] },
    { init: IDS.INIT_F1, proj: IDS.PROJ_PEOPLE, tasks: ['Onboarding needs assessment', 'Design new programme'] },
    { init: IDS.INIT_F5, proj: IDS.PROJ_PEOPLE, tasks: ['Exit interview analysis', 'Design retention package'] },
  ];
  const statuses = ['done', 'in_progress', 'todo', 'blocked'];
  const priorities = ['high', 'medium', 'medium', 'low'];
  const owners = [IDS.USER_PMO, IDS.USER_CTO, IDS.USER_CFO, IDS.USER_ADMIN];
  let taskCount = 0;
  for (const t of heroTasks) {
    taskCount++;
    await dbRun(`INSERT INTO tasks (id, organization_id, project_id, initiative_id, title, status, priority, assignee_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [`task-ax-${String(taskCount).padStart(3, '0')}`, IDS.ORG, t.proj, t.init, t.title, t.status, t.priority, t.assignee, T_PHASE1.toISOString()]);
  }
  for (const group of genericInitTasks) {
    for (let i = 0; i < group.tasks.length; i++) {
      taskCount++;
      await dbRun(`INSERT INTO tasks (id, organization_id, project_id, initiative_id, title, status, priority, assignee_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [`task-ax-${String(taskCount).padStart(3, '0')}`, IDS.ORG, group.proj, group.init, group.tasks[i], statuses[i % statuses.length], priorities[i % priorities.length], owners[i % owners.length], T_PHASE2.toISOString()]);
    }
  }
  console.log(`  Seeded ${taskCount} tasks`);
}

async function seedDecisions() {
  console.log('Seeding Decisions...');
  const decisions = [
    { init: IDS.INIT_H1, title: 'Approve governance framework charter', type: 'APPROVAL', status: 'approved', maker: IDS.USER_ADMIN },
    { init: IDS.INIT_H1, title: 'Select portfolio tracking platform', type: 'GO_NO_GO', status: 'approved', maker: IDS.USER_ADMIN },
    { init: IDS.INIT_H1, title: 'Allocate budget for BU migration', type: 'RESOURCE_ALLOCATION', status: 'pending', maker: IDS.USER_CFO },
    { init: IDS.INIT_H2, title: 'Approve compliance automation vendor', type: 'APPROVAL', status: 'approved', maker: IDS.USER_CFO },
    { init: IDS.INIT_H2, title: 'Go/No-Go for pilot submission', type: 'GO_NO_GO', status: 'pending', maker: IDS.USER_ADMIN },
    { init: IDS.INIT_H2, title: 'Escalate regulatory API delay', type: 'OTHER', status: 'escalated', maker: IDS.USER_CTO },
    { init: IDS.INIT_H3, title: 'Approve dashboard design', type: 'APPROVAL', status: 'approved', maker: IDS.USER_ADMIN },
    { init: IDS.INIT_H3, title: 'Security sign-off for real-time pipeline', type: 'APPROVAL', status: 'approved', maker: IDS.USER_CTO },
    { init: IDS.INIT_E1, title: 'Standardise on DRD assessment framework', type: 'GO_NO_GO', status: 'approved', maker: IDS.USER_PMO },
    { init: IDS.INIT_E2, title: 'Approve RAID automation rules', type: 'APPROVAL', status: 'pending', maker: IDS.USER_PMO },
    { init: IDS.INIT_E3, title: 'Approve dependency visualization approach', type: 'APPROVAL', status: 'approved', maker: IDS.USER_ADMIN },
    { init: IDS.INIT_B1, title: 'Evaluate ESG vendor shortlist', type: 'GO_NO_GO', status: 'pending', maker: IDS.USER_CFO },
    { init: IDS.INIT_B2, title: 'LLM usage compliance assessment', type: 'APPROVAL', status: 'pending', maker: IDS.USER_ADMIN },
    { init: IDS.INIT_C1, title: 'Approve data migration strategy', type: 'APPROVAL', status: 'approved', maker: IDS.USER_CTO },
    { init: IDS.INIT_C2, title: 'Approve comms plan budget', type: 'RESOURCE_ALLOCATION', status: 'approved', maker: IDS.USER_CFO },
    { init: IDS.INIT_F2, title: 'Finance integration architecture review', type: 'APPROVAL', status: 'pending', maker: IDS.USER_CTO },
  ];
  for (let i = 0; i < decisions.length; i++) {
    const d = decisions[i];
    await dbRun(`INSERT INTO decisions (id, organization_id, initiative_id, title, type, decision_maker_id, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [`dec-ax-${String(i + 1).padStart(3, '0')}`, IDS.ORG, d.init, d.title, d.type, d.maker, d.status, d.maker, T_PHASE1.toISOString()]);
  }
  console.log(`  Seeded ${decisions.length} decisions`);
}

async function seedRAID() {
  console.log('Seeding RAID items...');
  const items = [
    { init: IDS.INIT_H1, type: 'RISK', title: 'BU resistance to centralised governance', prob: 'HIGH', impact: 'HIGH', status: 'OPEN', owner: IDS.USER_PMO },
    { init: IDS.INIT_H1, type: 'DEPENDENCY', title: 'IT infrastructure readiness for migration', prob: 'MEDIUM', impact: 'HIGH', status: 'OPEN', owner: IDS.USER_CTO },
    { init: IDS.INIT_H1, type: 'ISSUE', title: 'Data format inconsistency across BUs', prob: null, impact: 'MEDIUM', status: 'MITIGATED', owner: IDS.USER_CTO },
    { init: IDS.INIT_H2, type: 'RISK', title: 'Regulatory API vendor delays', prob: 'HIGH', impact: 'CRITICAL', status: 'OPEN', owner: IDS.USER_CFO },
    { init: IDS.INIT_H2, type: 'RISK', title: 'False positive alert fatigue', prob: 'MEDIUM', impact: 'MEDIUM', status: 'OPEN', owner: IDS.USER_CFO },
    { init: IDS.INIT_H2, type: 'ASSUMPTION', title: 'Legal team capacity for UAT', prob: 'LOW', impact: 'MEDIUM', status: 'OPEN', owner: IDS.USER_PMO },
    { init: IDS.INIT_H3, type: 'RISK', title: 'Real-time pipeline latency > 5 min', prob: 'LOW', impact: 'HIGH', status: 'CLOSED', owner: IDS.USER_CTO },
    { init: IDS.INIT_H3, type: 'ISSUE', title: 'CEO availability for requirements sign-off', prob: null, impact: 'MEDIUM', status: 'CLOSED', owner: IDS.USER_ADMIN },
    { init: IDS.INIT_E1, type: 'RISK', title: 'Low adoption of standardised toolkit', prob: 'MEDIUM', impact: 'HIGH', status: 'OPEN', owner: IDS.USER_PMO },
    { init: IDS.INIT_E2, type: 'DEPENDENCY', title: 'RAID module feature availability', prob: 'LOW', impact: 'MEDIUM', status: 'OPEN', owner: IDS.USER_CTO },
    { init: IDS.INIT_E3, type: 'RISK', title: 'Incomplete dependency data from BUs', prob: 'HIGH', impact: 'MEDIUM', status: 'OPEN', owner: IDS.USER_PMO },
    { init: IDS.INIT_B1, type: 'DEPENDENCY', title: 'ESG vendor API contract finalisation', prob: 'HIGH', impact: 'CRITICAL', status: 'OPEN', owner: IDS.USER_CFO },
    { init: IDS.INIT_B1, type: 'RISK', title: 'CSRD regulation timeline change', prob: 'MEDIUM', impact: 'HIGH', status: 'OPEN', owner: IDS.USER_CFO },
    { init: IDS.INIT_B2, type: 'RISK', title: 'LLM hallucination in legal research', prob: 'HIGH', impact: 'CRITICAL', status: 'OPEN', owner: IDS.USER_CTO },
    { init: IDS.INIT_C1, type: 'ISSUE', title: 'Legacy data encoding issues', prob: null, impact: 'LOW', status: 'CLOSED', owner: IDS.USER_CTO },
    { init: IDS.INIT_F5, type: 'RISK', title: 'Budget constraints for retention packages', prob: 'MEDIUM', impact: 'HIGH', status: 'OPEN', owner: IDS.USER_CFO },
  ];
  for (let i = 0; i < items.length; i++) {
    const r = items[i];
    await dbRun(`INSERT INTO raid_items (id, organization_id, initiative_id, type, title, probability, impact, status, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [`raid-ax-${String(i + 1).padStart(3, '0')}`, IDS.ORG, r.init, r.type, r.title, r.prob, r.impact, r.status, r.owner, T_PHASE1.toISOString(), NOW.toISOString()]);
  }
  console.log(`  Seeded ${items.length} RAID items`);
}

async function seedKPIs() {
  console.log('Seeding KPIs...');
  const kpis = [
    { init: IDS.INIT_H1, name: 'Active initiatives with real-time status', unit: '%', target: 95, baseline: 12, current: 68 },
    { init: IDS.INIT_H2, name: 'Compliance incidents per quarter', unit: 'count', target: 0.4, baseline: 1.0, current: 0.6 },
    { init: IDS.INIT_H3, name: 'Executive dashboard refresh lag', unit: 'days', target: 1, baseline: 21, current: 1 },
    { init: IDS.INIT_E1, name: 'Consultant utilisation rate', unit: '%', target: 77, baseline: 62, current: 69 },
    { init: IDS.INIT_B1, name: 'CSRD data-collection hours per year', unit: 'hours', target: 120, baseline: 400, current: 380 },
    { init: IDS.INIT_H2, name: 'Initiatives with ROI tracked', unit: '%', target: 80, baseline: 8, current: 45 },
    { init: IDS.INIT_H1, name: 'Portfolio health score', unit: 'score', target: 78, baseline: 54, current: 71 },
    { init: IDS.INIT_H1, name: 'Avg decision cycle days', unit: 'days', target: 10, baseline: 27, current: 14 },
    { init: IDS.INIT_E2, name: 'Task on-time completion rate', unit: '%', target: 85, baseline: 61, current: 74 },
    { init: IDS.INIT_H2, name: 'Risk items open > 30 days', unit: 'count', target: 4, baseline: 14, current: 7 },
    { init: IDS.INIT_E1, name: 'Assessment reuse ratio', unit: '%', target: 70, baseline: 15, current: 42 },
    { init: IDS.INIT_F5, name: 'Digital Legal Ops attrition', unit: '%', target: 10, baseline: 18, current: 14 },
    { init: IDS.INIT_H2, name: 'Budget variance actual vs plan', unit: '%', target: 8, baseline: 22, current: 12 },
    { init: IDS.INIT_H3, name: 'Sponsor report generation time', unit: 'hours', target: 2, baseline: 16, current: 3 },
    { init: IDS.INIT_E2, name: 'RAID items auto-escalated', unit: '%', target: 50, baseline: 0, current: 28 },
    { init: IDS.INIT_H2, name: 'ROI realised vs projected', unit: '%', target: 75, baseline: 0, current: 62 },
    { init: IDS.INIT_E3, name: 'Cross-BU dependencies mapped', unit: '%', target: 100, baseline: 0, current: 73 },
    { init: IDS.INIT_C2, name: 'Stakeholder NPS internal', unit: 'score', target: 55, baseline: 32, current: 48 },
  ];
  for (let i = 0; i < kpis.length; i++) {
    const k = kpis[i];
    const kpiId = `kpi-ax-${String(i + 1).padStart(3, '0')}`;
    await dbRun(`INSERT INTO initiative_kpis (id, initiative_id, name, target_value, unit, is_primary, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [kpiId, k.init, k.name, k.target, k.unit, i < 6 ? 1 : 0, i, T_PHASE1.toISOString()]);
    await dbRun(`INSERT INTO kpi_measurements (id, kpi_id, value, measured_at, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [`${kpiId}-m0`, kpiId, k.baseline, T_START.toISOString(), 'Baseline', T_START.toISOString()]);
    await dbRun(`INSERT INTO kpi_measurements (id, kpi_id, value, measured_at, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [`${kpiId}-m1`, kpiId, k.current, NOW.toISOString(), 'Current', NOW.toISOString()]);
  }
  console.log(`  Seeded ${kpis.length} KPIs with measurements`);
}

async function seedROI() {
  console.log('Seeding ROI Assumptions...');
  const assumptions = [
    { init: IDS.INIT_H1, capex: 180000, opex: 45000, roi: 240, npv: 350000, payback: 10, confidence: 'high' },
    { init: IDS.INIT_H2, capex: 120000, opex: 30000, roi: 310, npv: 280000, payback: 8, confidence: 'high' },
    { init: IDS.INIT_H3, capex: 95000, opex: 15000, roi: 180, npv: 145000, payback: 12, confidence: 'medium' },
    { init: IDS.INIT_E1, capex: 60000, opex: 12000, roi: 150, npv: 72000, payback: 14, confidence: 'medium' },
    { init: IDS.INIT_E2, capex: 40000, opex: 8000, roi: 200, npv: 55000, payback: 11, confidence: 'medium' },
  ];
  for (let i = 0; i < assumptions.length; i++) {
    const a = assumptions[i];
    await dbRun(`INSERT INTO roi_assumptions (id, initiative_id, organization_id, capex, opex_annual, expected_roi_percent, expected_npv, expected_payback_months, confidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [`roi-ax-${String(i + 1).padStart(3, '0')}`, a.init, IDS.ORG, a.capex, a.opex, a.roi, a.npv, a.payback, a.confidence, T_PHASE1.toISOString()]);
  }
  console.log(`  Seeded ${assumptions.length} ROI assumptions`);
}

async function seedToolSessions() {
  console.log('Seeding Tool Sessions...');
  const sessions = [
    { type: 'DRD', name: 'Archilex Strategic Maturity Assessment', status: 'APPROVED', completion: 100, owner: IDS.USER_PMO, proj: IDS.PROJ_GOVERNANCE },
    { type: 'SWOT', name: 'Compliance Division SWOT', status: 'APPROVED', completion: 100, owner: IDS.USER_CFO, proj: IDS.PROJ_COMPLIANCE },
    { type: 'DRD', name: 'Digital Ops Readiness Assessment', status: 'APPROVED', completion: 100, owner: IDS.USER_CTO, proj: IDS.PROJ_DIGITAL },
    { type: 'PESTEL', name: 'Regulatory Environment Analysis', status: 'REVIEW', completion: 85, owner: IDS.USER_CFO, proj: IDS.PROJ_COMPLIANCE },
    { type: 'VALUE_CHAIN', name: 'Client Service Value Chain', status: 'DRAFT', completion: 60, owner: IDS.USER_PMO, proj: IDS.PROJ_PEOPLE },
    { type: 'DRD', name: 'People & Change Assessment', status: 'APPROVED', completion: 100, owner: IDS.USER_PMO, proj: IDS.PROJ_PEOPLE },
    { type: 'PORTER', name: 'Legal Services Competitive Analysis', status: 'REVIEW', completion: 90, owner: IDS.USER_ADMIN, proj: IDS.PROJ_GOVERNANCE },
    { type: 'BCG_MATRIX', name: 'Initiative Portfolio Prioritisation', status: 'DRAFT', completion: 45, owner: IDS.USER_PMO, proj: IDS.PROJ_GOVERNANCE },
  ];
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    await dbRun(`INSERT INTO tool_sessions (id, organization_id, project_id, tool_type, name, status, completion_percent, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [`tsess-ax-${String(i + 1).padStart(3, '0')}`, IDS.ORG, s.proj, s.type, s.name, s.status, s.completion, s.owner, T_PHASE1.toISOString()]);
  }
  console.log(`  Seeded ${sessions.length} tool sessions`);
}

async function seedReportsAndDecks() {
  console.log('Seeding Reports & Decks...');
  const reports = [
    { id: 'rpt-ax-001', title: 'Assessment Summary: Strategic Maturity', type: 'ASSESSMENT_DRD', source: 'ASSESSMENT', sourceId: 'tsess-ax-001', proj: IDS.PROJ_GOVERNANCE, owner: IDS.USER_PMO },
    { id: 'rpt-ax-002', title: 'Compliance Automation Steering Brief', type: 'INITIATIVE', source: 'INITIATIVE', sourceId: IDS.INIT_H2, proj: IDS.PROJ_COMPLIANCE, owner: IDS.USER_CFO },
    { id: 'rpt-ax-003', title: 'Finance & ROI Quarterly Snapshot', type: 'INITIATIVE', source: 'INITIATIVE', sourceId: IDS.INIT_H1, proj: IDS.PROJ_GOVERNANCE, owner: IDS.USER_CFO },
  ];
  for (const r of reports) {
    try {
      await dbRun(`INSERT INTO report_builder_reports (id, organization_id, project_id, source_type, source_id, source_name, title, report_type, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.id, IDS.ORG, r.proj, r.source, r.sourceId, r.title, r.title, r.type, 'APPROVED', r.owner, T_PHASE2.toISOString()]);
    } catch { /* table may not exist */ }
  }
  const decks = [
    { id: 'deck-ax-001', title: 'Executive Overview - Archilex Transformation', type: 'executive_update', audience: 'executive', proj: IDS.PROJ_GOVERNANCE, owner: IDS.USER_ADMIN },
    { id: 'deck-ax-002', title: 'Initiatives & Execution Update', type: 'project_update', audience: 'management', proj: IDS.PROJ_GOVERNANCE, owner: IDS.USER_PMO },
  ];
  for (const d of decks) {
    try {
      await dbRun(`INSERT INTO presentation_decks (id, organization_id, project_id, title, deck_type, audience, status, generated_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [d.id, IDS.ORG, d.proj, d.title, d.type, d.audience, 'ready', d.owner, T_PHASE2.toISOString()]);
    } catch { /* table may not exist */ }
  }
  console.log(`  Seeded ${reports.length} reports + ${decks.length} decks`);
}

async function verify() {
  console.log('\nVerifying Archilex Data...\n');
  const checks = [];
  const org = await dbGet('SELECT * FROM organizations WHERE id = ?', [IDS.ORG]);
  checks.push({ name: 'Organization', passed: !!org, details: org ? org.name : 'NOT FOUND' });
  const userCount = await dbGet('SELECT COUNT(*) as count FROM users WHERE organization_id = ?', [IDS.ORG]);
  checks.push({ name: 'Users', passed: userCount.count === 4, details: `${userCount.count} / 4` });
  const projCount = await dbGet('SELECT COUNT(*) as count FROM projects WHERE organization_id = ?', [IDS.ORG]);
  checks.push({ name: 'Projects', passed: projCount.count === 4, details: `${projCount.count} / 4` });
  const initCount = await dbGet('SELECT COUNT(*) as count FROM initiatives WHERE organization_id = ?', [IDS.ORG]);
  checks.push({ name: 'Initiatives', passed: initCount.count >= 15, details: `${initCount.count} / 15` });
  const taskCount = await dbGet('SELECT COUNT(*) as count FROM tasks WHERE organization_id = ?', [IDS.ORG]);
  checks.push({ name: 'Tasks', passed: taskCount.count >= 45, details: `${taskCount.count} / 45+` });
  const decCount = await dbGet('SELECT COUNT(*) as count FROM decisions WHERE organization_id = ?', [IDS.ORG]);
  checks.push({ name: 'Decisions', passed: decCount.count >= 12, details: `${decCount.count} / 12+` });
  try { const c = await dbGet('SELECT COUNT(*) as count FROM raid_items WHERE organization_id = ?', [IDS.ORG]); checks.push({ name: 'RAID', passed: c.count >= 12, details: `${c.count} / 12+` }); } catch { checks.push({ name: 'RAID', passed: false, details: 'N/A' }); }
  try { const c = await dbGet("SELECT COUNT(*) as count FROM initiative_kpis WHERE initiative_id LIKE 'archilex-%'", []); checks.push({ name: 'KPIs', passed: c.count >= 14, details: `${c.count} / 14+` }); } catch { checks.push({ name: 'KPIs', passed: false, details: 'N/A' }); }
  try { const c = await dbGet('SELECT COUNT(*) as count FROM roi_assumptions WHERE organization_id = ?', [IDS.ORG]); checks.push({ name: 'ROI', passed: c.count >= 3, details: `${c.count} / 3+` }); } catch { checks.push({ name: 'ROI', passed: false, details: 'N/A' }); }
  try { const c = await dbGet('SELECT COUNT(*) as count FROM tool_sessions WHERE organization_id = ?', [IDS.ORG]); checks.push({ name: 'Tool Sessions', passed: c.count >= 6, details: `${c.count} / 6+` }); } catch { checks.push({ name: 'Tool Sessions', passed: false, details: 'N/A' }); }
  let allPassed = true;
  for (const c of checks) { console.log(`${c.passed ? '[OK]' : '[FAIL]'} ${c.name}: ${c.details}`); if (!c.passed) allPassed = false; }
  console.log(allPassed ? '\nAll checks passed!' : '\nSome checks failed');
  return allPassed;
}

async function main() {
  const args = process.argv.slice(2);
  console.log('ARCHILEX DEMO ORGANIZATION SEED SCRIPT');
  try {
    if (args.includes('--verify')) { const passed = await verify(); process.exit(passed ? 0 : 1); }
    if (args.includes('--clean')) { await cleanup(); }
    await seedOrganization();
    await seedUsers();
    await seedOrganizationLimits();
    await seedProjects();
    await seedInitiatives();
    await seedTasks();
    await seedDecisions();
    await seedRAID();
    await seedKPIs();
    await seedROI();
    await seedToolSessions();
    await seedReportsAndDecks();
    console.log('\nSEEDING COMPLETED');
    await verify();
    console.log(`\nCredentials: katarzyna/tomasz/aleksandra/mikolaj @archilex.demo / ${DEFAULT_PASSWORD}`);
    if (db.close) db.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message, err.stack);
    if (db.close) db.close();
    process.exit(1);
  }
}

main();
