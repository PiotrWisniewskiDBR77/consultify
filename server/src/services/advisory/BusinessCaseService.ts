/**
 * BusinessCaseService — orchestrates LLM-assisted, engine-grounded business
 * case generation (Oxford O4 foundation, "Finanse jako doradztwo").
 *
 * Structurally mirrors WorkbookGeneratorService's 5-phase pipeline
 * (server/src/services/workbook/WorkbookGeneratorService.ts), swapping the
 * domain from spreadsheets to business cases:
 *
 *   Phase 1 (PLAN):      LLM decomposes intent into problem/options/drivers/scenarios
 *   Phase 2 (CONFIRM):   LLM validates the plan against intent — catches misreads
 *   Phase 3 (MODEL):     DETERMINISTIC TS engine (businessCaseModel.ts) computes
 *                         NPV/IRR/payback/ROI for base case + every named scenario.
 *                         No LLM involved — this is the single source of numeric truth.
 *   Phase 4 (REVIEW):    LLM cross-checks the narrative draft's numbers against the
 *                         model output (anti-fabrication), backed by a deterministic
 *                         number-extraction safety net.
 *   Phase 5 (NARRATIVE): LLM writes the W2-format recommendation (verdict → rationale
 *                         → trade-off → next steps + effect), quoting ONLY numbers
 *                         injected via the FACTS block this service assembles with
 *                         template literals from the model result — never from LLM memory.
 *
 * NOTE: no HTTP route wired yet (deliberate — see project instructions). Proposed
 * endpoint for a future step: POST /api/v8/advisory/business-case
 *   body: { prompt, horizonYears?, waccPct?, currency? }
 *   → BusinessCaseGenerationResult
 */

import { v4 as uuidv4 } from 'uuid';

import logger from '../../utils/Logger.js';
import { AIPipeline } from '../ai/AIPipeline.js';
import {
  BusinessCaseModelResult,
  BusinessCasePlan,
  runBusinessCaseModel,
} from './businessCaseModel.js';
import {
  CONFIRM_SYSTEM_PROMPT,
  NARRATIVE_SYSTEM_PROMPT,
  PLAN_SYSTEM_PROMPT,
  REVIEW_SYSTEM_PROMPT,
} from './businessCasePrompts.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PipelinePhaseLog {
  phase: 'plan' | 'confirm' | 'model' | 'review' | 'narrative';
  status: 'ok' | 'warning' | 'failed' | 'skipped';
  durationMs: number;
  detail?: string;
}

export interface BusinessCaseGenerationParams {
  prompt: string;
  userId: string;
  organizationId: string;
  projectId?: string;
  /** Optional overrides — if the client already knows these, skip LLM guesswork. */
  horizonYears?: number;
  waccPct?: number;
  currency?: string;
  language?: 'pl' | 'en';
}

export interface NarrativeNumberCheck {
  consistent: boolean;
  /** Numbers found in the narrative that do not appear (within tolerance) in the FACTS block. */
  unverifiedNumbers: string[];
}

export interface BusinessCaseGenerationResult {
  id: string;
  plan: BusinessCasePlan;
  model: BusinessCaseModelResult;
  narrative: string;
  narrativeCheck: NarrativeNumberCheck;
  llmReviewIssues: Array<{ severity: 'critical' | 'minor'; description: string }>;
  pipelineLog: PipelinePhaseLog[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// JSON extraction (same tolerant strategy as WorkbookGeneratorService)
// ---------------------------------------------------------------------------

function extractJsonFromResponse(content: string): unknown | null {
  try {
    return JSON.parse(content);
  } catch {
    /* not direct JSON */
  }
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {
      /* invalid JSON in code block */
    }
  }
  const braceMatch = content.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]);
    } catch {
      /* invalid JSON */
    }
  }
  return null;
}

function isValidPlan(value: unknown): value is BusinessCasePlan {
  if (!value || typeof value !== 'object') return false;
  const p = value as any;
  return (
    typeof p.problem === 'string' &&
    Array.isArray(p.options) &&
    Array.isArray(p.drivers) &&
    p.drivers.length > 0 &&
    Array.isArray(p.scenarios) &&
    typeof p.horizonYears === 'number' &&
    typeof p.waccPct === 'number' &&
    typeof p.currency === 'string'
  );
}

// ---------------------------------------------------------------------------
// FACTS block — the ONLY numbers the narrative LLM is allowed to quote.
// Built with plain template literals from the deterministic model result.
// ---------------------------------------------------------------------------

function fmtCurrency(n: number, currency: string): string {
  const rounded = Math.round(n).toLocaleString('pl-PL');
  return `${rounded} ${currency}`;
}

function fmtPct(n: number | null): string {
  if (n === null) return 'brak (nie osiąga progu w horyzoncie)';
  return `${n.toFixed(1)}%`;
}

function fmtYears(n: number | null): string {
  if (n === null) return 'brak (nie zwraca się w horyzoncie analizy)';
  return `${n.toFixed(2)} lat`;
}

export function buildFactsBlock(model: BusinessCaseModelResult): string {
  const lines: string[] = [];
  lines.push(
    `Model bazowy (WACC ${model.waccPct}%, horyzont ${model.horizonYears} lat, waluta ${model.currency}):`
  );
  lines.push(
    `  NPV: ${fmtCurrency(model.base.npv, model.currency)} | IRR: ${fmtPct(model.base.irrPct)} | ` +
      `Payback: ${fmtYears(model.base.paybackYears)} | ROI: ${fmtPct(model.base.roiPct)} | ` +
      `Inwestycja: ${fmtCurrency(model.base.totalInvestment, model.currency)}`
  );
  if (model.scenarios.length > 0) {
    lines.push('Scenariusze:');
    for (const s of model.scenarios) {
      const deltaNpv = s.npv - model.base.npv;
      const deltaSign = deltaNpv >= 0 ? '+' : '';
      lines.push(
        `  ${s.name} (dźwignia: ${s.driverKey}, mnożnik ${s.multiplier}): NPV ${fmtCurrency(s.npv, model.currency)} ` +
          `(${deltaSign}${fmtCurrency(deltaNpv, model.currency)} vs bazowy) | IRR: ${fmtPct(s.irrPct)} | ` +
          `Payback: ${fmtYears(s.paybackYears)} | ROI: ${fmtPct(s.roiPct)}`
      );
    }
  }
  if (model.worstCase) {
    lines.push(
      `Najgorszy scenariusz: ${model.worstCase.name} → NPV ${fmtCurrency(model.worstCase.npv, model.currency)}.`
    );
  }
  if (model.bestCase) {
    lines.push(
      `Najlepszy scenariusz: ${model.bestCase.name} → NPV ${fmtCurrency(model.bestCase.npv, model.currency)}.`
    );
  }
  return lines.join('\n');
}

/**
 * Deterministic safety net for phase REVIEW: extracts numeric tokens from the
 * narrative and flags any that don't appear (as a substring, allowing for
 * locale formatting) in the FACTS block. Cheap, no LLM — catches gross
 * fabrication even if the LLM reviewer misses it.
 */
export function checkNarrativeNumbers(narrative: string, factsBlock: string): NarrativeNumberCheck {
  // Match currency-like and percent-like numbers, e.g. "1 234 567 PLN", "12,5%", "3.20 lat"
  const numberPattern = /-?\d[\d\s.,]*\d|\d/g;
  const narrativeNumbers = new Set(
    (narrative.match(numberPattern) || [])
      .map((n) => n.replace(/[\s.,]/g, ''))
      .filter((n) => n.length >= 2) // ignore lone digits (list markers, "3 kroki" etc.)
  );
  const factsNumbers = new Set(
    (factsBlock.match(numberPattern) || []).map((n) => n.replace(/[\s.,]/g, ''))
  );

  const unverifiedNumbers = [...narrativeNumbers].filter((n) => !factsNumbers.has(n));
  return {
    consistent: unverifiedNumbers.length === 0,
    unverifiedNumbers,
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class BusinessCaseService {
  private aiPipeline = AIPipeline.getInstance();

  private async callLLM(
    systemPrompt: string,
    userPrompt: string,
    params: { userId: string; organizationId: string; projectId?: string },
    maxTokens = 6000
  ): Promise<string> {
    const response = await this.aiPipeline.process({
      capability: 'chat',
      prompt: userPrompt,
      userId: params.userId,
      organizationId: params.organizationId,
      projectId: params.projectId,
      options: {
        systemInstruction: systemPrompt,
        dedicatedSystemPrompt: true,
        maxTokens,
      },
      history: [],
    } as any);
    return response?.content || '';
  }

  async generate(params: BusinessCaseGenerationParams): Promise<BusinessCaseGenerationResult> {
    const { prompt, userId, organizationId, projectId } = params;
    const id = uuidv4();
    const llmParams = { userId, organizationId, projectId };
    const pipelineLog: PipelinePhaseLog[] = [];

    logger.info(`[BusinessCase] Starting 5-phase pipeline: ${id}`);

    // =====================================================================
    // PHASE 1: PLAN — LLM decomposes intent into structure (no math)
    // =====================================================================
    const p1Start = Date.now();
    let plan: BusinessCasePlan;
    {
      const planResponse = await this.callLLM(PLAN_SYSTEM_PROMPT, prompt, llmParams, 4000);
      const parsed = extractJsonFromResponse(planResponse);
      if (!isValidPlan(parsed)) {
        pipelineLog.push({
          phase: 'plan',
          status: 'failed',
          durationMs: Date.now() - p1Start,
          detail: 'LLM did not return a valid plan (missing drivers/options/horizon)',
        });
        throw new Error('BusinessCaseService: PLAN phase failed to produce a valid plan');
      }
      plan = parsed;
      // Apply explicit client overrides (they know their own numbers better than the LLM guess).
      if (params.horizonYears) plan.horizonYears = params.horizonYears;
      if (params.waccPct) plan.waccPct = params.waccPct;
      if (params.currency) plan.currency = params.currency;

      pipelineLog.push({
        phase: 'plan',
        status: 'ok',
        durationMs: Date.now() - p1Start,
        detail: `${plan.drivers.length} drivers, ${plan.scenarios.length} scenarios, horizon ${plan.horizonYears}y`,
      });
    }

    // =====================================================================
    // PHASE 2: CONFIRM — validate plan against intent
    // =====================================================================
    const p2Start = Date.now();
    try {
      const confirmResponse = await this.callLLM(
        CONFIRM_SYSTEM_PROMPT,
        `ORYGINALNA PROŚBA:\n${prompt}\n\nPLAN DO OCENY:\n${JSON.stringify(plan, null, 2)}`,
        llmParams,
        3000
      );
      const confirmResult = extractJsonFromResponse(confirmResponse) as any;
      if (confirmResult && typeof confirmResult === 'object') {
        const approved = confirmResult.approved === true;
        const revised = confirmResult.revised_plan;
        if (!approved && isValidPlan(revised)) {
          plan = revised;
          pipelineLog.push({
            phase: 'confirm',
            status: 'warning',
            durationMs: Date.now() - p2Start,
            detail: `Plan revised (${(confirmResult.issues || []).length} issues)`,
          });
        } else {
          pipelineLog.push({
            phase: 'confirm',
            status: approved ? 'ok' : 'warning',
            durationMs: Date.now() - p2Start,
            detail: `approved=${approved}, confidence=${confirmResult.confidence ?? 'n/a'}`,
          });
        }
      } else {
        pipelineLog.push({
          phase: 'confirm',
          status: 'warning',
          durationMs: Date.now() - p2Start,
          detail: 'Could not parse confirmation response — proceeding with original plan',
        });
      }
    } catch (err) {
      pipelineLog.push({
        phase: 'confirm',
        status: 'failed',
        durationMs: Date.now() - p2Start,
        detail: String(err),
      });
      logger.warn('[BusinessCase] Phase 2 CONFIRM failed, proceeding with original plan', err);
    }

    // =====================================================================
    // PHASE 3: MODEL — deterministic engine. No LLM. Single source of truth.
    // =====================================================================
    const p3Start = Date.now();
    let model: BusinessCaseModelResult;
    try {
      model = runBusinessCaseModel(plan);
      pipelineLog.push({
        phase: 'model',
        status: 'ok',
        durationMs: Date.now() - p3Start,
        detail: `NPV base=${model.base.npv}, ${model.scenarios.length} scenarios computed`,
      });
    } catch (err) {
      pipelineLog.push({
        phase: 'model',
        status: 'failed',
        durationMs: Date.now() - p3Start,
        detail: String(err),
      });
      throw err; // MODEL is load-bearing — no narrative without numbers.
    }

    const factsBlock = buildFactsBlock(model);

    // =====================================================================
    // PHASE 4+5 combined call structure: NARRATIVE first (facts-grounded),
    // then REVIEW cross-checks it. REVIEW runs AFTER narrative so it has
    // something to check; if it flags critical issues we regenerate once.
    // =====================================================================
    const p5Start = Date.now();
    let narrative = '';
    {
      const narrativePrompt =
        `FAKTY (JEDYNE dozwolone źródło liczb — wklej dosłownie):\n${factsBlock}\n\n` +
        `KONTEKST PLANU:\nProblem: ${plan.problem}\n` +
        `Opcje rozważane: ${plan.options.map((o) => `${o.name} — ${o.description}`).join(' | ')}\n` +
        `Drivery: ${plan.drivers.map((d) => `${d.label} (${d.role}, ${d.rationale || 'brak uzasadnienia podanego'})`).join(' | ')}\n\n` +
        `Napisz rekomendację w formacie W2.`;
      narrative = await this.callLLM(NARRATIVE_SYSTEM_PROMPT, narrativePrompt, llmParams, 3000);
      pipelineLog.push({
        phase: 'narrative',
        status: narrative ? 'ok' : 'failed',
        durationMs: Date.now() - p5Start,
        detail: `${narrative.length} chars`,
      });
    }

    // =====================================================================
    // PHASE 4: REVIEW — LLM cross-check + deterministic number safety net
    // =====================================================================
    const p4Start = Date.now();
    let llmReviewIssues: Array<{ severity: 'critical' | 'minor'; description: string }> = [];
    const narrativeCheck = checkNarrativeNumbers(narrative, factsBlock);

    try {
      const reviewResponse = await this.callLLM(
        REVIEW_SYSTEM_PROMPT,
        `WYNIK MODELU:\n${JSON.stringify(model, null, 2)}\n\nSZKIC NARRACJI:\n${narrative}`,
        llmParams,
        2500
      );
      const reviewResult = extractJsonFromResponse(reviewResponse) as any;
      if (reviewResult && Array.isArray(reviewResult.issues)) {
        llmReviewIssues = reviewResult.issues;
      }
      const criticalCount = llmReviewIssues.filter((i) => i.severity === 'critical').length;
      const status: PipelinePhaseLog['status'] =
        criticalCount > 0 || !narrativeCheck.consistent ? 'warning' : 'ok';
      pipelineLog.push({
        phase: 'review',
        status,
        durationMs: Date.now() - p4Start,
        detail:
          `LLM: ${llmReviewIssues.length} issues (${criticalCount} critical). ` +
          `Deterministic number check: ${narrativeCheck.consistent ? 'consistent' : `${narrativeCheck.unverifiedNumbers.length} unverified numbers`}`,
      });

      // One regeneration attempt if the deterministic check OR the LLM found
      // critical fabrication — never ship a narrative with invented numbers.
      if (!narrativeCheck.consistent || criticalCount > 0) {
        logger.warn(
          `[BusinessCase] Narrative failed number-consistency check, regenerating once (unverified=${narrativeCheck.unverifiedNumbers.join(',')})`
        );
        const retryPrompt =
          `FAKTY (JEDYNE dozwolone źródło liczb — wklej dosłownie, TWOJA POPRZEDNIA PRÓBA użyła liczb spoza faktów):\n${factsBlock}\n\n` +
          `KONTEKST PLANU:\nProblem: ${plan.problem}\n` +
          `Opcje rozważane: ${plan.options.map((o) => `${o.name} — ${o.description}`).join(' | ')}\n\n` +
          `Napisz rekomendację w formacie W2. UŻYWAJ WYŁĄCZNIE liczb z bloku FAKTY powyżej, dosłownie.`;
        const retryNarrative = await this.callLLM(
          NARRATIVE_SYSTEM_PROMPT,
          retryPrompt,
          llmParams,
          3000
        );
        const retryCheck = checkNarrativeNumbers(retryNarrative, factsBlock);
        if (
          retryNarrative &&
          (retryCheck.consistent ||
            retryCheck.unverifiedNumbers.length < narrativeCheck.unverifiedNumbers.length)
        ) {
          narrative = retryNarrative;
          pipelineLog.push({
            phase: 'review',
            status: retryCheck.consistent ? 'ok' : 'warning',
            durationMs: Date.now() - p4Start,
            detail: `Regenerated narrative after fabrication check (consistent=${retryCheck.consistent})`,
          });
          return {
            id,
            plan,
            model,
            narrative,
            narrativeCheck: retryCheck,
            llmReviewIssues,
            pipelineLog,
            generatedAt: new Date().toISOString(),
          };
        }
      }
    } catch (err) {
      pipelineLog.push({
        phase: 'review',
        status: 'failed',
        durationMs: Date.now() - p4Start,
        detail: String(err),
      });
      logger.warn('[BusinessCase] Phase REVIEW failed', err);
    }

    return {
      id,
      plan,
      model,
      narrative,
      narrativeCheck,
      llmReviewIssues,
      pipelineLog,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const businessCaseService = new BusinessCaseService();
export default businessCaseService;
