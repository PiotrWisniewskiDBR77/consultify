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
 *   #    nieistniejące organizacje (SIEROTY).
 *
 *   # 6) SIEROTY-APPLY — kasuje wiersze-sieroty (osobna operacja, osobna decyzja
 *   #    właściciela, osobny dump). Dwa klucze, jak --apply:
 *   DATABASE_URL=… FORCE_PURGE=true npx tsx scripts/dane/usun-organizacje.ts \
 *       --oczekiwany-host 127.0.0.1 --sieroty-apply
 *   #    Manifest ląduje w evidence/dane-pokazowe-en/sieroty/manifest-<data>.json
 *   #    (albo w katalogu podanym przez --manifest-dir).
 *
 *   # 7) VERIFY sierot — ile ich zostało (oczekiwane 0 po --sieroty-apply):
 *   DATABASE_URL=… npx tsx scripts/dane/usun-organizacje.ts \
 *       --oczekiwany-host 127.0.0.1 --verify --sieroty
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
export const KATALOG_SIEROT = path.join(KATALOG_DOWODOW, 'sieroty');
export const PLIK_LISTY_ZACHOWANEJ_DOMYSLNY = path.join(HERE, 'lista-zachowana.txt');

/** Hosty zdalne, na które wolno celować, i to tylko przy `ALLOW_REMOTE_PURGE=1`. */
export const HOSTY_ZDALNE_DOZWOLONE = ['thomas.proxy.rlwy.net', 'trolley.proxy.rlwy.net'];

/** Hosty lokalne — jedyne dopuszczone bez dodatkowych zmiennych środowiskowych. */
export const HOSTY_LOKALNE = ['127.0.0.1', 'localhost', '::1', '0.0.0.0'];

export type Tryb = 'dry-run' | 'apply' | 'sieroty-apply' | 'rollback' | 'verify';

export type Opcje = {
  tryb: Tryb;
  odcisk: string;
  plikListy: string;
  plikZachowanych: string;
  plikManifestu: string;
  limitTabelWRaporcie: number;
  policzSieroty: boolean;
  /** Katalog, do ktorego trafia manifest. Pusty = domyslny dla trybu. */
  katalogManifestu: string;
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
  if (tryb !== 'apply' && tryb !== 'sieroty-apply') return;
  const flaga = tryb === 'apply' ? '--apply' : '--sieroty-apply';
  if (env.FORCE_PURGE !== 'true')
    throw new Error(
      flaga + ' wymaga FORCE_PURGE=true (dwa klucze). Uruchom ponownie z FORCE_PURGE=true, ' +
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
  let katalogManifestu = '';

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
    else if (a === '--sieroty-apply') tryb = 'sieroty-apply';
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
    else if (a === '--manifest-dir' || a.startsWith('--manifest-dir='))
      katalogManifestu = wartosc(a, '--manifest-dir', idx);
    else if (a === '--tabel-w-raporcie' || a.startsWith('--tabel-w-raporcie='))
      limitTabelWRaporcie = Number(wartosc(a, '--tabel-w-raporcie', idx)) || 25;
    else throw new Error(`Nieznany argument: ${a}`);
  }

  if (!tryb)
    throw new Error(
      'Podaj dokładnie jeden tryb: --dry-run | --apply | --sieroty-apply | --rollback=<manifest.json> | --verify. ' +
        'Domyślnego trybu celowo nie ma.'
    );
  if (!odcisk)
    throw new Error('Brak --oczekiwany-host. Podaj fragment hosta bazy (np. 127.0.0.1). STOP.');
  if (tryb === 'rollback' && !plikManifestu)
    throw new Error('--rollback wymaga ścieżki do manifestu: --rollback=<plik.json>.');
  // Sieroty nie należą do żadnej organizacji, więc lista identyfikatorów ich nie opisuje.
  // `--sieroty-apply` oraz `--verify --sieroty` działają bez listy; każdy inny tryb jej wymaga.
  const listaZbedna =
    tryb === 'rollback' || tryb === 'sieroty-apply' || (tryb === 'verify' && policzSieroty);
  if (!listaZbedna && !plikListy)
    throw new Error('Brak --lista-id <plik.txt>. Skrypt nigdy nie dobiera organizacji sam. STOP.');

  return {
    tryb,
    odcisk,
    plikListy,
    plikZachowanych,
    plikManifestu,
    limitTabelWRaporcie,
    policzSieroty,
    katalogManifestu,
  };
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

/**
 * Liczy SIEROTY per tabela/kolumna: wiersze, których wskaźnik na organizację nie
 * jest NULL, a wskazywanej organizacji w `organizations` już nie ma.
 *
 * `NOT EXISTS` zamiast `NOT IN` — `NOT IN` z NULL-em w podzapytaniu daje pustkę
 * dla wszystkich wierszy i po cichu zaniża wynik do zera.
 */
export async function policzSierotyPerTabela(
  c: PoolClient,
  kolumny: KolumnaOrg[]
): Promise<LiczbaWTabeli[]> {
  const wynik: LiczbaWTabeli[] = [];
  for (const k of kolumny) {
    // eslint-disable-next-line no-await-in-loop
    const r = await c.query<{ n: string }>(
      `SELECT count(*)::bigint AS n FROM ${qi(k.tabela)} t
        WHERE t.${qi(k.kolumna)} IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = t.${qi(k.kolumna)}::text)`
    );
    const n = Number(r.rows[0]?.n ?? 0);
    if (n > 0) wynik.push({ tabela: k.tabela, kolumna: k.kolumna, wierszy: n });
  }
  return wynik.sort((a, b) => b.wierszy - a.wierszy);
}

/**
 * Suma wierszy CAŁEJ bazy (wszystkie tabele bazowe schematu `public`).
 * To jest przyrząd do zmierzenia GRANICY ROLLBACKU: różnica „przed” minus
 * „po apply+rollback” pokazuje wiersze zdjęte kaskadą z tabel, których manifest
 * nie obejmuje, bo nie mają wskaźnika na organizację.
 *
 * `query_to_xml` zamiast `n_live_tup` — statystyki planisty są przybliżone
 * i po masowym DELETE kłamią aż do ANALYZE. Tu potrzebny jest dokładny `count(*)`.
 */
export async function sumaWierszyBazy(c: PoolClient): Promise<number> {
  const r = await c.query<{ n: string | null }>(`
    SELECT sum((xpath('/row/c/text()',
             query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name),
                          false, true, '')))[1]::text::bigint)::bigint AS n
      FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`);
  return Number(r.rows[0]?.n ?? 0);
}

/**
 * Zbiera PEŁNE wiersze-sieroty do manifestu.
 *
 * Deduplikacja jest konieczna: trzy tabele (`demo_sessions`, `demo_session_tenants`,
 * `organization_switch_log`) mają DWIE kolumny wskazujące na organizację, więc ten
 * sam wiersz potrafi być sierotą po obu naraz. Bez klucza wszedłby do manifestu
 * dwa razy i rollback próbowałby go wstawić dwukrotnie.
 */
export async function zbierzSieroty(
  c: PoolClient,
  kolumny: Array<{ tabela: string; kolumna: string }>
): Promise<Record<string, Record<string, unknown>[]>> {
  const out: Record<string, Record<string, unknown>[]> = {};
  const widziane = new Map<string, Set<string>>();
  for (const k of kolumny) {
    // eslint-disable-next-line no-await-in-loop
    const r = await c.query(
      `SELECT * FROM ${qi(k.tabela)} t
        WHERE t.${qi(k.kolumna)} IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = t.${qi(k.kolumna)}::text)`
    );
    if (!r.rows.length) continue;
    const klucze = widziane.get(k.tabela) ?? new Set<string>();
    const lista = out[k.tabela] ?? [];
    for (const w of r.rows as Record<string, unknown>[]) {
      const klucz = JSON.stringify(w);
      if (klucze.has(klucz)) continue;
      klucze.add(klucz);
      lista.push(w);
    }
    widziane.set(k.tabela, klucze);
    out[k.tabela] = lista;
  }
  return out;
}

/**
 * Zadanie kasowania: jedna tabela + pełny warunek WHERE.
 * Kolumny w predykacie są KWALIFIKOWANE nazwą tabeli, żeby zagnieżdżone
 * podzapytania dziecka nie złapały przypadkiem kolumny o tej samej nazwie
 * z innego poziomu.
 */
export type ZadanieKasowania = {
  tabela: string;
  kolumna: string | null;
  predykat: string;
  skad: 'sierota' | 'dziecko';
  rodzic?: string;
  glebokosc: number;
};

export function predykatSieroty(tabela: string, kolumna: string): string {
  const k = `${qi(tabela)}.${qi(kolumna)}`;
  return `${k} IS NOT NULL AND NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = ${k}::text)`;
}

/**
 * Tabele-dzieci, które ZABLOKUJĄ usunięcie wiersza z `tabela`: klucz obcy
 * `NO ACTION` (`a`) albo `RESTRICT` (`r`). `CASCADE` i `SET NULL` nie blokują —
 * te baza obsłuży sama (i właśnie one produkują wiersze POZA manifestem).
 *
 * Klucze wielokolumnowe są pomijane i zgłaszane osobno: sklejanie predykatu dla
 * FK złożonego wymaga `(a,b) IN (SELECT …)`, a zgadywanie tu byłoby kasowaniem
 * na wyczucie.
 */
export async function dzieciBlokujace(
  c: PoolClient,
  tabela: string
): Promise<{ dzieci: Array<{ dziecko: string; kolDziecka: string; kolRodzica: string }>; zlozone: string[] }> {
  const r = await c.query<{ dziecko: string; kol_dziecka: string; kol_rodzica: string; szer: number }>(
    `SELECT src.relname AS dziecko, sa.attname AS kol_dziecka, ta.attname AS kol_rodzica,
            array_length(con.conkey, 1) AS szer
       FROM pg_constraint con
       JOIN pg_class src ON src.oid = con.conrelid
       JOIN pg_class tgt ON tgt.oid = con.confrelid
       JOIN pg_namespace ns ON ns.oid = src.relnamespace AND ns.nspname = 'public'
       JOIN pg_attribute sa ON sa.attrelid = src.oid AND sa.attnum = con.conkey[1]
       JOIN pg_attribute ta ON ta.attrelid = tgt.oid AND ta.attnum = con.confkey[1]
      WHERE con.contype = 'f' AND tgt.relname = $1 AND con.confdeltype IN ('a', 'r')
      ORDER BY 1, 2`,
    [tabela]
  );
  const dzieci: Array<{ dziecko: string; kolDziecka: string; kolRodzica: string }> = [];
  const zlozone: string[] = [];
  for (const x of r.rows) {
    if (Number(x.szer) !== 1) {
      zlozone.push(`${x.dziecko} → ${tabela} (FK wielokolumnowy)`);
      continue;
    }
    dzieci.push({ dziecko: x.dziecko, kolDziecka: x.kol_dziecka, kolRodzica: x.kol_rodzica });
  }
  return { dzieci, zlozone };
}

/**
 * DOMKNIĘCIE PO DZIECIACH.
 *
 * Sierota potrafi mieć własne dzieci przez FK `NO ACTION` w tabeli, która sama
 * żadnego wskaźnika na organizację nie ma (zmierzone na kopii 2026-09-09:
 * `ai_chat_runs` → `ai_chat_run_events`, `teresa_proposals` → `teresa_audit_log`).
 * Bez domknięcia pętla zbieżna nie ma jak ruszyć — dziecka nikt nie kasuje,
 * więc rodzic odmawia w każdym przebiegu i CAŁA transakcja leci do wycofania.
 *
 * Dzieci wchodzą do manifestu na równi z sierotami, więc rollback je przywróci.
 * Wiersze zdejmowane przez `CASCADE` nadal zostają poza manifestem — to jest
 * granica opisana w D0-RAPORT.md §5 i tego domknięcie nie zmienia.
 */
export async function domknijDzieci(
  c: PoolClient,
  bazowe: ZadanieKasowania[],
  maxGlebokosc = 5
): Promise<{ zadania: ZadanieKasowania[]; pominiete: string[] }> {
  const zadania: ZadanieKasowania[] = [...bazowe];
  const widziane = new Set(bazowe.map((z) => `${z.tabela}::${z.predykat}`));
  const pominiete: string[] = [];
  let front = [...bazowe];

  for (let g = 1; g <= maxGlebokosc && front.length; g++) {
    const nastepny: ZadanieKasowania[] = [];
    for (const rodzic of front) {
      // eslint-disable-next-line no-await-in-loop
      const { dzieci, zlozone } = await dzieciBlokujace(c, rodzic.tabela);
      pominiete.push(...zlozone);
      for (const d of dzieci) {
        if (d.dziecko === rodzic.tabela) {
          // Tabela wskazująca sama na siebie: przy `NO ACTION` predykat dziecka
          // byłby tym samym zbiorem co rodzica i pętla by się zapętliła.
          pominiete.push(`${d.dziecko} → ${rodzic.tabela} (FK na samą siebie)`);
          continue;
        }
        const predykat =
          `${qi(d.dziecko)}.${qi(d.kolDziecka)} IN (` +
          `SELECT ${qi(rodzic.tabela)}.${qi(d.kolRodzica)} FROM ${qi(rodzic.tabela)} WHERE ${rodzic.predykat})`;
        const klucz = `${d.dziecko}::${predykat}`;
        if (widziane.has(klucz)) continue;
        widziane.add(klucz);
        const z: ZadanieKasowania = {
          tabela: d.dziecko,
          kolumna: d.kolDziecka,
          predykat,
          skad: 'dziecko',
          rodzic: rodzic.tabela,
          glebokosc: g,
        };
        zadania.push(z);
        nastepny.push(z);
      }
    }
    front = nastepny;
    if (g === maxGlebokosc && front.length)
      pominiete.push(`osiągnięto limit głębokości ${maxGlebokosc}; ${front.length} tabel niezbadanych`);
  }
  return { zadania, pominiete };
}

/** Liczy wiersze objęte zadaniem. Zero = zadanie zbędne, odsiewamy je przed kasowaniem. */
export async function policzZadania(c: PoolClient, zadania: ZadanieKasowania[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const z of zadania) {
    // eslint-disable-next-line no-await-in-loop
    const r = await c.query<{ n: string }>(
      `SELECT count(*)::bigint AS n FROM ${qi(z.tabela)} WHERE ${z.predykat}`
    );
    out.set(`${z.tabela}::${z.predykat}`, Number(r.rows[0]?.n ?? 0));
  }
  return out;
}

/** Snapshot wierszy objętych zadaniami, deduplikowany w obrębie tabeli. */
export async function zbierzZadania(
  c: PoolClient,
  zadania: ZadanieKasowania[]
): Promise<Record<string, Record<string, unknown>[]>> {
  const out: Record<string, Record<string, unknown>[]> = {};
  const widziane = new Map<string, Set<string>>();
  for (const z of zadania) {
    // eslint-disable-next-line no-await-in-loop
    const r = await c.query(`SELECT * FROM ${qi(z.tabela)} WHERE ${z.predykat}`);
    if (!r.rows.length) continue;
    const klucze = widziane.get(z.tabela) ?? new Set<string>();
    const lista = out[z.tabela] ?? [];
    for (const w of r.rows as Record<string, unknown>[]) {
      const klucz = JSON.stringify(w);
      if (klucze.has(klucz)) continue;
      klucze.add(klucz);
      lista.push(w);
    }
    widziane.set(z.tabela, klucze);
    out[z.tabela] = lista;
  }
  return out;
}

// ============================================================================
// 7. Manifest — snapshot „przed” i podstawa rollbacku
// ============================================================================

export type RodzajManifestu = 'organizacje' | 'sieroty';

export type Manifest = {
  wersja: 1;
  skrypt: 'usun-organizacje';
  /**
   * Co ten manifest opisuje. Manifesty sprzed dopisania trybu sierot tego pola
   * nie mają — brak pola czytamy jako 'organizacje', żeby stare manifesty dalej
   * dawały się odtworzyć. Rollback nie zgaduje po zawartości.
   */
  rodzaj?: RodzajManifestu;
  utworzono: string;
  cel: string;
  organizacje: Array<{ id: string; nazwa: string | null }>;
  /** Pełne wiersze, tabela → lista wierszy jako obiekty JSON. */
  wiersze: Record<string, Record<string, unknown>[]>;
  /** Kolejność, w jakiej tabele były kasowane (rollback idzie odwrotnie). */
  kolejnoscKasowania: string[];
  /** Tylko dla rodzaju 'sieroty': rozbicie per tabela/kolumna zmierzone przed kasowaniem. */
  sieroty?: LiczbaWTabeli[];
  /** Tylko dla rodzaju 'sieroty': suma wierszy CAŁEJ bazy przed kasowaniem (granica rollbacku). */
  sumaWierszyBazyPrzed?: number;
};

export function rodzajManifestu(m: Manifest): RodzajManifestu {
  return m.rodzaj ?? 'organizacje';
}

export function zapiszManifest(m: Manifest, katalog?: string): string {
  const sieroty = rodzajManifestu(m) === 'sieroty';
  const dokad = katalog || (sieroty ? KATALOG_SIEROT : KATALOG_DOWODOW);
  fs.mkdirSync(dokad, { recursive: true });
  const nazwa = sieroty ? `manifest-${stempel()}.json` : `usun-organizacje-${stempel()}-manifest.json`;
  const p = path.join(dokad, nazwa);
  fs.writeFileSync(p, JSON.stringify(m, null, 2) + '\n');
  return p;
}

export function wczytajManifest(p: string): Manifest {
  const m = JSON.parse(fs.readFileSync(path.resolve(p), 'utf8')) as Manifest;
  if (m.wersja !== 1 || m.skrypt !== 'usun-organizacje')
    throw new Error('Manifest nie pochodzi z tego skryptu (oczekiwano wersja=1, skrypt="usun-organizacje").');
  const r = m.rodzaj ?? 'organizacje';
  if (r !== 'organizacje' && r !== 'sieroty')
    throw new Error(`Manifest ma nieznany rodzaj „${String(r)}”. Obsługiwane: organizacje, sieroty. STOP.`);
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
    const sieroty = await policzSierotyPerTabela(c, kolumny);
    const sumaSierot = sieroty.reduce((s, x) => s + x.wierszy, 0);
    console.log(`[d0] SIEROTY: ${sumaSierot} wierszy w ${sieroty.length} tabelach — usuwa je tryb --sieroty-apply.`);
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
  const doKasacji: Array<{ tabela: string; kolumna: string; predykat?: string }> = przed.map((t) => ({
    tabela: t.tabela,
    kolumna: t.kolumna,
  }));
  console.log(`[d0] Do wyczyszczenia jawnie: ${doKasacji.length} tabel (z ${blokujace.length} blokującymi w tej liczbie).`);

  // DOMKNIĘCIE PO DZIECIACH (ta sama mechanika co w trybie sierot): tabele bez
  // wskaźnika na organizację, przypięte do kasowanych rodziców kluczem obcym
  // NO ACTION/RESTRICT (zmierzone na stagingu 09.09: ai_chat_runs → ai_chat_run_events,
  // teresa_proposals → teresa_audit_log). Bez tego pętla zbieżna staje, a cała
  // transakcja leci do wycofania. Dzieci wchodzą do manifestu, więc rollback je wraca.
  const litIdy = `ARRAY[${idyIstniejace.map((id) => `'${String(id).replace(/'/g, "''")}'`).join(',')}]::text[]`;
  const bazowe: ZadanieKasowania[] = doKasacji.map((t) => ({
    tabela: t.tabela,
    kolumna: t.kolumna,
    predykat: `${qi(t.tabela)}.${qi(t.kolumna)}::text = ANY(${litIdy})`,
    skad: 'sierota',
    glebokosc: 0,
  }));
  const { zadania: zDomknieciem, pominiete } = await domknijDzieci(c, bazowe);
  const dzieci = zDomknieciem.filter((z) => z.skad === 'dziecko');
  for (const pnt of pominiete) console.log(`[d0] domknięcie pominęło: ${pnt}`);
  if (dzieci.length) {
    const wierszeDzieci = await zbierzZadania(c, dzieci);
    let n = 0;
    for (const [t, rows] of Object.entries(wierszeDzieci)) {
      manifest.wiersze[t] = [...(manifest.wiersze[t] ?? []), ...rows];
      n += rows.length;
    }
    fs.writeFileSync(sciezkaManifestu, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`[d0] Dzieci bez wskaźnika na organizację: ${dzieci.length} zadań, ${n} wierszy dopisanych do manifestu.`);
    for (const z of dzieci) doKasacji.unshift({ tabela: z.tabela, kolumna: z.kolumna ?? '', predykat: z.predykat });
  }

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
          const r = t.predykat
            ? await c.query(`DELETE FROM ${qi(t.tabela)} WHERE ${t.predykat}`)
            : await c.query(
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
 * SIEROTY-APPLY — kasowanie wierszy, których wskaźnik na organizację pokazuje na
 * organizację nieistniejącą w `organizations`.
 *
 * To jest OSOBNA operacja od purge organizacji (D0-RAPORT.md §6 STOP nr 3):
 * te wiersze nie należą do żadnej organizacji z listy, więc `--apply` ich nie
 * dotyka, a kaskada ich nie widzi — nie mają FK (zmierzone: żadna z 45 tabel
 * z sierotami nie ma klucza obcego na `organizations.id`; gdyby miała, sierota
 * nie mogłaby w niej powstać).
 *
 * Zbiór sierot jest STABILNY w trakcie kasowania: przynależność zależy wyłącznie
 * od zawartości `organizations`, której ten tryb nie tyka. Dlatego snapshot
 * zrobiony przed transakcją opisuje dokładnie ten sam zbiór, który potem znika.
 * Pętla zbieżna jest tu potrzebna z innego powodu niż w trybie organizacji: sierota
 * może mieć własne dzieci przez FK `NO ACTION` i pierwszy przebieg na takiej tabeli
 * odmówi, dopóki nie zniknie tabela-dziecko.
 */
async function trybSierotyApply(c: PoolClient, cel: string, opcje: Opcje) {
  const kolumny = await kolumnyOrganizacji(c);
  console.log(`[d0] Topologia odczytana z bazy: ${kolumny.length} kolumn wskazujących na organizację.`);
  console.log('[d0] Liczę sieroty (to trwa — pełny skan tabel z kolumną organizacji)…');

  const przed = await policzSierotyPerTabela(c, kolumny);
  const sumaPrzed = przed.reduce((s, x) => s + x.wierszy, 0);
  if (!sumaPrzed) {
    console.log('[d0] Zero sierot. Nic do zrobienia — baza jest w tym wymiarze czysta.');
    return;
  }
  console.log(`[d0] SIEROTY do usunięcia: ${sumaPrzed} wierszy w ${przed.length} tabelach.`);
  przed.slice(0, opcje.limitTabelWRaporcie).forEach((t, i) => {
    console.log(`      ${String(i + 1).padStart(3)}. ${t.tabela}.${t.kolumna}: ${t.wierszy}`);
  });

  // --- domknięcie po dzieciach ------------------------------------------------
  const bazowe: ZadanieKasowania[] = przed.map((t) => ({
    tabela: t.tabela,
    kolumna: t.kolumna,
    predykat: predykatSieroty(t.tabela, t.kolumna),
    skad: 'sierota' as const,
    glebokosc: 0,
  }));
  const { zadania: wszystkie, pominiete } = await domknijDzieci(c, bazowe);
  const liczby = await policzZadania(c, wszystkie);
  const zadania = wszystkie.filter((z) => (liczby.get(`${z.tabela}::${z.predykat}`) ?? 0) > 0);
  const dzieci = zadania.filter((z) => z.skad === 'dziecko');
  const sumaDzieci = dzieci.reduce((s, z) => s + (liczby.get(`${z.tabela}::${z.predykat}`) ?? 0), 0);

  if (dzieci.length) {
    console.log(
      `\n[d0] DOMKNIĘCIE PO DZIECIACH: ${sumaDzieci} wierszy w ${dzieci.length} tabelach BEZ wskaźnika na ` +
        'organizację, trzymanych przez FK NO ACTION/RESTRICT. Bez nich rodzic nie da się skasować.'
    );
    dzieci.forEach((z, i) =>
      console.log(
        `      ${String(i + 1).padStart(3)}. ${z.tabela}.${z.kolumna} ← ${z.rodzic} (gł. ${z.glebokosc}): ` +
          `${liczby.get(`${z.tabela}::${z.predykat}`) ?? 0}`
      )
    );
    console.log('[d0] Te wiersze WCHODZĄ do manifestu — rollback je przywróci.');
  } else {
    console.log('\n[d0] DOMKNIĘCIE PO DZIECIACH: brak — żadna sierota nie ma dzieci na FK NO ACTION/RESTRICT.');
  }
  if (pominiete.length) {
    console.log('[d0] POMINIĘTE w domknięciu (skrypt nie zgaduje — jeśli zablokują kasowanie, zobaczysz je niżej):');
    pominiete.forEach((p) => console.log(`      - ${p}`));
  }

  const sumaBazyPrzed = await sumaWierszyBazy(c);
  console.log(`[d0] Suma wierszy CAŁEJ bazy PRZED: ${sumaBazyPrzed}.`);

  // Manifest powstaje PRZED transakcją i PRZED pierwszym DELETE. Gdyby powstawał
  // po kasowaniu, awaria w połowie zostawiłaby operację bez ścieżki powrotu.
  const wiersze = await zbierzZadania(c, zadania);
  const wierszyWManifescie = Object.values(wiersze).reduce((s, x) => s + x.length, 0);
  const manifest: Manifest = {
    wersja: 1,
    skrypt: 'usun-organizacje',
    rodzaj: 'sieroty',
    utworzono: new Date().toISOString(),
    cel,
    organizacje: [],
    wiersze,
    kolejnoscKasowania: zadania.map((z) => z.tabela),
    sieroty: przed,
    sumaWierszyBazyPrzed: sumaBazyPrzed,
  };
  const sciezkaManifestu = zapiszManifest(manifest, opcje.katalogManifestu || undefined);
  console.log(`[d0] Manifest „przed” zapisany: ${sciezkaManifestu} (${wierszyWManifescie} wierszy).`);
  const oczekiwane = sumaPrzed + sumaDzieci;
  if (wierszyWManifescie !== oczekiwane)
    console.log(
      `[d0] UWAGA: manifest ma ${wierszyWManifescie} wierszy przy ${oczekiwane} policzonych ` +
        `(${sumaPrzed} sierot + ${sumaDzieci} dzieci) — różnica to wiersze złapane przez dwa zadania naraz ` +
        '(np. sierota po DWÓCH kolumnach), zdeduplikowane.'
    );
  console.log(
    '[d0] GRANICA ROLLBACKU: manifest obejmuje sieroty i ich dzieci trzymane przez FK NO ACTION/RESTRICT. ' +
      'Wiersze zdejmowane przez FK CASCADE z tabel BEZ wskaźnika na organizację do manifestu NIE wchodzą ' +
      'i --rollback ich NIE przywróci — dla nich jedynym zabezpieczeniem jest pg_dump zrobiony przed operacją.'
  );

  const usunietePerZadanie = new Map<string, number>();
  // Bez treści błędu operator dostaje samą liczbę „utknęło na 2 tabelach" i nie
  // wie, gdzie szukać. Ta mapa trzyma ostatni komunikat bazy per zadanie.
  const ostatniBlad = new Map<string, string>();
  const etykieta = (z: ZadanieKasowania) =>
    `${z.tabela}.${z.kolumna ?? '?'}${z.skad === 'dziecko' ? ` (dziecko ${z.rodzic})` : ''}`;

  await c.query('BEGIN');
  try {
    let usuniete = 0;
    let pozostale = [...zadania];
    for (let przebieg = 1; przebieg <= 10 && pozostale.length; przebieg++) {
      const nieudane: typeof pozostale = [];
      let wTymPrzebiegu = 0;
      for (const z of pozostale) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await c.query('SAVEPOINT k');
          // eslint-disable-next-line no-await-in-loop
          const r = await c.query(`DELETE FROM ${qi(z.tabela)} WHERE ${z.predykat}`);
          // eslint-disable-next-line no-await-in-loop
          await c.query('RELEASE SAVEPOINT k');
          const n = r.rowCount ?? 0;
          usuniete += n;
          wTymPrzebiegu += n;
          usunietePerZadanie.set(etykieta(z), (usunietePerZadanie.get(etykieta(z)) ?? 0) + n);
        } catch (e) {
          // eslint-disable-next-line no-await-in-loop
          await c.query('ROLLBACK TO SAVEPOINT k');
          nieudane.push(z);
          ostatniBlad.set(etykieta(z), (e as Error).message);
        }
      }
      pozostale = nieudane;
      console.log(
        `[d0] kasowanie sierot przebieg ${przebieg}: usunięto łącznie ${usuniete}, zadań z problemem ${pozostale.length}`
      );
      if (pozostale.length && !wTymPrzebiegu) {
        for (const z of pozostale)
          console.error(`[d0] utknęło na ${etykieta(z)}: ${ostatniBlad.get(etykieta(z)) ?? '(brak treści błędu)'}`);
        throw new Error(`Kasowanie utknęło na ${pozostale.length} zadaniach. Transakcja wycofana.`);
      }
    }
    if (pozostale.length) {
      for (const z of pozostale)
        console.error(`[d0] nie zbiegło się na ${etykieta(z)}: ${ostatniBlad.get(etykieta(z)) ?? '(brak treści błędu)'}`);
      throw new Error('Kasowanie nie zbiegło się w 10 przebiegach. Transakcja wycofana.');
    }

    await c.query('COMMIT');
    console.log(
      `[d0] SIEROTY-APPLY: usunięto ${usuniete} wierszy jawnie ` +
        `(naliczono przed kasowaniem ${sumaPrzed} sierot + ${sumaDzieci} dzieci = ${oczekiwane}).`
    );
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  }

  console.log('\n[d0] === RAPORT PER TABELA (usunięte) ===');
  [...usunietePerZadanie.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([klucz, n], i) => console.log(`      ${String(i + 1).padStart(3)}. ${klucz}: ${n}`));

  const sumaBazyPo = await sumaWierszyBazy(c);
  const roznica = sumaBazyPrzed - sumaBazyPo;
  console.log(`\n[d0] Suma wierszy CAŁEJ bazy: PRZED ${sumaBazyPrzed} → PO ${sumaBazyPo}. Różnica ${roznica}.`);
  console.log(
    `[d0] Z tego objęte manifestem (odwracalne przez --rollback): ${wierszyWManifescie}. ` +
      `Zdjęte kaskadą POZA manifestem: ${roznica - wierszyWManifescie}.`
  );
  console.log(`[d0] Rollback: --rollback=${sciezkaManifestu}`);
}

/**
 * Rollback: wstawia wiersze z manifestu z powrotem.
 *
 * PACZKI, NIE POJEDYNCZE WIERSZE. Pierwsza wersja robiła `SAVEPOINT` przed
 * KAŻDYM wierszem. Przy manifeście organizacji (345 wierszy) to działało;
 * przy manifeście sierot (38 862 wiersze) baza przewróciła się na
 * „out of shared memory" — każda podtransakcja trzyma swoje blokady do końca
 * transakcji, a 38 tysięcy podtransakcji nie mieści się w tablicy blokad.
 * Zmierzone 2026-09-09 na kopii: rollback przerwany, transakcja wycofana,
 * ZERO wierszy przywróconych. Rollback, który nie działa dokładnie wtedy,
 * gdy jest potrzebny, jest gorszy niż jego brak.
 *
 * Teraz jeden `SAVEPOINT` przypada na PACZKĘ wierszy, a paczka maleje z każdym
 * przebiegiem (500 → 100 → 20 → 5 → 1). Dzięki temu:
 *   - liczba podtransakcji spada o dwa rzędy wielkości,
 *   - jeden zepsuty wiersz nie blokuje na stałe 499 dobrych: w kolejnym
 *     przebiegu paczka jest mniejsza, aż do izolacji pojedynczego wiersza.
 *
 * Kolejność: `organizations` najpierw (wszystko inne na nie wskazuje), reszta
 * dowolnie — pętla zbieżna powtarza przebiegi, dopóki cokolwiek wchodzi, więc
 * dziecko wejdzie w przebiegu po rodzicu bez sortowania topologicznego.
 *
 * Postęp mierzymy SPADKIEM liczby wierszy do wstawienia, a nie sumą `rowCount`:
 * `ON CONFLICT DO NOTHING` zwraca 0 dla wiersza, który już w bazie jest, więc
 * licznik wstawień potrafi stać w miejscu przy realnym postępie.
 */
async function trybRollback(c: PoolClient, manifest: Manifest) {
  const rodzaj = rodzajManifestu(manifest);
  const doWstawienia = Object.values(manifest.wiersze).reduce((s, x) => s + x.length, 0);
  console.log(`[d0] ROLLBACK z manifestu rodzaju „${rodzaj}”: ${doWstawienia} wierszy do przywrócenia.`);

  const tabele = ['organizations', ...Object.keys(manifest.wiersze).filter((t) => t !== 'organizations')];
  const zostalo = new Map<string, Record<string, unknown>[]>();
  for (const t of tabele) if (manifest.wiersze[t]?.length) zostalo.set(t, [...manifest.wiersze[t]!]);

  // Kolumny generowane (`GENERATED ALWAYS AS`) wracają z `SELECT *`, ale INSERT
  // ich nie przyjmuje („cannot insert a non-DEFAULT value into column"). Ta jedna
  // kolumna w `assessments` wywracała cały rollback — całą transakcję, nie jeden
  // wiersz. Dlatego przed wstawianiem pytamy bazę, co wolno zapisać.
  //
  // Drugi powód, dla którego pytamy bazę o kolumny: TYP `json`/`jsonb`.
  // Sterownik `pg` zwraca taką kolumnę już ROZPARSOWANĄ (obiekt albo tablica JS).
  // Przy wstawianiu z powrotem tablica JS jest przez sterownik zamieniana na
  // literał tablicy Postgresa (`{…}`), a nie na JSON — baza odpowiada
  // „invalid input syntax for type json" i wywraca całą transakcję rollbacku.
  // Zmierzone 2026-09-09 na kopii: 53 wiersze w `document_studio_templates`
  // i `ie_initiative_card_versions` (kolumny `audience`, `required_inputs`,
  // `section_blueprint` — wszystkie trzymają tablice). Dlatego wartości kolumn
  // json/jsonb serializujemy ręcznie przez JSON.stringify.
  //
  const zapisywalne = new Map<string, Set<string>>();
  const kolumnyJson = new Map<string, Set<string>>();
  for (const t of zostalo.keys()) {
    // eslint-disable-next-line no-await-in-loop
    const r = await c.query<{ column_name: string; udt_name: string; is_generated: string }>(
      `SELECT column_name, udt_name, is_generated FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1`,
      [t]
    );
    zapisywalne.set(t, new Set(r.rows.filter((x) => x.is_generated === 'NEVER').map((x) => x.column_name)));
    kolumnyJson.set(
      t,
      new Set(r.rows.filter((x) => x.udt_name === 'json' || x.udt_name === 'jsonb').map((x) => x.column_name))
    );
  }

  /** Wartość gotowa do wstawienia: json/jsonb zawsze jako tekst JSON, reszta bez zmian. */
  const naParametr = (tabela: string, kolumna: string, v: unknown): unknown => {
    if (v === null || v === undefined) return null;
    return kolumnyJson.get(tabela)?.has(kolumna) ? JSON.stringify(v) : v;
  };

  /** Rozmiar paczki w kolejnych przebiegach. Maleje aż do izolacji wiersza. */
  const PACZKI = [500, 100, 20, 5, 1, 1, 1, 1, 1, 1];
  /** Twardy limit parametrów w jednym zapytaniu Postgresa to 65535. */
  const LIMIT_PARAMETROW = 60000;

  let wstawione = 0;
  const ostatniBlad = new Map<string, string>();
  let poprzednioZostalo = doWstawienia;

  await c.query('BEGIN');
  try {
    for (let przebieg = 1; przebieg <= PACZKI.length; przebieg++) {
      const bazowaPaczka = PACZKI[przebieg - 1]!;
      for (const [tabela, wiersze] of zostalo) {
        if (!wiersze.length) continue;
        const dozwolone = zapisywalne.get(tabela);
        const nieudane: Record<string, unknown>[] = [];

        // Grupowanie po ZESTAWIE kolumn: wiersze jednej tabeli zwykle mają ten
        // sam zestaw, ale manifest to JSON — nie ma gwarancji, a INSERT
        // wielowierszowy wymaga jednej listy kolumn dla całej paczki.
        const grupy = new Map<string, Record<string, unknown>[]>();
        for (const w of wiersze) {
          const kol = Object.keys(w).filter((k) => !dozwolone || dozwolone.has(k));
          const klucz = JSON.stringify(kol);
          const lista = grupy.get(klucz);
          if (lista) lista.push(w);
          else grupy.set(klucz, [w]);
        }

        for (const [kluczKolumn, lista] of grupy) {
          const kolumny = JSON.parse(kluczKolumn) as string[];
          if (!kolumny.length) {
            nieudane.push(...lista);
            ostatniBlad.set(tabela, 'wiersz nie ma ani jednej kolumny zapisywalnej');
            continue;
          }
          const limit = Math.max(1, Math.min(bazowaPaczka, Math.floor(LIMIT_PARAMETROW / kolumny.length)));
          for (let i = 0; i < lista.length; i += limit) {
            const paczka = lista.slice(i, i + limit);
            const wartosci: unknown[] = [];
            const krotki = paczka.map((_, j) => {
              const baza = j * kolumny.length;
              return `(${kolumny.map((__, k) => `$${baza + k + 1}`).join(',')})`;
            });
            for (const w of paczka) for (const k of kolumny) wartosci.push(naParametr(tabela, k, w[k]));
            const sql =
              `INSERT INTO ${qi(tabela)} (${kolumny.map(qi).join(',')}) ` +
              `VALUES ${krotki.join(',')} ON CONFLICT DO NOTHING`;
            try {
              // eslint-disable-next-line no-await-in-loop
              await c.query('SAVEPOINT s');
              // eslint-disable-next-line no-await-in-loop
              const r = await c.query(sql, wartosci);
              // eslint-disable-next-line no-await-in-loop
              await c.query('RELEASE SAVEPOINT s');
              wstawione += r.rowCount ?? 0;
            } catch (e) {
              // eslint-disable-next-line no-await-in-loop
              await c.query('ROLLBACK TO SAVEPOINT s');
              ostatniBlad.set(tabela, (e as Error).message);
              nieudane.push(...paczka);
            }
          }
        }
        zostalo.set(tabela, nieudane);
      }

      const pozostalo = [...zostalo.values()].reduce((s, x) => s + x.length, 0);
      console.log(
        `[d0] rollback przebieg ${przebieg} (paczka ${bazowaPaczka}): wstawiono łącznie ${wstawione}, zostało ${pozostalo}`
      );
      if (!pozostalo) break;
      const postep = pozostalo < poprzednioZostalo;
      poprzednioZostalo = pozostalo;
      if (!postep && bazowaPaczka === 1) {
        // Bez treści błędu operator dostałby samą liczbę i nie wiedziałby, czego
        // szukać. Pokazujemy, która tabela i dlaczego odmawia.
        for (const [tabela, w] of zostalo) {
          if (!w.length) continue;
          console.error(`[d0] utknęło ${w.length} w ${tabela}: ${ostatniBlad.get(tabela) ?? '(brak treści błędu)'}`);
        }
        throw new Error(`Rollback utknął: ${pozostalo} wierszy nie da się wstawić. Transakcja wycofana.`);
      }
    }

    const nadal = [...zostalo.values()].reduce((s, x) => s + x.length, 0);
    if (nadal) {
      for (const [tabela, w] of zostalo) {
        if (!w.length) continue;
        console.error(`[d0] nie weszło ${w.length} w ${tabela}: ${ostatniBlad.get(tabela) ?? '(brak treści błędu)'}`);
      }
      throw new Error(`Rollback nie zbiegł się: ${nadal} wierszy nie da się wstawić. Transakcja wycofana.`);
    }

    await c.query('COMMIT');
    console.log(`[d0] ROLLBACK zakończony: przywrócono ${wstawione} wierszy.`);
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  }
}

async function trybVerify(c: PoolClient, idy: string[], opcje: Opcje) {
  const kolumny = await kolumnyOrganizacji(c);

  if (opcje.policzSieroty) {
    console.log('[d0] Liczę sieroty (to trwa — pełny skan tabel z kolumną organizacji)…');
    const sieroty = await policzSierotyPerTabela(c, kolumny);
    const sumaSierot = sieroty.reduce((s, x) => s + x.wierszy, 0);
    console.log(
      `[d0] VERIFY --sieroty: ${sumaSierot} wierszy-sierot w ${sieroty.length} tabelach (oczekiwane 0 po --sieroty-apply).`
    );
    sieroty.slice(0, 20).forEach((t) => console.log(`      - ${t.tabela}.${t.kolumna}: ${t.wierszy}`));
    console.log(sumaSierot ? '[d0] VERIFY sierot: NIEZEROWE.' : '[d0] VERIFY sierot: czysto (0).');
    // Bez listy identyfikatorów nie ma czego weryfikować po stronie organizacji.
    if (!idy.length) return;
  }

  const istniejace = await nazwyOrganizacji(c, idy);
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
    console.log(`[d0] Manifest rodzaju: ${rodzajManifestu(manifest)}.`);
  } else if (opcje.plikListy) {
    idy = parsujListe(fs.readFileSync(path.resolve(opcje.plikListy), 'utf8'), opcje.plikListy);
    const zachowane = parsujListe(fs.readFileSync(path.resolve(opcje.plikZachowanych), 'utf8'), opcje.plikZachowanych);
    sprawdzKolizjeZZachowanymi(idy, zachowane);
    console.log(`[d0] Bezpiecznik listy zachowanej: OK (${zachowane.length} chronionych, zero kolizji).`);
  } else {
    // Sieroty nie należą do żadnej organizacji — lista zachowana ich nie chroni
    // i chronić nie może, bo nie ma czego z czym porównać. To nie luka: wiersz
    // wskazujący na organizację, której nie ma, nie jest cudzą własnością.
    console.log('[d0] Tryb bez listy identyfikatorów (sieroty nie należą do żadnej organizacji).');
  }

  console.log(`[d0] Tryb: ${opcje.tryb} · cel: ${cel}`);

  const p = pula();
  const c = await p.connect();
  try {
    if (opcje.tryb === 'dry-run') await trybDryRun(c, idy, cel, opcje);
    else if (opcje.tryb === 'apply') await trybApply(c, idy, cel);
    else if (opcje.tryb === 'sieroty-apply') await trybSierotyApply(c, cel, opcje);
    else if (opcje.tryb === 'rollback') await trybRollback(c, manifest!);
    else await trybVerify(c, idy, opcje);
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
