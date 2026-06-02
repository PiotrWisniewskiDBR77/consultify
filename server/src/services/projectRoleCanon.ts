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
  PROJECT_SPONSOR: 'PROJECT_SPONSOR',
  PROJECT_LEADER: 'PROJECT_LEADER',
  TASK_ASSIGNEE: 'TASK_ASSIGNEE',
  OBSERVER: 'OBSERVER',
  PMO: 'PMO',
  INITIATIVE_OWNER: 'INITIATIVE_OWNER',
  WORKSTREAM_OWNER: 'WORKSTREAM_OWNER',
  REVIEWER: 'REVIEWER',
  SME: 'SME',
  CONSULTANT: 'CONSULTANT',
  BUSINESS_OWNER: 'BUSINESS_OWNER',
  STEERING_COMMITTEE: 'STEERING_COMMITTEE',
} as const;

export type CanonicalProjectRoleType =
  (typeof CanonicalProjectRole)[keyof typeof CanonicalProjectRole];

export const CANONICAL_PROJECT_ROLE_LABELS: Record<
  CanonicalProjectRoleType,
  { en: string; pl: string; descriptionEn: string; descriptionPl: string }
> = {
  PROJECT_SPONSOR: {
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
  TASK_ASSIGNEE: {
    en: 'Task Assignee',
    pl: 'Wykonawca zadania',
    descriptionEn: 'Executes assigned work and updates own task progress.',
    descriptionPl: 'Wykonuje przypisana prace i aktualizuje postep swoich zadan.',
  },
  OBSERVER: {
    en: 'Observer',
    pl: 'Obserwator',
    descriptionEn: 'Read-only project participant.',
    descriptionPl: 'Uczestnik projektu tylko do odczytu.',
  },
  PMO: {
    en: 'Project Office (PMO)',
    pl: 'Project Office (PMO)',
    descriptionEn: 'Governance and standards control; typically invoked on triggers.',
    descriptionPl: 'Kontrola governance i standardow; zwykle wywolywane na triggerach.',
  },
  INITIATIVE_OWNER: {
    en: 'Initiative Owner',
    pl: 'Właściciel inicjatywy',
    descriptionEn: 'Owns delivery of a specific initiative area; plans and reports progress.',
    descriptionPl:
      'Odpowiada za realizację konkretnej inicjatywy/obszaru; planuje i raportuje postęp.',
  },
  WORKSTREAM_OWNER: {
    en: 'Workstream Owner',
    pl: 'Wlasciciel strumienia',
    descriptionEn: 'Owns delivery for a scoped workstream or domain.',
    descriptionPl: 'Odpowiada za realizacje w swoim strumieniu albo domenie.',
  },
  REVIEWER: {
    en: 'Reviewer',
    pl: 'Reviewer',
    descriptionEn: 'Reviews submissions, tasks, interviews, and deliverables when delegated.',
    descriptionPl: 'Recenzuje submissions, taski, interview i deliverables po delegacji.',
  },
  SME: {
    en: 'Subject Matter Expert',
    pl: 'Ekspert merytoryczny',
    descriptionEn: 'Provides expert input without default delivery authority.',
    descriptionPl: 'Dostarcza input ekspercki bez domyslnej wladzy delivery.',
  },
  CONSULTANT: {
    en: 'Consultant',
    pl: 'Konsultant',
    descriptionEn: 'Internal or external consultant working in a project scope.',
    descriptionPl: 'Konsultant wewnetrzny albo zewnetrzny pracujacy w zakresie projektu.',
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
  if (['PROJECT_EXECUTIVE', 'PROJECT_SPONSOR', 'SPONSOR'].includes(r)) {
    return 'PROJECT_SPONSOR';
  }

  // Project leader (delivery commander): accept common synonyms
  if (['PROJECT_LEAD', 'PROJECT_LEADER', 'PROJECT_MANAGER', 'MANAGER', 'TEAM_LEAD'].includes(r)) {
    return 'PROJECT_LEADER';
  }

  if (['PMO', 'PMO_LEAD', 'PMO_SUPPORT'].includes(r)) return 'PMO';

  if (['INITIATIVE_OWNER'].includes(r)) return 'INITIATIVE_OWNER';

  if (['WORKSTREAM_OWNER'].includes(r)) return 'WORKSTREAM_OWNER';

  if (['TEAM_MEMBER', 'TASK_ASSIGNEE', 'DEVELOPER', 'ANALYST'].includes(r)) {
    return 'TASK_ASSIGNEE';
  }

  if (['OBSERVER', 'VIEWER', 'STAKEHOLDER', 'CLIENT'].includes(r)) return 'OBSERVER';
  if (['REVIEWER', 'DECISION_OWNER'].includes(r)) return 'REVIEWER';
  if (['SME'].includes(r)) return 'SME';
  if (['CONSULTANT'].includes(r)) return 'CONSULTANT';

  if (['BUSINESS_OWNER', 'SENIOR_USER'].includes(r)) return 'BUSINESS_OWNER';

  if (['STEERING_COMMITTEE', 'STEERING_BOARD'].includes(r)) return 'STEERING_COMMITTEE';

  return null;
}
