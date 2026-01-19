/**
 * Database Row Types
 *
 * Common type definitions for database query results.
 * Import these types when working with SQLite database rows.
 */

// ============================================================
// Base Types
// ============================================================

export interface BaseRow {
  id: string;
  created_at?: string;
  updated_at?: string;
}

// ============================================================
// User & Organization
// ============================================================

export interface UserRow extends BaseRow {
  organization_id: string;
  email: string;
  password?: string;
  role: 'SUPERADMIN' | 'ADMIN' | 'USER';
  status: 'active' | 'pending' | 'blocked';
  first_name?: string;
  last_name?: string;
  last_login?: string;
}

export interface OrganizationRow extends BaseRow {
  name: string;
  plan: 'free' | 'pro' | 'enterprise';
  status: 'pending' | 'active' | 'blocked' | 'suspended';
  settings?: string;
  max_users?: number;
  max_projects?: number;
}

// ============================================================
// Projects & Tasks
// ============================================================

export interface ProjectRow extends BaseRow {
  organization_id: string;
  name: string;
  description?: string;
  status: string;
  created_by?: string;
}

export interface TaskRow extends BaseRow {
  project_id: string;
  organization_id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assignee_id?: string;
  due_date?: string;
}

// ============================================================
// AI Actions
// ============================================================

export interface ActionProposalRow extends BaseRow {
  organization_id: string;
  correlation_id: string;
  action_type: string;
  scope: string;
  context_snapshot: string | null;
  reasoning: string | null;
  confidence: number;
  risk_level: string;
  status: string;
  expires_at?: string;
  signal_type?: string;
  simulation?: string;
}

export interface ActionDecisionRow extends BaseRow {
  proposal_id: string;
  organization_id: string;
  correlation_id: string;
  action_type: string;
  scope: string;
  decision: 'APPROVED' | 'REJECTED' | 'MODIFIED';
  decided_by_user_id: string;
  decision_reason: string | null;
  proposal_snapshot: string | null;
  modified_payload: string | null;
  policy_rule_id: string | null;
  user_email?: string;
  first_name?: string;
  last_name?: string;
}

export interface ActionExecutionRow extends BaseRow {
  decision_id: string;
  organization_id: string;
  correlation_id: string;
  action_type: string;
  execution_status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';
  result_snapshot: string | null;
  error_details: string | null;
  started_at?: string;
  completed_at?: string;
}

// ============================================================
// Audit & Logging
// ============================================================

export interface AuditLogRow extends BaseRow {
  organization_id: string;
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: string;
  ip_address?: string;
}

// ============================================================
// Signals & Recommendations
// ============================================================

export interface SignalRow extends BaseRow {
  organization_id: string;
  type: string;
  source: string;
  data: string | null;
  priority: number;
  processed: boolean;
}

export interface RecommendationRow extends BaseRow {
  organization_id: string;
  signal_id?: string;
  type: string;
  title: string;
  description: string;
  priority: number;
  status: string;
  payload: string | null;
}

// ============================================================
// Sessions & Tokens
// ============================================================

export interface RefreshTokenRow extends BaseRow {
  user_id: string;
  token: string;
  device_info?: string;
  expires_at: string;
}

export interface RevokedTokenRow {
  jti: string;
  user_id?: string;
  expires_at?: string;
  reason?: string;
}

// ============================================================
// Policy & Rules
// ============================================================

export interface PolicyRuleRow extends BaseRow {
  organization_id: string;
  name: string;
  action_type: string;
  conditions: string;
  decision: 'APPROVED' | 'REJECTED';
  priority: number;
  enabled: boolean;
}

// ============================================================
// Jobs & Queue
// ============================================================

export interface AsyncJobRow extends BaseRow {
  organization_id: string;
  job_type: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  payload: string | null;
  result: string | null;
  error: string | null;
  started_at?: string;
  completed_at?: string;
}

// ============================================================
// Generic Record Type for unknown structures
// ============================================================

export type DatabaseRecord = Record<string, unknown>;

// ============================================================
// Helper type for parsing JSON fields
// ============================================================

export function parseJsonField<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
