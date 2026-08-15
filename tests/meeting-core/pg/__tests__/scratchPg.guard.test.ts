/**
 * scratchPg.guard.test.ts — testy SAMEGO strażnika URL-a scratch-bazy.
 *
 * Te testy NIE dotykają Dockera ani żadnej bazy — sprawdzają wyłącznie
 * czystą funkcję `assertScratchDatabaseUrl`. Działają zawsze, nawet bez
 * Docker Desktop/daemona uruchomionego.
 */
import { describe, expect, it } from 'vitest';

import { assertScratchDatabaseUrl } from '../scratchPg';

describe('assertScratchDatabaseUrl — MUSI PRZEJŚĆ (lokalna scratch-baza)', () => {
  const okUrls = [
    'postgres://scratch:scratch@127.0.0.1:55432/scratch',
    'postgresql://scratch:scratch@127.0.0.1:55432/scratch',
    'postgres://scratch:scratch@localhost:55432/scratch',
    'postgres://scratch:scratch@localhost:41999/meeting_core_test',
    // Docker-assigned ephemeral port, typowy zakres
    'postgres://scratch:scratch@127.0.0.1:32768/scratch',
    // Bez credentiali w URL-u, ale wciąż lokalny wysoki port
    'postgres://127.0.0.1:55432/scratch',
  ];

  it.each(okUrls)('przechodzi dla: %s', (url) => {
    expect(() => assertScratchDatabaseUrl(url)).not.toThrow();
  });
});

describe('assertScratchDatabaseUrl — MUSI ODRZUCIĆ (zdalne/produkcyjne/złe)', () => {
  const badUrls: Array<[string, string]> = [
    ['host inny niż localhost', 'postgres://user:pass@example.com:55432/db'],
    ['host 0.0.0.0 (nie na białej liście)', 'postgres://user:pass@0.0.0.0:55432/db'],
    [
      'Railway — host railway.internal',
      'postgres://user:pass@my-app.railway.internal:5432/railway',
    ],
    ['Railway — proxy rlwy.net', 'postgresql://postgres:pass@viaduct.proxy.rlwy.net:23456/railway'],
    [
      'Railway — proxy.rlwy w środku',
      'postgres://user:pass@containers-us-west-1.proxy.rlwy.net:6543/railway',
    ],
    ['AWS RDS — amazonaws', 'postgres://user:pass@mydb.abc123.us-east-1.rds.amazonaws.com:5432/db'],
    ['Supabase', 'postgres://postgres:pass@db.abcxyz.supabase.co:5432/postgres'],
    ['Neon', 'postgres://user:pass@ep-cool-thing-123456.us-east-2.aws.neon.tech/db'],
    ['Render.com', 'postgres://user:pass@my-db.onrender.com:5432/db'],
    [
      'centerbeam (PROD host z MEMORY db-hosts-prod-demo)',
      'postgres://user:pass@centerbeam.proxy.rlwy.net:37823/railway',
    ],
    [
      'trolley (DEMO host z MEMORY db-hosts-prod-demo)',
      'postgres://user:pass@trolley.proxy.rlwy.net:28146/railway',
    ],
    ['nazwa hosta zawiera "demo"', 'postgres://user:pass@demo.consultify.ai:55432/consultify'],
    ['nazwa hosta zawiera "prod"', 'postgres://user:pass@prod-db.internal:55432/consultify'],
    [
      'nazwa bazy zawiera "prod" mimo localhost hosta',
      'postgres://scratch:scratch@127.0.0.1:55432/consultify_prod',
    ],
    ['port 5432 na 127.0.0.1 (baza hosta)', 'postgres://scratch:scratch@127.0.0.1:5432/scratch'],
    ['port 5432 na localhost (baza hosta)', 'postgres://scratch:scratch@localhost:5432/scratch'],
    ['brak portu = domyślny 5432 (baza hosta)', 'postgres://scratch:scratch@localhost/scratch'],
    ['zły protokół (mysql)', 'mysql://scratch:scratch@localhost:55432/scratch'],
    ['zły protokół (http)', 'http://localhost:55432/scratch'],
    ['nieparsowalny URL', 'nie-jest-to-url'],
    ['pusty string', ''],
  ];

  it.each(badUrls)('odrzuca (%s): %s', (_label, url) => {
    expect(() => assertScratchDatabaseUrl(url)).toThrow();
  });

  it('komunikat błędu wskazuje przyczynę odmowy (nie jest generyczny)', () => {
    expect(() => assertScratchDatabaseUrl('postgres://user:pass@example.com:5432/prod')).toThrow(
      /ODMOWA/
    );
  });
});
