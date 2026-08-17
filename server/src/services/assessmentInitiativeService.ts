/**
 * AssessmentInitiativeService
 * Service for generating initiatives from assessments
 *
 * Pipeline:
 * 1. Extract assessment answers and scores
 * 2. Build context (org data + chat history + assessment data)
 * 3. Generate initiatives using AI (with methodology mapping)
 * 4. Persist initiatives with links to assessment
 */

import { v4 as uuidv4 } from 'uuid';

import { AppError } from '../utils/ErrorHandler.js';
import logger from '../utils/Logger.js';
import { validateInitiativeCard } from './cardContentFormulaValidator.js';
import {
  deriveConfidence,
  emptyEvidenceContract,
  type EvidenceContract,
  type EvidenceContractSource,
} from './evidence/evidenceContract.js';
import { safePersistEvidenceContract } from './evidence/evidenceContractBridge.js';
import {
  type MaterializationOutcome,
  type MaterializationSourceItem,
  materializeInsightCandidates,
} from './insightMaterializationService.js';

// F3.3 — CARD_CONTENT_FORMULA §A3: injected into every assessment initiative-generation
// prompt so the AI targets the McKinsey-grade card standard from the first call
// (SSOT: docs/standards/CARD_CONTENT_FORMULA.md §A3).
const CARD_CONTENT_FORMULA_A3 = `
CARD_CONTENT_FORMULA §A3 — Każda wygenerowana inicjatywa musi spełniać:
- Tytuł: action-title ≤14 słów, konkretna zmiana (nie "Poprawa X" lecz "Zwiększenie X o Y% do Z")
- Problem (problem_statement): 120–250 słów, przyczyny ŹRÓDŁOWE, ugruntowane w danych
- Hipoteza: format "Jeśli [działanie] to [wynik mierzalny] bo [przesłanka]"
- Streszczenie (summary): 40–90 słów, czym jest + jaki efekt
- KPI: ≥2 (≥1 primary) — każdy z baseline→target + kierunek + jednostka; brak baseline → "do ustalenia" + powód
- Scope-in: min 3 konkretnych elementów
- Scope-out: min 3 pozycji MECE (co NIE jest objęte, odwołania do innych inicjatyw)
- Rezultaty (deliverables): min 4 konkretnych, rzeczownikowych
- Kryteria sukcesu (success_criteria): min 4, mierzalne/obserwowalne
- Kryteria zatrzymania (kill_criteria): min 2, konkretny warunek stop
- Kamienie milowe (milestones): min 3, fazowane 0–3/3–6/6–12 mies.
- RAID: ≥2 RISK + ≥1 ASSUMPTION + ≥1 DEPENDENCY; każdy z probability+impact+mitigation_plan
- Sizing/ROI: rząd wielkości + ROI + jawne założenia (kwota/%/dni + logika)
- Właściciel (owner): przypisany owner_business_id lub rola
- Język: WYŁĄCZNIE polski (poza akronimami §A5: KPI, RAID, RACI, ROI, MECE, itp.)
`;
import * as queryHelpers from '../utils/queryHelpers.js';
import { createInitiative as funnelCreateInitiative } from './initiative/createInitiativeService.js';

// Types
type AssessmentType = 'DRD' | 'SIRI' | 'ADMA' | 'CMMI' | 'LEAN';

// Exported (HP-16) so `buildInitiativeEvidenceContract` is unit-testable without `as any` casts.
export interface AssessmentRow {
  id: string;
  organization_id: string;
  project_id?: string | null;
  assessment_type: AssessmentType;
  name: string;
  status: string;
  completion_percent: number;
  confidence_avg: number;
  answers_json?: string | null;
  context_snapshot?: string | null;
  score_summary?: string | null;
}

// Exported (HP-16) so `buildInitiativeEvidenceContract` is unit-testable without `as any` casts.
export interface GeneratedInitiative {
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  risk: 'low' | 'medium' | 'high';
  estimatedEffort?: string;
  expectedOutcome?: string;
  relatedAxis?: string;
  relatedDimension?: string;
}

interface GenerateParams {
  assessment: AssessmentRow;
  methodologyId: string;
  count: number;
  includeChatContext: boolean;
  /**
   * Optional report context to complement assessment answers.
   * When provided, it should be treated as the "synthesis layer".
   */
  reportContext?: Record<string, any> | null;
  /**
   * Optional list of existing initiatives (for deduplication guidance).
   */
  existingInitiatives?: Array<{
    id?: string;
    title?: string;
    status?: string;
    reportId?: string;
  }> | null;
  userId: string;
}

interface PersistParams {
  assessment: AssessmentRow;
  batchId: string;
  initiatives: GeneratedInitiative[];
  reportId?: string | null;
  userId: string;
}

// Methodology configurations
const METHODOLOGIES: Record<
  string,
  {
    name: string;
    categoryMapping: string[];
    priorityBias: 'high' | 'medium' | 'balanced';
    riskTolerance: 'low' | 'medium' | 'high';
  }
> = {
  'impact-feasibility': {
    name: 'Impact-Feasibility Matrix',
    categoryMapping: ['quick_win', 'strategic', 'operational', 'innovation'],
    priorityBias: 'balanced',
    riskTolerance: 'medium',
  },
  moscow: {
    name: 'MoSCoW Prioritization',
    categoryMapping: ['must_have', 'should_have', 'could_have', 'wont_have'],
    priorityBias: 'high',
    riskTolerance: 'low',
  },
  rice: {
    name: 'RICE Scoring',
    categoryMapping: ['high_reach', 'high_impact', 'high_confidence', 'low_effort'],
    priorityBias: 'balanced',
    riskTolerance: 'medium',
  },
  'value-effort': {
    name: 'Value vs Effort',
    categoryMapping: ['high_value_low_effort', 'high_value_high_effort', 'low_value_low_effort'],
    priorityBias: 'high',
    riskTolerance: 'low',
  },
  'strategic-fit': {
    name: 'Strategic Fit',
    categoryMapping: ['core_strategy', 'growth', 'efficiency', 'innovation'],
    priorityBias: 'medium',
    riskTolerance: 'high',
  },
};

// Assessment type to initiative category mapping
const ASSESSMENT_CATEGORY_MAPPING: Record<AssessmentType, string[]> = {
  DRD: [
    'digital_transformation',
    'process_automation',
    'data_management',
    'ai_readiness',
    'cybersecurity',
    'culture_change',
  ],
  SIRI: [
    'industry_40',
    'smart_manufacturing',
    'iot_integration',
    'analytics',
    'workforce_development',
    'governance',
  ],
  ADMA: ['advanced_manufacturing', 'digital_maturity', 'operational_excellence', 'innovation'],
  CMMI: ['process_improvement', 'capability_development', 'quality_management', 'risk_management'],
  LEAN: ['lean_transformation', 'waste_reduction', 'continuous_improvement', 'value_stream'],
};

// Timeout helper
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Operation timed out'));
    }, ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

/**
 * Raw assessment `answers_json` (Record<questionId, answer>) → generic
 * `MaterializationSourceItem[]` — the "positions" the shared
 * insightMaterializationService distills into candidates and every
 * evidence_ref must point back to. Tolerant of any answer shape (plain
 * string, `{ answer|value|text }`, or an arbitrary object) — never throws.
 */
function buildAssessmentSourceItems(
  answersJson: string | null | undefined
): MaterializationSourceItem[] {
  if (!answersJson || typeof answersJson !== 'string') return [];
  let answers: Record<string, unknown>;
  try {
    const parsed = JSON.parse(answersJson);
    answers = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return [];
  }

  return Object.entries(answers)
    .map(([key, value]) => {
      let text: string;
      if (value == null) {
        text = '';
      } else if (typeof value === 'string') {
        text = value;
      } else if (typeof value === 'object') {
        const v = value as Record<string, unknown>;
        text = String(v.answer ?? v.value ?? v.text ?? JSON.stringify(v));
      } else {
        text = String(value);
      }
      return { id: key, label: key, text: text.trim() };
    })
    .filter((item) => item.text.length > 0);
}

/**
 * HP-16: buduje `EvidenceContract` DLA POJEDYNCZEJ wygenerowanej inicjatywy —
 * DETERMINISTYCZNIE, zero LLM, zero I/O. Zastępuje `emptyEvidenceContract()`
 * na jedynym realnym choke-poincie (`persistInitiatives`, wołanym przez
 * `generateInitiatives`, `AssessmentController.generateInitiatives` i
 * `assessmentInitiativeGenerationRunService` — WSZYSTKIE ścieżki produkcji
 * inicjatyw z oceny).
 *
 * Sygnały pewności są REALNE, nie zgadywane:
 *   - `sources` = sam rekord oceny + (jeśli inicjatywa ma `relatedAxis`/
 *     `relatedDimension`) wymiar `score_summary`, na którym się opiera —
 *     dokładnie ten sam klucz, którego fallback-generator (DRD/SIRI) użył do
 *     policzenia gap = target - actual.
 *   - `qualityScore` = `assessment.completion_percent` (realne pole na
 *     rekordzie, to samo, którego `AssessmentController.isReadyForFinal`
 *     używa jako progu gotowości).
 *   - `unresolvedGaps` liczy: (a) brak powiązanej osi (inicjatywa
 *     nieprześledzalna do wymiaru oceny), (b) `confidence_avg` < 3/5 — ten
 *     sam próg co `ToolController`/`AssessmentController` "gotowość do
 *     finalizacji" (linia `completion >= 100 && confidence_avg >= 3`).
 * `risks`/`toVerify` cytują te same realne braki — nie zgadywanie modelu.
 */
export function buildInitiativeEvidenceContract(
  assessment: AssessmentRow,
  scoreSummary: Record<string, unknown>,
  initiative: GeneratedInitiative
): EvidenceContract {
  const axisRef = (initiative.relatedAxis || initiative.relatedDimension || '').trim();
  const axisKnown =
    axisRef.length > 0 && Object.prototype.hasOwnProperty.call(scoreSummary, axisRef);

  const sources: EvidenceContractSource[] = [
    {
      type: 'assessment',
      ref: assessment.id,
      title: `${assessment.assessment_type} — ${assessment.name}`,
    },
  ];
  if (axisRef) {
    sources.push({
      type: 'assessment_axis',
      ref: axisRef,
      title: axisKnown ? undefined : `${axisRef} (brak w score_summary)`,
    });
  }

  const completion = Number(assessment.completion_percent || 0);
  const confidenceAvg = Number(assessment.confidence_avg || 0);

  const risks: string[] = [];
  if (!axisRef) {
    risks.push(
      'Inicjatywa nie ma powiązanej osi/wymiaru oceny — podstawa nieprześledzalna do konkretnego wymiaru.'
    );
  }
  if (completion < 100) {
    risks.push(`Ocena ukończona w ${completion}% — część odpowiedzi może brakować.`);
  }
  if (confidenceAvg > 0 && confidenceAvg < 3) {
    risks.push(
      `Średnia pewność odpowiedzi ${confidenceAvg.toFixed(1)}/5 — poniżej progu gotowości (3/5).`
    );
  }

  const toVerify: string[] = [];
  if (axisRef && !axisKnown) {
    toVerify.push(
      `Powiązana oś/wymiar "${axisRef}" nie występuje w wynikach oceny (score_summary) — zweryfikuj.`
    );
  }
  if (completion < 100) {
    toVerify.push('Dokończ ocenę — brakujące odpowiedzi mogą zmienić priorytety inicjatywy.');
  }

  const confidence = deriveConfidence({
    sourceCount: sources.length,
    unresolvedGaps:
      (axisRef ? 0 : 1) +
      (confidenceAvg > 0 && confidenceAvg < 3 ? 1 : 0) +
      (axisRef && !axisKnown ? 1 : 0),
    qualityScore: completion > 0 ? completion : undefined,
  });

  return { sources, assumptions: [], risks, confidence, toVerify };
}

class AssessmentInitiativeService {
  /**
   * Backward-compatible alias used by legacy assessment routes.
   * Marks assessment as completed (minimal implementation).
   */
  static async completeAssessment(assessmentId: string, organizationId: string) {
    const assessment = await queryHelpers.queryOne<AssessmentRow>(
      `SELECT * FROM assessments WHERE id = ? AND organization_id = ?`,
      [assessmentId, organizationId]
    );
    if (!assessment) {
      throw new Error('Assessment not found');
    }

    // Minimal state update (if column exists). Ignore errors to keep compatibility.
    try {
      await queryHelpers.queryRun(
        `UPDATE assessments SET status = 'COMPLETED', updated_at = datetime('now') WHERE id = ? AND organization_id = ?`,
        [assessmentId, organizationId]
      );
    } catch {
      // noop
    }

    return { assessmentId, reportGenerated: false };
  }

  /**
   * Backward-compatible alias used by legacy assessment routes.
   * Generates and persists draft initiatives.
   */
  static async generateInitiatives(
    assessmentId: string,
    projectId: string,
    organizationId: string,
    userId: string
  ) {
    const assessment = await queryHelpers.queryOne<AssessmentRow>(
      `SELECT * FROM assessments WHERE id = ? AND organization_id = ?`,
      [assessmentId, organizationId]
    );
    if (!assessment) {
      throw new Error('Assessment not found');
    }

    const normalized: AssessmentRow = {
      ...assessment,
      project_id: assessment.project_id || projectId || null,
    };

    const batchId = uuidv4();
    const initiatives = await this.generateFromAssessment({
      assessment: normalized,
      methodologyId: 'impact-feasibility',
      count: 5,
      includeChatContext: false,
      userId,
    });

    const created = await this.persistInitiatives({
      assessment: normalized,
      batchId,
      initiatives,
      userId,
    });

    return { batchId, initiatives: created };
  }

  /**
   * Generate initiatives from assessment
   */
  static async generateFromAssessment(params: GenerateParams): Promise<GeneratedInitiative[]> {
    const {
      assessment,
      methodologyId,
      count,
      includeChatContext,
      reportContext,
      existingInitiatives,
    } = params;

    const methodology = METHODOLOGIES[methodologyId] || METHODOLOGIES['impact-feasibility'];
    const categories = ASSESSMENT_CATEGORY_MAPPING[assessment.assessment_type] || ['general'];

    // Parse assessment data
    const safeParseJson = <T>(value: string | null | undefined, fallback: T): T => {
      if (!value || typeof value !== 'string') return fallback;
      try {
        return JSON.parse(value) as T;
      } catch {
        return fallback;
      }
    };
    const answers = safeParseJson<Record<string, any>>(assessment.answers_json, {});
    const scoreSummary = safeParseJson<Record<string, any>>(assessment.score_summary, {});
    const contextSnapshot = safeParseJson<Record<string, any>>(assessment.context_snapshot, {});
    const mergedContextSnapshot: Record<string, any> = {
      ...contextSnapshot,
      ...(reportContext ? { report: reportContext } : {}),
      ...(existingInitiatives ? { existingInitiatives } : {}),
    };

    // Build prompt for AI
    const prompt = this.buildPrompt({
      assessment,
      answers,
      scoreSummary,
      methodology,
      categories,
      count,
      includeChatContext,
      contextSnapshot: mergedContextSnapshot,
    });

    try {
      // Try to generate with AI
      const aiInitiatives = await withTimeout(
        this.callAI(prompt, count),
        30000 // 30 second timeout
      );

      if (aiInitiatives && aiInitiatives.length > 0) {
        const normalized = this.normalizeInitiatives(
          aiInitiatives,
          assessment.assessment_type,
          methodology
        );
        this.logFormulaVerdictsAdvisory(normalized, assessment.id);
        return normalized;
      }
    } catch (error) {
      logger.error('[AssessmentInitiativeService] AI generation failed:', error);
      // Fall through to fallback
    }

    // Fallback: Generate basic initiatives from gaps
    return this.generateFallbackInitiatives(assessment, answers, scoreSummary, methodology, count);
  }

  /**
   * Build AI prompt
   */
  private static buildPrompt(params: {
    assessment: AssessmentRow;
    answers: Record<string, any>;
    scoreSummary: Record<string, any>;
    methodology: (typeof METHODOLOGIES)[string];
    categories: string[];
    count: number;
    includeChatContext: boolean;
    contextSnapshot: Record<string, any>;
  }): string {
    const {
      assessment,
      answers,
      scoreSummary,
      methodology,
      categories,
      count,
      includeChatContext,
      contextSnapshot,
    } = params;

    let prompt = `You are an expert consultant generating transformation initiatives based on a ${assessment.assessment_type} assessment.

Assessment: ${assessment.name}
Type: ${assessment.assessment_type}
Methodology: ${methodology.name}

You MUST use BOTH sources of truth:
1) detailed assessment answers and scores (below)
2) report narrative/synthesis context (if provided below)

Assessment Scores:
${JSON.stringify(scoreSummary, null, 2)}

Key Assessment Areas:
${JSON.stringify(answers, null, 2)}

Generate exactly ${count} strategic initiatives that address the gaps identified in this assessment.
Each initiative should:
1. Address a specific gap or improvement area
2. Be actionable and measurable
3. Align with ${methodology.name} prioritization
4. Consider the organization's current maturity level

Categories to consider: ${categories.join(', ')}

`;

    const chatFromSnapshot =
      (Array.isArray(contextSnapshot.chat) && contextSnapshot.chat) ||
      (Array.isArray(contextSnapshot?.chatContext?.lastMessages) &&
        contextSnapshot.chatContext.lastMessages) ||
      null;

    if (includeChatContext && chatFromSnapshot) {
      prompt += `\nRecent conversation context:\n${JSON.stringify(chatFromSnapshot.slice(-10), null, 2)}\n`;
    }

    if (contextSnapshot.org) {
      prompt += `\nOrganization context:\n${JSON.stringify(contextSnapshot.org, null, 2)}\n`;
    }

    if (contextSnapshot.report) {
      prompt += `\nLatest assessment report context:\n${JSON.stringify(contextSnapshot.report, null, 2)}\n`;
    }

    if (Array.isArray((contextSnapshot as any).existingInitiatives)) {
      const existing = (contextSnapshot as any).existingInitiatives as Array<any>;
      if (existing.length) {
        prompt += `\nExisting initiatives (do NOT duplicate; propose different initiatives):\n${JSON.stringify(
          existing.slice(0, 50),
          null,
          2
        )}\n`;
      }
    }

    // D1 — interview-insight handoff payload. When an interview insight is
    // exported to this assessment, its governed P10 findings (confidence,
    // limits, next action, evidence pointers) ride in
    // `contextSnapshot.boundedInsightPayload`. Previously this key was written
    // but never read, so the generated initiatives saw zero interview
    // evidence. This additive branch only fires for interview-sourced
    // snapshots, so non-interview assessments are unaffected.
    const insightPayload = (contextSnapshot as any).boundedInsightPayload;
    if (
      insightPayload &&
      Array.isArray(insightPayload.findings) &&
      insightPayload.findings.length
    ) {
      const findingsText = insightPayload.findings
        .slice(0, 25)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((f: any, i: number) => {
          const evidence = Array.isArray(f.evidencePointers)
            ? f.evidencePointers
                .slice(0, 5)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map((p: any) => `    - ${String(p.excerpt || p.source_id || '').slice(0, 240)}`)
                .join('\n')
            : '';
          return [
            `${i + 1}. ${f.findingStatement}`,
            f.confidenceLevel != null ? `   Confidence: ${f.confidenceLevel}%` : '',
            f.limits ? `   Limits: ${f.limits}` : '',
            f.nextAction ? `   Recommended next action: ${f.nextAction}` : '',
            evidence ? `   Evidence:\n${evidence}` : '',
          ]
            .filter(Boolean)
            .join('\n');
        })
        .join('\n\n');
      prompt += `\nInterview findings (evidence-bounded, from a governed stakeholder interview — base the initiatives on these):\n${findingsText}\n`;
    }

    // F3.3 — inject CARD_CONTENT_FORMULA §A3 so the model produces formula-grade cards.
    prompt += `\n${CARD_CONTENT_FORMULA_A3}\n`;

    prompt += `
Return a JSON array with exactly ${count} initiatives in this format:
[
  {
    "title": "Initiative title (max 100 chars)",
    "description": "Detailed description of the initiative",
    "category": "one of: ${categories.join(', ')}",
    "priority": "low|medium|high|critical",
    "risk": "low|medium|high",
    "estimatedEffort": "S|M|L|XL",
    "expectedOutcome": "Expected business outcome",
    "relatedAxis": "Related assessment axis/dimension"
  }
]`;

    return prompt;
  }

  /**
   * Call AI service
   */
  private static async callAI(prompt: string, count: number): Promise<GeneratedInitiative[]> {
    const { generateChatResponse } = await import('./aiService.js');

    // Jedna próba na danym tierze; rzuca przy timeout/błędzie/pustym payloadzie.
    const tryTier = async (model: string): Promise<GeneratedInitiative[]> => {
      const response = await generateChatResponse({
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: 'You are an expert consultant. Return only valid JSON arrays.',
        model,
        maxTokens: 2000,
      });
      if (response?.content) {
        const jsonMatch = response.content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed)) {
            return parsed.slice(0, count);
          }
        }
      }
      throw new AppError('AI returned invalid initiatives payload', 503, 'FEATURE_UNAVAILABLE');
    };

    try {
      return await tryTier('premium');
    } catch (primaryErr: unknown) {
      // USPOJNIENIE C4 — graceful degradation: przy timeout/awarii tieru premium
      // ponawiamy RAZ na tańszym tierze ('budget') zanim oddamy 503. Wcześniej
      // assessment robił wyłącznie fail-fast (premium timeout → twarde 503),
      // mimo że plan obiecywał „timeout + fallback".
      const pMsg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
      logger.warn(
        `[assessmentInitiativeService] premium tier failed (${pMsg}) — fallback to budget tier`
      );
      try {
        return await tryTier('budget');
      } catch (fallbackErr: unknown) {
        const fMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        throw new AppError('Initiative generation is not available', 503, 'FEATURE_UNAVAILABLE', {
          message: `premium: ${pMsg}; budget: ${fMsg}`,
        });
      }
    }
  }

  /**
   * Normalize initiatives
   */
  private static normalizeInitiatives(
    initiatives: any[],
    assessmentType: AssessmentType,
    methodology: (typeof METHODOLOGIES)[string]
  ): GeneratedInitiative[] {
    const categories = ASSESSMENT_CATEGORY_MAPPING[assessmentType] || ['general'];

    return initiatives.map((init) => ({
      title: String(init.title || 'Untitled Initiative').slice(0, 200),
      description: String(init.description || ''),
      category: categories.includes(init.category) ? init.category : categories[0],
      priority: (() => {
        const raw = String(init.priority || '').toLowerCase();
        return ['low', 'medium', 'high', 'critical'].includes(raw)
          ? (raw as GeneratedInitiative['priority'])
          : 'medium';
      })(),
      risk: (() => {
        const raw = String(init.risk || '').toLowerCase();
        return ['low', 'medium', 'high'].includes(raw)
          ? (raw as GeneratedInitiative['risk'])
          : 'medium';
      })(),
      estimatedEffort: init.estimatedEffort || 'M',
      expectedOutcome: init.expectedOutcome || '',
      relatedAxis: init.relatedAxis || '',
      relatedDimension: init.relatedDimension || '',
    }));
  }

  /**
   * F14/C — CARD_CONTENT_FORMULA guardian (OXFORD O7.3), ADVISORY only.
   * Scores each freshly-generated (AI) initiative against
   * docs/standards/CARD_CONTENT_FORMULA.md and logs a warning summary when it
   * fails. Pure shadow observation: never throws, never mutates the
   * initiative, never blocks generation/persistence. GeneratedInitiative here
   * is a lighter shape than the full Initiative card (no problem_statement/
   * hypothesis at this stage), so misses on those fields are expected and
   * are exactly the gap this shadow pass is meant to surface.
   */
  private static logFormulaVerdictsAdvisory(
    initiatives: GeneratedInitiative[],
    assessmentId: string
  ): void {
    try {
      for (const initiative of initiatives) {
        const verdict = validateInitiativeCard({
          title: initiative.title,
          description: initiative.description,
        });
        if (!verdict.pass) {
          logger.warn(
            `[AssessmentInitiativeService] initiative "${initiative.title}" (assessment ${assessmentId}) ` +
              `failed CARD_CONTENT_FORMULA (score ${verdict.score}/100): ${verdict.violationCodes.join(', ')}`
          );
        }
      }
    } catch (err) {
      logger.warn(
        `[AssessmentInitiativeService] CARD_CONTENT_FORMULA validation skipped (fail-soft): ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  /**
   * REFERENCE WIRING — Content Engines §5, pipeline steps [3]-[5] ("Zbierz
   * wnioski"). Distills the RAW assessment answers (not the AI-generated
   * initiatives above — the actual step-[2] result) into Insight-card
   * candidates via the shared `insightMaterializationService`, gated by F14
   * (CARD_CONTENT_FORMULA, ADVISORY).
   *
   * This is the "1 przykładowe wpięcie" showing how Catalog B (Assessment)
   * calls the shared core instead of re-implementing distill→validate→repair.
   * It is intentionally NOT invoked from any route yet (no user-facing
   * change) — materialization must stay explicit/reversible (§5: the user
   * sees candidates before any Insight row is created), so wiring this into
   * an actual "Zbierz wnioski" action is a follow-up (Faza 3, §12) once the
   * UI has a place to show candidates for review.
   */
  static async collectInsightCandidatesFromAssessment(
    assessmentId: string,
    organizationId: string
  ): Promise<MaterializationOutcome> {
    try {
      const assessment = await queryHelpers.queryOne<AssessmentRow>(
        `SELECT * FROM assessments WHERE id = ? AND organization_id = ?`,
        [assessmentId, organizationId]
      );
      if (!assessment) {
        return {
          candidates: [],
          repaired: false,
          tokensUsed: 0,
          generationTimeMs: 0,
          degraded: true,
          degradedReason: 'assessment_not_found',
          evidence: emptyEvidenceContract(),
        };
      }

      const items = buildAssessmentSourceItems(assessment.answers_json);
      if (items.length === 0) {
        return {
          candidates: [],
          repaired: false,
          tokensUsed: 0,
          generationTimeMs: 0,
          degraded: true,
          degradedReason: 'no_answers',
          evidence: emptyEvidenceContract(),
        };
      }

      return await materializeInsightCandidates({
        sourceType: 'assessment',
        sourceId: assessment.id,
        organizationId,
        title: `${assessment.assessment_type} — ${assessment.name}`,
        items,
      });
    } catch (err) {
      logger.warn(
        `[AssessmentInitiativeService] collectInsightCandidatesFromAssessment failed (fail-soft): ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      return {
        candidates: [],
        repaired: false,
        tokensUsed: 0,
        generationTimeMs: 0,
        degraded: true,
        degradedReason: 'unexpected_error',
        evidence: emptyEvidenceContract(),
      };
    }
  }

  /**
   * Generate fallback initiatives from assessment gaps
   */
  private static generateFallbackInitiatives(
    assessment: AssessmentRow,
    answers: Record<string, any>,
    scoreSummary: Record<string, any>,
    methodology: (typeof METHODOLOGIES)[string],
    count: number
  ): GeneratedInitiative[] {
    const categories = ASSESSMENT_CATEGORY_MAPPING[assessment.assessment_type] || ['general'];
    const initiatives: GeneratedInitiative[] = [];

    // DRD-specific fallback
    if (assessment.assessment_type === 'DRD') {
      const axes = [
        'processes',
        'digitalProducts',
        'businessModels',
        'dataManagement',
        'culture',
        'cybersecurity',
        'aiMaturity',
      ];

      for (const axis of axes) {
        if (initiatives.length >= count) break;

        const axisData = answers[axis] || scoreSummary[axis];
        if (axisData) {
          const actual = axisData.actual || axisData.current || 0;
          const target = axisData.target || 5;
          const gap = target - actual;

          if (gap > 1) {
            initiatives.push({
              title: `Improve ${axis.replace(/([A-Z])/g, ' $1').trim()} maturity`,
              description: `Current level: ${actual}, Target: ${target}. Gap of ${gap} levels requires focused improvement initiatives.`,
              category: categories[initiatives.length % categories.length],
              priority: gap >= 3 ? 'high' : gap >= 2 ? 'medium' : 'low',
              risk: gap >= 3 ? 'high' : 'medium',
              estimatedEffort: gap >= 3 ? 'XL' : gap >= 2 ? 'L' : 'M',
              expectedOutcome: `Increase ${axis} maturity from level ${actual} to level ${target}`,
              relatedAxis: axis,
            });
          }
        }
      }
    }

    // SIRI-specific fallback
    if (assessment.assessment_type === 'SIRI') {
      const dimensions = [
        'operations',
        'supply_chain',
        'product_lifecycle',
        'automation',
        'connectivity',
        'intelligence',
        'talent_readiness',
        'structure_management',
      ];

      for (const dim of dimensions) {
        if (initiatives.length >= count) break;

        const dimData = answers[dim] || scoreSummary[dim];
        if (dimData) {
          const current = dimData.current || 0;
          const target = dimData.target || 5;
          const gap = target - current;

          if (gap > 1) {
            initiatives.push({
              title: `Advance ${dim.replace(/_/g, ' ')} capabilities`,
              description: `Current maturity: ${current}, Target: ${target}. Strategic initiative to close the ${gap}-level gap.`,
              category: categories[initiatives.length % categories.length],
              priority: gap >= 3 ? 'high' : gap >= 2 ? 'medium' : 'low',
              risk: gap >= 3 ? 'high' : 'medium',
              estimatedEffort: gap >= 3 ? 'XL' : gap >= 2 ? 'L' : 'M',
              expectedOutcome: `Achieve Industry 4.0 readiness level ${target} in ${dim}`,
              relatedDimension: dim,
            });
          }
        }
      }
    }

    // Generic fallback if no specific gaps found
    while (initiatives.length < count) {
      initiatives.push({
        title: `${assessment.assessment_type} Improvement Initiative ${initiatives.length + 1}`,
        description: `Strategic initiative based on ${assessment.name} assessment findings.`,
        category: categories[initiatives.length % categories.length],
        priority: methodology.priorityBias === 'high' ? 'high' : 'medium',
        risk: methodology.riskTolerance,
        estimatedEffort: 'M',
        expectedOutcome: 'Improve organizational maturity',
      });
    }

    return initiatives.slice(0, count);
  }

  /**
   * Persist initiatives to database
   */
  static async persistInitiatives(
    params: PersistParams
  ): Promise<{ id: string; title: string; status: string; evidence: EvidenceContract }[]> {
    const { assessment, batchId, initiatives, userId, reportId } = params;
    const now = new Date().toISOString();
    const created: { id: string; title: string; status: string; evidence: EvidenceContract }[] = [];
    // HP-16: parsed once — feeds `buildInitiativeEvidenceContract` per initiative below.
    // Tolerant of malformed/absent JSON (matches the safeParseJson pattern used elsewhere
    // in this file); never throws.
    let scoreSummaryForEvidence: Record<string, unknown> = {};
    try {
      scoreSummaryForEvidence = assessment.score_summary
        ? (JSON.parse(assessment.score_summary) as Record<string, unknown>)
        : {};
    } catch {
      scoreSummaryForEvidence = {};
    }

    // Some deployments may have different initiatives table schemas.
    // Detect available columns once (cached in-memory).
    const getInitiativesColumns = (() => {
      let cache: Set<string> | null | undefined = undefined;
      return async (): Promise<Set<string> | null> => {
        if (cache !== undefined) return cache;
        try {
          const rows = await queryHelpers.getTableColumns('initiatives');
          cache = new Set((rows || []).map((r) => r.name).filter(Boolean) as string[]);
          return cache;
        } catch {
          // Unknown schema: return null to avoid inserting optional columns.
          cache = null;
          return cache;
        }
      };
    })();

    const columns = await getInitiativesColumns();
    const baseAllowedWhenUnknown = new Set([
      'id',
      'organization_id',
      'project_id',
      'name',
      'title',
      'description',
      'status',
      'priority',
      'risk_level',
      'category',
      'source_type',
      'source_id',
      'created_by',
      'created_at',
      'updated_at',
    ]);

    const funnelEnabled = process.env.INITIATIVE_FUNNEL_ENABLED !== 'false';
    const sourceType = reportId ? 'assessment_report' : 'assessment';
    const sourceId = reportId ? String(reportId) : String(assessment.id);

    for (const initiative of initiatives) {
      let id: string;

      if (funnelEnabled) {
        // Uspójnienie F1.7 — każdy rekord pętli przez kanoniczny lejek (DRAFT pominięty
        // → normalizowany w lejku; name/title + lineage). id↔źródło zachowane per-rekord.
        const __r = await funnelCreateInitiative(
          String(assessment.organization_id),
          {
            title: initiative.title,
            projectId: assessment.project_id || null,
            description: initiative.description ?? null,
            // status 'DRAFT' POMINIĘTY — lejek normalizuje
            priority: initiative.priority ?? null,
            category: initiative.category ?? null,
            sourceType,
            sourceId,
          },
          { validate: false, actor: { id: userId } }
        );
        id = __r.id;

        // Extra-kolumny, których lejek nie zna (risk_level, report_id, created_by) →
        // post-create UPDATE, tylko dla kolumn istniejących w tym schemacie.
        const upCols: string[] = [];
        const upVals: unknown[] = [];
        const setIf = (col: string, value: unknown) => {
          if (columns === null) return; // unknown schema: pomiń opcjonalne kolumny
          if (columns && !columns.has(col)) return;
          upCols.push(`${col} = ?`);
          upVals.push(value);
        };
        setIf('risk_level', initiative.risk);
        if (columns?.has('report_id')) setIf('report_id', reportId ? String(reportId) : null);
        setIf('created_by', userId);
        if (upCols.length > 0) {
          try {
            await queryHelpers.queryRun(
              `UPDATE initiatives SET ${upCols.join(', ')} WHERE id = ? AND organization_id = ?`,
              [...upVals, id, String(assessment.organization_id)]
            );
          } catch (updErr) {
            logger.warn(
              `[AssessmentInitiativeService] post-create UPDATE failed: ${
                (updErr as Error)?.message || updErr
              }`
            );
          }
        }
      } else {
        id = uuidv4();

        // Insert into initiatives table (schema-variant safe)
        const cols: string[] = [];
        const values: unknown[] = [];
        const push = (col: string, value: unknown) => {
          if (columns === null && !baseAllowedWhenUnknown.has(col)) return;
          if (columns && !columns.has(col)) return;
          cols.push(col);
          values.push(value);
        };

        push('id', id);
        push('organization_id', assessment.organization_id);
        push('project_id', assessment.project_id || null);
        push('name', initiative.title);
        push('title', initiative.title);
        push('description', initiative.description);
        push('status', 'DRAFT');
        push('priority', initiative.priority);
        push('risk_level', initiative.risk);
        push('category', initiative.category);
        // Prefer linking to the report (source), but keep assessment linkage via assessment_initiative_links.
        push('source_type', sourceType);
        push('source_id', sourceId);
        // If initiatives.report_id exists, set it.
        if (columns?.has('report_id')) {
          push('report_id', reportId ? String(reportId) : null);
        }
        push('created_by', userId);
        push('created_at', now);
        push('updated_at', now);

        const placeholders = cols.map(() => '?').join(', ');
        await queryHelpers.queryRun(
          `INSERT INTO initiatives (${cols.join(', ')}) VALUES (${placeholders})`,
          values
        );
      }

      // Create link — id zwrócone z lejka/insertu (krytyczne: link nie sierota).
      await queryHelpers.queryRun(
        `INSERT INTO assessment_initiative_links (id, assessment_id, batch_id, initiative_id, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [uuidv4(), assessment.id, batchId, id, now]
      );

      // HP-16: realny EvidenceContract (nie emptyEvidenceContract()) — źródło = ocena +
      // (jeśli obecna) oś/wymiar, na którym inicjatywa się opiera; pewność wyprowadzona
      // deterministycznie z completion_percent/confidence_avg realnie zapisanych na ocenie.
      const evidence = buildInitiativeEvidenceContract(
        assessment,
        scoreSummaryForEvidence,
        initiative
      );

      // HP-17 bridge (follow-up, fala 11b) — persist the inline EvidenceContract as an
      // EvidenceEnvelope (`artifact_evidence`, artifactType='initiative') so the evidence
      // panel (fala 9, ArtifactRightPanel) has something to render. Previously: contract
      // computed (HP-16) and returned to the caller but never persisted — panel showed
      // empty state for initiatives despite the engine having real data (same gap as
      // deck/canvas/document, closed in fala 11a). Fire-and-forget + fail-safe: a write
      // failure NEVER blocks initiative creation.
      void safePersistEvidenceContract(evidence, {
        organizationId: String(assessment.organization_id),
        artifactType: 'initiative',
        artifactId: id,
        service: 'assessmentInitiativeService',
        createdBy: userId ?? null,
      }).catch(() => {});

      created.push({
        id,
        title: initiative.title,
        status: 'DRAFT',
        evidence,
      });
    }

    return created;
  }
}

export default AssessmentInitiativeService;
