/** @vitest-environment node */
/**
 * E2 — BEZPIECZENSTWO: czlonek organizacji edytuje CUDZE zadanie.
 *
 * Pomiar przed naprawa (2026-09-10, kopia `consultify_kopia_e2`, dwa konta
 * jednej organizacji): `PUT /api/tasks/<cudze>` = HTTP 200 i nadpisany tytul w
 * bazie — zarowno w trybie `shadow`, jak i przy `CAPABILITY_ENFORCE=enforce`.
 * Przyczyna: `hasEffectiveCapability` uznawal sufiks `.assigned` za spelnienie
 * `task.update` BEZ pytania, czy zadanie nalezy do wolajacego.
 *
 * PULAPKA (CLAUDE.md): atrapa bazy `server/src/database/Database.ts:686`
 * zwraca `changes: 1` dla KAZDEGO UPDATE niezaleznie od WHERE. Dlatego ten
 * plik dziala WYLACZNIE na realnym Postgresie (`RUN_DB_TESTS=1 MOCK_DB=false
 * DB_TYPE=postgres DATABASE_URL=postgres://...`); bez tego `describe.skipIf`
 * pomija go zamiast klamac na zielono.
 */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import config from '../../server/src/config/Config.js';
import TaskController from '../../server/src/controllers/TaskController.js';
import tasksRouter from '../../server/src/routes/pmo/tasks.routes.js';

const databaseUrl = process.env.DATABASE_URL || '';
const realDb =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  databaseUrl.startsWith('postgres');

describe.skipIf(!realDb).sequential('E2 — zakres obiektowy zdolnosci task.update', () => {
  const przyrostek = randomUUID().slice(0, 8);
  const org = `e2-org-${przyrostek}`;
  const projekt = `e2-proj-${przyrostek}`;
  const czlonekA = `e2-member-a-${przyrostek}`;
  const czlonekB = `e2-member-b-${przyrostek}`;
  const administrator = `e2-admin-${przyrostek}`;
  const zadanieA = `e2-task-a-${przyrostek}`;
  const zadanieB = `e2-task-b-${przyrostek}`;

  let pool: Pool;
  let app: Express;

  const token = (id: string, role: string) =>
    jwt.sign(
      {
        id,
        email: `${id}@test.invalid`,
        organizationId: org,
        organization_id: org,
        role,
      },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    );

  const tytul = async (taskId: string): Promise<string | null> => {
    const { rows } = await pool.query('SELECT title FROM tasks WHERE id = $1', [taskId]);
    return rows[0]?.title ?? null;
  };

  beforeAll(async () => {
    if (!realDb) throw new Error('wymagany realny PostgreSQL');
    process.env.DB_TYPE = 'postgres';
    pool = new Pool({ connectionString: databaseUrl });

    await pool.query('INSERT INTO organizations(id,name) VALUES($1,$2)', [org, 'E2 ownership']);
    await pool.query('INSERT INTO projects(id,organization_id,name) VALUES($1,$2,$3)', [
      projekt,
      org,
      'E2 ownership project',
    ]);

    for (const [id, rola] of [
      [czlonekA, 'MEMBER'],
      [czlonekB, 'MEMBER'],
      [administrator, 'ADMIN'],
    ] as const) {
      await pool.query(
        `INSERT INTO users(id,organization_id,email,password,role,status)
         VALUES($1,$2,$3,'unused',$4,'active')`,
        [id, org, `${id}@test.invalid`, rola]
      );
      await pool.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status)
         VALUES($1,$2,$3,$4,'ACTIVE')`,
        [randomUUID(), org, id, rola]
      );
    }

    // S12-B: `TaskAssignmentService.assignTask` wymaga, zeby przypisywany byl
    // czlonkiem projektu (inaczej rzuca i trasa konczy sie 500 dla KAZDEGO,
    // takze wlasciciela) — bez tych wierszy pomiar STOP-4 mierzylby brak
    // fikstury, nie uprawnienia.
    for (const id of [czlonekA, czlonekB, administrator] as const) {
      await pool.query(
        `INSERT INTO project_members(id,project_id,user_id,project_role)
         VALUES($1,$2,$3,'TASK_ASSIGNEE')`,
        [randomUUID(), projekt, id]
      );
    }

    for (const [id, wlasciciel, nazwa] of [
      [zadanieA, czlonekA, 'zadanie czlonka A'],
      [zadanieB, czlonekB, 'zadanie czlonka B'],
    ] as const) {
      await pool.query(
        `INSERT INTO tasks(id,organization_id,project_id,title,status,assignee_id,owner_id,created_by)
         VALUES($1,$2,$3,$4,'todo',$5,$5,$5)`,
        [id, org, projekt, nazwa, wlasciciel]
      );
    }

    app = express();
    app.use(express.json());
    app.use('/api/tasks', tasksRouter);
  }, 60_000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query('DELETE FROM tasks WHERE organization_id = $1', [org]);
    await pool.query('DELETE FROM project_members WHERE project_id = $1', [projekt]);
    await pool.query('DELETE FROM organization_members WHERE organization_id = $1', [org]);
    await pool.query('DELETE FROM users WHERE organization_id = $1', [org]);
    await pool.query('DELETE FROM project_role_templates WHERE organization_id = $1', [org]);
    await pool.query('DELETE FROM projects WHERE organization_id = $1', [org]);
    await pool.query('DELETE FROM organizations WHERE id = $1', [org]);
    await pool.end();
  }, 60_000);

  it('MEMBER edytuje WLASNE zadanie -> 200 i tytul zmieniony w bazie', async () => {
    const odp = await request(app)
      .put(`/api/tasks/${zadanieA}`)
      .set('Authorization', `Bearer ${token(czlonekA, 'MEMBER')}`)
      .send({ title: 'wlasne po edycji' });

    expect(odp.status).toBe(200);
    await expect(tytul(zadanieA)).resolves.toBe('wlasne po edycji');
  }, 30_000);

  it('MEMBER edytuje CUDZE zadanie -> 403 z kodem zakresu obiektowego, baza nietknieta', async () => {
    const przed = await tytul(zadanieB);

    const odp = await request(app)
      .put(`/api/tasks/${zadanieB}`)
      .set('Authorization', `Bearer ${token(czlonekA, 'MEMBER')}`)
      .send({ title: 'WLAM' });

    expect(odp.status).toBe(403);
    expect(odp.body.code).toBe('CAPABILITY_OBJECT_OWNERSHIP_REQUIRED');
    expect(odp.body.required).toBe('task.update');
    // Klucz: stan BAZY, nie sam kod. Atrapa bazy potrafi zwrocic changes:1
    // dla UPDATE, ktory nic nie zmienil — dlatego czytamy tytul z Postgresa.
    await expect(tytul(zadanieB)).resolves.toBe(przed);
  }, 30_000);

  it('ADMIN edytuje CUDZE zadanie -> 200 (nie zablokowalismy administracji)', async () => {
    const odp = await request(app)
      .put(`/api/tasks/${zadanieB}`)
      .set('Authorization', `Bearer ${token(administrator, 'ADMIN')}`)
      .send({ title: 'admin po edycji' });

    expect(odp.status).toBe(200);
    await expect(tytul(zadanieB)).resolves.toBe('admin po edycji');
  }, 30_000);

  it('MEMBER usuwa CUDZE zadanie -> 403, zadanie nadal w bazie', async () => {
    const odp = await request(app)
      .delete(`/api/tasks/${zadanieB}`)
      .set('Authorization', `Bearer ${token(czlonekA, 'MEMBER')}`);

    expect(odp.status).toBe(403);
    expect(String(odp.body.code || '')).toMatch(/^CAPABILITY_/);
    await expect(tytul(zadanieB)).resolves.not.toBeNull();
  }, 30_000);
  it('MEMBER blokuje CUDZE zadanie (POST /:id/block) -> 403, status w bazie bez zmian', async () => {
    const { rows: przed } = await pool.query('SELECT status FROM tasks WHERE id = $1', [zadanieB]);

    const odp = await request(app)
      .post(`/api/tasks/${zadanieB}/block`)
      .set('Authorization', `Bearer ${token(czlonekA, 'MEMBER')}`)
      .send({ reason: 'proba blokady cudzego zadania' });

    expect(odp.status).toBe(403);
    expect(odp.body.code).toBe('CAPABILITY_OBJECT_OWNERSHIP_REQUIRED');
    const { rows: po } = await pool.query('SELECT status FROM tasks WHERE id = $1', [zadanieB]);
    expect(po[0]?.status).toBe(przed[0]?.status);
  }, 30_000);

  it('MEMBER zdejmuje przypisanie z CUDZEGO zadania -> 403, assignee_id w bazie bez zmian', async () => {
    const { rows: przed } = await pool.query('SELECT assignee_id FROM tasks WHERE id = $1', [
      zadanieB,
    ]);

    const odp = await request(app)
      .post(`/api/tasks/${zadanieB}/unassign`)
      .set('Authorization', `Bearer ${token(czlonekA, 'MEMBER')}`)
      .send({});

    expect(odp.status).toBe(403);
    expect(odp.body.code).toBe('CAPABILITY_OBJECT_OWNERSHIP_REQUIRED');
    const { rows: po } = await pool.query('SELECT assignee_id FROM tasks WHERE id = $1', [zadanieB]);
    expect(po[0]?.assignee_id).toBe(przed[0]?.assignee_id);
    expect(po[0]?.assignee_id).toBe(czlonekB);
  }, 30_000);

  it('MEMBER blokuje WLASNE zadanie -> 200 (rodzenstwo nie zablokowalo wlasnej pracy)', async () => {
    const odp = await request(app)
      .post(`/api/tasks/${zadanieA}/block`)
      .set('Authorization', `Bearer ${token(czlonekA, 'MEMBER')}`)
      .send({ reason: 'blokada wlasnego zadania' });

    expect(odp.status).toBe(200);
  }, 30_000);
  // ==========================================================================
  // S12-B — domkniecie STOP-3 i STOP-4 z paczki E2 (11.09,
  // kopia `consultify_kopia_s12b`).
  // ==========================================================================

  it('STOP-4: MEMBER przepina CUDZE zadanie na siebie (POST /:id/assign) -> 403, assignee_id bez zmian', async () => {
    const { rows: przed } = await pool.query('SELECT assignee_id FROM tasks WHERE id = $1', [
      zadanieB,
    ]);

    const odp = await request(app)
      .post(`/api/tasks/${zadanieB}/assign`)
      .set('Authorization', `Bearer ${token(czlonekA, 'MEMBER')}`)
      .send({ assigneeId: czlonekA });

    const { rows: po } = await pool.query('SELECT assignee_id FROM tasks WHERE id = $1', [zadanieB]);
    // eslint-disable-next-line no-console
    console.log('[POMIAR STOP-4 assign cudze]', odp.status, JSON.stringify(odp.body).slice(0, 160), {
      przed: przed[0]?.assignee_id,
      po: po[0]?.assignee_id,
    });

    expect(odp.status).toBe(403);
    expect(odp.body.code).toBe('CAPABILITY_OBJECT_OWNERSHIP_REQUIRED');
    // Stan BAZY, nie `changes` (atrapa bazy klamie o zapisie).
    expect(po[0]?.assignee_id).toBe(przed[0]?.assignee_id);
    expect(po[0]?.assignee_id).toBe(czlonekB);
  }, 30_000);

  it('STOP-4: MEMBER przepina CUDZE zadanie na kogos innego (POST /:id/reassign) -> 403, assignee_id bez zmian', async () => {
    const { rows: przed } = await pool.query('SELECT assignee_id FROM tasks WHERE id = $1', [
      zadanieB,
    ]);

    const odp = await request(app)
      .post(`/api/tasks/${zadanieB}/reassign`)
      .set('Authorization', `Bearer ${token(czlonekA, 'MEMBER')}`)
      .send({ fromAssigneeId: czlonekB, toAssigneeId: czlonekA, reason: 'proba przepiecia' });

    const { rows: po } = await pool.query('SELECT assignee_id FROM tasks WHERE id = $1', [zadanieB]);
    // eslint-disable-next-line no-console
    console.log(
      '[POMIAR STOP-4 reassign cudze]',
      odp.status,
      JSON.stringify(odp.body).slice(0, 160),
      { przed: przed[0]?.assignee_id, po: po[0]?.assignee_id }
    );

    expect(odp.status).toBe(403);
    expect(odp.body.code).toBe('CAPABILITY_OBJECT_OWNERSHIP_REQUIRED');
    expect(po[0]?.assignee_id).toBe(przed[0]?.assignee_id);
  }, 30_000);

  it('STOP-4: MEMBER przepina WLASNE zadanie -> 200 (nie zablokowalismy wlasnej pracy)', async () => {
    const odp = await request(app)
      .post(`/api/tasks/${zadanieA}/assign`)
      .set('Authorization', `Bearer ${token(czlonekA, 'MEMBER')}`)
      .send({ assigneeId: czlonekA });

    // eslint-disable-next-line no-console
    console.log('[POMIAR STOP-4 assign wlasne]', odp.status, JSON.stringify(odp.body).slice(0, 160));
    expect(odp.status).toBe(200);
  }, 30_000);

  it('STOP-4: ADMIN przepina CUDZE zadanie -> 200 i assignee_id zmienione w bazie', async () => {
    const odp = await request(app)
      .post(`/api/tasks/${zadanieB}/assign`)
      .set('Authorization', `Bearer ${token(administrator, 'ADMIN')}`)
      .send({ assigneeId: administrator });

    const { rows: po } = await pool.query('SELECT assignee_id FROM tasks WHERE id = $1', [zadanieB]);
    // eslint-disable-next-line no-console
    console.log('[POMIAR STOP-4 assign admin]', odp.status, { po: po[0]?.assignee_id });
    expect(odp.status).toBe(200);
    expect(po[0]?.assignee_id).toBe(administrator);
  }, 30_000);

  it('STOP-3: kontroler DELETE broni sie SAM (rola znormalizowana), niezaleznie od bramki', async () => {
    // Pomiar 11.09: `TaskController.deleteTask` sprawdzal `req.user?.role ===
    // 'team_member'` — literal, ktorego ZADNA dzisiejsza rola nie ma
    // ('MEMBER'/'ADMIN'/'OWNER'). Kontroler bronil wiec NIKOGO; cala obrona
    // stala na bramce z E2. Tu wolamy sam kontroler (bez bramki), zeby druga
    // linia obrony byla zmierzona, a nie zalozona.
    const osobnaApp = express();
    osobnaApp.use(express.json());
    osobnaApp.delete(
      '/tylko-kontroler/:id',
      (req, _res, next) => {
        (req as unknown as { user: unknown }).user = {
          id: czlonekA,
          organizationId: org,
          role: 'MEMBER',
        };
        next();
      },
      TaskController.deleteTask
    );

    const odp = await request(osobnaApp).delete(`/tylko-kontroler/${zadanieB}`);
    // eslint-disable-next-line no-console
    console.log('[POMIAR STOP-3 sam kontroler]', odp.status, JSON.stringify(odp.body).slice(0, 160));

    expect(odp.status).toBe(403);
    await expect(tytul(zadanieB)).resolves.not.toBeNull();
  }, 30_000);

  it('STOP-3: ADMIN usuwa CUDZE zadanie -> 200 i zadania nie ma w bazie', async () => {
    const odp = await request(app)
      .delete(`/api/tasks/${zadanieB}`)
      .set('Authorization', `Bearer ${token(administrator, 'ADMIN')}`);

    // eslint-disable-next-line no-console
    console.log('[POMIAR STOP-3 admin delete]', odp.status, JSON.stringify(odp.body).slice(0, 160));
    expect(odp.status).toBe(200);
    await expect(tytul(zadanieB)).resolves.toBeNull();
  }, 30_000);
});
