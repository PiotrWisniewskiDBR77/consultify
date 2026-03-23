/**
 * V8 Workspace Collaboration — Session, Shared Context, Activity Feed
 *
 * Workspace-level collaboration layer that sits ABOVE individual tool rooms.
 * A workspace session groups multiple tool rooms and provides shared context
 * and a unified activity feed across all linked rooms.
 *
 * Depends on: collaborationRoom.ts (room lifecycle)
 */

import { z } from 'zod';

// ==========================================
// ENUMS / LITERALS
// ==========================================

export const WorkspaceSessionStateValues = ['active', 'paused', 'completed', 'abandoned'] as const;
export type WorkspaceSessionState = (typeof WorkspaceSessionStateValues)[number];

export const ActivityFeedEntryTypeValues = [
  'session.started', 'session.paused', 'session.resumed', 'session.completed',
  'participant.joined', 'participant.left',
  'room.linked', 'room.unlinked',
  'context.shared', 'context.updated',
  'decision.made', 'action.assigned',
] as const;
export type ActivityFeedEntryType = (typeof ActivityFeedEntryTypeValues)[number];

// ==========================================
// INTERFACES
// ==========================================

export interface WorkspaceSession {
  sessionId: string;
  workspaceId: string;
  organizationId: string;
  title: string;
  state: WorkspaceSessionState;
  createdBy: string;
  linkedRoomIds: string[];
  sharedContext: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface ActivityFeedEntry {
  entryId: string;
  sessionId: string;
  organizationId: string;
  entryType: ActivityFeedEntryType;
  actorId: string;
  actorDisplayName: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface SharedContextUpdate {
  key: string;
  value: unknown;
  updatedBy: string;
}

// ==========================================
// ZOD SCHEMAS — ENTITY VALIDATION
// ==========================================

export const WorkspaceSessionSchema = z.object({
  sessionId: z.string().uuid(),
  workspaceId: z.string().min(1),
  organizationId: z.string().uuid(),
  title: z.string().min(1),
  state: z.enum(WorkspaceSessionStateValues),
  createdBy: z.string().min(1),
  linkedRoomIds: z.array(z.string()),
  sharedContext: z.record(z.string(), z.unknown()),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  completedAt: z.string().nullable(),
});

export const ActivityFeedEntrySchema = z.object({
  entryId: z.string().uuid(),
  sessionId: z.string().uuid(),
  organizationId: z.string().uuid(),
  entryType: z.enum(ActivityFeedEntryTypeValues),
  actorId: z.string().min(1),
  actorDisplayName: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.string().min(1),
});

// ==========================================
// INPUT TYPES (for service layer)
// ==========================================

export interface CreateSessionParams {
  workspaceId: string;
  organizationId: string;
  title: string;
  createdBy: string;
}

export const CreateSessionParamsSchema = z.object({
  workspaceId: z.string().min(1),
  organizationId: z.string().uuid(),
  title: z.string().min(1),
  createdBy: z.string().min(1),
});

export interface LinkRoomParams {
  sessionId: string;
  roomId: string;
  organizationId: string;
}

export const LinkRoomParamsSchema = z.object({
  sessionId: z.string().uuid(),
  roomId: z.string().uuid(),
  organizationId: z.string().uuid(),
});

export interface RecordActivityParams {
  sessionId: string;
  organizationId: string;
  entryType: ActivityFeedEntryType;
  actorId: string;
  actorDisplayName: string;
  payload?: Record<string, unknown>;
}

export const RecordActivityParamsSchema = z.object({
  sessionId: z.string().uuid(),
  organizationId: z.string().uuid(),
  entryType: z.enum(ActivityFeedEntryTypeValues),
  actorId: z.string().min(1),
  actorDisplayName: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
});

export interface UpdateSharedContextParams {
  sessionId: string;
  organizationId: string;
  updates: SharedContextUpdate[];
}

export const UpdateSharedContextParamsSchema = z.object({
  sessionId: z.string().uuid(),
  organizationId: z.string().uuid(),
  updates: z.array(z.object({
    key: z.string().min(1),
    value: z.unknown(),
    updatedBy: z.string().min(1),
  })).min(1),
});

// ==========================================
// STATE MACHINE
// ==========================================

export const VALID_SESSION_TRANSITIONS: Record<WorkspaceSessionState, readonly WorkspaceSessionState[]> = {
  active: ['paused', 'completed', 'abandoned'],
  paused: ['active', 'completed', 'abandoned'],
  completed: [],
  abandoned: [],
} as const;

export const TERMINAL_SESSION_STATES: ReadonlySet<WorkspaceSessionState> = new Set(['completed', 'abandoned']);
