#!/usr/bin/env tsx
/**
 * PORZĄDKOWANIE TERMINÓW INICJATYW (07.09) — słowa właściciela:
 * „A możesz poprawić terminy, żeby nie było takich głupot? Po prostu zaktualizuj
 *  terminy na obecne. I naprawdę."
 *
 * CO ROBI (i tylko to — zakres jest wąski celowo):
 *   1. dopisuje/porządkuje `planned_start_date` i `planned_end_date` inicjatywy
 *      tam, gdzie są BEZ SENSU wobec statusu i dzisiejszej daty,
 *   2. w tej samej transakcji ustawia PLAN BAZOWY na plan bieżący
 *      (`baseline_start_date`/`baseline_end_date` = `planned_*::text`,
 *      `baseline_set_at`, `schedule_shift_count = 0`), żeby kolumna
 *      „Odchylenie (dni)" pokazywała 0, a nie poślizg wyprodukowany przez
 *      samo sprzątanie danych.
 *
 * CZEGO NIE RUSZA: kamieni milowych, statusów, właścicieli, nazw, budżetów,
 * `start_date`/`end_date`, `forecast_*`, `actual_*`, `initiative_rebaseline_log`.
 *
 * ZASADY (podyktowane przez właściciela, nie wymyślone tutaj):
 *   · w realizacji  → start w przeszłości, koniec w rozsądnej przyszłości,
 *   · zatwierdzona / do zatwierdzenia → start w przyszłości albo tuż przed,
 *   · zamknięta     → koniec w przeszłości,
 *   · koniec NIGDY wcześniej niż start,
 *   · terminy rozłożone jak realny plan firmy doradczej (nie jedna data dla
 *     wszystkich) — rozrzut jest DETERMINISTYCZNY (skrót z `id`), więc drugi
 *     przebieg daje ten sam wynik i zero zmian,
 *   · daty sensowne zostają nietknięte.
 *   DRAFT i ODRZUCONA nie mają reguły od właściciela — skrypt ich NIE dotyka
 *   (poza jedyną regułą wspólną: koniec nie może być przed startem).
 *
 * UŻYCIE (z korzenia repo):
 *   DATABASE_URL="…" npx tsx server/scripts/napraw-terminy-inicjatyw.ts --org=<uuid> --etykieta=stanowisko
 *   DATABASE_URL="…" npx tsx server/scripts/napraw-terminy-inicjatyw.ts --org=<uuid> --etykieta=stanowisko --apply
 *
 * `--org` jest OBOWIĄZKOWE i nie ma wartości domyślnej; `resolveOrg` odmawia
 * pracy, gdy organizacja nie istnieje w bazie, do której skrypt się połączył
 * (uuid organizacji RÓŻNI SIĘ między stanowiskiem a stagingiem).
 * Domyślny tryb to DRY-RUN; zapis wymaga jawnego `--apply`.
 * Przed KAŻDYM zapisem powstaje kopia CSV w `evidence/terminy-realne/`.
 */
import '../src/config/loadEnv.js';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';

import { pool, resolveOrg, csvCell, iso, REPO_ROOT } from './higiena-wlasciciela/wspolne.js';

const SKRYPT = 'napraw-terminy-inicjatyw';
const KATALOG_DOWODU = path.join(REPO_ROOT, 'evidence', 'terminy-realne');
const DZIEN = 24 * 60 * 60 * 1000;

/* ──────────────────────────── CLI ──────────────────────────── */

interface Cli {
  org: string;
  apply: boolean;
  etykieta: string;
}

export function parseCliTerminy(argv = process.argv.slice(2)): Cli {
  const org = argv.find((x) => x.startsWith('--org='))?.slice('--org='.length);
  if (!org) {
    throw new Error(
      'Użycie: --org=<uuid|nazwa> [--etykieta=<nazwa-bazy>] [--apply]. ' +
        '--org nie ma wartości domyślnej (uuid różni się między bazami).'
    );
  }
  const etykieta = argv.find((x) => x.startsWith('--etykieta='))?.slice('--etykieta='.length) ?? 'baza';
  if (!/^[a-z0-9-]+$/i.test(etykieta)) throw new Error('--etykieta: dozwolone [a-z0-9-]');
  return { org, apply: argv.includes('--apply'), etykieta };
}

/* ─────────────────── model dat: reguły i propozycja ─────────────────── */

export type Status =
  | 'IN_EXECUTION'
  | 'APPROVED'
  | 'PENDING_APPROVAL'
  | 'CLOSED'
  | 'DRAFT'
  | 'REJECTED'
  | string;

/** Deterministyczny, ale nieregularny rozrzut — ten sam `id` zawsze ten sam plan. */
function skrot(id: string, sol: string): number {
  const h = createHash('sha1').update(`${id}::${sol}`).digest();
  return h.readUInt32BE(0);
}

const dzien = (t: number) => new Date(t);
const dodaj = (t: number, dni: number) => t + dni * DZIEN;

/** Data pisana do bazy: 09:00 UTC — nie przeskakuje doby w żadnej strefie użytkownika. */
export function naDate(t: number): string {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate()
  ).padStart(2, '0')}T09:00:00.000Z`;
}

export function parsuj(v: unknown): number | null {
  if (v == null || v === '') return null;
  const t = v instanceof Date ? v.getTime() : Date.parse(String(v));
  return Number.isFinite(t) ? t : null;
}

const GRANICA_PRZYSZLOSCI = 540; // dni — dalej niż półtora roku to nie jest plan, tylko życzenie
const GRANICA_PRZESZLOSCI = 1095; // dni — start sprzed 3 lat w portfelu „na dziś" nic nie znaczy
const TUZ_PRZED = 30; // dni — „start w przyszłości ALBO TUŻ PRZED"

/**
 * Czy para dat ma sens wobec statusu i dzisiejszej daty.
 * `null` w polu jest tu ODPOWIEDZIĄ, nie brakiem danych: dla statusów objętych
 * regułą właściciela brak daty JEST bez sensu (wiersz pokazuje „brak dat planu"
 * i szary RAG w miejsce terminu, który istnieje w rzeczywistości).
 */
export function czySensowna(status: Status, ps: number | null, pe: number | null, dzis: number): boolean {
  if (ps != null && pe != null && pe < ps) return false;
  if (pe != null && pe > dodaj(dzis, GRANICA_PRZYSZLOSCI)) return false;
  if (ps != null && ps < dodaj(dzis, -GRANICA_PRZESZLOSCI)) return false;

  switch (status) {
    case 'IN_EXECUTION':
      if (ps == null || pe == null) return false;
      return ps <= dzis && pe >= dzis;
    case 'APPROVED':
    case 'PENDING_APPROVAL':
      if (ps == null || pe == null) return false;
      return ps >= dodaj(dzis, -TUZ_PRZED) && pe > dzis;
    case 'CLOSED':
      if (ps == null || pe == null) return false;
      return pe < dzis;
    default:
      // DRAFT / REJECTED / statusy spoza reguł właściciela — tylko reguły wspólne wyżej.
      return true;
  }
}

/** Plan zastępczy — rozłożony, deterministyczny, zgodny z regułą dla statusu. */
export function zaproponuj(
  status: Status,
  id: string,
  ps: number | null,
  dzis: number
): { start: number; koniec: number } {
  const a = skrot(id, 'start');
  const b = skrot(id, 'czas');
  const trwanie = 120 + (b % 210); // 4–11 miesięcy — typowe okno projektu doradczego

  switch (status) {
    case 'IN_EXECUTION': {
      const start = dodaj(dzis, -(21 + (a % 140))); // ruszył 3 tygodnie – 5 miesięcy temu
      let koniec = dodaj(start, trwanie);
      const minimum = dodaj(dzis, 21 + (skrot(id, 'zapas') % 120));
      if (koniec < minimum) koniec = minimum;
      return { start, koniec };
    }
    case 'APPROVED': {
      const start = dodaj(dzis, 10 + (a % 40)); // rusza za 10–50 dni
      return { start, koniec: dodaj(start, trwanie) };
    }
    case 'PENDING_APPROVAL': {
      const start = dodaj(dzis, 30 + (a % 60)); // czeka na zgodę, rusza za 1–3 miesiące
      return { start, koniec: dodaj(start, trwanie) };
    }
    case 'CLOSED': {
      const koniec = dodaj(dzis, -(10 + (a % 330))); // zamknięta 10 dni – 11 miesięcy temu
      return { start: dodaj(koniec, -trwanie), koniec };
    }
    default: {
      // Jedyny przypadek dla DRAFT/REJECTED: odwrócona kolejność dat.
      const start = ps ?? dodaj(dzis, 30 + (a % 60));
      return { start, koniec: dodaj(start, trwanie) };
    }
  }
}

/* ─────────────────────────── przebieg ─────────────────────────── */

interface Wiersz {
  id: string;
  tytul: string;
  status: string;
  planned_start_date: unknown;
  planned_end_date: unknown;
  baseline_start_date: string | null;
  baseline_end_date: string | null;
  schedule_shift_count: number | null;
}

interface Zmiana {
  id: string;
  tytul: string;
  status: string;
  powod: string;
  zPs: string;
  zPe: string;
  naPs: string;
  naPe: string;
}

const dataTekst = (v: unknown): string => {
  const t = parsuj(v);
  return t == null ? '—' : new Date(t).toISOString().slice(0, 10);
};

function powodNiesensu(status: Status, ps: number | null, pe: number | null, dzis: number): string {
  if (ps != null && pe != null && pe < ps) return 'koniec przed startem';
  if (pe != null && pe > dodaj(dzis, GRANICA_PRZYSZLOSCI)) return 'koniec absurdalnie odległy';
  if (ps != null && ps < dodaj(dzis, -GRANICA_PRZESZLOSCI)) return 'start absurdalnie dawny';
  if (ps == null && pe == null) return 'brak obu dat planu';
  if (ps == null) return 'brak daty startu';
  if (pe == null) return 'brak daty końca';
  if (status === 'IN_EXECUTION' && ps > dzis) return 'w realizacji, a start dopiero przed nami';
  if (status === 'IN_EXECUTION' && pe < dzis) return 'w realizacji, a koniec planu już minął';
  if ((status === 'APPROVED' || status === 'PENDING_APPROVAL') && pe <= dzis)
    return 'zatwierdzona/do zatwierdzenia, a koniec planu już minął';
  if ((status === 'APPROVED' || status === 'PENDING_APPROVAL') && ps < dodaj(dzis, -TUZ_PRZED))
    return 'zatwierdzona/do zatwierdzenia, a start dawno za nami';
  if (status === 'CLOSED' && pe >= dzis) return 'zamknięta, a koniec planu w przyszłości';
  return 'niezgodna z regułą statusu';
}

function zapiszKopie(etykieta: string, wiersze: Wiersz[]): string {
  fs.mkdirSync(KATALOG_DOWODU, { recursive: true });
  const p = path.join(KATALOG_DOWODU, `kopia-${etykieta}-${iso()}.csv`);
  const naglowek =
    'id,status,planned_start_date,planned_end_date,baseline_start_date,baseline_end_date,schedule_shift_count\n';
  const body = wiersze
    .map((w) =>
      [
        w.id,
        w.status,
        w.planned_start_date instanceof Date
          ? w.planned_start_date.toISOString()
          : (w.planned_start_date ?? ''),
        w.planned_end_date instanceof Date ? w.planned_end_date.toISOString() : (w.planned_end_date ?? ''),
        w.baseline_start_date ?? '',
        w.baseline_end_date ?? '',
        w.schedule_shift_count ?? 0,
      ]
        .map(csvCell)
        .join(',')
    )
    .join('\n');
  fs.writeFileSync(p, naglowek + body + (body ? '\n' : ''));
  return p;
}

async function przebieg(c: PoolClient, org: { id: string; name: string }, cli: Cli): Promise<void> {
  const dzis = Date.now();

  const wiersze = (
    await c.query<Wiersz>(
      `SELECT id, COALESCE(NULLIF(title,''), name, '(bez nazwy)') AS tytul, status,
              planned_start_date, planned_end_date,
              baseline_start_date, baseline_end_date, schedule_shift_count
         FROM initiatives
        WHERE organization_id = $1
        ORDER BY status, tytul`,
      [org.id]
    )
  ).rows;

  // Dziennik re-baseline: inicjatywy, przy których stoi ŚLAD DECYZJI. Ich
  // rozjazdu baseline vs plan NIE WOLNO zerować — to jest realny, zatwierdzony
  // poślizg, a nie artefakt budowy mechanizmu.
  const zDecyzja = new Set<string>();
  let log = 'brak tabeli';
  try {
    const r = await c.query<{ initiative_id: string }>(
      `SELECT initiative_id FROM initiative_rebaseline_log WHERE organization_id = $1`,
      [org.id]
    );
    for (const x of r.rows) zDecyzja.add(x.initiative_id);
    log = String(r.rows.length);
  } catch {
    /* tabela nie istnieje w tej bazie — zostaje „brak tabeli" */
  }

  const zmiany: Zmiana[] = [];
  const doZapisu: { id: string; ps: string; pe: string }[] = [];
  // Inicjatywy z zatwierdzonym re-baseline'em zostawiamy człowiekowi:
  // ich termin jest przedmiotem decyzji, nie sprzątania danych.
  const pominieteZDecyzja: Wiersz[] = [];

  for (const w of wiersze) {
    const ps = parsuj(w.planned_start_date);
    const pe = parsuj(w.planned_end_date);
    if (czySensowna(w.status, ps, pe, dzis)) continue;
    if (zDecyzja.has(w.id)) {
      pominieteZDecyzja.push(w);
      continue;
    }
    // DRAFT/REJECTED bez dat są sensowne — czySensowna() już je przepuściła.
    const p = zaproponuj(w.status, w.id, ps, dzis);
    const naPs = naDate(p.start);
    const naPe = naDate(p.koniec);
    zmiany.push({
      id: w.id,
      tytul: w.tytul,
      status: w.status,
      powod: powodNiesensu(w.status, ps, pe, dzis),
      zPs: dataTekst(w.planned_start_date),
      zPe: dataTekst(w.planned_end_date),
      naPs: naPs.slice(0, 10),
      naPe: naPe.slice(0, 10),
    });
    doZapisu.push({ id: w.id, ps: naPs, pe: naPe });
  }

  // Osobno: plan bieżący jest, planu bazowego nie ma → kolumna „Odchylenie"
  // pokazuje „—" zamiast 0. To nie jest zmiana terminu, tylko domknięcie baseline'u.
  const bezBaseline = wiersze.filter(
    (w) =>
      !doZapisu.some((z) => z.id === w.id) &&
      parsuj(w.planned_end_date) != null &&
      (w.baseline_end_date == null || w.baseline_end_date === '')
  );

  // Rozjazd baseline vs plan na wierszach, których nie ruszamy (artefakt budowy).
  const rozjazdBaseline = wiersze.filter((w) => {
    if (doZapisu.some((z) => z.id === w.id)) return false;
    if (zDecyzja.has(w.id)) return false;
    const pe = parsuj(w.planned_end_date);
    const be = parsuj(w.baseline_end_date);
    return pe != null && be != null && Math.round((pe - be) / DZIEN) !== 0;
  });
  const licznikNiezerowy = wiersze.filter((w) => (Number(w.schedule_shift_count) || 0) !== 0);

  console.log('');
  console.log(`POMIAR · ${wiersze.length} inicjatyw w organizacji`);
  console.log(`  bez sensu wobec statusu i dzisiejszej daty : ${zmiany.length}`);
  console.log(`  plan bez planu bazowego („—" w Odchyleniu) : ${bezBaseline.length}`);
  console.log(`  rozjazd plan bazowy vs plan bieżący        : ${rozjazdBaseline.length}`);
  console.log(`  licznik przesunięć ≠ 0                     : ${licznikNiezerowy.length}`);
  console.log(`  wpisy w dzienniku re-baseline              : ${log}`);
  console.log(`  pominięte (mają zatwierdzony re-baseline)  : ${pominieteZDecyzja.length}`);
  console.log('');
  for (const z of zmiany) {
    console.log(
      `  ${z.status.padEnd(17)} ${z.tytul.slice(0, 44).padEnd(44)} ${z.zPs} → ${z.zPe}  ⇒  ${z.naPs} → ${z.naPe}   (${z.powod})`
    );
  }

  if (zmiany.length === 0 && bezBaseline.length === 0 && rozjazdBaseline.length === 0) {
    console.log('  ZERO ZMIAN — terminy są już zgodne z regułami.');
    return;
  }

  if (!cli.apply) {
    console.log('');
    console.log('DRY-RUN — nic nie zapisano. Powtórz z --apply, żeby zapisać.');
    return;
  }

  const kopia = zapiszKopie(cli.etykieta, wiersze);
  console.log('');
  console.log(`KOPIA BEZPIECZEŃSTWA (stan PRZED, wszystkie wiersze): ${kopia}`);

  await c.query('BEGIN');
  try {
    for (const z of doZapisu) {
      await c.query(
        `UPDATE initiatives SET planned_start_date = $2, planned_end_date = $3, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1 AND organization_id = $4`,
        [z.id, z.ps, z.pe, org.id]
      );
    }
    // Plan bazowy = plan bieżący, w formacie, w jakim baseline jest trzymany
    // w TEJ bazie (`::text` — kolumny planu mają różny typ na stanowisku i na
    // stagingu). Bez tego kroku samo sprzątanie dat wyprodukowałoby fałszywy
    // poślizg w kolumnie „Odchylenie (dni)".
    const idsPlanu = doZapisu.map((z) => z.id);
    const idsBaseline = [...idsPlanu, ...bezBaseline.map((w) => w.id), ...rozjazdBaseline.map((w) => w.id)];
    if (idsBaseline.length > 0) {
      await c.query(
        `UPDATE initiatives
            SET baseline_start_date = NULLIF(planned_start_date::text, ''),
                baseline_end_date   = NULLIF(planned_end_date::text, ''),
                baseline_set_at     = CURRENT_TIMESTAMP,
                schedule_shift_count = 0
          WHERE organization_id = $1 AND id = ANY($2::text[])`,
        [org.id, idsBaseline]
      );
    }
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  }

  console.log(
    `ZAPISANO · terminy: ${doZapisu.length} · plan bazowy zrównany z bieżącym: ${
      doZapisu.length + bezBaseline.length + rozjazdBaseline.length
    }`
  );
}

/* ─────────────────────────── entrypoint ─────────────────────────── */

const TEN_PLIK = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === TEN_PLIK) {
  const cli = parseCliTerminy();
  const p = pool();
  const c = await p.connect();
  try {
    const org = await resolveOrg(c, cli.org);
    console.log(
      `PLAN · ${SKRYPT} · ${org.name} (${org.id}) · ${cli.apply ? 'apply' : 'dry-run'} · etykieta=${cli.etykieta}`
    );
    await przebieg(c, org, cli);
  } finally {
    c.release();
    await p.end();
  }
}
