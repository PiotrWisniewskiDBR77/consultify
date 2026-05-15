/**
 * P02 Calendar Interoperability Canon
 * Frozen acceptance checklist + rules from FINAL_IMPLEMENTATION_PLAN_02 §2.3
 */

// §2.3.1 — Declared providers (Wave 1)
export const P02_DECLARED_PROVIDERS = {
  google: {
    read: true,
    write: true,
    bidir: true,
    notes: 'Bounded: edit authority + etag conditional writes',
  },
  microsoft: {
    read: true,
    write: true,
    bidir: true,
    notes: 'Bounded: @odata.etag + transactionId for creates',
  },
  caldav: {
    read: true,
    write: false,
    bidir: false,
    notes: 'Wave 1: read + recurrence correctness only',
  },
} as const;

// §2.3.3 — Recurrence doctrine
export const P02_RECURRENCE_DOCTRINE = {
  seriesMasterNotInstance: true,
  noInstanceExplosion: true,
  noSilentLoss: true,
  correctMapping: true,
  cancellationTruth: true,
  materializationRule: 'window_only' as const,
} as const;

// §2.3.4 — Conflict-safe writes model
export const P02_CONFLICT_WRITES_MODEL = {
  conditionalWritesRequired: true,
  conflictIsProductState: true,
  idempotentCreateWhereAvailable: true,
  noSilentOverwrite: true,
} as const;

// §2.3.5 — Permission gradients
export const P02_PERMISSION_GRADIENTS = ['free_busy', 'read', 'write', 'delegate'] as const;

export const P02_PERMISSION_UI_RULES: Record<
  string,
  { canSeeDetails: boolean; canEdit: boolean; label: string }
> = {
  free_busy: { canSeeDetails: false, canEdit: false, label: 'Free/busy blocks only — no details' },
  read: { canSeeDetails: true, canEdit: false, label: 'Details visible — editing disabled' },
  write: { canSeeDetails: true, canEdit: true, label: 'Edit allowed for owned items only' },
  delegate: {
    canSeeDetails: true,
    canEdit: true,
    label: 'Delegate — "on behalf of" context shown',
  },
};

// §2.3.6 — Provider lifecycle states
export const P02_LIFECYCLE_STATES = [
  'connected',
  'degraded',
  'requires_action',
  'blocked',
  'recoverable',
] as const;

export const P02_LIFECYCLE_TRANSITIONS: Record<string, string[]> = {
  connected: ['degraded', 'requires_action', 'blocked'],
  degraded: ['connected', 'requires_action', 'recoverable', 'blocked'],
  requires_action: ['connected', 'blocked'],
  blocked: ['requires_action'],
  recoverable: ['connected', 'degraded', 'requires_action'],
};

export const P02_RECOVERY_STEPS: Record<string, string> = {
  oauth_expired: 'requires_action → reauth → full resync (if cursor invalid) → connected',
  scope_revoked: 'requires_action with missing permissions list → re-consent → resync',
  cursor_invalid: 'recoverable → full resync in controlled window + "stale until complete"',
  rate_limited: 'degraded → backoff → retry → connected (no fake freshness)',
  permanent_auth_failure: 'blocked → operator intervention required',
};

// §2.3.7 — Anti-duplicate gate
export const P02_ANTI_DUPLICATE_RULES = [
  'No export-only pretending sync (declared write/bidir must have conditional write + conflict state + recovery)',
  'No parallel time model per provider — CalendarItem/RecurrenceModel/SyncCheckpoint are shared',
  'CalendarSource is single-writer per provider+account pair per org',
] as const;

// §2.3.8 — Error posture (8 scenarios)
export const P02_ERROR_POSTURE: Array<{
  scenario: string;
  sourceState: string | null;
  itemState: string | null;
  recovery: string;
}> = [
  {
    scenario: 'OAuth token expired',
    sourceState: 'requires_action',
    itemState: null,
    recovery: 'Reauth via provider OAuth flow',
  },
  {
    scenario: 'Consent revoked / invalid_grant',
    sourceState: 'requires_action',
    itemState: null,
    recovery: 'Re-consent with required scopes',
  },
  {
    scenario: 'Insufficient scopes / forbidden',
    sourceState: 'blocked',
    itemState: null,
    recovery: 'Operator must grant required permissions',
  },
  {
    scenario: 'Rate limit / throttling',
    sourceState: 'degraded',
    itemState: null,
    recovery: 'Automatic backoff; no fake freshness',
  },
  {
    scenario: 'Cursor invalid / deltaLink expired',
    sourceState: 'recoverable',
    itemState: null,
    recovery: 'Full resync in controlled window',
  },
  {
    scenario: 'Conditional write failed (etag mismatch)',
    sourceState: null,
    itemState: 'conflict',
    recovery: 'User resolves conflict manually',
  },
  {
    scenario: 'Series master deleted/changed',
    sourceState: null,
    itemState: 'stale',
    recovery: 'Audit note; no silent disappearance',
  },
  {
    scenario: 'Timezone / invalid recurrence rule',
    sourceState: null,
    itemState: 'blocked',
    recovery: 'Display raw + operator note',
  },
];

// §2.3.9 — Acceptance checklist (10+ points)
export const P02_ACCEPTANCE_CHECKLIST: Array<{
  id: string;
  requirement: string;
  testable: boolean;
}> = [
  {
    id: 'AC-01',
    requirement: 'Provider list closed to: Google/Microsoft/CalDAV (no "other external" bypass)',
    testable: true,
  },
  {
    id: 'AC-02',
    requirement: 'Each provider has explicit read/write/bidir declaration with bounded truth',
    testable: true,
  },
  {
    id: 'AC-03',
    requirement: 'CalendarSource has lifecycle + permissionGradient + declaredMode ≠ effectiveMode',
    testable: true,
  },
  {
    id: 'AC-04',
    requirement: 'CalendarItem stores durable external identity (provider id + UID)',
    testable: true,
  },
  {
    id: 'AC-05',
    requirement: 'Recurrence: series/instance/exception distinguished; exceptions preserved',
    testable: true,
  },
  {
    id: 'AC-06',
    requirement: 'No instance explosion: instances materialized only in query window',
    testable: true,
  },
  {
    id: 'AC-07',
    requirement: 'Conditional writes required where write declared; no unconditional overwrite',
    testable: true,
  },
  {
    id: 'AC-08',
    requirement: 'Conflict is product state (syncState=conflict) visible in UI',
    testable: true,
  },
  {
    id: 'AC-09',
    requirement: 'Permission gradients respected in UI: no fake edit at read/free_busy',
    testable: true,
  },
  {
    id: 'AC-10',
    requirement:
      'Source lifecycle visible with recovery steps (requires_action/recoverable/blocked)',
    testable: true,
  },
  {
    id: 'AC-11',
    requirement:
      'Anti-duplicate gate: no export-only pretending sync; no per-provider parallel model',
    testable: true,
  },
];

// §2.3.10 — P01 Integration Bridge
export const P02_P01_BRIDGE = {
  connectionRef: 'CalendarSource.connectionId → P01 connection.id (FK)',
  tokenLifecycle: 'Delegated to P01 pmSyncRefreshExecutionService',
  oauthFlow: 'Via integrationOAuthEngine (google_calendar, outlook_calendar)',
  caldavCredentials: 'Via P01 connection credential store (app-specific password)',
  providerCatalog: ['google_calendar', 'outlook_calendar', 'apple_calendar'],
  lifecycleAlignment:
    'P02 CalendarSource.lifecycleState maps 1:1 to P01 connection lifecycle grammar',
} as const;

// §2.3.11 — Provider Adapter Contract
export const P02_ADAPTER_REGISTRY = {
  google: 'googleCalendarAdapter.ts (full: read/write/bidir/watch)',
  microsoft: 'microsoftGraphCalendarAdapter.ts (full: read/write/bidir/subscriptions)',
  caldav: 'caldavAdapter.ts (read-only: sync-token, RRULE parse)',
} as const;

export const P02_ADAPTER_INTERFACE = [
  'listCalendars(connection): ProviderCalendarRef[]',
  'fetchEvents(connection, window, cursor?): FetchEventsResult',
  'createEvent?(connection, item, transactionId?): ProviderEvent',
  'updateEvent?(connection, item, etag): ProviderEvent | ProviderConflictError',
  'deleteEvent?(connection, eventId, etag): void | ProviderConflictError',
  'watchChanges?(connection, callbackUrl): WatchSubscription',
] as const;

// §2.3.12 — Sync Runtime Contract
export const P02_SYNC_RUNTIME = {
  cronInterval: '*/5 * * * *',
  incrementalSync: 'Uses provider cursor (syncToken / deltaLink / sync-token)',
  fullResyncFallback: 'When cursor invalid → reset checkpoint, fetch window',
  webhookRoutes: ['/api/v8/calendar/webhooks/google', '/api/v8/calendar/webhooks/microsoft'],
  rateLimitHandling: 'Backoff + degraded state + cron skip',
  recurrenceEngine: 'RRULE parser (rrule npm) + window-only materialization',
} as const;

// §2.3.13 — Frontend Contract
export const P02_FRONTEND_CONTRACT = {
  apiSurface: '/api/v8/my-work/calendar/unified (extended with P02 metadata)',
  permissionEnforcement: 'UI imports P02_PERMISSION_UI_RULES; free_busy_only → no details',
  lifecycleDisplay: 'CalendarSidebar per-source lifecycle badge with recovery guidance',
  editAffordanceGating: 'editAuthority=none → disabled controls; effectiveMode=read → no edit',
  conflictSurface: 'syncState=conflict → badge + resolve action',
} as const;

// Extended itemType (PMO completeness per §2.3.2 + SSOT alignment)
export const P02_ITEM_TYPES = [
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

// §2.3.9 — Extended acceptance checklist (15 points for full delivery)
export const P02_ACCEPTANCE_CHECKLIST_EXTENDED: Array<{
  id: string;
  requirement: string;
  testable: boolean;
}> = [
  ...P02_ACCEPTANCE_CHECKLIST,
  {
    id: 'AC-12',
    requirement:
      'P01 bridge: CalendarSource.connectionId references P01 connection; token refresh delegated',
    testable: true,
  },
  {
    id: 'AC-13',
    requirement:
      'Provider adapters: Google/Microsoft/CalDAV implement CalendarProviderAdapter interface',
    testable: true,
  },
  {
    id: 'AC-14',
    requirement:
      'Sync runtime: cron job syncs connected/degraded sources every 5min; webhooks trigger immediate sync',
    testable: true,
  },
  {
    id: 'AC-15',
    requirement:
      'Frontend: permission gradients enforced; lifecycle states displayed; conflicts surfaced',
    testable: true,
  },
];

// Ownership boundary
export const P02_OWNERSHIP = {
  owner: 'Calendar Interop Service (calendarInteropService.ts)',
  consumers: ['My Work Calendar UI', 'Execution Calendar', 'Settings Calendar Sync'],
  externalDependencies: ['Google Calendar API', 'Microsoft Graph API', 'CalDAV providers'],
  adapters: ['googleCalendarAdapter.ts', 'microsoftGraphCalendarAdapter.ts', 'caldavAdapter.ts'],
  runtime: ['calendarSyncRuntime.ts', 'recurrenceEngine.ts'],
  webhooks: ['calendarWebhook.routes.ts'],
} as const;
