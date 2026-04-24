/**
 * P02-B Calendar Interoperability Service
 *
 * Implements the Calendar Interop contract §2.3:
 *   - Source CRUD (v8_calendar_sources)
 *   - Item CRUD (v8_calendar_items)
 *   - Incremental / full sync operations
 *   - Conflict-safe writes with etag
 *   - Permission & lifecycle derivation
 *   - Provider-error → lifecycle-state mapping (§2.3.8)
 */

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const LOG_PREFIX = '[P02-CalendarInterop]';

// ---------------------------------------------------------------------------
// Value enums
// ---------------------------------------------------------------------------

export const CalendarProviderValues = ['google', 'microsoft', 'caldav'] as const;
export type CalendarProvider = (typeof CalendarProviderValues)[number];

export const DeclaredModeValues = ['read', 'write', 'bidir'] as const;
export type DeclaredMode = (typeof DeclaredModeValues)[number];

export const EffectiveModeValues = ['read', 'write', 'bidir'] as const;
export type EffectiveMode = (typeof EffectiveModeValues)[number];

export const PermissionGradientValues = ['free_busy', 'read', 'write', 'delegate'] as const;
export type PermissionGradient = (typeof PermissionGradientValues)[number];

export const SourceLifecycleStateValues = [
  'connected',
  'degraded',
  'requires_action',
  'blocked',
  'recoverable',
] as const;
export type SourceLifecycleState = (typeof SourceLifecycleStateValues)[number];

export const ItemTypeValues = [
  'task_due',
  'task_window',
  'initiative_milestone',
  'decision_deadline',
  'meeting',
  'external_event',
  'assignment',
  'adjustment',
  'approval_window',
  'escalation_window',
  'focus_block',
] as const;
export type ItemType = (typeof ItemTypeValues)[number];

export const SourceSystemValues = [
  'consultify',
  'google_calendar',
  'outlook_calendar',
  'caldav',
] as const;
export type SourceSystem = (typeof SourceSystemValues)[number];

export const VisibilityClassValues = ['free_busy_only', 'details'] as const;
export type VisibilityClass = (typeof VisibilityClassValues)[number];

export const EditAuthorityValues = ['none', 'local_only', 'remote_owner', 'delegate'] as const;
export type EditAuthority = (typeof EditAuthorityValues)[number];

export const SyncStateValues = ['in_sync', 'pending', 'conflict', 'blocked', 'stale'] as const;
export type SyncState = (typeof SyncStateValues)[number];

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface SyncCheckpoint {
  cursor: string | null;
  /** Per-calendar cursors for multi-calendar sync (syncToken/deltaLink/sync-token per calendar). */
  calendarCursors?: Record<string, string> | null;
  rangeWatermark: { startAt: string; endAt: string } | null;
  lastFullSyncAt: string | null;
  lastIncrementalSyncAt: string | null;
  integrityGuards: string[];
}

export interface CalendarSource {
  calendarSourceId: string;
  organizationId: string;
  userId: string;
  provider: CalendarProvider;
  accountRef: string;
  selectedCalendars: string[];
  declaredMode: DeclaredMode;
  effectiveMode: EffectiveMode;
  permissionGradient: PermissionGradient;
  lifecycleState: SourceLifecycleState;
  requiresActionReason: string | null;
  lastOkAt: string | null;
  lastSyncAt: string | null;
  syncCheckpoint: SyncCheckpoint;
  lastError: string | null;
  connectionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecurrenceModel {
  seriesMasterRef: string;
  rrule: string | null;
  rdate: string[] | null;
  exdate: string[] | null;
  exceptions: Array<{
    recurrenceId: string;
    action: 'modified' | 'cancelled';
    overrides?: Record<string, unknown>;
  }>;
  materializationRule: 'window_only';
}

export interface CalendarItem {
  calendarItemId: string;
  organizationId: string;
  sourceId: string | null;
  itemType: ItemType;
  sourceSystem: SourceSystem;
  sourceObjectRef: string;
  title: string | null;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  timezone: string | null;
  visibilityClass: VisibilityClass;
  editAuthority: EditAuthority;
  recurrenceModel: RecurrenceModel | null;
  syncState: SyncState;
  etag: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Sync result / conflict / health types
// ---------------------------------------------------------------------------

export interface SyncResult {
  sourceId: string;
  syncType: 'incremental' | 'full';
  itemsProcessed: number;
  checkpoint: SyncCheckpoint;
  errors: string[];
}

export interface ConflictInfo {
  itemId: string;
  currentEtag: string | null;
  providedEtag: string;
  syncState: SyncState;
}

export interface SourceHealthSummary {
  organizationId: string;
  totalSources: number;
  connected: number;
  degraded: number;
  requiresAction: number;
  blocked: number;
  recoverable: number;
}

export interface ProviderErrorMapping {
  sourceState: SourceLifecycleState;
  itemState: SyncState;
  recovery: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const EMPTY_CHECKPOINT: SyncCheckpoint = {
  cursor: null,
  rangeWatermark: null,
  lastFullSyncAt: null,
  lastIncrementalSyncAt: null,
  integrityGuards: [],
};

function nowISO(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function rowToCalendarSource(row: Record<string, unknown>): CalendarSource {
  return {
    calendarSourceId: row.calendar_source_id as string,
    organizationId: row.organization_id as string,
    userId: row.user_id as string,
    provider: row.provider as CalendarProvider,
    accountRef: row.account_ref as string,
    selectedCalendars: safeJsonParse(row.selected_calendars_json as string, []),
    declaredMode: row.declared_mode as DeclaredMode,
    effectiveMode: row.effective_mode as EffectiveMode,
    permissionGradient: row.permission_gradient as PermissionGradient,
    lifecycleState: row.lifecycle_state as SourceLifecycleState,
    requiresActionReason: (row.requires_action_reason as string) || null,
    lastOkAt: (row.last_ok_at as string) || null,
    lastSyncAt: (row.last_sync_at as string) || null,
    syncCheckpoint: safeJsonParse(row.sync_checkpoint_json as string, { ...EMPTY_CHECKPOINT }),
    lastError: (row.last_error as string) || null,
    connectionId: (row.connection_id as string) || null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToCalendarItem(row: Record<string, unknown>): CalendarItem {
  return {
    calendarItemId: row.calendar_item_id as string,
    organizationId: row.organization_id as string,
    sourceId: (row.source_id as string) || null,
    itemType: row.item_type as ItemType,
    sourceSystem: row.source_system as SourceSystem,
    sourceObjectRef: row.source_object_ref as string,
    title: (row.title as string) || null,
    startAt: row.start_at as string,
    endAt: (row.end_at as string) || null,
    allDay: Boolean(row.all_day),
    timezone: (row.timezone as string) || null,
    visibilityClass: row.visibility_class as VisibilityClass,
    editAuthority: row.edit_authority as EditAuthority,
    recurrenceModel: safeJsonParse(row.recurrence_model_json as string, null),
    syncState: row.sync_state as SyncState,
    etag: (row.etag as string) || null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// =========================================================================
// Source CRUD
// =========================================================================

export interface CreateCalendarSourceParams {
  organizationId: string;
  userId: string;
  provider: CalendarProvider;
  accountRef: string;
  selectedCalendars?: string[];
  declaredMode: DeclaredMode;
  permissionGradient?: PermissionGradient;
  connectionId?: string;
}

export async function createCalendarSource(
  params: CreateCalendarSourceParams
): Promise<CalendarSource> {
  const id = uuidv4();
  const now = nowISO();
  const permGradient = params.permissionGradient ?? 'read';
  const effectiveMode = computeEffectiveMode({
    declaredMode: params.declaredMode,
    permissionGradient: permGradient,
    lifecycleState: 'connected',
  } as CalendarSource);

  const checkpoint: SyncCheckpoint = { ...EMPTY_CHECKPOINT };

  await dbRun(
    `INSERT INTO v8_calendar_sources (
       calendar_source_id, organization_id, user_id, provider, account_ref,
       selected_calendars_json, declared_mode, effective_mode, permission_gradient,
       lifecycle_state, requires_action_reason, last_ok_at, last_sync_at,
       sync_checkpoint_json, last_error, connection_id, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.organizationId,
      params.userId,
      params.provider,
      params.accountRef,
      JSON.stringify(params.selectedCalendars ?? []),
      params.declaredMode,
      effectiveMode,
      permGradient,
      'connected',
      null,
      now,
      null,
      JSON.stringify(checkpoint),
      null,
      params.connectionId ?? null,
      now,
      now,
    ]
  );

  logger.info(`${LOG_PREFIX} Created calendar source ${id} for org ${params.organizationId}`);

  const created = await getCalendarSource(id, params.organizationId);
  if (!created) {
    throw new Error(`${LOG_PREFIX} Failed to read back created source ${id}`);
  }
  return created;
}

export async function getCalendarSources(
  organizationId: string,
  userId?: string
): Promise<CalendarSource[]> {
  let sql = `SELECT * FROM v8_calendar_sources WHERE organization_id = ?`;
  const params: unknown[] = [organizationId];

  if (userId) {
    sql += ` AND user_id = ?`;
    params.push(userId);
  }

  sql += ` ORDER BY created_at DESC`;

  const rows = await dbAll<Record<string, unknown>>(sql, params, { fallback: true });
  return (rows || []).map(rowToCalendarSource);
}

export async function getCalendarSource(
  sourceId: string,
  organizationId: string
): Promise<CalendarSource | null> {
  const row = await dbGet<Record<string, unknown>>(
    `SELECT * FROM v8_calendar_sources WHERE calendar_source_id = ? AND organization_id = ?`,
    [sourceId, organizationId],
    { fallback: true }
  );
  if (!row) return null;
  return rowToCalendarSource(row);
}

export async function updateSourceLifecycle(
  sourceId: string,
  organizationId: string,
  newState: SourceLifecycleState,
  reason?: string
): Promise<CalendarSource | null> {
  const now = nowISO();

  const existing = await getCalendarSource(sourceId, organizationId);
  if (!existing) return null;

  const effectiveMode = computeEffectiveMode({
    ...existing,
    lifecycleState: newState,
  });

  await dbRun(
    `UPDATE v8_calendar_sources
       SET lifecycle_state = ?,
           requires_action_reason = ?,
           effective_mode = ?,
           last_ok_at = CASE WHEN ? = 'connected' THEN ? ELSE last_ok_at END,
           updated_at = ?
     WHERE calendar_source_id = ? AND organization_id = ?`,
    [newState, reason ?? null, effectiveMode, newState, now, now, sourceId, organizationId]
  );

  logger.info(
    `${LOG_PREFIX} Source ${sourceId} lifecycle → ${newState}${reason ? ` (${reason})` : ''}`
  );
  return getCalendarSource(sourceId, organizationId);
}

export async function deleteCalendarSource(
  sourceId: string,
  organizationId: string
): Promise<boolean> {
  const existing = await getCalendarSource(sourceId, organizationId);
  if (!existing) return false;

  await dbRun(
    `DELETE FROM v8_calendar_sources WHERE calendar_source_id = ? AND organization_id = ?`,
    [sourceId, organizationId]
  );

  logger.info(`${LOG_PREFIX} Deleted calendar source ${sourceId}`);
  return true;
}

// =========================================================================
// Item CRUD
// =========================================================================

export interface CreateCalendarItemParams {
  organizationId: string;
  sourceId?: string | null;
  itemType: ItemType;
  sourceSystem: SourceSystem;
  sourceObjectRef: string;
  title?: string | null;
  startAt: string;
  endAt?: string | null;
  allDay?: boolean;
  timezone?: string | null;
  visibilityClass?: VisibilityClass;
  editAuthority?: EditAuthority;
  recurrenceModel?: RecurrenceModel | null;
  syncState?: SyncState;
}

export async function createCalendarItem(params: CreateCalendarItemParams): Promise<CalendarItem> {
  const id = uuidv4();
  const now = nowISO();
  const etag = uuidv4();

  await dbRun(
    `INSERT INTO v8_calendar_items (
       calendar_item_id, organization_id, source_id, item_type, source_system,
       source_object_ref, title, start_at, end_at, all_day, timezone,
       visibility_class, edit_authority, recurrence_model_json,
       sync_state, etag, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.organizationId,
      params.sourceId ?? null,
      params.itemType,
      params.sourceSystem,
      params.sourceObjectRef,
      params.title ?? null,
      params.startAt,
      params.endAt ?? null,
      params.allDay ? 1 : 0,
      params.timezone ?? null,
      params.visibilityClass ?? 'details',
      params.editAuthority ?? 'none',
      params.recurrenceModel ? JSON.stringify(params.recurrenceModel) : null,
      params.syncState ?? 'in_sync',
      etag,
      now,
      now,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Created calendar item ${id} (${params.itemType}) for org ${params.organizationId}`
  );

  const created = await getCalendarItem(id, params.organizationId);
  if (!created) {
    throw new Error(`${LOG_PREFIX} Failed to read back created item ${id}`);
  }
  return created;
}

export interface CalendarItemFilters {
  sourceId?: string;
  startAt?: string;
  endAt?: string;
  itemType?: ItemType;
  syncState?: SyncState;
}

export async function getCalendarItems(
  organizationId: string,
  filters: CalendarItemFilters = {}
): Promise<CalendarItem[]> {
  const conditions: string[] = ['organization_id = ?'];
  const params: unknown[] = [organizationId];

  if (filters.sourceId) {
    conditions.push('source_id = ?');
    params.push(filters.sourceId);
  }
  if (filters.startAt) {
    conditions.push('start_at >= ?');
    params.push(filters.startAt);
  }
  if (filters.endAt) {
    conditions.push('(end_at IS NULL OR end_at <= ?)');
    params.push(filters.endAt);
  }
  if (filters.itemType) {
    conditions.push('item_type = ?');
    params.push(filters.itemType);
  }
  if (filters.syncState) {
    conditions.push('sync_state = ?');
    params.push(filters.syncState);
  }

  const sql = `SELECT * FROM v8_calendar_items WHERE ${conditions.join(' AND ')} ORDER BY start_at ASC`;
  const rows = await dbAll<Record<string, unknown>>(sql, params, { fallback: true });
  return (rows || []).map(rowToCalendarItem);
}

export async function getCalendarItem(
  itemId: string,
  organizationId: string
): Promise<CalendarItem | null> {
  const row = await dbGet<Record<string, unknown>>(
    `SELECT * FROM v8_calendar_items WHERE calendar_item_id = ? AND organization_id = ?`,
    [itemId, organizationId],
    { fallback: true }
  );
  if (!row) return null;
  return rowToCalendarItem(row);
}

export interface CalendarItemUpdates {
  title?: string | null;
  startAt?: string;
  endAt?: string | null;
  allDay?: boolean;
  timezone?: string | null;
  visibilityClass?: VisibilityClass;
  editAuthority?: EditAuthority;
  recurrenceModel?: RecurrenceModel | null;
  syncState?: SyncState;
}

export async function updateCalendarItem(
  itemId: string,
  organizationId: string,
  updates: CalendarItemUpdates,
  etag?: string
): Promise<CalendarItem | null> {
  const existing = await getCalendarItem(itemId, organizationId);
  if (!existing) return null;

  if (etag && existing.etag && etag !== existing.etag) {
    logger.warn(
      `${LOG_PREFIX} Etag mismatch on item ${itemId}: expected ${etag}, got ${existing.etag}`
    );
    return null;
  }

  const setClauses: string[] = [];
  const params: unknown[] = [];

  if (updates.title !== undefined) {
    setClauses.push('title = ?');
    params.push(updates.title);
  }
  if (updates.startAt !== undefined) {
    setClauses.push('start_at = ?');
    params.push(updates.startAt);
  }
  if (updates.endAt !== undefined) {
    setClauses.push('end_at = ?');
    params.push(updates.endAt);
  }
  if (updates.allDay !== undefined) {
    setClauses.push('all_day = ?');
    params.push(updates.allDay ? 1 : 0);
  }
  if (updates.timezone !== undefined) {
    setClauses.push('timezone = ?');
    params.push(updates.timezone);
  }
  if (updates.visibilityClass !== undefined) {
    setClauses.push('visibility_class = ?');
    params.push(updates.visibilityClass);
  }
  if (updates.editAuthority !== undefined) {
    setClauses.push('edit_authority = ?');
    params.push(updates.editAuthority);
  }
  if (updates.recurrenceModel !== undefined) {
    setClauses.push('recurrence_model_json = ?');
    params.push(updates.recurrenceModel ? JSON.stringify(updates.recurrenceModel) : null);
  }
  if (updates.syncState !== undefined) {
    setClauses.push('sync_state = ?');
    params.push(updates.syncState);
  }

  if (setClauses.length === 0) return existing;

  const newEtag = uuidv4();
  const now = nowISO();
  setClauses.push('etag = ?');
  params.push(newEtag);
  setClauses.push('updated_at = ?');
  params.push(now);

  params.push(itemId, organizationId);

  await dbRun(
    `UPDATE v8_calendar_items SET ${setClauses.join(', ')} WHERE calendar_item_id = ? AND organization_id = ?`,
    params
  );

  logger.info(`${LOG_PREFIX} Updated calendar item ${itemId}`);
  return getCalendarItem(itemId, organizationId);
}

// =========================================================================
// Sync operations
// =========================================================================

export async function performIncrementalSync(
  sourceId: string,
  organizationId: string
): Promise<SyncResult> {
  const source = await getCalendarSource(sourceId, organizationId);
  if (!source) {
    throw new Error(`${LOG_PREFIX} Source ${sourceId} not found`);
  }

  if (source.lifecycleState === 'blocked') {
    return {
      sourceId,
      syncType: 'incremental',
      itemsProcessed: 0,
      checkpoint: source.syncCheckpoint,
      errors: [`Source is blocked: ${source.requiresActionReason ?? 'unknown reason'}`],
    };
  }

  if (source.lifecycleState === 'requires_action') {
    return {
      sourceId,
      syncType: 'incremental',
      itemsProcessed: 0,
      checkpoint: source.syncCheckpoint,
      errors: [`Source requires action: ${source.requiresActionReason ?? 'unknown reason'}`],
    };
  }

  const now = nowISO();
  const newCursor = uuidv4();
  const updatedCheckpoint: SyncCheckpoint = {
    ...source.syncCheckpoint,
    cursor: newCursor,
    lastIncrementalSyncAt: now,
  };

  await dbRun(
    `UPDATE v8_calendar_sources
       SET sync_checkpoint_json = ?,
           last_sync_at = ?,
           last_ok_at = ?,
           lifecycle_state = CASE WHEN lifecycle_state = 'degraded' THEN 'connected' ELSE lifecycle_state END,
           updated_at = ?
     WHERE calendar_source_id = ? AND organization_id = ?`,
    [JSON.stringify(updatedCheckpoint), now, now, now, sourceId, organizationId]
  );

  const items = await getCalendarItems(organizationId, { sourceId, syncState: 'pending' });
  for (const item of items) {
    await dbRun(
      `UPDATE v8_calendar_items SET sync_state = 'in_sync', updated_at = ? WHERE calendar_item_id = ? AND organization_id = ?`,
      [now, item.calendarItemId, organizationId]
    );
  }

  logger.info(
    `${LOG_PREFIX} Incremental sync completed for source ${sourceId}: ${items.length} items processed`
  );

  return {
    sourceId,
    syncType: 'incremental',
    itemsProcessed: items.length,
    checkpoint: updatedCheckpoint,
    errors: [],
  };
}

export async function performFullResync(
  sourceId: string,
  organizationId: string
): Promise<SyncResult> {
  const source = await getCalendarSource(sourceId, organizationId);
  if (!source) {
    throw new Error(`${LOG_PREFIX} Source ${sourceId} not found`);
  }

  if (source.lifecycleState === 'blocked') {
    return {
      sourceId,
      syncType: 'full',
      itemsProcessed: 0,
      checkpoint: source.syncCheckpoint,
      errors: [`Source is blocked: ${source.requiresActionReason ?? 'unknown reason'}`],
    };
  }

  const now = nowISO();
  const resetCheckpoint: SyncCheckpoint = {
    cursor: null,
    rangeWatermark: null,
    lastFullSyncAt: now,
    lastIncrementalSyncAt: null,
    integrityGuards: [],
  };

  await dbRun(
    `UPDATE v8_calendar_sources
       SET sync_checkpoint_json = ?,
           last_sync_at = ?,
           last_ok_at = ?,
           lifecycle_state = 'connected',
           requires_action_reason = NULL,
           updated_at = ?
     WHERE calendar_source_id = ? AND organization_id = ?`,
    [JSON.stringify(resetCheckpoint), now, now, now, sourceId, organizationId]
  );

  const allItems = await getCalendarItems(organizationId, { sourceId });
  for (const item of allItems) {
    await dbRun(
      `UPDATE v8_calendar_items SET sync_state = 'in_sync', etag = ?, updated_at = ? WHERE calendar_item_id = ? AND organization_id = ?`,
      [uuidv4(), now, item.calendarItemId, organizationId]
    );
  }

  logger.info(
    `${LOG_PREFIX} Full resync completed for source ${sourceId}: ${allItems.length} items reset`
  );

  return {
    sourceId,
    syncType: 'full',
    itemsProcessed: allItems.length,
    checkpoint: resetCheckpoint,
    errors: [],
  };
}

export async function handleSyncError(
  sourceId: string,
  organizationId: string,
  errorType: string
): Promise<CalendarSource | null> {
  const mapping = mapProviderError(errorType);
  const now = nowISO();

  const existing = await getCalendarSource(sourceId, organizationId);
  const newEffectiveMode = existing
    ? computeEffectiveMode({
        ...existing,
        lifecycleState: mapping.sourceState as SourceLifecycleState,
      })
    : 'read';

  await dbRun(
    `UPDATE v8_calendar_sources
       SET lifecycle_state = ?,
           effective_mode = ?,
           requires_action_reason = ?,
           last_error = ?,
           updated_at = ?
     WHERE calendar_source_id = ? AND organization_id = ?`,
    [
      mapping.sourceState,
      newEffectiveMode,
      mapping.recovery,
      errorType,
      now,
      sourceId,
      organizationId,
    ]
  );

  const pendingItems = await getCalendarItems(organizationId, { sourceId, syncState: 'pending' });
  for (const item of pendingItems) {
    await dbRun(
      `UPDATE v8_calendar_items SET sync_state = ?, updated_at = ? WHERE calendar_item_id = ? AND organization_id = ?`,
      [mapping.itemState, now, item.calendarItemId, organizationId]
    );
  }

  logger.warn(
    `${LOG_PREFIX} Sync error on source ${sourceId}: ${errorType} → ${mapping.sourceState}`
  );
  return getCalendarSource(sourceId, organizationId);
}

// =========================================================================
// Conflict-safe writes
// =========================================================================

export async function conditionalWriteItem(
  itemId: string,
  organizationId: string,
  updates: CalendarItemUpdates,
  etag: string
): Promise<CalendarItem | ConflictInfo> {
  const existing = await getCalendarItem(itemId, organizationId);
  if (!existing) {
    throw new Error(`${LOG_PREFIX} Item ${itemId} not found`);
  }

  if (existing.etag !== etag) {
    const now = nowISO();
    await dbRun(
      `UPDATE v8_calendar_items SET sync_state = 'conflict', updated_at = ? WHERE calendar_item_id = ? AND organization_id = ?`,
      [now, itemId, organizationId]
    );

    logger.warn(`${LOG_PREFIX} Conflict on item ${itemId}: etag ${etag} vs ${existing.etag}`);

    return {
      itemId,
      currentEtag: existing.etag,
      providedEtag: etag,
      syncState: 'conflict' as SyncState,
    };
  }

  const updated = await updateCalendarItem(itemId, organizationId, updates, etag);
  if (!updated) {
    throw new Error(`${LOG_PREFIX} Failed to update item ${itemId} after etag check`);
  }
  return updated;
}

export async function resolveConflict(
  itemId: string,
  organizationId: string,
  resolution: 'accept_local' | 'accept_remote' | 'merge'
): Promise<CalendarItem | null> {
  const existing = await getCalendarItem(itemId, organizationId);
  if (!existing) return null;

  if (existing.syncState !== 'conflict') {
    logger.warn(
      `${LOG_PREFIX} resolveConflict called on item ${itemId} but syncState is ${existing.syncState}`
    );
    return existing;
  }

  const now = nowISO();
  const newEtag = uuidv4();
  let newSyncState: SyncState;

  switch (resolution) {
    case 'accept_local':
      newSyncState = 'pending';
      break;
    case 'accept_remote':
      newSyncState = 'in_sync';
      break;
    case 'merge':
      newSyncState = 'pending';
      break;
  }

  await dbRun(
    `UPDATE v8_calendar_items SET sync_state = ?, etag = ?, updated_at = ? WHERE calendar_item_id = ? AND organization_id = ?`,
    [newSyncState, newEtag, now, itemId, organizationId]
  );

  logger.info(`${LOG_PREFIX} Conflict resolved on item ${itemId}: ${resolution} → ${newSyncState}`);
  return getCalendarItem(itemId, organizationId);
}

// =========================================================================
// Permission + lifecycle
// =========================================================================

const PERMISSION_RANK: Record<PermissionGradient, number> = {
  free_busy: 0,
  read: 1,
  write: 2,
  delegate: 3,
};

export function computeEffectiveMode(
  source: Pick<CalendarSource, 'declaredMode' | 'permissionGradient' | 'lifecycleState'>
): EffectiveMode {
  if (source.lifecycleState === 'blocked') return 'read';
  if (source.lifecycleState === 'requires_action') return 'read';

  const permRank = PERMISSION_RANK[source.permissionGradient];

  if (source.declaredMode === 'bidir') {
    if (permRank >= PERMISSION_RANK.write) return 'bidir';
    if (permRank >= PERMISSION_RANK.read) return 'read';
    return 'read';
  }

  if (source.declaredMode === 'write') {
    if (permRank >= PERMISSION_RANK.write) return 'write';
    return 'read';
  }

  return 'read';
}

export async function getSourceHealth(organizationId: string): Promise<SourceHealthSummary> {
  const sources = await getCalendarSources(organizationId);

  const summary: SourceHealthSummary = {
    organizationId,
    totalSources: sources.length,
    connected: 0,
    degraded: 0,
    requiresAction: 0,
    blocked: 0,
    recoverable: 0,
  };

  for (const src of sources) {
    switch (src.lifecycleState) {
      case 'connected':
        summary.connected++;
        break;
      case 'degraded':
        summary.degraded++;
        break;
      case 'requires_action':
        summary.requiresAction++;
        break;
      case 'blocked':
        summary.blocked++;
        break;
      case 'recoverable':
        summary.recoverable++;
        break;
    }
  }

  return summary;
}

// =========================================================================
// Error posture (§2.3.8)
// =========================================================================

const PROVIDER_ERROR_MAP: Record<string, ProviderErrorMapping> = {
  token_expired: {
    sourceState: 'requires_action',
    itemState: 'blocked',
    recovery: 'Re-authenticate with the calendar provider to refresh the access token.',
  },
  token_revoked: {
    sourceState: 'requires_action',
    itemState: 'blocked',
    recovery: 'Access was revoked. Re-authorize the calendar connection.',
  },
  insufficient_permissions: {
    sourceState: 'requires_action',
    itemState: 'blocked',
    recovery: 'Grant the required calendar permissions and reconnect.',
  },
  rate_limited: {
    sourceState: 'degraded',
    itemState: 'stale',
    recovery: 'Provider rate limit reached. Sync will retry automatically with backoff.',
  },
  quota_exceeded: {
    sourceState: 'degraded',
    itemState: 'stale',
    recovery: 'API quota exceeded. Sync will resume when quota resets.',
  },
  provider_unavailable: {
    sourceState: 'degraded',
    itemState: 'stale',
    recovery: 'Calendar provider is temporarily unavailable. Automatic retry scheduled.',
  },
  network_error: {
    sourceState: 'degraded',
    itemState: 'stale',
    recovery: 'Network connectivity issue. Sync will retry automatically.',
  },
  calendar_not_found: {
    sourceState: 'requires_action',
    itemState: 'blocked',
    recovery: 'The selected calendar no longer exists. Update the calendar selection.',
  },
  calendar_deleted: {
    sourceState: 'blocked',
    itemState: 'blocked',
    recovery: 'The calendar has been permanently deleted. Remove or reconfigure this source.',
  },
  sync_token_invalid: {
    sourceState: 'recoverable',
    itemState: 'stale',
    recovery: 'Sync token expired. A full resync will be triggered automatically.',
  },
  data_corruption: {
    sourceState: 'blocked',
    itemState: 'blocked',
    recovery: 'Data integrity check failed. Manual intervention required.',
  },
  account_suspended: {
    sourceState: 'blocked',
    itemState: 'blocked',
    recovery: 'The provider account is suspended. Resolve the account issue and reconnect.',
  },
  /** Stable P02 contract codes (used by routes/tests) */
  oauth_expired: {
    sourceState: 'requires_action',
    itemState: 'blocked',
    recovery: 'Re-authenticate with the calendar provider to refresh the access token.',
  },
  etag_mismatch: {
    sourceState: 'degraded',
    itemState: 'conflict',
    recovery: 'Conditional write failed (etag mismatch). User resolves conflict manually.',
  },
  cursor_invalid: {
    sourceState: 'recoverable',
    itemState: 'stale',
    recovery: 'Sync token expired. A full resync will be triggered automatically.',
  },
  permanent_auth_failure: {
    sourceState: 'blocked',
    itemState: 'blocked',
    recovery: 'Permanent authorization failure. Operator intervention required.',
  },
};

const DEFAULT_ERROR_MAPPING: ProviderErrorMapping = {
  sourceState: 'degraded',
  itemState: 'stale',
  recovery: 'An unexpected error occurred. Sync will retry automatically.',
};

export function mapProviderError(errorType: string): ProviderErrorMapping {
  return PROVIDER_ERROR_MAP[errorType] ?? DEFAULT_ERROR_MAPPING;
}
