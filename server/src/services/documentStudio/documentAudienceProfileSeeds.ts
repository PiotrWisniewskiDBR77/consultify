/**
 * Consultify Document Studio — System AudienceProfile seeds
 * (Epic E9, Slice 9.1).
 *
 * These four profiles represent the canonical audience-driven variants
 * Document Studio supports out of the box. They are owned by the
 * `'system'` organization, immutable, and always `'active'`. Tenants
 * may copy and customize them via the Audience Profile registry (Slice
 * 9.2) but the seed instances themselves never change shape.
 *
 * The seeds intentionally use a small, stable audience-tag vocabulary
 * (`technical_detail`, `engineering_only`, `internal_only`,
 * `client_only`) so authors can tag sections / blocks once and have
 * every default variant project them correctly. Custom profiles may
 * extend the vocabulary with their own tags without breaking the
 * defaults.
 */

import type { AudienceProfile } from './documentStudioTypes.js';

/** Stable system audience-tag vocabulary used by the four default profiles. */
export const SYSTEM_AUDIENCE_TAG_VOCABULARY = Object.freeze([
  'technical_detail',
  'engineering_only',
  'internal_only',
  'client_only',
] as const);

const SYSTEM_TIMESTAMP = '1970-01-01T00:00:00.000Z';
const SYSTEM_ACTOR = 'system';
const SYSTEM_VERSION = 'v1';

/**
 * Board / Executive variant.
 *
 * Decision-grade, executive register, concise. Drops appendices and
 * any sections / blocks tagged technical_detail or engineering_only.
 * Audience array is overridden to "Board / CEO / CFO" so the cover page
 * + headers reflect the intended reader.
 */
export const BOARD_EXECUTIVE_PROFILE: AudienceProfile = Object.freeze({
  profileId: 'system_board_executive',
  organizationId: 'system',
  name: 'Board / Executive',
  description:
    'Decision-grade variant for board / sponsor audiences. Concise, executive register, no engineering detail, appendices dropped.',
  status: 'active',
  version: SYSTEM_VERSION,
  audienceLabels: ['Board', 'CEO', 'CFO'],
  registerOverride: 'executive',
  densityOverride: 'concise',
  languageStyleOverride: 'formal',
  sectionFilters: Object.freeze({
    exclude: ['technical_detail', 'engineering_only'],
  }) as AudienceProfile['sectionFilters'],
  blockFilters: Object.freeze({
    exclude: ['technical_detail', 'engineering_only'],
  }) as AudienceProfile['blockFilters'],
  executiveSummaryPolicy: 'preserve',
  appendixPolicy: 'drop',
  jargonPolicy: 'plain_language',
  notes: 'System default — immutable.',
  createdBy: SYSTEM_ACTOR,
  createdAt: SYSTEM_TIMESTAMP,
  updatedAt: SYSTEM_TIMESTAMP,
  activatedBy: SYSTEM_ACTOR,
  activatedAt: SYSTEM_TIMESTAMP,
}) as AudienceProfile;

/**
 * Client / External variant.
 *
 * Professional consulting register at standard density. Keeps
 * appendices (clients expect annexes), drops internal-only and
 * engineering-only material, and prefers plain language over jargon.
 */
export const CLIENT_EXTERNAL_PROFILE: AudienceProfile = Object.freeze({
  profileId: 'system_client_external',
  organizationId: 'system',
  name: 'Client / External',
  description:
    'External-facing client variant. Consulting register, standard density, internal-only and engineering-only material removed.',
  status: 'active',
  version: SYSTEM_VERSION,
  audienceLabels: ['Client'],
  registerOverride: 'professional',
  densityOverride: 'standard',
  languageStyleOverride: 'consulting',
  sectionFilters: Object.freeze({
    exclude: ['internal_only', 'engineering_only'],
  }) as AudienceProfile['sectionFilters'],
  blockFilters: Object.freeze({
    exclude: ['internal_only', 'engineering_only'],
  }) as AudienceProfile['blockFilters'],
  executiveSummaryPolicy: 'preserve',
  appendixPolicy: 'preserve',
  jargonPolicy: 'plain_language',
  notes: 'System default — immutable.',
  createdBy: SYSTEM_ACTOR,
  createdAt: SYSTEM_TIMESTAMP,
  updatedAt: SYSTEM_TIMESTAMP,
  activatedBy: SYSTEM_ACTOR,
  activatedAt: SYSTEM_TIMESTAMP,
}) as AudienceProfile;

/**
 * Engineering / Technical variant.
 *
 * Technical register, detailed density. Skips the executive summary
 * (engineering teams want the meat, not the recap), drops client-only
 * material, and keeps appendices for technical reference.
 */
export const ENGINEERING_TECHNICAL_PROFILE: AudienceProfile = Object.freeze({
  profileId: 'system_engineering_technical',
  organizationId: 'system',
  name: 'Engineering / Technical',
  description:
    'Technical implementation audience. Detailed density, technical register, executive summary dropped, client-only material removed.',
  status: 'active',
  version: SYSTEM_VERSION,
  audienceLabels: ['Engineering', 'Technical Lead'],
  registerOverride: 'technical',
  densityOverride: 'detailed',
  languageStyleOverride: 'consulting',
  sectionFilters: Object.freeze({
    exclude: ['client_only'],
  }) as AudienceProfile['sectionFilters'],
  blockFilters: Object.freeze({
    exclude: ['client_only'],
  }) as AudienceProfile['blockFilters'],
  executiveSummaryPolicy: 'drop',
  appendixPolicy: 'preserve',
  jargonPolicy: 'as_is',
  notes: 'System default — immutable.',
  createdBy: SYSTEM_ACTOR,
  createdAt: SYSTEM_TIMESTAMP,
  updatedAt: SYSTEM_TIMESTAMP,
  activatedBy: SYSTEM_ACTOR,
  activatedAt: SYSTEM_TIMESTAMP,
}) as AudienceProfile;

/**
 * PMO / Operational variant.
 *
 * Standard density, professional register, audience PMO + Project
 * team. Drops client-only sections (PMO doesn't need the client-facing
 * pitch) but keeps appendices and the executive summary.
 */
export const PMO_OPERATIONAL_PROFILE: AudienceProfile = Object.freeze({
  profileId: 'system_pmo_operational',
  organizationId: 'system',
  name: 'PMO / Operational',
  description:
    'PMO / project team variant. Standard density, professional register, client-only material removed.',
  status: 'active',
  version: SYSTEM_VERSION,
  audienceLabels: ['PMO', 'Project Team'],
  registerOverride: 'professional',
  densityOverride: 'standard',
  languageStyleOverride: 'consulting',
  sectionFilters: Object.freeze({
    exclude: ['client_only'],
  }) as AudienceProfile['sectionFilters'],
  blockFilters: Object.freeze({
    exclude: ['client_only'],
  }) as AudienceProfile['blockFilters'],
  executiveSummaryPolicy: 'preserve',
  appendixPolicy: 'preserve',
  jargonPolicy: 'as_is',
  notes: 'System default — immutable.',
  createdBy: SYSTEM_ACTOR,
  createdAt: SYSTEM_TIMESTAMP,
  updatedAt: SYSTEM_TIMESTAMP,
  activatedBy: SYSTEM_ACTOR,
  activatedAt: SYSTEM_TIMESTAMP,
}) as AudienceProfile;

/** Stable, ordered tuple of all system-default audience profiles. */
export const SYSTEM_AUDIENCE_PROFILES: readonly AudienceProfile[] = Object.freeze([
  BOARD_EXECUTIVE_PROFILE,
  CLIENT_EXTERNAL_PROFILE,
  ENGINEERING_TECHNICAL_PROFILE,
  PMO_OPERATIONAL_PROFILE,
]);

/** Lookup helper: returns the system profile with the given id, or `undefined`. */
export function getSystemAudienceProfile(profileId: string): AudienceProfile | undefined {
  return SYSTEM_AUDIENCE_PROFILES.find((profile) => profile.profileId === profileId);
}

/** Returns `true` if the profile id matches one of the four system seeds. */
export function isSystemAudienceProfileId(profileId: string): boolean {
  return SYSTEM_AUDIENCE_PROFILES.some((profile) => profile.profileId === profileId);
}
