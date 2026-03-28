/**
 * V8 Workspace Governance — Roles, permissions, content classification, compliance
 *
 * Session-level collaboration governance: who can do what, content labels,
 * and compliance check history. Used with workspace collaboration sessions.
 */

import { z } from 'zod';

// ==========================================
// ENUMS / LITERALS
// ==========================================

export const WorkspaceRoleValues = ['owner', 'admin', 'editor', 'viewer', 'guest'] as const;
export type WorkspaceRole = (typeof WorkspaceRoleValues)[number];

export const PermissionActionValues = [
  'session.create',
  'session.pause',
  'session.complete',
  'room.link',
  'room.unlink',
  'context.update',
  'context.read',
  'activity.read',
  'activity.write',
  'suggestion.accept',
  'suggestion.dismiss',
  'decision.create',
  'decision.vote',
  'decision.close',
  'governance.manage',
] as const;
export type PermissionAction = (typeof PermissionActionValues)[number];

export const ContentClassificationValues = [
  'public',
  'internal',
  'confidential',
  'restricted',
] as const;
export type ContentClassification = (typeof ContentClassificationValues)[number];

// ==========================================
// INTERFACES
// ==========================================

export interface WorkspacePermission {
  permissionId: string;
  workspaceId: string;
  organizationId: string;
  userId: string;
  role: WorkspaceRole;
  grantedBy: string;
  grantedAt: string;
  revokedAt: string | null;
}

export interface ContentGovernanceRecord {
  recordId: string;
  sessionId: string;
  organizationId: string;
  resourceRef: string;
  classification: ContentClassification;
  retentionDays: number;
  classifiedBy: string;
  classifiedAt: string;
}

export interface ComplianceCheckResult {
  checkId: string;
  sessionId: string;
  organizationId: string;
  checkType: string;
  passed: boolean;
  details: string;
  checkedAt: string;
}

export interface GovernanceDashboard {
  permissionCountByRole: Record<WorkspaceRole, number>;
  contentClassificationCounts: Partial<Record<ContentClassification, number>>;
  compliancePassRate: number | null;
  totalComplianceChecks: number;
}

// ==========================================
// ZOD — ENTITIES
// ==========================================

export const WorkspacePermissionSchema = z.object({
  permissionId: z.string().uuid(),
  workspaceId: z.string().min(1),
  organizationId: z.string().uuid(),
  userId: z.string().min(1),
  role: z.enum(WorkspaceRoleValues),
  grantedBy: z.string().min(1),
  grantedAt: z.string().min(1),
  revokedAt: z.string().nullable(),
});

export const ContentGovernanceRecordSchema = z.object({
  recordId: z.string().uuid(),
  sessionId: z.string().uuid(),
  organizationId: z.string().uuid(),
  resourceRef: z.string().min(1),
  classification: z.enum(ContentClassificationValues),
  retentionDays: z.number().int().nonnegative(),
  classifiedBy: z.string().min(1),
  classifiedAt: z.string().min(1),
});

export const ComplianceCheckResultSchema = z.object({
  checkId: z.string().uuid(),
  sessionId: z.string().uuid(),
  organizationId: z.string().uuid(),
  checkType: z.string().min(1),
  passed: z.boolean(),
  details: z.string(),
  checkedAt: z.string().min(1),
});

// ==========================================
// INPUT TYPES & ZOD — CREATE PARAMS
// ==========================================

export interface GrantPermissionParams {
  workspaceId: string;
  organizationId: string;
  userId: string;
  role: WorkspaceRole;
  grantedBy: string;
}

export const GrantPermissionParamsSchema = z.object({
  workspaceId: z.string().min(1),
  organizationId: z.string().uuid(),
  userId: z.string().min(1),
  role: z.enum(WorkspaceRoleValues),
  grantedBy: z.string().min(1),
});

export interface ClassifyContentParams {
  sessionId: string;
  organizationId: string;
  resourceRef: string;
  classification: ContentClassification;
  retentionDays: number;
  classifiedBy: string;
}

export const ClassifyContentParamsSchema = z.object({
  sessionId: z.string().uuid(),
  organizationId: z.string().uuid(),
  resourceRef: z.string().min(1),
  classification: z.enum(ContentClassificationValues),
  retentionDays: z.number().int().nonnegative(),
  classifiedBy: z.string().min(1),
});
