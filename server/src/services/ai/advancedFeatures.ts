/**
 * Advanced AI Features — Phase 4 services
 *
 * 4.1 Multi-Agent Decision Room
 * 4.2 Monte Carlo ROI Forecasting
 * 4.3 Intelligent Document Import
 * 4.5 Conversational Assessment (MVP)
 */

import logger from '../../utils/Logger.js';

// Lazy-load pipeline
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
// 4.1 Multi-Agent Decision Room
// ================================================================

export interface AgentPerspective {
  agentRole: string;
  agentName: string;
  analysis: string;
  recommendation: string;
  risksConcerns: string[];
  confidenceLevel: number; // 0-100
}

export interface DecisionRoomResult {
  decisionTitle: string;
  perspectives: AgentPerspective[];
  consensus: {
    recommendation: string;
    confidenceLevel: number;
    keyAgreements: string[];
    keyDisagreements: string[];
  };
  summary: string;
}

const DECISION_AGENTS = [
  {
    role: 'CFO',
    name: 'Analityk Finansowy',
    focus: 'ROI, cash flow, financial risk, budget impact, payback period',
  },
  {
    role: 'CTO',
    name: 'Dyrektor Techniczny',
    focus: 'Technical feasibility, integration complexity, scalability, tech stack, security',
  },
  {
    role: 'CHRO',
    name: 'Dyrektor HR',
    focus: 'Change management, skills gap, training needs, team readiness, organizational impact',
  },
  {
    role: 'COO',
    name: 'Dyrektor Operacyjny',
    focus:
      'Operational impact, production downtime, process changes, timeline realism, resource allocation',
  },
];

export async function runDecisionRoom(
  decisionTitle: string,
  decisionContext: string,
  options: string[],
  userId: string,
  organizationId: string
): Promise<DecisionRoomResult> {
  const pipeline = await getPipeline();

  // Run agents in parallel
  const perspectivePromises = DECISION_AGENTS.map(async (agent) => {
    const prompt = `You are the ${agent.name} (${agent.role}) in a decision room.

DECISION: ${decisionTitle}
CONTEXT: ${decisionContext}
OPTIONS: ${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}

YOUR FOCUS AREAS: ${agent.focus}

Analyze this decision EXCLUSIVELY from your ${agent.role} perspective.
Be specific, data-oriented, and constructive.

Return JSON:
{
  "analysis": "Your 2-3 sentence analysis from ${agent.role} perspective",
  "recommendation": "Which option you recommend and why (1 sentence)",
  "risksConcerns": ["Risk 1", "Risk 2"],
  "confidenceLevel": 0-100
}
Return ONLY valid JSON. Use Polish language.`;

    try {
      const response = await pipeline.process({
        type: 'chat',
        capability: 'chat',
        userId,
        organizationId,
        prompt,
        stream: false,
      });

      const text = (response as any).text || (response as any).content || '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

      return {
        agentRole: agent.role,
        agentName: agent.name,
        analysis: parsed.analysis || 'Brak analizy',
        recommendation: parsed.recommendation || 'Brak rekomendacji',
        risksConcerns: parsed.risksConcerns || [],
        confidenceLevel: parsed.confidenceLevel || 50,
      } as AgentPerspective;
    } catch (err: any) {
      logger.warn(`[DecisionRoom] Agent ${agent.role} failed:`, err?.message);
      return {
        agentRole: agent.role,
        agentName: agent.name,
        analysis: 'Analiza niedostępna',
        recommendation: 'Brak rekomendacji',
        risksConcerns: [],
        confidenceLevel: 0,
      } as AgentPerspective;
    }
  });

  const perspectives = await Promise.all(perspectivePromises);

  // Generate consensus
  const consensusPrompt = `You are synthesizing a decision from multiple expert perspectives.

DECISION: ${decisionTitle}
OPTIONS: ${options.join(', ')}

EXPERT PERSPECTIVES:
${perspectives.map((p) => `${p.agentName} (${p.agentRole}): ${p.recommendation} (confidence: ${p.confidenceLevel}%)`).join('\n')}

Synthesize into a consensus. Return JSON:
{
  "recommendation": "Consensus recommendation (1-2 sentences)",
  "confidenceLevel": 0-100,
  "keyAgreements": ["What experts agree on"],
  "keyDisagreements": ["Where they differ"],
  "summary": "Executive summary of the decision analysis (3-4 sentences)"
}
Return ONLY valid JSON. Use Polish language.`;

  let consensus = {
    recommendation: '',
    confidenceLevel: 50,
    keyAgreements: [] as string[],
    keyDisagreements: [] as string[],
  };
  let summary = '';

  try {
    const cResponse = await pipeline.process({
      type: 'chat',
      capability: 'chat',
      userId,
      organizationId,
      prompt: consensusPrompt,
      stream: false,
    });

    const cText = (cResponse as any).text || (cResponse as any).content || '{}';
    const cMatch = cText.match(/\{[\s\S]*\}/);
    const parsed = cMatch ? JSON.parse(cMatch[0]) : {};
    consensus = {
      recommendation: parsed.recommendation || 'Brak konsensusu',
      confidenceLevel: parsed.confidenceLevel || 50,
      keyAgreements: parsed.keyAgreements || [],
      keyDisagreements: parsed.keyDisagreements || [],
    };
    summary = parsed.summary || '';
  } catch (err: any) {
    logger.warn('[DecisionRoom] Consensus generation failed:', err?.message);
  }

  return {
    decisionTitle,
    perspectives,
    consensus,
    summary,
  };
}

// ================================================================
// 4.2 Monte Carlo ROI Forecasting
// ================================================================

export interface MonteCarloResult {
  iterations: number;
  percentiles: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  mean: number;
  standardDeviation: number;
  probabilityOfPositiveROI: number;
  scenarios: Array<{
    label: string;
    roi: number;
    probability: number;
  }>;
}

export function runMonteCarloROI(
  baseROI: number,
  capex: number,
  opex: number,
  uncertainty: number = 0.3, // 30% uncertainty band
  iterations: number = 10000
): MonteCarloResult {
  const results: number[] = [];

  // Box-Muller transform for normal distribution
  function normalRandom(mean: number, stdDev: number): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stdDev;
  }

  for (let i = 0; i < iterations; i++) {
    // Randomize inputs within uncertainty band
    const simCapex = normalRandom(capex, capex * uncertainty);
    const simOpex = normalRandom(opex, opex * uncertainty);
    const simBenefit = normalRandom(
      capex * (1 + baseROI / 100),
      capex * (1 + baseROI / 100) * uncertainty
    );

    const totalCost = Math.max(0, simCapex + simOpex * 3); // 3-year OPEX
    const roi = totalCost > 0 ? ((simBenefit - totalCost) / totalCost) * 100 : 0;
    results.push(roi);
  }

  // Sort for percentile calculation
  results.sort((a, b) => a - b);

  const percentile = (p: number) => results[Math.floor((p / 100) * results.length)] || 0;
  const mean = results.reduce((a, b) => a + b, 0) / results.length;
  const variance = results.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / results.length;
  const positiveCount = results.filter((r) => r > 0).length;

  return {
    iterations,
    percentiles: {
      p10: Math.round(percentile(10)),
      p25: Math.round(percentile(25)),
      p50: Math.round(percentile(50)),
      p75: Math.round(percentile(75)),
      p90: Math.round(percentile(90)),
    },
    mean: Math.round(mean),
    standardDeviation: Math.round(Math.sqrt(variance)),
    probabilityOfPositiveROI: Math.round((positiveCount / iterations) * 100),
    scenarios: [
      { label: 'Pessimistic (P10)', roi: Math.round(percentile(10)), probability: 10 },
      { label: 'Conservative (P25)', roi: Math.round(percentile(25)), probability: 25 },
      { label: 'Base Case (P50)', roi: Math.round(percentile(50)), probability: 50 },
      { label: 'Optimistic (P75)', roi: Math.round(percentile(75)), probability: 75 },
      { label: 'Best Case (P90)', roi: Math.round(percentile(90)), probability: 90 },
    ],
  };
}

// ================================================================
// 4.3 Intelligent Document Import
// ================================================================

export interface ExtractedDocumentData {
  title: string;
  documentType: string;
  extractedFields: Record<string, any>;
  assessmentMapping?: {
    axis: string;
    suggestedScore: number;
    evidence: string;
  }[];
  initiatives?: Array<{
    name: string;
    description: string;
    priority: string;
  }>;
  summary: string;
}

export async function extractDocumentData(
  documentText: string,
  documentType: string, // 'strategy', 'audit_siri', 'audit_adma', 'iso_report', 'general'
  userId: string,
  organizationId: string
): Promise<ExtractedDocumentData> {
  const pipeline = await getPipeline();

  const prompt = `You are an expert document analyzer for digital transformation.

DOCUMENT TYPE: ${documentType}
DOCUMENT TEXT (first 4000 chars):
${documentText.slice(0, 4000)}

Extract structured data from this document. Return JSON:
{
  "title": "Document title",
  "documentType": "${documentType}",
  "extractedFields": {
    "organization": "...",
    "date": "...",
    "framework": "...",
    "keyFindings": ["..."],
    "recommendations": ["..."]
  },
  "assessmentMapping": [
    {"axis": "DRD axis name", "suggestedScore": 1-7, "evidence": "quoted text from document"}
  ],
  "initiatives": [
    {"name": "...", "description": "...", "priority": "HIGH|MEDIUM|LOW"}
  ],
  "summary": "2-3 sentence summary of the document"
}

${documentType === 'audit_siri' ? 'Map SIRI dimensions to DRD axes (e.g., SIRI Process → DRD Digital Processes).' : ''}
${documentType === 'audit_adma' ? 'Map ADMA pillars to DRD axes.' : ''}

Return ONLY valid JSON. Use Polish language for summary.`;

  const response = await pipeline.process({
    type: 'chat',
    capability: 'chat',
    userId,
    organizationId,
    prompt,
    stream: false,
    options: { maxTokens: 4000 } as any,
  });

  const text = (response as any).text || (response as any).content || '{}';

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return JSON.parse(text);
  } catch {
    return {
      title: 'Document',
      documentType,
      extractedFields: {},
      summary: 'Unable to extract structured data from this document.',
    };
  }
}

// ================================================================
// 4.5 Conversational Assessment (MVP)
// ================================================================

export interface AssessmentQuestion {
  question: string;
  axis: string;
  area: string;
  followUp?: string;
}

export interface ConversationalScoreMapping {
  axis: string;
  area: string;
  suggestedAsIsScore: number;
  suggestedToBeScore: number;
  confidence: number;
  evidence: string;
}

export async function generateAssessmentQuestion(
  axis: string,
  area: string,
  previousAnswers: string[],
  userId: string,
  organizationId: string
): Promise<AssessmentQuestion> {
  const pipeline = await getPipeline();

  const prompt = `You are conducting a conversational digital maturity assessment.

CURRENT AXIS: ${axis}
CURRENT AREA: ${area}
PREVIOUS ANSWERS: ${previousAnswers.slice(-3).join('\n') || 'None yet'}

Ask ONE focused question about this area. The question should help determine the maturity level (1-7 scale):
1. Basic/Manual
2. Digitized
3. Integrated
4. Automated
5. Optimized
6. AI-Driven
7. Autonomous

The question should be conversational, not formal. Use Polish.
Return JSON: {"question": "...", "axis": "${axis}", "area": "${area}"}
Return ONLY JSON.`;

  const response = await pipeline.process({
    type: 'chat',
    capability: 'chat',
    userId,
    organizationId,
    prompt,
    stream: false,
  });

  const text = (response as any).text || (response as any).content || '{}';

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return { question: `Opowiedz mi o swoich praktykach w obszarze ${area}.`, axis, area };
  } catch {
    return { question: `Jak wygląda u Was ${area}?`, axis, area };
  }
}

export async function mapAnswerToScore(
  axis: string,
  area: string,
  userAnswer: string,
  userId: string,
  organizationId: string
): Promise<ConversationalScoreMapping> {
  const pipeline = await getPipeline();

  const prompt = `Based on the user's answer, estimate the digital maturity score.

AXIS: ${axis}
AREA: ${area}
USER'S ANSWER: "${userAnswer}"

MATURITY SCALE:
1 = Basic/Manual, 2 = Digitized, 3 = Integrated, 4 = Automated, 5 = Optimized, 6 = AI-Driven, 7 = Autonomous

Return JSON:
{
  "axis": "${axis}",
  "area": "${area}",
  "suggestedAsIsScore": number (1-7),
  "suggestedToBeScore": number (1-7, typically 1-2 higher than as-is),
  "confidence": number (0-100, how confident are you in this score),
  "evidence": "Key phrases from the answer that support this score"
}
Return ONLY JSON.`;

  const response = await pipeline.process({
    type: 'chat',
    capability: 'chat',
    userId,
    organizationId,
    prompt,
    stream: false,
  });

  const text = (response as any).text || (response as any).content || '{}';

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return {
      axis,
      area,
      suggestedAsIsScore: 2,
      suggestedToBeScore: 4,
      confidence: 30,
      evidence: userAnswer.slice(0, 100),
    };
  } catch {
    return {
      axis,
      area,
      suggestedAsIsScore: 2,
      suggestedToBeScore: 4,
      confidence: 20,
      evidence: '',
    };
  }
}

export default {
  runDecisionRoom,
  runMonteCarloROI,
  extractDocumentData,
  generateAssessmentQuestion,
  mapAnswerToScore,
};
