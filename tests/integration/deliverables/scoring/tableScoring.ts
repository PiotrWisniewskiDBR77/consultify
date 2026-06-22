/**
 * tableScoring — scoring engine dla M20 (tabele).
 *
 * Bierze GeneratedTableSchema (z B4) + opcjonalnie WorkbookSchema + xlsx buffer
 * (z WorkbookBuilder), sprawdza:
 * - field types (typed schema, NIE same singleLineText)
 * - singleSelect/multiSelect options z hex colors
 * - seedRows ≥3
 * - CF rules (jeśli requireCF=true)
 * - formuły (jeśli requireFormulas=true)
 * - multi-sheet (jeśli multiSheet=true)
 */

import { emptyReport, finalize, ReportBuilder, type ScoreReport } from './scoringTypes.js';

// ──────────────────────────────────────────────────────────────
// Minimal Table shapes
// ──────────────────────────────────────────────────────────────

export interface TableFieldOption {
  label: string;
  color?: string;
}

export interface TableField {
  key: string;
  header: string;
  type: string;
  options?: TableFieldOption[];
}

export interface GeneratedTable {
  fields: TableField[];
  seedRows: Record<string, unknown>[];
  /** Opcjonalnie: CF rules per range (X2). */
  conditionalFormatting?: Array<{
    ref: string;
    rules: Array<{ type: string; [k: string]: any }>;
  }>;
  /** Opcjonalnie: formuły per cell (gdy schema wspiera). */
  hasFormulas?: boolean;
  /** Multi-sheet (gdy generator zwraca wieloarkuszowy schema). */
  sheets?: GeneratedTable[];
}

// ──────────────────────────────────────────────────────────────
// Type catalogs (mirror tableSchemaGeneratorService)
// ──────────────────────────────────────────────────────────────

const TYPED_FIELDS = new Set([
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
]);

const SELECT_TYPES = new Set(['singleSelect', 'multiSelect']);

const HEX_RX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// ──────────────────────────────────────────────────────────────
// Table-specific criteria DSL
// ──────────────────────────────────────────────────────────────

export interface TableCriteria {
  scenarioId: string;
  // Substantive
  minFields: number;
  maxFields: number;
  minRows: number;
  maxRows?: number;
  /** Wymagane typy pól + min liczba. */
  requireFieldType?: Array<{ type: string; min: number }>;
  /** Typy zakazane (constraint test). */
  forbidFieldType?: string[];
  /** SingleSelect/multiSelect który MUSI mieć N opcji. */
  requireSelectOptions?: Array<{ fieldHint: string; minOptions: number; maxOptions?: number }>;
  /** Konkretne opcje muszą istnieć w singleSelect (np Low/Med/High). */
  requireSelectLabels?: Array<{ fieldHint: string; labels: string[] }>;
  // Graphic
  /** Wszystkie singleSelect/multiSelect mają hex w options. */
  requireSelectColors?: boolean;
  /** Min N typed fields (nie sam singleLineText). */
  minTypedFields?: number;
  /** Min distinct field types. */
  minDistinctFieldTypes?: number;
  /** Wymagaj CF rule określonego typu. */
  requireCfRule?: Array<{ type: 'dataBar' | 'colorScale' | 'iconSet' | 'cellIs'; min: number }>;
  /** Formuły obecne w cells. */
  requireFormulas?: boolean;
  /** Multi-sheet workbook. */
  requireMultiSheet?: { minSheets: number };
  /** Semantic palette check — gdy field hint zawiera "severity"/"status" — colors zgodne z traffic-light. */
  expectTrafficLightColors?: Array<{ fieldHint: string }>;
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function findField(table: GeneratedTable, hint: string): TableField | undefined {
  const hintLower = hint.toLowerCase();
  return table.fields.find(
    (f) =>
      f.key.toLowerCase().includes(hintLower) ||
      f.header.toLowerCase().includes(hintLower)
  );
}

// ──────────────────────────────────────────────────────────────
// Scoring
// ──────────────────────────────────────────────────────────────

export function scoreTable(table: GeneratedTable, criteria: TableCriteria): ScoreReport {
  const report = emptyReport(criteria.scenarioId);
  const b = new ReportBuilder(report);
  const fields = table?.fields ?? [];

  // ── Substantive ──────────────────────────────────────────────
  b.expectCount(
    fields,
    criteria.minFields,
    criteria.maxFields,
    'field count',
    'substantive',
    'B4 LLM nie generuje wymaganej liczby kolumn — prompt może być zbyt ogólny'
  );

  const rowCount = table.seedRows?.length ?? 0;
  b.expect(
    rowCount >= criteria.minRows && (!criteria.maxRows || rowCount <= criteria.maxRows),
    'seed row count',
    `${criteria.minRows}${criteria.maxRows ? `-${criteria.maxRows}` : '+'}`,
    String(rowCount),
    'substantive',
    'B4 quality-gate wymaga seed≥3; sprawdź normalizeSeedRows'
  );

  if (criteria.requireFieldType) {
    for (const req of criteria.requireFieldType) {
      const count = fields.filter((f) => f.type === req.type).length;
      b.expect(
        count >= req.min,
        `requireFieldType ${req.type}`,
        `≥${req.min}`,
        String(count),
        'substantive',
        `LLM nie infera ${req.type} — wzmocnij prompt example w B4`
      );
    }
  }

  if (criteria.forbidFieldType) {
    for (const forbidden of criteria.forbidFieldType) {
      const count = fields.filter((f) => f.type === forbidden).length;
      b.expect(
        count === 0,
        `forbidFieldType ${forbidden}`,
        '0',
        String(count),
        'substantive',
        `Constraint: LLM ucieka w ${forbidden} — EXPLICIT exclusion w prompt`
      );
    }
  }

  if (criteria.requireSelectOptions) {
    for (const req of criteria.requireSelectOptions) {
      const field = findField(table, req.fieldHint);
      const optCount = field?.options?.length ?? 0;
      const minOk = optCount >= req.minOptions;
      const maxOk = !req.maxOptions || optCount <= req.maxOptions;
      b.expect(
        minOk && maxOk,
        `select ${req.fieldHint} options`,
        `${req.minOptions}${req.maxOptions ? `-${req.maxOptions}` : '+'}`,
        String(optCount),
        'substantive',
        `B4 prompt: dokładny count opcji dla "${req.fieldHint}" w przykładach`
      );
    }
  }

  if (criteria.requireSelectLabels) {
    // Normalizujemy: lowercase + usuwamy spacje/myślniki/underscores
    // — żeby "To Do" / "to-do" / "to_do" / "todo" pasowały do "todo".
    const normalize = (s: string) => s.toLowerCase().replace(/[\s_\-]+/g, '');
    for (const req of criteria.requireSelectLabels) {
      const field = findField(table, req.fieldHint);
      const labels = (field?.options ?? []).map((o) => normalize(o.label));
      const missing = req.labels.filter((l) => !labels.some((lb) => lb.includes(normalize(l))));
      b.expect(
        missing.length === 0,
        `select ${req.fieldHint} required labels`,
        `[${req.labels.join(', ')}]`,
        missing.length ? `missing [${missing.join(', ')}]` : 'ok',
        'substantive',
        `LLM tworzy nazwy opcji odmienne od wymaganych — strong hint w prompt`
      );
    }
  }

  // ── Graphic ──────────────────────────────────────────────────

  if (criteria.requireSelectColors ?? true) {
    const selectFields = fields.filter((f) => SELECT_TYPES.has(f.type));
    for (const field of selectFields) {
      const opts = field.options ?? [];
      const withHex = opts.filter((o) => o.color && HEX_RX.test(o.color)).length;
      b.expect(
        opts.length === 0 || withHex === opts.length,
        `select colors (${field.key})`,
        `${opts.length} options with hex`,
        `${withHex}/${opts.length}`,
        'graphic',
        `B4 quality-gate (select-y mają hex) — sprawdź normalizeOptions w tableSchemaGeneratorService`
      );
    }
  }

  if (criteria.minTypedFields) {
    const typed = fields.filter((f) => TYPED_FIELDS.has(f.type)).length;
    b.expect(
      typed >= criteria.minTypedFields,
      'typed fields',
      `≥${criteria.minTypedFields}`,
      String(typed),
      'graphic',
      `LLM zwraca sam singleLineText — B4 quality-gate wymaga ≥1; może wymagać podbicia`
    );
  }

  if (criteria.minDistinctFieldTypes) {
    const distinct = new Set(fields.map((f) => f.type)).size;
    b.expect(
      distinct >= criteria.minDistinctFieldTypes,
      'distinct field types',
      `≥${criteria.minDistinctFieldTypes}`,
      String(distinct),
      'graphic',
      'Schema zbyt jednorodny — wzmocnij prompt o różnorodności typów'
    );
  }

  if (criteria.requireCfRule) {
    const cfBlocks = table.conditionalFormatting ?? [];
    for (const req of criteria.requireCfRule) {
      const count = cfBlocks.reduce(
        (acc, blk) => acc + blk.rules.filter((r) => r.type === req.type).length,
        0
      );
      b.expect(
        count >= req.min,
        `CF rule ${req.type}`,
        `≥${req.min}`,
        String(count),
        'graphic',
        `B4 nie generuje CF — X2 schema wspiera; rozszerz B4 prompt o CF dla danych numerycznych/statusowych`
      );
    }
  }

  if (criteria.requireFormulas) {
    const hasFormulas = table.hasFormulas === true ||
      table.seedRows.some((row) =>
        Object.values(row).some((v) => typeof v === 'string' && (v as string).startsWith('='))
      );
    b.expect(
      hasFormulas,
      'has formulas',
      'at least one formula cell',
      hasFormulas ? 'ok' : '0 formulas',
      'graphic',
      `B4 hardcoduje wartości — wzmocnij prompt: "calculated columns use Excel formulas"`
    );
  }

  if (criteria.requireMultiSheet) {
    const sheets = table.sheets ?? [];
    b.expect(
      sheets.length >= criteria.requireMultiSheet.minSheets,
      'multi-sheet',
      `≥${criteria.requireMultiSheet.minSheets} sheets`,
      String(sheets.length),
      'graphic',
      `B4 zwraca single-sheet — rozszerz schema o sheets[] gdy multi-sheet wymagany`
    );
  }

  if (criteria.expectTrafficLightColors) {
    for (const req of criteria.expectTrafficLightColors) {
      const field = findField(table, req.fieldHint);
      const opts = field?.options ?? [];
      const colors = opts.map((o) => (o.color ?? '').toUpperCase());
      const hasRed = colors.some((c) => c.includes('DC2626') || c.includes('EF4444'));
      const hasGreen = colors.some((c) => c.includes('16A34A') || c.includes('22C55E'));
      // Amber opcjonalnie — pasuje gdy 3+ opcji.
      const hasAmber =
        opts.length < 3 ||
        colors.some((c) => c.includes('D97706') || c.includes('F59E0B') || c.includes('FBBF24'));
      const pass = hasRed && hasGreen && hasAmber;
      b.expect(
        pass,
        `traffic-light colors (${req.fieldHint})`,
        'red + amber + green semantic',
        `R=${hasRed} A=${hasAmber} G=${hasGreen}`,
        'graphic',
        `Status/severity bez semantic colors — wzmocnij B4 prompt example "risk = traffic-light"`
      );
    }
  }

  const totalCriteria =
    1 + // field count
    1 + // row count
    (criteria.requireFieldType?.length ?? 0) +
    (criteria.forbidFieldType?.length ?? 0) +
    (criteria.requireSelectOptions?.length ?? 0) +
    (criteria.requireSelectLabels?.length ?? 0) +
    ((criteria.requireSelectColors ?? true)
      ? fields.filter((f) => SELECT_TYPES.has(f.type)).length
      : 0) +
    (criteria.minTypedFields ? 1 : 0) +
    (criteria.minDistinctFieldTypes ? 1 : 0) +
    (criteria.requireCfRule?.length ?? 0) +
    (criteria.requireFormulas ? 1 : 0) +
    (criteria.requireMultiSheet ? 1 : 0) +
    (criteria.expectTrafficLightColors?.length ?? 0);

  return finalize(report, totalCriteria);
}
