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
} from './deliverableGenerationTier.js';

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

function normalizeSeedRows(
  rawRows: unknown,
  fields: GeneratedField[]
): Record<string, unknown>[] {
  const arr = Array.isArray(rawRows) ? rawRows : [];
  const validKeys = new Set(fields.map((f) => f.key));
  return arr
    .filter((r) => r && typeof r === 'object' && !Array.isArray(r))
    .map((r) => {
      const row: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r as Record<string, unknown>)) {
        if (validKeys.has(k)) row[k] = v;
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
    `Allowed field types ONLY: ${typeList}. ` +
    'For singleSelect/multiSelect, ALWAYS provide options[] with a label and a hex color ' +
    '(green #16A34A for good/low, amber #D97706 for medium, red #DC2626 for bad/high). ' +
    'Provide 3-5 realistic seed rows keyed by field key. ' +
    'Example — risk table: Risk(singleLineText), Likelihood(singleSelect: Low #16A34A / Med #D97706 / High #DC2626), ' +
    'Impact(singleSelect same colors), Owner(singleLineText), Status(singleSelect).\n' +
    'CONDITIONAL FORMATTING (optional but encouraged for numeric columns): in ' +
    '`conditionalFormatting` propose visual rules BY fieldKey (not cell ranges). ' +
    'Rule types: dataBar {type:"dataBar", color:"#16A34A"} for progress/utilization; ' +
    'colorScale {type:"colorScale", colors:["#DC2626","#F59E0B","#16A34A"]} for scores/ratings/variance heatmaps; ' +
    'iconSet {type:"iconSet", iconSet:"3Arrows"|"3TrafficLights1"} for likelihood/status ratings; ' +
    'cellIs {type:"cellIs", operator:"greaterThan", formulae:["100000"], style:{bgColor:"#DC2626", bold:true}} for thresholds. ' +
    'Only attach CF to number/currency/percent/rating columns.\n' +
    'FORMULAS (for calculated columns): when a column is derived from others ' +
    '(total, sum, variance, utilization, bonus = pct × salary), put an Excel formula ' +
    'STRING starting with "=" as the seed value, e.g. "=SUM(B2:I2)", "=H2*I2", "=G2/40". ' +
    'Reference cells by column letter + row number (header is row 1, data starts row 2). ' +
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

  const OutputSchema = z.object({
    fields: z.array(FieldSchema),
    seedRows: z.array(z.record(z.string(), z.unknown())),
    conditionalFormatting: z.array(CfEntrySchema).optional(),
  });

  const result = await (llmService as any).call({
    type: 'structured',
    modelConfig: modelCfg,
    systemPrompt,
    messages: [{ role: 'user', content: `Table intent: "${intent}"` }],
    schema: OutputSchema,
    maxTokens: 1800,
    temperature: 0.2,
    cache: false,
  });

  const obj = (result as any)?.object;
  if (!obj || !Array.isArray(obj.fields)) return null;

  const fields = normalizeFields(obj.fields);
  if (fields.length === 0) return null;

  const seedRows = normalizeSeedRows(obj.seedRows, fields);
  const conditionalFormatting = normalizeCf(obj.conditionalFormatting, fields, seedRows.length);
  const hasFormulas = seedRows.some((row) =>
    Object.values(row).some((v) => typeof v === 'string' && (v as string).trim().startsWith('='))
  );
  return { fields, seedRows, conditionalFormatting, hasFormulas };
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
