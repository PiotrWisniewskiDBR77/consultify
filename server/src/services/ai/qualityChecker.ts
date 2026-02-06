/**
 * Quality Checker Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Scores AI responses: relevance, groundedness, completeness, coherence.
 */
import { run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export interface QualityScore {
  relevance: number;
  groundedness: number;
  completeness: number;
  coherence: number;
  overall: number;
  flags: string[];
}

const W = { relevance: 0.3, groundedness: 0.3, completeness: 0.2, coherence: 0.2 };
const HALLUC = ['as everyone knows', 'it is well known', 'studies show', 'research proves'];

class QualityCheckerService {
  async check(input: {
    question: string;
    response: string;
    context?: string;
    conversationId?: string;
    messageId?: string;
    userId?: string;
    organizationId?: string;
  }): Promise<QualityScore> {
    const { question, response, context } = input;
    const flags: string[] = [];
    if (!response?.trim())
      return {
        relevance: 0,
        groundedness: 0,
        completeness: 0,
        coherence: 0,
        overall: 0,
        flags: ['empty_response'],
      };

    const relevance = this.scoreRelevance(question, response, flags);
    const groundedness = this.scoreGroundedness(response, context, flags);
    const completeness = this.scoreCompleteness(question, response, flags);
    const coherence = this.scoreCoherence(response, flags);
    const overall =
      relevance * W.relevance +
      groundedness * W.groundedness +
      completeness * W.completeness +
      coherence * W.coherence;
    const score = {
      relevance: rnd(relevance),
      groundedness: rnd(groundedness),
      completeness: rnd(completeness),
      coherence: rnd(coherence),
      overall: rnd(overall),
      flags,
    };

    try {
      await dbRun(
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
          JSON.stringify(flags),
          new Date().toISOString(),
        ]
      );
    } catch {
      /* table may not exist */
    }

    logger.debug(
      `[QualityChecker] Score=${score.overall} R=${score.relevance} G=${score.groundedness}`
    );
    return score;
  }

  private scoreRelevance(q: string, resp: string, flags: string[]): number {
    const words = q
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3);
    if (!words.length) return 0.7;
    const rl = resp.toLowerCase();
    const ratio = words.filter((w) => rl.includes(w)).length / words.length;
    if (q.length > 100 && resp.length < 50) {
      flags.push('response_too_short');
      return Math.min(ratio, 0.3);
    }
    const s = Math.min(1, ratio * 1.2);
    if (s < 0.3) flags.push('low_relevance');
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
    if (/compare|analyze|explain/i.test(q)) complexity++;
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
    if (/^#{1,3}\s/m.test(resp) || /^\d+\.\s/m.test(resp) || /^[-*]\s/m.test(resp)) s += 0.15;
    if (resp.split(/\n\n+/).filter((p) => p.trim()).length > 1) s += 0.1;
    const words = resp.toLowerCase().split(/\s+/);
    if (new Set(words).size / Math.max(words.length, 1) < 0.4) {
      flags.push('high_repetition');
      s -= 0.2;
    }
    return Math.max(0, Math.min(1, s));
  }
}

function rnd(n: number) {
  return Math.round(n * 100) / 100;
}

export const qualityChecker = new QualityCheckerService();
export default qualityChecker;
export { QualityCheckerService };
