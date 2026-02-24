/**
 * Seed My Work demo data (tasks, decisions, notifications).
 *
 * Safe to run multiple times (idempotent via INSERT OR IGNORE).
 *
 * Usage:
 *   DB_TYPE=postgres DATABASE_URL="postgresql://..." npx tsx server/scripts/seed-mywork-demo.ts
 *
 * Optional:
 *   SEED_ORG_ID=org_xxx
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

  const orgId =
    seedOrgId ||
    (await (async () => {
      const r = await db.query<Row<{ id: string }>>(
        `SELECT id FROM organizations ORDER BY created_at DESC LIMIT 1`,
        []
      );
      return r?.rows?.[0]?.id || null;
    })());
  if (!orgId) {
    throw new Error('No organizations found. Set SEED_ORG_ID or create an organization first.');
  }

  const userRow = await (async () => {
    if (seedUserEmail) {
      const r = await db.query<Row<{ id: string; email: string; organization_id: string }>>(
        `SELECT id, email, organization_id FROM users WHERE email = $1 LIMIT 1`,
        [seedUserEmail]
      );
      if (r?.rows?.[0]?.id) return r.rows[0];
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
  const NOTEBOOK_COUNT = envInt('SEED_NOTEBOOK_PAGES', 20, 0, 200);
  const FOCUS_COUNT = envInt('SEED_FOCUS_ITEMS', 20, 0, 200);

  const purgeDecisions = envBool('SEED_PURGE_DECISIONS', false);
  const purgeAllMyWork = envBool('SEED_PURGE_ALL_MYWORK', false);
  const confirmPurge = String(process.env.SEED_PURGE_CONFIRM || '').trim().toUpperCase() === 'YES';

  if ((purgeDecisions || purgeAllMyWork) && !confirmPurge) {
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
        id, user_id,
        type, title, message, body,
        data, metadata,
        read, is_read, severity, priority, icon,
        entity_type, entity_id,
        actor_name, read_at,
        created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      ON CONFLICT (id) DO NOTHING`,
      [
        id,
        userId,
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
  // Seed notebook pages (T011)
  // -------------------------
  try {
    const notebookTopics = [
      'Governance i SLA',
      'Priorytety tygodnia',
      'AI Signals (learning loop)',
      'Cutover i deploy checklist',
      'CORS/CSRF hardening',
      'Observability: monitoring + alerting',
      'Role i uprawnienia (RBAC)',
      'Zależności i blokery',
      'Plan testów (smoke/e2e)',
      'Status dla sponsorów',
    ];

    for (let i = 0; i < NOTEBOOK_COUNT; i++) {
      const isProject = Boolean(projectId) && i % 2 === 0;
      const title = `DBR77: Notatka #${i + 1} — ${pick(notebookTopics, i)}`;
      const contentText = [
        `DBR77 / My Work V2 — ${pick(notebookTopics, i)}`,
        '',
        '- Co jest do zrobienia (next actions)',
        '- Ryzyka / blokery',
        '- Decyzje potrzebne',
      ].join('\n');
      const id = `seed_nb_${baseStamp}_${i}_${crypto.randomUUID()}`;
      const contentJson = JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: contentText }],
          },
        ],
      });
      await db.run(
        `INSERT INTO notebook_pages(
          id, owner_user_id, organization_id, project_id, visibility,
          title, content_json, content_text, tags_json, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (id) DO NOTHING`,
        [
          id,
          userId,
          orgId,
          isProject ? projectId : null,
          isProject ? 'project' : 'private',
          title,
          contentJson,
          contentText,
          JSON.stringify([
            'dbr77',
            'my-work',
            isProject ? 'project' : 'private',
            pick(['governance', 'execution', 'ai', 'sla'], i),
          ]),
          isoPlusDays(-Math.max(0, i % 40)),
          createdAt,
        ]
      );
    }
  } catch (e) {
    // Notebook may not be migrated in some environments; don't fail seeding tasks/decisions.
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
  logger.error('[seed-mywork-demo] Failed:', err?.message || err);
  process.exit(1);
});
