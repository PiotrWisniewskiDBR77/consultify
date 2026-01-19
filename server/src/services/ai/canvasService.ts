/**
 * Canvas Service - AI-powered artifact editing
 * Provides intelligent editing capabilities for code and documents
 *
 * @version 1.0.0
 */

import { aiLogger } from './logger.js';
import { llmService } from './llmService.js';

export interface CanvasEditRequest {
  content: string;
  instruction: string;
  type: 'code' | 'document' | 'markdown';
  language?: string;
  context?: {
    fileName?: string;
    projectContext?: string;
    previousEdits?: string[];
  };
}

export interface CanvasEditResult {
  success: boolean;
  editedContent: string;
  diff?: {
    additions: number;
    deletions: number;
    changes: DiffChange[];
  };
  explanation?: string;
  suggestions?: string[];
  error?: string;
}

export interface DiffChange {
  type: 'add' | 'remove' | 'modify';
  lineNumber: number;
  oldContent?: string;
  newContent?: string;
}

export interface CanvasAnalysisResult {
  type: 'code' | 'document' | 'markdown';
  language?: string;
  metrics: {
    lines: number;
    characters: number;
    complexity?: string;
  };
  suggestions: string[];
  issues?: {
    severity: 'error' | 'warning' | 'info';
    message: string;
    line?: number;
  }[];
}

class CanvasService {
  /**
   * Apply AI-powered edit to content
   */
  async applyEdit(request: CanvasEditRequest): Promise<CanvasEditResult> {
    const { content, instruction, type, language, context } = request;

    if (!content || !instruction) {
      return {
        success: false,
        editedContent: content,
        error: 'Content and instruction are required',
      };
    }

    aiLogger.info('CanvasService', `Applying edit: ${instruction.substring(0, 50)}...`, {
      type,
      language,
      contentLength: content.length,
    });

    try {
      const systemPrompt = this.buildEditSystemPrompt(type, language, context);
      const userPrompt = this.buildEditUserPrompt(content, instruction);

      const result = await llmService.call({
        type: 'text',
        modelConfig: { id: 'gpt-4o', provider: 'openai' },
        systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens: 8000,
        temperature: 0.3,
      });

      const response = (result.content as string) || '';
      const { editedContent, explanation } = this.parseEditResponse(response, content);

      const diff = this.computeDiff(content, editedContent);

      aiLogger.info('CanvasService', 'Edit applied successfully', {
        additions: diff.additions,
        deletions: diff.deletions,
      });

      return {
        success: true,
        editedContent,
        diff,
        explanation,
        suggestions: this.generateFollowUpSuggestions(instruction, type),
      };
    } catch (error) {
      const err = error as Error;
      aiLogger.error('CanvasService', 'Failed to apply edit', { error: err.message });

      return {
        success: false,
        editedContent: content,
        error: `Failed to apply edit: ${err.message}`,
      };
    }
  }

  /**
   * Analyze content and provide suggestions
   */
  async analyzeContent(
    content: string,
    type: 'code' | 'document' | 'markdown',
    language?: string
  ): Promise<CanvasAnalysisResult> {
    const lines = content.split('\n').length;
    const characters = content.length;

    const result: CanvasAnalysisResult = {
      type,
      language,
      metrics: {
        lines,
        characters,
      },
      suggestions: [],
      issues: [],
    };

    // Basic analysis based on type
    if (type === 'code') {
      result.metrics.complexity = this.estimateCodeComplexity(content);
      result.suggestions = this.getCodeSuggestions(content, language);
      result.issues = this.detectCodeIssues(content, language);
    } else if (type === 'markdown') {
      result.suggestions = this.getMarkdownSuggestions(content);
      result.issues = this.detectMarkdownIssues(content);
    } else {
      result.suggestions = this.getDocumentSuggestions(content);
    }

    return result;
  }

  /**
   * Generate code completion suggestions
   */
  async suggestCompletion(
    content: string,
    cursorPosition: number,
    language?: string
  ): Promise<string[]> {
    const contextBefore = content.substring(Math.max(0, cursorPosition - 500), cursorPosition);
    const contextAfter = content.substring(cursorPosition, cursorPosition + 200);

    try {
      const result = await llmService.call({
        type: 'text',
        modelConfig: { id: 'gpt-4o-mini', provider: 'openai' },
        systemPrompt: `You are a code completion assistant. Given the context, suggest 3 possible completions.
Language: ${language || 'unknown'}
Return ONLY a JSON array of completion strings, nothing else.`,
        messages: [
          {
            role: 'user',
            content: `Context before cursor:\n${contextBefore}\n\n[CURSOR]\n\nContext after cursor:\n${contextAfter}`,
          },
        ],
        maxTokens: 500,
        temperature: 0.5,
      });

      const response = (result.content as string) || '[]';
      try {
        const suggestions = JSON.parse(response);
        return Array.isArray(suggestions) ? suggestions.slice(0, 3) : [];
      } catch {
        return [];
      }
    } catch (error) {
      aiLogger.warn('CanvasService', 'Completion suggestion failed', {
        error: (error as Error).message,
      });
      return [];
    }
  }

  /**
   * Format content according to style guidelines
   */
  async formatContent(
    content: string,
    type: 'code' | 'document' | 'markdown',
    language?: string
  ): Promise<{ formatted: string; changes: number }> {
    if (type === 'code') {
      // For code, we use a simple formatting approach
      // In production, you'd integrate with prettier, eslint, etc.
      return this.formatCode(content, language);
    }

    // For documents and markdown, use AI-powered formatting
    try {
      const result = await llmService.call({
        type: 'text',
        modelConfig: { id: 'gpt-4o-mini', provider: 'openai' },
        systemPrompt: `Format the following ${type} content. Improve readability, fix spacing, and ensure consistent styling.
Return ONLY the formatted content, nothing else.`,
        messages: [{ role: 'user', content }],
        maxTokens: 4000,
        temperature: 0.1,
      });

      const formatted = (result.content as string) || content;
      const changes = this.countDifferences(content, formatted);

      return { formatted, changes };
    } catch {
      return { formatted: content, changes: 0 };
    }
  }

  private buildEditSystemPrompt(
    type: string,
    language?: string,
    context?: CanvasEditRequest['context']
  ): string {
    let prompt = `You are an expert ${type === 'code' ? `${language || ''} programmer` : 'document editor'}.
Your task is to modify the provided content according to the user's instruction.

Rules:
1. Make ONLY the requested changes
2. Preserve the overall structure and style
3. Maintain consistency with the existing content
4. Do not add unnecessary comments or explanations in the code itself`;

    if (context?.fileName) {
      prompt += `\n\nFile: ${context.fileName}`;
    }

    if (context?.projectContext) {
      prompt += `\n\nProject context: ${context.projectContext}`;
    }

    prompt += `\n\nRespond with:
<EDITED>
[The complete edited content]
</EDITED>

<EXPLANATION>
[Brief explanation of changes made]
</EXPLANATION>`;

    return prompt;
  }

  private buildEditUserPrompt(content: string, instruction: string): string {
    return `INSTRUCTION: ${instruction}

CURRENT CONTENT:
\`\`\`
${content}
\`\`\`

Apply the instruction and return the edited content.`;
  }

  private parseEditResponse(
    response: string,
    originalContent: string
  ): { editedContent: string; explanation?: string } {
    // Try to extract edited content from markers
    const editedMatch = response.match(/<EDITED>([\s\S]*?)<\/EDITED>/);
    const explanationMatch = response.match(/<EXPLANATION>([\s\S]*?)<\/EXPLANATION>/);

    if (editedMatch) {
      return {
        editedContent: editedMatch[1].trim(),
        explanation: explanationMatch?.[1]?.trim(),
      };
    }

    // Fallback: try to extract code block
    const codeBlockMatch = response.match(/```[\w]*\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      return { editedContent: codeBlockMatch[1].trim() };
    }

    // Last resort: return the whole response
    return { editedContent: response.trim() || originalContent };
  }

  private computeDiff(oldContent: string, newContent: string): CanvasEditResult['diff'] {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');

    const changes: DiffChange[] = [];
    let additions = 0;
    let deletions = 0;

    // Simple line-by-line diff
    const maxLines = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];

      if (oldLine === undefined && newLine !== undefined) {
        changes.push({ type: 'add', lineNumber: i + 1, newContent: newLine });
        additions++;
      } else if (newLine === undefined && oldLine !== undefined) {
        changes.push({ type: 'remove', lineNumber: i + 1, oldContent: oldLine });
        deletions++;
      } else if (oldLine !== newLine) {
        changes.push({ type: 'modify', lineNumber: i + 1, oldContent: oldLine, newContent: newLine });
        additions++;
        deletions++;
      }
    }

    return { additions, deletions, changes };
  }

  private generateFollowUpSuggestions(instruction: string, type: string): string[] {
    const suggestions: string[] = [];

    if (type === 'code') {
      suggestions.push('Add unit tests for these changes');
      suggestions.push('Add documentation comments');
      suggestions.push('Optimize for performance');
    } else {
      suggestions.push('Improve clarity and readability');
      suggestions.push('Add more examples');
      suggestions.push('Fix formatting consistency');
    }

    return suggestions.slice(0, 3);
  }

  private estimateCodeComplexity(content: string): string {
    const lines = content.split('\n').length;
    const nestedBraces = (content.match(/\{/g) || []).length;
    const conditions = (content.match(/if|else|switch|case|while|for/g) || []).length;

    const complexity = nestedBraces * 2 + conditions * 3;

    if (complexity < 10) return 'Low';
    if (complexity < 30) return 'Medium';
    return 'High';
  }

  private getCodeSuggestions(content: string, language?: string): string[] {
    const suggestions: string[] = [];

    if (!content.includes('try') && content.includes('await')) {
      suggestions.push('Consider adding error handling with try/catch');
    }

    if (content.length > 500 && !content.includes('//') && !content.includes('/*')) {
      suggestions.push('Consider adding comments to explain complex logic');
    }

    if ((content.match(/function|const.*=.*=>/g) || []).length > 10) {
      suggestions.push('Consider splitting into smaller modules');
    }

    return suggestions;
  }

  private detectCodeIssues(
    content: string,
    language?: string
  ): CanvasAnalysisResult['issues'] {
    const issues: CanvasAnalysisResult['issues'] = [];

    // Check for console.log in production code
    if (content.includes('console.log')) {
      issues?.push({
        severity: 'warning',
        message: 'Consider removing console.log statements in production',
      });
    }

    // Check for TODO comments
    const todoMatch = content.match(/TODO|FIXME|HACK/g);
    if (todoMatch) {
      issues?.push({
        severity: 'info',
        message: `Found ${todoMatch.length} TODO/FIXME comments`,
      });
    }

    return issues;
  }

  private getMarkdownSuggestions(content: string): string[] {
    const suggestions: string[] = [];

    if (!content.includes('# ')) {
      suggestions.push('Add headings to structure your content');
    }

    if (content.length > 1000 && !content.includes('## ')) {
      suggestions.push('Consider breaking into sections with subheadings');
    }

    return suggestions;
  }

  private detectMarkdownIssues(content: string): CanvasAnalysisResult['issues'] {
    const issues: CanvasAnalysisResult['issues'] = [];

    // Check for broken links
    const linkMatches = content.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];
    if (linkMatches.some((link) => link.includes(']()'))) {
      issues?.push({
        severity: 'error',
        message: 'Found links with empty URLs',
      });
    }

    return issues;
  }

  private getDocumentSuggestions(content: string): string[] {
    const suggestions: string[] = [];

    if (content.length < 100) {
      suggestions.push('Consider expanding the content with more details');
    }

    return suggestions;
  }

  private formatCode(content: string, language?: string): { formatted: string; changes: number } {
    // Basic formatting - in production, use prettier/eslint
    let formatted = content;
    let changes = 0;

    // Normalize line endings
    if (content.includes('\r\n')) {
      formatted = formatted.replace(/\r\n/g, '\n');
      changes++;
    }

    // Remove trailing whitespace
    const lines = formatted.split('\n');
    const trimmed = lines.map((line) => {
      if (line !== line.trimEnd()) {
        changes++;
        return line.trimEnd();
      }
      return line;
    });
    formatted = trimmed.join('\n');

    // Ensure single newline at end
    if (!formatted.endsWith('\n')) {
      formatted += '\n';
      changes++;
    }

    return { formatted, changes };
  }

  private countDifferences(oldContent: string, newContent: string): number {
    if (oldContent === newContent) return 0;

    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');

    let differences = 0;
    const maxLen = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLen; i++) {
      if (oldLines[i] !== newLines[i]) {
        differences++;
      }
    }

    return differences;
  }
}

export const canvasService = new CanvasService();
export default canvasService;
