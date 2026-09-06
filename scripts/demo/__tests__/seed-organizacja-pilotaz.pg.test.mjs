// scripts/demo/__tests__/seed-organizacja-pilotaz.pg.test.mjs
//
// Test IZOLACJI na prawdziwym Postgresie (nie mock). Gate: RUN_DB_TESTS=1 +
// DATABASE_URL wskazujący na LOKALNĄ bazę (nie demo/staging/produkcja — to
// samo `sprawdzCel` w seedzie i tak by to zablokowało, ale test i tak nigdy
// nie powinien polegać wyłącznie na tamtej bramce).
//
// CO SPRAWDZAMY (naprawdę, nie deklaratywnie):
//   1. seed --apply NIE dotyka „obcej" organizacji ani jej konta-właściciela
//      (żadnej zmiany role/organization_id/password) — nawet gdy to konto
//      zostaje wybrane jako administrator pilotażu (--admin-email).
//   2. drugi --apply daje utworzono=0 zmieniono=0 (idempotencja).
//   3. --rollback kasuje TYLKO organizację pilotażu + konta, które sam
//      utworzył — konto-właściciel „obcej" organizacji PRZEŻYWA rollback
//      bez żadnej zmiany.
//   4. MUTACJA: gdy z rollbacku usunąć warunek „administrator był utworzony
//      przez seed" (czyli rollback przestaje sprawdzać organization_id przed
//      skasowaniem), ten sam scenariusz musi zakończyć się USUNIĘCIEM
//      obcego konta — czyli test musi wtedy failować (RED). Dowodzi to, że
//      test broni KONKRETNEGO zabezpieczenia, a nie tylko scenariusza.
//
// Brak pomiaru nie jest wynikiem: gdy RUN_DB_TESTS!=1, test jawnie SKIP-uje
// (nie „przechodzi" po cichu).

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import pg from 'pg';

const { Pool } = pg;
const TU = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TU, '../../..');
const SEED = path.resolve(ROOT, 'scripts/demo/seed-organizacja-pilotaz.ts');
const TSX = path.resolve(ROOT, 'node_modules/.bin/tsx');

const RUN = process.env.RUN_DB_TESTS === '1';
const URL = process.env.DATABASE_URL || '';

const DECOY_ORG_ID = 'iso-test-decoy-org-92058fa0';
const DECOY_USER_ID = 'iso-test-decoy-owner-92058fa0';
const DECOY_EMAIL = 'decoy.owner+iso-test-92058fa0@example-org.test';
const FAKE_HASH = '$2a$10$abcdefghijklmnopqrstuuOQ7X8n1c9Zc9r9r9r9r9r9r9r9r9r9r';

function kontaTestowe(tmpDir) {
  const plik = path.join(tmpDir, 'konta.json');
  fs.writeFileSync(
    plik,
    JSON.stringify({
      uzytkownicy: [
        { imie: 'Iso', nazwisko: 'Jeden', email: 'iso-test-1+pilotaz@example.test', rola: 'CONSULTANT' },
        { imie: 'Iso', nazwisko: 'Dwa', email: 'iso-test-2+pilotaz@example.test', rola: 'CONSULTANT' },
      ],
    })
  );
  return plik;
}

function uruchom(args, env) {
  const r = spawnSync(TSX, [SEED, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return r;
}

async function pobierzDecoy(pool) {
  const r = await pool.query('SELECT id, organization_id, role, status, password FROM users WHERE id = $1', [
    DECOY_USER_ID,
  ]);
  return r.rows[0] || null;
}

async function posprzataj(pool) {
  await pool.query('DELETE FROM organization_members WHERE organization_id IN ($1, $2)', [
    DECOY_ORG_ID,
    'iso-test-pilot-org-placeholder',
  ]);
  // Organizacja pilotażu ma deterministyczne id liczone z TAG-u w skrypcie —
  // sprzątamy ją po nazwie, żeby nie duplikować tu logiki UUIDv5.
  const org = await pool.query("SELECT id FROM organizations WHERE name = 'DBR77 Pilotaż'");
  for (const row of org.rows) {
    // Sam cykl FK co w seedzie (owner_id <-> organization_id, oba NO ACTION):
    // zerujemy owner_id, zanim skasujemy konta, inaczej DELETE users wywala się.
    await pool.query('UPDATE organizations SET owner_id = NULL WHERE id = $1', [row.id]);
    await pool.query('DELETE FROM organization_members WHERE organization_id = $1', [row.id]);
    await pool.query('DELETE FROM users WHERE organization_id = $1 AND id <> $2', [row.id, DECOY_USER_ID]);
    await pool.query('DELETE FROM organizations WHERE id = $1', [row.id]);
  }
  await pool.query('DELETE FROM organization_members WHERE user_id = $1', [DECOY_USER_ID]);
  await pool.query('DELETE FROM users WHERE id = $1', [DECOY_USER_ID]);
  await pool.query('DELETE FROM organizations WHERE id = $1', [DECOY_ORG_ID]);
  await pool.query("DELETE FROM users WHERE email LIKE 'iso-test-%+pilotaz@example.test'");
}

test('seed pilotażu: izolacja od obcej organizacji + rollback bez manifestu nie rusza cudzego konta', { skip: !RUN }, async (t) => {
  if (!URL) throw new Error('RUN_DB_TESTS=1 ale brak DATABASE_URL — pomiaru NIE ma prawa być cichym PASS-em.');
  if (!/127\.0\.0\.1|localhost/.test(URL))
    throw new Error('Ten test PISZE i KASUJE dane — DATABASE_URL musi wskazywać na 127.0.0.1/localhost.');

  const pool = new Pool({ connectionString: URL, ssl: false, max: 2 });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-pilotaz-iso-'));
  const kontaPlik = kontaTestowe(tmpDir);
  const hasloPlik = path.join(tmpDir, 'hasla.json');

  try {
    await posprzataj(pool);

    // --- Fixture: „obca" organizacja + jej właściciel (symuluje realne konto
    // wybrane przez --admin-email, np. właściciela na bazie docelowej). ---
    await pool.query(
      `INSERT INTO organizations (id, name, plan, status, industry, organization_type, is_active)
       VALUES ($1, 'Obca organizacja (izolacja)', 'free', 'active', 'Consulting', 'TRIAL', 1)`,
      [DECOY_ORG_ID]
    );
    await pool.query(
      `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status)
       VALUES ($1, $2, $3, $4, 'Decoy', 'Owner', 'ADMIN', 'active')`,
      [DECOY_USER_ID, DECOY_ORG_ID, DECOY_EMAIL, FAKE_HASH]
    );
    const przed = await pobierzDecoy(pool);
    assert.ok(przed, 'fixture: konto decoy nie zostało założone');

    const argiBazowe = ['--oczekiwany-host', '127.0.0.1', '--konta', kontaPlik, '--admin-email', DECOY_EMAIL];

    await t.test('apply #1: tworzy organizację pilotażu + 2 konta testowe, NIE rusza obcego konta', () => {
      const r = uruchom(['--apply', ...argiBazowe, '--haslo-plik', hasloPlik], { DATABASE_URL: URL });
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.match(r.stdout, /dodaj członkostwo \(konto cudze\/istniejące\)/);
      assert.match(r.stdout, /utworzono=5 zmieniono=1/); // org + 2 konta + 2 członkostwa = utworzono; członkostwo admina = zmieniono
    });

    const poApply = await pobierzDecoy(pool);
    assert.deepEqual(
      { organization_id: poApply.organization_id, role: poApply.role, status: poApply.status, password: poApply.password },
      { organization_id: DECOY_ORG_ID, role: 'ADMIN', status: 'active', password: FAKE_HASH },
      'apply zmieniło obce konto — regresja izolacji'
    );

    const czlonkostwoDecoy = await pool.query(
      "SELECT m.role AS role, m.status AS status FROM organization_members m JOIN organizations o ON o.id = m.organization_id WHERE o.name = 'DBR77 Pilotaż' AND m.user_id = $1",
      [DECOY_USER_ID]
    );
    assert.equal(czlonkostwoDecoy.rows.length, 1);
    assert.equal(czlonkostwoDecoy.rows[0].role, 'OWNER');

    await t.test('apply #2: idempotentnie 0 zmian', () => {
      const r = uruchom(['--apply', ...argiBazowe, '--haslo-plik', path.join(tmpDir, 'hasla2.json')], {
        DATABASE_URL: URL,
      });
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.match(r.stdout, /utworzono=0 zmieniono=0/);
      assert.equal(fs.existsSync(path.join(tmpDir, 'hasla2.json')), false, 'zero zmian nie powinno pisać pliku haseł');
    });

    await t.test('rollback: kasuje pilotaż, NIE kasuje obcego konta', () => {
      const r = uruchom(['--rollback', ...argiBazowe], { DATABASE_URL: URL });
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.match(r.stdout, /NIE jest kasowane/);
    });

    const org = await pool.query("SELECT id FROM organizations WHERE name = 'DBR77 Pilotaż'");
    assert.equal(org.rows.length, 0, 'organizacja pilotażu powinna zniknąć po rollbacku');

    const poRollback = await pobierzDecoy(pool);
    assert.ok(poRollback, 'rollback USUNĄŁ obce konto — to jest dokładnie regresja, przed którą broni guard');
    assert.deepEqual(
      { organization_id: poRollback.organization_id, role: poRollback.role, status: poRollback.status, password: poRollback.password },
      { organization_id: DECOY_ORG_ID, role: 'ADMIN', status: 'active', password: FAKE_HASH },
      'rollback zmienił obce konto — regresja izolacji'
    );

    const fake = await pool.query("SELECT count(*)::int AS n FROM users WHERE email LIKE 'iso-test-%+pilotaz@example.test'");
    assert.equal(fake.rows[0].n, 0, '2 konta testowe powinny zniknąć po rollbacku');
  } finally {
    await posprzataj(pool);
    await pool.end();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('seed pilotażu: administrator UTWORZONY przez seed jest w pełni kasowany przy rollbacku (bez FK-crashu)', { skip: !RUN }, async (t) => {
  if (!URL) throw new Error('RUN_DB_TESTS=1 ale brak DATABASE_URL — pomiaru NIE ma prawa być cichym PASS-em.');
  if (!/127\.0\.0\.1|localhost/.test(URL))
    throw new Error('Ten test PISZE i KASUJE dane — DATABASE_URL musi wskazywać na 127.0.0.1/localhost.');

  // Ten scenariusz jest INNY niż „obca organizacja": tu e-mail administratora
  // NIE istnieje nigdzie w bazie, więc seed zakłada dla niego świeże konto pod
  // organizacją pilotażu — a `organizations.owner_id` wskazuje właśnie na nie.
  // Rollback MUSI wtedy skasować i organizację, i to konto, w kolejności, która
  // nie łamie `organizations_owner_id_fkey` (NO ACTION, bez cascade).
  const pool = new Pool({ connectionString: URL, ssl: false, max: 2 });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-pilotaz-freshadmin-'));
  const kontaPlik = kontaTestowe(tmpDir);
  const hasloPlik = path.join(tmpDir, 'hasla.json');
  const SWIEZY_ADMIN_EMAIL = 'iso-test-swiezy-admin+pilotaz@example.test';

  try {
    await posprzataj(pool);
    await pool.query("DELETE FROM users WHERE email = $1", [SWIEZY_ADMIN_EMAIL]);

    const argiBazowe = ['--oczekiwany-host', '127.0.0.1', '--konta', kontaPlik, '--admin-email', SWIEZY_ADMIN_EMAIL];

    await t.test('apply: zakłada świeże konto administratora pod organizacją pilotażu', () => {
      const r = uruchom(['--apply', ...argiBazowe, '--haslo-plik', hasloPlik], { DATABASE_URL: URL });
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.match(r.stdout, /utworzy konto\+członkostwo/);
      // org(1) + admin-konto(1) + admin-czlonkostwo(1) + 2 konta(2) + 2 czlonkostwa(2) = 7
      assert.match(r.stdout, /utworzono=7 zmieniono=0/);
    });

    const org = await pool.query("SELECT owner_id FROM organizations WHERE name = 'DBR77 Pilotaż'");
    assert.equal(org.rows.length, 1);
    const adminRow = await pool.query('SELECT id, organization_id FROM users WHERE email = $1', [SWIEZY_ADMIN_EMAIL]);
    assert.equal(adminRow.rows.length, 1);
    assert.equal(org.rows[0].owner_id, adminRow.rows[0].id, 'owner_id organizacji powinien wskazywać na świeżo założonego admina');

    await t.test('rollback: kasuje organizację, świeżego admina i konta bez błędu FK', () => {
      const r = uruchom(['--rollback', ...argiBazowe], { DATABASE_URL: URL });
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.doesNotMatch(r.stdout, /BŁĄD/);
      assert.doesNotMatch(r.stdout, /NIE jest kasowane/); // tu admin BYŁ utworzony przez seed — ma zniknąć
    });

    const orgPo = await pool.query("SELECT id FROM organizations WHERE name = 'DBR77 Pilotaż'");
    assert.equal(orgPo.rows.length, 0);
    const adminPo = await pool.query('SELECT id FROM users WHERE email = $1', [SWIEZY_ADMIN_EMAIL]);
    assert.equal(adminPo.rows.length, 0, 'świeżo założone konto administratora powinno zniknąć po rollbacku');
  } finally {
    await pool.query("DELETE FROM users WHERE email = $1", [SWIEZY_ADMIN_EMAIL]);
    await posprzataj(pool);
    await pool.end();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('MUTACJA (dowód, nie tylko deklaracja): usunięcie guardu w rollbacku kasuje obce konto → to jest RED, nie „inny wynik"', { skip: !RUN }, async (t) => {
  if (!URL) throw new Error('RUN_DB_TESTS=1 ale brak DATABASE_URL.');
  if (!/127\.0\.0\.1|localhost/.test(URL)) throw new Error('DATABASE_URL musi wskazywać na 127.0.0.1/localhost.');

  const pool = new Pool({ connectionString: URL, ssl: false, max: 2 });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-pilotaz-mut-'));
  const kontaPlik = kontaTestowe(tmpDir);
  const hasloPlik = path.join(tmpDir, 'hasla.json');

  // Kopia skryptu ze ŚCIĘTYM guardem: zamiast `if (adminUtworzonyPrzezSeed)
  // idsDoUsuniecia.push(...)` bezwarunkowo dopisujemy admina do kasowania.
  // Kopia leży W TYM SAMYM repo (obok oryginału, poza indeksem gita), żeby
  // rozwiązywanie node_modules działało tak samo jak dla oryginału.
  const oryginal = fs.readFileSync(SEED, 'utf8');
  const zrodloGuardu = /if \(adminUtworzonyPrzezSeed\) idsDoUsuniecia\.push\(admin\.userId\);\s*\n\s*else\s*\n\s*console\.log\(\s*\n(?:.*\n)*?\s*\);/;
  assert.match(oryginal, zrodloGuardu, 'nie znaleziono spodziewanego bloku guardu — skrypt się zmienił, popraw test');
  const zmutowany = oryginal.replace(zrodloGuardu, 'idsDoUsuniecia.push(admin.userId); /* MUTACJA: guard usunięty */');
  assert.notEqual(zmutowany, oryginal);
  assert.ok(!zmutowany.includes('if (adminUtworzonyPrzezSeed)'), 'mutacja nie usunęła warunku');
  const sciezkaZmutowana = path.join(path.dirname(SEED), `.tmp-mutacja-rollback-${process.pid}.ts`);
  fs.writeFileSync(sciezkaZmutowana, zmutowany);

  try {
    await posprzataj(pool);
    await pool.query(
      `INSERT INTO organizations (id, name, plan, status, industry, organization_type, is_active)
       VALUES ($1, 'Obca organizacja (mutacja)', 'free', 'active', 'Consulting', 'TRIAL', 1)`,
      [DECOY_ORG_ID]
    );
    await pool.query(
      `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status)
       VALUES ($1, $2, $3, $4, 'Decoy', 'Owner', 'ADMIN', 'active')`,
      [DECOY_USER_ID, DECOY_ORG_ID, DECOY_EMAIL, FAKE_HASH]
    );

    const argiBazowe = ['--oczekiwany-host', '127.0.0.1', '--konta', kontaPlik, '--admin-email', DECOY_EMAIL];

    const apply = spawnSync(TSX, [sciezkaZmutowana, '--apply', ...argiBazowe, '--haslo-plik', hasloPlik], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, DATABASE_URL: URL },
    });
    assert.equal(apply.status, 0, apply.stdout + apply.stderr);

    const rb = spawnSync(TSX, [sciezkaZmutowana, '--rollback', ...argiBazowe], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, DATABASE_URL: URL },
    });
    assert.equal(rb.status, 0, rb.stdout + rb.stderr);

    const poZmutowanymRollbacku = await pobierzDecoy(pool);
    // TO JEST DOWÓD: bez guardu obce konto ZNIKA. Gdyby ten assert kiedyś
    // zaczął failować (bo ktoś "naprawił" mutację przypadkiem), oznaczałoby
    // to, że test przestał być czuły na usunięcie zabezpieczenia.
    assert.equal(
      poZmutowanymRollbacku,
      null,
      'oczekiwano, że BEZ guardu rollback skasuje obce konto (to jest demonstrowana regresja — RED)'
    );
  } finally {
    fs.rmSync(sciezkaZmutowana, { force: true });
    await posprzataj(pool);
    await pool.end();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
