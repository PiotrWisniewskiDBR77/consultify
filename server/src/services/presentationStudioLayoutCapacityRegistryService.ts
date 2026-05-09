/**
 * Presentation Studio Layout Capacity Registry (Sprint S13).
 *
 * Source of truth:
 *   - .cursor/MODULE_DELIVERY_CONTRACT_STANDARD.md
 *   - consultify/docs/product/CONSULTIFY_PRESENTATION_STUDIO_100_PERCENT_IMPLEMENTATION_CONTRACT_2026-05-08.md
 *   - WP-06 carry / MT-PRES-042.
 *
 * Centralized, hot-reloadable container for the slot capacity numbers
 * that the layout audit consults. Before S13 these numbers lived in
 * static `const` maps inside the audit module, which meant any tweak —
 * even an opportunistic one — required a code deploy. The registry
 * reframes them as runtime configuration that:
 *
 *   - ships with conservative canonical defaults (the same numbers
 *     committed in S10 + the per-family overrides from S11);
 *   - validates and merges JSON-shaped overrides via `applyOverrides`,
 *     so an operator can ship a tenant-specific or family-specific
 *     adjustment without a code change (today via test injection,
 *     tomorrow via a config endpoint or a watched JSON file);
 *   - exposes `resetToDefaults()` for test isolation so each test
 *     starts from the same canonical baseline.
 *
 * Tenant scoping is intentionally NOT introduced in S13 — the registry
 * is process-global. Per-tenant overrides are a follow-up that needs an
 * explicit data model (the ticket service already uses `organizationId`
 * scoping; the registry would mirror that). We surface the open work as
 * a documented risk on the gate report.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type LayoutCapacityDensityKey = 'visual' | 'balanced' | 'document';

export interface LayoutSlotCapacity {
  titleMaxChars: number;
  /**
   * `keyMessage` budget. For multi-line keymessages we count total
   * characters; an explicit per-line cap is renderer-specific and lives
   * in the renderer.
   */
  keyMessageMaxChars: number;
  /** Maximum number of suggested blocks (bullets, content tiles) on the slide. */
  blocksMax: number;
}

export type LayoutSlotCapacityOverride = Partial<LayoutSlotCapacity>;

export type LayoutFamilyOverrides = Partial<
  Record<LayoutCapacityDensityKey, LayoutSlotCapacityOverride>
>;

export interface LayoutCapacityOverridesPayload {
  /** Override the canonical density baselines globally. */
  densityBudgets?: Partial<Record<LayoutCapacityDensityKey, LayoutSlotCapacityOverride>>;
  /** Override per-template-family caps. Family keys must be canonical display names. */
  templateFamilyOverrides?: Record<string, LayoutFamilyOverrides>;
  /**
   * Add / override raw deck-type → canonical family alias entries. Lets
   * an operator register a new deck type without a code change.
   */
  familyAliasByDeckType?: Record<string, string>;
}

export interface LayoutCapacityValidationError {
  path: string;
  reason: string;
}

export interface LayoutCapacityApplyResult {
  ok: boolean;
  applied: boolean;
  errors: LayoutCapacityValidationError[];
}

// ---------------------------------------------------------------------------
// Canonical defaults — moved here in S13. The numbers match what was in
// the audit module from S10 + S11. Any future change to these values
// must come with a corresponding test update.
// ---------------------------------------------------------------------------

const DEFAULT_DENSITY_BUDGETS: Readonly<Record<LayoutCapacityDensityKey, LayoutSlotCapacity>> = {
  visual: { titleMaxChars: 80, keyMessageMaxChars: 160, blocksMax: 4 },
  balanced: { titleMaxChars: 90, keyMessageMaxChars: 240, blocksMax: 6 },
  document: { titleMaxChars: 110, keyMessageMaxChars: 360, blocksMax: 8 },
};

const DEFAULT_TEMPLATE_FAMILY_OVERRIDES: Readonly<Record<string, LayoutFamilyOverrides>> = {
  'Steering Committee Deck': {
    balanced: { titleMaxChars: 110, keyMessageMaxChars: 280, blocksMax: 7 },
    document: { titleMaxChars: 130, keyMessageMaxChars: 420, blocksMax: 10 },
  },
  'Board Decision Deck': {
    balanced: { titleMaxChars: 100, keyMessageMaxChars: 280, blocksMax: 6 },
  },
  'DRD Diagnostic Deck': {
    document: { titleMaxChars: 110, keyMessageMaxChars: 480, blocksMax: 9 },
  },
};

const DEFAULT_FAMILY_ALIAS_BY_DECK_TYPE: Readonly<Record<string, string>> = {
  digital_transformation_read_deck: 'Digital Transformation Read Deck',
  transformation_read_deck: 'Digital Transformation Read Deck',
  board_decision_deck: 'Board Decision Deck',
  assessment_summary: 'DRD Diagnostic Deck',
  tool_workshop: 'Initiative Kickoff Deck',
  steering_committee: 'Steering Committee Deck',
  program_update: 'Steering Committee Deck',
};

// ---------------------------------------------------------------------------
// Registry state
// ---------------------------------------------------------------------------

/**
 * Snapshot shape returned by `getDefaultRegistrySnapshot` /
 * `getCurrentRegistrySnapshot` (Sprint S17 admin surface). Exported so
 * callers can type-annotate against the snapshot without re-declaring
 * the shape.
 */
export interface LayoutCapacityRegistrySnapshot {
  densityBudgets: Record<LayoutCapacityDensityKey, LayoutSlotCapacity>;
  templateFamilyOverrides: Record<string, LayoutFamilyOverrides>;
  familyAliasByDeckType: Record<string, string>;
}

/**
 * Internal alias kept for backward-compat with S13 internals. New code
 * should prefer the exported `LayoutCapacityRegistrySnapshot`.
 */
type RegistryState = LayoutCapacityRegistrySnapshot;

function cloneDefaults(): RegistryState {
  return {
    densityBudgets: {
      visual: { ...DEFAULT_DENSITY_BUDGETS.visual },
      balanced: { ...DEFAULT_DENSITY_BUDGETS.balanced },
      document: { ...DEFAULT_DENSITY_BUDGETS.document },
    },
    templateFamilyOverrides: Object.fromEntries(
      Object.entries(DEFAULT_TEMPLATE_FAMILY_OVERRIDES).map(([family, overrides]) => [
        family,
        deepCloneFamilyOverrides(overrides),
      ])
    ),
    familyAliasByDeckType: { ...DEFAULT_FAMILY_ALIAS_BY_DECK_TYPE },
  };
}

function deepCloneFamilyOverrides(o: LayoutFamilyOverrides): LayoutFamilyOverrides {
  const out: LayoutFamilyOverrides = {};
  for (const density of Object.keys(o) as LayoutCapacityDensityKey[]) {
    const slot = o[density];
    if (slot) out[density] = { ...slot };
  }
  return out;
}

let state: RegistryState = cloneDefaults();

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const VALID_DENSITY_KEYS: ReadonlySet<string> = new Set(['visual', 'balanced', 'document']);

function validateSlotOverride(
  path: string,
  raw: unknown,
  errors: LayoutCapacityValidationError[]
): LayoutSlotCapacityOverride | null {
  if (raw === null || typeof raw !== 'object') {
    errors.push({ path, reason: 'expected an object with optional cap fields' });
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const out: LayoutSlotCapacityOverride = {};
  const keys: Array<keyof LayoutSlotCapacity> = [
    'titleMaxChars',
    'keyMessageMaxChars',
    'blocksMax',
  ];
  for (const key of keys) {
    const value = obj[key];
    if (value === undefined) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      errors.push({
        path: `${path}.${key}`,
        reason: 'must be a finite positive number',
      });
      continue;
    }
    out[key] = Math.floor(value);
  }
  // Reject extra unknown keys to fail fast on typos.
  for (const key of Object.keys(obj)) {
    if (!keys.includes(key as keyof LayoutSlotCapacity)) {
      errors.push({ path: `${path}.${key}`, reason: 'unknown cap field' });
    }
  }
  return out;
}

function validateDensityBudgets(
  raw: unknown,
  errors: LayoutCapacityValidationError[]
): Partial<Record<LayoutCapacityDensityKey, LayoutSlotCapacityOverride>> | null {
  if (raw === null || typeof raw !== 'object') {
    errors.push({ path: 'densityBudgets', reason: 'expected an object' });
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const out: Partial<Record<LayoutCapacityDensityKey, LayoutSlotCapacityOverride>> = {};
  for (const density of Object.keys(obj)) {
    if (!VALID_DENSITY_KEYS.has(density)) {
      errors.push({
        path: `densityBudgets.${density}`,
        reason: 'unknown density (expected visual | balanced | document)',
      });
      continue;
    }
    const slot = validateSlotOverride(`densityBudgets.${density}`, obj[density], errors);
    if (slot) out[density as LayoutCapacityDensityKey] = slot;
  }
  return out;
}

function validateTemplateFamilyOverrides(
  raw: unknown,
  errors: LayoutCapacityValidationError[]
): Record<string, LayoutFamilyOverrides> | null {
  if (raw === null || typeof raw !== 'object') {
    errors.push({ path: 'templateFamilyOverrides', reason: 'expected an object' });
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const out: Record<string, LayoutFamilyOverrides> = {};
  for (const family of Object.keys(obj)) {
    if (!family.trim()) {
      errors.push({
        path: `templateFamilyOverrides.${JSON.stringify(family)}`,
        reason: 'family key must be a non-empty string',
      });
      continue;
    }
    const fam = obj[family];
    if (fam === null || typeof fam !== 'object') {
      errors.push({
        path: `templateFamilyOverrides.${family}`,
        reason: 'expected an object keyed by density',
      });
      continue;
    }
    const familyObj = fam as Record<string, unknown>;
    const familyOut: LayoutFamilyOverrides = {};
    for (const density of Object.keys(familyObj)) {
      if (!VALID_DENSITY_KEYS.has(density)) {
        errors.push({
          path: `templateFamilyOverrides.${family}.${density}`,
          reason: 'unknown density (expected visual | balanced | document)',
        });
        continue;
      }
      const slot = validateSlotOverride(
        `templateFamilyOverrides.${family}.${density}`,
        familyObj[density],
        errors
      );
      if (slot) familyOut[density as LayoutCapacityDensityKey] = slot;
    }
    out[family] = familyOut;
  }
  return out;
}

function validateFamilyAlias(
  raw: unknown,
  errors: LayoutCapacityValidationError[]
): Record<string, string> | null {
  if (raw === null || typeof raw !== 'object') {
    errors.push({ path: 'familyAliasByDeckType', reason: 'expected an object' });
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const deckType of Object.keys(obj)) {
    const value = obj[deckType];
    if (typeof value !== 'string' || !value.trim()) {
      errors.push({
        path: `familyAliasByDeckType.${deckType}`,
        reason: 'value must be a non-empty string (canonical family display name)',
      });
      continue;
    }
    out[deckType] = value.trim();
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve the slot capacity for a given density, optionally narrowed by
 * a template family. Mirrors the previous static resolution in the audit
 * — every consumer that used the static maps now goes through here.
 */
export function resolveSlotCapacity(
  density: LayoutCapacityDensityKey,
  templateFamily: string | null | undefined
): LayoutSlotCapacity {
  const baseline = state.densityBudgets[density];
  const normalized = normalizeTemplateFamily(templateFamily);
  if (!normalized) return { ...baseline };
  const familyOverride = state.templateFamilyOverrides[normalized];
  if (!familyOverride) return { ...baseline };
  const slot = familyOverride[density];
  if (!slot) return { ...baseline };
  return {
    titleMaxChars: slot.titleMaxChars ?? baseline.titleMaxChars,
    keyMessageMaxChars: slot.keyMessageMaxChars ?? baseline.keyMessageMaxChars,
    blocksMax: slot.blocksMax ?? baseline.blocksMax,
  };
}

/**
 * Map a raw deck-type string to its canonical TemplateFamily display
 * name. Canonical display names pass through. Unknown strings pass
 * through unchanged so that future families work even before they are
 * registered (the audit then falls back to the canonical density caps).
 */
export function normalizeTemplateFamily(family: string | null | undefined): string | null {
  if (!family) return null;
  const trimmed = String(family).trim();
  if (!trimmed) return null;
  if (Object.prototype.hasOwnProperty.call(state.templateFamilyOverrides, trimmed)) {
    return trimmed;
  }
  return state.familyAliasByDeckType[trimmed] ?? trimmed;
}

/**
 * Apply a JSON-shaped overrides payload. Validates the entire payload
 * BEFORE mutating state — partial application is rejected so a bad
 * config can never half-update the registry. Returns a result object
 * the caller can render to the user.
 */
export function applyOverrides(payload: LayoutCapacityOverridesPayload): LayoutCapacityApplyResult {
  const errors: LayoutCapacityValidationError[] = [];
  let parsedDensityBudgets: ReturnType<typeof validateDensityBudgets> = null;
  let parsedFamilyOverrides: ReturnType<typeof validateTemplateFamilyOverrides> = null;
  let parsedAliases: ReturnType<typeof validateFamilyAlias> = null;

  if (payload.densityBudgets !== undefined) {
    parsedDensityBudgets = validateDensityBudgets(payload.densityBudgets, errors);
  }
  if (payload.templateFamilyOverrides !== undefined) {
    parsedFamilyOverrides = validateTemplateFamilyOverrides(
      payload.templateFamilyOverrides,
      errors
    );
  }
  if (payload.familyAliasByDeckType !== undefined) {
    parsedAliases = validateFamilyAlias(payload.familyAliasByDeckType, errors);
  }

  if (errors.length > 0) {
    return { ok: false, applied: false, errors };
  }

  // All-or-nothing merge.
  if (parsedDensityBudgets) {
    for (const density of Object.keys(parsedDensityBudgets) as LayoutCapacityDensityKey[]) {
      const slot = parsedDensityBudgets[density];
      if (!slot) continue;
      state.densityBudgets[density] = {
        titleMaxChars: slot.titleMaxChars ?? state.densityBudgets[density].titleMaxChars,
        keyMessageMaxChars:
          slot.keyMessageMaxChars ?? state.densityBudgets[density].keyMessageMaxChars,
        blocksMax: slot.blocksMax ?? state.densityBudgets[density].blocksMax,
      };
    }
  }
  if (parsedFamilyOverrides) {
    for (const family of Object.keys(parsedFamilyOverrides)) {
      const incoming = parsedFamilyOverrides[family];
      const existing = state.templateFamilyOverrides[family] ?? {};
      const merged: LayoutFamilyOverrides = { ...existing };
      for (const density of Object.keys(incoming) as LayoutCapacityDensityKey[]) {
        merged[density] = { ...existing[density], ...incoming[density] };
      }
      state.templateFamilyOverrides[family] = merged;
    }
  }
  if (parsedAliases) {
    for (const deckType of Object.keys(parsedAliases)) {
      state.familyAliasByDeckType[deckType] = parsedAliases[deckType];
    }
  }

  return { ok: true, applied: true, errors: [] };
}

/**
 * Reset the registry to the canonical defaults. Production callers can
 * use this to "reload" after deploying a new code-baseline; tests use
 * it for isolation. Test files MUST call this in `beforeEach` if they
 * apply overrides.
 */
export function resetToDefaults(): void {
  state = cloneDefaults();
}

/**
 * Public snapshot of the canonical defaults baked into this code base.
 * The SuperAdmin admin surface (Sprint S17) reads this to render a
 * "current vs default" diff in the registry inspection view, and to
 * power the explicit `resetToDefaults` admin action without leaking the
 * internal `RegistryState` shape.
 *
 * Returns a deep-cloned object so callers can mutate it without
 * affecting subsequent reads. Pure: never reads `state`.
 */
export function getDefaultRegistrySnapshot(): RegistryState {
  return cloneDefaults();
}

/**
 * Public snapshot of the LIVE registry (defaults merged with any
 * runtime overrides applied via `applyOverrides`). Used by the
 * SuperAdmin admin surface (Sprint S17) to render the current state
 * and by future tenants of the registry that need a stable read.
 *
 * Returns a deep-cloned object so the caller cannot mutate the
 * internal store. Sister of `_snapshotRegistryForTests` but stable
 * (not test-only); the test helper is kept as a backward-compatible
 * alias so the S13 tests do not need to be rewritten.
 */
export function getCurrentRegistrySnapshot(): RegistryState {
  return JSON.parse(JSON.stringify(state)) as RegistryState;
}

/**
 * Test-only helper. Returns a deep-cloned snapshot of the current
 * registry. Tests assert against the snapshot to verify merge
 * semantics without leaking internal references.
 *
 * Sprint S17 note: kept as a thin alias on top of
 * `getCurrentRegistrySnapshot` so the S13 tests keep passing while
 * the public surface gains the stable, non-test alias.
 */
export function _snapshotRegistryForTests(): RegistryState {
  return getCurrentRegistrySnapshot();
}
