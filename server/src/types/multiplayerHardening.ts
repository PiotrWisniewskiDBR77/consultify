/**
 * V8 Multiplayer Platform Hardening — Types & Schemas
 *
 * Extends the Wave 1 CollaborationRoom baseline with:
 * - Per-tool room mapping (ResourceTypeMapping)
 * - Surface-aware presence (SurfacePresence) — Decision W4-5
 * - Facilitation lifecycle (FacilitationSession) — Decision W4-2
 * - Platform seam registry (PlatformSeamRecord)
 * - Tool event registration (ToolEventRegistration)
 *
 * Does NOT modify existing collaborationRoom.ts types.
 */

import { z } from 'zod';
import type { PresenceType, EventDelivery } from './collaborationRoom.js';
import { PresenceTypeValues, EventDeliveryValues } from './collaborationRoom.js';

// ==========================================
// ENUMS / LITERALS
// ==========================================

export const WorkspaceToolValues = [
  'workspace',
  'whiteboard',
  'table',
  'notebook',
  'mindmap',
  'processflow',
] as const;
export type WorkspaceTool = (typeof WorkspaceToolValues)[number];

export const RoomGranularityValues = [
  'per_workspace',
  'per_resource',
] as const;
export type RoomGranularity = (typeof RoomGranularityValues)[number];

export const SurfaceValues = [
  'mindmap',
  'whiteboard',
  'process_flow',
  'table',
  'notebook',
] as const;
export type Surface = (typeof SurfaceValues)[number];

export const FacilitationSessionStateValues = [
  'active',
  'paused_degraded',
  'ended',
] as const;
export type FacilitationSessionState = (typeof FacilitationSessionStateValues)[number];

export const FacilitationPauseReasonValues = [
  'facilitator_disconnect',
  'room_degraded',
  'manual',
] as const;
export type FacilitationPauseReason = (typeof FacilitationPauseReasonValues)[number];

export const SeamTypeValues = [
  'room_binding',
  'presence',
  'events',
  'locking',
  'degraded_state',
  'reconnect',
  'authorization',
  'facilitation',
] as const;
export type SeamType = (typeof SeamTypeValues)[number];

export const SeamCurrentStateValues = [
  'module_local',
  'platform_migrated',
  'eliminated',
] as const;
export type SeamCurrentState = (typeof SeamCurrentStateValues)[number];

// ==========================================
// FACILITATION STATE MACHINE
// ==========================================

export const VALID_FACILITATION_TRANSITIONS: Record<FacilitationSessionState, readonly FacilitationSessionState[]> = {
  active: ['paused_degraded', 'ended'],
  paused_degraded: ['active', 'ended'],
  ended: [],
} as const;

export const TERMINAL_FACILITATION_STATES: ReadonlySet<FacilitationSessionState> = new Set(['ended']);

// ==========================================
// INTERFACES
// ==========================================

export interface ResourceTypeMapping {
  mappingId: string;
  resourceType: WorkspaceTool;
  roomGranularity: RoomGranularity;
  embeddedIn: WorkspaceTool | null;
  surfaceAware: boolean;
  organizationId: string;
  createdAt: string;
}

export interface SurfaceContext {
  surface: Surface;
  subResourceId: string | null;
  isEmbedded: boolean;
}

export interface SurfacePresence {
  surfacePresenceId: string;
  userId: string;
  roomId: string;
  activeSurface: Surface;
  presenceType: PresenceType;
  cursorState: Record<string, unknown> | null;
  lastHeartbeat: string;
  organizationId: string;
}

export interface FacilitationPhaseEntry {
  phase: string;
  startedAt: string;
  endedAt: string | null;
}

export interface FacilitationSession {
  sessionId: string;
  roomId: string;
  facilitatorUserId: string;
  sessionState: FacilitationSessionState;
  currentPhase: string | null;
  phaseHistory: FacilitationPhaseEntry[];
  startedAt: string;
  pausedAt: string | null;
  endedAt: string | null;
  pauseReason: FacilitationPauseReason | null;
  organizationId: string;
}

export interface PlatformSeamRecord {
  seamId: string;
  toolName: WorkspaceTool;
  seamType: SeamType;
  currentState: SeamCurrentState;
  v4SeamRef: string | null;
  organizationId: string;
  createdAt: string;
  migratedAt: string | null;
}

export interface ToolEventRegistration {
  registrationId: string;
  eventType: string;
  toolName: WorkspaceTool;
  deliveryTier: EventDelivery;
  surfaceContext: boolean;
  registered: boolean;
  organizationId: string;
  createdAt: string;
}

// ==========================================
// ZOD SCHEMAS
// ==========================================

export const ResourceTypeMappingSchema = z.object({
  mappingId: z.string().uuid(),
  resourceType: z.enum(WorkspaceToolValues),
  roomGranularity: z.enum(RoomGranularityValues),
  embeddedIn: z.enum(WorkspaceToolValues).nullable(),
  surfaceAware: z.boolean(),
  organizationId: z.string().uuid(),
  createdAt: z.string().min(1),
});

export const SurfaceContextSchema = z.object({
  surface: z.enum(SurfaceValues),
  subResourceId: z.string().nullable(),
  isEmbedded: z.boolean(),
});

export const SurfacePresenceSchema = z.object({
  surfacePresenceId: z.string().uuid(),
  userId: z.string().min(1),
  roomId: z.string().uuid(),
  activeSurface: z.enum(SurfaceValues),
  presenceType: z.enum(PresenceTypeValues),
  cursorState: z.record(z.string(), z.unknown()).nullable(),
  lastHeartbeat: z.string().min(1),
  organizationId: z.string().uuid(),
});

export const FacilitationPhaseEntrySchema = z.object({
  phase: z.string().min(1),
  startedAt: z.string().min(1),
  endedAt: z.string().nullable(),
});

export const FacilitationSessionSchema = z.object({
  sessionId: z.string().uuid(),
  roomId: z.string().uuid(),
  facilitatorUserId: z.string().min(1),
  sessionState: z.enum(FacilitationSessionStateValues),
  currentPhase: z.string().nullable(),
  phaseHistory: z.array(FacilitationPhaseEntrySchema),
  startedAt: z.string().min(1),
  pausedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  pauseReason: z.enum(FacilitationPauseReasonValues).nullable(),
  organizationId: z.string().uuid(),
});

export const PlatformSeamRecordSchema = z.object({
  seamId: z.string().uuid(),
  toolName: z.enum(WorkspaceToolValues),
  seamType: z.enum(SeamTypeValues),
  currentState: z.enum(SeamCurrentStateValues),
  v4SeamRef: z.string().nullable(),
  organizationId: z.string().uuid(),
  createdAt: z.string().min(1),
  migratedAt: z.string().nullable(),
});

export const ToolEventRegistrationSchema = z.object({
  registrationId: z.string().uuid(),
  eventType: z.string().min(1),
  toolName: z.enum(WorkspaceToolValues),
  deliveryTier: z.enum(EventDeliveryValues),
  surfaceContext: z.boolean(),
  registered: z.boolean(),
  organizationId: z.string().uuid(),
  createdAt: z.string().min(1),
});

// ==========================================
// INPUT TYPES (for service layer)
// ==========================================

export interface RegisterResourceTypeMappingParams {
  resourceType: WorkspaceTool;
  roomGranularity: RoomGranularity;
  embeddedIn?: WorkspaceTool | null;
  surfaceAware: boolean;
  organizationId: string;
}

export const RegisterResourceTypeMappingParamsSchema = z.object({
  resourceType: z.enum(WorkspaceToolValues),
  roomGranularity: z.enum(RoomGranularityValues),
  embeddedIn: z.enum(WorkspaceToolValues).nullable().optional().default(null),
  surfaceAware: z.boolean(),
  organizationId: z.string().uuid(),
});

export interface UpdateSurfacePresenceParams {
  userId: string;
  roomId: string;
  activeSurface: Surface;
  presenceType: PresenceType;
  cursorState?: Record<string, unknown> | null;
  organizationId: string;
}

export const UpdateSurfacePresenceParamsSchema = z.object({
  userId: z.string().min(1),
  roomId: z.string().uuid(),
  activeSurface: z.enum(SurfaceValues),
  presenceType: z.enum(PresenceTypeValues),
  cursorState: z.record(z.string(), z.unknown()).nullable().optional().default(null),
  organizationId: z.string().uuid(),
});

export interface StartFacilitationParams {
  roomId: string;
  facilitatorUserId: string;
  initialPhase?: string;
  organizationId: string;
}

export const StartFacilitationParamsSchema = z.object({
  roomId: z.string().uuid(),
  facilitatorUserId: z.string().min(1),
  initialPhase: z.string().min(1).optional(),
  organizationId: z.string().uuid(),
});

export interface RegisterSeamParams {
  toolName: WorkspaceTool;
  seamType: SeamType;
  currentState?: SeamCurrentState;
  v4SeamRef?: string | null;
  organizationId: string;
}

export const RegisterSeamParamsSchema = z.object({
  toolName: z.enum(WorkspaceToolValues),
  seamType: z.enum(SeamTypeValues),
  currentState: z.enum(SeamCurrentStateValues).optional().default('module_local'),
  v4SeamRef: z.string().nullable().optional().default(null),
  organizationId: z.string().uuid(),
});

export interface RegisterToolEventParams {
  eventType: string;
  toolName: WorkspaceTool;
  deliveryTier: EventDelivery;
  surfaceContext: boolean;
  organizationId: string;
}

export const RegisterToolEventParamsSchema = z.object({
  eventType: z.string().min(1),
  toolName: z.enum(WorkspaceToolValues),
  deliveryTier: z.enum(EventDeliveryValues),
  surfaceContext: z.boolean(),
  organizationId: z.string().uuid(),
});
