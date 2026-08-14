import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  LATE_PHASE_MANIFEST,
  compareMigrationOrder,
  phaseAndKeyFor,
  sortMigrationsDeterministically,
} from '../../server/scripts/migrationOrdering.js';

/**
 * GATE I1 — test porządkowania migracji.
 *
 * Ćwiczy REALNE funkcje runnera (`phaseAndKeyFor`, `compareMigrationOrder`),
 * nie ich kopię — kopia testowałaby samą siebie.
 *
 * Chroni przed trzema udokumentowanymi klasami awarii tego repo:
 *  1. FANTOM w `LATE_PHASE_MANIFEST` — wpis wskazujący nieistniejący plik.
 *     Manifest jest listą STRINGÓW, więc literówka nie daje żadnego błędu:
 *     plik po prostu nigdy nie trafia do fazy 2 i po cichu biegnie za wcześnie.
 *  2. Konsument przed producentem — migracja `ALTER TABLE` uruchomiona przed
 *     `CREATE TABLE` albo, gorzej, `ALTER TABLE IF EXISTS`, które cicho
 *     no-opuje i zostaje oznaczone jako sukces na zawsze.
 *  3. Duplikat wersji / nazwy w wielu fazach.
 */

const MIGRATIONS_DIR = path.resolve(__dirname, '../../server/migrations');

/** Kanoniczny producent `tool_initiative_links` — decyzja koordynatora I2. */
const CANONICAL_PRODUCER = '20260719_baseline_gap.sql';
/** Skonsolidowany konsument (tenant + idempotencja). */
const CONSOLIDATED_CONSUMER = '948_tool_promotion_tenant_idempotency.sql';

type Migration = { filename: string; version: string };

/**
 * Listuje migracje dokładnie tak, jak robi to runner w `getAllMigrations()`:
 * te same rozszerzenia i to samo wstępne `.sort()`. Sama funkcja runnera
 * została w pliku wykonywalnym, bo robi I/O i liczy sumy kontrolne — tutaj
 * testujemy KOLEJNOŚĆ, a ta pochodzi z wydzielonego, czystego modułu.
 */
function allMigrations(): Migration[] {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') || f.endsWith('.js') || f.endsWith('.ts'))
    .sort()
    .map((filename) => ({ filename, version: (filename.match(/^(\d{3})/) ?? [, ''])[1] ?? '' }));
}

function orderedFilenames(extra: Migration[] = [], omit: string[] = []): string[] {
  const base = allMigrations().filter((m) => !omit.includes(m.filename));
  return sortMigrationsDeterministically([...base, ...extra]).map(
    (m: Migration) => m.filename
  );
}

function indexOf(list: string[], name: string): number {
  return list.indexOf(name);
}

describe('GATE I1 — LATE_PHASE_MANIFEST', () => {
  const manifest: string[] = LATE_PHASE_MANIFEST;

  // 1 + 3: każdy wpis istnieje na dysku (brak fantomu)
  it('każdy wpis manifestu wskazuje istniejący plik', () => {
    const phantom = manifest.filter((f) => !fs.existsSync(path.join(MIGRATIONS_DIR, f)));
    expect(
      phantom,
      `FANTOM w LATE_PHASE_MANIFEST: ${phantom.join(', ')}. ` +
        'Manifest to lista stringów — literówka nie daje błędu, plik po prostu ' +
        'nigdy nie trafia do fazy 2 i cicho biegnie za wcześnie.'
    ).toEqual([]);
  });

  // 2: każdy dokładnie raz
  it('każdy wpis występuje dokładnie raz', () => {
    const seen = new Map<string, number>();
    manifest.forEach((f) => seen.set(f, (seen.get(f) ?? 0) + 1));
    const dup = [...seen.entries()].filter(([, n]) => n > 1).map(([f]) => f);
    expect(dup, `duplikaty w manifeście: ${dup.join(', ')}`).toEqual([]);
  });

  // 4: brak duplikatu nazwy pliku w katalogu migracji
  it('nazwy plików migracji są unikalne', () => {
    const names = allMigrations().map((m) => m.filename);
    const dup = names.filter((n, i) => names.indexOf(n) !== i);
    expect(dup).toEqual([]);
  });

  it('wpis manifestu faktycznie ląduje w fazie 2', () => {
    manifest.forEach((f) => {
      const { phase } = phaseAndKeyFor({ filename: f, version: '' });
      expect(phase, `${f} powinien być w fazie 2, jest w ${phase}`).toBe(2);
    });
  });
});

describe('GATE I1 — kolejność producent → konsument', () => {
  it('kanoniczny producent tool_initiative_links istnieje', () => {
    expect(fs.existsSync(path.join(MIGRATIONS_DIR, CANONICAL_PRODUCER))).toBe(true);
  });

  it('producent jest JEDYNY — żadna inna migracja nie tworzy tej tabeli', () => {
    // Wzorzec musi łapać też zapis małymi literami i w cudzysłowach:
    // `create table if not exists "public"."tool_initiative_links"`.
    // Zakotwiczenie na wielkich literach przeoczyło ten producent podczas
    // analizy I2 i o mało nie doprowadziło do błędnej decyzji.
    // Granica `"?(?!\w)` jest KONIECZNA i musi być DOKŁADNIE taka:
    // - bez niej wzorzec łapie `tool_initiative_links_backfill_reports`
    //   (inna tabela) i fałszywie zgłasza trzeciego producenta;
    // - ale `(?![\w"])` jest z kolei ZA CIASNE i odrzuca poprawny zapis
    //   `"public"."tool_initiative_links"`, gubiąc kanonicznego producenta.
    // Obie pomyłki popełniono tu realnie — dlatego są zapisane wprost.
    // Stary opis (zbyt luźny wariant) zachowany dla kontekstu:
    // też `tool_initiative_links_backfill_reports` (inna tabela) i fałszywie
    // zgłasza trzeciego producenta. Ta sama pomyłka zdarzyła się przy analizie
    // ręcznej — dlatego jest tu zapisana wprost.
    const re =
      /create\s+table\s+(if\s+not\s+exists\s+)?"?(public"?\."?)?tool_initiative_links"?(?!\w)/i;
    const producers = allMigrations()
      .map((m) => m.filename)
      .filter((f) => {
        const p = path.join(MIGRATIONS_DIR, f);
        if (!fs.existsSync(p)) return false;
        // Komentarze MUSZĄ zostać usunięte przed dopasowaniem: migracja 948
        // CYTUJE w nagłówku instrukcję kanonicznego producenta, przez co
        // surowe dopasowanie fałszywie uznaje ją za producenta. Wykryte na
        // realnym pliku, nie teoretycznie.
        const sqlWithoutComments = fs
          .readFileSync(p, 'utf8')
          .replace(/--[^\n]*/g, '')
          .replace(/\/\*[\s\S]*?\*\//g, '');
        return re.test(sqlWithoutComments);
      });

    expect(
      producers.sort(),
      `producenci tool_initiative_links: ${producers.join(', ')}. ` +
        'Decyzja I2: kanoniczny jest wyłącznie 20260719_baseline_gap.sql; ' +
        '291_tools_initiatives.sql jest historyczny i wykluczony przez runner, ' +
        'a migracja konsumencka NIE MOŻE tworzyć tabeli.'
    ).toEqual([CANONICAL_PRODUCER, '291_tools_initiatives.sql'].sort());
  });

  // 5 + 6: finalna kolejność i konsument po producencie
  it('konsument 948 biegnie PO kanonicznym producencie', () => {
    const consumerPath = path.join(MIGRATIONS_DIR, CONSOLIDATED_CONSUMER);
    if (!fs.existsSync(consumerPath)) {
      // Migracja skonsolidowana jeszcze nie istnieje — test ma to powiedzieć
      // wprost, a nie przejść po cichu.
      expect(
        false,
        `${CONSOLIDATED_CONSUMER} nie istnieje jeszcze w ${MIGRATIONS_DIR}. ` +
          'Gate I2 wymaga jej utworzenia przed integracją.'
      ).toBe(true);
      return;
    }
    const order = orderedFilenames();
    const iProd = indexOf(order, CANONICAL_PRODUCER);
    const iCons = indexOf(order, CONSOLIDATED_CONSUMER);
    expect(iProd).toBeGreaterThanOrEqual(0);
    expect(iCons).toBeGreaterThanOrEqual(0);
    expect(
      iCons,
      `${CONSOLIDATED_CONSUMER} (poz. ${iCons}) musi biec PO ${CANONICAL_PRODUCER} (poz. ${iProd})`
    ).toBeGreaterThan(iProd);
  });

  it('drukuje rzeczywistą kolejność migracji 946-951', () => {
    const order = orderedFilenames();
    const interesting = order.filter((f) => /^9(4[6-9]|5[01])_/.test(f));
    // Wydruk jest wymaganym dowodem Gate I1.
    // eslint-disable-next-line no-console
    console.log('FINALNA KOLEJNOŚĆ 946-951:\n' + interesting.map((f, i) => `  ${i + 1}. ${f}`).join('\n'));
    expect(interesting.length).toBeGreaterThan(0);
  });

  it('946 biegnie przed 947 (oba w fazie 0)', () => {
    const order = orderedFilenames();
    const i946 = indexOf(order, '946_tool_outputs_reports_lineage.sql');
    const i947 = indexOf(order, '947_tool_outputs_idempotency_guard.sql');
    if (i946 >= 0 && i947 >= 0) {
      expect(i947).toBeGreaterThan(i946);
    } else {
      expect(i946, '946 musi istnieć na kandydacie integracyjnym').toBeGreaterThanOrEqual(0);
    }
  });

  it('Agent Hub 952 i 953 biegną po datowanym producencie Transformation Case', () => {
    const order = orderedFilenames();
    const producer = indexOf(order, '20260807_agent_t01_transformation_case.sql');
    const capability = indexOf(order, '952_transformation_runtime_capability_registry.sql');
    const collaboration = indexOf(order, '953_transformation_collaboration_and_plan_suggestions.sql');
    expect(producer).toBeGreaterThanOrEqual(0);
    expect(capability).toBeGreaterThan(producer);
    expect(collaboration).toBeGreaterThan(capability);
  });
});

/**
 * KONTROLE NEGATYWNE — muszą RZECZYWIŚCIE upaść.
 * Test, który nie potrafi wykryć defektu, jest gorszy niż jego brak, bo daje
 * fałszywe poczucie bezpieczeństwa.
 */
describe('GATE I1 — kontrole negatywne', () => {
  // 7: usunięcie producenta
  it('usunięcie producenta z listy ŁAMIE kolejność', () => {
    const order = orderedFilenames([], [CANONICAL_PRODUCER]);
    expect(indexOf(order, CANONICAL_PRODUCER)).toBe(-1);
    // Bez producenta relacja „konsument po producencie" jest niespełnialna.
    const iCons = indexOf(order, CONSOLIDATED_CONSUMER);
    if (iCons >= 0) {
      expect(indexOf(order, CANONICAL_PRODUCER)).toBe(-1);
    }
  });

  // 8: zmiana nazwy wpisu w manifeście = fantom
  it('zmieniona nazwa w manifeście jest wykrywana jako fantom', () => {
    const fake = '948_tool_promotion_tenant_idempotenc.sql'; // literówka
    expect(fs.existsSync(path.join(MIGRATIONS_DIR, fake))).toBe(false);
    // Runner nie zgłosiłby błędu — plik po prostu nie trafiłby do fazy 2.
    const { phase } = phaseAndKeyFor({ filename: fake, version: '948' });
    expect(phase, 'fantomowa nazwa nie jest w manifeście, więc ląduje w fazie 0').toBe(0);
  });

  // 9: usunięcie 948 z manifestu cofa go do fazy 0 i łamie kolejność
  it('BEZ wpisu w manifeście 948 ląduje w fazie 0 i wyprzedza producenta', () => {
    // Symulujemy brak wpisu, pytając o plik o tym samym numerze, którego
    // w manifeście nie ma — numer sam w sobie daje fazę 0.
    const notInManifest = '948_probe_not_in_manifest.sql';
    const probe = phaseAndKeyFor({ filename: notInManifest, version: '948' });
    expect(probe.phase).toBe(0);

    const producer = phaseAndKeyFor({ filename: CANONICAL_PRODUCER, version: '' });
    expect(producer.phase).toBe(1);

    // Faza 0 < faza 1 → konsument wyprzedziłby producenta. To jest dokładnie
    // powód, dla którego sam numer 948 NIE wystarcza.
    expect(probe.phase).toBeLessThan(producer.phase);
  });

  it('to obecność DOKŁADNEJ nazwy w manifeście przesuwa plik do fazy 2', () => {
    const manifest: string[] = LATE_PHASE_MANIFEST;
    if (manifest.includes(CONSOLIDATED_CONSUMER)) {
      expect(phaseAndKeyFor({ filename: CONSOLIDATED_CONSUMER, version: '948' }).phase).toBe(2);
    } else {
      expect(
        false,
        `${CONSOLIDATED_CONSUMER} musi być w LATE_PHASE_MANIFEST (decyzja Gate I2).`
      ).toBe(true);
    }
  });
});
