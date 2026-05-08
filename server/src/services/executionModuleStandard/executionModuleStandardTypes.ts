/**
 * Consultify Execution-module UI/UX Standard — Types
 * (Epic E11, Slice 11.1).
 *
 * Machine-readable encoding of the standard documented in
 * `DRD/UI_UX_SOURCE_OF_TRUTH.md` §"Standard Modułów Wykonawczych
 * (Doc / Excel / Deck Builder)" (lines 249-304 in the v1 SSOT).
 *
 * The canonical SSOT remains the Markdown source — these types are a
 * derived projection used to:
 *
 *   - render the standard to consumers (frontend, governance docs),
 *   - validate per-module manifests (ExecutionModuleManifest) against
 *     the standard via `validateExecutionModuleManifest`,
 *   - power CI / pre-release governance gates that block any module
 *     from shipping unless its manifest declares conformance to all
 *     five standard dimensions: Layout zones, Menu 2 chips, Right
 *     panel collapse, Agent constraints, AI actions placement.
 *
 * Tenant boundary: this module ships read-only canonical data (no
 * tenant-scoped state). Validation is a pure function.
 */

// =============================================================================
// Module identity
// =============================================================================

/**
 * Stable identifier for an execution module surface. The canonical
 * three reference modules are `doc-builder`, `excel-builder`, and
 * `deck-builder`; future surfaces (e.g. `whiteboard-builder`) may
 * register additional ids without invalidating the standard.
 */
export type ExecutionModuleId = 'doc-builder' | 'excel-builder' | 'deck-builder' | string;

// =============================================================================
// Layout zones
// =============================================================================

export type ExecutionModuleZoneId = 'leftNav' | 'canvas' | 'rightPanel';

/**
 * Each zone of the 3-zone layout has a fixed responsibility. The
 * standard mandates exactly these three zones in this order
 * (left → center → right).
 */
export interface ExecutionModuleZoneSpec {
  zoneId: ExecutionModuleZoneId;
  /** Human-readable label as it appears in the SSOT. */
  label: string;
  responsibility: string;
  /**
   * Hard constraints the standard imposes on the zone (rendered as
   * negative checks during validation). Each rule is an English
   * MUST/MUST_NOT predicate; the validator surfaces each as a
   * structured violation when not declared on the module manifest.
   */
  constraints: ReadonlyArray<string>;
}

// =============================================================================
// Menu 2 (functional chip row)
// =============================================================================

/**
 * Canonical chip ids in the canonical order (Internal → Theme → …
 * → Run). The standard requires the ordering and the exact set;
 * modules MAY hide individual chips when the underlying function
 * does not exist (e.g. `run` is hidden in modules without a primary
 * action) but MUST NOT reorder the visible subset.
 *
 * Chip ids are aligned with the production MELS shell
 * (`src/components/shared/ExecutiveModuleShell/ChipDescriptor.ts`)
 * so the frontend can wire the manifest directly into the existing
 * `<TopBar chips={...}>` surface without an intermediate adapter.
 * The user-visible labels are localised per-module via the
 * `label` (e.g. "Motyw", "Udostępnij") and the `ctaLabel`
 * (`Prezentuj` / `Eksportuj`) per the SSOT
 * (`DRD/UI_UX_SOURCE_OF_TRUTH.md` §"Standard Modułów Wykonawczych").
 */
export type ExecutionModuleMenu2ChipId =
  | 'internal'
  | 'theme'
  | 'history'
  | 'qa'
  | 'governance'
  | 'analytics'
  | 'audit'
  | 'share'
  | 'agent'
  | 'run';

export type ExecutionModuleMenu2CtaLabel = 'Prezentuj' | 'Eksportuj';

/**
 * Per-module chip declaration. `present` indicates the module
 * actually renders that chip; `ctaLabel` only applies to the
 * `run` chip and selects which copy is shown.
 */
export interface ExecutionModuleMenu2ChipDeclaration {
  chipId: ExecutionModuleMenu2ChipId;
  present: boolean;
  ctaLabel?: ExecutionModuleMenu2CtaLabel;
  /** Optional reason why the chip is absent — surfaced in audit. */
  hiddenReason?: string;
}

// =============================================================================
// Right panel collapse contract
// =============================================================================

export interface ExecutionModuleRightPanelCollapseContract {
  /** Position of the collapse trigger inside the panel chrome. */
  triggerPosition: 'top_left_seam';
  /** Visual style class used by the SSOT ("light, soft, non-invasive"). */
  triggerStyle: 'soft_chevron';
  /** Width to which the panel collapses (px). */
  collapsedWidthPx: 32;
  /** Min / max width of the expanded panel (px). */
  expandedWidthRangePx: { min: 280; max: 360 };
  /** Persistence scope for the collapse state. */
  persistence: 'per_user_per_module';
}

/**
 * Per-module declaration of how the right-panel collapse is wired.
 * The validator checks this matches the standard contract.
 */
export interface ExecutionModuleRightPanelDeclaration {
  collapseTriggerPosition: ExecutionModuleRightPanelCollapseContract['triggerPosition'];
  collapseTriggerStyle: ExecutionModuleRightPanelCollapseContract['triggerStyle'];
  collapsedWidthPx: number;
  expandedWidthMinPx: number;
  expandedWidthMaxPx: number;
  persistence: ExecutionModuleRightPanelCollapseContract['persistence'];
  /**
   * The standard mandates exactly one panel visible at a time —
   * never two parallel right-side panels. Modules declare this
   * here so the validator can flag a violation when the array on
   * the rendered surface contains more than one tab-stack root.
   */
  parallelPanelsAllowed: false;
}

// =============================================================================
// Agent constraints
// =============================================================================

/**
 * Teresa is the only chat agent surfaced inside execution modules.
 * Modules declare which named agents they expose; the validator
 * rejects any agent id that is not `'teresa'`.
 */
export interface ExecutionModuleAgentDeclaration {
  /** The list of chat-agent ids surfaced inside the module's UI. */
  exposedAgentIds: ReadonlyArray<string>;
  /**
   * The Menu 2 `Agent` chip MUST open Teresa in a popover or
   * drawer; modules declare the surface here for governance.
   */
  teresaSurface: 'popover' | 'drawer' | 'side_panel';
  /**
   * The standard requires Teresa to be context-aware on the
   * currently selected unit (slide / section / sheet). Modules
   * declare the unit kind they bind to.
   */
  contextAwareOn: 'section' | 'slide' | 'sheet' | 'block';
}

// =============================================================================
// AI actions placement
// =============================================================================

/**
 * Per .cursor/rules/ai-actions-menu3.mdc and 21-ai-actions-menu3-placement.mdc:
 * contextual AI actions live in the right slot of the dynamic
 * tab command-row (Menu 3). They MUST NOT be duplicated in the
 * canvas or rendered as a separate toolbar under metadata.
 */
export interface ExecutionModuleAiActionsDeclaration {
  /** Slot identifier on which the AI actions are mounted. */
  slot:
    | 'commandRowRightContent'
    | 'DynamicTabs.rightContent'
    | 'localCommandRowRight'
    /**
     * Escape hatch only; declaring this triggers a validator
     * violation unless the module also declares
     * `slotJustification`. Modules MUST migrate to the canonical
     * Menu 3 slot before shipping.
     */
    | 'pending_migration';
  /** Required when slot === 'pending_migration'. */
  slotJustification?: string;
  /**
   * The set of AI action ids exposed in Menu 3. Empty array is
   * legal (some modules may not expose AI actions yet) but
   * each action MUST be unique across the module.
   */
  actionIds: ReadonlyArray<string>;
  /**
   * The standard forbids duplicating a Menu 3 AI action inside
   * the canvas. Modules declare `false` here as an explicit
   * commitment; `true` triggers a violation.
   */
  duplicatedInCanvas: boolean;
}

// =============================================================================
// Module manifest
// =============================================================================

export type ExecutionModuleManifestStatus = 'reference' | 'in_progress' | 'pending_review';

/**
 * Composite per-module declaration. Three pre-baked manifests
 * (`doc-builder`, `excel-builder`, `deck-builder`) ship from
 * `executionModuleStandardManifests.ts` (Slice 11.2). Future
 * surfaces register additional manifests via the same shape so the
 * validator stays uniform.
 */
export interface ExecutionModuleManifest {
  moduleId: ExecutionModuleId;
  /** Display label, e.g. "Document Studio (Doc Builder)". */
  label: string;
  status: ExecutionModuleManifestStatus;
  /** Free-form module description; surfaced in governance docs. */
  description?: string;
  zones: ReadonlyArray<{
    zoneId: ExecutionModuleZoneId;
    /** Module-local label override (defaults to the standard label). */
    label?: string;
    unitKindLabel: string;
  }>;
  menu2Chips: ReadonlyArray<ExecutionModuleMenu2ChipDeclaration>;
  rightPanel: ExecutionModuleRightPanelDeclaration;
  agent: ExecutionModuleAgentDeclaration;
  aiActions: ExecutionModuleAiActionsDeclaration;
}

// =============================================================================
// Validation result
// =============================================================================

export type ExecutionModuleViolationSeverity = 'must' | 'should';

/**
 * Single rule violation produced by `validateExecutionModuleManifest`.
 * Stable ruleIds let CI / governance pin specific violations as
 * known-deferred without losing the rest of the audit signal.
 */
export interface ExecutionModuleViolation {
  ruleId: string;
  severity: ExecutionModuleViolationSeverity;
  /** Which dimension the violation belongs to. */
  dimension: 'layout' | 'menu2' | 'rightPanel' | 'agent' | 'aiActions';
  message: string;
  details?: Record<string, unknown>;
}

export interface ExecutionModuleValidationResult {
  ok: boolean;
  moduleId: ExecutionModuleId;
  /** Hard violations — block release unless explicitly waived. */
  mustViolations: ExecutionModuleViolation[];
  /** Soft violations — quality bar. */
  shouldViolations: ExecutionModuleViolation[];
}
