#!/usr/bin/env tsx
/**
 * SEED — czysta organizacja pilotażowa „DBR77 Pilotaż" + 7 osób pierwszej linii
 * + 1 konto administratora organizacji.
 *
 * PO CO. Pojemnik 2 (`docs/program/TRZY_POJEMNIKI_PRACY_20260906.md`) = pilotaż
 * na demo. DEC-402 (właściciel, 2026-09-06 —
 * `docs/program/demo-pilotaz/PLAN_DEMO_KLIENCI_I_POKAZY.md` §5) rozszerzył listę
 * do 7 osób, ustalił konta na aliasach `+pilotaz`, jedną wspólną organizację
 * typu PAID. Żeby weszli bez asysty właściciela, organizacja i konta muszą już
 * istnieć na bazie docelowej, z rolami, które NIE są superadminem.
 *
 * UŻYCIE
 *   DATABASE_URL=… npx tsx scripts/demo/seed-organizacja-pilotaz.ts --oczekiwany-host trolley --dry-run
 *   DATABASE_URL=… npx tsx scripts/demo/seed-organizacja-pilotaz.ts --oczekiwany-host trolley --apply \
 *     --haslo-plik /private/tmp/pilotaz-hasla.json
 *   DATABASE_URL=… npx tsx scripts/demo/seed-organizacja-pilotaz.ts --oczekiwany-host trolley --apply --resetuj-hasla \
 *     --haslo-plik /private/tmp/pilotaz-hasla.json
 *   DATABASE_URL=… npx tsx scripts/demo/seed-organizacja-pilotaz.ts --oczekiwany-host trolley --rollback
 *
 * LISTA 7 OSÓB: `scripts/demo/pilotaz-uzytkownicy.json` (SSOT — DEC-402).
 * Podmień przez `--konta <plik.json>`, jeśli trzeba inny zestaw; skrypt nie
 * zgaduje w tle.
 *
 * ADMINISTRATOR ORGANIZACJI — rozstrzygane W CZASIE DZIAŁANIA, nie w pliku:
 *   1. jeśli podano `--admin-email <e-mail>` — użyj go,
 *   2. inaczej spróbuj `piotr.wisniewski@dbr77.com` (prawdziwe konto właściciela
 *      na bazie docelowej), a gdy go nie ma — `audyt@dbr77.local` (konto do
 *      audytu na bazach lokalnych/testowych, patrz RUNBOOK).
 *   Jeśli wybrany e-mail JUŻ ISTNIEJE w bazie (w dowolnej organizacji) — skrypt
 *   NIGDY nie rusza tego konta (żadnej zmiany hasła/roli/organizacji, zero
 *   ryzyka „wymuszony superadmin zapisuje się w bazie"). Dopisuje mu wyłącznie
 *   członkostwo OWNER w organizacji pilotażu (multi-org member —
 *   `organization_members` niesie to niezależnie od `users.organization_id`,
 *   tak jak `20260412_organization_switch_log.sql`). Jeśli e-mail NIE istnieje
 *   nigdzie — skrypt zakłada nowe konto administratora (dom. `audyt@dbr77.local`)
 *   jako właściciela organizacji pilotażu.
 *
 * IDEMPOTENCJA (twarda, nie deklarowana)
 *   · identyfikatory 7 osób są DETERMINISTYCZNE (UUIDv5 z tagu + e-mail),
 *   · istniejące konto NIE dostaje nowego hasła — chyba że jawnie `--resetuj-hasla`,
 *   · drugi `--apply` bez `--resetuj-hasla` musi dać `utworzono=0 zmieniono=0`.
 *   To jest mierzone w evidence/demo-pilotaz/, nie zakładane.
 *
 * CZEGO NIE ROBI — CELOWO
 *   · NIE ustawia `users.role = 'SUPERADMIN'` (i odmawia, gdyby ktoś podał taką
 *     rolę w konfiguracji). Wymuszony superadmin zapisuje się w bazie na trwałe
 *     i odbiera dostęp do /chat — pamięć nadzorcy „wymuszony-superadmin-zapisuje-sie-w-bazie".
 *   · NIE zapisuje haseł w repozytorium ani na stdout. Hasła są losowane i
 *     lądują WYŁĄCZNIE w pliku poza repo (chmod 600), którego ścieżkę podaje
 *     wołający przez `--haslo-plik`.
 *   · NIE przenosi istniejącego konta między organizacjami (e-mail jest globalnie
 *     unikalny — `users_email_key`). Taki przypadek to KONFLIKT dla jednej z 7
 *     osób: skrypt go raportuje i kończy bez zapisu, bo decyzja „przenieść czy
 *     założyć alias" należy do właściciela. (Dla administratora patrz wyżej —
 *     tam cudze konto jest zamierzone i obsłużone bez przenoszenia.)
 *   · `--rollback` kasuje TYLKO to, co sam mógł utworzyć: organizację pilotażu,
 *     7 kont z pliku konfiguracyjnego oraz konto administratora — ale WYŁĄCZNIE
 *     jeśli jego `organization_id` to organizacja pilotażu (czyli seed je
 *     utworzył). Cudze, wcześniej istniejące konto administratora nigdy nie
 *     jest kasowane — usuwana jest tylko jego więź (członkostwo), przez kasację
 *     organizacji (ON DELETE CASCADE na `organization_members`).
 *
 * TYP ORGANIZACJI = PAID, i to nie jest kosmetyka.
 *   `server/src/services/access/AccessTypes.ts` — DEFAULT_TRIAL_LIMITS ma
 *   `max_users: 4` (właściciel + 3), DEFAULT_DEMO_LIMITS ma `max_users: 1`.
 *   Pilotaż to 8 kont, więc na TRIAL/DEMO piąte konto już uderzyłoby w limit.
 *   DEFAULT_PAID_LIMITS ma `max_users: 10000` — 8 kont mieści się bez problemu.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import bcrypt from 'bcryptjs';
import { Pool, type PoolClient } from 'pg';

const TU = path.dirname(fileURLToPath(import.meta.url));

// ============================================================================
// Tożsamość seeda
// ============================================================================
const TAG = 'seed:demo-pilotaz-20260906';
const PRZESTRZEN = '8b1d4e77-2a06-5c39-9f14-6d2c0b7e5a83';
const ORG_NAZWA = 'DBR77 Pilotaż';
const PLIK_KONT_DOMYSLNY = path.join(TU, 'pilotaz-uzytkownicy.json');
const DOMENA_OCZEKIWANA = 'dbr77.com';

// Kolejność prób przy rozstrzyganiu administratora, gdy nie podano --admin-email.
const KANDYDACI_ADMIN = ['piotr.wisniewski@dbr77.com', 'audyt@dbr77.local'];

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
// Konta pilotażu — wczytywane z JSON (domyślnie `pilotaz-uzytkownicy.json`)
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

type WpisJson = { imie: string; nazwisko: string; email: string; rola: Konto['rolaCzlonka'] };

function wczytajKonta(sciezka: string): Konto[] {
  const surowe = JSON.parse(fs.readFileSync(sciezka, 'utf8'));
  const wpisy: WpisJson[] = Array.isArray(surowe) ? surowe : surowe.uzytkownicy;
  if (!Array.isArray(wpisy)) throw new Error(`Plik kont ${sciezka} nie zawiera listy „uzytkownicy".`);
  return wpisy.map((w) => {
    // Format „surowy" (Konto[] wprost, np. z testów) ma już rolaUzytkownika/rolaCzlonka.
    const juzKonto = w as unknown as Partial<Konto>;
    if (juzKonto.rolaUzytkownika && juzKonto.rolaCzlonka) return juzKonto as Konto;
    return {
      email: w.email,
      imie: w.imie,
      nazwisko: w.nazwisko,
      rolaUzytkownika: 'USER',
      rolaCzlonka: w.rola,
    };
  });
}

// ============================================================================
// Argumenty
// ============================================================================
type Opcje = {
  tryb: 'dry-run' | 'apply' | 'rollback';
  odcisk: string;
  hasloPlik: string;
  resetujHasla: boolean;
  adminEmail: string;
  konta: Konto[];
};

function czytajArgumenty(argv: string[]): Opcje {
  let tryb: Opcje['tryb'] | null = null;
  let odcisk = '';
  let hasloPlik = '';
  let resetujHasla = false;
  let adminEmail = '';
  let kontaPlik = PLIK_KONT_DOMYSLNY;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--dry-run') tryb = 'dry-run';
    else if (a === '--apply') tryb = 'apply';
    else if (a === '--rollback') tryb = 'rollback';
    else if (a === '--resetuj-hasla') resetujHasla = true;
    else if (a === '--oczekiwany-host') odcisk = argv[++i] ?? '';
    else if (a.startsWith('--oczekiwany-host=')) odcisk = a.split('=').slice(1).join('=');
    else if (a === '--haslo-plik') hasloPlik = argv[++i] ?? '';
    else if (a.startsWith('--haslo-plik=')) hasloPlik = a.split('=').slice(1).join('=');
    else if (a === '--admin-email') adminEmail = argv[++i] ?? '';
    else if (a.startsWith('--admin-email=')) adminEmail = a.split('=').slice(1).join('=');
    else if (a === '--konta') kontaPlik = argv[++i]!;
    else if (a.startsWith('--konta=')) kontaPlik = a.split('=').slice(1).join('=');
    else throw new Error(`Nieznany argument: ${a}`);
  }

  if (!tryb) throw new Error('Podaj --dry-run, --apply albo --rollback (domyślnego trybu celowo nie ma).');
  if (!odcisk)
    throw new Error(
      'Brak --oczekiwany-host. Podaj fragment hosta bazy (np. trolley, 127.0.0.1). Bez deklaracji skrypt nie wie, w co celuje.'
    );
  if (tryb === 'apply' && !hasloPlik)
    throw new Error(
      'Przy --apply podaj --haslo-plik <ścieżka POZA repo>. Hasła nie wchodzą do repozytorium (domyślna ścieżka runbooku: /private/tmp/stanowisko-noc/pilotaz-hasla-<data>.json).'
    );
  if (hasloPlik && !hasloPlik.startsWith('/'))
    throw new Error('--haslo-plik musi być ścieżką bezwzględną poza repozytorium.');

  const konta = wczytajKonta(kontaPlik);
  for (const k of konta) {
    if (String(k.rolaUzytkownika).toUpperCase() === 'SUPERADMIN')
      throw new Error(`Odmowa: konto ${k.email} ma rolę SUPERADMIN. Ten seed nigdy nie nadaje superadmina.`);
  }
  return { tryb, odcisk, hasloPlik, resetujHasla, adminEmail, konta };
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

function ostrzezeniaDomen(konta: Konto[]): string[] {
  return konta
    .filter((k) => !k.email.toLowerCase().endsWith(`@${DOMENA_OCZEKIWANA}`))
    .map(
      (k) =>
        `[pilotaz] OSTRZEŻENIE: ${k.email} — domena różna od ${DOMENA_OCZEKIWANA} — potwierdzić z właścicielem przed wysyłką zaproszenia.`
    );
}

// ============================================================================
// Administrator — rozstrzygany w czasie działania (patrz komentarz na górze pliku)
// ============================================================================
type Administrator = {
  email: string;
  userId: string;
  istnieje: boolean; // true = konto już jest w bazie (gdziekolwiek) — nie ruszamy go
  utworzonyPrzezSeed: boolean; // true tylko gdy istnieje ORAZ jego organization_id == orgId pilotażu
  imie: string;
  nazwisko: string;
};

async function ustalAdministratora(c: PoolClient, orgId: string, jawnyEmail: string): Promise<Administrator> {
  const kandydaci = jawnyEmail ? [jawnyEmail] : KANDYDACI_ADMIN;
  for (const email of kandydaci) {
    const r = await c.query<{ id: string; organization_id: string | null }>(
      'SELECT id, organization_id FROM users WHERE email = $1',
      [email]
    );
    if (r.rows.length > 0) {
      const u = r.rows[0]!;
      return {
        email,
        userId: u.id,
        istnieje: true,
        utworzonyPrzezSeed: String(u.organization_id || '') === orgId,
        imie: '',
        nazwisko: '',
      };
    }
  }
  const email = kandydaci[kandydaci.length - 1]!;
  return {
    email,
    userId: det('user', email),
    istnieje: false,
    utworzonyPrzezSeed: false, // jeszcze nie — stanie się true po zapisie
    imie: 'Administrator',
    nazwisko: 'Pilotażu',
  };
}

// ============================================================================
// Główna procedura — plan
// ============================================================================
type Plan = {
  organizacja: 'utworzy' | 'zaktualizuje' | 'bez zmian';
  admin: { email: string; akcja: 'utworzy konto+członkostwo' | 'dodaj członkostwo (konto cudze/istniejące)' | 'bez zmian' };
  konta: Array<{ email: string; akcja: 'utworzy' | 'zaktualizuje' | 'bez zmian' | 'KONFLIKT'; powod?: string }>;
  czlonkostwa: Array<{ email: string; akcja: 'utworzy' | 'zaktualizuje' | 'bez zmian' }>;
};

async function zbudujPlan(
  c: PoolClient,
  orgId: string,
  admin: Administrator,
  konta: Konto[],
  resetujHasla: boolean
): Promise<Plan> {
  const plan: Plan = {
    organizacja: 'utworzy',
    admin: { email: admin.email, akcja: 'utworzy konto+członkostwo' },
    konta: [],
    czlonkostwa: [],
  };

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

  // --- Administrator ---------------------------------------------------------
  const czlAdmin = await c.query<{ role: string; status: string | null }>(
    'SELECT role, status FROM organization_members WHERE organization_id = $1 AND user_id = $2',
    [orgId, admin.userId]
  );
  const czlonkostwoAdminOk = czlAdmin.rows.length > 0 && czlAdmin.rows[0]!.role === 'OWNER' && czlAdmin.rows[0]!.status === 'ACTIVE';
  if (!admin.istnieje) {
    plan.admin.akcja = 'utworzy konto+członkostwo';
  } else if (!czlonkostwoAdminOk) {
    plan.admin.akcja = 'dodaj członkostwo (konto cudze/istniejące)';
  } else {
    plan.admin.akcja = 'bez zmian';
  }

  // --- 7 osób ------------------------------------------------------------------
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
        powod: `konto istnieje już w innej organizacji (organization_id="${u.organization_id ?? '(puste)'}"). E-mail jest globalnie unikalny — nie przenoszę. Rozstrzygnij z właścicielem.`,
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

// ============================================================================
// Rollback — kasuje TYLKO to, co seed sam mógł utworzyć
// ============================================================================
async function rollback(c: PoolClient, orgId: string, admin: Administrator, konta: Konto[]): Promise<void> {
  const org = await c.query('SELECT id FROM organizations WHERE id = $1', [orgId]);
  if (org.rows.length === 0) {
    console.log('[pilotaz] rollback: organizacja pilotażu już nie istnieje — nic do zrobienia (usunieto=0).');
    return;
  }

  // ★ MANIFEST bez osobnego pliku: „utworzone przez seed" = deterministyczne id
  // Z 7-osobowej listy (zawsze nasze — KONFLIKT blokuje apply, więc nigdy nie
  // trafiają tu cudze konta) ORAZ konto administratora, ale TYLKO jeśli jego
  // organization_id to organizacja pilotażu (czyli to seed je założył, a nie
  // cudze, wcześniej istniejące konto). To jest jedyny warunek chroniący cudze
  // konta administratora przed skasowaniem — nie wolno go pominąć.
  const idsKandydatow = konta.map((k) => det('user', k.email));
  const idsDoUsuniecia: string[] = [];
  for (const id of idsKandydatow) {
    const r = await c.query<{ organization_id: string | null }>('SELECT organization_id FROM users WHERE id = $1', [id]);
    if (r.rows.length > 0 && String(r.rows[0]!.organization_id || '') === orgId) idsDoUsuniecia.push(id);
  }
  const adminR = await c.query<{ organization_id: string | null }>('SELECT organization_id FROM users WHERE id = $1', [
    admin.userId,
  ]);
  const adminUtworzonyPrzezSeed = adminR.rows.length > 0 && String(adminR.rows[0]!.organization_id || '') === orgId;
  if (adminUtworzonyPrzezSeed) idsDoUsuniecia.push(admin.userId);
  else
    console.log(
      `[pilotaz] rollback: konto administratora (${admin.email}) NIE jest kasowane — nie zostało utworzone przez ten seed (albo jego organizacja domowa jest inna). Kasowane jest tylko jego członkostwo, przez usunięcie organizacji.`
    );

  // Kolejność ma znaczenie — i to w OBIE STRONY naraz (cykl FK, oba NO ACTION,
  // zmierzone testem izolacji, nie założone):
  //   `organizations.owner_id`      → users.id           (blokuje kasowanie admina, dopóki org istnieje)
  //   `users.organization_id`       → organizations.id   (blokuje kasowanie org, dopóki konta istnieją)
  // Jedyne bezpieczne wyjście: najpierw ZERUJEMY owner_id (zrywamy jedną
  // krawędź cyklu), potem kasujemy konta, na końcu organizację (co kaskadowo
  // zabiera `organization_members` — tam FK JEST cascade).
  await c.query('UPDATE organizations SET owner_id = NULL WHERE id = $1', [orgId]);
  const usunieciKonta = idsDoUsuniecia.length > 0 ? (await c.query('DELETE FROM users WHERE id = ANY($1::text[])', [idsDoUsuniecia])).rowCount ?? 0 : 0;
  await c.query('DELETE FROM organizations WHERE id = $1', [orgId]);

  console.log(`[pilotaz] rollback: usunięto organizację + ${usunieciKonta} kont (z ${idsKandydatow.length + 1} kandydatów).`);
}

// ============================================================================
// main
// ============================================================================
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
    console.log(`[pilotaz] tryb:         ${opcje.tryb}`);

    for (const w of ostrzezeniaDomen(opcje.konta)) console.log(w);

    const admin = await ustalAdministratora(c, orgId, opcje.adminEmail);
    console.log(
      `[pilotaz] administrator: ${admin.email} (${admin.istnieje ? 'konto już istnieje w bazie' : 'zostanie założone'})`
    );

    if (opcje.tryb === 'rollback') {
      await rollback(c, orgId, admin, opcje.konta);
      return;
    }

    const plan = await zbudujPlan(c, orgId, admin, opcje.konta, opcje.resetujHasla);
    const konflikty = plan.konta.filter((k) => k.akcja === 'KONFLIKT');

    console.log('\n--- PLAN ---');
    console.log(`organizacja: ${plan.organizacja}`);
    console.log(`administrator ${plan.admin.email.padEnd(38)} ${plan.admin.akcja}`);
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
        (plan.admin.akcja !== 'bez zmian' ? 1 : 0) +
        plan.konta.filter((k) => k.akcja !== 'bez zmian').length +
        plan.czlonkostwa.filter((m) => m.akcja !== 'bez zmian').length;
      console.log(`\n[pilotaz] dry-run: plan obejmuje 8 kont (7 + administrator). ${doZmiany} rzeczy do zmiany. Nic nie zapisano.`);
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

    // --- Administrator ---------------------------------------------------------
    if (plan.admin.akcja === 'utworzy konto+członkostwo') {
      const haslo = losoweHaslo();
      hasla.push({ email: admin.email, haslo });
      await c.query(
        `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status, locale, timezone)
         VALUES ($1, $2, $3, $4, $5, $6, 'ADMIN', 'active', 'pl', 'Europe/Warsaw')`,
        [admin.userId, orgId, admin.email, await bcrypt.hash(haslo, 10), admin.imie, admin.nazwisko]
      );
      utworzono++;
    }
    if (plan.admin.akcja !== 'bez zmian') {
      await c.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, 'OWNER', 'ACTIVE')
         ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'OWNER', status = 'ACTIVE'`,
        [det('member', `${orgId}|${admin.email}`), orgId, admin.userId]
      );
      if (plan.admin.akcja === 'utworzy konto+członkostwo') utworzono++;
      else zmieniono++;
    }

    // --- 7 osób ------------------------------------------------------------------
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

    // Właściciel organizacji = administrator pilotażu (istniejący albo nowy), nigdy superadmin.
    await c.query('UPDATE organizations SET owner_id = $1 WHERE id = $2 AND owner_id IS DISTINCT FROM $1', [
      admin.userId,
      orgId,
    ]);

    await c.query('COMMIT');

    if (hasla.length > 0) {
      fs.mkdirSync(path.dirname(opcje.hasloPlik), { recursive: true });
      fs.writeFileSync(
        opcje.hasloPlik,
        JSON.stringify(
          {
            komentarz: `Hasła startowe — organizacja „${ORG_NAZWA}" — PLIK POZA REPOZYTORIUM. Przekaż właścicielowi kanałem prywatnym i skasuj.`,
            wygenerowano: new Date().toISOString(),
            konta: hasla,
          },
          null,
          2
        ) + '\n',
        { mode: 0o600 }
      );
      fs.chmodSync(opcje.hasloPlik, 0o600);
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
