export const INVITATION_EXPIRY_DAYS = 7;
export const TOKEN_LENGTH_BYTES = 32; // 64 hex characters
export const INVITATION_TOKEN_HEX_LENGTH = TOKEN_LENGTH_BYTES * 2;
export const MAX_RESEND_COUNT = 3;
export const RESEND_COOLDOWN_MINUTES = 5;

export const INVITATION_TYPES = {
  ORG: 'ORG',
  PROJECT: 'PROJECT',
} as const;

export const INVITATION_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
} as const;

export const INVITATION_EVENT_TYPES = {
  CREATED: 'created',
  SENT: 'sent',
  DELIVERY_FAILED: 'delivery_failed',
  RESENT: 'resent',
  ACCEPTED: 'accepted',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
} as const;

export type InvitationType = (typeof INVITATION_TYPES)[keyof typeof INVITATION_TYPES];
export type InvitationStatus = (typeof INVITATION_STATUS)[keyof typeof INVITATION_STATUS];
export type InvitationEventType =
  (typeof INVITATION_EVENT_TYPES)[keyof typeof INVITATION_EVENT_TYPES];

export interface RequestInfo {
  ipAddress?: string;
  userAgent?: string;
}

export interface CreateOrgInvitationParams {
  organizationId: string;
  email: string;
  role?: string;
  invitedByUserId: string;
  metadata?: Record<string, unknown>;
}

export interface CreateProjectInvitationParams {
  organizationId: string;
  projectId: string;
  email: string;
  projectRole?: string;
  orgRole?: string;
  invitedByUserId: string;
  metadata?: Record<string, unknown>;
}

export interface AcceptInvitationParams {
  token: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  jobTitle?: string;
  siteLocation?: string;
  department?: string;
}

export interface InvitationRecord {
  id: string;
  organization_id: string;
  project_id?: string | null;
  email: string;
  role: string;
  role_to_assign?: string | null;
  token?: string | null;
  token_hash: string;
  status: InvitationStatus | string;
  invited_by?: string | null;
  expires_at: string;
  invitation_type: InvitationType | string;
  metadata?: string | null;
  accepted_at?: string | null;
  accepted_by_user_id?: string | null;
  resend_count?: number | null;
  last_resent_at?: string | null;
  created_at?: string;
  organization_name?: string;
  project_name?: string;
}

export interface InvitationEventRecord {
  id: string;
  invitation_id: string;
  event_type: InvitationEventType | string;
  performed_by_user_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  metadata?: string | null;
  created_at?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

export interface InvitePermissionResult {
  allowed: boolean;
  reasonCode?: string;
  reason?: string;
  seatsRemaining?: number;
  maxSeats?: number;
  currentSeats?: number;
}

export interface ListInvitationsOptions {
  status?: InvitationStatus | string;
  invitationType?: InvitationType | string;
  limit?: number;
  offset?: number;
}
