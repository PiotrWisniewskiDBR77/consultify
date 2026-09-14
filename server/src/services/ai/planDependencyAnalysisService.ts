import { z } from 'zod';

import logger from '../../utils/Logger.js';

export type PlanDependencyKind = 'ABSOLUTE' | 'CONDITIONAL';

export interface PlanDependencyAnalysisInitiative {
  id: string;
  title: string;
  status: string;
  summary: string | null;
  problemStatement: string | null;
  hypothesis: string | null;
  businessValue: string | null;
  scopeIn: unknown;
  scopeOut: unknown;
  deliverables: unknown;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  existingDependencies: Array<{ predecessorId: string; relationType: string }>;
}

export interface PlanDependencyAnalysisInput {
  scenarioId: string;
  scenarioVersion: number;
  timezone: string;
  horizon: { start: string; end: string };
  initiatives: PlanDependencyAnalysisInitiative[];
}

export interface PlanDependencyObservation {
  observationId: string;
  predecessorId: string;
  successorId: string;
  kind: PlanDependencyKind;
  condition: string | null;
  rationale: string;
  evidenceRefs: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface PlanCriticalPath {
  pathId: string;
  kind: PlanDependencyKind;
  initiativeIds: string[];
  condition: string | null;
  rationale: string;
}

export interface PlanDependencyAnalysisResult {
  source: 'AI';
  model: string;
  analyzedAt: string;
  inputScenarioVersion: number;
  observations: PlanDependencyObservation[];
  criticalPaths: PlanCriticalPath[];
}

const ObservationSchema = z.object({
  observationId: z.string().trim().min(1).max(200),
  predecessorId: z.string().trim().min(1).max(255),
  successorId: z.string().trim().min(1).max(255),
  kind: z.enum(['ABSOLUTE', 'CONDITIONAL']),
  condition: z.string().trim().min(1).max(2_000).nullable(),
  rationale: z.string().trim().min(1).max(4_000),
  evidenceRefs: z.array(z.string().trim().min(1).max(200)).min(1).max(12),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
});

const CriticalPathSchema = z.object({
  pathId: z.string().trim().min(1).max(200),
  kind: z.enum(['ABSOLUTE', 'CONDITIONAL']),
  initiativeIds: z.array(z.string().trim().min(1).max(255)).min(2).max(100),
  condition: z.string().trim().min(1).max(2_000).nullable(),
  rationale: z.string().trim().min(1).max(4_000),
});

const ResponseSchema = z.object({
  observations: z.array(ObservationSchema).max(500),
  criticalPaths: z.array(CriticalPathSchema).max(100),
});

const ALLOWED_EVIDENCE_REFS = new Set([
  'title',
  'status',
  'summary',
  'problemStatement',
  'hypothesis',
  'businessValue',
  'scopeIn',
  'scopeOut',
  'deliverables',
  'plannedStartDate',
  'plannedEndDate',
  'existingDependencies',
]);

export class PlanDependencyAnalysisError extends Error {
  constructor(
    message: string,
    readonly code: 'AI_UNAVAILABLE' | 'AI_RESPONSE_INVALID'
  ) {
    super(message);
    this.name = 'PlanDependencyAnalysisError';
  }
}

let llmInstance: any = null;
async function getLlm(): Promise<any> {
  if (llmInstance) return llmInstance;
  try {
    const module = await import('./llmService.js');
    llmInstance = (module as any).llmService || (module as any).default;
    return llmInstance;
  } catch {
    return null;
  }
}

export function __resetPlanDependencyAnalysisLlmForTests(): void {
  llmInstance = null;
}

const systemPrompt = `You are a senior transformation-program planner. Analyze only the supplied initiative snapshot.
Return JSON only, with exactly two arrays: observations and criticalPaths.

An observation is a directed predecessor contract: predecessorId must finish or reach its stated outcome before successorId can proceed.
- ABSOLUTE means the successor is not logically viable without the predecessor. condition must be null.
- CONDITIONAL means the dependency applies only under a concrete business or delivery condition. condition must state that condition.
- Never invent initiative IDs, facts, dates, constraints, people, or evidence.
- Each observation must cite one or more supplied field names in evidenceRefs.
- Do not infer a dependency from similar titles alone. Use LOW confidence when evidence is incomplete.
- Do not create self-dependencies, duplicate edges, or cycles.

criticalPaths must contain ordered initiative IDs connected by the observations. An ABSOLUTE path may contain only ABSOLUTE edges. A CONDITIONAL path must state the condition that activates it. If the evidence does not support a path, return an empty array.`;

function parseJsonContent(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return JSON.parse(fenced?.[1] ?? content);
}

function assertAcyclic(observations: PlanDependencyObservation[]): void {
  const predecessors = new Map<string, string[]>();
  for (const item of observations) {
    const current = predecessors.get(item.successorId) ?? [];
    current.push(item.predecessorId);
    predecessors.set(item.successorId, current);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return false;
    if (visited.has(id)) return true;
    visiting.add(id);
    for (const predecessor of predecessors.get(id) ?? []) if (!visit(predecessor)) return false;
    visiting.delete(id);
    visited.add(id);
    return true;
  };
  if ([...predecessors.keys()].some((id) => !visit(id))) {
    throw new PlanDependencyAnalysisError(
      'AI dependency graph contains a cycle',
      'AI_RESPONSE_INVALID'
    );
  }
}

export function validatePlanDependencyAnalysis(
  raw: unknown,
  input: PlanDependencyAnalysisInput
): Pick<PlanDependencyAnalysisResult, 'observations' | 'criticalPaths'> {
  const parsed = ResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new PlanDependencyAnalysisError(
      'AI dependency response does not match the contract',
      'AI_RESPONSE_INVALID'
    );
  }
  const ids = new Set(input.initiatives.map((initiative) => initiative.id));
  const observationIds = new Set<string>();
  const edgeKeys = new Set<string>();
  for (const observation of parsed.data.observations) {
    if (
      !ids.has(observation.predecessorId) ||
      !ids.has(observation.successorId) ||
      observation.predecessorId === observation.successorId ||
      observationIds.has(observation.observationId) ||
      observation.evidenceRefs.some((ref) => !ALLOWED_EVIDENCE_REFS.has(ref)) ||
      (observation.kind === 'ABSOLUTE' && observation.condition !== null) ||
      (observation.kind === 'CONDITIONAL' && observation.condition === null)
    ) {
      throw new PlanDependencyAnalysisError(
        'AI dependency observation is not grounded in the input snapshot',
        'AI_RESPONSE_INVALID'
      );
    }
    const edgeKey = `${observation.predecessorId}>${observation.successorId}`;
    if (edgeKeys.has(edgeKey)) {
      throw new PlanDependencyAnalysisError(
        'AI dependency response contains duplicate edges',
        'AI_RESPONSE_INVALID'
      );
    }
    observationIds.add(observation.observationId);
    edgeKeys.add(edgeKey);
  }
  assertAcyclic(parsed.data.observations);

  const paths = new Set<string>();
  for (const path of parsed.data.criticalPaths) {
    if (
      paths.has(path.pathId) ||
      path.initiativeIds.some((id) => !ids.has(id)) ||
      new Set(path.initiativeIds).size !== path.initiativeIds.length ||
      (path.kind === 'ABSOLUTE' && path.condition !== null) ||
      (path.kind === 'CONDITIONAL' && path.condition === null)
    ) {
      throw new PlanDependencyAnalysisError(
        'AI critical path is not grounded in the input snapshot',
        'AI_RESPONSE_INVALID'
      );
    }
    for (let index = 1; index < path.initiativeIds.length; index += 1) {
      const predecessorId = path.initiativeIds[index - 1];
      const successorId = path.initiativeIds[index];
      const edge = parsed.data.observations.find(
        (item) => item.predecessorId === predecessorId && item.successorId === successorId
      );
      if (!edge || (path.kind === 'ABSOLUTE' && edge.kind !== 'ABSOLUTE')) {
        throw new PlanDependencyAnalysisError(
          'AI critical path references an unsupported edge',
          'AI_RESPONSE_INVALID'
        );
      }
    }
    paths.add(path.pathId);
  }
  return parsed.data;
}

export async function analyzePlanDependencies(
  input: PlanDependencyAnalysisInput
): Promise<PlanDependencyAnalysisResult> {
  if (input.initiatives.length < 2) {
    return {
      source: 'AI',
      model: 'not-called-insufficient-initiatives',
      analyzedAt: new Date().toISOString(),
      inputScenarioVersion: input.scenarioVersion,
      observations: [],
      criticalPaths: [],
    };
  }
  const llm = await getLlm();
  if (!llm || typeof llm.call !== 'function') {
    throw new PlanDependencyAnalysisError('AI service is not configured', 'AI_UNAVAILABLE');
  }
  return analyzePlanDependenciesWithLlm(input, llm);
}

/** Explicit transport seam: tests prove that the production-shaped LLM call is made. */
export async function analyzePlanDependenciesWithLlm(
  input: PlanDependencyAnalysisInput,
  llm: { call: (params: Record<string, unknown>) => Promise<Record<string, unknown>> }
): Promise<PlanDependencyAnalysisResult> {
  let response: Record<string, unknown>;
  try {
    response = await llm.call({
      type: 'text',
      modelConfig: { id: 'premium' },
      systemPrompt,
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            scenarioId: input.scenarioId,
            scenarioVersion: input.scenarioVersion,
            timezone: input.timezone,
            horizon: input.horizon,
            initiatives: input.initiatives,
          }),
        },
      ],
      maxTokens: 4_000,
      temperature: 0.1,
      cache: false,
      timeoutMs: 90_000,
    });
  } catch (error) {
    logger.warn('[PlanDependencyAnalysis] LLM call failed', {
      scenarioId: input.scenarioId,
      name: error instanceof Error ? error.name : typeof error,
    });
    throw new PlanDependencyAnalysisError(
      'AI dependency analysis is unavailable',
      'AI_UNAVAILABLE'
    );
  }
  let raw: unknown;
  try {
    raw = parseJsonContent(String(response?.content ?? ''));
  } catch (error) {
    logger.warn('[PlanDependencyAnalysis] invalid JSON response', {
      scenarioId: input.scenarioId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new PlanDependencyAnalysisError(
      'AI dependency response is not valid JSON',
      'AI_RESPONSE_INVALID'
    );
  }
  const validated = validatePlanDependencyAnalysis(raw, input);
  return {
    source: 'AI',
    model: String(response?.model ?? response?.modelId ?? 'llm-premium'),
    analyzedAt: new Date().toISOString(),
    inputScenarioVersion: input.scenarioVersion,
    ...validated,
  };
}
