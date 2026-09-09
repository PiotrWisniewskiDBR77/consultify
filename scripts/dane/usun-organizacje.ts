#!/usr/bin/env tsx
/**
 * usun-organizacje.ts — sprzątanie organizacji śmieciowych (paczka D0 programu
 * „jedna baza pokazowa po angielsku”, docs/program/DANE_POKAZOWE_EN_20260908/PLAN.md §D0).
 *
 * ------------------------------------------------------------------------------
 * DLACZEGO TEN SKRYPT WYGLĄDA TAK, A NIE INACZEJ
 * ------------------------------------------------------------------------------
 * Ryzyko numer jeden przy sprzątaniu bazy to skasowanie DBR77 — prawdziwej firmy
 * właściciela — bo jakiś wzorzec nazwy („Consultify”, „Test Corp”) przypadkiem
 * pasował. Dlatego:
 *
 *   1. ŻADNEGO DOPASOWANIA PO NAZWIE. Skrypt czyta jawną listę identyfikatorów
 *      z pliku i porównuje je operatorem `=` (przez `= ANY($1::text[])`).
 *      Nie ma tu `LIKE`, nie ma regexu, nie ma `ILIKE '%…%'`. Nazwa organizacji
 *      jest w pliku listy WYŁĄCZNIE dla oczu człowieka; parser ją ignoruje.
 *   2. LISTA ZACHOWANA JAKO BEZPIECZNIK. Druga lista wymienia organizacje, których
 *      skasować nie wolno. Jeżeli przecięcie obu list jest niepuste, skrypt kończy
 *      się błędem PRZED nawiązaniem połączenia z bazą.
 *   3. GUARD HOSTA. Domyślnie skrypt działa wyłącznie na `127.0.0.1` / `localhost`.
 *      Zdalny host wymaga JEDNOCZEŚNIE `ALLOW_REMOTE_PURGE=1` i obecności hosta
 *      na jawnej liście `HOSTY_ZDALNE_DOZWOLONE`. Produkcja (centerbeam) jest
 *      odrzucana ZAWSZE, bez furtki.
 *   4. DWA KLUCZE DO KASOWANIA. `--apply` wymaga dodatkowo `FORCE_PURGE=true`
 *      (wzór: server/scripts/cleanup-orphan-demo-orgs.ts).
 *   5. BRAK TRYBU = BŁĄD. Nie ma domyślnego trybu. (PLAN.md §D0 krok 3 mówi
 *      w jednym zdaniu „--dry-run domyślny” i „brak trybu = błąd” — to sprzeczne.
 *      Wybrano wariant ostrzejszy, zgodny z precedensem
 *      scripts/demo/seed-organizacja-pilotaz.ts.)
 *
 * ------------------------------------------------------------------------------
 * TOPOLOGIA KLUCZY OBCYCH — CZYTANA, NIE ZASZYTA
 * ------------------------------------------------------------------------------
 * PLAN.md §2.3 podaje „164 FK na organizations.id (129 CASCADE, 8 SET NULL,
 * 27 NO ACTION)” za pomiarem z 2026-07-19. Na kopii z 2026-09-08 jest ich 294
 * (183 CASCADE, 94 NO ACTION, 11 SET NULL, 6 RESTRICT) — liczba w planie zdążyła
 * się zestarzeć w siedem tygodni. Dlatego skrypt NIE ma żadnej z tych liczb
 * zaszytej: czyta `information_schema` przy każdym uruchomieniu.
 *
 * Kolejność kasowania: najpierw JAWNIE każda tabela mająca wskaźnik na organizację
 * (pętla zbieżna, savepoint per tabela), na końcu wiersz w `organizations`.
 *
 * Dlaczego jawnie WSZYSTKIE, a nie tylko te blokujące: próba na jednej organizacji
 * (klon „Atelier Toys", 344 wiersze) pokazała, że po skasowaniu samej organizacji
 * zostaje 131 wierszy (38 %) — w tabelach, które mają kolumnę `organization_id`,
 * ale NIE mają na niej klucza obcego. Kaskada ich nie widzi. To jest dokładnie ten
 * mechanizm, który wyprodukował 38 715 sierot leżących dziś w bazie.
 *
 * ------------------------------------------------------------------------------
 * UŻYCIE
 * ------------------------------------------------------------------------------
 *   # 1) DRY-RUN — nic nie zapisuje, tylko liczy i pisze raport:
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54418/consultify_kopia_d0 \
 *     npx tsx scripts/dane/usun-organizacje.ts \
 *       --oczekiwany-host 127.0.0.1 \
 *       --lista-id scripts/dane/lista-do-usuniecia.txt \
 *       --dry-run
 *
 *   # 2) APPLY — dopiero po akcepcie raportu przez właściciela:
 *   DATABASE_URL=… FORCE_PURGE=true npx tsx scripts/dane/usun-organizacje.ts \
 *       --oczekiwany-host 127.0.0.1 --lista-id … --apply
 *
 *   # 3) ROLLBACK z manifestu zapisanego przez --apply:
 *   DATABASE_URL=… npx tsx scripts/dane/usun-organizacje.ts \
 *       --oczekiwany-host 127.0.0.1 --rollback=evidence/dane-pokazowe-en/<manifest>.json
 *
 *   # 4) VERIFY — czy organizacje z listy faktycznie zniknęły:
 *   DATABASE_URL=… npx tsx scripts/dane/usun-organizacje.ts \
 *       --oczekiwany-host 127.0.0.1 --lista-id … --verify
 *
 *   # 5) Dopisz --sieroty do --dry-run, żeby policzyć wiersze wskazujące na
 *   #    nieistniejące organizacje (ten skrypt ich NIE usuwa).
 *
 * Ten skrypt NIE jest podpięty pod żaden autorun. To narzędzie operatora.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool, type PoolClient } from 'pg';

// ============================================================================
// Stałe
// ============================================================================

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..', '..');
export const KATALOG_DOWODOW = path.join(REPO_ROOT, 'evidence', 'dane-pokazowe-en');
export const PLIK_LISTY_ZACHOWANEJ_DOMYSLNY = path.join(HERE, 'lista-zachowana.txt');

/** Hosty zdalne, na które wolno celować, i to tylko przy `ALLOW_REMOTE_PURGE=1`. */
export const HOSTY_ZDALNE_DOZWOLONE = ['thomas.proxy.rlwy.net', 'trolley.proxy.rlwy.net'];

/** Hosty lokalne — jedyne dopuszczone bez dodatkowych zmiennych środowiskowych. */
export const HOSTY_LOKALNE = ['127.0.0.1', 'localhost', '::1', '0.0.0.0'];

export type Tryb = 'dry-run' | 'apply' | 'rollback' | 'verify';

export type Opcje = {
  tryb: Tryb;
  odcisk: string;
  plikListy: string;
  plikZachowanych: string;
  plikManifestu: string;
  limitTabelWRaporcie: number;
  policzSieroty: boolean;
};

// ============================================================================
// 1. Parser listy identyfikatorów — funkcja czysta, testowalna bez bazy
// ============================================================================

/**
 * Czyta plik listy i zwraca WYŁĄCZNIE identyfikatory organizacji.
 *
 * Format wiersza:  `<id> | <nazwa> | <członków> | <powód>`
 * Bierzemy pierwszą kolumnę i nic więcej. Nazwa jest komentarzem dla człowieka —
 * gdyby parser jej używał, wróciłoby dopasowanie po nazwie, czyli dokładnie to
 * ryzyko, przed którym ten skrypt ma chronić.
 *
 * Ignorowane: linie puste i zaczynające się od `#`.
 * Odrzucane błędem: identyfikator z białym znakiem w środku, duplikaty, pusta lista.
 */
export function parsujListe(tekst: string, etykieta = 'lista'): string[] {
  const idy: string[] = [];
  const widziane = new Set<string>();
  const linie = tekst.split(/\r?\n/);

  for (let i = 0; i < linie.length; i++) {
    const surowa = linie[i]!;
    const bezKomentarza = surowa.trim();
    if (!bezKomentarza || bezKomentarza.startsWith('#')) continue;

    const id = bezKomentarza.split('|')[0]!.trim();
    if (!id) throw new Error(`${etykieta}, wiersz ${i + 1}: pusty identyfikator.`);
    if (/\s/.test(id))
      throw new Error(
        `${etykieta}, wiersz ${i + 1}: identyfikator „${id}" zawiera biały znak. ` +
          'Separator kolumn to „|". Poprawcie plik ręcznie — skrypt nie zgaduje.'
      );
    if (widziane.has(id))
      throw new Error(`${etykieta}, wiersz ${i + 1}: identyfikator „${id}" powtarza się.`);
    widziane.add(id);
    idy.push(id);
  }

  if (!idy.length) throw new Error(`${etykieta}: lista jest pusta. Odmowa — pusta lista to nie „nic do roboty", to błąd wejścia.`);
  return idy;
}

// ============================================================================
// 2. Bezpiecznik listy zachowanej — funkcja czysta
// ============================================================================

/**
 * Odmawia, jeśli którakolwiek organizacja z listy zachowanej trafiła na listę
 * do usunięcia. To ostatnia bariera przed skasowaniem DBR77.
 *
 * Porównanie jest po identyfikatorze, dokładne, bez normalizacji wielkości liter —
 * identyfikatory w `organizations.id` są wrażliwe na wielkość liter.
 */
export function sprawdzKolizjeZZachowanymi(doUsuniecia: string[], zachowane: string[]): void {
  const chronione = new Set(zachowane);
  const kolizje = doUsuniecia.filter((id) => chronione.has(id));
  if (kolizje.length)
    throw new Error(
      `ODMOWA: na liście do usunięcia jest ${kolizje.length} identyfikator(ów) z listy ZACHOWANEJ: ` +
        `${kolizje.join(', ')}. To organizacje, których kasować nie wolno. STOP.`
    );
}

// ============================================================================
// 3. Guard hosta — funkcja czysta
// ============================================================================

export function tozsamoscCelu(url: string): { host: string; port: string; baza: string } {
  const u = new URL(url);
  return {
    host: u.hostname.toLowerCase(),
    port: u.port || '5432',
    baza: decodeURIComponent(u.pathname.replace(/^\//, '')).toLowerCase(),
  };
}

/**
 * Reguły, w kolejności odrzucania:
 *   a) produkcja (centerbeam) — odrzucana ZAWSZE, nie ma zmiennej, która to odblokuje,
 *   b) host lokalny — przechodzi,
 *   c) host zdalny — wymaga `ALLOW_REMOTE_PURGE=1` ORAZ obecności na
 *      `HOSTY_ZDALNE_DOZWOLONE`; brak któregokolwiek = odmowa,
 *   d) deklaracja `--oczekiwany-host` musi być fragmentem faktycznego hosta —
 *      operator musi wiedzieć, w co celuje, zanim skrypt to potwierdzi.
 */
export function sprawdzCel(
  url: string,
  odcisk: string,
  env: Record<string, string | undefined> = process.env
): string {
  const { host, port, baza } = tozsamoscCelu(url);

  if (/centerbeam/i.test(host) || /centerbeam/i.test(baza))
    throw new Error('Cel wskazuje PRODUKCJĘ (centerbeam). Odmowa bezwarunkowa. STOP.');

  const lokalny = HOSTY_LOKALNE.includes(host);
  if (!lokalny) {
    if (env.ALLOW_REMOTE_PURGE !== '1')
      throw new Error(
        `Cel „${host}" nie jest hostem lokalnym. Domyślnie ten skrypt działa wyłącznie na ` +
          `${HOSTY_LOKALNE.join(' / ')}. Zdalny host wymaga ALLOW_REMOTE_PURGE=1. STOP.`
      );
    if (!HOSTY_ZDALNE_DOZWOLONE.includes(host))
      throw new Error(
        `Cel „${host}" nie jest na jawnej liście hostów zdalnych ` +
          `(${HOSTY_ZDALNE_DOZWOLONE.join(', ')}). Sama zmienna ALLOW_REMOTE_PURGE=1 nie wystarcza. STOP.`
      );
  }

  if (!odcisk) throw new Error('Brak --oczekiwany-host. Zadeklaruj, w co celujesz. STOP.');
  if (!host.includes(odcisk))
    throw new Error(
      `Cel NIE pasuje do deklaracji --oczekiwany-host „${odcisk}" (host nie jest pokazywany w błędzie). STOP.`
    );

  return `${host}:${port}/${baza}`;
}

// ============================================================================
// 4. Drugi klucz do kasowania — funkcja czysta
// ============================================================================

export function wymagajForcePurge(tryb: Tryb, env: Record<string, string | undefined> = process.env): void {
  if (tryb !== 'apply') return;
  if (env.FORCE_PURGE !== 'true')
    throw new Error(
      '--apply wymaga FORCE_PURGE=true (dwa klucze). Uruchom ponownie z FORCE_PURGE=true, ' +
        'ale dopiero gdy raport dry-run jest zaakceptowany przez właściciela. STOP.'
    );
}

// ============================================================================
// 5. Parser CLI — funkcja czysta
// ============================================================================

export function parsujCli(argv: string[]): Opcje {
  let tryb: Tryb | null = null;
  let odcisk = '';
  let plikListy = '';
  let plikZachowanych = PLIK_LISTY_ZACHOWANEJ_DOMYSLNY;
  let plikManifestu = '';
  let limitTabelWRaporcie = 25;
  let policzSieroty = false;

  /**
   * Odczyt wartości opcji. Postać „--klucz=wartość" jest jednoznaczna; postać
   * „--klucz wartość" konsumuje NASTĘPNY token tylko wtedy, gdy nie jest on sam
   * opcją. Bez tego zastrzeżenia `--rollback --oczekiwany-host 127.0.0.1` uznałby
   * „--oczekiwany-host" za ścieżkę manifestu, a operator zobaczyłby mylący błąd
   * zamiast „podaj manifest".
   */
  const wartosc = (a: string, prefiks: string, i: { v: number }): string => {
    if (a.startsWith(`${prefiks}=`)) return a.slice(prefiks.length + 1);
    const nast = argv[i.v + 1];
    if (nast === undefined || nast.startsWith('--')) return '';
    i.v += 1;
    return nast;
  };

  const idx = { v: 0 };
  for (idx.v = 0; idx.v < argv.length; idx.v++) {
    const a = argv[idx.v]!;
    if (a === '--dry-run') tryb = 'dry-run';
    else if (a === '--apply') tryb = 'apply';
    else if (a === '--verify') tryb = 'verify';
    else if (a === '--rollback' || a.startsWith('--rollback=')) {
      tryb = 'rollback';
      plikManifestu = wartosc(a, '--rollback', idx);
    } else if (a === '--lista-id' || a.startsWith('--lista-id=')) plikListy = wartosc(a, '--lista-id', idx);
    else if (a === '--lista-zachowana' || a.startsWith('--lista-zachowana='))
      plikZachowanych = wartosc(a, '--lista-zachowana', idx);
    else if (a === '--oczekiwany-host' || a.startsWith('--oczekiwany-host='))
      odcisk = wartosc(a, '--oczekiwany-host', idx);
    else if (a === '--sieroty') policzSieroty = true;
    else if (a === '--tabel-w-raporcie' || a.startsWith('--tabel-w-raporcie='))
      limitTabelWRaporcie = Number(wartosc(a, '--tabel-w-raporcie', idx)) || 25;
    else throw new Error(`Nieznany argument: ${a}`);
  }

  if (!tryb)
    throw new Error(
      'Podaj dokładnie jeden tryb: --dry-run | --apply | --rollback=<manifest.json> | --verify. ' +
        'Domyślnego trybu celowo nie ma.'
    );
  if (!odcisk)
    throw new Error('Brak --oczekiwany-host. Podaj fragment hosta bazy (np. 127.0.0.1). STOP.');
  if (tryb === 'rollback' && !plikManifestu)
    throw new Error('--rollback wymaga ścieżki do manifestu: --rollback=<plik.json>.');
  if (tryb !== 'rollback' && !plikListy)
    throw new Error('Brak --lista-id <plik.txt>. Skrypt nigdy nie dobiera organizacji sam. STOP.');

  return { tryb, odcisk, plikListy, plikZachowanych, plikManifestu, limitTabelWRaporcie, policzSieroty };
}

// ============================================================================
// 6. Część bazodanowa
// ============================================================================

export type KolumnaOrg = { tabela: string; kolumna: string; typ: string };
export type LiczbaWTabeli = { tabela: string; kolumna: string; wierszy: number };

const qi = (v: string) => `"${v.replace(/"/g, '""')}"`;
const stempel = () => new Date().toISOString().replace(/[:.]/g, '-');

/** Wszystkie kolumny wskazujące na organizację — z FK na `organizations.id` i po nazwie. */
export async function kolumnyOrganizacji(c: PoolClient): Promise<KolumnaOrg[]> {
  const r = await c.query<{ tabela: string; kolumna: string; typ: string }>(`
    WITH z_fk AS (
      SELECT src.relname AS tabela, sa.attname AS kolumna
        FROM pg_constraint con
        JOIN pg_class src ON src.oid = con.conrelid
        JOIN pg_class tgt ON tgt.oid = con.confrelid
        JOIN pg_namespace n ON n.oid = src.relnamespace AND n.nspname = 'public'
        JOIN unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
        JOIN pg_attribute sa ON sa.attrelid = src.oid AND sa.attnum = k.attnum
       WHERE con.contype = 'f' AND tgt.relname = 'organizations'
    ),
    po_nazwie AS (
      SELECT c.relname AS tabela, a.attname AS kolumna
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
       WHERE c.relkind = 'r' AND a.attname = 'organization_id'
    ),
    razem AS (SELECT * FROM z_fk UNION SELECT * FROM po_nazwie)
    SELECT r.tabela, r.kolumna, format_type(a.atttypid, a.atttypmod) AS typ
      FROM razem r
      JOIN pg_class c ON c.relname = r.tabela
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public' AND c.relkind = 'r'
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = r.kolumna
     WHERE r.tabela <> 'organizations'
     ORDER BY 1, 2`);
  return r.rows;
}

/** Kolumny z FK `NO ACTION`/`RESTRICT` — te zablokują usunięcie organizacji, jeśli ich nie wyczyścić. */
export async function kolumnyBlokujace(c: PoolClient): Promise<Array<{ tabela: string; kolumna: string }>> {
  const r = await c.query<{ tabela: string; kolumna: string }>(`
    SELECT tc.table_name AS tabela, kcu.column_name AS kolumna
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND ccu.table_name = 'organizations' AND ccu.column_name = 'id'
       AND rc.delete_rule IN ('NO ACTION', 'RESTRICT')
     ORDER BY 1, 2`);
  return r.rows;
}

/**
 * Liczy wiersze należące do wskazanych organizacji, tabela po tabeli.
 * Porównanie zawsze `kolumna::text = ANY($1::text[])` — 12 tabel trzyma
 * `organization_id` jako `uuid`, a 2 jako `varchar(36)`; rzutowanie na tekst
 * ujednolica je bez ryzyka błędu typu.
 */
export async function policzWierszePerTabela(
  c: PoolClient,
  kolumny: KolumnaOrg[],
  idy: string[]
): Promise<LiczbaWTabeli[]> {
  const wynik: LiczbaWTabeli[] = [];
  for (const k of kolumny) {
    // eslint-disable-next-line no-await-in-loop
    const r = await c.query<{ n: string }>(
      `SELECT count(*)::bigint AS n FROM ${qi(k.tabela)} WHERE ${qi(k.kolumna)}::text = ANY($1::text[])`,
      [idy]
    );
    const n = Number(r.rows[0]?.n ?? 0);
    if (n > 0) wynik.push({ tabela: k.tabela, kolumna: k.kolumna, wierszy: n });
  }
  return wynik.sort((a, b) => b.wierszy - a.wierszy);
}

// ============================================================================
// 7. Manifest — snapshot „przed” i podstawa rollbacku
// ============================================================================

export type Manifest = {
  wersja: 1;
  skrypt: 'usun-organizacje';
  utworzono: string;
  cel: string;
  organizacje: Array<{ id: string; nazwa: string | null }>;
  /** Pełne wiersze, tabela → lista wierszy jako obiekty JSON. */
  wiersze: Record<string, Record<string, unknown>[]>;
  /** Kolejność, w jakiej tabele były kasowane (rollback idzie odwrotnie). */
  kolejnoscKasowania: string[];
};

export function zapiszManifest(m: Manifest, katalog = KATALOG_DOWODOW): string {
  fs.mkdirSync(katalog, { recursive: true });
  const p = path.join(katalog, `usun-organizacje-${stempel()}-manifest.json`);
  fs.writeFileSync(p, JSON.stringify(m, null, 2) + '\n');
  return p;
}

export function wczytajManifest(p: string): Manifest {
  const m = JSON.parse(fs.readFileSync(path.resolve(p), 'utf8')) as Manifest;
  if (m.wersja !== 1 || m.skrypt !== 'usun-organizacje')
    throw new Error('Manifest nie pochodzi z tego skryptu (oczekiwano wersja=1, skrypt="usun-organizacje").');
  return m;
}

function komorkaCsv(v: unknown): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

export function zapiszCsv(nazwa: string, naglowek: string[], wiersze: unknown[][], katalog = KATALOG_DOWODOW): string {
  fs.mkdirSync(katalog, { recursive: true });
  const p = path.join(katalog, `${nazwa}-${stempel()}.csv`);
  const tresc =
    naglowek.map(komorkaCsv).join(',') + '\n' + wiersze.map((r) => r.map(komorkaCsv).join(',')).join('\n') + '\n';
  fs.writeFileSync(p, tresc);
  return p;
}

// ============================================================================
// 8. Główna ścieżka
// ============================================================================

function pula(): Pool {
  if (!process.env.DATABASE_URL) throw new Error('Brak jawnego DATABASE_URL. STOP.');
  return new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
}

async function nazwyOrganizacji(c: PoolClient, idy: string[]) {
  const r = await c.query<{ id: string; name: string | null }>(
    'SELECT id, name FROM organizations WHERE id = ANY($1::text[]) ORDER BY name NULLS LAST',
    [idy]
  );
  return r.rows;
}

async function czlonkowie(c: PoolClient, idy: string[]) {
  const r = await c.query<{ organization_id: string; n: string }>(
    'SELECT organization_id, count(*)::bigint AS n FROM organization_members WHERE organization_id = ANY($1::text[]) GROUP BY 1',
    [idy]
  );
  return new Map(r.rows.map((x) => [x.organization_id, Number(x.n)]));
}

async function trybDryRun(c: PoolClient, idy: string[], cel: string, opcje: Opcje) {
  const istniejace = await nazwyOrganizacji(c, idy);
  const znalezione = new Set(istniejace.map((o) => o.id));
  const brakujace = idy.filter((id) => !znalezione.has(id));

  console.log(`\n[d0] Lista wejściowa: ${idy.length} identyfikatorów.`);
  console.log(`[d0] Znalezione w bazie: ${istniejace.length}. Nieistniejące: ${brakujace.length}.`);
  if (brakujace.length) {
    console.log('[d0] Nieistniejące identyfikatory (zostaną pominięte, to nie błąd):');
    brakujace.slice(0, 20).forEach((id) => console.log(`      - ${id}`));
    if (brakujace.length > 20) console.log(`      … i ${brakujace.length - 20} więcej`);
  }
  if (!istniejace.length) {
    console.log('[d0] Żadna organizacja z listy nie istnieje. Nic do zrobienia.');
    return;
  }

  const idyIstniejace = istniejace.map((o) => o.id);
  const kolumny = await kolumnyOrganizacji(c);
  const blokujace = await kolumnyBlokujace(c);
  console.log(
    `[d0] Topologia odczytana z bazy: ${kolumny.length} kolumn wskazujących na organizację, ` +
      `w tym ${blokujace.length} z FK NO ACTION/RESTRICT (kasowane jawnie przed organizacją).`
  );

  const perTabela = await policzWierszePerTabela(c, kolumny, idyIstniejace);
  const suma = perTabela.reduce((s, x) => s + x.wierszy, 0);

  console.log(`\n[d0] === RAPORT PER TABELA ===`);
  console.log(`[d0] Wierszy do usunięcia: ${suma} z ${perTabela.length} tabel (z ${kolumny.length} sprawdzonych).`);
  console.log(`[d0] Top ${Math.min(opcje.limitTabelWRaporcie, perTabela.length)} tabel:`);
  perTabela.slice(0, opcje.limitTabelWRaporcie).forEach((t, i) => {
    console.log(`      ${String(i + 1).padStart(3)}. ${t.tabela}.${t.kolumna}: ${t.wierszy}`);
  });

  // Raport per organizacja — liczony po tabelach, które w ogóle coś mają.
  const tabeleNiepuste = perTabela.map((t) => ({ tabela: t.tabela, kolumna: t.kolumna }));
  const perOrg: Array<{ id: string; nazwa: string; wierszy: number; tabel: number }> = [];
  const czlonkow = await czlonkowie(c, idyIstniejace);
  for (const o of istniejace) {
    let suma1 = 0;
    let tabel = 0;
    for (const t of tabeleNiepuste) {
      // eslint-disable-next-line no-await-in-loop
      const r = await c.query<{ n: string }>(
        `SELECT count(*)::bigint AS n FROM ${qi(t.tabela)} WHERE ${qi(t.kolumna)}::text = $1`,
        [o.id]
      );
      const n = Number(r.rows[0]?.n ?? 0);
      if (n > 0) {
        suma1 += n;
        tabel += 1;
      }
    }
    perOrg.push({ id: o.id, nazwa: o.name ?? '', wierszy: suma1, tabel });
  }
  perOrg.sort((a, b) => b.wierszy - a.wierszy);

  console.log(`\n[d0] === RAPORT PER ORGANIZACJA (top 15 z ${perOrg.length}) ===`);
  perOrg.slice(0, 15).forEach((o, i) => {
    console.log(
      `      ${String(i + 1).padStart(3)}. ${o.id} | ${o.nazwa} | członków=${czlonkow.get(o.id) ?? 0} | wierszy=${o.wierszy} | tabel=${o.tabel}`
    );
  });

  const csvTabele = zapiszCsv(
    'dry-run-per-tabela',
    ['tabela', 'kolumna', 'wierszy'],
    perTabela.map((t) => [t.tabela, t.kolumna, t.wierszy])
  );
  const csvOrg = zapiszCsv(
    'dry-run-per-organizacja',
    ['organization_id', 'nazwa', 'czlonkow', 'wierszy', 'tabel'],
    perOrg.map((o) => [o.id, o.nazwa, czlonkow.get(o.id) ?? 0, o.wierszy, o.tabel])
  );

  console.log(`\n[d0] CSV per tabela:       ${csvTabele}`);
  console.log(`[d0] CSV per organizacja:  ${csvOrg}`);

  if (opcje.policzSieroty) {
    // ------------------------------------------------------------------------
    // Sieroty: wiersze, których `organization_id` wskazuje na organizację,
    // której w `organizations` już nie ma. Ten purge ich NIE usuwa (nie należą
    // do żadnej organizacji z listy) i kaskada ich nie dosięgnie.
    //
    // To jest wyjaśnienie różnicy między liczbą z PLAN.md (70 656) a realną
    // liczbą do usunięcia. POMIAR.sql Q7/Q8 liczył „wiersze spoza listy 6+demo-org",
    // co wrzuciło sieroty do jednego worka z danymi żywych organizacji testowych.
    // ------------------------------------------------------------------------
    console.log('\n[d0] Liczę sieroty (to trwa — pełny skan tabel z kolumną organizacji)…');
    const sieroty: Array<{ tabela: string; kolumna: string; wierszy: number }> = [];
    for (const k of kolumny) {
      // eslint-disable-next-line no-await-in-loop
      const r = await c.query<{ n: string }>(
        `SELECT count(*)::bigint AS n FROM ${qi(k.tabela)} t
          WHERE t.${qi(k.kolumna)} IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = t.${qi(k.kolumna)}::text)`
      );
      const n = Number(r.rows[0]?.n ?? 0);
      if (n > 0) sieroty.push({ tabela: k.tabela, kolumna: k.kolumna, wierszy: n });
    }
    sieroty.sort((a, b) => b.wierszy - a.wierszy);
    const sumaSierot = sieroty.reduce((s, x) => s + x.wierszy, 0);
    console.log(`[d0] SIEROTY: ${sumaSierot} wierszy w ${sieroty.length} tabelach — TEN SKRYPT ICH NIE USUWA.`);
    sieroty.slice(0, 10).forEach((s, i) => console.log(`      ${i + 1}. ${s.tabela}.${s.kolumna}: ${s.wierszy}`));
    const csvSieroty = zapiszCsv(
      'sieroty-per-tabela',
      ['tabela', 'kolumna', 'wierszy'],
      sieroty.map((s) => [s.tabela, s.kolumna, s.wierszy])
    );
    console.log(`[d0] CSV sieroty:          ${csvSieroty}`);
  }
  console.log(`[d0] Cel: ${cel}`);
  console.log(
    `\n[d0] DRY-RUN zakończony. NIC NIE ZOSTAŁO ZMIENIONE.\n` +
      `[d0] UWAGA: liczba ${suma} obejmuje wyłącznie tabele mające kolumnę wskazującą na organizację.\n` +
      `[d0] Wiersze znikające kaskadą z tabel bez takiej kolumny (np. komentarze zadania) NIE są tu liczone —\n` +
      `[d0] realna liczba usuniętych wierszy będzie WIĘKSZA. To dolna granica, nie górna.\n`
  );
}

async function zbierzWiersze(
  c: PoolClient,
  kolumny: Array<{ tabela: string; kolumna: string }>,
  idy: string[]
): Promise<Record<string, Record<string, unknown>[]>> {
  const out: Record<string, Record<string, unknown>[]> = {};
  for (const k of kolumny) {
    // eslint-disable-next-line no-await-in-loop
    const r = await c.query(
      `SELECT * FROM ${qi(k.tabela)} WHERE ${qi(k.kolumna)}::text = ANY($1::text[])`,
      [idy]
    );
    if (r.rows.length) out[k.tabela] = [...(out[k.tabela] ?? []), ...(r.rows as Record<string, unknown>[])];
  }
  return out;
}

async function trybApply(c: PoolClient, idy: string[], cel: string) {
  const istniejace = await nazwyOrganizacji(c, idy);
  if (!istniejace.length) {
    console.log('[d0] Żadna organizacja z listy nie istnieje. Nic do zrobienia.');
    return;
  }
  const idyIstniejace = istniejace.map((o) => o.id);
  const kolumny = await kolumnyOrganizacji(c);
  const blokujace = await kolumnyBlokujace(c);

  // ---------------------------------------------------------------------------
  // Snapshot „przed”: KAŻDY wiersz w KAŻDEJ tabeli niosącej wskaźnik na organizację
  // — nie tylko w tabelach blokujących.
  //
  // Pierwsza wersja tego skryptu kopiowała wyłącznie tabele z FK NO ACTION, bo
  // tylko one są kasowane jawnie. `--rollback` meldowałby wtedy sukces, a wiersze
  // zdjęte kaskadą (czyli większość) nie wróciłyby. Rollback, który przywraca
  // część danych i mówi „gotowe", jest gorszy niż brak rollbacku.
  //
  // GRANICA, KTÓRĄ TRZEBA ZNAĆ: manifest nie obejmuje tabel BEZ wskaźnika na
  // organizację, kasowanych kaskadą przez rodzica (np. komentarz zadania ginie
  // razem z zadaniem). Dla nich jedynym zabezpieczeniem jest `pg_dump` zrobiony
  // przed operacją. Skrypt mówi o tym wprost przy każdym --apply.
  // ---------------------------------------------------------------------------
  const wiersze = await zbierzWiersze(c, kolumny, idyIstniejace);
  wiersze.organizations = (
    await c.query('SELECT * FROM organizations WHERE id = ANY($1::text[])', [idyIstniejace])
  ).rows as Record<string, unknown>[];
  const wierszyWManifescie = Object.values(wiersze).reduce((s, x) => s + x.length, 0);

  const manifest: Manifest = {
    wersja: 1,
    skrypt: 'usun-organizacje',
    utworzono: new Date().toISOString(),
    cel,
    organizacje: istniejace.map((o) => ({ id: o.id, nazwa: o.name })),
    wiersze,
    // Rollback wstawia `organizations` jako pierwsze, resztę w pętli zbieżnej —
    // dlatego ta lista jest informacyjna, nie jest kolejnością wymuszaną.
    kolejnoscKasowania: [...blokujace.map((k) => k.tabela), 'organizations'],
  };
  const sciezkaManifestu = zapiszManifest(manifest);
  console.log(`[d0] Manifest „przed" zapisany: ${sciezkaManifestu} (${wierszyWManifescie} wierszy).`);
  console.log(
    '[d0] GRANICA ROLLBACKU: manifest obejmuje wyłącznie tabele ze wskaźnikiem na organizację. ' +
      'Wiersze kasowane kaskadą z tabel BEZ takiego wskaźnika przywróci tylko pg_dump zrobiony przed operacją.'
  );

  const przed = await policzWierszePerTabela(c, kolumny, idyIstniejace);
  const sumaPrzed = przed.reduce((s, x) => s + x.wierszy, 0);

  // ---------------------------------------------------------------------------
  // Kasowanie: JAWNIE z każdej tabeli mającej wskaźnik na organizację, nie tylko
  // z tabel blokujących.
  //
  // Pierwsza wersja robiła to, co `cleanup-orphan-demo-orgs.ts`: czyściła tabele
  // z FK NO ACTION i zostawiała resztę kaskadzie. Próba na jednej organizacji
  // pokazała, że to za mało: ze 344 wierszy klonu „Atelier Toys" zostały 131
  // (38 %) — w tabelach, które mają kolumnę `organization_id`, ale NIE mają na
  // niej klucza obcego. Kaskada ich nie widzi. To właśnie mechanizm, który
  // wyprodukował 38 715 sierot leżących dziś w bazie. Kasowanie, które zostawia
  // 38 % tenanta, nie jest sprzątaniem.
  //
  // Pętla jest zbieżna (powtarza przebiegi dopóki cokolwiek ubywa), więc nie
  // musimy sortować tabel topologicznie: zależność `RESTRICT` między dwiema
  // tabelami rozwiąże się w kolejnym przebiegu.
  // ---------------------------------------------------------------------------
  const doKasacji = przed.map((t) => ({ tabela: t.tabela, kolumna: t.kolumna }));
  console.log(`[d0] Do wyczyszczenia jawnie: ${doKasacji.length} tabel (z ${blokujace.length} blokującymi w tej liczbie).`);

  await c.query('BEGIN');
  try {
    let usuniete = 0;
    let pozostale = [...doKasacji];
    const ostatniBlad = new Map<string, string>();
    for (let przebieg = 1; przebieg <= 10 && pozostale.length; przebieg++) {
      const nieudane: typeof pozostale = [];
      let wTymPrzebiegu = 0;
      for (const t of pozostale) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await c.query('SAVEPOINT k');
          // eslint-disable-next-line no-await-in-loop
          const r = await c.query(
            `DELETE FROM ${qi(t.tabela)} WHERE ${qi(t.kolumna)}::text = ANY($1::text[])`,
            [idyIstniejace]
          );
          // eslint-disable-next-line no-await-in-loop
          await c.query('RELEASE SAVEPOINT k');
          usuniete += r.rowCount ?? 0;
          wTymPrzebiegu += r.rowCount ?? 0;
        } catch (e) {
          // eslint-disable-next-line no-await-in-loop
          await c.query('ROLLBACK TO SAVEPOINT k');
          nieudane.push(t);
          ostatniBlad.set(`${t.tabela}.${t.kolumna}`, (e as Error).message);
          // Dziecko BEZ wskaźnika na organizację, przypięte do rodzica kluczem obcym
          // NO ACTION/RESTRICT (np. ai_chat_run_events → ai_chat_runs). Kaskada go nie
          // dosięga, a pętla po tabelach z organization_id go nie widzi. Zbieramy jego
          // wiersze do manifestu i kasujemy jawnie; rodzic zejdzie w następnym przebiegu.
          const m = /violates foreign key constraint "([^"]+)" on table "([^"]+)"/.exec((e as Error).message);
          if (m) {
            // eslint-disable-next-line no-await-in-loop
            const fk = await c.query(
              `SELECT c.conrelid::regclass::text AS dziecko,
                      (SELECT array_agg(a.attname ORDER BY x.ord) FROM unnest(c.conkey) WITH ORDINALITY x(attnum, ord)
                         JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = x.attnum) AS kol_dziecka,
                      (SELECT array_agg(a.attname ORDER BY x.ord) FROM unnest(c.confkey) WITH ORDINALITY x(attnum, ord)
                         JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = x.attnum) AS kol_rodzica
                 FROM pg_constraint c WHERE c.conname = $1 AND c.confrelid = $2::regclass`,
              [m[1], t.tabela]
            );
            const f = fk.rows[0] as { dziecko: string; kol_dziecka: string[]; kol_rodzica: string[] } | undefined;
            if (f && f.kol_dziecka.length === 1 && f.kol_rodzica.length === 1) {
              const sel = `SELECT * FROM ${qi(f.dziecko)} WHERE ${qi(f.kol_dziecka[0])} IN (SELECT ${qi(f.kol_rodzica[0])} FROM ${qi(t.tabela)} WHERE ${qi(t.kolumna)}::text = ANY($1::text[]))`;
              // eslint-disable-next-line no-await-in-loop
              const rows = (await c.query(sel, [idyIstniejace])).rows as Record<string, unknown>[];
              manifest.wiersze[f.dziecko] = [...(manifest.wiersze[f.dziecko] ?? []), ...rows];
              // eslint-disable-next-line no-await-in-loop
              const del = await c.query(sel.replace(/^SELECT \* FROM/, 'DELETE FROM'), [idyIstniejace]);
              usuniete += del.rowCount ?? 0;
              wTymPrzebiegu += del.rowCount ?? 0;
              console.log(`[d0] dziecko bez wskaźnika na organizację: ${f.dziecko}.${f.kol_dziecka[0]} → ${t.tabela}: ${del.rowCount} wierszy do manifestu i skasowanych`);
            }
          }
          if (przebieg >= 9) console.error(`[d0] ${t.tabela}: ${(e as Error).message}`);
        }
      }
      pozostale = nieudane;
      console.log(`[d0] kasowanie przebieg ${przebieg}: usunięto łącznie ${usuniete}, tabel z problemem ${pozostale.length}`);
      if (pozostale.length && !wTymPrzebiegu) {
        for (const t of pozostale)
          console.error(`[d0] UTKNĘŁO ${t.tabela}.${t.kolumna}: ${ostatniBlad.get(`${t.tabela}.${t.kolumna}`) ?? '(brak komunikatu)'}`);
        throw new Error(`Kasowanie utknęło na ${pozostale.length} tabelach. Transakcja wycofana.`);
      }
    }
    if (pozostale.length) throw new Error(`Kasowanie nie zbiegło się w 10 przebiegach. Transakcja wycofana.`);

    const org = await c.query('DELETE FROM organizations WHERE id = ANY($1::text[])', [idyIstniejace]);
    // Manifest dopisany o dzieci bez wskaźnika na organizację — nadpisz plik przed COMMIT.
    fs.writeFileSync(sciezkaManifestu, JSON.stringify(manifest, null, 0));
    await c.query('COMMIT');
    console.log(
      `[d0] APPLY: usunięto ${org.rowCount} organizacji i ${usuniete} wierszy jawnie ` +
        `(przed kasowaniem naliczono ${sumaPrzed}). Kaskada zdjęła dodatkowo wiersze z tabel bez wskaźnika na organizację.`
    );
    console.log(`[d0] Rollback: --rollback=${sciezkaManifestu}`);
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  }
}

/**
 * Rollback: wstawia wiersze z manifestu z powrotem. Kolejność wstawiania jest
 * odwrotna do kasowania (`organizations` najpierw), a dodatkowo powtarzamy
 * przebiegi dopóki którykolwiek wiersz wchodzi — to znosi zależności między
 * tabelami bez potrzeby sortowania topologicznego.
 */
async function trybRollback(c: PoolClient, manifest: Manifest) {
  // `organizations` musi wejść pierwsze — wszystko inne na nie wskazuje.
  // Reszta idzie w dowolnej kolejności, bo pętla zbieżna i tak powtarza przebiegi,
  // dopóki cokolwiek wchodzi.
  const tabele = ['organizations', ...Object.keys(manifest.wiersze).filter((t) => t !== 'organizations')];
  const zostalo = new Map<string, Record<string, unknown>[]>();
  for (const t of tabele) if (manifest.wiersze[t]?.length) zostalo.set(t, [...manifest.wiersze[t]!]);

  // Kolumny generowane (`GENERATED ALWAYS AS`) wracają z `SELECT *`, ale INSERT
  // ich nie przyjmuje („cannot insert a non-DEFAULT value into column"). Ta jedna
  // kolumna w `assessments` wywracała cały rollback — całą transakcję, nie jeden
  // wiersz. Dlatego przed wstawianiem pytamy bazę, co wolno zapisać.
  const zapisywalne = new Map<string, Set<string>>();
  for (const t of zostalo.keys()) {
    // eslint-disable-next-line no-await-in-loop
    const r = await c.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1 AND is_generated='NEVER'`,
      [t]
    );
    zapisywalne.set(t, new Set(r.rows.map((x) => x.column_name)));
  }

  let wstawione = 0;
  const ostatniBlad = new Map<string, string>();
  await c.query('BEGIN');
  try {
    for (let przebieg = 1; przebieg <= 10; przebieg++) {
      let wTymPrzebiegu = 0;
      for (const [tabela, wiersze] of zostalo) {
        const nieudane: Record<string, unknown>[] = [];
        for (const w of wiersze) {
          const dozwolone = zapisywalne.get(tabela);
          const kolumny = Object.keys(w).filter((k) => !dozwolone || dozwolone.has(k));
          const sql = `INSERT INTO ${qi(tabela)} (${kolumny.map(qi).join(',')}) VALUES (${kolumny
            .map((_, i) => `$${i + 1}`)
            .join(',')}) ON CONFLICT DO NOTHING`;
          try {
            // eslint-disable-next-line no-await-in-loop
            await c.query('SAVEPOINT s');
            // eslint-disable-next-line no-await-in-loop
            const r = await c.query(sql, kolumny.map((k) => w[k]));
            // eslint-disable-next-line no-await-in-loop
            await c.query('RELEASE SAVEPOINT s');
            wstawione += r.rowCount ?? 0;
            wTymPrzebiegu += r.rowCount ?? 0;
          } catch (e) {
            // eslint-disable-next-line no-await-in-loop
            await c.query('ROLLBACK TO SAVEPOINT s');
            ostatniBlad.set(tabela, (e as Error).message);
            nieudane.push(w);
          }
        }
        zostalo.set(tabela, nieudane);
      }
      const pozostalo = [...zostalo.values()].reduce((s, x) => s + x.length, 0);
      console.log(`[d0] rollback przebieg ${przebieg}: wstawiono łącznie ${wstawione}, zostało ${pozostalo}`);
      if (!pozostalo) break;
      if (!wTymPrzebiegu) {
        // Bez treści błędu operator dostałby samą liczbę i nie wiedziałby, czego
        // szukać. Pokazujemy, która tabela i dlaczego odmawia.
        for (const [tabela, wiersze] of zostalo) {
          if (!wiersze.length) continue;
          console.error(`[d0] utknęło ${wiersze.length} w ${tabela}: ${ostatniBlad.get(tabela) ?? '(brak treści błędu)'}`);
        }
        throw new Error(`Rollback utknął: ${pozostalo} wierszy nie da się wstawić. Transakcja wycofana.`);
      }
    }
    await c.query('COMMIT');
    console.log(`[d0] ROLLBACK zakończony: przywrócono ${wstawione} wierszy.`);
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  }
}

async function trybVerify(c: PoolClient, idy: string[]) {
  const istniejace = await nazwyOrganizacji(c, idy);
  const kolumny = await kolumnyOrganizacji(c);
  const perTabela = await policzWierszePerTabela(c, kolumny, idy);
  const suma = perTabela.reduce((s, x) => s + x.wierszy, 0);
  console.log(`[d0] VERIFY: organizacji z listy nadal w bazie: ${istniejace.length} (oczekiwane 0 po --apply).`);
  console.log(`[d0] VERIFY: wierszy należących do listy: ${suma} w ${perTabela.length} tabelach (oczekiwane 0).`);
  perTabela.slice(0, 20).forEach((t) => console.log(`      - ${t.tabela}.${t.kolumna}: ${t.wierszy}`));
  if (istniejace.length || suma) {
    console.log('[d0] VERIFY: NIEZEROWE. To nie jest błąd przed --apply — przed kasowaniem tak ma być.');
  } else {
    console.log('[d0] VERIFY: czysto.');
  }
}

async function main() {
  const opcje = parsujCli(process.argv.slice(2));
  wymagajForcePurge(opcje.tryb);

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Brak jawnego DATABASE_URL. STOP.');
  const cel = sprawdzCel(url, opcje.odcisk);

  let idy: string[] = [];
  let manifest: Manifest | null = null;

  if (opcje.tryb === 'rollback') {
    manifest = wczytajManifest(opcje.plikManifestu);
    idy = manifest.organizacje.map((o) => o.id);
  } else {
    idy = parsujListe(fs.readFileSync(path.resolve(opcje.plikListy), 'utf8'), opcje.plikListy);
    const zachowane = parsujListe(fs.readFileSync(path.resolve(opcje.plikZachowanych), 'utf8'), opcje.plikZachowanych);
    sprawdzKolizjeZZachowanymi(idy, zachowane);
    console.log(`[d0] Bezpiecznik listy zachowanej: OK (${zachowane.length} chronionych, zero kolizji).`);
  }

  console.log(`[d0] Tryb: ${opcje.tryb} · cel: ${cel}`);

  const p = pula();
  const c = await p.connect();
  try {
    if (opcje.tryb === 'dry-run') await trybDryRun(c, idy, cel, opcje);
    else if (opcje.tryb === 'apply') await trybApply(c, idy, cel);
    else if (opcje.tryb === 'rollback') await trybRollback(c, manifest!);
    else await trybVerify(c, idy);
  } finally {
    c.release();
    await p.end();
  }
}

// Uruchamiane tylko jako skrypt; import w teście nie odpala main().
const uruchomionoBezposrednio =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (uruchomionoBezposrednio) {
  main().catch((e) => {
    console.error(`[d0] ${(e as Error).message}`);
    process.exit(1);
  });
}
