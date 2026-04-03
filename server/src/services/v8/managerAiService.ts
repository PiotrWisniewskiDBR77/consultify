/**
 * Manager AI Service
 *
 * Generates AI-powered recommendations for the 6 manager lanes.
 * Uses llmService for structured LLM calls with caching.
 */

import { z } from 'zod';
import llmService from '../ai/llmService.js';
import { getManagerProblems } from './managerProblemsService.js';

/* ────────────────────────────────────────────────────────────────────────────
   Response types
   ──────────────────────────────────────────────────────────────────────────── */

export interface AiStep {
  order: number;
  action: string;
  owner: string;
  timeframe: string;
  outcome: string;
}

export interface AiRecommendation {
  problemId: string;
  diagnosis: string;
  recommendation: string;
  steps: AiStep[];
  confidence: number;
  reasoning: string;
  alternativeApproach: string;
}

export interface AiTriageCluster {
  theme: string;
  severity: 'critical' | 'warning' | 'info';
  problemIds: string[];
  summary: string;
  suggestedAction: string;
}

export interface AiTriageResult {
  clusters: AiTriageCluster[];
  topPriority: string[];
  executiveSummary: string;
}

export interface AiManageAllResult {
  laneId: string;
  executiveSummary: string;
  clusters: Array<{
    theme: string;
    severity: 'critical' | 'warning' | 'info';
    diagnosis: string;
    steps: AiStep[];
    affectedProblemIds: string[];
  }>;
  quickWins: string[];
  escalationNeeded: string[];
}

/* ────────────────────────────────────────────────────────────────────────────
   Zod schemas for structured LLM output
   ──────────────────────────────────────────────────────────────────────────── */

const AiStepSchema = z.object({
  order: z.number(),
  action: z.string(),
  owner: z.string(),
  timeframe: z.string(),
  outcome: z.string(),
});

const SingleRecommendationSchema = z.object({
  diagnosis: z.string(),
  recommendation: z.string(),
  steps: z.array(AiStepSchema).max(5),
  confidence: z.number().min(0).max(100),
  reasoning: z.string(),
  alternativeApproach: z.string(),
});

const TriageSchema = z.object({
  clusters: z.array(z.object({
    theme: z.string(),
    severity: z.enum(['critical', 'warning', 'info']),
    problemIds: z.array(z.string()),
    summary: z.string(),
    suggestedAction: z.string(),
  })).max(10),
  topPriority: z.array(z.string()).max(5),
  executiveSummary: z.string(),
});

const ManageAllSchema = z.object({
  executiveSummary: z.string(),
  clusters: z.array(z.object({
    theme: z.string(),
    severity: z.enum(['critical', 'warning', 'info']),
    diagnosis: z.string(),
    steps: z.array(AiStepSchema).max(5),
    affectedProblemIds: z.array(z.string()),
  })).max(8),
  quickWins: z.array(z.string()).max(5),
  escalationNeeded: z.array(z.string()).max(5),
});

/* ────────────────────────────────────────────────────────────────────────────
   Lane-specific system prompts
   ──────────────────────────────────────────────────────────────────────────── */

const LANE_CONTEXT: Record<string, { role: string; focus: string }> = {
  'action-queue': {
    role: 'execution triage specialist',
    focus: 'overdue tasks, blocked items, overdue decisions, and critical issues that require immediate managerial attention. Prioritize by blast radius and critical path impact.',
  },
  decisions: {
    role: 'decision acceleration advisor',
    focus: 'pending, overdue, and deferred decisions. Generate decision briefs, recommend approve/reject/defer based on context, and identify downstream blocking impact.',
  },
  blockers: {
    role: 'blocker resolution specialist',
    focus: 'blocked initiatives, tasks, dependency blocks, and critical issues. Analyze root cause chains, propose workarounds, and draft escalation briefs.',
  },
  workload: {
    role: 'capacity optimization advisor',
    focus: 'overloaded team members, unassigned tasks, missing estimates, and upcoming deadlines. Propose reassignments, workload balancing, and estimate predictions.',
  },
  risk: {
    role: 'execution risk intelligence analyst',
    focus: 'open risks, missing baselines, overdue initiatives, and stale items. Recalibrate risk scores, generate mitigation plans, and detect emerging risk patterns.',
  },
  'people-change': {
    role: 'governance and change management advisor',
    focus: 'missing owners/sponsors, governance gaps, bus-factor risks, and date gaps. Recommend owner assignments, governance health improvements, and change readiness.',
  },
};

function buildSystemPrompt(laneId: string): string {
  const ctx = LANE_CONTEXT[laneId] || { role: 'management advisor', focus: 'all execution problems' };
  return `You are an experienced ${ctx.role} in a corporate transformation program management system.

Your focus area: ${ctx.focus}

Rules:
- Base your analysis ONLY on the data provided. Do not invent information.
- Be specific — reference entity names, dates, and numbers from the data.
- Steps must be concrete and actionable, not generic advice.
- Owners should reference actual people from the data when available, otherwise use role titles.
- Timeframes should be realistic (hours/days/weeks).
- Confidence is 0-100 based on data completeness and clarity of the situation.
- Use business language, not technical jargon.
- Respond in the same language as the problem titles (typically English).`;
}

function serializeProblems(problems: any[]): string {
  return problems.map((p, i) => {
    const parts = [
      `[${i + 1}] ID: ${p.id}`,
      `Severity: ${p.severity}`,
      `Type: ${p.problemType}`,
      `Title: ${p.title}`,
      `Root cause: ${p.rootCause}`,
      `Source: ${p.sourceEntityType} "${p.sourceEntityName}" (${p.sourceEntityId})`,
    ];
    if (p.ownerName) parts.push(`Owner: ${p.ownerName}`);
    if (p.daysOverdue != null) parts.push(`Days overdue: ${p.daysOverdue}`);
    if (p.impactCount > 0) parts.push(`Impact count: ${p.impactCount}`);
    if (p.affectedEntities?.length) {
      parts.push(`Affected: ${p.affectedEntities.map((e: any) => `${e.type}:"${e.name}"`).join(', ')}`);
    }
    if (p.actions?.length) parts.push(`Available actions: ${p.actions.map((a: any) => a.label).join(', ')}`);
    const metaKeys = Object.entries(p.meta || {}).filter(([, v]) => v != null);
    if (metaKeys.length) parts.push(`Meta: ${metaKeys.map(([k, v]) => `${k}=${v}`).join(', ')}`);
    return parts.join('\n  ');
  }).join('\n\n');
}

/* ────────────────────────────────────────────────────────────────────────────
   Public API
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Generate AI recommendation for a single problem.
 */
export async function getAiRecommendation(
  organizationId: string,
  laneId: string,
  problemId: string,
  projectId?: string,
): Promise<AiRecommendation> {
  const allProblems = await getManagerProblems(organizationId, laneId, projectId);
  const problem = allProblems.find((p) => p.id === problemId);
  if (!problem) throw new Error(`Problem ${problemId} not found in lane ${laneId}`);

  const nearby = allProblems
    .filter((p) => p.id !== problemId)
    .filter((p) =>
      p.sourceEntityId === problem.sourceEntityId ||
      p.ownerId === problem.ownerId ||
      problem.affectedEntities?.some((ae: any) =>
        p.affectedEntities?.some((pe: any) => pe.id === ae.id)
      )
    )
    .slice(0, 5);

  const userPrompt = `Analyze this problem and provide a management recommendation:

PRIMARY PROBLEM:
${serializeProblems([problem])}

${nearby.length > 0 ? `RELATED PROBLEMS (same entity/owner/initiative):\n${serializeProblems(nearby)}` : ''}

Provide:
1. diagnosis — what exactly is happening and why
2. recommendation — the single best course of action
3. steps — max 5 concrete steps with owners and timeframes
4. confidence — how confident you are (0-100)
5. reasoning — why this approach is best
6. alternativeApproach — one alternative if the primary recommendation fails`;

  const result = await llmService.call({
    type: 'structured',
    modelConfig: { id: 'budget' },
    systemPrompt: buildSystemPrompt(laneId),
    messages: [{ role: 'user', content: userPrompt }],
    schema: SingleRecommendationSchema,
    maxTokens: 1200,
    temperature: 0.3,
    cache: true,
    cacheTtl: 900,
  });

  const parsed = (result as any)?.object;
  if (!parsed) throw new Error('AI returned empty response');

  return {
    problemId,
    diagnosis: parsed.diagnosis,
    recommendation: parsed.recommendation,
    steps: parsed.steps,
    confidence: parsed.confidence,
    reasoning: parsed.reasoning,
    alternativeApproach: parsed.alternativeApproach,
  };
}

/**
 * AI Triage — cluster and prioritize all problems in a lane.
 */
export async function getAiTriage(
  organizationId: string,
  laneId: string,
  projectId?: string,
): Promise<AiTriageResult> {
  const problems = await getManagerProblems(organizationId, laneId, projectId);
  if (problems.length === 0) {
    return { clusters: [], topPriority: [], executiveSummary: 'No problems detected in this area.' };
  }

  const cap = Math.min(problems.length, 60);
  const subset = problems.slice(0, cap);

  const userPrompt = `You have ${problems.length} problems in the "${laneId}" management area (showing top ${cap}).

PROBLEMS:
${serializeProblems(subset)}

Tasks:
1. Group related problems into thematic clusters (max 10 clusters).
   - Each cluster needs: theme name, severity (worst among members), list of problem IDs, summary, and a single suggested action.
2. Identify the top 5 most urgent problem IDs that should be addressed first.
3. Write a 2-3 sentence executive summary of the overall situation.`;

  const result = await llmService.call({
    type: 'structured',
    modelConfig: { id: 'budget' },
    systemPrompt: buildSystemPrompt(laneId),
    messages: [{ role: 'user', content: userPrompt }],
    schema: TriageSchema,
    maxTokens: 2000,
    temperature: 0.3,
    cache: true,
    cacheTtl: 900,
  });

  const parsed = (result as any)?.object;
  if (!parsed) throw new Error('AI returned empty response');
  return parsed;
}

/**
 * AI Manage All — comprehensive management plan for an entire lane.
 */
export async function getAiManageAll(
  organizationId: string,
  laneId: string,
  projectId?: string,
): Promise<AiManageAllResult> {
  const problems = await getManagerProblems(organizationId, laneId, projectId);
  if (problems.length === 0) {
    return {
      laneId,
      executiveSummary: 'No problems detected. This area is healthy.',
      clusters: [],
      quickWins: [],
      escalationNeeded: [],
    };
  }

  const cap = Math.min(problems.length, 50);
  const subset = problems.slice(0, cap);

  const criticalCount = problems.filter((p) => p.severity === 'critical').length;
  const warningCount = problems.filter((p) => p.severity === 'warning').length;

  const userPrompt = `Create a comprehensive management plan for the "${laneId}" area.

STATISTICS: ${problems.length} total problems (${criticalCount} critical, ${warningCount} warning).
Showing top ${cap} problems below.

PROBLEMS:
${serializeProblems(subset)}

Create:
1. executiveSummary — 3-4 sentence overview for leadership
2. clusters — group into 4-8 thematic clusters. For each:
   - theme name, severity, diagnosis of the cluster
   - 3-5 concrete action steps (with owner roles and timeframes)
   - list of affected problem IDs
3. quickWins — up to 5 items that can be resolved quickly (< 1 day)
4. escalationNeeded — up to 5 items that require leadership/sponsor intervention`;

  const result = await llmService.call({
    type: 'structured',
    modelConfig: { id: 'budget' },
    systemPrompt: buildSystemPrompt(laneId),
    messages: [{ role: 'user', content: userPrompt }],
    schema: ManageAllSchema,
    maxTokens: 3000,
    temperature: 0.3,
    cache: true,
    cacheTtl: 900,
  });

  const parsed = (result as any)?.object;
  if (!parsed) throw new Error('AI returned empty response');
  return { laneId, ...parsed };
}
