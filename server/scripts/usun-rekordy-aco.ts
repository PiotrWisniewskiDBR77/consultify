#!/usr/bin/env tsx
/**
 * Usuwa z danych organizacji rekordy pozostawione przez RĘCZNY przebieg
 * akceptacyjny „ACO” (1.12-R1, decyzja właściciela na pytanie C5.5 planu
 * `docs/program/PROGRAM_NAPRAWCZY_20260905/1_12_REALIZACJA_PLAN.md`).
 *
 * DLACZEGO ISTNIEJE (pomiar, nie domysł — plan B5):
 * Właściciel zobaczył na swoim ekranie „Sterowanie” trzy ciągi po angielsku,
 * z datami z PRZYSZŁOŚCI (grudzień 2026):
 *   · „ACO execution control · 16/17 gru 2026”,
 *   · „Apply independently approved Plan resequence”,
 *   · „Intervention Authority”.
 * Wszystkie trzy prowadzą do jednego źródła —
 * `tests/e2e/initiatives-execution/aco-definition-browser.spec.ts`
 * (`:1367`, `:1385`, `:1398`, `:1534` `verifyBy = 2026-12-15`, `:1619`
 * `asOf = 2026-12-16`, `:1721` `asOf = 2026-12-17`). Sam plik testu ma
 * bezpiecznik (`:22-26` — odmawia pracy na bazie innej niż `consultify_b1_`),
 * więc TEST tego nie zapisał; zapisał to ręczny przebieg ACO wykonany na
 * żywym środowisku. Efekt: rekordy testowe w danych, które są twarzą produktu.
 *
 * CO ROBI: znajduje w `ie_aggregate_state` (kanoniczny magazyn runtime-v1:
 * `intervention_case`, `management_signal`, `execution_case`, `report_run`,
 * `report_definition`) wiersze, których `payload_json` niesie sygnaturę ACO,
 * i — po jawnym `--apply` — usuwa je RAZEM z ich śladem sterującym
 * (`ie_aggregate_relations`, `ie_command_receipts`, `ie_audit_events`,
 * `ie_outbox_events`), zapisując wcześniej pełną kopię CSV i manifest
 * cofnięcia. Wzorzec 1:1 z `server/scripts/higiena-wlasciciela/*`
 * (`wspolne.ts`: dry-run/apply/rollback, manifest w `evidence/higiena-danych/`).
 *
 * CZEGO NIE ROBI: nie dotyka `initiatives`, `tasks`, `decisions` ani
 * `raid_items` — ACO nie pisał do tabel zastanych, a kasowanie tam byłoby
 * zgadywaniem. Nie usuwa niczego bez trafienia w sygnaturę.
 *
 * UŻYCIE (z korzenia repo; nadzorca uruchamia na stagingu, nie robotnik):
 *   DATABASE_URL="…" npx tsx server/scripts/usun-rekordy-aco.ts --org=<uuid> --dry-run
 *   DATABASE_URL="…" npx tsx server/scripts/usun-rekordy-aco.ts --org=<uuid> --apply
 *   DATABASE_URL="…" npx tsx server/scripts/usun-rekordy-aco.ts --org=<uuid> \
 *     --rollback=evidence/higiena-danych/usun-rekordy-aco-…-manifest.json
 *
 * Drugi `--apply` MUSI wypisać `USUNIĘTE: 0` — to jest dowód, że przebieg był
 * zupełny, a nie że skrypt „coś zrobił”.
 */
import '../src/config/loadEnv.js';

import type { PoolClient } from 'pg';

import {
  qi,
  runMain,
  writeBackupCsv,
  writeManifest,
  readManifest,
  restore,
  type Manifest,
  type ManifestEntry,
} from './higiena-wlasciciela/wspolne.js';

const SKRYPT = 'usun-rekordy-aco';

/**
 * SYGNATURY z planu B5 — każda wskazuje na konkretną linię pliku e2e, żeby
 * dało się sprawdzić, skąd wzięła się reguła, zamiast jej bronić.
 * Dopasowanie idzie po CAŁYM `payload_json` sprowadzonym do tekstu: ciągi ACO
 * siedzą w różnych polach (`title`, `label`, `name`, `hypotheses[]`,
 * `options[].label`), a jeden sztywny klucz przepuściłby połowę.
 */
export const SYGNATURY_TEKSTOWE: Array<{ wzorzec: string; skad: string }> = [
  { wzorzec: 'ACO execution control', skad: 'aco-definition-browser.spec.ts:1619,1649,1721,1733' },
  {
    wzorzec: 'Apply independently approved',
    skad: 'aco-definition-browser.spec.ts:1367,1385,1398',
  },
  { wzorzec: 'Intervention Authority', skad: 'aco-definition-browser.spec.ts:1534 (etykieta roli)' },
];

/**
 * Data z przyszłości JEST częścią sygnatury, ale SAMA NIE WYSTARCZA — plan
 * mówi o grudniu 2026 (`verifyBy 2026-12-15`, `asOf 2026-12-16/17`), a legalny
 * plan realizacji też może sięgać grudnia. Dlatego data liczy się wyłącznie
 * jako POTWIERDZENIE trafienia tekstowego, nigdy jako samodzielny powód.
 */
export const OKNO_DAT = /2026-12-1[567]/;

/** Typy agregatów runtime-v1, do których pisał przebieg ACO. */
const TYPY_AGREGATOW = [
  'intervention_case',
  'management_signal',
  'execution_case',
  'report_run',
  'report_definition',
  'material_change',
];

/** Tabele ze śladem sterującym — kasowane po agregacie, w tej kolejności. */
const TABELE_SLADU = [
  'ie_outbox_events',
  'ie_audit_events',
  'ie_command_receipts',
  'ie_aggregate_relations',
];

export interface DopasowanieAco {
  trafienia: string[];
  dataZPrzyszlosci: boolean;
}

/**
 * Czy `payload_json` agregatu nosi sygnaturę przebiegu ACO.
 * Wydzielone i wyeksportowane, bo LOKALNA baza stanowiska ma 0 takich
 * rekordów (pomiar 06.09: `ie_aggregate_state` = 42 wiersze, ani jednego
 * `intervention_case`/`management_signal`) — reguła musi więc dać się
 * sprawdzić testem, a nie „przebiegiem, który nic nie znalazł".
 */
export function dopasujAco(payload: unknown): DopasowanieAco {
  const tekst = tekstPayloadu(payload);
  return {
    trafienia: SYGNATURY_TEKSTOWE.filter((s) =>
      tekst.toLowerCase().includes(s.wzorzec.toLowerCase())
    ).map((s) => `${s.wzorzec} (${s.skad})`),
    dataZPrzyszlosci: OKNO_DAT.test(tekst),
  };
}

interface Kandydat {
  aggregateType: string;
  aggregateId: string;
  version: number;
  tytul: string;
  trafienia: string[];
  dataZPrzyszlosci: boolean;
  wiersz: Record<string, unknown>;
}

const tekstPayloadu = (payload: unknown): string => {
  try {
    return JSON.stringify(payload ?? {});
  } catch {
    return '';
  }
};

/** Tytuł do listy PLAN — pierwsze pole, które człowiek rozpozna. */
const tytulZPayloadu = (payload: any, fallback: string): string => {
  const kandydaci = [
    payload?.title,
    payload?.name,
    payload?.label,
    payload?.detail?.title,
    Array.isArray(payload?.hypotheses) ? payload.hypotheses[0] : null,
    Array.isArray(payload?.options) ? payload.options[0]?.label : null,
  ];
  const znaleziony = kandydaci.find((x) => typeof x === 'string' && x.trim());
  return String(znaleziony ?? fallback);
};

async function tabelaIstnieje(c: PoolClient, tabela: string): Promise<boolean> {
  const r = await c.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
    [tabela]
  );
  return (r.rowCount ?? 0) > 0;
}

async function znajdzKandydatow(c: PoolClient, organizationId: string): Promise<Kandydat[]> {
  const { rows } = await c.query<{
    organization_id: string;
    aggregate_type: string;
    aggregate_id: string;
    version: number;
    payload_json: any;
    updated_at: string;
  }>(
    `SELECT organization_id, aggregate_type, aggregate_id, version, payload_json, updated_at
       FROM ie_aggregate_state
      WHERE organization_id = $1 AND aggregate_type = ANY($2::text[])
      ORDER BY aggregate_type, aggregate_id`,
    [organizationId, TYPY_AGREGATOW]
  );

  const kandydaci: Kandydat[] = [];
  for (const row of rows) {
    const { trafienia, dataZPrzyszlosci } = dopasujAco(row.payload_json);
    if (trafienia.length === 0) continue;
    kandydaci.push({
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      version: row.version,
      tytul: tytulZPayloadu(row.payload_json, row.aggregate_id),
      trafienia,
      dataZPrzyszlosci,
      wiersz: row as unknown as Record<string, unknown>,
    });
  }
  return kandydaci;
}

async function usunSlad(
  c: PoolClient,
  organizationId: string,
  kandydat: Kandydat,
  wpisy: ManifestEntry[]
): Promise<number> {
  let usuniete = 0;
  for (const tabela of TABELE_SLADU) {
    if (!(await tabelaIstnieje(c, tabela))) continue;
    // Nie każda z tych tabel ma tę samą parę kolumn — pytamy schemat, zamiast
    // zakładać. Brak kolumny = tabela nie opisuje tego agregatu, pomijamy.
    const kolumny = (
      await c.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema='public' AND table_name=$1`,
        [tabela]
      )
    ).rows.map((r) => r.column_name);
    if (!kolumny.includes('aggregate_id') || !kolumny.includes('organization_id')) continue;

    const warunekTypu = kolumny.includes('aggregate_type') ? ' AND aggregate_type = $3' : '';
    const parametry = kolumny.includes('aggregate_type')
      ? [organizationId, kandydat.aggregateId, kandydat.aggregateType]
      : [organizationId, kandydat.aggregateId];

    const { rows } = await c.query<Record<string, unknown>>(
      `SELECT * FROM ${qi(tabela)} WHERE organization_id = $1 AND aggregate_id = $2${warunekTypu}`,
      parametry
    );
    if (rows.length === 0) continue;

    const backupCsv = writeBackupCsv(tabela, rows);
    const kolumnaId = kolumny.includes('id') ? 'id' : 'aggregate_id';
    for (const wiersz of rows) {
      wpisy.push({
        table: tabela,
        idColumn: kolumnaId,
        id: String(wiersz[kolumnaId] ?? kandydat.aggregateId),
        action: 'delete',
        before: wiersz,
        backupCsv,
      });
    }
    const wynik = await c.query(
      `DELETE FROM ${qi(tabela)} WHERE organization_id = $1 AND aggregate_id = $2${warunekTypu}`,
      parametry
    );
    usuniete += wynik.rowCount ?? 0;
  }
  return usuniete;
}

async function main(c: PoolClient, org: { id: string; name: string }, mode: { kind: string; manifest?: string }) {
  if (mode.kind === 'rollback') {
    const manifest = readManifest(mode.manifest!, SKRYPT);
    const przywrocone = await restore(c, manifest);
    console.log(`COFNIĘTE: ${przywrocone} (manifest: ${mode.manifest})`);
    return;
  }

  const kandydaci = await znajdzKandydatow(c, org.id);

  console.log('');
  console.log(`Sygnatury ACO w ${org.name} (${org.id}): ${kandydaci.length}`);
  for (const k of kandydaci) {
    console.log(
      `  · [${k.aggregateType}] ${k.tytul}\n` +
        `      id: ${k.aggregateId} · wersja ${k.version}` +
        (k.dataZPrzyszlosci ? ' · DATA XII 2026' : '') +
        `\n      trafienia: ${k.trafienia.join(' | ')}`
    );
  }

  if (kandydaci.length === 0) {
    console.log('Nic do usunięcia — zero trafień w sygnatury ACO.');
    console.log('USUNIĘTE: 0');
    return;
  }

  if (mode.kind === 'dry-run') {
    console.log('');
    console.log('DRY-RUN: nic nie zostało zmienione. Uruchom ponownie z --apply po akcepcie.');
    console.log(`DO USUNIĘCIA: ${kandydaci.length}`);
    return;
  }

  // --apply: kopia CSV + manifest PRZED pierwszym DELETE, wszystko w jednej
  // transakcji — połowicznie usunięty agregat byłby gorszy niż rekord testowy.
  const wpisy: ManifestEntry[] = [];
  let usunieteAgregaty = 0;
  let usunietySlad = 0;

  await c.query('BEGIN');
  try {
    const backupCsv = writeBackupCsv(
      'ie_aggregate_state',
      kandydaci.map((k) => k.wiersz)
    );
    for (const k of kandydaci) {
      usunietySlad += await usunSlad(c, org.id, k, wpisy);
      wpisy.push({
        table: 'ie_aggregate_state',
        idColumn: 'aggregate_id',
        id: k.aggregateId,
        action: 'delete',
        before: k.wiersz,
        backupCsv,
      });
      const wynik = await c.query(
        `DELETE FROM ie_aggregate_state
          WHERE organization_id = $1 AND aggregate_type = $2 AND aggregate_id = $3`,
        [org.id, k.aggregateType, k.aggregateId]
      );
      usunieteAgregaty += wynik.rowCount ?? 0;
    }
    await c.query('COMMIT');
  } catch (błąd) {
    await c.query('ROLLBACK');
    throw błąd;
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

  console.log('');
  console.log(`USUNIĘTE: ${usunieteAgregaty} (ślad sterujący: ${usunietySlad})`);
  console.log(`Manifest cofnięcia: ${sciezka}`);
  console.log('Uruchom ten sam --apply drugi raz — musi wypisać USUNIĘTE: 0.');
}

/**
 * Uruchamiamy CLI TYLKO gdy plik jest wywołany wprost. Bez tej bramki sam
 * `import` z testu odpalałby `parseCli()` i wywracał się na braku `--org=`.
 */
const uruchomionyWprost =
  typeof process.argv[1] === 'string' && process.argv[1].includes('usun-rekordy-aco');
if (uruchomionyWprost) {
  runMain(SKRYPT, main).catch((błąd) => {
    console.error(String(błąd instanceof Error ? błąd.message : błąd));
    process.exit(1);
  });
}
