/**
 * Consultify Execution-module UI/UX Standard — Frontend types
 * (Slice FE-E1.1).
 *
 * Mirrors `server/src/services/executionModuleStandard/executionModuleStandardTypes.ts`.
 * The server file remains the canonical source; this frontend mirror exists
 * because the shared types live in the server-only tree
 * (the Consultify monorepo does not currently expose a shared types package).
 *
 * If the server type evolves, update both files in lockstep.
 */

// =============================================================================
// Module identity
// =============================================================================

export type ExecutionModuleId = 'doc-builder' | 'excel-builder' | 'deck-builder' | string;

// =============================================================================
// Layout zones
// =============================================================================

export type ExecutionModuleZoneId = 'leftNav' | 'canvas' | 'rightPanel';

export interface ExecutionModuleZoneSpec {
  zoneId: ExecutionModuleZoneId;
  label: string;
  responsibility: string;
  constraints: ReadonlyArray<string>;
}

// =============================================================================
// Menu 2 chips — MELS-aligned ids
// =============================================================================

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

export interface ExecutionModuleMenu2ChipDeclaration {
  chipId: ExecutionModuleMenu2ChipId;
  present: boolean;
  ctaLabel?: ExecutionModuleMenu2CtaLabel;
  hiddenReason?: string;
}

// =============================================================================
// Right panel collapse contract
// =============================================================================

export interface ExecutionModuleRightPanelCollapseContract {
  triggerPosition: 'top_left_seam';
  triggerStyle: 'soft_chevron';
  collapsedWidthPx: 32;
  expandedWidthRangePx: { min: 280; max: 360 };
  persistence: 'per_user_per_module';
}

export interface ExecutionModuleRightPanelDeclaration {
  collapseTriggerPosition: ExecutionModuleRightPanelCollapseContract['triggerPosition'];
  collapseTriggerStyle: ExecutionModuleRightPanelCollapseContract['triggerStyle'];
  collapsedWidthPx: number;
  expandedWidthMinPx: number;
  expandedWidthMaxPx: number;
  persistence: ExecutionModuleRightPanelCollapseContract['persistence'];
  parallelPanelsAllowed: false;
}

// =============================================================================
// Agent constraints
// =============================================================================

export interface ExecutionModuleAgentDeclaration {
  exposedAgentIds: ReadonlyArray<string>;
  teresaSurface: 'popover' | 'drawer' | 'side_panel';
  contextAwareOn: 'section' | 'slide' | 'sheet' | 'block';
}

// =============================================================================
// AI actions placement
// =============================================================================

export interface ExecutionModuleAiActionsDeclaration {
  slot:
    | 'commandRowRightContent'
    | 'DynamicTabs.rightContent'
    | 'localCommandRowRight'
    | 'pending_migration';
  slotJustification?: string;
  actionIds: ReadonlyArray<string>;
  duplicatedInCanvas: boolean;
}

// =============================================================================
// Module manifest
// =============================================================================

export type ExecutionModuleManifestStatus = 'reference' | 'in_progress' | 'pending_review';

export interface ExecutionModuleManifest {
  moduleId: ExecutionModuleId;
  label: string;
  status: ExecutionModuleManifestStatus;
  description?: string;
  zones: ReadonlyArray<{
    zoneId: ExecutionModuleZoneId;
    label?: string;
    unitKindLabel: string;
  }>;
  menu2Chips: ReadonlyArray<ExecutionModuleMenu2ChipDeclaration>;
  rightPanel: ExecutionModuleRightPanelDeclaration;
  agent: ExecutionModuleAgentDeclaration;
  aiActions: ExecutionModuleAiActionsDeclaration;
}

// =============================================================================
// Standard envelope (returned by GET /api/execution-modules/standard)
// =============================================================================

export interface ExecutionModuleStandard {
  zones: ReadonlyArray<ExecutionModuleZoneSpec>;
  zoneOrder: ReadonlyArray<ExecutionModuleZoneId>;
  menu2ChipOrder: ReadonlyArray<ExecutionModuleMenu2ChipId>;
  ctaLabels: { deck: 'Prezentuj'; doc: 'Eksportuj'; excel: 'Eksportuj' };
  rightPanelCollapseContract: ExecutionModuleRightPanelCollapseContract;
  allowedAgentIds: ReadonlyArray<string>;
  allowedAiActionSlots: ReadonlyArray<ExecutionModuleAiActionsDeclaration['slot']>;
}

// =============================================================================
// Validation envelope (returned by POST /manifests/:moduleId/validate)
// =============================================================================

export type ExecutionModuleViolationSeverity = 'must' | 'should';

export interface ExecutionModuleViolation {
  ruleId: string;
  severity: ExecutionModuleViolationSeverity;
  dimension: 'layout' | 'menu2' | 'rightPanel' | 'agent' | 'aiActions';
  message: string;
  details?: Record<string, unknown>;
}

export interface ExecutionModuleValidationResult {
  ok: boolean;
  moduleId: ExecutionModuleId;
  mustViolations: ExecutionModuleViolation[];
  shouldViolations: ExecutionModuleViolation[];
}
