import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import type {
  CreateLandingSectionParams,
  RegisterSuperadminDomainParams,
  RegisterSuperadminSurfaceParams,
  SetAnnaLPConfigParams,
  SetDemoTrialConfigParams,
} from '../../../types/landingSuperadminPackage.js';
import {
  AnnaIdentityRoleValues,
  AnnaLPAssistantConfigSchema,
  CreateLandingSectionParamsSchema,
  DemoTrialConfigSchema,
  LandingPageSectionSchema,
  LandingSectionTypeValues,
  NarrativeVersionValues,
  OwnershipTypeValues,
  RegisterSuperadminDomainParamsSchema,
  RegisterSuperadminSurfaceParamsSchema,
  SetAnnaLPConfigParamsSchema,
  SetDemoTrialConfigParamsSchema,
  SuperadminDomainSchema,
  SuperadminSurfaceSchema,
  SurfaceAccessLevelValues,
} from '../../../types/landingSuperadminPackage.js';

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
  createLandingSection,
  getAnnaLPConfig,
  getDemoTrialConfig,
  getLandingSections,
  getSuperadminDomains,
  getSuperadminSurfaces,
  registerSuperadminDomain,
  registerSuperadminSurface,
  setAnnaLPConfig,
  setDemoTrialConfig,
} from '../landingSuperadminService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_ORG_ID = '00000000-0000-4000-8000-000000000099';
const DOMAIN_ID = '00000000-0000-4000-8000-dddddddddddd';

function makeSectionParams(
  overrides?: Partial<CreateLandingSectionParams>
): CreateLandingSectionParams {
  return {
    organizationId: ORG_ID,
    sectionType: 'hero',
    content: { headline: 'Consulting Intelligence Platform' },
    displayOrder: 0,
    ...overrides,
  };
}

function makeAnnaParams(overrides?: Partial<SetAnnaLPConfigParams>): SetAnnaLPConfigParams {
  return {
    organizationId: ORG_ID,
    identityRole: 'landing_guide',
    conversationContract: { greeting: 'Welcome', maxTurns: 10 },
    degradedStateBehavior: 'static_fallback',
    ...overrides,
  };
}

function makeDemoTrialParams(
  overrides?: Partial<SetDemoTrialConfigParams>
): SetDemoTrialConfigParams {
  return {
    organizationId: ORG_ID,
    narrativeVersion: 'v8',
    trialDuration: 14,
    demoScenarios: ['onboarding_walkthrough', 'initiative_creation'],
    ...overrides,
  };
}

function makeDomainParams(
  overrides?: Partial<RegisterSuperadminDomainParams>
): RegisterSuperadminDomainParams {
  return {
    organizationId: ORG_ID,
    domainName: 'Partner Program',
    ownershipType: 'platform_operator',
    ...overrides,
  };
}

function makeSurfaceParams(
  overrides?: Partial<RegisterSuperadminSurfaceParams>
): RegisterSuperadminSurfaceParams {
  return {
    domainId: DOMAIN_ID,
    organizationId: ORG_ID,
    surfaceName: 'Partner Organizations Table',
    accessLevel: 'platform',
    ...overrides,
  };
}

function makeFakeSectionRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    section_id: '00000000-0000-4000-8000-aaaaaaaaaaaa',
    organization_id: ORG_ID,
    section_type: 'hero',
    content: '{"headline":"Consulting Intelligence Platform"}',
    display_order: 0,
    is_active: 1,
    created_at: '2026-03-23T10:00:00.000Z',
    updated_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeFakeAnnaRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    config_id: '00000000-0000-4000-8000-bbbbbbbbbbbb',
    organization_id: ORG_ID,
    identity_role: 'landing_guide',
    conversation_contract: '{"greeting":"Welcome","maxTurns":10}',
    platform_integration_ref: null,
    ai_governance_ref: null,
    degraded_state_behavior: 'static_fallback',
    created_at: '2026-03-23T10:00:00.000Z',
    updated_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeFakeDemoTrialRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    config_id: '00000000-0000-4000-8000-cccccccccccc',
    organization_id: ORG_ID,
    narrative_version: 'v8',
    trial_duration: 14,
    demo_scenarios: '["onboarding_walkthrough","initiative_creation"]',
    onboarding_flow_ref: null,
    is_refreshed: 0,
    created_at: '2026-03-23T10:00:00.000Z',
    updated_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeFakeDomainRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    domain_id: DOMAIN_ID,
    organization_id: ORG_ID,
    domain_name: 'Partner Program',
    ownership_type: 'platform_operator',
    vertical_packages: '["partner_control_tower","partner_portal"]',
    cross_domain_capabilities: '["audit_log","health_dashboard"]',
    created_at: '2026-03-23T10:00:00.000Z',
    updated_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeFakeSurfaceRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    surface_id: '00000000-0000-4000-8000-eeeeeeeeeeee',
    domain_id: DOMAIN_ID,
    organization_id: ORG_ID,
    surface_name: 'Partner Organizations Table',
    access_level: 'platform',
    module_ref: null,
    created_at: '2026-03-23T10:00:00.000Z',
    updated_at: '2026-03-23T10:00:00.000Z',
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
// Landing Sections
// ------------------------------------------

describe('createLandingSection', () => {
  it('creates a hero section with defaults', async () => {
    const result = await createLandingSection(makeSectionParams());

    expect(result.sectionId).toBeDefined();
    expect(result.sectionType).toBe('hero');
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.content).toEqual({ headline: 'Consulting Intelligence Platform' });
    expect(result.displayOrder).toBe(0);
    expect(result.isActive).toBe(true);

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_landing_page_sections');
  });

  it('creates a value_proposition section', async () => {
    const result = await createLandingSection(
      makeSectionParams({ sectionType: 'value_proposition', displayOrder: 1 })
    );
    expect(result.sectionType).toBe('value_proposition');
    expect(result.displayOrder).toBe(1);
  });

  it('creates an expert_showcase section', async () => {
    const result = await createLandingSection(
      makeSectionParams({ sectionType: 'expert_showcase', displayOrder: 2 })
    );
    expect(result.sectionType).toBe('expert_showcase');
  });

  it('creates a use_case_mapping section', async () => {
    const result = await createLandingSection(
      makeSectionParams({ sectionType: 'use_case_mapping', displayOrder: 3 })
    );
    expect(result.sectionType).toBe('use_case_mapping');
  });

  it('creates a cta section', async () => {
    const result = await createLandingSection(
      makeSectionParams({ sectionType: 'cta', displayOrder: 4 })
    );
    expect(result.sectionType).toBe('cta');
  });

  it('creates a social_proof section', async () => {
    const result = await createLandingSection(
      makeSectionParams({ sectionType: 'social_proof', displayOrder: 5 })
    );
    expect(result.sectionType).toBe('social_proof');
  });

  it('supports isActive=false for inactive sections', async () => {
    const result = await createLandingSection(makeSectionParams({ isActive: false }));
    expect(result.isActive).toBe(false);
  });

  it('rejects invalid section type via Zod', async () => {
    await expect(
      createLandingSection(makeSectionParams({ sectionType: 'invalid' as any }))
    ).rejects.toThrow(ZodError);
  });

  it('rejects invalid UUID for organizationId', async () => {
    await expect(
      createLandingSection(makeSectionParams({ organizationId: 'not-a-uuid' }))
    ).rejects.toThrow(ZodError);
  });

  it('rejects negative displayOrder', async () => {
    await expect(createLandingSection(makeSectionParams({ displayOrder: -1 }))).rejects.toThrow(
      ZodError
    );
  });
});

describe('getLandingSections', () => {
  it('returns sections ordered by displayOrder', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeSectionRow({ display_order: 0, section_type: 'hero' }),
      makeFakeSectionRow({
        section_id: 'sec-2',
        display_order: 1,
        section_type: 'value_proposition',
      }),
      makeFakeSectionRow({ section_id: 'sec-3', display_order: 2, section_type: 'cta' }),
    ]);

    const results = await getLandingSections(ORG_ID);

    expect(results).toHaveLength(3);
    expect(results[0].sectionType).toBe('hero');
    expect(results[1].sectionType).toBe('value_proposition');
    expect(results[2].sectionType).toBe('cta');

    const sql = mockDbAll.mock.calls[0][0] as string;
    expect(sql).toContain('ORDER BY display_order ASC');
  });

  it('returns empty array when no sections exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getLandingSections(ORG_ID);
    expect(results).toEqual([]);
  });

  it('enforces org isolation in query', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getLandingSections(ORG_ID);

    const sql = mockDbAll.mock.calls[0][0] as string;
    expect(sql).toContain('organization_id');
    const params = mockDbAll.mock.calls[0][1] as string[];
    expect(params[0]).toBe(ORG_ID);
  });

  it('parses JSON content correctly', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeSectionRow({ content: '{"headline":"Test","subheadline":"Sub"}' }),
    ]);

    const results = await getLandingSections(ORG_ID);
    expect(results[0].content).toEqual({ headline: 'Test', subheadline: 'Sub' });
  });

  it('handles malformed JSON content gracefully', async () => {
    mockDbAll.mockResolvedValueOnce([makeFakeSectionRow({ content: 'not-json' })]);

    const results = await getLandingSections(ORG_ID);
    expect(results[0].content).toEqual({});
  });
});

// ------------------------------------------
// ANNA LP Config (W7-9)
// ------------------------------------------

describe('setAnnaLPConfig', () => {
  it('creates a landing_guide config', async () => {
    const result = await setAnnaLPConfig(makeAnnaParams());

    expect(result.configId).toBeDefined();
    expect(result.identityRole).toBe('landing_guide');
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.conversationContract).toEqual({ greeting: 'Welcome', maxTurns: 10 });
    expect(result.degradedStateBehavior).toBe('static_fallback');
    expect(result.platformIntegrationRef).toBeNull();
    expect(result.aiGovernanceRef).toBeNull();

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_anna_lp_configs');
    expect(sql).toContain('ON CONFLICT (organization_id, identity_role) DO UPDATE');
  });

  it('creates an onboarding_assistant config', async () => {
    const result = await setAnnaLPConfig(makeAnnaParams({ identityRole: 'onboarding_assistant' }));
    expect(result.identityRole).toBe('onboarding_assistant');
  });

  it('supports platform integration and governance refs', async () => {
    const result = await setAnnaLPConfig(
      makeAnnaParams({
        platformIntegrationRef: 'integration:chat-v8',
        aiGovernanceRef: 'governance:anna-policy',
      })
    );
    expect(result.platformIntegrationRef).toBe('integration:chat-v8');
    expect(result.aiGovernanceRef).toBe('governance:anna-policy');
  });

  it('records degraded state behavior for resilience', async () => {
    const result = await setAnnaLPConfig(
      makeAnnaParams({ degradedStateBehavior: 'show_static_faq' })
    );
    expect(result.degradedStateBehavior).toBe('show_static_faq');
  });

  it('rejects invalid identity role via Zod', async () => {
    await expect(
      setAnnaLPConfig(makeAnnaParams({ identityRole: 'invalid' as any }))
    ).rejects.toThrow(ZodError);
  });

  it('rejects empty degradedStateBehavior', async () => {
    await expect(setAnnaLPConfig(makeAnnaParams({ degradedStateBehavior: '' }))).rejects.toThrow(
      ZodError
    );
  });
});

describe('getAnnaLPConfig', () => {
  it('returns config when found', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeAnnaRow());

    const result = await getAnnaLPConfig(ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.identityRole).toBe('landing_guide');
    expect(result!.organizationId).toBe(ORG_ID);
    expect(result!.conversationContract).toEqual({ greeting: 'Welcome', maxTurns: 10 });
  });

  it('returns null when no config exists', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getAnnaLPConfig(ORG_ID);
    expect(result).toBeNull();
  });

  it('enforces org isolation — different org returns null', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getAnnaLPConfig(OTHER_ORG_ID);
    expect(result).toBeNull();
  });

  it('parses conversation contract JSON', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeFakeAnnaRow({ conversation_contract: '{"maxTurns":5,"persona":"friendly"}' })
    );

    const result = await getAnnaLPConfig(ORG_ID);
    expect(result!.conversationContract).toEqual({ maxTurns: 5, persona: 'friendly' });
  });
});

// ------------------------------------------
// Demo/Trial Config (W7-11)
// ------------------------------------------

describe('setDemoTrialConfig', () => {
  it('creates a V8 demo/trial config', async () => {
    const result = await setDemoTrialConfig(makeDemoTrialParams());

    expect(result.configId).toBeDefined();
    expect(result.narrativeVersion).toBe('v8');
    expect(result.trialDuration).toBe(14);
    expect(result.demoScenarios).toEqual(['onboarding_walkthrough', 'initiative_creation']);
    expect(result.isRefreshed).toBe(false);
    expect(result.onboardingFlowRef).toBeNull();

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_demo_trial_configs');
    expect(sql).toContain('ON CONFLICT (organization_id) DO UPDATE');
  });

  it('creates a V3 config for legacy compatibility', async () => {
    const result = await setDemoTrialConfig(makeDemoTrialParams({ narrativeVersion: 'v3' }));
    expect(result.narrativeVersion).toBe('v3');
  });

  it('supports isRefreshed=true for V3→V8 migration', async () => {
    const result = await setDemoTrialConfig(
      makeDemoTrialParams({ narrativeVersion: 'v8', isRefreshed: true })
    );
    expect(result.isRefreshed).toBe(true);
    expect(result.narrativeVersion).toBe('v8');
  });

  it('supports onboarding flow reference', async () => {
    const result = await setDemoTrialConfig(
      makeDemoTrialParams({ onboardingFlowRef: 'flow:first-run-v8' })
    );
    expect(result.onboardingFlowRef).toBe('flow:first-run-v8');
  });

  it('rejects invalid narrative version via Zod', async () => {
    await expect(
      setDemoTrialConfig(makeDemoTrialParams({ narrativeVersion: 'v9' as any }))
    ).rejects.toThrow(ZodError);
  });

  it('rejects zero trial duration', async () => {
    await expect(setDemoTrialConfig(makeDemoTrialParams({ trialDuration: 0 }))).rejects.toThrow(
      ZodError
    );
  });

  it('rejects negative trial duration', async () => {
    await expect(setDemoTrialConfig(makeDemoTrialParams({ trialDuration: -7 }))).rejects.toThrow(
      ZodError
    );
  });

  it('rejects empty demo scenarios array', async () => {
    await expect(setDemoTrialConfig(makeDemoTrialParams({ demoScenarios: [] }))).rejects.toThrow(
      ZodError
    );
  });
});

describe('getDemoTrialConfig', () => {
  it('returns config when found', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeDemoTrialRow());

    const result = await getDemoTrialConfig(ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.narrativeVersion).toBe('v8');
    expect(result!.trialDuration).toBe(14);
    expect(result!.demoScenarios).toEqual(['onboarding_walkthrough', 'initiative_creation']);
  });

  it('returns null when no config exists', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getDemoTrialConfig(ORG_ID);
    expect(result).toBeNull();
  });

  it('correctly maps isRefreshed boolean from integer', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeDemoTrialRow({ is_refreshed: 1 }));
    const result = await getDemoTrialConfig(ORG_ID);
    expect(result!.isRefreshed).toBe(true);
  });

  it('enforces org isolation — different org returns null', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getDemoTrialConfig(OTHER_ORG_ID);
    expect(result).toBeNull();
  });
});

// ------------------------------------------
// Superadmin Domains (W7-10)
// ------------------------------------------

describe('registerSuperadminDomain', () => {
  it('registers a platform_operator domain', async () => {
    const result = await registerSuperadminDomain(makeDomainParams());

    expect(result.domainId).toBeDefined();
    expect(result.domainName).toBe('Partner Program');
    expect(result.ownershipType).toBe('platform_operator');
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.verticalPackages).toEqual([]);
    expect(result.crossDomainCapabilities).toEqual([]);

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_superadmin_domains');
  });

  it('registers a tenant_admin domain', async () => {
    const result = await registerSuperadminDomain(
      makeDomainParams({ ownershipType: 'tenant_admin', domainName: 'Organization Settings' })
    );
    expect(result.ownershipType).toBe('tenant_admin');
    expect(result.domainName).toBe('Organization Settings');
  });

  it('supports vertical packages', async () => {
    const result = await registerSuperadminDomain(
      makeDomainParams({ verticalPackages: ['partner_control_tower', 'partner_portal'] })
    );
    expect(result.verticalPackages).toEqual(['partner_control_tower', 'partner_portal']);
  });

  it('supports cross-domain capabilities', async () => {
    const result = await registerSuperadminDomain(
      makeDomainParams({ crossDomainCapabilities: ['audit_log', 'health_dashboard'] })
    );
    expect(result.crossDomainCapabilities).toEqual(['audit_log', 'health_dashboard']);
  });

  it('rejects invalid ownership type via Zod', async () => {
    await expect(
      registerSuperadminDomain(makeDomainParams({ ownershipType: 'invalid' as any }))
    ).rejects.toThrow(ZodError);
  });

  it('rejects empty domain name', async () => {
    await expect(registerSuperadminDomain(makeDomainParams({ domainName: '' }))).rejects.toThrow(
      ZodError
    );
  });

  it('rejects invalid UUID for organizationId', async () => {
    await expect(
      registerSuperadminDomain(makeDomainParams({ organizationId: 'bad' }))
    ).rejects.toThrow(ZodError);
  });
});

describe('getSuperadminDomains', () => {
  it('returns all domains for an organization', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeDomainRow(),
      makeFakeDomainRow({ domain_id: 'dom-2', domain_name: 'Virtual Workers' }),
    ]);

    const results = await getSuperadminDomains(ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].domainName).toBe('Partner Program');
  });

  it('returns empty array when no domains exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getSuperadminDomains(ORG_ID);
    expect(results).toEqual([]);
  });

  it('enforces org isolation in query', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getSuperadminDomains(ORG_ID);

    const sql = mockDbAll.mock.calls[0][0] as string;
    expect(sql).toContain('organization_id');
    const params = mockDbAll.mock.calls[0][1] as string[];
    expect(params[0]).toBe(ORG_ID);
  });

  it('parses vertical packages and cross-domain capabilities from JSON', async () => {
    mockDbAll.mockResolvedValueOnce([makeFakeDomainRow()]);

    const results = await getSuperadminDomains(ORG_ID);
    expect(results[0].verticalPackages).toEqual(['partner_control_tower', 'partner_portal']);
    expect(results[0].crossDomainCapabilities).toEqual(['audit_log', 'health_dashboard']);
  });
});

// ------------------------------------------
// Superadmin Surfaces
// ------------------------------------------

describe('registerSuperadminSurface', () => {
  it('registers a platform-level surface', async () => {
    const result = await registerSuperadminSurface(makeSurfaceParams());

    expect(result.surfaceId).toBeDefined();
    expect(result.surfaceName).toBe('Partner Organizations Table');
    expect(result.accessLevel).toBe('platform');
    expect(result.domainId).toBe(DOMAIN_ID);
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.moduleRef).toBeNull();

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_superadmin_surfaces');
  });

  it('registers a tenant-level surface', async () => {
    const result = await registerSuperadminSurface(
      makeSurfaceParams({ accessLevel: 'tenant', surfaceName: 'Org Settings' })
    );
    expect(result.accessLevel).toBe('tenant');
  });

  it('registers a module-level surface with moduleRef', async () => {
    const result = await registerSuperadminSurface(
      makeSurfaceParams({
        accessLevel: 'module',
        surfaceName: 'Connector Fleet Health',
        moduleRef: 'module:connectors',
      })
    );
    expect(result.accessLevel).toBe('module');
    expect(result.moduleRef).toBe('module:connectors');
  });

  it('rejects invalid access level via Zod', async () => {
    await expect(
      registerSuperadminSurface(makeSurfaceParams({ accessLevel: 'invalid' as any }))
    ).rejects.toThrow(ZodError);
  });

  it('rejects empty surface name', async () => {
    await expect(registerSuperadminSurface(makeSurfaceParams({ surfaceName: '' }))).rejects.toThrow(
      ZodError
    );
  });

  it('rejects invalid UUID for domainId', async () => {
    await expect(registerSuperadminSurface(makeSurfaceParams({ domainId: 'bad' }))).rejects.toThrow(
      ZodError
    );
  });
});

describe('getSuperadminSurfaces', () => {
  it('returns surfaces for a domain with org isolation', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeSurfaceRow(),
      makeFakeSurfaceRow({ surface_id: 'surf-2', surface_name: 'Lifecycle Manager' }),
    ]);

    const results = await getSuperadminSurfaces(DOMAIN_ID, ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].surfaceName).toBe('Partner Organizations Table');
  });

  it('returns empty array when no surfaces exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getSuperadminSurfaces(DOMAIN_ID, ORG_ID);
    expect(results).toEqual([]);
  });

  it('enforces both domain and org isolation in query', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getSuperadminSurfaces(DOMAIN_ID, ORG_ID);

    const sql = mockDbAll.mock.calls[0][0] as string;
    expect(sql).toContain('domain_id');
    expect(sql).toContain('organization_id');
    const params = mockDbAll.mock.calls[0][1] as string[];
    expect(params[0]).toBe(DOMAIN_ID);
    expect(params[1]).toBe(ORG_ID);
  });
});

// ------------------------------------------
// Org isolation cross-cutting
// ------------------------------------------

describe('org isolation', () => {
  it('getLandingSections uses org filter', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getLandingSections(OTHER_ORG_ID);

    const params = mockDbAll.mock.calls[0][1] as string[];
    expect(params[0]).toBe(OTHER_ORG_ID);
  });

  it('getAnnaLPConfig uses org filter', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await getAnnaLPConfig(OTHER_ORG_ID);

    const params = mockDbGet.mock.calls[0][1] as string[];
    expect(params[0]).toBe(OTHER_ORG_ID);
  });

  it('getDemoTrialConfig uses org filter', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await getDemoTrialConfig(OTHER_ORG_ID);

    const params = mockDbGet.mock.calls[0][1] as string[];
    expect(params[0]).toBe(OTHER_ORG_ID);
  });

  it('getSuperadminDomains uses org filter', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getSuperadminDomains(OTHER_ORG_ID);

    const params = mockDbAll.mock.calls[0][1] as string[];
    expect(params[0]).toBe(OTHER_ORG_ID);
  });
});

// ------------------------------------------
// Zod schema validation (entity-level)
// ------------------------------------------

describe('Zod schema validation', () => {
  it('validates a correct LandingPageSection', () => {
    expect(() =>
      LandingPageSectionSchema.parse({
        sectionId: '00000000-0000-4000-8000-aaaaaaaaaaaa',
        organizationId: ORG_ID,
        sectionType: 'hero',
        content: { headline: 'Test' },
        displayOrder: 0,
        isActive: true,
        createdAt: '2026-03-23T10:00:00.000Z',
        updatedAt: '2026-03-23T10:00:00.000Z',
      })
    ).not.toThrow();
  });

  it('rejects LandingPageSection with invalid sectionType', () => {
    expect(() =>
      LandingPageSectionSchema.parse({
        sectionId: '00000000-0000-4000-8000-aaaaaaaaaaaa',
        organizationId: ORG_ID,
        sectionType: 'invalid',
        content: {},
        displayOrder: 0,
        isActive: true,
        createdAt: '2026-03-23T10:00:00.000Z',
        updatedAt: '2026-03-23T10:00:00.000Z',
      })
    ).toThrow(ZodError);
  });

  it('validates a correct AnnaLPAssistantConfig', () => {
    expect(() =>
      AnnaLPAssistantConfigSchema.parse({
        configId: '00000000-0000-4000-8000-bbbbbbbbbbbb',
        organizationId: ORG_ID,
        identityRole: 'landing_guide',
        conversationContract: { greeting: 'Hi' },
        platformIntegrationRef: null,
        aiGovernanceRef: null,
        degradedStateBehavior: 'static_fallback',
        createdAt: '2026-03-23T10:00:00.000Z',
        updatedAt: '2026-03-23T10:00:00.000Z',
      })
    ).not.toThrow();
  });

  it('validates a correct DemoTrialConfig', () => {
    expect(() =>
      DemoTrialConfigSchema.parse({
        configId: '00000000-0000-4000-8000-cccccccccccc',
        organizationId: ORG_ID,
        narrativeVersion: 'v8',
        trialDuration: 14,
        demoScenarios: ['scenario_a'],
        onboardingFlowRef: null,
        isRefreshed: true,
        createdAt: '2026-03-23T10:00:00.000Z',
        updatedAt: '2026-03-23T10:00:00.000Z',
      })
    ).not.toThrow();
  });

  it('validates a correct SuperadminDomain', () => {
    expect(() =>
      SuperadminDomainSchema.parse({
        domainId: DOMAIN_ID,
        organizationId: ORG_ID,
        domainName: 'Partner Program',
        ownershipType: 'platform_operator',
        verticalPackages: ['pkg_a'],
        crossDomainCapabilities: ['cap_a'],
        createdAt: '2026-03-23T10:00:00.000Z',
        updatedAt: '2026-03-23T10:00:00.000Z',
      })
    ).not.toThrow();
  });

  it('validates a correct SuperadminSurface', () => {
    expect(() =>
      SuperadminSurfaceSchema.parse({
        surfaceId: '00000000-0000-4000-8000-eeeeeeeeeeee',
        domainId: DOMAIN_ID,
        organizationId: ORG_ID,
        surfaceName: 'Test Surface',
        accessLevel: 'tenant',
        moduleRef: null,
        createdAt: '2026-03-23T10:00:00.000Z',
        updatedAt: '2026-03-23T10:00:00.000Z',
      })
    ).not.toThrow();
  });

  it('validates CreateLandingSectionParams', () => {
    expect(() => CreateLandingSectionParamsSchema.parse(makeSectionParams())).not.toThrow();
  });

  it('validates SetAnnaLPConfigParams', () => {
    expect(() => SetAnnaLPConfigParamsSchema.parse(makeAnnaParams())).not.toThrow();
  });

  it('validates SetDemoTrialConfigParams', () => {
    expect(() => SetDemoTrialConfigParamsSchema.parse(makeDemoTrialParams())).not.toThrow();
  });

  it('validates RegisterSuperadminDomainParams', () => {
    expect(() => RegisterSuperadminDomainParamsSchema.parse(makeDomainParams())).not.toThrow();
  });

  it('validates RegisterSuperadminSurfaceParams', () => {
    expect(() => RegisterSuperadminSurfaceParamsSchema.parse(makeSurfaceParams())).not.toThrow();
  });
});

// ------------------------------------------
// Enum completeness
// ------------------------------------------

describe('enum completeness', () => {
  it('LandingSectionTypeValues has 6 types', () => {
    expect(LandingSectionTypeValues).toHaveLength(6);
    expect(LandingSectionTypeValues).toContain('hero');
    expect(LandingSectionTypeValues).toContain('value_proposition');
    expect(LandingSectionTypeValues).toContain('expert_showcase');
    expect(LandingSectionTypeValues).toContain('use_case_mapping');
    expect(LandingSectionTypeValues).toContain('cta');
    expect(LandingSectionTypeValues).toContain('social_proof');
  });

  it('AnnaIdentityRoleValues has 2 roles', () => {
    expect(AnnaIdentityRoleValues).toHaveLength(2);
    expect(AnnaIdentityRoleValues).toContain('landing_guide');
    expect(AnnaIdentityRoleValues).toContain('onboarding_assistant');
  });

  it('NarrativeVersionValues has v3 and v8', () => {
    expect(NarrativeVersionValues).toHaveLength(2);
    expect(NarrativeVersionValues).toContain('v3');
    expect(NarrativeVersionValues).toContain('v8');
  });

  it('OwnershipTypeValues has 2 types', () => {
    expect(OwnershipTypeValues).toHaveLength(2);
    expect(OwnershipTypeValues).toContain('platform_operator');
    expect(OwnershipTypeValues).toContain('tenant_admin');
  });

  it('SurfaceAccessLevelValues has 3 levels', () => {
    expect(SurfaceAccessLevelValues).toHaveLength(3);
    expect(SurfaceAccessLevelValues).toContain('platform');
    expect(SurfaceAccessLevelValues).toContain('tenant');
    expect(SurfaceAccessLevelValues).toContain('module');
  });
});
