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

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
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
  for (let i = 0; i < 20; i++) {
    const id = `seed_task_${baseStamp}_${i}_${crypto.randomUUID()}`;
    const status = pick([...taskStatuses], i);
    const priority = pick([...priorities], i + 1);
    const stepPhase = pick([...phases], i + 2);
    const riskRating = pick([...risks], i + 3);

    const due =
      status === 'done'
        ? isoPlusDays(-Math.max(1, i % 10))
        : isoPlusDays(Math.max(1, (i % 14) - 3));
    const completedAt = status === 'done' ? isoPlusDays(-Math.max(1, i % 8)) : null;

    const tags = JSON.stringify(
      [
        priority === 'critical' ? 'p0' : priority === 'high' ? 'p1' : 'p2',
        status,
        stepPhase,
      ].filter(Boolean)
    );

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
        projectId,
        orgId,
        taskTitles[i],
        `Seeded demo task (${status}/${priority}).`,
        status,
        priority,
        userId,
        userId,
        due,
        (i % 6) + 1,
        tags,
        createdAt,
        createdAt,
        completedAt,
        i % 4 === 0 ? 'governance' : 'execution',
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
  const decisionStatuses = ['pending', 'approved', 'rejected', 'in_review'] as const;

  const decisionTitles = [
    'Approve automation scope v1',
    'Czy włączamy publiczne linki do raportów?',
    'Wybór modelu LLM dla produkcji',
    'Priorytet: stabilność vs nowe funkcje',
    'Decyzja o rollout do domeny publicznej',
    'Czy resetujemy embeddings po cutover?',
    'Zasady eskalacji dla zablokowanych zadań',
    'Wariant: staging environment na Railway',
    'Czy włączamy strict CSRF na wybranych endpointach?',
    'Polityka retencji logów i danych',
  ];

  const seededDecisionIds: string[] = [];
  for (let i = 0; i < 10; i++) {
    const id = `seed_decision_${baseStamp}_${i}_${crypto.randomUUID()}`;
    const status = pick([...decisionStatuses], i);
    const dtype = pick([...decisionTypes], i + 2);
    const deadline = isoPlusDays((i % 8) - 2);
    const decidedAt = status === 'approved' || status === 'rejected' ? isoPlusDays(-(i % 5)) : null;

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
        i < 6 ? seededTaskIds[i] : null,
        decisionTitles[i],
        `Seeded decision (${dtype}/${status}).`,
        dtype,
        userId,
        options,
        'Impact, effort, risk',
        deadline,
        isoPlusDays((i % 8) - 1),
        status,
        selectedOption,
        status === 'pending' ? null : 'Wybrano na podstawie ryzyk i wpływu na harmonogram.',
        decidedAt,
        userId,
        createdAt,
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

  for (let i = 0; i < notifTemplates.length; i++) {
    const n = notifTemplates[i];
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

  logger.info('[seed-mywork-demo] Done', {
    tasks: 20,
    decisions: 10,
    notifications: notifTemplates.length,
  });
}

main().catch((err) => {
  logger.error('[seed-mywork-demo] Failed:', err?.message || err);
  process.exit(1);
});
