/**
 * Tryb `--sieroty-apply` skryptu `scripts/dane/usun-organizacje.ts` na ŻYWEJ
 * bazie Postgresa — cykl apply → verify → rollback → verify.
 *
 * Dlaczego przez podproces, a nie przez import funkcji: przedmiotem testu jest
 * TRYB, czyli parser CLI + bramka dwóch kluczy + guard hosta + transakcja +
 * manifest + rollback razem. Import samych funkcji przepuściłby błąd w sklejeniu.
 *
 * Baza tymczasowa jest tworzona i kasowana przez sam test. Bez `SIEROTY_PG_URL`
 * (adres administracyjny, np. postgres://postgres:postgres@127.0.0.1:54418/postgres)
 * test się NIE uruchamia — i mówi o tym wprost, żeby pominięcie nie udawało PASS.
 *
 * Uruchomienie:
 *   SIEROTY_PG_URL=postgres://postgres:postgres@127.0.0.1:54418/postgres \
 *     npx vitest run --config vitest.orphans.config.ts \
 *       server/tests/dane-sieroty/sieroty-apply.pg.test.ts
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const wykonaj = promisify(execFile);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KORZEN = path.resolve(HERE, '..', '..', '..');
const SKRYPT = path.join(KORZEN, 'scripts', 'dane', 'usun-organizacje.ts');

const ADMIN = process.env.SIEROTY_PG_URL ?? '';
const wlaczony = Boolean(ADMIN);

const BAZA = `consultify_test_sieroty_${Date.now()}`;
const urlBazy = () => {
  const u = new URL(ADMIN);
  u.pathname = `/${BAZA}`;
  return u.toString();
};

type Wynik = { kod: number; wyjscie: string };

async function uruchom(args: string[], env: Record<string, string> = {}): Promise<Wynik> {
  try {
    const r = await wykonaj('npx', ['tsx', SKRYPT, ...args], {
      cwd: KORZEN,
      env: { ...process.env, DATABASE_URL: urlBazy(), ...env },
      maxBuffer: 32 * 1024 * 1024,
    });
    return { kod: 0, wyjscie: `${r.stdout}${r.stderr}` };
  } catch (e) {
    const b = e as { code?: number; stdout?: string; stderr?: string };
    return { kod: b.code ?? 1, wyjscie: `${b.stdout ?? ''}${b.stderr ?? ''}` };
  }
}

function liczbaSierot(wyjscie: string): number {
  const m = wyjscie.match(/VERIFY --sieroty: (\d+) wierszy-sierot/);
  if (!m) throw new Error(`Brak linii VERIFY w wyjściu:\n${wyjscie}`);
  return Number(m[1]);
}

describe.skipIf(!wlaczony)('usun-organizacje --sieroty-apply · żywy Postgres', () => {
  let katalogManifestow = '';

  beforeAll(async () => {
    const admin = new Client({ connectionString: ADMIN });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${BAZA}`);
    await admin.end();

    const c = new Client({ connectionString: urlBazy() });
    await c.connect();
    await c.query(`
      CREATE TABLE organizations (id text PRIMARY KEY, name text);
      -- alfa: kolumna jsonb trzymająca TABLICĘ. Bez ręcznej serializacji json
      -- sterownik zamieni ją na literał tablicy Postgresa i rollback padnie na
      -- "invalid input syntax for type json" (defekt zmierzony 2026-09-09).
      CREATE TABLE alfa (id text PRIMARY KEY, organization_id text, payload jsonb);
      CREATE TABLE beta (id text PRIMARY KEY, organization_id text);
      -- gamma: dziecko alfy przez FK NO ACTION i BEZ własnego wskaźnika na
      -- organizację. Bez domknięcia po dzieciach DELETE z alfy odmawia
      -- w każdym przebiegu i cała transakcja leci do wycofania.
      CREATE TABLE gamma (id text PRIMARY KEY, alfa_id text REFERENCES alfa(id) ON DELETE NO ACTION);
    `);
    await c.query(`INSERT INTO organizations (id, name) VALUES ('zywa', 'Żywa organizacja')`);
    await c.query(`
      INSERT INTO alfa (id, organization_id, payload) VALUES
        ('a-zywa',  'zywa',   '["ok"]'::jsonb),
        ('a-duch1', 'duch-1', '["x","y"]'::jsonb),
        ('a-duch2', 'duch-2', '[]'::jsonb)`);
    await c.query(`
      INSERT INTO beta (id, organization_id) VALUES
        ('b-zywa',  'zywa'),
        ('b-duch',  'duch-1'),
        ('b-null',  NULL)`);
    await c.query(`INSERT INTO gamma (id, alfa_id) VALUES ('g-1', 'a-duch1')`);
    await c.end();

    katalogManifestow = fs.mkdtempSync(path.join(os.tmpdir(), 'sieroty-manifest-'));
  }, 60_000);

  afterAll(async () => {
    if (!wlaczony) return;
    if (katalogManifestow) fs.rmSync(katalogManifestow, { recursive: true, force: true });
    const admin = new Client({ connectionString: ADMIN });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${BAZA} WITH (FORCE)`);
    await admin.end();
  }, 60_000);

  it('cykl: 3 sieroty w 2 tabelach → apply → 0 → rollback → 3', async () => {
    // --- PRZED: 3 sieroty (a-duch1, a-duch2, b-duch). Wiersz z NULL-em nie liczy się.
    const przed = await uruchom(['--oczekiwany-host', '127.0.0.1', '--verify', '--sieroty']);
    expect(przed.kod).toBe(0);
    expect(liczbaSierot(przed.wyjscie)).toBe(3);

    // --- DRUGI KLUCZ: bez FORCE_PURGE tryb ma odmówić i NIC nie skasować.
    const bezKlucza = await uruchom(['--oczekiwany-host', '127.0.0.1', '--sieroty-apply']);
    expect(bezKlucza.kod).toBe(1);
    expect(bezKlucza.wyjscie).toContain('FORCE_PURGE=true');
    expect(liczbaSierot((await uruchom(['--oczekiwany-host', '127.0.0.1', '--verify', '--sieroty'])).wyjscie)).toBe(3);

    // --- APPLY
    const apply = await uruchom(
      ['--oczekiwany-host', '127.0.0.1', '--sieroty-apply', '--manifest-dir', katalogManifestow],
      { FORCE_PURGE: 'true' }
    );
    expect(apply.kod).toBe(0);
    // Domknięcie po dzieciach musi złapać gammę — inaczej alfa się nie skasuje.
    expect(apply.wyjscie).toContain('DOMKNIĘCIE PO DZIECIACH');
    expect(apply.wyjscie).toMatch(/gamma\.alfa_id ← alfa/);
    // 3 sieroty + 1 dziecko = 4 wiersze objęte manifestem.
    expect(apply.wyjscie).toMatch(/Manifest „przed” zapisany: .*\(4 wierszy\)/);

    const manifest = apply.wyjscie.match(/Rollback: --rollback=(\S+)/)?.[1];
    expect(manifest, 'skrypt musi wypisać ścieżkę manifestu').toBeTruthy();
    expect(fs.existsSync(manifest!)).toBe(true);

    // --- PO APPLY: zero sierot.
    const po = await uruchom(['--oczekiwany-host', '127.0.0.1', '--verify', '--sieroty']);
    expect(po.kod).toBe(0);
    expect(liczbaSierot(po.wyjscie)).toBe(0);

    // --- ROLLBACK: 4 wiersze z powrotem (3 sieroty + dziecko).
    const rollback = await uruchom(['--oczekiwany-host', '127.0.0.1', `--rollback=${manifest}`]);
    expect(rollback.kod, rollback.wyjscie).toBe(0);
    expect(rollback.wyjscie).toContain('rodzaju „sieroty”');
    expect(rollback.wyjscie).toContain('przywrócono 4 wierszy');

    // --- PO ROLLBACKU: znowu 3 sieroty.
    const poRollbacku = await uruchom(['--oczekiwany-host', '127.0.0.1', '--verify', '--sieroty']);
    expect(liczbaSierot(poRollbacku.wyjscie)).toBe(3);

    // Stan bazy zgodny co do wiersza, nie tylko co do liczby: dziecko wróciło,
    // tablica w kolumnie jsonb wróciła jako tablica (a nie jako literał {x,y}).
    const c = new Client({ connectionString: urlBazy() });
    await c.connect();
    try {
      const g = await c.query(`SELECT alfa_id FROM gamma WHERE id='g-1'`);
      expect(g.rows[0]?.alfa_id).toBe('a-duch1');
      const a = await c.query(`SELECT payload FROM alfa WHERE id='a-duch1'`);
      expect(a.rows[0]?.payload).toEqual(['x', 'y']);
      const zywe = await c.query(`SELECT count(*)::int AS n FROM alfa WHERE organization_id='zywa'`);
      expect(zywe.rows[0]?.n, 'wiersze żywej organizacji nietknięte').toBe(1);
      const nulle = await c.query(`SELECT count(*)::int AS n FROM beta WHERE organization_id IS NULL`);
      expect(nulle.rows[0]?.n, 'wiersz z NULL-em nie jest sierotą').toBe(1);
    } finally {
      await c.end();
    }
  }, 300_000);
});
