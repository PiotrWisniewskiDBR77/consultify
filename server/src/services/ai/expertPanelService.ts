/**
 * Expert Panel Service (R6)
 *
 * For PREMIUM/REASONING tier requests, runs parallel expert analysis
 * across multiple models and synthesizes into one cohesive response.
 *
 * Think of it as assembling a consulting team:
 * - Model A: Structural analysis (frameworks, MECE)
 * - Model B: Devil's advocate (risks, edge cases, counter-arguments)
 * - Model C: Synthesis & recommendation
 *
 * @version 1.0.0
 */

import logger from '../../utils/Logger.js';
import { llmService } from './llmService.js';

// ==========================================
// TYPES
// ==========================================

export interface ExpertPanelRequest {
  question: string;
  context?: string;
  organizationId?: string;
  userId?: string;
  language?: string;
}

export interface ExpertPerspective {
  role: string;
  model: string;
  analysis: string;
  latencyMs: number;
}

export interface ExpertPanelResult {
  perspectives: ExpertPerspective[];
  synthesis: string;
  totalLatencyMs: number;
  modelsUsed: string[];
}

// ==========================================
// EXPERT DEFINITIONS
// ==========================================

const EXPERT_PROMPTS: Record<string, (question: string, context?: string) => string> = {
  structural_analyst: (q, ctx) =>
    `You are a McKinsey structural analyst. Analyze this question using MECE frameworks.
Break the problem into mutually exclusive, collectively exhaustive components.
Identify the 2-3 most critical sub-questions. Be precise and data-driven.

${ctx ? `Context:\n${ctx}\n\n` : ''}Question: ${q}

Provide ONLY the structured analysis (max 400 words). Use numbered lists and headers.`,

  devils_advocate: (q, ctx) =>
    `You are a senior risk advisor and devil's advocate. Your job is to challenge assumptions, identify risks, and present counter-arguments.

${ctx ? `Context:\n${ctx}\n\n` : ''}Question: ${q}

For this question, identify:
1. What assumptions are being made (explicit and implicit)?
2. What could go wrong? (Top 3 risks with impact/probability)
3. What alternative perspective should be considered?
4. What data would change the recommendation?

Be specific and constructive. Max 300 words.`,

  synthesis_lead: (q, ctx) =>
    `You are a BCG senior partner synthesizing expert opinions into a final recommendation.

${ctx ? `Context:\n${ctx}\n\n` : ''}Question: ${q}`,
};

// ==========================================
// SERVICE
// ==========================================

class ExpertPanelService {
  /**
   * Run expert panel analysis on a complex question.
   * Runs structural analysis and devil's advocate in parallel,
   * then synthesizes with a lead model.
   */
  async analyze(request: ExpertPanelRequest): Promise<ExpertPanelResult> {
    const startTime = Date.now();
    const perspectives: ExpertPerspective[] = [];

    logger.info(`[ExpertPanel] Starting analysis for: "${request.question.slice(0, 80)}..."`);

    // Phase 1: Parallel expert analysis
    const [structuralResult, advocateResult] = await Promise.allSettled([
      this.runExpert('structural_analyst', 'gpt-4o-mini', request),
      this.runExpert('devils_advocate', 'gpt-4o-mini', request),
    ]);

    if (structuralResult.status === 'fulfilled') {
      perspectives.push(structuralResult.value);
    }
    if (advocateResult.status === 'fulfilled') {
      perspectives.push(advocateResult.value);
    }

    // Phase 2: Synthesis by lead model (uses the expert outputs)
    const synthesisPrompt = this.buildSynthesisPrompt(
      request.question,
      perspectives,
      request.context,
      request.language
    );

    let synthesis = '';
    try {
      const synthStart = Date.now();
      const client = await this.getOpenAIClient();
      if (client) {
        const response = await client.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: synthesisPrompt }],
          temperature: 0.4,
          max_tokens: 4000,
        });
        synthesis = response.choices?.[0]?.message?.content || '';
        perspectives.push({
          role: 'synthesis_lead',
          model: 'gpt-4o',
          analysis: synthesis,
          latencyMs: Date.now() - synthStart,
        });
      }
    } catch (err: any) {
      logger.warn(`[ExpertPanel] Synthesis failed: ${err.message}`);
      // Fallback: combine expert outputs directly
      synthesis = perspectives
        .map((p) => `### ${p.role.replace(/_/g, ' ').toUpperCase()}\n${p.analysis}`)
        .join('\n\n');
    }

    const totalLatencyMs = Date.now() - startTime;
    logger.info(
      `[ExpertPanel] Analysis complete in ${totalLatencyMs}ms, ${perspectives.length} perspectives`
    );

    return {
      perspectives,
      synthesis,
      totalLatencyMs,
      modelsUsed: [...new Set(perspectives.map((p) => p.model))],
    };
  }

  /**
   * Check if a question warrants expert panel (complex strategic question).
   */
  isComplexStrategicQuestion(question: string): boolean {
    const complexMarkers = [
      'strategic',
      'strategiczn',
      'compare',
      'porównaj',
      'evaluate',
      'oceń',
      'analyze impact',
      'analiz',
      'trade-off',
      'decision',
      'decyzj',
      'invest',
      'inwestycj',
      'recommend',
      'rekomend',
      'risk assessment',
      'portfolio',
      'transformation',
      'transformacj',
      'roadmap',
      'should we',
      'czy powinniśmy',
      'what approach',
      'jakie podejście',
    ];

    const q = question.toLowerCase();
    const hitCount = complexMarkers.filter((m) => q.includes(m)).length;
    return hitCount >= 2 || question.length > 300;
  }

  // ==========================================
  // PRIVATE METHODS
  // ==========================================

  private async runExpert(
    role: string,
    model: string,
    request: ExpertPanelRequest
  ): Promise<ExpertPerspective> {
    const start = Date.now();
    const promptFn = EXPERT_PROMPTS[role];
    if (!promptFn) throw new Error(`Unknown expert role: ${role}`);

    const prompt = promptFn(request.question, request.context?.slice(0, 2000));

    try {
      const client = await this.getOpenAIClient();
      if (!client) throw new Error('No LLM client available');

      const response = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1500,
      });

      return {
        role,
        model,
        analysis: response.choices?.[0]?.message?.content || '',
        latencyMs: Date.now() - start,
      };
    } catch (err: any) {
      logger.warn(`[ExpertPanel] Expert ${role} failed: ${err.message}`);
      return {
        role,
        model,
        analysis: `[Expert ${role} unavailable]`,
        latencyMs: Date.now() - start,
      };
    }
  }

  private buildSynthesisPrompt(
    question: string,
    perspectives: ExpertPerspective[],
    context?: string,
    language?: string
  ): string {
    const lang = language === 'pl' ? 'pl' : 'en';

    const expertSections = perspectives
      .map((p) => `=== ${p.role.replace(/_/g, ' ').toUpperCase()} ===\n${p.analysis}`)
      .join('\n\n');

    if (lang === 'pl') {
      return `Jesteś senior partnerem BCG. Twój zespół ekspertów przeanalizował poniższe pytanie. \
Zsyntezuj ich analizy w jedną spójną, wykonalną odpowiedź.

PYTANIE: ${question}

${context ? `KONTEKST:\n${context.slice(0, 2000)}\n\n` : ''}ANALIZY EKSPERTÓW:
${expertSections}

INSTRUKCJE SYNTEZY:
1. Zacznij od WNIOSKU (1-2 zdania — co klient powinien zrobić)
2. Przedstaw 3-4 kluczowe argumenty (MECE)
3. Uwzględnij ryzyka zidentyfikowane przez devil's advocate
4. Zakończ konkretnymi next steps (owner, termin, metryka)
5. Nie powtarzaj analizy ekspertów — zsyntezuj i dodaj wartość.`;
    }

    return `You are a BCG senior partner. Your expert team has analyzed the following question. \
Synthesize their analyses into one cohesive, actionable response.

QUESTION: ${question}

${context ? `CONTEXT:\n${context.slice(0, 2000)}\n\n` : ''}EXPERT ANALYSES:
${expertSections}

SYNTHESIS INSTRUCTIONS:
1. Lead with the CONCLUSION (1-2 sentences — what the client should do)
2. Present 3-4 key arguments (MECE)
3. Incorporate risks identified by the devil's advocate
4. End with specific next steps (owner, deadline, metric)
5. Don't repeat expert analysis — synthesize and add value.`;
  }

  private async getOpenAIClient(): Promise<any> {
    try {
      const OpenAI = (await import('openai')).default;
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) return null;
      return new OpenAI({ apiKey });
    } catch {
      return null;
    }
  }
}

const expertPanelService = new ExpertPanelService();
export default expertPanelService;
export { ExpertPanelService, expertPanelService };
