import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import type {
  AddSupportNoteParams,
  InitiateEmergencyPauseParams,
  InstallPackageForTenantParams,
  RecordFleetHealthParams,
  RegisterPackageParams,
} from '../../../types/operatorAdminSurfaces.js';
import {
  AddSupportNoteParamsSchema,
  ConnectorAuthStateValues,
  ConnectorFleetHealthEntrySchema,
  ConnectorPackageSchema,
  DriftStateValues,
  EmergencyPauseSchema,
  EmergencyPauseScopeValues,
  FLEET_HEALTH_SIGNAL_THRESHOLDS,
  FleetHealthSignalSchema,
  FleetHealthSignalTypeValues,
  InitiateEmergencyPauseParamsSchema,
  InstallPackageForTenantParamsSchema,
  PackageCapabilityValues,
  PackageLifecycleStateValues,
  ProviderTierValues,
  RecordFleetHealthParamsSchema,
  RegisterPackageParamsSchema,
  SupportNoteAuthorRoleValues,
  SupportNoteSchema,
  TenantConnectorInstallationSchema,
} from '../../../types/operatorAdminSurfaces.js';

// ==========================================
// MOCK DB LAYER
// ==========================================

const mockDbRun = vi.fn().mockResolvedValue({ success: true });
const mockDbGet = vi.fn().mockResolvedValue(null);
const mockDbAll = vi.fn().mockResolvedValue([]);

vi.mock('../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  addSupportNote,
  checkFleetHealthSignals,
  getActiveEmergencyPauses,
  getConnectorHealth,
  getFleetHealth,
  getPackage,
  getSupportNotes,
  getTenantInstallations,
  initiateEmergencyPause,
  installPackageForTenant,
  recordFleetHealth,
  registerPackage,
  resumeFromEmergencyPause,
} from '../operatorAdminService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const ORG_ID_2 = '00000000-0000-4000-8000-000000000099';
const CONNECTOR_ID = 'jira-connector-1';
const CONNECTOR_ID_2 = 'asana-connector-1';
const USER_ID = 'user-admin-1';
const PACKAGE_ID = '00000000-0000-4000-8000-000000000020';
const INCIDENT_REF = 'INC-2026-001';

function makeFleetHealthParams(
  overrides?: Partial<RecordFleetHealthParams>
): RecordFleetHealthParams {
  return {
    connectorId: CONNECTOR_ID,
    organizationId: ORG_ID,
    providerKey: 'jira',
    authState: 'healthy',
    providerTier: 'A',
    lastSyncSuccess: '2026-03-23T10:00:00.000Z',
    lastSyncFailure: null,
    stalenessIndicator: 0,
    driftState: 'none',
    deadLetterCount: 0,
    conflictCount: 0,
    ...overrides,
  };
}

function makeFleetHealthRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    entry_id: '00000000-0000-4000-8000-aaaaaaaaaaaa',
    connector_id: CONNECTOR_ID,
    organization_id: ORG_ID,
    provider_key: 'jira',
    auth_state: 'healthy',
    provider_tier: 'A',
    last_sync_success: '2026-03-23T10:00:00.000Z',
    last_sync_failure: null,
    staleness_indicator: 0,
    drift_state: 'none',
    dead_letter_count: 0,
    conflict_count: 0,
    created_at: '2026-03-23T10:00:00.000Z',
    updated_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makePackageParams(overrides?: Partial<RegisterPackageParams>): RegisterPackageParams {
  return {
    providerKey: 'jira',
    packageVersion: '1.0.0',
    capabilities: ['import', 'publish', 'bidirectional'],
    lifecycleState: 'published',
    tenantInstallable: true,
    ...overrides,
  };
}

function makePackageRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    package_id: PACKAGE_ID,
    provider_key: 'jira',
    package_version: '1.0.0',
    capabilities: JSON.stringify(['import', 'publish', 'bidirectional']),
    lifecycle_state: 'published',
    tenant_installable: 1,
    created_at: '2026-03-23T10:00:00.000Z',
    updated_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeInstallParams(
  overrides?: Partial<InstallPackageForTenantParams>
): InstallPackageForTenantParams {
  return {
    packageId: PACKAGE_ID,
    organizationId: ORG_ID,
    enabledBy: USER_ID,
    configurationScope: 'full',
    ...overrides,
  };
}

function makeInstallationRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    installation_id: '00000000-0000-4000-8000-dddddddddddd',
    package_id: PACKAGE_ID,
    organization_id: ORG_ID,
    enabled_by: USER_ID,
    configuration_scope: 'full',
    installed_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeSupportNoteParams(overrides?: Partial<AddSupportNoteParams>): AddSupportNoteParams {
  return {
    incidentRef: INCIDENT_REF,
    connectorId: CONNECTOR_ID,
    organizationId: ORG_ID,
    authorId: USER_ID,
    authorRole: 'support',
    content: 'Investigated auth failure — token expired, reauth initiated.',
    ...overrides,
  };
}

function makeSupportNoteRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    note_id: '00000000-0000-4000-8000-eeeeeeeeeeee',
    incident_ref: INCIDENT_REF,
    connector_id: CONNECTOR_ID,
    organization_id: ORG_ID,
    author_id: USER_ID,
    author_role: 'support',
    content: 'Investigated auth failure — token expired, reauth initiated.',
    created_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makePauseParams(
  overrides?: Partial<InitiateEmergencyPauseParams>
): InitiateEmergencyPauseParams {
  return {
    organizationId: ORG_ID,
    pauseScope: 'all_connectors',
    providerKey: null,
    pausedBy: USER_ID,
    reason: 'Critical provider outage affecting all connectors',
    blastRadius: 5,
    ...overrides,
  };
}

function makePauseRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    pause_id: '00000000-0000-4000-8000-ffffffffffff',
    organization_id: ORG_ID,
    pause_scope: 'all_connectors',
    provider_key: null,
    paused_by: USER_ID,
    reason: 'Critical provider outage affecting all connectors',
    blast_radius: 5,
    paused_at: '2026-03-23T10:00:00.000Z',
    resumed_at: null,
    resumed_by: null,
    ...overrides,
  };
}

// ==========================================
// TESTS
// ==========================================

beforeEach(() => {
  vi.clearAllMocks();
});

// ------------------------------------------
// FLEET HEALTH CRUD
// ------------------------------------------

describe('recordFleetHealth', () => {
  it('creates a new fleet health entry', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await recordFleetHealth(makeFleetHealthParams());

    expect(result.connectorId).toBe(CONNECTOR_ID);
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.providerKey).toBe('jira');
    expect(result.authState).toBe('healthy');
    expect(result.providerTier).toBe('A');
    expect(result.stalenessIndicator).toBe(0);
    expect(result.driftState).toBe('none');
    expect(result.deadLetterCount).toBe(0);
    expect(result.conflictCount).toBe(0);
    expect(result.entryId).toBeDefined();
    expect(mockDbRun).toHaveBeenCalledOnce();
  });

  it('updates an existing fleet health entry', async () => {
    mockDbGet.mockResolvedValueOnce(makeFleetHealthRow());

    const result = await recordFleetHealth(
      makeFleetHealthParams({ authState: 'degraded_reauth_needed', deadLetterCount: 3 })
    );

    expect(result.authState).toBe('degraded_reauth_needed');
    expect(result.deadLetterCount).toBe(3);
    expect(result.entryId).toBe('00000000-0000-4000-8000-aaaaaaaaaaaa');
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('UPDATE');
  });

  it('preserves existing lastSyncSuccess when not provided in update', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeFleetHealthRow({ last_sync_success: '2026-03-23T09:00:00.000Z' })
    );

    const result = await recordFleetHealth(makeFleetHealthParams({ lastSyncSuccess: undefined }));

    expect(result.lastSyncSuccess).toBe('2026-03-23T09:00:00.000Z');
  });

  it('supports all 8 auth states', () => {
    for (const authState of ConnectorAuthStateValues) {
      expect(() =>
        RecordFleetHealthParamsSchema.parse(makeFleetHealthParams({ authState }))
      ).not.toThrow();
    }
  });

  it('supports all 4 provider tiers', () => {
    for (const providerTier of ProviderTierValues) {
      expect(() =>
        RecordFleetHealthParamsSchema.parse(makeFleetHealthParams({ providerTier }))
      ).not.toThrow();
    }
  });

  it('supports all 5 drift states', () => {
    for (const driftState of DriftStateValues) {
      expect(() =>
        RecordFleetHealthParamsSchema.parse(makeFleetHealthParams({ driftState }))
      ).not.toThrow();
    }
  });

  it('rejects negative deadLetterCount via Zod', () => {
    expect(() =>
      RecordFleetHealthParamsSchema.parse(makeFleetHealthParams({ deadLetterCount: -1 }))
    ).toThrow(ZodError);
  });

  it('rejects negative stalenessIndicator via Zod', () => {
    expect(() =>
      RecordFleetHealthParamsSchema.parse(makeFleetHealthParams({ stalenessIndicator: -1 }))
    ).toThrow(ZodError);
  });

  it('rejects invalid auth state via Zod', () => {
    expect(() =>
      RecordFleetHealthParamsSchema.parse(makeFleetHealthParams({ authState: 'invalid' as any }))
    ).toThrow(ZodError);
  });

  it('rejects empty connectorId via Zod', () => {
    expect(() =>
      RecordFleetHealthParamsSchema.parse(makeFleetHealthParams({ connectorId: '' }))
    ).toThrow(ZodError);
  });
});

describe('getFleetHealth', () => {
  it('returns all fleet health entries for an org', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFleetHealthRow(),
      makeFleetHealthRow({
        entry_id: 'entry-2',
        connector_id: CONNECTOR_ID_2,
        provider_key: 'asana',
        auth_state: 'degraded_reauth_needed',
      }),
    ]);

    const results = await getFleetHealth(ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].authState).toBe('healthy');
    expect(results[1].authState).toBe('degraded_reauth_needed');
  });

  it('returns empty array when no entries exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getFleetHealth(ORG_ID);
    expect(results).toEqual([]);
  });
});

describe('getConnectorHealth', () => {
  it('returns health for a specific connector', async () => {
    mockDbGet.mockResolvedValueOnce(makeFleetHealthRow());

    const result = await getConnectorHealth(CONNECTOR_ID, ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.connectorId).toBe(CONNECTOR_ID);
    expect(result!.organizationId).toBe(ORG_ID);
  });

  it('returns null when connector not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await getConnectorHealth('nonexistent', ORG_ID);
    expect(result).toBeNull();
  });

  it('queries with organization_id for isolation', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await getConnectorHealth(CONNECTOR_ID, ORG_ID);

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    expect(mockDbGet.mock.calls[0][1]).toContain(ORG_ID);
  });
});

// ------------------------------------------
// CONNECTOR PACKAGE LIFECYCLE (Decision W5-9)
// ------------------------------------------

describe('registerPackage', () => {
  it('creates a new connector package', async () => {
    const result = await registerPackage(makePackageParams());

    expect(result.providerKey).toBe('jira');
    expect(result.packageVersion).toBe('1.0.0');
    expect(result.capabilities).toEqual(['import', 'publish', 'bidirectional']);
    expect(result.lifecycleState).toBe('published');
    expect(result.tenantInstallable).toBe(true);
    expect(result.packageId).toBeDefined();
    expect(mockDbRun).toHaveBeenCalledOnce();
  });

  it('supports all 4 lifecycle states', () => {
    for (const lifecycleState of PackageLifecycleStateValues) {
      expect(() =>
        RegisterPackageParamsSchema.parse(makePackageParams({ lifecycleState }))
      ).not.toThrow();
    }
  });

  it('supports all 8 capability values', () => {
    for (const cap of PackageCapabilityValues) {
      expect(() =>
        RegisterPackageParamsSchema.parse(makePackageParams({ capabilities: [cap] }))
      ).not.toThrow();
    }
  });

  it('rejects empty capabilities array via Zod', () => {
    expect(() =>
      RegisterPackageParamsSchema.parse(makePackageParams({ capabilities: [] }))
    ).toThrow(ZodError);
  });

  it('rejects invalid capability via Zod', () => {
    expect(() =>
      RegisterPackageParamsSchema.parse(makePackageParams({ capabilities: ['invalid' as any] }))
    ).toThrow(ZodError);
  });

  it('serializes capabilities as JSON', async () => {
    await registerPackage(makePackageParams());

    const insertArgs = mockDbRun.mock.calls[0][1] as unknown[];
    const capabilitiesArg = insertArgs[3] as string;
    expect(JSON.parse(capabilitiesArg)).toEqual(['import', 'publish', 'bidirectional']);
  });

  it('stores tenantInstallable as integer 1/0', async () => {
    await registerPackage(makePackageParams({ tenantInstallable: false }));

    const insertArgs = mockDbRun.mock.calls[0][1] as unknown[];
    expect(insertArgs[5]).toBe(0);
  });
});

describe('getPackage', () => {
  it('returns a package with parsed capabilities', async () => {
    mockDbGet.mockResolvedValueOnce(makePackageRow());

    const result = await getPackage(PACKAGE_ID);

    expect(result).not.toBeNull();
    expect(result!.packageId).toBe(PACKAGE_ID);
    expect(result!.capabilities).toEqual(['import', 'publish', 'bidirectional']);
    expect(result!.tenantInstallable).toBe(true);
  });

  it('returns null when package not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await getPackage('nonexistent');
    expect(result).toBeNull();
  });

  it('handles malformed capabilities JSON gracefully', async () => {
    mockDbGet.mockResolvedValueOnce(makePackageRow({ capabilities: 'not-json' }));

    const result = await getPackage(PACKAGE_ID);
    expect(result).not.toBeNull();
    expect(result!.capabilities).toEqual([]);
  });
});

// ------------------------------------------
// TENANT INSTALLATION
// ------------------------------------------

describe('installPackageForTenant', () => {
  it('installs a published, installable package', async () => {
    mockDbGet.mockResolvedValueOnce(makePackageRow());

    const result = await installPackageForTenant(makeInstallParams());

    expect(result.packageId).toBe(PACKAGE_ID);
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.enabledBy).toBe(USER_ID);
    expect(result.configurationScope).toBe('full');
    expect(result.installationId).toBeDefined();
    expect(mockDbRun).toHaveBeenCalledOnce();
  });

  it('throws when package not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(installPackageForTenant(makeInstallParams())).rejects.toThrow('not found');
  });

  it('throws when package is not tenant-installable', async () => {
    mockDbGet.mockResolvedValueOnce(makePackageRow({ tenant_installable: 0 }));

    await expect(installPackageForTenant(makeInstallParams())).rejects.toThrow(
      'not tenant-installable'
    );
  });

  it('throws when package is retired', async () => {
    mockDbGet.mockResolvedValueOnce(makePackageRow({ lifecycle_state: 'retired' }));

    await expect(installPackageForTenant(makeInstallParams())).rejects.toThrow('retired');
  });

  it('allows installation of deprecated package with warning', async () => {
    mockDbGet.mockResolvedValueOnce(makePackageRow({ lifecycle_state: 'deprecated' }));

    const result = await installPackageForTenant(makeInstallParams());
    expect(result.installationId).toBeDefined();
  });

  it('rejects invalid packageId via Zod', () => {
    expect(() =>
      InstallPackageForTenantParamsSchema.parse(makeInstallParams({ packageId: 'not-uuid' }))
    ).toThrow(ZodError);
  });

  it('rejects empty enabledBy via Zod', () => {
    expect(() =>
      InstallPackageForTenantParamsSchema.parse(makeInstallParams({ enabledBy: '' }))
    ).toThrow(ZodError);
  });
});

describe('getTenantInstallations', () => {
  it('returns all installations for an org', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeInstallationRow(),
      makeInstallationRow({
        installation_id: 'install-2',
        package_id: '00000000-0000-4000-8000-000000000021',
      }),
    ]);

    const results = await getTenantInstallations(ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].organizationId).toBe(ORG_ID);
  });

  it('returns empty array when no installations exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getTenantInstallations(ORG_ID);
    expect(results).toEqual([]);
  });

  it('queries with organization_id for isolation', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getTenantInstallations(ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    expect(mockDbAll.mock.calls[0][1]).toContain(ORG_ID);
  });
});

// ------------------------------------------
// SUPPORT NOTES (Decision W5-10)
// ------------------------------------------

describe('addSupportNote', () => {
  it('creates a durable, incident-scoped support note', async () => {
    const result = await addSupportNote(makeSupportNoteParams());

    expect(result.incidentRef).toBe(INCIDENT_REF);
    expect(result.connectorId).toBe(CONNECTOR_ID);
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.authorId).toBe(USER_ID);
    expect(result.authorRole).toBe('support');
    expect(result.content).toContain('auth failure');
    expect(result.noteId).toBeDefined();
    expect(mockDbRun).toHaveBeenCalledOnce();
  });

  it('supports support author role', async () => {
    const result = await addSupportNote(makeSupportNoteParams({ authorRole: 'support' }));
    expect(result.authorRole).toBe('support');
  });

  it('supports operator author role', async () => {
    const result = await addSupportNote(makeSupportNoteParams({ authorRole: 'operator' }));
    expect(result.authorRole).toBe('operator');
  });

  it('rejects empty content via Zod', () => {
    expect(() => AddSupportNoteParamsSchema.parse(makeSupportNoteParams({ content: '' }))).toThrow(
      ZodError
    );
  });

  it('rejects empty incidentRef via Zod', () => {
    expect(() =>
      AddSupportNoteParamsSchema.parse(makeSupportNoteParams({ incidentRef: '' }))
    ).toThrow(ZodError);
  });

  it('rejects invalid authorRole via Zod', () => {
    expect(() =>
      AddSupportNoteParamsSchema.parse(makeSupportNoteParams({ authorRole: 'admin' as any }))
    ).toThrow(ZodError);
  });
});

describe('getSupportNotes', () => {
  it('returns all support notes for a connector', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeSupportNoteRow(),
      makeSupportNoteRow({
        note_id: 'note-2',
        content: 'Follow-up: reauth completed successfully.',
        author_role: 'operator',
      }),
    ]);

    const results = await getSupportNotes(CONNECTOR_ID, ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].authorRole).toBe('support');
    expect(results[1].authorRole).toBe('operator');
  });

  it('returns empty array when no notes exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getSupportNotes(CONNECTOR_ID, ORG_ID);
    expect(results).toEqual([]);
  });

  it('queries with both connectorId and organization_id', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getSupportNotes(CONNECTOR_ID, ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('connector_id');
    expect(query).toContain('organization_id');
    expect(mockDbAll.mock.calls[0][1]).toContain(CONNECTOR_ID);
    expect(mockDbAll.mock.calls[0][1]).toContain(ORG_ID);
  });
});

// ------------------------------------------
// EMERGENCY PAUSE (Decision W5-11)
// ------------------------------------------

describe('initiateEmergencyPause', () => {
  it('creates an all_connectors emergency pause', async () => {
    const result = await initiateEmergencyPause(makePauseParams());

    expect(result.organizationId).toBe(ORG_ID);
    expect(result.pauseScope).toBe('all_connectors');
    expect(result.providerKey).toBeNull();
    expect(result.pausedBy).toBe(USER_ID);
    expect(result.reason).toContain('Critical provider outage');
    expect(result.blastRadius).toBe(5);
    expect(result.resumedAt).toBeNull();
    expect(result.resumedBy).toBeNull();
    expect(result.pauseId).toBeDefined();
    expect(mockDbRun).toHaveBeenCalledOnce();
  });

  it('creates a provider_type scoped pause with providerKey', async () => {
    const result = await initiateEmergencyPause(
      makePauseParams({ pauseScope: 'provider_type', providerKey: 'jira' })
    );

    expect(result.pauseScope).toBe('provider_type');
    expect(result.providerKey).toBe('jira');
  });

  it('throws when provider_type scope lacks providerKey', async () => {
    await expect(
      initiateEmergencyPause(makePauseParams({ pauseScope: 'provider_type', providerKey: null }))
    ).rejects.toThrow('providerKey is required');
  });

  it('supports both pause scope values', () => {
    for (const pauseScope of EmergencyPauseScopeValues) {
      expect(() =>
        InitiateEmergencyPauseParamsSchema.parse(
          makePauseParams({
            pauseScope,
            providerKey: pauseScope === 'provider_type' ? 'jira' : null,
          })
        )
      ).not.toThrow();
    }
  });

  it('rejects empty reason via Zod', () => {
    expect(() => InitiateEmergencyPauseParamsSchema.parse(makePauseParams({ reason: '' }))).toThrow(
      ZodError
    );
  });

  it('rejects negative blastRadius via Zod', () => {
    expect(() =>
      InitiateEmergencyPauseParamsSchema.parse(makePauseParams({ blastRadius: -1 }))
    ).toThrow(ZodError);
  });

  it('records blast radius for visibility', async () => {
    const result = await initiateEmergencyPause(makePauseParams({ blastRadius: 12 }));
    expect(result.blastRadius).toBe(12);
  });
});

describe('resumeFromEmergencyPause', () => {
  it('resumes an active pause', async () => {
    mockDbGet.mockResolvedValueOnce(makePauseRow());

    const result = await resumeFromEmergencyPause('00000000-0000-4000-8000-ffffffffffff', USER_ID);

    expect(result.resumedAt).toBeDefined();
    expect(result.resumedBy).toBe(USER_ID);
    expect(result.pauseId).toBe('00000000-0000-4000-8000-ffffffffffff');
    expect(mockDbRun).toHaveBeenCalledOnce();
  });

  it('throws when pause not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(resumeFromEmergencyPause('nonexistent', USER_ID)).rejects.toThrow('not found');
  });

  it('throws when pause already resumed', async () => {
    mockDbGet.mockResolvedValueOnce(
      makePauseRow({ resumed_at: '2026-03-23T12:00:00.000Z', resumed_by: 'someone' })
    );

    await expect(
      resumeFromEmergencyPause('00000000-0000-4000-8000-ffffffffffff', USER_ID)
    ).rejects.toThrow('already resumed');
  });

  it('preserves original pause data after resume', async () => {
    mockDbGet.mockResolvedValueOnce(makePauseRow());

    const result = await resumeFromEmergencyPause('00000000-0000-4000-8000-ffffffffffff', USER_ID);

    expect(result.pauseScope).toBe('all_connectors');
    expect(result.reason).toContain('Critical provider outage');
    expect(result.blastRadius).toBe(5);
    expect(result.pausedBy).toBe(USER_ID);
  });
});

describe('getActiveEmergencyPauses', () => {
  it('returns only active (non-resumed) pauses', async () => {
    mockDbAll.mockResolvedValueOnce([
      makePauseRow(),
      makePauseRow({
        pause_id: 'pause-2',
        pause_scope: 'provider_type',
        provider_key: 'asana',
        blast_radius: 2,
      }),
    ]);

    const results = await getActiveEmergencyPauses(ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].resumedAt).toBeNull();
    expect(results[1].pauseScope).toBe('provider_type');
  });

  it('returns empty array when no active pauses', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getActiveEmergencyPauses(ORG_ID);
    expect(results).toEqual([]);
  });

  it('queries with resumed_at IS NULL filter', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getActiveEmergencyPauses(ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('resumed_at IS NULL');
  });

  it('queries with organization_id for isolation', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getActiveEmergencyPauses(ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    expect(mockDbAll.mock.calls[0][1]).toContain(ORG_ID);
  });
});

// ------------------------------------------
// FLEET HEALTH SIGNALS
// ------------------------------------------

describe('checkFleetHealthSignals', () => {
  it('returns all 7 signal types', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    const signals = await checkFleetHealthSignals(ORG_ID);

    expect(signals).toHaveLength(7);
    const types = signals.map((s) => s.signalType);
    for (const t of FleetHealthSignalTypeValues) {
      expect(types).toContain(t);
    }
  });

  it('reports no breaches when fleet is healthy', async () => {
    mockDbAll.mockResolvedValueOnce([makeFleetHealthRow()]);

    const signals = await checkFleetHealthSignals(ORG_ID);

    const breached = signals.filter((s) => s.breached);
    expect(breached).toHaveLength(0);
  });

  it('detects degraded_auth_count breach', async () => {
    mockDbAll.mockResolvedValueOnce([makeFleetHealthRow({ auth_state: 'degraded_reauth_needed' })]);

    const signals = await checkFleetHealthSignals(ORG_ID);

    const authSignal = signals.find((s) => s.signalType === 'degraded_auth_count');
    expect(authSignal).toBeDefined();
    expect(authSignal!.breached).toBe(true);
    expect(authSignal!.currentValue).toBe(1);
  });

  it('detects dead_letter_depth breach', async () => {
    mockDbAll.mockResolvedValueOnce([makeFleetHealthRow({ dead_letter_count: 5 })]);

    const signals = await checkFleetHealthSignals(ORG_ID);

    const dlSignal = signals.find((s) => s.signalType === 'dead_letter_depth');
    expect(dlSignal).toBeDefined();
    expect(dlSignal!.breached).toBe(true);
    expect(dlSignal!.currentValue).toBe(5);
  });

  it('detects conflict_depth breach when > 10', async () => {
    mockDbAll.mockResolvedValueOnce([makeFleetHealthRow({ conflict_count: 11 })]);

    const signals = await checkFleetHealthSignals(ORG_ID);

    const conflictSignal = signals.find((s) => s.signalType === 'conflict_depth');
    expect(conflictSignal).toBeDefined();
    expect(conflictSignal!.breached).toBe(true);
  });

  it('does not breach conflict_depth when exactly at threshold minus 1', async () => {
    mockDbAll.mockResolvedValueOnce([makeFleetHealthRow({ conflict_count: 9 })]);

    const signals = await checkFleetHealthSignals(ORG_ID);

    const conflictSignal = signals.find((s) => s.signalType === 'conflict_depth');
    expect(conflictSignal!.breached).toBe(false);
  });

  it('detects staleness_breach_rate when stale entries exceed 15%', async () => {
    const rows = [];
    for (let i = 0; i < 10; i++) {
      rows.push(
        makeFleetHealthRow({
          entry_id: `entry-${i}`,
          connector_id: `conn-${i}`,
          staleness_indicator: i < 2 ? 5 : 0,
        })
      );
    }
    mockDbAll.mockResolvedValueOnce(rows);

    const signals = await checkFleetHealthSignals(ORG_ID);

    const stalenessSignal = signals.find((s) => s.signalType === 'staleness_breach_rate');
    expect(stalenessSignal).toBeDefined();
    expect(stalenessSignal!.currentValue).toBe(20);
    expect(stalenessSignal!.breached).toBe(true);
  });

  it('handles empty fleet gracefully (no breaches)', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    const signals = await checkFleetHealthSignals(ORG_ID);

    const breached = signals.filter((s) => s.breached);
    expect(breached).toHaveLength(0);
  });

  it('aggregates dead letter counts across connectors', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFleetHealthRow({ entry_id: 'e1', connector_id: 'c1', dead_letter_count: 3 }),
      makeFleetHealthRow({ entry_id: 'e2', connector_id: 'c2', dead_letter_count: 4 }),
    ]);

    const signals = await checkFleetHealthSignals(ORG_ID);

    const dlSignal = signals.find((s) => s.signalType === 'dead_letter_depth');
    expect(dlSignal!.currentValue).toBe(7);
  });

  it('counts both degraded_reauth_needed and degraded_scope_limited', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFleetHealthRow({
        entry_id: 'e1',
        connector_id: 'c1',
        auth_state: 'degraded_reauth_needed',
      }),
      makeFleetHealthRow({
        entry_id: 'e2',
        connector_id: 'c2',
        auth_state: 'degraded_scope_limited',
      }),
      makeFleetHealthRow({ entry_id: 'e3', connector_id: 'c3', auth_state: 'healthy' }),
    ]);

    const signals = await checkFleetHealthSignals(ORG_ID);

    const authSignal = signals.find((s) => s.signalType === 'degraded_auth_count');
    expect(authSignal!.currentValue).toBe(2);
    expect(authSignal!.breached).toBe(true);
  });
});

// ------------------------------------------
// ORG ISOLATION
// ------------------------------------------

describe('org isolation', () => {
  it('fleet health queries include organization_id', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getFleetHealth(ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    expect(mockDbAll.mock.calls[0][1]).toContain(ORG_ID);
  });

  it('connector health queries include organization_id', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await getConnectorHealth(CONNECTOR_ID, ORG_ID);

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    expect(mockDbGet.mock.calls[0][1]).toContain(ORG_ID);
  });

  it('support notes queries include organization_id', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getSupportNotes(CONNECTOR_ID, ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    expect(mockDbAll.mock.calls[0][1]).toContain(ORG_ID);
  });

  it('emergency pause queries include organization_id', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getActiveEmergencyPauses(ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    expect(mockDbAll.mock.calls[0][1]).toContain(ORG_ID);
  });

  it('tenant installations queries include organization_id', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getTenantInstallations(ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    expect(mockDbAll.mock.calls[0][1]).toContain(ORG_ID);
  });

  it('fleet health signal check is org-scoped', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await checkFleetHealthSignals(ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    expect(mockDbAll.mock.calls[0][1]).toContain(ORG_ID);
  });
});

// ------------------------------------------
// ZOD SCHEMA VALIDATION
// ------------------------------------------

describe('Zod schema validation', () => {
  it('validates ConnectorFleetHealthEntry', () => {
    expect(() =>
      ConnectorFleetHealthEntrySchema.parse({
        entryId: '00000000-0000-4000-8000-aaaaaaaaaaaa',
        connectorId: CONNECTOR_ID,
        organizationId: ORG_ID,
        providerKey: 'jira',
        authState: 'healthy',
        providerTier: 'A',
        lastSyncSuccess: '2026-03-23T10:00:00.000Z',
        lastSyncFailure: null,
        stalenessIndicator: 0,
        driftState: 'none',
        deadLetterCount: 0,
        conflictCount: 0,
        createdAt: '2026-03-23T10:00:00.000Z',
        updatedAt: '2026-03-23T10:00:00.000Z',
      })
    ).not.toThrow();
  });

  it('validates ConnectorPackage', () => {
    expect(() =>
      ConnectorPackageSchema.parse({
        packageId: PACKAGE_ID,
        providerKey: 'jira',
        packageVersion: '1.0.0',
        capabilities: ['import', 'publish'],
        lifecycleState: 'published',
        tenantInstallable: true,
        createdAt: '2026-03-23T10:00:00.000Z',
        updatedAt: '2026-03-23T10:00:00.000Z',
      })
    ).not.toThrow();
  });

  it('validates TenantConnectorInstallation', () => {
    expect(() =>
      TenantConnectorInstallationSchema.parse({
        installationId: '00000000-0000-4000-8000-dddddddddddd',
        packageId: PACKAGE_ID,
        organizationId: ORG_ID,
        enabledBy: USER_ID,
        configurationScope: 'full',
        installedAt: '2026-03-23T10:00:00.000Z',
      })
    ).not.toThrow();
  });

  it('validates SupportNote', () => {
    expect(() =>
      SupportNoteSchema.parse({
        noteId: '00000000-0000-4000-8000-eeeeeeeeeeee',
        incidentRef: INCIDENT_REF,
        connectorId: CONNECTOR_ID,
        organizationId: ORG_ID,
        authorId: USER_ID,
        authorRole: 'support',
        content: 'Test note',
        createdAt: '2026-03-23T10:00:00.000Z',
      })
    ).not.toThrow();
  });

  it('validates EmergencyPause', () => {
    expect(() =>
      EmergencyPauseSchema.parse({
        pauseId: '00000000-0000-4000-8000-ffffffffffff',
        organizationId: ORG_ID,
        pauseScope: 'all_connectors',
        providerKey: null,
        pausedBy: USER_ID,
        reason: 'Test pause',
        blastRadius: 5,
        pausedAt: '2026-03-23T10:00:00.000Z',
        resumedAt: null,
        resumedBy: null,
      })
    ).not.toThrow();
  });

  it('validates FleetHealthSignal', () => {
    expect(() =>
      FleetHealthSignalSchema.parse({
        signalType: 'degraded_auth_count',
        threshold: 1,
        currentValue: 0,
        breached: false,
      })
    ).not.toThrow();
  });

  it('validates all 8 auth states are defined', () => {
    expect(ConnectorAuthStateValues).toHaveLength(8);
  });

  it('validates all 4 provider tiers are defined', () => {
    expect(ProviderTierValues).toHaveLength(4);
  });

  it('validates all 5 drift states are defined', () => {
    expect(DriftStateValues).toHaveLength(5);
  });

  it('validates all 4 lifecycle states are defined (Decision W5-9)', () => {
    expect(PackageLifecycleStateValues).toHaveLength(4);
  });

  it('validates all 8 package capabilities are defined', () => {
    expect(PackageCapabilityValues).toHaveLength(8);
  });

  it('validates all 2 support note author roles are defined (Decision W5-10)', () => {
    expect(SupportNoteAuthorRoleValues).toHaveLength(2);
  });

  it('validates all 2 emergency pause scopes are defined (Decision W5-11)', () => {
    expect(EmergencyPauseScopeValues).toHaveLength(2);
  });

  it('validates all 7 fleet health signal types are defined', () => {
    expect(FleetHealthSignalTypeValues).toHaveLength(7);
  });
});

// ------------------------------------------
// SIGNAL THRESHOLDS
// ------------------------------------------

describe('FLEET_HEALTH_SIGNAL_THRESHOLDS', () => {
  it('defines thresholds for all 7 signal types', () => {
    for (const signalType of FleetHealthSignalTypeValues) {
      expect(FLEET_HEALTH_SIGNAL_THRESHOLDS).toHaveProperty(signalType);
      expect(typeof FLEET_HEALTH_SIGNAL_THRESHOLDS[signalType]).toBe('number');
    }
  });

  it('degraded_auth_count threshold is 1 (any degraded connector)', () => {
    expect(FLEET_HEALTH_SIGNAL_THRESHOLDS.degraded_auth_count).toBe(1);
  });

  it('sync_failure_rate threshold is 10%', () => {
    expect(FLEET_HEALTH_SIGNAL_THRESHOLDS.sync_failure_rate).toBe(10);
  });

  it('dead_letter_depth threshold is 1', () => {
    expect(FLEET_HEALTH_SIGNAL_THRESHOLDS.dead_letter_depth).toBe(1);
  });

  it('conflict_depth threshold is 10', () => {
    expect(FLEET_HEALTH_SIGNAL_THRESHOLDS.conflict_depth).toBe(10);
  });

  it('staleness_breach_rate threshold is 15%', () => {
    expect(FLEET_HEALTH_SIGNAL_THRESHOLDS.staleness_breach_rate).toBe(15);
  });
});
