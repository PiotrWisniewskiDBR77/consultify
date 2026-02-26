/**
 * Open Documents Store (V3-A02)
 * Central Zustand store for dynamic tabs across module hubs.
 * Persists to sessionStorage so tabs survive page refresh.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OpenDocumentType =
  | 'initiative'
  | 'tool_session'
  | 'report'
  | 'presentation'
  | 'kpi'
  | 'decision'
  | 'task';

export interface OpenDocument {
  id: string;
  type: OpenDocumentType;
  title: string;
  moduleKey: string;
  routeKey: string;
  dirty: boolean;
  lastVisitedAt: string;
  metadata?: Record<string, unknown>;
}

interface OpenDocumentsState {
  documents: Record<string, OpenDocument[]>;
  activeDocumentId: Record<string, string | null>;
  maxVisibleTabs: number;

  openDocument: (doc: OpenDocument) => void;
  closeDocument: (moduleKey: string, docId: string) => void;
  setActiveDocument: (moduleKey: string, docId: string | null) => void;
  markDirty: (moduleKey: string, docId: string, dirty: boolean) => void;
  getDocuments: (moduleKey: string) => OpenDocument[];
  getOverflowDocuments: (moduleKey: string) => OpenDocument[];
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const DEFAULT_MAX_VISIBLE_TABS = 5;

export const useOpenDocumentsStore = create<OpenDocumentsState>()(
  persist(
    (set, get) => ({
      documents: {},
      activeDocumentId: {},
      maxVisibleTabs: DEFAULT_MAX_VISIBLE_TABS,

      openDocument: (doc) => {
        const now = new Date().toISOString();
        const fullDoc: OpenDocument = {
          ...doc,
          lastVisitedAt: doc.lastVisitedAt || now,
          dirty: doc.dirty ?? false,
        };

        set((state) => {
          const moduleDocs = state.documents[doc.moduleKey] || [];
          const existingIdx = moduleDocs.findIndex((d) => d.id === doc.id);
          let nextDocs: OpenDocument[];

          if (existingIdx >= 0) {
            nextDocs = moduleDocs.map((d, i) =>
              i === existingIdx ? { ...fullDoc, lastVisitedAt: now } : d
            );
          } else {
            nextDocs = [{ ...fullDoc, lastVisitedAt: now }, ...moduleDocs];
          }

          return {
            documents: { ...state.documents, [doc.moduleKey]: nextDocs },
            activeDocumentId: { ...state.activeDocumentId, [doc.moduleKey]: doc.id },
          };
        });
      },

      closeDocument: (moduleKey, docId) => {
        set((state) => {
          const moduleDocs = (state.documents[moduleKey] || []).filter((d) => d.id !== docId);
          const activeId = state.activeDocumentId[moduleKey];
          let nextActive: string | null = activeId;

          if (activeId === docId) {
            const remaining = moduleDocs;
            nextActive = remaining.length > 0 ? remaining[0].id : null;
          }

          return {
            documents: { ...state.documents, [moduleKey]: moduleDocs },
            activeDocumentId: { ...state.activeDocumentId, [moduleKey]: nextActive },
          };
        });
      },

      setActiveDocument: (moduleKey, docId) => {
        set((state) => {
          const moduleDocs = state.documents[moduleKey] || [];
          const doc = moduleDocs.find((d) => d.id === docId);
          const now = new Date().toISOString();

          const updatedDocs = doc
            ? moduleDocs.map((d) => (d.id === docId ? { ...d, lastVisitedAt: now } : d))
            : moduleDocs;

          return {
            documents: { ...state.documents, [moduleKey]: updatedDocs },
            activeDocumentId: { ...state.activeDocumentId, [moduleKey]: docId },
          };
        });
      },

      markDirty: (moduleKey, docId, dirty) => {
        set((state) => {
          const moduleDocs = state.documents[moduleKey] || [];
          const updated = moduleDocs.map((d) => (d.id === docId ? { ...d, dirty } : d));
          return {
            documents: { ...state.documents, [moduleKey]: updated },
          };
        });
      },

      getDocuments: (moduleKey) => {
        const docs = get().documents[moduleKey] || [];
        return [...docs].sort(
          (a, b) => new Date(b.lastVisitedAt).getTime() - new Date(a.lastVisitedAt).getTime()
        );
      },

      getOverflowDocuments: (moduleKey) => {
        const docs = get().getDocuments(moduleKey);
        const max = get().maxVisibleTabs;
        return docs.length > max ? docs.slice(max) : [];
      },
    }),
    {
      name: 'consultify-open-documents',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        documents: state.documents,
        activeDocumentId: state.activeDocumentId,
      }),
    }
  )
);

export default useOpenDocumentsStore;
