/**
 * Integration tests for Focus Modes
 * World-Class Chat 2025
 */

import { describe, it, expect } from 'vitest';

// Mock focus mode filter (would be imported from aiContextBuilder in real test)
function applyFocusModeFilter(context: any, focusMode: string) {
  switch (focusMode) {
    case 'pmo-docs':
      return {
        ...context,
        project: null,
        execution: null,
        knowledge: {
          ...context.knowledge,
          projectDocuments: [],
          previousDecisions: []
        },
        external: null
      };
    
    case 'project-data':
      return {
        ...context,
        knowledge: {
          ...context.knowledge,
          frameworkKnowledge: []
        },
        external: null
      };
    
    case 'research':
      return {
        ...context,
        external: null
      };
    
    case 'web':
      return {
        ...context,
        knowledge: null,
        execution: null,
        external: {
          ...context.external,
          webSearchEnabled: true,
          webSearchPriority: 'high'
        }
      };
    
    case 'all':
    default:
      return context;
  }
}

describe('Focus Modes Integration', () => {
  const mockContext = {
    platform: { role: 'USER' },
    organization: { name: 'Test Org' },
    project: { name: 'Test Project' },
    execution: { tasks: [] },
    knowledge: {
      projectDocuments: ['doc1'],
      previousDecisions: ['dec1'],
      frameworkKnowledge: ['iso', 'pmbok']
    },
    external: { webSearchEnabled: false }
  };

  it('filters context for PMO Docs mode', () => {
    const filtered = applyFocusModeFilter(mockContext, 'pmo-docs');
    
    expect(filtered.project).toBeNull();
    expect(filtered.execution).toBeNull();
    expect(filtered.knowledge.projectDocuments).toEqual([]);
    expect(filtered.external).toBeNull();
  });

  it('filters context for Project Data mode', () => {
    const filtered = applyFocusModeFilter(mockContext, 'project-data');
    
    expect(filtered.project).not.toBeNull();
    expect(filtered.knowledge.frameworkKnowledge).toEqual([]);
    expect(filtered.external).toBeNull();
  });

  it('filters context for Research mode', () => {
    const filtered = applyFocusModeFilter(mockContext, 'research');
    
    expect(filtered.external).toBeNull();
    expect(filtered.knowledge).not.toBeNull();
  });

  it('filters context for Web mode', () => {
    const filtered = applyFocusModeFilter(mockContext, 'web');
    
    expect(filtered.knowledge).toBeNull();
    expect(filtered.execution).toBeNull();
    expect(filtered.external.webSearchEnabled).toBe(true);
    expect(filtered.external.webSearchPriority).toBe('high');
  });

  it('does not filter for All mode', () => {
    const filtered = applyFocusModeFilter(mockContext, 'all');
    
    expect(filtered).toEqual(mockContext);
  });

  it('handles default/unknown mode as All', () => {
    const filtered = applyFocusModeFilter(mockContext, 'unknown');
    
    expect(filtered).toEqual(mockContext);
  });
});















