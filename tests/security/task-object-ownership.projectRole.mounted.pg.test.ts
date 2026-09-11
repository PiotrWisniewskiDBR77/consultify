/** @vitest-environment node */
/**
 * B-1/B-2/B-3 — BEZPIECZENSTWO: rola PROJEKTOWA z sufiksem `.scoped` omija
 * predykat wlasnosci obiektu.
 *
 * POMIAR ODBIORU (zywy staging `7e8668c7cc`, 11.09.2026 21:09-21:52): MEMBER
 * `daniel.osei` z rola projektowa INITIATIVE_OWNER dostawal **200** na
 * `PUT /api/tasks/<cudze>`, `POST /api/tasks/<cudze>/assign` i
 * `POST /api/tasks/<cudze>/block`, a wiersze w bazie realnie sie zmienialy.
 *
 * PRZYCZYNA: `effectiveAccessService.matchEffectiveCapability` klasyfikowal
 * sufiks `.scoped` jako `kind: 'allow'`, wiec `evaluateEffectiveCapability`
 * wychodzilo z decyzja POZYTYWNA zanim `ownerPredicate` zostal w ogole
 * zapytany. `.assigned`/`.own`/`.delegated` szly gala zia `ownership` i tam
 * predykat dziala — dlatego dowod E2/S12-B (rola TASK_ASSIGNEE, sufiks
 * `.assigned`) byl zielony przy otwartej dziurze („probka zamiast zbioru").
 *
 * Ten plik mierzy DRUGA rodzine sufiksow — role projektowe niosace
 * `task.*.scoped` (INITIATIVE_OWNER, WORKSTREAM_OWNER) — oraz kontrole
 * pozytywne (wlasne zadanie, ADMIN, OWNER) i role bez zdolnosci task.*
 * (PROJECT_SPONSOR).
 *
 * PULAPKA (CLAUDE.md): atrapa bazy `server/src/database/Database.ts:686`
 * zwraca `changes: 1` dla KAZDEGO UPDATE niezaleznie od WHERE. Dlatego ten
 * plik dziala WYLACZNIE na realnym Postgresie (`RUN_DB_TESTS=1 MOCK_DB=false
 * DB_TYPE=postgres DATABASE_URL=postgres://...`); bez tego `describe.skipIf`
 * pomija go zamiast klamac na zielono. Kazde twierdzenie o odmowie czyta stan
 * WIERSZA po zadaniu, nie sam kod HTTP.
 */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import config from '../../server/src/config/Config.js';
import tasksRouter from '../../server/src/routes/pmo/tasks.routes.js';

const databaseUrl = process.env.DATABASE_URL || '';
const realDb =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  databaseUrl.startsWith('postgres');

describe
  .skipIf(!realDb)
  .sequential('B-1/B-2/B-3 — rola projektowa `.scoped` vs wlasnosc obiektu', () => {
    const przyrostek = randomUUID().slice(0, 8);
    const org = `b13-org-${przyrostek}`;
    const projekt = `b13-proj-${przyrostek}`;
    // MEMBER z rola projektowa INITIATIVE_OWNER = odpowiednik daniela z odbioru.
    const inicjator = `b13-initiative-owner-${przyrostek}`;
    // MEMBER z rola projektowa PROJECT_SPONSOR (szablon BEZ zdolnosci task.*).
    const sponsor = `b13-sponsor-${przyrostek}`;
    // Wlasciciel mierzonych zadan (assignee + owner + created_by + reporter).
    const obcy = `b13-obcy-${przyrostek}`;
    const administrator = `b13-admin-${przyrostek}`;
    const wlascicielOrg = `b13-owner-${przyrostek}`;

    const zadanieObce = `b13-task-obce-${przyrostek}`;
    const zadanieObceBlok = `b13-task-obce-blok-${przyrostek}`;
    const zadanieObceDel = `b13-task-obce-del-${przyrostek}`;
    const zadanieObceRe = `b13-task-obce-re-${przyrostek}`;
    const zadanieWlasne = `b13-task-wlasne-${przyrostek}`;

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
      const { rows } = await pool.query(
        'SELECT title, status, assignee_id FROM tasks WHERE id = $1',
        [taskId]
      );
      return rows[0] ?? null;
    };

    beforeAll(async () => {
      if (!realDb) throw new Error('wymagany realny PostgreSQL');
      process.env.DB_TYPE = 'postgres';
      pool = new Pool({ connectionString: databaseUrl });

      await pool.query('INSERT INTO organizations(id,name) VALUES($1,$2)', [org, 'B13 scoped']);
      await pool.query('INSERT INTO projects(id,organization_id,name) VALUES($1,$2,$3)', [
        projekt,
        org,
        'B13 scoped project',
      ]);

      for (const [id, rola] of [
        [inicjator, 'MEMBER'],
        [sponsor, 'MEMBER'],
        [obcy, 'MEMBER'],
        [administrator, 'ADMIN'],
        [wlascicielOrg, 'OWNER'],
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

      // Rola projektowa decyduje o szablonie zdolnosci (`readTemplateCapabilities`).
      // `assignTask` wymaga, zeby przypisywany byl czlonkiem projektu — bez tych
      // wierszy pomiar mierzylby brak fikstury, nie uprawnienia.
      for (const [id, rolaProjektowa] of [
        [inicjator, 'INITIATIVE_OWNER'],
        [sponsor, 'PROJECT_SPONSOR'],
        [obcy, 'TASK_ASSIGNEE'],
        [administrator, 'PROJECT_LEADER'],
        [wlascicielOrg, 'PROJECT_LEADER'],
      ] as const) {
        await pool.query(
          `INSERT INTO project_members(id,project_id,user_id,project_role)
           VALUES($1,$2,$3,$4)`,
          [randomUUID(), projekt, id, rolaProjektowa]
        );
      }

      for (const [id, wlasciciel, nazwa] of [
        [zadanieObce, obcy, 'zadanie obcego'],
        [zadanieObceBlok, obcy, 'zadanie obcego do blokady'],
        [zadanieObceDel, obcy, 'zadanie obcego do usuniecia'],
        [zadanieObceRe, obcy, 'zadanie obcego do przepiecia'],
        [zadanieWlasne, inicjator, 'zadanie inicjatora'],
      ] as const) {
        await pool.query(
          `INSERT INTO tasks(id,organization_id,project_id,title,status,assignee_id,owner_id,created_by,reporter_id)
           VALUES($1,$2,$3,$4,'todo',$5,$5,$5,$5)`,
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

    // ======================================================================
    // B-1 — PUT /api/tasks/:id  (zdolnosc `task.update.scoped`)
    // ======================================================================
    it('B-1: INITIATIVE_OWNER edytuje CUDZE zadanie -> 403 CAPABILITY_OBJECT_OWNERSHIP_REQUIRED, tytul w bazie bez zmian', async () => {
      const przed = await wiersz(zadanieObce);

      const odp = await request(app)
        .put(`/api/tasks/${zadanieObce}`)
        .set('Authorization', `Bearer ${token(inicjator, 'MEMBER')}`)
        .send({ title: 'B-1 PROBA MEMBER .scoped' });

      const po = await wiersz(zadanieObce);
      // eslint-disable-next-line no-console
      console.log('[POMIAR B-1 PUT cudze]', odp.status, JSON.stringify(odp.body).slice(0, 200), {
        przed: przed?.title,
        po: po?.title,
      });

      expect(odp.status).toBe(403);
      expect(odp.body.code).toBe('CAPABILITY_OBJECT_OWNERSHIP_REQUIRED');
      expect(odp.body.required).toBe('task.update');
      expect(po?.title).toBe(przed?.title);
    }, 30_000);

    // ======================================================================
    // B-2 — POST /api/tasks/:id/assign  (zdolnosc `task.assign.scoped`)
    // ======================================================================
    it('B-2: INITIATIVE_OWNER przepina CUDZE zadanie na siebie -> 403, assignee_id w bazie bez zmian', async () => {
      const przed = await wiersz(zadanieObce);

      const odp = await request(app)
        .post(`/api/tasks/${zadanieObce}/assign`)
        .set('Authorization', `Bearer ${token(inicjator, 'MEMBER')}`)
        .send({ assigneeId: inicjator });

      const po = await wiersz(zadanieObce);
      // eslint-disable-next-line no-console
      console.log('[POMIAR B-2 assign cudze]', odp.status, JSON.stringify(odp.body).slice(0, 200), {
        przed: przed?.assignee_id,
        po: po?.assignee_id,
      });

      expect(odp.status).toBe(403);
      expect(odp.body.code).toBe('CAPABILITY_OBJECT_OWNERSHIP_REQUIRED');
      expect(po?.assignee_id).toBe(przed?.assignee_id);
      expect(po?.assignee_id).toBe(obcy);
    }, 30_000);

    // ======================================================================
    // B-3 — POST /api/tasks/:id/block  (zdolnosc `task.status.update.scoped`)
    // ======================================================================
    it('B-3: INITIATIVE_OWNER blokuje CUDZE zadanie -> 403, status w bazie bez zmian', async () => {
      const przed = await wiersz(zadanieObceBlok);

      const odp = await request(app)
        .post(`/api/tasks/${zadanieObceBlok}/block`)
        .set('Authorization', `Bearer ${token(inicjator, 'MEMBER')}`)
        .send({ reason: 'B-3 proba blokady cudzego zadania' });

      const po = await wiersz(zadanieObceBlok);
      // eslint-disable-next-line no-console
      console.log('[POMIAR B-3 block cudze]', odp.status, JSON.stringify(odp.body).slice(0, 200), {
        przed: przed?.status,
        po: po?.status,
      });

      expect(odp.status).toBe(403);
      expect(odp.body.code).toBe('CAPABILITY_OBJECT_OWNERSHIP_REQUIRED');
      expect(po?.status).toBe(przed?.status);
      expect(po?.status).toBe('todo');
    }, 30_000);

    // ======================================================================
    // Rodzenstwo: reassign (`task.reassign` — POZA szablonem) i DELETE
    // (`task.delete.scoped` — W szablonie, wiec ta sama rodzina co B-1..B-3).
    // ======================================================================
    // OSOBNE zadanie CELOWO: gdyby ta proba szla na `zadanieObce`, mierzylaby
    // skutek B-2 (po udanym `assign` wolajacy JEST wykonawca, wiec predykat
    // slusznie mowi „tak") — dokladnie ta pulapka, ktora odbiorca zlapal
    // i sprostowal w §4 („dziur sa trzy, nie cztery").
    it('rodzenstwo: INITIATIVE_OWNER przepina CUDZE zadanie przez /reassign -> 403, assignee_id bez zmian', async () => {
      const przed = await wiersz(zadanieObceRe);

      const odp = await request(app)
        .post(`/api/tasks/${zadanieObceRe}/reassign`)
        .set('Authorization', `Bearer ${token(inicjator, 'MEMBER')}`)
        .send({ fromAssigneeId: obcy, toAssigneeId: inicjator, reason: 'proba przepiecia' });

      const po = await wiersz(zadanieObceRe);
      // eslint-disable-next-line no-console
      console.log('[POMIAR reassign cudze]', odp.status, JSON.stringify(odp.body).slice(0, 200), {
        przed: przed?.assignee_id,
        po: po?.assignee_id,
      });

      expect(odp.status).toBe(403);
      expect(po?.assignee_id).toBe(przed?.assignee_id);
    }, 30_000);

    it('rodzenstwo: INITIATIVE_OWNER usuwa CUDZE zadanie -> 403, wiersz nadal w bazie', async () => {
      const odp = await request(app)
        .delete(`/api/tasks/${zadanieObceDel}`)
        .set('Authorization', `Bearer ${token(inicjator, 'MEMBER')}`);

      const po = await wiersz(zadanieObceDel);
      // eslint-disable-next-line no-console
      console.log('[POMIAR DELETE cudze]', odp.status, JSON.stringify(odp.body).slice(0, 200), {
        po: po?.title,
      });

      expect(odp.status).toBe(403);
      expect(odp.body.code).toBe('CAPABILITY_OBJECT_OWNERSHIP_REQUIRED');
      expect(po).not.toBeNull();
    }, 30_000);

    // ======================================================================
    // KONTROLE POZYTYWNE — naprawa nie moze zabrac praw uprawnionym.
    // ======================================================================
    it('kontrola: INITIATIVE_OWNER edytuje WLASNE zadanie -> 200 i tytul zmieniony w bazie', async () => {
      const odp = await request(app)
        .put(`/api/tasks/${zadanieWlasne}`)
        .set('Authorization', `Bearer ${token(inicjator, 'MEMBER')}`)
        .send({ title: 'wlasne po edycji (scoped + wlasnosc)' });

      const po = await wiersz(zadanieWlasne);
      // eslint-disable-next-line no-console
      console.log('[POMIAR kontrola PUT wlasne]', odp.status, { po: po?.title });

      expect(odp.status).toBe(200);
      expect(po?.title).toBe('wlasne po edycji (scoped + wlasnosc)');
    }, 30_000);

    it('kontrola: INITIATIVE_OWNER blokuje WLASNE zadanie -> 200, status w bazie = blocked', async () => {
      const odp = await request(app)
        .post(`/api/tasks/${zadanieWlasne}/block`)
        .set('Authorization', `Bearer ${token(inicjator, 'MEMBER')}`)
        .send({ reason: 'blokada wlasnego zadania' });

      const po = await wiersz(zadanieWlasne);
      // eslint-disable-next-line no-console
      console.log('[POMIAR kontrola block wlasne]', odp.status, { po: po?.status });

      expect(odp.status).toBe(200);
      expect(po?.status).toBe('blocked');
    }, 30_000);

    it('kontrola: ADMIN organizacji edytuje CUDZE zadanie -> 200 i tytul zmieniony w bazie', async () => {
      const odp = await request(app)
        .put(`/api/tasks/${zadanieObce}`)
        .set('Authorization', `Bearer ${token(administrator, 'ADMIN')}`)
        .send({ title: 'admin po edycji' });

      const po = await wiersz(zadanieObce);
      // eslint-disable-next-line no-console
      console.log('[POMIAR kontrola PUT admin]', odp.status, { po: po?.title });

      expect(odp.status).toBe(200);
      expect(po?.title).toBe('admin po edycji');
    }, 30_000);

    it('kontrola: OWNER organizacji blokuje CUDZE zadanie -> 200, status w bazie = blocked', async () => {
      const odp = await request(app)
        .post(`/api/tasks/${zadanieObceBlok}/block`)
        .set('Authorization', `Bearer ${token(wlascicielOrg, 'OWNER')}`)
        .send({ reason: 'blokada przez wlasciciela organizacji' });

      const po = await wiersz(zadanieObceBlok);
      // eslint-disable-next-line no-console
      console.log('[POMIAR kontrola block owner]', odp.status, { po: po?.status });

      expect(odp.status).toBe(200);
      expect(po?.status).toBe('blocked');
    }, 30_000);

    // ======================================================================
    // PROJECT_SPONSOR — szablon BEZ zdolnosci `task.*`. Zmierzone i zapisane
    // (odbior prosil o pomiar, nie zakladal wyniku).
    // ======================================================================
    it('pomiar: PROJECT_SPONSOR na CUDZYM zadaniu -> 403 (szablon roli nie ma task.update w zadnej odmianie)', async () => {
      const przed = await wiersz(zadanieObce);

      const odp = await request(app)
        .put(`/api/tasks/${zadanieObce}`)
        .set('Authorization', `Bearer ${token(sponsor, 'MEMBER')}`)
        .send({ title: 'proba sponsora' });

      const po = await wiersz(zadanieObce);
      // eslint-disable-next-line no-console
      console.log('[POMIAR sponsor PUT cudze]', odp.status, JSON.stringify(odp.body).slice(0, 200), {
        przed: przed?.title,
        po: po?.title,
      });

      expect(odp.status).toBe(403);
      // Kod odmowy nizszej rangi niz ownership: sponsor nie ma ZADNEJ zdolnosci
      // `task.update`, wiec decyzja zapada wczesniej (`missing`).
      expect(String(odp.body.code || '')).toMatch(/^CAPABILITY_/);
      expect(po?.title).toBe(przed?.title);
    }, 30_000);
  });
