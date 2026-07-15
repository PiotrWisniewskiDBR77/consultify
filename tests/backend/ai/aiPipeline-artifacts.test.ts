/**
 * Backend tests for Artifacts extraction
 * World-Class Chat 2025
 */

import { describe, it, expect } from 'vitest';
import { extractArtifacts, enhanceResponse } from '../../../server/src/services/ai/AIPipeline';

describe('aiPipeline - Artifacts', () => {
  describe('extractArtifacts', () => {
    it('extracts markdown artifact', () => {
      const content = `
        Here's your document:
        \`\`\`artifact:markdown:My Document
        # Title
        Content here
        \`\`\`
      `;
      
      const { cleanContent, artifacts } = extractArtifacts(content);
      
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].type).toBe('markdown');
      expect(artifacts[0].title).toBe('My Document');
      expect(artifacts[0].content).toContain('# Title');
      expect(cleanContent).not.toContain('```artifact');
    });

    it('extracts code artifact with language', () => {
      const content = `
        \`\`\`artifact:code:typescript:My Function
        function test() {
          return true;
        }
        \`\`\`
      `;
      
      const { artifacts } = extractArtifacts(content);
      
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].type).toBe('code');
      expect(artifacts[0].language).toBe('typescript');
      expect(artifacts[0].title).toBe('My Function');
    });

    it('extracts JSON artifact definition', () => {
      const content = `
        \`\`\`json:artifact
        {
          "type": "pmo-document",
          "title": "RACI Matrix",
          "content": "Content here",
          "metadata": {
            "framework": "ISO",
            "templateType": "raci"
          }
        }
        \`\`\`
      `;
      
      const { artifacts } = extractArtifacts(content);
      
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].type).toBe('pmo-document');
      expect(artifacts[0].title).toBe('RACI Matrix');
      expect(artifacts[0].metadata.framework).toBe('ISO');
    });

    // Fixed 2026-07-15: extractArtifacts() now collects matches with their
    // source position and sorts the final `artifacts` array by that position,
    // so results reflect document order regardless of which regex phase
    // (with-language vs no-language vs JSON vs regular code block) found them.
    it('extracts multiple artifacts', () => {
      const content = `
        \`\`\`artifact:markdown:Doc 1
        Content 1
        \`\`\`
        
        \`\`\`artifact:code:javascript:Code 1
        console.log('test');
        \`\`\`
      `;
      
      const { artifacts } = extractArtifacts(content);
      
      expect(artifacts).toHaveLength(2);
      expect(artifacts[0].type).toBe('markdown');
      expect(artifacts[1].type).toBe('code');
    });

    it('extracts code blocks as artifacts when substantial', () => {
      const content = `
        Here's some code:
        \`\`\`javascript
        function longFunction() {
          // This is a substantial code block
          // with multiple lines
          // that should be extracted as artifact
          return true;
        }
        \`\`\`
      `;
      
      const { artifacts } = extractArtifacts(content);
      
      // Should extract substantial code blocks (>100 chars)
      expect(artifacts.length).toBeGreaterThan(0);
    });

    it('handles empty response', () => {
      const { artifacts, cleanContent } = extractArtifacts('');
      
      expect(artifacts).toHaveLength(0);
      expect(cleanContent).toBe('');
    });

    it('handles invalid JSON artifact gracefully', () => {
      const content = `
        \`\`\`json:artifact
        { invalid json }
        \`\`\`
      `;
      
      const { artifacts } = extractArtifacts(content);
      
      // Should skip invalid JSON
      expect(artifacts.length).toBeLessThanOrEqual(0);
    });

    it('preserves regular code blocks in content', () => {
      const content = `
        Regular code block:
        \`\`\`javascript
        console.log('test');
        \`\`\`
        
        Artifact:
        \`\`\`artifact:markdown:Doc
        Content
        \`\`\`
      `;
      
      const { cleanContent, artifacts } = extractArtifacts(content);
      
      expect(artifacts).toHaveLength(1);
      // Regular code blocks should remain in content
      expect(cleanContent).toContain('Regular code block');
    });
  });

  describe('enhanceResponse with artifacts', () => {
    it('adds artifacts to response', () => {
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
      expect(enhanced.artifacts[0].type).toBe('markdown');
    });

    it('preserves other response properties', () => {
      const response = {
        content: 'Test',
        usage: { tokens: 100 },
        model: 'gpt-4',
        metadata: { test: true }
      };
      
      const enhanced = enhanceResponse(response);
      
      expect(enhanced.usage).toEqual(response.usage);
      expect(enhanced.model).toBe(response.model);
      expect(enhanced.metadata).toEqual(response.metadata);
    });
  });
});















