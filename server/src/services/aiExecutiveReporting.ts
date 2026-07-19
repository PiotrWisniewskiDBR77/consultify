// @ts-nocheck
/**
 * AI Executive Reporting Service
 *
 * REJESTR T7b-3/4 (2026-07-19): replaces a self-import wrapper
 * (`import service from './aiExecutiveReporting.js'` inside this same file — resolves to
 * itself under tsx's extensionless resolution, so `service` was always undefined at
 * runtime). managementReportsService.generateAiNarrative() dynamic-imports this module and
 * silently falls back to the plain summary whenever the call throws — the fallback masked
 * the fact that the "AI enhancement" never had a real implementation to fall back FROM.
 *
 * This is a minimal, honest fix: one real llmService call (tier STANDARD), grounded in the
 * numbers already computed by managementReportsService (the LLM is told to rephrase/synthesize
 * only — never invent figures), with fail-soft behaviour identical to the old (masked) default.
 */

// NOTE: deliberately NOT the `VITEST === 'true' && MOCK_DB !== 'true'` helper used elsewhere
// in this codebase (e.g. managementReportsService.isUnitTest()) — that check is true for
// EVERY vitest run unless MOCK_DB is exactly 'true', which would also skip the real LLM call
// under the real-Postgres acceptance suite (vitest.acceptance.config.ts sets MOCK_DB='false'
// on purpose). Gate on MOCK_DB alone: a mocked DB implies a fast unit test where a live
// Anthropic call has no business firing; MOCK_DB=false (acceptance/integration/prod) always
// gets the real call.
const shouldSkipLlmCall = () => process.env.MOCK_DB === 'true';

type GenerateReportInput = {
  type?: string;
  scope?: string;
  summary?: string;
  organizationId?: string;
};

type GenerateReportResult = {
  narrative: string;
  warnings: string[];
};

class AiExecutiveReporting {
  /**
   * AI-enhance an executive report narrative. Used by managementReportsService for
   * STEERING_COMMITTEE / PORTFOLIO_HEALTH / RAID reports (the report types where a leadership
   * narrative synthesis is worth the LLM cost — see managementReportsService.generateAiNarrative).
   *
   * Grounding rule enforced via the system prompt: the model may only rephrase/synthesize the
   * supplied summary text — it is explicitly told not to invent numbers, names, or dates that
   * are not present in the input.
   */
  async generateReport({
    type,
    scope,
    summary,
    organizationId,
  }: GenerateReportInput): Promise<GenerateReportResult> {
    const baseSummary = String(summary || '').trim();
    if (!baseSummary) {
      return { narrative: baseSummary, warnings: [] };
    }
    if (shouldSkipLlmCall()) {
      return { narrative: baseSummary, warnings: [] };
    }

    try {
      const { llmService } = await import('./ai/llmService.js');
      const modelRouter = (await import('./ai/modelRouter.js')).default;

      const modelCfg = await modelRouter.select({
        capability: 'report_section',
        organizationId,
        options: { tier: 'STANDARD' },
      });

      const result = await llmService.callText({
        type: 'text',
        modelConfig: { id: modelCfg.id, provider: modelCfg.provider },
        systemPrompt:
          'You are a PMO executive-reporting assistant. Rewrite the given status summary as a ' +
          'concise 2-3 sentence executive narrative suitable for a steering committee. Use ONLY ' +
          'the facts and numbers already present in the input text — never invent figures, names, ' +
          'or dates that are not there. Plain prose, no markdown, no headings.',
        messages: [
          {
            role: 'user',
            content: `Report type: ${type || 'UNKNOWN'}\nScope: ${scope || 'UNKNOWN'}\nSummary:\n${baseSummary}`,
          },
        ],
        temperature: 0.3,
        maxTokens: 300,
        timeoutMs: 20000,
      });

      const narrative = String((result as any)?.content || '').trim();
      if (!narrative) {
        return { narrative: baseSummary, warnings: ['AI narrative was empty; using summary'] };
      }
      return { narrative, warnings: [] };
    } catch (error: any) {
      return {
        narrative: baseSummary,
        warnings: [`AI enhancement unavailable: ${error?.message || 'unknown error'}`],
      };
    }
  }

  /**
   * Deliberately non-LLM narrative pass for high-frequency reports (TEAM_MEETING /
   * TEAM_WEEKLY) — managementReportsService only reaches this path for those two report
   * types (see the reportType guard around `aiService.generateReport` in
   * generateAiNarrative()), where running a paid LLM call on every weekly/team-meeting
   * report generation isn't justified. Kept synchronous on purpose: the caller does not
   * await this method.
   */
  translateToNarrative(summary: string): string {
    return String(summary || '').trim();
  }
}

const aiExecutiveReporting = new AiExecutiveReporting();
export default aiExecutiveReporting;
