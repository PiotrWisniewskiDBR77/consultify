export type RaciRole = 'accountable' | 'responsible' | 'consulted' | 'informed';

export type CoreNotificationChannel = 'in_app' | 'email';
export type IntegrationNotificationChannel = 'slack' | 'teams' | 'jira' | 'webhook';
export type NotificationChannel = CoreNotificationChannel | IntegrationNotificationChannel;

export type SyncProvider = 'slack' | 'teams' | 'jira' | 'webhook';

export type SyncTargetStatus = 'connected' | 'needs_auth' | 'disabled';

export interface SyncTargetRecord {
  id: string;
  provider: SyncProvider;
  organizationId: string;
  workspaceId: string;
  externalId: string;
  displayName: string;
  status: SyncTargetStatus;
  metadata?: Record<string, unknown>;
}

export interface StakeholderSyncPreferences {
  channels: NotificationChannel[];
  syncTargetIds: string[];
}

export interface RaciStakeholder {
  id: string;
  userId: string;
  role: RaciRole;
  notifications: StakeholderSyncPreferences;
}
