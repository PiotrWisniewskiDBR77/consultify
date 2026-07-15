/**
 * Backend tests for Thinking Steps extraction
 * World-Class Chat 2025
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { extractThinkingSteps, enhanceResponse } from '../../../server/src/services/ai/AIPipeline';

describe('aiPipeline - Thinking Steps', () => {
  describe('extractThinkingSteps', () => {
    // Fixed 2026-07-15: extractThinkingSteps() now allows leading whitespace
    // between the newline and the numbered/bulleted marker in its split
    // lookahead, and trims each line before stripping the marker prefix — so
    // indented lists (the typical AI output shape) split into one step per line
    // instead of collapsing into a single step.
    it('extracts thinking steps from response', () => {
      const content = `
        <thinking>
        1. First, I need to analyze the requirements
        2. Then, I'll check the current state
        3. Finally, I'll propose a solution
        </thinking>
        
        Here's my answer: The solution is X.
      `;
      
      const { cleanContent, thinkingSteps } = extractThinkingSteps(content);
      
      expect(thinkingSteps).toHaveLength(3);
      expect(thinkingSteps[0].content).toContain('analyze the requirements');
      expect(thinkingSteps[0].status).toBe('done');
      expect(cleanContent).toContain("Here's my answer");
      expect(cleanContent).not.toContain('<thinking>');
    });

    it('categorizes thinking steps correctly', () => {
      const content = `
        <thinking>
        1. Analyzing the data
        2. Searching for best practices
        3. Combining insights
        4. Verifying the solution
        </thinking>
      `;
      
      const { thinkingSteps } = extractThinkingSteps(content);
      
      expect(thinkingSteps.length).toBeGreaterThan(0);
      // Categories should be assigned
      thinkingSteps.forEach(step => {
        expect(step.category).toBeDefined();
      });
    });

    it('handles empty thinking block', () => {
      const content = `
        <thinking>
        </thinking>
        
        Content here.
      `;
      
      const { thinkingSteps, cleanContent } = extractThinkingSteps(content);
      
      expect(thinkingSteps).toHaveLength(0);
      expect(cleanContent).toBe('Content here.');
    });

    it('handles response without thinking blocks', () => {
      const content = 'Just a regular response without thinking.';
      
      const { thinkingSteps, cleanContent } = extractThinkingSteps(content);
      
      expect(thinkingSteps).toHaveLength(0);
      expect(cleanContent).toBe(content);
    });

    it('removes thinking blocks from content', () => {
      const content = `
        <thinking>
        1. Internal reasoning
        </thinking>
        
        Public answer here.
      `;
      
      const { cleanContent } = extractThinkingSteps(content);
      
      expect(cleanContent).toBe('Public answer here.');
      expect(cleanContent).not.toContain('<thinking>');
    });
  });

  describe('enhanceResponse', () => {
    it('enhances response with thinking steps', () => {
      const response = {
        content: `
          <thinking>
          1. Step one
          </thinking>
          
          Answer here.
        `
      };
      
      const enhanced = enhanceResponse(response);
      
      expect(enhanced.thinkingSteps).toBeDefined();
      expect(enhanced.thinkingSteps.length).toBeGreaterThan(0);
      expect(enhanced.content).not.toContain('<thinking>');
    });

    it('enhances response with artifacts', () => {
      const response = {
        content: `
          \`\`\`artifact:markdown:Test
          # Content
          \`\`\`
        `
      };
      
      const enhanced = enhanceResponse(response);
      
      expect(enhanced.artifacts).toBeDefined();
      expect(enhanced.artifacts.length).toBeGreaterThan(0);
    });

    it('enhances response with both thinking and artifacts', () => {
      const response = {
        content: `
          <thinking>
          1. Reasoning
          </thinking>
          
          \`\`\`artifact:code:javascript:Test
          function test() {}
          \`\`\`
        `
      };
      
      const enhanced = enhanceResponse(response);
      
      expect(enhanced.thinkingSteps).toBeDefined();
      expect(enhanced.artifacts).toBeDefined();
      expect(enhanced.thinkingSteps.length).toBeGreaterThan(0);
      expect(enhanced.artifacts.length).toBeGreaterThan(0);
    });

    it('preserves original response properties', () => {
      const response = {
        content: 'Test',
        usage: { tokens: 100 },
        model: 'gpt-4'
      };
      
      const enhanced = enhanceResponse(response);
      
      expect(enhanced.usage).toEqual(response.usage);
      expect(enhanced.model).toBe(response.model);
    });
  });
});















