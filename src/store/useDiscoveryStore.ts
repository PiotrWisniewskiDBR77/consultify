/**
 * Discovery Store
 *
 * Zustand store for managing Discovery Consultant sessions.
 * Handles session CRUD, canvas state, recommendations, and conversions.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { Api } from '@/services/api';
import {
  CANVAS_CATEGORIES,
  CanvasCategory,
  ClientContext,
  DiscoveryEdge,
  DiscoveryNode,
  DiscoveryNodePosition,
  DiscoveryPhase,
  DiscoveryRecommendations,
  DiscoverySession,
  ExtractedEntities,
  PHASE_CONFIGS,
  SessionOutcome,
  SessionVersion,
} from '@/types/discovery';

// ==================== INITIAL STATE ====================

const INITIAL_RECOMMENDATIONS: DiscoveryRecommendations = {
  transformationType: null,
  matchScore: 0,
  reasoning: '',
  frameworks: [],
  tools: [],
  initiatives: [],
};

const INITIAL_CLIENT_CONTEXT: ClientContext = {};

// ==================== STORE INTERFACE ====================

interface DiscoveryState {
  // Active session
  activeSessionId: string | null;
  sessions: Record<string, DiscoverySession>;

  // Current session data (for performance - mirrors active session)
  currentPhase: DiscoveryPhase;
  nodes: DiscoveryNode[];
  edges: DiscoveryEdge[];
  clientContext: ClientContext;
  recommendations: DiscoveryRecommendations;

  // Extracted data counts (for phase progress)
  painPointsCount: number;
  insightsCount: number;
  contextComplete: boolean;
  impactQuantified: boolean;

  // UI state
  isLoading: boolean;
  isSaving: boolean;
  selectedNodeId: string | null;
  canvasZoom: number;

  // Session management
  createSession: (conversationId?: string) => string;
  loadSession: (id: string) => Promise<void>;
  saveSession: () => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  setActiveSession: (id: string | null) => void;

  // Phase management
  setPhase: (phase: DiscoveryPhase) => void;
  canAdvancePhase: () => boolean;
  advancePhase: () => void;

  // Node management
  addNode: (node: Omit<DiscoveryNode, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateNode: (id: string, data: Partial<DiscoveryNode['data']>) => void;
  removeNode: (id: string) => void;
  moveNode: (id: string, position: DiscoveryNodePosition) => void;
  selectNode: (id: string | null) => void;

  // Edge management
  addEdge: (edge: Omit<DiscoveryEdge, 'id'>) => string;
  removeEdge: (id: string) => void;

  // Client context
  updateClientContext: (context: Partial<ClientContext>) => void;
  setContextComplete: (complete: boolean) => void;
  setImpactQuantified: (quantified: boolean) => void;

  // Recommendations
  setRecommendations: (recommendations: DiscoveryRecommendations) => void;

  // Extraction (from AI)
  processExtraction: (entities: ExtractedEntities) => void;

  // Versioning
  saveVersion: () => number;
  loadVersion: (version: number) => void;
  getVersions: () => SessionVersion[];

  // Conversion
  convertToProject: (
    projectName: string,
    options?: { createInitiatives?: boolean }
  ) => Promise<string>;
  attachToProject: (projectId: string) => Promise<void>;
  setOutcome: (outcome: SessionOutcome) => void;

  // Canvas helpers
  getNodesInCategory: (category: CanvasCategory) => DiscoveryNode[];
  calculateNodePosition: (type: DiscoveryNode['type']) => DiscoveryNodePosition;
  autoLayout: () => void;

  // Reset
  reset: () => void;
}

// ==================== HELPER FUNCTIONS ====================

const generateId = () => `node_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const getCategoryForType = (type: DiscoveryNode['type']): CanvasCategory => {
  switch (type) {
    case 'painPoint':
      return 'pains';
    case 'insight':
    case 'quote':
      return 'insights';
    case 'opportunity':
      return 'opportunities';
    case 'recommendation':
    case 'tool':
    case 'assessment':
    case 'initiative':
      return 'recommendations';
    default:
      return 'pains';
  }
};

// ==================== STORE IMPLEMENTATION ====================

export const useDiscoveryStore = create<DiscoveryState>()(
  persist(
    (set, get) => ({
      // Initial state
      activeSessionId: null,
      sessions: {},
      currentPhase: 'welcome',
      nodes: [],
      edges: [],
      clientContext: INITIAL_CLIENT_CONTEXT,
      recommendations: INITIAL_RECOMMENDATIONS,
      painPointsCount: 0,
      insightsCount: 0,
      contextComplete: false,
      impactQuantified: false,
      isLoading: false,
      isSaving: false,
      selectedNodeId: null,
      canvasZoom: 1,

      // ==================== SESSION MANAGEMENT ====================

      createSession: (conversationId?: string) => {
        const id = `discovery_${Date.now()}`;
        const now = new Date();

        const session: DiscoverySession = {
          id,
          title: 'New Discovery Session',
          currentPhase: 'welcome',
          nodes: [],
          edges: [],
          painPoints: [],
          insights: [],
          recommendations: INITIAL_RECOMMENDATIONS,
          clientContext: {},
          versions: [],
          currentVersion: 0,
          conversationId,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          sessions: { ...state.sessions, [id]: session },
          activeSessionId: id,
          currentPhase: 'welcome',
          nodes: [],
          edges: [],
          clientContext: {},
          recommendations: INITIAL_RECOMMENDATIONS,
          painPointsCount: 0,
          insightsCount: 0,
          contextComplete: false,
          impactQuantified: false,
        }));

        console.log('[DiscoveryStore] Created session:', id);
        return id;
      },

      loadSession: async (id: string) => {
        const { sessions } = get();
        let session = sessions[id];

        if (!session) {
          // Try to load from backend
          set({ isLoading: true });
          try {
            const response = await Api.get(`/discovery/sessions/${id}`);
            if (response?.session) {
              session = response.session;
              set((state) => ({
                sessions: { ...state.sessions, [id]: session },
              }));
            }
          } catch (error) {
            console.error('[DiscoveryStore] Failed to load session:', error);
          } finally {
            set({ isLoading: false });
          }
        }

        if (session) {
          set({
            activeSessionId: id,
            currentPhase: session.currentPhase,
            nodes: session.nodes,
            edges: session.edges,
            clientContext: session.clientContext,
            recommendations: session.recommendations,
            painPointsCount: session.painPoints.length,
            insightsCount: session.insights.length,
          });
          console.log('[DiscoveryStore] Loaded session:', id);
        }
      },

      saveSession: async () => {
        const {
          activeSessionId,
          sessions,
          nodes,
          edges,
          clientContext,
          recommendations,
          currentPhase,
        } = get();

        if (!activeSessionId) return;

        set({ isSaving: true });

        const session = sessions[activeSessionId];
        if (!session) {
          set({ isSaving: false });
          return;
        }

        const updatedSession: DiscoverySession = {
          ...session,
          nodes,
          edges,
          clientContext,
          recommendations,
          currentPhase,
          updatedAt: new Date(),
        };

        try {
          await Api.put(`/discovery/sessions/${activeSessionId}`, updatedSession);
          set((state) => ({
            sessions: { ...state.sessions, [activeSessionId]: updatedSession },
            isSaving: false,
          }));
          console.log('[DiscoveryStore] Saved session:', activeSessionId);
        } catch (error) {
          console.error('[DiscoveryStore] Failed to save session:', error);
          // Still update local state
          set((state) => ({
            sessions: { ...state.sessions, [activeSessionId]: updatedSession },
            isSaving: false,
          }));
        }
      },

      deleteSession: async (id: string) => {
        try {
          await Api.delete(`/discovery/sessions/${id}`);
        } catch (error) {
          console.error('[DiscoveryStore] Failed to delete session:', error);
        }

        set((state) => {
          const { [id]: removed, ...rest } = state.sessions;
          return {
            sessions: rest,
            activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
          };
        });
      },

      setActiveSession: (id: string | null) => {
        if (id) {
          get().loadSession(id);
        } else {
          set({
            activeSessionId: null,
            nodes: [],
            edges: [],
            clientContext: INITIAL_CLIENT_CONTEXT,
            recommendations: INITIAL_RECOMMENDATIONS,
            currentPhase: 'welcome',
          });
        }
      },

      // ==================== PHASE MANAGEMENT ====================

      setPhase: (phase: DiscoveryPhase) => {
        set({ currentPhase: phase });
        console.log('[DiscoveryStore] Phase changed to:', phase);
      },

      canAdvancePhase: () => {
        const { currentPhase, contextComplete, painPointsCount, impactQuantified } = get();

        const phaseConfig = PHASE_CONFIGS.find((p) => p.id === currentPhase);
        if (!phaseConfig?.minRequirements) return true;

        const { minRequirements } = phaseConfig;

        if (minRequirements.contextComplete && !contextComplete) return false;
        if (minRequirements.painsIdentified && painPointsCount < minRequirements.painsIdentified)
          return false;
        if (minRequirements.impactQuantified && !impactQuantified) return false;

        return true;
      },

      advancePhase: () => {
        const { currentPhase, canAdvancePhase } = get();

        if (!canAdvancePhase()) {
          console.warn('[DiscoveryStore] Cannot advance phase - requirements not met');
          return;
        }

        const phaseOrder: DiscoveryPhase[] = [
          'welcome',
          'ice_breaking',
          'pain_discovery',
          'impact_assessment',
          'recommendations',
          'decision',
          'completed',
        ];

        const currentIndex = phaseOrder.indexOf(currentPhase);
        if (currentIndex < phaseOrder.length - 1) {
          set({ currentPhase: phaseOrder[currentIndex + 1] });
        }
      },

      // ==================== NODE MANAGEMENT ====================

      addNode: (nodeData) => {
        const id = generateId();
        const now = new Date();

        const node: DiscoveryNode = {
          ...nodeData,
          id,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => {
          const newNodes = [...state.nodes, node];
          const painPointsCount = newNodes.filter((n) => n.type === 'painPoint').length;
          const insightsCount = newNodes.filter((n) => n.type === 'insight').length;

          return {
            nodes: newNodes,
            painPointsCount,
            insightsCount,
          };
        });

        console.log('[DiscoveryStore] Added node:', id, nodeData.type);
        return id;
      },

      updateNode: (id, data) => {
        set((state) => {
          const updatedNodes = state.nodes.map((node) =>
            node.id === id
              ? { ...node, data: { ...node.data, ...data }, updatedAt: new Date() }
              : node
          );
          return { nodes: updatedNodes } as Partial<DiscoveryState>;
        });
      },

      removeNode: (id) => {
        set((state) => {
          const newNodes = state.nodes.filter((n) => n.id !== id);
          const newEdges = state.edges.filter((e) => e.source !== id && e.target !== id);

          return {
            nodes: newNodes,
            edges: newEdges,
            painPointsCount: newNodes.filter((n) => n.type === 'painPoint').length,
            insightsCount: newNodes.filter((n) => n.type === 'insight').length,
            selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
          };
        });
      },

      moveNode: (id, position) => {
        set((state) => ({
          nodes: state.nodes.map((node) =>
            node.id === id ? { ...node, position, updatedAt: new Date() } : node
          ),
        }));
      },

      selectNode: (id) => {
        set({ selectedNodeId: id });
      },

      // ==================== EDGE MANAGEMENT ====================

      addEdge: (edgeData) => {
        const id = `edge_${Date.now()}`;

        const edge: DiscoveryEdge = {
          ...edgeData,
          id,
        };

        set((state) => ({
          edges: [...state.edges, edge],
        }));

        return id;
      },

      removeEdge: (id) => {
        set((state) => ({
          edges: state.edges.filter((e) => e.id !== id),
        }));
      },

      // ==================== CLIENT CONTEXT ====================

      updateClientContext: (context) => {
        set((state) => ({
          clientContext: { ...state.clientContext, ...context },
        }));
      },

      setContextComplete: (complete) => {
        set({ contextComplete: complete });
      },

      setImpactQuantified: (quantified) => {
        set({ impactQuantified: quantified });
      },

      // ==================== RECOMMENDATIONS ====================

      setRecommendations: (recommendations) => {
        set({ recommendations });
      },

      // ==================== EXTRACTION ====================

      processExtraction: (entities: ExtractedEntities) => {
        const {
          addNode,
          calculateNodePosition,
          addEdge,
          updateClientContext,
          setContextComplete,
          setImpactQuantified,
        } = get();

        // Add pain points
        const painNodeIds: Record<string, string> = {};
        entities.painPoints.forEach((pain) => {
          const position = calculateNodePosition('painPoint');
          const nodeId = addNode({
            type: 'painPoint',
            position,
            data: {
              text: pain.text,
              severity: pain.severity,
              area: pain.area,
              impact: pain.impact,
              source: 'ai' as const,
            },
          });
          painNodeIds[pain.text] = nodeId;
        });

        // Add insights and link to pains
        entities.insights.forEach((insight) => {
          const position = calculateNodePosition('insight');
          const insightId = addNode({
            type: 'insight',
            position,
            data: {
              text: insight.text,
              linkedPainIds: insight.linkedPains.map((text) => painNodeIds[text]).filter(Boolean),
              source: 'ai' as const,
            },
          });

          // Create edges to linked pains
          insight.linkedPains.forEach((painText) => {
            const painId = painNodeIds[painText];
            if (painId) {
              addEdge({
                source: painId,
                target: insightId,
                type: 'smoothstep',
                animated: true,
              });
            }
          });
        });

        // Add quotes
        entities.quotes.forEach((quote) => {
          const position = calculateNodePosition('quote');
          addNode({
            type: 'quote',
            position,
            data: {
              text: quote.text,
              sentiment: quote.sentiment,
            },
          });
        });

        // Update client context
        if (Object.keys(entities.clientContext).length > 0) {
          updateClientContext(entities.clientContext);
        }

        // Update phase progress
        if (entities.phaseProgress.contextComplete) {
          setContextComplete(true);
        }
        if (entities.phaseProgress.impactQuantified) {
          setImpactQuantified(true);
        }

        console.log('[DiscoveryStore] Processed extraction:', {
          pains: entities.painPoints.length,
          insights: entities.insights.length,
          quotes: entities.quotes.length,
        });
      },

      // ==================== VERSIONING ====================

      saveVersion: () => {
        const { activeSessionId, sessions, nodes, edges, recommendations, currentPhase } = get();

        if (!activeSessionId) return 0;

        const session = sessions[activeSessionId];
        if (!session) return 0;

        const newVersion = session.currentVersion + 1;
        const versionSnapshot: SessionVersion = {
          version: newVersion,
          createdAt: new Date(),
          snapshot: {
            nodes: [...nodes],
            edges: [...edges],
            recommendations: { ...recommendations },
            phase: currentPhase,
          },
        };

        const updatedSession: DiscoverySession = {
          ...session,
          versions: [...session.versions, versionSnapshot],
          currentVersion: newVersion,
        };

        set((state) => ({
          sessions: { ...state.sessions, [activeSessionId]: updatedSession },
        }));

        console.log('[DiscoveryStore] Saved version:', newVersion);
        return newVersion;
      },

      loadVersion: (version: number) => {
        const { activeSessionId, sessions } = get();

        if (!activeSessionId) return;

        const session = sessions[activeSessionId];
        if (!session) return;

        const versionData = session.versions.find((v) => v.version === version);
        if (!versionData) return;

        set({
          nodes: versionData.snapshot.nodes,
          edges: versionData.snapshot.edges,
          recommendations: versionData.snapshot.recommendations,
          currentPhase: versionData.snapshot.phase,
        });

        console.log('[DiscoveryStore] Loaded version:', version);
      },

      getVersions: () => {
        const { activeSessionId, sessions } = get();
        if (!activeSessionId) return [];
        return sessions[activeSessionId]?.versions || [];
      },

      // ==================== CONVERSION ====================

      convertToProject: async (projectName: string, options = {}) => {
        const { activeSessionId, nodes, clientContext, recommendations } = get();

        if (!activeSessionId) throw new Error('No active session');

        const painNodes = nodes.filter((n) => n.type === 'painPoint');
        const insightNodes = nodes.filter((n) => n.type === 'insight');

        try {
          const response = await Api.post('/discovery/sessions/convert', {
            sessionId: activeSessionId,
            projectName,
            clientContext,
            recommendations,
            painPoints: painNodes.map((n) => n.data),
            insights: insightNodes.map((n) => n.data),
            createInitiatives: options.createInitiatives ?? true,
          });

          const projectId = response.projectId;

          set((state) => {
            const session = state.sessions[activeSessionId];
            if (session) {
              return {
                sessions: {
                  ...state.sessions,
                  [activeSessionId]: {
                    ...session,
                    outcome: 'converted' as SessionOutcome,
                    convertedProjectId: projectId,
                  },
                },
              };
            }
            return state;
          });

          console.log('[DiscoveryStore] Converted to project:', projectId);
          return projectId;
        } catch (error) {
          console.error('[DiscoveryStore] Failed to convert:', error);
          throw error;
        }
      },

      attachToProject: async (projectId: string) => {
        const { activeSessionId } = get();

        if (!activeSessionId) throw new Error('No active session');

        try {
          await Api.post(`/discovery/sessions/${activeSessionId}/attach`, { projectId });

          set((state) => {
            const session = state.sessions[activeSessionId];
            if (session) {
              return {
                sessions: {
                  ...state.sessions,
                  [activeSessionId]: {
                    ...session,
                    attachedProjectId: projectId,
                  },
                },
              };
            }
            return state;
          });

          console.log('[DiscoveryStore] Attached to project:', projectId);
        } catch (error) {
          console.error('[DiscoveryStore] Failed to attach:', error);
          throw error;
        }
      },

      setOutcome: (outcome: SessionOutcome) => {
        const { activeSessionId } = get();

        if (!activeSessionId) return;

        set((state) => {
          const session = state.sessions[activeSessionId];
          if (session) {
            return {
              sessions: {
                ...state.sessions,
                [activeSessionId]: { ...session, outcome },
              },
            };
          }
          return state;
        });
      },

      // ==================== CANVAS HELPERS ====================

      getNodesInCategory: (category: CanvasCategory) => {
        const { nodes } = get();
        return nodes.filter((n) => getCategoryForType(n.type) === category);
      },

      calculateNodePosition: (type: DiscoveryNode['type']): DiscoveryNodePosition => {
        const { nodes } = get();
        const category = getCategoryForType(type);
        const categoryConfig = CANVAS_CATEGORIES.find((c) => c.id === category);

        if (!categoryConfig) {
          return { x: 100, y: 100 };
        }

        const nodesInCategory = nodes.filter((n) => getCategoryForType(n.type) === category);
        const row = Math.floor(nodesInCategory.length / 3);
        const col = nodesInCategory.length % 3;

        return {
          x: categoryConfig.position.x + col * 200,
          y: categoryConfig.position.y + row * 120,
        };
      },

      autoLayout: () => {
        const { nodes } = get();

        const layoutedNodes = nodes.map((node) => {
          const category = getCategoryForType(node.type);
          const categoryConfig = CANVAS_CATEGORIES.find((c) => c.id === category);

          if (!categoryConfig) return node;

          const nodesInCategory = nodes.filter(
            (n) => getCategoryForType(n.type) === category && nodes.indexOf(n) < nodes.indexOf(node)
          );

          const row = Math.floor(nodesInCategory.length / 3);
          const col = nodesInCategory.length % 3;

          return {
            ...node,
            position: {
              x: categoryConfig.position.x + col * 200,
              y: categoryConfig.position.y + row * 120,
            },
          };
        });

        set({ nodes: layoutedNodes });
      },

      // ==================== RESET ====================

      reset: () => {
        set({
          activeSessionId: null,
          currentPhase: 'welcome',
          nodes: [],
          edges: [],
          clientContext: INITIAL_CLIENT_CONTEXT,
          recommendations: INITIAL_RECOMMENDATIONS,
          painPointsCount: 0,
          insightsCount: 0,
          contextComplete: false,
          impactQuantified: false,
          selectedNodeId: null,
        });
      },
    }),
    {
      name: 'consultinity-discovery',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
      }),
    }
  )
);

export default useDiscoveryStore;
