/**
 * Specialized Field Types (Block A · EPIC-T7 · Sprint 3)
 *
 * Adds five first-class field types to the Table Platform:
 *
 *   risk_score · priority · ai_generated_summary · ai_classification ·
 *   source_reference
 *
 * Each type ships a default options preset and a validator. Frontend cell
 * components live in EPIC-T7 / S5 (out of scope here).
 *
 * Two governance contracts that surface in `SchemaValidationService`:
 *
 *   * `AUTO_FIELD_TYPES` (existing, in `SchemaValidationService`) rejects
 *     manual writes from clients — used for `createdTime`, `autoNumber`, …
 *
 *   * `AI_REGEN_FIELD_TYPES` (new, this file) is a SEPARATE set used by
 *     `TableAiEditorService` (Block C) to know which fields to recompute
 *     when source data changes. Manual writes are still ALLOWED — they are
 *     audited as `manual_override = true` so reviewers can spot fields the
 *     AI re-derived later. (A-S0-F5 contract.)
 */

// ── Type union and defaults ─────────────────────────────────────────────────

export const SPECIALIZED_FIELD_TYPES = [
  'risk_score',
  'priority',
  'ai_generated_summary',
  'ai_classification',
  'source_reference',
] as const;

export type SpecializedFieldType = (typeof SPECIALIZED_FIELD_TYPES)[number];

export const AI_REGEN_FIELD_TYPES = new Set<SpecializedFieldType>([
  'ai_generated_summary',
  'ai_classification',
]);

export const RISK_SCORE_VALID_SCALES = [3, 5, 25] as const;
export type RiskScoreScale = (typeof RISK_SCORE_VALID_SCALES)[number];

export const PRIORITY_LEVEL_PRESETS = {
  P0_P1_P2_P3: ['P0', 'P1', 'P2', 'P3'],
  CRITICAL_HIGH_MEDIUM_LOW: ['critical', 'high', 'medium', 'low'],
} as const;

export type PriorityLevelPreset = keyof typeof PRIORITY_LEVEL_PRESETS;

export const AI_SUMMARY_MAX_CHARS_HARD_LIMIT = 2000;
export const AI_PROMPT_TEMPLATE_MAX_LENGTH = 2000;
export const AI_CLASSIFICATION_MIN_CLASSES = 2;
export const AI_CLASSIFICATION_MAX_CLASSES = 50;
export const SOURCE_REFERENCE_MAX_EXTERNAL_URL = 2048;

export interface RiskScoreOptions {
  scale: RiskScoreScale;
  axes?: {
    likelihood?: number;
    impact?: number;
  };
}

export interface PriorityOptions {
  levels: PriorityLevelPreset;
  defaultLevel?: string;
}

export interface AiGeneratedSummaryOptions {
  prompt_template: string;
  max_chars: number;
  recompute_on: string[];
  aiAuto?: boolean;
}

export interface AiClassificationOptions {
  classes: string[];
  prompt_template: string;
  aiAuto?: boolean;
}

export interface SourceReferenceOptions {
  allow_external: boolean;
}

export type SpecializedFieldOptions =
  | RiskScoreOptions
  | PriorityOptions
  | AiGeneratedSummaryOptions
  | AiClassificationOptions
  | SourceReferenceOptions;

const DEFAULTS: Record<SpecializedFieldType, SpecializedFieldOptions> = {
  risk_score: { scale: 25, axes: { likelihood: 5, impact: 5 } },
  priority: { levels: 'P0_P1_P2_P3', defaultLevel: 'P2' },
  ai_generated_summary: {
    prompt_template: 'Summarize record in ≤200 chars',
    max_chars: 200,
    recompute_on: [],
  },
  ai_classification: {
    classes: ['option_a', 'option_b'],
    prompt_template: 'Classify the record',
  },
  source_reference: { allow_external: false },
};

// ── Public helpers ──────────────────────────────────────────────────────────

export function isSpecializedFieldType(t: unknown): t is SpecializedFieldType {
  return typeof t === 'string' && (SPECIALIZED_FIELD_TYPES as readonly string[]).includes(t);
}

/**
 * Returns a deep-cloned copy of the default options for a specialised type.
 * Callers MUST NOT mutate the global presets directly.
 */
export function defaultOptionsFor(type: SpecializedFieldType): SpecializedFieldOptions {
  const preset = DEFAULTS[type];
  return JSON.parse(JSON.stringify(preset)) as SpecializedFieldOptions;
}

/**
 * Returns the matrix dimension for a `risk_score` field. 5×5 → 5, 3×3 → 3,
 * legacy 5×5 (scale=25) → 5. Returns `null` for unknown scales.
 */
export function riskScoreMatrixSize(scale: number | undefined): number | null {
  if (scale === 25 || scale === 5) return 5;
  if (scale === 3) return 3;
  return null;
}

/**
 * Returns the allowed string values for a priority preset.
 */
export function priorityValuesFor(levels: PriorityLevelPreset | string): readonly string[] {
  const preset = (PRIORITY_LEVEL_PRESETS as Record<string, readonly string[]>)[String(levels)];
  return preset ?? [];
}

// ── Options-shape validation ────────────────────────────────────────────────

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function ok(): ValidationResult {
  return { valid: true, errors: [] };
}

function fail(...errors: string[]): ValidationResult {
  return { valid: false, errors };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

function isPositiveInteger(v: unknown, max?: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && (max === undefined || v <= max);
}

function validateRiskScoreOptions(options: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const scaleRaw = options.scale ?? 25;
  const scale = Number(scaleRaw);
  if (!(RISK_SCORE_VALID_SCALES as readonly number[]).includes(scale)) {
    errors.push(
      `risk_score.scale must be one of ${RISK_SCORE_VALID_SCALES.join(', ')} (got: ${String(
        scaleRaw
      )})`
    );
  }

  const axesRaw = options.axes;
  if (axesRaw != null) {
    if (!isPlainObject(axesRaw)) {
      errors.push('risk_score.axes must be an object');
    } else {
      const matrixDim = riskScoreMatrixSize(scale);
      const cap = matrixDim ?? 5;
      const likelihood = axesRaw.likelihood;
      const impact = axesRaw.impact;
      if (likelihood != null && !isPositiveInteger(likelihood, cap)) {
        errors.push(`risk_score.axes.likelihood must be an integer between 1 and ${cap}`);
      }
      if (impact != null && !isPositiveInteger(impact, cap)) {
        errors.push(`risk_score.axes.impact must be an integer between 1 and ${cap}`);
      }
    }
  }

  return errors.length === 0 ? ok() : fail(...errors);
}

function validatePriorityOptions(options: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const levels = String(options.levels ?? 'P0_P1_P2_P3');
  const allowed = priorityValuesFor(levels);
  if (allowed.length === 0) {
    errors.push(
      `priority.levels must be one of ${Object.keys(PRIORITY_LEVEL_PRESETS).join(
        ', '
      )} (got: ${levels})`
    );
  }
  if (options.defaultLevel != null) {
    const dl = String(options.defaultLevel);
    if (allowed.length > 0 && !allowed.includes(dl)) {
      errors.push(
        `priority.defaultLevel '${dl}' is not in preset '${levels}' (allowed: ${allowed.join(
          ', '
        )})`
      );
    }
  }
  return errors.length === 0 ? ok() : fail(...errors);
}

function validateAiSummaryOptions(options: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const tpl = options.prompt_template;
  if (tpl != null) {
    if (typeof tpl !== 'string') {
      errors.push('ai_generated_summary.prompt_template must be a string');
    } else if (tpl.length > AI_PROMPT_TEMPLATE_MAX_LENGTH) {
      errors.push(
        `ai_generated_summary.prompt_template exceeds ${AI_PROMPT_TEMPLATE_MAX_LENGTH} characters`
      );
    }
  }
  if (options.max_chars != null) {
    if (!isPositiveInteger(options.max_chars, AI_SUMMARY_MAX_CHARS_HARD_LIMIT)) {
      errors.push(
        `ai_generated_summary.max_chars must be an integer between 1 and ${AI_SUMMARY_MAX_CHARS_HARD_LIMIT}`
      );
    }
  }
  if (options.recompute_on != null) {
    if (!Array.isArray(options.recompute_on)) {
      errors.push('ai_generated_summary.recompute_on must be an array of field IDs');
    } else {
      for (const id of options.recompute_on) {
        if (typeof id !== 'string' || id.length === 0) {
          errors.push('ai_generated_summary.recompute_on entries must be non-empty strings');
          break;
        }
      }
    }
  }
  if (options.aiAuto != null && typeof options.aiAuto !== 'boolean') {
    errors.push('ai_generated_summary.aiAuto must be a boolean');
  }
  return errors.length === 0 ? ok() : fail(...errors);
}

function validateAiClassificationOptions(options: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const classes = options.classes;
  if (!Array.isArray(classes)) {
    errors.push('ai_classification.classes must be an array of strings');
  } else {
    if (classes.length < AI_CLASSIFICATION_MIN_CLASSES) {
      errors.push(
        `ai_classification.classes must contain at least ${AI_CLASSIFICATION_MIN_CLASSES} entries`
      );
    }
    if (classes.length > AI_CLASSIFICATION_MAX_CLASSES) {
      errors.push(
        `ai_classification.classes must contain at most ${AI_CLASSIFICATION_MAX_CLASSES} entries`
      );
    }
    const seen = new Set<string>();
    for (const c of classes) {
      if (typeof c !== 'string' || c.length === 0) {
        errors.push('ai_classification.classes entries must be non-empty strings');
        break;
      }
      if (seen.has(c)) {
        errors.push(`ai_classification.classes contains duplicate value '${c}'`);
        break;
      }
      seen.add(c);
    }
  }
  const tpl = options.prompt_template;
  if (tpl != null) {
    if (typeof tpl !== 'string') {
      errors.push('ai_classification.prompt_template must be a string');
    } else if (tpl.length > AI_PROMPT_TEMPLATE_MAX_LENGTH) {
      errors.push(
        `ai_classification.prompt_template exceeds ${AI_PROMPT_TEMPLATE_MAX_LENGTH} characters`
      );
    }
  }
  if (options.aiAuto != null && typeof options.aiAuto !== 'boolean') {
    errors.push('ai_classification.aiAuto must be a boolean');
  }
  return errors.length === 0 ? ok() : fail(...errors);
}

function validateSourceReferenceOptions(options: Record<string, unknown>): ValidationResult {
  if (options.allow_external != null && typeof options.allow_external !== 'boolean') {
    return fail('source_reference.allow_external must be a boolean');
  }
  return ok();
}

/**
 * Dispatches to the per-type options validator. Unknown / non-specialised
 * types short-circuit as `{ valid: true, errors: [] }` so the caller
 * (`SchemaValidationService.validateFieldOptions`) can chain this safely.
 */
export function validateSpecializedField(fieldType: string, options: unknown): ValidationResult {
  if (!isSpecializedFieldType(fieldType)) return ok();
  if (options == null) return ok();
  if (!isPlainObject(options)) {
    return fail(`${fieldType} options must be an object`);
  }

  switch (fieldType) {
    case 'risk_score':
      return validateRiskScoreOptions(options);
    case 'priority':
      return validatePriorityOptions(options);
    case 'ai_generated_summary':
      return validateAiSummaryOptions(options);
    case 'ai_classification':
      return validateAiClassificationOptions(options);
    case 'source_reference':
      return validateSourceReferenceOptions(options);
    default:
      return ok();
  }
}

// ── Runtime value validation (used by SchemaValidationService.validateRecord) ─

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ValueCheckResult {
  ok: boolean;
  message?: string;
}

/**
 * Validates a single record cell value for one of the specialised field
 * types. Returns `{ok: true}` on success or `{ok: false, message}` on
 * failure. Caller is responsible for adding the field name / id to the
 * surfaced error.
 *
 * NULL / undefined values are accepted at this layer (required-field
 * checks are handled separately by `validateRecord`).
 */
export function checkSpecializedFieldValue(
  fieldType: SpecializedFieldType,
  value: unknown,
  options: unknown
): ValueCheckResult {
  if (value === null || value === undefined) return { ok: true };
  const opts = isPlainObject(options) ? options : {};

  switch (fieldType) {
    case 'risk_score': {
      const scaleRaw = opts.scale ?? 25;
      const scale = Number(scaleRaw);
      if (!(RISK_SCORE_VALID_SCALES as readonly number[]).includes(scale)) {
        return {
          ok: false,
          message: `risk_score field has an invalid scale (${String(scaleRaw)})`,
        };
      }
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        return { ok: false, message: 'risk_score value must be an integer' };
      }
      if (value < 1 || value > scale) {
        return {
          ok: false,
          message: `risk_score value must be between 1 and ${scale}`,
        };
      }
      return { ok: true };
    }
    case 'priority': {
      const levels = String(opts.levels ?? 'P0_P1_P2_P3');
      const allowed = priorityValuesFor(levels);
      if (allowed.length === 0) {
        return { ok: false, message: `priority field has unknown levels '${levels}'` };
      }
      if (typeof value !== 'string') {
        return { ok: false, message: 'priority value must be a string' };
      }
      if (!allowed.includes(value)) {
        return {
          ok: false,
          message: `priority value '${value}' is not in preset '${levels}' (allowed: ${allowed.join(
            ', '
          )})`,
        };
      }
      return { ok: true };
    }
    case 'ai_generated_summary': {
      if (typeof value !== 'string') {
        return { ok: false, message: 'ai_generated_summary value must be a string' };
      }
      const maxRaw = opts.max_chars;
      const max = isPositiveInteger(maxRaw, AI_SUMMARY_MAX_CHARS_HARD_LIMIT)
        ? (maxRaw as number)
        : 200;
      if (value.length > max) {
        return {
          ok: false,
          message: `ai_generated_summary value exceeds max_chars=${max}`,
        };
      }
      return { ok: true };
    }
    case 'ai_classification': {
      const classes = Array.isArray(opts.classes)
        ? (opts.classes as unknown[]).filter((c): c is string => typeof c === 'string')
        : [];
      if (classes.length === 0) {
        return {
          ok: false,
          message: 'ai_classification field has no configured classes',
        };
      }
      if (typeof value !== 'string') {
        return { ok: false, message: 'ai_classification value must be a string' };
      }
      if (!classes.includes(value)) {
        return {
          ok: false,
          message: `ai_classification value '${value}' is not in configured classes (${classes.join(
            ', '
          )})`,
        };
      }
      return { ok: true };
    }
    case 'source_reference': {
      const allowExternal = opts.allow_external === true;
      // Accept either a UUID string (a tp_record_sources.id) or a structured
      // object {source_id?, external_url?}. When allow_external = false the
      // caller MUST provide a UUID source_id.
      if (typeof value === 'string') {
        if (UUID_REGEX.test(value)) return { ok: true };
        if (!allowExternal) {
          return {
            ok: false,
            message: 'source_reference value must be a UUID (allow_external is false)',
          };
        }
        if (value.length === 0) {
          return { ok: false, message: 'source_reference value is empty' };
        }
        if (value.length > SOURCE_REFERENCE_MAX_EXTERNAL_URL) {
          return {
            ok: false,
            message: `source_reference external value exceeds ${SOURCE_REFERENCE_MAX_EXTERNAL_URL} chars`,
          };
        }
        return { ok: true };
      }
      if (isPlainObject(value)) {
        const sid = (value as { source_id?: unknown }).source_id;
        const ext = (value as { external_url?: unknown }).external_url;
        if (sid != null) {
          if (typeof sid !== 'string' || !UUID_REGEX.test(sid)) {
            return {
              ok: false,
              message: 'source_reference.source_id must be a UUID string',
            };
          }
          return { ok: true };
        }
        if (ext != null) {
          if (!allowExternal) {
            return {
              ok: false,
              message: 'source_reference.external_url is not allowed (allow_external = false)',
            };
          }
          if (typeof ext !== 'string' || ext.length === 0) {
            return {
              ok: false,
              message: 'source_reference.external_url must be a non-empty string',
            };
          }
          if (ext.length > SOURCE_REFERENCE_MAX_EXTERNAL_URL) {
            return {
              ok: false,
              message: `source_reference.external_url exceeds ${SOURCE_REFERENCE_MAX_EXTERNAL_URL} chars`,
            };
          }
          return { ok: true };
        }
        return {
          ok: false,
          message: 'source_reference object must contain `source_id` or `external_url`',
        };
      }
      return { ok: false, message: 'source_reference value must be a string or object' };
    }
    default:
      return { ok: true };
  }
}
