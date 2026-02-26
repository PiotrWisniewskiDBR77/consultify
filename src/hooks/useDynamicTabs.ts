/**
 * useDynamicTabs (V3-A02)
 * Hook integrating openDocumentsStore with a specific module.
 */

import { useCallback } from 'react';

import { trackFunnelEvent } from '../services/funnelAnalytics';
import { type OpenDocument, useOpenDocumentsStore } from '../store/openDocumentsStore';

export interface UseDynamicTabsOptions {
  moduleKey: string;
  maxVisibleTabs?: number;
}

export interface UseDynamicTabsReturn {
  documents: OpenDocument[];
  activeDocumentId: string | null;
  visibleTabs: OpenDocument[];
  overflowTabs: OpenDocument[];
  isCollectionView: boolean;
  openDocument: (doc: Omit<OpenDocument, 'moduleKey' | 'lastVisitedAt'>) => void;
  closeDocument: (docId: string) => void;
  closeAll: () => void;
  switchToDocument: (docId: string) => void;
  switchToCollection: () => void;
  markDirty: (docId: string, dirty: boolean) => void;
}

export function useDynamicTabs({
  moduleKey,
  maxVisibleTabs = 5,
}: UseDynamicTabsOptions): UseDynamicTabsReturn {
  const documents = useOpenDocumentsStore((s) => s.getDocuments(moduleKey));
  const activeDocumentId = useOpenDocumentsStore((s) => s.activeDocumentId[moduleKey] ?? null);
  const openDocumentStore = useOpenDocumentsStore((s) => s.openDocument);
  const closeDocumentStore = useOpenDocumentsStore((s) => s.closeDocument);
  const setActiveDocument = useOpenDocumentsStore((s) => s.setActiveDocument);
  const markDirtyStore = useOpenDocumentsStore((s) => s.markDirty);

  const visibleTabs = documents.slice(0, maxVisibleTabs);
  const overflowTabs = documents.slice(maxVisibleTabs);
  const isCollectionView = activeDocumentId === null;

  const openDocument = useCallback(
    (doc: Omit<OpenDocument, 'moduleKey' | 'lastVisitedAt'>) => {
      const full: OpenDocument = {
        ...doc,
        moduleKey,
        lastVisitedAt: new Date().toISOString(),
      };
      openDocumentStore(full);
      trackFunnelEvent('dynamic_tab_opened', { type: doc.type, moduleKey });
    },
    [moduleKey, openDocumentStore]
  );

  const closeDocument = useCallback(
    (docId: string) => {
      closeDocumentStore(moduleKey, docId);
    },
    [moduleKey, closeDocumentStore]
  );

  const closeAll = useCallback(() => {
    documents.forEach((d) => closeDocumentStore(moduleKey, d.id));
  }, [moduleKey, documents, closeDocumentStore]);

  const switchToDocument = useCallback(
    (docId: string) => {
      setActiveDocument(moduleKey, docId);
    },
    [moduleKey, setActiveDocument]
  );

  const switchToCollection = useCallback(() => {
    setActiveDocument(moduleKey, null);
  }, [moduleKey, setActiveDocument]);

  const markDirty = useCallback(
    (docId: string, dirty: boolean) => {
      markDirtyStore(moduleKey, docId, dirty);
    },
    [moduleKey, markDirtyStore]
  );

  return {
    documents,
    activeDocumentId,
    visibleTabs,
    overflowTabs,
    isCollectionView,
    openDocument,
    closeDocument,
    closeAll,
    switchToDocument,
    switchToCollection,
    markDirty,
  };
}

export default useDynamicTabs;
