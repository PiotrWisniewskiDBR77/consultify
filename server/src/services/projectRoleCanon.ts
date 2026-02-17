/**
 * Project Role Canon (v1)
 *
 * Canonical project-level roles used for permissions, governance, and UI semantics.
 * This is intentionally independent from legacy/expanded role sets that exist in:
 * - src/types/core.ts (ProjectRole)
 * - server/src/services/projectMemberService.ts (PROJECT_ROLES)
 * - server/src/constants/initiativeStatuses.ts (gate roles)
 *
 * Those can be mapped into the canon via helpers below.
 */
export const CanonicalProjectRole = {
  SPONSOR: 'SPONSOR',
  PROJECT_LEADER: 'PROJECT_LEADER',
  INITIATIVE_OWNER: 'INITIATIVE_OWNER',
  TEAM_MEMBER: 'TEAM_MEMBER',
  PMO: 'PMO',
  PORTFOLIO_OWNER: 'PORTFOLIO_OWNER',
  BUSINESS_OWNER: 'BUSINESS_OWNER',
  STEERING_COMMITTEE: 'STEERING_COMMITTEE',
} as const;

export type CanonicalProjectRoleType =
  (typeof CanonicalProjectRole)[keyof typeof CanonicalProjectRole];

export const CANONICAL_PROJECT_ROLE_LABELS: Record<
  CanonicalProjectRoleType,
  { en: string; pl: string; descriptionEn: string; descriptionPl: string }
> = {
  SPONSOR: {
    en: 'Sponsor (Business Owner)',
    pl: 'Sponsor (Właściciel biznesowy)',
    descriptionEn: 'Owns business goal and ROI; approves budget and key decisions.',
    descriptionPl: 'Odpowiada za cel biznesowy i ROI; zatwierdza budżet i kluczowe decyzje.',
  },
  PROJECT_LEADER: {
    en: 'Project Leader',
    pl: 'Project Leader',
    descriptionEn: 'Operational leader responsible for delivery, plan, schedule, and execution.',
    descriptionPl: 'Operacyjny dowódca odpowiedzialny za delivery, plan, harmonogram i wykonanie.',
  },
  INITIATIVE_OWNER: {
    en: 'Initiative Owner',
    pl: 'Właściciel inicjatywy',
    descriptionEn: 'Owns delivery of a specific initiative area; plans and reports progress.',
    descriptionPl:
      'Odpowiada za realizację konkretnej inicjatywy/obszaru; planuje i raportuje postęp.',
  },
  TEAM_MEMBER: {
    en: 'Team Member',
    pl: 'Członek zespołu',
    descriptionEn: 'Executes assigned work and updates progress.',
    descriptionPl: 'Wykonuje pracę i aktualizuje postęp.',
  },
  PMO: {
    en: 'Project Office (PMO)',
    pl: 'Project Office (PMO)',
    descriptionEn: 'Governance and standards control; typically invoked on triggers.',
    descriptionPl: 'Kontrola governance i standardów; zwykle wywoływane na triggerach.',
  },
  PORTFOLIO_OWNER: {
    en: 'Portfolio Owner',
    pl: 'Właściciel portfela',
    descriptionEn:
      'Investment-level decisions across projects: start/stop, budget allocation, priorities.',
    descriptionPl:
      'Decyzje inwestycyjne ponad projektami: start/stop, alokacja budżetu, priorytety.',
  },
  BUSINESS_OWNER: {
    en: 'Business Owner (Benefits)',
    pl: 'Business Owner (Korzyści)',
    descriptionEn: 'Owns benefits tracking and KPI outcomes.',
    descriptionPl: 'Odpowiada za tracking korzyści i KPI.',
  },
  STEERING_COMMITTEE: {
    en: 'Steering Board / Committee',
    pl: 'Steering Board / Komitet sterujący',
    descriptionEn: 'Optional governance body for strategic approvals and escalations.',
    descriptionPl: 'Opcjonalny organ governance do zatwierdzeń strategicznych i eskalacji.',
  },
};

export const ConsultantProfile = {
  NONE: 'NONE',
  EXTERNAL: 'EXTERNAL',
  PARTNER: 'PARTNER',
  INTERNAL: 'INTERNAL',
} as const;

export type ConsultantProfileType = (typeof ConsultantProfile)[keyof typeof ConsultantProfile];

export const ConsultantEngagementType = {
  INTERNAL: 'INTERNAL',
  INVITED_BY_CLIENT: 'INVITED_BY_CLIENT',
  CONSULTANT_LED_ONBOARDING: 'CONSULTANT_LED_ONBOARDING',
} as const;

export type ConsultantEngagementTypeValue =
  (typeof ConsultantEngagementType)[keyof typeof ConsultantEngagementType];

export function normalizeUpper(value: unknown): string {
  return String(value || '')
    .trim()
    .toUpperCase();
}

/**
 * Map legacy/expanded project roles into the canonical set.
 * Used for migration/backfill and for compatibility while multiple role sources exist.
 */
export function mapToCanonicalProjectRole(role: unknown): CanonicalProjectRoleType | null {
  const r = normalizeUpper(role);
  if (!r) return null;

  // Direct canon matches
  if ((Object.values(CanonicalProjectRole) as string[]).includes(r)) {
    return r as CanonicalProjectRoleType;
  }

  // Legacy mappings (frontend/core.ts, older DBs, or earlier role sets)
  if (['PROJECT_EXECUTIVE', 'PROJECT_SPONSOR', 'SPONSOR'].includes(r)) return 'SPONSOR';

  // Project leader (delivery commander): accept common synonyms
  if (
    [
      'PROJECT_LEAD',
      'PROJECT_LEADER',
      'PROJECT_MANAGER',
      'PMO_LEAD', // legacy: often used as project manager in delivery
      'MANAGER',
      'TEAM_LEAD',
      'WORKSTREAM_OWNER',
    ].includes(r)
  ) {
    return 'PROJECT_LEADER';
  }

  if (['INITIATIVE_OWNER'].includes(r)) return 'INITIATIVE_OWNER';

  if (['TEAM_MEMBER', 'TASK_ASSIGNEE', 'DEVELOPER', 'ANALYST', 'SME'].includes(r)) {
    return 'TEAM_MEMBER';
  }

  if (['PMO', 'PMO_SUPPORT'].includes(r)) return 'PMO';

  if (['PORTFOLIO_OWNER'].includes(r)) return 'PORTFOLIO_OWNER';

  if (['BUSINESS_OWNER', 'SENIOR_USER'].includes(r)) return 'BUSINESS_OWNER';

  if (['STEERING_COMMITTEE', 'STEERING_BOARD'].includes(r)) return 'STEERING_COMMITTEE';

  return null;
}
