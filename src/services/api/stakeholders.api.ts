/**
 * Stakeholder Registry API Module (Zwornik Delta A)
 *
 * SSOT: Harvard/wdrozenie-100/_KONCEPT_ZWORNIK_2026-07-10.md, §3.
 * Backend: server/src/routes/pmo/stakeholders.routes.ts (mounted at
 * `/api/stakeholders` and `/api/pmo/stakeholders`).
 *
 * NOTE (TODO, see handoff to nadzorca): no FE view consumes this yet — this
 * module is the typed client contract for the future registry screen and
 * for the F12 initiative-wizard "Stakeholderzy" step. Confidential fields
 * (influenceLevel/interestLevel/engagementStatus/notes) come back `null`
 * with `assessmentRedacted: true` when the caller lacks
 * `stakeholder.assessment.view` — render accordingly, don't assume presence.
 */

import { apiDelete, apiGet, apiPatch, apiPost } from './baseClient';

export type StakeholderCategory =
  | 'INTERNAL'
  | 'EXTERNAL'
  | 'CLIENT'
  | 'REGULATOR'
  | 'PARTNER'
  | 'OTHER';

export type RaciType = 'R' | 'A' | 'C' | 'I';

export type EngagementStatus = 'UNAWARE' | 'RESISTANT' | 'NEUTRAL' | 'SUPPORTIVE' | 'LEADING';

export interface StakeholderRegistryEntry {
  id: string;
  organizationId: string;
  userId: string | null;
  externalName: string | null;
  externalEmail: string | null;
  orgUnit: string | null;
  category: StakeholderCategory;
  defaultInfluence: number | null;
  defaultInterest: number | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  engagementCount?: number;
  /** true when the caller lacks `stakeholder.assessment.view` (§3.5, P-2). */
  assessmentRedacted?: boolean;
}

export interface StakeholderEngagement {
  id: string;
  organizationId: string;
  stakeholderId: string;
  /** null = org-level baseline engagement. */
  projectId: string | null;
  role: string | null;
  raciType: RaciType | null;
  influenceLevel: number | null;
  interestLevel: number | null;
  engagementStatus: EngagementStatus | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  projectName?: string | null;
  assessmentRedacted?: boolean;
}

export interface EffectiveStakeholder extends StakeholderEngagement {
  userId: string | null;
  externalName: string | null;
  externalEmail: string | null;
  category?: StakeholderCategory | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  /** true when this row is inherited (read-time only, no DB copy) — §3.3. */
  inherited: boolean;
}

export interface InitiativeEffectiveStakeholder {
  source: 'initiative' | 'inherited_project' | 'inherited_org';
  inherited: boolean;
  id: string | null;
  registryId: string | null;
  userId: string | null;
  externalName: string | null;
  externalEmail: string | null;
  role: string | null;
  raciType: RaciType | null;
  influenceLevel: number | null;
  interestLevel: number | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  assessmentRedacted?: boolean;
}

export interface PrefillCandidate {
  registryId: string;
  userId: string | null;
  externalName: string | null;
  externalEmail: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  suggestedRole: string | null;
  suggestedRaciType: RaciType | null;
  influenceLevel: number | null;
  interestLevel: number | null;
  inherited: boolean;
  assessmentRedacted?: boolean;
}

export interface CreateStakeholderInput {
  userId?: string | null;
  externalName?: string | null;
  externalEmail?: string | null;
  orgUnit?: string | null;
  category?: StakeholderCategory | null;
  defaultInfluence?: number | null;
  defaultInterest?: number | null;
  notes?: string | null;
}

export interface UpsertEngagementInput {
  /** null (or omitted) = org-level baseline engagement. */
  projectId?: string | null;
  role?: string | null;
  raciType?: RaciType | null;
  influenceLevel?: number | null;
  interestLevel?: number | null;
  engagementStatus?: EngagementStatus | null;
  notes?: string | null;
}

export const StakeholderApi = {
  // ==========================================
  // REGISTRY (identity, org-level)
  // ==========================================

  listRegistry: async (): Promise<StakeholderRegistryEntry[]> => {
    const data = await apiGet<{ stakeholders: StakeholderRegistryEntry[] }>(
      '/stakeholders',
      'Failed to fetch stakeholder registry'
    );
    return data.stakeholders;
  },

  getStakeholder: async (id: string): Promise<StakeholderRegistryEntry> => {
    const data = await apiGet<{ stakeholder: StakeholderRegistryEntry }>(
      `/stakeholders/${id}`,
      'Failed to fetch stakeholder'
    );
    return data.stakeholder;
  },

  createStakeholder: async (
    input: CreateStakeholderInput
  ): Promise<StakeholderRegistryEntry> => {
    const data = await apiPost<{ stakeholder: StakeholderRegistryEntry }>(
      '/stakeholders',
      input,
      'Failed to create stakeholder'
    );
    return data.stakeholder;
  },

  updateStakeholder: async (
    id: string,
    updates: Partial<CreateStakeholderInput>
  ): Promise<StakeholderRegistryEntry> => {
    const data = await apiPatch<{ stakeholder: StakeholderRegistryEntry }>(
      `/stakeholders/${id}`,
      updates,
      'Failed to update stakeholder'
    );
    return data.stakeholder;
  },

  deleteStakeholder: async (id: string): Promise<void> => {
    await apiDelete(`/stakeholders/${id}`, 'Failed to delete stakeholder');
  },

  // ==========================================
  // ENGAGEMENTS (RACI + influence/interest per context)
  // ==========================================

  listEngagements: async (stakeholderId: string): Promise<StakeholderEngagement[]> => {
    const data = await apiGet<{ engagements: StakeholderEngagement[] }>(
      `/stakeholders/${stakeholderId}/engagements`,
      'Failed to fetch engagements'
    );
    return data.engagements;
  },

  /** Create or update the (stakeholder, project) engagement — one row per context. */
  upsertEngagement: async (
    stakeholderId: string,
    input: UpsertEngagementInput
  ): Promise<{ id: string }> => {
    return apiPost<{ id: string }>(
      `/stakeholders/${stakeholderId}/engagements`,
      input,
      'Failed to save engagement'
    );
  },

  updateEngagement: async (
    engagementId: string,
    updates: Partial<UpsertEngagementInput>
  ): Promise<StakeholderEngagement> => {
    const data = await apiPatch<{ engagement: StakeholderEngagement }>(
      `/stakeholders/engagements/${engagementId}`,
      updates,
      'Failed to update engagement'
    );
    return data.engagement;
  },

  deleteEngagement: async (engagementId: string): Promise<void> => {
    await apiDelete(`/stakeholders/engagements/${engagementId}`, 'Failed to delete engagement');
  },

  // ==========================================
  // EFFECTIVE / INHERITANCE READ-MODELS (§3.3) + F12 prefill hook
  // ==========================================

  getProjectEffectiveStakeholders: async (
    projectId: string
  ): Promise<EffectiveStakeholder[]> => {
    const data = await apiGet<{ stakeholders: EffectiveStakeholder[] }>(
      `/stakeholders/project/${projectId}/effective`,
      'Failed to fetch project stakeholders'
    );
    return data.stakeholders;
  },

  /** F12 wizard hook: candidates to prefill the initiative "Stakeholderzy" step. */
  getProjectPrefillCandidates: async (projectId: string): Promise<PrefillCandidate[]> => {
    const data = await apiGet<{ candidates: PrefillCandidate[] }>(
      `/stakeholders/project/${projectId}/prefill`,
      'Failed to fetch stakeholder prefill candidates'
    );
    return data.candidates;
  },

  getInitiativeEffectiveStakeholders: async (
    initiativeId: string
  ): Promise<InitiativeEffectiveStakeholder[]> => {
    const data = await apiGet<{ stakeholders: InitiativeEffectiveStakeholder[] }>(
      `/stakeholders/initiative/${initiativeId}/effective`,
      'Failed to fetch initiative effective stakeholders'
    );
    return data.stakeholders;
  },
};
