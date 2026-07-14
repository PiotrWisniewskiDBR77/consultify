/**
 * Generic AI layer for OperationalToolData / ToolsetFlowData tools
 * (SOP, A3, SMED, DMS, Inventory, AI Discovery, Pain Explorer, RPA, Process Automation).
 *
 * These share `sections: Record<stepId, OperationalItem[]>` + an optional summary,
 * so ONE handler deepens all of them: AI-first full session + per-section suggestions
 * + final summary. Items are APPENDED (never overwrite the user's existing work).
 */
import type {
  InitiativeDraft,
  OperationalItem,
  OperationalToolData,
  ToolFlowResults,
  ToolsetFlowData,
  ToolType,
} from '@/store/useToolStore';

import type { ToolAiPendingAction } from './dynamicSwot';
import { GROUNDING_RULES_BOTH } from './groundingRules';
import { pickW2SummaryFields } from './w2SummaryFields';

export interface OperationalSectionMeta {
  id: string;
  name: string;
  description?: string;
}

const makeId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const LEVELS = ['high', 'medium', 'low'] as const;
const level = (value: unknown, fallback: 'high' | 'medium' | 'low' = 'medium') =>
  LEVELS.includes(value as any) ? (value as 'high' | 'medium' | 'low') : fallback;

const toNumberOrUndefined = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const EVIDENCE_TYPES = ['fact', 'observation', 'assumption', 'hypothesis'] as const;
const STATES = ['proposed', 'confirmed', 'rejected'] as const;

const parseItems = (raw: unknown): OperationalItem[] =>
  Array.isArray(raw)
    ? raw
        .filter((item) => item && (item.title || item.description))
        .map((item) => ({
          id: makeId('op'),
          title: String(item.title || ''),
          description: String(item.description || ''),
          impact: level(item.impact),
          effort: level(item.effort),
          ...(item.category ? { category: String(item.category) } : {}),
          ...(toNumberOrUndefined(item.durationMinutes) !== undefined
            ? { durationMinutes: toNumberOrUndefined(item.durationMinutes) }
            : {}),
          ...(item.owner ? { owner: String(item.owner) } : {}),
          ...(item.target ? { target: String(item.target) } : {}),
          ...(item.frequency ? { frequency: String(item.frequency) } : {}),
          ...(item.threshold ? { threshold: String(item.threshold) } : {}),
          // W4 fix: pass through grounding metadata so the GROUNDING_RULES
          // hypothesis/derivation markers survive from the AI response into
          // the stored item instead of being silently dropped here.
          ...(toNumberOrUndefined(item.confidence) !== undefined
            ? { confidence: toNumberOrUndefined(item.confidence) }
            : {}),
          ...(EVIDENCE_TYPES.includes(item.evidenceType)
            ? { evidenceType: item.evidenceType as (typeof EVIDENCE_TYPES)[number] }
            : {}),
          ...(item.derivation ? { derivation: String(item.derivation) } : {}),
          ...(item.rationale ? { rationale: String(item.rationale) } : {}),
          ...(STATES.includes(item.state) ? { state: item.state as (typeof STATES)[number] } : {}),
          ...(typeof item.requires_evidence === 'boolean'
            ? { requires_evidence: item.requires_evidence }
            : {}),
        }))
    : [];

export function buildOperationalFullSessionPrompt(
  data: OperationalToolData | undefined,
  sections: OperationalSectionMeta[],
  toolName: string,
  orgContext: string
): string {
  const ctx = (data?.context || {}) as Record<string, unknown>;
  const sectionSpec = sections
    .map((s) => `  "${s.id}": [ /* ${s.name}${s.description ? ` — ${s.description}` : ''} */ ]`)
    .join(',\n');

  return `You are a senior operations consultant running a "${toolName}" engagement.
Produce a COMPLETE, consulting-grade first draft the client can review and refine.

=== BRIEF ===
- Goal: ${ctx.goal || 'not yet defined'}
- Scope: ${ctx.scope || 'not yet defined'}
- Success signal: ${ctx.successSignal || 'not yet defined'}
- Constraints: ${ctx.constraints || 'none specified'}

=== ORGANIZATION CONTEXT ===
${orgContext}
=== END CONTEXT ===

For EACH section below, generate 3-6 concrete, specific items grounded in the context above.
Each item: a clear title, an actionable description, and impact/effort ratings.
Where relevant also set category, owner, target, frequency, threshold, or durationMinutes.
Ground every claim in the context; flag explicit assumptions. Do not invent fake data.

${GROUNDING_RULES_BOTH}

Return ONE JSON object with this exact structure:
{
  "sections": {
${sectionSpec}
  },
  "summary": {
    "executiveSummary": "...",
    "keyInsights": ["..."],
    "appliedConclusions": ["..."]
  },
  "initiatives": [
    {"title": "...", "description": "...", "type": "operational|strategic|growth|defensive", "estimatedImpact": "high|medium|low", "estimatedEffort": "high|medium|low", "rationale": "...", "linkedItems": ["section-item-title-or-id"]}
  ]
}

Each initiative MUST set "linkedItems": an array naming the section item(s) it traces back to (use the item's title if no id is visible) — this is how the client sees WHY the initiative exists. Never leave it out; use [] only if the initiative genuinely has no direct item behind it.

Each section array item shape (confidence/evidenceType/derivation/rationale/state/requires_evidence are OPTIONAL but REQUIRED whenever the item carries a number or claim not present verbatim in the context — see GROUNDING RULES above):
{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low", "category": "...", "owner": "...", "target": "...", "frequency": "...", "threshold": "...", "durationMinutes": 0, "confidence": 1-5, "evidenceType": "fact|observation|assumption|hypothesis", "derivation": "numerator/denominator behind any number in this item, or omit if none", "rationale": "...", "state": "proposed|confirmed|rejected", "requires_evidence": false}`;
}

interface OperationalActionHandlers {
  updateInputData: (data: Partial<ToolsetFlowData>) => void;
  setInitiatives: (initiatives: Omit<InitiativeDraft, 'id'>[]) => void;
  setSessionGenerationStatus: (status: 'idle' | 'generating' | 'ready' | 'error') => void;
}

// ToolsetFlowData tools (ai-discovery, pain-explorer, rpa-scanner, process-automation)
// surface the final summary from flow.results, NOT data.summary. Populate both so
// the finalize output is never silently dropped for either UI shape.
const buildFlowResults = (parsed: Record<string, any>): ToolFlowResults => {
  const summaryObj = parsed.summary && typeof parsed.summary === 'object' ? parsed.summary : null;
  const initiatives = Array.isArray(parsed.initiatives) ? parsed.initiatives : [];
  const keyFindings = Array.isArray(summaryObj?.keyInsights)
    ? summaryObj.keyInsights.filter(Boolean)
    : Array.isArray(parsed.insights)
      ? parsed.insights.filter(Boolean)
      : [];
  const titlesWhere = (pred: (i: any) => boolean) =>
    initiatives
      .filter(pred)
      .map((i: any) => String(i.title || ''))
      .filter(Boolean);
  return {
    executiveSummary:
      typeof summaryObj?.executiveSummary === 'string'
        ? summaryObj.executiveSummary
        : typeof parsed.summary === 'string'
          ? parsed.summary
          : '',
    keyFindings,
    quickWins: titlesWhere((i) => i.estimatedEffort === 'low'),
    strategicBets: titlesWhere((i) => i.estimatedImpact === 'high'),
    prerequisites: Array.isArray(summaryObj?.appliedConclusions)
      ? summaryObj.appliedConclusions.filter(Boolean)
      : [],
    risks: [],
    dependencies: [],
  };
};

interface ApplyOperationalPendingActionOptions {
  pendingAction: ToolAiPendingAction;
  parsed: Record<string, any>;
  currentStepId?: string;
  operationalData: OperationalToolData;
  toolType: ToolType;
  actions: OperationalActionHandlers;
}

const buildSummary = (
  parsed: Record<string, any>,
  toolType: ToolType
): OperationalToolData['summary'] => {
  const summaryObj = parsed.summary && typeof parsed.summary === 'object' ? parsed.summary : null;
  const initiatives = Array.isArray(parsed.initiatives) ? parsed.initiatives : [];
  return {
    ...pickW2SummaryFields(summaryObj),
    executiveSummary:
      typeof summaryObj?.executiveSummary === 'string'
        ? summaryObj.executiveSummary
        : typeof parsed.summary === 'string'
          ? parsed.summary
          : '',
    keyInsights: Array.isArray(summaryObj?.keyInsights)
      ? summaryObj.keyInsights.filter(Boolean)
      : Array.isArray(parsed.insights)
        ? parsed.insights.filter(Boolean)
        : [],
    appliedConclusions: Array.isArray(summaryObj?.appliedConclusions)
      ? summaryObj.appliedConclusions.filter(Boolean)
      : Array.isArray(parsed.appliedConclusions)
        ? parsed.appliedConclusions.filter(Boolean)
        : [],
    recommendedInitiatives: initiatives.map((initiative: any) => ({
      id: '',
      title: initiative.title || '',
      description: initiative.description || '',
      type: initiative.type || 'operational',
      source: toolType,
      linkedItems: initiative.linkedItems || [],
      estimatedImpact: initiative.estimatedImpact || 'medium',
      estimatedEffort: initiative.estimatedEffort || 'medium',
      rationale: initiative.rationale || '',
    })),
  };
};

const setInitiativesFromParsed = (
  parsed: Record<string, any>,
  toolType: ToolType,
  actions: OperationalActionHandlers
) => {
  const initiatives = Array.isArray(parsed.initiatives) ? parsed.initiatives : [];
  if (!initiatives.length) return;
  actions.setInitiatives(
    initiatives.map((initiative: any) => ({
      title: initiative.title || '',
      description: initiative.description || '',
      type: initiative.type || 'operational',
      source: toolType,
      linkedItems: initiative.linkedItems || [],
      estimatedImpact: initiative.estimatedImpact || 'medium',
      estimatedEffort: initiative.estimatedEffort || 'medium',
      rationale: initiative.rationale || '',
    }))
  );
};

export function applyOperationalPendingAction({
  pendingAction,
  parsed,
  currentStepId,
  operationalData,
  toolType,
  actions,
}: ApplyOperationalPendingActionOptions): { clearRethinkTarget?: boolean } {
  const existingSections = operationalData?.sections || {};

  // Per-section suggestions: append AI items to the current section.
  if (pendingAction === 'suggestions' && currentStepId && currentStepId in existingSections) {
    const items = parseItems(parsed.items ?? parsed.sections?.[currentStepId]);
    if (items.length) {
      actions.updateInputData({
        sections: {
          ...existingSections,
          [currentStepId]: [...(existingSections[currentStepId] || []), ...items],
        },
      });
    }
    return {};
  }

  // Full session: fill every section + summary + initiatives.
  if (pendingAction === 'full-session') {
    const parsedSections =
      parsed.sections && typeof parsed.sections === 'object' ? parsed.sections : {};
    const nextSections: Record<string, OperationalItem[]> = { ...existingSections };
    Object.keys(existingSections).forEach((sectionId) => {
      const items = parseItems(parsedSections[sectionId]);
      if (items.length) {
        nextSections[sectionId] = [...(existingSections[sectionId] || []), ...items];
      }
    });
    actions.updateInputData({
      sections: nextSections,
      summary: buildSummary(parsed, toolType),
      flow: {
        ...(operationalData as ToolsetFlowData).flow,
        results: buildFlowResults(parsed),
      },
    });
    setInitiativesFromParsed(parsed, toolType, actions);
    actions.setSessionGenerationStatus('ready');
    return {};
  }

  // Finalize: summary + initiatives (+ flow.results for ToolsetFlow tools).
  if (pendingAction === 'summary') {
    actions.updateInputData({
      summary: buildSummary(parsed, toolType),
      flow: {
        ...(operationalData as ToolsetFlowData).flow,
        results: buildFlowResults(parsed),
      },
    });
    setInitiativesFromParsed(parsed, toolType, actions);
    return {};
  }

  return {};
}
