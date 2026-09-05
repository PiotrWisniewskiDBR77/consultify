/**
 * SEED FINANSÓW — Grupa Kapitałowa CD PROJEKT, skonsolidowane sprawozdanie za 2025 r.
 * (z danymi porównawczymi 2024).
 *
 * DLACZEGO ISTNIEJE. Polecenie właściciela (05.09.2026): moduł Finanse ma na stagingu pokazywać
 * JEDNO prawdziwe sprawozdanie realnej spółki giełdowej, a wszystkie pozostałe pakiety i przykłady
 * mają zniknąć. Do tej pory Finanse na stagingu miały 5 pustych pakietów kanonicznych DRAFT
 * (0 jednostek / 0 okresów / 0 linii), pakiet backfillu DBR77 i legacy sprawozdania czterech
 * przypadkowych firm (Tesla, Tesco, Apator, DBR77) — patrz `evidence/finanse-fm5-20260905/RAPORT.md`.
 *
 * ŹRÓDŁO DANYCH. `server/scripts/data/cdprojekt-2025.json` — 146 pozycji przepisanych RĘCZNIE
 * z PDF `docs/modules/08_finanse/zalaczniki/CD_PROJEKT_skonsolidowane_2025.pdf` (str. 5 RZiS,
 * str. 6 całkowite dochody, str. 7-8 sytuacja finansowa, str. 10-11 przepływy, Nota 4 str. 29,
 * Nota 5 str. 30). Kwoty w tys. PLN. Trzy pozycje są WYLICZONE (EBITDA, FCF, zobowiązania razem)
 * i oznaczone polem `derived` — nie ma ich w PDF, bo MSSF ich nie definiuje; wzór jest zapisany
 * przy pozycji, a nie ukryty w kodzie.
 *
 * DWA TORY, OBA ZAKŁADANE. Moduł Finanse czyta dane z DWÓCH miejsc i oba muszą pokazywać
 * CD PROJEKT, inaczej właściciel zobaczy „tylko CD PROJEKT" na jednej liście i cudze firmy na drugiej:
 *   1. LEGACY (`financial_statement_packs` + `financial_statements` + `financial_statement_values`)
 *      — lista sprawozdań i pakietów w UI. DOKŁADNIE 2 okresy × 3 typy = 6 sprawozdań, bo wzór
 *      `pack_readiness_status` (`financialStatementPackService.ts:163-181`) zapala chip „Gotowe"
 *      wyłącznie przy 2 okresach, komplecie P&L/BS/CF, jednym `entity_name`, jednej walucie,
 *      jednej skali i wszystkich sprawozdaniach `status='confirmed'` + `readiness_status='ready'`.
 *   2. KANONICZNY (`finance_artifacts` → `finance_stmt_lines`) — na nim stoi analiza wskaźnikowa.
 *      Zakładany przez TE SAME serwisy, co import z UI (`createArtifact` →
 *      `financeCalendarService.ensureStatementPackTemporalContext` →
 *      `statementMappingService.mapStatementLines`), zero surowego SQL-a piszącego linie kanoniczne.
 *
 * KOLEJNOŚĆ ZAPISU JEST ISTOTNA (triggery bazy, nie kosmetyka).
 * `mapStatementLines` otwiera własną transakcję na każde wywołanie, a `finance_stmt_lines` ma
 * odroczone triggery sprawdzające przy COMMIT. Dlatego piszemy: FY2024 (P&L → OCI → CF → BS),
 * potem FY2025 (P&L → OCI → CF → BS).
 *   · `finance_stmt_check_balance` — BS musi mieć w JEDNEJ transakcji komplet TOTAL_ASSETS
 *     + TOTAL_LIABILITIES_EQUITY (3 503 320 = 3 503 320 / 3 026 438 = 3 026 438 — spina się).
 *   · `finance_stmt_check_cash_rollforward` — BS FY2025 zamyka się jako ostatni, więc widzi już
 *     zacommitowane: CASH FY2024 (124 886) + NET_CHANGE_CASH FY2025 (-10 771) = CASH FY2025 (114 115).
 *   · `finance_stmt_check_retained_earnings_rollforward` — pozostaje UŚPIONY z konstrukcji, bo
 *     NIE zapisujemy kodu `RETAINED_EARNINGS`. CD PROJEKT prezentuje „Niepodzielony wynik
 *     finansowy" i „Wynik finansowy bieżącego okresu" jako DWIE osobne pozycje kapitału, więc
 *     żadna z nich nie jest „zyskami zatrzymanymi ogółem" w rozumieniu rolki
 *     (opening RE + NET_INCOME − dywidendy = closing RE) — wpisanie którejkolwiek pod ten kod
 *     byłoby fałszem, który trigger słusznie by odrzucił. Idą pod `RETAINED_EARNINGS_PRIOR`
 *     i `RETAINED_EARNINGS_CURRENT`.
 *
 * UŻYCIE:
 *   DATABASE_URL=… npx tsx server/scripts/finance-seed-cdprojekt.ts --dry-run --org=<id>
 *   DATABASE_URL=… npx tsx server/scripts/finance-seed-cdprojekt.ts --apply   --org=<id>
 *   DATABASE_URL=… npx tsx server/scripts/finance-seed-cdprojekt.ts --rollback --org=<id> [--cascade]
 *   DATABASE_URL=… npx tsx server/scripts/finance-seed-cdprojekt.ts --prune-others --dry-run --org=<id>
 *   DATABASE_URL=… npx tsx server/scripts/finance-seed-cdprojekt.ts --prune-others --apply   --org=<id>
 *
 * IDEMPOTENCJA. Klucz naturalny artefaktu = `<tag>:<organizationId>:<entityCode>`
 * (tag domyślny `seed:finance-cdprojekt-2025`). Legacy dostaje deterministyczne id złożone
 * z tego samego tagu i skrótu organizacji. Powtórny `--apply` = 0 NOWYCH wierszy.
 *
 * GRANICE. `--prune-others` NIGDY nie wychodzi poza wskazaną organizację (każde zapytanie ma
 * `organization_id = ?`) i nigdy nie kasuje własnych danych seeda. Produkcja `consultify.ai`
 * ma osobną bazę i ten skrypt jej nie zna.
 */
import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createArtifact,
  type CreateArtifactResult,
} from '../src/services/finance/canonical/artifactVersionService.js';
import {
  ensureStatementPackTemporalContext,
  type EnsuredPeriod,
} from '../src/services/finance/canonical/financeCalendarService.js';
import {
  mapStatementLines,
  type MappedRowResult,
  type MappingRule,
  type RawStatementLine,
  type StatementType,
} from '../src/services/finance/canonical/statementMappingService.js';
import { recomputeStatementPack } from '../src/services/financialStatementPackService.js';
import { withPinnedPostgresTransaction } from '../src/database/PostgresDatabase.js';
import { withPgTransaction } from '../src/utils/queryHelpers.js';

const DEFAULT_TAG = 'seed:finance-cdprojekt-2025';
const ENTITY_NAME = 'Grupa Kapitałowa CD PROJEKT';
const ENTITY_CODE = 'GRUPA_KAPITALOWA_CD_PROJEKT';
const SOURCE_FILE_NAME = 'CD_PROJEKT_skonsolidowane_2025.pdf';
/**
 * Nazwa WIDOCZNA dla właściciela (kolumna `finance_artifacts.display_name`,
 * migracja `20261102_finance_artifact_display_name.sql`). `natural_key` zostaje
 * kluczem idempotencji seeda i NIGDY nie jest tytułem — audyt FIN 2026-09-06
 * defekt #3 pokazał go wprost w nagłówku karty.
 */
const PACK_DISPLAY_NAME =
  'Grupa Kapitałowa CD PROJEKT — skonsolidowane sprawozdanie 2025 (z 2024)';

// ---------------------------------------------------------------------------
// Dane źródłowe
// ---------------------------------------------------------------------------

export type PeriodKey = 'fy2024' | 'fy2025';

export interface SeedPeriod {
  key: string;
  periodStart: string;
  periodEnd: string;
  label: string;
  restated?: boolean;
}

export interface SeedLine {
  key: string;
  section: 'P&L' | 'OCI' | 'BS' | 'CF';
  statementType: StatementType;
  page: number | null;
  level: number;
  fy2025: number;
  fy2024: number;
  code: string | null;
  action?: 'MAP' | 'EXCLUDE';
  excludeKind?: 'ANALYST_DECISION' | 'NO_CANONICAL_TARGET';
  excludeReasonCode?: string;
  pdfLabel?: string;
  derived?: string;
  note?: string;
}

export interface SeedDataset {
  meta: {
    title: string;
    sourcePdf: string;
    entityName: string;
    entityCode: string;
    currency: string;
    unit: 'UNITS' | 'THOUSANDS' | 'MILLIONS' | 'BILLIONS';
    accountingPolicy: string;
    periods: SeedPeriod[];
    [k: string]: unknown;
  };
  controls: Record<string, { fy2025: number; fy2024: number; source: string }>;
  lines: SeedLine[];
}

const HERE = dirname(fileURLToPath(import.meta.url));
/**
 * Ścieżka pliku danych. `CDPROJEKT_DATA_PATH` istnieje WYŁĄCZNIE po to, żeby test mutacyjny mógł
 * podstawić zepsutą kopię danych i udowodnić, że skrypt ODMAWIA zapisu — nie jest to furtka
 * do wgrywania dowolnych liczb na staging (i tak przechodzą przez `verifyControls`).
 */
export const DATA_PATH = process.env.CDPROJEKT_DATA_PATH || join(HERE, 'data', 'cdprojekt-2025.json');

export function loadDataset(path: string = DATA_PATH): SeedDataset {
  return JSON.parse(readFileSync(path, 'utf8')) as SeedDataset;
}

export interface ControlFailure {
  check: string;
  expected: number;
  actual: number | undefined;
}

/**
 * Kontrole liczbowe na PLIKU DANYCH — te same, które sprawdza test jednostkowy i które skrypt
 * uruchamia PRZED każdym zapisem. Zmiana dowolnej kwoty w JSON-ie wywala co najmniej jedną z nich.
 * To jest bezpiecznik przeciw cichej literówce w przepisywaniu z PDF, nie ozdoba.
 */
export function verifyControls(data: SeedDataset): ControlFailure[] {
  const failures: ControlFailure[] = [];
  const byCode = new Map<string, SeedLine>();
  for (const line of data.lines) if (line.code) byCode.set(line.code, line);
  const val = (code: string, period: PeriodKey): number | undefined => byCode.get(code)?.[period];

  for (const [code, expected] of Object.entries(data.controls)) {
    for (const period of ['fy2025', 'fy2024'] as PeriodKey[]) {
      const actual = val(code, period);
      if (actual !== expected[period]) {
        failures.push({ check: `${code}.${period} = suma kontrolna z PDF`, expected: expected[period], actual });
      }
    }
  }

  for (const period of ['fy2025', 'fy2024'] as PeriodKey[]) {
    const assets = val('TOTAL_ASSETS', period);
    const liabEquity = val('TOTAL_LIABILITIES_EQUITY', period);
    if (assets === undefined || liabEquity === undefined || assets !== liabEquity) {
      failures.push({ check: `bilans spina się (${period}): AKTYWA RAZEM = PASYWA RAZEM`, expected: assets ?? NaN, actual: liabEquity });
    }
    const equity = val('EQUITY', period);
    const liabilities = val('TOTAL_LIABILITIES', period);
    if (equity === undefined || liabilities === undefined || equity + liabilities !== liabEquity) {
      failures.push({ check: `pasywa (${period}): kapitał własny + zobowiązania = PASYWA RAZEM`, expected: liabEquity ?? NaN, actual: (equity ?? NaN) + (liabilities ?? NaN) });
    }
    const opening = val('OPENING_CASH', period);
    const net = val('NET_CHANGE_CASH', period);
    const closing = val('CLOSING_CASH', period);
    if (opening === undefined || net === undefined || closing === undefined || opening + net !== closing) {
      failures.push({ check: `rolka gotówki (${period}): stan początkowy + zmiana = stan końcowy`, expected: closing ?? NaN, actual: (opening ?? NaN) + (net ?? NaN) });
    }
    const cfo = val('CFO', period);
    const cfi = val('CFI', period);
    const cff = val('CFF', period);
    if (cfo === undefined || cfi === undefined || cff === undefined || cfo + cfi + cff !== net) {
      failures.push({ check: `przepływy razem (${period}): operacyjne + inwestycyjne + finansowe`, expected: net ?? NaN, actual: (cfo ?? NaN) + (cfi ?? NaN) + (cff ?? NaN) });
    }
    if (val('CASH', period) !== closing) {
      failures.push({ check: `gotówka bilansowa = stan końcowy z przepływów (${period})`, expected: closing ?? NaN, actual: val('CASH', period) });
    }
    const revenue = val('REVENUE', period);
    const cogs = val('COGS', period);
    const gross = val('GROSS_MARGIN', period);
    if (revenue === undefined || cogs === undefined || gross === undefined || revenue - cogs !== gross) {
      failures.push({ check: `zysk brutto na sprzedaży (${period}): przychody − koszt własny`, expected: gross ?? NaN, actual: (revenue ?? NaN) - (cogs ?? NaN) });
    }
    const netContinuing = val('NET_CONTINUING', period);
    const netIncome = val('NET_INCOME', period);
    const discontinued = data.lines.find((l) => l.key === 'Zysk netto z działalności zaniechanej')?.[period];
    if (netContinuing === undefined || netIncome === undefined || discontinued === undefined || netContinuing + discontinued !== netIncome) {
      failures.push({ check: `zysk netto (${period}): kontynuowana + zaniechana`, expected: netIncome ?? NaN, actual: (netContinuing ?? NaN) + (discontinued ?? NaN) });
    }
  }

  // Pozycje wyliczone — sprawdzamy, że wzór z pola `derived` daje właśnie tę liczbę.
  const dep = (period: PeriodKey) =>
    (val('OPERATING_DEPRECIATION_PPE', period) ?? NaN) + (val('OPERATING_DEPRECIATION_INTANGIBLES', period) ?? NaN);
  for (const period of ['fy2025', 'fy2024'] as PeriodKey[]) {
    const ebitda = (val('EBIT', period) ?? NaN) + dep(period);
    if (val('EBITDA', period) !== ebitda) {
      failures.push({ check: `EBITDA wyliczona (${period}) = EBIT + amortyzacja`, expected: ebitda, actual: val('EBITDA', period) });
    }
    const capex =
      (val('CAPEX', period) ?? NaN) +
      (val('CAPEX_INTANGIBLES', period) ?? NaN) +
      (data.lines.find((l) => l.key === 'Nakłady na wartości niematerialne')?.[period] ?? NaN);
    const fcf = (val('CFO', period) ?? NaN) - capex;
    if (val('FCF', period) !== fcf) {
      failures.push({ check: `FCF wyliczony (${period}) = CFO − nakłady inwestycyjne`, expected: fcf, actual: val('FCF', period) });
    }
  }

  return failures;
}

/** Kody kanoniczne, których żąda katalog wskaźników P0 (18 pozycji) — bez nich analiza jest pusta. */
export const P0_REQUIRED_LINE_CODES = [
  'CURRENT_ASSETS', 'CURRENT_LIABILITIES', 'INVENTORY', 'CASH', 'GROSS_MARGIN', 'REVENUE',
  'EBITDA', 'NET_INCOME', 'LONG_TERM_DEBT', 'EQUITY', 'EBIT', 'INTEREST_EXPENSE', 'AR',
  'COGS', 'AP', 'CFO', 'FCF', 'TOTAL_ASSETS',
] as const;

// ---------------------------------------------------------------------------
// Pomocnicze
// ---------------------------------------------------------------------------

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  const eq = hit.indexOf('=');
  return eq === -1 ? '' : hit.slice(eq + 1);
}


export interface LegacyIds {
  packId: string;
  statementId(type: StatementType, year: number): string;
}

export function legacyIds(organizationId: string, tag: string): LegacyIds {
  const slug = `${createHash('sha1').update(`${tag}:${organizationId}`).digest('hex').slice(0, 10)}`;
  const typeSlug = (type: StatementType) => (type === 'P&L' ? 'pl' : type === 'BS' ? 'bs' : 'cf');
  return {
    packId: `cdp2025-pack-${slug}`,
    statementId: (type, year) => `cdp2025-${typeSlug(type)}-${year}-${slug}`,
  };
}

async function resolveOrganization(needle: string): Promise<{ id: string; name: string } | null> {
  return withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ id: string; name: string }>(
      `SELECT id, name FROM organizations
        WHERE id = ? OR name ILIKE ?
        ORDER BY (id = ?) DESC, length(name)
        LIMIT 1`,
      [needle, `%${needle}%`, needle]
    )
  );
}

async function resolveActor(organizationId: string): Promise<string> {
  const row = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ user_id: string }>(
      `SELECT user_id FROM organization_members
        WHERE organization_id = ? AND UPPER(COALESCE(status, 'ACTIVE')) = 'ACTIVE'
        ORDER BY CASE UPPER(role) WHEN 'OWNER' THEN 0 WHEN 'ADMIN' THEN 1 ELSE 2 END
        LIMIT 1`,
      [organizationId]
    )
  );
  return row?.user_id ?? 'script:finance-seed-cdprojekt';
}

/** Sekcje w kolejności zapisu — patrz nagłówek („KOLEJNOŚĆ ZAPISU JEST ISTOTNA"). */
const SECTION_ORDER: SeedLine['section'][] = ['P&L', 'OCI', 'CF', 'BS'];

function ruleFor(line: SeedLine): MappingRule {
  if (!line.code || line.action === 'EXCLUDE') {
    return {
      sourceLabel: line.key,
      statementType: line.statementType,
      lineCode: line.code ?? '',
      action: 'EXCLUDE',
      excludeKind: line.excludeKind ?? 'ANALYST_DECISION',
      excludeReasonCode: line.excludeReasonCode ?? 'EXCLUDED_BY_SEED',
    };
  }
  return {
    sourceLabel: line.key,
    statementType: line.statementType,
    lineCode: line.code,
    action: 'MAP',
    consolidationScope: 'CONSOLIDATED',
    signConvention: 'NATURAL',
    accountingPolicy: 'IFRS',
  };
}

function rawLineFor(line: SeedLine, period: PeriodKey, data: SeedDataset): RawStatementLine {
  return {
    lineItem: line.key,
    periodId: '',
    entityCode: '',
    currency: data.meta.currency,
    value: line[period],
    sourceRef: {
      source_document_ref: data.meta.sourcePdf,
      raw_label: line.pdfLabel ?? line.key,
      page: line.page,
      section: line.section,
      derived_formula: line.derived ?? null,
      note: line.note ?? null,
    },
  };
}

function bucketCounts(results: MappedRowResult[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of results) counts[r.bucket] = (counts[r.bucket] || 0) + 1;
  return counts;
}

// ---------------------------------------------------------------------------
// Naprawa taksonomii kanonicznej (mierzona na stagingu, nie założona)
// ---------------------------------------------------------------------------

/**
 * ZNALEZISKO (staging `thomas.proxy.rlwy.net:52567/railway`, 05.09.2026 — zmierzone zapytaniem,
 * nie przepisane z audytu):
 *
 *   SELECT id, statement_type, line_code FROM financial_statement_lines
 *    WHERE id IN ('fsl-pl-gross','fsl-bs-equity','fsl-cf-operating','fsl-cf-fcf');
 *     fsl-pl-gross     | P&L | GROSS_PROFIT      <- migracja 565 deklaruje GROSS_MARGIN
 *     fsl-bs-equity    | BS  | TOTAL_EQUITY      <-                       EQUITY
 *     fsl-cf-operating | CF  | OPERATING_CF      <-                       CFO
 *     fsl-cf-fcf       | CF  | FREE_CASH_FLOW    <-                       FCF
 *
 * PRZYCZYNA: obie migracje taksonomii (`565_kpi_time_series_roi_attribution_finance.sql`
 * i `20261058_finance_statement_canonical_mapping_taxonomy.sql`) wstawiają wiersze
 * `ON CONFLICT (id) DO NOTHING`. Na stagingu te ID-ki istniały WCZEŚNIEJ z innej rodziny nazw,
 * więc obie migracje zameldowały `success` i NIE wstawiły niczego — a katalog wskaźników P0
 * (`20260809_..._d03_analysis_03_kpi_p0_catalog.sql`) żąda dokładnie `GROSS_MARGIN`, `EQUITY`,
 * `CFO`, `FCF`. Efekt: cztery z osiemnastu wskaźników były na stagingu MARTWE od zawsze,
 * a 134 kodów taksonomii, które są na świeżej bazie, na stagingu nie istnieje w ogóle.
 * (To jest z nazwiskiem ta sama „dług taksonomiczny" z `evidence/finanse-fm5-20260905/RAPORT.md`
 * §4 — tam opisany jako obserwacja, tu z przyczyną.)
 *
 * CO ROBIMY: dokładamy BRAKUJĄCE cele mapowania jako globalne wiersze systemowe z własnymi,
 * deterministycznymi ID-kami (`fsl-cdpseed-…`), wyłącznie dla par (typ, kod), których seed
 * realnie używa i których w bazie NIE MA. Tabela nie ma UNIQUE na (statement_type, line_code)
 * — tylko PK na `id` — więc nowy wiersz nie koliduje ze starą rodziną nazw i niczego nie nadpisuje.
 * Idempotentne, addytywne, ZERO nowych migracji (§ zakaz edycji istniejących migracji).
 *
 * CZEGO NIE ROBIMY: nie zmieniamy ani nie kasujemy zastanych wierszy `GROSS_PROFIT`/
 * `TOTAL_EQUITY`/`OPERATING_CF`/`FREE_CASH_FLOW` — wiszą na nich decyzje mapowania starych
 * importów. Uczciwie: po tej naprawie taksonomia ma DWIE rodziny nazw obok siebie i to zostaje
 * jako dług do osobnego dyżuru (migracja uzgadniająca), a nie jest tu po cichu „naprawione".
 */
async function ensureTaxonomyTargets(data: SeedDataset, actorId: string): Promise<{ added: string[]; present: number }> {
  const needed = new Map<string, { statementType: StatementType; lineCode: string }>();
  for (const line of data.lines) {
    if (!line.code || line.action === 'EXCLUDE') continue;
    needed.set(`${line.statementType}::${line.code}`, { statementType: line.statementType, lineCode: line.code });
  }

  const existing = await withPinnedPostgresTransaction((tx) =>
    tx.queryAll<{ statement_type: string; line_code: string }>(
      `SELECT statement_type, line_code FROM financial_statement_lines WHERE organization_id IS NULL`
    )
  );
  const have = new Set(existing.map((r) => `${r.statement_type}::${r.line_code}`));

  const missing = Array.from(needed.entries()).filter(([key]) => !have.has(key));
  if (missing.length === 0) return { added: [], present: needed.size };

  await withPgTransaction(async (tx) => {
    for (const [, target] of missing) {
      const slug = `${target.statementType === 'P&L' ? 'pl' : target.statementType.toLowerCase()}-${target.lineCode.toLowerCase().replace(/_/g, '-')}`;
      await tx.query(
        `INSERT INTO financial_statement_lines (id, statement_type, line_code, line_name, line_name_pl, sort_order, is_system)
         VALUES (?, ?, ?, ?, ?, 9000, TRUE)
         ON CONFLICT (id) DO NOTHING`,
        [`fsl-cdpseed-${slug}`, target.statementType, target.lineCode, target.lineCode, target.lineCode]
      );
    }
  });

  const added = missing.map(([, t]) => `${t.statementType} ${t.lineCode}`);
  console.log(`# Taksonomia kanoniczna: dołożono BRAKUJĄCYCH celów mapowania: ${added.length} (aktor ${actorId})`);
  for (const code of added.slice(0, 20)) console.log(`    + ${code}`);
  if (added.length > 20) console.log(`    … i ${added.length - 20} więcej (pełna lista w raporcie)`);
  return { added, present: needed.size };
}

// ---------------------------------------------------------------------------
// Tor legacy — lista sprawozdań w UI
// ---------------------------------------------------------------------------

interface LegacyPlanStatement {
  id: string;
  statementType: StatementType;
  year: number;
  period: SeedPeriod;
  periodKey: PeriodKey;
  lines: SeedLine[];
}

function planLegacy(data: SeedDataset, ids: LegacyIds): LegacyPlanStatement[] {
  const out: LegacyPlanStatement[] = [];
  for (const period of data.meta.periods) {
    const periodKey = period.key.toLowerCase() as PeriodKey;
    const year = Number(period.periodEnd.slice(0, 4));
    for (const statementType of ['P&L', 'BS', 'CF'] as StatementType[]) {
      const lines = data.lines.filter((l) => l.statementType === statementType);
      out.push({ id: ids.statementId(statementType, year), statementType, year, period, periodKey, lines });
    }
  }
  return out;
}

async function applyLegacy(
  organizationId: string,
  actorId: string,
  data: SeedDataset,
  ids: LegacyIds,
  plan: LegacyPlanStatement[]
): Promise<{ statements: number; values: number; readiness: string | null }> {
  const first = data.meta.periods[0];
  const last = data.meta.periods[data.meta.periods.length - 1];

  await withPgTransaction(async (tx) => {
    await tx.query(
      `INSERT INTO financial_statement_packs
         (id, organization_id, entity_name, period_start, period_end, period_label, currency, scaling,
          pack_status, source_statement_count, version, created_at, updated_at)
       VALUES (?, ?, ?, ?::date, ?::date, ?, ?, 'thousands', 'confirmed', ?, 1, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
         entity_name = EXCLUDED.entity_name, period_start = EXCLUDED.period_start,
         period_end = EXCLUDED.period_end, period_label = EXCLUDED.period_label,
         currency = EXCLUDED.currency, scaling = EXCLUDED.scaling,
         pack_status = EXCLUDED.pack_status,
         source_statement_count = EXCLUDED.source_statement_count, updated_at = NOW()`,
      [
        ids.packId, organizationId, ENTITY_NAME, first.periodStart, last.periodEnd,
        `${first.label}–${last.label}`, data.meta.currency, plan.length,
      ]
    );

    for (const statement of plan) {
      await tx.query(
        `INSERT INTO financial_statements
           (id, organization_id, entity_name, statement_type, period_start, period_end, period_label,
            currency, scaling, source_file_name, parse_method, document_class, overall_confidence,
            validation_status, status, created_by, confirmed_by, confirmed_at, created_at, updated_at,
            statement_pack_id, readiness_score, readiness_status, values_version)
         VALUES (?, ?, ?, ?, ?::date, ?::date, ?, ?, 'thousands', ?, 'manual', 'native_pdf', 1.0,
                 'pass', 'confirmed', ?, ?, NOW(), NOW(), NOW(), ?, 100, 'ready', 1)
         ON CONFLICT (id) DO UPDATE SET
           entity_name = EXCLUDED.entity_name, period_start = EXCLUDED.period_start,
           period_end = EXCLUDED.period_end, period_label = EXCLUDED.period_label,
           currency = EXCLUDED.currency, scaling = EXCLUDED.scaling,
           source_file_name = EXCLUDED.source_file_name, status = EXCLUDED.status,
           readiness_score = EXCLUDED.readiness_score, readiness_status = EXCLUDED.readiness_status,
           statement_pack_id = EXCLUDED.statement_pack_id, updated_at = NOW()`,
        [
          statement.id, organizationId, ENTITY_NAME, statement.statementType,
          statement.period.periodStart, statement.period.periodEnd, statement.period.label,
          data.meta.currency, SOURCE_FILE_NAME, actorId, actorId, ids.packId,
        ]
      );

      // Wartości piszemy od nowa (kasujemy WYŁĄCZNIE własne sprawozdanie), żeby powtórny --apply
      // dawał dokładnie ten sam stan, a nie duplikaty pozycji.
      await tx.query(`DELETE FROM financial_statement_values WHERE statement_id = ?`, [statement.id]);
      for (const line of statement.lines) {
        await tx.query(
          `INSERT INTO financial_statement_values
             (id, statement_id, canonical_line_id, original_label, value, confidence, source_page,
              mapping_status, value_origin, mapping_confidence, notes, created_at, updated_at)
           VALUES (?, ?,
                   (SELECT id FROM financial_statement_lines
                      WHERE line_code = ? AND statement_type = ?
                        AND (organization_id IS NULL OR organization_id = ?)
                      ORDER BY organization_id NULLS LAST LIMIT 1),
                   ?, ?, 1.0, ?, ?, 'source', 1.0, ?, NOW(), NOW())`,
          [
            randomUUID(), statement.id, line.code, line.statementType, organizationId,
            line.pdfLabel ?? line.key, line[statement.periodKey], line.page,
            line.code ? 'manual' : 'unmapped', line.derived ?? line.note ?? null,
          ]
        );
      }
    }
  });

  await recomputeStatementPack(ids.packId);

  const cold = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ statements: string; values: string; readiness: string | null }>(
      `SELECT (SELECT count(*) FROM financial_statements WHERE statement_pack_id = ?) AS statements,
              (SELECT count(*) FROM financial_statement_values v
                 JOIN financial_statements s ON s.id = v.statement_id
                WHERE s.statement_pack_id = ?) AS values,
              (SELECT pack_readiness_status FROM financial_statement_packs WHERE id = ?) AS readiness`,
      [ids.packId, ids.packId, ids.packId]
    )
  );
  return {
    statements: Number(cold?.statements ?? 0),
    values: Number(cold?.values ?? 0),
    readiness: cold?.readiness ?? null,
  };
}

// ---------------------------------------------------------------------------
// Tor kanoniczny
// ---------------------------------------------------------------------------

async function findExistingPack(
  organizationId: string,
  naturalKey: string
): Promise<{ artifactId: string; businessVersionId: string } | null> {
  const row = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ artifact_id: string; business_version_id: string }>(
      `SELECT a.artifact_id, bv.business_version_id
         FROM finance_artifacts a
         JOIN finance_business_versions bv
           ON bv.artifact_id = a.artifact_id AND bv.organization_id = a.organization_id
        WHERE a.organization_id = ? AND a.natural_key = ?
        ORDER BY bv.version_no DESC LIMIT 1`,
      [organizationId, naturalKey]
    )
  );
  return row ? { artifactId: row.artifact_id, businessVersionId: row.business_version_id } : null;
}

/**
 * ★ MOST legacy ↔ kanoniczny (audyt FIN 2026-09-06, defekt #3 — BLOKER).
 *
 * Bez wiersza w `finance_artifact_aliases` klik „Otwórz" na wierszu CD PROJEKT
 * nie trafiał do pakietu z 238 liniami — materializacja tożsamości zakładała
 * DRUGI, pusty artefakt i to jemu przypisywała alias (zmierzone lokalnie:
 * artefakt-widmo `fe74a3a5-…`, `mapping_reason = materialized_on_open:STATEMENT_PACK`).
 * Seed, który zakłada obie strony (legacy i kanoniczną), jest jedynym miejscem,
 * które ZNA obie tożsamości — więc to on musi zapiąć most.
 *
 * Idempotentna i samonaprawcza:
 *   - brak aliasu → INSERT,
 *   - alias wskazuje TEN artefakt → nic (0 zmian przy powtórnym `--apply`),
 *   - alias wskazuje INNY artefakt → przepięcie na artefakt seeda (to seed jest
 *     autorytetem dla SWOJEGO pakietu) + archiwizacja artefaktu-widma, o ile
 *     jest PUSTY i powstał z materializacji. Artefakt z jakąkolwiek treścią NIE
 *     jest ruszany — wtedy tylko głośny komunikat, żeby człowiek rozstrzygnął.
 */
async function ensureCanonicalAlias(
  organizationId: string,
  legacyPackId: string,
  artifactId: string,
  businessVersionId: string,
  actorId: string
): Promise<void> {
  const before = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ alias_id: string; artifact_id: string; mapping_reason: string | null }>(
      `SELECT alias_id, artifact_id, mapping_reason FROM finance_artifact_aliases
        WHERE legacy_table = 'financial_statement_packs' AND legacy_id = ? AND organization_id = ?
        ORDER BY created_at DESC LIMIT 1`,
      [legacyPackId, organizationId]
    )
  );

  if (!before) {
    await withPgTransaction(async (tx) => {
      await tx.query(
        `INSERT INTO finance_artifact_aliases
           (legacy_table, legacy_id, legacy_version, artifact_id, organization_id,
            business_version_id, mapping_confidence, mapping_reason, created_by)
         VALUES ('financial_statement_packs', ?, '', ?, ?, ?, 'AUTO_MIGRATE', ?, ?)
         ON CONFLICT (legacy_table, legacy_id, legacy_version) DO NOTHING`,
        [legacyPackId, artifactId, organizationId, businessVersionId, `seed:${DEFAULT_TAG}`, actorId]
      );
    });
    console.log(`# ALIAS legacy→kanoniczny ZAŁOŻONY: ${legacyPackId} → ${artifactId}`);
    return;
  }

  if (before.artifact_id === artifactId) {
    console.log(`# ALIAS legacy→kanoniczny JUŻ POPRAWNY: ${legacyPackId} → ${artifactId} (0 zmian).`);
    return;
  }

  const ghost = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ lines: string; natural_key: string | null }>(
      `SELECT (SELECT count(*) FROM finance_stmt_lines l
                 JOIN finance_business_versions bv ON bv.business_version_id = l.business_version_id
                WHERE bv.artifact_id = ?) AS lines,
              (SELECT natural_key FROM finance_artifacts WHERE artifact_id = ?) AS natural_key`,
      [before.artifact_id, before.artifact_id]
    )
  );
  const ghostLines = Number(ghost?.lines ?? 0);
  const cameFromMaterialization = String(before.mapping_reason ?? '').startsWith('materialized_on_open');

  await withPgTransaction(async (tx) => {
    await tx.query(
      `UPDATE finance_artifact_aliases
          SET artifact_id = ?, business_version_id = ?, mapping_reason = ?
        WHERE alias_id = ?`,
      [artifactId, businessVersionId, `seed:${DEFAULT_TAG}:repointed`, before.alias_id]
    );
    if (ghostLines === 0 && cameFromMaterialization) {
      await tx.query(
        `UPDATE finance_artifacts
            SET archived_at = NOW(), archived_reason = ?
          WHERE artifact_id = ? AND organization_id = ? AND archived_at IS NULL`,
        [
          'Pusty duplikat utworzony przez materializacje tozsamosci przy kliknieciu Otworz; alias przepiety na pakiet seeda CD PROJEKT.',
          before.artifact_id,
          organizationId,
        ]
      );
    }
  });

  console.log(
    `# ALIAS legacy→kanoniczny PRZEPIĘTY: ${legacyPackId} → ${artifactId} ` +
      `(był: ${before.artifact_id}, klucz "${ghost?.natural_key ?? '?'}", linii ${ghostLines}).`
  );
  if (ghostLines === 0 && cameFromMaterialization) {
    console.log(`# Artefakt-widmo ${before.artifact_id} ZARCHIWIZOWANY (pusty, z materializacji).`);
  } else if (ghostLines > 0) {
    console.log(
      `# UWAGA: poprzedni artefakt ${before.artifact_id} MA ${ghostLines} linii — NIE ruszam go. Rozstrzygnij ręcznie.`
    );
  }
}

/** Nazwa widoczna dla użytkownika (kolumna rozdzielona od `natural_key` migracją 20261102). */
async function setDisplayName(
  organizationId: string,
  artifactId: string,
  displayName: string
): Promise<void> {
  await withPgTransaction(async (tx) => {
    await tx.query(
      `UPDATE finance_artifacts SET display_name = ? WHERE artifact_id = ? AND organization_id = ?`,
      [displayName, artifactId, organizationId]
    );
  });
  console.log(`# Nazwa wyświetlana artefaktu ${artifactId}: "${displayName}"`);
}

async function applyCanonical(
  organizationId: string,
  actorId: string,
  data: SeedDataset,
  naturalKey: string
): Promise<{ businessVersionId: string; artifactId: string; buckets: Record<string, number> }> {
  const existing = await findExistingPack(organizationId, naturalKey);
  let pack: { artifactId: string; businessVersionId: string };
  if (existing) {
    pack = existing;
    console.log(`# Pakiet kanoniczny JUŻ ISTNIEJE: ${pack.businessVersionId} — odświeżam zawartość.`);
    await withPgTransaction(async (tx) => {
      await tx.query(`DELETE FROM finance_stmt_lines WHERE business_version_id = ?`, [pack.businessVersionId]);
      // Po `--rollback` własny artefakt zostaje ZARCHIWIZOWANY (patrz `retireCanonicalArtifact`).
      // Ponowny `--apply` musi go przywrócić na listę, inaczej seed zapisze dane do artefaktu,
      // którego UI nie pokazuje — czyli „zrobione, a nie widać".
      await tx.query(`UPDATE finance_artifacts SET archived_at = NULL WHERE artifact_id = ?`, [pack.artifactId]);
    });
  } else {
    const created: CreateArtifactResult = await createArtifact({
      organizationId,
      artifactType: 'STATEMENT_PACK',
      naturalKey,
      createdBy: actorId,
    });
    pack = {
      artifactId: created.artifact.artifact_id,
      businessVersionId: created.businessVersion.business_version_id,
    };
    console.log(`# Utworzono pakiet kanoniczny ${pack.businessVersionId} (artefakt ${pack.artifactId})`);
  }

  const context = await ensureStatementPackTemporalContext({
    organizationId,
    businessVersionId: pack.businessVersionId,
    createdBy: actorId,
    periods: data.meta.periods.map((p) => ({
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      label: p.label,
    })),
    entityName: ENTITY_NAME,
    entityCode: ENTITY_CODE,
    currency: data.meta.currency,
  });
  console.log(
    `# Kalendarz ${context.fiscalCalendarId} (nowy: ${context.calendarCreated}); ` +
      `okresy: ${context.periods.length} (nowych ${context.periodsCreated}); ` +
      `jednostka ${context.entityCode} (nowa: ${context.entityCreated})`
  );

  const periodByRange = new Map<string, EnsuredPeriod>();
  for (const p of context.periods) periodByRange.set(`${p.periodStart}..${p.periodEnd}`, p);

  const buckets: Record<string, number> = {};
  for (const period of data.meta.periods) {
    const ensured = periodByRange.get(`${period.periodStart}..${period.periodEnd}`);
    if (!ensured) throw new Error(`Brak okresu ${period.label} — przerywam bez dalszego zapisu.`);
    const periodKey = period.key.toLowerCase() as PeriodKey;

    for (const section of SECTION_ORDER) {
      const lines = data.lines.filter((l) => l.section === section);
      if (lines.length === 0) continue;
      const results = await mapStatementLines({
        organizationId,
        businessVersionId: pack.businessVersionId,
        unit: data.meta.unit,
        presentationCurrency: data.meta.currency,
        accumulationBasis: 'FULL_YEAR',
        createdBy: actorId,
        rawLines: lines.map((l) => ({
          ...rawLineFor(l, periodKey, data),
          periodId: ensured.periodId,
          entityCode: context.entityCode,
        })),
        rules: lines.map(ruleFor),
      });
      const counts = bucketCounts(results);
      for (const [bucket, count] of Object.entries(counts)) buckets[bucket] = (buckets[bucket] || 0) + count;
      const unmapped = results.filter((r) => r.bucket === 'UNMAPPED');
      console.log(
        `  · ${period.label} ${section}: ` +
          Object.entries(counts).map(([b, c]) => `${b}=${c}`).join(' ') +
          (unmapped.length ? ` ⚠ niemapowane: ${unmapped.map((r) => `${r.raw.lineItem} (${r.reasonCode})`).join('; ')}` : '')
      );
    }
  }

  return { businessVersionId: pack.businessVersionId, artifactId: pack.artifactId, buckets };
}

// ---------------------------------------------------------------------------
// Rollback
// ---------------------------------------------------------------------------

async function rollback(
  organizationId: string,
  naturalKey: string,
  ids: LegacyIds,
  cascade: boolean
): Promise<void> {
  const existing = await findExistingPack(organizationId, naturalKey);

  if (existing) {
    const dependents = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ business_version_id: string; rows: string }>(
        `SELECT k.business_version_id, count(*)::text AS rows
           FROM finance_analysis_kpi_values k
          WHERE k.entity_id IN (SELECT id FROM finance_stmt_entities WHERE business_version_id = ?)
          GROUP BY k.business_version_id`,
        [existing.businessVersionId]
      )
    );
    if (dependents.length > 0) {
      console.log(`# Analizy zbudowane na tym pakiecie: ${dependents.length}`);
      for (const d of dependents) console.log(`  - ${d.business_version_id} (${d.rows} wierszy wskaźników)`);
      if (!cascade) {
        console.error('ODMOWA: pakiet ma zależne analizy. Świadome cofnięcie razem z nimi: dopisz --cascade.');
        process.exitCode = 3;
        return;
      }
      await withPgTransaction(async (tx) => {
        for (const d of dependents) {
          await tx.query(`DELETE FROM finance_analysis_kpi_values WHERE business_version_id = ?`, [d.business_version_id]);
          await tx.query(`DELETE FROM finance_analysis_definitions WHERE business_version_id = ?`, [d.business_version_id]);
        }
      });
    }

    await withPgTransaction(async (tx) => {
      await tx.query(`DELETE FROM finance_stmt_lines WHERE business_version_id = ?`, [existing.businessVersionId]);
      await tx.query(`DELETE FROM finance_stmt_entities WHERE business_version_id = ?`, [existing.businessVersionId]);
    });

    // Okresy i kalendarz są wspólne dla organizacji — kasujemy tylko osierocone. Pętla, bo łańcuch
    // `previous_period_id` trzyma poprzedników i jeden przebieg zdejmuje tylko ogon łańcucha.
    const orphans = await withPgTransaction(async (tx) => {
      let removed = 0;
      for (let pass = 0; pass < 50; pass += 1) {
        const step = await tx.query<{ period_id: string }>(
          `DELETE FROM finance_stmt_periods p
            WHERE p.organization_id = ?
              AND NOT EXISTS (SELECT 1 FROM finance_stmt_lines l WHERE l.period_id = p.period_id)
              AND NOT EXISTS (SELECT 1 FROM finance_analysis_kpi_values k WHERE k.period_id = p.period_id)
              AND NOT EXISTS (SELECT 1 FROM finance_baseline_workspace_contexts c
                               WHERE c.opening_balance_sheet_period_id = p.period_id)
              AND NOT EXISTS (SELECT 1 FROM finance_stmt_periods n WHERE n.previous_period_id = p.period_id)
            RETURNING period_id`,
          [organizationId]
        );
        removed += step.rows.length;
        if (step.rows.length === 0) break;
      }
      await tx.query(
        `DELETE FROM finance_stmt_calendars c
          WHERE c.organization_id = ?
            AND NOT EXISTS (SELECT 1 FROM finance_stmt_periods p WHERE p.fiscal_calendar_id = c.fiscal_calendar_id)`,
        [organizationId]
      );
      return removed;
    });
    console.log(`# Usunięto osieroconych okresów: ${orphans}`);

    await retireCanonicalArtifact(existing.artifactId, [existing.businessVersionId]);
  } else {
    console.log(`# Brak artefaktu kanonicznego o kluczu ${naturalKey} — nie ma czego cofać po tej stronie.`);
  }

  await deleteLegacyPack(organizationId, ids.packId);

  const cold = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ lines: string; entities: string; statements: string; packs: string }>(
      `SELECT (SELECT count(*) FROM finance_stmt_lines WHERE organization_id = ?) AS lines,
              (SELECT count(*) FROM finance_stmt_entities WHERE organization_id = ?) AS entities,
              (SELECT count(*) FROM financial_statements WHERE organization_id = ?) AS statements,
              (SELECT count(*) FROM financial_statement_packs WHERE organization_id = ?) AS packs`,
      [organizationId, organizationId, organizationId, organizationId]
    )
  );
  console.log(
    `# Po rollbacku (odczyt na zimno, cała organizacja): linie=${cold?.lines} jednostki=${cold?.entities} ` +
      `sprawozdania legacy=${cold?.statements} pakiety legacy=${cold?.packs}`
  );
}

/**
 * WYCOFANIE ARTEFAKTU KANONICZNEGO — usunięcie, a gdy się nie da, ARCHIWIZACJA.
 *
 * ZMIERZONE, NIE ZAŁOŻONE (jednorazowy Postgres, pełne migracje, 05.09.2026):
 *   1. `artifact_lifecycle_events` ma trigger `trg_artifact_lifecycle_events_deny_delete` —
 *      próba `DELETE` kończy się `artifact_lifecycle_events is append-only; DELETE not permitted`.
 *      A `createArtifact` ZAWSZE dopisuje zdarzenie, więc twarde usunięcie artefaktu jest
 *      w praktyce niemożliwe. (Uwaga: `finance-backfill-dbr77.ts` w swoim `--rollback` próbuje
 *      tego `DELETE`-a — na bazie z tym triggerem ta ścieżka podnosi wyjątek. Nie naprawiam
 *      cudzego skryptu w tej paczce, ale mówię o tym wprost.)
 *   2. Ścieżka serwisowa też jest zamknięta: `lifecycleService` przejście T10 `archive`
 *      prowadzi WYŁĄCZNIE z `APPROVED` → `ARCHIVED`, a puste pakiety-śmieci są `DRAFT`.
 *      Nie ma legalnego przejścia DRAFT → ARCHIVED i nie podrabiam go ręcznym UPDATE-em statusu.
 *   3. Dźwignia, która realnie zdejmuje artefakt z listy w UI, to `finance_artifacts.archived_at`:
 *      `artifactVersionService.listArtifacts` filtruje `AND a.archived_at IS NULL`
 *      (`artifactVersionService.ts:182`), a `finance_artifacts` NIE ma triggera append-only.
 *
 * Dlatego: dane artefaktu (linie, jednostki, wiersze analiz) są kasowane, ślad w rejestrze
 * zdarzeń ZOSTAJE nienaruszony (o to właśnie chodzi w append-only), a sam artefakt znika z listy
 * przez `archived_at`. Zwracamy `'DELETED' | 'ARCHIVED'`, żeby raport mówił prawdę, co się stało.
 */
async function retireCanonicalArtifact(artifactId: string, businessVersionIds: string[]): Promise<'DELETED' | 'ARCHIVED'> {
  const blockers = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ edges: string; events: string }>(
      `SELECT (SELECT count(*) FROM finance_lineage_edges
                WHERE source_version_id = ANY(?) OR target_version_id = ANY(?)) AS edges,
              (SELECT count(*) FROM artifact_lifecycle_events WHERE artifact_id = ?) AS events`,
      [businessVersionIds, businessVersionIds, artifactId]
    )
  );
  const edges = Number(blockers?.edges ?? 0);
  const events = Number(blockers?.events ?? 0);

  if (edges === 0 && events === 0) {
    await withPgTransaction(async (tx) => {
      await tx.query(`DELETE FROM finance_artifact_aliases WHERE artifact_id = ?`, [artifactId]);
      await tx.query(`DELETE FROM finance_working_revisions WHERE artifact_id = ?`, [artifactId]);
      await tx.query(`DELETE FROM finance_business_versions WHERE artifact_id = ?`, [artifactId]);
      await tx.query(`DELETE FROM finance_artifacts WHERE artifact_id = ?`, [artifactId]);
    });
    console.log(`# Artefakt ${artifactId} USUNIĘTY w całości (zero krawędzi rodowodu, zero zdarzeń cyklu życia).`);
    return 'DELETED';
  }

  await withPgTransaction((tx) =>
    tx.query(
      `UPDATE finance_artifacts
          SET archived_at = COALESCE(archived_at, now())
        WHERE artifact_id = ?`,
      [artifactId]
    )
  );
  console.log(
    `# Artefakt ${artifactId} ZARCHIWIZOWANY (archived_at) — dane skasowane, ale twarde usunięcie ` +
      `zablokowane: krawędzi rodowodu ${edges}, zdarzeń cyklu życia ${events} (append-only). ` +
      `Znika z listy, bo listArtifacts filtruje archived_at IS NULL.`
  );
  return 'ARCHIVED';
}

/**
 * WYCOFANIE PAKIETU LEGACY — usunięcie, a gdy blokują je paragony rządzenia, ARCHIWIZACJA.
 *
 * ZMIERZONE NA STAGINGU (05.09.2026), nie założone: kaskada z trasy
 * `DELETE /finance-statements/packs/:id` (`finance-statements.routes.ts:2945-2974`) NIE ZNA
 * czterech tabel paragonów, które trzymają FK `NO ACTION` na sprawozdania i pakiety:
 *   finance_statement_source_receipts        (44 wiersze) -> statements + ingest_runs
 *   finance_statement_confirmation_receipts  (15 wierszy) -> statements + packs
 *   finance_statement_manual_mapping_decisions            -> statements
 *   finance_statement_pack_archive_command_receipts (6)   -> packs
 * i wszystkie cztery mają trigger `…_immutable` (BEFORE DELETE OR UPDATE), więc paragonu NIE DA SIĘ
 * usunąć. Pierwsza próba prune na stagingu padła dokładnie tu:
 *   `update or delete on table "financial_statement_ingest_runs" violates foreign key constraint
 *    "fk_fin_stmt_source_receipt_ingest_owner"`.
 * TO JEST DEFEKT ZASTANY: ta sama trasa w UI wywala się tak samo na każdym sprawozdaniu,
 * które przeszło potwierdzenie. Nie obchodzę triggera i nie zmieniam kontraktu paragonów.
 *
 * DECYZJA: sprawdzamy PRZED usunięciem, czy na obiekcie wiszą paragony.
 *   · brak paragonów  -> twarde usunięcie (ta sama kaskada, co trasa UI),
 *   · są paragony     -> `status='archived'` / `pack_status='archived'`, czyli dokładnie to,
 *     czego lista w UI nie pokazuje (`financialStatementPackService.ts:382` i `:835` filtrują
 *     `COALESCE(status,'draft') <> 'archived'`). Dane zostają, ślad rządzenia zostaje,
 *     a właściciel widzi tylko CD PROJEKT.
 * Odwracalne jednym UPDATE-em — komendy w raporcie paczki.
 */
async function retireLegacyPack(organizationId: string, packId: string): Promise<{ outcome: 'DELETED' | 'ARCHIVED'; statements: number }> {
  const children = await withPinnedPostgresTransaction((tx) =>
    tx.queryAll<{ id: string }>(
      `SELECT id FROM financial_statements WHERE statement_pack_id = ? AND organization_id = ?`,
      [packId, organizationId]
    )
  );
  const childIds = children.map((c) => c.id);

  const blocked = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ n: string }>(
      `SELECT (
         (SELECT count(*) FROM finance_statement_source_receipts r
           WHERE r.statement_id = ANY(?) OR r.ingest_run_id IN (SELECT id FROM financial_statement_ingest_runs WHERE statement_id = ANY(?)))
       + (SELECT count(*) FROM finance_statement_confirmation_receipts r WHERE r.statement_id = ANY(?) OR r.statement_pack_id = ?)
       + (SELECT count(*) FROM finance_statement_manual_mapping_decisions r WHERE r.statement_id = ANY(?))
       + (SELECT count(*) FROM finance_statement_pack_archive_command_receipts r WHERE r.pack_id = ?)
       )::text AS n`,
      [childIds, childIds, childIds, packId, childIds, packId]
    )
  );

  if (Number(blocked?.n ?? 0) > 0) {
    await withPgTransaction(async (tx) => {
      await tx.query(
        `UPDATE financial_statements SET status = 'archived', updated_at = NOW()
          WHERE statement_pack_id = ? AND organization_id = ? AND COALESCE(status,'draft') <> 'archived'`,
        [packId, organizationId]
      );
      await tx.query(
        `UPDATE financial_statement_packs SET pack_status = 'archived', updated_at = NOW()
          WHERE id = ? AND organization_id = ? AND COALESCE(pack_status,'draft') <> 'archived'`,
        [packId, organizationId]
      );
    });
    console.log(`# Pakiet legacy ${packId} ZARCHIWIZOWANY (paragony rządzenia: ${blocked?.n}) — znika z listy, dane i ślad zostają.`);
    return { outcome: 'ARCHIVED', statements: childIds.length };
  }

  await withPgTransaction(async (tx) => {
    for (const id of childIds) await deleteLegacyStatementRows(tx as unknown as TxLike, id);
    await tx.query(`DELETE FROM financial_statement_validations WHERE statement_pack_id = ?`, [packId]);
    await tx.query(`DELETE FROM financial_statement_packs WHERE id = ? AND organization_id = ?`, [packId, organizationId]);
  });
  return { outcome: 'DELETED', statements: childIds.length };
}

/** Pojedyncze sprawozdanie bez pakietu — ta sama zasada: usuń, a gdy paragony blokują, zarchiwizuj. */
async function retireLegacyStatement(organizationId: string, statementId: string): Promise<'DELETED' | 'ARCHIVED'> {
  const blocked = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ n: string }>(
      `SELECT (
         (SELECT count(*) FROM finance_statement_source_receipts r
           WHERE r.statement_id = ? OR r.ingest_run_id IN (SELECT id FROM financial_statement_ingest_runs WHERE statement_id = ?))
       + (SELECT count(*) FROM finance_statement_confirmation_receipts r WHERE r.statement_id = ?)
       + (SELECT count(*) FROM finance_statement_manual_mapping_decisions r WHERE r.statement_id = ?)
       )::text AS n`,
      [statementId, statementId, statementId, statementId]
    )
  );
  if (Number(blocked?.n ?? 0) > 0) {
    await withPgTransaction((tx) =>
      tx.query(
        `UPDATE financial_statements SET status = 'archived', updated_at = NOW()
          WHERE id = ? AND organization_id = ? AND COALESCE(status,'draft') <> 'archived'`,
        [statementId, organizationId]
      )
    );
    return 'ARCHIVED';
  }
  await withPgTransaction((tx) => deleteLegacyStatementRows(tx as unknown as TxLike, statementId));
  return 'DELETED';
}

/** Rollback WŁASNEGO pakietu seeda: nasze sprawozdania nie mają paragonów, więc idą twardo. */
async function deleteLegacyPack(organizationId: string, packId: string): Promise<number> {
  const result = await retireLegacyPack(organizationId, packId);
  return result.statements;
}

interface TxLike {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

async function deleteLegacyStatementRows(tx: TxLike, statementId: string): Promise<void> {
  await tx.query(`DELETE FROM financial_statement_values WHERE statement_id = ?`, [statementId]);
  await tx.query(`DELETE FROM financial_statement_validations WHERE statement_id = ?`, [statementId]);
  await tx.query(`DELETE FROM financial_statement_mapping_candidates WHERE statement_id = ?`, [statementId]);
  await tx.query(`DELETE FROM financial_statement_candidate_rows WHERE statement_id = ?`, [statementId]);
  await tx.query(`DELETE FROM financial_statement_extracted_sections WHERE statement_id = ?`, [statementId]);
  await tx.query(`DELETE FROM financial_statement_source_artifacts WHERE statement_id = ?`, [statementId]);
  await tx.query(`DELETE FROM financial_statement_quality_runs WHERE statement_id = ?`, [statementId]);
  await tx.query(`DELETE FROM financial_statement_ingest_runs WHERE statement_id = ?`, [statementId]);
  await tx.query(`DELETE FROM financial_statements WHERE id = ?`, [statementId]);
}

// ---------------------------------------------------------------------------
// „Wywal resztę" — prune-others
// ---------------------------------------------------------------------------

interface PruneTarget {
  kind: 'LEGACY_PACK' | 'LEGACY_STATEMENT' | 'CANONICAL_ARTIFACT';
  id: string;
  label: string;
  detail: string;
}

async function collectPruneTargets(
  organizationId: string,
  ids: LegacyIds,
  naturalKey: string
): Promise<PruneTarget[]> {
  return withPinnedPostgresTransaction(async (tx) => {
    const targets: PruneTarget[] = [];

    const packs = await tx.queryAll<{ id: string; entity_name: string | null; period_label: string | null; statements: string }>(
      `SELECT p.id, p.entity_name, p.period_label,
              (SELECT count(*)::text FROM financial_statements s WHERE s.statement_pack_id = p.id) AS statements
         FROM financial_statement_packs p
        WHERE p.organization_id = ? AND p.id <> ?
          AND COALESCE(p.pack_status, 'draft') <> 'archived'
        ORDER BY p.created_at`,
      [organizationId, ids.packId]
    );
    for (const p of packs) {
      targets.push({
        kind: 'LEGACY_PACK',
        id: p.id,
        label: p.entity_name || '(bez nazwy)',
        detail: `pakiet legacy · ${p.period_label ?? 'bez etykiety'} · sprawozdań ${p.statements}`,
      });
    }

    const orphanStatements = await tx.queryAll<{ id: string; entity_name: string | null; statement_type: string; period_label: string | null; period_end: string; vals: string }>(
      `SELECT s.id, s.entity_name, s.statement_type, s.period_label, s.period_end::text AS period_end,
              (SELECT count(*)::text FROM financial_statement_values v WHERE v.statement_id = s.id) AS vals
         FROM financial_statements s
        WHERE s.organization_id = ?
          AND COALESCE(s.status, 'draft') <> 'archived'
          AND s.statement_pack_id IS DISTINCT FROM ?
          -- Sprawozdania pakietow ZYWYCH obsluguje sciezka [LEGACY_PACK] wyzej. Tu bierzemy reszte:
          -- osierocone (pack_id NULL), wskazujace na nieistniejacy pakiet ORAZ - i to jest poprawka
          -- po pomiarze stagingu - dzieci pakietow JUZ ZARCHIWIZOWANYCH wczesniej przez aplikacje
          -- (finance_statement_pack_archive_command_receipts: 6 wierszy). Pakiet byl archiwalny,
          -- ale jego 34 sprawozdania dalej mialy status mapped/confirmed i zostawaly na liscie.
          AND (s.statement_pack_id IS NULL
               OR NOT EXISTS (SELECT 1 FROM financial_statement_packs p
                               WHERE p.id = s.statement_pack_id AND p.organization_id = ?)
               OR EXISTS (SELECT 1 FROM financial_statement_packs p
                           WHERE p.id = s.statement_pack_id AND p.organization_id = ?
                             AND COALESCE(p.pack_status, 'draft') = 'archived'))
        ORDER BY s.created_at`,
      [organizationId, ids.packId, organizationId, organizationId]
    );
    for (const s of orphanStatements) {
      targets.push({
        kind: 'LEGACY_STATEMENT',
        id: s.id,
        label: s.entity_name || '(bez nazwy)',
        detail: `sprawozdanie legacy bez pakietu · ${s.statement_type} · ${s.period_label ?? s.period_end} · pozycji ${s.vals}`,
      });
    }

    // ZATRZYMUJEMY nie tylko pakiet CD PROJEKT, ale WSZYSTKO, co z niego wyrasta w grafie rodowodu
    // (analiza historyczna, model bazowy, wycena…). Bez tego `--prune-others` skasowałby analizę
    // wskaźnikową zbudowaną minutę wcześniej na tym samym pakiecie — zmierzone, nie założone.
    // Domknięcie przechodnie, nie jeden skok: łańcuch pakiet → analiza → model → wycena bywa dłuższy.
    const keepArtifacts = new Set<string>();
    const seedArtifact = await tx.queryOne<{ artifact_id: string }>(
      `SELECT artifact_id FROM finance_artifacts WHERE organization_id = ? AND natural_key = ?`,
      [organizationId, naturalKey]
    );
    if (seedArtifact) {
      keepArtifacts.add(seedArtifact.artifact_id);
      for (let hop = 0; hop < 20; hop += 1) {
        const next = await tx.queryAll<{ artifact_id: string }>(
          `SELECT DISTINCT bvOther.artifact_id
             FROM finance_business_versions bvKeep
             JOIN finance_lineage_edges e
               ON e.source_version_id = bvKeep.business_version_id
               OR e.target_version_id = bvKeep.business_version_id
             JOIN finance_business_versions bvOther
               ON bvOther.business_version_id IN (e.source_version_id, e.target_version_id)
            WHERE bvKeep.artifact_id = ANY(?) AND bvOther.organization_id = ?`,
          [Array.from(keepArtifacts), organizationId]
        );
        const before = keepArtifacts.size;
        for (const row of next) keepArtifacts.add(row.artifact_id);
        if (keepArtifacts.size === before) break;
      }
    }

    const artifacts = await tx.queryAll<{ artifact_id: string; artifact_type: string; natural_key: string | null; versions: string; edges: string }>(
      `SELECT a.artifact_id, a.artifact_type, a.natural_key,
              (SELECT count(*)::text FROM finance_business_versions bv WHERE bv.artifact_id = a.artifact_id) AS versions,
              (SELECT count(*)::text FROM finance_lineage_edges e
                 JOIN finance_business_versions bv2 ON bv2.artifact_id = a.artifact_id
                WHERE e.source_version_id = bv2.business_version_id
                   OR e.target_version_id = bv2.business_version_id) AS edges
         FROM finance_artifacts a
        WHERE a.organization_id = ?
          AND a.archived_at IS NULL
          AND NOT (a.artifact_id = ANY(?))
        ORDER BY a.created_at`,
      [organizationId, Array.from(keepArtifacts)]
    );
    for (const a of artifacts) {
      targets.push({
        kind: 'CANONICAL_ARTIFACT',
        id: a.artifact_id,
        label: a.natural_key || '(bez klucza naturalnego)',
        detail: `artefakt kanoniczny ${a.artifact_type} · wersji ${a.versions} · krawędzi rodowodu ${a.edges}`,
      });
    }

    return targets;
  });
}

async function pruneOthers(
  organizationId: string,
  ids: LegacyIds,
  naturalKey: string,
  apply: boolean
): Promise<void> {
  const targets = await collectPruneTargets(organizationId, ids, naturalKey);
  console.log('');
  console.log(`# Do usunięcia (wyłącznie w organizacji ${organizationId}): ${targets.length}`);
  for (const t of targets) console.log(`  - [${t.kind}] ${t.id} | ${t.label} | ${t.detail}`);
  console.log(`# ZOSTAJE: pakiet legacy ${ids.packId}, artefakt kanoniczny o kluczu ${naturalKey} i wszystko, co z niego wyrasta w grafie rodowodu (CD PROJEKT).`);

  if (!apply) {
    console.log('');
    console.log('DRY-RUN: nic nie usunięto. Zapis: dopisz --apply.');
    return;
  }

  let removedPacks = 0;
  let removedStatements = 0;
  let removedArtifacts = 0;
  let shells = 0;

  let archivedPacks = 0;
  let archivedStatements = 0;
  for (const target of targets) {
    if (target.kind === 'LEGACY_PACK') {
      const result = await retireLegacyPack(organizationId, target.id);
      if (result.outcome === 'DELETED') {
        removedPacks += 1;
        removedStatements += result.statements;
      } else {
        archivedPacks += 1;
        archivedStatements += result.statements;
      }
    } else if (target.kind === 'LEGACY_STATEMENT') {
      const outcome = await retireLegacyStatement(organizationId, target.id);
      if (outcome === 'DELETED') removedStatements += 1;
      else archivedStatements += 1;
    }
  }

  for (const target of targets) {
    if (target.kind !== 'CANONICAL_ARTIFACT') continue;
    const versions = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ business_version_id: string }>(
        `SELECT business_version_id FROM finance_business_versions WHERE artifact_id = ?`,
        [target.id]
      )
    );
    await withPgTransaction(async (tx) => {
      for (const v of versions) {
        await tx.query(`DELETE FROM finance_analysis_kpi_values WHERE business_version_id = ?`, [v.business_version_id]);
        // ZMIERZONE NA STAGINGU: wiersze wskaźników CUDZEJ analizy trzymają FK na JEDNOSTKI tego
        // pakietu (`finance_analysis_kpi_values.entity_id`), więc kasowanie po samym
        // `business_version_id` zostawia je i `DELETE FROM finance_stmt_entities` wywala się na
        // `finance_analysis_kpi_values_entity_id_fkey`. Kasujemy też po jednostce — analiza
        // zbudowana na wycofywanym pakiecie i tak nie ma już z czego liczyć.
        await tx.query(
          `DELETE FROM finance_analysis_kpi_values
            WHERE entity_id IN (SELECT id FROM finance_stmt_entities WHERE business_version_id = ?)`,
          [v.business_version_id]
        );
        await tx.query(`DELETE FROM finance_analysis_definitions WHERE business_version_id = ?`, [v.business_version_id]);
        await tx.query(`DELETE FROM finance_stmt_lines WHERE business_version_id = ?`, [v.business_version_id]);
        await tx.query(`DELETE FROM finance_stmt_entities WHERE business_version_id = ?`, [v.business_version_id]);
      }
    });
    const outcome = await retireCanonicalArtifact(target.id, versions.map((v) => v.business_version_id));
    if (outcome === 'DELETED') removedArtifacts += 1;
    else shells += 1;
  }

  const cold = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ packs: string; statements: string; artifacts: string; entities: string }>(
      `SELECT (SELECT count(*) FROM financial_statement_packs WHERE organization_id = ? AND COALESCE(pack_status,'draft') <> 'archived') AS packs,
              (SELECT count(*) FROM financial_statements WHERE organization_id = ? AND COALESCE(status,'draft') <> 'archived') AS statements,
              (SELECT count(*) FROM finance_artifacts WHERE organization_id = ? AND archived_at IS NULL) AS artifacts,
              (SELECT count(DISTINCT entity_name) FROM financial_statements WHERE organization_id = ? AND COALESCE(status,'draft') <> 'archived') AS entities`,
      [organizationId, organizationId, organizationId, organizationId]
    )
  );
  const names = await withPinnedPostgresTransaction((tx) =>
    tx.queryAll<{ entity_name: string | null; n: string }>(
      `SELECT entity_name, count(*)::text AS n FROM financial_statements
        WHERE organization_id = ? AND COALESCE(status,'draft') <> 'archived' GROUP BY entity_name ORDER BY 1`,
      [organizationId]
    )
  );
  console.log('');
  console.log(`# Usunięto: pakietów legacy ${removedPacks}, sprawozdań legacy ${removedStatements}; ZARCHIWIZOWANO: pakietów legacy ${archivedPacks}, sprawozdań legacy ${archivedStatements}; artefaktów kanonicznych usuniętych ${removedArtifacts}, zarchiwizowanych ${shells}`);
  console.log(
    `# ODCZYT NA ZIMNO organizacji: pakiety legacy=${cold?.packs} sprawozdania legacy=${cold?.statements} ` +
      `artefakty kanoniczne=${cold?.artifacts} różnych firm=${cold?.entities}`
  );
  console.log(`# Firmy na liście sprawozdań: ${names.map((r) => `${r.entity_name ?? '(bez nazwy)'} × ${r.n}`).join(' | ') || '(brak)'}`);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const doRollback = process.argv.includes('--rollback');
  const doPrune = process.argv.includes('--prune-others');
  const orgNeedle = arg('org') || 'DBR77';
  const tag = arg('tag') || DEFAULT_TAG;

  const dbHost = (() => {
    try {
      return new URL(String(process.env.DATABASE_URL || '')).host;
    } catch {
      return '(brak DATABASE_URL)';
    }
  })();
  const mode = doRollback ? 'ROLLBACK' : doPrune ? (apply ? 'PRUNE-OTHERS (ZAPIS)' : 'PRUNE-OTHERS (dry-run)') : apply ? 'APPLY (ZAPIS)' : 'DRY-RUN (tylko odczyt)';
  console.log(`# Tryb: ${mode}   baza: ${dbHost}`);

  const data = loadDataset();
  const failures = verifyControls(data);
  console.log(`# Plik danych: ${DATA_PATH}`);
  console.log(`# Pozycji w pliku: ${data.lines.length} (zmapowanych ${data.lines.filter((l) => l.code).length}, wykluczonych ${data.lines.filter((l) => !l.code).length})`);
  if (failures.length > 0) {
    console.error(`BŁĄD: plik danych nie przechodzi sum kontrolnych z PDF (${failures.length}):`);
    for (const f of failures) console.error(`  · ${f.check}: oczekiwano ${f.expected}, jest ${f.actual}`);
    console.error('Zapis WSTRZYMANY — nie wpuszczam do bazy sprawozdania, które się nie spina.');
    process.exitCode = 4;
    return;
  }
  console.log(`# Sumy kontrolne z PDF: ${Object.keys(data.controls).length} pozycji + bilans + rolka gotówki + pozycje wyliczone — WSZYSTKIE ZGODNE.`);

  const org = await resolveOrganization(orgNeedle);
  if (!org) {
    console.error(`BŁĄD: nie znaleziono organizacji dla "${orgNeedle}".`);
    process.exitCode = 1;
    return;
  }
  console.log(`# Organizacja: ${org.name} (${org.id})`);

  const ids = legacyIds(org.id, tag);
  const naturalKey = `${tag}:${org.id}:${ENTITY_CODE}`;
  console.log(`# Klucz naturalny pakietu kanonicznego: ${naturalKey}`);
  console.log(`# Pakiet legacy: ${ids.packId}`);

  if (doRollback) {
    await rollback(org.id, naturalKey, ids, process.argv.includes('--cascade'));
    return;
  }
  if (doPrune) {
    await pruneOthers(org.id, ids, naturalKey, apply);
    return;
  }

  const plan = planLegacy(data, ids);
  console.log('');
  console.log(`# Sprawozdania legacy do założenia: ${plan.length} (2 okresy × P&L/BS/CF → wzór pack_readiness_status wymaga DOKŁADNIE 2 okresów)`);
  for (const s of plan) {
    console.log(`  - ${s.id} | ${s.statementType} | ${s.period.label} | pozycji ${s.lines.length}`);
  }
  console.log('');
  console.log('# Linie kanoniczne do zapisania (sekcja × okres):');
  for (const period of data.meta.periods) {
    for (const section of SECTION_ORDER) {
      const lines = data.lines.filter((l) => l.section === section);
      const mapped = lines.filter((l) => l.code).length;
      console.log(`  - ${period.label} ${section}: ${mapped} zmapowanych / ${lines.length - mapped} wykluczonych`);
    }
  }
  const excluded = data.lines.filter((l) => !l.code);
  console.log('');
  console.log(`# Pozycje BEZ kodu kanonicznego (${excluded.length}) — luka taksonomii albo decyzja analityka:`);
  for (const l of excluded) console.log(`    · [${l.excludeReasonCode}] ${l.section}: ${l.key}`);
  const present = new Set(data.lines.filter((l) => l.code).map((l) => l.code as string));
  const missingP0 = P0_REQUIRED_LINE_CODES.filter((c) => !present.has(c));
  console.log(`# Kody wymagane przez katalog wskaźników P0: ${P0_REQUIRED_LINE_CODES.length}, obecne ${P0_REQUIRED_LINE_CODES.length - missingP0.length}` + (missingP0.length ? `, BRAKUJE: ${missingP0.join(', ')}` : ''));

  const globalTaxonomy = await withPinnedPostgresTransaction((tx) =>
    tx.queryAll<{ statement_type: string; line_code: string }>(
      `SELECT statement_type, line_code FROM financial_statement_lines WHERE organization_id IS NULL`
    )
  );
  const haveTaxonomy = new Set(globalTaxonomy.map((r) => `${r.statement_type}::${r.line_code}`));
  const missingTaxonomy = Array.from(
    new Set(data.lines.filter((l) => l.code && l.action !== 'EXCLUDE').map((l) => `${l.statementType}::${l.code}`))
  ).filter((k) => !haveTaxonomy.has(k));
  console.log(
    `# Cele mapowania w taksonomii tej bazy: brakuje ${missingTaxonomy.length}` +
      (missingTaxonomy.length ? ` — --apply DOŁOŻY je jako globalne wiersze systemowe: ${missingTaxonomy.join(', ')}` : ' (komplet)')
  );

  // ★ Diagnoza mostu legacy↔kanoniczny — WIDOCZNA także w `--dry-run`, żeby
  // operator wiedział, co zapis zmieni, ZANIM cokolwiek napisze (audyt FIN #3).
  const aliasNow = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ artifact_id: string; mapping_reason: string | null }>(
      `SELECT artifact_id, mapping_reason FROM finance_artifact_aliases
        WHERE legacy_table = 'financial_statement_packs' AND legacy_id = ? AND organization_id = ?
        ORDER BY created_at DESC LIMIT 1`,
      [ids.packId, org.id]
    )
  );
  const packNow = await findExistingPack(org.id, naturalKey);
  const displayNow = packNow
    ? await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ display_name: string | null }>(
          `SELECT display_name FROM finance_artifacts WHERE artifact_id = ?`,
          [packNow.artifactId]
        )
      )
    : null;
  console.log('');
  console.log(
    `# MOST legacy→kanoniczny: alias = ${
      aliasNow ? `${aliasNow.artifact_id} (powód: ${aliasNow.mapping_reason ?? '—'})` : 'BRAK'
    }; artefakt seeda = ${packNow ? packNow.artifactId : 'jeszcze nie istnieje'}` +
      (aliasNow && packNow && aliasNow.artifact_id !== packNow.artifactId
        ? ' → ROZJAZD: --apply PRZEPNIE alias na artefakt seeda'
        : aliasNow
          ? ' → zgodne'
          : ' → --apply ZAŁOŻY alias')
  );
  console.log(
    `# Nazwa wyświetlana: teraz "${displayNow?.display_name ?? '(brak — UI pokazuje klucz techniczny)'}" → po --apply "${PACK_DISPLAY_NAME}"`
  );

  if (!apply) {
    console.log('');
    console.log('DRY-RUN: nic nie zapisano. Komendy zapisu:');
    console.log(`  DATABASE_URL=… npx tsx server/scripts/finance-seed-cdprojekt.ts --apply --org=${org.id}`);
    console.log(`  DATABASE_URL=… npx tsx server/scripts/finance-analiza-dbr77.ts --apply --org=${org.id} --pack=<businessVersionId z linii wyżej>`);
    console.log(`  DATABASE_URL=… npx tsx server/scripts/finance-seed-cdprojekt.ts --prune-others --apply --org=${org.id}`);
    return;
  }

  const actorId = await resolveActor(org.id);
  await ensureTaxonomyTargets(data, actorId);
  const legacy = await applyLegacy(org.id, actorId, data, ids, plan);
  console.log('');
  console.log(`# LEGACY (odczyt na zimno): sprawozdań ${legacy.statements}, pozycji ${legacy.values}, pack_readiness_status = ${legacy.readiness}`);

  const canonical = await applyCanonical(org.id, actorId, data, naturalKey);
  console.log(`# Razem po kubełkach: ${JSON.stringify(canonical.buckets)}`);

  await setDisplayName(org.id, canonical.artifactId, PACK_DISPLAY_NAME);
  await ensureCanonicalAlias(
    org.id,
    ids.packId,
    canonical.artifactId,
    canonical.businessVersionId,
    actorId
  );

  const cold = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ lines: string; periods: string; entities: string; nonzero: string; codes: string }>(
      `SELECT (SELECT count(*) FROM finance_stmt_lines WHERE business_version_id = ?) AS lines,
              (SELECT count(DISTINCT period_id) FROM finance_stmt_lines WHERE business_version_id = ?) AS periods,
              (SELECT count(*) FROM finance_stmt_entities WHERE business_version_id = ?) AS entities,
              (SELECT count(*) FROM finance_stmt_lines WHERE business_version_id = ? AND value_status = 'PRESENT_NONZERO') AS nonzero,
              (SELECT count(DISTINCT canonical_line_id) FROM finance_stmt_lines WHERE business_version_id = ?) AS codes`,
      [canonical.businessVersionId, canonical.businessVersionId, canonical.businessVersionId, canonical.businessVersionId, canonical.businessVersionId]
    )
  );
  console.log('');
  console.log(
    `# ODCZYT NA ZIMNO pakietu ${canonical.businessVersionId}: linie=${cold?.lines} okresy=${cold?.periods} ` +
      `jednostki=${cold?.entities} kodów kanonicznych=${cold?.codes} wartości niezerowe=${cold?.nonzero}`
  );
  console.log('');
  console.log('Następny krok (analiza wskaźnikowa):');
  console.log(
    `  DATABASE_URL=… npx tsx server/scripts/finance-analiza-dbr77.ts --apply --org=${org.id} --pack=${canonical.businessVersionId}`
  );
}

const isEntrypoint = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isEntrypoint) {
  main()
    .then(() => process.exit(process.exitCode ?? 0))
    .catch((error) => {
      console.error('BŁĄD:', error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
