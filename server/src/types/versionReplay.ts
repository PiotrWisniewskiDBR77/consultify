/**
 * V8 Version/Replay/Audit Spine — Core Primitives
 *
 * Types for the durable version, replay, and audit layer
 * that makes multiplayer collaboration explainable and recoverable.
 * Builds on CollaborationRoom primitives (WP-W1-MP-01).
 */

import { z } from 'zod';

import type { ActorType } from './collaborationRoom.js';
import { ActorTypeValues } from './collaborationRoom.js';

// ==========================================
// ENUMS / LITERALS
// ==========================================

export const SnapshotTriggerValues = [
  'manual_save',
  'auto_cadence',
  'ai_proposal_accepted',
  'milestone',
  'pre_restore_safety',
  'session_boundary',
] as const;
export type SnapshotTrigger = (typeof SnapshotTriggerValues)[number];

export const RestoreStatusValues = ['pending', 'applied', 'rejected'] as const;
export type RestoreStatus = (typeof RestoreStatusValues)[number];

export const AuditActionValues = [
  'snapshot.created',
  'snapshot.restored',
  'version.compared',
  'restore.requested',
  'restore.applied',
  'restore.rejected',
  'edit.committed',
  'ai.proposal_submitted',
  'ai.proposal_accepted',
  'ai.proposal_rejected',
  'ai.proposal_stale',
] as const;
export type AuditAction = (typeof AuditActionValues)[number];

// ==========================================
// INTERFACES
// ==========================================

export interface ActorAttribution {
  actorId: string;
  actorType: ActorType;
  actorDisplayName: string;
}

export interface VersionSnapshot {
  snapshotId: string;
  roomId: string | null;
  resourceType: string;
  resourceId: string;
  organizationId: string;
  stateVersion: number;
  stateData: Record<string, unknown>;
  triggerType: SnapshotTrigger;
  capturedBy: ActorAttribution;
  capturedAt: string;
  metadata: Record<string, unknown>;
}

export interface VersionCompareChange {
  path: string;
  changeType: 'added' | 'removed' | 'modified';
  before: unknown;
  after: unknown;
}

export interface VersionCompareResult {
  fromVersion: number;
  toVersion: number;
  fromSnapshotId: string;
  toSnapshotId: string;
  changes: VersionCompareChange[];
}

export interface RestoreRequest {
  restoreId: string;
  roomId: string | null;
  resourceType: string;
  resourceId: string;
  organizationId: string;
  targetVersionSnapshotId: string;
  requestedBy: ActorAttribution;
  status: RestoreStatus;
  safetySnapshotId: string | null;
  requestedAt: string;
  resolvedAt: string | null;
}

export interface AuditEntry {
  entryId: string;
  roomId: string | null;
  resourceType: string;
  resourceId: string;
  organizationId: string;
  actorAttribution: ActorAttribution;
  action: AuditAction;
  stateVersionBefore: number | null;
  stateVersionAfter: number | null;
  metadata: Record<string, unknown>;
  timestamp: string;
}

// ==========================================
// ZOD SCHEMAS
// ==========================================

export const ActorAttributionSchema = z.object({
  actorId: z.string().min(1),
  actorType: z.enum(ActorTypeValues),
  actorDisplayName: z.string().min(1),
});

export const VersionSnapshotSchema = z.object({
  snapshotId: z.string().uuid(),
  roomId: z.string().uuid().nullable(),
  resourceType: z.string().min(1),
  resourceId: z.string().min(1),
  organizationId: z.string().uuid(),
  stateVersion: z.number().int().nonnegative(),
  stateData: z.record(z.string(), z.unknown()),
  triggerType: z.enum(SnapshotTriggerValues),
  capturedBy: ActorAttributionSchema,
  capturedAt: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()),
});

export const VersionCompareChangeSchema = z.object({
  path: z.string().min(1),
  changeType: z.enum(['added', 'removed', 'modified']),
  before: z.unknown(),
  after: z.unknown(),
});

export const VersionCompareResultSchema = z.object({
  fromVersion: z.number().int().nonnegative(),
  toVersion: z.number().int().nonnegative(),
  fromSnapshotId: z.string().uuid(),
  toSnapshotId: z.string().uuid(),
  changes: z.array(VersionCompareChangeSchema),
});

export const RestoreRequestSchema = z.object({
  restoreId: z.string().uuid(),
  roomId: z.string().uuid().nullable(),
  resourceType: z.string().min(1),
  resourceId: z.string().min(1),
  organizationId: z.string().uuid(),
  targetVersionSnapshotId: z.string().uuid(),
  requestedBy: ActorAttributionSchema,
  status: z.enum(RestoreStatusValues),
  safetySnapshotId: z.string().uuid().nullable(),
  requestedAt: z.string().min(1),
  resolvedAt: z.string().nullable(),
});

export const AuditEntrySchema = z.object({
  entryId: z.string().uuid(),
  roomId: z.string().uuid().nullable(),
  resourceType: z.string().min(1),
  resourceId: z.string().min(1),
  organizationId: z.string().uuid(),
  actorAttribution: ActorAttributionSchema,
  action: z.enum(AuditActionValues),
  stateVersionBefore: z.number().int().nullable(),
  stateVersionAfter: z.number().int().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  timestamp: z.string().min(1),
});

// ==========================================
// INPUT TYPES (for service layer)
// ==========================================

export interface CaptureSnapshotParams {
  roomId?: string | null;
  resourceType: string;
  resourceId: string;
  organizationId: string;
  stateData: Record<string, unknown>;
  triggerType: SnapshotTrigger;
  capturedBy: ActorAttribution;
  metadata?: Record<string, unknown>;
}

export const CaptureSnapshotParamsSchema = z.object({
  roomId: z.string().uuid().nullable().optional(),
  resourceType: z.string().min(1),
  resourceId: z.string().min(1),
  organizationId: z.string().uuid(),
  stateData: z.record(z.string(), z.unknown()),
  triggerType: z.enum(SnapshotTriggerValues),
  capturedBy: ActorAttributionSchema,
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export interface GetVersionHistoryOptions {
  limit?: number;
  offset?: number;
  triggerType?: SnapshotTrigger;
}

export interface RequestRestoreParams {
  roomId?: string | null;
  resourceType: string;
  resourceId: string;
  organizationId: string;
  targetVersionSnapshotId: string;
  requestedBy: ActorAttribution;
  currentStateData: Record<string, unknown>;
}

export const RequestRestoreParamsSchema = z.object({
  roomId: z.string().uuid().nullable().optional(),
  resourceType: z.string().min(1),
  resourceId: z.string().min(1),
  organizationId: z.string().uuid(),
  targetVersionSnapshotId: z.string().uuid(),
  requestedBy: ActorAttributionSchema,
  currentStateData: z.record(z.string(), z.unknown()),
});

export interface RecordAuditEntryParams {
  roomId?: string | null;
  resourceType: string;
  resourceId: string;
  organizationId: string;
  actorAttribution: ActorAttribution;
  action: AuditAction;
  stateVersionBefore?: number | null;
  stateVersionAfter?: number | null;
  metadata?: Record<string, unknown>;
}

export const RecordAuditEntryParamsSchema = z.object({
  roomId: z.string().uuid().nullable().optional(),
  resourceType: z.string().min(1),
  resourceId: z.string().min(1),
  organizationId: z.string().uuid(),
  actorAttribution: ActorAttributionSchema,
  action: z.enum(AuditActionValues),
  stateVersionBefore: z.number().int().nullable().optional(),
  stateVersionAfter: z.number().int().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export interface GetAuditTrailOptions {
  limit?: number;
  offset?: number;
  action?: AuditAction;
  actorId?: string;
}
