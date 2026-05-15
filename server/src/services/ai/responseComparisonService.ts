/**
 * Response Comparison Service
 *
 * Generates parallel responses in different styles or from
 * different models for side-by-side comparison. Supports:
 * - Style comparison (Executive vs Analyst vs Technical)
 * - Model comparison (GPT-4o vs Claude)
 * - Diff view highlighting differences
 */
import logger from '../../utils/Logger.js';

export interface ComparisonRequest {
  question: string;
  context?: string;
  variants: Array<{
    id: string;
    label: string;
    model?: string;
    style?: string;
    systemPromptOverride?: string;
  }>;
  organizationId: string;
  userId: string;
}

export interface ComparisonVariant {
  id: string;
  label: string;
  model: string;
  response: string;
  latencyMs: number;
  tokensUsed: number;
  qualityScore?: number;
}

export interface ComparisonResult {
  question: string;
  variants: ComparisonVariant[];
  differences: Array<{
    section: string;
    variant1Excerpt: string;
    variant2Excerpt: string;
  }>;
  recommendation?: string;
}

const STYLE_PROMPTS: Record<string, string> = {
  executive:
    'Respond as a senior C-level executive advisor. Be concise, strategic, and focus on business impact. Use executive-level language.',
  analyst:
    'Respond as a detailed business analyst. Provide thorough data-driven analysis with specific metrics, comparisons, and evidence.',
  technical:
    'Respond as a technical expert. Focus on implementation details, architecture, feasibility, and technical trade-offs.',
  consultant:
    'Respond as a McKinsey-style strategic consultant using the Pyramid Principle. Lead with the answer, then support with MECE arguments.',
  simplified:
    'Respond in simple, plain language suitable for non-technical stakeholders. Avoid jargon. Use analogies where helpful.',
};

class ResponseComparisonService {
  private llmClients: Map<string, any> = new Map();

  registerModel(modelId: string, client: any): void {
    this.llmClients.set(modelId, client);
  }

  async compare(request: ComparisonRequest): Promise<ComparisonResult> {
    const variantPromises = request.variants.map(async (variant) => {
      const startMs = Date.now();
      const client =
        this.llmClients.get(variant.model || 'default') || this.llmClients.values().next().value;

      if (!client) {
        return {
          id: variant.id,
          label: variant.label,
          model: variant.model || 'default',
          response: '[Model not available for comparison]',
          latencyMs: 0,
          tokensUsed: 0,
        };
      }

      const systemPrompt =
        variant.systemPromptOverride ||
        STYLE_PROMPTS[variant.style || ''] ||
        'You are a helpful AI assistant.';

      try {
        const result = await client.chat.completions.create({
          model: variant.model || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            ...(request.context
              ? [{ role: 'system' as const, content: `Context: ${request.context.slice(0, 2000)}` }]
              : []),
            { role: 'user' as const, content: request.question },
          ],
          temperature: 0.5,
          max_tokens: 1500,
        });

        const response = result.choices?.[0]?.message?.content || '';
        const tokensUsed = result.usage?.total_tokens || 0;

        return {
          id: variant.id,
          label: variant.label,
          model: variant.model || 'default',
          response,
          latencyMs: Date.now() - startMs,
          tokensUsed,
        };
      } catch (err: any) {
        return {
          id: variant.id,
          label: variant.label,
          model: variant.model || 'default',
          response: `[Error: ${err?.message}]`,
          latencyMs: Date.now() - startMs,
          tokensUsed: 0,
        };
      }
    });

    const variants = await Promise.all(variantPromises);

    const differences = this.computeDifferences(variants);

    return {
      question: request.question,
      variants,
      differences,
    };
  }

  private computeDifferences(variants: ComparisonVariant[]): ComparisonResult['differences'] {
    if (variants.length < 2) return [];

    const v1Sections = this.splitIntoSections(variants[0].response);
    const v2Sections = this.splitIntoSections(variants[1].response);

    const diffs: ComparisonResult['differences'] = [];

    const maxSections = Math.max(v1Sections.length, v2Sections.length);
    for (let i = 0; i < Math.min(maxSections, 5); i++) {
      const s1 = v1Sections[i] || '';
      const s2 = v2Sections[i] || '';
      if (s1 !== s2) {
        diffs.push({
          section: `Section ${i + 1}`,
          variant1Excerpt: s1.slice(0, 200),
          variant2Excerpt: s2.slice(0, 200),
        });
      }
    }

    return diffs;
  }

  private splitIntoSections(text: string): string[] {
    return text
      .split(/(?=^#{1,3}\s)/m)
      .filter((s) => s.trim().length > 0)
      .map((s) => s.trim());
  }
}

export const responseComparisonService = new ResponseComparisonService();
export default responseComparisonService;
