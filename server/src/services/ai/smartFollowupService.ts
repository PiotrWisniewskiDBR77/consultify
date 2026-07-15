/**
 * Smart Follow-up Service
 *
 * Generates dynamic, contextual follow-up suggestions after each
 * AI response. Uses a lightweight model to produce 2-3 relevant
 * next questions based on the response content and screen context.
 */
import logger from '../../utils/Logger.js';

export interface FollowupSuggestion {
  text: string;
  type: 'deepDive' | 'alternative' | 'action' | 'comparison';
  confidence: number;
}

class SmartFollowupService {
  private llmClient: any = null;

  setLLMClient(client: any): void {
    this.llmClient = client;
  }

  async generateSuggestions(input: {
    question: string;
    response: string;
    screenContext?: string;
    language?: string;
    /** Required (alongside userId) to take the LLM path — the adapter needs a tenant to bill/scope the call against. */
    organizationId?: string;
    userId?: string;
  }): Promise<FollowupSuggestion[]> {
    if (this.llmClient && input.response.length > 50 && input.organizationId && input.userId) {
      return this.generateWithLLM(input);
    }
    return this.generateHeuristic(input);
  }

  private async generateWithLLM(input: {
    question: string;
    response: string;
    screenContext?: string;
    language?: string;
    organizationId?: string;
    userId?: string;
  }): Promise<FollowupSuggestion[]> {
    const lang = input.language === 'pl' ? 'Polish' : 'English';

    try {
      const result = await this.llmClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Generate exactly 3 follow-up question suggestions in ${lang}. Each should be a different type: one for deeper analysis, one for alternative perspective, one for action steps. Keep each under 80 characters. Respond as JSON array: [{"text":"...","type":"deepDive|alternative|action"}]`,
          },
          {
            role: 'user',
            content: `Q: "${input.question.slice(0, 200)}"\nA (summary): "${input.response.slice(0, 500)}"${input.screenContext ? `\nScreen: ${input.screenContext}` : ''}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 300,
        response_format: { type: 'json_object' },
        // Not part of the OpenAI wire format — passed through so a tenant-aware
        // adapter (see routes/ai/smart-followup.routes.ts) can route the call
        // through the org's configured LLM pipeline without relying on shared
        // mutable state on this singleton (which would be a cross-tenant race).
        organizationId: input.organizationId,
        userId: input.userId,
      });

      const raw = result.choices?.[0]?.message?.content;
      const parsed = JSON.parse(raw || '{}');
      const suggestions = Array.isArray(parsed) ? parsed : parsed.suggestions || [];

      return suggestions.slice(0, 3).map((s: any) => ({
        text: String(s.text || '').slice(0, 100),
        type: s.type || 'deepDive',
        confidence: 0.85,
      }));
    } catch (err: any) {
      logger.debug(`[SmartFollowup] LLM generation failed: ${err?.message}`);
      return this.generateHeuristic(input);
    }
  }

  private generateHeuristic(input: {
    question: string;
    response: string;
    screenContext?: string;
    language?: string;
  }): FollowupSuggestion[] {
    const isPl = input.language === 'pl';
    const suggestions: FollowupSuggestion[] = [];

    if (/\b(ROI|cost|budget|financial|koszt|budżet)\b/i.test(input.response)) {
      suggestions.push({
        text: isPl
          ? 'Jakie są ryzyka finansowe tego podejścia?'
          : 'What are the financial risks of this approach?',
        type: 'deepDive',
        confidence: 0.7,
      });
    }

    if (/\b(initiative|projekt|project)\b/i.test(input.response)) {
      suggestions.push({
        text: isPl
          ? 'Porównaj to z alternatywnymi rozwiązaniami'
          : 'Compare this with alternative solutions',
        type: 'alternative',
        confidence: 0.65,
      });
    }

    suggestions.push({
      text: isPl ? 'Jakie powinny być następne kroki?' : 'What should be the next steps?',
      type: 'action',
      confidence: 0.6,
    });

    if (suggestions.length < 3) {
      suggestions.push({
        text: isPl
          ? 'Rozwiń ten temat bardziej szczegółowo'
          : 'Elaborate on this topic in more detail',
        type: 'deepDive',
        confidence: 0.5,
      });
    }

    return suggestions.slice(0, 3);
  }
}

export const smartFollowupService = new SmartFollowupService();
export default smartFollowupService;
