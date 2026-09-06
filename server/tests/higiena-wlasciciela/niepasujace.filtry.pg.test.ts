import crypto from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mainNiepasujace } from '../../scripts/higiena-wlasciciela/niepasujace.js';
import { defaultFilters } from '../../scripts/higiena-wlasciciela/wspolne.js';

const url = process.env.DATABASE_URL;
const enabled = Boolean(url?.includes('127.0.0.1:54400/consultify_noc'));

describe.skipIf(!enabled)('niepasujace.ts filtry CLI (--bez-tytul, --tylko-tabele) · RealPG', () => {
  const pool = new Pool({ connectionString: url });
  let c: any;
  const owner = crypto.randomUUID();
  const other = crypto.randomUUID();
  const keepId = crypto.randomUUID();
  const dropId = crypto.randomUUID();
  const otherOrgId = crypto.randomUUID();

  beforeAll(async () => {
    c = await pool.connect();
    await c.query('BEGIN');
    await c.query(`INSERT INTO organizations(id,name) VALUES ($1,$2),($3,$4)`, [
      owner, '__NIEPASUJACE_FILTRY_OWNER__', other, '__NIEPASUJACE_FILTRY_OTHER__',
    ]);
    // Dwa puste wątki (bez wiadomości) właściciela: jeden pasuje do --bez-tytul (ma zostać
    // nietknięty), drugi nie pasuje (ma zostać zarchiwizowany normalnie).
    await c.query(
      `INSERT INTO conversations(id,organization_id,user_id,title,archived,created_at) VALUES
       ($1,$2,'system','FINAL Report Thread',false,now()),
       ($3,$2,'system','Puste story',false,now())`,
      [keepId, owner, dropId]
    );
    // Wątek innej organizacji o tym samym NIEpasującym tytule — dowód izolacji organizacyjnej.
    await c.query(
      `INSERT INTO conversations(id,organization_id,user_id,title,archived,created_at) VALUES ($1,$2,'system','Puste story',false,now())`,
      [otherOrgId, other]
    );
  });

  afterAll(async () => {
    if (c) { await c.query('ROLLBACK'); c.release(); }
    await pool.end();
  });

  it('--bez-tytul nie usuwa pasującego rekordu; niepasujący i tak trafia do archiwum; izolacja org zostaje', async () => {
    const filters = { ...defaultFilters(), tylkoTabele: new Set(['conversations']), bezTytul: /FINAL/i };
    await mainNiepasujace(c, { id: owner, name: '__NIEPASUJACE_FILTRY_OWNER__' }, { kind: 'apply' }, filters);
    const rows = (await c.query(`SELECT id,archived FROM conversations WHERE id=ANY($1)`, [[keepId, dropId, otherOrgId]])).rows;
    const byId = Object.fromEntries(rows.map((r: any) => [r.id, r.archived]));
    expect(byId[keepId]).toBe(false); // --bez-tytul=FINAL chronił ten wątek
    expect(byId[dropId]).toBe(true); // niepasujący wątek zarchiwizowany normalnie
    expect(byId[otherOrgId]).toBe(false); // izolacja: inna organizacja nietknięta mimo tego samego tytułu
  });

  it('mutacja: bez filtra --bez-tytul ten sam rodzaj wątku FINAL zostaje zarchiwizowany → RED (dowód, że filtr ma realny efekt)', async () => {
    const unprotectedId = crypto.randomUUID();
    await c.query(
      `INSERT INTO conversations(id,organization_id,user_id,title,archived,created_at) VALUES ($1,$2,'system','FINAL Report Thread 2',false,now())`,
      [unprotectedId, owner]
    );
    const filtersBezOchrony = { ...defaultFilters(), tylkoTabele: new Set(['conversations']) }; // brak --bez-tytul
    await mainNiepasujace(c, { id: owner, name: '__NIEPASUJACE_FILTRY_OWNER__' }, { kind: 'apply' }, filtersBezOchrony);
    const r = (await c.query(`SELECT archived FROM conversations WHERE id=$1`, [unprotectedId])).rows[0];
    expect(r.archived).toBe(true); // MUTACJA: bez filtra wątek FINAL ginie — potwierdza, że --bez-tytul realnie chroni
  });
});
