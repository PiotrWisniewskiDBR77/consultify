/**
 * Consultify Execution-module UI/UX Standard — Canonical constants + validator
 * (Epic E11, Slice 11.1).
 *
 * Encodes the SSOT contract from `DRD/UI_UX_SOURCE_OF_TRUTH.md`
 * §"Standard Modułów Wykonawczych (Doc / Excel / Deck Builder)" as
 * machine-readable canonical data plus a pure validator that
 * checks an `ExecutionModuleManifest` for conformance.
 *
 * No mutation, no I/O — every export is either a frozen constant or
 * a pure function. The route layer (Slice 11.3) wraps these for HTTP
 * delivery; the manifest registry (Slice 11.2) ships the three
 * reference manifests for `doc-builder`, `excel-builder`, and
 * `deck-builder`.
 */

import type {
  ExecutionModuleAgentDeclaration,
  ExecutionModuleAiActionsDeclaration,
  ExecutionModuleManifest,
  ExecutionModuleMenu2ChipDeclaration,
  ExecutionModuleMenu2ChipId,
  ExecutionModuleRightPanelCollapseContract,
  ExecutionModuleRightPanelDeclaration,
  ExecutionModuleValidationResult,
  ExecutionModuleViolation,
  ExecutionModuleZoneId,
  ExecutionModuleZoneSpec,
} from './executionModuleStandardTypes.js';

// =============================================================================
// §1 Layout — 3-zone canonical spec
// =============================================================================

export const EXECUTION_MODULE_ZONE_ORDER: ReadonlyArray<ExecutionModuleZoneId> = Object.freeze([
  'leftNav',
  'canvas',
  'rightPanel',
]) as ReadonlyArray<ExecutionModuleZoneId>;

export const EXECUTION_MODULE_ZONES: ReadonlyArray<ExecutionModuleZoneSpec> = Object.freeze([
  Object.freeze({
    zoneId: 'leftNav',
    label: 'Lewa strefa — Nawigacja artefaktu',
    responsibility:
      'Lista jednostek logicznych artefaktu (slajdy w Deck, sekcje w Doc, arkusze w Excel). Wybór, sortowanie, dodanie, kolejność.',
    constraints: Object.freeze([
      'MUST_NOT contain any editing actions (no formatting / mutation buttons).',
      'MUST stay reserved for unit navigation only.',
    ]),
  }),
  Object.freeze({
    zoneId: 'canvas',
    label: 'Środek — Kanwa',
    responsibility: 'Jedna jednostka logiczna w pełnym widoku WYSIWYG.',
    constraints: Object.freeze([
      'MUST NOT render a toolbar under document metadata.',
      'MUST NOT render a second column of floating action buttons.',
      'MUST NOT duplicate Menu 3 AI actions inside the canvas.',
    ]),
  }),
  Object.freeze({
    zoneId: 'rightPanel',
    label: 'Prawa strefa — Panel funkcji kontekstowych',
    responsibility:
      'Wszystkie funkcje per zaznaczona jednostka: szablony, układy, formatowanie, properties, źródła, komentarze. Jeden panel, vertical icon strip po prawej krawędzi.',
    constraints: Object.freeze([
      'MUST render exactly one panel — never two parallel right-side panels.',
      'MUST expose tab stack as a vertical icon strip on the right edge.',
      'Only one tab MAY be active at any time; the rest stay collapsed.',
    ]),
  }),
]) as ReadonlyArray<ExecutionModuleZoneSpec>;

// =============================================================================
// §2 Menu 2 — canonical chip order + CTA contract
// =============================================================================

/**
 * Canonical chip order. The validator enforces that the manifest's
 * `menu2Chips` array follows this order for the chips it does
 * declare; the chip set MAY be smaller (modules MAY hide
 * unsupported functions) but MUST NOT be reordered.
 */
export const EXECUTION_MODULE_MENU2_CHIP_ORDER: ReadonlyArray<ExecutionModuleMenu2ChipId> =
  Object.freeze([
    'internal',
    'motyw',
    'history',
    'qa',
    'governance',
    'analytics',
    'audit',
    'udostepnij',
    'agent',
    'cta_primary',
  ]) as ReadonlyArray<ExecutionModuleMenu2ChipId>;

/** The primary CTA is module-specific copy: Prezentuj (Deck) / Eksportuj (Doc/Excel). */
export const EXECUTION_MODULE_CTA_LABELS = Object.freeze({
  deck: 'Prezentuj' as const,
  doc: 'Eksportuj' as const,
  excel: 'Eksportuj' as const,
});

// =============================================================================
// §3 Right panel — collapse contract
// =============================================================================

export const EXECUTION_MODULE_RIGHT_PANEL_COLLAPSE_CONTRACT: ExecutionModuleRightPanelCollapseContract =
  Object.freeze({
    triggerPosition: 'top_left_seam',
    triggerStyle: 'soft_chevron',
    collapsedWidthPx: 32,
    expandedWidthRangePx: Object.freeze({ min: 280, max: 360 }) as { min: 280; max: 360 },
    persistence: 'per_user_per_module',
  }) as ExecutionModuleRightPanelCollapseContract;

// =============================================================================
// §4 Agent — Teresa-only constraint
// =============================================================================

/**
 * Teresa is the only chat agent surfaced inside execution modules.
 * Any other id (Claude / chat-X / "asystent X") triggers a hard
 * violation. Future agents may register only via the SSOT update
 * (this constant changes alongside the §Agent czatu section).
 */
export const EXECUTION_MODULE_ALLOWED_AGENT_IDS: ReadonlyArray<string> = Object.freeze(['teresa']);

// =============================================================================
// §5 AI actions — Menu 3 placement contract
// =============================================================================

export const EXECUTION_MODULE_ALLOWED_AI_ACTION_SLOTS: ReadonlyArray<
  ExecutionModuleAiActionsDeclaration['slot']
> = Object.freeze([
  'commandRowRightContent',
  'DynamicTabs.rightContent',
  'localCommandRowRight',
]) as ReadonlyArray<ExecutionModuleAiActionsDeclaration['slot']>;

// =============================================================================
// Validation
// =============================================================================

/**
 * Build a single violation entry.
 *
 * @internal — exported for tests; the route layer should use the
 * full `validateExecutionModuleManifest` result, not individual
 * builders.
 */
export function makeViolation(
  ruleId: string,
  severity: ExecutionModuleViolation['severity'],
  dimension: ExecutionModuleViolation['dimension'],
  message: string,
  details?: Record<string, unknown>
): ExecutionModuleViolation {
  return { ruleId, severity, dimension, message, details };
}

/**
 * Validate a single execution-module manifest against the canonical
 * standard. Returns a result with `mustViolations` (hard release
 * blockers) and `shouldViolations` (quality bar).
 *
 * Pure — does not throw on bad input, but returns a single
 * `manifest_invalid` violation when the manifest is structurally
 * unusable so callers always receive a result envelope.
 */
export function validateExecutionModuleManifest(
  manifest: ExecutionModuleManifest
): ExecutionModuleValidationResult {
  const mustViolations: ExecutionModuleViolation[] = [];
  const shouldViolations: ExecutionModuleViolation[] = [];
  if (!manifest || typeof manifest !== 'object') {
    return {
      ok: false,
      moduleId: 'unknown',
      mustViolations: [
        makeViolation('manifest_invalid', 'must', 'layout', 'manifest payload is invalid'),
      ],
      shouldViolations: [],
    };
  }

  // ─── §1 Layout zones ─────────────────────────────────────────────────────
  validateZones(manifest, mustViolations);

  // ─── §2 Menu 2 chips ─────────────────────────────────────────────────────
  validateMenu2(manifest, mustViolations, shouldViolations);

  // ─── §3 Right panel ──────────────────────────────────────────────────────
  validateRightPanel(manifest, mustViolations);

  // ─── §4 Agent constraints ────────────────────────────────────────────────
  validateAgent(manifest, mustViolations);

  // ─── §5 AI actions placement ─────────────────────────────────────────────
  validateAiActions(manifest, mustViolations, shouldViolations);

  return {
    ok: mustViolations.length === 0,
    moduleId: manifest.moduleId,
    mustViolations,
    shouldViolations,
  };
}

// =============================================================================
// Per-dimension validators (private)
// =============================================================================

function validateZones(
  manifest: ExecutionModuleManifest,
  mustViolations: ExecutionModuleViolation[]
): void {
  const zones = Array.isArray(manifest.zones) ? manifest.zones : [];
  if (zones.length !== EXECUTION_MODULE_ZONE_ORDER.length) {
    mustViolations.push(
      makeViolation(
        'layout_zone_count',
        'must',
        'layout',
        `manifest must declare exactly ${EXECUTION_MODULE_ZONE_ORDER.length} zones (left nav / canvas / right panel)`,
        { observed: zones.length, expected: EXECUTION_MODULE_ZONE_ORDER.length }
      )
    );
    return;
  }
  for (let i = 0; i < EXECUTION_MODULE_ZONE_ORDER.length; i += 1) {
    const expected = EXECUTION_MODULE_ZONE_ORDER[i];
    const declared = zones[i];
    if (!declared || declared.zoneId !== expected) {
      mustViolations.push(
        makeViolation(
          'layout_zone_order',
          'must',
          'layout',
          `zone slot ${i} must be ${expected}; observed ${declared?.zoneId ?? '<missing>'}`,
          { slot: i, expected, observed: declared?.zoneId ?? null }
        )
      );
    }
  }
}

function validateMenu2(
  manifest: ExecutionModuleManifest,
  mustViolations: ExecutionModuleViolation[],
  shouldViolations: ExecutionModuleViolation[]
): void {
  const chips = Array.isArray(manifest.menu2Chips) ? manifest.menu2Chips : [];
  // The chip set MAY be smaller, but every declared id MUST be a
  // canonical id and the order of declarations MUST be ascending
  // per EXECUTION_MODULE_MENU2_CHIP_ORDER.
  const canonicalIndex = new Map<ExecutionModuleMenu2ChipId, number>();
  EXECUTION_MODULE_MENU2_CHIP_ORDER.forEach((id, idx) => canonicalIndex.set(id, idx));

  let lastIdx = -1;
  const seen = new Set<ExecutionModuleMenu2ChipId>();
  for (const chip of chips as ExecutionModuleMenu2ChipDeclaration[]) {
    const idx = canonicalIndex.get(chip.chipId);
    if (idx === undefined) {
      mustViolations.push(
        makeViolation('menu2_unknown_chip', 'must', 'menu2', `unknown chip id: ${chip.chipId}`, {
          chipId: chip.chipId,
        })
      );
      continue;
    }
    if (seen.has(chip.chipId)) {
      mustViolations.push(
        makeViolation(
          'menu2_chip_duplicate',
          'must',
          'menu2',
          `chip declared twice: ${chip.chipId}`,
          { chipId: chip.chipId }
        )
      );
      continue;
    }
    seen.add(chip.chipId);
    if (idx <= lastIdx) {
      mustViolations.push(
        makeViolation(
          'menu2_chip_order',
          'must',
          'menu2',
          `chip ${chip.chipId} appears out of canonical order`,
          { chipId: chip.chipId, canonicalIndex: idx }
        )
      );
    }
    lastIdx = idx;
  }

  // CTA chip — when present, must carry a label.
  const cta = chips.find((c) => c.chipId === 'cta_primary');
  if (cta && cta.present && !cta.ctaLabel) {
    mustViolations.push(
      makeViolation(
        'menu2_cta_label_missing',
        'must',
        'menu2',
        'cta_primary chip is present but ctaLabel is missing (Prezentuj | Eksportuj)'
      )
    );
  }

  // Soft signal: the standard recommends every module exposes the
  // full canonical chip set. Hidden chips beyond the well-known
  // exception (Excel hides Prezentuj — the standard explicitly
  // models cta as module-local copy) trigger a soft violation.
  for (const id of EXECUTION_MODULE_MENU2_CHIP_ORDER) {
    if (!chips.some((c) => c.chipId === id && c.present)) {
      shouldViolations.push(
        makeViolation(
          'menu2_chip_hidden',
          'should',
          'menu2',
          `chip ${id} is hidden in this module`,
          { chipId: id }
        )
      );
    }
  }
}

function validateRightPanel(
  manifest: ExecutionModuleManifest,
  mustViolations: ExecutionModuleViolation[]
): void {
  const panel = manifest.rightPanel as ExecutionModuleRightPanelDeclaration | undefined;
  if (!panel) {
    mustViolations.push(
      makeViolation(
        'right_panel_missing',
        'must',
        'rightPanel',
        'rightPanel declaration is missing'
      )
    );
    return;
  }
  if (
    panel.collapseTriggerPosition !== EXECUTION_MODULE_RIGHT_PANEL_COLLAPSE_CONTRACT.triggerPosition
  ) {
    mustViolations.push(
      makeViolation(
        'right_panel_collapse_trigger_position',
        'must',
        'rightPanel',
        `collapseTriggerPosition must be '${EXECUTION_MODULE_RIGHT_PANEL_COLLAPSE_CONTRACT.triggerPosition}'`,
        { observed: panel.collapseTriggerPosition }
      )
    );
  }
  if (panel.collapseTriggerStyle !== EXECUTION_MODULE_RIGHT_PANEL_COLLAPSE_CONTRACT.triggerStyle) {
    mustViolations.push(
      makeViolation(
        'right_panel_collapse_trigger_style',
        'must',
        'rightPanel',
        `collapseTriggerStyle must be '${EXECUTION_MODULE_RIGHT_PANEL_COLLAPSE_CONTRACT.triggerStyle}'`,
        { observed: panel.collapseTriggerStyle }
      )
    );
  }
  if (panel.collapsedWidthPx !== EXECUTION_MODULE_RIGHT_PANEL_COLLAPSE_CONTRACT.collapsedWidthPx) {
    mustViolations.push(
      makeViolation(
        'right_panel_collapsed_width',
        'must',
        'rightPanel',
        `collapsedWidthPx must be ${EXECUTION_MODULE_RIGHT_PANEL_COLLAPSE_CONTRACT.collapsedWidthPx}`,
        { observed: panel.collapsedWidthPx }
      )
    );
  }
  if (
    panel.expandedWidthMinPx <
      EXECUTION_MODULE_RIGHT_PANEL_COLLAPSE_CONTRACT.expandedWidthRangePx.min ||
    panel.expandedWidthMaxPx >
      EXECUTION_MODULE_RIGHT_PANEL_COLLAPSE_CONTRACT.expandedWidthRangePx.max
  ) {
    mustViolations.push(
      makeViolation(
        'right_panel_expanded_width_range',
        'must',
        'rightPanel',
        `expanded panel width must fall within [${EXECUTION_MODULE_RIGHT_PANEL_COLLAPSE_CONTRACT.expandedWidthRangePx.min}px, ${EXECUTION_MODULE_RIGHT_PANEL_COLLAPSE_CONTRACT.expandedWidthRangePx.max}px]`,
        { observedMin: panel.expandedWidthMinPx, observedMax: panel.expandedWidthMaxPx }
      )
    );
  }
  if (panel.persistence !== EXECUTION_MODULE_RIGHT_PANEL_COLLAPSE_CONTRACT.persistence) {
    mustViolations.push(
      makeViolation(
        'right_panel_persistence',
        'must',
        'rightPanel',
        `persistence must be '${EXECUTION_MODULE_RIGHT_PANEL_COLLAPSE_CONTRACT.persistence}'`,
        { observed: panel.persistence }
      )
    );
  }
  if (panel.parallelPanelsAllowed !== false) {
    mustViolations.push(
      makeViolation(
        'right_panel_parallel_disallowed',
        'must',
        'rightPanel',
        'parallelPanelsAllowed must be false (the standard mandates exactly one panel visible)'
      )
    );
  }
}

function validateAgent(
  manifest: ExecutionModuleManifest,
  mustViolations: ExecutionModuleViolation[]
): void {
  const agent = manifest.agent as ExecutionModuleAgentDeclaration | undefined;
  if (!agent) {
    mustViolations.push(
      makeViolation('agent_missing', 'must', 'agent', 'agent declaration is missing')
    );
    return;
  }
  const exposed = Array.isArray(agent.exposedAgentIds) ? agent.exposedAgentIds : [];
  if (exposed.length === 0) {
    mustViolations.push(
      makeViolation('agent_empty', 'must', 'agent', 'exposedAgentIds must include teresa')
    );
  }
  for (const id of exposed) {
    if (!EXECUTION_MODULE_ALLOWED_AGENT_IDS.includes(id)) {
      mustViolations.push(
        makeViolation(
          'agent_disallowed',
          'must',
          'agent',
          `agent id '${id}' is not allowed in execution modules; only Teresa is permitted`,
          { agentId: id }
        )
      );
    }
  }
  if (!exposed.includes('teresa')) {
    mustViolations.push(
      makeViolation(
        'agent_teresa_required',
        'must',
        'agent',
        'exposedAgentIds must include "teresa"'
      )
    );
  }
  if (
    agent.teresaSurface !== 'popover' &&
    agent.teresaSurface !== 'drawer' &&
    agent.teresaSurface !== 'side_panel'
  ) {
    mustViolations.push(
      makeViolation(
        'agent_surface_invalid',
        'must',
        'agent',
        `teresaSurface must be one of popover|drawer|side_panel; observed ${String(
          agent.teresaSurface
        )}`
      )
    );
  }
}

function validateAiActions(
  manifest: ExecutionModuleManifest,
  mustViolations: ExecutionModuleViolation[],
  shouldViolations: ExecutionModuleViolation[]
): void {
  const ai = manifest.aiActions as ExecutionModuleAiActionsDeclaration | undefined;
  if (!ai) {
    mustViolations.push(
      makeViolation('ai_actions_missing', 'must', 'aiActions', 'aiActions declaration is missing')
    );
    return;
  }
  if (!EXECUTION_MODULE_ALLOWED_AI_ACTION_SLOTS.includes(ai.slot)) {
    if (ai.slot === 'pending_migration') {
      if (!ai.slotJustification || ai.slotJustification.trim().length === 0) {
        mustViolations.push(
          makeViolation(
            'ai_actions_slot_pending_unjustified',
            'must',
            'aiActions',
            'slot=pending_migration requires slotJustification'
          )
        );
      } else {
        shouldViolations.push(
          makeViolation(
            'ai_actions_slot_pending_migration',
            'should',
            'aiActions',
            'slot=pending_migration is a temporary escape; migrate to canonical Menu 3 slot',
            { slotJustification: ai.slotJustification }
          )
        );
      }
    } else {
      mustViolations.push(
        makeViolation(
          'ai_actions_slot_invalid',
          'must',
          'aiActions',
          `slot must be one of ${EXECUTION_MODULE_ALLOWED_AI_ACTION_SLOTS.join(' | ')}`,
          { observed: ai.slot }
        )
      );
    }
  }
  if (ai.duplicatedInCanvas !== false) {
    mustViolations.push(
      makeViolation(
        'ai_actions_duplicated_in_canvas',
        'must',
        'aiActions',
        'AI actions MUST NOT be duplicated inside the canvas'
      )
    );
  }
  const actionIds = Array.isArray(ai.actionIds) ? ai.actionIds : [];
  const seen = new Set<string>();
  for (const id of actionIds) {
    if (typeof id !== 'string' || id.trim().length === 0) {
      mustViolations.push(
        makeViolation(
          'ai_actions_invalid_id',
          'must',
          'aiActions',
          `actionIds must be non-empty strings; observed ${String(id)}`
        )
      );
      continue;
    }
    if (seen.has(id)) {
      mustViolations.push(
        makeViolation(
          'ai_actions_duplicate_id',
          'must',
          'aiActions',
          `actionId duplicated: ${id}`,
          { actionId: id }
        )
      );
    }
    seen.add(id);
  }
}

// =============================================================================
// Aggregate validator
// =============================================================================

export interface ValidateAllResult {
  ok: boolean;
  results: ExecutionModuleValidationResult[];
}

/**
 * Validate every manifest in a registry. Returns a single envelope —
 * `ok` is true only when every manifest is `ok`. Used by CI to gate
 * a deploy on the manifest catalogue staying conformant after a
 * change.
 */
export function validateAllManifests(
  manifests: ReadonlyArray<ExecutionModuleManifest>
): ValidateAllResult {
  const results = manifests.map((manifest) => validateExecutionModuleManifest(manifest));
  return { ok: results.every((r) => r.ok), results };
}
