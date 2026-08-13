/**
 * useIdeaBusinessCase — fetch/save hook for the Idea business-case schema
 * (Program D / epic E08). Backs `IdeaBusinessCaseSection.tsx`.
 *
 * Fail-open by design: a fetch error, a `null` (idea has no case yet) or a
 * missing table (migration `20260810_idea_business_case.sql` not yet
 * applied — see that file's header) all resolve to the same empty-but-fully-
 * shaped scaffold from `createEmptyIdeaBusinessCase`, so the panel always has
 * fourteen sections to render. `loadError` distinguishes "genuinely empty"
 * from "couldn't reach the server" for the UI to show honestly instead of
 * silently presenting an empty case as if nothing were wrong.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchIdeaBusinessCase, upsertIdeaBusinessCase } from '@/services/api/ideaBusinessCase.api';
import {
  BUSINESS_CASE_SECTION_ORDER,
  createEmptyIdeaBusinessCase,
  type BusinessCaseClaim,
  type BusinessCaseSourceRef,
  type IdeaBusinessCase,
  type IdeaBusinessCaseSections,
} from '@/types/ideaBusinessCase';

/** What a caller sends to save one section — content is required, lineage/claims are optional patches. */
export type BusinessCaseSectionPatch<K extends keyof IdeaBusinessCaseSections> = {
  content: IdeaBusinessCaseSections[K]['content'];
  lineage?: BusinessCaseSourceRef[];
  claims?: BusinessCaseClaim[];
};

export interface UseIdeaBusinessCaseResult {
  businessCase: IdeaBusinessCase;
  loading: boolean;
  saving: boolean;
  /** True when the last fetch failed (network/5xx) — distinct from "no case saved yet". */
  loadError: boolean;
  /** Non-null section keys — used for an honest "N of 14 sections started" count. */
  filledSectionCount: number;
  saveSection: <K extends keyof IdeaBusinessCaseSections>(
    key: K,
    patch: BusinessCaseSectionPatch<K>
  ) => Promise<boolean>;
}

/**
 * Per-section "did the user actually put something here" predicates — deliberately
 * NOT a generic deep-scan. A blanket `hasContent` over every field falsely counts
 * `evidenceAssumptionsGaps` (its `evidenceEnvelopeRef` pointer is populated by the
 * empty-state factory itself, never by the user) and `confidenceReadiness` /
 * `decisionRequested` (their `confidenceLevel: 'low'` / `outcome: 'pending'` enum
 * defaults are schema scaffolding, not user input) as "started" on a genuinely
 * untouched case — an honesty bug in a progress label that exists precisely to
 * avoid presenting fabricated specificity (§6.2 / doc 11 §3.5). These mirror the
 * same predicates each `SubCard`'s `complete` dot uses in `IdeaBusinessCaseSection.tsx`
 * — one source of truth for "is this section started" between the top counter and
 * the per-card indicator.
 */
const SECTION_FILLED_CHECK: {
  [K in keyof IdeaBusinessCaseSections]: (content: IdeaBusinessCaseSections[K]['content']) => boolean;
} = {
  problemBaseline: (c) => !!c.problemStatement.trim(),
  strategicObjective: (c) => !!c.objective.trim(),
  stakeholdersProcesses: (c) => c.stakeholders.length > 0,
  evidenceAssumptionsGaps: (c) => !!c.note?.trim(),
  alternatives: (c) => c.alternatives.length > 0,
  recommendation: (c) => !!c.chosenAlternativeId,
  benefitsDisbenefits: (c) => c.benefits.length > 0,
  costsResources: (c) => c.items.length > 0,
  operationalImpact: (c) => !!c.processChanges.trim(),
  risksControls: (c) => c.risks.length > 0,
  implementationHorizon: (c) => c.milestones.length > 0,
  kpis: (c) => c.kpis.length > 0,
  confidenceReadiness: (c) => !!c.readinessStage?.trim(),
  decisionRequested: (c) => !!c.question.trim(),
};

export function isSectionFilled<K extends keyof IdeaBusinessCaseSections>(
  key: K,
  content: IdeaBusinessCaseSections[K]['content']
): boolean {
  const check = SECTION_FILLED_CHECK[key] as (c: unknown) => boolean;
  try {
    return check(content);
  } catch {
    return false;
  }
}

export function useIdeaBusinessCase(
  ideaId: string,
  enabled: boolean
): UseIdeaBusinessCaseResult {
  const [businessCase, setBusinessCase] = useState<IdeaBusinessCase>(() =>
    createEmptyIdeaBusinessCase(ideaId, '')
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const requestedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !ideaId) return;
    if (requestedFor.current === ideaId) return;
    requestedFor.current = ideaId;
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    fetchIdeaBusinessCase(ideaId)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setBusinessCase(createEmptyIdeaBusinessCase(ideaId, ''));
          return;
        }
        setBusinessCase((prev) => ({
          ...prev,
          id: result.id,
          ideaId: result.ideaId,
          organizationId: result.organizationId,
          version: result.version,
          createdBy: result.createdBy,
          updatedBy: result.updatedBy,
          createdAt: result.createdAt,
          updatedAt: result.updatedAt,
          sections: { ...prev.sections, ...result.sections },
        }));
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ideaId, enabled]);

  const saveSection = useCallback(
    async <K extends keyof IdeaBusinessCaseSections>(
      key: K,
      patch: BusinessCaseSectionPatch<K>
    ): Promise<boolean> => {
      setSaving(true);
      try {
        const body = { [key as string]: patch } as Record<string, BusinessCaseSectionPatch<K>>;
        const result = await upsertIdeaBusinessCase(ideaId, body);
        setBusinessCase((prev) => ({
          ...prev,
          id: result.id,
          version: result.version,
          updatedBy: result.updatedBy,
          updatedAt: result.updatedAt,
          sections: { ...prev.sections, ...result.sections },
        }));
        return true;
      } catch {
        return false;
      } finally {
        setSaving(false);
      }
    },
    [ideaId]
  );

  const filledSectionCount = BUSINESS_CASE_SECTION_ORDER.filter((key) => {
    const content = businessCase.sections[key]?.content;
    return content !== undefined && isSectionFilled(key, content);
  }).length;

  return { businessCase, loading, saving, loadError, filledSectionCount, saveSection };
}
