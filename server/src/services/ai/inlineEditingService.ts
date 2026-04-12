/**
 * Inline Editing Service
 *
 * Supports partial regeneration of AI response fragments.
 * User can select a portion of the response and request:
 * - "Expand this point"
 * - "Shorten this"
 * - "Add data/evidence"
 * - "Rewrite in different tone"
 */
import logger from '../../utils/Logger.js';

export interface InlineEditRequest {
  messageId: string;
  conversationId: string;
  selectedText: string;
  editType: 'expand' | 'shorten' | 'add_data' | 'rewrite' | 'translate' | 'formalize' | 'simplify';
  fullResponse: string;
  language?: string;
  customInstruction?: string;
}

export interface InlineEditResult {
  originalText: string;
  editedText: string;
  editType: string;
  fullUpdatedResponse: string;
}

class InlineEditingService {
  private llmClient: any = null;

  setLLMClient(client: any): void {
    this.llmClient = client;
  }

  async performEdit(request: InlineEditRequest): Promise<InlineEditResult> {
    const instruction = this.buildInstruction(request);

    if (!this.llmClient) {
      return this.performHeuristicEdit(request);
    }

    try {
      const result = await this.llmClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an editing assistant. ${instruction} Only output the edited text, nothing else. Maintain the same language as the input.`,
          },
          {
            role: 'user',
            content: request.selectedText,
          },
        ],
        temperature: 0.3,
        max_tokens: Math.max(500, request.selectedText.length * 3),
      });

      const editedText = result.choices?.[0]?.message?.content || request.selectedText;

      const fullUpdatedResponse = request.fullResponse.replace(
        request.selectedText,
        editedText
      );

      return {
        originalText: request.selectedText,
        editedText,
        editType: request.editType,
        fullUpdatedResponse,
      };
    } catch (err: any) {
      logger.warn(`[InlineEdit] LLM edit failed: ${err?.message}`);
      return this.performHeuristicEdit(request);
    }
  }

  private buildInstruction(request: InlineEditRequest): string {
    if (request.customInstruction) return request.customInstruction;

    switch (request.editType) {
      case 'expand':
        return 'Expand this section with more detail, examples, and deeper analysis. Maintain the same structure and tone.';
      case 'shorten':
        return 'Condense this to its essential points. Remove redundancy and verbose language while keeping all key information.';
      case 'add_data':
        return 'Enhance this with specific data points, metrics, or evidence. Add concrete numbers where appropriate.';
      case 'rewrite':
        return 'Rewrite this section with clearer structure and more professional tone. Improve clarity and flow.';
      case 'translate':
        return `Translate this to ${request.language === 'pl' ? 'English' : 'Polish'} while maintaining the professional consulting tone.`;
      case 'formalize':
        return 'Rewrite in a more formal, executive-ready tone suitable for C-level presentation.';
      case 'simplify':
        return 'Simplify this explanation. Use plain language, shorter sentences, and avoid jargon.';
      default:
        return 'Improve this text.';
    }
  }

  private performHeuristicEdit(request: InlineEditRequest): InlineEditResult {
    let editedText = request.selectedText;

    switch (request.editType) {
      case 'shorten': {
        const sentences = editedText.split(/(?<=[.!?])\s+/);
        editedText = sentences.slice(0, Math.ceil(sentences.length / 2)).join(' ');
        break;
      }
      case 'expand':
        editedText = request.selectedText + '\n\n[Additional analysis needed - LLM unavailable]';
        break;
      default:
        editedText = request.selectedText;
    }

    return {
      originalText: request.selectedText,
      editedText,
      editType: request.editType,
      fullUpdatedResponse: request.fullResponse.replace(request.selectedText, editedText),
    };
  }
}

export const inlineEditingService = new InlineEditingService();
export default inlineEditingService;
