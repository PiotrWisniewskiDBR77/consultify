/**
 * useDiscoveryStore Tests
 *
 * Tests for the Discovery Consultant Zustand store that manages
 * session state, nodes, edges, and recommendations.
 */

import { act, renderHook } from '@testing-library/react';

// Mock the store module
jest.mock('../../../src/store/useDiscoveryStore', () => {
  const actual = jest.requireActual('../../../src/store/useDiscoveryStore');
  return {
    ...actual,
  };
});

import { useDiscoveryStore } from '../../../src/store/useDiscoveryStore';

describe('useDiscoveryStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    const { result } = renderHook(() => useDiscoveryStore());
    act(() => {
      result.current.actions.reset();
    });
  });

  describe('Session Management', () => {
    it('creates a new session', () => {
      const { result } = renderHook(() => useDiscoveryStore());

      act(() => {
        const sessionId = result.current.actions.createSession();
        expect(sessionId).toBeDefined();
        expect(typeof sessionId).toBe('string');
      });

      expect(result.current.activeSessionId).toBeTruthy();
    });

    it('initializes with welcome phase', () => {
      const { result } = renderHook(() => useDiscoveryStore());

      act(() => {
        result.current.actions.createSession();
      });

      expect(result.current.currentPhase).toBe('welcome');
    });

    it('resets store state', () => {
      const { result } = renderHook(() => useDiscoveryStore());

      act(() => {
        result.current.actions.createSession();
        result.current.actions.reset();
      });

      expect(result.current.activeSessionId).toBeNull();
      expect(result.current.nodes).toHaveLength(0);
      expect(result.current.edges).toHaveLength(0);
    });
  });

  describe('Phase Management', () => {
    it('sets phase correctly', () => {
      const { result } = renderHook(() => useDiscoveryStore());

      act(() => {
        result.current.actions.createSession();
        result.current.actions.setPhase('pain_discovery');
      });

      expect(result.current.currentPhase).toBe('pain_discovery');
    });

    it('advances through phases', () => {
      const { result } = renderHook(() => useDiscoveryStore());

      act(() => {
        result.current.actions.createSession();
      });

      // Start at welcome
      expect(result.current.currentPhase).toBe('welcome');

      act(() => {
        result.current.actions.setPhase('ice_breaking');
      });

      expect(result.current.currentPhase).toBe('ice_breaking');
    });
  });

  describe('Node Management', () => {
    it('adds a pain point node', () => {
      const { result } = renderHook(() => useDiscoveryStore());

      act(() => {
        result.current.actions.createSession();
        result.current.actions.addNode({
          type: 'painPoint',
          position: { x: 100, y: 100 },
          data: {
            text: 'Test pain point',
            severity: 3,
            area: 'operations',
            source: 'user',
          },
        });
      });

      expect(result.current.nodes).toHaveLength(1);
      expect(result.current.nodes[0].type).toBe('painPoint');
    });

    it('adds an insight node', () => {
      const { result } = renderHook(() => useDiscoveryStore());

      act(() => {
        result.current.actions.createSession();
        result.current.actions.addNode({
          type: 'insight',
          position: { x: 200, y: 100 },
          data: {
            text: 'Test insight',
            linkedPainIds: [],
            source: 'ai',
          },
        });
      });

      expect(result.current.nodes).toHaveLength(1);
      expect(result.current.nodes[0].type).toBe('insight');
    });

    it('removes a node', () => {
      const { result } = renderHook(() => useDiscoveryStore());
      let nodeId: string;

      act(() => {
        result.current.actions.createSession();
        nodeId = result.current.actions.addNode({
          type: 'painPoint',
          position: { x: 100, y: 100 },
          data: {
            text: 'Test pain',
            severity: 2,
            area: 'technology',
            source: 'user',
          },
        });
      });

      expect(result.current.nodes).toHaveLength(1);

      act(() => {
        result.current.actions.removeNode(nodeId);
      });

      expect(result.current.nodes).toHaveLength(0);
    });

    it('updates node position', () => {
      const { result } = renderHook(() => useDiscoveryStore());
      let nodeId: string;

      act(() => {
        result.current.actions.createSession();
        nodeId = result.current.actions.addNode({
          type: 'painPoint',
          position: { x: 100, y: 100 },
          data: {
            text: 'Test pain',
            severity: 2,
            area: 'process',
            source: 'user',
          },
        });
      });

      act(() => {
        result.current.actions.moveNode(nodeId, { x: 200, y: 300 });
      });

      expect(result.current.nodes[0].position).toEqual({ x: 200, y: 300 });
    });
  });

  describe('Edge Management', () => {
    it('adds an edge between nodes', () => {
      const { result } = renderHook(() => useDiscoveryStore());

      act(() => {
        result.current.actions.createSession();
        result.current.actions.addEdge({
          source: 'node-1',
          target: 'node-2',
          type: 'smoothstep',
        });
      });

      expect(result.current.edges).toHaveLength(1);
    });

    it('removes an edge', () => {
      const { result } = renderHook(() => useDiscoveryStore());
      let edgeId: string;

      act(() => {
        result.current.actions.createSession();
        edgeId = result.current.actions.addEdge({
          source: 'node-1',
          target: 'node-2',
        });
      });

      expect(result.current.edges).toHaveLength(1);

      act(() => {
        result.current.actions.removeEdge(edgeId);
      });

      expect(result.current.edges).toHaveLength(0);
    });
  });

  describe('Client Context', () => {
    it('updates client context', () => {
      const { result } = renderHook(() => useDiscoveryStore());

      act(() => {
        result.current.actions.createSession();
        result.current.actions.updateClientContext({
          companyName: 'Acme Corp',
          industry: 'Manufacturing',
          size: 'medium',
        });
      });

      expect(result.current.clientContext.companyName).toBe('Acme Corp');
      expect(result.current.clientContext.industry).toBe('Manufacturing');
      expect(result.current.clientContext.size).toBe('medium');
    });

    it('merges context updates', () => {
      const { result } = renderHook(() => useDiscoveryStore());

      act(() => {
        result.current.actions.createSession();
        result.current.actions.updateClientContext({ companyName: 'Acme Corp' });
        result.current.actions.updateClientContext({ industry: 'Tech' });
      });

      expect(result.current.clientContext.companyName).toBe('Acme Corp');
      expect(result.current.clientContext.industry).toBe('Tech');
    });
  });

  describe('Recommendations', () => {
    it('sets recommendations', () => {
      const { result } = renderHook(() => useDiscoveryStore());

      act(() => {
        result.current.actions.createSession();
        result.current.actions.setRecommendations({
          transformationType: 'digital',
          matchScore: 85,
          reasoning: 'Strong digital transformation potential',
          frameworks: ['DRD', 'SIRI'],
          tools: ['tool-1', 'tool-2'],
          initiatives: [],
        });
      });

      expect(result.current.recommendations.transformationType).toBe('digital');
      expect(result.current.recommendations.matchScore).toBe(85);
      expect(result.current.recommendations.frameworks).toContain('DRD');
    });
  });

  describe('Versioning', () => {
    it('saves a version snapshot', () => {
      const { result } = renderHook(() => useDiscoveryStore());

      act(() => {
        result.current.actions.createSession();
        result.current.actions.addNode({
          type: 'painPoint',
          position: { x: 100, y: 100 },
          data: {
            text: 'Version test',
            severity: 3,
            area: 'operations',
            source: 'user',
          },
        });
        const version = result.current.actions.saveVersion();
        expect(version).toBe(1);
      });
    });
  });
});
