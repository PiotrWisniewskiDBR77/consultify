#!/usr/bin/env tsx
/**
 * Production-safe sample data seed for DBR77 (PostgreSQL).
 *
 * Goal:
 * - Provide representative, logically connected data so key screens have content:
 *   Projects, Initiatives, Tasks, Decisions, Assessments (+ workflow/report),
 *   My Work (notifications), Benefits/KPIs, RAID, Interviews, Report Builder, Status Reports.
 *
 * Safety:
 * - PostgreSQL only
 * - Requires explicit confirmation env vars
 * - Writes ONLY to a single organization (default: dbr77)
 * - Idempotent via deterministic IDs + ON CONFLICT DO NOTHING
 *
 * Usage (repo root):
 *   SEED_MODE=production \
 *   SEED_CONFIRM=YES_I_UNDERSTAND_PRODUCTION \
 *   DB_TYPE=postgres \
 *   npx tsx server/scripts/seed-production-dbr77-sample-data.ts
 *
 * Optional:
 *   SEED_ORG_ID=dbr77
 *   SEED_ORG_NAME="Consultinity / DBR77"
 */

import dotenv from 'dotenv';
import path from 'path';
import { Pool } from 'pg';
import { v5 as uuidv5 } from 'uuid';

type PgClient = Awaited<ReturnType<Pool['connect']>>;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function requireProductionConfirmation() {
  const mode = String(process.env.SEED_MODE || '').toLowerCase();
  const confirm = String(process.env.SEED_CONFIRM || '');
  if (mode !== 'production') {
    throw new Error(`Refusing to run: set SEED_MODE=production (current: "${mode || '(empty)'}")`);
  }
  if (confirm !== 'YES_I_UNDERSTAND_PRODUCTION') {
    throw new Error(
      `Refusing to run without explicit confirmation. Set SEED_CONFIRM=YES_I_UNDERSTAND_PRODUCTION`
    );
  }
}

function makeIds(namespace: string) {
  const id = (name: string) => uuidv5(name, namespace);
  return { id };
}

async function tableExists(client: PgClient, table: string): Promise<boolean> {
  const r = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
    [table]
  );
  return r.rows.length > 0;
}

async function getColumns(client: PgClient, table: string): Promise<Set<string>> {
  const r = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1`,
    [table]
  );
  return new Set(r.rows.map((x: any) => String(x.column_name)));
}

function qIdent(name: string): string {
  // Safe enough for hardcoded table/column names in this script.
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function insertRow(
  client: PgClient,
  table: string,
  columns: Set<string>,
  row: Record<string, unknown>
) {
  const keys = Object.keys(row).filter((k) => columns.has(k) && row[k] !== undefined);
  if (keys.length === 0) return;

  const colsSql = keys.map(qIdent).join(', ');
  const valsSql = keys.map((_, i) => `$${i + 1}`).join(', ');
  const values = keys.map((k) => row[k]);
  const sql = `INSERT INTO ${qIdent(table)} (${colsSql}) VALUES (${valsSql}) ON CONFLICT DO NOTHING`;
  await client.query(sql, values);
}

async function ensureOrganization(client: PgClient, orgId: string, orgName: string) {
  if (!(await tableExists(client, 'organizations'))) return;
  const cols = await getColumns(client, 'organizations');
  // Insert minimal, keep compatible across schemas.
  await insertRow(client, 'organizations', cols, {
    id: orgId,
    name: orgName,
    plan: cols.has('plan') ? 'enterprise' : undefined,
    status: cols.has('status') ? 'active' : undefined,
    created_at: cols.has('created_at') ? new Date() : undefined,
  });
}

async function fetchUserIdsByEmail(client: PgClient, emails: string[]) {
  const r = await client.query(
    `SELECT id, email, organization_id, role FROM users WHERE email = ANY($1) ORDER BY email`,
    [emails]
  );
  const map = new Map<string, { id: string; orgId: string; role?: string }>();
  for (const row of r.rows) {
    map.set(String(row.email), {
      id: String(row.id),
      orgId: String(row.organization_id || ''),
      role: row.role ? String(row.role) : undefined,
    });
  }
  return map;
}

async function main() {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  // Optional highest-priority env file (used for staging DB from local dev)
  if (process.env.ENV_FILE) {
    dotenv.config({ path: path.resolve(process.cwd(), process.env.ENV_FILE), override: true });
  }

  requireProductionConfirmation();

  const dbType = String(process.env.DB_TYPE || '').toLowerCase();
  if (dbType && dbType !== 'postgres') {
    throw new Error(`This seed targets PostgreSQL only. Current DB_TYPE="${dbType}"`);
  }
  const databaseUrl = requireEnv('DATABASE_URL');
  if (!databaseUrl.startsWith('postgres')) throw new Error('DATABASE_URL must be postgres');

  const orgId = String(process.env.SEED_ORG_ID || 'dbr77');
  const orgName = String(process.env.SEED_ORG_NAME || 'Consultinity / DBR77');

  const namespace = uuidv5(`consultify:${orgId}:production-sample-data:v1`, uuidv5.DNS);
  const ids = makeIds(namespace);

  // Pick active DBR77 accounts so seeded work lands on real users.
  const emails = [
    'piotr.wisniewski@dbr77.com', // OWNER
    'justyna.laskowska@dbr77.com',
    'tomasz.jankowski@dbr77.com',
    'konrad.milewski@dbr77.com',
    'pawel.mroczkowski@dbr77.com',
    'wojciech.wesolowski@dbr77.com',
    'bartosz.solomski@dbr77.com',
    'katarzyna.szwarocka@dbr77.com',
  ];

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl:
      process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
        : false,
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await ensureOrganization(client, orgId, orgName);

    const users = await fetchUserIdsByEmail(client, emails);
    for (const e of emails) {
      const u = users.get(e);
      if (!u) throw new Error(`Missing required user account: ${e}. Run user seed first.`);
      if (u.orgId !== orgId) {
        throw new Error(
          `User ${e} belongs to org "${u.orgId}", expected "${orgId}". Refusing to seed mixed tenants.`
        );
      }
    }

    const piotrId = users.get('piotr.wisniewski@dbr77.com')!.id;
    const justynaId = users.get('justyna.laskowska@dbr77.com')!.id;
    const konradId = users.get('konrad.milewski@dbr77.com')!.id;
    const wojciechId = users.get('wojciech.wesolowski@dbr77.com')!.id;

    // ---------------------------------------------------------------------
    // Projects
    // ---------------------------------------------------------------------
    if (await tableExists(client, 'projects')) {
      const cols = await getColumns(client, 'projects');
      const now = new Date();
      const projects = [
        {
          id: ids.id('project:transformation'),
          name: 'DBR77 Transformation Program',
          description:
            'Program transformacji: portfel inicjatyw, decyzji, benefitów i raportów statusowych.',
          status: 'active',
          phase: 'execution',
          owner_id: piotrId,
          organization_id: orgId,
          created_at: now,
          updated_at: now,
        },
        {
          id: ids.id('project:quickwins'),
          name: 'DBR77 Quick Wins — Automation',
          description: 'Szybkie wdrożenia automatyzacji: backlog zadań, KPI i decyzje wykonawcze.',
          status: 'active',
          phase: 'planning',
          owner_id: justynaId,
          organization_id: orgId,
          created_at: now,
          updated_at: now,
        },
      ];
      for (const p of projects) await insertRow(client, 'projects', cols, p);
    }

    const projectA = ids.id('project:transformation');
    const projectB = ids.id('project:quickwins');

    // ---------------------------------------------------------------------
    // Initiatives (create a small coherent set)
    // ---------------------------------------------------------------------
    const initiativesSeeded: string[] = [];
    if (await tableExists(client, 'initiatives')) {
      const cols = await getColumns(client, 'initiatives');
      const nowIso = new Date().toISOString();
      const initiatives = [
        {
          id: ids.id('initiative:ai-automation'),
          organization_id: orgId,
          project_id: projectA,
          name: 'AI-Powered Process Automation',
          title: 'AI-Powered Process Automation',
          description: 'Automatyzacja procesów z wykorzystaniem ML i orkiestracji workflow.',
          status: 'IN_EXECUTION',
          priority: 'HIGH',
          progress: 55,
          created_by: piotrId,
          created_at: nowIso,
          updated_at: nowIso,
          source_type: 'manual',
        },
        {
          id: ids.id('initiative:data-platform'),
          organization_id: orgId,
          project_id: projectA,
          name: 'Data Analytics Platform',
          title: 'Data Analytics Platform',
          description: 'Platforma danych: lakehouse + BI + modele predykcyjne.',
          status: 'PENDING_APPROVAL',
          priority: 'HIGH',
          progress: 25,
          created_by: justynaId,
          created_at: nowIso,
          updated_at: nowIso,
          source_type: 'manual',
        },
        {
          id: ids.id('initiative:cyber'),
          organization_id: orgId,
          project_id: projectA,
          name: 'Cybersecurity Enhancement',
          title: 'Cybersecurity Enhancement',
          description: 'Zero Trust + SIEM/SOAR + szkolenia i hardening.',
          status: 'APPROVED',
          priority: 'MEDIUM',
          progress: 10,
          created_by: wojciechId,
          created_at: nowIso,
          updated_at: nowIso,
          source_type: 'manual',
        },
        {
          id: ids.id('initiative:ops-quickwin'),
          organization_id: orgId,
          project_id: projectB,
          name: 'Automated Changeover Optimization',
          title: 'Automated Changeover Optimization',
          description: 'Optymalizacja przezbrojeń (SMED) + automatyzacja checklist i raportów.',
          status: 'DRAFT',
          priority: 'HIGH',
          progress: 0,
          created_by: justynaId,
          created_at: nowIso,
          updated_at: nowIso,
          source_type: 'manual',
        },
      ];
      for (const i of initiatives) {
        await insertRow(client, 'initiatives', cols, i);
        initiativesSeeded.push(i.id);
      }
    }

    // ---------------------------------------------------------------------
    // Tasks (for My Work + initiative pages)
    // ---------------------------------------------------------------------
    const tasksSeeded: string[] = [];
    if (await tableExists(client, 'tasks')) {
      const cols = await getColumns(client, 'tasks');
      const nowIso = new Date().toISOString();
      const dueSoon = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
      const overdue = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);

      const mkTask = (key: string, row: Record<string, unknown>) => ({
        id: ids.id(`task:${key}`),
        organization_id: orgId,
        project_id: row.project_id,
        initiative_id: row.initiative_id,
        title: row.title,
        description: row.description,
        status: row.status,
        priority: row.priority,
        due_date: row.due_date,
        assignee_id: row.assignee_id,
        created_by: row.created_by,
        created_at: nowIso,
        updated_at: nowIso,
      });

      const t = [
        mkTask('automation-design', {
          project_id: projectA,
          initiative_id: ids.id('initiative:ai-automation'),
          title: 'Design automation workflow v1',
          description: 'Zdefiniuj proces, KPI i plan rollout.',
          status: 'in_progress',
          priority: 'high',
          due_date: dueSoon,
          assignee_id: justynaId,
          created_by: piotrId,
        }),
        mkTask('automation-overdue', {
          project_id: projectA,
          initiative_id: ids.id('initiative:ai-automation'),
          title: 'Close open risks for automation',
          description: 'Uzupełnij RAID i zaplanuj mitigacje.',
          status: 'blocked',
          priority: 'critical',
          due_date: overdue,
          assignee_id: konradId,
          created_by: piotrId,
        }),
        mkTask('data-platform-sprint', {
          project_id: projectA,
          initiative_id: ids.id('initiative:data-platform'),
          title: 'Prepare data model and ingestion plan',
          description: 'Warianty: batch vs streaming; SLA jakości danych.',
          status: 'todo',
          priority: 'medium',
          due_date: dueSoon,
          assignee_id: piotrId,
          created_by: justynaId,
        }),
        mkTask('quickwin-checklist', {
          project_id: projectB,
          initiative_id: ids.id('initiative:ops-quickwin'),
          title: 'Define SMED checklist + milestones',
          description: 'Zaproponuj listę kroków i pomiar czasu przezbrojenia.',
          status: 'todo',
          priority: 'high',
          due_date: dueSoon,
          assignee_id: justynaId,
          created_by: justynaId,
        }),
      ];

      for (const row of t) {
        await insertRow(client, 'tasks', cols, row);
        tasksSeeded.push(String(row.id));
      }
    }

    // ---------------------------------------------------------------------
    // Decisions (for My Work + Decision inbox)
    // ---------------------------------------------------------------------
    const decisionsSeeded: string[] = [];
    if (await tableExists(client, 'decisions')) {
      const cols = await getColumns(client, 'decisions');
      const nowIso = new Date().toISOString();
      const dueSoon = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      const overdue = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);

      const d = [
        {
          id: ids.id('decision:approve-automation'),
          organization_id: orgId,
          project_id: projectA,
          initiative_id: ids.id('initiative:ai-automation'),
          task_id: null,
          title: 'Approve automation scope v1',
          description: 'Go/No-Go dla zakresu MVP automatyzacji.',
          type: 'APPROVAL',
          decision_maker_id: piotrId,
          status: 'pending',
          priority: 'high',
          deadline: dueSoon,
          created_by: justynaId,
          created_at: nowIso,
          updated_at: nowIso,
        },
        {
          id: ids.id('decision:risk-acceptance'),
          organization_id: orgId,
          project_id: projectA,
          initiative_id: ids.id('initiative:ai-automation'),
          task_id: tasksSeeded[1] || null,
          title: 'Risk acceptance: vendor dependency',
          description: 'Akceptacja ryzyka opóźnienia integracji z systemem X.',
          type: 'GO_NO_GO',
          decision_maker_id: konradId,
          status: 'escalated',
          priority: 'critical',
          deadline: overdue,
          created_by: piotrId,
          created_at: nowIso,
          updated_at: nowIso,
        },
      ];

      for (const row of d) {
        await insertRow(client, 'decisions', cols, row);
        decisionsSeeded.push(String(row.id));
      }
    }

    // ---------------------------------------------------------------------
    // Assessments (+ workflow + report) — used by AssessmentHub
    // ---------------------------------------------------------------------
    const assessmentsSeeded: string[] = [];
    if (await tableExists(client, 'assessments')) {
      const cols = await getColumns(client, 'assessments');
      const nowIso = new Date().toISOString();
      const a = [
        {
          id: ids.id('assessment:drd-1'),
          organization_id: orgId,
          project_id: projectA,
          assessment_type: 'DRD',
          framework_type: 'DRD',
          name: 'DRD — Baseline assessment',
          status: 'IN_REVIEW',
          completion_percent: 62,
          confidence_avg: 3,
          score_summary: JSON.stringify({ overall: { actual: 2.8 } }),
          created_by: piotrId,
          created_at: nowIso,
          updated_at: nowIso,
        },
        {
          id: ids.id('assessment:drd-2'),
          organization_id: orgId,
          project_id: projectB,
          assessment_type: 'DRD',
          framework_type: 'DRD',
          name: 'DRD — Quick Wins assessment',
          status: 'APPROVED',
          completion_percent: 100,
          confidence_avg: 4,
          score_summary: JSON.stringify({ overall: { actual: 3.4 } }),
          created_by: justynaId,
          created_at: nowIso,
          updated_at: nowIso,
          approved_at: nowIso,
        },
      ];
      for (const row of a) {
        await insertRow(client, 'assessments', cols, row);
        assessmentsSeeded.push(String(row.id));
      }
    }

    if (assessmentsSeeded.length > 0 && (await tableExists(client, 'assessment_workflows'))) {
      const cols = await getColumns(client, 'assessment_workflows');
      await insertRow(client, 'assessment_workflows', cols, {
        id: ids.id('assessment_workflow:1'),
        assessment_id: assessmentsSeeded[0],
        status: 'IN_REVIEW',
        created_at: cols.has('created_at') ? new Date() : undefined,
        updated_at: cols.has('updated_at') ? new Date() : undefined,
      });
    }

    if (assessmentsSeeded.length > 0 && (await tableExists(client, 'assessment_reports'))) {
      const cols = await getColumns(client, 'assessment_reports');
      await insertRow(client, 'assessment_reports', cols, {
        id: ids.id('assessment_report:1'),
        assessment_id: assessmentsSeeded[0],
        organization_id: orgId,
        version: cols.has('version') ? 1 : undefined,
        status: cols.has('status') ? 'DRAFT' : undefined,
        content_json: cols.has('content_json') ? JSON.stringify({ blocks: [] }) : undefined,
        created_by: cols.has('created_by') ? piotrId : undefined,
        created_at: cols.has('created_at') ? new Date() : undefined,
      });
    }

    // ---------------------------------------------------------------------
    // Notifications (so Notification dropdown + My Work inbox has items)
    // ---------------------------------------------------------------------
    if (await tableExists(client, 'notifications')) {
      const cols = await getColumns(client, 'notifications');
      const nowIso = new Date().toISOString();
      const notif = (key: string, row: Record<string, unknown>) => ({
        id: `notif-${ids.id(`notif:${key}`)}`,
        user_id: row.user_id,
        organization_id: orgId,
        type: row.type,
        title: row.title,
        body: row.body,
        message: row.message,
        severity: row.severity,
        priority: row.priority,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        related_object_type: row.related_object_type,
        related_object_id: row.related_object_id,
        project_id: row.project_id,
        is_read: row.is_read,
        created_at: nowIso,
      });

      const rows = [
        notif('task_overdue', {
          user_id: konradId,
          type: 'TASK_OVERDUE',
          title: 'Task overdue: Close open risks for automation',
          body: 'Task is overdue. Please update RAID and provide mitigation plan.',
          severity: 'CRITICAL',
          priority: 'critical',
          related_object_type: 'task',
          related_object_id: tasksSeeded[1] || null,
          project_id: projectA,
          is_read: 0,
        }),
        notif('decision_required', {
          user_id: piotrId,
          type: 'DECISION_REQUIRED',
          title: 'Decision required: Approve automation scope v1',
          body: 'A decision is awaiting your action.',
          severity: 'WARNING',
          priority: 'urgent',
          related_object_type: 'decision',
          related_object_id: ids.id('decision:approve-automation'),
          project_id: projectA,
          is_read: 0,
        }),
        notif('assessment_review', {
          user_id: justynaId,
          type: 'REVIEW_REQUEST',
          title: 'Assessment awaiting review',
          body: 'DRD — Baseline assessment is ready for review.',
          severity: 'INFO',
          priority: 'normal',
          related_object_type: 'assessment',
          related_object_id: ids.id('assessment:drd-1'),
          project_id: projectA,
          is_read: 1,
        }),
      ];
      for (const row of rows) await insertRow(client, 'notifications', cols, row);
    }

    // ---------------------------------------------------------------------
    // RAID
    // ---------------------------------------------------------------------
    if (await tableExists(client, 'raid_items')) {
      const cols = await getColumns(client, 'raid_items');
      const mk = (t: string, title: string) => ({
        id: ids.id(`raid_item:${t}`),
        organization_id: orgId,
        initiative_id: cols.has('initiative_id') ? ids.id('initiative:ai-automation') : undefined,
        type: t,
        title,
        // Must satisfy CHECK constraint (OPEN/MITIGATED/REALIZED/CLOSED)
        status: cols.has('status') ? 'OPEN' : undefined,
        priority: cols.has('priority') ? 'high' : undefined,
        created_by: cols.has('created_by') ? piotrId : undefined,
        created_at: cols.has('created_at') ? new Date().toISOString() : undefined,
      });
      const items = [
        mk('RISK', 'Vendor dependency may delay integration'),
        mk('ISSUE', 'Environment instability during peak hours'),
        mk('ASSUMPTION', 'Key stakeholders available for workshops'),
        mk('DEPENDENCY', 'Access to ERP APIs granted by IT security'),
      ];
      for (const it of items) await insertRow(client, 'raid_items', cols, it);

      // Subtype tables (if exist)
      const subtypeMap: Array<[string, string]> = [
        ['raid_risks', 'RISK'],
        ['raid_issues', 'ISSUE'],
        ['raid_assumptions', 'ASSUMPTION'],
        ['raid_dependencies', 'DEPENDENCY'],
      ];
      for (const [tbl, type] of subtypeMap) {
        if (!(await tableExists(client, tbl))) continue;
        const c = await getColumns(client, tbl);
        await insertRow(client, tbl, c, {
          raid_item_id: ids.id(`raid_item:${type}`),
        });
      }
    }

    // ---------------------------------------------------------------------
    // Benefits + KPI
    // ---------------------------------------------------------------------
    let benefitId: string | null = null;
    if (await tableExists(client, 'initiative_benefits')) {
      const cols = await getColumns(client, 'initiative_benefits');
      benefitId = ids.id('benefit:automation-time-saved');
      await insertRow(client, 'initiative_benefits', cols, {
        id: benefitId,
        initiative_id: ids.id('initiative:ai-automation'),
        organization_id: orgId,
        name: 'Time saved per week',
        description: cols.has('description') ? 'Oszczędność czasu dzięki automatyzacji' : undefined,
        target_value: 120.0,
        unit: cols.has('unit') ? 'hours/week' : undefined,
        created_at: cols.has('created_at') ? new Date().toISOString() : undefined,
      });
    }

    if (benefitId && (await tableExists(client, 'benefit_measurements'))) {
      const cols = await getColumns(client, 'benefit_measurements');
      await insertRow(client, 'benefit_measurements', cols, {
        id: ids.id('benefit_measurement:1'),
        benefit_id: benefitId,
        measured_value: 35.0,
        measured_at: new Date().toISOString().slice(0, 10),
      });
    }

    if (await tableExists(client, 'benefit_categories')) {
      const cols = await getColumns(client, 'benefit_categories');
      await insertRow(client, 'benefit_categories', cols, {
        id: ids.id('benefit_category:efficiency'),
        name: 'Efficiency',
        description: cols.has('description') ? 'Operational efficiency' : undefined,
      });
    }

    if (await tableExists(client, 'benefit_targets')) {
      const cols = await getColumns(client, 'benefit_targets');
      await insertRow(client, 'benefit_targets', cols, {
        id: ids.id('benefit_target:2026'),
        organization_id: orgId,
        year: new Date().getFullYear(),
      });
    }

    // KPI definition + initiative KPI + measurement
    if (await tableExists(client, 'kpi_definitions')) {
      const cols = await getColumns(client, 'kpi_definitions');
      await insertRow(client, 'kpi_definitions', cols, {
        id: ids.id('kpi_def:automation-throughput'),
        organization_id: orgId,
        name: 'Automation throughput',
        category: 'Operational',
        unit: 'cases/day',
        direction: 'UP',
        description: cols.has('description') ? 'Liczba spraw obsłużonych dziennie' : undefined,
      });
    }

    let initiativeKpiId: string | null = null;
    if (await tableExists(client, 'initiative_kpis')) {
      const cols = await getColumns(client, 'initiative_kpis');
      initiativeKpiId = ids.id('initiative_kpi:automation-throughput');
      await insertRow(client, 'initiative_kpis', cols, {
        id: initiativeKpiId,
        initiative_id: ids.id('initiative:ai-automation'),
        name: 'Automation throughput',
        unit: cols.has('unit') ? 'cases/day' : undefined,
        target_value: cols.has('target_value') ? 250 : undefined,
        is_primary: cols.has('is_primary') ? true : undefined,
      });
    }

    if (initiativeKpiId && (await tableExists(client, 'kpi_measurements'))) {
      const cols = await getColumns(client, 'kpi_measurements');
      await insertRow(client, 'kpi_measurements', cols, {
        id: cols.has('id') ? ids.id('kpi_measurement:1') : undefined,
        kpi_id: initiativeKpiId,
        value: 145,
        measured_at: new Date().toISOString(),
        created_by: cols.has('created_by') ? piotrId : undefined,
      });
    }

    // ---------------------------------------------------------------------
    // Lessons learned
    // ---------------------------------------------------------------------
    if (await tableExists(client, 'lessons_learned')) {
      const cols = await getColumns(client, 'lessons_learned');
      await insertRow(client, 'lessons_learned', cols, {
        id: ids.id('lesson:automation'),
        initiative_id: ids.id('initiative:ai-automation'),
        organization_id: orgId,
        title: 'Stakeholder alignment early reduces rework',
        description: 'Ustal definicję sukcesu i ownerów zanim zaczniesz implementację.',
        lesson_type: 'PROCESS',
        created_by: cols.has('created_by') ? piotrId : undefined,
        created_at: cols.has('created_at') ? new Date().toISOString() : undefined,
      });
    }

    if ((await tableExists(client, 'decision_lessons')) && decisionsSeeded.length > 0) {
      const cols = await getColumns(client, 'decision_lessons');
      await insertRow(client, 'decision_lessons', cols, {
        id: ids.id('decision_lesson:1'),
        decision_id: cols.has('decision_id') ? decisionsSeeded[0] : undefined,
        title: 'Define clear criteria before approval',
        lesson_text: 'Decyzje powinny mieć kryteria i deadline, inaczej eskalują.',
      });
    }

    // ---------------------------------------------------------------------
    // Interviews (templates + one session with messages + insight)
    // ---------------------------------------------------------------------
    if (await tableExists(client, 'interview_templates')) {
      const colsT = await getColumns(client, 'interview_templates');
      const templateId = ids.id('interview_template:baseline');
      await insertRow(client, 'interview_templates', colsT, {
        id: templateId,
        organization_id: colsT.has('organization_id') ? orgId : undefined,
        name: colsT.has('name') ? 'Baseline discovery interview' : undefined,
        description: colsT.has('description') ? 'Template pytań do discovery' : undefined,
        created_by: colsT.has('created_by') ? piotrId : undefined,
        created_at: colsT.has('created_at') ? new Date().toISOString() : undefined,
      });

      if (await tableExists(client, 'interview_template_sections')) {
        const colsS = await getColumns(client, 'interview_template_sections');
        await insertRow(client, 'interview_template_sections', colsS, {
          id: ids.id('interview_template_section:1'),
          template_id: templateId,
          name: 'Context',
          sort_order: colsS.has('sort_order') ? 1 : undefined,
        });
      }
      if (await tableExists(client, 'interview_template_questions')) {
        const colsQ = await getColumns(client, 'interview_template_questions');
        await insertRow(client, 'interview_template_questions', colsQ, {
          id: ids.id('interview_template_question:1'),
          template_id: templateId,
          category: 'Process',
          question_text: 'What is the biggest blocker in your current workflow?',
          sort_order: colsQ.has('sort_order') ? 1 : undefined,
        });
      }

      // Session + content
      if (await tableExists(client, 'interview_sessions')) {
        const cols = await getColumns(client, 'interview_sessions');
        const sessionId = ids.id('interview_session:1');
        await insertRow(client, 'interview_sessions', cols, {
          id: sessionId,
          organization_id: orgId,
          owner_id: piotrId,
          project_id: cols.has('project_id') ? projectA : undefined,
          title: cols.has('title') ? 'Discovery: Automation scope' : undefined,
          status: cols.has('status') ? 'active' : undefined,
          created_at: cols.has('created_at') ? new Date().toISOString() : undefined,
        });

        if (await tableExists(client, 'interview_messages')) {
          const c = await getColumns(client, 'interview_messages');
          await insertRow(client, 'interview_messages', c, {
            id: ids.id('interview_message:1'),
            session_id: sessionId,
            role: 'user',
            content: 'We waste a lot of time on manual handoffs and approvals.',
            created_at: c.has('created_at') ? new Date().toISOString() : undefined,
          });
          await insertRow(client, 'interview_messages', c, {
            id: ids.id('interview_message:2'),
            session_id: sessionId,
            role: 'ai',
            content: 'What are the top 3 approval steps that cause delays?',
            created_at: c.has('created_at') ? new Date().toISOString() : undefined,
          });
        }

        if (await tableExists(client, 'interview_questions')) {
          const c = await getColumns(client, 'interview_questions');
          await insertRow(client, 'interview_questions', c, {
            id: ids.id('interview_question:1'),
            session_id: sessionId,
            organization_id: orgId,
            category: 'Process',
            question_text: 'Top 3 approval steps that cause delays?',
            created_at: c.has('created_at') ? new Date().toISOString() : undefined,
          });
        }

        if (await tableExists(client, 'interview_insights')) {
          const c = await getColumns(client, 'interview_insights');
          await insertRow(client, 'interview_insights', c, {
            id: ids.id('interview_insight:1'),
            session_id: sessionId,
            organization_id: orgId,
            category: 'Bottleneck',
            title: 'Approvals are the main bottleneck',
            description: c.has('description')
              ? 'Manual approvals introduce delays; automate validation and routing.'
              : undefined,
            created_at: c.has('created_at') ? new Date().toISOString() : undefined,
          });
        }
      }

      // Assignments (for Interview hub)
      if (await tableExists(client, 'interview_assignments')) {
        const cols = await getColumns(client, 'interview_assignments');
        await insertRow(client, 'interview_assignments', cols, {
          id: ids.id('interview_assignment:1'),
          organization_id: orgId,
          assignee_user_id: justynaId,
          template_id: templateId,
          status: cols.has('status') ? 'assigned' : undefined,
          created_at: cols.has('created_at') ? new Date().toISOString() : undefined,
        });
      }
    }

    // ---------------------------------------------------------------------
    // Report Builder + Management Reports + Status Reports
    // ---------------------------------------------------------------------
    if (await tableExists(client, 'report_builder_templates')) {
      const cols = await getColumns(client, 'report_builder_templates');
      await insertRow(client, 'report_builder_templates', cols, {
        id: ids.id('rb_tpl:initiative_onepager'),
        name: 'Initiative One-Pager (Sample)',
        source_type: 'initiative',
        sections_json: JSON.stringify([
          { id: 'sec-1', title: 'Summary', blocks: [{ type: 'text', content: '...' }] },
          { id: 'sec-2', title: 'KPIs', blocks: [{ type: 'kpi', content: '...' }] },
        ]),
        created_by: cols.has('created_by') ? piotrId : undefined,
        created_at: cols.has('created_at') ? new Date().toISOString() : undefined,
      });
    }

    if (await tableExists(client, 'report_builder_reports')) {
      const cols = await getColumns(client, 'report_builder_reports');
      await insertRow(client, 'report_builder_reports', cols, {
        id: ids.id('rb_report:initiative_1'),
        organization_id: orgId,
        source_type: 'initiative',
        source_id: ids.id('initiative:ai-automation'),
        title: 'AI Automation — One Pager',
        report_type: 'ONE_PAGER',
        created_by: piotrId,
        status: cols.has('status') ? 'DRAFT' : undefined,
        created_at: cols.has('created_at') ? new Date().toISOString() : undefined,
      });
    }

    if (await tableExists(client, 'management_reports')) {
      const cols = await getColumns(client, 'management_reports');
      await insertRow(client, 'management_reports', cols, {
        id: ids.id('mgmt_report:team_meeting_1'),
        organization_id: orgId,
        report_type: 'TEAM_MEETING',
        title: 'Weekly Team Meeting — Sample',
        generated_by: piotrId,
        status: cols.has('status') ? 'DRAFT' : undefined,
        created_at: cols.has('created_at') ? new Date().toISOString() : undefined,
      });
    }

    if ((await tableExists(client, 'status_reports')) && initiativesSeeded.length > 0) {
      const cols = await getColumns(client, 'status_reports');
      const today = new Date();
      const start = new Date(today.getTime() - 7 * 86400000).toISOString().slice(0, 10);
      const end = today.toISOString().slice(0, 10);
      await insertRow(client, 'status_reports', cols, {
        id: ids.id('status_report:1'),
        organization_id: orgId,
        initiative_id: initiativesSeeded[0],
        period_start: start,
        period_end: end,
        created_by: piotrId,
        summary: cols.has('summary') ? 'Progressing; one escalation pending.' : undefined,
        created_at: cols.has('created_at') ? new Date().toISOString() : undefined,
      });
    }

    await client.query('COMMIT');

    // eslint-disable-next-line no-console
    console.log('✅ Production sample data seed completed');
    // eslint-disable-next-line no-console
    console.log(`- Organization: ${orgId} (${orgName})`);
    // eslint-disable-next-line no-console
    console.log(`- Projects: 2 (deterministic)`); // may already exist but ensured
    // eslint-disable-next-line no-console
    console.log(`- Initiatives seeded: ${initiativesSeeded.length}`);
    // eslint-disable-next-line no-console
    console.log(`- Tasks seeded: ${tasksSeeded.length}`);
    // eslint-disable-next-line no-console
    console.log(`- Decisions seeded: ${decisionsSeeded.length}`);
    // eslint-disable-next-line no-console
    console.log(`- Assessments seeded: ${assessmentsSeeded.length}`);
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('❌ Seed failed:', e?.message || e);
  process.exit(1);
});
