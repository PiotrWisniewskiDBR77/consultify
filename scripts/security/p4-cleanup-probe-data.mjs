/**
 * P4 BEZPIECZENSTWO — sprzatanie po sondach.
 *
 * Dane demo/staging sa twarza produktu: kazdy rekord utworzony przez sondy
 * (prefiks "P4 sonda" / "P4 PROBE ORG" / adres p4.probe.*@p4probe.invalid)
 * jest tu kasowany. Skrypt najpierw POKAZUJE, co usunie (--dry-run domyslnie),
 * usuwa dopiero z P4_CLEANUP_APPLY=1.
 *
 * UWAGA: sprzatanie przez API okazalo sie niewystarczajace — DELETE
 * /api/decisions/:id zwrocilo 200, a rekord zostal w bazie (soft-delete albo
 * brak kaskady). Dlatego sprzatamy na bazie i weryfikujemy licznikiem po.
 */
import fs from 'node:fs';
import pg from 'pg';

const APPLY = process.env.P4_CLEANUP_APPLY === '1';
const env = Object.fromEntries(
  fs
    .readFileSync(process.env.P4_ENV_FILE || '.env.staging.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1)];
    })
);

const STEPS = [
  ['project_notification_settings (wiersz kontrolny)', `delete from project_notification_settings where id = 'p4-canary-row'`, `select count(*) from project_notification_settings where id = 'p4-canary-row'`],
  ['decisions', `delete from decisions where title like 'P4 sonda%'`, `select count(*) from decisions where title like 'P4 sonda%'`],
  ['tasks', `delete from tasks where title like 'P4 sonda%'`, `select count(*) from tasks where title like 'P4 sonda%'`],
  ['initiatives', `delete from initiatives where title like 'P4 sonda%'`, `select count(*) from initiatives where title like 'P4 sonda%'`],
  ['projects', `delete from projects where name like 'P4 sonda%'`, `select count(*) from projects where name like 'P4 sonda%'`],
  ['users (konto sondy)', `delete from users where email like 'p4.probe.%@p4probe.invalid'`, `select count(*) from users where email like 'p4.probe.%@p4probe.invalid'`],
  ['organizations (org sondy)', `delete from organizations where name like 'P4 PROBE ORG%'`, `select count(*) from organizations where name like 'P4 PROBE ORG%'`],
];

const c = new pg.Client({ connectionString: env.DATABASE_PUBLIC_URL });
await c.connect();

for (const [label, del, check] of STEPS) {
  const before = Number((await c.query(check)).rows[0].count);
  if (!APPLY) {
    console.log(`  [dry-run] ${label}: do usuniecia ${before}`);
    continue;
  }
  if (before === 0) {
    console.log(`  ${label}: nic do usuniecia`);
    continue;
  }
  try {
    await c.query(del);
  } catch (e) {
    console.log(`  ${label}: BLAD (${e.message.slice(0, 120)}) — zostaje ${before}`);
    continue;
  }
  const after = Number((await c.query(check)).rows[0].count);
  console.log(`  ${label}: ${before} -> ${after}${after === 0 ? ' OK' : ' UWAGA: nie wszystko usuniete'}`);
}

await c.end();
if (!APPLY) console.log('\n(uruchom z P4_CLEANUP_APPLY=1, zeby faktycznie usunac)');
