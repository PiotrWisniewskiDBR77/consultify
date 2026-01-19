/**
 * useArtifactsStore - State management for AI-generated artifacts
 * Manages artifacts panel visibility, active selection, and artifact CRUD
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { Artifact } from '../types';

// ==================== TYPES ====================

interface ArtifactsState {
  // State
  artifacts: Artifact[];
  activeArtifactId: string | null;
  isPanelOpen: boolean;
  isFullscreen: boolean;
  conversationArtifacts: Record<string, Artifact[]>; // Keyed by conversationId

  // Actions
  addArtifact: (artifact: Artifact, conversationId?: string) => void;
  updateArtifact: (id: string, content: string) => void;
  removeArtifact: (id: string) => void;
  setActiveArtifact: (id: string | null) => void;
  togglePanel: (open?: boolean) => void;
  toggleFullscreen: (fullscreen?: boolean) => void;
  clearArtifacts: () => void;
  loadConversationArtifacts: (conversationId: string) => void;
  exportArtifact: (id: string, format: string) => Promise<void>;

  // Derived
  getArtifactById: (id: string) => Artifact | undefined;
  getArtifactsByType: (type: Artifact['type']) => Artifact[];
}

// ==================== STORE ====================

export const useArtifactsStore = create<ArtifactsState>()(
  persist(
    (set, get) => ({
      // Initial State
      artifacts: [],
      activeArtifactId: null,
      isPanelOpen: false,
      isFullscreen: false,
      conversationArtifacts: {},

      // Actions
      addArtifact: (artifact, conversationId) =>
        set((state) => {
          const newArtifacts = [...state.artifacts, artifact];

          // Also store in conversation artifacts if conversationId provided
          let newConversationArtifacts = state.conversationArtifacts;
          if (conversationId) {
            const existing = state.conversationArtifacts[conversationId] || [];
            newConversationArtifacts = {
              ...state.conversationArtifacts,
              [conversationId]: [...existing, artifact],
            };
          }

          return {
            artifacts: newArtifacts,
            conversationArtifacts: newConversationArtifacts,
            activeArtifactId: artifact.id,
            isPanelOpen: true, // Auto-open panel when artifact is added
          };
        }),

      updateArtifact: (id, content) =>
        set((state) => {
          const updateInArray = (artifacts: Artifact[]) =>
            artifacts.map((a) =>
              a.id === id ? { ...a, content, version: a.version + 1, updatedAt: new Date() } : a
            );

          const updatedArtifacts = updateInArray(state.artifacts);

          // Update in all conversation artifacts
          const updatedConversationArtifacts = Object.fromEntries(
            Object.entries(state.conversationArtifacts).map(([convId, arts]) => [
              convId,
              updateInArray(arts),
            ])
          );

          return {
            artifacts: updatedArtifacts,
            conversationArtifacts: updatedConversationArtifacts,
          };
        }),

      removeArtifact: (id) =>
        set((state) => {
          const filterArray = (artifacts: Artifact[]) => artifacts.filter((a) => a.id !== id);
          const newArtifacts = filterArray(state.artifacts);

          // Remove from all conversation artifacts
          const updatedConversationArtifacts = Object.fromEntries(
            Object.entries(state.conversationArtifacts).map(([convId, arts]) => [
              convId,
              filterArray(arts),
            ])
          );

          // Reset active if removed
          const newActiveId =
            state.activeArtifactId === id
              ? newArtifacts.length > 0
                ? newArtifacts[0].id
                : null
              : state.activeArtifactId;

          return {
            artifacts: newArtifacts,
            conversationArtifacts: updatedConversationArtifacts,
            activeArtifactId: newActiveId,
            isPanelOpen: newArtifacts.length > 0,
          };
        }),

      setActiveArtifact: (id) => set({ activeArtifactId: id }),

      togglePanel: (open) =>
        set((state) => ({
          isPanelOpen: open !== undefined ? open : !state.isPanelOpen,
        })),

      toggleFullscreen: (fullscreen) =>
        set((state) => ({
          isFullscreen: fullscreen !== undefined ? fullscreen : !state.isFullscreen,
        })),

      clearArtifacts: () =>
        set({
          artifacts: [],
          activeArtifactId: null,
          isPanelOpen: false,
          isFullscreen: false,
        }),

      loadConversationArtifacts: (conversationId) =>
        set((state) => {
          const artifacts = state.conversationArtifacts[conversationId] || [];
          return {
            artifacts,
            activeArtifactId: artifacts.length > 0 ? artifacts[0].id : null,
            isPanelOpen: artifacts.length > 0,
          };
        }),

      exportArtifact: async (id, format) => {
        const state = get();
        const artifact = state.artifacts.find((a) => a.id === id);
        if (!artifact) return;

        let content = artifact.content;
        let mimeType = 'text/plain';
        let extension = format;

        switch (format) {
          case 'md':
            mimeType = 'text/markdown';
            break;
          case 'html':
            mimeType = 'text/html';
            break;
          case 'json':
            mimeType = 'application/json';
            content = JSON.stringify({ ...artifact, exportedAt: new Date() }, null, 2);
            break;
          case 'csv':
            mimeType = 'text/csv';
            break;
          default:
            mimeType = 'text/plain';
            extension = 'txt';
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${artifact.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${Date.now()}.${extension}`;
        link.click();
        URL.revokeObjectURL(url);
      },

      // Derived getters
      getArtifactById: (id) => get().artifacts.find((a) => a.id === id),

      getArtifactsByType: (type) => get().artifacts.filter((a) => a.type === type),
    }),
    {
      name: 'consultinity-artifacts',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist conversation artifacts, not current session
        conversationArtifacts: state.conversationArtifacts,
      }),
    }
  )
);

// ==================== HELPERS ====================

/**
 * Create a new artifact with defaults
 */
export const createArtifact = (
  type: Artifact['type'],
  title: string,
  content: string,
  options: Partial<Artifact> = {}
): Artifact => ({
  id: `artifact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  type,
  title,
  content,
  editable: true,
  version: 1,
  createdAt: new Date(),
  ...options,
});

/**
 * Parse AI response for artifacts
 * Looks for special markers like ```artifact:code:title or ```artifact:code:language:title or JSON artifact blocks
 * Also parses diagram blocks: ```diagram:type:title\n{nodes, edges JSON}\n```
 */
export const parseArtifactsFromResponse = (response: string): Artifact[] => {
  const artifacts: Artifact[] = [];
  const processedPositions = new Set<number>(); // Track positions to avoid duplicates

  // Pattern for artifact blocks with language: ```artifact:type:language:title\ncontent\n```
  const artifactPatternWithLang = /```artifact:(\w+):(\w+):([^\n]+)\n([\s\S]*?)```/g;
  let match;

  while ((match = artifactPatternWithLang.exec(response)) !== null) {
    const [, type, language, title, content] = match;
    if (isValidArtifactType(type)) {
      processedPositions.add(match.index);
      artifacts.push(
        createArtifact(type as Artifact['type'], title.trim(), content.trim(), { language })
      );
    }
  }

  // Pattern for artifact blocks without language: ```artifact:type:title\ncontent\n```
  const artifactPattern = /```artifact:(\w+):([^\n]+)\n([\s\S]*?)```/g;

  while ((match = artifactPattern.exec(response)) !== null) {
    // Skip if already processed by language pattern
    if (processedPositions.has(match.index)) continue;

    const [, type, title, content] = match;
    if (isValidArtifactType(type)) {
      processedPositions.add(match.index);
      artifacts.push(createArtifact(type as Artifact['type'], title.trim(), content.trim()));
    }
  }

  // Pattern for diagram blocks: ```diagram:type:title\n{JSON}\n```
  const diagramPattern = /```diagram:(\w+):([^\n]+)\n([\s\S]*?)```/g;
  while ((match = diagramPattern.exec(response)) !== null) {
    if (processedPositions.has(match.index)) continue;

    const [, diagramType, title, jsonContent] = match;
    try {
      const diagramData = JSON.parse(jsonContent.trim());
      if (diagramData.nodes && Array.isArray(diagramData.nodes)) {
        processedPositions.add(match.index);
        artifacts.push(
          createArtifact('diagram', title.trim(), '', {
            diagramData: {
              diagramType: diagramType as
                | 'process_flow'
                | 'decision_tree'
                | 'mind_map'
                | 'org_chart',
              nodes: diagramData.nodes,
              edges: diagramData.edges || [],
            },
          })
        );
      }
    } catch (e) {
      // Invalid JSON, skip diagram
    }
  }

  // Also check for JSON artifact definitions
  const jsonPattern = /```json:artifact\n([\s\S]*?)```/g;
  while ((match = jsonPattern.exec(response)) !== null) {
    try {
      const artifactDef = JSON.parse(match[1]);
      if (artifactDef.type && artifactDef.content) {
        artifacts.push(
          createArtifact(
            artifactDef.type,
            artifactDef.title || 'Untitled',
            artifactDef.content,
            artifactDef
          )
        );
      }
    } catch (e) {
      // Invalid JSON, skip
    }
  }

  return artifacts;
};

const isValidArtifactType = (type: string): type is Artifact['type'] => {
  return ['markdown', 'code', 'html', 'diagram', 'table', 'pmo-document'].includes(type);
};

export default useArtifactsStore;
