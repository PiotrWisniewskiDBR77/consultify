#!/usr/bin/env node
/* eslint-disable no-console, @typescript-eslint/no-explicit-any */
/**
 * Seed/restore demo data for DBR77 (SQLite).
 *
 * Goal (what the UI needs to "see"):
 * - My Work: tasks, decisions, notifications for the current user
 * - Interview: templates + at least 1 completed session with questions/notes/evidence
 * - DRD: 3 "full" DRD assessments (APPROVED, 100% coverage)
 * - Reports: 3 Report Builder reports (APPROVED) for those DRD assessments
 * - Team: ensure a "DBR77" team exists and the user is a member
 *
 * Usage:
 *   cd server && DB_TYPE=sqlite SQLITE_PATH=../data/dev/consultinity.db npx tsx scripts/seed-dbr77-restore-demo.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

import { createDatabase } from '../src/database/Database.js';
import * as ReportBuilderService from '../src/services/reportBuilderService.js';
import { DRD_STRUCTURE } from '../../src/services/drdStructure';

type Db = any;

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function requireSafeSqlitePath() {
  const dbType = process.env.DB_TYPE || 'sqlite';
  const sqlitePath = process.env.SQLITE_PATH;

  if (dbType !== 'sqlite') {
    throw new Error(`This seeder targets SQLite. Current DB_TYPE=${dbType}`);
  }
  if (!sqlitePath) {
    throw new Error('SQLITE_PATH is required. Example: SQLITE_PATH=../data/dev/consultinity.db');
  }

  const resolved = path.resolve(process.cwd(), sqlitePath);
  const looksLikeDev = resolved.includes(`${path.sep}data${path.sep}dev${path.sep}consultinity.db`);
  if (!looksLikeDev && process.env.FORCE_SEED !== 'true') {
    throw new Error(
      `Refusing to seed non-dev DB: ${resolved}\n` +
        `Set FORCE_SEED=true only if you really want to seed this file.`
    );
  }

  // Convenience: create the file if missing (SQLite will then initialize it).
  // Safe because we only auto-create the standard dev DB path unless FORCE_SEED=true.
  if (!fs.existsSync(resolved)) {
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, '');
  }

  return resolved;
}

function nowIso() {
  return new Date().toISOString();
}

const seedUserPassword = String(process.env.SEED_USER_PASSWORD || '').trim();
if (!seedUserPassword) {
  throw new Error('[ODMOWA] Brak zmiennej SEED_USER_PASSWORD. Ustaw ją przed uruchomieniem seeda.');
}
const DBR77_PASSWORD_HASH = bcrypt.hashSync(seedUserPassword, 10);

async function run(db: Db, sql: string, params: any[] = []) {
  return new Promise<{ lastID?: number; changes?: number }>((resolve, reject) => {
    db.run(sql, params, function (err: Error | null) {
      if (err) reject(err);
      else resolve({ lastID: (this as any)?.lastID, changes: (this as any)?.changes });
    });
  });
}

async function getOne<T = any>(db: Db, sql: string, params: any[] = []): Promise<T | null> {
  return new Promise<T | null>((resolve, reject) => {
    db.get(sql, params, (err: Error | null, row: T) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

async function all<T = any>(db: Db, sql: string, params: any[] = []): Promise<T[]> {
  return new Promise<T[]>((resolve, reject) => {
    db.all(sql, params, (err: Error | null, rows: T[]) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

async function exec(db: Db, sql: string) {
  return new Promise<void>((resolve, reject) => {
    db.exec(sql, (err: Error | null) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function getTableColumns(db: Db, table: string): Promise<Set<string>> {
  const rows = await all<any>(db, `PRAGMA table_info(${table})`);
  return new Set(rows.map((r) => String(r.name)));
}

async function ensureColumn(db: Db, table: string, column: string, columnSql: string) {
  const cols = await getTableColumns(db, table).catch(() => new Set<string>());
  if (cols.has(column)) return;
  try {
    await run(db, `ALTER TABLE ${table} ADD COLUMN ${column} ${columnSql}`);
  } catch (e: any) {
    // Ignore "duplicate column name" / older sqlite quirks
    const msg = String(e?.message || '');
    if (!msg.toLowerCase().includes('duplicate column')) throw e;
  }
}

async function execMigrationIfExists(db: Db, relPathFromServer: string) {
  const filePath = path.resolve(__dirname, '..', relPathFromServer);
  if (!fs.existsSync(filePath)) {
    log.warn(`Migration file not found (skipping): ${filePath}`);
    return;
  }
  const sql = await fs.promises.readFile(filePath, 'utf8');
  await exec(db, sql);
}

async function ensureDbr77Credentials(db: Db) {
  const orgId = 'org-dbr77-system';

  // Ensure org exists (best-effort; depends on schema)
  await run(
    db,
    `INSERT OR IGNORE INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
    [orgId, 'DBR77', 'full', 'active']
  ).catch(() => undefined);
  await run(db, `UPDATE organizations SET name='DBR77', plan='full', status='active' WHERE id=?`, [
    orgId,
  ]).catch(() => undefined);

  // Ensure SUPERADMIN + ADMIN demo accounts exist with known password hash.
  await run(
    db,
    `INSERT OR IGNORE INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'user-admin-dbr77',
      orgId,
      'admin@dbr77.com',
      DBR77_PASSWORD_HASH,
      'SUPERADMIN',
      'active',
      'Admin',
      'DBR77',
    ]
  ).catch(() => undefined);
  await run(
    db,
    `UPDATE users SET password=?, role='SUPERADMIN', organization_id=?, status='active' WHERE email=?`,
    [DBR77_PASSWORD_HASH, orgId, 'admin@dbr77.com']
  ).catch(() => undefined);

  await run(
    db,
    `INSERT OR IGNORE INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'user-piotr-dbr77',
      orgId,
      'piotr.wisniewski@dbr77.com',
      DBR77_PASSWORD_HASH,
      'ADMIN',
      'active',
      'Piotr',
      'Wiśniewski',
    ]
  ).catch(() => undefined);
  await run(
    db,
    `UPDATE users SET password=?, role='ADMIN', organization_id=?, status='active' WHERE email=?`,
    [DBR77_PASSWORD_HASH, orgId, 'piotr.wisniewski@dbr77.com']
  ).catch(() => undefined);
}

async function ensureAnchors(db: Db): Promise<{
  orgId: string;
  orgName: string;
  userId: string;
  userEmail: string;
  projectId: string;
}> {
  // Prefer DBR77 org id if present, otherwise fall back to user's org.
  const orgPreferredId = 'org-dbr77-system';
  const orgName = 'DBR77';

  // Ensure DBR77 org + demo accounts exist and have a working password hash.
  await ensureDbr77Credentials(db);

  // Choose user anchor:
  // 1) piotr.wisniewski@dbr77.com
  // 2) admin@dbr77.com
  // 3) any existing user
  let user =
    (await getOne<any>(db, `SELECT id, email, organization_id FROM users WHERE email = ? LIMIT 1`, [
      'piotr.wisniewski@dbr77.com',
    ])) ||
    (await getOne<any>(db, `SELECT id, email, organization_id FROM users WHERE email = ? LIMIT 1`, [
      'admin@dbr77.com',
    ])) ||
    (await getOne<any>(db, `SELECT id, email, organization_id FROM users LIMIT 1`, []));

  if (!user) {
    // Create a minimal user if DB is empty. Password may be fixed via fix-dbr77-credentials.sh.
    const newUserId = 'user-admin-dbr77';
    const email = 'admin@dbr77.com';
    try {
      await run(
        db,
        `INSERT OR IGNORE INTO users (id, organization_id, email, role, status, first_name, last_name)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newUserId, orgPreferredId, email, 'SUPERADMIN', 'active', 'Admin', 'DBR77']
      );
    } catch {
      // As a last resort try a slimmer insert
      await run(db, `INSERT OR IGNORE INTO users (id, email) VALUES (?, ?)`, [newUserId, email]);
    }
    user = { id: newUserId, email, organization_id: orgPreferredId };
  }

  // Ensure user is in orgPreferredId if schema supports it (best-effort).
  try {
    await run(db, `UPDATE users SET organization_id = ? WHERE id = ?`, [orgPreferredId, user.id]);
  } catch {
    // ignore
  }

  const orgId = orgPreferredId;
  const userId = String(user.id);
  const userEmail = String(user.email || '');

  // Ensure at least one project exists in this org (needed by Interview)
  let project = await getOne<any>(
    db,
    `SELECT id FROM projects WHERE organization_id = ? ORDER BY created_at DESC LIMIT 1`,
    [orgId]
  );
  if (!project) {
    const projectId = 'project-dbr77-demo';
    try {
      await run(
        db,
        `INSERT OR IGNORE INTO projects (id, organization_id, name, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, datetime('now', '-30 days'), datetime('now'))`,
        [projectId, orgId, 'DBR77 Demo Project', 'active']
      );
    } catch {
      await run(
        db,
        `INSERT OR IGNORE INTO projects (id, name, organization_id, status, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [projectId, 'DBR77 Demo Project', orgId, 'active']
      );
    }
    project = { id: projectId };
  }

  return { orgId, orgName, userId, userEmail, projectId: String(project.id) };
}

async function ensureTeamDBR77(db: Db, orgId: string, userId: string) {
  const teamId = 'team-dbr77';
  try {
    await run(
      db,
      `INSERT OR IGNORE INTO teams (id, organization_id, name, description, lead_id, created_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [teamId, orgId, 'DBR77', 'Zespół DBR77 (demo)', userId]
    );
    await run(db, `UPDATE teams SET organization_id = ?, name = ?, lead_id = ? WHERE id = ?`, [
      orgId,
      'DBR77',
      userId,
      teamId,
    ]);
    await run(
      db,
      `INSERT OR IGNORE INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      [teamId, userId, 'lead']
    );
    log.step('Ensured team DBR77 + membership');
  } catch (e) {
    log.warn(`Team seed skipped (schema mismatch): ${String((e as any)?.message || e)}`);
  }
}

async function seedMyWork(db: Db, orgId: string, userId: string, projectId: string) {
  // Tasks
  const tasks = [
    {
      title: 'Przegląd backlogu DRD (Q1)',
      description: 'Sprawdź kompletność danych i przygotuj wnioski do raportu.',
      status: 'in_progress',
      priority: 'high',
      dueDate: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    },
    {
      title: 'Zaplanuj warsztat Interview (stakeholderzy)',
      description: 'Ustal listę osób i termin, uruchom szablon Digital Maturity Discovery.',
      status: 'todo',
      priority: 'urgent',
      dueDate: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    },
    {
      title: 'Weryfikacja zespołu DBR77 w systemie',
      description: 'Sprawdź role, członków i przypisania.',
      status: 'todo',
      priority: 'medium',
      dueDate: null,
    },
  ];

  for (const t of tasks) {
    try {
      await run(
        db,
        `INSERT OR IGNORE INTO tasks
         (id, title, description, status, priority, due_date, assignee_id, organization_id, project_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          uuidv4(),
          t.title,
          t.description,
          t.status,
          t.priority,
          t.dueDate,
          userId,
          orgId,
          projectId,
        ]
      );
    } catch {
      // older schema fallback
      await run(
        db,
        `INSERT OR IGNORE INTO tasks
         (id, title, description, status, priority, due_date, assignee_id, organization_id, project_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          uuidv4(),
          t.title,
          t.description,
          t.status,
          t.priority,
          t.dueDate,
          userId,
          orgId,
          projectId,
        ]
      ).catch(() => undefined);
    }
  }

  // Decisions
  const decisions = [
    {
      id: 'dbr77-decision-approve-drd-reports',
      title: 'Zatwierdzić generację raportów DRD?',
      description: 'Raporty mają trafić do przeglądu/akceptacji (demo).',
      type: 'APPROVAL',
      status: 'pending',
      priority: 'HIGH',
      deadline: new Date(Date.now() + 1 * 24 * 3600 * 1000).toISOString(),
    },
    {
      id: 'dbr77-decision-interview-template',
      title: 'Wybrać szablon Interview do discovery',
      description: 'Digital Maturity Discovery vs Operational Excellence.',
      type: 'OTHER',
      status: 'pending',
      priority: 'MEDIUM',
      deadline: new Date(Date.now() + 4 * 24 * 3600 * 1000).toISOString(),
    },
  ];

  for (const d of decisions) {
    await run(
      db,
      `INSERT OR IGNORE INTO decisions
       (id, organization_id, project_id, title, description, type, decision_maker_id, status, priority, deadline, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-2 days'), datetime('now', '-2 days'))`,
      [
        d.id,
        orgId,
        projectId,
        d.title,
        d.description,
        d.type,
        userId,
        d.status,
        d.priority,
        d.deadline,
        userId,
      ]
    ).catch(() => undefined);
  }

  // Notifications (UI driver)
  const notifications = [
    {
      type: 'AI_RECOMMENDATION',
      title: 'AI: Wykryto luki w osi 6 (Cyber)',
      message:
        'W raporcie DRD pojawiły się brakujące dowody dla kontroli OT/IT. Sprawdź sekcję axis_6.',
    },
    {
      type: 'DECISION_REQUIRED',
      title: 'Decyzja: zatwierdź raporty DRD',
      message: 'Raporty DRD są gotowe do przeglądu. Zatwierdź lub odeślij do edycji.',
    },
  ];
  for (const n of notifications) {
    await run(
      db,
      `INSERT OR IGNORE INTO notifications (id, user_id, organization_id, type, title, message, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now', '-1 hours'))`,
      [uuidv4(), userId, orgId, n.type, n.title, n.message]
    ).catch(() => undefined);
  }

  log.step('Seeded MyWork tasks/decisions/notifications');
}

function buildFullDrdAnswers(): Record<string, any> {
  // Build "full" DRD answers using the current DRD structure used by the UI.
  const areas: Record<string, any> = {};
  for (const axis of DRD_STRUCTURE as any[]) {
    const axisLevelCount = Number(axis?.levelCount || 5);
    for (const area of (axis?.areas || []) as any[]) {
      const id = String(area?.id);
      if (!id) continue;
      const achieved = faker.number.int({ min: 2, max: Math.max(2, axisLevelCount - 1) });
      const target = Math.min(axisLevelCount, achieved + faker.number.int({ min: 1, max: 2 }));
      areas[id] = {
        achievedLevel: achieved,
        targetLevel: target,
        levelNotes: {
          [String(Math.max(1, achieved))]: faker.lorem.sentence(),
        },
      };
    }
  }

  return { drd: { areas } };
}

async function ensureAssessmentSchema(db: Db) {
  // Workflow v2 table expected by Report Builder & Assessment Hub.
  await exec(
    db,
    `CREATE TABLE IF NOT EXISTS assessments (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      status TEXT DEFAULT 'DRAFT',
      project_id TEXT,
      assessment_type TEXT NOT NULL,
      name TEXT NOT NULL,
      completion_percent INTEGER DEFAULT 0,
      confidence_avg REAL DEFAULT 0,
      answers_json TEXT DEFAULT '{}',
      context_snapshot TEXT DEFAULT '{}',
      score_summary TEXT DEFAULT '{}',
      navigation_json TEXT DEFAULT '{}',
      review_requested_at TEXT,
      report_approved_at TEXT,
      approved_at TEXT,
      created_by TEXT NOT NULL,
      updated_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );`
  );
}

async function seed3FullDrdAssessments(db: Db, orgId: string, userId: string) {
  await ensureAssessmentSchema(db);

  const seeds = [
    { id: 'drd-full-01', name: 'DRD — Full Assessment (Enterprise) #1' },
    { id: 'drd-full-02', name: 'DRD — Full Assessment (Manufacturing) #2' },
    { id: 'drd-full-03', name: 'DRD — Full Assessment (Supply Chain) #3' },
  ];

  for (let i = 0; i < seeds.length; i += 1) {
    const a = seeds[i];
    const approvedAt = new Date(Date.now() - i * 24 * 3600 * 1000).toISOString();
    const answers = buildFullDrdAnswers();
    const overall = Number(faker.number.float({ min: 2.2, max: 4.2, fractionDigits: 1 }));

    await run(
      db,
      `INSERT INTO assessments (
          id, organization_id, project_id, assessment_type, name, status,
          completion_percent, confidence_avg,
          answers_json, context_snapshot, score_summary, navigation_json,
          approved_at, created_by, updated_by, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, 'APPROVED', 100, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         organization_id = excluded.organization_id,
         project_id = excluded.project_id,
         assessment_type = excluded.assessment_type,
         name = excluded.name,
         status = excluded.status,
         completion_percent = excluded.completion_percent,
         confidence_avg = excluded.confidence_avg,
         answers_json = excluded.answers_json,
         context_snapshot = excluded.context_snapshot,
         score_summary = excluded.score_summary,
         navigation_json = excluded.navigation_json,
         approved_at = excluded.approved_at,
         updated_by = excluded.updated_by,
         updated_at = excluded.updated_at`,
      [
        a.id,
        orgId,
        null,
        'DRD',
        a.name,
        Number(faker.number.float({ min: 3.0, max: 4.2, fractionDigits: 1 })),
        JSON.stringify(answers),
        JSON.stringify({
          scope: { plants: faker.number.int({ min: 1, max: 3 }) },
          seeded: true,
        }),
        JSON.stringify({
          overall: { actual: overall, target: 5.0, gap: 5.0 - overall },
          seeded: true,
        }),
        JSON.stringify({ axisId: 1, areaId: '1A', level: 1 }),
        approvedAt,
        userId,
        userId,
        approvedAt,
        approvedAt,
      ]
    );

    log.step(`Upserted assessment: ${a.name} (APPROVED)`);
  }

  return seeds.map((s) => s.id);
}

async function ensureReportBuilderSchema(db: Db) {
  // Ensure report builder tables + default templates exist.
  await execMigrationIfExists(db, path.join('migrations', '503_report_builder.sql'));
}

async function upsertById(db: Db, table: string, record: Record<string, any>) {
  const cols = Object.keys(record);
  if (cols.length === 0) return;
  const placeholders = cols.map(() => '?').join(', ');
  const updates = cols
    .filter((c) => c !== 'id')
    .map((c) => `${c}=excluded.${c}`)
    .join(', ');

  const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})
               ON CONFLICT(id) DO UPDATE SET ${updates}`;
  await run(
    db,
    sql,
    cols.map((c) => record[c])
  );
}

async function seedReportBuilderReportDirect(params: {
  db: Db;
  orgId: string;
  userId: string;
  assessmentId: string;
}) {
  const { db, orgId, userId, assessmentId } = params;
  const reportCols = await getTableColumns(db, 'report_builder_reports');
  const sectionCols = await getTableColumns(db, 'report_builder_sections');

  const assessment = await getOne<any>(
    db,
    `SELECT id, name, assessment_type FROM assessments WHERE id = ? LIMIT 1`,
    [assessmentId]
  );
  const assessmentName = String(assessment?.name || assessmentId);
  const framework = String(assessment?.assessment_type || 'DRD');

  // Pick template if available
  const templateRow = await getOne<any>(
    db,
    `SELECT id, sections_json FROM report_builder_templates WHERE id = 'tpl-assessment-drd-standard' LIMIT 1`,
    []
  );
  const templateId = templateRow?.id ? String(templateRow.id) : null;
  const templateSections: any[] = (() => {
    try {
      return templateRow?.sections_json ? JSON.parse(String(templateRow.sections_json)) : [];
    } catch {
      return [];
    }
  })();

  const now = nowIso();
  const reportId = `rb-${assessmentId}`;

  const reportRecord: Record<string, any> = {
    id: reportId,
    organization_id: orgId,
    project_id: null,
    source_type: 'ASSESSMENT',
    source_id: assessmentId,
    source_name: assessmentName,
    source_framework: framework,
    title: `DRD Report — ${assessmentName}`,
    description: 'Seeded demo report (offline, no LLM).',
    report_type: `ASSESSMENT_${framework}`,
    config_json: JSON.stringify({ seeded: true }),
    company_context_json: JSON.stringify({ organizationName: 'DBR77', assessmentType: framework }),
    status: 'APPROVED',
    created_by: userId,
    created_at: now,
    updated_at: now,
    updated_by: userId,
    version: 1,
    generation_metadata: JSON.stringify({ seeded: true, generatedSections: ['executive_summary'] }),
  };

  if (templateId && reportCols.has('template_id')) reportRecord.template_id = templateId;
  if (reportCols.has('submitted_at')) reportRecord.submitted_at = now;
  if (reportCols.has('approved_at')) reportRecord.approved_at = now;
  if (reportCols.has('approved_by')) reportRecord.approved_by = userId;

  // Remove any record fields that aren't present (schema may vary across dev DBs)
  for (const key of Object.keys(reportRecord)) {
    if (!reportCols.has(key)) delete reportRecord[key];
  }

  await upsertById(db, 'report_builder_reports', reportRecord);

  // Recreate sections for determinism
  await run(db, `DELETE FROM report_builder_sections WHERE report_id = ?`, [reportId]).catch(
    () => undefined
  );

  const sectionsToInsert =
    templateSections.length > 0
      ? templateSections
      : [
          { key: 'cover', type: 'cover', title: 'Cover Page', required: true, order: 0 },
          {
            key: 'executive_summary',
            type: 'summary',
            title: 'Executive Summary',
            required: true,
            order: 1,
          },
          {
            key: 'recommendations',
            type: 'recommendations',
            title: 'Recommendations',
            required: true,
            order: 2,
          },
        ];

  for (const s of sectionsToInsert) {
    const sectionId = `rbs-${reportId}-${String(s.key)}`.slice(0, 80);
    const content = [
      `## ${String(s.title || s.key)}`,
      ``,
      `Assessment: **${assessmentName}**`,
      `Framework: **${framework}**`,
      `Seeded at: ${now}`,
      ``,
      `This is seeded demo content (placeholder) to make the report visible and openable in the UI.`,
    ].join('\n');

    const sectionRecord: Record<string, any> = {
      id: sectionId,
      report_id: reportId,
      section_key: String(s.key),
      section_type: String(s.type || 'custom'),
      title: String(s.title || s.key),
      order_index: Number(s.order ?? 0),
      enabled: 1,
      required: s.required ? 1 : 0,
      length: String(s.defaultLength || 'medium'),
      language: String(s.defaultLanguage || 'business'),
      content_format: 'markdown',
      generated_content: content,
      generated_at: now,
      tokens_used: 0,
      created_at: now,
      updated_at: now,
    };

    for (const key of Object.keys(sectionRecord)) {
      if (!sectionCols.has(key)) delete sectionRecord[key];
    }

    await upsertById(db, 'report_builder_sections', sectionRecord);
  }

  // Ensure a session exists (optional)
  if ((await getTableColumns(db, 'report_builder_sessions').catch(() => new Set<string>())).size) {
    await run(
      db,
      `INSERT OR IGNORE INTO report_builder_sessions (id, report_id, user_id, organization_id, opened_at, last_activity_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [`rbsess-${reportId}`, reportId, userId, orgId]
    ).catch(() => undefined);
  }
}

async function seedReportBuilderReportsForAssessments(params: {
  db: Db;
  orgId: string;
  userId: string;
  assessmentIds: string[];
}) {
  const { db, orgId, userId, assessmentIds } = params;
  await ensureReportBuilderSchema(db);

  for (const assessmentId of assessmentIds) {
    try {
      await seedReportBuilderReportDirect({ db, orgId, userId, assessmentId });
      log.step(`Created Report Builder report (APPROVED): rb-${assessmentId} for ${assessmentId}`);
    } catch (e: any) {
      log.warn(
        `Report Builder seed skipped for assessment ${assessmentId}: ${String(e?.message || e)}`
      );
    }
  }
}

async function ensureInterviewSchema(db: Db) {
  // Create table if missing (new, code-expected schema).
  await exec(
    db,
    `CREATE TABLE IF NOT EXISTS interview_sessions (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      project_id TEXT,
      user_id TEXT,
      topic TEXT,
      name TEXT,
      owner_id TEXT,
      status TEXT DEFAULT 'active',
      progress_json TEXT DEFAULT '{}',
      total_questions INTEGER DEFAULT 0,
      answered_questions INTEGER DEFAULT 0,
      summary_facts TEXT DEFAULT '[]',
      summary_gaps TEXT DEFAULT '[]',
      summary_constraints TEXT DEFAULT '[]',
      summary_pain_points TEXT DEFAULT '[]',
      template_id TEXT,
      template_version INTEGER DEFAULT 1,
      assignment_id TEXT,
      started_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT,
      last_activity_at TEXT DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`
  );

  // Add any missing columns to legacy tables (safe best-effort).
  await ensureColumn(db, 'interview_sessions', 'organization_id', 'TEXT');
  await ensureColumn(db, 'interview_sessions', 'name', `TEXT DEFAULT 'Discovery Interview'`);
  await ensureColumn(db, 'interview_sessions', 'owner_id', 'TEXT');
  await ensureColumn(db, 'interview_sessions', 'progress_json', `TEXT DEFAULT '{}'`);
  await ensureColumn(db, 'interview_sessions', 'total_questions', 'INTEGER DEFAULT 0');
  await ensureColumn(db, 'interview_sessions', 'answered_questions', 'INTEGER DEFAULT 0');
  await ensureColumn(db, 'interview_sessions', 'summary_facts', `TEXT DEFAULT '[]'`);
  await ensureColumn(db, 'interview_sessions', 'summary_gaps', `TEXT DEFAULT '[]'`);
  await ensureColumn(db, 'interview_sessions', 'summary_constraints', `TEXT DEFAULT '[]'`);
  await ensureColumn(db, 'interview_sessions', 'summary_pain_points', `TEXT DEFAULT '[]'`);
  await ensureColumn(db, 'interview_sessions', 'template_id', 'TEXT');
  await ensureColumn(db, 'interview_sessions', 'template_version', 'INTEGER DEFAULT 1');
  await ensureColumn(db, 'interview_sessions', 'assignment_id', 'TEXT');
  await ensureColumn(db, 'interview_sessions', 'last_activity_at', 'TEXT');
  await ensureColumn(db, 'interview_sessions', 'created_at', 'TEXT');
  await ensureColumn(db, 'interview_sessions', 'updated_at', 'TEXT');

  // Question/notes/evidence tables should exist in most schemas; create if needed.
  await exec(
    db,
    `CREATE TABLE IF NOT EXISTS interview_questions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      organization_id TEXT,
      category TEXT NOT NULL,
      question_text TEXT NOT NULL,
      answer_text TEXT,
      status TEXT DEFAULT 'not_started',
      confidence_score INTEGER DEFAULT 0,
      answered_by TEXT,
      answered_at TEXT,
      tags TEXT DEFAULT '[]',
      sort_order INTEGER DEFAULT 0,
      is_template INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`
  );
  await exec(
    db,
    `CREATE TABLE IF NOT EXISTS interview_notes (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      organization_id TEXT,
      category TEXT,
      title TEXT,
      content TEXT NOT NULL,
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`
  );
  await exec(
    db,
    `CREATE TABLE IF NOT EXISTS interview_evidence (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      organization_id TEXT,
      question_id TEXT,
      evidence_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      file_path TEXT,
      file_name TEXT,
      file_size INTEGER,
      file_type TEXT,
      url TEXT,
      uploaded_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`
  );
}

async function seedInterview(db: Db, orgId: string, userId: string, projectId: string) {
  await ensureInterviewSchema(db);

  // Ensure templates library exists + seeded (used by Interview UI).
  await execMigrationIfExists(db, path.join('migrations', '297_interview_library_templates.sql'));

  // Create a completed session with snapshot questions.
  const sessionId = 'intv-dbr77-session-1';
  const startedAt = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const completedAt = new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString();
  const progress = { strategy: 100, operations: 100, digital: 100, people: 80, finance: 60 };
  const summaryFacts = [
    {
      category: 'digital',
      fact: 'ERP jest wdrożony, ale integracja MES jest niespójna między liniami.',
    },
    {
      category: 'operations',
      fact: 'Największe straty: oczekiwanie i przezbrojenia; brak spójnych KPI OEE.',
    },
    {
      category: 'people',
      fact: 'Brakuje formalnego programu rozwoju kompetencji cyfrowych na shopfloor.',
    },
  ];

  await run(
    db,
    `INSERT OR IGNORE INTO interview_sessions
     (id, organization_id, project_id, user_id, topic, name, owner_id, status, progress_json,
      total_questions, answered_questions, summary_facts, started_at, completed_at, last_activity_at, created_at, updated_at, template_id, template_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sessionId,
      orgId,
      projectId,
      userId,
      'Discovery Interview',
      'Discovery Interview — DBR77 (Seeded)',
      userId,
      'completed',
      JSON.stringify(progress),
      20,
      17,
      JSON.stringify(summaryFacts),
      startedAt,
      completedAt,
      completedAt,
      startedAt,
      completedAt,
      'itpl_digital_maturity_discovery_v1',
      1,
    ]
  );

  const questions = [
    {
      category: 'strategy',
      q: 'Jakie są 3 priorytety transformacji cyfrowej na 12 miesięcy?',
      a: 'Widoczność produkcji, stabilność jakości danych, lepsze planowanie.',
    },
    {
      category: 'operations',
      q: 'Gdzie są największe bottlenecki w procesie plan-to-produce?',
      a: 'Przezbrojenia, braki materiałowe, approvals jakości.',
    },
    {
      category: 'digital',
      q: 'Jak zbierane są dane z maszyn (manual, IoT, integracja)?',
      a: 'Mieszane: część IoT, część ręcznie; brak standardu tagów.',
    },
    {
      category: 'people',
      q: 'Jak reagują pracownicy na nowe narzędzia?',
      a: 'Akceptacja rośnie, ale potrzebne szkolenia i championi.',
    },
    {
      category: 'finance',
      q: 'Jaki jest akceptowalny payback period?',
      a: '12–18 miesięcy dla inicjatyw top-tier.',
    },
  ];

  let sort = 10;
  for (const q of questions) {
    const qid = uuidv4();
    await run(
      db,
      `INSERT OR IGNORE INTO interview_questions
       (id, session_id, organization_id, category, question_text, answer_text, status, confidence_score, answered_by, answered_at, tags, sort_order, is_template, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'answered', ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        qid,
        sessionId,
        orgId,
        q.category,
        q.q,
        q.a,
        faker.number.int({ min: 3, max: 5 }),
        userId,
        completedAt,
        JSON.stringify(['seeded']),
        sort,
        startedAt,
        completedAt,
      ]
    );
    sort += 10;
  }

  await run(
    db,
    `INSERT OR IGNORE INTO interview_notes
     (id, session_id, organization_id, category, title, content, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      sessionId,
      orgId,
      'operations',
      'Najważniejsze obserwacje',
      'Brak standaryzacji danych na shopfloor. Priorytet: stabilny pipeline danych + governance.',
      userId,
      startedAt,
      completedAt,
    ]
  );

  await run(
    db,
    `INSERT OR IGNORE INTO interview_evidence
     (id, session_id, organization_id, evidence_type, title, description, url, uploaded_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      sessionId,
      orgId,
      'link',
      'KPI Dashboard (demo)',
      'Link do dashboardu KPI (seeded).',
      'https://intranet.example.com/kpi',
      userId,
      completedAt,
    ]
  );

  // Organization context panel (optional)
  await exec(
    db,
    `CREATE TABLE IF NOT EXISTS organization_context (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL UNIQUE,
      company_name TEXT,
      industry TEXT,
      company_size TEXT,
      location TEXT,
      employee_count INTEGER,
      annual_revenue TEXT,
      key_metrics TEXT DEFAULT '[]',
      stakeholders TEXT DEFAULT '[]',
      open_gaps TEXT DEFAULT '[]',
      completeness_percent INTEGER DEFAULT 0,
      last_interview_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`
  );

  await run(
    db,
    `INSERT OR IGNORE INTO organization_context
     (id, organization_id, company_name, industry, company_size, location, employee_count, key_metrics, stakeholders, open_gaps, completeness_percent, last_interview_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `orgctx-${orgId}`,
      orgId,
      'DBR77 (Demo Client)',
      'Manufacturing',
      'Mid-Market',
      'PL',
      420,
      JSON.stringify([{ name: 'OEE', value: '63', unit: '%' }]),
      JSON.stringify([
        {
          name: 'COO',
          role: 'Sponsor',
          influence: 'high',
          notes: 'Priorytet: stabilność produkcji',
        },
      ]),
      JSON.stringify([
        {
          category: 'cyber',
          description: 'Brak formalnych KPI skuteczności kontroli OT/IT',
          priority: 'high',
        },
      ]),
      70,
      sessionId,
      startedAt,
      completedAt,
    ]
  );

  log.step('Seeded Interview templates + completed session');
}

async function main() {
  console.log('\n🧩 DBR77: Restore Demo Data (SQLite)\n');
  const resolvedDb = requireSafeSqlitePath();
  log.info(`Target DB: ${resolvedDb}`);

  const db = await createDatabase();
  await run(db, 'PRAGMA foreign_keys = ON').catch(() => undefined);

  // Ensure core schema exists for a fresh SQLite file
  await execMigrationIfExists(db, path.join('migrations', '000_z_core_baseline.sql'));

  // Ensure DBR77 demo credentials always work
  await ensureDbr77Credentials(db);

  const anchors = await ensureAnchors(db);
  log.info(
    `Anchors: org=${anchors.orgId}, user=${anchors.userId} (${anchors.userEmail}), project=${anchors.projectId}`
  );

  await ensureTeamDBR77(db, anchors.orgId, anchors.userId);
  await seedMyWork(db, anchors.orgId, anchors.userId, anchors.projectId);

  const assessmentIds = await seed3FullDrdAssessments(db, anchors.orgId, anchors.userId);
  await seedReportBuilderReportsForAssessments({
    db,
    orgId: anchors.orgId,
    userId: anchors.userId,
    assessmentIds,
  });

  await seedInterview(db, anchors.orgId, anchors.userId, anchors.projectId);

  log.success('DBR77 demo restore complete.');
  console.log('\nNext steps:');
  console.log(`  • Start backend with SQLITE_PATH=${path.relative(process.cwd(), resolvedDb)}`);
  console.log('  • Open app and check: My Work, Interview, Assessment (DRD), Reports');
}

main().catch((err) => {
  log.error(String(err?.message || err));
  process.exit(1);
});
