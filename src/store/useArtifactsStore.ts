/**
 * useArtifactsStore - State management for AI-generated artifacts
 * Manages artifacts panel visibility, active selection, and artifact CRUD
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { Artifact } from '../types';
import type { ArtifactContentEnvelope, CanonicalFormat } from '../types/artifactContent';
import { projectToMarkdown } from '../utils/artifacts/projectToMarkdown';

// ==================== TYPES ====================

interface ArtifactsState {
  // State
  artifacts: Artifact[];
  activeArtifactId: string | null;
  isPanelOpen: boolean;
  isFullscreen: boolean;
  conversationArtifacts: Record<string, Artifact[]>; // Keyed by conversationId
  /**
   * B2 (artifact lifecycle): persisted per-conversation active artifact, so the
   * selection survives reloads the same way `conversationArtifacts` does.
   * Keyed by conversationId.
   */
  conversationActiveArtifactIds: Record<string, string | null>;

  // Actions
  addArtifact: (artifact: Artifact, conversationId?: string) => void;
  updateArtifact: (id: string, content: string) => void;
  removeArtifact: (id: string) => void;
  setActiveArtifact: (id: string | null, conversationId?: string) => void;
  /**
   * B2 (deliverables light): upsert a chat-generated deliverable reference
   * (deck/doc) into a conversation's artifact list WITHOUT the side effects of
   * `addArtifact` (no panel auto-open, no content normalization — content lives
   * server-side, the artifact is only a mountable reference).
   */
  registerConversationDeliverable: (conversationId: string, artifact: Artifact) => void;
  togglePanel: (open?: boolean) => void;
  toggleFullscreen: (fullscreen?: boolean) => void;
  clearArtifacts: () => void;
  loadConversationArtifacts: (conversationId: string) => void;
  exportArtifact: (id: string, format: string) => Promise<void>;

  // Derived
  getArtifactById: (id: string) => Artifact | undefined;
  getArtifactsByType: (type: Artifact['type']) => Artifact[];
}

const JSON_NATIVE_TYPES = new Set(['diagram', 'table', 'comparison-matrix', 'decision-timeline']);

function tryParseJson(value: string): unknown | undefined {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function buildArtifactEnvelope(artifact: Artifact): ArtifactContentEnvelope {
  const existing = (artifact as any).contentEnvelope as ArtifactContentEnvelope | undefined;
  if (existing?.contentMd) return existing;

  const type = String((artifact as any).type || 'markdown');
  const diagramData = (artifact as any).diagramData;
  const parsedContent =
    typeof artifact.content === 'string' && artifact.content.trim().startsWith('{')
      ? tryParseJson(artifact.content)
      : undefined;
  const isJsonNative = JSON_NATIVE_TYPES.has(type) || diagramData || parsedContent !== undefined;
  const canonicalFormat: CanonicalFormat = isJsonNative ? 'json' : 'markdown';
  const contentJson = diagramData || parsedContent;
  const contentMd =
    canonicalFormat === 'markdown'
      ? artifact.content
      : projectToMarkdown(type, contentJson || artifact.content);

  return {
    canonicalFormat,
    artifactType: type,
    contentMd,
    contentJson,
    markdownProjectionStatus: contentMd.trim() ? 'synced' : 'missing',
    markdownProjectedAt: new Date().toISOString(),
  };
}

function normalizeArtifactContentContract(artifact: Artifact): Artifact {
  const contentEnvelope = buildArtifactEnvelope(artifact);
  return {
    ...artifact,
    content: contentEnvelope.contentMd || artifact.content,
    metadata: {
      ...((artifact as any).metadata || {}),
      contentEnvelope,
    },
    ...(contentEnvelope as any),
    contentEnvelope,
  } as Artifact;
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
      conversationActiveArtifactIds: {},

      // Actions
      addArtifact: (artifact, conversationId) =>
        set((state) => {
          const normalizedArtifact = normalizeArtifactContentContract(artifact);
          const newArtifacts = [...state.artifacts, normalizedArtifact];

          // Also store in conversation artifacts if conversationId provided
          let newConversationArtifacts = state.conversationArtifacts;
          let newConversationActiveIds = state.conversationActiveArtifactIds;
          if (conversationId) {
            const existing = state.conversationArtifacts[conversationId] || [];
            newConversationArtifacts = {
              ...state.conversationArtifacts,
              [conversationId]: [...existing, normalizedArtifact],
            };
            // B2: persist the active selection per conversation.
            newConversationActiveIds = {
              ...state.conversationActiveArtifactIds,
              [conversationId]: normalizedArtifact.id,
            };
          }

          return {
            artifacts: newArtifacts,
            conversationArtifacts: newConversationArtifacts,
            conversationActiveArtifactIds: newConversationActiveIds,
            activeArtifactId: normalizedArtifact.id,
            isPanelOpen: true, // Auto-open panel when artifact is added
          };
        }),

      updateArtifact: (id, content) =>
        set((state) => {
          const updateInArray = (artifacts: Artifact[]) =>
            artifacts.map((a) =>
              a.id === id
                ? ({
                    ...a,
                    content,
                    updatedAt: new Date(),
                    metadata: {
                      ...((a as any).metadata || {}),
                      wave5Governance: {
                        ...(((a as any).metadata || {}).wave5Governance || {}),
                        localDraftOnly: true,
                        requiresMutationProposal: true,
                        lastLocalEditAt: new Date().toISOString(),
                        note: 'Local artifact edits are draft-only. Workspace commit requires a Wave 5 mutation proposal.',
                      },
                    },
                  } as Artifact)
                : a
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

          // B2: drop persisted per-conversation selections pointing at the removed artifact.
          const updatedConversationActiveIds = Object.fromEntries(
            Object.entries(state.conversationActiveArtifactIds).map(([convId, activeId]) => [
              convId,
              activeId === id ? null : activeId,
            ])
          );

          return {
            artifacts: newArtifacts,
            conversationArtifacts: updatedConversationArtifacts,
            conversationActiveArtifactIds: updatedConversationActiveIds,
            activeArtifactId: newActiveId,
            isPanelOpen: newArtifacts.length > 0,
          };
        }),

      setActiveArtifact: (id, conversationId) =>
        set((state) => ({
          activeArtifactId: id,
          ...(conversationId
            ? {
                conversationActiveArtifactIds: {
                  ...state.conversationActiveArtifactIds,
                  [conversationId]: id,
                },
              }
            : {}),
        })),

      registerConversationDeliverable: (conversationId, artifact) =>
        set((state) => {
          const existing = state.conversationArtifacts[conversationId] || [];
          const index = existing.findIndex((item) => item.id === artifact.id);
          const merged =
            index >= 0
              ? existing.map((item, itemIndex) =>
                  itemIndex === index
                    ? ({
                        ...item,
                        ...artifact,
                        metadata: {
                          ...((item as any).metadata || {}),
                          ...((artifact as any).metadata || {}),
                        },
                      } as Artifact)
                    : item
                )
              : [...existing, artifact];
          return {
            conversationArtifacts: {
              ...state.conversationArtifacts,
              [conversationId]: merged,
            },
            conversationActiveArtifactIds: {
              ...state.conversationActiveArtifactIds,
              [conversationId]: artifact.id,
            },
          };
        }),

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
          // B2: restore the persisted per-conversation active artifact (falls back
          // to the first artifact when the persisted id no longer exists).
          const persistedActiveId = state.conversationActiveArtifactIds[conversationId];
          const restoredActiveId =
            persistedActiveId && artifacts.some((artifact) => artifact.id === persistedActiveId)
              ? persistedActiveId
              : artifacts.length > 0
                ? artifacts[0].id
                : null;
          return {
            artifacts,
            activeArtifactId: restoredActiveId,
            // B2: don't force the panel open on conversation open — only close it
            // when the conversation has nothing to show.
            isPanelOpen: artifacts.length > 0 ? state.isPanelOpen : false,
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
        link.download = `${(artifact.title ?? 'artifact')
          .replace(/[^a-z0-9]/gi, '_')
          .toLowerCase()}-${Date.now()}.${extension}`;
        link.click();
        URL.revokeObjectURL(url);
      },

      // Derived getters
      getArtifactById: (id) => get().artifacts.find((a) => a.id === id),

      getArtifactsByType: (type) => get().artifacts.filter((a) => a.type === type),
    }),
    {
      name: 'consultify-artifacts',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist conversation artifacts, not current session
        conversationArtifacts: state.conversationArtifacts,
        // B2: per-conversation active artifact survives reloads too.
        conversationActiveArtifactIds: state.conversationActiveArtifactIds,
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
): Artifact => {
  const artifact = {
    id: `artifact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    title,
    content,
    editable: true,
    version: 1,
    createdAt: new Date(),
    ...options,
  } as Artifact;
  return normalizeArtifactContentContract(artifact);
};

/**
 * Parse AI response for artifacts
 * Looks for special markers like ```artifact:code:title or ```artifact:code:language:title or JSON artifact blocks
 * Also parses diagram blocks: ```diagram:type:title\n{nodes, edges JSON}\n```
 */
export const parseArtifactsFromResponse = (response: string): Artifact[] => {
  const artifacts: Artifact[] = [];
  const processedPositions = new Set<number>(); // Track positions to avoid duplicates

  const normalizeArtifactType = (type: string): Artifact['type'] | null => {
    const normalized = type === 'comparison' ? 'comparison-matrix' : type;
    return isValidArtifactType(normalized) ? (normalized as Artifact['type']) : null;
  };

  // Pattern for artifact blocks with language: ```artifact:type:language:title\ncontent\n```
  const artifactPatternWithLang = /```artifact:([\w-]+):(\w+):([^\n]+)\n([\s\S]*?)```/g;
  let match;

  while ((match = artifactPatternWithLang.exec(response)) !== null) {
    const [, type, language, title, content] = match;
    const artifactType = normalizeArtifactType(type);
    if (artifactType) {
      processedPositions.add(match.index);
      artifacts.push(createArtifact(artifactType, title.trim(), content.trim(), { language }));
    }
  }

  // Pattern for artifact blocks without language: ```artifact:type:title\ncontent\n```
  const artifactPattern = /```artifact:([\w-]+):([^\n]+)\n([\s\S]*?)```/g;

  while ((match = artifactPattern.exec(response)) !== null) {
    // Skip if already processed by language pattern
    if (processedPositions.has(match.index)) continue;

    const [, type, title, content] = match;
    const artifactType = normalizeArtifactType(type);
    if (artifactType) {
      processedPositions.add(match.index);
      artifacts.push(createArtifact(artifactType, title.trim(), content.trim()));
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

export const stripArtifactsFromResponse = (response: string): string =>
  String(response || '')
    .replace(/```artifact:[\w-]+(?::\w+)?:[^\n]+\n[\s\S]*?```/g, '')
    .replace(/```json:artifact\n[\s\S]*?```/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const isValidArtifactType = (type: string): type is Artifact['type'] => {
  return [
    'markdown',
    'code',
    'html',
    'diagram',
    'table',
    'comparison-matrix',
    'decision-timeline',
    'pmo-document',
  ].includes(type);
};

export default useArtifactsStore;
