/**
 * AI Response Post Processor Unit Tests
 * Tests response cleaning, formatting, and safety filtering
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// AI Response Post Processor implementation
const createAIResponsePostProcessor = () => {
  const blockedPatterns = [
    /\b(password|secret|api.?key)\s*[:=]\s*\S+/gi,
    /<script[^>]*>.*?<\/script>/gis,
    /javascript:/gi,
  ];

  return {
    clean: (response) => {
      let cleaned = response;
      // Normalize line breaks first
      cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
      // Remove extra horizontal whitespace (not line breaks)
      cleaned = cleaned.replace(/[^\S\n]+/g, ' ');
      // Trim
      cleaned = cleaned.trim();
      return cleaned;
    },

    formatMarkdown: (response) => {
      let formatted = response;
      // Ensure code blocks are properly formatted
      formatted = formatted.replace(/```(\w*)\n/g, '```$1\n');
      // Fix broken list items
      formatted = formatted.replace(/^-\s+/gm, '- ');
      return formatted;
    },

    filterSensitive: (response) => {
      let filtered = response;
      for (const pattern of blockedPatterns) {
        filtered = filtered.replace(pattern, '[FILTERED]');
      }
      return {
        content: filtered,
        filtered: filtered !== response,
      };
    },

    isSafe: (response) => {
      for (const pattern of blockedPatterns) {
        if (pattern.test(response)) {
          return { safe: false, reason: 'Contains sensitive content' };
        }
      }
      return { safe: true };
    },

    extractStructure: (response) => {
      const headers = (response.match(/^#{1,6}\s.+$/gm) || []).length;
      const codeBlocks = (response.match(/```[\s\S]*?```/g) || []).length;
      const lists = (response.match(/^[\s]*[-*]\s/gm) || []).length;
      const links = (response.match(/\[.+?\]\(.+?\)/g) || []).length;

      return { headers, codeBlocks, lists, links };
    },

    truncate: (response, maxLength = 1000) => {
      if (response.length <= maxLength) {
        return { content: response, truncated: false };
      }
      const truncated = response.slice(0, maxLength);
      // Try to break at sentence
      const lastSentence = truncated.lastIndexOf('.');
      const breakPoint = lastSentence > maxLength * 0.8 ? lastSentence + 1 : maxLength;
      return {
        content: truncated.slice(0, breakPoint) + '...',
        truncated: true,
        originalLength: response.length,
      };
    },

    addMetadata: (response, metadata = {}) => {
      return {
        content: response,
        processedAt: new Date(),
        wordCount: response.split(/\s+/).length,
        characterCount: response.length,
        ...metadata,
      };
    },

    process: (response) => {
      let result = response;
      result = this.clean?.(result) || result;
      result = this.formatMarkdown?.(result) || result;
      const safety = this.filterSensitive?.(result) || { content: result, filtered: false };
      return {
        content: safety.content,
        wasFiltered: safety.filtered,
        structure: this.extractStructure?.(safety.content),
      };
    },
  };
};

describe('AIResponsePostProcessor', () => {
  let processor;

  beforeEach(() => {
    processor = createAIResponsePostProcessor();
  });

  describe('Response Cleaning', () => {
    it('should clean extra whitespace', () => {
      const input = 'Hello    world   with   spaces';
      const result = processor.clean(input);
      expect(result).toBe('Hello world with spaces');
    });

    it('should normalize line breaks', () => {
      const input = 'Line 1\n\n\n\n\nLine 2';
      const result = processor.clean(input);
      expect(result).toBe('Line 1\n\nLine 2');
    });
  });

  describe('Markdown Formatting', () => {
    it('should format code blocks', () => {
      const input = '```javascript\ncode\n```';
      const result = processor.formatMarkdown(input);
      expect(result).toContain('```javascript\n');
    });

    it('should fix list items', () => {
      const input = '-  Item 1\n-   Item 2';
      const result = processor.formatMarkdown(input);
      expect(result).toBe('- Item 1\n- Item 2');
    });
  });

  describe('Sensitive Content Filtering', () => {
    it('should filter password patterns', () => {
      const input = 'Use password: secret123 to login';
      const result = processor.filterSensitive(input);
      expect(result.content).toContain('[FILTERED]');
      expect(result.filtered).toBe(true);
    });

    it('should filter script tags', () => {
      const input = 'Hello <script>alert("xss")</script> world';
      const result = processor.filterSensitive(input);
      expect(result.content).not.toContain('<script>');
    });

    it('should pass safe content', () => {
      const input = 'This is completely safe content';
      const result = processor.filterSensitive(input);
      expect(result.filtered).toBe(false);
    });
  });

  describe('Safety Check', () => {
    it('should mark safe content', () => {
      const result = processor.isSafe('Normal response text');
      expect(result.safe).toBe(true);
    });

    it('should detect unsafe content', () => {
      const result = processor.isSafe('api_key: sk-12345');
      expect(result.safe).toBe(false);
    });
  });

  describe('Structure Extraction', () => {
    it('should extract markdown structure', () => {
      const input = '# Header\n## Subheader\n- Item\n- Item\n```code```\n[link](url)';
      const structure = processor.extractStructure(input);

      expect(structure.headers).toBe(2);
      expect(structure.lists).toBe(2);
      expect(structure.codeBlocks).toBe(1);
      expect(structure.links).toBe(1);
    });
  });

  describe('Truncation', () => {
    it('should not truncate short content', () => {
      const input = 'Short content';
      const result = processor.truncate(input, 100);
      expect(result.truncated).toBe(false);
    });

    it('should truncate long content', () => {
      const input = 'A'.repeat(2000);
      const result = processor.truncate(input, 1000);
      expect(result.truncated).toBe(true);
      expect(result.content.length).toBeLessThanOrEqual(1003);
    });
  });

  describe('Metadata', () => {
    it('should add metadata to response', () => {
      const input = 'Hello world test';
      const result = processor.addMetadata(input);
      expect(result.wordCount).toBe(3);
      expect(result.characterCount).toBe(16);
      expect(result.processedAt).toBeDefined();
    });
  });
});
