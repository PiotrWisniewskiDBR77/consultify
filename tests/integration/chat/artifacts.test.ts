/**
 * Integration tests for Artifacts system
 * World-Class Chat 2025
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseArtifactsFromResponse, createArtifact } from '../../../store/useArtifactsStore';
import { Artifact } from '../../../types';

describe('Artifacts Integration', () => {
  describe('parseArtifactsFromResponse', () => {
    it('parses markdown artifact', () => {
      const response = `
        Here's your document:
        \`\`\`artifact:markdown:My Document
        # Title
        Content here
        \`\`\`
      `;
      
      const artifacts = parseArtifactsFromResponse(response);
      
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].type).toBe('markdown');
      expect(artifacts[0].title).toBe('My Document');
      expect(artifacts[0].content).toContain('# Title');
    });

    it('parses code artifact with language', () => {
      const response = `
        Here's the code:
        \`\`\`artifact:code:typescript:My Function
        function test() {
          return true;
        }
        \`\`\`
      `;
      
      const artifacts = parseArtifactsFromResponse(response);
      
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].type).toBe('code');
      expect(artifacts[0].language).toBe('typescript');
      expect(artifacts[0].title).toBe('My Function');
    });

    it('parses JSON artifact definition', () => {
      const response = `
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
      
      const artifacts = parseArtifactsFromResponse(response);
      
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].type).toBe('pmo-document');
      expect(artifacts[0].title).toBe('RACI Matrix');
      expect(artifacts[0].metadata?.framework).toBe('ISO');
    });

    it('parses multiple artifacts', () => {
      const response = `
        \`\`\`artifact:markdown:Doc 1
        Content 1
        \`\`\`
        
        \`\`\`artifact:code:javascript:Code 1
        console.log('test');
        \`\`\`
      `;
      
      const artifacts = parseArtifactsFromResponse(response);
      
      expect(artifacts).toHaveLength(2);
      // Check that both types are present (order may vary)
      const types = artifacts.map(a => a.type);
      expect(types).toContain('markdown');
      expect(types).toContain('code');
      // Check that code artifact has language
      const codeArtifact = artifacts.find(a => a.type === 'code');
      expect(codeArtifact?.language).toBe('javascript');
    });

    it('handles empty response', () => {
      const artifacts = parseArtifactsFromResponse('');
      expect(artifacts).toHaveLength(0);
    });

    it('handles invalid JSON artifact gracefully', () => {
      const response = `
        \`\`\`json:artifact
        { invalid json }
        \`\`\`
      `;
      
      const artifacts = parseArtifactsFromResponse(response);
      expect(artifacts).toHaveLength(0);
    });
  });

  describe('createArtifact', () => {
    it('creates artifact with defaults', () => {
      const artifact = createArtifact('markdown', 'Test', 'Content');
      
      expect(artifact.type).toBe('markdown');
      expect(artifact.title).toBe('Test');
      expect(artifact.content).toBe('Content');
      expect(artifact.editable).toBe(true);
      expect(artifact.version).toBe(1);
      expect(artifact.id).toMatch(/^artifact-/);
    });

    it('creates artifact with custom options', () => {
      const artifact = createArtifact('code', 'Test', 'Content', {
        language: 'typescript',
        editable: false,
        metadata: { framework: 'ISO' }
      });
      
      expect(artifact.language).toBe('typescript');
      expect(artifact.editable).toBe(false);
      expect(artifact.metadata?.framework).toBe('ISO');
    });
  });
});

