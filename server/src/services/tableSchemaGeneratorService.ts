/**
 * tableSchemaGeneratorService — W4 / B4 (seria B, domena Table Platform)
 *
 * Dziś generacja tabeli z NL daje płaski markdown / akcje
 * (`ideaAISuggestionsService.generateTableAction`). B4 dodaje premium LLM, który
 * z intencji NL zwraca **TYPOWANY schemat pól** (singleSelect z kolorowymi
 * opcjami dla statusu/kategorii, number dla liczb, currency dla kwot, date dla
 * terminów, singleLineText dla nazw) **+ seed-rows w JSON** — materializowalny
 * do Table Platform, nie płaski markdown 10×15.
 *
 * SAFETY (program — generacja dotyka żywych klientów):
 *   - PREMIUM tylko za flagą `ENABLE_DELIVERABLES_PREMIUM` (B5 resolver, OFF
 *     domyślnie ⇒ STANDARD ⇒ prosty fallback). Klienci zostają na STANDARD aż
 *     jakość zostanie udowodniona.
 *   - FAIL-OPEN ZAWSZE: każdy błąd (resolver, LLM, walidacja) → prosty fallback,
 *     NIGDY nie rzuca w ścieżkę generacji.
 *
 * NIE wpięty w żywy `generateTableAction` — serwis gotowy do wpięcia gdy premium
 * zostanie aktywowane (patrz komentarz `// B4 ready` w ideaAISuggestionsService).
 *
 * Typy pól pochodzą z RZECZYWISTEGO katalogu Table Platform
 * (`server/src/services/tablePlatform/SchemaValidationService.ts` ALLOWED_FIELD_TYPES /
 * `src/types/tablePlatform.ts` FieldType). Uwaga: typ tekstowy w katalogu to
 * `singleLineText` (NIE `text`); nieprawidłowe typy mapujemy na `singleLineText`.
 *
 * @module services/tableSchemaGeneratorService
 */

import logger from '../utils/Logger.js';
import {
  resolveDeliverableTier,
  DELIVERABLE_GENERATION_PURPOSE,
  deliverableModelConfig,
} from './deliverableGenerationTier.js';
import { resolveDeliverableDefaults } from './deliverables/deliverableDefaults.js';

// ── Defaults (czytane RAZ) ───────────────────────────────────────────────────
const TABLE_DEFAULTS = resolveDeliverableDefaults('table');

// ──────────────────────────────────────────────────────────────
// Katalog typów pól (autorytatywny — Table Platform)
// ──────────────────────────────────────────────────────────────
/**
 * Typy pól dopuszczone w schemacie generowanym przez B4. Podzbiór
 * `ALLOWED_FIELD_TYPES` (SchemaValidationService) — tylko typy, które LLM
 * może bezpiecznie zaprojektować z NL bez kontekstu innych tabel (pomijamy
 * linkedRecord/lookup/rollup/formula i pola auto/computed).
 */
export const GENERATABLE_FIELD_TYPES = [
  'singleLineText',
  'longText',
  'number',
  'currency',
  'percent',
  'checkbox',
  'date',
  'singleSelect',
  'multiSelect',
  'url',
  'email',
  'phone',
  'rating',
] as const;

export type GeneratableFieldType = (typeof GENERATABLE_FIELD_TYPES)[number];

/** Typ tekstowy w katalogu Table Platform (NIE `text`). */
const TEXT_FIELD_TYPE: GeneratableFieldType = 'singleLineText';

/** Typy, które wymagają kolorowych opcji w schemacie premium. */
const SELECT_TYPES = new Set<string>(['singleSelect', 'multiSelect']);

/** Domyślna paleta hex dla opcji singleSelect/multiSelect bez koloru z LLM. */
const DEFAULT_OPTION_COLORS = [
  '#16A34A', // green
  '#D97706', // amber
  '#DC2626', // red
  '#2563EB', // blue
  '#7C3AED', // violet
  '#0891B2', // cyan
];

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// ──────────────────────────────────────────────────────────────
// Kontrakty publiczne
// ──────────────────────────────────────────────────────────────
export interface GeneratedFieldOption {
  label: string;
  color?: string;
}

export interface GeneratedField {
  key: string;
  header: string;
  /** Typ z katalogu Table Platform (GENERATABLE_FIELD_TYPES). */
  type: string;
  /** Dla singleSelect / multiSelect — opcje z kolorami (hex). */
  options?: GeneratedFieldOption[];
}

/**
 * Reguła conditional formatting (B4-ext). Materializowalna do WorkbookBuilder
 * (X2) — `ref` w notacji A1 obliczany z pozycji pola + liczby wierszy.
 */
export interface GeneratedCfBlock {
  /** A1-range, np "C2:C9" (obliczany z fieldKey + rowCount). */
  ref: string;
  rules: Array<{ type: string; [k: string]: unknown }>;
}

export interface GeneratedTableSchema {
  fields: GeneratedField[];
  /** Przykładowe wiersze (3-5 dla premium); keyed by field.key. */
  seedRows: Record<string, unknown>[];
  /**
   * B4-ext: conditional formatting per kolumna (X2-shape, gotowe dla
   * WorkbookBuilder.applyConditionalFormatting). Pusta tablica gdy brak.
   */
  conditionalFormatting?: GeneratedCfBlock[];
  /** B4-ext: true gdy ≥1 komórka seedRows zawiera formułę (string "=..."). */
  hasFormulas?: boolean;
  /**
   * B4-ext: arkusze wieloarkuszowego workbooka. Obecne TYLKO gdy intencja
   * implikuje workbook (np "Summary, OpEx, CapEx, HC; cross-sheet formulas").
   * Każdy arkusz = własne fields + seedRows (+ CF/formuły). Niezdefiniowane =
   * pojedynczy arkusz (top-level fields/seedRows).
   */
  sheets?: Array<{
    name?: string;
    fields: GeneratedField[];
    seedRows: Record<string, unknown>[];
    conditionalFormatting?: GeneratedCfBlock[];
    hasFormulas?: boolean;
  }>;
  tierUsed: 'PREMIUM' | 'STANDARD';
  fallbackUsed: boolean;
}

// ──────────────────────────────────────────────────────────────
// CF — typy reguł, które LLM może zaproponować per pole (by fieldKey)
// ──────────────────────────────────────────────────────────────
const CF_RULE_TYPES = new Set(['dataBar', 'colorScale', 'iconSet', 'cellIs']);
/** Pola na których CF ma sens (numeryczne / ratingowe / procentowe). */
const CF_ELIGIBLE_TYPES = new Set(['number', 'currency', 'percent', 'rating']);

/** Indeks kolumny (0-based) → litera Excel (A, B, ..., Z, AA, ...). */
function columnLetter(index: number): string {
  let n = index;
  let letter = '';
  do {
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letter;
}

export interface GenerateTableSchemaOptions {
  orgId: string;
  userId?: string;
  preferPremium?: boolean;
}

// ──────────────────────────────────────────────────────────────
// Fallback — prosty schemat 3 kolumn text, 0 seed rows
// ──────────────────────────────────────────────────────────────
function buildFallbackSchema(): GeneratedTableSchema {
  return {
    fields: [
      { key: 'name', header: 'Nazwa', type: TEXT_FIELD_TYPE },
      { key: 'description', header: 'Opis', type: TEXT_FIELD_TYPE },
      { key: 'status', header: 'Status', type: TEXT_FIELD_TYPE },
    ],
    seedRows: [],
    tierUsed: 'STANDARD',
    fallbackUsed: true,
  };
}

// ──────────────────────────────────────────────────────────────
// Normalizacja + walidacja pól z LLM
// ──────────────────────────────────────────────────────────────
function normalizeType(rawType: unknown): GeneratableFieldType {
  const t = String(rawType ?? '').trim();
  if ((GENERATABLE_FIELD_TYPES as readonly string[]).includes(t)) {
    return t as GeneratableFieldType;
  }
  // Nieprawidłowy / nieznany typ → singleLineText (typ tekstowy katalogu).
  return TEXT_FIELD_TYPE;
}

function sanitizeKey(rawKey: unknown, header: string, index: number): string {
  const base = String(rawKey ?? '').trim() || header;
  const key = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return key || `field_${index + 1}`;
}

/**
 * Normalizuje opcje singleSelect/multiSelect: zapewnia label + hex color.
 * Brakujący/nieprawidłowy kolor → kolor z domyślnej palety (cyklicznie).
 */
function normalizeOptions(rawOptions: unknown): GeneratedFieldOption[] {
  const arr = Array.isArray(rawOptions) ? rawOptions : [];
  const out: GeneratedFieldOption[] = [];
  arr.forEach((opt, i) => {
    const label = String((opt as any)?.label ?? (opt as any)?.name ?? opt ?? '').trim();
    if (!label) return;
    const rawColor = String((opt as any)?.color ?? '').trim();
    const color = HEX_COLOR_REGEX.test(rawColor)
      ? rawColor
      : DEFAULT_OPTION_COLORS[i % DEFAULT_OPTION_COLORS.length];
    out.push({ label, color });
  });
  return out;
}

function normalizeFields(rawFields: unknown): GeneratedField[] {
  const arr = Array.isArray(rawFields) ? rawFields : [];
  const seenKeys = new Set<string>();
  const out: GeneratedField[] = [];

  arr.forEach((raw, index) => {
    const header = String((raw as any)?.header ?? (raw as any)?.name ?? '').trim();
    if (!header) return;

    let key = sanitizeKey((raw as any)?.key, header, index);
    // Deduplikacja kluczy.
    let suffix = 2;
    while (seenKeys.has(key)) {
      key = `${key}_${suffix++}`;
    }
    seenKeys.add(key);

    const type = normalizeType((raw as any)?.type);
    const field: GeneratedField = { key, header, type };

    if (SELECT_TYPES.has(type)) {
      const options = normalizeOptions((raw as any)?.options);
      // singleSelect/multiSelect MUSI mieć opcje — bez nich degradujemy do text.
      if (options.length === 0) {
        field.type = TEXT_FIELD_TYPE;
      } else {
        field.options = options;
      }
    }

    out.push(field);
  });

  return out;
}

/** Canonical form for fuzzy key-matching: strip non-alphanumerics, lowercase. */
function canonicalKey(k: string): string {
  return String(k ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function normalizeSeedRows(
  rawRows: unknown,
  fields: GeneratedField[]
): Record<string, unknown>[] {
  const arr = Array.isArray(rawRows) ? rawRows : [];
  // Map BOTH the exact field key and its canonical (alnum-only) form to the
  // canonical field key. The LLM frequently emits seed-row keys in a different
  // casing/separator than the field key it just declared (e.g. field key
  // `projectname` ← header "Project Name", but row uses `projectName`). A strict
  // equality filter SILENTLY DROPS those cells → empty columns in the
  // materialized table. Fuzzy-match by canonical form to recover them.
  const canonToFieldKey = new Map<string, string>();
  for (const f of fields) {
    canonToFieldKey.set(f.key, f.key); // exact
    const canon = canonicalKey(f.key);
    if (!canonToFieldKey.has(canon)) canonToFieldKey.set(canon, f.key);
  }
  return arr
    .filter((r) => r && typeof r === 'object' && !Array.isArray(r))
    .map((r) => {
      const row: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r as Record<string, unknown>)) {
        const target = canonToFieldKey.get(k) ?? canonToFieldKey.get(canonicalKey(k));
        // First writer wins on collisions (exact key already placed).
        if (target && row[target] === undefined) row[target] = v;
      }
      return row;
    });
}

/**
 * Normalizuje CF z LLM ({fieldKey, rule}) → GeneratedCfBlock[] z A1-ref.
 * - fieldKey musi wskazywać na istniejące pole CF-eligible (number/currency/
 *   percent/rating) — inaczej pomijamy (CF na tekście nie ma sensu).
 * - ref = <col>2:<col><rowCount+1> (od wiersza 2, bo 1 = header).
 * - rule.type musi być znany; nieznane pomijamy.
 */
function normalizeCf(
  rawCf: unknown,
  fields: GeneratedField[],
  rowCount: number
): GeneratedCfBlock[] {
  const arr = Array.isArray(rawCf) ? rawCf : [];
  if (arr.length === 0 || rowCount === 0) return [];

  const keyToIndex = new Map<string, number>();
  fields.forEach((f, i) => keyToIndex.set(f.key, i));

  const out: GeneratedCfBlock[] = [];
  for (const entry of arr) {
    const fieldKey = String((entry as any)?.fieldKey ?? '').trim();
    const rule = (entry as any)?.rule;
    if (!fieldKey || !rule || typeof rule !== 'object') continue;

    const idx = keyToIndex.get(fieldKey);
    if (idx === undefined) continue;
    const field = fields[idx];
    if (!CF_ELIGIBLE_TYPES.has(field.type)) continue;

    const ruleType = String(rule.type ?? '').trim();
    if (!CF_RULE_TYPES.has(ruleType)) continue;

    const col = columnLetter(idx);
    const ref = `${col}2:${col}${rowCount + 1}`;
    out.push({ ref, rules: [{ ...rule, type: ruleType }] });
  }
  return out;
}

// ──────────────────────────────────────────────────────────────
// Walidacja jakości premium (DELIVERABLES_GRAPHIC_PARAMETERS.md)
//   - ≥1 pole typed (nie-text)
//   - każdy singleSelect/multiSelect ma options[] z kolorami hex
//   - seedRows ≥3
// ──────────────────────────────────────────────────────────────
function passesPremiumQuality(schema: {
  fields: GeneratedField[];
  seedRows: Record<string, unknown>[];
}): boolean {
  const { fields, seedRows } = schema;
  if (fields.length === 0) return false;

  const typedCount = fields.filter((f) => f.type !== TEXT_FIELD_TYPE).length;
  if (typedCount < 1) return false;

  for (const f of fields) {
    if (SELECT_TYPES.has(f.type)) {
      if (!f.options || f.options.length === 0) return false;
      if (!f.options.every((o) => o.color && HEX_COLOR_REGEX.test(o.color))) return false;
    }
  }

  if (seedRows.length < 3) return false;

  return true;
}

// ──────────────────────────────────────────────────────────────
// Premium — LLM structured (zod fields[] + seedRows[])
// ──────────────────────────────────────────────────────────────
async function generateViaLlm(
  intent: string,
  orgId: string
): Promise<{
  fields: GeneratedField[];
  seedRows: Record<string, unknown>[];
  conditionalFormatting: GeneratedCfBlock[];
  hasFormulas: boolean;
  sheets?: GeneratedTableSchema['sheets'];
} | null> {
  // Import dynamiczny — unit-testy nie ciągną całego stacku AI.
  const { llmService } = await import('./ai/llmService.js');
  const modelRouter = (await import('./ai/modelRouter.js')).default;
  const { z } = await import('zod');

  const modelCfg = await modelRouter.select({
    capability: 'chat',
    organizationId: orgId,
    options: { tier: 'PREMIUM' },
  });

  const typeList = GENERATABLE_FIELD_TYPES.join(', ');

  const systemPrompt =
    'You are a table schema architect (Airtable-quality). From the user intent, design a ' +
    'TYPED field schema. Pick the RIGHT type per column: singleSelect with colored options for ' +
    'status/category/priority, number for counts, currency for money, percent for ratios, date ' +
    'for deadlines, checkbox for yes/no, singleLineText for short names, longText for notes. ' +
    'Use the `rating` type (a 1–5 star scale) for SCORED EVALUATION columns — performance-review ' +
    'dimensions, scorecard criteria, vendor/quality assessments, satisfaction scores — i.e. any ' +
    'column that grades something on a small bounded scale. Reserve plain `number` for raw counts/' +
    'quantities (hours, units, totals). Use `percent` for any RATIO/DEVIATION column — variance, ' +
    'utilization, growth, completion, margin, attainment vs target — even when the word "variance" ' +
    'appears (a KPI variance is a percentage, not a raw number). Only use `currency` when money is ' +
    'explicit (budget, cost, price, revenue, MRR, "PLN"/"$"/"€"); for a bare quantity column with no ' +
    'money cue (monthly volumes, counts per period), default to `number`, not currency. ' +
    `Allowed field types ONLY: ${typeList}. ` +
    // ── SCOPE FIDELITY: honor the intent literally, do not over-engineer ──
    'SCOPE — match the intent precisely, do NOT pad the schema:\n' +
    '• If the intent ENUMERATES specific columns — whether as a plain comma list ("nazwa, owner, ' +
    'deadline, status") OR as a descriptive list with parentheticals ("severity (4 opcje), likelihood ' +
    '(rating), impact (colorScale)") — produce those columns, plus a single name/identifier column if ' +
    'none is named, plus (only for a register/log/tracker/rejestr) ONE owner column. One field per ' +
    'named item, in order. Do NOT add any further scaffolding (no Description/Status/Deadline/Notes/' +
    'Priority unless the intent names them).\n' +
    '• If the intent states a column/metric count (e.g. "10 kolumn", "8 metryk", "KPIs (SLA, time, ' +
    'error, satisfaction)"), emit EXACTLY that many data columns (plus one identifier column). Treat a ' +
    'parenthetical list as the COMPLETE set, not examples — do NOT add Owner/Status/Variance/Volume/' +
    'Notes/Channel beyond it. A mention of "summary cols" / "total" adds AT MOST one summary column ' +
    '(a single Total/Suma), never a suite of extra analytics (no separate average, growth, attainment, ' +
    'and status columns).\n' +
    '• If the intent imposes a TYPE CONSTRAINT (e.g. "bez singleLineText", "każda kolumna typowana", ' +
    '"no text columns"), obey it for EVERY column — including the identifier: use a typed field ' +
    '(number id, date, or singleSelect code) instead of singleLineText. Zero exceptions.\n' +
    '• When the intent is an open-ended DOMAIN table (a project portfolio, CRM, ops dashboard, risk ' +
    'register), build a RICH but bounded schema — typically 10–12 columns covering the domain\'s key ' +
    'attributes (e.g. a portfolio: name, owner, 1–2 status/phase selects, 2 dates, budget vs actual, ' +
    'progress, variance). Cap at 12 columns.\n' +
    '• If the intent is TERSE and centers on ONE behavior (e.g. "pipeline: highlight value >100k", a ' +
    'single CF/formula demo), build a MINIMAL 4–6 column schema with only the columns that behavior ' +
    'needs — do not flesh out a full domain model. If the intent names essentially ONE data column ' +
    '(e.g. "a table with a kwota column"), keep it to that column plus a label (2–4 columns total).\n' +
    '• If the intent is a DIMENSIONAL MATRIX ("N products × M regions × P months", a cohort/period ' +
    'grid), the period/measure columns are the structure: emit ONE identifier (or two dim) columns + ' +
    'the P period columns + at most ONE total — stay within ~7–9 columns. Period/measure cells are ' +
    '`number` unless money is explicit.\n' +
    // ── KEY CONTRACT: seed-row keys MUST equal field.key verbatim ──
    'KEY CONTRACT — for every column emit a `key` that is lowercase snake_case (e.g. "project_name", ' +
    '"start_date"). Every seed-row object MUST use those EXACT same keys verbatim — never camelCase, ' +
    'never the header text. Mismatched keys make cells disappear.\n' +
    'For singleSelect/multiSelect, ALWAYS provide options[] with a label and a hex color ' +
    '(green #16A34A for good/low, amber #D97706 for medium, red #DC2626 for bad/high). ' +
    'For UNIVERSAL classification vocabularies, use the canonical ENGLISH labels regardless of the ' +
    'intent language, so they read consistently: workflow STATUS = "To Do" / "In Progress" / "Done" ' +
    '(unless the intent implies a richer lifecycle); SEVERITY / PRIORITY = "Critical" / "High" / ' +
    '"Medium" / "Low" (use the subset the intent implies). Translate only domain-specific category ' +
    'labels (e.g. department names) into the intent language.\n' +
    // ── ROW COUNT scaled to intent (default from deliverableDefaults) ──
    `SEED ROWS — provide realistic rows scaled to the intent: if the intent states a row count ` +
    `(e.g. "12 projektów", "8 osób", "10 deals") emit exactly that many. Otherwise default to ` +
    `${TABLE_DEFAULTS.content.seedRows ?? 8} rows — scale up to ~12 for HIGH-VOLUME tables ` +
    `(sales pipeline, CRM, ticket queue, attendee/participant list), scale down to ~5 for terse ` +
    `single-concept tables (a 2-column lookup, a tiny reference list). Never exceed ~12. ` +
    (TABLE_DEFAULTS.content.totalsRow
      ? 'TOTALS ROW — when the table has numeric/currency/percent columns and the archetype ' +
        'implies aggregation (budget, P&L, scorecard, comparison with summary), add ONE totals row ' +
        'at the end with sum/average formulas (e.g. "=SUM(C2:C9)"). Omit for log-style tables ' +
        '(events, tickets, contacts) where a totals row makes no sense. '
      : '') +
    'CRITICAL — COMPLETE ROWS: every seed row object MUST include EVERY field key with a plausible ' +
    'value. This includes ANALYTICAL columns — scores/indices (e.g. a 0–100 readiness index), dates, ' +
    'single-select categories, ratings — fill them with realistic ESTIMATES; do NOT skip a column ' +
    'just because it needs judgment. This applies to "optional-feeling" columns too — notes, comments, ' +
    'resolved/closed dates, secondary fields: fill them with a realistic value (a short note, a plausible ' +
    'date) rather than leaving them blank. A row that omits any field key is INVALID and unusable. ' +
    'Example — risk table: Risk(singleLineText), Likelihood(singleSelect: Low #16A34A / Med #D97706 / High #DC2626), ' +
    'Impact(singleSelect same colors), Owner(singleLineText), Status(singleSelect).\n' +
    'CONDITIONAL FORMATTING (encouraged for numeric columns): in ' +
    '`conditionalFormatting` propose visual rules BY fieldKey (not cell ranges). Match the CF rule ' +
    'type to the column SEMANTICS and to any rule the intent names explicitly:\n' +
    '• dataBar {type:"dataBar", color:"#16A34A"} — progress / utilization / completion percentages.\n' +
    '• colorScale {type:"colorScale", colors:["#DC2626","#F59E0B","#16A34A"]} — VARIANCE, deviation, ' +
    'scores, ratings, retention/cohort heatmaps, anything where low↔high should read as a red→green gradient. ' +
    'ALWAYS use colorScale (not iconSet/dataBar) for a "variance" or "deviation" column.\n' +
    '• iconSet {type:"iconSet", iconSet:"3Arrows"|"3TrafficLights1"} — trend / likelihood / health / ' +
    'satisfaction ratings, and whenever the intent mentions "status icons", "traffic-light", or ' +
    '"icons": attach a 3TrafficLights1 iconSet to a rating or numeric health column (CF cannot target a ' +
    'singleSelect, so route the icon request to the nearest rating/score column).\n' +
    '• cellIs {type:"cellIs", operator:"greaterThan", formulae:["100000"], style:{bgColor:"#DC2626", bold:true}} — threshold highlights.\n' +
    'When the intent explicitly maps a column to a CF type (e.g. "variance jako colorScale", "progress jako dataBar"), ' +
    'you MUST emit that exact pairing. Only attach CF to number/currency/percent/rating columns.\n' +
    'FORMULAS (for calculated columns): when a column is derived from others ' +
    '(total, sum, variance, utilization, bonus = pct × salary), put an Excel formula ' +
    'STRING starting with "=" as the seed value, e.g. "=SUM(B2:I2)", "=H2*I2", "=G2/40". ' +
    'Reference cells by column letter + row number (header is row 1, data starts row 2). ' +
    'MULTI-SHEET WORKBOOK: when the intent describes MULTIPLE named tabs/sheets (e.g. "Summary, OpEx, ' +
    'CapEx, HC", "annual budget workbook", "4 sheety", cross-sheet references) emit a `sheets` array — ' +
    'ONE entry per named sheet, each with its own {name, fields, seedRows}. Keep each sheet focused ' +
    '(3–6 columns, ~6 rows). The first/SUMMARY sheet must be a COMPACT roll-up: a label column plus ' +
    '2–4 total/share columns (NOT a wide detail grid). Give it at least 6 rows: one per other sheet, a ' +
    'grand-total row, and — if that is fewer than 6 — break the larger categories into their main ' +
    'sub-lines (e.g. OpEx → Salaries / Software / Office) so every row is a REAL budget line, never a ' +
    'blank placeholder. For cross-sheet formulas reference other sheets by name, e.g. "=OpEx!B10". When the ' +
    'intent is a single table, OMIT `sheets` entirely. ' +
    'Reply with ONLY a JSON object conforming to the schema.';

  const FieldSchema = z.object({
    key: z.string(),
    header: z.string(),
    type: z.string(),
    options: z
      .array(z.object({ label: z.string(), color: z.string().optional() }))
      .optional(),
  });

  const CfEntrySchema = z.object({
    fieldKey: z.string(),
    rule: z.record(z.string(), z.unknown()),
  });

  const SheetSchema = z.object({
    name: z.string().optional(),
    fields: z.array(FieldSchema),
    seedRows: z.array(z.record(z.string(), z.unknown())),
    conditionalFormatting: z.array(CfEntrySchema).optional(),
  });

  const OutputSchema = z.object({
    fields: z.array(FieldSchema),
    seedRows: z.array(z.record(z.string(), z.unknown())),
    conditionalFormatting: z.array(CfEntrySchema).optional(),
    sheets: z.array(SheetSchema).optional(),
  });

  const result = await (llmService as any).call({
    type: 'structured',
    // env DELIVERABLE_LLM_* overrides the router's pick (cheaper model in prod); else modelCfg.
    modelConfig: deliverableModelConfig(modelCfg as unknown as Record<string, unknown>),
    systemPrompt,
    messages: [{ role: 'user', content: `Table intent: "${intent}"` }],
    schema: OutputSchema,
    // 11 pól × ~8 wierszy JSON nie mieści się w 1800 → ucięcie → puste komórki
    // w późnych kolumnach (zmierzone na tabeli VTS). 4500 daje pełne wiersze;
    // 6000 daje zapas na multi-sheet workbooki (4 arkusze × 6 wierszy).
    maxTokens: 6000,
    temperature: 0.2,
    cache: false,
    timeoutMs: 120000,
  });

  const obj = (result as any)?.object;
  if (!obj || !Array.isArray(obj.fields)) return null;

  const fields = normalizeFields(obj.fields);
  if (fields.length === 0) return null;

  let seedRows = normalizeSeedRows(obj.seedRows, fields);
  let topFields = fields;
  let conditionalFormatting = normalizeCf(obj.conditionalFormatting, fields, seedRows.length);
  const rowsHaveFormula = (rows: Record<string, unknown>[]) =>
    rows.some((row) =>
      Object.values(row).some((v) => typeof v === 'string' && (v as string).trim().startsWith('='))
    );

  // Multi-sheet (optional): normalize each sheet with the same field/row/CF
  // pipeline. Drop any sheet that yields zero valid fields (fail-soft).
  let sheets: GeneratedTableSchema['sheets'];
  if (Array.isArray(obj.sheets) && obj.sheets.length > 0) {
    const normalized = obj.sheets
      .map((s: any, i: number) => {
        const sFields = normalizeFields(s?.fields);
        if (sFields.length === 0) return null;
        const sRows = normalizeSeedRows(s?.seedRows, sFields);
        return {
          name: String(s?.name ?? '').trim() || `Sheet ${i + 1}`,
          fields: sFields,
          seedRows: sRows,
          conditionalFormatting: normalizeCf(s?.conditionalFormatting, sFields, sRows.length),
          hasFormulas: rowsHaveFormula(sRows),
        };
      })
      .filter(Boolean) as NonNullable<GeneratedTableSchema['sheets']>;
    if (normalized.length > 0) sheets = normalized;
  }

  // Multi-sheet workbooks often park the real data in `sheets` and leave the
  // top-level fields/seedRows thin (a placeholder). The top-level schema is what
  // single-table consumers and the quality gate read, so PROMOTE a sheet to
  // top-level when the current top-level is thinner. Prefer the Summary sheet
  // (the natural "front page" of a workbook); else the first sheet.
  if (sheets && sheets.length > 0) {
    const isSummary = (n?: string) => /summary|podsumowanie|przegląd|overview/i.test(n ?? '');
    const lead = sheets.find((s) => isSummary(s.name)) ?? sheets[0];
    if (lead.fields.length > topFields.length) {
      topFields = lead.fields;
      seedRows = lead.seedRows;
      conditionalFormatting = lead.conditionalFormatting ?? [];
    }
  }

  const hasFormulas =
    rowsHaveFormula(seedRows) || (sheets ?? []).some((s) => s.hasFormulas);

  return { fields: topFields, seedRows, conditionalFormatting, hasFormulas, sheets };
}

// ──────────────────────────────────────────────────────────────
// Główna funkcja
// ──────────────────────────────────────────────────────────────
/**
 * Generuje typowany schemat tabeli z intencji NL.
 *
 * @param intent np. "tabela ryzyk projektu"
 * @returns Schemat z polami + seed-rows; PREMIUM (LLM) za flagą, inaczej prosty
 *          fallback. NIGDY nie rzuca — błąd → fallback (fail-open).
 */
export async function generateTableSchema(
  intent: string,
  opts: GenerateTableSchemaOptions
): Promise<GeneratedTableSchema> {
  const { orgId, preferPremium } = opts;

  // 1. Tier (B5 resolver). Fail-open: resolver sam nie rzuca.
  let tier: 'PREMIUM' | 'STANDARD';
  try {
    tier = resolveDeliverableTier({ orgId, preferPremium });
  } catch {
    tier = 'STANDARD';
  }

  // 3. STANDARD → prosty fallback.
  if (tier !== 'PREMIUM') {
    return buildFallbackSchema();
  }

  // 2. PREMIUM → LLM structured. Fail-open na każdym kroku.
  try {
    const llm = await generateViaLlm(intent, orgId);
    if (!llm) {
      logger.warn('[tableSchema] premium LLM returned empty, falling back', {
        purpose: DELIVERABLE_GENERATION_PURPOSE,
        orgId,
      });
      return buildFallbackSchema();
    }

    // 4. Walidacja jakości premium — nie spełnia → fallback.
    if (!passesPremiumQuality(llm)) {
      logger.warn('[tableSchema] premium schema failed quality gate, falling back', {
        purpose: DELIVERABLE_GENERATION_PURPOSE,
        orgId,
        fields: llm.fields.length,
        seedRows: llm.seedRows.length,
      });
      return buildFallbackSchema();
    }

    // 6. Telemetria premium.
    logger.info('[tableSchema] premium plan', {
      purpose: DELIVERABLE_GENERATION_PURPOSE,
      orgId,
      fields: llm.fields.length,
    });

    return {
      fields: llm.fields,
      seedRows: llm.seedRows,
      conditionalFormatting: llm.conditionalFormatting,
      hasFormulas: llm.hasFormulas,
      sheets: llm.sheets,
      tierUsed: 'PREMIUM',
      fallbackUsed: false,
    };
  } catch (err) {
    // 5. Fail-open: błąd LLM → fallback, nigdy nie rzucaj.
    logger.warn('[tableSchema] premium generation failed, falling back', {
      purpose: DELIVERABLE_GENERATION_PURPOSE,
      orgId,
      err: (err as Error)?.message,
    });
    return buildFallbackSchema();
  }
}
