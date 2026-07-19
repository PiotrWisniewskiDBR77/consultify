/**
 * V8 Landing / Onboarding / Superadmin Service
 *
 * Manages landing page content model, ANNA LP assistant configs,
 * demo/trial V8 alignment, and horizontal superadmin IA.
 *
 * All queries enforce organization-level isolation.
 *
 * Decisions implemented:
 *  W7-9  — ANNA LP assistant contract (identity roles, degraded state)
 *  W7-10 — Superadmin V8 SSOT (horizontal IA, domain/surface registry)
 *  W7-11 — Demo/trial V8 refresh (narrative version convergence)
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  AnnaLPAssistantConfig,
  CreateLandingSectionParams,
  DemoTrialConfig,
  LandingPageSection,
  RegisterSuperadminDomainParams,
  RegisterSuperadminSurfaceParams,
  SetAnnaLPConfigParams,
  SetDemoTrialConfigParams,
  SuperadminDomain,
  SuperadminSurface,
} from '../../types/landingSuperadminPackage.js';
import {
  CreateLandingSectionParamsSchema,
  RegisterSuperadminDomainParamsSchema,
  RegisterSuperadminSurfaceParamsSchema,
  SetAnnaLPConfigParamsSchema,
  SetDemoTrialConfigParamsSchema,
} from '../../types/landingSuperadminPackage.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// ==========================================
// HELPERS
// ==========================================

const LOG_PREFIX = '[V8:LandingSuperadmin]';

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    logger.warn(`${LOG_PREFIX} Failed to parse JSON, using fallback`);
    return fallback;
  }
}

// ==========================================
// ROW TYPES
// ==========================================

interface LandingSectionRow {
  section_id: string;
  organization_id: string;
  section_type: string;
  content: string;
  display_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface AnnaLPConfigRow {
  config_id: string;
  organization_id: string;
  identity_role: string;
  conversation_contract: string;
  platform_integration_ref: string | null;
  ai_governance_ref: string | null;
  degraded_state_behavior: string;
  created_at: string;
  updated_at: string;
}

interface DemoTrialConfigRow {
  config_id: string;
  organization_id: string;
  narrative_version: string;
  trial_duration: number;
  demo_scenarios: string;
  onboarding_flow_ref: string | null;
  is_refreshed: number;
  created_at: string;
  updated_at: string;
}

interface SuperadminDomainRow {
  domain_id: string;
  organization_id: string;
  domain_name: string;
  ownership_type: string;
  vertical_packages: string;
  cross_domain_capabilities: string;
  created_at: string;
  updated_at: string;
}

interface SuperadminSurfaceRow {
  surface_id: string;
  domain_id: string;
  organization_id: string;
  surface_name: string;
  access_level: string;
  module_ref: string | null;
  created_at: string;
  updated_at: string;
}

// ==========================================
// ROW MAPPERS
// ==========================================

function rowToLandingSection(row: LandingSectionRow): LandingPageSection {
  return {
    sectionId: row.section_id,
    organizationId: row.organization_id,
    sectionType: row.section_type as LandingPageSection['sectionType'],
    content: safeJsonParse(row.content, {}),
    displayOrder: row.display_order,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToAnnaLPConfig(row: AnnaLPConfigRow): AnnaLPAssistantConfig {
  return {
    configId: row.config_id,
    organizationId: row.organization_id,
    identityRole: row.identity_role as AnnaLPAssistantConfig['identityRole'],
    conversationContract: safeJsonParse(row.conversation_contract, {}),
    platformIntegrationRef: row.platform_integration_ref,
    aiGovernanceRef: row.ai_governance_ref,
    degradedStateBehavior: row.degraded_state_behavior,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToDemoTrialConfig(row: DemoTrialConfigRow): DemoTrialConfig {
  return {
    configId: row.config_id,
    organizationId: row.organization_id,
    narrativeVersion: row.narrative_version as DemoTrialConfig['narrativeVersion'],
    trialDuration: row.trial_duration,
    demoScenarios: safeJsonParse<string[]>(row.demo_scenarios, []),
    onboardingFlowRef: row.onboarding_flow_ref,
    isRefreshed: row.is_refreshed === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToSuperadminDomain(row: SuperadminDomainRow): SuperadminDomain {
  return {
    domainId: row.domain_id,
    organizationId: row.organization_id,
    domainName: row.domain_name,
    ownershipType: row.ownership_type as SuperadminDomain['ownershipType'],
    verticalPackages: safeJsonParse<string[]>(row.vertical_packages, []),
    crossDomainCapabilities: safeJsonParse<string[]>(row.cross_domain_capabilities, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToSuperadminSurface(row: SuperadminSurfaceRow): SuperadminSurface {
  return {
    surfaceId: row.surface_id,
    domainId: row.domain_id,
    organizationId: row.organization_id,
    surfaceName: row.surface_name,
    accessLevel: row.access_level as SuperadminSurface['accessLevel'],
    moduleRef: row.module_ref,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==========================================
// PUBLIC API — Landing Sections
// ==========================================

export async function createLandingSection(
  params: CreateLandingSectionParams
): Promise<LandingPageSection> {
  const validated = CreateLandingSectionParamsSchema.parse(params);

  const sectionId = uuidv4();
  const now = new Date().toISOString();

  const section: LandingPageSection = {
    sectionId,
    organizationId: validated.organizationId,
    sectionType: validated.sectionType,
    content: validated.content,
    displayOrder: validated.displayOrder,
    isActive: validated.isActive,
    createdAt: now,
    updatedAt: now,
  };

  await dbRun(
    `INSERT INTO v8_landing_page_sections (
      section_id, organization_id, section_type, content,
      display_order, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      section.sectionId,
      section.organizationId,
      section.sectionType,
      JSON.stringify(section.content),
      section.displayOrder,
      section.isActive ? 1 : 0,
      section.createdAt,
      section.updatedAt,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Created landing section ${sectionId} type=${validated.sectionType} for org ${validated.organizationId}`
  );
  return section;
}

export async function getLandingSections(organizationId: string): Promise<LandingPageSection[]> {
  const rows = await dbAll<LandingSectionRow>(
    `SELECT * FROM v8_landing_page_sections
     WHERE organization_id = ?
     ORDER BY display_order ASC`,
    [organizationId],
    { fallback: true }
  );

  return (rows || []).map(rowToLandingSection);
}

// ==========================================
// PUBLIC API — ANNA LP Config (W7-9)
// ==========================================

export async function setAnnaLPConfig(
  params: SetAnnaLPConfigParams
): Promise<AnnaLPAssistantConfig> {
  const validated = SetAnnaLPConfigParamsSchema.parse(params);

  const configId = uuidv4();
  const now = new Date().toISOString();

  const config: AnnaLPAssistantConfig = {
    configId,
    organizationId: validated.organizationId,
    identityRole: validated.identityRole,
    conversationContract: validated.conversationContract,
    platformIntegrationRef: validated.platformIntegrationRef,
    aiGovernanceRef: validated.aiGovernanceRef,
    degradedStateBehavior: validated.degradedStateBehavior,
    createdAt: now,
    updatedAt: now,
  };

  await dbRun(
    `INSERT INTO v8_anna_lp_configs (
      config_id, organization_id, identity_role, conversation_contract,
      platform_integration_ref, ai_governance_ref, degraded_state_behavior,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (organization_id, identity_role) DO UPDATE SET
      config_id = EXCLUDED.config_id,
      conversation_contract = EXCLUDED.conversation_contract,
      platform_integration_ref = EXCLUDED.platform_integration_ref,
      ai_governance_ref = EXCLUDED.ai_governance_ref,
      degraded_state_behavior = EXCLUDED.degraded_state_behavior,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at`,
    [
      config.configId,
      config.organizationId,
      config.identityRole,
      JSON.stringify(config.conversationContract),
      config.platformIntegrationRef,
      config.aiGovernanceRef,
      config.degradedStateBehavior,
      config.createdAt,
      config.updatedAt,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Set ANNA LP config ${configId} role=${validated.identityRole} for org ${validated.organizationId}`
  );
  return config;
}

export async function getAnnaLPConfig(
  organizationId: string
): Promise<AnnaLPAssistantConfig | null> {
  const row = await dbGet<AnnaLPConfigRow>(
    `SELECT * FROM v8_anna_lp_configs
     WHERE organization_id = ?
     ORDER BY updated_at DESC LIMIT 1`,
    [organizationId],
    { fallback: true }
  );

  if (!row) return null;
  return rowToAnnaLPConfig(row);
}

// ==========================================
// PUBLIC API — Demo/Trial Config (W7-11)
// ==========================================

export async function setDemoTrialConfig(
  params: SetDemoTrialConfigParams
): Promise<DemoTrialConfig> {
  const validated = SetDemoTrialConfigParamsSchema.parse(params);

  const configId = uuidv4();
  const now = new Date().toISOString();

  const config: DemoTrialConfig = {
    configId,
    organizationId: validated.organizationId,
    narrativeVersion: validated.narrativeVersion,
    trialDuration: validated.trialDuration,
    demoScenarios: validated.demoScenarios,
    onboardingFlowRef: validated.onboardingFlowRef,
    isRefreshed: validated.isRefreshed,
    createdAt: now,
    updatedAt: now,
  };

  await dbRun(
    `INSERT INTO v8_demo_trial_configs (
      config_id, organization_id, narrative_version, trial_duration,
      demo_scenarios, onboarding_flow_ref, is_refreshed,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (organization_id) DO UPDATE SET
      config_id = EXCLUDED.config_id,
      narrative_version = EXCLUDED.narrative_version,
      trial_duration = EXCLUDED.trial_duration,
      demo_scenarios = EXCLUDED.demo_scenarios,
      onboarding_flow_ref = EXCLUDED.onboarding_flow_ref,
      is_refreshed = EXCLUDED.is_refreshed,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at`,
    [
      config.configId,
      config.organizationId,
      config.narrativeVersion,
      config.trialDuration,
      JSON.stringify(config.demoScenarios),
      config.onboardingFlowRef,
      config.isRefreshed ? 1 : 0,
      config.createdAt,
      config.updatedAt,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Set demo/trial config ${configId} narrative=${validated.narrativeVersion} for org ${validated.organizationId}`
  );
  return config;
}

export async function getDemoTrialConfig(organizationId: string): Promise<DemoTrialConfig | null> {
  const row = await dbGet<DemoTrialConfigRow>(
    `SELECT * FROM v8_demo_trial_configs
     WHERE organization_id = ?`,
    [organizationId],
    { fallback: true }
  );

  if (!row) return null;
  return rowToDemoTrialConfig(row);
}

// ==========================================
// PUBLIC API — Superadmin Domains (W7-10)
// ==========================================

export async function registerSuperadminDomain(
  params: RegisterSuperadminDomainParams
): Promise<SuperadminDomain> {
  const validated = RegisterSuperadminDomainParamsSchema.parse(params);

  const domainId = uuidv4();
  const now = new Date().toISOString();

  const domain: SuperadminDomain = {
    domainId,
    organizationId: validated.organizationId,
    domainName: validated.domainName,
    ownershipType: validated.ownershipType,
    verticalPackages: validated.verticalPackages,
    crossDomainCapabilities: validated.crossDomainCapabilities,
    createdAt: now,
    updatedAt: now,
  };

  await dbRun(
    `INSERT INTO v8_superadmin_domains (
      domain_id, organization_id, domain_name, ownership_type,
      vertical_packages, cross_domain_capabilities,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      domain.domainId,
      domain.organizationId,
      domain.domainName,
      domain.ownershipType,
      JSON.stringify(domain.verticalPackages),
      JSON.stringify(domain.crossDomainCapabilities),
      domain.createdAt,
      domain.updatedAt,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Registered superadmin domain ${domainId} "${validated.domainName}" for org ${validated.organizationId}`
  );
  return domain;
}

export async function getSuperadminDomains(organizationId: string): Promise<SuperadminDomain[]> {
  const rows = await dbAll<SuperadminDomainRow>(
    `SELECT * FROM v8_superadmin_domains
     WHERE organization_id = ?
     ORDER BY domain_name ASC`,
    [organizationId],
    { fallback: true }
  );

  return (rows || []).map(rowToSuperadminDomain);
}

// ==========================================
// PUBLIC API — Superadmin Surfaces
// ==========================================

export async function registerSuperadminSurface(
  params: RegisterSuperadminSurfaceParams
): Promise<SuperadminSurface> {
  const validated = RegisterSuperadminSurfaceParamsSchema.parse(params);

  const surfaceId = uuidv4();
  const now = new Date().toISOString();

  const surface: SuperadminSurface = {
    surfaceId,
    domainId: validated.domainId,
    organizationId: validated.organizationId,
    surfaceName: validated.surfaceName,
    accessLevel: validated.accessLevel,
    moduleRef: validated.moduleRef,
    createdAt: now,
    updatedAt: now,
  };

  await dbRun(
    `INSERT INTO v8_superadmin_surfaces (
      surface_id, domain_id, organization_id, surface_name,
      access_level, module_ref, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      surface.surfaceId,
      surface.domainId,
      surface.organizationId,
      surface.surfaceName,
      surface.accessLevel,
      surface.moduleRef,
      surface.createdAt,
      surface.updatedAt,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Registered superadmin surface ${surfaceId} "${validated.surfaceName}" in domain ${validated.domainId}`
  );
  return surface;
}

export async function getSuperadminSurfaces(
  domainId: string,
  organizationId: string
): Promise<SuperadminSurface[]> {
  const rows = await dbAll<SuperadminSurfaceRow>(
    `SELECT * FROM v8_superadmin_surfaces
     WHERE domain_id = ? AND organization_id = ?
     ORDER BY surface_name ASC`,
    [domainId, organizationId],
    { fallback: true }
  );

  return (rows || []).map(rowToSuperadminSurface);
}
