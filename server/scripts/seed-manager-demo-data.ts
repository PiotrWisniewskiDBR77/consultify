/**
 * Seed script: populates dbr77 org with realistic data for all 6 Manager lanes.
 *
 * Run: npx tsx server/scripts/seed-manager-demo-data.ts
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
        INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status, is_active, created_at)
        VALUES ($1, $2, $3, 'hashed', $4, $5, 'MEMBER', 'active', 1, NOW())
        ON CONFLICT (id) DO NOTHING
      `, [m.id, ORG, m.email, m.first, m.last]);
    }
  }
}

const PROJECT_ID = uuid();

async function ensureProject() {
  await pool.query(`
    INSERT INTO projects (id, organization_id, name, description, status, owner_id, current_phase, created_at)
    VALUES ($1, $2, 'Transformacja Cyfrowa Q2 2026', 'Program transformacji cyfrowej — Q2 2026', 'active', $3, 'execution', NOW())
    ON CONFLICT (id) DO NOTHING
  `, [PROJECT_ID, ORG, USER_ID]);
}

const initiatives: Array<{
  id: string; name: string; status: string; owner: number; priority: string;
  startOff: number; endOff: number; desc: string;
}> = [
  { id: uuid(), name: 'Cloud Migration — Azure', status: 'IN_EXECUTION', owner: 0, priority: 'HIGH', startOff: -30, endOff: 45, desc: 'Migracja infrastruktury do Azure Cloud' },
  { id: uuid(), name: 'Data Platform — Lakehouse', status: 'IN_EXECUTION', owner: 1, priority: 'HIGH', startOff: -20, endOff: 60, desc: 'Budowa platformy danych w architekturze Lakehouse' },
  { id: uuid(), name: 'API Gateway v2', status: 'IN_EXECUTION', owner: 2, priority: 'MEDIUM', startOff: -15, endOff: 30, desc: 'Nowa warstwa API Gateway z rate limiting i observability' },
  { id: uuid(), name: 'Process Automation — RPA', status: 'IN_EXECUTION', owner: 3, priority: 'HIGH', startOff: -25, endOff: 40, desc: 'Automatyzacja procesów back-office z UiPath' },
  { id: uuid(), name: 'Security Hardening', status: 'IN_EXECUTION', owner: 4, priority: 'CRITICAL', startOff: -10, endOff: 20, desc: 'Wzmocnienie bezpieczeństwa: SOC2, pen-testy, ZeroTrust' },
  { id: uuid(), name: 'Customer Portal Redesign', status: 'APPROVED', owner: 5, priority: 'MEDIUM', startOff: 5, endOff: 75, desc: 'Przeprojektowanie portalu klienta — UX/UI + nowe funkcje' },
  { id: uuid(), name: 'ERP SAP Integration', status: 'IN_EXECUTION', owner: 1, priority: 'HIGH', startOff: -35, endOff: 50, desc: 'Integracja z SAP ERP — moduły FI, MM, SD' },
  { id: uuid(), name: 'Legacy Decommission', status: 'IN_EXECUTION', owner: 3, priority: 'LOW', startOff: -40, endOff: 90, desc: 'Wygaszanie systemów legacy: stary CRM i monolith' },
  { id: uuid(), name: 'DevOps Maturity Program', status: 'IN_EXECUTION', owner: 0, priority: 'MEDIUM', startOff: -12, endOff: 55, desc: 'CI/CD, IaC, observability, SRE practices' },
  { id: uuid(), name: 'AI-Powered Analytics', status: 'APPROVED', owner: 4, priority: 'HIGH', startOff: 10, endOff: 80, desc: 'Wdrożenie analityki predykcyjnej i ML pipeline' },
  { id: uuid(), name: 'Compliance & GDPR Audit', status: 'IN_EXECUTION', owner: 2, priority: 'CRITICAL', startOff: -8, endOff: 15, desc: 'Audyt zgodności GDPR i przygotowanie do kontroli' },
  { id: uuid(), name: 'Talent Upskilling Program', status: 'IN_EXECUTION', owner: 5, priority: 'MEDIUM', startOff: -18, endOff: 65, desc: 'Program szkoleniowy — cloud, data, AI dla zespołów' },
  { id: uuid(), name: 'Vendor Consolidation', status: 'IN_EXECUTION', owner: 0, priority: 'LOW', startOff: -22, endOff: 35, desc: 'Konsolidacja dostawców IT — redukcja z 14 do 6' },
];

async function seedInitiatives() {
  for (const init of initiatives) {
    const ownerId = teamMembers[init.owner].id;
    await pool.query(`
      INSERT INTO initiatives (id, organization_id, project_id, name, description, status, priority,
        owner_execution_id, planned_start_date, planned_end_date, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, [
      init.id, ORG, PROJECT_ID, init.name, init.desc, init.status, init.priority,
      ownerId, daysAgo(-init.startOff), daysFromNow(init.endOff),
    ]);
  }
  console.log(`  ✓ ${initiatives.length} initiatives`);
}

const taskTemplates = [
  // Cloud Migration tasks
  { init: 0, title: 'Migrate auth service to Azure', status: 'in_progress', assignee: 1, dueOff: 5, hours: 24 },
  { init: 0, title: 'Set up Azure Kubernetes cluster', status: 'done', assignee: 1, dueOff: -3, hours: 16 },
  { init: 0, title: 'Database migration plan', status: 'in_progress', assignee: 2, dueOff: 10, hours: 32 },
  { init: 0, title: 'Network security groups config', status: 'todo', assignee: 0, dueOff: 14, hours: 8 },
  { init: 0, title: 'Load testing after migration', status: 'todo', assignee: 3, dueOff: 20, hours: 12 },
  // Data Platform tasks
  { init: 1, title: 'Set up Delta Lake storage', status: 'done', assignee: 1, dueOff: -7, hours: 20 },
  { init: 1, title: 'Build ingestion pipelines', status: 'in_progress', assignee: 4, dueOff: 8, hours: 40 },
  { init: 1, title: 'Create data quality checks', status: 'todo', assignee: 2, dueOff: 15, hours: 16 },
  { init: 1, title: 'Dashboard prototyping', status: 'todo', assignee: 5, dueOff: 25, hours: 24 },
  // API Gateway tasks
  { init: 2, title: 'Rate limiting middleware', status: 'in_progress', assignee: 2, dueOff: 3, hours: 12 },
  { init: 2, title: 'API versioning strategy', status: 'done', assignee: 2, dueOff: -5, hours: 8 },
  { init: 2, title: 'Observability integration', status: 'blocked', assignee: 3, dueOff: -2, hours: 16 },
  // Process Automation (BLOCKED)
  { init: 3, title: 'UiPath license procurement', status: 'blocked', assignee: 3, dueOff: -10, hours: 4 },
  { init: 3, title: 'Process mapping workshop', status: 'done', assignee: 5, dueOff: -15, hours: 16 },
  { init: 3, title: 'First bot development', status: 'blocked', assignee: 3, dueOff: -5, hours: 40 },
  { init: 3, title: 'UAT for invoice bot', status: 'todo', assignee: 4, dueOff: 12, hours: 8 },
  // Security Hardening
  { init: 4, title: 'Penetration test execution', status: 'in_progress', assignee: 4, dueOff: 5, hours: 24 },
  { init: 4, title: 'SOC2 evidence collection', status: 'in_progress', assignee: 0, dueOff: 7, hours: 32 },
  { init: 4, title: 'ZeroTrust network policy', status: 'todo', assignee: 4, dueOff: 12, hours: 16 },
  // Customer Portal (SCHEDULED)
  { init: 5, title: 'UX research & interviews', status: 'todo', assignee: 5, dueOff: 20, hours: 24 },
  { init: 5, title: 'Wireframes & prototyping', status: 'todo', assignee: 5, dueOff: 35, hours: 32 },
  // ERP SAP (BLOCKED)
  { init: 6, title: 'SAP FI module config', status: 'blocked', assignee: 1, dueOff: -8, hours: 40 },
  { init: 6, title: 'Integration middleware setup', status: 'blocked', assignee: 3, dueOff: -3, hours: 24 },
  { init: 6, title: 'Data migration dry run', status: 'todo', assignee: 1, dueOff: 15, hours: 16 },
  // Legacy Decommission
  { init: 7, title: 'Legacy CRM data export', status: 'in_progress', assignee: 0, dueOff: 3, hours: 16 },
  { init: 7, title: 'Monolith service decomposition', status: 'in_progress', assignee: 3, dueOff: 10, hours: 40 },
  { init: 7, title: 'Redirect DNS and traffic', status: 'todo', assignee: 2, dueOff: 30, hours: 4 },
  // DevOps
  { init: 8, title: 'CI/CD pipeline for all services', status: 'in_progress', assignee: 2, dueOff: 5, hours: 24 },
  { init: 8, title: 'Infrastructure as Code (Terraform)', status: 'in_progress', assignee: 1, dueOff: 8, hours: 32 },
  { init: 8, title: 'SRE runbook creation', status: 'todo', assignee: 0, dueOff: 20, hours: 12 },
  // Compliance
  { init: 10, title: 'GDPR data mapping', status: 'in_progress', assignee: 4, dueOff: 3, hours: 16 },
  { init: 10, title: 'Privacy impact assessment', status: 'in_progress', assignee: 0, dueOff: 5, hours: 12 },
  { init: 10, title: 'Remediation action plan', status: 'todo', assignee: 2, dueOff: 10, hours: 8 },
  // Talent Upskilling (BLOCKED)
  { init: 11, title: 'Training curriculum design', status: 'done', assignee: 5, dueOff: -12, hours: 16 },
  { init: 11, title: 'Cloud certification program', status: 'blocked', assignee: 5, dueOff: -5, hours: 40 },
  { init: 11, title: 'AI/ML workshop series', status: 'todo', assignee: 4, dueOff: 20, hours: 24 },
  // Vendor Consolidation
  { init: 12, title: 'Vendor audit & scoring', status: 'in_progress', assignee: 0, dueOff: 5, hours: 16 },
  { init: 12, title: 'Contract renegotiation', status: 'todo', assignee: 3, dueOff: 15, hours: 12 },
  { init: 12, title: 'Migration from deprecated vendors', status: 'todo', assignee: 1, dueOff: 25, hours: 24 },

  // Overdue tasks (for Action Queue)
  { init: 0, title: 'VM sizing for prod environment', status: 'in_progress', assignee: 1, dueOff: -7, hours: 8 },
  { init: 1, title: 'Data governance policy draft', status: 'in_progress', assignee: 4, dueOff: -5, hours: 12 },
  { init: 2, title: 'API documentation update', status: 'in_progress', assignee: 2, dueOff: -3, hours: 6 },
  { init: 4, title: 'Vulnerability scan report', status: 'in_progress', assignee: 4, dueOff: -2, hours: 8 },

  // Due-soon tasks (for Workload)
  { init: 0, title: 'Monitoring dashboard setup', status: 'in_progress', assignee: 1, dueOff: 2, hours: 8 },
  { init: 1, title: 'Spark job optimization', status: 'in_progress', assignee: 4, dueOff: 1, hours: 12 },
  { init: 8, title: 'Grafana alert rules', status: 'in_progress', assignee: 2, dueOff: 3, hours: 6 },
  { init: 10, title: 'DPIA submission deadline', status: 'in_progress', assignee: 0, dueOff: 2, hours: 4 },
];

async function seedTasks() {
  for (const t of taskTemplates) {
    const initId = initiatives[t.init].id;
    const assigneeId = teamMembers[t.assignee].id;
    await pool.query(`
      INSERT INTO tasks (id, organization_id, project_id, initiative_id, title, status, priority,
        assignee_id, due_date, estimated_hours, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'MEDIUM', $7, $8, $9, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, [
      uuid(), ORG, PROJECT_ID, initId, t.title, t.status,
      assigneeId,
      t.dueOff >= 0 ? daysFromNow(t.dueOff) : daysAgo(-t.dueOff),
      t.hours,
    ]);
  }
  console.log(`  ✓ ${taskTemplates.length} tasks`);
}

const decisionTemplates = [
  { title: 'Budget Approval Q2 — Cloud Migration', status: 'PENDING', init: 0, deadlineOff: -10, priority: 'HIGH', maker: 0 },
  { title: 'Vendor selection for SAP integration partner', status: 'PENDING', init: 6, deadlineOff: -5, priority: 'HIGH', maker: 1 },
  { title: 'Go/No-Go for Data Platform MVP', status: 'PENDING', init: 1, deadlineOff: 3, priority: 'HIGH', maker: 0 },
  { title: 'Security architecture — ZeroTrust approach', status: 'APPROVED', init: 4, deadlineOff: -15, priority: 'CRITICAL', maker: 4 },
  { title: 'RPA vendor change from UiPath to Automation Anywhere', status: 'PENDING', init: 3, deadlineOff: -3, priority: 'MEDIUM', maker: 3 },
  { title: 'Scope reduction for Legacy Decommission Q2', status: 'DEFERRED', init: 7, deadlineOff: -8, priority: 'LOW', maker: 0 },
  { title: 'Hire 2 senior cloud engineers (contractor)', status: 'PENDING', init: 0, deadlineOff: 5, priority: 'HIGH', maker: 0 },
  { title: 'Customer Portal — React vs Angular decision', status: 'APPROVED', init: 5, deadlineOff: -20, priority: 'MEDIUM', maker: 5 },
  { title: 'Training budget increase for upskilling program', status: 'PENDING', init: 11, deadlineOff: -2, priority: 'MEDIUM', maker: 5 },
  { title: 'Compliance remediation deadline extension', status: 'PENDING', init: 10, deadlineOff: 2, priority: 'CRITICAL', maker: 2 },
];

async function seedDecisions() {
  for (const d of decisionTemplates) {
    const initId = initiatives[d.init].id;
    const makerId = teamMembers[d.maker].id;
    await pool.query(`
      INSERT INTO decisions (id, organization_id, project_id, initiative_id, title, status, priority,
        decision_maker_id, deadline, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
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

const raidItems = [
  // RISKS
  { type: 'RISK', title: 'Azure region outage risk', status: 'OPEN', prob: 'MEDIUM', impact: 'HIGH', init: 0, score: 12 },
  { type: 'RISK', title: 'Data loss during Lakehouse migration', status: 'OPEN', prob: 'LOW', impact: 'CRITICAL', init: 1, score: 15 },
  { type: 'RISK', title: 'SAP vendor hotfix delay', status: 'OPEN', prob: 'HIGH', impact: 'HIGH', init: 6, score: 16 },
  { type: 'RISK', title: 'GDPR non-compliance penalty', status: 'OPEN', prob: 'MEDIUM', impact: 'CRITICAL', init: 10, score: 18 },
  { type: 'RISK', title: 'Key person dependency — Marek Nowak', status: 'OPEN', prob: 'HIGH', impact: 'HIGH', init: 0, score: 16 },
  { type: 'RISK', title: 'Budget overrun on contractor hiring', status: 'OPEN', prob: 'MEDIUM', impact: 'MEDIUM', init: 0, score: 9 },
  { type: 'RISK', title: 'Legacy system data corruption during decommission', status: 'OPEN', prob: 'LOW', impact: 'HIGH', init: 7, score: 10 },
  // ISSUES
  { type: 'ISSUE', title: 'UiPath license expired — blocking RPA', status: 'OPEN', prob: 'HIGH', impact: 'HIGH', init: 3, score: 16 },
  { type: 'ISSUE', title: 'SAP integration middleware timeout errors', status: 'OPEN', prob: 'HIGH', impact: 'CRITICAL', init: 6, score: 20 },
  { type: 'ISSUE', title: 'CI/CD pipeline flaky tests blocking deploys', status: 'OPEN', prob: 'MEDIUM', impact: 'MEDIUM', init: 8, score: 9 },
  // DEPENDENCIES
  { type: 'DEPENDENCY', title: 'API Gateway depends on Auth Service migration', status: 'OPEN', prob: 'HIGH', impact: 'HIGH', init: 2, score: 16 },
  { type: 'DEPENDENCY', title: 'Data Platform depends on Cloud Migration network setup', status: 'OPEN', prob: 'MEDIUM', impact: 'HIGH', init: 1, score: 12 },
];

async function seedRaidItems() {
  for (const r of raidItems) {
    const initId = initiatives[r.init].id;
    const ownerId = teamMembers[r.init % teamMembers.length].id;
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

async function main() {
  console.log('Seeding Manager demo data for org:', ORG);
  console.log('');

  await ensureOrg();
  console.log('  ✓ organization');

  await ensureUser();
  console.log('  ✓ admin user');

  await ensureTeam();
  console.log(`  ✓ ${teamMembers.length} team members`);

  await ensureProject();
  console.log('  ✓ project');

  await seedInitiatives();
  await seedTasks();
  await seedDecisions();
  await seedRaidItems();

  console.log('');
  console.log('Done! Refresh the browser to see data.');
  await pool.end();
}

main().catch((e) => {
  console.error('SEED ERROR:', e);
  pool.end();
  process.exit(1);
});
