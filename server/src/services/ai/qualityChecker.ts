/**
 * Quality Checker Service v2.0
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Scores AI responses using hybrid approach:
 * - Fast heuristic checks (always run)
 * - LLM-as-Judge evaluation (for PREMIUM/REASONING tier responses)
 *
 * Dimensions: relevance, groundedness, completeness, coherence, actionability, mece_quality
 */
import { run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export interface QualityScore {
  relevance: number;
  groundedness: number;
  completeness: number;
  coherence: number;
  actionability: number;
  meceQuality: number;
  overall: number;
  flags: string[];
  llmJudged: boolean;
}

const W = {
  relevance: 0.2,
  groundedness: 0.2,
  completeness: 0.15,
  coherence: 0.15,
  actionability: 0.15,
  meceQuality: 0.15,
};

// Common PL/EN stopwords >3 chars that leak through the length filter and
// pollute keyword-overlap relevance (they appear in almost any response).
const STOPWORDS = new Set([
  // Polish
  'oraz',
  'albo',
  'jako',
  'żeby',
  'aby',
  'czyli',
  'jest',
  'jestem',
  'jaki',
  'jaka',
  'jakie',
  'który',
  'która',
  'które',
  'żeby',
  'dla',
  'przez',
  'oraz',
  'więc',
  'tego',
  'tych',
  'taki',
  'taka',
  'takie',
  'mnie',
  'ciebie',
  'proszę',
  'zrób',
  'zrobić',
  'stwórz',
  'przygotuj',
  'napisz',
  // English
  'that',
  'this',
  'these',
  'those',
  'with',
  'from',
  'have',
  'about',
  'your',
  'please',
  'make',
  'create',
  'write',
  'give',
  'want',
  'would',
  'could',
  'should',
  'what',
  'which',
  'when',
  'where',
  'them',
  'they',
  'into',
]);

const HALLUC = [
  'as everyone knows',
  'it is well known',
  'studies show',
  'research proves',
  'jak powszechnie wiadomo',
  'badania dowodzą',
  'jak wynika z badań',
];
const VAGUE_PHRASES = [
  'in general',
  'usually',
  'it depends',
  'more or less',
  'ogólnie rzecz biorąc',
  'to zależy',
  'mniej więcej',
  'zasadniczo',
];
const ACTION_MARKERS = [
  'recommend',
  'suggest',
  'next step',
  'action item',
  'deadline',
  'owner',
  'rekomenduj',
  'proponuj',
  'następny krok',
  'termin',
  'właściciel',
  'odpowiedzialny',
];

class QualityCheckerService {
  private llmClient: any = null;

  /**
   * Set LLM client for LLM-as-Judge evaluation.
   */
  setLLMClient(client: any): void {
    this.llmClient = client;
  }

  /**
   * Full quality check — heuristic + optional LLM judge.
   */
  async check(input: {
    question: string;
    response: string;
    context?: string;
    conversationId?: string;
    messageId?: string;
    userId?: string;
    organizationId?: string;
    tier?: string;
  }): Promise<QualityScore> {
    const { question, response, context } = input;
    const flags: string[] = [];

    if (!response?.trim()) {
      return {
        relevance: 0,
        groundedness: 0,
        completeness: 0,
        coherence: 0,
        actionability: 0,
        meceQuality: 0,
        overall: 0,
        flags: ['empty_response'],
        llmJudged: false,
      };
    }

    // Phase 1: Fast heuristic scoring (always)
    const relevance = this.scoreRelevance(question, response, flags);
    const groundedness = this.scoreGroundedness(response, context, flags);
    const completeness = this.scoreCompleteness(question, response, flags);
    const coherence = this.scoreCoherence(response, flags);
    const actionability = this.scoreActionability(question, response, flags);
    const meceQuality = this.scoreMECE(response, flags);

    let score: QualityScore = {
      relevance: rnd(relevance),
      groundedness: rnd(groundedness),
      completeness: rnd(completeness),
      coherence: rnd(coherence),
      actionability: rnd(actionability),
      meceQuality: rnd(meceQuality),
      overall: rnd(
        relevance * W.relevance +
          groundedness * W.groundedness +
          completeness * W.completeness +
          coherence * W.coherence +
          actionability * W.actionability +
          meceQuality * W.meceQuality
      ),
      flags,
      llmJudged: false,
    };

    // Phase 2: LLM-as-Judge (for premium responses, if client available)
    const isPremiumTier = input.tier === 'PREMIUM' || input.tier === 'REASONING';
    if (isPremiumTier && this.llmClient && response.length > 200) {
      try {
        const llmScore = await this.llmJudge(question, response, context);
        if (llmScore) {
          // Blend: 40% heuristic + 60% LLM judge
          score = {
            relevance: rnd(score.relevance * 0.4 + llmScore.relevance * 0.6),
            groundedness: rnd(score.groundedness * 0.4 + llmScore.groundedness * 0.6),
            completeness: rnd(score.completeness * 0.4 + llmScore.completeness * 0.6),
            coherence: rnd(score.coherence * 0.4 + llmScore.coherence * 0.6),
            actionability: rnd(score.actionability * 0.4 + llmScore.actionability * 0.6),
            meceQuality: rnd(score.meceQuality * 0.4 + llmScore.meceQuality * 0.6),
            overall: 0,
            flags: [...flags, ...llmScore.flags],
            llmJudged: true,
          };
          score.overall = rnd(
            score.relevance * W.relevance +
              score.groundedness * W.groundedness +
              score.completeness * W.completeness +
              score.coherence * W.coherence +
              score.actionability * W.actionability +
              score.meceQuality * W.meceQuality
          );
        }
      } catch (err: any) {
        logger.warn(`[QualityChecker] LLM judge failed, using heuristics only: ${err?.message}`);
      }
    }

    // Persist quality metrics to DB (non-blocking — schema varies: 520 has conversation_id, 251 has metric_date)
    dbRun(
      `INSERT INTO ai_quality_metrics (conversation_id,message_id,user_id,organization_id,relevance,groundedness,completeness,coherence,overall_score,flags,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        input.conversationId || null,
        input.messageId || null,
        input.userId || null,
        input.organizationId || null,
        score.relevance,
        score.groundedness,
        score.completeness,
        score.coherence,
        score.overall,
        JSON.stringify(score.flags),
        new Date().toISOString(),
      ]
    ).catch((err: any) => {
      logger.debug(`[QualityChecker] Persist metrics skipped (schema may differ): ${err?.message}`);
    });

    logger.debug(
      `[QualityChecker] Score=${score.overall} R=${score.relevance} G=${score.groundedness} A=${score.actionability} M=${score.meceQuality} llm=${score.llmJudged}`
    );
    return score;
  }

  // ==========================================
  // LLM-as-Judge (R14)
  // ==========================================

  private async llmJudge(
    question: string,
    response: string,
    context?: string
  ): Promise<{
    relevance: number;
    groundedness: number;
    completeness: number;
    coherence: number;
    actionability: number;
    meceQuality: number;
    flags: string[];
  } | null> {
    if (!this.llmClient) return null;

    const prompt = `You are a senior quality auditor at McKinsey & Company. Evaluate this AI consulting response.

QUESTION: "${question.slice(0, 500)}"

RESPONSE (first 3000 chars):
"""
${response.slice(0, 3000)}
"""

${context ? `AVAILABLE CONTEXT (first 1000 chars):\n"""${context.slice(0, 1000)}"""` : 'No additional context provided.'}

Rate each dimension 0.0 to 1.0:

1. RELEVANCE: Does the response directly address the question? (0=off-topic, 1=perfectly targeted)
2. GROUNDEDNESS: Is it based on provided context/data, not hallucinated? (0=fabricated, 1=fully grounded)
3. COMPLETENESS: Does it cover all aspects of the question? (0=superficial, 1=comprehensive)
4. COHERENCE: Is it well-structured and logical? (0=chaotic, 1=crystal clear)
5. ACTIONABILITY: Does it provide specific, implementable recommendations with owners/deadlines? (0=vague advice, 1=concrete action plan)
6. MECE_QUALITY: Is the analysis mutually exclusive and collectively exhaustive? (0=overlapping/incomplete, 1=perfect MECE)

Also list any FLAGS (issues): empty string if none, otherwise comma-separated from:
- hallucination_detected: claims not supported by context
- vague_recommendations: advice without specifics
- missing_data_acknowledgment: claims data exists when it doesn't
- single_perspective: lacks alternative viewpoints
- no_risk_analysis: omits risks/downsides
- consultant_soup: jargon without substance

Respond ONLY with valid JSON:
{"relevance":0.0,"groundedness":0.0,"completeness":0.0,"coherence":0.0,"actionability":0.0,"meceQuality":0.0,"flags":""}`;

    try {
      const result = await this.llmClient.chat.completions.create({
        model: 'gpt-4o-mini', // Cost-effective judge
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      });

      const raw = result.choices?.[0]?.message?.content;
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      const flags: string[] = parsed.flags
        ? String(parsed.flags)
            .split(',')
            .map((f: string) => f.trim())
            .filter(Boolean)
        : [];

      return {
        relevance: clamp(parsed.relevance),
        groundedness: clamp(parsed.groundedness),
        completeness: clamp(parsed.completeness),
        coherence: clamp(parsed.coherence),
        actionability: clamp(parsed.actionability),
        meceQuality: clamp(parsed.meceQuality),
        flags,
      };
    } catch (err: any) {
      logger.warn(`[QualityChecker] LLM judge parse error: ${err?.message}`);
      return null;
    }
  }

  // ==========================================
  // Heuristic Scoring
  // ==========================================

  private scoreRelevance(q: string, resp: string, flags: string[]): number {
    // Extract meaningful content words from the question, dropping stopwords
    // (PL + EN). Short function words (<=3 chars) are also dropped.
    const words = q
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w));

    // If the question carries no content keywords (greetings, "zrób to",
    // ultra-short imperatives), keyword-overlap is meaningless — do NOT punish.
    if (!words.length) return 0.7;

    const rl = resp.toLowerCase();

    // Inflection-tolerant match: Polish/English words change endings, so an
    // exact substring `includes` misses paraphrases ("prezentację" vs
    // "prezentacja"). Match on a stemmed prefix instead.
    const matched = words.filter((w) => {
      if (rl.includes(w)) return true;
      const stem = w.slice(0, Math.max(4, w.length - 2)); // drop up to 2 trailing chars
      return stem.length >= 4 && rl.includes(stem);
    }).length;
    const ratio = matched / words.length;

    // Genuinely truncated answer to a substantial question — real low signal.
    if (q.length > 100 && resp.length < 50) {
      flags.push('response_too_short');
      return Math.min(ratio, 0.3);
    }

    // Bag-of-words overlap is a WEAK proxy: a correct answer routinely
    // paraphrases the prompt and scores low overlap. Blend the overlap signal
    // with a substance floor so that a non-empty, sizeable response can never
    // collapse to relevance=0 purely because it reworded the question. A hard
    // 0 was the root cause of misleadingly low `overall`.
    const overlapScore = Math.min(1, ratio * 1.2);
    const hasSubstance = resp.trim().length >= 80;
    const floor = hasSubstance ? 0.5 : 0.25;
    const s = Math.max(floor, overlapScore);

    if (overlapScore < 0.15 && !hasSubstance) flags.push('low_relevance');
    return s;
  }

  private scoreGroundedness(resp: string, ctx: string | undefined, flags: string[]): number {
    if (!ctx?.trim()) {
      const hc = HALLUC.filter((s) => resp.toLowerCase().includes(s)).length;
      if (hc) {
        flags.push('hallucination_signals');
        return Math.max(0.2, 0.7 - hc * 0.15);
      }
      return 0.5;
    }
    const sents = resp.split(/[.!?]\s+/).filter((s) => s.length > 10);
    if (!sents.length) return 0.5;
    const cl = ctx.toLowerCase();
    let grounded = 0;
    for (const s of sents) {
      const kw = s
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3);
      if (kw.filter((w) => cl.includes(w)).length / Math.max(kw.length, 1) > 0.3) grounded++;
    }
    const ratio = grounded / sents.length;
    if (ratio < 0.3) flags.push('low_groundedness');
    return ratio;
  }

  private scoreCompleteness(q: string, resp: string, flags: string[]): number {
    let complexity = 1;
    if (/and|also|oraz/i.test(q)) complexity++;
    if (/compare|analyze|explain|porównaj|analizuj/i.test(q)) complexity++;
    if (q.length > 200) complexity++;
    const expected = complexity * 100;
    const s = Math.min(1, resp.length / Math.max(expected, 100));
    if (/I don't know|nie wiem|brak danych/i.test(resp)) {
      flags.push('admits_limitation');
      return Math.max(s, 0.4);
    }
    if (s < 0.3) flags.push('low_completeness');
    return s;
  }

  private scoreCoherence(resp: string, flags: string[]): number {
    let s = 0.5;
    // Reward structure
    if (/^#{1,3}\s/m.test(resp) || /^\d+\.\s/m.test(resp) || /^[-*]\s/m.test(resp)) s += 0.15;
    if (resp.split(/\n\n+/).filter((p) => p.trim()).length > 1) s += 0.1;
    // Reward Pyramid Principle markers
    if (/\b(SO WHAT|WNIOSEK|RECOMMENDATION|REKOMENDACJA)\b/i.test(resp)) s += 0.1;
    // Penalize repetition
    const words = resp.toLowerCase().split(/\s+/);
    if (new Set(words).size / Math.max(words.length, 1) < 0.4) {
      flags.push('high_repetition');
      s -= 0.2;
    }
    return Math.max(0, Math.min(1, s));
  }

  /**
   * Score actionability — does the response provide specific, implementable steps?
   */
  private scoreActionability(q: string, resp: string, flags: string[]): number {
    const rl = resp.toLowerCase();
    let s = 0.3; // base

    // Check for action markers
    const actionHits = ACTION_MARKERS.filter((m) => rl.includes(m)).length;
    s += Math.min(0.3, actionHits * 0.06);

    // Check for specific elements: deadlines, owners, metrics
    if (/\b(Q[1-4]|tydzień|tygodni|dni|week|month|day)\b/i.test(resp)) s += 0.1; // timeline
    if (/\b(owner|właściciel|odpowiedzialny|responsible)\b/i.test(resp)) s += 0.1; // ownership
    if (/\b(\d+%|\$\d|PLN|EUR|USD)\b/.test(resp)) s += 0.1; // metrics

    // Penalize vagueness
    const vagueHits = VAGUE_PHRASES.filter((p) => rl.includes(p)).length;
    if (vagueHits > 2) {
      flags.push('vague_recommendations');
      s -= 0.15;
    }

    // Informational questions don't need high actionability
    if (/\b(what is|co to|explain|wyjaśnij|describe|opisz)\b/i.test(q)) {
      s = Math.max(s, 0.6); // floor for informational
    }

    return Math.max(0, Math.min(1, s));
  }

  /**
   * Score MECE quality — is the analysis structured and comprehensive?
   */
  private scoreMECE(resp: string, flags: string[]): number {
    let s = 0.4; // base

    // Reward structured lists (numbered or bulleted)
    const numberedItems = (resp.match(/^\d+\.\s/gm) || []).length;
    const bulletItems = (resp.match(/^[-*•]\s/gm) || []).length;
    const totalItems = numberedItems + bulletItems;

    if (totalItems >= 3 && totalItems <= 7)
      s += 0.2; // sweet spot for MECE
    else if (totalItems >= 2) s += 0.1;

    // Reward headers (structured thinking)
    const headerCount = (resp.match(/^#{1,3}\s/gm) || []).length;
    if (headerCount >= 2 && headerCount <= 6) s += 0.15;

    // Reward MECE/framework markers
    if (
      /\b(MECE|mutually exclusive|wzajemnie wykluczając|collectively exhaustive|wspólnie wyczerpując)\b/i.test(
        resp
      )
    )
      s += 0.15;
    if (/\b(framework|Issue Tree|Pyramid|80\/20|Pareto|SWOT|Porter)\b/i.test(resp)) s += 0.1;

    // Penalize single-perspective / no alternatives
    if (
      resp.length > 500 &&
      !/\b(alternatively|however|on the other hand|z drugiej strony|natomiast|alternatywnie)\b/i.test(
        resp
      )
    ) {
      flags.push('single_perspective');
      s -= 0.1;
    }

    return Math.max(0, Math.min(1, s));
  }
}

function rnd(n: number) {
  return Math.round(n * 100) / 100;
}

function clamp(n: any): number {
  const v = typeof n === 'number' ? n : parseFloat(n);
  if (isNaN(v)) return 0.5;
  return Math.max(0, Math.min(1, v));
}

export const qualityChecker = new QualityCheckerService();
export default qualityChecker;
export { QualityCheckerService };
