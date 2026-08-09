export type ArtifactType = 'document' | 'presentation' | 'spreadsheet';

export type ArtifactLifecycle = 'draft' | 'in_review' | 'approved' | 'final';

export type ArtifactSelectionKind =
  | 'none'
  | 'text'
  | 'section'
  | 'slide'
  | 'sheet'
  | 'block'
  | 'table'
  | 'chart'
  | 'image'
  | 'cell'
  | 'range'
  | 'row'
  | 'column'
  | 'multi';

export type ArtifactCommandPlacement =
  'menu2' | 'menu3' | 'left-panel' | 'bottom-bar' | 'context-menu' | 'workflow';

export type ArtifactCommandAlias =
  'keyboard' | 'context-menu' | 'kebab' | 'command-palette' | 'inline-affordance';

export type ArtifactCommandPriority = 'P0' | 'P1';
export type ArtifactCommandImplementation = 'available' | 'missing';
export type ArtifactCommandAuditClass =
  'none' | 'version' | 'governance' | 'access' | 'ai' | 'export';
export type ArtifactCommandUndoPolicy =
  'none' | 'view-toggle' | 'undo' | 'confirm' | 'new-version' | 'retry';
export type ArtifactCommandCategory =
  | 'navigation'
  | 'editing'
  | 'structure'
  | 'review'
  | 'governance'
  | 'sharing'
  | 'export'
  | 'teresa'
  | 'view';

export interface ArtifactSelectionContext {
  artifactType: ArtifactType;
  kind: ArtifactSelectionKind;
  readOnly?: boolean;
  locked?: boolean;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface ArtifactPermissionContext {
  grants: ReadonlySet<string>;
}

export interface ArtifactLifecycleContext {
  status: ArtifactLifecycle;
  conflict?: boolean;
  generationPending?: boolean;
}

export interface ArtifactCommandContext<TPayload = unknown> {
  selection: ArtifactSelectionContext;
  permissions: ArtifactPermissionContext;
  lifecycle: ArtifactLifecycleContext;
  payload?: TPayload;
  signal?: AbortSignal;
}

export interface ArtifactCommand<TPayload = unknown, TResult = unknown> {
  commandId: string;
  labelKey: string;
  artifactTypes: readonly ArtifactType[];
  category: ArtifactCommandCategory;
  canonicalPlacement: ArtifactCommandPlacement;
  aliases: readonly ArtifactCommandAlias[];
  priority: ArtifactCommandPriority;
  implementation: ArtifactCommandImplementation;
  auditClass: ArtifactCommandAuditClass;
  undoPolicy: ArtifactCommandUndoPolicy;
  selectionPredicate: (context: ArtifactSelectionContext) => boolean;
  permissionPredicate: (context: ArtifactPermissionContext) => boolean;
  lifecyclePredicate: (context: ArtifactLifecycleContext) => boolean;
  execute: (context: ArtifactCommandContext<TPayload>) => Promise<TResult> | TResult;
}

export interface ArtifactCommandQuery {
  /** Return only commands whose canonical owner is this surface. */
  placement?: ArtifactCommandPlacement;
  /** Return commands exposed through this alias, regardless of canonical owner. */
  alias?: ArtifactCommandAlias;
  /** Optional category filter used by grouped command bars and workflows. */
  categories?: readonly ArtifactCommandCategory[];
}

export type ArtifactCommandState =
  | { visibility: 'hidden'; reason: 'not-implemented' | 'artifact-type' | 'selection' }
  | { visibility: 'disabled'; reason: 'permission' | 'lifecycle' }
  | { visibility: 'enabled' };
