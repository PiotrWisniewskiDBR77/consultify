/**
 * V8 CollaborationRoom — Multiplayer Core Primitives
 *
 * Core type family for the V8 multiplayer runtime.
 * Provides room lifecycle, presence, membership, and collaboration events.
 * Separate from the legacy V4 collab_sessions system.
 */

import { z } from 'zod';

// ==========================================
// ENUMS / LITERALS
// ==========================================

export const RoomStateValues = ['active', 'idle', 'closed', 'error'] as const;
export type RoomState = (typeof RoomStateValues)[number];

export const PresenceTypeValues = [
  'viewer',
  'editor',
  'facilitator',
  'observer',
  'ai_agent',
] as const;
export type PresenceType = (typeof PresenceTypeValues)[number];

export const EventDeliveryValues = ['ephemeral', 'durable'] as const;
export type EventDelivery = (typeof EventDeliveryValues)[number];

export const ActorTypeValues = ['human', 'ai_agent', 'system'] as const;
export type ActorType = (typeof ActorTypeValues)[number];

export const CollaborationEventTypeValues = [
  // Room lifecycle
  'room.created',
  'room.activated',
  'room.idle',
  'room.closed',
  'room.error',
  // Membership
  'membership.joined',
  'membership.left',
  'membership.role_changed',
  // Presence
  'presence.updated',
  'presence.stale_removed',
  // Collaboration
  'collaboration.edit_started',
  'collaboration.edit_completed',
  'collaboration.conflict_detected',
  // Awareness
  'awareness.cursor_moved',
  'awareness.selection_changed',
  'awareness.typing_started',
  'awareness.typing_stopped',
  // System
  'system.heartbeat',
  'system.reconnected',
  'system.degraded',
] as const;
export type CollaborationEventType = (typeof CollaborationEventTypeValues)[number];

// ==========================================
// INTERFACES
// ==========================================

export interface CollaborationRoom {
  roomId: string;
  resourceType: string;
  resourceId: string;
  organizationId: string;
  roomState: RoomState;
  createdAt: string;
  closedAt: string | null;
  metadata: Record<string, unknown>;
}

export interface RoomPresence {
  presenceId: string;
  roomId: string;
  userId: string;
  presenceType: PresenceType;
  cursorState: Record<string, unknown> | null;
  lastHeartbeat: string;
  connectedAt: string;
  clientId: string;
  isStale: boolean;
}

export interface RoomMembership {
  membershipId: string;
  roomId: string;
  userId: string;
  joinedAt: string;
  leftAt: string | null;
  role: PresenceType;
}

export interface CollaborationEvent {
  eventId: string;
  roomId: string;
  eventType: CollaborationEventType;
  actorId: string;
  actorType: ActorType;
  delivery: EventDelivery;
  payload: Record<string, unknown>;
  timestamp: string;
  stateVersion: number | null;
}

// ==========================================
// ZOD SCHEMAS
// ==========================================

export const CollaborationRoomSchema = z.object({
  roomId: z.string().uuid(),
  resourceType: z.string().min(1),
  resourceId: z.string().min(1),
  organizationId: z.string().uuid(),
  roomState: z.enum(RoomStateValues),
  createdAt: z.string().min(1),
  closedAt: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
});

export const RoomPresenceSchema = z.object({
  presenceId: z.string().uuid(),
  roomId: z.string().uuid(),
  userId: z.string().min(1),
  presenceType: z.enum(PresenceTypeValues),
  cursorState: z.record(z.string(), z.unknown()).nullable(),
  lastHeartbeat: z.string().min(1),
  connectedAt: z.string().min(1),
  clientId: z.string().min(1),
  isStale: z.boolean(),
});

export const RoomMembershipSchema = z.object({
  membershipId: z.string().uuid(),
  roomId: z.string().uuid(),
  userId: z.string().min(1),
  joinedAt: z.string().min(1),
  leftAt: z.string().nullable(),
  role: z.enum(PresenceTypeValues),
});

export const CollaborationEventSchema = z.object({
  eventId: z.string().uuid(),
  roomId: z.string().uuid(),
  eventType: z.enum(CollaborationEventTypeValues),
  actorId: z.string().min(1),
  actorType: z.enum(ActorTypeValues),
  delivery: z.enum(EventDeliveryValues),
  payload: z.record(z.string(), z.unknown()),
  timestamp: z.string().min(1),
  stateVersion: z.number().int().nullable(),
});

// ==========================================
// INPUT TYPES (for service layer)
// ==========================================

export interface CreateRoomParams {
  resourceType: string;
  resourceId: string;
  organizationId: string;
  metadata?: Record<string, unknown>;
}

export const CreateRoomParamsSchema = z.object({
  resourceType: z.string().min(1),
  resourceId: z.string().min(1),
  organizationId: z.string().uuid(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export interface JoinRoomParams {
  roomId: string;
  userId: string;
  presenceType: PresenceType;
  clientId: string;
}

export const JoinRoomParamsSchema = z.object({
  roomId: z.string().uuid(),
  userId: z.string().min(1),
  presenceType: z.enum(PresenceTypeValues),
  clientId: z.string().min(1),
});

export interface UpdatePresenceParams {
  cursorState?: Record<string, unknown> | null;
}

export const UpdatePresenceParamsSchema = z.object({
  cursorState: z.record(z.string(), z.unknown()).nullable().optional(),
});

export interface RecordEventParams {
  roomId: string;
  eventType: CollaborationEventType;
  actorId: string;
  actorType: ActorType;
  delivery: EventDelivery;
  payload?: Record<string, unknown>;
  stateVersion?: number | null;
}

export const RecordEventParamsSchema = z.object({
  roomId: z.string().uuid(),
  eventType: z.enum(CollaborationEventTypeValues),
  actorId: z.string().min(1),
  actorType: z.enum(ActorTypeValues),
  delivery: z.enum(EventDeliveryValues),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
  stateVersion: z.number().int().nullable().optional(),
});

export interface GetEventsOptions {
  eventType?: CollaborationEventType;
  limit?: number;
  offset?: number;
}

// ==========================================
// STATE MACHINE
// ==========================================

/**
 * Valid state transitions for CollaborationRoom.
 * Key = fromState, Value = set of allowed toStates.
 */
export const VALID_ROOM_TRANSITIONS: Record<RoomState, readonly RoomState[]> = {
  active: ['idle', 'closed', 'error'],
  idle: ['active', 'closed'],
  closed: [],
  error: ['active', 'closed'],
} as const;

export const TERMINAL_ROOM_STATES: ReadonlySet<RoomState> = new Set(['closed']);
