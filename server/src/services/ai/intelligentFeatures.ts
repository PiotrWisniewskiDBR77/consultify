/**
 * Intelligent AI Features — Phase 3 services
 * 
 * 3.1 NL → Initiative Generator
 * 3.2 AI Sense-Check on Forms
 * 3.3 Predictive Risk Scoring
 * 3.4 AI-Narrated Dashboards
 * 3.6 Proactive AI Nudges
 */

import logger from '../../utils/Logger.js';

// Lazy-load pipeline to avoid circular dependencies
let _pipeline: any = null;
async function getPipeline() {
  if (!_pipeline) {
    const mod = await import('./AIPipeline.js');
    const PipelineClass = (mod as any).AIPipeline;
    _pipeline = new PipelineClass();
  }
  return _pipeline;
}

// ================================================================
// 3.1 NL → Initiative Generator
// ================================================================

export interface GeneratedInitiative {
  name: string;
  description: string;
  drdAxis: string;
  drdArea?: string;
  estimatedDurationWeeks: number;
  costCapex?: number;
  costOpex?: number;
  expectedRoi?: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  suggestedKpis: Array<{ name: string; targetValue: string; unit: string }>;
  dependencies: string[];
  suggestedOwnerRole: string;
  rationale: string;
}

export async function generateInitiativeFromNL(
  naturalLanguageGoal: string,
  userId: string,
  organizationId: string,
  projectId?: string
): Promise<GeneratedInitiative> {
  const pipeline = await getPipeline();

  const prompt = `You are generating a structured digital transformation initiative from a natural language goal.

USER GOAL: "${naturalLanguageGoal}"

Generate a complete initiative card in JSON format with these fields:
{
  "name": "Short initiative name (max 80 chars)",
  "description": "Detailed description of what this initiative involves",
  "drdAxis": "One of: Digital Processes, Technology & Infrastructure, Data & Analytics, Organization & People, Strategy & Innovation, Customer Experience, Operations Excellence",
  "drdArea": "Specific area within the axis",
  "estimatedDurationWeeks": number,
  "costCapex": estimated one-time cost in PLN (or 0),
  "costOpex": estimated recurring annual cost in PLN (or 0),
  "expectedRoi": estimated ROI percentage,
  "priority": "LOW|MEDIUM|HIGH|CRITICAL",
  "suggestedKpis": [{"name": "KPI name", "targetValue": "target", "unit": "unit"}],
  "dependencies": ["Names of initiatives this depends on"],
  "suggestedOwnerRole": "Role best suited to own this (e.g., IT Director, Operations Manager)",
  "rationale": "Why this initiative addresses the stated goal"
}

Be realistic with estimates. Base timeline and cost on industry standards for similar initiatives.
Return ONLY valid JSON, no explanation.`;

  const response = await pipeline.process({
    type: 'chat',
    capability: 'nlToInitiative',
    userId,
    organizationId,
    projectId,
    prompt,
    stream: false,
  });

  const text = (response as any).text || (response as any).content || '{}';

  try {
    // Extract JSON from response (may be wrapped in markdown code block)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(text);
  } catch (err) {
    logger.warn('[NLToInitiative] Failed to parse AI response, returning raw');
    return {
      name: naturalLanguageGoal.slice(0, 80),
      description: text,
      drdAxis: 'Strategy & Innovation',
      estimatedDurationWeeks: 12,
      priority: 'MEDIUM',
      suggestedKpis: [],
      dependencies: [],
      suggestedOwnerRole: 'Project Manager',
      rationale: 'Auto-generated from natural language goal',
    };
  }
}

// ================================================================
// 3.2 AI Sense-Check
// ================================================================

export interface SenseCheckResult {
  isValid: boolean;
  warnings: Array<{
    field: string;
    message: string;
    severity: 'info' | 'warning' | 'error';
    suggestion?: string;
  }>;
}

export async function senseCheckInitiative(
  initiativeData: {
    name: string;
    description?: string;
    estimatedDurationWeeks?: number;
    costCapex?: number;
    costOpex?: number;
    expectedRoi?: number;
    drdAxis?: string;
  },
  userId: string,
  organizationId: string,
  historicalContext?: string
): Promise<SenseCheckResult> {
  const pipeline = await getPipeline();

  const prompt = `You are validating a digital transformation initiative for realism and consistency.

INITIATIVE DATA:
- Name: ${initiativeData.name}
- Description: ${initiativeData.description || 'N/A'}
- Duration: ${initiativeData.estimatedDurationWeeks || 'N/A'} weeks
- CAPEX: ${initiativeData.costCapex || 'N/A'} PLN
- OPEX: ${initiativeData.costOpex || 'N/A'} PLN
- Expected ROI: ${initiativeData.expectedRoi || 'N/A'}%
- DRD Axis: ${initiativeData.drdAxis || 'N/A'}

${historicalContext ? `HISTORICAL CONTEXT:\n${historicalContext}` : ''}

Check for:
1. Timeline realism (is the duration realistic for this type of initiative?)
2. Budget sanity (are costs in a realistic range?)
3. ROI credibility (is the expected ROI achievable?)
4. Scope clarity (is the description clear enough?)

Return JSON:
{
  "isValid": true/false,
  "warnings": [
    {"field": "estimatedDurationWeeks", "message": "...", "severity": "warning", "suggestion": "..."},
    ...
  ]
}

Only include warnings if there are real issues. Return empty warnings array if everything looks reasonable.
Return ONLY valid JSON.`;

  const response = await pipeline.process({
    type: 'chat',
    capability: 'senseCheck',
    userId,
    organizationId,
    prompt,
    stream: false,
  });

  const text = (response as any).text || (response as any).content || '{}';

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return JSON.parse(text);
  } catch {
    return { isValid: true, warnings: [] };
  }
}

// ================================================================
// 3.3 Predictive Risk Scoring
// ================================================================

export interface RiskScoreResult {
  overallScore: number; // 0-100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  factors: Array<{
    factor: string;
    score: number;
    description: string;
  }>;
  recommendation: string;
}

export async function predictRiskScore(
  initiativeData: any,
  userId: string,
  organizationId: string,
  projectContext?: string
): Promise<RiskScoreResult> {
  const pipeline = await getPipeline();

  const prompt = `Assess the risk level for this digital transformation initiative on a 0-100 scale.

INITIATIVE: ${JSON.stringify(initiativeData, null, 2).slice(0, 1000)}

${projectContext ? `PROJECT CONTEXT:\n${projectContext}` : ''}

Consider these risk factors:
1. Timeline aggressiveness
2. Budget adequacy
3. Dependency complexity
4. Resource availability implications
5. Technology risk
6. Change management complexity

Return JSON:
{
  "overallScore": 0-100 (higher = more risk),
  "riskLevel": "LOW|MEDIUM|HIGH|CRITICAL",
  "factors": [{"factor": "Timeline", "score": 0-100, "description": "..."}],
  "recommendation": "One sentence recommendation"
}
Return ONLY valid JSON.`;

  const response = await pipeline.process({
    type: 'chat',
    capability: 'riskScore',
    userId,
    organizationId,
    prompt,
    stream: false,
  });

  const text = (response as any).text || (response as any).content || '{}';

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return JSON.parse(text);
  } catch {
    return {
      overallScore: 50,
      riskLevel: 'MEDIUM',
      factors: [],
      recommendation: 'Unable to assess risk — insufficient data.',
    };
  }
}

// ================================================================
// 3.4 AI-Narrated Dashboards
// ================================================================

export async function narrateChartData(
  chartType: string,
  chartData: any,
  userRole: string,
  userId: string,
  organizationId: string
): Promise<string> {
  const pipeline = await getPipeline();

  const prompt = `You are explaining a dashboard chart to a ${userRole}.

CHART TYPE: ${chartType}
CHART DATA: ${JSON.stringify(chartData).slice(0, 2000)}

Generate a concise, insightful natural language explanation of this data.
Include: key trends, anomalies, and actionable insights.
Adapt detail level to ${userRole} (executive = high-level, analyst = detailed).
Use Polish language.
Max 3-4 sentences.`;

  const response = await pipeline.process({
    type: 'chat',
    capability: 'narrateDashboard',
    userId,
    organizationId,
    prompt,
    stream: false,
  });

  return (response as any).text || (response as any).content || 'Brak danych do analizy.';
}

// ================================================================
// 3.6 Proactive AI Nudges
// ================================================================

export interface AINudge {
  id: string;
  type: 'overdue_tasks' | 'stalled_initiative' | 'upcoming_deadline' | 'gap_without_initiative' | 'review_reminder';
  title: string;
  message: string;
  priority: 'low' | 'normal' | 'high';
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
}

export async function generateNudges(
  userId: string,
  organizationId: string,
  projectId?: string
): Promise<AINudge[]> {
  // This is a data-driven service — queries DB directly, no LLM needed
  const { dbAll } = await import('../../database/db.js');
  const nudges: AINudge[] = [];

  try {
    // Check overdue tasks
    const overdueTasks = (await dbAll(
      `SELECT id, title, due_date FROM tasks 
       WHERE assignee_id = ? AND status NOT IN ('DONE', 'CANCELLED') 
         AND due_date < datetime('now')
       ORDER BY due_date ASC LIMIT 5`,
      [userId]
    )) as any[];

    if (overdueTasks.length > 0) {
      nudges.push({
        id: `nudge-overdue-${Date.now()}`,
        type: 'overdue_tasks',
        title: `${overdueTasks.length} overdue task(s)`,
        message: `Masz ${overdueTasks.length} zaległych zadań. Najstarsze: "${overdueTasks[0].title}". Chcesz żebym pomógł repriorytetyzować?`,
        priority: 'high',
        entityType: 'task',
        entityId: overdueTasks[0].id,
        actionUrl: `/tasks/${overdueTasks[0].id}`,
      });
    }

    // Check stalled initiatives (no update in 14 days)
    if (projectId) {
      const stalledInitiatives = (await dbAll(
        `SELECT id, name, updated_at FROM initiatives
         WHERE project_id = ? AND status IN ('IN_PROGRESS', 'ACTIVE')
           AND updated_at < datetime('now', '-14 days')
         ORDER BY updated_at ASC LIMIT 3`,
        [projectId]
      )) as any[];

      for (const init of stalledInitiatives) {
        nudges.push({
          id: `nudge-stalled-${init.id}`,
          type: 'stalled_initiative',
          title: `Stalled: ${init.name}`,
          message: `Inicjatywa "${init.name}" nie miała aktualizacji od 14+ dni. Warto sprawdzić status.`,
          priority: 'normal',
          entityType: 'initiative',
          entityId: init.id,
          actionUrl: `/initiatives/${init.id}`,
        });
      }
    }

    // Check upcoming deadlines (next 3 days)
    const upcomingTasks = (await dbAll(
      `SELECT id, title, due_date FROM tasks
       WHERE assignee_id = ? AND status NOT IN ('DONE', 'CANCELLED')
         AND due_date BETWEEN datetime('now') AND datetime('now', '+3 days')
       ORDER BY due_date ASC LIMIT 3`,
      [userId]
    )) as any[];

    if (upcomingTasks.length > 0) {
      nudges.push({
        id: `nudge-upcoming-${Date.now()}`,
        type: 'upcoming_deadline',
        title: `${upcomingTasks.length} deadline(s) approaching`,
        message: `${upcomingTasks.length} zadań z terminem w ciągu 3 dni. Najbliższe: "${upcomingTasks[0].title}".`,
        priority: 'normal',
        entityType: 'task',
        entityId: upcomingTasks[0].id,
      });
    }
  } catch (err: any) {
    logger.warn('[ProactiveNudges] Failed to generate nudges:', err?.message);
  }

  return nudges;
}

export default {
  generateInitiativeFromNL,
  senseCheckInitiative,
  predictRiskScore,
  narrateChartData,
  generateNudges,
};
