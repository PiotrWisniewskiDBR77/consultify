/** @vitest-environment node */
/**
 * B-4 — karta zadania w Mojej Pracy: zakres DETALU musi byc taki sam jak zakres
 * LISTY i taki sam jak model wlasnosci kanonicznej bramki `/api/tasks/:id`.
 *
 * POMIAR ODBIORU (zywy staging `7e8668c7cc`, 11.09.2026): konto OWNER otwiera
 * wlasne, przez siebie zgloszone zadanie i dostaje nieskonczony kreciolek —
 * `GET /api/my-work/personal-tasks/:id` odpowiada 404 `TASK_NOT_FOUND`, a
 * kanoniczne `GET /api/tasks/:id` na tym samym rekordzie 200.
 *
 * KROK 0 (kopia `consultify_kopia_b14`, 11.09 22:47, konto
 * `james.whitfield@northwind.example`): lista `personal-tasks` = 200 z **8**
 * pozycjami, detal zadania `0512a736-…` (james = reporter + created_by, NIE
 * assignee) = **404**. Przyczyna: `buildPersonalTaskOwnerScope` pytal wylacznie
 * o `assignee_id`.
 *
 * PULAPKA (CLAUDE.md): atrapa bazy `server/src/database/Database.ts:686`
 * zwraca `changes: 1` dla KAZDEGO UPDATE niezaleznie od WHERE — dlatego ten
 * plik dziala WYLACZNIE na realnym Postgresie (`RUN_DB_TESTS=1 MOCK_DB=false
 * DB_TYPE=postgres DATABASE_URL=postgres://...`), a kazde twierdzenie o
 * odmowie czyta stan WIERSZA po zadaniu.
 *
 * MUTACJA: zwezenie `buildPersonalTaskOwnerScope` z powrotem do
 * `assignee_id = ?` czerwieni przypadki „zglaszajacy"/„tworca"/„wlasciciel"
 * (404 zamiast 200) oraz liste.
 */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import config from '../../config/Config.js';
import myWorkRoutes from '../my-work.routes.js';

const databaseUrl = process.env.DATABASE_URL || '';
const realDb =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  databaseUrl.startsWith('postgres');

describe.skipIf(!realDb).sequential('B-4 — zakres „moje zadanie" w Mojej Pracy', () => {
  const przyrostek = randomUUID().slice(0, 8);
  const org = `b4-org-${przyrostek}`;
  const projekt = `b4-proj-${przyrostek}`;
  const wlascicielOrg = `b4-owner-${przyrostek}`;
  const wykonawca = `b4-wykonawca-${przyrostek}`;
  const obcy = `b4-obcy-${przyrostek}`;
  // Konto BEZ zadnego z czterech zwiazkow z mierzonymi zadaniami — kontrola,
  // ze naprawa nie otworzyla Mojej Pracy na cudze rekordy w tej samej organizacji.
  const niepowiazany = `b4-niepowiazany-${przyrostek}`;

  // Cztery zwiazki z zadaniem, kazdy osobno — zeby czerwienil sie dokladnie ten
  // skladnik modelu wlasnosci, ktory ktos usunie.
  const zadanieWykonawca = `b4-task-assignee-${przyrostek}`;
  const zadanieZglaszajacy = `b4-task-reporter-${przyrostek}`;
  const zadanieTworca = `b4-task-creator-${przyrostek}`;
  const zadanieWlasciciel = `b4-task-owner-${przyrostek}`;
  const zadanieCudze = `b4-task-cudze-${przyrostek}`;

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

  const wiersz = async (taskId: string) => {
    const { rows } = await pool.query('SELECT id, title FROM tasks WHERE id = $1', [taskId]);
    return rows[0] ?? null;
  };

  beforeAll(async () => {
    if (!realDb) throw new Error('wymagany realny PostgreSQL');
    process.env.DB_TYPE = 'postgres';
    pool = new Pool({ connectionString: databaseUrl });

    await pool.query('INSERT INTO organizations(id,name) VALUES($1,$2)', [org, 'B4 my work']);
    await pool.query('INSERT INTO projects(id,organization_id,name) VALUES($1,$2,$3)', [
      projekt,
      org,
      'B4 my work project',
    ]);

    for (const [id, rola] of [
      [wlascicielOrg, 'OWNER'],
      [wykonawca, 'MEMBER'],
      [obcy, 'MEMBER'],
      [niepowiazany, 'MEMBER'],
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

    // [id, assignee, reporter, created_by, owner]
    const zadania: Array<[string, string, string | null, string | null, string | null, string]> = [
      [zadanieWykonawca, wlascicielOrg, obcy, obcy, obcy, 'jestem wykonawca'],
      [zadanieZglaszajacy, wykonawca, wlascicielOrg, obcy, obcy, 'jestem zglaszajacym'],
      [zadanieTworca, wykonawca, obcy, wlascicielOrg, obcy, 'jestem tworca'],
      [zadanieWlasciciel, wykonawca, obcy, obcy, wlascicielOrg, 'jestem wlascicielem'],
      [zadanieCudze, wykonawca, obcy, obcy, obcy, 'cudze pod kazdym wzgledem'],
    ];
    for (const [id, a, r, c, o, tytul] of zadania) {
      await pool.query(
        `INSERT INTO tasks(id,organization_id,project_id,title,status,task_type,assignee_id,reporter_id,created_by,owner_id)
         VALUES($1,$2,$3,$4,'todo','personal',$5,$6,$7,$8)`,
        [id, org, projekt, tytul, a, r, c, o]
      );
    }

    app = express();
    app.use(express.json());
    app.use('/api/my-work', myWorkRoutes);
  }, 60_000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query('DELETE FROM tasks WHERE organization_id = $1', [org]);
    await pool.query('DELETE FROM organization_members WHERE organization_id = $1', [org]);
    await pool.query('DELETE FROM users WHERE organization_id = $1', [org]);
    await pool.query('DELETE FROM projects WHERE organization_id = $1', [org]);
    await pool.query('DELETE FROM organizations WHERE id = $1', [org]);
    await pool.end();
  }, 60_000);

  it('B-4: OWNER-zglaszajacy otwiera zadanie, ktorego NIE jest wykonawca -> 200', async () => {
    const odp = await request(app)
      .get(`/api/my-work/personal-tasks/${zadanieZglaszajacy}`)
      .set('Authorization', `Bearer ${token(wlascicielOrg, 'OWNER')}`);

    // eslint-disable-next-line no-console
    console.log('[POMIAR B-4 detal zglaszajacy]', odp.status, JSON.stringify(odp.body).slice(0, 160));
    expect(odp.status).toBe(200);
    expect(odp.body.id).toBe(zadanieZglaszajacy);
  }, 30_000);

  it('B-4: TWORCA (created_by) otwiera zadanie, ktorego nie jest wykonawca -> 200', async () => {
    const odp = await request(app)
      .get(`/api/my-work/personal-tasks/${zadanieTworca}`)
      .set('Authorization', `Bearer ${token(wlascicielOrg, 'OWNER')}`);

    expect(odp.status).toBe(200);
    expect(odp.body.id).toBe(zadanieTworca);
  }, 30_000);

  it('B-4: WLASCICIEL (owner_id) otwiera zadanie, ktorego nie jest wykonawca -> 200', async () => {
    const odp = await request(app)
      .get(`/api/my-work/personal-tasks/${zadanieWlasciciel}`)
      .set('Authorization', `Bearer ${token(wlascicielOrg, 'OWNER')}`);

    expect(odp.status).toBe(200);
    expect(odp.body.id).toBe(zadanieWlasciciel);
  }, 30_000);

  it('B-4: WYKONAWCA nadal otwiera swoje zadanie -> 200 (nie zabralismy dotychczasowego zakresu)', async () => {
    const odp = await request(app)
      .get(`/api/my-work/personal-tasks/${zadanieWykonawca}`)
      .set('Authorization', `Bearer ${token(wlascicielOrg, 'OWNER')}`);

    expect(odp.status).toBe(200);
    expect(odp.body.id).toBe(zadanieWykonawca);
  }, 30_000);

  it('B-4: MEMBER bez zadnego zwiazku z zadaniem -> 404 (zakres sie NIE rozszerzyl na cudze)', async () => {
    const odp = await request(app)
      .get(`/api/my-work/personal-tasks/${zadanieCudze}`)
      .set('Authorization', `Bearer ${token(niepowiazany, 'MEMBER')}`);

    // eslint-disable-next-line no-console
    console.log('[POMIAR B-4 detal obcy]', odp.status, JSON.stringify(odp.body).slice(0, 160));
    expect(odp.status).toBe(404);
    expect(odp.body.code).toBe('TASK_NOT_FOUND');
  }, 30_000);

  it('B-4: LISTA i DETAL maja ten sam zakres — lista zwraca wszystkie cztery zwiazki, nie zwraca cudzego', async () => {
    const odp = await request(app)
      .get('/api/my-work/personal-tasks?includeDone=true&limit=500')
      .set('Authorization', `Bearer ${token(wlascicielOrg, 'OWNER')}`);

    expect(odp.status).toBe(200);
    const idki = (Array.isArray(odp.body) ? odp.body : []).map((w: { id: string }) => w.id);
    // eslint-disable-next-line no-console
    console.log('[POMIAR B-4 lista]', odp.status, 'pozycji=', idki.length);
    expect(idki).toContain(zadanieWykonawca);
    expect(idki).toContain(zadanieZglaszajacy);
    expect(idki).toContain(zadanieTworca);
    expect(idki).toContain(zadanieWlasciciel);
    expect(idki).not.toContain(zadanieCudze);
  }, 30_000);

  it('B-4: ZAPIS ma ten sam zakres co odczyt — zglaszajacy zapisuje tytul (200, wiersz zmieniony)', async () => {
    const przed = await wiersz(zadanieZglaszajacy);
    const detal = await request(app)
      .get(`/api/my-work/personal-tasks/${zadanieZglaszajacy}`)
      .set('Authorization', `Bearer ${token(wlascicielOrg, 'OWNER')}`);

    const odp = await request(app)
      .put(`/api/my-work/personal-tasks/${zadanieZglaszajacy}`)
      .set('Authorization', `Bearer ${token(wlascicielOrg, 'OWNER')}`)
      .send({ title: 'zapis zglaszajacego', expectedVersionToken: detal.body.versionToken });

    const po = await wiersz(zadanieZglaszajacy);
    // eslint-disable-next-line no-console
    console.log('[POMIAR B-4 PUT zglaszajacy]', odp.status, { przed: przed?.title, po: po?.title });
    expect(odp.status).toBe(200);
    expect(po?.title).toBe('zapis zglaszajacego');
  }, 30_000);

  it('B-4: ZAPIS obcego na cudzym zadaniu -> 404, tytul w bazie bez zmian', async () => {
    const przed = await wiersz(zadanieCudze);

    const odp = await request(app)
      .put(`/api/my-work/personal-tasks/${zadanieCudze}`)
      .set('Authorization', `Bearer ${token(niepowiazany, 'MEMBER')}`)
      .send({ title: 'WLAM', expectedVersionToken: 'dowolny' });

    const po = await wiersz(zadanieCudze);
    // eslint-disable-next-line no-console
    console.log('[POMIAR B-4 PUT obcy]', odp.status, { przed: przed?.title, po: po?.title });
    expect(odp.status).toBe(404);
    expect(po?.title).toBe(przed?.title);
  }, 30_000);
});
