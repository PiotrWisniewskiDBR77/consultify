#!/usr/bin/env tsx
import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../src/database/Database.js';
import * as DbPromise from '../src/utils/DbPromise.js';

const DEMO_ORG_ID = process.env.DEMO_ORG_ID || 'demo-org';
const DEMO_ORG_NAME = 'Atelier ToolToys';
const DEMO_USER_ID = 'demo-user-atelier';
const DEMO_PROJECT_ID = 'demo-project-atelier-main';
const SUPPORTED_LOCALES = ['pl', 'en', 'de', 'es', 'ja', 'ar'] as const;

function nowIso(): string {
  return new Date().toISOString();
}

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  try {
    const sqliteRows = await DbPromise.all<{ name?: string }>(
      `PRAGMA table_info(${tableName})`,
      [],
      { fallback: true }
    );
    if (sqliteRows.some((r) => r.name === columnName)) return true;
  } catch {
    // ignore
  }

  const pgRow = await DbPromise.get<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_name = $1 AND column_name = $2
     ) as exists`,
    [tableName, columnName],
    { fallback: true }
  );
  return Boolean(pgRow?.exists);
}

async function tableExists(tableName: string): Promise<boolean> {
  const sqliteProbe = await DbPromise.get<{ name?: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    [tableName],
    { fallback: true }
  );
  if (sqliteProbe?.name) return true;

  const pgProbe = await DbPromise.get<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) as exists`,
    [tableName],
    { fallback: true }
  );
  return Boolean(pgProbe?.exists);
}

async function ensureTranslationsTable(): Promise<void> {
  await DbPromise.run(
    `CREATE TABLE IF NOT EXISTS demo_dataset_translations (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      locale TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(entity_type, entity_id, locale)
    )`,
    [],
    { fallback: true }
  );
}

async function seedOrganizationAndProject(): Promise<void> {
  const hasIndustry = await columnExists('organizations', 'industry');
  const hasOrgType = await columnExists('organizations', 'organization_type');
  const hasIsActive = await columnExists('organizations', 'is_active');

  const orgCols = ['id', 'name', 'plan', 'status'];
  const orgVals: Array<string | number | null> = [DEMO_ORG_ID, DEMO_ORG_NAME, 'demo', 'active'];
  if (hasIndustry) {
    orgCols.push('industry');
    orgVals.push('manufacturing');
  }
  if (hasOrgType) {
    orgCols.push('organization_type');
    orgVals.push('DEMO');
  }
  if (hasIsActive) {
    orgCols.push('is_active');
    orgVals.push(1);
  }

  await DbPromise.run(
    `INSERT INTO organizations (${orgCols.join(', ')})
     VALUES (${orgCols.map(() => '?').join(', ')})
     ON CONFLICT(id) DO UPDATE SET name=excluded.name`,
    orgVals,
    { fallback: false }
  );

  const hasPassword = await columnExists('users', 'password');
  const hasUserStatus = await columnExists('users', 'status');
  const hasCreatedAt = await columnExists('users', 'created_at');
  const userCols = ['id', 'organization_id', 'email', 'first_name', 'last_name', 'role'];
  const userVals: Array<string | null> = [
    DEMO_USER_ID,
    DEMO_ORG_ID,
    'piotr.wisniewski@demo.com',
    'Demo',
    'Owner',
    'ADMIN',
  ];
  if (hasPassword) {
    userCols.push('password');
    userVals.push('demo-not-used');
  }
  if (hasUserStatus) {
    userCols.push('status');
    userVals.push('active');
  }
  if (hasCreatedAt) {
    userCols.push('created_at');
    userVals.push(nowIso());
  }

  await DbPromise.run(
    `INSERT INTO users (${userCols.join(', ')})
     VALUES (${userCols.map(() => '?').join(', ')})
     ON CONFLICT(id) DO UPDATE SET organization_id=excluded.organization_id`,
    userVals,
    { fallback: false }
  );

  const hasGoal = await columnExists('projects', 'goal');
  const hasOwner = await columnExists('projects', 'owner_id');
  const projectCols = ['id', 'organization_id', 'name', 'description', 'status'];
  const projectVals: Array<string | null> = [
    DEMO_PROJECT_ID,
    DEMO_ORG_ID,
    'Atelier Transformation 2026',
    'Flagship digital transformation program for demo walkthrough.',
    'active',
  ];
  if (hasGoal) {
    projectCols.push('goal');
    projectVals.push('Improve OEE and margin through initiatives portfolio.');
  }
  if (hasOwner) {
    projectCols.push('owner_id');
    projectVals.push(DEMO_USER_ID);
  }

  await DbPromise.run(
    `INSERT INTO projects (${projectCols.join(', ')})
     VALUES (${projectCols.map(() => '?').join(', ')})
     ON CONFLICT(id) DO UPDATE SET name=excluded.name`,
    projectVals,
    { fallback: false }
  );
}

async function seedToolSessions(): Promise<void> {
  const toolTable = (await tableExists('tool_sessions')) ? 'tool_sessions' : 'sessions';
  const baseTools = [
    { id: 'tool-session-strategy', name: 'Strategy PESTEL Scan', type: 'strategic' },
    { id: 'tool-session-ops', name: 'Operations Bottleneck Audit', type: 'operations' },
    { id: 'tool-session-digital', name: 'Digital Twin Readiness', type: 'digital' },
  ];

  for (const tool of baseTools) {
    if (toolTable === 'tool_sessions') {
      const hasProjectId = await columnExists('tool_sessions', 'project_id');
      const hasName = await columnExists('tool_sessions', 'name');
      const hasType = await columnExists('tool_sessions', 'tool_type');
      const hasOutput = await columnExists('tool_sessions', 'output_json');
      const hasCreatedBy = await columnExists('tool_sessions', 'created_by');
      const hasUpdatedBy = await columnExists('tool_sessions', 'updated_by');
      const hasCreatedAt = await columnExists('tool_sessions', 'created_at');
      const hasUpdatedAt = await columnExists('tool_sessions', 'updated_at');
      const cols = ['id', 'organization_id'];
      const vals: Array<string> = [tool.id, DEMO_ORG_ID];
      if (hasProjectId) {
        cols.push('project_id');
        vals.push(DEMO_PROJECT_ID);
      }
      if (hasName) {
        cols.push('name');
        vals.push(tool.name);
      }
      if (hasType) {
        cols.push('tool_type');
        vals.push(tool.type);
      }
      if (hasOutput) {
        cols.push('output_json');
        vals.push(JSON.stringify({ outputTitle: `${tool.name} Output`, hasOpenSource: true }));
      }
      if (hasCreatedBy) {
        cols.push('created_by');
        vals.push(DEMO_USER_ID);
      }
      if (hasUpdatedBy) {
        cols.push('updated_by');
        vals.push(DEMO_USER_ID);
      }
      if (hasCreatedAt) {
        cols.push('created_at');
        vals.push(nowIso());
      }
      if (hasUpdatedAt) {
        cols.push('updated_at');
        vals.push(nowIso());
      }
      await DbPromise.run(
        `INSERT INTO tool_sessions (${cols.join(', ')})
         VALUES (${cols.map(() => '?').join(', ')})
         ON CONFLICT(id) DO UPDATE SET organization_id=excluded.organization_id`,
        vals,
        { fallback: true }
      );
    } else {
      await DbPromise.run(
        `INSERT INTO sessions (id, user_id, project_id, type, data, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET data=excluded.data`,
        [
          tool.id,
          DEMO_USER_ID,
          DEMO_PROJECT_ID,
          'tool_session',
          JSON.stringify({
            name: tool.name,
            category: tool.type,
            outputTitle: `${tool.name} Output`,
            hasOpenSource: true,
          }),
        ],
        { fallback: true }
      );
    }
  }
}

async function seedInitiativesTasksDecisions(): Promise<void> {
  const hasSourceType = await columnExists('initiatives', 'source_type');
  const hasSourceId = await columnExists('initiatives', 'source_id');
  const hasPriority = await columnExists('initiatives', 'priority');
  const hasSummary = await columnExists('initiatives', 'summary');

  for (let i = 1; i <= 8; i++) {
    const id = `atelier-init-${String(i).padStart(2, '0')}`;
    const cols = ['id', 'organization_id', 'project_id', 'name', 'status'];
    const vals: Array<string | number> = [
      id,
      DEMO_ORG_ID,
      DEMO_PROJECT_ID,
      `Initiative ${i}: Atelier Workstream`,
      i <= 2 ? 'DONE' : i <= 5 ? 'EXECUTING' : 'PLANNING',
    ];
    if (hasPriority) {
      cols.push('priority');
      vals.push(i % 3 === 0 ? 'high' : 'medium');
    }
    if (hasSummary) {
      cols.push('summary');
      vals.push(`Business initiative ${i} with measurable value target.`);
    }
    if (hasSourceType) {
      cols.push('source_type');
      vals.push('tool_session');
    }
    if (hasSourceId) {
      cols.push('source_id');
      vals.push(i <= 3 ? 'tool-session-strategy' : i <= 6 ? 'tool-session-ops' : 'tool-session-digital');
    }

    await DbPromise.run(
      `INSERT INTO initiatives (${cols.join(', ')})
       VALUES (${cols.map(() => '?').join(', ')})
       ON CONFLICT(id) DO UPDATE SET name=excluded.name`,
      vals,
      { fallback: false }
    );

    await DbPromise.run(
      `INSERT INTO tasks (id, project_id, organization_id, title, status, priority, initiative_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET title=excluded.title`,
      [
        `atelier-task-${String(i).padStart(2, '0')}`,
        DEMO_PROJECT_ID,
        DEMO_ORG_ID,
        `Task ${i}: Execute initiative checkpoint`,
        i <= 3 ? 'done' : 'todo',
        i % 2 === 0 ? 'high' : 'medium',
        id,
      ],
      { fallback: true }
    );

    await DbPromise.run(
      `INSERT INTO decisions (id, organization_id, project_id, initiative_id, title, type, decision_maker_id, created_by, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET title=excluded.title`,
      [
        `atelier-decision-${String(i).padStart(2, '0')}`,
        DEMO_ORG_ID,
        DEMO_PROJECT_ID,
        id,
        `Decision ${i}: Go/No-Go Gate`,
        'governance',
        DEMO_USER_ID,
        DEMO_USER_ID,
        i <= 2 ? 'approved' : 'pending',
      ],
      { fallback: true }
    );
  }
}

async function seedResultsAndArtifacts(): Promise<void> {
  if (await tableExists('kpi_time_series')) {
    for (let i = 1; i <= 6; i++) {
      await DbPromise.run(
        `INSERT INTO kpi_time_series (id, kpi_id, organization_id, value, period_start, period_end, source, notes, recorded_by)
         VALUES (?, ?, ?, ?, date('now','-30 day'), date('now'), 'demo_seed', ?, ?)
         ON CONFLICT(id) DO UPDATE SET value=excluded.value`,
        [
          `atelier-kpi-ts-${String(i).padStart(2, '0')}`,
          `atelier-kpi-${String(i).padStart(2, '0')}`,
          DEMO_ORG_ID,
          60 + i * 5,
          `KPI ${i} seeded for demo dataset contract`,
          DEMO_USER_ID,
        ],
        { fallback: true }
      );
    }
  }

  if (await tableExists('roi_assumptions')) {
    await DbPromise.run(
      `INSERT INTO roi_assumptions (id, initiative_id, organization_id, assumption_key, assumption_value, confidence, notes, created_by)
       VALUES (?, ?, ?, 'benefit_plan_usd', ?, 0.8, 'Demo ROI plan', ?)
       ON CONFLICT(id) DO UPDATE SET assumption_value=excluded.assumption_value`,
      ['atelier-roi-plan-01', 'atelier-init-01', DEMO_ORG_ID, 120000, DEMO_USER_ID],
      { fallback: true }
    );
  }

  if (await tableExists('roi_realized_values')) {
    await DbPromise.run(
      `INSERT INTO roi_realized_values (id, initiative_id, organization_id, period_month, realized_revenue_delta, realized_cost_delta, realized_savings, source, variance_notes, recorded_by)
       VALUES (?, ?, ?, strftime('%Y-%m','now'), ?, ?, ?, 'demo_seed', 'Plan vs realized card', ?)
       ON CONFLICT(id) DO UPDATE SET realized_savings=excluded.realized_savings`,
      ['atelier-roi-realized-01', 'atelier-init-01', DEMO_ORG_ID, 80000, -15000, 95000, DEMO_USER_ID],
      { fallback: true }
    );
  }

  const hasReports = await tableExists('reports');
  if (hasReports) {
    const hasProjectId = await columnExists('reports', 'project_id');
    const hasReportType = await columnExists('reports', 'report_type');
    const hasType = await columnExists('reports', 'type');
    const hasReportName = await columnExists('reports', 'report_name');
    const hasName = await columnExists('reports', 'name');
    const hasTitle = await columnExists('reports', 'title');
    const hasConfig = await columnExists('reports', 'config');
    const hasData = await columnExists('reports', 'data');
    const hasStatus = await columnExists('reports', 'status');
    const hasCreatedBy = await columnExists('reports', 'created_by');
    const hasCreatedAt = await columnExists('reports', 'created_at');

    const insertReport = async (params: {
      id: string;
      typeValue: string;
      nameValue: string;
      payload: Record<string, unknown>;
    }) => {
      const cols = ['id', 'organization_id'];
      const vals: Array<string> = [params.id, DEMO_ORG_ID];
      if (hasProjectId) {
        cols.push('project_id');
        vals.push(DEMO_PROJECT_ID);
      }
      if (hasReportType) {
        cols.push('report_type');
        vals.push(params.typeValue);
      } else if (hasType) {
        cols.push('type');
        vals.push(params.typeValue);
      }
      if (hasReportName) {
        cols.push('report_name');
        vals.push(params.nameValue);
      } else if (hasName) {
        cols.push('name');
        vals.push(params.nameValue);
      } else if (hasTitle) {
        cols.push('title');
        vals.push(params.nameValue);
      }
      if (hasConfig) {
        cols.push('config');
        vals.push(JSON.stringify(params.payload));
      } else if (hasData) {
        cols.push('data');
        vals.push(JSON.stringify(params.payload));
      }
      if (hasStatus) {
        cols.push('status');
        vals.push('draft');
      }
      if (hasCreatedBy) {
        cols.push('created_by');
        vals.push(DEMO_USER_ID);
      }
      if (hasCreatedAt) {
        cols.push('created_at');
        vals.push(nowIso());
      }

      await DbPromise.run(
        `INSERT INTO reports (${cols.join(', ')})
         VALUES (${cols.map(() => '?').join(', ')})
         ON CONFLICT(id) DO UPDATE SET organization_id=excluded.organization_id`,
        vals,
        { fallback: true }
      );
    };

    await insertReport({
      id: 'atelier-report-01',
      typeValue: 'executive',
      nameValue: 'Atelier Executive Report',
      payload: { openSource: true, sourceType: 'tool_session', sourceId: 'tool-session-strategy' },
    });

    if (await tableExists('presentation_decks')) {
      await DbPromise.run(
        `INSERT INTO presentation_decks (id, organization_id, title, status, created_by, created_at, updated_at)
         VALUES (?, ?, ?, 'draft', ?, datetime('now'), datetime('now'))
         ON CONFLICT(id) DO UPDATE SET title=excluded.title`,
        ['atelier-deck-01', DEMO_ORG_ID, 'Atelier Board Deck', DEMO_USER_ID],
        { fallback: true }
      );
    } else {
      await insertReport({
        id: 'atelier-deck-fallback-01',
        typeValue: 'deck',
        nameValue: 'Atelier Transformation Deck',
        payload: { openSource: true, sourceType: 'tool_session', sourceId: 'tool-session-ops' },
      });
    }
  }
}

async function seedTranslations(): Promise<void> {
  await ensureTranslationsTable();

  const entities = [
    {
      entityType: 'organization',
      entityId: DEMO_ORG_ID,
      titles: {
        pl: 'Atelier ToolToys',
        en: 'Atelier ToolToys',
        de: 'Atelier ToolToys',
        es: 'Atelier ToolToys',
        ja: 'Atelier ToolToys',
        ar: 'أتولييه تول توي',
      },
      descriptions: {
        pl: 'Firma demonstracyjna dla ścieżki Demo → Trial.',
        en: 'Demo company for the Demo → Trial funnel.',
        de: 'Demo-Unternehmen für den Demo→Trial Funnel.',
        es: 'Empresa demo para el funnel Demo→Trial.',
        ja: 'デモからトライアルへの導線用デモ企業です。',
        ar: 'شركة تجريبية لمسار العرض إلى الفترة التجريبية.',
      },
    },
    {
      entityType: 'project',
      entityId: DEMO_PROJECT_ID,
      titles: {
        pl: 'Transformacja Atelier 2026',
        en: 'Atelier Transformation 2026',
        de: 'Atelier Transformation 2026',
        es: 'Transformacion Atelier 2026',
        ja: 'Atelier変革2026',
        ar: 'تحول أتولييه 2026',
      },
      descriptions: {
        pl: 'Główny program demonstracyjny.',
        en: 'Primary demo transformation program.',
        de: 'Haupt-Demo-Transformationsprogramm.',
        es: 'Programa principal de transformacion demo.',
        ja: '主要なデモ変革プログラム。',
        ar: 'برنامج التحول التجريبي الرئيسي.',
      },
    },
  ];

  for (const entity of entities) {
    for (const locale of SUPPORTED_LOCALES) {
      await DbPromise.run(
        `INSERT INTO demo_dataset_translations (id, entity_type, entity_id, locale, title, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
         ON CONFLICT(entity_type, entity_id, locale) DO UPDATE SET
           title=excluded.title,
           description=excluded.description,
           updated_at=datetime('now')`,
        [
          uuidv4(),
          entity.entityType,
          entity.entityId,
          locale,
          entity.titles[locale],
          entity.descriptions[locale],
        ],
        { fallback: true }
      );
    }
  }
}

async function validateContract(): Promise<void> {
  const getCount = async (sql: string, params: unknown[] = []): Promise<number> => {
    const row = await DbPromise.get<{ count?: number | string }>(sql, params, { fallback: true });
    return Number(row?.count || 0);
  };

  const projectCount = await getCount(
    `SELECT COUNT(*) as count FROM projects WHERE organization_id = ?`,
    [DEMO_ORG_ID]
  );
  const toolCount = (await tableExists('tool_sessions'))
    ? await getCount(`SELECT COUNT(*) as count FROM tool_sessions WHERE organization_id = ?`, [DEMO_ORG_ID])
    : await getCount(
        `SELECT COUNT(*) as count FROM sessions WHERE project_id = ? AND type = 'tool_session'`,
        [DEMO_PROJECT_ID]
      );
  const initiativeCount = await getCount(
    `SELECT COUNT(*) as count FROM initiatives WHERE organization_id = ?`,
    [DEMO_ORG_ID]
  );
  const taskCount = await getCount(
    `SELECT COUNT(*) as count FROM tasks WHERE organization_id = ?`,
    [DEMO_ORG_ID]
  );
  const decisionCount = await getCount(
    `SELECT COUNT(*) as count FROM decisions WHERE organization_id = ?`,
    [DEMO_ORG_ID]
  );
  const reportCount = await getCount(
    `SELECT COUNT(*) as count FROM reports WHERE organization_id = ?`,
    [DEMO_ORG_ID]
  );
  const deckCount = (await tableExists('presentation_decks'))
    ? await getCount(`SELECT COUNT(*) as count FROM presentation_decks WHERE organization_id = ?`, [DEMO_ORG_ID])
    : 0;
  const translationCount = await getCount(
    `SELECT COUNT(DISTINCT locale) as count FROM demo_dataset_translations`
  );

  const checks = [
    { name: 'project >= 1', pass: projectCount >= 1, actual: projectCount },
    { name: 'tool sessions >= 3', pass: toolCount >= 3, actual: toolCount },
    { name: 'initiatives >= 8', pass: initiativeCount >= 8, actual: initiativeCount },
    { name: 'tasks >= 8', pass: taskCount >= 8, actual: taskCount },
    { name: 'decisions >= 8', pass: decisionCount >= 8, actual: decisionCount },
    { name: 'reports+decks >= 2', pass: reportCount + deckCount >= 2, actual: reportCount + deckCount },
    { name: 'i18n locales = 6', pass: translationCount >= 6, actual: translationCount },
  ];

  const failed = checks.filter((c) => !c.pass);
  console.log('\n[demo-dataset-contract] Validation summary:');
  for (const c of checks) {
    console.log(` - ${c.pass ? 'OK' : 'FAIL'} ${c.name} (actual=${c.actual})`);
  }

  if (failed.length > 0) {
    throw new Error(`Demo dataset contract failed: ${failed.map((f) => f.name).join(', ')}`);
  }
}

async function main(): Promise<void> {
  getDatabase();
  await seedOrganizationAndProject();
  await seedToolSessions();
  await seedInitiativesTasksDecisions();
  await seedResultsAndArtifacts();
  await seedTranslations();
  await validateContract();
  console.log('\n[demo-dataset-contract] Atelier ToolToys dataset is ready.');
}

main().catch((error) => {
  console.error('[demo-dataset-contract] Failed:', (error as Error)?.message || error);
  process.exit(1);
});
