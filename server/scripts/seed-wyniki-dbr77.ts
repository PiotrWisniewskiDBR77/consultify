#!/usr/bin/env tsx
/**
 * SEED "Wyniki" (KPI · OKR · ROI) — realne, wiarygodne dane zakładu DBR77.
 *
 * Cel: moduł Wyniki nie może być pusty na demo/stagingu. Skrypt jest
 * ADDYTYWNY (nigdy nie modyfikuje ani nie kasuje cudzych wierszy),
 * IDEMPOTENTNY (każdy identyfikator jest deterministyczny — UUIDv5 z pary
 * TAG+organizacja+klucz naturalny, więc powtórny `--apply` wstawia 0 wierszy)
 * i ODWRACALNY (`--rollback` kasuje WYŁĄCZNIE wiersze o tych deterministycznych
 * identyfikatorach).
 *
 * Źródło treści KPI: arkusz właściciela
 *   docs/modules/07_rezultaty/zalaczniki/Apator_szablon_raport_KPI_20260905_Ogolny.csv
 * (Plant Balanced Scorecard, 138 mierników). Z arkusza pochodzą: nazwa,
 * obszar, metoda liczenia, definicja, kierunek min./max., jednostka,
 * częstotliwość, typ wskaźnika, odpowiedzialność. Wartości liczbowe (CEL,
 * Rezultat, benchmark, dopuszczalny limit %) w arkuszu-szablonie są PUSTE —
 * są tu wygenerowane deterministycznie jako wiarygodne dla zakładu DBR77.
 *
 * Źródło treści OKR i ROI: zaakceptowany prototyp
 *   dev-render/screens/p7k-wyniki-prototype.tsx
 * (te same nazwy i liczby, żeby akcept prototypu zgadzał się z danymi żywymi).
 *
 * Uruchomienie:
 *   DATABASE_URL=... npx tsx server/scripts/seed-wyniki-dbr77.ts --org=DBR77 --dry-run
 *   DATABASE_URL=... npx tsx server/scripts/seed-wyniki-dbr77.ts --org=DBR77 --apply
 *   DATABASE_URL=... npx tsx server/scripts/seed-wyniki-dbr77.ts --org=DBR77 --rollback
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Pool, type PoolClient } from 'pg';

import { evaluatePerformanceStatus } from '../src/services/resultsVnext/kpi/targetGeometryEvaluator.js';

// ==========================================
// Tag / deterministyczne identyfikatory
// ==========================================

export const SEED_TAG = 'seed:wyniki-dbr77-20260905';
/** Stała przestrzeń nazw UUIDv5 dla tego seeda (losowa, przybita na stałe). */
const SEED_NAMESPACE = '3f2b8c14-9d7a-5e42-b1c6-7a0e5d938f21';

function uuidV5(name: string, namespace: string): string {
  const nsBytes = Buffer.from(namespace.replace(/-/g, ''), 'hex');
  const hash = crypto.createHash('sha1').update(nsBytes).update(Buffer.from(name, 'utf8')).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Deterministyczny UUID: ten sam TAG + organizacja + rodzaj + klucz zawsze daje ten sam id. */
function det(orgId: string, kind: string, key: string): string {
  return uuidV5(`${SEED_TAG}|${orgId}|${kind}|${key}`, SEED_NAMESPACE);
}

/** Deterministyczny generator liczb (xorshift) — bez zależności, stabilny między uruchomieniami. */
function rng(seedText: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i += 1) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

// ==========================================
// Arkusz właściciela — parser CSV
// ==========================================

export interface SheetMetric {
  md: string;
  mt: string;
  obszar: string;
  name: string;
  metoda: string;
  definicja: string;
  kierunek: string;
  jednostka: string;
  czestotliwosc: string;
  typ: string;
  odp: string;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
export const SHEET_PATH = path.join(
  REPO_ROOT,
  'docs/modules/07_rezultaty/zalaczniki/Apator_szablon_raport_KPI_20260905_Ogolny.csv'
);

export function readSheetMetrics(sheetPath = SHEET_PATH): SheetMetric[] {
  const rows = parseCsv(fs.readFileSync(sheetPath, 'utf8'));
  const out: SheetMetric[] = [];
  let md = '';
  let mt = '';
  let obszar = '';
  // Wiersze 0-5 to nagłówek arkusza; dane zaczynają się od wiersza 6 i idą
  // parami CEL/Rezultat (jednostka jest w wierszu "Rezultat").
  for (let i = 6; i < rows.length; i += 1) {
    const r = rows[i] ?? [];
    const cell = (n: number) => (r[n] ?? '').replace(/ /g, ' ').trim();
    if (cell(0)) md = cell(0);
    if (cell(1)) mt = cell(1);
    if (cell(2)) obszar = cell(2);
    const name = cell(4);
    if (!name) continue;
    const next = rows[i + 1] ?? [];
    const unit = (next[7] ?? '').replace(/ /g, ' ').trim();
    out.push({
      md,
      mt,
      obszar,
      name,
      metoda: cell(5),
      definicja: cell(6),
      kierunek: cell(7),
      jednostka: unit,
      czestotliwosc: cell(8),
      typ: cell(9),
      odp: cell(10),
    });
  }
  return out;
}

// ==========================================
// Model danych KPI dla DBR77
// ==========================================

type Geometry = 'threshold_min' | 'threshold_max' | 'custom';

const MONTHS = [
  ['2026-01-01', '2026-01-31'],
  ['2026-02-01', '2026-02-28'],
  ['2026-03-01', '2026-03-31'],
  ['2026-04-01', '2026-04-30'],
  ['2026-05-01', '2026-05-31'],
  ['2026-06-01', '2026-06-30'],
  ['2026-07-01', '2026-07-31'],
  ['2026-08-01', '2026-08-31'],
  ['2026-09-01', '2026-09-30'],
] as const;
/** Ostatni pełny miesiąc na dzień seedu (05.09.2026). Rozkład stanów w kartach
 *  raportu liczy się z pomiaru o `period_end <= now()`, czyli z sierpnia. */
const REFERENCE_MONTH_INDEX = 7;

function normalizeDirection(kierunek: string): Geometry | null {
  const k = kierunek.toLowerCase().replace(/\./g, '').trim();
  if (k === 'min') return 'threshold_min';
  if (k === 'max') return 'threshold_max';
  return null;
}

/** Arkusz nie podaje kierunku dla części mierników. Dla tych, które MAJĄ
 *  dostać cel, kierunek wynika z rodziny miernika (mniej znaczy lepiej dla
 *  awarii/braków/kosztów), a nie z domysłu per wiersz. */
const LESS_IS_BETTER = /wypadk|awari|reklamac|odpad|brak|złom|zlom|absencj|rotacj|koszt|strat|opóźn|opozn|niezgodn|przestój|przestoj|zużyci|zuzyci|nadgodzin|fluktuacj/i;

function resolveGeometry(sheet: SheetMetric, allowCustom: boolean): Geometry {
  const explicit = normalizeDirection(sheet.kierunek);
  if (explicit) return explicit;
  if (allowCustom) return 'custom';
  return LESS_IS_BETTER.test(sheet.name) ? 'threshold_max' : 'threshold_min';
}

/** Zakres wiarygodnej wartości docelowej dla jednostki z arkusza (zakład DBR77). */
function targetRangeForUnit(unit: string, geometry: Geometry): [number, number, number] {
  const u = unit.toLowerCase().replace(/[[\]]/g, '').trim();
  const pick = (lo: number, hi: number, dec: number): [number, number, number] => [lo, hi, dec];
  if (u === '%' || u === '% sprzedaży' || u === '%/zmian' || u === '%/m2/transport') {
    return geometry === 'threshold_max' ? pick(1, 8, 1) : pick(88, 98, 1);
  }
  if (u === 'lc/1000') return pick(180, 9200, 0);
  if (u === 'pln') return pick(45000, 900000, 0);
  if (u === 'dni') return pick(12, 65, 1);
  if (u === 'h') return pick(4, 42, 1);
  if (u === 'szt.' || u === 'sztuk' || u === 'szt' || u === 'liczba') return pick(1, 45, 0);
  if (u === 'kwh') return pick(22000, 90000, 0);
  if (u === 'lata') return pick(1, 12, 1);
  if (u.startsWith('m2') || u.startsWith('m 2') || u === 'm3' || u === 'm kw') return pick(120, 5200, 0);
  return pick(10, 100, 1);
}

export interface PlannedKpi {
  kpiId: string;
  versionId: string;
  code: string;
  sheet: SheetMetric;
  geometry: Geometry;
  unit: string | null;
  target: number | null;
  warningLow: number | null;
  warningHigh: number | null;
  criticalLow: number | null;
  criticalHigh: number | null;
  limitPct: number | null;
  benchmark: number | null;
  frequencyDays: number | null;
  ownerUserId: string;
  /** null = miernik bez pomiarów (kolumna „brak" w rozkładzie stanów). */
  measurements: PlannedMeasurement[];
}

export interface PlannedMeasurement {
  measurementId: string;
  periodStart: string;
  periodEnd: string;
  periodTarget: number;
  actual: number;
  status: 'on_target' | 'warning' | 'critical' | 'neutral';
  quality: 'verified' | 'estimated';
}

function round(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

function frequencyDays(czestotliwosc: string): number | null {
  const c = czestotliwosc.toLowerCase();
  if (!c) return null;
  if (c.includes('2 tyg')) return 14;
  if (c.includes('kwart') || c.includes('kwat')) return 91;
  if (c.includes('roczn')) return 365;
  if (c.includes('mies')) return 30;
  if (c.includes('narast')) return 30;
  return null;
}

/**
 * Plan mierników: 138 pozycji z arkusza. Rozkład stanów w miesiącu
 * odniesienia (sierpień) jest dobrany tak, żeby karta raportu pokazała
 * dokładnie 93 w normie / 21 ostrzeżeń / 8 krytycznych / 16 bez danych —
 * te same liczby, które właściciel zaakceptował na prototypie.
 */
export function planKpis(orgId: string, metrics: SheetMetric[], owners: string[]): PlannedKpi[] {
  const WARNING_TARGET = 21;
  const CRITICAL_TARGET = 8;
  const MISSING_TARGET = 16;

  // „Brak danych" dostają mierniki, dla których arkusz nie podaje ANI
  // kierunku, ANI jednostki — nie ma z czego zbudować celu, więc geometria
  // zostaje 'custom' i miernik nie ma pomiarów. Pozostałe mierniki bez
  // kierunku dostają kierunek z rodziny miernika (resolveGeometry).
  const missingCandidates: number[] = [];
  metrics.forEach((m, i) => {
    if (!m.jednostka && !normalizeDirection(m.kierunek)) missingCandidates.push(i);
  });
  if (missingCandidates.length < MISSING_TARGET) {
    metrics.forEach((m, i) => {
      if (missingCandidates.length >= MISSING_TARGET) return;
      if (!missingCandidates.includes(i) && !normalizeDirection(m.kierunek)) missingCandidates.push(i);
    });
  }
  const missing = new Set(missingCandidates.slice(0, MISSING_TARGET));

  const measured: number[] = [];
  metrics.forEach((_, i) => {
    if (!missing.has(i)) measured.push(i);
  });
  // Deterministyczne, rozproszone po całym raporcie przypisanie odchyleń.
  const criticalIdx = new Set<number>();
  const warningIdx = new Set<number>();
  for (let k = 0; k < CRITICAL_TARGET; k += 1) {
    criticalIdx.add(measured[Math.floor((k + 0.5) * (measured.length / CRITICAL_TARGET))] ?? measured[k]!);
  }
  let placed = 0;
  for (let k = 0; k < measured.length && placed < WARNING_TARGET; k += 1) {
    const idx = measured[Math.floor((k * 7 + 3) % measured.length)]!;
    if (!criticalIdx.has(idx) && !warningIdx.has(idx)) {
      warningIdx.add(idx);
      placed += 1;
    }
  }

  return metrics.map((sheet, i) => {
    const code = `DBR77.BSC.${String(i + 1).padStart(3, '0')}`;
    const rand = rng(`${SEED_TAG}|${code}`);
    const geometry = resolveGeometry(sheet, missing.has(i));
    const [lo, hi, dec] = targetRangeForUnit(sheet.jednostka, geometry);
    const hasTarget = geometry !== 'custom';
    const target = hasTarget ? round(lo + rand() * (hi - lo), dec) : null;
    const limitPct = hasTarget ? (rand() < 0.35 ? 10 : 5) : null;
    const benchmark = hasTarget && target !== null ? round(target * (0.92 + rand() * 0.16), dec) : null;

    let warningLow: number | null = null;
    let warningHigh: number | null = null;
    let criticalLow: number | null = null;
    let criticalHigh: number | null = null;
    if (target !== null && limitPct !== null) {
      // Po zaokrągleniu do jednostki miernika (np. cel 3 szt.) próg
      // ostrzegawczy potrafi zejść się z celem — wtedy pasmo „ostrzeżenie"
      // byłoby nieosiągalne i miernik nigdy nie pokazałby stanu pośredniego.
      // Wymuszamy odstęp co najmniej jednego kroku zaokrąglenia.
      const step = 10 ** -dec;
      if (geometry === 'threshold_min') {
        warningLow = Math.min(round(target * (1 - limitPct / 100), dec), round(target - step, dec));
        criticalLow = Math.min(round(target * (1 - (2 * limitPct) / 100), dec), round(warningLow - step, dec));
      } else {
        warningHigh = Math.max(round(target * (1 + limitPct / 100), dec), round(target + step, dec));
        criticalHigh = Math.max(round(target * (1 + (2 * limitPct) / 100), dec), round(warningHigh + step, dec));
      }
    }

    const ownerUserId = owners[i % owners.length]!;
    const kpiId = det(orgId, 'kpi', code);
    const versionId = det(orgId, 'kpi_version', `${code}|v1`);

    const measurements: PlannedMeasurement[] = [];
    if (!missing.has(i) && target !== null) {
      const wantCritical = criticalIdx.has(i);
      const wantWarning = warningIdx.has(i);
      MONTHS.forEach(([periodStart, periodEnd], mi) => {
        // CEL miesięczny = cel z wersji definicji. Ten sam próg ocenia
        // ewaluator aplikacji, więc para CEL/Rezultat i stan nigdy się nie
        // rozjadą (arkusz dopuszcza cel zmienny w miesiącach, ale schemat ma
        // dziś jeden cel na wersję definicji — patrz RAPORT.md).
        const periodTarget = round(target, dec);
        // Stan wybranego miesiąca odniesienia jest wymuszony; pozostałe
        // miesiące mają wiarygodny, ale losowy przebieg wokół celu.
        let want: 'on_target' | 'warning' | 'critical';
        if (mi === REFERENCE_MONTH_INDEX) want = wantCritical ? 'critical' : wantWarning ? 'warning' : 'on_target';
        else {
          const r = rand();
          if (wantCritical && mi >= REFERENCE_MONTH_INDEX - 2) want = r < 0.55 ? 'critical' : 'warning';
          else if (wantWarning && mi >= REFERENCE_MONTH_INDEX - 2) want = r < 0.6 ? 'warning' : 'on_target';
          else want = r < 0.82 ? 'on_target' : r < 0.95 ? 'warning' : 'critical';
        }
        const dev = limitPct ?? 5;
        let actual: number;
        if (geometry === 'threshold_min') {
          if (want === 'on_target') actual = round(periodTarget * (1 + rand() * 0.05), dec);
          else if (want === 'warning') actual = round(periodTarget * (1 - dev / 200 - rand() * (dev / 200)), dec);
          else actual = round(periodTarget * (1 - (2 * dev) / 100 - rand() * 0.05), dec);
        } else {
          if (want === 'on_target') actual = round(periodTarget * (1 - rand() * 0.05), dec);
          else if (want === 'warning') actual = round(periodTarget * (1 + dev / 200 + rand() * (dev / 200)), dec);
          else actual = round(periodTarget * (1 + (2 * dev) / 100 + rand() * 0.05), dec);
        }
        // Stan bierzemy z tego samego ewaluatora, którego używa aplikacja —
        // nie z własnego założenia. Przy zaokrągleniu do jednostki (np. cel
        // 3 szt.) wygenerowana wartość potrafi wpaść do sąsiedniego pasma,
        // dlatego korygujemy ją o krok zaokrąglenia aż ewaluator potwierdzi
        // zamierzony stan — inaczej rozkład stanów w raporcie by się rozjechał.
        const evalAt = (v: number) =>
          evaluatePerformanceStatus({
            geometry,
            actualValue: v,
            targetValue: target,
            warningLow,
            warningHigh,
            criticalLow,
            criticalHigh,
          }) as PlannedMeasurement['status'];
        const step = (geometry === 'threshold_min' ? -1 : 1) * 10 ** -dec;
        for (let attempt = 0; attempt < 40 && evalAt(actual) !== want; attempt += 1) {
          const current = evalAt(actual);
          // 'on_target' jest „za blisko celu", 'critical' „za daleko" —
          // przesuwamy w stronę pasma, którego brakuje.
          const order = { on_target: 0, warning: 1, critical: 2, neutral: 0 } as const;
          const direction = order[current] < order[want] ? 1 : -1;
          actual = round(actual + direction * step, dec);
        }
        const status = evalAt(actual);
        measurements.push({
          measurementId: det(orgId, 'kpi_measurement', `${code}|${periodStart}`),
          periodStart,
          periodEnd,
          periodTarget,
          actual,
          status,
          // Wrzesień nie jest jeszcze miesiącem zamkniętym (seed z 05.09.2026).
          quality: mi > REFERENCE_MONTH_INDEX ? 'estimated' : 'verified',
        });
      });
    }

    return {
      kpiId,
      versionId,
      code,
      sheet,
      geometry,
      unit: sheet.jednostka || null,
      target,
      warningLow,
      warningHigh,
      criticalLow,
      criticalHigh,
      limitPct,
      benchmark,
      frequencyDays: frequencyDays(sheet.czestotliwosc),
      ownerUserId,
      measurements,
    };
  });
}

// ==========================================
// Raporty KPI (scorecards) — 3 sztuki jak w prototypie
// ==========================================

export interface PlannedScorecard {
  scorecardId: string;
  name: string;
  description: string;
  scopeType: 'organization' | 'business_unit';
  scopeId: string;
  reviewFrequency: 'monthly' | 'quarterly';
  ownerUserId: string;
  items: { itemId: string; kpiId: string; sortOrder: number; role: 'primary' | 'supporting'; displayConfig: Record<string, unknown> }[];
}

function displayConfigFor(k: PlannedKpi): Record<string, unknown> {
  // Elementy arkusza, które NIE mają własnego pola w dzisiejszym schemacie
  // (obszar, właściciel nadrzędny MD, typ rozliczeniowy/informacyjny,
  // benchmark, dopuszczalny limit %) — trzymane jawnie w istniejącej
  // kolumnie JSONB pozycji raportu, nie zgadywane z innych pól.
  return {
    seed: SEED_TAG,
    obszar: k.sheet.obszar || null,
    wlascicielNadrzedny: k.sheet.md || null,
    grupa: k.sheet.mt || null,
    typWskaznika: k.sheet.typ || null,
    czestotliwosc: k.sheet.czestotliwosc || null,
    odpowiedzialnosc: k.sheet.odp || null,
    kierunek: k.sheet.kierunek || null,
    benchmark: k.benchmark,
    dopuszczalnyLimitPct: k.limitPct,
  };
}

function pickByStatus(
  pool: PlannedKpi[],
  used: Set<string>,
  status: 'on_target' | 'warning' | 'critical' | 'missing',
  count: number,
  hint: (k: PlannedKpi) => boolean
): PlannedKpi[] {
  const matches = (k: PlannedKpi) => {
    const ref = k.measurements[REFERENCE_MONTH_INDEX];
    if (status === 'missing') return k.measurements.length === 0;
    return ref?.status === status;
  };
  const out: PlannedKpi[] = [];
  for (const preferHint of [true, false]) {
    for (const k of pool) {
      if (out.length >= count) break;
      if (used.has(k.kpiId) || !matches(k)) continue;
      if (preferHint && !hint(k)) continue;
      out.push(k);
      used.add(k.kpiId);
    }
    if (out.length >= count) break;
  }
  return out;
}

export function planScorecards(orgId: string, kpis: PlannedKpi[], owners: string[]): PlannedScorecard[] {
  const mkItems = (scorecardId: string, list: PlannedKpi[]) =>
    list.map((k, idx) => ({
      itemId: det(orgId, 'scorecard_item', `${scorecardId}|${k.code}`),
      kpiId: k.kpiId,
      sortOrder: idx + 1,
      role: (idx < 8 ? 'primary' : 'supporting') as 'primary' | 'supporting',
      displayConfig: displayConfigFor(k),
    }));

  const mainId = det(orgId, 'scorecard', 'plant-balanced-scorecard-2026');
  const prodId = det(orgId, 'scorecard', 'kpi-produkcji-q3-2026');
  const qualId = det(orgId, 'scorecard', 'kpi-jakosci-2026-08');

  const prodHint = (k: PlannedKpi) =>
    /produkcj|ur|logistyk|planowanie/i.test(`${k.sheet.odp} ${k.sheet.obszar}`);
  const qualHint = (k: PlannedKpi) =>
    /jakoś|jakos|reklamac|odpad|braki|zgodnoś/i.test(`${k.sheet.odp} ${k.sheet.obszar} ${k.sheet.name}`);

  const usedProd = new Set<string>();
  const prodItems = [
    ...pickByStatus(kpis, usedProd, 'on_target', 17, prodHint),
    ...pickByStatus(kpis, usedProd, 'warning', 4, prodHint),
    ...pickByStatus(kpis, usedProd, 'critical', 2, prodHint),
    ...pickByStatus(kpis, usedProd, 'missing', 1, prodHint),
  ];
  const usedQual = new Set<string>();
  const qualItems = [
    ...pickByStatus(kpis, usedQual, 'on_target', 13, qualHint),
    ...pickByStatus(kpis, usedQual, 'warning', 3, qualHint),
    ...pickByStatus(kpis, usedQual, 'critical', 1, qualHint),
    ...pickByStatus(kpis, usedQual, 'missing', 1, qualHint),
  ];

  return [
    {
      scorecardId: mainId,
      name: 'Plant Balanced Scorecard — Zakład DBR77',
      description:
        'Karta wyników zakładu wg szablonu Plant Balanced Scorecard: 138 mierników w podziale na obszary, cel i rezultat miesiąc po miesiącu (I–IX 2026), miesiące X–XII bez danych.',
      scopeType: 'organization',
      scopeId: orgId,
      reviewFrequency: 'monthly',
      ownerUserId: owners[0]!,
      items: mkItems(mainId, kpis),
    },
    {
      scorecardId: prodId,
      name: 'KPI produkcji — Q3 2026',
      description: 'Przegląd kwartalny mierników produkcji, utrzymania ruchu i logistyki zakładu DBR77.',
      scopeType: 'business_unit',
      scopeId: 'produkcja',
      reviewFrequency: 'quarterly',
      ownerUserId: owners[1 % owners.length]!,
      items: mkItems(prodId, prodItems),
    },
    {
      scorecardId: qualId,
      name: 'KPI jakości — sierpień 2026',
      description: 'Miesięczny przegląd mierników jakości, reklamacji i odpadu produkcyjnego.',
      scopeType: 'business_unit',
      scopeId: 'jakosc',
      reviewFrequency: 'monthly',
      ownerUserId: owners[2 % owners.length]!,
      items: mkItems(qualId, qualItems),
    },
  ];
}

// ==========================================
// OKR — 3 zestawy jak w prototypie
// ==========================================

export interface PlannedOkr {
  cycles: { cycleId: string; name: string; start: string; end: string; status: string }[];
  sets: {
    setId: string;
    cycleKey: string;
    title: string;
    scopeType: 'company' | 'business_unit';
    scopeId: string;
    ownerUserId: string;
    reviewerUserId: string;
    lastCheckinAt: string;
    overallProgress: number;
    overallConfidence: 'high' | 'medium' | 'low';
    attentionState: 'none' | 'watch' | 'action_required';
    objectives: {
      objectiveId: string;
      title: string;
      description: string;
      ownerUserId: string;
      ambition: 'committed' | 'aspirational' | 'standard';
      progress: number;
      confidence: 'high' | 'medium' | 'low';
      keyResults: {
        keyResultId: string;
        title: string;
        ownerUserId: string;
        measurementType: 'numeric' | 'percentage' | 'currency' | 'milestone';
        unit: string | null;
        currency: string | null;
        start: number;
        target: number;
        current: number;
        direction: 'increase' | 'decrease';
        status: 'not_started' | 'on_track' | 'at_risk' | 'off_track';
        confidence: 'high' | 'medium' | 'low';
      }[];
    }[];
  }[];
  occurrences: { occurrenceId: string; cycleKey: string; windowStart: string; windowEnd: string }[];
}

const OKR_BLUEPRINT: {
  key: string;
  title: string;
  scopeType: 'company' | 'business_unit';
  scopeId: string;
  cycleKey: string;
  lastCheckin: string;
  objectives: { title: string; description: string; krs: [string, string | null, number, number, number, 'increase' | 'decrease', 'not_started' | 'on_track' | 'at_risk' | 'off_track'][] }[];
}[] = [
  {
    key: 'okr-zakladu-q4-2026',
    title: 'OKR zakładu — Q4 2026',
    scopeType: 'company',
    scopeId: 'zaklad-dbr77',
    cycleKey: 'q4-2026',
    lastCheckin: '2026-09-04',
    objectives: [
      {
        title: 'Ustabilizować terminowość dostaw do klienta',
        description: 'Klient ma dostawać zamówienie w obiecanym oknie — bez interwencji planisty.',
        krs: [
          ['Terminowość dostaw OTIF z 84% do 95%', '%', 84, 95, 89, 'increase', 'on_track'],
          ['Skrócić średni czas realizacji zlecenia z 12 do 8 dni', 'dni', 12, 8, 10, 'decrease', 'at_risk'],
          ['Zero opóźnień powyżej 5 dni w kwartale', 'szt.', 7, 0, 2, 'decrease', 'on_track'],
        ],
      },
      {
        title: 'Podnieść dostępność parku maszynowego',
        description: 'Mniej postojów awaryjnych na gnieździe spawalniczym i linii montażu.',
        krs: [
          ['OEE linii montażu z 68% do 78%', '%', 68, 78, 73, 'increase', 'on_track'],
          ['Czas awarii w miesiącu z 42 h do 20 h', 'h', 42, 20, 31, 'decrease', 'at_risk'],
          ['Udział przeglądów prewencyjnych wykonanych w terminie 95%', '%', 71, 95, 90, 'increase', 'on_track'],
        ],
      },
      {
        title: 'Ograniczyć koszt niskiej jakości',
        description: 'Odpad produkcyjny i reklamacje kosztują dziś więcej niż zakładany budżet jakości.',
        krs: [
          ['Odpad produkcyjny z 4,8% do 2,5%', '%', 4.8, 2.5, 3.9, 'decrease', 'off_track'],
          ['Wartość reklamacji poniżej 180 tys. zł w kwartale', 'PLN', 310000, 180000, 236000, 'decrease', 'at_risk'],
          ['Czas odpowiedzi na reklamację z 9 do 3 dni', 'dni', 9, 3, 4, 'decrease', 'on_track'],
        ],
      },
      {
        title: 'Zbudować kompetencje utrzymania ruchu',
        description: 'Zespół UR ma samodzielnie obsługiwać zrobotyzowane gniazdo.',
        krs: [
          ['6 operatorów z certyfikatem obsługi robota', 'szt.', 1, 6, 4, 'increase', 'on_track'],
          ['Udział napraw wykonanych bez wsparcia zewnętrznego 80%', '%', 45, 80, 66, 'increase', 'on_track'],
        ],
      },
    ],
  },
  {
    key: 'okr-automatyzacji-q4-2026',
    title: 'OKR automatyzacji — Q4 2026',
    scopeType: 'business_unit',
    scopeId: 'program-automatyzacji',
    cycleKey: 'q4-2026',
    lastCheckin: '2026-09-03',
    objectives: [
      {
        title: 'Uruchomić zrobotyzowane gniazdo spawalnicze',
        description: 'Gniazdo ma pracować produkcyjnie na dwie zmiany przed końcem roku.',
        krs: [
          ['Wydajność gniazda 120 detali na zmianę', 'szt.', 0, 120, 84, 'increase', 'on_track'],
          ['Uruchomienie produkcyjne do 30.11.2026', '%', 0, 100, 65, 'increase', 'at_risk'],
          ['Czas cyklu detalu z 210 do 150 s', 'szt.', 210, 150, 168, 'decrease', 'on_track'],
        ],
      },
      {
        title: 'Wdrożyć kontrolę wizyjną na linii montażu',
        description: 'Wykrywanie wad przed pakowaniem zamiast reklamacji u klienta.',
        krs: [
          ['Skuteczność detekcji wad 97%', '%', 0, 97, 91, 'increase', 'on_track'],
          ['Fałszywe odrzuty poniżej 2%', '%', 9, 2, 3.4, 'decrease', 'at_risk'],
          ['Pokrycie kontrolą 100% wyrobów kluczowych', '%', 0, 100, 70, 'increase', 'on_track'],
        ],
      },
      {
        title: 'Przygotować magazyn WIP do automatyzacji',
        description: 'Bez uporządkowanego przepływu WIP automatyzacja magazynu nie ma podstawy.',
        krs: [
          ['Rotacja WIP z 18 do 11 dni', 'dni', 18, 11, 14, 'decrease', 'on_track'],
          ['Zmapowane 100% przepływów międzyoperacyjnych', '%', 0, 100, 88, 'increase', 'on_track'],
        ],
      },
    ],
  },
  {
    key: 'okr-sprzedazy-h2-2026',
    title: 'OKR sprzedaży — H2 2026',
    scopeType: 'business_unit',
    scopeId: 'sprzedaz',
    cycleKey: 'h2-2026',
    lastCheckin: '2026-09-01',
    objectives: [
      {
        title: 'Odbudować sprzedaż eksportową',
        description: 'Eksport spadł poniżej planu — trzeba odzyskać wolumen w Niemczech i Czechach.',
        krs: [
          ['Sprzedaż eksportowa 9,2 mln zł w H2', 'PLN', 6100000, 9200000, 7450000, 'increase', 'on_track'],
          ['12 nowych klientów eksportowych', 'szt.', 3, 12, 7, 'increase', 'at_risk'],
          ['Udział eksportu w sprzedaży 38%', '%', 29, 38, 33, 'increase', 'on_track'],
        ],
      },
      {
        title: 'Zwiększyć marżę na wyrobach własnych',
        description: 'Rosnące koszty materiału zjadły marżę na wyrobach katalogowych.',
        krs: [
          ['Marża brutto wyrobów własnych z 21% do 27%', '%', 21, 27, 23.5, 'increase', 'at_risk'],
          ['Udział wyrobów własnych w sprzedaży 45%', '%', 36, 45, 41, 'increase', 'on_track'],
          ['Obniżyć rabaty ponadstandardowe do 3% sprzedaży', '% sprzedaży', 7.5, 3, 6.4, 'decrease', 'off_track'],
        ],
      },
      {
        title: 'Skrócić cykl ofertowania',
        description: 'Klient dostaje ofertę zbyt późno, żeby wygrać przetarg.',
        krs: [
          ['Czas przygotowania oferty z 9 do 4 dni', 'dni', 9, 4, 6, 'decrease', 'on_track'],
          ['Skuteczność ofert 32%', '%', 24, 32, 27, 'increase', 'on_track'],
          ['Wdrożyć konfigurator ofert dla 3 rodzin wyrobów', 'szt.', 0, 3, 0, 'increase', 'not_started'],
        ],
      },
    ],
  },
];

export function planOkr(orgId: string, owners: string[]): PlannedOkr {
  const cycles = [
    {
      cycleId: det(orgId, 'okr_cycle', 'q4-2026'),
      name: 'Q4 2026',
      start: '2026-10-01',
      end: '2026-12-31',
      status: 'drafting',
      key: 'q4-2026',
    },
    {
      cycleId: det(orgId, 'okr_cycle', 'h2-2026'),
      name: 'H2 2026',
      start: '2026-07-01',
      end: '2026-12-31',
      status: 'active',
      key: 'h2-2026',
    },
  ];

  let ownerCursor = 0;
  const nextOwner = () => owners[ownerCursor++ % owners.length]!;

  const sets = OKR_BLUEPRINT.map((blueprint, si) => {
    const setId = det(orgId, 'okr_set', blueprint.key);
    let krCount = 0;
    const objectives = blueprint.objectives.map((obj, oi) => {
      const objectiveId = det(orgId, 'okr_objective', `${blueprint.key}|${oi + 1}`);
      const keyResults = obj.krs.map(([title, unit, start, target, current, direction, status]) => {
        krCount += 1;
        const denominator = target - start;
        const progress = denominator === 0 ? 0 : Math.min(1, Math.max(0, (current - start) / denominator));
        return {
          keyResultId: det(orgId, 'okr_kr', `${blueprint.key}|${oi + 1}|${krCount}`),
          title,
          ownerUserId: nextOwner(),
          measurementType:
            unit === '%' || unit === '% sprzedaży'
              ? ('percentage' as const)
              : unit === 'PLN'
                ? ('currency' as const)
                : ('numeric' as const),
          unit,
          currency: unit === 'PLN' ? 'PLN' : null,
          start,
          target,
          current,
          direction,
          status,
          confidence: (status === 'on_track' ? 'high' : status === 'at_risk' ? 'medium' : 'low') as
            | 'high'
            | 'medium'
            | 'low',
          progress: Math.round(progress * 100) / 100,
        };
      });
      const objProgress =
        keyResults.reduce((acc, kr) => acc + kr.progress, 0) / Math.max(1, keyResults.length);
      return {
        objectiveId,
        title: obj.title,
        description: obj.description,
        ownerUserId: owners[(si * 3 + oi) % owners.length]!,
        ambition: (oi === 0 ? 'committed' : 'standard') as 'committed' | 'standard',
        progress: Math.round(objProgress * 100) / 100,
        confidence: (keyResults.some((k) => k.status === 'off_track')
          ? 'low'
          : keyResults.some((k) => k.status === 'at_risk')
            ? 'medium'
            : 'high') as 'high' | 'medium' | 'low',
        keyResults,
      };
    });
    const allKrs = objectives.flatMap((o) => o.keyResults);
    const overallProgress =
      Math.round((allKrs.reduce((a, k) => a + k.progress, 0) / Math.max(1, allKrs.length)) * 100) / 100;
    return {
      setId,
      cycleKey: blueprint.cycleKey,
      title: blueprint.title,
      scopeType: blueprint.scopeType,
      scopeId: blueprint.scopeId,
      ownerUserId: owners[si % owners.length]!,
      reviewerUserId: owners[(si + 1) % owners.length]!,
      lastCheckinAt: `${blueprint.lastCheckin}T09:00:00.000Z`,
      overallProgress,
      overallConfidence: (allKrs.some((k) => k.status === 'off_track')
        ? 'low'
        : 'medium') as 'high' | 'medium' | 'low',
      attentionState: (allKrs.some((k) => k.status === 'off_track')
        ? 'action_required'
        : allKrs.some((k) => k.status === 'at_risk')
          ? 'watch'
          : 'none') as 'none' | 'watch' | 'action_required',
      objectives,
    };
  });

  const occurrences = [
    {
      occurrenceId: det(orgId, 'okr_occurrence', 'q4-2026|2026-08-24'),
      cycleKey: 'q4-2026',
      windowStart: '2026-08-24',
      windowEnd: '2026-09-06',
    },
    {
      occurrenceId: det(orgId, 'okr_occurrence', 'h2-2026|2026-08-24'),
      cycleKey: 'h2-2026',
      windowStart: '2026-08-24',
      windowEnd: '2026-09-06',
    },
  ];

  return { cycles, sets, occurrences } as unknown as PlannedOkr;
}

// ==========================================
// ROI — 3 analizy jak w prototypie
// ==========================================

export interface PlannedRoi {
  caseId: string;
  key: string;
  initiativeId: string;
  initiativeName: string;
  title: string;
  status: 'draft' | 'modeling';
  ownerUserId: string;
  analysisStart: string;
  analysisEnd: string;
  /** Rekomendacja GO / CONDITIONAL GO — dziś BEZ własnego pola w schemacie,
   *  zapisywana jako jawna notatka polityki wyliczeń. */
  recommendation: string | null;
  policyNotes: string;
  requiredMetrics: string[];
  baseline: { measured: number; unit: string; asOf: string; notes: string };
  assumptions: [string, string, string | null, number, number, number, 'low' | 'medium' | 'high', string][];
  costLines: [string, string, string, number, string, 'one_time' | 'recurring'][];
  benefitLines: [string, string, string, boolean, number, string, 'one_time' | 'recurring'][];
  scenarios: [('downside' | 'upside'), string, string][];
  run: {
    totalCosts: number;
    totalBenefits: number;
    simpleRoi: number;
    npv: number | null;
    irrPct: number | null;
    irrStatus: 'computed' | 'not_required_by_policy';
    paybackPeriods: number | null;
    discountedPaybackPeriods: number | null;
    benefitCostRatio: number | null;
  } | null;
}

export function planRoi(orgId: string, owners: string[]): PlannedRoi[] {
  const mk = (key: string, data: Omit<PlannedRoi, 'caseId' | 'key' | 'initiativeId'>): PlannedRoi => ({
    ...data,
    key,
    caseId: det(orgId, 'roi_case', key),
    // initiatives.id jest TEXT — deterministyczny, czytelny prefiks pozwala
    // rozpoznać i wycofać dokładnie te wiersze. Organizacja MUSI być częścią
    // klucza: bez niej ten sam id powtórzyłby się w dwóch organizacjach
    // (kolizja klucza głównego i fałszywe „już jest w bazie").
    initiativeId: `${SEED_TAG}|${orgId}|${key}`,
  });

  return [
    mk('robotyzacja-gniazda-spawalniczego', {
      initiativeName: 'Robotyzacja gniazda spawalniczego',
      title: 'Robotyzacja gniazda spawalniczego',
      status: 'modeling',
      ownerUserId: owners[0]!,
      analysisStart: '2026-01-01',
      analysisEnd: '2030-12-31',
      recommendation: 'CONDITIONAL GO',
      policyNotes:
        'Rekomendacja: CONDITIONAL GO — warunek: potwierdzony wolumen 2 zmian przez 2 kolejne kwartały. (Rekomendacja nie ma dziś własnego pola w schemacie — patrz KROK_0 mapowania P7K.)',
      requiredMetrics: ['roi', 'npv', 'irr', 'payback'],
      baseline: {
        measured: 1_240_000,
        unit: 'PLN',
        asOf: '2025-12-31',
        notes: 'Roczny koszt spawania ręcznego (robocizna + przeróbki) w gnieździe nr 3, rok 2025.',
      },
      assumptions: [
        ['volume', 'Wolumen detali spawanych rocznie', 'szt.', 78000, 62000, 88000, 'medium', 'Plan sprzedaży 2027 + historia 2024-2025'],
        ['labour', 'Stawka godzinowa spawacza z narzutami', 'PLN/h', 96, 92, 112, 'high', 'Dział kadr, tabela stawek 2026'],
        ['contingency', 'Rezerwa na integrację (zawarta w CAPEX)', '%', 10, 10, 15, 'medium', 'Doświadczenie z wdrożenia linii montażu'],
        ['working_capital', 'ΔNWC — wzrost zapasu części zamiennych', 'PLN', 80000, 60000, 120000, 'medium', 'Lista części krytycznych robota'],
        ['opex', 'Przyrostowy OPEX (serwis, media, osprzęt)', 'PLN/rok', 45000, 38000, 62000, 'medium', 'Oferta serwisowa integratora'],
        ['ramp_up', 'Czas dojścia do pełnej wydajności', 'tyg.', 8, 8, 14, 'low', 'Założenie integratora — nie potwierdzone u nas'],
      ],
      costLines: [
        ['capex', 'Robot spawalniczy z osprzętem i integracją', 'Robot, pozycjoner, ogrodzenie, integracja i uruchomienie', 909_000, 'PLN', 'one_time'],
        ['contingency', 'Rezerwa 10% na integrację', 'Rezerwa ujęta w CAPEX 1 000 000 zł', 91_000, 'PLN', 'one_time'],
      ],
      benefitLines: [
        ['labour_savings', 'Redukcja pracochłonności spawania', 'Hard — 2 etaty spawacza przesunięte na obsługę gniazda', true, 260_000, 'PLN', 'recurring'],
        ['quality_cost_avoided', 'Uniknięty koszt przeróbek i reklamacji', 'Avoided — spadek udziału przeróbek z 6,1% do 1,8%', true, 90_000, 'PLN', 'recurring'],
        ['capacity', 'Odzyskana zdolność produkcyjna gniazda', 'Hard — dodatkowa zmiana bez rozbudowy hali', true, 50_000, 'PLN', 'recurring'],
      ],
      scenarios: [
        ['downside', 'Wolniejszy ramp-up', 'Pełna wydajność dopiero po 14 tygodniach, korzyści przesunięte o kwartał'],
        ['upside', 'Druga zmiana od stycznia', 'Wolumen 88 tys. detali i pełne obłożenie gniazda od początku 2027'],
      ],
      run: {
        totalCosts: 1_000_000,
        totalBenefits: 2_000_000,
        simpleRoi: 1,
        npv: 516_315,
        irrPct: 28.7,
        irrStatus: 'computed',
        paybackPeriods: 2.5,
        discountedPaybackPeriods: 3.1,
        benefitCostRatio: 2,
      },
    }),
    mk('system-wizyjny-kontroli-jakosci', {
      initiativeName: 'System wizyjny kontroli jakości',
      title: 'System wizyjny kontroli jakości',
      status: 'draft',
      ownerUserId: owners[1 % owners.length]!,
      analysisStart: '2026-01-01',
      analysisEnd: '2028-12-31',
      recommendation: 'GO',
      policyNotes:
        'Rekomendacja: GO. Polityka wyliczeń wymaga ROI i Payback; NPV/IRR nie są liczone dla horyzontu 3-letniego. (Rekomendacja nie ma dziś własnego pola w schemacie.)',
      requiredMetrics: ['roi', 'payback'],
      baseline: {
        measured: 412_000,
        unit: 'PLN',
        asOf: '2025-12-31',
        notes: 'Roczny koszt reklamacji jakościowych i kontroli końcowej, rok 2025.',
      },
      assumptions: [
        ['detection', 'Skuteczność detekcji wad przez system', '%', 97, 92, 99, 'medium', 'Testy pilotażowe dostawcy na naszych detalach'],
        ['false_reject', 'Udział fałszywych odrzutów', '%', 2, 2, 6, 'medium', 'Pilotaż — 3 tygodnie na linii montażu'],
        ['claims', 'Wartość reklamacji możliwa do uniknięcia', 'PLN/rok', 150000, 110000, 190000, 'high', 'Rejestr reklamacji 2024-2025'],
      ],
      costLines: [
        ['capex', 'Kamery, oświetlenie, stanowiska kontrolne', 'Dwa stanowiska wizyjne na linii montażu', 563_600, 'PLN', 'one_time'],
        ['contingency', 'Rezerwa 10%', 'Rezerwa ujęta w CAPEX 620 000 zł', 56_400, 'PLN', 'one_time'],
      ],
      benefitLines: [
        ['quality_cost_avoided', 'Uniknięte reklamacje jakościowe', 'Avoided — wady wykrywane przed wysyłką', true, 150_000, 'PLN', 'recurring'],
        ['labour_savings', 'Redukcja kontroli końcowej', 'Hard — 1 etat kontroli wizualnej', true, 88_000, 'PLN', 'recurring'],
      ],
      scenarios: [
        ['downside', 'Wysoki poziom fałszywych odrzutów', 'Fałszywe odrzuty 6% — część korzyści zjedzona przez ponowną kontrolę'],
        ['upside', 'Rozszerzenie na trzecią linię', 'Ten sam sprzęt obsługuje dodatkową rodzinę wyrobów'],
      ],
      run: {
        totalCosts: 620_000,
        totalBenefits: 714_000,
        simpleRoi: 0.1516,
        npv: null,
        irrPct: null,
        irrStatus: 'not_required_by_policy',
        paybackPeriods: 2.6,
        discountedPaybackPeriods: null,
        benefitCostRatio: 1.15,
      },
    }),
    mk('automatyzacja-magazynu-wip', {
      initiativeName: 'Automatyzacja magazynu WIP',
      title: 'Automatyzacja magazynu WIP',
      status: 'draft',
      ownerUserId: owners[2 % owners.length]!,
      analysisStart: '2027-01-01',
      analysisEnd: '2031-12-31',
      recommendation: null,
      policyNotes:
        'Analiza w fazie założeń — model wariantu RaaS nie jest jeszcze policzony, dlatego CAPEX, korzyść, ROI, Payback, NPV i IRR pozostają puste („—"), a nie zerowe.',
      requiredMetrics: ['roi', 'npv', 'payback'],
      baseline: {
        measured: 18,
        unit: 'dni',
        asOf: '2026-08-31',
        notes: 'Średnia rotacja WIP w dniach — punkt odniesienia przed automatyzacją.',
      },
      assumptions: [
        ['wip_rotation', 'Rotacja WIP po automatyzacji', 'dni', 11, 14, 9, 'low', 'Szacunek własny — brak danych z rynku'],
        ['raas_fee', 'Miesięczna opłata w modelu RaaS', 'PLN/mies.', 42000, 52000, 36000, 'low', 'Wstępna rozmowa z dwoma dostawcami'],
        ['space', 'Odzyskana powierzchnia magazynowa', 'm2', 320, 240, 400, 'low', 'Rzut hali — wariant wstępny'],
      ],
      costLines: [],
      benefitLines: [],
      scenarios: [['downside', 'Model RaaS bez gwarancji dostępności', 'Ryzyko przestoju bez SLA po stronie dostawcy']],
      run: null,
    }),
  ];
}

// ==========================================
// Warstwa bazy
// ==========================================

export interface ResolvedOrg {
  id: string;
  name: string;
}

export interface SeedContext {
  org: ResolvedOrg;
  owners: string[];
  ownerNames: string[];
  actorUserId: string;
  policies: { kpi: PolicyRef; okr: PolicyRef; roi: PolicyRef };
  okrProgramId: string;
  okrPolicyVersionId: string;
}

interface PolicyRef {
  policyId: string;
  visibilityMode: string;
  created: boolean;
}

export class SeedStopError extends Error {}

export async function resolveOrganization(client: PoolClient, needle: string): Promise<ResolvedOrg> {
  const exact = await client.query<{ id: string; name: string }>(
    `SELECT id, name FROM organizations WHERE id = $1 OR lower(name) = lower($1)`,
    [needle]
  );
  if (exact.rows.length === 1) return exact.rows[0]!;
  if (exact.rows.length > 1) {
    throw new SeedStopError(
      `STOP: dopasowanie „${needle}" jest niejednoznaczne — ${exact.rows.map((r) => `${r.name} (${r.id})`).join(', ')}`
    );
  }
  const fuzzy = await client.query<{ id: string; name: string; users: string }>(
    `SELECT o.id, o.name, (SELECT count(*)::text FROM users u WHERE u.organization_id = o.id) AS users
       FROM organizations o WHERE o.name ILIKE '%' || $1 || '%' ORDER BY o.name`,
    [needle]
  );
  if (fuzzy.rows.length === 1) return { id: fuzzy.rows[0]!.id, name: fuzzy.rows[0]!.name };
  throw new SeedStopError(
    fuzzy.rows.length === 0
      ? `STOP: nie znalazłem organizacji dla „${needle}".`
      : `STOP: „${needle}" pasuje do ${fuzzy.rows.length} organizacji — podaj dokładną nazwę albo id:\n` +
        fuzzy.rows.map((r) => `  - ${r.name} (${r.id}, użytkowników: ${r.users})`).join('\n')
  );
}

async function resolveOwners(
  client: PoolClient,
  orgId: string
): Promise<{ ids: string[]; names: string[] }> {
  const res = await client.query<{ id: string; name: string; role: string }>(
    `SELECT u.id,
            NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '') AS name,
            m.role
       FROM organization_members m
       JOIN users u ON u.id = m.user_id AND u.organization_id = m.organization_id
      WHERE m.organization_id = $1
        AND m.status = 'ACTIVE'
        AND u.status = 'active'
        AND u.email NOT LIKE '%@consultify.local'
      ORDER BY CASE m.role WHEN 'OWNER' THEN 0 WHEN 'ADMIN' THEN 1 ELSE 2 END, u.created_at`,
    [orgId]
  );
  const ids = res.rows.map((r) => r.id);
  const names = res.rows.map((r) => r.name ?? r.id);
  if (ids.length === 0) {
    throw new SeedStopError(`STOP: organizacja ${orgId} nie ma aktywnych użytkowników — nie ma komu przypisać mierników.`);
  }
  return { ids, names };
}

async function ensurePolicy(
  client: PoolClient,
  orgId: string,
  domain: 'kpi' | 'okr' | 'roi',
  actor: string,
  write: boolean
): Promise<PolicyRef> {
  const existing = await client.query<{ policy_id: string; visibility_mode: string }>(
    `SELECT policy_id, visibility_mode
       FROM rvn_platform_visibility_policies
      WHERE organization_id = $1 AND domain = $2 AND is_active = true
        AND (effective_to IS NULL OR effective_to > now())
      ORDER BY policy_version DESC LIMIT 1`,
    [orgId, domain]
  );
  if (existing.rows[0]) {
    return { policyId: existing.rows[0].policy_id, visibilityMode: existing.rows[0].visibility_mode, created: false };
  }
  const policyId = det(orgId, 'visibility_policy', domain);
  const mode = domain === 'roi' ? 'ROI_GOVERNED' : 'OPEN_ORG';
  if (write) {
    await client.query(
      `INSERT INTO rvn_platform_visibility_policies
         (policy_id, organization_id, domain, policy_version, visibility_mode, allow_narrowing_only, is_active, created_by)
       VALUES ($1, $2, $3, 1, $4, true, true, $5)
       ON CONFLICT (policy_id) DO NOTHING`,
      [policyId, orgId, domain, mode, actor]
    );
    if (domain === 'roi') {
      // Bez wpisu governance tryb ROI_GOVERNED jest zamknięty dla wszystkich.
      await client.query(
        `INSERT INTO rvn_roi_visibility_governance
           (organization_id, published_by, idempotency_key, request_fingerprint)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [
          orgId,
          actor,
          `${SEED_TAG}|roi-governance`,
          crypto.createHash('sha256').update(`${SEED_TAG}|${orgId}|roi-governance`).digest('hex'),
        ]
      );
    }
  }
  return { policyId, visibilityMode: mode, created: true };
}

async function ensureOkrProgram(
  client: PoolClient,
  orgId: string,
  actor: string,
  write: boolean
): Promise<{ programId: string; policyVersionId: string }> {
  const existing = await client.query<{ program_id: string; active_policy_version_id: string | null }>(
    `SELECT program_id, active_policy_version_id FROM okr_vnext_programs
      WHERE organization_id = $1 AND status = 'active' LIMIT 1`,
    [orgId]
  );
  if (existing.rows[0]?.active_policy_version_id) {
    return { programId: existing.rows[0].program_id, policyVersionId: existing.rows[0].active_policy_version_id };
  }
  const programId = existing.rows[0]?.program_id ?? det(orgId, 'okr_program', 'program');
  const policyVersionId = det(orgId, 'okr_policy_version', 'v1');
  if (write) {
    if (!existing.rows[0]) {
      await client.query(
        `INSERT INTO okr_vnext_programs (program_id, organization_id, name, status, created_by)
         VALUES ($1, $2, 'Program OKR zakładu DBR77', 'active', $3)
         ON CONFLICT (program_id) DO NOTHING`,
        [programId, orgId, actor]
      );
    }
    await client.query(
      `INSERT INTO okr_vnext_program_policy_versions
         (policy_version_id, program_id, organization_id, version_number, snapshot, published_by)
       VALUES ($1, $2, $3, 1, $4, $5)
       ON CONFLICT (policy_version_id) DO NOTHING`,
      [policyVersionId, programId, orgId, JSON.stringify({ seed: SEED_TAG, scoringModel: 'zero_to_one' }), actor]
    );
    await client.query(
      `UPDATE okr_vnext_programs SET active_policy_version_id = $1
        WHERE program_id = $2 AND active_policy_version_id IS NULL`,
      [policyVersionId, programId]
    );
  }
  return { programId, policyVersionId };
}

// ==========================================
// Zapis / wycofanie
// ==========================================

export interface SeedCounts {
  kpiDefinitions: number;
  kpiVersions: number;
  kpiMeasurements: number;
  scorecards: number;
  scorecardItems: number;
  okrCycles: number;
  okrSets: number;
  okrObjectives: number;
  okrKeyResults: number;
  okrCheckins: number;
  initiatives: number;
  roiCases: number;
  roiLines: number;
  roiRuns: number;
  visibilityRows: number;
}

const EMPTY_COUNTS = (): SeedCounts => ({
  kpiDefinitions: 0,
  kpiVersions: 0,
  kpiMeasurements: 0,
  scorecards: 0,
  scorecardItems: 0,
  okrCycles: 0,
  okrSets: 0,
  okrObjectives: 0,
  okrKeyResults: 0,
  okrCheckins: 0,
  initiatives: 0,
  roiCases: 0,
  roiLines: 0,
  roiRuns: 0,
  visibilityRows: 0,
});

const NOW = '2026-09-05T06:00:00.000Z';

export interface SeedPlan {
  kpis: PlannedKpi[];
  scorecards: PlannedScorecard[];
  okr: PlannedOkr;
  roi: PlannedRoi[];
}

export function buildPlan(orgId: string, owners: string[], sheetPath?: string): SeedPlan {
  const metrics = readSheetMetrics(sheetPath);
  const kpis = planKpis(orgId, metrics, owners);
  return {
    kpis,
    scorecards: planScorecards(orgId, kpis, owners),
    okr: planOkr(orgId, owners),
    roi: planRoi(orgId, owners),
  };
}

/** Ile wierszy planu JEST już w bazie (po deterministycznych identyfikatorach). */
export async function countExisting(client: PoolClient, ctx: SeedContext, plan: SeedPlan): Promise<SeedCounts> {
  const c = EMPTY_COUNTS();
  const one = async (sql: string, ids: string[]): Promise<number> => {
    if (ids.length === 0) return 0;
    const res = await client.query<{ n: string }>(sql, [ids]);
    return Number(res.rows[0]?.n ?? 0);
  };
  c.kpiDefinitions = await one(`SELECT count(*)::text n FROM rvn_kpi_definitions WHERE kpi_id = ANY($1::uuid[])`, plan.kpis.map((k) => k.kpiId));
  c.kpiVersions = await one(`SELECT count(*)::text n FROM rvn_kpi_definition_versions WHERE definition_version_id = ANY($1::uuid[])`, plan.kpis.map((k) => k.versionId));
  c.kpiMeasurements = await one(
    `SELECT count(*)::text n FROM rvn_kpi_measurements WHERE measurement_id = ANY($1::uuid[])`,
    plan.kpis.flatMap((k) => k.measurements.map((m) => m.measurementId))
  );
  c.scorecards = await one(`SELECT count(*)::text n FROM rvn_kpi_scorecards WHERE scorecard_id = ANY($1::uuid[])`, plan.scorecards.map((s) => s.scorecardId));
  c.scorecardItems = await one(`SELECT count(*)::text n FROM rvn_kpi_scorecard_items WHERE item_id = ANY($1::uuid[])`, plan.scorecards.flatMap((s) => s.items.map((i) => i.itemId)));
  c.okrCycles = await one(`SELECT count(*)::text n FROM okr_vnext_cycles WHERE cycle_id = ANY($1::uuid[])`, plan.okr.cycles.map((x) => x.cycleId));
  c.okrSets = await one(`SELECT count(*)::text n FROM okr_vnext_sets WHERE set_id = ANY($1::uuid[])`, plan.okr.sets.map((s) => s.setId));
  c.okrObjectives = await one(`SELECT count(*)::text n FROM okr_vnext_objectives WHERE objective_id = ANY($1::uuid[])`, plan.okr.sets.flatMap((s) => s.objectives.map((o) => o.objectiveId)));
  c.okrKeyResults = await one(`SELECT count(*)::text n FROM okr_vnext_key_results WHERE key_result_id = ANY($1::uuid[])`, plan.okr.sets.flatMap((s) => s.objectives.flatMap((o) => o.keyResults.map((k) => k.keyResultId))));
  c.okrCheckins = await one(
    `SELECT count(*)::text n FROM okr_vnext_checkins WHERE checkin_id = ANY($1::uuid[])`,
    plan.okr.sets.flatMap((s) => s.objectives.flatMap((o) => o.keyResults.map((k) => det(ctx.org.id, 'okr_checkin', k.keyResultId))))
  );
  c.initiatives = Number(
    (
      await client.query<{ n: string }>(
        `SELECT count(*)::text n FROM initiatives WHERE organization_id = $1 AND id = ANY($2::text[])`,
        [ctx.org.id, plan.roi.map((r) => r.initiativeId)]
      )
    ).rows[0]?.n ?? 0
  );
  c.roiCases = await one(`SELECT count(*)::text n FROM rvn_roi_cases WHERE case_id = ANY($1::uuid[])`, plan.roi.map((r) => r.caseId));
  c.roiLines =
    (await one(`SELECT count(*)::text n FROM rvn_roi_cost_lines WHERE case_id = ANY($1::uuid[])`, plan.roi.map((r) => r.caseId))) +
    (await one(`SELECT count(*)::text n FROM rvn_roi_benefit_lines WHERE case_id = ANY($1::uuid[])`, plan.roi.map((r) => r.caseId)));
  c.roiRuns = await one(`SELECT count(*)::text n FROM rvn_roi_calculation_runs WHERE run_id = ANY($1::uuid[])`, plan.roi.filter((r) => r.run).map((r) => det(ctx.org.id, 'roi_run', r.key)));
  c.visibilityRows = Number(
    (
      await client.query<{ n: string }>(
        `SELECT count(*)::text n FROM rvn_platform_resource_visibility WHERE organization_id = $1 AND resource_id = ANY($2::text[])`,
        [
          ctx.org.id,
          [
            ...plan.kpis.map((k) => k.kpiId),
            ...plan.scorecards.map((s) => s.scorecardId),
            ...plan.okr.sets.map((s) => s.setId),
            ...plan.roi.map((r) => r.caseId),
          ],
        ]
      )
    ).rows[0]?.n ?? 0
  );
  return c;
}

export function plannedCounts(ctx: SeedContext, plan: SeedPlan): SeedCounts {
  void ctx;
  return {
    kpiDefinitions: plan.kpis.length,
    kpiVersions: plan.kpis.length,
    kpiMeasurements: plan.kpis.reduce((a, k) => a + k.measurements.length, 0),
    scorecards: plan.scorecards.length,
    scorecardItems: plan.scorecards.reduce((a, s) => a + s.items.length, 0),
    okrCycles: plan.okr.cycles.length,
    okrSets: plan.okr.sets.length,
    okrObjectives: plan.okr.sets.reduce((a, s) => a + s.objectives.length, 0),
    okrKeyResults: plan.okr.sets.reduce((a, s) => a + s.objectives.reduce((b, o) => b + o.keyResults.length, 0), 0),
    okrCheckins: plan.okr.sets.reduce((a, s) => a + s.objectives.reduce((b, o) => b + o.keyResults.length, 0), 0),
    initiatives: plan.roi.length,
    roiCases: plan.roi.length,
    roiLines: plan.roi.reduce((a, r) => a + r.costLines.length + r.benefitLines.length, 0),
    roiRuns: plan.roi.filter((r) => r.run).length,
    visibilityRows: plan.kpis.length + plan.scorecards.length + plan.okr.sets.length + plan.roi.length,
  };
}

export async function applySeed(client: PoolClient, ctx: SeedContext, plan: SeedPlan): Promise<void> {
  const org = ctx.org.id;
  const actor = ctx.actorUserId;

  // --- KPI: definicja + wersja + widoczność + pomiary ---
  for (const k of plan.kpis) {
    await client.query(
      `INSERT INTO rvn_kpi_definitions
         (kpi_id, organization_id, kpi_code, status, owner_user_id, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,'active',$4,$5,$6,$6)
       ON CONFLICT (kpi_id) DO NOTHING`,
      [k.kpiId, org, k.code, k.ownerUserId, actor, NOW]
    );
    await client.query(
      `INSERT INTO rvn_kpi_definition_versions
         (definition_version_id, kpi_id, organization_id, version_number, name, description, unit,
          target_geometry, target_value, warning_low, warning_high, critical_low, critical_high,
          formula_text, approval_status, effective_from, measurement_frequency_days,
          created_by, submitted_by, submitted_at, approved_by, approved_at, created_at, updated_at)
       VALUES ($1,$2,$3,1,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'approved',$14,$15,$16,$16,$14,$16,$14,$14,$14)
       ON CONFLICT (definition_version_id) DO NOTHING`,
      [
        k.versionId, k.kpiId, org, k.sheet.name, k.sheet.definicja || null, k.unit,
        k.geometry, k.target, k.warningLow, k.warningHigh, k.criticalLow, k.criticalHigh,
        k.sheet.metoda || null, NOW, k.frequencyDays, actor,
      ]
    );
    await client.query(
      `UPDATE rvn_kpi_definitions SET current_definition_version_id = $1
        WHERE kpi_id = $2 AND current_definition_version_id IS NULL`,
      [k.versionId, k.kpiId]
    );
    await client.query(
      `INSERT INTO rvn_platform_resource_visibility
         (resource_type, resource_id, organization_id, visibility_mode, policy_id, owner_user_id)
       VALUES ('kpi',$1,$2,$3,$4,$5)
       ON CONFLICT (resource_type, resource_id) DO NOTHING`,
      [k.kpiId, org, ctx.policies.kpi.visibilityMode, ctx.policies.kpi.policyId, k.ownerUserId]
    );
    for (const m of k.measurements) {
      await client.query(
        `INSERT INTO rvn_kpi_measurements
           (measurement_id, kpi_id, definition_version_id, organization_id, period_start, period_end,
            actual_value, performance_status, data_quality_status, source, evidence_refs, notes,
            recorded_by, recorded_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (measurement_id) DO NOTHING`,
        [
          m.measurementId, k.kpiId, k.versionId, org, m.periodStart, m.periodEnd,
          m.actual, m.status, m.quality, SEED_TAG,
          // CEL per okres nie ma dziś własnej kolumny — zapisany jawnie i
          // rozpoznawalnie, żeby dało się go później przenieść do właściwego pola.
          JSON.stringify([{ kind: 'seed_period_target', seed: SEED_TAG, targetValue: m.periodTarget, unit: k.unit }]),
          `CEL ${m.periodTarget}${k.unit ? ` ${k.unit}` : ''} · Rezultat ${m.actual}${k.unit ? ` ${k.unit}` : ''}`,
          k.ownerUserId, `${m.periodEnd}T18:00:00.000Z`,
        ]
      );
    }
  }

  // --- Raporty KPI ---
  for (const s of plan.scorecards) {
    await client.query(
      `INSERT INTO rvn_kpi_scorecards
         (scorecard_id, organization_id, name, description, scope_type, scope_id, owner_user_id,
          review_frequency, lifecycle_status, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active',$9,$10,$10)
       ON CONFLICT (scorecard_id) DO NOTHING`,
      [s.scorecardId, org, s.name, s.description, s.scopeType, s.scopeId, s.ownerUserId, s.reviewFrequency, actor, NOW]
    );
    await client.query(
      `INSERT INTO rvn_platform_resource_visibility
         (resource_type, resource_id, organization_id, visibility_mode, policy_id, owner_user_id)
       VALUES ('kpi_scorecard',$1,$2,$3,$4,$5)
       ON CONFLICT (resource_type, resource_id) DO NOTHING`,
      [s.scorecardId, org, ctx.policies.kpi.visibilityMode, ctx.policies.kpi.policyId, s.ownerUserId]
    );
    for (const item of s.items) {
      await client.query(
        `INSERT INTO rvn_kpi_scorecard_items
           (item_id, scorecard_id, kpi_id, organization_id, role, sort_order, display_config, added_by, added_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (item_id) DO NOTHING`,
        [item.itemId, s.scorecardId, item.kpiId, org, item.role, item.sortOrder, JSON.stringify(item.displayConfig), actor, NOW]
      );
    }
  }

  // --- OKR ---
  const cycleIdByKey = new Map<string, string>();
  for (const cyc of plan.okr.cycles as unknown as { cycleId: string; key: string; name: string; start: string; end: string; status: string }[]) {
    cycleIdByKey.set(cyc.key, cyc.cycleId);
    await client.query(
      `INSERT INTO okr_vnext_cycles
         (cycle_id, organization_id, program_id, name, start_date, end_date, draft_open_at,
          submission_due_at, approval_due_at, active_start_at, midcycle_review_at, final_update_due_at,
          review_open_at, reflection_due_at, manager_review_due_at, close_at, status, policy_version_id,
          created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$10,$11,$11,$12,$12,$12,$13,$14,$15,$16,$16)
       ON CONFLICT (cycle_id) DO NOTHING`,
      [
        cyc.cycleId, org, ctx.okrProgramId, cyc.name, cyc.start, cyc.end,
        `${cyc.start}T00:00:00.000Z`, `${cyc.start}T00:00:00.000Z`, `${cyc.start}T00:00:00.000Z`,
        `${cyc.end}T00:00:00.000Z`, `${cyc.end}T00:00:00.000Z`, `${cyc.end}T00:00:00.000Z`,
        cyc.status, ctx.okrPolicyVersionId, actor, NOW,
      ]
    );
  }
  for (const occ of plan.okr.occurrences) {
    await client.query(
      `INSERT INTO okr_vnext_checkin_occurrences
         (cadence_occurrence_id, organization_id, cycle_id, window_start, window_end, generated_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (cadence_occurrence_id) DO NOTHING`,
      [occ.occurrenceId, org, cycleIdByKey.get(occ.cycleKey)!, occ.windowStart, occ.windowEnd, SEED_TAG]
    );
  }
  for (const set of plan.okr.sets) {
    await client.query(
      `INSERT INTO okr_vnext_sets
         (set_id, organization_id, program_id, cycle_id, scope_type, scope_id, owner_user_id,
          reviewer_user_id, title, status, current_version, overall_progress, overall_confidence,
          attention_state, last_checkin_at, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',1,$10,$11,$12,$13,$14,$15,$15)
       ON CONFLICT (set_id) DO NOTHING`,
      [
        set.setId, org, ctx.okrProgramId, cycleIdByKey.get(set.cycleKey)!, set.scopeType, set.scopeId,
        set.ownerUserId, set.reviewerUserId, set.title, set.overallProgress, set.overallConfidence,
        set.attentionState, set.lastCheckinAt, actor, NOW,
      ]
    );
    await client.query(
      `INSERT INTO rvn_platform_resource_visibility
         (resource_type, resource_id, organization_id, visibility_mode, policy_id, owner_user_id)
       VALUES ('okr_set',$1,$2,$3,$4,$5)
       ON CONFLICT (resource_type, resource_id) DO NOTHING`,
      [set.setId, org, ctx.policies.okr.visibilityMode, ctx.policies.okr.policyId, set.ownerUserId]
    );
    let sortOrder = 0;
    for (const obj of set.objectives) {
      sortOrder += 1;
      await client.query(
        `INSERT INTO okr_vnext_objectives
           (objective_id, set_id, organization_id, owner_user_id, title, description, ambition_type,
            status, progress, progress_calc_policy_version_id, progress_calc_reason, confidence,
            confidence_calc_policy_version_id, confidence_calc_reason, sort_order, created_by, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8,$9,$10,$11,$9,$12,$13,$14,$15,$15)
         ON CONFLICT (objective_id) DO NOTHING`,
        [
          obj.objectiveId, set.setId, org, obj.ownerUserId, obj.title, obj.description, obj.ambition,
          obj.progress, ctx.okrPolicyVersionId, 'średnia postępu rezultatów kluczowych', obj.confidence,
          'najniższa pewność wśród rezultatów kluczowych', sortOrder, actor, NOW,
        ]
      );
      for (const kr of obj.keyResults as unknown as (PlannedOkr['sets'][number]['objectives'][number]['keyResults'][number] & { progress: number })[]) {
        await client.query(
          `INSERT INTO okr_vnext_key_results
             (key_result_id, objective_id, set_id, organization_id, owner_user_id, title,
              measurement_type, unit, currency, baseline_value, target_value, start_value, current_value,
              direction, progress, progress_calc_policy_version_id, progress_calc_reason, confidence,
              status, source_type, source_reference, created_by, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$10,$12,$13,$14,$15,$16,$17,$18,'manual',$19,$20,$21,$21)
           ON CONFLICT (key_result_id) DO NOTHING`,
          [
            kr.keyResultId, obj.objectiveId, set.setId, org, kr.ownerUserId, kr.title,
            kr.measurementType, kr.unit, kr.currency, kr.start, kr.target, kr.current,
            kr.direction, kr.progress, ctx.okrPolicyVersionId,
            `(${kr.current}−${kr.start})/(${kr.target}−${kr.start})`, kr.confidence, kr.status,
            SEED_TAG, actor, NOW,
          ]
        );
        const occ = plan.okr.occurrences.find((o) => o.cycleKey === set.cycleKey)!;
        await client.query(
          `INSERT INTO okr_vnext_checkins
             (checkin_id, organization_id, key_result_id, objective_id, set_id, cadence_occurrence_id,
              previous_value, new_value, calculated_progress, owner_declared_status, system_suggested_status,
              confidence, note, evidence_refs, submitted_by, submitted_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$11,$12,$13,$14,$15)
           ON CONFLICT (checkin_id) DO NOTHING`,
          [
            det(org, 'okr_checkin', kr.keyResultId), org, kr.keyResultId, obj.objectiveId, set.setId, occ.occurrenceId,
            kr.start, kr.current, kr.progress, kr.status, kr.confidence,
            kr.status === 'on_track'
              ? 'Postęp zgodny z planem — bez zmian w podejściu.'
              : kr.status === 'at_risk'
                ? 'Tempo poniżej planu — wymaga decyzji o priorytetach na najbliższe dwa tygodnie.'
                : kr.status === 'off_track'
                  ? 'Rezultat nie dogoni celu bez zmiany zakresu — temat na przegląd kwartalny.'
                  : 'Prace jeszcze nie ruszyły — czekamy na decyzję o budżecie.',
            JSON.stringify([{ seed: SEED_TAG }]), kr.ownerUserId, set.lastCheckinAt,
          ]
        );
      }
    }
  }

  // --- ROI ---
  for (const r of plan.roi) {
    await client.query(
      `INSERT INTO initiatives (id, organization_id, name, status, area, summary, owner_business_id, created_at, updated_at)
       VALUES ($1,$2,$3,'EXECUTING',$4,$5,$6,$7,$7)
       ON CONFLICT (id) DO NOTHING`,
      [r.initiativeId, org, r.initiativeName, 'Automatyzacja', `Inicjatywa powiązana z analizą ROI „${r.title}".`, r.ownerUserId, NOW]
    );
    await client.query(
      `INSERT INTO rvn_roi_cases
         (case_id, organization_id, initiative_id, title, owner_user_id, status, currency, granularity,
          analysis_start, analysis_end, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,'PLN','annual',$7,$8,$9,$10,$10)
       ON CONFLICT (case_id) DO NOTHING`,
      [r.caseId, org, r.initiativeId, r.title, r.ownerUserId, r.status, r.analysisStart, r.analysisEnd, actor, NOW]
    );
    await client.query(
      `INSERT INTO rvn_platform_resource_visibility
         (resource_type, resource_id, organization_id, visibility_mode, policy_id, owner_user_id)
       VALUES ('roi_case',$1,$2,$3,$4,$5)
       ON CONFLICT (resource_type, resource_id) DO NOTHING`,
      [r.caseId, org, ctx.policies.roi.visibilityMode, ctx.policies.roi.policyId, r.ownerUserId]
    );
    await client.query(
      `INSERT INTO rvn_roi_baselines
         (baseline_id, case_id, organization_id, baseline_period_start, baseline_period_end,
          current_measured_value, current_measured_unit, current_measured_as_of,
          intervention_comparison_notes, source, confidence, owner_user_id, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,'2025-01-01','2025-12-31',$4,$5,$6,$7,$8,'medium',$9,$10,$11,$11)
       ON CONFLICT (baseline_id) DO NOTHING`,
      [
        det(org, 'roi_baseline', r.key), r.caseId, org, r.baseline.measured, r.baseline.unit,
        r.baseline.asOf, r.baseline.notes, SEED_TAG, r.ownerUserId, actor, NOW,
      ]
    );
    await client.query(
      `INSERT INTO rvn_roi_calculation_policy
         (policy_row_id, case_id, organization_id, discount_rate_pct, tax_treatment, inflation_rate_pct,
          rounding_policy, required_metrics, notes, confidence, owner_user_id, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,8,'pre_tax',3,'half_up_2dp',$4,$5,'medium',$6,$7,$8,$8)
       ON CONFLICT (policy_row_id) DO NOTHING`,
      [det(org, 'roi_policy', r.key), r.caseId, org, r.requiredMetrics, r.policyNotes, r.ownerUserId, actor, NOW]
    );
    let n = 0;
    for (const [category, label, unit, base, down, up, confidence, source] of r.assumptions) {
      n += 1;
      await client.query(
        `INSERT INTO rvn_roi_assumptions
           (assumption_id, case_id, organization_id, category, label, unit, base_value, downside_value,
            upside_value, confidence, source, owner_user_id, sensitivity_rank, created_by, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15)
         ON CONFLICT (assumption_id) DO NOTHING`,
        [det(org, 'roi_assumption', `${r.key}|${n}`), r.caseId, org, category, label, unit, base, down, up, confidence, source, r.ownerUserId, n, actor, NOW]
      );
    }
    n = 0;
    for (const [category, label, description, amount, currency, timing] of r.costLines) {
      n += 1;
      await client.query(
        `INSERT INTO rvn_roi_cost_lines
           (cost_line_id, case_id, organization_id, category, label, description, amount, currency,
            timing_type, one_time_period_date, recurrence_start_date, recurrence_end_date, recurrence_cadence,
            confidence, source, owner_user_id, created_by, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'medium',$14,$15,$16,$17,$17)
         ON CONFLICT (cost_line_id) DO NOTHING`,
        [
          det(org, 'roi_cost', `${r.key}|${n}`), r.caseId, org, category, label, description, amount, currency, timing,
          timing === 'one_time' ? r.analysisStart : null,
          timing === 'recurring' ? r.analysisStart : null,
          timing === 'recurring' ? r.analysisEnd : null,
          timing === 'recurring' ? 'annual' : null,
          SEED_TAG, r.ownerUserId, actor, NOW,
        ]
      );
    }
    n = 0;
    for (const [category, label, description, isFinancial, amount, currency, timing] of r.benefitLines) {
      n += 1;
      await client.query(
        `INSERT INTO rvn_roi_benefit_lines
           (benefit_line_id, case_id, organization_id, category, label, description, is_financial, amount,
            currency, timing_type, one_time_period_date, recurrence_start_date, recurrence_end_date,
            recurrence_cadence, confidence, source, owner_user_id, created_by, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'medium',$15,$16,$17,$18,$18)
         ON CONFLICT (benefit_line_id) DO NOTHING`,
        [
          det(org, 'roi_benefit', `${r.key}|${n}`), r.caseId, org, category, label, description, isFinancial, amount, currency, timing,
          timing === 'one_time' ? r.analysisEnd : null,
          timing === 'recurring' ? r.analysisStart : null,
          timing === 'recurring' ? r.analysisEnd : null,
          timing === 'recurring' ? 'annual' : null,
          SEED_TAG, r.ownerUserId, actor, NOW,
        ]
      );
    }
    n = 0;
    for (const [scenarioType, label, description] of r.scenarios) {
      n += 1;
      await client.query(
        `INSERT INTO rvn_roi_scenarios
           (scenario_id, case_id, organization_id, scenario_type, label, description, created_by, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
         ON CONFLICT (scenario_id) DO NOTHING`,
        [det(org, 'roi_scenario', `${r.key}|${n}`), r.caseId, org, scenarioType, label, description, actor, NOW]
      );
    }
    if (r.run) {
      const runId = det(org, 'roi_run', r.key);
      await client.query(
        `INSERT INTO rvn_roi_calculation_runs
           (run_id, case_id, organization_id, engine_version, policy_version_stamp, status, input_snapshot,
            input_hash, total_costs, total_financial_benefits, simple_roi, npv, irr_pct, irr_status,
            payback_periods, discounted_payback_periods, benefit_cost_ratio, period_series, initiated_by,
            started_at, completed_at, created_at)
         VALUES ($1,$2,$3,$4,$5,'completed',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'[]',$17,$18,$18,$18)
         ON CONFLICT (run_id) DO NOTHING`,
        [
          runId, r.caseId, org, 'seed-wyniki-dbr77-v1', 'seed-wyniki-dbr77-policy-v1',
          JSON.stringify({ seed: SEED_TAG, caseKey: r.key, recommendation: r.recommendation }),
          crypto.createHash('sha256').update(`${SEED_TAG}|${r.key}`).digest('hex'),
          r.run.totalCosts, r.run.totalBenefits, r.run.simpleRoi, r.run.npv, r.run.irrPct, r.run.irrStatus,
          r.run.paybackPeriods, r.run.discountedPaybackPeriods, r.run.benefitCostRatio, r.ownerUserId, NOW,
        ]
      );
    }
  }
}

export async function rollbackSeed(client: PoolClient, ctx: SeedContext, plan: SeedPlan): Promise<void> {
  const org = ctx.org.id;
  const caseIds = plan.roi.map((r) => r.caseId);
  const setIds = plan.okr.sets.map((s) => s.setId);
  const objectiveIds = plan.okr.sets.flatMap((s) => s.objectives.map((o) => o.objectiveId));
  const krIds = plan.okr.sets.flatMap((s) => s.objectives.flatMap((o) => o.keyResults.map((k) => k.keyResultId)));
  const kpiIds = plan.kpis.map((k) => k.kpiId);
  const versionIds = plan.kpis.map((k) => k.versionId);

  const del = async (sql: string, params: unknown[]) => {
    await client.query(sql, params);
  };
  // Kolejność odwrotna do zapisu — kasujemy WYŁĄCZNIE deterministyczne id seeda.
  await del(`DELETE FROM rvn_roi_calculation_runs WHERE case_id = ANY($1::uuid[])`, [caseIds]);
  await del(`DELETE FROM rvn_roi_scenarios WHERE case_id = ANY($1::uuid[])`, [caseIds]);
  await del(`DELETE FROM rvn_roi_benefit_lines WHERE case_id = ANY($1::uuid[])`, [caseIds]);
  await del(`DELETE FROM rvn_roi_cost_lines WHERE case_id = ANY($1::uuid[])`, [caseIds]);
  await del(`DELETE FROM rvn_roi_assumptions WHERE case_id = ANY($1::uuid[])`, [caseIds]);
  await del(`DELETE FROM rvn_roi_calculation_policy WHERE case_id = ANY($1::uuid[])`, [caseIds]);
  await del(`DELETE FROM rvn_roi_baselines WHERE case_id = ANY($1::uuid[])`, [caseIds]);
  await del(`DELETE FROM rvn_platform_obligations WHERE reference_type = 'roi_case' AND reference_id = ANY($1::uuid[])`, [caseIds]);
  await del(`DELETE FROM rvn_platform_resource_acl WHERE resource_type = 'roi_case' AND resource_id = ANY($1::text[])`, [caseIds]);
  await del(`DELETE FROM rvn_roi_cases WHERE case_id = ANY($1::uuid[])`, [caseIds]);
  await del(`DELETE FROM initiatives WHERE organization_id = $1 AND id = ANY($2::text[])`, [org, plan.roi.map((r) => r.initiativeId)]);

  await del(`DELETE FROM okr_vnext_checkins WHERE key_result_id = ANY($1::uuid[])`, [krIds]);
  await del(`DELETE FROM okr_vnext_key_results WHERE key_result_id = ANY($1::uuid[])`, [krIds]);
  await del(`DELETE FROM okr_vnext_objectives WHERE objective_id = ANY($1::uuid[])`, [objectiveIds]);
  await del(`DELETE FROM okr_vnext_sets WHERE set_id = ANY($1::uuid[])`, [setIds]);
  await del(`DELETE FROM okr_vnext_checkin_occurrences WHERE cadence_occurrence_id = ANY($1::uuid[])`, [plan.okr.occurrences.map((o) => o.occurrenceId)]);
  await del(`DELETE FROM okr_vnext_cycles WHERE cycle_id = ANY($1::uuid[])`, [plan.okr.cycles.map((c) => c.cycleId)]);

  await del(`DELETE FROM rvn_kpi_scorecard_items WHERE item_id = ANY($1::uuid[])`, [plan.scorecards.flatMap((s) => s.items.map((i) => i.itemId))]);
  await del(`DELETE FROM rvn_kpi_scorecards WHERE scorecard_id = ANY($1::uuid[])`, [plan.scorecards.map((s) => s.scorecardId)]);
  await del(`DELETE FROM rvn_kpi_measurements WHERE measurement_id = ANY($1::uuid[])`, [plan.kpis.flatMap((k) => k.measurements.map((m) => m.measurementId))]);
  await del(`UPDATE rvn_kpi_definitions SET current_definition_version_id = NULL WHERE kpi_id = ANY($1::uuid[])`, [kpiIds]);
  await del(`DELETE FROM rvn_kpi_definition_versions WHERE definition_version_id = ANY($1::uuid[])`, [versionIds]);
  await del(`DELETE FROM rvn_kpi_definitions WHERE kpi_id = ANY($1::uuid[])`, [kpiIds]);

  await del(
    `DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1 AND resource_id = ANY($2::text[])`,
    [org, [...kpiIds, ...plan.scorecards.map((s) => s.scorecardId), ...setIds, ...caseIds]]
  );
}

// ==========================================
// CLI
// ==========================================

export async function buildContext(
  client: PoolClient,
  orgNeedle: string,
  write: boolean
): Promise<SeedContext> {
  const org = await resolveOrganization(client, orgNeedle);
  const { ids, names } = await resolveOwners(client, org.id);
  const actorUserId = ids[0]!;
  const policies = {
    kpi: await ensurePolicy(client, org.id, 'kpi', actorUserId, write),
    okr: await ensurePolicy(client, org.id, 'okr', actorUserId, write),
    roi: await ensurePolicy(client, org.id, 'roi', actorUserId, write),
  };
  const program = await ensureOkrProgram(client, org.id, actorUserId, write);
  return {
    org,
    owners: ids,
    ownerNames: names,
    actorUserId,
    policies,
    okrProgramId: program.programId,
    okrPolicyVersionId: program.policyVersionId,
  };
}

function formatCounts(label: string, c: SeedCounts): string {
  return [
    `${label}:`,
    `  mierniki KPI              ${c.kpiDefinitions} (wersje: ${c.kpiVersions})`,
    `  pomiary KPI               ${c.kpiMeasurements}`,
    `  raporty KPI               ${c.scorecards} (pozycje: ${c.scorecardItems})`,
    `  cykle OKR                 ${c.okrCycles}`,
    `  zestawy OKR               ${c.okrSets}`,
    `  cele OKR                  ${c.okrObjectives}`,
    `  rezultaty kluczowe OKR    ${c.okrKeyResults}`,
    `  check-iny OKR             ${c.okrCheckins}`,
    `  inicjatywy (pod ROI)      ${c.initiatives}`,
    `  analizy ROI               ${c.roiCases}`,
    `  pozycje kosztów/korzyści  ${c.roiLines}`,
    `  przebiegi wyliczeń ROI    ${c.roiRuns}`,
    `  wpisy widoczności         ${c.visibilityRows}`,
  ].join('\n');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const argOf = (name: string): string | undefined => {
    const hit = args.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : undefined;
  };
  const mode = args.includes('--rollback')
    ? 'rollback'
    : args.includes('--apply')
      ? 'apply'
      : 'dry-run';
  const orgNeedle = argOf('org') ?? 'DBR77';
  const databaseUrl = argOf('database-url') ?? process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('Brak DATABASE_URL (albo --database-url=...)');

  const pool = new Pool({
    connectionString: databaseUrl,
    // SSL tylko gdy adres wprost o nie prosi — proxy Railway (`*.proxy.rlwy.net`)
    // nie obsługuje SSL i połączenie z domyślnym `ssl:true` się wywala.
    ssl: /sslmode=require|sslmode=verify/.test(databaseUrl) ? { rejectUnauthorized: false } : undefined,
    max: 2,
  });
  const client = await pool.connect();
  try {
    const ctx = await buildContext(client, orgNeedle, false);
    const plan = buildPlan(ctx.org.id, ctx.owners);
    const before = await countExisting(client, ctx, plan);
    const planned = plannedCounts(ctx, plan);

    process.stdout.write(`\n=== SEED WYNIKI · DBR77 ===\nTag: ${SEED_TAG}\nTryb: ${mode}\n`);
    process.stdout.write(`Organizacja: ${ctx.org.name} (${ctx.org.id})\n`);
    process.stdout.write(`Właściciele (${ctx.owners.length}): ${ctx.ownerNames.join(', ')}\n`);
    process.stdout.write(
      `Polityki widoczności: kpi=${ctx.policies.kpi.visibilityMode}${ctx.policies.kpi.created ? ' (do utworzenia)' : ''}, ` +
        `okr=${ctx.policies.okr.visibilityMode}${ctx.policies.okr.created ? ' (do utworzenia)' : ''}, ` +
        `roi=${ctx.policies.roi.visibilityMode}${ctx.policies.roi.created ? ' (do utworzenia)' : ''}\n\n`
    );
    process.stdout.write(`${formatCounts('PLAN (docelowo)', planned)}\n\n`);
    process.stdout.write(`${formatCounts('JUŻ W BAZIE (wiersze tego seeda)', before)}\n\n`);

    const refDistribution = plan.kpis.reduce(
      (acc, k) => {
        const ref = k.measurements[REFERENCE_MONTH_INDEX];
        if (!ref) acc.brak += 1;
        else if (ref.status === 'on_target') acc.wNormie += 1;
        else if (ref.status === 'warning') acc.ostrzezenie += 1;
        else if (ref.status === 'critical') acc.krytyczne += 1;
        else acc.brak += 1;
        return acc;
      },
      { wNormie: 0, ostrzezenie: 0, krytyczne: 0, brak: 0 }
    );
    process.stdout.write(
      `Rozkład stanów raportu głównego (miesiąc odniesienia VIII 2026): ` +
        `${refDistribution.wNormie} w normie / ${refDistribution.ostrzezenie} ostrzeżenie / ` +
        `${refDistribution.krytyczne} krytyczne / ${refDistribution.brak} brak danych\n\n`
    );

    if (mode === 'dry-run') {
      process.stdout.write('Tryb --dry-run: nic nie zapisano.\n');
      return;
    }

    await client.query('BEGIN');
    if (mode === 'apply') {
      await buildContext(client, orgNeedle, true);
      await applySeed(client, ctx, plan);
    } else {
      await rollbackSeed(client, ctx, plan);
    }
    await client.query('COMMIT');

    const after = await countExisting(client, ctx, plan);
    process.stdout.write(`${formatCounts(mode === 'apply' ? 'PO ZAPISIE' : 'PO WYCOFANIU', after)}\n`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    if (err instanceof SeedStopError) {
      process.stderr.write(`\n${err.message}\n`);
      process.exitCode = 2;
      return;
    }
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

const invokedDirectly = process.argv[1] ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (invokedDirectly) {
  main().catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exit(1);
  });
}
