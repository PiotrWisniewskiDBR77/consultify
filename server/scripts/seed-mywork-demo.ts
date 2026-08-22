/**
 * Seed My Work demo data (tasks, decisions, notifications).
 *
 * Safe to run multiple times (idempotent via INSERT OR IGNORE).
 *
 * Usage:
 *   DB_TYPE=postgres DATABASE_URL="postgresql://..." npx tsx server/scripts/seed-mywork-demo.ts
 *
 * Optional:
 *   SEED_ORG_ID=<organization id>
 *   SEED_USER_EMAIL=user@example.com
 *   SEED_PROJECT_ID=proj_xxx
 *   SEED_DB_NAME=consultinity_migrated_YYYYMMDD_HHMMSS  (overrides DB name in DATABASE_URL)
 */
import crypto from 'crypto';

import dotenv from 'dotenv';

import logger from '../src/utils/Logger.js';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

type Row<T extends Record<string, any>> = T;

function nowIso() {
  return new Date().toISOString();
}

function isoPlusDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

async function ensureMyWorkStateTables(db: any) {
  // My Work routes require these tables at runtime (Inbox/Focus/Signals).
  // Keep DDL cross-DB compatible (SQLite/Postgres) by using TEXT columns.
  const statements: string[] = [
    // Inbox triage state
    `CREATE TABLE IF NOT EXISTS my_work_inbox_triage (
      user_id TEXT NOT NULL,
      item_key TEXT NOT NULL,
      action TEXT NOT NULL,
      params_json TEXT,
      triaged_at TEXT NOT NULL,
      PRIMARY KEY (user_id, item_key)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_my_work_inbox_triage_user_id ON my_work_inbox_triage(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_my_work_inbox_triage_item_key ON my_work_inbox_triage(item_key)`,
    `CREATE INDEX IF NOT EXISTS idx_my_work_inbox_triage_triaged_at ON my_work_inbox_triage(triaged_at)`,

    // Focus state
    `CREATE TABLE IF NOT EXISTS my_work_focus_state (
      user_id TEXT NOT NULL,
      focus_date TEXT NOT NULL,
      item_key TEXT NOT NULL,
      column_name TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, focus_date, item_key)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_my_work_focus_state_user_date ON my_work_focus_state(user_id, focus_date)`,
    `CREATE INDEX IF NOT EXISTS idx_my_work_focus_state_user_date_column ON my_work_focus_state(user_id, focus_date, column_name)`,
    `CREATE INDEX IF NOT EXISTS idx_my_work_focus_state_updated_at ON my_work_focus_state(updated_at)`,

    // Signals (T012)
    `CREATE TABLE IF NOT EXISTS my_work_signal_prefs (
      user_id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      muted_types_json TEXT NOT NULL DEFAULT '[]',
      quiet_hours_json TEXT NOT NULL DEFAULT '{}',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS my_work_signal_snoozes (
      user_id TEXT NOT NULL,
      signal_key TEXT NOT NULL,
      snoozed_until TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, signal_key)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_my_work_signal_snoozes_until ON my_work_signal_snoozes(snoozed_until)`,
    `CREATE TABLE IF NOT EXISTS my_work_signal_dismissals (
      user_id TEXT NOT NULL,
      signal_key TEXT NOT NULL,
      dismissed_at TEXT NOT NULL,
      PRIMARY KEY (user_id, signal_key)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_my_work_signal_dismissals_at ON my_work_signal_dismissals(dismissed_at)`,
  ];

  for (const sql of statements) {
    try {
      await db.run(sql, []);
    } catch {
      // Some DB drivers disallow DDL in restricted contexts; seeding should still proceed.
    }
  }
}

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

function seedKey(orgId: string, userId: string): string {
  return crypto.createHash('sha1').update(`${orgId}:${userId}`).digest('hex').slice(0, 8);
}

function buildSeedIdeaMap(opts: {
  ideaId: string;
  title: string;
  language: 'pl' | 'en';
  branches: Array<{
    key: string;
    label: string;
    items: Array<{ label: string; nodeType?: string; priority?: number; sourceType?: string }>;
  }>;
}) {
  const centerId = 'root';
  const branchRadius = 320;
  const isPl = opts.language === 'pl';

  const nodes: any[] = [
    {
      id: centerId,
      type: 'center',
      position: { x: 0, y: 0 },
      data: {
        label: opts.title || (isPl ? 'Wyzwanie' : 'Challenge'),
        hint: isPl ? 'Kliknij, aby edytować' : 'Click to edit',
        ideaId: opts.ideaId,
      },
      draggable: false,
    },
  ];

  const edges: any[] = [];

  const baseAngles = [
    -Math.PI / 2,
    -Math.PI / 6,
    Math.PI / 6,
    Math.PI / 2,
    (5 * Math.PI) / 6,
    (7 * Math.PI) / 6,
  ];

  for (let i = 0; i < opts.branches.length; i++) {
    const b = opts.branches[i];
    const angle = baseAngles[i % baseAngles.length];
    const bx = Math.cos(angle) * branchRadius;
    const by = Math.sin(angle) * branchRadius;
    const branchId = `branch-${b.key}`;

    nodes.push({
      id: branchId,
      type: 'branch',
      position: { x: bx - 50, y: by - 20 },
      data: { label: b.label, branchKey: b.key, count: b.items.length },
      draggable: false,
    });

    edges.push({
      id: `edge-${centerId}-${branchId}`,
      source: centerId,
      target: branchId,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#94a3b8', strokeWidth: 2.5, opacity: 0.35 },
      data: { system: true, kind: 'frames' },
    });

    const itemDx = Math.cos(angle) * 140;
    const itemDy = Math.sin(angle) * 140;
    const orthoDx = -Math.sin(angle) * 80;
    const orthoDy = Math.cos(angle) * 80;

    for (let j = 0; j < b.items.length; j++) {
      const it = b.items[j];
      const nid = `n-${crypto.randomUUID()}`;
      nodes.push({
        id: nid,
        type: 'idea',
        position: {
          x: bx + itemDx + orthoDx * ((j % 2 === 0 ? 1 : -1) * (0.6 + 0.22 * j)),
          y: by + itemDy + orthoDy * ((j % 3) - 1) * 0.55,
        },
        data: {
          label: it.label,
          branchKey: b.key,
          nodeType: it.nodeType || null,
          priority: typeof it.priority === 'number' ? it.priority : 55,
          sourceType: it.sourceType || 'seed',
          ideaId: opts.ideaId,
        },
      });

      edges.push({
        id: `edge-${crypto.randomUUID()}`,
        source: branchId,
        target: nid,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#8b5cf6', strokeWidth: 2, opacity: 0.75 },
        data: { userCreated: true, kind: 'seed' },
      });
    }
  }

  return { nodes, edges, version: 1 };
}

function envBool(name: string, def = false): boolean {
  const raw = process.env[name];
  if (raw == null) return def;
  const v = String(raw).trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'yes' || v === 'y') return true;
  if (v === '0' || v === 'false' || v === 'no' || v === 'n') return false;
  return def;
}

function envInt(name: string, def: number, min = 0, max = 10000): number {
  const raw = process.env[name];
  const n = Number(raw);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

async function main() {
  process.env.DB_TYPE = process.env.DB_TYPE || 'postgres';

  // Allow safe DB switching without exposing full DATABASE_URL in commands/logs.
  // Example: keep DATABASE_URL in .env, run with SEED_DB_NAME=... to target a different DB.
  const seedDbName = (process.env.SEED_DB_NAME || '').trim();
  if (seedDbName && process.env.DATABASE_URL) {
    try {
      const u = new URL(process.env.DATABASE_URL);
      u.pathname = `/${seedDbName}`;
      process.env.DATABASE_URL = u.toString();
      logger.info('[seed-mywork-demo] Using SEED_DB_NAME override', { db: seedDbName });
    } catch {
      // ignore: DATABASE_URL might be invalid, DatabaseConfig will handle errors
    }
  }

  const { getDatabaseAsync } = await import('../src/database/Database.js');
  const db = await getDatabaseAsync();

  // Ensure state tables exist so My Work tabs don't 503 (Inbox/Signals) even on fresh DBs.
  await ensureMyWorkStateTables(db);

  // -------------------------
  // Resolve org / user / project
  // -------------------------
  const seedOrgId = (process.env.SEED_ORG_ID || '').trim() || null;
  const seedProjectId = (process.env.SEED_PROJECT_ID || '').trim() || null;
  const seedUserEmail = (process.env.SEED_USER_EMAIL || '').trim() || null;

  const requestedOrgId = seedOrgId;
  if (!requestedOrgId) {
    throw new Error('[seed-mywork-demo] Set SEED_ORG_ID explicitly.');
  }
  const orgId = await (async () => {
    const r = await db.query<Row<{ id: string }>>(`SELECT id FROM organizations WHERE id = $1 LIMIT 1`, [
      requestedOrgId,
    ]);
    return r?.rows?.[0]?.id || null;
  })();
  if (!orgId) {
    throw new Error(`[seed-mywork-demo] Target organization "${requestedOrgId}" not found.`);
  }

  const userRow = await (async () => {
    if (seedUserEmail) {
      const r = await db.query<Row<{ id: string; email: string; organization_id: string }>>(
        `SELECT id, email, organization_id FROM users WHERE email = $1 LIMIT 1`,
        [seedUserEmail]
      );
      if (r?.rows?.[0]?.id) {
        if (String(r.rows[0].organization_id || '') !== orgId) {
          throw new Error(
            `[seed-mywork-demo] User ${seedUserEmail} belongs to organization "${r.rows[0].organization_id}", not "${orgId}".`
          );
        }
        return r.rows[0];
      }
      throw new Error(`User not found for SEED_USER_EMAIL=${seedUserEmail}`);
    }

    const r = await db.query<Row<{ id: string; email: string; organization_id: string }>>(
      `SELECT id, email, organization_id FROM users WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [orgId]
    );
    return r?.rows?.[0] || null;
  })();
  if (!userRow?.id) {
    throw new Error(
      'No users found for selected organization. Create a user or set SEED_USER_EMAIL.'
    );
  }
  const userId = userRow.id;

  const otherUserId = await (async () => {
    try {
      const r = await db.query<Row<{ id: string }>>(
        `SELECT id FROM users WHERE organization_id = $1 AND id <> $2 LIMIT 1`,
        [orgId, userId]
      );
      return r?.rows?.[0]?.id || null;
    } catch {
      return null;
    }
  })();

  const projectId =
    seedProjectId ||
    (await (async () => {
      const r = await db.query<Row<{ id: string }>>(
        `SELECT id FROM projects WHERE organization_id = $1 ORDER BY updated_at DESC LIMIT 1`,
        [orgId]
      );
      return r?.rows?.[0]?.id || null;
    })());

  logger.info('[seed-mywork-demo] Target selection', {
    orgId,
    userId,
    userEmail: userRow.email,
    projectId: projectId || '(none)',
  });

  // -------------------------
  // Options / counts
  // -------------------------
  const TASK_COUNT = envInt('SEED_TASKS', 20, 0, 200);
  const DECISION_COUNT = envInt('SEED_DECISIONS', 20, 0, 200);
  const NOTIF_COUNT = envInt('SEED_NOTIFICATIONS', 20, 0, 200);
  const IDEAS_COUNT = envInt('SEED_IDEAS', 20, 0, 200);
  const NOTEBOOK_COUNT = 6; // fixed set of diverse English demo notes
  const FOCUS_COUNT = envInt('SEED_FOCUS_ITEMS', 20, 0, 200);

  const purgeDecisions = envBool('SEED_PURGE_DECISIONS', false);
  const purgeAllMyWork = envBool('SEED_PURGE_ALL_MYWORK', false);
  const purgeNotebookOnly = envBool('SEED_PURGE_NOTEBOOK_ONLY', false);
  const confirmPurge = String(process.env.SEED_PURGE_CONFIRM || '').trim().toUpperCase() === 'YES';

  if ((purgeDecisions || purgeAllMyWork || purgeNotebookOnly) && !confirmPurge) {
    throw new Error(
      'Purge requested but not confirmed. Set SEED_PURGE_CONFIRM=YES to proceed with deletions.'
    );
  }

  // For safety, purge only within current user+org scope (DBR77 seed use-case).
  if (purgeAllMyWork) {
    logger.warn('[seed-mywork-demo] Purging My Work data for user/org scope', { orgId, userId });
    try {
      await db.run(`DELETE FROM my_work_focus_state WHERE user_id = $1`, [userId]);
    } catch {}
    try {
      await db.run(`DELETE FROM my_work_inbox_triage WHERE user_id = $1`, [userId]);
    } catch {}
    try {
      await db.run(`DELETE FROM my_work_signal_prefs WHERE user_id = $1`, [userId]);
      await db.run(`DELETE FROM my_work_signal_snoozes WHERE user_id = $1`, [userId]);
      await db.run(`DELETE FROM my_work_signal_dismissals WHERE user_id = $1`, [userId]);
    } catch {}
    try {
      await db.run(`DELETE FROM my_ideas WHERE user_id = $1 AND organization_id = $2`, [userId, orgId]);
    } catch {}
    try {
      await db.run(`DELETE FROM my_idea_maps WHERE user_id = $1 AND organization_id = $2`, [userId, orgId]);
    } catch {}
    try {
      await db.run(`DELETE FROM notebook_pages WHERE owner_user_id = $1 AND organization_id = $2`, [
        userId,
        orgId,
      ]);
    } catch {}
    try {
      await db.run(`DELETE FROM notifications WHERE user_id = $1`, [userId]);
    } catch {}
    try {
      await db.run(`DELETE FROM tasks WHERE assignee_id = $1 AND organization_id = $2`, [userId, orgId]);
    } catch {}
  }

  if (purgeNotebookOnly) {
    logger.warn('[seed-mywork-demo] Purging notebook pages only for user/org scope', { orgId, userId });
    try {
      await db.run(`DELETE FROM notebook_pages WHERE owner_user_id = $1 AND organization_id = $2`, [
        userId,
        orgId,
      ]);
    } catch {}
  }

  if (purgeDecisions) {
    logger.warn('[seed-mywork-demo] Purging decisions for user/org scope', { orgId, userId });
    try {
      await db.run(
        `DELETE FROM decisions WHERE organization_id = $1 AND (decision_maker_id = $2 OR created_by = $2)`,
        [orgId, userId]
      );
    } catch {}
  }

  // -------------------------
  // Seed tasks
  // -------------------------
  const taskStatuses = ['todo', 'in_progress', 'blocked', 'done', 'review'] as const;
  const priorities = ['low', 'medium', 'high', 'critical'] as const;
  const phases = ['design', 'build', 'execute', 'verify', 'rollout'] as const;
  const risks = ['low', 'medium', 'high'] as const;

  const taskTitles = [
    'Przygotować plan warsztatu z interesariuszami',
    'Zmapować zależności i ryzyka wdrożenia',
    'Ustawić monitoring i alerting dla backendu',
    'Zweryfikować uprawnienia i role (RBAC)',
    'Zamknąć krytyczne bugi przed cutover',
    'Ustalić SLA dla kluczowych procesów',
    'Przegląd jakości danych po migracji',
    'Przygotować checklistę go-live',
    'Zoptymalizować dashboard My Work',
    'Skonfigurować integracje (webhooks)',
    'Ustawić polityki bezpieczeństwa (CSRF/CORS)',
    'Audyt kosztów i budżetu AI',
    'Przygotować komunikację do użytkowników',
    'Utworzyć raport statusowy dla PMO',
    'Zweryfikować eksport raportów publicznych',
    'Zadbać o backup i rollback plan',
    'Przegląd wydajności: indeksy i cache',
    'Porządek w notyfikacjach (grupowanie)',
    'Ustalić ownerów inicjatyw i zadań',
    'Weryfikacja E2E smoke po deploy',
  ];

  const baseStamp = Date.now();
  const createdAt = nowIso();

  const seededTaskIds: string[] = [];
  const personalTasksTarget = Math.min(TASK_COUNT, Math.max(0, Math.floor(TASK_COUNT / 3)));
  for (let i = 0; i < TASK_COUNT; i++) {
    const id = `seed_task_${baseStamp}_${i}_${crypto.randomUUID()}`;
    const status = pick([...taskStatuses], i);
    const priority = pick([...priorities], i + 1);
    const stepPhase = pick([...phases], i + 2);
    const riskRating = pick([...risks], i + 3);
    const isPersonal = i < personalTasksTarget;
    const taskProjectId = !isPersonal && projectId ? projectId : null;
    const taskType = isPersonal ? 'personal' : i % 4 === 0 ? 'governance' : 'execution';

    // Coverage for UI filters:
    // - Overdue: open task with due_date in the past
    // - Today: open task due today
    // - Week: open task within next 7 days
    // We force the first few seeded tasks (which are personal) to cover those cases.
    const due =
      i === 0
        ? isoPlusDays(-2) // overdue + open
        : i === 1
          ? isoPlusDays(0) // due today
          : i === 2
            ? isoPlusDays(3) // due this week
            : status === 'done'
              ? isoPlusDays(-Math.max(1, i % 10))
              : isoPlusDays((i % 14) - 3); // may be past or future
    const completedAt = status === 'done' ? isoPlusDays(-Math.max(1, i % 8)) : null;

    const tags = JSON.stringify(
      [
        'dbr77',
        'my-work',
        priority === 'critical' ? 'p0' : priority === 'high' ? 'p1' : 'p2',
        status,
        stepPhase,
        taskType,
      ].filter(Boolean)
    );

    const rowCreatedAt = isoPlusDays(-Math.max(0, i % 21));
    await db.run(
      `INSERT INTO tasks(
        id, project_id, organization_id, title, description, status, priority,
        assignee_id, reporter_id, due_date, estimated_hours, tags,
        created_at, updated_at, completed_at,
        task_type, risk_rating, step_phase, initiative_id, acceptance_criteria, blocking_issues, why
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
      ON CONFLICT (id) DO NOTHING`,
      [
        id,
        taskProjectId,
        orgId,
        `DBR77: ${pick(taskTitles, i)}`,
        `DBR77 / My Work: seeded task (${taskType}/${status}/${priority}).`,
        status,
        priority,
        userId,
        userId,
        due,
        (i % 6) + 1,
        tags,
        rowCreatedAt,
        rowCreatedAt,
        completedAt,
        taskType,
        riskRating,
        stepPhase,
        null,
        i % 3 === 0 ? 'Definition of Done spełnione + review' : '',
        status === 'blocked' ? 'Czeka na decyzję / zależność' : '',
        i % 5 === 0 ? 'Aby odblokować kolejne kroki programu' : '',
      ]
    );
    seededTaskIds.push(id);
  }

  // -------------------------
  // Seed decisions
  // -------------------------
  const decisionTypes = ['APPROVAL', 'SCOPE', 'RISK', 'TECH', 'GOVERNANCE'] as const;
  const decisionStatuses = ['pending', 'in_review', 'approved', 'rejected', 'escalated'] as const;

  const decisionTitles = [
    'DBR77: Scope — My Work V2 rollout',
    'DBR77: Czy włączamy publiczne linki do raportów?',
    'DBR77: Wybór modelu LLM dla produkcji',
    'DBR77: Priorytet — stabilność vs nowe funkcje',
    'DBR77: Rollout do domeny publicznej',
    'DBR77: Reset embeddings po cutover?',
    'DBR77: Zasady eskalacji dla zablokowanych zadań',
    'DBR77: Staging environment na Railway',
    'DBR77: Strict CSRF na wybranych endpointach?',
    'DBR77: Polityka retencji logów i danych',
    'DBR77: CORS — whitelist domen i tryb produkcyjny',
    'DBR77: Budżet tokenów — limity i alerty',
    'DBR77: Governance — kto akceptuje gate’y?',
    'DBR77: SLA Inbox — progi L1/L2/L3',
    'DBR77: Czy włączamy signals feed w beta?',
    'DBR77: Priorytety tygodnia — MUST/SHOULD/COULD',
    'DBR77: Polityka uprawnień (RBAC) dla My Work',
    'DBR77: Czy “Focus” ma być domyślną tab?',
    'DBR77: Strategia testów — smoke + e2e',
    'DBR77: Plan rollback po deploy',
  ];

  const seededDecisionIds: string[] = [];
  for (let i = 0; i < DECISION_COUNT; i++) {
    const id = `seed_decision_${baseStamp}_${i}_${crypto.randomUUID()}`;
    const status = pick([...decisionStatuses], i);
    const dtype = pick([...decisionTypes], i + 2);
    const deadline = isoPlusDays((i % 8) - 2);
    const decidedAt =
      status === 'approved' || status === 'rejected' ? isoPlusDays(-(i % 5)) : null;
    const decisionMakerId = otherUserId && i % 4 === 1 ? otherUserId : userId;

    const options = JSON.stringify(
      [
        { key: 'A', label: 'Opcja A', pros: ['szybko'], cons: ['ryzyko'] },
        { key: 'B', label: 'Opcja B', pros: ['bezpiecznie'], cons: ['wolniej'] },
        { key: 'C', label: 'Opcja C', pros: ['taniej'], cons: ['ograniczenia'] },
      ].slice(0, 2 + (i % 2))
    );

    const selectedOption =
      status === 'approved' ? (i % 2 === 0 ? 'A' : 'B') : status === 'rejected' ? 'B' : null;

    await db.run(
      `INSERT INTO decisions(
        id, organization_id, project_id, task_id,
        title, description, type,
        decision_maker_id,
        options, criteria, deadline, escalation_deadline,
        status, selected_option, decision_rationale, decided_at,
        created_by, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      ON CONFLICT (id) DO NOTHING`,
      [
        id,
        orgId,
        projectId,
        i < seededTaskIds.length ? seededTaskIds[i] : null,
        pick(decisionTitles, i),
        `DBR77 / My Work: seeded decision (${dtype}/${status}).`,
        dtype,
        decisionMakerId,
        options,
        'Impact, effort, risk',
        deadline,
        isoPlusDays((i % 8) - 1),
        status,
        selectedOption,
        status === 'pending' || status === 'in_review' || status === 'escalated'
          ? null
          : 'Wybrano na podstawie ryzyk i wpływu na harmonogram.',
        decidedAt,
        userId,
        isoPlusDays(-Math.max(0, i % 30)),
        createdAt,
      ]
    );
    seededDecisionIds.push(id);
  }

  // -------------------------
  // Seed notifications (system + AI + mixed)
  // -------------------------
  const notifTemplates: Array<{
    type: string;
    title: string;
    message: string;
    severity?: string;
    priority?: string;
    icon?: string;
    entity_type?: string | null;
    entity_id?: string | null;
    actor_name?: string | null;
    read?: boolean;
  }> = [
    {
      type: 'system_maintenance',
      title: 'Planowana przerwa techniczna',
      message: 'W najbliższych dniach planowany krótki downtime (cutover DB).',
      severity: 'INFO',
      priority: 'normal',
      icon: 'wrench',
      read: false,
    },
    {
      type: 'system_security',
      title: 'Wymagana rotacja sekretów',
      message: 'Przed publicznym deploy ustaw mocny JWT_SECRET i zweryfikuj REDIS_URL.',
      severity: 'WARNING',
      priority: 'high',
      icon: 'shield',
      read: false,
    },
    {
      type: 'ai_insight',
      title: 'AI: Wykryto ryzyko w harmonogramie',
      message: 'Kilka zadań ma status blocked i deadline w ciągu 48h.',
      severity: 'WARNING',
      priority: 'high',
      icon: 'sparkles',
      entity_type: 'task',
      entity_id: seededTaskIds[2],
      actor_name: 'AI Assistant',
      read: false,
    },
    {
      type: 'ai_recommendation',
      title: 'AI: Sugestia priorytetu',
      message: 'Rozważ podbicie priorytetu dla „Monitoring i alerting”.',
      severity: 'INFO',
      priority: 'normal',
      icon: 'lightbulb',
      entity_type: 'task',
      entity_id: seededTaskIds[3],
      actor_name: 'AI Assistant',
      read: true,
    },
    {
      type: 'decision_request',
      title: 'Decyzja wymagana',
      message: 'Czeka decyzja: „Rollout do domeny publicznej”.',
      severity: 'WARNING',
      priority: 'high',
      icon: 'gavel',
      entity_type: 'decision',
      entity_id: seededDecisionIds[4],
      actor_name: 'System',
      read: false,
    },
    {
      type: 'task_due_soon',
      title: 'Zadanie zbliża się do terminu',
      message: 'Masz zadanie z terminem w ciągu 3 dni.',
      severity: 'INFO',
      priority: 'normal',
      icon: 'calendar',
      entity_type: 'task',
      entity_id: seededTaskIds[5],
      actor_name: 'System',
      read: true,
    },
    {
      type: 'system_audit',
      title: 'Audyt: gotowość do deploymentu',
      message: 'Build + test gates przeszły. Sprawdź jeszcze konfigurację domeny i CORS.',
      severity: 'INFO',
      priority: 'normal',
      icon: 'check-circle',
      read: false,
    },
  ];

  const generatedNotifs: typeof notifTemplates = [];
  for (let i = 0; i < NOTIF_COUNT; i++) {
    const base = pick(notifTemplates, i);
    const taskId = seededTaskIds[i % Math.max(1, seededTaskIds.length)];
    const decisionId = seededDecisionIds[i % Math.max(1, seededDecisionIds.length)];
    const isAi = i % 3 === 0;
    const type = isAi
      ? pick(['ai_insight', 'ai_recommendation', 'ai_risk_detected', 'ai_overload_detected'], i)
      : pick(
          ['task_due_soon', 'task_blocked', 'decision_request', 'mention', 'escalation', 'review_request'],
          i
        );
    const severity = isAi ? (i % 4 === 0 ? 'WARNING' : 'INFO') : i % 5 === 0 ? 'WARNING' : 'INFO';
    const priority = severity === 'WARNING' ? 'high' : 'normal';
    const entity_type =
      type.includes('decision') || type === 'decision_request' ? 'decision' : 'task';
    const entity_id = entity_type === 'decision' ? decisionId : taskId;
    const title = `${base.title} · ${isAi ? 'AI' : 'System'} · DBR77`;
    const message =
      isAi
        ? `DBR77: Sygnał z AI (${type}). Sprawdź czy trzeba: snooze/mute/save → Ideas/Notebook.`
        : `DBR77: Powiadomienie (${type}) do triage w Inbox.`;
    generatedNotifs.push({
      ...base,
      type,
      title,
      message,
      severity,
      priority,
      entity_type,
      entity_id,
      actor_name: isAi ? 'AI Assistant' : 'System',
      read: i % 4 === 0,
    });
  }

  for (let i = 0; i < generatedNotifs.length; i++) {
    const n = generatedNotifs[i];
    const id = `seed_notif_${baseStamp}_${i}_${crypto.randomUUID()}`;
    const isRead = !!n.read;
    const readAt = isRead ? nowIso() : null;

    const data = JSON.stringify({
      source: n.type.startsWith('ai_') ? 'ai' : 'system',
      seeded: true,
      entity: n.entity_type ? { type: n.entity_type, id: n.entity_id } : undefined,
    });

    await db.run(
      `INSERT INTO notifications(
        id, user_id, organization_id,
        type, title, message, body,
        data, metadata,
        read, is_read, severity, priority, icon,
        entity_type, entity_id,
        actor_name, read_at,
        created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      ON CONFLICT (id) DO NOTHING`,
      [
        id,
        userId,
        orgId,
        n.type,
        n.title,
        n.message,
        n.message,
        data,
        JSON.stringify({ seeded: true }),
        isRead ? 1 : 0,
        isRead ? 1 : 0,
        n.severity || 'normal',
        n.priority || 'normal',
        n.icon || null,
        n.entity_type || null,
        n.entity_id || null,
        n.actor_name || null,
        readAt,
        createdAt,
      ]
    );
  }

  // -------------------------
  // Seed ideas (T009) — My Ideas
  // -------------------------
  try {
    for (let i = 0; i < IDEAS_COUNT; i++) {
      const id = `seed_idea_${baseStamp}_${i}_${crypto.randomUUID()}`;
      const title = `DBR77: Pomysł #${i + 1} — My Work`;
      const body = [
        'Kontekst: DBR77 / My Work V2.',
        'Pomysł: uprościć triage w Inbox (SLA + decyzje + eskalacje).',
        'Następny krok: dodać checklistę, ownera i link do artefaktu.',
      ].join('\n');
      const tags = JSON.stringify(['dbr77', 'my-work', i % 2 === 0 ? 'governance' : 'execution']);
      await db.run(
        `INSERT INTO my_ideas(
          id, user_id, organization_id, title, body, tags, source_type, source_conversation_id, source_message_id,
          created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (id) DO NOTHING`,
        [
          id,
          userId,
          orgId,
          title,
          body,
          tags,
          'seed',
          null,
          null,
          isoPlusDays(-Math.max(0, i % 25)),
          createdAt,
        ]
      );
    }
  } catch {
    logger.warn('[seed-mywork-demo] Ideas seed skipped (missing table?)');
  }

  // -------------------------
  // Seed 3 example idea maps (My Ideas → recommendation maps)
  // -------------------------
  const seedIdeaMaps = envBool('SEED_IDEA_MAPS', true);
  if (seedIdeaMaps) {
    try {
      const k = seedKey(orgId, userId);
      const examples: Array<{
        slug: string;
        titlePl: string;
        bodyPl: string;
        branch: string;
        area: string;
        priority: number;
        map: ReturnType<typeof buildSeedIdeaMap>;
      }> = [
        {
          slug: 'erp',
          titlePl: 'Wdrożenie ERP (end-to-end)',
          bodyPl:
            'Wyzwanie: wdrożyć ERP end-to-end (finanse + logistyka + produkcja) minimalizując ryzyko i zapewniając adopcję.\n' +
            '\n' +
            'Cel: przejście na jeden system źródłowy danych, skrócenie cyklu zamknięcia miesiąca, poprawa jakości danych.\n' +
            'Zakres: procesy core + integracje krytyczne.\n',
          branch: 'operations',
          area: 'Finance/Operations',
          priority: 85,
          map: buildSeedIdeaMap({
            ideaId: `seed_idea_map_${k}_erp`,
            title: 'Wdrożenie ERP (end-to-end)',
            language: 'pl',
            branches: [
              {
                key: 'problem',
                label: 'Problem',
                items: [
                  { label: 'Rozproszone źródła danych i niespójne raportowanie', nodeType: 'pain_point', priority: 70 },
                  { label: 'Długi cykl zamknięcia miesiąca', nodeType: 'metric', priority: 65 },
                ],
              },
              {
                key: 'goal',
                label: 'Cel / KPI',
                items: [
                  { label: 'Zamknięcie miesiąca: -40%', nodeType: 'kpi', priority: 75 },
                  { label: 'Jakość danych: mniej korekt i ręcznych obejść', nodeType: 'kpi', priority: 70 },
                ],
              },
              {
                key: 'options',
                label: 'Opcje',
                items: [
                  { label: 'Greenfield vs rollout modułami (phased)', nodeType: 'option', priority: 60 },
                  { label: 'Integracje: API-first + ESB', nodeType: 'option', priority: 55 },
                  { label: 'Data governance: master data + ownership', nodeType: 'option', priority: 65 },
                ],
              },
              {
                key: 'evidence',
                label: 'Dowody',
                items: [
                  { label: 'Mapa procesów + KPI baseline', nodeType: 'evidence', priority: 55 },
                  { label: 'Audyt danych (quality + lineage)', nodeType: 'evidence', priority: 55 },
                ],
              },
              {
                key: 'risks',
                label: 'Ryzyka',
                items: [
                  { label: 'Adopcja: opór użytkowników i shadow IT', nodeType: 'risk', priority: 75 },
                  { label: 'Migracja danych: braki i duplikaty', nodeType: 'risk', priority: 70 },
                ],
              },
              {
                key: 'experiments',
                label: 'Eksperymenty',
                items: [
                  { label: 'Pilot: 1 proces + 1 zespół (4 tygodnie)', nodeType: 'experiment', priority: 60 },
                  { label: 'Dry-run migracji na próbce danych', nodeType: 'experiment', priority: 55 },
                ],
              },
            ],
          }),
        },
        {
          slug: 'backoffice',
          titlePl: 'Automatyzacja back-office',
          bodyPl:
            'Wyzwanie: zautomatyzować powtarzalne procesy back-office (invoice, approvals, HR), aby odciążyć zespół.\n' +
            'Cel: zmniejszyć czas obsługi i liczbę błędów, skrócić lead time.\n',
          branch: 'governance',
          area: 'Operations',
          priority: 70,
          map: buildSeedIdeaMap({
            ideaId: `seed_idea_map_${k}_backoffice`,
            title: 'Automatyzacja back-office',
            language: 'pl',
            branches: [
              {
                key: 'problem',
                label: 'Problem',
                items: [
                  { label: 'Dużo ręcznej pracy w approval flow', nodeType: 'pain_point', priority: 65 },
                  { label: 'Błędy i duplikaty w fakturach', nodeType: 'pain_point', priority: 65 },
                ],
              },
              {
                key: 'goal',
                label: 'Cel / KPI',
                items: [
                  { label: 'Lead time: -30%', nodeType: 'kpi', priority: 70 },
                  { label: 'Błędy: -50%', nodeType: 'kpi', priority: 65 },
                ],
              },
              {
                key: 'options',
                label: 'Opcje',
                items: [
                  { label: 'RPA na wąskich gardłach + monitoring', nodeType: 'option', priority: 55 },
                  { label: 'Workflow engine + role-based approvals', nodeType: 'option', priority: 60 },
                ],
              },
              {
                key: 'evidence',
                label: 'Dowody',
                items: [{ label: 'Process mining na top 3 procesach', nodeType: 'evidence', priority: 55 }],
              },
              {
                key: 'risks',
                label: 'Ryzyka',
                items: [{ label: 'Automatyzacja złego procesu (waste)', nodeType: 'risk', priority: 60 }],
              },
              {
                key: 'experiments',
                label: 'Eksperymenty',
                items: [{ label: 'POC: invoice intake + OCR + triage', nodeType: 'experiment', priority: 60 }],
              },
            ],
          }),
        },
        {
          slug: 'ai-quality',
          titlePl: 'AI monitoring jakości',
          bodyPl:
            'Wyzwanie: monitorować jakość (produkcja/usługi) w czasie zbliżonym do rzeczywistego i szybciej reagować na odchylenia.\n' +
            'Cel: wykrywanie anomalii, redukcja reklamacji, lepsza przyczyna źródłowa.\n',
          branch: 'execution',
          area: 'Technology',
          priority: 75,
          map: buildSeedIdeaMap({
            ideaId: `seed_idea_map_${k}_ai_quality`,
            title: 'AI monitoring jakości',
            language: 'pl',
            branches: [
              {
                key: 'problem',
                label: 'Problem',
                items: [
                  { label: 'Późne wykrywanie defektów', nodeType: 'pain_point', priority: 70 },
                  { label: 'Brak wspólnej definicji jakości', nodeType: 'pain_point', priority: 60 },
                ],
              },
              {
                key: 'goal',
                label: 'Cel / KPI',
                items: [
                  { label: 'Reklamacje: -20%', nodeType: 'kpi', priority: 70 },
                  { label: 'MTTR: -30%', nodeType: 'kpi', priority: 65 },
                ],
              },
              {
                key: 'options',
                label: 'Opcje',
                items: [
                  { label: 'Anomaly detection na sygnałach procesowych', nodeType: 'option', priority: 60 },
                  { label: 'Computer vision na stanowisku kontroli', nodeType: 'option', priority: 60 },
                ],
              },
              {
                key: 'evidence',
                label: 'Dowody',
                items: [{ label: 'Baseline danych i definicje metryk jakości', nodeType: 'evidence', priority: 55 }],
              },
              {
                key: 'risks',
                label: 'Ryzyka',
                items: [{ label: 'Drift modelu + false positives', nodeType: 'risk', priority: 65 }],
              },
              {
                key: 'experiments',
                label: 'Eksperymenty',
                items: [{ label: 'Pilot: 1 linia / 1 usługa, 2 tygodnie', nodeType: 'experiment', priority: 60 }],
              },
            ],
          }),
        },
      ];

      for (const ex of examples) {
        const ideaId = ex.map.nodes?.[0]?.data?.ideaId || `seed_idea_map_${k}_${ex.slug}`;
        // Upsert idea
        await db.run(
          `INSERT INTO my_ideas(
            id, user_id, organization_id, title, body, tags, source_type,
            stage, area, priority, branch,
            created_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
          ON CONFLICT (id) DO UPDATE SET
            title = excluded.title,
            body = excluded.body,
            tags = excluded.tags,
            stage = excluded.stage,
            area = excluded.area,
            priority = excluded.priority,
            branch = excluded.branch,
            updated_at = excluded.updated_at`,
          [
            ideaId,
            userId,
            orgId,
            ex.titlePl,
            ex.bodyPl,
            JSON.stringify(['dbr77', 'my-work', 'idea-map', ex.slug]),
            'seed',
            'spark',
            ex.area,
            ex.priority,
            ex.branch,
            isoPlusDays(-5),
            createdAt,
          ]
        );

        // Upsert map (unique: idea_id + user_id + organization_id)
        const mapId = `seed_idea_maprow_${k}_${ex.slug}`;
        await db.run(
          `INSERT INTO my_idea_maps(
            id, idea_id, user_id, organization_id, nodes_json, edges_json, version, created_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          ON CONFLICT (user_id, idea_id) DO UPDATE SET
            nodes_json = excluded.nodes_json,
            edges_json = excluded.edges_json,
            version = excluded.version,
            updated_at = excluded.updated_at`,
          [
            mapId,
            ideaId,
            userId,
            orgId,
            JSON.stringify(ex.map.nodes),
            JSON.stringify(ex.map.edges),
            1,
            createdAt,
            createdAt,
          ]
        );
      }

      logger.info('[seed-mywork-demo] Seeded example idea maps', { count: examples.length });
    } catch {
      logger.warn('[seed-mywork-demo] Idea maps seed skipped (missing table?)');
    }
  }

  // -------------------------
  // Seed notebook pages (T011) — 6 diverse English demo notes
  // -------------------------
  try {
    const demoNotebooks: Array<{
      title: string;
      icon: string;
      maturity: 'seed' | 'growing' | 'mature' | 'actionable';
      status: 'inbox' | 'active' | 'converted' | 'archived';
      verificationStatus: 'unverified' | 'verified' | 'disputed';
      reviewCadence: 'weekly' | 'monthly' | 'quarterly' | 'never';
      pinned: boolean;
      tags: string[];
      visibility: 'private' | 'project';
      daysAgo: number;
      contentText: string;
    }> = [
      {
        title: 'Our latest investment in open source security for the enterprise',
        icon: '🛡️',
        maturity: 'mature',
        status: 'active',
        verificationStatus: 'verified',
        reviewCadence: 'monthly',
        pinned: true,
        tags: ['security', 'open-source', 'enterprise', 'investment'],
        visibility: 'project',
        daysAgo: 3,
        contentText:
          'Our latest investment in open source security for the enterprise.\n\n' +
          '- Evaluated 5 OSS security frameworks for supply-chain hardening\n' +
          '- Selected SLSA + Sigstore as the baseline for artifact signing\n' +
          '- Budget approved: $120K for tooling + 2 FTE for integration\n' +
          '- Next: pilot rollout on 3 critical repos by end of Q2',
      },
      {
        title: 'Weekly priorities — Sprint 14 focus areas',
        icon: '🎯',
        maturity: 'mature',
        status: 'active',
        verificationStatus: 'verified',
        reviewCadence: 'weekly',
        pinned: false,
        tags: ['sprint', 'priorities', 'planning'],
        visibility: 'private',
        daysAgo: 1,
        contentText:
          'Sprint 14 — Focus Areas\n\n' +
          'MUST:\n' +
          '- Finalize API rate-limiting policy before public launch\n' +
          '- Complete data migration dry-run on staging\n\n' +
          'SHOULD:\n' +
          '- Review dashboard performance metrics\n' +
          '- Update onboarding flow copy\n\n' +
          'COULD:\n' +
          '- Prototype AI-assisted triage for inbox',
      },
      {
        title: 'Meeting notes — Team sync on Q2 roadmap',
        icon: '👥',
        maturity: 'growing',
        status: 'active',
        verificationStatus: 'unverified',
        reviewCadence: 'monthly',
        pinned: false,
        tags: ['meeting', 'roadmap', 'q2', 'team'],
        visibility: 'project',
        daysAgo: 5,
        contentText:
          'Team sync — Q2 Roadmap Discussion\n\n' +
          'Attendees: PM, Engineering Lead, Design, QA\n\n' +
          'Key decisions:\n' +
          '- Prioritize stability over new features for April\n' +
          '- Move AI assistant to beta track (separate release)\n' +
          '- Hire 1 senior backend engineer by mid-April\n\n' +
          'Open questions:\n' +
          '- Should we sunset the legacy reporting module?\n' +
          '- Timeline for SOC 2 compliance audit',
      },
      {
        title: 'Risk register — Transformation program blockers',
        icon: '⚠️',
        maturity: 'actionable',
        status: 'active',
        verificationStatus: 'disputed',
        reviewCadence: 'weekly',
        pinned: true,
        tags: ['risk', 'transformation', 'blockers', 'governance'],
        visibility: 'project',
        daysAgo: 2,
        contentText:
          'Risk Register — Transformation Program\n\n' +
          'R1 (HIGH): Data migration quality — 12% records failed validation in dry-run\n' +
          '  → Mitigation: dedicated cleanup sprint before cutover\n\n' +
          'R2 (MEDIUM): Vendor lock-in on AI model provider\n' +
          '  → Mitigation: abstract LLM layer, evaluate 2 alternatives\n\n' +
          'R3 (LOW): User adoption resistance in finance team\n' +
          '  → Mitigation: champion program + weekly office hours\n\n' +
          'R4 (HIGH): Budget overrun on infrastructure costs\n' +
          '  → Mitigation: implement cost alerts + monthly review',
      },
      {
        title: 'Untitled draft',
        icon: '📝',
        maturity: 'seed',
        status: 'inbox',
        verificationStatus: 'unverified',
        reviewCadence: 'never',
        pinned: false,
        tags: ['draft'],
        visibility: 'private',
        daysAgo: 0,
        contentText: '}',
      },
      {
        title: 'Google is making new investments in AI infrastructure',
        icon: '🤖',
        maturity: 'growing',
        status: 'active',
        verificationStatus: 'unverified',
        reviewCadence: 'quarterly',
        pinned: false,
        tags: ['ai', 'google', 'infrastructure', 'research'],
        visibility: 'private',
        daysAgo: 7,
        contentText:
          'Google is making new investments in AI infrastructure\n\n' +
          '- $4B committed to custom TPU v6 fabrication\n' +
          '- New Gemini Ultra model benchmarks exceed GPT-4 on reasoning tasks\n' +
          '- Open-sourcing key inference optimization libraries\n\n' +
          'Implications for us:\n' +
          '- Evaluate Gemini API for our summarization pipeline\n' +
          '- Monitor pricing changes — could reduce our AI spend by 15-20%\n' +
          '- Consider multi-provider strategy to avoid single-vendor risk',
      },
    ];

    for (let i = 0; i < demoNotebooks.length; i++) {
      const nb = demoNotebooks[i];
      const id = `seed_nb_${baseStamp}_${i}_${crypto.randomUUID()}`;
      const contentJson = JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: nb.contentText }],
          },
        ],
      });
      const useProject = nb.visibility === 'project' && Boolean(projectId);
      const rowCreatedAt = isoPlusDays(-nb.daysAgo);
      await db.run(
        `INSERT INTO notebook_pages(
          id, owner_user_id, organization_id, project_id, visibility,
          title, content_json, content_text, tags_json,
          icon, maturity, status, pinned,
          verification_status, review_cadence,
          created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        ON CONFLICT (id) DO NOTHING`,
        [
          id,
          userId,
          orgId,
          useProject ? projectId : null,
          useProject ? 'project' : 'private',
          nb.title,
          contentJson,
          nb.contentText,
          JSON.stringify(nb.tags),
          nb.icon,
          nb.maturity,
          nb.status,
          nb.pinned ? 1 : 0,
          nb.verificationStatus,
          nb.reviewCadence,
          rowCreatedAt,
          rowCreatedAt,
        ]
      );
    }
  } catch (e) {
    logger.warn('[seed-mywork-demo] Notebook seed skipped (missing table?)');
  }

  // -------------------------
  // Seed focus state (T011) — persisted board layout
  // -------------------------
  try {
    const today = new Date().toISOString().slice(0, 10);
    const cols = ['today', 'this_week', 'later'] as const;
    const keys: string[] = [];
    for (let i = 0; i < Math.min(seededTaskIds.length, FOCUS_COUNT); i++) keys.push(`task:${seededTaskIds[i]}`);
    for (let i = 0; keys.length < FOCUS_COUNT && i < seededDecisionIds.length; i++)
      keys.push(`decision:${seededDecisionIds[i]}`);

    const posByCol: Record<string, number> = {};
    for (let i = 0; i < keys.length; i++) {
      const col = cols[i % cols.length];
      posByCol[col] = (posByCol[col] ?? 0) + 1;
      await db.run(
        `INSERT INTO my_work_focus_state(
          user_id, focus_date, item_key, column_name, position, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (user_id, focus_date, item_key) DO UPDATE SET
          column_name = excluded.column_name,
          position = excluded.position,
          updated_at = excluded.updated_at`,
        [userId, today, keys[i], col, posByCol[col] - 1, createdAt]
      );
    }
  } catch {
    logger.warn('[seed-mywork-demo] Focus seed skipped (missing table?)');
  }

  logger.info('[seed-mywork-demo] Done', {
    tasks: TASK_COUNT,
    decisions: DECISION_COUNT,
    notifications: NOTIF_COUNT,
    ideas: IDEAS_COUNT,
    notebookPages: NOTEBOOK_COUNT,
    focusItems: FOCUS_COUNT,
  });
}

main().catch((err) => {
  logger.error(`[seed-mywork-demo] Failed: ${err?.stack || err?.message || String(err)}`);
  process.exit(1);
});
