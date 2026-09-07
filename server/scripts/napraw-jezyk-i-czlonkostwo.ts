#!/usr/bin/env tsx
/**
 * Naprawa PIĘCIU problemów z danymi zmierzonych w
 * `docs/program/PROGRAM_NAPRAWCZY_20260905/DANE_PORZADKI_POMIAR.md`:
 *
 *   1. Angielskie nazwy inicjatyw (organization_id → initiatives.name/title)
 *   2. Angielskie tytuły decyzji i pozycji RAID (decisions.title, raid_items.title)
 *   3. Czterokrotnie powtórzone zadania — sygnatura: (title, status, assignee_id,
 *      initiative_id) występująca ≥4× w tej samej organizacji (retry bez
 *      idempotency_key — zob. pomiar: 4 identyczne wiersze co ~8-10s)
 *   4. Właściciele pozycji RAID bez wiersza w `organization_members` — użytkownik
 *      ISTNIEJE i ma poprawny `users.organization_id`, ale nie ma członkostwa,
 *      więc ekrany/API liczące uprawnienia z `organization_members` widzą go
 *      jako "spoza organizacji" (pomiar: 16/16 lokalnie, 0/0 na stagingu — brak
 *      pozycji RAID na stagingu).
 *   5. (dodane 2026-09-07) KAŻDY użytkownik organizacji bez wiersza
 *      w `organization_members` — NADZBIÓR problemu 4. Pomiar 07.09 na bazie
 *      stanowiska: DBR77 ma 31 użytkowników i 1 członkostwo (30 brakuje);
 *      siódemka z problemu 4 to podzbiór tej trzydziestki. Uruchamiany
 *      WYŁĄCZNIE jawnym `--problem=5`, nigdy przez `--problem=wszystkie`.
 *
 * KAŻDY problem naprawiany OSOBNO przez `--problem=1|2|3|4|5|wszystkie`.
 * Problemy 1 i 2 działają WYŁĄCZNIE po dopasowaniu DOKŁADNEGO tekstu ze
 * słownika `dane-porzadki/slownik-tlumaczen.json` — żadnego zgadywania,
 * żadnego wywołania modelu w środku skryptu. Tekst spoza słownika jest
 * pomijany i wypisywany jako "BRAK W SŁOWNIKU", nigdy nie tłumaczony na ślepo.
 *
 * Wzorzec 1:1 z `server/scripts/usun-rekordy-aco.ts` i
 * `server/scripts/higiena-wlasciciela/*` — dry-run domyślny, CSV planu +
 * manifest cofnięcia PRZED każdym zapisem, drugi `--apply` musi wypisać 0.
 *
 * UŻYCIE (z korzenia repo):
 *   DATABASE_URL="…" npx tsx server/scripts/napraw-jezyk-i-czlonkostwo.ts \
 *     --org=<uuid> --problem=1 --dry-run
 *   DATABASE_URL="…" npx tsx server/scripts/napraw-jezyk-i-czlonkostwo.ts \
 *     --org=<uuid> --problem=wszystkie --apply
 *   DATABASE_URL="…" npx tsx server/scripts/napraw-jezyk-i-czlonkostwo.ts \
 *     --org=<uuid> --rollback=evidence/higiena-danych/napraw-jezyk-i-czlonkostwo-…-manifest.json
 *
 * `--org` MUSI być podane jawnie (uuid albo nazwa dopasowana przez
 * `resolveOrg`, patrz `higiena-wlasciciela/wspolne.ts`) — żadnej wartości
 * domyślnej wpisanej na sztywno. `resolveOrg` już odmawia pracy, gdy
 * organizacja nie istnieje w bazie, do której skrypt się połączył (rzuca
 * wyjątek "oczekiwano dokładnie 1 wyniku, jest 0").
 */
import '../src/config/loadEnv.js';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';

import {
  qi,
  runMain,
  writeBackupCsv,
  writeManifest,
  readManifest,
  restore,
  csvCell,
  EVIDENCE_DIR,
  REPO_ROOT,
  iso,
  type Manifest,
  type ManifestEntry,
} from './higiena-wlasciciela/wspolne.js';

const SKRYPT = 'napraw-jezyk-i-czlonkostwo';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SLOWNIK_PATH = path.join(HERE, 'dane-porzadki', 'slownik-tlumaczen.json');

interface Slownik {
  initiatives: Record<string, string>;
  decisions: Record<string, string>;
  raid_items: Record<string, string>;
}

function wczytajSlownik(): Slownik {
  const raw = JSON.parse(fs.readFileSync(SLOWNIK_PATH, 'utf8'));
  return { initiatives: raw.initiatives ?? {}, decisions: raw.decisions ?? {}, raid_items: raw.raid_items ?? {} };
}

type Problem = '1' | '2' | '3' | '4' | '5' | 'wszystkie';

function parseProblem(argv = process.argv.slice(2)): Problem {
  const raw = argv.find((x) => x.startsWith('--problem='))?.slice('--problem='.length) ?? 'wszystkie';
  if (!['1', '2', '3', '4', '5', 'wszystkie'].includes(raw)) {
    throw new Error(`--problem musi być 1|2|3|4|5|wszystkie, jest: "${raw}"`);
  }
  return raw as Problem;
}

/** Wiersz planu — dokładnie kolumny wymagane w zleceniu: id, obecna wartość, proponowana wartość. */
interface WierszPlanu {
  tabela: string;
  id: string;
  obecna: string;
  proponowana: string;
}

function drukujIZapiszPlanCsv(nazwa: string, wiersze: WierszPlanu[]): string {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const sciezka = path.join(EVIDENCE_DIR, `${nazwa}-${iso()}-plan.csv`);
  const header = 'tabela,id,obecna_wartosc,proponowana_wartosc\n';
  const body = wiersze
    .map((w) => [w.tabela, w.id, w.obecna, w.proponowana].map(csvCell).join(','))
    .join('\n');
  fs.writeFileSync(sciezka, header + body + (body ? '\n' : ''));
  console.log('');
  console.log(`PLAN CSV (${wiersze.length} wierszy): ${sciezka}`);
  console.log(header.trim());
  for (const w of wiersze) {
    console.log(`  ${w.tabela} | ${w.id} | ${w.obecna} → ${w.proponowana}`);
  }
  return sciezka;
}

/* ────────────────────── Problem 1: nazwy inicjatyw ────────────────────── */

async function naprawInicjatywy(
  c: PoolClient,
  orgId: string,
  slownik: Slownik,
  apply: boolean,
  wpisy: ManifestEntry[]
): Promise<number> {
  const klucze = Object.keys(slownik.initiatives);
  if (klucze.length === 0) return 0;
  const { rows } = await c.query<{ id: string; name: string; title: string | null }>(
    `SELECT id, name, title FROM initiatives WHERE organization_id = $1 AND name = ANY($2::text[])`,
    [orgId, klucze]
  );
  const plan: WierszPlanu[] = rows.map((r) => ({
    tabela: 'initiatives',
    id: r.id,
    obecna: r.name,
    proponowana: slownik.initiatives[r.name]!,
  }));
  drukujIZapiszPlanCsv('problem1-inicjatywy', plan);

  const pominiete = Object.values(slownik.initiatives).length; // informacyjnie w logu poniżej
  console.log(`Dopasowania w bazie: ${rows.length} / pozycji w słowniku: ${pominiete}`);

  if (!apply) return rows.length;

  for (const r of rows) {
    const nowaNazwa = slownik.initiatives[r.name]!;
    wpisy.push({ table: 'initiatives', idColumn: 'id', id: r.id, action: 'archive', before: r as unknown as Record<string, unknown> });
    if (r.title === r.name) {
      await c.query(`UPDATE initiatives SET name = $1, title = $1, updated_at = NOW() WHERE id = $2 AND name = $3`, [
        nowaNazwa,
        r.id,
        r.name,
      ]);
    } else {
      await c.query(`UPDATE initiatives SET name = $1, updated_at = NOW() WHERE id = $2 AND name = $3`, [
        nowaNazwa,
        r.id,
        r.name,
      ]);
    }
  }
  return rows.length;
}

/* ──────────────── Problem 2: tytuły decyzji i pozycji RAID ────────────── */

async function naprawDecyzje(
  c: PoolClient,
  orgId: string,
  slownik: Slownik,
  apply: boolean,
  wpisy: ManifestEntry[]
): Promise<number> {
  const klucze = Object.keys(slownik.decisions);
  if (klucze.length === 0) return 0;
  const { rows } = await c.query<{ id: string; title: string }>(
    `SELECT id, title FROM decisions WHERE organization_id = $1 AND title = ANY($2::text[])`,
    [orgId, klucze]
  );
  const plan: WierszPlanu[] = rows.map((r) => ({
    tabela: 'decisions',
    id: r.id,
    obecna: r.title,
    proponowana: slownik.decisions[r.title]!,
  }));
  drukujIZapiszPlanCsv('problem2-decyzje', plan);
  if (!apply) return rows.length;

  for (const r of rows) {
    wpisy.push({ table: 'decisions', idColumn: 'id', id: r.id, action: 'archive', before: r as unknown as Record<string, unknown> });
    await c.query(`UPDATE decisions SET title = $1, updated_at = NOW() WHERE id = $2 AND title = $3`, [
      slownik.decisions[r.title]!,
      r.id,
      r.title,
    ]);
  }
  return rows.length;
}

async function naprawRaid(
  c: PoolClient,
  orgId: string,
  slownik: Slownik,
  apply: boolean,
  wpisy: ManifestEntry[]
): Promise<number> {
  const klucze = Object.keys(slownik.raid_items);
  if (klucze.length === 0) return 0;
  const { rows } = await c.query<{ id: string; title: string }>(
    `SELECT id, title FROM raid_items WHERE organization_id = $1 AND title = ANY($2::text[])`,
    [orgId, klucze]
  );
  const plan: WierszPlanu[] = rows.map((r) => ({
    tabela: 'raid_items',
    id: r.id,
    obecna: r.title,
    proponowana: slownik.raid_items[r.title]!,
  }));
  drukujIZapiszPlanCsv('problem2-raid', plan);
  if (!apply) return rows.length;

  for (const r of rows) {
    wpisy.push({ table: 'raid_items', idColumn: 'id', id: r.id, action: 'archive', before: r as unknown as Record<string, unknown> });
    await c.query(`UPDATE raid_items SET title = $1, updated_at = NOW() WHERE id = $2 AND title = $3`, [
      slownik.raid_items[r.title]!,
      r.id,
      r.title,
    ]);
  }
  return rows.length;
}

/* ──────────────── Problem 3: 4x powtórzone zadania ────────────── */

interface GrupaDuplikatow {
  title: string;
  status: string;
  assignee_id: string | null;
  initiative_id: string | null;
  n: number;
  ids: string[];
  createds: string[];
}

async function naprawDuplikatyZadan(
  c: PoolClient,
  orgId: string,
  apply: boolean,
  wpisy: ManifestEntry[]
): Promise<number> {
  const { rows } = await c.query<GrupaDuplikatow>(
    `SELECT title, status, assignee_id, initiative_id, count(*)::int AS n,
            array_agg(id ORDER BY created_at) AS ids,
            array_agg(created_at::text ORDER BY created_at) AS createds
       FROM tasks
      WHERE organization_id = $1
      GROUP BY title, status, assignee_id, initiative_id
     HAVING count(*) >= 4
      ORDER BY n DESC`,
    [orgId]
  );

  const plan: WierszPlanu[] = [];
  const doUsuniecia: string[] = [];
  for (const g of rows) {
    const [zachowaj, ...reszta] = g.ids;
    for (let i = 0; i < reszta.length; i++) {
      const id = reszta[i]!;
      plan.push({
        tabela: 'tasks',
        id,
        obecna: `"${g.title}" (kopia ${i + 2}/${g.n}, utworzono ${g.createds[i + 1]})`,
        proponowana: `USUNIĘCIE — duplikat retry; zachowany oryginał: ${zachowaj} (utworzono ${g.createds[0]})`,
      });
      doUsuniecia.push(id);
    }
  }
  drukujIZapiszPlanCsv('problem3-duplikaty-zadan', plan);
  console.log(`Grup duplikatów (≥4×): ${rows.length} · wierszy do usunięcia: ${doUsuniecia.length}`);

  if (!apply) return doUsuniecia.length;
  if (doUsuniecia.length === 0) return 0;

  const { rows: pelne } = await c.query<Record<string, unknown>>(
    `SELECT * FROM tasks WHERE id = ANY($1::text[])`,
    [doUsuniecia]
  );
  const backupCsv = writeBackupCsv('tasks', pelne);
  for (const wiersz of pelne) {
    wpisy.push({ table: 'tasks', idColumn: 'id', id: String(wiersz.id), action: 'delete', before: wiersz, backupCsv });
  }
  const wynik = await c.query(`DELETE FROM tasks WHERE id = ANY($1::text[])`, [doUsuniecia]);
  return wynik.rowCount ?? 0;
}

/* ──────────────── Problem 4: właściciele RAID bez organization_members ────────────── */

interface KandydatCzlonkostwa {
  owner_id: string;
  email: string | null;
  user_org: string | null;
  raid_ids: string[];
}

async function naprawCzlonkostwoRaid(
  c: PoolClient,
  orgId: string,
  apply: boolean,
  wpisy: ManifestEntry[]
): Promise<number> {
  const { rows } = await c.query<KandydatCzlonkostwa>(
    `SELECT r.owner_id AS owner_id, u.email AS email, u.organization_id AS user_org,
            array_agg(r.id) AS raid_ids
       FROM raid_items r
       LEFT JOIN users u ON u.id = r.owner_id
       LEFT JOIN organization_members om ON om.user_id = r.owner_id AND om.organization_id = r.organization_id
      WHERE r.organization_id = $1 AND om.id IS NULL
      GROUP BY r.owner_id, u.email, u.organization_id
      ORDER BY email`,
    [orgId]
  );

  const bezpieczne = rows.filter((r) => r.user_org === orgId);
  const niebezpieczne = rows.filter((r) => r.user_org !== orgId);

  const plan: WierszPlanu[] = [
    ...bezpieczne.map((r) => ({
      tabela: 'organization_members',
      id: r.owner_id,
      obecna: `${r.email ?? r.owner_id} — brak wiersza organization_members (${r.raid_ids.length} poz. RAID: ${r.raid_ids.join(', ')})`,
      proponowana: `INSERT organization_members (role=MEMBER, status=ACTIVE) — użytkownik ma poprawny users.organization_id`,
    })),
    ...niebezpieczne.map((r) => ({
      tabela: 'organization_members',
      id: r.owner_id,
      obecna: `${r.email ?? r.owner_id ?? '(brak wiersza users)'} — user_org=${r.user_org ?? 'BRAK UŻYTKOWNIKA'} (${r.raid_ids.length} poz. RAID: ${r.raid_ids.join(', ')})`,
      proponowana: `BRAK BEZPIECZNEJ NAPRAWY — właściciel spoza tej organizacji (albo nie istnieje); wymaga decyzji człowieka, skrypt NIE tworzy członkostwa`,
    })),
  ];
  drukujIZapiszPlanCsv('problem4-czlonkostwo-raid', plan);
  console.log(
    `Właściciele RAID bez organization_members: ${rows.length} (bezpiecznych do naprawy: ${bezpieczne.length}, wymagających decyzji: ${niebezpieczne.length})`
  );

  if (!apply) return bezpieczne.length;

  let wstawione = 0;
  for (const r of bezpieczne) {
    const id = randomUUID();
    wpisy.push({
      table: 'organization_members',
      idColumn: 'id',
      id,
      action: 'delete', // przy rollbacku: usuń wstawiony wiersz (restore() dla 'delete' robi INSERT — patrz uwaga niżej)
      before: { id, organization_id: orgId, user_id: r.owner_id, role: 'MEMBER', status: 'ACTIVE', invited_by_user_id: null, created_at: new Date().toISOString(), permission_scope: null },
    });
    const wynik = await c.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, 'MEMBER', 'ACTIVE', NOW())
       ON CONFLICT (organization_id, user_id) DO NOTHING`,
      [id, orgId, r.owner_id]
    );
    wstawione += wynik.rowCount ?? 0;
  }
  return wstawione;
}

/* ── Problem 5: KAŻDY użytkownik organizacji bez wiersza organization_members ── */

/**
 * Problem 4 naprawia WYŁĄCZNIE właścicieli pozycji RAID (lokalnie: 7 osób).
 * POMIAR 07.09 na bazie stanowiska (54400, `consultify_noc`) pokazał, że luka
 * jest SZERSZA: w organizacji DBR77 jest 31 użytkowników z poprawnym
 * `users.organization_id`, a tylko 1 wiersz w `organization_members` — czyli
 * 30 osób bez członkostwa. Siódemka z problemu 4 to PODZBIÓR tej trzydziestki
 * (ci, którzy akurat są właścicielami pozycji RAID); reszta jest niewidoczna
 * dla każdego ekranu liczącego uprawnienia z `organization_members`.
 *
 * DLACZEGO TO WIDAĆ NA EKRANIE. Katalog nazwisk w UI bierze się z
 * `GET /api/organizations/:orgId/members` → `OrganizationController.getMembers`
 * → `organizationService.getActiveMembers` (SELECT z `organization_members`
 * JOIN `users`, `status='ACTIVE'`). Kontroler NAJPIERW sprawdza, czy WOŁAJĄCY
 * jest na tej liście — jeśli nie, zwraca 403 `ORG_MEMBERSHIP_REQUIRED`. Bez
 * członkostwa zalogowany użytkownik dostaje pusty katalog, a
 * `memberNameOrUnknown` (`src/hooks/useOrganizationMemberNames.ts`) pokazuje
 * „Nieznany użytkownik" dla KAŻDEGO identyfikatora.
 *
 * ROLA — POMIAR, NIE ZAŁOŻENIE. Pierwotny plan brzmiał „wszystkim MEMBER, bo
 * to najniższa rola, która przywraca dostęp". Czytanie kodu OBALIŁO ten plan:
 * `organization_members.role` NIE jest tylko etykietą katalogu — NADPISUJE
 * rolę z tokenu w `server/src/middleware/auth.middleware.ts` w trzech
 * miejscach (~L870 `resolvedUserRole = membershipRole`, ~L903 `primaryRole`,
 * ~L954 `fallbackRole`), a `normalizeRoleClaim` (L117) tylko przycina spacje —
 * nie porównuje poziomów. Dalej `verifyAdmin`
 * (`server/src/middleware/admin.middleware.ts` ~L204) liczy dostęp z
 * `membershipRole || role`. Skutek wpisania wszystkim 'MEMBER': 19 osób
 * z `users.role='ADMIN'` i właściciel z `users.role='OWNER'`, którzy DZIŚ
 * działają na roli z tokenu (bo brak wiersza = brak nadpisania), zostaliby
 * ZDEGRADOWANI do MEMBER. Uzupełnienie brakującego członkostwa ma przywracać
 * dostęp, a nie odbierać — więc rola członkostwa ODWZOROWUJE `users.role`:
 *
 *     users.role = OWNER                      → OWNER
 *     users.role = ADMIN | SUPERADMIN         → ADMIN
 *     users.role = CONSULTANT                 → CONSULTANT
 *     wszystko inne (MEMBER/TEAM_MEMBER/USER/
 *     GUEST/puste)                            → MEMBER
 *
 * To odwzorowanie NIGDY nie podnosi: bierze poziom, który użytkownik już ma
 * w `users.role` (źródło prawdy platformy, obecne w tokenie), i sprowadza go
 * do wartości dopuszczonej przez CHECK `organization_members_role_check`
 * (OWNER/ADMIN/MEMBER/CONSULTANT/USER/GUEST). SUPERADMIN celowo schodzi do
 * ADMIN — nie ma go w CHECK i nie chcemy zapisywać platformowego superadmina
 * jako właściciela tenanta (zob. AuthController L356).
 *
 * POZOSTAŁE POLA:
 *   status='ACTIVE' — jedyny status widziany przez `getActiveMembers`
 *                     i przez bramki `*StrictMembership`.
 *   permission_scope — NIE ustawiamy; `parsePermissionScope`
 *                     (orgContext.middleware.ts) traktuje NULL jak pusty
 *                     zakres, czyli brak dodatkowych uprawnień.
 *   invited_by_user_id — NULL (nikt nie zapraszał; to naprawa danych).
 *
 * BEZPIECZEŃSTWO: kryterium doboru to `users.organization_id = <org>` —
 * dokładnie ta sama zasada, co w problemie 4 („nigdy dla obcych właścicieli").
 * Użytkownik spoza organizacji nie dostaje członkostwa nigdy.
 */
interface KandydatCzlonkostwaOrg {
  user_id: string;
  email: string | null;
  user_role: string | null;
}

/** Dozwolone przez CHECK `organization_members_role_check`. */
const ROLE_CZLONKOSTWA = ['OWNER', 'ADMIN', 'MEMBER', 'CONSULTANT', 'USER', 'GUEST'] as const;
type RolaCzlonkostwa = (typeof ROLE_CZLONKOSTWA)[number];

/** `users.role` → rola członkostwa. Nigdy nie podnosi; nieznane schodzi do MEMBER. */
export function rolaCzlonkostwaZRoliUzytkownika(userRole: string | null | undefined): RolaCzlonkostwa {
  switch (String(userRole ?? '').trim().toUpperCase()) {
    case 'OWNER':
      return 'OWNER';
    case 'ADMIN':
    case 'SUPERADMIN':
      return 'ADMIN';
    case 'CONSULTANT':
      return 'CONSULTANT';
    default:
      return 'MEMBER';
  }
}

/** Kopia bezpieczeństwa PRZED zapisem — pełny stan `organization_members` organizacji. */
async function kopiaCzlonkostwPrzed(c: PoolClient, orgId: string): Promise<string> {
  const katalog = path.join(REPO_ROOT, 'evidence', 'czlonkostwa');
  fs.mkdirSync(katalog, { recursive: true });
  const host = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? '').host.replace(/[^A-Za-z0-9.-]/g, '_');
    } catch {
      return 'nieznany-host';
    }
  })();
  const { rows, fields } = await c.query(
    `SELECT * FROM organization_members WHERE organization_id = $1 ORDER BY created_at, id`,
    [orgId]
  );
  const kolumny = fields.map((f) => f.name);
  const naglowek = kolumny.join(',') + '\n';
  const tresc = rows
    .map((r) => kolumny.map((k) => csvCell((r as Record<string, unknown>)[k])).join(','))
    .join('\n');
  const sciezka = path.join(katalog, `organization_members-${orgId}-${host}-przed-${iso()}.csv`);
  fs.writeFileSync(sciezka, naglowek + tresc + (tresc ? '\n' : ''));
  console.log(`KOPIA PRZED (${rows.length} wierszy): ${sciezka}`);
  return sciezka;
}

async function naprawCzlonkostwoOrganizacji(
  c: PoolClient,
  orgId: string,
  apply: boolean,
  wpisy: ManifestEntry[]
): Promise<number> {
  const { rows } = await c.query<KandydatCzlonkostwaOrg>(
    `SELECT u.id AS user_id, u.email AS email, u.role AS user_role
       FROM users u
       LEFT JOIN organization_members om
         ON om.user_id = u.id AND om.organization_id = u.organization_id
      WHERE u.organization_id = $1 AND om.id IS NULL
      ORDER BY u.email`,
    [orgId]
  );

  const plan: WierszPlanu[] = rows.map((r) => ({
    tabela: 'organization_members',
    id: r.user_id,
    obecna: `${r.email ?? r.user_id} — brak wiersza organization_members (users.role=${r.user_role ?? '?'})`,
    proponowana: `INSERT organization_members (role=${rolaCzlonkostwaZRoliUzytkownika(r.user_role)}, status=ACTIVE, permission_scope=NULL)`,
  }));
  drukujIZapiszPlanCsv('problem5-czlonkostwo-organizacji', plan);
  console.log(`Użytkownicy organizacji bez organization_members: ${rows.length}`);

  if (!apply) return rows.length;
  if (rows.length === 0) return 0;

  await kopiaCzlonkostwPrzed(c, orgId);

  let wstawione = 0;
  for (const r of rows) {
    const id = randomUUID();
    const rola = rolaCzlonkostwaZRoliUzytkownika(r.user_role);
    wpisy.push({
      table: 'organization_members',
      idColumn: 'id',
      id,
      action: 'delete', // rollback tego skryptu dla organization_members = DELETE wstawionego wiersza
      before: {
        id,
        organization_id: orgId,
        user_id: r.user_id,
        role: rola,
        status: 'ACTIVE',
        invited_by_user_id: null,
        permission_scope: null,
      },
    });
    const wynik = await c.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, $4, 'ACTIVE', NOW())
       ON CONFLICT (organization_id, user_id) DO NOTHING`,
      [id, orgId, r.user_id, rola]
    );
    wstawione += wynik.rowCount ?? 0;
  }
  return wstawione;
}

/* ──────────────────────────────── main ─────────────────────────────── */

async function main(c: PoolClient, org: { id: string; name: string }, mode: { kind: string; manifest?: string }) {
  if (mode.kind === 'rollback') {
    const manifest = readManifest(mode.manifest!, SKRYPT);
    // Wpisy 'organization_members' z action='delete' w tym skrypcie oznaczają
    // "ten wiersz ZOSTAŁ WSTAWIONY przez --apply" — restore() dla action
    // 'delete' robi INSERT (przywraca skasowany wiersz), co dla PRAWDZIWEGO
    // usunięcia zadań jest poprawne. Dla organization_members chcemy
    // ODWROTNOŚCI (usunąć to, co wstawiliśmy) — obsługujemy osobno.
    const wstawioneCzlonkostwa = manifest.entries.filter((e) => e.table === 'organization_members');
    const resztaWpisow = manifest.entries.filter((e) => e.table !== 'organization_members');
    let cofniete = 0;
    if (resztaWpisow.length > 0) {
      cofniete += await restore(c, { ...manifest, entries: resztaWpisow });
    }
    for (const w of wstawioneCzlonkostwa) {
      const wynik = await c.query(`DELETE FROM organization_members WHERE id = $1`, [w.id]);
      cofniete += wynik.rowCount ?? 0;
    }
    console.log(`COFNIĘTE: ${cofniete} (manifest: ${mode.manifest})`);
    return;
  }

  const problem = parseProblem();
  const apply = mode.kind === 'apply';
  const slownik = wczytajSlownik();
  const wpisy: ManifestEntry[] = [];

  console.log('');
  console.log(`Problem: ${problem} · tryb: ${mode.kind} · organizacja: ${org.name} (${org.id})`);

  let laczna = 0;
  if (problem === '1' || problem === 'wszystkie') {
    console.log('\n=== Problem 1: angielskie nazwy inicjatyw ===');
    laczna += await naprawInicjatywy(c, org.id, slownik, apply, wpisy);
  }
  if (problem === '2' || problem === 'wszystkie') {
    console.log('\n=== Problem 2a: angielskie tytuły decyzji ===');
    laczna += await naprawDecyzje(c, org.id, slownik, apply, wpisy);
    console.log('\n=== Problem 2b: angielskie tytuły pozycji RAID ===');
    laczna += await naprawRaid(c, org.id, slownik, apply, wpisy);
  }
  if (problem === '3' || problem === 'wszystkie') {
    console.log('\n=== Problem 3: czterokrotnie powtórzone zadania ===');
    laczna += await naprawDuplikatyZadan(c, org.id, apply, wpisy);
  }
  if (problem === '4' || problem === 'wszystkie') {
    console.log('\n=== Problem 4: właściciele RAID bez organization_members ===');
    laczna += await naprawCzlonkostwoRaid(c, org.id, apply, wpisy);
  }
  // Problem 5 CELOWO nie wchodzi w `--problem=wszystkie`: jest nadzbiorem
  // problemu 4 i dotyka KAŻDEGO użytkownika organizacji, więc uruchamia się
  // wyłącznie jawnym `--problem=5`. Uruchomienie 4 i 5 razem jest bezpieczne
  // (ON CONFLICT DO NOTHING + ponowny SELECT), ale liczby w logu by się dublowały.
  if (problem === '5') {
    console.log('\n=== Problem 5: użytkownicy organizacji bez organization_members ===');
    laczna += await naprawCzlonkostwoOrganizacji(c, org.id, apply, wpisy);
  }

  console.log('');
  if (!apply) {
    console.log('DRY-RUN: nic nie zostało zmienione. Uruchom ponownie z --apply po akcepcie właściciela.');
    console.log(`DO ZMIANY / USUNIĘCIA ŁĄCZNIE: ${laczna}`);
    return;
  }

  const manifest: Manifest = {
    version: 1,
    script: SKRYPT,
    organizationId: org.id,
    organizationName: org.name,
    createdAt: new Date().toISOString(),
    entries: wpisy,
  };
  const sciezka = writeManifest(SKRYPT, manifest);
  console.log(`ZMIENIONE/USUNIĘTE ŁĄCZNIE: ${laczna}`);
  console.log(`Manifest cofnięcia: ${sciezka}`);
  console.log('Uruchom ten sam --apply drugi raz — musi wypisać ŁĄCZNIE: 0.');
}

const uruchomionyWprost =
  typeof process.argv[1] === 'string' && process.argv[1].includes('napraw-jezyk-i-czlonkostwo');
if (uruchomionyWprost) {
  runMain(SKRYPT, main).catch((błąd) => {
    console.error(String(błąd instanceof Error ? błąd.message : błąd));
    process.exit(1);
  });
}
