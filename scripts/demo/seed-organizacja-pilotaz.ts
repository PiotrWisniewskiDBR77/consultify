#!/usr/bin/env tsx
/**
 * SEED — czysta organizacja pilotażowa „DBR77 Pilotaż" + 4 konta pierwszej linii
 * + 1 konto administratora organizacji.
 *
 * PO CO. Pojemnik 2 (`docs/program/TRZY_POJEMNIKI_PRACY_20260906.md`) = pilotaż
 * na demo rękami Tomka, Kasi, Iriny i Justyny. Żeby weszli bez asysty właściciela,
 * organizacja i konta muszą już istnieć na bazie demo, z rolami, które NIE są
 * superadminem.
 *
 * UŻYCIE
 *   DATABASE_URL=… npx tsx scripts/demo/seed-organizacja-pilotaz.ts --oczekiwany-host trolley --dry-run
 *   DATABASE_URL=… npx tsx scripts/demo/seed-organizacja-pilotaz.ts --oczekiwany-host trolley --apply \
 *     --haslo-plik /private/tmp/pilotaz-hasla.txt
 *   DATABASE_URL=… npx tsx scripts/demo/seed-organizacja-pilotaz.ts --oczekiwany-host trolley --apply --resetuj-hasla
 *
 * IDEMPOTENCJA (twarda, nie deklarowana)
 *   · identyfikatory są DETERMINISTYCZNE (UUIDv5 z tagu + klucza naturalnego),
 *   · istniejące konto NIE dostaje nowego hasła — chyba że jawnie `--resetuj-hasla`,
 *   · drugi `--apply` bez `--resetuj-hasla` musi dać `utworzono=0 zmieniono=0`.
 *   To jest mierzone w evidence/demo-pilotaz/, nie zakładane.
 *
 * CZEGO NIE ROBI — CELOWO
 *   · NIE ustawia `users.role = 'SUPERADMIN'` (i odmawia, gdyby ktoś podał taką
 *     rolę w konfiguracji). Wymuszony superadmin zapisuje się w bazie na trwałe
 *     i odbiera dostęp do /chat — pamięć nadzorcy „wymuszony-superadmin-zapisuje-sie-w-bazie".
 *   · NIE zapisuje haseł w repozytorium. Hasła są losowane i lądują w pliku
 *     poza repo (chmod 600), którego ścieżkę podaje wołający.
 *   · NIE przenosi istniejącego konta między organizacjami (e-mail jest globalnie
 *     unikalny — `users_email_key`). Taki przypadek to KONFLIKT: skrypt go
 *     raportuje i kończy bez zapisu, bo decyzja „przenieść czy założyć alias"
 *     należy do właściciela.
 *
 * TYP ORGANIZACJI = PAID, i to nie jest kosmetyka.
 *   `server/src/services/access/AccessTypes.ts:13-40` — DEFAULT_TRIAL_LIMITS ma
 *   `max_users: 4` (właściciel + 3), DEFAULT_DEMO_LIMITS ma `max_users: 1`.
 *   Pilotaż to 5 kont, więc na TRIAL/DEMO piąte konto uderzyłoby w limit.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';

import bcrypt from 'bcryptjs';
import { Pool, type PoolClient } from 'pg';

// ============================================================================
// Tożsamość seeda
// ============================================================================
const TAG = 'seed:demo-pilotaz-20260906';
const PRZESTRZEN = '8b1d4e77-2a06-5c39-9f14-6d2c0b7e5a83';
const ORG_NAZWA = 'DBR77 Pilotaż';

function uuidV5(nazwa: string, przestrzen: string): string {
  const ns = Buffer.from(przestrzen.replace(/-/g, ''), 'hex');
  const hash = crypto.createHash('sha1').update(ns).update(Buffer.from(nazwa, 'utf8')).digest();
  const b = Buffer.from(hash.subarray(0, 16));
  b[6] = (b[6]! & 0x0f) | 0x50;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
const det = (rodzaj: string, klucz: string) => uuidV5(`${TAG}|${rodzaj}|${klucz}`, PRZESTRZEN);

// ============================================================================
// Konta pilotażu
//
// Nazwiska Tomka, Kasi i Justyny pochodzą z listy pracowników DBR77 w
// `server/scripts/seed-production-dbr77-users.ts`. Nazwisko Iriny NIE WYSTĘPUJE
// w repozytorium — adres poniżej jest ZAŁOŻENIEM do potwierdzenia przez
// właściciela (patrz RUNBOOK §Pytania). Podmień go przez --konta <plik.json>,
// jeśli jest inny; skrypt nie zgaduje w tle.
//
// `rolaUzytkownika` → users.role, `rolaCzlonka` → organization_members.role
// (dozwolone wartości z CHECK-a: OWNER/ADMIN/MEMBER/CONSULTANT/USER/GUEST).
// ============================================================================
type Konto = {
  email: string;
  imie: string;
  nazwisko: string;
  rolaUzytkownika: 'ADMIN' | 'USER' | 'MEMBER' | 'OWNER';
  rolaCzlonka: 'OWNER' | 'ADMIN' | 'MEMBER' | 'CONSULTANT' | 'USER' | 'GUEST';
};

const KONTA_DOMYSLNE: Konto[] = [
  {
    email: 'pilotaz.admin@dbr77.com',
    imie: 'Administrator',
    nazwisko: 'Pilotażu',
    rolaUzytkownika: 'ADMIN',
    rolaCzlonka: 'OWNER',
  },
  {
    email: 'tomasz.jankowski@dbr77.com',
    imie: 'Tomasz',
    nazwisko: 'Jankowski',
    rolaUzytkownika: 'USER',
    rolaCzlonka: 'MEMBER',
  },
  {
    email: 'katarzyna.marszalkiewicz@dbr77.com',
    imie: 'Katarzyna',
    nazwisko: 'Marszałkiewicz',
    rolaUzytkownika: 'USER',
    rolaCzlonka: 'MEMBER',
  },
  {
    email: 'irina@dbr77.com',
    imie: 'Irina',
    nazwisko: '(do potwierdzenia)',
    rolaUzytkownika: 'USER',
    rolaCzlonka: 'MEMBER',
  },
  {
    email: 'justyna.laskowska@dbr77.com',
    imie: 'Justyna',
    nazwisko: 'Laskowska',
    rolaUzytkownika: 'USER',
    rolaCzlonka: 'MEMBER',
  },
];

// ============================================================================
// Argumenty
// ============================================================================
type Opcje = {
  tryb: 'dry-run' | 'apply';
  odcisk: string;
  hasloPlik: string;
  resetujHasla: boolean;
  alias: boolean;
  konta: Konto[];
};

function czytajArgumenty(argv: string[]): Opcje {
  let tryb: 'dry-run' | 'apply' | null = null;
  let odcisk = '';
  let hasloPlik = '';
  let resetujHasla = false;
  let alias = false;
  let konta = KONTA_DOMYSLNE;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--dry-run') tryb = 'dry-run';
    else if (a === '--apply') tryb = 'apply';
    else if (a === '--resetuj-hasla') resetujHasla = true;
    else if (a === '--alias') alias = true;
    else if (a === '--oczekiwany-host') odcisk = argv[++i] ?? '';
    else if (a.startsWith('--oczekiwany-host=')) odcisk = a.split('=').slice(1).join('=');
    else if (a === '--haslo-plik') hasloPlik = argv[++i] ?? '';
    else if (a.startsWith('--haslo-plik=')) hasloPlik = a.split('=').slice(1).join('=');
    else if (a === '--konta') konta = JSON.parse(fs.readFileSync(argv[++i]!, 'utf8'));
    else if (a.startsWith('--konta=')) konta = JSON.parse(fs.readFileSync(a.split('=').slice(1).join('='), 'utf8'));
    else throw new Error(`Nieznany argument: ${a}`);
  }

  if (!tryb) throw new Error('Podaj --dry-run albo --apply (domyślnego trybu celowo nie ma).');
  if (!odcisk)
    throw new Error(
      'Brak --oczekiwany-host. Podaj fragment hosta bazy (np. trolley, 127.0.0.1). Bez deklaracji skrypt nie wie, w co celuje.'
    );
  if (tryb === 'apply' && !hasloPlik)
    throw new Error('Przy --apply podaj --haslo-plik <ścieżka POZA repo>. Hasła nie wchodzą do repozytorium.');
  if (hasloPlik && !hasloPlik.startsWith('/'))
    throw new Error('--haslo-plik musi być ścieżką bezwzględną poza repozytorium.');

  for (const k of konta) {
    if (String(k.rolaUzytkownika).toUpperCase() === 'SUPERADMIN')
      throw new Error(`Odmowa: konto ${k.email} ma rolę SUPERADMIN. Ten seed nigdy nie nadaje superadmina.`);
  }
  if (alias) {
    konta = konta.map((k) => ({ ...k, email: k.email.replace('@', '+pilotaz@') }));
  }
  return { tryb, odcisk, hasloPlik, resetujHasla, alias, konta };
}

// ============================================================================
// Bramki celu — te same reguły co w scripts/demo/_wspolne.sh
// ============================================================================
function tozsamosc(url: string): string {
  const u = new URL(url);
  return `${u.hostname.toLowerCase()}:${u.port || '5432'}/${decodeURIComponent(u.pathname.replace(/^\//, '')).toLowerCase()}`;
}

function sprawdzCel(url: string, odcisk: string): string {
  const toz = tozsamosc(url);
  if (/centerbeam/i.test(toz)) throw new Error('Cel wskazuje PRODUKCJĘ (centerbeam). STOP.');
  const host = toz.split('/')[0]!;
  if (!host.includes(odcisk))
    throw new Error(`Cel NIE pasuje do deklaracji --oczekiwany-host „${odcisk}" (host nie jest pokazywany). STOP.`);
  return toz;
}

function losoweHaslo(): string {
  // 18 znaków base64url ≈ 108 bitów entropii. Bez znaków mylących w mowie.
  return crypto.randomBytes(14).toString('base64url').replace(/[-_]/g, 'x');
}

// ============================================================================
// Główna procedura
// ============================================================================
type Plan = {
  organizacja: 'utworzy' | 'zaktualizuje' | 'bez zmian';
  konta: Array<{ email: string; akcja: 'utworzy' | 'zaktualizuje' | 'bez zmian' | 'KONFLIKT'; powod?: string }>;
  czlonkostwa: Array<{ email: string; akcja: 'utworzy' | 'zaktualizuje' | 'bez zmian' }>;
};

async function zbudujPlan(c: PoolClient, orgId: string, konta: Konto[], resetujHasla: boolean): Promise<Plan> {
  const plan: Plan = { organizacja: 'utworzy', konta: [], czlonkostwa: [] };

  const org = await c.query<{ id: string; name: string; organization_type: string; is_active: number }>(
    'SELECT id, name, organization_type, is_active FROM organizations WHERE id = $1',
    [orgId]
  );
  if (org.rows.length > 0) {
    const r = org.rows[0]!;
    plan.organizacja =
      r.name === ORG_NAZWA && r.organization_type === 'PAID' && Number(r.is_active) === 1
        ? 'bez zmian'
        : 'zaktualizuje';
  }

  for (const k of konta) {
    const userId = det('user', k.email);
    const istnieje = await c.query<{ id: string; organization_id: string | null; first_name: string | null; last_name: string | null; role: string | null; status: string | null }>(
      'SELECT id, organization_id, first_name, last_name, role, status FROM users WHERE email = $1',
      [k.email]
    );

    if (istnieje.rows.length === 0) {
      plan.konta.push({ email: k.email, akcja: 'utworzy' });
      plan.czlonkostwa.push({ email: k.email, akcja: 'utworzy' });
      continue;
    }

    const u = istnieje.rows[0]!;
    if (String(u.organization_id || '') !== orgId) {
      plan.konta.push({
        email: k.email,
        akcja: 'KONFLIKT',
        powod: `konto istnieje już w innej organizacji (organization_id="${u.organization_id ?? '(puste)'}"). E-mail jest globalnie unikalny — nie przenoszę. Użyj --alias albo rozstrzygnij z właścicielem.`,
      });
      continue;
    }
    if (u.id !== userId) {
      plan.konta.push({
        email: k.email,
        akcja: 'KONFLIKT',
        powod: `konto istnieje z innym id niż deterministyczne (${u.id} ≠ ${userId}). Nie przepisuję cudzego rekordu.`,
      });
      continue;
    }

    const trzebaZmienic =
      u.first_name !== k.imie || u.last_name !== k.nazwisko || u.role !== k.rolaUzytkownika || u.status !== 'active';
    plan.konta.push({ email: k.email, akcja: trzebaZmienic || resetujHasla ? 'zaktualizuje' : 'bez zmian' });

    const czl = await c.query<{ role: string; status: string | null }>(
      'SELECT role, status FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [orgId, userId]
    );
    if (czl.rows.length === 0) plan.czlonkostwa.push({ email: k.email, akcja: 'utworzy' });
    else
      plan.czlonkostwa.push({
        email: k.email,
        akcja: czl.rows[0]!.role === k.rolaCzlonka && czl.rows[0]!.status === 'ACTIVE' ? 'bez zmian' : 'zaktualizuje',
      });
  }
  return plan;
}

async function main() {
  const opcje = czytajArgumenty(process.argv.slice(2));
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Brak DATABASE_URL.');
  const toz = sprawdzCel(url, opcje.odcisk);

  const orgId = det('org', ORG_NAZWA);
  const pool = new Pool({ connectionString: url, ssl: false, max: 2 });
  const c = await pool.connect();

  try {
    console.log(`[pilotaz] cel:          ${toz}`);
    console.log(`[pilotaz] organizacja:  ${ORG_NAZWA} (id ${orgId})`);
    console.log(`[pilotaz] tryb:         ${opcje.tryb}${opcje.alias ? ' (aliasy +pilotaz)' : ''}`);

    const plan = await zbudujPlan(c, orgId, opcje.konta, opcje.resetujHasla);
    const konflikty = plan.konta.filter((k) => k.akcja === 'KONFLIKT');

    console.log('\n--- PLAN ---');
    console.log(`organizacja: ${plan.organizacja}`);
    for (const k of plan.konta) console.log(`konto        ${k.email.padEnd(38)} ${k.akcja}${k.powod ? ' — ' + k.powod : ''}`);
    for (const m of plan.czlonkostwa) console.log(`członkostwo  ${m.email.padEnd(38)} ${m.akcja}`);

    if (konflikty.length > 0) {
      console.error(`\n[pilotaz] KONFLIKTY: ${konflikty.length}. Nic nie zapisano — to decyzja właściciela, nie skryptu.`);
      process.exitCode = 2;
      return;
    }

    if (opcje.tryb === 'dry-run') {
      const doZmiany =
        (plan.organizacja !== 'bez zmian' ? 1 : 0) +
        plan.konta.filter((k) => k.akcja !== 'bez zmian').length +
        plan.czlonkostwa.filter((m) => m.akcja !== 'bez zmian').length;
      console.log(`\n[pilotaz] dry-run: ${doZmiany} rzeczy do zmiany. Nic nie zapisano.`);
      return;
    }

    // --- ZAPIS ---------------------------------------------------------------
    const hasla: Array<{ email: string; haslo: string }> = [];
    let utworzono = 0;
    let zmieniono = 0;

    await c.query('BEGIN');

    if (plan.organizacja !== 'bez zmian') {
      await c.query(
        `INSERT INTO organizations (id, name, plan, status, industry, organization_type, is_active, default_language, default_timezone)
         VALUES ($1, $2, 'free', 'active', 'Consulting', 'PAID', 1, 'pl', 'Europe/Warsaw')
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name,
                                        organization_type = EXCLUDED.organization_type,
                                        is_active = EXCLUDED.is_active`,
        [orgId, ORG_NAZWA]
      );
      if (plan.organizacja === 'utworzy') utworzono++;
      else zmieniono++;
    }

    for (const k of opcje.konta) {
      const userId = det('user', k.email);
      const stan = plan.konta.find((p) => p.email === k.email)!.akcja;
      if (stan === 'bez zmian' && !opcje.resetujHasla) continue;

      if (stan === 'utworzy') {
        const haslo = losoweHaslo();
        hasla.push({ email: k.email, haslo });
        await c.query(
          `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status, locale, timezone)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', 'pl', 'Europe/Warsaw')`,
          [userId, orgId, k.email, await bcrypt.hash(haslo, 10), k.imie, k.nazwisko, k.rolaUzytkownika]
        );
        utworzono++;
      } else {
        if (opcje.resetujHasla) {
          const haslo = losoweHaslo();
          hasla.push({ email: k.email, haslo });
          await c.query('UPDATE users SET password = $1 WHERE id = $2', [await bcrypt.hash(haslo, 10), userId]);
        }
        await c.query(
          `UPDATE users SET first_name = $1, last_name = $2, role = $3, status = 'active' WHERE id = $4`,
          [k.imie, k.nazwisko, k.rolaUzytkownika, userId]
        );
        zmieniono++;
      }
    }

    for (const k of opcje.konta) {
      const userId = det('user', k.email);
      const stan = plan.czlonkostwa.find((p) => p.email === k.email)!.akcja;
      if (stan === 'bez zmian') continue;
      await c.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, $4, 'ACTIVE')
         ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'ACTIVE'`,
        [det('member', `${orgId}|${k.email}`), orgId, userId, k.rolaCzlonka]
      );
      if (stan === 'utworzy') utworzono++;
      else zmieniono++;
    }

    // Właściciel organizacji = konto administratora pilotażu (nie superadmin).
    const adminId = det('user', opcje.konta[0]!.email);
    await c.query('UPDATE organizations SET owner_id = $1 WHERE id = $2 AND owner_id IS DISTINCT FROM $1', [
      adminId,
      orgId,
    ]);

    await c.query('COMMIT');

    if (hasla.length > 0) {
      fs.writeFileSync(
        opcje.hasloPlik,
        `# Hasła startowe — organizacja „${ORG_NAZWA}" (${new Date().toISOString()})\n` +
          `# PLIK POZA REPOZYTORIUM. Przekaż właścicielowi kanałem prywatnym i skasuj.\n` +
          hasla.map((h) => `${h.email}\t${h.haslo}`).join('\n') +
          '\n',
        { mode: 0o600 }
      );
      console.log(`\n[pilotaz] hasła (${hasla.length}) zapisane do ${opcje.hasloPlik} (chmod 600). NIE są drukowane.`);
    }

    console.log(`\n[pilotaz] utworzono=${utworzono} zmieniono=${zmieniono}`);
    if (utworzono === 0 && zmieniono === 0) console.log('[pilotaz] idempotentnie: nic nie było do zrobienia.');
  } catch (e) {
    try {
      await c.query('ROLLBACK');
    } catch {
      /* transakcja mogła nie być otwarta */
    }
    throw e;
  } finally {
    c.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(`[pilotaz] BŁĄD: ${(e as Error).message}`);
  process.exit(1);
});
