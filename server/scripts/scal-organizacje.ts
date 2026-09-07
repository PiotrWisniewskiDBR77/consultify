#!/usr/bin/env tsx
/**
 * DEC-450 — scalenie DWÓCH organizacji DBR77 na stagingu: przeniesienie CAŁEGO
 * zestawu danych z organizacji legacy (`dbr77`, „DBR77 Digital Consulting") do
 * organizacji kanonicznej (`a3e05d4a-…`, „DBR77"), żeby historia programu
 * została w całości i pokaz szedł na jednej organizacji.
 *
 * Rozszerza `przenies-raid-miedzy-organizacjami.ts` (tam: tylko `raid_items`,
 * bramka osierocenia odmawiała `--apply`, bo 7 pozycji RAID wskazywało na
 * inicjatywy zostające w legacy). Tu przenosimy również te inicjatywy, więc
 * bramka z tamtego skryptu z definicji przestaje strzelać — ale WSZYSTKIE
 * zabezpieczenia zostają i są mocniejsze:
 *
 *   1. tryb próbny DOMYŚLNY — i jest to PRAWDZIWA próba: `--dry-run` wykonuje
 *      komplet UPDATE-ów w transakcji, uruchamia kontrole, po czym robi
 *      ROLLBACK. Baza sama sprawdza indeksy unikalne i klucze obce; nie
 *      zgadujemy z listy statycznej;
 *   2. kopia bezpieczeństwa CSV KAŻDEJ dotykanej tabeli (pełne wiersze) —
 *      zapisywana na dysk PRZED pierwszym UPDATE. Bez kopii nie ma zapisu;
 *   3. manifest cofnięcia + `--rollback=<manifest.json>` (wzorzec `restore()`
 *      ze `wspolne.ts`);
 *   4. JEDNA transakcja — cokolwiek pójdzie źle, całość się wycofuje;
 *   5. BRAMKA OSIEROCENIA (rozszerzona na cały graf): przed i po przeniesieniu
 *      liczone są WSZYSTKIE powiązania „dziecko w organizacji A → rodzic w
 *      organizacji B" po realnych kluczach obcych z `pg_constraint`. Jeśli po
 *      przeniesieniu pojawi się choć jedno NOWE osierocenie spoza jawnie
 *      zadeklarowanego wyjątku — transakcja jest wycofywana;
 *   6. BRAMKA DUPLIKATU CZŁONKOSTWA — po przeniesieniu 0 duplikatów
 *      `(organization_id, user_id)`;
 *   7. BRAMKA FK ZŁOŻONEGO — gdyby wśród przenoszonych tabel pojawił się klucz
 *      obcy zawierający `organization_id` (nieodraczalny → kolejność UPDATE-ów
 *      zaczyna mieć znaczenie), skrypt się ZATRZYMUJE zamiast zgadywać.
 *
 * UŻYCIE (z korzenia repo):
 *   DATABASE_URL="…" npx tsx server/scripts/scal-organizacje.ts \
 *     --z-org=dbr77 --do-org=a3e05d4a-5397-419d-b486-8e44366c0063 --dry-run
 *   … --apply
 *   … --rollback=evidence/scal-organizacje/scal-organizacje-…-manifest.json
 */
import '../src/config/loadEnv.js';

import fs from 'node:fs';
import path from 'node:path';
import type { PoolClient } from 'pg';

import {
  qi,
  pool,
  resolveOrg,
  readManifest,
  csvCell,
  REPO_ROOT,
  iso,
  type Manifest,
  type ManifestEntry,
} from './higiena-wlasciciela/wspolne.js';

const SKRYPT = 'scal-organizacje';
const KATALOG_DOWODOW = path.join(REPO_ROOT, 'evidence', 'scal-organizacje');

/* ────────────────────────────────────────────────────────────────────────────
 * DECYZJE FAZY 1 — co NIE jedzie i dlaczego. Każdy wpis to rozstrzygnięcie
 * zmierzonej kolizji albo świadoma klasyfikacja, nie „na wszelki wypadek".
 * ──────────────────────────────────────────────────────────────────────────── */

/** Ślad operacyjny starej organizacji — NIE treść produktu. Zostaje w legacy. */
export const TECHNICZNE: Record<string, string> = {
  api_logs: 'ślad wywołań HTTP starej organizacji — dziennik operacyjny, nie treść programu',
  activity_logs: 'dziennik aktywności starej organizacji — zdarzenie zaszło w tamtej organizacji',
  audit_log: 'dziennik audytowy starej organizacji — przepisanie go fałszowałoby, gdzie zdarzenie zaszło',
};

/**
 * Dzienniki trzymające organizację w kolumnie INNEJ niż `organization_id`
 * (nie wchodzą w skan po `organization_id`, więc wypisujemy je jawnie, żeby
 * meldunek „wszystkie tabele" był prawdziwy). Wszystkie techniczne — zostają.
 */
export const TECHNICZNE_INNE_KOLUMNY: Array<{ tabela: string; kolumna: string; powod: string }> = [
  { tabela: 'audit_events', kolumna: 'org_id', powod: 'dziennik audytowy (kolumna org_id) — jak audit_log' },
  {
    tabela: 'organization_switch_log',
    kolumna: 'from_organization_id',
    powod: 'zapis faktu „użytkownik przełączył się Z tej organizacji" — przepisanie sfałszowałoby historię',
  },
  {
    tabela: 'organization_switch_log',
    kolumna: 'to_organization_id',
    powod: 'zapis faktu „użytkownik przełączył się DO tej organizacji" — jak wyżej',
  },
];

/** Kolizje na indeksie unikalnym, zmierzone próbą UPDATE + ROLLBACK per tabela. */
export const WYKLUCZONE_KOLIZJA: Record<string, string> = {
  project_role_templates:
    'UQ(organization_id, role_key): WSZYSTKIE 12 kluczy ról (OBSERVER, PMO, SME, …) istnieją już w organizacji docelowej — to słownik ról projektowych, nie treść właściciela. Nic nie ginie.',
  organization_context_snapshots:
    'PK(organization_id): jeden wiersz na organizację. To wyliczany cache kontekstu (rebuilt_at + snapshot_json), organizacja docelowa ma własny, świeższy. Przeniesienie oznaczałoby nadpisanie cache docelowej organizacji opisem „DBR77 Digital Consulting".',
  rvn_platform_visibility_policies:
    'UQ(organization_id, domain, policy_version): wszystkie 3 (kpi/roi/okr, wersja 1) mają odpowiednik w organizacji docelowej. To konfiguracja polityki widoczności per organizacja, nie treść. Docelowa ma dla roi nowszą wersję 2 (ROI_GOVERNED).',
  okr_vnext_programs:
    'UQ częściowy (organization_id) WHERE status=active: jeden aktywny program OKR na organizację. Obie organizacje mają aktywny. Przeniesienie wymagałoby zmiany statusu — to już nie jest przeniesienie, tylko edycja treści.',
  // Reszta bloku OKR jedzie razem z programem albo wcale — inaczej zestaw
  // (cykl/cel/kluczowy wynik/przegląd) trafiłby do organizacji docelowej,
  // a jego program został w legacy: ekran pokazujący nazwę, której nie da się
  // otworzyć. To jest dokładnie ten defekt, na którym zatrzymał się poprzednik.
  okr_vnext_cycles: 'blok OKR jedzie w całości albo wcale — zablokowany przez kolizję okr_vnext_programs',
  okr_vnext_objectives: 'jak wyżej (blok OKR)',
  okr_vnext_key_results: 'jak wyżej (blok OKR)',
  okr_vnext_checkins: 'jak wyżej (blok OKR)',
  okr_vnext_checkin_occurrences: 'jak wyżej (blok OKR)',
  okr_vnext_sets: 'jak wyżej (blok OKR)',
  okr_vnext_program_policy_versions: 'jak wyżej (blok OKR)',
};

/**
 * Tabele przenoszone CZĘŚCIOWO. `predykat` dokleja się do `WHERE
 * organization_id::text = $2`; `$1` to organizacja docelowa.
 */
export const CZESCIOWE: Record<string, { predykat: string; powod: string }> = {
  organization_members: {
    predykat: `AND NOT EXISTS (SELECT 1 FROM organization_members m2
                 WHERE m2.organization_id::text = $1 AND m2.user_id = organization_members.user_id)`,
    powod:
      'UQ(organization_id, user_id): 2 z 9 osób (justyna.laskowska, piotr.wisniewski) mają JUŻ członkostwo w organizacji docelowej. Przeniesienie ich wiersza dałoby duplikat. Ich wiersze legacy zostają nietknięte — nikt nie traci dostępu, nikt nie dostaje wyższej roli (justyna jest MEMBER w docelowej, ADMIN w legacy — podniesienie roli to decyzja właściciela, nie skutek uboczny scalenia).',
  },
  v8_artifact_origin_links: {
    predykat: `AND NOT EXISTS (SELECT 1 FROM v8_artifact_origin_links l2
                 WHERE l2.organization_id::text = $1
                   AND l2.origin_runtime = v8_artifact_origin_links.origin_runtime
                   AND l2.origin_record_id = v8_artifact_origin_links.origin_record_id)`,
    powod:
      'UQ(organization_id, origin_runtime, origin_record_id) = „jeden artefakt na szablon w organizacji". 99 ze 178 wskazuje na szablony (document/report/presentation/sheet_template), z których organizacja docelowa ma już swój artefakt. Te 99 zostaje; 79 jedzie. To wtórny indeks pochodzenia (artifactRegistryService.getOriginLinkByOrigin) — same artefakty (v8_output_artifacts) jadą w komplecie.',
  },
  rvn_platform_resource_visibility: {
    predykat: `AND resource_type <> 'okr_set'`,
    powod:
      'Wiersz dla resource_type=okr_set wskazuje na zestaw OKR, który zostaje w legacy (kolizja okr_vnext_programs) — przeniesienie dałoby widoczność zasobu, którego w organizacji docelowej nie ma. Pozostałe 3 (kpi, kpi_scorecard, roi_case) MUSZĄ pojechać: visibilityScopedQuery.ts jest fail-closed — zasób bez wiersza widoczności w organizacji jest NIEWIDOCZNY.',
  },
};

/**
 * Jawnie dopuszczone „wskazanie poza organizację" po przeniesieniu.
 * Każdy wpis jest rozstrzygnięciem, nie wyjątkiem od kontroli: kontrola nadal
 * liczy i raportuje te wiersze, ale ich obecność nie wywraca transakcji.
 */
export const DOPUSZCZONE_WSKAZANIA: Array<{ tabela: string; kolumna: string; powod: string }> = [
  {
    tabela: 'activity_logs',
    kolumna: 'user_id',
    powod:
      'Dziennik zostaje w organizacji, w której zdarzenie zaszło; konto użytkownika przenosi się do docelowej. Klucz obcy jest CAŁY CZAS spełniony (konto istnieje). Ten kształt istniał już przed scaleniem w OBIE strony (83 wiersze legacy→docelowa, 44 docelowa→legacy) — scalenie go tylko ujednolica. Odczyty (AdminDataController, SuperAdminController, security.routes) filtrują po organization_id dziennika i dołączają users po id; dzisiejsza organizacja domowa użytkownika nie ma znaczenia dla wpisu historycznego.',
  },
  {
    tabela: 'rvn_platform_resource_visibility',
    kolumna: 'policy_id',
    powod:
      'Stempel „pod jaką polityką opublikowano" — polityki zostają w legacy (kolizja UQ). Ścieżka ODCZYTU nie dołącza tabeli polityk: visibilityScopedQuery.ts filtruje po rv.organization_id + rv.visibility_mode, a getActiveVisibilityPolicy() rozwiązuje politykę po (organizationId, domain) dopiero przy ZAPISIE. Przepięcie stempla na politykę organizacji docelowej byłoby przepisaniem faktu historycznego, więc go nie robimy.',
  },
];

/* ──────────────────────────────────────────────────────────────────────────── */

type Tryb = { rodzaj: 'dry-run' | 'apply' | 'rollback'; manifest?: string };
interface Cli {
  zOrg: string;
  doOrg: string;
  tryb: Tryb;
}

export function parseCliScalenia(argv = process.argv.slice(2)): Cli {
  const zOrg = argv.find((x) => x.startsWith('--z-org='))?.slice('--z-org='.length);
  const doOrg = argv.find((x) => x.startsWith('--do-org='))?.slice('--do-org='.length);
  const rollback = argv.find((x) => x.startsWith('--rollback='))?.slice('--rollback='.length);
  const wybrane =
    Number(argv.includes('--dry-run')) + Number(argv.includes('--apply')) + Number(Boolean(rollback));
  if (!zOrg || !doOrg || wybrane !== 1) {
    throw new Error(
      'Użycie: --z-org=<nazwa|uuid> --do-org=<nazwa|uuid> oraz dokładnie jedno: --dry-run | --apply | --rollback=<manifest.json>'
    );
  }
  if (zOrg === doOrg) throw new Error('--z-org i --do-org są identyczne — nie ma czego przenosić');
  return {
    zOrg,
    doOrg,
    tryb: rollback
      ? { rodzaj: 'rollback', manifest: rollback }
      : { rodzaj: argv.includes('--apply') ? 'apply' : 'dry-run' },
  };
}

let KATALOG_PRZEBIEGU = KATALOG_DOWODOW;
function ustawKatalogPrzebiegu(tryb: string): string {
  KATALOG_PRZEBIEGU = path.join(KATALOG_DOWODOW, `${tryb}-${iso()}`);
  fs.mkdirSync(KATALOG_PRZEBIEGU, { recursive: true });
  return KATALOG_PRZEBIEGU;
}
function zapiszDowod(nazwa: string, tresc: string): string {
  fs.mkdirSync(KATALOG_PRZEBIEGU, { recursive: true });
  const sciezka = path.join(KATALOG_PRZEBIEGU, nazwa);
  fs.writeFileSync(sciezka, tresc);
  return sciezka;
}

/**
 * Dokładne dopasowanie po `id` przed `resolveOrg`. Powód (zmierzony 07.09):
 * `resolveOrg` dopasowuje `id=$1 OR name ILIKE '%$1%'` i dla `dbr77` zwraca
 * DWA wiersze („DBR77" i „DBR77 Digital Consulting"), więc rzuca wyjątek mimo
 * że identyfikator jest jednoznaczny. Odmowa przy organizacji nieistniejącej
 * w tej bazie zostaje zachowana (spada do resolveOrg).
 */
async function rozwiazOrganizacje(c: PoolClient, needle: string) {
  const dokladny = await c.query<{ id: string; name: string }>(
    'SELECT id, name FROM organizations WHERE id::text = $1',
    [needle]
  );
  if (dokladny.rows.length === 1) return dokladny.rows[0]!;
  return resolveOrg(c, needle);
}

export type Akcja = 'CALOSC' | 'CZESC' | 'ZOSTAJE_TECHNICZNE' | 'ZOSTAJE_KOLIZJA';
export interface PozycjaPlanu {
  tabela: string;
  akcja: Akcja;
  wZrodle: number;
  doPrzeniesienia: number;
  wCelu: number;
  powod: string;
}

/** Klasyfikacja tabeli — czysta funkcja, testowalna bez bazy. */
export function zaklasyfikuj(tabela: string): { akcja: Akcja; powod: string } {
  if (TECHNICZNE[tabela]) return { akcja: 'ZOSTAJE_TECHNICZNE', powod: TECHNICZNE[tabela]! };
  if (WYKLUCZONE_KOLIZJA[tabela]) return { akcja: 'ZOSTAJE_KOLIZJA', powod: WYKLUCZONE_KOLIZJA[tabela]! };
  if (CZESCIOWE[tabela]) return { akcja: 'CZESC', powod: CZESCIOWE[tabela]!.powod };
  return { akcja: 'CALOSC', powod: 'dane merytoryczne — jadą w całości' };
}

async function tabeleZOrganizacja(c: PoolClient): Promise<string[]> {
  const r = await c.query<{ table_name: string }>(
    `SELECT c.table_name FROM information_schema.columns c
       JOIN information_schema.tables t
         ON t.table_schema = c.table_schema AND t.table_name = c.table_name
      WHERE c.table_schema = 'public' AND c.column_name = 'organization_id'
        AND t.table_type = 'BASE TABLE'
      ORDER BY c.table_name`
  );
  return r.rows.map((x) => x.table_name);
}

async function policz(c: PoolClient, tabela: string, orgId: string): Promise<number> {
  const r = await c.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM ${qi(tabela)} WHERE organization_id::text = $1`,
    [orgId]
  );
  return Number(r.rows[0]?.n ?? '0');
}

/** Krawędzie FK, gdzie OBIE tabele mają `organization_id` (tylko takie mogą osierocić). */
interface Krawedz {
  nazwa: string;
  dziecko: string;
  rodzic: string;
  kolDziecka: string[];
  kolRodzica: string[];
  zawieraOrg: boolean;
}
async function krawedzieFk(c: PoolClient, tabeleZOrg: Set<string>): Promise<Krawedz[]> {
  const r = await c.query<{
    conname: string;
    dziecko: string;
    rodzic: string;
    kol_dziecka: string[];
    kol_rodzica: string[];
  }>(`
    SELECT con.conname, t.relname AS dziecko, ft.relname AS rodzic,
      (SELECT array_agg(a.attname::text ORDER BY x.ord)
         FROM unnest(con.conkey) WITH ORDINALITY x(att, ord)
         JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = x.att) AS kol_dziecka,
      (SELECT array_agg(a.attname::text ORDER BY x.ord)
         FROM unnest(con.confkey) WITH ORDINALITY x(att, ord)
         JOIN pg_attribute a ON a.attrelid = con.confrelid AND a.attnum = x.att) AS kol_rodzica
      FROM pg_constraint con
      JOIN pg_class t ON t.oid = con.conrelid
      JOIN pg_class ft ON ft.oid = con.confrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public' AND con.contype = 'f' AND ft.relname <> 'organizations'`);
  return r.rows
    .filter((x) => tabeleZOrg.has(x.dziecko) && tabeleZOrg.has(x.rodzic))
    .map((x) => ({
      nazwa: x.conname,
      dziecko: x.dziecko,
      rodzic: x.rodzic,
      kolDziecka: x.kol_dziecka,
      kolRodzica: x.kol_rodzica,
      zawieraOrg: x.kol_dziecka.includes('organization_id'),
    }));
}

export interface Wskazanie {
  krawedz: string;
  dziecko: string;
  rodzic: string;
  kolumna: string;
  ile: number;
  orgDziecka: string;
  orgRodzica: string;
}

/**
 * Liczy powiązania „dziecko w jednej z dwóch organizacji → rodzic w DRUGIEJ".
 * To bramka osierocenia rozciągnięta z 3 pól `raid_items` na cały graf FK.
 */
async function policzWskazaniaMiedzyOrg(
  c: PoolClient,
  krawedzie: Krawedz[],
  a: string,
  b: string
): Promise<Wskazanie[]> {
  const wynik: Wskazanie[] = [];
  for (const k of krawedzie) {
    const zlaczenie = k.kolDziecka
      .map((kol, i) => `p.${qi(k.kolRodzica[i]!)} = d.${qi(kol)}`)
      .join(' AND ');
    const kolumnyDziecka = k.kolDziecka.filter((x) => x !== 'organization_id');
    if (kolumnyDziecka.length === 0) continue;
    const nieNull = kolumnyDziecka.map((kol) => `d.${qi(kol)} IS NOT NULL`).join(' AND ');
    const sql = `
      SELECT d.organization_id::text AS org_d, p.organization_id::text AS org_p, count(*)::text AS n
        FROM ${qi(k.dziecko)} d
        JOIN ${qi(k.rodzic)} p ON ${zlaczenie}
       WHERE ${nieNull}
         AND d.organization_id::text IN ($1, $2)
         AND p.organization_id::text IN ($1, $2)
         AND d.organization_id::text <> p.organization_id::text
       GROUP BY 1, 2`;
    const r = await c.query<{ org_d: string; org_p: string; n: string }>(sql, [a, b]);
    for (const w of r.rows) {
      wynik.push({
        krawedz: k.nazwa,
        dziecko: k.dziecko,
        rodzic: k.rodzic,
        kolumna: kolumnyDziecka.join('+'),
        ile: Number(w.n),
        orgDziecka: w.org_d,
        orgRodzica: w.org_p,
      });
    }
  }
  return wynik;
}



/**
 * Powiązania, które NIE mają klucza obcego w bazie, więc bramka oparta na
 * `pg_constraint` ich NIE WIDZI. Lista ręczna — i tak trzeba ją powiedzieć
 * wprost, bo inaczej meldunek „zero osierocen" byłby ślepy w tych miejscach.
 */
export const WSKAZANIA_BEZ_FK: Array<{
  dziecko: string;
  kolumna: string;
  rodzic: string;
  kolumnaRodzica: string;
  powod: string;
}> = [
  {
    dziecko: 'v8_artifact_origin_links',
    kolumna: 'artifact_id',
    rodzic: 'v8_output_artifacts',
    kolumnaRodzica: 'artifact_id',
    powod:
      'Tabela nie ma ŻADNEGO klucza obcego (nawet na organizations). 99 linków zostaje w legacy (kolizja UQ), a ich artefakty jadą — link będzie wskazywał artefakt w organizacji docelowej. To wtórny indeks pochodzenia, nie ścieżka wyświetlania: Materiały czytają v8_output_artifacts.',
  },
  {
    dziecko: 'api_logs',
    kolumna: 'user_id',
    rodzic: 'users',
    kolumnaRodzica: 'id',
    powod: 'Jak activity_logs — dziennik zostaje, konto jedzie. Brak FK, więc mierzone ręcznie.',
  },
];

async function policzWskazaniaBezFk(
  c: PoolClient,
  a: string,
  b: string
): Promise<Wskazanie[]> {
  const wynik: Wskazanie[] = [];
  for (const r of WSKAZANIA_BEZ_FK) {
    const q = await c.query<{ org_d: string; org_p: string; n: string }>(
      `SELECT d.organization_id::text AS org_d, p.organization_id::text AS org_p, count(*)::text AS n
         FROM ${qi(r.dziecko)} d
         JOIN ${qi(r.rodzic)} p ON p.${qi(r.kolumnaRodzica)}::text = d.${qi(r.kolumna)}::text
        WHERE d.${qi(r.kolumna)} IS NOT NULL
          AND d.organization_id::text IN ($1, $2)
          AND p.organization_id::text IN ($1, $2)
          AND d.organization_id::text <> p.organization_id::text
        GROUP BY 1, 2`,
      [a, b]
    );
    for (const w of q.rows) {
      wynik.push({
        krawedz: `BEZ_FK:${r.dziecko}.${r.kolumna}`,
        dziecko: r.dziecko,
        rodzic: r.rodzic,
        kolumna: r.kolumna,
        ile: Number(w.n),
        orgDziecka: w.org_d,
        orgRodzica: w.org_p,
      });
    }
  }
  return wynik;
}

function wskazaniaCsv(w: Wskazanie[]): string {
  return (
    'krawedz,dziecko,kolumna,rodzic,org_dziecka,org_rodzica,wierszy\n' +
    w
      .map((x) =>
        [x.krawedz, x.dziecko, x.kolumna, x.rodzic, x.orgDziecka, x.orgRodzica, x.ile].map(csvCell).join(',')
      )
      .join('\n') +
    '\n'
  );
}

function kluczWskazania(w: Wskazanie): string {
  return `${w.krawedz}|${w.dziecko}|${w.kolumna}|${w.orgDziecka}->${w.orgRodzica}`;
}

function czyDopuszczone(w: Wskazanie): boolean {
  return DOPUSZCZONE_WSKAZANIA.some((d) => d.tabela === w.dziecko && w.kolumna.split('+').includes(d.kolumna));
}


/** Kolumny klucza głównego (może być złożony). */
async function kolumnyKluczaGlownego(c: PoolClient, tabela: string): Promise<string[]> {
  const r = await c.query<{ column_name: string; poz: number }>(
    `SELECT a.attname AS column_name, x.ord AS poz
       FROM pg_index i
       JOIN pg_class t ON t.oid = i.indrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       JOIN unnest(i.indkey) WITH ORDINALITY x(att, ord) ON true
       JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = x.att
      WHERE n.nspname = 'public' AND t.relname = $1 AND i.indisprimary
      ORDER BY x.ord`,
    [tabela]
  );
  return r.rows.map((x) => x.column_name);
}

/**
 * Cofnięcie WŁASNE, nie `restore()` ze `wspolne.ts`. Powód: `restore()`
 * zakłada klucz JEDNOKOLUMNOWY, a tu trzy tabele mają klucz złożony, w tym
 * dwie z `organization_id` w kluczu. Skoro jedyną zmianą tego skryptu jest
 * `organization_id`, cofnięcie = przywrócenie tej jednej kolumny na wierszach
 * wskazanych kluczem głównym (z organizacją docelową, bo tam po zapisie leżą).
 */
async function cofnij(c: PoolClient, manifest: Manifest, celId: string): Promise<number> {
  let n = 0;
  for (const e of [...manifest.entries].reverse()) {
    const kolPk = e.idColumn.split('+');
    const inneKol = kolPk.filter((k) => k !== 'organization_id');
    if (inneKol.length === 0) {
      throw new Error(`${e.table}: klucz główny to samo organization_id — cofnięcie per wiersz niemożliwe`);
    }
    const wartosci = inneKol.map((k) => e.before[k]);
    const warunki = inneKol.map((k, i) => `${qi(k)} = $${i + 3}`).join(' AND ');
    const q = await c.query(
      `UPDATE ${qi(e.table)} SET organization_id = $1
        WHERE organization_id::text = $2 AND ${warunki}`,
      [e.before.organization_id, celId, ...wartosci]
    );
    n += q.rowCount ?? 0;
  }
  return n;
}

async function main(): Promise<void> {
  const cli = parseCliScalenia();
  const p = pool();
  const c = await p.connect();
  try {
    const zrodlo = await rozwiazOrganizacje(c, cli.zOrg);
    const cel = await rozwiazOrganizacje(c, cli.doOrg);
    if (zrodlo.id === cel.id) throw new Error('--z-org i --do-org wskazują tę samą organizację');
    console.log(`${SKRYPT} · ${zrodlo.name} (${zrodlo.id}) → ${cel.name} (${cel.id}) · ${cli.tryb.rodzaj}`);
    if (cli.tryb.rodzaj !== 'rollback') {
      console.log(`KATALOG DOWODÓW: ${ustawKatalogPrzebiegu(cli.tryb.rodzaj)}`);
    }

    if (cli.tryb.rodzaj === 'rollback') {
      const manifest = readManifest(cli.tryb.manifest!, SKRYPT);
      await c.query('BEGIN');
      try {
        const cofniete = await cofnij(c, manifest, cel.id);
        if (cofniete !== manifest.entries.length) {
          throw new Error(
            `Cofnięcie ruszyło ${cofniete} z ${manifest.entries.length} wierszy — częściowe cofnięcie jest gorsze niż żadne, wycofuję`
          );
        }
        await c.query('COMMIT');
        console.log(`COFNIĘTE: ${cofniete} z ${manifest.entries.length} wierszy (manifest: ${cli.tryb.manifest})`);
      } catch (blad) {
        await c.query('ROLLBACK');
        throw blad;
      }
      return;
    }

    // ── PLAN ───────────────────────────────────────────────────────────────
    const wszystkieTabele = await tabeleZOrganizacja(c);
    // Zbiór do skanu osierocen: tylko tabele, które mają wiersze w KTÓREJKOLWIEK
    // z dwóch organizacji. Skan po wszystkich 1 274 tabelach z organization_id
    // to 2 × ~840 zapytań JOIN po tabelach wielkości api_logs — bez sensu.
    const zbiorZOrg = new Set<string>();
    const plan: PozycjaPlanu[] = [];
    for (const tabela of wszystkieTabele) {
      const licz = await c.query<{ z: string; d: string }>(
        `SELECT count(*) FILTER (WHERE organization_id::text = $1)::text AS z,
                count(*) FILTER (WHERE organization_id::text = $2)::text AS d
           FROM ${qi(tabela)}`,
        [zrodlo.id, cel.id]
      );
      const wZrodle = Number(licz.rows[0]?.z ?? '0');
      const wCelu = Number(licz.rows[0]?.d ?? '0');
      if (wZrodle > 0 || wCelu > 0) zbiorZOrg.add(tabela);
      if (wZrodle === 0) continue;
      const { akcja, powod } = zaklasyfikuj(tabela);
      let doPrzeniesienia = 0;
      if (akcja === 'CALOSC') doPrzeniesienia = wZrodle;
      else if (akcja === 'CZESC') {
        const r = await c.query<{ n: string }>(
          // `$1::text IS NOT NULL` — predykat `rvn_platform_resource_visibility`
          // nie używa $1, a Postgres odmawia wtedy „could not determine data
          // type of parameter $1". Warunek jest zawsze prawdziwy.
          `SELECT count(*)::text AS n FROM ${qi(tabela)}
            WHERE organization_id::text = $2 AND $1::text IS NOT NULL ${CZESCIOWE[tabela]!.predykat}`,
          [cel.id, zrodlo.id]
        );
        doPrzeniesienia = Number(r.rows[0]?.n ?? '0');
      }
      plan.push({ tabela, akcja, wZrodle, doPrzeniesienia, wCelu, powod });
    }

    const sumaZrodlo = plan.reduce((s, x) => s + x.wZrodle, 0);
    const sumaRuch = plan.reduce((s, x) => s + x.doPrzeniesienia, 0);
    console.log(
      `PLAN · tabel z danymi w źródle: ${plan.length} · wierszy w źródle: ${sumaZrodlo} · do przeniesienia: ${sumaRuch}`
    );
    for (const a of ['CALOSC', 'CZESC', 'ZOSTAJE_TECHNICZNE', 'ZOSTAJE_KOLIZJA'] as const) {
      const g = plan.filter((x) => x.akcja === a);
      console.log(
        `  ${a}: ${g.length} tabel · ${g.reduce((s, x) => s + x.wZrodle, 0)} wierszy w źródle · ${g.reduce((s, x) => s + x.doPrzeniesienia, 0)} przenoszonych`
      );
    }

    const planCsv = zapiszDowod(
      'plan.csv',
      'tabela,akcja,w_zrodle,do_przeniesienia,w_celu,powod\n' +
        plan
          .map((x) =>
            [x.tabela, x.akcja, x.wZrodle, x.doPrzeniesienia, x.wCelu, x.powod].map(csvCell).join(',')
          )
          .join('\n') +
        '\n'
    );
    console.log(`PLAN CSV: ${planCsv}`);

    // ── BRAMKA FK ZŁOŻONEGO ────────────────────────────────────────────────
    const krawedzie = await krawedzieFk(c, zbiorZOrg);
    const ruszane = new Set(plan.filter((x) => x.doPrzeniesienia > 0).map((x) => x.tabela));
    const zlozoneWRuchu = krawedzie.filter(
      (k) => k.zawieraOrg && (ruszane.has(k.dziecko) || ruszane.has(k.rodzic))
    );
    const zlozoneZDanymi: string[] = [];
    for (const k of zlozoneWRuchu) {
      const r = await c.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM ${qi(k.dziecko)} WHERE organization_id::text = $1`,
        [zrodlo.id]
      );
      if (Number(r.rows[0]?.n ?? '0') > 0) zlozoneZDanymi.push(`${k.nazwa} (${k.dziecko} → ${k.rodzic})`);
    }
    if (zlozoneZDanymi.length > 0) {
      console.log('');
      console.log('STOP: klucz obcy ZŁOŻONY zawierający organization_id ma wiersze w organizacji źródłowej:');
      for (const x of zlozoneZDanymi) console.log(`  ${x}`);
      console.log(
        'Takie klucze są nieodraczalne — kolejność UPDATE-ów zaczyna mieć znaczenie i pojedyncze UPDATE-y ' +
          'per tabela nie mogą przejść. Zatrzymuję się zamiast zgadywać kolejność.'
      );
      process.exitCode = 3;
      return;
    }
    console.log(
      `BRAMKA FK ZŁOŻONEGO: 0 (sprawdzono ${zlozoneWRuchu.length} kluczy złożonych dotykających ruszanych tabel)`
    );

    // ── STAN PRZED ─────────────────────────────────────────────────────────
    const wskazaniaPrzed = await policzWskazaniaMiedzyOrg(c, krawedzie, zrodlo.id, cel.id);
    console.log(
      `WSKAZANIA MIĘDZY ORGANIZACJAMI · PRZED: ${wskazaniaPrzed.reduce((s, x) => s + x.ile, 0)} wierszy w ${wskazaniaPrzed.length} miejscach`
    );
    const bezFkPrzed = await policzWskazaniaBezFk(c, zrodlo.id, cel.id);
    zapiszDowod('wskazania-miedzy-org-PRZED.csv', wskazaniaCsv([...wskazaniaPrzed, ...bezFkPrzed]));
    for (const w of bezFkPrzed) {
      console.log(`  PRZED (bez FK) · ${w.dziecko}.${w.kolumna} → ${w.rodzic} · ${w.ile} (${w.orgDziecka} → ${w.orgRodzica})`);
    }
    for (const w of wskazaniaPrzed) {
      console.log(`  PRZED · ${w.dziecko}.${w.kolumna} → ${w.rodzic} · ${w.ile} (${w.orgDziecka} → ${w.orgRodzica})`);
    }

    // ── KOPIA BEZPIECZEŃSTWA + MANIFEST (PRZED JAKIMKOLWIEK UPDATE) ────────
    const wpisy: ManifestEntry[] = [];
    const kopieCsv: string[] = [];
    for (const poz of plan) {
      if (poz.doPrzeniesienia === 0) continue;
      const czesciowa = poz.akcja === 'CZESC';
      const predykat = czesciowa ? CZESCIOWE[poz.tabela]!.predykat : '';
      // UWAGA: parametry MUSZĄ być dokładnie te użyte w zapytaniu — Postgres
      // odrzuca „bind message supplies 2 parameters, but requires 1".
      const pelne = czesciowa
        ? (
            await c.query<Record<string, unknown>>(
              `SELECT * FROM ${qi(poz.tabela)} WHERE organization_id::text = $2 AND $1::text IS NOT NULL ${predykat}`,
              [cel.id, zrodlo.id]
            )
          ).rows
        : (
            await c.query<Record<string, unknown>>(
              `SELECT * FROM ${qi(poz.tabela)} WHERE organization_id::text = $1`,
              [zrodlo.id]
            )
          ).rows;
      const kolPk = await kolumnyKluczaGlownego(c, poz.tabela);
      if (kolPk.length === 0) {
        throw new Error(
          `${poz.tabela}: brak klucza głównego — nie da się zbudować manifestu cofnięcia per wiersz. Zatrzymuję się.`
        );
      }
      const kopia = zapiszDowod(
        `kopia-${poz.tabela}.csv`,
        'snapshot_json\n' + pelne.map((r) => csvCell(JSON.stringify(r))).join('\n') + '\n'
      );
      kopieCsv.push(kopia);
      for (const r of pelne) {
        wpisy.push({
          table: poz.tabela,
          // Klucz główny bywa ZŁOŻONY i bywa, że zawiera samo
          // `organization_id` (document_lifecycle_states, my_work_session_context)
          // — cofnięcie identyfikuje wiersz po pozostałych kolumnach klucza
          // + organizacji docelowej, bo po przeniesieniu tam właśnie leży.
          idColumn: kolPk.join('+'),
          id: kolPk.map((k) => String(r[k])).join('|'),
          action: 'archive',
          before: r,
          backupCsv: kopia,
        });
      }
    }
    const manifest: Manifest = {
      version: 1,
      script: SKRYPT,
      organizationId: zrodlo.id,
      organizationName: zrodlo.name,
      createdAt: new Date().toISOString(),
      entries: wpisy,
    };
    const sciezkaManifestu = zapiszDowod(
      'manifest.json',
      JSON.stringify(manifest, null, 2) + '\n'
    );
    console.log(`KOPIA CSV: ${kopieCsv.length} plików · MANIFEST: ${sciezkaManifestu} (${wpisy.length} wierszy)`);

    // ── TRANSAKCJA ─────────────────────────────────────────────────────────
    await c.query('BEGIN');
    let zatwierdzic = cli.tryb.rodzaj === 'apply';
    try {
      const przeniesione: Array<{ tabela: string; ile: number }> = [];
      for (const poz of plan) {
        if (poz.doPrzeniesienia === 0) continue;
        const predykat = poz.akcja === 'CZESC' ? CZESCIOWE[poz.tabela]!.predykat : '';
        const r = await c.query(
          `UPDATE ${qi(poz.tabela)} SET organization_id = $1 WHERE organization_id::text = $2 ${predykat}`,
          [cel.id, zrodlo.id]
        );
        przeniesione.push({ tabela: poz.tabela, ile: r.rowCount ?? 0 });
        if ((r.rowCount ?? 0) !== poz.doPrzeniesienia) {
          throw new Error(
            `${poz.tabela}: plan mówił ${poz.doPrzeniesienia}, UPDATE ruszył ${r.rowCount} — rozjazd, wycofuję`
          );
        }
      }
      const sumaPrzeniesionych = przeniesione.reduce((s, x) => s + x.ile, 0);
      console.log(`PRZENIESIONE: ${sumaPrzeniesionych} wierszy w ${przeniesione.length} tabelach`);

      // BRAMKA 1 — osierocenia w całym grafie
      const wskazaniaPo = await policzWskazaniaMiedzyOrg(c, krawedzie, zrodlo.id, cel.id);
      const bezFkPo = await policzWskazaniaBezFk(c, zrodlo.id, cel.id);
      zapiszDowod('wskazania-miedzy-org-PO.csv', wskazaniaCsv([...wskazaniaPo, ...bezFkPo]));
      for (const w of bezFkPo) {
        console.log(
          `  PO (bez FK, zadeklarowane) · ${w.dziecko}.${w.kolumna} → ${w.rodzic} · ${w.ile} wierszy (${w.orgDziecka} → ${w.orgRodzica})`
        );
      }
      // Porównanie LICZBOWE, nie „czy taka krawędź już była". Krawędź, która
      // przed zapisem miała 1 wiersz, a po zapisie 500, jest wzrostem i musi
      // zostać rozstrzygnięta — inaczej bramka przepuszcza masowe osierocenie
      // pod parasolem jednej starej anomalii.
      const przedIle = new Map(wskazaniaPrzed.map((w) => [kluczWskazania(w), w.ile] as const));
      const wzrosty = wskazaniaPo
        .map((w) => ({ w, przed: przedIle.get(kluczWskazania(w)) ?? 0 }))
        .filter((x) => x.w.ile > x.przed);
      const nowe = wzrosty.filter((x) => !czyDopuszczone(x.w));
      const dopuszczone = wskazaniaPo.filter(czyDopuszczone);
      console.log(
        `WSKAZANIA MIĘDZY ORGANIZACJAMI · PO: ${wskazaniaPo.reduce((s, x) => s + x.ile, 0)} wierszy · WZROSTY NIEDOPUSZCZONE: ${nowe.length}`
      );
      for (const x of wzrosty) {
        console.log(
          `  WZROST · ${x.w.dziecko}.${x.w.kolumna} → ${x.w.rodzic} · ${x.przed} → ${x.w.ile} (${x.w.orgDziecka} → ${x.w.orgRodzica})${czyDopuszczone(x.w) ? ' · DOPUSZCZONE' : ''}`
        );
      }
      for (const w of dopuszczone) {
        console.log(
          `  DOPUSZCZONE · ${w.dziecko}.${w.kolumna} → ${w.rodzic} · ${w.ile} wierszy (${w.orgDziecka} → ${w.orgRodzica})`
        );
      }
      if (nowe.length > 0) {
        for (const x of nowe) {
          console.log(
            `  OSIEROCENIE · ${x.w.dziecko}.${x.w.kolumna} → ${x.w.rodzic} · ${x.przed} → ${x.w.ile} wierszy (${x.w.orgDziecka} → ${x.w.orgRodzica}) · ${x.w.krawedz}`
          );
        }
        throw new Error(`BRAMKA OSIEROCENIA: ${nowe.length} wzrostów wskazań poza organizację — wycofuję`);
      }

      // BRAMKA 2 — duplikaty członkostwa
      const dup = await c.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM (
           SELECT organization_id, user_id FROM organization_members
            GROUP BY 1, 2 HAVING count(*) > 1) x`
      );
      if (Number(dup.rows[0]?.n ?? '0') > 0) {
        throw new Error(`BRAMKA CZŁONKOSTWA: ${dup.rows[0]!.n} duplikatów (organization_id, user_id) — wycofuję`);
      }
      console.log('BRAMKA CZŁONKOSTWA: 0 duplikatów (organization_id, user_id)');

      // DOWÓD — liczby PO
      const poCsv = zapiszDowod(
        'liczby-przed-po.csv',
        'tabela,akcja,w_zrodle_przed,przeniesione,w_zrodle_po,w_celu_przed,w_celu_po\n' +
          (
            await Promise.all(
              plan.map(async (x) => {
                const poZ = await policz(c, x.tabela, zrodlo.id);
                const poC = await policz(c, x.tabela, cel.id);
                const ruch = przeniesione.find((y) => y.tabela === x.tabela)?.ile ?? 0;
                return [x.tabela, x.akcja, x.wZrodle, ruch, poZ, x.wCelu, poC].map(csvCell).join(',');
              })
            )
          ).join('\n') +
          '\n'
      );
      console.log(`LICZBY PRZED/PO CSV: ${poCsv}`);

      const zostalo = (
        await Promise.all(plan.map(async (x) => ({ t: x.tabela, n: await policz(c, x.tabela, zrodlo.id) })))
      ).filter((x) => x.n > 0);
      console.log(`ZOSTAJE W ŹRÓDLE: ${zostalo.reduce((s, x) => s + x.n, 0)} wierszy w ${zostalo.length} tabelach`);
      for (const x of zostalo) console.log(`  ${x.t}: ${x.n}`);
    } catch (blad) {
      zatwierdzic = false;
      await c.query('ROLLBACK');
      console.error(`WYCOFANE: ${blad instanceof Error ? blad.message : String(blad)}`);
      process.exitCode = 3;
      return;
    }

    if (zatwierdzic) {
      await c.query('COMMIT');
      console.log('ZATWIERDZONE (COMMIT). Uruchom ten sam --dry-run drugi raz — musi wypisać do przeniesienia: 0.');
    } else {
      await c.query('ROLLBACK');
      console.log('DRY-RUN: transakcja WYCOFANA, w bazie nic się nie zmieniło. Kontrole przeszły.');
    }
  } finally {
    c.release();
    await p.end();
  }
}

const uruchomionyWprost =
  typeof process.argv[1] === 'string' && process.argv[1].includes('scal-organizacje');
if (uruchomionyWprost) {
  main().catch((błąd) => {
    console.error(String(błąd instanceof Error ? błąd.message : błąd));
    process.exit(1);
  });
}
