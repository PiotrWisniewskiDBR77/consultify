#!/usr/bin/env tsx
/**
 * Seed demo data for Interview module (PostgreSQL).
 *
 * Goal:
 * - Provide diverse, logically connected demo data so Interview screens have content:
 *   Templates, Inbox (my assignments), Assigned (managed), Sessions (accepted sources), Insights.
 *
 * Safety:
 * - No deletions
 * - Idempotent via deterministic IDs + ON CONFLICT DO NOTHING
 * - Refuses to run in explicit production mode unless confirmed
 *
 * Usage (repo root):
 *   DB_TYPE=postgres DATABASE_URL="postgresql://..." npx tsx server/scripts/seed-interview-demo.ts
 *
 * Optional:
 *   SEED_ORG_ID=org_xxx
 *   SEED_USER_EMAIL=user@example.com   (manager/owner perspective)
 *   SEED_PROJECT_ID=proj_xxx
 *   SEED_ENV_FILE=.env.staging.local   (load env from custom file)
 */
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

type AnyRow = Record<string, any>;

function nowIso() {
  return new Date().toISOString();
}

function isoPlusDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function requireNotEmpty<T>(v: T | null | undefined, msg: string): T {
  if (v == null) throw new Error(msg);
  return v;
}

function requireEnv(name: string): string {
  const value = String(process.env[name] || '').trim();
  if (!value)
    throw new Error(`[ODMOWA] Brak zmiennej ${name}. Ustaw ją przed uruchomieniem seeda.`);
  return value;
}

function qIdent(name: string): string {
  // Hardcoded identifiers only; still quote to avoid reserved words.
  return `"${String(name).replace(/"/g, '""')}"`;
}

function requireSafeMode() {
  const mode = String(process.env.SEED_MODE || '').toLowerCase();
  if (mode !== 'production') return;
  const confirm = String(process.env.SEED_CONFIRM || '');
  if (confirm !== 'YES_I_UNDERSTAND_PRODUCTION') {
    throw new Error(
      'Refusing to run in production mode without explicit confirmation. Set SEED_CONFIRM=YES_I_UNDERSTAND_PRODUCTION'
    );
  }
}

async function tableExists(db: any, table: string): Promise<boolean> {
  const rows = await db.all(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = ? LIMIT 1`,
    [table]
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function getColumns(db: any, table: string): Promise<Set<string>> {
  const rows = await db.all(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name = ?`,
    [table]
  );
  return new Set((rows || []).map((r: any) => String(r.column_name)));
}

async function insertIfPossible(
  db: any,
  table: string,
  row: Record<string, any>,
  tableColumns?: Set<string>
): Promise<void> {
  const cols = tableColumns
    ? Object.keys(row).filter((k) => tableColumns.has(k) && row[k] !== undefined)
    : Object.keys(row).filter((k) => row[k] !== undefined);
  if (cols.length === 0) return;

  const values = cols.map((c) => row[c]);
  const sql = `INSERT INTO ${qIdent(table)} (${cols.map(qIdent).join(', ')})
               VALUES (${cols.map(() => '?').join(', ')})
               ON CONFLICT (id) DO NOTHING`;
  await db.run(sql, values);
}

async function upsertIfPossible(
  db: any,
  table: string,
  row: Record<string, any>,
  tableColumns?: Set<string>,
  opts?: { conflictTarget?: string[] }
): Promise<void> {
  const cols = tableColumns
    ? Object.keys(row).filter((k) => tableColumns.has(k) && row[k] !== undefined)
    : Object.keys(row).filter((k) => row[k] !== undefined);
  const conflictTarget = opts?.conflictTarget?.length ? opts.conflictTarget : ['id'];
  for (const k of conflictTarget) {
    if (!cols.includes(k)) {
      throw new Error(`upsertIfPossible requires conflict target field "${k}" for table=${table}`);
    }
  }
  const values = cols.map((c) => row[c]);
  const updateCols = cols.filter((c) => !conflictTarget.includes(c));
  const sql = `INSERT INTO ${qIdent(table)} (${cols.map(qIdent).join(', ')})
               VALUES (${cols.map(() => '?').join(', ')})
               ON CONFLICT (${conflictTarget.map(qIdent).join(', ')}) DO UPDATE SET ${updateCols
                 .map((c) => `${qIdent(c)} = EXCLUDED.${qIdent(c)}`)
                 .join(', ')}`;
  await db.run(sql, values);
}

async function ensureSeedUsers(
  db: any,
  orgId: string,
  managerUser: AnyRow,
  seedUserPassword: string
) {
  const usersCols = await getColumns(db, 'users');
  const passwordHash = await bcrypt.hash(seedUserPassword, 10);
  const baseNow = nowIso();

  const seedUsers = [
    {
      id: managerUser.id,
      email: managerUser.email,
      first_name: managerUser.first_name,
      last_name: managerUser.last_name,
      role: managerUser.role,
    },
    {
      id: `seed_user_${orgId}_ops_lead`,
      email: `ops.lead+${orgId}@seed.local`,
      first_name: 'Ola',
      last_name: 'Nowak',
      role: 'TEAM_MEMBER',
    },
    {
      id: `seed_user_${orgId}_finance`,
      email: `finance+${orgId}@seed.local`,
      first_name: 'Marek',
      last_name: 'Kowalski',
      role: 'TEAM_MEMBER',
    },
    {
      id: `seed_user_${orgId}_it`,
      email: `it+${orgId}@seed.local`,
      first_name: 'Anna',
      last_name: 'Zielińska',
      role: 'TEAM_MEMBER',
    },
  ];

  // Create users only if they do not exist by email.
  for (const u of seedUsers.slice(1)) {
    const existing = await db.get(`SELECT id FROM users WHERE email = ? LIMIT 1`, [u.email]);
    if (existing?.id) continue;

    const row: Record<string, any> = {
      id: u.id,
      organization_id: orgId,
      email: u.email,
      password: passwordHash,
      first_name: u.first_name,
      last_name: u.last_name,
      role: u.role,
      status: 'active',
      created_at: baseNow,
    };

    // Some schemas use "name" field; populate if present.
    if (usersCols.has('name')) {
      row.name = `${u.first_name} ${u.last_name}`;
    }
    // Some schemas use "updated_at"; populate if present.
    if (usersCols.has('updated_at')) {
      row.updated_at = baseNow;
    }

    await insertIfPossible(db, 'users', row, usersCols);
  }

  return {
    opsLeadId: `seed_user_${orgId}_ops_lead`,
    financeId: `seed_user_${orgId}_finance`,
    itId: `seed_user_${orgId}_it`,
  };
}

async function main() {
  const seedEnvFile = String(process.env.SEED_ENV_FILE || '').trim();
  if (seedEnvFile) {
    // Use the server's layered env loader as the canonical mechanism (ENV_FILE),
    // but also load here for scripts that run before server config modules.
    process.env.ENV_FILE = seedEnvFile;
    // Ensure the extra env file can override repo-root `.env.local` during a seed run.
    process.env.DOTENV_OVERRIDE = '1';
    dotenv.config({ path: path.resolve(process.cwd(), seedEnvFile), override: true });
  }
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: false });
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: false });

  requireSafeMode();
  const seedUserPassword = requireEnv('SEED_USER_PASSWORD');

  // Seed scripts should not attempt to mutate/patch full DB schema (especially on staging/prod-like DBs).
  // We only insert Interview demo rows (idempotently), so disable managed schema init.
  process.env.DB_MANAGED_SCHEMA = 'off';

  const { getDatabaseAsync } = await import('../src/database/Database.js');
  const db = await getDatabaseAsync();

  const seedOrgId = String(process.env.SEED_ORG_ID || '').trim();
  const seedProjectId = String(process.env.SEED_PROJECT_ID || '').trim();
  const seedUserEmail = String(process.env.SEED_USER_EMAIL || '').trim();

  // Prefer resolving orgId from the explicit seed user (so seeded data shows up for that user).
  const resolvedFromEmailOrgId = await (async () => {
    if (!seedUserEmail) return null;
    const row = await db.get(`SELECT organization_id FROM users WHERE email = ? LIMIT 1`, [
      seedUserEmail,
    ]);
    return row?.organization_id ? String(row.organization_id) : null;
  })();

  const requestedOrgId = seedOrgId || resolvedFromEmailOrgId;
  requireNotEmpty(
    requestedOrgId,
    '[seed-interview-demo] Set SEED_ORG_ID explicitly or provide SEED_USER_EMAIL from the target organization.'
  );
  const orgId = await (async () => {
    const row = await db.get(`SELECT id FROM organizations WHERE id = ? LIMIT 1`, [requestedOrgId]);
    return row?.id ? String(row.id) : null;
  })();
  requireNotEmpty(
    orgId,
    `[seed-interview-demo] Target organization "${requestedOrgId}" not found.`
  );

  const managerUser = (await (async () => {
    if (seedUserEmail) {
      const row = await db.get(
        `SELECT id, email, role, first_name, last_name
           FROM users
           WHERE email = ?
           LIMIT 1`,
        [seedUserEmail]
      );
      if (!row?.id) throw new Error(`User not found for SEED_USER_EMAIL=${seedUserEmail}`);
      return row;
    }

    // Prefer a manager/admin-like user.
    const preferred = await db.get(
      `SELECT id, email, role, first_name, last_name
         FROM users
         WHERE organization_id = ?
           AND role IN ('OWNER', 'ADMIN', 'SUPERADMIN', 'PROJECT_MANAGER')
         ORDER BY created_at DESC
         LIMIT 1`,
      [orgId]
    );
    if (preferred?.id) return preferred;

    const anyUser = await db.get(
      `SELECT id, email, role, first_name, last_name
         FROM users
         WHERE organization_id = ?
         ORDER BY created_at DESC
         LIMIT 1`,
      [orgId]
    );
    return anyUser;
  })()) as AnyRow;
  requireNotEmpty(
    managerUser?.id,
    'No users found for selected organization. Create a user first.'
  );

  const projectId =
    seedProjectId ||
    (await (async () => {
      const row = await db.get(
        `SELECT id FROM projects WHERE organization_id = ? ORDER BY created_at DESC LIMIT 1`,
        [orgId]
      );
      return row?.id ? String(row.id) : null;
    })());

  const { opsLeadId, financeId, itId } = await ensureSeedUsers(
    db,
    orgId,
    managerUser,
    seedUserPassword
  );

  const tablesNeeded = [
    'organization_context',
    'interview_library_templates',
    'interview_library_template_questions',
    'interview_sessions',
    'interview_questions',
    'interview_assignments',
    'interview_insights',
    'interview_assignment_members',
  ];

  const tableOk: Record<string, boolean> = {};
  for (const t of tablesNeeded) tableOk[t] = await tableExists(db, t);

  // -------------------------------------------
  // Organization context
  // -------------------------------------------
  if (tableOk.organization_context) {
    const cols = await getColumns(db, 'organization_context');
    await upsertIfPossible(
      db,
      'organization_context',
      {
        id: `seed_org_ctx_${orgId}`,
        organization_id: orgId,
        company_name: 'Novatek Manufacturing Sp. z o.o.',
        industry: 'Manufacturing (Discrete)',
        company_size: 'Mid-Market',
        location: 'PL · Silesia',
        employee_count: 620,
        annual_revenue: '€120M',
        key_metrics: JSON.stringify([
          { name: 'OEE', value: 72, unit: '%' },
          { name: 'Scrap', value: 3.5, unit: '%' },
          { name: 'Forecast accuracy', value: 70, unit: '%' },
          { name: 'OTIF', value: 88, unit: '%' },
          { name: 'Inventory turns', value: 4, unit: 'x/yr' },
        ]),
        stakeholders: JSON.stringify([
          {
            name: 'CFO',
            role: 'Executive Sponsor',
            influence: 'high',
            notes: 'ROI-focused, wants payback <18 months',
          },
          {
            name: 'Head of Operations',
            role: 'Process Owner',
            influence: 'high',
            notes: 'Bottlenecks in approvals and changeovers',
          },
          {
            name: 'IT Manager',
            role: 'Technology Owner',
            influence: 'medium',
            notes: 'Small team; integration debt',
          },
        ]),
        open_gaps: JSON.stringify([
          {
            category: 'finance',
            description: 'True cost-to-serve per product line',
            priority: 'high',
          },
          {
            category: 'digital',
            description: 'Current integrations map (ERP/MES/WMS/Excel)',
            priority: 'medium',
          },
          {
            category: 'people',
            description: 'Training baseline and skill matrix coverage',
            priority: 'medium',
          },
        ]),
        completeness_percent: 55,
        last_interview_id: null,
        updated_at: nowIso(),
      },
      cols,
      { conflictTarget: ['organization_id'] }
    );
  }

  // -------------------------------------------
  // Templates (org-scoped additions)
  // -------------------------------------------
  if (tableOk.interview_library_templates) {
    const tplCols = await getColumns(db, 'interview_library_templates');
    const qCols = tableOk.interview_library_template_questions
      ? await getColumns(db, 'interview_library_template_questions')
      : new Set<string>();

    const templates = [
      {
        id: `seed_itpl_${orgId}_cx_v1`,
        name: 'Customer Experience & Service',
        description: 'Discovery focused on customer journey, support operations and feedback loops',
        category: 'CUSTOM',
      },
      {
        id: `seed_itpl_${orgId}_esg_v1`,
        name: 'Sustainability & ESG Readiness',
        description: 'Carbon reporting, energy baseline, governance and customer requirements',
        category: 'DATA',
      },
      {
        id: `seed_itpl_${orgId}_cyber_v1`,
        name: 'Cybersecurity (OT/IT) Baseline',
        description: 'Identity, access, segmentation, incident response, and compliance for OT/IT',
        category: 'DIGITAL',
      },
      {
        id: `seed_itpl_${orgId}_pricing_v1`,
        name: 'Pricing & Margin Levers',
        description: 'Margin drivers, discounting, product mix and value-based pricing levers',
        category: 'COST',
      },
    ];

    for (const t of templates) {
      await upsertIfPossible(
        db,
        'interview_library_templates',
        {
          id: t.id,
          organization_id: orgId,
          name: t.name,
          description: t.description,
          category: t.category,
          status: 'approved',
          visibility: 'org',
          is_default: 0,
          version: 1,
          created_by: managerUser.id,
          created_at: isoPlusDays(-40),
          updated_at: nowIso(),
        },
        tplCols
      );
    }

    if (tableOk.interview_library_template_questions) {
      const addQ = async (
        id: string,
        templateId: string,
        category: string,
        questionText: string,
        sortOrder: number
      ) =>
        insertIfPossible(
          db,
          'interview_library_template_questions',
          {
            id,
            template_id: templateId,
            category,
            question_text: questionText,
            sort_order: sortOrder,
            answer_type: 'open',
            is_required: sortOrder <= 20 ? 1 : 0,
            help_hint: null,
            created_at: isoPlusDays(-40),
          },
          qCols
        );

      await addQ(
        `seed_itq_${orgId}_cx_1`,
        `seed_itpl_${orgId}_cx_v1`,
        'strategy',
        'Which customer segments matter most and what differentiates your offer for them?',
        10
      );
      await addQ(
        `seed_itq_${orgId}_cx_2`,
        `seed_itpl_${orgId}_cx_v1`,
        'operations',
        'Where do customers experience the biggest delays or friction (order, delivery, claims, support)?',
        20
      );
      await addQ(
        `seed_itq_${orgId}_cx_3`,
        `seed_itpl_${orgId}_cx_v1`,
        'digital',
        'How do you capture and close the loop on customer feedback (tickets, NPS, root causes)?',
        30
      );
      await addQ(
        `seed_itq_${orgId}_esg_1`,
        `seed_itpl_${orgId}_esg_v1`,
        'strategy',
        'Which customer / regulatory ESG requirements are coming in the next 12 months?',
        10
      );
      await addQ(
        `seed_itq_${orgId}_esg_2`,
        `seed_itpl_${orgId}_esg_v1`,
        'operations',
        'Do you measure energy consumption by line/equipment? If not, what blocks sub-metering?',
        20
      );
      await addQ(
        `seed_itq_${orgId}_cyber_1`,
        `seed_itpl_${orgId}_cyber_v1`,
        'digital',
        'How are OT systems segmented from IT, and how is access (vendors/operators) controlled?',
        10
      );
      await addQ(
        `seed_itq_${orgId}_cyber_2`,
        `seed_itpl_${orgId}_cyber_v1`,
        'people',
        'What is your incident response process and how often do you run tabletop exercises?',
        20
      );
      await addQ(
        `seed_itq_${orgId}_pricing_1`,
        `seed_itpl_${orgId}_pricing_v1`,
        'finance',
        'Where do margins leak (discounts, expedite, rework, claims), and how do you measure it?',
        10
      );
      await addQ(
        `seed_itq_${orgId}_pricing_2`,
        `seed_itpl_${orgId}_pricing_v1`,
        'strategy',
        'How do you set prices today (cost-plus, competitor, value-based) and who approves exceptions?',
        20
      );
    }
  }

  // -------------------------------------------
  // Sessions + questions
  // -------------------------------------------
  const sessionCols = tableOk.interview_sessions
    ? await getColumns(db, 'interview_sessions')
    : new Set();
  const questionCols = tableOk.interview_questions
    ? await getColumns(db, 'interview_questions')
    : new Set();

  const makeSession = async (input: {
    id: string;
    name: string;
    templateId: string;
    ownerId: string;
    status: 'active' | 'completed' | 'paused';
    startedAt: string;
    completedAt?: string | null;
    answered: number;
    total: number;
    assignmentId?: string | null;
    projectId?: string | null;
  }) => {
    if (!tableOk.interview_sessions) return;
    const base = {
      id: input.id,
      organization_id: orgId,
      project_id: input.projectId ?? null,
      name: input.name,
      owner_id: input.ownerId,
      status: input.status,
      template_id: input.templateId,
      progress_json: JSON.stringify({
        strategy: input.status === 'completed' ? 100 : 60,
        operations: input.status === 'completed' ? 100 : 40,
        digital: input.status === 'completed' ? 100 : 20,
        people: input.status === 'completed' ? 90 : 0,
        finance: input.status === 'completed' ? 100 : 0,
      }),
      total_questions: input.total,
      answered_questions: input.answered,
      summary_facts: JSON.stringify([
        {
          category: 'operations',
          fact: 'Approval steps create queue time and unpredictable lead times.',
        },
        { category: 'digital', fact: 'Excel is used as an integration layer between systems.' },
      ]),
      summary_gaps: JSON.stringify([
        { category: 'finance', gap: 'No baseline ROI framework for initiatives.' },
      ]),
      summary_constraints: JSON.stringify([
        { category: 'people', constraint: 'Limited IT capacity (small team).' },
      ]),
      summary_pain_points: JSON.stringify([
        { category: 'operations', pain_point: 'Changeovers and approvals are main bottlenecks.' },
      ]),
      started_at: input.startedAt,
      completed_at: input.completedAt ?? null,
      last_activity_at: input.completedAt ?? isoPlusDays(-1),
      created_at: input.startedAt,
      updated_at: nowIso(),
      assignment_id: input.assignmentId ?? null,
    };
    await insertIfPossible(db, 'interview_sessions', base, sessionCols);
  };

  const addQuestions = async (sessionId: string, ownerId: string, seed: number) => {
    if (!tableOk.interview_questions) return;
    const mk = async (
      i: number,
      category: string,
      questionText: string,
      answer?: string,
      tags?: string[]
    ) => {
      const id = `seed_iq_${orgId}_${sessionId}_${i}`;
      const status =
        answer && answer.trim().length > 0
          ? 'answered'
          : i % 5 === 0
            ? 'in_progress'
            : 'not_started';
      const confidence = answer ? (i % 2 === 0 ? 4 : 3) : 0;
      const row: Record<string, any> = {
        id,
        session_id: sessionId,
        organization_id: orgId,
        category,
        question_text: questionText,
        answer_text: answer ?? null,
        status,
        confidence_score: confidence,
        answered_by: answer ? ownerId : null,
        answered_at: answer ? isoPlusDays(-10 + (seed % 4)) : null,
        tags: JSON.stringify(tags || []),
        sort_order: (i + 1) * 10,
        is_template: 1,
        created_at: isoPlusDays(-30),
        updated_at: nowIso(),
      };
      await insertIfPossible(db, 'interview_questions', row, questionCols);
    };

    await mk(
      0,
      'strategy',
      'What is the main business objective for the next 12 months?',
      'Reduce lead time by 20% and improve OTIF to 95%.',
      ['priority']
    );
    await mk(
      1,
      'operations',
      'Where is the biggest bottleneck today?',
      'Approvals between planning and production plus long changeovers on Line 3.',
      ['pain_point']
    );
    await mk(
      2,
      'digital',
      'Which systems support planning and execution?',
      'ERP (SAP), MES (basic), Excel for scheduling adjustments.',
      ['fact']
    );
    await mk(
      3,
      'people',
      'Where do skills/training gaps show up most?',
      'Shift leads rely on tribal knowledge; limited training documentation.',
      ['risk']
    );
    await mk(
      4,
      'finance',
      'What constraints apply to investments?',
      'Payback must be under 18 months; 2026 capex is constrained.',
      ['constraint']
    );
    await mk(5, 'operations', 'How do you measure performance today?', undefined, []);
    await mk(
      6,
      'digital',
      'What integrations are missing?',
      'No API layer; manual exports/imports weekly.',
      ['gap']
    );
    await mk(7, 'strategy', 'Who owns the decision-making for exceptions?', undefined, []);
    await mk(
      8,
      'finance',
      'How do you measure ROI on improvements?',
      'Ad-hoc; no standard benefits register.',
      ['gap']
    );
    await mk(9, 'people', 'How do employees react to process changes?', undefined, []);
  };

  // Accepted sources (Sessions tab) - must be completed + assignment approved/completed created by manager user
  const sAccepted1 = `seed_is_${orgId}_accepted_1`;
  const sAccepted2 = `seed_is_${orgId}_accepted_2`;
  const sInboxActive = `seed_is_${orgId}_inbox_active`;
  const sSubmitted = `seed_is_${orgId}_submitted`;

  await makeSession({
    id: sAccepted1,
    name: 'Discovery — Operations bottlenecks (Plant A)',
    templateId: 'itpl_operational_excellence_v1',
    ownerId: opsLeadId,
    status: 'completed',
    startedAt: isoPlusDays(-25),
    completedAt: isoPlusDays(-21),
    answered: 8,
    total: 10,
    assignmentId: `seed_ia_${orgId}_approved_1`,
    projectId: projectId || null,
  });
  await addQuestions(sAccepted1, opsLeadId, 1);

  await makeSession({
    id: sAccepted2,
    name: 'Discovery — Data & metrics trust (Ops/Finance)',
    templateId: 'itpl_data_metrics_v1',
    ownerId: financeId,
    status: 'completed',
    startedAt: isoPlusDays(-18),
    completedAt: isoPlusDays(-15),
    answered: 7,
    total: 10,
    assignmentId: `seed_ia_${orgId}_completed_1`,
    projectId: projectId || null,
  });
  await addQuestions(sAccepted2, financeId, 2);

  // Inbox: in_progress assignment + active session
  await makeSession({
    id: sInboxActive,
    name: 'Inbox — Quick assessment (my assignment)',
    templateId: 'itpl_quick_assessment_v1',
    ownerId: managerUser.id,
    status: 'active',
    startedAt: isoPlusDays(-3),
    completedAt: null,
    answered: 4,
    total: 10,
    assignmentId: `seed_ia_${orgId}_my_in_progress`,
    projectId: projectId || null,
  });
  await addQuestions(sInboxActive, managerUser.id, 3);

  // Managed: submitted awaiting approval
  await makeSession({
    id: sSubmitted,
    name: 'Submitted — Cost baseline (awaiting approval)',
    templateId: 'itpl_cost_efficiency_v1',
    ownerId: itId,
    status: 'active',
    startedAt: isoPlusDays(-9),
    completedAt: null,
    answered: 6,
    total: 10,
    assignmentId: `seed_ia_${orgId}_submitted_1`,
    projectId: projectId || null,
  });
  await addQuestions(sSubmitted, itId, 4);

  // -------------------------------------------
  // Assignments
  // -------------------------------------------
  if (tableOk.interview_assignments) {
    const aCols = await getColumns(db, 'interview_assignments');

    const baseA = (over: Record<string, any>) => ({
      id: over.id,
      organization_id: orgId,
      project_id: projectId || null,
      assignee_user_id: over.assignee_user_id,
      template_id: over.template_id,
      template_version: 1,
      process_ref: over.process_ref || null,
      status: over.status,
      session_id: over.session_id || null,
      task_id: over.task_id || null,
      due_at: over.due_at || null,
      started_at: over.started_at || null,
      submitted_at: over.submitted_at || null,
      sent_back_at: over.sent_back_at || null,
      sent_back_reason: over.sent_back_reason || null,
      priority: over.priority || 'medium',
      reminder_sent_at: over.reminder_sent_at || null,
      reminder_count: over.reminder_count ?? 0,
      last_reminder_type: over.last_reminder_type || null,
      escalated_at: over.escalated_at || null,
      escalation_count: over.escalation_count ?? 0,
      is_team_assignment: over.is_team_assignment ? 1 : 0,
      notes: over.notes || null,
      escalate_to: over.escalate_to || null,
      created_by: over.created_by,
      created_at: over.created_at || isoPlusDays(-20),
      updated_at: nowIso(),
    });

    const assignments: Record<string, any>[] = [
      // Inbox (my work)
      baseA({
        id: `seed_ia_${orgId}_my_assigned`,
        assignee_user_id: managerUser.id,
        template_id: 'itpl_digital_maturity_discovery_v1',
        status: 'assigned',
        due_at: isoPlusDays(7),
        priority: 'high',
        notes: 'Complete before steering committee. Focus on integrations + reporting.',
        created_by: managerUser.id,
      }),
      baseA({
        id: `seed_ia_${orgId}_my_in_progress`,
        assignee_user_id: managerUser.id,
        template_id: 'itpl_quick_assessment_v1',
        status: 'in_progress',
        session_id: sInboxActive,
        due_at: isoPlusDays(2),
        started_at: isoPlusDays(-3),
        priority: 'medium',
        notes: 'Quick baseline — keep it short, facts only.',
        created_by: managerUser.id,
      }),
      baseA({
        id: `seed_ia_${orgId}_my_sent_back`,
        assignee_user_id: managerUser.id,
        template_id: 'itpl_data_metrics_v1',
        status: 'sent_back',
        due_at: isoPlusDays(5),
        started_at: isoPlusDays(-12),
        sent_back_at: isoPlusDays(-1),
        sent_back_reason:
          'Please add concrete KPI definitions + owners; finance section is too vague.',
        priority: 'high',
        notes: 'Need more specificity, then resubmit.',
        created_by: managerUser.id,
      }),

      // Managed pipeline (created_by = managerUser.id)
      baseA({
        id: `seed_ia_${orgId}_submitted_1`,
        assignee_user_id: itId,
        template_id: 'itpl_cost_efficiency_v1',
        status: 'submitted',
        session_id: sSubmitted,
        due_at: isoPlusDays(1),
        started_at: isoPlusDays(-9),
        submitted_at: isoPlusDays(-1),
        priority: 'medium',
        notes: 'Awaiting review — check finance section.',
        created_by: managerUser.id,
      }),
      baseA({
        id: `seed_ia_${orgId}_approved_1`,
        assignee_user_id: opsLeadId,
        template_id: 'itpl_operational_excellence_v1',
        status: 'approved',
        session_id: sAccepted1,
        due_at: isoPlusDays(-22),
        started_at: isoPlusDays(-25),
        submitted_at: isoPlusDays(-22),
        priority: 'high',
        notes: 'Approved — move to Sessions as accepted source.',
        created_by: managerUser.id,
      }),
      baseA({
        id: `seed_ia_${orgId}_completed_1`,
        assignee_user_id: financeId,
        template_id: 'itpl_data_metrics_v1',
        status: 'completed',
        session_id: sAccepted2,
        due_at: isoPlusDays(-16),
        started_at: isoPlusDays(-18),
        submitted_at: isoPlusDays(-16),
        priority: 'medium',
        notes: 'Legacy completed — still treated as accepted source.',
        created_by: managerUser.id,
      }),
      baseA({
        id: `seed_ia_${orgId}_overdue_urgent`,
        assignee_user_id: itId,
        template_id: 'itpl_standard_work_v1',
        status: 'assigned',
        due_at: isoPlusDays(-4),
        priority: 'urgent',
        notes: 'Overdue — escalation expected if no progress.',
        escalated_at: isoPlusDays(-2),
        escalation_count: 1,
        last_reminder_type: 'reminder_24h',
        reminder_count: 2,
        created_by: managerUser.id,
        escalate_to: managerUser.id,
      }),

      // Team assignment
      baseA({
        id: `seed_ia_${orgId}_team_1`,
        assignee_user_id: opsLeadId,
        template_id: `seed_itpl_${orgId}_esg_v1`,
        status: 'in_progress',
        due_at: isoPlusDays(10),
        started_at: isoPlusDays(-2),
        priority: 'high',
        is_team_assignment: true,
        notes: 'Team assignment: ops + finance. Focus on energy baseline + reporting requirements.',
        created_by: managerUser.id,
      }),
    ];

    for (const a of assignments) await insertIfPossible(db, 'interview_assignments', a, aCols);

    // Team members
    if (tableOk.interview_assignment_members) {
      const mCols = await getColumns(db, 'interview_assignment_members');
      const members = [
        {
          id: `seed_iam_${orgId}_team_1_lead`,
          assignment_id: `seed_ia_${orgId}_team_1`,
          user_id: opsLeadId,
          role: 'lead',
          progress_percent: 35,
          joined_at: isoPlusDays(-2),
          completed_at: null,
          created_at: isoPlusDays(-2),
          updated_at: nowIso(),
        },
        {
          id: `seed_iam_${orgId}_team_1_member_fin`,
          assignment_id: `seed_ia_${orgId}_team_1`,
          user_id: financeId,
          role: 'member',
          progress_percent: 20,
          joined_at: isoPlusDays(-2),
          completed_at: null,
          created_at: isoPlusDays(-2),
          updated_at: nowIso(),
        },
      ];
      for (const m of members) await insertIfPossible(db, 'interview_assignment_members', m, mCols);
    }
  }

  // -------------------------------------------
  // Insights
  // -------------------------------------------
  if (tableOk.interview_insights) {
    const iCols = await getColumns(db, 'interview_insights');
    const mkInsight = async (input: {
      id: string;
      title: string;
      promptType: string;
      sessionIds: string[];
      content: string;
      status: 'completed' | 'failed' | 'generating';
      exportedToAssessment?: boolean;
    }) => {
      const createdAt = isoPlusDays(-7);
      const row: Record<string, any> = {
        id: input.id,
        session_id: input.sessionIds[0] || null,
        organization_id: orgId,
        category: 'general',
        title: input.title,
        prompt_type: input.promptType,
        source_session_ids: JSON.stringify(input.sessionIds),
        filters: JSON.stringify({ seeded: true }),
        content: input.content,
        description: input.content, // legacy field
        status: input.status,
        error_message:
          input.status === 'failed' ? 'Seeded failure example (safe to delete).' : null,
        source_session_count: input.sessionIds.length,
        tokens_used: input.status === 'completed' ? 1200 : 0,
        generation_time_ms: input.status === 'completed' ? 850 : null,
        exported_to_tools: 0,
        exported_to_assessment: input.exportedToAssessment ? 1 : 0,
        custom_prompt: null,
        created_by: managerUser.id,
        created_at: createdAt,
        updated_at: nowIso(),
        insight_type: input.promptType,
        impact_level: 'high',
        confidence: 'high',
        actionable: 1,
      };
      await insertIfPossible(db, 'interview_insights', row, iCols);
    };

    await mkInsight({
      id: `seed_ii_${orgId}_bottleneck`,
      title: 'Approvals are the main bottleneck',
      promptType: 'summary',
      sessionIds: [sAccepted1],
      status: 'completed',
      exportedToAssessment: true,
      content: `## Executive Summary

Across accepted interviews, the dominant throughput limiter is **approval latency** and **changeover variability**.

### What we heard (facts)
- Approvals create queue time between planning and execution.
- Changeovers on Line 3 are long and inconsistent.
- Excel is used as the “integration layer”, delaying visibility.

### Implications
- Decisions arrive too late to prevent overtime and expedite costs.
- Teams optimize locally due to missing shared metrics and owners.

### Quick wins (30–60 days)
1. Introduce a lightweight approval SLA (who/when/escalation).
2. Start SMED pilot on top 3 SKUs.
3. Daily dashboard: OTIF, changeovers, top blockers.`,
    });

    await mkInsight({
      id: `seed_ii_${orgId}_trends`,
      title: 'Cross-session trends: data trust + manual work',
      promptType: 'trends',
      sessionIds: [sAccepted1, sAccepted2],
      status: 'completed',
      content: `## Trends (cross-session)

### Consistent patterns
- **Manual reporting** is still central (Excel + exports/imports).
- **Metric definitions differ** between Ops and Finance (no single owner).

### Divergent views
- Ops sees “speed” as priority; Finance sees “risk + payback”.

### What to do next
- Establish KPI owners + definitions (north-star set).
- Map data lineage for 5 critical KPIs.`,
    });

    await mkInsight({
      id: `seed_ii_${orgId}_risk`,
      title: 'Risk assessment: IT capacity constraint',
      promptType: 'risk_assessment',
      sessionIds: [sAccepted2],
      status: 'completed',
      content: `## Risk assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| IT capacity (small team) | High | High | Augment with contractors, reduce WIP, phase integrations |
| Data quality disputes | Medium | High | Definitions + owners, reconciliation workflow |
| Change fatigue | Medium | Medium | Quick wins + comms cadence, champions network |`,
    });

    await mkInsight({
      id: `seed_ii_${orgId}_failed_example`,
      title: 'Example: failed insight (for UI states)',
      promptType: 'recommendations',
      sessionIds: [sAccepted1],
      status: 'failed',
      content: `This insight is intentionally marked as failed to demonstrate UI states.`,
    });
  }

  // Summary
  // eslint-disable-next-line no-console
  console.log('✅ Interview demo seed complete');
  // eslint-disable-next-line no-console
  console.log('- orgId:', orgId);
  // eslint-disable-next-line no-console
  console.log('- managerUser:', managerUser.email, managerUser.role);
  // eslint-disable-next-line no-console
  console.log('- projectId:', projectId || '(none)');
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('❌ seed-interview-demo failed:', e?.message || e);
  process.exit(1);
});
